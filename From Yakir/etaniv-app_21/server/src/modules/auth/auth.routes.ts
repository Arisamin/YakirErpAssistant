import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { authenticator } from 'otplib';
import { prisma } from '../../db';
import { env } from '../../env';
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  authGuard,
  type AuthUser,
} from '../../middleware/auth';
import { requirePermission } from '../../middleware/rbac';
import { audit } from '../../util/audit';

export const authRouter = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  token: z.string().optional(), // קוד TOTP אם 2FA מופעל
});

/** כניסה: בודק סיסמה, סטטוס אישור, ואימות דו-שלבי אם מופעל. */
authRouter.post('/login', async (req, res, next) => {
  try {
    const { email, password, token } = loginSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { email }, include: { role: true } });

    // הודעה גנרית כדי לא לחשוף אם המשתמש קיים
    const invalid = () => res.status(401).json({ error: 'פרטי התחברות שגויים' });
    if (!user) return invalid();
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return invalid();

    if (user.status !== 'APPROVED') {
      return res.status(403).json({ error: 'המשתמש טרם אושר או מושבת. פנה למנהל המערכת.' });
    }

    if (user.mfaEnabled) {
      if (!token) return res.status(206).json({ mfaRequired: true });
      const valid = authenticator.verify({ token, secret: user.mfaSecret! });
      if (!valid) return res.status(401).json({ error: 'קוד אימות דו-שלבי שגוי' });
    }

    const authUser: AuthUser = { id: user.id, email: user.email, roleKey: user.role.key };
    await prisma.user.update({ where: { id: user.id }, data: { lastLogin: new Date() } });
    await audit(req, 'LOGIN', 'user', user.id);

    res.json({
      accessToken: signAccessToken(authUser),
      refreshToken: signRefreshToken(authUser),
      user: { id: user.id, name: user.name, email: user.email, role: user.role.key, mfaEnabled: user.mfaEnabled },
    });
  } catch (err) {
    next(err);
  }
});

/** חידוש טוקן גישה באמצעות refresh token. */
authRouter.post('/refresh', async (req, res) => {
  const { refreshToken } = req.body ?? {};
  if (!refreshToken) return res.status(400).json({ error: 'חסר refresh token' });
  try {
    const payload = verifyRefreshToken(refreshToken);
    const authUser: AuthUser = { id: payload.id, email: payload.email, roleKey: payload.roleKey };
    res.json({ accessToken: signAccessToken(authUser) });
  } catch {
    res.status(401).json({ error: 'refresh token לא תקף' });
  }
});

/** פרטי המשתמש המחובר + ההרשאות שלו (לבניית התפריט ב-PWA). */
authRouter.get('/me', authGuard, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      include: { role: { include: { permissions: true } } },
    });
    if (!user) return res.status(404).json({ error: 'לא נמצא' });
    res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role.key,
      roleName: user.role.name,
      mfaEnabled: user.mfaEnabled,
      permissions: user.role.permissions.map(
        (p: { menuKey: string; canView: boolean; canWrite: boolean; canDelete: boolean }) => ({
          menuKey: p.menuKey,
          view: p.canView,
          write: p.canWrite,
          delete: p.canDelete,
        })
      ),
    });
  } catch (err) {
    next(err);
  }
});

/** התחלת הגדרת 2FA — מחזיר סוד ו-otpauth URL להצגת QR. */
authRouter.post('/2fa/setup', authGuard, async (req, res, next) => {
  try {
    const secret = authenticator.generateSecret();
    await prisma.user.update({ where: { id: req.user!.id }, data: { mfaSecret: secret } });
    const otpauth = authenticator.keyuri(req.user!.email, 'Etaniv', secret);
    res.json({ secret, otpauth });
  } catch (err) {
    next(err);
  }
});

/** הפעלת 2FA לאחר אימות קוד ראשון. */
authRouter.post('/2fa/enable', authGuard, async (req, res, next) => {
  try {
    const { token } = z.object({ token: z.string() }).parse(req.body);
    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!user?.mfaSecret) return res.status(400).json({ error: 'יש להתחיל הגדרת 2FA תחילה' });
    if (!authenticator.verify({ token, secret: user.mfaSecret })) {
      return res.status(401).json({ error: 'קוד שגוי' });
    }
    await prisma.user.update({ where: { id: user.id }, data: { mfaEnabled: true } });
    await audit(req, 'ENABLE_2FA', 'user', user.id);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// ===== ניהול משתמשים (מוגן בהרשאת "permissions") =====

const createUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
  roleKey: z.string(),
  status: z.enum(['PENDING', 'APPROVED', 'DISABLED']).default('APPROVED'),
});

authRouter.post(
  '/users',
  authGuard,
  requirePermission('permissions', 'write'),
  async (req, res, next) => {
    try {
      const data = createUserSchema.parse(req.body);
      const role = await prisma.role.findUnique({ where: { key: data.roleKey } });
      if (!role) return res.status(400).json({ error: 'תפקיד לא קיים' });
      const passwordHash = await bcrypt.hash(data.password, 12);
      const user = await prisma.user.create({
        data: {
          name: data.name,
          email: data.email,
          passwordHash,
          roleId: role.id,
          status: data.status,
        },
      });
      await audit(req, 'CREATE', 'user', user.id);
      res.status(201).json({ id: user.id, name: user.name, email: user.email });
    } catch (err) {
      next(err);
    }
  }
);

authRouter.get(
  '/users',
  authGuard,
  requirePermission('permissions', 'view'),
  async (_req, res, next) => {
    try {
      const users = await prisma.user.findMany({
        include: { role: true },
        orderBy: { createdAt: 'asc' },
      });
      type UserRow = {
        id: string;
        name: string;
        email: string;
        role: { key: string };
        status: string;
        mfaEnabled: boolean;
        lastLogin: Date | null;
      };
      res.json(
        users.map((u: UserRow) => ({
          id: u.id,
          name: u.name,
          email: u.email,
          role: u.role.key,
          status: u.status,
          mfaEnabled: u.mfaEnabled,
          lastLogin: u.lastLogin,
        }))
      );
    } catch (err) {
      next(err);
    }
  }
);

// עדכון משתמש: תפקיד וסטטוס (אישור/השבתה)
authRouter.put('/users/:id', authGuard, requirePermission('permissions', 'write'), async (req, res, next) => {
  try {
    const data = z.object({ roleKey: z.string().optional(), status: z.enum(['PENDING', 'APPROVED', 'DISABLED']).optional() }).parse(req.body);
    const patch: { roleId?: string; status?: 'PENDING' | 'APPROVED' | 'DISABLED' } = {};
    if (data.roleKey) {
      const role = await prisma.role.findUnique({ where: { key: data.roleKey } });
      if (!role) return res.status(400).json({ error: 'תפקיד לא קיים' });
      patch.roleId = role.id;
    }
    if (data.status) patch.status = data.status;
    const user = await prisma.user.update({ where: { id: req.params.id }, data: patch });
    await audit(req, 'UPDATE', 'user', user.id);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// תפקידים + מטריצת הרשאות
authRouter.get('/roles', authGuard, requirePermission('permissions', 'view'), async (_req, res, next) => {
  try {
    const roles = await prisma.role.findMany({ include: { permissions: true }, orderBy: { key: 'asc' } });
    res.json(
      roles.map((r: { key: string; name: string; permissions: { menuKey: string; canView: boolean; canWrite: boolean; canDelete: boolean }[] }) => ({
        key: r.key,
        name: r.name,
        permissions: r.permissions.map((p) => ({ menuKey: p.menuKey, view: p.canView, write: p.canWrite, delete: p.canDelete })),
      }))
    );
  } catch (err) {
    next(err);
  }
});

// עדכון תא במטריצת ההרשאות
authRouter.put('/permissions', authGuard, requirePermission('permissions', 'write'), async (req, res, next) => {
  try {
    const { roleKey, menuKey, view, write, del } = z
      .object({ roleKey: z.string(), menuKey: z.string(), view: z.boolean(), write: z.boolean(), del: z.boolean() })
      .parse(req.body);
    const role = await prisma.role.findUnique({ where: { key: roleKey } });
    if (!role) return res.status(400).json({ error: 'תפקיד לא קיים' });
    await prisma.permission.upsert({
      where: { roleId_menuKey: { roleId: role.id, menuKey } },
      update: { canView: view, canWrite: write, canDelete: del },
      create: { roleId: role.id, menuKey, canView: view, canWrite: write, canDelete: del },
    });
    await audit(req, 'UPDATE', 'permission', `${roleKey}:${menuKey}`);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});
