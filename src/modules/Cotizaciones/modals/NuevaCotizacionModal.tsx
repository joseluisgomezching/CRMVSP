import React, { useState, useEffect, FormEvent } from 'react';
import { Cotizacion, Cliente, Vendedor } from '../../../types';
import { getNextIdCot, getNextVassCorrelativo, createCotizacion, normalizeId } from '../../../lib/cotizacionesApi';
import { X, Plus, Sparkles, Building2, UserCheck, Calendar, FileText, Tag } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newCotizacion: Cotizacion) => void;
  allCotizaciones: Cotizacion[];
  clientes: Cliente[];
  vendedores: Vendedor[];
}

export default function NuevaCotizacionModal({
  isOpen,
  onClose,
  onSuccess,
  allCotizaciones,
  clientes,
  vendedores
}: Props) {
  const currentYear = new Date().getFullYear();
  const currentYear2Digit = currentYear % 100;
  const todayStr = new Date().toISOString().split('T')[0];

  const [selectedYear, setSelectedYear] = useState<number>(currentYear2Digit);
  const [fecha, setFecha] = useState<string>(todayStr);
  const [selectedCliente, setSelectedCliente] = useState<string>('');
  const [ruc, setRuc] = useState<string>('');
  const [selectedVendedor, setSelectedVendedor] = useState<string>('');
  const [referente, setReferente] = useState<string>('');
  const [detalle, setDetalle] = useState<string>('');
  const [documento, setDocumento] = useState<string>('VENTA');
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Auto-calculated IDs
  const nextIdCot = getNextIdCot(allCotizaciones);
  const nextCorrelativo = getNextVassCorrelativo(allCotizaciones, selectedYear);
  const nextVassId = `VASS ${nextCorrelativo}(${String(selectedYear).padStart(2, '0')})v.00`;

  useEffect(() => {
    if (clientes.length > 0 && !selectedCliente) {
      setSelectedCliente(clientes[0].CLIENTE);
      setRuc(clientes[0].RUC || '');
    }
    if (vendedores.length > 0 && !selectedVendedor) {
      setSelectedVendedor(vendedores[0].VENDEDOR);
    }
  }, [clientes, vendedores, selectedCliente, selectedVendedor]);

  const handleClienteChange = (clienteName: string) => {
    setSelectedCliente(clienteName);
    const found = clientes.find(c => c.CLIENTE === clienteName);
    if (found) {
      setRuc(found.RUC || '');
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCliente.trim()) {
      alert('Por favor selecciona o ingresa un cliente');
      return;
    }
    if (!selectedVendedor.trim()) {
      alert('Por favor selecciona un vendedor');
      return;
    }

    setIsSaving(true);
    try {
      const newCot: Cotizacion = {
        ID_COT: nextIdCot,
        ID: nextVassId,
        FECHA: fecha,
        CLIENTE: selectedCliente.trim(),
        RUC: ruc.trim(),
        VENDEDOR: selectedVendedor.trim(),
        DETALLE: detalle.trim(),
        STATUS: 'INGRESADO',
        DOCUMENTO: documento,
        REFERENTE: referente.trim(),
        PDF: ''
      };

      await createCotizacion(newCot);
      onSuccess(newCot);
      onClose();
    } catch (err: any) {
      console.error(err);
      alert(`Error al crear la cotización: ${err.message || err}`);
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-800 bg-slate-900/50 sticky top-0 backdrop-blur-md z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 font-bold">
              <Plus className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                Nueva Cotización
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30 font-mono">
                  v.00
                </span>
              </h2>
              <p className="text-xs text-slate-400">Genera una nueva cotización comercial inicial</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSave} className="p-6 space-y-5">
          {/* Generated IDs Card */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-2xl bg-slate-800/40 border border-slate-700/60">
            <div>
              <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                ID Comercial (VASS)
              </label>
              <div className="flex items-center gap-2">
                <span className="text-base font-bold font-mono text-blue-400 bg-blue-950/60 px-3 py-1.5 rounded-xl border border-blue-800/60 w-full">
                  {nextVassId}
                </span>
              </div>
              <p className="text-[10px] text-slate-400 mt-1">Correlativo anual automático ({selectedYear})</p>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                ID Técnico Cotización
              </label>
              <div className="flex items-center gap-2">
                <span className="text-base font-bold font-mono text-emerald-400 bg-emerald-950/60 px-3 py-1.5 rounded-xl border border-emerald-800/60 w-full">
                  {nextIdCot}
                </span>
              </div>
              <p className="text-[10px] text-slate-400 mt-1">Secuencial global</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Fecha */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-blue-400" />
                Fecha
              </label>
              <input
                type="date"
                value={fecha}
                onChange={e => setFecha(e.target.value)}
                required
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>

            {/* Tipo de Documento Inicial */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-blue-400" />
                Tipo de Documento
              </label>
              <select
                value={documento}
                onChange={e => setDocumento(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors"
              >
                <option value="VENTA">VENTA</option>
                <option value="ALQUILER">ALQUILER</option>
                <option value="OUTSOURCING">OUTSOURCING</option>
                <option value="NO SE CREO DOCUMENTO">NO SE CREO DOCUMENTO</option>
              </select>
            </div>
          </div>

          {/* Cliente y RUC */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-blue-400" />
                Cliente / Razón Social
              </label>
              <div className="space-y-1.5">
                {clientes.length > 0 ? (
                  <select
                    value={selectedCliente}
                    onChange={e => handleClienteChange(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors"
                  >
                    <option value="">-- Selecciona un Cliente --</option>
                    {clientes.map(c => (
                      <option key={c.ID || c.CLIENTE} value={c.CLIENTE}>
                        {c.CLIENTE} {c.RUC ? `(${c.RUC})` : ''}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    placeholder="Nombre del cliente..."
                    value={selectedCliente}
                    onChange={e => setSelectedCliente(e.target.value)}
                    required
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors"
                  />
                )}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-blue-400" />
                RUC
              </label>
              <input
                type="text"
                placeholder="20XXXXXXXXX"
                value={ruc}
                onChange={e => setRuc(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white font-mono focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Vendedor */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                <UserCheck className="w-3.5 h-3.5 text-blue-400" />
                Vendedor Asignado
              </label>
              {vendedores.length > 0 ? (
                <select
                  value={selectedVendedor}
                  onChange={e => setSelectedVendedor(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors"
                >
                  <option value="">-- Selecciona Vendedor --</option>
                  {vendedores.map(v => (
                    <option key={v.ID || v.VENDEDOR} value={v.VENDEDOR}>
                      {v.VENDEDOR}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  placeholder="Nombre del vendedor..."
                  value={selectedVendedor}
                  onChange={e => setSelectedVendedor(e.target.value)}
                  required
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors"
                />
              )}
            </div>

            {/* Referente / Atención */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                <UserCheck className="w-3.5 h-3.5 text-blue-400" />
                Atención a / Referente
              </label>
              <input
                type="text"
                placeholder="Ing. Juan Pérez / Contacto..."
                value={referente}
                onChange={e => setReferente(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>
          </div>

          {/* Detalle / Asunto */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Detalle / Asunto de la Cotización
            </label>
            <textarea
              rows={3}
              placeholder="Descripción breve del requerimiento o proyecto..."
              value={detalle}
              onChange={e => setDetalle(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors resize-none"
            />
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-5 py-2.5 rounded-xl border border-slate-700 text-slate-300 text-sm font-semibold hover:bg-slate-800 hover:text-white transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold rounded-xl shadow-lg shadow-blue-600/30 transition-all disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Creando...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Crear Cotización</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
