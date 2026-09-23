import React, { useState, useEffect } from 'react';
import { KeyRound, Plus, Edit2, Trash2, X, AlertCircle } from 'lucide-react';
import { fetchAppData, createAcceso, updateAcceso, deleteRows } from '../../lib/googleApi';
import type { Acceso } from '../../types';
import { auth } from '../../serviceAccess';
import GoogleErrorCard from '../../components/GoogleErrorCard';

const AVAILABLE_MODULES = [
  { id: 'TICKET', label: 'TICKET' },
  { id: 'TICKETS_CERRADOS', label: 'TICKETS CERRADOS' },
  { id: 'TECNICO', label: 'TECNICO' },
  { id: 'RENDIR_PASAJES', label: 'RENDIR PASAJES' },
  { id: 'INFORMES', label: 'INFORMES' },
  { id: 'EMPRESAS', label: 'EMPRESAS Y PERSONAL' },
  { id: 'EDITAR_TICKETS', label: 'EDITAR TICKETS' },
  { id: 'ACTIVIDADES', label: 'ACTIVIDADES INTERNAS' },
  { id: 'CAJA_CHICA', label: 'CAJA CHICA' },
  { id: 'COTIZACIONES', label: 'COTIZACIONES' },
  { id: 'RENTAL', label: 'RENTAL' },
  { id: 'INVENTARIO', label: 'INVENTARIO ALMACEN' },
  { id: 'ACCESOS', label: 'ACCESOS' }
];

export default function AccesosModule() {
  const [accesos, setAccesos] = useState<Acceso[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [editingAcceso, setEditingAcceso] = useState<Acceso | null>(null);
  
  const [formData, setFormData] = useState<Partial<Acceso>>({});
  const [selectedModules, setSelectedModules] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const [deleteConfirm, setDeleteConfirm] = useState<Acceso | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAppData();
      setAccesos(data.accesos || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const generateId = () => {
    if (accesos.length === 0) return 'ACC-0001';
    const ids = accesos.map(a => parseInt((a.ID || '').replace('ACC-', ''))).filter(n => !isNaN(n));
    if (ids.length === 0) return 'ACC-0001';
    const max = Math.max(0, ...ids);
    return `ACC-${String(max + 1).padStart(4, '0')}`;
  };

  const openNewForm = () => {
    setEditingAcceso(null);
    setFormData({ ID: generateId(), CORREO: '' });
    setSelectedModules([]);
    setShowForm(true);
  };

  const openEditForm = (acc: Acceso) => {
    setEditingAcceso(acc);
    setFormData(acc);
    setSelectedModules((acc.MODULOS_PERMITIDOS || '').split(',').map(m => m.trim()).filter(Boolean));
    setShowForm(true);
  };

  const toggleModule = (modId: string) => {
    setSelectedModules(prev => 
      prev.includes(modId) ? prev.filter(m => m !== modId) : [...prev, modId]
    );
  };

  const selectAll = () => {
    setSelectedModules(AVAILABLE_MODULES.map(m => m.id));
  };

  const deselectAll = () => {
    setSelectedModules([]);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.CORREO) {
      alert("El correo es obligatorio.");
      return;
    }
    
    setIsSaving(true);
    try {
      const finalData = {
        ...formData,
        MODULOS_PERMITIDOS: selectedModules.join(',')
      };

      if (editingAcceso) {
        const updatedAcc = { ...editingAcceso, ...finalData } as Acceso;
        await updateAcceso((updatedAcc as any)._rowIndex, updatedAcc);
        setAccesos(prev => prev.map(a => a.ID === updatedAcc.ID ? updatedAcc : a));
      } else {
        const newAcc = {
          ID: formData.ID || generateId(),
          CORREO: finalData.CORREO,
          MODULOS_PERMITIDOS: finalData.MODULOS_PERMITIDOS,
          _rowIndex: -1
        } as unknown as Acceso;
        
        await createAcceso(newAcc);
        // Refresh to get correct rowIndex
        const data = await fetchAppData();
        setAccesos(data.accesos || []);
      }
      setShowForm(false);
    } catch (error: any) {
      console.error(error);
      alert("Error al guardar: " + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    setIsDeleting(true);
    try {
      if ((deleteConfirm as any)._rowIndex === undefined || (deleteConfirm as any)._rowIndex === -1) {
        alert("Por favor actualice la página antes de eliminar este registro.");
        setIsDeleting(false);
        return;
      }
      await deleteRows('ACCESOS', [(deleteConfirm as any)._rowIndex]);
      setAccesos(prev => prev.filter(a => a.ID !== deleteConfirm.ID));
      setDeleteConfirm(null);
    } catch (error: any) {
      console.error(error);
      alert("Error al eliminar: " + error.message);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="flex flex-col flex-1 w-full overflow-hidden h-full bg-[#0B1120] text-slate-300 font-sans relative">
      {loading && (
        <div className="absolute inset-0 bg-[#0B1120]/50 backdrop-blur-sm z-50 flex flex-col items-center justify-center">
          <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-indigo-400 font-bold mt-4 animate-pulse">Cargando accesos...</p>
        </div>
      )}

      {error && (
        <div className="p-4 flex items-center justify-center">
          <GoogleErrorCard error={error} onRetry={loadData} title="Error en Control de Accesos" />
        </div>
      )}

      {/* Header */}
      <header className="bg-[#111827] border-b border-slate-800 p-3 sm:p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 sm:w-10 sm:h-10 bg-indigo-900/50 rounded-xl flex items-center justify-center border border-indigo-500/30 shrink-0">
            <KeyRound className="w-5 h-5 text-indigo-400" />
          </div>
          <div>
            <h1 className="text-base sm:text-xl font-bold text-white tracking-wide">CONTROL DE ACCESOS</h1>
            <p className="text-[11px] sm:text-xs text-slate-500">Gestión de permisos por cuenta de Google</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2 self-end sm:self-auto w-full sm:w-auto justify-end">
          <button onClick={loadData} className="px-3 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-bold transition-all bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300">Actualizar</button>
          <button 
            onClick={openNewForm}
            className="flex items-center gap-1.5 sm:gap-2 px-3.5 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-bold transition-all bg-indigo-600 hover:bg-indigo-500 text-white shadow-md"
          >
            <Plus className="w-4 h-4" /> Nuevo Acceso
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-2 sm:p-6 custom-scrollbar">
        <div className="max-w-6xl mx-auto">
          
          <div className="bg-[#111827] rounded-xl border border-slate-800 overflow-x-auto custom-scrollbar">
            <table className="w-full text-left text-xs sm:text-sm text-slate-300 min-w-[550px]">
              <thead className="text-xs uppercase bg-slate-800/80 text-slate-400 border-b border-slate-700">
                <tr>
                  <th className="px-4 py-3">ID</th>
                  <th className="px-4 py-3">Correo Electrónico (Gmail)</th>
                  <th className="px-4 py-3">Módulos Permitidos</th>
                  <th className="px-4 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {accesos.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-slate-500">No se encontraron registros de acceso. (Solo jose.ching@gmail.com tiene acceso total por defecto)</td>
                  </tr>
                ) : (
                  accesos.map(acc => {
                    const modules = (acc.MODULOS_PERMITIDOS || '').split(',').filter(Boolean);
                    
                    return (
                      <tr key={acc.ID} className="hover:bg-slate-800/30 transition-colors">
                        <td className="px-4 py-3 font-medium text-slate-400">{acc.ID}</td>
                        <td className="px-4 py-3 font-bold text-white">{acc.CORREO}</td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1.5">
                            {acc.CORREO === 'jose.ching@gmail.com' ? (
                               <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30">
                                 ADMIN TOTAL
                               </span>
                            ) : modules.length === 0 ? (
                               <span className="text-slate-500 text-xs italic">Ninguno</span>
                            ) : (
                               modules.map(mod => {
                                 const modLabel = AVAILABLE_MODULES.find(m => m.id === mod)?.label || mod;
                                 return (
                                   <span key={mod} className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-slate-700 text-slate-300 border border-slate-600">
                                     {modLabel}
                                   </span>
                                 );
                               })
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          <button onClick={() => openEditForm(acc)} className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded transition-colors ml-1">
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          {acc.CORREO !== 'jose.ching@gmail.com' && (
                            <button onClick={() => setDeleteConfirm(acc)} className="p-1.5 bg-slate-800 hover:bg-red-900/50 text-slate-400 hover:text-red-400 rounded transition-colors ml-1">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          
        </div>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-[#111827] rounded-2xl border border-slate-700 w-full max-w-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 max-h-[90vh]">
            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-800 bg-slate-800/30">
              <h2 className="text-lg font-bold text-white">{editingAcceso ? 'Editar Acceso' : 'Nuevo Acceso'}</h2>
              <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="overflow-y-auto p-6 custom-scrollbar">
              <form onSubmit={handleSave} className="flex flex-col gap-6">
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">ID</label>
                    <input type="text" value={formData.ID || ''} disabled className="bg-slate-900 border border-slate-800 text-slate-400 text-sm rounded-lg px-3 py-2" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Correo Electrónico</label>
                    <input 
                      type="email" 
                      required 
                      value={formData.CORREO || ''} 
                      onChange={e => setFormData({...formData, CORREO: e.target.value.toLowerCase()})} 
                      className="bg-slate-900 border border-slate-700 text-white text-sm rounded-lg px-3 py-2 focus:border-indigo-500 outline-none" 
                      placeholder="usuario@gmail.com"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Módulos Permitidos</label>
                    <div className="flex gap-2">
                      <button type="button" onClick={selectAll} className="text-xs text-indigo-400 hover:text-indigo-300 font-bold">Seleccionar Todos</button>
                      <span className="text-slate-600">|</span>
                      <button type="button" onClick={deselectAll} className="text-xs text-slate-400 hover:text-slate-300 font-bold">Ninguno</button>
                    </div>
                  </div>
                  
                  {formData.CORREO === 'jose.ching@gmail.com' ? (
                     <div className="bg-blue-900/20 border border-blue-900/50 p-4 rounded-xl text-center">
                       <p className="text-blue-400 font-bold">Esta cuenta tiene acceso de Administrador Total por defecto.</p>
                       <p className="text-blue-300/70 text-sm mt-1">Tiene acceso a todos los módulos independientemente de lo que se seleccione aquí.</p>
                     </div>
                  ) : null}

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {AVAILABLE_MODULES.map(mod => {
                      const isSelected = selectedModules.includes(mod.id);
                      return (
                        <div 
                          key={mod.id}
                          onClick={() => toggleModule(mod.id)}
                          className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${isSelected ? 'bg-indigo-900/30 border-indigo-500/50' : 'bg-slate-900/50 border-slate-800 hover:border-slate-700'}`}
                        >
                          <div className={`w-5 h-5 rounded flex items-center justify-center border ${isSelected ? 'bg-indigo-500 border-indigo-500 text-white' : 'bg-slate-800 border-slate-700'}`}>
                            {isSelected && <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                          </div>
                          <span className={`text-sm font-medium ${isSelected ? 'text-white' : 'text-slate-400'}`}>{mod.label}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="flex gap-3 mt-2 pt-4 border-t border-slate-800">
                  <button type="button" onClick={() => setShowForm(false)} className="flex-1 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-lg transition-colors">Cancelar</button>
                  <button type="submit" disabled={isSaving} className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-600/50 text-white font-bold rounded-lg transition-colors flex items-center justify-center gap-2">
                    {isSaving ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      'Guardar'
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-[#111827] rounded-2xl border border-red-900/50 w-full max-w-sm shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-6 flex flex-col items-center text-center gap-4">
              <div className="w-12 h-12 bg-red-900/30 rounded-full flex items-center justify-center text-red-500">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white mb-2">¿Eliminar Acceso?</h3>
                <p className="text-sm text-slate-400">Esta acción no se puede deshacer.</p>
              </div>
              <div className="w-full bg-slate-900 rounded-lg p-3 text-left border border-slate-800 mt-2">
                <p className="text-xs font-bold text-slate-500">ID: <span className="text-slate-300">{deleteConfirm.ID}</span></p>
                <p className="text-xs font-bold text-slate-500 mt-1">Correo: <span className="text-slate-300">{deleteConfirm.CORREO}</span></p>
              </div>
            </div>
            <div className="flex gap-2 p-4 bg-slate-800/30 border-t border-slate-800">
              <button onClick={() => setDeleteConfirm(null)} disabled={isDeleting} className="flex-1 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-lg transition-colors">Cancelar</button>
              <button onClick={handleDelete} disabled={isDeleting} className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-500 disabled:bg-red-600/50 text-white font-bold rounded-lg transition-colors flex items-center justify-center gap-2">
                {isDeleting ? 'Eliminando...' : 'Sí, Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
