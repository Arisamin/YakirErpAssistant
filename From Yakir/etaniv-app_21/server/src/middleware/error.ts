import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

export function notFound(_req: Request, res: Response) {
  res.status(404).json({ error: 'הנתיב לא נמצא' });
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    return res.status(400).json({ error: 'שגיאת ולידציה', details: err.flatten() });
  }
  const e = err as { code?: string; message?: string; status?: number };
  // שגיאה עסקית עם קוד סטטוס מפורש (למשל חוקי-תהליך)
  if (typeof e?.status === 'number' && e.status >= 400 && e.status < 500) {
    return res.status(e.status).json({ error: e.message || 'בקשה שגויה' });
  }
  // כפילות מפתח ייחודי ב-Prisma
  if (e?.code === 'P2002') {
    return res.status(409).json({ error: 'ערך כבר קיים (כפילות)' });
  }
  console.error(err);
  res.status(500).json({ error: 'שגיאת שרת פנימית' });
}
