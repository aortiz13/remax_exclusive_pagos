
import { supabase } from './supabase'

// ─── Audit Log Service ──────────────────────────────────────────────────────
// Centralized logging for the entire app. Captures user actions, API errors,
// navigation events, and unhandled JS errors into `system_audit_logs`.

let _userMeta = { user_id: null, user_email: null, user_name: null }
let _queue = []
let _flushTimer = null
const FLUSH_INTERVAL = 5000 // ms
const MAX_QUEUE = 50

// Slack alert deduplication — avoid flooding channel with identical errors
const _slackSent = new Map() // key → timestamp
const SLACK_COOLDOWN = 60_000 // 60s cooldown per unique error

// ─── Internal helpers ────────────────────────────────────────────────────────

function currentPath() {
    try { return window.location.pathname + window.location.search } catch { return '' }
}

function truncate(str, max = 2000) {
    if (!str) return str
    return str.length > max ? str.substring(0, max) + '...[truncated]' : str
}

function serializeError(err) {
    if (!err) return null
    if (typeof err === 'string') return { message: err }
    return {
        message: err.message || String(err),
        stack: truncate(err.stack, 1500),
        code: err.code,
        name: err.name,
        ...(err.statusCode && { statusCode: err.statusCode }),
        ...(err.details && { details: err.details }),
        ...(err.hint && { hint: err.hint }),
    }
}

async function flush() {
    if (_queue.length === 0) return

    const batch = _queue.splice(0, MAX_QUEUE)

    try {
        const { error } = await supabase.from('system_audit_logs').insert(batch)
        if (error) {
            // If insert fails, just console.warn — do NOT re-queue to avoid infinite loop
            console.warn('[AuditLog] Failed to flush:', error.message)
        }
    } catch (e) {
        console.warn('[AuditLog] Flush error:', e.message)
    }
}

function scheduleFlush() {
    if (_flushTimer) return
    _flushTimer = setTimeout(() => {
        _flushTimer = null
        flush()
    }, FLUSH_INTERVAL)
}

function enqueue(entry) {
    _queue.push({
        ...entry,
        user_id: entry.user_id || _userMeta.user_id,
        user_email: entry.user_email || _userMeta.user_email,
        user_name: entry.user_name || _userMeta.user_name,
        path: entry.path || currentPath(),
        user_agent: navigator.userAgent?.substring(0, 300),
    })

    if (_queue.length >= MAX_QUEUE) {
        flush()
    } else {
        scheduleFlush()
    }

    // Send Slack alert for error / warning levels (fire-and-forget)
    if (entry.level === 'error' || entry.level === 'warning') {
        sendSlackAlert(entry)
    }
}

// ─── Slack Alert ─────────────────────────────────────────────────────────────

async function sendSlackAlert(entry) {
    try {
        // Deduplication: skip if same action sent within cooldown
        const dedupeKey = `${entry.action}:${entry.message?.substring(0, 80)}`
        const lastSent = _slackSent.get(dedupeKey)
        if (lastSent && Date.now() - lastSent < SLACK_COOLDOWN) return
        _slackSent.set(dedupeKey, Date.now())

        // Clean old entries from dedup map
        if (_slackSent.size > 100) {
            const cutoff = Date.now() - SLACK_COOLDOWN
            for (const [k, v] of _slackSent) {
                if (v < cutoff) _slackSent.delete(k)
            }
        }

        await supabase.functions.invoke('slack-error-alert', {
            body: {
                level: entry.level,
                category: entry.category,
                action: entry.action,
                message: entry.message,
                module: entry.module,
                user_email: entry.user_email || _userMeta.user_email,
                user_name: entry.user_name || _userMeta.user_name,
                path: entry.path || currentPath(),
                details: entry.details,
                error_code: entry.error_code,
            }
        })
    } catch (e) {
        // Silent fail — Slack alert is non-critical
        console.warn('[AuditLog] Slack alert failed:', e.message)
    }
}

// ─── Public API ──────────────────────────────────────────────────────────────

export const auditLog = {
    /** Set the current user context. Call this on login / auth change. */
    setUser({ id, email, name }) {
        _userMeta = { user_id: id || null, user_email: email || null, user_name: name || null }
    },

    /** Clear user context on logout */
    clearUser() {
        _userMeta = { user_id: null, user_email: null, user_name: null }
    },

    /** Force flush pending logs (call before page unload) */
    flush,

    /** Info-level log */
    info(category, action, message, { module, details, ...rest } = {}) {
        enqueue({ level: 'info', category, action, message, module, details, ...rest })
    },

    /** Warning-level log */
    warn(category, action, message, { module, details, ...rest } = {}) {
        enqueue({ level: 'warning', category, action, message, module, details, ...rest })
    },

    /** Error-level log */
    error(category, action, message, { module, details, error_code, ...rest } = {}) {
        enqueue({ level: 'error', category, action, message, module, details, error_code, ...rest })
    },

    /** Debug-level log */
    debug(category, action, message, { module, details, ...rest } = {}) {
        enqueue({ level: 'debug', category, action, message, module, details, ...rest })
    },
}

// ─── Global error handlers ───────────────────────────────────────────────────

export function initGlobalErrorCapture() {
    // Unhandled JS errors
    window.addEventListener('error', (event) => {
        // Ignore benign browser warnings that are not real errors
        if (event.message?.includes('ResizeObserver loop')) return

        auditLog.error('system', 'js.unhandled_error', event.message || 'Unhandled error', {
            details: serializeError(event.error),
            module: event.filename ? `${event.filename}:${event.lineno}:${event.colno}` : undefined,
        })
    })

    // Unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
        const reason = event.reason
        auditLog.error('system', 'promise.unhandled_rejection', reason?.message || String(reason), {
            details: serializeError(reason),
        })
    })

    // Flush on page unload
    window.addEventListener('beforeunload', () => {
        flush()
    })

    // Also flush on visibility change (tab hide)
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
            flush()
        }
    })
}

// ─── Supabase error interceptor ──────────────────────────────────────────────
// Wraps common supabase operations to auto-log errors

export function logSupabaseError(operation, table, error, extraDetails = {}) {
    if (!error) return
    auditLog.error('api', `supabase.${operation}.${table}`, error.message, {
        error_code: error.code,
        details: {
            ...serializeError(error),
            table,
            operation,
            ...extraDetails,
        },
    })
}
