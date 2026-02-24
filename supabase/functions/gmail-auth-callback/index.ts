import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.1';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID');
const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET');
const GOOGLE_GMAIL_REDIRECT_URI = Deno.env.get('GOOGLE_GMAIL_REDIRECT_URI');
const GOOGLE_PUBSUB_TOPIC = Deno.env.get('GOOGLE_PUBSUB_TOPIC'); // e.g., projects/my-project/topics/gmail-notifications

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const body = await req.json().catch(() => ({}));
        const code = body.code || new URL(req.url).searchParams.get('code');

        if (!code) {
            return new Response(JSON.stringify({ error: 'Missing code' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        const authHeader = req.headers.get('Authorization');
        if (!authHeader) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
        }

        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
            { global: { headers: { Authorization: authHeader } } }
        );

        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError || !user) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
        }

        // 1. Exchange code for tokens
        const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                client_id: GOOGLE_CLIENT_ID!,
                client_secret: GOOGLE_CLIENT_SECRET!,
                code,
                grant_type: 'authorization_code',
                redirect_uri: GOOGLE_GMAIL_REDIRECT_URI!,
            }),
        });

        const tokens = await tokenResponse.json();
        if (tokens.error) {
            throw new Error(`Token exchange failed: ${tokens.error_description || tokens.error}`);
        }

        // 2. Get user email
        const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
            headers: { Authorization: `Bearer ${tokens.access_token}` },
        });
        const userInfo = await userInfoResponse.json();

        // 3. Domain validation (must be @remax-exclusive.cl)
        if (!userInfo.email || !userInfo.email.endsWith('@remax-exclusive.cl')) {
            throw new Error('Solo se permiten cuentas del dominio @remax-exclusive.cl');
        }

        // 4. Setup Gmail Watch (Pub/Sub) to get the CURRENT historyId
        const watchResponse = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/watch', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${tokens.access_token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                labelIds: ['INBOX', 'SENT'],
                labelFilterBehavior: 'INCLUDE',
                topicName: GOOGLE_PUBSUB_TOPIC
            })
        });

        if (!watchResponse.ok) {
            const watchError = await watchResponse.text();
            console.error('Failed to setup Gmail Watch:', watchError);
            throw new Error(`Google API Watch Error: ${watchError}`);
        }

        const watchData = await watchResponse.json();
        // ESTO ES CLAVE: historyId del momento exacto de la conexión
        const currentHistoryId = watchData.historyId;

        // 5. Upsert to database
        const { error: dbError } = await supabase
            .from('gmail_accounts')
            .upsert({
                agent_id: user.id,
                email_address: userInfo.email,
                access_token: tokens.access_token,
                refresh_token: tokens.refresh_token || undefined, // Don't nullify if undefined in subsequent logins
                last_history_id: currentHistoryId,
                updated_at: new Date().toISOString()
            }, { onConflict: 'email_address' });

        if (dbError) {
            throw new Error(`Database error: ${dbError.message}`);
        }

        return new Response(JSON.stringify({ success: true, email: userInfo.email }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

    } catch (e: any) {
        console.error('Callback Error:', e);
        return new Response(JSON.stringify({ error: e.message }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
});
