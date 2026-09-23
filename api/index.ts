import type { Request, Response } from 'express';
import { createApp } from '../server';

const appPromise = createApp();

// Vercel rewrites /api/* here and passes the original path as a query parameter.
export default async function handler(req: Request, res: Response) {
  const url = new URL(req.url || '/', 'http://localhost');
  const path = url.searchParams.get('path');
  if (!path || path.includes('..') || /[\r\n]/.test(path)) {
    res.status(404).json({ error: 'Ruta de API no encontrada' });
    return;
  }
  url.searchParams.delete('path');
  req.url = `/api/${path}${url.searchParams.size ? `?${url.searchParams.toString()}` : ''}`;
  const app = await appPromise;
  app(req, res);
}
