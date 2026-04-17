const EXPORT_COLUMNS = [
  { title: 'Student Name', key: 'studentName' },
  { title: 'Student ID', key: 'studentId' },
  { title: 'Department', key: 'department' },
  { title: 'Hall ID', key: 'hallId' },
  { title: 'Mobile Number', key: 'mobileNumber' },
  { title: 'Level / Year', key: 'level' },
  { title: 'Session Year', key: 'sessionYear' },
  { title: 'Hall Name', key: 'hallName' },
  { title: 'Admission Date', key: 'admissionDate' },
  { title: 'Hall Validity End Date', key: 'hallValidityEndDate' },
  { title: 'Status', key: 'status' },
];

const EXCEL_TEXT_FIELDS = new Set([
  'studentId',
  'hallId',
  'mobileNumber',
  'admissionDate',
  'hallValidityEndDate',
  'sessionYear',
]);

function safeCell(value) {
  return String(value ?? '-');
}

function normalizeExportValue(value, key) {
  const raw = safeCell(value);

  if (raw === '-') {
    return '';
  }

  if ((key === 'admissionDate' || key === 'hallValidityEndDate') && raw.includes('T')) {
    return raw.split('T')[0];
  }

  return raw;
}

function mapStudentsToRows(students = []) {
  return students.map((student) =>
    EXPORT_COLUMNS.map((column) => normalizeExportValue(student[column.key], column.key)),
  );
}

function getDateSuffix() {
  return new Date().toISOString().slice(0, 10);
}

function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function escapeCsv(value) {
  const raw = safeCell(value);
  if (/[",\n]/.test(raw)) {
    return `"${raw.replace(/"/g, '""')}"`;
  }
  return raw;
}

export function exportStudentsToCsv(students = []) {
  const header = EXPORT_COLUMNS.map((column) => column.title).join(',');
  const lines = students.map((student) =>
    EXPORT_COLUMNS
      .map((column) => {
        const normalized = normalizeExportValue(student[column.key], column.key);
        if (!normalized) {
          return '';
        }

        if (EXCEL_TEXT_FIELDS.has(column.key)) {
          return escapeCsv(`="${normalized.replace(/"/g, '""')}"`);
        }

        return escapeCsv(normalized);
      })
      .join(','),
  );
  const csv = [header, ...lines].join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  downloadBlob(blob, `student-list-${getDateSuffix()}.csv`);
}

export async function exportStudentsToExcel(students = []) {
  const XLSX = await import('xlsx');

  const aoa = [
    EXPORT_COLUMNS.map((column) => column.title),
    ...students.map((student) =>
      EXPORT_COLUMNS.map((column) => normalizeExportValue(student[column.key], column.key)),
    ),
  ];

  const worksheet = XLSX.utils.aoa_to_sheet(aoa);
  worksheet['!cols'] = [
    { wch: 24 },
    { wch: 16 },
    { wch: 14 },
    { wch: 14 },
    { wch: 16 },
    { wch: 12 },
    { wch: 12 },
    { wch: 24 },
    { wch: 16 },
    { wch: 20 },
    { wch: 14 },
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Student List');
  XLSX.writeFile(workbook, `student-list-${getDateSuffix()}.xlsx`);
}

export function exportStudentsToWord(students = []) {
  const headerCells = EXPORT_COLUMNS.map((column) => `<th>${column.title}</th>`).join('');
  const rowHtml = students
    .map((student) => {
      const cells = EXPORT_COLUMNS.map((column) => `<td>${safeCell(student[column.key])}</td>`).join('');
      return `<tr>${cells}</tr>`;
    })
    .join('');

  const html = `
<html>
<head>
  <meta charset="utf-8" />
  <title>Student List Export</title>
  <style>
    body { font-family: Segoe UI, Arial, sans-serif; }
    h2 { margin-bottom: 12px; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th, td { border: 1px solid #d0d7e2; padding: 6px; text-align: left; }
    th { background: #f4f7ff; }
  </style>
</head>
<body>
  <h2>Student List Export</h2>
  <table>
    <thead><tr>${headerCells}</tr></thead>
    <tbody>${rowHtml}</tbody>
  </table>
</body>
</html>`;

  const blob = new Blob(['\ufeff', html], { type: 'application/msword;charset=utf-8' });
  downloadBlob(blob, `student-list-${getDateSuffix()}.doc`);
}

export async function exportStudentsToPdf(students = []) {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);

  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  const head = [EXPORT_COLUMNS.map((column) => column.title)];
  const body = mapStudentsToRows(students);

  doc.setFontSize(12);
  doc.text('Student List Export', 40, 30);

  autoTable(doc, {
    head,
    body,
    startY: 42,
    styles: { fontSize: 8, cellPadding: 3 },
    headStyles: { fillColor: [79, 70, 229] },
    margin: { left: 20, right: 20 },
  });

  doc.save(`student-list-${getDateSuffix()}.pdf`);
}

export function printStudents(students = []) {
  const header = EXPORT_COLUMNS.map((column) => `<th>${column.title}</th>`).join('');
  const rows = students
    .map((student) => {
      const cells = EXPORT_COLUMNS.map((column) => `<td>${safeCell(student[column.key])}</td>`).join('');
      return `<tr>${cells}</tr>`;
    })
    .join('');

  const html = `
<html>
<head>
  <title>Student List Print</title>
  <style>
    body { font-family: Segoe UI, Arial, sans-serif; margin: 20px; }
    h2 { margin-bottom: 10px; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; }
    th, td { border: 1px solid #d0d7e2; padding: 5px; text-align: left; }
    th { background: #f4f7ff; }
  </style>
</head>
<body>
  <h2>Student List</h2>
  <table>
    <thead><tr>${header}</tr></thead>
    <tbody>${rows}</tbody>
  </table>
</body>
</html>`;

  const printWindow = window.open('', '_blank', 'noopener,noreferrer,width=1200,height=700');
  if (!printWindow) {
    throw new Error('Pop-up blocked. Please allow pop-ups to print the list.');
  }

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
  printWindow.close();
}
