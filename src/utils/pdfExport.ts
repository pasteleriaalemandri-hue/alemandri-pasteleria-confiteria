import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Classification, InventoryItem, MovementRecord } from '../types';
import {
  formatCurrency,
  formatDateDisplay,
  formatDateTimeDisplay,
  formatFullDateSlash,
  formatNumber,
  getDaysUntilExpiry,
} from './formatters';

interface PdfExportOptions {
  movements: MovementRecord[];
  inventory: InventoryItem[];
  periodLabel: 'semanal' | 'mensual';
  daysWindow: number;
  selectedCategory: 'Todas' | Classification;
  logoUrl: string;
}

async function loadImageAsDataUrl(
  src: string
): Promise<{ dataUrl: string; width: number; height: number } | null> {
  try {
    return await new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth || 300;
          canvas.height = img.naturalHeight || 80;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(null);
            return;
          }
          ctx.drawImage(img, 0, 0);
          resolve({
            dataUrl: canvas.toDataURL('image/png'),
            width: canvas.width,
            height: canvas.height,
          });
        } catch {
          resolve(null);
        }
      };
      img.onerror = () => resolve(null);
      img.src = src;
    });
  } catch {
    return null;
  }
}

export async function downloadMovementsPdf({
  movements,
  inventory,
  periodLabel,
  daysWindow,
  selectedCategory,
  logoUrl,
}: PdfExportOptions): Promise<number> {
  const now = new Date();
  const cutoff = new Date(now);
  cutoff.setDate(now.getDate() - daysWindow);
  cutoff.setHours(0, 0, 0, 0);

  const periodMovements = movements
    .filter((m) => {
      if (selectedCategory !== 'Todas' && m.classification !== selectedCategory) {
        return false;
      }
      return new Date(m.dateTime) >= cutoff;
    })
    .sort(
      (a, b) => new Date(b.dateTime).getTime() - new Date(a.dateTime).getTime()
    );

  // KPI calculations for the period
  const entries = periodMovements.filter((m) => m.type === 'entrada');
  const exits = periodMovements.filter((m) => m.type === 'salida');

  const totalSpend = entries.reduce((sum, m) => sum + m.totalCost, 0);
  const totalExitsValue = exits.reduce((sum, m) => sum + m.totalCost, 0);

  const plannedSpend = entries
    .filter((m) => m.purchaseType !== 'Imprevista')
    .reduce((sum, m) => sum + m.totalCost, 0);
  const unplannedSpend = entries
    .filter((m) => m.purchaseType === 'Imprevista')
    .reduce((sum, m) => sum + m.totalCost, 0);

  const unplannedPct = totalSpend > 0 ? (unplannedSpend / totalSpend) * 100 : 0;
  const plannedPct = totalSpend > 0 ? 100 - unplannedPct : 0;

  const lowStockCount = inventory.filter(
    (item) => item.currentStock <= item.minStock
  ).length;
  const expiringCount = inventory.filter((item) => {
    const d = getDaysUntilExpiry(item.nearestExpiry);
    return d !== null && d <= 7;
  }).length;

  // Create Landscape A4 PDF for spacious multi-column layout
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth(); // 297mm
  const marginX = 14;
  const usableWidth = pageWidth - marginX * 2; // 269mm

  // 1. Corporate Chocolate Header Banner (#3b1e14)
  doc.setFillColor(59, 30, 20);
  doc.rect(0, 0, pageWidth, 30, 'F');

  // Subtle pink accent strip at bottom of header (#f462c8)
  doc.setFillColor(244, 98, 200);
  doc.rect(0, 30, pageWidth, 1.5, 'F');

  // Logo inside header
  const loadedLogo = await loadImageAsDataUrl(logoUrl);
  let textStartX = marginX;
  if (loadedLogo) {
    const targetH = 18;
    const ratio = loadedLogo.width / Math.max(loadedLogo.height, 1);
    const targetW = Math.min(58, targetH * ratio);
    doc.addImage(loadedLogo.dataUrl, 'PNG', marginX, 6, targetW, targetH);
    textStartX = marginX + targetW + 6;
  }

  // Corporate Title & Report Info
  doc.setTextColor(255, 248, 245);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text('Alemandri — Pastelería y Confitería', textStartX, 13);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(243, 229, 222);
  const titleSuffix =
    periodLabel === 'semanal'
      ? 'Reporte Semanal de Compras, Retiros e Inventario'
      : 'Reporte Mensual de Compras, Retiros e Inventario';
  doc.text(titleSuffix, textStartX, 20);

  if (selectedCategory !== 'Todas') {
    doc.setFontSize(8.5);
    doc.setTextColor(244, 98, 200);
    doc.text(`Clasificación filtrada: ${selectedCategory}`, textStartX, 25.5);
  }

  // Right-aligned date & evaluated range
  doc.setTextColor(255, 248, 245);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.text(`Fecha de emisión: ${formatFullDateSlash(now)}`, pageWidth - marginX, 13, {
    align: 'right',
  });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(243, 229, 222);
  doc.text(
    `Rango evaluado: ${formatFullDateSlash(cutoff)} al ${formatFullDateSlash(now)}`,
    pageWidth - marginX,
    19.5,
    { align: 'right' }
  );
  doc.text(
    `Movimientos en el período: ${periodMovements.length}`,
    pageWidth - marginX,
    25.5,
    { align: 'right' }
  );

  // 2. KPI Summary Cards (4 clean cream boxes)
  const cardTopY = 37;
  const cardGap = 4;
  const cardW = (usableWidth - cardGap * 3) / 4;
  const cardH = 24;

  const kpiCards = [
    {
      label: 'GASTO TOTAL EN COMPRAS',
      value: formatCurrency(totalSpend),
      sub: `${entries.length} entradas registradas`,
      accent: false,
    },
    {
      label: 'IMPREVISTAS VS. PLANIFICADAS',
      value: `${unplannedPct.toFixed(1)}% imp. / ${plannedPct.toFixed(1)}% plan.`,
      sub: `Imp: ${formatCurrency(unplannedSpend)} | Plan: ${formatCurrency(plannedSpend)}`,
      accent: true,
    },
    {
      label: 'TOTAL RETIROS / SALIDAS',
      value: formatCurrency(totalExitsValue),
      sub: `${exits.length} retiros de producción/vitrina`,
      accent: false,
    },
    {
      label: 'ALERTAS ACTIVAS',
      value: `${lowStockCount + expiringCount} alertas`,
      sub: `${lowStockCount} stock bajo · ${expiringCount} por vencer (<=7d)`,
      accent: false,
    },
  ];

  kpiCards.forEach((card, idx) => {
    const x = marginX + idx * (cardW + cardGap);
    doc.setFillColor(255, 248, 245); // #fff8f5
    doc.setDrawColor(234, 223, 216); // #eadfd8
    doc.roundedRect(x, cardTopY, cardW, cardH, 2.5, 2.5, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(109, 76, 65);
    doc.text(card.label, x + 4, cardTopY + 6.5);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(idx === 1 ? 10.5 : 12.5);
    if (card.accent) {
      doc.setTextColor(157, 23, 109); // deep rose
    } else {
      doc.setTextColor(59, 30, 20); // chocolate
    }
    doc.text(card.value, x + 4, cardTopY + 14.5, { maxWidth: cardW - 8 });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(90, 59, 46);
    doc.text(card.sub, x + 4, cardTopY + 20.5, { maxWidth: cardW - 8 });
  });

  // 3. Section Title for Movements Table
  const tableStartY = cardTopY + cardH + 8;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(59, 30, 20);
  doc.text('Detalle de Movimientos del Período', marginX, tableStartY - 2.5);

  const tableRows = periodMovements.map((m) => [
    formatDateTimeDisplay(m.dateTime),
    m.type === 'entrada' ? 'Entrada' : 'Salida',
    m.classification,
    m.itemName,
    `${m.type === 'entrada' ? '+' : '-'}${formatNumber(m.quantity)} ${m.unit}`,
    m.type === 'entrada' ? m.purchaseType || 'Planificada' : '—',
    m.reason,
    m.responsible,
    m.expiryDate ? formatDateDisplay(m.expiryDate) : '—',
    formatCurrency(m.totalCost),
  ]);

  if (tableRows.length === 0) {
    tableRows.push([
      '—',
      '—',
      '—',
      'Sin movimientos registrados en este período',
      '—',
      '—',
      '—',
      '—',
      '—',
      formatCurrency(0),
    ]);
  }

  autoTable(doc, {
    startY: tableStartY,
    margin: { left: marginX, right: marginX, bottom: 16 },
    head: [
      [
        'Fecha / Hora',
        'Tipo',
        'Clasificación',
        'Producto',
        'Cantidad',
        'Compra',
        'Motivo',
        'Responsable',
        'Vencimiento',
        'Costo (Bs.)',
      ],
    ],
    body: tableRows,
    theme: 'grid',
    styles: {
      font: 'helvetica',
      fontSize: 8,
      cellPadding: 2.5,
      textColor: [43, 24, 17],
      lineColor: [220, 203, 194],
      lineWidth: 0.25,
      valign: 'middle',
      overflow: 'linebreak',
    },
    headStyles: {
      fillColor: [59, 30, 20],
      textColor: [255, 248, 245],
      fontStyle: 'bold',
      fontSize: 8,
      halign: 'left',
    },
    alternateRowStyles: {
      fillColor: [255, 248, 245],
    },
    columnStyles: {
      0: { cellWidth: 27 },
      1: { cellWidth: 16, halign: 'center' },
      2: { cellWidth: 34 },
      3: { cellWidth: 44, fontStyle: 'bold' },
      4: { cellWidth: 22, halign: 'right' },
      5: { cellWidth: 21, halign: 'center' },
      6: { cellWidth: 36 },
      7: { cellWidth: 27 },
      8: { cellWidth: 20, halign: 'center' },
      9: { cellWidth: 22, halign: 'right', fontStyle: 'bold' },
    },
    didDrawPage: (data) => {
      const pageCount = doc.getNumberOfPages();
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(109, 76, 65);
      doc.text(
        `Alemandri — Pastelería y Confitería · Moneda: Bolivianos (Bs.)`,
        marginX,
        doc.internal.pageSize.getHeight() - 7
      );
      doc.text(
        `Página ${data.pageNumber} de ${pageCount}`,
        pageWidth - marginX,
        doc.internal.pageSize.getHeight() - 7,
        { align: 'right' }
      );
    },
  });

  const todayStr = now.toISOString().slice(0, 10);
  doc.save(`alemandri_reporte_${periodLabel}_${todayStr}.pdf`);
  return periodMovements.length;
}

export interface FinalProductsPdfOptions {
  movements: MovementRecord[];
  inventory: InventoryItem[];
  periodLabel: string;
  startDate: string;
  endDate: string;
  logoUrl: string;
}

export async function downloadFinalProductsPdf({
  movements,
  inventory,
  periodLabel,
  startDate,
  endDate,
  logoUrl,
}: FinalProductsPdfOptions): Promise<number> {
  const now = new Date();
  const finalItems = inventory.filter(
    (item) => item.classification === 'Producto Terminado'
  );

  const periodMovements = movements
    .filter((m) => {
      if (m.classification !== 'Producto Terminado') return false;
      const dateOnly = m.dateTime.slice(0, 10);
      if (startDate && dateOnly < startDate) return false;
      if (endDate && dateOnly > endDate) return false;
      return true;
    })
    .sort(
      (a, b) => new Date(b.dateTime).getTime() - new Date(a.dateTime).getTime()
    );

  const entries = periodMovements.filter((m) => m.type === 'entrada');
  const sales = periodMovements.filter(
    (m) =>
      m.type === 'salida' &&
      m.reason !== 'Merma / producto dañado' &&
      m.reason !== 'Vencimiento / descarte'
  );

  const totalProduced = entries.reduce((sum, m) => sum + m.quantity, 0);
  const totalSold = sales.reduce((sum, m) => sum + m.quantity, 0);
  const totalRevenue = sales.reduce((sum, m) => sum + m.totalCost, 0);
  const totalStock = finalItems.reduce((sum, i) => sum + i.currentStock, 0);

  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth(); // 297mm
  const marginX = 14;
  const usableWidth = pageWidth - marginX * 2; // 269mm

  // 1. Corporate Chocolate Header Banner (#3b1e14)
  doc.setFillColor(59, 30, 20);
  doc.rect(0, 0, pageWidth, 30, 'F');
  doc.setFillColor(244, 98, 200);
  doc.rect(0, 30, pageWidth, 1.5, 'F');

  const loadedLogo = await loadImageAsDataUrl(logoUrl);
  let textStartX = marginX;
  if (loadedLogo) {
    const targetH = 18;
    const ratio = loadedLogo.width / Math.max(loadedLogo.height, 1);
    const targetW = Math.min(58, targetH * ratio);
    doc.addImage(loadedLogo.dataUrl, 'PNG', marginX, 6, targetW, targetH);
    textStartX = marginX + targetW + 6;
  }

  doc.setTextColor(255, 248, 245);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text('Alemandri — Pastelería y Confitería', textStartX, 13);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(243, 229, 222);
  doc.text(
    `Reporte Exclusivo de Producto Final: Tortas y Vitrina (${periodLabel})`,
    textStartX,
    20
  );

  doc.setFontSize(8.5);
  doc.setTextColor(244, 98, 200);
  doc.text('Clasificación: Producto Terminado (Entradas de Producción y Salidas/Ventas)', textStartX, 25.5);

  const rangeText =
    startDate && endDate
      ? `${startDate.split('-').reverse().join('/')} al ${endDate.split('-').reverse().join('/')}`
      : 'Todo el historial';

  doc.setTextColor(255, 248, 245);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.text(`Fecha de emisión: ${formatFullDateSlash(now)}`, pageWidth - marginX, 13, {
    align: 'right',
  });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(243, 229, 222);
  doc.text(`Período evaluado: ${rangeText}`, pageWidth - marginX, 19.5, {
    align: 'right',
  });
  doc.text(
    `Movimientos de tortas: ${periodMovements.length}`,
    pageWidth - marginX,
    25.5,
    { align: 'right' }
  );

  // 2. Executive Summary Cards (4 KPI boxes)
  const cardTopY = 37;
  const cardGap = 4;
  const cardW = (usableWidth - cardGap * 3) / 4;
  const cardH = 24;

  const kpiCards = [
    {
      label: 'TOTAL UNIDADES PRODUCIDAS',
      value: `+${formatNumber(totalProduced)} u.`,
      sub: `${entries.length} registros de producción`,
      accent: false,
    },
    {
      label: 'TOTAL UNIDADES VENDIDAS',
      value: `${formatNumber(totalSold)} u.`,
      sub: `${sales.length} ventas / despachos`,
      accent: false,
    },
    {
      label: 'INGRESOS TOTALES POR VENTAS',
      value: formatCurrency(totalRevenue),
      sub: 'Monto estimado en Bolivianos (Bs.)',
      accent: true,
    },
    {
      label: 'STOCK ACTUAL EN VITRINA',
      value: `${formatNumber(totalStock)} u.`,
      sub: `${finalItems.length} variedades registradas`,
      accent: false,
    },
  ];

  kpiCards.forEach((card, idx) => {
    const x = marginX + idx * (cardW + cardGap);
    doc.setFillColor(255, 248, 245);
    doc.setDrawColor(234, 223, 216);
    doc.roundedRect(x, cardTopY, cardW, cardH, 2.5, 2.5, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(109, 76, 65);
    doc.text(card.label, x + 4, cardTopY + 6.5);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12.5);
    if (card.accent) {
      doc.setTextColor(157, 23, 109);
    } else {
      doc.setTextColor(59, 30, 20);
    }
    doc.text(card.value, x + 4, cardTopY + 14.5, { maxWidth: cardW - 8 });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(90, 59, 46);
    doc.text(card.sub, x + 4, cardTopY + 20.5, { maxWidth: cardW - 8 });
  });

  // 3. Table 1: Disponibilidad actual de tortas en vitrina
  const stockTitleY = cardTopY + cardH + 8;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(59, 30, 20);
  doc.text('1. Disponibilidad Actual en Vitrina (Producto Terminado)', marginX, stockTitleY - 2);

  const stockRows = finalItems.map((item) => {
    const daysExp = getDaysUntilExpiry(item.nearestExpiry);
    const isLow = item.currentStock <= item.minStock;
    let status = 'Disponible';
    if (daysExp !== null && daysExp < 0) status = 'Vencido';
    else if (daysExp !== null && daysExp <= 3) status = `Vence en ${daysExp}d`;
    else if (isLow) status = 'Stock bajo';

    return [
      item.name,
      item.presentation || 'Estándar',
      formatCurrency(item.referenceCost),
      `${formatNumber(item.currentStock)} ${item.defaultUnit}`,
      `${formatNumber(item.minStock)} ${item.defaultUnit}`,
      item.nearestExpiry ? formatDateDisplay(item.nearestExpiry) : 'Sin vencimiento',
      status,
    ];
  });

  if (stockRows.length === 0) {
    stockRows.push(['Sin tortas registradas', '—', formatCurrency(0), '0', '0', '—', '—']);
  }

  autoTable(doc, {
    startY: stockTitleY,
    margin: { left: marginX, right: marginX, bottom: 16 },
    head: [
      [
        'Torta / Producto Final',
        'Presentación',
        'Precio Venta (Bs.)',
        'Stock Actual',
        'Stock Mín.',
        'Vencimiento',
        'Estado',
      ],
    ],
    body: stockRows,
    theme: 'grid',
    styles: {
      font: 'helvetica',
      fontSize: 8,
      cellPadding: 2.3,
      textColor: [43, 24, 17],
      lineColor: [220, 203, 194],
      lineWidth: 0.25,
      valign: 'middle',
    },
    headStyles: {
      fillColor: [59, 30, 20],
      textColor: [255, 248, 245],
      fontStyle: 'bold',
      fontSize: 8,
    },
    alternateRowStyles: {
      fillColor: [255, 248, 245],
    },
    columnStyles: {
      0: { cellWidth: 74, fontStyle: 'bold' },
      1: { cellWidth: 38 },
      2: { cellWidth: 34, halign: 'right', fontStyle: 'bold' },
      3: { cellWidth: 32, halign: 'right' },
      4: { cellWidth: 28, halign: 'right' },
      5: { cellWidth: 34, halign: 'center' },
      6: { cellWidth: 29, halign: 'center' },
    },
  });

  // 4. Table 2: Detalle cronológico de entradas (producción) y salidas (ventas)
  const lastTableEndY =
    (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable
      ?.finalY || stockTitleY + 30;
  const movTitleY = lastTableEndY + 9;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(59, 30, 20);
  doc.text(
    '2. Detalle Cronológico de Entradas (Producción) y Salidas (Ventas)',
    marginX,
    movTitleY - 2
  );

  const movRows = periodMovements.map((m) => [
    formatDateTimeDisplay(m.dateTime),
    m.type === 'entrada' ? 'Producción (+)' : 'Venta / Salida (-)',
    m.itemName,
    `${m.type === 'entrada' ? '+' : '-'}${formatNumber(m.quantity)} ${m.unit}`,
    m.notes ? `${m.reason} · ${m.notes}` : m.reason,
    m.responsible,
    m.expiryDate ? formatDateDisplay(m.expiryDate) : '—',
    formatCurrency(m.totalCost),
  ]);

  if (movRows.length === 0) {
    movRows.push([
      '—',
      '—',
      'Sin movimientos de tortas registrados en este período',
      '—',
      '—',
      '—',
      '—',
      formatCurrency(0),
    ]);
  }

  autoTable(doc, {
    startY: movTitleY,
    margin: { left: marginX, right: marginX, bottom: 16 },
    head: [
      [
        'Fecha / Hora',
        'Movimiento',
        'Torta / Producto Final',
        'Cantidad',
        'Detalle / Observación',
        'Responsable',
        'Vencimiento Lote',
        'Monto (Bs.)',
      ],
    ],
    body: movRows,
    theme: 'grid',
    styles: {
      font: 'helvetica',
      fontSize: 8,
      cellPadding: 2.3,
      textColor: [43, 24, 17],
      lineColor: [220, 203, 194],
      lineWidth: 0.25,
      valign: 'middle',
      overflow: 'linebreak',
    },
    headStyles: {
      fillColor: [59, 30, 20],
      textColor: [255, 248, 245],
      fontStyle: 'bold',
      fontSize: 8,
    },
    alternateRowStyles: {
      fillColor: [255, 248, 245],
    },
    columnStyles: {
      0: { cellWidth: 28 },
      1: { cellWidth: 28, halign: 'center' },
      2: { cellWidth: 52, fontStyle: 'bold' },
      3: { cellWidth: 24, halign: 'right' },
      4: { cellWidth: 53 },
      5: { cellWidth: 32 },
      6: { cellWidth: 27, halign: 'center' },
      7: { cellWidth: 25, halign: 'right', fontStyle: 'bold' },
    },
    didDrawPage: (data) => {
      const pageCount = doc.getNumberOfPages();
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(109, 76, 65);
      doc.text(
        `Alemandri — Pastelería y Confitería · Reporte Producto Final (Bs.)`,
        marginX,
        doc.internal.pageSize.getHeight() - 7
      );
      doc.text(
        `Página ${data.pageNumber} de ${pageCount}`,
        pageWidth - marginX,
        doc.internal.pageSize.getHeight() - 7,
        { align: 'right' }
      );
    },
  });

  const todayStr = now.toISOString().slice(0, 10);
  doc.save(`alemandri_producto_final_${todayStr}.pdf`);
  return periodMovements.length;
}

