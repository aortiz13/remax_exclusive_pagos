import React, { useRef, useState } from 'react';
import { Editor } from '@tinymce/tinymce-react';
import { Button } from '@/components/ui';
import { Send, X, Paperclip, MoreHorizontal } from 'lucide-react';
import { supabase } from '../../services/supabase';

const EmailComposer = ({ onClose, onSuccess, replyTo = null, userProfile }) => {
    const editorRef = useRef(null);
    const [to, setTo] = useState(replyTo?.to_address || '');
    const [subject, setSubject] = useState(replyTo ? `Re: ${replyTo.subject}` : '');
    const [isSending, setIsSending] = useState(false);

    const handleSend = async () => {
        if (!editorRef.current) return;

        setIsSending(true);
        const content = editorRef.current.getContent();

        try {
            // Usually you would invoke an edge function here to send via Gmail API
            const { data, error } = await supabase.functions.invoke('gmail-send', {
                body: {
                    to,
                    subject,
                    bodyHtml: content,
                    replyToMessageId: replyTo?.gmail_message_id,
                    threadId: replyTo?.thread_id
                }
            });

            if (error) throw error;

            if (onSuccess) onSuccess();
            if (onClose) onClose();

        } catch (err) {
            console.error("Failed to send email", err);
            alert("Error al enviar el correo: " + err.message);
        } finally {
            setIsSending(false);
        }
    };

    return (
        <div className="fixed bottom-0 right-24 w-[600px] h-[500px] bg-white rounded-t-xl shadow-2xl border border-gray-200 flex flex-col z-50 overflow-hidden">
            {/* Header */}
            <div className="bg-gray-800 text-white px-4 py-3 flex justify-between items-center rounded-t-xl">
                <span className="font-medium text-sm">Nuevo Mensaje</span>
                <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
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
            <div className="flex-1 flex flex-col min-h-0 bg-white">
                <Editor
                    apiKey="no-api-key"
                    onInit={(evt, editor) => editorRef.current = editor}
                    init={{
                        height: '100%',
                        menubar: false,
                        statusbar: false,
                        plugins: [
                            'advlist', 'autolink', 'lists', 'link', 'image', 'charmap', 'preview',
                            'anchor', 'searchreplace', 'visualblocks', 'code', 'fullscreen',
                            'insertdatetime', 'media', 'table', 'code', 'help', 'wordcount'
                        ],
                        toolbar: 'undo redo | blocks | ' +
                            'bold italic forecolor | alignleft aligncenter ' +
                            'alignright alignjustify | bullist numlist outdent indent | ' +
                            'removeformat | help',
                        content_style: 'body { font-family:Helvetica,Arial,sans-serif; font-size:14px; margin: 16px; }',
                        border_color: 'transparent',
                        skin: 'oxide',
                        iframe_aria_text: 'Email content area'
                    }}
                />
            </div>

            {/* Footer Actions */}
            <div className="p-3 border-t border-gray-100 flex items-center justify-between bg-gray-50">
                <div className="flex items-center gap-2">
                    <Button
                        onClick={handleSend}
                        disabled={isSending || !to || !subject}
                        className="bg-blue-600 hover:bg-blue-700 text-white gap-2 px-6"
                    >
                        {isSending ? 'Enviando...' : <>Enviar <Send className="w-4 h-4 ml-1" /></>}
                    </Button>
                    <Button variant="ghost" size="icon" className="text-gray-500 hover:bg-gray-200">
                        <Paperclip className="w-5 h-5" />
                    </Button>
                </div>
                <Button variant="ghost" size="icon" className="text-gray-400 hover:bg-gray-200" onClick={onClose}>
                    <Trash2 className="w-5 h-5" />
                </Button>
            </div>
        </div>
    );
};

export default EmailComposer;
