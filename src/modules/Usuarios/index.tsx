import { useEffect, useState, type FormEvent } from 'react';

type User = { email: string; name: string; modules: string[]; active: boolean };
const moduleLabels: Record<string, string> = {
  TICKET: 'Tickets', TICKETS_CERRADOS: 'Tickets cerrados', TECNICO: 'Técnico',
  RENDIR_PASAJES: 'Rendir pasajes', INFORMES: 'Informes', EMPRESAS: 'Empresas y personal',
  EDITAR_TICKETS: 'Editar tickets', ACTIVIDADES: 'Actividades internas', CAJA_CHICA: 'Caja chica',
  COTIZACIONES: 'Cotizaciones', RENTAL: 'Rental', INVENTARIO: 'Inventario almacén'
};
const blank = (): User => ({ email: '', name: '', modules: [], active: true });

export default function Usuarios() {
  const [users, setUsers] = useState<User[]>([]);
  const [editing, setEditing] = useState<User>(blank);
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const refresh = async () => {
    const response = await fetch('/api/users');
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'No se pudo cargar usuarios');
    setUsers(data);
  };
  useEffect(() => { refresh().catch(e => setMessage(e.message)); }, []);
  const save = async (event: FormEvent) => {
    event.preventDefault(); setSaving(true); setMessage('');
    try {
      const response = await fetch('/api/users', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...editing, password })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'No se pudo guardar');
      await refresh();
      setEditing(blank()); setPassword(''); setMessage('Usuario guardado. Los cambios de permisos cierran sus sesiones anteriores.');
    } catch (e: any) { setMessage(e.message); }
    finally { setSaving(false); }
  };
  return <div className="h-full w-full overflow-y-auto rounded-xl bg-slate-900 p-4 sm:p-7 text-slate-100">
    <h2 className="text-2xl font-bold mb-1">Usuarios y módulos</h2>
    <p className="text-sm text-slate-400 mb-6">Asigna una contraseña y selecciona los módulos que verá cada usuario.</p>
    <div className="grid gap-8 lg:grid-cols-2">
      <section>
        <h3 className="font-semibold mb-3">Cuentas registradas</h3>
        <div className="space-y-2">
          {users.map(user => <button key={user.email} onClick={() => { setEditing({ ...user }); setPassword(''); setMessage(''); }}
            className="w-full text-left rounded-xl border border-slate-700 bg-slate-800 p-4 hover:border-blue-500">
            <strong>{user.name}</strong> <span className={user.active ? 'text-emerald-400' : 'text-rose-400'}>{user.active ? 'Activo' : 'Suspendido'}</span>
            <div className="text-sm text-slate-300">{user.email}</div>
            <div className="text-xs text-slate-400 mt-1">{user.modules.length} módulos</div>
          </button>)}
          {users.length === 0 && <p className="text-sm text-slate-400">Aún no hay usuarios adicionales.</p>}
        </div>
        <button type="button" onClick={() => { setEditing(blank()); setPassword(''); setMessage(''); }} className="mt-4 rounded-lg bg-slate-700 px-4 py-2">Nuevo usuario</button>
      </section>
      <form onSubmit={save} className="space-y-4">
        <h3 className="font-semibold">{users.some(u => u.email === editing.email) ? 'Editar usuario' : 'Nuevo usuario'}</h3>
        <label className="block text-sm">Nombre<input required value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} className="mt-1 block w-full rounded-lg bg-slate-800 border border-slate-600 p-2" /></label>
        <label className="block text-sm">Correo<input required type="email" disabled={users.some(u => u.email === editing.email)} value={editing.email} onChange={e => setEditing({ ...editing, email: e.target.value })} className="mt-1 block w-full rounded-lg bg-slate-800 border border-slate-600 p-2 disabled:opacity-60" /></label>
        <label className="block text-sm">Contraseña {users.some(u => u.email === editing.email) ? '(dejar vacía para conservar)' : '(mínimo 12 caracteres)'}
          <input type="password" autoComplete="new-password" minLength={12} required={!users.some(u => u.email === editing.email)} value={password} onChange={e => setPassword(e.target.value)} className="mt-1 block w-full rounded-lg bg-slate-800 border border-slate-600 p-2" /></label>
        <label className="flex gap-2 items-center text-sm"><input type="checkbox" checked={editing.active} onChange={e => setEditing({ ...editing, active: e.target.checked })} /> Cuenta activa</label>
        <fieldset className="grid grid-cols-2 gap-2">
          <legend className="font-semibold mb-2">Módulos permitidos</legend>
          {Object.entries(moduleLabels).map(([id, label]) => <label key={id} className="flex gap-2 items-center text-xs rounded-lg bg-slate-800 p-2">
            <input type="checkbox" checked={editing.modules.includes(id)} onChange={e => setEditing({ ...editing, modules: e.target.checked ? [...editing.modules, id] : editing.modules.filter(m => m !== id) })} />{label}
          </label>)}
        </fieldset>
        {message && <p role="status" className="text-sm text-blue-300">{message}</p>}
        <button disabled={saving} className="rounded-lg bg-blue-600 px-5 py-2 font-semibold disabled:opacity-50">{saving ? 'Guardando…' : 'Guardar usuario'}</button>
      </form>
    </div>
  </div>;
}
