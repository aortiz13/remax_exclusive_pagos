import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID');
const GOOGLE_REDIRECT_URI = Deno.env.get('GOOGLE_REDIRECT_URI');

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
        authUrl.searchParams.set('client_id', GOOGLE_CLIENT_ID!);
        authUrl.searchParams.set('redirect_uri', GOOGLE_REDIRECT_URI!);
        authUrl.searchParams.set('response_type', 'code');
        // Scopes para Gmail: leer y enviar
        authUrl.searchParams.set('scope', 'https://mail.google.com/ https://www.googleapis.com/auth/userinfo.email');
        authUrl.searchParams.set('access_type', 'offline'); // For refresh token
        authUrl.searchParams.set('prompt', 'consent'); // Always get refresh token

        // Use state to specify this is for gmail
        authUrl.searchParams.set('state', 'source=gmail');

        return new Response(JSON.stringify({ url: authUrl.toString() }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    } catch (e: any) {
        return new Response(JSON.stringify({ error: e.message }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
});
