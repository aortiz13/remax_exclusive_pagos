import { useState, useRef, useCallback } from 'react'
import {
    Button, Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
    DialogFooter
} from '@/components/ui'
import {
    Upload, FileSpreadsheet, Check, Loader2, X, ChevronRight,
    AlertCircle, ArrowRight, CheckCircle2, Link2, Info, Eye
} from 'lucide-react'
import { supabase } from '../../services/supabase'
import { useAuth } from '../../context/AuthContext'
import ExcelJS from 'exceljs'
import { toast } from 'sonner'
import { logActivity } from '../../services/activityService'

// ─── CRM Field Definitions ────────────────────────────────────────────────────
const CRM_FIELDS = [
    // Required
    { id: 'first_name', label: 'Nombre', required: true, group: 'Básico', hint: 'Ej: Juan' },
    { id: 'last_name', label: 'Apellido', required: true, group: 'Básico', hint: 'Ej: Pérez' },
    // Contact
    { id: 'email', label: 'Correo', required: false, group: 'Contacto', hint: 'Ej: juan@mail.com' },
    { id: 'phone', label: 'Teléfono', required: false, group: 'Contacto', hint: 'Ej: +56912345678' },
    { id: 'phone_2', label: 'Teléfono 2', required: false, group: 'Contacto', hint: 'Teléfono alternativo' },
    // Personal
    { id: 'profession', label: 'Profesión', required: false, group: 'Personal', hint: 'Ej: Médico' },
    { id: 'birthday', label: 'Cumpleaños', required: false, group: 'Personal', hint: 'Ej: 1985-04-20' },
    // Location
    { id: 'address', label: 'Dirección', required: false, group: 'Ubicación', hint: 'Calle y número' },
    { id: 'barrio_comuna', label: 'Comuna/Barrio', required: false, group: 'Ubicación', hint: 'Ej: Providencia' },
    { id: 'city', label: 'Ciudad', required: false, group: 'Ubicación', hint: 'Ej: Santiago' },
    // CRM
    { id: 'status', label: 'Estado', required: false, group: 'CRM', hint: 'Activo / Inactivo (def: Activo)' },
    { id: 'source', label: 'Fuente', required: false, group: 'CRM', hint: 'Ej: Referido, Web' },
    { id: 'need', label: 'Necesidad', required: false, group: 'CRM', hint: 'Comprar / Vender / Arrendar (def: Comprar)' },
    { id: 'rating', label: 'Clasificación (A+)', required: false, group: 'CRM', hint: 'Ej: A+, B, C' },
    { id: 'rating_80_20', label: 'Rating 80/20', required: false, group: 'CRM', hint: 'Ej: Estrella, Clave' },
    { id: 'notes', label: 'Notas', required: false, group: 'CRM', hint: 'Observaciones generales' },
]

// Auto-mapping keywords
const AUTO_MAP_RULES = [
    { id: 'first_name', keywords: ['nombre', 'first', 'name', 'firstname'] },
    { id: 'last_name', keywords: ['apellido', 'last', 'lastname', 'surname'] },
    { id: 'email', keywords: ['mail', 'correo', 'email'] },
    { id: 'phone', keywords: ['telef', 'celular', 'phone', 'movil', 'fono', 'cel'] },
    { id: 'phone_2', keywords: ['telef2', 'phone2', 'celular2', 'alternativo'] },
    { id: 'profession', keywords: ['profesion', 'profession', 'trabajo', 'ocupacion'] },
    { id: 'birthday', keywords: ['cumple', 'birthday', 'nacimiento', 'fecha_nac'] },
    { id: 'address', keywords: ['direc', 'address', 'calle', 'domicilio'] },
    { id: 'barrio_comuna', keywords: ['comuna', 'barrio', 'sector', 'neighborhood'] },
    { id: 'city', keywords: ['ciudad', 'city', 'localidad'] },
    { id: 'status', keywords: ['estado', 'status', 'activo'] },
    { id: 'source', keywords: ['fuente', 'source', 'origen', 'canal'] },
    { id: 'need', keywords: ['necesidad', 'need', 'interes'] },
    { id: 'rating', keywords: ['calificacion', 'clasificacion', 'rating', 'puntuacion'] },
    { id: 'rating_80_20', keywords: ['8020', '80_20', 'pareto'] },
    { id: 'notes', keywords: ['nota', 'note', 'observ', 'comentario', 'comment'] },
]

// ─── Step Indicator ───────────────────────────────────────────────────────────
const StepIndicator = ({ currentStep }) => {
    const steps = [
        { n: 1, label: 'Subir Archivo' },
        { n: 2, label: 'Mapear Columnas' },
        { n: 3, label: 'Importar' },
    ]
    return (
        <div className="flex items-center justify-center gap-0 mb-6">
            {steps.map((s, i) => (
                <div key={s.n} className="flex items-center">
                    <div className="flex flex-col items-center gap-1">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300 ${currentStep > s.n
                            ? 'bg-emerald-500 text-white shadow-md shadow-emerald-200'
                            : currentStep === s.n
                                ? 'bg-blue-600 text-white shadow-md shadow-blue-200'
                                : 'bg-slate-100 text-slate-400'
                            }`}>
                            {currentStep > s.n ? <Check className="w-4 h-4" /> : s.n}
                        </div>
                        <span className={`text-xs font-medium whitespace-nowrap ${currentStep >= s.n ? 'text-slate-700' : 'text-slate-400'
                            }`}>{s.label}</span>
                    </div>
                    {i < steps.length - 1 && (
                        <div className={`w-16 h-0.5 mx-1 mb-4 transition-all duration-300 ${currentStep > s.n ? 'bg-emerald-400' : 'bg-slate-200'
                            }`} />
                    )}
                </div>
            ))}
        </div>
    )
}

// ─── Mapping Badge ─────────────────────────────────────────────────────────────
const MappingBadge = ({ mapped }) =>
    mapped
        ? <span className="inline-flex items-center gap-1 text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full px-2 py-0.5"><Check className="w-3 h-3" /> Mapeado</span>
        : <span className="inline-flex items-center gap-1 text-xs bg-slate-50 text-slate-400 border border-slate-200 rounded-full px-2 py-0.5">Sin mapear</span>

// ─── Main Component ────────────────────────────────────────────────────────────
const ContactImporter = ({ isOpen, onClose, onSuccess }) => {
    const { user } = useAuth()
    const [step, setStep] = useState(1)
    const [file, setFile] = useState(null)
    const [headers, setHeaders] = useState([])
    const [previewRows, setPreviewRows] = useState([])
    const [allRows, setAllRows] = useState([])
    const [mapping, setMapping] = useState({})
    const [loading, setLoading] = useState(false)
    const [isDragging, setIsDragging] = useState(false)
    const [importProgress, setImportProgress] = useState(0)
    const [importResult, setImportResult] = useState(null)
    const [activeGroup, setActiveGroup] = useState('Todos')
    const [showPreview, setShowPreview] = useState(false)
    const fileInputRef = useRef(null)

    const groups = ['Todos', ...new Set(CRM_FIELDS.map(f => f.group))]

    const resetState = () => {
        setStep(1); setFile(null); setHeaders([]); setPreviewRows([])
        setAllRows([]); setMapping({}); setLoading(false)
        setImportProgress(0); setImportResult(null); setShowPreview(false)
    }

    const handleClose = () => { resetState(); onClose() }

    // ── File Processing ─────────────────────────────────────────────────────
    const processFile = useCallback(async (selectedFile) => {
        if (!selectedFile) return
        setFile(selectedFile)
        setLoading(true)
        try {
            const workbook = new ExcelJS.Workbook()
            await workbook.xlsx.load(await selectedFile.arrayBuffer())
            const worksheet = workbook.getWorksheet(1)

            const fileHeaders = []
            const filePreviewRows = []
            const fileAllRows = []

            worksheet.eachRow((row, rowNumber) => {
                if (rowNumber === 1) {
                    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
                        fileHeaders.push({
                            col: colNumber,
                            label: cell.value?.toString()?.trim() || `Columna ${colNumber}`
                        })
                    })
                } else {
                    const rowData = {}
                    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
                        rowData[colNumber] = cell.value?.toString()?.trim() || ''
                    })
                    if (rowNumber <= 6) filePreviewRows.push(rowData)
                    fileAllRows.push({ rowData, rowNumber })
                }
            })

            setHeaders(fileHeaders)
            setPreviewRows(filePreviewRows)
            setAllRows(fileAllRows)

            // Auto-map
            const autoMap = {}
            fileHeaders.forEach(h => {
                const labelLow = h.label.toLowerCase().replace(/[_\s-]/g, '')
                AUTO_MAP_RULES.forEach(rule => {
                    if (!autoMap[rule.id]) {
                        if (rule.keywords.some(kw => labelLow.includes(kw))) {
                            autoMap[rule.id] = h.col
                        }
                    }
                })
            })
            setMapping(autoMap)
            setStep(2)
        } catch (err) {
            console.error(err)
            toast.error('Error al leer el archivo. ¿Es un Excel válido (.xlsx)?')
        } finally {
            setLoading(false)
        }
    }, [])

    const handleFileChange = (e) => processFile(e.target.files[0])

    const handleDrop = (e) => {
        e.preventDefault(); setIsDragging(false)
        const f = e.dataTransfer.files[0]
        if (f && (f.name.endsWith('.xlsx') || f.name.endsWith('.xls'))) processFile(f)
        else toast.error('Por favor sube un archivo Excel (.xlsx)')
    }

    // ── Import ──────────────────────────────────────────────────────────────
    const handleImport = async () => {
        const missingRequired = CRM_FIELDS.filter(f => f.required && !mapping[f.id])
        if (missingRequired.length > 0) {
            toast.error(`Faltan campos obligatorios: ${missingRequired.map(f => f.label).join(', ')}`)
            return
        }

        setLoading(true)
        setStep(3)
        setImportProgress(0)

        try {
            const contactsToInsert = []

            allRows.forEach(({ rowData }) => {
                const contact = { status: 'Activo', agent_id: user?.id }
                CRM_FIELDS.forEach(field => {
                    if (mapping[field.id]) {
                        const val = rowData[mapping[field.id]]?.toString().trim()
                        if (val) contact[field.id] = val
                    }
                })
                // Defaults
                if (!contact.need) contact.need = 'Comprar'
                if (!contact.status) contact.status = 'Activo'
                if (contact.first_name && contact.last_name) contactsToInsert.push(contact)
            })

            if (contactsToInsert.length === 0) {
                toast.error('No se encontraron filas válidas para importar.')
                setLoading(false); setStep(2); return
            }

            // Batch insert in chunks of 100
            const CHUNK = 100
            let inserted = 0
            for (let i = 0; i < contactsToInsert.length; i += CHUNK) {
                const chunk = contactsToInsert.slice(i, i + CHUNK)
                const { error } = await supabase.from('contacts').insert(chunk)
                if (error) throw error
                inserted += chunk.length
                setImportProgress(Math.round((inserted / contactsToInsert.length) * 100))
                await new Promise(r => setTimeout(r, 50)) // small delay for UX
            }

            setImportResult({ total: contactsToInsert.length, success: inserted })
            toast.success(`¡${inserted} contactos importados exitosamente!`)

            // Log bulk import to timeline
            logActivity({
                action: 'Importación',
                entity_type: 'Contacto',
                entity_id: null,
                description: `Importación masiva: ${inserted} contactos importados desde Excel`,
                details: { count: inserted, filename: file?.name }
            }).catch(() => { })

            onSuccess()
        } catch (err) {
            console.error('Import error:', err)
            toast.error('Error al importar. Revisa los datos e intenta de nuevo.')
            setStep(2)
        } finally {
            setLoading(false)
        }
    }

    // ── Helpers ─────────────────────────────────────────────────────────────
    const getMappedFieldsCount = () => Object.values(mapping).filter(Boolean).length

    const getFilteredFields = () =>
        activeGroup === 'Todos' ? CRM_FIELDS : CRM_FIELDS.filter(f => f.group === activeGroup)

    const fieldsByGroup = CRM_FIELDS.reduce((acc, f) => {
        if (!acc[f.group]) acc[f.group] = []
        acc[f.group].push(f)
        return acc
    }, {})

    // ── RENDER ───────────────────────────────────────────────────────────────
    return (
        <Dialog open={isOpen} onOpenChange={handleClose}>
            <DialogContent
                className="sm:max-w-[780px] max-h-[92vh] overflow-y-auto"
                onWheel={e => e.stopPropagation()}
            >
                <DialogHeader>
                    <DialogTitle className="text-xl font-bold flex items-center gap-2">
                        <FileSpreadsheet className="w-5 h-5 text-blue-600" />
                        Importar Contactos
                    </DialogTitle>
                    <DialogDescription className="text-sm">
                        Importa tus contactos desde un archivo Excel y mapea las columnas.
                    </DialogDescription>
                </DialogHeader>

                <StepIndicator currentStep={step} />

                {/* ── STEP 1: Upload ─────────────────────────────────────── */}
                {step === 1 && (
                    <div className="space-y-4">
                        <div
                            className={`flex flex-col items-center justify-center p-10 border-2 border-dashed rounded-2xl transition-all cursor-pointer group ${isDragging
                                ? 'border-blue-500 bg-blue-50'
                                : 'border-slate-200 hover:border-blue-400 hover:bg-slate-50'
                                }`}
                            onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
                            onDragLeave={() => setIsDragging(false)}
                            onDrop={handleDrop}
                            onClick={() => fileInputRef.current?.click()}
                        >
                            <div className={`p-5 rounded-full mb-4 transition-all ${isDragging ? 'bg-blue-100' : 'bg-slate-100 group-hover:bg-blue-50'
                                }`}>
                                {loading
                                    ? <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
                                    : <Upload className={`w-10 h-10 transition-colors ${isDragging ? 'text-blue-500' : 'text-slate-400 group-hover:text-blue-500'}`} />
                                }
                            </div>
                            <p className="text-base font-semibold text-slate-700 mb-1">
                                {isDragging ? '¡Suelta el archivo aquí!' : 'Arrastra tu Excel aquí'}
                            </p>
                            <p className="text-sm text-slate-400 mb-3">o haz clic para seleccionar</p>
                            <Button
                                variant="outline"
                                size="sm"
                                className="pointer-events-none bg-white border-blue-200 text-blue-600 font-medium"
                                onClick={e => { e.stopPropagation(); fileInputRef.current?.click() }}
                            >
                                Seleccionar archivo
                            </Button>
                            <input
                                type="file" accept=".xlsx,.xls" className="hidden"
                                ref={fileInputRef} onChange={handleFileChange}
                            />
                        </div>

                        {/* Tips */}
                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3">
                            <Info className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                            <div className="text-sm text-amber-800 space-y-1">
                                <p className="font-semibold">Consejos para una importación exitosa:</p>
                                <ul className="list-disc list-inside text-xs text-amber-700 space-y-0.5">
                                    <li>La <strong>primera fila</strong> debe contener los nombres de columnas (encabezados)</li>
                                    <li>Los campos mínimos requeridos son <strong>Nombre</strong> y <strong>Apellido</strong></li>
                                    <li>El sistema detecta automáticamente columnas comunes como "email", "teléfono", etc.</li>
                                    <li>Formatos soportados: <strong>.xlsx</strong></li>
                                </ul>
                            </div>
                        </div>
                    </div>
                )}

                {/* ── STEP 2: Mapping ────────────────────────────────────── */}
                {step === 2 && (
                    <div className="space-y-4">
                        {/* File info bar */}
                        <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-xl p-3">
                            <div className="bg-green-100 p-2 rounded-lg">
                                <FileSpreadsheet className="w-5 h-5 text-green-600" />
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="text-sm font-semibold text-slate-800 truncate">{file?.name}</p>
                                <p className="text-xs text-slate-500">
                                    {allRows.length} filas · {headers.length} columnas detectadas ·
                                    <span className="text-blue-600 font-medium ml-1">{getMappedFieldsCount()} campos mapeados</span>
                                </p>
                            </div>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-red-500"
                                onClick={() => { setStep(1); setFile(null) }}
                            >
                                <X className="w-4 h-4" />
                            </Button>
                        </div>

                        {/* Auto-map banner */}
                        {getMappedFieldsCount() > 0 && (
                            <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-sm text-emerald-700">
                                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                                <span>
                                    <strong>{getMappedFieldsCount()} columnas</strong> mapeadas automáticamente.
                                    Puedes ajustarlas a continuación.
                                </span>
                            </div>
                        )}

                        {/* Column mapping header */}
                        <div className="flex items-center justify-between">
                            <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                                <Link2 className="w-4 h-4 text-blue-500" />
                                Mapear Columnas
                            </h3>
                            <Button
                                variant="ghost" size="sm"
                                className="text-xs text-blue-600 hover:text-blue-700 gap-1"
                                onClick={() => setShowPreview(!showPreview)}
                            >
                                <Eye className="w-3 h-3" />
                                {showPreview ? 'Ocultar vista previa' : 'Ver datos del archivo'}
                            </Button>
                        </div>

                        {/* Data Preview */}
                        {showPreview && previewRows.length > 0 && (
                            <div className="w-full min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white">
                                <div className="overflow-x-auto">
                                    <table className="table-fixed text-xs" style={{ width: '100%', minWidth: 0 }}>
                                        <colgroup>
                                            {headers.map(h => (
                                                <col key={h.col} style={{ width: `${Math.floor(100 / headers.length)}%` }} />
                                            ))}
                                        </colgroup>
                                        <thead className="bg-slate-50">
                                            <tr>
                                                {headers.map(h => (
                                                    <th key={h.col} className="px-2 py-2 text-left font-semibold text-slate-600 border-b border-slate-200 truncate overflow-hidden">
                                                        <span className="block truncate">{h.label}</span>
                                                    </th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {previewRows.map((row, ri) => (
                                                <tr key={ri} className={ri % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                                                    {headers.map(h => (
                                                        <td key={h.col} className="px-2 py-2 text-slate-600 border-b border-slate-100 overflow-hidden">
                                                            <span className="block truncate">
                                                                {row[h.col] || <span className="text-slate-300 italic">—</span>}
                                                            </span>
                                                        </td>
                                                    ))}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                <p className="text-center text-xs text-slate-400 py-2 border-t border-slate-100">
                                    Mostrando las primeras {previewRows.length} filas
                                </p>
                            </div>
                        )}

                        {/* Group filter tabs */}
                        <div className="flex flex-wrap gap-1.5">
                            {groups.map(g => (
                                <button
                                    key={g}
                                    onClick={() => setActiveGroup(g)}
                                    className={`text-xs px-3 py-1.5 rounded-full font-medium transition-all ${activeGroup === g
                                        ? 'bg-blue-600 text-white shadow-sm'
                                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                        }`}
                                >
                                    {g}
                                    {g !== 'Todos' && fieldsByGroup[g] && (
                                        <span className="ml-1 opacity-70">
                                            ({fieldsByGroup[g].filter(f => mapping[f.id]).length}/{fieldsByGroup[g].length})
                                        </span>
                                    )}
                                </button>
                            ))}
                        </div>

                        {/* Mapping grid */}
                        <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1">
                            {getFilteredFields().map(field => {
                                const isMapped = !!mapping[field.id]
                                const sampleValue = isMapped && previewRows[0]
                                    ? previewRows[0][Number(mapping[field.id])]
                                    : null

                                return (
                                    <div key={field.id}
                                        className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${isMapped
                                            ? 'bg-emerald-50/60 border-emerald-200'
                                            : field.required
                                                ? 'bg-red-50/40 border-red-200'
                                                : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                                            }`}
                                    >
                                        {/* Field label */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-0.5">
                                                <span className="text-sm font-semibold text-slate-800">
                                                    {field.label}
                                                </span>
                                                {field.required && (
                                                    <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full font-medium">
                                                        Obligatorio
                                                    </span>
                                                )}
                                                <MappingBadge mapped={isMapped} />
                                            </div>
                                            <p className="text-xs text-slate-400">{field.hint}</p>
                                            {sampleValue && (
                                                <p className="text-xs text-blue-600 mt-1 truncate">
                                                    <span className="text-slate-400">Ejemplo: </span>"{sampleValue}"
                                                </p>
                                            )}
                                        </div>

                                        {/* Arrow icon */}
                                        <ArrowRight className="w-4 h-4 text-slate-300 shrink-0" />

                                        {/* Column selector */}
                                        <div className="w-48 shrink-0">
                                            <select
                                                className={`w-full text-xs h-9 border rounded-lg px-2 pr-6 bg-white transition-all appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-300 ${isMapped
                                                    ? 'border-emerald-300 text-slate-800'
                                                    : field.required
                                                        ? 'border-red-300 text-slate-500'
                                                        : 'border-slate-200 text-slate-500 hover:border-slate-300'
                                                    }`}
                                                value={mapping[field.id] || ''}
                                                onChange={e => setMapping({
                                                    ...mapping,
                                                    [field.id]: e.target.value ? Number(e.target.value) : ''
                                                })}
                                            >
                                                <option value="">— Ignorar —</option>
                                                {headers.map(h => (
                                                    <option key={h.col} value={h.col}>
                                                        {h.label}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>

                        {/* Summary badge */}
                        <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm">
                            <span className="text-slate-500">
                                Contactos listos para importar:
                            </span>
                            <span className="font-bold text-slate-800">{allRows.length.toLocaleString()}</span>
                        </div>
                    </div>
                )}

                {/* ── STEP 3: Progress / Result ──────────────────────────── */}
                {step === 3 && (
                    <div className="flex flex-col items-center justify-center py-10 space-y-6">
                        {!importResult ? (
                            <>
                                <div className="relative">
                                    <svg className="w-24 h-24 -rotate-90" viewBox="0 0 36 36">
                                        <circle cx="18" cy="18" r="15.9155" fill="none" stroke="#e2e8f0" strokeWidth="2.5" />
                                        <circle
                                            cx="18" cy="18" r="15.9155" fill="none"
                                            stroke="#2563eb" strokeWidth="2.5"
                                            strokeDasharray={`${importProgress} ${100 - importProgress}`}
                                            strokeLinecap="round"
                                            className="transition-all duration-300"
                                        />
                                    </svg>
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <span className="text-lg font-bold text-blue-600">{importProgress}%</span>
                                    </div>
                                </div>
                                <div className="text-center">
                                    <p className="text-base font-semibold text-slate-800">Importando contactos...</p>
                                    <p className="text-sm text-slate-400 mt-1">Esto puede tomar unos segundos</p>
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center">
                                    <CheckCircle2 className="w-10 h-10 text-emerald-500" />
                                </div>
                                <div className="text-center">
                                    <p className="text-xl font-bold text-slate-800">¡Importación exitosa!</p>
                                    <p className="text-4xl font-extrabold text-blue-600 my-2">
                                        {importResult.success.toLocaleString()}
                                    </p>
                                    <p className="text-sm text-slate-500">contactos importados al CRM</p>
                                </div>
                                <Button onClick={handleClose} className="gap-2 px-6">
                                    <Check className="w-4 h-4" />
                                    Ver Contactos
                                </Button>
                            </>
                        )}
                    </div>
                )}

                {/* ── Footer ──────────────────────────────────────────────── */}
                {step !== 3 && (
                    <DialogFooter className="pt-2 flex gap-2 items-center">
                        <Button variant="outline" onClick={handleClose} className="mr-auto">
                            Cancelar
                        </Button>
                        {step === 2 && (
                            <>
                                <div className="text-xs text-slate-400">
                                    {CRM_FIELDS.filter(f => f.required && !mapping[f.id]).length > 0 && (
                                        <span className="text-red-500 flex items-center gap-1">
                                            <AlertCircle className="w-3 h-3" />
                                            Faltan campos obligatorios
                                        </span>
                                    )}
                                </div>
                                <Button
                                    onClick={handleImport}
                                    disabled={loading || CRM_FIELDS.filter(f => f.required && !mapping[f.id]).length > 0}
                                    className="gap-2 bg-blue-600 hover:bg-blue-700"
                                >
                                    {loading
                                        ? <Loader2 className="w-4 h-4 animate-spin" />
                                        : <ChevronRight className="w-4 h-4" />
                                    }
                                    Importar {allRows.length} Contactos
                                </Button>
                            </>
                        )}
                    </DialogFooter>
                )}
            </DialogContent>
        </Dialog>
    )
}

export default ContactImporter
