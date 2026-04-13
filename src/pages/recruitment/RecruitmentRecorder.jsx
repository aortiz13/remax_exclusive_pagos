import { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../services/supabase'
import { toast } from 'sonner'
import {
    Download, Monitor, Apple, Laptop, Play, Mic, Search, Sparkles,
    CheckCircle2, Copy, ChevronDown, ChevronUp, HelpCircle, Shield,
    ArrowRight, FileText, Clock, Users, Volume2
} from 'lucide-react'

const APP_VERSION = '1.0.0'

// Downloads hosted on MinIO storage
const STORAGE_BASE = 'https://remax-crm-remax-storage.jzuuqr.easypanel.host/apps'

const DOWNLOADS = {
    mac: {
        url: `${STORAGE_BASE}/RE-MAX-Meeting-Recorder-${APP_VERSION}-universal.dmg`,
        label: 'macOS',
        icon: Apple,
        ext: '.dmg',
        size: '~85 MB',
        req: 'macOS 11 Big Sur o superior',
    },
    win: {
        url: `${STORAGE_BASE}/RE-MAX-Meeting-Recorder-Setup-${APP_VERSION}.exe`,
        label: 'Windows',
        icon: Monitor,
        ext: '.exe',
        size: '~75 MB',
        req: 'Windows 10 o superior',
    },
}

export default function RecruitmentRecorder() {
    const { profile } = useAuth()
    const [token, setToken] = useState('')
    const [copied, setCopied] = useState(false)
    const [openFaq, setOpenFaq] = useState(null)
    const [activeStep, setActiveStep] = useState(null)

    const generateToken = async () => {
        try {
            const { data: { session } } = await supabase.auth.getSession()
            if (session?.access_token) {
                setToken(session.access_token)
            } else {
                toast.error('No se pudo obtener el token. Intenta cerrar sesión y volver a entrar.')
            }
        } catch {
            toast.error('Error al generar token')
        }
    }

    const copyToken = () => {
        navigator.clipboard.writeText(token)
        setCopied(true)
        toast.success('Token copiado al portapapeles')
        setTimeout(() => setCopied(false), 3000)
    }

    const STEPS = [
        {
            num: 1,
            title: 'Descarga la app',
            icon: Download,
            content: (
                <div className="space-y-3">
                    <p className="text-sm text-slate-500">
                        Descarga la versión para tu sistema operativo:
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                        {Object.entries(DOWNLOADS).map(([key, dl]) => (
                            <a
                                key={key}
                                href={dl.url}
                                download
                                className="flex flex-col items-center gap-2 p-4 bg-slate-50 rounded-xl border-2 border-slate-200 hover:border-[#003DA5] hover:bg-blue-50/50 transition-all group"
                            >
                                <dl.icon className="w-8 h-8 text-slate-400 group-hover:text-[#003DA5] transition-colors" />
                                <span className="text-sm font-bold text-slate-700 group-hover:text-[#003DA5]">{dl.label}</span>
                                <span className="text-[10px] text-slate-400">{dl.ext} · {dl.size}</span>
                            </a>
                        ))}
                    </div>
                </div>
            ),
        },
        {
            num: 2,
            title: 'Instala la app',
            icon: Laptop,
            content: (
                <div className="text-sm text-slate-500 space-y-3">
                    <div className="flex gap-3">
                        <div className="flex-1 p-3 bg-slate-50 rounded-lg border border-slate-200">
                            <div className="flex items-center gap-2 mb-2">
                                <Apple className="w-4 h-4 text-slate-600" />
                                <span className="font-semibold text-slate-700 text-xs">macOS</span>
                            </div>
                            <ol className="space-y-1 text-xs text-slate-500">
                                <li>1. Abre el archivo <b>.dmg</b></li>
                                <li>2. Arrastra la app a <b>Aplicaciones</b></li>
                                <li>3. Abre la app desde Aplicaciones</li>
                                <li>4. Si dice "no verificado", ve a <b>Preferencias → Seguridad</b> y haz clic en "Abrir de todos modos"</li>
                            </ol>
                        </div>
                        <div className="flex-1 p-3 bg-slate-50 rounded-lg border border-slate-200">
                            <div className="flex items-center gap-2 mb-2">
                                <Monitor className="w-4 h-4 text-slate-600" />
                                <span className="font-semibold text-slate-700 text-xs">Windows</span>
                            </div>
                            <ol className="space-y-1 text-xs text-slate-500">
                                <li>1. Ejecuta el archivo <b>.exe</b></li>
                                <li>2. Si aparece SmartScreen, haz clic en <b>"Más información" → "Ejecutar de todas formas"</b></li>
                                <li>3. La app se instala automáticamente</li>
                                <li>4. Se abrirá cuando termine</li>
                            </ol>
                        </div>
                    </div>
                </div>
            ),
        },
        {
            num: 3,
            title: 'Inicia sesión con tu token',
            icon: Shield,
            content: (
                <div className="space-y-3">
                    <p className="text-sm text-slate-500">
                        La app necesita un token para conectarse a tu cuenta. Genera uno aquí y pégalo en la app:
                    </p>
                    {!token ? (
                        <button
                            onClick={generateToken}
                            className="w-full flex items-center justify-center gap-2 py-3 bg-[#003DA5] text-white text-sm font-semibold rounded-xl hover:bg-[#002D7A] transition-all shadow-md"
                        >
                            <Shield className="w-4 h-4" />
                            Generar mi token de acceso
                        </button>
                    ) : (
                        <div className="space-y-2">
                            <div className="flex items-center gap-2">
                                <div className="flex-1 bg-slate-900 text-green-400 p-3 rounded-lg font-mono text-xs break-all max-h-[60px] overflow-y-auto">
                                    {token}
                                </div>
                                <button
                                    onClick={copyToken}
                                    className={`shrink-0 p-3 rounded-lg border transition-all ${
                                        copied
                                            ? 'bg-emerald-50 border-emerald-300 text-emerald-600'
                                            : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'
                                    }`}
                                    title="Copiar token"
                                >
                                    {copied ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                                </button>
                            </div>
                            <p className="text-[10px] text-amber-600 bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-200">
                                ⚠️ Este token es personal y expira al cerrar sesión. No lo compartas.
                            </p>
                        </div>
                    )}
                </div>
            ),
        },
        {
            num: 4,
            title: 'Graba tu reunión',
            icon: Mic,
            content: (
                <div className="text-sm text-slate-500 space-y-3">
                    <div className="space-y-2">
                        {[
                            { icon: Play, text: 'Abre tu reunión de Google Meet (u otra plataforma)' },
                            { icon: Laptop, text: 'En la app, elige la ventana de la reunión' },
                            { icon: Search, text: 'Busca y selecciona al candidato' },
                            { icon: Mic, text: 'Presiona el botón rojo para grabar' },
                            { icon: Volume2, text: 'Haz la entrevista normalmente' },
                            { icon: CheckCircle2, text: 'Al terminar, presiona "Detener". Se sube automáticamente.' },
                        ].map((step, i) => (
                            <div key={i} className="flex items-start gap-3 p-2.5 bg-slate-50 rounded-lg">
                                <div className="w-6 h-6 rounded-full bg-[#003DA5]/10 flex items-center justify-center shrink-0 mt-0.5">
                                    <step.icon className="w-3 h-3 text-[#003DA5]" />
                                </div>
                                <span className="text-xs text-slate-600">{step.text}</span>
                            </div>
                        ))}
                    </div>
                </div>
            ),
        },
        {
            num: 5,
            title: 'Revisa y extrae datos con IA',
            icon: Sparkles,
            content: (
                <div className="text-sm text-slate-500 space-y-2">
                    <p>
                        Después de grabar, vuelve al CRM:
                    </p>
                    <div className="space-y-2">
                        {[
                            'Abre el perfil del candidato',
                            'Ve a la pestaña "Reuniones"',
                            'Haz clic en la reunión para ver la transcripción',
                            'Presiona "Extraer datos con IA" para llenar el formulario automáticamente',
                            'Revisa los datos y haz clic en "Aplicar al perfil"',
                        ].map((t, i) => (
                            <div key={i} className="flex items-center gap-2">
                                <span className="w-5 h-5 rounded-full bg-violet-100 text-violet-600 text-[10px] font-bold flex items-center justify-center shrink-0">
                                    {i + 1}
                                </span>
                                <span className="text-xs text-slate-600">{t}</span>
                            </div>
                        ))}
                    </div>
                </div>
            ),
        },
    ]

    const FAQ = [
        {
            q: '¿Qué plataformas de videollamada soporta?',
            a: 'La app graba el audio de cualquier aplicación: Google Meet, Zoom, Microsoft Teams, etc. Solo debes seleccionar la ventana correcta.',
        },
        {
            q: '¿Se graba video también?',
            a: 'No, solo se graba el audio para mantener los archivos livianos y la transcripción rápida.',
        },
        {
            q: '¿Qué pasa si mi token expira?',
            a: 'Simplemente vuelve a esta página, genera un nuevo token, y pégalo en la app. Los tokens expiran cuando cierras sesión en el CRM.',
        },
        {
            q: '¿Cuánto dura la transcripción?',
            a: 'Depende de la duración de la reunión. Generalmente entre 10 segundos y 2 minutos.',
        },
        {
            q: '¿La IA siempre extrae los datos correctamente?',
            a: 'La IA es muy precisa, pero siempre puedes revisar y corregir los datos antes de aplicarlos al perfil del candidato.',
        },
        {
            q: '¿Necesito permiso del candidato para grabar?',
            a: 'Sí. Se recomienda informar al candidato al inicio de la reunión que será grabada con fines de registro interno.',
        },
    ]

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/30 pb-12">
            {/* Hero Section */}
            <div className="relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-[#003DA5] to-[#001f5c]" />
                <div className="absolute inset-0 opacity-10" style={{
                    backgroundImage: 'radial-gradient(circle at 20% 50%, rgba(255,255,255,0.3) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(255,255,255,0.2) 0%, transparent 40%)',
                }} />

                <div className="relative max-w-3xl mx-auto px-6 py-12 text-center text-white">
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/15 backdrop-blur rounded-full text-xs font-medium mb-6">
                        <Mic className="w-3.5 h-3.5" />
                        Herramienta de Reclutamiento
                    </div>

                    <h1 className="text-3xl font-extrabold tracking-tight mb-3">
                        Meeting Recorder
                    </h1>
                    <p className="text-base text-blue-100 max-w-lg mx-auto leading-relaxed">
                        Graba reuniones de reclutamiento, transcribe automáticamente y extrae datos del candidato con inteligencia artificial.
                    </p>

                    {/* Feature pills */}
                    <div className="flex items-center justify-center flex-wrap gap-2 mt-6">
                        {[
                            { icon: Mic, text: 'Grabación HD' },
                            { icon: FileText, text: 'Transcripción IA' },
                            { icon: Sparkles, text: 'Extracción automática' },
                            { icon: Users, text: 'Integrado al CRM' },
                        ].map((f, i) => (
                            <div key={i} className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 backdrop-blur-sm rounded-full text-xs font-medium">
                                <f.icon className="w-3 h-3" />
                                {f.text}
                            </div>
                        ))}
                    </div>

                    {/* Quick download buttons */}
                    <div className="flex items-center justify-center gap-3 mt-8">
                        {Object.entries(DOWNLOADS).map(([key, dl]) => (
                            <a
                                key={key}
                                href={dl.url}
                                download
                                className="flex items-center gap-2 px-5 py-3 bg-white text-[#003DA5] font-bold text-sm rounded-xl hover:bg-blue-50 transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5"
                            >
                                <dl.icon className="w-4 h-4" />
                                Descargar para {dl.label}
                            </a>
                        ))}
                    </div>

                    <p className="text-[10px] text-blue-200 mt-3">
                        Versión {APP_VERSION} · Mac y Windows · Gratuita para uso interno
                    </p>
                </div>
            </div>

            {/* Steps Section */}
            <div className="max-w-2xl mx-auto px-6 -mt-4">
                <div className="bg-white rounded-2xl shadow-xl border border-slate-200/80 overflow-hidden">
                    <div className="p-5 border-b border-slate-100">
                        <h2 className="text-lg font-bold text-slate-800">Paso a paso</h2>
                        <p className="text-xs text-slate-400 mt-0.5">Sigue estos 5 pasos para empezar a grabar</p>
                    </div>

                    <div className="divide-y divide-slate-100">
                        {STEPS.map((step) => (
                            <div key={step.num}>
                                <button
                                    onClick={() => setActiveStep(activeStep === step.num ? null : step.num)}
                                    className="w-full flex items-center gap-4 p-4 text-left hover:bg-slate-50/80 transition-colors"
                                >
                                    <div className="w-9 h-9 rounded-xl bg-[#003DA5]/10 flex items-center justify-center shrink-0">
                                        <step.icon className="w-4.5 h-4.5 text-[#003DA5]" />
                                    </div>
                                    <div className="flex-1">
                                        <span className="text-[10px] font-bold text-[#003DA5] uppercase tracking-wider">
                                            Paso {step.num}
                                        </span>
                                        <h3 className="text-sm font-semibold text-slate-700">{step.title}</h3>
                                    </div>
                                    {activeStep === step.num
                                        ? <ChevronUp className="w-4 h-4 text-slate-300" />
                                        : <ChevronDown className="w-4 h-4 text-slate-300" />
                                    }
                                </button>

                                {activeStep === step.num && (
                                    <div className="px-4 pb-4 pt-0 ml-[52px] mr-4 animate-fadeIn">
                                        {step.content}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* FAQ Section */}
            <div className="max-w-2xl mx-auto px-6 mt-8">
                <div className="bg-white rounded-2xl shadow-lg border border-slate-200/80 overflow-hidden">
                    <div className="p-5 border-b border-slate-100">
                        <div className="flex items-center gap-2">
                            <HelpCircle className="w-5 h-5 text-slate-400" />
                            <h2 className="text-lg font-bold text-slate-800">Preguntas frecuentes</h2>
                        </div>
                    </div>

                    <div className="divide-y divide-slate-100">
                        {FAQ.map((faq, i) => (
                            <div key={i}>
                                <button
                                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                                    className="w-full flex items-center gap-3 p-4 text-left hover:bg-slate-50/80 transition-colors"
                                >
                                    <span className="flex-1 text-sm font-medium text-slate-700">{faq.q}</span>
                                    {openFaq === i
                                        ? <ChevronUp className="w-4 h-4 text-slate-300 shrink-0" />
                                        : <ChevronDown className="w-4 h-4 text-slate-300 shrink-0" />
                                    }
                                </button>
                                {openFaq === i && (
                                    <div className="px-4 pb-4 text-sm text-slate-500 leading-relaxed animate-fadeIn">
                                        {faq.a}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <style>{`
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(-4px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .animate-fadeIn {
                    animation: fadeIn 0.2s ease-out;
                }
            `}</style>
        </div>
    )
}
