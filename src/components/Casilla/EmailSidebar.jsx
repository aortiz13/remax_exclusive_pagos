import React from 'react';
import { Button } from '@/components/ui';
import { Inbox, Send, File, Star, Trash2, PenBox, Archive, RefreshCw } from 'lucide-react';

const EmailSidebar = ({ onCompose, currentFolder, onFolderChange, onReconnect }) => {
    const folders = [
        { id: 'inbox', label: 'Recibidos', icon: Inbox },
        { id: 'starred', label: 'Destacados', icon: Star },
        { id: 'sent', label: 'Enviados', icon: Send },
        { id: 'drafts', label: 'Borradores', icon: File },
        { id: 'archived', label: 'Archivados', icon: Archive },
        { id: 'trashed', label: 'Papelera', icon: Trash2 },
    ];

    return (
        <div className="flex flex-col h-full bg-gray-50 text-sm font-medium p-4 justify-between">
            <div>
                <Button
                    className="w-full justify-start gap-2 mb-6 bg-blue-600 hover:bg-blue-700 text-white rounded-lg py-6 shadow-md"
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
                                className={`w-full justify-start gap-3 transition-colors ${isActive
                                    ? 'bg-blue-100 text-blue-700 hover:bg-blue-200 shadow-sm'
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

            <div className="mt-8 border-t border-gray-200 pt-4">
                <Button
                    variant="outline"
                    className="w-full justify-start gap-2 text-gray-600 hover:text-blue-600 border-gray-300 hover:border-blue-300 transition-all h-auto whitespace-normal py-2"
                    onClick={onReconnect}
                >
                    <RefreshCw className="w-4 h-4 shrink-0" />
                    <span className="text-left">Re-vincular Gmail</span>
                </Button>
            </div>
        </div>
    );
};

export default EmailSidebar;
