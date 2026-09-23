import { CABECERA_B64 } from '../../lib/constants';
import { generateAndUploadGuiaPDF, GuiaDocumentPages, ScaledA4Page } from '../../lib/pdfGuiaGenerator';
const chunkArray = <T,>(arr: T[], size: number): T[][] => {
  return Array.from({ length: Math.ceil(arr.length / size) }, (v, i) => arr.slice(i * size, i * size + size));
};

import React, { useState, useEffect, useRef, useLayoutEffect, useMemo } from 'react';
import { AuthenticatedImage } from '../../components/AuthenticatedImage';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { sanitizeHtml2CanvasClonedDoc } from '../../lib/pdfHelper';

import { AppData, Ticket, Actividad, Repuesto, FotoAct, Tecnico } from '../../types';
import { X, MapPin, Play, Clock, Plus, Camera, PenTool, CheckCircle, Image as ImageIcon, Pause, Trash2, Send, Wrench, Download, ZoomIn, ZoomOut, Maximize2, RotateCcw, ChevronDown, Check, MessageSquare, Copy, FileText, User, Loader2, RefreshCw, ExternalLink, Globe, AlertTriangle } from 'lucide-react';
import { updateTicket, createActividad, updateActividad, deleteActividad, createFotoAct, createRepuesto, uploadImage, extractMaxFHFINDate, formatDateToDDMMAAAA } from '../../lib/googleApi';
import { getStoredAccessToken, getAccessToken, googleSignIn } from '../../serviceAccess';
import { checkGoogleTokenValidity, TokenStatus } from '../../utils/googleToken';
import { getPublicAppUrl, buildPublicSignUrl, CLOUD_RUN_BACKEND_URL } from '../../utils/publicUrl';
import { notifyTicketStateChange, notifyTicketFirmaReceived } from '../../utils/notifications';
import SignaturePad from '../../components/SignaturePad';
import ClientSignatureView from '../../components/ClientSignatureView';
// @ts-ignore
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';

interface Props {
  ticket: Ticket;
  data: AppData;
  onClose: () => void;
  onUpdateLocally?: (ticket: Ticket) => void;
  onUpdate?: () => void;
}

const TICKET_IMAGES_FOLDER = '14zJIbLf9bfeM0RZiwsPDXGzcqfUWJw0o'; // Carpeta Firmas Guia / Tickets
const ACTIVIDAD_FOTOS_FOLDER = '1Y0D-ZJ6ufLK6zuVxvp5vZjx7yq6hj_LV';

// Custom sleek Autocomplete / Select matching app dark theme
const MacSelect = ({ 
  value = '', 
  onChange, 
  options = [], 
  placeholder = 'Seleccione o escriba...', 
  label 
}: { 
  value?: string; 
  onChange: (val: string) => void; 
  options: string[]; 
  placeholder?: string; 
  label: string; 
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [filterText, setFilterText] = useState(value || '');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setFilterText(value || '');
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const cleanOptions = useMemo(() => {
    if (!Array.isArray(options)) return [];
    return Array.from(new Set(options.map(o => (o || '').trim()).filter(Boolean)));
  }, [options]);

  const filteredOptions = useMemo(() => {
    if (!filterText.trim()) return cleanOptions;
    const q = filterText.toLowerCase().trim();
    return cleanOptions.filter(opt => opt.toLowerCase().includes(q));
  }, [cleanOptions, filterText]);

  const handleSelect = (selectedVal: string) => {
    onChange(selectedVal);
    setFilterText(selectedVal);
    setIsOpen(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVal = e.target.value;
    setFilterText(newVal);
    onChange(newVal);
    if (!isOpen) setIsOpen(true);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
    setFilterText('');
    inputRef.current?.focus();
  };

  return (
    <div ref={containerRef} className="flex flex-col mb-3 relative group">
      <div className="flex items-center justify-between mb-1">
        <label className="text-xs font-bold text-slate-400">{label}</label>
        {cleanOptions.length > 0 && (
          <span className="text-[10px] text-slate-500 font-semibold">
            {cleanOptions.length} sugerencias
          </span>
        )}
      </div>

      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={filterText}
          onChange={handleInputChange}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          className="w-full bg-slate-800/90 hover:bg-slate-800/100 border border-slate-700/60 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 text-white rounded-lg pl-3 pr-16 py-2 text-sm placeholder-slate-500 transition-all shadow-inner"
        />

        <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
          {filterText && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-700/70 transition-colors"
              title="Limpiar"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              setIsOpen(!isOpen);
              inputRef.current?.focus();
            }}
            className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-700/70 transition-colors"
            title={isOpen ? "Cerrar opciones" : "Ver opciones"}
          >
            <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-180 text-blue-400' : ''}`} />
          </button>
        </div>
      </div>

      {isOpen && (
        <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl shadow-black/80 max-h-52 overflow-y-auto custom-scrollbar py-1 animate-fadeIn">
          {filteredOptions.length > 0 ? (
            filteredOptions.map((opt, i) => {
              const isSelected = opt.toLowerCase() === (value || '').toLowerCase().trim();
              return (
                <div
                  key={i}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleSelect(opt);
                  }}
                  className={`px-3 py-2 text-xs sm:text-sm cursor-pointer flex items-center justify-between transition-colors ${
                    isSelected
                      ? 'bg-blue-600/20 text-blue-300 font-semibold border-l-2 border-blue-500'
                      : 'text-slate-200 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <span className="truncate mr-2">{opt}</span>
                  {isSelected && <Check className="w-3.5 h-3.5 text-blue-400 shrink-0" />}
                </div>
              );
            })
          ) : (
            <div className="p-3 text-center">
              <p className="text-xs text-slate-400 italic mb-1.5">No hay opciones coincidentes en el catálogo.</p>
              {filterText.trim() && (
                <div
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleSelect(filterText.trim());
                  }}
                  className="px-2.5 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 rounded-lg text-blue-300 text-xs font-semibold cursor-pointer inline-flex items-center gap-1.5 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Usar "{filterText.trim()}"</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const WhatsAppIcon = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg 
    viewBox="0 0 24 24" 
    width="24" 
    height="24" 
    fill="currentColor" 
    className={className}
  >
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
);

const TecnicoDropdownSelect = ({
  value = '',
  onChange,
  tecnicos = [],
  disabled = false
}: {
  value?: string;
  onChange: (val: string) => void;
  tecnicos: Tecnico[];
  disabled?: boolean;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const cleanTecnicos = useMemo(() => {
    if (!Array.isArray(tecnicos)) return [];
    return tecnicos.filter(t => (t.NOMBRE || '').trim());
  }, [tecnicos]);

  const filtered = useMemo(() => {
    if (!search.trim()) return cleanTecnicos;
    const q = search.toLowerCase().trim();
    return cleanTecnicos.filter(t => 
      (t.NOMBRE || '').toLowerCase().includes(q) || 
      (t.CELULAR || '').includes(q)
    );
  }, [cleanTecnicos, search]);

  const selectedTecnico = cleanTecnicos.find(
    t => (t.NOMBRE || '').trim().toLowerCase() === (value || '').trim().toLowerCase()
  );

  return (
    <div ref={containerRef} className="relative flex-1 min-w-0">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className="w-full bg-slate-800 hover:bg-slate-750 border border-slate-700/80 hover:border-blue-500/50 focus:border-blue-500 rounded-xl px-3 py-2 text-sm text-left flex items-center justify-between gap-2 transition-colors disabled:opacity-60 disabled:cursor-not-allowed shadow-inner group"
      >
        <div className="flex items-center gap-2 truncate min-w-0">
          <div className="w-6 h-6 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shrink-0">
            <User className="w-3.5 h-3.5" />
          </div>
          <span className={`font-semibold truncate text-xs sm:text-sm ${value ? 'text-white' : 'text-slate-400 italic'}`}>
            {value || 'Seleccione un técnico...'}
          </span>
          {selectedTecnico?.CELULAR && (
            <span className="hidden sm:inline-flex text-[10px] bg-emerald-500/10 text-emerald-400 px-1.5 py-0.5 rounded font-mono font-bold shrink-0">
              {selectedTecnico.CELULAR}
            </span>
          )}
        </div>
        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 shrink-0 ${isOpen ? 'rotate-180 text-blue-400' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute z-50 left-0 right-0 top-full mt-1.5 bg-slate-900 border border-slate-700/90 rounded-xl shadow-2xl shadow-black/80 max-h-64 overflow-hidden flex flex-col">
          <div className="p-2 border-b border-slate-800 bg-slate-950/60">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nombre o celular..."
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              autoFocus
            />
          </div>
          <div className="overflow-y-auto max-h-52 custom-scrollbar py-1">
            {filtered.length > 0 ? (
              filtered.map((t) => {
                const isSelected = (t.NOMBRE || '').trim().toLowerCase() === (value || '').trim().toLowerCase();
                return (
                  <div
                    key={t.ID || t.NOMBRE}
                    onClick={() => {
                      onChange(t.NOMBRE.trim());
                      setIsOpen(false);
                      setSearch('');
                    }}
                    className={`px-3 py-2 cursor-pointer flex items-center justify-between gap-2 transition-colors ${
                      isSelected
                        ? 'bg-blue-600/20 text-blue-300 font-bold border-l-2 border-blue-500'
                        : 'text-slate-200 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate min-w-0">
                      <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="text-xs sm:text-sm truncate font-medium">{t.NOMBRE}</span>
                      {t.CELULAR ? (
                        <span className="text-[10px] text-emerald-400 font-mono font-semibold shrink-0">
                          📱 {t.CELULAR}
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-500 italic shrink-0">
                          (Sin celular)
                        </span>
                      )}
                    </div>
                    {isSelected && <Check className="w-3.5 h-3.5 text-blue-400 shrink-0" />}
                  </div>
                );
              })
            ) : (
              <div className="p-3 text-center text-xs text-slate-400 italic">
                No se encontraron técnicos coincidentes.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const generateSimulatedSignature = () => {
  const canvas = document.createElement('canvas');
  canvas.width = 400;
  canvas.height = 200;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, 400, 200);
    ctx.fillStyle = 'black';
    ctx.font = 'bold 24px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('FIRMADO VÍA CORREO', 200, 100);
  }
  return canvas.toDataURL('image/jpeg');
};

const dataURLtoFile = (dataurl: string, filename: string) => {
  var arr = dataurl.split(','),
      mimeMatch = arr[0].match(/:(.*?);/),
      mime = mimeMatch ? mimeMatch[1] : 'image/jpeg',
      bstr = atob(arr[1]), 
      n = bstr.length, 
      u8arr = new Uint8Array(n);
      
  while(n--){
      u8arr[n] = bstr.charCodeAt(n);
  }
  
  return new File([u8arr], filename, {type:mime});
};

export default function TecnicoTicketDetail({ ticket, data, onClose, onUpdateLocally, onUpdate }: Props) {
  const [localTicket, setLocalTicket] = useState<Ticket>(ticket);
  const isTicketCerrado = (localTicket.ESTADO || '').trim().toUpperCase() === 'CERRADO';
  const isTicketPendiente = (localTicket.ESTADO || '').trim().toUpperCase() === 'PENDIENTE';
  const [savingTecnico, setSavingTecnico] = useState(false);
  const [tecnicoSuccessMsg, setTecnicoSuccessMsg] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isPolling, setIsPolling] = useState(false);
  const [checkingSignature, setCheckingSignature] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Local derived data
  const [localActividades, setLocalActividades] = useState<Actividad[]>(() => 
    data.actividades.filter(a => (a.IDTICKET || '').trim().toUpperCase() === (ticket.IDTICKET || '').trim().toUpperCase())
  );
  const [localFotosAct, setLocalFotosAct] = useState<FotoAct[]>(() => data.fotosAct);
  const [localRepuestos, setLocalRepuestos] = useState<Repuesto[]>(() => 
    data.repuestos.filter(r => (r.IDTICKET || '').trim().toUpperCase() === (ticket.IDTICKET || '').trim().toUpperCase())
  );

  // UI States
  const [showSignature, setShowSignature] = useState(false);
  const [showSolicitarFirma, setShowSolicitarFirma] = useState(false);
  const [showInAppSignPreview, setShowInAppSignPreview] = useState(false);
  const [showCerrarOptions, setShowCerrarOptions] = useState(false);
  const [celularFirma, setCelularFirma] = useState('');
  const [usuarioFirma, setUsuarioFirma] = useState('');
  const [mensajeFirmaCustom, setMensajeFirmaCustom] = useState<string | null>(null);
  const [emailFirma, setEmailFirma] = useState('');
  const [enviandoCorreo, setEnviandoCorreo] = useState(false);
  const [copiedSignLink, setCopiedSignLink] = useState(false);
  const [copiedSignMsg, setCopiedSignMsg] = useState(false);
  const [solicitarError, setSolicitarError] = useState<string | null>(null);
  const [waOpened, setWaOpened] = useState(false);
  const [tokenStatus, setTokenStatus] = useState<TokenStatus | null>(null);
  const [checkingToken, setCheckingToken] = useState(false);
  const [renewingToken, setRenewingToken] = useState(false);
  const [firmaNotification, setFirmaNotification] = useState<{ type: 'success' | 'info' | 'error'; message: string } | null>(null);
  
  const [showEnviarNotificacion, setShowEnviarNotificacion] = useState(false);
  const [destinatarioNotificacion, setDestinatarioNotificacion] = useState(ticket.CONTACTO || '');
  const [telefonoNotificacion, setTelefonoNotificacion] = useState(ticket.TELEFONO || '');
  const [copiedNotifMsg, setCopiedNotifMsg] = useState(false);
  
  const [showPendienteModal, setShowPendienteModal] = useState(false);
  const [pendienteCelular, setPendienteCelular] = useState('');
  const [pendienteNombre, setPendienteNombre] = useState('');
  const [pendienteMotivo, setPendienteMotivo] = useState('');

  const [showSaveOptions, setShowSaveOptions] = useState(false); // After save ticket

  const getNowStr = () => {
    const now = new Date();
    return `${now.getDate().toString().padStart(2, '0')}/${(now.getMonth()+1).toString().padStart(2, '0')}/${now.getFullYear()} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
  };

  // Activity Form States
  const initialAct = { 
    IDACTIVIDADES: '', 
    IDTICKET: ticket.IDTICKET, 
    FHINICIO: getNowStr(), 
    SOLUCION: '', 
    FHFIN: '', 
    TIPO: '', 
    MARCA: '', 
    MODELO: '', 
    SERIE: '', 
    USUARIO: ticket.CONTACTO || '', 
    AREA: '', 
    CLIENTE: ticket.CLIENTE, 
    TE: '', 
    TECNICO: ticket.TECNICO, 
    CELULAR: ticket.TELEFONO || '' 
  };
  const [actividadForm, setActividadForm] = useState<Actividad>(initialAct);
  const [actPhotos, setActPhotos] = useState<(File | null)[]>([null, null, null, null]);
  const [actPhotosUrls, setActPhotosUrls] = useState<string[]>(['', '', '', '']); // For existing ones
  const [isEditingAct, setIsEditingAct] = useState(false);
  const [actValidationError, setActValidationError] = useState('');

  const fileInputRefs = [useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null)];

  // Repuesto Form States
  const initialRep = { IDREPUESTO: '', IDTICKET: ticket.IDTICKET, CANTIDAD: '', DESCRIPCION: '' };
  const [repuestoForm, setRepuestoForm] = useState<Repuesto>(initialRep);

  // Observaciones & Actividad del Ticket
  const [observaciones, setObservaciones] = useState(ticket.OBSERVACIONES || '');
  const [actividadTicket, setActividadTicket] = useState(ticket['ACTIVIDAD DEL TICKET'] || '');
  const [savingActividad, setSavingActividad] = useState(false);
  const [actSuccessMessage, setActSuccessMessage] = useState<string | null>(null);
  const [bgSyncStatus, setBgSyncStatus] = useState<{ type: 'syncing' | 'success' | 'error'; message: string } | null>(null);
  const [activityToDelete, setActivityToDelete] = useState<Actividad | null>(null);
  const [isDeletingAct, setIsDeletingAct] = useState(false);

  // PDF Export & Zoom / Scaling state
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const pagesContainerRef = useRef<HTMLDivElement>(null);
  const guiaContainerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState<number>(1);
  const [isAutoFit, setIsAutoFit] = useState<boolean>(true);

  // Auto-fit A4 width on mobile or responsive screen resize
  useEffect(() => {
    if (!isTicketCerrado) return;

    const calculateAutoFit = () => {
      if (!guiaContainerRef.current) return;
      const containerWidth = guiaContainerRef.current.clientWidth;
      // Subtract container horizontal padding (~16px on mobile, ~24px on desktop)
      const availableWidth = Math.max(260, containerWidth - 16);
      const targetA4Width = 794; // Fixed standard A4 width in px

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
  }, [isTicketCerrado, isAutoFit]);

  const [pdfSuccessMessage, setPdfSuccessMessage] = useState<string | null>(null);

  const generateAndUploadPDF = async (downloadLocally = true): Promise<string | null> => {
    setIsExportingPDF(true);
    setError(null);
    setPdfSuccessMessage(null);
    try {
      const ticketFotos = data?.fotosTicket?.filter(f => f.IDTICKET === localTicket.IDTICKET) || [];
      const actIds = localActividades.map(a => a.IDACTIVIDADES);
      const ticketFotosAct = data?.fotosAct?.filter(f => actIds.includes(f.IDACTIVIDADES)) || [];

      const result = await generateAndUploadGuiaPDF({
        ticket: localTicket,
        data,
        actividades: localActividades,
        repuestos: localRepuestos,
        fotosTicket: ticketFotos,
        fotosAct: ticketFotosAct,
        downloadLocally
      });

      if (result?.pdfUrl && localTicket._rowIndex) {
        const updated = { ...localTicket, PDF: result.pdfUrl };
        setLocalTicket(updated);
        onUpdateLocally && onUpdateLocally(updated);
      }

      if (downloadLocally && result) {
        setPdfSuccessMessage(
          result.pdfUrl
            ? `¡PDF ${result.fileName} generado, descargado y guardado en Drive con éxito!`
            : `¡PDF ${result.fileName} generado y descargado con éxito!`
        );
        setTimeout(() => setPdfSuccessMessage(null), 7000);
      }

      return result?.pdfUrl || localTicket.PDF || null;
    } catch (err: any) {
      console.error('Error al generar PDF de Guía de Servicio:', err);
      setError('Error al generar PDF: ' + (err.message || 'No se pudo generar el archivo'));
      return null;
    } finally {
      setIsExportingPDF(false);
    }
  };

  const handleDownloadPDF = async () => {
    await generateAndUploadPDF(true);
  };

  useEffect(() => {
    setLocalTicket(prev => ({
      ...ticket,
      OBSERVACIONES: prev.OBSERVACIONES || ticket.OBSERVACIONES || '',
      'ACTIVIDAD DEL TICKET': prev['ACTIVIDAD DEL TICKET'] || ticket['ACTIVIDAD DEL TICKET'] || ''
    }));
    setObservaciones(prev => prev ? prev : (ticket.OBSERVACIONES || ''));
    setActividadTicket(prev => prev ? prev : (ticket['ACTIVIDAD DEL TICKET'] || ''));
  }, [ticket]);

  // Helper to fetch signature from local server, Cloud Run backend, or local device queue
  const fetchRemoteSignature = async (ticketId: string): Promise<{ signature?: string; clientName?: string; driveUrl?: string; savedToDrive?: boolean; savedToSheet?: boolean } | null> => {
    // 1. Servidor local actual
    try {
      const res = await fetch(`/api/signatures/${encodeURIComponent(ticketId)}`);
      if (res.ok) {
        const data = await res.json();
        if (data && (data.signature || data.driveUrl)) return data;
      }
    } catch (e) {}

    // 2. URL pública configurada
    try {
      const pubBase = getPublicAppUrl();
      if (pubBase && pubBase !== window.location.origin) {
        const resPub = await fetch(`${pubBase}/api/signatures/${encodeURIComponent(ticketId)}`);
        if (resPub.ok) {
          const dataPub = await resPub.json();
          if (dataPub && (dataPub.signature || dataPub.driveUrl)) return dataPub;
        }
      }
    } catch (e) {}

    // 3. Backend Cloud Run central (garantiza sincronización entre Vercel y Cloud Run)
    if (CLOUD_RUN_BACKEND_URL && CLOUD_RUN_BACKEND_URL !== window.location.origin) {
      try {
        const resCloud = await fetch(`${CLOUD_RUN_BACKEND_URL}/api/signatures/${encodeURIComponent(ticketId)}`);
        if (resCloud.ok) {
          const dataCloud = await resCloud.json();
          if (dataCloud && (dataCloud.signature || dataCloud.driveUrl)) return dataCloud;
        }
      } catch (e) {}
    }

    // 4. Firma en cola local del navegador si se firmó en este mismo dispositivo
    try {
      const rawOffline = localStorage.getItem(`vsp_offline_sig_${ticketId}`);
      if (rawOffline) {
        const parsed = JSON.parse(rawOffline);
        if (parsed && parsed.signature) {
          return {
            signature: parsed.signature,
            clientName: parsed.clientName,
            savedToDrive: false,
            savedToSheet: false
          };
        }
      }
    } catch (e) {}

    return null;
  };

  // Helper to delete signature from server once stored in Drive
  const deleteRemoteSignature = async (ticketId: string) => {
    try {
      await fetch(`/api/signatures/${encodeURIComponent(ticketId)}`, { method: 'DELETE' });
    } catch (e) {}
    try {
      const pubBase = getPublicAppUrl();
      if (pubBase && pubBase !== window.location.origin) {
        await fetch(`${pubBase}/api/signatures/${encodeURIComponent(ticketId)}`, { method: 'DELETE' });
      }
    } catch (e) {}
    if (CLOUD_RUN_BACKEND_URL && CLOUD_RUN_BACKEND_URL !== window.location.origin) {
      try {
        await fetch(`${CLOUD_RUN_BACKEND_URL}/api/signatures/${encodeURIComponent(ticketId)}`, { method: 'DELETE' });
      } catch (e) {}
    }
    try {
      localStorage.removeItem(`vsp_offline_sig_${ticketId}`);
    } catch (e) {}
  };

  // Sincroniza datos del ticket y actividades con el servidor para que el cliente los vea en el enlace público
  const syncPublicTicketData = async (contacto?: string, telefono?: string) => {
    try {
      let token = getStoredAccessToken();
      if (!token) {
        try {
          token = await getAccessToken();
        } catch (e) {}
      }
      if (token) {
        fetch('/api/register-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token, ticketId: localTicket.IDTICKET })
        }).catch(() => {});
      }

      await fetch(`/api/public-ticket/${encodeURIComponent(localTicket.IDTICKET)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: token,
          ticket: {
            IDTICKET: localTicket.IDTICKET,
            CLIENTE: localTicket.CLIENTE,
            CONTACTO: contacto || localTicket.CONTACTO,
            TELEFONO: telefono || localTicket.TELEFONO,
            TECNICO: localTicket.TECNICO,
            TIPO: localTicket.TIPO,
            FECHA: localTicket.FECHA,
            DIRECCION: localTicket.DIRECCION,
            OBSERVACIONES: localTicket.OBSERVACIONES || observaciones,
            SOLUCION: localTicket.SOLUCION,
            ESTADO: localTicket.ESTADO
          },
          actividades: localActividades.map(a => ({
            FECHA: a.FECHA,
            FHINICIO: a.FHINICIO,
            FHFIN: a.FHFIN,
            TE: a.TE,
            USUARIO: a.USUARIO,
            CELULAR: a.CELULAR,
            DESCRIPCION: a.DESCRIPCION || a.DIAGNOSTICO || a['ACTIVIDAD REALIZADA'] || '',
            DIAGNOSTICO: a.DIAGNOSTICO || ''
          }))
        })
      });
    } catch (e) {
      console.warn('Error al sincronizar ticket público:', e);
    }
  };

  // Process and persist a signature received from client
  const processAndSaveSignature = async (sigData: { signature?: string; clientName?: string; driveUrl?: string; savedToSheet?: boolean }) => {
    let driveUrl = sigData.driveUrl;

    // If server hasn't uploaded to Drive yet, upload now
    if (!driveUrl && sigData.signature) {
      const fileName = `FIRMA-${localTicket.IDTICKET}.jpg`;
      const file = dataURLtoFile(sigData.signature, fileName);
      const { uploadImage } = await import('../../lib/googleApi');
      driveUrl = await uploadImage(file, '14zJIbLf9bfeM0RZiwsPDXGzcqfUWJw0o', fileName);
    }

    if (!driveUrl) {
      throw new Error('No se pudo obtener la URL de Drive de la firma');
    }

    const coords = await getLocation().catch(() => '');
    const targetRowIndex = localTicket._rowIndex ?? (data.tickets || []).find((t: any) => t.IDTICKET === localTicket.IDTICKET)?._rowIndex;

    const updated: Ticket = { 
      ...localTicket, 
      FIRMA: driveUrl,
      FHSC: localTicket.FHSC || getNowStr(),
      'GPS SALIDA': localTicket['GPS SALIDA'] || coords,
      OBSERVACIONES: observaciones || localTicket.OBSERVACIONES,
      'ACTIVIDAD DEL TICKET': actividadTicket || localTicket['ACTIVIDAD DEL TICKET'] || ''
    };

    // Guarantee sheet is updated in column FIRMA
    if (!sigData.savedToSheet) {
      await updateTicket(targetRowIndex, updated);
    }

    setLocalTicket(updated);
    notifyTicketFirmaReceived(updated);
    if (onUpdateLocally) onUpdateLocally(updated);
    if (onUpdate) onUpdate();
    setIsPolling(false);
    return updated;
  };

  // Manual trigger to check and apply signature from client
  const handleManualCheckSignature = async () => {
    setCheckingSignature(true);
    setFirmaNotification(null);
    try {
      const data = await fetchRemoteSignature(localTicket.IDTICKET);
      if (data && (data.signature || data.driveUrl)) {
        await processAndSaveSignature(data);
        setFirmaNotification({
          type: 'success',
          message: '¡Firma del cliente detectada y guardada exitosamente en Google Drive y registrada en la columna FIRMA!'
        });
      } else {
        setFirmaNotification({
          type: 'info',
          message: 'Aún no se ha recibido la firma remota. El cliente debe abrir el enlace de firma y pulsar "Confirmar y Enviar".'
        });
      }
    } catch (e: any) {
      setFirmaNotification({
        type: 'error',
        message: 'Error al comprobar firma: ' + (e.message || e)
      });
    } finally {
      setCheckingSignature(false);
    }
  };

  // Background auto-polling: continuously monitors for the client's signature every 3.5s while unsigned
  useEffect(() => {
    let isCancelled = false;
    let inProgress = false;

    // Register token on mount
    const token = getStoredAccessToken();
    if (token) {
      fetch('/api/register-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, ticketId: localTicket.IDTICKET })
      }).catch(() => {});
    }

    const checkSignatureInBackground = async () => {
      if (isCancelled || inProgress) return;
      const hasFirma = Boolean(localTicket.FIRMA && localTicket.FIRMA.trim() && localTicket.FIRMA.trim() !== '-' && localTicket.FIRMA.trim() !== 'null');
      if (hasFirma) return;

      inProgress = true;
      try {
        // 1. Verificar si hay firma recibida vía API local
        const data = await fetchRemoteSignature(localTicket.IDTICKET);
        if (data && (data.signature || data.driveUrl) && !isCancelled) {
          await processAndSaveSignature(data);
          if (!isCancelled) {
            setFirmaNotification({
              type: 'success',
              message: '¡Firma de conformidad recibida del cliente, guardada en Drive y registrada en la columna FIRMA!'
            });
          }
          return;
        }

        // 2. Verificar directamente en Google Sheets (columna FIRMA / S) si el cliente la guardó directamente
        const activeToken = getStoredAccessToken();
        if (activeToken && localTicket._rowIndex && localTicket._rowIndex >= 2 && !isCancelled) {
          try {
            const checkResp = await fetch(
              `/api/google/sheets/v4/spreadsheets/19BcJR3V4tBtwKrh97v5R0PLlMt1CoXwmWwFmIFFy2lk/values/'TICKET'!S${localTicket._rowIndex}`,
              { headers: { Authorization: `Bearer ${activeToken}` } }
            );
            if (checkResp.ok) {
              const checkData = await checkResp.json();
              const val = ((checkData.values && checkData.values[0] && checkData.values[0][0]) || '').trim();
              if (val && val !== '-' && val !== 'null' && (val.startsWith('http') || val.includes('drive.google.com'))) {
                const upd = { ...localTicket, FIRMA: val };
                setLocalTicket(prev => ({ ...prev, FIRMA: val }));
                notifyTicketFirmaReceived(upd);
                if (onUpdateLocally) onUpdateLocally(upd);
                if (!isCancelled) {
                  setFirmaNotification({
                    type: 'success',
                    message: '¡Firma del cliente detectada y verificada en la columna FIRMA de la tabla TICKET!'
                  });
                }
              }
            }
          } catch (sheetErr) {
            // ignorar errores periódicos de red
          }
        }
      } catch (e) {
        // ignore periodic network errors
      } finally {
        inProgress = false;
      }
    };

    // Immediate check on mount
    checkSignatureInBackground();

    // Periodic check every 3.5s
    const pollInterval = setInterval(() => {
      checkSignatureInBackground();
    }, 3500);

    return () => {
      isCancelled = true;
      clearInterval(pollInterval);
    };
  }, [localTicket.IDTICKET, localTicket.FIRMA, localTicket._rowIndex]);

  const getLocation = (): Promise<string> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve('No soportado');
        return;
      }
      let resolved = false;
      const timer = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          resolve('Ubicación no disponible');
        }
      }, 2500);

      try {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            if (!resolved) {
              resolved = true;
              clearTimeout(timer);
              resolve(`${pos.coords.latitude}, ${pos.coords.longitude}`);
            }
          },
          () => {
            if (!resolved) {
              resolved = true;
              clearTimeout(timer);
              resolve('Ubicación denegada');
            }
          },
          { timeout: 2500, enableHighAccuracy: false, maximumAge: 60000 }
        );
      } catch {
        if (!resolved) {
          resolved = true;
          clearTimeout(timer);
          resolve('Error ubicación');
        }
      }
    });
  };

  const parseDateStr = (dateStr: string) => {
    if (!dateStr) return null;
    const [datePart, timePart] = dateStr.split(' ');
    if (!datePart || !timePart) return null;
    const [d, m, y] = datePart.split('/');
    const [hr, min] = timePart.split(':');
    return new Date(parseInt(y), parseInt(m)-1, parseInt(d), parseInt(hr), parseInt(min));
  };

  // ----- VALIDATION & CALC TE -----
  useEffect(() => {
    if (actividadForm.FHINICIO && actividadForm.FHFIN) {
      const inicioDatePart = actividadForm.FHINICIO.split(' ')[0];
      const finDatePart = actividadForm.FHFIN.split(' ')[0];
      if (inicioDatePart !== finDatePart) {
        const finTimePart = actividadForm.FHFIN.split(' ')[1] || '';
        setActividadForm(prev => ({ ...prev, FHFIN: `${inicioDatePart} ${finTimePart}`.trim() }));
      }
    }
  }, [actividadForm.FHINICIO]);

  // ----- VALIDATION & CALC TE -----
  useEffect(() => {
    if (actividadForm.FHINICIO && actividadForm.FHFIN) {
      const dInicio = parseDateStr(actividadForm.FHINICIO);
      const dFin = parseDateStr(actividadForm.FHFIN);
      if (dInicio && dFin) {
        if (dFin < dInicio) {
          setActValidationError('La hora de fin no puede ser anterior a la hora de inicio');
          setActividadForm(prev => ({ ...prev, TE: '' }));
        } else {
          setActValidationError('');
          const diffMs = Math.max(0, dFin.getTime() - dInicio.getTime());
          const diffHrs = Math.floor(diffMs / 3600000);
          const diffMins = Math.floor((diffMs % 3600000) / 60000);
          const te = `${diffHrs.toString().padStart(2, '0')}:${diffMins.toString().padStart(2, '0')}`;
          setActividadForm(prev => ({ ...prev, TE: te }));
        }
      } else {
        setActValidationError('');
      }
    } else {
      setActValidationError('');
    }
  }, [actividadForm.FHINICIO, actividadForm.FHFIN]);

  const handleSetNow = (field: 'FHINICIO' | 'FHFIN') => {
    setActividadForm(prev => ({ ...prev, [field]: getNowStr() }));
  };

  const handleSaveActividad = async () => {
    setError(null);
    setActSuccessMessage(null);

    // Ensure FHINICIO has a value
    let fInicio = actividadForm.FHINICIO ? actividadForm.FHINICIO.trim() : '';
    if (!fInicio) {
      fInicio = getNowStr();
      setActividadForm(prev => ({ ...prev, FHINICIO: fInicio }));
    }

    // Ensure FHFIN has a value (default to current time if technician left it blank)
    let fFin = actividadForm.FHFIN ? actividadForm.FHFIN.trim() : '';
    if (!fFin) {
      const now = new Date();
      const timePart = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
      const datePart = fInicio ? fInicio.split(' ')[0] : getNowStr().split(' ')[0];
      fFin = `${datePart} ${timePart}`;
      setActividadForm(prev => ({ ...prev, FHFIN: fFin }));
    }

    const isSolClean = (actividadForm.SOLUCION || '').replace(/<[^>]*>?/gm, '').trim();
    if (!isSolClean) {
      setError('Debe ingresar una descripción en el campo SOLUCIÓN antes de guardar.');
      return;
    }

    const dInicio = parseDateStr(fInicio);
    const dFin = parseDateStr(fFin);
    if (dInicio && dFin && dFin < dInicio) {
      setError('La hora de fin no puede ser anterior a la hora de inicio.');
      return;
    }

    setSavingActividad(true);

    try {
      // Determine ID
      let idAct = actividadForm.IDACTIVIDADES;
      if (!idAct) {
        let maxNum = 0;
        (data.actividades || []).forEach(a => {
          const m = (a.IDACTIVIDADES || '').match(/\d+/);
          if (m) {
            const n = parseInt(m[0], 10);
            if (n > maxNum) maxNum = n;
          }
        });
        (localActividades || []).forEach(a => {
          const m = (a.IDACTIVIDADES || '').match(/\d+/);
          if (m) {
            const n = parseInt(m[0], 10);
            if (n > maxNum) maxNum = n;
          }
        });
        const nextNum = maxNum > 0 ? maxNum + 1 : Math.floor(1000 + Math.random() * 9000);
        idAct = `ACT-${String(nextNum).padStart(4, '0')}`;
      }

      // Calculate TE if not already set
      let te = actividadForm.TE;
      if (!te && dInicio && dFin) {
        const diffMs = Math.max(0, dFin.getTime() - dInicio.getTime());
        const diffHrs = Math.floor(diffMs / 3600000);
        const diffMins = Math.floor((diffMs % 3600000) / 60000);
        te = `${diffHrs.toString().padStart(2, '0')}:${diffMins.toString().padStart(2, '0')}`;
      }

      // Clone activity data
      const savedAct: Actividad = {
        ...actividadForm,
        IDACTIVIDADES: idAct,
        IDTICKET: localTicket.IDTICKET || ticket.IDTICKET,
        CLIENTE: localTicket.CLIENTE || ticket.CLIENTE,
        TECNICO: localTicket.TECNICO || ticket.TECNICO,
        CELULAR: actividadForm.CELULAR || localTicket.TELEFONO || ticket.TELEFONO || '',
        FHINICIO: fInicio,
        FHFIN: fFin,
        TE: te || ''
      };

      // Upload photos if any
      const photosToUpload = [...actPhotos];
      for (let i = 0; i < 4; i++) {
        if (photosToUpload[i]) {
          const file = photosToUpload[i]!;
          try {
            const uploadedUrl = await uploadImage(file, ACTIVIDAD_FOTOS_FOLDER, `${idAct}-foto-${i + 1}-${Date.now()}.jpg`);
            const newFoto: FotoAct = {
              ID: `FACT-${Date.now()}-${i}`,
              IDACTIVIDADES: idAct,
              FOTO: uploadedUrl
            };
            await createFotoAct(newFoto);
            setLocalFotosAct(prev => [...prev, newFoto]);
            if (data.fotosAct) {
              data.fotosAct.push(newFoto);
            }
          } catch (photoErr) {
            console.error('Error subiendo foto de actividad:', photoErr);
          }
        }
      }

      const isExisting = isEditingAct;
      const rowIndex = (actividadForm as any)._rowIndex;

      if (isExisting) {
        try {
          await updateActividad(rowIndex, savedAct);
        } catch (updateErr) {
          console.warn('updateActividad falló, guardando con createActividad como respaldo:', updateErr);
          await createActividad(savedAct);
        }
        setLocalActividades(prev => prev.map(a => (a.IDACTIVIDADES || '').trim() === idAct.trim() ? savedAct : a));
        if (data.actividades) {
          const idx = data.actividades.findIndex(a => (a.IDACTIVIDADES || '').trim() === idAct.trim());
          if (idx >= 0) {
            data.actividades[idx] = { ...data.actividades[idx], ...savedAct };
          } else {
            data.actividades.push(savedAct);
          }
        }
      } else {
        await createActividad(savedAct);
        setLocalActividades(prev => [...prev, savedAct]);
        if (data.actividades) {
          data.actividades.push(savedAct);
        }
      }

      if (!localTicket['ACTIVIDAD DEL TICKET'] && !actividadTicket && isSolClean) {
        const shortSol = isSolClean.length > 80 ? isSolClean.slice(0, 80) + '...' : isSolClean;
        setActividadTicket(shortSol);
      }

      // Reset form after verified save
      setActividadForm({ ...initialAct, FHINICIO: getNowStr(), FHFIN: '' });
      setActPhotos([null, null, null, null]);
      setActPhotosUrls(['', '', '', '']);
      setIsEditingAct(false);
      setActValidationError('');

      setActSuccessMessage(`¡Actividad ${idAct} guardada correctamente en Google Sheets!`);
      setTimeout(() => {
        setActSuccessMessage(null);
      }, 5000);

      onUpdate?.();
    } catch (e: any) {
      console.error('Error guardando actividad en Google Sheets:', e);
      setError(`Error al guardar en Google Sheets: ${e?.message || 'Error desconocido'}`);
    } finally {
      setSavingActividad(false);
    }
  };

  const handleEditActividad = (act: Actividad) => {
    setActividadForm(act);
    setIsEditingAct(true);
    // Find photos
    const fotos = localFotosAct.filter(f => f.IDACTIVIDADES === act.IDACTIVIDADES);
    const urls = ['', '', '', ''];
    fotos.forEach((f, i) => { if (i<4) urls[i] = f.FOTO; });
    setActPhotosUrls(urls);
    setActPhotos([null, null, null, null]);
  };

  const handleDeleteActividad = (actOrId: Actividad | string) => {
    if (typeof actOrId === 'string') {
      const found = localActividades.find(a => (a.IDACTIVIDADES || '').trim() === actOrId.trim());
      setActivityToDelete(found || { ...initialAct, IDACTIVIDADES: actOrId });
    } else {
      setActivityToDelete(actOrId);
    }
  };

  const confirmDeleteActividad = async () => {
    if (!activityToDelete) return;
    const act = activityToDelete;
    const idAct = (act.IDACTIVIDADES || '').trim();
    const rowIndex = (act as any)._rowIndex;
    setIsDeletingAct(true);
    setError(null);
    try {
      await deleteActividad(idAct, rowIndex);
      setLocalActividades(prev => prev.filter(a => (a.IDACTIVIDADES || '').trim() !== idAct));
      setLocalFotosAct(prev => prev.filter(f => (f.IDACTIVIDADES || '').trim() !== idAct));
      if (data.actividades) {
        data.actividades = data.actividades.filter(a => (a.IDACTIVIDADES || '').trim() !== idAct);
      }
      if (data.fotosAct) {
        data.fotosAct = data.fotosAct.filter(f => (f.IDACTIVIDADES || '').trim() !== idAct);
      }
      if ((actividadForm.IDACTIVIDADES || '').trim() === idAct) {
        setActividadForm({ ...initialAct, FHINICIO: getNowStr() });
        setIsEditingAct(false);
        setActPhotosUrls(['', '', '', '']);
        setActPhotos([null, null, null, null]);
      }
      setActivityToDelete(null);
      setActSuccessMessage(`Actividad ${idAct || ''} eliminada correctamente de Google Sheets`);
      setTimeout(() => setActSuccessMessage(null), 4000);
      onUpdate?.();
    } catch (e: any) {
      console.error('Error eliminando actividad:', e);
      setError('Error al eliminar la actividad de Google Sheets: ' + (e?.message || 'Error desconocido'));
    } finally {
      setIsDeletingAct(false);
    }
  };

  const handleSaveRepuesto = async () => {
    if (!repuestoForm.CANTIDAD || !repuestoForm.DESCRIPCION) return;
    const idRep = `REP-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;
    const newRep: Repuesto = { ...repuestoForm, IDREPUESTO: idRep, IDTICKET: localTicket.IDTICKET };
    try {
      await createRepuesto(newRep);
      if (data.repuestos) data.repuestos.push(newRep);
    } catch (e) {
      console.error('Error al guardar repuesto:', e);
    }
    setLocalRepuestos(prev => [...prev, newRep]);
    setRepuestoForm(initialRep);
  };

  const handleGuardarDatosTicket = async () => {
    setLoading(true);
    try {
      const match = data.tecnicos.find(t => t.NOMBRE?.trim().toLowerCase() === localTicket.TECNICO?.trim().toLowerCase());
      const updated: Ticket = { 
        ...localTicket, 
        OBSERVACIONES: observaciones, 
        'ACTIVIDAD DEL TICKET': actividadTicket || localTicket['ACTIVIDAD DEL TICKET'] || '',
        FIRMATECH: match?.FIRMATECH || localTicket.FIRMATECH 
      };

      // If there is an unsaved activity in the form with FHINICIO and SOLUCION, auto-save it too
      const isSolClean = (actividadForm.SOLUCION || '').replace(/<[^>]*>?/gm, '').trim();
      if (isSolClean && actividadForm.FHINICIO) {
        try {
          let idAct = actividadForm.IDACTIVIDADES;
          if (!idAct) {
            let maxNum = 0;
            (data.actividades || []).forEach(a => {
              const m = (a.IDACTIVIDADES || '').match(/\d+/);
              if (m) {
                const n = parseInt(m[0], 10);
                if (n > maxNum) maxNum = n;
              }
            });
            const nextNum = maxNum > 0 ? maxNum + 1 : Math.floor(1000 + Math.random() * 9000);
            idAct = `ACT-${String(nextNum).padStart(4, '0')}`;
          }

          const savedAct: Actividad = {
            ...actividadForm,
            IDACTIVIDADES: idAct,
            IDTICKET: localTicket.IDTICKET,
            CLIENTE: localTicket.CLIENTE,
            TECNICO: localTicket.TECNICO,
            CELULAR: actividadForm.CELULAR || localTicket.TELEFONO || ''
          };

          const existingInGlobalIdx = (data.actividades || []).findIndex(
            a => (a.IDACTIVIDADES || '').trim().toUpperCase() === idAct.trim().toUpperCase()
          );

          if (isEditingAct || existingInGlobalIdx >= 0) {
            const rowIndex = (actividadForm as any)._rowIndex || (existingInGlobalIdx >= 0 ? (data.actividades[existingInGlobalIdx] as any)._rowIndex : undefined);
            await updateActividad(rowIndex, savedAct);
            if (existingInGlobalIdx >= 0) data.actividades[existingInGlobalIdx] = { ...data.actividades[existingInGlobalIdx], ...savedAct };
            setLocalActividades(prev => prev.map(a => a.IDACTIVIDADES === idAct ? savedAct : a));
          } else {
            await createActividad(savedAct);
            if (data.actividades) data.actividades.push(savedAct);
            setLocalActividades(prev => [...prev, savedAct]);
          }

          setActividadForm({ ...initialAct, FHINICIO: getNowStr() });
          setActPhotos([null, null, null, null]);
          setActPhotosUrls(['', '', '', '']);
          setIsEditingAct(false);
        } catch (actErr) {
          console.error('Error auto-guardando actividad pendiente:', actErr);
        }
      }

      await updateTicket(localTicket._rowIndex!, updated);
      setLocalTicket(updated);
      onUpdateLocally?.(updated);
      onUpdate?.();
      setShowSaveOptions(true);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePasarAPendiente = () => {
    if (localActividades.length === 0) {
      setError("MINIMO DEBES TENER UNA ACTIVIDAD");
      return;
    }
    const lastActivity = localActividades[localActividades.length - 1];
    setPendienteCelular(lastActivity.CELULAR || localTicket.TELEFONO || '');
    setPendienteNombre(lastActivity.USUARIO || localTicket.CONTACTO || '');
    setPendienteMotivo('');
    setShowPendienteModal(true);
  };

  const handleConfirmarPendiente = async () => {
    if (!pendienteMotivo.trim()) {
      setError("Por favor ingrese el motivo");
      return;
    }

    setLoading(true);
    try {
      // 1. Get the last activity
      const lastActivity = localActividades[localActividades.length - 1];
      
      // 2. Append to SOLUCION
      const appendedText = `\n\nMOTIVO POR EL CUAL PASA A PENDIENTE:\n${pendienteMotivo}`;
      const nuevaSolucion = (lastActivity.SOLUCION || '') + appendedText;
      
      const updatedActivity: Actividad = {
         ...lastActivity,
         SOLUCION: nuevaSolucion,
         CELULAR: pendienteCelular,
         USUARIO: pendienteNombre
      };
      
      // 3. Save the updated activity
      await updateActividad(updatedActivity._rowIndex!, updatedActivity);
      
      // 4. Update the local activities array
      setLocalActividades(prev => prev.map(a => a._rowIndex === updatedActivity._rowIndex ? updatedActivity : a));

      // 5. Update the ticket status
      const updated: Ticket = { 
        ...localTicket, 
        ESTADO: 'PENDIENTE',
        OBSERVACIONES: observaciones,
        'ACTIVIDAD DEL TICKET': actividadTicket || localTicket['ACTIVIDAD DEL TICKET'] || ''
      };
      await updateTicket(localTicket._rowIndex!, updated);
      setLocalTicket(updated);
      notifyTicketStateChange(updated, 'PENDIENTE');
      onUpdateLocally?.(updated);
      onUpdate?.();
      setShowSaveOptions(false);
      setShowPendienteModal(false);
      
      // 6. Open WhatsApp if a number was provided
      let cleanPhone = pendienteCelular.replace(/\D/g, '');
      if (cleanPhone) {
        if (cleanPhone.length === 9 && cleanPhone.startsWith('9')) cleanPhone = '51' + cleanPhone;
        const messageToShow = `MOTIVO POR EL CUAL PASA A PENDIENTE\n${pendienteMotivo}`;
        const waUrl = `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(messageToShow)}`;
        window.open(waUrl, '_blank');
      }
      
      onClose();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePasarAAtencion = async () => {
    setLoading(true);
    try {
      const updated: Ticket = { 
        ...localTicket, 
        ESTADO: 'EN ATENCION',
        OBSERVACIONES: observaciones,
        'ACTIVIDAD DEL TICKET': actividadTicket || localTicket['ACTIVIDAD DEL TICKET'] || ''
      };
      if (localTicket._rowIndex) {
        await updateTicket(localTicket._rowIndex, updated);
      }
      setLocalTicket(updated);
      notifyTicketStateChange(updated, 'EN ATENCION');
      onUpdateLocally?.(updated);
      onUpdate?.();
      onClose();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSignature = async (dataUrl: string) => {
    setLoading(true);
    try {
      const coords = await getLocation();
      // Guardar firma con formato exacto FIRMA-IDTICKET.jpg en la carpeta Drive especificada
      const fileName = `FIRMA-${localTicket.IDTICKET}.jpg`;
      const file = dataURLtoFile(dataUrl, fileName);
      const driveUrl = await uploadImage(file, '14zJIbLf9bfeM0RZiwsPDXGzcqfUWJw0o', fileName);

      const updated: Ticket = { 
        ...localTicket, 
        FIRMA: driveUrl,
        FHSC: getNowStr(),
        'GPS SALIDA': coords,
        OBSERVACIONES: observaciones,
        'ACTIVIDAD DEL TICKET': actividadTicket || localTicket['ACTIVIDAD DEL TICKET'] || ''
      };
      await updateTicket(localTicket._rowIndex!, updated);
      setLocalTicket(updated);
      notifyTicketFirmaReceived(updated);
      onUpdateLocally?.(updated);
      onUpdate?.();
      setShowSignature(false);
    } catch(e:any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const cleanPhoneNumber = (rawPhone: string) => {
    let clean = (rawPhone || '').replace(/\D/g, '');
    if (clean.length === 9 && !clean.startsWith('51')) {
      clean = `51${clean}`;
    }
    return clean;
  };

  const selectedTecnicoObj = useMemo(() => {
    if (!localTicket.TECNICO) return null;
    return (data.tecnicos || []).find(
      t => (t.NOMBRE || '').trim().toLowerCase() === (localTicket.TECNICO || '').trim().toLowerCase()
    ) || null;
  }, [data.tecnicos, localTicket.TECNICO]);

  const formatSolucionForWhatsApp = (rawHtml: string) => {
    if (!rawHtml) return '';
    return rawHtml
      .replace(/<br\s*[\/]?>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<li>/gi, '• ')
      .replace(/<\/li>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  };

  const handleSelectTecnico = async (nuevoNombre: string) => {
    if (!nuevoNombre || nuevoNombre === localTicket.TECNICO) return;
    const updatedTicket: Ticket = {
      ...localTicket,
      TECNICO: nuevoNombre
    };
    setLocalTicket(updatedTicket);
    setSavingTecnico(true);
    try {
      if (localTicket._rowIndex) {
        await updateTicket(localTicket._rowIndex, updatedTicket);
      }
      if (onUpdateLocally) {
        onUpdateLocally(updatedTicket);
      }
      setTecnicoSuccessMsg(true);
      setTimeout(() => setTecnicoSuccessMsg(false), 3000);
    } catch (err: any) {
      console.error('Error al actualizar técnico:', err);
      alert('Error al guardar el técnico asignado: ' + (err.message || 'Error de conexión'));
    } finally {
      setSavingTecnico(false);
    }
  };

  const handleNotificarTecnicoWhatsApp = () => {
    const currentTecnicoName = (localTicket.TECNICO || '').trim();
    if (!currentTecnicoName) {
      alert('Por favor seleccione primero un técnico asignado al ticket.');
      return;
    }

    const techObj = (data.tecnicos || []).find(
      t => (t.NOMBRE || '').trim().toLowerCase() === currentTecnicoName.toLowerCase()
    );

    const rawCelular = techObj?.CELULAR || '';
    const cleanPhone = cleanPhoneNumber(rawCelular);

    if (!cleanPhone) {
      alert(
        `El técnico "${currentTecnicoName}" no tiene un número de celular registrado en la columna CELULAR de la tabla TECNICOS.` +
        (rawCelular ? ` (Valor actual: "${rawCelular}")` : '') +
        `\n\nPor favor configure su número de celular en la lista de técnicos.`
      );
      return;
    }

    // Actividades and Solucion
    const ticketActividades = localActividades.length > 0 
      ? localActividades 
      : (data.actividades || []).filter(
          a => (a.IDTICKET || '').trim().toUpperCase() === (localTicket.IDTICKET || '').trim().toUpperCase()
        );

    let actividadesText = '';
    if (ticketActividades.length > 0) {
      actividadesText = ticketActividades.map((a, idx) => {
        const cleanSol = formatSolucionForWhatsApp(a.SOLUCION);
        const equipInfo = [a.TIPO, a.MARCA, a.MODELO].filter(Boolean).join(' - ');
        const lines = [
          `🛠️ *Actividad ${ticketActividades.length > 1 ? (idx + 1) : ''}:*`,
          equipInfo ? `  🖥️ *Equipo:* ${equipInfo}${a.SERIE ? ` (Serie: ${a.SERIE})` : ''}` : '',
          (a.AREA || a.USUARIO) ? `  📍 *Área / Usuario:* ${[a.AREA, a.USUARIO].filter(Boolean).join(' - ')}` : '',
          (a.FHINICIO || a.FHFIN) ? `  ⏱️ *Horario:* ${a.FHINICIO || '-'} a ${a.FHFIN || 'En proceso'}` : '',
          `  💡 *SOLUCIÓN:*\n${cleanSol || 'Sin solución registrada'}`
        ].filter(Boolean);
        return lines.join('\n');
      }).join('\n\n');
    } else if (localTicket['ACTIVIDAD DEL TICKET']) {
      actividadesText = `🛠️ *Actividad / Solución:*\n${localTicket['ACTIVIDAD DEL TICKET']}`;
    } else {
      actividadesText = `🛠️ *Actividad (campo Solución):*\n_Pendiente de atención / registro de actividades_`;
    }

    const message =
      `🔔 *NOTIFICACIÓN DE TICKET - SERVICIO TÉCNICO*\n` +
      `----------------------------------------\n` +
      `Hola *${techObj?.NOMBRE || currentTecnicoName}*, se te comparte la información del ticket asignado:\n\n` +
      `🎫 *N° Ticket:* ${localTicket.IDTICKET}\n` +
      `🏢 *Cliente:* ${localTicket.CLIENTE || '-'}\n` +
      `📍 *Dirección:* ${localTicket.DIRECCION || '-'}\n` +
      (localTicket.CONTACTO ? `👤 *Contacto:* ${localTicket.CONTACTO}\n` : '') +
      (localTicket.TELEFONO ? `📞 *Teléfono Cliente:* ${localTicket.TELEFONO}\n` : '') +
      (localTicket.FHPROGRAMADA ? `📅 *Fecha Programada:* ${localTicket.FHPROGRAMADA}\n` : '') +
      `⚡ *Prioridad:* ${localTicket.PRIORIDAD || 'Normal'}\n` +
      `📋 *Tipo de Servicio:* ${localTicket.TIPO || '-'}\n` +
      (localTicket['MODO DE ATENCION'] ? `⚙️ *Modo de Atención:* ${localTicket['MODO DE ATENCION']}\n` : '') +
      `📌 *Estado:* ${localTicket.ESTADO || 'PENDIENTE'}\n` +
      (localTicket.PROBLEMA ? `\n⚠️ *PROBLEMA REPORTADO:*\n${localTicket.PROBLEMA}\n` : '') +
      `\n----------------------------------------\n` +
      `📝 *DATOS DE ACTIVIDAD Y SOLUCIÓN:*\n\n` +
      `${actividadesText}\n\n` +
      `----------------------------------------\n` +
      `_Sistema de Gestión Técnica_`;

    const waUrl = `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(message)}`;
    window.open(waUrl, '_blank', 'noopener,noreferrer');

    // Actualizar NOTITEC a ENVIADO en background si no lo estaba
    if (localTicket._rowIndex && localTicket.NOTITEC !== 'ENVIADO') {
      const updated = { ...localTicket, NOTITEC: 'ENVIADO' };
      updateTicket(localTicket._rowIndex, updated).catch(console.warn);
      setLocalTicket(updated);
      if (onUpdateLocally) onUpdateLocally(updated);
    }
  };

  const handleOpenSolicitarFirma = async () => {
    const defaultCel = localTicket.TELEFONO || actividadForm.CELULAR || localActividades.find(a => a.CELULAR)?.CELULAR || '';
    const defaultUsr = localTicket.CONTACTO || actividadForm.USUARIO || localActividades.find(a => a.USUARIO)?.USUARIO || 'Cliente';
    setCelularFirma(defaultCel);
    setUsuarioFirma(defaultUsr);
    setMensajeFirmaCustom(null);
    setCopiedSignLink(false);
    setCopiedSignMsg(false);
    setSolicitarError(null);
    setWaOpened(false);
    setShowSolicitarFirma(true);
    
    // Asegurar que el token esté activo y verificar su vigencia
    let token = getStoredAccessToken();
    if (!token) {
      try {
        token = await getAccessToken();
      } catch (e) {}
    }
    if (token) {
      setCheckingToken(true);
      checkGoogleTokenValidity(token).then(status => {
        setTokenStatus(status);
      }).finally(() => {
        setCheckingToken(false);
      });
    }
    syncPublicTicketData(defaultUsr, defaultCel);
  };

  const handleRenovarTokenGoogle = async () => {
    setRenewingToken(true);
    setSolicitarError(null);
    try {
      const res = await googleSignIn();
      if (res?.accessToken) {
        const status = await checkGoogleTokenValidity(res.accessToken);
        setTokenStatus(status);
      }
    } catch (e: any) {
      setSolicitarError(`No se pudo renovar la sesión de Google: ${e.message || String(e)}`);
    } finally {
      setRenewingToken(false);
    }
  };

  const handleEnviarFirmaPorCorreo = async () => {
    setSolicitarError(null);
    if (!emailFirma || !emailFirma.includes('@')) {
      setSolicitarError("Por favor ingrese un correo electrónico válido.");
      return;
    }
    
    setEnviandoCorreo(true);
    
    const signUrl = buildPublicSignUrl(
      localTicket.IDTICKET, 
      localTicket.CLIENTE, 
      usuarioFirma, 
      getStoredAccessToken() || undefined, 
      localTicket._rowIndex
    );
    
    const nombre = usuarioFirma.trim() || 'Estimado(a) Cliente';
    
    const defaultHtml = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
        <h2 style="color: #059669;">Solicitud de Conformidad de Servicio</h2>
        <p>Estimado(a) <strong>${nombre}</strong>,</p>
        <p>Le informamos que se ha completado la atención técnica de su requerimiento. Necesitamos su aprobación para el cierre formal del servicio.</p>
        <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 5px 0;"><strong>N° Ticket:</strong> ${localTicket.IDTICKET}</p>
          <p style="margin: 5px 0;"><strong>Cliente:</strong> ${localTicket.CLIENTE}</p>
          <p style="margin: 5px 0;"><strong>Técnico:</strong> ${localTicket.TECNICO}</p>
        </div>
        <p>Por favor, haga clic en el siguiente enlace para revisar y firmar su ticket de forma digital:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${signUrl}" style="background-color: #059669; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Firmar Ticket Digitalmente</a>
        </div>
        <p style="font-size: 12px; color: #b45309; background-color: #fef3c7; padding: 8px 12px; border-radius: 6px; text-align: center;">
          ⏱️ <strong>Nota de seguridad:</strong> Este enlace tiene una vigencia temporal de 1 hora. Si caduca, solicite al técnico que le reenvíe un enlace actualizado.
        </p>
        <p style="font-size: 12px; color: #6b7280; text-align: center; margin-top: 25px;">
          Si tiene problemas con el botón, copie y pegue este enlace en su navegador:<br/>
          <a href="${signUrl}" style="color: #2563eb; word-break: break-all;">${signUrl}</a>
        </p>
      </div>
    `;

    try {
      const { sendEmail } = await import('../../lib/googleApi');
      await sendEmail(emailFirma.trim(), `Firma Requerida - Ticket ${localTicket.IDTICKET}`, defaultHtml);
      setFirmaNotification({
        type: 'success',
        message: `El enlace de firma se envió correctamente por correo a ${emailFirma}.`
      });
      setIsPolling(true);
      setShowSolicitarFirma(false);
    } catch (e: any) {
      setSolicitarError(`Error al enviar el correo: ${e.message || String(e)}`);
    } finally {
      setEnviandoCorreo(false);
    }
  };

  const handleSolicitarFirma = async () => {
    setSolicitarError(null);
    const cleanPhone = cleanPhoneNumber(celularFirma);
    if (!cleanPhone || cleanPhone.length < 8) {
      setSolicitarError("Por favor ingrese o verifique el número de celular/teléfono para WhatsApp (ej. 929822708).");
      return;
    }

    const signUrl = buildPublicSignUrl(
      localTicket.IDTICKET, 
      localTicket.CLIENTE, 
      usuarioFirma, 
      getStoredAccessToken() || undefined, 
      localTicket._rowIndex
    );
    const nombre = usuarioFirma.trim() || 'Estimado(a) Cliente';

    const defaultMessage = 
      `👋 *SOLICITUD DE APROBACIÓN Y CONFORMIDAD DE SERVICIO*\n` +
      `----------------------------------------\n` +
      `Estimado(a) *${nombre}*,\n\n` +
      `Le informamos que se ha completado la atención técnica de su requerimiento. Se necesita la aprobación del servicio para proceder a su cierre formal en nuestro sistema:\n\n` +
      `📋 *Datos del Servicio:*\n` +
      `• N° Ticket: ${localTicket.IDTICKET}\n` +
      `• Empresa / Cliente: ${localTicket.CLIENTE}\n` +
      `• Técnico Responsable: ${localTicket.TECNICO}\n` +
      (localTicket.TIPO ? `• Tipo de Servicio: ${localTicket.TIPO}\n` : '') +
      `\n` +
      `Por favor, ingrese al siguiente enlace público para revisar la información del ticket, el detalle de actividades realizadas y registrar su firma manual de conformidad:\n\n` +
      `👉 *Enlace para Firmar:*\n` +
      `${signUrl}\n\n` +
      `----------------------------------------\n` +
      `_Agradecemos su valiosa colaboración._`;

    const finalMessage = mensajeFirmaCustom !== null ? mensajeFirmaCustom : defaultMessage;

    // Actualizar CONTACTO o TELEFONO en el ticket si fueron editados en la ventana
    if ((usuarioFirma && usuarioFirma !== localTicket.CONTACTO) || (celularFirma && celularFirma !== localTicket.TELEFONO)) {
      const updatedTicket: Ticket = {
        ...localTicket,
        CONTACTO: usuarioFirma || localTicket.CONTACTO,
        TELEFONO: celularFirma || localTicket.TELEFONO
      };
      setLocalTicket(updatedTicket);
      if (localTicket._rowIndex) {
        updateTicket(localTicket._rowIndex, updatedTicket).catch(console.warn);
      }
      if (onUpdateLocally) onUpdateLocally(updatedTicket);
    }

    // Sincronizar datos con el endpoint público para que el cliente vea la info al abrir el link
    await syncPublicTicketData(usuarioFirma, celularFirma);

    const waUrl = `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(finalMessage)}`;
    
    try {
      window.open(waUrl, '_blank', 'noopener,noreferrer');
    } catch (e) {
      console.warn('window.open blocked:', e);
    }

    setWaOpened(true);
    setIsPolling(true);
    setFirmaNotification({
      type: 'info',
      message: `Enlace de firma generado para WhatsApp (${cleanPhone}). El sistema monitorea en segundo plano la recepción de la firma para guardar en Drive y Sheets.`
    });
  };

  const handleOpenNotificarWhatsApp = async () => {
    setDestinatarioNotificacion(localTicket.CONTACTO || '');
    setTelefonoNotificacion(localTicket.TELEFONO || '');
    setCopiedNotifMsg(false);
    setShowEnviarNotificacion(true);

    if (!localTicket.PDF && isTicketCerrado) {
      try {
        await generateAndUploadPDF(false);
      } catch (err) {
        console.warn('Auto-generación de PDF al abrir notificación:', err);
      }
    }
  };

  const handleEnviarNotificacion = async () => {
    const cleanPhone = cleanPhoneNumber(telefonoNotificacion);
    if (!cleanPhone) {
      alert("Por favor ingrese o verifique el número de celular/teléfono para enviar por WhatsApp.");
      return;
    }
    try {
      let pdfLink = (localTicket.PDF || '').trim();
      if (isTicketCerrado) {
        try {
          const genResult = await generateAndUploadGuiaPDF({
            ticket: localTicket,
            data,
            actividades: localActividades,
            repuestos: localRepuestos,
            downloadLocally: false
          });
          if (genResult && genResult.pdfUrl) {
            pdfLink = genResult.pdfUrl;
          }
        } catch (pdfErr) {
          console.warn("Fallo generación automática de PDF, continuando con link existente:", pdfErr);
        }
      }

      const nombre = (destinatarioNotificacion || localTicket.CONTACTO || 'Cliente').trim();
      const clienteClean = (localTicket.CLIENTE || 'CLIENTE').trim().replace(/[/\\?%*:|"<>]/g, '_');
      const ticketClean = (localTicket.IDTICKET || 'TICKET').trim().replace(/[/\\?%*:|"<>]/g, '_');
      const expectedFileName = `${clienteClean}-${ticketClean}.pdf`;

      const message = 
        `📋 *GUÍA DE SERVICIO TÉCNICO - TICKET CERRADO*\n` +
        `----------------------------------------\n` +
        `Estimado(a) *${nombre}*,\n\n` +
        `Le informamos que se ha completado y cerrado la atención técnica de su requerimiento:\n\n` +
        `🎫 *N° Ticket:* ${localTicket.IDTICKET}\n` +
        `🏢 *Cliente / Empresa:* ${localTicket.CLIENTE}\n` +
        (localTicket.TECNICO ? `👨‍🔧 *Técnico Responsable:* ${localTicket.TECNICO}\n` : '') +
        (localTicket['MODO DE ATENCION'] ? `⚙️ *Modo de Atención:* ${localTicket['MODO DE ATENCION']}\n` : '') +
        (localTicket['FECHA DE CIERRE'] ? `📅 *Fecha de Cierre:* ${localTicket['FECHA DE CIERRE']}\n` : '') +
        (localTicket.SUMAXH ? `⏱️ *Tiempo Eficaz:* ${localTicket.SUMAXH}\n` : '') +
        `\n` +
        `📄 *Archivo Guía:* ${expectedFileName}\n` +
        `📥 *Enlace para Descargar la Guía de Servicio (PDF):*\n` +
        `${pdfLink || 'Enlace directo del PDF'}\n\n` +
        `⚠️ *AVISO IMPORTANTE DE DESCARGA:*\n` +
        `_El archivo PDF (${expectedFileName}) se mantendrá disponible en el contenedor en la nube durante *1 mes* a partir de la fecha de cierre. Le recomendamos descargarlo y guardarlo en sus registros locales._\n\n` +
        `----------------------------------------\n` +
        `_Agradecemos su preferencia y valiosa colaboración._`;
      
      const waUrl = `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(message)}`;
      window.open(waUrl, '_blank', 'noopener,noreferrer');
      
      setShowEnviarNotificacion(false);
      
      const updated = { 
        ...localTicket, 
        NOTIFICA: 'ENVIADO',
        CONTACTO: destinatarioNotificacion || localTicket.CONTACTO,
        TELEFONO: telefonoNotificacion || localTicket.TELEFONO,
        PDF: pdfLink || localTicket.PDF
      };
      if (localTicket._rowIndex) {
        await updateTicket(localTicket._rowIndex, updated);
      }
      setLocalTicket(updated);
      onUpdateLocally && onUpdateLocally(updated);
      alert("¡Guía PDF generada, guardada en Drive y enviada por WhatsApp!");
      
    } catch(e:any) {
      setError(e.message);
    }
  };

  const handleCerrarTicket = async () => {
    setLoading(true);
    try {
      const match = data.tecnicos.find(t => t.NOMBRE?.trim().toLowerCase() === localTicket.TECNICO?.trim().toLowerCase());
      const calculatedFechaCierre = extractMaxFHFINDate(localActividades, localTicket.FHINGRESO) || formatDateToDDMMAAAA(new Date());

      let totalMins = 0;
      localActividades.forEach(a => {
        if (a.TE) {
          const parts = a.TE.split(':').map(Number);
          if (!isNaN(parts[0]) && !isNaN(parts[1])) {
            totalMins += parts[0] * 60 + parts[1];
          }
        }
      });
      const th = Math.floor(totalMins / 60);
      const tm = totalMins % 60;
      const calculatedSuma = totalMins > 0 ? `${String(th).padStart(2, '0')}:${String(tm).padStart(2, '0')}` : undefined;

      const updated: Ticket = { 
        ...localTicket, 
        ESTADO: 'CERRADO', 
        'FECHA DE CIERRE': calculatedFechaCierre, 
        FIRMATECH: match?.FIRMATECH || localTicket.FIRMATECH,
        OBSERVACIONES: observaciones,
        'ACTIVIDAD DEL TICKET': actividadTicket || localTicket['ACTIVIDAD DEL TICKET'] || '',
        ...(calculatedSuma ? { SUMAXH: calculatedSuma } : {})
      };
      await updateTicket(localTicket._rowIndex!, updated);
      setLocalTicket(updated);
      notifyTicketStateChange(updated, 'CERRADO');
      onUpdateLocally?.(updated);
      onUpdate?.();
    } catch(e:any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const unique = (arr: any[], key: string) => Array.from(new Set(arr.map(a => a[key]).filter(Boolean)));

  const formatImageUrl = (url: string) => {
    if (!url) return url;
    
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
        return `https://lh3.googleusercontent.com/d/${fileId}`;
      }
    }
    
    if (url.startsWith('http')) return url;
    if (url.startsWith('data:image')) return url;
    
    // Asumir que es una cadena base64 pura si no empieza con http o data:image
    return `data:image/png;base64,${url}`;
  };


  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-2 md:p-4 bg-black/80 backdrop-blur-sm overflow-hidden">
      <div className={`bg-slate-900 w-full ${isTicketCerrado ? 'sm:max-w-4xl lg:max-w-5xl' : 'sm:w-[800px]'} h-full sm:h-auto sm:max-h-[94vh] max-h-[100dvh] rounded-none sm:rounded-2xl shadow-2xl flex flex-col border border-slate-700/50 overflow-hidden`}>
        
        {/* Header */}
        <div className="flex justify-between items-center p-3 sm:p-4 border-b border-slate-800 bg-slate-900/95 sticky top-0 z-20 shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
                {localTicket.IDTICKET} 
                <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${
                  isTicketCerrado 
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' 
                    : 'bg-slate-800 text-slate-300 border border-slate-700'
                }`}>{localTicket.ESTADO}</span>
              </h2>
              {bgSyncStatus && (
                <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold flex items-center gap-1.5 transition-all ${
                  bgSyncStatus.type === 'syncing' ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40' :
                  bgSyncStatus.type === 'success' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' :
                  'bg-red-500/20 text-red-300 border border-red-500/40'
                }`}>
                  {bgSyncStatus.type === 'syncing' && <Loader2 className="w-3 h-3 animate-spin" />}
                  {bgSyncStatus.type === 'success' && <Check className="w-3 h-3 text-emerald-400" />}
                  <span>{bgSyncStatus.message}</span>
                </span>
              )}
            </div>
            <p className="text-slate-400 text-xs sm:text-sm truncate max-w-[220px] xs:max-w-xs sm:max-w-md">{localTicket.CLIENTE}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white transition-colors" title="Cerrar">
            <X className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
        </div>

        {/* Content */}
        <div ref={guiaContainerRef} className="flex-1 overflow-y-auto overflow-x-auto p-1.5 sm:p-4 custom-scrollbar flex flex-col gap-3 sm:gap-6 overscroll-contain">
          
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          {!isTicketCerrado && (
            <>
                            {/* INFORMACION DEL TICKET */}
              <div className="bg-orange-500/5 border border-orange-500/50 rounded-xl p-4 shadow-sm">
                <h3 className="text-orange-400 font-bold uppercase text-xs mb-4 tracking-wider flex items-center gap-2">
                  <Play className="w-4 h-4" /> Información del Ticket
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-slate-500 font-bold text-xs uppercase mb-1">IDTICKET</p>
                    <p className="text-white font-bold">{localTicket.IDTICKET}</p>
                  </div>
                  <div>
                    <p className="text-slate-500 font-bold text-xs uppercase mb-1">FHINGRESO</p>
                    <p className="text-white">{localTicket.FHINGRESO}</p>
                  </div>
                  <div>
                    <p className="text-slate-500 font-bold text-xs uppercase mb-1">CLIENTE</p>
                    <p className="text-white">{localTicket.CLIENTE}</p>
                  </div>
                  <div>
                    <p className="text-slate-500 font-bold text-xs uppercase mb-1">DIRECCION</p>
                    <p className="text-white">{localTicket.DIRECCION}</p>
                  </div>
                  <div>
                    <p className="text-slate-500 font-bold text-xs uppercase mb-1">TELEFONO</p>
                    <p className="text-white">{localTicket.TELEFONO}</p>
                  </div>
                  <div>
                    <p className="text-slate-500 font-bold text-xs uppercase mb-1">CONTACTO</p>
                    <p className="text-white">{localTicket.CONTACTO}</p>
                  </div>
                  <div>
                    <p className="text-slate-500 font-bold text-xs uppercase mb-1">FHPROGRAMADA</p>
                    <p className="text-white">{localTicket.FHPROGRAMADA}</p>
                  </div>
                  <div>
                    <p className="text-slate-500 font-bold text-xs uppercase mb-1">ESTADO</p>
                    <p className="text-white">{localTicket.ESTADO}</p>
                  </div>
                  <div>
                    <p className="text-slate-500 font-bold text-xs uppercase mb-1">PRIORIDAD</p>
                    <p className="text-white">{localTicket.PRIORIDAD}</p>
                  </div>
                  <div>
                    <p className="text-slate-500 font-bold text-xs uppercase mb-1">TIPO</p>
                    <p className="text-white">{localTicket.TIPO}</p>
                  </div>
                  <div className="col-span-2 md:col-span-3">
                    <p className="text-slate-500 font-bold text-xs uppercase mb-1">PROBLEMA</p>
                    <p className="text-white">{localTicket.PROBLEMA}</p>
                  </div>
                  <div className="col-span-2 md:col-span-3 bg-slate-900/60 border border-slate-800 rounded-xl p-3.5 shadow-sm">
                    <div className="flex items-center justify-between mb-1.5">
                      <p className="text-slate-400 font-bold text-xs uppercase flex items-center gap-1.5">
                        ACTIVIDAD DEL TICKET
                        {!isTicketCerrado && (
                          <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded font-medium border border-slate-700">
                            Editable
                          </span>
                        )}
                      </p>
                    </div>
                    {isTicketCerrado ? (
                      <p className="text-white font-medium whitespace-pre-wrap">{localTicket['ACTIVIDAD DEL TICKET'] || '-'}</p>
                    ) : (
                      <textarea
                        rows={2}
                        value={actividadTicket}
                        onChange={e => setActividadTicket(e.target.value)}
                        placeholder="Descripción de la actividad asignada o realizada..."
                        className="w-full bg-slate-800/90 border border-slate-700 text-white rounded-lg p-2.5 text-sm focus:outline-none focus:border-blue-500 resize-none transition-colors"
                      />
                    )}
                  </div>
                  <div className={isTicketPendiente ? "col-span-2 md:col-span-3 bg-slate-900/90 border border-blue-500/40 rounded-xl p-3.5 shadow-sm" : ""}>
                    <div className="flex items-center justify-between mb-1.5">
                      <p className="text-slate-400 font-bold text-xs uppercase flex items-center gap-1.5">
                        TECNICO
                        {isTicketPendiente && (
                          <span className="text-[10px] bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded font-medium border border-blue-500/30">
                            Editar Técnico
                          </span>
                        )}
                      </p>
                      {isTicketPendiente && (
                        <div className="flex items-center gap-2">
                          {savingTecnico && (
                            <span className="text-[11px] text-blue-400 font-semibold flex items-center gap-1">
                              <div className="w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
                              Guardando...
                            </span>
                          )}
                          {tecnicoSuccessMsg && (
                            <span className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1">
                              <Check className="w-3.5 h-3.5" />
                              Guardado
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {isTicketPendiente ? (
                      <div>
                        <div className="flex items-center gap-2">
                          <TecnicoDropdownSelect
                            value={localTicket.TECNICO || ''}
                            onChange={handleSelectTecnico}
                            tecnicos={data.tecnicos || []}
                            disabled={savingTecnico}
                          />
                          <button
                            type="button"
                            onClick={handleNotificarTecnicoWhatsApp}
                            disabled={!localTicket.TECNICO}
                            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-md shadow-emerald-600/25 active:scale-95 shrink-0"
                            title={
                              localTicket.TECNICO
                                ? `Notificar ticket y actividades por WhatsApp a ${localTicket.TECNICO}`
                                : 'Seleccione un técnico primero'
                            }
                          >
                            <WhatsAppIcon className="w-4 h-4" />
                            <span className="hidden sm:inline">WhatsApp</span>
                          </button>
                        </div>
                        {selectedTecnicoObj && (
                          <div className="mt-2 flex items-center gap-2 text-[11px] text-slate-400">
                            <span>Celular:</span>
                            <span className={`font-mono font-bold ${selectedTecnicoObj.CELULAR ? 'text-emerald-400' : 'text-amber-400'}`}>
                              {selectedTecnicoObj.CELULAR ? `📱 ${selectedTecnicoObj.CELULAR}` : '⚠️ Sin número registrado'}
                            </span>
                            {selectedTecnicoObj.DNI && (
                              <>
                                <span className="text-slate-600">•</span>
                                <span>DNI: {selectedTecnicoObj.DNI}</span>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <p className="text-white font-medium">{localTicket.TECNICO || '-'}</p>
                        {localTicket.TECNICO && (
                          <button
                            type="button"
                            onClick={handleNotificarTecnicoWhatsApp}
                            className="p-1 hover:bg-slate-800 rounded-lg text-emerald-400 hover:text-emerald-300 transition-colors"
                            title={`Notificar ticket por WhatsApp a ${localTicket.TECNICO}`}
                          >
                            <WhatsAppIcon className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                  <div>
                    <p className="text-slate-500 font-bold text-xs uppercase mb-1">NOTIFICA</p>
                    <p className="text-white">{localTicket.NOTIFICA}</p>
                  </div>
                  <div>
                    <p className="text-slate-500 font-bold text-xs uppercase mb-1">MODO DE ATENCION</p>
                    <p className="text-white">{localTicket['MODO DE ATENCION']}</p>
                  </div>
                </div>
              </div>

              {/* ACTIVIDADES GROUP */}
              <div className="bg-blue-500/5 border border-blue-500/50 rounded-xl p-4 shadow-sm relative">
                <h3 className="text-blue-400 font-bold uppercase text-xs mb-4 tracking-wider flex items-center gap-2">
                  <Play className="w-4 h-4" /> Actividades
                </h3>
                
                {/* Lista de Actividades */}
                <div className="flex flex-col gap-2 mb-4">
                  {localActividades.map((a, i) => (
                    <div key={a.IDACTIVIDADES || i} className="bg-slate-900/50 border border-cyan-500/50 rounded-lg p-3 flex flex-col gap-2 hover:bg-slate-800 cursor-pointer transition-colors" onClick={() => handleEditActividad(a)}>
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-3">
                          <button 
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handleDeleteActividad(a); }} 
                            className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/20 rounded-lg transition-colors"
                            title="Eliminar actividad"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                          <div>
                            <p className="text-white font-bold text-sm">{a.TIPO || 'Sin Tipo'} - {a.MARCA}</p>
                            <div className="flex flex-wrap items-center gap-2 mt-1">
                              <span className="text-slate-400 text-xs">{a.FHINICIO} a {a.FHFIN}</span>
                              {a.TE && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                                  Tiempo Eficaz: {a.TE}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <PenTool className="w-4 h-4 text-slate-500" />
                      </div>
                      {a.SOLUCION && (
                        <div className="ml-12 mr-2 p-3 bg-slate-800/80 rounded border border-slate-700 text-sm text-slate-300">
                           <div className="font-bold text-xs text-cyan-400 mb-1">SOLUCIÓN</div>
                           <div dangerouslySetInnerHTML={{ __html: a.SOLUCION }} className="prose prose-invert prose-sm max-w-none [&_p]:mb-1 [&_p:last-child]:mb-0 [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4" />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                
                <div className={`p-4 rounded-xl border ${actValidationError ? 'border-dashed border-red-500 bg-red-500/5' : 'border-slate-700/30 bg-slate-900/50'} mb-4`}>
                  {actValidationError && (
                    <div className="p-2.5 mb-3 bg-red-500/20 border border-red-500/40 rounded-lg text-red-300 text-xs font-semibold flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                      <span>{actValidationError}</span>
                    </div>
                  )}
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                    <div className="relative">
                      <label className="text-xs font-bold text-slate-400 mb-1 block">FHINICIO *</label>
                      <div className="flex">
                        <input 
                          type="text" 
                          placeholder="dd/MM/yyyy HH:mm"
                          value={actividadForm.FHINICIO}
                          readOnly
                          className="flex-1 bg-slate-800/50 border border-slate-700/50 text-slate-400 rounded-l-lg px-3 py-2 text-sm focus:outline-none cursor-not-allowed"
                        />
                        <button type="button" onClick={() => handleSetNow('FHINICIO')} className="bg-blue-600 hover:bg-blue-500 px-3 rounded-r-lg border-y border-r border-slate-700/50 transition-colors flex items-center gap-1 text-xs text-white" title="Actualizar a hora actual">
                          <Clock className="w-4 h-4 text-white" />
                          <span className="hidden sm:inline">Ahora</span>
                        </button>
                      </div>
                    </div>
                    <div className="relative">
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-bold text-slate-400">FHFIN (Hora de término) *</label>
                        <span className="text-[10px] text-slate-400 font-normal">Si se deja vacío usará hora actual</span>
                      </div>
                      <div className="flex">
                        <span className="bg-slate-800 border border-slate-700/50 text-slate-400 rounded-l-lg px-3 py-2 text-sm border-r-0 flex items-center">
                          {actividadForm.FHINICIO ? actividadForm.FHINICIO.split(' ')[0] : ''}
                        </span>
                        <input 
                          type="time" 
                          value={actividadForm.FHFIN ? (actividadForm.FHFIN.split(' ')[1] || '') : ''}
                          onChange={e => {
                            const datePart = actividadForm.FHINICIO ? actividadForm.FHINICIO.split(' ')[0] : getNowStr().split(' ')[0];
                            const timePart = e.target.value;
                            setActividadForm(prev => ({...prev, FHFIN: timePart ? `${datePart} ${timePart}` : ''}));
                          }}
                          className="flex-1 bg-slate-800/80 border border-slate-700/50 text-white px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                        />
                        <button 
                          type="button" 
                          onClick={() => {
                            const now = new Date();
                            const timePart = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
                            const datePart = actividadForm.FHINICIO ? actividadForm.FHINICIO.split(' ')[0] : getNowStr().split(' ')[0];
                            setActividadForm(prev => ({ ...prev, FHFIN: `${datePart} ${timePart}` }));
                          }} 
                          className="bg-blue-600 hover:bg-blue-500 px-3 rounded-r-lg border-y border-r border-slate-700/50 transition-colors flex items-center gap-1 text-xs text-white" 
                          title="Fijar hora actual"
                        >
                          <Clock className="w-4 h-4 text-white" />
                          <span className="hidden sm:inline">Ahora</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="mb-4">
                    <label className="text-xs font-bold text-slate-400 mb-1 block">SOLUCION *</label>
                    <div className="bg-slate-100 rounded-lg overflow-hidden border border-slate-700/50">
                      <ReactQuill 
                        theme="snow"
                        value={actividadForm.SOLUCION} 
                        onChange={(val: string) => setActividadForm(prev => ({...prev, SOLUCION: val}))} 
                        className="text-slate-900 bg-white"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
                    <MacSelect label="Tipo de Equipo" value={actividadForm.TIPO} onChange={(v:any) => setActividadForm(prev => ({...prev, TIPO: v}))} options={unique(data.actividades, 'TIPO')} placeholder="Seleccione o escriba..." />
                    <MacSelect label="Marca del Equipo" value={actividadForm.MARCA} onChange={(v:any) => setActividadForm(prev => ({...prev, MARCA: v}))} options={unique(data.actividades, 'MARCA')} placeholder="Seleccione o escriba..." />
                    <MacSelect label="Modelo del Equipo" value={actividadForm.MODELO} onChange={(v:any) => setActividadForm(prev => ({...prev, MODELO: v}))} options={unique(data.actividades, 'MODELO')} placeholder="Seleccione o escriba..." />
                    <MacSelect label="Usuario del Equipo" value={actividadForm.USUARIO} onChange={(v:any) => setActividadForm(prev => ({...prev, USUARIO: v}))} options={unique(data.actividades, 'USUARIO')} placeholder="Seleccione o escriba..." />
                    <MacSelect label="Area de Ubicacion del Equipo" value={actividadForm.AREA} onChange={(v:any) => setActividadForm(prev => ({...prev, AREA: v}))} options={unique(data.actividades, 'AREA')} placeholder="Seleccione o escriba..." />
                    
                    <div className="flex flex-col mb-3">
                      <label className="text-xs font-bold text-slate-400 mb-1">Numero de Serie del Equipo</label>
                      <input type="text" value={actividadForm.SERIE} onChange={e => setActividadForm(prev => ({...prev, SERIE: e.target.value}))} className="w-full bg-slate-800/80 border border-slate-700/50 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 shadow-inner" />
                    </div>

                    <div className="flex flex-col mb-3">
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-bold text-slate-400">Celular</label>
                        <span className="text-[10px] text-amber-400/90 font-medium tracking-wide">
                          (OBLIGATORIO PARA SOLICITAR FIRMA)
                        </span>
                      </div>
                      <input 
                        type="text" 
                        value={actividadForm.CELULAR || ''} 
                        onChange={e => setActividadForm(prev => ({...prev, CELULAR: e.target.value}))} 
                        placeholder="Celular del usuario (ej. 929822708)..."
                        className="w-full bg-slate-800/80 border border-slate-700/50 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 shadow-inner" 
                      />
                    </div>
                  </div>

                  {actividadForm.TE && (
                    <p className="text-emerald-400 font-bold text-sm mt-2">Tiempo Estimado (TE): {actividadForm.TE}</p>
                  )}

                  {/* Fotos */}
                  <div className="mt-4">
                    <label className="text-xs font-bold text-slate-400 mb-2 block">Fotos de la Actividad (Max 4)</label>
                    <div className="grid grid-cols-4 gap-2 sm:gap-4">
                      {[0, 1, 2, 3].map(i => (
                        <div key={i} className="relative aspect-square border-2 border-dashed border-slate-600 rounded-lg overflow-hidden flex flex-col items-center justify-center bg-slate-800/50 hover:bg-slate-800 transition-colors cursor-pointer group"
                             onClick={() => fileInputRefs[i].current?.click()}>
                          <input type="file" accept="image/*" className="hidden" ref={fileInputRefs[i]} capture="environment" onChange={(e) => {
                            if (e.target.files?.[0]) {
                              const newPhotos = [...actPhotos];
                              newPhotos[i] = e.target.files[0];
                              setActPhotos(newPhotos);
                            }
                          }} />
                          
                          {actPhotos[i] ? (
                            <img referrerPolicy="no-referrer" src={URL.createObjectURL(actPhotos[i]!)} className="absolute inset-0 w-full h-full object-cover" alt="" />
                          ) : actPhotosUrls[i] ? (
                            <img referrerPolicy="no-referrer" src={actPhotosUrls[i]} className="absolute inset-0 w-full h-full object-cover" alt="" />
                          ) : (
                            <>
                              <Camera className="w-6 h-6 text-slate-500 group-hover:text-slate-400 mb-1" />
                              <span className="text-[10px] text-slate-500 font-bold">Añadir</span>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="mt-6 flex flex-col gap-2">
                    <div className="flex flex-wrap gap-3 items-center">
                      <button 
                        type="button"
                        onClick={handleSaveActividad} 
                        disabled={savingActividad}
                        className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-bold shadow-lg shadow-emerald-500/20 transition-transform active:scale-95 flex items-center gap-2"
                      >
                        {savingActividad ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin text-white" />
                            <span>Guardando en Google Sheets...</span>
                          </>
                        ) : (
                          <>
                            <Check className="w-4 h-4" />
                            <span>{isEditingAct ? 'Actualizar Actividad' : 'Guardar Actividad'}</span>
                          </>
                        )}
                      </button>
                      <button 
                        onClick={() => { 
                          setActividadForm({...initialAct, FHINICIO: getNowStr()}); 
                          setIsEditingAct(false); 
                          setActPhotosUrls(['','','','']); 
                          setActPhotos([null,null,null,null]); 
                        }} 
                        className="px-6 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm font-bold transition-transform active:scale-95"
                      >
                        Agregar otra Actividad
                      </button>
                      {isEditingAct && (
                        <button
                          type="button"
                          onClick={() => handleDeleteActividad(actividadForm)}
                          disabled={savingActividad || isDeletingAct}
                          className="px-4 py-2 bg-red-600/20 hover:bg-red-600/30 border border-red-500/40 text-red-300 rounded-lg text-sm font-bold transition-transform active:scale-95 flex items-center gap-1.5"
                        >
                          <Trash2 className="w-4 h-4" />
                          <span>Eliminar esta Actividad</span>
                        </button>
                      )}
                    </div>
                    {actSuccessMessage && (
                      <div className={`p-2.5 rounded-lg text-xs font-semibold flex items-center gap-2 ${
                        savingActividad ? 'bg-blue-500/15 border border-blue-500/30 text-blue-300' : 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-300'
                      }`}>
                        {savingActividad ? (
                          <Loader2 className="w-4 h-4 animate-spin text-blue-400 shrink-0" />
                        ) : (
                          <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                        )}
                        <span>{actSuccessMessage}</span>
                      </div>
                    )}
                  </div>
                </div>

              </div>

              {/* REPUESTOS GROUP */}
              <div className="bg-cyan-500/5 border border-cyan-500/50 rounded-xl p-4 shadow-sm">
                <h3 className="text-cyan-400 font-bold uppercase text-xs mb-4 tracking-wider flex items-center gap-2">
                  <Wrench className="w-4 h-4" /> Repuestos
                </h3>
                <div className="flex flex-col sm:flex-row gap-3 mb-4">
                  <input type="text" placeholder="Cantidad" value={repuestoForm.CANTIDAD} onChange={e => setRepuestoForm(prev => ({...prev, CANTIDAD: e.target.value}))} className="w-full sm:w-24 bg-slate-900/80 border border-slate-700/50 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
                  <input type="text" placeholder="Descripción" value={repuestoForm.DESCRIPCION} onChange={e => setRepuestoForm(prev => ({...prev, DESCRIPCION: e.target.value}))} className="flex-1 bg-slate-900/80 border border-slate-700/50 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
                  <button onClick={handleSaveRepuesto} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm font-bold transition-colors">Añadir</button>
                </div>
                <div className="flex flex-col gap-2">
                  {localRepuestos.length === 0 ? <p className="text-slate-500 text-sm">-</p> : localRepuestos.map((r, i) => (
                    <div key={i} className="flex gap-4 text-sm bg-slate-900/50 p-2 rounded-lg border border-slate-800">
                      <span className="text-emerald-400 font-bold w-12 text-center">{r.CANTIDAD || '-'}</span>
                      <span className="text-white">{r.DESCRIPCION || '-'}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* OBSERVACIONES GROUP */}
              <div className="bg-yellow-500/5 border border-yellow-500/50 rounded-xl p-4 shadow-sm">
                <h3 className="text-yellow-400 font-bold uppercase text-xs mb-3 tracking-wider flex items-center gap-2">
                  <PenTool className="w-4 h-4" /> Observaciones del Ticket
                </h3>
                <textarea 
                  rows={3} 
                  value={observaciones}
                  onChange={e => setObservaciones(e.target.value)}
                  placeholder="Ingrese observaciones generales..."
                  className="w-full bg-slate-900/80 border border-[#ce93d8]/20 text-white rounded-lg p-3 text-sm focus:outline-none focus:border-[#ce93d8] resize-none"
                />
              </div>

              {/* FIRMAS GROUP */}
              <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-4 shadow-sm mt-4">
                <h3 className="text-slate-300 font-bold uppercase text-xs mb-4 tracking-wider flex items-center gap-2">
                  <PenTool className="w-4 h-4" /> Firmas
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  {/* FIRMA CLIENTE */}
                  <div className="flex flex-col items-center">
                    {(() => {
                      const hasValidFirma = Boolean(localTicket.FIRMA && localTicket.FIRMA.trim() && localTicket.FIRMA.trim() !== '-' && localTicket.FIRMA.trim() !== 'null');
                      const publicSignUrl = buildPublicSignUrl(
                        localTicket.IDTICKET, 
                        localTicket.CLIENTE, 
                        usuarioFirma, 
                        getStoredAccessToken() || undefined, 
                        localTicket._rowIndex
                      );

                      return (
                        <>
                          <div 
                            className={`w-full h-40 bg-white rounded-lg border-2 ${hasValidFirma ? 'border-slate-400' : 'border-dashed border-blue-400 cursor-pointer hover:bg-slate-50'} flex items-center justify-center overflow-hidden relative transition-colors`}
                            onClick={() => !hasValidFirma && setShowSignature(true)}
                          >
                            {hasValidFirma ? (
                              <AuthenticatedImage src={localTicket.FIRMA} referrerPolicy="no-referrer" alt="Firma Cliente" className="w-full h-full object-contain" />
                            ) : (
                              <div className="text-blue-500 text-sm flex flex-col items-center gap-2 p-2 text-center">
                                <PenTool className="w-6 h-6" />
                                <span className="font-bold uppercase text-xs tracking-wider">Tocar para firmar en pantalla</span>
                                <span className="text-[10px] text-slate-400">O use los botones inferiores para enviar por WhatsApp</span>
                              </div>
                            )}
                          </div>
                          <div className="mt-3 text-center w-full border-t border-slate-600/50 pt-2">
                            <p className="text-white font-bold text-sm uppercase">{localActividades.length > 0 ? localActividades[0].USUARIO || 'Usuario' : 'Usuario'}</p>
                            <p className="text-slate-400 text-[10px] tracking-wider uppercase mb-2">FIRMA (USUARIO)</p>
                            {!hasValidFirma ? (
                              <div className="flex flex-wrap gap-2 justify-center mt-2">
                                <button 
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); setShowSignature(true); }} 
                                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-lg shadow-blue-600/20 active:scale-95"
                                >
                                  <PenTool className="w-4 h-4" /> FIRMAR EN PANTALLA
                                </button>
                                <button 
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); handleOpenSolicitarFirma(); }} 
                                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-lg shadow-emerald-600/20 active:scale-95"
                                >
                                  <MessageSquare className="w-4 h-4" /> SOLICITAR POR WHATSAPP
                                </button>
                              </div>
                            ) : (
                              <div className="flex flex-wrap gap-2 justify-center mt-2">
                                <button 
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); setShowSignature(true); }} 
                                  className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded text-xs font-medium transition-colors flex items-center gap-1"
                                >
                                  <PenTool className="w-3 h-3" /> Re-firmar en Pantalla
                                </button>
                                <button 
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); handleOpenSolicitarFirma(); }} 
                                  className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded text-xs font-medium transition-colors flex items-center gap-1"
                                >
                                  <MessageSquare className="w-3 h-3 text-emerald-400" /> Re-solicitar por WhatsApp
                                </button>
                              </div>
                            )}
                          </div>
                        </>
                      );
                    })()}
                  </div>

                  {/* FIRMATECH */}
                  <div className="flex flex-col items-center">
                    <div className="w-full h-40 bg-white rounded-lg border-2 border-slate-400 flex items-center justify-center overflow-hidden relative">
                      {(() => {
                        const match = data.tecnicos.find(t => t.NOMBRE?.trim().toLowerCase() === localTicket.TECNICO?.trim().toLowerCase());
                        const firmaUrl = localTicket.FIRMATECH || match?.FIRMATECH;
                        if (firmaUrl) {
                           return <AuthenticatedImage src={firmaUrl} referrerPolicy="no-referrer" alt="Firma Técnico" className="w-full h-full object-contain" />;
                        } else {
                           return <span className="text-slate-400 text-xs font-bold tracking-wider text-center uppercase">FIRMATECH no registrada</span>;
                        }
                      })()}
                    </div>
                    <div className="mt-3 text-center w-full border-t border-slate-600/50 pt-2">
                      <p className="text-white font-bold text-sm uppercase">{localTicket.TECNICO || 'Técnico'}</p>
                      <p className="text-slate-400 text-[10px] tracking-wider uppercase">FIRMATECH (TÉCNICO)</p>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* CERRADO VIEW (Readonly Service Guide with Zoom and Auto-Fit for Mobile) */}
          {isTicketCerrado && (() => {
            let totalMins = 0;
            localActividades.forEach(a => {
              if (a.TE) {
                const [h,m] = a.TE.split(':');
                totalMins += (parseInt(h) || 0) * 60 + (parseInt(m) || 0);
              }
            });
            const sumTe = `${Math.floor(totalMins/60).toString().padStart(2, '0')}:${(totalMins%60).toString().padStart(2, '0')}`;

            const ticketFotos = data.fotosTicket?.filter(f => (f.IDTICKET || '').trim().toUpperCase() === (localTicket.IDTICKET || '').trim().toUpperCase()) || [];
            const actIds = localActividades.map(a => (a.IDACTIVIDADES || '').trim().toUpperCase());
            const actFotos = data.fotosAct?.filter(f => actIds.includes((f.IDACTIVIDADES || '').trim().toUpperCase())) || [];

            return (
              <div ref={pagesContainerRef} className="flex flex-col items-center pb-24 sm:pb-16 w-full min-w-min">
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
                          setScale(prev => Math.min(1.5, Number((prev + 0.1).toFixed(2))));
                        }}
                        className="p-1.5 hover:bg-slate-800 text-slate-300 hover:text-white rounded transition-colors"
                        title="Acercar (Zoom In)"
                      >
                        <ZoomIn className="w-4 h-4" />
                      </button>

                      <div className="h-4 w-[1px] bg-slate-800 mx-0.5"></div>

                      <button
                        type="button"
                        onClick={() => setIsAutoFit(true)}
                        className={`px-2 py-1 text-[11px] font-bold rounded transition-colors flex items-center gap-1 ${
                          isAutoFit 
                            ? 'bg-blue-600/30 text-blue-400 border border-blue-500/40' 
                            : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                        }`}
                        title="Ajustar automáticamente al ancho de la pantalla"
                      >
                        <Maximize2 className="w-3.5 h-3.5" />
                        <span className="hidden xs:inline">Ajustar</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setIsAutoFit(false);
                          setScale(1);
                        }}
                        className={`px-2 py-1 text-[11px] font-bold rounded transition-colors ${
                          scale === 1 && !isAutoFit
                            ? 'bg-slate-700 text-white' 
                            : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                        }`}
                        title="Tamaño real (100%)"
                      >
                        100%
                      </button>
                    </div>

                    {/* PDF Download Button */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={handleDownloadPDF}
                        disabled={isExportingPDF}
                        className="inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white rounded-lg font-bold text-xs sm:text-sm transition-all shadow disabled:opacity-50"
                        title="Crear PDF de la guía, descargarlo y guardarlo en la carpeta de Google Drive"
                      >
                        <Download className="w-4 h-4" />
                        <span>{isExportingPDF ? 'Generando...' : 'Bajar a PDF'}</span>
                      </button>
                    </div>
                  </div>
                  {pdfSuccessMessage && (
                    <div className="mt-2 p-3 bg-emerald-500/20 border border-emerald-500/40 rounded-xl flex items-center gap-2 text-emerald-300 text-xs font-bold shadow-lg animate-in fade-in duration-300">
                      <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>{pdfSuccessMessage}</span>
                    </div>
                  )}
                </div>

                {/* GUIA DE SERVICIO WITH DYNAMIC PAGINATION & PHOTO ANNEXES */}
                <div className="w-full flex flex-col items-center">
                  <GuiaDocumentPages
                    ticket={localTicket}
                    data={data}
                    actividades={localActividades}
                    repuestos={localRepuestos}
                    fotosTicket={ticketFotos}
                    fotosAct={actFotos}
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
              </div>
            );
          })()}
        </div>

        {/* Action Footer (Sticky - only show for active tickets) */}
        {!isTicketCerrado && (
          <div className="p-4 border-t border-slate-800 bg-slate-900/90 backdrop-blur-md shrink-0 flex flex-col gap-3">
            
            {localTicket.ESTADO === 'EN ATENCION' && localTicket.FIRMA ? (
               <button onClick={handleCerrarTicket} disabled={loading} className="w-full py-4 mt-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-lg shadow-xl transition-transform active:scale-95">
                  CERRAR
               </button>
            ) : localTicket.ESTADO === 'EN ATENCION' ? (
               <>
                  {!showSaveOptions && !showCerrarOptions && (
                    <button onClick={handleGuardarDatosTicket} disabled={loading} className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-lg shadow-xl shadow-blue-500/20 transition-transform active:scale-95">
                      GUARDAR DATOS DEL TICKET
                    </button>
                  )}

                  {showSaveOptions && !showCerrarOptions && (
                    <div className="flex gap-3">
                      <button onClick={handlePasarAPendiente} disabled={loading} className="flex-1 py-4 bg-amber-600 hover:bg-amber-500 text-white rounded-xl font-bold shadow-lg transition-transform active:scale-95">
                        PENDIENTE
                      </button>
                      <button onClick={() => setShowCerrarOptions(true)} disabled={loading} className="flex-1 py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold shadow-lg transition-transform active:scale-95">
                        FIRMAR TICKET
                      </button>
                    </div>
                  )}

                  {showCerrarOptions && (
                    <div className="w-full flex flex-col gap-3">
                      <div className="flex gap-3">
                        <button onClick={() => setShowSignature(true)} disabled={loading} className="flex-1 py-4 bg-blue-600 hover:bg-blue-500 text-white border border-blue-500/50 rounded-xl font-bold transition-colors shadow-lg shadow-blue-500/20 active:scale-95 flex items-center justify-center gap-2">
                          <PenTool className="w-5 h-5" /> FIRMAR EN PANTALLA
                        </button>
                        <button onClick={handleOpenSolicitarFirma} disabled={loading} className="flex-1 py-4 bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-500/50 rounded-xl font-bold transition-colors shadow-lg shadow-emerald-500/20 active:scale-95 flex items-center justify-center gap-2">
                          <MessageSquare className="w-5 h-5" /> SOLICITAR POR WHATSAPP
                        </button>
                      </div>
                      <button onClick={() => setShowCerrarOptions(false)} className="w-full py-2 text-slate-400 hover:text-white font-bold text-sm">
                        Cancelar
                      </button>
                    </div>
                  )}
               </>
            ) : isTicketPendiente ? (
               <div className="w-full">
                 {!localTicket.FIRMA ? (
                   <button 
                     type="button"
                     onClick={handlePasarAAtencion} 
                     disabled={loading} 
                     className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-base sm:text-lg shadow-xl shadow-blue-500/25 transition-transform active:scale-95 flex items-center justify-center gap-2"
                   >
                     <Play className="w-5 h-5" />
                     <span>PASAR A ATENCION</span>
                   </button>
                 ) : (
                   <button 
                     type="button"
                     onClick={handleCerrarTicket} 
                     disabled={loading} 
                     className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-base sm:text-lg shadow-xl shadow-emerald-500/25 transition-transform active:scale-95 flex items-center justify-center gap-2"
                   >
                     <CheckCircle className="w-5 h-5" />
                     <span>CERRAR</span>
                   </button>
                 )}
               </div>
            ) : null}
          </div>
        )}


        {/* Overlays */}
        {showEnviarNotificacion && (
          <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4">
            <div className="bg-slate-900 rounded-3xl p-6 border border-slate-700 w-full max-w-md shadow-2xl space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                  <MessageSquare className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-white font-bold text-base">Notificar Guía por WhatsApp</h3>
                  <p className="text-xs text-slate-400">Enviar reporte PDF al contacto del ticket.</p>
                </div>
              </div>
              
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-bold text-slate-300 mb-1 block">Contacto / Destinatario</label>
                  <input 
                    type="text"
                    placeholder="Nombre del cliente"
                    value={destinatarioNotificacion}
                    onChange={e => setDestinatarioNotificacion(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-300 mb-1 block">Celular / Teléfono WhatsApp</label>
                  <input 
                    type="text"
                    placeholder="Ej. 987654321"
                    value={telefonoNotificacion}
                    onChange={e => setTelefonoNotificacion(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Ruta / Enlace directo del PDF:</span>
                    </label>
                    {localTicket.PDF && (
                      <a href={localTicket.PDF} target="_blank" rel="noreferrer" className="text-emerald-400 hover:text-emerald-300 text-[11px] font-bold">
                        Abrir PDF ↗
                      </a>
                    )}
                  </div>
                  <div className="p-2.5 bg-slate-950/80 rounded-xl border border-slate-800 text-xs text-emerald-300 font-mono break-all">
                    {localTicket.PDF || 'Generando / pendiente de subida a Drive...'}
                  </div>
                </div>
              </div>

              <div className="bg-slate-950/80 rounded-2xl p-3.5 border border-slate-800">
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-[10px] uppercase font-bold text-slate-400">Vista previa del mensaje WhatsApp</p>
                  <button
                    type="button"
                    onClick={() => {
                      const clienteClean = (localTicket.CLIENTE || 'CLIENTE').trim().replace(/[/\\?%*:|"<>]/g, '_');
                      const ticketClean = (localTicket.IDTICKET || 'TICKET').trim().replace(/[/\\?%*:|"<>]/g, '_');
                      const expectedFileName = `${clienteClean}-${ticketClean}.pdf`;
                      const msg = `📋 *GUÍA DE SERVICIO TÉCNICO - TICKET CERRADO*\n----------------------------------------\nEstimado(a) *${destinatarioNotificacion || localTicket.CONTACTO || 'Cliente'}*,\n\nLe informamos que se ha completado y cerrado la atención técnica de su requerimiento:\n\n🎫 *N° Ticket:* ${localTicket.IDTICKET}\n🏢 *Cliente / Empresa:* ${localTicket.CLIENTE}\n${localTicket.TECNICO ? `👨‍🔧 *Técnico Responsable:* ${localTicket.TECNICO}\n` : ''}${localTicket['FECHA DE CIERRE'] ? `📅 *Fecha de Cierre:* ${localTicket['FECHA DE CIERRE']}\n` : ''}\n📄 *Archivo Guía:* ${expectedFileName}\n📥 *Enlace para Descargar la Guía de Servicio (PDF):*\n${localTicket.PDF || 'Enlace directo del PDF'}\n\n⚠️ *AVISO IMPORTANTE DE DESCARGA:*\n_El archivo PDF (${expectedFileName}) se mantendrá disponible en el contenedor en la nube durante *1 mes* a partir de la fecha de cierre. Le recomendamos descargarlo y guardarlo en sus registros locales._\n\n----------------------------------------\n_Agradecemos su preferencia y valiosa colaboración._`;
                      navigator.clipboard.writeText(msg);
                      setCopiedNotifMsg(true);
                      setTimeout(() => setCopiedNotifMsg(false), 2000);
                    }}
                    className="text-[10px] text-emerald-400 hover:text-emerald-300 font-semibold"
                  >
                    {copiedNotifMsg ? '¡Copiado!' : 'Copiar texto'}
                  </button>
                </div>
                <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800 text-[11px] text-slate-300 font-sans whitespace-pre-line leading-relaxed max-h-40 overflow-y-auto custom-scrollbar">
                  {`📋 *GUÍA DE SERVICIO TÉCNICO - TICKET CERRADO*\nEstimado(a) *${destinatarioNotificacion || localTicket.CONTACTO || 'Cliente'}*,\n\n🎫 Ticket: ${localTicket.IDTICKET} - ${localTicket.CLIENTE}\n📄 Archivo: ${(localTicket.CLIENTE || 'CLIENTE').trim().replace(/[/\\?%*:|"<>]/g, '_')}-${(localTicket.IDTICKET || 'TICKET').trim().replace(/[/\\?%*:|"<>]/g, '_')}.pdf\n📥 Enlace directo del PDF:\n${localTicket.PDF || 'Enlace se generará automáticamente al enviar'}\n\n⚠️ Almacenamiento temporal: El PDF estará disponible 1 mes en la nube.`}
                </div>
              </div>

              <div className="flex gap-2 justify-end pt-2">
                <button 
                  onClick={() => setShowEnviarNotificacion(false)} 
                  className="px-4 py-2 text-slate-400 font-bold hover:text-white text-xs rounded-xl hover:bg-slate-800 transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  onClick={handleEnviarNotificacion} 
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-lg shadow-emerald-900/30 flex items-center gap-2"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Enviar por WhatsApp</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {showPendienteModal && (
          <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4">
            <div className="bg-slate-900 rounded-3xl p-6 border border-slate-700 w-full max-w-md shadow-2xl space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                  <MessageSquare className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-white font-bold text-base">Pasar a Pendiente</h3>
                  <p className="text-xs text-slate-400">Registre el motivo y envíe notificación por WhatsApp.</p>
                </div>
              </div>
              
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-bold text-slate-300 mb-1 block">Nombre del contacto</label>
                  <input 
                    type="text"
                    placeholder="Nombre del cliente"
                    value={pendienteNombre}
                    onChange={e => setPendienteNombre(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-300 mb-1 block">Número de WhatsApp</label>
                  <input 
                    type="tel"
                    placeholder="Ej. 999888777"
                    value={pendienteCelular}
                    onChange={e => setPendienteCelular(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2.5 text-sm font-mono focus:outline-none focus:border-amber-500"
                  />
                </div>
                
                <div>
                  <label className="text-xs font-bold text-slate-300 mb-1 block">MOTIVO POR EL CUAL PASA A PENDIENTE</label>
                  <textarea 
                    rows={4}
                    value={pendienteMotivo}
                    onChange={e => setPendienteMotivo(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-amber-500"
                    placeholder="Escriba el mensaje que se enviará por WhatsApp..."
                  />
                </div>
              </div>

              <div className="flex gap-2 justify-end pt-2">
                <button 
                  onClick={() => setShowPendienteModal(false)} 
                  disabled={loading}
                  className="px-4 py-2 text-slate-400 font-bold hover:text-white text-xs rounded-xl hover:bg-slate-800 transition-colors disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button 
                  onClick={handleConfirmarPendiente} 
                  disabled={loading || !pendienteMotivo.trim()}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-500 active:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-lg shadow-amber-900/30 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  <span>Pasar a Pendiente</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal de confirmación para eliminar actividad */}
        {activityToDelete && (
          <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4">
            <div className="bg-slate-900 rounded-3xl p-6 border border-red-500/40 w-full max-w-md shadow-2xl space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400 shrink-0">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-white font-bold text-base">¿Eliminar Actividad?</h3>
                  <p className="text-xs text-slate-400">Esta acción se sincronizará con Google Sheets y no se puede deshacer.</p>
                </div>
              </div>

              <div className="bg-slate-800/60 rounded-xl p-3 border border-slate-700/60 space-y-2 text-xs">
                <div className="flex justify-between items-center text-slate-300">
                  <span className="font-semibold text-slate-400">ID Actividad:</span>
                  <span className="font-mono font-bold text-amber-400">{activityToDelete.IDACTIVIDADES || 'Sin ID'}</span>
                </div>
                <div className="flex justify-between items-center text-slate-300">
                  <span className="font-semibold text-slate-400">Tipo / Marca:</span>
                  <span className="text-white font-medium">{activityToDelete.TIPO || 'Sin Tipo'} - {activityToDelete.MARCA || '-'}</span>
                </div>
                <div className="flex justify-between items-center text-slate-300">
                  <span className="font-semibold text-slate-400">Horario:</span>
                  <span className="text-slate-300">{activityToDelete.FHINICIO || '-'} a {activityToDelete.FHFIN || '-'}</span>
                </div>
                {activityToDelete.SOLUCION && (
                  <div className="pt-1 border-t border-slate-700/50">
                    <span className="text-slate-400 font-semibold block mb-0.5">Solución:</span>
                    <div 
                      className="text-slate-300 line-clamp-2 italic"
                      dangerouslySetInnerHTML={{ __html: activityToDelete.SOLUCION.replace(/<[^>]*>?/gm, ' ').slice(0, 120) }}
                    />
                  </div>
                )}
              </div>

              <div className="flex gap-2 justify-end pt-2">
                <button 
                  type="button"
                  onClick={() => setActivityToDelete(null)} 
                  disabled={isDeletingAct}
                  className="px-4 py-2 text-slate-400 font-bold hover:text-white text-xs rounded-xl hover:bg-slate-800 transition-colors disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button 
                  type="button"
                  onClick={confirmDeleteActividad} 
                  disabled={isDeletingAct}
                  className="px-4 py-2 bg-red-600 hover:bg-red-500 active:bg-red-700 text-white rounded-xl text-xs font-bold shadow-lg shadow-red-900/30 flex items-center gap-2 disabled:opacity-50"
                >
                  {isDeletingAct ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                  <span>{isDeletingAct ? 'Eliminando...' : 'Sí, Eliminar'}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {showSignature && (
          <SignaturePad onSave={(dataUrl) => handleSaveSignature(dataUrl)} onCancel={() => setShowSignature(false)} />
        )}

        {showSolicitarFirma && (() => {
          const cleanPhone = cleanPhoneNumber(celularFirma);
          const signUrl = buildPublicSignUrl(
            localTicket.IDTICKET, 
            localTicket.CLIENTE, 
            usuarioFirma, 
            getStoredAccessToken() || undefined, 
            localTicket._rowIndex
          );
          const nombre = usuarioFirma.trim() || 'Estimado(a) Cliente';

          const defaultMessage = 
            `👋 *SOLICITUD DE APROBACIÓN Y CONFORMIDAD DE SERVICIO*\n` +
            `----------------------------------------\n` +
            `Estimado(a) *${nombre}*,\n\n` +
            `Le informamos que se ha completado la atención técnica de su requerimiento. Se necesita la aprobación del servicio para proceder a su cierre formal en nuestro sistema:\n\n` +
            `📋 *Datos del Servicio:*\n` +
            `• N° Ticket: ${localTicket.IDTICKET}\n` +
            `• Empresa / Cliente: ${localTicket.CLIENTE}\n` +
            `• Técnico Responsable: ${localTicket.TECNICO}\n` +
            (localTicket.TIPO ? `• Tipo de Servicio: ${localTicket.TIPO}\n` : '') +
            `\n` +
            `Por favor, ingrese al siguiente enlace público para revisar la información del ticket, el detalle de actividades realizadas y registrar su firma manual de conformidad:\n\n` +
            `👉 *Enlace para Firmar:*\n` +
            `${signUrl}\n\n` +
            `⏱️ _(Vigencia del enlace: 1 hora por seguridad)_\n\n` +
            `----------------------------------------\n` +
            `_Agradecemos su valiosa colaboración._`;

          const messageToShow = mensajeFirmaCustom !== null ? mensajeFirmaCustom : defaultMessage;
          const waUrl = cleanPhone ? `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(messageToShow)}` : '#';

          return (
            <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
              <div className="bg-slate-900 rounded-3xl p-5 sm:p-6 border border-slate-700 w-full max-w-lg shadow-2xl relative my-auto">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                    <MessageSquare className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-white font-bold text-base sm:text-lg">Solicitar Aprobación por WhatsApp</h3>
                    <p className="text-xs text-slate-400">
                      Informar al cliente que se necesita la aprobación del servicio para proceder a su cierre.
                    </p>
                  </div>
                </div>

                {solicitarError && (
                  <div className="mb-3 p-2.5 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-xs flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>{solicitarError}</span>
                  </div>
                )}

                {/* Estado de vigencia de Google y renovación */}
                <div className="mb-3.5">
                  {checkingToken ? (
                    <div className="p-2.5 bg-slate-800/80 border border-slate-700/60 rounded-xl text-slate-300 text-xs flex items-center gap-2">
                      <RefreshCw className="w-3.5 h-3.5 text-blue-400 animate-spin shrink-0" />
                      <span>Verificando vigencia de la credencial de Google...</span>
                    </div>
                  ) : tokenStatus && (!tokenStatus.valid || tokenStatus.minutesLeft <= 5) ? (
                    <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-xs space-y-2">
                      <div className="flex items-start gap-2 text-amber-300 font-semibold">
                        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                        <div>
                          <p>
                            {!tokenStatus.valid
                              ? 'La credencial de Google ha caducado (vigencia de 1 hora).'
                              : `La credencial vencerá pronto (~${tokenStatus.minutesLeft} min).`}
                          </p>
                          <p className="text-[11px] font-normal text-slate-300 mt-0.5">
                            Google limita la vigencia de los enlaces a 1 hora. Renueve la sesión ahora para otorgarle al cliente 60 minutos completos para firmar.
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={handleRenovarTokenGoogle}
                        disabled={renewingToken}
                        className="w-full py-2 px-3 bg-amber-500 hover:bg-amber-400 active:bg-amber-600 disabled:opacity-50 text-slate-950 font-bold rounded-xl flex items-center justify-center gap-2 text-xs transition-colors shadow-sm cursor-pointer"
                      >
                        {renewingToken ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                        <span>{renewingToken ? 'Renovando credencial...' : '🔄 Renovar Enlace a 1 Hora Completa'}</span>
                      </button>
                    </div>
                  ) : tokenStatus && tokenStatus.valid ? (
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 bg-slate-800/60 border border-slate-700/50 rounded-2xl text-xs">
                      <div className="flex items-center gap-2 text-emerald-400">
                        <Clock className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
                        <span className="text-[11px] text-slate-200">
                          Vigencia del enlace: <strong className="text-emerald-400 font-bold">~{tokenStatus.minutesLeft} min restantes</strong> (Seguridad Google)
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={handleRenovarTokenGoogle}
                        disabled={renewingToken}
                        className="text-[11px] text-blue-400 hover:text-blue-300 font-semibold flex items-center gap-1 hover:underline cursor-pointer disabled:opacity-50"
                        title="Reiniciar vigencia a 60 minutos completos"
                      >
                        {renewingToken ? <RefreshCw className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                        <span>Reiniciar a 60 min</span>
                      </button>
                    </div>
                  ) : null}
                </div>
                
                <div className="space-y-3.5">
                  {/* Grid Contacto y Teléfono (editables) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-bold text-slate-300 mb-1 flex items-center justify-between">
                        <span>CONTACTO (Nombre)</span>
                        <span className="text-[10px] text-emerald-400 font-normal">Editable</span>
                      </label>
                      <input 
                        type="text"
                        placeholder="Nombre del cliente o contacto..."
                        value={usuarioFirma}
                        onChange={e => {
                          const val = e.target.value;
                          setUsuarioFirma(val);
                          // Sincronizar reactivamente con el backend público
                          syncPublicTicketData(val, celularFirma);
                        }}
                        className="w-full bg-slate-800/90 border border-slate-700 text-white rounded-xl px-3 py-2.5 text-xs sm:text-sm focus:outline-none focus:border-emerald-500 shadow-inner"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-300 mb-1 flex items-center justify-between">
                        <span>TELÉFONO / CELULAR</span>
                        <span className="text-[10px] text-emerald-400 font-normal">Editable</span>
                      </label>
                      <input 
                        type="text"
                        placeholder="ej. 929822708 ó 51929822708"
                        value={celularFirma}
                        onChange={e => {
                          const val = e.target.value;
                          setCelularFirma(val);
                          if (solicitarError) setSolicitarError(null);
                          syncPublicTicketData(usuarioFirma, val);
                        }}
                        className="w-full bg-slate-800/90 border border-slate-700 text-white rounded-xl px-3 py-2.5 text-xs sm:text-sm focus:outline-none focus:border-emerald-500 shadow-inner"
                      />
                    </div>
                  </div>

                  {/* Cuerpo del Mensaje (editable) */}
                  <div className="bg-slate-800/40 rounded-2xl p-3.5 border border-slate-700/60 space-y-2">
                    <div className="flex justify-between items-center">
                      <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Cuerpo del Mensaje</span>
                      </label>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(signUrl);
                            setCopiedSignLink(true);
                            setTimeout(() => setCopiedSignLink(false), 2000);
                          }}
                          className="text-[11px] text-blue-400 hover:text-blue-300 flex items-center gap-1 font-semibold"
                        >
                          {copiedSignLink ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                          {copiedSignLink ? '¡Link copiado!' : 'Copiar link'}
                        </button>
                        <span className="text-slate-600">|</span>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(messageToShow);
                            setCopiedSignMsg(true);
                            setTimeout(() => setCopiedSignMsg(false), 2000);
                          }}
                          className="text-[11px] text-emerald-400 hover:text-emerald-300 flex items-center gap-1 font-semibold"
                        >
                          {copiedSignMsg ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                          {copiedSignMsg ? '¡Copiado!' : 'Copiar mensaje'}
                        </button>
                      </div>
                    </div>

                    <textarea
                      rows={6}
                      value={messageToShow}
                      onChange={(e) => setMensajeFirmaCustom(e.target.value)}
                      placeholder="Cuerpo del mensaje a enviar..."
                      className="w-full bg-slate-900 border border-slate-700/70 text-slate-200 rounded-xl p-3 text-xs leading-relaxed focus:outline-none focus:border-emerald-500 font-mono shadow-inner resize-y"
                    />

                    {/* Acceso público y estado */}
                    <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-[11px] text-slate-400 border-t border-slate-800">
                      <div className="flex items-center gap-1.5 text-slate-300">
                        <Globe className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span>Muestra ticket, actividades y canvas para firma manual.</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            syncPublicTicketData(usuarioFirma, celularFirma);
                            setShowInAppSignPreview(true);
                          }}
                          className="px-2.5 py-1 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/40 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
                        >
                          <ExternalLink className="w-3.5 h-3.5" /> Probar Lienzo Aquí
                        </button>
                        <a 
                          href={signUrl} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-blue-400 hover:text-blue-300 underline flex items-center gap-1 font-medium"
                        >
                          <ExternalLink className="w-3 h-3" /> Abrir enlace
                        </a>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Botones de acción */}
                <div className="mt-5 flex flex-wrap gap-2.5 justify-end items-center">
                  <button 
                    type="button"
                    onClick={() => setShowSolicitarFirma(false)} 
                    className="px-4 py-2.5 text-slate-400 font-bold hover:text-white text-xs sm:text-sm rounded-xl hover:bg-slate-800 transition-colors"
                  >
                    Cerrar
                  </button>

                  {cleanPhone ? (
                    <a
                      href={waUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => {
                        handleSolicitarFirma();
                        setShowSolicitarFirma(false);
                      }}
                      className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs sm:text-sm font-bold shadow-lg shadow-emerald-600/30 flex items-center gap-2 transition-transform active:scale-95"
                    >
                      <Send className="w-4 h-4" />
                      <span>Enviar por WhatsApp</span>
                    </a>
                  ) : (
                    <button 
                      type="button"
                      onClick={handleSolicitarFirma} 
                      className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs sm:text-sm font-bold shadow-lg shadow-emerald-600/30 flex items-center gap-2 transition-transform active:scale-95"
                    >
                      <Send className="w-4 h-4" />
                      <span>Enviar por WhatsApp</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })()}

        {/* MODAL / OVERLAY VISTA PREVIA DEL LIENZO PARA EL CLIENTE */}
        {showInAppSignPreview && (
          <div className="fixed inset-0 z-[220] bg-slate-950/90 backdrop-blur-md flex flex-col">
            <div className="bg-slate-900/90 border-b border-slate-800 px-4 py-3 flex items-center justify-between shrink-0 shadow-lg">
              <div className="flex items-center gap-2.5">
                <span className="text-xs bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2.5 py-0.5 rounded-full font-bold">
                  Vista Previa del Cliente
                </span>
                <span className="text-xs text-slate-300 hidden sm:inline">
                  Así verá exactamente el cliente la página al abrir el enlace público
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowInAppSignPreview(false)}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5"
              >
                <X className="w-4 h-4" /> Cerrar Vista Previa
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <ClientSignatureView 
                ticketId={localTicket.IDTICKET} 
                onFirmaGuardada={() => {
                  setShowInAppSignPreview(false);
                  setShowSolicitarFirma(false);
                  handleManualCheckSignature();
                }} 
              />
            </div>
          </div>
        )}

        {/* NOTIFICACIÓN FLOTANTE DE FIRMA */}
        {firmaNotification && (
          <div className="fixed top-4 right-4 z-[200] max-w-md animate-in slide-in-from-top-2 duration-300">
            <div className={`p-4 rounded-2xl shadow-2xl border flex items-start gap-3 ${
              firmaNotification.type === 'success' 
                ? 'bg-emerald-950/95 border-emerald-500/50 text-emerald-100'
                : firmaNotification.type === 'error'
                ? 'bg-rose-950/95 border-rose-500/50 text-rose-100'
                : 'bg-slate-900/95 border-blue-500/50 text-slate-100'
            }`}>
              <div className="mt-0.5 shrink-0">
                {firmaNotification.type === 'success' && <Check className="w-5 h-5 text-emerald-400" />}
                {firmaNotification.type === 'error' && <AlertTriangle className="w-5 h-5 text-rose-400" />}
                {firmaNotification.type === 'info' && <RefreshCw className="w-5 h-5 text-blue-400 animate-spin" />}
              </div>
              <div className="flex-1 text-xs">
                <p className="font-bold text-sm mb-0.5">
                  {firmaNotification.type === 'success' ? '¡Firma Registrada!' : firmaNotification.type === 'error' ? 'Aviso' : 'Comprobando Firma'}
                </p>
                <p className="opacity-90 leading-relaxed">{firmaNotification.message}</p>
              </div>
              <button 
                onClick={() => setFirmaNotification(null)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {loading && (
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm z-[200] flex flex-col items-center justify-center">
            <div className="animate-spin w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full mb-4"></div>
            <p className="text-white font-bold tracking-widest text-sm uppercase">Procesando...</p>
          </div>
        )}
        {isPolling && !localTicket.FIRMA && (
          <div className="fixed bottom-4 right-4 bg-slate-800/95 border border-emerald-500/50 shadow-2xl rounded-2xl p-4 flex items-center gap-3 z-[100] backdrop-blur-sm">
            <div className="animate-spin w-5 h-5 border-2 border-emerald-400 border-t-transparent rounded-full"></div>
            <div>
              <p className="text-white font-bold text-xs sm:text-sm">Esperando Firma del Cliente...</p>
              <p className="text-slate-400 text-[11px]">Sincronizando automáticamente con Google Drive cada 3s.</p>
            </div>
            <button
              onClick={handleManualCheckSignature}
              disabled={checkingSignature}
              className="ml-2 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1 shadow"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${checkingSignature ? 'animate-spin' : ''}`} />
              Comprobar
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
