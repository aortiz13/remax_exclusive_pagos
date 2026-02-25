import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { decode } from "https://deno.land/std@0.168.0/encoding/base64.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.1';

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

serve(async (req) => {
    // 1. Validate Pub/Sub request
    if (req.method !== 'POST') {
        return new Response('Method Not Allowed', { status: 405 });
    }

    try {
        const payload = await req.json();

        // Pub/Sub data is base64 encoded
        if (!payload.message || !payload.message.data) {
            return new Response('Bad Request: Missing data', { status: 400 });
        }

        const dataStr = atob(payload.message.data);
        const notification = JSON.parse(dataStr);

        const emailAddress = notification.emailAddress;
        const newHistoryId = notification.historyId;

        if (!emailAddress || !newHistoryId) {
            return new Response('Bad Request: Invalid notification format', { status: 400 });
        }

        // 2. Fetch user's Gmail account and last_history_id
        const { data: account, error: accountError } = await supabase
            .from('gmail_accounts')
            .select('*')
            .eq('email_address', emailAddress)
            .single();

        if (accountError || !account) {
            console.error(`Account not found for ${emailAddress}`);
            return new Response('Account not found', { status: 404 });
        }

        const startHistoryId = account.last_history_id;

        if (!startHistoryId) {
            // Edge case: No startHistoryId. Because of our connection logic, this shouldn't happen.
            console.log(`No startHistoryId for ${emailAddress}, skipping sync.`);
            return new Response('OK', { status: 200 }); // Acknowledge to Pub/Sub
        }

        // Check if we already processed this or newer
        if (BigInt(newHistoryId) <= BigInt(startHistoryId)) {
            return new Response('OK', { status: 200 });
        }

        // 3. Fetch History from Gmail API
        let pageToken = undefined;
        let historyRecords: any[] = [];

        do {
            const url = new URL(`https://gmail.googleapis.com/gmail/v1/users/${emailAddress}/history`);
            url.searchParams.set('startHistoryId', startHistoryId);
            url.searchParams.set('historyTypes', 'messageAdded'); // We are mostly interested in new messages
            if (pageToken) url.searchParams.set('pageToken', pageToken);

            const response = await fetchWithRetry(url.toString(), {
                headers: { Authorization: `Bearer ${account.access_token}` },
            }, account, emailAddress);

            if (!response.ok) {
                const errText = await response.text();
                if (response.status === 401) {
                    console.error(`Access token completely expired (refresh failed) for ${emailAddress}`);
                    return new Response('Unauthorized - Token Expired', { status: 401 });
                }
                if (response.status === 404) {
                    // The historyId is too old (Gmail purges history records after ~7 days or sooner).
                    // However, we agreed to NOT do full syncs to save quota. If this happens, we must 
                    // just update the last_history_id to what was reported to skip the gap and keep sync going forward.
                    console.warn(`History ID completely out of date for ${emailAddress}. Fast-forwarding.`);
                    await updateHistoryId(emailAddress, newHistoryId);
                    return new Response('OK - Fast forwarded', { status: 200 });
                }
                throw new Error(`Gmail API error: ${response.status} ${errText}`);
            }

            const historyData = await response.json();
            if (historyData.history) {
                historyRecords = historyRecords.concat(historyData.history);
            }
            pageToken = historyData.nextPageToken;
        } while (pageToken);

        // 4. Process new messages
        const messagesToFetch = new Set<string>();
        historyRecords.forEach(record => {
            if (record.messagesAdded) {
                record.messagesAdded.forEach((msg: any) => messagesToFetch.add(msg.message.id));
            }
        });

        console.log(`Found ${messagesToFetch.size} new messages for ${emailAddress}`);

        for (const messageId of messagesToFetch) {
            await processAndSaveMessage(emailAddress, messageId, account);
        }

        // 5. Update last_history_id
        await updateHistoryId(emailAddress, newHistoryId);

        return new Response('OK', { status: 200 });

    } catch (error: any) {
        console.error('Webhook processing error:', error);
        return new Response(`Internal Server Error: ${error.message}`, { status: 500 });
    }
});

async function updateHistoryId(emailAddress: string, historyId: string) {
    await supabase.from('gmail_accounts').update({ last_history_id: historyId }).eq('email_address', emailAddress);
}

async function processAndSaveMessage(emailAddress: string, messageId: string, account: any) {
    const url = `https://gmail.googleapis.com/gmail/v1/users/${emailAddress}/messages/${messageId}?format=full`;
    const response = await fetchWithRetry(url, { headers: { Authorization: `Bearer ${account.access_token}` } }, account, emailAddress);

    if (!response.ok) {
        console.warn(`Failed to fetch message details for ${messageId}`);
        return; // Move to next
    }

    const messageData = await response.json();

    // Parse Headers
    const headers = messageData.payload.headers;
    const getHeader = (name: string) => headers.find((h: any) => h.name.toLowerCase() === name.toLowerCase())?.value || '';

    const fromHeader = getHeader('From');
    const toHeader = getHeader('To');
    const subject = getHeader('Subject');
    const rfcMessageId = getHeader('Message-ID');

    // Extract email addresses from "Name <email@domain.com>"
    const fromAddress = extractEmail(fromHeader);
    const toAddress = extractEmail(toHeader);

    // Look up CRM Contact
    let contactId = null;
    const targetEmailToMatch = fromAddress === emailAddress ? toAddress : fromAddress; // If I sent it, match the recipient. If I received it, match the sender.

    if (targetEmailToMatch) {
        // Attempt to find a contact with this email
        const { data: contacts } = await supabase
            .from('contacts')
            .select('id')
            .ilike('email', targetEmailToMatch)
            .limit(1);

        if (contacts && contacts.length > 0) {
            contactId = contacts[0].id;
        }
    }

    // Upsert Thread — merge labels instead of overwriting to preserve SENT when a reply arrives
    const threadId = messageData.threadId;
    const incomingLabels: string[] = messageData.labelIds || [];

    // Fetch existing thread to merge labels
    const { data: existingThread } = await supabase
        .from('email_threads')
        .select('id, labels')
        .eq('gmail_thread_id', threadId)
        .single();

    const mergedLabels = existingThread
        ? Array.from(new Set([...(existingThread.labels || []), ...incomingLabels]))
        : incomingLabels;

    const threadUpsertData: any = {
        gmail_thread_id: threadId,
        agent_id: account.agent_id,
        subject: subject || '(Sin Asunto)',
        labels: mergedLabels,
        updated_at: new Date().toISOString(),
    };
    if (contactId) {
        threadUpsertData.contact_id = contactId;
    }

    await supabase.from('email_threads').upsert(threadUpsertData, { onConflict: 'gmail_thread_id' }).select('id').single();

    // We need to fetch the local internal UUID of the thread
    const { data: threadRecord } = await supabase.from('email_threads').select('id').eq('gmail_thread_id', threadId).single();

    if (!threadRecord) return; // Should not happen after upsert

    // Process Body
    const body = await extractBody(messageData.payload);

    // Insert Message
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
                const attResponse = await fetchWithRetry(attachmentUrl, { headers: { Authorization: `Bearer ${account.access_token}` } }, account, emailAddress);

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
                    console.log(`Starting to decode base64 for ${attachment.filename}, length: ${base64Data.length}`);
                    const buffer = decode(base64Data);
                    console.log(`Decoded into byte array of length: ${buffer.length}`);

                    // upload to supabase storage
                    // Sanitize filename for storage key: remove/replace special chars
                    const safeFilename = attachment.filename
                        .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // remove accents
                        .replace(/[^a-zA-Z0-9._\-]/g, '_');              // replace unsafe chars with _
                    const filePath = `${threadRecord.id}/${messageRecord.id}/${safeFilename}`;
                    console.log(`Uploading to path: ${filePath}`);
                    const { data: uploadData, error: uploadError } = await supabase.storage.from('email_attachments').upload(filePath, buffer, {
                        contentType: attachment.mimeType,
                        upsert: true
                    });

                    if (!uploadError) {
                        const { data: publicUrlData } = supabase.storage.from('email_attachments').getPublicUrl(filePath);
                        console.log(`Uploaded OK. Public URL: ${publicUrlData.publicUrl}`);

                        const { error: dbInsertError } = await supabase.from('email_attachments').insert({
                            message_id: messageRecord.id,
                            filename: attachment.filename,
                            file_size: attachment.size || buffer.length,
                            mime_type: attachment.mimeType,
                            storage_url: publicUrlData.publicUrl
                        });

                        if (dbInsertError) {
                            console.error(`DB Insert failed for attachment ${attachment.filename}:`, dbInsertError);
                        } else {
                            console.log(`Successfully stored ${attachment.filename}`);
                        }
                    } else {
                        console.error(`Failed to upload attachment ${attachment.filename} to storage:`, uploadError);
                    }
                } catch (e) {
                    console.error(`Error processing base64 for attachment ${attachment.filename}:`, e);
                }
            } else {
                console.error(`No base64 data extracted for attachment ${attachment.filename}`);
            }
        }
    }
}

function extractAttachmentIds(payload: any): any[] {
    let attachments: any[] = [];
    if (!payload.parts) return attachments;

    for (const part of payload.parts) {
        // Always recurse into nested multipart containers first
        if (part.parts) {
            attachments = attachments.concat(extractAttachmentIds(part));
        }

        // Then check if this part itself is an attachment
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
// atob() returns Latin-1 bytes which corrupts multi-byte UTF-8 chars (e.g. ó becomes Ã³).
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


async function fetchWithRetry(url: string, options: any, account: any, emailAddress: string) {
    let response = await fetch(url, options);

    if (response.status === 401 && account.refresh_token) {
        console.log(`Access token expired for ${emailAddress}, refreshing...`);
        const newAccessToken = await refreshAccessToken(account, emailAddress);

        options.headers = {
            ...options.headers,
            Authorization: `Bearer ${newAccessToken}`
        };

        response = await fetch(url, options);
    }

    return response;
}

async function refreshAccessToken(account: any, emailAddress: string) {
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

    account.access_token = tokens.access_token;

    await supabase
        .from('gmail_accounts')
        .update({ access_token: tokens.access_token, updated_at: new Date().toISOString() })
        .eq('email_address', emailAddress);

    return tokens.access_token;
}
