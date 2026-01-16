import jsPDF from 'jspdf'
import { LOGO_BASE64 } from './logo'

export const generatePDF = (data, calculations) => {
    const doc = new jsPDF()

    const pageWidth = doc.internal.pageSize.getWidth()

    // --- Header ---
    // Logo
    doc.addImage(LOGO_BASE64, 'PNG', 20, 10, 50, 50)

    // Title (Centered)
    doc.setFontSize(16)
    doc.setTextColor(0, 0, 0)
    doc.setFont(undefined, 'bold')
    doc.text('Solicitud de Creación de Botón de Pago', pageWidth / 2, 65, { align: 'center' })

    // Date (Right aligned)
    doc.setFont(undefined, 'normal')
    doc.setFontSize(10)
    doc.setTextColor(100, 100, 100)
    doc.text(`Fecha Solicitud: ${new Date().toLocaleDateString()}`, pageWidth - 20, 30, { align: 'right' })

    // Agent Info (Larger and Centered)
    doc.setFontSize(12)
    doc.setTextColor(80, 80, 80)
    doc.setFont(undefined, 'normal')
    const agentInfo = `Agente: ${data.agenteNombre || ''} ${data.agenteApellido || ''} | ${data.agenteEmail || ''} | ${data.agenteTelefono || ''}`
    doc.text(agentInfo, pageWidth / 2, 75, { align: 'center' })

    let y = 90 // Push content down due to logo and centered header

    // --- Section 1: Propiedad ---
    doc.setFontSize(12)
    doc.setTextColor(0, 61, 165)
    doc.setFont(undefined, 'bold')
    doc.text('DATOS DE LA PROPIEDAD', 20, y)
    y += 8

    doc.setFontSize(10)
    doc.setTextColor(0, 0, 0)
    doc.setFont(undefined, 'normal')

    doc.text(`Dirección:`, 20, y)
    doc.setFont(undefined, 'bold')
    doc.text(`${data.direccion || ''}, ${data.comuna || ''}`, 50, y)
    doc.setFont(undefined, 'normal')
    y += 6

    doc.text(`Tipo Propiedad:`, 20, y)
    doc.text(`${data.tipoPropiedad || ''}`, 50, y)

    y += 15

    // --- Section 2: Arrendatario ---
    doc.setFontSize(12)
    doc.setTextColor(0, 61, 165)
    doc.setFont(undefined, 'bold')
    doc.text('DATOS DEL ARRENDATARIO', 20, y)
    y += 8

    doc.setFontSize(10)
    doc.setTextColor(0, 0, 0)

    // Row 1: Name & Rut
    doc.setFont(undefined, 'normal')
    doc.text(`Nombre:`, 20, y)
    doc.setFont(undefined, 'bold')
    doc.text(`${data.arrendatarioNombre} ${data.arrendatarioApellido}`, 40, y)

    doc.setFont(undefined, 'normal')
    doc.text(`RUT:`, 120, y)
    doc.setFont(undefined, 'bold')
    doc.text(`${data.arrendatarioRut}`, 130, y)
    y += 6

    // Row 2: Email & Phone
    doc.setFont(undefined, 'normal')
    doc.text(`Email:`, 20, y)
    doc.text(`${data.arrendatarioEmail || '-'}`, 40, y)

    doc.text(`Tel:`, 120, y)
    doc.text(`${data.arrendatarioTelefono || '-'}`, 130, y)
    y += 6

    y += 10

    // --- Section 3: Propietario ---
    doc.setFontSize(12)
    doc.setTextColor(0, 61, 165)
    doc.setFont(undefined, 'bold')
    doc.text('DATOS DEL PROPIETARIO', 20, y)
    y += 8

    doc.setFontSize(10)
    doc.setTextColor(0, 0, 0)

    // Row 1: Name & Rut
    doc.setFont(undefined, 'normal')
    doc.text(`Nombre:`, 20, y)
    doc.setFont(undefined, 'bold')
    doc.text(`${data.dueñoNombre}`, 40, y)

    doc.setFont(undefined, 'normal')
    doc.text(`RUT:`, 120, y)
    doc.setFont(undefined, 'bold')
    doc.text(`${data.dueñoRut}`, 130, y)
    y += 6

    // Row 2: Email
    doc.setFont(undefined, 'normal')
    doc.text(`Email:`, 20, y)
    doc.text(`${data.dueñoEmail || '-'}`, 40, y)
    y += 6

    // Row 3: Banking Info (Full line)
    doc.setFont(undefined, 'normal')
    doc.text(`Banco:`, 20, y)
    doc.setFont(undefined, 'bold')
    doc.text(`${data.bancoNombre} (${data.bancoTipoCuenta})`, 40, y)
    y += 6
    doc.setFont(undefined, 'normal')
    doc.text(`N° Cuenta:`, 20, y)
    doc.setFont(undefined, 'bold')
    doc.text(`${data.bancoNroCuenta}`, 40, y)

    y += 25

    // --- Tables Setup ---
    const startY = y
    const colLeft = 20
    const colRight = 115 // Increased spacing between tables
    const colWidth = 85
    const rowHeight = 8 // Increased row height

    const format = (val) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(val || 0)

    // --- Table 1: Total a Cancelar (Arrendatario) ---
    // Header
    doc.setFillColor(220, 30, 53)
    doc.rect(colLeft, y, colWidth, 9, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(11)
    doc.setFont(undefined, 'bold')
    doc.text('Cálculo de Total a Cancelar', colLeft + 5, y + 6)

    y += 12 // Skip header
    doc.setTextColor(0, 0, 0)
    doc.setFontSize(10)
    doc.setFont(undefined, 'normal')

    // Items
    let currentY = y
    const addRow = (label, value) => {
        if (value === undefined || value === null) return
        doc.text(label, colLeft, currentY)
        doc.text(format(value), colLeft + colWidth, currentY, { align: 'right' })
        currentY += rowHeight
    }

    doc.setFont(undefined, 'bold')
    addRow('Canon Arriendo (Ref)', data.canonArriendo)
    doc.setFont(undefined, 'normal')

    if (data.chkProporcional) {
        addRow(`Días Proporcionales (${data.diasProporcionales})`, calculations.montoProporcional)
    }
    if (data.chkMesAdelantado) {
        addRow('Mes Adelantado', calculations.montoMesAdelantado)
    }

    addRow('Garantía', data.garantia)
    addRow('Gastos Notariales', data.gastosNotariales)

    if (data.chkSeguro) {
        addRow('Seguro de Restitución', calculations.montoSeguro)
    }

    addRow('Honorarios (IVA incl.)', calculations.totalComision)

    // Total Footer
    currentY += 2
    doc.setFillColor(0, 61, 165)
    doc.rect(colLeft, currentY, colWidth, 9, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFont(undefined, 'bold')
    doc.text('TOTAL', colLeft + 4, currentY + 6)
    doc.text(format(calculations.totalCancelar), colLeft + colWidth - 2, currentY + 6, { align: 'right' })

    // --- Table 2: Total a Recibir (Dueño) ---
    y = startY // Reset Y for right column
    currentY = y + 12 // Skip header space

    // Header
    doc.setFillColor(220, 30, 53)
    doc.rect(colRight, y, colWidth, 9, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(11)
    doc.setFont(undefined, 'bold')
    doc.text('Cálculo de Total a Recibir', colRight + 5, y + 6)

    doc.setTextColor(0, 0, 0)
    doc.setFontSize(10)
    doc.setFont(undefined, 'normal')

    const addRowRight = (label, value, isNegative = false) => {
        if (value === undefined || value === null) return
        doc.text(label, colRight, currentY)
        const valStr = isNegative ? `-${format(value)}` : format(value)
        if (isNegative) doc.setTextColor(200, 0, 0)
        doc.text(valStr, colRight + colWidth, currentY, { align: 'right' })
        doc.setTextColor(0, 0, 0)
        currentY += rowHeight
    }

    // Income
    if (data.chkProporcional) {
        addRowRight(`Días Proporcionales (${data.diasProporcionales})`, calculations.montoProporcional)
    }
    if (data.chkMesAdelantado) {
        addRowRight('Mes Adelantado', calculations.montoMesAdelantado)
    }
    addRowRight('Garantía', data.garantia)

    // Deductions
    addRowRight('Gastos Notariales', data.gastosNotariales, true)
    addRowRight('Cert. Dominio Vig.', data.costoDominioVigente, true)
    addRowRight('Honorarios (IVA incl.)', calculations.totalComision, true)
    addRowRight('Hon. Admin (IVA incl.)', data.honorariosAdmin, true)

    // Total Footer
    currentY += 2
    doc.setFillColor(0, 61, 165)
    doc.rect(colRight, currentY, colWidth, 9, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFont(undefined, 'bold')
    doc.text('TOTAL', colRight + 4, currentY + 6)
    doc.text(format(calculations.totalRecibir), colRight + colWidth - 2, currentY + 6, { align: 'right' })

    // Return raw base64 string (cleaner for webhooks/n8n)
    const dataUri = doc.output('datauristring')
    return dataUri.split(',')[1]
}
