import React from 'react';
import { Button } from '@/components/ui';
import { Inbox, Send, File, Star, Trash2, PenBox } from 'lucide-react';

const EmailSidebar = () => {
    return (
        <div className="flex flex-col h-full bg-gray-50 text-sm font-medium p-4">
            <Button className="w-full justify-start gap-2 mb-6 bg-blue-600 hover:bg-blue-700 text-white rounded-lg py-6" size="lg">
                <PenBox className="w-5 h-5" />
                Redactar
            </Button>

            <div className="space-y-1">
                <Button variant="ghost" className="w-full justify-start gap-3 bg-blue-100 text-blue-700 hover:bg-blue-200">
                    <Inbox className="w-4 h-4" />
                    Recibidos
                </Button>
                <Button variant="ghost" className="w-full justify-start gap-3 text-gray-700 hover:bg-gray-200">
                    <Star className="w-4 h-4" />
                    Destacados
                </Button>
                <Button variant="ghost" className="w-full justify-start gap-3 text-gray-700 hover:bg-gray-200">
                    <Send className="w-4 h-4" />
                    Enviados
                </Button>
                <Button variant="ghost" className="w-full justify-start gap-3 text-gray-700 hover:bg-gray-200">
                    <File className="w-4 h-4" />
                    Borradores
                </Button>
                <Button variant="ghost" className="w-full justify-start gap-3 text-gray-700 hover:bg-gray-200">
                    <Trash2 className="w-4 h-4" />
                    Papelera
                </Button>
            </div>
        </div>
    );
};

export default EmailSidebar;
