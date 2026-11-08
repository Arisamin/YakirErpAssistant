import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../db';

type Action = 'view' | 'write' | 'delete';

/**
 * אכיפת הרשאה בשרת. חוסם כל פעולה שאינה מורשית לתפקיד המשתמש — גם אם הממשק ניסה לעקוף.
 * זהו לב מנגנון האבטחה: ההרשאה נבדקת מול מסד הנתונים בכל בקשה.
 */
export function requirePermission(menuKey: string, action: Action) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const user = req.user;
    if (!user) return res.status(401).json({ error: 'לא מחובר' });

    const role = await prisma.role.findUnique({
      where: { key: user.roleKey },
      include: { permissions: { where: { menuKey } } },
    });
    const perm = role?.permissions[0];
    const allowed =
      perm &&
      ((action === 'view' && perm.canView) ||
        (action === 'write' && perm.canWrite) ||
        (action === 'delete' && perm.canDelete));

    if (!allowed) {
      return res
        .status(403)
        .json({ error: `אין הרשאת ${action === 'view' ? 'צפייה' : action === 'write' ? 'כתיבה' : 'מחיקה'} למודול זה` });
    }
    next();
  };
}
