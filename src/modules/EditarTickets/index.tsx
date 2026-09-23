import { useEffect, useState } from 'react';
import { 
  fetchAppData, updateTicket, updateActividad, updateRepuesto, deleteRows, parseDateStringToTimestamp
} from '../../lib/googleApi';
import type { AppData, Ticket, Actividad, Repuesto } from '../../types';
import { Edit, Save, X, Search, Sparkles, Clock, History, Wrench, RotateCcw, CheckCircle2, AlertCircle, RefreshCw, Trash2 } from 'lucide-react';
import GoogleErrorCard from '../../components/GoogleErrorCard';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';

function toInputDateFormat(dateStr?: string): string {
  if (!dateStr) return '';
  const clean = dateStr.trim();
  const ts = parseDateStringToTimestamp(clean);
  if (ts !== null) {
    const d = new Date(ts);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
  return '';
}

function calculateTE(fhInicio: string, fhFin: string): string {
  if (!fhInicio || !fhFin) return '';
  const parseTime = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    if (isNaN(h) || isNaN(m)) return 0;
    return h * 60 + m;
  };
  const start = parseTime(fhInicio);
  const end = parseTime(fhFin);
  if (end <= start || start === 0 || end === 0) return '';
  const diff = end - start;
  const h = Math.floor(diff / 60);
  const m = diff % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export default function EditarTicketsModule() {
  const [data, setData] = useState<AppData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filters (Reactive in real-time)
  const [year, setYear] = useState('Todos');
  const [client, setClient] = useState('Todos');
  const [status, setStatus] = useState('Todos');
  const [type, setType] = useState('Todos');
  const [search, setSearch] = useState('');
  
  // Selection
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [ticketForm, setTicketForm] = useState<Partial<Ticket>>({});
  const [isSavingTicket, setIsSavingTicket] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  
  // Actividades
  const [editingActividad, setEditingActividad] = useState<Actividad | null>(null);
  const [actividadForm, setActividadForm] = useState<Partial<Actividad>>({});
  const [isSavingActividad, setIsSavingActividad] = useState(false);
  
  // Repuestos
  const [editingRepuesto, setEditingRepuesto] = useState<Repuesto | null>(null);
  const [repuestoForm, setRepuestoForm] = useState<Partial<Repuesto>>({});
  const [isSavingRepuesto, setIsSavingRepuesto] = useState(false);
  
  // AI Grammar
  const [isGrammarLoading, setIsGrammarLoading] = useState(false);
  const [originalSolucion, setOriginalSolucion] = useState<string | null>(null);

  // Sync state
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isDeletingDup, setIsDeletingDup] = useState(false);

  const loadData = async (isManualSync = false) => {
    if (isManualSync) setIsSyncing(true);
    else if (!data) setLoading(true);
    setError(null);
    try {
      const appData = await fetchAppData();
      setData(appData);
      setLastSyncTime(new Date().toLocaleTimeString());

      // If a ticket is currently selected, refresh its data directly from Google Sheets
      if (selectedTicket) {
        const fresh = appData.tickets.find(
          t => t.IDTICKET?.trim().toUpperCase() === selectedTicket.IDTICKET?.trim().toUpperCase()
        );
        if (fresh) {
          setSelectedTicket(fresh);
          setTicketForm({ ...fresh });
        }
      }

      if (isManualSync) {
        setSaveSuccess('¡Datos sincronizados exitosamente con Google Sheets!');
        setTimeout(() => setSaveSuccess(null), 5000);
      }
    } catch (e: any) {
      console.error(e);
      setError(e.message || 'Error cargando datos');
    } finally {
      setLoading(false);
      setIsSyncing(false);
    }
  };

  const handleDeleteDuplicateRow = async (dupRow: number) => {
    if (!selectedTicket || !confirm(`¿Estás seguro de eliminar la fila duplicada ${dupRow} en Google Sheets para el ticket ${selectedTicket.IDTICKET}?`)) return;
    setIsDeletingDup(true);
    setSaveError(null);
    try {
      await deleteRows('TICKET', [dupRow]);
      setSaveSuccess(`Fila duplicada ${dupRow} eliminada de Google Sheets.`);
      await loadData(false);
    } catch (err: any) {
      console.error(err);
      setSaveError(`Error al eliminar fila duplicada: ${err?.message || 'Error'}`);
    } finally {
      setIsDeletingDup(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  if (loading) {
    return (
      <div className="flex-1 w-full flex items-center justify-center p-8">
        <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex-1 w-full flex items-center justify-center p-8">
        <GoogleErrorCard error={error || 'No se pudieron cargar los datos'} onRetry={loadData} title="Error en Editar Tickets" />
      </div>
    );
  }

  // Card styles by ESTADO as requested:
  // ASIGNADO -> rojo
  // EN ATENCION -> naranja
  // PENDIENTE -> azul
  // CERRADO -> verde
  const getEstadoCardStyle = (estado?: string) => {
    const norm = (estado || '')
      .trim()
      .toUpperCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

    switch (norm) {
      case 'ASIGNADO':
        return {
          border: 'border-red-500 hover:border-red-400',
          borderSelected: 'border-red-500 ring-2 ring-red-500/70 shadow-lg shadow-red-950/50',
          badge: 'bg-red-950/80 text-red-300 border-red-700/80',
          dot: 'bg-red-500',
        };
      case 'EN ATENCION':
        return {
          border: 'border-orange-500 hover:border-orange-400',
          borderSelected: 'border-orange-500 ring-2 ring-orange-500/70 shadow-lg shadow-orange-950/50',
          badge: 'bg-orange-950/80 text-orange-300 border-orange-700/80',
          dot: 'bg-orange-500',
        };
      case 'PENDIENTE':
        return {
          border: 'border-blue-500 hover:border-blue-400',
          borderSelected: 'border-blue-500 ring-2 ring-blue-500/70 shadow-lg shadow-blue-950/50',
          badge: 'bg-blue-950/80 text-blue-300 border-blue-700/80',
          dot: 'bg-blue-500',
        };
      case 'CERRADO':
        return {
          border: 'border-emerald-500 hover:border-emerald-400',
          borderSelected: 'border-emerald-500 ring-2 ring-emerald-500/70 shadow-lg shadow-emerald-950/50',
          badge: 'bg-emerald-950/80 text-emerald-300 border-emerald-700/80',
          dot: 'bg-emerald-500',
        };
      default:
        return {
          border: 'border-slate-600 hover:border-slate-500',
          borderSelected: 'border-slate-400 ring-2 ring-slate-400/50',
          badge: 'bg-slate-800 text-slate-300 border-slate-700',
          dot: 'bg-slate-400',
        };
    }
  };

  // Derived filter options
  const uniqueClients = Array.from(new Set([
    ...data.tickets.map(t => (t.CLIENTE || '').trim()).filter(Boolean),
    ...data.empresas.map(e => (e.CLIENTE || '').trim()).filter(Boolean)
  ])).sort();

  const standardStatuses = ['ASIGNADO', 'EN ATENCION', 'PENDIENTE', 'CERRADO'];
  const uniqueStatus = Array.from(new Set([
    ...standardStatuses,
    ...data.tickets.map(t => (t.ESTADO || '').trim()).filter(Boolean)
  ]));

  const standardTypes = ['CONTRATO', 'FACTURABLE', 'GARANTIA DE SERVICIO', 'DIAGNOSTICO'];
  const uniqueTypes = Array.from(new Set([
    ...standardTypes,
    ...data.tickets.map(t => (t.TIPO || '').trim()).filter(Boolean)
  ]));

  const extractedYears = Array.from(new Set(
    data.tickets.map(t => {
      const m = (t.FHINGRESO || '').match(/\b(20\d{2})\b/)
        || (t.FHPROGRAMADA || '').match(/\b(20\d{2})\b/)
        || (t.DATEINICIO || '').match(/\b(20\d{2})\b/)
        || (t['FECHA DE CIERRE'] || '').match(/\b(20\d{2})\b/);
      return m ? m[1] : null;
    }).filter(Boolean) as string[]
  )).sort().reverse();

  const allYearOptions = extractedYears.length > 0 
    ? extractedYears 
    : ['2026', '2025', '2024', '2023'];

  const handleResetFilters = () => {
    setYear('Todos');
    setClient('Todos');
    setStatus('Todos');
    setType('Todos');
    setSearch('');
  };

  const filteredTickets = data.tickets.filter(t => {
    if (!t || !t.IDTICKET) return false;

    // Search ID filter: check against IDTICKET (direct substring and alphanumeric match)
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      const normQ = q.replace(/[^a-z0-9]/g, '');
      const id = (t.IDTICKET || '').trim().toLowerCase();
      const normId = id.replace(/[^a-z0-9]/g, '');
      
      const matchId = id.includes(q) || (normQ !== '' && normId.includes(normQ));
      const matchClient = (t.CLIENTE || '').toLowerCase().includes(q);
      const matchTecnico = (t.TECNICO || '').toLowerCase().includes(q);

      if (!matchId && !matchClient && !matchTecnico) {
        return false;
      }
    }

    // Year filter using regex matching for 4-digit years
    if (year !== 'Todos') {
      const m = (t.FHINGRESO || '').match(/\b(20\d{2})\b/)
        || (t.FHPROGRAMADA || '').match(/\b(20\d{2})\b/)
        || (t.DATEINICIO || '').match(/\b(20\d{2})\b/)
        || (t['FECHA DE CIERRE'] || '').match(/\b(20\d{2})\b/);
      const ticketYear = m ? m[1] : '';
      if (ticketYear !== year) return false;
    }

    // Client filter
    if (client !== 'Todos') {
      const normClient = client.trim().toUpperCase();
      const normTicketClient = (t.CLIENTE || '').trim().toUpperCase();
      if (normTicketClient !== normClient) return false;
    }

    // Status filter
    if (status !== 'Todos') {
      const normStatus = status.trim().toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const normTicketStatus = (t.ESTADO || '').trim().toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      if (normTicketStatus !== normStatus) return false;
    }

    // Type filter
    if (type !== 'Todos') {
      const normType = type.trim().toUpperCase();
      const normTicketType = (t.TIPO || '').trim().toUpperCase();
      if (normTicketType !== normType) return false;
    }

    return true;
  });

  const getUltimaActividad = (idTicket: string) => {
    if (!idTicket) return '-';
    const cleanId = idTicket.trim().toUpperCase();
    const acts = data.actividades.filter(a => (a.IDTICKET || '').trim().toUpperCase() === cleanId);
    if (!acts.length) return '-';
    return acts.map(a => a.FHFIN).filter(Boolean).sort().pop() || '-';
  };

  const handleSelectTicket = (t: Ticket) => {
    // Find freshest instance from data.tickets
    const fresh = data.tickets.find(
      x => (x.IDTICKET || '').trim().toUpperCase() === (t.IDTICKET || '').trim().toUpperCase()
    ) || t;
    const cloned = { ...fresh };
    setSelectedTicket(cloned);
    setTicketForm(cloned);
    setEditingActividad(null);
    setEditingRepuesto(null);
    setSaveSuccess(null);
    setSaveError(null);
  };

  // TICKETS UPDATE
  const isTicketDirty = Boolean(
    selectedTicket &&
    (
      (ticketForm.ESTADO || '') !== (selectedTicket.ESTADO || '') ||
      (ticketForm.PRIORIDAD || '') !== (selectedTicket.PRIORIDAD || '') ||
      (ticketForm.TIPO || '') !== (selectedTicket.TIPO || '') ||
      (ticketForm.TECNICO || '') !== (selectedTicket.TECNICO || '') ||
      (ticketForm.CLIENTE || '') !== (selectedTicket.CLIENTE || '') ||
      (ticketForm.DIRECCION || '') !== (selectedTicket.DIRECCION || '') ||
      (ticketForm.TELEFONO || '') !== (selectedTicket.TELEFONO || '') ||
      (ticketForm.CONTACTO || '') !== (selectedTicket.CONTACTO || '') ||
      (ticketForm['MODO DE ATENCION'] || '') !== (selectedTicket['MODO DE ATENCION'] || '') ||
      (ticketForm['FECHA DE CIERRE'] || '') !== (selectedTicket['FECHA DE CIERRE'] || '') ||
      (ticketForm.FHINGRESO || '') !== (selectedTicket.FHINGRESO || '') ||
      (ticketForm.FHPROGRAMADA || '') !== (selectedTicket.FHPROGRAMADA || '') ||
      (ticketForm.PROBLEMA || '') !== (selectedTicket.PROBLEMA || '') ||
      (ticketForm['ACTIVIDAD DEL TICKET'] || '') !== (selectedTicket['ACTIVIDAD DEL TICKET'] || '') ||
      (ticketForm.OBSERVACIONES || '') !== (selectedTicket.OBSERVACIONES || '')
    )
  );

  const handleUpdateTicket = async () => {
    if (!selectedTicket || !ticketForm.IDTICKET) return;
    setIsSavingTicket(true);
    setSaveSuccess(null);
    setSaveError(null);
    try {
      const targetRow = selectedTicket._rowIndex;
      const updated: Ticket = { 
        ...selectedTicket, 
        ...ticketForm,
        IDTICKET: selectedTicket.IDTICKET 
      };

      const result = await updateTicket(targetRow, updated);
      const actualRow = result?.targetRow || targetRow;
      (updated as any)._rowIndex = actualRow;

      const index = data.tickets.findIndex(
        t => t.IDTICKET?.trim().toUpperCase() === selectedTicket.IDTICKET?.trim().toUpperCase()
      );
      if (index >= 0) {
        data.tickets[index] = { ...data.tickets[index], ...updated };
      } else {
        data.tickets.push(updated);
      }

      setData({ ...data });
      setSelectedTicket(updated);
      setTicketForm(updated);

      if (result && result.updatedFields && result.updatedFields.length > 0) {
        setSaveSuccess(`¡Ticket ${updated.IDTICKET} actualizado en la misma fila ${actualRow}! Solo se modificó la data cambiada (${result.updatedFields.join(', ')}). No se crearon filas.`);
      } else {
        setSaveSuccess(`¡Ticket ${updated.IDTICKET} en la fila ${actualRow} ya está al día! No se detectaron cambios pendientes.`);
      }
      setTimeout(() => setSaveSuccess(null), 8000);
    } catch(e: any) {
      console.error('Error al actualizar ticket:', e);
      const msg = e?.message || 'Error al actualizar ticket en Google Sheets';
      setSaveError(msg);
    } finally {
      setIsSavingTicket(false);
    }
  };

  // ACTIVIDADES UPDATE
  const handleEditActividad = (act: Actividad) => {
    setEditingActividad(act);
    setActividadForm(act);
    setOriginalSolucion(act.SOLUCION || '');
  };

  const handleUpdateActividad = async () => {
    if (!editingActividad || !actividadForm.IDACTIVIDADES) return;
    
    // validate fhfin > fhinicio
    if (actividadForm.FHINICIO && actividadForm.FHFIN) {
        const te = calculateTE(actividadForm.FHINICIO, actividadForm.FHFIN);
        if (!te) {
          setSaveError('La Hora de Fin (FHFIN) debe ser mayor que la Hora de Inicio (FHINICIO).');
          return;
        }
        actividadForm.TE = te;
    }

    setIsSavingActividad(true);
    setSaveError(null);
    try {
      const index = data.actividades.findIndex(
        a => a.IDACTIVIDADES?.trim().toUpperCase() === editingActividad.IDACTIVIDADES?.trim().toUpperCase()
      );
      if (index >= 0) {
        const updated = { ...editingActividad, ...actividadForm };
        await updateActividad(editingActividad._rowIndex, updated);
        data.actividades[index] = updated as Actividad;
        
        // Recalculate ticket's SUMAXH if needed
        if (selectedTicket?.ESTADO === 'CERRADO') {
            const ticketActs = data.actividades.filter(a => a.IDTICKET === selectedTicket.IDTICKET);
            let totalMins = 0;
            ticketActs.forEach(a => {
                if (a.TE) {
                    const [h, m] = a.TE.split(':').map(Number);
                    if (!isNaN(h) && !isNaN(m)) totalMins += h * 60 + m;
                }
            });
            const th = Math.floor(totalMins / 60);
            const tm = totalMins % 60;
            const newSuma = `${String(th).padStart(2, '0')}:${String(tm).padStart(2, '0')}`;
            
            const tIndex = data.tickets.findIndex(
              t => t.IDTICKET?.trim().toUpperCase() === selectedTicket.IDTICKET?.trim().toUpperCase()
            );
            if (tIndex >= 0) {
                const updatedTicket = { ...selectedTicket, SUMAXH: newSuma };
                await updateTicket(selectedTicket._rowIndex, updatedTicket);
                data.tickets[tIndex] = updatedTicket as Ticket;
                setSelectedTicket(updatedTicket as Ticket);
                setTicketForm(updatedTicket as Ticket);
            }
        }

        setData({ ...data });
        setEditingActividad(null);
        setSaveSuccess(`Actividad ${editingActividad.IDACTIVIDADES} guardada exitosamente en Google Sheets`);
        setTimeout(() => setSaveSuccess(null), 6000);
      }
    } catch(e: any) {
      console.error(e);
      setSaveError('Error al actualizar actividad en Google Sheets: ' + (e?.message || 'Error desconocido'));
    } finally {
      setIsSavingActividad(false);
    }
  };

  const handleGrammarCheck = async () => {
    if (!actividadForm.SOLUCION) return;
    setIsGrammarLoading(true);
    try {
      const res = await fetch('/api/grammar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: actividadForm.SOLUCION })
      });
      if (!res.ok) throw new Error('Error al conectar con la IA');
      const json = await res.json();
      if (json.text) {
        setActividadForm({ ...actividadForm, SOLUCION: json.text.trim() });
      }
    } catch (e: any) {
      console.error(e);
      setSaveError('Fallo al corregir texto: ' + e.message);
    } finally {
      setIsGrammarLoading(false);
    }
  };

  // REPUESTOS UPDATE
  const handleEditRepuesto = (rep: Repuesto) => {
    setEditingRepuesto(rep);
    setRepuestoForm(rep);
  };

  const handleUpdateRepuesto = async () => {
    if (!editingRepuesto || !repuestoForm.IDREPUESTO) return;
    setIsSavingRepuesto(true);
    setSaveError(null);
    try {
      const index = data.repuestos.findIndex(
        r => r.IDREPUESTO?.trim().toUpperCase() === editingRepuesto.IDREPUESTO?.trim().toUpperCase()
      );
      if (index >= 0) {
        const updated = { ...editingRepuesto, ...repuestoForm };
        await updateRepuesto(editingRepuesto._rowIndex, updated);
        data.repuestos[index] = updated as Repuesto;
        setData({ ...data });
        setEditingRepuesto(null);
        setSaveSuccess(`Repuesto ${editingRepuesto.IDREPUESTO} guardado exitosamente en Google Sheets`);
        setTimeout(() => setSaveSuccess(null), 6000);
      }
    } catch(e: any) {
      console.error(e);
      setSaveError('Error al actualizar repuesto en Google Sheets: ' + (e?.message || 'Error desconocido'));
    } finally {
      setIsSavingRepuesto(false);
    }
  };

  const ticketActividades = selectedTicket 
    ? data.actividades.filter(a => (a.IDTICKET || '').trim().toUpperCase() === (selectedTicket.IDTICKET || '').trim().toUpperCase()) 
    : [];
  const ticketRepuestos = selectedTicket 
    ? data.repuestos.filter(r => (r.IDTICKET || '').trim().toUpperCase() === (selectedTicket.IDTICKET || '').trim().toUpperCase()) 
    : [];

  return (
    <div className="w-full h-full max-w-[1600px] mx-auto flex flex-col gap-6 text-white overflow-hidden p-2">
      
      {/* FILTROS */}
      <div className="bg-slate-900/80 backdrop-blur-md rounded-3xl p-6 shadow-2xl border border-slate-700 shrink-0">
        <div className="flex flex-col lg:flex-row gap-4 items-end">
          <div className="flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-400 uppercase">Año</label>
              <select 
                value={year} 
                onChange={e => setYear(e.target.value)} 
                className="bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-sm outline-none focus:border-blue-500"
              >
                <option value="Todos">Todos</option>
                {allYearOptions.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-400 uppercase">Cliente</label>
              <select 
                value={client} 
                onChange={e => setClient(e.target.value)} 
                className="bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-sm outline-none focus:border-blue-500"
              >
                <option value="Todos">Todos</option>
                {uniqueClients.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-400 uppercase">Estado</label>
              <select 
                value={status} 
                onChange={e => setStatus(e.target.value)} 
                className="bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-sm outline-none focus:border-blue-500"
              >
                <option value="Todos">Todos</option>
                {uniqueStatus.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-400 uppercase">Tipo</label>
              <select 
                value={type} 
                onChange={e => setType(e.target.value)} 
                className="bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-sm outline-none focus:border-blue-500"
              >
                <option value="Todos">Todos</option>
                {uniqueTypes.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-400 uppercase">Buscar ID</label>
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input 
                  value={search} 
                  onChange={e => setSearch(e.target.value)}
                  placeholder="ID de ticket..."
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-8 py-2.5 text-sm focus:border-blue-500 outline-none"
                />
                {search && (
                  <button 
                    onClick={() => setSearch('')}
                    title="Limpiar búsqueda"
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={handleResetFilters}
              title="Restablecer todos los filtros"
              className="bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white px-4 py-2.5 rounded-xl font-bold h-[42px] transition-colors whitespace-nowrap text-sm border border-slate-700 flex items-center gap-1.5"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Limpiar Filtros</span>
            </button>
            <button 
              onClick={() => loadData(true)}
              disabled={loading || isSyncing}
              title="Sincronizar datos directamente con tu tabla en Google Sheets"
              className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2.5 rounded-xl font-bold h-[42px] transition-all whitespace-nowrap text-sm border border-blue-500 flex items-center gap-2 shadow-lg shadow-blue-600/30 hover:shadow-blue-500/50 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isSyncing || loading ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'Sincronizando...' : 'Sincronizar'}</span>
              {lastSyncTime && (
                <span className="text-[11px] bg-blue-800/80 text-blue-200 px-1.5 py-0.5 rounded font-mono font-normal">
                  {lastSyncTime}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 overflow-hidden min-h-0">
        
        {/* LISTADO DE TICKETS */}
        <div className="lg:col-span-3 bg-slate-900/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl flex flex-col overflow-hidden">
          <div className="p-4 border-b border-slate-700/50 flex justify-between items-center">
            <div>
              <h2 className="font-bold text-lg">Tickets Encontrados</h2>
              <p className="text-[11px] text-slate-400">
                {filteredTickets.length} de {data.tickets.length} tickets
              </p>
            </div>
            <span className="bg-blue-900/50 text-blue-300 text-xs px-2.5 py-1 rounded-full font-bold border border-blue-800/60">
              {filteredTickets.length}
            </span>
          </div>
          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 custom-scrollbar">
            {filteredTickets.map(t => {
              const isSelected = selectedTicket?.IDTICKET === t.IDTICKET;
              const cardStyle = getEstadoCardStyle(t.ESTADO);
              return (
                <div 
                  key={`${t.IDTICKET}_${t._rowIndex}`} 
                  onClick={() => handleSelectTicket(t)}
                  className={`p-4 rounded-xl border-2 cursor-pointer transition-all duration-150 ${
                    isSelected 
                      ? `${cardStyle.borderSelected} bg-slate-800/90` 
                      : `${cardStyle.border} bg-slate-800/40 hover:bg-slate-800/70`
                  }`}
                >
                  <div className="flex justify-between items-start mb-2 gap-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={`w-2.5 h-2.5 rounded-full ${cardStyle.dot} shrink-0`} />
                      <h3 className="font-bold text-sm text-white font-mono">{t.IDTICKET}</h3>
                      {t._rowIndex && (
                        <span className="text-[10px] bg-slate-900/90 text-slate-400 px-1.5 py-0.5 rounded border border-slate-700 font-mono" title={`Fila ${t._rowIndex} en la hoja TICKET`}>
                          Fila {t._rowIndex}
                        </span>
                      )}
                    </div>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border shrink-0 ${cardStyle.badge}`}>
                      {t.ESTADO || 'SIN ESTADO'}
                    </span>
                  </div>
                  <div className="text-xs text-slate-300 flex flex-col gap-1">
                    <p className="font-medium text-white line-clamp-1">{t.CLIENTE || '-'}</p>
                    <p className="text-slate-400">{t.TIPO || '-'}</p>
                    <p>Téc: <span className="text-amber-400">{t.TECNICO || '-'}</span></p>
                    <p className="text-[10px] text-slate-500 mt-1">Última act: {getUltimaActividad(t.IDTICKET)}</p>
                  </div>
                </div>
              );
            })}
            {filteredTickets.length === 0 && (
              <div className="text-slate-400 text-center text-sm py-8 px-4 flex flex-col items-center gap-3">
                <Search className="w-8 h-8 text-slate-600" />
                <p>No se encontraron tickets con los filtros actuales</p>
                {(year !== 'Todos' || client !== 'Todos' || status !== 'Todos' || type !== 'Todos' || search) && (
                  <button 
                    onClick={handleResetFilters}
                    className="text-xs bg-slate-800 hover:bg-slate-700 text-blue-400 border border-slate-700 px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Restablecer todos los filtros
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* DETALLE Y EDICIÓN */}
        <div className="lg:col-span-9 bg-slate-900/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl flex flex-col overflow-hidden">
          {!selectedTicket ? (
            <div className="flex-1 flex items-center justify-center text-slate-500 flex-col gap-4">
              <Edit className="w-12 h-12 opacity-50" />
              <p>Seleccione un ticket para editar</p>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-8 custom-scrollbar">
              
              {/* TICKET FORM */}
              <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 relative">
                <div className="flex justify-between items-center mb-6">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-xl font-bold flex items-center gap-2">
                      <Edit className="w-5 h-5 text-blue-400"/> Editar Ticket: <span className="text-blue-400">{selectedTicket.IDTICKET}</span>
                    </h3>
                    {selectedTicket._rowIndex && (
                      <span className="text-xs bg-slate-800 text-slate-300 border border-slate-700 px-2.5 py-0.5 rounded-full font-mono">
                        Fila en Hoja TICKET: {selectedTicket._rowIndex}
                      </span>
                    )}
                    {selectedTicket.ESTADO === 'CERRADO' && (
                      <span className="text-xs bg-red-900/30 text-red-400 border border-red-800 px-2 py-0.5 rounded-full">
                        TICKET CERRADO (Edición Excepcional)
                      </span>
                    )}
                    {isTicketDirty && (
                      <span className="text-xs bg-amber-500/20 text-amber-300 border border-amber-500/50 px-2.5 py-0.5 rounded-full animate-pulse font-medium flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5" /> Cambios sin guardar
                      </span>
                    )}
                  </div>
                  <button 
                    onClick={handleUpdateTicket}
                    disabled={isSavingTicket}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold transition-all text-sm disabled:opacity-50 ${
                      isTicketDirty 
                        ? 'bg-emerald-600 hover:bg-emerald-500 text-white ring-2 ring-emerald-400/60 shadow-lg shadow-emerald-950/50' 
                        : 'bg-blue-600 hover:bg-blue-500 text-white'
                    }`}
                  >
                    <Save className="w-4 h-4" />
                    {isSavingTicket ? 'Actualizando en Sheets...' : isTicketDirty ? 'Guardar Cambios' : 'Actualizar Ticket'}
                  </button>
                </div>

                {saveSuccess && (
                  <div className="mb-6 p-4 bg-emerald-500/20 border border-emerald-500/50 text-emerald-300 rounded-xl flex items-center gap-3 text-sm">
                    <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-400" />
                    <span className="font-semibold">{saveSuccess}</span>
                  </div>
                )}
                {saveError && (
                  <div className="mb-6 p-4 bg-red-500/20 border border-red-500/50 text-red-300 rounded-xl flex items-center gap-3 text-sm">
                    <AlertCircle className="w-5 h-5 shrink-0 text-red-400" />
                    <span>{saveError}</span>
                  </div>
                )}

                {selectedTicket._duplicateRows && selectedTicket._duplicateRows.length > 0 && (
                  <div className="mb-6 p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs text-amber-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-inner">
                    <div className="flex items-center gap-2.5">
                      <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                      <div>
                        <p className="font-bold text-amber-300">Fila duplicada en Google Sheets (Hoja TICKET)</p>
                        <p className="text-slate-300 mt-0.5">
                          Este ticket está en la <strong className="text-emerald-400">Fila {selectedTicket._rowIndex}</strong> (activa y sincronizada) y también existe en la <strong className="text-amber-300">Fila {selectedTicket._duplicateRows.join(', ')}</strong>. Al guardar cambios se sincronizarán ambas.
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteDuplicateRow(selectedTicket._duplicateRows![0])}
                      disabled={isDeletingDup}
                      className="px-3 py-1.5 bg-red-500/20 hover:bg-red-600/40 text-red-300 hover:text-white border border-red-500/40 rounded-lg font-bold flex items-center gap-1.5 transition-colors shrink-0 whitespace-nowrap self-end sm:self-auto"
                      title="Eliminar la fila sobrante en Google Sheets para que solo quede la fila original"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>{isDeletingDup ? 'Eliminando fila...' : `Eliminar fila ${selectedTicket._duplicateRows[0]}`}</span>
                    </button>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs text-slate-400 font-bold uppercase">IDTICKET</label>
                    <input readOnly value={ticketForm.IDTICKET || ''} className="bg-slate-900/50 border border-slate-700 rounded-lg p-2.5 text-sm text-slate-400 font-mono font-bold" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs text-slate-400 font-bold uppercase">FHINGRESO</label>
                    <input 
                      type="date" 
                      value={toInputDateFormat(ticketForm.FHINGRESO)} 
                      onChange={e => {
                        const val = e.target.value;
                        if (!val) {
                          setTicketForm({...ticketForm, FHINGRESO: ''});
                          return;
                        }
                        const timePart = ticketForm.FHINGRESO && ticketForm.FHINGRESO.includes(' ') 
                          ? ' ' + ticketForm.FHINGRESO.split(' ').slice(1).join(' ') 
                          : '';
                        const [y, m, d] = val.split('-');
                        setTicketForm({...ticketForm, FHINGRESO: `${d}/${m}/${y}${timePart}`});
                      }} 
                      className="bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-sm" 
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs text-slate-400 font-bold uppercase">FHPROGRAMADA</label>
                    <input 
                      type="date" 
                      value={toInputDateFormat(ticketForm.FHPROGRAMADA)} 
                      onChange={e => {
                        const val = e.target.value;
                        if (!val) {
                          setTicketForm({...ticketForm, FHPROGRAMADA: ''});
                          return;
                        }
                        const [y, m, d] = val.split('-');
                        setTicketForm({...ticketForm, FHPROGRAMADA: `${d}/${m}/${y}`});
                      }} 
                      className="bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-sm" 
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs text-slate-400 font-bold uppercase">CLIENTE</label>
                    <select 
                      value={ticketForm.CLIENTE || ''} 
                      onChange={e => setTicketForm({...ticketForm, CLIENTE: e.target.value})} 
                      className="bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-sm"
                    >
                      <option value="">Seleccione...</option>
                      {ticketForm.CLIENTE && !uniqueClients.includes(ticketForm.CLIENTE) && (
                        <option value={ticketForm.CLIENTE}>{ticketForm.CLIENTE}</option>
                      )}
                      {uniqueClients.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div className="flex flex-col gap-1.5"><label className="text-xs text-slate-400 font-bold uppercase">CONTACTO</label><input value={ticketForm.CONTACTO || ''} onChange={e => setTicketForm({...ticketForm, CONTACTO: e.target.value})} className="bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-sm" /></div>
                  <div className="flex flex-col gap-1.5"><label className="text-xs text-slate-400 font-bold uppercase">TELÉFONO</label><input value={ticketForm.TELEFONO || ''} onChange={e => setTicketForm({...ticketForm, TELEFONO: e.target.value})} className="bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-sm" /></div>
                  <div className="flex flex-col gap-1.5 lg:col-span-3"><label className="text-xs text-slate-400 font-bold uppercase">DIRECCIÓN</label><input value={ticketForm.DIRECCION || ''} onChange={e => setTicketForm({...ticketForm, DIRECCION: e.target.value})} className="bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-sm" /></div>
                  
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs text-slate-400 font-bold uppercase">ESTADO</label>
                    <select 
                      value={ticketForm.ESTADO || ''} 
                      onChange={e => setTicketForm({...ticketForm, ESTADO: e.target.value})} 
                      className="bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-sm"
                    >
                      {ticketForm.ESTADO && !['ASIGNADO', 'EN ATENCION', 'PENDIENTE', 'CERRADO'].includes(ticketForm.ESTADO) && (
                        <option value={ticketForm.ESTADO}>{ticketForm.ESTADO}</option>
                      )}
                      <option value="ASIGNADO">ASIGNADO</option>
                      <option value="EN ATENCION">EN ATENCION</option>
                      <option value="PENDIENTE">PENDIENTE</option>
                      <option value="CERRADO">CERRADO</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs text-slate-400 font-bold uppercase">PRIORIDAD</label>
                    <select 
                      value={ticketForm.PRIORIDAD || ''} 
                      onChange={e => setTicketForm({...ticketForm, PRIORIDAD: e.target.value})} 
                      className="bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-sm"
                    >
                      {ticketForm.PRIORIDAD && !['BAJA', 'MEDIA', 'ALTA'].includes(ticketForm.PRIORIDAD) && (
                        <option value={ticketForm.PRIORIDAD}>{ticketForm.PRIORIDAD}</option>
                      )}
                      <option value="BAJA">BAJA</option>
                      <option value="MEDIA">MEDIA</option>
                      <option value="ALTA">ALTA</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs text-slate-400 font-bold uppercase">TIPO</label>
                    <select 
                      value={ticketForm.TIPO || ''} 
                      onChange={e => setTicketForm({...ticketForm, TIPO: e.target.value})} 
                      className="bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-sm"
                    >
                      {ticketForm.TIPO && !['CONTRATO', 'FACTURABLE', 'GARANTIA DE SERVICIO', 'DIAGNOSTICO'].includes(ticketForm.TIPO) && (
                        <option value={ticketForm.TIPO}>{ticketForm.TIPO}</option>
                      )}
                      <option value="CONTRATO">CONTRATO</option>
                      <option value="FACTURABLE">FACTURABLE</option>
                      <option value="GARANTIA DE SERVICIO">GARANTIA DE SERVICIO</option>
                      <option value="DIAGNOSTICO">DIAGNOSTICO</option>
                    </select>
                  </div>
                  
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs text-slate-400 font-bold uppercase">TÉCNICO</label>
                    <select 
                      value={ticketForm.TECNICO || ''} 
                      onChange={e => {
                        const techName = e.target.value;
                        const techObj = data.tecnicos.find(t => (t.NOMBRE || '').trim().toUpperCase() === techName.trim().toUpperCase());
                        setTicketForm({
                          ...ticketForm, 
                          TECNICO: techName,
                          FIRMATECH: techObj ? techObj.FIRMATECH : (ticketForm.FIRMATECH || '')
                        });
                      }} 
                      className="bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-sm"
                    >
                      <option value="">Seleccione...</option>
                      {ticketForm.TECNICO && !data.tecnicos.some(t => (t.NOMBRE || '').trim().toUpperCase() === ticketForm.TECNICO?.trim().toUpperCase()) && (
                        <option value={ticketForm.TECNICO}>{ticketForm.TECNICO}</option>
                      )}
                      {data.tecnicos.map(t => <option key={t.ID || t.NOMBRE} value={t.NOMBRE}>{t.NOMBRE}</option>)}
                    </select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs text-slate-400 font-bold uppercase">MODO DE ATENCION</label>
                    <select 
                      value={ticketForm['MODO DE ATENCION'] || ''} 
                      onChange={e => setTicketForm({...ticketForm, 'MODO DE ATENCION': e.target.value})} 
                      className="bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-sm"
                    >
                      {ticketForm['MODO DE ATENCION'] && !['PRESENCIAL', 'REMOTO', 'LABORATORIO'].includes(ticketForm['MODO DE ATENCION']) && (
                        <option value={ticketForm['MODO DE ATENCION']}>{ticketForm['MODO DE ATENCION']}</option>
                      )}
                      <option value="PRESENCIAL">PRESENCIAL</option>
                      <option value="REMOTO">REMOTO</option>
                      <option value="LABORATORIO">LABORATORIO</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs text-slate-400 font-bold uppercase">FECHA DE CIERRE</label>
                    <input 
                      type="date" 
                      value={toInputDateFormat(ticketForm['FECHA DE CIERRE'])} 
                      onChange={e => {
                        const val = e.target.value;
                        if (!val) {
                          setTicketForm({...ticketForm, 'FECHA DE CIERRE': ''});
                          return;
                        }
                        const [y, m, d] = val.split('-');
                        setTicketForm({...ticketForm, 'FECHA DE CIERRE': `${d}/${m}/${y}`});
                      }} 
                      className="bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-sm" 
                    />
                  </div>
                  <div className="flex flex-col gap-1.5 lg:col-span-3"><label className="text-xs text-slate-400 font-bold uppercase">PROBLEMA</label><textarea value={ticketForm.PROBLEMA || ''} onChange={e => setTicketForm({...ticketForm, PROBLEMA: e.target.value})} className="bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-sm min-h-[60px]" /></div>
                  <div className="flex flex-col gap-1.5 lg:col-span-3"><label className="text-xs text-slate-400 font-bold uppercase">ACTIVIDAD DEL TICKET</label><textarea value={ticketForm['ACTIVIDAD DEL TICKET'] || ''} onChange={e => setTicketForm({...ticketForm, 'ACTIVIDAD DEL TICKET': e.target.value})} className="bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-sm min-h-[60px]" /></div>
                  <div className="flex flex-col gap-1.5 lg:col-span-3"><label className="text-xs text-slate-400 font-bold uppercase">OBSERVACIONES</label><textarea value={ticketForm.OBSERVACIONES || ''} onChange={e => setTicketForm({...ticketForm, OBSERVACIONES: e.target.value})} className="bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-sm min-h-[60px]" /></div>

                  {/* BOTTOM ACTION BAR */}
                  <div className="lg:col-span-3 pt-4 mt-2 border-t border-slate-700/60 flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                      {isTicketDirty ? (
                        <span className="text-xs text-amber-400 flex items-center gap-1.5 font-medium">
                          <AlertCircle className="w-4 h-4 text-amber-400" /> Hay cambios sin guardar. Haz clic en "Guardar Ticket" para actualizar la tabla TICKET en Google Sheets.
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400 flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Los datos mostrados coinciden con la tabla TICKET.
                        </span>
                      )}
                    </div>
                    <button 
                      onClick={handleUpdateTicket}
                      disabled={isSavingTicket}
                      className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold transition-all text-sm disabled:opacity-50 ${
                        isTicketDirty 
                          ? 'bg-emerald-600 hover:bg-emerald-500 text-white ring-2 ring-emerald-400/70 shadow-lg shadow-emerald-950/50' 
                          : 'bg-blue-600 hover:bg-blue-500 text-white'
                      }`}
                    >
                      <Save className="w-4 h-4" />
                      {isSavingTicket ? 'Guardando en Google Sheets...' : isTicketDirty ? 'Guardar Cambios en TICKET' : 'Actualizar Ticket'}
                    </button>
                  </div>
                </div>
              </div>

              {/* ACTIVIDADES E HISTORIAL */}
              <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
                <div className="flex items-center gap-2 mb-6">
                  <History className="w-5 h-5 text-emerald-400" />
                  <h3 className="text-xl font-bold">Historial de Actividades</h3>
                </div>
                
                {editingActividad ? (
                  <div className="bg-slate-900 border border-emerald-800/50 rounded-xl p-5 relative mb-6">
                    <button onClick={() => setEditingActividad(null)} className="absolute top-4 right-4 text-slate-400 hover:text-white"><X className="w-5 h-5"/></button>
                    <h4 className="font-bold text-emerald-400 mb-4 flex items-center gap-2">Editando Actividad: {editingActividad.IDACTIVIDADES}</h4>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      <div className="flex flex-col gap-1.5"><label className="text-xs text-slate-400 font-bold uppercase">IDACTIVIDADES</label><input readOnly value={actividadForm.IDACTIVIDADES || ''} className="bg-slate-800/50 border border-slate-700 rounded-lg p-2 text-sm text-slate-500" /></div>
                      <div className="flex flex-col gap-1.5"><label className="text-xs text-slate-400 font-bold uppercase">IDTICKET</label><input readOnly value={actividadForm.IDTICKET || ''} className="bg-slate-800/50 border border-slate-700 rounded-lg p-2 text-sm text-slate-500" /></div>
                      <div className="flex flex-col gap-1.5"><label className="text-xs text-slate-400 font-bold uppercase">FHINICIO (HH:mm)</label><input type="time" value={actividadForm.FHINICIO || ''} onChange={e => {
                          const val = e.target.value; setActividadForm(prev => ({...prev, FHINICIO: val, TE: calculateTE(val, prev.FHFIN || '')}));
                        }} className="bg-slate-800 border border-slate-700 rounded-lg p-2 text-sm" /></div>
                      <div className="flex flex-col gap-1.5"><label className="text-xs text-slate-400 font-bold uppercase">FHFIN (HH:mm)</label><input type="time" value={actividadForm.FHFIN || ''} onChange={e => {
                          const val = e.target.value; setActividadForm(prev => ({...prev, FHFIN: val, TE: calculateTE(prev.FHINICIO || '', val)}));
                        }} className="bg-slate-800 border border-slate-700 rounded-lg p-2 text-sm" /></div>
                      
                      <div className="flex flex-col gap-1.5"><label className="text-xs text-slate-400 font-bold uppercase flex justify-between">TE (Tiempo Eficaz) <Clock className="w-3 h-3 text-emerald-400"/></label><input readOnly value={actividadForm.TE || ''} className="bg-slate-800/50 border border-emerald-900/50 rounded-lg p-2 text-sm text-emerald-400 font-bold" /></div>
                      <div className="flex flex-col gap-1.5"><label className="text-xs text-slate-400 font-bold uppercase">TIPO</label><input value={actividadForm.TIPO || ''} onChange={e => setActividadForm({...actividadForm, TIPO: e.target.value})} className="bg-slate-800 border border-slate-700 rounded-lg p-2 text-sm" /></div>
                      <div className="flex flex-col gap-1.5"><label className="text-xs text-slate-400 font-bold uppercase">TÉCNICO</label>
                        <select value={actividadForm.TECNICO || ''} onChange={e => setActividadForm({...actividadForm, TECNICO: e.target.value})} className="bg-slate-800 border border-slate-700 rounded-lg p-2 text-sm">
                            <option value="">Seleccione...</option>
                            {actividadForm.TECNICO && !data.tecnicos.some(t => (t.NOMBRE || '').trim().toUpperCase() === actividadForm.TECNICO?.trim().toUpperCase()) && (
                              <option value={actividadForm.TECNICO}>{actividadForm.TECNICO}</option>
                            )}
                            {data.tecnicos.map(t => <option key={t.ID || t.NOMBRE} value={t.NOMBRE}>{t.NOMBRE}</option>)}
                        </select>
                      </div>
                      <div className="flex flex-col gap-1.5"><label className="text-xs text-slate-400 font-bold uppercase">USUARIO</label><input value={actividadForm.USUARIO || ''} onChange={e => setActividadForm({...actividadForm, USUARIO: e.target.value})} className="bg-slate-800 border border-slate-700 rounded-lg p-2 text-sm" /></div>
                      <div className="flex flex-col gap-1.5"><label className="text-xs text-slate-400 font-bold uppercase">ÁREA</label><input value={actividadForm.AREA || ''} onChange={e => setActividadForm({...actividadForm, AREA: e.target.value})} className="bg-slate-800 border border-slate-700 rounded-lg p-2 text-sm" /></div>
                      <div className="flex flex-col gap-1.5"><label className="text-xs text-slate-400 font-bold uppercase">MARCA</label><input value={actividadForm.MARCA || ''} onChange={e => setActividadForm({...actividadForm, MARCA: e.target.value})} className="bg-slate-800 border border-slate-700 rounded-lg p-2 text-sm" /></div>
                      <div className="flex flex-col gap-1.5"><label className="text-xs text-slate-400 font-bold uppercase">MODELO</label><input value={actividadForm.MODELO || ''} onChange={e => setActividadForm({...actividadForm, MODELO: e.target.value})} className="bg-slate-800 border border-slate-700 rounded-lg p-2 text-sm" /></div>
                      <div className="flex flex-col gap-1.5"><label className="text-xs text-slate-400 font-bold uppercase">SERIE</label><input value={actividadForm.SERIE || ''} onChange={e => setActividadForm({...actividadForm, SERIE: e.target.value})} className="bg-slate-800 border border-slate-700 rounded-lg p-2 text-sm" /></div>
                      <div className="flex flex-col gap-1.5">
                        <div className="flex justify-between items-center">
                          <label className="text-xs text-slate-400 font-bold uppercase">CELULAR</label>
                          <span className="text-[10px] text-amber-400/90 font-medium tracking-wide">
                            (OBLIGATORIO PARA SOLICITAR FIRMA)
                          </span>
                        </div>
                        <input value={actividadForm.CELULAR || ''} onChange={e => setActividadForm({...actividadForm, CELULAR: e.target.value})} className="bg-slate-800 border border-slate-700 rounded-lg p-2 text-sm" placeholder="Número de celular..." />
                      </div>
                      
                      <div className="flex flex-col gap-1.5 lg:col-span-4 relative">
                        <div className="flex justify-between items-end mb-1">
                          <label className="text-xs text-slate-400 font-bold uppercase">SOLUCIÓN / TRABAJO REALIZADO</label>
                          <div className="flex gap-2">
                             {originalSolucion !== actividadForm.SOLUCION && (
                                <button onClick={() => setActividadForm({...actividadForm, SOLUCION: originalSolucion || ''})} className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1"><RotateCcw className="w-3 h-3"/> Restaurar Original</button>
                             )}
                             <button onClick={handleGrammarCheck} disabled={isGrammarLoading || !actividadForm.SOLUCION} className="text-xs bg-purple-600/30 hover:bg-purple-600/50 text-purple-300 border border-purple-500/50 px-2 py-1 rounded flex items-center gap-1 transition-colors">
                                <Sparkles className="w-3 h-3"/> {isGrammarLoading ? 'Corrigiendo...' : 'Corrección Gramatical IA'}
                             </button>
                          </div>
                        </div>
                        <div className="bg-slate-100 rounded-lg overflow-hidden border border-slate-700/50">
                          <ReactQuill 
                            theme="snow"
                            value={actividadForm.SOLUCION || ''} 
                            onChange={(val: string) => setActividadForm({...actividadForm, SOLUCION: val})} 
                            className="text-slate-900 bg-white"
                          />
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex justify-end mt-4">
                      <button 
                        onClick={handleUpdateActividad}
                        disabled={isSavingActividad}
                        className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-xl font-bold transition-colors text-sm disabled:opacity-50"
                      >
                        <Save className="w-4 h-4" />
                        {isSavingActividad ? 'Actualizando...' : 'Actualizar Actividad'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    {ticketActividades.length === 0 && <p className="text-sm text-slate-500">No hay actividades registradas.</p>}
                    {ticketActividades.map(act => (
                       <div key={act.IDACTIVIDADES} className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 flex justify-between items-center group">
                         <div className="flex flex-col gap-1">
                           <div className="flex items-center gap-3">
                             <span className="font-bold text-sm text-emerald-400">{act.IDACTIVIDADES}</span>
                             <span className="text-xs text-slate-400"><Clock className="w-3 h-3 inline mr-1"/>{act.FHINICIO} - {act.FHFIN} (TE: {act.TE})</span>
                             <span className="text-xs bg-slate-700 px-2 py-0.5 rounded">{act.TIPO || '-'}</span>
                           </div>
                           <div 
                             className="text-sm text-slate-300 line-clamp-2 mt-1 quill-content prose prose-invert prose-sm max-w-none [&_p]:mb-0 [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4"
                             dangerouslySetInnerHTML={{ __html: act.SOLUCION || '' }}
                           />
                           <p className="text-xs text-slate-500">Usuario: {act.USUARIO || '-'} | Área: {act.AREA || '-'} | Marca: {act.MARCA || '-'}</p>
                         </div>
                         <button onClick={() => handleEditActividad(act)} className="p-2 bg-slate-700 text-slate-300 rounded-lg hover:bg-emerald-600 hover:text-white transition-colors">
                           <Edit className="w-4 h-4" />
                         </button>
                       </div>
                    ))}
                  </div>
                )}
              </div>

              {/* REPUESTOS */}
              <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
                <div className="flex items-center gap-2 mb-6">
                  <Wrench className="w-5 h-5 text-amber-400" />
                  <h3 className="text-xl font-bold">Repuestos Asociados</h3>
                </div>
                
                {editingRepuesto ? (
                   <div className="bg-slate-900 border border-amber-800/50 rounded-xl p-5 relative">
                     <button onClick={() => setEditingRepuesto(null)} className="absolute top-4 right-4 text-slate-400 hover:text-white"><X className="w-5 h-5"/></button>
                     <h4 className="font-bold text-amber-400 mb-4 flex items-center gap-2">Editando Repuesto: {editingRepuesto.IDREPUESTO}</h4>
                     <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                       <div className="flex flex-col gap-1.5"><label className="text-xs text-slate-400 font-bold uppercase">IDREPUESTO</label><input readOnly value={repuestoForm.IDREPUESTO || ''} className="bg-slate-800/50 border border-slate-700 rounded-lg p-2 text-sm text-slate-500" /></div>
                       <div className="flex flex-col gap-1.5"><label className="text-xs text-slate-400 font-bold uppercase">CANTIDAD</label><input type="number" value={repuestoForm.CANTIDAD || ''} onChange={e => setRepuestoForm({...repuestoForm, CANTIDAD: e.target.value})} className="bg-slate-800 border border-slate-700 rounded-lg p-2 text-sm focus:border-amber-500 outline-none" /></div>
                       <div className="flex flex-col gap-1.5 md:col-span-2"><label className="text-xs text-slate-400 font-bold uppercase">DESCRIPCIÓN</label><input value={repuestoForm.DESCRIPCION || ''} onChange={e => setRepuestoForm({...repuestoForm, DESCRIPCION: e.target.value})} className="bg-slate-800 border border-slate-700 rounded-lg p-2 text-sm focus:border-amber-500 outline-none" /></div>
                     </div>
                     <div className="flex justify-end mt-4">
                        <button 
                          onClick={handleUpdateRepuesto}
                          disabled={isSavingRepuesto}
                          className="flex items-center gap-2 bg-amber-600 hover:bg-amber-500 text-white px-4 py-2 rounded-xl font-bold transition-colors text-sm disabled:opacity-50"
                        >
                          <Save className="w-4 h-4" />
                          {isSavingRepuesto ? 'Actualizando...' : 'Actualizar Repuesto'}
                        </button>
                      </div>
                   </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    {ticketRepuestos.length === 0 && <p className="text-sm text-slate-500">No hay repuestos registrados.</p>}
                    {ticketRepuestos.map(rep => (
                       <div key={rep.IDREPUESTO} className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 flex justify-between items-center group">
                         <div className="flex items-center gap-4">
                           <div className="bg-amber-900/30 text-amber-400 font-bold w-10 h-10 rounded-lg flex items-center justify-center border border-amber-800/50">
                             {rep.CANTIDAD || '0'}
                           </div>
                           <div className="flex flex-col">
                             <span className="font-bold text-sm text-amber-400">{rep.IDREPUESTO}</span>
                             <span className="text-sm text-slate-300">{rep.DESCRIPCION || '-'}</span>
                           </div>
                         </div>
                         <button onClick={() => handleEditRepuesto(rep)} className="p-2 bg-slate-700 text-slate-300 rounded-lg hover:bg-amber-600 hover:text-white transition-colors">
                           <Edit className="w-4 h-4" />
                         </button>
                       </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          )}
        </div>

      </div>
    </div>
  );
}
