import { CABECERA_B64 } from '../../lib/constants';
const chunkArray = <T,>(arr: T[], size: number): T[][] => {
  return Array.from({ length: Math.ceil(arr.length / size) }, (v, i) => arr.slice(i * size, i * size + size));
};

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { AuthenticatedImage } from '../../components/AuthenticatedImage';
import GoogleErrorCard from '../../components/GoogleErrorCard';


import { fetchAppData } from '../../lib/googleApi';
import { AppData, Ticket, Actividad, FotoAct, Empresa, Contacto, Tecnico, Contrato } from '../../types';
import { RefreshCw, Search, ChevronLeft, ChevronRight, CheckSquare, Square, FileText, Send, X, Camera, PenTool, LayoutDashboard, MapPin, Download, Loader2, CheckCircle2, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { generateAndUploadGuiaPDF, GuiaDocumentPages, ScaledA4Page } from '../../lib/pdfGuiaGenerator';
import { sanitizeHtml2CanvasClonedDoc, safeHtml2Canvas } from '../../lib/pdfHelper';

const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

export default function InformesModule() {
  const [data, setData] = useState<AppData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [year, setYear] = useState(new Date().getFullYear().toString());
  const [selectedMonths, setSelectedMonths] = useState<string[]>([MONTHS[new Date().getMonth()]]);
  const [client, setClient] = useState('Todos');
  const [type, setType] = useState('Todos');
  const [activityType, setActivityType] = useState('Todas');
  const [search, setSearch] = useState('');
  
  // Pending filters that are applied on "Aplicar"
  const [pendingYear, setPendingYear] = useState(year);
  const [pendingSelectedMonths, setPendingSelectedMonths] = useState<string[]>(selectedMonths);
  const [pendingClient, setPendingClient] = useState(client);
  const [pendingType, setPendingType] = useState(type);
  const [pendingActivityType, setPendingActivityType] = useState(activityType);

  const [activeView, setActiveView] = useState<'DASHBOARD' | 'INFORME' | 'GUIA'>('DASHBOARD');
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  
  const [showFotosModal, setShowFotosModal] = useState(false);
  const [activeActividadForFotos, setActiveActividadForFotos] = useState<Actividad | null>(null);

  // PDF Export state (matching ticket cerrados behavior)
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [exportStatusMessage, setExportStatusMessage] = useState<string | null>(null);
  const [pdfSuccessMessage, setPdfSuccessMessage] = useState<string | null>(null);
  const [errorPdf, setErrorPdf] = useState<string | null>(null);

  // Zoom and auto-fit scaling for Guia preview
  const guiaContainerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState<number>(1);
  const [isAutoFit, setIsAutoFit] = useState<boolean>(true);

  useEffect(() => {
    if (activeView !== 'GUIA') return;

    const calculateAutoFit = () => {
      if (!guiaContainerRef.current) return;
      const containerWidth = guiaContainerRef.current.clientWidth;
      const availableWidth = Math.max(260, containerWidth - 32);
      const targetA4Width = 794;

      if (availableWidth < targetA4Width) {
        const calculatedScale = Math.min(1, Math.max(0.3, (availableWidth / targetA4Width)));
        if (isAutoFit) {
          setScale(Number(calculatedScale.toFixed(2)));
        }
      } else if (isAutoFit) {
        setScale(1);
      }
    };

    calculateAutoFit();
    window.addEventListener('resize', calculateAutoFit);
    const ro = new ResizeObserver(calculateAutoFit);
    if (guiaContainerRef.current) {
      ro.observe(guiaContainerRef.current);
    }
    return () => {
      window.removeEventListener('resize', calculateAutoFit);
      ro.disconnect();
    };
  }, [activeView, isAutoFit]);

    const formatImageUrl = (url: string) => {
    if (!url) return url;
    
    // Check if it's a raw base64 string (no spaces, very long, doesn't start with http or data:)
    if (!url.startsWith('http') && !url.startsWith('data:') && url.length > 100) {
      return `data:image/jpeg;base64,${url}`;
    }

    if (url.includes('drive.google.com')) {
      let fileId = null;
      const idMatch = url.match(/id=([^&]+)/);
      if (idMatch) {
        fileId = idMatch[1];
      } else {
        const fileMatch = url.match(/\/file\/d\/([^\/]+)/);
        if (fileMatch) {
          fileId = fileMatch[1];
        }
      }
      if (fileId) {
        return `https://drive.google.com/uc?export=view&id=${fileId}`;
      }
    }
    return url;
  };


  const loadData = async () => {
    setLoading(true);
    try {
      const appData = await fetchAppData();
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

  const handleApplyFilters = () => {
    setYear(pendingYear);
    setSelectedMonths(pendingSelectedMonths);
    setClient(pendingClient);
    setType(pendingType);
    setActivityType(pendingActivityType);
    setSelectedTicketId(null);
    if (activeView === 'GUIA') setActiveView('DASHBOARD');
  };

  const toggleMonth = (m: string) => {
    setPendingSelectedMonths(prev => 
      prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m]
    );
  };

  const parseDate = (dateStr: string) => {
    if (!dateStr) return null;
    let parts = dateStr.split('/');
    if (parts.length === 3) {
      const d = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;
      let yStr = parts[2].split(' ')[0];
      const y = parseInt(yStr, 10);
      return new Date(y, m, d);
    }
    parts = dateStr.split('-');
    if (parts.length === 3) {
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;
      let dStr = parts[2].split(' ')[0];
      const d = parseInt(dStr, 10);
      return new Date(y, m, d);
    }
    return null;
  };

  const closedTickets = useMemo(() => {
    if (!data) return [];
    const closed = data.tickets.filter(t => t.ESTADO === 'CERRADO');
    const unique = [];
    const seen = new Set();
    for (const t of closed) {
      if (!seen.has(t.IDTICKET)) {
        seen.add(t.IDTICKET);
        unique.push(t);
      }
    }
    return unique;
  }, [data]);

  const filterOptions = useMemo(() => {
    if (!data) return { years: [], clients: [], types: [], activities: [] };
    const ys = new Set<string>();
    const cs = new Set<string>();
    const ts = new Set<string>();
    const acts = new Set<string>();

    closedTickets.forEach(t => {
      const d = parseDate(t['FECHA DE CIERRE']);
      if (d && !isNaN(d.getFullYear())) ys.add(d.getFullYear().toString());
      if (t.CLIENTE) cs.add(t.CLIENTE);
      if (t.TIPO) ts.add(t.TIPO);
      if (t['ACTIVIDAD DEL TICKET']) acts.add(t['ACTIVIDAD DEL TICKET']);
    });
    
    data.actividades.forEach(a => {
      if (a.TIPO) acts.add(a.TIPO);
    });

    const currentY = new Date().getFullYear().toString();
    if (!ys.has(currentY)) ys.add(currentY);

    return {
      years: Array.from(ys).sort().reverse(),
      clients: Array.from(cs).sort(),
      types: Array.from(ts).sort(),
      activities: Array.from(acts).sort(),
    };
  }, [closedTickets, data]);

  const filteredTickets = useMemo(() => {
    if (!data) return [];
    
    return closedTickets.filter(t => {
      const d = parseDate(t['FECHA DE CIERRE']);
      if (!d) return false;
      
      const tYear = d.getFullYear().toString();
      const tMonthName = MONTHS[d.getMonth()];

      if (year && tYear !== year) return false;
      if (selectedMonths.length > 0 && !selectedMonths.includes(tMonthName)) return false;
      if (client !== 'Todos' && t.CLIENTE !== client) return false;
      if (type !== 'Todos' && t.TIPO !== type) return false;
      if (activityType !== 'Todas' && t['ACTIVIDAD DEL TICKET'] !== activityType) return false;
      
      if (search) {
        const query = search.toLowerCase();
        const matches = 
          (t.IDTICKET || '').toLowerCase().includes(query) ||
          (t.CLIENTE || '').toLowerCase().includes(query) ||
          (t.TECNICO || '').toLowerCase().includes(query) ||
          (t.PROBLEMA || '').toLowerCase().includes(query) ||
          (t.CONTACTO || '').toLowerCase().includes(query) ||
          (t.TIPO || '').toLowerCase().includes(query) ||
          (t['ACTIVIDAD DEL TICKET'] || '').toLowerCase().includes(query);
        if (!matches) return false;
      }
      return true;
    }).sort((a, b) => {
      const da = parseDate(a['FECHA DE CIERRE']);
      const db = parseDate(b['FECHA DE CIERRE']);
      return (db?.getTime() || 0) - (da?.getTime() || 0);
    });
  }, [closedTickets, year, selectedMonths, client, type, activityType, search, data]);

  const selectedTicket = useMemo(() => {
    return filteredTickets.find(t => t.IDTICKET === selectedTicketId) || null;
  }, [filteredTickets, selectedTicketId]);

  const ticketActividades = useMemo(() => {
    if (!data || !selectedTicket) return [];
    return data.actividades.filter(a => a.IDTICKET === selectedTicket.IDTICKET).sort((a, b) => {
      const da = parseDate(a.FHINICIO);
      const db = parseDate(b.FHINICIO);
      return (da?.getTime() || 0) - (db?.getTime() || 0);
    });
  }, [data, selectedTicket]);

  const pendingTickets = useMemo(() => {
    if (!data || client === 'Todos') return [];
    const pending = data.tickets.filter(t => t.ESTADO !== 'CERRADO' && t.CLIENTE === client);
    const unique = [];
    const seen = new Set();
    for (const t of pending) {
      if (!seen.has(t.IDTICKET)) {
        seen.add(t.IDTICKET);
        unique.push(t);
      }
    }
    return unique;
  }, [data, client]);

  const parseTimeStr = (str: string) => {
    if (!str) return 0;
    const parts = str.split(':');
    if (parts.length < 2) return 0;
    return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
  };

  const formatMins = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = Math.floor(mins % 60);
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  };

  const totalTimeMins = useMemo(() => {
    return filteredTickets.reduce((acc, t) => acc + parseTimeStr(t.SUMAXH), 0);
  }, [filteredTickets]);

  const totalActivities = useMemo(() => {
    if (!data) return 0;
    const ids = new Set(filteredTickets.map(t => t.IDTICKET));
    return data.actividades.filter(a => ids.has(a.IDTICKET)).length;
  }, [data, filteredTickets]);

  const maxDate = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredTickets.forEach(t => {
      const d = t['FECHA DE CIERRE']?.split(' ')[0];
      if (d) counts[d] = (counts[d] || 0) + 1;
    });
    let maxD = '-';
    let maxC = 0;
    for (const [d, c] of Object.entries(counts)) {
      if (c > maxC) {
        maxC = c;
        maxD = d;
      }
    }
    return maxD;
  }, [filteredTickets]);

  const reportStats = useMemo(() => {
    if (!data) return null;
    
    const byType: Record<string, { cant: number, mins: number }> = {};
    const byTecnico: Record<string, { cant: number, mins: number }> = {};
    
    const ids = new Set(filteredTickets.map(t => t.IDTICKET));
    const acts = data.actividades.filter(a => ids.has(a.IDTICKET));
    
    const byArea: Record<string, number> = {};
    
    filteredTickets.forEach(t => {
      const mins = parseTimeStr(t.SUMAXH);
      
      const tipo = t.TIPO || 'OTRO';
      if (!byType[tipo]) byType[tipo] = { cant: 0, mins: 0 };
      byType[tipo].cant++;
      byType[tipo].mins += mins;
      
      const tec = t.TECNICO || 'SIN TECNICO';
      if (!byTecnico[tec]) byTecnico[tec] = { cant: 0, mins: 0 };
      byTecnico[tec].cant++;
      byTecnico[tec].mins += mins;
      
      const tActs = acts.filter(a => a.IDTICKET === t.IDTICKET);
      if (tActs.length > 0) {
        const lastAct = tActs[tActs.length - 1];
        const area = lastAct.AREA || 'NO ESPECIFICADA';
        byArea[area] = (byArea[area] || 0) + 1;
      }
    });

    const total = filteredTickets.length;

    const tipoArr = Object.entries(byType).map(([tipo, {cant, mins}]) => ({
      tipo, cant, mins, pct: total ? (cant / total) * 100 : 0
    })).sort((a,b) => b.cant - a.cant);

    const tecArr = Object.entries(byTecnico).map(([tec, {cant, mins}]) => ({
      tec, cant, mins, pct: total ? (cant / total) * 100 : 0
    })).sort((a,b) => b.cant - a.cant);

    const areaArr = Object.entries(byArea).map(([area, cant]) => ({
      area, cant, pct: total ? (cant / total) * 100 : 0
    })).sort((a,b) => b.cant - a.cant);

    return { tipoArr, tecArr, areaArr };
  }, [filteredTickets, data]);

  const currentContrato = useMemo(() => {
    if (!data || client === 'Todos') return null;
    const normalize = (s: string) => (s || '').toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\./g, '').replace(/sac/g, '').replace(/srl/g, '').replace(/\s+/g, ' ').trim();
    const cNorm = normalize(client);
    return data.contratos.find(c => normalize(c.empresa) === cNorm) || null;
  }, [data, client]);

  const handleDownloadPDF = async () => {
    if (activeView === 'GUIA') {
      if (!selectedTicket) {
        alert('Por favor selecciona un ticket cerrado para descargar su guía en PDF.');
        return;
      }
      setIsExportingPDF(true);
      setErrorPdf(null);
      setPdfSuccessMessage(null);
      setExportStatusMessage('Preparando Guía de Servicio...');
      try {
        const ticketFotos = data?.fotosTicket?.filter(f => f.IDTICKET === selectedTicket.IDTICKET) || [];
        const actIds = ticketActividades.map(a => a.IDACTIVIDADES);
        const ticketFotosAct = data?.fotosAct?.filter(f => actIds.includes(f.IDACTIVIDADES)) || [];
        const ticketRepuestos = data?.repuestos?.filter(r => r.IDTICKET === selectedTicket.IDTICKET) || [];

        const result = await generateAndUploadGuiaPDF({
          ticket: selectedTicket,
          data,
          actividades: ticketActividades,
          repuestos: ticketRepuestos,
          fotosTicket: ticketFotos,
          fotosAct: ticketFotosAct,
          downloadLocally: true,
          onProgress: (msg) => setExportStatusMessage(msg)
        });

        if (result?.pdfUrl) {
          setData(prev => {
            if (!prev) return prev;
            return {
              ...prev,
              tickets: prev.tickets.map(t => t.IDTICKET === selectedTicket.IDTICKET ? { ...t, PDF: result.pdfUrl } : t)
            };
          });
        }

        setPdfSuccessMessage(
          result?.pdfUrl
            ? `¡PDF ${result.fileName} generado, descargado y guardado en Drive con éxito!`
            : `¡PDF ${result.fileName} generado y descargado con éxito!`
        );
        setTimeout(() => setPdfSuccessMessage(null), 7000);
      } catch (err: any) {
        console.error('Error al generar PDF de la guía:', err);
        setErrorPdf('Error al generar PDF: ' + (err.message || 'No se pudo generar el archivo'));
      } finally {
        setIsExportingPDF(false);
        setExportStatusMessage(null);
      }
    } else if (activeView === 'INFORME') {
      setIsExportingPDF(true);
      setErrorPdf(null);
      setPdfSuccessMessage(null);
      setExportStatusMessage('Generando PDF del informe...');
      try {
        const element = document.getElementById('informe-print');
        if (!element) throw new Error('No se encontró el elemento de informe');
        const canvas = await safeHtml2Canvas(element, {
          scale: 2,
          useCORS: true,
          allowTaint: true,
          backgroundColor: '#ffffff'
        });
        const imgData = canvas.toDataURL('image/jpeg', 0.95);
        const pdf = new jsPDF({
          orientation: 'portrait',
          unit: 'mm',
          format: 'a4'
        });
        const imgWidth = 210;
        const pageHeight = 297;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        let heightLeft = imgHeight;
        let position = 0;
        pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
        while (heightLeft > 0) {
          position = heightLeft - imgHeight;
          pdf.addPage();
          pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
          heightLeft -= pageHeight;
        }
        const cleanClient = (client !== 'Todos' ? client : 'GENERAL').replace(/[/\\?%*:|"<>]/g, '_');
        const fileName = `Informe-Servicios-${cleanClient}-${year}.pdf`;
        pdf.save(fileName);
        setPdfSuccessMessage(`¡PDF ${fileName} generado y descargado con éxito!`);
        setTimeout(() => setPdfSuccessMessage(null), 7000);
      } catch (err: any) {
        console.error('Error al generar PDF del informe:', err);
        setErrorPdf('Error al generar PDF: ' + (err.message || 'No se pudo generar el archivo'));
      } finally {
        setIsExportingPDF(false);
        setExportStatusMessage(null);
      }
    } else {
      alert('Para descargar un PDF, selecciona un ticket cerrado de la lista o haz clic en "Crear Informe".');
    }
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
        <GoogleErrorCard error={error || 'No se pudieron cargar los datos'} onRetry={loadData} title="Error en Informes" />
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 w-full overflow-hidden h-full bg-[#0B1120] text-slate-300 font-sans relative">
      <header className="px-6 py-4 border-b border-slate-800 bg-[#111827] flex justify-between items-center z-10 shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-white tracking-wide">Informes</h1>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => { setActiveView('DASHBOARD'); setSelectedTicketId(null); }} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeView === 'DASHBOARD' ? 'bg-blue-600 text-white' : 'bg-slate-800 hover:bg-slate-700 text-slate-300'}`}>Dashboard</button>
          <button onClick={() => { setActiveView('INFORME'); setSelectedTicketId(null); }} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeView === 'INFORME' ? 'bg-emerald-600 text-white' : 'bg-emerald-900/50 hover:bg-emerald-800/80 text-emerald-300 border border-emerald-800/50'}`}>Crear Informe</button>
          <button onClick={loadData} className="px-4 py-2 rounded-lg text-sm font-bold transition-all bg-blue-600 hover:bg-blue-500 text-white">Actualizar Fotos y Firmas</button>
          <button onClick={loadData} className="px-4 py-2 rounded-lg text-sm font-bold transition-all bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300">Actualizar informe</button>
        </div>
      </header>

      <div className="bg-[#111827] p-4 border-b border-slate-800 shrink-0">
        <div className="flex flex-col gap-4 max-w-[1400px] mx-auto w-full">
          <div className="flex flex-col md:flex-row gap-4 items-end">
            <div className="w-full md:w-32">
              <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">AÑO</label>
              <select className="w-full bg-[#0B1120] border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 outline-none focus:border-blue-500" value={pendingYear} onChange={e => setPendingYear(e.target.value)}>
                {filterOptions.years.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <div className="flex-1 w-full">
              <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">CLIENTE</label>
              <select className="w-full bg-[#0B1120] border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 outline-none focus:border-blue-500" value={pendingClient} onChange={e => setPendingClient(e.target.value)}>
                <option value="Todos">Todos</option>
                {filterOptions.clients.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="flex-1 w-full">
              <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">TIPO</label>
              <select className="w-full bg-[#0B1120] border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 outline-none focus:border-blue-500" value={pendingType} onChange={e => setPendingType(e.target.value)}>
                <option value="Todos">Todos</option>
                {filterOptions.types.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="flex-1 w-full">
              <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">ACTIVIDAD DEL TICKET</label>
              <select className="w-full bg-[#0B1120] border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 outline-none focus:border-blue-500" value={pendingActivityType} onChange={e => setPendingActivityType(e.target.value)}>
                <option value="Todas">Todas</option>
                {filterOptions.activities.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
          </div>
          
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar pb-2 md:pb-0 w-full md:w-auto">
              <span className="text-[10px] font-bold text-slate-500 uppercase mr-2 shrink-0">MES</span>
              {MONTHS.map(m => (
                <button
                  key={m}
                  onClick={() => toggleMonth(m)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-colors whitespace-nowrap border ${pendingSelectedMonths.includes(m) ? 'bg-blue-600 border-blue-500 text-white' : 'bg-[#0B1120] border-slate-700 text-slate-400 hover:border-slate-500'}`}
                >
                  {pendingSelectedMonths.includes(m) ? <CheckSquare className="w-3 h-3" /> : <Square className="w-3 h-3" />}
                  {m}
                </button>
              ))}
            </div>
            <button
              onClick={handleApplyFilters}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg transition-colors shrink-0 whitespace-nowrap"
            >
              Aplicar
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-hidden flex flex-col md:flex-row max-w-[1400px] mx-auto w-full p-4 gap-6">
        <div className="w-full md:w-[450px] flex flex-col gap-4 h-full shrink-0">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-bold text-white shrink-0">Tickets cerrados</h2>
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                placeholder="Buscar en TICKET y ACTIVIDADES"
                className="w-full bg-[#111827] border border-slate-700 rounded-lg pl-9 pr-3 py-1.5 text-sm text-white placeholder-slate-500 focus:border-blue-500 outline-none"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <div className="bg-[#111827] border border-slate-700 text-white px-3 py-1.5 rounded-lg text-sm font-bold shrink-0">
              {filteredTickets.length}
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-3 pr-2">
            {filteredTickets.length === 0 ? (
              <div className="text-center p-8 bg-[#111827] rounded-xl border border-slate-800 text-slate-500">
                No hay tickets que coincidan con los filtros
              </div>
            ) : (
              filteredTickets.map(t => {
                const isSelected = selectedTicketId === t.IDTICKET;
                return (
                  <div 
                    key={t.IDTICKET} 
                    onClick={() => { setSelectedTicketId(t.IDTICKET); setActiveView('GUIA'); }}
                    className={`p-4 rounded-xl border transition-all cursor-pointer ${isSelected ? 'bg-[#0B1120] border-green-500 shadow-lg' : 'bg-transparent border-green-500 hover:bg-[#0B1120]/50'}`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <h3 className={`font-bold ${isSelected ? 'text-white' : 'text-blue-100'}`}>{t.IDTICKET}</h3>
                      <button className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${isSelected ? 'bg-green-500 text-white border-transparent' : 'border-green-500/50 text-green-400'}`}>
                        VER GUÍA
                      </button>
                    </div>
                    <p className={`font-bold text-sm mb-4 line-clamp-1 ${isSelected ? 'text-white' : 'text-white'}`}>{t.CLIENTE}</p>
                    <div className={`grid grid-cols-[auto_1fr] gap-x-2 gap-y-1 text-[10px] font-bold uppercase tracking-wider ${isSelected ? 'text-blue-100' : 'text-slate-400'}`}>
                      <span>Técnico</span>
                      <span className={`text-right text-white`}>{t.TECNICO}</span>
                      <span>Se envió guía?</span>
                      <span className={`text-right text-white`}>{t.FIRMA || t.FIRMATECH ? 'FIRMADO' : 'NO'}</span>
                      <span>Modo de atención</span>
                      <span className={`text-right text-white`}>{t['MODO DE ATENCION']}</span>
                      <span>Tiempo eficaz total</span>
                      <span className={`text-right text-white`}>{t.SUMAXH}</span>
                      <span>Fecha de cierre</span>
                      <span className={`text-right text-white`}>{t['FECHA DE CIERRE']}</span>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        <div className="flex-1 bg-[#111827] border border-slate-700 rounded-xl overflow-hidden flex flex-col h-full shadow-2xl relative">
          <div className="px-6 py-4 border-b border-slate-800 flex justify-between items-center bg-[#111827] shrink-0">
            <h2 className="text-lg font-bold text-white">
              {activeView === 'DASHBOARD' ? 'Dashboard' : activeView === 'INFORME' ? 'Vista previa de Informe' : 'Vista previa de guía'}
            </h2>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleDownloadPDF}
                disabled={isExportingPDF || activeView === 'DASHBOARD' || (activeView === 'GUIA' && !selectedTicket)}
                className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white text-sm font-bold rounded-lg transition-all flex items-center gap-2 shadow disabled:opacity-50 active:scale-95"
                title={
                  activeView === 'GUIA'
                    ? 'Crear PDF de la guía, descargarlo y guardarlo en la carpeta de Google Drive'
                    : activeView === 'INFORME'
                      ? 'Descargar informe en formato PDF'
                      : 'Selecciona un ticket o crea un informe para descargar en PDF'
                }
              >
                {isExportingPDF ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                <span>{isExportingPDF ? (exportStatusMessage || 'Generando...') : 'Bajar PDF'}</span>
              </button>
              <div className="px-3 py-1.5 bg-[#0B1120] text-slate-400 border border-slate-700 text-xs font-bold rounded-lg uppercase">
                {activeView === 'DASHBOARD' ? 'Resumen' : activeView === 'INFORME' ? 'A4' : 'Ticket cerrado / A4'}
              </div>
            </div>
          </div>

          {pdfSuccessMessage && (
            <div className="bg-emerald-500/20 border-b border-emerald-500/40 text-emerald-300 px-6 py-2 text-xs font-semibold flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{pdfSuccessMessage}</span>
              </div>
              <button onClick={() => setPdfSuccessMessage(null)} className="text-emerald-400 hover:text-white font-bold ml-2">✕</button>
            </div>
          )}
          {errorPdf && (
            <div className="bg-red-500/20 border-b border-red-500/40 text-red-300 px-6 py-2 text-xs font-semibold flex items-center justify-between shrink-0">
              <span>{errorPdf}</span>
              <button onClick={() => setErrorPdf(null)} className="text-red-400 hover:text-white font-bold ml-2">✕</button>
            </div>
          )}
          {isExportingPDF && exportStatusMessage && (
            <div className="bg-blue-500/20 border-b border-blue-500/40 text-blue-300 px-6 py-1.5 text-xs font-semibold flex items-center gap-2 shrink-0">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>{exportStatusMessage}</span>
            </div>
          )}

          <div ref={guiaContainerRef} className="flex-1 overflow-y-auto bg-slate-200/5 p-4 md:p-8 flex justify-center custom-scrollbar">
            {activeView === 'DASHBOARD' && (
              <div className="w-full max-w-4xl flex flex-col gap-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-[#0B1120] p-4 rounded-xl border border-slate-800">
                    <p className="text-[10px] text-slate-500 font-bold uppercase mb-1">Total de tickets</p>
                    <p className="text-3xl font-black text-white">{filteredTickets.length}</p>
                  </div>
                  <div className="bg-[#0B1120] p-4 rounded-xl border border-slate-800">
                    <p className="text-[10px] text-slate-500 font-bold uppercase mb-1">Total de horas</p>
                    <p className="text-3xl font-black text-white">{formatMins(totalTimeMins)}</p>
                  </div>
                  <div className="bg-[#0B1120] p-4 rounded-xl border border-slate-800">
                    <p className="text-[10px] text-slate-500 font-bold uppercase mb-1">Total de actividades</p>
                    <p className="text-3xl font-black text-white">{totalActivities}</p>
                  </div>
                  <div className="bg-[#0B1120] p-4 rounded-xl border border-slate-800">
                    <p className="text-[10px] text-slate-500 font-bold uppercase mb-1">Día mayor atención</p>
                    <p className="text-xl font-black text-white mt-2">{maxDate}</p>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-[#0B1120] rounded-xl border border-slate-800 overflow-hidden">
                    <div className="p-3 border-b border-slate-800 bg-slate-900/50"><h3 className="font-bold text-sm text-slate-300 uppercase tracking-widest">Análisis por Tipo</h3></div>
                    <div className="p-4">
                      {reportStats?.tipoArr.map(t => (
                        <div key={t.tipo} className="mb-4 last:mb-0">
                          <div className="flex justify-between text-xs font-bold mb-1">
                            <span className="text-slate-200">{t.tipo}</span>
                            <span className="text-slate-400">{t.cant} tickets ({t.pct.toFixed(1)}%) - {formatMins(t.mins)} hrs</span>
                          </div>
                          <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                            <div className="h-full bg-blue-500" style={{width: `${t.pct}%`}}></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <div className="bg-[#0B1120] rounded-xl border border-slate-800 overflow-hidden">
                    <div className="p-3 border-b border-slate-800 bg-slate-900/50"><h3 className="font-bold text-sm text-slate-300 uppercase tracking-widest">Análisis por Técnico</h3></div>
                    <div className="p-4">
                      {reportStats?.tecArr.map(t => (
                        <div key={t.tec} className="mb-4 last:mb-0">
                          <div className="flex justify-between text-xs font-bold mb-1">
                            <span className="text-slate-200">{t.tec}</span>
                            <span className="text-slate-400">{t.cant} tickets ({t.pct.toFixed(1)}%) - {formatMins(t.mins)} hrs</span>
                          </div>
                          <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                            <div className="h-full bg-emerald-500" style={{width: `${t.pct}%`}}></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="bg-[#0B1120] rounded-xl border border-slate-800 overflow-hidden md:col-span-2">
                    <div className="p-3 border-b border-slate-800 bg-slate-900/50"><h3 className="font-bold text-sm text-slate-300 uppercase tracking-widest">Análisis por Área (Última act. por ticket)</h3></div>
                    <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                      {reportStats?.areaArr.map(t => (
                        <div key={t.area} className="mb-2">
                          <div className="flex justify-between text-xs font-bold mb-1">
                            <span className="text-slate-200">{t.area}</span>
                            <span className="text-slate-400">{t.cant} ({t.pct.toFixed(1)}%)</span>
                          </div>
                          <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                            <div className="h-full bg-amber-500" style={{width: `${t.pct}%`}}></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeView === 'INFORME' && (
              <div className="w-full max-w-[800px] bg-white text-black p-10 min-h-[1056px] shadow-2xl relative" id="informe-print">
                <div className="text-center mb-8 border-b-2 border-black pb-4">
                  <h1 className="text-3xl font-black uppercase">Informe de Servicios</h1>
                  <p className="text-sm font-bold mt-2">Cliente: {client !== 'Todos' ? client : 'Múltiples Clientes'}</p>
                  <p className="text-sm font-bold">Periodo: {selectedMonths.join(', ')} {year}</p>
                  <p className="text-sm">Total Tickets: {filteredTickets.length} | Tiempo Eficaz Total: {formatMins(totalTimeMins)}</p>
                </div>

                <div className="mb-8">
                  <h3 className="font-bold text-lg border-b border-gray-400 mb-2 uppercase">1. Resumen por Condición / Tipo</h3>
                  <table className="w-full text-sm border-collapse border border-gray-800">
                    <thead className="bg-gray-200">
                      <tr><th className="border border-gray-800 p-2 text-left">CONDICIÓN / TIPO</th><th className="border border-gray-800 p-2 text-right">CANTIDAD</th><th className="border border-gray-800 p-2 text-right">PORCENTAJE</th><th className="border border-gray-800 p-2 text-right">TIEMPO EFICAZ</th></tr>
                    </thead>
                    <tbody>
                      {reportStats?.tipoArr.map(t => (
                        <tr key={t.tipo}>
                          <td className="border border-gray-800 p-2">{t.tipo}</td>
                          <td className="border border-gray-800 p-2 text-right">{t.cant}</td>
                          <td className="border border-gray-800 p-2 text-right">{t.pct.toFixed(1)}%</td>
                          <td className="border border-gray-800 p-2 text-right">{formatMins(t.mins)}</td>
                        </tr>
                      ))}
                      <tr className="bg-gray-100 font-bold">
                        <td className="border border-gray-800 p-2">TOTAL</td>
                        <td className="border border-gray-800 p-2 text-right">{filteredTickets.length}</td>
                        <td className="border border-gray-800 p-2 text-right">100%</td>
                        <td className="border border-gray-800 p-2 text-right">{formatMins(totalTimeMins)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div className="mb-8">
                  <h3 className="font-bold text-lg border-b border-gray-400 mb-2 uppercase">2. Resumen por Área</h3>
                  <table className="w-full text-sm border-collapse border border-gray-800 max-w-md">
                    <thead className="bg-gray-200">
                      <tr><th className="border border-gray-800 p-2 text-left">ÁREA</th><th className="border border-gray-800 p-2 text-right">CANT. TICKETS</th><th className="border border-gray-800 p-2 text-right">PORCENTAJE</th></tr>
                    </thead>
                    <tbody>
                      {reportStats?.areaArr.map(a => (
                        <tr key={a.area}>
                          <td className="border border-gray-800 p-2">{a.area}</td>
                          <td className="border border-gray-800 p-2 text-right">{a.cant}</td>
                          <td className="border border-gray-800 p-2 text-right">{a.pct.toFixed(1)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {currentContrato && (
                  <div className="mb-8">
                    <h3 className="font-bold text-lg border-b border-gray-400 mb-2 uppercase">3. Información del Contrato</h3>
                    <div className="border border-gray-800 p-4 bg-gray-50">
                      <p><strong>Empresa:</strong> {currentContrato.empresa}</p>
                      <p><strong>Horas Contratadas:</strong> {currentContrato['HORAS DE CONTRATADAS']}</p>
                      <p><strong>Horas Consumidas en periodo:</strong> {formatMins(totalTimeMins)}</p>
                    </div>
                  </div>
                )}

                <div className="mb-8">
                  <h3 className="font-bold text-lg border-b border-gray-400 mb-2 uppercase">4. Detalle de Atenciones</h3>
                  <table className="w-full text-[10px] border-collapse border border-gray-800">
                    <thead className="bg-gray-200">
                      <tr>
                        <th className="border border-gray-800 p-1 text-left">IDTICKET</th>
                        <th className="border border-gray-800 p-1 text-left">FECHA CIERRE</th>
                        <th className="border border-gray-800 p-1 text-left">TIPO</th>
                        <th className="border border-gray-800 p-1 text-left">TÉCNICO</th>
                        <th className="border border-gray-800 p-1 text-left">ACTIVIDAD TICKET</th>
                        <th className="border border-gray-800 p-1 text-left">PROBLEMA</th>
                        <th className="border border-gray-800 p-1 text-right">TIEMPO EF.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredTickets.map(t => (
                        <tr key={t.IDTICKET}>
                          <td className="border border-gray-800 p-1 font-bold">{t.IDTICKET}</td>
                          <td className="border border-gray-800 p-1">{t['FECHA DE CIERRE']}</td>
                          <td className="border border-gray-800 p-1">{t.TIPO}</td>
                          <td className="border border-gray-800 p-1">{t.TECNICO}</td>
                          <td className="border border-gray-800 p-1">{t['ACTIVIDAD DEL TICKET']}</td>
                          <td className="border border-gray-800 p-1 break-words max-w-[150px]">{t.PROBLEMA}</td>
                          <td className="border border-gray-800 p-1 text-right font-bold">{t.SUMAXH}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {pendingTickets.length > 0 && (
                  <div className="mb-8">
                    <h3 className="font-bold text-lg border-b border-gray-400 mb-2 uppercase text-red-600">5. Tickets Pendientes</h3>
                    <table className="w-full text-xs border-collapse border border-gray-800">
                      <thead className="bg-gray-200">
                        <tr>
                          <th className="border border-gray-800 p-1 text-left">IDTICKET</th>
                          <th className="border border-gray-800 p-1 text-left">ESTADO</th>
                          <th className="border border-gray-800 p-1 text-left">FHPROGRAMADA</th>
                          <th className="border border-gray-800 p-1 text-left">TIPO</th>
                          <th className="border border-gray-800 p-1 text-left">PROBLEMA</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pendingTickets.map(t => (
                          <tr key={t.IDTICKET}>
                            <td className="border border-gray-800 p-1 font-bold">{t.IDTICKET}</td>
                            <td className="border border-gray-800 p-1 font-bold text-red-600">{t.ESTADO}</td>
                            <td className="border border-gray-800 p-1">{t.FHPROGRAMADA}</td>
                            <td className="border border-gray-800 p-1">{t.TIPO}</td>
                            <td className="border border-gray-800 p-1">{t.PROBLEMA}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {activeView === 'GUIA' && selectedTicket && (() => {
              const ticketRepuestos = data?.repuestos?.filter(r => (r.IDTICKET || '').trim().toUpperCase() === (selectedTicket.IDTICKET || '').trim().toUpperCase()) || [];
              const ticketFotos = data?.fotosTicket?.filter(f => (f.IDTICKET || '').trim().toUpperCase() === (selectedTicket.IDTICKET || '').trim().toUpperCase()) || [];
              const ticketFotosAct = data?.fotosAct?.filter(f => ticketActividades.some(a => (a.IDACTIVIDADES || '').trim().toUpperCase() === (f.IDACTIVIDADES || '').trim().toUpperCase())) || [];

              return (
                <div className="flex flex-col items-center pb-12 w-full min-w-min">
                  {/* Floating/Sticky Action & Zoom Toolbar */}
                  <div className="sticky top-0 z-30 w-full mb-3 print:hidden">
                    <div className="bg-slate-900/90 backdrop-blur-md border border-slate-700/80 rounded-xl p-2 sm:p-2.5 shadow-xl flex flex-wrap items-center justify-between gap-2">
                      {/* Zoom / Scale Controls */}
                      <div className="flex items-center gap-1 sm:gap-2 bg-slate-950/80 border border-slate-800 rounded-lg p-1">
                        <button
                          type="button"
                          onClick={() => {
                            setIsAutoFit(false);
                            setScale(prev => Math.max(0.3, Number((prev - 0.1).toFixed(2))));
                          }}
                          className="p-1.5 hover:bg-slate-800 text-slate-300 hover:text-white rounded transition-colors"
                          title="Alejar (Zoom Out)"
                        >
                          <ZoomOut className="w-4 h-4" />
                        </button>

                        <span className="text-xs font-mono font-bold text-slate-200 min-w-[44px] text-center select-none">
                          {Math.round(scale * 100)}%
                        </span>

                        <button
                          type="button"
                          onClick={() => {
                            setIsAutoFit(false);
                            setScale(prev => Math.min(2, Number((prev + 0.1).toFixed(2))));
                          }}
                          className="p-1.5 hover:bg-slate-800 text-slate-300 hover:text-white rounded transition-colors"
                          title="Acercar (Zoom In)"
                        >
                          <ZoomIn className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Quick Mode Presets */}
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setIsAutoFit(true)}
                          className={`px-2.5 py-1 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors ${
                            isAutoFit 
                              ? 'bg-blue-600 text-white shadow-sm' 
                              : 'bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700'
                          }`}
                          title="Ajustar automáticamente al ancho de la pantalla"
                        >
                          <Maximize2 className="w-3.5 h-3.5" />
                          <span>Ajustar</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setIsAutoFit(false);
                            setScale(1);
                          }}
                          className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors ${
                            scale === 1 && !isAutoFit
                              ? 'bg-blue-600 text-white shadow-sm' 
                              : 'bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700'
                          }`}
                          title="Tamaño real (100%)"
                        >
                          100%
                        </button>
                      </div>
                    </div>
                  </div>

                  <GuiaDocumentPages
                    ticket={selectedTicket}
                    data={data}
                    actividades={ticketActividades}
                    repuestos={ticketRepuestos}
                    fotosTicket={ticketFotos}
                    fotosAct={ticketFotosAct}
                    pageWrapper={(pageContent, pageKey, pageIdx, meta) => (
                      <ScaledA4Page 
                        key={pageKey} 
                        scale={scale} 
                        id={pageIdx === 0 ? 'guia-print' : pageKey}
                        pageNumber={meta?.pageNumber}
                        totalPages={meta?.totalPages}
                        pageLabel={meta?.pageLabel}
                        isLast={meta?.isLast}
                      >
                        {pageContent}
                      </ScaledA4Page>
                    )}
                  />
                </div>
              );
            })()}

        {/* Action Footer (Sticky) */}
          </div>
        </div>
      </div>
      
      {showFotosModal && activeActividadForFotos && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4">
          <div className="w-full max-w-4xl bg-[#111827] border border-slate-700 rounded-xl overflow-hidden flex flex-col relative h-[80vh]">
            <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-[#0B1120]">
              <h3 className="font-bold text-white">Fotografías - {activeActividadForFotos.TIPO} {activeActividadForFotos.MARCA}</h3>
              <button onClick={() => setShowFotosModal(false)} className="text-slate-400 hover:text-white"><X className="w-6 h-6" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 flex justify-center items-start">
              {(() => {
                const fotos = data?.fotosAct?.filter(f => f.IDACTIVIDADES === activeActividadForFotos.IDACTIVIDADES) || [];
                if (fotos.length === 0) return <div className="text-slate-500 mt-20">No hay fotos asociadas a esta actividad.</div>;
                return (
                  <div className="flex flex-col gap-4 items-center w-full">
                    {fotos.map(f => (
                       <AuthenticatedImage referrerPolicy="no-referrer" key={f.ID} src={f.FOTO} alt="Foto Actividad" className="w-full max-w-2xl rounded shadow-lg border border-slate-700 object-contain" />
                    ))}
                  </div>
                )
              })()}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
