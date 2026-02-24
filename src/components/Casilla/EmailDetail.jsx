import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../services/supabase';
import { Loader2, Reply, Trash2, Printer, Archive } from 'lucide-react';
import { Button } from '@/components/ui';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui";
import { toast } from 'sonner';

const fetchThreadDetails = async (threadId) => {
    const { data, error } = await supabase
        .from('email_threads')
        .select(`
            *,
            email_messages (
                *
            )
        `)
        .eq('id', threadId)
        .single();

    if (error) throw error;
    return data;
};

const EmailDetail = ({ thread, userProfile, onReply, onThreadDeleted }) => {
    const queryClient = useQueryClient();
    const [isUpdating, setIsUpdating] = useState(false);

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
        }
    };

    return (
        <div className="flex flex-col h-full bg-white">
            <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-white sticky top-0 z-10">
                <div className="flex gap-2">
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
                                    className="prose prose-sm max-w-none prose-a:text-blue-600 mt-4"
                                    dangerouslySetInnerHTML={{ __html: msg.body_html || msg.body_plain || msg.snippet }}
                                />

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
