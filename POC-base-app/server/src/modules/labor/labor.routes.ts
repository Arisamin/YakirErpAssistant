import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../db';
import { authGuard } from '../../middleware/auth';
import { requirePermission } from '../../middleware/rbac';
import { audit } from '../../util/audit';

// ===== עובדים =====
export const workersRouter = Router();

const workerSchema = z.object({
  name: z.string().min(1),
  role: z.string().optional(),
  dailyCost: z.number().nonnegative().default(0),
  active: z.boolean().default(true),
});

workersRouter.get('/', authGuard, requirePermission('labor', 'view'), async (_req, res, next) => {
  try {
    const workers = await prisma.worker.findMany({ orderBy: { name: 'asc' } });
    res.json(
      workers.map((w: { id: string; name: string; role: string | null; dailyCost: unknown; active: boolean }) => ({
        id: w.id, name: w.name, role: w.role, dailyCost: Number(w.dailyCost), active: w.active,
      }))
    );
  } catch (err) {
    next(err);
  }
});

workersRouter.post('/', authGuard, requirePermission('labor', 'write'), async (req, res, next) => {
  try {
    const data = workerSchema.parse(req.body);
    const w = await prisma.worker.create({ data });
    await audit(req, 'CREATE', 'worker', w.id);
    res.status(201).json({ id: w.id, name: w.name, role: w.role, dailyCost: Number(w.dailyCost), active: w.active });
  } catch (err) {
    next(err);
  }
});

workersRouter.put('/:id', authGuard, requirePermission('labor', 'write'), async (req, res, next) => {
  try {
    const data = workerSchema.partial().parse(req.body);
    const w = await prisma.worker.update({ where: { id: req.params.id }, data });
    await audit(req, 'UPDATE', 'worker', w.id);
    res.json({ id: w.id, name: w.name, role: w.role, dailyCost: Number(w.dailyCost), active: w.active });
  } catch (err) {
    next(err);
  }
});

// מחיקת עובד — מוחקת גם את רשומות ימי העבודה שלו (Cascade). חסומה אם שובץ בפרויקט פעיל בחודש הנוכחי? — לא; מחיקה מלאה עם ניקוי ימי העבודה.
workersRouter.delete('/:id', authGuard, requirePermission('labor', 'delete'), async (req, res, next) => {
  try {
    const id = req.params.id;
    const days = await prisma.workday.count({ where: { workerId: id } });
    await prisma.worker.delete({ where: { id } });
    await audit(req, 'DELETE', 'worker', `${id} (${days} ימי עבודה נמחקו)`);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

// ===== ימי עבודה =====
export const workdaysRouter = Router();

workdaysRouter.get('/', authGuard, requirePermission('labor', 'view'), async (_req, res, next) => {
  try {
    const wd = await prisma.workday.findMany();
    res.json(
      wd.map((x: { workerId: string; projectId: string; month: string; days: unknown }) => ({
        workerId: x.workerId, projectId: x.projectId, month: x.month, days: Number(x.days),
      }))
    );
  } catch (err) {
    next(err);
  }
});

const cellSchema = z.object({
  workerId: z.string().min(1),
  projectId: z.string().min(1),
  month: z.string().regex(/^\d{4}-\d{2}$/),
  days: z.number().min(0),
});

// עדכון תא בודד במטריצה (upsert לפי עובד/פרויקט/חודש)
workdaysRouter.put('/', authGuard, requirePermission('labor', 'write'), async (req, res, next) => {
  try {
    const { workerId, projectId, month, days } = cellSchema.parse(req.body);
    if (days <= 0) {
      await prisma.workday.deleteMany({ where: { workerId, projectId, month } });
    } else {
      await prisma.workday.upsert({
        where: { workerId_projectId_month: { workerId, projectId, month } },
        update: { days },
        create: { workerId, projectId, month, days },
      });
    }
    await audit(req, 'UPDATE', 'workday', `${workerId}:${projectId}:${month}`);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// ייבוא חודשי מאקסל: שורות של {name, cells:{projectCode:days}}
const importSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/),
  rows: z.array(z.object({ name: z.string().min(1), cells: z.record(z.number()) })),
});

workdaysRouter.post('/import', authGuard, requirePermission('labor', 'write'), async (req, res, next) => {
  try {
    const { month, rows } = importSchema.parse(req.body);
    const projects = await prisma.project.findMany();
    const byCode = new Map(projects.map((p: { code: string; id: string }) => [p.code, p.id]));
    let matched = 0,
      created = 0;
    for (const row of rows) {
      let worker = await prisma.worker.findFirst({ where: { name: row.name.trim() } });
      if (!worker) {
        worker = await prisma.worker.create({ data: { name: row.name.trim(), dailyCost: 0 } });
        created++;
      }
      matched++;
      for (const [code, days] of Object.entries(row.cells)) {
        const projectId = byCode.get(String(code).replace(/[^0-9]/g, ''));
        if (!projectId || !days) continue;
        await prisma.workday.upsert({
          where: { workerId_projectId_month: { workerId: worker.id, projectId, month } },
          update: { days },
          create: { workerId: worker.id, projectId, month, days },
        });
      }
    }
    await audit(req, 'IMPORT', 'workday', month, `${matched} עובדים`);
    res.json({ matched, created });
  } catch (err) {
    next(err);
  }
});
