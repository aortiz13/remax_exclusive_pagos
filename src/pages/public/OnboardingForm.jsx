import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'

const API_BASE = 'https://remax-crm-remax-app.jzuuqr.easypanel.host'

const EDUCATION_OPTIONS = [
    'Enseñanza media',
    'Técnico profesional',
    'Universitaria completa',
    'Otros',
]

export default function OnboardingForm() {
    const { token } = useParams()
    const [page, setPage] = useState(1)
    const [loading, setLoading] = useState(true)
    const [submitting, setSubmitting] = useState(false)
    const [submitted, setSubmitted] = useState(false)
    const [error, setError] = useState(null)
    const [otherEducation, setOtherEducation] = useState('')
    const [form, setForm] = useState({
        full_name: '',
        rut: '',
        birth_date: '',
        marital_status: '',
        address: '',
        contact_email: '',
        phone: '',
        company: '',
        job_title: '',
        education_level: '',
    })

    useEffect(() => {
        loadForm()
    }, [token])

    const loadForm = async () => {
        try {
            const res = await fetch(`${API_BASE}/api/onboarding/${token}`)
            if (res.ok) {
                const data = await res.json()
                if (data.alreadySubmitted) {
                    setSubmitted(true)
                } else if (data.prefill) {
                    setForm(prev => ({
                        ...prev,
                        ...Object.fromEntries(
                            Object.entries(data.prefill).filter(([, v]) => v)
                        ),
                    }))
                }
            }
            // If not ok, just show blank form (backend may not be deployed yet)
        } catch {
            // Backend unreachable — show form without prefill
            console.log('[Onboarding] Backend not available, showing blank form')
        }
        setLoading(false)
    }

    const handleChange = (field, value) => {
        setForm(prev => ({ ...prev, [field]: value }))
    }

    const validatePage1 = () => {
        const required = ['full_name', 'rut', 'birth_date', 'marital_status', 'address', 'contact_email', 'phone']
        for (const field of required) {
            if (!form[field]?.trim()) {
                const labels = {
                    full_name: 'Nombres y apellidos',
                    rut: 'Rut',
                    birth_date: 'Fecha de nacimiento',
                    marital_status: 'Estado civil',
                    address: 'Dirección',
                    contact_email: 'Correo de contacto',
                    phone: 'Teléfono',
                }
                setError(`El campo "${labels[field]}" es obligatorio`)
                return false
            }
        }
        setError(null)
        return true
    }

    const handleNext = () => {
        if (validatePage1()) setPage(2)
    }

    const handleSubmit = async () => {
        if (!form.company?.trim() || !form.job_title?.trim() || !form.education_level?.trim()) {
            setError('Todos los campos de la página 2 son obligatorios')
            return
        }
        setError(null)
        setSubmitting(true)

        try {
            const payload = {
                ...form,
                education_level: form.education_level === 'Otros' ? `Otros: ${otherEducation}` : form.education_level,
            }
            const res = await fetch(`${API_BASE}/api/onboarding/${token}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error)
            setSubmitted(true)
        } catch (err) {
            setError(err.message || 'Error al enviar formulario')
        }
        setSubmitting(false)
    }

    const handleReset = () => {
        setForm({
            full_name: '', rut: '', birth_date: '', marital_status: '',
            address: '', contact_email: '', phone: '',
            company: '', job_title: '', education_level: '',
        })
        setOtherEducation('')
        setPage(1)
    }

    if (loading) return (
        <div style={styles.pageWrapper}>
            <div style={styles.container}>
                <div style={{ ...styles.card, textAlign: 'center', padding: 60 }}>
                    <div style={styles.spinner} />
                    <p style={{ marginTop: 16, color: '#64748b', fontSize: 14 }}>Cargando formulario...</p>
                </div>
            </div>
        </div>
    )

    if (error && !form.full_name) return (
        <div style={styles.pageWrapper}>
            <div style={styles.container}>
                <div style={styles.headerBanner}>
                    <img src="https://remax-crm-remax-storage.jzuuqr.easypanel.host/public/remax-logo-white.png" alt="RE/MAX" style={styles.logo} onError={e => { e.target.style.display = 'none' }} />
                    <div style={styles.headerOverlay} />
                    <div style={styles.headerText}>
                        <h1 style={styles.headerTitle}>RE/MAX Exclusive</h1>
                    </div>
                </div>
                <div style={{ ...styles.card, textAlign: 'center', padding: 40 }}>
                    <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
                    <h2 style={{ fontSize: 20, fontWeight: 700, color: '#1e293b', marginBottom: 8 }}>Enlace inválido</h2>
                    <p style={{ color: '#64748b', fontSize: 14 }}>{error}</p>
                </div>
            </div>
        </div>
    )

    if (submitted) return (
        <div style={styles.pageWrapper}>
            <div style={styles.container}>
                <div style={styles.headerBanner}>
                    <div style={styles.headerOverlay} />
                    <div style={styles.headerText}>
                        <h1 style={styles.headerTitle}>RE/MAX Exclusive</h1>
                    </div>
                </div>
                <div style={{ ...styles.card, textAlign: 'center', padding: 40 }}>
                    <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
                    <h2 style={{ fontSize: 20, fontWeight: 700, color: '#1e293b', marginBottom: 8 }}>¡Formulario enviado!</h2>
                    <p style={{ color: '#64748b', fontSize: 14 }}>Tu información ha sido recibida exitosamente. Nos pondremos en contacto contigo pronto.</p>
                    <p style={{ color: '#94a3b8', fontSize: 12, marginTop: 16 }}>Equipo RE/MAX Exclusive</p>
                </div>
            </div>
        </div>
    )

    return (
        <div style={styles.pageWrapper}>
            <div style={styles.container}>
                {/* Header Banner */}
                <div style={styles.headerBanner}>
                    <div style={styles.headerOverlay} />
                    <div style={styles.headerContent}>
                        <div style={styles.logoContainer}>
                            <img
                                src="https://upload.wikimedia.org/wikipedia/commons/thumb/6/64/REMAX_logo.svg/220px-REMAX_logo.svg.png"
                                alt="RE/MAX"
                                style={{ height: 60 }}
                                onError={e => { e.target.style.display = 'none' }}
                            />
                        </div>
                        <div style={{ textAlign: 'right' }}>
                            <h2 style={{ color: 'white', fontSize: 28, fontWeight: 800, margin: 0, letterSpacing: '0.5px' }}>RE/MAX</h2>
                            <p style={{ color: 'white', fontSize: 14, fontWeight: 600, margin: 0, letterSpacing: '2px' }}>EXCLUSIVE</p>
                        </div>
                    </div>
                </div>

                {/* Title card */}
                <div style={styles.titleCard}>
                    <div style={styles.blueStripe} />
                    <div style={{ padding: '28px 32px' }}>
                        <h1 style={styles.formTitle}>Formulario de solicitud de ingreso</h1>
                        <p style={styles.formDescription}>
                            ¡Gracias por tu interés en conocer acerca de nuestro modelo de negocios y por aceptar la
                            oportunidad que te damos de convertirte en un Agente Inmobiliario EXITOSO!. En <strong>RE/MAX
                            Exclusive</strong> tendrás la oportunidad de RE/definir tu vida emprendiendo en el mundo de los
                            Bienes Raíces. Si estas listo/a para emprender y potenciar todo tu talento, te invitamos a
                            que te sumes a nuestro equipo de agentes exitosos.
                        </p>
                        <p style={styles.disclaimer}>*La información entregada en este formulario es de uso exclusivo de RE/MAX Exclusive*</p>
                        <p style={styles.requiredNote}>* <span style={{ color: '#dc2626' }}>Indica que la pregunta es obligatoria</span></p>
                    </div>
                </div>

                {/* Error display */}
                {error && (
                    <div style={styles.errorBanner}>
                        ⚠️ {error}
                    </div>
                )}

                {/* Page 1: Personal Information */}
                {page === 1 && (
                    <>
                        <FieldCard label="Nombres y apellidos" required>
                            <input type="text" value={form.full_name} onChange={e => handleChange('full_name', e.target.value)}
                                placeholder="Tu respuesta" style={styles.input} />
                        </FieldCard>

                        <FieldCard label="Rut" required>
                            <input type="text" value={form.rut} onChange={e => handleChange('rut', e.target.value)}
                                placeholder="Tu respuesta" style={styles.input} />
                        </FieldCard>

                        <FieldCard label="Fecha de nacimiento" required>
                            <p style={styles.inputLabel}>Fecha</p>
                            <input type="date" value={form.birth_date} onChange={e => handleChange('birth_date', e.target.value)}
                                style={styles.input} />
                        </FieldCard>

                        <FieldCard label="Estado civil" required>
                            <input type="text" value={form.marital_status} onChange={e => handleChange('marital_status', e.target.value)}
                                placeholder="Tu respuesta" style={styles.input} />
                        </FieldCard>

                        <FieldCard label="Dirección" required>
                            <input type="text" value={form.address} onChange={e => handleChange('address', e.target.value)}
                                placeholder="Tu respuesta" style={styles.input} />
                        </FieldCard>

                        <FieldCard label="Correo de contacto" required>
                            <input type="email" value={form.contact_email} onChange={e => handleChange('contact_email', e.target.value)}
                                placeholder="Tu respuesta" style={styles.input} />
                        </FieldCard>

                        <FieldCard label="Teléfono" required>
                            <input type="tel" value={form.phone} onChange={e => handleChange('phone', e.target.value)}
                                placeholder="Tu respuesta" style={styles.input} />
                        </FieldCard>

                        {/* Footer */}
                        <div style={styles.footerBar}>
                            <button onClick={handleNext} style={styles.primaryBtn}>Siguiente</button>
                            <div style={styles.progressBar}>
                                <div style={{ ...styles.progressFill, width: '50%' }} />
                            </div>
                            <span style={styles.pageIndicator}>Página 1 de 2</span>
                            <button onClick={handleReset} style={styles.linkBtn}>Borrar formulario</button>
                        </div>
                    </>
                )}

                {/* Page 2: Academic & Work Information */}
                {page === 2 && (
                    <>
                        <div style={styles.sectionCard}>
                            <div style={styles.sectionHeader}>Información Académica y Laboral</div>
                            <div style={{ padding: '20px 32px 28px' }}>
                                <label style={styles.fieldLabel}>Empresa u organización donde trabaja o trabajaba (última) <span style={styles.asterisk}>*</span></label>
                                <input type="text" value={form.company} onChange={e => handleChange('company', e.target.value)}
                                    placeholder="Tu respuesta" style={styles.input} />
                            </div>
                        </div>

                        <FieldCard label="Cargo o rol" required>
                            <input type="text" value={form.job_title} onChange={e => handleChange('job_title', e.target.value)}
                                placeholder="Tu respuesta" style={styles.input} />
                        </FieldCard>

                        <FieldCard label="Nivel académico" required>
                            <div style={styles.radioGroup}>
                                {EDUCATION_OPTIONS.map(opt => (
                                    <label key={opt} style={styles.radioLabel}>
                                        <input
                                            type="radio" name="education"
                                            checked={form.education_level === opt}
                                            onChange={() => handleChange('education_level', opt)}
                                            style={styles.radioInput}
                                        />
                                        <span style={styles.radioCircle}>
                                            {form.education_level === opt && <span style={styles.radioDot} />}
                                        </span>
                                        <span>{opt === 'Otros' ? 'Otros:' : opt}</span>
                                    </label>
                                ))}
                                {form.education_level === 'Otros' && (
                                    <input type="text" value={otherEducation} onChange={e => setOtherEducation(e.target.value)}
                                        placeholder="Especifica..." style={{ ...styles.input, marginLeft: 32 }} />
                                )}
                            </div>
                        </FieldCard>

                        {/* Team photo card */}
                        <div style={styles.card}>
                            <div style={{ display: 'flex', justifyContent: 'center', padding: 20 }}>
                                <img
                                    src="https://upload.wikimedia.org/wikipedia/commons/thumb/6/64/REMAX_logo.svg/220px-REMAX_logo.svg.png"
                                    alt="RE/MAX Exclusive Team"
                                    style={{ maxWidth: '100%', borderRadius: 8, maxHeight: 200, objectFit: 'contain' }}
                                    onError={e => { e.target.style.display = 'none' }}
                                />
                            </div>
                        </div>

                        {/* Footer */}
                        <div style={styles.footerBar}>
                            <button onClick={() => setPage(1)} style={styles.linkBtn}>Atrás</button>
                            <button onClick={handleSubmit} disabled={submitting} style={styles.primaryBtn}>
                                {submitting ? 'Enviando...' : 'Enviar'}
                            </button>
                            <div style={styles.progressBar}>
                                <div style={{ ...styles.progressFill, width: '100%', background: '#16a34a' }} />
                            </div>
                            <span style={styles.pageIndicator}>Página 2 de 2</span>
                            <button onClick={handleReset} style={styles.linkBtn}>Borrar formulario</button>
                        </div>
                    </>
                )}
            </div>
        </div>
    )
}

function FieldCard({ label, required, children }) {
    return (
        <div style={styles.card}>
            <div style={{ padding: '20px 32px 28px' }}>
                <label style={styles.fieldLabel}>
                    {label} {required && <span style={styles.asterisk}>*</span>}
                </label>
                {children}
            </div>
        </div>
    )
}

const styles = {
    pageWrapper: {
        minHeight: '100vh',
        background: '#b0bec5',
        padding: '24px 16px',
        fontFamily: "'Google Sans', 'Roboto', -apple-system, BlinkMacSystemFont, sans-serif",
    },
    container: {
        maxWidth: 640,
        margin: '0 auto',
    },
    headerBanner: {
        height: 160,
        borderRadius: '8px 8px 0 0',
        background: 'linear-gradient(135deg, #003DA5 0%, #001f5c 50%, #002D7A 100%)',
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 32px',
    },
    headerOverlay: {
        position: 'absolute',
        inset: 0,
        background: 'linear-gradient(45deg, rgba(0,61,165,0.9), rgba(0,45,122,0.7))',
    },
    headerContent: {
        position: 'relative',
        zIndex: 1,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        width: '100%',
    },
    logoContainer: {
        background: 'rgba(255,255,255,0.15)',
        borderRadius: 12,
        padding: '10px 16px',
        backdropFilter: 'blur(8px)',
    },
    headerText: { position: 'relative', zIndex: 1 },
    headerTitle: { color: 'white', fontSize: 24, fontWeight: 700, margin: 0 },
    titleCard: {
        background: 'white',
        borderRadius: '0 0 8px 8px',
        boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
        marginBottom: 12,
        overflow: 'hidden',
    },
    blueStripe: {
        height: 10,
        background: '#003DA5',
    },
    formTitle: {
        fontSize: 28,
        fontWeight: 400,
        color: '#202124',
        marginTop: 0,
        marginBottom: 16,
        lineHeight: 1.3,
    },
    formDescription: {
        fontSize: 14,
        color: '#202124',
        lineHeight: 1.6,
        marginBottom: 16,
    },
    disclaimer: {
        fontSize: 14,
        color: '#202124',
        fontWeight: 600,
        fontStyle: 'italic',
        marginBottom: 16,
    },
    requiredNote: {
        fontSize: 13,
        color: '#dc2626',
        borderTop: '1px solid #e5e7eb',
        paddingTop: 16,
        marginBottom: 0,
    },
    card: {
        background: 'white',
        borderRadius: 8,
        boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
        marginBottom: 12,
        border: '1px solid #dadce0',
    },
    sectionCard: {
        background: 'white',
        borderRadius: 8,
        boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
        marginBottom: 12,
        overflow: 'hidden',
        border: '1px solid #dadce0',
    },
    sectionHeader: {
        background: '#003DA5',
        color: 'white',
        padding: '14px 32px',
        fontSize: 16,
        fontWeight: 600,
    },
    fieldLabel: {
        display: 'block',
        fontSize: 16,
        color: '#202124',
        fontWeight: 400,
        marginBottom: 16,
    },
    asterisk: {
        color: '#dc2626',
        fontSize: 16,
        fontWeight: 400,
    },
    input: {
        width: '100%',
        maxWidth: 400,
        border: 'none',
        borderBottom: '1px solid #80868b',
        padding: '8px 0',
        fontSize: 14,
        color: '#202124',
        outline: 'none',
        background: 'transparent',
        transition: 'border-color 0.2s',
    },
    inputLabel: {
        fontSize: 12,
        color: '#80868b',
        marginBottom: 4,
        marginTop: 0,
    },
    radioGroup: {
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
    },
    radioLabel: {
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        fontSize: 14,
        color: '#202124',
        cursor: 'pointer',
    },
    radioInput: {
        position: 'absolute',
        opacity: 0,
        width: 0,
        height: 0,
    },
    radioCircle: {
        width: 20,
        height: 20,
        borderRadius: '50%',
        border: '2px solid #80868b',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
    },
    radioDot: {
        width: 10,
        height: 10,
        borderRadius: '50%',
        background: '#003DA5',
    },
    footerBar: {
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '16px 0',
        flexWrap: 'wrap',
    },
    primaryBtn: {
        background: '#003DA5',
        color: 'white',
        border: 'none',
        padding: '10px 24px',
        borderRadius: 4,
        fontSize: 14,
        fontWeight: 600,
        cursor: 'pointer',
        letterSpacing: '0.25px',
    },
    linkBtn: {
        background: 'none',
        border: 'none',
        color: '#003DA5',
        fontSize: 14,
        fontWeight: 600,
        cursor: 'pointer',
        padding: '8px 12px',
    },
    progressBar: {
        flex: 1,
        height: 4,
        background: '#dadce0',
        borderRadius: 2,
        overflow: 'hidden',
        minWidth: 80,
    },
    progressFill: {
        height: '100%',
        background: '#003DA5',
        transition: 'width 0.3s ease',
        borderRadius: 2,
    },
    pageIndicator: {
        fontSize: 12,
        color: '#5f6368',
        whiteSpace: 'nowrap',
    },
    errorBanner: {
        background: '#fef2f2',
        border: '1px solid #fecaca',
        color: '#991b1b',
        padding: '12px 20px',
        borderRadius: 8,
        fontSize: 14,
        marginBottom: 12,
    },
    spinner: {
        width: 32,
        height: 32,
        border: '3px solid #e2e8f0',
        borderTopColor: '#003DA5',
        borderRadius: '50%',
        margin: '0 auto',
        animation: 'spin 0.8s linear infinite',
    },
}
