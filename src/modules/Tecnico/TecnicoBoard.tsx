import React, { useState, useEffect, useMemo, useRef } from 'react';
import { AppData, Ticket } from '../../types';
import { updateTicket, parseDateStringToTimestamp } from '../../lib/googleApi';
import { MapPin, Play, Send, Ban } from 'lucide-react';
import TecnicoTicketDetail from './TecnicoTicketDetail';
import { inspectTicketChanges, notifyTicketStateChange, TicketSnapshot } from '../../utils/notifications';

const extractTicketNumber = (id: string | undefined | null): number => {
  if (!id) return 0;
  const match = id.match(/\d+/g);
  return match ? parseInt(match.join(''), 10) : 0;
};

interface Props {
  data: AppData;
  onUpdate: () => void;
}

export default function TecnicoBoard({ data, onUpdate }: Props) {
  const [localTickets, setLocalTickets] = useState<Ticket[]>(() => {
    // get unique most recent ticket instances like TicketBoard
    const stateOrder: Record<string, number> = { 'ASIGNADO': 1, 'EN ATENCION': 2, 'PENDIENTE': 3, 'CERRADO': 4, 'ANULADO': 5 };
    const latestTickets = new Map<string, Ticket>();
    
    data.tickets.forEach(ticket => {
      const existing = latestTickets.get(ticket.IDTICKET);
      if (!existing) {
        latestTickets.set(ticket.IDTICKET, ticket);
      } else {
        const currentOrder = stateOrder[existing.ESTADO] || 0;
        const newOrder = stateOrder[ticket.ESTADO] || 0;
        if (newOrder > currentOrder) {
          latestTickets.set(ticket.IDTICKET, ticket);
        }
      }
    });
    return Array.from(latestTickets.values());
  });

  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const prevSnapshotRef = useRef<Map<string, TicketSnapshot>>(new Map());
  const isFirstLoadRef = useRef(true);

  // Monitorear tickets locales para disparar notificaciones de Windows cuando cambien de estado o reciban firma
  useEffect(() => {
    if (!localTickets || localTickets.length === 0) return;

    if (isFirstLoadRef.current) {
      // Primera carga: registrar fotografía inicial sin disparar notificaciones
      prevSnapshotRef.current = inspectTicketChanges(localTickets, prevSnapshotRef.current, true);
      isFirstLoadRef.current = false;
      return;
    }

    // Actualizaciones posteriores: detectar cambios y notificar
    prevSnapshotRef.current = inspectTicketChanges(localTickets, prevSnapshotRef.current, false);
  }, [localTickets]);

  // Sync with background updates from data.tickets while keeping selectedTicket open
  useEffect(() => {
    const stateOrder: Record<string, number> = { 'ASIGNADO': 1, 'EN ATENCION': 2, 'PENDIENTE': 3, 'CERRADO': 4, 'ANULADO': 5 };
    const latestTickets = new Map<string, Ticket>();
    
    data.tickets.forEach(ticket => {
      const existing = latestTickets.get(ticket.IDTICKET);
      if (!existing) {
        latestTickets.set(ticket.IDTICKET, ticket);
      } else {
        const currentOrder = stateOrder[existing.ESTADO] || 0;
        const newOrder = stateOrder[ticket.ESTADO] || 0;
        if (newOrder > currentOrder) {
          latestTickets.set(ticket.IDTICKET, ticket);
        }
      }
    });
    const refreshed = Array.from(latestTickets.values());
    setLocalTickets(refreshed);

    setSelectedTicket(prev => {
      if (!prev) return null;
      const found = refreshed.find(t => t.IDTICKET === prev.IDTICKET);
      return found ? { ...found, ...prev } : prev;
    });
  }, [data.tickets]);
  const [notificaTicket, setNotificaTicket] = useState<Ticket | null>(null);
  const [destinatarioNotificacion, setDestinatarioNotificacion] = useState('');

  const [loadingTicketId, setLoadingTicketId] = useState<string | null>(null);
  const getNowStr = () => {
    const now = new Date();
    return `${now.getDate().toString().padStart(2, '0')}/${(now.getMonth()+1).toString().padStart(2, '0')}/${now.getFullYear()} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
  };

  const getLocation = (): Promise<string> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve('-12.046374, -77.042793');
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve(`${pos.coords.latitude}, ${pos.coords.longitude}`),
        () => resolve('-12.046374, -77.042793'),
        { timeout: 5000 }
      );
    });
  };


  const groupedTickets = useMemo(() => {
    const columns: Record<'ASIGNADO' | 'EN ATENCION' | 'PENDIENTE' | 'CERRADO', Ticket[]> = {
      'ASIGNADO': [],
      'EN ATENCION': [],
      'PENDIENTE': [],
      'CERRADO': []
    };

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    localTickets.forEach(ticket => {
      if (ticket.ESTADO === 'CERRADO') {
        const ts = parseDateStringToTimestamp(ticket['FECHA DE CIERRE']) || parseDateStringToTimestamp(ticket.FHINGRESO);
        if (ts) {
          const d = new Date(ts);
          if (d.getMonth() === currentMonth && d.getFullYear() === currentYear) {
            columns['CERRADO'].push(ticket);
          }
        } else {
          columns['CERRADO'].push(ticket);
        }
      } else if (ticket.ESTADO in columns) {
        columns[ticket.ESTADO as keyof typeof columns].push(ticket);
      }
    });

    // Helper para obtener el timestamp más representativo de recencia para cada estado
    const getTicketRecencyTimestamp = (ticket: Ticket, estado: string): number => {
      const actList = (data.actividades || []).filter(a => a.IDTICKET === ticket.IDTICKET);

      if (estado === 'CERRADO') {
        const fc = parseDateStringToTimestamp(ticket['FECHA DE CIERRE']);
        if (fc) return fc;
        for (const a of actList) {
          const af = parseDateStringToTimestamp(a.FHFIN);
          if (af) return af;
        }
      }

      if (estado === 'EN ATENCION') {
        for (const a of actList) {
          const ai = parseDateStringToTimestamp(a.FHINICIO);
          if (ai) return ai;
        }
        const di = parseDateStringToTimestamp(ticket.DATEINICIO);
        if (di) return di;
        const llc = parseDateStringToTimestamp(ticket.FHLLC);
        if (llc) return llc;
      }

      if (estado === 'PENDIENTE') {
        for (const a of actList) {
          const af = parseDateStringToTimestamp(a.FHFIN);
          if (af) return af;
        }
        const di = parseDateStringToTimestamp(ticket.DATEINICIO);
        if (di) return di;
      }

      if (estado === 'ASIGNADO') {
        const fi = parseDateStringToTimestamp(ticket.FHINGRESO);
        if (fi) return fi;
        const fp = parseDateStringToTimestamp(ticket.FHPROGRAMADA);
        if (fp) return fp;
      }

      // Fallbacks generales de fecha
      const generalFi = parseDateStringToTimestamp(ticket.FHINGRESO);
      if (generalFi) return generalFi;

      const generalFp = parseDateStringToTimestamp(ticket.FHPROGRAMADA);
      if (generalFp) return generalFp;

      return 0;
    };

    // Función de ordenamiento: del más reciente al más antiguo
    const sortNewestFirst = (tickets: Ticket[], estado: string) => {
      return tickets.sort((a, b) => {
        // 1. Timestamp de fecha y hora más reciente (mayor timestamp primero)
        const tsA = getTicketRecencyTimestamp(a, estado);
        const tsB = getTicketRecencyTimestamp(b, estado);
        if (tsA !== tsB && tsA > 0 && tsB > 0) {
          return tsB - tsA;
        }
        if (tsA > 0 && tsB === 0) return -1;
        if (tsB > 0 && tsA === 0) return 1;

        // 2. Número correlativo de ticket (mayor ID numérico primero: ej. VSP-1458 antes de VSP-1457)
        const numA = extractTicketNumber(a.IDTICKET);
        const numB = extractTicketNumber(b.IDTICKET);
        if (numA !== numB && numA > 0 && numB > 0) {
          return numB - numA;
        }

        // 3. Fecha de ingreso general si hubiere
        const ingA = parseDateStringToTimestamp(a.FHINGRESO) || 0;
        const ingB = parseDateStringToTimestamp(b.FHINGRESO) || 0;
        if (ingA !== ingB) {
          return ingB - ingA;
        }

        // 4. Fila en la hoja de cálculo (_rowIndex mayor = ingresado más tarde)
        const rowA = a._rowIndex || 0;
        const rowB = b._rowIndex || 0;
        if (rowA !== rowB) {
          return rowB - rowA;
        }

        return (b.IDTICKET || '').localeCompare(a.IDTICKET || '');
      });
    };

    sortNewestFirst(columns['ASIGNADO'], 'ASIGNADO');
    sortNewestFirst(columns['EN ATENCION'], 'EN ATENCION');
    sortNewestFirst(columns['PENDIENTE'], 'PENDIENTE');
    sortNewestFirst(columns['CERRADO'], 'CERRADO');

    return columns;
  }, [localTickets, data.actividades]);

    const handleEnviarNotificacion = async () => {
    if (!notificaTicket || !destinatarioNotificacion) return;
    try {
      const subject = `Reporte de Servicio: Ticket ${notificaTicket.IDTICKET}`;
      const plainTextBody = `Estimado cliente,

El servicio técnico del ticket ${notificaTicket.IDTICKET} ha sido finalizado. 
Adjuntamos el reporte de servicio firmado que puede visualizar aquí:

${notificaTicket.PDF || 'Enlace no disponible'}

Gracias.`;
      
      const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(destinatarioNotificacion)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(plainTextBody)}`;
      window.open(gmailUrl, '_blank');
      
      const updated = { ...notificaTicket, NOTIFICA: 'ENVIADO' };
      await updateTicket(notificaTicket._rowIndex!, updated);
      handleTicketUpdateLocally(updated);
      setNotificaTicket(null);
    } catch(e) {
      console.error(e);
      alert('Error al enviar notificacion');
    }
  };

  const handleTicketUpdateLocally = (updatedTicket: Ticket) => {
    setLocalTickets(prev => prev.map(t => t.IDTICKET === updatedTicket.IDTICKET ? updatedTicket : t));
    setSelectedTicket(prev => prev?.IDTICKET === updatedTicket.IDTICKET ? updatedTicket : prev); // refresh selected ticket only if open
    onUpdate(); // optionally trigger global refresh if needed
  };

  const Column = ({ title, tickets }: { title: string; tickets: Ticket[] }) => {
    const borderColor = 
      title === 'ASIGNADO' ? 'border-red-500/80 shadow-[0_0_15px_rgba(239,68,68,0.1)]' :
      title === 'EN ATENCION' ? 'border-orange-500/80 shadow-[0_0_15px_rgba(249,115,22,0.1)]' :
      title === 'PENDIENTE' ? 'border-blue-500/80 shadow-[0_0_15px_rgba(59,130,246,0.1)]' :
      title === 'CERRADO' ? 'border-emerald-500/80 shadow-[0_0_15px_rgba(16,185,129,0.1)]' :
      'border-slate-800';

    const handleAction = async (e: React.MouseEvent, ticket: Ticket, action: 'LLEGADA' | 'INICIO') => {
      e.stopPropagation();
      setLoadingTicketId(ticket.IDTICKET);
      try {
        let updated = { ...ticket };
        if (action === 'LLEGADA') {
          const coords = await getLocation();
          const nowStr = getNowStr();
          updated = { ...updated, 'GPS ENTRADA': coords, FHLLC: nowStr };
        } else if (action === 'INICIO') {
          const nowStr = getNowStr();
          updated = { ...updated, ESTADO: 'EN ATENCION', DATEINICIO: nowStr };
          notifyTicketStateChange(updated, 'EN ATENCION');
        }
        await updateTicket(ticket._rowIndex!, updated);
        handleTicketUpdateLocally(updated);
      } catch (error) {
        console.error(error);
        alert('Error al actualizar ticket');
      } finally {
        setLoadingTicketId(null);
      }
    };

    const handleAnular = async (e: React.MouseEvent, ticket: Ticket) => {
      e.stopPropagation();
      const confirmAnular = window.confirm(`¿Está seguro de que desea ANULAR el Ticket ${ticket.IDTICKET}?`);
      if (!confirmAnular) return;

      setLoadingTicketId(ticket.IDTICKET);
      try {
        const updated: Ticket = { ...ticket, ESTADO: 'ANULADO' };
        await updateTicket(ticket._rowIndex!, updated);
        handleTicketUpdateLocally(updated);
      } catch (error) {
        console.error(error);
        alert('Error al anular el ticket');
      } finally {
        setLoadingTicketId(null);
      }
    };

    return (
    <div className={`flex-1 min-w-[280px] sm:min-w-[320px] bg-slate-900/50 rounded-2xl p-4 flex flex-col gap-4 border-2 h-full overflow-hidden shrink-0 snap-center ${borderColor}`}>
      <div className="flex items-center justify-between pb-2 border-b border-slate-800">
        <h3 className="font-bold text-white uppercase text-sm tracking-wide">{title}</h3>
        <span className="bg-slate-800 text-slate-300 text-xs font-bold px-2 py-1 rounded-full">{tickets.length}</span>
      </div>
      <div className="flex-1 overflow-y-auto flex flex-col gap-3 pr-2 custom-scrollbar">
        {tickets.map(ticket => {
          const act = data.actividades.filter(a => a.IDTICKET === ticket.IDTICKET);
          
          let sumTe = '00:00';
          let totalMins = 0;
          act.forEach(a => {
             if (a.TE) {
                 const [h,m] = a.TE.split(':');
                 totalMins += (parseInt(h) || 0) * 60 + (parseInt(m) || 0);
             }
          });
          const th = Math.floor(totalMins/60).toString().padStart(2, '0');
          const tm = (totalMins%60).toString().padStart(2, '0');
          sumTe = `${th}:${tm}`;

          const maxFhInicio = act.length > 0 ? act.map(a => a.FHINICIO).sort().reverse()[0] : '-';
          const maxFhFin = act.length > 0 ? act.map(a => a.FHFIN).sort().reverse()[0] : '-';

          return (
          <div
            key={ticket.IDTICKET}
            onClick={() => setSelectedTicket(ticket)}
            className="bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-700 hover:border-blue-500/50 cursor-pointer transition-colors group flex flex-col gap-3 relative"
          >
            {loadingTicketId === ticket.IDTICKET && (
               <div className="absolute inset-0 bg-slate-900/50 flex items-center justify-center z-10 rounded-xl backdrop-blur-sm">
                 <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
               </div>
            )}
            <div className="flex justify-between items-start mb-2">
              <div className="flex items-center gap-2">
                <div>
                  <span className="text-blue-400 font-bold text-sm block">{ticket.IDTICKET}</span>
                  <span className="text-white font-bold text-base truncate block max-w-[160px] sm:max-w-[200px]">{ticket.CLIENTE}</span>
                </div>
                {title === 'CERRADO' && (
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      if (ticket.NOTIFICA !== 'ENVIADO') {
                        setNotificaTicket(ticket);
                        setDestinatarioNotificacion(ticket.CONTACTO || '');
                      }
                    }}
                    className={`p-1.5 rounded-lg border ${ticket.NOTIFICA === 'ENVIADO' ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400' : 'bg-red-500/20 border-red-500/50 text-red-400 hover:bg-red-500/30'} transition-colors ml-2`}
                    title={ticket.NOTIFICA === 'ENVIADO' ? 'Notificado' : 'Notificar Cierre'}
                  >
                    <Send className="w-4 h-4" />
                  </button>
                )}
              </div>
              <span className={`text-[10px] font-bold px-2 py-1 rounded uppercase ${
                ticket.PRIORIDAD === 'ALTA' ? 'bg-red-500/20 text-red-400' :
                ticket.PRIORIDAD === 'MEDIA' ? 'bg-amber-500/20 text-amber-400' :
                'bg-emerald-500/20 text-emerald-400'
              }`}>
                {ticket.PRIORIDAD}
              </span>
            </div>

            <div className="text-xs text-slate-300 flex flex-col gap-1.5">
              {title === 'ASIGNADO' && (
                <>
                  <p><span className="text-slate-500 font-bold">FHINGRESO:</span> <span className="text-white font-bold">{ticket.FHINGRESO}</span></p>
                  <p><span className="text-slate-500 font-bold">Prog:</span> <span className="text-white font-bold">{ticket.FHPROGRAMADA}</span></p>
                  <p><span className="text-slate-500 font-bold">Tipo:</span> <span className="text-blue-400 font-bold">{ticket.TIPO}</span></p>
                  <p><span className="text-slate-500 font-bold">Técnico:</span> <span className="text-blue-400 font-bold">{ticket.TECNICO}</span></p>
                  
                  <div className="pt-2 mt-2 border-t border-slate-700 flex flex-col gap-2">
                    {(!ticket['GPS ENTRADA'] || !ticket.FHLLC) ? (
                      <button onClick={(e) => handleAction(e, ticket, 'LLEGADA')} className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition-colors cursor-pointer text-xs">
                        <MapPin className="w-4 h-4" /> Marcar Llegada al Cliente
                      </button>
                    ) : (
                      <button onClick={(e) => handleAction(e, ticket, 'INICIO')} className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20 transition-colors cursor-pointer text-xs">
                        <Play className="w-4 h-4" /> Inicio de Servicio
                      </button>
                    )}

                    <button 
                      onClick={(e) => handleAnular(e, ticket)} 
                      className="w-full py-1.5 bg-red-500/10 hover:bg-red-600 text-red-400 hover:text-white border border-red-500/30 hover:border-red-600 font-bold rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer text-xs"
                      title="Anular Ticket"
                    >
                      <Ban className="w-3.5 h-3.5" /> ANULAR
                    </button>
                  </div>
                </>
              )}

              {title === 'EN ATENCION' && (
                <>
                  <p><span className="text-slate-500 font-bold">Tipo:</span> <span className="text-blue-400 font-bold">{ticket.TIPO}</span></p>
                  <p><span className="text-slate-500 font-bold">Técnico:</span> <span className="text-blue-400 font-bold">{ticket.TECNICO}</span></p>
                  <p><span className="text-slate-500 font-bold">Tiempo Eficaz Total:</span> <span className="text-white font-bold">{sumTe}</span></p>
                  <p><span className="text-slate-500 font-bold">Fecha y Hora de Atencion:</span> <span className="text-white font-bold">{maxFhInicio}</span></p>
                </>
              )}

              {title === 'PENDIENTE' && (
                <>
                  <p><span className="text-slate-500 font-bold">Tipo:</span> <span className="text-blue-400 font-bold">{ticket.TIPO}</span></p>
                  <p><span className="text-slate-500 font-bold">Técnico:</span> <span className="text-blue-400 font-bold">{ticket.TECNICO}</span></p>
                  <p><span className="text-slate-500 font-bold">Tiempo Eficaz Total:</span> <span className="text-white font-bold">{sumTe}</span></p>
                  <p><span className="text-slate-500 font-bold">Fecha y Hora de Pausa:</span> <span className="text-white font-bold">{maxFhFin}</span></p>
                </>
              )}

              {title === 'CERRADO' && (
                <>
                  <p><span className="text-slate-500 font-bold">Tipo:</span> <span className="text-blue-400 font-bold">{ticket.TIPO}</span></p>
                  <p><span className="text-slate-500 font-bold">Técnico:</span> <span className="text-blue-400 font-bold">{ticket.TECNICO}</span></p>
                  <p><span className="text-slate-500 font-bold">Tiempo Eficaz Total:</span> <span className="text-white font-bold">{sumTe}</span></p>
                  <p><span className="text-slate-500 font-bold">Fecha y Hora de Cierre:</span> <span className="text-white font-bold">{maxFhFin}</span></p>
                </>
              )}
            </div>
          </div>
          );
        })}
      </div>
    </div>
  );
  };
  return (
    <div className="flex-1 w-full flex flex-col overflow-hidden relative">
      <div className="flex-1 flex gap-4 overflow-x-auto pb-4 h-full snap-x snap-mandatory">
        <Column title="ASIGNADO" tickets={groupedTickets['ASIGNADO']} />
        <Column title="EN ATENCION" tickets={groupedTickets['EN ATENCION']} />
        <Column title="PENDIENTE" tickets={groupedTickets['PENDIENTE']} />
        <Column title="CERRADO" tickets={groupedTickets['CERRADO']} />
      </div>

      {selectedTicket && (
        <TecnicoTicketDetail 
          ticket={selectedTicket} 
          data={data}
          onClose={() => {
            setSelectedTicket(null);
            onUpdate();
          }} 
          onUpdateLocally={handleTicketUpdateLocally}
          onUpdate={onUpdate}
        />
      )}
    </div>
  );
}
