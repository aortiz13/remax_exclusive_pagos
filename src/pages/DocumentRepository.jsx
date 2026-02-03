
import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../services/supabase'
import { useAuth } from '../context/AuthContext'
import {
    Button,
    Card, CardContent, CardHeader, CardTitle,
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
    Input, Label,
    AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction, AlertDialogTrigger,
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui'
import { FileText, Upload, Trash2, Eye, Download, Search, File } from 'lucide-react'
import { toast } from 'sonner'

export default function DocumentRepository({ category: propCategory }) {
    const { category: paramCategory } = useParams()
    const { profile } = useAuth()

    // Prioritize propCategory (from Tabs), fallback to paramCategory (direct URL)
    const category = propCategory || paramCategory

    const [documents, setDocuments] = useState([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')
    const [viewMode, setViewMode] = useState('gallery') // 'gallery' | 'list' | 'icons'

    // Upload State
    const [isUploadOpen, setIsUploadOpen] = useState(false)
    const [uploading, setUploading] = useState(false)
    const [selectedFiles, setSelectedFiles] = useState([]) // Array of { file, title }
    const [uploadSubcategory, setUploadSubcategory] = useState('arriendo') // 'arriendo' | 'venta'
    const [isDragging, setIsDragging] = useState(false)

    // Rename State
    const [isRenameOpen, setIsRenameOpen] = useState(false)
    const [renamingDoc, setRenamingDoc] = useState(null)
    const [renameTitle, setRenameTitle] = useState('')

    // Preview State
    const [previewUrl, setPreviewUrl] = useState(null)
    const [previewTitle, setPreviewTitle] = useState('')
    const [isPreviewOpen, setIsPreviewOpen] = useState(false)

    const categoryTitle = category === 'purchase' ? 'Formularios Tipo de Compraventa' :
        category === 'rental' ? 'Formularios Tipo de Arriendo' :
            category === 'evaluations' ? 'Formatos Evaluaciones Comerciales' : // New Category
                'Documentos'

    useEffect(() => {
        if (category) {
            fetchDocuments()
        }
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
                        subcategory: category === 'evaluations' ? uploadSubcategory : null,
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

    const handlePreview = async (doc) => {
        const { data } = supabase.storage
            .from('documents')
            .getPublicUrl(doc.file_path)

        if (data?.publicUrl) {
            setPreviewUrl(data.publicUrl)
            setPreviewTitle(doc.title)
            setIsPreviewOpen(true)
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

    // Render Helpers
    const formatDate = (dateString) => new Date(dateString).toLocaleDateString()
    const formatSize = (bytes) => (bytes / 1024 / 1024).toFixed(2) + ' MB'

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
                                    {/* Subcategory Selector for Evaluations */}
                                    {category === 'evaluations' && (
                                        <div className="space-y-2">
                                            <Label>Tipo de Evaluación</Label>
                                            <Select value={uploadSubcategory} onValueChange={setUploadSubcategory}>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Selecciona el tipo" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="arriendo">Arriendo</SelectItem>
                                                    <SelectItem value="venta">Venta</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    )}

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

            {/* Toolbar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white dark:bg-slate-950 p-2 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                {/* Search */}
                <div className="flex items-center gap-2 flex-1 w-full sm:max-w-xs bg-slate-50 dark:bg-slate-900 p-1.5 rounded-lg border border-slate-200 dark:border-slate-800">
                    <Search className="w-4 h-4 text-muted-foreground ml-2" />
                    <Input
                        placeholder="Buscar documentos..."
                        className="border-none shadow-none focus-visible:ring-0 h-8 bg-transparent"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                {/* View Switcher */}
                <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-900 p-1 rounded-lg">
                    <Button
                        variant={viewMode === 'list' ? 'white' : 'ghost'}
                        size="sm"
                        className={`h-8 w-8 p-0 ${viewMode === 'list' ? 'bg-white shadow-sm' : ''}`}
                        onClick={() => setViewMode('list')}
                        title="Lista"
                    >
                        <div className="w-4 h-4 flex flex-col gap-[2px] justify-center">
                            <div className="h-[2px] w-full bg-current rounded-full" />
                            <div className="h-[2px] w-full bg-current rounded-full" />
                            <div className="h-[2px] w-full bg-current rounded-full" />
                        </div>
                    </Button>
                    <Button
                        variant={viewMode === 'gallery' ? 'white' : 'ghost'}
                        size="sm"
                        className={`h-8 w-8 p-0 ${viewMode === 'gallery' ? 'bg-white shadow-sm' : ''}`}
                        onClick={() => setViewMode('gallery')}
                        title="Galería"
                    >
                        <div className="w-4 h-4 border-2 border-current rounded-sm" />
                    </Button>
                    <Button
                        variant={viewMode === 'icons' ? 'white' : 'ghost'}
                        size="sm"
                        className={`h-8 w-8 p-0 ${viewMode === 'icons' ? 'bg-white shadow-sm' : ''}`}
                        onClick={() => setViewMode('icons')}
                        title="Iconos"
                    >
                        <div className="w-4 h-4 grid grid-cols-2 gap-[2px]">
                            <div className="bg-current rounded-[1px]" />
                            <div className="bg-current rounded-[1px]" />
                            <div className="bg-current rounded-[1px]" />
                            <div className="bg-current rounded-[1px]" />
                        </div>
                    </Button>
                </div>
            </div>

            {/* Content Content */}
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
                <>
                    {/* Helper to render a group of documents */}
                    {(() => {
                        const renderDocGroup = (docs) => (
                            <>
                                {/* View: Gallery (Cards) */}
                                {viewMode === 'gallery' && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {docs.map((doc) => (
                                            <Card key={doc.id} className="group hover:shadow-lg transition-all duration-300 border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm overflow-hidden">
                                                <CardContent className="p-0">
                                                    <div className="p-6 flex items-start justify-between gap-4">
                                                        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl text-blue-600 dark:text-blue-400">
                                                            <FileText className="w-6 h-6" />
                                                        </div>
                                                        {isAdmin && (
                                                            <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                                                                <Button
                                                                    variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-blue-500"
                                                                    onClick={() => handleRenameClick(doc)}
                                                                >
                                                                    <FileText className="w-4 h-4" />
                                                                </Button>
                                                                <AlertDialog>
                                                                    <AlertDialogTrigger asChild>
                                                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-red-500">
                                                                            <Trash2 className="w-4 h-4" />
                                                                        </Button>
                                                                    </AlertDialogTrigger>
                                                                    <AlertDialogContent>
                                                                        <AlertDialogHeader>
                                                                            <AlertDialogTitle>¿Eliminar documento?</AlertDialogTitle>
                                                                            <AlertDialogDescription>Esta acción es irreversible.</AlertDialogDescription>
                                                                        </AlertDialogHeader>
                                                                        <AlertDialogFooter>
                                                                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                                            <AlertDialogAction onClick={() => handleDelete(doc.id, doc.file_path)} className="bg-red-500">Eliminar</AlertDialogAction>
                                                                        </AlertDialogFooter>
                                                                    </AlertDialogContent>
                                                                </AlertDialog>
                                                            </div>
                                                        )}
                                                    </div>

                                                    <div className="px-6 pb-2">
                                                        <h3 className="font-semibold text-slate-900 dark:text-white text-base leading-snug whitespace-normal break-words" title={doc.title}>
                                                            {doc.title}
                                                        </h3>
                                                        <p className="text-xs text-slate-500 mt-2">
                                                            {formatSize(doc.file_size)} • {formatDate(doc.created_at)}
                                                        </p>
                                                    </div>

                                                    <div className="p-4 bg-slate-50 dark:bg-slate-950/50 flex items-center gap-2 mt-2">
                                                        <Button
                                                            variant="outline" size="sm" className="flex-1 gap-2 hover:bg-white dark:hover:bg-slate-800"
                                                            onClick={() => handlePreview(doc)}
                                                        >
                                                            <Eye className="w-4 h-4" /> Ver
                                                        </Button>
                                                        <Button
                                                            variant="default" size="sm" className="flex-1 gap-2"
                                                            onClick={() => handleDownload(doc.file_path, doc.title)}
                                                        >
                                                            <Download className="w-4 h-4" /> Descargar
                                                        </Button>
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        ))}
                                    </div>
                                )}

                                {/* View: Icons (Grid of small items) */}
                                {viewMode === 'icons' && (
                                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                                        {docs.map((doc) => (
                                            <div key={doc.id} className="group flex flex-col items-center p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 hover:shadow-md transition-all cursor-pointer relative" onClick={() => handlePreview(doc)}>
                                                <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/20 rounded-lg flex items-center justify-center text-blue-500 mb-3">
                                                    <FileText className="w-8 h-8" />
                                                </div>
                                                <p className="text-sm font-medium text-center text-slate-900 dark:text-white w-full whitespace-normal break-words leading-tight">
                                                    {doc.title}
                                                </p>

                                                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 bg-white/90 dark:bg-slate-900/90 rounded-md p-1 shadow-sm backdrop-blur-sm">
                                                    {isAdmin && (
                                                        <>
                                                            <button onClick={(e) => { e.stopPropagation(); handleRenameClick(doc) }} className="p-1 hover:text-blue-500"><FileText className="w-3 h-3" /></button>
                                                            <AlertDialog>
                                                                <AlertDialogTrigger asChild>
                                                                    <button onClick={(e) => e.stopPropagation()} className="p-1 hover:text-red-500"><Trash2 className="w-3 h-3" /></button>
                                                                </AlertDialogTrigger>
                                                                <AlertDialogContent>
                                                                    <AlertDialogHeader>
                                                                        <AlertDialogTitle>¿Eliminar documento?</AlertDialogTitle>
                                                                    </AlertDialogHeader>
                                                                    <AlertDialogFooter>
                                                                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                                        <AlertDialogAction onClick={() => handleDelete(doc.id, doc.file_path)} className="bg-red-500">Eliminar</AlertDialogAction>
                                                                    </AlertDialogFooter>
                                                                </AlertDialogContent>
                                                            </AlertDialog>
                                                        </>
                                                    )}
                                                    <button onClick={(e) => { e.stopPropagation(); handleDownload(doc.file_path, doc.title) }} className="p-1 hover:text-green-500"><Download className="w-3 h-3" /></button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* View: List */}
                                {viewMode === 'list' && (
                                    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                                        <table className="w-full text-sm text-left">
                                            <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500">
                                                <tr>
                                                    <th className="px-4 py-3 font-medium">Nombre</th>
                                                    <th className="px-4 py-3 font-medium w-32">Fecha</th>
                                                    <th className="px-4 py-3 font-medium w-24">Tamaño</th>
                                                    <th className="px-4 py-3 font-medium w-32 text-right">Acciones</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                                {docs.map((doc) => (
                                                    <tr key={doc.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                                        <td className="px-4 py-3">
                                                            <div className="flex items-center gap-3">
                                                                <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-blue-500">
                                                                    <FileText className="w-4 h-4" />
                                                                </div>
                                                                <span className="font-medium text-slate-900 dark:text-white whitespace-normal break-words max-w-md">
                                                                    {doc.title}
                                                                </span>
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-3 text-slate-500">{formatDate(doc.created_at)}</td>
                                                        <td className="px-4 py-3 text-slate-500">{formatSize(doc.file_size)}</td>
                                                        <td className="px-4 py-3 text-right">
                                                            <div className="flex items-center justify-end gap-1">
                                                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handlePreview(doc)} title="Ver">
                                                                    <Eye className="w-4 h-4 text-slate-400" />
                                                                </Button>
                                                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDownload(doc.file_path, doc.title)} title="Descargar">
                                                                    <Download className="w-4 h-4 text-slate-400" />
                                                                </Button>
                                                                {isAdmin && (
                                                                    <>
                                                                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleRenameClick(doc)} title="Renombrar">
                                                                            <FileText className="w-4 h-4 text-slate-400" />
                                                                        </Button>
                                                                        <AlertDialog>
                                                                            <AlertDialogTrigger asChild>
                                                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-red-400 hover:text-red-500">
                                                                                    <Trash2 className="w-4 h-4" />
                                                                                </Button>
                                                                            </AlertDialogTrigger>
                                                                            <AlertDialogContent>
                                                                                <AlertDialogHeader>
                                                                                    <AlertDialogTitle>¿Eliminar documento?</AlertDialogTitle>
                                                                                </AlertDialogHeader>
                                                                                <AlertDialogFooter>
                                                                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                                                    <AlertDialogAction onClick={() => handleDelete(doc.id, doc.file_path)} className="bg-red-500">Eliminar</AlertDialogAction>
                                                                                </AlertDialogFooter>
                                                                            </AlertDialogContent>
                                                                        </AlertDialog>
                                                                    </>
                                                                )}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </>
                        )

                        if (category === 'evaluations') {
                            // Split into Arriendo and Venta
                            const arriendoDocs = filteredDocs.filter(d => !d.subcategory || d.subcategory === 'arriendo')
                            const ventaDocs = filteredDocs.filter(d => d.subcategory === 'venta')

                            return (
                                <div className="space-y-8">
                                    <section>
                                        <h2 className="text-xl font-semibold mb-4 text-slate-800 dark:text-slate-200 border-l-4 border-blue-500 pl-3">
                                            Formatos tipo de evaluaciones comerciales - Arriendo
                                        </h2>
                                        {arriendoDocs.length > 0 ? renderDocGroup(arriendoDocs) : (
                                            <p className="text-muted-foreground italic pl-4">No hay documentos de Arriendo.</p>
                                        )}
                                    </section>

                                    <section>
                                        <h2 className="text-xl font-semibold mb-4 text-slate-800 dark:text-slate-200 border-l-4 border-green-500 pl-3">
                                            Formatos tipo de evaluaciones comerciales - Venta
                                        </h2>
                                        {ventaDocs.length > 0 ? renderDocGroup(ventaDocs) : (
                                            <p className="text-muted-foreground italic pl-4">No hay documentos de Venta.</p>
                                        )}
                                    </section>
                                </div>
                            )
                        } else {
                            // Standard single list for other categories
                            return renderDocGroup(filteredDocs)
                        }
                    })()}
                </>
            )}

            {/* Preview Dialog */}
            <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
                <DialogContent className="max-w-4xl h-[80vh] flex flex-col">
                    <DialogHeader>
                        <DialogTitle className="truncate pr-8">{previewTitle}</DialogTitle>
                    </DialogHeader>
                    <div className="flex-1 bg-slate-100 rounded-lg overflow-hidden relative">
                        {previewUrl && (
                            <iframe
                                src={
                                    /\.(xls|xlsx|doc|docx|ppt|pptx)$/i.test(previewTitle)
                                        ? `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(previewUrl)}`
                                        : `https://docs.google.com/viewer?url=${encodeURIComponent(previewUrl)}&embedded=true`
                                }
                                className="w-full h-full border-0"
                                frameBorder="0"
                                title="Document Preview"
                            />
                        )}
                        {!previewUrl && (
                            <div className="absolute inset-0 flex items-center justify-center text-slate-400">
                                Cargando previsualización...
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    )
}
