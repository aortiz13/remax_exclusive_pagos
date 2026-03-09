import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.1';

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

serve(async (_req) => {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    try {
        // 1. Fetch all agents with Google Calendar connected
        const { data: agents, error } = await supabase
            .from('profiles')
            .select('id')
            .not('google_refresh_token', 'is', null);

        if (error) {
            console.error('Error fetching agents:', error);
            return new Response(JSON.stringify({ error: error.message }), { status: 500 });
        }

        if (!agents || agents.length === 0) {
            console.log('No agents with Google Calendar connected.');
            return new Response(JSON.stringify({ message: 'No agents to sync', count: 0 }), { status: 200 });
        }

        console.log(`Starting calendar sync for ${agents.length} agents...`);

        const results: { agentId: string; success: boolean; count?: number; error?: string }[] = [];

        // 2. Sync each agent sequentially to avoid Google API rate limits
        for (const agent of agents) {
            try {
                const response = await fetch(`${supabaseUrl}/functions/v1/google-calendar-sync`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${supabaseServiceKey}`,
                    },
                    body: JSON.stringify({
                        agentId: agent.id,
                        action: 'sync_from_google',
                    }),
                });

                if (response.ok) {
                    const data = await response.json();

                    // Handle retry case (sync token expired)
                    if (data.retry) {
                        const retryResponse = await fetch(`${supabaseUrl}/functions/v1/google-calendar-sync`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${supabaseServiceKey}`,
                            },
                            body: JSON.stringify({
                                agentId: agent.id,
                                action: 'sync_from_google',
                            }),
                        });
                        const retryData = await retryResponse.json();
                        const count = (retryData?.results?.events || 0) + (retryData?.results?.tasks || 0);
                        results.push({ agentId: agent.id, success: retryResponse.ok, count });
                    } else {
                        const count = (data?.results?.events || 0) + (data?.results?.tasks || 0);
                        results.push({ agentId: agent.id, success: true, count });
                    }
                } else {
                    const errText = await response.text();
                    console.error(`Sync failed for agent ${agent.id}: ${response.status} ${errText}`);
                    results.push({ agentId: agent.id, success: false, error: errText });
                }
            } catch (agentError: any) {
                console.error(`Error syncing agent ${agent.id}:`, agentError);
                results.push({ agentId: agent.id, success: false, error: agentError.message });
            }
        }

        const successCount = results.filter(r => r.success).length;
        const totalEvents = results.reduce((sum, r) => sum + (r.count || 0), 0);

        console.log(`Calendar cron complete: ${successCount}/${agents.length} agents synced, ${totalEvents} total events.`);

        return new Response(JSON.stringify({
            message: 'Calendar cron sync complete',
            agents: agents.length,
            synced: successCount,
            totalEvents,
            details: results,
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });

    } catch (error: any) {
        console.error('Calendar cron error:', error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
});
