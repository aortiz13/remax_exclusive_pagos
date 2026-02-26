/**
 * Auto Script Generator
 * Generates narration scripts and browser automation instructions
 * for each tutorial target automatically
 */

/**
 * Generate narration segments + browser steps for a given target
 * @param {string} targetKey - e.g. 'modal.action', 'page.dashboard'
 * @returns {{ segments: Array, browserSteps: Array }}
 */
export function generateAutoScript(targetKey) {
    const scripts = SCRIPT_TEMPLATES[targetKey]
    if (!scripts) {
        return generateGenericScript(targetKey)
    }
    return scripts
}

// ─── Script Templates ────────────────────────────────────────────────────────

const SCRIPT_TEMPLATES = {
    // ── PÁGINAS ──────────────────────────────────────────────────────────────

    'page.dashboard': {
        segments: [
            { label: 'Introducción', narration_text: 'Bienvenido al Dashboard de Remax Exclusive. Esta es tu pantalla principal donde puedes ver un resumen completo de tu actividad diaria.', start_time: 0, end_time: 8 },
            { label: 'Acciones rápidas', narration_text: 'En la parte superior encontrarás los accesos rápidos para crear nuevas solicitudes, registrar acciones y gestionar tus contactos.', start_time: 8, end_time: 16 },
            { label: 'Indicadores', narration_text: 'Más abajo puedes ver tus indicadores clave de rendimiento, incluyendo llamadas realizadas, visitas y cierres del mes.', start_time: 16, end_time: 24 },
            { label: 'Solicitudes recientes', narration_text: 'En la tabla inferior se muestran tus solicitudes más recientes con su estado actual. Puedes hacer clic en cualquiera para ver los detalles.', start_time: 24, end_time: 32 },
        ],
        browserSteps: [
            { action: 'navigate', url: '/dashboard', wait: 2000 },
            { action: 'scroll', direction: 'down', amount: 300, wait: 3000 },
            { action: 'hover', selector: '.quick-actions', wait: 2000 },
            { action: 'scroll', direction: 'down', amount: 300, wait: 3000 },
            { action: 'scroll', direction: 'down', amount: 300, wait: 3000 },
        ]
    },

    'page.crm_contacts': {
        segments: [
            { label: 'Introducción CRM', narration_text: 'Esta es la sección de Contactos y Tareas del CRM. Aquí gestionas todos tus contactos, propiedades y tareas de seguimiento.', start_time: 0, end_time: 8 },
            { label: 'Lista de contactos', narration_text: 'A la izquierda verás tu lista de contactos. Puedes buscar por nombre, email o teléfono usando la barra de búsqueda superior.', start_time: 8, end_time: 16 },
            { label: 'Detalle de contacto', narration_text: 'Al hacer clic en un contacto, se abre su ficha detallada con toda la información de seguimiento, propiedades asociadas y el historial de acciones.', start_time: 16, end_time: 24 },
            { label: 'Propiedades', narration_text: 'En la pestaña de propiedades puedes ver y gestionar todas las propiedades vinculadas a este contacto, incluyendo tipo de operación, precio y estado.', start_time: 24, end_time: 32 },
        ],
        browserSteps: [
            { action: 'navigate', url: '/crm', wait: 2000 },
            { action: 'click', selector: 'input[placeholder*="Buscar"]', wait: 1000 },
            { action: 'type', text: 'ejemplo', wait: 2000 },
            { action: 'click', selector: '[data-contact]', index: 0, wait: 3000 },
            { action: 'scroll', direction: 'down', amount: 300, wait: 3000 },
        ]
    },

    'page.crm_pipeline': {
        segments: [
            { label: 'Introducción Pipeline', narration_text: 'El Pipeline de Ventas te muestra una vista Kanban de todos tus leads organizados por etapa comercial.', start_time: 0, end_time: 7 },
            { label: 'Etapas', narration_text: 'Las columnas representan las etapas del proceso de venta. Puedes arrastrar y soltar las tarjetas para mover un lead de una etapa a otra.', start_time: 7, end_time: 15 },
            { label: 'Detalle de lead', narration_text: 'Al hacer clic en una tarjeta, puedes ver los detalles del lead, incluyendo el contacto, la propiedad y las acciones realizadas.', start_time: 15, end_time: 23 },
        ],
        browserSteps: [
            { action: 'navigate', url: '/crm/pipeline', wait: 2000 },
            { action: 'hover', selector: '[data-column]', index: 0, wait: 2000 },
            { action: 'hover', selector: '[data-column]', index: 1, wait: 2000 },
            { action: 'click', selector: '[data-lead-card]', index: 0, wait: 3000 },
        ]
    },

    'page.calendar': {
        segments: [
            { label: 'Introducción Calendario', narration_text: 'El Calendario integrado te permite ver y gestionar todas tus reuniones, visitas y eventos programados.', start_time: 0, end_time: 7 },
            { label: 'Navegación', narration_text: 'Puedes navegar entre vistas de día, semana y mes usando los botones superiores. También puedes crear nuevos eventos haciendo clic en cualquier espacio vacío.', start_time: 7, end_time: 16 },
            { label: 'Eventos', narration_text: 'Los eventos se sincronizan automáticamente con Google Calendar. Al hacer clic en un evento puedes ver sus detalles y editarlo.', start_time: 16, end_time: 24 },
        ],
        browserSteps: [
            { action: 'navigate', url: '/calendar', wait: 3000 },
            { action: 'click', selector: 'button:has-text("Semana")', wait: 2000 },
            { action: 'click', selector: 'button:has-text("Mes")', wait: 2000 },
        ]
    },

    'page.casilla': {
        segments: [
            { label: 'Introducción Casilla', narration_text: 'La Casilla es tu bandeja de email integrada directamente en el CRM. Desde aquí puedes leer, responder y gestionar todos tus correos.', start_time: 0, end_time: 8 },
            { label: 'Carpetas', narration_text: 'A la izquierda encuentras las carpetas: Bandeja de entrada, Enviados, Borradores y más. Puedes buscar emails con la barra de búsqueda estilo Gmail.', start_time: 8, end_time: 16 },
            { label: 'Redactar', narration_text: 'Para enviar un nuevo email, haz clic en el botón Redactar. Se abrirá el compositor de email con opciones de formato y archivos adjuntos.', start_time: 16, end_time: 24 },
        ],
        browserSteps: [
            { action: 'navigate', url: '/casilla', wait: 3000 },
            { action: 'click', selector: '[data-folder="INBOX"]', wait: 2000 },
            { action: 'click', selector: '[data-email]', index: 0, wait: 3000 },
        ]
    },

    // ── MODALES ──────────────────────────────────────────────────────────────

    'modal.action': {
        segments: [
            { label: 'Abrir modal', narration_text: 'Para registrar una nueva acción comercial, ve a la ficha de un contacto y haz clic en el botón Agregar Acción.', start_time: 0, end_time: 7 },
            { label: 'Tipo de acción', narration_text: 'Primero selecciona el tipo de acción: puede ser una llamada, visita, tasación, cierre de negocio, entre otros. Cada tipo tiene campos específicos.', start_time: 7, end_time: 16 },
            { label: 'Detalles', narration_text: 'Completa los detalles de la acción: fecha, hora, notas y cualquier dato relevante. Para cierres de negocio, también debes indicar los honorarios brutos.', start_time: 16, end_time: 25 },
            { label: 'Guardar', narration_text: 'Al hacer clic en Guardar, la acción queda registrada en el historial del contacto y se actualiza automáticamente en tus indicadores KPI.', start_time: 25, end_time: 33 },
        ],
        browserSteps: [
            { action: 'navigate', url: '/crm', wait: 2000 },
            { action: 'click', selector: '[data-contact]', index: 0, wait: 2000 },
            { action: 'click', selector: 'button:has-text("Agregar Acción")', wait: 2000 },
            { action: 'click', selector: '[data-action-type]', wait: 2000 },
            { action: 'scroll_modal', direction: 'down', amount: 200, wait: 3000 },
        ]
    },

    'modal.task': {
        segments: [
            { label: 'Crear tarea', narration_text: 'Para crear una nueva tarea, puedes hacerlo desde el tablero de tareas o desde la ficha de un contacto haciendo clic en Agregar Tarea.', start_time: 0, end_time: 8 },
            { label: 'Configurar tarea', narration_text: 'Completa el título de la tarea, selecciona la prioridad, la fecha de vencimiento y opcionalmente asigna un contacto relacionado.', start_time: 8, end_time: 17 },
            { label: 'Notas', narration_text: 'En el campo de notas puedes agregar detalles adicionales. Los enlaces que pegues se convertirán automáticamente en links clickeables.', start_time: 17, end_time: 24 },
            { label: 'Guardar', narration_text: 'Al guardar, la tarea aparecerá en tu tablero de tareas y recibirás un recordatorio según la fecha configurada.', start_time: 24, end_time: 31 },
        ],
        browserSteps: [
            { action: 'navigate', url: '/crm', wait: 2000 },
            { action: 'click', selector: 'button:has-text("Tareas")', wait: 2000 },
            { action: 'click', selector: 'button:has-text("Agregar")', wait: 2000 },
        ]
    },

    'modal.camera_360': {
        segments: [
            { label: 'Agendar cámara', narration_text: 'Para agendar una sesión de Cámara 360 grados, ve a la ficha de la propiedad y haz clic en el botón de Cámara 360.', start_time: 0, end_time: 8 },
            { label: 'Seleccionar fecha', narration_text: 'Selecciona la fecha y horario disponible para la sesión fotográfica. Los horarios ya ocupados aparecen en gris.', start_time: 8, end_time: 16 },
            { label: 'Datos de la propiedad', narration_text: 'Verifica que la dirección y los datos de la propiedad estén correctos. Agrega cualquier instrucción especial para el fotógrafo.', start_time: 16, end_time: 24 },
            { label: 'Confirmar', narration_text: 'Al confirmar la reserva, se enviará una notificación automática al equipo de fotografía y al propietario.', start_time: 24, end_time: 31 },
        ],
        browserSteps: [
            { action: 'navigate', url: '/crm', wait: 2000 },
            { action: 'click', selector: '[data-contact]', index: 0, wait: 2000 },
            { action: 'click', selector: 'button:has-text("Cámara")', wait: 2000 },
        ]
    },

    // ── FORMULARIOS ─────────────────────────────────────────────────────────

    'form.payment_link': {
        segments: [
            { label: 'Introducción', narration_text: 'El formulario de Solicitud de Link de Pago te permite generar un enlace de cobro para arriendos. Vamos a ver cómo completarlo paso a paso.', start_time: 0, end_time: 9 },
            { label: 'Datos del arrendatario', narration_text: 'Comienza ingresando los datos del arrendatario: nombre completo, RUT, email y teléfono. Todos los campos marcados con asterisco son obligatorios.', start_time: 9, end_time: 18 },
            { label: 'Dirección', narration_text: 'La dirección de la propiedad se busca automáticamente con OpenStreetMap. Escribe la dirección y selecciona la opción correcta de la lista.', start_time: 18, end_time: 27 },
            { label: 'Montos', narration_text: 'Ingresa el monto del arriendo, la comisión y cualquier gasto adicional. El seguro de restitución se calcula automáticamente según el monto del arriendo.', start_time: 27, end_time: 36 },
            { label: 'Contrato', narration_text: 'Adjunta el contrato de arriendo en formato PDF. Este campo es obligatorio. Finalmente, haz clic en Enviar Solicitud para generar el link de pago.', start_time: 36, end_time: 45 },
        ],
        browserSteps: [
            { action: 'navigate', url: '/request/payment/new', wait: 2000 },
            { action: 'scroll', direction: 'down', amount: 200, wait: 3000 },
            { action: 'scroll', direction: 'down', amount: 200, wait: 3000 },
            { action: 'scroll', direction: 'down', amount: 200, wait: 3000 },
            { action: 'scroll', direction: 'down', amount: 200, wait: 3000 },
        ]
    },

    'form.contract': {
        segments: [
            { label: 'Introducción', narration_text: 'El formulario de Contrato de Arriendo te permite crear un nuevo contrato paso a paso. Veamos cada sección del formulario.', start_time: 0, end_time: 8 },
            { label: 'Partes', narration_text: 'Primero debes identificar las partes: el arrendador y el arrendatario, con todos sus datos personales y de contacto.', start_time: 8, end_time: 16 },
            { label: 'Propiedad', narration_text: 'Luego completa los datos de la propiedad en arriendo: dirección, tipo de inmueble, superficie y estado de conservación.', start_time: 16, end_time: 24 },
            { label: 'Condiciones', narration_text: 'Define las condiciones del contrato: monto del arriendo, período de pago, duración, garantía y cláusulas especiales.', start_time: 24, end_time: 33 },
        ],
        browserSteps: [
            { action: 'navigate', url: '/request/contract/new', wait: 2000 },
            { action: 'scroll', direction: 'down', amount: 300, wait: 3000 },
            { action: 'scroll', direction: 'down', amount: 300, wait: 3000 },
            { action: 'scroll', direction: 'down', amount: 300, wait: 3000 },
        ]
    },

    'form.mandate': {
        segments: [
            { label: 'Introducción', narration_text: 'El formulario de Nueva Captación o Mandato te permite registrar una nueva propiedad para comercializar. Veamos cómo completarlo.', start_time: 0, end_time: 8 },
            { label: 'Datos básicos', narration_text: 'Ingresa los datos básicos de la captación: tipo de operación, tipo de propiedad, dirección y precio estimado.', start_time: 8, end_time: 16 },
            { label: 'Documentos', narration_text: 'Adjunta los documentos requeridos: escritura, certificado de dominio vigente, y fotografías de la propiedad.', start_time: 16, end_time: 24 },
            { label: 'Confirmar', narration_text: 'Revisa todos los datos y haz clic en Registrar Mandato. Se enviará una notificación automática al equipo comercial y legal.', start_time: 24, end_time: 32 },
        ],
        browserSteps: [
            { action: 'navigate', url: '/new-mandate', wait: 2000 },
            { action: 'scroll', direction: 'down', amount: 300, wait: 3000 },
            { action: 'scroll', direction: 'down', amount: 300, wait: 3000 },
        ]
    },

    'form.contact': {
        segments: [
            { label: 'Crear contacto', narration_text: 'Para crear un nuevo contacto en el CRM, haz clic en el botón Nuevo Contacto. Se abrirá el formulario de registro.', start_time: 0, end_time: 7 },
            { label: 'Datos personales', narration_text: 'Completa el nombre, apellido, email y teléfono del contacto. El email y teléfono te permitirán comunicarte directamente desde el CRM.', start_time: 7, end_time: 16 },
            { label: 'Clasificación', narration_text: 'Selecciona el tipo de contacto: comprador, vendedor, arrendatario o arrendador. También puedes indicar la fuente de origen del lead.', start_time: 16, end_time: 25 },
            { label: 'Guardar', narration_text: 'Al guardar, el contacto se sincroniza automáticamente y queda disponible para asignarle propiedades, acciones y tareas.', start_time: 25, end_time: 33 },
        ],
        browserSteps: [
            { action: 'navigate', url: '/crm', wait: 2000 },
            { action: 'click', selector: 'button:has-text("Nuevo Contacto")', wait: 2000 },
            { action: 'scroll_modal', direction: 'down', amount: 200, wait: 3000 },
        ]
    },

    'form.property': {
        segments: [
            { label: 'Crear propiedad', narration_text: 'Para registrar una nueva propiedad, ve a la ficha del contacto propietario y haz clic en Agregar Propiedad.', start_time: 0, end_time: 7 },
            { label: 'Datos de la propiedad', narration_text: 'Completa el tipo de propiedad, la operación deseada, la dirección, superficie, número de habitaciones y baños.', start_time: 7, end_time: 16 },
            { label: 'Precio y estado', narration_text: 'Define el precio de publicación, el tipo de moneda, y el estado actual de la propiedad en el proceso comercial.', start_time: 16, end_time: 24 },
            { label: 'Guardar', narration_text: 'Al guardar, la propiedad quedará vinculada al contacto y aparecerá en el mapa de propiedades y en el pipeline de ventas.', start_time: 24, end_time: 32 },
        ],
        browserSteps: [
            { action: 'navigate', url: '/crm', wait: 2000 },
            { action: 'click', selector: '[data-contact]', index: 0, wait: 2000 },
            { action: 'click', selector: 'button:has-text("Agregar Propiedad")', wait: 2000 },
        ]
    },

    // ── FLUJOS ───────────────────────────────────────────────────────────────

    'flow.create_contact_property': {
        segments: [
            { label: 'Crear contacto', narration_text: 'Comenzamos creando un nuevo contacto. Haz clic en Nuevo Contacto e ingresa los datos del cliente: nombre, email y teléfono.', start_time: 0, end_time: 9 },
            { label: 'Guardar contacto', narration_text: 'Una vez completados los datos, haz clic en Guardar. El contacto se creará y se abrirá su ficha detallada.', start_time: 9, end_time: 16 },
            { label: 'Agregar propiedad', narration_text: 'Ahora agregamos una propiedad. Haz clic en Agregar Propiedad y completa los datos: tipo, dirección, precio y características.', start_time: 16, end_time: 25 },
            { label: 'Registrar acción', narration_text: 'Finalmente, registra la primera acción comercial. Haz clic en Agregar Acción, selecciona el tipo y agrega las notas relevantes.', start_time: 25, end_time: 34 },
            { label: 'Resultado', narration_text: 'Excelente. Ahora tienes un contacto con propiedad y acción registrada, listo para hacer seguimiento desde el pipeline de ventas.', start_time: 34, end_time: 42 },
        ],
        browserSteps: [
            { action: 'navigate', url: '/crm', wait: 2000 },
            { action: 'click', selector: 'button:has-text("Nuevo Contacto")', wait: 2000 },
            { action: 'click', selector: 'button:has-text("Guardar")', wait: 3000 },
            { action: 'click', selector: 'button:has-text("Agregar Propiedad")', wait: 2000 },
            { action: 'click', selector: 'button:has-text("Agregar Acción")', wait: 2000 },
        ]
    },

    'flow.weekly_kpi': {
        segments: [
            { label: 'Acceder a KPIs', narration_text: 'Para registrar tus indicadores semanales, ve a la sección de Indicadores y haz clic en Mis KPIs.', start_time: 0, end_time: 7 },
            { label: 'Completar datos', narration_text: 'Completa cada campo con tus números de la semana: llamadas realizadas, visitas efectuadas, tasaciones y publicaciones.', start_time: 7, end_time: 16 },
            { label: 'Enviar', narration_text: 'Una vez completados todos los campos, haz clic en Enviar. Tus indicadores se guardarán y se reflejarán en el Dashboard del CEO.', start_time: 16, end_time: 25 },
        ],
        browserSteps: [
            { action: 'navigate', url: '/kpis/entry', wait: 2000 },
            { action: 'scroll', direction: 'down', amount: 200, wait: 3000 },
            { action: 'scroll', direction: 'down', amount: 200, wait: 3000 },
        ]
    },
}

/**
 * Generate a generic script for targets without templates
 */
function generateGenericScript(targetKey) {
    const parts = targetKey.split('.')
    const name = parts[1]?.replace(/_/g, ' ') || targetKey

    return {
        segments: [
            { label: 'Introducción', narration_text: `En este tutorial vamos a explorar la sección de ${name} del sistema Remax Exclusive CRM.`, start_time: 0, end_time: 7 },
            { label: 'Funcionalidades', narration_text: `Aquí puedes ver las principales funcionalidades disponibles. Navega por las opciones para familiarizarte con cada herramienta.`, start_time: 7, end_time: 15 },
            { label: 'Conclusión', narration_text: `Ahora ya conoces las funcionalidades básicas de esta sección. Si tienes dudas, consulta con tu coordinador o revisa otros tutoriales disponibles.`, start_time: 15, end_time: 24 },
        ],
        browserSteps: [
            { action: 'navigate', url: '/dashboard', wait: 3000 },
        ]
    }
}

/**
 * Convert browser steps to a human-readable instruction string
 * for the Antigravity browser_subagent
 */
export function generateBrowserInstructions(targetKey, appUrl = 'http://localhost:5173') {
    const script = generateAutoScript(targetKey)
    const target = targetKey.split('.').pop()?.replace(/_/g, ' ') || targetKey

    let instructions = `Navigate to the CRM application at ${appUrl}. `
    instructions += `You need to record a tutorial for the "${target}" section. `
    instructions += `Follow these steps precisely, taking your time with each action so the recording is clear:\n\n`

    script.browserSteps.forEach((step, i) => {
        switch (step.action) {
            case 'navigate':
                instructions += `${i + 1}. Navigate to ${appUrl}${step.url} and wait ${(step.wait || 2000) / 1000} seconds for the page to fully load.\n`
                break
            case 'click':
                instructions += `${i + 1}. Click on the element "${step.selector}" ${step.index !== undefined ? `(the ${step.index + 1}st one)` : ''} and wait ${(step.wait || 2000) / 1000} seconds.\n`
                break
            case 'type':
                instructions += `${i + 1}. Type "${step.text}" in the active input field and wait ${(step.wait || 2000) / 1000} seconds.\n`
                break
            case 'scroll':
            case 'scroll_modal':
                instructions += `${i + 1}. Scroll ${step.direction} by ${step.amount}px and wait ${(step.wait || 2000) / 1000} seconds.\n`
                break
            case 'hover':
                instructions += `${i + 1}. Hover over "${step.selector}" ${step.index !== undefined ? `(the ${step.index + 1}st one)` : ''} and wait ${(step.wait || 2000) / 1000} seconds.\n`
                break
        }
    })

    instructions += `\nReturn when all steps are completed. Report the recording file path.`
    return instructions
}
