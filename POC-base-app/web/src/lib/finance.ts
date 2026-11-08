export const VAT_RATE = 0.18;

export const money = (n: number) => (Math.round(n) || 0).toLocaleString('he-IL') + ' ₪';
export const fmt = (n: number) => (Math.round(n) || 0).toLocaleString('he-IL');

export const calcVat = (base: number) => Math.round(base * VAT_RATE);
export const calcTotal = (base: number) => Math.round(base * (1 + VAT_RATE));

/** תאריך תשלום "שוטף+N" — לתצוגה חיה בטופס (החישוב המחייב מתבצע בשרת). */
export function shotefPlus(dateStr: string, days: number): string {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00Z');
  const eom = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0));
  eom.setUTCDate(eom.getUTCDate() + (days || 0));
  return eom.toISOString().slice(0, 10);
}

/** תאריך בפורמט DD/MM/YYYY לתצוגה (קלט: 'YYYY-MM-DD' או ISO). ריק/לא-תקין → '—'. */
export function dmy(v: string | null | undefined): string {
  if (!v) return '—';
  const s = String(v).slice(0, 10);
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : v;
}

const HEB_MONTHS = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];
export function monthLabel(m: string): string {
  const [y, mo] = m.split('-');
  return `${HEB_MONTHS[Number(mo) - 1] || mo} ${y}`;
}

export const DOCTYPE_CLASS: Record<string, string> = {
  'עסקה': 'dt-esek',
  'מס': 'dt-mas',
  'מס-קבלה': 'dt-masrec',
};
export const DOC_STATUS_CLASS: Record<string, string> = {
  'טיוטה': 'b-gray',
  'נשלח ללקוח': 'b-blue',
  'אושר ע"י לקוח': 'b-purple',
  'טרם שולם': 'b-warn',
  'שולם חלקית': 'b-teal',
  'שולם': 'b-ok',
};

export const STATUS_CLASS: Record<string, string> = {
  'התקבלה': 'b-gray',
  'סווגה': 'b-blue',
  'אושרה לתשלום': 'b-purple',
  'נקלטה בהנה"ח': 'b-teal',
  'צורפה לתזרים': 'b-warn',
  'שולמה': 'b-ok',
};
