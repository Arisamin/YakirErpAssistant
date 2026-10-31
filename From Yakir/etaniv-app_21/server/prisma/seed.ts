import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { env } from '../src/env';
import { SUPPLIERS_REAL, CUSTOMERS_REAL } from './real-accounts';

const prisma = new PrismaClient();

// תפקידים
const ROLES = [
  { key: 'admin', name: 'מנהל מערכת' },
  { key: 'finance', name: 'הנהלת חשבונות / כספים' },
  { key: 'pm', name: 'מנהל פרויקט' },
  { key: 'viewer', name: 'צפייה בלבד' },
];

const MENUS = ['overview', 'suppliers', 'labor', 'contracts', 'docs', 'collections', 'reports', 'import', 'permissions'];

// מטריצת הרשאות: [view, write, delete] לכל [role][menu] — תואם למסמך האפיון
// v=view, w=write, d=delete
const M = (v: boolean, w: boolean, d: boolean) => ({ canView: v, canWrite: w, canDelete: d });
const PERMS: Record<string, Record<string, ReturnType<typeof M>>> = {
  admin: Object.fromEntries(MENUS.map((m) => [m, M(true, true, true)])),
  finance: {
    overview: M(true, false, false),
    suppliers: M(true, true, false),
    labor: M(true, false, false),
    contracts: M(true, true, false),
    docs: M(true, true, false),
    collections: M(true, true, false),
    reports: M(true, false, false),
    import: M(true, true, false),
    permissions: M(false, false, false),
  },
  pm: {
    overview: M(true, false, false),
    suppliers: M(true, true, false),
    labor: M(true, true, false),
    contracts: M(true, false, false),
    docs: M(true, false, false),
    collections: M(true, false, false),
    reports: M(true, false, false),
    import: M(false, false, false),
    permissions: M(false, false, false),
  },
  viewer: {
    overview: M(true, false, false),
    suppliers: M(true, false, false),
    labor: M(true, false, false),
    contracts: M(true, false, false),
    docs: M(true, false, false),
    collections: M(true, false, false),
    reports: M(true, false, false),
    import: M(false, false, false),
    permissions: M(false, false, false),
  },
};

const EXPENSE_TYPES = ['פלסטיקה', 'צנרת', 'מחשוב', 'תוכנה', 'בקרה', 'חשמל', 'עבודות קבלן', 'שונות'];
const PROJECTS = [
  { code: '101', name: 'מתחם מגורים A', costBudget: 2400000 },
  { code: '102', name: 'קו ייצור B', costBudget: 1350000 },
  { code: '103', name: 'שדרוג מערכת מים', costBudget: 680000 },
];

async function main() {
  console.log('זריעת נתונים...');

  // תפקידים + הרשאות
  for (const r of ROLES) {
    const role = await prisma.role.upsert({
      where: { key: r.key },
      update: { name: r.name },
      create: { key: r.key, name: r.name },
    });
    for (const menu of MENUS) {
      const p = PERMS[r.key][menu];
      await prisma.permission.upsert({
        where: { roleId_menuKey: { roleId: role.id, menuKey: menu } },
        update: p,
        create: { roleId: role.id, menuKey: menu, ...p },
      });
    }
  }
  console.log(`  ✓ ${ROLES.length} תפקידים ומטריצת הרשאות`);

  // סוגי הוצאה
  for (const name of EXPENSE_TYPES) {
    await prisma.expenseType.upsert({ where: { name }, update: {}, create: { name } });
  }
  console.log(`  ✓ ${EXPENSE_TYPES.length} סוגי הוצאה`);

  // הגדרות שדות חובה לאישור חשבונית ספק — ניתן לעריכה ע"י מנהל המערכת
  const FIELD_SETTINGS = [
    { fieldKey: 'matched', label: 'התאמה להזמנת רכש ותעודת משלוח (3-way match)', required: true, sortOrder: 1 },
    { fieldKey: 'lines', label: 'סיווג לפרויקט (שורת חשבונית)', required: true, sortOrder: 2 },
    { fieldKey: 'purchaseOrderNo', label: 'מספר הזמנת רכש', required: false, sortOrder: 3 },
    { fieldKey: 'deliveryNoteNo', label: 'מספר תעודת משלוח', required: false, sortOrder: 4 },
    { fieldKey: 'selfInvoiceNo', label: 'מספר חשבונית עצמית', required: false, sortOrder: 5 },
    { fieldKey: 'notes', label: 'הערות', required: false, sortOrder: 6 },
  ];
  for (const f of FIELD_SETTINGS) {
    await prisma.invoiceFieldSetting.upsert({
      where: { fieldKey: f.fieldKey },
      update: { label: f.label, sortOrder: f.sortOrder }, // לא דורסים את בחירת המנהל ב-required
      create: f,
    });
  }
  console.log(`  ✓ ${FIELD_SETTINGS.length} הגדרות שדות חובה`);

  // הגדרות ארגון (מס"ב + יתרת פתיחה לתזרים) — רשומה יחידה
  const orgExists = await prisma.orgSetting.findFirst();
  if (!orgExists) {
    await prisma.orgSetting.create({ data: { masavInstitutionCode: '00000000', masavSenderName: 'אתניב ב.י בעמ', openingBalance: 250000 } });
  }
  console.log('  ✓ הגדרות ארגון (מס"ב)');

  // ספקים — רשימה אמיתית מדוח אינדקס החשבונות בחשבשבת (מפתח חשבון + ע.מ). מע"מ ברירת מחדל 18%.
  {
    const existing = new Set((await prisma.supplier.findMany({ select: { hhAccountKey: true } })).map((s: { hhAccountKey: string | null }) => s.hhAccountKey));
    const toCreate = SUPPLIERS_REAL.filter((s) => !existing.has(s.k)).map((s) => ({ name: s.n, hhAccountKey: s.k, taxId: s.t || null, vatRate: 18 }));
    if (toCreate.length) await prisma.supplier.createMany({ data: toCreate });
    console.log(`  ✓ ${toCreate.length} ספקים (מתוך ${SUPPLIERS_REAL.length} ברשימה)`);
  }

  // לקוחות — רשימה אמיתית מדוח אינדקס החשבונות בחשבשבת.
  {
    const existing = new Set((await prisma.customer.findMany({ select: { name: true } })).map((c: { name: string }) => c.name));
    const toCreate = CUSTOMERS_REAL.filter((c) => !existing.has(c.n)).map((c) => ({ name: c.n, taxId: c.t || null }));
    if (toCreate.length) await prisma.customer.createMany({ data: toCreate });
    console.log(`  ✓ ${toCreate.length} לקוחות (מתוך ${CUSTOMERS_REAL.length} ברשימה)`);
  }

  // פרויקטים
  for (const p of PROJECTS) {
    await prisma.project.upsert({ where: { code: p.code }, update: p, create: p });
  }
  console.log(`  ✓ ${PROJECTS.length} פרויקטים`);

  // עובדים
  const WORKERS = [
    { name: 'יוסי לוי', role: 'מסגר', dailyCost: 950 },
    { name: 'אחמד ותד', role: 'רתך', dailyCost: 900 },
    { name: 'דוד כהן', role: 'חשמלאי', dailyCost: 1100 },
    { name: 'סרגיי פבלוב', role: 'טכנאי בקרה', dailyCost: 1050 },
    { name: 'מוחמד עבד', role: 'עוזר', dailyCost: 650 },
  ];
  const workerIds: Record<string, string> = {};
  for (const w of WORKERS) {
    let worker = await prisma.worker.findFirst({ where: { name: w.name } });
    if (!worker) worker = await prisma.worker.create({ data: w });
    workerIds[w.name] = worker.id;
  }
  console.log(`  ✓ ${WORKERS.length} עובדים`);

  // ימי עבודה (עובד → פרויקט → ימים) לפי חודש
  const WORKDAYS: Record<string, Record<string, Record<string, number>>> = {
    '2026-07': {
      'יוסי לוי': { '101': 12, '102': 8 }, 'אחמד ותד': { '101': 15, '102': 5 },
      'דוד כהן': { '103': 10, '101': 6 }, 'סרגיי פבלוב': { '102': 14 }, 'מוחמד עבד': { '101': 9, '103': 8 },
    },
    '2026-06': {
      'יוסי לוי': { '101': 10, '102': 10 }, 'אחמד ותד': { '101': 18 },
      'דוד כהן': { '103': 12 }, 'סרגיי פבלוב': { '102': 16, '103': 4 }, 'מוחמד עבד': { '101': 12, '102': 6 },
    },
  };
  let wdCount = 0;
  for (const [month, byWorker] of Object.entries(WORKDAYS)) {
    for (const [wName, cells] of Object.entries(byWorker)) {
      for (const [code, days] of Object.entries(cells)) {
        const project = await prisma.project.findUniqueOrThrow({ where: { code } });
        await prisma.workday.upsert({
          where: { workerId_projectId_month: { workerId: workerIds[wName], projectId: project.id, month } },
          update: { days },
          create: { workerId: workerIds[wName], projectId: project.id, month, days },
        });
        wdCount++;
      }
    }
  }
  console.log(`  ✓ ${wdCount} רשומות ימי עבודה`);

  // משתמש מנהל
  const adminRole = await prisma.role.findUniqueOrThrow({ where: { key: 'admin' } });
  const passwordHash = await bcrypt.hash(env.admin.password, 12);
  await prisma.user.upsert({
    where: { email: env.admin.email },
    update: { name: env.admin.name, roleId: adminRole.id, status: 'APPROVED' },
    create: {
      name: env.admin.name,
      email: env.admin.email,
      passwordHash,
      roleId: adminRole.id,
      status: 'APPROVED',
    },
  });
  console.log(`  ✓ משתמש מנהל: ${env.admin.email}`);
  console.log('הזריעה הושלמה בהצלחה.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
