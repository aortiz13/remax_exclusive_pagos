import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { decode } from "https://deno.land/std@0.168.0/encoding/base64.ts";
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
        const currentHistoryId = watchData.historyId;

        // 5. Upsert to database
        const { data: updatedAccount, error: dbError } = await supabase
            .from('gmail_accounts')
            .upsert({
                agent_id: user.id,
                email_address: userInfo.email,
                access_token: tokens.access_token,
                refresh_token: tokens.refresh_token || undefined,
                last_history_id: currentHistoryId,
                updated_at: new Date().toISOString()
            }, { onConflict: 'email_address' })
            .select('*')
            .single();

        if (dbError) {
            throw new Error(`Database error: ${dbError.message}`);
        }

        // 6. INITIAL SYNC: Fetch last 20 threads to warm up the inbox
        const initialSync = async () => {
            try {
                const listUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=20&q=in:anywhere`;
                const listResponse = await fetch(listUrl, {
                    headers: { Authorization: `Bearer ${tokens.access_token}` },
                });

                if (listResponse.ok) {
                    const listData = await listResponse.json();
                    if (listData.messages) {
                        console.log(`Initial sync: processing ${listData.messages.length} messages`);
                        for (const msg of listData.messages) {
                            await processAndSaveMessage(userInfo.email, msg.id, updatedAccount, supabase);
                        }
                    }
                }
            } catch (syncErr) {
                console.error('Initial sync warning:', syncErr);
                // We don't throw here to not break the whole callback if just the initial sync fails
            }
        };

        // Run sync in background (or wait for it if we want immediate results)
        await initialSync();

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

/** HELPERS (Duplicated from webhook for portability) **/

async function processAndSaveMessage(emailAddress: string, messageId: string, account: any, supabase: any) {
    const url = `https://gmail.googleapis.com/gmail/v1/users/${emailAddress}/messages/${messageId}?format=full`;
    const response = await fetch(url, { headers: { Authorization: `Bearer ${account.access_token}` } });

    if (!response.ok) return;

    const messageData = await response.json();
    const headers = messageData.payload.headers;
    const getHeader = (name: string) => headers.find((h: any) => h.name.toLowerCase() === name.toLowerCase())?.value || '';

    const fromHeader = getHeader('From');
    const toHeader = getHeader('To');
    const subject = getHeader('Subject');
    const rfcMessageId = getHeader('Message-ID');
    const fromAddress = extractEmail(fromHeader);
    const toAddress = extractEmail(toHeader);

    let contactId = null;
    const targetEmailToMatch = fromAddress === emailAddress ? toAddress : fromAddress;

    if (targetEmailToMatch) {
        const { data: contacts } = await supabase
            .from('contacts')
            .select('id')
            .ilike('email', targetEmailToMatch)
            .limit(1);

        if (contacts && contacts.length > 0) {
            contactId = contacts[0].id;
        }
    }

    const threadUpsertData: any = {
        gmail_thread_id: messageData.threadId,
        agent_id: account.agent_id,
        subject: subject || '(Sin Asunto)',
        labels: messageData.labelIds || []
    };
    if (contactId) {
        threadUpsertData.contact_id = contactId;
    }

    const { data: threadRecord } = await supabase.from('email_threads').upsert(
        threadUpsertData,
        { onConflict: 'gmail_thread_id' }
    ).select('id').single();

    if (!threadRecord) return;

    // Insert Message
    const body = await extractBody(messageData.payload);

    await supabase.from('email_messages').upsert({
        gmail_message_id: messageData.id,
        thread_id: threadRecord.id,
        agent_id: account.agent_id,
        from_address: fromAddress,
        to_address: toAddress,
        cc_address: extractEmail(getHeader('Cc')),
        subject: subject,
        snippet: messageData.snippet,
        body_html: body.html,
        body_plain: body.plain,
        rfc_message_id: rfcMessageId,
        received_at: new Date(parseInt(messageData.internalDate)).toISOString(),
    }, { onConflict: 'gmail_message_id' });

    // Extract & Save Attachments
    const { data: messageRecord } = await supabase.from('email_messages')
        .select('id')
        .eq('gmail_message_id', messageData.id)
        .single();

    if (messageRecord) {
        const attachments = extractAttachmentIds(messageData.payload);
        console.log(`Extracted ${attachments.length} attachments for message ${messageData.id}`);
        for (const attachment of attachments) {
            // Check if attachment already exists in DB
            const { data: existingAtt } = await supabase.from('email_attachments')
                .select('id')
                .eq('message_id', messageRecord.id)
                .eq('filename', attachment.filename)
                .single();

            if (existingAtt) {
                console.log(`Attachment ${attachment.filename} already exists`);
                continue;
            }

            let base64Data = '';

            // If Gmail gave us the data inline (small files), use it directly
            if (attachment.dataPayload) {
                base64Data = attachment.dataPayload.replace(/-/g, '+').replace(/_/g, '/');
            } else if (attachment.attachmentId) {
                // Otherwise fetch it using the attachmentId
                const attachmentUrl = `https://gmail.googleapis.com/gmail/v1/users/${emailAddress}/messages/${messageId}/attachments/${attachment.attachmentId}`;
                const attResponse = await fetch(attachmentUrl, { headers: { Authorization: `Bearer ${account.access_token}` } });

                if (attResponse.ok) {
                    const attData = await attResponse.json();
                    if (attData.data) {
                        base64Data = attData.data.replace(/-/g, '+').replace(/_/g, '/');
                    }
                } else {
                    console.error(`Failed to fetch attachment ${attachment.attachmentId} from Google: ${attResponse.statusText}`);
                }
            }

            if (base64Data) {
                try {
                    const buffer = decode(base64Data);

                    // upload to supabase storage
                    const filePath = `${threadRecord.id}/${messageRecord.id}/${attachment.filename}`;
                    const { data: uploadData, error: uploadError } = await supabase.storage.from('email_attachments').upload(filePath, buffer, {
                        contentType: attachment.mimeType,
                        upsert: true
                    });

                    if (!uploadError) {
                        const { data: publicUrlData } = supabase.storage.from('email_attachments').getPublicUrl(filePath);

                        await supabase.from('email_attachments').insert({
                            message_id: messageRecord.id,
                            filename: attachment.filename,
                            file_size: attachment.size || buffer.length,
                            mime_type: attachment.mimeType,
                            storage_url: publicUrlData.publicUrl
                        });
                        console.log(`Successfully stored ${attachment.filename}`);
                    } else {
                        console.error('Failed to upload attachment:', uploadError);
                    }
                } catch (e) {
                    console.error('Error processing base64 for attachment:', e);
                }
            } else {
                console.error(`No data extracted for attachment ${attachment.filename}`);
            }
        }
    }
}

function extractAttachmentIds(payload: any): any[] {
    let attachments: any[] = [];
    if (payload.parts) {
        for (const part of payload.parts) {
            if (part.filename && part.filename.length > 0) {
                if (part.body && part.body.attachmentId) {
                    attachments.push({
                        filename: part.filename,
                        mimeType: part.mimeType,
                        attachmentId: part.body.attachmentId,
                        size: part.body.size
                    });
                } else if (part.body && part.body.data) {
                    attachments.push({
                        filename: part.filename,
                        mimeType: part.mimeType,
                        dataPayload: part.body.data,
                        size: part.body.size
                    });
                }
            } else if (part.parts) {
                attachments = attachments.concat(extractAttachmentIds(part));
            }
        }
    }
    return attachments;
}

function extractEmail(headerValue: string): string | null {
    if (!headerValue) return null;
    const match = headerValue.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/);
    return match ? match[1].toLowerCase().trim() : headerValue.toLowerCase().trim();
}

// Decodes a Gmail base64url string to a proper UTF-8 string.
// atob() returns Latin-1 bytes which corrupts multi-byte UTF-8 chars (e.g. ó becomes � or Ã³).
function decodeBase64ToUtf8(base64url: string): string {
    const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
    const binaryStr = atob(base64);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
    }
    return new TextDecoder('utf-8').decode(bytes);
}

async function extractBody(payload: any): Promise<{ html: string | null, plain: string | null }> {
    let html = null;
    let plain = null;

    if (payload.mimeType === 'text/html' && payload.body?.data) {
        html = decodeBase64ToUtf8(payload.body.data);
    } else if (payload.mimeType === 'text/plain' && payload.body?.data) {
        plain = decodeBase64ToUtf8(payload.body.data);
    } else if (payload.parts) {
        for (const part of payload.parts) {
            const result = await extractBody(part);
            if (result.html) html = result.html;
            if (result.plain) plain = result.plain;
        }
    }

    return { html, plain };
}
