
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

    const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    try {
        const { agentId, action } = await req.json();

        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('google_refresh_token, google_sync_token')
            .eq('id', agentId)
            .single();

        if (profileError || !profile?.google_refresh_token) {
            throw new Error('Google Calendar not linked');
        }

        const accessToken = await getAccessToken(profile.google_refresh_token);

        // --- SYNC FROM GOOGLE TO CRM ---
        if (action === 'sync_from_google') {
            let url = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';
            if (profile.google_sync_token) {
                url += `?syncToken=${profile.google_sync_token}`;
            }

            const response = await fetch(url, {
                headers: { Authorization: `Bearer ${accessToken}` },
            });

            if (response.status === 410) {
                // Sync token expired, clear and re-sync
                await supabase.from('profiles').update({ google_sync_token: null }).eq('id', agentId);
                return new Response(JSON.stringify({ retry: true }));
            }

            const data = await response.json();
            const events = data.items || [];

            for (const event of events) {
                const isDeleted = event.status === 'cancelled';

                if (isDeleted) {
                    await supabase.from('crm_tasks').delete().eq('google_event_id', event.id);
                } else {
                    const taskData = {
                        agent_id: agentId,
                        action: event.summary || '(Sin título)',
                        description: event.description || '',
                        execution_date: event.start?.dateTime || event.start?.date,
                        google_event_id: event.id,
                        google_etag: event.etag,
                        last_synced_at: new Date().toISOString(),
                    };

                    await supabase.from('crm_tasks').upsert(taskData, { onConflict: 'google_event_id' });
                }
            }

            if (data.nextSyncToken) {
                await supabase.from('profiles').update({ google_sync_token: data.nextSyncToken }).eq('id', agentId);
            }

            return new Response(JSON.stringify({ success: true, count: events.length }));
        }

        // --- PUSH LOCAL TASK TO GOOGLE ---
        if (action === 'push_to_google') {
            const { taskId } = await req.json();
            const { data: task } = await supabase.from('crm_tasks').select('*').eq('id', taskId).single();

            if (!task) throw new Error('Task not found');

            const googleEvent = {
                summary: task.action,
                description: task.description,
                start: { dateTime: task.execution_date },
                end: { dateTime: new Date(new Date(task.execution_date).getTime() + 3600000).toISOString() }, // Default 1h
            };

            let method = 'POST';
            let url = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';

            if (task.google_event_id) {
                method = 'PUT';
                url += `/${task.google_event_id}`;
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
                await supabase.from('crm_tasks').update({
                    google_event_id: result.id,
                    google_etag: result.etag,
                    last_synced_at: new Date().toISOString()
                }).eq('id', taskId);
            }

            return new Response(JSON.stringify({ success: response.ok, google_id: result.id }));
        }

    } catch (error) {
        console.error('Sync Error:', error);
        return new Response(JSON.stringify({ error: error.message }), { status: 400 });
    }
});
