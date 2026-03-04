// ==============================================
// INSTRUCCIONES PARA n8n - Reemplazar "Crear Lead Asignado"
// ==============================================
// 
// El Code node de n8n NO soporta fetch().
// Necesitas 4 nodos en lugar de 1:
//
// marcar como leído1 → [1] Buscar turno hoy → [2] Preparar Lead → [3] Crear Contacto CRM → [4] Crear Guard Lead
//
// =============================================

// ─────────────────────────────────────────────
// NODO 1: "Buscar turno hoy" (HTTP Request)
// ─────────────────────────────────────────────
// Tipo: HTTP Request
// Method: GET
// URL: https://wdyfeolbuogoyngrvxkc.supabase.co/rest/v1/shift_bookings?agent_id=eq.{{ $('Buscar agente en Supabase1').item.json.id }}&booking_date=eq.{{ $now.format('yyyy-MM-dd') }}&status=eq.aprobado&select=id,shift,booking_date
// Headers:
//   apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndkeWZlb2xidW9nb3luZ3J2eGtjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODQ4MjIxNSwiZXhwIjoyMDg0MDU4MjE1fQ.zcJ1Sg-u-32xFQmiXzyDxJ9b40rGQpURP5flQVLIDCg
//   Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndkeWZlb2xidW9nb3luZ3J2eGtjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODQ4MjIxNSwiZXhwIjoyMDg0MDU4MjE1fQ.zcJ1Sg-u-32xFQmiXzyDxJ9b40rGQpURP5flQVLIDCg
//
// ⚠️ IMPORTANTE: En Settings del nodo, activar "Always Output Data" = ON
//    Esto hace que el nodo siempre pase datos aunque no encuentre turno


// ─────────────────────────────────────────────
// NODO 2: "Preparar Lead" (Code node)
// ─────────────────────────────────────────────
// Tipo: Code (JavaScript)
// PEGAR ESTE CÓDIGO:

const shifts = $input.all().map(i => i.json);
const hasShift = shifts.length > 0 && !!shifts[0]?.id;
const isGuard = hasShift;
const shiftBookingId = isGuard ? shifts[0].id : null;

const webhookData = $('Webhook').item.json.body;
const leadData = webhookData.lead_data[0];
const agentId = $('Buscar agente en Supabase1').item.json.id;
const nombres = (leadData['Datos Contacto'].nombre_apellido || '').split(' ');

return [{
    json: {
        is_guard: isGuard,
        shift_booking_id: shiftBookingId,
        agent_id: agentId,
        first_name: nombres[0] || '',
        last_name: nombres.slice(1).join(' ') || '',
        phone: leadData['Datos Contacto'].telefono || '',
        email: leadData['Datos Contacto'].correo || '',
        source: isGuard ? 'Guardia' : 'Lead Derivado',
        need: leadData['Tipo de transacción'] || ''
    }
}];

// ─────────────────────────────────────────────
// NODO 3: "Crear Contacto CRM" (HTTP Request)
// ─────────────────────────────────────────────
// Tipo: HTTP Request
// Method: POST
// URL: https://wdyfeolbuogoyngrvxkc.supabase.co/rest/v1/contacts
// Headers:
//   apikey: (misma service key)
//   Authorization: Bearer (misma service key)
//   Content-Type: application/json
//   Prefer: return=representation
//
// Body (JSON):
// {
//   "first_name": "{{ $json.first_name }}",
//   "last_name": "{{ $json.last_name }}",
//   "phone": "{{ $json.phone }}",
//   "email": "{{ $json.email }}",
//   "source": "{{ $json.source }}",
//   "status": "Activo",
//   "need": "{{ $json.need }}",
//   "agent_id": "{{ $json.agent_id }}"
// }


// ─────────────────────────────────────────────
// NODO 4: "Crear Guard Lead" (HTTP Request)
// ─────────────────────────────────────────────
// Tipo: HTTP Request
// Method: POST
// URL: https://wdyfeolbuogoyngrvxkc.supabase.co/rest/v1/shift_guard_leads
// Headers:
//   apikey: (misma service key)
//   Authorization: Bearer (misma service key)
//   Content-Type: application/json
//   Prefer: return=representation
//
// Body (JSON) - usa Specify Body = JSON y pega:
// ={
//   "agent_id": "{{ $('Preparar Lead').item.json.agent_id }}",
//   "contact_id": "{{ $json[0].id }}",
//   "is_guard": {{ $('Preparar Lead').item.json.is_guard }},
//   "shift_booking_id": {{ $('Preparar Lead').item.json.shift_booking_id ? '"' + $('Preparar Lead').item.json.shift_booking_id + '"' : 'null' }}
// }
