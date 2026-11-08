import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../db';
import { authGuard } from '../../middleware/auth';
import { requirePermission } from '../../middleware/rbac';
import { audit } from '../../util/audit';

// מודול הפרויקטים — מדגים את דפוס האבטחה: כל נתיב מוגן באימות + הרשאה לפי מודול.
// קריאה דורשת הרשאת צפייה ב"סקירת פרויקטים"; כתיבה/מחיקה דורשת הרשאה ב"ייבוא נתונים".
export const projectsRouter = Router();

const projectSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  costBudget: z.number().nonnegative().default(0),
  status: z.string().default('פעיל'),
});

projectsRouter.get('/', authGuard, requirePermission('overview', 'view'), async (_req, res, next) => {
  try {
    const projects = await prisma.project.findMany({ orderBy: { code: 'asc' } });
    res.json(projects);
  } catch (err) {
    next(err);
  }
});

projectsRouter.post('/', authGuard, requirePermission('import', 'write'), async (req, res, next) => {
  try {
    const data = projectSchema.parse(req.body);
    const project = await prisma.project.create({ data });
    await audit(req, 'CREATE', 'project', project.id);
    res.status(201).json(project);
  } catch (err) {
    next(err);
  }
});

projectsRouter.put('/:id', authGuard, requirePermission('import', 'write'), async (req, res, next) => {
  try {
    const data = projectSchema.partial().parse(req.body);
    const project = await prisma.project.update({ where: { id: req.params.id }, data });
    await audit(req, 'UPDATE', 'project', project.id);
    res.json(project);
  } catch (err) {
    next(err);
  }
});

projectsRouter.delete('/:id', authGuard, requirePermission('import', 'delete'), async (req, res, next) => {
  try {
    const id = req.params.id;
    // הגנה: לא ניתן למחוק פרויקט שיש לו תנועות מקושרות (חשבוניות/חוזים/ימי עבודה)
    const [lines, contracts, workdays] = await Promise.all([
      prisma.invoiceLine.count({ where: { projectId: id } }),
      prisma.contract.count({ where: { projectId: id } }),
      prisma.workday.count({ where: { projectId: id } }),
    ]);
    const blockers: string[] = [];
    if (lines) blockers.push(`${lines} שורות חשבונית ספק`);
    if (contracts) blockers.push(`${contracts} חוזים`);
    if (workdays) blockers.push(`${workdays} רשומות ימי עבודה`);
    if (blockers.length) {
      return res.status(409).json({ error: `לא ניתן למחוק פרויקט המקושר ל: ${blockers.join(', ')}. יש להסיר או לשייך מחדש את התנועות תחילה.` });
    }
    await prisma.project.delete({ where: { id } });
    await audit(req, 'DELETE', 'project', id);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});
