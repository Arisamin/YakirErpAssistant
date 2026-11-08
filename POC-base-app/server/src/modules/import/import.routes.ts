import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../db';
import { authGuard } from '../../middleware/auth';
import { requirePermission } from '../../middleware/rbac';
import { audit } from '../../util/audit';

// מרכז ייבוא נתונים — קליטה המונית מקבצי אקסל (הפענוח מתבצע בצד הלקוח,
// והשרת מקבל שורות מובנות, מוודא תקינות ומדווח נוצר/עודכן/דולג).
export const importRouter = Router();

// ---- פרויקטים ----
const projectRow = z.object({ code: z.string().min(1), name: z.string().min(1), costBudget: z.number().nonnegative().default(0) });
importRouter.post('/projects', authGuard, requirePermission('import', 'write'), async (req, res, next) => {
  try {
    const rows = z.array(projectRow).parse(req.body?.rows ?? []);
    let created = 0, updated = 0;
    for (const r of rows) {
      const exists = await prisma.project.findUnique({ where: { code: r.code } });
      await prisma.project.upsert({ where: { code: r.code }, update: { name: r.name, costBudget: r.costBudget }, create: r });
      exists ? updated++ : created++;
    }
    await audit(req, 'IMPORT', 'project', undefined, `${rows.length} שורות`);
    res.json({ ok: true, total: rows.length, created, updated, skipped: 0 });
  } catch (err) {
    next(err);
  }
});

// ---- ספקים ----
const supplierRow = z.object({ name: z.string().min(1), expenseType: z.string().optional(), terms: z.string().optional() });
importRouter.post('/suppliers', authGuard, requirePermission('import', 'write'), async (req, res, next) => {
  try {
    const rows = z.array(supplierRow).parse(req.body?.rows ?? []);
    let created = 0, skipped = 0;
    for (const r of rows) {
      const exists = await prisma.supplier.findFirst({ where: { name: r.name } });
      if (exists) { skipped++; continue; }
      await prisma.supplier.create({ data: { name: r.name, defaultExpenseType: r.expenseType, defaultTerms: r.terms } });
      created++;
    }
    await audit(req, 'IMPORT', 'supplier', undefined, `${rows.length} שורות`);
    res.json({ ok: true, total: rows.length, created, updated: 0, skipped });
  } catch (err) {
    next(err);
  }
});

// ---- לקוחות וחוזים ----
const contractRow = z.object({
  code: z.string().min(1), customer: z.string().min(1), project: z.string().min(1),
  value: z.number().nonnegative().default(0), terms: z.string().optional(), retention: z.number().min(0).max(100).default(0),
});
importRouter.post('/contracts', authGuard, requirePermission('import', 'write'), async (req, res, next) => {
  try {
    const rows = z.array(contractRow).parse(req.body?.rows ?? []);
    let created = 0, updated = 0, skipped = 0;
    for (const r of rows) {
      const project = await prisma.project.findUnique({ where: { code: r.project } });
      if (!project) { skipped++; continue; } // פרויקט לא קיים — מדלגים
      let customer = await prisma.customer.findFirst({ where: { name: r.customer } });
      if (!customer) customer = await prisma.customer.create({ data: { name: r.customer } });
      const exists = await prisma.contract.findUnique({ where: { code: r.code } });
      await prisma.contract.upsert({
        where: { code: r.code },
        update: { customerId: customer.id, projectId: project.id, value: r.value, paymentTerms: r.terms ?? '60', retentionPct: r.retention },
        create: { code: r.code, customerId: customer.id, projectId: project.id, value: r.value, paymentTerms: r.terms ?? '60', retentionPct: r.retention },
      });
      exists ? updated++ : created++;
    }
    await audit(req, 'IMPORT', 'contract', undefined, `${rows.length} שורות`);
    res.json({ ok: true, total: rows.length, created, updated, skipped });
  } catch (err) {
    next(err);
  }
});
