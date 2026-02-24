
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.1';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID');
const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET');

async function getAccessToken(refresh_token: string) {
    const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            client_id: GOOGLE_CLIENT_ID!,
            client_secret: GOOGLE_CLIENT_SECRET!,
            refresh_token,
            grant_type: 'refresh_token',
        }),
    });
    const data = await response.json();
    return data.access_token;
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const authHeader = req.headers.get('Authorization');
        if (!authHeader) throw new Error('Missing Authorization header');

        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_ANON_KEY') ?? '',
            { global: { headers: { Authorization: authHeader } } }
        );

        // Verify user identity
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            console.error('Auth Error:', authError);
            return new Response(JSON.stringify({ error: 'Unauthorized' }), {
                status: 401,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        const adminClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        const body = await req.json().catch(() => ({}));
        const { action, reset } = body;
        const agentId = user.id; // Always use the authenticated user's ID

        // Force reset if requested
        if (reset) {
            await adminClient
                .from('profiles')
                .update({ google_sync_token: null })
                .eq('id', agentId);
        }

        const { data: profile, error: profileError } = await adminClient
            .from('profiles')
            .select('google_refresh_token, google_sync_token')
            .eq('id', agentId)
            .single();

        if (profileError || !profile?.google_refresh_token) {
            return new Response(JSON.stringify({ error: 'Google Calendar not linked' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        const accessToken = await getAccessToken(profile.google_refresh_token);

        // --- SYNC FROM GOOGLE TO CRM ---
        if (action === 'sync_from_google') {
            const results = { events: 0, tasks: 0 };

            // 1. Fetch Calendar Events
            let calendarUrl = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';
            const calParams = new URLSearchParams();
            if (profile.google_sync_token && !reset) {
                calParams.set('syncToken', profile.google_sync_token);
            } else {
                const sixMonthsAgo = new Date();
                sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
                calParams.set('timeMin', sixMonthsAgo.toISOString());
            }
            calendarUrl += `?${calParams.toString()}`;

            const calResponse = await fetch(calendarUrl, {
                headers: { Authorization: `Bearer ${accessToken}` },
            });

            if (calResponse.status === 410) {
                await adminClient.from('profiles').update({ google_sync_token: null }).eq('id', agentId);
                return new Response(JSON.stringify({ retry: true }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                });
            }

            if (calResponse.ok) {
                const data = await calResponse.json();
                const events = data.items || [];

                // Fetch existing task types to avoid overwriting them
                const googleEventIds = events.filter(e => e.status !== 'cancelled').map(e => e.id);
                const { data: existingTasks } = await adminClient
                    .from('crm_tasks')
                    .select('google_event_id, task_type')
                    .in('google_event_id', googleEventIds);

                const typeMap = new Map(existingTasks?.map(t => [t.google_event_id, t.task_type]) || []);

                for (const event of events) {
                    if (event.status === 'cancelled') {
                        await adminClient.from('crm_tasks').delete().eq('google_event_id', event.id);
                    } else {
                        const existingType = typeMap.get(event.id);
                        const taskData = {
                            agent_id: agentId,
                            action: event.summary || '(Sin título)',
                            description: event.description || '',
                            description_html: event.description || '',
                            execution_date: event.start?.dateTime || event.start?.date,
                            end_date: event.end?.dateTime || event.end?.date,
                            location: event.location || '',
                            hangout_link: event.hangoutLink || '',
                            attendees: event.attendees || [],
                            task_type: existingType || ((event.attendees && event.attendees.length > 0) || event.location ? 'meeting' : 'task'),
                            is_all_day: !!event.start?.date,
                            google_event_id: event.id,
                            google_etag: event.etag,
                            last_synced_at: new Date().toISOString(),
                        };
                        if (taskData.execution_date) {
                            await adminClient.from('crm_tasks').upsert(taskData, { onConflict: 'google_event_id' });
                            results.events++;
                        }
                    }
                }
                if (data.nextSyncToken) {
                    await adminClient.from('profiles').update({ google_sync_token: data.nextSyncToken }).eq('id', agentId);
                }
            }

            // 2. Fetch Google Tasks
            const tasksUrl = 'https://www.googleapis.com/tasks/v1/lists/@default/tasks?showCompleted=true&showHidden=true';
            const tasksResponse = await fetch(tasksUrl, {
                headers: { Authorization: `Bearer ${accessToken}` },
            });

            if (tasksResponse.ok) {
                const data = await tasksResponse.json();
                const tasks = data.items || [];
                for (const gTask of tasks) {
                    const internalGId = `GT_${gTask.id}`;
                    if (gTask.deleted) {
                        await adminClient.from('crm_tasks').delete().eq('google_event_id', internalGId);
                    } else {
                        const taskData = {
                            agent_id: agentId,
                            action: gTask.title || '(Sin título)',
                            description: gTask.notes || '',
                            description_html: gTask.notes || '',
                            execution_date: gTask.due,
                            completed: gTask.status === 'completed',
                            task_type: 'task',
                            is_all_day: true,
                            google_event_id: internalGId,
                            google_etag: gTask.etag,
                            last_synced_at: new Date().toISOString(),
                        };
                        if (taskData.execution_date) {
                            await adminClient.from('crm_tasks').upsert(taskData, { onConflict: 'google_event_id' });
                            results.tasks++;
                        }
                    }
                }
            }

            console.log(`Sync complete. Results:`, results);
            return new Response(JSON.stringify({ success: true, results }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        // --- PUSH LOCAL TASK TO GOOGLE ---
        if (action === 'push_to_google') {
            const { taskId, create_meet } = body;
            const { data: task, error: taskErr } = await adminClient.from('crm_tasks').select('*').eq('id', taskId).single();

            if (taskErr || !task) throw new Error('Task not found');
            if (task.agent_id !== agentId) throw new Error('Unauthorized');

            const shouldBeGoogleTask = task.task_type === 'task' && task.is_all_day;
            const currentlyIsGoogleTask = task.google_event_id && task.google_event_id.startsWith('GT_');
            const currentlyIsCalendarEvent = task.google_event_id && !task.google_event_id.startsWith('GT_');

            // --- API HANDOVER ---
            // If it was a Google Task but now should be a Calendar Event (or vice versa), delete from old API first
            if (currentlyIsGoogleTask && !shouldBeGoogleTask) {
                console.log(`Switching from Google Tasks to Calendar Event for task ${taskId}`);
                const taskIdReal = task.google_event_id.replace('GT_', '');
                await fetch(`https://www.googleapis.com/tasks/v1/lists/@default/tasks/${taskIdReal}`, {
                    method: 'DELETE',
                    headers: { Authorization: `Bearer ${accessToken}` },
                });
                task.google_event_id = null;
            } else if (currentlyIsCalendarEvent && shouldBeGoogleTask) {
                console.log(`Switching from Calendar Event to Google Tasks for task ${taskId}`);
                await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${task.google_event_id}`, {
                    method: 'DELETE',
                    headers: { Authorization: `Bearer ${accessToken}` },
                });
                task.google_event_id = null;
            }

            if (shouldBeGoogleTask) {
                // Handle as Google Task (All-day)
                const googleTask: any = {
                    title: task.action,
                    notes: task.description_html || task.description,
                    due: task.execution_date ? new Date(task.execution_date).toISOString() : undefined,
                    status: task.completed ? 'completed' : 'needsAction'
                };

                let method = 'POST';
                let url = 'https://www.googleapis.com/tasks/v1/lists/@default/tasks';

                if (task.google_event_id && task.google_event_id.startsWith('GT_')) {
                    method = 'PATCH';
                    const taskIdReal = task.google_event_id.replace('GT_', '');
                    url += `/${taskIdReal}`;
                }

                const response = await fetch(url, {
                    method,
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(googleTask),
                });

                const result = await response.json();

                if (response.ok) {
                    await adminClient.from('crm_tasks').update({
                        google_event_id: `GT_${result.id}`,
                        google_etag: result.etag,
                        last_synced_at: new Date().toISOString()
                    }).eq('id', taskId);
                    return new Response(JSON.stringify({ success: true, google_id: result.id }), {
                        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    });
                } else {
                    console.error('Google Task Push Error:', result);
                    return new Response(JSON.stringify({ success: false, error: result }), {
                        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    });
                }
            } else {
                // Handle as Calendar Event
                const attendees = [...(task.attendees || [])];
                if (task.contact_id) {
                    const { data: contact } = await adminClient.from('contacts').select('email').eq('id', task.contact_id).single();
                    if (contact?.email && !attendees.some((a: any) => a.email === contact.email)) {
                        attendees.push({ email: contact.email });
                    }
                }

                const googleEvent: any = {
                    summary: task.action,
                    description: task.description_html || task.description,
                    location: task.location || '',
                    attendees,
                };

                if (task.is_all_day) {
                    googleEvent.start = { date: new Date(task.execution_date).toISOString().split('T')[0] };
                    // For all-day events, the end date must be the next day (exclusive)
                    const endDate = new Date(task.execution_date);
                    endDate.setDate(endDate.getDate() + 1);
                    googleEvent.end = { date: endDate.toISOString().split('T')[0] };
                } else {
                    googleEvent.start = { dateTime: new Date(task.execution_date).toISOString() };
                    googleEvent.end = { dateTime: new Date(task.end_date || (new Date(task.execution_date).getTime() + 3600000)).toISOString() };
                }

                if (create_meet) {
                    googleEvent.conferenceData = {
                        createRequest: {
                            requestId: crypto.randomUUID(),
                            conferenceSolutionKey: { type: "hangoutsMeet" }
                        }
                    };
                }

                let method = 'POST';
                let url = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';

                if (create_meet) {
                    url += '?conferenceDataVersion=1';
                }

                if (task.google_event_id && !task.google_event_id.startsWith('GT_')) {
                    method = 'PUT';
                    const baseIdUrl = `https://www.googleapis.com/calendar/v3/calendars/primary/events/${task.google_event_id}`;
                    url = create_meet ? `${baseIdUrl}?conferenceDataVersion=1` : baseIdUrl;
                }

                const response = await fetch(url, {
                    method,
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(googleEvent),
                });

                const result = await response.json();

                if (response.ok) {
                    await adminClient.from('crm_tasks').update({
                        google_event_id: result.id,
                        google_etag: result.etag,
                        hangout_link: result.hangoutLink || (result.conferenceData?.entryPoints?.find((ep: any) => ep.entryPointType === 'video')?.uri) || task.hangout_link,
                        attendees: result.attendees || task.attendees,
                        last_synced_at: new Date().toISOString()
                    }).eq('id', taskId);
                    return new Response(JSON.stringify({ success: true, google_id: result.id, hangout_link: result.hangoutLink }), {
                        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    });
                } else {
                    console.error('Google Push Error:', result);
                    return new Response(JSON.stringify({ success: false, error: result }), {
                        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    });
                }
            }
        }

        return new Response(JSON.stringify({ error: 'Action not found' }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

    } catch (error) {
        console.error('Sync Error:', error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
});
