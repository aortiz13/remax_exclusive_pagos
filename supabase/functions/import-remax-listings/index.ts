
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { DOMParser } from "https://deno.land/x/deno_dom/deno-dom-wasm.ts";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const { agentId } = await req.json()

        if (!agentId) {
            throw new Error('Agent ID is required')
        }

        console.log(`Fetching listings for Agent ID: ${agentId}`);

        // Fetch the main listing page
        // Note: remax.cl might block requests without proper User-Agent
        const listUrl = `https://www.remax.cl/listings?ListingClass=-1&TransactionTypeUID=-1&AgentID=${agentId}`;
        const listResponse = await fetch(listUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            }
        });

        if (!listResponse.ok) {
            throw new Error(`Failed to fetch listing page: ${listResponse.status} ${listResponse.statusText}`);
        }

        const listHtml = await listResponse.text();
        const doc = new DOMParser().parseFromString(listHtml, "text/html");

        // Extract property links
        // The selector needs to be robust. Based on browser inspection, links are often in <a> tags with specific classes or structure.
        // We will look for links containing "propiedades" or "listings" and structure matches
        const propertyLinks = [];
        const linkElements = doc.querySelectorAll('a');

        for (const link of linkElements) {
            const href = link.getAttribute('href');
            // Filter for valid property detail links, avoiding duplicates and irrelevant links
            if (href && href.includes('/propiedades/') && href.includes(agentId)) {
                // Ensure absolute URL
                const fullUrl = href.startsWith('http') ? href : `https://www.remax.cl${href}`;
                if (!propertyLinks.includes(fullUrl)) {
                    propertyLinks.push(fullUrl);
                }
            }
        }

        console.log(`Found ${propertyLinks.length} property links`);

        // Fetch details for each property (limited to first 10 to avoid timeouts/bans)
        const properties = [];
        const limit = 10;
        const linksToProcess = propertyLinks.slice(0, limit);

        // Parallel fetching would be faster but might verify bot protection. Sequential for safety?
        // Let's try Promise.all with a small batch size or just all 5-10 since it's small.
        const detailPromises = linksToProcess.map(async (url) => {
            try {
                console.log(`Processing: ${url}`);
                const res = await fetch(url, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                    }
                });
                if (!res.ok) return null;

                const html = await res.text();
                const pDoc = new DOMParser().parseFromString(html, "text/html");

                // --- Extraction Logic ---

                // 1. Text Content Helper
                const getText = (selector) => {
                    const el = pDoc.querySelector(selector);
                    return el ? el.textContent.trim() : null;
                };

                // 2. Identify Metadata via __NEXT_DATA__ if available (best reliable source)
                // But Parsing HTML DOM is often more generic if class names are stable.
                // Based on browser findings, data is in text.

                // Title/Address
                // Usually h1 or similar
                const title = getText('h1') || getText('.listing-address') || 'Desconocido';

                // Description (Big text block)
                // Selector might vary, often a div with class 'listing-description' or 'description'
                // We search for a large block of text or specific container
                let description = getText('.listing-description') || '';
                if (!description) {
                    // Fallback: Find elements with long text
                    const divs = pDoc.querySelectorAll('div');
                    for (const div of divs) {
                        if (div.textContent.length > 200 && div.textContent.includes('RE/MAX')) {
                            // Likely candidate
                        }
                    }
                }

                // Characteristics Loop (Bedrooms, Bathrooms, M2)
                // We scan all elements for key phrases if specific classes fail
                let m2_total = 0;
                let m2_built = 0;
                let bedrooms = 0;
                let bathrooms = 0;
                let type = 'Departamento'; // default

                // Re-implementing the robust text scanner from browser agent
                const allText = pDoc.body.textContent;

                // Keywords Regex
                const m2Match = allText.match(/(\d+)\s*m²\s*totales/i) || allText.match(/superficie\s*total\s*(\d+)/i);
                if (m2Match) m2_total = parseInt(m2Match[1]);

                const builtMatch = allText.match(/(\d+)\s*m²\s*úti/i) || allText.match(/(\d+)\s*m²\s*constr/i);
                if (builtMatch) m2_built = parseInt(builtMatch[1]);

                const bedMatch = allText.match(/(\d+)\s*dorm/i);
                if (bedMatch) bedrooms = parseInt(bedMatch[1]);

                const bathMatch = allText.match(/(\d+)\s*bañ/i);
                if (bathMatch) bathrooms = parseInt(bathMatch[1]);

                // Type
                if (url.includes('departamento')) type = 'Departamento';
                else if (url.includes('casa')) type = 'Casa';
                else if (url.includes('oficina')) type = 'Oficina';
                else if (url.includes('terreno')) type = 'Terreno';
                else if (url.includes('comercial') || url.includes('negocio')) type = 'Comercial';
                else if (url.includes('parking') || url.includes('estacionamiento')) type = 'Estacionamiento';

                // Coordinates
                // Looking for Lat/Lon in scripts
                let latitude = null;
                let longitude = null;

                // Regex for coordinates in source
                const latMatch = html.match(/"latitude":\s*(-?\d+\.\d+)/);
                const lngMatch = html.match(/"longitude":\s*(-?\d+\.\d+)/);

                if (latMatch && lngMatch) {
                    latitude = parseFloat(latMatch[1]);
                    longitude = parseFloat(lngMatch[1]);
                }

                return {
                    source_url: url,
                    title,
                    property_type: type,
                    address: title, // Use title as address usually "123 Street, City"
                    m2_total,
                    m2_built,
                    bedrooms,
                    bathrooms,
                    description,
                    latitude,
                    longitude,
                    agent_id: agentId,
                    status: ['Publicada', 'En Venta']
                };

            } catch (e) {
                console.error(`Error processing ${url}`, e);
                return null;
            }
        });

        const results = await Promise.all(detailPromises);
        const successResults = results.filter(r => r !== null);

        return new Response(
            JSON.stringify({
                success: true,
                count: successResults.length,
                agentId,
                properties: successResults
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

    } catch (error) {
        return new Response(
            JSON.stringify({ success: false, error: error.message }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
})
