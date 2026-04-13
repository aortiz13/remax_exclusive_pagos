import { readFileSync } from 'fs';

const files = [
  { label: 'Session 56981828901 (recent, 33 msgs)', path: '/Users/adrianortiz/.gemini/antigravity/brain/a76f2e72-1e1b-455c-baa0-ad7f9e29500d/.system_generated/steps/254/output.txt' },
  { label: 'Session 50764317165 (74 msgs)', path: '/Users/adrianortiz/.gemini/antigravity/brain/a76f2e72-1e1b-455c-baa0-ad7f9e29500d/.system_generated/steps/257/output.txt' },
  { label: 'Session 59892206700 (worst, IDs 1-40)', path: '/Users/adrianortiz/.gemini/antigravity/brain/a76f2e72-1e1b-455c-baa0-ad7f9e29500d/.system_generated/steps/260/output.txt' },
];

for (const f of files) {
  console.log('\n\n' + '═'.repeat(70));
  console.log(f.label);
  console.log('═'.repeat(70));
  
  try {
    const raw = readFileSync(f.path, 'utf8');
    const wrapper = JSON.parse(raw);
    const innerText = wrapper.result || wrapper;
    const arrMatch = typeof innerText === 'string' ? innerText.match(/\[\{[\s\S]*\}\]/) : null;
    const rows = arrMatch ? JSON.parse(arrMatch[0]) : (Array.isArray(innerText) ? innerText : []);
    
    for (const r of rows) {
      const content = r.content || '';
      
      if (r.role === 'human') {
        // Human messages
        const msgMatch = content.match(/Mensaje (?:del )?usuario: ([\s\S]*?)(?:Conversation_ID|Teléfono|$)/);
        if (msgMatch) {
          console.log(`\n#${r.id} 👤: ${msgMatch[1].trim().substring(0, 200)}`);
        } else {
          console.log(`\n#${r.id} 👤: ${content.substring(0, 200)}`);
        }
      } else if (r.role === 'ai') {
        // AI responses
        try {
          const parsed = JSON.parse(content);
          // Postulantes output (respuesta_usuario)
          if (parsed.respuesta_usuario !== undefined) {
            console.log(`#${r.id} 🤖 P1: "${(parsed.respuesta_usuario || '').substring(0, 200)}"`);
            if (parsed.requiere_segunda_parte && parsed.respuesta_usuario_parte2) {
              console.log(`       P2: "${parsed.respuesta_usuario_parte2.substring(0, 200)}"`);
            }
          }
          // Clasificador output (Response)
          else if (parsed.output?.Response) {
            const resp = parsed.output.Response;
            console.log(`#${r.id} 🏷️ [CLASIF] Etiq="${resp.Etiqueta || ''}" → ${(resp.Mensaje_Interno || resp.Mensaje_Usuario || '').substring(0, 100)}`);
          }
          // Other structured outputs
          else if (parsed.output) {
            const keys = Object.keys(parsed.output);
            console.log(`#${r.id} 🤖 [${keys.join(',')}]: ${JSON.stringify(parsed.output).substring(0, 200)}`);
          }
          else {
            console.log(`#${r.id} 🤖: ${content.substring(0, 200)}`);
          }
        } catch(e) {
          // Not JSON - tool calls or plain text
          if (content.includes('Used tools') || content.includes('Tool:')) {
            // Extract tool names
            const tools = [...content.matchAll(/Tool: (\w+)/g)].map(m => m[1]);
            const results = content.match(/Result: (.*?)(?:\]|$)/s);
            console.log(`#${r.id} 🔧 [${tools.join(', ')}] ${results ? results[1].substring(0, 150) : ''}`);
          } else {
            console.log(`#${r.id} 🤖: ${content.substring(0, 200)}`);
          }
        }
      }
    }
  } catch(e) {
    console.error('Error parsing:', e.message);
  }
}
