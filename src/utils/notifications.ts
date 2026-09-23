import { Ticket } from '../types';

export interface ToastItem {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning';
  timestamp: number;
}

type ToastListener = (toast: ToastItem) => void;
const toastListeners: Set<ToastListener> = new Set();

export function subscribeToToasts(listener: ToastListener) {
  toastListeners.add(listener);
  return () => {
    toastListeners.delete(listener);
  };
}

export function isInsideIframe(): boolean {
  try {
    return window.self !== window.top;
  } catch (e) {
    return true;
  }
}

export function isNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function getNotificationPermission(): NotificationPermission | 'unsupported' {
  if (!isNotificationSupported()) return 'unsupported';
  return Notification.permission;
}

let swRegistrationPromise: Promise<ServiceWorkerRegistration | null> | null = null;

/**
 * Inicializa y registra el Service Worker para permitir notificaciones nativas de Windows
 * incluso cuando la ventana de la aplicación está minimizada o en otra pestaña.
 */
export function initNotificationServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return Promise.resolve(null);
  }

  if (swRegistrationPromise) {
    return swRegistrationPromise;
  }

  swRegistrationPromise = navigator.serviceWorker
    .register('/sw.js', { scope: '/' })
    .then((reg) => {
      console.log('[ServiceWorker] Registrado exitosamente para Notificaciones Windows:', reg.scope);
      return reg;
    })
    .catch((err) => {
      console.warn('[ServiceWorker] No se pudo registrar sw.js:', err);
      return null;
    });

  return swRegistrationPromise;
}

// Iniciar registro de inmediato en el cliente
if (typeof window !== 'undefined') {
  initNotificationServiceWorker().catch(() => {});
}

export async function requestDesktopNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (!isNotificationSupported()) return 'unsupported';
  try {
    // Si estamos en un iframe, los navegadores modernos restringen la solicitud directa
    const perm = await Notification.requestPermission();
    if (perm === 'granted') {
      await initNotificationServiceWorker();
    }
    return perm;
  } catch (e) {
    console.warn('[Notifications] Error al solicitar permiso:', e);
    return Notification.permission;
  }
}

let sharedAudioCtx: AudioContext | null = null;

/**
 * Desbloquea el contexto de audio con cualquier interacción del usuario en la pantalla
 */
export function unlockAudio() {
  try {
    if (typeof window === 'undefined') return;
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    if (!sharedAudioCtx) {
      sharedAudioCtx = new AudioCtx();
    }
    if (sharedAudioCtx.state === 'suspended') {
      sharedAudioCtx.resume().catch(() => {});
    }
  } catch (e) {}
}

if (typeof window !== 'undefined') {
  window.addEventListener('click', unlockAudio, { passive: true });
  window.addEventListener('keydown', unlockAudio, { passive: true });
  window.addEventListener('touchstart', unlockAudio, { passive: true });
}

/**
 * Emite un sonido de notificación nítido y claro (3 tonos ascendentes tipo Windows / Alerta)
 * Funciona incluso con la app en segundo plano o minimizada si el usuario interactuó antes.
 */
export function playNotificationSound() {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    if (!sharedAudioCtx) {
      sharedAudioCtx = new AudioCtx();
    }
    if (sharedAudioCtx.state === 'suspended') {
      sharedAudioCtx.resume().catch(() => {});
    }

    const ctx = sharedAudioCtx;
    const now = ctx.currentTime;

    const playTone = (freq: number, startTime: number, duration: number, vol: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, startTime);
      gain.gain.setValueAtTime(vol, startTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(startTime);
      osc.stop(startTime + duration);
    };

    // Tono 1: F5 (698.46 Hz)
    playTone(698.46, now, 0.18, 0.28);
    // Tono 2: A5 (880.00 Hz)
    playTone(880.00, now + 0.10, 0.20, 0.32);
    // Tono 3: C6 (1046.50 Hz)
    playTone(1046.50, now + 0.20, 0.35, 0.35);
  } catch (e) {
    // Ignorar si el navegador bloquea audio sin interacción
  }
}

// Registro de notificaciones enviadas recientemente para evitar duplicados en un margen de 15 segundos
const recentlyNotified = new Map<string, number>();

function canNotifyKey(key: string): boolean {
  const now = Date.now();
  const lastTime = recentlyNotified.get(key) || 0;
  if (now - lastTime < 15000) {
    return false; // Ya fue notificado en los últimos 15s
  }
  recentlyNotified.set(key, now);

  // Limpiar llaves antiguas
  if (recentlyNotified.size > 200) {
    for (const [k, time] of recentlyNotified.entries()) {
      if (now - time > 60000) recentlyNotified.delete(k);
    }
  }
  return true;
}

/**
 * Envía una notificación de Windows / escritorio nativa mediante Service Worker (o Notification API)
 * y muestra un toast visual de respaldo.
 * 
 * Configurado con requireInteraction: true para que Windows la mantenga visible en pantalla
 * y en el Centro de Notificaciones incluso si la app está minimizada o en otra pestaña.
 */
export async function sendWindowsNotification(title: string, message: string, tag?: string) {
  if (tag && !canNotifyKey(tag)) {
    return;
  }

  // 1. Sonido siempre
  playNotificationSound();

  // 2. Si el permiso está en 'default' y no estamos en un iframe, solicitarlo ahora
  if (isNotificationSupported() && Notification.permission === 'default' && !isInsideIframe()) {
    try {
      await requestDesktopNotificationPermission();
    } catch (e) {}
  }

  // 3. Notificación en Windows a través de Service Worker y Notification API
  let nativeNotificationDispatched = false;
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const iconUrl = origin ? `${origin}/icon-192.png` : '/icon-192.png';

  const swOptions: any = {
    body: message,
    icon: iconUrl,
    badge: iconUrl,
    tag: tag || `vsp-${Date.now()}`,
    requireInteraction: true, // CLAVE PARA WINDOWS: no desaparece hasta que el usuario interactúa
    renotify: true,
    silent: false,
    vibrate: [250, 100, 250],
    data: {
      url: typeof window !== 'undefined' ? window.location.href : '/',
      timestamp: Date.now()
    }
  };

  // Método A: Service Worker Registration showNotification (Estándar recomendado para Windows)
  if (typeof window !== 'undefined' && 'serviceWorker' in navigator && Notification.permission === 'granted') {
    try {
      let reg = await navigator.serviceWorker.getRegistration();
      if (!reg) {
        // Si no está registrado, esperar o registrar
        reg = await initNotificationServiceWorker();
      }
      if (reg && reg.showNotification) {
        await reg.showNotification(title, swOptions);
        nativeNotificationDispatched = true;
      }
    } catch (e) {
      console.warn('[Notifications] Error al emitir mediante ServiceWorker showNotification:', e);
    }
  }

  // Método B: PostMessage al Service Worker activo
  if (!nativeNotificationDispatched && typeof window !== 'undefined' && navigator.serviceWorker?.controller && Notification.permission === 'granted') {
    try {
      navigator.serviceWorker.controller.postMessage({
        type: 'SHOW_NOTIFICATION',
        title,
        options: swOptions
      });
      nativeNotificationDispatched = true;
    } catch (e) {}
  }

  // Método C: Fallback directo a new Notification en la ventana del navegador
  if (!nativeNotificationDispatched && isNotificationSupported() && Notification.permission === 'granted') {
    try {
      const notif = new Notification(title, {
        body: message,
        icon: iconUrl,
        tag: tag || undefined,
        requireInteraction: true,
        silent: false,
      });
      notif.onclick = () => {
        window.focus();
        notif.close();
      };
      nativeNotificationDispatched = true;
    } catch (e) {
      console.warn('[Notifications] Error al emitir Notification nativa:', e);
    }
  }

  // 4. Toast visual en pantalla dentro de la app
  const toast: ToastItem = {
    id: `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    title,
    message,
    type: 'info',
    timestamp: Date.now()
  };
  toastListeners.forEach(fn => fn(toast));
}

/**
 * Emite la notificación de cambio de ESTADO:
 * - ESTADO="EN ATENCION": "Que Ticket <IDTICKET> DEL <CLIENTE>, fue puesto EN ATENCION por <TECNICO> "
 * - ESTADO="PENDIENTE": "Que Ticket <IDTICKET> DEL <CLIENTE>, fue pasado a PENDIENTE por <TECNICO> "
 * - ESTADO="CERRADO": "Que Ticket <IDTICKET> DEL <CLIENTE>, fue CERRADO por <TECNICO> "
 */
export function notifyTicketStateChange(ticket: Ticket, newEstado: string) {
  const idTicket = ticket.IDTICKET || '';
  const cliente = ticket.CLIENTE || 'CLIENTE';
  const tecnico = ticket.TECNICO || 'el técnico';
  const normEstado = (newEstado || '').trim().toUpperCase();

  if (normEstado === 'EN ATENCION') {
    const msg = `Que Ticket ${idTicket} DEL ${cliente}, fue puesto EN ATENCION por ${tecnico} `;
    sendWindowsNotification(
      `Ticket ${idTicket} - EN ATENCIÓN`,
      msg,
      `ticket-${idTicket}-estado-en-atencion`
    );
  } else if (normEstado === 'PENDIENTE') {
    const msg = `Que Ticket ${idTicket} DEL ${cliente}, fue pasado a PENDIENTE por ${tecnico} `;
    sendWindowsNotification(
      `Ticket ${idTicket} - PENDIENTE`,
      msg,
      `ticket-${idTicket}-estado-pendiente`
    );
  } else if (normEstado === 'CERRADO') {
    const msg = `Que Ticket ${idTicket} DEL ${cliente}, fue CERRADO por ${tecnico} `;
    sendWindowsNotification(
      `Ticket ${idTicket} - CERRADO`,
      msg,
      `ticket-${idTicket}-estado-cerrado`
    );
  }
}

/**
 * Emite la notificación cuando el campo FIRMA de la tabla TICKET pasó de estar vacío a tener data:
 * "El cliente <CLIENTE> con Ticket <IDTICKET> firmo la GUIA DE SERVIICIO ya puedes cerrarla"
 */
export function notifyTicketFirmaReceived(ticket: Ticket) {
  const idTicket = ticket.IDTICKET || '';
  const cliente = ticket.CLIENTE || 'CLIENTE';
  const msg = `El cliente ${cliente} con Ticket ${idTicket} firmo la GUIA DE SERVIICIO ya puedes cerrarla`;

  sendWindowsNotification(
    `Guía Firmada - Ticket ${idTicket}`,
    msg,
    `ticket-${idTicket}-firma-recibida`
  );
}

export function hasValidFirma(firma?: string | null): boolean {
  if (!firma) return false;
  const trimmed = firma.trim();
  return trimmed !== '' && trimmed !== '-' && trimmed !== 'null' && trimmed.toLowerCase() !== 'undefined';
}

export interface TicketSnapshot {
  estado: string;
  hasFirma: boolean;
}

/**
 * Compara los tickets actuales con la fotografía previa y dispara las notificaciones
 * de cambio de estado o firma recibida.
 */
export function inspectTicketChanges(
  currentTickets: Ticket[],
  prevMap: Map<string, TicketSnapshot>,
  isInitialLoad: boolean
): Map<string, TicketSnapshot> {
  const nextMap = new Map<string, TicketSnapshot>(prevMap);

  for (const ticket of currentTickets) {
    if (!ticket || !ticket.IDTICKET) continue;
    const currEstado = (ticket.ESTADO || '').trim().toUpperCase();
    const currFirma = hasValidFirma(ticket.FIRMA);

    const prev = prevMap.get(ticket.IDTICKET);

    if (prev && !isInitialLoad) {
      // 1. Cambio de estado
      if (prev.estado !== currEstado) {
        if (currEstado === 'EN ATENCION' || currEstado === 'PENDIENTE' || currEstado === 'CERRADO') {
          notifyTicketStateChange(ticket, currEstado);
        }
      }

      // 2. Firma pasa de estar vacía a tener data
      if (!prev.hasFirma && currFirma) {
        notifyTicketFirmaReceived(ticket);
      }
    }

    nextMap.set(ticket.IDTICKET, {
      estado: currEstado,
      hasFirma: currFirma
    });
  }

  return nextMap;
}
