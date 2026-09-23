import React, { useState, useMemo, useRef } from 'react';
import { AppData, Empresa, Contacto, Contrato, Ticket } from '../../types';
import { createTicket, uploadImage, createFotoTicket } from '../../lib/googleApi';
import { 
  Camera, X, Upload, Users, ChevronDown, Clock, ShieldCheck, 
  AlertCircle, CheckCircle2, FileText, Ticket as TicketIcon
} from 'lucide-react';
import GuiaInternamientoModal from './GuiaInternamientoModal';
import TicketNotificacionesModal from './TicketNotificacionesModal';

interface Props {
  data: AppData;
  onTicketCreated: () => void;
  onCancel: () => void;
}

const FOTOS_FOLDER_ID = '1Y0D-ZJ6ufLK6zuVxvp5vZjx7yq6hj_LV';

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Setiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

function parseFechaCierreMonthYear(dateStr: string | undefined | null): { day: number; month: number; year: number } | null {
  if (!dateStr) return null;
  const clean = String(dateStr).trim().split(' ')[0]; // remove time component if any
  if (clean.includes('/')) {
    const parts = clean.split('/');
    if (parts.length >= 3) {
      const d = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10);
      let y = parseInt(parts[2], 10);
      if (!isNaN(m) && !isNaN(y)) {
        if (y < 100) y += 2000;
        return { day: isNaN(d) ? 1 : d, month: m, year: y };
      }
    }
  } else if (clean.includes('-')) {
    const parts = clean.split('-');
    if (parts.length >= 3) {
      if (parts[0].length === 4) {
        // YYYY-MM-DD
        const y = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10);
        const d = parseInt(parts[2], 10);
        if (!isNaN(m) && !isNaN(y)) {
          return { day: isNaN(d) ? 1 : d, month: m, year: y };
        }
      } else {
        // DD-MM-YYYY
        const d = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10);
        let y = parseInt(parts[2], 10);
        if (!isNaN(m) && !isNaN(y)) {
          if (y < 100) y += 2000;
          return { day: isNaN(d) ? 1 : d, month: m, year: y };
        }
      }
    }
  }
  return null;
}

function parseHoursToMinutes(val: string | undefined | null): number {
  if (!val) return 0;
  const str = String(val).trim();
  if (!str) return 0;
  
  if (str.includes(':')) {
    const parts = str.split(':');
    const hours = parseInt(parts[0], 10) || 0;
    const mins = parseInt(parts[1], 10) || 0;
    return hours * 60 + mins;
  }
  
  const num = parseFloat(str);
  if (!isNaN(num)) {
    return Math.round(num * 60);
  }
  
  return 0;
}

function formatMinutesToHHMM(minutes: number): string {
  const isNegative = minutes < 0;
  const absMins = Math.abs(minutes);
  const h = Math.floor(absMins / 60);
  const m = absMins % 60;
  const formatted = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  return isNegative ? `-${formatted}` : formatted;
}

export default function TicketForm({ data, onTicketCreated, onCancel }: Props) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Suggested ID
  const nextId = useMemo(() => {
    let max = 0;
    data.tickets.forEach(t => {
      const match = t.IDTICKET.match(/^VSP-(\d+)$/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > max) max = num;
      }
    });
    const nextNum = max + 1;
    return `VSP-${nextNum.toString().padStart(4, '0')}`;
  }, [data.tickets]);

  const [form, setForm] = useState({
    CLIENTE: '',
    DIRECCION: '',
    CONTACTO: '',
    TELEFONO: '',
    PREFIJO: '',
    FHPROGRAMADA: '',
    PRIORIDAD: 'MEDIA',
    TIPO: 'CONTRATO',
    TECNICO: '',
    'MODO DE ATENCION': '',
    'ACTIVIDAD DEL TICKET': '',
    PROBLEMA: '',
    OBSERVACIONES: '',
    'COMENTARIO DE FOTO': ''
  });

  const [selectedEmpresa, setSelectedEmpresa] = useState<Empresa | null>(null);
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const [showActividadDropdown, setShowActividadDropdown] = useState(false);
  
  // Filtering for contract consumption (by FECHA DE CIERRE and month)
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1); // 1-12
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [monthFilterMode, setMonthFilterMode] = useState<'MONTH' | 'ALL'>('MONTH');
  const [showInternamientoModal, setShowInternamientoModal] = useState(false);

  // Notification modal after saving
  const [showNotificacionesModal, setShowNotificacionesModal] = useState(false);
  const [savedTicketId, setSavedTicketId] = useState('');
  const [savedForm, setSavedForm] = useState(form);
  const [savedFhIngreso, setSavedFhIngreso] = useState('');

  const isLaboratorio = form['MODO DE ATENCION'] === 'LABORATORIO';

  // Available years from data
  const availableYears = useMemo(() => {
    const set = new Set<number>();
    const currentYear = new Date().getFullYear();
    set.add(currentYear);
    set.add(currentYear - 1);
    data.tickets.forEach(t => {
      const parsed = parseFechaCierreMonthYear(t['FECHA DE CIERRE'] || t.FHINGRESO);
      if (parsed?.year) set.add(parsed.year);
    });
    return Array.from(set).sort((a, b) => b - a);
  }, [data.tickets]);

  // Photos handling (up to 4)
  const [photos, setPhotos] = useState<(File | null)[]>([null, null, null, null]);
  const [photoPreviews, setPhotoPreviews] = useState<(string | null)[]>([null, null, null, null]);
  const fileInputs = useRef<(HTMLInputElement | null)[]>([]);
  const formColRef = useRef<HTMLDivElement>(null);
  const infoColRef = useRef<HTMLDivElement>(null);

  const scrollToCol = (colRef: React.RefObject<HTMLDivElement>) => {
    colRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  };

  // Combined client options from Empresas and Contratos for autocomplete
  const clientOptions = useMemo(() => {
    const map = new Map<string, { cliente: string; direccion: string; ruc: string; hasContract: boolean; contractHours: string }>();
    
    // Add from empresas
    data.empresas.forEach(e => {
      if (!e.CLIENTE) return;
      map.set(e.CLIENTE.trim().toLowerCase(), {
        cliente: e.CLIENTE.trim(),
        direccion: e.DIRECCION || '',
        ruc: e.RUC || '',
        hasContract: false,
        contractHours: ''
      });
    });

    // Add / enrich from contratos
    data.contratos.forEach(c => {
      const emp = (c.empresa || (c as any).EMPRESA || (c as any).cliente || (c as any).CLIENTE || '').trim();
      if (!emp) return;
      const key = emp.toLowerCase();
      const hours = String(c.horas_contratadas || (c as any).HORAS_CONTRATADAS || c['HORAS DE CONTRATADAS'] || (c as any)['HORAS CONTRATADAS'] || (c as any).HORAS || '').trim();
      
      const existing = map.get(key);
      if (existing) {
        existing.hasContract = true;
        existing.contractHours = hours;
      } else {
        map.set(key, {
          cliente: emp,
          direccion: '',
          ruc: '',
          hasContract: true,
          contractHours: hours
        });
      }
    });

    return Array.from(map.values());
  }, [data.empresas, data.contratos]);

  // Derived contacts
  const contacts = useMemo(() => {
    const clientName = (form.CLIENTE || selectedEmpresa?.CLIENTE || '').trim().toLowerCase();
    if (!clientName) return [];
    return data.contactos.filter(c => c.EMPRESA && c.EMPRESA.trim().toLowerCase() === clientName);
  }, [form.CLIENTE, selectedEmpresa, data.contactos]);

  // Contrato detection for the current client
  const contrato = useMemo(() => {
    const clientName = (form.CLIENTE || selectedEmpresa?.CLIENTE || '').trim();
    if (!clientName) return null;

    const cleanStr = (s: string) =>
      s.toLowerCase()
        .replace(/[.,\s-]/g, '')
        .replace(/sac|srl|eirl|sa|s\.a\.c\.|s\.r\.l\./g, '')
        .trim();

    const clientClean = cleanStr(clientName);

    return (
      data.contratos.find(c => {
        const emp = (c.empresa || (c as any).EMPRESA || (c as any).cliente || (c as any).CLIENTE || '').trim();
        if (!emp) return false;
        if (emp.toLowerCase() === clientName.toLowerCase()) return true;
        return cleanStr(emp) === clientClean;
      }) || null
    );
  }, [form.CLIENTE, selectedEmpresa, data.contratos]);

  // Contract hours string
  const horasContratadasString = useMemo(() => {
    if (!contrato) return '';
    return String(
      contrato.horas_contratadas ||
      (contrato as any).HORAS_CONTRATADAS ||
      contrato['HORAS DE CONTRATADAS'] ||
      (contrato as any)['HORAS CONTRATADAS'] ||
      (contrato as any).HORAS ||
      (contrato as any).horas ||
      '0'
    ).trim();
  }, [contrato]);

  // All closed tickets belonging to this client (filtered by ESTADO=CERRADO and FECHA DE CIERRE)
  const clientClosedTickets = useMemo(() => {
    const clientName = (form.CLIENTE || selectedEmpresa?.CLIENTE || '').trim().toLowerCase();
    if (!clientName) return [];

    const cleanStr = (s: string) =>
      s.toLowerCase()
        .replace(/[.,\s-]/g, '')
        .replace(/sac|srl|eirl|sa|s\.a\.c\.|s\.r\.l\./g, '')
        .trim();

    const clientClean = cleanStr(clientName);

    return data.tickets.filter(t => {
      if (!t.CLIENTE) return false;
      
      // Match client
      const tClient = t.CLIENTE.trim().toLowerCase();
      const matchesClient = tClient === clientName || cleanStr(tClient) === clientClean;
      if (!matchesClient) return false;

      // Must be ESTADO === 'CERRADO'
      const isCerrado = (t.ESTADO || '').trim().toUpperCase() === 'CERRADO';
      if (!isCerrado) return false;

      // Filter by FECHA DE CIERRE when month filter is active
      if (monthFilterMode === 'MONTH') {
        const parsed = parseFechaCierreMonthYear(t['FECHA DE CIERRE']);
        if (!parsed) return false;
        return parsed.month === selectedMonth && parsed.year === selectedYear;
      }

      return true;
    });
  }, [form.CLIENTE, selectedEmpresa, data.tickets, monthFilterMode, selectedMonth, selectedYear]);

  // Minutes consumed specifically by tickets of TIPO = CONTRATO (closed, within selected period)
  const contractMinutesConsumed = useMemo(() => {
    return clientClosedTickets
      .filter(t => (t.TIPO || '').trim().toUpperCase() === 'CONTRATO')
      .reduce((acc, t) => acc + parseHoursToMinutes(t.SUMAXH), 0);
  }, [clientClosedTickets]);

  const contractMinutes = useMemo(() => {
    return parseHoursToMinutes(horasContratadasString);
  }, [horasContratadasString]);

  const remainingMinutes = contractMinutes - contractMinutesConsumed;
  const consumptionPercentage = contractMinutes > 0 ? Math.min(100, Math.round((contractMinutesConsumed / contractMinutes) * 100)) : 0;

  // Handlers
  const handleClientChange = (clienteName: string) => {
    const emp = data.empresas.find(e => e.CLIENTE.toLowerCase() === clienteName.toLowerCase());
    setSelectedEmpresa(emp || null);
    setForm(prev => ({
      ...prev,
      CLIENTE: clienteName,
      DIRECCION: emp ? emp.DIRECCION : prev.DIRECCION,
      CONTACTO: '',
      TELEFONO: '',
      PREFIJO: ''
    }));
  };

  const selectContact = (contact: Contacto) => {
    setForm(prev => ({
      ...prev,
      CONTACTO: contact.NOMBRE,
      TELEFONO: contact.CELULAR,
      PREFIJO: contact.PREFIJO
    }));
  };

  const handlePhotoSelect = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        alert('Solo se permiten archivos de imagen.');
        return;
      }
      const newPhotos = [...photos];
      const newPreviews = [...photoPreviews];
      newPhotos[index] = file;
      newPreviews[index] = URL.createObjectURL(file);
      setPhotos(newPhotos);
      setPhotoPreviews(newPreviews);
    }
  };

  const removePhoto = (index: number) => {
    const newPhotos = [...photos];
    const newPreviews = [...photoPreviews];
    newPhotos[index] = null;
    newPreviews[index] = null;
    setPhotos(newPhotos);
    setPhotoPreviews(newPreviews);
    if (fileInputs.current[index]) {
      fileInputs.current[index]!.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);

    try {
      const now = new Date();
      const fhIngreso = `${now.getDate().toString().padStart(2, '0')}/${(now.getMonth()+1).toString().padStart(2, '0')}/${now.getFullYear()} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
      
      const tecnico = data.tecnicos.find(t => t.NOMBRE === form.TECNICO);
      
      const ticketPayload: Partial<Ticket> = {
        IDTICKET: nextId,
        FHINGRESO: fhIngreso,
        ESTADO: 'ASIGNADO',
        NOTIFICA: 'PENDIENTE',
        NOTITEC: 'FALSE',
        NOTICLI: 'NO NOTIFICADO',
        FIRMATECH: tecnico ? tecnico.FIRMATECH : '',
        ...form
      };

      // 1. Guardar Ticket
      await createTicket(ticketPayload);

      // 2. Subir Fotos y registrar en FOTOSTICKET
      for (let i = 0; i < photos.length; i++) {
        const file = photos[i];
        if (file) {
          const fileName = `${nextId}-TICKET-${(i+1).toString().padStart(2, '0')}.jpg`;
          const photoUrl = await uploadImage(file, FOTOS_FOLDER_ID, fileName);
          const ftId = `FT-${Date.now().toString().slice(-4)}${i}`;
          await createFotoTicket(ftId, nextId, photoUrl);
        }
      }

      setSaving(false);
      setSavedTicketId(nextId);
      setSavedForm({ ...form });
      setSavedFhIngreso(fhIngreso);
      setShowNotificacionesModal(true);
    } catch (err: any) {
      setError(err.message || 'Error al guardar el ticket');
      setSaving(false);
    }
  };

  const getTipoBadgeColor = (tipo: string) => {
    switch (tipo) {
      case 'CONTRATO':
        return 'bg-blue-500/10 border-blue-500/30 text-blue-400';
      case 'FACTURABLE':
        return 'bg-amber-500/10 border-amber-500/30 text-amber-400';
      case 'GARANTIA DE SERVICIO':
        return 'bg-purple-500/10 border-purple-500/30 text-purple-400';
      case 'DIAGNOSTICO':
        return 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400';
      default:
        return 'bg-slate-700/50 border-slate-600 text-slate-300';
    }
  };

  const getEstadoBadgeColor = (estado: string) => {
    switch (estado) {
      case 'CERRADO':
        return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
      case 'ASIGNADO':
        return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
      case 'EN PROCESO':
        return 'bg-blue-500/15 text-blue-400 border-blue-500/30';
      default:
        return 'bg-slate-700/50 text-slate-400 border-slate-600';
    }
  };

  return (
    <div className="flex-1 w-full flex flex-col gap-3 overflow-hidden">
      {/* Barra de navegación rápida para Móviles */}
      <div className="flex xl:hidden items-center justify-between gap-1.5 bg-slate-900/90 p-1.5 rounded-xl border border-slate-800 shrink-0">
        <button
          type="button"
          onClick={() => scrollToCol(formColRef)}
          className="flex-1 py-1.5 px-3 rounded-lg text-xs font-bold text-slate-300 hover:text-white bg-slate-800/80 active:bg-blue-600 transition-colors text-center flex items-center justify-center gap-1.5"
        >
          <FileText className="w-3.5 h-3.5 text-blue-400" />
          <span>Formulario</span>
        </button>
        <button
          type="button"
          onClick={() => scrollToCol(infoColRef)}
          className="flex-1 py-1.5 px-3 rounded-lg text-xs font-bold text-slate-300 hover:text-white bg-slate-800/80 active:bg-emerald-600 transition-colors text-center flex items-center justify-center gap-1.5"
        >
          <Users className="w-3.5 h-3.5 text-emerald-400" />
          <span>Info Cliente {form.CLIENTE ? `(${form.CLIENTE.slice(0, 10)}..)` : ''}</span>
        </button>
      </div>

      <div className="flex-1 w-full flex flex-row overflow-x-auto xl:overflow-hidden snap-x snap-mandatory gap-4 xl:gap-6 pb-2 custom-scrollbar">
        {/* COLUMNA PRINCIPAL (FORMULARIO) */}
        <div ref={formColRef} className="w-[88vw] sm:w-[580px] xl:w-auto xl:flex-1 shrink-0 snap-center h-full bg-slate-900 rounded-2xl sm:rounded-3xl border border-slate-800 shadow-xl flex flex-col overflow-hidden">
          <div className="p-4 sm:p-6 border-b border-slate-800 flex items-center justify-between bg-slate-900/50">
            <div>
              <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                <h2 className="text-lg sm:text-2xl font-bold text-white flex items-center gap-2 sm:gap-3">
                  <span className="p-1.5 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-400 flex items-center justify-center">
                    <TicketIcon className="w-5 h-5 sm:w-6 sm:h-6 text-amber-400" />
                  </span>
                  INGRESO DE TICKET
                  <span className="text-blue-400 font-mono text-base sm:text-xl">{nextId}</span>
                </h2>
                {contrato && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-full text-[10px] sm:text-xs font-bold tracking-wide">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    CONTRATO ACTIVO: {horasContratadasString} HRS
                  </span>
                )}
              </div>
              <p className="text-slate-400 text-xs sm:text-sm mt-0.5">Estado inicial: ASIGNADO</p>
            </div>
            {error && <div className="text-red-400 text-xs sm:text-sm font-bold bg-red-900/30 px-3 py-1 rounded">{error}</div>}
          </div>

          <div className="flex-1 overflow-y-auto p-4 sm:p-6 custom-scrollbar">
          <form id="ticket-form" onSubmit={handleSubmit} className="space-y-6">
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="relative">
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide">Cliente *</label>
                  {contrato && (
                    <span className="text-[11px] font-semibold text-emerald-400 flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {horasContratadasString} hrs contratadas
                    </span>
                  )}
                </div>
                <div className="relative">
                  <input
                    required
                    type="text"
                    placeholder="Escriba o seleccione un cliente..."
                    value={form.CLIENTE}
                    onChange={e => {
                      handleClientChange(e.target.value);
                      setShowClientDropdown(true);
                    }}
                    onFocus={() => setShowClientDropdown(true)}
                    onBlur={() => setTimeout(() => setShowClientDropdown(false), 250)}
                    className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-4 py-3 pr-10 focus:outline-none focus:border-blue-500 relative z-10"
                  />
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 z-10 pointer-events-none" />
                </div>
                {showClientDropdown && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-slate-800 border border-slate-700 rounded-lg shadow-2xl z-50 max-h-56 overflow-y-auto custom-scrollbar">
                    {clientOptions
                      .filter(e => e.cliente.toLowerCase().includes(form.CLIENTE.toLowerCase()))
                      .map((e, idx) => (
                        <div
                          key={idx}
                          onClick={() => {
                            handleClientChange(e.cliente);
                            setShowClientDropdown(false);
                          }}
                          className="px-4 py-3 hover:bg-slate-700 text-slate-300 hover:text-white cursor-pointer transition-colors border-b border-slate-700/50 last:border-0 flex items-center justify-between gap-2"
                        >
                          <div>
                            <p className="font-bold text-sm text-white flex items-center gap-2">
                              {e.cliente}
                            </p>
                            {e.direccion && <p className="text-[10px] text-slate-500 mt-0.5">{e.direccion}</p>}
                          </div>
                          {e.hasContract && (
                            <span className="shrink-0 text-[10px] px-2 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded font-semibold flex items-center gap-1">
                              <ShieldCheck className="w-3 h-3" /> Contrato ({e.contractHours}h)
                            </span>
                          )}
                        </div>
                      ))}
                    {clientOptions.filter(e => e.cliente.toLowerCase().includes(form.CLIENTE.toLowerCase())).length === 0 && (
                      <div className="px-4 py-3 text-sm text-slate-500 italic">No se encontraron clientes</div>
                    )}
                  </div>
                )}
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">Dirección *</label>
                <input
                  required
                  type="text"
                  value={form.DIRECCION}
                  onChange={e => setForm(prev => ({ ...prev, DIRECCION: e.target.value }))}
                  placeholder="Dirección del cliente"
                  className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-4 py-3 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">Contacto *</label>
                <input
                  required
                  type="text"
                  value={form.CONTACTO}
                  onChange={e => setForm(prev => ({ ...prev, CONTACTO: e.target.value }))}
                  placeholder="Seleccionar de contactos o escribir"
                  className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-4 py-3 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">Teléfono *</label>
                <input
                  required
                  type="text"
                  value={form.TELEFONO}
                  onChange={e => setForm(prev => ({ ...prev, TELEFONO: e.target.value }))}
                  placeholder="Número de contacto"
                  className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-4 py-3 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 border-t border-slate-800 pt-6">
              <div className="col-span-1 md:col-span-2">
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">Fecha Programada *</label>
                <input
                  required
                  type="datetime-local"
                  value={form.FHPROGRAMADA}
                  onChange={e => setForm(prev => ({ ...prev, FHPROGRAMADA: e.target.value }))}
                  className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-4 py-3 focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">Prioridad *</label>
                <div className="relative">
                  <select
                    required
                    value={form.PRIORIDAD}
                    onChange={e => setForm(prev => ({ ...prev, PRIORIDAD: e.target.value }))}
                    className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-4 py-3 pr-10 appearance-none focus:outline-none focus:border-blue-500 relative z-10"
                  >
                    <option value="BAJA">BAJA</option>
                    <option value="MEDIA">MEDIA</option>
                    <option value="ALTA">ALTA</option>
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 z-20 pointer-events-none" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">Tipo *</label>
                <div className="relative">
                  <select
                    required
                    value={form.TIPO}
                    onChange={e => setForm(prev => ({ ...prev, TIPO: e.target.value }))}
                    className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-4 py-3 pr-10 appearance-none focus:outline-none focus:border-blue-500 relative z-10"
                  >
                    <option value="CONTRATO">CONTRATO</option>
                    <option value="FACTURABLE">FACTURABLE</option>
                    <option value="GARANTIA DE SERVICIO">GARANTIA DE SERVICIO</option>
                    <option value="DIAGNOSTICO">DIAGNOSTICO</option>
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 z-20 pointer-events-none" />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">Técnico *</label>
                <div className="relative">
                  <select
                    required
                    value={form.TECNICO}
                    onChange={e => setForm(prev => ({ ...prev, TECNICO: e.target.value }))}
                    className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-4 py-3 pr-10 appearance-none focus:outline-none focus:border-blue-500 relative z-10"
                  >
                    <option value="" disabled>Seleccionar técnico...</option>
                    {data.tecnicos.map(t => <option key={t.ID} value={t.NOMBRE}>{t.NOMBRE}</option>)}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 z-20 pointer-events-none" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">Modo de Atención *</label>
                <div className="relative">
                  <select
                    required
                    value={form['MODO DE ATENCION']}
                    onChange={e => setForm(prev => ({ ...prev, 'MODO DE ATENCION': e.target.value }))}
                    className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-4 py-3 pr-10 appearance-none focus:outline-none focus:border-blue-500 relative z-10"
                  >
                    <option value="" disabled>Seleccionar modo...</option>
                    <option value="EN SITIO">EN SITIO</option>
                    <option value="EN REMOTO">EN REMOTO</option>
                    <option value="LABORATORIO">LABORATORIO</option>
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 z-20 pointer-events-none" />
                </div>
              </div>
            </div>

            <div className="border-t border-slate-800 pt-6">
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">Problema Reportado *</label>
              <textarea
                required
                rows={3}
                value={form.PROBLEMA}
                onChange={e => setForm(prev => ({ ...prev, PROBLEMA: e.target.value }))}
                placeholder="Describa detalladamente el problema reportado..."
                className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-4 py-3 focus:outline-none focus:border-blue-500 resize-none"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="relative">
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">Actividad del Ticket</label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Escriba o seleccione..."
                    value={form['ACTIVIDAD DEL TICKET']}
                    onChange={e => {
                      setForm(prev => ({ ...prev, 'ACTIVIDAD DEL TICKET': e.target.value }));
                      setShowActividadDropdown(true);
                    }}
                    onFocus={() => setShowActividadDropdown(true)}
                    onBlur={() => setTimeout(() => setShowActividadDropdown(false), 250)}
                    className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-4 py-3 pr-10 focus:outline-none focus:border-blue-500 relative z-10"
                  />
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 z-10 pointer-events-none" />
                </div>
                {showActividadDropdown && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-50 max-h-48 overflow-y-auto custom-scrollbar">
                    {Array.from(new Set(data.tickets.map(t => t['ACTIVIDAD DEL TICKET']).filter(Boolean)))
                      .filter(t => t.toLowerCase().includes(form['ACTIVIDAD DEL TICKET'].toLowerCase()))
                      .map((t, i) => (
                        <div
                          key={i}
                          onClick={() => {
                            setForm(prev => ({ ...prev, 'ACTIVIDAD DEL TICKET': t }));
                            setShowActividadDropdown(false);
                          }}
                          className="px-4 py-3 hover:bg-slate-700 text-slate-300 hover:text-white cursor-pointer transition-colors border-b border-slate-700/50 last:border-0"
                        >
                          <p className="font-bold text-sm">{t}</p>
                        </div>
                      ))}
                  </div>
                )}
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">Observaciones</label>
                <input
                  type="text"
                  value={form.OBSERVACIONES}
                  onChange={e => setForm(prev => ({ ...prev, OBSERVACIONES: e.target.value }))}
                  placeholder="Observaciones adicionales..."
                  className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-4 py-3 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div className="border-t border-slate-800 pt-6">
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-4">Fotografías Iniciales (Máx. 4)</label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[0, 1, 2, 3].map(i => (
                  <div key={i} className="relative aspect-square rounded-2xl border-2 border-dashed border-slate-700 hover:border-blue-500 transition-colors bg-slate-800/50 flex flex-col items-center justify-center overflow-hidden group">
                    <input
                      type="file"
                      accept="image/*"
                      ref={el => { fileInputs.current[i] = el; }}
                      onChange={e => handlePhotoSelect(i, e)}
                      className="hidden"
                    />
                    {photoPreviews[i] ? (
                      <>
                        <img src={photoPreviews[i]!} alt={`Preview ${i+1}`} className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => removePhoto(i)}
                          className="absolute top-2 right-2 p-1.5 bg-black/60 text-white rounded-full hover:bg-red-500 transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => fileInputs.current[i]?.click()}
                        className="w-full h-full flex flex-col items-center justify-center text-slate-500 hover:text-blue-400 transition-colors"
                      >
                        <Camera className="w-8 h-8 mb-2" />
                        <span className="text-xs font-bold uppercase tracking-wide">FOTO {i+1}</span>
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <input
                type="text"
                placeholder="Comentario sobre las fotos (Opcional)"
                value={form['COMENTARIO DE FOTO']}
                onChange={e => setForm(prev => ({ ...prev, 'COMENTARIO DE FOTO': e.target.value }))}
                className="w-full mt-4 bg-slate-800 border border-slate-700 text-white rounded-lg px-4 py-3 focus:outline-none focus:border-blue-500"
              />
            </div>

          </form>
        </div>

        <div className="p-4 border-t border-slate-800 bg-slate-900/80 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={() => {
              if (!isLaboratorio) return;
              if (!form.CLIENTE) {
                setError('Seleccione un cliente antes de abrir la Guía de Internamiento');
                return;
              }
              setShowInternamientoModal(true);
            }}
            disabled={!isLaboratorio}
            className={`px-4 py-3 rounded-xl font-bold text-sm transition-all flex items-center gap-2 border ${
              isLaboratorio
                ? 'bg-indigo-600 hover:bg-indigo-500 text-white border-indigo-400/30 shadow-lg shadow-indigo-600/30 cursor-pointer'
                : 'bg-slate-800/60 text-slate-500 border-slate-700/40 cursor-not-allowed opacity-50'
            }`}
            title={isLaboratorio ? 'Abrir Guía de Internamiento en Hoja A4' : 'Se activa cuando Modo de Atención es LABORATORIO'}
          >
            <FileText className="w-4 h-4" />
            GUÍA DE INTERNAMIENTO
            {isLaboratorio && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-400/20 text-indigo-200 border border-indigo-300/30 uppercase font-black">
                Activo
              </span>
            )}
          </button>
          
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onCancel}
              disabled={saving}
              className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold transition-colors"
            >
              CANCELAR
            </button>
            <button
              type="submit"
              form="ticket-form"
              disabled={saving}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white rounded-xl font-bold transition-colors flex items-center gap-2 shadow-lg shadow-blue-500/20"
            >
              {saving ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  GUARDANDO...
                </>
              ) : 'GUARDAR TICKET'}
            </button>
          </div>
        </div>
      </div>

      {/* COLUMNA INFORMATIVA / CONTRATO Y TICKETS */}
      <div ref={infoColRef} className="w-[88vw] sm:w-[420px] xl:w-[420px] flex flex-col gap-4 shrink-0 snap-center h-full overflow-y-auto custom-scrollbar">
        {!form.CLIENTE ? (
          <div className="bg-slate-900 rounded-2xl sm:rounded-3xl border border-slate-800 p-6 sm:p-8 flex flex-col items-center justify-center text-center h-full text-slate-500 min-h-[300px]">
            <Users className="w-12 h-12 mb-4 opacity-50 text-slate-400" />
            <p className="font-bold text-sm text-slate-300">SELECCIONE UN CLIENTE</p>
            <p className="text-xs text-slate-500 mt-1">Escriba o elija un cliente para ver sus contratos, horas y tickets asociados.</p>
          </div>
        ) : (
          <>
            {/* 1. SECCIÓN DE CONTRATO Y HORAS CONTRATADAS (SI EL CLIENTE ESTÁ EN CONTRATO) */}
            {contrato ? (
              <div className="bg-slate-900 rounded-3xl border border-emerald-500/30 overflow-hidden shadow-xl shadow-emerald-950/20">
                <div className="bg-gradient-to-r from-emerald-950/60 to-slate-900 p-4 border-b border-emerald-500/20 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                      <ShieldCheck className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="font-bold text-emerald-400 uppercase text-xs tracking-wider">Contrato de Servicio</h3>
                      <p className="text-[10px] text-slate-400 font-mono">ID: {contrato.id || contrato.ID || 'CONTRATO'}</p>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold rounded-full uppercase tracking-wider">
                    Vigente
                  </span>
                </div>

                <div className="p-4 space-y-4">
                  {/* FILTRO DE PERIODO POR FECHA DE CIERRE */}
                  <div className="bg-slate-800/80 p-3 rounded-2xl border border-slate-700/60 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-emerald-400" />
                        Filtro por Fecha de Cierre
                      </span>
                      <div className="flex bg-slate-900/90 rounded-lg p-0.5 border border-slate-700/60 text-[10px]">
                        <button
                          type="button"
                          onClick={() => setMonthFilterMode('MONTH')}
                          className={`px-2 py-0.5 rounded-md font-semibold transition-colors ${monthFilterMode === 'MONTH' ? 'bg-emerald-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'}`}
                        >
                          Mes
                        </button>
                        <button
                          type="button"
                          onClick={() => setMonthFilterMode('ALL')}
                          className={`px-2 py-0.5 rounded-md font-semibold transition-colors ${monthFilterMode === 'ALL' ? 'bg-emerald-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'}`}
                        >
                          Histórico
                        </button>
                      </div>
                    </div>

                    {monthFilterMode === 'MONTH' && (
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[9px] uppercase text-slate-400 font-bold mb-1">Mes de Cierre</label>
                          <select
                            value={selectedMonth}
                            onChange={e => setSelectedMonth(parseInt(e.target.value, 10))}
                            className="w-full bg-slate-900 border border-slate-700 text-white text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-emerald-500"
                          >
                            {MESES.map((m, idx) => (
                              <option key={idx} value={idx + 1}>{m}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-[9px] uppercase text-slate-400 font-bold mb-1">Año</label>
                          <select
                            value={selectedYear}
                            onChange={e => setSelectedYear(parseInt(e.target.value, 10))}
                            className="w-full bg-slate-900 border border-slate-700 text-white text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-emerald-500"
                          >
                            {availableYears.map(y => (
                              <option key={y} value={y}>{y}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    )}
                    
                    <div className="flex items-center justify-between text-[10px] text-slate-400 pt-0.5">
                      <span className="flex items-center gap-1 text-emerald-400 font-medium">
                        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                        Solo Estado: <strong>CERRADO</strong>
                      </span>
                      <span>
                        {monthFilterMode === 'MONTH' ? `${MESES[selectedMonth - 1]} ${selectedYear}` : 'Todo el Historial'}
                      </span>
                    </div>
                  </div>

                  {/* METRICAS DE HORAS */}
                  <div className="grid grid-cols-3 gap-2 items-center">
                    <div className="bg-slate-800/70 p-3 rounded-2xl border border-slate-700/60 text-center">
                      <span className="block text-[9px] font-bold uppercase text-slate-400 tracking-wider">Contratadas</span>
                      <span className="text-lg font-black text-white block mt-0.5">{horasContratadasString}</span>
                      <span className="text-[10px] text-slate-500 font-medium">horas</span>
                    </div>
                    <div className="bg-gradient-to-b from-slate-800 to-slate-800/90 p-3.5 rounded-2xl border border-cyan-500/50 text-center shadow-lg shadow-cyan-950/30">
                      <span className="block text-[15px] sm:text-base font-black uppercase text-cyan-300 tracking-wide">
                        {monthFilterMode === 'MONTH' ? 'Consumo Mes' : 'Consumo Total'}
                      </span>
                      <span className="text-3xl sm:text-4xl font-black text-cyan-400 block my-1">{formatMinutesToHHMM(contractMinutesConsumed)}</span>
                      <span className="text-xs font-bold text-cyan-300 tracking-wider">CONTRATO</span>
                    </div>
                    <div className={`p-3 rounded-2xl border text-center ${remainingMinutes >= 0 ? 'bg-emerald-950/40 border-emerald-500/30' : 'bg-rose-950/40 border-rose-500/30'}`}>
                      <span className="block text-[9px] font-bold uppercase text-slate-400 tracking-wider">Saldo</span>
                      <span className={`text-lg font-black block mt-0.5 ${remainingMinutes >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {formatMinutesToHHMM(remainingMinutes)}
                      </span>
                      <span className="text-[10px] text-slate-500 font-medium">restantes</span>
                    </div>
                  </div>

                  {/* BARRA DE CONSUMO */}
                  {contractMinutes > 0 && (
                    <div className="space-y-1.5 pt-1">
                      <div className="flex justify-between text-[11px] font-semibold">
                        <span className="text-slate-400">
                          {monthFilterMode === 'MONTH' ? `Consumo Contrato (${MESES[selectedMonth - 1]})` : 'Consumo Contrato Global'}
                        </span>
                        <span className={consumptionPercentage >= 100 ? 'text-rose-400' : 'text-emerald-400'}>
                          {consumptionPercentage}% Utilizado
                        </span>
                      </div>
                      <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden border border-slate-700/60">
                        <div 
                          className={`h-full transition-all duration-500 rounded-full ${
                            consumptionPercentage >= 100 ? 'bg-rose-500' : consumptionPercentage >= 80 ? 'bg-amber-500' : 'bg-emerald-500'
                          }`}
                          style={{ width: `${Math.min(100, consumptionPercentage)}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-slate-900 rounded-3xl border border-slate-800 p-4 text-center">
                <div className="p-3 bg-slate-800/40 rounded-2xl border border-slate-700/40 flex items-center justify-center gap-2 text-slate-400 text-xs">
                  <AlertCircle className="w-4 h-4 text-slate-500" />
                  <span>Este cliente no cuenta con contrato de horas registrado.</span>
                </div>
              </div>
            )}

            {/* CONTACTOS */}
            <div className="bg-slate-900 rounded-3xl border border-slate-800 overflow-hidden">
              <div className="bg-slate-800/80 p-4 border-b border-slate-800 flex items-center justify-between">
                <h3 className="font-bold text-blue-400 uppercase text-xs tracking-wider flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  Contactos ({contacts.length})
                </h3>
              </div>
              <div className="p-2 max-h-[220px] overflow-y-auto custom-scrollbar">
                {contacts.length === 0 ? (
                  <p className="text-slate-500 text-xs text-center p-4">Sin contactos registrados</p>
                ) : (
                  contacts.map(c => (
                    <div 
                      key={c.ID} 
                      onClick={() => selectContact(c)}
                      className={`p-3 rounded-xl cursor-pointer mb-2 border transition-colors ${form.CONTACTO === c.NOMBRE ? 'bg-blue-600/20 border-blue-500/50' : 'bg-slate-800/30 border-transparent hover:bg-slate-800/60'}`}
                    >
                      <p className="text-white font-bold text-sm mb-1">{c.NOMBRE}</p>
                      <p className="text-slate-400 text-xs flex justify-between">
                        <span>{c.CARGO || 'Contacto'}</span>
                        <span className="font-mono">{c.PREFIJO} {c.CELULAR}</span>
                      </p>
                      {c.CORREO && <p className="text-slate-500 text-[10px] mt-1">{c.CORREO}</p>}
                    </div>
                  ))
                )}
              </div>
            </div>
          </>
        )}
      </div>

      </div>

      {/* MODAL GUÍA / CONSTANCIA DE INTERNAMIENTO EN LABORATORIO */}
      {showInternamientoModal && (
        <GuiaInternamientoModal
          isOpen={showInternamientoModal}
          onClose={() => setShowInternamientoModal(false)}
          nextId={nextId}
          form={form}
          photos={photos}
          photoPreviews={photoPreviews}
          data={data}
          onSavedTicketSuccess={() => {
            onTicketCreated();
          }}
        />
      )}

      {/* MODAL DE NOTIFICACIONES POST-CREACIÓN DE TICKET */}
      {showNotificacionesModal && (
        <TicketNotificacionesModal
          isOpen={showNotificacionesModal}
          onClose={() => {
            setShowNotificacionesModal(false);
            onTicketCreated();
          }}
          ticketId={savedTicketId || nextId}
          form={savedForm}
          data={data}
          fhIngreso={savedFhIngreso}
        />
      )}

    </div>
  );
}
