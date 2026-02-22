
import { createContext, useContext, useEffect, useState, useRef } from 'react'
import { supabase } from '../services/supabase'
import { toast } from 'sonner'

const AuthContext = createContext({})

export const useAuth = () => useContext(AuthContext)

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null)
    const [profile, setProfile] = useState(null)
    const [loading, setLoading] = useState(true)

    const lastUserId = useRef(null)

    useEffect(() => {
        // Check active session
        supabase.auth.getSession().then(({ data: { session } }) => {
            const initialUser = session?.user ?? null
            setUser(initialUser)
            lastUserId.current = initialUser?.id

            if (initialUser) {
                fetchProfile(initialUser.id)
            } else {
                setLoading(false)
            }
        })

        // Listen for changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            const currentUser = session?.user ?? null

            // If the user ID hasn't changed, strictly ignore (handles token refreshes, tab focuses, etc.)
            if (currentUser?.id === lastUserId.current) {
                return
            }

            // Update ref
            lastUserId.current = currentUser?.id ?? null
            setUser(currentUser)

            if (currentUser) {
                setLoading(true)
                fetchProfile(currentUser.id)
            } else {
                setProfile(null)
                setLoading(false)
            }
        })

        return () => subscription.unsubscribe()
    }, [])

    // Sync Chatwoot Identity on load or profile change
    useEffect(() => {
        const handleChatwootReady = () => {
            if (profile && window.$chatwoot) {
                const userName = `${profile.first_name || ''} ${profile.last_name || ''}`.trim();
                const userPhone = profile.phone ? (profile.phone.startsWith('+') ? profile.phone : `+56${profile.phone.replace(/^56/, '')}`) : undefined;

                window.$chatwoot.setUser(profile.id, {
                    email: profile.email,
                    name: userName,
                    ...(userPhone && { phone_number: userPhone })
                });

                window.$chatwoot.setCustomAttributes({
                    correoBase: profile.email,
                    telefonoBase: profile.phone || 'No especificado',
                });
            }
        };

        window.addEventListener('chatwoot:ready', handleChatwootReady);

        // Also call it immediately in case Chatwoot is already ready
        if (window.$chatwoot && profile) {
            handleChatwootReady();
        }

        return () => window.removeEventListener('chatwoot:ready', handleChatwootReady);
    }, [profile])

    const fetchProfile = async (userId) => {
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', userId)
                .single()

            if (error && error.code !== 'PGRST116') {
                throw error
            }
            setProfile(data)

            // Set Chatwoot User Identity
            if (data && window.$chatwoot) {
                const userName = `${data.first_name || ''} ${data.last_name || ''}`.trim();
                const userPhone = data.phone ? (data.phone.startsWith('+') ? data.phone : `+56${data.phone.replace(/^56/, '')}`) : undefined;

                window.$chatwoot.setUser(userId, {
                    email: data.email,
                    name: userName,
                    ...(userPhone && { phone_number: userPhone })
                });

                window.$chatwoot.setCustomAttributes({
                    correoBase: data.email,
                    telefonoBase: data.phone || 'No especificado',
                });
            }
        } catch (error) {
            console.error('Error fetching profile:', error)
            toast.error('Error al cargar perfil de usuario')
        } finally {
            setLoading(false)
        }
    }

    const signOut = async () => {
        await supabase.auth.signOut()
        setUser(null)
        setProfile(null)

        // Clear Chatwoot session
        if (window.$chatwoot) {
            window.$chatwoot.reset()
        }
    }

    return (
        <AuthContext.Provider value={{ user, profile, loading, signOut, refreshProfile: () => user && fetchProfile(user.id) }}>
            {children}
        </AuthContext.Provider>
    )
}
