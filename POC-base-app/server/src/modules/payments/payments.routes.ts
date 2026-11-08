import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../db';
import { authGuard } from '../../middleware/auth';
import { requirePermission } from '../../middleware/rbac';
import { audit } from '../../util/audit';
import { assignRun, startOfDayUTC, iso, buildMasav, MASAV_SPEC, type MasavRow } from '../../util/payments';

export const paymentsRouter = Router();
const N = (x: unknown) => Number(x);

// חשבוניות ספק פתוחות לתשלום (מאושרות, חשבונית מס, טרם שולמו) — לסימון מקובץ ההעברות במקבץ.
paymentsRouter.get('/open', authGuard, requirePermission('suppliers', 'view'), async (_req, res, next) => {
  try {
    const invoices = await prisma.supplierInvoice.findMany({
      where: { approved: true, paid: false, docKind: 'tax' },
      include: { supplier: true },
      orderBy: [{ payDate: 'asc' }],
    });
    res.json(
      (invoices as any[]).map((v) => ({
        id: v.id,
        supplier: v.supplier?.name ?? '—',
        invoiceNo: v.invoiceNo,
        total: N(v.total),
        payDate: v.payDate ? v.payDate.toISOString().slice(0, 10) : null,
        selfInvoiceNo: v.selfInvoiceNo ?? null,
      }))
    );
  } catch (err) {
    next(err);
  }
});

// סימון חשבוניות כשולמו מתוך מקבץ העברות בבנק (העלאה + סימון מונחה).
paymentsRouter.post('/mark-paid', authGuard, requirePermission('suppliers', 'write'), async (req, res, next) => {
  try {
    const { ids, payDate, batchRef } = z
      .object({ ids: z.array(z.string()).min(1), payDate: z.string().min(1), batchRef: z.string().optional() })
      .parse(req.body);
    const result = await prisma.supplierInvoice.updateMany({
      where: { id: { in: ids }, paid: false },
      data: { paid: true, actualPayDate: new Date(payDate + 'T00:00:00Z'), paidBatchRef: batchRef || null, inCashflow: true },
    });
    await audit(req, 'UPDATE', 'payment_batch', batchRef || `${result.count} invoices`);
    res.json({ ok: true, marked: result.count });
  } catch (err) {
    next(err);
  }
});

// הפקת מקבץ תשלומים לספקים בפורמט מס"ב, לפי טווח מועדי תשלום (15/30).
// כולל רק חשבוניות מאושרות לתשלום שטרם שולמו, שמועד התשלום שלהן בטווח.
paymentsRouter.get('/masav', authGuard, requirePermission('reports', 'view'), async (req, res, next) => {
  try {
    const { from, to } = z
      .object({ from: z.string().min(1), to: z.string().min(1) })
      .parse({ from: req.query.from, to: req.query.to });

    const [invoices, org] = await Promise.all([
      prisma.supplierInvoice.findMany({ where: { paid: false, approved: true }, include: { supplier: true } }),
      prisma.orgSetting.findFirst(),
    ]);
    const today = startOfDayUTC(new Date());

    const selected = (invoices as any[])
      .filter((v) => v.payDate)
      .map((v) => ({ v, runDate: iso(assignRun(v.payDate, today)) }))
      .filter(({ runDate }) => runDate >= from && runDate <= to)
      .sort((a, b) => a.runDate.localeCompare(b.runDate) || a.v.supplier.name.localeCompare(b.v.supplier.name, 'he'));

    const warnings: string[] = [];
    const rows: MasavRow[] = selected.map(({ v }) => {
      const s = v.supplier;
      if (!s?.bankCode || !s?.branchCode || !s?.bankAccount) {
        if (!warnings.includes(s?.name)) warnings.push(s?.name ?? '—');
      }
      return {
        bankCode: s?.bankCode ?? '',
        branchCode: s?.branchCode ?? '',
        bankAccount: s?.bankAccount ?? '',
        supplierTaxId: s?.taxId ?? '',
        supplierName: s?.name ?? '',
        amount: N(v.total),
        reference: v.invoiceNo,
      };
    });

    const cfg = {
      institutionCode: org?.masavInstitutionCode ?? '00000000',
      senderName: org?.masavSenderName ?? '<CompNamePlaceHolder>',
      date: today,
    };
    const { content, count, totalAgorot } = buildMasav(rows, cfg);
    const filename = `MASAV_${from}_${to}.txt`.replace(/-/g, '');

    // פירוט לתצוגה/אקסל בצד הלקוח
    const preview = selected.map(({ v, runDate }) => ({
      runDate,
      supplier: v.supplier?.name ?? '—',
      invoiceNo: v.invoiceNo,
      bank: `${v.supplier?.bankCode ?? '—'}-${v.supplier?.branchCode ?? '—'}-${v.supplier?.bankAccount ?? '—'}`,
      amount: N(v.total),
    }));

    await audit(req, 'EXPORT', 'masav', `${from}..${to}`);
    res.json({
      filename,
      content,
      count,
      total: totalAgorot / 100,
      preview,
      warnings,
      placeholder: cfg.institutionCode === '00000000',
      institutionCode: cfg.institutionCode,
      senderName: cfg.senderName,
      spec: MASAV_SPEC,
    });
  } catch (err) {
    next(err);
  }
});
