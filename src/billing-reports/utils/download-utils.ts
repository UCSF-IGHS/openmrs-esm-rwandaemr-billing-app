import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

/**
 * Exports report data to Excel file.
 */
export function exportToExcel(
  columns: string[],
  results: any[],
  getValue: (record: any[], column: string) => string,
  filename = 'report.xlsx',
) {
  const data = results.map((row, index) => {
    const rowData: Record<string, string> = { No: String(index + 1) };
    columns.forEach((col) => {
      rowData[col] = getValue(row.record, col);
    });
    return rowData;
  });

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Report');
  XLSX.writeFile(wb, filename);
}

/**
 * Exports report data to PDF file.
 */
export function exportSingleRecordToPDF(record, filename = 'record-details.pdf') {
  const doc = new jsPDF({ orientation: 'landscape' });

  const fieldsPerRow = 2;
  const rows = [];
  let tempRow = [];

  record.forEach((item, index) => {
    const label = item.column;
    const value = Array.isArray(item.value) ? item.value.join(', ') : item.value;

    tempRow.push(`${label}: ${value}`);

    if ((index + 1) % fieldsPerRow === 0) {
      rows.push(tempRow);
      tempRow = [];
    }
  });

  if (tempRow.length > 0) {
    rows.push(tempRow);
  }

  autoTable(doc, {
    head: [['Record Details']],
    body: [],
    startY: 10,
    theme: 'plain',
    styles: {
      fontSize: 14,
      textColor: [41, 128, 185],
      halign: 'center',
    },
    headStyles: {
      fontStyle: 'bold',
    },
    didDrawCell: (data) => {},
  });

  autoTable(doc, {
    body: rows,
    startY: 25,
    theme: 'grid',
    styles: {
      fontSize: 9,
      cellPadding: 4,
      valign: 'top',
    },
    headStyles: {
      fillColor: [41, 128, 185],
      textColor: 255,
      fontSize: 10,
    },
    bodyStyles: {
      fillColor: [245, 245, 245],
      textColor: [50, 50, 50],
    },
    margin: { top: 20, left: 10, right: 10 },
  });

  doc.save(filename);
}

//format date example from 	2023-1-1-0-9-54 to 2022-12-31 21:09:54

export function formatValue(value: any): string {
  if (typeof value === 'number' && String(value).length >= 10) {
    const date = new Date(value);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0]; // YYYY-MM-DD
    }
  }

  // If it's an array that looks like a date [YYYY, MM, DD, HH, mm, ss]
  if (Array.isArray(value) && value.length >= 3 && typeof value[0] === 'number' && typeof value[1] === 'number') {
    const [year, month, day, hour = 0, minute = 0, second = 0] = value;
    const date = new Date(year, month - 1, day, hour, minute, second);
    return date.toISOString().replace('T', ' ').split('.')[0]; // YYYY-MM-DD HH:MM:SS
  }

  if (Array.isArray(value)) {
    return value.join(', ');
  }

  return String(value);
}
