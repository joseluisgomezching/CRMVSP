import { useState, useEffect, useCallback } from 'react';
import { CotizacionesData } from '../../types';
import { fetchCotizacionesData, ensureCotizacionesSheets } from '../../lib/cotizacionesApi';
import CotizarTab from './CotizarTab';
import ClienteVendedorTab from './ClienteVendedorTab';
import { FileText, Users, RefreshCw, AlertCircle, Sparkles, CheckCircle2 } from 'lucide-react';
import GoogleErrorCard from '../../components/GoogleErrorCard';

export default function CotizacionesModule() {
  const [activeTab, setActiveTab] = useState<'COTIZAR' | 'CLIENTES_VENDEDORES'>('COTIZAR');
  const [data, setData] = useState<CotizacionesData>({
    cotizaciones: [],
    clientes: [],
    vendedores: [],
    ventas: [],
    itemsVenta: [],
    calculosVenta: [],
    alquileres: [],
    itemsAlquiler: [],
    calculosAlquiler: [],
    outs: [],
    itemsOut: [],
    calculosOut: []
  });

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Ensure all 12 tabs exist in Google Sheets
      await ensureCotizacionesSheets();
      // Load all records
      const fullData = await fetchCotizacionesData();
      setData(fullData);
    } catch (err: any) {
      console.error('Error in CotizacionesModule:', err);
      setError(err.message || 'Error al conectar con la base de datos de Cotizaciones en Google Sheets.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <div className="flex flex-col w-full h-[calc(100vh-4rem)] bg-slate-950 text-slate-100 overflow-hidden">
      {/* Top Module Navigation Bar */}
      <header className="px-6 py-3.5 bg-slate-900 border-b border-slate-800 flex flex-wrap items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-blue-600/30">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-black text-white tracking-tight">
                MÓDULO DE COTIZACIONES
              </h1>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30">
                VASS ERP
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Gestión comercial, estructuración de costos, versionamiento y emisión A4
            </p>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 bg-slate-950 p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => setActiveTab('COTIZAR')}
            className={`flex items-center gap-2 px-5 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'COTIZAR'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>COTIZAR</span>
          </button>

          <button
            onClick={() => setActiveTab('CLIENTES_VENDEDORES')}
            className={`flex items-center gap-2 px-5 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'CLIENTES_VENDEDORES'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>CLIENTE / VENDEDOR</span>
          </button>
        </div>

        {/* Status / Refresh */}
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-950/80 border border-slate-800 text-[11px] text-slate-400">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Conectado a Google Sheets</span>
          </div>

          <button
            onClick={fetchData}
            disabled={isLoading}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors disabled:opacity-50"
            title="Refrescar base de datos"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-blue-400' : ''}`} />
          </button>
        </div>
      </header>

      {/* Main Workspace Area */}
      <main className="flex-1 overflow-hidden relative">
        {isLoading && (
          <div className="absolute inset-0 z-40 bg-slate-950/80 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center">
            <div className="w-12 h-12 border-3 border-blue-500 border-t-transparent rounded-full animate-spin mb-4" />
            <p className="text-sm font-bold text-white mb-1">Cargando base de datos de Cotizaciones...</p>
            <p className="text-xs text-slate-400">Sincronizando pestañas y fórmulas en Google Sheets</p>
          </div>
        )}

        {error && (
          <div className="p-6 flex items-center justify-center">
            <GoogleErrorCard error={error} onRetry={fetchData} title="Error en Cotizaciones" />
          </div>
        )}

        {!isLoading && !error && (
          <>
            {activeTab === 'COTIZAR' ? (
              <CotizarTab data={data} onDataRefresh={fetchData} />
            ) : (
              <ClienteVendedorTab
                clientes={data.clientes}
                vendedores={data.vendedores}
                onDataRefresh={fetchData}
              />
            )}
          </>
        )}
      </main>
    </div>
  );
}
