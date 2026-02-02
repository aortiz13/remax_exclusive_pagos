
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
    const [selectedFiles, setSelectedFiles] = useState([]) // Array of { file, title }
    const [isDragging, setIsDragging] = useState(false)

    // Rename State
    const [isRenameOpen, setIsRenameOpen] = useState(false)
    const [renamingDoc, setRenamingDoc] = useState(null)
    const [renameTitle, setRenameTitle] = useState('')

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

    // Drag & Drop Handlers
    const handleDragOver = (e) => {
        e.preventDefault()
        setIsDragging(true)
    }

    const handleDragLeave = (e) => {
        e.preventDefault()
        setIsDragging(false)
    }

    const handleDrop = (e) => {
        e.preventDefault()
        setIsDragging(false)

        if (e.dataTransfer.files) {
            addFiles(Array.from(e.dataTransfer.files))
        }
    }

    const handleFileSelect = (e) => {
        if (e.target.files) {
            addFiles(Array.from(e.target.files))
        }
    }

    const addFiles = (files) => {
        const newFiles = files.map(file => ({
            file,
            title: file.name // Default title = filename
        }))
        setSelectedFiles(prev => [...prev, ...newFiles])
    }

    const removeFile = (index) => {
        setSelectedFiles(prev => prev.filter((_, i) => i !== index))
    }

    const updateFileTitle = (index, newTitle) => {
        setSelectedFiles(prev => prev.map((item, i) =>
            i === index ? { ...item, title: newTitle } : item
        ))
    }

    const handleUpload = async () => {
        if (selectedFiles.length === 0) return

        try {
            setUploading(true)

            // Upload files sequentially or parallel. 
            // Using Promise.all for parallel might be faster but harder to track individual progress if we needed strict ordering.
            // Parallel is fine here.

            await Promise.all(selectedFiles.map(async (item) => {
                const fileExt = item.file.name.split('.').pop()
                const fileName = `${category}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`

                // 1. Upload to Storage
                const { error: uploadError } = await supabase.storage
                    .from('documents')
                    .upload(fileName, item.file)

                if (uploadError) throw uploadError

                // 2. Add metadata to DB
                // Use the custom title or fallback to filename if empty
                const finalTitle = item.title.trim() || item.file.name

                const { error: dbError } = await supabase
                    .from('document_repository')
                    .insert([{
                        title: finalTitle,
                        category: category,
                        file_path: fileName,
                        file_type: fileExt,
                        file_size: item.file.size,
                        uploaded_by: profile.id
                    }])

                if (dbError) throw dbError
            }))

            toast.success(`${selectedFiles.length} documento(s) subido(s) exitosamente`)
            setSelectedFiles([])
            setIsUploadOpen(false)
            fetchDocuments()

        } catch (error) {
            console.error('Error uploading:', error)
            toast.error('Error al subir algunos documentos: ' + error.message)
        } finally {
            setUploading(false)
        }
    }

    const handleRenameClick = (doc) => {
        setRenamingDoc(doc)
        setRenameTitle(doc.title)
        setIsRenameOpen(true)
    }

    const handleRenameSubmit = async () => {
        if (!renamingDoc || !renameTitle.trim()) return

        try {
            const { error } = await supabase
                .from('document_repository')
                .update({ title: renameTitle })
                .eq('id', renamingDoc.id)

            if (error) throw error

            toast.success('Documento renombrado')
            setIsRenameOpen(false)
            setRenamingDoc(null)
            fetchDocuments()
        } catch (error) {
            console.error('Error renaming:', error)
            toast.error('Error al renombrar el documento')
        }
    }

    const handleDelete = async (docId, filePath) => {
        try {
            // 1. Delete from Storage
            const { error: storageError } = await supabase.storage
                .from('documents')
                .remove([filePath])

            if (storageError) console.error('Storage delete warning:', storageError)

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
                    <>
                        <Dialog open={isUploadOpen} onOpenChange={setIsUploadOpen}>
                            <DialogTrigger asChild>
                                <Button className="gap-2 shadow-lg hover:shadow-xl transition-all">
                                    <Upload className="w-4 h-4" />
                                    Subir Documentos
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-xl">
                                <DialogHeader>
                                    <DialogTitle>Subir Documentos</DialogTitle>
                                </DialogHeader>
                                <div className="space-y-4 py-4">
                                    {/* Drag & Drop Zone */}
                                    <div
                                        className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center transition-colors cursor-pointer ${isDragging ? 'border-primary bg-primary/5' : 'border-slate-200 hover:border-primary/50 hover:bg-slate-50'
                                            }`}
                                        onDragOver={handleDragOver}
                                        onDragLeave={handleDragLeave}
                                        onDrop={handleDrop}
                                        onClick={() => document.getElementById('file-upload').click()}
                                    >
                                        <div className="p-4 bg-blue-50 text-blue-500 rounded-full mb-4">
                                            <Upload className="w-6 h-6" />
                                        </div>
                                        <p className="text-sm font-medium text-slate-900">
                                            Arrastra archivos aquí o haz clic para seleccionar
                                        </p>
                                        <p className="text-xs text-slate-500 mt-1">
                                            Soporta múltiples archivos
                                        </p>
                                        <input
                                            id="file-upload"
                                            type="file"
                                            multiple
                                            className="hidden"
                                            onChange={handleFileSelect}
                                        />
                                    </div>

                                    {/* Selected Files List */}
                                    {selectedFiles.length > 0 && (
                                        <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
                                            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                                Archivos Seleccionados ({selectedFiles.length})
                                            </p>
                                            {selectedFiles.map((item, idx) => (
                                                <div key={idx} className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-100 dark:border-slate-800">
                                                    <div className="shrink-0">
                                                        <File className="w-8 h-8 text-blue-500" />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <Input
                                                            value={item.title}
                                                            onChange={(e) => updateFileTitle(idx, e.target.value)}
                                                            className="h-8 text-sm"
                                                            placeholder="Título del documento"
                                                        />
                                                        <p className="text-[10px] text-slate-500 mt-1 truncate">
                                                            Original: {item.file.name} • {(item.file.size / 1024).toFixed(0)} KB
                                                        </p>
                                                    </div>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 text-slate-400 hover:text-red-500"
                                                        onClick={() => removeFile(idx)}
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </Button>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    <Button
                                        onClick={handleUpload}
                                        disabled={uploading || selectedFiles.length === 0}
                                        className="w-full"
                                    >
                                        {uploading ? 'Subiendo...' : `Subir ${selectedFiles.length} Archivos`}
                                    </Button>
                                </div>
                            </DialogContent>
                        </Dialog>

                        {/* Rename Dialog */}
                        <Dialog open={isRenameOpen} onOpenChange={setIsRenameOpen}>
                            <DialogContent>
                                <DialogHeader>
                                    <DialogTitle>Renombrar Documento</DialogTitle>
                                </DialogHeader>
                                <div className="py-4 space-y-4">
                                    <div className="space-y-2">
                                        <Label>Nuevo Título</Label>
                                        <Input
                                            value={renameTitle}
                                            onChange={(e) => setRenameTitle(e.target.value)}
                                        />
                                    </div>
                                    <Button onClick={handleRenameSubmit} className="w-full">
                                        Guardar Cambios
                                    </Button>
                                </div>
                            </DialogContent>
                        </Dialog>
                    </>
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
                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            {/* Edit Button */}
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 text-slate-400 hover:text-blue-500"
                                                onClick={() => handleRenameClick(doc)}
                                                title="Renombrar"
                                            >
                                                <FileText className="w-4 h-4" />
                                            </Button>

                                            {/* Delete Button */}
                                            <AlertDialog>
                                                <AlertDialogTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-red-500" title="Eliminar">
                                                        <Trash2 className="w-4 h-4" />
                                                    </Button>
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
                                        </div>
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
