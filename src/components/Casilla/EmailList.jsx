import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../services/supabase';
import { Search, Loader2 } from 'lucide-react';

// A generic function to fetch threads 
const fetchThreads = async (agentId) => {
    // Left outer join to get latest message snippets if possible
    // Note: depending on Supabase relations, we can fetch email_messages inside
    const { data, error } = await supabase
        .from('email_threads')
        .select(`
            *,
            email_messages (
                snippet,
                from_address,
                received_at,
                is_read
            )
        `)
        .eq('agent_id', agentId)
        .order('updated_at', { ascending: false });

    if (error) throw error;
    return data;
};

const EmailList = ({ userProfile, onSelectThread, currentFolder }) => {
    const [searchTerm, setSearchTerm] = useState('');

    const { data: threads, isLoading } = useQuery({
        queryKey: ['emailThreads', userProfile?.id],
        queryFn: () => fetchThreads(userProfile?.id),
        enabled: !!userProfile?.id,
        // Using polling temporarily if optimistic updates aren't fully wired
        refetchInterval: 15000,
    });

    if (isLoading) {
        return <div className="p-4 flex justify-center"><Loader2 className="animate-spin text-gray-400 w-6 h-6" /></div>;
    }

    // Filter by folder
    const folderFilteredThreads = (threads || []).filter(t => {
        // Map 'active' DB status to 'inbox' frontend folder
        const status = t.status === 'active' ? 'inbox' : (t.status || 'inbox');

        if (currentFolder === 'inbox') return status === 'inbox';
        return status === currentFolder;
    });

    // Filter by search
    const filteredThreads = folderFilteredThreads.filter(t =>
        t.subject?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="flex flex-col h-full bg-white">
            <div className="p-4 border-b border-gray-100 shrink-0">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input
                        type="text"
                        placeholder="Buscar en correos..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-colors"
                    />
                </div>
            </div>

            <div className="flex-1 overflow-y-auto w-full">
                {filteredThreads.length === 0 ? (
                    <div className="p-8 text-center text-gray-400 text-sm">
                        No hay correos para mostrar.
                    </div>
                ) : (
                    <div className="divide-y divide-gray-100">
                        {filteredThreads.map(thread => {
                            // Extract latest message info if available
                            const messages = thread.email_messages || [];
                            // sort by received_at desc to get latest
                            const latestMsg = messages.sort((a, b) => new Date(b.received_at) - new Date(a.received_at))[0];
                            const isUnread = messages.some(m => !m.is_read);

                            const fromName = latestMsg?.from_address?.split('<')[0]?.trim() || 'Desconocido';

                            return (
                                <div
                                    key={thread.id}
                                    onClick={() => onSelectThread(thread)}
                                    className={`p-4 hover:bg-gray-50 cursor-pointer border-l-4 transition-colors ${isUnread ? 'border-blue-500 bg-blue-50/30' : 'border-transparent'}`}
                                >
                                    <div className="flex justify-between items-baseline mb-1">
                                        <h4 className={`text-sm truncate pr-2 ${isUnread ? 'font-bold text-gray-900' : 'font-medium text-gray-700'}`}>
                                            {fromName}
                                        </h4>
                                        <span className="text-xs text-gray-400 shrink-0 flex items-center gap-1">
                                            {latestMsg?.received_at ? new Date(latestMsg.received_at).toLocaleDateString([], { month: 'short', day: 'numeric' }) : ''}
                                        </span>
                                    </div>
                                    <h5 className={`text-sm mb-1 truncate ${isUnread ? 'font-semibold text-gray-800' : 'font-medium text-gray-800'}`}>
                                        {thread.subject || '(Sin Asunto)'}
                                    </h5>
                                    <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed">
                                        {latestMsg?.snippet || ''}
                                    </p>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};

export default EmailList;
