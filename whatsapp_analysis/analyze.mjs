/**
 * WhatsApp Conversation Quality Analyzer v2.0
 * =============================================
 * Reads locally extracted data, parses nested JSON,
 * classifies users, scores 347 conversations on 6 dimensions,
 * and generates a comprehensive quality report.
 */

import fs from 'fs';
import path from 'path';

const DATA_PATH = '/Users/adrianortiz/Desktop/miniapp_remax/remax-exclusive-requests/whatsapp_analysis/raw_data.json';
const OUTPUT_DIR = '/Users/adrianortiz/Desktop/miniapp_remax/remax-exclusive-requests/whatsapp_analysis';

// ═══════════════════════════════════════
// PHASE 0: DATA LOADING & PARSING
// ═══════════════════════════════════════

function loadData() {
  console.log('📊 Loading raw data...');
  const raw = JSON.parse(fs.readFileSync(DATA_PATH, 'utf-8'));
  console.log(`✅ Loaded ${raw.length} records`);
  return raw;
}

function parseMessage(row) {
  try {
    let msg;
    if (typeof row.message === 'string') {
      msg = JSON.parse(row.message);
    } else {
      msg = row.message;
    }
    
    const parsed = {
      id: row.id,
      session_id: row.session_id,
      type: msg.type,
      rawContent: msg.content,
      toolCalls: msg.tool_calls || [],
      extractedText: '',
      agentType: null,
      classification: null,
      hasToolCalls: (msg.tool_calls && msg.tool_calls.length > 0),
      toolCallNames: [],
    };
    
    // Extract tool call names
    if (parsed.hasToolCalls) {
      parsed.toolCallNames = msg.tool_calls.map(t => 
        t.name || (t.function && t.function.name) || 'unknown'
      );
    }

    if (msg.type === 'human') {
      parsed.extractedText = (msg.content || '').trim();
    } else if (msg.type === 'ai') {
      try {
        const aiContent = typeof msg.content === 'string' ? JSON.parse(msg.content) : msg.content;
        const output = aiContent.output || aiContent;
        
        // Format 1: Clasificador → output.Response
        if (output.Response) {
          parsed.agentType = 'clasificador';
          parsed.classification = output.Response.Etiqueta || null;
          parsed.extractedText = output.Response.Mensaje_Usuario || '';
        }
        // Format 2: Postulantes → output.respuesta_usuario
        else if (output.respuesta_usuario !== undefined) {
          parsed.agentType = 'postulantes';
          let text = output.respuesta_usuario || '';
          if (output.respuesta_usuario_parte2) {
            text += '\n' + output.respuesta_usuario_parte2;
          }
          parsed.extractedText = text;
          parsed.structuredData = {};
          for (const [k, v] of Object.entries(output)) {
            if (!['respuesta_usuario', 'respuesta_usuario_parte2', 'requiere_segunda_parte'].includes(k)) {
              parsed.structuredData[k] = v;
            }
          }
        }
        // Format 3: Other agents → output.respuesta_agente
        else if (output.respuesta_agente !== undefined) {
          let text = '';
          if (typeof output.respuesta_agente === 'object' && output.respuesta_agente !== null) {
            text = (output.respuesta_agente.parte_1 || '') + '\n' + (output.respuesta_agente.parte_2 || '');
          } else {
            text = String(output.respuesta_agente || '');
          }
          parsed.extractedText = text;
          
          // Detect agent type from output fields
          if (output.tipo_transaccion !== undefined || output.tipo_inmueble !== undefined || 
              output.correo !== undefined || output.email !== undefined ||
              output.habitaciones !== undefined || output.banos !== undefined) {
            parsed.agentType = 'comercial';
          } else if (output.categoria !== undefined || output.detalle_requerimiento !== undefined ||
                     output.notificar !== undefined) {
            // Check for arrendatario vs propietario markers
            const allText = JSON.stringify(output).toLowerCase();
            if (allText.includes('arrendatario') || allText.includes('inquilino')) {
              parsed.agentType = 'arrendatarios';
            } else if (allText.includes('propietario') || allText.includes('arrendador') || allText.includes('dueño')) {
              parsed.agentType = 'propietarios';
            } else {
              parsed.agentType = 'arrendatarios'; // Default since it's the same flow
            }
          } else if (output.area !== undefined || output.departamento !== undefined) {
            parsed.agentType = 'agentes_inmobiliarios';
          }
          
          parsed.structuredData = {};
          for (const [k, v] of Object.entries(output)) {
            if (k !== 'respuesta_agente') {
              parsed.structuredData[k] = v;
            }
          }
        }
        // Format 4: Direct string output
        else if (typeof output === 'string') {
          parsed.extractedText = output;
        }
        // Format 5: Unknown structure - extract any text
        else {
          const texts = [];
          for (const [k, v] of Object.entries(output)) {
            if (typeof v === 'string' && v.length > 10) {
              texts.push(v);
            }
          }
          parsed.extractedText = texts.join('\n') || JSON.stringify(output).substring(0, 500);
        }
      } catch {
        // Content is not parseable JSON, use as plain text
        parsed.extractedText = msg.content || '';
        if (typeof parsed.extractedText === 'string' && parsed.extractedText.length > 5) {
          // Check if it's a tool response or plain text agent response
          if (parsed.extractedText.includes('agente') || parsed.extractedText.includes('reunión')) {
            parsed.agentType = 'unknown_agent';
          }
        }
      }
    }

    return parsed;
  } catch (e) {
    return {
      id: row.id,
      session_id: row.session_id,
      type: 'parse_error',
      rawContent: String(row.message).substring(0, 200),
      extractedText: '',
      error: e.message,
      toolCalls: [],
      toolCallNames: [],
      hasToolCalls: false,
    };
  }
}

// ═══════════════════════════════════════
// PHASE 1: CONVERSATION SEGMENTATION
// ═══════════════════════════════════════

function segmentConversations(parsedMessages) {
  const sessions = {};
  
  for (const msg of parsedMessages) {
    if (!sessions[msg.session_id]) {
      sessions[msg.session_id] = {
        session_id: msg.session_id,
        messages: [],
        totalMessages: 0,
        humanMessages: 0,
        aiMessages: 0,
        userType: 'sin_clasificar',
        agentTypes: new Set(),
        classifications: [],
        hasToolCalls: false,
        escalated: false,
        allToolCalls: [],
      };
    }
    
    const session = sessions[msg.session_id];
    session.messages.push(msg);
    session.totalMessages++;
    
    if (msg.type === 'human') session.humanMessages++;
    if (msg.type === 'ai') session.aiMessages++;
    
    if (msg.agentType) session.agentTypes.add(msg.agentType);
    if (msg.classification) session.classifications.push(msg.classification);
    if (msg.hasToolCalls) {
      session.hasToolCalls = true;
      session.allToolCalls.push(...msg.toolCallNames);
    }

    // Detect escalation keywords in AI responses
    if (msg.type === 'ai' && msg.extractedText) {
      const t = msg.extractedText.toLowerCase();
      if (t.includes('escalar') || t.includes('transferir a un agente') ||
          t.includes('agente humano') || t.includes('derivar tu caso')) {
        session.escalated = true;
      }
    }
    // Detect user requesting human
    if (msg.type === 'human' && msg.extractedText) {
      const t = msg.extractedText.toLowerCase();
      if (t.includes('persona real') || t.includes('hablar con alguien') || 
          t.includes('agente humano') || t.includes('quiero hablar con')) {
        session.escalated = true;
      }
    }
  }
  
  // Post-process sessions
  for (const session of Object.values(sessions)) {
    session.agentTypes = Array.from(session.agentTypes);
    session.turns = Math.min(session.humanMessages, session.aiMessages);
    
    // Determine user type
    if (session.classifications.length > 0) {
      const last = session.classifications[session.classifications.length - 1];
      session.userType = normalizeUserType(last);
    } else if (session.agentTypes.length > 0) {
      // Use the non-clasificador agent type
      const nonClasif = session.agentTypes.filter(a => a !== 'clasificador');
      if (nonClasif.length > 0) {
        session.userType = normalizeUserType(nonClasif[nonClasif.length - 1]);
      } else {
        session.userType = 'sin_clasificar';
      }
    }
    
    // Detect multimedia in human messages
    session.hasMultimedia = false;
    session.multimediaTypes = [];
    for (const msg of session.messages) {
      if (msg.type === 'human' && msg.extractedText) {
        const t = msg.extractedText.toLowerCase();
        if (t.includes('[audio]') || t.includes('audio_file') || t.includes('nota de voz') || t.includes('audio recibido')) {
          session.hasMultimedia = true;
          session.multimediaTypes.push('audio');
        }
        if (t.includes('[imagen]') || t.includes('image_file') || t.includes('foto') || t.includes('captura')) {
          session.hasMultimedia = true;
          session.multimediaTypes.push('imagen');
        }
        if (t.includes('[documento]') || t.includes('document_file') || t.includes('.pdf')) {
          session.hasMultimedia = true;
          session.multimediaTypes.push('documento');
        }
        if (t.includes('[sticker]') || t.includes('sticker')) {
          session.hasMultimedia = true;
          session.multimediaTypes.push('sticker');
        }
        if (t.includes('[video]')) {
          session.hasMultimedia = true;
          session.multimediaTypes.push('video');
        }
        // Check for portal links (toctoc, portalinmobiliario, etc.)
        if (t.match(/toctoc|portalinmobiliario|goplaceit|yapo|mercadolibre/i)) {
          session.hasPortalLinks = true;
        }
      }
    }
  }
  
  return sessions;
}

function normalizeUserType(raw) {
  if (!raw) return 'sin_clasificar';
  const lower = raw.toLowerCase().trim();
  
  if (lower.includes('postulante')) return 'postulante';
  if (lower.includes('comercial') || lower.includes('interesado')) return 'interesado_comercial';
  if (lower.includes('arrendatario') || lower.includes('inquilino')) return 'arrendatario';
  if (lower.includes('arrendador') || lower.includes('propietario')) return 'propietario';
  if (lower.includes('agente') && !lower.includes('postulante')) return 'agente_inmobiliario';
  if (lower === '' || lower === 'sin clasificar') return 'sin_clasificar';
  
  return lower;
}

// ═══════════════════════════════════════
// PHASE 2: QUALITY SCORING (1-10)
// ═══════════════════════════════════════

function scoreConversation(session) {
  const scores = { relevancia: 5, coherencia: 5, fidelidad: 5, completitud: 5, adherencia_rol: 5, eficiencia: 5 };
  const issues = { relevancia: [], coherencia: [], fidelidad: [], completitud: [], adherencia_rol: [], eficiencia: [] };
  
  const msgs = session.messages;
  const humanMsgs = msgs.filter(m => m.type === 'human');
  const aiMsgs = msgs.filter(m => m.type === 'ai');
  
  // ═════ SUPER-SHORT CONVERSATIONS ═════
  if (session.totalMessages <= 1) {
    scores.relevancia = 3; scores.coherencia = 5; scores.fidelidad = 5;
    scores.completitud = 1; scores.adherencia_rol = 5; scores.eficiencia = 3;
    session.resolutionStatus = 'single_message';
    issues.completitud.push('Solo 1 mensaje, sin interacción');
    return finalize(scores, issues, session);
  }
  
  if (session.totalMessages === 2 && humanMsgs.length === 1 && aiMsgs.length === 1) {
    const aiText = aiMsgs[0].extractedText || '';
    if (aiText.length > 20) {
      scores.relevancia = 7; scores.coherencia = 7; scores.fidelidad = 7;
      scores.completitud = 3; scores.adherencia_rol = 7; scores.eficiencia = 6;
    } else {
      scores.relevancia = 3; scores.completitud = 2;
    }
    session.resolutionStatus = 'single_exchange';
    return finalize(scores, issues, session);
  }
  
  // ═════ RELEVANCIA (25%) ═════
  let relScore = 8;
  
  for (let i = 0; i < msgs.length - 1; i++) {
    if (msgs[i].type === 'human' && msgs[i+1].type === 'ai') {
      const hText = (msgs[i].extractedText || '').toLowerCase();
      const aText = (msgs[i+1].extractedText || '').toLowerCase();
      
      // User provided data but AI asks for it again
      if (hText.match(/@\w+\.\w+/) && aText.match(/correo|email|mail/)) {
        const prevProvided = msgs.slice(0, i).some(m => m.type === 'human' && m.extractedText.match(/@\w+\.\w+/));
        if (prevProvided) {
          relScore -= 2;
          issues.relevancia.push(`ID:${msgs[i+1].id} — Pidió email cuando ya fue proporcionado`);
        }
      }
      
      // User answers a question but AI asks unrelated follow-up
      if (hText.length > 5 && aText.length < 10) {
        relScore -= 1;
        issues.relevancia.push(`ID:${msgs[i+1].id} — Respuesta AI muy corta (${aText.length} chars) a input del usuario`);
      }
      
      // AI gives long generic response ignoring user's specific question
      if (hText.includes('?') && aText.length > 300 && !aText.includes('?')) {
        // Might be ignoring the question
        const questionWords = hText.split(/\s+/).filter(w => w.length > 4);
        const mentionsAny = questionWords.some(w => aText.includes(w));
        if (!mentionsAny && questionWords.length > 2) {
          relScore -= 1;
          issues.relevancia.push(`ID:${msgs[i+1].id} — Posible respuesta genérica ignorando pregunta del usuario`);
        }
      }
    }
  }
  
  // Bonus for clasificador correctly routing
  if (session.classifications.length > 0 && session.agentTypes.length > 1) {
    relScore += 1; // Successfully classified and routed
  }
  
  scores.relevancia = clamp(relScore);
  
  // ═════ COHERENCIA (15%) ═════
  let cohScore = 8;
  
  // Detect loops: AI repeating similar messages
  for (let i = 0; i < aiMsgs.length; i++) {
    for (let j = i + 1; j < Math.min(i + 4, aiMsgs.length); j++) {
      const sim = jaccardSimilarity(aiMsgs[i].extractedText, aiMsgs[j].extractedText);
      if (sim > 0.60 && aiMsgs[i].extractedText.length > 40) {
        cohScore -= 2;
        issues.coherencia.push(`IDs:${aiMsgs[i].id}-${aiMsgs[j].id} — Mensajes AI ${(sim*100).toFixed(0)}% similares (posible bucle)`);
        break; // Don't over-penalize
      }
    }
  }
  
  // Context loss: AI re-asks info user provided earlier
  const providedInfo = detectProvidedInfo(humanMsgs);
  for (const am of aiMsgs) {
    const t = (am.extractedText || '').toLowerCase();
    if (providedInfo.has('nombre') && t.match(/tu nombre|cómo te llam/)) {
      const nameMsg = humanMsgs.find(h => h.extractedText.toLowerCase().match(/me llamo|mi nombre es|soy [A-Z]/i));
      if (nameMsg && am.id > nameMsg.id) {
        cohScore -= 1;
        issues.coherencia.push(`ID:${am.id} — Pidió nombre cuando ya fue dado en ID:${nameMsg.id}`);
      }
    }
    if (providedInfo.has('email') && t.match(/correo|email/) && am.id > [...providedInfo.entries()].find(e => e[0] === 'email')?.[1]) {
      cohScore -= 1;
      issues.coherencia.push(`ID:${am.id} — Pidió email cuando ya fue proporcionado`);
    }
  }
  
  scores.coherencia = clamp(cohScore);
  
  // ═════ FIDELIDAD/PRECISIÓN (20%) ═════
  let fidScore = 8;
  
  for (const am of aiMsgs) {
    const t = (am.extractedText || '').toLowerCase();
    
    // Revealing AI nature
    if (t.match(/soy una (ia|inteligencia artificial)|soy un (bot|robot|chatbot)|modelo de lenguaje|como ia/i)) {
      fidScore -= 2;
      issues.fidelidad.push(`ID:${am.id} — Reveló ser IA`);
    }
    
    // Empty or broken responses
    if (t.trim().length < 3 && am.extractedText !== '') {
      fidScore -= 2;
      issues.fidelidad.push(`ID:${am.id} — Respuesta vacía/rota`);
    }
    
    // Hallucinated specific times/schedules without tool verification
    if (t.match(/\b(lunes|martes|miércoles|jueves|viernes)\b.*\b\d{1,2}:\d{2}\b/) && 
        !am.hasToolCalls && session.userType !== 'agente_inmobiliario') {
      fidScore -= 1;
      issues.fidelidad.push(`ID:${am.id} — Mencionó horarios específicos sin verificar con herramientas`);
    }
    
    // Inventing URLs
    if (t.match(/https?:\/\//) && !t.match(/remax|solicitudes\.remax-exclusive|toctoc|portalinmobiliario|goplaceit|google|zoom|meet/)) {
      fidScore -= 1;
      issues.fidelidad.push(`ID:${am.id} — Posible URL inventada`);
    }
    
    // JSON artifacts leaked to user
    if (t.includes('"output"') || t.includes('"respuesta_agente"') || t.includes('"parte_1"')) {
      fidScore -= 3;
      issues.fidelidad.push(`ID:${am.id} — JSON interno expuesto al usuario`);
    }
  }
  
  scores.fidelidad = clamp(fidScore);
  
  // ═════ COMPLETITUD (15%) ═════
  let compScore = 5;
  
  const lastAi = aiMsgs.length > 0 ? aiMsgs[aiMsgs.length - 1] : null;
  const lastHuman = humanMsgs.length > 0 ? humanMsgs[humanMsgs.length - 1] : null;
  
  if (lastAi) {
    const t = (lastAi.extractedText || '').toLowerCase();
    
    // Strong resolution signals
    if (t.match(/reunión.*agendada|cita.*confirmada|reserva.*hecha|te esperamos/i)) {
      compScore = 9;
      session.resolutionStatus = 'resolved_meeting';
    } else if (t.match(/notificado.*equipo|derivado.*área|caso.*registrado|requerimiento.*creado/i)) {
      compScore = 7;
      session.resolutionStatus = 'resolved_notified';
    } else if (t.match(/gracias por tu interés|fue un placer|cualquier.*consulta|no dudes en/i)) {
      compScore = 7;
      session.resolutionStatus = 'resolved_farewell';
    } else if (session.escalated) {
      compScore = 6;
      session.resolutionStatus = 'escalated';
    } else if (session.turns >= 8 && !t.match(/gracias|adiós|chao/i)) {
      compScore = 4;
      session.resolutionStatus = 'likely_abandoned';
      issues.completitud.push(`${session.turns} turnos sin resolución clara`);
    } else {
      compScore = 5;
      session.resolutionStatus = 'unknown';
    }
  }
  
  // Check tool usage for expected workflows
  if (session.userType === 'postulante') {
    const hasCalendar = session.allToolCalls.some(t => t.toLowerCase().includes('calendar') || t.toLowerCase().includes('reunión') || t.toLowerCase().includes('reunion'));
    const hasCRM = session.allToolCalls.some(t => t.toLowerCase().includes('crm'));
    if (hasCalendar) compScore = Math.max(compScore, 8);
    if (hasCRM && hasCalendar) compScore = Math.max(compScore, 9);
  }
  
  // User frustration detection
  for (const hm of humanMsgs) {
    const t = (hm.extractedText || '').toLowerCase();
    if (t.match(/no entiendes|ya te dije|no me sirve|inútil|estúpido|tonto/i)) {
      compScore = Math.min(compScore, 3);
      issues.completitud.push(`ID:${hm.id} — Frustración del usuario detectada: "${t.substring(0, 80)}"`);
      session.resolutionStatus = 'user_frustrated';
    }
  }
  
  scores.completitud = clamp(compScore);
  
  // ═════ ADHERENCIA AL ROL (15%) ═════
  let rolScore = 8;
  
  for (const am of aiMsgs) {
    const t = (am.extractedText || '').toLowerCase();
    
    // Breaking character
    if (t.match(/soy (?:una?|el) (?:ia|inteligencia artificial|bot|robot|chatbot|programa|modelo)/i)) {
      rolScore -= 3;
      issues.adherencia_rol.push(`ID:${am.id} — Rompió personaje revelando ser IA`);
    }
    
    // Wrong language (responding in English to Spanish user)
    if (t.match(/^(hello|hi there|sure|of course|i\'m sorry|let me)\b/i)) {
      rolScore -= 2;
      issues.adherencia_rol.push(`ID:${am.id} — Respondió en inglés`);
    }
    
    // Too informal
    if (t.match(/jajaj|xd |lol |wtf/i)) {
      rolScore -= 1;
      issues.adherencia_rol.push(`ID:${am.id} — Lenguaje demasiado informal`);
    }
    
    // Mentioning other companies inappropriately
    if (t.match(/sotheby|keller williams|century 21|coldwell banker/i) && session.userType === 'postulante') {
      rolScore -= 2;
      issues.adherencia_rol.push(`ID:${am.id} — Mencionó competidores`);
    }
  }
  
  // Check postulante protocol adherence
  if (session.userType === 'postulante' && aiMsgs.length > 3) {
    const allAiText = aiMsgs.map(m => m.extractedText || '').join(' ').toLowerCase();
    let protocolSteps = 0;
    if (allAiText.match(/full[\s-]?time|tiempo completo|dedicación completa|exclusiva/i)) protocolSteps++;
    if (allAiText.match(/comisi[oó]n|100%.*variable|ingresos.*variable/i)) protocolSteps++;
    if (allAiText.match(/2\s*uf|inversi[oó]n|cuota.*incorporaci[oó]n/i)) protocolSteps++;
    
    if (protocolSteps === 3) rolScore = Math.min(10, rolScore + 1);
    else if (protocolSteps < 2 && session.turns > 5) {
      rolScore -= 1;
      issues.adherencia_rol.push(`Solo ${protocolSteps}/3 preguntas de calificación realizadas`);
    }
  }
  
  scores.adherencia_rol = clamp(rolScore);
  
  // ═════ EFICIENCIA (10%) ═════
  let effScore = 7;
  
  // Expected turn counts by user type
  const expectedTurns = {
    postulante: { ideal: 8, max: 15 },
    interesado_comercial: { ideal: 6, max: 12 },
    arrendatario: { ideal: 5, max: 10 },
    propietario: { ideal: 5, max: 10 },
    agente_inmobiliario: { ideal: 4, max: 8 },
    sin_clasificar: { ideal: 3, max: 6 },
  };
  
  const expected = expectedTurns[session.userType] || { ideal: 6, max: 12 };
  if (session.turns > expected.max) {
    effScore -= Math.min(3, Math.floor((session.turns - expected.max) / 3));
    issues.eficiencia.push(`${session.turns} turnos (esperado máx ${expected.max} para ${session.userType})`);
  } else if (session.turns <= expected.ideal) {
    effScore += 1; // Efficient
  }
  
  // Count repeated questions
  const aiQuestions = [];
  for (const am of aiMsgs) {
    const t = (am.extractedText || '');
    const qs = t.match(/[^.!?]*\?/g) || [];
    for (const q of qs) {
      const clean = q.replace(/[¿?]/g, '').trim().toLowerCase();
      if (clean.length > 15) {
        const dup = aiQuestions.find(([prev]) => jaccardSimilarity(prev, clean) > 0.55);
        if (dup) {
          effScore -= 1;
          issues.eficiencia.push(`Pregunta repetida: "${clean.substring(0, 60)}..." (similar a turno anterior)`);
        }
        aiQuestions.push([clean, am.id]);
      }
    }
  }
  
  // Multiple messages from AI with no human in between (over-messaging)
  let consecutiveAi = 0;
  for (const msg of msgs) {
    if (msg.type === 'ai') {
      consecutiveAi++;
      if (consecutiveAi > 2) {
        effScore -= 1;
        issues.eficiencia.push(`${consecutiveAi} mensajes AI consecutivos sin respuesta del usuario`);
        break;
      }
    } else {
      consecutiveAi = 0;
    }
  }
  
  scores.eficiencia = clamp(effScore);
  
  if (!session.resolutionStatus) session.resolutionStatus = 'unknown';
  
  return finalize(scores, issues, session);
}

function finalize(scores, issues, session) {
  const weights = { relevancia: 0.25, coherencia: 0.15, fidelidad: 0.20, completitud: 0.15, adherencia_rol: 0.15, eficiencia: 0.10 };
  
  let weighted = 0;
  for (const [dim, score] of Object.entries(scores)) {
    weighted += score * weights[dim];
  }
  
  session.scores = scores;
  session.weightedScore = Math.round(weighted * 100) / 100;
  session.scoreLevel = weighted >= 9 ? 'EXCELENTE' : weighted >= 7 ? 'BUENO' : weighted >= 5 ? 'ACEPTABLE' : weighted >= 3 ? 'DEFICIENTE' : 'CRÍTICO';
  session.issues = issues;
  
  return session;
}

function clamp(v) { return Math.max(1, Math.min(10, v)); }

function jaccardSimilarity(a, b) {
  if (!a || !b) return 0;
  const wa = new Set(a.toLowerCase().split(/\s+/).filter(w => w.length > 3));
  const wb = new Set(b.toLowerCase().split(/\s+/).filter(w => w.length > 3));
  if (wa.size === 0 || wb.size === 0) return 0;
  let inter = 0;
  for (const w of wa) if (wb.has(w)) inter++;
  return inter / (wa.size + wb.size - inter);
}

function detectProvidedInfo(humanMsgs) {
  const info = new Map();
  for (const hm of humanMsgs) {
    const t = (hm.extractedText || '').toLowerCase();
    if (t.match(/@\w+\.\w+/)) info.set('email', hm.id);
    if (t.match(/me llamo|mi nombre|soy [A-Z]/i)) info.set('nombre', hm.id);
    if (t.match(/\d{8,}/)) info.set('telefono', hm.id);
    if (t.match(/santiago|providencia|las condes|ñuñoa|la florida|maipú|puente alto|vitacura|lo barnechea|maipu|nunoa/i)) info.set('comuna', hm.id);
  }
  return info;
}

// ═══════════════════════════════════════
// PHASE 3: AGENT ANALYSIS
// ═══════════════════════════════════════

function analyzeByAgent(sessions) {
  const stats = {};
  const allSessions = Object.values(sessions);
  
  for (const s of allSessions) {
    let agent = 'sin_clasificar';
    const nonClasif = s.agentTypes.filter(a => a !== 'clasificador');
    
    if (nonClasif.includes('postulantes') || s.userType === 'postulante') agent = 'postulantes';
    else if (nonClasif.includes('comercial') || s.userType === 'interesado_comercial') agent = 'comercial';
    else if (nonClasif.includes('arrendatarios') || s.userType === 'arrendatario') agent = 'arrendatarios';
    else if (nonClasif.includes('propietarios') || s.userType === 'propietario') agent = 'propietarios';
    else if (nonClasif.includes('agentes_inmobiliarios') || s.userType === 'agente_inmobiliario') agent = 'agentes_inmobiliarios';
    else if (s.agentTypes.includes('clasificador') && s.agentTypes.length === 1) agent = 'clasificador';
    
    s.primaryAgent = agent;
    
    if (!stats[agent]) {
      stats[agent] = { count: 0, scores: [], dimScores: {}, worstSession: null, worstScore: 999, bestSession: null, bestScore: -1, issues: [] };
    }
    
    stats[agent].count++;
    stats[agent].scores.push(s.weightedScore);
    
    if (s.weightedScore < stats[agent].worstScore) {
      stats[agent].worstScore = s.weightedScore;
      stats[agent].worstSession = s.session_id;
    }
    if (s.weightedScore > stats[agent].bestScore) {
      stats[agent].bestScore = s.weightedScore;
      stats[agent].bestSession = s.session_id;
    }
    
    for (const d of Object.keys(s.scores)) {
      if (!stats[agent].dimScores[d]) stats[agent].dimScores[d] = [];
      stats[agent].dimScores[d].push(s.scores[d]);
    }
    
    // Collect issues
    for (const [dim, issueList] of Object.entries(s.issues || {})) {
      for (const issue of issueList) {
        stats[agent].issues.push({ session_id: s.session_id, dimension: dim, issue });
      }
    }
  }
  
  // Compute averages
  for (const [agent, data] of Object.entries(stats)) {
    data.avgScore = avg(data.scores);
    data.dimAvgs = {};
    for (const [d, arr] of Object.entries(data.dimScores)) {
      data.dimAvgs[d] = avg(arr);
    }
  }
  
  return stats;
}

function avg(arr) {
  return arr.length > 0 ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 100) / 100 : 0;
}

// ═══════════════════════════════════════
// PHASE 4: REPORT GENERATION
// ═══════════════════════════════════════

function getTranscript(session, maxMsgs = 30) {
  const lines = [];
  let count = 0;
  for (const msg of session.messages) {
    if (count >= maxMsgs) {
      lines.push(`... (+${session.totalMessages - count} mensajes más)`);
      break;
    }
    if (msg.type === 'human') {
      lines.push(`👤 [ID:${msg.id}] ${(msg.extractedText || '').substring(0, 250)}`);
    } else if (msg.type === 'ai') {
      let prefix = '';
      if (msg.hasToolCalls) prefix = `[🔧 ${msg.toolCallNames.join(', ')}] `;
      lines.push(`🤖 [ID:${msg.id}] ${prefix}${(msg.extractedText || '').substring(0, 250)}`);
    }
    count++;
  }
  return lines.join('\n');
}

function generateFullReport(sessions, agentStats) {
  const allSessions = Object.values(sessions);
  const totalConvs = allSessions.length;
  const globalAvg = avg(allSessions.map(s => s.weightedScore));
  
  // Distributions
  const typeDist = {};
  const resDist = {};
  const levelDist = {};
  
  for (const s of allSessions) {
    typeDist[s.userType] = (typeDist[s.userType] || 0) + 1;
    resDist[s.resolutionStatus] = (resDist[s.resolutionStatus] || 0) + 1;
    levelDist[s.scoreLevel] = (levelDist[s.scoreLevel] || 0) + 1;
  }
  
  // Sort conversations by score
  const sorted = [...allSessions].sort((a, b) => a.weightedScore - b.weightedScore);
  const worst10 = sorted.slice(0, 10);
  const best5 = [...allSessions].sort((a, b) => b.weightedScore - a.weightedScore).slice(0, 5);
  
  // Failure patterns
  const patterns = {
    classification: [],
    loops: [],
    context_loss: [],
    tool_misuse: [],
    protocol_violations: [],
    multimedia: [],
    json_leaks: [],
  };
  
  for (const s of allSessions) {
    for (const [dim, issueList] of Object.entries(s.issues || {})) {
      for (const issue of issueList) {
        if (issue.includes('bucle') || issue.includes('similares') || issue.includes('Repetid')) {
          patterns.loops.push({ session_id: s.session_id, issue });
        }
        if (issue.includes('nombre') || issue.includes('email') || issue.includes('proporcionado')) {
          patterns.context_loss.push({ session_id: s.session_id, issue });
        }
        if (issue.includes('IA') || issue.includes('inglés') || issue.includes('personaje') || issue.includes('Reveló')) {
          patterns.protocol_violations.push({ session_id: s.session_id, issue });
        }
        if (issue.includes('JSON')) {
          patterns.json_leaks.push({ session_id: s.session_id, issue });
        }
      }
    }
    
    if (s.hasMultimedia) {
      patterns.multimedia.push({ session_id: s.session_id, types: s.multimediaTypes });
    }
  }
  
  return {
    summary: { totalConvs, globalAvg, typeDist, resDist, levelDist },
    agentStats,
    worst10: worst10.map(s => ({
      session_id: s.session_id,
      userType: s.userType,
      primaryAgent: s.primaryAgent,
      score: s.weightedScore,
      scoreLevel: s.scoreLevel,
      scores: s.scores,
      turns: s.turns,
      totalMessages: s.totalMessages,
      resolutionStatus: s.resolutionStatus,
      issues: s.issues,
      transcript: getTranscript(s, 20),
    })),
    best5: best5.map(s => ({
      session_id: s.session_id,
      userType: s.userType,
      primaryAgent: s.primaryAgent,
      score: s.weightedScore,
      scoreLevel: s.scoreLevel,
      scores: s.scores,
      turns: s.turns,
      totalMessages: s.totalMessages,
      resolutionStatus: s.resolutionStatus,
      transcript: getTranscript(s, 15),
    })),
    patterns,
  };
}

// ═══════════════════════════════════════
// MAIN
// ═══════════════════════════════════════

function main() {
  console.log('═══════════════════════════════════════════════════');
  console.log('  WhatsApp Conversation Quality Analyzer v2.0');
  console.log('═══════════════════════════════════════════════════\n');
  
  // Load & Parse
  const rawData = loadData();
  console.log('\n📝 Parsing messages...');
  const parsed = rawData.map(parseMessage);
  const parseErrors = parsed.filter(m => m.type === 'parse_error');
  console.log(`✅ Parsed: ${parsed.length} | Errors: ${parseErrors.length}`);
  
  // Segment
  console.log('\n📂 Segmenting conversations...');
  const sessions = segmentConversations(parsed);
  console.log(`✅ ${Object.keys(sessions).length} conversations`);
  
  // Score
  console.log('\n📊 Scoring...');
  for (const s of Object.values(sessions)) scoreConversation(s);
  console.log('✅ Done');
  
  // Agent analysis
  console.log('\n🔍 Agent analysis...');
  const agentStats = analyzeByAgent(sessions);
  
  // Generate report
  const report = generateFullReport(sessions, agentStats);
  
  // Save
  fs.writeFileSync(path.join(OUTPUT_DIR, 'quality_report.json'), JSON.stringify(report, null, 2));
  
  // Save session-level data
  const sessionSummaries = {};
  for (const [sid, s] of Object.entries(sessions)) {
    sessionSummaries[sid] = {
      session_id: s.session_id,
      userType: s.userType,
      primaryAgent: s.primaryAgent,
      totalMessages: s.totalMessages,
      turns: s.turns,
      weightedScore: s.weightedScore,
      scoreLevel: s.scoreLevel,
      scores: s.scores,
      resolutionStatus: s.resolutionStatus,
      escalated: s.escalated,
      agentTypes: s.agentTypes,
      classifications: s.classifications,
      hasMultimedia: s.hasMultimedia,
      multimediaTypes: s.multimediaTypes || [],
      issues: s.issues,
    };
  }
  fs.writeFileSync(path.join(OUTPUT_DIR, 'sessions_data.json'), JSON.stringify(sessionSummaries, null, 2));
  
  // ═══════ CONSOLE OUTPUT ═══════
  console.log('\n\n' + '═'.repeat(80));
  console.log('  RESUMEN EJECUTIVO');
  console.log('═'.repeat(80));
  console.log(`\nTotal conversaciones: ${report.summary.totalConvs}`);
  console.log(`Score promedio global: ${report.summary.globalAvg}`);
  
  console.log('\n── Distribución por tipo de usuario ──');
  for (const [t, c] of Object.entries(report.summary.typeDist).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${t.padEnd(25)} ${String(c).padStart(4)} (${(c/report.summary.totalConvs*100).toFixed(1)}%)`);
  }
  
  console.log('\n── Distribución por nivel de calidad ──');
  for (const level of ['EXCELENTE', 'BUENO', 'ACEPTABLE', 'DEFICIENTE', 'CRÍTICO']) {
    const c = report.summary.levelDist[level] || 0;
    const bar = '█'.repeat(Math.round(c / report.summary.totalConvs * 50));
    console.log(`  ${level.padEnd(15)} ${String(c).padStart(4)} (${(c/report.summary.totalConvs*100).toFixed(1)}%) ${bar}`);
  }
  
  console.log('\n── Estado de resolución ──');
  for (const [s, c] of Object.entries(report.summary.resDist).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${s.padEnd(25)} ${String(c).padStart(4)} (${(c/report.summary.totalConvs*100).toFixed(1)}%)`);
  }
  
  console.log('\n\n' + '═'.repeat(120));
  console.log('  HEATMAP DE CALIDAD POR AGENTE');
  console.log('═'.repeat(120));
  const header = 'Agente'.padEnd(22) + 'Conv'.padEnd(6) + 'Avg'.padEnd(7) + 'Relev'.padEnd(7) + 'Coher'.padEnd(7) + 'Fidel'.padEnd(7) + 'Compl'.padEnd(7) + 'Rol'.padEnd(7) + 'Efic'.padEnd(7) + 'Worst Case';
  console.log(header);
  console.log('─'.repeat(120));
  for (const [agent, data] of Object.entries(agentStats).sort((a, b) => b[1].count - a[1].count)) {
    const d = data.dimAvgs;
    console.log(
      agent.padEnd(22) +
      String(data.count).padEnd(6) +
      String(data.avgScore).padEnd(7) +
      String(d.relevancia || 0).padEnd(7) +
      String(d.coherencia || 0).padEnd(7) +
      String(d.fidelidad || 0).padEnd(7) +
      String(d.completitud || 0).padEnd(7) +
      String(d.adherencia_rol || 0).padEnd(7) +
      String(d.eficiencia || 0).padEnd(7) +
      `${data.worstSession} (${data.worstScore})`
    );
  }
  
  console.log('\n\n' + '═'.repeat(80));
  console.log('  TOP 10 PEORES CONVERSACIONES');
  console.log('═'.repeat(80));
  for (let i = 0; i < report.worst10.length; i++) {
    const w = report.worst10[i];
    console.log(`\n${'─'.repeat(70)}`);
    console.log(`#${i+1} | Session: ${w.session_id} | Score: ${w.score} (${w.scoreLevel})`);
    console.log(`   Tipo: ${w.userType} | Agente: ${w.primaryAgent} | Turnos: ${w.turns} | Msgs: ${w.totalMessages}`);
    console.log(`   Resolución: ${w.resolutionStatus}`);
    console.log(`   Scores → R:${w.scores.relevancia} C:${w.scores.coherencia} F:${w.scores.fidelidad} Co:${w.scores.completitud} Ro:${w.scores.adherencia_rol} E:${w.scores.eficiencia}`);
    
    // Show issues
    for (const [dim, issueList] of Object.entries(w.issues)) {
      for (const issue of issueList) {
        console.log(`   ⚠️  [${dim}] ${issue}`);
      }
    }
    
    console.log('\n   📜 TRANSCRIPCIÓN:');
    console.log(w.transcript.split('\n').map(l => '   ' + l).join('\n'));
  }
  
  console.log('\n\n' + '═'.repeat(80));
  console.log('  TOP 5 MEJORES CONVERSACIONES');
  console.log('═'.repeat(80));
  for (let i = 0; i < report.best5.length; i++) {
    const b = report.best5[i];
    console.log(`\n#${i+1} | Session: ${b.session_id} | Score: ${b.score} (${b.scoreLevel})`);
    console.log(`   Tipo: ${b.userType} | Agente: ${b.primaryAgent} | Turnos: ${b.turns}`);
    console.log(`   Resolución: ${b.resolutionStatus}`);
    console.log('\n   📜 TRANSCRIPCIÓN:');
    console.log(b.transcript.split('\n').map(l => '   ' + l).join('\n'));
  }
  
  console.log('\n\n' + '═'.repeat(80));
  console.log('  PATRONES DE FALLO RECURRENTES');
  console.log('═'.repeat(80));
  console.log(`\n  🔄 Bucles de preguntas repetidas: ${report.patterns.loops.length} instancias`);
  for (const p of report.patterns.loops.slice(0, 5)) {
    console.log(`     → ${p.session_id}: ${p.issue}`);
  }
  console.log(`\n  🧠 Pérdida de contexto: ${report.patterns.context_loss.length} instancias`);
  for (const p of report.patterns.context_loss.slice(0, 5)) {
    console.log(`     → ${p.session_id}: ${p.issue}`);
  }
  console.log(`\n  🚫 Violaciones de protocolo: ${report.patterns.protocol_violations.length} instancias`);
  for (const p of report.patterns.protocol_violations.slice(0, 5)) {
    console.log(`     → ${p.session_id}: ${p.issue}`);
  }
  console.log(`\n  📎 Problemas multimedia: ${report.patterns.multimedia.length} conversaciones con multimedia`);
  console.log(`\n  🔐 Fugas de JSON: ${report.patterns.json_leaks.length} instancias`);
  for (const p of report.patterns.json_leaks.slice(0, 5)) {
    console.log(`     → ${p.session_id}: ${p.issue}`);
  }
  
  console.log('\n\n✅ Análisis completo. Reportes guardados en:');
  console.log(`   quality_report.json`);
  console.log(`   sessions_data.json`);
}

main();
