/**
 * Filter configurations for each CRM entity.
 * Each field defines: key, label, type, and options (for select/multiselect).
 * Types: text | select | multiselect | number | date | boolean
 */

export const CONTACT_FILTER_CONFIG = [
  { key: 'status', label: 'Estado', type: 'select', options: ['Activo', 'Inactivo', 'Archivado', 'Nuevo', 'En Seguimiento', 'Cierre', 'Cliente', 'Seguimiento'] },
  { key: 'rating', label: 'Clasificación', type: 'select', options: ['A+', 'A', 'B', 'C', 'O', 'D'] },
  { key: 'source', label: 'Fuente', type: 'select', options: ['Referido', 'Portal', 'Redes Sociales', 'Web', 'Llamado', 'Guardia', 'Turno', 'Facebook', 'Instagram', 'LinkedIn', 'WhatsApp Bot', 'GoPlaceIt', 'Toc Toc', 'Yapo', 'Proppit', 'Mercado Libre', 'Lead Derivado', 'Otro'] },
  { key: 'need', label: 'Necesidad', type: 'select', options: ['Comprar', 'Vender', 'Arrendar (propietario)', 'Arrendar (Arrendatario)', 'Invertir', 'Proveedor de servicio', 'Colega de la red', 'Otra'] },
  { key: 'sex', label: 'Sexo', type: 'select', options: ['Hombre', 'Mujer', 'Otro'] },
  { key: 'profession', label: 'Profesión', type: 'text' },
  { key: 'barrio_comuna', label: 'Comuna', type: 'text' },
  { key: 'address', label: 'Dirección', type: 'text' },
  { key: 'phone', label: 'Teléfono', type: 'text' },
  { key: 'email', label: 'Correo', type: 'text' },
  { key: 'created_at', label: 'Fecha Creación', type: 'date' },
  { key: 'last_contact_date', label: 'Último Contacto', type: 'date' },
  { key: 'next_contact_date', label: 'Próximo Contacto', type: 'date' },
  { key: 'dob', label: 'Fecha Nacimiento', type: 'date' },
]

export const PROPERTY_FILTER_CONFIG = [
  { key: 'property_type', label: 'Tipo', type: 'select', options: ['Departamento', 'Casa', 'Oficina', 'Terreno', 'Bodega', 'Estacionamiento', 'Comercial', 'Parcela', 'Otro'] },
  { key: 'status', label: 'Estado', type: 'multiselect', options: ['Publicada', 'En Venta', 'En Arriendo', 'Arrendada', 'Vendida', 'Pausada', 'Retirada', 'Por Captar', 'En Negociación', 'Administrada', 'Pendiente', 'Visitas'] },
  { key: 'operation_type', label: 'Operación', type: 'select', options: ['venta', 'arriendo', 'Venta', 'Arriendo'] },
  { key: 'commune', label: 'Comuna', type: 'text' },
  { key: 'address', label: 'Dirección', type: 'text' },
  { key: 'unit_number', label: 'Nº Unidad/Depto', type: 'text' },
  { key: 'price', label: 'Precio', type: 'number' },
  { key: 'currency', label: 'Moneda', type: 'select', options: ['CLP', 'UF', 'CLF', 'USD'] },
  { key: 'bedrooms', label: 'Dormitorios', type: 'number' },
  { key: 'bathrooms', label: 'Baños', type: 'number' },
  { key: 'parking_spaces', label: 'Estacionamientos', type: 'number' },
  { key: 'm2_total', label: 'M² Total', type: 'number' },
  { key: 'm2_built', label: 'M² Construidos', type: 'number' },
  { key: 'floor_number', label: 'Piso', type: 'text' },
  { key: 'year_built', label: 'Año Construcción', type: 'text' },
  { key: 'maintenance_fee', label: 'Gasto Común', type: 'number' },
  { key: 'is_exclusive', label: 'Exclusiva', type: 'boolean' },
  { key: 'is_office_property', label: 'Propiedad Oficina', type: 'boolean' },
  { key: 'source', label: 'Origen', type: 'select', options: ['remax', 'Web - Formulario Vender'] },
  { key: 'remax_listing_id', label: 'ID Listing RE/MAX', type: 'text' },
  { key: 'listing_reference', label: 'Ref. Listing', type: 'text' },
  { key: 'rol_number', label: 'Nº Rol', type: 'text' },
  { key: 'sold_price', label: 'Precio Venta Final', type: 'number' },
  { key: 'created_at', label: 'Fecha Creación', type: 'date' },
  { key: 'published_at', label: 'Fecha Publicación', type: 'date' },
  { key: 'sold_at', label: 'Fecha Venta', type: 'date' },
  { key: 'expires_at', label: 'Fecha Expiración', type: 'date' },
  { key: 'contract_start_date', label: 'Inicio Contrato', type: 'date' },
  { key: 'contract_end_date', label: 'Fin Contrato', type: 'date' },
  { key: 'last_inspection_date', label: 'Última Inspección', type: 'date' },
]

export const LEAD_FILTER_CONFIG = [
  { key: 'is_guard', label: 'Tipo Lead', type: 'boolean', trueLabel: 'Guardia', falseLabel: 'Derivado' },
  { key: 'assigned_at', label: 'Fecha Asignación', type: 'date' },
  { key: 'report_2d_sent', label: 'Reporte 24h Enviado', type: 'boolean' },
  { key: 'report_15d_sent', label: 'Reporte 15d Enviado', type: 'boolean' },
  { key: 'report_30d_sent', label: 'Reporte 30d Enviado', type: 'boolean' },
  { key: 'contact.source', label: 'Fuente Contacto', type: 'select', options: ['Guardia', 'Lead Derivado', 'Portal', 'Web', 'Referido', 'Redes Sociales', 'Facebook', 'Instagram', 'WhatsApp Bot', 'Otro'] },
  { key: 'contact.status', label: 'Estado Contacto', type: 'select', options: ['Activo', 'Inactivo', 'Nuevo', 'En Seguimiento', 'Cierre', 'Cliente'] },
  { key: 'contact.need', label: 'Necesidad Contacto', type: 'select', options: ['Comprar', 'Vender', 'Arrendar', 'Invertir', 'Otra'] },
]

/**
 * Operators available per field type
 */
export const OPERATORS_BY_TYPE = {
  text: [
    { value: 'contains', label: 'contiene' },
    { value: 'not_contains', label: 'no contiene' },
    { value: 'equals', label: 'es igual a' },
    { value: 'not_equals', label: 'no es igual a' },
    { value: 'starts_with', label: 'comienza con' },
    { value: 'is_empty', label: 'está vacío' },
    { value: 'is_not_empty', label: 'no está vacío' },
  ],
  select: [
    { value: 'equals', label: 'es' },
    { value: 'not_equals', label: 'no es' },
    { value: 'is_any_of', label: 'es cualquiera de' },
    { value: 'is_empty', label: 'está vacío' },
    { value: 'is_not_empty', label: 'no está vacío' },
  ],
  multiselect: [
    { value: 'contains', label: 'contiene' },
    { value: 'not_contains', label: 'no contiene' },
    { value: 'is_any_of', label: 'contiene cualquiera de' },
    { value: 'is_empty', label: 'está vacío' },
    { value: 'is_not_empty', label: 'no está vacío' },
  ],
  number: [
    { value: 'equals', label: 'es igual a' },
    { value: 'not_equals', label: 'no es igual a' },
    { value: 'greater_than', label: 'mayor que' },
    { value: 'less_than', label: 'menor que' },
    { value: 'between', label: 'entre' },
    { value: 'is_empty', label: 'está vacío' },
    { value: 'is_not_empty', label: 'no está vacío' },
  ],
  date: [
    { value: 'equals', label: 'es' },
    { value: 'before', label: 'antes de' },
    { value: 'after', label: 'después de' },
    { value: 'between', label: 'entre' },
    { value: 'last_n_days', label: 'últimos N días' },
    { value: 'is_empty', label: 'está vacío' },
    { value: 'is_not_empty', label: 'no está vacío' },
  ],
  boolean: [
    { value: 'is_true', label: 'es verdadero' },
    { value: 'is_false', label: 'es falso' },
  ],
}

/** Check if a given operator needs a value input */
export function operatorNeedsValue(operator) {
  return !['is_empty', 'is_not_empty', 'is_true', 'is_false'].includes(operator)
}

/** Check if operator needs two values (between) */
export function operatorNeedsTwoValues(operator) {
  return operator === 'between'
}
