import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../services/supabase'

/**
 * Handles auth callback links from GoTrue emails:
 * - /auth/recovery?token=...&type=recovery
 * - /auth/confirm?token=...&type=signup
 * - /auth/invite?token=...&type=invite
 * 
 * Verifies the token with GoTrue and redirects appropriately.
 */
export default function AuthCallback() {
    const [error, setError] = useState(null)
    const [loading, setLoading] = useState(true)
    const navigate = useNavigate()
    const [searchParams] = useSearchParams()

    useEffect(() => {
        const verifyToken = async () => {
            const token = searchParams.get('token')
            const type = searchParams.get('type')

            if (!token || !type) {
                setError('Token o tipo de verificación faltante')
                setLoading(false)
                return
            }

            try {
                // Map GoTrue types to Supabase OTP types
                const otpType = type === 'recovery' ? 'recovery' 
                    : type === 'signup' ? 'signup' 
                    : type === 'invite' ? 'invite'
                    : type === 'email_change' ? 'email_change'
                    : type

                const { data, error: verifyError } = await supabase.auth.verifyOtp({
                    token_hash: token,
                    type: otpType,
                })

                if (verifyError) throw verifyError

                // Redirect based on type
                if (type === 'recovery') {
                    navigate('/update-password', { replace: true })
                } else {
                    navigate('/dashboard', { replace: true })
                }
            } catch (err) {
                console.error('Auth callback error:', err)
                setError(err.message || 'Error al verificar el enlace')
                setLoading(false)
            }
        }

        verifyToken()
    }, [searchParams, navigate])

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-900">
                <div className="text-center space-y-4">
                    <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
                    <p className="text-lg text-slate-600 dark:text-slate-300">Verificando enlace...</p>
                </div>
            </div>
        )
    }

    if (error) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-900 p-4">
                <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-8 max-w-md w-full text-center space-y-4">
                    <div className="text-red-500 text-5xl">⚠️</div>
                    <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Error de verificación</h2>
                    <p className="text-slate-600 dark:text-slate-300">{error}</p>
                    <p className="text-sm text-slate-500">El enlace puede haber expirado o ya fue utilizado.</p>
                    <button
                        onClick={() => navigate('/login')}
                        className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                        Ir al Login
                    </button>
                </div>
            </div>
        )
    }

    return null
}
