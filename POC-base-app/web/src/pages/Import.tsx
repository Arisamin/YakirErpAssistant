import { useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';

type Importer = {
  key: string;
  title: string;
  desc: string;
  cols: string[];
  map: (r: any[]) => any;
  example: (string | number)[];
};

const IMPORTERS: Importer[] = [
  {
    key: 'projects', title: 'פרויקטים', desc: 'רשימת מספרי הפרויקטים ותקציב העלות שלהם',
    cols: ['מספר פרויקט', 'שם פרויקט', 'תקציב עלות'],
    map: (r) => ({ code: String(r[0]).trim(), name: String(r[1] ?? '').trim(), costBudget: Number(r[2]) || 0 }),
    example: ['104', 'מבנה משרדים C', 1200000],
  },
  {
    key: 'suppliers', title: 'ספקים', desc: 'רשימת ספקים עם ברירת מחדל לסוג הוצאה ותנאי תשלום',
    cols: ['שם ספק', 'סוג הוצאה', 'תנאי תשלום (ימים)'],
    map: (r) => ({ name: String(r[0]).trim(), expenseType: r[1] ? String(r[1]).trim() : undefined, terms: r[2] ? String(r[2]) : undefined }),
    example: ['ספק חדש בע"מ', 'צנרת', '30'],
  },
  {
    key: 'contracts', title: 'לקוחות וחוזים', desc: 'חוזי לקוחות משויכים לפרויקט, כולל תנאי תשלום ועכבון',
    cols: ['מספר חוזה', 'לקוח', 'מספר פרויקט', 'ערך חוזה', 'תנאי תשלום', 'עכבון %'],
    map: (r) => ({ code: String(r[0]).trim(), customer: String(r[1] ?? '').trim(), project: String(r[2] ?? '').replace(/[^0-9]/g, ''), value: Number(r[3]) || 0, terms: r[4] ? String(r[4]) : undefined, retention: Number(r[5]) || 0 }),
    example: ['C-26-050', 'לקוח חדש', '104', 800000, '60', 5],
  },
];

export default function Import() {
  const { can } = useAuth();
  const canWrite = can('import', 'write');
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const [results, setResults] = useState<Record<string, string>>({});

  function downloadTemplate(im: Importer) {
    const ws = XLSX.utils.aoa_to_sheet([im.cols, im.example]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, im.title);
    XLSX.writeFile(wb, `תבנית_${im.title}.xlsx`);
  }

  async function onUpload(e: React.ChangeEvent<HTMLInputElement>, im: Importer) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const grid = XLSX.utils.sheet_to_json<any[]>(wb.Sheets[wb.SheetNames[0]], { header: 1 });
      const rows = grid.slice(1).filter((r) => r && r.some((c) => c !== undefined && c !== '')).map(im.map).filter((x) => x.code || x.name);
      const res = await api.importData(im.key, rows);
      setResults((s) => ({ ...s, [im.key]: `✓ נקלטו ${res.total} שורות — ${res.created} נוצרו, ${res.updated} עודכנו${res.skipped ? `, ${res.skipped} דולגו` : ''}.` }));
    } catch (err) {
      setResults((s) => ({ ...s, [im.key]: '✗ שגיאה: ' + (err as Error).message }));
    } finally {
      if (fileRefs.current[im.key]) fileRefs.current[im.key]!.value = '';
    }
  }

  return (
    <>
      <h2 className="title">ייבוא נתונים מאקסל</h2>
      <p className="sub2">העלאת קבצי אקסל לריכוז פרויקטים, לקוחות, חוזים וספקים — ללא הקלדה ידנית</p>

      {!canWrite && <div className="ro-badge">🔒 צפייה בלבד — אין לך הרשאת ייבוא</div>}

      <div className="flow-steps">
        <div className="flow-step"><b>הורדת תבנית</b><span>הורד קובץ אקסל עם העמודות המדויקות לכל סוג נתון</span></div>
        <div className="flow-step"><b>מילוי הנתונים</b><span>מלא או הדבק את הנתונים שלך בעמודות התבנית</span></div>
        <div className="flow-step"><b>העלאה ובדיקה</b><span>העלה את הקובץ — המערכת בודקת תקינות ומזהה כפילויות</span></div>
        <div className="flow-step"><b>קליטה למערכת</b><span>הרשומות התקינות נקלטות ומשויכות למספרי הפרויקט</span></div>
      </div>

      <div className="import-grid">
        {IMPORTERS.map((im) => (
          <div className="imp-card" key={im.key}>
            <h4>{im.title}</h4>
            <div className="d">{im.desc}</div>
            <div className="cols"><b>עמודות הקובץ:</b><br />{im.cols.join(' · ')}</div>
            <div className="imp-actions">
              <button className="btn ghost sm" onClick={() => downloadTemplate(im)}>⭳ תבנית</button>
              {canWrite && (
                <label className="btn sm" style={{ cursor: 'pointer' }}>
                  ⭱ העלה קובץ
                  <input ref={(el) => { fileRefs.current[im.key] = el; }} type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }} onChange={(e) => onUpload(e, im)} />
                </label>
              )}
            </div>
            {results[im.key] && <div className="imp-result" style={{ color: results[im.key].startsWith('✓') ? 'var(--green)' : 'var(--red)' }}>{results[im.key]}</div>}
          </div>
        ))}
      </div>

      <p className="sub2" style={{ marginTop: 16, fontSize: 12 }}>
        💡 ימי עבודה חודשיים מיובאים ממסך "עבודה ועובדים". בגרסת הייצור, כל קובץ שמועלה נסרק לווירוסים לפני עיבוד, והייבוא נרשם ביומן הביקורת עם שם המשתמש והזמן.
      </p>
    </>
  );
}
