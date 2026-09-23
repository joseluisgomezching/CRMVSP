import React, { useState, useEffect, useMemo, useRef } from 'react';
import { fetchAppData, createRuta, createTransporte } from '../../lib/googleApi';
import { AppData, Ticket, Ruta, Transporte } from '../../types';
import { 
  Ticket as TicketIcon, Map, Search, User, Bus, Car, Train, Bike, 
  Plus, X, CheckCircle, ArrowRight, ChevronRight, Route, AlertCircle, Calendar 
} from 'lucide-react';
import GoogleErrorCard from '../../components/GoogleErrorCard';

export default function RendirPasajesModule() {
  const [data, setData] = useState<AppData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [ticketSearchTerm, setTicketSearchTerm] = useState('');
  const [routeSearchTerm, setRouteSearchTerm] = useState('');

  const [origen, setOrigen] = useState('');
  const [destino, setDestino] = useState('');
  const [motivo, setMotivo] = useState('');
  const [tecnicoOverride, setTecnicoOverride] = useState('');
  
  const [segments, setSegments] = useState<{ id: string, movil: string, pasaje: string }[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const ticketsColRef = useRef<HTMLDivElement>(null);
  const rutasColRef = useRef<HTMLDivElement>(null);
  const constructorColRef = useRef<HTMLDivElement>(null);

  const scrollToPanel = (ref: React.RefObject<HTMLDivElement>) => {
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  };
  
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const appData = await fetchAppData();
      setData(appData);
    } catch (err: any) {
      setError(err.message || 'Error cargando datos');
    } finally {
      setLoading(false);
    }
  };

  const getFechaCierre = (t: Ticket) => {
    if (t['FECHA DE CIERRE'] && t['FECHA DE CIERRE'].trim()) {
      return t['FECHA DE CIERRE'].trim();
    }
    const actList = data?.actividades.filter(a => a.IDTICKET === t.IDTICKET) || [];
    if (actList.length === 0) return t.FHINGRESO || '';

    let maxDateStr = t.FHINGRESO || '';
    let maxDateVal = 0;

    for (const act of actList) {
      if (act.FHFIN) {
        const parts = act.FHFIN.split(' ');
        const dateParts = parts[0].split(/[\/\-]/);
        const timeParts = parts[1] ? parts[1].split(':') : ['0','0'];
        if (dateParts.length >= 3) {
          const val = new Date(
            parseInt(dateParts[2], 10), 
            parseInt(dateParts[1], 10) - 1, 
            parseInt(dateParts[0], 10),
            parseInt(timeParts[0] || '0', 10),
            parseInt(timeParts[1] || '0', 10)
          ).getTime();
          if (val > maxDateVal) {
            maxDateVal = val;
            maxDateStr = parts[0];
          }
        }
      }
    }
    
    return maxDateStr;
  };

  const parseDateToTimestamp = (dateStr: string): number | null => {
    if (!dateStr || typeof dateStr !== 'string') return null;
    const clean = dateStr.trim();
    if (!clean) return null;

    const parts = clean.split(' ')[0].split(/[\/\-]/);
    if (parts.length >= 3) {
      if (parts[0].length === 4) {
        const y = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10) - 1;
        const d = parseInt(parts[2], 10);
        if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
          return new Date(y, m, d, 12, 0, 0).getTime();
        }
      } else {
        const d = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10) - 1;
        const y = parseInt(parts[2], 10);
        if (!isNaN(d) && !isNaN(m) && !isNaN(y)) {
          return new Date(y, m, d, 12, 0, 0).getTime();
        }
      }
    }

    const d = new Date(clean);
    return isNaN(d.getTime()) ? null : d.getTime();
  };

  // Semana actual: Lunes a Domingo tomando como referencia la fecha del sistema
  // El lunes es el día de cambio; el martes ya no aparecen los de la semana pasada
  const currentWeekBounds = useMemo(() => {
    const now = new Date();
    const day = now.getDay(); // 0 = Domingo, 1 = Lunes, ..., 6 = Sábado
    const diffToMonday = day === 0 ? -6 : 1 - day;

    const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diffToMonday, 0, 0, 0, 0);
    const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6, 23, 59, 59, 999);

    return { monday, sunday };
  }, []);

  const formatDateShort = (d: Date) => {
    return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}`;
  };

  const filteredTickets = useMemo(() => {
    if (!data) return [];
    
    // Deduplicate tickets first
    const uniqueTickets: Ticket[] = [];
    const seen = new Set<string>();
    for (const t of data.tickets) {
      if (t.IDTICKET && !seen.has(t.IDTICKET)) {
        seen.add(t.IDTICKET);
        uniqueTickets.push(t);
      }
    }
    
    const mondayTime = currentWeekBounds.monday.getTime();
    const sundayTime = currentWeekBounds.sunday.getTime();

    return uniqueTickets.filter(t => {
      // Solo tickets con ESTADO = CERRADO
      if ((t.ESTADO || '').trim().toUpperCase() !== 'CERRADO') return false;
      
      // Tomando como referencia FECHA DE CIERRE
      const fechaCierreStr = getFechaCierre(t);
      if (!fechaCierreStr) return false;

      const tTime = parseDateToTimestamp(fechaCierreStr);
      if (tTime === null) return false;

      // Solo de la semana actual (Lunes a Domingo)
      if (tTime < mondayTime || tTime > sundayTime) return false;
      
      if (ticketSearchTerm.trim() !== '') {
        const term = ticketSearchTerm.toLowerCase();
        if (!t.IDTICKET?.toLowerCase().includes(term) && 
            !t.CLIENTE?.toLowerCase().includes(term) &&
            !t.TECNICO?.toLowerCase().includes(term)) {
          return false;
        }
      }
      
      return true;
    }).sort((a, b) => {
      const da = parseDateToTimestamp(getFechaCierre(a)) || 0;
      const db = parseDateToTimestamp(getFechaCierre(b)) || 0;
      return db - da;
    });
  }, [data, currentWeekBounds, ticketSearchTerm]);

  const registeredRoutes = useMemo(() => {
    if (!data || !data.rutas) return [];
    let rutas = [...data.rutas];
    
    if (routeSearchTerm.trim() !== '') {
      const term = routeSearchTerm.toLowerCase();
      rutas = rutas.filter(r => 
        r.ORIGEN?.toLowerCase().includes(term) ||
        r.DESTINO?.toLowerCase().includes(term) ||
        r.TECNICO?.toLowerCase().includes(term) ||
        r['TICKET/ACTIVIDAD']?.toLowerCase().includes(term) ||
        r.ID?.toLowerCase().includes(term) ||
        r.MOTIVO?.toLowerCase().includes(term)
      );
    }
    
    return rutas.reverse();
  }, [data, routeSearchTerm]);

  const uniqueTecnicos = useMemo(() => {
    if (!data) return [];
    const tSet = new Set<string>();
    data.tecnicos.forEach(t => t.NOMBRE && tSet.add(t.NOMBRE));
    return Array.from(tSet).sort();
  }, [data]);

  const handleSelectTicket = (t: Ticket) => {
    setSelectedTicket(t);
    setTecnicoOverride(t.TECNICO || '');
  };

  const addSegment = (movil: string) => {
    const tempId = `TEMP-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    setSegments([...segments, { id: tempId, movil, pasaje: '' }]);
  };

  const removeSegment = (id: string) => {
    setSegments(segments.filter(s => s.id !== id));
  };

  const updateSegmentCost = (id: string, cost: string) => {
    setSegments(segments.map(s => s.id === id ? { ...s, pasaje: cost } : s));
  };

  const totalAmount = segments.reduce((sum, s) => sum + (parseFloat(s.pasaje) || 0), 0);

  const generateRutaId = () => {
    if (!data || !data.rutas) return 'RUT-0001';
    let max = 0;
    data.rutas.forEach(r => {
      if (r.ID && r.ID.startsWith('RUT-')) {
        const num = parseInt(r.ID.replace('RUT-', ''), 10);
        if (!isNaN(num) && num > max) max = num;
      }
    });
    return `RUT-${(max + 1).toString().padStart(4, '0')}`;
  };

  const generateMovilId = (index: number, existingCount: number) => {
    return `MOV-${(existingCount + index + 1).toString().padStart(4, '0')}`;
  };

  const handleSave = async () => {
    if (!selectedTicket) return alert('Seleccione un ticket');
    if (!origen.trim()) return alert('Ingrese el origen');
    if (!destino.trim()) return alert('Ingrese el destino');
    if (!motivo.trim()) return alert('Ingrese el motivo');
    if (!tecnicoOverride) return alert('Seleccione un técnico');
    if (segments.length === 0) return alert('Agregue al menos un segmento de transporte');
    
    for (const s of segments) {
      if (!s.pasaje || isNaN(parseFloat(s.pasaje)) || parseFloat(s.pasaje) <= 0) {
        return alert('El pasaje de todos los segmentos debe ser un número mayor a 0');
      }
    }

    setIsSaving(true);
    try {
      const rutaId = generateRutaId();
      const now = new Date();
      const fecha = `${now.getDate().toString().padStart(2, '0')}/${(now.getMonth()+1).toString().padStart(2, '0')}/${now.getFullYear()}`;
      
      const newRuta: Ruta = {
        ID: rutaId,
        ORIGEN: origen,
        DESTINO: destino,
        MONTO: totalAmount.toFixed(2),
        TECNICO: tecnicoOverride,
        'TICKET/ACTIVIDAD': selectedTicket.IDTICKET,
        MOTIVO: motivo,
        ESTADO: 'NO CANCELADO',
        FECHA: fecha
      };

      await createRuta(newRuta);

      let existingMovs = 0;
      if (data && data.transporte) {
        data.transporte.forEach(t => {
          if (t.ID && t.ID.startsWith('MOV-')) {
            const num = parseInt(t.ID.replace('MOV-', ''), 10);
            if (!isNaN(num) && num > existingMovs) existingMovs = num;
          }
        });
      }

      const newTransportes: Transporte[] = segments.map((s, index) => ({
        ID: generateMovilId(index, existingMovs),
        IDRUTA: rutaId,
        MOVIL: s.movil,
        PASAJE: parseFloat(s.pasaje).toFixed(2)
      }));

      await createTransporte(newTransportes);

      setData(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          rutas: [...(prev.rutas || []), newRuta],
          transporte: [...(prev.transporte || []), ...newTransportes]
        };
      });

      setOrigen('');
      setDestino('');
      setMotivo('');
      setSegments([]);
      
    } catch (err: any) {
      alert(`Error al guardar: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const getTransportIcon = (movil: string) => {
    switch (movil.toUpperCase()) {
      case 'TAXI': return <Car className="w-4 h-4" />;
      case 'TREN': return <Train className="w-4 h-4" />;
      case 'METROPOLITANO': return <Bus className="w-4 h-4" />;
      case 'COMBI': return <Bus className="w-4 h-4" />;
      case 'MOTOCAR': return <Bike className="w-4 h-4" />;
      default: return <Car className="w-4 h-4" />;
    }
  };

  const getTransportStyle = (movil: string) => {
    switch (movil.toUpperCase()) {
      case 'TAXI': return 'text-amber-500 border-amber-500/30 hover:bg-amber-500/10';
      case 'TREN': return 'text-emerald-500 border-emerald-500/30 hover:bg-emerald-500/10';
      case 'METROPOLITANO': return 'text-blue-400 border-blue-400/30 hover:bg-blue-400/10';
      case 'COMBI': return 'text-purple-400 border-purple-400/30 hover:bg-purple-400/10';
      case 'MOTOCAR': return 'text-pink-500 border-pink-500/30 hover:bg-pink-500/10';
      default: return 'text-slate-400 border-slate-700 hover:bg-slate-800';
    }
  };

  if (loading) {
    return (
      <div className="flex-1 w-full flex items-center justify-center bg-slate-950">
        <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex-1 w-full flex items-center justify-center bg-slate-950 p-4">
        <GoogleErrorCard error={error || 'No se pudieron cargar los datos'} onRetry={loadData} title="Error en Rendir Pasajes" />
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden h-full bg-[#0B1120] text-slate-300 font-sans p-1 sm:p-4 gap-3 sm:gap-4">
      {/* Mobile Panel Quick Nav */}
      <div className="flex lg:hidden items-center justify-between gap-1.5 bg-slate-900/80 p-1.5 rounded-xl border border-slate-800 shrink-0">
        <button 
          onClick={() => scrollToPanel(ticketsColRef)}
          className="flex-1 py-1.5 px-2 rounded-lg text-xs font-bold text-slate-300 hover:text-white bg-slate-800/80 active:bg-blue-600 transition-colors text-center"
        >
          Tickets ({filteredTickets.length})
        </button>
        <button 
          onClick={() => scrollToPanel(rutasColRef)}
          className="flex-1 py-1.5 px-2 rounded-lg text-xs font-bold text-slate-300 hover:text-white bg-slate-800/80 active:bg-amber-600 transition-colors text-center"
        >
          Rutas ({registeredRoutes.length})
        </button>
        <button 
          onClick={() => scrollToPanel(constructorColRef)}
          className="flex-1 py-1.5 px-2 rounded-lg text-xs font-bold text-slate-300 hover:text-white bg-slate-800/80 active:bg-emerald-600 transition-colors text-center"
        >
          Constructor
        </button>
      </div>

      <div className="flex flex-row overflow-x-auto lg:overflow-hidden snap-x snap-mandatory flex-1 h-full gap-4 pb-2 custom-scrollbar">
        {/* LEFT PANEL: TICKETS & ACTIVIDADES */}
        <aside ref={ticketsColRef} className="w-[88vw] sm:w-[320px] lg:w-[320px] bg-[#111827] border border-slate-800 rounded-2xl flex flex-col shrink-0 snap-center shadow-lg overflow-hidden h-full">
          <div className="p-4 border-b border-slate-800 flex flex-col gap-4">
            <div className="flex justify-between items-center">
              <h2 className="text-sm font-bold text-white uppercase tracking-widest flex items-center gap-2">
                <TicketIcon className="w-4 h-4 text-amber-500" />
                Tickets & Actividades
              </h2>
              <span className="bg-slate-800 border border-slate-700 px-2 py-0.5 rounded text-[10px] text-slate-300 font-bold">
                {filteredTickets.length}
              </span>
            </div>
            
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input 
                type="text"
                placeholder="Buscar ticket..."
                value={ticketSearchTerm}
                onChange={e => setTicketSearchTerm(e.target.value)}
                className="w-full bg-[#0B1120] border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>

            <div className="flex items-center justify-between text-xs bg-emerald-950/40 border border-emerald-800/50 px-2.5 py-1.5 rounded-lg">
              <span className="text-emerald-400 font-semibold flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" />
                Semana Actual (Lun - Dom)
              </span>
              <span className="text-emerald-300 font-mono text-[11px] font-bold">
                {formatDateShort(currentWeekBounds.monday)} - {formatDateShort(currentWeekBounds.sunday)}
              </span>
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
            {filteredTickets.map(t => {
              const isSelected = selectedTicket?.IDTICKET === t.IDTICKET;
              const fechaCierre = getFechaCierre(t);
              return (
                <div 
                  key={t.IDTICKET}
                  onClick={() => handleSelectTicket(t)}
                  className={`p-3 rounded-xl cursor-pointer transition-all border-2 ${
                    isSelected 
                      ? 'bg-emerald-950/50 border-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.3)] ring-1 ring-emerald-400/50' 
                      : 'bg-[#0B1120] border-emerald-500 hover:border-emerald-400 hover:bg-emerald-950/20'
                  }`}
                >
                  <div className="flex justify-between items-start gap-2 mb-2">
                    <span className="font-mono text-sm font-bold text-amber-400 tracking-wide">
                      {t.IDTICKET}
                    </span>
                    <span 
                      className="text-xs font-semibold text-slate-200 uppercase tracking-wide truncate max-w-[140px] text-right" 
                      title={t.CLIENTE}
                    >
                      {t.CLIENTE || 'Sin cliente'}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 text-xs text-slate-300 mb-1.5">
                    <User className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span className="text-[11px] text-slate-400">Técnico:</span>
                    <span className="font-medium text-slate-200 truncate" title={t.TECNICO}>
                      {t.TECNICO || 'Sin asignar'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs pt-1.5 border-t border-emerald-900/40">
                    <div className="flex items-center gap-1.5 text-slate-300">
                      <Calendar className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span className="text-[11px] text-slate-400">Fecha de Cierre:</span>
                      <span className="font-semibold text-emerald-300">
                        {fechaCierre || '-'}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
            {filteredTickets.length === 0 && (
              <p className="text-center text-xs text-slate-500 mt-4">
                No hay tickets cerrados en la semana actual.
              </p>
            )}
          </div>
        </aside>

        {/* MIDDLE PANEL: RUTAS RECIENTES */}
        <main ref={rutasColRef} className="w-[88vw] sm:w-[380px] lg:w-auto lg:flex-1 bg-[#111827] border border-slate-800 rounded-2xl flex flex-col shrink-0 snap-center shadow-lg overflow-hidden h-full">
          <div className="p-4 border-b border-slate-800 flex flex-col gap-4">
            <div className="flex justify-between items-center">
              <h2 className="text-sm font-bold text-white uppercase tracking-widest flex items-center gap-2">
                <Route className="w-4 h-4 text-amber-500" />
                Rutas Recientes
              </h2>
              <span className="bg-slate-800 border border-slate-700 px-2 py-0.5 rounded text-[10px] text-slate-300 font-bold">
                {registeredRoutes.length}
              </span>
            </div>

          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input 
              type="text"
              placeholder="Filtrar por origen, destino, técnico, ticket..."
              value={routeSearchTerm}
              onChange={e => setRouteSearchTerm(e.target.value)}
              className="w-full bg-[#0B1120] border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
          {registeredRoutes.map(r => {
            const routeTransports = data?.transporte?.filter(t => t.IDRUTA === r.ID) || [];
            const isCanceled = r.ESTADO === 'CANCELADO';
            
            return (
              <div key={r.ID} className={`bg-[#0B1120] border border-slate-800 rounded-xl p-4 flex flex-col gap-3 transition-all ${isCanceled ? 'opacity-60' : 'hover:border-slate-700'}`}>
                
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-3">
                    <div className="bg-blue-900/30 p-2 rounded-lg border border-blue-800/50">
                      <Route className="w-4 h-4 text-blue-400" />
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-blue-400 font-bold text-sm tracking-wide">{r.ID}</span>
                      <span className="text-xs text-slate-500">{r.FECHA}</span>
                      <span className={`text-[9px] px-2 py-0.5 rounded-sm font-bold tracking-wider uppercase border ${
                        isCanceled ? 'bg-red-900/20 text-red-400 border-red-900/30' : 'bg-emerald-900/20 text-emerald-400 border-emerald-900/30'
                      }`}>
                        {r.ESTADO}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-0.5">Monto Total</p>
                    <p className="text-slate-200 font-bold text-lg">S/ {parseFloat(r.MONTO || '0').toFixed(2)}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-sm font-medium text-slate-300">
                  <span>{r.ORIGEN}</span>
                  <ChevronRight className="w-4 h-4 text-amber-500" />
                  <span>{r.DESTINO}</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-[#111827] rounded-lg p-3 border border-slate-800/80">
                  <div>
                    <p className="text-[10px] text-slate-500 font-bold uppercase mb-1">Ticket</p>
                    <p className="text-xs text-amber-500 font-bold">{r['TICKET/ACTIVIDAD']}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-500 font-bold uppercase mb-1">Técnico</p>
                    <p className="text-xs text-slate-300 truncate" title={r.TECNICO}>{r.TECNICO}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-500 font-bold uppercase mb-1">Motivo</p>
                    <p className="text-xs text-slate-300 truncate" title={r.MOTIVO}>{r.MOTIVO}</p>
                  </div>
                </div>

                <div>
                  <p className="text-[10px] text-slate-500 font-bold uppercase mb-2">Transporte:</p>
                  <div className="flex flex-wrap gap-2">
                    {routeTransports.map(t => (
                      <div key={t.ID} className="flex items-center gap-1.5 bg-[#111827] border border-slate-800 px-2.5 py-1.5 rounded-md">
                        <div className="text-amber-500">{getTransportIcon(t.MOVIL)}</div>
                        <span className="text-[11px] font-bold text-slate-300 uppercase">{t.MOVIL}</span>
                        <span className="text-[11px] font-bold text-amber-500 ml-1">S/ {parseFloat(t.PASAJE).toFixed(2)}</span>
                      </div>
                    ))}
                    {routeTransports.length === 0 && <span className="text-xs text-slate-600">No especificado</span>}
                  </div>
                </div>

              </div>
            );
          })}
          {registeredRoutes.length === 0 && (
            <div className="text-center py-10">
              <p className="text-sm text-slate-500">No se encontraron rutas.</p>
            </div>
          )}
        </div>
      </main>

      {/* RIGHT PANEL: CONSTRUCTOR DE RUTA */}
      <aside ref={constructorColRef} className="w-[88vw] sm:w-[380px] lg:w-[400px] bg-[#111827] border border-slate-800 rounded-2xl flex flex-col shrink-0 snap-center shadow-lg overflow-hidden h-full">
        <div className="p-4 border-b border-slate-800">
          <h2 className="text-sm font-bold text-white uppercase tracking-widest flex items-center gap-2">
            <Plus className="w-4 h-4 text-amber-500" />
            Constructor de Ruta
          </h2>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">
          
          <div className="space-y-4">
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 block">Ticket Seleccionado</label>
              <div className={`p-3 rounded-lg border ${selectedTicket ? 'bg-[#0B1120] border-slate-700 text-amber-500 font-bold text-center tracking-wider text-sm' : 'bg-[#0B1120]/50 border-slate-800 border-dashed text-slate-500 text-xs text-center'}`}>
                {selectedTicket ? selectedTicket.IDTICKET : 'Seleccione un ticket en el panel izquierdo'}
              </div>
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 block">Origen <span className="text-amber-500">*</span></label>
              <input 
                type="text"
                value={origen}
                onChange={e => setOrigen(e.target.value)}
                placeholder="Ej. Sede Principal / Oficina"
                className="w-full bg-[#0B1120] border border-slate-800 rounded-lg px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 block">Destino <span className="text-amber-500">*</span></label>
              <input 
                type="text"
                value={destino}
                onChange={e => setDestino(e.target.value)}
                placeholder="Ej. Oficina Cliente / Sede"
                className="w-full bg-[#0B1120] border border-slate-800 rounded-lg px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 block">Motivo</label>
              <input 
                type="text"
                value={motivo}
                onChange={e => setMotivo(e.target.value)}
                placeholder="Ej. Entrega de repuestos"
                className="w-full bg-[#0B1120] border border-slate-800 rounded-lg px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 block">Técnico <span className="text-amber-500">*</span></label>
              <select
                value={tecnicoOverride}
                onChange={(e) => setTecnicoOverride(e.target.value)}
                className="w-full bg-[#0B1120] border border-slate-800 rounded-lg px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-blue-500 transition-colors appearance-none"
              >
                <option value="" disabled>Seleccione un técnico...</option>
                {uniqueTecnicos.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-800">
            <div className="flex justify-between items-center mb-3">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Selector de Movilidad</label>
              <span className="text-[9px] text-blue-400">Haga clic para agregar</span>
            </div>
            
            <div className="grid grid-cols-2 gap-2">
              {['Taxi', 'Tren', 'Metropolitano', 'Combi', 'Motocar'].map((movil) => (
                <button
                  key={movil}
                  onClick={() => addSegment(movil)}
                  className={`flex items-center gap-2 justify-center px-3 py-2.5 rounded-lg border bg-[#0B1120] transition-all group ${getTransportStyle(movil)} ${movil === 'Motocar' ? 'col-span-2' : ''}`}
                >
                  <div className="group-hover:scale-110 transition-transform">
                    {getTransportIcon(movil)}
                  </div>
                  <span className="text-xs font-bold">{movil}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="pt-4 border-t border-slate-800">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 block">Segmentos de Ruta</label>
            
            <div className="space-y-2">
              {segments.map((s) => (
                <div key={s.id} className="bg-[#0B1120] border border-slate-800 rounded-lg p-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 flex-1">
                    <div className={getTransportStyle(s.movil).split(' ')[0]}>
                      {getTransportIcon(s.movil)}
                    </div>
                    <span className="text-xs font-bold text-slate-200 w-24">{s.movil}</span>
                    <div className="flex items-center gap-1 bg-[#111827] border border-slate-800 rounded px-2 py-1 flex-1">
                      <span className="text-xs font-bold text-amber-500">S/</span>
                      <input 
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={s.pasaje}
                        onChange={(e) => updateSegmentCost(s.id, e.target.value)}
                        className="w-full bg-transparent text-right text-sm font-bold text-slate-200 focus:outline-none"
                      />
                    </div>
                  </div>
                  <button onClick={() => removeSegment(s.id)} className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-400/10 rounded-md transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}

              {segments.length === 0 && (
                <div className="border border-dashed border-slate-700 bg-[#0B1120]/50 rounded-lg p-6 flex flex-col items-center justify-center gap-2 text-slate-500">
                  <Plus className="w-5 h-5 opacity-50" />
                  <span className="text-[10px] uppercase tracking-widest font-bold opacity-70">Selecciona movilidad aquí</span>
                </div>
              )}
            </div>
          </div>

        </div>

        <div className="p-4 border-t border-slate-800 bg-[#111827]">
          <div className="flex justify-between items-center mb-4">
            <div>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-0.5">Segmentos</p>
              <p className="text-slate-200 font-bold">{segments.length}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-0.5">Total Estimado</p>
              <p className="text-amber-500 font-bold text-xl">S/ {totalAmount.toFixed(2)}</p>
            </div>
          </div>
          
          <button 
            onClick={handleSave}
            disabled={isSaving}
            className="w-full bg-[#1e3a8a] hover:bg-[#1e40af] text-slate-200 py-3.5 rounded-xl font-bold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 border border-[#1e40af]"
          >
            {isSaving ? (
              <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
            ) : (
              <CheckCircle className="w-4 h-4" />
            )}
            {isSaving ? 'Guardando...' : 'Confirmar y Guardar Ruta'}
          </button>
        </div>
      </aside>
      </div>
    </div>
  );
}
