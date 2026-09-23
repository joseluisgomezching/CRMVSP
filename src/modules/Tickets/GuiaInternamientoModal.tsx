import React, { useRef, useState, useEffect } from 'react';
import { 
  X, Printer, Download, Save, Eraser, CheckCircle2, 
  Building2, Phone, Mail, Clock, ShieldCheck, AlertCircle, 
  Camera, FileText, Send, Share2
} from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { LOGO_COTIZACION_URL, LOGO_COTIZACION_BACKUP_URL } from '../../lib/logoConstants';
import { AppData, Ticket, Internamiento } from '../../types';
import { createTicket, uploadImage, createFotoTicket, createInternamiento } from '../../lib/googleApi';
import { sanitizeHtml2CanvasClonedDoc, safeHtml2Canvas } from '../../lib/pdfHelper';
import TicketNotificacionesModal from './TicketNotificacionesModal';

const FOTOS_FOLDER_ID = '1Y0D-ZJ6ufLK6zuVxvp5vZjx7yq6hj_LV';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  nextId: string;
  form: {
    CLIENTE: string;
    DIRECCION: string;
    TELEFONO: string;
    CONTACTO: string;
    FHPROGRAMADA: string;
    PRIORIDAD: string;
    TIPO: string;
    PROBLEMA: string;
    TECNICO: string;
    'MODO DE ATENCION': string;
    'ACTIVIDAD DEL TICKET': string;
    OBSERVACIONES: string;
    'COMENTARIO DE FOTO': string;
    PREFIJO?: string;
  };
  photos: (File | null)[];
  photoPreviews: (string | null)[];
  data: AppData;
  onSavedTicketSuccess: () => void;
}

export default function GuiaInternamientoModal({
  isOpen,
  onClose,
  nextId,
  form,
  photos,
  photoPreviews,
  data,
  onSavedTicketSuccess
}: Props) {
  const a4Ref = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const [isDrawing, setIsDrawing] = useState(false);
  const [ctx, setCtx] = useState<CanvasRenderingContext2D | null>(null);
  const [hasSignature, setHasSignature] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [showNotificacionesModal, setShowNotificacionesModal] = useState(false);
  const [savedFhIngreso, setSavedFhIngreso] = useState('');

  // Match Empresa details (RUC, etc.)
  const selectedEmpresa = data.empresas.find(
    e => e.CLIENTE.toLowerCase().trim() === form.CLIENTE.toLowerCase().trim()
  );

  // Match Contacto email
  const selectedContacto = data.contactos.find(
    c => (c.EMPRESA?.toLowerCase().trim() === form.CLIENTE.toLowerCase().trim() ||
          c.NOMBRE?.toLowerCase().trim() === form.CONTACTO.toLowerCase().trim()) &&
         Boolean(c.CORREO)
  );

  // Setup signature canvas
  useEffect(() => {
    if (!isOpen) return;

    const timer = setTimeout(() => {
      const canvas = canvasRef.current;
      if (canvas) {
        const ratio = Math.max(window.devicePixelRatio || 1, 1);
        const parent = canvas.parentElement;
        if (parent) {
          canvas.width = parent.clientWidth * ratio;
          canvas.height = parent.clientHeight * ratio;
          canvas.style.width = `${parent.clientWidth}px`;
          canvas.style.height = `${parent.clientHeight}px`;
        }

        const context = canvas.getContext('2d');
        if (context) {
          context.scale(ratio, ratio);
          context.lineCap = 'round';
          context.lineJoin = 'round';
          context.strokeStyle = '#0f172a';
          context.lineWidth = 2.5;
          context.fillStyle = '#ffffff';
          context.fillRect(0, 0, canvas.width, canvas.height);
          setCtx(context);
        }
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [isOpen]);

  if (!isOpen) return null;

  // Drawing helpers
  const getCoordinates = (e: React.MouseEvent | React.TouchEvent | MouseEvent | TouchEvent) => {
    if (!canvasRef.current) return { x: 0, y: 0 };
    const rect = canvasRef.current.getBoundingClientRect();
    if ('touches' in e && e.touches.length > 0) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top
      };
    }
    return {
      x: (e as React.MouseEvent).clientX - rect.left,
      y: (e as React.MouseEvent).clientY - rect.top
    };
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    if (!ctx) return;
    const { x, y } = getCoordinates(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
    setHasSignature(true);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    if (!isDrawing || !ctx) return;
    const { x, y } = getCoordinates(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (ctx) ctx.closePath();
    setIsDrawing(false);
  };

  const clearSignature = () => {
    if (!ctx || !canvasRef.current) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    setHasSignature(false);
  };

  // Direct Print
  const handlePrint = () => {
    window.print();
  };

  // Export A4 PDF
  const handleDownloadPDF = async () => {
    if (!a4Ref.current) return;
    setIsExportingPDF(true);
    setErrorMessage(null);
    try {
      const element = a4Ref.current;
      const canvas = await safeHtml2Canvas(element, {
        scale: 2.2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.98);
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const imgWidth = 210;
      const pageHeight = 297;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      // If the content is within 1 page (with tolerance for borders/subpixel rounding), output single page cleanly
      if (imgHeight <= pageHeight + 15) {
        const renderHeight = Math.min(imgHeight, pageHeight);
        pdf.addImage(imgData, 'JPEG', 0, 0, imgWidth, renderHeight);
      } else {
        let heightLeft = imgHeight;
        let position = 0;

        pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;

        // Only create an additional page if there is substantial overflow (> 15mm)
        while (heightLeft > 15) {
          position -= pageHeight;
          pdf.addPage();
          pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
          heightLeft -= pageHeight;
        }
      }

      pdf.save(`Constancia_Internamiento_${nextId}.pdf`);
    } catch (err: any) {
      console.error('Error al generar PDF de internamiento:', err);
      setErrorMessage('No se pudo generar el archivo PDF automáticamente. Puedes usar la opción de Imprimir.');
    } finally {
      setIsExportingPDF(false);
    }
  };

  // Guardar Ticket + Subir Fotos + Crear Internamiento + Enviar WhatsApp & Correo
  const handleGuardarTicketCompleto = async () => {
    setIsSaving(true);
    setErrorMessage(null);

    try {
      const now = new Date();
      const fhIngreso = `${now.getDate().toString().padStart(2, '0')}/${(now.getMonth()+1).toString().padStart(2, '0')}/${now.getFullYear()} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
      
      const tecnico = data.tecnicos.find(t => t.NOMBRE === form.TECNICO);
      
      // Capture signature data URL if drawn
      const firmaClienteDataUrl = (canvasRef.current && hasSignature) 
        ? canvasRef.current.toDataURL('image/png') 
        : '';

      const ticketPayload: Partial<Ticket> = {
        IDTICKET: nextId,
        FHINGRESO: fhIngreso,
        ESTADO: 'ASIGNADO',
        NOTIFICA: 'PENDIENTE',
        NOTITEC: 'FALSE',
        NOTICLI: 'NO NOTIFICADO',
        FIRMATECH: tecnico ? tecnico.FIRMATECH : '',
        FIRMA: firmaClienteDataUrl ? 'FIRMA CAPTURADA' : '',
        ...form
      };

      // 1. Guardar en TICKET
      await createTicket(ticketPayload);

      // 2. Subir Fotos y registrar en FOTOSTICKET
      for (let i = 0; i < photos.length; i++) {
        const file = photos[i];
        if (file) {
          const fileName = `${nextId}-TICKET-${(i+1).toString().padStart(2, '0')}.jpg`;
          const photoUrl = await uploadImage(file, FOTOS_FOLDER_ID, fileName);
          const ftId = `FT-${Date.now().toString().slice(-4)}${i}`;
          await createFotoTicket(ftId, nextId, photoUrl);
        }
      }

      // 3. Crear registro en INTERNAMIENTO
      const internamientoPayload: Partial<Internamiento> = {
        ID: `INT-${nextId}`,
        IDTICKET: nextId,
        CLIENTE: form.CLIENTE,
        DIRECCION: form.DIRECCION,
        CONTACTO: form.CONTACTO,
        TELEFONO: form.TELEFONO,
        FHPROGRAMADA: form.FHPROGRAMADA || fhIngreso,
        ESTADO: 'INTERNADO',
        PRIORIDAD: form.PRIORIDAD,
        TIPO: form.TIPO,
        PROBLEMA: form.PROBLEMA,
        'DESCRIPCION DEL EQUIPO': form['ACTIVIDAD DEL TICKET'] || 'Equipo internado en laboratorio',
        ACCESORIOS: form['COMENTARIO DE FOTO'] || 'Sin accesorios adicionales especificados',
        OBSERVACIONES: form.OBSERVACIONES || '',
        'FIRMA DEL CLIENTE': firmaClienteDataUrl,
        'NOMBRE RECEPCIONISTA': form.TECNICO,
        'FIRMA DE RECEPCION': tecnico ? tecnico.FIRMATECH : ''
      };
      await createInternamiento(internamientoPayload);

      setSaveSuccess(true);
      setSavedFhIngreso(fhIngreso);
      setIsSaving(false);
      setShowNotificacionesModal(true);

    } catch (err: any) {
      console.error('Error al guardar ticket con internamiento:', err);
      setErrorMessage(err.message || 'Error al guardar el ticket con internamiento');
      setIsSaving(false);
    }
  };

  const currentDateFormatted = new Date().toLocaleDateString('es-PE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex flex-col items-center justify-start overflow-y-auto p-2 sm:p-4 md:p-6 custom-scrollbar">
      
      {/* BARRA SUPERIOR DE ACCIONES */}
      <div className="w-full max-w-[215mm] bg-slate-900 border border-slate-700/80 rounded-2xl p-4 mb-4 shadow-xl flex flex-wrap items-center justify-between gap-3 sticky top-2 z-20">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-500/20 text-indigo-400 rounded-xl border border-indigo-500/30">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-white text-sm sm:text-base flex items-center gap-2">
              CONSTANCIA DE INTERNAMIENTO
              <span className="font-mono text-xs px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30">
                {nextId}
              </span>
            </h3>
            <p className="text-xs text-slate-400">Modo: Laboratorio | Formato Hoja A4</p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Boton Imprimir */}
          <button
            type="button"
            onClick={handlePrint}
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 border border-slate-700"
            title="Imprimir formato A4"
          >
            <Printer className="w-4 h-4" />
            <span className="hidden sm:inline">Imprimir</span>
          </button>

          {/* Boton PDF */}
          <button
            type="button"
            onClick={handleDownloadPDF}
            disabled={isExportingPDF}
            className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 shadow-md shadow-indigo-600/20"
          >
            {isExportingPDF ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Generando...</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                <span>Descargar PDF</span>
              </>
            )}
          </button>

          {/* Boton Guardar Ticket Completo */}
          <button
            type="button"
            onClick={handleGuardarTicketCompleto}
            disabled={isSaving || saveSuccess}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-800 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-2 shadow-lg shadow-emerald-600/25"
          >
            {isSaving ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>GUARDANDO...</span>
              </>
            ) : saveSuccess ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-white" />
                <span>¡GUARDADO!</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>GUARDAR TICKET</span>
              </>
            )}
          </button>

          {/* Cerrar modal */}
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="p-2 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {errorMessage && (
        <div className="w-full max-w-[215mm] mb-3 p-3 bg-rose-950/80 border border-rose-500/50 text-rose-300 rounded-xl text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* DOCUMENTO HOJA A4 */}
      <div className="w-full flex justify-center pb-12">
        <div
          ref={a4Ref}
          id="hoja-a4-internamiento"
          className="w-[210mm] min-h-[297mm] shadow-2xl p-8 sm:p-10 flex flex-col justify-between relative font-sans"
          style={{ 
            boxSizing: 'border-box',
            backgroundColor: '#ffffff',
            color: '#0f172a',
            border: '1px solid #cbd5e1'
          }}
        >
          {/* HEADER DEL DOCUMENTO */}
          <div>
            <div 
              className="flex justify-between items-start pb-4"
              style={{ borderBottom: '2px solid #1e293b' }}
            >
              <div className="flex items-center gap-4">
                <img
                  src={LOGO_COTIZACION_URL}
                  crossOrigin="anonymous"
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    if (target.src !== LOGO_COTIZACION_BACKUP_URL) {
                      target.src = LOGO_COTIZACION_BACKUP_URL;
                    }
                  }}
                  alt="Logo Empresa"
                  className="h-16 w-auto max-w-[180px] object-contain"
                />
                <div>
                  <h1 className="text-lg font-black tracking-tight leading-tight" style={{ color: '#0f172a' }}>
                    SERVICIOS Y SOLUCIONES TECNOLÓGICAS
                  </h1>
                  <p className="text-[11px] font-medium mt-0.5" style={{ color: '#475569' }}>
                    Laboratorio de Soporte & Mantenimiento Especializado
                  </p>
                  <p className="text-[10px]" style={{ color: '#64748b' }}>
                    Atención Técnica Oficial | Recepción y Diagnóstico
                  </p>
                </div>
              </div>

              <div 
                className="rounded-xl p-3 text-right min-w-[200px]"
                style={{
                  border: '2px solid #0f172a',
                  backgroundColor: '#f8fafc'
                }}
              >
                <span className="block text-[10px] font-black uppercase tracking-wider" style={{ color: '#312e81' }}>
                  GUÍA / CONSTANCIA
                </span>
                <span className="block text-sm font-black mt-0.5" style={{ color: '#0f172a' }}>
                  DE INTERNAMIENTO
                </span>
                <div 
                  className="mt-1 pt-1 flex items-center justify-between"
                  style={{ borderTop: '1px solid #cbd5e1' }}
                >
                  <span className="text-[10px] font-bold" style={{ color: '#475569' }}>N° TICKET:</span>
                  <span className="text-xs font-mono font-black" style={{ color: '#4338ca' }}>{nextId}</span>
                </div>
                <div className="flex items-center justify-between text-[10px] mt-0.5" style={{ color: '#475569' }}>
                  <span>FECHA:</span>
                  <span className="font-mono font-bold" style={{ color: '#0f172a' }}>{currentDateFormatted}</span>
                </div>
              </div>
            </div>

            {/* AVISO MODO LABORATORIO */}
            <div 
              className="mt-3 rounded-lg px-3 py-1.5 flex items-center justify-between text-[11px]"
              style={{
                backgroundColor: '#eef2ff',
                border: '1px solid #c7d2fe'
              }}
            >
              <span className="font-bold flex items-center gap-1.5" style={{ color: '#1e1b4b' }}>
                <ShieldCheck className="w-4 h-4" style={{ color: '#4f46e5' }} />
                MODALIDAD: <strong className="uppercase font-black" style={{ color: '#4338ca' }}>LABORATORIO TÉCNICO</strong>
              </span>
              <span 
                className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded"
                style={{ backgroundColor: '#4f46e5', color: '#ffffff' }}
              >
                RECEPCIÓN EN CUSTODIA
              </span>
            </div>

            {/* SECCIÓN 1: DATOS DEL CLIENTE Y CONTACTO */}
            <div 
              className="mt-4 rounded-xl overflow-hidden"
              style={{ border: '1px solid #cbd5e1' }}
            >
              <div 
                className="px-3 py-1 text-[11px] font-bold uppercase tracking-wide flex justify-between items-center"
                style={{ backgroundColor: '#1e293b', color: '#ffffff' }}
              >
                <span>1. Información del Cliente y Entrega</span>
                <span className="text-[9px] font-normal" style={{ color: '#cbd5e1' }}>Datos del Solicitante</span>
              </div>
              <div 
                className="p-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs"
                style={{ backgroundColor: '#f8fafc' }}
              >
                <div>
                  <span className="text-[10px] font-bold uppercase block" style={{ color: '#64748b' }}>Empresa / Cliente:</span>
                  <span className="font-bold" style={{ color: '#0f172a' }}>{form.CLIENTE || '-'}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase block" style={{ color: '#64748b' }}>RUC / Identificación:</span>
                  <span className="font-semibold" style={{ color: '#1e293b' }}>{selectedEmpresa?.RUC || 'No registrado'}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase block" style={{ color: '#64748b' }}>Contacto Autorizado:</span>
                  <span className="font-bold" style={{ color: '#0f172a' }}>{form.CONTACTO || '-'}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase block" style={{ color: '#64748b' }}>Teléfono / Celular:</span>
                  <span className="font-mono font-semibold" style={{ color: '#1e293b' }}>{form.TELEFONO || '-'}</span>
                </div>
                <div className="col-span-2">
                  <span className="text-[10px] font-bold uppercase block" style={{ color: '#64748b' }}>Dirección / Sede:</span>
                  <span className="font-medium" style={{ color: '#1e293b' }}>{form.DIRECCION || 'Sede Principal'}</span>
                </div>
              </div>
            </div>

            {/* SECCIÓN 2: DATOS DEL SERVICIO E INTERNAMIENTO */}
            <div 
              className="mt-3 rounded-xl overflow-hidden"
              style={{ border: '1px solid #cbd5e1' }}
            >
              <div 
                className="px-3 py-1 text-[11px] font-bold uppercase tracking-wide flex justify-between items-center"
                style={{ backgroundColor: '#1e293b', color: '#ffffff' }}
              >
                <span>2. Parámetros del Servicio</span>
                <span className="text-[9px] font-normal" style={{ color: '#cbd5e1' }}>Asignación Técnica</span>
              </div>
              <div 
                className="p-3 grid grid-cols-4 gap-2 text-xs"
                style={{ backgroundColor: '#f8fafc' }}
              >
                <div>
                  <span className="text-[10px] font-bold uppercase block" style={{ color: '#64748b' }}>Tipo de Ticket:</span>
                  <span 
                    className="font-bold px-1.5 py-0.5 rounded inline-block text-[11px]"
                    style={{ backgroundColor: '#e2e8f0', color: '#0f172a' }}
                  >
                    {form.TIPO}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase block" style={{ color: '#64748b' }}>Prioridad:</span>
                  <span className="font-bold" style={{ color: '#0f172a' }}>{form.PRIORIDAD}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase block" style={{ color: '#64748b' }}>Técnico Receptor:</span>
                  <span className="font-bold" style={{ color: '#4338ca' }}>{form.TECNICO || 'Por asignar'}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase block" style={{ color: '#64748b' }}>Fecha Programada:</span>
                  <span className="font-mono text-[11px]" style={{ color: '#1e293b' }}>{form.FHPROGRAMADA || currentDateFormatted}</span>
                </div>
              </div>
            </div>

            {/* SECCIÓN 3: DETALLE DEL PROBLEMA Y ACTIVIDAD */}
            <div 
              className="mt-3 rounded-xl overflow-hidden"
              style={{ border: '1px solid #cbd5e1' }}
            >
              <div 
                className="px-3 py-1 text-[11px] font-bold uppercase tracking-wide"
                style={{ backgroundColor: '#1e293b', color: '#ffffff' }}
              >
                3. Motivo de Internamiento & Diagnóstico Preliminar
              </div>
              <div className="p-3 space-y-2 text-xs" style={{ backgroundColor: '#ffffff' }}>
                <div>
                  <span className="text-[10px] font-bold uppercase block" style={{ color: '#475569' }}>Problema / Falla Reportada por el Cliente:</span>
                  <p 
                    className="p-2 rounded-lg font-medium leading-relaxed mt-0.5"
                    style={{
                      backgroundColor: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      color: '#0f172a'
                    }}
                  >
                    {form.PROBLEMA || 'Sin descripción detallada especificada'}
                  </p>
                </div>
                {form['ACTIVIDAD DEL TICKET'] && (
                  <div>
                    <span className="text-[10px] font-bold uppercase block" style={{ color: '#475569' }}>Actividad / Tarea Solicitada:</span>
                    <p 
                      className="p-2 rounded-lg text-[11px]"
                      style={{
                        backgroundColor: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        color: '#1e293b'
                      }}
                    >
                      {form['ACTIVIDAD DEL TICKET']}
                    </p>
                  </div>
                )}
                {form.OBSERVACIONES && (
                  <div>
                    <span className="text-[10px] font-bold uppercase block" style={{ color: '#475569' }}>Observaciones Adicionales / Accesorios:</span>
                    <p 
                      className="p-2 rounded-lg text-[11px]"
                      style={{
                        backgroundColor: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        color: '#1e293b'
                      }}
                    >
                      {form.OBSERVACIONES}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* SECCIÓN 4: FOTOS ADJUNTAS */}
            {photoPreviews.some(p => p !== null) && (
              <div 
                className="mt-3 rounded-xl overflow-hidden"
                style={{ border: '1px solid #cbd5e1' }}
              >
                <div 
                  className="px-3 py-1 text-[11px] font-bold uppercase tracking-wide flex justify-between items-center"
                  style={{ backgroundColor: '#1e293b', color: '#ffffff' }}
                >
                  <span>4. Registro Fotográfico de Recepción</span>
                  <span className="text-[9px] font-normal" style={{ color: '#cbd5e1' }}>
                    {photoPreviews.filter(p => p !== null).length} fotografía(s)
                  </span>
                </div>
                <div className="p-3" style={{ backgroundColor: '#f8fafc' }}>
                  <div className="grid grid-cols-4 gap-2">
                    {photoPreviews.map((preview, i) => (
                      preview ? (
                        <div key={i} className="flex flex-col items-center">
                          <div 
                            className="w-full h-24 rounded-lg overflow-hidden flex items-center justify-center p-0.5 shadow-sm"
                            style={{
                              backgroundColor: '#ffffff',
                              border: '1px solid #cbd5e1'
                            }}
                          >
                            <img src={preview} alt={`Foto ${i+1}`} className="w-full h-full object-cover rounded" />
                          </div>
                          <span className="text-[9px] font-bold uppercase mt-1" style={{ color: '#475569' }}>FOTO {i+1}</span>
                        </div>
                      ) : null
                    ))}
                  </div>
                  {form['COMENTARIO DE FOTO'] && (
                    <p 
                      className="text-[10px] italic mt-2 pt-1"
                      style={{
                        color: '#475569',
                        borderTop: '1px solid #e2e8f0'
                      }}
                    >
                      <strong>Nota de fotos:</strong> {form['COMENTARIO DE FOTO']}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* TÉRMINOS Y CONDICIONES BREVES */}
            <div 
              className="mt-3 p-2 rounded-lg text-[9px] leading-tight"
              style={{
                backgroundColor: '#f1f5f9',
                border: '1px solid #e2e8f0',
                color: '#475569'
              }}
            >
              <span className="font-bold block mb-0.5 uppercase" style={{ color: '#0f172a' }}>Términos de Recepción en Laboratorio:</span>
              <p>
                1. El equipo se interna para revisión, diagnóstico y/o reparación técnica. 
                2. El cliente declara entregar el equipo en las condiciones descritas. La empresa no se responsabiliza por pérdida de información no respaldada previamente. 
                3. Para el retiro del equipo es indispensable la presentación de esta constancia firmada o autorización formal del contacto registrado.
              </p>
            </div>
          </div>

          {/* SECCIÓN DE FIRMAS (AL PIE DE LA HOJA A4) */}
          <div 
            className="mt-4 pt-3"
            style={{ borderTop: '2px solid #1e293b' }}
          >
            <div className="grid grid-cols-2 gap-6">
              
              {/* FIRMA DEL CONTACTO / CLIENTE CON CANVAS INTERACTIVO */}
              <div className="flex flex-col items-center">
                <div 
                  className="w-full rounded-xl p-2 relative"
                  style={{
                    border: '2px dashed #94a3b8',
                    backgroundColor: '#f8fafc'
                  }}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-bold uppercase" style={{ color: '#475569' }}>Firma del Cliente / Contacto</span>
                    <button
                      type="button"
                      onClick={clearSignature}
                      className="text-[9px] font-bold px-2 py-0.5 rounded shadow-xs flex items-center gap-1"
                      style={{
                        backgroundColor: '#ffffff',
                        color: '#e11d48',
                        border: '1px solid #fecdd3'
                      }}
                    >
                      <Eraser className="w-3 h-3" /> Limpiar
                    </button>
                  </div>
                  
                  {/* CANVAS DE FIRMA */}
                  <div 
                    className="w-full h-24 rounded-lg overflow-hidden relative shadow-inner"
                    style={{
                      backgroundColor: '#ffffff',
                      border: '1px solid #cbd5e1'
                    }}
                  >
                    <canvas
                      ref={canvasRef}
                      onMouseDown={startDrawing}
                      onMouseMove={draw}
                      onMouseUp={stopDrawing}
                      onMouseOut={stopDrawing}
                      onTouchStart={startDrawing}
                      onTouchMove={draw}
                      onTouchEnd={stopDrawing}
                      className="w-full h-full touch-none cursor-crosshair"
                    />
                    {!hasSignature && (
                      <div 
                        className="absolute inset-0 pointer-events-none flex items-center justify-center text-[10px] font-medium"
                        style={{ color: '#94a3b8' }}
                      >
                        Firme aquí con el dedo o mouse
                      </div>
                    )}
                  </div>
                </div>

                <div className="w-full text-center mt-1.5">
                  <span className="block text-xs font-bold" style={{ color: '#0f172a' }}>{form.CONTACTO || 'Firma de Conformidad'}</span>
                  <span className="block text-[10px] uppercase" style={{ color: '#64748b' }}>{form.CLIENTE || 'Contacto Autorizado'}</span>
                </div>
              </div>

              {/* FIRMA / RECEPCIÓN TÉCNICA */}
              <div className="flex flex-col items-center justify-between">
                <div 
                  className="w-full rounded-xl p-2 flex flex-col items-center justify-center min-h-[120px]"
                  style={{
                    border: '2px dashed #94a3b8',
                    backgroundColor: '#f8fafc'
                  }}
                >
                  <span className="text-[10px] font-bold uppercase mb-2" style={{ color: '#475569' }}>Recepción Laboratorio</span>
                  <div className="w-full h-16 flex flex-col items-center justify-center text-center">
                    <CheckCircle2 className="w-6 h-6 mb-1" style={{ color: '#059669' }} />
                    <span className="text-xs font-bold" style={{ color: '#0f172a' }}>{form.TECNICO || 'Recepción Técnica'}</span>
                    <span className="text-[9px] font-mono" style={{ color: '#64748b' }}>Modo: LABORATORIO</span>
                  </div>
                </div>

                <div className="w-full text-center mt-1.5">
                  <span className="block text-xs font-bold" style={{ color: '#0f172a' }}>{form.TECNICO || 'Área Técnica'}</span>
                  <span className="block text-[10px] uppercase" style={{ color: '#64748b' }}>Responsable de Recepción</span>
                </div>
              </div>

            </div>

            <div 
              className="mt-3 pt-2 text-center text-[9px] flex justify-between items-center"
              style={{
                borderTop: '1px solid #e2e8f0',
                color: '#94a3b8'
              }}
            >
              <span>Constancia emitida automáticamente por Sistema de Gestión Técnica</span>
              <span className="font-mono">{nextId} | {new Date().toISOString().slice(0, 10)}</span>
            </div>
          </div>

        </div>
      </div>

      {/* MODAL DE NOTIFICACIONES POST-CREACIÓN */}
      {showNotificacionesModal && (
        <TicketNotificacionesModal
          isOpen={showNotificacionesModal}
          onClose={() => {
            setShowNotificacionesModal(false);
            onSavedTicketSuccess();
            onClose();
          }}
          ticketId={nextId}
          form={{
            ...form,
            PREFIJO: form.PREFIJO || ''
          }}
          data={data}
          fhIngreso={savedFhIngreso}
        />
      )}

    </div>
  );
}
