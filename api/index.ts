import type { Request, Response } from 'express';
import server from '../server.cjs';

const { createApp } = server;

let appPromise: ReturnType<typeof createApp> | undefined;

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
  try {
    const app = await (appPromise ||= createApp());
    app(req, res);
  } catch (error) {
    appPromise = undefined;
    console.error('CRMVSP API startup failed:', error);
    if (!res.headersSent) res.status(503).json({ error: 'La API no pudo iniciar. Revisa los registros de la función en Vercel.' });
  }
}
