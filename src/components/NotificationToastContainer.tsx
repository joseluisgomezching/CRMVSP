import React, { useState, useEffect } from 'react';
import { subscribeToToasts, ToastItem } from '../utils/notifications';
import { Bell, X, CheckCircle2, AlertCircle } from 'lucide-react';

export default function NotificationToastContainer() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    const unsubscribe = subscribeToToasts((newToast) => {
      setToasts(prev => [newToast, ...prev.slice(0, 4)]);

      // Auto dismiss after 7 seconds
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== newToast.id));
      }, 7000);
    });

    return unsubscribe;
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none px-4 sm:px-0">
      {toasts.map((t) => {
        const isFirma = t.title.toLowerCase().includes('firma');
        const isCerrado = t.title.toLowerCase().includes('cerrado');
        const isPendiente = t.title.toLowerCase().includes('pendiente');

        const borderColor = isFirma 
          ? 'border-emerald-500/80 bg-slate-900/95 shadow-emerald-500/20' 
          : isCerrado 
          ? 'border-emerald-500/80 bg-slate-900/95 shadow-emerald-500/20'
          : isPendiente
          ? 'border-blue-500/80 bg-slate-900/95 shadow-blue-500/20'
          : 'border-orange-500/80 bg-slate-900/95 shadow-orange-500/20';

        const iconColor = isFirma || isCerrado ? 'text-emerald-400' : isPendiente ? 'text-blue-400' : 'text-orange-400';

        return (
          <div
            key={t.id}
            className={`pointer-events-auto border-2 ${borderColor} shadow-2xl rounded-2xl p-4 text-white flex items-start gap-3 backdrop-blur-md transition-all duration-300 animate-in fade-in slide-in-from-bottom-5`}
          >
            <div className={`p-2 rounded-xl bg-slate-800/80 ${iconColor} shrink-0`}>
              {isFirma ? (
                <CheckCircle2 className="w-5 h-5" />
              ) : isPendiente ? (
                <AlertCircle className="w-5 h-5" />
              ) : (
                <Bell className="w-5 h-5" />
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded">
                  Windows & App
                </span>
                <h4 className="font-bold text-xs text-white truncate">{t.title}</h4>
              </div>
              <p className="text-xs text-slate-200 mt-1 leading-relaxed font-medium">
                {t.message}
              </p>
            </div>

            <button
              onClick={() => setToasts(prev => prev.filter(item => item.id !== t.id))}
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors shrink-0"
              title="Cerrar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
