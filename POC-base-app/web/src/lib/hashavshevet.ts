import * as XLSX from 'xlsx';
import type { HhRow } from '../types';

// בונה ומוריד את קובץ האקסל לייבוא לחשבשבת, במבנה התבנית:
// גיליון "חשבוניות ספקים", עמודות: ספק | תאריך אסמכתא | אסמכתא | פרויקט | פרטים | חובה | תאריך ערך.
// עמודות טקסט: הכל למעט "חובה" (מספר). מוגדר שם-טווח "חשבוניותספקים".
export function downloadHashavshevetXlsx(rows: HhRow[], batch: string) {
  const header = ['ספק', 'תאריך אסמכתא', 'אסמכתא', 'פרויקט', 'פרטים', 'חובה', 'תאריך ערך'];
  const aoa: (string | number)[][] = [header];
  rows.forEach((r) => aoa.push([r.supplierKey, r.date, r.reference, r.project, r.details, r.debit, r.valueDate]));

  const ws = XLSX.utils.aoa_to_sheet(aoa);

  // אכיפת סוג טקסט לכל העמודות למעט "חובה" (עמודה F, אינדקס 5)
  const textCols = [0, 1, 2, 3, 4, 6];
  for (let r = 1; r <= rows.length; r++) {
    for (const c of textCols) {
      const addr = XLSX.utils.encode_cell({ r, c });
      const cell = ws[addr];
      if (cell) { cell.t = 's'; cell.z = '@'; cell.v = String(cell.v ?? ''); }
    }
    const fAddr = XLSX.utils.encode_cell({ r, c: 5 });
    if (ws[fAddr]) ws[fAddr].t = 'n';
  }
  ws['!cols'] = [{ wch: 12 }, { wch: 13 }, { wch: 14 }, { wch: 10 }, { wch: 22 }, { wch: 12 }, { wch: 13 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'חשבוניות ספקים');
  wb.Workbook = { Names: [{ Name: 'חשבוניותספקים', Ref: `'חשבוניות ספקים'!$A$1:$G$${rows.length + 1}` }] };

  XLSX.writeFile(wb, `חשבוניות_ספקים_לחשבשבת_${batch}.xlsx`);
}
