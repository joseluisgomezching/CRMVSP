var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// server.ts
var server_exports = {};
__export(server_exports, {
  createApp: () => createApp
});
module.exports = __toCommonJS(server_exports);
var import_genai = require("@google/genai");
var import_express = __toESM(require("express"), 1);
var import_path = __toESM(require("path"), 1);
var import_fs = __toESM(require("fs"), 1);
var import_google_auth_library = require("google-auth-library");

// serverAuth.ts
var import_node_crypto = require("node:crypto");
var import_node_fs = __toESM(require("node:fs"), 1);
var import_node_path = __toESM(require("node:path"), 1);
var MODULES = ["TICKET", "TICKETS_CERRADOS", "TECNICO", "RENDIR_PASAJES", "INFORMES", "EMPRESAS", "EDITAR_TICKETS", "ACTIVIDADES", "CAJA_CHICA", "COTIZACIONES", "RENTAL", "INVENTARIO"];
var COOKIE = "crmvsp_session";
var SESSION_MS = 12 * 60 * 60 * 1e3;
var adminEmail = () => (process.env.ADMIN_EMAIL || "").trim().toLowerCase();
var secret = () => process.env.SESSION_SECRET?.length && process.env.SESSION_SECRET.length >= 32 ? process.env.SESSION_SECRET : null;
var storePath = () => process.env.CRM_USERS_FILE || "";
function authReady() {
  return Boolean(adminEmail().includes("@") && secret() && /^scrypt:[a-f0-9]{32}:[a-f0-9]{128}$/i.test(process.env.ADMIN_PASSWORD_HASH || ""));
}
function readUsers() {
  if (!storePath()) return [];
  try {
    const data = JSON.parse(import_node_fs.default.readFileSync(storePath(), "utf8"));
    if (!Array.isArray(data)) throw new Error("Formato de usuarios inv\xE1lido");
    return data;
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}
function writeUsers(users) {
  if (process.env.VERCEL) throw new Error("Los usuarios adicionales necesitan almacenamiento persistente; Vercel no puede guardar esta base en un archivo local");
  const file = storePath();
  if (!file) throw new Error("Configura CRM_USERS_FILE en un volumen persistente");
  import_node_fs.default.mkdirSync(import_node_path.default.dirname(file), { recursive: true });
  const temp = `${file}.${process.pid}.${(0, import_node_crypto.randomBytes)(6).toString("hex")}.tmp`;
  try {
    import_node_fs.default.writeFileSync(temp, JSON.stringify(users, null, 2), { mode: 384, flag: "wx" });
    import_node_fs.default.renameSync(temp, file);
  } finally {
    if (import_node_fs.default.existsSync(temp)) import_node_fs.default.unlinkSync(temp);
  }
}
function verify(hash, password) {
  if (!/^scrypt:[a-f0-9]{32}:[a-f0-9]{128}$/i.test(hash)) return false;
  const [, salt, expected] = hash.split(":");
  return (0, import_node_crypto.timingSafeEqual)((0, import_node_crypto.scryptSync)(password, Buffer.from(salt, "hex"), 64), Buffer.from(expected, "hex"));
}
var hashPassword = (password) => {
  const salt = (0, import_node_crypto.randomBytes)(16);
  return `scrypt:${salt.toString("hex")}:${(0, import_node_crypto.scryptSync)(password, salt, 64).toString("hex")}`;
};
function authenticate(email, password) {
  if (!authReady() || typeof email !== "string" || typeof password !== "string" || password.length > 1024) return null;
  const normalized = email.trim().toLowerCase();
  if (normalized === adminEmail()) return verify(process.env.ADMIN_PASSWORD_HASH, password) ? { email: normalized, role: "admin", modules: [...MODULES], version: process.env.ADMIN_PASSWORD_HASH } : null;
  const user = readUsers().find((u) => u.email === normalized && u.active);
  return user && verify(user.hash, password) ? { email: user.email, role: "user", modules: user.modules, version: user.version } : null;
}
var signature = (payload) => (0, import_node_crypto.createHmac)("sha256", secret()).update(payload).digest("base64url");
function issueSession(res, identity) {
  const payload = Buffer.from(JSON.stringify({ email: identity.email, version: identity.version, expires: Date.now() + SESSION_MS })).toString("base64url");
  res.setHeader("Set-Cookie", `${COOKIE}=${payload}.${signature(payload)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${SESSION_MS / 1e3}` + (process.env.NODE_ENV === "production" ? "; Secure" : ""));
}
function clearSession(res) {
  res.setHeader("Set-Cookie", `${COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0` + (process.env.NODE_ENV === "production" ? "; Secure" : ""));
}
function currentUser(req) {
  if (!authReady()) return null;
  const cookie = req.headers.cookie?.split(";").map((v) => v.trim()).find((v) => v.startsWith(`${COOKIE}=`));
  if (!cookie) return null;
  const value = cookie.slice(COOKIE.length + 1);
  const dot = value.indexOf(".");
  if (dot < 1) return null;
  const payload = value.slice(0, dot);
  const received = Buffer.from(value.slice(dot + 1), "base64url");
  const expected = Buffer.from(signature(payload), "base64url");
  if (received.length !== expected.length || !(0, import_node_crypto.timingSafeEqual)(received, expected)) return null;
  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (typeof session.expires !== "number" || session.expires <= Date.now() || typeof session.email !== "string") return null;
    if (session.email === adminEmail()) return session.version === process.env.ADMIN_PASSWORD_HASH ? { email: session.email, role: "admin", modules: [...MODULES] } : null;
    const user = readUsers().find((u) => u.email === session.email && u.active && u.version === session.version);
    return user ? { email: user.email, role: "user", modules: user.modules } : null;
  } catch {
    return null;
  }
}
function requireUser(req, res, next) {
  if (currentUser(req)) return next();
  res.status(401).json({ error: "Inicia sesi\xF3n" });
}
function requireAdmin(req, res, next) {
  if (currentUser(req)?.role === "admin") return next();
  res.status(403).json({ error: "Solo el administrador puede realizar esta acci\xF3n" });
}
function listUsers() {
  return readUsers().map(({ email, name, modules, active }) => ({ email, name, modules, active }));
}
function saveUser(input) {
  const email = typeof input?.email === "string" ? input.email.trim().toLowerCase() : "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email === adminEmail()) throw new Error("Correo no v\xE1lido o reservado para el administrador");
  if (typeof input.name !== "string" || !input.name.trim() || input.name.length > 100) throw new Error("Indica un nombre v\xE1lido");
  if (!Array.isArray(input.modules) || input.modules.some((m) => !MODULES.includes(m))) throw new Error("M\xF3dulos no v\xE1lidos");
  const users = readUsers();
  const index = users.findIndex((u) => u.email === email);
  const previous = users[index];
  if ((!previous || input.password) && (typeof input.password !== "string" || input.password.length < 12)) throw new Error("La contrase\xF1a debe tener al menos 12 caracteres");
  const user = { email, name: input.name.trim(), hash: input.password ? hashPassword(input.password) : previous.hash, modules: [...new Set(input.modules)], active: input.active !== false, version: (0, import_node_crypto.randomBytes)(16).toString("hex") };
  if (index < 0) users.push(user);
  else users[index] = user;
  writeUsers(users);
}

// server.ts
var signatures = /* @__PURE__ */ new Map();
var SIGNATURES_DIR = import_path.default.join("/tmp", "vsp_signatures");
var googleAuth;
async function getServerToken() {
  let client;
  if (process.env.GOOGLE_OAUTH_CLIENT_ID && process.env.GOOGLE_OAUTH_CLIENT_SECRET && process.env.GOOGLE_OAUTH_REFRESH_TOKEN) {
    const ownerOAuth = new import_google_auth_library.OAuth2Client(process.env.GOOGLE_OAUTH_CLIENT_ID, process.env.GOOGLE_OAUTH_CLIENT_SECRET);
    ownerOAuth.setCredentials({ refresh_token: process.env.GOOGLE_OAUTH_REFRESH_TOKEN });
    client = ownerOAuth;
  } else {
    googleAuth ||= new import_google_auth_library.GoogleAuth({
      credentials: process.env.GOOGLE_SERVICE_ACCOUNT_JSON ? JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON) : void 0,
      scopes: ["https://www.googleapis.com/auth/spreadsheets", "https://www.googleapis.com/auth/drive"]
    });
    client = await googleAuth.getClient();
  }
  const result = await client.getAccessToken();
  if (!result.token) throw new Error("Servidor sin credenciales para Google Sheets y Drive");
  return result.token;
}
var ALLOWED_SHEETS = /* @__PURE__ */ new Set([
  "19BcJR3V4tBtwKrh97v5R0PLlMt1CoXwmWwFmIFFy2lk",
  "1CfvIvSb1lpF3qAEfblOSmsXEsqgPC2lqZInyYmMEHog"
]);
var ALLOWED_FOLDERS = /* @__PURE__ */ new Set([
  "14zJIbLf9bfeM0RZiwsPDXGzcqfUWJw0o",
  "1Y0D-ZJ6ufLK6zuVxvp5vZjx7yq6hj_LV",
  "1EEQ9aMpJ_mrhODiGVDWolTyq5a6ScLcZ",
  "1nZKrXULwBYnjcfn9GiBjNvIZxHLyZsEs"
]);
var uploadedFiles = /* @__PURE__ */ new Map();
var FOLDER_MODULES = {
  "14zJIbLf9bfeM0RZiwsPDXGzcqfUWJw0o": ["TICKET", "TECNICO", "EDITAR_TICKETS", "INFORMES"],
  "1Y0D-ZJ6ufLK6zuVxvp5vZjx7yq6hj_LV": ["TICKET", "TECNICO", "EDITAR_TICKETS"],
  "1EEQ9aMpJ_mrhODiGVDWolTyq5a6ScLcZ": ["EMPRESAS"],
  "1nZKrXULwBYnjcfn9GiBjNvIZxHLyZsEs": ["TICKET", "TECNICO", "INFORMES"]
};
var TABLE_MODULES = {
  TICKET: ["TICKET", "TICKETS_CERRADOS", "TECNICO", "EDITAR_TICKETS", "INFORMES", "RENDIR_PASAJES"],
  EMPRESA: ["TICKET", "EMPRESAS", "COTIZACIONES", "EDITAR_TICKETS"],
  CONTACTOS: ["TICKET", "EMPRESAS", "EDITAR_TICKETS"],
  TECNICOS: ["TICKET", "TECNICO", "EMPRESAS", "EDITAR_TICKETS"],
  CONTRATO: ["TICKET", "EMPRESAS", "INFORMES"],
  FOTOSTICKET: ["TECNICO", "TICKET", "INFORMES", "EDITAR_TICKETS"],
  ACTIVIDADES: ["TECNICO", "TICKET", "INFORMES", "EDITAR_TICKETS"],
  FOTOACT: ["TECNICO", "INFORMES", "EDITAR_TICKETS"],
  REPUESTOS: ["TECNICO", "INVENTARIO", "EDITAR_TICKETS"],
  INTERNAMIENTO: ["TECNICO", "INVENTARIO", "EDITAR_TICKETS"],
  RUTAS: ["RENDIR_PASAJES", "TECNICO"],
  TRANSPORTE: ["RENDIR_PASAJES", "TECNICO"],
  CAJA: ["CAJA_CHICA"],
  ACTIVIDADESDIARIAS: ["ACTIVIDADES"],
  TRANACTI: ["TECNICO", "INFORMES"],
  COTIZACION: ["COTIZACIONES"],
  CLIENTE: ["COTIZACIONES"],
  VENDEDOR: ["COTIZACIONES"],
  VENTA: ["COTIZACIONES"],
  ITEMVENTA: ["COTIZACIONES"],
  CALCULOVENTA: ["COTIZACIONES"],
  ALQUILER: ["COTIZACIONES"],
  ITEMALQUILER: ["COTIZACIONES"],
  CALCULOALQUILER: ["COTIZACIONES"],
  OUT: ["COTIZACIONES"],
  ITEMOUT: ["COTIZACIONES"],
  CALCULOOUT: ["COTIZACIONES"],
  ACCESOS: []
};
var normalizeTab = (value) => value.replace(/^'/, "").replace(/'$/, "").replace(/''/g, "'").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Z0-9]/gi, "").toUpperCase();
function tabFromRange(range) {
  if (typeof range !== "string") return null;
  const decoded = decodeURIComponent(range);
  const title = decoded.split("!")[0];
  return normalizeTab(title);
}
function canUseTab(modules, range) {
  const tab = tabFromRange(range);
  return !!tab && (TABLE_MODULES[tab] || []).some((module2) => modules.includes(module2));
}
async function uploadSignatureToDrive(ticketId, base64DataUrl, token) {
  const folderId = "14zJIbLf9bfeM0RZiwsPDXGzcqfUWJw0o";
  const fileName = `FIRMA-${ticketId}.jpg`;
  const base64Data = base64DataUrl.replace(/^data:image\/\w+;base64,/, "");
  const buffer = Buffer.from(base64Data, "base64");
  const metadata = {
    name: fileName,
    parents: [folderId]
  };
  const form = new FormData();
  form.append("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json" }));
  form.append("file", new Blob([buffer], { type: "image/jpeg" }), fileName);
  let driveRes = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink,webContentLink",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`
      },
      body: form
    }
  );
  if (!driveRes.ok) {
    const errText = await driveRes.text();
    console.warn(`[uploadSignatureToDrive] Error con carpeta ${folderId}:`, errText);
    if (errText.includes("storageQuotaExceeded") || errText.includes("quota has been exceeded")) {
      throw new Error(`El almacenamiento de Google Drive est\xE1 lleno. El administrador debe liberar espacio en su cuenta o ampliar la cuota de almacenamiento.`);
    }
    console.log("[uploadSignatureToDrive] Reintentando subida en ra\xEDz de Google Drive...");
    const formRoot = new FormData();
    formRoot.append("metadata", new Blob([JSON.stringify({ name: fileName })], { type: "application/json" }));
    formRoot.append("file", new Blob([buffer], { type: "image/jpeg" }), fileName);
    driveRes = await fetch(
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink,webContentLink",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formRoot
      }
    );
    if (!driveRes.ok) {
      const errText2 = await driveRes.text();
      throw new Error(`Google Drive API error (${driveRes.status}): ${errText2}`);
    }
  }
  const data = await driveRes.json();
  const fileId = data.id;
  if (fileId) {
    try {
      await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/permissions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ role: "reader", type: "anyone" })
      });
    } catch (e) {
      console.warn("Could not set permissions on Drive file:", e);
    }
  }
  const driveUrl = data.webViewLink || (fileId ? `https://drive.google.com/file/d/${fileId}/view` : "");
  return driveUrl;
}
async function updateTicketSignatureInSheet(ticketId, driveUrl, token, targetStatus) {
  const spreadsheetId = "19BcJR3V4tBtwKrh97v5R0PLlMt1CoXwmWwFmIFFy2lk";
  const headerRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'TICKET'!A1:AZ1`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  let headers = [];
  if (headerRes.ok) {
    const hData = await headerRes.json();
    headers = (hData.values && hData.values[0] || []).map((h) => (h || "").trim());
  }
  const norm = (s) => (s || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  let idColIdx = headers.findIndex((h) => {
    const n = norm(h);
    return n === "IDTICKET" || n === "ID" || n === "CODIGO";
  });
  if (idColIdx === -1) idColIdx = 0;
  let firmaColIdx = headers.findIndex((h) => {
    const n = norm(h);
    return n === "FIRMA" || n === "FIRMACLIENTE";
  });
  if (firmaColIdx === -1) firmaColIdx = 18;
  const toLetter = (c) => {
    let temp, letter = "";
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
  const idColRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'TICKET'!${idColLetter}:${idColLetter}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!idColRes.ok) {
    const err = await idColRes.text();
    throw new Error(`Sheets API ID column error (${idColRes.status}): ${err}`);
  }
  const idData = await idColRes.json();
  const rows = idData.values || [];
  const targetId = norm(ticketId);
  let targetRow = -1;
  for (let i = 1; i < rows.length; i++) {
    const val = norm(rows[i]?.[0] || "");
    if (val === targetId) {
      targetRow = i + 1;
      break;
    }
  }
  if (targetRow === -1) {
    throw new Error(`Ticket ${ticketId} no encontrado en la hoja TICKET`);
  }
  const cellRange = encodeURIComponent(`'TICKET'!${firmaColLetter}${targetRow}`);
  const updateRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${cellRange}?valueInputOption=USER_ENTERED`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
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
  if (targetStatus && targetStatus.trim().toUpperCase() === "CERRADO") {
    const estadoColIdx = headers.findIndex((h) => norm(h) === "ESTADO");
    if (estadoColIdx !== -1) {
      const estadoColLetter = toLetter(estadoColIdx);
      try {
        await fetch(
          `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'TICKET'!${estadoColLetter}${targetRow}?valueInputOption=USER_ENTERED`,
          {
            method: "PUT",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({ values: [["CERRADO"]] })
          }
        );
      } catch (e) {
        console.warn("Error actualizando ESTADO a CERRADO:", e);
      }
    }
    const cierreColIdx = headers.findIndex((h) => {
      const n = norm(h);
      return n === "FECHADECIERRE" || n === "FECHACIERRE";
    });
    if (cierreColIdx !== -1) {
      const cierreColLetter = toLetter(cierreColIdx);
      const now = /* @__PURE__ */ new Date();
      const pad = (n) => String(n).padStart(2, "0");
      const dateStr = `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()}`;
      try {
        await fetch(
          `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'TICKET'!${cierreColLetter}${targetRow}?valueInputOption=USER_ENTERED`,
          {
            method: "PUT",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({ values: [[dateStr]] })
          }
        );
      } catch (e) {
        console.warn("Error actualizando FECHA DE CIERRE:", e);
      }
    }
  }
  console.log(`[GoogleSheet] Successfully updated ticket ${ticketId} at row ${targetRow}, col ${firmaColLetter} with ${driveUrl}`);
  return { row: targetRow, colLetter: firmaColLetter };
}
try {
  if (!import_fs.default.existsSync(SIGNATURES_DIR)) {
    import_fs.default.mkdirSync(SIGNATURES_DIR, { recursive: true });
  }
} catch (e) {
  console.warn("Could not create signatures disk directory:", e);
}
function saveSignatureToDisk(id, data) {
  try {
    const filePath = import_path.default.join(SIGNATURES_DIR, `${encodeURIComponent(id)}.json`);
    import_fs.default.writeFileSync(filePath, JSON.stringify(data), "utf-8");
  } catch (e) {
    console.warn("Could not save signature to disk:", e);
  }
}
function getSignatureFromDisk(id) {
  try {
    const filePath = import_path.default.join(SIGNATURES_DIR, `${encodeURIComponent(id)}.json`);
    if (import_fs.default.existsSync(filePath)) {
      const raw = import_fs.default.readFileSync(filePath, "utf-8");
      return JSON.parse(raw);
    }
  } catch (e) {
    console.warn("Could not read signature from disk:", e);
  }
  return null;
}
function deleteSignatureFromDisk(id) {
  try {
    const filePath = import_path.default.join(SIGNATURES_DIR, `${encodeURIComponent(id)}.json`);
    if (import_fs.default.existsSync(filePath)) {
      import_fs.default.unlinkSync(filePath);
    }
  } catch (e) {
  }
}
var publicTickets = /* @__PURE__ */ new Map();
var PUBLIC_TICKETS_DIR = import_path.default.join("/tmp", "vsp_public_tickets");
try {
  if (!import_fs.default.existsSync(PUBLIC_TICKETS_DIR)) {
    import_fs.default.mkdirSync(PUBLIC_TICKETS_DIR, { recursive: true });
  }
} catch (e) {
  console.warn("Could not create public tickets directory:", e);
}
function savePublicTicketToDisk(id, data) {
  try {
    const filePath = import_path.default.join(PUBLIC_TICKETS_DIR, `${encodeURIComponent(id)}.json`);
    import_fs.default.writeFileSync(filePath, JSON.stringify(data), "utf-8");
  } catch (e) {
    console.warn("Could not save public ticket to disk:", e);
  }
}
function getPublicTicketFromDisk(id) {
  try {
    const filePath = import_path.default.join(PUBLIC_TICKETS_DIR, `${encodeURIComponent(id)}.json`);
    if (import_fs.default.existsSync(filePath)) {
      const raw = import_fs.default.readFileSync(filePath, "utf-8");
      return JSON.parse(raw);
    }
  } catch (e) {
    console.warn("Could not read public ticket from disk:", e);
  }
  return null;
}
async function createApp() {
  const app = (0, import_express.default)();
  app.set("trust proxy", 1);
  const failedLogins = /* @__PURE__ */ new Map();
  app.use(import_express.default.json({ limit: "15mb" }));
  app.get("/api/auth/me", (req, res) => {
    if (!authReady()) return res.status(503).json({ error: "Configura ADMIN_EMAIL, ADMIN_PASSWORD_HASH y SESSION_SECRET en el servidor" });
    const user = currentUser(req);
    res.json(user ? { authenticated: true, ...user, tables: user.role === "admin" ? Object.keys(TABLE_MODULES).filter((t) => t !== "ACCESOS") : Object.keys(TABLE_MODULES).filter((t) => canUseTab(user.modules, t)) } : { authenticated: false });
  });
  app.post("/api/auth/login", (req, res) => {
    if (!authReady()) return res.status(503).json({ error: "Acceso del administrador a\xFAn no configurado" });
    const key = req.ip || req.socket.remoteAddress || "unknown";
    const attempt = failedLogins.get(key);
    if (attempt && attempt.until > Date.now() && attempt.count >= 5) {
      return res.status(429).json({ error: "Demasiados intentos. Vuelve a probar en 15 minutos." });
    }
    const user = authenticate(req.body?.email, req.body?.password);
    if (!user) {
      failedLogins.set(key, { count: (attempt?.until || 0) > Date.now() ? attempt.count + 1 : 1, until: Date.now() + 15 * 6e4 });
      return res.status(401).json({ error: "Correo o contrase\xF1a incorrectos" });
    }
    failedLogins.delete(key);
    issueSession(res, user);
    res.json({ authenticated: true, email: user.email, role: user.role, modules: user.modules });
  });
  app.post("/api/auth/logout", (_req, res) => {
    clearSession(res);
    res.json({ authenticated: false });
  });
  app.get("/api/users", requireAdmin, (_req, res) => {
    try {
      res.json(listUsers());
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  app.put("/api/users", requireAdmin, (req, res) => {
    try {
      saveUser(req.body);
      res.json({ success: true });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });
  const requireModules = (...modules) => (req, res, next) => {
    const user = currentUser(req);
    if (user && (user.role === "admin" || modules.some((module2) => user.modules.includes(module2)))) return next();
    res.status(403).json({ error: "M\xF3dulo no autorizado" });
  };
  app.use("/api/google", requireUser, import_express.default.raw({ type: () => true, limit: "20mb" }));
  app.use("/api/google/:service", async (req, res) => {
    try {
      const service = req.params.service;
      let rawPath = req.originalUrl.slice(`/api/google/${service}`.length);
      const [pathname] = rawPath.split("?");
      let base;
      if (service === "health" && req.method === "GET") {
        await getServerToken();
        return res.json({ ready: true });
      }
      if (service === "sheets") {
        const match = pathname.match(/^\/v4\/spreadsheets\/([A-Za-z0-9_-]+)(?:\/|:|$)/);
        if (!match || !ALLOWED_SHEETS.has(match[1])) return res.status(403).json({ error: "Hoja no permitida" });
        const user = currentUser(req);
        if (user.role !== "admin") {
          const isQuotes = match[1] === "1CfvIvSb1lpF3qAEfblOSmsXEsqgPC2lqZInyYmMEHog";
          if (isQuotes && !user.modules.includes("COTIZACIONES")) return res.sendStatus(403);
          const tail = pathname.slice(match[0].length - (match[0].endsWith("/") || match[0].endsWith(":") ? 1 : 0));
          const parsed = req.body && Buffer.isBuffer(req.body) ? JSON.parse(req.body.toString("utf8") || "{}") : req.body || {};
          if (tail.startsWith(":batchUpdate")) return res.sendStatus(403);
          if (tail === "" && req.method !== "GET") return res.sendStatus(403);
          if (tail === "") rawPath = `/v4/spreadsheets/${match[1]}?fields=sheets.properties`;
          if (tail.startsWith("/values:batchGet")) {
            const ranges = new URL(req.originalUrl, "http://localhost").searchParams.getAll("ranges");
            if (!ranges.length || ranges.some((range) => !canUseTab(user.modules, range))) return res.sendStatus(403);
          } else if (tail.startsWith("/values:batchUpdate")) {
            if (!Array.isArray(parsed.data) || parsed.data.some((item) => !canUseTab(user.modules, item.range))) return res.sendStatus(403);
          } else if (tail.startsWith("/values/")) {
            if (!canUseTab(user.modules, tail.slice("/values/".length).split(":")[0])) return res.sendStatus(403);
          } else if (tail !== "") return res.sendStatus(403);
        }
        base = "https://sheets.googleapis.com";
      } else if (service === "drive") {
        const user = currentUser(req);
        if (user.role !== "admin") {
          const fileMatch = pathname.match(/^\/v3\/files\/([A-Za-z0-9_-]+)$/);
          const permissionMatch = pathname.match(/^\/v3\/files\/([A-Za-z0-9_-]+)\/permissions$/);
          if (permissionMatch) {
            if (req.method !== "POST" || uploadedFiles.get(permissionMatch[1]) !== user.email) return res.sendStatus(403);
          } else if (fileMatch && req.method === "GET") {
            const metadata = await fetch(`https://www.googleapis.com/drive/v3/files/${fileMatch[1]}?fields=parents&supportsAllDrives=true`, {
              headers: { Authorization: `Bearer ${await getServerToken()}` }
            });
            if (!metadata.ok) return res.sendStatus(403);
            const file = await metadata.json();
            if (!file.parents?.some((folder) => FOLDER_MODULES[folder]?.some((module2) => user.modules.includes(module2)))) return res.sendStatus(403);
          } else return res.sendStatus(403);
        }
        if (req.method !== "GET" || !/^\/v3\/files\/[A-Za-z0-9_-]+$/.test(pathname)) {
          const permission = pathname.match(/^\/v3\/files\/([A-Za-z0-9_-]+)\/permissions$/);
          if (!permission || req.method !== "POST" || !uploadedFiles.has(permission[1])) {
            return res.status(403).json({ error: "Operaci\xF3n Drive no permitida" });
          }
        }
        base = "https://www.googleapis.com/drive";
      } else if (service === "upload") {
        if (req.method !== "POST" || pathname !== "/v3/files") return res.sendStatus(403);
        const raw = req.body;
        const metadata = raw.toString("utf8").match(/\{\s*"name"\s*:\s*"[^"]+"\s*,\s*"parents"\s*:\s*\[\s*"([A-Za-z0-9_-]+)"\s*\]\s*\}/);
        if (!metadata || !ALLOWED_FOLDERS.has(metadata[1])) {
          return res.status(403).json({ error: "Carpeta de destino no permitida" });
        }
        const user = currentUser(req);
        if (user.role !== "admin" && !FOLDER_MODULES[metadata[1]]?.some((module2) => user.modules.includes(module2))) return res.sendStatus(403);
        base = "https://www.googleapis.com/upload";
      } else return res.sendStatus(404);
      const upstream = await fetch(base + rawPath, {
        method: req.method,
        headers: {
          Authorization: `Bearer ${await getServerToken()}`,
          ...req.headers["content-type"] ? { "Content-Type": String(req.headers["content-type"]) } : {}
        },
        body: ["GET", "HEAD"].includes(req.method) ? void 0 : Buffer.isBuffer(req.body) ? req.body : JSON.stringify(req.body)
      });
      const body = Buffer.from(await upstream.arrayBuffer());
      if (service === "upload" && upstream.ok) {
        try {
          const id = JSON.parse(body.toString()).id;
          if (id) uploadedFiles.set(id, currentUser(req).email);
        } catch {
        }
      }
      if (service === "sheets" && currentUser(req)?.role !== "admin" && pathname.match(/^\/v4\/spreadsheets\/[A-Za-z0-9_-]+$/) && upstream.ok) {
        const data = JSON.parse(body.toString("utf8"));
        if (Array.isArray(data.sheets)) data.sheets = data.sheets.filter((sheet) => canUseTab(currentUser(req).modules, sheet.properties?.title));
        return res.status(upstream.status).json(data);
      }
      res.status(upstream.status);
      res.setHeader("Content-Type", upstream.headers.get("content-type") || "application/octet-stream");
      res.send(body);
    } catch (error) {
      res.status(502).json({ error: error.message || "Error de conexi\xF3n con Google" });
    }
  });
  app.get("/sw.js", (req, res) => {
    res.setHeader("Service-Worker-Allowed", "/");
    res.setHeader("Content-Type", "application/javascript; charset=UTF-8");
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    const swPath = import_path.default.join(process.cwd(), "public", "sw.js");
    if (import_fs.default.existsSync(swPath)) {
      return res.sendFile(swPath);
    }
    res.status(404).send("Service worker not found");
  });
  app.get("/manifest.json", (req, res) => {
    res.setHeader("Content-Type", "application/manifest+json; charset=UTF-8");
    const manifestPath = import_path.default.join(process.cwd(), "public", "manifest.json");
    if (import_fs.default.existsSync(manifestPath)) {
      return res.sendFile(manifestPath);
    }
    res.status(404).send("Manifest not found");
  });
  app.post("/api/signatures/:id", async (req, res) => {
    const { id } = req.params;
    const { signature: signature2, clientName, targetStatus } = req.body;
    if (!signature2) {
      return res.status(400).json({ error: "No signature provided" });
    }
    let token = null;
    try {
      token = await getServerToken();
    } catch (error) {
      console.error(error);
    }
    let driveUrl = "";
    let savedToDrive = false;
    let savedToSheet = false;
    let driveError = null;
    let sheetError = null;
    if (token) {
      try {
        console.log(`[POST /api/signatures/${id}] Subiendo firma a Google Drive...`);
        driveUrl = await uploadSignatureToDrive(id, signature2, token);
        savedToDrive = true;
        console.log(`[POST /api/signatures/${id}] Firma guardada en Drive: ${driveUrl}`);
        try {
          console.log(`[POST /api/signatures/${id}] Guardando URL en columna FIRMA de tabla TICKET...`);
          await updateTicketSignatureInSheet(id, driveUrl, token, targetStatus);
          savedToSheet = true;
          console.log(`[POST /api/signatures/${id}] \xA1URL registrada exitosamente en columna FIRMA!`);
        } catch (sErr) {
          console.error(`[POST /api/signatures/${id}] Error actualizando columna FIRMA en Sheets:`, sErr);
          sheetError = sErr.message || String(sErr);
        }
      } catch (dErr) {
        console.error(`[POST /api/signatures/${id}] Error subiendo imagen a Drive:`, dErr);
        driveError = dErr.message || String(dErr);
      }
    } else {
      console.warn(`[POST /api/signatures/${id}] No hay token OAuth de Google disponible en servidor todav\xEDa; se mantendr\xE1 en cola.`);
    }
    const data = {
      signature: signature2,
      clientName: typeof clientName === "string" ? clientName.trim() : void 0,
      driveUrl: driveUrl || void 0,
      savedToDrive,
      savedToSheet,
      timestamp: Date.now()
    };
    signatures.set(id, data);
    saveSignatureToDisk(id, data);
    res.json({
      success: true,
      driveUrl: driveUrl || void 0,
      savedToDrive,
      savedToSheet,
      driveError,
      sheetError,
      message: savedToSheet ? "Firma guardada en Google Drive y registrada exitosamente en la columna FIRMA del Ticket" : savedToDrive ? "Firma guardada en Google Drive (pendiente registro en tabla)" : "Firma recibida correctamente"
    });
  });
  app.post("/api/sync-signature-to-sheet/:id", requireModules("TECNICO", "TICKET"), async (req, res) => {
    const { id } = req.params;
    let token = null;
    try {
      token = await getServerToken();
    } catch (error) {
      console.error(error);
    }
    if (!token) {
      return res.status(400).json({ error: "No Google OAuth token available for sync" });
    }
    let data = signatures.get(id) || getSignatureFromDisk(id) || void 0;
    if (!data || !data.signature) {
      return res.status(404).json({ error: "No hay firma pendiente para este ticket" });
    }
    let driveUrl = data.driveUrl || "";
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
      res.json({ success: true, driveUrl, savedToSheet, message: "Sincronizaci\xF3n a Drive y Sheets completada" });
    } catch (e) {
      res.status(500).json({ error: e.message || String(e) });
    }
  });
  app.get("/api/signatures/:id", requireModules("TECNICO", "TICKET"), (req, res) => {
    const { id } = req.params;
    let data = signatures.get(id);
    if (!data) {
      data = getSignatureFromDisk(id) || void 0;
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
      res.status(404).json({ error: "Firma no encontrada o a\xFAn no completada" });
    }
  });
  app.delete("/api/signatures/:id", requireModules("TECNICO", "TICKET"), (req, res) => {
    const { id } = req.params;
    signatures.delete(id);
    deleteSignatureFromDisk(id);
    res.json({ success: true });
  });
  app.post("/api/public-ticket/:id", requireModules("TICKET", "TECNICO"), (req, res) => {
    const { id } = req.params;
    const data = req.body;
    if (!data) return res.status(400).json({ error: "No data provided" });
    delete data.token;
    publicTickets.set(id, data);
    savePublicTicketToDisk(id, data);
    res.json({ success: true });
  });
  app.get("/api/public-ticket/:id", (req, res) => {
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
      res.status(404).json({ error: "Ticket no encontrado" });
    }
  });
  app.post("/api/grammar", requireModules("TECNICO", "INFORMES"), async (req, res) => {
    const { text } = req.body;
    if (!text) return res.status(400).json({ error: "No text provided" });
    try {
      const ai = new import_genai.GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: `Corrige la ortograf\xEDa y gram\xE1tica del siguiente reporte t\xE9cnico. Mant\xE9n el significado t\xE9cnico, usa un tono profesional (ej. "Se procedi\xF3 a...", "Se realiz\xF3..."), no agregues trabajos inexistentes. Retorna \xFAnicamente el texto corregido sin comillas adicionales.

Texto:
${text}`
      });
      res.json({ text: response.text });
    } catch (error) {
      console.error("AI Error:", error);
      res.status(500).json({ error: error.message });
    }
  });
  app.use("/api", (_req, res) => res.status(404).json({ error: "Ruta de API no encontrada" }));
  if (process.env.NODE_ENV !== "production" && !process.env.VERCEL) {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = import_path.default.join(process.cwd(), "dist");
    app.use(import_express.default.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(import_path.default.join(distPath, "index.html"));
    });
  }
  return app;
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  createApp
});
