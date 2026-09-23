import React, { useState, FormEvent, ChangeEvent } from 'react';
import { Cliente, Vendedor } from '../../types';
import {
  createCliente,
  updateCliente,
  deleteCliente,
  createVendedor,
  updateVendedor,
  deleteVendedor,
  normalizeId
} from '../../lib/cotizacionesApi';
import {
  Building2,
  UserCheck,
  Plus,
  Search,
  Edit2,
  Trash2,
  Phone,
  Mail,
  PenTool,
  Check,
  X,
  Sparkles,
  Upload,
  RotateCcw
} from 'lucide-react';
import SignaturePad from '../../components/SignaturePad';

interface Props {
  clientes: Cliente[];
  vendedores: Vendedor[];
  onDataRefresh: () => Promise<void>;
}

export default function ClienteVendedorTab({ clientes, vendedores, onDataRefresh }: Props) {
  const [activeSubTab, setActiveSubTab] = useState<'CLIENTES' | 'VENDEDORES'>('CLIENTES');
  const [searchQuery, setSearchQuery] = useState('');

  // Cliente Modal State
  const [showClienteModal, setShowClienteModal] = useState(false);
  const [editingCliente, setEditingCliente] = useState<Cliente | null>(null);
  const [clienteForm, setClienteForm] = useState<{ CLIENTE: string; RUC: string }>({ CLIENTE: '', RUC: '' });

  // Vendedor Modal State
  const [showVendedorModal, setShowVendedorModal] = useState(false);
  const [editingVendedor, setEditingVendedor] = useState<Vendedor | null>(null);
  const [vendedorForm, setVendedorForm] = useState<{
    VENDEDOR: string;
    FIRMA: string;
    TELEFONO: string;
    CORREO: string;
  }>({
    VENDEDOR: '',
    FIRMA: '',
    TELEFONO: '',
    CORREO: ''
  });
  const [showSignaturePad, setShowSignaturePad] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Filtered lists
  const filteredClientes = clientes.filter(c =>
    (c.CLIENTE || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (c.RUC || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (c.ID || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredVendedores = vendedores.filter(v =>
    (v.VENDEDOR || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (v.CORREO || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (v.TELEFONO || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (v.ID || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Helper next ID for Cliente
  const getNextClienteId = () => {
    let max = 0;
    clientes.forEach(c => {
      const match = (c.ID || '').match(/CL-(\d+)/i);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > max) max = num;
      }
    });
    return `CL-${String(max + 1).padStart(4, '0')}`;
  };

  // Helper next ID for Vendedor
  const getNextVendedorId = () => {
    let max = 0;
    vendedores.forEach(v => {
      const match = (v.ID || '').match(/V-(\d+)/i);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > max) max = num;
      }
    });
    return `V-${String(max + 1).padStart(3, '0')}`;
  };

  // ----------------- CLIENTE HANDLERS -----------------
  const handleOpenNewCliente = () => {
    setEditingCliente(null);
    setClienteForm({ CLIENTE: '', RUC: '' });
    setShowClienteModal(true);
  };

  const handleOpenEditCliente = (c: Cliente) => {
    setEditingCliente(c);
    setClienteForm({ CLIENTE: c.CLIENTE || '', RUC: c.RUC || '' });
    setShowClienteModal(true);
  };

  const handleSaveCliente = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clienteForm.CLIENTE.trim()) {
      alert('El nombre del cliente es obligatorio');
      return;
    }
    setIsSaving(true);
    try {
      if (editingCliente && editingCliente._rowIndex) {
        await updateCliente(editingCliente._rowIndex, {
          ID: editingCliente.ID,
          CLIENTE: clienteForm.CLIENTE.trim(),
          RUC: clienteForm.RUC.trim()
        });
      } else {
        const nextId = getNextClienteId();
        await createCliente({
          ID: nextId,
          CLIENTE: clienteForm.CLIENTE.trim(),
          RUC: clienteForm.RUC.trim()
        });
      }
      await onDataRefresh();
      setShowClienteModal(false);
    } catch (err: any) {
      console.error(err);
      alert(`Error al guardar cliente: ${err.message || err}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteCliente = async (c: Cliente) => {
    if (!c._rowIndex) return;
    if (!window.confirm(`¿Estás seguro de eliminar al cliente "${c.CLIENTE}"?`)) return;
    try {
      await deleteCliente(c._rowIndex);
      await onDataRefresh();
    } catch (err: any) {
      console.error(err);
      alert(`Error al eliminar cliente: ${err.message || err}`);
    }
  };

  // ----------------- VENDEDOR HANDLERS -----------------
  const handleOpenNewVendedor = () => {
    setEditingVendedor(null);
    setVendedorForm({ VENDEDOR: '', FIRMA: '', TELEFONO: '', CORREO: '' });
    setShowVendedorModal(true);
  };

  const handleOpenEditVendedor = (v: Vendedor) => {
    setEditingVendedor(v);
    setVendedorForm({
      VENDEDOR: v.VENDEDOR || '',
      FIRMA: v.FIRMA || '',
      TELEFONO: v.TELEFONO || '',
      CORREO: v.CORREO || ''
    });
    setShowVendedorModal(true);
  };

  const handleSaveVendedor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vendedorForm.VENDEDOR.trim()) {
      alert('El nombre del vendedor es obligatorio');
      return;
    }
    setIsSaving(true);
    try {
      if (editingVendedor && editingVendedor._rowIndex) {
        await updateVendedor(editingVendedor._rowIndex, {
          ID: editingVendedor.ID,
          VENDEDOR: vendedorForm.VENDEDOR.trim(),
          FIRMA: vendedorForm.FIRMA.trim(),
          TELEFONO: vendedorForm.TELEFONO.trim(),
          CORREO: vendedorForm.CORREO.trim()
        });
      } else {
        const nextId = getNextVendedorId();
        await createVendedor({
          ID: nextId,
          VENDEDOR: vendedorForm.VENDEDOR.trim(),
          FIRMA: vendedorForm.FIRMA.trim(),
          TELEFONO: vendedorForm.TELEFONO.trim(),
          CORREO: vendedorForm.CORREO.trim()
        });
      }
      await onDataRefresh();
      setShowVendedorModal(false);
    } catch (err: any) {
      console.error(err);
      alert(`Error al guardar vendedor: ${err.message || err}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteVendedor = async (v: Vendedor) => {
    if (!v._rowIndex) return;
    if (!window.confirm(`¿Estás seguro de eliminar al vendedor "${v.VENDEDOR}"?`)) return;
    try {
      await deleteVendedor(v._rowIndex);
      await onDataRefresh();
    } catch (err: any) {
      console.error(err);
      alert(`Error al eliminar vendedor: ${err.message || err}`);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        setVendedorForm(prev => ({ ...prev, FIRMA: String(reader.result) }));
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="flex flex-col w-full h-full p-4 sm:p-6 overflow-y-auto space-y-6">
      {/* Top Controls Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-4 rounded-2xl">
        <div className="flex items-center gap-2 bg-slate-950 p-1.5 rounded-xl border border-slate-800">
          <button
            onClick={() => setActiveSubTab('CLIENTES')}
            className={`flex items-center gap-2 px-5 py-2 rounded-lg text-xs font-bold transition-all ${
              activeSubTab === 'CLIENTES'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>CLIENTES ({clientes.length})</span>
          </button>

          <button
            onClick={() => setActiveSubTab('VENDEDORES')}
            className={`flex items-center gap-2 px-5 py-2 rounded-lg text-xs font-bold transition-all ${
              activeSubTab === 'VENDEDORES'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <UserCheck className="w-4 h-4" />
            <span>VENDEDORES ({vendedores.length})</span>
          </button>
        </div>

        {/* Search and Action */}
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder={`Buscar en ${activeSubTab.toLowerCase()}...`}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>

          {activeSubTab === 'CLIENTES' ? (
            <button
              onClick={handleOpenNewCliente}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-blue-600/30 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Nuevo Cliente</span>
            </button>
          ) : (
            <button
              onClick={handleOpenNewVendedor}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-blue-600/30 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Nuevo Vendedor</span>
            </button>
          )}
        </div>
      </div>

      {/* Content Grid */}
      {activeSubTab === 'CLIENTES' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredClientes.length === 0 ? (
            <div className="col-span-full py-16 text-center text-slate-500 text-sm">
              No se encontraron clientes registrados.
            </div>
          ) : (
            filteredClientes.map(c => (
              <div
                key={c.ID || c.CLIENTE}
                className="bg-slate-900 border border-slate-800 hover:border-slate-700 p-5 rounded-2xl flex flex-col justify-between space-y-4 group transition-all shadow-md"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="font-mono text-xs font-bold text-blue-400 bg-blue-950/60 px-2 py-0.5 rounded-md border border-blue-800/60">
                      {c.ID || 'CL-0000'}
                    </span>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleOpenEditCliente(c)}
                        className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                        title="Editar"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteCliente(c)}
                        className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-950/50 rounded-lg transition-colors"
                        title="Eliminar"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <h3 className="text-sm font-bold text-white leading-snug line-clamp-2">
                    {c.CLIENTE}
                  </h3>
                  <p className="text-xs text-slate-400 mt-1 font-mono">
                    RUC: <span className="text-slate-300 font-semibold">{c.RUC || 'No registrado'}</span>
                  </p>
                </div>

                <div className="pt-3 border-t border-slate-800/60 flex items-center justify-between text-[11px] text-slate-500">
                  <span>Registro verificado</span>
                  <Building2 className="w-4 h-4 text-slate-600" />
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredVendedores.length === 0 ? (
            <div className="col-span-full py-16 text-center text-slate-500 text-sm">
              No se encontraron vendedores registrados.
            </div>
          ) : (
            filteredVendedores.map(v => (
              <div
                key={v.ID || v.VENDEDOR}
                className="bg-slate-900 border border-slate-800 hover:border-slate-700 p-5 rounded-2xl flex flex-col justify-between space-y-4 group transition-all shadow-md"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="font-mono text-xs font-bold text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded-md border border-emerald-800/60">
                      {v.ID || 'V-000'}
                    </span>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleOpenEditVendedor(v)}
                        className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                        title="Editar"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteVendedor(v)}
                        className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-950/50 rounded-lg transition-colors"
                        title="Eliminar"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <h3 className="text-sm font-bold text-white leading-snug">
                    {v.VENDEDOR}
                  </h3>

                  <div className="mt-3 space-y-1 text-xs text-slate-400">
                    {v.TELEFONO && (
                      <p className="flex items-center gap-2">
                        <Phone className="w-3.5 h-3.5 text-blue-400" />
                        <span>{v.TELEFONO}</span>
                      </p>
                    )}
                    {v.CORREO && (
                      <p className="flex items-center gap-2 truncate">
                        <Mail className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                        <span className="truncate">{v.CORREO}</span>
                      </p>
                    )}
                  </div>
                </div>

                {/* Signature Preview */}
                <div className="pt-3 border-t border-slate-800/60 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <PenTool className="w-3.5 h-3.5 text-slate-500" />
                    <span className="text-[11px] text-slate-400">
                      {v.FIRMA ? 'Firma configurada' : 'Sin firma'}
                    </span>
                  </div>
                  {v.FIRMA && (
                    <div className="h-6 w-12 bg-white/10 rounded px-1 flex items-center justify-center overflow-hidden">
                      <img src={v.FIRMA} alt="Firma" className="max-h-5 object-contain" />
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ----------------- MODAL CLIENTE ----------------- */}
      {showClienteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-md shadow-2xl p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Building2 className="w-5 h-5 text-blue-400" />
                {editingCliente ? 'Editar Cliente' : 'Nuevo Cliente'}
              </h3>
              <button
                onClick={() => setShowClienteModal(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-full"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCliente} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Cliente / Razón Social *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej. MINERA LAS BAMBAS S.A."
                  value={clienteForm.CLIENTE}
                  onChange={e => setClienteForm(prev => ({ ...prev, CLIENTE: e.target.value }))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Número de R.U.C.
                </label>
                <input
                  type="text"
                  placeholder="20XXXXXXXXX"
                  value={clienteForm.RUC}
                  onChange={e => setClienteForm(prev => ({ ...prev, RUC: e.target.value }))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white font-mono focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowClienteModal(false)}
                  disabled={isSaving}
                  className="px-4 py-2 rounded-xl border border-slate-700 text-slate-300 text-xs font-semibold hover:bg-slate-800"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-blue-600/30"
                >
                  {isSaving ? 'Guardando...' : 'Guardar Cliente'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ----------------- MODAL VENDEDOR ----------------- */}
      {showVendedorModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-lg shadow-2xl p-6 space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-emerald-400" />
                {editingVendedor ? 'Editar Vendedor' : 'Nuevo Vendedor'}
              </h3>
              <button
                onClick={() => setShowVendedorModal(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-full"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveVendedor} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Nombre Completo del Vendedor *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Carlos Mendoza"
                  value={vendedorForm.VENDEDOR}
                  onChange={e => setVendedorForm(prev => ({ ...prev, VENDEDOR: e.target.value }))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Teléfono / Celular
                  </label>
                  <input
                    type="text"
                    placeholder="+51 987 654 321"
                    value={vendedorForm.TELEFONO}
                    onChange={e => setVendedorForm(prev => ({ ...prev, TELEFONO: e.target.value }))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Correo Electrónico
                  </label>
                  <input
                    type="email"
                    placeholder="vendedor@vspgroup.pe"
                    value={vendedorForm.CORREO}
                    onChange={e => setVendedorForm(prev => ({ ...prev, CORREO: e.target.value }))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Firma Digital */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center justify-between">
                  <span>Firma Digital para Cotizaciones</span>
                  {vendedorForm.FIRMA && (
                    <button
                      type="button"
                      onClick={() => setVendedorForm(prev => ({ ...prev, FIRMA: '' }))}
                      className="text-[10px] text-rose-400 hover:underline"
                    >
                      Quitar firma
                    </button>
                  )}
                </label>

                {vendedorForm.FIRMA ? (
                  <div className="p-3 bg-white/5 border border-slate-700 rounded-xl flex items-center justify-center">
                    <img
                      src={vendedorForm.FIRMA}
                      alt="Firma actual"
                      className="max-h-20 max-w-[200px] object-contain bg-white rounded p-1"
                    />
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setShowSignaturePad(true)}
                      className="flex flex-col items-center justify-center p-4 border border-dashed border-slate-700 hover:border-blue-500 rounded-xl bg-slate-800/40 text-slate-400 hover:text-white transition-all text-xs gap-1.5"
                    >
                      <PenTool className="w-5 h-5 text-blue-400" />
                      <span>Dibujar Firma</span>
                    </button>

                    <label className="flex flex-col items-center justify-center p-4 border border-dashed border-slate-700 hover:border-blue-500 rounded-xl bg-slate-800/40 text-slate-400 hover:text-white transition-all text-xs gap-1.5 cursor-pointer">
                      <Upload className="w-5 h-5 text-emerald-400" />
                      <span>Subir Imagen</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        className="hidden"
                      />
                    </label>
                  </div>
                )}
              </div>

              {showSignaturePad && (
                <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
                  <SignaturePad
                    title="Firma del Vendedor"
                    onSave={dataUrl => {
                      setVendedorForm(prev => ({ ...prev, FIRMA: dataUrl }));
                      setShowSignaturePad(false);
                    }}
                    onCancel={() => setShowSignaturePad(false)}
                  />
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowVendedorModal(false)}
                  disabled={isSaving}
                  className="px-4 py-2 rounded-xl border border-slate-700 text-slate-300 text-xs font-semibold hover:bg-slate-800"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex items-center gap-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-emerald-600/30"
                >
                  {isSaving ? 'Guardando...' : 'Guardar Vendedor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
