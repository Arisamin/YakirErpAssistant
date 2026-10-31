import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../db';
import { authGuard } from '../../middleware/auth';
import { requirePermission } from '../../middleware/rbac';
import { audit } from '../../util/audit';
import { buildHashavshevetRows } from '../../util/hashavshevet';

export const hashavshevetRouter = Router();

const includeAll = { supplier: true, lines: { include: { project: true } } };

// חשבוניות ממתינות לייצוא: מאושרות לתשלום שטרם יוצאו לחשבשבת.
function pendingWhere() {
  return { approved: true, hhExportedAt: null } as const;
}

// GET /pending — תצוגה מקדימה של השורות שייכללו בקובץ (ללא סימון).
hashavshevetRouter.get('/pending', authGuard, requirePermission('suppliers', 'view'), async (_req, res, next) => {
  try {
    const invoices = await prisma.supplierInvoice.findMany({ where: pendingWhere(), include: includeAll, orderBy: [{ invoiceDate: 'asc' }] });
    const { rows, missingKey } = buildHashavshevetRows(invoices as any[]);
    const total = rows.reduce((s, r) => s + r.debit, 0);
    res.json({ rows, invoiceCount: invoices.length, lineCount: rows.length, total, missingKey });
  } catch (err) {
    next(err);
  }
});

// POST /export — אטומי: בוחר את הממתינות, מוודא מפתח חשבשבת לכולן, מסמן כמיוצאות ומחזיר את השורות.
hashavshevetRouter.post('/export', authGuard, requirePermission('suppliers', 'write'), async (req, res, next) => {
  try {
    const invoices = await prisma.supplierInvoice.findMany({ where: pendingWhere(), include: includeAll });
    if (invoices.length === 0) {
      const err = new Error('אין חשבוניות מאושרות שטרם יוצאו לחשבשבת') as Error & { status?: number };
      err.status = 400;
      throw err;
    }
    const { rows, missingKey } = buildHashavshevetRows(invoices as any[]);
    if (missingKey.length > 0) {
      const err = new Error(`לא ניתן לייצא — חסר מפתח חשבון חשבשבת לספקים: ${missingKey.join(', ')}`) as Error & { status?: number };
      err.status = 400;
      throw err;
    }
    const batch = `HH-${new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '')}`;
    const ids = (invoices as { id: string }[]).map((i) => i.id);
    await prisma.supplierInvoice.updateMany({
      where: { id: { in: ids } },
      data: { hhExportedAt: new Date(), hhExportBatch: batch, recordedHh: true },
    });
    await audit(req, 'EXPORT', 'hashavshevet', batch);
    const total = rows.reduce((s, r) => s + r.debit, 0);
    res.json({ batch, rows, invoiceCount: invoices.length, lineCount: rows.length, total });
  } catch (err) {
    next(err);
  }
});

// GET /history — אצוות ייצוא קודמות (מקובץ לפי מזהה אצווה).
hashavshevetRouter.get('/history', authGuard, requirePermission('suppliers', 'view'), async (_req, res, next) => {
  try {
    const rows = await prisma.supplierInvoice.findMany({
      where: { hhExportBatch: { not: null } },
      select: { hhExportBatch: true, hhExportedAt: true, total: true },
    });
    const map = new Map<string, { batch: string; exportedAt: Date | null; invoiceCount: number; total: number }>();
    for (const r of rows as { hhExportBatch: string; hhExportedAt: Date | null; total: any }[]) {
      const cur = map.get(r.hhExportBatch) ?? { batch: r.hhExportBatch, exportedAt: r.hhExportedAt, invoiceCount: 0, total: 0 };
      cur.invoiceCount += 1;
      cur.total += Number(r.total);
      if (!cur.exportedAt || (r.hhExportedAt && r.hhExportedAt > cur.exportedAt)) cur.exportedAt = r.hhExportedAt;
      map.set(r.hhExportBatch, cur);
    }
    const batches = [...map.values()].sort((a, b) => (b.exportedAt?.getTime() ?? 0) - (a.exportedAt?.getTime() ?? 0));
    res.json(batches.map((b) => ({ batch: b.batch, exportedAt: b.exportedAt ? b.exportedAt.toISOString() : null, invoiceCount: b.invoiceCount, total: b.total })));
  } catch (err) {
    next(err);
  }
});

// POST /undo — ביטול אצווה: מחזיר את חשבוניותיה למצב "ממתין לייצוא" (למשל אם הקובץ נזרק).
hashavshevetRouter.post('/undo', authGuard, requirePermission('suppliers', 'write'), async (req, res, next) => {
  try {
    const { batch } = z.object({ batch: z.string().min(1) }).parse(req.body);
    const result = await prisma.supplierInvoice.updateMany({ where: { hhExportBatch: batch }, data: { hhExportedAt: null, hhExportBatch: null } });
    await audit(req, 'UPDATE', 'hashavshevet_undo', batch);
    res.json({ ok: true, reverted: result.count });
  } catch (err) {
    next(err);
  }
});
