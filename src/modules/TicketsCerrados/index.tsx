import React, { useState, useEffect, useMemo } from 'react';
import { 
  fetchAppData, 
  batchUpdateTicketFechaCierre, 
  extractMaxFHFINDate, 
  parseDateStringToTimestamp
} from '../../lib/googleApi';
import { AppData, Ticket } from '../../types';
import TecnicoTicketDetail from '../Tecnico/TecnicoTicketDetail';
import { 
  Search, 
  Filter, 
  X, 
  CheckCircle, 
  RefreshCw, 
  CalendarCheck, 
  AlertCircle, 
  CheckCircle2, 
  ArrowRight, 
  Clock, 
  Eye,
  Building2
} from 'lucide-react';
import GoogleErrorCard from '../../components/GoogleErrorCard';

export default function TicketsCerradosModule() {
  const [data, setData] = useState<AppData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);

  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedMonths, setSelectedMonths] = useState<number[]>([new Date().getMonth() + 1]);
  const [selectedClient, setSelectedClient] = useState<string>('TODOS');
  const [searchTerm, setSearchTerm] = useState('');

  // Update Cierre state
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [isUpdatingCierre, setIsUpdatingCierre] = useState(false);
  const [modalSearch, setModalSearch] = useState('');
  const [onlyShowChanged, setOnlyShowChanged] = useState(false);

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

  const getMonthYear = (dateStr: string) => {
    if (!dateStr) return null;
    const ts = parseDateStringToTimestamp(dateStr);
    if (ts !== null) {
      const d = new Date(ts);
      return {
        day: d.getDate(),
        month: d.getMonth() + 1,
        year: d.getFullYear(),
      };
    }
    const parts = dateStr.split(' ')[0].split(/[\/\-\.]/);
    if (parts.length >= 3) {
      if (parts[0].length === 4) {
        return {
          year: parseInt(parts[0], 10),
          month: parseInt(parts[1], 10),
          day: parseInt(parts[2], 10),
        };
      }
      return {
        day: parseInt(parts[0], 10),
        month: parseInt(parts[1], 10),
        year: parseInt(parts[2], 10),
      };
    }
    return null;
  };

  const getFechaCierre = (t: Ticket) => {
    if (t['FECHA DE CIERRE']) {
      return t['FECHA DE CIERRE'];
    }
    const actList = data?.actividades.filter(
      a => (a.IDTICKET || '').trim().toUpperCase() === (t.IDTICKET || '').trim().toUpperCase()
    ) || [];
    const calculated = extractMaxFHFINDate(actList, t.FHINGRESO);
    return calculated || t.FHINGRESO || '';
  };

  // Compute calculated updates for all tickets with ESTADO=CERRADO
  const pendingCierreUpdates = useMemo(() => {
    if (!data) return [];
    const list: {
      ticket: Ticket;
      currentFechaCierre: string;
      newFechaCierre: string;
      rowIndex: number;
      actCount: number;
      hasChanged: boolean;
      maxFHFINSource: string;
    }[] = [];

    for (const t of data.tickets) {
      if ((t.ESTADO || '').trim().toUpperCase() !== 'CERRADO') continue;
      if (!t._rowIndex) continue;

      const actList = data.actividades.filter(
        a => (a.IDTICKET || '').trim().toUpperCase() === (t.IDTICKET || '').trim().toUpperCase()
      );

      // Find max FHFIN among activities
      let maxActFHFIN = '';
      let maxTs: number | null = null;
      for (const act of actList) {
        if (act.FHFIN) {
          const ts = parseDateStringToTimestamp(act.FHFIN);
          if (ts !== null && (maxTs === null || ts > maxTs)) {
            maxTs = ts;
            maxActFHFIN = act.FHFIN;
          }
        }
      }

      const calculatedDate = extractMaxFHFINDate(actList, t.FHINGRESO || t['FECHA DE CIERRE']);
      
      if (calculatedDate) {
        const current = (t['FECHA DE CIERRE'] || '').trim();
        list.push({
          ticket: t,
          currentFechaCierre: current,
          newFechaCierre: calculatedDate,
          rowIndex: t._rowIndex,
          actCount: actList.length,
          hasChanged: current !== calculatedDate,
          maxFHFINSource: maxActFHFIN || t.FHINGRESO || ''
        });
      }
    }
    return list;
  }, [data]);

  const handleExecuteActualizarCierre = async () => {
    if (pendingCierreUpdates.length === 0) return;
    setIsUpdatingCierre(true);
    setError(null);
    try {
      const updates = pendingCierreUpdates.map(u => ({
        rowIndex: u.rowIndex,
        fechaCierre: u.newFechaCierre
      }));

      await batchUpdateTicketFechaCierre(updates);
      
      setShowUpdateModal(false);
      setSuccessMessage(`Se actualizó exitosamente la columna "FECHA DE CIERRE" para ${updates.length} tickets cerrados en Google Sheets.`);
      
      // Reload fresh data
      await loadData();
      
      setTimeout(() => {
        setSuccessMessage(null);
      }, 6000);
    } catch (err: any) {
      setError(err.message || 'Error al actualizar fecha de cierre');
    } finally {
      setIsUpdatingCierre(false);
    }
  };

  const filteredTickets = useMemo(() => {
    if (!data) return [];
    
    // Deduplicate tickets first
    const uniqueTickets = [];
    const seen = new Set();
    for (const t of data.tickets) {
      if (!seen.has(t.IDTICKET) && (t.ESTADO || '').trim().toUpperCase() === 'CERRADO') {
        seen.add(t.IDTICKET);
        uniqueTickets.push(t);
      }
    }
    let tickets = uniqueTickets;

    tickets = tickets.filter(t => {
      // Usar FECHA DE CIERRE si existe, de lo contrario FHINGRESO
      const dateStr = getFechaCierre(t);
      const parsed = getMonthYear(dateStr);
      if (!parsed) return false;
      
      if (parsed.year !== selectedYear) return false;
      if (selectedMonths.length > 0 && !selectedMonths.includes(parsed.month)) return false;
      
      return true;
    });

    // Filtro por Cliente
    if (selectedClient && selectedClient !== 'TODOS') {
      const targetClient = selectedClient.trim().toUpperCase();
      tickets = tickets.filter(t => (t.CLIENTE || '').trim().toUpperCase() === targetClient);
    }

    if (searchTerm.trim() !== '') {
      const term = searchTerm.toLowerCase();
      tickets = tickets.filter(t => {
        // Concatenar todos los valores del ticket
        const ticketValues = Object.values(t).join(' ').toLowerCase();
        
        // Buscar actividades de este ticket y concatenarlas
        const actList = data.actividades.filter(
          a => (a.IDTICKET || '').trim().toUpperCase() === (t.IDTICKET || '').trim().toUpperCase()
        );
        const actValues = actList.map(a => Object.values(a).join(' ')).join(' ').toLowerCase();

        return ticketValues.includes(term) || actValues.includes(term);
      });
    }

    return tickets.sort((a, b) => {
        const da = getMonthYear(getFechaCierre(a));
        const db = getMonthYear(getFechaCierre(b));
        if(!da || !db) return 0;
        if(da.year !== db.year) return db.year - da.year;
        if(da.month !== db.month) return db.month - da.month;
        return db.day - da.day;
    });
  }, [data, selectedYear, selectedMonths, selectedClient, searchTerm]);

  const availableClients = useMemo(() => {
    if (!data) return [];
    const clientMap = new Map<string, { total: number; inYear: number }>();
    
    data.tickets
      .filter(t => (t.ESTADO || '').trim().toUpperCase() === 'CERRADO')
      .forEach(t => {
        const client = (t.CLIENTE || '').trim();
        if (!client) return;
        const current = clientMap.get(client) || { total: 0, inYear: 0 };
        current.total += 1;
        const parsed = getMonthYear(getFechaCierre(t));
        if (parsed && parsed.year === selectedYear) {
          current.inYear += 1;
        }
        clientMap.set(client, current);
      });

    return Array.from(clientMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0], undefined, { sensitivity: 'base' }))
      .map(([name, counts]) => ({ 
        name, 
        total: counts.total, 
        inYear: counts.inYear 
      }));
  }, [data, selectedYear]);

  const availableYears = useMemo(() => {
    if (!data) return [new Date().getFullYear()];
    const years = new Set<number>();
    data.tickets.filter(t => (t.ESTADO || '').trim().toUpperCase() === 'CERRADO').forEach(t => {
      const parsed = getMonthYear(getFechaCierre(t));
      if (parsed) years.add(parsed.year);
    });
    const current = new Date().getFullYear();
    years.add(current);
    return Array.from(years).sort((a, b) => b - a);
  }, [data]);

  const monthsList = [
    { value: 1, label: 'Ene' }, { value: 2, label: 'Feb' }, { value: 3, label: 'Mar' },
    { value: 4, label: 'Abr' }, { value: 5, label: 'May' }, { value: 6, label: 'Jun' },
    { value: 7, label: 'Jul' }, { value: 8, label: 'Ago' }, { value: 9, label: 'Set' },
    { value: 10, label: 'Oct' }, { value: 11, label: 'Nov' }, { value: 12, label: 'Dic' }
  ];

  const toggleMonth = (m: number) => {
    setSelectedMonths(prev => {
      if (prev.includes(m)) {
        return prev.filter(x => x !== m);
      } else {
        return [...prev, m].sort((a, b) => a - b);
      }
    });
  };

  // Filtered items in update modal
  const modalFilteredUpdates = useMemo(() => {
    return pendingCierreUpdates.filter(item => {
      if (onlyShowChanged && !item.hasChanged) return false;
      if (modalSearch.trim()) {
        const q = modalSearch.toLowerCase();
        const matchId = item.ticket.IDTICKET.toLowerCase().includes(q);
        const matchCli = (item.ticket.CLIENTE || '').toLowerCase().includes(q);
        const matchTec = (item.ticket.TECNICO || '').toLowerCase().includes(q);
        if (!matchId && !matchCli && !matchTec) return false;
      }
      return true;
    });
  }, [pendingCierreUpdates, onlyShowChanged, modalSearch]);

  if (loading) {
    return (
      <div className="flex-1 w-full flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="flex-1 w-full flex items-center justify-center p-4">
        <GoogleErrorCard error={error || 'No se pudieron cargar los datos'} onRetry={loadData} title="Error al cargar Tickets Cerrados" />
      </div>
    );
  }

  if (selectedTicket && data) {
    return (
      <TecnicoTicketDetail
        ticket={selectedTicket}
        data={data}
        onClose={() => setSelectedTicket(null)}
        onUpdateLocally={() => {
          // No necesitamos actualizar localmente en cerrados
        }}
      />
    );
  }

  return (
    <div className="w-full h-full flex flex-col gap-3 sm:gap-4 overflow-hidden max-w-7xl mx-auto px-1 sm:px-0">
      
      {/* Success Notification */}
      {successMessage && (
        <div className="bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 px-4 py-3 rounded-2xl flex items-center justify-between gap-3 shadow-lg shrink-0 animate-fadeIn">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <span className="text-xs sm:text-sm font-semibold">{successMessage}</span>
          </div>
          <button onClick={() => setSuccessMessage(null)} className="text-emerald-400 hover:text-white p-1">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header & Controls */}
      <div className="bg-slate-900 rounded-2xl sm:rounded-3xl p-4 sm:p-6 border border-slate-800 shadow-lg shrink-0 flex flex-col gap-4 sm:gap-6">
        <div className="flex flex-col lg:flex-row gap-3 sm:gap-6 justify-between lg:items-center">
          
          <div className="flex items-center justify-between sm:justify-start gap-3 sm:gap-4 flex-wrap">
            <h2 className="text-base sm:text-xl font-bold text-white uppercase tracking-wider sm:tracking-widest flex items-center gap-2 sm:gap-3">
              <span className="p-1.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400 flex items-center justify-center shrink-0">
                <CheckCircle className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-400" />
              </span>
              TICKETS CERRADOS
            </h2>

            <div className="flex items-center gap-1.5 sm:gap-2">
              <span className="text-xs sm:text-sm font-bold text-slate-400">Año:</span>
              <select 
                value={selectedYear} 
                onChange={(e) => setSelectedYear(parseInt(e.target.value, 10))}
                className="bg-slate-800 border border-slate-700 text-white rounded-lg px-2.5 py-1 text-xs sm:text-sm font-bold focus:outline-none focus:border-blue-500"
              >
                {availableYears.map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>

            {/* BOTÓN ACTUALIZAR CIERRE */}
            <button
              onClick={() => setShowUpdateModal(true)}
              disabled={isUpdatingCierre || !data}
              className="bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 disabled:opacity-50 text-white text-xs sm:text-sm font-bold px-3.5 py-1.5 rounded-xl border border-emerald-400/30 flex items-center gap-2 transition-all shadow-md shadow-emerald-950/40 hover:scale-[1.02] active:scale-[0.98]"
              title="Actualizar columna 'FECHA DE CIERRE' con la mayor FHFIN de ACTIVIDADES (dd/mm/AAAA)"
            >
              <RefreshCw className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${isUpdatingCierre ? 'animate-spin' : ''}`} />
              <span>Actualizar cierre</span>
            </button>
          </div>

          <div className="relative w-full lg:w-80">
            <Search className="w-4 h-4 sm:w-5 sm:h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text"
              placeholder="Buscar en tickets y actividades..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-800/80 border border-slate-700 text-white rounded-xl pl-9 sm:pl-10 pr-4 py-1.5 sm:py-2 text-xs sm:text-sm focus:outline-none focus:border-emerald-500 transition-colors"
            />
            {searchTerm && (
              <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
        
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 pt-3 sm:pt-4 border-t border-slate-800/80">
          {/* Filtrar por Mes(es) */}
          <div className="flex-1">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider block">Filtrar por Mes(es)</span>
              {selectedMonths.length > 0 && (
                <button 
                  onClick={() => setSelectedMonths([])}
                  className="text-[10px] sm:text-xs font-bold text-slate-400 hover:text-white transition-colors"
                >
                  Limpiar Meses
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5 sm:gap-2">
              {monthsList.map(m => (
                <button
                  key={m.value}
                  onClick={() => toggleMonth(m.value)}
                  className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg text-[11px] sm:text-xs font-bold transition-colors ${
                    selectedMonths.includes(m.value) 
                      ? 'bg-emerald-600 text-white shadow-md shadow-emerald-500/20' 
                      : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* Filtrar por Cliente */}
          <div className="w-full lg:w-80 shrink-0">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-emerald-400" />
                Filtrar por Cliente
              </span>
              {selectedClient !== 'TODOS' && (
                <button 
                  onClick={() => setSelectedClient('TODOS')}
                  className="text-[10px] sm:text-xs font-bold text-emerald-400 hover:text-emerald-300 transition-colors"
                >
                  Ver Todos
                </button>
              )}
            </div>
            <div className="relative">
              <select 
                value={selectedClient} 
                onChange={(e) => setSelectedClient(e.target.value)}
                className={`w-full bg-slate-800 border text-xs sm:text-sm font-semibold rounded-xl pl-3 pr-8 py-1.5 sm:py-2 focus:outline-none transition-colors truncate ${
                  selectedClient !== 'TODOS'
                    ? 'border-emerald-500 text-white bg-emerald-950/40 shadow-sm shadow-emerald-500/10'
                    : 'border-slate-700 text-slate-200 focus:border-emerald-500'
                }`}
              >
                <option value="TODOS">Todos los clientes ({availableClients.length})</option>
                {availableClients.map(c => (
                  <option key={c.name} value={c.name}>
                    {c.name} ({c.inYear > 0 ? `${c.inYear}` : `${c.total} tot.`})
                  </option>
                ))}
              </select>
              {selectedClient !== 'TODOS' && (
                <button 
                  onClick={() => setSelectedClient('TODOS')} 
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-0.5"
                  title="Limpiar filtro de cliente"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Active filters & results counter */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-xs text-slate-400 shrink-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-bold text-slate-300">
            {filteredTickets.length} {filteredTickets.length === 1 ? 'ticket cerrado' : 'tickets cerrados'}
          </span>
          {selectedClient !== 'TODOS' && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[11px] font-semibold">
              <Building2 className="w-3 h-3 text-emerald-400" />
              <span>Cliente: {selectedClient}</span>
              <button 
                onClick={() => setSelectedClient('TODOS')}
                className="hover:text-white p-0.5 ml-0.5"
                title="Quitar filtro de cliente"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
          {selectedMonths.length > 0 && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-500/15 border border-blue-500/30 text-blue-300 text-[11px] font-semibold">
              <span>{selectedMonths.length === 1 ? `Mes: ${monthsList.find(m => m.value === selectedMonths[0])?.label}` : `${selectedMonths.length} meses`}</span>
              <button 
                onClick={() => setSelectedMonths([])}
                className="hover:text-white p-0.5 ml-0.5"
                title="Limpiar meses"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
          {searchTerm && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-purple-500/15 border border-purple-500/30 text-purple-300 text-[11px] font-semibold">
              <span>"{searchTerm}"</span>
              <button 
                onClick={() => setSearchTerm('')}
                className="hover:text-white p-0.5 ml-0.5"
                title="Limpiar búsqueda"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
        </div>

        {(selectedClient !== 'TODOS' || selectedMonths.length > 0 || searchTerm) && (
          <button 
            onClick={() => {
              setSelectedClient('TODOS');
              setSelectedMonths([]);
              setSearchTerm('');
            }}
            className="text-[11px] font-semibold text-slate-400 hover:text-emerald-400 transition-colors underline"
          >
            Restablecer filtros
          </button>
        )}
      </div>

      {/* Grid of Closed Tickets */}
      <div className="flex-1 overflow-y-auto rounded-2xl sm:rounded-3xl pb-8 custom-scrollbar">
        {filteredTickets.length === 0 ? (
          <div className="text-center py-12 bg-slate-900/50 rounded-2xl sm:rounded-3xl border border-slate-800/50 p-4">
            <p className="text-slate-400 font-bold text-sm">
              {selectedClient !== 'TODOS' 
                ? `No se encontraron tickets cerrados para "${selectedClient}" en este periodo.` 
                : 'No se encontraron tickets cerrados en este periodo.'}
            </p>
            {(selectedClient !== 'TODOS' || selectedMonths.length > 0 || searchTerm) && (
              <button
                onClick={() => {
                  setSelectedClient('TODOS');
                  setSelectedMonths([]);
                  setSearchTerm('');
                }}
                className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-emerald-400 rounded-lg text-xs font-bold transition-colors"
              >
                <X className="w-3.5 h-3.5" />
                Limpiar todos los filtros
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {filteredTickets.map((t, idx) => (
              <div 
                key={idx} 
                onClick={() => setSelectedTicket(t)}
                className="bg-slate-900 border-2 border-emerald-500/30 hover:border-emerald-500 rounded-2xl p-4 sm:p-5 cursor-pointer transition-all hover:scale-[1.01] active:scale-[0.99] shadow-lg group flex flex-col gap-3"
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <div className="inline-flex items-center px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded font-bold text-[10px] uppercase tracking-wider">
                        {t.IDTICKET}
                      </div>
                      {t.NOTIFICA && (
                        <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${
                          t.NOTIFICA === 'ENVIADO' 
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' 
                            : 'bg-slate-800 text-slate-400'
                        }`}>
                          {t.NOTIFICA === 'ENVIADO' ? '✓ Notificado' : t.NOTIFICA}
                        </span>
                      )}
                    </div>
                    <h3 className="text-white font-bold text-sm truncate uppercase pr-2" title={t.CLIENTE}>{t.CLIENTE}</h3>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-emerald-400 font-bold text-base sm:text-lg">{t.SUMAXH || '00:00'}</p>
                    <p className="text-[8px] sm:text-[9px] text-slate-400 uppercase tracking-widest font-bold">Tiempo Eficaz</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-x-2 gap-y-2 mt-1">
                  <div>
                    <p className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">F.H. INGRESO</p>
                    <p className="text-slate-300 text-xs font-medium truncate">{t.FHINGRESO}</p>
                  </div>
                  <div>
                    <p className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">F.H. PROG.</p>
                    <p className="text-slate-300 text-xs font-medium truncate">{t.FHPROGRAMADA}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">TÉCNICO</p>
                    <p className="text-slate-300 text-xs font-medium truncate">{t.TECNICO}</p>
                  </div>
                  <div>
                    <p className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">CONTACTO</p>
                    <p className="text-slate-300 text-xs font-medium truncate" title={t.CONTACTO || '-'}>{t.CONTACTO || '-'}</p>
                  </div>
                  <div>
                    <p className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">TELÉFONO</p>
                    <p className="text-slate-300 text-xs font-medium truncate" title={t.TELEFONO || '-'}>{t.TELEFONO || '-'}</p>
                  </div>
                  <div>
                    <p className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">NOTIFICA</p>
                    <p className="text-slate-300 text-xs font-medium truncate">{t.NOTIFICA || '-'}</p>
                  </div>
                  <div>
                    <p className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">MODO ATENCIÓN</p>
                    <p className="text-slate-300 text-xs font-medium truncate">{t['MODO DE ATENCION'] || '-'}</p>
                  </div>
                  <div>
                    <p className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">LLEGADA A CLIENTE</p>
                    <p className="text-slate-300 text-xs font-medium truncate">{t.FHLLC || '-'}</p>
                  </div>
                  <div>
                    <p className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">SALIDA DE CLIENTE</p>
                    <p className="text-slate-300 text-xs font-medium truncate">{t.FHSC || '-'}</p>
                  </div>
                </div>

                <div className="mt-auto pt-3 border-t border-slate-800 flex justify-between items-center gap-2">
                  <div>
                    <p className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">FECHA CIERRE</p>
                    <p className="text-emerald-400 font-bold text-xs">{getFechaCierre(t) || '-'}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* MODAL ACTUALIZAR CIERRE */}
      {showUpdateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-slate-700/70 w-full max-w-3xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
            
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/90 shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400">
                  <CalendarCheck className="w-5 h-5 sm:w-6 sm:h-6" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-white">Actualizar Fecha de Cierre</h3>
                  <p className="text-xs text-slate-400">
                    Actualiza la columna <strong className="text-slate-200">FECHA DE CIERRE</strong> en la tabla <strong className="text-slate-200">TICKET</strong> con la mayor <strong className="text-slate-200">FHFIN</strong> de sus actividades.
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setShowUpdateModal(false)}
                disabled={isUpdatingCierre}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Metrics */}
            <div className="p-4 bg-slate-950/60 border-b border-slate-800 grid grid-cols-3 gap-2 sm:gap-3 text-center shrink-0">
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-2.5">
                <p className="text-[10px] font-bold text-slate-400 uppercase">Tickets Cerrados</p>
                <p className="text-base sm:text-lg font-bold text-white">{pendingCierreUpdates.length}</p>
              </div>
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-2.5">
                <p className="text-[10px] font-bold text-emerald-400 uppercase">A Actualizar</p>
                <p className="text-base sm:text-lg font-bold text-emerald-400">{pendingCierreUpdates.length}</p>
              </div>
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-2.5">
                <p className="text-[10px] font-bold text-amber-400 uppercase">Formato Fecha</p>
                <p className="text-xs sm:text-sm font-bold text-amber-300 mt-1">dd/mm/AAAA</p>
              </div>
            </div>

            {/* Filter in Modal */}
            <div className="px-4 py-2.5 bg-slate-900 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2 shrink-0">
              <div className="relative flex-1 min-w-[200px] max-w-xs">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={modalSearch}
                  onChange={(e) => setModalSearch(e.target.value)}
                  placeholder="Buscar ticket en vista previa..."
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={onlyShowChanged}
                  onChange={(e) => setOnlyShowChanged(e.target.checked)}
                  className="rounded bg-slate-800 border-slate-700 text-emerald-600 focus:ring-0"
                />
                <span>Mostrar solo los que cambiarán ({pendingCierreUpdates.filter(u => u.hasChanged).length})</span>
              </label>
            </div>

            {/* Modal Table Content */}
            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
              {modalFilteredUpdates.length === 0 ? (
                <div className="py-8 text-center text-slate-400 text-xs">
                  No hay tickets que coincidan con la búsqueda.
                </div>
              ) : (
                <div className="border border-slate-800 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead className="bg-slate-950 text-[10px] text-slate-400 uppercase font-bold border-b border-slate-800 sticky top-0">
                      <tr>
                        <th className="py-2.5 px-3">Ticket / Cliente</th>
                        <th className="py-2.5 px-3">Actividades</th>
                        <th className="py-2.5 px-3">Fecha Actual</th>
                        <th className="py-2.5 px-3 text-emerald-400">Nueva Fecha (dd/mm/AAAA)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 bg-slate-900/50">
                      {modalFilteredUpdates.map((item) => (
                        <tr key={item.ticket.IDTICKET} className="hover:bg-slate-800/40 transition-colors">
                          <td className="py-2 px-3">
                            <span className="font-bold text-white">{item.ticket.IDTICKET}</span>
                            <p className="text-[11px] text-slate-400 truncate max-w-[180px]">{item.ticket.CLIENTE}</p>
                          </td>
                          <td className="py-2 px-3">
                            <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px] font-bold">
                              {item.actCount} act.
                            </span>
                          </td>
                          <td className="py-2 px-3">
                            <span className="text-slate-400 font-mono text-[11px]">
                              {item.currentFechaCierre || '-'}
                            </span>
                          </td>
                          <td className="py-2 px-3">
                            <span className={`font-mono text-xs font-bold px-2 py-0.5 rounded ${
                              item.hasChanged 
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' 
                                : 'text-slate-300'
                            }`}>
                              {item.newFechaCierre}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-800 bg-slate-950 flex items-center justify-between gap-3 shrink-0">
              <div className="text-[11px] text-slate-400">
                Total a procesar: <strong className="text-white">{pendingCierreUpdates.length} tickets</strong>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowUpdateModal(false)}
                  disabled={isUpdatingCierre}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleExecuteActualizarCierre}
                  disabled={isUpdatingCierre || pendingCierreUpdates.length === 0}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg shadow-emerald-900/40 transition-all hover:scale-[1.02] active:scale-[0.98]"
                >
                  {isUpdatingCierre ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Actualizando en Google Sheets...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Actualizar {pendingCierreUpdates.length} Tickets</span>
                    </>
                  )}
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}

