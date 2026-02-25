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
    const { to, subject, bodyHtml, replyToMessageId, threadId, attachments, linkedTaskId, linkedActionId } = await req.json();

    if (!to || !subject || !bodyHtml) {
      throw new Error('Faltan parámetros obligatorios (to, subject o bodyHtml).');
    }

    const authHeader = req.headers.get('Authorization');
    console.log('Auth header present:', !!authHeader);
    if (!authHeader) {
      throw new Error('No authorization header');
    }
    const token = authHeader.replace(/^Bearer\s+/i, '');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      console.error('Auth error detailed:', userError);
      throw new Error('Usuario no autenticado');
    }

    // Mismo cliente pero con service_role_key para bypass RLS de tabla gmail_accounts
    const supabaseService = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const { data: account, error: accountError } = await supabaseService
      .from('gmail_accounts')
      .select('*')
      .eq('agent_id', user.id)
      .single();

    if (accountError || !account || !account.access_token) {
      console.error('Account lookup error:', accountError);
      throw new Error('No se encontró una cuenta de Gmail conectada o el token es inválido.');
    }

    // Prepare MIME message
    const boundary = 'foo_bar_baz_' + Math.random().toString(36).substring(2);
    let messageStr = '';

    // Headers
    messageStr += `To: ${to}\r\n`;
    // Encode subject with TextEncoder for reliable UTF-8 support
    const subjectBytes = new TextEncoder().encode(subject);
    let subjectBinary = '';
    for (let i = 0; i < subjectBytes.length; i++) {
      subjectBinary += String.fromCharCode(subjectBytes[i]);
    }
    messageStr += `Subject: =?utf-8?B?${btoa(subjectBinary)}?=\r\n`;
    messageStr += `MIME-Version: 1.0\r\n`;
    if (replyToMessageId) {
      const cleanRef = replyToMessageId.replace(/[<>]/g, '');
      messageStr += `In-Reply-To: <${cleanRef}>\r\n`;
      messageStr += `References: <${cleanRef}>\r\n`;
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
        messageStr += `Content-Type: ${attachment.mimeType}; name="${attachment.filename}"\r\n`;
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

    // Final encoding for Gmail API — use TextEncoder for reliable Unicode + binary support
    const msgBytes = new TextEncoder().encode(messageStr);
    let binaryStr = '';
    for (let i = 0; i < msgBytes.length; i += 8192) {
      binaryStr += String.fromCharCode(...msgBytes.subarray(i, i + 8192));
    }
    const encodedMessage = btoa(binaryStr)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    const url = 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send';
    const requestBody: any = {
      raw: encodedMessage,
    };

    // Only append threadId if defined, required by Gmail API to group threads
    if (threadId) {
      requestBody.threadId = threadId;
    }

    let accessToken = account.access_token;

    let response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (response.status === 401 && account.refresh_token) {
      console.log('Access token expired, refreshing...');
      accessToken = await refreshAccessToken(account, supabaseService);

      response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });
    }

    if (!response.ok) {
      const errText = await response.text();
      console.error('Gmail API error:', errText);
      throw new Error(`Gmail API Error: ${response.status} - ${errText}`);
    }

    const result = await response.json();
    console.log('Email sent successfully. Message ID:', result.id, 'Thread ID:', result.threadId);

    // ==============================================================
    // Save the sent message to the local DB immediately after send
    // ==============================================================
    try {
      await saveSentMessageToDb({
        supabaseService,
        account,
        accessToken,
        sentMessageId: result.id,
        sentThreadId: result.threadId,
        toAddress: to,
        subject,
        bodyHtml,
        attachments: attachments || [],
        linkedTaskId: linkedTaskId || null,
        linkedActionId: linkedActionId || null,
      });
    } catch (saveError: any) {
      // Don't fail the whole request if saving to DB fails - the email was sent.
      console.error('Warning: Failed to save sent message to DB:', saveError.message);
    }

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

// ---------------------------------------------------------------
// Helper: Save a sent message to Supabase DB
// ---------------------------------------------------------------
async function saveSentMessageToDb({
  supabaseService,
  account,
  accessToken,
  sentMessageId,
  sentThreadId,
  toAddress,
  subject,
  bodyHtml,
  attachments,
  linkedTaskId,
  linkedActionId,
}: {
  supabaseService: any;
  account: any;
  accessToken: string;
  sentMessageId: string;
  sentThreadId: string;
  toAddress: string;
  subject: string;
  bodyHtml: string;
  attachments: any[];
  linkedTaskId: string | null;
  linkedActionId: string | null;
}) {
  const agentId = account.agent_id;
  const fromAddress = account.email_address;

  // Try to find a contact to link based on 'to' address
  let contactId = null;
  if (toAddress) {
    const { data: contacts } = await supabaseService
      .from('contacts')
      .select('id')
      .ilike('email', toAddress)
      .limit(1);
    if (contacts && contacts.length > 0) {
      contactId = contacts[0].id;
    }
  }

  // Upsert the thread
  const threadUpsertData: any = {
    gmail_thread_id: sentThreadId,
    agent_id: agentId,
    subject: subject || '(Sin Asunto)',
    labels: ['SENT'],
    updated_at: new Date().toISOString(),
  };
  if (contactId) {
    threadUpsertData.contact_id = contactId;
  }

  // If thread already exists, only update labels if SENT isn't already there
  const { data: existingThread } = await supabaseService
    .from('email_threads')
    .select('id, labels')
    .eq('gmail_thread_id', sentThreadId)
    .single();

  if (existingThread) {
    // Merge labels: add SENT if not already there
    const mergedLabels = Array.from(new Set([...(existingThread.labels || []), 'SENT']));
    await supabaseService
      .from('email_threads')
      .update({ labels: mergedLabels, updated_at: new Date().toISOString() })
      .eq('gmail_thread_id', sentThreadId);
  } else {
    await supabaseService
      .from('email_threads')
      .upsert(threadUpsertData, { onConflict: 'gmail_thread_id' });
  }

  // Fetch the local thread id
  const { data: threadRecord } = await supabaseService
    .from('email_threads')
    .select('id')
    .eq('gmail_thread_id', sentThreadId)
    .single();

  if (!threadRecord) {
    console.error('Could not find/create thread record for sent message');
    return;
  }

  // Upsert the sent message
  const { error: msgError } = await supabaseService
    .from('email_messages')
    .upsert({
      gmail_message_id: sentMessageId,
      thread_id: threadRecord.id,
      agent_id: agentId,
      from_address: fromAddress,
      to_address: toAddress,
      subject: subject,
      body_html: bodyHtml,
      received_at: new Date().toISOString(),
      is_read: true, // Sent by us — always "read"
    }, { onConflict: 'gmail_message_id' });

  if (msgError) {
    console.error('Error upserting email_messages:', msgError);
    return;
  }

  // Fetch the local message id
  const { data: messageRecord } = await supabaseService
    .from('email_messages')
    .select('id')
    .eq('gmail_message_id', sentMessageId)
    .single();

  if (!messageRecord) {
    console.error('Could not find message record after upsert');
    return;
  }

  // Upload attachments to Supabase Storage and save to email_attachments table
  console.log(`Processing ${attachments?.length ?? 0} attachments for message ${sentMessageId}`);
  if (attachments && attachments.length > 0) {
    for (const attachment of attachments) {
      console.log(`Processing attachment: ${attachment.filename}, mimeType: ${attachment.mimeType}, data length: ${attachment.data?.length ?? 0}`);
      try {
        // Convert base64 to Uint8Array using atob (more reliable than decode() for any file type)
        const base64 = attachment.data.replace(/-/g, '+').replace(/_/g, '/');
        const binaryString = atob(base64);
        const buffer = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          buffer[i] = binaryString.charCodeAt(i);
        }
        console.log(`Decoded ${attachment.filename}: ${buffer.length} bytes`);

        // Sanitize filename for storage key: remove/replace special chars
        const safeFilename = attachment.filename
          .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // remove accents
          .replace(/[^a-zA-Z0-9._\-]/g, '_');              // replace unsafe chars with _
        const filePath = `${threadRecord.id}/${messageRecord.id}/${safeFilename}`;
        console.log(`Uploading to storage path: ${filePath}`);

        const { data: uploadData, error: uploadError } = await supabaseService.storage
          .from('email_attachments')
          .upload(filePath, buffer, {
            contentType: attachment.mimeType || 'application/octet-stream',
            upsert: true,
          });

        if (uploadError) {
          console.error(`Storage upload FAILED for ${attachment.filename}:`, JSON.stringify(uploadError));
          continue;
        }

        console.log(`Storage upload OK for ${attachment.filename}:`, JSON.stringify(uploadData));

        const { data: publicUrlData } = supabaseService.storage
          .from('email_attachments')
          .getPublicUrl(filePath);

        console.log(`Public URL: ${publicUrlData.publicUrl}`);

        const { error: attDbError } = await supabaseService
          .from('email_attachments')
          .insert({
            message_id: messageRecord.id,
            filename: attachment.filename,
            file_size: buffer.length,
            mime_type: attachment.mimeType || 'application/octet-stream',
            storage_url: publicUrlData.publicUrl,
          });

        if (attDbError) {
          console.error(`DB insert FAILED for ${attachment.filename}:`, JSON.stringify(attDbError));
        } else {
          console.log(`✓ Attachment ${attachment.filename} saved to storage and DB.`);
        }
      } catch (attError: any) {
        console.error(`EXCEPTION processing attachment ${attachment.filename}:`, attError.message, attError.stack);
      }
    }
  }

  console.log(`Sent message ${sentMessageId} saved to DB successfully.`);

  // Save link to task or action if provided
  if ((linkedTaskId || linkedActionId) && threadRecord?.id) {
    const { error: linkError } = await supabaseService
      .from('email_thread_links')
      .insert({
        thread_id: threadRecord.id,
        task_id: linkedTaskId || null,
        action_id: linkedActionId || null,
        agent_id: agentId,
      });
    if (linkError) {
      console.error('Failed to save email_thread_link:', JSON.stringify(linkError));
    } else {
      console.log(`✓ Email thread linked to ${linkedTaskId ? 'task' : 'action'} ${linkedTaskId || linkedActionId}`);
    }
  }
}

async function refreshAccessToken(account: any, supabase: any) {
  const clientId = Deno.env.get('GOOGLE_CLIENT_ID');
  const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET');

  if (!clientId || !clientSecret) {
    throw new Error('Missing Google OAuth credentials');
  }

  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: account.refresh_token,
      grant_type: 'refresh_token',
    }),
  });

  const tokens = await tokenResponse.json();
  if (tokens.error) {
    throw new Error(`Token refresh failed: ${tokens.error_description || tokens.error}`);
  }

  await supabase
    .from('gmail_accounts')
    .update({ access_token: tokens.access_token, updated_at: new Date().toISOString() })
    .eq('agent_id', account.agent_id);

  return tokens.access_token;
}
