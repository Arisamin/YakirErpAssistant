// בניית שורות לייצוא חשבוניות ספק לחשבשבת (מבנה: ספק | תאריך | אסמכתא | פרויקט | פרטים | חובה).
// שורה נפרדת לכל שיוך פרויקט בחשבונית; סכום "חובה" לפני מע"מ; "ספק" = מפתח חשבון בחשבשבת.

export function dmy(d: Date): string {
  const day = String(d.getUTCDate()).padStart(2, '0');
  const mon = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${day}/${mon}/${d.getUTCFullYear()}`;
}

export type HhRow = {
  supplierKey: string; // מפתח חשבון בחשבשבת (עמודת "ספק")
  supplierName: string; // לתצוגה בלבד
  date: string; // DD/MM/YYYY — תאריך החשבונית (עמודת "תאריך אסמכתא")
  valueDate: string; // DD/MM/YYYY — מועד התשלום לפי תנאי התשלום (עמודת "תאריך ערך")
  reference: string; // מספר חשבונית (עמודת "אסמכתא")
  project: string; // קוד פרויקט (עמודת "פרויקט")
  details: string; // סוג הוצאה (עמודת "פרטים")
  debit: number; // סכום לפני מע"מ (עמודת "חובה")
};

// בונה את שורות הייצוא ואת רשימת הספקים החסרים מפתח חשבשבת (חוסמים ייצוא).
export function buildHashavshevetRows(invoices: any[]): { rows: HhRow[]; missingKey: string[] } {
  const rows: HhRow[] = [];
  const missing = new Set<string>();
  for (const inv of invoices) {
    const key = inv.supplier?.hhAccountKey?.trim();
    if (!key) missing.add(inv.supplier?.name ?? '—');
    const valueDate = inv.payDate ? dmy(inv.payDate) : '';
    for (const l of inv.lines) {
      rows.push({
        supplierKey: key || '',
        supplierName: inv.supplier?.name ?? '—',
        date: dmy(inv.invoiceDate),
        valueDate,
        reference: inv.invoiceNo,
        project: l.project?.code ?? '',
        details: l.expenseType ?? '',
        debit: Number(l.amount),
      });
    }
  }
  return { rows, missingKey: [...missing] };
}
