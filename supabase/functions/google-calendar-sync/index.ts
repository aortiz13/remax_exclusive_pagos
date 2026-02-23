
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
            let url = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';
            const params = new URLSearchParams();

            if (profile.google_sync_token && !reset) {
                params.set('syncToken', profile.google_sync_token);
            } else {
                // Initial sync or reset: fetch from 6 months ago to future
                const sixMonthsAgo = new Date();
                sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
                params.set('timeMin', sixMonthsAgo.toISOString());
            }

            url += `?${params.toString()}`;

            const response = await fetch(url, {
                headers: { Authorization: `Bearer ${accessToken}` },
            });

            if (response.status === 410) {
                // Sync token expired, clear and re-sync
                await adminClient.from('profiles').update({ google_sync_token: null }).eq('id', agentId);
                return new Response(JSON.stringify({ retry: true }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                });
            }

            const data = await response.json();
            const events = data.items || [];
            let processed = 0;

            console.log(`Processing ${events.length} events for agent ${agentId} (Action: ${action}, Reset: ${reset})`);

            for (const event of events) {
                const isDeleted = event.status === 'cancelled';

                if (isDeleted) {
                    const { error: delErr } = await adminClient.from('crm_tasks').delete().eq('google_event_id', event.id);
                    if (delErr) console.error(`Delete error for ${event.id}:`, delErr);
                } else {
                    const taskData = {
                        agent_id: agentId,
                        action: event.summary || '(Sin título)',
                        description: event.description || '',
                        description_html: event.description || '', // Google often returns HTML here
                        execution_date: event.start?.dateTime || event.start?.date,
                        end_date: event.end?.dateTime || event.end?.date,
                        location: event.location || '',
                        hangout_link: event.hangoutLink || '',
                        attendees: event.attendees || [],
                        task_type: (event.attendees && event.attendees.length > 0) || event.location ? 'meeting' : 'task',
                        google_event_id: event.id,
                        google_etag: event.etag,
                        last_synced_at: new Date().toISOString(),
                    };

                    if (!taskData.execution_date) {
                        console.warn(`Skipping event ${event.id} due to missing date`);
                        continue;
                    }

                    const { error: upsertErr } = await adminClient.from('crm_tasks').upsert(taskData, { onConflict: 'google_event_id' });
                    if (upsertErr) {
                        console.error(`Upsert error for ${event.id}:`, upsertErr);
                    } else {
                        processed++;
                    }
                }
            }

            if (data.nextSyncToken) {
                await adminClient.from('profiles').update({ google_sync_token: data.nextSyncToken }).eq('id', agentId);
            }

            console.log(`Sync complete. Processed: ${processed}`);
            return new Response(JSON.stringify({ success: true, count: processed }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        // --- PUSH LOCAL TASK TO GOOGLE ---
        if (action === 'push_to_google') {
            const { taskId, create_meet } = body;
            const { data: task, error: taskErr } = await adminClient.from('crm_tasks').select('*').eq('id', taskId).single();

            if (taskErr || !task) throw new Error('Task not found');
            if (task.agent_id !== agentId) throw new Error('Unauthorized');

            const googleEvent: any = {
                summary: task.action,
                description: task.description_html || task.description,
                location: task.location || '',
                start: { dateTime: new Date(task.execution_date).toISOString() },
                end: { dateTime: new Date(task.end_date || (new Date(task.execution_date).getTime() + 3600000)).toISOString() },
                attendees: task.attendees || [],
            };

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

            if (task.google_event_id) {
                method = 'PUT';
                // If it's a PUT, we need specific ID in URL. If we appended params earlier, we must be careful.
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
