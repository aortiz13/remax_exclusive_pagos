
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { generateEmailHtml } from "./_templates/import-summary.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        if (!RESEND_API_KEY) {
            console.error("Missing RESEND_API_KEY");
            throw new Error("Server misconfiguration: Missing Email API Key");
        }

        const { recipientEmail, recipientName, count, type } = await req.json();

        if (!recipientEmail || !count) {
            throw new Error("Missing required fields: recipientEmail or count");
        }

        console.log(`Sending email to ${recipientEmail} for ${count} properties`);

        let htmlContent = "";
        let subject = "";

        if (type === 'import_summary') {
            subject = `✅ Importación Exitosa: ${count} Nuevas Propiedades`;
            htmlContent = generateEmailHtml(recipientName || 'Agente', count);
        } else {
            throw new Error("Invalid notification type");
        }

        const res = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${RESEND_API_KEY}`,
            },
            body: JSON.stringify({
                from: "RE/MAX Gestión <onboarding@resend.dev>", // TODO: Update with user's verified domain
                to: [recipientEmail],
                subject: subject,
                html: htmlContent,
            }),
        });

        const data = await res.json();

        if (!res.ok) {
            console.error("Resend API Error:", data);
            throw new Error(data.message || "Failed to send email");
        }

        return new Response(JSON.stringify({ success: true, id: data.id }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });

    } catch (error) {
        console.error("Error sending notification:", error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
});
