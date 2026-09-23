import React, { useState } from 'react';
import { 
  CheckCircle2, X, Send, Mail, Phone, User, 
  Building2, MessageSquare, AlertCircle, Copy, 
  Check, ExternalLink, Calendar, Wrench, ShieldCheck
} from 'lucide-react';
import { AppData } from '../../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  ticketId: string;
  form: {
    CLIENTE: string;
    DIRECCION: string;
    CONTACTO: string;
    TELEFONO: string;
    PREFIJO: string;
    FHPROGRAMADA: string;
    PRIORIDAD: string;
    TIPO: string;
    TECNICO: string;
    'MODO DE ATENCION': string;
    'ACTIVIDAD DEL TICKET': string;
    PROBLEMA: string;
    OBSERVACIONES: string;
    'COMENTARIO DE FOTO': string;
  };
  data: AppData;
  fhIngreso?: string;
}

export default function TicketNotificacionesModal({
  isOpen,
  onClose,
  ticketId,
  form,
  data,
  fhIngreso
}: Props) {
  if (!isOpen) return null;

  const nowFormatted = fhIngreso || new Date().toLocaleString('es-PE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  // 1. Match Técnico
  const tecnicoObj = data.tecnicos.find(
    t => t.NOMBRE?.toLowerCase().trim() === form.TECNICO?.toLowerCase().trim()
  );

  // 2. Match Contacto
  const contactoObj = data.contactos.find(
    c => (
      (form.CONTACTO && c.NOMBRE?.toLowerCase().trim() === form.CONTACTO?.toLowerCase().trim()) ||
      (form.CLIENTE && c.EMPRESA?.toLowerCase().trim() === form.CLIENTE?.toLowerCase().trim())
    ) && Boolean(c.CORREO)
  );

  const [tecnicoPhone, setTecnicoPhone] = useState(tecnicoObj?.CELULAR || '');
  const [clientePhone, setClientePhone] = useState(form.TELEFONO || contactoObj?.CELULAR || '');
  const [clienteEmail, setClienteEmail] = useState(contactoObj?.CORREO || '');

  const [notifTecnicoSent, setNotifTecnicoSent] = useState(false);
  const [notifClienteWspSent, setNotifClienteWspSent] = useState(false);
  const [notifClienteMailSent, setNotifClienteMailSent] = useState(false);

  const [copiedMessage, setCopiedMessage] = useState<string | null>(null);

  const cleanPhoneNumber = (rawPhone: string) => {
    let clean = rawPhone.replace(/\D/g, '');
    if (clean.length === 9 && !clean.startsWith('51')) {
      clean = `51${clean}`;
    }
    return clean;
  };

  // 1. NOTIFICAR AL TÉCNICO POR WHATSAPP
  const handleNotificarTecnicoWsp = () => {
    const clean = cleanPhoneNumber(tecnicoPhone);
    if (!clean) {
      alert('Por favor ingrese o verifique el número de celular del técnico.');
      return;
    }

    const message = 
      `🛠️ *NUEVO TICKET ASIGNADO - SERVICIO TÉCNICO*\n` +
      `----------------------------------------\n` +
      `📌 *N° Ticket:* ${ticketId}\n` +
      `🏢 *Cliente:* ${form.CLIENTE || '-'}\n` +
      `📍 *Dirección:* ${form.DIRECCION || 'No especificada'}\n` +
      `👤 *Contacto:* ${form.CONTACTO || '-'}\n` +
      `📞 *Teléfono:* ${form.TELEFONO || '-'}\n` +
      `⚙️ *Modo de Atención:* ${form['MODO DE ATENCION'] || 'En Sitio'}\n` +
      `📋 *Tipo de Ticket:* ${form.TIPO || '-'}\n` +
      `⚡ *Prioridad:* ${form.PRIORIDAD || 'MEDIA'}\n` +
      `📅 *Fecha Programada:* ${form.FHPROGRAMADA || nowFormatted}\n` +
      `👨‍🔧 *Técnico Responsable:* ${form.TECNICO || '-'}\n\n` +
      `📝 *Problema / Falla Reportada:*\n${form.PROBLEMA || 'Sin descripción detallada'}\n\n` +
      (form['ACTIVIDAD DEL TICKET'] ? `🎯 *Actividad Solicitada:*\n${form['ACTIVIDAD DEL TICKET']}\n\n` : '') +
      (form.OBSERVACIONES ? `💬 *Observaciones:*\n${form.OBSERVACIONES}\n\n` : '') +
      (form['COMENTARIO DE FOTO'] ? `📷 *Nota de Fotos:*\n${form['COMENTARIO DE FOTO']}\n\n` : '') +
      `----------------------------------------\n` +
      `🔔 _Por favor confirmar recepción y coordinar la atención._`;

    const waUrl = `https://api.whatsapp.com/send?phone=${clean}&text=${encodeURIComponent(message)}`;
    window.open(waUrl, '_blank', 'noopener,noreferrer');
    setNotifTecnicoSent(true);
  };

  // 2. NOTIFICAR AL CLIENTE POR WHATSAPP
  const handleNotificarClienteWsp = () => {
    const clean = cleanPhoneNumber(clientePhone);
    if (!clean) {
      alert('Por favor ingrese o verifique el número de teléfono del cliente/contacto.');
      return;
    }

    const message = 
      `📋 *CONFIRMACIÓN DE REGISTRO DE TICKET*\n` +
      `----------------------------------------\n` +
      `Estimado(a) *${form.CONTACTO || form.CLIENTE}*,\n\n` +
      `Su solicitud de servicio técnico ha sido registrada con éxito en nuestro sistema:\n\n` +
      `🎫 *Ticket N°:* ${ticketId}\n` +
      `🏢 *Empresa / Cliente:* ${form.CLIENTE}\n` +
      `📍 *Dirección:* ${form.DIRECCION || 'Sede Principal'}\n` +
      `📅 *Fecha Programada:* ${form.FHPROGRAMADA || nowFormatted}\n` +
      `⚙️ *Modo de Atención:* ${form['MODO DE ATENCION'] || 'En Sitio'}\n` +
      `📋 *Tipo de Servicio:* ${form.TIPO}\n` +
      `⚡ *Prioridad:* ${form.PRIORIDAD}\n` +
      `👨‍🔧 *Técnico Asignado:* ${form.TECNICO || 'Área de Soporte Técnico'}\n\n` +
      `📝 *Detalle / Problema Reportado:*\n${form.PROBLEMA || 'Servicio técnico registrado'}\n\n` +
      `----------------------------------------\n` +
      `✅ _Nuestro equipo técnico se encuentra gestionando su atención. Muchas gracias por su confianza._`;

    const waUrl = `https://api.whatsapp.com/send?phone=${clean}&text=${encodeURIComponent(message)}`;
    window.open(waUrl, '_blank', 'noopener,noreferrer');
    setNotifClienteWspSent(true);
  };

  // 3. ENVIAR CORREO AL CLIENTE
  const handleEnviarCorreoCliente = () => {
    if (!clienteEmail) {
      alert('Por favor ingrese o verifique el correo del contacto.');
      return;
    }

    const subject = `Confirmación de Registro de Ticket ${ticketId} - ${form.CLIENTE}`;
    const body = 
      `Estimado(a) ${form.CONTACTO || form.CLIENTE},\n\n` +
      `Le confirmamos que se ha registrado exitosamente su ticket de atención técnica en nuestro sistema:\n\n` +
      `========================================\n` +
      `DETALLES DEL TICKET\n` +
      `========================================\n` +
      `• N° de Ticket: ${ticketId}\n` +
      `• Empresa / Cliente: ${form.CLIENTE}\n` +
      `• Contacto: ${form.CONTACTO}\n` +
      `• Teléfono: ${form.TELEFONO || '-'}\n` +
      `• Dirección: ${form.DIRECCION || 'Sede Principal'}\n` +
      `• Tipo de Servicio: ${form.TIPO}\n` +
      `• Modo de Atención: ${form['MODO DE ATENCION'] || 'En Sitio'}\n` +
      `• Prioridad: ${form.PRIORIDAD}\n` +
      `• Fecha Programada: ${form.FHPROGRAMADA || nowFormatted}\n` +
      `• Técnico Asignado: ${form.TECNICO || 'Área Técnica'}\n\n` +
      `========================================\n` +
      `DETALLE DEL PROBLEMA / ACTIVIDAD REPORTADA\n` +
      `========================================\n` +
      `${form.PROBLEMA || 'Servicio técnico programado'}\n\n` +
      (form['ACTIVIDAD DEL TICKET'] ? `Actividad Solicitada:\n${form['ACTIVIDAD DEL TICKET']}\n\n` : '') +
      (form.OBSERVACIONES ? `Observaciones:\n${form.OBSERVACIONES}\n\n` : '') +
      `Nuestro personal técnico atenderá su requerimiento según la coordinación establecida.\n\n` +
      `Atentamente,\n` +
      `Servicio de Soporte y Soluciones Tecnológicas`;

    const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(clienteEmail)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(gmailUrl, '_blank', 'noopener,noreferrer');
    setNotifClienteMailSent(true);
  };

  const copyToClipboard = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    setCopiedMessage(type);
    setTimeout(() => setCopiedMessage(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 md:p-6 overflow-y-auto">
      <div className="w-full max-w-2xl bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl overflow-hidden flex flex-col my-auto animate-in fade-in zoom-in-95 duration-200">
        
        {/* HEADER */}
        <div className="p-6 bg-gradient-to-r from-slate-900 via-slate-900 to-indigo-950/40 border-b border-slate-800 flex items-start justify-between">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0 shadow-lg shadow-emerald-500/10">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase tracking-wider text-emerald-400 px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20">
                  ¡TICKET GUARDADO!
                </span>
                <span className="font-mono text-xs font-black text-blue-400 px-2 py-0.5 rounded bg-blue-500/10 border border-blue-500/20">
                  {ticketId}
                </span>
              </div>
              <h2 className="text-xl font-bold text-white mt-1">
                Notificar Creación del Ticket
              </h2>
              <p className="text-xs text-slate-400">
                Seleccione los canales para notificar al técnico asignado y al cliente
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-700 rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* RESUMEN DEL TICKET */}
        <div className="p-5 bg-slate-950/50 border-b border-slate-800/80">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="p-2.5 bg-slate-900 rounded-xl border border-slate-800">
              <span className="text-[10px] font-bold text-slate-400 uppercase block">Cliente</span>
              <span className="font-bold text-white truncate block mt-0.5" title={form.CLIENTE}>
                {form.CLIENTE || '-'}
              </span>
            </div>
            <div className="p-2.5 bg-slate-900 rounded-xl border border-slate-800">
              <span className="text-[10px] font-bold text-slate-400 uppercase block">Contacto</span>
              <span className="font-semibold text-slate-200 truncate block mt-0.5" title={form.CONTACTO}>
                {form.CONTACTO || '-'}
              </span>
            </div>
            <div className="p-2.5 bg-slate-900 rounded-xl border border-slate-800">
              <span className="text-[10px] font-bold text-slate-400 uppercase block">Técnico</span>
              <span className="font-bold text-indigo-300 truncate block mt-0.5" title={form.TECNICO}>
                {form.TECNICO || 'No asignado'}
              </span>
            </div>
            <div className="p-2.5 bg-slate-900 rounded-xl border border-slate-800">
              <span className="text-[10px] font-bold text-slate-400 uppercase block">Modo / Tipo</span>
              <span className="font-semibold text-emerald-300 truncate block mt-0.5">
                {form['MODO DE ATENCION'] || 'SITIO'} • {form.TIPO}
              </span>
            </div>
          </div>
        </div>

        {/* BOTONES DE NOTIFICACIÓN */}
        <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto custom-scrollbar">

          {/* 1. NOTIFICAR AL TÉCNICO WSP */}
          <div className="p-4 bg-slate-800/40 rounded-2xl border border-slate-700/60 hover:border-emerald-500/40 transition-all">
            <div className="flex items-center justify-between gap-3 mb-2.5 flex-wrap">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
                  <Wrench className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    Técnico Asignado: <span className="text-emerald-400">{form.TECNICO || 'No seleccionado'}</span>
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    Envía el ticket completo con problema, actividad y observaciones vía WhatsApp
                  </p>
                </div>
              </div>

              {notifTecnicoSent && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                  <Check className="w-3 h-3" /> Enviado
                </span>
              )}
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 mt-3">
              <div className="flex-1 relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs font-mono">
                  📞 CELULAR:
                </span>
                <input
                  type="text"
                  value={tecnicoPhone}
                  onChange={(e) => setTecnicoPhone(e.target.value)}
                  placeholder="Número de celular del técnico"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-24 pr-3 py-2 text-xs text-white font-mono focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <button
                type="button"
                onClick={handleNotificarTecnicoWsp}
                disabled={!form.TECNICO}
                className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2 shrink-0 cursor-pointer"
              >
                <MessageSquare className="w-4 h-4" />
                NOTIFICAR AL TECNICO WSP
              </button>
            </div>
          </div>

          {/* 2. NOTIFICAR AL CLIENTE WSP */}
          <div className="p-4 bg-slate-800/40 rounded-2xl border border-slate-700/60 hover:border-emerald-500/40 transition-all">
            <div className="flex items-center justify-between gap-3 mb-2.5 flex-wrap">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-teal-500/20 text-teal-400 flex items-center justify-center font-bold">
                  <User className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    Contacto Cliente: <span className="text-teal-400">{form.CONTACTO || form.CLIENTE}</span>
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    Notifica al cliente el registro de su ticket con los datos de atención
                  </p>
                </div>
              </div>

              {notifClienteWspSent && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                  <Check className="w-3 h-3" /> Enviado
                </span>
              )}
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 mt-3">
              <div className="flex-1 relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs font-mono">
                  📞 TELÉFONO:
                </span>
                <input
                  type="text"
                  value={clientePhone}
                  onChange={(e) => setClientePhone(e.target.value)}
                  placeholder="Número de teléfono del contacto"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-24 pr-3 py-2 text-xs text-white font-mono focus:border-teal-500 focus:outline-none"
                />
              </div>

              <button
                type="button"
                onClick={handleNotificarClienteWsp}
                className="px-4 py-2.5 bg-teal-600 hover:bg-teal-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-teal-600/20 flex items-center justify-center gap-2 shrink-0 cursor-pointer"
              >
                <MessageSquare className="w-4 h-4" />
                NOTIFICAR AL CLIENTE WSP
              </button>
            </div>
          </div>

          {/* 3. ENVIAR CORREO AL CLIENTE */}
          <div className="p-4 bg-slate-800/40 rounded-2xl border border-slate-700/60 hover:border-indigo-500/40 transition-all">
            <div className="flex items-center justify-between gap-3 mb-2.5 flex-wrap">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold">
                  <Mail className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    Correo al Cliente: <span className="text-indigo-400">{form.CLIENTE}</span>
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    Abre la ventana de correo con la plantilla formal del ticket redactada
                  </p>
                </div>
              </div>

              {notifClienteMailSent && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                  <Check className="w-3 h-3" /> Redactado
                </span>
              )}
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 mt-3">
              <div className="flex-1 relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs font-mono">
                  ✉️ CORREO:
                </span>
                <input
                  type="email"
                  value={clienteEmail}
                  onChange={(e) => setClienteEmail(e.target.value)}
                  placeholder="Correo electrónico del contacto"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-22 pr-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <button
                type="button"
                onClick={handleEnviarCorreoCliente}
                className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-2 shrink-0 cursor-pointer"
              >
                <Mail className="w-4 h-4" />
                ENVIAR CORREO AL CLIENTE
              </button>
            </div>
          </div>

        </div>

        {/* FOOTER */}
        <div className="p-4 bg-slate-950/70 border-t border-slate-800 flex items-center justify-between gap-3">
          <p className="text-[11px] text-slate-500 hidden sm:block">
            Puede enviar múltiples notificaciones o finalizar el proceso.
          </p>

          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-colors border border-slate-700 ml-auto flex items-center justify-center gap-2"
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            FINALIZAR / CONTINUAR
          </button>
        </div>

      </div>
    </div>
  );
}
