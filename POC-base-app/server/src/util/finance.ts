// חישובים פיננסיים משותפים — נאכפים בשרת כדי שלא ניתן יהיה לזייף מהלקוח.

export const VAT_RATE = 0.18;

export function calcVat(base: number): number {
  return Math.round(base * VAT_RATE);
}
export function calcTotal(base: number): number {
  return Math.round(base * (1 + VAT_RATE));
}

/**
 * תאריך תשלום בשיטת "שוטף+N": סוף חודש החשבונית ועוד N ימים.
 * מחושב ב-UTC כדי למנוע הזזות אזור-זמן.
 */
export function shotefPlus(invoiceDate: Date, days: number): Date {
  const eom = new Date(Date.UTC(invoiceDate.getUTCFullYear(), invoiceDate.getUTCMonth() + 1, 0));
  eom.setUTCDate(eom.getUTCDate() + days);
  return eom;
}

/** גזירת סטטוס החשבונית מהדגלים — תואם ללוגיקת האב-טיפוס. */
export function invoiceStatus(v: {
  approved: boolean;
  recordedHh: boolean;
  inCashflow: boolean;
  paid: boolean;
  lines: { projectId: string; expenseType: string }[];
}): string {
  if (v.paid) return 'שולמה';
  if (v.inCashflow) return 'צורפה לתזרים';
  if (v.recordedHh) return 'נקלטה בהנה"ח';
  if (v.approved) return 'אושרה לתשלום';
  if (v.lines.length > 0 && v.lines.every((l) => l.projectId && l.expenseType)) return 'סווגה';
  return 'התקבלה';
}
