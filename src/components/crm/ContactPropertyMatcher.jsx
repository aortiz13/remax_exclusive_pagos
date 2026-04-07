import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Button, Badge } from '@/components/ui'
import {
  X, Shuffle, Home, User, MapPin, DollarSign, Bed, Bath, Maximize,
  MessageCircle, Mail, ListTodo, Loader2, ChevronDown, ChevronUp, ExternalLink
} from 'lucide-react'
import { supabase } from '../../services/supabase'
import { toast } from 'sonner'

/**
 * Matching logic maps:
 *  Contact need → Property operation_type
 */
const NEED_TO_OPERATION = {
  'comprar': 'Venta',
  'arrendar': 'Arriendo',
  'vender': 'Venta',       // reverse: if contact wants to sell, show sale properties (they own)
}

/**
 * ContactPropertyMatcher — Slide-over drawer for matching contacts ↔ properties.
 *
 * @param {boolean}  isOpen
 * @param {Function} onClose
 * @param {string}   mode       - 'contacts' (selected contacts, find properties) | 'properties' (selected properties, find contacts)
 * @param {Array}    selected   - array of selected contacts or properties
 */
export default function ContactPropertyMatcher({ isOpen, onClose, mode = 'contacts', selected = [] }) {
  const [loading, setLoading] = useState(false)
  const [matches, setMatches] = useState([]) // { source, results: [] }
  const [expandedId, setExpandedId] = useState(null)

  useEffect(() => {
    if (isOpen && selected.length > 0) {
      runMatching()
    }
  }, [isOpen, selected])

  const runMatching = async () => {
    setLoading(true)
    try {
      if (mode === 'contacts') {
        await matchContactsToProperties()
      } else {
        await matchPropertiesToContacts()
      }
    } catch (err) {
      console.error('Matching error:', err)
      toast.error('Error al buscar coincidencias')
    }
    setLoading(false)
  }

  /** Find properties matching each selected contact's needs */
  const matchContactsToProperties = async () => {
    // Fetch all available properties
    const { data: properties } = await supabase
      .from('properties')
      .select('*')
      .in('status', ['Disponible', 'disponible', 'Activo', 'activo', 'Publicada', 'publicada'])

    if (!properties?.length) {
      setMatches(selected.map(c => ({ source: c, results: [] })))
      return
    }

    const allMatches = selected.map(contact => {
      const needs = (contact.need || '').toLowerCase().split(',').map(n => n.trim()).filter(Boolean)
      const comuna = (contact.barrio_comuna || '').toLowerCase().trim()

      let matched = properties.filter(prop => {
        let score = 0

        // Match need → operation_type
        const opType = (prop.operation_type || '').toLowerCase()
        for (const need of needs) {
          const expectedOp = NEED_TO_OPERATION[need]
          if (expectedOp && opType.toLowerCase().includes(expectedOp.toLowerCase())) {
            score += 3
          }
        }

        // Match comuna
        if (comuna && prop.commune) {
          if (prop.commune.toLowerCase().includes(comuna) || comuna.includes(prop.commune.toLowerCase())) {
            score += 2
          }
        }

        return score > 0 ? { ...prop, _score: score } : null
      }).filter(Boolean)

      // Sort by score descending
      matched.sort((a, b) => b._score - a._score)

      return { source: contact, results: matched.slice(0, 10) } // top 10
    })

    setMatches(allMatches)
  }

  /** Find contacts matching each selected property's attributes */
  const matchPropertiesToContacts = async () => {
    const { data: contacts } = await supabase
      .from('contacts')
      .select('*')
      .in('status', ['Activo', 'activo'])

    if (!contacts?.length) {
      setMatches(selected.map(p => ({ source: p, results: [] })))
      return
    }

    const allMatches = selected.map(prop => {
      const opType = (prop.operation_type || '').toLowerCase()
      const commune = (prop.commune || '').toLowerCase()

      let matched = contacts.filter(contact => {
        let score = 0
        const needs = (contact.need || '').toLowerCase().split(',').map(n => n.trim())
        const contactComuna = (contact.barrio_comuna || '').toLowerCase()

        // Match operation type to need 
        for (const need of needs) {
          for (const [needKey, expectedOp] of Object.entries(NEED_TO_OPERATION)) {
            if (need.includes(needKey) && opType.includes(expectedOp.toLowerCase())) {
              score += 3
            }
          }
        }

        // Match commune
        if (commune && contactComuna) {
          if (commune.includes(contactComuna) || contactComuna.includes(commune)) {
            score += 2
          }
        }

        return score > 0 ? { ...contact, _score: score } : null
      }).filter(Boolean)

      matched.sort((a, b) => b._score - a._score)
      return { source: prop, results: matched.slice(0, 10) }
    })

    setMatches(allMatches)
  }

  const totalMatches = matches.reduce((acc, m) => acc + m.results.length, 0)

  if (!isOpen) return null

  return createPortal(
    <AnimatePresence>
      <div className="fixed inset-0 z-[200]">
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
        <motion.div
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className="absolute right-0 top-0 bottom-0 w-full sm:w-[520px] bg-white dark:bg-slate-900 shadow-2xl flex flex-col"
        >
          {/* Header */}
          <div className="px-6 py-4 border-b bg-gradient-to-r from-pink-50 to-rose-50 dark:from-pink-950/30 dark:to-rose-950/30 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center">
                <Shuffle className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-800 dark:text-white">
                  {mode === 'contacts' ? 'Matching: Propiedades' : 'Matching: Contactos'}
                </h2>
                <p className="text-xs text-slate-500">
                  {selected.length} {mode === 'contacts' ? 'contacto' : 'propiedad'}{selected.length > 1 ? 's' : ''}
                  {!loading && ` → ${totalMatches} coincidencia${totalMatches !== 1 ? 's' : ''}`}
                </p>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-5 h-5" />
            </Button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex flex-col items-center justify-center h-full gap-3">
                <Loader2 className="w-8 h-8 animate-spin text-pink-500" />
                <p className="text-sm text-slate-500">Buscando coincidencias...</p>
              </div>
            ) : matches.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-3 p-8">
                <Shuffle className="w-12 h-12 text-slate-300" />
                <p className="text-sm text-slate-500 text-center">No se encontraron coincidencias</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {matches.map((group, gi) => (
                  <div key={gi} className="bg-white dark:bg-slate-900">
                    {/* Source entity header */}
                    <button
                      onClick={() => setExpandedId(expandedId === gi ? null : gi)}
                      className="w-full px-5 py-3 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                    >
                      <div className="flex items-center gap-3 text-left">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                          mode === 'contacts'
                            ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30'
                            : 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30'
                        }`}>
                          {mode === 'contacts'
                            ? <User className="w-4 h-4" />
                            : <Home className="w-4 h-4" />
                          }
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-800 dark:text-white">
                            {mode === 'contacts'
                              ? `${group.source.first_name} ${group.source.last_name}`
                              : (group.source.address || 'Sin dirección')
                            }
                          </p>
                          <p className="text-[11px] text-slate-500">
                            {mode === 'contacts'
                              ? `${group.source.need || 'Sin necesidad'} • ${group.source.barrio_comuna || 'Sin comuna'}`
                              : `${group.source.operation_type || ''} • ${group.source.commune || ''}`
                            }
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-[10px]">
                          {group.results.length} match{group.results.length !== 1 ? 'es' : ''}
                        </Badge>
                        {expandedId === gi ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                      </div>
                    </button>

                    {/* Matched results */}
                    {expandedId === gi && (
                      <div className="px-5 pb-4 space-y-2">
                        {group.results.length === 0 ? (
                          <p className="text-xs text-slate-400 italic py-2 pl-11">Sin coincidencias</p>
                        ) : (
                          group.results.map((item, ii) => (
                            <MatchCard
                              key={ii}
                              item={item}
                              mode={mode}
                              source={group.source}
                            />
                          ))
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-3 border-t bg-slate-50/50 dark:bg-slate-800/30 text-center">
            <p className="text-[11px] text-slate-400">
              Matching basado en necesidad, tipo de operación y comuna
            </p>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>,
    document.body
  )
}


/** Individual match result card */
function MatchCard({ item, mode, source }) {
  if (mode === 'contacts') {
    // item is a property
    return (
      <div className="ml-11 p-3 rounded-lg border border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30 hover:border-blue-200 dark:hover:border-blue-800 transition-colors">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-800 dark:text-white truncate">
              {item.address || 'Sin dirección'} {item.unit_number ? `- ${item.unit_number}` : ''}
            </p>
            <div className="flex items-center gap-3 mt-1 text-[11px] text-slate-500 flex-wrap">
              <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{item.commune || '-'}</span>
              <span className="flex items-center gap-1"><Home className="w-3 h-3" />{item.property_type || '-'}</span>
              {item.price && <span className="flex items-center gap-1"><DollarSign className="w-3 h-3" />{item.currency} {item.price?.toLocaleString()}</span>}
              {item.bedrooms && <span className="flex items-center gap-1"><Bed className="w-3 h-3" />{item.bedrooms}</span>}
              {item.bathrooms && <span className="flex items-center gap-1"><Bath className="w-3 h-3" />{item.bathrooms}</span>}
              {item.m2_total && <span className="flex items-center gap-1"><Maximize className="w-3 h-3" />{item.m2_total} m²</span>}
            </div>
          </div>
          <div className="flex items-center gap-1">
            {item.listing_link && (
              <a href={item.listing_link} target="_blank" rel="noopener noreferrer"
                className="p-1.5 rounded-md hover:bg-blue-100 text-blue-500 transition-colors"
                title="Ver publicación"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
            {source.phone && (
              <a
                href={`https://wa.me/${source.phone?.replace(/[^0-9]/g, '')}?text=Hola ${source.first_name}, encontré una propiedad que podría interesarte en ${item.commune || ''}`}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1.5 rounded-md hover:bg-green-100 text-green-600 transition-colors"
                title="Enviar por WhatsApp"
              >
                <MessageCircle className="w-3.5 h-3.5" />
              </a>
            )}
          </div>
        </div>
        <div className="mt-2 flex items-center gap-1">
          <Badge className="text-[9px] bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300 px-1.5 py-0">
            Score: {item._score}
          </Badge>
          {item.operation_type && (
            <Badge variant="outline" className="text-[9px] px-1.5 py-0">{item.operation_type}</Badge>
          )}
        </div>
      </div>
    )
  }

  // mode === 'properties' — item is a contact
  return (
    <div className="ml-11 p-3 rounded-lg border border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30 hover:border-emerald-200 dark:hover:border-emerald-800 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-800 dark:text-white">
            {item.first_name} {item.last_name}
          </p>
          <div className="flex items-center gap-3 mt-1 text-[11px] text-slate-500 flex-wrap">
            {item.need && <span className="flex items-center gap-1">Busca: {item.need}</span>}
            {item.barrio_comuna && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{item.barrio_comuna}</span>}
            {item.email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{item.email}</span>}
          </div>
        </div>
        <div className="flex items-center gap-1">
          {item.phone && (
            <a
              href={`https://wa.me/${item.phone?.replace(/[^0-9]/g, '')}?text=Hola ${item.first_name}, tengo una propiedad que podría interesarte en ${source.commune || ''}`}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 rounded-md hover:bg-green-100 text-green-600 transition-colors"
              title="WhatsApp"
            >
              <MessageCircle className="w-3.5 h-3.5" />
            </a>
          )}
        </div>
      </div>
      <div className="mt-2">
        <Badge className="text-[9px] bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300 px-1.5 py-0">
          Score: {item._score}
        </Badge>
      </div>
    </div>
  )
}
