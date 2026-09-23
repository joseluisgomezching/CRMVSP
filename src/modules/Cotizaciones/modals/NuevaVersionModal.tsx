import { useState } from 'react';
import { Cotizacion, ItemVenta, CalculoVenta, ItemAlquiler, CalculoAlquiler, ItemOut, CalculoOut } from '../../../types';
import {
  parseVassId,
  getNextVersionNumber,
  getNextIdCot,
  createCotizacion,
  saveDocumentFull,
  normalizeId
} from '../../../lib/cotizacionesApi';
import { X, Copy, GitBranch, AlertCircle, Sparkles, CheckCircle } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newCotizacion: Cotizacion) => void;
  cotizacion: Cotizacion | null;
  allCotizaciones: Cotizacion[];
  // Document state for cloning
  docType: 'VENTA' | 'ALQUILER' | 'OUTSOURCING' | string;
  headerData: any;
  items: any[];
  calculos: any[];
}

export default function NuevaVersionModal({
  isOpen,
  onClose,
  onSuccess,
  cotizacion,
  allCotizaciones,
  docType,
  headerData,
  items,
  calculos
}: Props) {
  const [isCreating, setIsCreating] = useState(false);
  const todayStr = new Date().toISOString().split('T')[0];

  if (!isOpen || !cotizacion) return null;

  const parsed = parseVassId(cotizacion.ID);
  const correlativo = parsed ? parsed.correlativo : 1;
  const year = parsed ? parsed.year : (new Date().getFullYear() % 100);
  const nextVerNum = getNextVersionNumber(allCotizaciones, correlativo, year);

  const nextVerStr = String(nextVerNum).padStart(2, '0');
  const newVassId = `VASS ${String(correlativo).padStart(3, '0')}(${String(year).padStart(2, '0')})v.${nextVerStr}`;
  const newIdCot = getNextIdCot(allCotizaciones);

  const handleCreateVersion = async () => {
    setIsCreating(true);
    try {
      // 1. Create new master Cotizacion record
      const newCot: Cotizacion = {
        ID_COT: newIdCot,
        ID: newVassId,
        FECHA: todayStr,
        CLIENTE: cotizacion.CLIENTE,
        RUC: cotizacion.RUC,
        VENDEDOR: cotizacion.VENDEDOR,
        DETALLE: cotizacion.DETALLE ? `${cotizacion.DETALLE} (v.${nextVerStr})` : `Versión ${nextVerStr}`,
        STATUS: 'INGRESADO',
        DOCUMENTO: docType || cotizacion.DOCUMENTO || 'VENTA',
        REFERENTE: cotizacion.REFERENTE,
        PDF: ''
      };

      await createCotizacion(newCot);

      // 2. Clone Document Header, Items and Calculations if document exists
      if (docType && ['VENTA', 'ALQUILER', 'OUTSOURCING'].includes(docType) && items.length > 0) {
        // Map old item IDs to new item IDs
        const itemMap: { [oldId: string]: string } = {};
        const clonedItems = items.map((item, idx) => {
          const oldId = normalizeId(item.ID);
          const newItemId = `${newVassId}-${idx + 1}`;
          if (oldId) itemMap[oldId] = newItemId;
          return {
            ...item,
            ID: newItemId,
            NCOTI: newVassId
          };
        });

        // Clone calculations mapping IDITEM to newItemId
        const clonedCalculos = calculos.map((calc, idx) => {
          const oldItemId = normalizeId(calc.IDITEM);
          const mappedItemId = itemMap[oldItemId] || `${newVassId}-1`;
          return {
            ...calc,
            ID: `${mappedItemId}-C${idx + 1}`,
            IDITEM: mappedItemId
          };
        });

        // Clone header data
        const clonedHeader = {
          ...headerData,
          ID: newVassId,
          FECHA: todayStr,
          CLIENTE: cotizacion.CLIENTE
        };

        await saveDocumentFull(
          newCot,
          docType as 'VENTA' | 'ALQUILER' | 'OUTSOURCING',
          clonedHeader,
          clonedItems,
          clonedCalculos
        );
      }

      onSuccess(newCot);
      onClose();
    } catch (err: any) {
      console.error(err);
      alert(`Error al generar la nueva versión: ${err.message || err}`);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-lg shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-800 bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 font-bold">
              <GitBranch className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                Generar Nueva Versión
              </h2>
              <p className="text-xs text-slate-400">Crea una nueva iteración comercial</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {/* Comparison Cards */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 rounded-2xl bg-slate-800/40 border border-slate-700">
              <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Versión Base</span>
              <p className="font-mono text-sm font-bold text-slate-300">{cotizacion.ID}</p>
              <p className="text-xs text-slate-400 mt-1">{cotizacion.ID_COT}</p>
            </div>

            <div className="p-4 rounded-2xl bg-indigo-950/40 border border-indigo-500/40">
              <span className="text-[10px] uppercase font-bold text-indigo-400 block mb-1">Nueva Versión</span>
              <p className="font-mono text-sm font-bold text-indigo-300">{newVassId}</p>
              <p className="text-xs text-indigo-400 mt-1">{newIdCot}</p>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-800/60 border border-slate-700 space-y-2.5 text-xs text-slate-300">
            <div className="flex items-center gap-2 text-slate-400 font-semibold">
              <AlertCircle className="w-4 h-4 text-indigo-400" />
              <span>Reglas de Versionamiento VASS:</span>
            </div>
            <ul className="space-y-1.5 pl-6 list-disc text-slate-400">
              <li>El identificador comercial incrementa a <strong className="text-white">v.{nextVerStr}</strong>.</li>
              <li>Se asigna un nuevo código técnico correlativo global <strong className="text-white">{newIdCot}</strong>.</li>
              <li>Se clona la información de ítems y cálculos existentes.</li>
              <li>El estado inicial de la nueva versión será <span className="text-indigo-400 font-bold">INGRESADO</span> con fecha de hoy.</li>
              <li>La versión original ({cotizacion.ID}) queda intacta en su estado actual.</li>
            </ul>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isCreating}
              className="px-5 py-2.5 rounded-xl border border-slate-700 text-slate-300 text-sm font-semibold hover:bg-slate-800 hover:text-white transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleCreateVersion}
              disabled={isCreating}
              className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold rounded-xl shadow-lg shadow-indigo-600/30 transition-all disabled:opacity-50"
            >
              {isCreating ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Clonando Versión...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Crear Versión v.{nextVerStr}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
