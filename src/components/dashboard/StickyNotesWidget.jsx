import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../services/supabase'
import { useAuth } from '../../context/AuthContext'
import { Card, CardContent, CardHeader, CardTitle, Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, Textarea } from '@/components/ui'
import { Plus, MoreVertical, Trash2, Palette, Save, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'

const COLORS = [
    { name: 'Yellow', value: 'bg-yellow-100 dark:bg-yellow-900/40', border: 'border-yellow-200 dark:border-yellow-800' },
    { name: 'Blue', value: 'bg-blue-100 dark:bg-blue-900/40', border: 'border-blue-200 dark:border-blue-800' },
    { name: 'Green', value: 'bg-green-100 dark:bg-green-900/40', border: 'border-green-200 dark:border-green-800' },
    { name: 'Red', value: 'bg-red-100 dark:bg-red-900/40', border: 'border-red-200 dark:border-red-800' },
    { name: 'Purple', value: 'bg-purple-100 dark:bg-purple-900/40', border: 'border-purple-200 dark:border-purple-800' },
]

function NoteItem({ note, onUpdate, onDelete }) {
    const [content, setContent] = useState(note.content || '')
    const [isEditing, setIsEditing] = useState(false)
    const [showMentions, setShowMentions] = useState(false)
    const [contacts, setContacts] = useState([])
    const [mentionLoading, setMentionLoading] = useState(false)
    const [cursorPos, setCursorPos] = useState(0)
    const textareaRef = useRef(null)
    const navigate = useNavigate()

    useEffect(() => {
        setContent(note.content || '')
    }, [note.content])

    const fetchContacts = async (query) => {
        if (!query) {
            setContacts([])
            return
        }
        setMentionLoading(true)
        try {
            const { data, error } = await supabase
                .from('contacts')
                .select('id, first_name, last_name')
                .ilike('first_name', `%${query}%`)
                .limit(5)

            if (error) throw error
            setContacts(data || [])
        } catch (error) {
            console.error('Error searching contacts:', error)
        } finally {
            setMentionLoading(false)
        }
    }

    const handleInput = (e) => {
        const val = e.target.value
        const newCursorPos = e.target.selectionStart
        setContent(val)

        // Detect Mention
        const textBeforeCursor = val.slice(0, newCursorPos)
        const lastAt = textBeforeCursor.lastIndexOf('@')

        if (lastAt !== -1) {
            const query = textBeforeCursor.slice(lastAt + 1)
            // Allow simplified search
            if (!query.includes('\n') && query.length < 20) {
                setShowMentions(true)
                setCursorPos(lastAt)
                fetchContacts(query)
                return
            }
        }
        setShowMentions(false)
    }

    const selectContact = async (contact) => {
        const textBefore = content.slice(0, cursorPos)
        const textAfter = content.slice(textareaRef.current.selectionStart)
        // Store just the name for cleaner UI: @First Last
        const newContent = `${textBefore}@${contact.first_name} ${contact.last_name} ${textAfter}`

        setContent(newContent)
        setShowMentions(false)

        setTimeout(() => {
            if (textareaRef.current) textareaRef.current.focus()
        }, 0)

        // Log mention (optional)
        try {
            await supabase.from('contact_activities').insert([{
                contact_id: contact.id,
                type: 'note',
                description: `Mencionado en nota rápida`
            }])
        } catch (e) {
            // ignore error
        }
    }

    const handleBlur = () => {
        setIsEditing(false)
        if (content !== note.content) {
            onUpdate(note.id, { content })
        }
    }

    const handleNameClick = async (e, fullName) => {
        e.stopPropagation()
        // Try to find the contact by name
        // Use full name split to search
        const parts = fullName.trim().split(' ')
        if (parts.length < 1) return

        try {
            // Search by trying to match First Name OR Last Name with the first word of the tag
            let query = supabase.from('contacts').select('id')

            if (parts.length >= 1) {
                query = query.ilike('first_name', `%${parts[0]}%`)
            }

            const { data } = await query.limit(1)

            if (data && data.length > 0) {
                navigate(`/crm/contact/${data[0].id}`)
            } else {
                toast.error('Contacto no encontrado')
            }
        } catch (err) {
            console.error(err)
        }
    }

    const [bgClass, borderClass] = (note.color || 'bg-yellow-100 dark:bg-yellow-900/40|border-yellow-200').split('|')

    // Parse content for rendering
    const renderContent = () => {
        if (!content) return <span className="text-slate-400 italic">Escribe algo...</span>

        // Regex: Matches @Word Word or @Word
        const parts = content.split(/(@[\w\u00C0-\u00FF]+(?:\s[\w\u00C0-\u00FF]+)?)/g)

        return parts.map((part, i) => {
            if (part && part.startsWith('@') && part.length > 1) {
                const name = part.substring(1) // remove @
                return (
                    <span
                        key={i}
                        className="font-bold cursor-pointer hover:underline text-slate-900 dark:text-slate-100"
                        onClick={(e) => handleNameClick(e, name)}
                    >
                        {name}
                    </span>
                )
            }
            return <span key={i}>{part}</span>
        })
    }

    return (
        <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className={`relative p-3 rounded-xl border ${borderClass} ${bgClass} shadow-sm group transition-all`}
        >
            <div className="relative min-h-[80px]" onClick={() => setIsEditing(true)}>
                {isEditing ? (
                    <>
                        <Textarea
                            ref={textareaRef}
                            value={content}
                            onChange={handleInput}
                            onBlur={handleBlur}
                            autoFocus
                            placeholder="Escribe algo... Usa @ para mencionar"
                            className="min-h-[80px] bg-transparent border-none resize-none focus-visible:ring-0 p-0 text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-500/50"
                        />
                        {showMentions && (
                            <div className="absolute z-10 top-full left-0 mt-2 w-48 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
                                {mentionLoading ? (
                                    <div className="p-2 text-xs text-slate-500 flex items-center justify-center">
                                        <Loader2 className="w-3 h-3 animate-spin mr-1" /> Buscando...
                                    </div>
                                ) : contacts.length > 0 ? (
                                    <ul className="max-h-32 overflow-y-auto">
                                        {contacts.map(contact => (
                                            <li
                                                key={contact.id}
                                                onMouseDown={(e) => {
                                                    e.preventDefault() // Prevent blur
                                                    selectContact(contact)
                                                }}
                                                className="px-3 py-2 text-xs hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer text-slate-700 dark:text-slate-200"
                                            >
                                                {contact.first_name} {contact.last_name}
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    <div className="p-2 text-xs text-slate-500 text-center">No encontrado</div>
                                )}
                            </div>
                        )}
                    </>
                ) : (
                    <div className="text-sm text-slate-800 dark:text-slate-100 whitespace-pre-wrap break-words">
                        {renderContent()}
                    </div>
                )}
            </div>

            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button size="icon" variant="ghost" className="h-6 w-6 rounded-full hover:bg-black/5 dark:hover:bg-white/10">
                            <Palette className="h-3 w-3 text-slate-500" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        {COLORS.map(color => (
                            <DropdownMenuItem
                                key={color.name}
                                onClick={() => onUpdate(note.id, { color: color.value + '|' + color.border })}
                                className="gap-2"
                            >
                                <div className={`w-4 h-4 rounded-full ${color.value.split(' ')[0]} border border-slate-200`} />
                                {color.name}
                            </DropdownMenuItem>
                        ))}
                    </DropdownMenuContent>
                </DropdownMenu>

                <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6 rounded-full hover:bg-red-500/10 hover:text-red-600"
                    onClick={() => onDelete(note.id)}
                >
                    <Trash2 className="h-3 w-3" />
                </Button>
            </div>
        </motion.div>
    )
}

export default function StickyNotesWidget() {
    const { user } = useAuth()
    const [notes, setNotes] = useState([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (user) fetchNotes()
    }, [user])

    const fetchNotes = async () => {
        try {
            const { data, error } = await supabase
                .from('sticky_notes')
                .select('*')
                .order('created_at', { ascending: false })

            if (error) throw error
            setNotes(data || [])
        } catch (error) {
            console.error('Error fetching notes:', error)
        } finally {
            setLoading(false)
        }
    }

    const createNote = async () => {
        try {
            const newNote = {
                user_id: user.id,
                content: '',
                color: COLORS[0].value + '|' + COLORS[0].border,
                position: { x: 0, y: 0 }
            }

            const { data, error } = await supabase
                .from('sticky_notes')
                .insert([newNote])
                .select()
                .single()

            if (error) throw error
            setNotes([data, ...notes])
        } catch (error) {
            console.error('Error creating note:', error)
            toast.error('No se pudo crear la nota')
        }
    }

    const updateNote = async (id, updates) => {
        setNotes(prev => prev.map(n => n.id === id ? { ...n, ...updates } : n))

        try {
            const { error } = await supabase
                .from('sticky_notes')
                .update(updates)
                .eq('id', id)

            if (error) throw error
        } catch (error) {
            console.error('Error updating note:', error)
            toast.error('Error al guardar cambios')
        }
    }

    const deleteNote = async (id) => {
        try {
            const { error } = await supabase
                .from('sticky_notes')
                .delete()
                .eq('id', id)

            if (error) throw error
            setNotes(prev => prev.filter(n => n.id !== id))
            toast.success('Nota eliminada')
        } catch (error) {
            console.error('Error deleting note:', error)
            toast.error('Error al eliminar la nota')
        }
    }

    return (
        <Card className="h-full border-dashed border-2 shadow-none bg-transparent">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-lg font-medium">Notas Rápidas</CardTitle>
                <Button size="sm" variant="ghost" onClick={createNote} className="h-8 w-8 p-0 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full">
                    <Plus className="h-4 w-4" />
                </Button>
            </CardHeader>
            <CardContent className="h-[calc(100%-60px)] overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-800">
                <AnimatePresence>
                    {notes.length === 0 && !loading ? (
                        <div className="flex flex-col items-center justify-center h-full text-slate-400 text-sm italic">
                            <p>No tienes notas.</p>
                            <p>¡Crea una nueva con +!</p>
                        </div>
                    ) : (
                        notes.map(note => (
                            <NoteItem
                                key={note.id}
                                note={note}
                                onUpdate={updateNote}
                                onDelete={deleteNote}
                            />
                        ))
                    )}
                </AnimatePresence>
            </CardContent>
        </Card>
    )
}
