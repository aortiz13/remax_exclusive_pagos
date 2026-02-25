import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../services/supabase';
import { Search, Loader2, MailOpen, ListTodo, Trash2, Archive, X, ChevronDown } from 'lucide-react';
import TaskModal from '../crm/TaskModal';
import { toast } from 'sonner';

const fetchThreads = async (agentId) => {
    const { data, error } = await supabase
        .from('email_threads')
        .select(`
            *,
            email_messages (
                id,
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

// ─── Search parser ────────────────────────────────────────────
// Parses a Gmail-style query string into structured filters.
// Supported: from:, to:, subject:, is:unread, is:starred, is:read,
//            has:attachment, after:YYYY/MM/DD, before:YYYY/MM/DD,
//            in:inbox, in:sent, in:starred, in:trash, in:archive
//            and free-text (matches subject + from + snippet)
const parseQuery = (raw) => {
    const filters = {
        text: [],
        from: null,
        to: null,
        subject: null,
        isUnread: null,     // true | false | null
        isStarred: null,
        hasAttachment: null,
        after: null,
        before: null,
        inFolder: null,
    };

    // Tokenize respecting quoted strings
    const tokens = [];
    const regex = /(\w+:"[^"]*"|\w+:\S+|"[^"]*"|\S+)/g;
    let m;
    while ((m = regex.exec(raw)) !== null) tokens.push(m[0]);

    for (const token of tokens) {
        const lc = token.toLowerCase();
        if (lc.startsWith('from:')) {
            filters.from = token.slice(5).replace(/^"|"$/g, '').toLowerCase();
        } else if (lc.startsWith('to:')) {
            filters.to = token.slice(3).replace(/^"|"$/g, '').toLowerCase();
        } else if (lc.startsWith('subject:')) {
            filters.subject = token.slice(8).replace(/^"|"$/g, '').toLowerCase();
        } else if (lc === 'is:unread') {
            filters.isUnread = true;
        } else if (lc === 'is:read') {
            filters.isUnread = false;
        } else if (lc === 'is:starred') {
            filters.isStarred = true;
        } else if (lc === 'has:attachment') {
            filters.hasAttachment = true;
        } else if (lc.startsWith('after:')) {
            const d = token.slice(6).replace(/\//g, '-');
            filters.after = new Date(d);
        } else if (lc.startsWith('before:')) {
            const d = token.slice(7).replace(/\//g, '-');
            filters.before = new Date(d);
        } else if (lc.startsWith('in:')) {
            const folder = lc.slice(3);
            const folderMap = {
                inbox: 'INBOX', sent: 'SENT', starred: 'STARRED',
                trash: 'TRASH', archive: null, spam: 'SPAM',
            };
            filters.inFolder = folderMap[folder] ?? folder.toUpperCase();
        } else {
            filters.text.push(token.replace(/^"|"$/g, '').toLowerCase());
        }
    }

    return filters;
};

// Apply parsed filters to a thread
const matchesFilters = (thread, filters, readThreadIds) => {
    const messages = thread.email_messages || [];
    const latestMsg = [...messages].sort((a, b) => new Date(b.received_at) - new Date(a.received_at))[0];
    const fromAddr = (latestMsg?.from_address || '').toLowerCase();
    const subject = (thread.subject || '').toLowerCase();
    const snippet = (latestMsg?.snippet || '').toLowerCase();
    const labels = thread.labels || [];
    const isUnread = !readThreadIds.has(thread.id) && messages.some(m => !m.is_read);
    const date = latestMsg?.received_at ? new Date(latestMsg.received_at) : null;

    if (filters.from && !fromAddr.includes(filters.from)) return false;
    if (filters.subject && !subject.includes(filters.subject)) return false;
    if (filters.isUnread !== null && isUnread !== filters.isUnread) return false;
    if (filters.isStarred && !labels.includes('STARRED')) return false;
    if (filters.after && date && date < filters.after) return false;
    if (filters.before && date && date > filters.before) return false;
    if (filters.inFolder) {
        if (filters.inFolder === null) {
            // archive
            if (labels.includes('INBOX') || labels.includes('TRASH')) return false;
        } else if (!labels.includes(filters.inFolder)) return false;
    }

    // Free-text: must match any of subject, from, snippet
    for (const word of filters.text) {
        const matchesAny = subject.includes(word) || fromAddr.includes(word) || snippet.includes(word);
        if (!matchesAny) return false;
    }

    return true;
};

// ─── Suggestions ─────────────────────────────────────────────
const SUGGESTIONS = [
    { label: 'is:unread', desc: 'Correos no leídos' },
    { label: 'is:read', desc: 'Correos leídos' },
    { label: 'is:starred', desc: 'Destacados' },
    { label: 'has:attachment', desc: 'Con adjunto' },
    { label: 'in:inbox', desc: 'En bandeja de entrada' },
    { label: 'in:sent', desc: 'En enviados' },
    { label: 'in:starred', desc: 'En destacados' },
    { label: 'in:trash', desc: 'En papelera' },
    { label: 'in:archive', desc: 'Archivados' },
    { label: 'from:', desc: 'Filtrar por remitente — ej. from:juan@gmail.com' },
    { label: 'subject:', desc: 'Filtrar por asunto — ej. subject:reunión' },
    { label: 'after:', desc: 'Después de fecha — ej. after:2024/01/01' },
    { label: 'before:', desc: 'Antes de fecha — ej. before:2024/12/31' },
];

// ─── Active filter chips ──────────────────────────────────────
const activeFiltersFromParsed = (f) => {
    const chips = [];
    if (f.from) chips.push({ key: 'from', label: `de: ${f.from}` });
    if (f.subject) chips.push({ key: 'subject', label: `asunto: ${f.subject}` });
    if (f.isUnread === true) chips.push({ key: 'isUnread', label: 'No leídos' });
    if (f.isUnread === false) chips.push({ key: 'isUnread', label: 'Leídos' });
    if (f.isStarred) chips.push({ key: 'isStarred', label: 'Destacados' });
    if (f.hasAttachment) chips.push({ key: 'hasAttachment', label: 'Con adjunto' });
    if (f.after) chips.push({ key: 'after', label: `desde: ${f.after.toLocaleDateString('es-CL')}` });
    if (f.before) chips.push({ key: 'before', label: `hasta: ${f.before.toLocaleDateString('es-CL')}` });
    if (f.inFolder) chips.push({ key: 'inFolder', label: `en: ${f.inFolder.toLowerCase()}` });
    if (f.text.length > 0) chips.push({ key: 'text', label: `"${f.text.join(' ')}"` });
    return chips;
};

// ─── Context Menu ────────────────────────────────────────────
const ContextMenu = ({ x, y, thread, onClose, onMarkUnread, onCreateTask, onDelete, onArchive }) => {
    const menuRef = useRef(null);
    useEffect(() => {
        const handleClickOutside = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) onClose(); };
        const handleEsc = (e) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('keydown', handleEsc);
        return () => { document.removeEventListener('mousedown', handleClickOutside); document.removeEventListener('keydown', handleEsc); };
    }, [onClose]);

    const menuWidth = 200;
    const menuHeight = 176;
    const clampedX = Math.min(x, window.innerWidth - menuWidth - 8);
    const clampedY = Math.min(y, window.innerHeight - menuHeight - 8);

    const items = [
        { icon: MailOpen, label: 'Marcar como no leído', action: onMarkUnread, color: 'text-blue-600' },
        { icon: ListTodo, label: 'Crear tarea', action: onCreateTask, color: 'text-indigo-600' },
        { icon: Archive, label: 'Archivar', action: onArchive, color: 'text-gray-600' },
        { icon: Trash2, label: 'Eliminar', action: onDelete, color: 'text-red-500', danger: true },
    ];

    return (
        <div
            ref={menuRef}
            style={{ position: 'fixed', top: clampedY, left: clampedX, zIndex: 9999 }}
            className="w-[200px] bg-white rounded-xl shadow-xl border border-gray-100 py-1.5 overflow-hidden"
            onContextMenu={e => e.preventDefault()}
        >
            <div className="px-3 py-1.5 border-b border-gray-100 mb-1">
                <p className="text-[11px] text-gray-400 truncate">{thread.subject || '(Sin asunto)'}</p>
            </div>
            {items.map(({ icon: Icon, label, action, color, danger }) => (
                <button
                    key={label}
                    onClick={() => { action(); onClose(); }}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left transition-colors ${danger ? 'hover:bg-red-50 text-red-500' : `hover:bg-gray-50 ${color}`}`}
                >
                    <Icon className="w-4 h-4 shrink-0" />
                    {label}
                </button>
            ))}
        </div>
    );
};

// ─── Main Component ──────────────────────────────────────────
const EmailList = ({ userProfile, onSelectThread, currentFolder, readThreadIds = new Set(), onUnmarkRead }) => {
    const PAGE_SIZE = 20;
    const [searchTerm, setSearchTerm] = useState('');
    const [page, setPage] = useState(0);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [contextMenu, setContextMenu] = useState(null);
    const [taskModalThread, setTaskModalThread] = useState(null);

    // Reset to page 0 whenever folder or search changes
    useEffect(() => { setPage(0); }, [currentFolder, searchTerm]);
    const searchRef = useRef(null);
    const inputRef = useRef(null);
    const queryClient = useQueryClient();

    const { data: threads, isLoading } = useQuery({
        queryKey: ['emailThreads', userProfile?.id],
        queryFn: () => fetchThreads(userProfile?.id),
        enabled: !!userProfile?.id,
        refetchInterval: 30000,
    });

    // Close suggestions on outside click
    useEffect(() => {
        const handler = (e) => {
            if (searchRef.current && !searchRef.current.contains(e.target)) {
                setShowSuggestions(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const handleKeyDown = (e) => {
        if (e.key === 'Escape') {
            setShowSuggestions(false);
            inputRef.current?.blur();
        }
        if (e.key === 'Enter') {
            setShowSuggestions(false);
        }
    };

    const applySuggestion = (suggestion) => {
        const endsWithColon = suggestion.label.endsWith(':');
        const current = searchTerm.trim();

        if (endsWithColon) {
            // Append the operator, keep existing text
            const newVal = current ? `${current} ${suggestion.label}` : suggestion.label;
            setSearchTerm(newVal);
            setTimeout(() => inputRef.current?.focus(), 0);
        } else {
            // Toggle: add if not present, remove if present
            const token = suggestion.label;
            if (current.includes(token)) {
                setSearchTerm(current.replace(token, '').replace(/\s+/g, ' ').trim());
            } else {
                setSearchTerm(current ? `${current} ${token}` : token);
            }
        }
        setShowSuggestions(false);
    };

    const clearSearch = () => {
        setSearchTerm('');
        inputRef.current?.focus();
    };

    const handleContextMenu = (e, thread) => {
        e.preventDefault();
        e.stopPropagation();
        setContextMenu({ x: e.clientX, y: e.clientY, thread });
    };

    const handleMarkUnread = async (thread) => {
        onUnmarkRead?.(thread.id);
        const msgIds = (thread.email_messages || []).map(m => m.id).filter(Boolean);
        if (msgIds.length > 0) {
            await supabase.from('email_messages').update({ is_read: false }).in('id', msgIds);
        }
        toast.success('Marcado como no leído');
        queryClient.invalidateQueries({ queryKey: ['emailThreads', userProfile?.id] });
    };

    const handleDelete = async (thread) => {
        const { error } = await supabase.from('email_threads').delete().eq('id', thread.id);
        if (error) { toast.error('Error al eliminar el correo'); return; }
        toast.success('Correo eliminado');
        queryClient.invalidateQueries({ queryKey: ['emailThreads', userProfile?.id] });
    };

    const handleArchive = async (thread) => {
        const currentLabels = thread.labels || [];
        const newLabels = currentLabels.filter(l => l !== 'INBOX');
        const { error } = await supabase.from('email_threads').update({ labels: newLabels }).eq('id', thread.id);
        if (error) { toast.error('Error al archivar'); return; }
        toast.success('Correo archivado');
        queryClient.invalidateQueries({ queryKey: ['emailThreads', userProfile?.id] });
    };

    if (isLoading) {
        return <div className="p-4 flex justify-center"><Loader2 className="animate-spin text-gray-400 w-6 h-6" /></div>;
    }

    // ── Filter by folder (skip if search is active — search all folders like Gmail)
    const isSearchActive = searchTerm.trim().length > 0;

    const folderFilteredThreads = isSearchActive
        ? (threads || [])
        : (threads || []).filter(t => {
            const labels = t.labels || [];
            switch (currentFolder) {
                case 'inbox': return labels.includes('INBOX');
                case 'starred': return labels.includes('STARRED');
                case 'sent': return labels.includes('SENT');
                case 'drafts': return labels.includes('DRAFT');
                case 'trashed': return labels.includes('TRASH');
                case 'archived': return !labels.includes('INBOX') && !labels.includes('TRASH') && !labels.includes('DRAFT');
                default: return true;
            }
        });

    // ── Apply parsed query filters
    const parsedFilters = parseQuery(searchTerm);
    const activeChips = isSearchActive ? activeFiltersFromParsed(parsedFilters) : [];

    const filteredThreads = isSearchActive
        ? folderFilteredThreads.filter(t => matchesFilters(t, parsedFilters, readThreadIds))
        : folderFilteredThreads;

    const totalPages = Math.ceil(filteredThreads.length / PAGE_SIZE);
    const pagedThreads = filteredThreads.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

    // Suggestions filtered by current input
    const lastToken = searchTerm.trim().split(/\s+/).pop() || '';
    const visibleSuggestions = SUGGESTIONS.filter(s =>
        lastToken === '' || s.label.startsWith(lastToken.toLowerCase())
    );

    return (
        <>
            <div className="flex flex-col h-full bg-white">
                {/* Search */}
                <div className="p-4 border-b border-gray-100 shrink-0">
                    <div ref={searchRef} className="relative">
                        {/* Input row */}
                        <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border transition-all ${showSuggestions || searchTerm ? 'border-blue-400 bg-white ring-2 ring-blue-500/20' : 'border-gray-200 bg-gray-50'}`}>
                            <Search className="w-4 h-4 text-gray-400 shrink-0" />
                            <input
                                ref={inputRef}
                                type="text"
                                placeholder="Buscar en correos — de:, asunto:, es:no-leído..."
                                value={searchTerm}
                                onChange={(e) => { setSearchTerm(e.target.value); setShowSuggestions(true); }}
                                onFocus={() => setShowSuggestions(true)}
                                onKeyDown={handleKeyDown}
                                className="flex-1 bg-transparent text-sm outline-none placeholder:text-gray-400"
                            />
                            {searchTerm && (
                                <button onClick={clearSearch} className="text-gray-400 hover:text-gray-600 transition-colors">
                                    <X className="w-4 h-4" />
                                </button>
                            )}
                            <button
                                onClick={() => setShowSuggestions(v => !v)}
                                className="text-gray-400 hover:text-gray-600 transition-colors"
                                title="Opciones de búsqueda"
                            >
                                <ChevronDown className={`w-4 h-4 transition-transform ${showSuggestions ? 'rotate-180' : ''}`} />
                            </button>
                        </div>

                        {/* Suggestions dropdown */}
                        {showSuggestions && visibleSuggestions.length > 0 && (
                            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-100 rounded-xl shadow-xl z-50 overflow-hidden">
                                <div className="px-3 py-2 border-b border-gray-50">
                                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Operadores de búsqueda</p>
                                </div>
                                <div className="max-h-60 overflow-y-auto py-1">
                                    {visibleSuggestions.map(s => {
                                        const isActive = searchTerm.includes(s.label);
                                        return (
                                            <button
                                                key={s.label}
                                                onMouseDown={(e) => { e.preventDefault(); applySuggestion(s); }}
                                                className={`w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-blue-50 transition-colors ${isActive ? 'bg-blue-50' : ''}`}
                                            >
                                                <code className={`text-xs px-1.5 py-0.5 rounded font-mono ${isActive ? 'bg-blue-600 text-white' : 'bg-gray-100 text-blue-700'}`}>
                                                    {s.label}
                                                </code>
                                                <span className="text-xs text-gray-500 truncate">{s.desc}</span>
                                                {isActive && <span className="ml-auto text-[10px] text-blue-500 shrink-0">activo</span>}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Active filter chips */}
                    {activeChips.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                            {activeChips.map((chip) => (
                                <span key={chip.key} className="inline-flex items-center gap-1 text-[11px] bg-blue-50 text-blue-700 border border-blue-100 px-2 py-0.5 rounded-full font-medium">
                                    {chip.label}
                                </span>
                            ))}
                            <button
                                onClick={clearSearch}
                                className="text-[11px] text-gray-400 hover:text-gray-600 hover:underline transition-colors"
                            >
                                Limpiar
                            </button>
                        </div>
                    )}

                    {/* Result count when searching */}
                    {isSearchActive && (
                        <p className="text-[11px] text-gray-400 mt-1.5 px-0.5">
                            {filteredThreads.length} resultado{filteredThreads.length !== 1 ? 's' : ''} en todos los correos
                        </p>
                    )}
                </div>

                {/* Thread list */}
                <div className="flex-1 overflow-y-auto w-full" onScroll={() => { }}>
                    {filteredThreads.length === 0 ? (
                        <div className="p-8 text-center text-gray-400 text-sm">
                            {isSearchActive
                                ? <><p className="font-medium text-gray-500 mb-1">Sin resultados</p><p className="text-xs">Prueba con otros términos u operadores</p></>
                                : 'No hay correos para mostrar.'
                            }
                        </div>
                    ) : (
                        <div className="divide-y divide-gray-100" key={page}>
                            {pagedThreads.map(thread => {
                                const messages = thread.email_messages || [];
                                const latestMsg = [...messages].sort(
                                    (a, b) => new Date(b.received_at) - new Date(a.received_at)
                                )[0];
                                const isUnread = !readThreadIds.has(thread.id) && messages.some(m => !m.is_read);
                                const fromName = latestMsg?.from_address?.split('<')[0]?.trim() || 'Desconocido';
                                const dateStr = latestMsg?.received_at
                                    ? new Date(latestMsg.received_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
                                    : '';

                                return (
                                    <div
                                        key={thread.id}
                                        onClick={() => onSelectThread(thread)}
                                        onContextMenu={(e) => handleContextMenu(e, thread)}
                                        className={[
                                            'relative px-4 py-3 cursor-pointer transition-colors border-l-[3px] select-none',
                                            isUnread
                                                ? 'bg-white hover:bg-blue-50/40 border-l-blue-500'
                                                : 'bg-gray-50/60 hover:bg-gray-100/70 border-l-transparent',
                                        ].join(' ')}
                                    >
                                        <div className="flex justify-between items-center mb-0.5">
                                            <div className="flex items-center gap-1.5 min-w-0">
                                                {isUnread && <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />}
                                                <h4 className={`text-sm truncate ${isUnread ? 'font-bold text-gray-900' : 'font-normal text-gray-500'}`}>
                                                    {fromName}
                                                </h4>
                                            </div>
                                            <span className={`text-[11px] shrink-0 ml-2 ${isUnread ? 'font-semibold text-blue-600' : 'font-normal text-gray-400'}`}>
                                                {dateStr}
                                            </span>
                                        </div>
                                        <h5 className={`text-sm truncate mb-0.5 ${isUnread ? 'font-semibold text-gray-900' : 'font-normal text-gray-600'}`}>
                                            {thread.subject || '(Sin Asunto)'}
                                        </h5>
                                        <p className={`text-xs line-clamp-1 leading-relaxed ${isUnread ? 'text-gray-600' : 'text-gray-400'}`}>
                                            {latestMsg?.snippet || ''}
                                        </p>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Pagination bar */}
                {totalPages > 1 && (
                    <div className="shrink-0 border-t border-gray-100 px-4 py-2.5 flex items-center justify-between bg-white">
                        <span className="text-xs text-gray-400">
                            {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filteredThreads.length)} de {filteredThreads.length}
                        </span>
                        <div className="flex items-center gap-1">
                            <button
                                onClick={() => setPage(p => Math.max(0, p - 1))}
                                disabled={page === 0}
                                className="px-2.5 py-1 rounded-lg text-xs font-medium border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                            >
                                ← Anterior
                            </button>
                            <span className="text-xs text-gray-500 px-2">
                                {page + 1} / {totalPages}
                            </span>
                            <button
                                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                                disabled={page >= totalPages - 1}
                                className="px-2.5 py-1 rounded-lg text-xs font-medium border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                            >
                                Siguiente →
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Right-click context menu */}
            {contextMenu && (
                <ContextMenu
                    x={contextMenu.x}
                    y={contextMenu.y}
                    thread={contextMenu.thread}
                    onClose={() => setContextMenu(null)}
                    onMarkUnread={() => handleMarkUnread(contextMenu.thread)}
                    onCreateTask={() => setTaskModalThread(contextMenu.thread)}
                    onDelete={() => handleDelete(contextMenu.thread)}
                    onArchive={() => handleArchive(contextMenu.thread)}
                />
            )}

            {/* Task creation modal */}
            {taskModalThread && (
                <TaskModal
                    isOpen={true}
                    contactId={taskModalThread.contact_id || null}
                    onClose={(saved) => {
                        setTaskModalThread(null);
                        if (saved) toast.success('Tarea creada');
                    }}
                />
            )}
        </>
    );
};

export default EmailList;
