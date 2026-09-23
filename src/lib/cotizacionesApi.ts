import { getAccessToken, clearAccessToken } from '../serviceAccess';
import {
  Cotizacion, Cliente, Vendedor, Venta, ItemVenta, CalculoVenta,
  Alquiler, ItemAlquiler, CalculoAlquiler, Out, ItemOut, CalculoOut,
  CotizacionesData
} from '../types';

export const COTIZACIONES_SPREADSHEET_ID = '1CfvIvSb1lpF3qAEfblOSmsXEsqgPC2lqZInyYmMEHog';

export const COTIZACION_COLUMNS = [
  'ID_COT', 'ID', 'FECHA', 'CLIENTE', 'RUC', 'VENDEDOR', 'DETALLE', 'STATUS', 'DOCUMENTO', 'REFERENTE', 'PDF'
];

export const CLIENTE_COLUMNS = ['ID', 'CLIENTE', 'RUC'];

export const VENDEDOR_COLUMNS = ['ID', 'VENDEDOR', 'FIRMA', 'TELEFONO', 'CORREO'];

export const VENTA_COLUMNS = [
  'ID', 'FECHA', 'CLIENTE', 'REFERENCIA', 'SUB TOTAL', 'IGV', 'TOTAL', 'P.EXP', 'F.PAGO', 'V.COT', 'DISPONIBILIDAD'
];

export const ITEM_VENTA_COLUMNS = [
  'ID', 'NCOTI', 'CANTIDAD', 'DESCRIPCION', 'P.UNIT', 'P.TOTAL', 'DETALLE', 'FOTO'
];

export const CALCULO_VENTA_COLUMNS = [
  'ID', 'IDITEM', 'PROVEEDOR', 'DETALLE', 'COSTO', 'PORCENTAJE', 'P.VENTA', 'MARGEN'
];

export const ALQUILER_COLUMNS = [
  'ID', 'FECHA', 'CLIENTE', 'REFERENCIA', 'SUB TOTAL', 'IGV', 'TOTAL', 'P.EXP', 'F.PAGO', 'V.COT', 'DISPONIBILIDAD'
];

export const ITEM_ALQUILER_COLUMNS = [
  'ID', 'NCOTI', 'CANTIDAD', 'DESCRIPCION', 'P.UNIT', 'P.TOTAL', 'DETALLE', 'M/D/S'
];

export const CALCULO_ALQUILER_COLUMNS = [
  'ID', 'IDITEM', 'PROVEEDOR', 'DETALLE', 'COSTO', 'CANTIDAD', 'PORCENTAJE', 'P.VENTA', 'MARGEN', 'M.TOTAL', 'C.TOTAL', 'M.TOTAL'
];

export const OUT_COLUMNS = [
  'ID', 'FECHA', 'CLIENTE', 'REFERENCIA', 'SUB TOTAL', 'IGV', 'TOTAL', 'P.EXP', 'F.PAGO', 'V.COT', 'DISPONIBILIDAD'
];

export const ITEM_OUT_COLUMNS = [
  'ID', 'NCOTI', 'CANTIDAD', 'DESCRIPCION', 'P.UNIT', 'DETALLE'
];

export const CALCULO_OUT_COLUMNS = [
  'ID', 'IDITEM', 'SERVICIO', 'PERSONAL', 'DIAS', 'C.TOTAL', 'PORCENTAJE', 'P.VENTA'
];

const ALL_COTIZACIONES_SHEETS: { name: string; headers: string[] }[] = [
  { name: 'COTIZACION', headers: COTIZACION_COLUMNS },
  { name: 'CLIENTE', headers: CLIENTE_COLUMNS },
  { name: 'VENDEDOR', headers: VENDEDOR_COLUMNS },
  { name: 'VENTA', headers: VENTA_COLUMNS },
  { name: 'ITEM VENTA', headers: ITEM_VENTA_COLUMNS },
  { name: 'CALCULO VENTA', headers: CALCULO_VENTA_COLUMNS },
  { name: 'ALQUILER', headers: ALQUILER_COLUMNS },
  { name: 'ITEM ALQUILER', headers: ITEM_ALQUILER_COLUMNS },
  { name: 'CALCULO ALQUILER', headers: CALCULO_ALQUILER_COLUMNS },
  { name: 'OUT', headers: OUT_COLUMNS },
  { name: 'ITEM OUT', headers: ITEM_OUT_COLUMNS },
  { name: 'CALCULO OUT', headers: CALCULO_OUT_COLUMNS }
];

// Helper to convert sheet rows (array of arrays) to array of objects
function rowsToObjects<T>(rows: string[][] | undefined): T[] {
  if (!rows || rows.length < 2) return [];
  const headers = rows[0].map(h => (h || '').trim());
  return rows.slice(1).map((row, rowIndex) => {
    const obj: any = { _rowIndex: rowIndex + 2 };
    headers.forEach((header, index) => {
      obj[header] = row[index] !== undefined ? String(row[index]).trim() : '';
    });
    return obj as T;
  });
}

export function normalizeId(id: string | null | undefined): string {
  if (!id) return '';
  return String(id)
    .replace(/\u00A0/g, ' ') // replace non-breaking spaces
    .trim();
}

export function parseVassId(id: string): { correlativo: number; year: number; version: number } | null {
  if (!id) return null;
  const match = normalizeId(id).match(/^VASS\s+(\d+)\((\d+)\)(?:v\.(\d+))?$/i);
  if (!match) return null;
  return {
    correlativo: parseInt(match[1], 10),
    year: parseInt(match[2], 10),
    version: match[3] ? parseInt(match[3], 10) : 0
  };
}

export function formatVassId(correlativo: number, year: number, version: number): string {
  const cStr = String(correlativo).padStart(3, '0');
  const yStr = String(year).padStart(2, '0');
  const vStr = String(version).padStart(2, '0');
  return `VASS ${cStr}(${yStr})v.${vStr}`;
}

export function getNextIdCot(cotizaciones: Cotizacion[]): string {
  let max = 0;
  cotizaciones.forEach(c => {
    const id = normalizeId(c.ID_COT);
    const m = id.match(/C-(\d+)/i);
    if (m) {
      const num = parseInt(m[1], 10);
      if (num > max) max = num;
    }
  });
  return `C-${String(max + 1).padStart(4, '0')}`;
}

export function getNextVassCorrelativo(cotizaciones: Cotizacion[], year: number): string {
  let max = 0;
  cotizaciones.forEach(c => {
    const parsed = parseVassId(c.ID);
    if (parsed && parsed.year === year) {
      if (parsed.correlativo > max) max = parsed.correlativo;
    }
  });
  return String(max + 1).padStart(3, '0');
}

export function getNextVersionNumber(cotizaciones: Cotizacion[], correlativo: number, year: number): number {
  let max = 0;
  cotizaciones.forEach(c => {
    const parsed = parseVassId(c.ID);
    if (parsed && parsed.correlativo === correlativo && parsed.year === year) {
      if (parsed.version > max) max = parsed.version;
    }
  });
  return max + 1;
}

export async function ensureCotizacionesSheets(): Promise<void> {
  const token = await getAccessToken();
  if (!token) throw new Error('No access token available');

  const metaResponse = await fetch(
    `/api/google/sheets/v4/spreadsheets/${COTIZACIONES_SPREADSHEET_ID}?fields=sheets.properties`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!metaResponse.ok) {
    const err = await metaResponse.text();
    if (metaResponse.status === 401 || err.includes('UNAUTHENTICATED') || err.includes('401')) {
      console.warn('[cotizacionesApi] Error 401 temporal:', err);
      throw new Error(`Error 401: Sesión de Google expirada o temporalmente inaccesible. (${err})`);
    }
    throw new Error(`Failed to fetch Cotizaciones metadata: ${err}`);
  }
  const metaData = await metaResponse.json();
  const existingTitles = (metaData.sheets || []).map((s: any) => s.properties.title);

  const missing = ALL_COTIZACIONES_SHEETS.filter(s => !existingTitles.includes(s.name));
  if (missing.length > 0) {
    const requests = missing.map(s => ({
      addSheet: { properties: { title: s.name } }
    }));
    const createResp = await fetch(
      `/api/google/sheets/v4/spreadsheets/${COTIZACIONES_SPREADSHEET_ID}:batchUpdate`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ requests })
      }
    );
    if (!createResp.ok) {
      console.warn('Failed to add missing sheets in Cotizaciones', await createResp.text());
    } else {
      // Add headers
      for (const item of missing) {
        await fetch(
          `/api/google/sheets/v4/spreadsheets/${COTIZACIONES_SPREADSHEET_ID}/values/'${item.name}':append?valueInputOption=USER_ENTERED`,
          {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ values: [item.headers] })
          }
        );
      }
    }
  }
}

export async function fetchCotizacionesData(): Promise<CotizacionesData> {
  const token = await getAccessToken();
  if (!token) throw new Error('No hay token de acceso disponible. Por favor inicia sesión con Google.');

  await ensureCotizacionesSheets();

  const sheetNames = ALL_COTIZACIONES_SHEETS.map(s => `'${s.name}'`);
  const params = sheetNames.map(r => `ranges=${encodeURIComponent(r)}`).join('&');

  const response = await fetch(
    `/api/google/sheets/v4/spreadsheets/${COTIZACIONES_SPREADSHEET_ID}/values:batchGet?${params}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  if (!response.ok) {
    const err = await response.text();
    if (response.status === 401 || err.includes('UNAUTHENTICATED') || err.includes('401')) {
      console.warn('[cotizacionesApi] Error 401 en batchGet:', err);
      throw new Error(`Error 401: Sesión de Google expirada o temporalmente inaccesible. (${err})`);
    }
    throw new Error(`Failed to fetch Cotizaciones data: ${err}`);
  }

  const data = await response.json();
  const valueRanges = data.valueRanges || [];

  const getRows = (sheetName: string) => {
    const vr = valueRanges.find((v: any) => {
      const r = v.range || '';
      return r.startsWith(`'${sheetName}'`) || r.startsWith(`${sheetName}!`) || r.startsWith(`'${sheetName}'!`);
    });
    return vr ? vr.values : [];
  };

  return {
    cotizaciones: rowsToObjects<Cotizacion>(getRows('COTIZACION')),
    clientes: rowsToObjects<Cliente>(getRows('CLIENTE')),
    vendedores: rowsToObjects<Vendedor>(getRows('VENDEDOR')),
    ventas: rowsToObjects<Venta>(getRows('VENTA')),
    itemsVenta: rowsToObjects<ItemVenta>(getRows('ITEM VENTA')),
    calculosVenta: rowsToObjects<CalculoVenta>(getRows('CALCULO VENTA')),
    alquileres: rowsToObjects<Alquiler>(getRows('ALQUILER')),
    itemsAlquiler: rowsToObjects<ItemAlquiler>(getRows('ITEM ALQUILER')),
    calculosAlquiler: rowsToObjects<CalculoAlquiler>(getRows('CALCULO ALQUILER')),
    outs: rowsToObjects<Out>(getRows('OUT')),
    itemsOut: rowsToObjects<ItemOut>(getRows('ITEM OUT')),
    calculosOut: rowsToObjects<CalculoOut>(getRows('CALCULO OUT'))
  };
}

// ----------------- COTIZACION OPERATIONS -----------------

export async function createCotizacion(cot: Partial<Cotizacion>): Promise<void> {
  const token = await getAccessToken();
  if (!token) throw new Error('No access token available');

  const row = COTIZACION_COLUMNS.map(col => (cot as any)[col] || '');

  const response = await fetch(
    `/api/google/sheets/v4/spreadsheets/${COTIZACIONES_SPREADSHEET_ID}/values/'COTIZACION':append?valueInputOption=USER_ENTERED`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ values: [row] })
    }
  );
  if (!response.ok) throw new Error(`Failed to create cotizacion: ${await response.text()}`);
}

export async function updateCotizacion(rowIndex: number, cot: Partial<Cotizacion>): Promise<void> {
  const token = await getAccessToken();
  if (!token) throw new Error('No access token available');

  const row = COTIZACION_COLUMNS.map(col => (cot as any)[col] || '');

  const response = await fetch(
    `/api/google/sheets/v4/spreadsheets/${COTIZACIONES_SPREADSHEET_ID}/values/'COTIZACION'!A${rowIndex}:K${rowIndex}?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ values: [row] })
    }
  );
  if (!response.ok) throw new Error(`Failed to update cotizacion: ${await response.text()}`);
}

export async function updateCotizacionStatus(rowIndex: number, status: string): Promise<void> {
  const token = await getAccessToken();
  if (!token) throw new Error('No access token available');

  // Column H is STATUS (index 8, column H)
  const response = await fetch(
    `/api/google/sheets/v4/spreadsheets/${COTIZACIONES_SPREADSHEET_ID}/values/'COTIZACION'!H${rowIndex}?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ values: [[status]] })
    }
  );
  if (!response.ok) throw new Error(`Failed to update status: ${await response.text()}`);
}

// ----------------- SHEET ROW DELETION HELPER -----------------

export async function deleteRowsFromCotizacionesSheet(sheetName: string, rowIndices: number[]): Promise<void> {
  if (rowIndices.length === 0) return;
  const token = await getAccessToken();
  if (!token) throw new Error('No access token available');

  const metaResponse = await fetch(
    `/api/google/sheets/v4/spreadsheets/${COTIZACIONES_SPREADSHEET_ID}?fields=sheets.properties`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!metaResponse.ok) throw new Error('Failed to fetch metadata');
  const metaData = await metaResponse.json();
  const sheet = metaData.sheets.find((s: any) => s.properties.title === sheetName);
  if (!sheet) throw new Error(`Sheet ${sheetName} not found`);
  const sheetId = sheet.properties.sheetId;

  // Sort descending so deletion doesn't shift earlier indices
  const sorted = [...rowIndices].sort((a, b) => b - a);
  const requests = sorted.map(rowIndex => ({
    deleteDimension: {
      range: {
        sheetId: sheetId,
        dimension: 'ROWS',
        startIndex: rowIndex - 1,
        endIndex: rowIndex
      }
    }
  }));

  const response = await fetch(
    `/api/google/sheets/v4/spreadsheets/${COTIZACIONES_SPREADSHEET_ID}:batchUpdate`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ requests })
    }
  );
  if (!response.ok) throw new Error(`Failed to delete rows: ${await response.text()}`);
}

// ----------------- DOCUMENT FULL SAVE (VENTA, ALQUILER, OUT) -----------------

export async function saveDocumentFull(
  cotizacion: Cotizacion,
  docType: 'VENTA' | 'ALQUILER' | 'OUTSOURCING',
  headerData: any,
  items: any[],
  calculos: any[]
): Promise<void> {
  const token = await getAccessToken();
  if (!token) throw new Error('No access token available');

  const idVass = normalizeId(cotizacion.ID);

  // 1. Update COTIZACION document type if needed
  if (cotizacion._rowIndex && cotizacion.DOCUMENTO !== docType) {
    await fetch(
      `/api/google/sheets/v4/spreadsheets/${COTIZACIONES_SPREADSHEET_ID}/values/'COTIZACION'!I${cotizacion._rowIndex}?valueInputOption=USER_ENTERED`,
      {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ values: [[docType]] })
      }
    );
  }

  // Determine target sheets based on document type
  let headerSheet = '';
  let itemSheet = '';
  let calculoSheet = '';
  let headerCols: string[] = [];
  let itemCols: string[] = [];
  let calculoCols: string[] = [];

  if (docType === 'VENTA') {
    headerSheet = 'VENTA';
    itemSheet = 'ITEM VENTA';
    calculoSheet = 'CALCULO VENTA';
    headerCols = VENTA_COLUMNS;
    itemCols = ITEM_VENTA_COLUMNS;
    calculoCols = CALCULO_VENTA_COLUMNS;
  } else if (docType === 'ALQUILER') {
    headerSheet = 'ALQUILER';
    itemSheet = 'ITEM ALQUILER';
    calculoSheet = 'CALCULO ALQUILER';
    headerCols = ALQUILER_COLUMNS;
    itemCols = ITEM_ALQUILER_COLUMNS;
    calculoCols = CALCULO_ALQUILER_COLUMNS;
  } else if (docType === 'OUTSOURCING') {
    headerSheet = 'OUT';
    itemSheet = 'ITEM OUT';
    calculoSheet = 'CALCULO OUT';
    headerCols = OUT_COLUMNS;
    itemCols = ITEM_OUT_COLUMNS;
    calculoCols = CALCULO_OUT_COLUMNS;
  }

  // 2. Fetch current rows for this document type to find and replace existing entries for this ID VASS
  const metaParams = `ranges=${encodeURIComponent(`'${headerSheet}'!A:A`)}&ranges=${encodeURIComponent(`'${itemSheet}'!A:B`)}&ranges=${encodeURIComponent(`'${calculoSheet}'!A:B`)}`;
  const currResp = await fetch(
    `/api/google/sheets/v4/spreadsheets/${COTIZACIONES_SPREADSHEET_ID}/values:batchGet?${metaParams}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!currResp.ok) throw new Error(`Failed to get current sheet state: ${await currResp.text()}`);
  const currData = await currResp.json();
  const headerRows = currData.valueRanges?.[0]?.values || [];
  const itemRows = currData.valueRanges?.[1]?.values || [];
  const calculoRows = currData.valueRanges?.[2]?.values || [];

  // Find existing row index in Header
  let existingHeaderRowIndex = -1;
  headerRows.slice(1).forEach((r: any, idx: number) => {
    if (normalizeId(r[0]) === idVass) {
      existingHeaderRowIndex = idx + 2;
    }
  });

  // Find existing item row indices for this ID VASS (column B is NCOTI)
  const itemIndicesToDelete: number[] = [];
  const itemIdsForThisVass: string[] = [];
  itemRows.slice(1).forEach((r: any, idx: number) => {
    const itemId = normalizeId(r[0]);
    const ncoti = normalizeId(r[1]);
    if (ncoti === idVass || itemId.startsWith(idVass)) {
      itemIndicesToDelete.push(idx + 2);
      if (itemId) itemIdsForThisVass.push(itemId);
    }
  });

  // Find existing calculation row indices for this ID VASS (column B is IDITEM)
  const calcIndicesToDelete: number[] = [];
  calculoRows.slice(1).forEach((r: any, idx: number) => {
    const idItem = normalizeId(r[1]);
    const calcId = normalizeId(r[0]);
    if (itemIdsForThisVass.includes(idItem) || calcId.startsWith(idVass)) {
      calcIndicesToDelete.push(idx + 2);
    }
  });

  // Delete previous calculations and items for this version in reverse order
  if (calcIndicesToDelete.length > 0) {
    await deleteRowsFromCotizacionesSheet(calculoSheet, calcIndicesToDelete);
  }
  if (itemIndicesToDelete.length > 0) {
    await deleteRowsFromCotizacionesSheet(itemSheet, itemIndicesToDelete);
  }

  // 3. Save or Update Header
  const headerRow = headerCols.map(col => headerData[col] !== undefined ? String(headerData[col]) : '');
  headerRow[0] = idVass; // ID is ID VASS
  headerRow[1] = headerData['FECHA'] || cotizacion.FECHA || '';
  headerRow[2] = headerData['CLIENTE'] || cotizacion.CLIENTE || '';

  if (existingHeaderRowIndex > 0) {
    const colLetter = String.fromCharCode(65 + headerCols.length - 1);
    await fetch(
      `/api/google/sheets/v4/spreadsheets/${COTIZACIONES_SPREADSHEET_ID}/values/'${headerSheet}'!A${existingHeaderRowIndex}:${colLetter}${existingHeaderRowIndex}?valueInputOption=USER_ENTERED`,
      {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ values: [headerRow] })
      }
    );
  } else {
    await fetch(
      `/api/google/sheets/v4/spreadsheets/${COTIZACIONES_SPREADSHEET_ID}/values/'${headerSheet}':append?valueInputOption=USER_ENTERED`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ values: [headerRow] })
      }
    );
  }

  // 4. Append Items
  if (items.length > 0) {
    const itemRowsToAppend = items.map((item, idx) => {
      const row = itemCols.map(col => item[col] !== undefined ? String(item[col]) : '');
      row[0] = item.ID || `${idVass}-${idx + 1}`;
      row[1] = idVass; // NCOTI
      return row;
    });
    await fetch(
      `/api/google/sheets/v4/spreadsheets/${COTIZACIONES_SPREADSHEET_ID}/values/'${itemSheet}':append?valueInputOption=USER_ENTERED`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ values: itemRowsToAppend })
      }
    );
  }

  // 5. Append Calculations
  if (calculos.length > 0) {
    const calcRowsToAppend = calculos.map((calc, idx) => {
      const row = calculoCols.map(col => calc[col] !== undefined ? String(calc[col]) : '');
      row[0] = calc.ID || `${calc.IDITEM || idVass}-C${idx + 1}`;
      return row;
    });
    await fetch(
      `/api/google/sheets/v4/spreadsheets/${COTIZACIONES_SPREADSHEET_ID}/values/'${calculoSheet}':append?valueInputOption=USER_ENTERED`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ values: calcRowsToAppend })
      }
    );
  }
}

// ----------------- CASCADE DELETE COTIZACION -----------------

export async function deleteCotizacionCascade(cotizacion: Cotizacion): Promise<void> {
  const token = await getAccessToken();
  if (!token) throw new Error('No access token available');

  const idVass = normalizeId(cotizacion.ID);
  const idCot = normalizeId(cotizacion.ID_COT);

  // Check all 3 document types to delete any items and calculations associated with this ID VASS
  const docTypes = [
    { header: 'VENTA', item: 'ITEM VENTA', calc: 'CALCULO VENTA' },
    { header: 'ALQUILER', item: 'ITEM ALQUILER', calc: 'CALCULO ALQUILER' },
    { header: 'OUT', item: 'ITEM OUT', calc: 'CALCULO OUT' }
  ];

  for (const doc of docTypes) {
    const metaParams = `ranges=${encodeURIComponent(`'${doc.header}'!A:A`)}&ranges=${encodeURIComponent(`'${doc.item}'!A:B`)}&ranges=${encodeURIComponent(`'${doc.calc}'!A:B`)}`;
    const resp = await fetch(
      `/api/google/sheets/v4/spreadsheets/${COTIZACIONES_SPREADSHEET_ID}/values:batchGet?${metaParams}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (resp.ok) {
      const resData = await resp.json();
      const hRows = resData.valueRanges?.[0]?.values || [];
      const iRows = resData.valueRanges?.[1]?.values || [];
      const cRows = resData.valueRanges?.[2]?.values || [];

      // 1. Delete Calculations
      const calcIndices: number[] = [];
      cRows.slice(1).forEach((r: any, idx: number) => {
        const cId = normalizeId(r[0]);
        const idItem = normalizeId(r[1]);
        if (cId.startsWith(idVass) || idItem.startsWith(idVass)) {
          calcIndices.push(idx + 2);
        }
      });
      if (calcIndices.length > 0) {
        await deleteRowsFromCotizacionesSheet(doc.calc, calcIndices);
      }

      // 2. Delete Items
      const itemIndices: number[] = [];
      iRows.slice(1).forEach((r: any, idx: number) => {
        const itemId = normalizeId(r[0]);
        const ncoti = normalizeId(r[1]);
        if (ncoti === idVass || itemId.startsWith(idVass)) {
          itemIndices.push(idx + 2);
        }
      });
      if (itemIndices.length > 0) {
        await deleteRowsFromCotizacionesSheet(doc.item, itemIndices);
      }

      // 3. Delete Document Header
      const headerIndices: number[] = [];
      hRows.slice(1).forEach((r: any, idx: number) => {
        if (normalizeId(r[0]) === idVass) {
          headerIndices.push(idx + 2);
        }
      });
      if (headerIndices.length > 0) {
        await deleteRowsFromCotizacionesSheet(doc.header, headerIndices);
      }
    }
  }

  // 4. Delete COTIZACION master record
  if (cotizacion._rowIndex) {
    await deleteRowsFromCotizacionesSheet('COTIZACION', [cotizacion._rowIndex]);
  } else {
    // Lookup by ID_COT
    const cotResp = await fetch(
      `/api/google/sheets/v4/spreadsheets/${COTIZACIONES_SPREADSHEET_ID}/values/'COTIZACION'!A:A`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (cotResp.ok) {
      const cData = await cotResp.json();
      const cRows = cData.values || [];
      const idx = cRows.findIndex((r: any) => normalizeId(r[0]) === idCot);
      if (idx > 0) {
        await deleteRowsFromCotizacionesSheet('COTIZACION', [idx + 1]);
      }
    }
  }
}

// ----------------- CLIENTE & VENDEDOR CRUD -----------------

export async function createCliente(cliente: Partial<Cliente>): Promise<void> {
  const token = await getAccessToken();
  if (!token) throw new Error('No access token available');

  const row = CLIENTE_COLUMNS.map(col => (cliente as any)[col] || '');

  const response = await fetch(
    `/api/google/sheets/v4/spreadsheets/${COTIZACIONES_SPREADSHEET_ID}/values/'CLIENTE':append?valueInputOption=USER_ENTERED`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ values: [row] })
    }
  );
  if (!response.ok) throw new Error(`Failed to create cliente: ${await response.text()}`);
}

export async function updateCliente(rowIndex: number, cliente: Partial<Cliente>): Promise<void> {
  const token = await getAccessToken();
  if (!token) throw new Error('No access token available');

  const row = CLIENTE_COLUMNS.map(col => (cliente as any)[col] || '');

  const response = await fetch(
    `/api/google/sheets/v4/spreadsheets/${COTIZACIONES_SPREADSHEET_ID}/values/'CLIENTE'!A${rowIndex}:C${rowIndex}?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ values: [row] })
    }
  );
  if (!response.ok) throw new Error(`Failed to update cliente: ${await response.text()}`);
}

export async function deleteCliente(rowIndex: number): Promise<void> {
  await deleteRowsFromCotizacionesSheet('CLIENTE', [rowIndex]);
}

export async function createVendedor(vendedor: Partial<Vendedor>): Promise<void> {
  const token = await getAccessToken();
  if (!token) throw new Error('No access token available');

  const row = VENDEDOR_COLUMNS.map(col => (vendedor as any)[col] || '');

  const response = await fetch(
    `/api/google/sheets/v4/spreadsheets/${COTIZACIONES_SPREADSHEET_ID}/values/'VENDEDOR':append?valueInputOption=USER_ENTERED`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ values: [row] })
    }
  );
  if (!response.ok) throw new Error(`Failed to create vendedor: ${await response.text()}`);
}

export async function updateVendedor(rowIndex: number, vendedor: Partial<Vendedor>): Promise<void> {
  const token = await getAccessToken();
  if (!token) throw new Error('No access token available');

  const row = VENDEDOR_COLUMNS.map(col => (vendedor as any)[col] || '');

  const response = await fetch(
    `/api/google/sheets/v4/spreadsheets/${COTIZACIONES_SPREADSHEET_ID}/values/'VENDEDOR'!A${rowIndex}:E${rowIndex}?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ values: [row] })
    }
  );
  if (!response.ok) throw new Error(`Failed to update vendedor: ${await response.text()}`);
}

export async function deleteVendedor(rowIndex: number): Promise<void> {
  await deleteRowsFromCotizacionesSheet('VENDEDOR', [rowIndex]);
}
