import { useRef, useState } from 'react';
import { Cotizacion, Vendedor, Cliente } from '../../types';
import { ArrowLeft, Printer, Download, Check, Share2, Phone, Mail } from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { LOGO_COTIZACION_URL, LOGO_COTIZACION_BACKUP_URL } from '../../lib/logoConstants';
import { sanitizeHtml2CanvasClonedDoc, safeHtml2Canvas } from '../../lib/pdfHelper';

interface Props {
  cotizacion: Cotizacion;
  vendedor: Vendedor | undefined;
  cliente: Cliente | undefined;
  docType: 'VENTA' | 'ALQUILER' | 'OUTSOURCING' | string;
  headerData: any;
  items: any[];
  currency: 'PEN' | 'USD';
  exchangeRate: number;
  onBack: () => void;
}

export default function CotizacionA4Preview({
  cotizacion,
  vendedor,
  cliente,
  docType,
  headerData,
  items,
  currency,
  exchangeRate,
  onBack
}: Props) {
  const printRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [copied, setCopied] = useState(false);

  const normalizedType = (docType || '').toUpperCase().trim();
  const isVenta = normalizedType === 'VENTA';
  const isAlquiler = normalizedType === 'ALQUILER';
  const isOut = normalizedType === 'OUTSOURCING' || normalizedType === 'OUT' || normalizedType === 'SERVICIOS';

  const currencySymbol = currency === 'USD' ? '$' : 'S/.';
  const currencyName = currency === 'USD' ? 'Dolares Americanos' : 'Soles';

  // Format money
  const formatMoney = (val: number | string | undefined) => {
    const num = parseFloat(String(val || '0').replace(/,/g, '')) || 0;
    return `${currencySymbol} ${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // Totals calculations
  const subtotal =
    parseFloat(String(headerData['SUB TOTAL'] || '0').replace(/,/g, '')) ||
    items.reduce((acc, it) => acc + (parseFloat(String(it['P.TOTAL'] || it['P.UNIT'] || '0').replace(/,/g, '')) || 0), 0);
  
  const igv = parseFloat(String(headerData['IGV'] || '0').replace(/,/g, '')) || (subtotal * 0.18);
  const total = parseFloat(String(headerData['TOTAL'] || '0').replace(/,/g, '')) || (subtotal + igv);

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPDF = async () => {
    if (!printRef.current) return;
    setIsExporting(true);
    try {
      const element = printRef.current;
      const canvas = await safeHtml2Canvas(element, {
        scale: 2.5,
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

      if (imgHeight <= pageHeight + 15) {
        const renderHeight = Math.min(imgHeight, pageHeight);
        pdf.addImage(imgData, 'JPEG', 0, 0, imgWidth, renderHeight);
      } else {
        let heightLeft = imgHeight;
        let position = 0;

        pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;

        while (heightLeft > 15) {
          position -= pageHeight;
          pdf.addPage();
          pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
          heightLeft -= pageHeight;
        }
      }

      pdf.save(`Cotizacion_${cotizacion.ID.replace(/\s+/g, '_')}.pdf`);
    } catch (err) {
      console.error('Error generating PDF:', err);
      alert('Hubo un problema al generar el PDF. Puedes usar la opción de Imprimir.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleCopySummary = () => {
    const text = `COTIZACIÓN VASSOSP TRADING
N°: ${cotizacion.ID} (${cotizacion.ID_COT})
Cliente: ${cotizacion.CLIENTE}
Fecha: ${cotizacion.FECHA}
Total: ${formatMoney(total)}
Gestor Comercial: ${vendedor?.VENDEDOR || cotizacion.VENDEDOR}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Proposal Title text based on document type
  const proposalTitle =
    cotizacion.DETALLE ||
    headerData['REFERENCIA'] ||
    (isVenta ? 'Venta de Repuestos y Equipamiento' : isAlquiler ? 'Alquiler de Computadora y Equipamiento' : 'Soporte On Site y Servicios de TI');

  return (
    <div className="flex flex-col w-full h-full bg-slate-950 text-slate-100 overflow-y-auto">
      {/* Top Toolbar (Hidden on print) */}
      <div className="print:hidden sticky top-0 z-30 flex flex-wrap items-center justify-between gap-4 px-6 py-4 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Volver al Editor
          </button>
          <div className="h-5 w-px bg-slate-700" />
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            Formato Oficial Vassosp
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-400 font-mono border border-blue-500/30">
              {cotizacion.ID}
            </span>
            <span className="text-[11px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-semibold uppercase">
              {normalizedType}
            </span>
          </h2>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleCopySummary}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
            title="Copiar Resumen"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Share2 className="w-4 h-4" />}
            {copied ? 'Copiado' : 'Compartir'}
          </button>

          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition-colors border border-slate-700"
          >
            <Printer className="w-4 h-4 text-blue-400" />
            Imprimir
          </button>

          <button
            onClick={handleDownloadPDF}
            disabled={isExporting}
            className="flex items-center gap-2 px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-lg shadow-blue-600/30 transition-all disabled:opacity-50"
          >
            {isExporting ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Generando PDF...</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                <span>Descargar PDF</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* A4 Sheet Container */}
      <div className="flex-1 flex justify-center p-4 sm:p-8 bg-slate-950 overflow-y-auto">
        <div
          ref={printRef}
          id="cotizacion-a4-sheet"
          className="w-full max-w-[210mm] min-h-[297mm] bg-white text-black shadow-2xl px-12 py-10 flex flex-col justify-between rounded-sm print:shadow-none print:m-0 print:px-10 print:py-8 print:w-full print:max-w-none text-[11.5px] leading-tight font-sans"
        >
          {/* Main Top & Content Body */}
          <div className="space-y-4">
            {/* Header: Logo on Left, Quotation info on Right */}
            <div className="flex justify-between items-start pt-2">
              {/* Vassosp Logo */}
              <div className="flex items-center">
                <img
                  src={LOGO_COTIZACION_URL}
                  alt="vassosp Trading E.I.R.L."
                  className="h-14 sm:h-16 w-auto object-contain max-w-[280px]"
                  crossOrigin="anonymous"
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    // Fallback to secondary thumbnail URL if primary fails
                    const target = e.target as HTMLImageElement;
                    if (target.src !== LOGO_COTIZACION_BACKUP_URL) {
                      target.src = LOGO_COTIZACION_BACKUP_URL;
                    }
                  }}
                />
              </div>

              {/* Quotation Number & Date */}
              <div className="text-right space-y-1 text-[11.5px]">
                <p className="font-normal text-slate-900">
                  <strong className="font-bold">Cotización Nº:</strong> {cotizacion.ID}
                </p>
                <p className="font-normal text-slate-900">
                  <strong className="font-bold">Fecha :</strong> {cotizacion.FECHA || new Date().toLocaleDateString('es-PE')}
                </p>
              </div>
            </div>

            {/* Client and Attention Info */}
            <div className="pt-2 text-[11.5px] leading-relaxed">
              <p className="text-slate-900">
                <strong className="font-bold">Señores:</strong> {cotizacion.CLIENTE || cliente?.CLIENTE || 'CLIENTE'}
              </p>
              <p className="text-slate-900">
                <strong className="font-bold">Atención:</strong> {cotizacion.REFERENTE || headerData['ATENCION'] || ''}
              </p>
            </div>

            {/* Salutation sentence */}
            <p className="text-[11.5px] text-slate-900 pt-1">
              Por la presente aprovechamos la oportunidad de saludarlos y a la vez hacerles llegar la cotización solicitada.
            </p>

            {/* Propuesta Económica Banner */}
            <div className="w-full bg-[#E5E7EB] border border-black py-1 px-3 text-center">
              <span className="font-bold text-slate-900 text-[11.5px]">
                Propuesta Económica: {proposalTitle}
              </span>
            </div>

            {/* Alcance del servicio Banner */}
            <div className="w-full bg-[#E5E7EB] border border-black py-1 px-3">
              <span className="font-bold text-slate-900 text-[11.5px]">
                Alcance del servicio:
              </span>
            </div>

            {/* ----------------- TABLES BY TYPE ----------------- */}

            {/* 1. VENTA TABLE */}
            {isVenta && (
              <div className="w-full">
                <table className="w-full border-collapse border border-black text-[11px]">
                  <thead>
                    <tr className="bg-[#E5E7EB] text-black font-bold">
                      <th className="py-1 px-2 text-center border border-black w-14">Cant.</th>
                      <th className="py-1 px-3 text-center border border-black">Descripción</th>
                      <th className="py-1 px-3 text-center border border-black w-28">P.Unit</th>
                      <th className="py-1 px-3 text-center border border-black w-28">P.Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-6 text-center text-slate-500 italic border border-black">
                          No se han especificado ítems para esta cotización.
                        </td>
                      </tr>
                    ) : (
                      items.map((item, idx) => {
                        const cant = parseFloat(item.CANTIDAD || '1') || 1;
                        const pUnit = parseFloat(String(item['P.UNIT'] || '0').replace(/,/g, '')) || 0;
                        const pTotal = parseFloat(String(item['P.TOTAL'] || '0').replace(/,/g, '')) || cant * pUnit;

                        return (
                          <tr key={idx} className="border border-black align-top">
                            <td className="py-2.5 px-2 text-center font-bold border border-black">
                              {cant}
                            </td>
                            <td className="py-2 px-3 border border-black">
                              <div className="flex items-start justify-between gap-4">
                                <div className="space-y-0.5">
                                  <p className="font-bold text-slate-950 text-[11.5px]">
                                    {item.DESCRIPCION || `Ítem #${idx + 1}`}
                                  </p>
                                  {item.DETALLE && (
                                    <div className="text-[10.5px] text-slate-800 whitespace-pre-line leading-snug">
                                      {item.DETALLE}
                                    </div>
                                  )}
                                </div>
                                {(item.FOTO || item.IMAGEN) && (
                                  <div className="shrink-0 w-24 h-16 border border-slate-300 rounded p-1 bg-white flex items-center justify-center">
                                    <img
                                      src={item.FOTO || item.IMAGEN}
                                      alt="Foto ítem"
                                      className="max-h-full max-w-full object-contain"
                                    />
                                  </div>
                                )}
                              </div>
                            </td>
                            <td className="py-2.5 px-3 text-right font-medium border border-black whitespace-nowrap">
                              {formatMoney(pUnit)}
                            </td>
                            <td className="py-2.5 px-3 text-right font-bold border border-black whitespace-nowrap">
                              {formatMoney(pTotal)}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* 2. OUTSOURCING TABLE */}
            {isOut && (
              <div className="w-full">
                <table className="w-full border-collapse border border-black text-[11px]">
                  <thead>
                    <tr className="bg-[#E5E7EB] text-black font-bold">
                      <th className="py-1 px-2 text-center border border-black w-14">N°</th>
                      <th className="py-1 px-3 text-center border border-black">Descripción</th>
                      <th className="py-1 px-3 text-center border border-black w-32">P.Unit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="py-6 text-center text-slate-500 italic border border-black">
                          No se han especificado ítems para esta cotización.
                        </td>
                      </tr>
                    ) : (
                      items.map((item, idx) => {
                        const pUnit = parseFloat(String(item['P.UNIT'] || '0').replace(/,/g, '')) || 0;

                        return (
                          <tr key={idx} className="border border-black align-top">
                            <td className="py-2.5 px-2 text-center font-bold border border-black">
                              {idx + 1}
                            </td>
                            <td className="py-2 px-3 border border-black">
                              <p className="font-bold text-slate-950 text-[11.5px]">
                                {item.DESCRIPCION || `Servicio de Soporte Técnico #${idx + 1}`}
                              </p>
                              {item.DETALLE && (
                                <div className="text-[10.5px] text-slate-800 whitespace-pre-line leading-snug mt-1">
                                  {item.DETALLE}
                                </div>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-right font-medium border border-black whitespace-nowrap">
                              {formatMoney(pUnit)}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* 3. ALQUILER TABLE */}
            {isAlquiler && (
              <div className="w-full">
                <table className="w-full border-collapse border border-black text-[11px]">
                  <thead>
                    <tr className="bg-[#E5E7EB] text-black font-bold">
                      <th className="py-1 px-2 text-center border border-black w-14">Cant.</th>
                      <th className="py-1 px-3 text-center border border-black">Descripción</th>
                      <th className="py-1 px-3 text-center border border-black w-24">P.Unit</th>
                      <th className="py-1 px-3 text-center border border-black w-24">Periodo</th>
                      <th className="py-1 px-3 text-center border border-black w-24">P.Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-6 text-center text-slate-500 italic border border-black">
                          No se han especificado ítems para esta cotización.
                        </td>
                      </tr>
                    ) : (
                      items.map((item, idx) => {
                        const cant = parseFloat(item.CANTIDAD || '1') || 1;
                        const pUnit = parseFloat(String(item['P.UNIT'] || '0').replace(/,/g, '')) || 0;
                        const pTotal = parseFloat(String(item['P.TOTAL'] || '0').replace(/,/g, '')) || cant * pUnit;
                        const periodo = item['M/D/S'] || item.PERIODO || '1 Mes';

                        return (
                          <tr key={idx} className="border border-black align-top">
                            <td className="py-2.5 px-2 text-center font-bold border border-black">
                              {cant}
                            </td>
                            <td className="py-2 px-3 border border-black">
                              <p className="font-bold text-slate-950 text-[11.5px]">
                                {item.DESCRIPCION || `Equipo en Alquiler #${idx + 1}`}
                              </p>
                              {item.DETALLE && (
                                <div className="text-[10px] text-slate-800 whitespace-pre-line leading-relaxed mt-0.5">
                                  {item.DETALLE}
                                </div>
                              )}
                            </td>
                            <td className="py-2.5 px-2 text-right font-medium border border-black whitespace-nowrap">
                              {formatMoney(pUnit)}
                            </td>
                            <td className="py-2.5 px-2 text-center font-medium border border-black whitespace-nowrap">
                              {periodo}
                            </td>
                            <td className="py-2.5 px-2 text-right font-bold border border-black whitespace-nowrap">
                              {formatMoney(pTotal)}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* ----------------- UNDER-TABLE SERVICES & FINANCIAL TOTALS ----------------- */}
            <div className="flex justify-between items-start pt-2 gap-4 text-[10.5px]">
              {/* Left Column: QUE INCLUYE / MESA DE AYUDA */}
              <div className="flex-1 space-y-3">
                {/* For VENTA */}
                {isVenta && (
                  <>
                    <div className="space-y-0.5">
                      <p className="font-bold text-slate-950 text-[11px]">QUE INCLUYE NUESTRO SERVICIO :</p>
                      <p className="text-slate-800">Servicio Tecnico Gratuito para Validacion de Garantia</p>
                      <p className="text-slate-800">Servicio de entrega en su direccion fiscal (Lima Metropolitana)</p>
                    </div>

                    <div className="space-y-0.5 pt-1">
                      <p className="font-bold text-slate-950 text-[11px]">MESA DE AYUDA :</p>
                      <p className="text-slate-800">Central : 719 - 9745 / Celular - WSP : 988 613 012</p>
                      <p className="text-slate-800">Correo : mesadeayuda@vassosp.pe</p>
                      <p className="text-slate-800">
                        <strong className="font-bold">HORARIO DE TRABAJO :</strong> De Lunes a Viernes de 8:30 am 6:00 pm
                      </p>
                      <p className="text-slate-800 pl-40">Sábado de 9:00 a 1:00 pm</p>
                    </div>
                  </>
                )}

                {/* For OUTSOURCING */}
                {isOut && (
                  <div className="space-y-0.5">
                    <p className="font-bold text-slate-950 text-[11px]">INCLUYE:</p>
                    <p className="text-slate-800">* Personal con SCTR</p>
                  </div>
                )}

                {/* For ALQUILER */}
                {isAlquiler && (
                  <>
                    <div className="space-y-0.5">
                      <p className="font-bold text-slate-950 text-[11px]">QUE INCLUYE NUESTRO SERVICIO :</p>
                      <p className="text-slate-800 flex items-center gap-1.5">
                        <span>Servicio Tecnico Gratuito, atención Remota de un especialista para su apoyo</span>
                      </p>
                      <p className="text-slate-800 flex items-center gap-1.5">
                        <span>Servicio de entrega en su direccion fiscal en menos de 24 horas (Lima Metropolitana)</span>
                      </p>
                      <p className="text-slate-800 flex items-center gap-1.5">
                        <span>Recambio de equipos en caso de Fallas en menos de 24 Horas</span>
                      </p>
                      <p className="text-slate-800 flex items-center gap-1.5">
                        <span>Reporte mensual de Servicio de Alquiler</span>
                      </p>
                    </div>

                    <div className="space-y-0.5 pt-1">
                      <p className="font-bold text-slate-950 text-[11px]">MESA DE AYUDA :</p>
                      <p className="text-slate-800">Central : 719 - 9745 / Celular - WSP : 988 613 012</p>
                      <p className="text-slate-800">Correo : mesadeayuda@vassosp.pe</p>
                      <p className="text-slate-800">
                        <strong className="font-bold">HORARIO DE TRABAJO :</strong> De Lunes a Viernes de 8:30 am 6:00 pm
                      </p>
                      <p className="text-slate-800 pl-40">Sábado de 9:00 a 1:00 pm</p>
                    </div>
                  </>
                )}
              </div>

              {/* Right Column: Financial Totals Table */}
              <div className="w-64 shrink-0 text-[11.5px]">
                <div className="space-y-1">
                  <div className="flex justify-between items-center text-slate-900">
                    <span className="font-normal">Monto Total</span>
                    <span className="font-medium whitespace-nowrap">{formatMoney(subtotal)}</span>
                  </div>
                  <div className="flex justify-between items-center text-slate-900">
                    <span className="font-normal">IGV 18%</span>
                    <span className="font-medium whitespace-nowrap">{formatMoney(igv)}</span>
                  </div>
                  <div className="flex justify-between items-center text-slate-950 font-bold border-t border-b border-black py-0.5 mt-1">
                    <span className="text-[12px] uppercase">TOTAL</span>
                    <span className="text-[12px] whitespace-nowrap">{formatMoney(total)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* ----------------- CONDICIONES COMERCIALES ----------------- */}
            <div className="border border-black p-2.5 text-[11px] space-y-0.5">
              <p className="font-bold text-slate-950">Condiciones comerciales:</p>
              <p className="text-slate-900">- Precios expresados en {currencyName}</p>
              <p className="text-slate-900">
                - Forma de pago: {headerData['F.PAGO'] || (isOut ? 'Factura a 15 Días' : isVenta ? 'Factura a 30 Días' : 'Factura a 15 Días')}
              </p>
              <p className="text-slate-900">
                - Validez de la cotización: {headerData['V.COT'] || (isOut ? '05 Días' : isVenta ? '7 días' : '07 dias')}
              </p>
              <p className="text-slate-900">
                - Disponibilidad: {headerData['DISPONIBILIDAD'] || (isOut ? '- Previa Orden de Compra' : isVenta ? 'A pedido - Previa Orden de Compra' : 'En Stock - Previa Orden de Compra')}
              </p>

              {/* Extra clauses for Alquiler */}
              {isAlquiler && (
                <div className="pt-1.5 space-y-0.5 text-[10.5px]">
                  <p className="font-bold text-slate-950">* Responsabilidades del Cliente sobre los Equipos</p>
                  <p className="text-slate-800">* Sobre la Pérdida, Sustracción, Daño físico o mal deterioro del equipo o parte de ellos.</p>
                  <p className="text-slate-800">* Suministro adecuado de voltaje electrico, continuo y estable sobre los equipos</p>
                </div>
              )}
            </div>
          </div>

          {/* ----------------- FOOTER: DATOS DE LA EMPRESA & FIRMA ----------------- */}
          <div className="pt-6 mt-4">
            <div className="flex justify-between items-end gap-6 text-[10.5px]">
              {/* Left: Company & Banking Data */}
              <div className="space-y-2">
                <div className="space-y-0.5">
                  <p className="font-bold text-slate-950 text-[11px]">DATOS DE LA EMPRESA</p>
                  <p className="text-slate-900">Razón Social: Vassosp Trading EIRL</p>
                  <p className="text-slate-900">Ruc: 20509427241</p>
                </div>

                <div className="space-y-0.5 pt-1">
                  <p className="font-bold text-slate-950 text-[11px]">CUENTAS CORRIENTES</p>
                  <div className="grid grid-cols-[80px_1fr] gap-x-2 text-[10px]">
                    <span className="font-semibold text-slate-900">Cuentas BCP:</span>
                    <div>
                      <p>Moneda Extranjera: 194-1489313-1-74</p>
                      <p>Moneda Nacional: 194-1504362-075</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-[80px_1fr] gap-x-2 text-[10px] pt-0.5">
                    <span className="font-semibold text-slate-900">Cuentas BBVA:</span>
                    <div>
                      <p>Moneda Extranjera: 0011-0013-0100001269</p>
                      <p>Moneda Nacional: 0011-0013-0100013283</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right: Signature & Sales Rep Block */}
              <div className="flex flex-col items-center text-center min-w-[220px]">
                {vendedor?.FIRMA ? (
                  <div className="h-14 flex items-center justify-center mb-0.5">
                    <img
                      src={vendedor.FIRMA}
                      alt="Firma del Gestor Comercial"
                      className="max-h-14 max-w-[180px] object-contain"
                    />
                  </div>
                ) : (
                  <div className="h-12 flex items-end justify-center mb-1">
                    {/* SVG Signature representation if no custom image */}
                    <svg className="w-36 h-10 text-slate-800" viewBox="0 0 160 50" fill="none">
                      <path
                        d="M10 35 C30 10, 45 45, 60 20 C75 5, 85 40, 100 25 C115 15, 130 35, 150 20 M30 30 C70 30, 110 25, 140 28"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                      />
                    </svg>
                  </div>
                )}

                <div className="w-48 border-b border-black mb-1" />

                <p className="font-bold text-slate-950 text-[11.5px]">
                  {vendedor?.VENDEDOR || cotizacion.VENDEDOR || 'Gestor Comercial'}
                </p>
                <p className="text-[10px] text-slate-700 font-medium">Gestor Comercial</p>

                {/* WhatsApp & Email line with green WhatsApp icon */}
                <div className="flex items-center justify-center gap-2 mt-1 text-[10px] text-slate-800">
                  <span className="flex items-center gap-1">
                    <span className="w-3.5 h-3.5 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[9px] font-bold">
                      <Phone className="w-2.5 h-2.5" />
                    </span>
                    {vendedor?.TELEFONO || '988 612 995'}
                  </span>
                  <span className="text-slate-400">|</span>
                  <span className="flex items-center gap-1">
                    <Mail className="w-3 h-3 text-slate-500" />
                    {vendedor?.CORREO || 'ventas@vassosp.pe'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

