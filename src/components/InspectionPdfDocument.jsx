import React from 'react'
import { Document, Page, View, Text, Image, StyleSheet } from '@react-pdf/renderer'

// ─── Minimal palette ─────────────────────────────────────
const BLUE = '#003DA5'
const GRAY_100 = '#F3F4F6'
const GRAY_200 = '#E5E7EB'
const GRAY_400 = '#9CA3AF'
const GRAY_500 = '#6B7280'
const GRAY_700 = '#374151'
const GRAY_900 = '#111827'

const s = StyleSheet.create({
    page: { fontFamily: 'Helvetica', fontSize: 9, color: GRAY_900, paddingTop: 20, paddingBottom: 40, paddingHorizontal: 0 },

    // ── Header ──
    header: { paddingHorizontal: 40, paddingTop: 20, paddingBottom: 16, borderBottom: `0.5 solid ${GRAY_200}` },
    headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    headerLogo: { height: 66 },
    headerTitle: { fontSize: 15, fontWeight: 'bold', color: GRAY_900, letterSpacing: 0.5, flex: 1, textAlign: 'center', paddingHorizontal: 10 },
    headerDate: { fontSize: 9, color: GRAY_700 },
    headerAddress: { fontSize: 8, color: GRAY_500, marginTop: 4 },
    headerLine: { width: 40, height: 2, backgroundColor: BLUE, marginTop: 8 },

    // ── Content ──
    content: { paddingHorizontal: 40, paddingTop: 16 },

    // ── Section ──
    sectionHeader: { marginBottom: 8, marginTop: 18, borderBottom: `1.5 solid ${BLUE}`, paddingBottom: 5 },
    sectionTitle: { fontSize: 11, fontWeight: 'bold', color: BLUE },

    // ── Fields ──
    fieldRow: { flexDirection: 'row', gap: 10, marginBottom: 6 },
    fieldCol: { flex: 1 },
    fieldLabel: { fontSize: 7, color: GRAY_400, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
    fieldValue: { fontSize: 9, color: GRAY_900, paddingVertical: 6, paddingHorizontal: 8, backgroundColor: GRAY_100, borderRadius: 3, borderLeft: `2 solid ${BLUE}` },

    // ── Table ──
    table: { borderRadius: 3, overflow: 'hidden', marginBottom: 8, border: `0.5 solid ${GRAY_200}` },
    tHeadRow: { flexDirection: 'row', backgroundColor: BLUE, borderBottom: `0.5 solid ${GRAY_200}` },
    tHeadCell: { fontSize: 7, fontWeight: 'bold', color: '#FFFFFF', paddingVertical: 6, paddingHorizontal: 8, textTransform: 'uppercase', letterSpacing: 0.3 },
    tRow: { flexDirection: 'row', borderBottom: `0.5 solid ${GRAY_100}` },
    tRowAlt: { flexDirection: 'row', borderBottom: `0.5 solid ${GRAY_100}`, backgroundColor: '#FAFAFA' },
    tCell: { fontSize: 8, color: GRAY_700, paddingVertical: 5, paddingHorizontal: 8 },
    tCellBold: { fontSize: 8, color: GRAY_900, paddingVertical: 5, paddingHorizontal: 8 },

    // ── Estado ──
    eBueno: { backgroundColor: '#ECFDF5', color: '#065F46', fontSize: 7, paddingVertical: 2, paddingHorizontal: 6, borderRadius: 3, textAlign: 'center' },
    eRegular: { backgroundColor: '#FFFBEB', color: '#92400E', fontSize: 7, paddingVertical: 2, paddingHorizontal: 6, borderRadius: 3, textAlign: 'center' },
    eMalo: { backgroundColor: '#FEF2F2', color: '#991B1B', fontSize: 7, paddingVertical: 2, paddingHorizontal: 6, borderRadius: 3, textAlign: 'center' },
    eNA: { backgroundColor: GRAY_100, color: GRAY_500, fontSize: 7, paddingVertical: 2, paddingHorizontal: 6, borderRadius: 3, textAlign: 'center' },

    // ── Text areas ──
    textBox: { fontSize: 9, color: GRAY_700, padding: 10, backgroundColor: GRAY_100, borderRadius: 3, minHeight: 30, lineHeight: 1.5 },

    // ── Declaration ──
    declBox: { marginTop: 16, paddingTop: 12, borderTop: `0.5 solid ${GRAY_200}` },
    declTitle: { fontSize: 8, fontWeight: 'bold', color: GRAY_400, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
    declText: { fontSize: 7, color: GRAY_500, lineHeight: 1.5 },

    // ── Photos ──
    photoPageBar: { borderBottom: `0.5 solid ${GRAY_200}`, paddingHorizontal: 40, paddingVertical: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    photoPageTitle: { fontSize: 11, fontWeight: 'bold', color: GRAY_900 },
    photoPageNum: { fontSize: 8, color: GRAY_400 },
    photoWrap: { marginHorizontal: 40, marginTop: 14, border: `0.5 solid ${GRAY_200}`, borderRadius: 4, overflow: 'hidden' },
    photoImg: { width: '100%', height: 320, objectFit: 'cover' },
    photoCap: { paddingVertical: 4, paddingHorizontal: 10, backgroundColor: GRAY_100 },
    photoCapTxt: { fontSize: 7, color: GRAY_500 },

    // ── Footer ──
    footer: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 30, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 40, borderTop: `0.5 solid ${GRAY_200}` },
    footerTxt: { fontSize: 7, color: GRAY_400 },
    footerLogo: { height: 18 },

    // ── Room ──
    roomName: { fontSize: 9, fontWeight: 'bold', color: GRAY_700, marginBottom: 4, marginTop: 8 },
})

// ─── Components ──────────────────────────────────────────
const Estado = ({ v }) => {
    if (!v) return <Text style={s.tCell}>—</Text>
    const m = { Bueno: s.eBueno, Regular: s.eRegular, Malo: s.eMalo, 'N/A': s.eNA }
    return <Text style={m[v] || s.tCell}>{v}</Text>
}

const Section = ({ title }) => (
    <View style={s.sectionHeader} minPresenceAhead={120}>
        <Text style={s.sectionTitle}>{title}</Text>
    </View>
)

const Table = ({ items }) => (
    <View style={s.table} wrap={false}>
        <View style={s.tHeadRow}>
            <Text style={[s.tHeadCell, { width: '42%' }]}>Ítem</Text>
            <Text style={[s.tHeadCell, { width: '16%', textAlign: 'center' }]}>Estado</Text>
            <Text style={[s.tHeadCell, { width: '42%' }]}>Observación</Text>
        </View>
        {(items || []).map((it, i) => (
            <View key={i} style={i % 2 === 0 ? s.tRow : s.tRowAlt}>
                <Text style={[s.tCellBold, { width: '42%' }]}>{it.label}</Text>
                <View style={{ width: '16%', paddingVertical: 4, paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center' }}>
                    <Estado v={it.estado} />
                </View>
                <Text style={[s.tCell, { width: '42%' }]}>{it.observacion || ''}</Text>
            </View>
        ))}
    </View>
)

const Footer = ({ year, agent, logo }) => (
    <View style={s.footer} fixed>
        <Text style={s.footerTxt}>© {year} RE/MAX Exclusive — {agent}</Text>
        <Text style={s.footerTxt}>Informe de Inspección</Text>
        {logo && <Image src={logo} style={s.footerLogo} />}
    </View>
)

const DECL = `Este informe corresponde a una inspección visual y presencial realizada por el agente en la fecha indicada. Su alcance se limita a las condiciones observables en ese momento y a la información que fue posible recabar durante la visita. El presente documento no constituye una inspección técnica especializada, ni reemplaza evaluaciones de carácter estructural, eléctrico, sanitario u otras revisiones profesionales. Las observaciones aquí contenidas reflejan únicamente lo constatado en la fecha de la inspección. El registro fotográfico es referencial. Este informe es de carácter informativo y está destinado al uso exclusivo del propietario.`

// ─── Document ────────────────────────────────────────────
const InspectionPdfDocument = ({ formData, observations, recommendations, photos, logoBase64 }) => {
    const year = new Date().getFullYear()
    const agent = formData?.agente_nombre || ''
    const pairs = []
    const p = photos || []
    for (let i = 0; i < p.length; i += 2) pairs.push(p.slice(i, i + 2))

    return (
        <Document>
            <Page size="A4" style={s.page}>
                {/* ── Header ── */}
                <View style={s.header}>
                    <View style={s.headerTop}>
                        {logoBase64 ? <Image src={logoBase64} style={s.headerLogo} /> : <View />}
                        <Text style={s.headerTitle}>Informe de Inspección</Text>
                        <Text style={s.headerDate}>{formData?.fecha_inspeccion || ''}</Text>
                    </View>
                    <Text style={s.headerAddress}>{formData?.direccion || ''}</Text>
                    <View style={s.headerLine} />
                </View>

                <View style={s.content}>
                    {/* 1 */}
                    <View wrap={false}>
                        <Section title="Datos del Agente" />
                        <View style={s.fieldRow}>
                            <View style={s.fieldCol}>
                                <Text style={s.fieldLabel}>Agente</Text>
                                <Text style={s.fieldValue}>{formData?.agente_nombre || ''}</Text>
                            </View>
                            <View style={s.fieldCol}>
                                <Text style={s.fieldLabel}>Fecha</Text>
                                <Text style={s.fieldValue}>{formData?.fecha_inspeccion || ''}</Text>
                            </View>
                        </View>
                    </View>

                    {/* 2 */}
                    <View wrap={false}>
                        <Section title="Datos de la Propiedad" />
                        <View style={{ marginBottom: 6 }}>
                            <Text style={s.fieldLabel}>Dirección</Text>
                            <Text style={s.fieldValue}>{formData?.direccion || ''}</Text>
                        </View>
                        <View style={s.fieldRow}>
                            <View style={s.fieldCol}>
                                <Text style={s.fieldLabel}>
                                    {Array.isArray(formData?.propietarios) && formData.propietarios.length > 1 ? 'Propietarios' : 'Propietario'}
                                </Text>
                                {Array.isArray(formData?.propietarios) && formData.propietarios.length > 0 ? (
                                    formData.propietarios.map((p, i) => (
                                        <View key={i} style={{ marginBottom: 2 }}>
                                            <Text style={s.fieldValue}>
                                                {formData.propietarios.length > 1 ? `${i + 1}. ` : ''}{p.nombre || ''}
                                            </Text>
                                            {p.email ? <Text style={{ fontSize: 7, color: '#6B7280' }}>   {p.email}</Text> : null}
                                        </View>
                                    ))
                                ) : (
                                    <Text style={s.fieldValue}>{formData?.propietario || ''}</Text>
                                )}
                            </View>
                            <View style={s.fieldCol}>
                                <Text style={s.fieldLabel}>
                                    {Array.isArray(formData?.arrendatarios) && formData.arrendatarios.length > 1 ? 'Arrendatarios' : 'Arrendatario'}
                                </Text>
                                {Array.isArray(formData?.arrendatarios) && formData.arrendatarios.length > 0 ? (
                                    formData.arrendatarios.map((a, i) => (
                                        <Text key={i} style={s.fieldValue}>
                                            {formData.arrendatarios.length > 1 ? `${i + 1}. ` : ''}{a.nombre || ''}
                                        </Text>
                                    ))
                                ) : (
                                    <Text style={s.fieldValue}>{formData?.arrendatario || ''}</Text>
                                )}
                            </View>
                        </View>

                    </View>

                    {/* Dynamic sections (new format) — skip empty items & sections */}
                    {Array.isArray(formData?.sections) ? (
                        formData.sections.map((section, i) => {
                            const filledItems = (section.items || []).filter(it => it.estado || it.observacion)
                            if (filledItems.length === 0) return null
                            return (
                                <View key={section.key || i}>
                                    <Section title={section.title} />
                                    <Table items={filledItems} />
                                </View>
                            )
                        })
                    ) : (
                        <>
                            {/* Legacy format fallback */}
                            {/* 3 */}
                            <Section title="Cocina" />
                            <Table items={formData?.cocina} />

                            {/* 4 */}
                            <Section title="Sala de Estar / Living / Comedor" />
                            <Table items={formData?.sala_estar} />

                            {/* 5 */}
                            <Section title="Dormitorios" />
                            {(formData?.dormitorios || []).map((r, i) => (
                                <View key={i}>
                                    <Text style={s.roomName}>{r.nombre}</Text>
                                    <Table items={r.items} />
                                </View>
                            ))}

                            {/* 6 */}
                            <Section title="Baño(s)" />
                            {(formData?.banos || []).map((r, i) => (
                                <View key={i}>
                                    <Text style={s.roomName}>{r.nombre}</Text>
                                    <Table items={r.items} />
                                </View>
                            ))}
                        </>
                    )}

                    {/* 7 */}
                    <View wrap={false}>
                        <Section title="Observaciones Finales" />
                        <View style={{ marginBottom: 6 }}>
                            <Text style={s.fieldLabel}>Observaciones Adicionales</Text>
                            <Text style={s.textBox}>{observations || 'Sin observaciones.'}</Text>
                        </View>
                        <View style={{ marginBottom: 6 }}>
                            <Text style={s.fieldLabel}>Recomendaciones</Text>
                            <Text style={s.textBox}>{recommendations || 'Sin recomendaciones.'}</Text>
                        </View>
                    </View>

                    {/* Declaration */}
                    <View style={s.declBox} wrap={false}>
                        <Text style={s.declTitle}>Declaración</Text>
                        <Text style={s.declText}>{DECL}</Text>
                    </View>
                </View>

                <Footer year={year} agent={agent} logo={logoBase64} />
            </Page>

            {/* ── Photo pages: 2 per page ── */}
            {pairs.map((pair, pi) => (
                <Page key={pi} size="A4" style={s.page}>
                    <View style={s.photoPageBar}>
                        <Text style={s.photoPageTitle}>Registro Fotográfico</Text>
                        <Text style={s.photoPageNum}>Pág. {pi + 1} / {pairs.length}</Text>
                    </View>
                    {pair.map((ph, idx) => (
                        <View key={idx} style={s.photoWrap}>
                            {ph.base64 && <Image src={ph.base64} style={s.photoImg} />}
                            <View style={s.photoCap}>
                                <Text style={s.photoCapTxt}>Foto {pi * 2 + idx + 1} de {p.length}</Text>
                            </View>
                        </View>
                    ))}
                    <Footer year={year} agent={agent} logo={logoBase64} />
                </Page>
            ))}
        </Document>
    )
}

export default InspectionPdfDocument
