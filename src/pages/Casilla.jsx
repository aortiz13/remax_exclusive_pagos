import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/supabase';
import { useAuth } from '../context/AuthContext';
import { useLocation } from 'react-router-dom';
import Split from 'react-split';
import { useQuery } from '@tanstack/react-query';
import EmailSidebar from '../components/Casilla/EmailSidebar';
import EmailList from '../components/Casilla/EmailList';
import EmailDetail from '../components/Casilla/EmailDetail';
import ContextSidebar from '../components/Casilla/ContextSidebar';
import EmailComposer from '../components/Casilla/EmailComposer';
import { Button } from '@/components/ui';
import { RefreshCw, Inbox, FileText, Send, AlertCircle, File, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

const DRAFTS_KEY = 'crm_email_drafts';

const getDrafts = () => {
  try { return JSON.parse(localStorage.getItem(DRAFTS_KEY) || '[]'); }
  catch { return []; }
};

const saveDraft = (draft) => {
  const drafts = getDrafts();
  const existing = drafts.findIndex(d => d.id === draft.id);
  if (existing >= 0) drafts[existing] = draft;
  else drafts.unshift(draft);
  localStorage.setItem(DRAFTS_KEY, JSON.stringify(drafts));
};

const deleteDraft = (draftId) => {
  const drafts = getDrafts().filter(d => d.id !== draftId);
  localStorage.setItem(DRAFTS_KEY, JSON.stringify(drafts));
};

const fetchGmailAccount = async (agentId) => {
  const { data, error } = await supabase
    .from('gmail_accounts')
    .select('*')
    .eq('agent_id', agentId)
    .single();

  if (error && error.code !== 'PGRST116') {
    throw error;
  }
  return data;
};

const Casilla = () => {
  const { profile: userProfile } = useAuth();
  const location = useLocation();
  const [selectedThread, setSelectedThread] = useState(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  // Persists which thread IDs have been opened — survives EmailList remounts
  const [readThreadIds, setReadThreadIds] = useState(() => new Set());

  const markThreadRead = useCallback((thread) => {
    setReadThreadIds(prev => new Set([...prev, thread.id]));
    setSelectedThread(thread);
    // Persist to DB in background
    const msgs = thread.email_messages || [];
    const unreadMsgIds = msgs.filter(m => !m.is_read).map(m => m.id).filter(Boolean);
    if (unreadMsgIds.length > 0) {
      supabase.from('email_messages').update({ is_read: true }).in('id', unreadMsgIds);
    }
  }, []);

  // Folder state
  const [currentFolder, setCurrentFolder] = useState('inbox');
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [replyConfig, setReplyConfig] = useState(null);
  // Draft state — null means new email, object means editing saved draft
  const [activeDraftId, setActiveDraftId] = useState(null);
  const [drafts, setDrafts] = useState(getDrafts);

  // Auto-open thread when navigated from TaskModal / ActionModal
  useEffect(() => {
    const gmailThreadId = location.state?.openThreadId;
    if (!gmailThreadId) return;
    supabase
      .from('email_threads')
      .select('*')
      .eq('gmail_thread_id', gmailThreadId)
      .single()
      .then(({ data }) => {
        if (data) {
          setCurrentFolder('inbox');
          setSelectedThread(data);
        }
      });
  }, [location.state]);


  // Clear selected thread when switching folders
  const handleFolderChange = useCallback((folder) => {
    setCurrentFolder(folder);
    setSelectedThread(null);
  }, []);

  const refreshDrafts = useCallback(() => setDrafts(getDrafts()), []);

  const handleOpenDraft = (draft) => {
    setActiveDraftId(draft.id);
    setReplyConfig(null);
    setIsComposerOpen(true);
  };

  const handleDeleteDraft = (draftId) => {
    deleteDraft(draftId);
    refreshDrafts();
    toast.success('Borrador eliminado');
  };

  const handleComposerClose = (composerState) => {
    // composerState is passed from EmailComposer with { to, subject, html } when there's content
    // Empty Tiptap editor produces '<p></p>' — treat that as empty
    const hasContent = composerState && (
      composerState.subject?.trim() ||
      composerState.to?.trim() ||
      (composerState.html?.trim() && composerState.html !== '<p></p>')
    );
    if (hasContent) {
      const draftId = activeDraftId || `draft_${Date.now()}`;
      saveDraft({ id: draftId, savedAt: new Date().toISOString(), ...composerState });
      refreshDrafts();
      toast.info('Borrador guardado');
    } else if (activeDraftId) {
      // Closed empty draft — delete it
      deleteDraft(activeDraftId);
      refreshDrafts();
    }
    setIsComposerOpen(false);
    setReplyConfig(null);
    setActiveDraftId(null);
  };

  const { data: gmailAccount, isLoading: isAccountLoading, refetch: refetchAccount } = useQuery({
    queryKey: ['gmailAccount', userProfile?.id],
    queryFn: () => fetchGmailAccount(userProfile?.id),
    enabled: !!userProfile?.id,
  });

  const handleLoginGoogle = async () => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      console.log('Iniciando login Google, ¿token presente?:', !!token);
      if (!token) {
        throw new Error('No se encontró una sesión activa.');
      }

      const { data, error } = await supabase.functions.invoke('gmail-auth-url', {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      if (error) throw error;
      if (data && data.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      console.error('Error fetching auth url', err);
      // fallback or error toast here
    }
  };

  useEffect(() => {
    // Check if we just came back from auth callback
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const errorParam = urlParams.get('error');

    if (errorParam) {
      toast.error(`Error de Google: ${errorParam}`);
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (code) {
      // Process code with edge function
      const processCode = async () => {
        toast.loading("Sincronizando cuenta de Gmail...", { id: "gmail-sync" });
        try {
          const { data: sessionData } = await supabase.auth.getSession();
          const token = sessionData?.session?.access_token;

          console.log('Procesando callback Google, ¿token presente?:', !!token);
          if (!token) {
            throw new Error('No se encontró una sesión activa para procesar la vinculación.');
          }

          const { data, error } = await supabase.functions.invoke('gmail-auth-callback', {
            headers: {
              Authorization: `Bearer ${token}`
            },
            body: { code }
          });
          if (error) throw error;

          if (data?.error) {
            throw new Error(data.error);
          }

          toast.success("¡Cuenta de Gmail conectada con éxito!", { id: "gmail-sync" });
          // Clean url
          window.history.replaceState({}, document.title, window.location.pathname);
          refetchAccount();
        } catch (e) {
          console.error("Auth callback failed", e);
          toast.error(`Falló la conexión: ${e.message}`, { id: "gmail-sync", duration: 8000 });
        }
      };
      processCode();
    }
  }, [refetchAccount]);

  if (isAccountLoading) {
    return <div className="p-8 flex justify-center items-center h-full"><RefreshCw className="animate-spin w-8 h-8 text-blue-500" /></div>;
  }

  if (!gmailAccount) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-100px)] p-6 bg-white rounded-lg shadow-sm border border-gray-100">
        <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mb-6">
          <AlertCircle className="w-8 h-8 text-blue-500" />
        </div>
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Conecta tu cuenta de Gmail</h2>
        <p className="text-gray-500 mb-8 max-w-md text-center">
          Para utilizar la Casilla de Correos de REMAX Exclusive, necesitas sincronizar tu cuenta oficial (@remax-exclusive.cl). Esto te permitirá leer y enviar correos directamente desde el CRM y vincularlos con tus contactos reales.
        </p>
        <Button onClick={handleLoginGoogle} size="lg" className="bg-blue-600 hover:bg-blue-700 text-white font-semibold">
          Conectar con Google Workspace
        </Button>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-100px)] flex bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      <Split
        sizes={[15, 60, 25]}
        minSize={[150, 500, 250]}
        maxSize={[250, Infinity, 400]}
        gutterSize={4}
        gutterAlign="center"
        snapOffset={30}
        dragInterval={1}
        direction="horizontal"
        className="flex w-full h-full"
      >
        {/* 1. Sidebar (Folders) */}
        <div className="bg-gray-50 border-r border-gray-200 h-full overflow-y-auto">
          <EmailSidebar
            currentFolder={currentFolder}
            onFolderChange={handleFolderChange}
            draftCount={drafts.length}
            onCompose={() => {
              setActiveDraftId(null);
              setReplyConfig(null);
              setIsComposerOpen(true);
            }}
            onReconnect={handleLoginGoogle}
          />
        </div>

        {/* 2. Main Content (Email List OR Email Detail) */}
        <div className="border-r border-gray-200 h-full bg-white flex flex-col overflow-hidden">
          {selectedThread ? (
            <EmailDetail
              thread={selectedThread}
              userProfile={userProfile}
              onBack={() => setSelectedThread(null)}
              onReply={(replyContext) => {
                setActiveDraftId(null);
                setReplyConfig(replyContext);
                setIsComposerOpen(true);
              }}
              onThreadDeleted={() => setSelectedThread(null)}
            />
          ) : currentFolder === 'drafts' ? (
            <div className="flex flex-col h-full overflow-y-auto">
              <div className="px-4 py-3 border-b border-gray-100">
                <h2 className="font-semibold text-gray-800 flex items-center gap-2">
                  <File className="w-4 h-4 text-gray-500" /> Borradores {drafts.length > 0 && <span className="text-xs bg-gray-200 text-gray-600 rounded-full px-2 py-0.5">{drafts.length}</span>}
                </h2>
              </div>
              {drafts.length === 0 ? (
                <div className="flex flex-col items-center justify-center flex-1 text-gray-400 gap-2">
                  <File className="w-10 h-10 opacity-30" />
                  <p className="text-sm">No hay borradores guardados</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {drafts.map(draft => (
                    <div key={draft.id} className="flex items-start gap-3 px-4 py-3 hover:bg-gray-50 cursor-pointer group" onClick={() => handleOpenDraft(draft)}>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-gray-800 truncate">{draft.subject || '(Sin asunto)'}</p>
                        <p className="text-xs text-gray-500 truncate">Para: {draft.to || '—'}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{new Date(draft.savedAt).toLocaleString('es-CL')}</p>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDeleteDraft(draft.id); }}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500 transition-all"
                        title="Eliminar borrador"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <EmailList
              userProfile={userProfile}
              onSelectThread={markThreadRead}
              currentFolder={currentFolder}
              readThreadIds={readThreadIds}
              onUnmarkRead={(threadId) =>
                setReadThreadIds(prev => {
                  const next = new Set(prev);
                  next.delete(threadId);
                  return next;
                })
              }
            />
          )}
        </div>

        {/* 4. Context Sidebar (CRM Contact details) */}
        <div className="bg-white h-full overflow-y-auto p-4">
          <ContextSidebar
            thread={selectedThread}
            onContactLinked={async (contactId) => {
              // Re-fetch the thread from DB to get the updated contact_id
              const { data } = await supabase
                .from('email_threads')
                .select('*, email_messages(id, snippet, from_address, received_at, is_read)')
                .eq('id', selectedThread.id)
                .single();
              if (data) setSelectedThread(data);
            }}
          />
        </div>
      </Split>

      {/* Modals and Overlays */}
      {isComposerOpen && (
        <EmailComposer
          onClose={handleComposerClose}
          onSuccess={(draftId) => {
            toast.success('Correo enviado con éxito');
            // Delete draft if this was sent from a draft
            if (draftId || activeDraftId) {
              deleteDraft(draftId || activeDraftId);
              refreshDrafts();
            }
            setIsComposerOpen(false);
            setReplyConfig(null);
            setActiveDraftId(null);
          }}
          replyTo={replyConfig}
          userProfile={userProfile}
          initialDraft={activeDraftId ? drafts.find(d => d.id === activeDraftId) : null}
          draftId={activeDraftId}
        />
      )}
    </div>
  );
};

export default Casilla;
