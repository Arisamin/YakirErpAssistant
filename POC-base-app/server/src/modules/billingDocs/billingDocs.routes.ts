import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../db';
import { authGuard } from '../../middleware/auth';
import { requirePermission } from '../../middleware/rbac';
import { audit } from '../../util/audit';
import { calcVat, calcTotal, shotefPlus } from '../../util/finance';

export const billingDocsRouter = Router();

// מיפוי בין תוויות עבריות ל-enum במסד
const TYPE_TO_ENUM: Record<string, 'ESEK' | 'TAX' | 'TAX_RECEIPT'> = {
  'עסקה': 'ESEK',
  'מס': 'TAX',
  'מס-קבלה': 'TAX_RECEIPT',
};
const ENUM_TO_TYPE: Record<string, string> = { ESEK: 'עסקה', TAX: 'מס', TAX_RECEIPT: 'מס-קבלה' };

const offsetSchema = z.object({ reason: z.string().min(1), amount: z.number() });
const docSchema = z.object({
  type: z.enum(['עסקה', 'מס', 'מס-קבלה']),
  number: z.string().min(1),
  contractId: z.string().min(1),
  issueDate: z.string().min(1),
  amountBeforeVat: z.number().nonnegative(),
  retentionPct: z.number().min(0).max(100).default(0),
  terms: z.string().default('60'),
  status: z.string().default('טיוטה'),
  paidAmount: z.number().nonnegative().default(0),
  recordedHh: z.boolean().default(false),
  offsets: z.array(offsetSchema).default([]),
});

// חישובי הסכומים — נאכפים בשרת. עכבון וקיזוזים רלוונטיים רק לחשבוניות מס.
function serialize(d: any) {
  const base = Number(d.amountBeforeVat);
  const isTax = d.type !== 'ESEK';
  const vat = calcVat(base);
  const gross = calcTotal(base);
  const retention = isTax ? Math.round((base * Number(d.retentionPct)) / 100) : 0;
  const offsets = (d.offsets || []).map((o: any) => ({ id: o.id, reason: o.reason, amount: Number(o.amount) }));
  const offsetsSum = offsets.reduce((s: number, o: any) => s + o.amount, 0);
  const net = gross - retention - offsetsSum;
  const paid = Number(d.paidAmount);
  const open = d.status === 'שולם' ? 0 : Math.max(0, net - paid);
  const c = d.contract;
  return {
    id: d.id,
    type: ENUM_TO_TYPE[d.type],
    number: d.number,
    contractId: d.contractId,
    contractCode: c?.code,
    customer: c?.customer?.name ?? '',
    projectId: c?.projectId,
    project: c?.project ? { code: c.project.code, name: c.project.name } : undefined,
    issueDate: d.issueDate.toISOString().slice(0, 10),
    amountBeforeVat: base,
    vat,
    gross,
    retentionPct: Number(d.retentionPct),
    retention,
    offsets,
    offsetsSum,
    net,
    terms: d.terms,
    dueDate: d.dueDate ? d.dueDate.toISOString().slice(0, 10) : null,
    status: d.status,
    paidAmount: paid,
    open,
    recordedHh: d.recordedHh,
  };
}

const includeAll = { offsets: true, contract: { include: { customer: true, project: true } } };

billingDocsRouter.get('/', authGuard, requirePermission('docs', 'view'), async (_req, res, next) => {
  try {
    const docs = await prisma.billingDoc.findMany({ include: includeAll, orderBy: { issueDate: 'desc' } });
    res.json(docs.map(serialize));
  } catch (err) {
    next(err);
  }
});

function computed(data: z.infer<typeof docSchema>) {
  const issueDate = new Date(data.issueDate + 'T00:00:00Z');
  const dueDate = shotefPlus(issueDate, parseInt(data.terms || '0', 10));
  return { issueDate, dueDate };
}

billingDocsRouter.post('/', authGuard, requirePermission('docs', 'write'), async (req, res, next) => {
  try {
    const data = docSchema.parse(req.body);
    const { issueDate, dueDate } = computed(data);
    const doc = await prisma.billingDoc.create({
      data: {
        type: TYPE_TO_ENUM[data.type],
        number: data.number,
        contractId: data.contractId,
        issueDate,
        amountBeforeVat: data.amountBeforeVat,
        retentionPct: data.retentionPct,
        terms: data.terms,
        dueDate,
        status: data.status,
        paidAmount: data.paidAmount,
        recordedHh: data.recordedHh,
        offsets: { create: data.offsets.map((o) => ({ reason: o.reason, amount: o.amount })) },
      },
      include: includeAll,
    });
    await audit(req, 'CREATE', 'billing_doc', doc.id);
    res.status(201).json(serialize(doc));
  } catch (err) {
    next(err);
  }
});

billingDocsRouter.put('/:id', authGuard, requirePermission('docs', 'write'), async (req, res, next) => {
  try {
    const data = docSchema.parse(req.body);
    const { issueDate, dueDate } = computed(data);
    const doc = await prisma.billingDoc.update({
      where: { id: req.params.id },
      data: {
        type: TYPE_TO_ENUM[data.type],
        number: data.number,
        contractId: data.contractId,
        issueDate,
        amountBeforeVat: data.amountBeforeVat,
        retentionPct: data.retentionPct,
        terms: data.terms,
        dueDate,
        status: data.status,
        paidAmount: data.paidAmount,
        recordedHh: data.recordedHh,
        offsets: { deleteMany: {}, create: data.offsets.map((o) => ({ reason: o.reason, amount: o.amount })) },
      },
      include: includeAll,
    });
    await audit(req, 'UPDATE', 'billing_doc', doc.id);
    res.json(serialize(doc));
  } catch (err) {
    next(err);
  }
});

billingDocsRouter.delete('/:id', authGuard, requirePermission('docs', 'delete'), async (req, res, next) => {
  try {
    await prisma.billingDoc.delete({ where: { id: req.params.id } });
    await audit(req, 'DELETE', 'billing_doc', req.params.id);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

// המרת חשבון עסקה של לקוח לחשבונית מס
billingDocsRouter.post('/:id/to-invoice', authGuard, requirePermission('docs', 'write'), async (req, res, next) => {
  try {
    const doc = await prisma.billingDoc.update({ where: { id: req.params.id }, data: { type: 'TAX', recordedHh: true }, include: { offsets: true, contract: { include: { customer: true, project: true } } } });
    await audit(req, 'UPDATE', 'billing_doc_convert', doc.id);
    res.json(serialize(doc));
  } catch (err) {
    next(err);
  }
});
