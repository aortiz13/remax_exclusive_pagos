import { supabase } from './supabase'
import { sendRecruitmentEmail } from './recruitmentService'
import { renderTemplate } from './recruitmentTemplateService'

/**
 * Execute automation rules when a candidate moves between pipeline stages.
 * Called after updatePipelineStage() succeeds.
 */
export async function executeStageAutomation(candidate, fromStage, toStage) {
  try {
    // Fetch active rules for this target stage
    const { data: rules, error } = await supabase
      .from('recruitment_automation_rules')
      .select('*, template:template_id(*), template_b:ab_template_b_id(*)')
      .eq('trigger_stage', toStage)
      .eq('is_active', true)

    if (error || !rules?.length) return

    for (const rule of rules) {
      try {
        if (rule.action_type === 'send_email' && rule.template) {
          await executeEmailRule(rule, candidate)
        } else if (rule.action_type === 'create_task') {
          await executeTaskRule(rule, candidate)
        }
      } catch (ruleErr) {
        console.error(`[Automation] Error executing rule ${rule.id}:`, ruleErr.message)
      }
    }
  } catch (err) {
    console.error('[Automation] executeStageAutomation error:', err.message)
  }
}

async function executeEmailRule(rule, candidate) {
  if (!candidate?.email) return

  // A/B testing: randomly pick template A or B
  let template = rule.template
  let abVariant = 'A'

  if (rule.ab_enabled && rule.template_b) {
    const useB = Math.random() < 0.5
    if (useB) {
      template = rule.template_b
      abVariant = 'B'
    }
  }

  // Render template with candidate variables
  const rendered = renderTemplate(template, candidate)

  // Apply delay if configured
  if (rule.delay_minutes > 0) {
    // For delayed emails, schedule via setTimeout (simple approach for frontend-triggered)
    // In production, this would ideally be handled by a backend queue
    setTimeout(async () => {
      try {
        await sendRecruitmentEmail({
          candidateId: candidate.id,
          toEmail: candidate.email,
          subject: rendered.subject,
          bodyHtml: rendered.body,
          templateId: template.id,
          abVariant: rule.ab_enabled ? abVariant : null,
        })
      } catch (err) {
        console.error('[Automation] Delayed email failed:', err.message)
      }
    }, rule.delay_minutes * 60 * 1000)
    return
  }

  await sendRecruitmentEmail({
    candidateId: candidate.id,
    toEmail: candidate.email,
    subject: rendered.subject,
    bodyHtml: rendered.body,
    templateId: template.id,
    abVariant: rule.ab_enabled ? abVariant : null,
  })
}

async function executeTaskRule(rule, candidate) {
  if (!rule.task_title) return

  // Interpolate candidate name into task title
  const title = rule.task_title
    .replace('{{nombre}}', candidate.first_name || '')
    .replace('{{apellido}}', candidate.last_name || '')
    .replace('{{nombre_completo}}', `${candidate.first_name || ''} ${candidate.last_name || ''}`.trim())

  const { error } = await supabase
    .from('recruitment_tasks')
    .insert({
      candidate_id: candidate.id,
      title,
      task_type: rule.task_type || 'Seguimiento',
      priority: 'media',
      completed: false,
      due_date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // tomorrow
    })

  if (error) console.error('[Automation] Task create error:', error.message)
}

/**
 * Fetch automation rules for display in settings UI.
 */
export async function fetchAutomationRules() {
  const { data, error } = await supabase
    .from('recruitment_automation_rules')
    .select('*, template:template_id(id, name, subject), template_b:ab_template_b_id(id, name, subject)')
    .order('trigger_stage', { ascending: true })

  if (error) throw error
  return data || []
}

/**
 * Create or update an automation rule.
 */
export async function upsertAutomationRule(rule) {
  const payload = {
    trigger_stage: rule.trigger_stage,
    action_type: rule.action_type,
    template_id: rule.template_id || null,
    ab_enabled: rule.ab_enabled || false,
    ab_template_b_id: rule.ab_template_b_id || null,
    task_title: rule.task_title || null,
    task_type: rule.task_type || 'Seguimiento',
    delay_minutes: rule.delay_minutes || 0,
    is_active: rule.is_active !== false,
    updated_at: new Date().toISOString(),
  }

  if (rule.id) {
    const { error } = await supabase
      .from('recruitment_automation_rules')
      .update(payload)
      .eq('id', rule.id)
    if (error) throw error
  } else {
    const { error } = await supabase
      .from('recruitment_automation_rules')
      .insert(payload)
    if (error) throw error
  }
}

/**
 * Delete an automation rule.
 */
export async function deleteAutomationRule(id) {
  const { error } = await supabase
    .from('recruitment_automation_rules')
    .delete()
    .eq('id', id)
  if (error) throw error
}

/**
 * Fetch A/B test metrics for a specific template pair.
 */
export async function fetchABMetrics(templateAId, templateBId) {
  const { data: logsA } = await supabase
    .from('recruitment_email_logs')
    .select('id, opened_at, clicked_at')
    .eq('ab_variant', 'A')
    .eq('metadata->>template_id', templateAId)

  const { data: logsB } = await supabase
    .from('recruitment_email_logs')
    .select('id, opened_at, clicked_at')
    .eq('ab_variant', 'B')
    .eq('metadata->>template_id', templateBId)

  const calcMetrics = (logs) => {
    const total = logs?.length || 0
    const opened = logs?.filter(l => l.opened_at)?.length || 0
    const clicked = logs?.filter(l => l.clicked_at)?.length || 0
    return {
      total,
      opened,
      clicked,
      openRate: total > 0 ? Math.round((opened / total) * 100) : 0,
      clickRate: total > 0 ? Math.round((clicked / total) * 100) : 0,
    }
  }

  return { A: calcMetrics(logsA), B: calcMetrics(logsB) }
}
