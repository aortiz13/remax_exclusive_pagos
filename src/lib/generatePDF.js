import { jsPDF } from 'jspdf';

export const generatePDF = async (formData) => {
    const doc = new jsPDF();
    const type = formData.get('tipo_solicitud');

    // Helper to add text and advanced cursor
    let y = 20;
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
        checkPageBreak(15);
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
        if (!value) return 0; // Skip empty fields
        checkPageBreak(10);

        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.text(`${label}:`, margin, y);

        doc.setFont('helvetica', 'normal');
        // Handle long text wrapping
        const splitText = doc.splitTextToSize(String(value), pageWidth - margin - 60);
        doc.text(splitText, margin + 50, y);

        const height = (splitText.length * 5) + 2;
        if (newLine) {
            y += height;
        }
        return height;
    };

    const checkPageBreak = (neededSpace = 20) => {
        if (y + neededSpace > 280) {
            doc.addPage();
            y = 20;
        }
    };

    const printPartySection = (title, prefixRoot) => {
        // Collect all available indices
        const indices = [];
        for (let i = 1; i <= 4; i++) {
            // Check for presence of key identifying fields
            if (formData.get(`${prefixRoot}_${i}_nombres`) || formData.get(`${prefixRoot}_${i}_juridica_razon`)) {
                indices.push(i);
            }
        }

        if (indices.length === 0) return;

        addSection(title);

        indices.forEach((i, idx) => {
            if (idx > 0) {
                y += 5;
                doc.setDrawColor(200);
                doc.line(margin, y, pageWidth - margin, y);
                y += 5;
            }

            const prefix = `${prefixRoot}_${i}`;
            const tipoPersona = formData.get(`${prefix}_tipo_persona`);

            if (tipoPersona === 'juridica') {
                addField('Razón Social', formData.get(`${prefix}_juridica_razon`));
                addField('RUT Empresa', formData.get(`${prefix}_juridica_rut`));
                addField('Dirección Comercial', formData.get(`${prefix}_juridica_direccion`));
                addField('Teléfono', formData.get(`${prefix}_juridica_telefono`));

                y += 2;
                doc.setFont('helvetica', 'bold');
                doc.text('Representante Legal:', margin, y);
                y += 5;

                addField('Nombre Rep.', `${formData.get(`${prefix}_juridica_rep_nombres`)} ${formData.get(`${prefix}_juridica_rep_apellidos`)}`);
                addField('RUT Rep.', formData.get(`${prefix}_juridica_rep_rut`));
                addField('Email Rep.', formData.get(`${prefix}_juridica_rep_email`));
                addField('Teléfono Rep.', formData.get(`${prefix}_juridica_rep_telefono`));
            } else {
                // Natural
                addField('Nombre', `${formData.get(`${prefix}_nombres`)} ${formData.get(`${prefix}_apellidos`)}`);
                addField('RUT', formData.get(`${prefix}_rut`));
                addField('Nacionalidad', formData.get(`${prefix}_nacionalidad`));
                addField('Estado Civil', formData.get(`${prefix}_civil`));
                addField('Fecha Nacimiento', formData.get(`${prefix}_nacimiento`));
                addField('Email', formData.get(`${prefix}_email`));
                addField('Teléfono', formData.get(`${prefix}_telefono`));
                addField('Dirección', formData.get(`${prefix}_direccion`));

                // Laboral (Specific to Lease usually, but harmless if empty for others)
                addField('Ocupación', formData.get(`${prefix}_ocupacion`));
                addField('Empleador', formData.get(`${prefix}_empleador`));
                addField('RUT Empleador', formData.get(`${prefix}_empleador_rut`));
                addField('Cargo', formData.get(`${prefix}_cargo`));
                addField('Antigüedad', formData.get(`${prefix}_antiguedad`));
                addField('Tel. Laboral', formData.get(`${prefix}_telefono_lab`));
                addField('Dir. Laboral', formData.get(`${prefix}_direccion_lab`));
            }
        });
    }

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
        addField('Moneda', formData.get('moneda_arriendo')?.toUpperCase());
        addField('Canon Arriendo', formData.get('canon_arriendo'));
        addField('Reajuste', formData.get('reajuste')); // Form value like 'semestral'
        addField('Documenta Cheque', formData.get('documenta_cheque'));
        addField('Cta. Transferencia', formData.get('cuenta_transferencia'));
        addField('Con Administración', formData.get('con_administracion'));
        addField('Con Restitución', formData.get('con_restitucion'));

        addSection('2. PROPIEDAD');
        addField('Rol Propiedad', formData.get('rol_propiedad'));
        addField('Dirección', formData.get('direccion_propiedad'));

        // Basic Services & Admin
        addField('N° Cliente Agua', formData.get('cliente_agua'));
        addField('N° Cliente Luz', formData.get('cliente_luz'));
        addField('N° Cliente Gas', formData.get('cliente_gas'));

        if (formData.get('con_administracion') === 'SI') {
            y += 2;
            doc.setFont('helvetica', 'bold');
            doc.text('Contacto Administración:', margin, y);
            y += 5;
            addField('Nombre', formData.get('admin_contacto_nombre'));
            addField('Teléfono', formData.get('admin_contacto_telefono'));
            addField('Email', formData.get('admin_contacto_email'));
        }

        printPartySection('3. ARRENDADOR(ES)', 'arrendador');
        printPartySection('4. ARRENDATARIO(S)', 'arrendatario');

        if (formData.get('tiene_fiador') === 'si') {
            printPartySection('5. FIADOR / AVAL', 'fiador');
        }

    } else {
        // --- PURCHASE / SELL ---
        addSection('1. INFORMACIÓN OPERACIÓN');
        addField('Fecha Cierre', formData.get('fecha_cierre'));
        addField('Código RE/MAX', formData.get('codigo_remax'));
        addField('Fecha Promesa', formData.get('fecha_promesa'));
        addField('Fecha Escritura', formData.get('fecha_escritura'));
        addField('Fecha Entrega', formData.get('fecha_entrega'));

        addSection('2. PROPIEDAD');
        addField('Rol', formData.get('rol_propiedad'));
        addField('Tipo', formData.get('tipo_propiedad'));
        addField('Comuna', formData.get('comuna'));
        addField('Dirección', formData.get('direccion_propiedad'));

        const moneda = formData.get('moneda_venta') === 'uf' ? 'UF' : 'CLP';
        addField(`Valor Venta (${moneda})`, formData.get('valor_venta'));

        printPartySection('3. VENDEDOR(ES)', 'vendedor');
        printPartySection('4. COMPRADOR(ES)', 'comprador');

        addSection('5. ACUERDOS PARA PROMESA');
        addField('Forma de Pago', formData.get('forma_pago') === 'credito' ? 'Crédito Hipotecario' : 'Contado');

        if (formData.get('forma_pago') === 'credito') {
            addField('Monto Pie (UF)', formData.get('monto_pie'));
            addField('Monto Financiar (Banco) (UF)', formData.get('monto_financiar'));
        } else {
            // Contado - Show Reserve
            const monedaReserva = formData.get('moneda_reserva') === 'uf' ? 'UF' : 'CLP';
            addField(`Monto Reserva (${monedaReserva})`, formData.get('monto_reserva'));
        }

        // Bank Data
        y += 5;
        doc.setFont('helvetica', 'bold');
        doc.text('Datos Bancarios Vendedor:', margin, y);
        y += 5;
        addField('Banco', formData.get('vendedor_banco'));
        addField('Ejecutivo', formData.get('vendedor_ejecutivo'));
        addField('Email', formData.get('vendedor_correo_banco'));
        addField('Teléfono', formData.get('vendedor_telefono_banco'));

        y += 5;
        doc.setFont('helvetica', 'bold');
        doc.text('Datos Bancarios Comprador:', margin, y);
        y += 5;
        addField('Banco', formData.get('comprador_banco'));
        addField('N° Cuenta', formData.get('comprador_cuenta'));
        addField('Email', formData.get('comprador_correo_banco'));
    }

    addSection('NOTAS / OBSERVACIONES');
    addField('', formData.get('notas'));

    // --- ATTACHED FILES LIST ---
    addSection('ARCHIVOS ADJUNTOS');
    const fileFields = ['dominio_vigente[]', 'gp_certificado', 'otros_documentos[]']; // normalized names often used
    // Note: formData.get() returns single, .getAll() returns array
    // Check specific known file keys. 
    // In LeaseForm: 'dominio_vigente', 'otros_documentos' (with multiple)
    // In BuySell: 'dominio_vigente', 'gp_certificado'

    const checkFileField = (key, label) => {
        const files = formData.getAll(key);
        if (files && files.length > 0) {
            files.forEach(f => {
                if (f instanceof File && f.name) {
                    addField(label, f.name);
                }
            });
        }
    };

    checkFileField('dominio_vigente', 'Dominio Vigente');
    checkFileField('dominio_vigente[]', 'Dominio Vigente'); // Check array notation if used
    checkFileField('gp_certificado', 'Certificado GP');
    checkFileField('otros_documentos', 'Otro Documento');
    checkFileField('otros_documentos[]', 'Otro Documento');

    // Return Blob
    return doc.output('blob');
};
