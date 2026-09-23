import { getAccessToken, clearAccessToken } from '../serviceAccess';
import { AppData, Ticket, Empresa, Contacto, Tecnico, Contrato, FotosTicket, Actividad, Repuesto, FotoAct, Internamiento, Ruta, Transporte, Caja, ActividadDiaria, Acceso, Tranacti } from '../types';

const SPREADSHEET_ID = '19BcJR3V4tBtwKrh97v5R0PLlMt1CoXwmWwFmIFFy2lk';

// Helper to normalize sheet names for matching (removes spaces, underscores, casing)
function normalizeSheetName(name: string): string {
  return (name || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

// Extract clean sheet title from a Google Sheets range string (e.g., "'ACTIVIDADES DIARIAS'!A1:J100" -> "ACTIVIDADES DIARIAS")
function cleanRangeSheetTitle(rangeStr: string): string {
  if (!rangeStr) return '';
  const withoutCells = rangeStr.includes('!') ? rangeStr.split('!')[0] : rangeStr;
  return withoutCells.replace(/^'/, '').replace(/'$/, '').trim();
}

// Find existing sheet title in spreadsheet that matches the target canonical name
function findSheetTitle(existingTitles: string[], targetName: string): string | null {
  if (existingTitles.includes(targetName)) return targetName;
  const normTarget = normalizeSheetName(targetName);
  const matched = existingTitles.find(t => normalizeSheetName(t) === normTarget);
  if (matched) return matched;

  // Specific semantic fallbacks for known aliases
  if (normTarget === 'ACTIVIDADESDIARIAS') {
    const actDiaria = existingTitles.find(t => {
      const n = normalizeSheetName(t);
      return n.includes('ACTIVIDAD') && (n.includes('DIARIA') || n.includes('DIARIAS') || n.includes('INTERNA') || n.includes('INTERNAS'));
    });
    if (actDiaria) return actDiaria;
  }
  return null;
}

export function parseStartRowFromRange(rangeStr?: string): number {
  if (!rangeStr) return 1;
  const match = rangeStr.match(/!([A-Za-z]+)(\d+)/);
  if (match && match[2]) {
    const r = parseInt(match[2], 10);
    if (!isNaN(r) && r > 0) return r;
  }
  return 1;
}

// Helper to convert sheet rows (array of arrays) to array of objects
function rowsToObjects<T>(rows: string[][] | undefined, startRow: number = 1): T[] {
  if (!rows || rows.length < 2) return [];
  const headers = rows[0].map(h => (h || '').trim());
  return rows.slice(1).map((row, rowIndex) => {
    const obj: any = { _rowIndex: startRow + 1 + rowIndex }; // header is at startRow, data starts at startRow + 1
    headers.forEach((header, index) => {
      obj[header] = row[index] !== undefined ? String(row[index]).trim() : '';
    });
    return obj as T;
  });
}

function normalizeTicketHeaderKey(key: string): string {
  return (key || '')
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z0-9]/g, '');
}

function getRawTicketField(raw: any, normMap: Map<string, string>, canonicalName: string, aliases: string[] = []): string {
  if (raw[canonicalName] !== undefined && raw[canonicalName] !== null && String(raw[canonicalName]).trim() !== '') {
    return String(raw[canonicalName]).trim();
  }
  for (const alias of aliases) {
    if (raw[alias] !== undefined && raw[alias] !== null && String(raw[alias]).trim() !== '') {
      return String(raw[alias]).trim();
    }
  }
  const normCanonical = normalizeTicketHeaderKey(canonicalName);
  if (normMap.has(normCanonical)) {
    const origKey = normMap.get(normCanonical)!;
    if (raw[origKey] !== undefined && raw[origKey] !== null && String(raw[origKey]).trim() !== '') {
      return String(raw[origKey]).trim();
    }
  }
  for (const alias of aliases) {
    const normAlias = normalizeTicketHeaderKey(alias);
    if (normMap.has(normAlias)) {
      const origKey = normMap.get(normAlias)!;
      if (raw[origKey] !== undefined && raw[origKey] !== null && String(raw[origKey]).trim() !== '') {
        return String(raw[origKey]).trim();
      }
    }
  }
  return '';
}

export function normalizeTicket(raw: any, fallbackRowIndex?: number): Ticket | null {
  if (!raw || typeof raw !== 'object') return null;

  const normMap = new Map<string, string>();
  for (const key of Object.keys(raw)) {
    normMap.set(normalizeTicketHeaderKey(key), key);
  }

  const idTicket = getRawTicketField(raw, normMap, 'IDTICKET', ['ID TICKET', 'ID_TICKET', 'ID', 'CODIGO', 'COD']);
  if (!idTicket) return null;

  const ticket: Ticket = {
    ...raw,
    _rowIndex: raw._rowIndex || fallbackRowIndex,
    IDTICKET: idTicket,
    FHINGRESO: getRawTicketField(raw, normMap, 'FHINGRESO', ['FECHA INGRESO', 'FECHA DE INGRESO', 'FH INGRESO', 'FH_INGRESO', 'FECHA']),
    CLIENTE: getRawTicketField(raw, normMap, 'CLIENTE', ['EMPRESA', 'RAZON SOCIAL', 'CLIENTE / EMPRESA']),
    DIRECCION: getRawTicketField(raw, normMap, 'DIRECCION', ['DIRECCIÓN', 'DIRECCION CLIENTE', 'DIRECCIÓN CLIENTE', 'DOMICILIO']),
    TELEFONO: getRawTicketField(raw, normMap, 'TELEFONO', ['TELÉFONO', 'CELULAR', 'TELEFONO CONTACTO', 'TELÉFONO CONTACTO']),
    CONTACTO: getRawTicketField(raw, normMap, 'CONTACTO', ['PERSONA DE CONTACTO', 'NOMBRE CONTACTO', 'CONTACTO CLIENTE']),
    FHPROGRAMADA: getRawTicketField(raw, normMap, 'FHPROGRAMADA', ['FECHA PROGRAMADA', 'FECHA DE PROGRAMACION', 'FECHA DE PROGRAMACIÓN', 'FH PROGRAMADA', 'FH_PROGRAMADA']),
    ESTADO: getRawTicketField(raw, normMap, 'ESTADO', ['STATUS', 'ESTADO TICKET']) || 'ASIGNADO',
    PRIORIDAD: getRawTicketField(raw, normMap, 'PRIORIDAD', ['NIVEL DE PRIORIDAD']) || 'MEDIA',
    TIPO: getRawTicketField(raw, normMap, 'TIPO', ['TIPO TICKET', 'TIPO DE TICKET', 'TIPO SERVICIO']) || 'CONTRATO',
    PROBLEMA: getRawTicketField(raw, normMap, 'PROBLEMA', ['FALLA', 'DESCRIPCION', 'DESCRIPCION DEL PROBLEMA', 'DETALLE PROBLEMA']),
    TECNICO: getRawTicketField(raw, normMap, 'TECNICO', ['TÉCNICO', 'TECNICO ASIGNADO', 'TÉCNICO ASIGNADO', 'RESPONSABLE']),
    NOTIFICA: getRawTicketField(raw, normMap, 'NOTIFICA', ['NOTIFICAR']),
    'MODO DE ATENCION': getRawTicketField(raw, normMap, 'MODO DE ATENCION', ['MODO DE ATENCIÓN', 'MODO ATENCION', 'MODALIDAD', 'TIPO ATENCION']) || 'PRESENCIAL',
    NOTITEC: getRawTicketField(raw, normMap, 'NOTITEC'),
    NOTICLI: getRawTicketField(raw, normMap, 'NOTICLI'),
    PREFIJO: getRawTicketField(raw, normMap, 'PREFIJO'),
    SUMAXH: getRawTicketField(raw, normMap, 'SUMAXH', ['SUMA X H', 'SUMA HORAS', 'TOTAL HORAS']),
    FIRMA: getRawTicketField(raw, normMap, 'FIRMA', ['FIRMA CLIENTE']),
    PDF: getRawTicketField(raw, normMap, 'PDF', ['URL PDF', 'ENLACE PDF', 'GUIA']),
    FIRMATECH: getRawTicketField(raw, normMap, 'FIRMATECH', ['FIRMA TECH', 'FIRMA TECNICO', 'FIRMA TÉCNICO']),
    'COMENTARIO DE FOTO': getRawTicketField(raw, normMap, 'COMENTARIO DE FOTO', ['COMENTARIOS DE FOTO', 'COMENTARIO FOTO', 'COMENTARIOS']),
    DATEINICIO: getRawTicketField(raw, normMap, 'DATEINICIO', ['DATE INICIO', 'FECHA INICIO']),
    'DONDE CERRE': getRawTicketField(raw, normMap, 'DONDE CERRE', ['DONDE_CERRE', 'LUGAR CIERRE']),
    'TOTAL DE HORAS': getRawTicketField(raw, normMap, 'TOTAL DE HORAS', ['TOTAL HORAS', 'TOTAL_DE_HORAS']),
    ESTADO_SOLICITUD: getRawTicketField(raw, normMap, 'ESTADO_SOLICITUD', ['ESTADO SOLICITUD']),
    'GPS ENTRADA': getRawTicketField(raw, normMap, 'GPS ENTRADA', ['GPS_ENTRADA', 'UBICACION ENTRADA']),
    'GPS SALIDA': getRawTicketField(raw, normMap, 'GPS SALIDA', ['GPS_SALIDA', 'UBICACION SALIDA']),
    'ACTIVIDAD DEL TICKET': getRawTicketField(raw, normMap, 'ACTIVIDAD DEL TICKET', ['ACTIVIDAD TICKET', 'ACTIVIDAD REALIZADA', 'ACTIVIDAD', 'ACTIVIDADES']),
    OBSERVACIONES: getRawTicketField(raw, normMap, 'OBSERVACIONES', ['OBSERVACION', 'NOTAS']),
    FHLLC: getRawTicketField(raw, normMap, 'FHLLC'),
    FHSC: getRawTicketField(raw, normMap, 'FHSC'),
    'FECHA DE CIERRE': getRawTicketField(raw, normMap, 'FECHA DE CIERRE', ['FECHA CIERRE', 'FECHACIERRE', 'CIERRE']),
  };

  return ticket;
}

export async function fetchAppData(): Promise<AppData> {
  const token = await getAccessToken();
  if (!token) throw new Error('No hay token de acceso disponible. Por favor inicia sesión con Google.');
  const accessResponse = await fetch('/api/auth/me');
  if (!accessResponse.ok) throw new Error('No se pudo validar la sesión');
  const access = await accessResponse.json();
  if (!access.authenticated) throw new Error('Inicia sesión');
  const allowedTables = new Set<string>(access.tables || []);

  const allExpectedRanges = [
    'TICKET', 'EMPRESA', 'CONTACTOS', 'TECNICOS', 'CONTRATO', 
    'FOTOSTICKET', 'ACTIVIDADES', 'FOTOACT', 'REPUESTOS', 
    'INTERNAMIENTO', 'RUTAS', 'TRANSPORTE', 'CAJA', 'ACTIVIDADESDIARIAS', 'TRANACTI'
  ].filter(name => allowedTables.has(name));

  // Fetch existing sheets metadata
  const metaResponse = await fetch(
    `/api/google/sheets/v4/spreadsheets/${SPREADSHEET_ID}?fields=sheets.properties`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!metaResponse.ok) {
    const err = await metaResponse.text();
    if (metaResponse.status === 401 || err.includes('UNAUTHENTICATED') || err.includes('401')) {
      console.warn('[googleApi] Error 401 temporal:', err);
      throw new Error(`Error 401: Sesión de Google expirada o temporalmente inaccesible. (${err})`);
    }
    throw new Error(`Failed to fetch metadata: ${err}`);
  }
  const metaData = await metaResponse.json();
  const existingSheetTitles: string[] = (metaData.sheets || []).map((s: any) => s.properties.title);

  // Check if any expected sheets are missing (using normalized matching)
  const missingCanonicalSheets = allExpectedRanges.filter(sheet => !findSheetTitle(existingSheetTitles, sheet));
  if (missingCanonicalSheets.length > 0 && access.role === 'admin') {
    // Create missing sheets
    const requests = missingCanonicalSheets.map(sheetName => ({
      addSheet: { properties: { title: sheetName } }
    }));
    const createResponse = await fetch(
      `/api/google/sheets/v4/spreadsheets/${SPREADSHEET_ID}:batchUpdate`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ requests })
      }
    );
    if (!createResponse.ok) {
       console.warn("Failed to create missing sheets, they will be skipped.", await createResponse.text());
    } else {
       // Initialize headers for known missing sheets
       for (const sheetName of missingCanonicalSheets) {
         let headers: string[] = [];
         if (sheetName === 'ACCESOS') headers = ['ID', 'CORREO', 'MODULOS_PERMITIDOS'];
         if (sheetName === 'ACTIVIDADESDIARIAS') headers = ['ID', 'FECHA', 'CREADO POR', 'ASIGNADO A', 'MOTIVO DE LA ACTIVIDAD', 'IDA', 'VUELTA', 'GASTO DE PASAJE', 'GASTO ADICIONAL', 'MONTO TOTAL', 'ESTADO', 'ESTADO GASTO'];
         if (headers.length > 0) {
           await fetch(
             `/api/google/sheets/v4/spreadsheets/${SPREADSHEET_ID}/values/${sheetName}:append?valueInputOption=USER_ENTERED`,
             {
               method: 'POST',
               headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
               body: JSON.stringify({ values: [headers] })
             }
           );
         }
       }
    }
  }

  // Determine the actual range names to request
  const queryRanges = allExpectedRanges.map(canonical => {
    const actualTitle = findSheetTitle(existingSheetTitles, canonical) || canonical;
    return `'${actualTitle.replace(/'/g, "''")}'`;
  });

  const params = queryRanges.map(r => `ranges=${encodeURIComponent(r)}`).join('&');
  const response = await fetch(
    `/api/google/sheets/v4/spreadsheets/${SPREADSHEET_ID}/values:batchGet?${params}`,
    { 
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store'
    }
  );

  if (!response.ok) {
    const err = await response.text();
    if (response.status === 401 || err.includes('UNAUTHENTICATED') || err.includes('401')) {
      console.warn('[googleApi] Error 401 en fetchAppData:', err);
      throw new Error(`Error 401: Sesión de Google expirada o temporalmente inaccesible. (${err})`);
    }
    throw new Error(`Failed to fetch app data: ${err}`);
  }

  const data = await response.json();
  const valueRanges = data.valueRanges || [];

  const getSheetData = (targetCanonicalName: string) => {
    const normTarget = normalizeSheetName(targetCanonicalName);
    const vr = valueRanges.find((v: any) => {
      const sheetNameFromRange = cleanRangeSheetTitle(v.range);
      const normSheet = normalizeSheetName(sheetNameFromRange);
      if (normSheet === normTarget) return true;
      if (normTarget === 'ACTIVIDADESDIARIAS') {
        return normSheet.includes('ACTIVIDAD') && (normSheet.includes('DIARIA') || normSheet.includes('DIARIAS') || normSheet.includes('INTERNA') || normSheet.includes('INTERNAS'));
      }
      return false;
    });
    return {
      rows: (vr ? vr.values : []) as string[][],
      startRow: parseStartRowFromRange(vr?.range)
    };
  };

  const getRows = (targetCanonicalName: string) => {
    return getSheetData(targetCanonicalName).rows;
  };

  const getObjects = <T>(targetCanonicalName: string): T[] => {
    const { rows, startRow } = getSheetData(targetCanonicalName);
    return rowsToObjects<T>(rows, startRow);
  };

  const rawTicketRows = getObjects<any>('TICKET');
  const ticketMap = new Map<string, Ticket>();
  rawTicketRows.forEach((raw) => {
    const norm = normalizeTicket(raw, raw._rowIndex);
    if (!norm || !norm.IDTICKET || !norm.IDTICKET.trim()) return;
    const idKey = norm.IDTICKET.trim().toUpperCase();
    if (!ticketMap.has(idKey)) {
      ticketMap.set(idKey, { ...norm, _duplicateRows: [] });
    } else {
      // Primary row already established! Keep the primary row from the spreadsheet!
      const primary = ticketMap.get(idKey)!;
      if (!primary._duplicateRows) primary._duplicateRows = [];
      if (norm._rowIndex && !primary._duplicateRows.includes(norm._rowIndex)) {
        primary._duplicateRows.push(norm._rowIndex);
      }
      console.warn(`[fetchAppData] Fila duplicada para ticket ${idKey} encontrada en fila ${norm._rowIndex}. Se mantiene la fila principal ${primary._rowIndex} con ESTADO '${primary.ESTADO}'.`);
    }
  });

  return {
    tickets: Array.from(ticketMap.values()),
    empresas: Array.from(getObjects<Empresa>('EMPRESA').reduce((map, obj) => map.set(obj.ID, obj), new Map()).values()),
    contactos: Array.from(getObjects<Contacto>('CONTACTOS').reduce((map, obj) => map.set(obj.ID, obj), new Map()).values()),
    tecnicos: Array.from(getObjects<Tecnico>('TECNICOS').reduce((map, obj) => map.set(obj.ID, obj), new Map()).values()),
    contratos: Array.from(getObjects<Contrato>('CONTRATO').reduce((map, obj) => map.set((obj.ID || obj.id || (obj as any)._rowIndex), obj), new Map()).values()),
    fotosTicket: Array.from(getObjects<FotosTicket>('FOTOSTICKET').reduce((map, obj) => map.set(obj.ID, obj), new Map()).values()),
    actividades: Array.from(getObjects<Actividad>('ACTIVIDADES').reduce((map, obj) => map.set(obj.IDACTIVIDADES, obj), new Map()).values()),
    fotosAct: Array.from(getObjects<FotoAct>('FOTOACT').reduce((map, obj) => map.set(obj.ID, obj), new Map()).values()),
    repuestos: Array.from(getObjects<Repuesto>('REPUESTOS').reduce((map, obj) => map.set(obj.IDREPUESTO, obj), new Map()).values()),
    internamientos: Array.from(getObjects<Internamiento>('INTERNAMIENTO').reduce((map, obj) => map.set(obj.ID, obj), new Map()).values()),
    rutas: Array.from(getObjects<Ruta>('RUTAS').reduce((map, obj) => map.set(obj.ID, obj), new Map()).values()),
    transporte: Array.from(getObjects<Transporte>('TRANSPORTE').reduce((map, obj) => map.set(obj.ID, obj), new Map()).values()),
    caja: Array.from(getObjects<Caja>('CAJA').reduce((map, obj) => map.set(obj.ID, obj), new Map()).values()),
    actividadesDiarias: Array.from(getObjects<any>('ACTIVIDADESDIARIAS').reduce((map, raw, idx) => {
      const id = raw.ID || raw.Id || raw.id || raw['ID ACTIVIDAD'] || raw['ID_ACTIVIDAD'] || raw['CODIGO'] || `ACTIVIDAD-${String(idx + 1).padStart(4, '0')}`;
      const estadoRaw = (raw.ESTADO || raw.Estado || raw.estado || raw.STATUS || raw.Status || 'ASIGNADO').toUpperCase().trim();
      let estado = 'ASIGNADO';
      if (estadoRaw.includes('ATENCION') || estadoRaw.includes('ATENCIÓN') || estadoRaw.includes('PROCESO') || estadoRaw.includes('CURSO')) {
        estado = 'EN ATENCION';
      } else if (estadoRaw.includes('CERRAD') || estadoRaw.includes('FINALIZ') || estadoRaw.includes('COMPLET') || estadoRaw.includes('TERMINAD')) {
        estado = 'CERRADO';
      } else {
        estado = 'ASIGNADO';
      }

      const fecha = raw.FECHA || raw.Fecha || raw['FECHA DE INICIO'] || raw['FECHA INICIO'] || '';
      const creadoPor = raw['CREADO POR'] || raw['CREADO_POR'] || raw['Creado Por'] || raw['PROGRAMADO POR'] || raw['SOLICITANTE'] || '';
      const asignadoA = raw['ASIGNADO A'] || raw['ASIGNADO_A'] || raw['Asignado A'] || raw.ASIGNADO || raw.Asignado || raw.TECNICO || '';
      const motivo = raw['MOTIVO DE LA ACTIVIDAD'] || raw['MOTIVO'] || raw['Motivo de la Actividad'] || raw.ACTIVIDAD || raw.Actividad || raw.DESCRIPCION || '';
      const ida = raw.IDA || raw.Ida || '';
      const vuelta = raw.VUELTA || raw.Vuelta || '';
      const gastoPasaje = raw['GASTO DE PASAJE'] || raw['GASTO PASAJE'] || raw['Gasto de Pasaje'] || '';
      const gastoAdicional = raw['GASTO ADICIONAL'] || raw['Gasto Adicional'] || '';
      const montoTotal = raw['MONTO TOTAL'] || raw['Monto Total'] || '';
      const estadoGasto = raw['ESTADO GASTO'] || raw['ESTADO_GASTO'] || raw['Estado Gasto'] || 'NO CANCELADO';

      const normalized: ActividadDiaria = {
        ID: String(id).trim(),
        FECHA: String(fecha).trim(),
        'CREADO POR': String(creadoPor).trim(),
        'ASIGNADO A': String(asignadoA).trim(),
        'MOTIVO DE LA ACTIVIDAD': String(motivo).trim(),
        IDA: String(ida).trim(),
        VUELTA: String(vuelta).trim(),
        'GASTO DE PASAJE': String(gastoPasaje).trim(),
        'GASTO ADICIONAL': String(gastoAdicional).trim(),
        'MONTO TOTAL': String(montoTotal).trim(),
        ESTADO: estado,
        'ESTADO GASTO': String(estadoGasto).trim(),
        // Legacy compatibility aliases
        'FECHA DE INICIO': String(fecha).trim(),
        ACTIVIDAD: String(motivo).trim(),
        ASIGNADO: String(asignadoA).trim(),
        'PROGRAMADO POR': String(creadoPor).trim(),
        _rowIndex: raw._rowIndex
      };

      const mapKey = normalized.ID || `ROW-${raw._rowIndex}`;
      return map.set(mapKey, normalized);
    }, new Map<string, ActividadDiaria>()).values()),
    tranacti: Array.from(getObjects<Tranacti>('TRANACTI').reduce((map, obj) => map.set(obj.ID, obj), new Map()).values()),
    accesos: []
  };
}

const TICKET_COLUMNS = [
  'IDTICKET', 'FHINGRESO', 'CLIENTE', 'DIRECCION', 'TELEFONO', 'CONTACTO',
  'FHPROGRAMADA', 'ESTADO', 'PRIORIDAD', 'TIPO', 'PROBLEMA', 'TECNICO',
  'NOTIFICA', 'MODO DE ATENCION', 'NOTITEC', 'NOTICLI', 'PREFIJO', 'SUMAXH',
  'FIRMA', 'PDF', 'FIRMATECH', 'COMENTARIO DE FOTO', 'DATEINICIO', 'DONDE CERRE',
  'TOTAL DE HORAS', 'ESTADO_SOLICITUD', 'GPS ENTRADA', 'GPS SALIDA',
  'ACTIVIDAD DEL TICKET', 'OBSERVACIONES', 'FHLLC', 'FHSC', 'FECHA DE CIERRE'
];

export async function createTicket(ticket: Partial<Ticket>): Promise<void> {
  const token = await getAccessToken();
  if (!token) throw new Error('No access token');

  const row = TICKET_COLUMNS.map(col => (ticket as any)[col] || '');

  const response = await fetch(
    `/api/google/sheets/v4/spreadsheets/${SPREADSHEET_ID}/values/TICKET:append?valueInputOption=USER_ENTERED`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        values: [row]
      })
    }
  );

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Failed to create ticket: ${err}`);
  }
}

export function columnToLetter(column: number): string {
  let temp, letter = '';
  let col = column + 1;
  while (col > 0) {
    temp = (col - 1) % 26;
    letter = String.fromCharCode(temp + 65) + letter;
    col = Math.floor((col - temp - 1) / 26);
  }
  return letter;
}

export async function getActualSheetTitle(token: string, canonicalName: string): Promise<string> {
  try {
    const metaResponse = await fetch(
      `/api/google/sheets/v4/spreadsheets/${SPREADSHEET_ID}?fields=sheets.properties`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (metaResponse.ok) {
      const metaData = await metaResponse.json();
      const existingSheetTitles: string[] = (metaData.sheets || []).map((s: any) => s.properties.title);
      const matched = findSheetTitle(existingSheetTitles, canonicalName);
      if (matched) return matched;
    }
  } catch (e) {
    // fallback
  }
  return canonicalName;
}

export async function updateTicket(
  rowIndex?: number, 
  ticket?: Partial<Ticket>
): Promise<{ updatedFields: string[]; targetRow: number }> {
  if (!ticket) throw new Error('No se proporcionaron datos para actualizar el ticket');
  const token = await getAccessToken();
  if (!token) throw new Error('No hay token de acceso disponible. Por favor inicia sesión con Google.');

  const targetSheet = await getActualSheetTitle(token, 'TICKET');
  const safeSheet = targetSheet.replace(/'/g, "''");

  // 1. Fetch header row of TICKET sheet to determine exact column layout
  let headers: string[] = [];
  try {
    const headerRange = encodeURIComponent(`'${safeSheet}'!A1:AZ1`);
    const headerResp = await fetch(
      `/api/google/sheets/v4/spreadsheets/${SPREADSHEET_ID}/values/${headerRange}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (headerResp.ok) {
      const headerData = await headerResp.json();
      headers = ((headerData.values && headerData.values[0]) || []).map((h: string) => (h || '').trim());
    } else {
      console.warn(`[updateTicket] Could not read headers (${headerResp.status}):`, await headerResp.text());
    }
  } catch (e) {
    console.warn('[updateTicket] Could not read header row for TICKET sheet, using default columns', e);
  }

  if (!headers || headers.length === 0) {
    headers = [...TICKET_COLUMNS];
  }

  // 2. Identify ID column index
  let idColIdx = headers.findIndex(h => {
    const n = (h || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    return n === 'IDTICKET' || n === 'ID' || n === 'CODIGO';
  });
  if (idColIdx === -1) idColIdx = 0;
  const idColLetter = columnToLetter(idColIdx);

  // 3. Find the exact row in Google Sheets by IDTICKET (must modify only in the same row)
  const ticketId = (ticket.IDTICKET || '').trim().toUpperCase();
  let targetRow: number | undefined = undefined;

  // 3a. If rowIndex was provided, check if that exact row contains the ticketId
  if (rowIndex && rowIndex >= 2) {
    try {
      const cellRange = encodeURIComponent(`'${safeSheet}'!${idColLetter}${rowIndex}`);
      const checkResp = await fetch(
        `/api/google/sheets/v4/spreadsheets/${SPREADSHEET_ID}/values/${cellRange}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (checkResp.ok) {
        const checkData = await checkResp.json();
        const cellVal = ((checkData.values && checkData.values[0] && checkData.values[0][0]) || '').trim().toUpperCase();
        if (!ticketId || cellVal === ticketId) {
          targetRow = rowIndex;
          console.log(`[updateTicket] Verified ticket ${ticketId} is located at row ${targetRow}`);
        }
      }
    } catch (e) {
      console.warn(`[updateTicket] Error checking row ${rowIndex}:`, e);
    }
  }

  // 3b. If targetRow not confirmed yet and ticketId is known, scan the ID column to find the exact row
  if (!targetRow && ticketId) {
    try {
      const colRange = encodeURIComponent(`'${safeSheet}'!${idColLetter}:${idColLetter}`);
      const idColResp = await fetch(
        `/api/google/sheets/v4/spreadsheets/${SPREADSHEET_ID}/values/${colRange}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (idColResp.ok) {
        const idData = await idColResp.json();
        const rows: string[][] = idData.values || [];
        for (let i = 1; i < rows.length; i++) {
          const cellVal = (rows[i]?.[0] || '').trim().toUpperCase();
          if (cellVal === ticketId) {
            targetRow = i + 1; // 1-based row index in Google Sheets
            console.log(`[updateTicket] Found ticket ${ticketId} by scanning at row ${targetRow}`);
            break;
          }
        }
      }
    } catch (e) {
      console.warn('[updateTicket] Could not scan ID column in TICKET sheet', e);
    }
  }

  // 3c. Fallback to passed rowIndex if scanning didn't locate it
  if (!targetRow && rowIndex && rowIndex >= 2) {
    targetRow = rowIndex;
  }

  if (!targetRow || targetRow < 2) {
    throw new Error(`No se pudo ubicar la fila para el ticket ${ticket.IDTICKET || ''} en la hoja ${targetSheet}`);
  }

  // 4. Read the current existing row in Google Sheets to identify ONLY the changed cells
  const lastColIdx = Math.max(headers.length - 1, TICKET_COLUMNS.length - 1);
  const lastColLetter = columnToLetter(lastColIdx);
  let existingRow: string[] = [];

  try {
    const existingRange = encodeURIComponent(`'${safeSheet}'!A${targetRow}:${lastColLetter}${targetRow}`);
    const existingResp = await fetch(
      `/api/google/sheets/v4/spreadsheets/${SPREADSHEET_ID}/values/${existingRange}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (existingResp.ok) {
      const existingData = await existingResp.json();
      existingRow = (existingData.values && existingData.values[0]) || [];
    } else {
      console.warn(`[updateTicket] Could not read existing row ${targetRow} (${existingResp.status}):`, await existingResp.text());
    }
  } catch (e) {
    console.warn('[updateTicket] Could not read existing row in TICKET sheet', e);
  }

  // 5. Detect which columns actually have changed values
  const ticketEntries = Object.entries(ticket);
  const getTicketVal = (headerName: string) => {
    if (!headerName) return undefined;
    if ((ticket as any)[headerName] !== undefined) {
      return (ticket as any)[headerName];
    }
    const normH = headerName.toUpperCase().replace(/[^A-Z0-9]/g, '');
    for (const [k, v] of ticketEntries) {
      if (k.startsWith('_')) continue;
      const normK = k.toUpperCase().replace(/[^A-Z0-9]/g, '');
      if (normK === normH && v !== undefined) {
        return v;
      }
      
      // ALIASES
      if (normH === 'FIRMACLIENTE' && normK === 'FIRMA' && v !== undefined) return v;
      if (normH === 'FIRMA' && normK === 'FIRMACLIENTE' && v !== undefined) return v;
      if (normH === 'FIRMATÉCNICO' && normK === 'FIRMATECH' && v !== undefined) return v;
      if (normH === 'FIRMATECNICO' && normK === 'FIRMATECH' && v !== undefined) return v;
      if (normH === 'SUMAXH' && normK === 'SUMAXH' && v !== undefined) return v;
      if (normH === 'TOTALHORAS' && normK === 'TOTALDEHORAS' && v !== undefined) return v;
      if (normH === 'TOTALDEHORAS' && normK === 'TOTALHORAS' && v !== undefined) return v;
      if (normH === 'DATEINICIO' && normK === 'FECHAINICIO' && v !== undefined) return v;
      if (normH === 'FECHAINICIO' && normK === 'DATEINICIO' && v !== undefined) return v;
      if (normH === 'DONDECERRE' && normK === 'LUGARCIERRE' && v !== undefined) return v;
      if (normH === 'LUGARCIERRE' && normK === 'DONDECERRE' && v !== undefined) return v;
      if (normH === 'COMENTARIOS' && normK === 'COMENTARIODEFOTO' && v !== undefined) return v;
      if (normH === 'COMENTARIOFOTO' && normK === 'COMENTARIODEFOTO' && v !== undefined) return v;
      if (normH === 'URLPDF' && normK === 'PDF' && v !== undefined) return v;
      if (normH === 'ENLACEPDF' && normK === 'PDF' && v !== undefined) return v;
    }
    return undefined;
  };

  const updatesToApply: { range: string; values: string[][] }[] = [];
  const updatedFieldNames: string[] = [];

  for (let c = 0; c < headers.length; c++) {
    const colHeader = headers[c] || '';
    if (!colHeader) continue;
    // Don't overwrite the ID column itself
    if (c === idColIdx) continue;

    const newVal = getTicketVal(colHeader);
    if (newVal === undefined || newVal === null) continue;

    const newValStr = String(newVal).trim();
    const existingValStr = (existingRow[c] !== undefined ? String(existingRow[c]) : '').trim();

    // STRICT RULE: Only update cells where value actually changed!
    if (newValStr !== existingValStr) {
      const colLetter = columnToLetter(c);
      const cellRange = `'${safeSheet}'!${colLetter}${targetRow}`;
      updatesToApply.push({
        range: cellRange,
        values: [[newValStr]]
      });
      updatedFieldNames.push(colHeader);
    }
  }

  // 6. If no fields changed, avoid unnecessary API calls
  if (updatesToApply.length === 0) {
    console.log(`[updateTicket] No hay celdas modificadas para el ticket ${ticket.IDTICKET} en la fila ${targetRow}.`);
    (ticket as any)._rowIndex = targetRow;
    return { updatedFields: [], targetRow };
  }

  // 7. Write ONLY the changed cells into the exact same row (NEVER create new rows)
  console.log(`[updateTicket] Modificando solo la data cambiada en la misma fila ${targetRow} (${updatesToApply.length} celdas):`, updatedFieldNames);

  const response = await fetch(
    `/api/google/sheets/v4/spreadsheets/${SPREADSHEET_ID}/values:batchUpdate`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        valueInputOption: 'USER_ENTERED',
        data: updatesToApply
      })
    }
  );

  if (!response.ok) {
    const err = await response.text();
    console.error(`[updateTicket] Failed to update row in TICKET (${response.status}):`, err);
    throw new Error(`Error de Google Sheets al actualizar fila ${targetRow} (${response.status}): ${err}`);
  }

  // Update in-memory _rowIndex
  (ticket as any)._rowIndex = targetRow;

  return { updatedFields: updatedFieldNames, targetRow };
}

export function parseDateStringToTimestamp(str: string | undefined | null): number | null {
  if (!str || typeof str !== 'string') return null;
  const clean = str.trim();
  if (!clean) return null;

  // Format 1: DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY with optional HH:mm[:ss]
  const matchDMY = clean.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
  if (matchDMY) {
    const d = parseInt(matchDMY[1], 10);
    const m = parseInt(matchDMY[2], 10) - 1;
    const y = parseInt(matchDMY[3], 10);
    const hh = matchDMY[4] ? parseInt(matchDMY[4], 10) : 0;
    const mm = matchDMY[5] ? parseInt(matchDMY[5], 10) : 0;
    const ss = matchDMY[6] ? parseInt(matchDMY[6], 10) : 0;
    const date = new Date(y, m, d, hh, mm, ss);
    if (!isNaN(date.getTime())) return date.getTime();
  }

  // Format 2: YYYY/MM/DD or YYYY-MM-DD with optional HH:mm[:ss] or T
  const matchYMD = clean.match(/^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})(?:[\sT](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
  if (matchYMD) {
    const y = parseInt(matchYMD[1], 10);
    const m = parseInt(matchYMD[2], 10) - 1;
    const d = parseInt(matchYMD[3], 10);
    const hh = matchYMD[4] ? parseInt(matchYMD[4], 10) : 0;
    const mm = matchYMD[5] ? parseInt(matchYMD[5], 10) : 0;
    const ss = matchYMD[6] ? parseInt(matchYMD[6], 10) : 0;
    const date = new Date(y, m, d, hh, mm, ss);
    if (!isNaN(date.getTime())) return date.getTime();
  }

  const fallback = Date.parse(clean);
  if (!isNaN(fallback)) return fallback;

  return null;
}

export function formatDateToDDMMAAAA(timestampOrDate: number | Date): string {
  const d = typeof timestampOrDate === 'number' ? new Date(timestampOrDate) : timestampOrDate;
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

export function extractMaxFHFINDate(actList: { FHFIN?: string }[], fallbackDateStr?: string): string | null {
  let maxTimestamp: number | null = null;

  for (const act of actList) {
    if (act.FHFIN) {
      const ts = parseDateStringToTimestamp(act.FHFIN);
      if (ts !== null) {
        if (maxTimestamp === null || ts > maxTimestamp) {
          maxTimestamp = ts;
        }
      }
    }
  }

  if (maxTimestamp === null && fallbackDateStr) {
    const ts = parseDateStringToTimestamp(fallbackDateStr);
    if (ts !== null) {
      maxTimestamp = ts;
    }
  }

  if (maxTimestamp !== null) {
    return formatDateToDDMMAAAA(maxTimestamp);
  }

  return null;
}

export async function batchUpdateTicketFechaCierre(
  updates: { rowIndex: number; fechaCierre: string }[]
): Promise<void> {
  if (updates.length === 0) return;
  const token = await getAccessToken();
  if (!token) throw new Error('No access token');

  const sheetTitle = await getActualSheetTitle(token, 'TICKET');
  
  // Find column of FECHA DE CIERRE by reading headers or default to column AG
  let colLetter = 'AG';
  try {
    const headerResp = await fetch(
      `/api/google/sheets/v4/spreadsheets/${SPREADSHEET_ID}/values/'${sheetTitle.replace(/'/g, "''")}'!1:1`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (headerResp.ok) {
      const headerData = await headerResp.json();
      const headers: string[] = (headerData.values && headerData.values[0]) || [];
      const colIdx = headers.findIndex(h => {
        const norm = (h || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
        return norm === 'FECHADECIERRE' || norm === 'FECHACIERRE' || norm === 'CIERRE';
      });
      if (colIdx !== -1) {
        colLetter = columnToLetter(colIdx);
      }
    }
  } catch (e) {
    console.warn('Could not determine exact header column for FECHA DE CIERRE, using default AG', e);
  }

  const chunkSize = 200;
  for (let i = 0; i < updates.length; i += chunkSize) {
    const chunk = updates.slice(i, i + chunkSize);
    const data = chunk.map(u => ({
      range: `'${sheetTitle.replace(/'/g, "''")}'!${colLetter}${u.rowIndex}`,
      values: [[u.fechaCierre]]
    }));

    const response = await fetch(
      `/api/google/sheets/v4/spreadsheets/${SPREADSHEET_ID}/values:batchUpdate`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          valueInputOption: 'USER_ENTERED',
          data
        })
      }
    );

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Failed to batch update fecha de cierre: ${err}`);
    }
  }
}

export async function uploadImage(file: File, folderId: string, customName?: string): Promise<string> {
  const token = await getAccessToken();
  if (!token) throw new Error('No access token');

  const metadata = {
    name: customName || file.name,
    parents: [folderId]
  };

  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  form.append('file', file);

  const response = await fetch(
    '/api/google/upload/v3/files?uploadType=multipart&fields=id,webViewLink,webContentLink',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`
      },
      body: form
    }
  );

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Failed to upload image: ${err}`);
  }

  const data = await response.json();

  // Opcional: configurar permisos para que el cliente pueda abrir y descargar el PDF desde WhatsApp sin requerir login
  if (data.id) {
    try {
      await fetch(`/api/google/drive/v3/files/${data.id}/permissions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          role: 'reader',
          type: 'anyone'
        })
      });
    } catch {
      // Ignorar si la organización no permite permisos públicos
    }
  }

  return data.webViewLink || (data.id ? `https://drive.google.com/file/d/${data.id}/view` : '');
}

export async function createFotoTicket(id: string, idTicket: string, fotoUrl: string): Promise<void> {
  const token = await getAccessToken();
  if (!token) throw new Error('No access token');

  const row = [id, idTicket, fotoUrl];

  const response = await fetch(
    `/api/google/sheets/v4/spreadsheets/${SPREADSHEET_ID}/values/FOTOSTICKET:append?valueInputOption=USER_ENTERED`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        values: [row]
      })
    }
  );

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Failed to create foto ticket: ${err}`);
  }
}

const ACTIVIDADES_COLUMNS = [
  'IDACTIVIDADES', 'IDTICKET', 'FHINICIO', 'SOLUCION', 'FHFIN',
  'TIPO', 'MARCA', 'MODELO', 'SERIE', 'USUARIO', 'AREA', 'CLIENTE', 'TE', 'TECNICO', 'CELULAR'
];

export async function createActividad(actividad: Partial<Actividad>): Promise<void> {
  const token = await getAccessToken();
  if (!token) throw new Error('No access token');
  
  const targetSheet = await getActualSheetTitle(token, 'ACTIVIDADES');
  const safeSheet = targetSheet.replace(/'/g, "''");
  const row = ACTIVIDADES_COLUMNS.map(col => (actividad as any)[col] || '');
  
  const response = await fetch(
    `/api/google/sheets/v4/spreadsheets/${SPREADSHEET_ID}/values/'${safeSheet}':append?valueInputOption=USER_ENTERED`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        values: [row]
      })
    }
  );
  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Failed to create actividad: ${err}`);
  }

  try {
    const data = await response.json();
    const updatedRange = data?.updates?.updatedRange || '';
    const match = updatedRange.match(/!A(\d+)/);
    if (match && match[1]) {
      (actividad as any)._rowIndex = parseInt(match[1], 10);
    }
  } catch (e) {
    // ignore error extracting rowIndex
  }
}

export async function createFotoAct(fotoAct: Partial<FotoAct>): Promise<void> {
  const token = await getAccessToken();
  if (!token) throw new Error('No access token');
  
  const targetSheet = await getActualSheetTitle(token, 'FOTOACT');
  const safeSheet = targetSheet.replace(/'/g, "''");
  const row = [fotoAct.ID || '', fotoAct.IDACTIVIDADES || '', fotoAct.FOTO || ''];
  
  const response = await fetch(
    `/api/google/sheets/v4/spreadsheets/${SPREADSHEET_ID}/values/'${safeSheet}':append?valueInputOption=USER_ENTERED`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        values: [row]
      })
    }
  );
  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Failed to create foto actividad: ${err}`);
  }
}

export async function createRepuesto(repuesto: Partial<Repuesto>): Promise<void> {
  const token = await getAccessToken();
  if (!token) throw new Error('No access token');
  
  const targetSheet = await getActualSheetTitle(token, 'REPUESTOS');
  const safeSheet = targetSheet.replace(/'/g, "''");
  const row = [repuesto.IDREPUESTO || '', repuesto.IDTICKET || '', repuesto.CANTIDAD || '', repuesto.DESCRIPCION || ''];
  
  const response = await fetch(
    `/api/google/sheets/v4/spreadsheets/${SPREADSHEET_ID}/values/'${safeSheet}':append?valueInputOption=USER_ENTERED`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        values: [row]
      })
    }
  );
  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Failed to create repuesto: ${err}`);
  }
}

export async function sendEmail(_to: string, _subject: string, _bodyHtml: string): Promise<void> {
  throw new Error('El envío automático requiere configurar un proveedor de correo en el servidor.');
}

const RUTAS_COLUMNS = [
  'ID', 'ORIGEN', 'DESTINO', 'MONTO', 'TECNICO', 'TICKET/ACTIVIDAD', 'MOTIVO', 'ESTADO', 'FECHA'
];

export async function createRuta(ruta: Partial<Ruta>): Promise<void> {
  const token = await getAccessToken();
  if (!token) throw new Error('No access token');
  
  const row = RUTAS_COLUMNS.map(col => (ruta as any)[col] || '');
  
  const response = await fetch(
    `/api/google/sheets/v4/spreadsheets/${SPREADSHEET_ID}/values/RUTAS:append?valueInputOption=USER_ENTERED`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        values: [row]
      })
    }
  );

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Failed to create ruta: ${err}`);
  }
}

export async function createTransporte(transporteList: Partial<Transporte>[]): Promise<void> {
  const token = await getAccessToken();
  if (!token) throw new Error('No access token');
  
  const values = transporteList.map(t => [t.ID || '', t.IDRUTA || '', t.MOVIL || '', t.PASAJE || '']);
  
  const response = await fetch(
    `/api/google/sheets/v4/spreadsheets/${SPREADSHEET_ID}/values/TRANSPORTE:append?valueInputOption=USER_ENTERED`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        values: values
      })
    }
  );

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Failed to create transporte: ${err}`);
  }
}

export async function createTranacti(tranactiList: Partial<Tranacti>[]): Promise<void> {
  if (!tranactiList || tranactiList.length === 0) return;
  const token = await getAccessToken();
  if (!token) throw new Error('No access token');
  
  const targetSheet = await getActualSheetTitle(token, 'TRANACTI');
  const safeSheet = targetSheet.replace(/'/g, "''");
  const values = tranactiList.map(t => [t.ID || '', t.IDRUTA || '', t.MOVIL || '', t.PASAJE || '']);
  
  const response = await fetch(
    `/api/google/sheets/v4/spreadsheets/${SPREADSHEET_ID}/values/'${safeSheet}':append?valueInputOption=USER_ENTERED`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ values })
    }
  );

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Failed to create TRANACTI: ${err}`);
  }
}

export async function deleteTranactiByRuta(idRuta: string): Promise<void> {
  if (!idRuta) return;
  const token = await getAccessToken();
  if (!token) return;
  
  try {
    const targetSheet = await getActualSheetTitle(token, 'TRANACTI');
    const safeSheet = targetSheet.replace(/'/g, "''");

    const res = await fetch(
      `/api/google/sheets/v4/spreadsheets/${SPREADSHEET_ID}/values/'${safeSheet}'!A:D`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!res.ok) return;
    const data = await res.json();
    const rows = data.values || [];
    const toDelete: number[] = [];
    const cleanTarget = idRuta.trim().toUpperCase();
    for (let i = 1; i < rows.length; i++) {
      const rowIdRuta = (rows[i][1] || '').toString().trim().toUpperCase();
      if (rowIdRuta === cleanTarget) {
        toDelete.push(i + 1);
      }
    }
    if (toDelete.length > 0) {
      await deleteRows(targetSheet, toDelete);
    }
  } catch (err) {
    console.warn('deleteTranactiByRuta error:', err);
  }
}

export async function saveTranactiForActividad(idRuta: string, segments: Partial<Tranacti>[]): Promise<void> {
  if (!idRuta) return;
  const token = await getAccessToken();
  if (!token) throw new Error('No access token');
  
  const targetSheet = await getActualSheetTitle(token, 'TRANACTI');
  const safeSheet = targetSheet.replace(/'/g, "''");

  // First delete any existing segments for this idRuta
  try {
    const res = await fetch(
      `/api/google/sheets/v4/spreadsheets/${SPREADSHEET_ID}/values/'${safeSheet}'!A:D`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (res.ok) {
      const data = await res.json();
      const rows = data.values || [];
      const toDelete: number[] = [];
      const cleanTarget = idRuta.trim().toUpperCase();
      for (let i = 1; i < rows.length; i++) {
        const rowIdRuta = (rows[i][1] || '').toString().trim().toUpperCase();
        if (rowIdRuta === cleanTarget) {
          toDelete.push(i + 1);
        }
      }
      if (toDelete.length > 0) {
        await deleteRows(targetSheet, toDelete);
      }
    }
  } catch (delErr) {
    console.warn('Error clearing existing TRANACTI rows:', delErr);
  }

  // Then append new segments
  if (segments && segments.length > 0) {
    const values = segments.map(s => [s.ID || '', idRuta, s.MOVIL || '', s.PASAJE || '']);
    const appendRes = await fetch(
      `/api/google/sheets/v4/spreadsheets/${SPREADSHEET_ID}/values/'${safeSheet}':append?valueInputOption=USER_ENTERED`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ values })
      }
    );
    if (!appendRes.ok) {
      const err = await appendRes.text();
      throw new Error(`Failed to append TRANACTI: ${err}`);
    }
  }
}

const CAJA_COLUMNS = ['ID', 'CAJA', 'ABONO', 'FECHA'];

export async function createCajaEntry(caja: Partial<Caja>): Promise<void> {
  const token = await getAccessToken();
  if (!token) throw new Error('No access token');
  
  const row = CAJA_COLUMNS.map(col => (caja as any)[col] || '');
  
  const response = await fetch(
    `/api/google/sheets/v4/spreadsheets/${SPREADSHEET_ID}/values/CAJA:append?valueInputOption=USER_ENTERED`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        values: [row]
      })
    }
  );

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Failed to create caja entry: ${err}`);
  }
}

export async function updateRutaEstado(rutaId: string, nuevoEstado: string): Promise<void> {
  const token = await getAccessToken();
  if (!token) throw new Error('No access token');

  const response = await fetch(
    `/api/google/sheets/v4/spreadsheets/${SPREADSHEET_ID}/values/RUTAS!A:A`,
    {
      headers: {
        Authorization: `Bearer ${token}`
      }
    }
  );

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Failed to fetch rutas for update: ${err}`);
  }

  const data = await response.json();
  const rows = data.values || [];
  
  let rowIndex = -1;
  for (let i = 0; i < rows.length; i++) {
    if (rows[i][0] === rutaId) {
      rowIndex = i + 1;
      break;
    }
  }

  if (rowIndex === -1) {
    throw new Error(`Ruta ${rutaId} no encontrada`);
  }

  const updateResponse = await fetch(
    `/api/google/sheets/v4/spreadsheets/${SPREADSHEET_ID}/values/RUTAS!H${rowIndex}?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        values: [[nuevoEstado]]
      })
    }
  );

  if (!updateResponse.ok) {
    const err = await updateResponse.text();
    throw new Error(`Failed to update ruta estado: ${err}`);
  }
}


const EMPRESA_COLUMNS = ['ID', 'CLIENTE', 'DIRECCION', 'RUC'];
export async function createEmpresa(empresa: Partial<Empresa>): Promise<void> {
  const token = await getAccessToken();
  if (!token) throw new Error('No access token');
  const row = EMPRESA_COLUMNS.map(col => (empresa as any)[col] || '');
  const response = await fetch(
    `/api/google/sheets/v4/spreadsheets/${SPREADSHEET_ID}/values/EMPRESA:append?valueInputOption=USER_ENTERED`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ values: [row] })
    }
  );
  if (!response.ok) throw new Error(`Failed to create empresa: ${await response.text()}`);
}
export async function updateEmpresa(rowIndex: number, empresa: Partial<Empresa>): Promise<void> {
  const token = await getAccessToken();
  if (!token) throw new Error('No access token');
  const row = EMPRESA_COLUMNS.map(col => (empresa as any)[col] || '');
  const response = await fetch(
    `/api/google/sheets/v4/spreadsheets/${SPREADSHEET_ID}/values/EMPRESA!A${rowIndex}:D${rowIndex}?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ values: [row] })
    }
  );
  if (!response.ok) throw new Error(`Failed to update empresa: ${await response.text()}`);
}
export async function deleteEmpresaRow(rowIndex: number): Promise<void> {
  const token = await getAccessToken();
  if (!token) throw new Error('No access token');
  
  // To delete a row we actually need the sheetId, but we can also just clear it
  // Wait, the prompt says "eliminar directamente EMPRESA".
  // A clear doesn't shift rows up. Let's see if there's a delete function or we just clear.
  // We can use batchUpdate to delete the row, but we need the sheetId for EMPRESA.
  // Easiest is to just clear the row or do a real delete?
  // Let's do clear for now? "eliminar directamente EMPRESA y sus CONTACTOS relacionados"
  // If we just clear the row, it might leave an empty row. The Google Sheets API batchUpdate with DeleteDimensionRequest is the proper way.
  // But without sheetId, maybe we can fetch sheetId first.
}

const CONTACTOS_COLUMNS = ['ID', 'NOMBRE', 'CELULAR', 'EMPRESA', 'CORREO', 'CARGO', 'Pais', 'PREFIJO'];
export async function createContacto(contacto: Partial<Contacto>): Promise<void> {
  const token = await getAccessToken();
  if (!token) throw new Error('No access token');
  const row = CONTACTOS_COLUMNS.map(col => (contacto as any)[col] || '');
  const response = await fetch(
    `/api/google/sheets/v4/spreadsheets/${SPREADSHEET_ID}/values/CONTACTOS:append?valueInputOption=USER_ENTERED`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ values: [row] })
    }
  );
  if (!response.ok) throw new Error(`Failed to create contacto: ${await response.text()}`);
}
export async function updateContacto(rowIndex: number, contacto: Partial<Contacto>): Promise<void> {
  const token = await getAccessToken();
  if (!token) throw new Error('No access token');
  const row = CONTACTOS_COLUMNS.map(col => (contacto as any)[col] || '');
  const response = await fetch(
    `/api/google/sheets/v4/spreadsheets/${SPREADSHEET_ID}/values/CONTACTOS!A${rowIndex}:H${rowIndex}?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ values: [row] })
    }
  );
  if (!response.ok) throw new Error(`Failed to update contacto: ${await response.text()}`);
}

const TECNICOS_COLUMNS = ['ID', 'NOMBRE', 'DNI', 'CELULAR', 'FIRMATECH', 'FOTO', 'FECHA DE NACIMIENTO'];
export async function createTecnico(tecnico: Partial<Tecnico>): Promise<void> {
  const token = await getAccessToken();
  if (!token) throw new Error('No access token');
  const row = TECNICOS_COLUMNS.map(col => (tecnico as any)[col] || '');
  const response = await fetch(
    `/api/google/sheets/v4/spreadsheets/${SPREADSHEET_ID}/values/TECNICOS:append?valueInputOption=USER_ENTERED`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ values: [row] })
    }
  );
  if (!response.ok) throw new Error(`Failed to create tecnico: ${await response.text()}`);
}
export async function updateTecnico(rowIndex: number, tecnico: Partial<Tecnico>): Promise<void> {
  const token = await getAccessToken();
  if (!token) throw new Error('No access token');
  const row = TECNICOS_COLUMNS.map(col => (tecnico as any)[col] || '');
  const response = await fetch(
    `/api/google/sheets/v4/spreadsheets/${SPREADSHEET_ID}/values/TECNICOS!A${rowIndex}:G${rowIndex}?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ values: [row] })
    }
  );
  if (!response.ok) throw new Error(`Failed to update tecnico: ${await response.text()}`);
}

export async function deleteRows(sheetName: string, rowIndices: number[]): Promise<void> {
  const token = await getAccessToken();
  if (!token) throw new Error('No access token');

  // First fetch the sheetId for the given sheetName
  const metaResponse = await fetch(
    `/api/google/sheets/v4/spreadsheets/${SPREADSHEET_ID}?fields=sheets.properties`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!metaResponse.ok) throw new Error(`Failed to fetch metadata`);
  const metaData = await metaResponse.json();
  const normTarget = normalizeSheetName(sheetName);
  const sheet = (metaData.sheets || []).find((s: any) => {
    const t = s.properties.title;
    if (t === sheetName) return true;
    if (normalizeSheetName(t) === normTarget) return true;
    if (normTarget === 'ACTIVIDADESDIARIAS') {
      const n = normalizeSheetName(t);
      return n.includes('ACTIVIDAD') && (n.includes('DIARIA') || n.includes('DIARIAS') || n.includes('INTERNA') || n.includes('INTERNAS'));
    }
    return false;
  });
  if (!sheet) throw new Error(`Sheet ${sheetName} not found`);
  const sheetId = sheet.properties.sheetId;

  // We must delete in reverse order to not mess up the indices!
  rowIndices.sort((a, b) => b - a);

  const requests = rowIndices.map(rowIndex => ({
    deleteDimension: {
      range: {
        sheetId: sheetId,
        dimension: "ROWS",
        startIndex: rowIndex - 1,
        endIndex: rowIndex
      }
    }
  }));

  const response = await fetch(
    `/api/google/sheets/v4/spreadsheets/${SPREADSHEET_ID}:batchUpdate`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ requests })
    }
  );
  if (!response.ok) throw new Error(`Failed to delete rows in ${sheetName}: ${await response.text()}`);
}

export async function updateActividad(rowIndex: number, actividad: Partial<Actividad>): Promise<void> {
  const token = await getAccessToken();
  if (!token) throw new Error('No access token');
  
  const targetSheet = await getActualSheetTitle(token, 'ACTIVIDADES');
  const safeSheet = targetSheet.replace(/'/g, "''");
  let targetRow = rowIndex && rowIndex >= 2 ? rowIndex : undefined;
  const actId = (actividad.IDACTIVIDADES || '').trim().toUpperCase();

  if (actId) {
    try {
      const colRange = encodeURIComponent(`'${safeSheet}'!A:A`);
      const colResp = await fetch(
        `/api/google/sheets/v4/spreadsheets/${SPREADSHEET_ID}/values/${colRange}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (colResp.ok) {
        const colData = await colResp.json();
        const rows: string[][] = colData.values || [];
        for (let i = 1; i < rows.length; i++) {
          if ((rows[i]?.[0] || '').trim().toUpperCase() === actId) {
            targetRow = i + 1;
            break;
          }
        }
      }
    } catch (e) {
      console.warn('Could not scan ID column in ACTIVIDADES sheet', e);
    }
  }

  if (!targetRow || targetRow < 2) {
    throw new Error(`No se pudo ubicar la fila para la actividad ${actId || rowIndex} en la hoja ${targetSheet}`);
  }

  const row = ACTIVIDADES_COLUMNS.map(col => (actividad as any)[col] !== undefined ? String((actividad as any)[col]) : '');
  const endCol = columnToLetter(row.length - 1);
  const writeRange = `'${safeSheet}'!A${targetRow}:${endCol}${targetRow}`;
  const encodedWriteRange = encodeURIComponent(writeRange);
  
  const response = await fetch(
    `/api/google/sheets/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodedWriteRange}?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        range: writeRange,
        majorDimension: 'ROWS',
        values: [row]
      })
    }
  );

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Failed to update actividad: ${err}`);
  }

  (actividad as any)._rowIndex = targetRow;
}

export async function deleteActividad(idAct: string, rowIndex?: number): Promise<void> {
  const token = await getAccessToken();
  if (!token) throw new Error('No access token');
  
  const targetSheet = await getActualSheetTitle(token, 'ACTIVIDADES');
  const safeSheet = targetSheet.replace(/'/g, "''");
  const cleanId = (idAct || '').trim().toUpperCase();
  let targetRow: number | undefined = undefined;

  // 1. Scan column A for exact cleanId to ensure accurate row index even if rows shifted
  if (cleanId) {
    try {
      const colRange = encodeURIComponent(`'${safeSheet}'!A:A`);
      const colResp = await fetch(
        `/api/google/sheets/v4/spreadsheets/${SPREADSHEET_ID}/values/${colRange}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (colResp.ok) {
        const colData = await colResp.json();
        const rows: string[][] = colData.values || [];
        for (let i = 1; i < rows.length; i++) {
          if ((rows[i]?.[0] || '').trim().toUpperCase() === cleanId) {
            targetRow = i + 1;
            break;
          }
        }
      }
    } catch (e) {
      console.warn('Could not scan column A in ACTIVIDADES', e);
    }
  }

  // 2. Fallback to passed rowIndex if not found via ID scan
  if (!targetRow && rowIndex && rowIndex >= 2) {
    targetRow = rowIndex;
  }

  if (!targetRow || targetRow < 2) {
    throw new Error(`No se pudo ubicar la fila para la actividad ${cleanId || rowIndex || ''} en la hoja ${targetSheet}`);
  }

  await deleteRows(targetSheet, [targetRow]);
}

const REPUESTOS_COLUMNS = ['IDREPUESTO', 'IDTICKET', 'CANTIDAD', 'DESCRIPCION'];

export async function updateRepuesto(rowIndex: number, repuesto: Partial<Repuesto>): Promise<void> {
  const token = await getAccessToken();
  if (!token) throw new Error('No access token');
  
  const targetSheet = await getActualSheetTitle(token, 'REPUESTOS');
  const safeSheet = targetSheet.replace(/'/g, "''");
  let targetRow = rowIndex && rowIndex >= 2 ? rowIndex : undefined;
  const repId = (repuesto.IDREPUESTO || '').trim().toUpperCase();

  if (repId) {
    try {
      const colRange = encodeURIComponent(`'${safeSheet}'!A:A`);
      const colResp = await fetch(
        `/api/google/sheets/v4/spreadsheets/${SPREADSHEET_ID}/values/${colRange}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (colResp.ok) {
        const colData = await colResp.json();
        const rows: string[][] = colData.values || [];
        for (let i = 1; i < rows.length; i++) {
          if ((rows[i]?.[0] || '').trim().toUpperCase() === repId) {
            targetRow = i + 1;
            break;
          }
        }
      }
    } catch (e) {
      console.warn('Could not scan ID column in REPUESTOS sheet', e);
    }
  }

  if (!targetRow || targetRow < 2) {
    throw new Error(`No se pudo ubicar la fila para el repuesto ${repId || rowIndex} en la hoja ${targetSheet}`);
  }

  const row = REPUESTOS_COLUMNS.map(col => (repuesto as any)[col] !== undefined ? String((repuesto as any)[col]) : '');
  const endCol = columnToLetter(row.length - 1);
  const writeRange = `'${safeSheet}'!A${targetRow}:${endCol}${targetRow}`;
  const encodedWriteRange = encodeURIComponent(writeRange);

  const response = await fetch(
    `/api/google/sheets/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodedWriteRange}?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        range: writeRange,
        majorDimension: 'ROWS',
        values: [row]
      })
    }
  );

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Failed to update repuesto: ${err}`);
  }

  (repuesto as any)._rowIndex = targetRow;
}


const ACTIVIDADESDIARIAS_COLUMNS = [
  'ID',
  'FECHA',
  'CREADO POR',
  'ASIGNADO A',
  'MOTIVO DE LA ACTIVIDAD',
  'IDA',
  'VUELTA',
  'GASTO DE PASAJE',
  'GASTO ADICIONAL',
  'MONTO TOTAL',
  'ESTADO',
  'ESTADO GASTO'
];

export async function createActividadDiaria(act: Partial<ActividadDiaria>): Promise<void> {
  const token = await getAccessToken();
  if (!token) throw new Error('No access token');
  
  const targetSheet = await getActualSheetTitle(token, 'ACTIVIDADESDIARIAS');
  const row = ACTIVIDADESDIARIAS_COLUMNS.map(col => (act as any)[col] || '');
  
  const response = await fetch(
    `/api/google/sheets/v4/spreadsheets/${SPREADSHEET_ID}/values/'${targetSheet.replace(/'/g, "''")}':append?valueInputOption=USER_ENTERED`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        values: [row]
      })
    }
  );

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Failed to create Actividad Diaria: ${err}`);
  }
}

export async function updateActividadDiaria(rowIndex: number, act: Partial<ActividadDiaria>): Promise<void> {
  const token = await getAccessToken();
  if (!token) throw new Error('No access token');
  
  const targetSheet = await getActualSheetTitle(token, 'ACTIVIDADESDIARIAS');
  const row = ACTIVIDADESDIARIAS_COLUMNS.map(col => (act as any)[col] || '');
  
  const response = await fetch(
    `/api/google/sheets/v4/spreadsheets/${SPREADSHEET_ID}/values/'${targetSheet.replace(/'/g, "''")}'!A${rowIndex}:L${rowIndex}?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        values: [row]
      })
    }
  );

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Failed to update Actividad Diaria: ${err}`);
  }
}

export async function updateActividadDiariaEstadoGasto(actId: string, nuevoEstadoGasto: string, rowIndex?: number): Promise<void> {
  const token = await getAccessToken();
  if (!token) throw new Error('No access token');
  
  const targetSheet = await getActualSheetTitle(token, 'ACTIVIDADESDIARIAS');

  let targetRow = rowIndex;
  if (!targetRow || targetRow < 2) {
    const response = await fetch(
      `/api/google/sheets/v4/spreadsheets/${SPREADSHEET_ID}/values/'${targetSheet.replace(/'/g, "''")}'!A:A`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (response.ok) {
      const data = await response.json();
      const rows = data.values || [];
      for (let i = 0; i < rows.length; i++) {
        if (rows[i][0] === actId) {
          targetRow = i + 1;
          break;
        }
      }
    }
  }

  if (!targetRow || targetRow < 2) {
    throw new Error(`Actividad ${actId} no encontrada`);
  }

  const updateResponse = await fetch(
    `/api/google/sheets/v4/spreadsheets/${SPREADSHEET_ID}/values/'${targetSheet.replace(/'/g, "''")}'!L${targetRow}?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        values: [[nuevoEstadoGasto]]
      })
    }
  );

  if (!updateResponse.ok) {
    const err = await updateResponse.text();
    throw new Error(`Failed to update estado gasto de actividad: ${err}`);
  }
}

const ACCESOS_COLUMNS = ['ID', 'CORREO', 'MODULOS_PERMITIDOS'];

export async function createAcceso(acceso: Partial<Acceso>): Promise<void> {
  const token = await getAccessToken();
  if (!token) throw new Error('No access token');
  
  const row = ACCESOS_COLUMNS.map(col => (acceso as any)[col] || '');
  
  const response = await fetch(
    `/api/google/sheets/v4/spreadsheets/${SPREADSHEET_ID}/values/ACCESOS:append?valueInputOption=USER_ENTERED`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ values: [row] })
    }
  );
  if (!response.ok) throw new Error('Failed to create acceso');
}

export async function updateAcceso(rowIndex: number, acceso: Partial<Acceso>): Promise<void> {
  const token = await getAccessToken();
  if (!token) throw new Error('No access token');
  
  const row = ACCESOS_COLUMNS.map(col => (acceso as any)[col] || '');
  
  const response = await fetch(
    `/api/google/sheets/v4/spreadsheets/${SPREADSHEET_ID}/values/ACCESOS!A${rowIndex}:C${rowIndex}?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ values: [row] })
    }
  );
  if (!response.ok) throw new Error('Failed to update acceso');
}

const INTERNAMIENTO_COLUMNS = [
  'ID', 'IDTICKET', 'CLIENTE', 'DIRECCION', 'CONTACTO', 'TELEFONO',
  'FHPROGRAMADA', 'ESTADO', 'PRIORIDAD', 'TIPO', 'PROBLEMA',
  'DESCRIPCION DEL EQUIPO', 'ACCESORIOS', 'OBSERVACIONES',
  'FIRMA DEL CLIENTE', 'NOMBRE RECEPCIONISTA', 'FIRMA DE RECEPCION'
];

export async function createInternamiento(internamiento: Partial<Internamiento>): Promise<void> {
  const token = await getAccessToken();
  if (!token) throw new Error('No access token');

  const row = INTERNAMIENTO_COLUMNS.map(col => (internamiento as any)[col] || '');

  const response = await fetch(
    `/api/google/sheets/v4/spreadsheets/${SPREADSHEET_ID}/values/INTERNAMIENTO:append?valueInputOption=USER_ENTERED`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        values: [row]
      })
    }
  );

  if (!response.ok) {
    const err = await response.text();
    console.warn(`Failed to create Internamiento record: ${err}`);
  }
}

export function dataURLtoFile(dataurl: string, filename: string): File {
  const arr = dataurl.split(',');
  const mime = (arr[0].match(/:(.*?);/) || [])[1] || 'image/jpeg';
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new File([u8arr], filename, { type: mime });
}

/**
 * Guarda directamente la firma del cliente en Google Drive y actualiza la columna FIRMA en la tabla TICKET de Google Sheets.
 * Esta función se ejecuta directamente desde el navegador de quien abre el enlace público (CANVA).
 */
export async function saveTicketSignatureDirectly(
  ticketId: string, 
  dataUrl: string, 
  tokenOverride?: string, 
  providedRowIndex?: number,
  targetStatus?: string
): Promise<{ driveUrl: string; targetRow: number; firmaColLetter: string; savedToSheet: boolean }> {
  const token = tokenOverride || (await getAccessToken());
  if (!token) {
    throw new Error('No hay credencial de Google activa para guardar la firma en Google Drive y Sheets.');
  }

  const cleanTicketId = ticketId.trim().toUpperCase();
  const fileName = `FIRMA-${cleanTicketId}.jpg`;
  const file = dataURLtoFile(dataUrl, fileName);

  console.log(`[saveTicketSignatureDirectly] Subiendo firma para ${cleanTicketId} a Google Drive...`);

  // 1. Subir archivo a la carpeta de Google Drive "Firmas Guia" (14zJIbLf9bfeM0RZiwsPDXGzcqfUWJw0o)
  const metadata = {
    name: fileName,
    parents: ['14zJIbLf9bfeM0RZiwsPDXGzcqfUWJw0o']
  };

  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  form.append('file', file);

  let driveResponse = await fetch(
    '/api/google/upload/v3/files?uploadType=multipart&fields=id,webViewLink,webContentLink',
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form
    }
  );

  if (!driveResponse.ok) {
    const err = await driveResponse.text();
    console.error('[saveTicketSignatureDirectly] Error subiendo a Drive con carpeta especificada:', err);
    if (err.includes('storageQuotaExceeded') || err.includes('quota has been exceeded')) {
      throw new Error(`El almacenamiento de Google Drive está lleno. El administrador debe liberar espacio en su cuenta o ampliar la cuota de almacenamiento.`);
    }

    // Reintentar en la raíz de Google Drive si la carpeta no existe o no tiene permiso de escritura
    console.log('[saveTicketSignatureDirectly] Reintentando subida en raíz de Google Drive...');
    const formRoot = new FormData();
    formRoot.append('metadata', new Blob([JSON.stringify({ name: fileName })], { type: 'application/json' }));
    formRoot.append('file', file);

    driveResponse = await fetch(
      '/api/google/upload/v3/files?uploadType=multipart&fields=id,webViewLink,webContentLink',
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formRoot
      }
    );

    if (!driveResponse.ok) {
      const err2 = await driveResponse.text();
      throw new Error(`Error al subir imagen de firma a Google Drive: ${err2}`);
    }
  }

  const driveData = await driveResponse.json();
  const fileId = driveData.id;

  // Permitir lectura a cualquier persona con el link
  if (fileId) {
    try {
      await fetch(`/api/google/drive/v3/files/${fileId}/permissions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ role: 'reader', type: 'anyone' })
      });
    } catch (e) {
      console.warn('[saveTicketSignatureDirectly] Permiso público no aplicado:', e);
    }
  }

  const driveUrl = driveData.webViewLink || (fileId ? `https://drive.google.com/file/d/${fileId}/view` : '');
  if (!driveUrl) {
    throw new Error('Google Drive no devolvió un enlace válido.');
  }

  console.log(`[saveTicketSignatureDirectly] Archivo en Drive: ${driveUrl}`);

  // 2. Identificar el nombre de la hoja TICKET y sus columnas
  const targetSheet = await getActualSheetTitle(token, 'TICKET');
  const safeSheet = targetSheet.replace(/'/g, "''");

  const headerResp = await fetch(
    `/api/google/sheets/v4/spreadsheets/${SPREADSHEET_ID}/values/'${safeSheet}'!A1:AZ1`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  let headers: string[] = [];
  if (headerResp.ok) {
    const hData = await headerResp.json();
    headers = (hData.values && hData.values[0]) || [];
  }

  // Identificar columna FIRMA (índice 18 por defecto = S)
  let firmaColIdx = headers.findIndex(h => {
    const norm = (h || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    return norm === 'FIRMA' || norm === 'FIRMACLIENTE';
  });
  if (firmaColIdx === -1) firmaColIdx = 18; // Columna S
  const firmaColLetter = columnToLetter(firmaColIdx);

  // Identificar columna IDTICKET (índice 0 por defecto = A)
  let idColIdx = headers.findIndex(h => {
    const norm = (h || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    return norm === 'IDTICKET' || norm === 'ID' || norm === 'CODIGO';
  });
  if (idColIdx === -1) idColIdx = 0; // Columna A
  const idColLetter = columnToLetter(idColIdx);

  // 3. Ubicar la fila exacta del ticket
  let targetRow: number | undefined = undefined;

  // Verificar si rowIndex proporcionado coincide
  if (providedRowIndex && providedRowIndex >= 2) {
    try {
      const checkResp = await fetch(
        `/api/google/sheets/v4/spreadsheets/${SPREADSHEET_ID}/values/'${safeSheet}'!${idColLetter}${providedRowIndex}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (checkResp.ok) {
        const cData = await checkResp.json();
        const cellVal = ((cData.values && cData.values[0] && cData.values[0][0]) || '').trim().toUpperCase();
        if (cellVal === cleanTicketId) {
          targetRow = providedRowIndex;
        }
      }
    } catch (e) {
      console.warn('[saveTicketSignatureDirectly] Error verificando fila:', e);
    }
  }

  // Si aún no está confirmada la fila, escanear la columna de ID
  if (!targetRow) {
    const colResp = await fetch(
      `/api/google/sheets/v4/spreadsheets/${SPREADSHEET_ID}/values/'${safeSheet}'!${idColLetter}:${idColLetter}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (colResp.ok) {
      const colData = await colResp.json();
      const rows: string[][] = colData.values || [];
      for (let r = 0; r < rows.length; r++) {
        const val = (rows[r][0] || '').trim().toUpperCase();
        if (val === cleanTicketId) {
          targetRow = r + 1; // Fila 1-indexada en Sheets
          break;
        }
      }
    }
  }

  if (!targetRow) {
    throw new Error(`No se encontró el ticket ${cleanTicketId} en la hoja ${targetSheet}`);
  }

  console.log(`[saveTicketSignatureDirectly] Guardando enlace de firma en celda '${safeSheet}'!${firmaColLetter}${targetRow}...`);

  // 4. Escribir driveUrl en la columna FIRMA
  const updateResp = await fetch(
    `/api/google/sheets/v4/spreadsheets/${SPREADSHEET_ID}/values/'${safeSheet}'!${firmaColLetter}${targetRow}?valueInputOption=USER_ENTERED`,
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

  if (!updateResp.ok) {
    const err = await updateResp.text();
    console.error('[saveTicketSignatureDirectly] Error escribiendo en Sheets:', err);
    throw new Error(`Error al actualizar columna FIRMA en Google Sheets: ${err}`);
  }

  console.log(`[saveTicketSignatureDirectly] ¡URL de firma guardada con éxito en la celda ${firmaColLetter}${targetRow}!`);

  // 5. Opcional: Actualizar FHSC con la fecha y hora de la firma
  const fhscColIdx = headers.findIndex(h => {
    const norm = (h || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    return norm === 'FHSC' || norm === 'FECHAHORASALIDA';
  });
  if (fhscColIdx !== -1) {
    const fhscColLetter = columnToLetter(fhscColIdx);
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const nowStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
    
    try {
      await fetch(
        `/api/google/sheets/v4/spreadsheets/${SPREADSHEET_ID}/values/'${safeSheet}'!${fhscColLetter}${targetRow}?valueInputOption=USER_ENTERED`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            values: [[nowStr]]
          })
        }
      );
    } catch (e) {
      console.warn('[saveTicketSignatureDirectly] No se pudo actualizar FHSC:', e);
    }
  }

  // 6. Si se solicitó targetStatus === 'CERRADO', actualizar el ESTADO a CERRADO y FECHA DE CIERRE
  if (targetStatus && targetStatus.trim().toUpperCase() === 'CERRADO') {
    const estadoColIdx = headers.findIndex(h => {
      const norm = (h || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
      return norm === 'ESTADO';
    });
    if (estadoColIdx !== -1) {
      const estadoColLetter = columnToLetter(estadoColIdx);
      try {
        await fetch(
          `/api/google/sheets/v4/spreadsheets/${SPREADSHEET_ID}/values/'${safeSheet}'!${estadoColLetter}${targetRow}?valueInputOption=USER_ENTERED`,
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
        console.warn('[saveTicketSignatureDirectly] No se pudo actualizar ESTADO a CERRADO:', e);
      }
    }

    const cierreColIdx = headers.findIndex(h => {
      const norm = (h || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
      return norm === 'FECHADECIERRE' || norm === 'FECHACIERRE';
    });
    if (cierreColIdx !== -1) {
      const cierreColLetter = columnToLetter(cierreColIdx);
      const now = new Date();
      const pad = (n: number) => String(n).padStart(2, '0');
      const dateStr = `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()}`;
      try {
        await fetch(
          `/api/google/sheets/v4/spreadsheets/${SPREADSHEET_ID}/values/'${safeSheet}'!${cierreColLetter}${targetRow}?valueInputOption=USER_ENTERED`,
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
        console.warn('[saveTicketSignatureDirectly] No se pudo actualizar FECHA DE CIERRE:', e);
      }
    }
  }

  return { driveUrl, targetRow, firmaColLetter, savedToSheet: true };
}
