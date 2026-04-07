import React, { useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import Underline from '@tiptap/extension-underline'
import { motion } from 'framer-motion'
import { Button, Badge } from '@/components/ui'
import {
  Send, X, Users, ChevronDown, ChevronUp,
  Bold, Italic, Underline as UnderlineIcon, Strikethrough,
  List, ListOrdered, Quote, Undo, Redo, Link as LinkIcon,
  FileText, Loader2, CheckCircle2, AlertTriangle, Mail, Paperclip, Eye, EyeOff
} from 'lucide-react'
import { supabase } from '../../services/supabase'
import { useAuth } from '../../context/AuthContext'
import EmailTemplatePicker from '../Casilla/EmailTemplatePicker'
import { toast } from 'sonner'
import { logActivity } from '../../services/activityService'

const MenuBar = ({ editor }) => {
  if (!editor) return null
  return (
    <div className="flex border-b border-gray-100 p-2 gap-1 bg-gray-50 flex-wrap">
      <button onClick={() => editor.chain().focus().toggleBold().run()} className={`p-1.5 rounded hover:bg-gray-200 ${editor.isActive('bold') ? 'bg-gray-200 text-blue-600' : 'text-gray-600'}`}><Bold className="w-4 h-4" /></button>
      <button onClick={() => editor.chain().focus().toggleItalic().run()} className={`p-1.5 rounded hover:bg-gray-200 ${editor.isActive('italic') ? 'bg-gray-200 text-blue-600' : 'text-gray-600'}`}><Italic className="w-4 h-4" /></button>
      <button onClick={() => editor.chain().focus().toggleUnderline().run()} className={`p-1.5 rounded hover:bg-gray-200 ${editor.isActive('underline') ? 'bg-gray-200 text-blue-600' : 'text-gray-600'}`}><UnderlineIcon className="w-4 h-4" /></button>
      <button onClick={() => editor.chain().focus().toggleStrike().run()} className={`p-1.5 rounded hover:bg-gray-200 ${editor.isActive('strike') ? 'bg-gray-200 text-blue-600' : 'text-gray-600'}`}><Strikethrough className="w-4 h-4" /></button>
      <div className="w-px h-6 bg-gray-300 mx-1 self-center" />
      <button onClick={() => editor.chain().focus().toggleBulletList().run()} className={`p-1.5 rounded hover:bg-gray-200 ${editor.isActive('bulletList') ? 'bg-gray-200 text-blue-600' : 'text-gray-600'}`}><List className="w-4 h-4" /></button>
      <button onClick={() => editor.chain().focus().toggleOrderedList().run()} className={`p-1.5 rounded hover:bg-gray-200 ${editor.isActive('orderedList') ? 'bg-gray-200 text-blue-600' : 'text-gray-600'}`}><ListOrdered className="w-4 h-4" /></button>
      <button onClick={() => editor.chain().focus().toggleBlockquote().run()} className={`p-1.5 rounded hover:bg-gray-200 ${editor.isActive('blockquote') ? 'bg-gray-200 text-blue-600' : 'text-gray-600'}`}><Quote className="w-4 h-4" /></button>
      <div className="flex-1" />
      <button onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} className="p-1.5 rounded hover:bg-gray-200 text-gray-600 disabled:opacity-50"><Undo className="w-4 h-4" /></button>
      <button onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} className="p-1.5 rounded hover:bg-gray-200 text-gray-600 disabled:opacity-50"><Redo className="w-4 h-4" /></button>
    </div>
  )
}

/**
 * BulkEmailModal — Send email to multiple contacts.
 */
export default function BulkEmailModal({ isOpen, onClose, contacts = [] }) {
  const { profile: userProfile } = useAuth()
  const fileInputRef = useRef(null)
  
  const [subject, setSubject] = useState('')
  const [mode, setMode] = useState('bcc') // 'bcc' | 'individual'
  const [isSending, setIsSending] = useState(false)
  const [showRecipients, setShowRecipients] = useState(false)
  const [showTemplatePicker, setShowTemplatePicker] = useState(false)
  const [sendProgress, setSendProgress] = useState({ sent: 0, total: 0, errors: [] })
  const [sendComplete, setSendComplete] = useState(false)
  
  // Attachments & Preview
  const [attachments, setAttachments] = useState([])
  const [isPreview, setIsPreview] = useState(false)

  const validContacts = contacts.filter(c => c.email?.trim())
  const invalidContacts = contacts.filter(c => !c.email?.trim())

  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({ openOnClick: false, HTMLAttributes: { class: 'text-blue-600 underline' } }),
      Underline,
    ],
    content: '<p></p>',
    editorProps: {
      attributes: {
        class: 'prose prose-sm mx-auto focus:outline-none px-4 py-3 text-sm min-h-[200px] max-w-none',
      },
    },
  })

  // === Handlers for Attachments ===
  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files)
      const validFiles = []
      const MAX_FILE_SIZE = 20 * 1024 * 1024

      newFiles.forEach(file => {
        if (file.size > MAX_FILE_SIZE) {
          toast.error(`El archivo ${file.name} excede el límite de 20MB.`)
        } else {
          validFiles.push(file)
        }
      })
      setAttachments(prev => [...prev, ...validFiles])
    }
  }

  const removeAttachment = (indexToRemove) => {
    setAttachments(prev => prev.filter((_, index) => index !== indexToRemove))
  }

  const fileToBase64 = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onload = () => resolve(reader.result.split(',')[1])
    reader.onerror = error => reject(error)
  })

  const handleSelectTemplate = (template) => {
    if (template.subject) setSubject(template.subject)
    if (template.bodyHtml && editor) editor.commands.setContent(template.bodyHtml)
  }

  /** Replace {{nombre}}, {{apellido}} placeholders for individual mode */
  const personalizeHtml = (text, contact) => {
    if (!text) return ''
    return text
      .replace(/\{\{nombre\}\}/gi, contact.first_name || '')
      .replace(/\{\{apellido\}\}/gi, contact.last_name || '')
      .replace(/\{\{email\}\}/gi, contact.email || '')
      .replace(/___+/g, contact.first_name || '___')
  }

  const handleSend = async () => {
    if (!editor || !subject.trim()) {
      toast.error('Debe ingresar un asunto')
      return
    }
    if (validContacts.length === 0) {
      toast.error('No hay contactos con email válido')
      return
    }

    setIsSending(true)
    setSendComplete(false)
    const bodyHtml = editor.getHTML()

    try {
      // Process attachments once for the whole run
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

      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token
      if (!token) throw new Error('No se encontró una sesión activa.')

      if (mode === 'bcc') {
        // Single email with all recipients in BCC
        const bccList = validContacts.map(c => c.email).join(', ')
        setSendProgress({ sent: 0, total: 1, errors: [] })

        const { error } = await supabase.functions.invoke('gmail-send', {
          headers: { Authorization: `Bearer ${token}` },
          body: {
            to: userProfile?.email || validContacts[0].email,
            bcc: bccList,
            subject,
            bodyHtml,
            attachments: processedAttachments
          }
        })
        if (error) throw error
        setSendProgress({ sent: 1, total: 1, errors: [] })
        
        // Log Activity for everyone
        for (const c of validContacts) {
           await logActivity({
                action: 'Email Masivo enviado',
                entity_type: 'Contacto',
                entity_id: c.id,
                description: `Email enviado a través de copia oculta (BCC)\nAsunto: ${subject}`,
                contact_id: c.id,
                details: { subject, bcc_group_size: validContacts.length }
            }).catch(() => {})
        }

      } else {
        // Individual emails with personalization
        const errors = []
        setSendProgress({ sent: 0, total: validContacts.length, errors: [] })

        for (let i = 0; i < validContacts.length; i++) {
          const contact = validContacts[i]
          const personalizedHtml = personalizeHtml(bodyHtml, contact)
          const personalizedSubject = personalizeHtml(subject, contact)

          try {
            const { error } = await supabase.functions.invoke('gmail-send', {
              headers: { Authorization: `Bearer ${token}` },
              body: {
                to: contact.email,
                subject: personalizedSubject,
                bodyHtml: personalizedHtml,
                attachments: processedAttachments
              }
            })
            if (error) throw error

            // Log Activity
            await logActivity({
                action: 'Email Masivo enviado',
                entity_type: 'Contacto',
                entity_id: contact.id,
                description: `Email enviado: ${personalizedSubject}`,
                contact_id: contact.id,
                details: { subject: personalizedSubject, personalized: true }
            }).catch(() => {})

          } catch (err) {
            errors.push({ id: contact.id, contact: `${contact.first_name} ${contact.last_name}`, error: err.message })
          }

          setSendProgress({ sent: i + 1, total: validContacts.length, errors })
        }
      }

      setSendComplete(true)
      toast.success(`Email${mode === 'individual' ? 's' : ''} enviado${mode === 'individual' ? 's' : ''} exitosamente`)
    } catch (err) {
      console.error('Bulk email error:', err)
      toast.error(`Error: ${err.message}`)
    } finally {
      setIsSending(false)
    }
  }

  if (!isOpen) return null

  // Used for previewing the first contact
  const previewContact = validContacts[0] || {}
  const previewSubject = mode === 'individual' ? personalizeHtml(subject, previewContact) : subject
  const previewHtml = mode === 'individual' ? personalizeHtml(editor?.getHTML() || '', previewContact) : (editor?.getHTML() || '')

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => !isSending && onClose()} />
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col relative z-50 border border-slate-200 dark:border-slate-700"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center">
                <Mail className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-800 dark:text-white">Email Masivo</h2>
                <p className="text-xs text-slate-500">
                  {validContacts.length} destinatario{validContacts.length > 1 ? 's' : ''}
                  {invalidContacts.length > 0 && (
                    <span className="text-amber-600 ml-2">({invalidContacts.length} sin email)</span>
                  )}
                </p>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={() => !isSending && onClose()} disabled={isSending}>
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {sendComplete ? (
          /* Success state */
          <div className="flex-1 flex flex-col items-center justify-center p-8 gap-4">
            <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8 text-green-600" />
            </div>
            <h3 className="text-xl font-bold text-slate-800 dark:text-white">¡Envío completado!</h3>
            <p className="text-sm text-slate-500">
              {mode === 'bcc'
                ? `Correo enviado a ${validContacts.length} destinatarios en BCC`
                : `${sendProgress.sent - sendProgress.errors.length} de ${sendProgress.total} correos enviados`
              }
            </p>
            {sendProgress.errors.length > 0 && (
              <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg p-3 max-w-md w-full">
                <p className="text-xs font-bold text-red-700 dark:text-red-400 mb-2 flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" /> {sendProgress.errors.length} error{sendProgress.errors.length > 1 ? 'es' : ''}
                </p>
                {sendProgress.errors.map((err, i) => (
                  <p key={i} className="text-xs text-red-600 dark:text-red-400">{err.contact}: {err.error}</p>
                ))}
              </div>
            )}
            <Button onClick={onClose} className="mt-4">Cerrar</Button>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto">
              {/* Recipients */}
              <div className="px-6 py-3 border-b border-slate-100 dark:border-slate-800">
                <button
                  onClick={() => setShowRecipients(!showRecipients)}
                  className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 hover:text-slate-800 w-full"
                >
                  <Users className="w-4 h-4" />
                  <span className="font-medium">Para: {validContacts.length} contactos</span>
                  {showRecipients ? <ChevronUp className="w-3.5 h-3.5 ml-auto" /> : <ChevronDown className="w-3.5 h-3.5 ml-auto" />}
                </button>
                {showRecipients && (
                  <div className="mt-2 flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                    {validContacts.map(c => (
                      <Badge key={c.id} variant="secondary" className="text-[11px] gap-1 bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300">
                        {c.first_name} {c.last_name} — {c.email}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              {/* Mode selector */}
              <div className="px-6 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center gap-3">
                <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Modo:</span>
                <div className="flex rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
                  <button
                    onClick={() => { setMode('bcc'); setIsPreview(false) }}
                    className={`px-3 py-1.5 text-xs font-medium transition-colors ${mode === 'bcc' ? 'bg-blue-600 text-white' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50'}`}
                  >
                    BCC (Un correo)
                  </button>
                  <button
                    onClick={() => setMode('individual')}
                    className={`px-3 py-1.5 text-xs font-medium transition-colors ${mode === 'individual' ? 'bg-blue-600 text-white' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50'}`}
                  >
                    Individual (Personalizado)
                  </button>
                </div>
                {mode === 'individual' && (
                  <div className="flex items-center gap-2 ml-auto">
                    <span className="text-[10px] text-slate-500 font-medium">Insertar en texto:</span>
                    <button
                      onClick={() => editor?.commands.insertContent('{{nombre}}')}
                      className="px-2 py-1 text-[10px] font-medium bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-900/30 dark:text-amber-400 border border-amber-200 dark:border-amber-800 rounded transition-colors"
                      title="Insertar {{nombre}} en el correo"
                    >
                      + Nombre
                    </button>
                    <button
                      onClick={() => editor?.commands.insertContent('{{apellido}}')}
                      className="px-2 py-1 text-[10px] font-medium bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-900/30 dark:text-amber-400 border border-amber-200 dark:border-amber-800 rounded transition-colors"
                      title="Insertar {{apellido}} en el correo"
                    >
                      + Apellido
                    </button>
                  </div>
                )}
              </div>

              {/* Subject */}
              <div className="px-6 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center bg-transparent">
                <span className="text-sm text-slate-500 w-14">Asunto:</span>
                {isPreview && mode === 'individual' ? (
                  <span className="flex-1 text-sm font-medium italic text-slate-700">{previewSubject}</span>
                ) : (
                  <input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="flex-1 outline-none text-sm font-medium bg-transparent"
                    placeholder="Asunto del correo..."
                  />
                )}
              </div>

              {/* Editor or Preview */}
              <div className="flex flex-col flex-1 bg-white relative">
                {!isPreview && <MenuBar editor={editor} />}
                
                {isPreview ? (
                  <div className="flex-1 p-6 relative">
                    <div className="absolute top-2 right-4 text-xs font-bold uppercase tracking-wider text-amber-500 bg-amber-50 px-2 py-1 rounded-full border border-amber-200">
                      Previsualizando (Contacto de Ejemplo)
                    </div>
                    <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: previewHtml }} />
                  </div>
                ) : (
                  <EditorContent
                    editor={editor}
                    className="flex-1 [&>div]:outline-none px-2 min-h-[200px]"
                  />
                )}
              </div>

              {/* Attachments List */}
              {attachments.length > 0 && (
                <div className="px-6 py-2 border-t border-slate-100 dark:border-slate-800 bg-slate-50 flex flex-wrap gap-2 max-h-24 overflow-y-auto">
                    {attachments.map((file, index) => (
                        <div key={index} className="flex items-center gap-1 bg-white border border-slate-200 px-2 py-1 rounded-md text-xs text-slate-700 shadow-sm max-w-[200px]">
                            <Paperclip className="w-3 h-3 text-slate-400 shrink-0" />
                            <span className="truncate">{file.name}</span>
                            <button onClick={() => removeAttachment(index)} className="text-slate-400 hover:text-red-500 shrink-0 ml-1">
                                <X className="w-3 h-3" />
                            </button>
                        </div>
                    ))}
                </div>
              )}
            </div>

            {/* Sending progress */}
             {isSending && (
              <div className="px-6 py-3 bg-blue-50 dark:bg-blue-950/20 border-t border-blue-100 dark:border-blue-900">
                <div className="flex items-center gap-3">
                  <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                  <div className="flex-1">
                    <div className="w-full bg-blue-200 dark:bg-blue-800 rounded-full h-1.5">
                      <div
                        className="bg-blue-600 h-1.5 rounded-full transition-all"
                        style={{ width: `${sendProgress.total > 0 ? (sendProgress.sent / sendProgress.total) * 100 : 0}%` }}
                      />
                    </div>
                  </div>
                  <span className="text-xs text-blue-700 dark:text-blue-300 font-medium">
                    {sendProgress.sent}/{sendProgress.total}
                  </span>
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/30">
              <div className="flex items-center gap-2">
                
                {/* Template Picker */}
                <div className="relative">
                  <Button
                    variant="ghost"
                    size="icon"
                    className={`text-slate-500 hover:bg-amber-50 hover:text-amber-600 transition-colors ${showTemplatePicker ? 'bg-amber-50 text-amber-600' : ''}`}
                    onClick={() => setShowTemplatePicker(!showTemplatePicker)}
                    title="Usar plantilla"
                  >
                    <FileText className="w-5 h-5" />
                  </Button>
                  <EmailTemplatePicker
                    isOpen={showTemplatePicker}
                    onClose={() => setShowTemplatePicker(false)}
                    onSelectTemplate={handleSelectTemplate}
                  />
                </div>

                {/* Attachments */}
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
                    className="text-slate-500 hover:bg-slate-200 transition-colors"
                    onClick={() => fileInputRef.current?.click()}
                    title="Adjuntar archivos"
                >
                    <Paperclip className="w-5 h-5" />
                </Button>

                {/* Preview Toggle */}
                {mode === 'individual' && validContacts.length > 0 && (
                   <Button
                    variant="ghost"
                    size="icon"
                    className={`transition-colors ${isPreview ? 'bg-blue-100 text-blue-700' : 'text-slate-500 hover:bg-blue-50 hover:text-blue-600'}`}
                    onClick={() => setIsPreview(!isPreview)}
                    title={isPreview ? "Volver a editar" : "Previsualizar personalización"}
                   >
                     {isPreview ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                   </Button>
                )}

              </div>
              <div className="flex items-center gap-3">
                <Button variant="outline" onClick={onClose} disabled={isSending}>Cancelar</Button>
                <Button
                  onClick={handleSend}
                  disabled={isSending || !subject.trim() || validContacts.length === 0}
                  className="bg-blue-600 hover:bg-blue-700 text-white gap-2 px-6"
                >
                  {isSending ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Enviando...</>
                  ) : (
                    <><Send className="w-4 h-4" /> Enviar a {validContacts.length}</>
                  )}
                </Button>
              </div>
            </div>
          </>
        )}
      </motion.div>
    </div>,
    document.body
  )
}
