import { Router } from 'express';
import { prisma } from '../../db';
import { authGuard } from '../../middleware/auth';
import { requirePermission } from '../../middleware/rbac';

// מצליב את שלושת מרכיבי הרווחיות לכל פרויקט:
//  הכנסה מוכרת = חשבוניות מס (לפני מע"מ) של חוזי הפרויקט
//  חומרים/קבלנים = שורות חשבוניות ספקים המשויכות לפרויקט
//  עבודה = ימי עבודה × עלות יומית של העובד
export const overviewRouter = Router();

overviewRouter.get('/', authGuard, requirePermission('overview', 'view'), async (_req, res, next) => {
  try {
    const [projects, lines, docs, workdays, workers] = await Promise.all([
      prisma.project.findMany({ orderBy: { code: 'asc' } }),
      prisma.invoiceLine.findMany(),
      prisma.billingDoc.findMany({ include: { contract: true } }),
      prisma.workday.findMany(),
      prisma.worker.findMany(),
    ]);

    const dailyCost = new Map<string, number>(workers.map((w: { id: string; dailyCost: unknown }) => [w.id, Number(w.dailyCost)]));

    const materialsByProject = new Map<string, number>();
    for (const l of lines as { projectId: string; amount: unknown }[]) {
      materialsByProject.set(l.projectId, (materialsByProject.get(l.projectId) ?? 0) + Number(l.amount));
    }

    const incomeByProject = new Map<string, number>();
    for (const d of docs as { type: string; amountBeforeVat: unknown; contract: { projectId: string } }[]) {
      if (d.type === 'ESEK') continue; // חשבון עסקה אינו הכנסה מוכרת
      const pid = d.contract.projectId;
      incomeByProject.set(pid, (incomeByProject.get(pid) ?? 0) + Number(d.amountBeforeVat));
    }

    const laborByProject = new Map<string, number>();
    for (const wd of workdays as { projectId: string; workerId: string; days: unknown }[]) {
      const cost = Number(wd.days) * (dailyCost.get(wd.workerId) ?? 0);
      laborByProject.set(wd.projectId, (laborByProject.get(wd.projectId) ?? 0) + cost);
    }

    let tIncome = 0, tMaterials = 0, tLabor = 0, tBudget = 0;
    const rows = (projects as { id: string; code: string; name: string; costBudget: unknown }[]).map((p) => {
      const income = incomeByProject.get(p.id) ?? 0;
      const materials = materialsByProject.get(p.id) ?? 0;
      const labor = laborByProject.get(p.id) ?? 0;
      const cost = materials + labor;
      const profit = income - cost;
      const margin = income ? (profit / income) * 100 : 0;
      const costBudget = Number(p.costBudget);
      const utilization = costBudget ? (cost / costBudget) * 100 : 0;
      tIncome += income; tMaterials += materials; tLabor += labor; tBudget += costBudget;
      return { id: p.id, code: p.code, name: p.name, income, materials, labor, cost, profit, margin, costBudget, utilization };
    });

    const tCost = tMaterials + tLabor;
    const tProfit = tIncome - tCost;
    res.json({
      projects: rows,
      totals: {
        income: tIncome, materials: tMaterials, labor: tLabor, cost: tCost,
        profit: tProfit, margin: tIncome ? (tProfit / tIncome) * 100 : 0,
        costBudget: tBudget, utilization: tBudget ? (tCost / tBudget) * 100 : 0,
      },
    });
  } catch (err) {
    next(err);
  }
});
