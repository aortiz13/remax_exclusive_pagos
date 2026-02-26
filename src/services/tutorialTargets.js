/**
 * Tutorial Targets Catalog
 * Maps all CRM sections, modals, forms, and flows available for tutorial creation
 */

export const TUTORIAL_TARGETS = {
    page: {
        label: '📄 Páginas',
        items: [
            { key: 'page.dashboard', label: 'Dashboard', route: '/dashboard', description: 'Panel principal con resumen de actividad y accesos rápidos' },
            { key: 'page.calendar', label: 'Calendario', route: '/calendar', description: 'Calendario con eventos, reuniones y tareas' },
            { key: 'page.casilla', label: 'Casilla (Email)', route: '/casilla', description: 'Bandeja de email integrada con Gmail' },
            { key: 'page.crm_contacts', label: 'CRM → Contactos & Tareas', route: '/crm', description: 'Gestión de contactos, propiedades y tareas del CRM' },
            { key: 'page.crm_actions', label: 'CRM → Acciones', route: '/crm/actions', description: 'Listado y gestión de acciones comerciales' },
            { key: 'page.crm_pipeline', label: 'CRM → Pipeline Ventas', route: '/crm/pipeline', description: 'Pipeline visual tipo Kanban de ventas' },
            { key: 'page.crm_map', label: 'CRM → Mapa Propiedades', route: '/crm/map', description: 'Mapa interactivo de propiedades geolocalizadas' },
            { key: 'page.kpi_dashboard', label: 'KPIs → Mis Indicadores', route: '/kpis/dashboard', description: 'Dashboard personal de indicadores KPI' },
            { key: 'page.kpi_business_plan', label: 'KPIs → Plan de Negocio', route: '/kpis/business-plan', description: 'Plan de negocio con metas y proyecciones financieras' },
            { key: 'page.kpi_entry', label: 'KPIs → Registro Semanal', route: '/kpis/entry', description: 'Formulario de registro semanal de KPIs' },
            { key: 'page.aula_virtual', label: 'Aula Virtual', route: '/aula-virtual', description: 'Videos de capacitación y tutoriales' },
            { key: 'page.documents', label: 'Documentos Remax', route: '/documents', description: 'Repositorio de documentos institucionales' },
            { key: 'page.my_documents', label: 'Mis Documentos', route: '/my-documents', description: 'Documentos personales del agente' },
            { key: 'page.contact_detail', label: 'CRM → Detalle de Contacto', route: '/crm/contact/:id', description: 'Vista detallada de un contacto con timeline y propiedades' },
            { key: 'page.property_detail', label: 'CRM → Detalle de Propiedad', route: '/crm/property/:id', description: 'Vista detallada de una propiedad con fotos y datos' },
        ]
    },
    modal: {
        label: '🪟 Modales',
        items: [
            { key: 'modal.action', label: 'CRM → Modal de Acciones', component: 'ActionModal', description: 'Crear o editar una acción comercial (llamada, visita, cierre, etc.)' },
            { key: 'modal.task', label: 'CRM → Modal de Tareas', component: 'TaskModal', description: 'Crear o editar una tarea con fecha, prioridad y asignación' },
            { key: 'modal.add_participant', label: 'CRM → Agregar Participante', component: 'AddParticipantModal', description: 'Agregar participante a una propiedad o negociación' },
            { key: 'modal.camera_360', label: 'CRM → Agendar Cámara 360°', component: 'Camera360BookingModal', description: 'Reservar sesión de cámara 360° para una propiedad' },
            { key: 'modal.property_quick_view', label: 'CRM → Vista Rápida Propiedad', component: 'PropertyQuickView', description: 'Vista rápida de propiedad sin salir del listado' },
            { key: 'modal.request_detail', label: 'Kanban → Detalle de Solicitud', component: 'RequestDetailModal', description: 'Detalle de solicitud en vista Kanban' },
            { key: 'modal.quick_contact', label: 'Dashboard → Widget Contacto Rápido', component: 'QuickContactWidget', description: 'Crear contacto rápido desde el dashboard' },
            { key: 'modal.email_composer', label: 'Casilla → Redactar Email', component: 'EmailComposer', description: 'Composición y envío de emails' },
        ]
    },
    form: {
        label: '📝 Formularios',
        items: [
            { key: 'form.payment_link', label: 'Solicitud de Link de Pago', route: '/request/payment/new', description: 'Formulario completo para solicitar un link de pago de arriendo' },
            { key: 'form.contract', label: 'Contrato de Arriendo', route: '/request/contract/new', description: 'Formulario de creación de contrato de arriendo' },
            { key: 'form.evaluacion', label: 'Evaluación Comercial', route: '/request/evaluacion-comercial/new', description: 'Formulario de evaluación comercial de propiedad' },
            { key: 'form.invoice', label: 'Factura / Boleta', route: '/request/invoice/new', description: 'Formulario de solicitud de factura o boleta' },
            { key: 'form.mandate', label: 'Nueva Captación / Mandato', route: '/new-mandate', description: 'Registro de nuevo mandato o captación con documentos' },
            { key: 'form.contact', label: 'CRM → Formulario de Contacto', component: 'ContactForm', description: 'Crear o editar un contacto en el CRM' },
            { key: 'form.property', label: 'CRM → Formulario de Propiedad', component: 'PropertyForm', description: 'Crear o editar una propiedad con todos sus datos' },
            { key: 'form.contact_import', label: 'CRM → Importador de Contactos', component: 'ContactImporter', description: 'Importar contactos masivamente desde Excel' },
            { key: 'form.property_import', label: 'Admin → Importar Propiedades', route: '/admin/import', description: 'Importar propiedades masivamente para agentes' },
            { key: 'form.profile', label: 'Mi Perfil', route: '/profile', description: 'Editar datos personales y configuración del perfil' },
        ]
    },
    flow: {
        label: '🔄 Flujos Completos',
        items: [
            { key: 'flow.create_contact_property', label: 'Crear contacto → agregar propiedad → registrar acción', description: 'Flujo completo de registro de un nuevo contacto con su propiedad y primera acción' },
            { key: 'flow.pipeline_stages', label: 'Pipeline: mover lead por etapas', description: 'Proceso de avance de un lead a través de las etapas del pipeline de ventas' },
            { key: 'flow.payment_link_full', label: 'Solicitar link de pago completo', description: 'Proceso completo desde crear solicitud hasta recibir el link de pago' },
            { key: 'flow.weekly_kpi', label: 'Registrar KPIs semanales', description: 'Flujo de registro de indicadores KPI de la semana' },
            { key: 'flow.camera_360', label: 'Agendar y completar sesión cámara 360°', description: 'Desde agendar la cámara hasta completar la sesión fotográfica' },
            { key: 'flow.mandate_full', label: 'Registro completo de mandato', description: 'Proceso completo de captación: crear mandato, subir documentos y notificar' },
            { key: 'flow.email_task', label: 'Crear tarea desde email', description: 'Leer un email y crear una tarea de seguimiento asociada' },
            { key: 'flow.contact_search_filter', label: 'Buscar y filtrar contactos', description: 'Usar búsqueda y filtros avanzados para encontrar contactos en el CRM' },
        ]
    }
}

/**
 * Get flat list of all targets for search
 */
export function getAllTargets() {
    const all = []
    for (const [type, category] of Object.entries(TUTORIAL_TARGETS)) {
        for (const item of category.items) {
            all.push({ ...item, type, categoryLabel: category.label })
        }
    }
    return all
}

/**
 * Get a target by its key
 */
export function getTargetByKey(key) {
    return getAllTargets().find(t => t.key === key)
}

/**
 * Get targets grouped by type
 */
export function getTargetsGrouped() {
    return Object.entries(TUTORIAL_TARGETS).map(([type, category]) => ({
        type,
        label: category.label,
        items: category.items
    }))
}
