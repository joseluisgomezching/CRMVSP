import React, { useState, useEffect, useMemo } from 'react';
import { fetchAppData, createCajaEntry, updateRutaEstado, updateActividadDiariaEstadoGasto } from '../../lib/googleApi';
import { AppData, Caja, Ruta, Transporte, ActividadDiaria } from '../../types';
import { RefreshCw, Plus, FileBarChart, DollarSign, ArrowRight, X, ChevronLeft, Car, Train, Bus, Bike, ClipboardList, CheckCircle2, Layers } from 'lucide-react';
import GoogleErrorCard from '../../components/GoogleErrorCard';

export default function CajaChicaModule() {
  const [data, setData] = useState<AppData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [activeTab, setActiveTab] = useState<'TODOS' | 'RUTAS' | 'ACTIVIDADES'>('TODOS');
  const [filterEstado, setFilterEstado] = useState('Todos');
  const [filterTecnico, setFilterTecnico] = useState('Todos');
  
  const [isAbonoModalOpen, setIsAbonoModalOpen] = useState(false);
  const [abonoAmount, setAbonoAmount] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingRouteId, setProcessingRouteId] = useState<string | null>(null);
  const [processingActId, setProcessingActId] = useState<string | null>(null);

  const [isInformeModalOpen, setIsInformeModalOpen] = useState(false);
  const [informeFechaInicial, setInformeFechaInicial] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${(d.getMonth()+1).toString().padStart(2, '0')}-01`;
  });
  const [informeFechaFinal, setInformeFechaFinal] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${(d.getMonth()+1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
  });
  const [informeTecnico, setInformeTecnico] = useState('Todos');
  const [informeData, setInformeData] = useState<any>(null);

  const parseMoney = (val: string | number | undefined | null): number => {
    if (!val) return 0;
    if (typeof val === 'number') return val;
    const cleanStr = val.replace(/S\/\.?/ig, '').replace(/s\/\./ig, '').replace(/s\//ig, '').replace(/\s/g, '').replace(/,/g, '.');
    const num = parseFloat(cleanStr);
    return isNaN(num) ? 0 : num;
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const appData = await fetchAppData();
      console.log('App Data in CajaChica:', appData);
      setData(appData);
    } catch (err: any) {
      setError(err.message || 'Error cargando datos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const saldoActualInfo = useMemo(() => {
    if (!data || !data.caja || data.caja.length === 0) {
      return { saldo: 0, ultimoAbono: 0, fecha: '-' };
    }
    
    let currentSaldo = 0;
    const lastRow = data.caja[data.caja.length - 1];
    if (lastRow && lastRow.CAJA) {
      currentSaldo = parseMoney(lastRow.CAJA);
    }

    let ultimoAbono = 0;
    let fechaAbono = '-';
    for (let i = data.caja.length - 1; i >= 0; i--) {
      const row = data.caja[i];
      if (row.ABONO && parseMoney(row.ABONO) > 0) {
        ultimoAbono = parseMoney(row.ABONO);
        fechaAbono = row.FECHA;
        break;
      }
    }

    return { saldo: currentSaldo, ultimoAbono, fecha: fechaAbono };
  }, [data]);

  const tecnicosList = useMemo(() => {
    if (!data) return [];
    const tSet = new Set<string>();
    data.rutas?.forEach(r => r.TECNICO && tSet.add(r.TECNICO.trim()));
    data.actividadesDiarias?.forEach(a => {
      if ((a.ESTADO || '').toUpperCase().trim() === 'CERRADO') {
        const tec = a['ASIGNADO A'] || a.ASIGNADO;
        if (tec && tec.trim()) tSet.add(tec.trim());
      }
    });
    return Array.from(tSet).sort();
  }, [data]);

  const filteredRoutesByTecnico = useMemo<Record<string, Ruta[]>>(() => {
    if (!data || !data.rutas) return {};
    
    let rutas = [...data.rutas];
    if (filterEstado !== 'Todos') {
      rutas = rutas.filter(r => r.ESTADO === filterEstado);
    }
    if (filterTecnico !== 'Todos') {
      rutas = rutas.filter(r => r.TECNICO === filterTecnico);
    }

    const grouped: Record<string, Ruta[]> = {};
    rutas.forEach(r => {
      const tec = r.TECNICO || 'SIN TECNICO';
      if (!grouped[tec]) grouped[tec] = [];
      grouped[tec].push(r);
    });
    
    Object.keys(grouped).forEach(k => grouped[k].reverse());
    return grouped;
  }, [data, filterEstado, filterTecnico]);

  const filteredActsByTecnico = useMemo<Record<string, ActividadDiaria[]>>(() => {
    if (!data || !data.actividadesDiarias) return {};

    // En Caja Chica mostrar solamente las actividades con ESTADO = CERRADO
    let acts = [...data.actividadesDiarias].filter(a => (a.ESTADO || '').toUpperCase().trim() === 'CERRADO');
    if (filterEstado !== 'Todos') {
      acts = acts.filter(a => (a['ESTADO GASTO'] || '').toUpperCase().trim() === filterEstado);
    }
    if (filterTecnico !== 'Todos') {
      acts = acts.filter(a => (a['ASIGNADO A'] || a.ASIGNADO || '').trim() === filterTecnico);
    }

    const grouped: Record<string, ActividadDiaria[]> = {};
    acts.forEach(a => {
      const tec = (a['ASIGNADO A'] || a.ASIGNADO || 'SIN ASIGNAR').trim();
      if (!grouped[tec]) grouped[tec] = [];
      grouped[tec].push(a);
    });

    Object.keys(grouped).forEach(k => grouped[k].reverse());
    return grouped;
  }, [data, filterEstado, filterTecnico]);

  const allTecnicosInView = useMemo(() => {
    const tSet = new Set<string>();
    if (activeTab === 'TODOS' || activeTab === 'RUTAS') {
      Object.keys(filteredRoutesByTecnico).forEach(t => tSet.add(t));
    }
    if (activeTab === 'TODOS' || activeTab === 'ACTIVIDADES') {
      Object.keys(filteredActsByTecnico).forEach(t => tSet.add(t));
    }
    return Array.from(tSet).sort();
  }, [filteredRoutesByTecnico, filteredActsByTecnico, activeTab]);

  const totalRutasCount = useMemo(() => {
    return (Object.values(filteredRoutesByTecnico) as Ruta[][]).reduce((sum, list) => sum + list.length, 0);
  }, [filteredRoutesByTecnico]);

  const totalActsCount = useMemo(() => {
    return (Object.values(filteredActsByTecnico) as ActividadDiaria[][]).reduce((sum, list) => sum + list.length, 0);
  }, [filteredActsByTecnico]);

  const getTransportIcon = (movil: string | undefined | null) => {
    switch ((movil || '').toUpperCase().trim()) {
      case 'TAXI': return <Car className="w-3.5 h-3.5 text-amber-400" />;
      case 'TREN': return <Train className="w-3.5 h-3.5 text-emerald-400" />;
      case 'METROPOLITANO': return <Bus className="w-3.5 h-3.5 text-blue-400" />;
      case 'COMBI': return <Bus className="w-3.5 h-3.5 text-purple-400" />;
      case 'CORREDOR': return <Bus className="w-3.5 h-3.5 text-indigo-400" />;
      case 'COLECTIVO': return <Car className="w-3.5 h-3.5 text-cyan-400" />;
      case 'MOTOCAR': return <Bike className="w-3.5 h-3.5 text-pink-400" />;
      default: return <Car className="w-3.5 h-3.5 text-slate-400" />;
    }
  };

  const handleNuevoAbono = async () => {
    const val = parseMoney(abonoAmount);
    if (isNaN(val) || val <= 0) return alert('Ingrese un abono mayor a 0');
    
    setIsProcessing(true);
    try {
      const maxIdNum = data?.caja?.reduce((max, c) => {
        const idNum = parseInt(c.ID.replace('CJ-', ''), 10);
        return isNaN(idNum) ? max : Math.max(max, idNum);
      }, 0) || 0;
      
      const newId = `CJ-${(maxIdNum + 1).toString().padStart(4, '0')}`;
      const now = new Date();
      const fecha = `${now.getDate().toString().padStart(2, '0')}/${(now.getMonth()+1).toString().padStart(2, '0')}/${now.getFullYear()}`;
      
      const nuevoSaldo = saldoActualInfo.saldo + val;

      const newCaja: Caja = {
        ID: newId,
        CAJA: nuevoSaldo.toFixed(2),
        ABONO: val.toFixed(2),
        FECHA: fecha
      };

      await createCajaEntry(newCaja);
      
      setData(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          caja: [...(prev.caja || []), newCaja]
        };
      });
      
      setAbonoAmount('');
      setIsAbonoModalOpen(false);
      
    } catch (err: any) {
      alert(`Error al registrar abono: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleToggleEstado = async (ruta: Ruta) => {
    if (processingRouteId || processingActId) return;
    const isCancelado = ruta.ESTADO === 'CANCELADO';
    const nuevoEstado = isCancelado ? 'NO CANCELADO' : 'CANCELADO';
    const monto = parseMoney(ruta.MONTO);
    
    if (isNaN(monto)) return alert('La ruta no tiene un monto válido');
    if (!isCancelado && saldoActualInfo.saldo < monto) {
      return alert('Saldo insuficiente en Caja Chica para pagar esta ruta.');
    }

    setProcessingRouteId(ruta.ID);
    try {
      await updateRutaEstado(ruta.ID, nuevoEstado);
      
      const maxIdNum = data?.caja?.reduce((max, c) => {
        const idNum = parseInt(c.ID.replace('CJ-', ''), 10);
        return isNaN(idNum) ? max : Math.max(max, idNum);
      }, 0) || 0;
      
      const newId = `CJ-${(maxIdNum + 1).toString().padStart(4, '0')}`;
      const now = new Date();
      const fecha = `${now.getDate().toString().padStart(2, '0')}/${(now.getMonth()+1).toString().padStart(2, '0')}/${now.getFullYear()}`;
      
      const nuevoSaldo = isCancelado ? saldoActualInfo.saldo + monto : saldoActualInfo.saldo - monto;
      const abonoReg = isCancelado ? monto.toFixed(2) : '0.00';

      const newCaja: Caja = {
        ID: newId,
        CAJA: nuevoSaldo.toFixed(2),
        ABONO: abonoReg,
        FECHA: fecha
      };

      await createCajaEntry(newCaja);

      setData(prev => {
        if (!prev) return prev;
        
        const newRutas = (prev.rutas || []).map(r => 
          r.ID === ruta.ID ? { ...r, ESTADO: nuevoEstado } : r
        );
        
        return {
          ...prev,
          rutas: newRutas,
          caja: [...(prev.caja || []), newCaja]
        };
      });

    } catch (err: any) {
      alert(`Error procesando la transacción: ${err.message}`);
    } finally {
      setProcessingRouteId(null);
    }
  };

  const handleToggleEstadoActividad = async (act: ActividadDiaria) => {
    if (processingActId || processingRouteId) return;
    const isCancelado = (act['ESTADO GASTO'] || '').toUpperCase().trim() === 'CANCELADO';
    const nuevoEstadoGasto = isCancelado ? 'NO CANCELADO' : 'CANCELADO';
    
    const actTranacti = (data?.tranacti || []).filter(t => (t.IDRUTA || '').trim().toUpperCase() === (act.ID || '').trim().toUpperCase());
    const sumTranacti = actTranacti.reduce((sum, t) => sum + parseMoney(t.PASAJE), 0);
    const pasajeMonto = actTranacti.length > 0 ? sumTranacti : parseMoney(act['GASTO DE PASAJE']);
    const adicionalMonto = parseMoney(act['GASTO ADICIONAL']);
    const storedTotal = parseMoney(act['MONTO TOTAL']);
    const monto = storedTotal > 0 ? storedTotal : (pasajeMonto + adicionalMonto);
    
    if (isNaN(monto) || monto < 0) return alert('La actividad no tiene un monto total válido');
    if (!isCancelado && saldoActualInfo.saldo < monto) {
      return alert('Saldo insuficiente en Caja Chica para cancelar el gasto de esta actividad.');
    }

    setProcessingActId(act.ID);
    try {
      await updateActividadDiariaEstadoGasto(act.ID, nuevoEstadoGasto, (act as any)._rowIndex);
      
      const maxIdNum = data?.caja?.reduce((max, c) => {
        const idNum = parseInt(c.ID.replace('CJ-', ''), 10);
        return isNaN(idNum) ? max : Math.max(max, idNum);
      }, 0) || 0;
      
      const newId = `CJ-${(maxIdNum + 1).toString().padStart(4, '0')}`;
      const now = new Date();
      const fecha = `${now.getDate().toString().padStart(2, '0')}/${(now.getMonth()+1).toString().padStart(2, '0')}/${now.getFullYear()}`;
      
      const nuevoSaldo = isCancelado ? saldoActualInfo.saldo + monto : saldoActualInfo.saldo - monto;
      const abonoReg = isCancelado ? monto.toFixed(2) : '0.00';

      const newCaja: Caja = {
        ID: newId,
        CAJA: nuevoSaldo.toFixed(2),
        ABONO: abonoReg,
        FECHA: fecha
      };

      await createCajaEntry(newCaja);

      setData(prev => {
        if (!prev) return prev;
        
        const newActs = (prev.actividadesDiarias || []).map(a => 
          a.ID === act.ID ? { ...a, 'ESTADO GASTO': nuevoEstadoGasto } : a
        );
        
        return {
          ...prev,
          actividadesDiarias: newActs,
          caja: [...(prev.caja || []), newCaja]
        };
      });

    } catch (err: any) {
      alert(`Error procesando la transacción de la actividad: ${err.message}`);
    } finally {
      setProcessingActId(null);
    }
  };

  const parseDate = (dStr: string) => {
    if(!dStr) return 0;
    const parts = dStr.split('/');
    if(parts.length === 3) {
      return new Date(parseInt(parts[2]), parseInt(parts[1])-1, parseInt(parts[0])).getTime();
    }
    return 0;
  };

  const generarInforme = () => {
    if (!data) return;
    const iniParts = informeFechaInicial.split('-');
    const endParts = informeFechaFinal.split('-');
    
    if(iniParts.length !== 3 || endParts.length !== 3) return;
    
    const start = new Date(parseInt(iniParts[0]), parseInt(iniParts[1])-1, parseInt(iniParts[2]), 0, 0, 0).getTime();
    const end = new Date(parseInt(endParts[0]), parseInt(endParts[1])-1, parseInt(endParts[2]), 23, 59, 59).getTime();

    // Abonos
    const abonos = (data.caja || []).filter(c => {
      if(!c.ABONO || parseMoney(c.ABONO) <= 0) return false;
      const t = parseDate(c.FECHA);
      return t >= start && t <= end;
    });
    
    const totalAbonos = abonos.reduce((s, c) => s + parseMoney(c.ABONO), 0);

    // Rutas
    let rutasInPeriod = (data.rutas || []).filter(r => {
      const t = parseDate(r.FECHA);
      return t >= start && t <= end;
    });

    if (informeTecnico !== 'Todos') {
      rutasInPeriod = rutasInPeriod.filter(r => r.TECNICO === informeTecnico);
    }

    const rutasCanceladas = rutasInPeriod.filter(r => r.ESTADO === 'CANCELADO');
    const rutasNoCanceladas = rutasInPeriod.filter(r => r.ESTADO === 'NO CANCELADO');

    // Actividades (solo con ESTADO = CERRADO)
    let actsInPeriod = (data.actividadesDiarias || []).filter(a => {
      if ((a.ESTADO || '').toUpperCase().trim() !== 'CERRADO') return false;
      const t = parseDate(a.FECHA);
      return t >= start && t <= end;
    });

    if (informeTecnico !== 'Todos') {
      actsInPeriod = actsInPeriod.filter(a => (a['ASIGNADO A'] || a.ASIGNADO) === informeTecnico);
    }

    const actsCanceladas = actsInPeriod.filter(a => (a['ESTADO GASTO'] || '').toUpperCase().trim() === 'CANCELADO');
    const actsNoCanceladas = actsInPeriod.filter(a => (a['ESTADO GASTO'] || '').toUpperCase().trim() !== 'CANCELADO');

    const getActMonto = (a: ActividadDiaria) => {
      const actTranacti = (data.tranacti || []).filter(t => (t.IDRUTA || '').trim().toUpperCase() === (a.ID || '').trim().toUpperCase());
      const sumTranacti = actTranacti.reduce((sum, t) => sum + parseMoney(t.PASAJE), 0);
      const pasajeMonto = actTranacti.length > 0 ? sumTranacti : parseMoney(a['GASTO DE PASAJE']);
      const adicionalMonto = parseMoney(a['GASTO ADICIONAL']);
      const stored = parseMoney(a['MONTO TOTAL']);
      return stored > 0 ? stored : (pasajeMonto + adicionalMonto);
    };

    const totalGastadoRutas = rutasCanceladas.reduce((s, r) => s + parseMoney(r.MONTO), 0);
    const totalGastadoActs = actsCanceladas.reduce((s, a) => s + getActMonto(a), 0);
    const totalGastado = totalGastadoRutas + totalGastadoActs;

    const totalPendienteRutas = rutasNoCanceladas.reduce((s, r) => s + parseMoney(r.MONTO), 0);
    const totalPendienteActs = actsNoCanceladas.reduce((s, a) => s + getActMonto(a), 0);
    const totalPendiente = totalPendienteRutas + totalPendienteActs;

    // Gastos por tecnico
    const gastosTecnico: Record<string, { cantRutas: number, cantActs: number, total: number }> = {};
    rutasCanceladas.forEach(r => {
      const tec = r.TECNICO || 'SIN TECNICO';
      if (!gastosTecnico[tec]) gastosTecnico[tec] = { cantRutas: 0, cantActs: 0, total: 0 };
      gastosTecnico[tec].cantRutas++;
      gastosTecnico[tec].total += parseMoney(r.MONTO);
    });
    actsCanceladas.forEach(a => {
      const tec = (a['ASIGNADO A'] || a.ASIGNADO || 'SIN ASIGNAR').trim();
      if (!gastosTecnico[tec]) gastosTecnico[tec] = { cantRutas: 0, cantActs: 0, total: 0 };
      gastosTecnico[tec].cantActs++;
      gastosTecnico[tec].total += getActMonto(a);
    });

    setInformeData({
      totalAbonos,
      totalGastado,
      totalPendiente,
      rutasCanceladas,
      rutasNoCanceladas,
      actsCanceladas,
      actsNoCanceladas,
      abonos,
      gastosTecnico: Object.entries(gastosTecnico).map(([tec, vals]) => ({ tec, ...vals }))
    });
  };

  if (loading && !data) {
    return (
      <div className="flex-1 w-full flex items-center justify-center bg-[#0B1120]">
        <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex-1 w-full flex items-center justify-center bg-[#0B1120] p-4">
        <GoogleErrorCard error={error || 'No se pudieron cargar los datos'} onRetry={loadData} title="Error en Caja Chica" />
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 w-full h-full bg-[#0B1120] text-slate-300 font-sans relative overflow-y-auto custom-scrollbar">
      
      {/* HEADER */}
      <header className="px-3 sm:px-6 py-3 sm:py-4 border-b border-slate-800 bg-[#111827] flex justify-between items-center z-10 shrink-0 sticky top-0">
        <div className="flex items-center gap-2.5 sm:gap-3">
          <div className="bg-blue-900/30 p-1.5 sm:p-2 rounded-lg border border-blue-800/50 text-blue-400">
            <DollarSign className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div>
            <h1 className="text-base sm:text-xl font-bold text-white tracking-wide">Caja Chica</h1>
            <p className="text-[10px] sm:text-xs text-slate-500 hidden xs:block">Control de gastos, rendiciones y movimientos menores.</p>
          </div>
        </div>
        <button 
          onClick={loadData} 
          disabled={loading}
          className="flex items-center gap-1.5 sm:gap-2 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-bold transition-all disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${loading ? 'animate-spin' : ''}`} />
          <span className="hidden xs:inline">Actualizar</span>
        </button>
      </header>

      {/* DASHBOARD TOP PANELS */}
      <div className="px-3 sm:px-6 py-3 sm:py-6 flex flex-col md:flex-row gap-3 sm:gap-6 shrink-0">
        
        {/* SALDO ACTUAL */}
        <div className="flex-1 bg-[#111827] border border-slate-800 rounded-xl sm:rounded-2xl p-4 sm:p-6 flex items-center justify-between shadow-lg relative overflow-hidden">
          <div className="z-10 relative">
            <p className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 sm:mb-2 flex items-center gap-1.5 sm:gap-2">
              CAJA / SALDO ACTUAL
              {saldoActualInfo.saldo <= 0 && <span className="bg-red-900/50 text-red-400 border border-red-900 px-1.5 py-0.5 rounded-sm text-[8.5px] animate-pulse">SOLICITA ABONO</span>}
            </p>
            <p className="text-3xl sm:text-4xl md:text-5xl font-black text-white tracking-tighter">
              <span className="text-slate-500 mr-1 text-2xl sm:text-3xl">S/</span>
              {saldoActualInfo.saldo.toFixed(2)}
            </p>
          </div>
          <div className="bg-emerald-500/10 p-3 sm:p-4 rounded-xl border border-emerald-500/20 z-10 text-emerald-500 shrink-0">
            <DollarSign className="w-6 h-6 sm:w-8 sm:h-8" />
          </div>
          <div className="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-emerald-500/5 to-transparent pointer-events-none"></div>
        </div>

        {/* ULTIMO ABONO */}
        <div className="md:w-80 bg-[#111827] border border-slate-800 rounded-xl sm:rounded-2xl p-4 sm:p-6 flex items-center justify-between shadow-lg relative gap-2 sm:gap-3">
          <div className="flex items-center gap-2 sm:gap-3 w-full pr-10 sm:pr-0">
            <div className="bg-[#0B1120] border border-slate-800 rounded-xl p-2.5 sm:p-3 flex-1">
              <p className="text-[8.5px] sm:text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-0.5">Último Abono</p>
              <p className="text-sm sm:text-lg font-bold text-slate-200">S/ {saldoActualInfo.ultimoAbono.toFixed(2)}</p>
            </div>
            <div className="bg-[#0B1120] border border-slate-800 rounded-xl p-2.5 sm:p-3 flex-1">
              <p className="text-[8.5px] sm:text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-0.5">Fecha</p>
              <p className="text-xs sm:text-sm font-bold text-slate-200 mt-0.5">{saldoActualInfo.fecha}</p>
            </div>
          </div>
          
          <button 
            onClick={() => setIsAbonoModalOpen(true)}
            className="absolute right-2 sm:-right-4 top-1/2 -translate-y-1/2 bg-emerald-600 hover:bg-emerald-500 text-white w-10 h-10 sm:w-12 sm:h-12 rounded-xl shadow-[0_0_20px_rgba(16,185,129,0.3)] flex items-center justify-center transition-transform hover:scale-110 active:scale-95 z-10"
            title="Registrar Nuevo Abono"
          >
            <Plus className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
        </div>

      </div>

      {/* BODY SECTIONS */}
      <div className="flex flex-col px-3 sm:px-6 pb-20 sm:pb-12">
        
        {/* Title, Tabs and Filters */}
        <div className="flex flex-col gap-2.5 sm:gap-4 mb-3 sm:mb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <h2 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                Gastos agrupados por técnico
              </h2>
              <span className="bg-[#111827] border border-slate-800 px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full text-[10px] sm:text-xs font-bold text-slate-400">
                {allTecnicosInView.length} Técnicos
              </span>
            </div>

            {/* TAB SELECTOR */}
            <div className="flex bg-[#111827] p-1 rounded-xl border border-slate-800 self-start sm:self-auto">
              <button
                onClick={() => setActiveTab('TODOS')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  activeTab === 'TODOS'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>TODOS</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                  activeTab === 'TODOS' ? 'bg-blue-800/80 text-white' : 'bg-slate-800 text-slate-400'
                }`}>
                  {totalRutasCount + totalActsCount}
                </span>
              </button>

              <button
                onClick={() => setActiveTab('RUTAS')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  activeTab === 'RUTAS'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Car className="w-3.5 h-3.5" />
                <span>RUTAS</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                  activeTab === 'RUTAS' ? 'bg-blue-800/80 text-white' : 'bg-slate-800 text-slate-400'
                }`}>
                  {totalRutasCount}
                </span>
              </button>

              <button
                onClick={() => setActiveTab('ACTIVIDADES')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  activeTab === 'ACTIVIDADES'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <ClipboardList className="w-3.5 h-3.5" />
                <span>ACTIVIDADES</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                  activeTab === 'ACTIVIDADES' ? 'bg-indigo-800/80 text-white' : 'bg-slate-800 text-slate-400'
                }`}>
                  {totalActsCount}
                </span>
              </button>
            </div>
          </div>

          <div className="bg-[#111827] border border-slate-800 rounded-xl p-2.5 sm:p-3 flex flex-col sm:flex-row flex-wrap gap-2.5 sm:gap-4 items-stretch sm:items-end">
            <div className="flex flex-col gap-1 flex-1 min-w-[140px]">
              <label className="text-[9px] sm:text-[10px] font-bold text-slate-500 uppercase tracking-widest">Estado Gasto / Ruta</label>
              <select 
                value={filterEstado}
                onChange={e => setFilterEstado(e.target.value)}
                className="w-full bg-[#0B1120] border border-slate-800 rounded-lg px-2.5 py-1.5 sm:py-2 text-xs sm:text-sm text-slate-200 focus:outline-none focus:border-blue-500"
              >
                <option value="Todos">Todos</option>
                <option value="NO CANCELADO">NO CANCELADO</option>
                <option value="CANCELADO">CANCELADO</option>
              </select>
            </div>
            
            <div className="flex flex-col gap-1 flex-1 min-w-[140px]">
              <label className="text-[9px] sm:text-[10px] font-bold text-slate-500 uppercase tracking-widest">Técnico</label>
              <select 
                value={filterTecnico}
                onChange={e => setFilterTecnico(e.target.value)}
                className="w-full bg-[#0B1120] border border-slate-800 rounded-lg px-2.5 py-1.5 sm:py-2 text-xs sm:text-sm text-slate-200 focus:outline-none focus:border-blue-500"
              >
                <option value="Todos">Todos</option>
                {tecnicosList.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            <button 
              onClick={() => setIsInformeModalOpen(true)}
              className="bg-blue-900/50 hover:bg-blue-800/60 border border-blue-500/30 text-blue-300 px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-bold flex items-center justify-center gap-2 h-[36px] sm:h-[38px] transition-colors"
            >
              <FileBarChart className="w-4 h-4" />
              Informe Caja
            </button>
          </div>
        </div>

        {/* Groups List by Técnico */}
        <div className="space-y-4 sm:space-y-6">
          {allTecnicosInView.map((tecnico: string) => {
            const rutas = filteredRoutesByTecnico[tecnico] || [];
            const acts = filteredActsByTecnico[tecnico] || [];

            const showRutas = (activeTab === 'TODOS' || activeTab === 'RUTAS') && rutas.length > 0;
            const showActs = (activeTab === 'TODOS' || activeTab === 'ACTIVIDADES') && acts.length > 0;

            if (!showRutas && !showActs) return null;

            return (
              <div key={tecnico} className="flex flex-col">
                
                <div className="bg-blue-700/80 border border-blue-600 rounded-t-xl px-3 sm:px-4 py-2 flex justify-between items-center shadow-md z-10">
                  <h3 className="text-xs sm:text-sm font-bold text-white tracking-widest uppercase truncate max-w-[240px] sm:max-w-none">{tecnico}</h3>
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    {showRutas && (
                      <span className="bg-[#0B1120]/60 text-blue-200 text-[10px] sm:text-xs font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                        <Car className="w-3 h-3 text-blue-300" />
                        {rutas.length} Rutas
                      </span>
                    )}
                    {showActs && (
                      <span className="bg-[#0B1120]/60 text-indigo-200 text-[10px] sm:text-xs font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                        <ClipboardList className="w-3 h-3 text-indigo-300" />
                        {acts.length} Actividades
                      </span>
                    )}
                  </div>
                </div>

                <div className="bg-[#111827] border border-slate-800 border-t-0 rounded-b-xl p-2 sm:p-2.5 space-y-2 relative">
                  
                  {/* RUTAS CARDS */}
                  {showRutas && rutas.map(r => {
                    const isCancelado = r.ESTADO === 'CANCELADO';
                    const routeTransports = data?.transporte?.filter(t => t.IDRUTA === r.ID) || [];
                    const isProcessingThis = processingRouteId === r.ID;
                    
                    return (
                      <div key={r.ID} className={`bg-[#0B1120] border rounded-lg p-3 sm:p-4 transition-all relative overflow-hidden ${isCancelado ? 'border-slate-800 opacity-70' : 'border-slate-700 hover:border-slate-500'}`}>
                        {isProcessingThis && (
                          <div className="absolute inset-0 bg-[#0B1120]/80 backdrop-blur-sm z-20 flex items-center justify-center">
                            <div className="animate-spin w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full"></div>
                          </div>
                        )}
                        
                        {/* Top Row: ID, Ticket, Total */}
                        <div className="flex justify-between items-start mb-3">
                          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                            <span className="font-['JetBrains_Mono'] text-[11px] sm:text-xs font-bold text-slate-300 bg-slate-800 px-2 py-0.5 sm:py-1 rounded">{r.ID}</span>
                            <span className="text-xs text-slate-500">/</span>
                            <span className="text-[11px] sm:text-xs font-bold text-amber-500 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 sm:py-1 rounded">{r['TICKET/ACTIVIDAD']}</span>
                            <span className="text-[10px] font-bold text-slate-400 bg-slate-800/80 px-1.5 py-0.5 rounded border border-slate-700">RUTA</span>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-base sm:text-lg font-black text-white">
                              <span className="text-[10px] sm:text-xs text-slate-500 mr-0.5 sm:mr-1 font-bold">S/</span>
                              {parseMoney(r.MONTO).toFixed(2)}
                            </p>
                          </div>
                        </div>

                        {/* Route Path & Transports */}
                        <div className="flex flex-col md:flex-row gap-2 sm:gap-4 items-stretch md:items-center mb-3 bg-[#111827] p-2 sm:p-3 rounded-lg border border-slate-800/80">
                          <div className="flex-1 w-full bg-[#0B1120] border border-slate-800 rounded px-2.5 py-1.5 sm:py-2">
                            <p className="text-[8.5px] sm:text-[9px] text-slate-500 font-bold uppercase mb-0.5">Origen</p>
                            <p className="text-xs sm:text-sm font-bold text-slate-200 break-words" title={r.ORIGEN}>{r.ORIGEN}</p>
                          </div>
                          
                          <div className="flex flex-wrap items-center justify-center gap-1 sm:gap-1.5 py-1 md:py-0">
                            {routeTransports.map(t => (
                              <div key={t.ID} className="bg-slate-800 border border-slate-700 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded flex items-center gap-1">
                                <span className="text-slate-400">{getTransportIcon(t.MOVIL)}</span>
                                <span className="text-[9px] sm:text-[10px] font-bold text-slate-300">{t.MOVIL}</span>
                                <span className="text-[9px] sm:text-[10px] font-bold text-amber-500 ml-0.5">{parseMoney(t.PASAJE).toFixed(2)}</span>
                              </div>
                            ))}
                          </div>

                          <div className="flex-1 w-full bg-[#0B1120] border border-slate-800 rounded px-2.5 py-1.5 sm:py-2 text-left md:text-right">
                            <p className="text-[8.5px] sm:text-[9px] text-slate-500 font-bold uppercase mb-0.5">Destino</p>
                            <p className="text-xs sm:text-sm font-bold text-slate-200 break-words" title={r.DESTINO}>{r.DESTINO}</p>
                          </div>
                        </div>

                        {/* Bottom Row: Motivo, Fecha, Action */}
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2.5 sm:gap-4 mt-2">
                          <div className="flex flex-1 gap-4 w-full">
                            <div className="flex-1">
                              <p className="text-[8.5px] sm:text-[9px] text-slate-500 font-bold uppercase mb-0.5">Motivo</p>
                              <p className="text-xs text-slate-400 font-medium line-clamp-2" title={r.MOTIVO}>{r.MOTIVO}</p>
                            </div>
                            <div className="shrink-0 text-right sm:text-left">
                              <p className="text-[8.5px] sm:text-[9px] text-slate-500 font-bold uppercase mb-0.5">Fecha</p>
                              <p className="text-xs text-slate-400 font-medium">{r.FECHA}</p>
                            </div>
                          </div>

                          <div className="flex items-center justify-between sm:justify-end w-full sm:w-auto gap-2 sm:gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-800/60">
                            <span className="text-[9.5px] sm:text-[10px] font-bold text-slate-500 uppercase">ESTADO:</span>
                            <button
                              onClick={() => handleToggleEstado(r)}
                              disabled={isProcessingThis || !!processingRouteId || !!processingActId}
                              className={`px-3.5 sm:px-4 py-1.5 rounded-full text-xs font-bold border transition-all ${
                                isCancelado 
                                  ? 'bg-emerald-900/30 text-emerald-400 border-emerald-900 hover:bg-emerald-800/50' 
                                  : 'bg-red-600 hover:bg-red-500 text-white border-red-500 shadow-[0_0_10px_rgba(220,38,38,0.4)]'
                              }`}
                            >
                              {isCancelado ? 'CANCELADO' : 'NO CANCELADO'}
                            </button>
                          </div>
                        </div>

                      </div>
                    );
                  })}

                  {/* ACTIVIDADES DIARIAS CARDS */}
                  {showActs && acts.map(act => {
                    const isCancelado = (act['ESTADO GASTO'] || '').toUpperCase().trim() === 'CANCELADO';
                    const isProcessingThis = processingActId === act.ID;
                    
                    // TRANACTI asociado por IDRUTA === act.ID
                    const actTranacti = (data?.tranacti || []).filter(t => (t.IDRUTA || '').trim().toUpperCase() === (act.ID || '').trim().toUpperCase());
                    const sumTranactiPasaje = actTranacti.reduce((sum, t) => sum + parseMoney(t.PASAJE), 0);
                    const pasajeMonto = actTranacti.length > 0 ? sumTranactiPasaje : parseMoney(act['GASTO DE PASAJE']);
                    const adicionalMonto = parseMoney(act['GASTO ADICIONAL']);
                    const storedTotal = parseMoney(act['MONTO TOTAL']);
                    const totalMonto = storedTotal > 0 ? storedTotal : (pasajeMonto + adicionalMonto);
                    
                    return (
                      <div key={act.ID} className={`bg-[#0B1120] border rounded-lg p-3 sm:p-4 transition-all relative overflow-hidden ${isCancelado ? 'border-slate-800 opacity-70' : 'border-indigo-950/80 hover:border-indigo-700/60'}`}>
                        {isProcessingThis && (
                          <div className="absolute inset-0 bg-[#0B1120]/80 backdrop-blur-sm z-20 flex items-center justify-center">
                            <div className="animate-spin w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full"></div>
                          </div>
                        )}
                        
                        {/* Top Row: ID, Tipo Badge, Total */}
                        <div className="flex justify-between items-start mb-3">
                          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                            <span className="font-['JetBrains_Mono'] text-[11px] sm:text-xs font-bold text-slate-300 bg-slate-800 px-2 py-0.5 sm:py-1 rounded">{act.ID}</span>
                            <span className="text-xs text-slate-500">/</span>
                            <span className="text-[11px] sm:text-xs font-bold text-indigo-400 bg-indigo-500/10 border border-indigo-500/30 px-2 py-0.5 sm:py-1 rounded flex items-center gap-1">
                              <ClipboardList className="w-3 h-3" />
                              ACTIVIDADES DIARIAS
                            </span>
                            {actTranacti.length > 0 && (
                              <span className="text-[10px] font-bold text-cyan-300 bg-cyan-950/60 border border-cyan-800/60 px-2 py-0.5 rounded flex items-center gap-1">
                                <Car className="w-3 h-3 text-cyan-400" />
                                TRANACTI ({actTranacti.length})
                              </span>
                            )}
                            {act.ESTADO && (
                              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                                act.ESTADO === 'CERRADO' ? 'bg-emerald-950/40 text-emerald-400 border-emerald-800/40' :
                                act.ESTADO === 'EN ATENCION' ? 'bg-amber-950/40 text-amber-400 border-amber-800/40' :
                                'bg-blue-950/40 text-blue-400 border-blue-800/40'
                              }`}>
                                {act.ESTADO}
                              </span>
                            )}
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-base sm:text-lg font-black text-white">
                              <span className="text-[10px] sm:text-xs text-slate-500 mr-0.5 sm:mr-1 font-bold">S/</span>
                              {totalMonto.toFixed(2)}
                            </p>
                          </div>
                        </div>

                        {/* Route Path & Expenses breakdown */}
                        <div className="flex flex-col md:flex-row gap-2 sm:gap-4 items-stretch md:items-center mb-3 bg-[#111827] p-2 sm:p-3 rounded-lg border border-slate-800/80">
                          <div className="flex-1 w-full bg-[#0B1120] border border-slate-800 rounded px-2.5 py-1.5 sm:py-2">
                            <p className="text-[8.5px] sm:text-[9px] text-slate-500 font-bold uppercase mb-0.5">Ida (Origen)</p>
                            <p className="text-xs sm:text-sm font-bold text-slate-200 break-words" title={act.IDA || 'No especificado'}>
                              {act.IDA || 'No especificado'}
                            </p>
                          </div>
                          
                          <div className="flex flex-wrap items-center justify-center gap-1 sm:gap-1.5 py-1 md:py-0">
                            {actTranacti.length > 0 ? (
                              actTranacti.map(t => (
                                <div key={t.ID} className="bg-slate-800 border border-slate-700 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded flex items-center gap-1 shadow-sm" title={`TRANACTI ${t.ID}: ${t.MOVIL} - S/ ${parseMoney(t.PASAJE).toFixed(2)}`}>
                                  {getTransportIcon(t.MOVIL)}
                                  <span className="text-[9px] sm:text-[10px] font-bold text-slate-300">{t.MOVIL}</span>
                                  <span className="text-[9px] sm:text-[10px] font-bold text-amber-400 font-mono ml-0.5">{parseMoney(t.PASAJE).toFixed(2)}</span>
                                </div>
                              ))
                            ) : pasajeMonto > 0 ? (
                              <div className="bg-slate-800 border border-slate-700 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded flex items-center gap-1">
                                <Bus className="w-3.5 h-3.5 text-slate-400" />
                                <span className="text-[9px] sm:text-[10px] font-bold text-slate-300">Pasaje</span>
                                <span className="text-[9px] sm:text-[10px] font-bold text-amber-500 font-mono ml-0.5">S/ {pasajeMonto.toFixed(2)}</span>
                              </div>
                            ) : null}
                            {adicionalMonto > 0 && (
                              <div className="bg-slate-800 border border-slate-700 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded flex items-center gap-1">
                                <Plus className="w-3.5 h-3.5 text-emerald-400" />
                                <span className="text-[9px] sm:text-[10px] font-bold text-slate-300">Adicional</span>
                                <span className="text-[9px] sm:text-[10px] font-bold text-emerald-400 font-mono ml-0.5">S/ {adicionalMonto.toFixed(2)}</span>
                              </div>
                            )}
                            {actTranacti.length === 0 && pasajeMonto === 0 && adicionalMonto === 0 && (
                              <div className="text-[10px] text-slate-500 italic px-2">
                                Sin desglose de pasaje
                              </div>
                            )}
                          </div>

                          <div className="flex-1 w-full bg-[#0B1120] border border-slate-800 rounded px-2.5 py-1.5 sm:py-2 text-left md:text-right">
                            <p className="text-[8.5px] sm:text-[9px] text-slate-500 font-bold uppercase mb-0.5">Vuelta (Destino)</p>
                            <p className="text-xs sm:text-sm font-bold text-slate-200 break-words" title={act.VUELTA || 'No especificado'}>
                              {act.VUELTA || 'No especificado'}
                            </p>
                          </div>
                        </div>

                        {/* DETALLE TRANACTI ASOCIADO (PARA SABER EL DETALLE) */}
                        {actTranacti.length > 0 && (
                          <div className="mb-3 bg-[#080d19] border border-cyan-950/70 rounded-xl p-2.5 sm:p-3">
                            <div className="flex flex-wrap items-center justify-between gap-2 mb-2 pb-1.5 border-b border-slate-800/80">
                              <div className="flex items-center gap-1.5">
                                <Car className="w-3.5 h-3.5 text-cyan-400" />
                                <span className="text-[10px] sm:text-[11px] font-bold text-cyan-300 uppercase tracking-wider">
                                  Detalle TRANACTI Asociado ({actTranacti.length} {actTranacti.length === 1 ? 'segmento' : 'segmentos'})
                                </span>
                              </div>
                              <div className="flex items-center gap-3 text-[10px] text-slate-400">
                                <span>Subtotal Pasajes: <strong className="text-amber-400 font-mono">S/ {sumTranactiPasaje.toFixed(2)}</strong></span>
                                {adicionalMonto > 0 && (
                                  <span>+ Adicional: <strong className="text-emerald-400 font-mono">S/ {adicionalMonto.toFixed(2)}</strong></span>
                                )}
                              </div>
                            </div>
                            
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                              {actTranacti.map(t => (
                                <div 
                                  key={t.ID} 
                                  className="flex items-center justify-between p-2 bg-[#0B1120] border border-slate-800/90 rounded-lg hover:border-slate-700 transition-colors"
                                >
                                  <div className="flex items-center gap-2 min-w-0">
                                    <span className="font-['JetBrains_Mono'] text-[9.5px] font-bold text-indigo-400 bg-indigo-950/80 border border-indigo-900/60 px-1.5 py-0.5 rounded shrink-0">
                                      {t.ID}
                                    </span>
                                    <div className="flex items-center gap-1.5 text-xs font-semibold text-white truncate">
                                      {getTransportIcon(t.MOVIL)}
                                      <span className="truncate">{t.MOVIL}</span>
                                    </div>
                                  </div>
                                  <span className="font-['JetBrains_Mono'] font-bold text-amber-400 text-xs shrink-0 ml-2">
                                    S/ {parseMoney(t.PASAJE).toFixed(2)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Bottom Row: Motivo, Fecha, Action */}
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2.5 sm:gap-4 mt-2">
                          <div className="flex flex-1 gap-4 w-full">
                            <div className="flex-1">
                              <p className="text-[8.5px] sm:text-[9px] text-slate-500 font-bold uppercase mb-0.5">Motivo de la Actividad</p>
                              <p className="text-xs text-slate-300 font-medium line-clamp-2" title={act['MOTIVO DE LA ACTIVIDAD']}>
                                {act['MOTIVO DE LA ACTIVIDAD'] || '-'}
                              </p>
                            </div>
                            <div className="shrink-0 text-right sm:text-left">
                              <p className="text-[8.5px] sm:text-[9px] text-slate-500 font-bold uppercase mb-0.5">Fecha</p>
                              <p className="text-xs text-slate-400 font-medium">{act.FECHA || '-'}</p>
                              {act['CREADO POR'] && (
                                <p className="text-[10px] text-slate-500 truncate max-w-[120px]" title={act['CREADO POR']}>
                                  Por: {act['CREADO POR']}
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center justify-between sm:justify-end w-full sm:w-auto gap-2 sm:gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-800/60">
                            <span className="text-[9.5px] sm:text-[10px] font-bold text-slate-500 uppercase">ESTADO GASTO:</span>
                            <button
                              onClick={() => handleToggleEstadoActividad(act)}
                              disabled={isProcessingThis || !!processingRouteId || !!processingActId}
                              className={`px-3.5 sm:px-4 py-1.5 rounded-full text-xs font-bold border transition-all ${
                                isCancelado 
                                  ? 'bg-emerald-900/30 text-emerald-400 border-emerald-900 hover:bg-emerald-800/50' 
                                  : 'bg-red-600 hover:bg-red-500 text-white border-red-500 shadow-[0_0_10px_rgba(220,38,38,0.4)]'
                              }`}
                            >
                              {isCancelado ? 'CANCELADO' : 'NO CANCELADO'}
                            </button>
                          </div>
                        </div>

                      </div>
                    );
                  })}

                </div>

              </div>
            );
          })}

          {allTecnicosInView.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-slate-500">
              <p>No se encontraron registros con los filtros actuales.</p>
            </div>
          )}
        </div>
      </div>

      {/* MODAL NUEVO ABONO */}
      {isAbonoModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[#111827] border border-slate-700 rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
            <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-[#0B1120]">
              <h3 className="font-bold text-white flex items-center gap-2">
                <Plus className="w-5 h-5 text-emerald-500" />
                Registrar Nuevo Abono
              </h3>
              <button onClick={() => setIsAbonoModalOpen(false)} className="text-slate-500 hover:text-slate-300"><X className="w-5 h-5" /></button>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="flex justify-between items-center p-3 bg-slate-900 rounded-lg border border-slate-800">
                <span className="text-xs font-bold text-slate-500 uppercase">Saldo Actual</span>
                <span className="font-bold text-slate-200">S/ {saldoActualInfo.saldo.toFixed(2)}</span>
              </div>
              
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase mb-2 block">Monto a abonar (S/)</label>
                <input 
                  type="number"
                  step="0.01"
                  value={abonoAmount}
                  onChange={e => setAbonoAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-[#0B1120] border border-slate-700 rounded-xl px-4 py-3 text-2xl font-bold text-white focus:outline-none focus:border-emerald-500 text-center transition-colors"
                />
              </div>

              <div className="flex justify-between items-center p-3 bg-emerald-900/10 rounded-lg border border-emerald-900/30">
                <span className="text-xs font-bold text-emerald-500/70 uppercase">Nuevo Saldo Proyectado</span>
                <span className="font-bold text-emerald-400 text-lg">S/ {(saldoActualInfo.saldo + (parseMoney(abonoAmount) || 0)).toFixed(2)}</span>
              </div>
            </div>

            <div className="p-4 border-t border-slate-800 bg-[#0B1120]">
              <button 
                onClick={handleNuevoAbono}
                disabled={isProcessing || !abonoAmount || isNaN(parseMoney(abonoAmount))}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-xl transition-colors disabled:opacity-50 flex justify-center items-center gap-2"
              >
                {isProcessing && <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></div>}
                Confirmar Abono
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL INFORME */}
      {isInformeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-0 sm:p-4 md:p-8">
          <div className="bg-[#111827] border border-slate-700 rounded-none sm:rounded-2xl w-full max-w-5xl h-full sm:h-auto sm:max-h-[92vh] max-h-[100dvh] shadow-2xl flex flex-col animate-in slide-in-from-bottom-6 duration-200 overflow-hidden">
            
            <div className="p-3 sm:p-4 md:p-6 border-b border-slate-800 flex justify-between items-center bg-[#0B1120] shrink-0">
              <h3 className="text-base sm:text-xl font-bold text-white flex items-center gap-2">
                <FileBarChart className="w-5 h-5 sm:w-6 sm:h-6 text-blue-500" />
                Informe de Caja Chica
              </h3>
              <button onClick={() => setIsInformeModalOpen(false)} className="text-slate-400 hover:text-white bg-slate-800/80 p-1.5 sm:p-2 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto sm:overflow-hidden flex flex-col md:flex-row custom-scrollbar">
              {/* FILTROS LATERALES */}
              <div className="w-full md:w-64 bg-[#0B1120] border-b md:border-b-0 md:border-r border-slate-800 p-3 sm:p-4 md:p-6 flex flex-col gap-3 sm:gap-4 shrink-0">
                <h4 className="text-[9.5px] sm:text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-slate-800 pb-1.5">Parámetros</h4>
                
                <div className="grid grid-cols-1 xs:grid-cols-2 md:grid-cols-1 gap-2.5 sm:gap-3">
                  <div>
                    <label className="text-[11px] sm:text-xs font-bold text-slate-400 mb-1 block">Fecha Inicial</label>
                    <input 
                      type="date"
                      value={informeFechaInicial}
                      onChange={e => setInformeFechaInicial(e.target.value)}
                      className="w-full bg-[#111827] border border-slate-800 rounded px-2.5 py-1.5 sm:py-2 text-xs sm:text-sm text-slate-200 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] sm:text-xs font-bold text-slate-400 mb-1 block">Fecha Final</label>
                    <input 
                      type="date"
                      value={informeFechaFinal}
                      onChange={e => setInformeFechaFinal(e.target.value)}
                      className="w-full bg-[#111827] border border-slate-800 rounded px-2.5 py-1.5 sm:py-2 text-xs sm:text-sm text-slate-200 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div className="xs:col-span-2 md:col-span-1">
                    <label className="text-[11px] sm:text-xs font-bold text-slate-400 mb-1 block">Técnico</label>
                    <select
                      value={informeTecnico}
                      onChange={e => setInformeTecnico(e.target.value)}
                      className="w-full bg-[#111827] border border-slate-800 rounded px-2.5 py-1.5 sm:py-2 text-xs sm:text-sm text-slate-200 focus:outline-none focus:border-blue-500"
                    >
                      <option value="Todos">Todos</option>
                      {tecnicosList.map(t => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <button 
                  onClick={generarInforme}
                  className="mt-2 md:mt-4 bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 sm:py-2.5 rounded-lg transition-colors text-xs sm:text-sm"
                >
                  Generar Reporte
                </button>
              </div>

              {/* RESULTADOS */}
              <div className="flex-1 bg-[#111827] p-3 sm:p-4 md:p-6 overflow-y-auto custom-scrollbar">
                {!informeData ? (
                  <div className="h-full min-h-[160px] flex flex-col items-center justify-center text-slate-500 gap-2 sm:gap-4 text-center p-4">
                    <FileBarChart className="w-10 h-10 sm:w-12 sm:h-12 opacity-20" />
                    <p className="text-xs sm:text-sm">Seleccione los parámetros y haga clic en Generar Reporte</p>
                  </div>
                ) : (
                  <div className="space-y-6 sm:space-y-8 pb-10">
                    
                    {/* RESUMEN */}
                    <div>
                      <h4 className="text-[11px] sm:text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 sm:mb-4">Resumen General</h4>
                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
                        <div className="bg-[#0B1120] border border-slate-800 p-3 sm:p-4 rounded-xl">
                          <p className="text-[9px] sm:text-[10px] text-slate-500 font-bold uppercase mb-0.5">Total Abonos</p>
                          <p className="text-base sm:text-xl font-bold text-emerald-500">S/ {informeData.totalAbonos.toFixed(2)}</p>
                        </div>
                        <div className="bg-[#0B1120] border border-slate-800 p-3 sm:p-4 rounded-xl">
                          <p className="text-[9px] sm:text-[10px] text-slate-500 font-bold uppercase mb-0.5">Total Gastado</p>
                          <p className="text-base sm:text-xl font-bold text-red-400">S/ {informeData.totalGastado.toFixed(2)}</p>
                        </div>
                        <div className="bg-[#0B1120] border border-slate-800 p-3 sm:p-4 rounded-xl">
                          <p className="text-[9px] sm:text-[10px] text-slate-500 font-bold uppercase mb-0.5">Total Pendiente</p>
                          <p className="text-base sm:text-xl font-bold text-amber-500">S/ {informeData.totalPendiente.toFixed(2)}</p>
                        </div>
                        <div className="bg-[#0B1120] border border-slate-800 p-3 sm:p-4 rounded-xl">
                          <p className="text-[9px] sm:text-[10px] text-slate-500 font-bold uppercase mb-0.5">Saldo Actual Caja</p>
                          <p className="text-base sm:text-xl font-bold text-blue-400">S/ {saldoActualInfo.saldo.toFixed(2)}</p>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-8">
                      {/* GASTOS POR TECNICO */}
                      <div>
                        <h4 className="text-[11px] sm:text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 sm:mb-4 border-b border-slate-800 pb-1.5">Gastos por Técnico</h4>
                        <div className="bg-[#0B1120] rounded-xl border border-slate-800 overflow-x-auto">
                          <table className="w-full text-xs sm:text-sm text-left">
                            <thead className="bg-slate-900/50 text-[9px] sm:text-[10px] uppercase text-slate-500">
                              <tr>
                                <th className="px-3 sm:px-4 py-2">Técnico</th>
                                <th className="px-2 sm:px-4 py-2 text-center">Rutas / Acts</th>
                                <th className="px-3 sm:px-4 py-2 text-right">Total</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/50">
                              {informeData.gastosTecnico.length > 0 ? informeData.gastosTecnico.map((g: any, i: number) => (
                                <tr key={i} className="hover:bg-slate-800/20">
                                  <td className="px-3 sm:px-4 py-2 font-medium text-slate-300">{g.tec}</td>
                                  <td className="px-2 sm:px-4 py-2 text-center text-slate-400">{g.cantRutas} R / {g.cantActs} A</td>
                                  <td className="px-3 sm:px-4 py-2 text-right font-bold text-slate-200">S/ {g.total.toFixed(2)}</td>
                                </tr>
                              )) : <tr><td colSpan={3} className="text-center py-4 text-slate-500">Sin gastos</td></tr>}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* HISTORIAL ABONOS */}
                      <div>
                        <h4 className="text-[11px] sm:text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 sm:mb-4 border-b border-slate-800 pb-1.5">Abonos Realizados</h4>
                        <div className="bg-[#0B1120] rounded-xl border border-slate-800 overflow-hidden max-h-64 overflow-y-auto custom-scrollbar">
                          <table className="w-full text-xs sm:text-sm text-left">
                            <thead className="bg-slate-900/50 text-[9px] sm:text-[10px] uppercase text-slate-500 sticky top-0">
                              <tr>
                                <th className="px-3 sm:px-4 py-2">Fecha</th>
                                <th className="px-2 sm:px-4 py-2">ID</th>
                                <th className="px-3 sm:px-4 py-2 text-right">Abono</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/50">
                              {informeData.abonos.length > 0 ? informeData.abonos.map((a: Caja, i: number) => (
                                <tr key={i} className="hover:bg-slate-800/20">
                                  <td className="px-3 sm:px-4 py-2 text-slate-400 text-xs">{a.FECHA}</td>
                                  <td className="px-2 sm:px-4 py-2 font-['JetBrains_Mono'] text-xs text-slate-500">{a.ID}</td>
                                  <td className="px-3 sm:px-4 py-2 text-right font-bold text-emerald-400">S/ {parseMoney(a.ABONO).toFixed(2)}</td>
                                </tr>
                              )) : <tr><td colSpan={3} className="text-center py-4 text-slate-500">Sin abonos</td></tr>}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>

                    {/* LISTA RUTAS CANCELADAS */}
                    <div>
                      <h4 className="text-[11px] sm:text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 sm:mb-4 border-b border-slate-800 pb-1.5">Rutas Canceladas (Gastado)</h4>
                      <div className="bg-[#0B1120] rounded-xl border border-slate-800 overflow-x-auto">
                        <table className="w-full text-xs sm:text-sm text-left whitespace-nowrap">
                          <thead className="bg-slate-900/50 text-[9px] sm:text-[10px] uppercase text-slate-500">
                            <tr>
                              <th className="px-3 sm:px-4 py-2">Fecha</th>
                              <th className="px-2 sm:px-4 py-2">ID</th>
                              <th className="px-3 sm:px-4 py-2">Técnico</th>
                              <th className="px-3 sm:px-4 py-2">Ticket</th>
                              <th className="px-3 sm:px-4 py-2">Origen / Destino</th>
                              <th className="px-3 sm:px-4 py-2 text-right">Monto</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800/50">
                            {informeData.rutasCanceladas.length > 0 ? informeData.rutasCanceladas.map((r: Ruta, i: number) => (
                              <tr key={i} className="hover:bg-slate-800/20">
                                <td className="px-3 sm:px-4 py-2 text-xs text-slate-400">{r.FECHA}</td>
                                <td className="px-2 sm:px-4 py-2 font-['JetBrains_Mono'] text-xs text-slate-500">{r.ID}</td>
                                <td className="px-3 sm:px-4 py-2 text-xs text-slate-300">{r.TECNICO}</td>
                                <td className="px-3 sm:px-4 py-2 text-xs text-amber-500 font-bold">{r['TICKET/ACTIVIDAD']}</td>
                                <td className="px-3 sm:px-4 py-2 text-xs text-slate-400">{r.ORIGEN} - {r.DESTINO}</td>
                                <td className="px-3 sm:px-4 py-2 text-right font-bold text-slate-200">S/ {parseMoney(r.MONTO).toFixed(2)}</td>
                              </tr>
                            )) : <tr><td colSpan={6} className="text-center py-4 text-slate-500">Sin rutas canceladas</td></tr>}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* LISTA ACTIVIDADES CANCELADAS */}
                    <div>
                      <h4 className="text-[11px] sm:text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 sm:mb-4 border-b border-slate-800 pb-1.5">Actividades Diarias Canceladas (Gastado)</h4>
                      <div className="bg-[#0B1120] rounded-xl border border-slate-800 overflow-x-auto">
                        <table className="w-full text-xs sm:text-sm text-left whitespace-nowrap">
                          <thead className="bg-slate-900/50 text-[9px] sm:text-[10px] uppercase text-slate-500">
                            <tr>
                              <th className="px-3 sm:px-4 py-2">Fecha</th>
                              <th className="px-2 sm:px-4 py-2">ID</th>
                              <th className="px-3 sm:px-4 py-2">Asignado A</th>
                              <th className="px-3 sm:px-4 py-2">Motivo</th>
                              <th className="px-3 sm:px-4 py-2">Ida / Vuelta</th>
                              <th className="px-3 sm:px-4 py-2 text-right">Monto</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800/50">
                            {informeData.actsCanceladas && informeData.actsCanceladas.length > 0 ? informeData.actsCanceladas.map((a: ActividadDiaria, i: number) => {
                              const actSegs = (data?.tranacti || []).filter(t => (t.IDRUTA || '').trim().toUpperCase() === (a.ID || '').trim().toUpperCase());
                              const sumP = actSegs.reduce((sum, t) => sum + parseMoney(t.PASAJE), 0);
                              const p = actSegs.length > 0 ? sumP : parseMoney(a['GASTO DE PASAJE']);
                              const ad = parseMoney(a['GASTO ADICIONAL']);
                              const st = parseMoney(a['MONTO TOTAL']);
                              const calculatedTotal = st > 0 ? st : (p + ad);

                              return (
                                <tr key={i} className="hover:bg-slate-800/20">
                                  <td className="px-3 sm:px-4 py-2 text-xs text-slate-400">{a.FECHA}</td>
                                  <td className="px-2 sm:px-4 py-2 font-['JetBrains_Mono'] text-xs text-indigo-400 font-bold">{a.ID}</td>
                                  <td className="px-3 sm:px-4 py-2 text-xs text-slate-300">{a['ASIGNADO A'] || a.ASIGNADO}</td>
                                  <td className="px-3 sm:px-4 py-2 text-xs text-slate-300 max-w-[200px] truncate" title={a['MOTIVO DE LA ACTIVIDAD']}>{a['MOTIVO DE LA ACTIVIDAD']}</td>
                                  <td className="px-3 sm:px-4 py-2 text-xs text-slate-400">
                                    <div>{a.IDA || '-'} &rarr; {a.VUELTA || '-'}</div>
                                    {actSegs.length > 0 && (
                                      <div className="flex flex-wrap gap-1 mt-1">
                                        {actSegs.map(s => (
                                          <span key={s.ID} className="inline-flex items-center gap-1 text-[9px] font-medium bg-slate-800 border border-slate-700 px-1.5 py-0.5 rounded text-slate-300">
                                            {getTransportIcon(s.MOVIL)}
                                            <span>{s.MOVIL}</span>
                                            <span className="text-amber-400 font-mono font-bold">S/{parseMoney(s.PASAJE).toFixed(2)}</span>
                                          </span>
                                        ))}
                                      </div>
                                    )}
                                  </td>
                                  <td className="px-3 sm:px-4 py-2 text-right font-bold text-slate-200">S/ {calculatedTotal.toFixed(2)}</td>
                                </tr>
                              );
                            }) : <tr><td colSpan={6} className="text-center py-4 text-slate-500">Sin actividades canceladas</td></tr>}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* LISTA RUTAS NO CANCELADAS */}
                    <div>
                      <h4 className="text-[11px] sm:text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 sm:mb-4 border-b border-slate-800 pb-1.5">Rutas Pendientes (No Canceladas)</h4>
                      <div className="bg-[#0B1120] rounded-xl border border-slate-800 overflow-x-auto">
                        <table className="w-full text-xs sm:text-sm text-left whitespace-nowrap">
                          <thead className="bg-slate-900/50 text-[9px] sm:text-[10px] uppercase text-slate-500">
                            <tr>
                              <th className="px-3 sm:px-4 py-2">Fecha</th>
                              <th className="px-2 sm:px-4 py-2">ID</th>
                              <th className="px-3 sm:px-4 py-2">Técnico</th>
                              <th className="px-3 sm:px-4 py-2">Ticket</th>
                              <th className="px-3 sm:px-4 py-2">Origen / Destino</th>
                              <th className="px-3 sm:px-4 py-2 text-right">Monto</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800/50">
                            {informeData.rutasNoCanceladas.length > 0 ? informeData.rutasNoCanceladas.map((r: Ruta, i: number) => (
                              <tr key={i} className="hover:bg-slate-800/20">
                                <td className="px-3 sm:px-4 py-2 text-xs text-slate-400">{r.FECHA}</td>
                                <td className="px-2 sm:px-4 py-2 font-['JetBrains_Mono'] text-xs text-slate-500">{r.ID}</td>
                                <td className="px-3 sm:px-4 py-2 text-xs text-slate-300">{r.TECNICO}</td>
                                <td className="px-3 sm:px-4 py-2 text-xs text-amber-500 font-bold">{r['TICKET/ACTIVIDAD']}</td>
                                <td className="px-3 sm:px-4 py-2 text-xs text-slate-400">{r.ORIGEN} - {r.DESTINO}</td>
                                <td className="px-3 sm:px-4 py-2 text-right font-bold text-slate-200">S/ {parseMoney(r.MONTO).toFixed(2)}</td>
                              </tr>
                            )) : <tr><td colSpan={6} className="text-center py-4 text-slate-500">Sin rutas pendientes</td></tr>}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* LISTA ACTIVIDADES NO CANCELADAS */}
                    <div>
                      <h4 className="text-[11px] sm:text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 sm:mb-4 border-b border-slate-800 pb-1.5">Actividades Diarias Pendientes (No Canceladas)</h4>
                      <div className="bg-[#0B1120] rounded-xl border border-slate-800 overflow-x-auto">
                        <table className="w-full text-xs sm:text-sm text-left whitespace-nowrap">
                          <thead className="bg-slate-900/50 text-[9px] sm:text-[10px] uppercase text-slate-500">
                            <tr>
                              <th className="px-3 sm:px-4 py-2">Fecha</th>
                              <th className="px-2 sm:px-4 py-2">ID</th>
                              <th className="px-3 sm:px-4 py-2">Asignado A</th>
                              <th className="px-3 sm:px-4 py-2">Motivo</th>
                              <th className="px-3 sm:px-4 py-2">Ida / Vuelta</th>
                              <th className="px-3 sm:px-4 py-2 text-right">Monto</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800/50">
                            {informeData.actsNoCanceladas && informeData.actsNoCanceladas.length > 0 ? informeData.actsNoCanceladas.map((a: ActividadDiaria, i: number) => {
                              const actSegs = (data?.tranacti || []).filter(t => (t.IDRUTA || '').trim().toUpperCase() === (a.ID || '').trim().toUpperCase());
                              const sumP = actSegs.reduce((sum, t) => sum + parseMoney(t.PASAJE), 0);
                              const p = actSegs.length > 0 ? sumP : parseMoney(a['GASTO DE PASAJE']);
                              const ad = parseMoney(a['GASTO ADICIONAL']);
                              const st = parseMoney(a['MONTO TOTAL']);
                              const calculatedTotal = st > 0 ? st : (p + ad);

                              return (
                                <tr key={i} className="hover:bg-slate-800/20">
                                  <td className="px-3 sm:px-4 py-2 text-xs text-slate-400">{a.FECHA}</td>
                                  <td className="px-2 sm:px-4 py-2 font-['JetBrains_Mono'] text-xs text-indigo-400 font-bold">{a.ID}</td>
                                  <td className="px-3 sm:px-4 py-2 text-xs text-slate-300">{a['ASIGNADO A'] || a.ASIGNADO}</td>
                                  <td className="px-3 sm:px-4 py-2 text-xs text-slate-300 max-w-[200px] truncate" title={a['MOTIVO DE LA ACTIVIDAD']}>{a['MOTIVO DE LA ACTIVIDAD']}</td>
                                  <td className="px-3 sm:px-4 py-2 text-xs text-slate-400">
                                    <div>{a.IDA || '-'} &rarr; {a.VUELTA || '-'}</div>
                                    {actSegs.length > 0 && (
                                      <div className="flex flex-wrap gap-1 mt-1">
                                        {actSegs.map(s => (
                                          <span key={s.ID} className="inline-flex items-center gap-1 text-[9px] font-medium bg-slate-800 border border-slate-700 px-1.5 py-0.5 rounded text-slate-300">
                                            {getTransportIcon(s.MOVIL)}
                                            <span>{s.MOVIL}</span>
                                            <span className="text-amber-400 font-mono font-bold">S/{parseMoney(s.PASAJE).toFixed(2)}</span>
                                          </span>
                                        ))}
                                      </div>
                                    )}
                                  </td>
                                  <td className="px-3 sm:px-4 py-2 text-right font-bold text-slate-200">S/ {calculatedTotal.toFixed(2)}</td>
                                </tr>
                              );
                            }) : <tr><td colSpan={6} className="text-center py-4 text-slate-500">Sin actividades pendientes</td></tr>}
                          </tbody>
                        </table>
                      </div>
                    </div>

                  </div>
                )}
              </div>
            </div>

          </div>
        </div>
      )}

      {/* STYLES FOR ANIMATIONS */}
      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #1e293b; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #334155; }
      `}} />
    </div>
  );
}
