/**
 * Inspection Form Templates by Property Type
 *
 * Maps property_type → inspection category → base sections + addable areas
 */

// ─── Property Type → Category mapping ───────────────────
const TYPE_CATEGORY_MAP = {
    Departamento: 'residential',
    Casa: 'residential',
    Comercial: 'commercial',
    Oficina: 'commercial',
    Terreno: null, // no inspection form
}

export function getInspectionCategory(propertyType) {
    return TYPE_CATEGORY_MAP[propertyType] || 'residential'
}

export function getCategoryLabel(category) {
    const labels = {
        residential: 'Residencial',
        commercial: 'Comercial',
        industrial: 'Industrial',
    }
    return labels[category] || 'Residencial'
}

// ─── Helper ─────────────────────────────────────────────
const makeItems = (labels) => labels.map(label => ({ label, estado: '', observacion: '' }))

// ─── Section Definitions ────────────────────────────────

const SECTION_DEFS = {
    // ── Residential sections ──
    cocina: {
        title: 'Cocina',
        icon: 'chef-hat',
        removable: false,
        items: [
            'Estado de paredes y techos',
            'Estado de pisos',
            'Estado de ventanas',
            'Estado de puertas',
            'Estado de muebles empotrados',
            'Estado de grifos y llaves',
            'Estado de campana',
            'Estado de cocina',
            'Estado del horno',
            'Estado de enchufes e interruptores (indicar cantidad)',
            'Otros',
        ],
    },
    sala_estar: {
        title: 'Sala de Estar / Living / Comedor',
        icon: 'sofa',
        removable: false,
        items: [
            'Estado de paredes y cielos',
            'Estado de pisos',
            'Estado de puertas y ventanas',
            'Estado de enchufes e interruptores (indicar cantidad)',
        ],
    },
    dormitorio: {
        title: 'Dormitorio',
        icon: 'bed-double',
        removable: true,
        numbered: true,
        items: [
            'Estado de paredes y cielos',
            'Estado de pisos',
            'Estado de ventanas',
            'Estado de puertas',
            'Closet (puertas, repisas, etc.)',
            'Estado de enchufes e interruptores (indicar cantidad)',
        ],
    },
    bano: {
        title: 'Baño',
        icon: 'bath',
        removable: true,
        numbered: true,
        items: [
            'Estado de paredes y techos',
            'Estado de pisos',
            'Estado de ventanas',
            'Estado de puertas',
            'Estado de grifos y llaves',
            'Estado de inodoro',
            'Estado de tina / ducha',
        ],
    },
    jardin: {
        title: 'Jardín',
        icon: 'trees',
        removable: true,
        items: [
            'Estado general del césped',
            'Estado de plantas y arbustos',
            'Estado de riego',
            'Estado de cercos perimetrales',
            'Estado de iluminación exterior',
            'Estado de caminos / senderos',
        ],
    },
    terraza: {
        title: 'Terraza',
        icon: 'sun',
        removable: true,
        items: [
            'Estado de pisos',
            'Estado de barandas / protecciones',
            'Estado de iluminación',
            'Estado de desagüe',
            'Estado general',
        ],
    },
    piscina: {
        title: 'Piscina',
        icon: 'waves',
        removable: true,
        items: [
            'Estado de la piscina',
            'Estado del revestimiento',
            'Estado del sistema de filtrado',
            'Estado de la bomba',
            'Estado del área circundante',
            'Estado de cerco de seguridad',
        ],
    },
    logia: {
        title: 'Logia',
        icon: 'shirt',
        removable: true,
        items: [
            'Estado de paredes y cielos',
            'Estado de pisos',
            'Estado de grifos y llaves',
            'Estado de ventilación',
            'Conexiones de lavadora / secadora',
        ],
    },
    bodega: {
        title: 'Bodega',
        icon: 'warehouse',
        removable: true,
        items: [
            'Estado de paredes y techos',
            'Estado de pisos',
            'Estado de puerta / acceso',
            'Estado de iluminación',
            'Humedad o filtraciones',
        ],
    },
    estacionamiento: {
        title: 'Estacionamiento',
        icon: 'car',
        removable: true,
        items: [
            'Estado del piso',
            'Estado de iluminación',
            'Demarcación visible',
            'Estado de portón / acceso',
            'Estado de muros y columnas',
        ],
    },

    // ── Commercial sections ──
    recepcion: {
        title: 'Recepción / Hall',
        icon: 'door-open',
        removable: false,
        items: [
            'Estado de paredes y cielos',
            'Estado de pisos',
            'Estado de puertas de acceso',
            'Estado de iluminación',
            'Estado de climatización',
            'Estado de enchufes e interruptores',
            'Estado de mesón / counter',
        ],
    },
    area_trabajo: {
        title: 'Área de Trabajo',
        icon: 'monitor',
        removable: false,
        items: [
            'Estado de paredes y cielos',
            'Estado de pisos',
            'Estado de ventanas',
            'Estado de iluminación',
            'Estado de climatización',
            'Estado de enchufes e interruptores (indicar cantidad)',
            'Estado de red de datos / internet',
        ],
    },
    kitchenette: {
        title: 'Cocina / Kitchenette',
        icon: 'coffee',
        removable: false,
        items: [
            'Estado de paredes y techos',
            'Estado de pisos',
            'Estado de muebles',
            'Estado de grifos y llaves',
            'Estado de electrodomésticos',
            'Estado de enchufes',
        ],
    },
    sala_reuniones: {
        title: 'Sala de Reuniones',
        icon: 'users',
        removable: true,
        numbered: true,
        items: [
            'Estado de paredes y cielos',
            'Estado de pisos',
            'Estado de puertas y ventanas',
            'Estado de iluminación',
            'Estado de climatización',
            'Estado de enchufes e interruptores',
            'Estado de equipamiento audiovisual',
        ],
    },
    oficina_privada: {
        title: 'Oficina Privada',
        icon: 'briefcase',
        removable: true,
        numbered: true,
        items: [
            'Estado de paredes y cielos',
            'Estado de pisos',
            'Estado de puerta',
            'Estado de ventanas',
            'Estado de iluminación',
            'Estado de climatización',
            'Estado de enchufes e interruptores',
        ],
    },

    // ── Industrial sections ──
    area_carga: {
        title: 'Área de Carga / Descarga',
        icon: 'truck',
        removable: false,
        items: [
            'Estado del acceso vehicular',
            'Estado del portón',
            'Estado del piso / rampa',
            'Estado de iluminación',
            'Señalética de seguridad',
        ],
    },
    nave_principal: {
        title: 'Nave Principal',
        icon: 'factory',
        removable: false,
        items: [
            'Estado de estructura / techumbre',
            'Estado de pisos',
            'Estado de portones',
            'Estado de iluminación',
            'Estado de ventilación',
            'Estado de instalaciones eléctricas',
            'Estado de instalaciones sanitarias',
        ],
    },
    oficina_admin: {
        title: 'Oficina Administrativa',
        icon: 'clipboard-list',
        removable: true,
        items: [
            'Estado de paredes y cielos',
            'Estado de pisos',
            'Estado de puertas y ventanas',
            'Estado de iluminación',
            'Estado de climatización',
            'Estado de enchufes e interruptores',
        ],
    },
    patio: {
        title: 'Patio',
        icon: 'fence',
        removable: true,
        items: [
            'Estado del piso / superficie',
            'Estado de cercos perimetrales',
            'Estado de iluminación',
            'Estado de drenaje',
        ],
    },

    // ── Custom "Otro" section ──
    otro: {
        title: 'Otro',
        icon: 'plus',
        removable: true,
        numbered: true,
        items: [],
    },
}

// ─── Base sections per category ─────────────────────────
const CATEGORY_BASE_SECTIONS = {
    residential: ['cocina', 'sala_estar', 'dormitorio', 'bano'],
    commercial: ['recepcion', 'area_trabajo', 'bano', 'kitchenette'],
    industrial: ['area_carga', 'nave_principal', 'bano', 'oficina_admin'],
}

// Extra sections auto-added for specific property types
const TYPE_EXTRAS = {
    Casa: ['jardin'],
}

// ─── Addable areas per category ─────────────────────────
const CATEGORY_ADDABLE_AREAS = {
    residential: ['dormitorio', 'bano', 'jardin', 'terraza', 'piscina', 'logia', 'bodega', 'estacionamiento', 'otro'],
    commercial: ['sala_reuniones', 'oficina_privada', 'bano', 'bodega', 'estacionamiento', 'otro'],
    industrial: ['bodega', 'patio', 'bano', 'estacionamiento', 'otro'],
}

// ─── Public API ─────────────────────────────────────────

/**
 * Get the list of addable area options for a category
 */
export function getAddableAreas(category) {
    const keys = CATEGORY_ADDABLE_AREAS[category] || CATEGORY_ADDABLE_AREAS.residential
    return keys.map(key => ({
        key,
        title: SECTION_DEFS[key]?.title || key,
        icon: SECTION_DEFS[key]?.icon || 'plus',
    }))
}

/**
 * Create a new section instance from a section definition key
 */
export function createSection(sectionKey, existingSections = []) {
    const def = SECTION_DEFS[sectionKey]
    if (!def) return null

    // Count how many of this type already exist
    const count = existingSections.filter(s => s.baseKey === sectionKey).length
    const num = count + 1

    return {
        key: def.numbered ? `${sectionKey}_${num}` : `${sectionKey}_${Date.now()}`,
        baseKey: sectionKey,
        title: def.numbered ? `${def.title} ${num}` : def.title,
        icon: def.icon,
        removable: true, // dynamically added sections are always removable
        items: makeItems(def.items),
    }
}

/**
 * Generate the complete form_data for a given property type
 */
export function getFormDataForPropertyType(propertyType) {
    const category = getInspectionCategory(propertyType)
    if (!category) return null // e.g. Terreno

    const baseKeys = CATEGORY_BASE_SECTIONS[category] || CATEGORY_BASE_SECTIONS.residential
    const extras = TYPE_EXTRAS[propertyType] || []
    const allKeys = [...baseKeys, ...extras]

    // Build sections array
    const sections = []
    const counters = {}

    for (const key of allKeys) {
        const def = SECTION_DEFS[key]
        if (!def) continue

        counters[key] = (counters[key] || 0) + 1
        const num = counters[key]

        sections.push({
            key: def.numbered ? `${key}_${num}` : key,
            baseKey: key,
            title: def.numbered ? `${def.title} ${num}` : def.title,
            icon: def.icon,
            removable: def.removable,
            items: makeItems(def.items),
        })
    }

    return {
        inspection_type: category,
        property_type: propertyType || '',

        // Header fields (auto-filled on load)
        agente_nombre: '',
        fecha_inspeccion: new Date().toISOString().split('T')[0],
        direccion: '',
        propietarios: [],   // [{ nombre, email }]
        arrendatarios: [],  // [{ nombre }]
        owner_email: '',     // legacy compat — prefer propietarios[0].email

        // Dynamic sections
        sections,

        // Footer fields
        observaciones_adicionales: '',
        recomendaciones: '',
    }
}

/**
 * Renumber sections of the same baseKey after add/remove
 */
export function renumberSections(sections) {
    const counters = {}
    return sections.map(s => {
        const def = SECTION_DEFS[s.baseKey]
        if (!def?.numbered) return s

        counters[s.baseKey] = (counters[s.baseKey] || 0) + 1
        const num = counters[s.baseKey]
        return {
            ...s,
            key: `${s.baseKey}_${num}`,
            title: `${def.title} ${num}`,
        }
    })
}

/**
 * Check if form_data uses the new sections format
 */
export function isNewFormat(formData) {
    return Array.isArray(formData?.sections)
}

/**
 * Convert legacy form_data (with cocina, sala_estar, dormitorios, banos)
 * to the new sections format for rendering compatibility
 */
export function convertLegacyFormData(formData) {
    if (!formData) return null
    if (isNewFormat(formData)) return formData

    const sections = []

    // Cocina
    if (formData.cocina) {
        sections.push({
            key: 'cocina',
            baseKey: 'cocina',
            title: 'Cocina',
            icon: 'chef-hat',
            removable: false,
            items: formData.cocina,
        })
    }

    // Sala de Estar
    if (formData.sala_estar) {
        sections.push({
            key: 'sala_estar',
            baseKey: 'sala_estar',
            title: 'Sala de Estar / Living / Comedor',
            icon: 'sofa',
            removable: false,
            items: formData.sala_estar,
        })
    }

    // Comedor (legacy had separate comedor)
    if (formData.comedor) {
        sections.push({
            key: 'comedor',
            baseKey: 'sala_estar',
            title: 'Comedor',
            icon: 'utensils',
            removable: true,
            items: formData.comedor,
        })
    }

    // Dormitorios
    if (formData.dormitorios) {
        formData.dormitorios.forEach((room, i) => {
            sections.push({
                key: `dormitorio_${i + 1}`,
                baseKey: 'dormitorio',
                title: room.nombre || `Dormitorio ${i + 1}`,
                icon: 'bed-double',
                removable: true,
                items: room.items,
            })
        })
    }

    // Baños
    if (formData.banos) {
        formData.banos.forEach((room, i) => {
            sections.push({
                key: `bano_${i + 1}`,
                baseKey: 'bano',
                title: room.nombre || `Baño ${i + 1}`,
                icon: 'bath',
                removable: true,
                items: room.items,
            })
        })
    }

    return {
        ...formData,
        inspection_type: formData.inspection_type || 'residential',
        property_type: formData.property_type || 'Departamento',
        sections,
    }
}
