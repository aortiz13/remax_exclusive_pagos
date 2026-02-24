import React from 'react';
import { Button } from '@/components/ui';
import { Inbox, Send, File, Star, Trash2, PenBox, Archive } from 'lucide-react';

const EmailSidebar = ({ onCompose, currentFolder, onFolderChange }) => {
    const folders = [
        { id: 'inbox', label: 'Recibidos', icon: Inbox },
        { id: 'starred', label: 'Destacados', icon: Star },
        { id: 'sent', label: 'Enviados', icon: Send },
        { id: 'drafts', label: 'Borradores', icon: File },
        { id: 'archived', label: 'Archivados', icon: Archive },
        { id: 'trashed', label: 'Papelera', icon: Trash2 },
    ];

    return (
        <div className="flex flex-col h-full bg-gray-50 text-sm font-medium p-4">
            <Button
                className="w-full justify-start gap-2 mb-6 bg-blue-600 hover:bg-blue-700 text-white rounded-lg py-6"
                size="lg"
                onClick={onCompose}
            >
                <PenBox className="w-5 h-5" />
                Redactar
            </Button>

            <div className="space-y-1">
                {folders.map(folder => {
                    const Icon = folder.icon;
                    const isActive = currentFolder === folder.id;
                    return (
                        <Button
                            key={folder.id}
                            onClick={() => onFolderChange(folder.id)}
                            variant="ghost"
                            className={`w-full justify-start gap-3 ${isActive
                                    ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                                    : 'text-gray-700 hover:bg-gray-200'
                                }`}
                        >
                            <Icon className="w-4 h-4" />
                            {folder.label}
                        </Button>
                    );
                })}
            </div>
        </div>
    );
};

export default EmailSidebar;
