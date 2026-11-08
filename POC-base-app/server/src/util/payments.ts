// לוגיקת מועדי תשלום לספקים + מחולל קובץ מס"ב.
// שני מועדי תשלום בכל חודש: ה-15 וה-30 (או סוף החודש אם קצר מ-30).
// חשבונית משויכת למועד הקרוב ביותר שחל בתאריך הפירעון או אחריו (ולא לפני "היום").

export function startOfDayUTC(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/** היום בחודש עבור מועד התשלום השני ("30") — מוגבל לסוף החודש. */
export function secondRunDay(year: number, month0: number): number {
  const eom = new Date(Date.UTC(year, month0 + 1, 0)).getUTCDate();
  return Math.min(30, eom);
}

/** שני מועדי התשלום של חודש נתון. */
export function runsOfMonth(year: number, month0: number): Date[] {
  return [
    new Date(Date.UTC(year, month0, 15)),
    new Date(Date.UTC(year, month0, secondRunDay(year, month0))),
  ];
}

/**
 * שיוך חשבונית למועד תשלום: המועד (15/30) הראשון שחל בתאריך הפירעון או אחריו,
 * אך לא לפני "היום" (חשבוניות בפיגור מנותבות למועד הקרוב הבא).
 */
export function assignRun(dueDate: Date, today: Date): Date {
  const base = dueDate.getTime() > today.getTime() ? dueDate : today;
  const y = base.getUTCFullYear();
  const m = base.getUTCMonth();
  const d = base.getUTCDate();
  if (d <= 15) return new Date(Date.UTC(y, m, 15));
  if (d <= secondRunDay(y, m)) return new Date(Date.UTC(y, m, secondRunDay(y, m)));
  return new Date(Date.UTC(y, m + 1, 15)); // אחרי המועד השני — למועד הראשון של החודש הבא
}

export const iso = (d: Date) => d.toISOString().slice(0, 10);

// ---------- מחולל קובץ מס"ב (מבנה אחיד — נתוני דוגמה) ----------
// הערה: מבנה הרשומות כאן הוא קירוב מתועד. יש לאמת את מיקומי השדות המדויקים
// מול מפרט המס"ב של הבנק/מס"ב לפני שימוש בייצור.

export type MasavRow = {
  bankCode: string;
  branchCode: string;
  bankAccount: string;
  supplierTaxId: string;
  supplierName: string;
  amount: number; // בשקלים
  reference: string; // מספר חשבונית
};
export type MasavConfig = { institutionCode: string; senderName: string; date: Date };

const digits = (v: string) => (v || '').replace(/\D/g, '');
const padNum = (v: string | number, len: number) => digits(String(v)).padStart(len, '0').slice(-len);
const padTxt = (v: string, len: number) => (v || '').slice(0, len).padEnd(len, ' ');
const yymmdd = (d: Date) =>
  padNum(d.getUTCFullYear() % 100, 2) + padNum(d.getUTCMonth() + 1, 2) + padNum(d.getUTCDate(), 2);

const LINE = 128;
const pad128 = (s: string) => (s.length >= LINE ? s.slice(0, LINE) : s.padEnd(LINE, ' '));

// תיאור מבנה הרשומות (לתצוגה בממשק) — אורך רשומה קבוע 128 תווים.
export const MASAV_SPEC = {
  lineLength: LINE,
  records: [
    {
      type: '1', name: 'רשומת כותרת (מוסד שולח)',
      fields: [
        { pos: '1', len: 1, name: 'סוג רשומה', sample: '1' },
        { pos: '2–9', len: 8, name: 'מספר מוסד שולח', sample: '00000000' },
        { pos: '10–15', len: 6, name: 'תאריך יצירה (YYMMDD)', sample: '260802' },
        { pos: '16–45', len: 30, name: 'שם המוסד השולח', sample: '<CompNamePlaceHolder> בעמ' },
      ],
    },
    {
      type: '2', name: 'רשומת תשלום (זיכוי ספק)',
      fields: [
        { pos: '1', len: 1, name: 'סוג רשומה', sample: '2' },
        { pos: '2–3', len: 2, name: 'קוד בנק', sample: '12' },
        { pos: '4–6', len: 3, name: 'קוד סניף', sample: '345' },
        { pos: '7–15', len: 9, name: 'מספר חשבון', sample: '000456789' },
        { pos: '16–24', len: 9, name: 'ח.פ / ע.מ של הספק', sample: '514200001' },
        { pos: '25–44', len: 20, name: 'שם הספק', sample: 'פלסטופלן בע"מ' },
        { pos: '45–57', len: 13, name: 'סכום באגורות', sample: '0000009912000' },
        { pos: '58–77', len: 20, name: 'אסמכתא (מספר חשבונית)', sample: 'A-99120' },
      ],
    },
    {
      type: '5', name: 'רשומת סיכום',
      fields: [
        { pos: '1', len: 1, name: 'סוג רשומה', sample: '5' },
        { pos: '2–8', len: 7, name: 'מספר תנועות', sample: '0000003' },
        { pos: '9–23', len: 15, name: 'סכום כולל באגורות', sample: '000000023777000' },
      ],
    },
  ],
};

export function buildMasav(rows: MasavRow[], cfg: MasavConfig): { content: string; count: number; totalAgorot: number } {
  const lines: string[] = [];
  // רשומת כותרת (סוג 1): מוסד שולח + תאריך יצירה + שם
  lines.push(pad128('1' + padNum(cfg.institutionCode, 8) + yymmdd(cfg.date) + padTxt(cfg.senderName, 30)));

  let totalAgorot = 0;
  for (const r of rows) {
    const agorot = Math.round(r.amount * 100);
    totalAgorot += agorot;
    // רשומת תשלום (סוג 2): בנק(2) סניף(3) חשבון(9) ח.פ(9) שם(20) סכום-באגורות(13) אסמכתא(20)
    lines.push(
      pad128(
        '2' +
          padNum(r.bankCode, 2) +
          padNum(r.branchCode, 3) +
          padNum(r.bankAccount, 9) +
          padNum(r.supplierTaxId, 9) +
          padTxt(r.supplierName, 20) +
          padNum(agorot, 13) +
          padTxt(r.reference, 20)
      )
    );
  }
  // רשומת סיכום (סוג 5): מספר תנועות + סכום כולל באגורות
  lines.push(pad128('5' + padNum(rows.length, 7) + padNum(totalAgorot, 15)));

  return { content: lines.join('\r\n') + '\r\n', count: rows.length, totalAgorot };
}
