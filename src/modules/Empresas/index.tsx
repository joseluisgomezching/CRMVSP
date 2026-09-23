import React, { useEffect, useState, useRef } from 'react';
import { 
  fetchAppData, createEmpresa, updateEmpresa, deleteRows,
  createContacto, updateContacto, createTecnico, updateTecnico, uploadImage 
} from '../../lib/googleApi';
import type { AppData, Empresa, Contacto, Tecnico } from '../../types';
import { Plus, Edit2, Trash2, Search, Upload, X } from 'lucide-react';
import SignaturePad from '../../components/SignaturePad';
import { AuthenticatedImage } from '../../components/AuthenticatedImage';
import GoogleErrorCard from '../../components/GoogleErrorCard';

function dataURLtoFile(dataurl: string, filename: string) {
  const arr = dataurl.split(',');
  const match = arr[0].match(/:(.*?);/);
  const mime = match ? match[1] : 'image/png';
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while(n--){
      u8arr[n] = bstr.charCodeAt(n);
  }
  return new File([u8arr], filename, {type:mime});
}

const TECNICOS_FOLDER_ID = '1EEQ9aMpJ_mrhODiGVDWolTyq5a6ScLcZ';

export default function EmpresasModule() {
  const [data, setData] = useState<AppData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Selection
  const [selectedEmpresa, setSelectedEmpresa] = useState<Empresa | null>(null);
  const [searchEmpresa, setSearchEmpresa] = useState('');

  // Modals
  const [showEmpresaModal, setShowEmpresaModal] = useState(false);
  const [showContactoModal, setShowContactoModal] = useState(false);
  const [showTecnicoModal, setShowTecnicoModal] = useState(false);
  
  const [editingEmpresa, setEditingEmpresa] = useState<Empresa | null>(null);
  const [editingContacto, setEditingContacto] = useState<Contacto | null>(null);
  const [editingTecnico, setEditingTecnico] = useState<Tecnico | null>(null);

  // Forms
  const [empresaForm, setEmpresaForm] = useState<Partial<Empresa>>({});
  const [contactoForm, setContactoForm] = useState<Partial<Contacto>>({});
  const [tecnicoForm, setTecnicoForm] = useState<Partial<Tecnico>>({});
  
  const [tecnicoFotoFile, setTecnicoFotoFile] = useState<File | null>(null);
  const [tecnicoFirmaDataUrl, setTecnicoFirmaDataUrl] = useState<string | null>(null);
  const [showSignaturePad, setShowSignaturePad] = useState(false);
  
  const [isSaving, setIsSaving] = useState(false);

  const empresasColRef = useRef<HTMLDivElement>(null);
  const contactosColRef = useRef<HTMLDivElement>(null);
  const tecnicosColRef = useRef<HTMLDivElement>(null);

  const scrollToCol = (colRef: React.RefObject<HTMLDivElement>) => {
    colRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  };

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const appData = await fetchAppData();
      setData(appData);
    } catch (e: any) {
      console.error(e);
      setError(e.message || 'Error cargando datos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  if (loading) {
    return (
      <div className="flex-1 w-full flex items-center justify-center p-8">
        <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex-1 w-full flex items-center justify-center p-8">
        <GoogleErrorCard error={error || 'No se pudieron cargar los datos'} onRetry={loadData} title="Error en Empresas y Personal" />
      </div>
    );
  }

  const filteredEmpresas = data.empresas.filter(e => e.CLIENTE.toLowerCase().includes(searchEmpresa.toLowerCase()));
  const filteredContactos = selectedEmpresa ? data.contactos.filter(c => c.EMPRESA === selectedEmpresa.CLIENTE) : [];
  const tecnicos = data.tecnicos;

  // -- EMPRESA LOGIC --
  const handleSaveEmpresa = async () => {
    if (!empresaForm.CLIENTE) return alert('CLIENTE es requerido');
    setIsSaving(true);
    try {
      if (editingEmpresa) {
        const index = data.empresas.findIndex(e => e.ID === editingEmpresa.ID);
        if (index >= 0) {
          const updated = { ...editingEmpresa, ...empresaForm };
          await updateEmpresa(index + 2, updated);
          data.empresas[index] = updated as Empresa;
          setData({ ...data });
        }
      } else {
        const nums = data.empresas.map(e => parseInt(e.ID.replace('CL-', ''))).filter(n => !isNaN(n));
        const max = nums.length ? Math.max(...nums) : 0;
        const newId = `CL-${String(max + 1).padStart(4, '0')}`;
        const newEmpresa = { ...empresaForm, ID: newId };
        await createEmpresa(newEmpresa);
        data.empresas.push(newEmpresa as Empresa);
        setData({ ...data });
      }
      setShowEmpresaModal(false);
      setEditingEmpresa(null);
      setEmpresaForm({});
    } catch (e) {
      console.error(e);
      alert('Error saving empresa');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteEmpresa = async (empresa: Empresa) => {
    if (!window.confirm(`¿Eliminar empresa ${empresa.CLIENTE}? Se eliminarán sus contactos.`)) return;
    setIsSaving(true);
    try {
      const eIndex = data.empresas.findIndex(e => e.ID === empresa.ID);
      if (eIndex >= 0) {
        await deleteRows('EMPRESA', [eIndex + 2]);
        data.empresas.splice(eIndex, 1);
      }
      
      const cIndices = data.contactos
        .map((c, i) => c.EMPRESA === empresa.CLIENTE ? i + 2 : -1)
        .filter(i => i > 0);
        
      if (cIndices.length > 0) {
        await deleteRows('CONTACTOS', cIndices);
        data.contactos = data.contactos.filter(c => c.EMPRESA !== empresa.CLIENTE);
      }
      
      if (selectedEmpresa?.ID === empresa.ID) setSelectedEmpresa(null);
      setData({ ...data });
    } catch (e) {
      console.error(e);
      alert('Error deleting empresa');
    } finally {
      setIsSaving(false);
    }
  };

  // -- CONTACTO LOGIC --
  const handleSaveContacto = async () => {
    if (!contactoForm.NOMBRE || !contactoForm.EMPRESA) return alert('NOMBRE y EMPRESA son requeridos');
    setIsSaving(true);
    try {
      if (editingContacto) {
        const index = data.contactos.findIndex(c => c.ID === editingContacto.ID);
        if (index >= 0) {
          const updated = { ...editingContacto, ...contactoForm };
          await updateContacto(index + 2, updated);
          data.contactos[index] = updated as Contacto;
          setData({ ...data });
        }
      } else {
        const nums = data.contactos.map(c => parseInt(c.ID.replace('c', ''))).filter(n => !isNaN(n));
        const max = nums.length ? Math.max(...nums) : 0;
        const newId = `c${String(max + 1).padStart(3, '0')}`;
        const newContacto = { ...contactoForm, ID: newId };
        await createContacto(newContacto);
        data.contactos.push(newContacto as Contacto);
        setData({ ...data });
      }
      setShowContactoModal(false);
      setEditingContacto(null);
      setContactoForm({});
    } catch (e) {
      console.error(e);
      alert('Error saving contacto');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteContacto = async (contacto: Contacto) => {
    if (!window.confirm(`¿Eliminar contacto ${contacto.NOMBRE}?`)) return;
    setIsSaving(true);
    try {
      const index = data.contactos.findIndex(c => c.ID === contacto.ID);
      if (index >= 0) {
        await deleteRows('CONTACTOS', [index + 2]);
        data.contactos.splice(index, 1);
        setData({ ...data });
      }
    } catch (e) {
      console.error(e);
      alert('Error deleting contacto');
    } finally {
      setIsSaving(false);
    }
  };

  // -- TECNICO LOGIC --
  const handleSaveTecnico = async () => {
    if (!tecnicoForm.NOMBRE) return alert('NOMBRE es requerido');
    setIsSaving(true);
    try {
      let finalFoto = tecnicoForm.FOTO || '';
      let finalFirma = tecnicoForm.FIRMATECH || '';

      if (tecnicoFotoFile) {
        const filename = `FOTO_${tecnicoForm.NOMBRE?.replace(/\s+/g, '_')}_${Date.now()}.jpg`;
        finalFoto = await uploadImage(tecnicoFotoFile, TECNICOS_FOLDER_ID, filename);
      }
      
      if (tecnicoFirmaDataUrl) {
        const file = dataURLtoFile(tecnicoFirmaDataUrl, `FIRMA_${tecnicoForm.NOMBRE?.replace(/\s+/g, '_')}_${Date.now()}.png`);
        finalFirma = await uploadImage(file, TECNICOS_FOLDER_ID);
      }

      const updatedForm = { ...tecnicoForm, FOTO: finalFoto, FIRMATECH: finalFirma };

      if (editingTecnico) {
        const index = data.tecnicos.findIndex(t => t.ID === editingTecnico.ID);
        if (index >= 0) {
          const updated = { ...editingTecnico, ...updatedForm };
          await updateTecnico(index + 2, updated);
          data.tecnicos[index] = updated as Tecnico;
          setData({ ...data });
        }
      } else {
        const nums = data.tecnicos.map(t => parseInt(t.ID.replace('TECH-', ''))).filter(n => !isNaN(n));
        const max = nums.length ? Math.max(...nums) : 0;
        const newId = `TECH-${String(max + 1).padStart(4, '0')}`;
        const newTecnico = { ...updatedForm, ID: newId };
        await createTecnico(newTecnico);
        data.tecnicos.push(newTecnico as Tecnico);
        setData({ ...data });
      }
      setShowTecnicoModal(false);
      setEditingTecnico(null);
      setTecnicoForm({});
      setTecnicoFotoFile(null);
      setTecnicoFirmaDataUrl(null);
    } catch (e) {
      console.error(e);
      alert('Error saving tecnico');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="w-full h-full max-w-[1600px] mx-auto flex flex-col gap-3 sm:gap-6 text-white overflow-hidden p-1 sm:p-2">
      {/* Mobile Column Quick Navigation Pills */}
      <div className="flex lg:hidden items-center justify-between gap-1.5 bg-slate-900/80 p-1.5 rounded-xl border border-slate-800 shrink-0">
        <button 
          onClick={() => scrollToCol(empresasColRef)}
          className="flex-1 py-1.5 px-2 rounded-lg text-xs font-bold text-slate-300 hover:text-white bg-slate-800/80 active:bg-blue-600 transition-colors text-center"
        >
          Empresas ({filteredEmpresas.length})
        </button>
        <button 
          onClick={() => scrollToCol(contactosColRef)}
          className="flex-1 py-1.5 px-2 rounded-lg text-xs font-bold text-slate-300 hover:text-white bg-slate-800/80 active:bg-emerald-600 transition-colors text-center"
        >
          Contactos {selectedEmpresa ? `(${filteredContactos.length})` : ''}
        </button>
        <button 
          onClick={() => scrollToCol(tecnicosColRef)}
          className="flex-1 py-1.5 px-2 rounded-lg text-xs font-bold text-slate-300 hover:text-white bg-slate-800/80 active:bg-amber-600 transition-colors text-center"
        >
          Técnicos ({tecnicos.length})
        </button>
      </div>

      <div className="flex-1 flex flex-row lg:grid lg:grid-cols-3 gap-4 lg:gap-6 overflow-x-auto lg:overflow-hidden snap-x snap-mandatory h-full pb-2 custom-scrollbar">
        
        {/* COL 1: EMPRESAS */}
        <div ref={empresasColRef} className="w-[88vw] sm:w-[380px] lg:w-auto shrink-0 snap-center h-full bg-slate-900/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl flex flex-col overflow-hidden">
          <div className="p-4 border-b border-slate-700/50 flex flex-col gap-3">
            <div className="flex justify-between items-center">
              <h2 className="font-bold text-base sm:text-lg flex items-center gap-2">
                Empresas <span className="text-xs text-blue-400 bg-blue-900/30 px-2 py-0.5 rounded-full border border-blue-800">{filteredEmpresas.length}</span>
              </h2>
              <button 
                onClick={() => { setEditingEmpresa(null); setEmpresaForm({}); setShowEmpresaModal(true); }}
                className="bg-blue-600 hover:bg-blue-500 text-white p-1.5 rounded-lg transition-colors shadow-md"
                title="Agregar Empresa"
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                value={searchEmpresa} onChange={e => setSearchEmpresa(e.target.value)}
                placeholder="Buscar por cliente..."
                className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-sm focus:border-blue-500 outline-none transition-colors"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 custom-scrollbar">
            {filteredEmpresas.map(emp => (
              <div 
                key={emp.ID} 
                onClick={() => setSelectedEmpresa(emp)}
                className={`p-4 rounded-xl border cursor-pointer transition-all active:scale-[0.99] ${selectedEmpresa?.ID === emp.ID ? 'bg-blue-900/50 border-blue-500 shadow-md' : 'bg-slate-800/50 border-slate-700 hover:bg-slate-800'}`}
              >
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-bold text-sm text-white">{emp.CLIENTE}</h3>
                  <div className="flex gap-2">
                    <button onClick={(e) => { e.stopPropagation(); setEditingEmpresa(emp); setEmpresaForm(emp); setShowEmpresaModal(true); }} className="text-slate-400 hover:text-blue-400 p-1"><Edit2 className="w-4 h-4"/></button>
                    <button onClick={(e) => { e.stopPropagation(); handleDeleteEmpresa(emp); }} className="text-slate-400 hover:text-red-400 p-1"><Trash2 className="w-4 h-4"/></button>
                  </div>
                </div>
                <div className="text-xs text-slate-400 flex flex-col gap-1">
                  <p>RUC: <span className="text-slate-300 font-medium">{emp.RUC || '-'}</span></p>
                  <p className="line-clamp-1 text-slate-500">{emp.DIRECCION || '-'}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* COL 2: CONTACTOS */}
        <div ref={contactosColRef} className="w-[88vw] sm:w-[380px] lg:w-auto shrink-0 snap-center h-full bg-slate-900/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl flex flex-col overflow-hidden">
          <div className="p-4 border-b border-slate-700/50 flex justify-between items-center">
            <h2 className="font-bold text-base sm:text-lg truncate mr-2">Contactos {selectedEmpresa && `(${selectedEmpresa.CLIENTE})`}</h2>
            <button 
                onClick={() => { setEditingContacto(null); setContactoForm(selectedEmpresa ? { EMPRESA: selectedEmpresa.CLIENTE } : {}); setShowContactoModal(true); }}
                className="bg-emerald-600 hover:bg-emerald-500 text-white p-1.5 rounded-lg transition-colors shadow-md shrink-0"
                title="Agregar Contacto"
              >
                <Plus className="w-5 h-5" />
              </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 custom-scrollbar">
            {!selectedEmpresa && <div className="text-slate-500 text-sm text-center p-8 bg-slate-800/30 rounded-xl border border-slate-800">Seleccione una empresa para ver sus contactos</div>}
            {selectedEmpresa && filteredContactos.length === 0 && <div className="text-slate-500 text-sm text-center p-8 bg-slate-800/30 rounded-xl border border-slate-800">Sin contactos para esta empresa</div>}
            {filteredContactos.map(cont => (
              <div key={cont.ID} className="p-4 bg-slate-800/50 border border-slate-700 rounded-xl">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-bold text-sm text-emerald-400">{cont.NOMBRE}</h3>
                  <div className="flex gap-2">
                    <button onClick={() => { setEditingContacto(cont); setContactoForm(cont); setShowContactoModal(true); }} className="text-slate-400 hover:text-emerald-400 p-1"><Edit2 className="w-4 h-4"/></button>
                    <button onClick={() => handleDeleteContacto(cont)} className="text-slate-400 hover:text-red-400 p-1"><Trash2 className="w-4 h-4"/></button>
                  </div>
                </div>
                <div className="text-xs text-slate-300 flex flex-col gap-1">
                  <p className="font-medium text-white">{cont.CARGO || '-'}</p>
                  <p>Cel: <span className="text-emerald-300 font-medium">{cont.PREFIJO} {cont.CELULAR}</span></p>
                  <p className="text-slate-400 truncate">{cont.CORREO}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* COL 3: PERSONAL TECNICO */}
        <div ref={tecnicosColRef} className="w-[88vw] sm:w-[380px] lg:w-auto shrink-0 snap-center h-full bg-slate-900/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl flex flex-col overflow-hidden">
          <div className="p-4 border-b border-slate-700/50 flex justify-between items-center">
            <h2 className="font-bold text-base sm:text-lg">Personal Técnico</h2>
            <button 
                onClick={() => { setEditingTecnico(null); setTecnicoForm({}); setTecnicoFotoFile(null); setTecnicoFirmaDataUrl(null); setShowTecnicoModal(true); }}
                className="bg-amber-600 hover:bg-amber-500 text-white p-1.5 rounded-lg transition-colors shadow-md"
                title="Agregar Técnico"
              >
                <Plus className="w-5 h-5" />
              </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 custom-scrollbar">
            {tecnicos.map(tec => (
              <div key={tec.ID} className="p-3 bg-slate-800/50 border border-slate-700 rounded-xl flex gap-3 sm:gap-4 items-center">
                <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-lg bg-slate-700 overflow-hidden shrink-0 border border-slate-600">
                  {tec.FOTO ? (
                    <AuthenticatedImage src={tec.FOTO} referrerPolicy="no-referrer" alt="Foto" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-xs text-slate-500">Sin Foto</div>
                  )}
                </div>
                <div className="flex-1 flex flex-col justify-center min-w-0">
                  <h3 className="font-bold text-sm text-amber-400 truncate">{tec.NOMBRE}</h3>
                  <div className="text-xs text-slate-300 mt-1 space-y-0.5">
                    <p>DNI: <span className="font-mono">{tec.DNI || '-'}</span></p>
                    <p>Cel: <span className="font-mono">{tec.CELULAR || '-'}</span></p>
                  </div>
                </div>
                <button onClick={() => { setEditingTecnico(tec); setTecnicoForm(tec); setTecnicoFotoFile(null); setTecnicoFirmaDataUrl(null); setShowTecnicoModal(true); }} className="text-slate-400 hover:text-amber-400 self-start p-1"><Edit2 className="w-4 h-4"/></button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* MODALS */}
      {showEmpresaModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md p-6 flex flex-col gap-4">
            <h3 className="text-xl font-bold">{editingEmpresa ? 'Editar Empresa' : 'Agregar Empresa'}</h3>
            <div className="flex flex-col gap-3">
              <input placeholder="CLIENTE" className="bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-sm outline-none focus:border-blue-500" value={empresaForm.CLIENTE || ''} onChange={e => setEmpresaForm({...empresaForm, CLIENTE: e.target.value})} />
              <input placeholder="RUC" className="bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-sm outline-none focus:border-blue-500" value={empresaForm.RUC || ''} onChange={e => setEmpresaForm({...empresaForm, RUC: e.target.value})} />
              <input placeholder="DIRECCIÓN" className="bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-sm outline-none focus:border-blue-500" value={empresaForm.DIRECCION || ''} onChange={e => setEmpresaForm({...empresaForm, DIRECCION: e.target.value})} />
            </div>
            <div className="flex justify-end gap-3 mt-4">
              <button disabled={isSaving} onClick={() => setShowEmpresaModal(false)} className="px-4 py-2 rounded-lg text-sm text-slate-300 hover:bg-slate-800">Cancelar</button>
              <button disabled={isSaving} onClick={handleSaveEmpresa} className="px-4 py-2 rounded-lg text-sm bg-blue-600 hover:bg-blue-500 text-white font-bold">{isSaving ? 'Guardando...' : 'Guardar'}</button>
            </div>
          </div>
        </div>
      )}

      {showContactoModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md p-6 flex flex-col gap-4">
            <h3 className="text-xl font-bold">{editingContacto ? 'Editar Contacto' : 'Agregar Contacto'}</h3>
            <div className="grid grid-cols-2 gap-3">
              <select className="col-span-2 bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-sm outline-none focus:border-emerald-500" value={contactoForm.EMPRESA || ''} onChange={e => setContactoForm({...contactoForm, EMPRESA: e.target.value})}>
                <option value="">Seleccione Empresa...</option>
                {data.empresas.map(e => <option key={e.ID} value={e.CLIENTE}>{e.CLIENTE}</option>)}
              </select>
              <input placeholder="NOMBRE" className="col-span-2 bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-sm outline-none focus:border-emerald-500" value={contactoForm.NOMBRE || ''} onChange={e => setContactoForm({...contactoForm, NOMBRE: e.target.value})} />
              <input placeholder="CARGO" className="col-span-2 bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-sm outline-none focus:border-emerald-500" value={contactoForm.CARGO || ''} onChange={e => setContactoForm({...contactoForm, CARGO: e.target.value})} />
              <input placeholder="PREFIJO (+51)" className="bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-sm outline-none focus:border-emerald-500" value={contactoForm.PREFIJO || ''} onChange={e => setContactoForm({...contactoForm, PREFIJO: e.target.value})} />
              <input placeholder="CELULAR" className="bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-sm outline-none focus:border-emerald-500" value={contactoForm.CELULAR || ''} onChange={e => setContactoForm({...contactoForm, CELULAR: e.target.value})} />
              <input placeholder="CORREO" className="col-span-2 bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-sm outline-none focus:border-emerald-500" value={contactoForm.CORREO || ''} onChange={e => setContactoForm({...contactoForm, CORREO: e.target.value})} />
              <input placeholder="País" className="col-span-2 bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-sm outline-none focus:border-emerald-500" value={contactoForm.Pais || ''} onChange={e => setContactoForm({...contactoForm, Pais: e.target.value})} />
            </div>
            <div className="flex justify-end gap-3 mt-4">
              <button disabled={isSaving} onClick={() => setShowContactoModal(false)} className="px-4 py-2 rounded-lg text-sm text-slate-300 hover:bg-slate-800">Cancelar</button>
              <button disabled={isSaving} onClick={handleSaveContacto} className="px-4 py-2 rounded-lg text-sm bg-emerald-600 hover:bg-emerald-500 text-white font-bold">{isSaving ? 'Guardando...' : 'Guardar'}</button>
            </div>
          </div>
        </div>
      )}

      {showTecnicoModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg p-6 flex flex-col gap-4 max-h-[90vh] overflow-y-auto custom-scrollbar">
            <h3 className="text-xl font-bold">{editingTecnico ? 'Editar Personal' : 'Agregar Personal'}</h3>
            <div className="grid grid-cols-2 gap-3">
              {editingTecnico && <input readOnly value={editingTecnico.ID} className="col-span-2 bg-slate-800/50 text-slate-500 border border-slate-700 rounded-lg p-2.5 text-sm outline-none" />}
              <input placeholder="NOMBRE" className="col-span-2 bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-sm outline-none focus:border-amber-500" value={tecnicoForm.NOMBRE || ''} onChange={e => setTecnicoForm({...tecnicoForm, NOMBRE: e.target.value})} />
              <input placeholder="DNI" className="bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-sm outline-none focus:border-amber-500" value={tecnicoForm.DNI || ''} onChange={e => setTecnicoForm({...tecnicoForm, DNI: e.target.value})} />
              <input placeholder="CELULAR" className="bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-sm outline-none focus:border-amber-500" value={tecnicoForm.CELULAR || ''} onChange={e => setTecnicoForm({...tecnicoForm, CELULAR: e.target.value})} />
              <input type="date" placeholder="FECHA DE NACIMIENTO" className="col-span-2 bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-sm outline-none focus:border-amber-500 text-slate-300" value={tecnicoForm['FECHA DE NACIMIENTO'] || ''} onChange={e => setTecnicoForm({...tecnicoForm, 'FECHA DE NACIMIENTO': e.target.value})} />
              
              <div className="col-span-2 bg-slate-800 border border-slate-700 rounded-lg p-4 flex flex-col gap-3">
                <span className="text-sm font-bold text-slate-400">Fotografía (JPG/JPEG)</span>
                <input type="file" accept="image/jpeg, image/jpg" onChange={e => { if(e.target.files?.[0]) setTecnicoFotoFile(e.target.files[0]) }} className="text-sm text-slate-300" />
                {tecnicoFotoFile && <div className="text-xs text-amber-400">Nueva foto seleccionada</div>}
                {!tecnicoFotoFile && tecnicoForm.FOTO && <div className="text-xs text-slate-400">Foto actual conservada</div>}
              </div>

              <div className="col-span-2 bg-slate-800 border border-slate-700 rounded-lg p-4 flex flex-col gap-3">
                <span className="text-sm font-bold text-slate-400">Firma Digital</span>
                {tecnicoFirmaDataUrl ? (
                   <div className="flex flex-col gap-2">
                     <img src={tecnicoFirmaDataUrl} className="h-24 object-contain bg-white rounded-lg p-1" />
                     <button onClick={() => setTecnicoFirmaDataUrl(null)} className="text-red-400 text-xs text-left hover:underline">Eliminar nueva firma</button>
                   </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {tecnicoForm.FIRMATECH && <div className="text-xs text-slate-400 mb-2">Firma actual conservada</div>}
                    <button onClick={() => setShowSignaturePad(true)} className="bg-slate-700 hover:bg-slate-600 text-white rounded-lg p-2 text-sm text-center">Registrar Nueva Firma</button>
                  </div>
                )}
              </div>

            </div>
            <div className="flex justify-end gap-3 mt-4">
              <button disabled={isSaving} onClick={() => setShowTecnicoModal(false)} className="px-4 py-2 rounded-lg text-sm text-slate-300 hover:bg-slate-800">Cancelar</button>
              <button disabled={isSaving} onClick={handleSaveTecnico} className="px-4 py-2 rounded-lg text-sm bg-amber-600 hover:bg-amber-500 text-white font-bold">{isSaving ? 'Guardando...' : 'Guardar'}</button>
            </div>
          </div>
        </div>
      )}

      {showSignaturePad && (
        <div className="fixed inset-0 z-[60] bg-black/90 flex flex-col items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl relative border-4 border-amber-500">
             <SignaturePad 
               title="Firma del Técnico"
               onSave={(dataUrl) => { setTecnicoFirmaDataUrl(dataUrl); setShowSignaturePad(false); }}
               onCancel={() => setShowSignaturePad(false)}
             />
          </div>
        </div>
      )}
    </div>
  );
}
