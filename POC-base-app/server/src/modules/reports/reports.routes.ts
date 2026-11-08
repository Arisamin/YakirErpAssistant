import { Router } from 'express';
import { prisma } from '../../db';
import { authGuard } from '../../middleware/auth';
import { requirePermission } from '../../middleware/rbac';
import { calcVat, calcTotal, shotefPlus } from '../../util/finance';
import { iso } from '../../util/payments';

export const reportsRouter = Router();
const N = (x: unknown) => Number(x);

function todayUTC(): number {
  const n = new Date();
  return Date.UTC(n.getFullYear(), n.getMonth(), n.getDate());
}
function docNet(base: number, retentionPct: number, isTax: boolean, offsets: number) {
  const gross = calcTotal(base);
  const retention = isTax ? Math.round((base * retentionPct) / 100) : 0;
  return { gross, retention, net: gross - retention - offsets };
}

// דוח חיתוך פרויקט
reportsRouter.get('/project/:projectId', authGuard, requirePermission('reports', 'view'), async (req, res, next) => {
  try {
    const project = await prisma.project.findUnique({ where: { id: req.params.projectId } });
    if (!project) return res.status(404).json({ error: 'פרויקט לא נמצא' });
    const contracts = await prisma.contract.findMany({ where: { projectId: project.id }, include: { customer: true } });
    const contractIds = contracts.map((c: { id: string }) => c.id);
    const docs = await prisma.billingDoc.findMany({ where: { contractId: { in: contractIds } }, include: { offsets: true, contract: { include: { customer: true } } } });
    const lines = await prisma.invoiceLine.findMany({ where: { projectId: project.id } });
    const workdays = await prisma.workday.findMany({ where: { projectId: project.id }, include: { worker: true } });

    const incomeDocs = docs
      .filter((d: { type: string }) => d.type !== 'ESEK')
      .map((d: any) => ({ number: d.number, customer: d.contract.customer.name, date: d.issueDate.toISOString().slice(0, 10), base: N(d.amountBeforeVat), vat: calcVat(N(d.amountBeforeVat)), gross: calcTotal(N(d.amountBeforeVat)), paid: N(d.paidAmount), open: d.status === 'שולם' ? 0 : Math.max(0, docNet(N(d.amountBeforeVat), N(d.retentionPct), true, d.offsets.reduce((s: number, o: any) => s + N(o.amount), 0)).net - N(d.paidAmount)), status: d.status }));
    const income = incomeDocs.reduce((s: number, d: { base: number }) => s + d.base, 0);

    const matMap = new Map<string, number>();
    for (const l of lines as { expenseType: string; amount: unknown }[]) matMap.set(l.expenseType, (matMap.get(l.expenseType) ?? 0) + N(l.amount));
    const materials = [...matMap.entries()].map(([type, amount]) => ({ type, amount })).sort((a, b) => b.amount - a.amount);
    const matTotal = materials.reduce((s, m) => s + m.amount, 0);

    const labMap = new Map<string, { name: string; role: string; dailyCost: number; days: number }>();
    for (const wd of workdays as any[]) {
      const cur = labMap.get(wd.workerId) ?? { name: wd.worker.name, role: wd.worker.role ?? '', dailyCost: N(wd.worker.dailyCost), days: 0 };
      cur.days += N(wd.days);
      labMap.set(wd.workerId, cur);
    }
    const labor = [...labMap.values()].map((w) => ({ ...w, total: w.days * w.dailyCost }));
    const labTotal = labor.reduce((s, w) => s + w.total, 0);

    const cost = matTotal + labTotal;
    const profit = income - cost;
    const contractVal = contracts.reduce((s: number, c: { value: unknown }) => s + N(c.value), 0);
    const billedGross = incomeDocs.reduce((s: number, d: { gross: number }) => s + d.gross, 0);
    const collected = incomeDocs.reduce((s: number, d: { paid: number }) => s + d.paid, 0);

    res.json({
      project: { code: project.code, name: project.name, costBudget: N(project.costBudget) },
      incomeDocs, income, materials, matTotal, labor, labTotal, cost, profit,
      margin: income ? (profit / income) * 100 : 0, contractVal, billedGross, collected,
    });
  } catch (err) {
    next(err);
  }
});

// דוח סיכום כל הפרויקטים
reportsRouter.get('/summary', authGuard, requirePermission('reports', 'view'), async (_req, res, next) => {
  try {
    const [projects, lines, docs, workdays, workers] = await Promise.all([
      prisma.project.findMany({ orderBy: { code: 'asc' } }),
      prisma.invoiceLine.findMany(),
      prisma.billingDoc.findMany({ include: { contract: true } }),
      prisma.workday.findMany(),
      prisma.worker.findMany(),
    ]);
    const dc = new Map<string, number>(workers.map((w: any) => [w.id, N(w.dailyCost)]));
    const mat = new Map<string, number>(), inc = new Map<string, number>(), lab = new Map<string, number>();
    for (const l of lines as any[]) mat.set(l.projectId, (mat.get(l.projectId) ?? 0) + N(l.amount));
    for (const d of docs as any[]) { if (d.type === 'ESEK') continue; const p = d.contract.projectId; inc.set(p, (inc.get(p) ?? 0) + N(d.amountBeforeVat)); }
    for (const wd of workdays as any[]) lab.set(wd.projectId, (lab.get(wd.projectId) ?? 0) + N(wd.days) * (dc.get(wd.workerId) ?? 0));
    let tI = 0, tM = 0, tL = 0, tB = 0;
    const rows = (projects as any[]).map((p) => {
      const income = inc.get(p.id) ?? 0, materials = mat.get(p.id) ?? 0, labor = lab.get(p.id) ?? 0, cost = materials + labor, profit = income - cost, budget = N(p.costBudget);
      tI += income; tM += materials; tL += labor; tB += budget;
      return { code: p.code, name: p.name, income, materials, labor, cost, profit, margin: income ? (profit / income) * 100 : 0, budget, utilization: budget ? (cost / budget) * 100 : 0 };
    });
    const tC = tM + tL, tP = tI - tC;
    res.json({ rows, totals: { income: tI, materials: tM, labor: tL, cost: tC, profit: tP, margin: tI ? (tP / tI) * 100 : 0, budget: tB, utilization: tB ? (tC / tB) * 100 : 0 } });
  } catch (err) {
    next(err);
  }
});

// דוח גיול חובות
reportsRouter.get('/aging', authGuard, requirePermission('reports', 'view'), async (_req, res, next) => {
  try {
    const docs = await prisma.billingDoc.findMany({ where: { type: { not: 'ESEK' } }, include: { offsets: true, contract: { include: { customer: true, project: true } } } });
    const T = todayUTC();
    const BUCKETS = [
      { k: 0, label: 'טרם הגיע', t: (d: number) => d <= 0 }, { k: 1, label: '1–30 יום', t: (d: number) => d >= 1 && d <= 30 },
      { k: 2, label: '31–60 יום', t: (d: number) => d >= 31 && d <= 60 }, { k: 3, label: '61–90 יום', t: (d: number) => d >= 61 && d <= 90 }, { k: 4, label: 'מעל 90 יום', t: (d: number) => d > 90 },
    ];
    const items = (docs as any[]).map((d) => {
      const off = d.offsets.reduce((s: number, o: any) => s + N(o.amount), 0);
      const { net } = docNet(N(d.amountBeforeVat), N(d.retentionPct), true, off);
      const open = d.status === 'שולם' ? 0 : Math.max(0, net - N(d.paidAmount));
      const dd = d.dueDate ? Math.round((T - d.dueDate.getTime()) / 86400000) : 0;
      return { number: d.number, customer: d.contract.customer.name, project: d.contract.project.code, net, paid: N(d.paidAmount), open, dueDate: d.dueDate ? d.dueDate.toISOString().slice(0, 10) : null, daysOverdue: dd > 0 ? dd : 0, bucket: BUCKETS.find((b) => b.t(dd))!.k, bucketLabel: BUCKETS.find((b) => b.t(dd))!.label };
    }).filter((i) => i.open > 0).sort((a, b) => b.daysOverdue - a.daysOverdue);
    const buckets = BUCKETS.map((b) => { const inB = items.filter((i) => i.bucket === b.k); return { label: b.label, count: inB.length, total: inB.reduce((s, i) => s + i.open, 0) }; });
    res.json({ items, buckets, totalOpen: items.reduce((s, i) => s + i.open, 0), overdueTotal: items.filter((i) => i.daysOverdue > 0).reduce((s, i) => s + i.open, 0) });
  } catch (err) {
    next(err);
  }
});

// דוח תזרים מזומנים — יומן כרונולוגי של כל תנועות ההוצאה וההכנסה, עם יתרה מצטברת.
reportsRouter.get('/cashflow', authGuard, requirePermission('reports', 'view'), async (_req, res, next) => {
  try {
    const [docs, sup, org] = await Promise.all([
      prisma.billingDoc.findMany({ include: { offsets: true, contract: { include: { customer: true, project: true } } } }),
      prisma.supplierInvoice.findMany({ where: { approved: true }, include: { supplier: true, lines: { include: { project: true } } } }),
      prisma.orgSetting.findFirst(),
    ]);
    const opening = org ? N(org.openingBalance) : 0;

    type Mv = { sortDate: string; actualDate: string | null; valueDate: string | null; category: string; name: string; reference: string; description: string; project: string; status: string; expense: number; income: number; kind: string; id: string; batchRef?: string | null };
    const mv: Mv[] = [];

    // תנועות הוצאה — חשבוניות ספק מאושרות
    for (const v of sup as any[]) {
      const projs = [...new Set(v.lines.map((l: any) => l.project?.code).filter(Boolean))].join(', ');
      const expTypes = [...new Set(v.lines.map((l: any) => l.expenseType).filter(Boolean))].join(', ');
      const amount = N(v.total);
      const vd = v.payDate ? iso(v.payDate) : iso(v.invoiceDate);
      if (v.docKind === 'esek') {
        mv.push({ sortDate: vd, actualDate: null, valueDate: vd, category: 'ספקים', name: v.supplier?.name ?? '—', reference: v.invoiceNo, description: 'חשבון עסקה' + (expTypes ? ' · ' + expTypes : ''), project: projs, status: 'חשבון עסקה', expense: amount, income: 0, kind: 'supplier-esek', id: v.id });
      } else if (v.paid) {
        const ad = v.actualPayDate ? iso(v.actualPayDate) : vd;
        mv.push({ sortDate: ad, actualDate: ad, valueDate: v.payDate ? iso(v.payDate) : null, category: 'ספקים', name: v.supplier?.name ?? '—', reference: v.invoiceNo, description: expTypes, project: projs, status: 'שולם', expense: amount, income: 0, kind: 'supplier', id: v.id, batchRef: v.paidBatchRef ?? null });
      } else {
        mv.push({ sortDate: vd, actualDate: null, valueDate: vd, category: 'ספקים', name: v.supplier?.name ?? '—', reference: v.invoiceNo, description: expTypes, project: projs, status: 'צפוי', expense: amount, income: 0, kind: 'supplier', id: v.id });
      }
    }

    // תנועות הכנסה — מסמכי חיוב ללקוח
    for (const d of docs as any[]) {
      const off = d.offsets.reduce((s: number, o: any) => s + N(o.amount), 0);
      const isTax = d.type !== 'ESEK';
      const { net } = docNet(N(d.amountBeforeVat), N(d.retentionPct), isTax, off);
      const cust = d.contract?.customer?.name ?? '—';
      const proj = d.contract?.project?.code ?? '';
      if (d.type === 'ESEK') {
        const vd = d.dueDate ? iso(d.dueDate) : iso(shotefPlus(d.issueDate, parseInt(d.terms || '0', 10)));
        mv.push({ sortDate: vd, actualDate: null, valueDate: vd, category: 'לקוחות', name: cust, reference: d.number, description: 'חשבון עסקה', project: proj, status: 'חשבון עסקה', expense: 0, income: net, kind: 'customer-esek', id: d.id });
      } else {
        const paid = N(d.paidAmount);
        const open = d.status === 'שולם' ? 0 : Math.max(0, net - paid);
        if (paid > 0) {
          const ad = d.paidDate ? iso(d.paidDate) : (d.dueDate ? iso(d.dueDate) : iso(d.issueDate));
          mv.push({ sortDate: ad, actualDate: ad, valueDate: d.dueDate ? iso(d.dueDate) : null, category: 'לקוחות', name: cust, reference: d.number, description: 'תקבול', project: proj, status: 'התקבל', expense: 0, income: paid, kind: 'customer', id: d.id });
        }
        if (open > 0) {
          const vd = d.dueDate ? iso(d.dueDate) : iso(d.issueDate);
          mv.push({ sortDate: vd, actualDate: null, valueDate: vd, category: 'לקוחות', name: cust, reference: d.number, description: 'צפוי לתקבול', project: proj, status: 'צפוי', expense: 0, income: open, kind: 'customer', id: d.id });
        }
      }
    }

    mv.sort((a, b) => a.sortDate.localeCompare(b.sortDate) || (b.income - b.expense) - (a.income - a.expense));
    let bal = opening, tIn = 0, tOut = 0;
    const ledger = mv.map((m) => { bal += m.income - m.expense; tIn += m.income; tOut += m.expense; return { ...m, balance: bal }; });
    res.json({ opening, ledger, totals: { income: tIn, expense: tOut, net: tIn - tOut, closing: bal } });
  } catch (err) {
    next(err);
  }
});
