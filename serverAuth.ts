import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { Request, Response, NextFunction } from 'express';

export const MODULES = ['TICKET','TICKETS_CERRADOS','TECNICO','RENDIR_PASAJES','INFORMES','EMPRESAS','EDITAR_TICKETS','ACTIVIDADES','CAJA_CHICA','COTIZACIONES','RENTAL','INVENTARIO'] as const;
type User = { email: string; name: string; hash: string; modules: string[]; active: boolean; version: string };
const COOKIE = 'crmvsp_session';
const SESSION_MS = 12 * 60 * 60 * 1000;
const adminEmail = () => (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
const secret = () => process.env.SESSION_SECRET?.length && process.env.SESSION_SECRET.length >= 32 ? process.env.SESSION_SECRET : null;
const storePath = () => process.env.CRM_USERS_FILE || '';
export function authReady(): boolean {
  return Boolean(adminEmail().includes('@') && secret() && /^scrypt:[a-f0-9]{32}:[a-f0-9]{128}$/i.test(process.env.ADMIN_PASSWORD_HASH || ''));
}
function readUsers(): User[] {
  if (!storePath()) return [];
  try {
    const data = JSON.parse(fs.readFileSync(storePath(), 'utf8'));
    if (!Array.isArray(data)) throw new Error('Formato de usuarios inválido');
    return data;
  } catch (error: any) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}
function writeUsers(users: User[]): void {
  if (process.env.VERCEL) throw new Error('Los usuarios adicionales necesitan almacenamiento persistente; Vercel no puede guardar esta base en un archivo local');
  const file = storePath();
  if (!file) throw new Error('Configura CRM_USERS_FILE en un volumen persistente');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temp = `${file}.${process.pid}.${randomBytes(6).toString('hex')}.tmp`;
  try {
    fs.writeFileSync(temp, JSON.stringify(users, null, 2), { mode: 0o600, flag: 'wx' });
    fs.renameSync(temp, file);
  } finally { if (fs.existsSync(temp)) fs.unlinkSync(temp); }
}
function verify(hash: string, password: string): boolean {
  if (!/^scrypt:[a-f0-9]{32}:[a-f0-9]{128}$/i.test(hash)) return false;
  const [, salt, expected] = hash.split(':');
  return timingSafeEqual(scryptSync(password, Buffer.from(salt, 'hex'), 64), Buffer.from(expected, 'hex'));
}
const hashPassword = (password: string) => {
  const salt = randomBytes(16);
  return `scrypt:${salt.toString('hex')}:${scryptSync(password, salt, 64).toString('hex')}`;
};
export function authenticate(email: unknown, password: unknown): { email: string; role: 'admin' | 'user'; modules: string[]; version: string } | null {
  if (!authReady() || typeof email !== 'string' || typeof password !== 'string' || password.length > 1024) return null;
  const normalized = email.trim().toLowerCase();
  if (normalized === adminEmail()) return verify(process.env.ADMIN_PASSWORD_HASH!, password)
    ? { email: normalized, role: 'admin', modules: [...MODULES], version: process.env.ADMIN_PASSWORD_HASH! } : null;
  const user = readUsers().find(u => u.email === normalized && u.active);
  return user && verify(user.hash, password) ? { email: user.email, role: 'user', modules: user.modules, version: user.version } : null;
}
const signature = (payload: string) => createHmac('sha256', secret()!).update(payload).digest('base64url');
export function issueSession(res: Response, identity: NonNullable<ReturnType<typeof authenticate>>): void {
  const payload = Buffer.from(JSON.stringify({ email: identity.email, version: identity.version, expires: Date.now() + SESSION_MS })).toString('base64url');
  res.setHeader('Set-Cookie', `${COOKIE}=${payload}.${signature(payload)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${SESSION_MS / 1000}` + (process.env.NODE_ENV === 'production' ? '; Secure' : ''));
}
export function clearSession(res: Response): void {
  res.setHeader('Set-Cookie', `${COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0` + (process.env.NODE_ENV === 'production' ? '; Secure' : ''));
}
export function currentUser(req: Request): { email: string; role: 'admin' | 'user'; modules: string[] } | null {
  if (!authReady()) return null;
  const cookie = req.headers.cookie?.split(';').map(v => v.trim()).find(v => v.startsWith(`${COOKIE}=`));
  if (!cookie) return null;
  const value = cookie.slice(COOKIE.length + 1);
  const dot = value.indexOf('.');
  if (dot < 1) return null;
  const payload = value.slice(0, dot);
  const received = Buffer.from(value.slice(dot + 1), 'base64url');
  const expected = Buffer.from(signature(payload), 'base64url');
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) return null;
  try {
    const session = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (typeof session.expires !== 'number' || session.expires <= Date.now() || typeof session.email !== 'string') return null;
    if (session.email === adminEmail()) return session.version === process.env.ADMIN_PASSWORD_HASH ? { email: session.email, role: 'admin', modules: [...MODULES] } : null;
    const user = readUsers().find(u => u.email === session.email && u.active && u.version === session.version);
    return user ? { email: user.email, role: 'user', modules: user.modules } : null;
  } catch { return null; }
}
export function requireUser(req: Request, res: Response, next: NextFunction): void {
  if (currentUser(req)) return next();
  res.status(401).json({ error: 'Inicia sesión' });
}
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (currentUser(req)?.role === 'admin') return next();
  res.status(403).json({ error: 'Solo el administrador puede realizar esta acción' });
}
export function listUsers(): Array<Omit<User, 'hash' | 'version'>> {
  return readUsers().map(({ email, name, modules, active }) => ({ email, name, modules, active }));
}
export function saveUser(input: any): void {
  const email = typeof input?.email === 'string' ? input.email.trim().toLowerCase() : '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email === adminEmail()) throw new Error('Correo no válido o reservado para el administrador');
  if (typeof input.name !== 'string' || !input.name.trim() || input.name.length > 100) throw new Error('Indica un nombre válido');
  if (!Array.isArray(input.modules) || input.modules.some((m: unknown) => !MODULES.includes(m as any))) throw new Error('Módulos no válidos');
  const users = readUsers();
  const index = users.findIndex(u => u.email === email);
  const previous = users[index];
  if ((!previous || input.password) && (typeof input.password !== 'string' || input.password.length < 12)) throw new Error('La contraseña debe tener al menos 12 caracteres');
  const user: User = { email, name: input.name.trim(), hash: input.password ? hashPassword(input.password) : previous.hash, modules: [...new Set<string>(input.modules)], active: input.active !== false, version: randomBytes(16).toString('hex') };
  if (index < 0) users.push(user); else users[index] = user;
  writeUsers(users);
}
