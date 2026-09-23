import React, { useState, useEffect, FormEvent } from 'react';
import { Cotizacion, Cliente, Vendedor } from '../../../types';
import { updateCotizacion } from '../../../lib/cotizacionesApi';
import { X, Edit3, Building2, UserCheck, Calendar, Tag, CheckCircle2 } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (updatedCotizacion: Cotizacion) => void;
  cotizacion: Cotizacion | null;
  clientes: Cliente[];
  vendedores: Vendedor[];
}

export default function EditarCotizacionModal({
  isOpen,
  onClose,
  onSuccess,
  cotizacion,
  clientes,
  vendedores
}: Props) {
  const [fecha, setFecha] = useState<string>('');
  const [selectedCliente, setSelectedCliente] = useState<string>('');
  const [ruc, setRuc] = useState<string>('');
  const [selectedVendedor, setSelectedVendedor] = useState<string>('');
  const [referente, setReferente] = useState<string>('');
  const [detalle, setDetalle] = useState<string>('');
  const [status, setStatus] = useState<string>('INGRESADO');
  const [isSaving, setIsSaving] = useState<boolean>(false);

  useEffect(() => {
    if (cotizacion) {
      setFecha(cotizacion.FECHA || '');
      setSelectedCliente(cotizacion.CLIENTE || '');
      setRuc(cotizacion.RUC || '');
      setSelectedVendedor(cotizacion.VENDEDOR || '');
      setReferente(cotizacion.REFERENTE || '');
      setDetalle(cotizacion.DETALLE || '');
      setStatus(cotizacion.STATUS || 'INGRESADO');
    }
  }, [cotizacion]);

  if (!isOpen || !cotizacion) return null;

  const handleClienteChange = (clienteName: string) => {
    setSelectedCliente(clienteName);
    const found = clientes.find(c => c.CLIENTE === clienteName);
    if (found && found.RUC) {
      setRuc(found.RUC);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCliente.trim()) {
      alert('Por favor indica un cliente');
      return;
    }
    if (!cotizacion._rowIndex) {
      alert('No se encontró el índice de fila de la cotización');
      return;
    }

    setIsSaving(true);
    try {
      const updated: Cotizacion = {
        ...cotizacion,
        FECHA: fecha,
        CLIENTE: selectedCliente.trim(),
        RUC: ruc.trim(),
        VENDEDOR: selectedVendedor.trim(),
        REFERENTE: referente.trim(),
        DETALLE: detalle.trim(),
        STATUS: status
      };

      await updateCotizacion(cotizacion._rowIndex, updated);
      onSuccess(updated);
      onClose();
    } catch (err: any) {
      console.error(err);
      alert(`Error al actualizar la cotización: ${err.message || err}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-800 bg-slate-900/50 sticky top-0 backdrop-blur-md z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-600/20 border border-amber-500/30 flex items-center justify-center text-amber-400 font-bold">
              <Edit3 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                Editar Ficha Cotización
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30 font-mono">
                  {cotizacion.ID}
                </span>
              </h2>
              <p className="text-xs text-slate-400">Actualiza los datos informativos sin modificar los identificadores</p>
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
          {/* Identifiers Read-only Card */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-2xl bg-slate-800/40 border border-slate-700/60">
            <div>
              <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                ID Comercial (VASS)
              </label>
              <div className="text-base font-bold font-mono text-blue-400 bg-blue-950/60 px-3 py-1.5 rounded-xl border border-blue-800/60">
                {cotizacion.ID}
              </div>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                ID Técnico Cotización
              </label>
              <div className="text-base font-bold font-mono text-emerald-400 bg-emerald-950/60 px-3 py-1.5 rounded-xl border border-emerald-800/60">
                {cotizacion.ID_COT}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Fecha */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-amber-400" />
                Fecha
              </label>
              <input
                type="date"
                value={fecha}
                onChange={e => setFecha(e.target.value)}
                required
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500 transition-colors"
              />
            </div>

            {/* Estado */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-amber-400" />
                Estado Actual
              </label>
              <select
                value={status}
                onChange={e => setStatus(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500 transition-colors"
              >
                <option value="INGRESADO">INGRESADO</option>
                <option value="PENDIENTE">PENDIENTE</option>
                <option value="SALIO">SALIO</option>
                <option value="NO SALIO">NO SALIO</option>
              </select>
            </div>
          </div>

          {/* Cliente y RUC */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-amber-400" />
                Cliente / Razón Social
              </label>
              <div className="space-y-1.5">
                {clientes.length > 0 ? (
                  <select
                    value={selectedCliente}
                    onChange={e => handleClienteChange(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500 transition-colors"
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
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500 transition-colors"
                  />
                )}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-amber-400" />
                RUC
              </label>
              <input
                type="text"
                placeholder="20XXXXXXXXX"
                value={ruc}
                onChange={e => setRuc(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white font-mono focus:outline-none focus:border-amber-500 transition-colors"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Vendedor */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                <UserCheck className="w-3.5 h-3.5 text-amber-400" />
                Vendedor Asignado
              </label>
              {vendedores.length > 0 ? (
                <select
                  value={selectedVendedor}
                  onChange={e => setSelectedVendedor(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500 transition-colors"
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
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500 transition-colors"
                />
              )}
            </div>

            {/* Referente / Atención */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                <UserCheck className="w-3.5 h-3.5 text-amber-400" />
                Atención a / Referente
              </label>
              <input
                type="text"
                placeholder="Ing. Juan Pérez / Contacto..."
                value={referente}
                onChange={e => setReferente(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500 transition-colors"
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
              placeholder="Descripción breve del requerimiento..."
              value={detalle}
              onChange={e => setDetalle(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500 transition-colors resize-none"
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
              className="flex items-center gap-2 px-6 py-2.5 bg-amber-600 hover:bg-amber-500 text-white text-sm font-bold rounded-xl shadow-lg shadow-amber-600/30 transition-all disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Guardando...</span>
                </>
              ) : (
                <>
                  <Edit3 className="w-4 h-4" />
                  <span>Guardar Cambios</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
