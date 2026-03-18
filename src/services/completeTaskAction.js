import { supabase } from './supabase'
import { toast } from 'sonner'
import { toISOLocal } from '../lib/utils'

// Maps action_type → kpi_records field (same as ActionModal / ActionList)
const ACTION_KPI_MAP = {
    'Llamada en frío (I.C)': 'conversations_started',
    'Llamada vendedor/arrendador (I.C)': 'conversations_started',
    'Llamada comprador/arrendatario (I.C)': 'conversations_started',
    'Llamada a base relacional (I.C)': 'conversations_started',
    'Visita a Conserjes (IC)': 'conversations_started',
    'Café relacional': 'relational_coffees',
    'Entrevista Venta (Pre-listing)': 'sales_interviews',
    'Entrevista Compra (Pre-Buying)': 'buying_interviews',
    'Evaluación Comercial': 'commercial_evaluations',
    'Visita Propiedad': 'portfolio_visits',
    'Visita comprador/arrendatario (Canje)': 'buyer_visits',
    'Carta Oferta': 'offers_in_negotiation',
    'Promesa Firmada': 'signed_promises',
    'Contrato de arriendo firmado': 'signed_promises',
    'Baja de Precio': 'price_reductions',
}

/**
 * Centralized function to toggle task completion.
 * Handles linked action activation + KPI increment when completing a task.
 *
 * @param {string} taskId
 * @param {boolean} currentlyCompleted - current completed state
 * @param {object|null} linkedAction - { id, action_type, kpi_deferred } or null
 * @param {string} agentId
 * @returns {Promise<{ success: boolean, newCompleted: boolean }>}
 */
export async function completeTaskWithAction(taskId, currentlyCompleted, linkedAction, agentId) {
    // BLOCK: trying to un-complete a task whose linked action is already executed
    if (currentlyCompleted && linkedAction && !linkedAction.kpi_deferred) {
        toast.error('Esta tarea tiene una acción vinculada ya ejecutada y no se puede revertir.')
        return { success: false, newCompleted: currentlyCompleted }
    }

    const newCompleted = !currentlyCompleted
    const now = new Date().toISOString()

    try {
        // 1) Update the task
        const { error: taskError } = await supabase
            .from('crm_tasks')
            .update({
                completed: newCompleted,
                completed_at: newCompleted ? now : null
            })
            .eq('id', taskId)

        if (taskError) throw taskError

        // 2) If completing and there is a deferred linked action → activate it + increment KPI
        if (newCompleted && linkedAction && linkedAction.kpi_deferred) {
            const completedDate = toISOLocal(new Date()).split('T')[0] // local date for KPI

            // Activate the action
            const { error: actionError } = await supabase
                .from('crm_actions')
                .update({
                    kpi_deferred: false,
                    action_date: now
                })
                .eq('id', linkedAction.id)

            if (actionError) {
                console.error('Error activating linked action:', actionError)
            } else {
                // Increment KPI
                await incrementKPI(linkedAction.action_type, agentId, completedDate)
            }
        }

        return { success: true, newCompleted }
    } catch (error) {
        console.error('Error toggling task completion:', error)
        toast.error('Error al actualizar tarea')
        return { success: false, newCompleted: currentlyCompleted }
    }
}

/**
 * Check if a completed task with an executed action can be deleted.
 * Returns true if deletion is blocked.
 */
export function isTaskDeletionBlocked(task) {
    if (!task) return false
    // Block deletion if: task is completed AND has an action_id with a non-deferred action
    return task.completed && !!task.action_id
}

/**
 * Increment a KPI field for the given agent on the given date.
 */
async function incrementKPI(actionType, agentId, dateStr) {
    // Check if it's a standard type or an "Otra (I.C)" custom type
    const kpiField = ACTION_KPI_MAP[actionType] || (
        actionType && !Object.keys(ACTION_KPI_MAP).includes(actionType)
            ? 'conversations_started' // fallback for custom I.C. types
            : null
    )
    if (!kpiField) return

    const { data: existingKpi } = await supabase
        .from('kpi_records')
        .select(`id, ${kpiField}`)
        .eq('agent_id', agentId)
        .eq('period_type', 'daily')
        .eq('date', dateStr)
        .single()

    if (existingKpi) {
        await supabase
            .from('kpi_records')
            .update({ [kpiField]: (existingKpi[kpiField] || 0) + 1 })
            .eq('id', existingKpi.id)
    } else {
        await supabase
            .from('kpi_records')
            .insert({
                agent_id: agentId,
                period_type: 'daily',
                date: dateStr,
                [kpiField]: 1,
                new_listings: 0, conversations_started: 0, relational_coffees: 0,
                sales_interviews: 0, buying_interviews: 0, commercial_evaluations: 0,
                active_portfolio: 0, price_reductions: 0, portfolio_visits: 0,
                buyer_visits: 0, offers_in_negotiation: 0, signed_promises: 0,
                billing_primary: 0, referrals_count: 0, billing_secondary: 0,
            })
    }
}
