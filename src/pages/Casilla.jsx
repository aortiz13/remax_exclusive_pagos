import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { useAuth } from '../context/AuthContext';
import Split from 'react-split';
import { useQuery } from '@tanstack/react-query';
import EmailSidebar from '../components/Casilla/EmailSidebar';
import EmailList from '../components/Casilla/EmailList';
import EmailDetail from '../components/Casilla/EmailDetail';
import ContextSidebar from '../components/Casilla/ContextSidebar';
import { Button } from '@/components/ui';
import { RefreshCw, Inbox, FileText, Send, AlertCircle } from 'lucide-react';

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
  const [selectedThread, setSelectedThread] = useState(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  const { data: gmailAccount, isLoading: isAccountLoading, refetch: refetchAccount } = useQuery({
    queryKey: ['gmailAccount', userProfile?.id],
    queryFn: () => fetchGmailAccount(userProfile?.id),
    enabled: !!userProfile?.id,
  });

  const handleLoginGoogle = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('gmail-auth-url');
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
    if (code) {
      // Process code with edge function
      const processCode = async () => {
        try {
          const { data, error } = await supabase.functions.invoke('gmail-auth-callback', {
            body: { code }
          });
          if (error) throw error;
          // Clean url
          window.history.replaceState({}, document.title, window.location.pathname);
          refetchAccount();
        } catch (e) {
          console.error("Auth callback failed", e);
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
        sizes={[15, 30, 40, 15]}
        minSize={[150, 250, 400, 150]}
        maxSize={[250, 400, Infinity, 350]}
        gutterSize={4}
        gutterAlign="center"
        snapOffset={30}
        dragInterval={1}
        direction="horizontal"
        className="flex w-full h-full"
      >
        {/* 1. Sidebar (Folders) */}
        <div className="bg-gray-50 border-r border-gray-200 h-full overflow-y-auto">
          <EmailSidebar />
        </div>

        {/* 2. Email List (Virtualizado idealmente) */}
        <div className="border-r border-gray-200 h-full bg-white flex flex-col">
          <EmailList userProfile={userProfile} onSelectThread={setSelectedThread} />
        </div>

        {/* 3. Email Detail / Conversation Thread */}
        <div className="border-r border-gray-200 h-full bg-gray-50 flex flex-col overflow-y-auto">
          {selectedThread ? (
            <EmailDetail thread={selectedThread} userProfile={userProfile} />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
              <Inbox className="w-16 h-16 mb-4 text-gray-300" />
              <p>Selecciona un correo para leerlo</p>
            </div>
          )}
        </div>

        {/* 4. Context Sidebar (CRM Contact details) */}
        <div className="bg-white h-full overflow-y-auto p-4">
          <ContextSidebar thread={selectedThread} />
        </div>
      </Split>
    </div>
  );
};

export default Casilla;
