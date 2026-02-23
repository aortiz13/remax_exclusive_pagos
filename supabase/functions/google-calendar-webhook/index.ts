
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.1';

serve(async (req) => {
    // Google sends notifications as POST
    const channelId = req.headers.get('x-goog-channel-id');
    const resourceId = req.headers.get('x-goog-resource-id');
    const resourceState = req.headers.get('x-goog-resource-state'); // 'sync', 'exists'

    console.log(`Webhook received for channel ${channelId}, resource ${resourceId}, state ${resourceState}`);

    if (resourceState === 'sync') {
        return new Response('Sync confirmation received', { status: 200 });
    }

    const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // We need to find the user associated with this channelId or resourceId.
    // For simplicity, let's assume we store the channelId in the profiles or a new 'google_channels' table.
    // For now, let's find the profile where google_sync_token is not null.
    // IMPORTANT: In production, you would map x-goog-channel-id to an agentId.

    const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .not('google_refresh_token', 'is', null)
        .single(); // This is a simplification. Ideally, map the channel.

    if (profile) {
        // Trigger sync_from_google for this agent
        await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/google-calendar-sync`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
            },
            body: JSON.stringify({ agentId: profile.id, action: 'sync_from_google' })
        });
    }

    return new Response('ok', { status: 200 });
});
