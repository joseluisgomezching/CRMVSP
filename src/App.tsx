import { useState } from 'react';
import {
  Ticket,
  CheckCircle,
  Wrench,
  Bus,
  FileText,
  Users,
  Edit,
  Activity,
  Briefcase,
  FileSignature,
  Truck,
  Package,
  ArrowLeft,
} from 'lucide-react';
import TicketsModule from './modules/Tickets';
import TecnicoModule from './modules/Tecnico';
import ClientSignatureView from './components/ClientSignatureView';
import TicketsCerradosModule from './modules/TicketsCerrados';
import RendirPasajesModule from './modules/RendirPasajes';
import CajaChicaModule from './modules/CajaChica';
import InformesModule from './modules/Informes';
import EmpresasModule from './modules/Empresas';
import EditarTicketsModule from './modules/EditarTickets';
import ActividadesInternasModule from './modules/ActividadesInternas';
import CotizacionesModule from './modules/Cotizaciones';

export default function App() {
  const [activeModule, setActiveModule] = useState<string | null>(null);
  // There is no signed-in identity. All available modules are displayed.
  const isAdmin = true;

  const allMenuItems = [
    { 
      label: 'TICKET', 
      icon: Ticket, 
      id: 'TICKET', 
      colorClass: 'text-amber-400', 
      bgClass: 'bg-amber-500/10 border-amber-500/30 group-hover:bg-amber-500 group-hover:text-slate-950 group-hover:border-amber-400 group-active:bg-amber-400',
      cardHover: 'hover:border-amber-500/40 hover:bg-amber-950/20'
    },
    { 
      label: 'TICKETS CERRADOS', 
      icon: CheckCircle, 
      id: 'TICKETS_CERRADOS', 
      colorClass: 'text-emerald-400', 
      bgClass: 'bg-emerald-500/10 border-emerald-500/30 group-hover:bg-emerald-500 group-hover:text-slate-950 group-hover:border-emerald-400 group-active:bg-emerald-400',
      cardHover: 'hover:border-emerald-500/40 hover:bg-emerald-950/20'
    },
    { 
      label: 'TECNICO', 
      icon: Wrench, 
      id: 'TECNICO', 
      colorClass: 'text-cyan-400', 
      bgClass: 'bg-cyan-500/10 border-cyan-500/30 group-hover:bg-cyan-500 group-hover:text-slate-950 group-hover:border-cyan-400 group-active:bg-cyan-400',
      cardHover: 'hover:border-cyan-500/40 hover:bg-cyan-950/20'
    },
    { 
      label: 'RENDIR PASAJES', 
      icon: Bus, 
      id: 'RENDIR_PASAJES', 
      colorClass: 'text-purple-400', 
      bgClass: 'bg-purple-500/10 border-purple-500/30 group-hover:bg-purple-500 group-hover:text-slate-950 group-hover:border-purple-400 group-active:bg-purple-400',
      cardHover: 'hover:border-purple-500/40 hover:bg-purple-950/20'
    },
    { 
      label: 'INFORMES', 
      icon: FileText, 
      id: 'INFORMES', 
      colorClass: 'text-rose-400', 
      bgClass: 'bg-rose-500/10 border-rose-500/30 group-hover:bg-rose-500 group-hover:text-slate-950 group-hover:border-rose-400 group-active:bg-rose-400',
      cardHover: 'hover:border-rose-500/40 hover:bg-rose-950/20'
    },
    { 
      label: 'EMPRESAS Y PERSONAL', 
      icon: Users, 
      id: 'EMPRESAS', 
      colorClass: 'text-indigo-400', 
      bgClass: 'bg-indigo-500/10 border-indigo-500/30 group-hover:bg-indigo-500 group-hover:text-slate-950 group-hover:border-indigo-400 group-active:bg-indigo-400',
      cardHover: 'hover:border-indigo-500/40 hover:bg-indigo-950/20'
    },
    { 
      label: 'EDITAR TICKETS', 
      icon: Edit, 
      id: 'EDITAR_TICKETS', 
      colorClass: 'text-orange-400', 
      bgClass: 'bg-orange-500/10 border-orange-500/30 group-hover:bg-orange-500 group-hover:text-slate-950 group-hover:border-orange-400 group-active:bg-orange-400',
      cardHover: 'hover:border-orange-500/40 hover:bg-orange-950/20'
    },
    { 
      label: 'ACTIVIDADES INTERNAS', 
      icon: Activity, 
      id: 'ACTIVIDADES', 
      colorClass: 'text-teal-400', 
      bgClass: 'bg-teal-500/10 border-teal-500/30 group-hover:bg-teal-500 group-hover:text-slate-950 group-hover:border-teal-400 group-active:bg-teal-400',
      cardHover: 'hover:border-teal-500/40 hover:bg-teal-950/20'
    },
    { 
      label: 'CAJA CHICA', 
      icon: Briefcase, 
      id: 'CAJA_CHICA', 
      colorClass: 'text-fuchsia-400', 
      bgClass: 'bg-fuchsia-500/10 border-fuchsia-500/30 group-hover:bg-fuchsia-500 group-hover:text-slate-950 group-hover:border-fuchsia-400 group-active:bg-fuchsia-400',
      cardHover: 'hover:border-fuchsia-500/40 hover:bg-fuchsia-950/20'
    },
    { 
      label: 'COTIZACIONES', 
      icon: FileSignature, 
      id: 'COTIZACIONES', 
      colorClass: 'text-lime-400', 
      bgClass: 'bg-lime-500/10 border-lime-500/30 group-hover:bg-lime-500 group-hover:text-slate-950 group-hover:border-lime-400 group-active:bg-lime-400',
      cardHover: 'hover:border-lime-500/40 hover:bg-lime-950/20'
    },
    { 
      label: 'RENTAL', 
      icon: Truck, 
      id: 'RENTAL', 
      colorClass: 'text-yellow-400', 
      bgClass: 'bg-yellow-500/10 border-yellow-500/30 group-hover:bg-yellow-500 group-hover:text-slate-950 group-hover:border-yellow-400 group-active:bg-yellow-400',
      cardHover: 'hover:border-yellow-500/40 hover:bg-yellow-950/20'
    },
    { 
      label: 'INVENTARIO ALMACEN', 
      icon: Package, 
      id: 'INVENTARIO', 
      colorClass: 'text-sky-400', 
      bgClass: 'bg-sky-500/10 border-sky-500/30 group-hover:bg-sky-500 group-hover:text-slate-950 group-hover:border-sky-400 group-active:bg-sky-400',
      cardHover: 'hover:border-sky-500/40 hover:bg-sky-950/20'
    }
  ];

  const menuItems = allMenuItems;

  const getSignTicketId = (): string | null => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const fromSearch = urlParams.get('signTicket') || urlParams.get('signTecnicoTicket') || urlParams.get('ticket') || urlParams.get('ticketId') || urlParams.get('id');
      if (fromSearch) return fromSearch;

      if (window.location.hash) {
        const hashPart = window.location.hash.includes('?') ? window.location.hash.split('?')[1] : '';
        if (hashPart) {
          const hashParams = new URLSearchParams(hashPart);
          const fromHash = hashParams.get('signTicket') || hashParams.get('signTecnicoTicket') || hashParams.get('ticket') || hashParams.get('ticketId') || hashParams.get('id');
          if (fromHash) return fromHash;
        }
        const matchHashPath = window.location.hash.match(/#\/(?:firma|firmar|sign)\/([^/?#]+)/i);
        if (matchHashPath) return decodeURIComponent(matchHashPath[1]);
      }

      const matchPath = window.location.pathname.match(/\/(?:firma|firmar|sign)\/([^/?#]+)/i);
      if (matchPath) return decodeURIComponent(matchPath[1]);
    } catch (e) {
      console.error('Error extracting signTicketId:', e);
    }
    return null;
  };

  const signTicketId = getSignTicketId();

  if (signTicketId) {
    return <ClientSignatureView ticketId={signTicketId} />;
  }

  return (
    <div className="flex flex-col h-screen w-full bg-slate-950 overflow-hidden font-sans text-slate-200">
      <nav className="flex items-center justify-between px-3 sm:px-8 py-2 sm:py-3 bg-slate-900 border-b border-slate-800 shadow-sm shrink-0 z-30">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          {activeModule && (
            <button
              onClick={() => setActiveModule(null)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-300 hover:text-white rounded-xl border border-slate-700 transition-all shrink-0 text-xs font-semibold shadow-sm"
              title="Volver al menú principal"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden xs:inline">Menú</span>
            </button>
          )}
          <div className="w-8 h-8 sm:w-10 sm:h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white font-bold text-base sm:text-xl shrink-0 shadow-md">
            V
          </div>
          <div className="min-w-0">
            <h1 className="text-sm sm:text-lg md:text-xl font-bold tracking-tight text-white truncate">
              VSP Desk <span className="text-blue-500 font-black">2.0</span>
            </h1>
            <p className="text-[9px] sm:text-[10px] uppercase tracking-widest text-blue-400 font-semibold truncate hidden xs:block">
              Central Management System
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 sm:gap-4 shrink-0">
          <div className="text-xs text-slate-300">Acceso directo</div>
        </div>
      </nav>

      <main className={`flex-1 flex flex-col w-full ${!activeModule ? 'items-center justify-start sm:justify-center overflow-y-auto p-2.5 sm:p-6 pb-6 sm:pb-8' : 'overflow-hidden p-0 sm:p-2'} min-h-0 custom-scrollbar`}>
        {activeModule === 'TICKET' ? (
          <TicketsModule />
        ) : activeModule === 'TECNICO' ? (
          <TecnicoModule />
        ) : activeModule === 'TICKETS_CERRADOS' ? (
          <TicketsCerradosModule />
        ) : activeModule === 'RENDIR_PASAJES' ? (
          <RendirPasajesModule />
        ) : activeModule === 'CAJA_CHICA' ? (
          <CajaChicaModule />
        ) : activeModule === 'INFORMES' ? (
          <InformesModule />
        ) : activeModule === 'EMPRESAS' ? (
          <EmpresasModule />
        ) : activeModule === 'EDITAR_TICKETS' ? (
          <EditarTicketsModule />
        ) : activeModule === 'ACTIVIDADES' ? (
          <ActividadesInternasModule />
        ) : activeModule === 'COTIZACIONES' ? (
          <CotizacionesModule />
        ) : (
          <>
            <div className="w-full max-w-5xl bg-slate-900/90 backdrop-blur-md rounded-2xl sm:rounded-[36px] p-3 sm:p-6 md:p-8 shadow-2xl border border-slate-800/90 my-auto">
              <div className="flex items-center justify-between mb-3 sm:mb-6 gap-2">
                <div>
                  <h2 className="text-sm sm:text-xl font-bold text-white tracking-tight">Panel de Navegación Central</h2>
                  <p className="text-[10px] sm:text-xs text-slate-400">Selecciona el módulo para operar</p>
                </div>
                <div className="px-2.5 py-1 bg-blue-950/80 text-blue-300 border border-blue-800/50 rounded-full text-[9px] sm:text-xs font-bold uppercase tracking-wider shrink-0">
                  Acceso directo
                </div>
              </div>
              {menuItems.length === 0 ? (
                <div className="text-center py-12 text-slate-400 text-sm">
                  No tienes módulos asignados. Contacta al administrador.
                </div>
              ) : (
                <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 sm:gap-4 lg:gap-5">
                  {menuItems.map((item, index) => {
                    const Icon = item.icon;
                    const colorClass = (item as any).colorClass || 'text-blue-400';
                    const bgClass = (item as any).bgClass || 'bg-slate-800 border-slate-700';
                    const cardHover = (item as any).cardHover || 'hover:border-slate-700 hover:bg-slate-800/60';
                    return (
                      <button
                        key={index}
                        onClick={() => setActiveModule(item.id)}
                        className={`group flex flex-col items-center justify-center gap-1.5 sm:gap-3 p-2 sm:p-4 min-h-[92px] sm:min-h-[125px] rounded-2xl sm:rounded-3xl bg-slate-800/40 border border-slate-800/90 transition-all duration-200 active:scale-95 ${cardHover}`}
                      >
                        <div className={`w-10 h-10 sm:w-14 sm:h-14 shadow-lg rounded-xl sm:rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform shrink-0 border ${bgClass} ${colorClass}`}>
                          <Icon className="w-5 h-5 sm:w-7 sm:h-7" strokeWidth={2.2} />
                        </div>
                        <span className="text-[9.5px] sm:text-[11px] font-bold uppercase tracking-wide text-slate-200 group-hover:text-white text-center leading-tight line-clamp-2 px-1">
                          {item.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </main>

      {!activeModule && (
        <footer className="px-3 sm:px-8 py-2 sm:py-3 bg-slate-900 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-1.5 sm:gap-2 shrink-0 text-center sm:text-left">
          <div className="flex gap-3 sm:gap-6">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
              <span className="text-[8.5px] sm:text-[10px] text-slate-400 font-bold uppercase">Database Connected</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-blue-500"></div>
              <span className="text-[8.5px] sm:text-[10px] text-slate-400 font-bold uppercase">Version 2.0.0</span>
            </div>
          </div>
          <p className="text-[8.5px] sm:text-[10px] text-slate-500 font-medium hidden xs:block">VSP GROUP &copy; 2026 &bull; DESK MANAGEMENT INTERFACE</p>
        </footer>
      )}
    </div>
  );
}
