import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Button, Label } from '@/components/ui'
import { X, Send, Star, MessageSquare, Mail, Loader2, Trash2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../../services/supabase'
import { useAuth } from '../../context/AuthContext'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import ContactPickerInline from '../../components/ui/ContactPickerInline'
import { logActivity } from '../../services/activityService'

/**
 * TransactionCompletionModal
 * 
 * Shown when a property status changes to 'Vendida' or 'Arrendada'.
 * - Asks for buyer/tenant contact
 * - Shows seller/owner (auto from property_contacts)
 * - Sends thank-you email + WhatsApp to both parties with Google review link
 * - Creates 3 transaction_followup records (1mo, 6mo, 1yr)
 */
const TransactionCompletionModal = ({ isOpen, property, agentProfile, existingLinks = [], pendingLinks = [], onClose }) => {
    const { user } = useAuth()
    const [sending, setSending] = useState(false)
    const [buyerContactId, setBuyerContactId] = useState(null)
    const [buyerContact, setBuyerContact] = useState(null)
    const [sellerContact, setSellerContact] = useState(null)
    const [savingSellerLink, setSavingSellerLink] = useState(false)
    const [savingBuyerLink, setSavingBuyerLink] = useState(false)
    const [sellerLinkedFromModal, setSellerLinkedFromModal] = useState(false)
    const [buyerLinkedFromModal, setBuyerLinkedFromModal] = useState(false)

    // Determine transaction type from property status
    const transactionType = (property?.status || []).includes('Arrendada') ? 'arriendo' : 'venta'
    const isArriendo = transactionType === 'arriendo'

    // Find owner/seller contact from property links
    useEffect(() => {
        const ownerLink = [...existingLinks, ...pendingLinks].find(l => l.role === 'propietario')
        if (ownerLink?.contact) {
            setSellerContact(ownerLink.contact)
        }
    }, [existingLinks, pendingLinks])

    // Helper: clear seller and remove DB link
    const handleClearSeller = async () => {
        if (sellerContact?.id) {
            await supabase.from('property_contacts')
                .delete()
                .eq('property_id', property.id)
                .eq('contact_id', sellerContact.id)
                .eq('role', 'propietario')
            await supabase.from('properties')
                .update({ owner_id: null })
                .eq('id', property.id)
        }
        setSellerContact(null)
        setSellerLinkedFromModal(false)
    }

    // Helper: clear buyer and remove DB link
    const handleClearBuyer = async () => {
        if (buyerContact?.id) {
            await supabase.from('property_contacts')
                .delete()
                .eq('property_id', property.id)
                .eq('contact_id', buyerContact.id)
                .eq('role', 'comprador')
        }
        setBuyerContact(null)
        setBuyerContactId(null)
        setBuyerLinkedFromModal(false)
    }

    const handleSend = async () => {
        if (!buyerContact) {
            toast.error(`Selecciona el contacto del ${isArriendo ? 'arrendatario' : 'comprador'}`)
            return
        }

        setSending(true)
        try {
            const agentName = `${agentProfile?.first_name || ''} ${agentProfile?.last_name || ''}`.trim()
            const sellerName = sellerContact ? `${sellerContact.first_name || ''} ${sellerContact.last_name || ''}`.trim() : ''
            const buyerName = `${buyerContact.first_name || ''} ${buyerContact.last_name || ''}`.trim()

            // 1. Send notifications via n8n webhook
            const payload = {
                transaction_type: transactionType,
                property_address: property?.address || '',
                agent_name: agentName,
                seller_name: sellerName,
                seller_email: sellerContact?.email || '',
                seller_phone: sellerContact?.phone || '',
                buyer_name: buyerName,
                buyer_email: buyerContact?.email || '',
                buyer_phone: buyerContact?.phone || ''
            }

            fetch('https://workflow.remax-exclusive.cl/webhook/transaction-completion', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            }).catch(err => console.error('Transaction completion webhook error:', err))

            // 2. Create transaction follow-up records (1mo, 6mo, 1yr)
            const today = new Date()
            const milestones = [
                { milestone: '1month', days: 30 },
                { milestone: '6months', days: 180 },
                { milestone: '1year', days: 365 }
            ]

            const followups = milestones.map(m => {
                const dueDate = new Date(today)
                dueDate.setDate(dueDate.getDate() + m.days)
                return {
                    property_id: property.id,
                    agent_id: user.id,
                    transaction_type: transactionType,
                    milestone: m.milestone,
                    due_date: dueDate.toISOString().split('T')[0],
                    status: 'pending',
                    buyer_contact_id: buyerContact.id,
                    seller_contact_id: sellerContact?.id || null,
                    property_address: property?.address || ''
                }
            })

            await supabase.from('transaction_followups').insert(followups)

            toast.success('¡Notificaciones enviadas y seguimientos creados!')
            onClose()
        } catch (error) {
            console.error('Error:', error)
            toast.error('Error al enviar notificaciones')
        } finally {
            setSending(false)
        }
    }

    if (!isOpen) return null

    return createPortal(
        <AnimatePresence>
            {isOpen && (
                <div
                    className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
                    onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
                >
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 20 }}
                        className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-lg shadow-2xl border border-gray-200 dark:border-gray-800 overflow-hidden"
                    >
                        {/* Header */}
                        <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 p-6 text-white">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-white/20 rounded-xl">
                                        <Star className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <h2 className="text-xl font-bold">
                                            🎉 ¡Propiedad {isArriendo ? 'Arrendada' : 'Vendida'}!
                                        </h2>
                                        <p className="text-emerald-100 text-sm mt-1">
                                            Enviar agradecimiento a las partes
                                        </p>
                                    </div>
                                </div>
                                <Button variant="ghost" size="icon" onClick={onClose} className="text-white hover:bg-white/20">
                                    <X className="w-5 h-5" />
                                </Button>
                            </div>
                        </div>

                        {/* Content */}
                        <div className="p-6 space-y-5">
                            {/* Property Info */}
                            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 border">
                                <p className="text-sm font-medium text-slate-500">Propiedad</p>
                                <p className="font-bold text-slate-900 dark:text-white">{property?.address}</p>
                            </div>

                            {/* Seller/Owner */}
                            <div>
                                <Label className="text-sm font-semibold mb-2 block">
                                    {isArriendo ? 'Arrendador (Propietario)' : 'Vendedor (Propietario)'}
                                </Label>
                                {sellerContact ? (
                                    <div className="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                                        <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm font-bold">
                                            {(sellerContact.first_name || '?')[0]}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-medium text-sm">{sellerContact.first_name} {sellerContact.last_name}</p>
                                            <p className="text-xs text-slate-500">{sellerContact.email}</p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={handleClearSeller}
                                            className="p-1.5 rounded-full hover:bg-red-100 dark:hover:bg-red-900/30 text-red-400 hover:text-red-600 transition-colors"
                                            title="Cambiar vendedor"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        <p className="text-sm text-amber-600 bg-amber-50 p-3 rounded-lg border border-amber-200">
                                            ⚠️ No se encontró un propietario vinculado. Selecciona uno a continuación:
                                        </p>
                                        <ContactPickerInline
                                            label={isArriendo ? 'Seleccionar arrendador' : 'Seleccionar vendedor'}
                                            disabled={savingSellerLink}
                                            onSelectContact={async (contact) => {
                                                if (!contact) return
                                                setSavingSellerLink(true)
                                                try {
                                                    await supabase.from('property_contacts').insert({
                                                        property_id: property.id,
                                                        contact_id: contact.id,
                                                        role: 'propietario',
                                                        agent_id: user?.id
                                                    })
                                                    await supabase.from('properties')
                                                        .update({ owner_id: contact.id })
                                                        .eq('id', property.id)
                                                    await logActivity({
                                                        action: 'Vinculó',
                                                        entity_type: 'Contacto',
                                                        entity_id: contact.id,
                                                        description: `Vinculado como propietario de la propiedad (desde modal de cierre)`,
                                                        contact_id: contact.id,
                                                        property_id: property.id
                                                    })
                                                    const { data: fullContact } = await supabase
                                                        .from('contacts')
                                                        .select('id, first_name, last_name, email, phone')
                                                        .eq('id', contact.id)
                                                        .single()
                                                    setSellerContact(fullContact || contact)
                                                    setSellerLinkedFromModal(true)
                                                    toast.success('Vendedor vinculado correctamente')
                                                } catch (err) {
                                                    console.error('Error linking seller:', err)
                                                    toast.error('Error al vincular vendedor')
                                                } finally {
                                                    setSavingSellerLink(false)
                                                }
                                            }}
                                        />
                                        {savingSellerLink && (
                                            <div className="flex items-center gap-2 text-sm text-slate-500">
                                                <Loader2 className="w-3 h-3 animate-spin" />
                                                Vinculando vendedor...
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Buyer/Tenant Picker */}
                            <div>
                                <Label className="text-sm font-semibold mb-2 block">
                                    {isArriendo ? 'Arrendatario *' : 'Comprador *'}
                                </Label>
                                {buyerContact ? (
                                    <div className="flex items-center gap-3 p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg border border-emerald-200">
                                        <div className="w-8 h-8 bg-emerald-500 rounded-full flex items-center justify-center text-white text-sm font-bold">
                                            {(buyerContact.first_name || '?')[0]}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-medium text-sm">{buyerContact.first_name} {buyerContact.last_name}</p>
                                            <p className="text-xs text-slate-500">{buyerContact.email} · {buyerContact.phone}</p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={handleClearBuyer}
                                            className="p-1.5 rounded-full hover:bg-red-100 dark:hover:bg-red-900/30 text-red-400 hover:text-red-600 transition-colors"
                                            title="Cambiar comprador"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        <ContactPickerInline
                                            label={isArriendo ? 'Seleccionar arrendatario' : 'Seleccionar comprador'}
                                            disabled={savingBuyerLink}
                                            onSelectContact={async (contact) => {
                                                if (!contact) return
                                                setSavingBuyerLink(true)
                                                try {
                                                    await supabase.from('property_contacts').insert({
                                                        property_id: property.id,
                                                        contact_id: contact.id,
                                                        role: 'comprador',
                                                        agent_id: user?.id
                                                    })
                                                    await logActivity({
                                                        action: 'Vinculó',
                                                        entity_type: 'Contacto',
                                                        entity_id: contact.id,
                                                        description: `Vinculado como ${isArriendo ? 'arrendatario' : 'comprador'} de la propiedad (desde modal de cierre)`,
                                                        contact_id: contact.id,
                                                        property_id: property.id
                                                    })
                                                    const { data: fullContact } = await supabase
                                                        .from('contacts')
                                                        .select('id, first_name, last_name, email, phone')
                                                        .eq('id', contact.id)
                                                        .single()
                                                    setBuyerContact(fullContact || contact)
                                                    setBuyerContactId(contact.id)
                                                    setBuyerLinkedFromModal(true)
                                                    toast.success(`${isArriendo ? 'Arrendatario' : 'Comprador'} vinculado correctamente`)
                                                } catch (err) {
                                                    console.error('Error linking buyer:', err)
                                                    toast.error('Error al vincular comprador')
                                                } finally {
                                                    setSavingBuyerLink(false)
                                                }
                                            }}
                                        />
                                        {savingBuyerLink && (
                                            <div className="flex items-center gap-2 text-sm text-slate-500">
                                                <Loader2 className="w-3 h-3 animate-spin" />
                                                Vinculando comprador...
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* What will happen */}
                            <div className="bg-gradient-to-r from-slate-50 to-blue-50/50 dark:from-slate-800/50 dark:to-slate-800/30 rounded-xl p-4 border space-y-2">
                                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Se enviará automáticamente:</p>
                                <div className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                                    <Mail className="w-4 h-4 text-blue-500" />
                                    <span>Email de agradecimiento a ambas partes</span>
                                </div>
                                <div className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                                    <MessageSquare className="w-4 h-4 text-green-500" />
                                    <span>WhatsApp de felicitaciones a ambas partes</span>
                                </div>
                                <div className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                                    <Star className="w-4 h-4 text-amber-500" />
                                    <span>Link de reseñas Google incluido</span>
                                </div>
                                <div className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                                    <span className="text-lg">📅</span>
                                    <span>Recordatorios de fidelización: 1 mes, 6 meses, 1 año</span>
                                </div>
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="p-4 border-t bg-slate-50 dark:bg-slate-800/50 flex justify-end gap-3">
                            <Button variant="outline" onClick={onClose}>
                                Omitir
                            </Button>
                            <Button
                                onClick={handleSend}
                                disabled={sending || !buyerContact}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 px-6"
                            >
                                {sending ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        Enviando...
                                    </>
                                ) : (
                                    <>
                                        <Send className="w-4 h-4" />
                                        Enviar y Crear Seguimientos
                                    </>
                                )}
                            </Button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>,
        document.body
    )
}

export default TransactionCompletionModal
