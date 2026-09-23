import { useState, useEffect } from 'react';
import { fetchAppData } from '../../lib/googleApi';
import { AppData } from '../../types';
import TicketForm from './TicketForm';
import GoogleErrorCard from '../../components/GoogleErrorCard';

export default function TicketsModule() {
  const [data, setData] = useState<AppData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<'FORM' | 'INTERNAMIENTO'>('FORM');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const appData = await fetchAppData();
      setData(appData);
    } catch (err: any) {
      setError(err.message || 'Error cargando datos');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 w-full flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 w-full flex items-center justify-center p-4">
        <GoogleErrorCard error={error} onRetry={loadData} title="Error al cargar Tickets" />
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="w-full h-full flex flex-col gap-4">
      <div className="flex items-center gap-4 border-b border-slate-800 pb-4">
        <button
          onClick={() => setView('FORM')}
          className={`px-4 py-2 rounded-lg font-bold text-sm transition-colors ${
            view === 'FORM' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'
          }`}
        >
          INGRESO DE TICKET
        </button>
        {/* INTERNAMIENTO will go here */}
      </div>

      <div className="flex-1 overflow-hidden flex flex-col">
        {view === 'FORM' && <TicketForm data={data} onTicketCreated={() => { loadData(); }} onCancel={() => {}} />}
      </div>
    </div>
  );
}
