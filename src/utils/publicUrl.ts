/**
 * Utilidades para construir URLs públicas accesibles por clientes externos
 * (ej. desde enlaces enviados por WhatsApp para firma digital en el canvas).
 */

export const DEFAULT_SHARED_APP_URL = typeof window !== 'undefined' ? window.location.origin : '';
export const CLOUD_RUN_BACKEND_URL = DEFAULT_SHARED_APP_URL;

export function getPublicAppUrl(): string {
  // 1. Si el usuario configuró una URL base personalizada en localStorage
  try {
    const savedCustomUrl = localStorage.getItem('vsp_public_app_url');
    if (savedCustomUrl && savedCustomUrl.trim()) {
      return savedCustomUrl.trim().replace(/\/+$/, '');
    }
  } catch (e) {}

  // 2. Si está configurada una URL pública en variables de entorno Vite
  const envPublicUrl = (import.meta as any).env?.VITE_PUBLIC_APP_URL;
  if (envPublicUrl && typeof envPublicUrl === 'string' && envPublicUrl.trim()) {
    return envPublicUrl.trim().replace(/\/+$/, '');
  }

  // 3. Evaluar el origen actual del navegador
  try {
    const origin = window.location.origin;
    
    // Si estamos en Google AI Studio (ai.studio o aistudio.google.com), NO usar ese dominio
    // ya que no contiene las rutas de la app y daría "Page not found / Go to library"
    if (origin && (origin.includes('ai.studio') || origin.includes('aistudio.google.com'))) {
      return DEFAULT_SHARED_APP_URL;
    }

    // Si el origen es el contenedor de desarrollo (ais-dev-...), usar la versión compartida (ais-pre-...)
    // que es la que tiene acceso público para clientes sin sesión de desarrollador
    if (origin && origin.includes('ais-dev-')) {
      return origin.replace('ais-dev-', 'ais-pre-');
    }

    // Si es localhost o un dominio personalizado/producción en Cloud Run, usarlo
    if (origin && origin !== 'null' && !origin.includes('localhost:8000')) {
      return origin;
    }
  } catch (e) {
    console.warn('Error determining window.location.origin:', e);
  }

  return DEFAULT_SHARED_APP_URL;
}

export function setCustomPublicAppUrl(url: string) {
  try {
    if (url && url.trim()) {
      localStorage.setItem('vsp_public_app_url', url.trim().replace(/\/+$/, ''));
    } else {
      localStorage.removeItem('vsp_public_app_url');
    }
  } catch (e) {}
}

/**
 * Genera el enlace público directo al canvas de firma para un ticket.
 * El enlace nunca incluye credenciales de Google.
 */
export function buildPublicSignUrl(
  ticketId: string, 
  cliente?: string, 
  usuario?: string,
  _token?: string,
  rowIndex?: number
): string {
  const baseUrl = getPublicAppUrl();
  const params = new URLSearchParams();
  params.set('signTicket', ticketId);
  if (cliente && cliente.trim()) {
    params.set('cliente', cliente.trim());
  }
  if (usuario && usuario.trim()) {
    params.set('nombre', usuario.trim());
  }
  if (rowIndex && rowIndex >= 2) {
    params.set('r', String(rowIndex));
  }

  // Restauramos el token en la URL tal cual el proceso Xegraf
  params.set('ticket', ticketId);
  params.set('rol', 'USER');
  
  return `${baseUrl}/?${params.toString()}`;
}

