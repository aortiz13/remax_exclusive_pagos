import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../services/supabase';
import { Loader2, User, Phone, Briefcase, PlusCircle } from 'lucide-react';
import { Button } from '@/components/ui';

const fetchContactDetails = async (contactId) => {
    if (!contactId) return null;
    const { data, error } = await supabase
        .from('contacts')
        .select('*')
        .eq('id', contactId)
        .single();

    if (error) throw error;
    return data;
};

const ContextSidebar = ({ thread }) => {
    const { data: contact, isLoading } = useQuery({
        queryKey: ['threadContact', thread?.contact_id],
        queryFn: () => fetchContactDetails(thread?.contact_id),
        enabled: !!thread?.contact_id,
    });

    if (!thread) {
        return (
            <div className="text-center text-gray-400 mt-10 text-sm">
                Selecciona un correo para ver información de contacto relacionado.
            </div>
        );
    }

    if (isLoading) {
        return <div className="flex justify-center p-6"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>;
    }

    if (!contact) {
        // Option to link or create new
        return (
            <div className="flex flex-col items-center justify-center p-6 text-center bg-gray-50 rounded-lg border border-gray-100 mt-4 mx-2">
                <User className="w-12 h-12 text-gray-300 mb-2" />
                <h3 className="font-medium text-gray-700 mb-1">Contacto Desconocido</h3>
                <p className="text-xs text-gray-500 mb-4">Este correo no está vinculado a ningún contacto en su CRM.</p>
                <div className="flex flex-col w-full gap-2">
                    <Button size="sm" className="w-full bg-blue-600 hover:bg-blue-700">
                        <PlusCircle className="w-4 h-4 mr-2" /> Crear Contacto
                    </Button>
                    <Button variant="outline" size="sm" className="w-full">
                        Vincular Existente
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col bg-white">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4 px-2">Info CRM</h3>

            <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                <div className="w-16 h-16 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-2xl font-bold mb-3">
                    {contact.first_name?.charAt(0) || 'C'}
                </div>

                <h2 className="text-lg font-bold text-gray-800 mb-1">{contact.first_name} {contact.last_name}</h2>
                {contact.profession && (
                    <div className="flex items-center text-sm text-gray-500 mb-3">
                        <Briefcase className="w-4 h-4 mr-2 text-gray-400 shrink-0" />
                        <span className="truncate">{contact.profession}</span>
                    </div>
                )}

                <div className="space-y-2 mt-4 pt-4 border-t border-gray-200">
                    {contact.email && (
                        <div className="flex items-start text-sm">
                            <User className="w-4 h-4 mr-2 text-gray-400 shrink-0 mt-0.5" />
                            <a href={`mailto:${contact.email}`} className="text-blue-600 hover:underline truncate">{contact.email}</a>
                        </div>
                    )}
                    {contact.phone && (
                        <div className="flex items-center text-sm">
                            <Phone className="w-4 h-4 mr-2 text-gray-400 shrink-0" />
                            <a href={`tel:${contact.phone}`} className="text-blue-600 hover:underline">{contact.phone}</a>
                        </div>
                    )}
                </div>

                <div className="mt-6">
                    <Button variant="outline" className="w-full bg-white text-sm h-auto whitespace-normal py-2">
                        Ver Perfil Completo
                    </Button>
                </div>
            </div>

            {/* Future details like Active Deals, Properties, Notes */}
            <div className="mt-6 px-2">
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Interacciones Recientes</h4>
                <div className="text-sm text-gray-500 italic">No hay interacciones recientes registrada.</div>
            </div>
        </div>
    );
};

export default ContextSidebar;
