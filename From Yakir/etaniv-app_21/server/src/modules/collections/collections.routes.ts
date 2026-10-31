import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../db';
import { authGuard } from '../../middleware/auth';
import { requirePermission } from '../../middleware/rbac';
import { audit } from '../../util/audit';
import { calcTotal } from '../../util/finance';

export const collectionsRouter = Router();

// סבבי גיול (aging)
const BUCKETS = [
  { k: 0, label: 'טרם הגיע', test: (dd: number) => dd <= 0 },
  { k: 1, label: '1–30 יום', test: (dd: number) => dd >= 1 && dd <= 30 },
  { k: 2, label: '31–60 יום', test: (dd: number) => dd >= 31 && dd <= 60 },
  { k: 3, label: '61–90 יום', test: (dd: number) => dd >= 61 && dd <= 90 },
  { k: 4, label: 'מעל 90 יום', test: (dd: number) => dd > 90 },
];
const bucketOf = (dd: number) => BUCKETS.find((b) => b.test(dd))!;

function todayUTC(): number {
  const n = new Date();
  return Date.UTC(n.getFullYear(), n.getMonth(), n.getDate());
}

// חוב פתוח = חשבונית מס (לא חשבון עסקה) שסטטוסה אינו "שולם" ויש יתרה
type DocFull = {
  id: string; type: string; number: string; dueDate: Date | null; status: string;
  amountBeforeVat: unknown; retentionPct: unknown; paidAmount: unknown;
  offsets: { amount: unknown }[];
  contract: { customer: { name: string }; project: { code: string; name: string } };
  actions: { actionType: string; actionDate: Date; note: string | null; nextFollowup: Date | null }[];
};

function computeOpen(d: DocFull) {
  const base = Number(d.amountBeforeVat);
  const gross = calcTotal(base);
  const retention = Math.round((base * Number(d.retentionPct)) / 100);
  const offsets = d.offsets.reduce((s, o) => s + Number(o.amount), 0);
  const net = gross - retention - offsets;
  const paid = Number(d.paidAmount);
  const open = d.status === 'שולם' ? 0 : Math.max(0, net - paid);
  return { net, paid, open };
}

collectionsRouter.get('/', authGuard, requirePermission('collections', 'view'), async (_req, res, next) => {
  try {
    const docs = (await prisma.billingDoc.findMany({
      where: { type: { not: 'ESEK' } },
      include: {
        offsets: true,
        contract: { include: { customer: true, project: true } },
        actions: { orderBy: { actionDate: 'desc' } },
      },
    })) as unknown as (DocFull & { id: string })[];

    const T = todayUTC();
    const items = docs
      .map((d) => {
        const { net, paid, open } = computeOpen(d);
        return { d, net, paid, open };
      })
      .filter((x) => x.open > 0)
      .map(({ d, net, paid, open }) => {
        const dd = d.dueDate ? Math.round((T - d.dueDate.getTime()) / 86400000) : 0;
        const b = bucketOf(dd);
        const last = d.actions[0];
        return {
          id: d.id,
          number: d.number,
          customer: d.contract.customer.name,
          project: d.contract.project.code,
          net,
          paid,
          open,
          dueDate: d.dueDate ? d.dueDate.toISOString().slice(0, 10) : null,
          daysOverdue: dd > 0 ? dd : 0,
          bucket: b.k,
          bucketLabel: b.label,
          lastAction: last ? { type: last.actionType, date: last.actionDate.toISOString().slice(0, 10), next: last.nextFollowup ? last.nextFollowup.toISOString().slice(0, 10) : null } : null,
        };
      })
      .sort((a, b) => b.daysOverdue - a.daysOverdue);

    const buckets = BUCKETS.map((b) => {
      const inB = items.filter((i) => i.bucket === b.k);
      return { k: b.k, label: b.label, total: inB.reduce((s, i) => s + i.open, 0), count: inB.length };
    });
    const totalOpen = items.reduce((s, i) => s + i.open, 0);
    const overdueTotal = items.filter((i) => i.daysOverdue > 0).reduce((s, i) => s + i.open, 0);

    res.json({ items, buckets, totalOpen, overdueTotal });
  } catch (err) {
    next(err);
  }
});

const actionSchema = z.object({
  actionType: z.string().min(1),
  actionDate: z.string().min(1),
  note: z.string().optional(),
  nextFollowup: z.string().optional(),
});

collectionsRouter.post('/:docId/actions', authGuard, requirePermission('collections', 'write'), async (req, res, next) => {
  try {
    const data = actionSchema.parse(req.body);
    const action = await prisma.collectionAction.create({
      data: {
        docId: req.params.docId,
        actionType: data.actionType,
        actionDate: new Date(data.actionDate + 'T00:00:00Z'),
        note: data.note,
        nextFollowup: data.nextFollowup ? new Date(data.nextFollowup + 'T00:00:00Z') : null,
        userId: req.user!.id,
      },
    });
    await audit(req, 'CREATE', 'collection_action', action.id);
    res.status(201).json({ ok: true });
  } catch (err) {
    next(err);
  }
});
