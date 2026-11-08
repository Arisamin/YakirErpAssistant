import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../db';
import { authGuard } from '../../middleware/auth';
import { requirePermission } from '../../middleware/rbac';
import { audit } from '../../util/audit';

// ספקים וסוגי הוצאה — נתוני עזר למודול הוצאות הספקים.
export const suppliersRouter = Router();

suppliersRouter.get('/', authGuard, requirePermission('suppliers', 'view'), async (_req, res, next) => {
  try {
    const suppliers = await prisma.supplier.findMany({ orderBy: { name: 'asc' } });
    res.json(suppliers);
  } catch (err) {
    next(err);
  }
});

const supplierSchema = z.object({
  name: z.string().min(1),
  taxId: z.string().optional(),
  hhAccountKey: z.string().optional(),
  vatRate: z.number().min(0).max(100).optional(),
  defaultExpenseType: z.string().optional(),
  defaultTerms: z.string().optional(),
  bankCode: z.string().optional(),
  branchCode: z.string().optional(),
  bankAccount: z.string().optional(),
});

suppliersRouter.post('/', authGuard, requirePermission('suppliers', 'write'), async (req, res, next) => {
  try {
    const data = supplierSchema.parse(req.body);
    const supplier = await prisma.supplier.create({ data });
    await audit(req, 'CREATE', 'supplier', supplier.id);
    res.status(201).json(supplier);
  } catch (err) {
    next(err);
  }
});

// עדכון פרטי ספק — כולל פרטי בנק לקובץ מס"ב
suppliersRouter.put('/:id', authGuard, requirePermission('suppliers', 'write'), async (req, res, next) => {
  try {
    const data = supplierSchema.partial().parse(req.body);
    const supplier = await prisma.supplier.update({ where: { id: req.params.id }, data });
    await audit(req, 'UPDATE', 'supplier', supplier.id);
    res.json(supplier);
  } catch (err) {
    next(err);
  }
});

// מחיקת ספק — חסומה אם קיימות חשבוניות לספק
suppliersRouter.delete('/:id', authGuard, requirePermission('suppliers', 'delete'), async (req, res, next) => {
  try {
    const id = req.params.id;
    const invoices = await prisma.supplierInvoice.count({ where: { supplierId: id } });
    if (invoices) {
      return res.status(409).json({ error: `לא ניתן למחוק ספק המקושר ל-${invoices} חשבוניות. יש למחוק תחילה את החשבוניות של הספק.` });
    }
    await prisma.supplier.delete({ where: { id } });
    await audit(req, 'DELETE', 'supplier', id);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

// סוגי הוצאה
export const expenseTypesRouter = Router();
expenseTypesRouter.get('/', authGuard, requirePermission('suppliers', 'view'), async (_req, res, next) => {
  try {
    const types = await prisma.expenseType.findMany({ orderBy: { name: 'asc' } });
    res.json(types.map((t: { name: string }) => t.name));
  } catch (err) {
    next(err);
  }
});
