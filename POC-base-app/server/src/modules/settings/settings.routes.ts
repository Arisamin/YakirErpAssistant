import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../db';
import { authGuard } from '../../middleware/auth';
import { requirePermission } from '../../middleware/rbac';
import { audit } from '../../util/audit';

// הגדרות שדות חובה לאישור חשבונית ספק.
// קריאה — לכל משתמש מחובר (הטופס צריך לדעת אילו שדות חובה).
// עדכון — מנהל בלבד (הרשאת permissions).
export const invoiceFieldSettingsRouter = Router();

invoiceFieldSettingsRouter.get('/', authGuard, async (_req, res, next) => {
  try {
    const settings = await prisma.invoiceFieldSetting.findMany({ orderBy: { sortOrder: 'asc' } });
    res.json(settings.map((s: { fieldKey: string; label: string; required: boolean }) => ({ fieldKey: s.fieldKey, label: s.label, required: s.required })));
  } catch (err) {
    next(err);
  }
});

invoiceFieldSettingsRouter.put('/', authGuard, requirePermission('permissions', 'write'), async (req, res, next) => {
  try {
    const { fieldKey, required } = z.object({ fieldKey: z.string(), required: z.boolean() }).parse(req.body);
    const setting = await prisma.invoiceFieldSetting.findUnique({ where: { fieldKey } });
    if (!setting) return res.status(404).json({ error: 'שדה לא קיים' });
    await prisma.invoiceFieldSetting.update({ where: { fieldKey }, data: { required } });
    await audit(req, 'UPDATE', 'invoice_field_setting', fieldKey);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// הגדרות ארגון — מוסד שולח למס"ב + יתרת פתיחה לתזרים.
// קריאה — לכל משתמש מחובר; עדכון — מנהל בלבד (הרשאת permissions).
export const orgSettingsRouter = Router();

async function getOrg() {
  let org = await prisma.orgSetting.findFirst();
  if (!org) org = await prisma.orgSetting.create({ data: {} });
  return org;
}

orgSettingsRouter.get('/', authGuard, async (_req, res, next) => {
  try {
    const org = await getOrg();
    res.json({ masavInstitutionCode: org.masavInstitutionCode, masavSenderName: org.masavSenderName, openingBalance: Number(org.openingBalance) });
  } catch (err) {
    next(err);
  }
});

orgSettingsRouter.put('/', authGuard, requirePermission('permissions', 'write'), async (req, res, next) => {
  try {
    const data = z
      .object({
        masavInstitutionCode: z.string().optional(),
        masavSenderName: z.string().optional(),
        openingBalance: z.number().optional(),
      })
      .parse(req.body);
    const org = await getOrg();
    const updated = await prisma.orgSetting.update({ where: { id: org.id }, data });
    await audit(req, 'UPDATE', 'org_setting', org.id);
    res.json({ masavInstitutionCode: updated.masavInstitutionCode, masavSenderName: updated.masavSenderName, openingBalance: Number(updated.openingBalance) });
  } catch (err) {
    next(err);
  }
});
