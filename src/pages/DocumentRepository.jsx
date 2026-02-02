
import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../services/supabase'
import { useAuth } from '../context/AuthContext'
import {
    Button,
    Card, CardContent, CardHeader, CardTitle,
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
    Input, Label,
    AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction, AlertDialogTrigger
} from '@/components/ui'
import { FileText, Upload, Trash2, Eye, Download, Search, File } from 'lucide-react'
import { toast } from 'sonner'

export default function DocumentRepository() {
    const { category } = useParams()
    const { profile } = useAuth()
    const [documents, setDocuments] = useState([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')

    // Upload State
    const [isUploadOpen, setIsUploadOpen] = useState(false)
    const [uploading, setUploading] = useState(false)
    const [newDocTimeout, setNewDocTimeout] = useState(null)
    const [uploadTitle, setUploadTitle] = useState('')
    const [selectedFile, setSelectedFile] = useState(null)

    const categoryTitle = category === 'purchase' ? 'Formularios Tipo de Compraventa' :
        category === 'rental' ? 'Formularios Tipo de Arriendo' : 'Documentos'

    useEffect(() => {
        fetchDocuments()
    }, [category])

    const fetchDocuments = async () => {
        try {
            setLoading(true)
            const { data, error } = await supabase
                .from('document_repository')
                .select('*')
                .eq('category', category)
                .order('created_at', { ascending: false })

            if (error) throw error
            setDocuments(data || [])
        } catch (error) {
            console.error('Error fetching documents:', error)
            toast.error('Error al cargar documentos')
        } finally {
            setLoading(false)
        }
    }

    const handleFileSelect = (e) => {
        if (e.target.files && e.target.files[0]) {
            setSelectedFile(e.target.files[0])
        }
    }

    const handleUpload = async () => {
        if (!selectedFile || !uploadTitle) {
            toast.error('Por favor completa todos los campos')
            return
        }

        try {
            setUploading(true)

            // 1. Upload to Storage
            const fileExt = selectedFile.name.split('.').pop()
            const fileName = `${category}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`

            const { error: uploadError } = await supabase.storage
                .from('documents')
                .upload(fileName, selectedFile)

            if (uploadError) throw uploadError

            // 2. Add metadata to DB
            const { error: dbError } = await supabase
                .from('document_repository')
                .insert([{
                    title: uploadTitle,
                    category: category,
                    file_path: fileName,
                    file_type: fileExt,
                    file_size: selectedFile.size,
                    uploaded_by: profile.id // RLS will check auth.uid() automatically usually, but good to send if needed or let DB handle it. Relying on default here if column has default auth.uid() or we pass it.
                    // My SQL schema had `uploaded_by uuid references auth.users(id)`. 
                    // I will pass it explicitly to be safe, assuming profile.id matches auth.uid
                }])

            if (dbError) throw dbError

            toast.success('Documento subido exitosamente')
            setUploadTitle('')
            setSelectedFile(null)
            setIsUploadOpen(false)
            fetchDocuments()

        } catch (error) {
            console.error('Error uploading:', error)
            toast.error('Error al subir documento: ' + error.message)
        } finally {
            setUploading(false)
        }
    }

    const handleDelete = async (docId, filePath) => {
        try {
            // 1. Delete from Storage
            const { error: storageError } = await supabase.storage
                .from('documents')
                .remove([filePath])

            if (storageError) {
                console.error('Storage delete error:', storageError)
                // Continue to delete from DB anyway to keep consistent? 
                // Or stop? Usually stop, but if file is missing we still want to clean DB.
                // Let's warn but proceed.
            }

            // 2. Delete from DB
            const { error: dbError } = await supabase
                .from('document_repository')
                .delete()
                .eq('id', docId)

            if (dbError) throw dbError

            toast.success('Documento eliminado')
            fetchDocuments()

        } catch (error) {
            console.error('Error deleting:', error)
            toast.error('Error al eliminar documento')
        }
    }

    const handleView = async (filePath) => {
        // Get Public URL
        const { data } = supabase.storage
            .from('documents')
            .getPublicUrl(filePath)

        if (data?.publicUrl) {
            window.open(data.publicUrl, '_blank')
        } else {
            toast.error('No se pudo obtener el enlace')
        }
    }

    const handleDownload = async (filePath, title) => {
        try {
            const { data, error } = await supabase.storage
                .from('documents')
                .download(filePath)

            if (error) throw error

            const url = window.URL.createObjectURL(data)
            const a = document.createElement('a')
            a.href = url
            // Try to deduce extension from path if title doesn't have it
            const ext = filePath.split('.').pop()
            a.download = title.endsWith(`.${ext}`) ? title : `${title}.${ext}`
            document.body.appendChild(a)
            a.click()
            window.URL.revokeObjectURL(url)
            document.body.removeChild(a)

        } catch (error) {
            console.error('Download error:', error)
            toast.error('Error al descargar')
        }
    }

    const isAdmin = profile?.role === 'admin'

    const filteredDocs = documents.filter(doc =>
        doc.title.toLowerCase().includes(searchTerm.toLowerCase())
    )

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-300">
                        {categoryTitle}
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        Repositorio de documentos y formularios
                    </p>
                </div>

                {isAdmin && (
                    <Dialog open={isUploadOpen} onOpenChange={setIsUploadOpen}>
                        <DialogTrigger asChild>
                            <Button className="gap-2 shadow-lg hover:shadow-xl transition-all">
                                <Upload className="w-4 h-4" />
                                Subir Documento
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Subir Nuevo Documento</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                                <div className="space-y-2">
                                    <Label>Título del Documento</Label>
                                    <Input
                                        placeholder="Ej: Contrato de Arriendo 2024"
                                        value={uploadTitle}
                                        onChange={(e) => setUploadTitle(e.target.value)}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Archivo</Label>
                                    <Input
                                        type="file"
                                        onChange={handleFileSelect}
                                        className="cursor-pointer"
                                    />
                                </div>
                                <Button
                                    onClick={handleUpload}
                                    disabled={uploading || !selectedFile || !uploadTitle}
                                    className="w-full"
                                >
                                    {uploading ? 'Subiendo...' : 'Subir Documento'}
                                </Button>
                            </div>
                        </DialogContent>
                    </Dialog>
                )}
            </div>

            {/* Filters */}
            <div className="flex items-center gap-2 max-w-sm bg-white dark:bg-slate-900 p-2 rounded-xl border shadow-sm">
                <Search className="w-4 h-4 text-muted-foreground ml-2" />
                <Input
                    placeholder="Buscar documentos..."
                    className="border-none shadow-none focus-visible:ring-0"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>

            {/* Documents Grid */}
            {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="h-40 bg-slate-100 dark:bg-slate-800 animate-pulse rounded-xl" />
                    ))}
                </div>
            ) : filteredDocs.length === 0 ? (
                <div className="text-center py-20 bg-white/50 dark:bg-slate-900/50 rounded-2xl border border-dashed">
                    <FileText className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-slate-900 dark:text-white">No hay documentos</h3>
                    <p className="text-slate-500">No se encontraron documentos en esta categoría.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredDocs.map((doc) => (
                        <Card key={doc.id} className="group hover:shadow-lg transition-all duration-300 border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm overflow-hidden">
                            <CardContent className="p-0">
                                <div className="p-6 flex items-start justify-between gap-4">
                                    <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl text-blue-600 dark:text-blue-400">
                                        <FileText className="w-6 h-6" />
                                    </div>
                                    {isAdmin && (
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <button className="opacity-0 group-hover:opacity-100 p-2 text-slate-400 hover:text-red-500 transition-all">
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent>
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
                                                    <AlertDialogDescription>
                                                        Esta acción no se puede deshacer. El documento será eliminado permanentemente.
                                                    </AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                    <AlertDialogAction
                                                        onClick={() => handleDelete(doc.id, doc.file_path)}
                                                        className="bg-red-500 hover:bg-red-600"
                                                    >
                                                        Eliminar
                                                    </AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    )}
                                </div>

                                <div className="px-6 pb-2">
                                    <h3 className="font-semibold text-slate-900 dark:text-white truncate" title={doc.title}>
                                        {doc.title}
                                    </h3>
                                    <p className="text-xs text-slate-500 mt-1">
                                        {(doc.file_size / 1024 / 1024).toFixed(2)} MB • {new Date(doc.created_at).toLocaleDateString()}
                                    </p>
                                </div>

                                <div className="p-4 bg-slate-50 dark:bg-slate-950/50 flex items-center gap-2 mt-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="flex-1 gap-2 hover:bg-white dark:hover:bg-slate-800"
                                        onClick={() => handleView(doc.file_path)}
                                    >
                                        <Eye className="w-4 h-4" />
                                        Ver
                                    </Button>
                                    <Button
                                        variant="default"
                                        size="sm"
                                        className="flex-1 gap-2"
                                        onClick={() => handleDownload(doc.file_path, doc.title)}
                                    >
                                        <Download className="w-4 h-4" />
                                        Descargar
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    )
}
