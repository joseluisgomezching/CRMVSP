export interface Ticket {
  IDTICKET: string;
  FHINGRESO: string;
  CLIENTE: string;
  DIRECCION: string;
  TELEFONO: string;
  CONTACTO: string;
  FHPROGRAMADA: string;
  ESTADO: string;
  PRIORIDAD: string;
  TIPO: string;
  PROBLEMA: string;
  TECNICO: string;
  NOTIFICA: string;
  'MODO DE ATENCION': string;
  NOTITEC: string;
  NOTICLI: string;
  PREFIJO: string;
  SUMAXH: string;
  FIRMA: string;
  PDF: string;
  FIRMATECH: string;
  'COMENTARIO DE FOTO': string;
  DATEINICIO: string;
  'DONDE CERRE': string;
  'TOTAL DE HORAS': string;
  ESTADO_SOLICITUD: string;
  'GPS ENTRADA': string;
  'GPS SALIDA': string;
  'ACTIVIDAD DEL TICKET': string;
  OBSERVACIONES: string;
  FHLLC: string;
  FHSC: string;
  'FECHA DE CIERRE': string;
  _rowIndex?: number; // Used for updating
  _duplicateRows?: number[]; // Track any duplicate row numbers found in Google Sheets
}

export interface Empresa {
  ID: string;
  CLIENTE: string;
  DIRECCION: string;
  RUC: string;
}

export interface Contacto {
  ID: string;
  NOMBRE: string;
  CELULAR: string;
  EMPRESA: string;
  CORREO: string;
  CARGO: string;
  Pais: string;
  PREFIJO: string;
}

export interface Tecnico {
  ID: string;
  NOMBRE: string;
  DNI: string;
  CELULAR: string;
  FIRMATECH: string;
  FOTO: string;
  'FECHA DE NACIMIENTO': string;
}

export interface Contrato {
  ID?: string;
  id?: string;
  empresa?: string;
  EMPRESA?: string;
  cliente?: string;
  CLIENTE?: string;
  'HORAS DE CONTRATADAS'?: string;
  horas_contratadas?: string;
  HORAS_CONTRATADAS?: string;
  'HORAS CONTRATADAS'?: string;
  [key: string]: any;
}

export interface FotosTicket {
  ID: string;
  IDTICKET: string;
  FOTO: string;
}

export interface Actividad {
  IDACTIVIDADES: string;
  IDTICKET: string;
  FHINICIO: string;
  SOLUCION: string;
  FHFIN: string;
  TIPO: string;
  MARCA: string;
  MODELO: string;
  SERIE: string;
  USUARIO: string;
  AREA: string;
  CLIENTE: string;
  TE: string;
  TECNICO: string;
  CELULAR?: string;
  _rowIndex?: number;
}

export interface FotoAct {
  ID: string;
  IDACTIVIDADES: string;
  FOTO: string;
}

export interface Repuesto {
  IDREPUESTO: string;
  IDTICKET: string;
  CANTIDAD: string;
  DESCRIPCION: string;
}

export interface Internamiento {
  ID: string;
  IDTICKET: string;
  CLIENTE: string;
  DIRECCION: string;
  CONTACTO: string;
  TELEFONO: string;
  FHPROGRAMADA: string;
  ESTADO: string;
  PRIORIDAD: string;
  TIPO: string;
  PROBLEMA: string;
  'DESCRIPCION DEL EQUIPO': string;
  ACCESORIOS: string;
  OBSERVACIONES: string;
  'FIRMA DEL CLIENTE': string;
  'NOMBRE RECEPCIONISTA': string;
  'FIRMA DE RECEPCION': string;
}

export interface Caja {
  ID: string;
  CAJA: string;
  ABONO: string;
  FECHA: string;
}

export interface Acceso {
  ID: string;
  CORREO: string;
  MODULOS_PERMITIDOS: string;
  _rowIndex?: number;
}

export interface AppData {
  tickets: Ticket[];
  empresas: Empresa[];
  contactos: Contacto[];
  tecnicos: Tecnico[];
  contratos: Contrato[];
  fotosTicket: FotosTicket[];
  actividades: Actividad[];
  fotosAct: FotoAct[];
  repuestos: Repuesto[];
  internamientos: Internamiento[];
  rutas: Ruta[];
  transporte: Transporte[];
  caja: Caja[];
  actividadesDiarias: ActividadDiaria[];
  tranacti: Tranacti[];
  accesos: Acceso[];
}

export interface Ruta {
  ID: string;
  ORIGEN: string;
  DESTINO: string;
  MONTO: string;
  TECNICO: string;
  'TICKET/ACTIVIDAD': string;
  MOTIVO: string;
  ESTADO: string;
  FECHA: string;
}

export interface Transporte {
  ID: string;
  IDRUTA: string;
  MOVIL: string;
  PASAJE: string;
}

export interface Tranacti {
  ID: string;
  IDRUTA: string;
  MOVIL: string;
  PASAJE: string;
  _rowIndex?: number;
}

// Update AppData to include them

export interface ActividadDiaria {
  ID: string;
  FECHA: string;
  'CREADO POR': string;
  'ASIGNADO A': string;
  'MOTIVO DE LA ACTIVIDAD': string;
  IDA: string;
  VUELTA: string;
  'GASTO DE PASAJE': string;
  'GASTO ADICIONAL': string;
  'MONTO TOTAL': string;
  ESTADO: string;
  'ESTADO GASTO': string;
  _rowIndex?: number;
  // Optional legacy fields for backward compatibility
  'FECHA DE INICIO'?: string;
  'HORA DE INICIO'?: string;
  ACTIVIDAD?: string;
  'FECHA FIN'?: string;
  'HORA FIN'?: string;
  ASIGNADO?: string;
  'TIPO DE MOVILIDAD'?: string;
  'PROGRAMADO POR'?: string;
}

// COTIZACIONES MODULE TYPES
export interface Cotizacion {
  ID_COT: string;
  ID: string; // ID VASS, e.g. VASS 001(26)v.00
  FECHA: string;
  CLIENTE: string;
  RUC: string;
  VENDEDOR: string;
  DETALLE: string;
  STATUS: 'INGRESADO' | 'PENDIENTE' | 'SALIO' | 'NO SALIO' | string;
  DOCUMENTO: 'NO SE CREO DOCUMENTO' | 'VENTA' | 'ALQUILER' | 'OUTSOURCING' | string;
  REFERENTE: string;
  PDF: string;
  _rowIndex?: number;
}

export interface Cliente {
  ID: string; // CL-0001
  CLIENTE: string;
  RUC: string;
  _rowIndex?: number;
}

export interface Vendedor {
  ID: string; // V-001
  VENDEDOR: string;
  FIRMA: string;
  TELEFONO: string;
  CORREO: string;
  _rowIndex?: number;
}

export interface Venta {
  ID: string; // VASS ID, e.g. VASS 001(26)v.00
  FECHA: string;
  CLIENTE: string;
  REFERENCIA: string;
  'SUB TOTAL': string;
  IGV: string;
  TOTAL: string;
  'P.EXP': string;
  'F.PAGO': string;
  'V.COT': string;
  DISPONIBILIDAD: string;
  _rowIndex?: number;
}

export interface ItemVenta {
  ID: string; // VASS 001(26)v.00-1
  NCOTI: string; // VASS 001(26)v.00
  CANTIDAD: string;
  DESCRIPCION: string;
  'P.UNIT': string;
  'P.TOTAL': string;
  DETALLE: string;
  FOTO: string;
  _rowIndex?: number;
}

export interface CalculoVenta {
  ID: string; // VASS 001(26)v.00-1-C1
  IDITEM: string; // VASS 001(26)v.00-1
  PROVEEDOR: string;
  DETALLE: string;
  COSTO: string;
  PORCENTAJE: string;
  'P.VENTA': string;
  MARGEN: string;
  _rowIndex?: number;
}

export interface Alquiler {
  ID: string; // VASS 001(26)v.00
  FECHA: string;
  CLIENTE: string;
  REFERENCIA: string;
  'SUB TOTAL': string;
  IGV: string;
  TOTAL: string;
  'P.EXP': string;
  'F.PAGO': string;
  'V.COT': string;
  DISPONIBILIDAD: string;
  _rowIndex?: number;
}

export interface ItemAlquiler {
  ID: string; // VASS 001(26)v.00-1
  NCOTI: string; // VASS 001(26)v.00
  CANTIDAD: string;
  DESCRIPCION: string;
  'P.UNIT': string;
  'P.TOTAL': string;
  DETALLE: string;
  'M/D/S': string;
  _rowIndex?: number;
}

export interface CalculoAlquiler {
  ID: string;
  IDITEM: string;
  PROVEEDOR: string;
  DETALLE: string;
  COSTO: string;
  CANTIDAD: string;
  PORCENTAJE: string;
  'P.VENTA': string;
  MARGEN: string;
  'M.TOTAL': string;
  'C.TOTAL': string;
  _rowIndex?: number;
}

export interface Out {
  ID: string; // VASS 001(26)v.00
  FECHA: string;
  CLIENTE: string;
  REFERENCIA: string;
  'SUB TOTAL': string;
  IGV: string;
  TOTAL: string;
  'P.EXP': string;
  'F.PAGO': string;
  'V.COT': string;
  DISPONIBILIDAD: string;
  _rowIndex?: number;
}

export interface ItemOut {
  ID: string; // VASS 001(26)v.00-1
  NCOTI: string; // VASS 001(26)v.00
  CANTIDAD: string;
  DESCRIPCION: string;
  'P.UNIT': string;
  DETALLE: string;
  _rowIndex?: number;
}

export interface CalculoOut {
  ID: string;
  IDITEM: string;
  SERVICIO: string;
  PERSONAL: string;
  DIAS: string;
  'C.TOTAL': string;
  PORCENTAJE: string;
  'P.VENTA': string;
  _rowIndex?: number;
}

export interface CotizacionesData {
  cotizaciones: Cotizacion[];
  clientes: Cliente[];
  vendedores: Vendedor[];
  ventas: Venta[];
  itemsVenta: ItemVenta[];
  calculosVenta: CalculoVenta[];
  alquileres: Alquiler[];
  itemsAlquiler: ItemAlquiler[];
  calculosAlquiler: CalculoAlquiler[];
  outs: Out[];
  itemsOut: ItemOut[];
  calculosOut: CalculoOut[];
}

