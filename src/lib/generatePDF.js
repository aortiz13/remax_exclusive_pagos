import { jsPDF } from 'jspdf';

export const generatePDF = async (formData) => {
    const doc = new jsPDF();
    const type = formData.get('tipo_solicitud');

    // Helper to add text and advanced cursor
    let y = 20;
    const lineHeight = 7;
    const margin = 20;
    const pageWidth = doc.internal.pageSize.width;

    // --- STYLES ---
    const addHeader = (text) => {
        doc.setFillColor(0, 61, 165); // Remax Blue
        doc.rect(margin, y, pageWidth - (margin * 2), 10, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text(text, pageWidth / 2, y + 7, { align: 'center' });
        y += 15;
        doc.setTextColor(0, 0, 0);
    };

    const addSection = (text) => {
        y += 5;
        doc.setFillColor(220, 28, 46); // Remax Red
        doc.rect(margin, y, pageWidth - (margin * 2), 8, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text(text, margin + 5, y + 5);
        y += 12;
        doc.setTextColor(0, 0, 0);
    };

    const addField = (label, value, newLine = true) => {
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.text(`${label}:`, margin, y);

        doc.setFont('helvetica', 'normal');
        // Handle long text wrapping
        const splitText = doc.splitTextToSize(String(value || '-'), pageWidth - margin - 60);
        doc.text(splitText, margin + 50, y);

        if (newLine) {
            y += (splitText.length * 5) + 2;
        }
        return (splitText.length * 5) + 2; // return used height
    };

    const checkPageBreak = () => {
        if (y > 270) {
            doc.addPage();
            y = 20;
        }
    };

    // --- TITLE ---
    addHeader(type === 'arriendo'
        ? 'SOLICITUD DE CONTRATO DE ARRIENDO'
        : 'SOLICITUD DE PROMESA DE COMPRAVENTA'
    );

    // --- AGENT INFO ---
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    const agentInfo = `AGENTE: ${formData.get('agente_nombre')} | EMAIL: ${formData.get('agente_email')} | TEL: ${formData.get('agente_telefono')}`;
    doc.text(agentInfo, pageWidth / 2, y, { align: 'center' });
    y += 10;

    // --- CONTENT BASED ON TYPE ---
    if (type === 'arriendo') {
        addSection('1. DATOS DEL CONTRATO');
        addField('Plazo Contrato', formData.get('plazo_contrato'));
        addField('Fecha Inicio', formData.get('fecha_inicio'));
        addField('Canon Arriendo', formData.get('canon_arriendo'));
        addField('Documenta Cheque', formData.get('documenta_cheque'));
        addField('Cta. Transferencia', formData.get('cuenta_transferencia'));
        addField('Con Administración', formData.get('con_administracion'));
        addField('Con Restitución', formData.get('con_restitucion'));

        checkPageBreak();
        addSection('2. PROPIEDAD');
        addField('Rol Propiedad', formData.get('rol_propiedad'));
        addField('Dirección', formData.get('direccion_propiedad'));
        addField('N° Cliente Agua', formData.get('cliente_agua'));
        addField('N° Cliente Luz', formData.get('cliente_luz'));

        checkPageBreak();
        addSection('3. ARRENDADOR');
        addField('Vombres', formData.get('arrendador_nombres'));
        addField('Apellidos', formData.get('arrendador_apellidos'));
        addField('RUT', formData.get('arrendador_rut'));
        addField('Email', formData.get('arrendador_email'));
        addField('Teléfono', formData.get('arrendador_telefono'));
        addField('Dirección', formData.get('arrendador_direccion'));
        addField('Comuna', formData.get('arrendador_comuna'));

        checkPageBreak();
        addSection('4. ARRENDATARIO');
        const tipoArr = formData.get('tipo_arrendatario');
        addField('Tipo', tipoArr === 'natural' ? 'Persona Natural' : 'Persona Jurídica');

        if (tipoArr === 'natural') {
            addField('Nombres', formData.get('arrendatario_nombres'));
            addField('Apellidos', formData.get('arrendatario_apellidos'));
            addField('RUT', formData.get('arrendatario_rut'));
            addField('Email', formData.get('arrendatario_email'));
            addField('Teléfono', formData.get('arrendatario_telefono'));
            addField('Ocupación', formData.get('arrendatario_ocupacion'));
            addField('Renta Líquida', formData.get('arrendatario_renta')); // If exists
        } else {
            addField('Razón Social', formData.get('arrendatario_juridica_razon'));
            addField('RUT Empresa', formData.get('arrendatario_juridica_rut'));
            addField('Rep. Legal', `${formData.get('arrendatario_juridica_rep_nombres')} ${formData.get('arrendatario_juridica_rep_apellidos')}`);
        }

        const hasFiador = formData.get('tiene_fiador') === 'si';
        if (hasFiador) {
            checkPageBreak();
            addSection('5. FIADOR');
            addField('Nombres', formData.get('fiador_nombres'));
            addField('Apellidos', formData.get('fiador_apellidos'));
            addField('RUT', formData.get('fiador_rut'));
            addField('Email', formData.get('fiador_email'));
            addField('Teléfono', formData.get('fiador_telefono'));
        }

    } else {
        // --- PURCHASE / SELL ---
        addSection('1. INFORMACIÓN OPERACIÓN');
        addField('Fecha Cierre', formData.get('fecha_cierre'));
        addField('Código RE/MAX', formData.get('codigo_remax'));
        addField('Fecha Promesa', formData.get('fecha_promesa'));
        addField('Fecha Escritura', formData.get('fecha_escritura'));
        addField('Fecha Entrega', formData.get('fecha_entrega'));

        checkPageBreak();
        addSection('2. PROPIEDAD');
        addField('Rol', formData.get('rol_propiedad'));
        addField('Comuna', formData.get('comuna'));
        addField('Valor Venta (Pesos)', formData.get('valor_venta_pesos'));
        addField('Valor Venta (UF)', formData.get('valor_venta_uf'));

        checkPageBreak();
        addSection('3. VENDEDORES');
        addField('Vendedor 1', `${formData.get('vendedor_1_nombres')} ${formData.get('vendedor_1_apellidos')} - ${formData.get('vendedor_1_rut')}`);
        if (formData.get('vendedor_2_nombres')) {
            addField('Vendedor 2', `${formData.get('vendedor_2_nombres')} ${formData.get('vendedor_2_apellidos')} - ${formData.get('vendedor_2_rut')}`);
        }
        addField('Banco Vendedor', `${formData.get('vendedor_banco')} / ${formData.get('vendedor_ejecutivo')}`);

        checkPageBreak();
        addSection('4. COMPRADORES');
        addField('Comprador 1', `${formData.get('comprador_1_nombres')} ${formData.get('comprador_1_apellidos')} - ${formData.get('comprador_1_rut')}`);
        if (formData.get('comprador_2_nombres')) {
            addField('Comprador 2', `${formData.get('comprador_2_nombres')} ${formData.get('comprador_2_apellidos')} - ${formData.get('comprador_2_rut')}`);
        }
        addField('Banco Comprador', `${formData.get('comprador_banco')} / ${formData.get('comprador_ejecutivo')}`);

        checkPageBreak();
        addSection('5. ACUERDOS');
        addField('Monto Pie', formData.get('monto_pie'));
        addField('Monto Financiar', formData.get('monto_financiar'));
    }

    checkPageBreak();
    addSection('NOTAS / OBSERVACIONES');
    addField('', formData.get('notas'));

    // Return Blob
    return doc.output('blob');
};
