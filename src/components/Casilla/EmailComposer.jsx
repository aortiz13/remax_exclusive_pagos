import React, { useState, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Underline from '@tiptap/extension-underline';
import { Button } from '@/components/ui';
import {
    Send, X, Paperclip, Trash2,
    Bold, Italic, Underline as UnderlineIcon, Strikethrough,
    List, ListOrdered, Quote, Undo, Redo, Link as LinkIcon,
    ListTodo, Activity
} from 'lucide-react';
import { supabase } from '../../services/supabase';
import TaskModal from '../crm/TaskModal';
import ActionModal from '../crm/ActionModal';

// Helper component for the Link Popover
const LinkPopover = ({ editor, isOpen, onClose }) => {
    const [url, setUrl] = useState('');

    if (!isOpen) return null;

    const handleSubmit = (e) => {
        e.preventDefault();
        if (url === '') {
            editor.chain().focus().extendMarkRange('link').unsetLink().run();
        } else {
            editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
        }
        onClose();
        setUrl('');
    };

    return (
        <div className="absolute z-50 bg-white border border-gray-200 shadow-xl rounded-md p-3 w-72 mt-2" style={{ top: '100%', left: 0 }}>
            <form onSubmit={handleSubmit} className="flex flex-col gap-2">
                <input
                    type="url"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://ejemplo.com"
                    className="flex-1 px-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:border-blue-500"
                    autoFocus
                />
                <div className="flex justify-end gap-2 mt-1">
                    <Button type="button" variant="ghost" size="sm" onClick={onClose} className="text-gray-500">
                        Cancelar
                    </Button>
                    <Button type="submit" size="sm" className="bg-blue-600 text-white hover:bg-blue-700">
                        Aplicar
                    </Button>
                </div>
            </form>
        </div>
    );
};

const MenuBar = ({ editor }) => {
    const [isLinkOpen, setIsLinkOpen] = useState(false);

    if (!editor) return null;

    return (
        <div className="flex border-b border-gray-100 p-2 gap-1 bg-gray-50 flex-wrap relative">
            <button
                onClick={() => editor.chain().focus().toggleBold().run()}
                className={`p-1.5 rounded hover:bg-gray-200 transition-colors ${editor.isActive('bold') ? 'bg-gray-200 text-blue-600' : 'text-gray-600'}`}
                title="Negrita"
            >
                <Bold className="w-4 h-4" />
            </button>
            <button
                onClick={() => editor.chain().focus().toggleItalic().run()}
                className={`p-1.5 rounded hover:bg-gray-200 transition-colors ${editor.isActive('italic') ? 'bg-gray-200 text-blue-600' : 'text-gray-600'}`}
                title="Cursiva"
            >
                <Italic className="w-4 h-4" />
            </button>
            <button
                onClick={() => editor.chain().focus().toggleUnderline().run()}
                className={`p-1.5 rounded hover:bg-gray-200 transition-colors ${editor.isActive('underline') ? 'bg-gray-200 text-blue-600' : 'text-gray-600'}`}
                title="Subrayado"
            >
                <UnderlineIcon className="w-4 h-4" />
            </button>
            <button
                onClick={() => editor.chain().focus().toggleStrike().run()}
                className={`p-1.5 rounded hover:bg-gray-200 transition-colors ${editor.isActive('strike') ? 'bg-gray-200 text-blue-600' : 'text-gray-600'}`}
                title="Tachado"
            >
                <Strikethrough className="w-4 h-4" />
            </button>

            <div className="w-px h-6 bg-gray-300 mx-1 self-center" />

            <button
                onClick={() => editor.chain().focus().toggleBulletList().run()}
                className={`p-1.5 rounded hover:bg-gray-200 transition-colors ${editor.isActive('bulletList') ? 'bg-gray-200 text-blue-600' : 'text-gray-600'}`}
                title="Lista con viñetas"
            >
                <List className="w-4 h-4" />
            </button>
            <button
                onClick={() => editor.chain().focus().toggleOrderedList().run()}
                className={`p-1.5 rounded hover:bg-gray-200 transition-colors ${editor.isActive('orderedList') ? 'bg-gray-200 text-blue-600' : 'text-gray-600'}`}
                title="Lista numerada"
            >
                <ListOrdered className="w-4 h-4" />
            </button>
            <button
                onClick={() => editor.chain().focus().toggleBlockquote().run()}
                className={`p-1.5 rounded hover:bg-gray-200 transition-colors ${editor.isActive('blockquote') ? 'bg-gray-200 text-blue-600' : 'text-gray-600'}`}
                title="Cita"
            >
                <Quote className="w-4 h-4" />
            </button>

            <div className="w-px h-6 bg-gray-300 mx-1 self-center" />

            <div className="relative">
                <button
                    onClick={() => setIsLinkOpen(!isLinkOpen)}
                    className={`p-1.5 rounded hover:bg-gray-200 transition-colors ${editor.isActive('link') ? 'bg-gray-200 text-blue-600' : 'text-gray-600'}`}
                    title="Enlace"
                >
                    <LinkIcon className="w-4 h-4" />
                </button>
                <LinkPopover editor={editor} isOpen={isLinkOpen} onClose={() => setIsLinkOpen(false)} />
            </div>

            <div className="flex-1" />

            <button
                onClick={() => editor.chain().focus().undo().run()}
                disabled={!editor.can().chain().focus().undo().run()}
                className="p-1.5 rounded hover:bg-gray-200 text-gray-600 disabled:opacity-50 disabled:hover:bg-transparent transition-colors"
                title="Deshacer"
            >
                <Undo className="w-4 h-4" />
            </button>
            <button
                onClick={() => editor.chain().focus().redo().run()}
                disabled={!editor.can().chain().focus().redo().run()}
                className="p-1.5 rounded hover:bg-gray-200 text-gray-600 disabled:opacity-50 disabled:hover:bg-transparent transition-colors"
                title="Rehacer"
            >
                <Redo className="w-4 h-4" />
            </button>
        </div>
    );
};

const EmailComposer = ({ onClose, onSuccess, replyTo = null, userProfile, initialDraft = null, draftId = null }) => {
    const fileInputRef = useRef(null);

    // Get the latest message to reply to if available
    const lastMessage = replyTo?.email_messages?.length
        ? [...replyTo.email_messages].sort((a, b) => new Date(b.received_at) - new Date(a.received_at))[0]
        : null;

    // Default 'to' is the sender of the last message. If we sent it, reply to the receiver.
    const defaultTo = lastMessage
        ? (lastMessage.from_address?.includes('remax-exclusive.cl') ? lastMessage.to_address : lastMessage.from_address)
        : (initialDraft?.to || '');

    const initialBody = initialDraft?.html || '<p></p>';

    const [to, setTo] = useState(defaultTo || '');
    const [subject, setSubject] = useState(
        replyTo
            ? (replyTo.subject?.toLowerCase().startsWith('re:') ? replyTo.subject : `Re: ${replyTo.subject}`)
            : (initialDraft?.subject || '')
    );
    const [isSending, setIsSending] = useState(false);
    const [attachments, setAttachments] = useState([]);

    // Task / Action linking
    const [linkedTask, setLinkedTask] = useState(null);   // { id, action (title) }
    const [linkedAction, setLinkedAction] = useState(null); // { id, action_type }
    const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
    const [isActionModalOpen, setIsActionModalOpen] = useState(false);
    const [contactIdForLink, setContactIdForLink] = useState(null);

    // Look up contact by 'to' email then open the modal
    const resolveContactAndOpen = async (openFn) => {
        let contactId = null;
        const email = to?.trim();
        if (email) {
            const { data } = await supabase
                .from('contacts')
                .select('id')
                .ilike('email', email)
                .limit(1);
            if (data && data.length > 0) contactId = data[0].id;
        }
        setContactIdForLink(contactId);
        openFn(true);
    };

    // When X is clicked, pass current state to parent so it can save as draft
    const handleClose = () => {
        const html = editor?.getHTML() || '';
        onClose({ to, subject, html });
    };

    const editor = useEditor({
        extensions: [
            StarterKit.configure({
                // Explicitly disable history if needed or just keep defaults correctly
            }),
            Link.configure({
                openOnClick: false,
                HTMLAttributes: {
                    class: 'text-blue-600 underline cursor-pointer hover:text-blue-800',
                },
            }),
            Underline,
        ],
        content: initialBody,
        editorProps: {
            attributes: {
                class: 'prose prose-sm sm:prose lg:prose-lg xl:prose-2xl mx-auto focus:outline-none flex-1 overflow-y-auto px-4 py-3 text-sm h-full w-full max-w-none',
            },
        },
    });

    const handleFileChange = (e) => {
        if (e.target.files && e.target.files.length > 0) {
            const newFiles = Array.from(e.target.files);
            const validFiles = [];
            const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB limits

            newFiles.forEach(file => {
                if (file.size > MAX_FILE_SIZE) {
                    alert(`El archivo ${file.name} excede el límite de 20MB.`);
                } else {
                    validFiles.push(file);
                }
            });

            setAttachments(prev => [...prev, ...validFiles]);
        }
    };

    const removeAttachment = (indexToRemove) => {
        setAttachments(prev => prev.filter((_, index) => index !== indexToRemove));
    };

    // Helper to convert file to base64
    const fileToBase64 = (file) => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result.split(',')[1]); // return only the base64 string, without the 'data:type;base64,' prefix
        reader.onerror = error => reject(error);
    });

    const handleSend = async () => {
        if (!editor) return;

        setIsSending(true);
        const bodyHtml = editor.getHTML();

        try {
            // Process attachments
            const processedAttachments = await Promise.all(
                attachments.map(async (file) => {
                    const base64Data = await fileToBase64(file);
                    return {
                        filename: file.name,
                        mimeType: file.type || 'application/octet-stream',
                        data: base64Data
                    };
                })
            );

            const { data: sessionData } = await supabase.auth.getSession();
            const token = sessionData?.session?.access_token;

            console.log('Enviando gmail-send, ¿token presente?:', !!token);

            if (!token) {
                throw new Error('No se pudo encontrar una sesión activa para autenticar la petición.');
            }

            const { data, error } = await supabase.functions.invoke('gmail-send', {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
                body: {
                    to,
                    subject,
                    bodyHtml,
                    replyToMessageId: lastMessage?.rfc_message_id || lastMessage?.gmail_message_id,
                    threadId: replyTo?.gmail_thread_id,
                    attachments: processedAttachments,
                    linkedTaskId: linkedTask?.id || null,
                    linkedActionId: linkedAction?.id || null,
                }
            });

            if (error) throw error;

            if (onSuccess) onSuccess();
            // onClose will be called by onSuccess handler in the parent

        } catch (err) {
            console.error("Failed to send email", err);
            alert("Error al enviar el correo: " + err.message);
        } finally {
            setIsSending(false);
        }
    };

    return (
        <>
            <div className="fixed bottom-0 right-24 w-[600px] h-auto max-h-[600px] min-h-[500px] bg-white rounded-t-xl shadow-2xl border border-gray-200 flex flex-col z-50 overflow-hidden">
                {/* Header */}
                <div className="bg-gray-800 text-white px-4 py-3 flex justify-between items-center rounded-t-xl">
                    <span className="font-medium text-sm">{replyTo ? 'Responder' : initialDraft ? 'Borrador' : 'Nuevo Mensaje'}</span>
                    <button onClick={handleClose} className="text-gray-400 hover:text-white transition-colors">
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Inputs */}
                <div className="px-4 py-2 border-b border-gray-100 flex items-center">
                    <span className="text-gray-500 text-sm w-12">Para:</span>
                    <input
                        type="email"
                        value={to}
                        onChange={(e) => setTo(e.target.value)}
                        className="flex-1 outline-none text-sm p-1"
                        placeholder="correo@ejemplo.com"
                    />
                </div>
                <div className="px-4 py-2 border-b border-gray-100 flex items-center">
                    <span className="text-gray-500 text-sm w-12">Asunto:</span>
                    <input
                        type="text"
                        value={subject}
                        onChange={(e) => setSubject(e.target.value)}
                        className="flex-1 outline-none text-sm p-1 font-medium"
                    />
                </div>

                {/* Editor */}
                <div className="flex-1 flex flex-col min-h-[200px] bg-white overflow-hidden">
                    <MenuBar editor={editor} />
                    <EditorContent editor={editor} className="flex-1 flex flex-col h-full overflow-hidden [&>div]:h-full [&>div]:outline-none" />
                </div>

                {/* Linked Task / Action chips */}
                {(linkedTask || linkedAction) && (
                    <div className="px-4 py-2 border-t border-gray-100 bg-blue-50 flex flex-wrap gap-2">
                        {linkedTask && (
                            <div className="flex items-center gap-1.5 bg-white border border-blue-200 text-blue-700 px-2 py-1 rounded-md text-xs shadow-sm max-w-[260px]">
                                <ListTodo className="w-3.5 h-3.5 shrink-0" />
                                <span className="truncate font-medium">Tarea: {linkedTask.action}</span>
                                <button onClick={() => setLinkedTask(null)} className="text-blue-400 hover:text-red-500 shrink-0 ml-1">
                                    <X className="w-3 h-3" />
                                </button>
                            </div>
                        )}
                        {linkedAction && (
                            <div className="flex items-center gap-1.5 bg-white border border-purple-200 text-purple-700 px-2 py-1 rounded-md text-xs shadow-sm max-w-[260px]">
                                <Activity className="w-3.5 h-3.5 shrink-0" />
                                <span className="truncate font-medium">Acción: {linkedAction.action_type}</span>
                                <button onClick={() => setLinkedAction(null)} className="text-purple-400 hover:text-red-500 shrink-0 ml-1">
                                    <X className="w-3 h-3" />
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {/* Attachments List */}
                {attachments.length > 0 && (
                    <div className="px-4 py-2 border-t border-gray-100 bg-gray-50 flex flex-wrap gap-2 max-h-24 overflow-y-auto">
                        {attachments.map((file, index) => (
                            <div key={index} className="flex items-center gap-1 bg-white border border-gray-200 px-2 py-1 rounded-md text-xs text-gray-700 shadow-sm max-w-[200px]">
                                <Paperclip className="w-3 h-3 text-gray-400 shrink-0" />
                                <span className="truncate">{file.name}</span>
                                <button onClick={() => removeAttachment(index)} className="text-gray-400 hover:text-red-500 shrink-0 ml-1">
                                    <X className="w-3 h-3" />
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                {/* Footer Actions */}
                <div className="p-3 border-t border-gray-100 flex items-center justify-between bg-white">
                    <div className="flex items-center gap-2">
                        <Button
                            onClick={handleSend}
                            disabled={isSending || !to || !subject}
                            className="bg-blue-600 hover:bg-blue-700 text-white gap-2 px-6"
                        >
                            {isSending ? 'Enviando...' : <>Enviar <Send className="w-4 h-4 ml-1" /></>}
                        </Button>

                        <Button
                            variant="ghost"
                            size="icon"
                            className="text-gray-500 hover:bg-blue-50 hover:text-blue-600"
                            onClick={() => resolveContactAndOpen(setIsTaskModalOpen)}
                            title="Crear tarea vinculada"
                        >
                            <ListTodo className="w-5 h-5" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="text-gray-500 hover:bg-purple-50 hover:text-purple-600"
                            onClick={() => resolveContactAndOpen(setIsActionModalOpen)}
                            title="Crear acción vinculada"
                        >
                            <Activity className="w-5 h-5" />
                        </Button>

                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleFileChange}
                            className="hidden"
                            multiple
                        />
                        <Button
                            variant="ghost"
                            size="icon"
                            className="text-gray-500 hover:bg-gray-200"
                            onClick={() => fileInputRef.current?.click()}
                        >
                            <Paperclip className="w-5 h-5" />
                        </Button>
                    </div>
                    <Button variant="ghost" size="icon" className="text-gray-400 hover:bg-gray-200" title="Descartar borrador" onClick={() => onClose(null)}>
                        <Trash2 className="w-5 h-5" />
                    </Button>
                </div>
            </div>

            {/* Task Modal */}
            <TaskModal
                isOpen={isTaskModalOpen}
                contactId={contactIdForLink}
                onClose={(saved) => {
                    setIsTaskModalOpen(false);
                    if (saved && typeof saved === 'object') {
                        // TaskModal passes the saved task object on success
                        setLinkedTask(saved);
                        setLinkedAction(null);
                    }
                }}
            />

            {/* Action Modal */}
            <ActionModal
                isOpen={isActionModalOpen}
                defaultContactId={contactIdForLink}
                onClose={() => setIsActionModalOpen(false)}
                onActionSaved={(action) => {
                    setIsActionModalOpen(false);
                    setLinkedAction(action);
                    setLinkedTask(null);
                }}
            />
        </>
    );
};

export default EmailComposer;
