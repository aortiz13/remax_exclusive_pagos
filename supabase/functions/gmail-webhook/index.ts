import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
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

            const response = await fetch(url.toString(), {
                headers: { Authorization: `Bearer ${account.access_token}` },
            });

            if (!response.ok) {
                const errText = await response.text();
                if (response.status === 401) {
                    // TODO: In a production App, we'd use refresh_token here to get a new access_token automatically
                    console.error(`Access token expired for ${emailAddress}`);
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
    const response = await fetch(url, { headers: { Authorization: `Bearer ${account.access_token}` } });

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
            .eq('email', targetEmailToMatch)
            .limit(1);

        if (contacts && contacts.length > 0) {
            contactId = contacts[0].id;
        }
    }

    // Upsert Thread
    const threadId = messageData.threadId;
    await supabase.from('email_threads').upsert({
        gmail_thread_id: threadId,
        agent_id: account.agent_id,
        subject: subject || '(Sin Asunto)',
        contact_id: contactId
    }, { onConflict: 'gmail_thread_id' }).select('id').single();

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
        received_at: new Date(parseInt(messageData.internalDate)).toISOString(),
    }, { onConflict: 'gmail_message_id' });

    // Note: Attachments extraction can be done similarly if required by the payload, omitted here for brevity
}

function extractEmail(headerValue: string): string | null {
    if (!headerValue) return null;
    const match = headerValue.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/);
    return match ? match[1] : headerValue;
}

async function extractBody(payload: any): Promise<{ html: string | null, plain: string | null }> {
    let html = null;
    let plain = null;

    if (payload.mimeType === 'text/html') {
        html = atob(payload.body.data.replace(/-/g, '+').replace(/_/g, '/'));
    } else if (payload.mimeType === 'text/plain') {
        plain = atob(payload.body.data.replace(/-/g, '+').replace(/_/g, '/'));
    } else if (payload.parts) {
        for (const part of payload.parts) {
            const result = await extractBody(part);
            if (result.html) html = result.html;
            if (result.plain) plain = result.plain;
        }
    }

    return { html, plain };
}
