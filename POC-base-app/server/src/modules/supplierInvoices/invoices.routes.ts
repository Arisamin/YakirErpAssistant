import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../db';
import { authGuard } from '../../middleware/auth';
import { requirePermission } from '../../middleware/rbac';
import { audit } from '../../util/audit';
import { shotefPlus, invoiceStatus } from '../../util/finance';

export const supplierInvoicesRouter = Router();

const lineSchema = z.object({
  projectId: z.string().min(1),
  expenseType: z.string().min(1),
  amount: z.number().nonnegative(),
});

const invoiceSchema = z.object({
  supplierId: z.string().min(1),
  invoiceNo: z.string().min(1),
  invoiceDate: z.string().min(1), // YYYY-MM-DD
  intakeDate: z.string().optional(), // YYYY-MM-DD — תאריך קליטת החשבונית
  docKind: z.enum(['tax', 'esek']).default('tax'), // חשבונית מס / חשבון עסקה
  amountBeforeVat: z.number().nonnegative(),
  vatRate: z.number().min(0).max(100).default(18), // שיעור מע"מ (%) — נמשך מהספק, ניתן לשינוי
  terms: z.string().default('30'),
  approved: z.boolean().default(false),
  recordedHh: z.boolean().default(false),
  inCashflow: z.boolean().default(false),
  paid: z.boolean().default(false),
  actualPayDate: z.string().optional(), // YYYY-MM-DD — תאריך תשלום בפועל
  reference: z.string().optional(),
  purchaseOrderNo: z.string().optional(),
  deliveryNoteNo: z.string().optional(),
  matched: z.boolean().default(false),
  notes: z.string().optional(),
  selfInvoiceNo: z.string().optional(), // מספר חשבונית עצמית
  lines: z.array(lineSchema).default([]),
});

// בדיקה אם שדה נתון "מולא" — לפי מפתח השדה.
function isFieldFilled(data: z.infer<typeof invoiceSchema>, fieldKey: string): boolean {
  switch (fieldKey) {
    case 'purchaseOrderNo':
      return !!data.purchaseOrderNo && data.purchaseOrderNo.trim() !== '';
    case 'deliveryNoteNo':
      return !!data.deliveryNoteNo && data.deliveryNoteNo.trim() !== '';
    case 'selfInvoiceNo':
      return !!data.selfInvoiceNo && data.selfInvoiceNo.trim() !== '';
    case 'notes':
      return !!data.notes && data.notes.trim() !== '';
    case 'matched':
      return data.matched === true;
    case 'lines':
      return Array.isArray(data.lines) && data.lines.length > 0;
    default:
      return true; // שדה לא מוכר — לא חוסם
  }
}

// אכיפת תהליך: לא ניתן לאשר לתשלום לפני שכל שדות החובה (הניתנים להגדרה ע"י המנהל) מולאו.
async function assertApprovalRule(data: z.infer<typeof invoiceSchema>) {
  if (!data.approved) return;
  const required = await prisma.invoiceFieldSetting.findMany({ where: { required: true } });
  const missing = required
    .filter((s: { fieldKey: string; label: string }) => !isFieldFilled(data, s.fieldKey))
    .map((s: { fieldKey: string; label: string }) => s.label);
  if (missing.length > 0) {
    const err = new Error(`לא ניתן לאשר חשבונית לתשלום — חסרים שדות חובה: ${missing.join(', ')}`) as Error & { status?: number };
    err.status = 400;
    throw err;
  }
}

// המרת תוצאת Prisma לפורמט נוח ללקוח (מספרים במקום Decimal) + סטטוס מחושב.
function serialize(inv: any) {
  const lines = inv.lines.map((l: any) => ({
    id: l.id,
    projectId: l.projectId,
    project: l.project ? { code: l.project.code, name: l.project.name } : undefined,
    expenseType: l.expenseType,
    amount: Number(l.amount),
  }));
  return {
    id: inv.id,
    supplierId: inv.supplierId,
    supplier: inv.supplier ? { id: inv.supplier.id, name: inv.supplier.name } : undefined,
    invoiceNo: inv.invoiceNo,
    invoiceDate: inv.invoiceDate.toISOString().slice(0, 10),
    intakeDate: inv.intakeDate ? inv.intakeDate.toISOString().slice(0, 10) : null,
    docKind: inv.docKind,
    amountBeforeVat: Number(inv.amountBeforeVat),
    vatRate: inv.vatRate,
    vat: Number(inv.vat),
    total: Number(inv.total),
    terms: inv.terms,
    payDate: inv.payDate ? inv.payDate.toISOString().slice(0, 10) : null,
    approved: inv.approved,
    recordedHh: inv.recordedHh,
    inCashflow: inv.inCashflow,
    paid: inv.paid,
    actualPayDate: inv.actualPayDate ? inv.actualPayDate.toISOString().slice(0, 10) : null,
    paidBatchRef: inv.paidBatchRef ?? null,
    reference: inv.reference,
    purchaseOrderNo: inv.purchaseOrderNo,
    deliveryNoteNo: inv.deliveryNoteNo,
    matched: inv.matched,
    notes: inv.notes,
    selfInvoiceNo: inv.selfInvoiceNo,
    hhExportedAt: inv.hhExportedAt ? inv.hhExportedAt.toISOString().slice(0, 10) : null,
    hhExportBatch: inv.hhExportBatch ?? null,
    status: invoiceStatus({ ...inv, lines }),
    lines,
  };
}

const includeAll = { supplier: true, lines: { include: { project: true } } };

supplierInvoicesRouter.get('/', authGuard, requirePermission('suppliers', 'view'), async (_req, res, next) => {
  try {
    const invoices = await prisma.supplierInvoice.findMany({
      include: includeAll,
      orderBy: { invoiceDate: 'desc' },
    });
    res.json(invoices.map(serialize));
  } catch (err) {
    next(err);
  }
});

function computed(data: z.infer<typeof invoiceSchema>) {
  const invoiceDate = new Date(data.invoiceDate + 'T00:00:00Z');
  const vat = Math.round(data.amountBeforeVat * (data.vatRate / 100)); // מע"מ לפי שיעור החשבונית (למשל 0 לספק פטור)
  const total = data.amountBeforeVat + vat;
  const payDate = shotefPlus(invoiceDate, parseInt(data.terms || '0', 10));
  const intakeDate = data.intakeDate ? new Date(data.intakeDate + 'T00:00:00Z') : undefined;
  const actualPayDate = data.actualPayDate ? new Date(data.actualPayDate + 'T00:00:00Z') : null;
  return { invoiceDate, vat, total, payDate, intakeDate, actualPayDate };
}

supplierInvoicesRouter.post('/', authGuard, requirePermission('suppliers', 'write'), async (req, res, next) => {
  try {
    const data = invoiceSchema.parse(req.body);
    await assertApprovalRule(data);
    const { invoiceDate, vat, total, payDate, intakeDate, actualPayDate } = computed(data);
    const inv = await prisma.supplierInvoice.create({
      data: {
        supplierId: data.supplierId,
        invoiceNo: data.invoiceNo,
        invoiceDate,
        ...(intakeDate ? { intakeDate } : {}),
        docKind: data.docKind,
        amountBeforeVat: data.amountBeforeVat,
        vatRate: data.vatRate,
        vat,
        total,
        terms: data.terms,
        payDate,
        approved: data.approved,
        approvedById: data.approved ? req.user!.id : null,
        recordedHh: data.recordedHh,
        inCashflow: data.inCashflow,
        paid: data.paid,
        actualPayDate,
        reference: data.reference,
        purchaseOrderNo: data.purchaseOrderNo,
        deliveryNoteNo: data.deliveryNoteNo,
        matched: data.matched,
        notes: data.notes,
        selfInvoiceNo: data.selfInvoiceNo,
        lines: { create: data.lines.map((l) => ({ projectId: l.projectId, expenseType: l.expenseType, amount: l.amount })) },
      },
      include: includeAll,
    });
    await audit(req, 'CREATE', 'supplier_invoice', inv.id);
    res.status(201).json(serialize(inv));
  } catch (err) {
    next(err);
  }
});

supplierInvoicesRouter.put('/:id', authGuard, requirePermission('suppliers', 'write'), async (req, res, next) => {
  try {
    const data = invoiceSchema.parse(req.body);
    await assertApprovalRule(data);
    const { invoiceDate, vat, total, payDate, intakeDate, actualPayDate } = computed(data);
    const inv = await prisma.supplierInvoice.update({
      where: { id: req.params.id },
      data: {
        supplierId: data.supplierId,
        invoiceNo: data.invoiceNo,
        invoiceDate,
        ...(intakeDate ? { intakeDate } : {}),
        docKind: data.docKind,
        amountBeforeVat: data.amountBeforeVat,
        vatRate: data.vatRate,
        vat,
        total,
        terms: data.terms,
        payDate,
        approved: data.approved,
        approvedById: data.approved ? req.user!.id : null,
        recordedHh: data.recordedHh,
        inCashflow: data.inCashflow,
        paid: data.paid,
        actualPayDate,
        reference: data.reference,
        purchaseOrderNo: data.purchaseOrderNo,
        deliveryNoteNo: data.deliveryNoteNo,
        matched: data.matched,
        notes: data.notes,
        selfInvoiceNo: data.selfInvoiceNo,
        lines: {
          deleteMany: {},
          create: data.lines.map((l) => ({ projectId: l.projectId, expenseType: l.expenseType, amount: l.amount })),
        },
      },
      include: includeAll,
    });
    await audit(req, 'UPDATE', 'supplier_invoice', inv.id);
    res.json(serialize(inv));
  } catch (err) {
    next(err);
  }
});

supplierInvoicesRouter.delete('/:id', authGuard, requirePermission('suppliers', 'delete'), async (req, res, next) => {
  try {
    await prisma.supplierInvoice.delete({ where: { id: req.params.id } });
    await audit(req, 'DELETE', 'supplier_invoice', req.params.id);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

// המרת חשבון עסקה של ספק לחשבונית מס
supplierInvoicesRouter.post('/:id/to-invoice', authGuard, requirePermission('suppliers', 'write'), async (req, res, next) => {
  try {
    const inv = await prisma.supplierInvoice.update({ where: { id: req.params.id }, data: { docKind: 'tax' }, include: includeAll });
    await audit(req, 'UPDATE', 'supplier_invoice_convert', inv.id);
    res.json(serialize(inv));
  } catch (err) {
    next(err);
  }
});
