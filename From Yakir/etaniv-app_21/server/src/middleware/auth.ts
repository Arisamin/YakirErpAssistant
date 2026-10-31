import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../env';

export interface AuthUser {
  id: string;
  email: string;
  roleKey: string;
}

// הרחבת טיפוס Request כך שיכיל את המשתמש המאומת
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export function signAccessToken(user: AuthUser): string {
  return jwt.sign(user, env.jwtAccessSecret, { expiresIn: env.accessTtl as any });
}

export function signRefreshToken(user: AuthUser): string {
  return jwt.sign(user, env.jwtRefreshSecret, { expiresIn: env.refreshTtl as any });
}

export function verifyRefreshToken(token: string): AuthUser {
  return jwt.verify(token, env.jwtRefreshSecret) as AuthUser;
}

/** מאמת JWT ומצרף את המשתמש לבקשה. חוסם אם אין טוקן תקף. */
export function authGuard(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'לא מחובר' });
  }
  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, env.jwtAccessSecret) as AuthUser;
    req.user = { id: payload.id, email: payload.email, roleKey: payload.roleKey };
    next();
  } catch {
    return res.status(401).json({ error: 'טוקן לא תקף או פג תוקף' });
  }
}
