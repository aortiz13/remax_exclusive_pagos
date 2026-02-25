// Association plan tiers
export const ASSOCIATION_PLANS = [
    { key: 'TRAINEE', label: 'Trainee', pct: 40 },
    { key: 'EJECUTIVO', label: 'Ejecutivo', pct: 50 },
    { key: 'PLATINO', label: 'Platino', pct: 60 },
    { key: 'DIRECTOR', label: 'Director', pct: 70 },
    { key: 'TOP_PRODUCER', label: 'Top Producer', pct: 80 },
]

export const getPlanPercentage = (planKey) => {
    const plan = ASSOCIATION_PLANS.find(p => p.key === planKey)
    return plan ? plan.pct / 100 : 0.5
}

// Default investment items with entry_type
export const DEFAULT_INVESTMENTS = [
    { category: 'Oficina', subcategory: 'Cuotas de oficina y membresía', amount: 0, is_custom: false, entry_type: 'monthly' },
    { category: 'Oficina', subcategory: 'Papelería y otros gastos', amount: 0, is_custom: false, entry_type: 'monthly' },
    { category: 'Marketing', subcategory: 'Marketing directo', amount: 0, is_custom: false, entry_type: 'annual' },
    { category: 'Marketing', subcategory: 'Marketing indirecto', amount: 0, is_custom: false, entry_type: 'annual' },
    { category: 'Tecnología', subcategory: 'Activos como computador y cámara', amount: 0, is_custom: false, entry_type: 'annual' },
    { category: 'Tecnología', subcategory: 'Servicios tecnológicos (plan celular, internet)', amount: 0, is_custom: false, entry_type: 'monthly' },
    { category: 'Movilización', subcategory: 'Transporte público y combustible', amount: 0, is_custom: false, entry_type: 'annual' },
    { category: 'Movilización', subcategory: 'Gastos de vehículo propio', amount: 0, is_custom: false, entry_type: 'annual' },
]

// Default channel actions
export const DEFAULT_CHANNELS = [
    { channel: 'Prospección', action_name: 'Búsqueda en portales inmobiliarios', hours_per_week: 10, position: 0 },
    { channel: 'Prospección', action_name: 'LinkedIn', hours_per_week: 2, position: 1 },
    { channel: 'Prospección', action_name: 'Instagram', hours_per_week: 2, position: 2 },
    { channel: 'Prospección', action_name: 'Farming geográfico', hours_per_week: 3, position: 3 },
    { channel: 'Marketing', action_name: 'Entrega de cartas y flyers', hours_per_week: 1, position: 0 },
    { channel: 'Marketing', action_name: 'Campaña de embudos en redes', hours_per_week: 1, position: 1 },
    { channel: 'Marketing', action_name: '', hours_per_week: 0, position: 2 },
    { channel: 'Marketing', action_name: '', hours_per_week: 0, position: 3 },
    { channel: 'Seguimiento', action_name: 'Revisión del CRM diario', hours_per_week: 5, position: 0 },
    { channel: 'Seguimiento', action_name: '', hours_per_week: 0, position: 1 },
    { channel: 'Seguimiento', action_name: '', hours_per_week: 0, position: 2 },
    { channel: 'Seguimiento', action_name: '', hours_per_week: 0, position: 3 },
    { channel: 'Fidelización', action_name: 'Campaña de referidos', hours_per_week: 1, position: 0 },
    { channel: 'Fidelización', action_name: 'Pop Buy visitas breves', hours_per_week: 3, position: 1 },
    { channel: 'Fidelización', action_name: 'Felicitaciones personalizadas', hours_per_week: 2, position: 2 },
    { channel: 'Fidelización', action_name: '', hours_per_week: 0, position: 3 },
]

// Default other activities
export const DEFAULT_ACTIVITIES = [
    { activity_name: 'Evaluaciones comerciales', hours_per_week: 4, position: 0 },
    { activity_name: 'Mostrar propiedades', hours_per_week: 3, position: 1 },
    { activity_name: 'Reuniones y capacitaciones', hours_per_week: 6, position: 2 },
    { activity_name: 'Reuniones de captación', hours_per_week: 5, position: 3 },
    { activity_name: 'Firmas en notaría', hours_per_week: 3, position: 4 },
]

// Investment categories config
export const INVESTMENT_CATEGORIES = [
    { key: 'Oficina', label: 'Oficina', icon: 'Building2', color: 'amber' },
    { key: 'Marketing', label: 'Marketing', icon: 'Target', color: 'blue' },
    { key: 'Tecnología', label: 'Tecnología', icon: 'Lightbulb', color: 'purple' },
    { key: 'Movilización', label: 'Movilización', icon: 'Car', color: 'emerald' },
]

// Channel config
export const CHANNEL_CONFIG = [
    { key: 'Prospección', color: 'blue', icon: 'Search' },
    { key: 'Marketing', color: 'purple', icon: 'Megaphone' },
    { key: 'Seguimiento', color: 'amber', icon: 'Eye' },
    { key: 'Fidelización', color: 'emerald', icon: 'Heart' },
]

// Format CLP
export const fmtCLP = (n) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(n || 0)
export const fmtNum = (n) => new Intl.NumberFormat('es-CL').format(n || 0)
