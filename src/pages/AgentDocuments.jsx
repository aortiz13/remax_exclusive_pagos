
import { useState, useEffect } from 'react'
import { supabase, getCustomPublicUrl } from '../services/supabase'
import { useAuth } from '../context/AuthContext'
import {
    Folder,
    File,
    Upload,
    Plus,
    MoreVertical,
    Download,
    Trash2,
    Edit2,
    CornerUpLeft,
    Search,
    ChevronRight,
    Home,
    Eye,
    FileText
} from 'lucide-react'
import {
    Button,
    Input,
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    Label,
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    Card,
    CardContent
} from '@/components/ui'
import { toast } from 'sonner'

export default function AgentDocuments() {
    const { profile } = useAuth()
    const [folders, setFolders] = useState([])
    const [files, setFiles] = useState([])
    const [loading, setLoading] = useState(true)
    const [currentFolder, setCurrentFolder] = useState(null) // null = root
    const [folderPath, setFolderPath] = useState([]) // Array of {id, name}

    // UI State
    const [viewMode, setViewMode] = useState('gallery') // 'gallery' | 'list' | 'icons'
    const [searchTerm, setSearchTerm] = useState('')

    // Actions State
    const [isNewFolderOpen, setIsNewFolderOpen] = useState(false)
    const [newFolderName, setNewFolderName] = useState('')

    const [isRenameOpen, setIsRenameOpen] = useState(false)
    const [itemToRename, setItemToRename] = useState(null) // { type: 'folder'|'file', item }
    const [renameValue, setRenameValue] = useState('')

    const [itemToDelete, setItemToDelete] = useState(null) // { type: 'folder'|'file', item }

    const [uploading, setUploading] = useState(false)

    // Preview State
    const [previewUrl, setPreviewUrl] = useState(null)
    const [previewTitle, setPreviewTitle] = useState('')
    const [isPreviewOpen, setIsPreviewOpen] = useState(false)

    useEffect(() => {
        if (profile) {
            fetchContents(currentFolder, searchTerm)
        }
    }, [currentFolder, profile, searchTerm])

    const fetchContents = async (folderId, search) => {
        try {
            setLoading(true)

            // If searching, we ignore folder structure and search globally
            const isSearching = !!search.trim()

            // 1. Fetch Folders
            let foldersQuery = supabase
                .from('agent_folders')
                .select('*')
                .eq('user_id', profile.id)
                .order('name')

            if (isSearching) {
                foldersQuery = foldersQuery.ilike('name', `%${search}%`)
            } else {
                if (folderId) {
                    foldersQuery = foldersQuery.eq('parent_id', folderId)
                } else {
                    foldersQuery = foldersQuery.is('parent_id', null)
                }
            }

            const { data: folderData, error: folderError } = await foldersQuery
            if (folderError) throw folderError

            // 2. Fetch Files
            let filesQuery = supabase
                .from('agent_files')
                .select('*')
                .eq('user_id', profile.id)
                .order('name')

            if (isSearching) {
                filesQuery = filesQuery.ilike('name', `%${search}%`)
            } else {
                if (folderId) {
                    filesQuery = filesQuery.eq('folder_id', folderId)
                } else {
                    filesQuery = filesQuery.is('folder_id', null)
                }
            }

            const { data: fileData, error: fileError } = await filesQuery
            if (fileError) throw fileError

            setFolders(folderData)
            setFiles(fileData)

        } catch (error) {
            console.error('Error fetching documents:', error)
            toast.error('Error al cargar documentos')
        } finally {
            setLoading(false)
        }
    }

    const handleCreateFolder = async () => {
        if (!newFolderName.trim()) return

        try {
            const { error } = await supabase.from('agent_folders').insert({
                name: newFolderName,
                user_id: profile.id,
                parent_id: currentFolder
            })

            if (error) throw error

            toast.success('Carpeta creada')
            setNewFolderName('')
            setIsNewFolderOpen(false)
            fetchContents(currentFolder, searchTerm)
        } catch (error) {
            console.error('Error creating folder:', error)
            toast.error('Error al crear carpeta')
        }
    }


    const sanitizeForStorage = (name) => {
        return name
            .normalize('NFD')                    // Decompose accents
            .replace(/[\u0300-\u036f]/g, '')     // Remove accent marks
            .replace(/[^a-zA-Z0-9.-]/g, '_')     // Replace non-ASCII with underscores
            .replace(/_+/g, '_')                 // Collapse underscores
            .replace(/^_|_$/g, '')               // Trim underscores
    }

    const handleFileUpload = async (event) => {
        const file = event.target.files[0]
        if (!file) return

        try {
            setUploading(true)

            // 1. Pretty name for DB (normalized NFC)
            const prettyName = file.name
                .normalize('NFC')
                .replace(/\s+/g, ' ')
                .trim()

            // 2. Safe key for Storage (ASCII only)
            const safeFileName = sanitizeForStorage(prettyName)
            const fileExt = prettyName.split('.').pop()
            const storagePath = `${profile.id}/${Date.now()}_${safeFileName}`

            // 3. Upload to Storage
            const { error: uploadError } = await supabase.storage
                .from('agent_documents')
                .upload(storagePath, file)

            if (uploadError) throw uploadError

            // 4. Insert into DB
            const { error: dbError } = await supabase.from('agent_files').insert({
                name: prettyName,
                storage_path: storagePath,
                file_type: fileExt,
                file_size: file.size,
                user_id: profile.id,
                folder_id: currentFolder
            })

            if (dbError) throw dbError

            toast.success('Archivo subido')
            fetchContents(currentFolder, searchTerm)

        } catch (error) {
            console.error('Error uploading file:', error)
            toast.error('Error al subir archivo')
        } finally {
            setUploading(false)
            event.target.value = ''
        }
    }

    const handleRename = async () => {
        if (!itemToRename || !renameValue.trim()) return

        try {
            const table = itemToRename.type === 'folder' ? 'agent_folders' : 'agent_files'

            const { error } = await supabase
                .from(table)
                .update({ name: renameValue })
                .eq('id', itemToRename.item.id)
                .eq('user_id', profile.id)

            if (error) throw error

            toast.success('Renombrado exitosamente')
            setIsRenameOpen(false)
            setItemToRename(null)
            fetchContents(currentFolder, searchTerm)
        } catch (error) {
            console.error('Error renaming:', error)
            toast.error('Error al renombrar')
        }
    }

    const handleDelete = async () => {
        if (!itemToDelete) return

        try {
            if (itemToDelete.type === 'file') {
                const { error: storageError } = await supabase.storage
                    .from('agent_documents')
                    .remove([itemToDelete.item.storage_path])

                if (storageError) console.error('Storage delete error:', storageError)

                const { error: dbError } = await supabase
                    .from('agent_files')
                    .delete()
                    .eq('id', itemToDelete.item.id)
                    .eq('user_id', profile.id)

                if (dbError) throw dbError
            } else {
                const { error } = await supabase
                    .from('agent_folders')
                    .delete()
                    .eq('id', itemToDelete.item.id)
                    .eq('user_id', profile.id)

                if (error) throw error
            }

            toast.success('Eliminado exitosamente')
            setItemToDelete(null)
            fetchContents(currentFolder, searchTerm)

        } catch (error) {
            console.error('Error deleting:', error)
            toast.error('Error al eliminar')
        }
    }

    const handleDownload = async (file) => {
        try {
            const { data, error } = await supabase.storage
                .from('agent_documents')
                .download(file.storage_path)

            if (error) throw error

            const url = window.URL.createObjectURL(data)
            const a = document.createElement('a')
            a.href = url
            a.download = file.name
            document.body.appendChild(a)
            a.click()
            window.URL.revokeObjectURL(url)
            document.body.removeChild(a)

        } catch (error) {
            console.error('Download error:', error)
            toast.error('Error al descargar')
        }
    }

    const handlePreview = async (file) => {
        // Initializing preview
        setPreviewUrl(null)

        // Note: For private buckets, getPublicUrl might return a URL that requires a token
        // or we might need creating a signed URL if the bucket is not public.
        // My migration set public=false. So I need Signed URL.

        try {
            const { data, error } = await supabase.storage
                .from('agent_documents')
                .createSignedUrl(file.storage_path, 3600) // 1 hour

            if (error) throw error

            if (data?.signedUrl) {
                setPreviewUrl(data.signedUrl)
                setPreviewTitle(file.name)
                setIsPreviewOpen(true)
            }
        } catch (error) {
            console.error('Preview error:', error)
            toast.error('No se pudo generar la vista previa')
        }
    }

    const navigateToFolder = (folder) => {
        // Clear search when navigating into a folder
        setSearchTerm('')
        setFolderPath(prev => [...prev, { id: folder.id, name: folder.name }])
        setCurrentFolder(folder.id)
    }

    const navigateUp = (index) => {
        // Clear search when navigating
        setSearchTerm('')
        if (index === -1) {
            setFolderPath([])
            setCurrentFolder(null)
        } else {
            const newPath = folderPath.slice(0, index + 1)
            setFolderPath(newPath)
            setCurrentFolder(newPath[newPath.length - 1].id)
        }
    }

    // Formatting Helpers
    const formatDate = (dateString) => new Date(dateString).toLocaleDateString()
    const formatSize = (bytes) => (bytes / 1024 / 1024).toFixed(2) + ' MB'


    const renderContent = () => {
        if (viewMode === 'gallery') {
            return (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 p-4">
                    {/* Folders */}
                    {folders.map(folder => (
                        <Card
                            key={folder.id}
                            className="group hover:shadow-lg transition-all duration-300 border-slate-200 dark:border-slate-800 bg-blue-50/30 dark:bg-blue-900/10 cursor-pointer"
                            onClick={() => navigateToFolder(folder)}
                        >
                            <CardContent className="p-0">
                                <div className="p-6 flex items-start justify-between gap-4">
                                    <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-xl text-blue-600 dark:text-blue-400">
                                        <Folder className="w-6 h-6" />
                                    </div>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                            <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <MoreVertical className="w-4 h-4 text-slate-400" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setItemToRename({ type: 'folder', item: folder }); setRenameValue(folder.name); setIsRenameOpen(true); }}>
                                                <Edit2 className="w-4 h-4 mr-2" /> Renombrar
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setItemToDelete({ type: 'folder', item: folder }); }} className="text-red-600 focus:text-red-600">
                                                <Trash2 className="w-4 h-4 mr-2" /> Eliminar
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>
                                <div className="px-6 pb-6">
                                    <h3 className="font-semibold text-slate-900 dark:text-white truncate" title={folder.name}>
                                        {folder.name}
                                    </h3>
                                    <p className="text-xs text-slate-500 mt-1">Carpeta</p>
                                </div>
                            </CardContent>
                        </Card>
                    ))}

                    {/* Files */}
                    {files.map(file => (
                        <Card key={file.id} className="group hover:shadow-lg transition-all duration-300 border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80">
                            <CardContent className="p-0">
                                <div className="p-6 flex items-start justify-between gap-4">
                                    <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-xl text-slate-600 dark:text-slate-400">
                                        <FileText className="w-6 h-6" />
                                    </div>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <MoreVertical className="w-4 h-4 text-slate-400" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuItem onClick={() => handlePreview(file)}>
                                                <Eye className="w-4 h-4 mr-2" /> Ver
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => handleDownload(file)}>
                                                <Download className="w-4 h-4 mr-2" /> Descargar
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => { setItemToRename({ type: 'file', item: file }); setRenameValue(file.name); setIsRenameOpen(true); }}>
                                                <Edit2 className="w-4 h-4 mr-2" /> Renombrar
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => setItemToDelete({ type: 'file', item: file })} className="text-red-600 focus:text-red-600">
                                                <Trash2 className="w-4 h-4 mr-2" /> Eliminar
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>
                                <div className="px-6 pb-2">
                                    <h3 className="font-semibold text-slate-900 dark:text-white text-base leading-snug whitespace-normal break-words line-clamp-2 h-10" title={file.name}>
                                        {file.name}
                                    </h3>
                                    <p className="text-xs text-slate-500 mt-2">
                                        {formatSize(file.file_size)} • {formatDate(file.created_at)}
                                    </p>
                                </div>
                                <div className="p-4 bg-slate-50 dark:bg-slate-950/50 flex items-center gap-2 mt-2">
                                    <Button
                                        variant="outline" size="sm" className="flex-1 gap-2 hover:bg-white dark:hover:bg-slate-800"
                                        onClick={() => handlePreview(file)}
                                    >
                                        <Eye className="w-4 h-4" /> Ver
                                    </Button>
                                    <Button
                                        variant="default" size="sm" className="flex-1 gap-2"
                                        onClick={() => handleDownload(file)}
                                    >
                                        <Download className="w-4 h-4" /> Bajar
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )
        }

        if (viewMode === 'icons') {
            return (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 p-4">
                    {folders.map(folder => (
                        <div
                            key={folder.id}
                            className="group flex flex-col items-center p-4 bg-blue-50/50 dark:bg-blue-900/10 rounded-xl border border-blue-100 dark:border-blue-800/30 hover:shadow-md transition-all cursor-pointer relative"
                            onClick={() => navigateToFolder(folder)}
                        >
                            <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center text-blue-500 mb-3">
                                <Folder className="w-8 h-8" />
                            </div>
                            <p className="text-sm font-medium text-center text-slate-900 dark:text-white w-full truncate">
                                {folder.name}
                            </p>
                            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                        <Button variant="ghost" size="icon" className="h-6 w-6">
                                            <MoreVertical className="w-3 h-3 text-slate-400" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setItemToRename({ type: 'folder', item: folder }); setRenameValue(folder.name); setIsRenameOpen(true); }}>Renombrar</DropdownMenuItem>
                                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setItemToDelete({ type: 'folder', item: folder }); }} className="text-red-600">Eliminar</DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                        </div>
                    ))}
                    {files.map(file => (
                        <div key={file.id} className="group flex flex-col items-center p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 hover:shadow-md transition-all cursor-pointer relative" onClick={() => handlePreview(file)}>
                            <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800 rounded-lg flex items-center justify-center text-slate-500 mb-3">
                                <File className="w-8 h-8" />
                            </div>
                            <p className="text-sm font-medium text-center text-slate-900 dark:text-white w-full whitespace-normal break-words leading-tight line-clamp-2">
                                {file.name}
                            </p>
                            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                        <Button variant="ghost" size="icon" className="h-6 w-6 bg-white/50 backdrop-blur-sm">
                                            <MoreVertical className="w-3 h-3 text-slate-600" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleDownload(file) }}>Descargar</DropdownMenuItem>
                                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setItemToRename({ type: 'file', item: file }); setRenameValue(file.name); setIsRenameOpen(true); }}>Renombrar</DropdownMenuItem>
                                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setItemToDelete({ type: 'file', item: file }) }} className="text-red-600">Eliminar</DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                        </div>
                    ))}
                </div>
            )
        }

        if (viewMode === 'list') {
            return (
                <div className="p-4">
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
                                {folders.map(folder => (
                                    <tr key={folder.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer" onClick={() => navigateToFolder(folder)}>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-3">
                                                <Folder className="w-4 h-4 text-blue-500" />
                                                <span className="font-medium text-slate-900 dark:text-white">{folder.name}</span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-slate-500">{formatDate(folder.created_at)}</td>
                                        <td className="px-4 py-3 text-slate-500">-</td>
                                        <td className="px-4 py-3 text-right">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8">
                                                        <MoreVertical className="w-4 h-4 text-slate-400" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setItemToRename({ type: 'folder', item: folder }); setRenameValue(folder.name); setIsRenameOpen(true); }}>Renombrar</DropdownMenuItem>
                                                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setItemToDelete({ type: 'folder', item: folder }); }} className="text-red-600">Eliminar</DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </td>
                                    </tr>
                                ))}
                                {files.map(file => (
                                    <tr key={file.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-3">
                                                <FileText className="w-4 h-4 text-slate-500" />
                                                <span className="font-medium text-slate-900 dark:text-white">{file.name}</span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-slate-500">{formatDate(file.created_at)}</td>
                                        <td className="px-4 py-3 text-slate-500">{formatSize(file.file_size)}</td>
                                        <td className="px-4 py-3 text-right">
                                            <div className="flex items-center justify-end gap-1">
                                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handlePreview(file)} title="Ver">
                                                    <Eye className="w-4 h-4 text-slate-400" />
                                                </Button>
                                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDownload(file)} title="Descargar">
                                                    <Download className="w-4 h-4 text-slate-400" />
                                                </Button>
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" size="icon" className="h-8 w-8">
                                                            <MoreVertical className="w-4 h-4 text-slate-400" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        <DropdownMenuItem onClick={() => { setItemToRename({ type: 'file', item: file }); setRenameValue(file.name); setIsRenameOpen(true); }}>Renombrar</DropdownMenuItem>
                                                        <DropdownMenuItem onClick={() => setItemToDelete({ type: 'file', item: file })} className="text-red-600">Eliminar</DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )
        }
    }

    return (
        <div className="space-y-6 max-w-7xl mx-auto p-4 md:p-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">Mis Documentos</h1>
                    <p className="text-slate-500">Gestiona tus archivos personales de forma segura.</p>
                </div>
                <div className="flex gap-2">
                    <Button onClick={() => setIsNewFolderOpen(true)} variant="outline" className="gap-2">
                        <Plus className="w-4 h-4" />
                        Nueva Carpeta
                    </Button>
                    <div className="relative">
                        <input
                            type="file"
                            onChange={handleFileUpload}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            disabled={uploading}
                        />
                        <Button disabled={uploading} className="gap-2">
                            <Upload className="w-4 h-4" />
                            {uploading ? 'Subiendo...' : 'Subir Archivo'}
                        </Button>
                    </div>
                </div>
            </div>

            {/* Toolbar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white dark:bg-slate-950 p-2 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                {/* Search */}
                <div className="flex items-center gap-2 flex-1 w-full sm:max-w-xs bg-slate-50 dark:bg-slate-900 p-1.5 rounded-lg border border-slate-200 dark:border-slate-800">
                    <Search className="w-4 h-4 text-muted-foreground ml-2" />
                    <Input
                        placeholder="Buscar en todos los archivos..."
                        className="border-none shadow-none focus-visible:ring-0 h-8 bg-transparent"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                {/* View Switcher/Breadcrumbs Helper */}
                <div className="flex items-center gap-4">
                    {/* Breadcrumbs (only show if not searching) */}
                    {!searchTerm && (
                        <div className="flex items-center gap-2 text-sm text-slate-500 overflow-x-auto max-w-[200px] sm:max-w-md">
                            <button
                                onClick={() => navigateUp(-1)}
                                className={`flex items-center hover:text-primary transition-colors hover:bg-slate-100 p-1 rounded ${!currentFolder ? 'text-slate-900 font-medium' : ''}`}
                            >
                                <Home className="w-4 h-4" />
                            </button>
                            {folderPath.map((crumb, idx) => (
                                <div key={crumb.id} className="flex items-center gap-1 whitespace-nowrap">
                                    <ChevronRight className="w-3 h-3 text-slate-400" />
                                    <button
                                        onClick={() => navigateUp(idx)}
                                        className={`hover:text-primary hover:underline px-1 rounded ${idx === folderPath.length - 1 ? 'font-medium text-slate-900' : ''}`}
                                    >
                                        {crumb.name}
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}

                    <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-900 p-1 rounded-lg shrink-0">
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
            </div>

            {/* Content Content */}
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 min-h-[400px]">
                {loading ? (
                    <div className="flex items-center justify-center h-full p-12">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    </div>
                ) : (files.length === 0 && folders.length === 0) ? (
                    <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                        {searchTerm ? (
                            <>
                                <Search className="w-12 h-12 mb-4 opacity-20" />
                                <p>No se encontraron resultados para "{searchTerm}"</p>
                            </>
                        ) : (
                            <>
                                <Folder className="w-12 h-12 mb-4 opacity-20" />
                                <p>Esta carpeta está vacía</p>
                            </>
                        )}
                    </div>
                ) : (
                    renderContent()
                )}
            </div>

            {/* Dialogs */}

            {/* New Folder */}
            <Dialog open={isNewFolderOpen} onOpenChange={setIsNewFolderOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Nueva Carpeta</DialogTitle>
                    </DialogHeader>
                    <div className="py-2">
                        <Label>Nombre de la carpeta</Label>
                        <Input
                            value={newFolderName}
                            onChange={(e) => setNewFolderName(e.target.value)}
                            placeholder="Ej. Contratos Marzo"
                            className="mt-2"
                        />
                    </div>
                    <DialogFooter>
                        <Button onClick={handleCreateFolder}>Crear</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Rename */}
            <Dialog open={isRenameOpen} onOpenChange={setIsRenameOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Renombrar</DialogTitle>
                    </DialogHeader>
                    <div className="py-2">
                        <Label>Nuevo nombre</Label>
                        <Input
                            value={renameValue}
                            onChange={(e) => setRenameValue(e.target.value)}
                            className="mt-2"
                        />
                    </div>
                    <DialogFooter>
                        <Button onClick={handleRename}>Guardar</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation */}
            <AlertDialog open={!!itemToDelete} onOpenChange={(open) => !open && setItemToDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Esta acción eliminará "{itemToDelete?.item.name}" permanentemente.
                            {itemToDelete?.type === 'folder' && " Todo el contenido de la carpeta también será eliminado."}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">Eliminar</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Preview Dialog */}
            <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
                <DialogContent className="max-w-4xl h-[80vh] flex flex-col">
                    <DialogHeader>
                        <DialogTitle className="truncate pr-8">{previewTitle}</DialogTitle>
                    </DialogHeader>
                    <div className="flex-1 bg-slate-100 rounded-lg overflow-hidden relative">
                        {previewUrl && (
                            <>
                                {/\.(png|jpe?g|gif|webp|svg)$/i.test(previewTitle) ? (
                                    <div className="w-full h-full flex items-center justify-center p-4">
                                        <img
                                            src={previewUrl}
                                            alt={previewTitle}
                                            className="max-w-full max-h-full object-contain shadow-lg"
                                        />
                                    </div>
                                ) : /\.pdf$/i.test(previewTitle) ? (
                                    <iframe
                                        src={`${previewUrl}#toolbar=0`}
                                        className="w-full h-full border-0"
                                        title="PDF Preview"
                                    />
                                ) : (
                                    <iframe
                                        src={
                                            /\.(xls|xlsx|xlsm|xlsb|xltx|xlt|doc|docx|docm|ppt|pptx|pptm)$/i.test(previewTitle)
                                                ? `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(previewUrl)}`
                                                : `https://docs.google.com/viewer?url=${encodeURIComponent(previewUrl)}&embedded=true`
                                        }
                                        className="w-full h-full border-0"
                                        frameBorder="0"
                                        title="Document Preview"
                                    />
                                )}
                            </>
                        )}
                        {!previewUrl && (
                            <div className="absolute inset-0 flex items-center justify-center text-slate-400">
                                <div className="flex flex-col items-center gap-2">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                                    <p>Cargando previsualización...</p>
                                </div>
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    )
}
