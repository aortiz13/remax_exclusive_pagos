import { supabase } from './supabase'
import * as XLSX from 'xlsx'

// ─── Excel Parsing ─────────────────────────────────────────────
/**
 * Parse an Excel/CSV file into normalised row objects
 * Expected columns: Dirección, Comuna, Valor de Arriendo, Moneda Contrato,
 *                   Fecha de inicio de contrato, Fecha de término de contrato, Agente Encargado
 */
export function parseExcelFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = (e) => {
            try {
                const wb = XLSX.read(e.target.result, { type: 'array', cellDates: true })
                const sheet = wb.Sheets[wb.SheetNames[0]]
                const raw = XLSX.utils.sheet_to_json(sheet, { defval: '' })

                const rows = raw.map((r, idx) => {
                    // Find columns flexibly (first match wins)
                    const pick = (keys) => {
                        for (const k of Object.keys(r)) {
                            const kn = normalize(k)
                            for (const target of keys) {
                                if (kn.includes(normalize(target))) return r[k]
                            }
                        }
                        return ''
                    }

                    const rawFechaInicio = pick(['fecha de inicio', 'fecha inicio', 'inicio contrato'])
                    const rawFechaFin = pick(['fecha de termino', 'fecha termino', 'termino contrato', 'fecha de término', 'fecha término'])

                    return {
                        _row: idx + 2, // Excel row number (header = 1)
                        direccion: String(pick(['direccion', 'dirección']) || '').trim(),
                        comuna: String(pick(['comuna']) || '').trim(),
                        valor_arriendo: pick(['valor de arriendo', 'valor arriendo', 'arriendo']),
                        moneda: String(pick(['moneda contrato', 'moneda']) || '').trim(),
                        fecha_inicio: parseExcelDate(rawFechaInicio),
                        fecha_fin: parseExcelDate(rawFechaFin),
                        agente: String(pick(['agente encargado', 'agente']) || '').trim(),
                    }
                }).filter(r => r.direccion) // skip empty rows

                resolve(rows)
            } catch (err) {
                reject(err)
            }
        }
        reader.onerror = reject
        reader.readAsArrayBuffer(file)
    })
}

/**
 * Parse various date formats (Date object, dd-mm-yyyy string, dd/mm/yyyy)
 */
function parseExcelDate(val) {
    if (!val) return ''
    if (val instanceof Date) {
        return val.toISOString().split('T')[0]
    }
    const str = String(val).trim()
    // dd-mm-yyyy or dd/mm/yyyy
    const m = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/)
    if (m) {
        return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` // yyyy-mm-dd
    }
    // yyyy-mm-dd already
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str
    return ''
}

// ─── String Normalization ──────────────────────────────────────
/**
 * Normalize a string: lowercase, strip accents, trim
 */
export function normalize(str) {
    return (str || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim()
}

/**
 * Levenshtein distance between two strings (for typo tolerance)
 */
function levenshtein(a, b) {
    const m = a.length, n = b.length
    const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0))
    for (let i = 0; i <= m; i++) dp[i][0] = i
    for (let j = 0; j <= n; j++) dp[0][j] = j
    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            dp[i][j] = Math.min(
                dp[i - 1][j] + 1,
                dp[i][j - 1] + 1,
                dp[i - 1][j - 1] + (a[i - 1] !== b[j - 1] ? 1 : 0)
            )
        }
    }
    return dp[m][n]
}

/**
 * Similarity score 0-100 between two strings based on Levenshtein distance
 */
function similarity(a, b) {
    if (!a || !b) return 0
    const dist = levenshtein(a, b)
    const maxLen = Math.max(a.length, b.length)
    return Math.round((1 - dist / maxLen) * 100)
}

/**
 * Extract just the street name and number from an address string
 * "Apóstol Santiago  32, Depto. 503" → { street: "apostol santiago", number: "32", depto: "503" }
 * "32, Apóstol Santiago, Villa Portales, ..." → { street: "apostol santiago", number: "32", depto: null }
 */
export function extractAddressParts(address) {
    const norm = normalize(address)
    let depto = null

    // Extract depto/departamento/unidad
    const deptoMatch = norm.match(/(?:depto\.?\s*|departamento\s*|dpto\.?\s*|unidad\s*)(\w+)/i)
    if (deptoMatch) depto = deptoMatch[1]

    // Remove depto part and everything after first comma that isn't the number
    const cleaned = norm
        .replace(/,?\s*(?:depto\.?\s*|departamento\s*|dpto\.?\s*|unidad\s*)\w*/gi, '')
        .replace(/,\s*(provincia|region|barrio|villa|santiago|chile|\d{7}).*/gi, '')
        .trim()

    // Try pattern: "Name Number" (e.g., "rodo 1891")
    const match1 = cleaned.match(/^([a-z\s]+?)\s+(\d+)/)
    if (match1) {
        return { street: match1[1].trim(), number: match1[2], depto }
    }

    // Try pattern: "Number, Name" (geocoded: "32, apostol santiago")
    const match2 = cleaned.match(/^(\d+),?\s+(.+?)(?:,|$)/)
    if (match2) {
        return { street: match2[2].trim(), number: match2[1], depto }
    }

    // Try pattern: "Name Number" somewhere in string
    const match3 = cleaned.match(/([a-z\s]{3,}?)\s+(\d+)/)
    if (match3) {
        return { street: match3[1].trim(), number: match3[2], depto }
    }

    return { street: cleaned.split(',')[0].trim(), number: null, depto }
}

/**
 * Generate a unique hash for an Excel row (address + commune + depto)
 * Used to detect already-imported rows
 */
export function generateAddressHash(direccion, comuna) {
    const parts = extractAddressParts(direccion)
    const key = [normalize(parts.street), parts.number || '', parts.depto || '', normalize(comuna)].join('|')
    return key
}

/**
 * Get hashes of already imported rows
 */
async function getAlreadyImportedHashes() {
    const { data } = await supabase
        .from('property_import_log')
        .select('address_hash')
    return new Set((data || []).map(r => r.address_hash))
}

// ─── Matching ──────────────────────────────────────────────────
/**
 * Match Excel rows against DB properties
 * Returns { matched, unmatched, alreadyImported }
 */
export async function matchProperties(excelRows) {
    // Fetch all properties
    const { data: properties } = await supabase
        .from('properties')
        .select('id, address, commune, unit_number, status, contract_start_date, contract_end_date, agent_id, is_office_property')
        .order('address')

    // Fetch already imported hashes
    const importedHashes = await getAlreadyImportedHashes()

    const dbProps = (properties || []).map(p => ({
        ...p,
        _parts: extractAddressParts(p.address || ''),
        _commune: normalize(p.commune || ''),
        _unit: normalize(p.unit_number || ''),
    }))

    const matched = []
    const unmatched = []
    const alreadyImported = []
    const usedPropertyIds = new Set()

    for (const row of excelRows) {
        // Check if already imported
        const hash = generateAddressHash(row.direccion, row.comuna)
        if (importedHashes.has(hash)) {
            alreadyImported.push(row)
            continue
        }

        const rowParts = extractAddressParts(row.direccion)
        const rowCommune = normalize(row.comuna)

        let bestMatch = null
        let bestScore = 0

        for (const prop of dbProps) {
            if (usedPropertyIds.has(prop.id)) continue

            let score = 0

            // Street name comparison
            if (rowParts.street && prop._parts.street) {
                if (prop._parts.street.includes(rowParts.street) || rowParts.street.includes(prop._parts.street)) {
                    score += 40
                } else {
                    const excelWords = rowParts.street.split(/\s+/).filter(w => w.length > 2)
                    const dbWords = prop._parts.street.split(/\s+/).filter(w => w.length > 2)
                    const commonWords = excelWords.filter(w => dbWords.some(dw => dw.includes(w) || w.includes(dw)))
                    if (commonWords.length > 0) {
                        score += Math.min(35, commonWords.length * 15)
                    }
                }
            }

            // Number comparison
            if (rowParts.number && prop._parts.number && rowParts.number === prop._parts.number) {
                score += 30
            }

            // Commune comparison
            if (rowCommune && prop._commune) {
                if (rowCommune === prop._commune) {
                    score += 20
                } else if (prop._commune.includes(rowCommune) || rowCommune.includes(prop._commune)) {
                    score += 15
                }
            }

            // Depto/unit comparison — HIGH WEIGHT to distinguish apts in same building
            if (rowParts.depto || prop._unit) {
                const normDepto = normalize(rowParts.depto || '')
                const normUnit = normalize(prop._unit || '')
                if (normDepto && normUnit) {
                    // Both have depto: compare
                    if (normUnit.includes(normDepto) || normDepto.includes(normUnit)) {
                        score += 20  // Match bonus
                    } else {
                        score -= 15  // Penalty: same address but DIFFERENT depto = wrong property
                    }
                } else if (normDepto && !normUnit) {
                    // Excel has depto but DB doesn't — slight penalty
                    score -= 5
                }
            }

            if (score > bestScore) {
                bestScore = score
                bestMatch = prop
            }
        }

        if (bestMatch && bestScore >= 50) {
            usedPropertyIds.add(bestMatch.id)
            matched.push({
                excelRow: row,
                property: bestMatch,
                confidence: bestScore,
            })
        } else {
            unmatched.push(row)
        }
    }

    return { matched, unmatched, alreadyImported }
}

/**
 * Match agent name from Excel to profiles in DB
 * Returns profile or null (for "Oficina")
 */
export async function matchAgents(excelRows) {
    const { data: profiles } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, role')

    const agentMap = {}

    for (const row of excelRows) {
        const agentName = row.agente
        if (!agentName || agentMap[agentName] !== undefined) continue

        if (normalize(agentName) === 'oficina') {
            agentMap[agentName] = { id: null, isOffice: true, first_name: 'Oficina', last_name: '' }
            continue
        }

        // Fuzzy match: normalize both sides, compare
        const normName = normalize(agentName)
        let bestProfile = null
        let bestScore = 0

        for (const p of (profiles || [])) {
            const fullName = normalize(`${p.first_name} ${p.last_name}`)
            const firstName = normalize(p.first_name)
            const lastName = normalize(p.last_name)

            let score = 0
            // Exact full name
            if (fullName === normName) { score = 100; }
            // Full name contains or is contained
            else if (fullName.includes(normName) || normName.includes(fullName)) { score = 80; }
            // First + last individually
            else {
                const nameParts = normName.split(/\s+/)
                if (nameParts.some(np => np === firstName)) score += 40
                if (nameParts.some(np => np === lastName)) score += 40
                // Partial match
                if (score === 0 && nameParts.some(np => firstName.includes(np) && np.length > 3)) score += 30
                if (score < 80 && nameParts.some(np => lastName.includes(np) && np.length > 3)) score += 30
            }

            // Fuzzy fallback: Levenshtein similarity for typos (e.g. Lackinton vs Lackington)
            if (score < 50) {
                const sim = similarity(normName, fullName)
                if (sim >= 80) score = Math.max(score, sim) // e.g. 1-2 char typo
            }

            if (score > bestScore) {
                bestScore = score
                bestProfile = p
            }
        }

        agentMap[agentName] = bestScore >= 50 ? bestProfile : null
    }

    return agentMap
}

// ─── Apply Import ──────────────────────────────────────────────
/**
 * Apply the import:
 * - matched rows: update contract dates on existing properties
 * - unmatched rows: create new properties
 * Returns { updated: number, created: number, officeCount: number, errors: [] }
 */
export async function applyImport(matched, unmatched, agentMap) {
    const results = { updated: 0, created: 0, officeCount: 0, createdProperties: [], errors: [] }
    const { data: { user } } = await supabase.auth.getUser()

    // 1. Update matched properties
    for (const m of matched) {
        try {
            const updateData = {}
            if (m.excelRow.fecha_inicio) updateData.contract_start_date = m.excelRow.fecha_inicio
            if (m.excelRow.fecha_fin) updateData.contract_end_date = m.excelRow.fecha_fin

            const currentStatus = m.property.status || []
            if (!currentStatus.includes('Administrada')) {
                updateData.status = [...currentStatus, 'Administrada']
            }

            const agent = agentMap[m.excelRow.agente]
            if (agent?.isOffice) {
                updateData.is_office_property = true
                updateData.agent_id = null
                results.officeCount++
            } else if (agent?.id) {
                updateData.agent_id = agent.id
            }

            if (Object.keys(updateData).length > 0) {
                updateData.updated_at = new Date().toISOString()
                const { error } = await supabase
                    .from('properties')
                    .update(updateData)
                    .eq('id', m.property.id)

                if (error) throw error
                results.updated++

                // Log import
                await supabase.from('property_import_log').insert({
                    address_hash: generateAddressHash(m.excelRow.direccion, m.excelRow.comuna),
                    property_id: m.property.id,
                    excel_address: m.excelRow.direccion,
                    excel_comuna: m.excelRow.comuna,
                    excel_agente: m.excelRow.agente,
                    action: 'matched',
                    imported_by: user?.id || null,
                })
            }
        } catch (err) {
            results.errors.push({ row: m.excelRow._row, address: m.excelRow.direccion, error: err.message })
        }
    }

    // 2. Create unmatched properties
    for (const row of unmatched) {
        try {
            const agent = agentMap[row.agente]
            const isOffice = agent?.isOffice || false

            const newProp = {
                address: row.direccion,
                commune: row.comuna,
                status: ['Administrada'],
                contract_start_date: row.fecha_inicio || null,
                contract_end_date: row.fecha_fin || null,
                agent_id: isOffice ? null : (agent?.id || null),
                is_office_property: isOffice,
                property_type: 'Departamento',
            }

            const parts = extractAddressParts(row.direccion)
            if (parts.depto) {
                newProp.unit_number = `Depto ${parts.depto}`
                newProp.address = row.direccion.replace(/,?\s*(?:Depto\.?\s*|Departamento\s*|Dpto\.?\s*)\d+/gi, '').trim()
            }

            const { data, error } = await supabase
                .from('properties')
                .insert(newProp)
                .select()
                .single()

            if (error) throw error
            results.created++
            results.createdProperties.push({
                id: data.id,
                address: row.direccion,
                comuna: row.comuna,
                agente: row.agente,
            })
            if (isOffice) results.officeCount++

            // Log import
            await supabase.from('property_import_log').insert({
                address_hash: generateAddressHash(row.direccion, row.comuna),
                property_id: data.id,
                excel_address: row.direccion,
                excel_comuna: row.comuna,
                excel_agente: row.agente,
                action: 'created',
                imported_by: user?.id || null,
            })
        } catch (err) {
            results.errors.push({ row: row._row, address: row.direccion, error: err.message })
        }
    }

    return results
}
