import React, { useState, useEffect, useMemo } from 'react';
import {
  Cotizacion, Cliente, Vendedor, Venta, ItemVenta, CalculoVenta,
  Alquiler, ItemAlquiler, CalculoAlquiler, Out, ItemOut, CalculoOut,
  CotizacionesData
} from '../../types';
import {
  normalizeId,
  parseVassId,
  saveDocumentFull,
  updateCotizacion,
  updateCotizacionStatus,
  deleteCotizacionCascade
} from '../../lib/cotizacionesApi';
import {
  Plus, Search, Filter, FileText, ChevronRight, Calendar, Building2,
  UserCheck, CheckCircle2, Clock, Check, X, Trash2, Edit3, GitBranch,
  Printer, Save, DollarSign, Calculator, ChevronDown, ChevronUp, Copy,
  Eye, AlertTriangle, Layers, ArrowUpRight, Sparkles, RefreshCw, Phone, Mail, Image as ImageIcon
} from 'lucide-react';
import NuevaCotizacionModal from './modals/NuevaCotizacionModal';
import EditarCotizacionModal from './modals/EditarCotizacionModal';
import NuevaVersionModal from './modals/NuevaVersionModal';
import CotizacionA4Preview from './CotizacionA4Preview';
import { LOGO_COTIZACION_URL, LOGO_COTIZACION_BACKUP_URL } from '../../lib/logoConstants';

interface Props {
  data: CotizacionesData;
  onDataRefresh: () => Promise<void>;
}

export default function CotizarTab({ data, onDataRefresh }: Props) {
  const currentYearFull = new Date().getFullYear();
  const currentYear2Digit = currentYearFull % 100;

  // Selected Quotation
  const [selectedCot, setSelectedCot] = useState<Cotizacion | null>(null);

  // View Mode: 'EDITOR' or 'A4_PREVIEW'
  const [viewMode, setViewMode] = useState<'EDITOR' | 'A4_PREVIEW'>('EDITOR');

  // Filters
  const [selectedYear, setSelectedYear] = useState<number>(currentYear2Digit);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('TODOS');

  // Modals
  const [showNewModal, setShowNewModal] = useState<boolean>(false);
  const [showEditModal, setShowEditModal] = useState<boolean>(false);
  const [showVersionModal, setShowVersionModal] = useState<boolean>(false);

  // Document Editor State
  const [docType, setDocType] = useState<'VENTA' | 'ALQUILER' | 'OUTSOURCING' | 'NO SE CREO DOCUMENTO'>('VENTA');
  const [currency, setCurrency] = useState<'PEN' | 'USD'>('PEN');
  const [exchangeRate, setExchangeRate] = useState<number>(3.75);

  const [headerData, setHeaderData] = useState<any>({
    'SUB TOTAL': '0.00',
    IGV: '0.00',
    TOTAL: '0.00',
    'F.PAGO': 'Contado contra entrega',
    'V.COT': '15 días calendario',
    DISPONIBILIDAD: 'Inmediata / Stock',
    REFERENCIA: '',
    'P.EXP': ''
  });

  const [items, setItems] = useState<any[]>([]);
  const [calculos, setCalculos] = useState<any[]>([]);
  const [expandedItems, setExpandedItems] = useState<{ [key: number]: boolean }>({ 0: true });

  const [isSavingDoc, setIsSavingDoc] = useState<boolean>(false);
  const [saveFeedback, setSaveFeedback] = useState<string | null>(null);

  // Extract distinct years from all quotes
  const availableYears = useMemo(() => {
    const yearsSet = new Set<number>();
    yearsSet.add(currentYear2Digit);
    data.cotizaciones.forEach(c => {
      const parsed = parseVassId(c.ID);
      if (parsed) yearsSet.add(parsed.year);
    });
    return Array.from(yearsSet).sort((a, b) => b - a);
  }, [data.cotizaciones, currentYear2Digit]);

  // Extract numeric ID_COT for sorting (e.g., "C-0120" -> 120, "C-0001" -> 1)
  const parseIdCotNumber = (idCot: string | undefined): number => {
    if (!idCot) return 0;
    const match = idCot.match(/\d+/g);
    if (match) {
      return parseInt(match.join(''), 10) || 0;
    }
    return 0;
  };

  // Filtered & Sorted Quotations: ALWAYS from most recent to oldest referencing ID_COT
  const filteredCotizaciones = useMemo(() => {
    const list = data.cotizaciones.filter(c => {
      const parsed = parseVassId(c.ID);
      // Filter year
      if (selectedYear !== null && parsed && parsed.year !== selectedYear) {
        return false;
      }
      // Filter status
      if (selectedStatus !== 'TODOS' && c.STATUS !== selectedStatus) {
        return false;
      }
      // Filter search text
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matches =
          (c.ID || '').toLowerCase().includes(q) ||
          (c.ID_COT || '').toLowerCase().includes(q) ||
          (c.CLIENTE || '').toLowerCase().includes(q) ||
          (c.RUC || '').toLowerCase().includes(q) ||
          (c.VENDEDOR || '').toLowerCase().includes(q) ||
          (c.DETALLE || '').toLowerCase().includes(q) ||
          (c.REFERENTE || '').toLowerCase().includes(q) ||
          (c.DOCUMENTO || '').toLowerCase().includes(q);
        if (!matches) return false;
      }
      return true;
    });

    // Sort descending by ID_COT (mas reciente al mas antiguo)
    return list.sort((a, b) => {
      const numA = parseIdCotNumber(a.ID_COT);
      const numB = parseIdCotNumber(b.ID_COT);

      if (numA !== numB) {
        return numB - numA; // Higher numeric ID_COT comes first (most recent)
      }

      // Natural string comparison descending if numbers match or both zero
      const strComp = (b.ID_COT || '').localeCompare(a.ID_COT || '', undefined, { numeric: true, sensitivity: 'base' });
      if (strComp !== 0) return strComp;

      // If ID_COT is equal (e.g. revisions/versions), sort by version descending
      const parsedA = parseVassId(a.ID);
      const parsedB = parseVassId(b.ID);
      if (parsedA && parsedB) {
        if (parsedB.correlativo !== parsedA.correlativo) {
          return parsedB.correlativo - parsedA.correlativo;
        }
        if (parsedB.version !== parsedA.version) {
          return parsedB.version - parsedA.version;
        }
      }

      // Secondary fallback: Row index in spreadsheet descending (most recent row first)
      return (b._rowIndex || 0) - (a._rowIndex || 0);
    });
  }, [data.cotizaciones, selectedYear, selectedStatus, searchQuery]);

  // Keep selectedCot in sync when data updates
  useEffect(() => {
    if (selectedCot) {
      const updated = data.cotizaciones.find(
        c => (c.ID && c.ID === selectedCot.ID) || (c.ID_COT && c.ID_COT === selectedCot.ID_COT)
      );
      if (updated && updated !== selectedCot) {
        setSelectedCot(updated);
      }
    }
  }, [data.cotizaciones]);

  // Load Document Data when selectedCot changes
  useEffect(() => {
    if (!selectedCot) {
      setItems([]);
      setCalculos([]);
      setHeaderData({
        'SUB TOTAL': '0.00',
        IGV: '0.00',
        TOTAL: '0.00',
        'F.PAGO': 'Contado contra entrega',
        'V.COT': '15 días calendario',
        DISPONIBILIDAD: 'Inmediata / Stock',
        REFERENCIA: '',
        'P.EXP': ''
      });
      return;
    }

    const idVass = normalizeId(selectedCot.ID);
    const currDocType = (selectedCot.DOCUMENTO as any) || 'VENTA';
    setDocType(currDocType);

    if (currDocType === 'VENTA') {
      const vHeader = data.ventas.find(v => normalizeId(v.ID) === idVass);
      const vItems = data.itemsVenta.filter(i => normalizeId(i.NCOTI) === idVass || normalizeId(i.ID).startsWith(idVass));
      const itemIds = vItems.map(i => normalizeId(i.ID));
      const vCalcs = data.calculosVenta.filter(c => itemIds.includes(normalizeId(c.IDITEM)) || normalizeId(c.ID).startsWith(idVass));

      setHeaderData({
        'SUB TOTAL': vHeader?.['SUB TOTAL'] || '0.00',
        IGV: vHeader?.IGV || '0.00',
        TOTAL: vHeader?.TOTAL || '0.00',
        'F.PAGO': vHeader?.['F.PAGO'] || 'Contado contra entrega',
        'V.COT': vHeader?.['V.COT'] || '15 días calendario',
        DISPONIBILIDAD: vHeader?.DISPONIBILIDAD || 'Inmediata / Stock',
        REFERENCIA: vHeader?.REFERENCIA || '',
        'P.EXP': vHeader?.['P.EXP'] || ''
      });
      setItems(vItems.length > 0 ? vItems : [getInitialItem('VENTA', idVass, 1)]);
      setCalculos(vCalcs.length > 0 ? vCalcs : [getInitialCalc('VENTA', `${idVass}-1`, 1)]);
    } else if (currDocType === 'ALQUILER') {
      const aHeader = data.alquileres.find(a => normalizeId(a.ID) === idVass);
      const aItems = data.itemsAlquiler.filter(i => normalizeId(i.NCOTI) === idVass || normalizeId(i.ID).startsWith(idVass));
      const itemIds = aItems.map(i => normalizeId(i.ID));
      const aCalcs = data.calculosAlquiler.filter(c => itemIds.includes(normalizeId(c.IDITEM)) || normalizeId(c.ID).startsWith(idVass));

      setHeaderData({
        'SUB TOTAL': aHeader?.['SUB TOTAL'] || '0.00',
        IGV: aHeader?.IGV || '0.00',
        TOTAL: aHeader?.TOTAL || '0.00',
        'F.PAGO': aHeader?.['F.PAGO'] || 'Contado contra entrega',
        'V.COT': aHeader?.['V.COT'] || '15 días calendario',
        DISPONIBILIDAD: aHeader?.DISPONIBILIDAD || 'Inmediata / Stock',
        REFERENCIA: aHeader?.REFERENCIA || '',
        'P.EXP': aHeader?.['P.EXP'] || ''
      });
      setItems(aItems.length > 0 ? aItems : [getInitialItem('ALQUILER', idVass, 1)]);
      setCalculos(aCalcs.length > 0 ? aCalcs : [getInitialCalc('ALQUILER', `${idVass}-1`, 1)]);
    } else if (currDocType === 'OUTSOURCING') {
      const oHeader = data.outs.find(o => normalizeId(o.ID) === idVass);
      const oItems = data.itemsOut.filter(i => normalizeId(i.NCOTI) === idVass || normalizeId(i.ID).startsWith(idVass));
      const itemIds = oItems.map(i => normalizeId(i.ID));
      const oCalcs = data.calculosOut.filter(c => itemIds.includes(normalizeId(c.IDITEM)) || normalizeId(c.ID).startsWith(idVass));

      setHeaderData({
        'SUB TOTAL': oHeader?.['SUB TOTAL'] || '0.00',
        IGV: oHeader?.IGV || '0.00',
        TOTAL: oHeader?.TOTAL || '0.00',
        'F.PAGO': oHeader?.['F.PAGO'] || 'Contado contra entrega',
        'V.COT': oHeader?.['V.COT'] || '15 días calendario',
        DISPONIBILIDAD: oHeader?.DISPONIBILIDAD || 'Inmediata / Stock',
        REFERENCIA: oHeader?.REFERENCIA || '',
        'P.EXP': oHeader?.['P.EXP'] || ''
      });
      setItems(oItems.length > 0 ? oItems : [getInitialItem('OUTSOURCING', idVass, 1)]);
      setCalculos(oCalcs.length > 0 ? oCalcs : [getInitialCalc('OUTSOURCING', `${idVass}-1`, 1)]);
    } else {
      setItems([]);
      setCalculos([]);
    }
  }, [selectedCot, data]);

  // Initial Item Factory
  function getInitialItem(type: string, idVass: string, index: number) {
    const id = `${idVass}-${index}`;
    if (type === 'VENTA') {
      return {
        ID: id,
        NCOTI: idVass,
        CANTIDAD: '1',
        DESCRIPCION: '',
        'P.UNIT': '0.00',
        'P.TOTAL': '0.00',
        DETALLE: '',
        FOTO: ''
      };
    } else if (type === 'ALQUILER') {
      return {
        ID: id,
        NCOTI: idVass,
        CANTIDAD: '1',
        DESCRIPCION: '',
        'P.UNIT': '0.00',
        'P.TOTAL': '0.00',
        DETALLE: '',
        'M/D/S': '1 Mes'
      };
    } else {
      return {
        ID: id,
        NCOTI: idVass,
        CANTIDAD: '1',
        DESCRIPCION: '',
        'P.UNIT': '0.00',
        DETALLE: ''
      };
    }
  }

  // Initial Calc Factory
  function getInitialCalc(type: string, itemId: string, index: number) {
    const id = `${itemId}-C${index}`;
    if (type === 'VENTA') {
      return {
        ID: id,
        IDITEM: itemId,
        PROVEEDOR: '',
        DETALLE: '',
        COSTO: '0.00',
        PORCENTAJE: '30',
        'P.VENTA': '0.00',
        MARGEN: '0.00'
      };
    } else if (type === 'ALQUILER') {
      return {
        ID: id,
        IDITEM: itemId,
        PROVEEDOR: '',
        DETALLE: '',
        COSTO: '0.00',
        CANTIDAD: '1',
        PORCENTAJE: '30',
        'P.VENTA': '0.00',
        MARGEN: '0.00',
        'M.TOTAL': '0.00',
        'C.TOTAL': '0.00'
      };
    } else {
      return {
        ID: id,
        IDITEM: itemId,
        SERVICIO: '',
        PERSONAL: '1',
        DIAS: '1',
        'C.TOTAL': '0.00',
        PORCENTAJE: '30',
        'P.VENTA': '0.00'
      };
    }
  }

  // Recalculate Totals from items
  const recalculateDocumentTotals = (currentItems: any[]) => {
    let sub = 0;
    currentItems.forEach(it => {
      const cant = parseFloat(it.CANTIDAD || '1') || 1;
      const unit = parseFloat(it['P.UNIT'] || '0') || 0;
      const tot = parseFloat(it['P.TOTAL'] || '0') || (cant * unit);
      sub += tot;
    });
    const igv = sub * 0.18;
    const totGen = sub + igv;

    setHeaderData((prev: any) => ({
      ...prev,
      'SUB TOTAL': sub.toFixed(2),
      IGV: igv.toFixed(2),
      TOTAL: totGen.toFixed(2)
    }));
  };

  // ----------------- ITEM & CALC MANIPULATIONS -----------------

  const handleAddItem = () => {
    if (!selectedCot) return;
    const idVass = normalizeId(selectedCot.ID);
    const newIdx = items.length + 1;
    const newItem = getInitialItem(docType, idVass, newIdx);
    const newCalc = getInitialCalc(docType, newItem.ID, 1);

    const updatedItems = [...items, newItem];
    const updatedCalcs = [...calculos, newCalc];

    setItems(updatedItems);
    setCalculos(updatedCalcs);
    setExpandedItems(prev => ({ ...prev, [updatedItems.length - 1]: true }));
    recalculateDocumentTotals(updatedItems);
  };

  const handleDeleteItem = (index: number) => {
    if (items.length <= 1) {
      alert('Debe existir al menos un ítem.');
      return;
    }
    const itemToDelete = items[index];
    const itemId = normalizeId(itemToDelete.ID);

    const updatedItems = items.filter((_, idx) => idx !== index);
    const updatedCalcs = calculos.filter(c => normalizeId(c.IDITEM) !== itemId);

    setItems(updatedItems);
    setCalculos(updatedCalcs);
    recalculateDocumentTotals(updatedItems);
  };

  const handleItemChange = (index: number, field: string, value: string) => {
    const updatedItems = [...items];
    updatedItems[index] = { ...updatedItems[index], [field]: value };

    // If Cantidad changed, recalculate P.TOTAL
    if (field === 'CANTIDAD') {
      const cant = parseFloat(value || '1') || 1;
      const unit = parseFloat(updatedItems[index]['P.UNIT'] || '0') || 0;
      updatedItems[index]['P.TOTAL'] = (cant * unit).toFixed(2);
    }

    setItems(updatedItems);
    recalculateDocumentTotals(updatedItems);
  };

  const handleAddCalculation = (itemIndex: number) => {
    const item = items[itemIndex];
    if (!item) return;
    const itemId = normalizeId(item.ID);
    const itemCalcs = calculos.filter(c => normalizeId(c.IDITEM) === itemId);
    const newCalc = getInitialCalc(docType, itemId, itemCalcs.length + 1);

    setCalculos([...calculos, newCalc]);
  };

  const handleDeleteCalculation = (calcId: string, itemIndex: number) => {
    const item = items[itemIndex];
    if (!item) return;
    const itemId = normalizeId(item.ID);
    const itemCalcs = calculos.filter(c => normalizeId(c.IDITEM) === itemId);
    if (itemCalcs.length <= 1) {
      alert('Cada ítem debe tener al menos una línea de cálculo de costo.');
      return;
    }

    const updatedCalcs = calculos.filter(c => c.ID !== calcId);
    setCalculos(updatedCalcs);

    // Recalculate Item P.UNIT from remaining calcs
    recalculateItemFromCalculations(itemIndex, updatedCalcs);
  };

  const handleCalcChange = (calcId: string, itemIndex: number, field: string, value: string) => {
    const updatedCalcs = calculos.map(c => {
      if (c.ID !== calcId) return c;
      const updated = { ...c, [field]: value };

      // Apply Formulas based on docType
      if (docType === 'VENTA') {
        const costo = parseFloat(field === 'COSTO' ? value : updated.COSTO || '0') || 0;
        const pct = parseFloat(field === 'PORCENTAJE' ? value : updated.PORCENTAJE || '0') || 0;
        // Formula: P.VENTA = Costo / (1 - % / 100)
        let pVenta = costo;
        if (pct < 100) {
          pVenta = costo / (1 - pct / 100);
        }
        const margen = pVenta - costo;

        updated.COSTO = costo.toFixed(2);
        updated.PORCENTAJE = pct.toString();
        updated['P.VENTA'] = pVenta.toFixed(2);
        updated.MARGEN = margen.toFixed(2);
      } else if (docType === 'ALQUILER') {
        const costo = parseFloat(field === 'COSTO' ? value : updated.COSTO || '0') || 0;
        const cant = parseFloat(field === 'CANTIDAD' ? value : updated.CANTIDAD || '1') || 1;
        const pct = parseFloat(field === 'PORCENTAJE' ? value : updated.PORCENTAJE || '0') || 0;
        let pVenta = costo;
        if (pct < 100) {
          pVenta = costo / (1 - pct / 100);
        }
        const margen = pVenta - costo;
        const mTotal = margen * cant;
        const cTotal = costo * cant;

        updated.COSTO = costo.toFixed(2);
        updated.CANTIDAD = cant.toString();
        updated.PORCENTAJE = pct.toString();
        updated['P.VENTA'] = pVenta.toFixed(2);
        updated.MARGEN = margen.toFixed(2);
        updated['M.TOTAL'] = mTotal.toFixed(2);
        updated['C.TOTAL'] = cTotal.toFixed(2);
      } else if (docType === 'OUTSOURCING') {
        const personal = parseFloat(field === 'PERSONAL' ? value : updated.PERSONAL || '1') || 1;
        const dias = parseFloat(field === 'DIAS' ? value : updated.DIAS || '1') || 1;
        const cUnit = parseFloat(field === 'C.TOTAL' ? value : updated['C.TOTAL'] || '0') || 0;
        const pct = parseFloat(field === 'PORCENTAJE' ? value : updated.PORCENTAJE || '0') || 0;
        const cTotal = personal * dias * cUnit;
        let pVenta = cTotal;
        if (pct < 100) {
          pVenta = cTotal / (1 - pct / 100);
        }
        updated.PERSONAL = personal.toString();
        updated.DIAS = dias.toString();
        updated['C.TOTAL'] = cUnit.toFixed(2);
        updated.PORCENTAJE = pct.toString();
        updated['P.VENTA'] = pVenta.toFixed(2);
      }

      return updated;
    });

    setCalculos(updatedCalcs);
    recalculateItemFromCalculations(itemIndex, updatedCalcs);
  };

  const recalculateItemFromCalculations = (itemIndex: number, currentCalcs: any[]) => {
    const item = items[itemIndex];
    if (!item) return;
    const itemId = normalizeId(item.ID);
    const itemCalcs = currentCalcs.filter(c => normalizeId(c.IDITEM) === itemId);

    // Sum P.VENTA of all calculations for this item
    const totalUnitVenta = itemCalcs.reduce((acc, c) => acc + (parseFloat(c['P.VENTA'] || '0') || 0), 0);
    const cant = parseFloat(item.CANTIDAD || '1') || 1;
    const totalItem = totalUnitVenta * cant;

    const updatedItems = [...items];
    updatedItems[itemIndex] = {
      ...updatedItems[itemIndex],
      'P.UNIT': totalUnitVenta.toFixed(2),
      'P.TOTAL': totalItem.toFixed(2)
    };

    setItems(updatedItems);
    recalculateDocumentTotals(updatedItems);
  };

  // ----------------- SAVE DOCUMENT FULL -----------------

  const handleSaveDocument = async () => {
    if (!selectedCot) return;
    if (docType === 'NO SE CREO DOCUMENTO') {
      alert('Por favor selecciona una modalidad válida (VENTA, ALQUILER u OUTSOURCING).');
      return;
    }

    setIsSavingDoc(true);
    setSaveFeedback(null);
    try {
      // If basic cotizacion fields changed, also update the main COTIZACION row
      if (selectedCot._rowIndex) {
        await updateCotizacion(selectedCot._rowIndex, selectedCot);
      }

      await saveDocumentFull(
        selectedCot,
        docType as 'VENTA' | 'ALQUILER' | 'OUTSOURCING',
        headerData,
        items,
        calculos
      );
      setSaveFeedback('¡Documento y cotización guardados con éxito!');
      await onDataRefresh();
      setTimeout(() => setSaveFeedback(null), 3500);
    } catch (err: any) {
      console.error('Error saving document:', err);
      alert(`Error al guardar documento: ${err.message || err}`);
    } finally {
      setIsSavingDoc(false);
    }
  };

  // ----------------- STATUS CHANGE HANDLER -----------------

  const handleQuickStatusChange = async (newStatus: string) => {
    if (!selectedCot || !selectedCot._rowIndex) return;
    try {
      await updateCotizacionStatus(selectedCot._rowIndex, newStatus);
      setSelectedCot({ ...selectedCot, STATUS: newStatus });
      await onDataRefresh();
    } catch (err: any) {
      console.error(err);
      alert(`Error al cambiar estado: ${err.message || err}`);
    }
  };

  // ----------------- DELETE COTIZACION HANDLER -----------------

  const handleDeleteCotizacion = async () => {
    if (!selectedCot) return;
    const confirmText = `¿Estás seguro de ELIMINAR la cotización ${selectedCot.ID} (${selectedCot.ID_COT})?\n\nEsta acción eliminará la ficha, ítems y cálculos asociados a esta versión específica.`;
    if (!window.confirm(confirmText)) return;

    try {
      await deleteCotizacionCascade(selectedCot);
      setSelectedCot(null);
      await onDataRefresh();
      alert('Cotización eliminada correctamente.');
    } catch (err: any) {
      console.error('Error deleting cotizacion:', err);
      alert(`Error al eliminar: ${err.message || err}`);
    }
  };

  // Helper status badge styles
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'INGRESADO':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'PENDIENTE':
        return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
      case 'SALIO':
        return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
      case 'NO SALIO':
        return 'bg-rose-500/20 text-rose-400 border-rose-500/30';
      default:
        return 'bg-slate-700 text-slate-300 border-slate-600';
    }
  };

  // If in A4 Preview Mode, render A4 preview
  if (viewMode === 'A4_PREVIEW' && selectedCot) {
    const selectedVendedorObj = data.vendedores.find(v => v.VENDEDOR === selectedCot.VENDEDOR);
    const selectedClienteObj = data.clientes.find(c => c.CLIENTE === selectedCot.CLIENTE);

    return (
      <CotizacionA4Preview
        cotizacion={selectedCot}
        vendedor={selectedVendedorObj}
        cliente={selectedClienteObj}
        docType={docType}
        headerData={headerData}
        items={items}
        currency={currency}
        exchangeRate={exchangeRate}
        onBack={() => setViewMode('EDITOR')}
      />
    );
  }

  return (
    <div className="flex flex-col lg:flex-row w-full h-full overflow-hidden bg-slate-950 text-slate-200">
      {/* ----------------- LEFT PANEL (COTIZACIONES LIST & CARDS) ----------------- */}
      <div className="w-full lg:w-[380px] xl:w-[420px] flex flex-col border-r border-slate-800 bg-slate-900/70 shrink-0 h-full overflow-hidden">
        {/* Top Header of Left Panel */}
        <div className="p-4 border-b border-slate-800 space-y-3 shrink-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 font-bold text-sm">
                <FileText className="w-4 h-4" />
              </div>
              <h2 className="text-sm font-bold text-white tracking-tight">
                Cotizaciones VASS
              </h2>
            </div>

            <button
              onClick={() => setShowNewModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-blue-600/30 transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Nueva</span>
            </button>
          </div>

          {/* Search Bar */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar por ID, Cliente, RUC, Detalle..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>

          {/* Year & Status Filter Tabs */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            {/* Year Selector */}
            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
              <span className="text-[10px] font-bold text-slate-400 px-1.5">AÑO:</span>
              {availableYears.map(yr => (
                <button
                  key={yr}
                  onClick={() => setSelectedYear(yr)}
                  className={`px-2 py-0.5 rounded text-[11px] font-bold font-mono transition-colors ${
                    selectedYear === yr
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  20{String(yr).padStart(2, '0')}
                </button>
              ))}
            </div>

            <button
              onClick={onDataRefresh}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
              title="Actualizar datos"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Status Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-[11px]">
            {['TODOS', 'INGRESADO', 'PENDIENTE', 'SALIO', 'NO SALIO'].map(st => {
              const isActive = selectedStatus === st;
              return (
                <button
                  key={st}
                  onClick={() => setSelectedStatus(st)}
                  className={`px-2.5 py-1 rounded-full font-bold whitespace-nowrap transition-all border ${
                    isActive
                      ? 'bg-blue-600 text-white border-blue-500 shadow-sm'
                      : 'bg-slate-950/70 text-slate-400 border-slate-800 hover:text-white'
                  }`}
                >
                  {st}
                </button>
              );
            })}
          </div>
        </div>

        {/* List of Quotation Cards */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
          {filteredCotizaciones.length === 0 ? (
            <div className="py-16 text-center text-slate-500 text-xs flex flex-col items-center gap-2">
              <FileText className="w-8 h-8 text-slate-600" />
              <span>No se encontraron cotizaciones para este filtro.</span>
            </div>
          ) : (
            filteredCotizaciones.map(c => {
              const isSelected = selectedCot?.ID_COT === c.ID_COT;
              const parsed = parseVassId(c.ID);
              const verStr = parsed ? `v.${String(parsed.version).padStart(2, '0')}` : 'v.00';

              return (
                <div
                  key={c.ID_COT || c.ID}
                  onClick={() => setSelectedCot(c)}
                  className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between space-y-2 group ${
                    isSelected
                      ? 'bg-blue-950/40 border-blue-500/80 shadow-lg shadow-blue-950/50'
                      : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 hover:bg-slate-800/40'
                  }`}
                >
                  {/* Top Row: IDs & Status */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-mono text-xs font-bold text-white bg-slate-800 px-2 py-0.5 rounded-md border border-slate-700">
                        {c.ID}
                      </span>
                      <span className="text-[10px] font-mono font-bold text-emerald-400 bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-800/60">
                        {c.ID_COT}
                      </span>
                    </div>

                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider ${getStatusBadge(
                        c.STATUS
                      )}`}
                    >
                      {c.STATUS || 'INGRESADO'}
                    </span>
                  </div>

                  {/* Client & Detalle */}
                  <div>
                    <h4 className="text-xs font-bold text-slate-100 line-clamp-1 group-hover:text-blue-300 transition-colors">
                      {c.CLIENTE}
                    </h4>
                    {c.DETALLE && (
                      <p className="text-[11px] text-slate-400 line-clamp-2 mt-0.5 leading-snug">
                        {c.DETALLE}
                      </p>
                    )}
                  </div>

                  {/* Bottom Row: Metadata & Document Badge */}
                  <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between text-[10px] text-slate-400">
                    <div className="flex items-center gap-2">
                      <span>{c.FECHA}</span>
                      <span>&bull;</span>
                      <span className="truncate max-w-[110px]">{c.VENDEDOR}</span>
                    </div>

                    <span className="px-1.5 py-0.5 rounded bg-slate-800 font-bold text-[9px] uppercase tracking-wider text-slate-300 border border-slate-700">
                      {c.DOCUMENTO || 'VENTA'}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ----------------- RIGHT PANEL (DOCUMENT EDITOR / BUILDER) ----------------- */}
      <div className="flex-1 flex flex-col h-full overflow-y-auto bg-slate-950">
        {!selectedCot ? (
          /* Empty State */
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-500">
            <div className="w-16 h-16 rounded-3xl bg-slate-900 border border-slate-800 flex items-center justify-center text-blue-500 mb-4 shadow-xl">
              <FileText className="w-8 h-8" />
            </div>
            <h3 className="text-base font-bold text-white mb-1">Módulo de Cotizaciones VASS</h3>
            <p className="text-xs text-slate-400 max-w-sm mb-6">
              Selecciona una cotización del panel lateral izquierdo para ver su ficha, editar ítems y cálculos, o genera una nueva cotización.
            </p>
            <button
              onClick={() => setShowNewModal(true)}
              className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-blue-600/30 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>+ Crear Nueva Cotización</span>
            </button>
          </div>
        ) : (
          /* Active Selected Cotización View */
          <div className="flex-1 flex flex-col overflow-y-auto">
            {/* Top Sticky Header */}
            <div className="sticky top-0 z-20 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4 shrink-0">
              {/* Left Title & Status */}
              <div className="flex items-center gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-lg font-black text-white font-mono tracking-tight">
                      {selectedCot.ID}
                    </h1>
                    <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded-lg border border-emerald-800/60">
                      {selectedCot.ID_COT}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Cliente: <strong className="text-slate-200">{selectedCot.CLIENTE}</strong> {selectedCot.RUC ? `(RUC: ${selectedCot.RUC})` : ''}
                  </p>
                </div>

                {/* Status Selector */}
                <select
                  value={selectedCot.STATUS || 'INGRESADO'}
                  onChange={e => handleQuickStatusChange(e.target.value)}
                  className={`text-xs font-bold px-3 py-1.5 rounded-xl border focus:outline-none cursor-pointer ${getStatusBadge(
                    selectedCot.STATUS
                  )}`}
                >
                  <option value="INGRESADO">INGRESADO</option>
                  <option value="PENDIENTE">PENDIENTE</option>
                  <option value="SALIO">SALIO</option>
                  <option value="NO SALIO">NO SALIO</option>
                </select>
              </div>

              {/* Action Buttons Toolbar */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => setShowVersionModal(true)}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 text-xs font-bold transition-colors"
                  title="Generar nueva versión basada en esta cotización"
                >
                  <GitBranch className="w-4 h-4" />
                  <span>+ Versión</span>
                </button>

                <button
                  onClick={() => setShowEditModal(true)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-bold transition-colors"
                >
                  <Edit3 className="w-4 h-4 text-amber-400" />
                  <span>Editar Ficha</span>
                </button>

                <button
                  onClick={() => setViewMode('A4_PREVIEW')}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 text-xs font-bold transition-colors"
                >
                  <Printer className="w-4 h-4 text-blue-400" />
                  <span>Vista Previa A4</span>
                </button>

                <button
                  onClick={handleSaveDocument}
                  disabled={isSavingDoc}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-lg shadow-blue-600/30 transition-all disabled:opacity-50"
                >
                  {isSavingDoc ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Guardando...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      <span>Guardar Cambios</span>
                    </>
                  )}
                </button>

                <button
                  onClick={handleDeleteCotizacion}
                  className="p-2 text-slate-500 hover:text-rose-400 hover:bg-rose-950/30 rounded-xl transition-colors"
                  title="Eliminar cotización"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Save Feedback Banner */}
            {saveFeedback && (
              <div className="mx-6 mt-4 p-3 bg-emerald-500/20 border border-emerald-500/40 rounded-xl text-emerald-300 text-xs flex items-center gap-2 animate-in fade-in duration-200">
                <CheckCircle2 className="w-4 h-4" />
                <span>{saveFeedback}</span>
              </div>
            )}

            {/* Document Controls Strip */}
            <div className="mx-4 sm:mx-6 mt-4 p-3.5 bg-slate-900 border border-slate-800 rounded-2xl flex flex-wrap items-center justify-between gap-3 text-xs">
              {/* Document Type Switcher */}
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Modalidad:</span>
                <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
                  {(['VENTA', 'ALQUILER', 'OUTSOURCING'] as const).map(dt => (
                    <button
                      key={dt}
                      type="button"
                      onClick={() => setDocType(dt)}
                      className={`px-3 py-1 rounded-lg font-bold transition-all ${
                        docType === dt
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {dt}
                    </button>
                  ))}
                </div>
              </div>

              {/* Currency & Exchange */}
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Moneda:</span>
                  <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
                    <button
                      type="button"
                      onClick={() => setCurrency('PEN')}
                      className={`px-2.5 py-0.5 rounded-lg font-bold transition-all ${
                        currency === 'PEN' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Soles (S/.)
                    </button>
                    <button
                      type="button"
                      onClick={() => setCurrency('USD')}
                      className={`px-2.5 py-0.5 rounded-lg font-bold transition-all ${
                        currency === 'USD' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Dólares ($)
                    </button>
                  </div>
                </div>

                {currency === 'USD' && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] text-slate-400 font-bold">T/C:</span>
                    <input
                      type="number"
                      step="0.01"
                      value={exchangeRate}
                      onChange={e => setExchangeRate(parseFloat(e.target.value) || 3.75)}
                      className="w-16 bg-slate-950 border border-slate-800 rounded-lg px-2 py-0.5 font-mono text-white text-center"
                    />
                  </div>
                )}
              </div>

              {/* Quick Save Action */}
              <button
                type="button"
                onClick={handleSaveDocument}
                disabled={isSavingDoc}
                className="flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow-md transition-all disabled:opacity-50"
              >
                {isSavingDoc ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Guardando...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5" />
                    <span>Guardar Cambios</span>
                  </>
                )}
              </button>
            </div>

            {/* Document Form Canvas */}
            <div className="p-4 sm:p-8 flex justify-center">
              <div className="w-full max-w-[920px] bg-white text-black shadow-2xl p-6 sm:p-10 rounded-sm font-sans border border-slate-300 text-[12px] leading-relaxed space-y-4">
                
                {/* 1. Header (Logo & Company on Left, Quotation Nº & Date on Right) */}
                <div className="flex items-start justify-between border-b border-black pb-4">
                  {/* Left: Brand Logo */}
                  <div className="flex items-center">
                    <img
                      src={LOGO_COTIZACION_URL}
                      alt="vassosp Trading E.I.R.L."
                      className="h-14 sm:h-16 w-auto object-contain max-w-[280px]"
                      crossOrigin="anonymous"
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        if (target.src !== LOGO_COTIZACION_BACKUP_URL) {
                          target.src = LOGO_COTIZACION_BACKUP_URL;
                        }
                      }}
                    />
                  </div>

                  {/* Right: Quotation Number & Date */}
                  <div className="text-right space-y-1">
                    <div className="flex items-center justify-end gap-1.5">
                      <span className="font-bold text-[13px]">Cotización Nº:</span>
                      <input
                        type="text"
                        value={selectedCot.ID}
                        onChange={e => setSelectedCot({ ...selectedCot, ID: e.target.value })}
                        className="font-mono font-bold text-[13px] text-black border border-slate-300 px-1.5 py-0.5 rounded text-right w-48 focus:outline-none focus:border-blue-600"
                        title="ID Comercial de la Cotización"
                      />
                    </div>
                    <div className="flex items-center justify-end gap-1.5 text-slate-700">
                      <span className="font-bold text-[12px]">Fecha :</span>
                      <input
                        type="text"
                        value={selectedCot.FECHA || ''}
                        onChange={e => setSelectedCot({ ...selectedCot, FECHA: e.target.value })}
                        placeholder="DD/MM/AAAA"
                        className="border border-slate-300 px-1.5 py-0.5 rounded text-[11px] text-right w-32 focus:outline-none focus:border-blue-600"
                      />
                    </div>
                  </div>
                </div>

                {/* 2. Client & Referente Info */}
                <div className="space-y-1.5 text-[12px] pt-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold w-20 shrink-0">Señores:</span>
                    <div className="flex-1 flex items-center gap-2">
                      <input
                        list="clientes-list"
                        type="text"
                        placeholder="Nombre o Razón Social del Cliente..."
                        value={selectedCot.CLIENTE || ''}
                        onChange={e => {
                          const val = e.target.value;
                          const found = data.clientes.find(c => c.CLIENTE === val);
                          setSelectedCot({
                            ...selectedCot,
                            CLIENTE: val,
                            RUC: found?.RUC || selectedCot.RUC || ''
                          });
                        }}
                        className="flex-1 font-bold border border-slate-300 px-2 py-1 rounded text-xs focus:outline-none focus:border-blue-600"
                      />
                      <datalist id="clientes-list">
                        {data.clientes.map(c => (
                          <option key={c.CLIENTE} value={c.CLIENTE}>
                            {c.CLIENTE} (RUC: {c.RUC})
                          </option>
                        ))}
                      </datalist>

                      <div className="flex items-center gap-1 shrink-0">
                        <span className="text-[11px] font-bold text-slate-600">RUC:</span>
                        <input
                          type="text"
                          placeholder="20XXXXXXXXX"
                          value={selectedCot.RUC || ''}
                          onChange={e => setSelectedCot({ ...selectedCot, RUC: e.target.value })}
                          className="w-32 border border-slate-300 px-2 py-1 rounded text-xs font-mono focus:outline-none focus:border-blue-600"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="font-bold w-20 shrink-0">Atención:</span>
                    <input
                      type="text"
                      placeholder="Persona de contacto / Referente / Área..."
                      value={selectedCot.REFERENTE || ''}
                      onChange={e => setSelectedCot({ ...selectedCot, REFERENTE: e.target.value })}
                      className="flex-1 border border-slate-300 px-2 py-1 rounded text-xs focus:outline-none focus:border-blue-600"
                    />
                  </div>
                </div>

                {/* 3. Formal Greeting Paragraph */}
                <div className="text-[11px] text-slate-800 italic pt-1">
                  Por la presente aprovechamos la oportunidad de saludarlos y a la vez hacerles llegar la cotización solicitada.
                </div>

                {/* 4. Propuesta Económica Banner */}
                <div className="bg-[#E5E7EB] border border-black px-3 py-1.5 flex items-center gap-2">
                  <span className="font-bold text-black text-[12px] whitespace-nowrap">Propuesta Económica:</span>
                  <input
                    type="text"
                    placeholder="Venta de Repuestos / Alquiler de Equipos / Soporte Técnico..."
                    value={selectedCot.DETALLE || headerData.REFERENCIA || ''}
                    onChange={e => {
                      const val = e.target.value;
                      setSelectedCot({ ...selectedCot, DETALLE: val });
                      setHeaderData({ ...headerData, REFERENCIA: val });
                    }}
                    className="flex-1 bg-white border border-slate-300 px-2 py-0.5 rounded text-xs text-black font-semibold focus:outline-none focus:border-blue-600"
                  />
                </div>

                {/* 5. Alcance del Servicio Banner */}
                <div className="bg-[#E5E7EB] border border-black px-3 py-1 font-bold text-black text-[12px]">
                  Alcance del servicio:
                </div>

                {/* 6. Dynamic Editable Items Table */}
                <div className="space-y-2">
                  {/* Table by Document Type */}
                  <div className="overflow-x-auto border border-black">
                    {docType === 'VENTA' && (
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-[#E5E7EB] border-b border-black text-[11px] font-bold text-black">
                            <th className="p-2 w-16 text-center border-r border-black">Cant.</th>
                            <th className="p-2 border-r border-black">Descripción</th>
                            <th className="p-2 w-28 text-right border-r border-black">P.Unit</th>
                            <th className="p-2 w-28 text-right border-r border-black">P.Total</th>
                            <th className="p-2 w-16 text-center">Acc.</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-black">
                          {items.map((item, idx) => {
                            const isExpanded = !!expandedItems[idx];
                            const itemId = normalizeId(item.ID);
                            const itemCalcs = calculos.filter(c => normalizeId(c.IDITEM) === itemId);

                            return (
                              <React.Fragment key={idx}>
                                <tr className="align-top hover:bg-slate-50">
                                  {/* Cantidad */}
                                  <td className="p-2 text-center border-r border-black">
                                    <input
                                      type="number"
                                      min="1"
                                      value={item.CANTIDAD || '1'}
                                      onChange={e => handleItemChange(idx, 'CANTIDAD', e.target.value)}
                                      className="w-12 border border-slate-300 px-1 py-0.5 rounded text-center font-bold text-xs focus:outline-none focus:border-blue-600"
                                    />
                                  </td>

                                  {/* Descripción & Detalle & Foto */}
                                  <td className="p-2 border-r border-black space-y-1.5">
                                    <input
                                      type="text"
                                      placeholder="Título o Nombre del producto / repuesto..."
                                      value={item.DESCRIPCION || ''}
                                      onChange={e => handleItemChange(idx, 'DESCRIPCION', e.target.value)}
                                      className="w-full font-bold border border-slate-300 px-2 py-1 rounded text-xs focus:outline-none focus:border-blue-600"
                                    />
                                    <textarea
                                      rows={2}
                                      placeholder="Especificaciones técnicas, detalles, marca, modelo, P/N..."
                                      value={item.DETALLE || ''}
                                      onChange={e => handleItemChange(idx, 'DETALLE', e.target.value)}
                                      className="w-full border border-slate-300 px-2 py-1 rounded text-[11px] text-slate-700 resize-none focus:outline-none focus:border-blue-600"
                                    />

                                    {/* Optional Image Attachment */}
                                    <div className="flex items-center gap-2 pt-0.5">
                                      <span className="text-[10px] text-slate-500 font-semibold flex items-center gap-1">
                                        <ImageIcon className="w-3 h-3" /> Foto:
                                      </span>
                                      <input
                                        type="text"
                                        placeholder="URL de imagen del producto (opcional)..."
                                        value={item.FOTO || ''}
                                        onChange={e => handleItemChange(idx, 'FOTO', e.target.value)}
                                        className="flex-1 border border-slate-200 px-1.5 py-0.5 rounded text-[10px] text-slate-600 focus:outline-none focus:border-blue-600"
                                      />
                                      {item.FOTO && (
                                        <img
                                          src={item.FOTO}
                                          alt="Preview"
                                          className="w-8 h-8 object-contain border border-slate-300 rounded bg-white p-0.5"
                                          referrerPolicy="no-referrer"
                                        />
                                      )}
                                    </div>
                                  </td>

                                  {/* P.Unit */}
                                  <td className="p-2 text-right border-r border-black">
                                    <div className="flex items-center justify-end gap-1">
                                      <span className="font-mono text-xs">{currency === 'USD' ? '$' : 'S/.'}</span>
                                      <input
                                        type="number"
                                        step="0.01"
                                        value={item['P.UNIT'] || '0.00'}
                                        onChange={e => handleItemChange(idx, 'P.UNIT', e.target.value)}
                                        className="w-20 border border-slate-300 px-1.5 py-0.5 rounded text-right font-mono font-bold text-xs focus:outline-none focus:border-blue-600"
                                      />
                                    </div>
                                  </td>

                                  {/* P.Total */}
                                  <td className="p-2 text-right border-r border-black font-mono font-bold text-xs">
                                    {currency === 'USD' ? '$' : 'S/.'} {item['P.TOTAL'] || '0.00'}
                                  </td>

                                  {/* Actions */}
                                  <td className="p-2 text-center space-y-1">
                                    <button
                                      type="button"
                                      onClick={() => setExpandedItems(prev => ({ ...prev, [idx]: !isExpanded }))}
                                      className={`p-1 rounded border transition-colors ${
                                        isExpanded
                                          ? 'bg-blue-600 text-white border-blue-600'
                                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border-slate-300'
                                      }`}
                                      title={isExpanded ? 'Ocultar Desglose de Costos' : 'Ver Desglose de Costos'}
                                    >
                                      <Calculator className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteItem(idx)}
                                      className="p-1 rounded bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-200 transition-colors block mx-auto"
                                      title="Eliminar ítem"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </td>
                                </tr>

                                {/* Expanded Cost Breakdown Sub-Table */}
                                {isExpanded && (
                                  <tr className="bg-slate-50 border-b border-black">
                                    <td colSpan={5} className="p-3">
                                      <div className="bg-white border border-slate-300 rounded p-3 space-y-2">
                                        <div className="flex items-center justify-between">
                                          <div className="flex items-center gap-1.5 text-xs font-bold text-[#1E3A8A]">
                                            <Calculator className="w-3.5 h-3.5" />
                                            <span>Desglose de Costos y Margen del Ítem #{idx + 1}</span>
                                          </div>
                                          <button
                                            type="button"
                                            onClick={() => handleAddCalculation(idx)}
                                            className="text-[11px] font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1"
                                          >
                                            <Plus className="w-3 h-3" /> + Agregar Costo
                                          </button>
                                        </div>

                                        <table className="w-full text-left text-[11px] border border-slate-200">
                                          <thead>
                                            <tr className="bg-[#E5E7EB] border-b border-slate-300 font-bold text-slate-800">
                                              <th className="p-1.5">Proveedor</th>
                                              <th className="p-1.5">Detalle Costo</th>
                                              <th className="p-1.5 w-24 text-right">Costo ({currency === 'USD' ? '$' : 'S/.'})</th>
                                              <th className="p-1.5 w-20 text-center">Margen %</th>
                                              <th className="p-1.5 w-24 text-right">P. Venta</th>
                                              <th className="p-1.5 w-24 text-right">Margen $</th>
                                              <th className="p-1.5 w-8 text-center"></th>
                                            </tr>
                                          </thead>
                                          <tbody className="divide-y divide-slate-200">
                                            {itemCalcs.map(calc => (
                                              <tr key={calc.ID} className="hover:bg-slate-50">
                                                <td className="p-1">
                                                  <input
                                                    type="text"
                                                    placeholder="Proveedor..."
                                                    value={calc.PROVEEDOR || ''}
                                                    onChange={e => handleCalcChange(calc.ID, idx, 'PROVEEDOR', e.target.value)}
                                                    className="w-full border border-slate-300 px-1.5 py-0.5 rounded text-[11px]"
                                                  />
                                                </td>
                                                <td className="p-1">
                                                  <input
                                                    type="text"
                                                    placeholder="Detalle..."
                                                    value={calc.DETALLE || ''}
                                                    onChange={e => handleCalcChange(calc.ID, idx, 'DETALLE', e.target.value)}
                                                    className="w-full border border-slate-300 px-1.5 py-0.5 rounded text-[11px]"
                                                  />
                                                </td>
                                                <td className="p-1">
                                                  <input
                                                    type="number"
                                                    step="0.01"
                                                    value={calc.COSTO || '0.00'}
                                                    onChange={e => handleCalcChange(calc.ID, idx, 'COSTO', e.target.value)}
                                                    className="w-full border border-slate-300 px-1.5 py-0.5 rounded text-right font-mono"
                                                  />
                                                </td>
                                                <td className="p-1">
                                                  <input
                                                    type="number"
                                                    step="1"
                                                    value={calc.PORCENTAJE || '30'}
                                                    onChange={e => handleCalcChange(calc.ID, idx, 'PORCENTAJE', e.target.value)}
                                                    className="w-full border border-slate-300 px-1.5 py-0.5 rounded text-center font-mono font-bold"
                                                  />
                                                </td>
                                                <td className="p-1 font-mono font-bold text-right text-emerald-700">
                                                  {calc['P.VENTA'] || '0.00'}
                                                </td>
                                                <td className="p-1 font-mono text-right text-slate-600">
                                                  {calc.MARGEN || '0.00'}
                                                </td>
                                                <td className="p-1 text-center">
                                                  <button
                                                    type="button"
                                                    onClick={() => handleDeleteCalculation(calc.ID, idx)}
                                                    className="p-0.5 text-slate-400 hover:text-rose-600"
                                                  >
                                                    <Trash2 className="w-3 h-3" />
                                                  </button>
                                                </td>
                                              </tr>
                                            ))}
                                          </tbody>
                                        </table>
                                      </div>
                                    </td>
                                  </tr>
                                )}
                              </React.Fragment>
                            );
                          })}
                        </tbody>
                      </table>
                    )}

                    {docType === 'OUTSOURCING' && (
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-[#E5E7EB] border-b border-black text-[11px] font-bold text-black">
                            <th className="p-2 w-12 text-center border-r border-black">N°</th>
                            <th className="p-2 border-r border-black">Descripción del Servicio</th>
                            <th className="p-2 w-32 text-right border-r border-black">P.Unit</th>
                            <th className="p-2 w-16 text-center">Acc.</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-black">
                          {items.map((item, idx) => {
                            const isExpanded = !!expandedItems[idx];
                            const itemId = normalizeId(item.ID);
                            const itemCalcs = calculos.filter(c => normalizeId(c.IDITEM) === itemId);

                            return (
                              <React.Fragment key={idx}>
                                <tr className="align-top hover:bg-slate-50">
                                  <td className="p-2 text-center font-bold border-r border-black">
                                    {idx + 1}
                                  </td>
                                  <td className="p-2 border-r border-black space-y-1.5">
                                    <input
                                      type="text"
                                      placeholder="Servicio de Soporte Técnico Especializado..."
                                      value={item.DESCRIPCION || ''}
                                      onChange={e => handleItemChange(idx, 'DESCRIPCION', e.target.value)}
                                      className="w-full font-bold border border-slate-300 px-2 py-1 rounded text-xs focus:outline-none focus:border-blue-600"
                                    />
                                    <textarea
                                      rows={2}
                                      placeholder="Locación, Días, Horario de Atención, Cantidad de Técnicos..."
                                      value={item.DETALLE || ''}
                                      onChange={e => handleItemChange(idx, 'DETALLE', e.target.value)}
                                      className="w-full border border-slate-300 px-2 py-1 rounded text-[11px] text-slate-700 resize-none focus:outline-none focus:border-blue-600"
                                    />
                                  </td>
                                  <td className="p-2 text-right border-r border-black">
                                    <div className="flex items-center justify-end gap-1">
                                      <span className="font-mono text-xs">{currency === 'USD' ? '$' : 'S/.'}</span>
                                      <input
                                        type="number"
                                        step="0.01"
                                        value={item['P.UNIT'] || '0.00'}
                                        onChange={e => handleItemChange(idx, 'P.UNIT', e.target.value)}
                                        className="w-24 border border-slate-300 px-1.5 py-0.5 rounded text-right font-mono font-bold text-xs focus:outline-none focus:border-blue-600"
                                      />
                                    </div>
                                  </td>
                                  <td className="p-2 text-center space-y-1">
                                    <button
                                      type="button"
                                      onClick={() => setExpandedItems(prev => ({ ...prev, [idx]: !isExpanded }))}
                                      className={`p-1 rounded border transition-colors ${
                                        isExpanded
                                          ? 'bg-blue-600 text-white border-blue-600'
                                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border-slate-300'
                                      }`}
                                      title={isExpanded ? 'Ocultar Costos' : 'Ver Costos'}
                                    >
                                      <Calculator className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteItem(idx)}
                                      className="p-1 rounded bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-200 transition-colors block mx-auto"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </td>
                                </tr>

                                {isExpanded && (
                                  <tr className="bg-slate-50 border-b border-black">
                                    <td colSpan={4} className="p-3">
                                      <div className="bg-white border border-slate-300 rounded p-3 space-y-2">
                                        <div className="flex items-center justify-between">
                                          <div className="flex items-center gap-1.5 text-xs font-bold text-[#1E3A8A]">
                                            <Calculator className="w-3.5 h-3.5" />
                                            <span>Estructura de Costos de Personal / Outsourcing</span>
                                          </div>
                                          <button
                                            type="button"
                                            onClick={() => handleAddCalculation(idx)}
                                            className="text-[11px] font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1"
                                          >
                                            <Plus className="w-3 h-3" /> + Agregar Personal
                                          </button>
                                        </div>

                                        <table className="w-full text-left text-[11px] border border-slate-200">
                                          <thead>
                                            <tr className="bg-[#E5E7EB] border-b border-slate-300 font-bold text-slate-800">
                                              <th className="p-1.5">Servicio / Rol</th>
                                              <th className="p-1.5 w-16 text-center">Personal</th>
                                              <th className="p-1.5 w-16 text-center">Días</th>
                                              <th className="p-1.5 w-24 text-right">Costo Total</th>
                                              <th className="p-1.5 w-20 text-center">Margen %</th>
                                              <th className="p-1.5 w-24 text-right">P. Venta</th>
                                              <th className="p-1.5 w-8 text-center"></th>
                                            </tr>
                                          </thead>
                                          <tbody className="divide-y divide-slate-200">
                                            {itemCalcs.map(calc => (
                                              <tr key={calc.ID} className="hover:bg-slate-50">
                                                <td className="p-1">
                                                  <input
                                                    type="text"
                                                    placeholder="Técnico Especialista..."
                                                    value={calc.SERVICIO || ''}
                                                    onChange={e => handleCalcChange(calc.ID, idx, 'SERVICIO', e.target.value)}
                                                    className="w-full border border-slate-300 px-1.5 py-0.5 rounded text-[11px]"
                                                  />
                                                </td>
                                                <td className="p-1">
                                                  <input
                                                    type="number"
                                                    value={calc.PERSONAL || '1'}
                                                    onChange={e => handleCalcChange(calc.ID, idx, 'PERSONAL', e.target.value)}
                                                    className="w-full border border-slate-300 px-1 py-0.5 rounded text-center"
                                                  />
                                                </td>
                                                <td className="p-1">
                                                  <input
                                                    type="number"
                                                    value={calc.DIAS || '1'}
                                                    onChange={e => handleCalcChange(calc.ID, idx, 'DIAS', e.target.value)}
                                                    className="w-full border border-slate-300 px-1 py-0.5 rounded text-center"
                                                  />
                                                </td>
                                                <td className="p-1">
                                                  <input
                                                    type="number"
                                                    step="0.01"
                                                    value={calc['C.TOTAL'] || '0.00'}
                                                    onChange={e => handleCalcChange(calc.ID, idx, 'C.TOTAL', e.target.value)}
                                                    className="w-full border border-slate-300 px-1.5 py-0.5 rounded text-right font-mono"
                                                  />
                                                </td>
                                                <td className="p-1">
                                                  <input
                                                    type="number"
                                                    value={calc.PORCENTAJE || '30'}
                                                    onChange={e => handleCalcChange(calc.ID, idx, 'PORCENTAJE', e.target.value)}
                                                    className="w-full border border-slate-300 px-1 py-0.5 rounded text-center font-mono font-bold"
                                                  />
                                                </td>
                                                <td className="p-1 font-mono font-bold text-right text-emerald-700">
                                                  {calc['P.VENTA'] || '0.00'}
                                                </td>
                                                <td className="p-1 text-center">
                                                  <button
                                                    type="button"
                                                    onClick={() => handleDeleteCalculation(calc.ID, idx)}
                                                    className="p-0.5 text-slate-400 hover:text-rose-600"
                                                  >
                                                    <Trash2 className="w-3 h-3" />
                                                  </button>
                                                </td>
                                              </tr>
                                            ))}
                                          </tbody>
                                        </table>
                                      </div>
                                    </td>
                                  </tr>
                                )}
                              </React.Fragment>
                            );
                          })}
                        </tbody>
                      </table>
                    )}

                    {docType === 'ALQUILER' && (
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-[#E5E7EB] border-b border-black text-[11px] font-bold text-black">
                            <th className="p-2 w-16 text-center border-r border-black">Cant.</th>
                            <th className="p-2 border-r border-black">Descripción</th>
                            <th className="p-2 w-24 text-right border-r border-black">P.Unit</th>
                            <th className="p-2 w-24 text-center border-r border-black">Periodo</th>
                            <th className="p-2 w-28 text-right border-r border-black">P.Total</th>
                            <th className="p-2 w-16 text-center">Acc.</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-black">
                          {items.map((item, idx) => {
                            const isExpanded = !!expandedItems[idx];
                            const itemId = normalizeId(item.ID);
                            const itemCalcs = calculos.filter(c => normalizeId(c.IDITEM) === itemId);

                            return (
                              <React.Fragment key={idx}>
                                <tr className="align-top hover:bg-slate-50">
                                  <td className="p-2 text-center border-r border-black">
                                    <input
                                      type="number"
                                      min="1"
                                      value={item.CANTIDAD || '1'}
                                      onChange={e => handleItemChange(idx, 'CANTIDAD', e.target.value)}
                                      className="w-12 border border-slate-300 px-1 py-0.5 rounded text-center font-bold text-xs focus:outline-none focus:border-blue-600"
                                    />
                                  </td>
                                  <td className="p-2 border-r border-black space-y-1.5">
                                    <input
                                      type="text"
                                      placeholder="Equipo en Alquiler (Laptop, Servidor, Switch)..."
                                      value={item.DESCRIPCION || ''}
                                      onChange={e => handleItemChange(idx, 'DESCRIPCION', e.target.value)}
                                      className="w-full font-bold border border-slate-300 px-2 py-1 rounded text-xs focus:outline-none focus:border-blue-600"
                                    />
                                    <textarea
                                      rows={2}
                                      placeholder="Especificaciones técnicas, procesador, memoria, disco..."
                                      value={item.DETALLE || ''}
                                      onChange={e => handleItemChange(idx, 'DETALLE', e.target.value)}
                                      className="w-full border border-slate-300 px-2 py-1 rounded text-[11px] text-slate-700 resize-none focus:outline-none focus:border-blue-600"
                                    />
                                  </td>
                                  <td className="p-2 text-right border-r border-black">
                                    <div className="flex items-center justify-end gap-1">
                                      <span className="font-mono text-xs">{currency === 'USD' ? '$' : 'S/.'}</span>
                                      <input
                                        type="number"
                                        step="0.01"
                                        value={item['P.UNIT'] || '0.00'}
                                        onChange={e => handleItemChange(idx, 'P.UNIT', e.target.value)}
                                        className="w-20 border border-slate-300 px-1.5 py-0.5 rounded text-right font-mono font-bold text-xs focus:outline-none focus:border-blue-600"
                                      />
                                    </div>
                                  </td>
                                  <td className="p-2 text-center border-r border-black">
                                    <input
                                      type="text"
                                      placeholder="1 Mes / 3 Mes"
                                      value={item['M/D/S'] || '1 Mes'}
                                      onChange={e => handleItemChange(idx, 'M/D/S', e.target.value)}
                                      className="w-20 border border-slate-300 px-1 py-0.5 rounded text-center text-xs font-semibold focus:outline-none focus:border-blue-600"
                                    />
                                  </td>
                                  <td className="p-2 text-right border-r border-black font-mono font-bold text-xs">
                                    {currency === 'USD' ? '$' : 'S/.'} {item['P.TOTAL'] || '0.00'}
                                  </td>
                                  <td className="p-2 text-center space-y-1">
                                    <button
                                      type="button"
                                      onClick={() => setExpandedItems(prev => ({ ...prev, [idx]: !isExpanded }))}
                                      className={`p-1 rounded border transition-colors ${
                                        isExpanded
                                          ? 'bg-blue-600 text-white border-blue-600'
                                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border-slate-300'
                                      }`}
                                      title={isExpanded ? 'Ocultar Costos' : 'Ver Costos'}
                                    >
                                      <Calculator className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteItem(idx)}
                                      className="p-1 rounded bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-200 transition-colors block mx-auto"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </td>
                                </tr>

                                {isExpanded && (
                                  <tr className="bg-slate-50 border-b border-black">
                                    <td colSpan={6} className="p-3">
                                      <div className="bg-white border border-slate-300 rounded p-3 space-y-2">
                                        <div className="flex items-center justify-between">
                                          <div className="flex items-center gap-1.5 text-xs font-bold text-[#1E3A8A]">
                                            <Calculator className="w-3.5 h-3.5" />
                                            <span>Cálculo de Costo y Margen de Alquiler</span>
                                          </div>
                                          <button
                                            type="button"
                                            onClick={() => handleAddCalculation(idx)}
                                            className="text-[11px] font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1"
                                          >
                                            <Plus className="w-3 h-3" /> + Agregar Costo
                                          </button>
                                        </div>

                                        <table className="w-full text-left text-[11px] border border-slate-200">
                                          <thead>
                                            <tr className="bg-[#E5E7EB] border-b border-slate-300 font-bold text-slate-800">
                                              <th className="p-1.5">Proveedor</th>
                                              <th className="p-1.5">Detalle</th>
                                              <th className="p-1.5 w-24 text-right">Costo ({currency === 'USD' ? '$' : 'S/.'})</th>
                                              <th className="p-1.5 w-20 text-center">Margen %</th>
                                              <th className="p-1.5 w-24 text-right">P. Venta</th>
                                              <th className="p-1.5 w-8 text-center"></th>
                                            </tr>
                                          </thead>
                                          <tbody className="divide-y divide-slate-200">
                                            {itemCalcs.map(calc => (
                                              <tr key={calc.ID} className="hover:bg-slate-50">
                                                <td className="p-1">
                                                  <input
                                                    type="text"
                                                    value={calc.PROVEEDOR || ''}
                                                    onChange={e => handleCalcChange(calc.ID, idx, 'PROVEEDOR', e.target.value)}
                                                    className="w-full border border-slate-300 px-1.5 py-0.5 rounded text-[11px]"
                                                  />
                                                </td>
                                                <td className="p-1">
                                                  <input
                                                    type="text"
                                                    value={calc.DETALLE || ''}
                                                    onChange={e => handleCalcChange(calc.ID, idx, 'DETALLE', e.target.value)}
                                                    className="w-full border border-slate-300 px-1.5 py-0.5 rounded text-[11px]"
                                                  />
                                                </td>
                                                <td className="p-1">
                                                  <input
                                                    type="number"
                                                    step="0.01"
                                                    value={calc.COSTO || '0.00'}
                                                    onChange={e => handleCalcChange(calc.ID, idx, 'COSTO', e.target.value)}
                                                    className="w-full border border-slate-300 px-1.5 py-0.5 rounded text-right font-mono"
                                                  />
                                                </td>
                                                <td className="p-1">
                                                  <input
                                                    type="number"
                                                    value={calc.PORCENTAJE || '30'}
                                                    onChange={e => handleCalcChange(calc.ID, idx, 'PORCENTAJE', e.target.value)}
                                                    className="w-full border border-slate-300 px-1 py-0.5 rounded text-center font-mono font-bold"
                                                  />
                                                </td>
                                                <td className="p-1 font-mono font-bold text-right text-emerald-700">
                                                  {calc['P.VENTA'] || '0.00'}
                                                </td>
                                                <td className="p-1 text-center">
                                                  <button
                                                    type="button"
                                                    onClick={() => handleDeleteCalculation(calc.ID, idx)}
                                                    className="p-0.5 text-slate-400 hover:text-rose-600"
                                                  >
                                                    <Trash2 className="w-3 h-3" />
                                                  </button>
                                                </td>
                                              </tr>
                                            ))}
                                          </tbody>
                                        </table>
                                      </div>
                                    </td>
                                  </tr>
                                )}
                              </React.Fragment>
                            );
                          })}
                        </tbody>
                      </table>
                    )}
                  </div>

                  {/* Add Item Button */}
                  <button
                    type="button"
                    onClick={handleAddItem}
                    className="w-full py-2 bg-slate-100 hover:bg-slate-200 border border-dashed border-slate-400 rounded text-xs font-bold text-[#1E3A8A] flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    <span>+ Agregar Ítem a la Cotización ({docType})</span>
                  </button>
                </div>

                {/* 7. Under-table Services & Financial Totals */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                  {/* Left Column: Clauses & Mesa de Ayuda */}
                  <div className="space-y-3">
                    {docType === 'VENTA' && (
                      <>
                        <div>
                          <div className="font-bold text-[11px] uppercase tracking-wide text-black">
                            QUE INCLUYE NUESTRO SERVICIO :
                          </div>
                          <ul className="list-disc list-inside text-[11px] text-slate-800 space-y-0.5 mt-0.5">
                            <li>Servicio Tecnico Gratuito para Validacion de Garantia</li>
                            <li>Servicio de entrega en su direccion fiscal (Lima Metropolitana)</li>
                          </ul>
                        </div>

                        <div>
                          <div className="font-bold text-[11px] uppercase tracking-wide text-black">
                            MESA DE AYUDA :
                          </div>
                          <div className="text-[11px] text-slate-800 space-y-0.5 mt-0.5">
                            <div>Central : 719 - 9745 / Celular - WSP : 988 613 012</div>
                            <div>Correo : mesadeayuda@vassosp.pe</div>
                            <div><strong>HORARIO DE TRABAJO :</strong> De Lunes a Viernes de 8:30 am 6:00 pm / Sábado de 9:00 a 1:00 pm</div>
                          </div>
                        </div>
                      </>
                    )}

                    {docType === 'OUTSOURCING' && (
                      <div>
                        <div className="font-bold text-[11px] uppercase tracking-wide text-black">
                          INCLUYE :
                        </div>
                        <ul className="list-disc list-inside text-[11px] text-slate-800 space-y-0.5 mt-0.5">
                          <li>Personal con SCTR</li>
                        </ul>
                      </div>
                    )}

                    {docType === 'ALQUILER' && (
                      <>
                        <div>
                          <div className="font-bold text-[11px] uppercase tracking-wide text-black">
                            QUE INCLUYE NUESTRO SERVICIO :
                          </div>
                          <ul className="list-disc list-inside text-[11px] text-slate-800 space-y-0.5 mt-0.5">
                            <li>Servicio Tecnico Gratuito, atención Remota de un especialista para su apoyo</li>
                            <li>Servicio de entrega en su direccion fiscal en menos de 24 horas (Lima Metropolitana)</li>
                            <li>Recambio de equipos en caso de Fallas en menos de 24 Horas</li>
                            <li>Reporte mensual de Servicio de Alquiler</li>
                          </ul>
                        </div>

                        <div>
                          <div className="font-bold text-[11px] uppercase tracking-wide text-black">
                            MESA DE AYUDA :
                          </div>
                          <div className="text-[11px] text-slate-800 space-y-0.5 mt-0.5">
                            <div>Central : 719 - 9745 / Celular - WSP : 988 613 012</div>
                            <div>Correo : mesadeayuda@vassosp.pe</div>
                            <div><strong>HORARIO DE TRABAJO :</strong> De Lunes a Viernes de 8:30 am 6:00 pm / Sábado de 9:00 a 1:00 pm</div>
                          </div>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Right Column: Financial Totals Box */}
                  <div className="flex flex-col justify-end">
                    <div className="border border-black p-3 space-y-1.5 text-xs self-end w-full max-w-[280px]">
                      <div className="flex justify-between items-center text-slate-800">
                        <span>Monto Total:</span>
                        <span className="font-mono font-bold">
                          {currency === 'USD' ? '$' : 'S/.'} {headerData['SUB TOTAL'] || '0.00'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-slate-800">
                        <span>IGV 18%:</span>
                        <span className="font-mono font-bold">
                          {currency === 'USD' ? '$' : 'S/.'} {headerData.IGV || '0.00'}
                        </span>
                      </div>
                      <div className="border-t border-b border-black py-1 flex justify-between items-center font-bold text-sm text-black">
                        <span>TOTAL :</span>
                        <span className="font-mono font-black">
                          {currency === 'USD' ? '$' : 'S/.'} {headerData.TOTAL || '0.00'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 8. Condiciones Comerciales Box */}
                <div className="border border-black p-3 space-y-1.5 text-[11px] leading-relaxed">
                  <div className="font-bold text-black uppercase">Condiciones comerciales:</div>
                  <div className="text-slate-800">
                    - Precios expresados en <strong>{currency === 'USD' ? 'Dolares Americanos' : 'Soles'}</strong>
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-800">
                    <span>- Forma de pago:</span>
                    <input
                      type="text"
                      placeholder="Factura a 30 Días / Contado contra entrega"
                      value={headerData['F.PAGO'] || ''}
                      onChange={e => setHeaderData({ ...headerData, 'F.PAGO': e.target.value })}
                      className="border-b border-dotted border-slate-400 bg-transparent px-1 flex-1 font-medium focus:outline-none focus:border-blue-600"
                    />
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-800">
                    <span>- Validez de la cotización:</span>
                    <input
                      type="text"
                      placeholder="7 días / 15 días calendario"
                      value={headerData['V.COT'] || ''}
                      onChange={e => setHeaderData({ ...headerData, 'V.COT': e.target.value })}
                      className="border-b border-dotted border-slate-400 bg-transparent px-1 w-48 font-medium focus:outline-none focus:border-blue-600"
                    />
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-800">
                    <span>- Disponibilidad:</span>
                    <input
                      type="text"
                      placeholder="A pedido - Previa Orden de Compra / En Stock"
                      value={headerData['DISPONIBILIDAD'] || ''}
                      onChange={e => setHeaderData({ ...headerData, DISPONIBILIDAD: e.target.value })}
                      className="border-b border-dotted border-slate-400 bg-transparent px-1 flex-1 font-medium focus:outline-none focus:border-blue-600"
                    />
                  </div>

                  {docType === 'ALQUILER' && (
                    <div className="pt-2 border-t border-slate-200 mt-2 space-y-0.5">
                      <div className="font-bold text-black">* Responsabilidades del Cliente sobre los Equipos :</div>
                      <div className="text-[10px] text-slate-700">
                        - Toda pérdida, sustracción, daño o deterioro de los equipos arrendados, así como de sus componentes o accesorios, producidos por causas imputables al CLIENTE, sus dependientes o terceros, durante la vigencia del servicio, será de exclusiva responsabilidad del CLIENTE.
                      </div>
                      <div className="text-[10px] text-slate-700">
                        - El CLIENTE asume la obligación de suministrar a los equipos una alimentación eléctrica adecuada, estable y debidamente protegida (incluyendo sistema de puesta a tierra y protección contra sobretensiones).
                      </div>
                    </div>
                  )}
                </div>

                {/* 9. Footer (Datos de la Empresa & Firma Gestor Comercial) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-slate-300 text-[10px] leading-tight">
                  {/* Left: Company & Bank Details */}
                  <div className="space-y-2">
                    <div>
                      <div className="font-bold text-black uppercase">DATOS DE LA EMPRESA</div>
                      <div className="text-slate-800">Razón Social: Vassosp Trading EIRL</div>
                      <div className="text-slate-800">Ruc: 20509427241</div>
                    </div>

                    <div>
                      <div className="font-bold text-black uppercase">CUENTAS CORRIENTES</div>
                      <div className="text-slate-800">
                        <strong>Cuentas BCP:</strong><br />
                        Moneda Extranjera: 194-1489313-1-74<br />
                        Moneda Nacional: 194-1504362-075
                      </div>
                      <div className="text-slate-800 mt-1">
                        <strong>Cuentas BBVA:</strong><br />
                        Moneda Extranjera: 0011-0013-0100001269<br />
                        Moneda Nacional: 0011-0013-0100013283
                      </div>
                    </div>
                  </div>

                  {/* Right: Signature & Sales Rep Area */}
                  <div className="flex flex-col items-center justify-end text-center space-y-1">
                    {/* Simulated Signature */}
                    <div className="w-40 h-12 flex items-center justify-center border-b border-black">
                      <span className="font-serif italic text-base text-slate-800">
                        {selectedCot.VENDEDOR || 'Vassosp Trading'}
                      </span>
                    </div>

                    {/* Salesperson Selector / Input */}
                    <div className="w-full max-w-[200px]">
                      <select
                        value={selectedCot.VENDEDOR || ''}
                        onChange={e => setSelectedCot({ ...selectedCot, VENDEDOR: e.target.value })}
                        className="w-full border border-slate-300 rounded px-1.5 py-0.5 text-[11px] font-bold text-center bg-white text-black focus:outline-none focus:border-blue-600"
                      >
                        {data.vendedores.map(v => (
                          <option key={v.VENDEDOR} value={v.VENDEDOR}>
                            {v.VENDEDOR}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="font-bold text-black">Gestor Comercial</div>
                    <div className="text-slate-700">
                      {data.vendedores.find(v => v.VENDEDOR === selectedCot.VENDEDOR)?.TELEFONO || '988 613 012'}
                    </div>
                    <div className="text-slate-700">
                      {data.vendedores.find(v => v.VENDEDOR === selectedCot.VENDEDOR)?.CORREO || 'ventas@vassosp.pe'}
                    </div>
                  </div>
                </div>

              </div>
            </div>
          </div>
        )}
      </div>

      {/* ----------------- MODALS ----------------- */}
      {showNewModal && (
        <NuevaCotizacionModal
          isOpen={showNewModal}
          onClose={() => setShowNewModal(false)}
          onSuccess={newCot => {
            setSelectedCot(newCot);
            onDataRefresh();
          }}
          allCotizaciones={data.cotizaciones}
          clientes={data.clientes}
          vendedores={data.vendedores}
        />
      )}

      {showEditModal && selectedCot && (
        <EditarCotizacionModal
          isOpen={showEditModal}
          onClose={() => setShowEditModal(false)}
          onSuccess={updatedCot => {
            setSelectedCot(updatedCot);
            onDataRefresh();
          }}
          cotizacion={selectedCot}
          clientes={data.clientes}
          vendedores={data.vendedores}
        />
      )}

      {showVersionModal && selectedCot && (
        <NuevaVersionModal
          isOpen={showVersionModal}
          onClose={() => setShowVersionModal(false)}
          onSuccess={newVerCot => {
            setSelectedCot(newVerCot);
            onDataRefresh();
          }}
          cotizacion={selectedCot}
          allCotizaciones={data.cotizaciones}
          docType={docType}
          headerData={headerData}
          items={items}
          calculos={calculos}
        />
      )}
    </div>
  );
}
