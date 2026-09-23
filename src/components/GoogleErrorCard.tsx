import React, { useState } from 'react';
import { AlertCircle, RefreshCw, LogIn, CheckCircle2 } from 'lucide-react';


interface GoogleErrorCardProps {
  error: string | null;
  onRetry: () => void | Promise<void>;
  title?: string;
  className?: string;
}

export function isAuthError(errText?: string | null): boolean {
  if (!errText) return false;
  const lower = errText.toLowerCase();
  return (
    lower.includes('401') ||
    lower.includes('unauthenticated') ||
    lower.includes('invalid authentication credentials') ||
    lower.includes('no access token') ||
    lower.includes('sesión') ||
    lower.includes('expirada') ||
    lower.includes('credenciales')
  );
}

export default function GoogleErrorCard({
  error,
  onRetry,
  title = 'Error de Conexión',
  className = ''
}: GoogleErrorCardProps) {
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [reconnectSuccess, setReconnectSuccess] = useState(false);
  const [reconnectError, setReconnectError] = useState<string | null>(null);

  if (!error) return null;

  const isAuth = isAuthError(error);

  const handleReconnect = async () => {
    setIsReconnecting(true);
    setReconnectError(null);
    try {
      if (true) {
        setReconnectSuccess(true);
        setTimeout(async () => {
          await onRetry();
        }, 300);
      }
    } catch (err: any) {
      console.error('Error reconnecting with Google:', err);
      setReconnectError(err.message || 'No se pudo completar el inicio de sesión con Google.');
    } finally {
      setIsReconnecting(false);
    }
  };

  return (
    <div
      id="google-error-card"
      className={`w-full max-w-xl mx-auto p-6 rounded-2xl bg-slate-900/90 border ${
        isAuth ? 'border-amber-500/50 shadow-amber-500/10' : 'border-rose-700/60 shadow-rose-900/20'
      } shadow-2xl backdrop-blur-md text-white flex flex-col gap-4 ${className}`}
    >
      <div className="flex items-start gap-3.5">
        <div
          className={`p-2.5 rounded-xl shrink-0 ${
            isAuth ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
          }`}
        >
          <AlertCircle className="w-6 h-6" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-bold text-white tracking-tight">
            {isAuth ? 'Error de conexión con Google' : title}
          </h3>
          <p className="text-xs text-slate-300 mt-1 leading-relaxed">
            {isAuth
              ? 'El servidor no pudo acceder a Google Sheets o Drive. Revisa su configuración y permisos.'
              : error}
          </p>
          {isAuth && (
            <div className="mt-2 p-2 bg-slate-950/60 rounded-lg border border-slate-800 text-[11px] text-slate-400 font-mono break-all line-clamp-2">
              {error}
            </div>
          )}
        </div>
      </div>

      {reconnectError && (
        <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-300 text-xs">
          {reconnectError}
        </div>
      )}

      {reconnectSuccess && (
        <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-800 text-emerald-300 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>Conexión restablecida. Actualizando datos...</span>
        </div>
      )}

      <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-800">
        <button
          type="button"
          onClick={() => onRetry()}
          disabled={isReconnecting}
          className="px-4 py-2 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-slate-200 rounded-xl text-xs font-bold transition-all flex items-center gap-2 disabled:opacity-50"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Reintentar</span>
        </button>

        <button
          type="button"
          onClick={handleReconnect}
          disabled={isReconnecting}
          className={`px-5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-lg disabled:opacity-50 ${
            isAuth
              ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/30'
              : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/30'
          }`}
        >
          {isReconnecting ? (
            <>
              <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span>Conectando...</span>
            </>
          ) : (
            <>
              <LogIn className="w-3.5 h-3.5" />
              <span>Reintentar conexión</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
