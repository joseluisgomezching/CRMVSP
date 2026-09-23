import React from 'react';
import { createRoot } from 'react-dom/client';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { FileText } from 'lucide-react';
import { CABECERA_B64 } from './constants';
import { sanitizeHtml2CanvasClonedDoc, safeHtml2Canvas } from './pdfHelper';
import { Ticket, Actividad, Repuesto, FotoAct, AppData } from '../types';
import { uploadImage, updateTicket } from './googleApi';
import { getAccessToken } from '../serviceAccess';
import { AuthenticatedImage, extractDriveFileId } from '../components/AuthenticatedImage';

const chunkArray = <T,>(arr: T[], size: number): T[][] => {
  return Array.from({ length: Math.ceil(arr.length / size) }, (_, i) => arr.slice(i * size, i * size + size));
};

export const GUIAS_PDF_FOLDER_ID = '1nZKrXULwBYnjcfn9GiBjNvIZxHLyZsEs';

export async function resolveImageToBase64(src: string): Promise<string> {
  if (!src || typeof src !== 'string') return '';
  const trimmed = src.trim();
  if (!trimmed) return '';

  // 1. Already a data URL
  if (trimmed.startsWith('data:image/')) {
    return trimmed;
  }

  // 2. Raw base64 string without prefix
  if (!trimmed.startsWith('http') && !trimmed.startsWith('data:') && trimmed.length > 50) {
    return `data:image/png;base64,${trimmed}`;
  }

  // 3. Drive File ID or Drive URL
  const fileId = extractDriveFileId(trimmed);

  if (fileId) {
    try {
      const token = await getAccessToken();
      if (token) {
        const response = await fetch(`/api/google/drive/v3/files/${fileId}?alt=media`, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
        if (response.ok) {
          const blob = await response.blob();
          const base64 = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(typeof reader.result === 'string' ? reader.result : '');
            reader.onerror = () => resolve('');
            reader.readAsDataURL(blob);
          });
          if (base64) return base64;
        }
      }
    } catch (err) {
      console.warn(`Error fetching Drive image for PDF (${fileId}):`, err);
    }

    // Fallback: try thumbnail fetch
    try {
      const thumbUrl = `https://drive.google.com/thumbnail?id=${fileId}&sz=w1000`;
      const response = await fetch(thumbUrl, { mode: 'cors' });
      if (response.ok) {
        const blob = await response.blob();
        const base64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(typeof reader.result === 'string' ? reader.result : '');
          reader.onerror = () => resolve('');
          reader.readAsDataURL(blob);
        });
        if (base64) return base64;
      }
    } catch {
      // ignore
    }
  }

  // 4. Standard external URL
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    try {
      const response = await fetch(trimmed, { mode: 'cors' });
      if (response.ok) {
        const blob = await response.blob();
        const base64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(typeof reader.result === 'string' ? reader.result : '');
          reader.onerror = () => resolve('');
          reader.readAsDataURL(blob);
        });
        if (base64) return base64;
      }
    } catch (e) {
      console.warn(`Could not convert image ${trimmed} to base64:`, e);
    }
  }

  return trimmed;
}

export interface GuiaGeneratorProps {
  ticket: Ticket;
  actividades?: Actividad[];
  repuestos?: Repuesto[];
  fotosTicket?: any[];
  fotosAct?: FotoAct[];
  resolvedFirmaTech?: string;
  resolvedFirma?: string;
  data?: any;
  pageWrapper?: (
    content: React.ReactNode, 
    pageKey: string, 
    pageIdx: number,
    meta?: {
      pageNumber: number;
      totalPages: number;
      pageLabel: string;
      isFirst: boolean;
      isLast: boolean;
    }
  ) => React.ReactNode;
}

export interface GuiaPagePlan {
  pageIdx: number;
  isFirstPage: boolean;
  isLastPage: boolean;
  activities: Actividad[];
  hasTopHeader: boolean;
  hasObservaciones: boolean;
  hasRepuestos: boolean;
  hasFirmas: boolean;
}

export function estimateActivityHeight(act: Actividad): number {
  const solucionText = (act.SOLUCION || '').replace(/(<([^>]+)>)/gi, '').trim();
  const lines = Math.max(1, Math.ceil(solucionText.length / 55));
  const solucionHeight = Math.max(20, lines * 18);
  // Header row (22px) + Solución title & body (16 + solucionHeight) + Equipment details (24px) + borders/padding (16px)
  return 22 + 16 + solucionHeight + 24 + 16;
}

export function estimateObservacionesHeight(obsText: string, comentarioFoto?: string, ubicacionCierre?: string): number {
  const lines = Math.max(1, Math.ceil((obsText || '').trim().length / 60));
  const textHeight = Math.max(36, lines * 18);
  let h = 24 + 16 + textHeight;
  if (comentarioFoto) h += 26;
  if (ubicacionCierre) h += 22;
  return h + 16;
}

export function estimateRepuestosHeight(repuestos: Repuesto[]): number {
  if (!repuestos || repuestos.length === 0) {
    return 24 + 36 + 16;
  }
  return 24 + 24 + repuestos.length * 24 + 16;
}

export function estimateTopHeight(ticket: Ticket, problemaText: string): number {
  let h = 95; // Vassosp banner header + ticket badge + margin
  h += 88; // Datos del cliente (2 rows)
  const hasExtraTimes = !!(ticket.FHLLC || ticket.FHSC || ticket['TOTAL DE HORAS'] || ticket.SUMAXH);
  h += hasExtraTimes ? 160 : 136; // Datos del ticket
  const probLines = Math.max(1, Math.ceil(problemaText.length / 60));
  const probTextH = Math.max(36, probLines * 18);
  h += 24 + 16 + probTextH + 16; // Problema reportado
  return h;
}

export function planGuiaPages(
  ticket: Ticket,
  actividades: Actividad[],
  repuestos: Repuesto[],
  problemaText: string,
  observacionesText: string,
  comentarioFoto?: string,
  ubicacionCierre?: string
): GuiaPagePlan[] {
  const MAX_PAGE_HEIGHT = 960;
  const topHeight = estimateTopHeight(ticket, problemaText);
  const actHeaderHeight = 30;
  const obsHeight = estimateObservacionesHeight(observacionesText, comentarioFoto, ubicacionCierre);
  const repHeight = estimateRepuestosHeight(repuestos);
  const firmasHeight = 140;
  const footerHeight = 35;
  const contHeaderHeight = 65;

  const totalActHeight = actividades.reduce((sum, a) => sum + estimateActivityHeight(a), 0);
  const totalIfSinglePage = topHeight + actHeaderHeight + totalActHeight + obsHeight + repHeight + firmasHeight + footerHeight;

  // Case 1: Everything fits comfortably on Page 1
  if (totalIfSinglePage <= MAX_PAGE_HEIGHT) {
    return [
      {
        pageIdx: 0,
        isFirstPage: true,
        isLastPage: true,
        activities: actividades,
        hasTopHeader: true,
        hasObservaciones: true,
        hasRepuestos: true,
        hasFirmas: true,
      }
    ];
  }

  // Case 2: Signatures and/or activities overflow Page 1.
  // Rule: Move Observaciones, Repuestos and Firmas to continuation page.
  // Page 1 gets as many unbroken activities as fit in available space.
  const availableForActPage1 = Math.max(100, MAX_PAGE_HEIGHT - topHeight - actHeaderHeight - footerHeight);
  const page1Activities: Actividad[] = [];
  const remainingActivities: Actividad[] = [];
  let currentH = 0;

  for (const act of actividades) {
    const actH = estimateActivityHeight(act);
    if (remainingActivities.length === 0 && (currentH + actH <= availableForActPage1)) {
      page1Activities.push(act);
      currentH += actH;
    } else {
      remainingActivities.push(act);
    }
  }

  // Final page fixed height: continuation header + obs + rep + firmas + footer
  const finalPageBottomH = contHeaderHeight + obsHeight + repHeight + firmasHeight + footerHeight;
  const availableForActFinalPage = Math.max(80, MAX_PAGE_HEIGHT - finalPageBottomH - actHeaderHeight);
  const availableForActInterPage = Math.max(200, MAX_PAGE_HEIGHT - contHeaderHeight - actHeaderHeight - footerHeight);

  const remainingActHeight = remainingActivities.reduce((sum, a) => sum + estimateActivityHeight(a), 0);

  if (remainingActHeight <= availableForActFinalPage) {
    return [
      {
        pageIdx: 0,
        isFirstPage: true,
        isLastPage: false,
        activities: page1Activities,
        hasTopHeader: true,
        hasObservaciones: false,
        hasRepuestos: false,
        hasFirmas: false,
      },
      {
        pageIdx: 1,
        isFirstPage: false,
        isLastPage: true,
        activities: remainingActivities,
        hasTopHeader: false,
        hasObservaciones: true,
        hasRepuestos: true,
        hasFirmas: true,
      }
    ];
  }

  // Multiple continuation pages if activities list is huge
  const pages: GuiaPagePlan[] = [
    {
      pageIdx: 0,
      isFirstPage: true,
      isLastPage: false,
      activities: page1Activities,
      hasTopHeader: true,
      hasObservaciones: false,
      hasRepuestos: false,
      hasFirmas: false,
    }
  ];

  const unassigned = [...remainingActivities];
  let pageIdx = 1;

  while (unassigned.length > 0) {
    const curRemainingH = unassigned.reduce((sum, a) => sum + estimateActivityHeight(a), 0);
    if (curRemainingH <= availableForActFinalPage) {
      pages.push({
        pageIdx: pageIdx++,
        isFirstPage: false,
        isLastPage: true,
        activities: unassigned,
        hasTopHeader: false,
        hasObservaciones: true,
        hasRepuestos: true,
        hasFirmas: true,
      });
      break;
    }

    const pageActs: Actividad[] = [];
    let pageH = 0;
    while (unassigned.length > 0) {
      const nextAct = unassigned[0];
      const nextH = estimateActivityHeight(nextAct);
      if (pageActs.length > 0 && (pageH + nextH > availableForActInterPage)) {
        break;
      }
      pageActs.push(unassigned.shift()!);
      pageH += nextH;
    }

    const isNowEmpty = unassigned.length === 0;
    pages.push({
      pageIdx: pageIdx++,
      isFirstPage: false,
      isLastPage: isNowEmpty,
      activities: pageActs,
      hasTopHeader: false,
      hasObservaciones: isNowEmpty,
      hasRepuestos: isNowEmpty,
      hasFirmas: isNowEmpty,
    });
  }

  return pages;
}

// Helper component to scale A4 pages smoothly without dead white space on mobile & desktop
export const ScaledA4Page: React.FC<{ 
  children: React.ReactNode; 
  scale: number; 
  id?: string;
  pageNumber?: number;
  totalPages?: number;
  pageLabel?: string;
  isLast?: boolean;
}> = ({ children, scale, id, pageNumber, totalPages, pageLabel, isLast }) => {
  const pageRef = React.useRef<HTMLDivElement>(null);
  const [pageHeight, setPageHeight] = React.useState<number>(1123);

  React.useEffect(() => {
    if (!pageRef.current) return;
    const el = pageRef.current;
    
    const measure = () => {
      if (el) {
        const measured = Math.max(1123, el.offsetHeight, el.scrollHeight);
        setPageHeight(measured);
      }
    };
    
    measure();
    const ro = new ResizeObserver(() => measure());
    ro.observe(el);

    // Watch for image loads inside page
    const imgs = el.querySelectorAll('img');
    imgs.forEach(img => {
      if (!img.complete) {
        img.addEventListener('load', measure);
      }
    });

    return () => ro.disconnect();
  }, [children]);

  const scaledWidth = Math.ceil(794 * scale);
  const scaledHeight = Math.ceil(pageHeight * scale);

  return (
    <div className="w-full flex flex-col items-center my-4 sm:my-6 shrink-0 print:my-0 select-text">
      {/* Visual Page Header Tag / Banner */}
      {pageNumber && (
        <div 
          className="flex items-center justify-between text-xs font-semibold select-none mb-2.5 px-1 print:hidden"
          style={{ width: `${scaledWidth}px`, maxWidth: '100%' }}
        >
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-800/95 border border-slate-700 text-slate-100 font-bold text-[11px] shadow-sm">
              <FileText className="w-3.5 h-3.5 text-blue-400 shrink-0" />
              Hoja {pageNumber} {totalPages ? `de ${totalPages}` : ''}
            </span>
            {pageLabel && (
              <span className="text-slate-400 text-[11px] tracking-wide font-medium truncate max-w-[240px] sm:max-w-[360px]">
                {pageLabel}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            <span>A4</span>
          </div>
        </div>
      )}

      {/* The Scaled Paper Sheet */}
      <div
        className="relative transition-all"
        style={{
          width: `${scaledWidth}px`,
          height: `${scaledHeight}px`,
          position: 'relative',
          flexShrink: 0,
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '794px',
            minWidth: '794px',
            transformOrigin: 'top left',
            transform: `scale(${scale})`,
          }}
        >
          <div 
            ref={pageRef} 
            id={id} 
            className="a4-page relative font-sans shadow-2xl rounded-sm flex flex-col justify-between border border-slate-300 ring-1 ring-black/10 bg-white" 
            style={{ minHeight: '1123px' }}
          >
            {children}
          </div>
        </div>
      </div>

      {/* Visual Separation Divider between sheets */}
      {pageNumber && totalPages && !isLast && (
        <div 
          className="mt-6 sm:mt-8 mb-2 w-full flex items-center justify-center gap-3 print:hidden select-none"
          style={{ width: `${scaledWidth}px`, maxWidth: '100%' }}
        >
          <div className="h-[2px] bg-gradient-to-r from-transparent via-slate-700 to-transparent flex-1"></div>
          <div className="flex items-center gap-2 px-3 py-1 bg-slate-900 border border-slate-700/80 rounded-full text-slate-300 text-[10px] sm:text-[11px] font-bold tracking-wider uppercase shadow-lg">
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
            <span>Separación de Hoja A4 • Siguiente: Hoja {pageNumber + 1}</span>
          </div>
          <div className="h-[2px] bg-gradient-to-r from-transparent via-slate-700 to-transparent flex-1"></div>
        </div>
      )}
    </div>
  );
};

export const GuiaDocumentPages: React.FC<GuiaGeneratorProps> = ({
  ticket,
  actividades = [],
  repuestos = [],
  fotosTicket = [],
  fotosAct = [],
  resolvedFirmaTech,
  resolvedFirma,
  data,
  pageWrapper
}) => {
  let totalMins = 0;
  actividades.forEach(a => {
    if (a.TE) {
      const [h, m] = a.TE.split(':');
      totalMins += (parseInt(h) || 0) * 60 + (parseInt(m) || 0);
    }
  });
  const sumTe = `${Math.floor(totalMins / 60).toString().padStart(2, '0')}:${(totalMins % 60).toString().padStart(2, '0')}`;

  // Extraer problema con múltiples alternativas seguras
  const problemaText = (
    ticket.PROBLEMA ||
    (ticket as any)['PROBLEMA'] ||
    (ticket as any)['Problema'] ||
    (ticket as any)['problema'] ||
    (ticket as any)['FALLA'] ||
    (ticket as any)['MOTIVO'] ||
    ticket.DESCRIPCION ||
    (ticket as any)['DESCRIPCION'] ||
    (ticket as any)['Descripcion'] ||
    ''
  ).trim();

  // Observaciones & Comentarios adicionales
  const observacionesText = (
    ticket.OBSERVACIONES ||
    (ticket as any)['OBSERVACIONES'] ||
    (ticket as any)['Observaciones'] ||
    ''
  ).trim();

  const comentarioFoto = (
    ticket['COMENTARIO DE FOTO'] ||
    (ticket as any)['COMENTARIO DE FOTO'] ||
    (ticket as any)['Comentario de Foto'] ||
    ''
  ).trim();

  const ubicacionCierre = (
    ticket['DONDE CERRE'] ||
    (ticket as any)['DONDE CERRE'] ||
    (ticket as any)['Donde Cerre'] ||
    ''
  ).trim();

  // Technician match
  const matchTecnico = data?.tecnicos?.find(
    (tec: any) => tec.NOMBRE?.trim().toLowerCase() === (ticket.TECNICO || '').trim().toLowerCase()
  );
  const firmaTechToUse = resolvedFirmaTech || ticket.FIRMATECH || matchTecnico?.FIRMATECH || '';
  const firmaClienteToUse = resolvedFirma || ticket.FIRMA || '';

  // Calculate pages plan
  const guiaPages = planGuiaPages(
    ticket,
    actividades,
    repuestos,
    problemaText,
    observacionesText,
    comentarioFoto,
    ubicacionCierre
  );
  const totalGuiaPages = guiaPages.length;

  // Actual photos list fallback
  const actualFotosTicket = fotosTicket.length > 0 
    ? fotosTicket 
    : (data?.fotosTicket?.filter((f: any) => f.IDTICKET === ticket.IDTICKET) || []);
  const actualFotosAct = fotosAct.length > 0 ? fotosAct : (data?.fotosAct || []);

  // Pre-calculate all photo annex pages for precise contiguous page counts & totals
  const ticketPhotoChunks = actualFotosTicket.length > 0 ? chunkArray(actualFotosTicket, 4) : [];
  const ticketPhotoPagesCount = ticketPhotoChunks.length;

  const actPhotoPagesList: { act: Actividad; chunk: any[]; chunkIdx: number; totalChunksForAct: number }[] = [];
  actividades.forEach((act) => {
    const actFotos = actualFotosAct.filter((f: any) => f.IDACTIVIDADES === act.IDACTIVIDADES);
    if (actFotos.length > 0) {
      const chunks = chunkArray(actFotos, 4);
      chunks.forEach((chunk, chunkIdx) => {
        actPhotoPagesList.push({ act, chunk, chunkIdx, totalChunksForAct: chunks.length });
      });
    }
  });

  const totalOverallPages = totalGuiaPages + ticketPhotoPagesCount + actPhotoPagesList.length;

  const renderA4Page = (
    content: React.ReactNode,
    pageKey: string,
    pageIdx: number,
    meta: {
      pageNumber: number;
      totalPages: number;
      pageLabel: string;
      isFirst: boolean;
      isLast: boolean;
    }
  ) => {
    if (pageWrapper) {
      return pageWrapper(content, pageKey, pageIdx, meta);
    }
    return (
      <ScaledA4Page
        key={pageKey}
        scale={1}
        id={pageIdx === 0 ? 'guia-print' : pageKey}
        pageNumber={meta.pageNumber}
        totalPages={meta.totalPages}
        pageLabel={meta.pageLabel}
        isLast={meta.isLast}
      >
        {content}
      </ScaledA4Page>
    );
  };

  return (
    <div className="guia-pages-root bg-transparent text-black font-sans flex flex-col items-center w-full">
      {/* GUÍA DE SERVICIO PAGES (1 or more based on content height) */}
      {guiaPages.map((pagePlan, pIdx) => {
        const pageKey = `guia-page-${pIdx + 1}`;
        const pageNumber = pIdx + 1;
        const isFirst = pagePlan.isFirstPage;
        const isDocLast = pageNumber === totalOverallPages;
        const pageLabel = totalGuiaPages > 1 
          ? `Guía de Servicio (Parte ${pageNumber} de ${totalGuiaPages})` 
          : 'Guía de Servicio';

        const pageContent = (
          <>
            <div>
              {/* Header on Page 1 */}
              {isFirst ? (
                <div className="relative mb-4 pb-2">
                  <img 
                    referrerPolicy="no-referrer" 
                    crossOrigin="anonymous" 
                    src={CABECERA_B64} 
                    alt="Cabecera Vassosp" 
                    className="w-full h-auto object-contain" 
                  />
                  <div className="absolute bottom-1 right-3 sm:right-6">
                    <div className="border border-red-500 bg-white text-red-500 px-2 py-0.5 font-bold text-[10px] shadow-sm leading-tight">
                      Ticket N° {ticket.IDTICKET}
                    </div>
                  </div>
                </div>
              ) : (
                /* Continuation Header on Page 2+ */
                <div className="border-b-2 border-black pb-2 mb-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="font-extrabold text-sm tracking-wider uppercase">VASSOSP - GUÍA DE SERVICIO</span>
                      <span className="text-[10px] bg-black text-white px-2 py-0.5 rounded font-bold">
                        HOJA {pIdx + 1} DE {totalGuiaPages}
                      </span>
                    </div>
                    <div className="border border-red-500 bg-white text-red-500 px-2 py-0.5 font-bold text-[10px] shadow-sm">
                      Ticket N° {ticket.IDTICKET}
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-gray-700 mt-1 font-medium">
                    <div><span className="font-bold">CLIENTE:</span> {ticket.CLIENTE || '-'}</div>
                    <div><span className="font-bold">CONTACTO:</span> {ticket.CONTACTO || '-'}</div>
                    <div><span className="font-bold">TÉCNICO:</span> {ticket.TECNICO || '-'}</div>
                  </div>
                </div>
              )}

              {/* Client Info (Page 1 only) */}
              {isFirst && (
                <div className="border border-black mb-4 text-xs">
                  <div className="bg-black text-white px-2 py-1 font-bold">DATOS DEL CLIENTE</div>
                  <div className="grid grid-cols-2">
                    <div className="border-r border-b border-black flex">
                      <span className="font-bold w-24 px-2 py-1 border-r border-black shrink-0">CLIENTE:</span>
                      <span className="px-2 py-1 flex-1 font-medium">{ticket.CLIENTE || '-'}</span>
                    </div>
                    <div className="border-b border-black flex">
                      <span className="font-bold w-24 px-2 py-1 border-r border-black shrink-0">CONTACTO:</span>
                      <span className="px-2 py-1 flex-1 font-medium">{ticket.CONTACTO || '-'}</span>
                    </div>
                    <div className="border-r border-black flex">
                      <span className="font-bold w-24 px-2 py-1 border-r border-black shrink-0">DIRECCIÓN:</span>
                      <span className="px-2 py-1 flex-1 font-medium">{ticket.DIRECCION || '-'}</span>
                    </div>
                    <div className="flex">
                      <span className="font-bold w-24 px-2 py-1 border-r border-black shrink-0">TELÉFONO:</span>
                      <span className="px-2 py-1 flex-1 font-medium">{ticket.TELEFONO || '-'}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Ticket Info (Page 1 only) */}
              {isFirst && (
                <div className="border border-black mb-4 text-xs">
                  <div className="bg-black text-white px-2 py-1 font-bold">DATOS DEL TICKET</div>
                  <div className="grid grid-cols-2">
                    <div className="border-r border-b border-black flex">
                      <span className="font-bold w-28 px-2 py-1 border-r border-black shrink-0">F.H. INGRESO:</span>
                      <span className="px-2 py-1 flex-1 font-medium">{ticket.FHINGRESO || '-'}</span>
                    </div>
                    <div className="border-b border-black flex">
                      <span className="font-bold w-28 px-2 py-1 border-r border-black shrink-0">F.H. PROG.:</span>
                      <span className="px-2 py-1 flex-1 font-medium">{ticket.FHPROGRAMADA || '-'}</span>
                    </div>
                    <div className="border-r border-b border-black flex">
                      <span className="font-bold w-28 px-2 py-1 border-r border-black shrink-0">ESTADO:</span>
                      <span className="px-2 py-1 flex-1 font-medium">{ticket.ESTADO || '-'}</span>
                    </div>
                    <div className="border-b border-black flex">
                      <span className="font-bold w-28 px-2 py-1 border-r border-black shrink-0">PRIORIDAD:</span>
                      <span className="px-2 py-1 flex-1 font-medium">{ticket.PRIORIDAD || '-'}</span>
                    </div>
                    <div className="border-r border-b border-black flex">
                      <span className="font-bold w-28 px-2 py-1 border-r border-black shrink-0">TIPO:</span>
                      <span className="px-2 py-1 flex-1 font-medium">{ticket.TIPO || '-'}</span>
                    </div>
                    <div className="border-b border-black flex">
                      <span className="font-bold w-28 px-2 py-1 border-r border-black shrink-0">MODO ATENCIÓN:</span>
                      <span className="px-2 py-1 flex-1 font-medium">{ticket['MODO DE ATENCION'] || '-'}</span>
                    </div>
                    <div className="border-r border-black flex">
                      <span className="font-bold w-28 px-2 py-1 border-r border-black shrink-0">TÉCNICO:</span>
                      <span className="px-2 py-1 flex-1 font-medium">{ticket.TECNICO || '-'}</span>
                    </div>
                    <div className="flex">
                      <span className="font-bold w-28 px-2 py-1 border-r border-black shrink-0">F.H. CIERRE:</span>
                      <span className="px-2 py-1 flex-1 font-medium">{ticket['FECHA DE CIERRE'] || ticket.FHSC || '-'}</span>
                    </div>
                    {(ticket.FHLLC || ticket.FHSC || ticket['TOTAL DE HORAS'] || ticket.SUMAXH) && (
                      <>
                        <div className="border-r border-t border-black flex">
                          <span className="font-bold w-28 px-2 py-1 border-r border-black shrink-0">F.H. LLEGADA:</span>
                          <span className="px-2 py-1 flex-1 font-medium">{ticket.FHLLC || ticket.DATEINICIO || '-'}</span>
                        </div>
                        <div className="border-t border-black flex">
                          <span className="font-bold w-28 px-2 py-1 border-r border-black shrink-0">F.H. SALIDA:</span>
                          <span className="px-2 py-1 flex-1 font-medium">{ticket.FHSC || '-'}</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Problem Reported (Page 1 only) */}
              {isFirst && (
                <div className="border border-black mb-4 text-xs">
                  <div className="bg-black text-white px-2 py-1 font-bold">PROBLEMA REPORTADO</div>
                  <div className="p-2 min-h-[36px] whitespace-pre-wrap font-medium break-words [overflow-wrap:anywhere] [word-break:break-word]">
                    {problemaText || 'Sin problema reportado especificado.'}
                  </div>
                </div>
              )}

              {/* Activities for this page */}
              {(pagePlan.activities.length > 0 || isFirst) && (
                <div className="border border-black mb-4 text-xs">
                  <div className="bg-black text-white px-2 py-1 font-bold flex justify-between">
                    <span>{isFirst ? 'ACTIVIDADES' : 'ACTIVIDADES (CONTINUACIÓN)'}</span>
                    <span>Duración Total : {ticket['TOTAL DE HORAS'] || ticket.SUMAXH || sumTe}</span>
                  </div>
                  <div className="p-2 flex flex-col gap-2 font-medium">
                    {pagePlan.activities.map((act, i) => (
                      <div key={i} className="border-b border-dashed border-gray-400 pb-2 mb-2 last:border-0 last:mb-0 last:pb-0 w-full min-w-0 max-w-full overflow-hidden">
                        <div className="font-bold mb-1 flex flex-wrap gap-x-4">
                          <span>F.H. de Inicio: <span className="font-normal">{act.FHINICIO || '-'}</span></span>
                          <span>F.H. Fin: <span className="font-normal">{act.FHFIN || '-'}</span></span>
                          <span>Tiempo Eficaz: <span className="font-normal">{act.TE || '-'}</span></span>
                        </div>
                        <div className="mb-1 w-full min-w-0 max-w-full overflow-hidden">
                          <span className="font-bold">Solución:</span>
                          <div 
                            className="quill-content text-[11px] prose prose-sm max-w-none break-words [overflow-wrap:anywhere] [word-break:break-word] [&_*]:break-words [&_*]:[overflow-wrap:anywhere] [&_*]:[word-break:break-word] [&_p]:mb-1 [&_p:last-child]:mb-0 [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4 leading-snug"
                            dangerouslySetInnerHTML={{ __html: act.SOLUCION || '-' }} 
                          />
                        </div>
                        <div className="text-[10px] mt-2 border-t border-gray-200 pt-1 flex flex-wrap gap-x-3 gap-y-0.5 break-words [overflow-wrap:anywhere] min-w-0">
                          <span className="break-all"><span className="font-bold">TIPO:</span> {act.TIPO || (act as any).TIPO_EQUIPO || '-'}</span>
                          <span className="break-all"><span className="font-bold">MARCA:</span> {act.MARCA || '-'}</span>
                          <span className="break-all"><span className="font-bold">MODELO:</span> {act.MODELO || '-'}</span>
                          <span className="break-all"><span className="font-bold">SERIE:</span> {act.SERIE || '-'}</span>
                          <span className="break-all"><span className="font-bold">USUARIO:</span> {act.USUARIO || '-'}</span>
                          <span className="break-all"><span className="font-bold">AREA:</span> {act.AREA || '-'}</span>
                        </div>
                      </div>
                    ))}
                    {pagePlan.activities.length === 0 && isFirst && (
                      <span className="text-gray-500">Sin actividades registradas.</span>
                    )}
                  </div>
                </div>
              )}

              {/* Observations (on final page or page 1 if single page) */}
              {pagePlan.hasObservaciones && (
                <div className="border border-black mb-4 text-xs">
                  <div className="bg-black text-white px-2 py-1 font-bold">OBSERVACIONES</div>
                  <div className="p-2 min-h-[36px] whitespace-pre-wrap font-medium break-words [overflow-wrap:anywhere] [word-break:break-word]">
                    {observacionesText || 'Sin observaciones.'}
                    {comentarioFoto && (
                      <div className="mt-1.5 pt-1 border-t border-gray-300 text-gray-700 break-words [overflow-wrap:anywhere] [word-break:break-word]">
                        <span className="font-bold">Comentario de Fotos: </span>
                        <span>{comentarioFoto}</span>
                      </div>
                    )}
                    {ubicacionCierre && (
                      <div className="mt-1 text-gray-600 break-words [overflow-wrap:anywhere] [word-break:break-word]">
                        <span className="font-bold">Lugar de Cierre: </span>
                        <span>{ubicacionCierre}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Spares (on final page or page 1 if single page) */}
              {pagePlan.hasRepuestos && (
                <div className="border border-black mb-4 text-xs">
                  <div className="bg-black text-white px-2 py-1 font-bold">REPUESTOS</div>
                  <div className="p-2 min-h-[36px] font-medium">
                    {repuestos.length > 0 ? (
                      <table className="w-full text-left">
                        <thead>
                          <tr className="border-b border-gray-300">
                            <th className="pb-1">CÓDIGO</th>
                            <th className="pb-1">DESCRIPCIÓN</th>
                            <th className="pb-1">CANT.</th>
                          </tr>
                        </thead>
                        <tbody>
                          {repuestos.map((r, i) => (
                            <tr key={i}>
                              <td className="py-1">{r.NRO_PARTE || r.IDREPUESTO || '-'}</td>
                              <td className="py-1">{r.DESCRIPCION || '-'}</td>
                              <td className="py-1">{r.CANTIDAD || '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : 'Sin repuestos.'}
                  </div>
                </div>
              )}
            </div>

            {/* Bottom section: Signatures + Footer (on last page of Guía) OR Continuation Note (on intermediate pages) */}
            {(pagePlan.hasFirmas || pagePlan.isLastPage) ? (
              <div className="mt-auto pt-3">
                {/* Signatures */}
                <div className="grid grid-cols-2 gap-8 text-center pt-3 mb-3 px-8 border-t border-gray-200">
                  <div className="flex flex-col items-center">
                    {firmaTechToUse?.startsWith('data:image') ? (
                      <img
                        src={firmaTechToUse}
                        alt="Firma Técnico"
                        className="h-20 max-w-[240px] object-contain mb-1"
                        crossOrigin="anonymous"
                      />
                    ) : firmaTechToUse ? (
                      <AuthenticatedImage referrerPolicy="no-referrer" src={firmaTechToUse} alt="Firma Técnico" className="h-20 object-contain mb-1" />
                    ) : (
                      <div className="h-20 mb-1 flex items-center justify-center text-xs text-gray-400 italic">
                        Sin firma técnico
                      </div>
                    )}
                    <div className="border-t border-black w-full pt-1">
                      <p className="font-bold text-xs">FIRMA TÉCNICO</p>
                      <p className="text-[11px] text-gray-700">{ticket.TECNICO || 'Técnico'}</p>
                    </div>
                  </div>
                  
                  <div className="flex flex-col items-center">
                    {firmaClienteToUse?.startsWith('data:image') ? (
                      <img
                        src={firmaClienteToUse}
                        alt="Firma Cliente"
                        className="h-20 max-w-[240px] object-contain mb-1"
                        crossOrigin="anonymous"
                      />
                    ) : firmaClienteToUse ? (
                      <AuthenticatedImage referrerPolicy="no-referrer" src={firmaClienteToUse} alt="Firma Cliente" className="h-20 object-contain mb-1" />
                    ) : (
                      <div className="h-20 mb-1 flex items-center justify-center text-xs text-gray-400 italic">
                        Sin firma cliente
                      </div>
                    )}
                    <div className="border-t border-black w-full pt-1">
                      <p className="font-bold text-xs">CONFORMIDAD CLIENTE</p>
                      <p className="text-[11px] text-gray-700">{ticket.CONTACTO || 'Cliente'}</p>
                    </div>
                  </div>
                </div>

                {/* Footer / Pie de página */}
                <div className="text-[9px] text-gray-400 text-center pt-2 border-t border-gray-100">
                  Av. Del Parque Norte 1174, San Borja, Lima | Telf: (01) 225-8800 | www.vassosp.com
                </div>
              </div>
            ) : (
              /* Intermediate page continuation footer */
              <div className="mt-auto pt-2 border-t border-gray-200 flex items-center justify-between text-[9px] text-gray-500 font-medium">
                <span>Guía de Servicio - Hoja {pIdx + 1} de {totalGuiaPages} (Continúa en Hoja {pIdx + 2})</span>
                <span>Av. Del Parque Norte 1174, San Borja, Lima | Telf: (01) 225-8800</span>
              </div>
            )}
          </>
        );

        return renderA4Page(pageContent, pageKey, pIdx, {
          pageNumber,
          totalPages: totalOverallPages,
          pageLabel,
          isFirst,
          isLast: isDocLast,
        });
      })}

      {/* PAGES: ANEXO DE FOTOS DEL TICKET */}
      {ticketPhotoChunks.map((chunk, chunkIdx) => {
        const pageKey = `ticket-fotos-page-${chunkIdx}`;
        const pageNumber = totalGuiaPages + chunkIdx + 1;
        const isLast = pageNumber === totalOverallPages;
        const pageLabel = ticketPhotoChunks.length > 1
          ? `Anexo Fotográfico - Ticket (Hoja ${chunkIdx + 1} de ${ticketPhotoChunks.length})`
          : 'Anexo Fotográfico - Ticket';

        const annexContent = (
          <>
            <h3 className="text-center font-bold text-2xl underline mb-6 uppercase tracking-widest">Anexo de Fotos</h3>
            
            <div className="mb-6 text-sm border-2 border-red-500 p-3 w-fit inline-block">
              <p><span className="font-bold">Ticket N°:</span> {ticket.IDTICKET}</p>
              <p><span className="font-bold">Cliente:</span> {ticket.CLIENTE}</p>
            </div>

            <div className="grid grid-cols-2 gap-6 flex-1">
              {chunk.map((foto: any, idx: number) => {
                const globalIdx = chunkIdx * 4 + idx;
                return (
                  <div key={globalIdx} className="flex flex-col items-center border border-gray-300 p-2 h-72">
                    <AuthenticatedImage referrerPolicy="no-referrer" src={foto.FOTO} alt={`Foto ${globalIdx + 1}`} className="w-full h-full object-contain mb-2" />
                    <p className="font-bold text-sm">FOTO {globalIdx + 1}</p>
                  </div>
                );
              })}
            </div>
            
            <div className="mt-auto text-[9px] text-gray-400 text-center pt-2 border-t border-gray-100">
              Anexo de Fotos del Ticket #{ticket.IDTICKET} - Hoja {chunkIdx + 1} de {ticketPhotoChunks.length}
            </div>
          </>
        );

        return renderA4Page(annexContent, pageKey, pageNumber - 1, {
          pageNumber,
          totalPages: totalOverallPages,
          pageLabel,
          isFirst: false,
          isLast,
        });
      })}

      {/* PAGES: ANEXO DE FOTOS DE ACTIVIDADES */}
      {actPhotoPagesList.map((item, itemIdx) => {
        const pageKey = `act-fotos-page-${item.act.IDACTIVIDADES || 'act'}-${item.chunkIdx}`;
        const pageNumber = totalGuiaPages + ticketPhotoPagesCount + itemIdx + 1;
        const isLast = pageNumber === totalOverallPages;
        const pageLabel = `Anexo Fotográfico - Actividad #${item.act.IDACTIVIDADES || itemIdx + 1} (Hoja ${item.chunkIdx + 1} de ${item.totalChunksForAct})`;

        const actAnnexContent = (
          <>
            <h3 className="text-center font-bold text-2xl underline mb-6 uppercase tracking-widest">Anexo de Fotos</h3>
            
            <div className="mb-6 text-xs border border-black p-3">
              <div className="grid grid-cols-2 gap-4 mb-2">
                <div><span className="font-bold">F.H. INICIO:</span> {item.act.FHINICIO}</div>
                <div><span className="font-bold">F.H. FIN:</span> {item.act.FHFIN}</div>
              </div>
              <div className="mb-2"><span className="font-bold">TIEMPO EFICAZ (TE):</span> {item.act.TE}</div>
              <div className="w-full min-w-0 max-w-full overflow-hidden">
                <span className="font-bold">SOLUCIÓN:</span>
                <div 
                  className="mt-1 quill-content text-[11px] prose prose-sm max-w-none break-words [overflow-wrap:anywhere] [word-break:break-word] [&_*]:break-words [&_*]:[overflow-wrap:anywhere] [&_*]:[word-break:break-word] [&_p]:mb-1 [&_p:last-child]:mb-0 [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4 leading-snug"
                  dangerouslySetInnerHTML={{ __html: item.act.SOLUCION || '-' }} 
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6 flex-1">
              {item.chunk.map((foto: any, idx: number) => {
                const globalIdx = item.chunkIdx * 4 + idx;
                return (
                  <div key={globalIdx} className="flex flex-col items-center border border-gray-300 p-2 h-72">
                    <AuthenticatedImage referrerPolicy="no-referrer" src={foto.FOTO} alt={`Foto ${globalIdx + 1}`} className="w-full h-full object-contain mb-2" />
                    <p className="font-bold text-sm">FOTO {globalIdx + 1}</p>
                  </div>
                );
              })}
            </div>

            <div className="mt-auto text-[9px] text-gray-400 text-center pt-2 border-t border-gray-100">
              Anexo de Fotos de Actividad #{item.act.IDACTIVIDADES} - Hoja {item.chunkIdx + 1} de {item.totalChunksForAct}
            </div>
          </>
        );

        return renderA4Page(actAnnexContent, pageKey, pageNumber - 1, {
          pageNumber,
          totalPages: totalOverallPages,
          pageLabel,
          isFirst: false,
          isLast,
        });
      })}
    </div>
  );
};

/**
 * Función integral que:
 * 1. Genera el PDF completo de la Guía de Servicio (A4).
 * 2. Guarda el PDF en la carpeta de Google Drive designada (1nZKrXULwBYnjcfn9GiBjNvIZxHLyZsEs)
 *    con el nombre exacto: CLIENTE-TICKET.pdf
 * 3. Actualiza el ticket con la URL directa del PDF generado.
 * 4. Opcionalmente descarga el PDF en la máquina local.
 * 5. Retorna la URL directa del PDF generado en Google Drive.
 */
export async function generateAndUploadGuiaPDF({
  ticket,
  data,
  actividades,
  repuestos,
  fotosTicket,
  fotosAct,
  downloadLocally = false,
  onProgress
}: {
  ticket: Ticket;
  data?: AppData | null;
  actividades?: Actividad[];
  repuestos?: Repuesto[];
  fotosTicket?: any[];
  fotosAct?: FotoAct[];
  downloadLocally?: boolean;
  onProgress?: (msg: string) => void;
}): Promise<{ pdfUrl: string; fileName: string }> {
  const clienteClean = (ticket.CLIENTE || 'CLIENTE').trim().replace(/[/\\?%*:|"<>]/g, '_');
  const ticketClean = (ticket.IDTICKET || 'TICKET').trim().replace(/[/\\?%*:|"<>]/g, '_');
  const fileName = `${clienteClean}-${ticketClean}.pdf`;

  onProgress?.('Preparando documento de Guía de Servicio...');

  // Derive records if not explicitly passed
  const derivedActividades = actividades || (data?.actividades?.filter(a => a.IDTICKET === ticket.IDTICKET) || []);
  const derivedRepuestos = repuestos || (data?.repuestos?.filter(r => r.IDTICKET === ticket.IDTICKET) || []);
  const derivedFotosTicket = fotosTicket || (data?.fotosTicket?.filter(f => f.IDTICKET === ticket.IDTICKET) || []);
  const actIds = derivedActividades.map(a => a.IDACTIVIDADES);
  const derivedFotosAct = fotosAct || (data?.fotosAct?.filter(f => actIds.includes(f.IDACTIVIDADES)) || []);

  // 1. Resolve technician signature from ticket or data.tecnicos
  const matchingTecnico = data?.tecnicos?.find(
    tec => tec.NOMBRE?.trim().toLowerCase() === (ticket.TECNICO || '').trim().toLowerCase()
  );
  const rawFirmaTech = ticket.FIRMATECH || matchingTecnico?.FIRMATECH || '';
  const rawFirma = ticket.FIRMA || '';

  onProgress?.('Preparando firmas digitales...');
  const [resolvedFirmaTech, resolvedFirma] = await Promise.all([
    resolveImageToBase64(rawFirmaTech),
    resolveImageToBase64(rawFirma)
  ]);

  onProgress?.('Preparando fotos en alta resolución...');
  const [resolvedFotosTicket, resolvedFotosAct] = await Promise.all([
    Promise.all(
      derivedFotosTicket.map(async (f) => ({
        ...f,
        FOTO: await resolveImageToBase64(f.FOTO)
      }))
    ),
    Promise.all(
      derivedFotosAct.map(async (f) => ({
        ...f,
        FOTO: await resolveImageToBase64(f.FOTO)
      }))
    )
  ]);

  // Create offscreen container
  const container = document.createElement('div');
  container.id = 'guia-pdf-offscreen-render';
  container.style.position = 'fixed';
  container.style.left = '-9999px';
  container.style.top = '0';
  container.style.width = '794px';
  container.style.zIndex = '-9999';
  container.style.backgroundColor = '#ffffff';
  document.body.appendChild(container);

  const root = createRoot(container);

  try {
    // Render the Guia pages with pre-resolved Base64 images and signatures
    root.render(
      <GuiaDocumentPages
        ticket={ticket}
        actividades={derivedActividades}
        repuestos={derivedRepuestos}
        fotosTicket={resolvedFotosTicket}
        fotosAct={resolvedFotosAct}
        resolvedFirmaTech={resolvedFirmaTech}
        resolvedFirma={resolvedFirma}
      />
    );

    onProgress?.('Cargando imágenes y elementos visuales...');
    // Allow React to mount DOM and browser to parse base64 inline images
    await new Promise(r => setTimeout(r, 600));

    // Ensure all images are fully decoded in memory before canvas capture
    const images = Array.from(container.querySelectorAll('img'));
    await Promise.all(
      images.map(img => {
        if (img.complete && img.naturalWidth > 0) return Promise.resolve();
        if (typeof img.decode === 'function') {
          return img.decode().catch(() => Promise.resolve());
        }
        return new Promise(res => {
          img.onload = res;
          img.onerror = res;
          setTimeout(res, 2500); // safety timeout
        });
      })
    );

    const pageElements = container.querySelectorAll('.a4-page');
    if (pageElements.length === 0) {
      throw new Error('No se pudieron renderizar las páginas del PDF');
    }

    onProgress?.('Generando páginas PDF...');
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
      compress: true
    });

    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();

    for (let i = 0; i < pageElements.length; i++) {
      onProgress?.(`Procesando página ${i + 1} de ${pageElements.length}...`);
      const pageEl = pageElements[i] as HTMLElement;
      const canvas = await safeHtml2Canvas(pageEl, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        logging: false,
        backgroundColor: '#ffffff'
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      if (i > 0) pdf.addPage();
      pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight, undefined, 'FAST');
    }

    // 1. Descarga local si fue solicitada
    if (downloadLocally) {
      pdf.save(fileName);
    }

    // 2. Subida a Google Drive
    onProgress?.('Guardando PDF en Google Drive...');
    const pdfBlob = pdf.output('blob');
    const pdfFile = new File([pdfBlob], fileName, { type: 'application/pdf' });
    const uploadedDriveUrl = await uploadImage(pdfFile, GUIAS_PDF_FOLDER_ID, fileName);

    const finalPdfUrl = uploadedDriveUrl || (ticket.PDF ? ticket.PDF : '');

    // 3. Actualizar registro en Sheets
    if (finalPdfUrl && ticket._rowIndex) {
      onProgress?.('Actualizando enlace en sistema...');
      const updatedTicket: Ticket = { ...ticket, PDF: finalPdfUrl };
      await updateTicket(ticket._rowIndex, updatedTicket);
    }

    return {
      pdfUrl: finalPdfUrl,
      fileName
    };
  } finally {
    // Cleanup offscreen DOM
    setTimeout(() => {
      try {
        root.unmount();
        container.remove();
      } catch {
        // ignore unmount errors
      }
    }, 500);
  }
}
