import { useState, useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { supabase } from '../services/supabase'
import { Button, Input, Label, Card, CardHeader, CardTitle, CardContent, CardFooter, CardDescription, Alert, AlertDescription, Badge, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui'
import { useAuth } from '../context/AuthContext'
import { Navigate } from 'react-router-dom'
import { Trash2, Shield, User, Loader2, Upload, FileText, CheckCircle2, AlertCircle, X } from 'lucide-react'
import ExcelJS from 'exceljs'

export default function AdminInvites() {
    const { profile, loading: authLoading } = useAuth()
    const [loading, setLoading] = useState(false)
    const [email, setEmail] = useState('')
    const [firstName, setFirstName] = useState('')
    const [lastName, setLastName] = useState('')
    const [role, setRole] = useState('agent')

    // Users list state
    const [users, setUsers] = useState([])
    const [usersLoading, setUsersLoading] = useState(true)
    const [deleteLoading, setDeleteLoading] = useState(null) // ID of user being deleted
    const [userToDelete, setUserToDelete] = useState(null)
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)

    // Bulk Invite state
    const [csvFile, setCsvFile] = useState(null)
    const [csvData, setCsvData] = useState([])
    const [headers, setHeaders] = useState([])
    const [mapping, setMapping] = useState({
        email: '',
        firstName: '',
        lastName: '',
        role: ''
    })
    const [isBulkLoading, setIsBulkLoading] = useState(false)
    const [processingResults, setProcessingResults] = useState(null)
    const fileInputRef = useRef(null)

    useEffect(() => {
        if (profile?.role === 'admin') {
            fetchUsers()
        }
    }, [profile])


    const fetchUsers = async () => {
        try {
            setUsersLoading(true)
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .order('created_at', { ascending: false })

            if (error) throw error
            setUsers(data)
        } catch (error) {
            console.error('Error fetching users:', error)
            toast.error('Error al cargar usuarios')
        } finally {
            setUsersLoading(false)
        }
    }


    // Protect: Only admin
    if (!authLoading && profile?.role !== 'admin') {
        return <Navigate to="/dashboard" />
    }

    const handleInvite = async (e) => {
        e.preventDefault()
        setLoading(true)

        try {
            const { data, error } = await supabase.functions.invoke('invite-agent', {
                body: { email, firstName, lastName, role }
            })

            if (error) throw error

            toast.success('Invitación enviada correctamente')
            setEmail('')
            setFirstName('')
            setLastName('')
            setRole('agent')
            fetchUsers()

        } catch (error) {
            console.error('Error sending invite:', error)
            toast.error('Error al enviar invitación: ' + error.message)
        } finally {
            setLoading(false)
        }
    }

    const handleFileUpload = async (e) => {
        const file = e.target.files[0]
        if (!file) return

        setCsvFile(file)
        setProcessingResults(null)
        setCsvData([])
        setHeaders([])

        try {
            const reader = new FileReader()
            reader.onload = (event) => {
                const text = event.target.result
                const lines = text.split(/\r?\n/)
                if (lines.length === 0) return

                // Detect delimiter
                const firstLine = lines[0]
                const commaCount = (firstLine.match(/,/g) || []).length
                const semicolonCount = (firstLine.match(/;/g) || []).length
                const delimiter = semicolonCount > commaCount ? ';' : ','

                // Helper to parse CSV line handling quotes and dynamic delimiter
                const parseCSVLine = (line, delim) => {
                    const result = []
                    let startValueIndex = 0
                    let inQuotes = false
                    for (let i = 0; i < line.length; i++) {
                        if (line[i] === '"') inQuotes = !inQuotes
                        if (line[i] === delim && !inQuotes) {
                            result.push(line.substring(startValueIndex, i).replace(/^"|"$/g, '').trim())
                            startValueIndex = i + 1
                        }
                    }
                    result.push(line.substring(startValueIndex).replace(/^"|"$/g, '').trim())
                    return result
                }

                const headerRow = parseCSVLine(lines[0], delimiter).filter(h => h !== '')
                setHeaders(headerRow)

                const rows = []
                for (let i = 1; i < lines.length; i++) {
                    if (!lines[i].trim()) continue
                    const values = parseCSVLine(lines[i], delimiter)
                    const rowData = {}
                    headerRow.forEach((h, index) => {
                        rowData[h] = values[index] || ''
                    })
                    rows.push(rowData)
                }

                setCsvData(rows)

                // Auto-mapping attempt
                const newMapping = {
                    email: '',
                    firstName: '',
                    lastName: '',
                    role: ''
                }

                headerRow.forEach(h => {
                    const lowerH = h.toLowerCase()
                    if (lowerH.includes('correo') || lowerH.includes('email')) newMapping.email = h
                    if (lowerH.includes('nombre') || lowerH.includes('first')) newMapping.firstName = h
                    if (lowerH.includes('apellido') || lowerH.includes('last')) newMapping.lastName = h
                    if (lowerH.includes('rol') || lowerH.includes('role')) newMapping.role = h
                })
                setMapping(newMapping)
            }
            reader.readAsText(file)

        } catch (error) {
            console.error('Error parsing CSV:', error)
            toast.error('Error al procesar el archivo CSV')
        }
    }

    const handleBulkInvite = async () => {
        if (!mapping.email || !mapping.firstName || !mapping.lastName) {
            toast.error('Por favor mapea los campos obligatorios: Nombre, Apellido y Email')
            return
        }

        setIsBulkLoading(true)
        const results = { success: 0, error: 0, details: [] }

        for (const row of csvData) {
            const rowEmail = row[mapping.email]
            const rowFirstName = row[mapping.firstName]
            const rowLastName = row[mapping.lastName]
            const rowRole = (mapping.role && mapping.role !== 'none') ? (row[mapping.role]?.toLowerCase() === 'admin' ? 'admin' : 'agent') : 'agent'

            if (!rowEmail || !rowFirstName || !rowLastName) {
                results.error++
                results.details.push({ email: rowEmail || 'Sin email', status: 'missing_data' })
                continue
            }

            try {
                const { error } = await supabase.functions.invoke('invite-agent', {
                    body: {
                        email: rowEmail,
                        firstName: rowFirstName,
                        lastName: rowLastName,
                        role: rowRole
                    }
                })

                if (error) throw error
                results.success++
            } catch (err) {
                console.error(`Error inviting ${rowEmail}:`, err)
                results.error++
                results.details.push({ email: rowEmail, status: 'api_error' })
            }
        }

        setProcessingResults(results)
        setIsBulkLoading(false)
        setCsvFile(null)
        setCsvData([])
        fetchUsers()
        toast.success(`Proceso completado: ${results.success} éxitos, ${results.error} errores`)
    }

    const confirmDelete = async () => {
        if (!userToDelete) return
        const userId = userToDelete.id

        setIsDeleteDialogOpen(false)
        setDeleteLoading(userId)
        try {
            const { data, error } = await supabase.functions.invoke('admin-action', {
                body: { action: 'delete', userId }
            })

            if (error) throw error

            setUsers(users.filter(u => u.id !== userId))
            toast.success('Usuario eliminado correctamente')

        } catch (error) {
            console.error('Error deleting user:', error)
            toast.error('Error al eliminar usuario')
        } finally {
            setDeleteLoading(null)
            setUserToDelete(null)
        }
    }

    const handleDeleteClick = (user) => {
        setUserToDelete(user)
        setIsDeleteDialogOpen(true)
    }

    return (
        <div className="container max-w-4xl mx-auto px-4 py-8 space-y-8">
            <div className="grid md:grid-cols-2 gap-8">
                {/* Invite Section */}
                <Card>
                    <CardHeader>
                        <CardTitle>Invitar Agente</CardTitle>
                        <CardDescription>
                            Envía una invitación por correo a un nuevo agente.
                        </CardDescription>
                    </CardHeader>
                    <form onSubmit={handleInvite}>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="firstName">Nombre</Label>
                                    <Input
                                        id="firstName"
                                        required
                                        value={firstName}
                                        onChange={(e) => setFirstName(e.target.value)}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="lastName">Apellido</Label>
                                    <Input
                                        id="lastName"
                                        required
                                        value={lastName}
                                        onChange={(e) => setLastName(e.target.value)}
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="email">Correo Electrónico</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="agente@remax-exclusive.cl"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="role">Rol</Label>
                                <Select value={role} onValueChange={setRole}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Selecciona un rol" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="agent">Agente</SelectItem>
                                        <SelectItem value="admin">Administrador</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </CardContent>
                        <CardFooter>
                            <Button type="submit" className="w-full" disabled={loading}>
                                {loading ? 'Enviando...' : 'Enviar Invitación'}
                            </Button>
                        </CardFooter>
                    </form>
                </Card>

                {/* Bulk Invite Section */}
                <Card className="flex flex-col">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Upload className="h-5 w-5" />
                            Invitación Masiva
                        </CardTitle>
                        <CardDescription>
                            Carga un archivo CSV para invitar a múltiples agentes.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="flex-1 space-y-4">
                        {!csvFile ? (
                            <div
                                className="border-2 border-dashed rounded-xl p-8 text-center cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900 border-slate-200 dark:border-slate-800 transition-colors"
                                onClick={() => fileInputRef.current?.click()}
                            >
                                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                                    <FileText className="h-10 w-10 opacity-50" />
                                    <p className="font-medium">Haz clic para cargar CSV</p>
                                    <p className="text-xs">Debe contener Nombre, Apellido y Email</p>
                                </div>
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    className="hidden"
                                    accept=".csv"
                                    onChange={handleFileUpload}
                                />
                            </div>
                        ) : (
                            <div className="space-y-4 animate-in fade-in duration-300">
                                <div className="flex items-center justify-between p-3 bg-primary/5 rounded-lg border border-primary/20">
                                    <div className="flex items-center gap-2">
                                        <FileText className="h-5 w-5 text-primary" />
                                        <span className="text-sm font-medium truncate max-w-[150px]">{csvFile.name}</span>
                                        <Badge variant="outline" className="text-[10px]">{csvData.length} filas</Badge>
                                    </div>
                                    <Button variant="ghost" size="icon" onClick={() => setCsvFile(null)} className="h-8 w-8">
                                        <X className="h-4 w-4" />
                                    </Button>
                                </div>

                                <div className="space-y-3">
                                    <p className="text-xs font-bold uppercase text-muted-foreground tracking-wider">Mapeo de Campos</p>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-1.5">
                                            <Label className="text-[11px]">Nombre *</Label>
                                            <Select value={mapping.firstName} onValueChange={(v) => setMapping(prev => ({ ...prev, firstName: v }))}>
                                                <SelectTrigger className="h-8 text-xs">
                                                    <SelectValue placeholder="Seleccionar" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {headers.filter(h => h).map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label className="text-[11px]">Apellido *</Label>
                                            <Select value={mapping.lastName} onValueChange={(v) => setMapping(prev => ({ ...prev, lastName: v }))}>
                                                <SelectTrigger className="h-8 text-xs">
                                                    <SelectValue placeholder="Seleccionar" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {headers.filter(h => h).map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label className="text-[11px]">Email *</Label>
                                            <Select value={mapping.email} onValueChange={(v) => setMapping(prev => ({ ...prev, email: v }))}>
                                                <SelectTrigger className="h-8 text-xs">
                                                    <SelectValue placeholder="Seleccionar" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {headers.filter(h => h).map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label className="text-[11px]">Rol (Opcional)</Label>
                                            <Select value={mapping.role || 'none'} onValueChange={(v) => setMapping(prev => ({ ...prev, role: v === 'none' ? '' : v }))}>
                                                <SelectTrigger className="h-8 text-xs">
                                                    <SelectValue placeholder="Seleccionar" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="none">Predeterminado (Agente)</SelectItem>
                                                    {headers.filter(h => h).map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {processingResults && (
                            <Alert className={processingResults.error > 0 ? "border-amber-200 bg-amber-50" : "border-green-200 bg-green-50"}>
                                <div className="flex gap-2">
                                    {processingResults.error === 0 ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <AlertCircle className="h-4 w-4 text-amber-600" />}
                                    <AlertDescription className="text-xs">
                                        <p className="font-bold">Resultado:</p>
                                        <p>{processingResults.success} invitaciones enviadas.</p>
                                        {processingResults.error > 0 && <p>{processingResults.error} errores detectados.</p>}
                                    </AlertDescription>
                                </div>
                            </Alert>
                        )}
                    </CardContent>
                    <CardFooter className="pt-0">
                        <Button
                            className="w-full"
                            disabled={!csvFile || isBulkLoading}
                            onClick={handleBulkInvite}
                        >
                            {isBulkLoading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Procesando...
                                </>
                            ) : (
                                'Iniciar Proceso Masivo'
                            )}
                        </Button>
                    </CardFooter>
                </Card>
            </div>


            {/* Users List Section */}
            <Card>
                <CardHeader>
                    <CardTitle>Usuarios Registrados</CardTitle>
                    <CardDescription>
                        Lista de todos los agentes y administradores registrados.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {usersLoading ? (
                        <div className="text-center py-8 text-muted-foreground">Cargando usuarios...</div>
                    ) : users.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">No hay usuarios registrados aun.</div>
                    ) : (
                        <div className="space-y-4">
                            {users.map((u) => (
                                <div key={u.id} className="flex items-center justify-between p-4 border rounded-lg bg-card hover:bg-accent/5 transition-colors">
                                    <div className="flex items-center gap-4">
                                        <div className="h-10 w-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center overflow-hidden">
                                            {u.avatar_url ? (
                                                <img src={u.avatar_url} alt={u.first_name} className="h-full w-full object-cover" />
                                            ) : (
                                                <span className="text-lg font-bold text-slate-500">
                                                    {(u.first_name?.[0] || u.email?.[0] || '?').toUpperCase()}
                                                </span>
                                            )}
                                        </div>
                                        <div>
                                            <p className="font-medium text-foreground">
                                                {u.first_name} {u.last_name || ''}
                                                {u.id === profile?.id && <span className="ml-2 text-xs text-muted-foreground">(Tú)</span>}
                                            </p>
                                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                                <span>{u.email}</span>
                                                {u.role === 'admin' && (
                                                    <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                                                        Admin
                                                    </Badge>
                                                )}
                                            </div>
                                            <p className="text-xs text-muted-foreground mt-0.5">
                                                Aceptó invitación: {new Date(u.created_at).toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' })}
                                            </p>
                                        </div>
                                    </div>

                                    {u.id !== profile?.id && (
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20"
                                            onClick={() => handleDeleteClick(u)}
                                            disabled={deleteLoading === u.id}
                                        >
                                            {deleteLoading === u.id ? (
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                            ) : (
                                                <Trash2 className="h-4 w-4" />
                                            )}
                                        </Button>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Estás completamente seguro?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Esta acción no se puede deshacer. Eliminarás a <strong>{userToDelete?.first_name} {userToDelete?.last_name || ''}</strong> ({userToDelete?.email}) permanentemente de la plataforma.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setUserToDelete(null)}>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={confirmDelete}
                            className="bg-red-600 hover:bg-red-700"
                        >
                            Eliminar Usuario
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div >
    )
}
