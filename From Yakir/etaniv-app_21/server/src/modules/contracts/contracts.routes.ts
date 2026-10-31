import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../db';
import { authGuard } from '../../middleware/auth';
import { requirePermission } from '../../middleware/rbac';
import { audit } from '../../util/audit';
import { VAT_RATE } from '../../util/finance';

// ===== לקוחות (לרשימת בחירה) =====
export const customersRouter = Router();
customersRouter.get('/', authGuard, requirePermission('contracts', 'view'), async (_req, res, next) => {
  try {
    const customers = await prisma.customer.findMany({ orderBy: { name: 'asc' } });
    res.json(customers);
  } catch (err) {
    next(err);
  }
});

const customerSchema = z.object({ name: z.string().min(1), taxId: z.string().optional() });

customersRouter.post('/', authGuard, requirePermission('contracts', 'write'), async (req, res, next) => {
  try {
    const data = customerSchema.parse(req.body);
    const customer = await prisma.customer.create({ data });
    await audit(req, 'CREATE', 'customer', customer.id);
    res.status(201).json(customer);
  } catch (err) {
    next(err);
  }
});

customersRouter.put('/:id', authGuard, requirePermission('contracts', 'write'), async (req, res, next) => {
  try {
    const data = customerSchema.partial().parse(req.body);
    const customer = await prisma.customer.update({ where: { id: req.params.id }, data });
    await audit(req, 'UPDATE', 'customer', customer.id);
    res.json(customer);
  } catch (err) {
    next(err);
  }
});

// מחיקת לקוח — חסומה אם קיימים חוזים ללקוח
customersRouter.delete('/:id', authGuard, requirePermission('contracts', 'delete'), async (req, res, next) => {
  try {
    const id = req.params.id;
    const contracts = await prisma.contract.count({ where: { customerId: id } });
    if (contracts) {
      return res.status(409).json({ error: `לא ניתן למחוק לקוח המקושר ל-${contracts} חוזים. יש למחוק תחילה את החוזים של הלקוח.` });
    }
    await prisma.customer.delete({ where: { id } });
    await audit(req, 'DELETE', 'customer', id);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

// ===== חוזים =====
export const contractsRouter = Router();

const contractSchema = z.object({
  code: z.string().min(1),
  customerName: z.string().min(1),
  projectId: z.string().min(1),
  value: z.number().nonnegative(),
  paymentTerms: z.string().default('60'),
  retentionPct: z.number().min(0).max(100).default(0),
  status: z.string().default('פעיל'),
});

// חישובי גלגול מתוך מסמכי החיוב של החוזה (חשבוניות מס בלבד נחשבות כחיוב/עכבון).
function rollups(docs: any[]) {
  let billed = 0,
    collected = 0,
    retentionHeld = 0,
    open = 0;
  for (const d of docs) {
    const base = Number(d.amountBeforeVat);
    const gross = Math.round(base * (1 + VAT_RATE));
    const isTax = d.type !== 'ESEK';
    const ret = isTax ? Math.round((base * Number(d.retentionPct)) / 100) : 0;
    const offsets = (d.offsets || []).reduce((s: number, o: any) => s + Number(o.amount), 0);
    const net = gross - ret - offsets;
    const paid = Number(d.paidAmount);
    if (isTax) {
      billed += gross;
      retentionHeld += ret;
    }
    collected += paid;
    open += d.status === 'שולם' ? 0 : Math.max(0, net - paid);
  }
  return { billed, collected, retentionHeld, open };
}

function serialize(c: any) {
  const r = rollups(c.billingDocs || []);
  return {
    id: c.id,
    code: c.code,
    customerId: c.customerId,
    customer: c.customer ? c.customer.name : '',
    projectId: c.projectId,
    project: c.project ? { code: c.project.code, name: c.project.name } : undefined,
    value: Number(c.value),
    paymentTerms: c.paymentTerms,
    retentionPct: Number(c.retentionPct),
    status: c.status,
    billed: r.billed,
    collected: r.collected,
    retentionHeld: r.retentionHeld,
    open: r.open,
  };
}

const includeAll = { customer: true, project: true, billingDocs: { include: { offsets: true } } };

contractsRouter.get('/', authGuard, requirePermission('contracts', 'view'), async (_req, res, next) => {
  try {
    const contracts = await prisma.contract.findMany({ include: includeAll, orderBy: { code: 'asc' } });
    res.json(contracts.map(serialize));
  } catch (err) {
    next(err);
  }
});

// מוצא לקוח קיים לפי שם או יוצר חדש
async function resolveCustomerId(name: string): Promise<string> {
  const existing = await prisma.customer.findFirst({ where: { name } });
  if (existing) return existing.id;
  const created = await prisma.customer.create({ data: { name } });
  return created.id;
}

contractsRouter.post('/', authGuard, requirePermission('contracts', 'write'), async (req, res, next) => {
  try {
    const data = contractSchema.parse(req.body);
    const customerId = await resolveCustomerId(data.customerName);
    const contract = await prisma.contract.create({
      data: {
        code: data.code,
        customerId,
        projectId: data.projectId,
        value: data.value,
        paymentTerms: data.paymentTerms,
        retentionPct: data.retentionPct,
        status: data.status,
      },
      include: includeAll,
    });
    await audit(req, 'CREATE', 'contract', contract.id);
    res.status(201).json(serialize(contract));
  } catch (err) {
    next(err);
  }
});

contractsRouter.put('/:id', authGuard, requirePermission('contracts', 'write'), async (req, res, next) => {
  try {
    const data = contractSchema.parse(req.body);
    const customerId = await resolveCustomerId(data.customerName);
    const contract = await prisma.contract.update({
      where: { id: req.params.id },
      data: {
        code: data.code,
        customerId,
        projectId: data.projectId,
        value: data.value,
        paymentTerms: data.paymentTerms,
        retentionPct: data.retentionPct,
        status: data.status,
      },
      include: includeAll,
    });
    await audit(req, 'UPDATE', 'contract', contract.id);
    res.json(serialize(contract));
  } catch (err) {
    next(err);
  }
});

contractsRouter.delete('/:id', authGuard, requirePermission('contracts', 'delete'), async (req, res, next) => {
  try {
    await prisma.contract.delete({ where: { id: req.params.id } });
    await audit(req, 'DELETE', 'contract', req.params.id);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});
