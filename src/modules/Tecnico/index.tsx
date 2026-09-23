import React, { useState, useEffect } from 'react';
import { fetchAppData } from '../../lib/googleApi';
import { AppData } from '../../types';
import TecnicoBoard from './TecnicoBoard';
import GoogleErrorCard from '../../components/GoogleErrorCard';
import NotificationToastContainer from '../../components/NotificationToastContainer';
import WindowsNotificationGuideModal from '../../components/WindowsNotificationGuideModal';
import { 
  requestDesktopNotificationPermission, 
  getNotificationPermission, 
  sendWindowsNotification, 
  isNotificationSupported,
  isInsideIframe,
  initNotificationServiceWorker
} from '../../utils/notifications';
import { Bell, BellRing, BellOff, ExternalLink, HelpCircle, Monitor } from 'lucide-react';

export default function TecnicoModule() {
  const [data, setData] = useState<AppData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isUpdatingBackground, setIsUpdatingBackground] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notifPermission, setNotifPermission] = useState<NotificationPermission | 'unsupported'>('default');
  const [showGuideModal, setShowGuideModal] = useState(false);
  const inIframe = isInsideIframe();

  useEffect(() => {
    loadData();

    // Inicializar Service Worker
    initNotificationServiceWorker().catch(() => {});

    // Consultar o solicitar permiso para notificaciones de Windows al entrar al módulo
    if (isNotificationSupported()) {
      const current = getNotificationPermission();
      setNotifPermission(current);
      if (current === 'default' && !inIframe) {
        requestDesktopNotificationPermission().then(res => {
          setNotifPermission(res);
        });
      }
    } else {
      setNotifPermission('unsupported');
    }

    // Polling en segundo plano cada 12 segundos para detectar cambios de estado y firmas en tiempo real
    const pollInterval = setInterval(() => {
      loadData(true);
    }, 12000);

    return () => clearInterval(pollInterval);
  }, []);

  const handleRequestPermission = async () => {
    if (inIframe) {
      setShowGuideModal(true);
      return;
    }
    const res = await requestDesktopNotificationPermission();
    setNotifPermission(res);
    if (res === 'granted') {
      sendWindowsNotification(
        '¡Notificaciones de Windows Activas!',
        'Las notificaciones de VSP Desk 2.0 ahora aparecerán en la barra de Windows.'
      );
    } else if (res === 'denied') {
      setShowGuideModal(true);
    }
  };

  const handleTestNotification = () => {
    sendWindowsNotification(
      'VSP Desk 2.0 - Alerta de Windows',
      '¡Alerta sobre la barra de tareas de Windows! Permanece visible incluso minimizado o en otra pestaña.'
    );
  };

  const loadData = async (silent = false) => {
    if (!silent && !data) {
      setLoading(true);
    } else {
      setIsUpdatingBackground(true);
    }
    if (!silent) {
      setError(null);
    }
    try {
      const appData = await fetchAppData();
      setData(appData);
    } catch (err: any) {
      if (!silent || !data) {
        setError(err.message || 'Error cargando datos');
      } else {
        console.warn('Error en actualización en segundo plano:', err);
      }
    } finally {
      setLoading(false);
      setIsUpdatingBackground(false);
    }
  };

  const handleUpdate = () => {
    loadData(true);
  };

  if (loading && !data) {
    return (
      <div className="flex-1 w-full flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="flex-1 w-full flex items-center justify-center p-4">
        <GoogleErrorCard error={error} onRetry={() => loadData(false)} title="Error al cargar Módulo Técnico" />
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="w-full h-full flex flex-col relative">
      <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-4 shrink-0 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-900/50 rounded-full flex items-center justify-center text-blue-400 font-bold border border-blue-500/20">
            T
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-white leading-tight">Todos los Técnicos</h2>
              {isUpdatingBackground && (
                <span className="flex items-center gap-1.5 text-[11px] text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full border border-blue-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse"></span>
                  Actualizando en 2do plano...
                </span>
              )}
            </div>
            <p className="text-slate-400 text-xs">Módulo Técnico General</p>
          </div>
        </div>

        {/* Notificaciones de Windows Header Control */}
        <div className="flex items-center gap-2">
          {inIframe && (
            <a
              href={typeof window !== 'undefined' ? window.location.href : '#'}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 hover:text-blue-300 text-xs font-semibold rounded-lg border border-blue-500/40 transition-colors cursor-pointer"
              title="Abrir en pestaña independiente para que Windows reciba las alertas sobre la barra de tareas"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Abrir Pestaña Windows</span>
            </a>
          )}

          {notifPermission === 'granted' ? (
            <div className="flex items-center gap-1.5">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold rounded-lg shadow-sm">
                <BellRing className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Windows Notificaciones</span> Activas
              </span>
              <button
                onClick={handleTestNotification}
                className="px-2.5 py-1 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 transition-colors cursor-pointer"
                title="Probar notificación en Windows"
              >
                Probar
              </button>
            </div>
          ) : notifPermission === 'denied' ? (
            <div className="flex items-center gap-1.5">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-medium rounded-lg">
                <BellOff className="w-3.5 h-3.5" />
                Notificaciones Bloqueadas
              </span>
              <button
                onClick={() => setShowGuideModal(true)}
                className="px-2.5 py-1 text-xs font-semibold text-rose-300 hover:text-white bg-rose-950/40 hover:bg-rose-900/50 rounded-lg border border-rose-800 transition-colors"
                title="Ver cómo desbloquear en Chrome/Windows"
              >
                ¿Cómo activar?
              </button>
            </div>
          ) : (
            <button
              onClick={handleRequestPermission}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-lg shadow-blue-500/20 transition-colors cursor-pointer"
            >
              <Bell className="w-3.5 h-3.5" />
              Activar Notificaciones Windows
            </button>
          )}

          <button
            onClick={() => setShowGuideModal(true)}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg border border-slate-700/60 transition-colors cursor-pointer"
            title="Guía de configuración en Windows 10/11"
          >
            <HelpCircle className="w-4 h-4" />
          </button>
        </div>
      </div>

      {inIframe && (
        <div className="mb-3 px-3.5 py-2 bg-blue-950/30 border border-blue-500/25 rounded-xl flex items-center justify-between gap-3 text-xs shrink-0">
          <div className="flex items-center gap-2 text-slate-300">
            <Monitor className="w-4 h-4 text-blue-400 shrink-0" />
            <span>
              Para que la notificación salga sobre la barra de tareas de Windows (esquina inferior derecha), abre la app en una <strong>Pestaña Directa de tu navegador</strong>.
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setShowGuideModal(true)}
              className="text-slate-400 hover:text-white underline text-[11px] cursor-pointer"
            >
              Ver Guía
            </button>
            <a
              href={typeof window !== 'undefined' ? window.location.href : '#'}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-[11px] rounded-lg transition-colors shadow-sm"
            >
              <ExternalLink className="w-3 h-3" />
              Abrir Pestaña
            </a>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-hidden flex flex-col">
        <TecnicoBoard 
          data={data} 
          onUpdate={handleUpdate} 
        />
      </div>

      {/* Modal interactivo de ayuda para configuración en Windows */}
      <WindowsNotificationGuideModal 
        isOpen={showGuideModal} 
        onClose={() => setShowGuideModal(false)} 
      />

      {/* Contenedor de notificaciones toast flotantes */}
      <NotificationToastContainer />
    </div>
  );
}
