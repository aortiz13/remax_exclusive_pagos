import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../services/supabase';
import { Loader2, Reply, Trash2, Printer, Archive, ArrowLeft, Paperclip, MoreVertical } from 'lucide-react';
import { Button } from '@/components/ui';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui";
import { toast } from 'sonner';

/**
 * Repairs double-encoded UTF-8 text stored as Latin-1.
 * e.g. "captaciÃ³n" → "captación"
 * This handles emails stored before the atob() fix was applied.
 * It also works for text where multi-byte chars were truncated to single bytes.
 */
const fixEncoding = (str) => {
    if (!str) return str;
    try {
        // Only attempt repair if we see signs of double-encoding:
        // - Ã followed by a character (classic Latin-1 → UTF-8 double-encode)
        // - Â followed by specific chars (BOM / non-breaking space double-encode)
        const hasDoubleEncoding = /[\xC0-\xFF][\x80-\xBF]/.test(str) || /Ã[±³¡©®]/.test(str);
        if (!hasDoubleEncoding) return str;

        // Re-encode each char as a Latin-1 byte, then decode as UTF-8
        const bytes = new Uint8Array(str.length);
        for (let i = 0; i < str.length; i++) {
            bytes[i] = str.charCodeAt(i) & 0xff;
        }
        const decoded = new TextDecoder('utf-8').decode(bytes);

        // Sanity: if decoding introduced replacement chars (U+FFFD), the original was likely fine
        if (decoded.includes('\ufffd') && !str.includes('\ufffd')) {
            return str;
        }

        return decoded;
    } catch {
        return str;
    }
};

const fetchThreadDetails = async (threadId) => {
    const { data, error } = await supabase
        .from('email_threads')
        .select(`
            *,
            email_messages (
                *,
                email_attachments (
                    *
                )
            )
        `)
        .eq('id', threadId)
        .single();

    if (error) throw error;
    return data;
};

const EmailDetail = ({ thread, userProfile, onReply, onThreadDeleted, onBack, isMobile = false }) => {
    const queryClient = useQueryClient();
    const [isUpdating, setIsUpdating] = useState(false);
    const [showMobileActions, setShowMobileActions] = useState(false);

    const { data: threadDetails, isLoading, refetch } = useQuery({
        queryKey: ['threadDetails', thread.id],
        queryFn: () => fetchThreadDetails(thread.id),
        enabled: !!thread.id,
    });

    if (isLoading || !threadDetails) {
        return <div className="h-full flex items-center justify-center p-8"><Loader2 className="w-8 h-8 animate-spin text-gray-400" /></div>;
    }

    const messages = threadDetails.email_messages || [];
    messages.sort((a, b) => new Date(a.received_at) - new Date(b.received_at));

    const handleUpdateStatus = async (newStatus, successMessage) => {
        setIsUpdating(true);
        try {
            const { error } = await supabase
                .from('email_threads')
                .update({ status: newStatus })
                .eq('id', thread.id);

            if (error) throw error;
            toast.success(successMessage);

            queryClient.invalidateQueries({ queryKey: ['emailThreads', userProfile?.id] });

            if (onThreadDeleted) {
                onThreadDeleted();
            } else {
                refetch();
            }
        } catch (e) {
            console.error('Update status error', e);
            toast.error('Error al actualizar el estado: ' + e.message);
        } finally {
            setIsUpdating(false);
            setShowMobileActions(false);
        }
    };

    /* ─── MOBILE LAYOUT ───────────────────────────────────────── */
    if (isMobile) {
        return (
            <div className="flex flex-col h-full bg-white">
                {/* Mobile header */}
                <div className="flex items-center justify-between px-2 py-2.5 border-b border-gray-100 bg-white shrink-0 sticky top-0 z-10">
                    <button
                        onClick={onBack}
                        className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 active:bg-gray-200 transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>

                    <div className="flex items-center gap-1">
                        <button
                            onClick={() => handleUpdateStatus('archived', 'Hilo archivado')}
                            disabled={isUpdating}
                            className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 active:bg-gray-200 transition-colors"
                        >
                            <Archive className="w-5 h-5" />
                        </button>
                        <button
                            onClick={() => handleUpdateStatus('trashed', 'Hilo enviado a papelera')}
                            disabled={isUpdating}
                            className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 active:bg-gray-200 transition-colors"
                        >
                            <Trash2 className="w-5 h-5" />
                        </button>
                        <button
                            onClick={() => onReply && onReply(threadDetails)}
                            className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 active:bg-gray-200 transition-colors"
                        >
                            <Reply className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Subject */}
                <div className="px-4 py-3 border-b border-gray-50">
                    <h2 className="text-base font-semibold text-gray-900 leading-snug">
                        {threadDetails.subject || '(Sin Asunto)'}
                    </h2>
                    {threadDetails.contact_id && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-blue-100 text-blue-800 mt-1.5">
                            Vinculado a Contacto
                        </span>
                    )}
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto">
                    {messages.map((msg, idx) => {
                        const fromName = msg.from_address?.split('<')[0]?.trim().replace(/"/g, '') || 'Desconocido';
                        const avatarLetter = fromName.charAt(0).toUpperCase();
                        const isLast = idx === messages.length - 1;
                        const dateStr = msg.received_at
                            ? new Date(msg.received_at).toLocaleDateString('es-CL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
                            : '';

                        return (
                            <div key={msg.id} className={`px-4 py-4 ${!isLast ? 'border-b border-gray-100' : ''}`}>
                                {/* Sender row */}
                                <div className="flex items-start gap-3 mb-3">
                                    <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                                        <span className="text-blue-600 text-sm font-semibold">{avatarLetter}</span>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-baseline justify-between gap-2">
                                            <h4 className="font-semibold text-gray-900 text-[13px] truncate">{fromName}</h4>
                                            <span className="text-[11px] text-gray-400 shrink-0">{dateStr}</span>
                                        </div>
                                        <p className="text-[11px] text-gray-400 truncate">a {msg.to_address}</p>
                                    </div>
                                </div>

                                {/* Body */}
                                <div
                                    className="prose prose-sm max-w-none prose-a:text-blue-600 overflow-x-auto text-gray-700 text-[13px] leading-relaxed"
                                    dangerouslySetInnerHTML={{
                                        __html: fixEncoding(msg.body_html || msg.body_plain || msg.snippet)
                                    }}
                                />

                                {/* Attachments */}
                                {msg.email_attachments && msg.email_attachments.length > 0 && (
                                    <div className="mt-3 flex flex-wrap gap-2">
                                        {msg.email_attachments.map((att) => (
                                            <button
                                                key={att.id}
                                                onClick={async () => {
                                                    try {
                                                        const res = await fetch(att.storage_url);
                                                        const blob = await res.blob();
                                                        const blobUrl = URL.createObjectURL(blob);
                                                        const a = document.createElement('a');
                                                        a.href = blobUrl;
                                                        a.download = att.filename;
                                                        document.body.appendChild(a);
                                                        a.click();
                                                        document.body.removeChild(a);
                                                        URL.revokeObjectURL(blobUrl);
                                                    } catch (e) {
                                                        console.error('Error downloading attachment:', e);
                                                    }
                                                }}
                                                className="flex items-center gap-2 px-3 py-2 bg-gray-50 active:bg-gray-100 border border-gray-200 rounded-lg text-[13px] text-gray-700 transition-colors"
                                                title={att.filename}
                                            >
                                                <Paperclip className="w-4 h-4 text-gray-400 shrink-0" />
                                                <span className="truncate max-w-[180px]">{att.filename}</span>
                                            </button>
                                        ))}
                                    </div>
                                )}

                                {/* Reply button on last message */}
                                {isLast && (
                                    <div className="mt-4">
                                        <button
                                            onClick={() => onReply && onReply(threadDetails)}
                                            className="w-full flex items-center justify-center gap-2 py-3 border border-gray-200 rounded-xl text-blue-600 text-sm font-medium active:bg-blue-50 transition-colors"
                                        >
                                            <Reply className="w-4 h-4" />
                                            Responder
                                        </button>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    }

    /* ─── DESKTOP LAYOUT (unchanged) ──────────────────────────── */
    return (
        <div className="flex flex-col h-full bg-white">
            <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-white sticky top-0 z-10">
                <div className="flex gap-2 items-center">
                    {onBack && (
                        <Button variant="ghost" size="icon" onClick={onBack} className="mr-2 text-gray-500 hover:text-gray-900">
                            <ArrowLeft className="w-5 h-5" />
                        </Button>
                    )}
                    <Button
                        variant="outline"
                        size="sm"
                        className="text-gray-600"
                        onClick={() => handleUpdateStatus('archived', 'Hilo archivado')}
                        disabled={isUpdating}
                    >
                        <Archive className="w-4 h-4 mr-2" /> Archivar
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        className="text-red-500 hover:text-red-600 hover:bg-red-50 border-red-200"
                        onClick={() => handleUpdateStatus('trashed', 'Hilo enviado a papelera')}
                        disabled={isUpdating}
                    >
                        <Trash2 className="w-4 h-4 mr-2" /> Eliminar
                    </Button>
                </div>
                <Button variant="ghost" size="icon" className="text-gray-500">
                    <Printer className="w-4 h-4" />
                </Button>
            </div>

            <div className="px-6 py-5 bg-white border-b border-gray-50">
                <h2 className="text-xl font-semibold text-gray-800">{threadDetails.subject || '(Sin Asunto)'}</h2>
                {threadDetails.contact_id && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 mt-2">
                        Vinculado a Contacto
                    </span>
                )}
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {messages.map((msg, idx) => {
                    const fromName = msg.from_address?.split('<')[0]?.trim() || 'Desconocido';
                    const isLast = idx === messages.length - 1;

                    return (
                        <div key={msg.id} className={`flex gap-4 ${!isLast ? 'border-b border-gray-100 pb-6' : ''}`}>
                            <Avatar className="w-10 h-10 border border-gray-200">
                                <AvatarFallback className="bg-blue-50 text-blue-600 font-semibold">
                                    {fromName.charAt(0).toUpperCase()}
                                </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-start mb-1">
                                    <div>
                                        <h4 className="font-semibold text-gray-900 text-sm">{fromName}</h4>
                                        <p className="text-xs text-gray-500">{msg.from_address}</p>
                                    </div>
                                    <span className="text-xs text-gray-500">
                                        {msg.received_at ? new Date(msg.received_at).toLocaleString() : ''}
                                    </span>
                                </div>
                                <div className="text-sm text-gray-700 mt-1 mb-2">
                                    <span className="text-gray-400 mr-2">Para:</span> {msg.to_address}
                                </div>

                                <div
                                    className="prose prose-sm max-w-none prose-a:text-blue-600 mt-4 overflow-x-auto"
                                    dangerouslySetInnerHTML={{
                                        __html: fixEncoding(msg.body_html || msg.body_plain || msg.snippet)
                                    }}
                                />

                                {msg.email_attachments && msg.email_attachments.length > 0 && (
                                    <div className="mt-4 flex flex-wrap gap-2">
                                        {msg.email_attachments.map((att) => (
                                            <button
                                                key={att.id}
                                                onClick={async () => {
                                                    try {
                                                        const res = await fetch(att.storage_url);
                                                        const blob = await res.blob();
                                                        const blobUrl = URL.createObjectURL(blob);
                                                        const a = document.createElement('a');
                                                        a.href = blobUrl;
                                                        a.download = att.filename;
                                                        document.body.appendChild(a);
                                                        a.click();
                                                        document.body.removeChild(a);
                                                        URL.revokeObjectURL(blobUrl);
                                                    } catch (e) {
                                                        console.error('Error downloading attachment:', e);
                                                    }
                                                }}
                                                className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-md text-sm text-gray-700 transition-colors cursor-pointer"
                                                title={att.filename}
                                            >
                                                <Paperclip className="w-4 h-4 text-gray-400 shrink-0" />
                                                <span className="truncate max-w-[200px]">{att.filename}</span>
                                            </button>
                                        ))}
                                    </div>
                                )}

                                {isLast && (
                                    <div className="mt-6">
                                        <Button
                                            variant="outline"
                                            className="text-blue-600 border-blue-200 hover:bg-blue-50"
                                            onClick={() => onReply && onReply(threadDetails)}
                                        >
                                            <Reply className="w-4 h-4 mr-2" /> Responder
                                        </Button>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default EmailDetail;
