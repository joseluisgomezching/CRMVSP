import { createHmac, scryptSync, timingSafeEqual } from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';

function adminEmail(): string {
  return (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
}
const COOKIE = 'crmvsp_session';
const SESSION_MS = 12 * 60 * 60 * 1000;

function secret(): string | null {
  const value = process.env.SESSION_SECRET;
  return value && value.length >= 32 ? value : null;
}

export function authReady(): boolean {
  return Boolean(adminEmail().includes('@') && secret() && /^scrypt:[a-f0-9]{32}:[a-f0-9]{128}$/i.test(process.env.ADMIN_PASSWORD_HASH || ''));
}

export function verifyAdminPassword(email: unknown, password: unknown): boolean {
  if (!authReady() || typeof email !== 'string' || typeof password !== 'string') return false;
  if (email.trim().toLowerCase() !== adminEmail() || password.length > 1024) return false;
  const [, salt, expected] = process.env.ADMIN_PASSWORD_HASH!.split(':');
  const actual = scryptSync(password, Buffer.from(salt, 'hex'), 64);
  return timingSafeEqual(actual, Buffer.from(expected, 'hex'));
}

function signature(payload: string): string {
  return createHmac('sha256', secret()!).update(payload).digest('base64url');
}

export function issueSession(res: Response): void {
  const payload = Buffer.from(JSON.stringify({ email: adminEmail(), expires: Date.now() + SESSION_MS })).toString('base64url');
  const cookie = `${COOKIE}=${payload}.${signature(payload)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${SESSION_MS / 1000}`;
  res.setHeader('Set-Cookie', cookie + (process.env.NODE_ENV === 'production' ? '; Secure' : ''));
}

export function clearSession(res: Response): void {
  res.setHeader('Set-Cookie', `${COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0` + (process.env.NODE_ENV === 'production' ? '; Secure' : ''));
}

export function isAdmin(req: Request): boolean {
  if (!authReady()) return false;
  const cookie = req.headers.cookie?.split(';').map(v => v.trim()).find(v => v.startsWith(`${COOKIE}=`));
  if (!cookie) return false;
  const value = cookie.slice(COOKIE.length + 1);
  const dot = value.indexOf('.');
  if (dot < 1) return false;
  const payload = value.slice(0, dot);
  const received = Buffer.from(value.slice(dot + 1), 'base64url');
  const expected = Buffer.from(signature(payload), 'base64url');
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) return false;
  try {
    const session = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return session.email === adminEmail() && typeof session.expires === 'number' && session.expires > Date.now();
  } catch { return false; }
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (isAdmin(req)) return next();
  res.status(401).json({ error: 'Inicia sesión como administrador' });
}

export function configuredAdminEmail(): string {
  return adminEmail();
}
