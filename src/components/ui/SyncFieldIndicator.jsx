import React, { useState } from 'react'
import { RefreshCw, X } from 'lucide-react'

/**
 * SyncFieldIndicator — shows a sync icon next to a form label when:
 *  1. A CRM contact was selected (contactId is truthy)
 *  2. The original contact field was empty (field is in emptyFields list)
 *  3. The current form value is non-empty
 *  4. The field has not been excluded by the agent
 *
 * Props:
 *  - contactId: string — the CRM contact ID (from _crm*ContactId)
 *  - fieldName: string — the contact column name (e.g. 'rut', 'email')
 *  - emptyFields: string[] — list of fields that were empty in the original contact
 *  - currentValue: string — the current form field value
 *  - excludedFields: string[] — fields the agent has opted out of syncing
 *  - onExclude: (fieldName) => void — callback to add field to exclusion list
 *  - children: ReactNode — the label content
 */
export default function SyncFieldIndicator({
    contactId,
    fieldName,
    emptyFields = [],
    currentValue,
    excludedFields = [],
    onExclude,
    children
}) {
    const [showTooltip, setShowTooltip] = useState(false)

    const shouldShow =
        contactId &&
        emptyFields.includes(fieldName) &&
        !excludedFields.includes(fieldName) &&
        currentValue &&
        String(currentValue).trim().length > 0

    return (
        <div className="flex items-center gap-1.5">
            {children}
            {shouldShow && (
                <div
                    className="relative flex items-center gap-0.5"
                    onMouseEnter={() => setShowTooltip(true)}
                    onMouseLeave={() => setShowTooltip(false)}
                >
                    <div className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-blue-50 border border-blue-200 text-blue-600 cursor-default">
                        <RefreshCw className="w-3 h-3 animate-[spin_3s_linear_infinite]" />
                        <span className="text-[10px] font-medium hidden sm:inline">sync</span>
                        <button
                            type="button"
                            onClick={(e) => {
                                e.preventDefault()
                                e.stopPropagation()
                                onExclude?.(fieldName)
                            }}
                            className="ml-0.5 p-0 rounded-full hover:bg-blue-200/60 transition-colors"
                            title="No sincronizar este campo"
                        >
                            <X className="w-3 h-3" />
                        </button>
                    </div>

                    {/* Tooltip */}
                    {showTooltip && (
                        <div className="absolute left-0 bottom-full mb-2 z-50 w-56 p-2.5 rounded-lg bg-slate-900 text-white text-xs leading-relaxed shadow-lg pointer-events-none">
                            <p>Esta info no está en el contacto del CRM. Se cargará automáticamente al contacto una vez enviada la solicitud.</p>
                            <p className="mt-1 text-slate-400 text-[10px]">Haz clic en ✕ para no sincronizar.</p>
                            <div className="absolute left-4 top-full w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-slate-900" />
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
