import { readFileSync } from 'fs';

const raw = readFileSync('/Users/adrianortiz/.gemini/antigravity/brain/a76f2e72-1e1b-455c-baa0-ad7f9e29500d/.system_generated/steps/194/output.txt', 'utf8');

// Parse the MCP wrapper
const wrapper = JSON.parse(raw);
const innerText = wrapper.result;

// Extract the JSON array from the untrusted-data block
const arrMatch = innerText.match(/\[\{[\s\S]*\}\]/);
if (!arrMatch) {
  console.error('Could not find JSON array');
  process.exit(1);
}
const rows = JSON.parse(arrMatch[0]);

for (const r of rows) {
  console.log('═══ #' + r.id + ' (' + r.role + ') ═══');
  const msg = r.raw_msg;
  
  if (r.role === 'human') {
    try {
      const inner = JSON.parse(msg);
      const content = inner.content || '';
      console.log(content.substring(0, 400));
    } catch(e) {
      console.log(msg.substring(0, 400));
    }
  } else {
    try {
      const inner = JSON.parse(msg);
      const content = inner.content || '';
      try {
        const output = JSON.parse(content);
        if (output.output?.Response) {
          const resp = output.output.Response;
          console.log('[CLASIFICADOR] Etiqueta: "' + (resp.Etiqueta || '') + '"');
          if (resp.Mensaje_Usuario) console.log('  → Al usuario: "' + resp.Mensaje_Usuario.substring(0, 200) + '"');
          if (resp.Mensaje_Interno) console.log('  → Interno: "' + resp.Mensaje_Interno.substring(0, 200) + '"');
        } else if (output.output?.respuesta_agente) {
          const ra = output.output.respuesta_agente;
          console.log('[COMERCIAL]');
          console.log('  P1: "' + (ra.parte_1 || '(null)').substring(0, 250) + '"');
          console.log('  P2: "' + (ra.parte_2 || '(null)').substring(0, 250) + '"');
          console.log('  correo:', output.output.correo);
          const pc = output.output.informacion_recopilada?.parte_comercial;
          if (pc) {
            const collected = {};
            if (pc.tipo_transaccion) collected.tipo_tx = pc.tipo_transaccion;
            if (pc.tipo_inmueble) collected.tipo = pc.tipo_inmueble;
            if (pc.num_habitaciones) collected.hab = pc.num_habitaciones;
            if (pc.num_banos) collected.banos = pc.num_banos;
            if (pc.direccion_propiedad?.calle_numero) collected.dir = pc.direccion_propiedad.calle_numero;
            if (pc.direccion_propiedad?.comuna) collected.comuna = pc.direccion_propiedad.comuna;
            if (pc.superficie_total_m2) collected.m2 = pc.superficie_total_m2;
            console.log('  Datos:', JSON.stringify(collected));
          }
          const dc = output.output.informacion_recopilada?.datos_contacto;
          if (dc) {
            const cont = {};
            if (dc.nombre) cont.nombre = dc.nombre;
            if (dc.telefono) cont.tel = dc.telefono;
            if (dc.email) cont.email = dc.email;
            console.log('  Contacto:', JSON.stringify(cont));
          }
        } else {
          console.log(content.substring(0, 400));
        }
      } catch(e2) {
        if (content.includes('Used tools') || content.includes('Tool:')) {
          console.log('[TOOL]', content.substring(0, 300));
        } else {
          console.log(content.substring(0, 400));
        }
      }
    } catch(e) {
      console.log(msg.substring(0, 400));
    }
  }
  console.log('');
}
