
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.1';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID');
const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET');
const GOOGLE_REDIRECT_URI = Deno.env.get('GOOGLE_REDIRECT_URI');

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    const url = new URL(req.url);
    const body = await req.json().catch(() => ({}));
    const action = body.action || url.pathname.split('/').pop();

    // Initialize Supabase Client
    const authHeader = req.headers.get('Authorization')!;
    const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
        { global: { headers: { Authorization: authHeader } } }
    );

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

    // --- AUTHORIZE ROUTE ---
    if (action === 'authorize') {
        const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
        authUrl.searchParams.set('client_id', GOOGLE_CLIENT_ID!);
        authUrl.searchParams.set('redirect_uri', GOOGLE_REDIRECT_URI!);
        authUrl.searchParams.set('response_type', 'code');
        authUrl.searchParams.set('scope', 'https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/tasks');
        authUrl.searchParams.set('access_type', 'offline');
        authUrl.searchParams.set('prompt', 'consent');
        // Add state if needed for CSRF protection, but usually redirecting is enough for simple internal flow

        return new Response(JSON.stringify({ url: authUrl.toString() }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

    // --- CALLBACK ROUTE ---
    if (action === 'callback') {
        const code = body.code || url.searchParams.get('code');
        if (!code) {
            return new Response(JSON.stringify({ error: 'Missing code' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        // Exchange code for tokens
        const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                client_id: GOOGLE_CLIENT_ID!,
                client_secret: GOOGLE_CLIENT_SECRET!,
                code,
                grant_type: 'authorization_code',
                redirect_uri: GOOGLE_REDIRECT_URI!,
            }),
        });

        const tokens = await tokenResponse.json();

        if (tokens.error) {
            console.error('Google Token Exchange Error:', tokens);
            return new Response(JSON.stringify({ error: tokens.error_description || tokens.error }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        // Save refresh_token to profile
        // We use service role to update the profile of the current user
        if (tokens.refresh_token) {
            const { error: updateError } = await supabase
                .from('profiles')
                .update({ google_refresh_token: tokens.refresh_token })
                .eq('id', user.id);

            if (updateError) {
                console.error('Profile Update Error:', updateError);
                return new Response(JSON.stringify({ error: 'Failed to update profile' }), {
                    status: 500,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                });
            }
        }

        return new Response(JSON.stringify({ success: true }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

    return new Response(JSON.stringify({ error: 'Not Found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
});
