// exportUtils.js — Shared XLSX + PDF export helpers for payroll reports
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

/** Download an XLSX file.
 * @param {string} filename - without extension
 * @param {Array<{name:string, headers:string[], rows:Array<Array<any>>}>} sheets
 */
export function downloadXLSX(filename, sheets) {
  const wb = XLSX.utils.book_new();
  sheets.forEach(({ name, headers, rows }) => {
    const wsData = [headers, ...rows];
    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // Style header row bold (basic)
    const range = XLSX.utils.decode_range(ws['!ref']);
    for (let C = range.s.c; C <= range.e.c; C++) {
      const addr = XLSX.utils.encode_cell({ r: 0, c: C });
      if (!ws[addr]) continue;
      ws[addr].s = { font: { bold: true }, fill: { fgColor: { rgb: 'E8F0FE' } } };
    }

    // Auto-width columns
    const colWidths = headers.map((h, i) => {
      const maxLen = Math.max(
        String(h).length,
        ...rows.map(r => String(r[i] ?? '').length)
      );
      return { wch: Math.min(maxLen + 2, 40) };
    });
    ws['!cols'] = colWidths;

    XLSX.utils.book_append_sheet(wb, ws, name.slice(0, 31));
  });
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

/** Download a styled PDF report.
 * @param {string} filename - without extension
 * @param {string} title - report title
 * @param {string} period - period label shown in subtitle
 * @param {string[]} columns - table column headers
 * @param {Array<Array<any>>} rows - table data rows
 * @param {object} [options]
 * @param {Array<number>} [options.columnStyles] - indices of columns that should be right-aligned
 * @param {Object<number,number>} [options.columnWidths] - explicit column widths { colIndex: mmWidth }
 * @param {Array<any>} [options.totalsRow] - optional totals footer row
 * @param {Array<{label:string, value:string}>} [options.summaryCards] - summary stats shown above table
 */
export function downloadPDF(filename, title, period, columns, rows, options = {}) {
  const { totalsRow, summaryCards, columnStyles = [], columnWidths = {} } = options;

  // jsPDF Helvetica does not support the ₦ glyph (U+20A6) — replace with "NGN "
  const sanitize = (v) => typeof v === 'string' ? v.replace(/₦/g, 'NGN ') : v;
  const safeRows = rows.map(row => row.map(sanitize));
  const safeColumns = columns.map(sanitize);
  const safeTotalsRow = totalsRow ? totalsRow.map(sanitize) : undefined;
  const safeSummaryCards = summaryCards
    ? summaryCards.map(c => ({ ...c, value: sanitize(String(c.value)) }))
    : [];

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();

  // Header band
  doc.setFillColor(30, 58, 95);
  doc.rect(0, 0, pageW, 28, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(title, 14, 13);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Period: ${period}`, 14, 22);
  doc.text(`Generated: ${new Date().toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' })}`, pageW - 14, 22, { align: 'right' });

  let startY = 36;

  // Summary cards
  if (safeSummaryCards.length > 0) {
    const cardW = (pageW - 28 - (safeSummaryCards.length - 1) * 4) / safeSummaryCards.length;
    safeSummaryCards.forEach((card, i) => {
      const x = 14 + i * (cardW + 4);
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(x, startY, cardW, 18, 2, 2, 'FD');
      doc.setTextColor(100, 116, 139);
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.text(card.label.toUpperCase(), x + 3, startY + 6);
      doc.setTextColor(15, 23, 42);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text(String(card.value), x + 3, startY + 14);
    });
    startY += 26;
  }

  // Build column styles: right-align + explicit widths
  const colStyles = {};
  columnStyles.forEach(i => {
    colStyles[i] = { ...(colStyles[i] || {}), halign: 'right' };
  });
  Object.entries(columnWidths).forEach(([i, w]) => {
    colStyles[Number(i)] = { ...(colStyles[Number(i)] || {}), cellWidth: w };
  });

  const foot = safeTotalsRow ? [safeTotalsRow] : undefined;

  autoTable(doc, {
    startY,
    head: [safeColumns],
    body: safeRows,
    foot,
    styles: { fontSize: 8, cellPadding: 2.5, overflow: 'linebreak' },
    headStyles: { fillColor: [30, 58, 95], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
    footStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold', fontSize: 8 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: colStyles,
    margin: { left: 14, right: 14 },
    showFoot: safeTotalsRow ? 'lastPage' : 'never',
    didDrawPage: (data) => {
      const pageH = doc.internal.pageSize.getHeight();
      doc.setFillColor(30, 58, 95);
      doc.rect(0, pageH - 10, pageW, 10, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.text('Pump House ERP — Confidential Payroll Report', 14, pageH - 3.5);
      doc.text(`Page ${data.pageNumber}`, pageW - 14, pageH - 3.5, { align: 'right' });
    }
  });

  doc.save(`${filename}.pdf`);
}

/** Format a number as Nigerian currency string (no symbol) */
export function fmtN(val) {
  return new Intl.NumberFormat('en-NG', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(val || 0);
}
