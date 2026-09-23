import React, { useRef, useState, useEffect } from 'react';
import { X, Eraser, Check } from 'lucide-react';

interface Props {
  onSave: (dataUrl: string) => void;
  onCancel: () => void;
  title?: string;
}

export default function SignaturePad({ onSave, onCancel, title = "Firma del Cliente" }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [ctx, setCtx] = useState<CanvasRenderingContext2D | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      // Setup canvas for high resolution
      const ratio = Math.max(window.devicePixelRatio || 1, 1);
      const parent = canvas.parentElement;
      if (parent) {
        canvas.width = parent.clientWidth * ratio;
        canvas.height = parent.clientHeight * ratio;
        canvas.style.width = `${parent.clientWidth}px`;
        canvas.style.height = `${parent.clientHeight}px`;
      }
      
      const context = canvas.getContext('2d');
      if (context) {
        context.scale(ratio, ratio);
        context.lineCap = 'round';
        context.lineJoin = 'round';
        context.strokeStyle = '#000000';
        context.lineWidth = 3;
        // White background
        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, canvas.width, canvas.height);
        setCtx(context);
      }
    }
  }, []);

  const getCoordinates = (e: React.MouseEvent | React.TouchEvent | MouseEvent | TouchEvent) => {
    if (!canvasRef.current) return { x: 0, y: 0 };
    const rect = canvasRef.current.getBoundingClientRect();
    if ('touches' in e) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top
      };
    }
    return {
      x: (e as React.MouseEvent).clientX - rect.left,
      y: (e as React.MouseEvent).clientY - rect.top
    };
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    if (!ctx) return;
    const { x, y } = getCoordinates(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    if (!isDrawing || !ctx) return;
    const { x, y } = getCoordinates(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (ctx) ctx.closePath();
    setIsDrawing(false);
  };

  const clear = () => {
    if (!ctx || !canvasRef.current) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height);
  };

  const handleSave = () => {
    if (canvasRef.current) {
      onSave(canvasRef.current.toDataURL('image/png'));
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 z-[100] flex flex-col items-center justify-center p-4 touch-none">
      <div className="bg-slate-900 rounded-3xl w-full max-w-lg flex flex-col border border-slate-700 overflow-hidden shadow-2xl">
        <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-800/50">
          <h3 className="text-white font-bold">{title}</h3>
          <button onClick={onCancel} className="p-2 text-slate-400 hover:text-white rounded-full bg-slate-800 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="bg-slate-800 p-4">
          <p className="text-xs text-slate-400 text-center mb-2 uppercase tracking-wide">Firme dentro del recuadro blanco</p>
          <div className="w-full h-64 bg-white rounded-xl overflow-hidden shadow-inner border-2 border-slate-600">
            <canvas
              ref={canvasRef}
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseOut={stopDrawing}
              onTouchStart={startDrawing}
              onTouchMove={draw}
              onTouchEnd={stopDrawing}
              className="w-full h-full touch-none cursor-crosshair"
            />
          </div>
        </div>

        <div className="p-4 bg-slate-900 flex justify-between items-center">
          <button 
            onClick={clear}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors font-bold text-sm"
          >
            <Eraser className="w-4 h-4" /> LIMPIAR
          </button>
          
          <button 
            onClick={handleSave}
            className="flex items-center gap-2 px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors font-bold shadow-lg shadow-blue-500/20"
          >
            <Check className="w-4 h-4" /> ACEPTAR
          </button>
        </div>
      </div>
    </div>
  );
}
