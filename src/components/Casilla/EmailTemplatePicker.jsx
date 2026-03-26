import React, { useState, useEffect } from 'react';
import { FileText, X, Search, ChevronRight, ChevronLeft, Mail, Eye, Check } from 'lucide-react';
import { EMAIL_TEMPLATES, TEMPLATE_CATEGORIES } from '../../data/emailTemplatesData';

const CATEGORY_COLORS = {
  'Post-Captación': { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', dot: 'bg-amber-400' },
  'Presentación de Servicios': { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', dot: 'bg-blue-400' },
  'Gestión': { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200', dot: 'bg-purple-400' },
  'Visitas': { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-400' },
};

const EmailTemplatePicker = ({ isOpen, onClose, onSelectTemplate }) => {
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [previewTemplate, setPreviewTemplate] = useState(null);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleEsc = (e) => {
      if (e.key === 'Escape') {
        if (previewTemplate) {
          setPreviewTemplate(null);
        } else {
          onClose();
        }
      }
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose, previewTemplate]);

  // Reset state when closing
  useEffect(() => {
    if (!isOpen) {
      setPreviewTemplate(null);
      setSearch('');
      setFilterCategory('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const filtered = EMAIL_TEMPLATES.filter(t => {
    if (search && !t.name.toLowerCase().includes(search.toLowerCase()) && !t.subject.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterCategory && t.category !== filterCategory) return false;
    return true;
  });

  // ─── Preview View ───
  if (previewTemplate) {
    const colors = CATEGORY_COLORS[previewTemplate.category] || { bg: 'bg-gray-50', text: 'text-gray-600', border: 'border-gray-200', dot: 'bg-gray-400' };
    return (
      <div className="fixed inset-0 z-[9999] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
        <div
          className="bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden flex flex-col w-full max-w-2xl"
          style={{ maxHeight: '80vh' }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Preview Header */}
          <div className="bg-gradient-to-r from-gray-800 to-gray-700 px-5 py-3.5 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2 text-white">
              <button
                onClick={() => setPreviewTemplate(null)}
                className="p-1 hover:bg-white/15 rounded transition-colors"
                title="Volver a la lista"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <Eye className="w-4 h-4" />
              <span className="font-semibold text-sm">Vista previa</span>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Template info */}
          <div className="px-5 py-3 border-b border-gray-100 bg-gray-50/50 shrink-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-bold text-gray-800">{previewTemplate.name}</span>
              <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded ${colors.bg} ${colors.text} ${colors.border} border`}>
                {previewTemplate.category}
              </span>
            </div>
            <div className="text-xs text-gray-500">
              <span className="font-medium text-gray-600">Asunto:</span> {previewTemplate.subject}
            </div>
          </div>

          {/* Body preview */}
          <div className="flex-1 overflow-y-auto px-5 py-4">
            <div
              className="text-sm text-gray-700 leading-relaxed prose prose-sm max-w-none
                [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-0.5
                [&_ol]:list-decimal [&_ol]:pl-5
                [&_li]:text-sm [&_li]:text-gray-700
                [&_strong]:font-bold [&_strong]:text-gray-800
                [&_p]:mb-2"
              dangerouslySetInnerHTML={{ __html: previewTemplate.bodyHtml }}
            />
          </div>

          {/* Footer with action buttons */}
          <div className="px-5 py-3 border-t border-gray-100 bg-white flex items-center justify-between shrink-0">
            <button
              onClick={() => setPreviewTemplate(null)}
              className="px-3 py-1.5 text-xs font-medium text-gray-500 hover:text-gray-700 transition-colors"
            >
              ← Volver
            </button>
            <button
              onClick={() => {
                onSelectTemplate(previewTemplate);
                onClose();
              }}
              className="flex items-center gap-1.5 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition-all shadow-sm hover:shadow"
            >
              <Check className="w-4 h-4" />
              Usar plantilla
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── List View ───
  return (
    <div className="fixed inset-0 z-[9999] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden w-full max-w-lg"
        style={{ maxHeight: '80vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-gray-800 to-gray-700 px-5 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2 text-white">
            <FileText className="w-4 h-4" />
            <span className="font-semibold text-sm">Plantillas de Correo</span>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search */}
        <div className="px-4 pt-4 pb-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar plantilla..."
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-blue-400 outline-none"
              autoFocus
            />
          </div>
        </div>

        {/* Category filters */}
        <div className="px-4 pb-3 flex gap-1.5 flex-wrap">
          <button
            onClick={() => setFilterCategory('')}
            className={`px-2.5 py-1 text-[11px] font-medium rounded-lg border transition-all ${!filterCategory ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}`}
          >
            Todas
          </button>
          {TEMPLATE_CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setFilterCategory(cat === filterCategory ? '' : cat)}
              className={`px-2.5 py-1 text-[11px] font-medium rounded-lg border transition-all ${filterCategory === cat ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Template list */}
        <div className="overflow-y-auto border-t border-gray-100" style={{ maxHeight: '400px' }}>
          {filtered.length === 0 ? (
            <div className="text-center py-10">
              <Mail className="w-10 h-10 text-gray-200 mx-auto mb-2" />
              <p className="text-sm text-gray-400">No se encontraron plantillas</p>
            </div>
          ) : (
            <div className="p-2 space-y-1">
              {filtered.map(template => {
                const colors = CATEGORY_COLORS[template.category] || { bg: 'bg-gray-50', text: 'text-gray-600', border: 'border-gray-200', dot: 'bg-gray-400' };
                return (
                  <button
                    key={template.id}
                    onClick={() => setPreviewTemplate(template)}
                    className="w-full text-left px-3 py-3 rounded-xl hover:bg-blue-50 transition-all group flex items-start gap-3 border border-transparent hover:border-blue-100"
                  >
                    <div className={`w-2.5 h-2.5 rounded-full mt-1.5 shrink-0 ${colors.dot}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-sm font-semibold text-gray-800 group-hover:text-blue-700 truncate">
                          {template.name}
                        </span>
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${colors.bg} ${colors.text} ${colors.border} border shrink-0`}>
                          {template.category}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 truncate">{template.subject}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-blue-500 mt-1 shrink-0 transition-colors" />
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default EmailTemplatePicker;
