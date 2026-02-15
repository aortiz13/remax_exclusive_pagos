
import { useState, useEffect } from 'react'
import { supabase } from '../services/supabase'
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
    Home
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
} from '@/components/ui'
import { toast } from 'sonner'

export default function AgentDocuments() {
    const { profile } = useAuth()
    const [folders, setFolders] = useState([])
    const [files, setFiles] = useState([])
    const [loading, setLoading] = useState(true)
    const [currentFolder, setCurrentFolder] = useState(null) // null = root
    const [folderPath, setFolderPath] = useState([]) // Array of {id, name}

    // Actions State
    const [isNewFolderOpen, setIsNewFolderOpen] = useState(false)
    const [newFolderName, setNewFolderName] = useState('')

    const [isRenameOpen, setIsRenameOpen] = useState(false)
    const [itemToRename, setItemToRename] = useState(null) // { type: 'folder'|'file', item }
    const [renameValue, setRenameValue] = useState('')

    const [itemToDelete, setItemToDelete] = useState(null) // { type: 'folder'|'file', item }

    const [uploading, setUploading] = useState(false)

    useEffect(() => {
        if (profile) {
            fetchContents(currentFolder)
        }
    }, [currentFolder, profile])

    const fetchContents = async (folderId) => {
        try {
            setLoading(true)

            // 1. Fetch Folders
            let foldersQuery = supabase
                .from('agent_folders')
                .select('*')
                .eq('user_id', profile.id)
                .order('name')

            if (folderId) {
                foldersQuery = foldersQuery.eq('parent_id', folderId)
            } else {
                foldersQuery = foldersQuery.is('parent_id', null)
            }

            const { data: folderData, error: folderError } = await foldersQuery
            if (folderError) throw folderError

            // 2. Fetch Files
            let filesQuery = supabase
                .from('agent_files')
                .select('*')
                .eq('user_id', profile.id)
                .order('name')

            if (folderId) {
                filesQuery = filesQuery.eq('folder_id', folderId)
            } else {
                filesQuery = filesQuery.is('folder_id', null)
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
            fetchContents(currentFolder)
        } catch (error) {
            console.error('Error creating folder:', error)
            toast.error('Error al crear carpeta')
        }
    }

    const handleFileUpload = async (event) => {
        const file = event.target.files[0]
        if (!file) return

        try {
            setUploading(true)
            const fileExt = file.name.split('.').pop()
            // Storage path: user_id/filename (or user_id/folder_id/filename)
            // To prevent collisions and allow same filenames in different folders, we use a UUID prefix or full path.
            // Let's use: user_id/{timestamp}_filename
            const storagePath = `${profile.id}/${Date.now()}_${file.name}`

            // 1. Upload to Storage
            const { error: uploadError } = await supabase.storage
                .from('agent_documents')
                .upload(storagePath, file)

            if (uploadError) throw uploadError

            // 2. Insert into DB
            const { error: dbError } = await supabase.from('agent_files').insert({
                name: file.name,
                storage_path: storagePath,
                file_type: fileExt,
                file_size: file.size,
                user_id: profile.id,
                folder_id: currentFolder
            })

            if (dbError) throw dbError

            toast.success('Archivo subido')
            fetchContents(currentFolder)

        } catch (error) {
            console.error('Error uploading file:', error)
            toast.error('Error al subir archivo')
        } finally {
            setUploading(false)
            // Reset input
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
            fetchContents(currentFolder)
        } catch (error) {
            console.error('Error renaming:', error)
            toast.error('Error al renombrar')
        }
    }

    const handleDelete = async () => {
        if (!itemToDelete) return

        try {
            if (itemToDelete.type === 'file') {
                // Delete from Storage first
                const { error: storageError } = await supabase.storage
                    .from('agent_documents')
                    .remove([itemToDelete.item.storage_path])

                if (storageError) console.error('Storage delete error:', storageError)

                // DB delete cascades normally, but explicit delete is safer
                const { error: dbError } = await supabase
                    .from('agent_files')
                    .delete()
                    .eq('id', itemToDelete.item.id)
                    .eq('user_id', profile.id)

                if (dbError) throw dbError
            } else {
                // Delete Folder
                // DB Cascade should handle children, but we verify
                // Warning: Deleting a folder with files via Cascade in DB does NOT delete files from Storage automatically.
                // ideally we should list all children files and delete them from storage. 
                // For this MVP, we rely on DB cascade for metadata, but storage might accumulate orphans.
                // TODO: Implement recursive storage deletion via Edge Function or client-side loop.

                const { error } = await supabase
                    .from('agent_folders')
                    .delete()
                    .eq('id', itemToDelete.item.id)
                    .eq('user_id', profile.id)

                if (error) throw error
            }

            toast.success('Eliminado exitosamente')
            setItemToDelete(null)
            fetchContents(currentFolder)

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

    const navigateToFolder = (folder) => {
        setFolderPath(prev => [...prev, { id: folder.id, name: folder.name }])
        setCurrentFolder(folder.id)
    }

    const navigateUp = (index) => {
        if (index === -1) {
            // Root
            setFolderPath([])
            setCurrentFolder(null)
        } else {
            // Go to specific crumb
            const newPath = folderPath.slice(0, index + 1)
            setFolderPath(newPath)
            setCurrentFolder(newPath[newPath.length - 1].id)
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

            {/* Breadcrumbs */}
            <div className="flex items-center gap-2 text-sm text-slate-500 overflow-x-auto pb-2">
                <button
                    onClick={() => navigateUp(-1)}
                    className="flex items-center hover:text-primary transition-colors hover:bg-slate-100 p-1 rounded"
                >
                    <Home className="w-4 h-4" />
                </button>
                {folderPath.map((crumb, idx) => (
                    <div key={crumb.id} className="flex items-center gap-2 whitespace-nowrap">
                        <ChevronRight className="w-4 h-4" />
                        <button
                            onClick={() => navigateUp(idx)}
                            className="font-medium text-slate-900 dark:text-white hover:underline"
                        >
                            {crumb.name}
                        </button>
                    </div>
                ))}
            </div>

            {/* Content */}
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 min-h-[400px]">
                {loading ? (
                    <div className="flex items-center justify-center h-full p-12">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    </div>
                ) : (files.length === 0 && folders.length === 0) ? (
                    <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                        <Folder className="w-12 h-12 mb-4 opacity-20" />
                        <p>Esta carpeta está vacía</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 p-4">
                        {/* Folders */}
                        {folders.map(folder => (
                            <div
                                key={folder.id}
                                className="group flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-950/50 rounded-xl border border-slate-100 dark:border-slate-800 hover:border-blue-200 hover:bg-blue-50/50 transition-all cursor-pointer"
                                onClick={() => navigateToFolder(folder)}
                            >
                                <div className="flex items-center gap-3 overflow-hidden">
                                    <Folder className="w-8 h-8 text-blue-400 fill-blue-400/20" />
                                    <span className="font-medium text-slate-700 dark:text-slate-200 truncate">{folder.name}</span>
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
                        ))}

                        {/* Files */}
                        {files.map(file => (
                            <div
                                key={file.id}
                                className="group flex items-start justify-between p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 hover:shadow-md transition-all"
                            >
                                <div className="flex items-center gap-3 overflow-hidden">
                                    <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 shrink-0">
                                        <File className="w-5 h-5" />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="font-medium text-sm text-slate-900 dark:text-white truncate" title={file.name}>{file.name}</p>
                                        <p className="text-xs text-slate-500">{(file.file_size / 1024 / 1024).toFixed(2)} MB</p>
                                    </div>
                                </div>
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <MoreVertical className="w-4 h-4 text-slate-400" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
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
                        ))}
                    </div>
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
        </div>
    )
}
