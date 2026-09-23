import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Plus, Calendar as CalendarIcon, Edit2, Trash2, AlertCircle, X,
  ArrowRight, ArrowLeft, GripVertical, RefreshCw, CheckCircle2, Clock, 
  Layers, ArrowRightLeft, Search, RotateCcw, User, ChevronDown, Check,
  DollarSign, MapPin, ArrowUpRight, ArrowDownLeft, FileText, CheckCircle,
  HelpCircle, AlertTriangle, MessageSquare, Send, Car, Train, Bus, Bike
} from 'lucide-react';
import { fetchAppData, createActividadDiaria, updateActividadDiaria, deleteRows, saveTranactiForActividad, deleteTranactiByRuta } from '../../lib/googleApi';
import type { ActividadDiaria, Tecnico, Tranacti } from '../../types';
import { auth } from '../../serviceAccess';
import { format } from 'date-fns';
import GoogleErrorCard from '../../components/GoogleErrorCard';

export type ColumnStatus = 'ASIGNADO' | 'EN ATENCION' | 'CERRADO';
const ALL_STATUSES: ColumnStatus[] = ['ASIGNADO', 'EN ATENCION', 'CERRADO'];

// Currency Helpers
export function parseSoles(val: string | number | undefined | null): number {
  if (val === undefined || val === null) return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  const cleaned = String(val)
    .replace(/S\/\.?/gi, '')
    .replace(/[^\d.-]/g, '')
    .trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

export function formatSoles(num: number): string {
  const safeNum = isNaN(num) ? 0 : num;
  return `S/. ${safeNum.toFixed(2)}`;
}

// Custom Styled Dropdown for Technicians matching app design
interface TecnicoDropdownProps {
  label: string;
  value: string;
  onChange: (val: string) => void;
  tecnicos: Tecnico[];
  placeholder?: string;
  required?: boolean;
}

function TecnicoDropdownSelect({
  label,
  value,
  onChange,
  tecnicos,
  placeholder = 'Seleccione un técnico...',
  required = false
}: TecnicoDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const cleanTecnicos = useMemo(() => {
    return tecnicos.filter(t => t.NOMBRE && t.NOMBRE.trim().length > 0);
  }, [tecnicos]);

  const filtered = useMemo(() => {
    if (!search.trim()) return cleanTecnicos;
    const q = search.toLowerCase();
    return cleanTecnicos.filter(t => 
      (t.NOMBRE || '').toLowerCase().includes(q) ||
      (t.CELULAR || '').includes(q)
    );
  }, [cleanTecnicos, search]);

  const selectedTecnico = cleanTecnicos.find(
    t => (t.NOMBRE || '').trim().toLowerCase() === (value || '').trim().toLowerCase()
  );

  return (
    <div ref={containerRef} className="relative flex flex-col gap-1.5 w-full">
      <div className="flex items-center justify-between">
        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
          <User className="w-3 h-3 text-indigo-400" />
          <span>{label}</span>
          {required && <span className="text-rose-400">*</span>}
        </label>
        {selectedTecnico?.CELULAR && (
          <span className="text-[10px] text-emerald-400 font-mono font-bold bg-emerald-500/10 px-1.5 py-0.2 rounded">
            📱 {selectedTecnico.CELULAR}
          </span>
        )}
      </div>

      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full bg-slate-900 hover:bg-slate-850 border border-slate-700/80 hover:border-indigo-500/50 focus:border-indigo-500 rounded-xl px-3 py-2.5 text-left flex items-center justify-between gap-2 transition-colors shadow-inner group"
      >
        <div className="flex items-center gap-2 truncate min-w-0">
          <div className="w-6 h-6 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0">
            <User className="w-3.5 h-3.5" />
          </div>
          <span className={`font-semibold truncate text-xs sm:text-sm ${value ? 'text-white' : 'text-slate-500 italic'}`}>
            {value || placeholder}
          </span>
        </div>
        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 shrink-0 ${isOpen ? 'rotate-180 text-indigo-400' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute z-50 left-0 right-0 top-full mt-1.5 bg-slate-900 border border-slate-700/90 rounded-xl shadow-2xl shadow-black/90 max-h-64 overflow-hidden flex flex-col animate-in fade-in zoom-in-95">
          <div className="p-2 border-b border-slate-800 bg-slate-950/70">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar técnico por nombre o celular..."
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              autoFocus
            />
          </div>
          <div className="overflow-y-auto max-h-52 custom-scrollbar py-1">
            {filtered.length > 0 ? (
              filtered.map((t) => {
                const isSelected = (t.NOMBRE || '').trim().toLowerCase() === (value || '').trim().toLowerCase();
                return (
                  <div
                    key={t.ID || t.NOMBRE}
                    onClick={() => {
                      onChange(t.NOMBRE.trim());
                      setIsOpen(false);
                      setSearch('');
                    }}
                    className={`px-3 py-2 cursor-pointer flex items-center justify-between gap-2 transition-colors ${
                      isSelected
                        ? 'bg-indigo-600/20 text-indigo-300 font-bold border-l-2 border-indigo-500'
                        : 'text-slate-200 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate min-w-0">
                      <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="text-xs sm:text-sm truncate font-medium">{t.NOMBRE}</span>
                      {t.CELULAR && (
                        <span className="text-[10px] text-emerald-400 font-mono font-semibold shrink-0">
                          📱 {t.CELULAR}
                        </span>
                      )}
                    </div>
                    {isSelected && <Check className="w-3.5 h-3.5 text-indigo-400 shrink-0" />}
                  </div>
                );
              })
            ) : (
              <div className="p-3 text-center text-xs text-slate-400 italic">
                No se encontraron técnicos
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function ActividadesInternasModule() {
  const user = auth.currentUser;
  const [actividades, setActividades] = useState<ActividadDiaria[]>([]);
  const [tecnicos, setTecnicos] = useState<Tecnico[]>([]);
  const [tranacti, setTranacti] = useState<Tranacti[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingActId, setUpdatingActId] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTecnico, setSelectedTecnico] = useState('');
  const [selectedFecha, setSelectedFecha] = useState('');
  const [selectedEstadoGasto, setSelectedEstadoGasto] = useState('');

  // Mobile Column Tab ('TODOS' | ColumnStatus)
  const [activeTab, setActiveTab] = useState<'TODOS' | ColumnStatus>('TODOS');

  // Dragging states (Desktop & Mobile)
  const [dragOverColumn, setDragOverColumn] = useState<ColumnStatus | null>(null);
  const [touchDraggingAct, setTouchDraggingAct] = useState<ActividadDiaria | null>(null);
  const [touchPos, setTouchPos] = useState<{ x: number; y: number } | null>(null);

  // Form Modal
  const [showForm, setShowForm] = useState(false);
  const [editingAct, setEditingAct] = useState<ActividadDiaria | null>(null);
  const [formData, setFormData] = useState<Partial<ActividadDiaria>>({});
  const [tranactiSegments, setTranactiSegments] = useState<Tranacti[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // Delete Modal
  const [deleteConfirm, setDeleteConfirm] = useState<ActividadDiaria | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Column Refs for touch drop calculation
  const colAsignadoRef = useRef<HTMLDivElement | null>(null);
  const colEnAtencionRef = useRef<HTMLDivElement | null>(null);
  const colCerradoRef = useRef<HTMLDivElement | null>(null);

  // Date picker ref for form modal
  const datePickerRef = useRef<HTMLInputElement | null>(null);

  const handleOpenDatePicker = () => {
    if (datePickerRef.current) {
      if ('showPicker' in HTMLInputElement.prototype) {
        try {
          datePickerRef.current.showPicker();
        } catch {
          datePickerRef.current.focus();
        }
      } else {
        datePickerRef.current.focus();
      }
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAppData();
      setActividades(data.actividadesDiarias || []);
      setTecnicos(data.tecnicos || []);
      setTranacti(data.tranacti || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Mobility styling and icon helpers (estilo Rendir Pasajes)
  const getTransportIcon = (movil: string) => {
    switch ((movil || '').toUpperCase()) {
      case 'TAXI': return <Car className="w-4 h-4 text-amber-500" />;
      case 'TREN': return <Train className="w-4 h-4 text-emerald-500" />;
      case 'METROPOLITANO': return <Bus className="w-4 h-4 text-blue-400" />;
      case 'COMBI': return <Bus className="w-4 h-4 text-purple-400" />;
      case 'MOTOCAR': return <Bike className="w-4 h-4 text-pink-500" />;
      default: return <Car className="w-4 h-4 text-slate-400" />;
    }
  };

  const getTransportStyle = (movil: string) => {
    switch ((movil || '').toUpperCase()) {
      case 'TAXI': return 'text-amber-500 border-amber-500/30 hover:bg-amber-500/10';
      case 'TREN': return 'text-emerald-500 border-emerald-500/30 hover:bg-emerald-500/10';
      case 'METROPOLITANO': return 'text-blue-400 border-blue-400/30 hover:bg-blue-400/10';
      case 'COMBI': return 'text-purple-400 border-purple-400/30 hover:bg-purple-400/10';
      case 'MOTOCAR': return 'text-pink-500 border-pink-500/30 hover:bg-pink-500/10';
      default: return 'text-slate-400 border-slate-700 hover:bg-slate-800';
    }
  };

  // Correlativo formato ACTIVIDAD-0000
  const generateId = () => {
    if (!actividades || actividades.length === 0) return 'ACTIVIDAD-0001';
    let maxNum = 0;
    actividades.forEach(a => {
      if (!a.ID) return;
      const match = a.ID.match(/(\d+)/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num) && num > maxNum) {
          maxNum = num;
        }
      }
    });
    return `ACTIVIDAD-${String(maxNum + 1).padStart(4, '0')}`;
  };

  // Correlativo formato MOVIL-0000 para TRANACTI
  const getNextMovilId = (currentSegments: Tranacti[] = []) => {
    let maxNum = 0;
    (tranacti || []).forEach(t => {
      if (!t.ID) return;
      const m = t.ID.match(/(\d+)/);
      if (m) {
        const n = parseInt(m[1], 10);
        if (!isNaN(n) && n > maxNum) maxNum = n;
      }
    });
    currentSegments.forEach(s => {
      if (!s.ID) return;
      const m = s.ID.match(/(\d+)/);
      if (m) {
        const n = parseInt(m[1], 10);
        if (!isNaN(n) && n > maxNum) maxNum = n;
      }
    });
    return `MOVIL-${String(maxNum + 1).padStart(4, '0')}`;
  };

  const handleAddSegment = (movil: string) => {
    const nextId = getNextMovilId(tranactiSegments);
    const newSegment: Tranacti = {
      ID: nextId,
      IDRUTA: formData.ID || '',
      MOVIL: movil,
      PASAJE: ''
    };
    const updated = [...tranactiSegments, newSegment];
    setTranactiSegments(updated);
    recalcFromSegments(updated, formData['GASTO ADICIONAL']);
  };

  const handleRemoveSegment = (id: string) => {
    const updated = tranactiSegments.filter(s => s.ID !== id);
    setTranactiSegments(updated);
    recalcFromSegments(updated, formData['GASTO ADICIONAL']);
  };

  const handleSegmentPasajeChange = (id: string, val: string) => {
    const updated = tranactiSegments.map(s => s.ID === id ? { ...s, PASAJE: val } : s);
    setTranactiSegments(updated);
    recalcFromSegments(updated, formData['GASTO ADICIONAL']);
  };

  const recalcFromSegments = (segments: Tranacti[], adicionalStr?: string) => {
    const sum = segments.reduce((acc, s) => acc + (parseFloat(s.PASAJE) || 0), 0);
    const pasajeFormatted = formatSoles(sum);
    const adicionalNum = parseSoles(adicionalStr !== undefined ? adicionalStr : formData['GASTO ADICIONAL']);
    const totalFormatted = formatSoles(sum + adicionalNum);
    setFormData(prev => ({
      ...prev,
      'GASTO DE PASAJE': pasajeFormatted,
      'MONTO TOTAL': totalFormatted
    }));
  };

  const openNewForm = () => {
    const todayStr = format(new Date(), 'dd/MM/yyyy');
    const autoId = generateId();

    setEditingAct(null);
    setTranactiSegments([]);
    setFormData({
      ID: autoId,
      FECHA: todayStr,
      'CREADO POR': user?.displayName || '',
      'ASIGNADO A': '',
      'MOTIVO DE LA ACTIVIDAD': '',
      IDA: '',
      VUELTA: '',
      'GASTO DE PASAJE': 'S/. 0.00',
      'GASTO ADICIONAL': 'S/. 0.00',
      'MONTO TOTAL': 'S/. 0.00',
      ESTADO: 'ASIGNADO',
      'ESTADO GASTO': 'NO CANCELADO'
    });
    setShowForm(true);
  };

  const openEditForm = (act: ActividadDiaria) => {
    setEditingAct(act);
    const existingSegs = (tranacti || []).filter(t => (t.IDRUTA || '').trim().toUpperCase() === act.ID.trim().toUpperCase());
    setTranactiSegments(existingSegs);

    const sumSegs = existingSegs.reduce((sum, s) => sum + (parseFloat(s.PASAJE) || 0), 0);
    const pasaje = existingSegs.length > 0 ? formatSoles(sumSegs) : (act['GASTO DE PASAJE'] || 'S/. 0.00');
    const adicional = act['GASTO ADICIONAL'] || 'S/. 0.00';
    const total = formatSoles(parseSoles(pasaje) + parseSoles(adicional));

    setFormData({
      ...act,
      'GASTO DE PASAJE': pasaje,
      'GASTO ADICIONAL': adicional,
      'MONTO TOTAL': act['MONTO TOTAL'] || total,
      ESTADO: act.ESTADO || 'ASIGNADO',
      'ESTADO GASTO': act['ESTADO GASTO'] || 'NO CANCELADO'
    });
    setShowForm(true);
  };

  // Handle changes to Pasaje or Adicional, calculating Monto Total
  const handleCurrencyChange = (field: 'GASTO DE PASAJE' | 'GASTO ADICIONAL', rawValue: string) => {
    const currentPasaje = field === 'GASTO DE PASAJE' ? rawValue : (formData['GASTO DE PASAJE'] || '0');
    const currentAdicional = field === 'GASTO ADICIONAL' ? rawValue : (formData['GASTO ADICIONAL'] || '0');
    const totalNum = parseSoles(currentPasaje) + parseSoles(currentAdicional);

    setFormData(prev => ({
      ...prev,
      [field]: rawValue,
      'MONTO TOTAL': formatSoles(totalNum)
    }));
  };

  const handleCurrencyBlur = (field: 'GASTO DE PASAJE' | 'GASTO ADICIONAL') => {
    const rawVal = formData[field] || '';
    const num = parseSoles(rawVal);
    const formatted = formatSoles(num);

    const currentPasaje = field === 'GASTO DE PASAJE' ? formatted : (formData['GASTO DE PASAJE'] || '0');
    const currentAdicional = field === 'GASTO ADICIONAL' ? formatted : (formData['GASTO ADICIONAL'] || '0');
    const totalNum = parseSoles(currentPasaje) + parseSoles(currentAdicional);

    setFormData(prev => ({
      ...prev,
      [field]: formatted,
      'MONTO TOTAL': formatSoles(totalNum)
    }));
  };

  // Helper para enviar notificación a "ASIGNADO A" por WhatsApp
  const sendWhatsAppNotification = (act: {
    ID?: string;
    FECHA?: string;
    'CREADO POR'?: string;
    'ASIGNADO A'?: string;
    'MOTIVO DE LA ACTIVIDAD'?: string;
    ACTIVIDAD?: string;
    ASIGNADO?: string;
    'PROGRAMADO POR'?: string;
  }) => {
    const cleanPhoneNumber = (rawPhone: string) => {
      let clean = (rawPhone || '').replace(/\D/g, '');
      if (clean.length === 9 && !clean.startsWith('51')) {
        clean = `51${clean}`;
      }
      return clean;
    };

    const id = act.ID || '-';
    const fecha = act.FECHA || '-';
    const creadoPor = act['CREADO POR'] || act['PROGRAMADO POR'] || '-';
    const asignadoA = act['ASIGNADO A'] || act.ASIGNADO || '-';
    const motivo = act['MOTIVO DE LA ACTIVIDAD'] || act.ACTIVIDAD || '-';

    const asignadoNombre = asignadoA.trim().toLowerCase();
    const tecnicoAsignado = tecnicos.find(t => (t.NOMBRE || '').trim().toLowerCase() === asignadoNombre);
    const rawPhone = tecnicoAsignado?.CELULAR || '';
    const cleanPhone = cleanPhoneNumber(rawPhone);

    const message = 
      `📋 *ACTIVIDAD ASIGNADA*\n` +
      `----------------------------------------\n` +
      `🆔 *ID:* ${id}\n` +
      `📅 *FECHA:* ${fecha}\n` +
      `👤 *CREADO POR:* ${creadoPor}\n` +
      `👨‍🔧 *ASIGNADO A:* ${asignadoA}\n` +
      `📝 *MOTIVO DE LA ACTIVIDAD:*\n${motivo}\n` +
      `----------------------------------------`;

    const waUrl = cleanPhone 
      ? `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(message)}`
      : `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`;

    try {
      window.open(waUrl, '_blank', 'noopener,noreferrer');
    } catch (err) {
      console.warn("No se pudo abrir WhatsApp automáticamente:", err);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData['MOTIVO DE LA ACTIVIDAD']?.trim()) {
      alert("Por favor ingrese el Motivo de la Actividad.");
      return;
    }
    if (!formData['ASIGNADO A']?.trim()) {
      alert("Por favor seleccione el técnico en 'ASIGNADO A'.");
      return;
    }

    const pasajeNum = parseSoles(formData['GASTO DE PASAJE']);
    const adicionalNum = parseSoles(formData['GASTO ADICIONAL']);
    const totalFormatted = formatSoles(pasajeNum + adicionalNum);

    const payload: ActividadDiaria = {
      ID: formData.ID || generateId(),
      FECHA: formData.FECHA || format(new Date(), 'dd/MM/yyyy'),
      'CREADO POR': formData['CREADO POR'] || '',
      'ASIGNADO A': formData['ASIGNADO A'] || '',
      'MOTIVO DE LA ACTIVIDAD': formData['MOTIVO DE LA ACTIVIDAD'] || '',
      IDA: formData.IDA || '',
      VUELTA: formData.VUELTA || '',
      'GASTO DE PASAJE': formatSoles(pasajeNum),
      'GASTO ADICIONAL': formatSoles(adicionalNum),
      'MONTO TOTAL': totalFormatted,
      ESTADO: formData.ESTADO || 'ASIGNADO',
      'ESTADO GASTO': formData['ESTADO GASTO'] || 'NO CANCELADO',
      // Compatibility aliases
      'FECHA DE INICIO': formData.FECHA || format(new Date(), 'dd/MM/yyyy'),
      ACTIVIDAD: formData['MOTIVO DE LA ACTIVIDAD'] || '',
      ASIGNADO: formData['ASIGNADO A'] || '',
      'PROGRAMADO POR': formData['CREADO POR'] || '',
      _rowIndex: editingAct ? (editingAct as any)._rowIndex : -1
    };

    // 1. Notificación WhatsApp:
    // - Si es creación de nueva actividad -> Enviar notificación por WhatsApp a "ASIGNADO A" y guardar en tabla.
    // - Si es edición (EDITAR) -> Solo si cambió "MOTIVO DE LA ACTIVIDAD" se envía notificación a WhatsApp.
    //   Si se modifican otros campos y el motivo no cambió, solo se guarda la data en la tabla.
    const isEditing = Boolean(editingAct);
    const originalMotivo = (editingAct?.['MOTIVO DE LA ACTIVIDAD'] || editingAct?.ACTIVIDAD || '').trim();
    const currentMotivo = (payload['MOTIVO DE LA ACTIVIDAD'] || '').trim();
    const shouldSendWhatsApp = !isEditing || (originalMotivo !== currentMotivo);

    if (shouldSendWhatsApp) {
      sendWhatsAppNotification(payload);
    }

    // 2. Guardar la data en la tabla
    setIsSaving(true);
    try {
      if (editingAct && (editingAct as any)._rowIndex !== undefined && (editingAct as any)._rowIndex !== -1) {
        await updateActividadDiaria((editingAct as any)._rowIndex, payload);
        setActividades(prev => prev.map(a => a.ID === payload.ID ? payload : a));
      } else {
        await createActividadDiaria(payload);
        // Refresh to get actual rowIndex from sheet
        const data = await fetchAppData();
        setActividades(data.actividadesDiarias || []);
      }

      // Guardar segmentos en tabla TRANACTI
      const cleanSegments: Tranacti[] = tranactiSegments.map(s => ({
        ID: s.ID,
        IDRUTA: payload.ID,
        MOVIL: s.MOVIL,
        PASAJE: (parseFloat(s.PASAJE) || 0).toFixed(2)
      }));

      await saveTranactiForActividad(payload.ID, cleanSegments);
      setTranacti(prev => [
        ...prev.filter(t => (t.IDRUTA || '').trim().toUpperCase() !== payload.ID.trim().toUpperCase()),
        ...cleanSegments
      ]);

      setShowForm(false);
    } catch (error: any) {
      console.error(error);
      alert("Error al guardar actividad diaria: " + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleChangeStatus = async (act: ActividadDiaria, newStatus: ColumnStatus) => {
    if (act.ESTADO === newStatus) return;
    setUpdatingActId(act.ID);

    // Optimistic UI update
    const prevActividades = [...actividades];
    const updatedAct: ActividadDiaria = { ...act, ESTADO: newStatus };
    setActividades(prev => prev.map(a => a.ID === act.ID ? updatedAct : a));

    try {
      if ((updatedAct as any)._rowIndex !== undefined && (updatedAct as any)._rowIndex !== -1) {
        await updateActividadDiaria((updatedAct as any)._rowIndex, updatedAct);
      } else {
        // In case row index was missing, refresh sheet data
        const data = await fetchAppData();
        const found = (data.actividadesDiarias || []).find(a => a.ID === act.ID);
        if (found && (found as any)._rowIndex) {
          await updateActividadDiaria((found as any)._rowIndex, { ...found, ESTADO: newStatus });
        }
      }
    } catch (error: any) {
      console.error(error);
      alert("Error al actualizar estado: " + error.message);
      setActividades(prevActividades);
    } finally {
      setUpdatingActId(null);
    }
  };

  const handleToggleEstadoGasto = async (act: ActividadDiaria) => {
    const newGasto = act['ESTADO GASTO'] === 'CANCELADO' ? 'NO CANCELADO' : 'CANCELADO';
    setUpdatingActId(act.ID);

    const prevActividades = [...actividades];
    const updatedAct: ActividadDiaria = { ...act, 'ESTADO GASTO': newGasto };
    setActividades(prev => prev.map(a => a.ID === act.ID ? updatedAct : a));

    try {
      if ((updatedAct as any)._rowIndex !== undefined && (updatedAct as any)._rowIndex !== -1) {
        await updateActividadDiaria((updatedAct as any)._rowIndex, updatedAct);
      }
    } catch (error: any) {
      console.error(error);
      alert("Error al actualizar estado de gasto: " + error.message);
      setActividades(prevActividades);
    } finally {
      setUpdatingActId(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    setIsDeleting(true);
    try {
      if ((deleteConfirm as any)._rowIndex === undefined || (deleteConfirm as any)._rowIndex === -1) {
        alert("Por favor actualice la página antes de eliminar este registro.");
        setIsDeleting(false);
        return;
      }
      await deleteRows('ACTIVIDADESDIARIAS', [(deleteConfirm as any)._rowIndex]);
      await deleteTranactiByRuta(deleteConfirm.ID);
      setTranacti(prev => prev.filter(t => (t.IDRUTA || '').trim().toUpperCase() !== deleteConfirm.ID.trim().toUpperCase()));
      setActividades(prev => prev.filter(a => a.ID !== deleteConfirm.ID));
      setDeleteConfirm(null);
    } catch (error: any) {
      console.error(error);
      alert("Error al eliminar: " + error.message);
    } finally {
      setIsDeleting(false);
    }
  };

  // Drag and Drop (Desktop)
  const onDragStart = (e: React.DragEvent, act: ActividadDiaria) => {
    e.dataTransfer.setData("actId", act.ID);
  };

  const onDragOver = (e: React.DragEvent, status: ColumnStatus) => {
    e.preventDefault();
    if (dragOverColumn !== status) {
      setDragOverColumn(status);
    }
  };

  const onDragLeave = () => {
    setDragOverColumn(null);
  };

  const onDrop = (e: React.DragEvent, status: ColumnStatus) => {
    e.preventDefault();
    setDragOverColumn(null);
    const actId = e.dataTransfer.getData("actId");
    const act = actividades.find(a => a.ID === actId);
    if (act && act.ESTADO !== status) {
      handleChangeStatus(act, status);
    }
  };

  // Touch Drag and Drop (Mobile)
  const handleTouchStart = (e: React.TouchEvent, act: ActividadDiaria) => {
    const touch = e.touches[0];
    setTouchDraggingAct(act);
    setTouchPos({ x: touch.clientX, y: touch.clientY });
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchDraggingAct) return;
    const touch = e.touches[0];
    setTouchPos({ x: touch.clientX, y: touch.clientY });

    const element = document.elementFromPoint(touch.clientX, touch.clientY);
    const colElement = element?.closest('[data-column-status]');
    if (colElement) {
      const colStatus = colElement.getAttribute('data-column-status') as ColumnStatus;
      if (colStatus && colStatus !== dragOverColumn) {
        setDragOverColumn(colStatus);
      }
    } else {
      setDragOverColumn(null);
    }
  };

  const handleTouchEnd = () => {
    if (touchDraggingAct && dragOverColumn && touchDraggingAct.ESTADO !== dragOverColumn) {
      handleChangeStatus(touchDraggingAct, dragOverColumn);
    }
    setTouchDraggingAct(null);
    setTouchPos(null);
    setDragOverColumn(null);
  };

  // Filtered List
  const filteredActividades = useMemo(() => {
    return actividades.filter(act => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchId = (act.ID || '').toLowerCase().includes(q);
        const matchMotivo = (act['MOTIVO DE LA ACTIVIDAD'] || act.ACTIVIDAD || '').toLowerCase().includes(q);
        const matchAsig = (act['ASIGNADO A'] || act.ASIGNADO || '').toLowerCase().includes(q);
        const matchCreado = (act['CREADO POR'] || act['PROGRAMADO POR'] || '').toLowerCase().includes(q);
        const matchIda = (act.IDA || '').toLowerCase().includes(q);
        const matchVuelta = (act.VUELTA || '').toLowerCase().includes(q);
        if (!matchId && !matchMotivo && !matchAsig && !matchCreado && !matchIda && !matchVuelta) return false;
      }
      if (selectedTecnico) {
        const asig = (act['ASIGNADO A'] || act.ASIGNADO || '').toLowerCase();
        const cread = (act['CREADO POR'] || act['PROGRAMADO POR'] || '').toLowerCase();
        const target = selectedTecnico.toLowerCase();
        if (asig !== target && cread !== target) return false;
      }
      if (selectedFecha) {
        const d = act.FECHA || act['FECHA DE INICIO'] || '';
        const inputD = parseLocalToInput(d);
        if (inputD !== selectedFecha && !d.includes(selectedFecha)) {
          return false;
        }
      }
      if (selectedEstadoGasto) {
        const gasto = (act['ESTADO GASTO'] || 'NO CANCELADO').toUpperCase();
        if (gasto !== selectedEstadoGasto.toUpperCase()) return false;
      }
      return true;
    });
  }, [actividades, searchQuery, selectedTecnico, selectedFecha, selectedEstadoGasto]);

  // Board Data grouped by status - orden del mas reciente al mas antiguo tomando de referencia ID de ACTIVIDADESDIARIAS
  const boardData = useMemo(() => {
    const map: Record<ColumnStatus, ActividadDiaria[]> = {
      ASIGNADO: [],
      'EN ATENCION': [],
      CERRADO: []
    };

    filteredActividades.forEach(act => {
      const raw = (act.ESTADO || 'ASIGNADO').toUpperCase().trim();
      if (raw.includes('ATENCION') || raw.includes('ATENCIÓN')) {
        map['EN ATENCION'].push(act);
      } else if (raw.includes('CERRAD')) {
        map['CERRADO'].push(act);
      } else {
        map['ASIGNADO'].push(act);
      }
    });

    const extractIdNum = (idStr?: string): number => {
      if (!idStr) return -1;
      const m = idStr.match(/(\d+)/);
      return m ? parseInt(m[1], 10) : -1;
    };

    // Ordenar del más reciente al más antiguo por ID
    const sortDescById = (a: ActividadDiaria, b: ActividadDiaria) => {
      const numA = extractIdNum(a.ID);
      const numB = extractIdNum(b.ID);
      if (numA !== numB) {
        return numB - numA; // Más alto primero (más reciente al más antiguo)
      }
      return (b.ID || '').localeCompare(a.ID || '', undefined, { numeric: true, sensitivity: 'base' });
    };

    map['ASIGNADO'].sort(sortDescById);
    map['EN ATENCION'].sort(sortDescById);
    map['CERRADO'].sort(sortDescById);

    return map;
  }, [filteredActividades]);

  // Status Styling Configuration
  const statusConfig: Record<ColumnStatus, { border: string; bg: string; text: string; badge: string; dot: string; headerBorder: string }> = {
    'ASIGNADO': { 
      border: 'border-rose-500/70', 
      bg: 'bg-rose-500/10', 
      text: 'text-rose-400',
      badge: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
      dot: 'bg-rose-500',
      headerBorder: 'border-rose-500'
    },
    'EN ATENCION': { 
      border: 'border-amber-500/70', 
      bg: 'bg-amber-500/10', 
      text: 'text-amber-400',
      badge: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
      dot: 'bg-amber-500 animate-pulse',
      headerBorder: 'border-amber-500'
    },
    'CERRADO': { 
      border: 'border-emerald-500/70', 
      bg: 'bg-emerald-500/10', 
      text: 'text-emerald-400',
      badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
      dot: 'bg-emerald-500',
      headerBorder: 'border-emerald-500'
    }
  };

  // Helper date parsing
  const formatDateToLocal = (dateString: string) => {
    if (!dateString) return "";
    const [year, month, day] = dateString.split('-');
    if (year && month && day) return `${day}/${month}/${year}`;
    return dateString;
  };

  const parseLocalToInput = (dateString: string) => {
    if (!dateString) return "";
    const parts = dateString.split('/');
    if (parts.length === 3) {
      return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
    return dateString;
  };

  // Render Kanban Card
  const renderCard = (act: ActividadDiaria) => {
    const isUpdating = updatingActId === act.ID;
    const currentStatus = (ALL_STATUSES.includes(act.ESTADO as ColumnStatus) ? act.ESTADO : 'ASIGNADO') as ColumnStatus;
    const currentConfig = statusConfig[currentStatus];
    const isCerrado = currentStatus === 'CERRADO';

    const estadoGastoIsCancelado = (act['ESTADO GASTO'] || '').toUpperCase().trim() === 'CANCELADO';
    
    // Gasto de pasaje calculado desde TRANACTI (asociado por IDRUTA === ID)
    const actTranacti = (tranacti || []).filter(t => (t.IDRUTA || '').trim().toUpperCase() === (act.ID || '').trim().toUpperCase());
    const sumTranactiPasaje = actTranacti.reduce((sum, t) => sum + (parseFloat(t.PASAJE) || 0), 0);
    const pasajeVal = actTranacti.length > 0 ? formatSoles(sumTranactiPasaje) : (act['GASTO DE PASAJE'] || 'S/. 0.00');
    const adicionalVal = act['GASTO ADICIONAL'] || 'S/. 0.00';
    const totalVal = formatSoles((actTranacti.length > 0 ? sumTranactiPasaje : parseSoles(pasajeVal)) + parseSoles(adicionalVal));

    return (
      <div 
        key={act.ID} 
        draggable
        onDragStart={(e) => onDragStart(e, act)}
        className={`bg-[#0B1120] border-2 ${currentConfig.border} rounded-2xl p-4 flex flex-col gap-3 hover:bg-slate-850/70 transition-all relative group shadow-xl select-none cursor-grab active:cursor-grabbing ${isUpdating ? 'opacity-50 pointer-events-none' : ''}`}
      >
        {isUpdating && (
          <div className="absolute inset-0 bg-[#0B1120]/80 rounded-2xl z-20 flex items-center justify-center backdrop-blur-xs">
            <div className="flex items-center gap-2 text-xs font-bold text-indigo-400">
              <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
              <span>Actualizando...</span>
            </div>
          </div>
        )}

        {/* Card Header: ID, (ESTADO & ESTADO GASTO solo en CERRADO) & Action Buttons */}
        <div className="flex justify-between items-start gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div 
              className="touch-none cursor-grab active:cursor-grabbing text-slate-500 hover:text-slate-300 p-1 -ml-1 rounded transition-colors"
              onTouchStart={(e) => handleTouchStart(e, act)}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              title="Arrastrar tarjeta"
            >
              <GripVertical className="w-4 h-4" />
            </div>

            <span className="font-['JetBrains_Mono'] text-xs font-black text-white bg-slate-800/90 px-2.5 py-1 rounded-lg border border-slate-700 shadow-xs">
              {act.ID}
            </span>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap justify-end">
            {/* Solo mostrar ESTADO y ESTADO GASTO cuando ESTADO === 'CERRADO' */}
            {isCerrado && (
              <>
                <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold border ${currentConfig.badge}`}>
                  {act.ESTADO}
                </span>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleToggleEstadoGasto(act);
                  }}
                  title="Clic para alternar Estado Gasto (CANCELADO / NO CANCELADO)"
                  className={`text-[9.5px] px-2 py-0.5 rounded-full font-extrabold uppercase border cursor-pointer transition-all active:scale-95 ${
                    estadoGastoIsCancelado
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 hover:bg-emerald-500/30'
                      : 'bg-amber-500/20 text-amber-300 border-amber-500/50 hover:bg-amber-500/30'
                  }`}
                >
                  {act['ESTADO GASTO'] || 'NO CANCELADO'}
                </button>
              </>
            )}

            {/* Quick Action buttons */}
            <div className="flex items-center gap-0.5 bg-slate-900/90 rounded-lg p-0.5 border border-slate-800 ml-0.5">
              <button 
                onClick={(e) => { e.stopPropagation(); sendWhatsAppNotification(act); }} 
                className="p-1 hover:bg-emerald-950/60 text-slate-400 hover:text-emerald-400 rounded transition-colors" 
                title="Notificar por WhatsApp a asignado"
              >
                <MessageSquare className="w-3.5 h-3.5" />
              </button>
              <button 
                onClick={(e) => { e.stopPropagation(); openEditForm(act); }} 
                className="p-1 hover:bg-slate-800 text-slate-300 hover:text-white rounded transition-colors" 
                title="Editar actividad"
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>
              <button 
                onClick={(e) => { e.stopPropagation(); setDeleteConfirm(act); }} 
                className="p-1 hover:bg-rose-950/50 text-slate-400 hover:text-rose-400 rounded transition-colors" 
                title="Eliminar actividad"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Fecha */}
        <div className="flex items-center gap-1.5 text-slate-400 text-xs font-semibold">
          <CalendarIcon className="w-3.5 h-3.5 text-indigo-400" />
          <span>{act.FECHA || act['FECHA DE INICIO'] || 'Sin fecha'}</span>
        </div>

        {/* Personas: CREADO POR & ASIGNADO A */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs border-t border-slate-800/80 pt-2.5">
          <div className="flex flex-col">
            <span className="text-[9.5px] font-bold text-slate-500 uppercase tracking-wider">CREADO POR</span>
            <span className="text-slate-300 font-semibold truncate flex items-center gap-1 mt-0.5">
              <User className="w-3 h-3 text-slate-500 shrink-0" />
              <span className="truncate">{act['CREADO POR'] || act['PROGRAMADO POR'] || '-'}</span>
            </span>
          </div>

          <div className="flex flex-col">
            <span className="text-[9.5px] font-bold text-slate-500 uppercase tracking-wider">ASIGNADO A</span>
            <span className="text-indigo-300 font-bold truncate flex items-center gap-1 mt-0.5">
              <User className="w-3 h-3 text-indigo-400 shrink-0" />
              <span className="truncate">{act['ASIGNADO A'] || act.ASIGNADO || '-'}</span>
            </span>
          </div>
        </div>

        {/* Motivo de la Actividad */}
        <div className="bg-slate-900/70 p-3 rounded-xl border border-slate-800/90">
          <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1 flex items-center gap-1">
            <FileText className="w-3 h-3 text-indigo-400" />
            <span>Motivo de la Actividad</span>
          </p>
          <p className="text-xs sm:text-sm text-slate-100 font-medium leading-relaxed break-words">
            {act['MOTIVO DE LA ACTIVIDAD'] || act.ACTIVIDAD || 'Sin motivo especificado'}
          </p>
        </div>

        {/* CUANDO ESTADO === CERRADO: Mostrar IDA, VUELTA, GASTO DE PASAJE, GASTO ADICIONAL, MONTO TOTAL */}
        {isCerrado && (
          <>
            {/* Ruta: IDA y VUELTA */}
            <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80 text-xs flex flex-col gap-1.5">
              <div className="flex items-center gap-1.5">
                <span className="text-[9.5px] font-bold text-amber-400 uppercase tracking-wider min-w-[44px] flex items-center gap-1">
                  <ArrowUpRight className="w-3 h-3 text-amber-400" />
                  IDA:
                </span>
                <span className="text-slate-200 font-medium truncate">{act.IDA || '-'}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[9.5px] font-bold text-cyan-400 uppercase tracking-wider min-w-[44px] flex items-center gap-1">
                  <ArrowDownLeft className="w-3 h-3 text-cyan-400" />
                  VUELTA:
                </span>
                <span className="text-slate-200 font-medium truncate">{act.VUELTA || '-'}</span>
              </div>
            </div>

            {/* Desglose de Gastos & Monto Total */}
            <div className="bg-slate-900/90 rounded-xl p-3 border border-slate-800 flex flex-col gap-2">
              {actTranacti.length > 0 && (
                <div className="flex flex-wrap gap-1 pb-1.5 border-b border-slate-800/80">
                  {actTranacti.map(t => (
                    <span key={t.ID} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300 border border-slate-700">
                      {getTransportIcon(t.MOVIL)}
                      <span className="font-medium">{t.MOVIL}</span>
                      <span className="font-mono text-amber-400 font-bold">S/{parseFloat(t.PASAJE || '0').toFixed(2)}</span>
                    </span>
                  ))}
                </div>
              )}
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div>
                  <span className="text-[9.5px] font-bold text-slate-500 uppercase block">Gasto Pasaje</span>
                  <span className="text-slate-200 font-mono font-bold">{pasajeVal}</span>
                </div>
                <div>
                  <span className="text-[9.5px] font-bold text-slate-500 uppercase block">Gasto Adicional</span>
                  <span className="text-slate-200 font-mono font-bold">{adicionalVal}</span>
                </div>
              </div>

              <div className="border-t border-slate-800/90 pt-2 flex items-center justify-between">
                <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                  MONTO TOTAL
                </span>
                <span className="font-mono text-xs sm:text-sm font-black text-emerald-400 bg-emerald-950/50 px-2.5 py-0.5 rounded-lg border border-emerald-800/60 shadow-xs">
                  {totalVal}
                </span>
              </div>
            </div>
          </>
        )}

        {/* Quick Move Buttons between ESTADO Columns */}
        <div className="mt-1 pt-2.5 border-t border-slate-800 flex flex-col gap-1.5">
          <span className="text-[9.5px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
            <ArrowRightLeft className="w-3 h-3 text-slate-400" />
            Mover a:
          </span>

          <div className="grid grid-cols-2 gap-1.5">
            {ALL_STATUSES.filter(s => s !== currentStatus).map(targetStatus => {
              const cfg = statusConfig[targetStatus];
              return (
                <button
                  key={targetStatus}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleChangeStatus(act, targetStatus);
                  }}
                  className={`py-1.5 px-2 rounded-lg text-[10px] font-bold border transition-all active:scale-95 flex items-center justify-center gap-1 ${cfg.badge} hover:brightness-125 truncate`}
                  title={`Cambiar a ${targetStatus}`}
                >
                  <span className="truncate">{targetStatus}</span>
                  <ArrowRight className="w-2.5 h-2.5 shrink-0" />
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col flex-1 w-full overflow-hidden h-full bg-[#0B1120] text-slate-300 font-sans relative">
      {loading && (
        <div className="absolute inset-0 bg-[#0B1120]/60 backdrop-blur-sm z-50 flex flex-col items-center justify-center">
          <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-indigo-400 font-bold mt-4 animate-pulse">Cargando actividades diarias...</p>
        </div>
      )}

      {error && (
        <div className="p-4 flex items-center justify-center shrink-0">
          <GoogleErrorCard error={error} onRetry={loadData} title="Error en Actividades Diarias" />
        </div>
      )}

      {/* Touch Drag Floating Ghost on Mobile */}
      {touchDraggingAct && touchPos && (
        <div 
          className="fixed z-50 pointer-events-none p-3 bg-slate-900/95 border-2 border-indigo-500 rounded-xl shadow-2xl w-64 opacity-90 -translate-x-1/2 -translate-y-1/2"
          style={{ left: `${touchPos.x}px`, top: `${touchPos.y}px` }}
        >
          <div className="flex justify-between items-center mb-1">
            <span className="text-[11px] font-bold text-white bg-slate-800 px-1.5 py-0.5 rounded">{touchDraggingAct.ID}</span>
            <span className="text-[9px] font-bold text-indigo-300 uppercase">Moviendo...</span>
          </div>
          <p className="text-xs text-white line-clamp-2 font-medium">
            {touchDraggingAct['MOTIVO DE LA ACTIVIDAD'] || touchDraggingAct.ACTIVIDAD}
          </p>
        </div>
      )}

      {/* Header */}
      <header className="bg-[#111827] border-b border-slate-800 px-3 sm:px-6 py-3 sm:py-4 flex justify-between items-center shrink-0 z-10">
        <div className="flex items-center gap-2.5 sm:gap-3">
          <div className="w-8 h-8 sm:w-10 sm:h-10 bg-indigo-900/50 rounded-xl flex items-center justify-center border border-indigo-500/30 text-indigo-400">
            <CalendarIcon className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div>
            <h1 className="text-base sm:text-xl font-bold text-white tracking-wide">ACTIVIDADES INTERNAS</h1>
            <p className="text-[10px] sm:text-xs text-slate-500 hidden xs:block">
              Gestión diaria de actividades, rutas y gastos (Tabla ACTIVIDADESDIARIAS)
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <button 
            onClick={openNewForm}
            className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white px-3.5 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all shadow-lg shadow-emerald-900/30"
            title="Nueva Actividad"
          >
            <Plus className="w-4 h-4" />
            <span>Nueva</span>
          </button>
          
          <button 
            onClick={loadData} 
            disabled={loading}
            className="p-2 sm:px-3 sm:py-2 rounded-xl text-xs sm:text-sm font-bold transition-all bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 flex items-center gap-1.5 disabled:opacity-50"
            title="Actualizar datos"
          >
            <RefreshCw className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Actualizar</span>
          </button>
        </div>
      </header>

      {/* Search & Filter Bar */}
      <div className="bg-[#0f172a] border-b border-slate-800 px-3 sm:px-6 py-2.5 flex flex-wrap items-center gap-2 sm:gap-3 shrink-0">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar ID, motivo, ruta, técnico..."
            className="w-full bg-slate-900 border border-slate-700/80 rounded-xl pl-8 pr-7 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Filter by Tecnico */}
          <select
            value={selectedTecnico}
            onChange={(e) => setSelectedTecnico(e.target.value)}
            className="bg-slate-900 border border-slate-700/80 rounded-xl px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 max-w-[150px]"
          >
            <option value="">Todos los técnicos</option>
            {tecnicos.map(t => (
              <option key={t.ID || t.NOMBRE} value={t.NOMBRE}>{t.NOMBRE}</option>
            ))}
          </select>

          {/* Filter by Estado Gasto */}
          <select
            value={selectedEstadoGasto}
            onChange={(e) => setSelectedEstadoGasto(e.target.value)}
            className="bg-slate-900 border border-slate-700/80 rounded-xl px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
          >
            <option value="">Todos los gastos</option>
            <option value="NO CANCELADO">NO CANCELADO</option>
            <option value="CANCELADO">CANCELADO</option>
          </select>

          {/* Filter by Fecha */}
          <input
            type="date"
            value={selectedFecha}
            onChange={(e) => setSelectedFecha(e.target.value)}
            className="bg-slate-900 border border-slate-700/80 rounded-xl px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
            title="Filtrar por fecha"
          />

          {(searchQuery || selectedTecnico || selectedFecha || selectedEstadoGasto) && (
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedTecnico('');
                setSelectedFecha('');
                setSelectedEstadoGasto('');
              }}
              className="p-1.5 text-xs font-bold text-rose-400 hover:text-rose-300 bg-rose-950/40 border border-rose-900/60 rounded-xl flex items-center gap-1 transition-colors"
              title="Limpiar filtros"
            >
              <RotateCcw className="w-3 h-3" />
              <span className="hidden sm:inline">Limpiar</span>
            </button>
          )}

          <span className="text-[11px] font-bold text-slate-500 ml-auto hidden md:inline">
            {filteredActividades.length} de {actividades.length} actividades
          </span>
        </div>
      </div>

      {/* Mobile Column Tabs (Shows on Mobile / Small screens) */}
      <div className="md:hidden bg-[#0B1120] border-b border-slate-800 px-2 py-2 flex items-center gap-1.5 overflow-x-auto shrink-0 custom-scrollbar">
        <button
          onClick={() => setActiveTab('TODOS')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${
            activeTab === 'TODOS'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'bg-slate-850 text-slate-400 hover:text-slate-200 border border-slate-700/60'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Todos ({filteredActividades.length})</span>
        </button>

        {ALL_STATUSES.map(st => {
          const cfg = statusConfig[st];
          const isActive = activeTab === st;
          return (
            <button
              key={st}
              onClick={() => setActiveTab(st)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                isActive
                  ? `${cfg.badge} font-black ring-1 ring-white/20`
                  : 'bg-slate-850 text-slate-400 hover:text-slate-200 border border-slate-700/60'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${cfg.dot}`}></span>
              <span>{st} ({boardData[st].length})</span>
            </button>
          );
        })}
      </div>

      {/* Main Content - Responsive 3-Column Kanban Board */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden p-2 sm:p-4 md:p-6 flex custom-scrollbar">
        <div className={`flex gap-3 sm:gap-5 h-full w-full ${activeTab === 'TODOS' ? 'min-w-[850px] md:min-w-0' : 'min-w-0'}`}>
          
          {/* Render Columns */}
          {ALL_STATUSES.map(statusKey => {
            const isVisible = activeTab === 'TODOS' || activeTab === statusKey;
            if (!isVisible) return null;

            const cfg = statusConfig[statusKey];
            const colList = boardData[statusKey] || [];
            const isOver = dragOverColumn === statusKey;

            return (
              <div 
                key={statusKey}
                data-column-status={statusKey}
                className={`flex flex-col flex-1 bg-[#0f1523] border rounded-2xl overflow-hidden h-full transition-all ${
                  isOver 
                    ? `${cfg.border} ring-2 ring-indigo-500/50 bg-slate-900/60` 
                    : 'border-slate-800'
                }`}
                onDragOver={(e) => onDragOver(e, statusKey)}
                onDragLeave={onDragLeave}
                onDrop={(e) => onDrop(e, statusKey)}
              >
                <div className={`px-4 py-3 border-b-2 ${cfg.headerBorder} bg-slate-900/70 flex justify-between items-center shrink-0`}>
                  <div className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${cfg.dot}`}></span>
                    <h3 className="font-bold text-slate-100 text-xs sm:text-sm tracking-wider uppercase">{statusKey}</h3>
                  </div>
                  <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${cfg.badge}`}>
                    {colList.length}
                  </span>
                </div>

                <div className="flex-1 overflow-y-auto p-2.5 sm:p-4 custom-scrollbar flex flex-col gap-3 pb-16">
                  {colList.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-32 text-xs text-slate-500 font-medium border-2 border-dashed border-slate-800/80 rounded-2xl p-4 text-center">
                      <p>Sin actividades en {statusKey.toLowerCase()}</p>
                      <p className="text-[10px] text-slate-600 mt-1">Mueva o arrastre una tarjeta aquí</p>
                    </div>
                  ) : (
                    colList.map(renderCard)
                  )}
                </div>
              </div>
            );
          })}

        </div>
      </div>

      {/* Form Modal (Nueva / Editar Actividad) */}
      {showForm && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 z-50">
          <div className="bg-[#111827] rounded-2xl border border-slate-700 w-full max-w-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 max-h-[94vh]">
            {/* Modal Header */}
            <div className="flex justify-between items-center px-4 sm:px-6 py-3.5 border-b border-slate-800 bg-slate-850/60">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                  <CalendarIcon className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-white">
                    {editingAct ? 'Editar Actividad Diaria' : 'Nueva Actividad Diaria'}
                  </h2>
                  <p className="text-[11px] text-slate-400">Tabla: ACTIVIDADESDIARIAS</p>
                </div>
              </div>
              <button 
                onClick={() => setShowForm(false)} 
                className="text-slate-400 hover:text-white transition-colors p-1.5 hover:bg-slate-800 rounded-xl"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {/* Modal Body */}
            <div className="overflow-y-auto p-4 sm:p-6 custom-scrollbar">
              <form onSubmit={handleSave} className="flex flex-col gap-4 sm:gap-5">
                
                {/* ID & FECHA */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      ID (CORRELATIVO)
                    </label>
                    <input 
                      type="text" 
                      value={formData.ID || ''} 
                      disabled 
                      className="bg-slate-900 border border-slate-800 text-indigo-300 font-mono font-black text-xs sm:text-sm rounded-xl px-3.5 py-2.5 cursor-not-allowed shadow-inner" 
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                      <CalendarIcon className="w-3.5 h-3.5 text-indigo-400" />
                      <span>FECHA</span>
                      <span className="text-rose-400">*</span>
                    </label>
                    <div className="relative flex items-center">
                      <input 
                        type="text" 
                        required 
                        value={formData.FECHA || ''} 
                        onChange={e => setFormData({ ...formData, FECHA: e.target.value })} 
                        placeholder="DD/MM/AAAA"
                        className="w-full bg-slate-900 border border-slate-700 hover:border-slate-600 focus:border-indigo-500 text-white font-medium text-xs sm:text-sm rounded-xl pl-3.5 pr-11 py-2.5 outline-none shadow-inner transition-colors font-mono" 
                      />
                      
                      {/* Invisible picker overlay on the right icon to trigger native date picker seamlessly */}
                      <input 
                        ref={datePickerRef}
                        type="date"
                        value={parseLocalToInput(formData.FECHA || '')}
                        onChange={e => {
                          if (e.target.value) {
                            setFormData(prev => ({ ...prev, FECHA: formatDateToLocal(e.target.value) }));
                          }
                        }}
                        tabIndex={-1}
                        className="absolute right-0 top-0 bottom-0 w-11 opacity-0 cursor-pointer z-10"
                        title="Seleccionar en calendario"
                      />

                      <button
                        type="button"
                        onClick={handleOpenDatePicker}
                        className="absolute right-2.5 p-1 text-slate-400 hover:text-indigo-400 hover:bg-slate-800 rounded-lg transition-colors pointer-events-none"
                        title="Seleccionar en calendario"
                      >
                        <CalendarIcon className="w-4 h-4 text-slate-400" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* CREADO POR & ASIGNADO A (Custom Dropdown al estilo de la app) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <TecnicoDropdownSelect
                    label="CREADO POR"
                    value={formData['CREADO POR'] || ''}
                    onChange={(val) => setFormData(prev => ({ ...prev, 'CREADO POR': val }))}
                    tecnicos={tecnicos}
                    placeholder="Seleccione quien crea..."
                  />

                  <TecnicoDropdownSelect
                    label="ASIGNADO A"
                    value={formData['ASIGNADO A'] || ''}
                    onChange={(val) => setFormData(prev => ({ ...prev, 'ASIGNADO A': val }))}
                    tecnicos={tecnicos}
                    placeholder="Seleccione técnico asignado..."
                    required
                  />
                </div>

                {/* MOTIVO DE LA ACTIVIDAD */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-indigo-400" />
                    <span>MOTIVO DE LA ACTIVIDAD</span>
                    <span className="text-rose-400">*</span>
                  </label>
                  <textarea 
                    required 
                    rows={4}
                    value={formData['MOTIVO DE LA ACTIVIDAD'] || ''} 
                    onChange={e => setFormData({ ...formData, 'MOTIVO DE LA ACTIVIDAD': e.target.value })} 
                    className="bg-slate-900 border border-slate-700 text-white text-xs sm:text-sm rounded-xl p-3 focus:border-indigo-500 outline-none resize-y custom-scrollbar shadow-inner" 
                    placeholder="Ingrese detalladamente el motivo o tarea a realizar..." 
                  />
                </div>

                {/* CAMPOS ADICIONALES (SOLO AL EDITAR ACTIVIDAD EXISTENTE) */}
                {Boolean(editingAct) && (
                  <>
                {/* IDA & VUELTA */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1">
                      <ArrowUpRight className="w-3 h-3 text-amber-400" />
                      <span>IDA</span>
                    </label>
                    <input 
                      type="text" 
                      value={formData.IDA || ''} 
                      onChange={e => setFormData({ ...formData, IDA: e.target.value })} 
                      placeholder='Ejemplo: "VASSOSP-YAMAHA"'
                      className="bg-slate-900 border border-slate-700 text-white text-xs sm:text-sm rounded-xl px-3.5 py-2.5 focus:border-indigo-500 outline-none shadow-inner" 
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-1">
                      <ArrowDownLeft className="w-3 h-3 text-cyan-400" />
                      <span>VUELTA</span>
                    </label>
                    <input 
                      type="text" 
                      value={formData.VUELTA || ''} 
                      onChange={e => setFormData({ ...formData, VUELTA: e.target.value })} 
                      placeholder='Ejemplo: "YAMAHA-VASSOSP"'
                      className="bg-slate-900 border border-slate-700 text-white text-xs sm:text-sm rounded-xl px-3.5 py-2.5 focus:border-indigo-500 outline-none shadow-inner" 
                    />
                  </div>
                </div>

                {/* TRANACTI: SELECTOR DE MOVILIDAD Y SEGMENTOS DE RUTA */}
                <div className="bg-slate-950/80 p-4 rounded-2xl border border-slate-800 flex flex-col gap-3.5 shadow-inner">
                  {/* Selector Header */}
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      SELECTOR DE MOVILIDAD
                    </label>
                    <span className="text-[11px] font-medium text-indigo-400">
                      Haga clic para agregar
                    </span>
                  </div>

                  {/* Mobility Buttons Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
                    {[
                      { label: 'Taxi', type: 'Taxi' },
                      { label: 'Tren', type: 'Tren' },
                      { label: 'Metropolitano', type: 'Metropolitano' },
                      { label: 'Combi', type: 'Combi' },
                      { label: 'Motocar', type: 'Motocar' }
                    ].map((item) => (
                      <button
                        key={item.type}
                        type="button"
                        onClick={() => handleAddSegment(item.type)}
                        className={`flex items-center gap-2 p-2.5 rounded-xl border bg-slate-900/60 transition-all active:scale-95 cursor-pointer ${getTransportStyle(item.type)}`}
                      >
                        {getTransportIcon(item.type)}
                        <span className="text-xs font-bold text-slate-200">{item.label}</span>
                      </button>
                    ))}
                  </div>

                  {/* SEGMENTOS DE RUTA */}
                  <div className="mt-1 flex flex-col gap-2">
                    <div className="flex items-center justify-between border-t border-slate-800/80 pt-3">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                          SEGMENTOS DE RUTA
                        </span>
                        <span className="text-[10px] font-bold text-indigo-400 bg-indigo-950/60 border border-indigo-800/60 px-2 py-0.5 rounded-full">
                          {tranactiSegments.length} {tranactiSegments.length === 1 ? 'segmento' : 'segmentos'}
                        </span>
                      </div>
                      {tranactiSegments.length > 0 && (
                        <span className="text-xs font-mono font-bold text-amber-400">
                          Total Pasajes: S/. {tranactiSegments.reduce((acc, s) => acc + (parseFloat(s.PASAJE) || 0), 0).toFixed(2)}
                        </span>
                      )}
                    </div>

                    {tranactiSegments.length === 0 ? (
                      <div className="text-center py-4 px-3 bg-slate-900/40 rounded-xl border border-dashed border-slate-800 text-slate-500 text-xs">
                        No hay segmentos agregados. Haga clic en una de las movilidades arriba para agregar un segmento.
                      </div>
                    ) : (
                      <div className="flex flex-col gap-2 max-h-56 overflow-y-auto custom-scrollbar pr-1">
                        {tranactiSegments.map((seg) => (
                          <div 
                            key={seg.ID} 
                            className="flex items-center justify-between gap-2 p-2.5 bg-slate-900 border border-slate-800 rounded-xl hover:border-slate-700 transition-colors"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="font-['JetBrains_Mono'] text-[10px] font-black text-indigo-400 bg-indigo-950/80 px-2 py-0.5 rounded border border-indigo-800/60 shrink-0">
                                {seg.ID}
                              </span>
                              <div className="flex items-center gap-1.5 text-xs font-bold text-white">
                                {getTransportIcon(seg.MOVIL)}
                                <span>{seg.MOVIL}</span>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <div className="flex items-center bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1 focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500/30">
                                <span className="text-xs font-bold text-amber-400 mr-1.5 font-mono">S/</span>
                                <input
                                  type="number"
                                  step="0.10"
                                  min="0"
                                  value={seg.PASAJE}
                                  onChange={(e) => handleSegmentPasajeChange(seg.ID, e.target.value)}
                                  placeholder="0.00"
                                  className="w-20 bg-transparent text-white font-mono font-bold text-xs outline-none text-right placeholder:text-slate-600"
                                />
                              </div>

                              <button
                                type="button"
                                onClick={() => handleRemoveSegment(seg.ID)}
                                className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer"
                                title="Eliminar segmento"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* GASTOS: PASAJE, ADICIONAL, MONTO TOTAL */}
                <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800 flex flex-col gap-3">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-300">
                    <div className="flex items-center gap-2">
                      <DollarSign className="w-4 h-4 text-emerald-400" />
                      <span>Control de Gastos de Movilidad (Soles Peruanos)</span>
                    </div>
                    {tranactiSegments.length > 0 && (
                      <span className="text-[10px] font-normal text-slate-400">
                        Pasaje sumado de {tranactiSegments.length} {tranactiSegments.length === 1 ? 'segmento' : 'segmentos'}
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        GASTO DE PASAJE
                      </label>
                      <input 
                        type="text" 
                        value={formData['GASTO DE PASAJE'] ?? 'S/. 0.00'} 
                        onChange={e => handleCurrencyChange('GASTO DE PASAJE', e.target.value)} 
                        onBlur={() => handleCurrencyBlur('GASTO DE PASAJE')}
                        placeholder="Ej. S/. 3.00"
                        className="bg-slate-900 border border-slate-700 text-white font-mono font-bold text-xs sm:text-sm rounded-xl px-3 py-2.5 focus:border-indigo-500 outline-none shadow-inner" 
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        GASTO ADICIONAL
                      </label>
                      <input 
                        type="text" 
                        value={formData['GASTO ADICIONAL'] ?? 'S/. 0.00'} 
                        onChange={e => {
                          handleCurrencyChange('GASTO ADICIONAL', e.target.value);
                          recalcFromSegments(tranactiSegments, e.target.value);
                        }} 
                        onBlur={() => handleCurrencyBlur('GASTO ADICIONAL')}
                        placeholder="Ej. S/. 3.00"
                        className="bg-slate-900 border border-slate-700 text-white font-mono font-bold text-xs sm:text-sm rounded-xl px-3 py-2.5 focus:border-indigo-500 outline-none shadow-inner" 
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">
                        MONTO TOTAL
                      </label>
                      <input 
                        type="text" 
                        value={formData['MONTO TOTAL'] || 'S/. 0.00'} 
                        readOnly 
                        disabled
                        className="bg-emerald-950/30 border border-emerald-800/60 text-emerald-400 font-mono font-black text-xs sm:text-sm rounded-xl px-3 py-2.5 cursor-not-allowed shadow-inner" 
                      />
                    </div>
                  </div>
                </div>

                {/* ESTADO & ESTADO GASTO */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      ESTADO (Por defecto ASIGNADO)
                    </label>
                    <select 
                      required 
                      value={formData.ESTADO || 'ASIGNADO'} 
                      onChange={e => setFormData({ ...formData, ESTADO: e.target.value })} 
                      className="bg-slate-900 border border-slate-700 text-white text-xs sm:text-sm rounded-xl px-3.5 py-2.5 focus:border-indigo-500 outline-none"
                    >
                      <option value="ASIGNADO">ASIGNADO</option>
                      <option value="EN ATENCION">EN ATENCION</option>
                      <option value="CERRADO">CERRADO</option>
                    </select>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      ESTADO GASTO (Por defecto NO CANCELADO)
                    </label>
                    <select 
                      required 
                      value={formData['ESTADO GASTO'] || 'NO CANCELADO'} 
                      onChange={e => setFormData({ ...formData, 'ESTADO GASTO': e.target.value })} 
                      className="bg-slate-900 border border-slate-700 text-white text-xs sm:text-sm rounded-xl px-3.5 py-2.5 focus:border-indigo-500 outline-none"
                    >
                      <option value="NO CANCELADO">NO CANCELADO</option>
                      <option value="CANCELADO">CANCELADO</option>
                    </select>
                  </div>
                </div>
                  </>
                )}

                {/* Form Buttons */}
                <div className="flex flex-col gap-2 mt-4 pt-4 border-t border-slate-800">
                  <div className="flex gap-3">
                    <button 
                      type="button" 
                      onClick={() => setShowForm(false)} 
                      className="flex-1 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl transition-colors text-xs sm:text-sm cursor-pointer"
                    >
                      Cancelar
                    </button>
                    {(() => {
                      const isEditing = Boolean(editingAct);
                      const originalMotivo = (editingAct?.['MOTIVO DE LA ACTIVIDAD'] || editingAct?.ACTIVIDAD || '').trim();
                      const currentMotivo = (formData['MOTIVO DE LA ACTIVIDAD'] || '').trim();
                      const willSendWhatsApp = !isEditing || (originalMotivo !== currentMotivo);

                      return (
                        <button 
                          type="submit" 
                          disabled={isSaving} 
                          className="flex-1 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-600/50 text-white font-bold rounded-xl transition-transform active:scale-95 flex items-center justify-center gap-2 text-xs sm:text-sm shadow-lg shadow-indigo-600/30 cursor-pointer"
                        >
                          {isSaving ? (
                            <>
                              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                              <span>Guardando datos...</span>
                            </>
                          ) : (
                            <>
                              {willSendWhatsApp ? (
                                <MessageSquare className="w-4 h-4 text-emerald-300" />
                              ) : (
                                <Check className="w-4 h-4 text-indigo-300" />
                              )}
                              <span>GUARDAR ACTIVIDAD</span>
                            </>
                          )}
                        </button>
                      );
                    })()}
                  </div>
                  
                  {(() => {
                    const isEditing = Boolean(editingAct);
                    const originalMotivo = (editingAct?.['MOTIVO DE LA ACTIVIDAD'] || editingAct?.ACTIVIDAD || '').trim();
                    const currentMotivo = (formData['MOTIVO DE LA ACTIVIDAD'] || '').trim();
                    const willSendWhatsApp = !isEditing || (originalMotivo !== currentMotivo);

                    return willSendWhatsApp ? (
                      <div className="flex items-center justify-center gap-1.5 text-[11px] text-emerald-400 text-center px-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0"></span>
                        <span>
                          {isEditing ? (
                            <>Cambió el <strong>Motivo de la Actividad</strong>: notificará por WhatsApp a <strong>{formData['ASIGNADO A'] || 'el técnico'}</strong> y guardará en la tabla.</>
                          ) : (
                            <>Primero notificará por WhatsApp a <strong>{formData['ASIGNADO A'] || 'el técnico asignado'}</strong> y luego guardará en la tabla.</>
                          )}
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-400 text-center px-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-500 shrink-0"></span>
                        <span>El Motivo no cambió: solo se guardará la data en la tabla (sin enviar WhatsApp).</span>
                      </div>
                    );
                  })()}
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-[#111827] rounded-2xl border border-rose-900/50 w-full max-w-sm shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-5 sm:p-6 flex flex-col items-center text-center gap-3 sm:gap-4">
              <div className="w-12 h-12 bg-rose-900/30 rounded-2xl flex items-center justify-center text-rose-500 border border-rose-800/40">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-bold text-white mb-1">¿Eliminar Actividad?</h3>
                <p className="text-xs sm:text-sm text-slate-400">Esta acción no se puede deshacer.</p>
              </div>
              <div className="w-full bg-slate-900 rounded-xl p-3 text-left border border-slate-800 mt-1">
                <p className="text-xs font-bold text-slate-400">ID: <span className="text-slate-200 font-mono">{deleteConfirm.ID}</span></p>
                <p className="text-xs sm:text-sm text-slate-300 mt-1 line-clamp-2">
                  {deleteConfirm['MOTIVO DE LA ACTIVIDAD'] || deleteConfirm.ACTIVIDAD}
                </p>
              </div>
            </div>
            <div className="flex gap-2 p-3 sm:p-4 bg-slate-850/50 border-t border-slate-800">
              <button 
                onClick={() => setDeleteConfirm(null)} 
                disabled={isDeleting} 
                className="flex-1 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl transition-colors text-xs sm:text-sm"
              >
                Cancelar
              </button>
              <button 
                onClick={handleDelete} 
                disabled={isDeleting} 
                className="flex-1 px-3 py-2 bg-rose-600 hover:bg-rose-500 disabled:bg-rose-600/50 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2 text-xs sm:text-sm shadow-lg shadow-rose-900/30"
              >
                {isDeleting ? 'Eliminando...' : 'Sí, Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
