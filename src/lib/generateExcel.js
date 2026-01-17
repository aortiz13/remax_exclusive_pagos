import ExcelJS from 'exceljs';

export const generateExcel = async (formData) => {
    const workbook = new ExcelJS.Workbook();

    const type = formData.get('tipo_solicitud');

    if (type === 'arriendo') {
        await generateLeaseSheet(workbook, formData);
    } else {
        await generateBuySellSheet(workbook, formData);
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
};

// --- STYLING CONSTANTS ---
const REMAX_RED = 'DC1C2E';
const REMAX_BLUE = '003DA5';
const REMAX_BLUE_LIGHT = 'E6F0FF';
const REMAX_RED_LIGHT = 'FFE6E6';
const WHITE = 'FFFFFF';
const GRAY_HEADER = 'CCCCCC'; // As seen in screenshot
const BORDER_STYLE = {
    top: { style: 'thin' },
    left: { style: 'thin' },
    bottom: { style: 'thin' },
    right: { style: 'thin' }
};

const headerStyle = {
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: REMAX_BLUE } },
    font: { name: 'Arial', size: 14, bold: true, color: { argb: WHITE } },
    alignment: { vertical: 'middle', horizontal: 'center', wrapText: true },
    border: BORDER_STYLE
};

const subHeaderStyle = {
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: REMAX_RED } },
    font: { name: 'Arial', size: 10, bold: true, color: { argb: WHITE } },
    alignment: { vertical: 'middle', horizontal: 'center', wrapText: true },
    border: BORDER_STYLE
};

const labelStyle = {
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'EEEEEE' } },
    font: { name: 'Arial', size: 9, bold: true },
    alignment: { vertical: 'middle', horizontal: 'left', wrapText: true, indent: 1 },
    border: BORDER_STYLE
};

const valueStyle = {
    font: { name: 'Arial', size: 10 },
    alignment: { vertical: 'middle', horizontal: 'left', wrapText: true, indent: 1 },
    border: BORDER_STYLE
};

const sectionHeaderStyle = {
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: GRAY_HEADER } },
    font: { name: 'Arial', size: 11, bold: true },
    alignment: { vertical: 'middle', horizontal: 'center' },
    border: BORDER_STYLE
};

// Helper safely get string
const get = (formData, key) => formData.get(key) || '';

const generateBuySellSheet = async (workbook, formData) => {
    const sheet = workbook.addWorksheet('Presentación Operación');

    sheet.columns = [
        { width: 20 }, { width: 20 }, { width: 15 }, { width: 15 }, { width: 15 },
        { width: 15 }, { width: 15 }, { width: 15 }, { width: 15 }, { width: 15 },
        { width: 15 }, { width: 15 }
    ];

    // --- TITLE ---
    sheet.mergeCells('A1:L2');
    const titleCell = sheet.getCell('A1');
    titleCell.value = 'PRESENTACIÓN DE OPERACIÓN \nPROMESA DE COMPRAVENTA';
    titleCell.style = headerStyle;
    sheet.getRow(1).height = 25;
    sheet.getRow(2).height = 25;

    // --- AGENT INFO ---
    const rAgent = 3;
    sheet.mergeCells(`A${rAgent}:L${rAgent}`);
    const agentCell = sheet.getCell(`A${rAgent}`);
    const agentName = get(formData, 'agente_nombre');
    const agentEmail = get(formData, 'agente_email');
    const agentPhone = get(formData, 'agente_telefono');
    agentCell.value = `AGENTE: ${agentName}  |  EMAIL: ${agentEmail}  |  TEL: ${agentPhone}`;
    agentCell.style = { ...subHeaderStyle, fill: { ...subHeaderStyle.fill, fgColor: { argb: 'DDDDDD' } }, font: { ...subHeaderStyle.font, color: { argb: '000000' } } };


    // --- GENERAL DATES ---
    const r3 = 4;
    const headers = [
        { t: 'FECHA CIERRE', pos: 'A', width: 1 },
        { t: 'Propiedad', pos: 'B', width: 1 },
        { t: 'Comuna', pos: 'C', width: 1 },
        { t: 'Valor de Venta', pos: 'D', width: 2 }, // D:E
        { t: 'Fecha firma PROMESA', pos: 'F', width: 3 }, // F:H
        { t: 'Fecha Entrega', pos: 'I', width: 2 }, // I:J
        { t: 'Código RE/MAX', pos: 'K', width: 2 }  // K:L
    ];

    headers.forEach(h => {
        let sc = h.pos;
        let ec = h.pos;
        if (h.width > 1) {
            // Simple logic for known columns
            if (h.pos === 'D') ec = 'E';
            if (h.pos === 'F') ec = 'H';
            if (h.pos === 'I') ec = 'J';
            if (h.pos === 'K') ec = 'L';
            sheet.mergeCells(`${sc}${r3}:${ec}${r3}`);
        }
        const cell = sheet.getCell(`${sc}${r3}`);
        cell.value = h.t;
        cell.style = subHeaderStyle;

        // Value row
        const r4 = 5;
        // Don't merge value cells for "Valor de Venta" so we can put UF and Pesos separately
        if (h.width > 1 && !h.t.includes('Valor')) {
            sheet.mergeCells(`${sc}${r4}:${ec}${r4}`);
        }

        const vCell = sheet.getCell(`${sc}${r4}`);
        vCell.style = valueStyle;
        vCell.alignment = { vertical: 'middle', horizontal: 'center' };

        // Map values
        if (h.t.includes('CIERRE')) vCell.value = get(formData, 'fecha_cierre');
        if (h.t.includes('Propiedad')) vCell.value = get(formData, 'tipo_propiedad');
        if (h.t.includes('Comuna')) vCell.value = get(formData, 'comuna');
        if (h.t.includes('Valor')) {
            // Value cells are already separate (D and E)
            const cellUF = sheet.getCell(`D${r4}`);
            cellUF.value = get(formData, 'valor_venta_uf');
            cellUF.style = valueStyle;
            cellUF.alignment = { horizontal: 'center' };

            const cellPesos = sheet.getCell(`E${r4}`);
            cellPesos.value = get(formData, 'valor_venta_pesos');
            cellPesos.style = valueStyle;
            cellPesos.alignment = { horizontal: 'center' };
        }
        if (h.t.includes('PROMESA')) vCell.value = get(formData, 'fecha_promesa');
        if (h.t.includes('Entrega')) vCell.value = get(formData, 'fecha_entrega');
        if (h.t.includes('RE/MAX')) vCell.value = get(formData, 'codigo_remax');
    });

    // --- PARTIES ---
    const rPartiesHeader = 8;
    // ... Implement logic similar to before but cleaner ...
    // Reuse previous logic for speed/correctness of existing implementation
    sheet.getCell(`A${rPartiesHeader}`).value = 'Rol';
    sheet.getCell(`B${rPartiesHeader}`).value = 'Nombres';
    sheet.getCell(`C${rPartiesHeader}`).value = 'Apellidos';
    sheet.getCell(`D${rPartiesHeader}`).value = 'RUT';
    sheet.getCell(`E${rPartiesHeader}`).value = 'Profesión';
    sheet.getCell(`F${rPartiesHeader}`).value = 'Estado Civil';
    sheet.mergeCells(`G${rPartiesHeader}:I${rPartiesHeader}`);
    sheet.getCell(`G${rPartiesHeader}`).value = 'Dirección';
    sheet.getCell(`J${rPartiesHeader}`).value = 'Teléfono';
    sheet.mergeCells(`K${rPartiesHeader}:L${rPartiesHeader}`);
    sheet.getCell(`K${rPartiesHeader}`).value = 'Correo';

    ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'J', 'K'].forEach(col => {
        sheet.getCell(`${col}${rPartiesHeader}`).style = subHeaderStyle;
    });

    const parties = [
        { label: 'Vendedor 1', prefix: 'vendedor_1' },
        { label: 'Vendedor 2', prefix: 'vendedor_2' },
        { label: 'Comprador 1', prefix: 'comprador_1' },
        { label: 'Comprador 2', prefix: 'comprador_2' },
    ];

    let currentR = rPartiesHeader + 1;
    parties.forEach(p => {
        sheet.getCell(`A${currentR}`).value = p.label;
        sheet.getCell(`A${currentR}`).style = { ...labelStyle, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'DDDDDD' } }, alignment: { horizontal: 'center' } };

        sheet.getCell(`B${currentR}`).value = get(formData, `${p.prefix}_nombres`);
        sheet.getCell(`C${currentR}`).value = get(formData, `${p.prefix}_apellidos`);
        sheet.getCell(`D${currentR}`).value = get(formData, `${p.prefix}_rut`);
        sheet.getCell(`E${currentR}`).value = get(formData, `${p.prefix}_profesion`);
        sheet.getCell(`F${currentR}`).value = get(formData, `${p.prefix}_estado_civil`);

        sheet.mergeCells(`G${currentR}:I${currentR}`);
        sheet.getCell(`G${currentR}`).value = get(formData, `${p.prefix}_direccion`);

        sheet.getCell(`J${currentR}`).value = get(formData, `${p.prefix}_telefono`);

        sheet.mergeCells(`K${currentR}:L${currentR}`);
        sheet.getCell(`K${currentR}`).value = get(formData, `${p.prefix}_correo`);

        ['B', 'C', 'D', 'E', 'F', 'G', 'J', 'K'].forEach(col => {
            sheet.getCell(`${col}${currentR}`).style = valueStyle;
            if (col !== 'G' && col !== 'K') sheet.getCell(`${col}${currentR}`).alignment = { horizontal: 'center' };
        });
        currentR++;
    });

    // --- FINANCIALS ---
    const rFin = currentR + 2;
    sheet.mergeCells(`A${rFin}:C${rFin}`);
    sheet.getCell(`A${rFin}`).value = 'ACUERDOS PARA PROMESA';
    sheet.getCell(`A${rFin}`).style = subHeaderStyle;

    const finRows = [
        { label: 'MONTO DEL PIE', key: 'monto_pie' },
        { label: 'MONTO A FINANCIAR', key: 'monto_financiar' },
        { label: 'MONTO CONTADO', key: 'monto_contado' }
    ];

    finRows.forEach((row, idx) => {
        const r = rFin + 1 + idx;
        sheet.mergeCells(`A${r}:B${r}`);
        sheet.getCell(`A${r}`).value = row.label;
        sheet.getCell(`A${r}`).style = labelStyle;
        sheet.getCell(`C${r}`).value = get(formData, row.key);
        sheet.getCell(`C${r}`).style = valueStyle;
    });

    // Banks
    sheet.mergeCells(`E${rFin}:F${rFin}`);
    sheet.getCell(`E${rFin}`).style = subHeaderStyle; // Fixed blank cell
    sheet.getCell(`G${rFin}`).value = 'BANCO';
    sheet.getCell(`H${rFin}`).value = 'EJECUTIVO';
    sheet.mergeCells(`I${rFin}:J${rFin}`);
    sheet.getCell(`I${rFin}`).value = 'CORREO';
    sheet.mergeCells(`K${rFin}:L${rFin}`);
    sheet.getCell(`K${rFin}`).value = 'TELÉFONO';
    ['G', 'H', 'I', 'K'].forEach(c => sheet.getCell(`${c}${rFin}`).style = subHeaderStyle);

    // Vend/Comp bank rows
    const createBankRow = (r, label, prefix) => {
        sheet.mergeCells(`E${r}:F${r}`);
        sheet.getCell(`E${r}`).value = label;
        sheet.getCell(`E${r}`).style = labelStyle;

        sheet.getCell(`G${r}`).value = get(formData, `${prefix}_banco`);
        sheet.getCell(`H${r}`).value = get(formData, `${prefix}_ejecutivo`);

        sheet.mergeCells(`I${r}:J${r}`);
        sheet.getCell(`I${r}`).value = get(formData, `${prefix}_correo_banco`);

        sheet.mergeCells(`K${r}:L${r}`);
        sheet.getCell(`K${r}`).value = get(formData, `${prefix}_telefono_banco`);

        ['G', 'H', 'I', 'K'].forEach(c => sheet.getCell(`${c}${r}`).style = valueStyle);
    };

    createBankRow(rFin + 1, 'VENDEDOR', 'vendedor');
    createBankRow(rFin + 2, 'COMPRADOR', 'comprador');

    // --- INSTRUCTIONS ---
    const rInst = rFin + 5;
    sheet.mergeCells(`A${rInst}:L${rInst}`);
    sheet.getCell(`A${rInst}`).value = 'DATOS DE INSTRUCCIONES / VALE VISTA / TRANSFERENCIAS';
    sheet.getCell(`A${rInst}`).style = headerStyle;

    const rInstHead = rInst + 1;
    const instHeaders = [
        { t: 'Girador', pos: 'A:C' },
        { t: 'A la Orden De', pos: 'D:E' },
        { t: 'Banco', pos: 'F' },
        { t: 'Cta.Cte', pos: 'G' },
        { t: 'Serie', pos: 'H' },
        { t: 'N° Doc', pos: 'I' },
        { t: '% Comis', pos: 'J' },
        { t: 'Monto', pos: 'K:L' }
    ];

    instHeaders.forEach(h => {
        if (h.pos.includes(':')) {
            const [s, e] = h.pos.split(':');
            sheet.mergeCells(`${s}${rInstHead}:${e}${rInstHead}`);
            sheet.getCell(`${s}${rInstHead}`).value = h.t;
            sheet.getCell(`${s}${rInstHead}`).style = subHeaderStyle;
        } else {
            const c = sheet.getCell(`${h.pos}${rInstHead}`);
            c.value = h.t;
            c.style = subHeaderStyle;
        }
    });

    const instTypes = [
        { label: 'Vendedor Honorarios', id: 'vendedor_hon' },
        { label: 'Comprador Honorarios', id: 'comprador_hon' },
        { label: 'Garantía Comprador', id: 'garantia_comp' },
        { label: 'Garantía Vendedor', id: 'garantia_vend' }
    ];

    let currInstR = rInstHead + 1;
    instTypes.forEach(inst => {
        sheet.mergeCells(`A${currInstR}:C${currInstR}`);
        sheet.getCell(`A${currInstR}`).value = inst.label;
        sheet.getCell(`A${currInstR}`).style = labelStyle;

        sheet.mergeCells(`D${currInstR}:E${currInstR}`);
        sheet.getCell(`D${currInstR}`).value = get(formData, `${inst.id}_orden`);
        sheet.getCell(`D${currInstR}`).style = valueStyle;

        ['F', 'G', 'H', 'I', 'J'].forEach(c => {
            const kMap = { F: 'banco', G: 'cta', H: 'serie', I: 'doc', J: 'comision' };
            sheet.getCell(`${c}${currInstR}`).value = get(formData, `${inst.id}_${kMap[c]}`);
            sheet.getCell(`${c}${currInstR}`).style = valueStyle;
        });

        sheet.mergeCells(`K${currInstR}:L${currInstR}`);
        sheet.getCell(`K${currInstR}`).value = get(formData, `${inst.id}_monto`);
        sheet.getCell(`K${currInstR}`).style = valueStyle;

        currInstR++;
    });

    // --- NOTES ---
    const rNotes = currInstR + 2;
    sheet.mergeCells(`A${rNotes}:L${rNotes}`);
    sheet.getCell(`A${rNotes}`).value = 'AVANCES DE LA OPERACIÓN / NOTAS';
    sheet.getCell(`A${rNotes}`).style = subHeaderStyle;

    sheet.mergeCells(`A${rNotes + 1}:L${rNotes + 5}`);
    sheet.getCell(`A${rNotes + 1}`).value = get(formData, 'notas');
    sheet.getCell(`A${rNotes + 1}`).style = {
        ...valueStyle, alignment: { vertical: 'top', horizontal: 'left', wrapText: true }
    };
};

const generateLeaseSheet = async (workbook, formData) => {
    const sheet = workbook.addWorksheet('Contrato Arriendo');

    // Grid: 6 Columns roughly equal to match screenshot 2-column groups
    // Actually standard 12 col or just 4 wide columns?
    // Screenshot has: Label | Value | Label | Value (Basically 4 columns)
    // Or Label | Value (2 big columns)
    // Let's use 4 columns: A(Label), B(Value), C(Label), D(Value)
    sheet.columns = [
        { width: 25 }, { width: 35 }, { width: 25 }, { width: 35 }
    ];

    // --- TITLE ---
    sheet.mergeCells('A1:D1');
    const title = sheet.getCell('A1');
    title.value = 'DATOS PARA REDACCION DE CONTRATO DE ARRIENDO';
    title.style = headerStyle;

    // --- AGENT INFO ---
    sheet.mergeCells('A2:D2');
    const agentCell = sheet.getCell('A2');
    const agentName = get(formData, 'agente_nombre');
    const agentEmail = get(formData, 'agente_email');
    const agentPhone = get(formData, 'agente_telefono');
    agentCell.value = `AGENTE: ${agentName}  |  EMAIL: ${agentEmail}  |  TEL: ${agentPhone}`;
    agentCell.style = { ...subHeaderStyle, fill: { ...subHeaderStyle.fill, fgColor: { argb: 'DDDDDD' } }, font: { ...subHeaderStyle.font, color: { argb: '000000' } } };

    // --- CONTRACT DETAILS ---
    let r = 4; // Start lower because of agent info
    const addRow = (l1, k1, l2, k2) => {
        sheet.getCell(`A${r}`).value = l1;
        sheet.getCell(`B${r}`).value = get(formData, k1);
        if (l2) {
            sheet.getCell(`C${r}`).value = l2;
            sheet.getCell(`D${r}`).value = get(formData, k2);
        }
        r++;
    };

    addRow('PLAZO DEL CONTRATO:', 'plazo_contrato');
    addRow('FECHA INIC. ARRIENDO:', 'fecha_inicio');
    addRow('DOCUMENTA CHEQUE:', 'documenta_cheque'); // Using text field for YES/NO
    addRow('CANON DE ARRIENDO:', 'canon_arriendo');
    addRow('CUENTA BANCARIA :', 'cuenta_transferencia');
    addRow('CON ADMINISTRACIÓN:', 'con_administracion', 'CON RESTITUCIÓN:', 'con_restitucion');
    // Add extra property IDs
    addRow('ROL PROPIEDAD:', 'rol_propiedad');
    addRow('N° CLIENTE AGUA:', 'cliente_agua', 'N° CLIENTE LUZ:', 'cliente_luz');

    r++;

    // Helper for Person/Entity Section
    const addSectionHeader = (text) => {
        sheet.mergeCells(`A${r}:D${r}`);
        const cell = sheet.getCell(`A${r}`);
        cell.value = text;
        cell.style = subHeaderStyle; // Used Brand Red style
        r++;
    };

    const addFieldRow = (l1, v1, l2, v2) => {
        sheet.getCell(`A${r}`).value = l1;
        sheet.getCell(`A${r}`).style = { font: { bold: true } };
        sheet.getCell(`B${r}`).value = v1;
        sheet.getCell(`B${r}`).style = { border: { bottom: { step: 'thin' } } }; // Underline style roughly

        if (l2) {
            sheet.getCell(`C${r}`).value = l2;
            sheet.getCell(`C${r}`).style = { font: { bold: true } };
            sheet.getCell(`D${r}`).value = v2;
            sheet.getCell(`D${r}`).style = { border: { bottom: { step: 'thin' } } };
        }
        r++;
    };

    // --- ARRENDADOR ---
    addSectionHeader('ARRENDADOR');
    const p1 = 'arrendador';
    addFieldRow('APELLIDOS:', get(formData, `${p1}_apellidos`), 'NOMBRES:', get(formData, `${p1}_nombres`));
    addFieldRow('CI / PASAP. N°:', get(formData, `${p1}_rut`), 'FECHA DE NACIMIENTO:', get(formData, `${p1}_nacimiento`));
    addFieldRow('ESTADO CIVIL:', get(formData, `${p1}_civil`), 'NACIONALIDAD:', get(formData, `${p1}_nacionalidad`));
    addFieldRow('DOMIC. PART.:', get(formData, `${p1}_direccion`), 'COMUNA:', get(formData, `${p1}_comuna`));
    addFieldRow('TELÉFONO CEL.:', get(formData, `${p1}_telefono`), 'EMAIL:', get(formData, `${p1}_email`));

    r++;

    // --- ARRENDATARIO ---
    const typeArr = get(formData, 'tipo_arrendatario'); // 'natural' or 'legal'

    if (typeArr === 'natural') {
        addSectionHeader('ARRENDATARIO PERSONA NATURAL');
        const p2 = 'arrendatario';
        addFieldRow('APELLIDOS:', get(formData, `${p2}_apellidos`), 'NOMBRES:', get(formData, `${p2}_nombres`));
        addFieldRow('CI / PASAP. N°:', get(formData, `${p2}_rut`), 'FECHA DE NACIMIENTO:', get(formData, `${p2}_nacimiento`));
        addFieldRow('ESTADO CIVIL:', get(formData, `${p2}_civil`), 'NACIONALIDAD:', get(formData, `${p2}_nacionalidad`));
        addFieldRow('DOMIC. PART.:', get(formData, `${p2}_direccion`), 'COMUNA:', get(formData, `${p2}_comuna`));
        addFieldRow('TELÉFONO CEL.:', get(formData, `${p2}_telefono`), 'EMAIL:', get(formData, `${p2}_email`));

        r++; // Spacing
        addFieldRow('OCUPACIÓN:', get(formData, `${p2}_ocupacion`), 'PROFESION:', get(formData, `${p2}_profesion`));
        addFieldRow('EMPLEADOR:', get(formData, `${p2}_empleador`), 'CARGO:', get(formData, `${p2}_cargo`));
        addFieldRow('DOMIC. LABORAL:', get(formData, `${p2}_direccion_lab`), 'ANTIGÜEDAD:', get(formData, `${p2}_antiguedad`));
        addFieldRow('TELÉFONO LAB:', get(formData, `${p2}_telefono_lab`));
    } else {
        addSectionHeader('ARRENDATARIO PERSONA JURÍDICA');
        const pj = 'arrendatario_juridica';
        addFieldRow('RAZÓN SOCIAL:', get(formData, `${pj}_razon`));
        addFieldRow('DOMIC. COMERC:', get(formData, `${pj}_direccion`));
        addFieldRow('R.U.T.:', get(formData, `${pj}_rut`), 'TELÉFONO:', get(formData, `${pj}_telefono`));

        r++;
        sheet.getCell(`A${r}`).value = 'REPRESENTADA POR:';
        sheet.getCell(`A${r}`).font = { bold: true };
        r++;
        const pr = 'arrendatario_juridica_rep';
        addFieldRow('APELLIDOS:', get(formData, `${pr}_apellidos`), 'NOMBRES:', get(formData, `${pr}_nombres`));
        addFieldRow('CI / PASAP. N°:', get(formData, `${pr}_rut`), 'FECHA NAC:', get(formData, `${pr}_nacimiento`));
        addFieldRow('ESTADO CIVIL:', get(formData, `${pr}_civil`), 'NACIONALIDAD:', get(formData, `${pr}_nacionalidad`));
        addFieldRow('TELÉFONO CEL.:', get(formData, `${pr}_telefono`), 'EMAIL:', get(formData, `${pr}_email`));
    }

    r++;

    // --- FIADOR ---
    const hasFiador = get(formData, 'tiene_fiador') === 'si';
    if (hasFiador) {
        addSectionHeader('FIADOR Y CODEUDOR SOLIDARIO');
        const pf = 'fiador';
        addFieldRow('APELLIDOS:', get(formData, `${pf}_apellidos`), 'NOMBRES:', get(formData, `${pf}_nombres`));
        addFieldRow('CI / PASAP. N°:', get(formData, `${pf}_rut`), 'FECHA DE NACIMIENTO:', get(formData, `${pf}_nacimiento`));
        addFieldRow('ESTADO CIVIL:', get(formData, `${pf}_civil`), 'NACIONALIDAD:', get(formData, `${pf}_nacionalidad`));
        addFieldRow('DOMIC. PART.:', get(formData, `${pf}_direccion`), 'COMUNA:', get(formData, `${pf}_comuna`));
        addFieldRow('TELÉFONO CEL.:', get(formData, `${pf}_telefono`), 'EMAIL:', get(formData, `${pf}_email`));

        r++; // Spacing
        addFieldRow('OCUPACIÓN:', get(formData, `${pf}_ocupacion`), 'PROFESION:', get(formData, `${pf}_profesion`));
        addFieldRow('EMPLEADOR:', get(formData, `${pf}_empleador`), 'CARGO:', get(formData, `${pf}_cargo`));
        addFieldRow('DOMIC. LABORAL:', get(formData, `${pf}_direccion_lab`), 'ANTIGÜEDAD:', get(formData, `${pf}_antiguedad`));
        addFieldRow('TELÉFONO LAB:', get(formData, `${pf}_telefono_lab`));
    }

    // --- NOTES ---
    r += 2;
    addSectionHeader('NOTAS ADICIONALES');
    sheet.mergeCells(`A${r}:D${r + 4}`);
    sheet.getCell(`A${r}`).value = get(formData, 'notas');
    sheet.getCell(`A${r}`).alignment = { vertical: 'top', horizontal: 'left', wrapText: true };
    sheet.getCell(`A${r}`).style = { border: BORDER_STYLE };
};
