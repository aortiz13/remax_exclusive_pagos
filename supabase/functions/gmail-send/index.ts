import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { to, subject, bodyHtml, replyToMessageId, threadId, attachments } = await req.json();

    if (!to || !subject || !bodyHtml) {
      throw new Error('Faltan parámetros obligatorios (to, subject o bodyHtml).');
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) throw new Error('Usuario no autenticado');

    // Mismo cliente pero con service_role_key para bypass RLS de tabla gmail_accounts
    const supabaseService = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const { data: account, error: accountError } = await supabaseService
      .from('gmail_accounts')
      .select('*')
      .eq('agent_id', user.id)
      .single();

    if (accountError || !account || !account.access_token) {
      throw new Error('No se encontró una cuenta de Gmail conectada o el token es inválido.');
    }

    // Prepare MIME message
    const boundary = 'foo_bar_baz_' + Math.random().toString(36).substring(2);
    let messageStr = '';

    // Headers
    messageStr += `To: ${to}\r\n`;
    messageStr += `Subject: =?utf-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=\r\n`; // Subject encoded
    if (replyToMessageId) {
      messageStr += `In-Reply-To: ${replyToMessageId}\r\n`;
      messageStr += `References: ${replyToMessageId}\r\n`;
    }

    // Check if we have attachments to use multipart/mixed
    if (attachments && attachments.length > 0) {
      messageStr += `Content-Type: multipart/mixed; boundary="${boundary}"\r\n\r\n`;
      messageStr += `--${boundary}\r\n`;
    }

    // Body (HTML)
    messageStr += `Content-Type: text/html; charset="UTF-8"\r\n\r\n`;
    messageStr += `${bodyHtml}\r\n\r\n`;

    // Attachments
    if (attachments && attachments.length > 0) {
      for (const attachment of attachments) {
        messageStr += `--${boundary}\r\n`;
        messageStr += `Content-Type: ${attachment.mimeType}\r\n`;
        messageStr += `Content-Transfer-Encoding: base64\r\n`;
        messageStr += `Content-Disposition: attachment; filename="${attachment.filename}"\r\n\r\n`;

        // Add base64 data, ensuring lines are max 76 chars
        const encoded = Math.ceil(attachment.data.length / 76);
        for (let i = 0; i < encoded; i++) {
          messageStr += attachment.data.substring(i * 76, (i + 1) * 76) + '\r\n';
        }
      }
      messageStr += `--${boundary}--\r\n`;
    }

    // Final encoding for Gmail API
    const encodedMessage = btoa(unescape(encodeURIComponent(messageStr)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    const url = 'https://gmail.googleapis.com/upload/gmail/v1/users/me/messages/send';
    const requestBody: any = {
      raw: encodedMessage,
    };

    // Only append threadId if defined, required by Gmail API to group threads
    if (threadId) {
      requestBody.threadId = threadId;
    }

    const response = await fetch(url + '?uploadType=multipart', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${account.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      // Token might be expired, a real prod app would refresh the token here
      // using the refresh_token and then retry.
      const errText = await response.text();
      console.error('Gmail API error:', errText);
      throw new Error(`Gmail API Error: ${response.status}`);
    }

    const result = await response.json();

    return new Response(JSON.stringify({ success: true, result }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in gmail-send:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
