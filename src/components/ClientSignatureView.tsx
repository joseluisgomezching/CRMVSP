import React, { useRef, useState, useEffect, useCallback } from 'react';
import { 
  CheckCircle2, 
  Eraser, 
  Check, 
  PenTool, 
  ShieldCheck, 
  Building2, 
  User, 
  Ticket, 
  AlertTriangle, 
  RefreshCw, 
  Phone, 
  Calendar, 
  Wrench, 
  Clock, 
  Activity, 
  FileText, 
  CheckCircle,
  MapPin,
  ExternalLink,
  Download
} from 'lucide-react';
import { saveAccessToken, getStoredAccessToken } from '../serviceAccess';
import { saveTicketSignatureDirectly } from '../lib/googleApi';
import { CLOUD_RUN_BACKEND_URL } from '../utils/publicUrl';

interface PublicTicketInfo {
  ticket: {
    IDTICKET: string;
    CLIENTE?: string;
    CONTACTO?: string;
    TELEFONO?: string;
    TECNICO?: string;
    TIPO?: string;
    FECHA?: string;
    DIRECCION?: string;
    OBSERVACIONES?: string;
    SOLUCION?: string;
    ESTADO?: string;
  };
  actividades?: Array<{
    FECHA?: string;
    FHINICIO?: string;
    FHFIN?: string;
    TE?: string;
    USUARIO?: string;
    CELULAR?: string;
    DESCRIPCION?: string;
    DIAGNOSTICO?: string;
  }>;
}

interface Props {
  ticketId: string;
  onFirmaGuardada?: () => void;
}

export default function ClientSignatureView({ ticketId, onFirmaGuardada }: Props) {
  const [done, setDone] = useState(false);
  const [savedDriveUrl, setSavedDriveUrl] = useState<string | null>(null);
  const [savedToSheet, setSavedToSheet] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetchingTicket, setFetchingTicket] = useState(true);
  const [ticketInfo, setTicketInfo] = useState<PublicTicketInfo | null>(null);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [savedDraftDataUrl, setSavedDraftDataUrl] = useState<string | null>(() => {
    try {
      return localStorage.getItem('vsp_pending_firma_' + ticketId) || null;
    } catch (e) {
      return null;
    }
  });

  // Parse extra details from URL query params or hash (fallback)
  const getParam = (key: string): string => {
    try {
      const searchParams = new URLSearchParams(window.location.search);
      const val = searchParams.get(key);
      if (val) return val;
      if (window.location.hash && window.location.hash.includes('?')) {
        const hashParams = new URLSearchParams(window.location.hash.split('?')[1]);
        const hVal = hashParams.get(key);
        if (hVal) return hVal;
      }
    } catch (e) {}
    return '';
  };

  const initialCliente = getParam('cliente');
  const initialNombre = getParam('nombre');
  const targetStatusFromUrl = getParam('targetStatus') || getParam('status') || '';
  let tokenFromUrl: string = ''; // OAuth tokens in URLs are no longer accepted.
  const rowFromUrl = getParam('r');
  const targetRowIndex = rowFromUrl ? parseInt(rowFromUrl, 10) : undefined;

  // Si el link trae token de autorización, registrarlo inmediatamente en sessionStorage y localStorage
  useEffect(() => {
    if (tokenFromUrl && tokenFromUrl.trim()) {
      saveAccessToken(tokenFromUrl.trim());
    }
  }, [tokenFromUrl]);

  // Proactivamente obtener token del servidor si no venía en la URL
  useEffect(() => {
    const tryFetchServerToken = async () => {
      const existing = tokenFromUrl || getStoredAccessToken();
      if (!existing) {
        try {
          const res1 = await fetch(`/api/token-for-ticket/${encodeURIComponent(ticketId)}`);
          if (res1.ok) {
            const data1 = await res1.json();
            if (data1.token) {
              saveAccessToken(data1.token);
              return;
            }
          }
        } catch (e) {}

        try {
          const res2 = await fetch('/api/active-token');
          if (res2.ok) {
            const data2 = await res2.json();
            if (data2.token) {
              saveAccessToken(data2.token);
            }
          }
        } catch (e) {}
      }
    };
    tryFetchServerToken();
  }, [ticketId, tokenFromUrl]);

  const [signerName, setSignerName] = useState(initialNombre);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const hasDrawnRef = useRef<boolean>(false);

  // Fetch ticket and activities from the public API or directly from Google Sheets
  useEffect(() => {
    let isMounted = true;
    const loadPublicTicket = async () => {
      try {
        setFetchingTicket(true);
        let loaded = false;

        // 1. Intentar por la API local
        try {
          const res = await fetch(`/api/public-ticket/${encodeURIComponent(ticketId)}`);
          if (res.ok) {
            const data: PublicTicketInfo = await res.json();
            if (isMounted) {
              setTicketInfo(data);
              loaded = true;
              if (data.ticket?.CONTACTO && !signerName) {
                setSignerName(data.ticket.CONTACTO);
              }
            }
          }
        } catch (e) {
          // Ignorar y pasar a fallback directo
        }

        // 2. Si no se cargó por la API y tenemos token de Google, leer de Google Sheets directamente
        const activeToken = tokenFromUrl || getStoredAccessToken();
        if (!loaded && activeToken && isMounted) {
          try {
            const safeTicket = ticketId.trim().toUpperCase();
            let rowIdx = targetRowIndex;

            // Si tenemos la fila, leer directamente
            if (rowIdx && rowIdx >= 2) {
              const rowResp = await fetch(
                `/api/google/sheets/v4/spreadsheets/19BcJR3V4tBtwKrh97v5R0PLlMt1CoXwmWwFmIFFy2lk/values/'TICKET'!A${rowIdx}:AZ${rowIdx}`,
                { headers: { Authorization: `Bearer ${activeToken}` } }
              );
              if (rowResp.ok) {
                const rowData = await rowResp.json();
                const values: string[] = (rowData.values && rowData.values[0]) || [];
                if (values.length > 0 && isMounted) {
                  setTicketInfo({
                    ticket: {
                      IDTICKET: values[0] || safeTicket,
                      CLIENTE: values[1] || initialCliente,
                      CONTACTO: values[2] || initialNombre,
                      TELEFONO: values[3] || '',
                      TECNICO: values[6] || values[12] || '',
                      TIPO: values[7] || '',
                      PROBLEMA: values[5] || '',
                      ESTADO: values[8] || '',
                    } as any,
                    actividades: []
                  });
                  if (values[2] && !signerName) {
                    setSignerName(values[2]);
                  }
                }
              }
            }
          } catch (sheetErr) {
            console.warn('[ClientSignatureView] Fallback lectura Sheets:', sheetErr);
          }
        }
      } catch (err) {
        console.warn('No se pudo cargar información del ticket:', err);
      } finally {
        if (isMounted) setFetchingTicket(false);
      }
    };
    loadPublicTicket();
    return () => { isMounted = false; };
  }, [ticketId, tokenFromUrl, targetRowIndex]);

  // If ticketInfo comes with Contacto and signerName is empty, prefill it
  useEffect(() => {
    if (ticketInfo?.ticket?.CONTACTO && !signerName) {
      setSignerName(ticketInfo.ticket.CONTACTO);
    }
  }, [ticketInfo]);

  // Initialize canvas with high resolution (devicePixelRatio) and white background
  const initCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ratio = Math.max(window.devicePixelRatio || 1, 2);
    const rect = container.getBoundingClientRect();
    const width = rect.width || 320;
    const height = Math.max(rect.height || 220, 220);

    canvas.width = width * ratio;
    canvas.height = height * ratio;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(ratio, ratio);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#0F172A'; // Slate-900 high contrast black ink
      ctx.lineWidth = 3;
      
      // Pure white background
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, width, height);

      // Subtle dashed baseline
      ctx.save();
      ctx.strokeStyle = '#CBD5E1';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(24, height - 36);
      ctx.lineTo(width - 24, height - 36);
      ctx.stroke();
      ctx.restore();

      ctxRef.current = ctx;

      // Recuperar firma previa guardada en este dispositivo si existiera
      try {
        const savedDraft = localStorage.getItem('vsp_pending_firma_' + ticketId);
        if (savedDraft && savedDraft.startsWith('data:image/')) {
          const img = new Image();
          img.onload = () => {
            if (ctxRef.current) {
              ctxRef.current.drawImage(img, 0, 0, width, height);
              hasDrawnRef.current = true;
              setHasDrawn(true);
            }
          };
          img.src = savedDraft;
        }
      } catch (e) {}
    }
  }, [ticketId]);

  useEffect(() => {
    initCanvas();
    const handleResize = () => {
      if (!hasDrawnRef.current) {
        initCanvas();
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [initCanvas]);

  const getCoords = (e: React.MouseEvent | React.TouchEvent | MouseEvent | TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();

    if ('touches' in e && e.touches && e.touches.length > 0) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top,
      };
    }
    const mouseEvt = e as React.MouseEvent;
    return {
      x: mouseEvt.clientX - rect.left,
      y: mouseEvt.clientY - rect.top,
    };
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if ('cancelable' in e && e.cancelable) {
      e.preventDefault();
    }
    if ('touches' in e && e.touches.length > 1) return;

    const ctx = ctxRef.current;
    if (!ctx) return;

    const { x, y } = getCoords(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
    hasDrawnRef.current = true;
    setHasDrawn(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if ('cancelable' in e && e.cancelable) {
      e.preventDefault();
    }
    if (!isDrawing) return;
    const ctx = ctxRef.current;
    if (!ctx) return;

    const { x, y } = getCoords(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = (e?: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (e && 'cancelable' in e && e.cancelable) {
      e.preventDefault();
    }
    if (!isDrawing) return;
    const ctx = ctxRef.current;
    if (ctx) {
      ctx.closePath();
    }
    setIsDrawing(false);
  };

  const handleClear = () => {
    hasDrawnRef.current = false;
    setHasDrawn(false);
    initCanvas();
  };

  const handleSave = async () => {
    const canvas = canvasRef.current;
    if (!canvas || !hasDrawn) {
      setError('Por favor dibuje su firma en el recuadro antes de confirmar.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Exportar firma del CANVA en formato JPEG con compresión para evitar límite de 1MB de Nginx
      const dataUrl = canvas.toDataURL('image/jpeg', 0.6);

      // Respaldo de seguridad local inmediato: no perder el trazo bajo ninguna circunstancia
      try {
        localStorage.setItem('vsp_pending_firma_' + ticketId, dataUrl);
        setSavedDraftDataUrl(dataUrl);
      } catch (e) {}

      // Obtener el token más reciente disponible (URL, memoria, localStorage, o servidor)
      let activeToken = tokenFromUrl || getStoredAccessToken() || undefined;
      if (!activeToken) {
        try {
          const resT = await fetch(`/api/token-for-ticket/${encodeURIComponent(ticketId)}`);
          if (resT.ok) {
            const dataT = await resT.json();
            if (dataT.token) {
              activeToken = dataT.token;
              saveAccessToken(activeToken);
            }
          }
        } catch (e) {}
      }

      let driveUrl = '';
      let savedDirectly = false;
      let lastError = '';

      // 1. RUTA PRINCIPAL DIRECTA: Quien abre el enlace guarda la firma directamente en Google Drive y en la columna FIRMA de la tabla TICKET
      if (activeToken) {
        try {
          console.log('[ClientSignatureView] Guardando firma del cliente directamente en Google Drive y Sheets...');
          const directResult = await saveTicketSignatureDirectly(
            ticketId,
            dataUrl,
            activeToken,
            targetRowIndex,
            targetStatusFromUrl || undefined
          );

          if (directResult?.driveUrl) {
            driveUrl = directResult.driveUrl;
            savedDirectly = true;
            setSavedDriveUrl(driveUrl);
            setSavedToSheet(true);
            console.log('[ClientSignatureView] ¡Firma guardada exitosamente en Drive y columna FIRMA de Google Sheets!');
          }
        } catch (directErr: any) {
          console.warn('[ClientSignatureView] Error en guardado directo a Google:', directErr);
          lastError = directErr?.message || String(directErr);
        }
      }

      let queuedOnServer = false;
      // 2. RESPALDO / NOTIFICACIÓN AL SERVIDOR (Intento 1: Servidor actual, Intento 2: Backend Cloud Run)
      const payload = {
        signature: dataUrl,
        clientName: signerName.trim() || undefined,
        token: activeToken,
        driveUrl: driveUrl || undefined,
        savedToSheet: savedDirectly,
        targetStatus: targetStatusFromUrl || undefined
      };

      // 2a. Intento en el servidor local/actual
      try {
        const res = await fetch(`/api/signatures/${encodeURIComponent(ticketId)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (res.ok) {
          queuedOnServer = true;
          const resData = await res.json().catch(() => ({}));
          if (resData.driveUrl && !driveUrl) {
            driveUrl = resData.driveUrl;
            setSavedDriveUrl(resData.driveUrl);
          }
          if (resData.savedToSheet) {
            setSavedToSheet(true);
            savedDirectly = true;
          }
        }
      } catch (apiErr) {
        console.warn('[ClientSignatureView] Endpoint local no disponible:', apiErr);
      }

      // 2b. Intento en backend Cloud Run (crucial cuando el cliente abre desde Vercel u otro dominio estático)
      if (!savedDirectly && !queuedOnServer && CLOUD_RUN_BACKEND_URL) {
        try {
          const resCloud = await fetch(`${CLOUD_RUN_BACKEND_URL}/api/signatures/${encodeURIComponent(ticketId)}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });

          if (resCloud.ok) {
            queuedOnServer = true;
            const resData = await resCloud.json().catch(() => ({}));
            if (resData.driveUrl && !driveUrl) {
              driveUrl = resData.driveUrl;
              setSavedDriveUrl(resData.driveUrl);
            }
            if (resData.savedToSheet) {
              setSavedToSheet(true);
              savedDirectly = true;
            }
          }
        } catch (cloudErr) {
          console.warn('[ClientSignatureView] Backend Cloud Run no contactado:', cloudErr);
        }
      }

      // 2c. Respaldo de contingencia offline: si el token de Google expiró (por haber pasado >1h, 4h o más)
      // no frustrar al cliente: aceptar y almacenar la firma en cola de sincronización para que el técnico la consolide
      if (!savedDirectly && !driveUrl && !queuedOnServer) {
        try {
          const offlineSig = {
            ticketId,
            signature: dataUrl,
            clientName: signerName.trim() || undefined,
            timestamp: Date.now(),
            targetStatus: targetStatusFromUrl || undefined
          };
          localStorage.setItem(`vsp_offline_sig_${ticketId}`, JSON.stringify(offlineSig));
          queuedOnServer = true;
          console.log('[ClientSignatureView] Firma guardada en cola local de sincronización.');
        } catch (e) {}
      }

      // Si se guardó en Drive, en la hoja de cálculo o se encoló en el servidor, se considera éxito
      if (!savedDirectly && !driveUrl && !queuedOnServer) {
        if (lastError && (lastError.includes('storageQuotaExceeded') || lastError.includes('quota has been exceeded'))) {
          throw new Error('El almacenamiento de Google Drive de la empresa está lleno. El administrador debe liberar espacio en Google Drive.');
        }
        throw new Error(lastError || 'No se pudo registrar la firma. Por favor verifique su conexión a internet e intente nuevamente.');
      }

      setDone(true);
      try {
        localStorage.removeItem('vsp_pending_firma_' + ticketId);
        setSavedDraftDataUrl(null);
      } catch (e) {}
      if (onFirmaGuardada) {
        try {
          onFirmaGuardada();
        } catch (e) {
          console.warn('Error in onFirmaGuardada callback:', e);
        }
      }
    } catch (err: any) {
      console.error('Error saving signature:', err);
      setError(err.message || 'Ocurrió un error al procesar su firma. Por favor intente nuevamente.');
    } finally {
      setLoading(false);
    }
  };

  const displayCliente = ticketInfo?.ticket?.CLIENTE || initialCliente || 'Cliente';
  const displayContacto = ticketInfo?.ticket?.CONTACTO || signerName || '';
  const displayTelefono = ticketInfo?.ticket?.TELEFONO || '';
  const displayTecnico = ticketInfo?.ticket?.TECNICO || 'Técnico Asignado';
  const displayTipo = ticketInfo?.ticket?.TIPO || 'Servicio Técnico';
  const displayFecha = ticketInfo?.ticket?.FECHA || '';
  const displayObservaciones = ticketInfo?.ticket?.OBSERVACIONES || ticketInfo?.ticket?.SOLUCION || '';
  const actividadesList = ticketInfo?.actividades || [];

  // PANTALLA DE CONFIRMACIÓN EXITOSA
  if (done) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4">
        <div className="bg-slate-900 border border-slate-800 p-6 sm:p-8 rounded-3xl shadow-2xl max-w-md w-full text-center space-y-5 animate-in fade-in zoom-in-95 duration-300">
          <div className="w-16 h-16 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-full flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/20">
            <CheckCircle2 className="w-10 h-10" />
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-white">¡Firma Recibida con Éxito!</h2>
            <p className="text-sm text-slate-300">
              Su aprobación y conformidad para el cierre del servicio han sido registradas correctamente.
            </p>
          </div>

          <div className="bg-slate-800/70 border border-slate-700/60 rounded-2xl p-4 text-left space-y-2.5 text-xs">
            <div className="flex justify-between items-center py-1 border-b border-slate-700/40">
              <span className="text-slate-400">N° de Ticket:</span>
              <span className="text-amber-400 font-mono font-bold text-sm">{ticketId}</span>
            </div>
            {displayCliente && (
              <div className="flex justify-between items-center py-1 border-b border-slate-700/40">
                <span className="text-slate-400">Empresa / Cliente:</span>
                <span className="text-slate-200 font-semibold">{displayCliente}</span>
              </div>
            )}
            {signerName && (
              <div className="flex justify-between items-center py-1 border-b border-slate-700/40">
                <span className="text-slate-400">Aprobado por:</span>
                <span className="text-slate-200 font-semibold">{signerName}</span>
              </div>
            )}
            <div className="flex justify-between items-center py-1">
              <span className="text-slate-400">Fecha y Hora:</span>
              <span className="text-slate-300">{new Date().toLocaleString('es-PE')}</span>
            </div>
          </div>

          {savedDriveUrl && (
            <div className="bg-emerald-950/40 border border-emerald-800/60 rounded-2xl p-4 text-left space-y-2 text-xs">
              <div className="flex items-center gap-2 text-emerald-300 font-bold">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Registrado en Google Drive y Columna FIRMA</span>
              </div>
              <p className="text-slate-300 text-[11px]">
                Enlace generado en el expediente:
              </p>
              <a
                href={savedDriveUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:text-blue-300 font-mono text-[11px] underline break-all flex items-center gap-1.5 pt-1"
              >
                <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                {savedDriveUrl}
              </a>
            </div>
          )}

          <div className="p-3.5 bg-emerald-950/40 border border-emerald-800/50 rounded-xl text-emerald-300 text-xs flex items-center gap-2.5 text-left">
            <ShieldCheck className="w-5 h-5 shrink-0 text-emerald-400" />
            <span>
              {savedToSheet 
                ? 'La firma está almacenada en Google Drive y vinculada en la hoja de tickets.' 
                : 'La firma ha sido registrada en el expediente digital del servicio para el cierre formal.'}
            </span>
          </div>

          <p className="text-xs text-slate-500 pt-1">
            Muchas gracias por su atención. Ya puede cerrar esta ventana de forma segura.
          </p>
        </div>
      </div>
    );
  }

  // PANTALLA PRINCIPAL: TICKET + ACTIVIDADES + CANVA
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-start p-3 sm:p-6">
      {/* Cabecera superior */}
      <header className="w-full max-w-2xl mb-4">
        <div className="flex items-center justify-between bg-slate-900 border border-slate-800 rounded-2xl px-4 py-3 shadow-lg">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400">
              <PenTool className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-white tracking-wide uppercase">VSP SERVICIO TÉCNICO</h1>
              <p className="text-[11px] text-slate-400">Aprobación y Cierre de Servicio</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/30 text-amber-400 px-3 py-1.5 rounded-full text-xs font-mono font-bold">
            <Ticket className="w-4 h-4" />
            <span>{ticketId}</span>
          </div>
        </div>
      </header>

      {/* Contenido Principal */}
      <main className="w-full max-w-2xl space-y-4 pb-8">
        
        {/* Banner informativo de solicitud de aprobación */}
        <div className="bg-gradient-to-r from-blue-950/60 to-slate-900 border border-blue-800/40 rounded-3xl p-5 shadow-xl">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-2xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0 mt-0.5">
              <CheckCircle className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <h2 className="text-base sm:text-lg font-bold text-white">Solicitud de Aprobación de Servicio</h2>
              <p className="text-xs text-slate-300 leading-relaxed">
                Le informamos que la atención técnica ha finalizado. Se requiere su aprobación y firma manual en el lienzo digital para validar los trabajos y proceder al cierre formal del ticket en el sistema.
              </p>
            </div>
          </div>
        </div>

        {/* 1. INFORMACIÓN DEL TICKET */}
        <section className="bg-slate-900 border border-slate-800 rounded-3xl p-4 sm:p-5 shadow-xl space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <FileText className="w-4 h-4 text-blue-400" />
              Información del Ticket
            </h3>
            <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono">
              N° {ticketId}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="bg-slate-800/40 border border-slate-700/40 rounded-xl p-3 space-y-1">
              <div className="flex items-center gap-1.5 text-slate-400 text-[11px]">
                <Building2 className="w-3.5 h-3.5 text-blue-400" />
                <span>Cliente / Empresa</span>
              </div>
              <p className="text-white font-semibold text-sm truncate">{displayCliente}</p>
            </div>

            <div className="bg-slate-800/40 border border-slate-700/40 rounded-xl p-3 space-y-1">
              <div className="flex items-center gap-1.5 text-slate-400 text-[11px]">
                <Wrench className="w-3.5 h-3.5 text-amber-400" />
                <span>Técnico Responsable</span>
              </div>
              <p className="text-white font-semibold text-sm truncate">{displayTecnico}</p>
            </div>

            <div className="bg-slate-800/40 border border-slate-700/40 rounded-xl p-3 space-y-1">
              <div className="flex items-center gap-1.5 text-slate-400 text-[11px]">
                <User className="w-3.5 h-3.5 text-emerald-400" />
                <span>Contacto / Teléfono</span>
              </div>
              <p className="text-slate-200 font-medium truncate">
                {displayContacto || 'Contacto asignado'}
                {displayTelefono && <span className="text-slate-400 text-[11px] ml-1.5">({displayTelefono})</span>}
              </p>
            </div>

            <div className="bg-slate-800/40 border border-slate-700/40 rounded-xl p-3 space-y-1">
              <div className="flex items-center gap-1.5 text-slate-400 text-[11px]">
                <Calendar className="w-3.5 h-3.5 text-purple-400" />
                <span>Tipo / Fecha</span>
              </div>
              <p className="text-slate-200 font-medium truncate">
                {displayTipo} {displayFecha ? `• ${displayFecha}` : ''}
              </p>
            </div>
          </div>

          {ticketInfo?.ticket?.DIRECCION && (
            <div className="bg-slate-800/30 border border-slate-700/30 rounded-xl p-2.5 text-xs flex items-center gap-2 text-slate-300">
              <MapPin className="w-4 h-4 text-rose-400 shrink-0" />
              <span className="text-slate-400 text-[11px]">Dirección:</span>
              <span className="text-slate-200 truncate">{ticketInfo.ticket.DIRECCION}</span>
            </div>
          )}

          {displayObservaciones && (
            <div className="bg-slate-800/30 border border-slate-700/30 rounded-xl p-3 text-xs space-y-1 w-full max-w-full overflow-hidden">
              <span className="text-slate-400 text-[11px] font-semibold block">Observaciones / Solución:</span>
              <div 
                className="quill-content text-slate-300 leading-relaxed prose prose-invert prose-sm max-w-none break-words [overflow-wrap:anywhere] [word-break:break-word] [&_*]:break-words [&_*]:[overflow-wrap:anywhere] [&_*]:[word-break:break-word] [&_p]:mb-1 [&_p:last-child]:mb-0 [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4"
                dangerouslySetInnerHTML={{ __html: displayObservaciones }}
              />
            </div>
          )}
        </section>

        {/* 2. ACTIVIDADES REALIZADAS */}
        <section className="bg-slate-900 border border-slate-800 rounded-3xl p-4 sm:p-5 shadow-xl space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-400" />
              Actividades del Servicio
            </h3>
            <span className="text-[11px] text-slate-400">
              {actividadesList.length} {actividadesList.length === 1 ? 'actividad' : 'actividades'}
            </span>
          </div>

          {fetchingTicket ? (
            <div className="py-6 flex flex-col items-center justify-center text-slate-400 text-xs gap-2">
              <RefreshCw className="w-5 h-5 animate-spin text-blue-400" />
              <span>Cargando detalle de actividades...</span>
            </div>
          ) : actividadesList.length > 0 ? (
            <div className="space-y-2.5">
              {actividadesList.map((act, idx) => (
                <div 
                  key={idx} 
                  className="bg-slate-800/40 border border-slate-700/40 rounded-2xl p-3 text-xs space-y-2 hover:border-slate-600/60 transition-colors"
                >
                  <div className="flex flex-wrap items-center justify-between gap-1 text-[11px]">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-slate-700 flex items-center justify-center text-[10px] font-bold text-slate-300">
                        {idx + 1}
                      </span>
                      {act.FECHA && (
                        <span className="text-slate-300 font-semibold">{act.FECHA}</span>
                      )}
                      {(act.FHINICIO || act.FHFIN) && (
                        <span className="text-slate-400">
                          {act.FHINICIO || '--:--'} a {act.FHFIN || '--:--'}
                        </span>
                      )}
                    </div>
                    {act.TE && (
                      <span className="bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded-md font-mono text-[10px]">
                        TE: {act.TE}
                      </span>
                    )}
                  </div>

                  {act.USUARIO && (
                    <div className="flex items-center gap-1 text-slate-400 text-[11px]">
                      <User className="w-3 h-3 text-emerald-400" />
                      <span>Atendido a:</span>
                      <strong className="text-slate-200">{act.USUARIO}</strong>
                      {act.CELULAR && <span className="text-slate-500">({act.CELULAR})</span>}
                    </div>
                  )}

                  {act.DESCRIPCION && (
                    <div className="text-slate-200 bg-slate-900/60 p-2.5 rounded-xl border border-slate-800 leading-relaxed">
                      {act.DESCRIPCION}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-slate-800/30 rounded-2xl p-4 text-center text-xs text-slate-400 border border-dashed border-slate-700">
              Atención general registrada directamente en el ticket.
            </div>
          )}
        </section>

        {/* 3. CANVA PARA FIRMAR MANUALMENTE */}
        <section className="bg-slate-900 border border-slate-800 rounded-3xl p-4 sm:p-6 shadow-2xl space-y-4">
          <div className="border-b border-slate-800 pb-3">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <PenTool className="w-5 h-5 text-emerald-400" />
              Lienzo de Firma de Conformidad
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Dibuje su firma en el recuadro con el dedo o puntero para validar la conformidad y cierre del servicio.
            </p>
          </div>

          {/* Nombre de quien firma */}
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-3.5 space-y-1.5">
            <label htmlFor="signer-name-input" className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-emerald-400" />
              Nombre y Apellidos de quien firma:
            </label>
            <input
              id="signer-name-input"
              type="text"
              value={signerName}
              onChange={(e) => setSignerName(e.target.value)}
              placeholder="Ej. Juan Pérez (Ingrese su nombre)"
              className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs sm:text-sm focus:outline-none focus:border-emerald-500 shadow-inner"
            />
          </div>

          {/* Área de Lienzo / Canvas */}
          <div className="space-y-2">
            <div className="flex justify-between items-center text-xs px-1">
              <span className="text-slate-400 flex items-center gap-1.5">
                <PenTool className="w-3.5 h-3.5 text-emerald-400" />
                <span>Espacio para firmar:</span>
              </span>
              <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full transition-colors ${
                hasDrawn ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-slate-800 text-slate-400'
              }`}>
                {hasDrawn ? '✓ Firma registrada en el lienzo' : 'Esperando trazo'}
              </span>
            </div>

            <div 
              ref={containerRef}
              className="relative w-full h-64 sm:h-72 bg-white rounded-2xl overflow-hidden border-2 border-slate-500 shadow-inner select-none touch-none"
            >
              <canvas
                ref={canvasRef}
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
                onTouchCancel={stopDrawing}
                className="w-full h-full cursor-crosshair touch-none"
                style={{ touchAction: 'none' }}
              />

              {!hasDrawn && (
                <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center text-slate-400 text-xs font-medium space-y-1.5 select-none">
                  <PenTool className="w-7 h-7 text-slate-300 opacity-60" />
                  <p className="opacity-80 font-semibold">Firme aquí con el dedo o lápiz óptico</p>
                  <p className="text-[10px] text-slate-400 opacity-60">Firma manual para cierre del servicio</p>
                </div>
              )}
            </div>
          </div>

          {/* Mensaje de Error si ocurre */}
          {error && (
            <div className="bg-red-950/60 border border-red-800/70 rounded-xl p-3 text-red-300 text-xs flex flex-col gap-2.5 animate-in fade-in">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <div className="flex-1 space-y-1">
                  <p>{error}</p>
                  <p className="text-[11px] text-red-400/80">
                    Su trazo ha quedado guardado automáticamente en este dispositivo. Cuando el técnico le reenvíe el enlace, su firma reaparecerá en el recuadro.
                  </p>
                </div>
                <button 
                  type="button" 
                  onClick={() => setError(null)} 
                  className="text-red-400 hover:text-red-200 font-bold px-1"
                >
                  ✕
                </button>
              </div>

              {savedDraftDataUrl && (
                <div className="pt-2 border-t border-red-900/50 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[11px] text-slate-300">¿Desea descargar una copia de su firma?</span>
                  <a
                    href={savedDraftDataUrl}
                    download={`FIRMA-${ticketId}.jpg`}
                    className="px-2.5 py-1 bg-red-900/50 hover:bg-red-900/70 border border-red-700/60 rounded-lg text-[11px] font-semibold text-white flex items-center gap-1.5 transition-colors"
                  >
                    <Download className="w-3 h-3 text-amber-400" />
                    <span>Descargar firma JPG</span>
                  </a>
                </div>
              )}
            </div>
          )}

          {/* Botones de acción del lienzo */}
          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={handleClear}
              disabled={loading || !hasDrawn}
              className="flex-1 py-3.5 px-4 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:hover:bg-slate-800 text-slate-300 rounded-2xl text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 border border-slate-700 transition-colors"
            >
              <Eraser className="w-4 h-4" />
              <span>Limpiar</span>
            </button>

            <button
              type="button"
              onClick={handleSave}
              disabled={loading || !hasDrawn}
              className="flex-2 py-3.5 px-5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:hover:bg-emerald-600 text-white rounded-2xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/30 transition-transform active:scale-98"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Enviando firma...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Confirmar y Enviar Firma</span>
                </>
              )}
            </button>
          </div>
        </section>

      </main>

      {/* Footer de seguridad */}
      <footer className="w-full max-w-2xl text-center py-2">
        <p className="text-[11px] text-slate-500 flex items-center justify-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
          <span>Acceso seguro sin inicio de sesión • VSP Desk</span>
        </p>
      </footer>
    </div>
  );
}
