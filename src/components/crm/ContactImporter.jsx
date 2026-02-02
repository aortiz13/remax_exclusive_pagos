
import { useState, useRef } from 'react'
import { Button, Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, Input, Label, Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui'
import { Upload, FileSpreadsheet, AlertCircle, Check, Loader2, X } from 'lucide-react'
import { supabase } from '../../services/supabase'
import { useAuth } from '../../context/AuthContext'
import ExcelJS from 'exceljs'
import { toast } from 'sonner'

const ContactImporter = ({ isOpen, onClose, onSuccess }) => {
    const { user } = useAuth()
    const [step, setStep] = useState(1) // 1: Upload, 2: Map/Preview, 3: Importing
    const [file, setFile] = useState(null)
    const [headers, setHeaders] = useState([])
    const [rows, setRows] = useState([])
    const [mapping, setMapping] = useState({
        first_name: '',
        last_name: '',
        email: '',
        phone: '',
        profession: '',
        address: '',
        comuna: '',
        need: 'Comprar' // Default value logic for unmapped
    })
    const [loading, setLoading] = useState(false)
    const fileInputRef = useRef(null)

    const requiredFields = [
        { id: 'first_name', label: 'Nombre' },
        { id: 'last_name', label: 'Apellido' },
        { id: 'email', label: 'Correo' },
        { id: 'phone', label: 'Teléfono' },
    ]

    const optionalFields = [
        { id: 'profession', label: 'Profesión' },
        { id: 'address', label: 'Dirección' },
        { id: 'comuna', label: 'Comuna' },
        { id: 'need', label: 'Necesidad (Def: Comprar)' },
    ]

    const handleFileChange = async (e) => {
        const selectedFile = e.target.files[0]
        if (!selectedFile) return

        setFile(selectedFile)
        setLoading(true)
        try {
            const workbook = new ExcelJS.Workbook()
            await workbook.xlsx.load(await selectedFile.arrayBuffer())
            const worksheet = workbook.getWorksheet(1)

            const fileHeaders = []
            const fileRows = []

            worksheet.eachRow((row, rowNumber) => {
                if (rowNumber === 1) {
                    row.eachCell((cell, colNumber) => {
                        fileHeaders.push({ col: colNumber, label: cell.value?.toString() || `Col ${colNumber}` })
                    })
                } else if (rowNumber <= 6) { // Preview first 5 rows
                    const rowData = {}
                    row.eachCell((cell, colNumber) => {
                        rowData[colNumber] = cell.value?.toString() || ''
                    })
                    fileRows.push(rowData)
                }
            })

            setHeaders(fileHeaders)
            setRows(fileRows)

            // Auto-map based on similar names
            const newMapping = { ...mapping }
            fileHeaders.forEach(h => {
                const label = h.label.toLowerCase()
                if (label.includes('nombre') || label.includes('first')) newMapping.first_name = h.col
                if (label.includes('apellido') || label.includes('last')) newMapping.last_name = h.col
                if (label.includes('mail')) newMapping.email = h.col
                if (label.includes('telef') || label.includes('celular') || label.includes('phone')) newMapping.phone = h.col
                if (label.includes('profesion')) newMapping.profession = h.col
                if (label.includes('direc') || label.includes('address')) newMapping.address = h.col
                if (label.includes('comuna')) newMapping.comuna = h.col
            })
            setMapping(newMapping)
            setStep(2)

        } catch (error) {
            console.error(error)
            toast.error("Error al leer el archivo. Asegúrate que sea un Excel válido.")
        } finally {
            setLoading(false)
        }
    }

    const handleImport = async () => {
        // Validate mapping
        const missing = requiredFields.filter(f => !mapping[f.id])
        if (missing.length > 0) {
            toast.error(`Faltan campos obligatorios por mapear: ${missing.map(m => m.label).join(', ')}`)
            return
        }

        setLoading(true)
        try {
            const workbook = new ExcelJS.Workbook()
            await workbook.xlsx.load(await file.arrayBuffer())
            const worksheet = workbook.getWorksheet(1)

            const contactsToInsert = []

            worksheet.eachRow((row, rowNumber) => {
                if (rowNumber === 1) return // Skip header

                const contact = {
                    first_name: row.getCell(Number(mapping.first_name)).value?.toString() || '',
                    last_name: row.getCell(Number(mapping.last_name)).value?.toString() || '',
                    email: row.getCell(Number(mapping.email)).value?.toString() || null,
                    phone: row.getCell(Number(mapping.phone)).value?.toString() || null,
                    profession: mapping.profession ? row.getCell(Number(mapping.profession)).value?.toString() : null,
                    address: mapping.address ? row.getCell(Number(mapping.address)).value?.toString() : null,
                    barrio_comuna: mapping.comuna ? row.getCell(Number(mapping.comuna)).value?.toString() : null,
                    need: mapping.need && typeof mapping.need === 'number' ? row.getCell(Number(mapping.need)).value?.toString() : 'Comprar',
                    status: 'Activo',
                    user_id: user?.id
                }

                // Basic validation
                if (contact.first_name && contact.last_name) {
                    contactsToInsert.push(contact)
                }
            })

            console.log("Importing", contactsToInsert.length, "contacts")

            // Batch insert
            const { error } = await supabase.from('contacts').insert(contactsToInsert)
            if (error) throw error

            toast.success(`${contactsToInsert.length} contactos importados exitosamente!`)
            onClose()
            onSuccess()

        } catch (error) {
            console.error('Import error:', error)
            toast.error('Error al importar contactos. Revisa la consola para más detalles.')
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                    <DialogTitle>Importar Contactos</DialogTitle>
                    <DialogDescription>
                        Carga un archivo Excel (.xlsx) con tsus contactos.
                    </DialogDescription>
                </DialogHeader>

                {step === 1 && (
                    <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-slate-200 rounded-xl space-y-4">
                        <div className="bg-blue-50 p-4 rounded-full">
                            <FileSpreadsheet className="w-8 h-8 text-blue-500" />
                        </div>
                        <div className="text-center">
                            <p className="text-sm font-medium">Arrastra tu archivo aquí o</p>
                            <Button variant="link" onClick={() => fileInputRef.current?.click()} className="text-blue-600">
                                selecciona un archivo
                            </Button>
                            <input
                                type="file"
                                accept=".xlsx, .xls"
                                className="hidden"
                                ref={fileInputRef}
                                onChange={handleFileChange}
                            />
                        </div>
                        <p className="text-xs text-slate-400">Archivos soportados: .xlsx</p>
                    </div>
                )}

                {step === 2 && (
                    <div className="space-y-4">
                        <div className="bg-slate-50 p-3 rounded-md text-sm flex items-center gap-2">
                            <FileSpreadsheet className="w-4 h-4" />
                            <span className="font-medium truncate">{file?.name}</span>
                            <span className="text-slate-400 ml-auto">{(file?.size / 1024).toFixed(1)} KB</span>
                            <Button variant="ghost" size="icon" className="h-6 w-6 ml-2" onClick={() => { setStep(1); setFile(null); }}>
                                <X className="w-3 h-3" />
                            </Button>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <h4 className="font-semibold text-sm">Campos Obligatorios</h4>
                                {requiredFields.map(field => (
                                    <div key={field.id} className="grid grid-cols-3 items-center gap-2">
                                        <Label className="text-xs col-span-1">{field.label} *</Label>
                                        <select
                                            className="col-span-2 text-xs h-8 border rounded px-2"
                                            value={mapping[field.id]}
                                            onChange={(e) => setMapping({ ...mapping, [field.id]: e.target.value })}
                                        >
                                            <option value="">Seleccionar Columna...</option>
                                            {headers.map(h => (
                                                <option key={h.col} value={h.col}>{h.label}</option>
                                            ))}
                                        </select>
                                    </div>
                                ))}
                            </div>
                            <div className="space-y-2">
                                <h4 className="font-semibold text-sm">Opcionales</h4>
                                {optionalFields.map(field => (
                                    <div key={field.id} className="grid grid-cols-3 items-center gap-2">
                                        <Label className="text-xs col-span-1">{field.label}</Label>
                                        <select
                                            className="col-span-2 text-xs h-8 border rounded px-2"
                                            value={mapping[field.id]}
                                            onChange={(e) => setMapping({ ...mapping, [field.id]: e.target.value })}
                                        >
                                            <option value="">Ignorar</option>
                                            {headers.map(h => (
                                                <option key={h.col} value={h.col}>{h.label}</option>
                                            ))}
                                        </select>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>Cancelar</Button>
                    {step === 2 && (
                        <Button onClick={handleImport} disabled={loading}>
                            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            Importar Contactos
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

export default ContactImporter
