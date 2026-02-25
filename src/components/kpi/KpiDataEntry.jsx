import { useNavigate } from 'react-router-dom'
import {
    MessageSquare, Coffee, UserCheck, Home, TrendingDown,
    Eye, FileText, Handshake, DollarSign, Users, Building2,
    ChevronRight, Zap, Info, BarChart3
} from 'lucide-react'

// Brand tokens (REMAX EXCLUSIVE)
// Primary blue: #003aad | Red accent: #cc0000 | Font: Manrope (via body class)

const KPI_SOURCES = [
    {
        id: 'gestion',
        category: 'Gestión de Contactos',
        subtitle: '5 indicadores',
        indicatorColor: '#2563eb',
        icon: MessageSquare,
        kpis: [
            { label: 'Inicios de Conversación', icon: MessageSquare, description: 'Se registra al agregar una acción tipo "Llamada en frío" o "Otra (I.C)" en el CRM.', path: '/crm', cta: 'Ir al CRM' },
            { label: 'Cafés Relacionales', icon: Coffee, description: 'Se registra al crear una acción "Café relacional" en el módulo CRM.', path: '/crm', cta: 'Ir al CRM' },
            { label: 'Entrevistas Venta (Prelisting)', icon: UserCheck, description: 'Se registra al crear la acción "Entrevista Venta (Pre-listing)" en el CRM.', path: '/crm', cta: 'Ir al CRM' },
            { label: 'Entrevistas Compra (Prebuying)', icon: UserCheck, description: 'Se registra al crear la acción "Entrevista Compra (Pre-Buying)" en el CRM.', path: '/crm', cta: 'Ir al CRM' },
            { label: 'Evaluaciones Comerciales', icon: FileText, description: 'Se registra automáticamente al crear una acción tipo "Evaluación Comercial".', path: '/crm', cta: 'Ir al CRM' },
        ]
    },
    {
        id: 'captaciones',
        category: 'Captaciones y Cartera',
        subtitle: '3 indicadores',
        indicatorColor: '#16a34a',
        icon: Home,
        kpis: [
            { label: 'Captaciones Nuevas', icon: Home, description: 'Se registra automáticamente al guardar una nueva propiedad desde "Nueva Captación".', path: '/new-mandate', cta: 'Nueva Captación' },
            { label: 'Cartera Activa', icon: Building2, description: 'Se registra automáticamente al activar una propiedad en el sistema de propiedades.', path: '/properties', cta: 'Propiedades' },
            { label: 'Bajas de Precio', icon: TrendingDown, description: 'Se registra automáticamente al crear una acción "Baja de Precio" en el CRM.', path: '/crm', cta: 'Ir al CRM' },
        ]
    },
    {
        id: 'negociaciones',
        category: 'Visitas y Negociaciones',
        subtitle: '4 indicadores',
        indicatorColor: '#d97706',
        icon: Eye,
        kpis: [
            { label: 'Visitas Propiedades', icon: Eye, description: 'Se registra al crear una acción "Visita Propiedad" en el módulo CRM.', path: '/crm', cta: 'Ir al CRM' },
            { label: 'Visitas Compradores', icon: Eye, description: 'Se registra al crear una acción "Visita Comprador" en el módulo CRM.', path: '/crm', cta: 'Ir al CRM' },
            { label: 'Ofertas en Negociación', icon: FileText, description: 'Se registra automáticamente al crear una acción "Carta Oferta" en el CRM.', path: '/crm', cta: 'Ir al CRM' },
            { label: 'Promesas Firmadas', icon: Handshake, description: 'Se registra al crear una acción "Promesa Firmada" en el módulo CRM.', path: '/crm', cta: 'Ir al CRM' },
        ]
    },
    {
        id: 'facturacion',
        category: 'Facturación y Cierres',
        subtitle: '3 indicadores',
        indicatorColor: '#003aad',
        icon: DollarSign,
        kpis: [
            { label: 'Honorarios Brutos', icon: DollarSign, description: 'Se registra automáticamente al crear un "Cierre de negocio" en el CRM. El monto en CLP queda guardado en el KPI.', path: '/crm', cta: 'Ir al CRM' },
            { label: 'Valor Cierres de Operación', icon: DollarSign, description: 'Se registra automáticamente al registrar el valor de la operación en "Cierre de negocio".', path: '/crm', cta: 'Ir al CRM' },
            { label: 'Referidos', icon: Users, description: 'Se registra automáticamente al incluir referidos en un "Cierre de negocio".', path: '/crm', cta: 'Ir al CRM' },
        ]
    },
]

export default function KpiDataEntry() {
    const navigate = useNavigate()

    const totalKpis = KPI_SOURCES.reduce((acc, s) => acc + s.kpis.length, 0)

    return (
        <div className="space-y-8 pb-12" style={{ fontFamily: "'Manrope', sans-serif" }}>
            {/* Load Manrope font if not already present */}
            <style>{`@import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap');`}</style>

            {/* ─── Hero Banner ─────────────────────────────────────────── */}
            <div
                className="relative overflow-hidden rounded-2xl text-white shadow-lg"
                style={{ background: 'linear-gradient(135deg, #003aad 0%, #001f6b 100%)' }}
            >
                {/* Decorative circles */}
                <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full opacity-10" style={{ background: '#cc0000' }} />
                <div className="pointer-events-none absolute -bottom-20 left-1/3 h-72 w-72 rounded-full opacity-[0.07]" style={{ background: 'white' }} />

                <div className="relative p-8">
                    {/* RE/MAX wordmark strip */}
                    <div className="mb-6 flex items-center gap-3">
                        <div
                            className="flex h-10 w-10 items-center justify-center rounded-xl font-black text-white text-sm tracking-tight shadow-md"
                            style={{ background: '#cc0000' }}
                        >
                            RE/MAX
                        </div>
                        <span className="text-xs font-semibold tracking-widest uppercase text-blue-200">
                            Exclusive · Sistema de KPIs
                        </span>
                    </div>

                    <div className="flex flex-col md:flex-row md:items-center gap-6">
                        <div className="flex-1">
                            <h2 className="text-2xl font-extrabold leading-tight tracking-tight">
                                Tus indicadores se registran<br />
                                <span style={{ color: '#93c5fd' }}>automáticamente</span>
                            </h2>
                            <p className="mt-2 text-sm leading-relaxed text-blue-200 max-w-xl">
                                Cada acción en el CRM, en Propiedades o en Nueva Captación actualiza tus KPIs en tiempo real. Esta guía muestra exactamente desde dónde se genera cada indicador.
                            </p>
                        </div>

                        {/* Stats pills */}
                        <div className="flex flex-wrap gap-3 md:flex-col md:items-end">
                            {[
                                { label: 'KPIs totales', value: totalKpis },
                                { label: 'Categorías', value: KPI_SOURCES.length },
                                { label: 'Registro manual', value: '0' },
                            ].map(({ label, value }) => (
                                <div key={label} className="rounded-xl px-4 py-2 text-center" style={{ background: 'rgba(255,255,255,0.12)' }}>
                                    <p className="text-xl font-bold">{value}</p>
                                    <p className="text-[10px] text-blue-200 uppercase tracking-wide">{label}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* ─── Category Sections ───────────────────────────────────── */}
            {KPI_SOURCES.map((section) => {
                const CategoryIcon = section.icon
                return (
                    <div key={section.id} className="space-y-4">

                        {/* Section label */}
                        <div className="flex items-center gap-3">
                            <div
                                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                                style={{ background: section.indicatorColor + '18' }}
                            >
                                <CategoryIcon className="h-5 w-5" style={{ color: section.indicatorColor }} />
                            </div>
                            <div>
                                <h3 className="text-base font-bold text-slate-800">{section.category}</h3>
                                <p className="text-xs text-slate-400 font-medium">{section.subtitle} · registro automático</p>
                            </div>

                            {/* Divider line */}
                            <div className="ml-4 h-px flex-1 bg-slate-100" />
                        </div>

                        {/* KPI Cards grid */}
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                            {section.kpis.map((kpi) => {
                                const KpiIcon = kpi.icon
                                return (
                                    <div
                                        key={kpi.label}
                                        className="group flex flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-[0_2px_12px_-4px_rgba(0,0,0,0.08)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_24px_-6px_rgba(0,58,173,0.15)]"
                                    >
                                        {/* Color top bar */}
                                        <div className="h-1 w-full" style={{ background: section.indicatorColor }} />

                                        <div className="flex flex-1 flex-col gap-3 p-5">
                                            {/* Icon + Title */}
                                            <div className="flex items-start gap-3">
                                                <div
                                                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                                                    style={{ background: section.indicatorColor + '18' }}
                                                >
                                                    <KpiIcon className="h-4 w-4" style={{ color: section.indicatorColor }} />
                                                </div>
                                                <div className="leading-tight">
                                                    <p className="text-sm font-bold text-slate-800">{kpi.label}</p>
                                                    <span
                                                        className="inline-block mt-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                                                        style={{ background: section.indicatorColor + '15', color: section.indicatorColor }}
                                                    >
                                                        ⚡ Automático
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Description */}
                                            <p className="flex-1 text-xs leading-relaxed text-slate-500">
                                                {kpi.description}
                                            </p>

                                            {/* CTA */}
                                            <button
                                                onClick={() => navigate(kpi.path)}
                                                className="flex items-center justify-between gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 active:scale-[0.98]"
                                                style={{ background: '#003aad' }}
                                            >
                                                <span>{kpi.cta}</span>
                                                <ChevronRight className="h-4 w-4 shrink-0 opacity-80" />
                                            </button>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                )
            })}

            {/* ─── Footer note ─────────────────────────────────────────── */}
            <div
                className="flex items-start gap-3 rounded-2xl border p-5"
                style={{ borderColor: '#003aad22', background: '#003aad08' }}
            >
                <BarChart3 className="mt-0.5 h-5 w-5 shrink-0" style={{ color: '#003aad' }} />
                <p className="text-sm leading-relaxed text-slate-500">
                    <span className="font-semibold" style={{ color: '#003aad' }}>Todos los KPIs se actualizan en tiempo real</span> en la base de datos y se reflejan automáticamente en el dashboard principal. Si detectas alguna inconsistencia en los datos, contacta con el chat de soporte.
                </p>
            </div>
        </div>
    )
}
