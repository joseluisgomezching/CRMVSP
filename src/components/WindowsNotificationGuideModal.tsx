import React, { useState, useEffect } from 'react';
import { 
  X, 
  Bell, 
  ExternalLink, 
  CheckCircle2, 
  AlertTriangle, 
  Volume2, 
  Monitor, 
  Sparkles,
  Info
} from 'lucide-react';
import { 
  isNotificationSupported, 
  getNotificationPermission, 
  requestDesktopNotificationPermission, 
  sendWindowsNotification,
  isInsideIframe 
} from '../utils/notifications';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function WindowsNotificationGuideModal({ isOpen, onClose }: Props) {
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>('default');
  const [inIframe, setInIframe] = useState(false);
  const [testSent, setTestSent] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setPermission(isNotificationSupported() ? getNotificationPermission() : 'unsupported');
      setInIframe(isInsideIframe());
      setTestSent(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleRequestPermission = async () => {
    const res = await requestDesktopNotificationPermission();
    setPermission(res);
    if (res === 'granted') {
      sendWindowsNotification(
        '¡Notificaciones de Windows Activas!',
        'Las notificaciones de VSP Desk 2.0 ahora aparecerán en la esquina de Windows.'
      );
      setTestSent(true);
    }
  };

  const handleTestNotification = async () => {
    await sendWindowsNotification(
      'VSP Desk 2.0 - Alerta de Windows',
      'Ticket #1042 pasó a EN ATENCIÓN. La notificación está funcionando en tu sistema operativo.'
    );
    setTestSent(true);
    setTimeout(() => setTestSent(false), 6000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
              <Monitor className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                Notificaciones en la Barra de Windows
                <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/30">
                  Esquina Inferior Derecha
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Aparecen sobre el reloj de Windows incluso con la app minimizada o en otra ventana
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6 text-sm text-slate-300">
          
          {/* Ilustración de ubicación en Windows */}
          <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 relative overflow-hidden">
            <div className="text-xs font-semibold text-slate-400 mb-2 flex items-center gap-2">
              <Info className="w-4 h-4 text-blue-400" />
              ¿Dónde se muestra en Windows?
            </div>
            <div className="bg-slate-900/90 border border-slate-700/60 rounded-lg p-3 text-xs flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-white font-medium block">
                  Globo emergente sobre la barra de tareas (junto al reloj y fecha)
                </span>
                <span className="text-slate-400 text-[11px] block">
                  Emite sonido nativo y permanece en pantalla hasta que hagas clic o la cierres.
                </span>
              </div>
              <div className="px-3 py-1.5 bg-blue-600/20 border border-blue-500/40 rounded text-blue-300 font-mono text-[11px] text-right whitespace-nowrap">
                [VSP Desk 2.0]
                <br />
                06:40 | 13/09
              </div>
            </div>
          </div>

          {/* Estado actual de la conexión con el SO */}
          <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-4 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Estado en este Navegador
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3 bg-slate-900/70 rounded-lg border border-slate-800 flex items-center justify-between">
                <span className="text-xs text-slate-400">Permiso del Navegador:</span>
                <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                  permission === 'granted' 
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                    : permission === 'denied' 
                    ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' 
                    : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                }`}>
                  {permission === 'granted' ? 'Concedido (Activo)' : permission === 'denied' ? 'Bloqueado' : 'Pendiente'}
                </span>
              </div>

              <div className="p-3 bg-slate-900/70 rounded-lg border border-slate-800 flex items-center justify-between">
                <span className="text-xs text-slate-400">Contexto de Ejecución:</span>
                <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                  !inIframe 
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                    : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                }`}>
                  {!inIframe ? 'Pestaña Directa (Recomendado)' : 'Marco Vista Previa (Iframe)'}
                </span>
              </div>
            </div>
          </div>

          {/* Pasos clave para garantizar que salga el banner de Windows */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Pasos para que Windows la muestre en tu pantalla:
            </h4>

            {/* Paso 1: Pestaña directa */}
            <div className={`p-4 rounded-xl border transition-all ${
              inIframe 
                ? 'bg-blue-500/10 border-blue-500/30' 
                : 'bg-slate-800/30 border-slate-800'
            }`}>
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center">1</span>
                    <span className="font-semibold text-white">Abrir en Pestaña Directa de Windows</span>
                  </div>
                  <p className="text-xs text-slate-400 pl-7">
                    Windows y Chrome exigen que la página esté abierta en una pestaña directa (no dentro de un visor web) para enviar las notificaciones al escritorio.
                  </p>
                </div>
                <a
                  href={typeof window !== 'undefined' ? window.location.href : '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg transition-colors shadow-sm"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Abrir Pestaña
                </a>
              </div>
            </div>

            {/* Paso 2: Conceder permiso */}
            <div className={`p-4 rounded-xl border transition-all ${
              permission !== 'granted' 
                ? 'bg-amber-500/10 border-amber-500/30' 
                : 'bg-slate-800/30 border-slate-800'
            }`}>
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center">2</span>
                    <span className="font-semibold text-white">Autorizar Permiso de Notificaciones</span>
                  </div>
                  <p className="text-xs text-slate-400 pl-7">
                    {permission === 'granted' ? (
                      <span className="text-emerald-400 font-medium">✓ Permiso autorizado correctamente en este navegador.</span>
                    ) : permission === 'denied' ? (
                      <span className="text-rose-400 font-medium">
                        El navegador bloqueó las notificaciones. Haz clic en el candado 🔒 en la barra de direcciones de Chrome &gt; Notificaciones &gt; Permitir.
                      </span>
                    ) : (
                      'Haz clic en el botón para que Chrome te solicite permiso.'
                    )}
                  </p>
                </div>
                {permission !== 'granted' && (
                  <button
                    onClick={handleRequestPermission}
                    className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold rounded-lg transition-colors shadow-sm cursor-pointer"
                  >
                    <Bell className="w-3.5 h-3.5" />
                    Permitir
                  </button>
                )}
              </div>
            </div>

            {/* Paso 3: Configuración de Windows */}
            <div className="p-4 rounded-xl bg-slate-800/30 border border-slate-800 space-y-2">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center">3</span>
                <span className="font-semibold text-white">Ajustes del Sistema Operativo Windows</span>
              </div>
              <ul className="text-xs text-slate-400 space-y-1.5 pl-7 list-disc">
                <li>
                  <strong className="text-slate-300">Asistente de concentración / "No molestar":</strong> Si está activado (icono de luna en la barra de tareas), Windows guarda las notificaciones silenciosamente en el Centro de Actividades sin mostrar el globo flotante. Desactívalo para verlas flotar de inmediato.
                </li>
                <li>
                  <strong className="text-slate-300">Configuración de Windows:</strong> Ve a <em>Inicio &gt; Configuración &gt; Sistema &gt; Notificaciones</em> y confirma que <em>Google Chrome</em> o <em>Microsoft Edge</em> tengan activada la opción <em>"Mostrar banners de notificación"</em>.
                </li>
              </ul>
            </div>

          </div>

          {/* Botón de prueba directa */}
          <div className="p-4 bg-slate-950/80 border border-blue-500/30 rounded-xl flex items-center justify-between gap-4">
            <div>
              <h5 className="font-bold text-white text-xs flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-blue-400" />
                Comprobar Notificación de Windows
              </h5>
              <p className="text-slate-400 text-[11px]">
                Enviará una alerta al Service Worker con sonido y banner nativo
              </p>
            </div>
            <button
              onClick={handleTestNotification}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-bold text-xs rounded-lg shadow-lg shadow-blue-500/25 transition-all flex items-center gap-2 cursor-pointer shrink-0"
            >
              <Volume2 className="w-4 h-4" />
              Probar en Windows Ahora
            </button>
          </div>

          {testSent && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-emerald-400 text-xs flex items-center gap-2 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>Notificación enviada al sistema operativo. Revisa la esquina inferior derecha o el Centro de Notificaciones de Windows.</span>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-900/50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
}
