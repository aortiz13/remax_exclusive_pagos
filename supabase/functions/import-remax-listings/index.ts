
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

    try {
        const { agentId } = await req.json()
        if (!agentId) throw new Error('Agent ID is required')

        console.log(`Fetching listings for Agent ID: ${agentId}`);
        const searchUrl = 'https://www.remax.cl/search/listing-search/docs/search';

        // Strict Payload
        const payload = {
            "count": true,
            "skip": 0,
            "top": 100,
            "search": "*",
            "filter": `content/AgentId eq ${agentId} and content/IsViewable eq true and content/OnHoldListing eq false`
        };

        const searchResponse = await fetch(searchUrl, {
            method: 'POST',
            headers: {
                'User-Agent': 'Mozilla/5.0',
                'Content-Type': 'application/json',
                'Origin': 'https://www.remax.cl',
                'Referer': `https://www.remax.cl/listings?AgentID=${agentId}`
            },
            body: JSON.stringify(payload)
        });

        if (!searchResponse.ok) throw new Error(`API Error: ${searchResponse.status}`);

        const searchResult = await searchResponse.json();
        const rawProperties = searchResult.value || [];
        console.log(`Found ${rawProperties.length} active properties via API`);

        // Helper
        const getVal = (obj, key) => {
            if (!obj) return undefined;
            const foundKey = Object.keys(obj).find(k => k.toLowerCase() === key.toLowerCase());
            return foundKey ? obj[foundKey] : undefined;
        };

        const properties = rawProperties.map(item => {
            const p = item.content || item;

            // ID & URL
            let listingId = getVal(p, 'ListingId') || getVal(p, 'MLSID');
            let sourceUrl = '';
            const shortLinks = getVal(p, 'ShortLinks');
            if (Array.isArray(shortLinks) && shortLinks.length > 0) {
                const link = shortLinks.find(l => l.ISOLanguageCode === 'es' || l.LanguageCode === 'es-CL') || shortLinks[0];
                if (link && link.ShortLink) {
                    sourceUrl = `https://www.remax.cl/${link.ShortLink}`;
                    if (!listingId) listingId = link.ShortLink.split('/').pop();
                }
            }
            if (!sourceUrl && listingId) sourceUrl = `https://www.remax.cl/propiedades/${listingId}`;

            // Basic Info
            const title = getVal(p, 'FullAddress') || getVal(p, 'ListingName') || 'Propiedad sin título';
            const address = getVal(p, 'FullAddress') || title;

            const m2_total = getVal(p, 'TotalArea') || 0;
            const m2_built = getVal(p, 'LivingArea') || getVal(p, 'BuiltArea') || 0;
            const bedrooms = getVal(p, 'NumberOfBedrooms') || 0;
            const bathrooms = getVal(p, 'NumberOfBathrooms') || 0;

            // Description
            let desc = '';
            const descArray = getVal(p, 'ListingDescriptions');
            if (Array.isArray(descArray) && descArray.length > 0) {
                desc = descArray.find(d => d.ISOLanguageCode === 'es')?.Description || descArray[0].Description || '';
            }

            // Location
            let latitude = null;
            let longitude = null;
            const loc = getVal(p, 'Location');
            if (loc && loc.coordinates) {
                longitude = loc.coordinates[0];
                latitude = loc.coordinates[1];
            }

            // --- TIERED TYPE CLASSIFICATION ---
            let propertyType = 'Departamento'; // Default
            let operationType = 'venta'; // Default
            let statusArr = ['Publicada', 'En Venta']; // Default status

            const pTypeUID = getVal(p, 'PropertyTypeUID');

            // Try to get explicit name from API
            const propTypeVal = getVal(p, 'PropertyType');
            const propTypeName = typeof propTypeVal === 'string' ? propTypeVal : (getVal(propTypeVal, 'PropertyTypeName') || '');

            const titleUpper = title.toUpperCase();
            const descUpper = desc.toUpperCase();
            const typeNameUpper = propTypeName.toUpperCase();

            // 1. Initial Mapping by UID (Verified)
            if (pTypeUID === 194) propertyType = 'Departamento';
            else if (pTypeUID === 202) propertyType = 'Casa';
            else if (pTypeUID === 13) propertyType = 'Comercial';
            else if (pTypeUID === 19) propertyType = 'Terreno';

            // 2. PARSE FROM URL (Primary source now as per user request)
            if (sourceUrl) {
                const urlLower = sourceUrl.toLowerCase();
                const urlParts = urlLower.split('/');
                const propIndex = urlParts.indexOf('propiedades');

                if (propIndex !== -1 && urlParts.length > propIndex + 2) {
                    const urlType = urlParts[propIndex + 1];
                    const urlOp = urlParts[propIndex + 2];

                    const typeMap: any = {
                        'oficina': 'Oficina',
                        'departamento': 'Departamento',
                        'casa': 'Casa',
                        'terreno': 'Terreno',
                        'comercial': 'Comercial',
                        'bodega': 'Bodega',
                        'estacionamiento': 'Estacionamiento'
                    };
                    if (typeMap[urlType]) propertyType = typeMap[urlType];

                    if (urlOp === 'venta') {
                        operationType = 'venta';
                        statusArr = ['Publicada', 'En Venta'];
                    } else if (urlOp === 'arriendo' || urlOp === 'rent') {
                        operationType = 'arriendo';
                        statusArr = ['Publicada'];
                    }
                }
            }

            // 3. Fallback Keyword Search (If URL didn't yield a specific type or matched default)
            if (propertyType === 'Departamento' && !sourceUrl?.toLowerCase().includes('departamento')) {
                const combined = `${titleUpper} ${descUpper} ${typeNameUpper}`;
                if (combined.includes('OFICINA')) propertyType = 'Oficina';
                else if (combined.includes('LOCAL') || combined.includes('COMERCIAL')) propertyType = 'Comercial';
                else if (combined.includes('TERRENO')) propertyType = 'Terreno';
                else if (combined.includes('CASA')) propertyType = 'Casa';
            }

            // Image URL
            let imageUrl = null;
            const images = getVal(p, 'ListingImages');
            if (Array.isArray(images) && images.length > 0) {
                const firstImage = images.sort((a, b) => (parseInt(a.Order) || 0) - (parseInt(b.Order) || 0))[0];
                if (firstImage && firstImage.FileName) {
                    const countryId = getVal(p, 'CountryID') || 1028;
                    imageUrl = `https://remax.azureedge.net/userimages/${countryId}/LargeWM/${firstImage.FileName}`;
                }
            }

            return {
                source_url: sourceUrl || `https://www.remax.cl/`,
                title: title || 'Propiedad sin título',
                property_type: propertyType,
                operation_type: operationType,
                address: address,
                m2_total: Math.round(m2_total),
                m2_built: Math.round(m2_built),
                bedrooms,
                bathrooms,
                description: desc,
                latitude,
                longitude,
                agent_id: agentId,
                status: statusArr,
                price: getVal(p, 'ListingPrice'),
                currency: getVal(p, 'ListingCurrency'),
                image_url: imageUrl
            };
        });

        return new Response(
            JSON.stringify({
                success: true,
                count: properties.length,
                agentId,
                properties: properties
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
