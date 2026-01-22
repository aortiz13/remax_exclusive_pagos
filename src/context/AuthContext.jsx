
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
    }

    return (
        <AuthContext.Provider value={{ user, profile, loading, signOut, refreshProfile: () => user && fetchProfile(user.id) }}>
            {children}
        </AuthContext.Provider>
    )
}
