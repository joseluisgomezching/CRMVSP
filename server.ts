import { GoogleGenAI } from "@google/genai";
import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { GoogleAuth, OAuth2Client } from 'google-auth-library';
import { authReady, clearSession, currentUser, authenticate, issueSession, requireAdmin, requireUser, listUsers, saveUser } from './serverAuth';

interface StoredSignature {
  signature: string;
  clientName?: string;
  driveUrl?: string;
  savedToDrive?: boolean;
  savedToSheet?: boolean;
  timestamp: number;
}

const signatures = new Map<string, StoredSignature>();
const SIGNATURES_DIR = path.join('/tmp', 'vsp_signatures');
const googleAuth = new GoogleAuth({
  credentials: process.env.GOOGLE_SERVICE_ACCOUNT_JSON
    ? JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON)
    : undefined,
  scopes: ['https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/drive']
});

const ownerOAuth = process.env.GOOGLE_OAUTH_CLIENT_ID && process.env.GOOGLE_OAUTH_CLIENT_SECRET && process.env.GOOGLE_OAUTH_REFRESH_TOKEN
  ? new OAuth2Client(process.env.GOOGLE_OAUTH_CLIENT_ID, process.env.GOOGLE_OAUTH_CLIENT_SECRET)
  : null;
if (ownerOAuth) ownerOAuth.setCredentials({ refresh_token: process.env.GOOGLE_OAUTH_REFRESH_TOKEN });

async function getServerToken(): Promise<string> {
  const client = ownerOAuth || await googleAuth.getClient();
  const result = await client.getAccessToken();
  if (!result.token) throw new Error('Servidor sin credenciales para Google Sheets y Drive');
  return result.token;
}

const ALLOWED_SHEETS = new Set([
  '19BcJR3V4tBtwKrh97v5R0PLlMt1CoXwmWwFmIFFy2lk',
  '1CfvIvSb1lpF3qAEfblOSmsXEsqgPC2lqZInyYmMEHog'
]);
const ALLOWED_FOLDERS = new Set([
  '14zJIbLf9bfeM0RZiwsPDXGzcqfUWJw0o',
  '1Y0D-ZJ6ufLK6zuVxvp5vZjx7yq6hj_LV',
  '1EEQ9aMpJ_mrhODiGVDWolTyq5a6ScLcZ',
  '1nZKrXULwBYnjcfn9GiBjNvIZxHLyZsEs'
]);
const uploadedFiles = new Map<string, string>();
const FOLDER_MODULES: Record<string, string[]> = {
  '14zJIbLf9bfeM0RZiwsPDXGzcqfUWJw0o': ['TICKET','TECNICO','EDITAR_TICKETS','INFORMES'],
  '1Y0D-ZJ6ufLK6zuVxvp5vZjx7yq6hj_LV': ['TICKET','TECNICO','EDITAR_TICKETS'],
  '1EEQ9aMpJ_mrhODiGVDWolTyq5a6ScLcZ': ['EMPRESAS'],
  '1nZKrXULwBYnjcfn9GiBjNvIZxHLyZsEs': ['TICKET','TECNICO','INFORMES']
};
// Sheet access is granted per data group. Shared tables (for example TICKET) are
// deliberately available to more than one module, because those modules use them.
const TABLE_MODULES: Record<string, string[]> = {
  TICKET: ['TICKET','TICKETS_CERRADOS','TECNICO','EDITAR_TICKETS','INFORMES','RENDIR_PASAJES'],
  EMPRESA: ['TICKET','EMPRESAS','COTIZACIONES','EDITAR_TICKETS'],
  CONTACTOS: ['TICKET','EMPRESAS','EDITAR_TICKETS'],
  TECNICOS: ['TICKET','TECNICO','EMPRESAS','EDITAR_TICKETS'],
  CONTRATO: ['TICKET','EMPRESAS','INFORMES'],
  FOTOSTICKET: ['TECNICO','TICKET','INFORMES','EDITAR_TICKETS'],
  ACTIVIDADES: ['TECNICO','TICKET','INFORMES','EDITAR_TICKETS'],
  FOTOACT: ['TECNICO','INFORMES','EDITAR_TICKETS'],
  REPUESTOS: ['TECNICO','INVENTARIO','EDITAR_TICKETS'],
  INTERNAMIENTO: ['TECNICO','INVENTARIO','EDITAR_TICKETS'],
  RUTAS: ['RENDIR_PASAJES','TECNICO'],
  TRANSPORTE: ['RENDIR_PASAJES','TECNICO'],
  CAJA: ['CAJA_CHICA'],
  ACTIVIDADESDIARIAS: ['ACTIVIDADES'],
  TRANACTI: ['TECNICO','INFORMES'],
  COTIZACION: ['COTIZACIONES'], CLIENTE: ['COTIZACIONES'], VENDEDOR: ['COTIZACIONES'],
  VENTA: ['COTIZACIONES'], ITEMVENTA: ['COTIZACIONES'], CALCULOVENTA: ['COTIZACIONES'],
  ALQUILER: ['COTIZACIONES'], ITEMALQUILER: ['COTIZACIONES'], CALCULOALQUILER: ['COTIZACIONES'],
  OUT: ['COTIZACIONES'], ITEMOUT: ['COTIZACIONES'], CALCULOOUT: ['COTIZACIONES'],
  ACCESOS: []
};
const normalizeTab = (value: string) => value.replace(/^'/, '').replace(/'$/, '').replace(/''/g, "'").normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Z0-9]/gi, '').toUpperCase();
function tabFromRange(range: unknown): string | null {
  if (typeof range !== 'string') return null;
  const decoded = decodeURIComponent(range);
  const title = decoded.split('!')[0];
  return normalizeTab(title);
}
function canUseTab(modules: string[], range: unknown): boolean {
  const tab = tabFromRange(range);
  return !!tab && (TABLE_MODULES[tab] || []).some(module => modules.includes(module));
}

// Upload signature to Google Drive folder 14zJIbLf9bfeM0RZiwsPDXGzcqfUWJw0o with name FIRMA-IDTICKET.jpg
async function uploadSignatureToDrive(
  ticketId: string,
  base64DataUrl: string,
  token: string
): Promise<string> {
  const folderId = '14zJIbLf9bfeM0RZiwsPDXGzcqfUWJw0o';
  const fileName = `FIRMA-${ticketId}.jpg`;

  const base64Data = base64DataUrl.replace(/^data:image\/\w+;base64,/, '');
  const buffer = Buffer.from(base64Data, 'base64');

  const metadata = {
    name: fileName,
    parents: [folderId]
  };

  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  form.append('file', new Blob([buffer], { type: 'image/jpeg' }), fileName);

  let driveRes = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink,webContentLink',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`
      },
      body: form
    }
  );

  if (!driveRes.ok) {
    const errText = await driveRes.text();
    console.warn(`[uploadSignatureToDrive] Error con carpeta ${folderId}:`, errText);
    if (errText.includes('storageQuotaExceeded') || errText.includes('quota has been exceeded')) {
      throw new Error(`El almacenamiento de Google Drive está lleno. El administrador debe liberar espacio en su cuenta o ampliar la cuota de almacenamiento.`);
    }

    // Reintentar subida sin especificar parent folder
    console.log('[uploadSignatureToDrive] Reintentando subida en raíz de Google Drive...');
    const formRoot = new FormData();
    formRoot.append('metadata', new Blob([JSON.stringify({ name: fileName })], { type: 'application/json' }));
    formRoot.append('file', new Blob([buffer], { type: 'image/jpeg' }), fileName);

    driveRes = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink,webContentLink',
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formRoot
      }
    );

    if (!driveRes.ok) {
      const errText2 = await driveRes.text();
      throw new Error(`Google Drive API error (${driveRes.status}): ${errText2}`);
    }
  }

  const data: any = await driveRes.json();
  const fileId = data.id;

  // Make public / readable
  if (fileId) {
    try {
      await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/permissions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ role: 'reader', type: 'anyone' })
      });
    } catch (e) {
      console.warn('Could not set permissions on Drive file:', e);
    }
  }

  const driveUrl = data.webViewLink || (fileId ? `https://drive.google.com/file/d/${fileId}/view` : '');
  return driveUrl;
}

// Update FIRMA column in Google Sheets table TICKET
async function updateTicketSignatureInSheet(
  ticketId: string,
  driveUrl: string,
  token: string,
  targetStatus?: string
): Promise<{ row: number; colLetter: string }> {
  const spreadsheetId = '19BcJR3V4tBtwKrh97v5R0PLlMt1CoXwmWwFmIFFy2lk';

  // 1. Get header row of TICKET
  const headerRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'TICKET'!A1:AZ1`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  let headers: string[] = [];
  if (headerRes.ok) {
    const hData: any = await headerRes.json();
    headers = ((hData.values && hData.values[0]) || []).map((h: string) => (h || '').trim());
  }

  const norm = (s: string) => (s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

  let idColIdx = headers.findIndex(h => {
    const n = norm(h);
    return n === 'IDTICKET' || n === 'ID' || n === 'CODIGO';
  });
  if (idColIdx === -1) idColIdx = 0; // Col A

  let firmaColIdx = headers.findIndex(h => {
    const n = norm(h);
    return n === 'FIRMA' || n === 'FIRMACLIENTE';
  });
  if (firmaColIdx === -1) firmaColIdx = 18; // Col S (index 18)

  const toLetter = (c: number): string => {
    let temp, letter = '';
    let col = c + 1;
    while (col > 0) {
      temp = (col - 1) % 26;
      letter = String.fromCharCode(temp + 65) + letter;
      col = Math.floor((col - temp - 1) / 26);
    }
    return letter;
  };

  const idColLetter = toLetter(idColIdx);
  const firmaColLetter = toLetter(firmaColIdx);

  // 2. Scan ID column to find exact row
  const idColRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'TICKET'!${idColLetter}:${idColLetter}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  if (!idColRes.ok) {
    const err = await idColRes.text();
    throw new Error(`Sheets API ID column error (${idColRes.status}): ${err}`);
  }

  const idData: any = await idColRes.json();
  const rows: string[][] = idData.values || [];
  const targetId = norm(ticketId);

  let targetRow = -1;
  for (let i = 1; i < rows.length; i++) {
    const val = norm(rows[i]?.[0] || '');
    if (val === targetId) {
      targetRow = i + 1;
      break;
    }
  }

  if (targetRow === -1) {
    throw new Error(`Ticket ${ticketId} no encontrado en la hoja TICKET`);
  }

  // 3. Write driveUrl to cell TICKET!${firmaColLetter}${targetRow}
  const cellRange = encodeURIComponent(`'TICKET'!${firmaColLetter}${targetRow}`);
  const updateRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${cellRange}?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        values: [[driveUrl]]
      })
    }
  );

  if (!updateRes.ok) {
    const err = await updateRes.text();
    throw new Error(`Error escribiendo en celda FIRMA (${updateRes.status}): ${err}`);
  }

  // 4. Si targetStatus === 'CERRADO', actualizar ESTADO a CERRADO y FECHA DE CIERRE
  if (targetStatus && targetStatus.trim().toUpperCase() === 'CERRADO') {
    const estadoColIdx = headers.findIndex(h => norm(h) === 'ESTADO');
    if (estadoColIdx !== -1) {
      const estadoColLetter = toLetter(estadoColIdx);
      try {
        await fetch(
          `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'TICKET'!${estadoColLetter}${targetRow}?valueInputOption=USER_ENTERED`,
          {
            method: 'PUT',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ values: [['CERRADO']] })
          }
        );
      } catch (e) {
        console.warn('Error actualizando ESTADO a CERRADO:', e);
      }
    }

    const cierreColIdx = headers.findIndex(h => {
      const n = norm(h);
      return n === 'FECHADECIERRE' || n === 'FECHACIERRE';
    });
    if (cierreColIdx !== -1) {
      const cierreColLetter = toLetter(cierreColIdx);
      const now = new Date();
      const pad = (n: number) => String(n).padStart(2, '0');
      const dateStr = `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()}`;
      try {
        await fetch(
          `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'TICKET'!${cierreColLetter}${targetRow}?valueInputOption=USER_ENTERED`,
          {
            method: 'PUT',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ values: [[dateStr]] })
          }
        );
      } catch (e) {
        console.warn('Error actualizando FECHA DE CIERRE:', e);
      }
    }
  }

  console.log(`[GoogleSheet] Successfully updated ticket ${ticketId} at row ${targetRow}, col ${firmaColLetter} with ${driveUrl}`);
  return { row: targetRow, colLetter: firmaColLetter };
}

try {
  if (!fs.existsSync(SIGNATURES_DIR)) {
    fs.mkdirSync(SIGNATURES_DIR, { recursive: true });
  }
} catch (e) {
  console.warn('Could not create signatures disk directory:', e);
}

function saveSignatureToDisk(id: string, data: StoredSignature) {
  try {
    const filePath = path.join(SIGNATURES_DIR, `${encodeURIComponent(id)}.json`);
    fs.writeFileSync(filePath, JSON.stringify(data), 'utf-8');
  } catch (e) {
    console.warn('Could not save signature to disk:', e);
  }
}

function getSignatureFromDisk(id: string): StoredSignature | null {
  try {
    const filePath = path.join(SIGNATURES_DIR, `${encodeURIComponent(id)}.json`);
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(raw) as StoredSignature;
    }
  } catch (e) {
    console.warn('Could not read signature from disk:', e);
  }
  return null;
}

function deleteSignatureFromDisk(id: string) {
  try {
    const filePath = path.join(SIGNATURES_DIR, `${encodeURIComponent(id)}.json`);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (e) {}
}

const publicTickets = new Map<string, any>();
const PUBLIC_TICKETS_DIR = path.join('/tmp', 'vsp_public_tickets');

try {
  if (!fs.existsSync(PUBLIC_TICKETS_DIR)) {
    fs.mkdirSync(PUBLIC_TICKETS_DIR, { recursive: true });
  }
} catch (e) {
  console.warn('Could not create public tickets directory:', e);
}

function savePublicTicketToDisk(id: string, data: any) {
  try {
    const filePath = path.join(PUBLIC_TICKETS_DIR, `${encodeURIComponent(id)}.json`);
    fs.writeFileSync(filePath, JSON.stringify(data), 'utf-8');
  } catch (e) {
    console.warn('Could not save public ticket to disk:', e);
  }
}

function getPublicTicketFromDisk(id: string): any | null {
  try {
    const filePath = path.join(PUBLIC_TICKETS_DIR, `${encodeURIComponent(id)}.json`);
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(raw);
    }
  } catch (e) {
    console.warn('Could not read public ticket from disk:', e);
  }
  return null;
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;
  app.set('trust proxy', 1);
  const failedLogins = new Map<string, { count: number; until: number }>();

  // The app and API are served from the same origin.
  app.use(express.json({ limit: '15mb' }));

  app.get('/api/auth/me', (req, res) => {
    if (!authReady()) return res.status(503).json({ error: 'Configura ADMIN_EMAIL, ADMIN_PASSWORD_HASH y SESSION_SECRET en el servidor' });
    const user = currentUser(req);
    res.json(user ? { authenticated: true, ...user, tables: user.role === 'admin' ? Object.keys(TABLE_MODULES).filter(t => t !== 'ACCESOS') : Object.keys(TABLE_MODULES).filter(t => canUseTab(user.modules, t)) } : { authenticated: false });
  });

  app.post('/api/auth/login', (req, res) => {
    if (!authReady()) return res.status(503).json({ error: 'Acceso del administrador aún no configurado' });
    const key = req.ip || req.socket.remoteAddress || 'unknown';
    const attempt = failedLogins.get(key);
    if (attempt && attempt.until > Date.now() && attempt.count >= 5) {
      return res.status(429).json({ error: 'Demasiados intentos. Vuelve a probar en 15 minutos.' });
    }
    const user = authenticate(req.body?.email, req.body?.password);
    if (!user) {
      failedLogins.set(key, { count: (attempt?.until || 0) > Date.now() ? attempt!.count + 1 : 1, until: Date.now() + 15 * 60_000 });
      return res.status(401).json({ error: 'Correo o contraseña incorrectos' });
    }
    failedLogins.delete(key);
    issueSession(res, user);
    res.json({ authenticated: true, email: user.email, role: user.role, modules: user.modules });
  });

  app.post('/api/auth/logout', (_req, res) => {
    clearSession(res);
    res.json({ authenticated: false });
  });

  app.get('/api/users', requireAdmin, (_req, res) => {
    try { res.json(listUsers()); } catch (error: any) { res.status(500).json({ error: error.message }); }
  });
  app.put('/api/users', requireAdmin, (req, res) => {
    try { saveUser(req.body); res.json({ success: true }); }
    catch (error: any) { res.status(400).json({ error: error.message }); }
  });
  const requireModules = (...modules: string[]): express.RequestHandler => (req, res, next) => {
    const user = currentUser(req);
    if (user && (user.role === 'admin' || modules.some(module => user.modules.includes(module)))) return next();
    res.status(403).json({ error: 'Módulo no autorizado' });
  };

  app.use('/api/google', requireUser, express.raw({ type: () => true, limit: '20mb' }));

  // Fixed Google API proxy: credentials stay on the server. Never proxy arbitrary hosts.
  app.use('/api/google/:service', async (req, res) => {
    try {
      const service = req.params.service;
      let rawPath = req.originalUrl.slice(`/api/google/${service}`.length);
      const [pathname] = rawPath.split('?');
      let base: string;
      if (service === 'health' && req.method === 'GET') {
        await getServerToken();
        return res.json({ ready: true });
      }
      if (service === 'sheets') {
        const match = pathname.match(/^\/v4\/spreadsheets\/([A-Za-z0-9_-]+)(?:\/|:|$)/);
        if (!match || !ALLOWED_SHEETS.has(match[1])) return res.status(403).json({ error: 'Hoja no permitida' });
        const user = currentUser(req)!;
        if (user.role !== 'admin') {
          const isQuotes = match[1] === '1CfvIvSb1lpF3qAEfblOSmsXEsqgPC2lqZInyYmMEHog';
          if (isQuotes && !user.modules.includes('COTIZACIONES')) return res.sendStatus(403);
          const tail = pathname.slice(match[0].length - (match[0].endsWith('/') || match[0].endsWith(':') ? 1 : 0));
          const parsed = req.body && Buffer.isBuffer(req.body) ? JSON.parse(req.body.toString('utf8') || '{}') : (req.body || {});
          if (tail.startsWith(':batchUpdate')) return res.sendStatus(403); // structural changes are administrator only
          if (tail === '' && req.method !== 'GET') return res.sendStatus(403);
          if (tail === '') rawPath = `/v4/spreadsheets/${match[1]}?fields=sheets.properties`;
          if (tail.startsWith('/values:batchGet')) {
            const ranges = new URL(req.originalUrl, 'http://localhost').searchParams.getAll('ranges');
            if (!ranges.length || ranges.some(range => !canUseTab(user.modules, range))) return res.sendStatus(403);
          } else if (tail.startsWith('/values:batchUpdate')) {
            if (!Array.isArray(parsed.data) || parsed.data.some((item: any) => !canUseTab(user.modules, item.range))) return res.sendStatus(403);
          } else if (tail.startsWith('/values/')) {
            if (!canUseTab(user.modules, tail.slice('/values/'.length).split(':')[0])) return res.sendStatus(403);
          } else if (tail !== '') return res.sendStatus(403);
        }
        base = 'https://sheets.googleapis.com';
      } else if (service === 'drive') {
        const user = currentUser(req)!;
        if (user.role !== 'admin') {
          const fileMatch = pathname.match(/^\/v3\/files\/([A-Za-z0-9_-]+)$/);
          const permissionMatch = pathname.match(/^\/v3\/files\/([A-Za-z0-9_-]+)\/permissions$/);
          if (permissionMatch) {
            if (req.method !== 'POST' || uploadedFiles.get(permissionMatch[1]) !== user.email) return res.sendStatus(403);
          } else if (fileMatch && req.method === 'GET') {
            const metadata = await fetch(`https://www.googleapis.com/drive/v3/files/${fileMatch[1]}?fields=parents&supportsAllDrives=true`, {
              headers: { Authorization: `Bearer ${await getServerToken()}` }
            });
            if (!metadata.ok) return res.sendStatus(403);
            const file = await metadata.json() as { parents?: string[] };
            if (!file.parents?.some(folder => FOLDER_MODULES[folder]?.some(module => user.modules.includes(module)))) return res.sendStatus(403);
          } else return res.sendStatus(403);
        }
        if (req.method !== 'GET' || !/^\/v3\/files\/[A-Za-z0-9_-]+$/.test(pathname)) {
          // Only permission changes on files uploaded during this server process.
          const permission = pathname.match(/^\/v3\/files\/([A-Za-z0-9_-]+)\/permissions$/);
          if (!permission || req.method !== 'POST' || !uploadedFiles.has(permission[1])) {
            return res.status(403).json({ error: 'Operación Drive no permitida' });
          }
        }
        base = 'https://www.googleapis.com/drive';
      } else if (service === 'upload') {
        if (req.method !== 'POST' || pathname !== '/v3/files') return res.sendStatus(403);
        const raw = req.body as Buffer;
        const metadata = raw.toString('utf8').match(/\{\s*"name"\s*:\s*"[^"]+"\s*,\s*"parents"\s*:\s*\[\s*"([A-Za-z0-9_-]+)"\s*\]\s*\}/);
        if (!metadata || !ALLOWED_FOLDERS.has(metadata[1])) {
          return res.status(403).json({ error: 'Carpeta de destino no permitida' });
        }
        const user = currentUser(req)!;
        if (user.role !== 'admin' && !FOLDER_MODULES[metadata[1]]?.some(module => user.modules.includes(module))) return res.sendStatus(403);
        base = 'https://www.googleapis.com/upload';
      } else return res.sendStatus(404);

      const upstream = await fetch(base + rawPath, {
        method: req.method,
        headers: {
          Authorization: `Bearer ${await getServerToken()}`,
          ...(req.headers['content-type'] ? { 'Content-Type': String(req.headers['content-type']) } : {})
        },
        body: ['GET', 'HEAD'].includes(req.method) ? undefined : Buffer.isBuffer(req.body) ? req.body : JSON.stringify(req.body)
      });
      const body = Buffer.from(await upstream.arrayBuffer());
      if (service === 'upload' && upstream.ok) {
        try { const id = JSON.parse(body.toString()).id; if (id) uploadedFiles.set(id, currentUser(req)!.email); } catch {}
      }
      if (service === 'sheets' && currentUser(req)?.role !== 'admin' && pathname.match(/^\/v4\/spreadsheets\/[A-Za-z0-9_-]+$/) && upstream.ok) {
        const data = JSON.parse(body.toString('utf8'));
        if (Array.isArray(data.sheets)) data.sheets = data.sheets.filter((sheet: any) => canUseTab(currentUser(req)!.modules, sheet.properties?.title));
        return res.status(upstream.status).json(data);
      }
      res.status(upstream.status);
      res.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/octet-stream');
      res.send(body);
    } catch (error: any) {
      res.status(502).json({ error: error.message || 'Error de conexión con Google' });
    }
  });

  // Service Worker route with proper headers for background Windows notifications
  app.get('/sw.js', (req, res) => {
    res.setHeader('Service-Worker-Allowed', '/');
    res.setHeader('Content-Type', 'application/javascript; charset=UTF-8');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    const swPath = path.join(process.cwd(), 'public', 'sw.js');
    if (fs.existsSync(swPath)) {
      return res.sendFile(swPath);
    }
    res.status(404).send('Service worker not found');
  });

  // Manifest route for PWA
  app.get('/manifest.json', (req, res) => {
    res.setHeader('Content-Type', 'application/manifest+json; charset=UTF-8');
    const manifestPath = path.join(process.cwd(), 'public', 'manifest.json');
    if (fs.existsSync(manifestPath)) {
      return res.sendFile(manifestPath);
    }
    res.status(404).send('Manifest not found');
  });

  // API to save a public signature from the client canvas AND directly persist to Google Drive & Google Sheets
  app.post('/api/signatures/:id', async (req, res) => {
    const { id } = req.params;
    const { signature, clientName, targetStatus } = req.body;
    if (!signature) {
      return res.status(400).json({ error: 'No signature provided' });
    }

    let token: string | null = null;
    try { token = await getServerToken(); } catch (error) { console.error(error); }

    let driveUrl = '';
    let savedToDrive = false;
    let savedToSheet = false;
    let driveError: string | null = null;
    let sheetError: string | null = null;

    if (token) {
      try {
        console.log(`[POST /api/signatures/${id}] Subiendo firma a Google Drive...`);
        driveUrl = await uploadSignatureToDrive(id, signature, token);
        savedToDrive = true;
        console.log(`[POST /api/signatures/${id}] Firma guardada en Drive: ${driveUrl}`);

        try {
          console.log(`[POST /api/signatures/${id}] Guardando URL en columna FIRMA de tabla TICKET...`);
          await updateTicketSignatureInSheet(id, driveUrl, token, targetStatus);
          savedToSheet = true;
          console.log(`[POST /api/signatures/${id}] ¡URL registrada exitosamente en columna FIRMA!`);
        } catch (sErr: any) {
          console.error(`[POST /api/signatures/${id}] Error actualizando columna FIRMA en Sheets:`, sErr);
          sheetError = sErr.message || String(sErr);
        }
      } catch (dErr: any) {
        console.error(`[POST /api/signatures/${id}] Error subiendo imagen a Drive:`, dErr);
        driveError = dErr.message || String(dErr);
      }
    } else {
      console.warn(`[POST /api/signatures/${id}] No hay token OAuth de Google disponible en servidor todavía; se mantendrá en cola.`);
    }

    const data: StoredSignature = {
      signature,
      clientName: typeof clientName === 'string' ? clientName.trim() : undefined,
      driveUrl: driveUrl || undefined,
      savedToDrive,
      savedToSheet,
      timestamp: Date.now()
    };
    signatures.set(id, data);
    saveSignatureToDisk(id, data);

    res.json({ 
      success: true, 
      driveUrl: driveUrl || undefined,
      savedToDrive,
      savedToSheet,
      driveError,
      sheetError,
      message: savedToSheet
        ? 'Firma guardada en Google Drive y registrada exitosamente en la columna FIRMA del Ticket'
        : (savedToDrive 
            ? 'Firma guardada en Google Drive (pendiente registro en tabla)' 
            : 'Firma recibida correctamente') 
    });
  });

  // API to manually force sync of an existing pending signature to Drive and Sheet
  app.post('/api/sync-signature-to-sheet/:id', requireModules('TECNICO','TICKET'), async (req, res) => {
    const { id } = req.params;
    let token: string | null = null;
    try { token = await getServerToken(); } catch (error) { console.error(error); }
    if (!token) {
      return res.status(400).json({ error: 'No Google OAuth token available for sync' });
    }

    let data = signatures.get(id) || getSignatureFromDisk(id) || undefined;
    if (!data || !data.signature) {
      return res.status(404).json({ error: 'No hay firma pendiente para este ticket' });
    }

    let driveUrl = data.driveUrl || '';
    let savedToDrive = Boolean(data.savedToDrive);
    let savedToSheet = Boolean(data.savedToSheet);

    try {
      if (!driveUrl) {
        driveUrl = await uploadSignatureToDrive(id, data.signature, token);
        savedToDrive = true;
      }
      if (!savedToSheet) {
        await updateTicketSignatureInSheet(id, driveUrl, token);
        savedToSheet = true;
      }

      data.driveUrl = driveUrl;
      data.savedToDrive = savedToDrive;
      data.savedToSheet = savedToSheet;
      signatures.set(id, data);
      saveSignatureToDisk(id, data);

      res.json({ success: true, driveUrl, savedToSheet, message: 'Sincronización a Drive y Sheets completada' });
    } catch (e: any) {
      res.status(500).json({ error: e.message || String(e) });
    }
  });

  // API to get a signature (polled by technician app)
  app.get('/api/signatures/:id', requireModules('TECNICO','TICKET'), (req, res) => {
    const { id } = req.params;
    let data = signatures.get(id);
    if (!data) {
      data = getSignatureFromDisk(id) || undefined;
      if (data) {
        signatures.set(id, data);
      }
    }
    if (data) {
      res.json({
        signature: data.signature,
        clientName: data.clientName,
        driveUrl: data.driveUrl,
        savedToDrive: data.savedToDrive,
        savedToSheet: data.savedToSheet,
        timestamp: data.timestamp
      });
    } else {
      res.status(404).json({ error: 'Firma no encontrada o aún no completada' });
    }
  });

  // API to delete a signature once completed
  app.delete('/api/signatures/:id', requireModules('TECNICO','TICKET'), (req, res) => {
    const { id } = req.params;
    signatures.delete(id);
    deleteSignatureFromDisk(id);
    res.json({ success: true });
  });

  // API to store public ticket & activities info (so client opening public link can view details)
  app.post('/api/public-ticket/:id', requireModules('TICKET','TECNICO'), (req, res) => {
    const { id } = req.params;
    const data = req.body;
    if (!data) return res.status(400).json({ error: 'No data provided' });
    delete data.token;
    publicTickets.set(id, data);
    savePublicTicketToDisk(id, data);
    res.json({ success: true });
  });

  // API to get public ticket & activities info
  app.get('/api/public-ticket/:id', (req, res) => {
    const { id } = req.params;
    let data = publicTickets.get(id);
    if (!data) {
      data = getPublicTicketFromDisk(id);
      if (data) {
        publicTickets.set(id, data);
      }
    }
    if (data) {
      res.json(data);
    } else {
      res.status(404).json({ error: 'Ticket no encontrado' });
    }
  });

  


app.post('/api/grammar', requireModules('TECNICO','INFORMES'), async (req, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: 'No text provided' });
  
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Corrige la ortografía y gramática del siguiente reporte técnico. Mantén el significado técnico, usa un tono profesional (ej. "Se procedió a...", "Se realizó..."), no agregues trabajos inexistentes. Retorna únicamente el texto corregido sin comillas adicionales.

Texto:
${text}`,
    });
    res.json({ text: response.text });
  } catch (error: any) {
    console.error('AI Error:', error);
    res.status(500).json({ error: error.message });
  }
});

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
