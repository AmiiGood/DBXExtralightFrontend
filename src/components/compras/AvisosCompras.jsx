import { useState, useEffect, useCallback } from "react";
import { Mail, Loader2, Save, Plus, X, Send, BellRing, AlertTriangle, CheckCircle2 } from "lucide-react";
import { comprasService } from "../../services/compras.service";

/**
 * Avisos por correo de Solicitudes de Compra.
 *
 * La propuesta pide recordatorios L–V a las 9:00 y 16:00 "y las horas se
 * pueden ajustar": por eso se editan aquí y no en el código. Al guardar, el
 * servidor reprograma los recordatorios sin reiniciar.
 *
 * "Mandar recordatorio ahora" le llega a los gerentes de verdad; el correo de
 * prueba solo al usuario que lo pide.
 */

const DIAS = [
  { n: 1, corto: "L" },
  { n: 2, corto: "M" },
  { n: 3, corto: "M" },
  { n: 4, corto: "J" },
  { n: 5, corto: "V" },
  { n: 6, corto: "S" },
  { n: 0, corto: "D" },
];

const TIPOS = {
  NUEVA: "Por aprobar",
  RECORDATORIO: "Recordatorio",
  RECHAZADA: "Rechazada",
  APROBADA: "Aprobada",
  EN_COMPRAS: "En Compras",
  PRUEBA: "Prueba",
};

const mensajeError = (e) => e.response?.data?.message || e.message;

const fecha = (s) =>
  new Date(s).toLocaleString("es-MX", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

/** localhost / 127.0.0.1: Mailpit o similar, no llega a buzones de verdad. */
const esLocal = (servidor) => /^(localhost|127\.)/.test(servidor || "");

export default function AvisosCompras() {
  const [datos, setDatos] = useState(null);
  const [form, setForm] = useState(null);
  const [nuevaHora, setNuevaHora] = useState("12:00");
  const [trabajando, setTrabajando] = useState(null);
  const [aviso, setAviso] = useState(null);

  const cargar = useCallback(async () => {
    try {
      const d = await comprasService.getAvisos();
      setDatos(d);
      setForm({
        avisosActivos: d.config.avisos_activos,
        avisoInmediato: d.config.aviso_inmediato,
        recordatorioHoras: d.config.recordatorio_horas,
        recordatorioDias: d.config.recordatorio_dias,
      });
    } catch (e) {
      setAviso({ ok: false, texto: mensajeError(e) });
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const accion = async (clave, fn) => {
    setTrabajando(clave);
    setAviso(null);
    try {
      const r = await fn();
      setAviso({ ok: true, texto: r.message });
      await cargar();
    } catch (e) {
      setAviso({ ok: false, texto: mensajeError(e) });
    } finally {
      setTrabajando(null);
    }
  };

  if (!datos || !form) {
    return aviso ? <div className="bg-red-50 text-red-700 p-4 rounded-xl text-sm">{aviso.texto}</div> : null;
  }

  const c = datos.config;
  const cambiado =
    form.avisosActivos !== c.avisos_activos ||
    form.avisoInmediato !== c.aviso_inmediato ||
    form.recordatorioHoras.join() !== c.recordatorio_horas.join() ||
    [...form.recordatorioDias].sort().join() !== [...c.recordatorio_dias].sort().join();

  const alternarDia = (n) =>
    setForm((f) => ({
      ...f,
      recordatorioDias: f.recordatorioDias.includes(n)
        ? f.recordatorioDias.filter((d) => d !== n)
        : [...f.recordatorioDias, n],
    }));

  const agregarHora = () => {
    if (!nuevaHora || form.recordatorioHoras.includes(nuevaHora)) return;
    setForm((f) => ({ ...f, recordatorioHoras: [...f.recordatorioHoras, nuevaHora].sort() }));
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold text-gray-900 flex items-center gap-2">
            <Mail className="w-4 h-4 text-[#236093]" />
            Avisos por correo
          </h2>
          <p className="text-xs text-gray-400 mt-0.5">
            Ahora: {c.avisos_activos ? `recordatorios ${datos.horario}` : "apagados"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => accion("prueba", comprasService.probarAviso)}
            disabled={trabajando !== null}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40"
          >
            {trabajando === "prueba" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            Mandarme una prueba
          </button>
          <button
            onClick={() => {
              if (window.confirm("Se manda ya el recordatorio a todos los gerentes y suplentes con pendientes. ¿Seguir?")) {
                accion("recordatorio", comprasService.mandarRecordatorios);
              }
            }}
            disabled={trabajando !== null}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40"
          >
            {trabajando === "recordatorio" ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <BellRing className="w-3.5 h-3.5" />
            )}
            Mandar recordatorio ahora
          </button>
        </div>
      </div>

      {!datos.servidor ? (
        <p className="text-sm text-amber-800 bg-amber-50 rounded-lg px-3 py-2 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          No hay SMTP_HOST en el servidor: los correos van a una cuenta de prueba (Ethereal) y no llegan a nadie.
        </p>
      ) : esLocal(datos.servidor) ? (
        <p className="text-sm text-amber-800 bg-amber-50 rounded-lg px-3 py-2 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          El correo sale por {datos.servidor} (Mailpit u otro servidor local): no llega a buzones reales.
        </p>
      ) : null}

      {aviso && (
        <div className={`text-sm rounded-lg px-3 py-2 ${aviso.ok ? "bg-green-50 text-green-800" : "bg-red-50 text-red-700"}`}>
          {aviso.texto}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="space-y-3">
          <label className="flex items-start gap-2 text-sm text-gray-700 cursor-pointer">
            <input
              type="checkbox"
              checked={form.avisosActivos}
              onChange={(e) => setForm((f) => ({ ...f, avisosActivos: e.target.checked }))}
              className="rounded border-gray-300 mt-0.5"
            />
            <span>
              Mandar avisos
              <span className="block text-xs text-gray-400">
                Apagado no sale ningún correo del módulo. Las solicitudes siguen funcionando.
              </span>
            </span>
          </label>
          <label className="flex items-start gap-2 text-sm text-gray-700 cursor-pointer">
            <input
              type="checkbox"
              checked={form.avisoInmediato}
              disabled={!form.avisosActivos}
              onChange={(e) => setForm((f) => ({ ...f, avisoInmediato: e.target.checked }))}
              className="rounded border-gray-300 mt-0.5"
            />
            <span>
              Avisar al gerente en cuanto llega cada solicitud
              <span className="block text-xs text-gray-400">
                Si se apaga, el gerente solo recibe el recordatorio resumen.
              </span>
            </span>
          </label>
          <p className="text-xs text-gray-400">
            A quien pidió siempre se le avisa si se rechaza (con el motivo) y cuando llega a Compras
            (con el número de ticket).
          </p>
        </div>

        <div className={`space-y-3 ${form.avisosActivos ? "" : "opacity-40 pointer-events-none"}`}>
          <div>
            <p className="text-sm font-medium text-gray-700">Recordatorio a quien tiene pendientes</p>
            <p className="text-xs text-gray-400">Un solo correo por persona con todo lo que le espera. Sin pendientes no se manda.</p>
          </div>
          <div className="flex gap-1">
            {DIAS.map((d) => (
              <button
                key={d.n}
                type="button"
                onClick={() => alternarDia(d.n)}
                className={`w-8 h-8 text-xs rounded-full border ${
                  form.recordatorioDias.includes(d.n)
                    ? "bg-[#236093] border-[#236093] text-white"
                    : "border-gray-200 text-gray-500 hover:bg-gray-50"
                }`}
              >
                {d.corto}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {form.recordatorioHoras.map((h) => (
              <span key={h} className="inline-flex items-center gap-1 text-sm bg-gray-100 rounded-full pl-3 pr-1 py-0.5">
                {h}
                <button
                  type="button"
                  onClick={() =>
                    setForm((f) => ({ ...f, recordatorioHoras: f.recordatorioHoras.filter((x) => x !== h) }))
                  }
                  className="p-0.5 text-gray-400 hover:text-red-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </span>
            ))}
            <input
              type="time"
              value={nuevaHora}
              onChange={(e) => setNuevaHora(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-2 py-1"
            />
            <button
              type="button"
              onClick={agregarHora}
              className="inline-flex items-center gap-1 px-2 py-1 text-xs text-[#236093] hover:bg-[#236093]/5 rounded-lg"
            >
              <Plus className="w-3.5 h-3.5" />
              Agregar
            </button>
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={() => accion("guardar", () => comprasService.guardarAvisos(form))}
          disabled={!cambiado || trabajando !== null}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-[#236093] text-white rounded-lg hover:bg-[#1c4d76] disabled:opacity-40"
        >
          {trabajando === "guardar" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Guardar avisos
        </button>
      </div>

      {/* --- Bitácora --- */}
      <div>
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Últimos correos</h3>
        {datos.correos.length === 0 ? (
          <p className="text-sm text-gray-400">Todavía no se ha mandado ninguno.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <tbody>
                {datos.correos.map((m) => (
                  <tr key={m.id} className="border-b border-gray-50 last:border-0">
                    <td className="py-1.5 pr-3 text-gray-400 whitespace-nowrap">{fecha(m.enviado_en)}</td>
                    <td className="py-1.5 pr-3 whitespace-nowrap">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{TIPOS[m.tipo] || m.tipo}</span>
                    </td>
                    <td className="py-1.5 pr-3 text-gray-700">{m.para}</td>
                    <td className="py-1.5 pr-3 text-gray-500">{m.folio || ""}</td>
                    <td className="py-1.5 text-right">
                      {m.ok ? (
                        <CheckCircle2 className="w-4 h-4 text-green-600 inline" />
                      ) : (
                        <span className="text-xs text-red-600">{m.error}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
