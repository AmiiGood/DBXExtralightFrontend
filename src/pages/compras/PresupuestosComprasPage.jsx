import { useState, useEffect, Fragment } from "react";
import { PiggyBank, Loader2, Save, ChevronRight, ChevronDown, AlertTriangle, Copy, BarChart3, Pencil } from "lucide-react";
import { comprasService } from "../../services/compras.service";

/**
 * Presupuestos de Compras.
 *
 * Cada área de Compras tiene un monto por mes; el anual es la suma. Cuando
 * quien pidió elige una opción, se le descuenta a su área (sin IVA y en pesos)
 * en el mes en que eligió. Lo que no se gasta pasa al mes siguiente, así que
 * el disponible del mes es lo presupuestado hasta ese mes menos lo ejercido
 * hasta ese mes. Rebasar no bloquea: el disponible queda en negativo.
 *
 * Dos vistas: Seguimiento (para quien puede ver) y Capturar (para quien puede
 * editar el módulo).
 */

const MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
const MES_LARGO = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

const pesos = (n) =>
  n == null ? "—" : `${n < 0 ? "−" : ""}$${Math.abs(n).toLocaleString("es-MX", { maximumFractionDigits: 0 })}`;
const fecha = (s) => (s ? new Date(s).toLocaleDateString("es-MX", { day: "2-digit", month: "short" }) : "—");
const mensajeError = (e) => e.response?.data?.message || e.message;

/** Barra de cuánto se ha ejercido del anual. */
function Uso({ ejercido, presupuesto }) {
  if (!presupuesto) return <span className="text-xs text-gray-300">—</span>;
  const pct = (ejercido / presupuesto) * 100;
  const color = pct > 100 ? "bg-red-500" : pct > 85 ? "bg-amber-500" : "bg-[#236093]";
  return (
    <div className="flex items-center gap-2">
      <div className="w-24 h-2 rounded-full bg-gray-100 overflow-hidden">
        <div className={`h-full ${color}`} style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
      <span className={`text-xs ${pct > 100 ? "text-red-600 font-medium" : "text-gray-500"}`}>{pct.toFixed(0)}%</span>
    </div>
  );
}

function DetalleArea({ area, anio }) {
  const [elecciones, setElecciones] = useState(null);

  useEffect(() => {
    let vivo = true;
    comprasService
      .getEleccionesPresupuesto(area.id, anio)
      .then((r) => vivo && setElecciones(r))
      .catch(() => vivo && setElecciones([]));
    return () => {
      vivo = false;
    };
  }, [area.id, anio]);

  return (
    <div className="px-4 py-3 bg-gray-50/70 space-y-4">
      <div className="overflow-x-auto">
        <table className="text-xs">
          <thead>
            <tr className="text-gray-500">
              <th className="pr-3 py-1 text-left font-medium" />
              {MESES.map((m) => (
                <th key={m} className="px-2 py-1 text-right font-medium">
                  {m}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="pr-3 py-1 text-gray-500">Presupuesto</td>
              {area.meses.map((m) => (
                <td key={m.mes} className="px-2 py-1 text-right text-gray-700">
                  {m.presupuesto ? pesos(m.presupuesto) : "—"}
                </td>
              ))}
            </tr>
            <tr>
              <td className="pr-3 py-1 text-gray-500">Ejercido</td>
              {area.meses.map((m) => (
                <td key={m.mes} className="px-2 py-1 text-right text-gray-900 font-medium">
                  {m.ejercido ? pesos(m.ejercido) : "—"}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      {!elecciones ? (
        <Loader2 className="w-4 h-4 animate-spin text-gray-300" />
      ) : elecciones.length === 0 ? (
        <p className="text-xs text-gray-400">Todavía no se le ha descontado ninguna compra en {anio}.</p>
      ) : (
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-gray-500">
              <th className="py-1 pr-3 font-medium">Folio</th>
              <th className="py-1 pr-3 font-medium">Qué</th>
              <th className="py-1 pr-3 font-medium">Pidió</th>
              <th className="py-1 pr-3 font-medium">Proveedor</th>
              <th className="py-1 pr-3 font-medium text-right">Cotizado</th>
              <th className="py-1 pr-3 font-medium text-right">Descontado</th>
              <th className="py-1 font-medium">Eligió</th>
            </tr>
          </thead>
          <tbody>
            {elecciones.map((e) => (
              <tr key={e.id} className="border-t border-gray-100">
                <td className="py-1 pr-3 font-mono text-gray-500">
                  {e.folio}
                  {e.osticket_numero && <span className="block">{e.osticket_numero}</span>}
                </td>
                <td className="py-1 pr-3 text-gray-800">{e.asunto}</td>
                <td className="py-1 pr-3 text-gray-600">{e.solicitante_nombre}</td>
                <td className="py-1 pr-3 text-gray-600">{e.proveedor || "—"}</td>
                <td className="py-1 pr-3 text-right text-gray-600 whitespace-nowrap">
                  {pesos(e.monto_elegido)} {e.moneda_elegida === "USD" ? "USD" : ""}
                </td>
                <td className="py-1 pr-3 text-right font-medium whitespace-nowrap">
                  {e.monto_presupuesto == null ? (
                    <span className="text-amber-600" title="Se eligió en dólares sin tipo de cambio disponible">
                      Sin tipo de cambio
                    </span>
                  ) : (
                    pesos(e.monto_presupuesto)
                  )}
                  {e.tipo_cambio && <span className="block font-normal text-gray-400">TC {e.tipo_cambio}</span>}
                </td>
                <td className="py-1 text-gray-500 whitespace-nowrap">{fecha(e.elegido_en)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function Seguimiento({ datos }) {
  const [abierta, setAbierta] = useState(null);
  const { areas, mesCorte, anio } = datos;
  const total = (k) => areas.reduce((s, a) => s + (a[k] || 0), 0);
  const conPresupuesto = areas.filter((a) => a.presupuestoAnual > 0);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
      {conPresupuesto.length === 0 && (
        <p className="px-4 py-3 text-sm text-amber-800 bg-amber-50 border-b border-amber-100">
          Todavía no hay presupuesto capturado para {anio}. Mientras tanto se registra lo que gasta cada área, pero
          no hay contra qué compararlo.
        </p>
      )}
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-gray-500 border-b border-gray-100">
            <th className="px-4 py-2.5 font-medium">Área</th>
            <th className="px-4 py-2.5 font-medium text-right">Presupuesto {anio}</th>
            <th className="px-4 py-2.5 font-medium text-right">Ejercido</th>
            {mesCorte > 0 && (
              <th className="px-4 py-2.5 font-medium text-right" title="Lo presupuestado hasta este mes menos lo ejercido hasta este mes">
                Disponible a {MES_LARGO[mesCorte - 1]}
              </th>
            )}
            <th className="px-4 py-2.5 font-medium text-right">Disponible del año</th>
            <th className="px-4 py-2.5 font-medium">Uso</th>
          </tr>
        </thead>
        <tbody>
          {areas.map((a) => (
            <Fragment key={a.id}>
              <tr
                onClick={() => setAbierta(abierta === a.id ? null : a.id)}
                className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer"
              >
                <td className="px-4 py-2.5">
                  <span className="inline-flex items-center gap-1.5 text-gray-900">
                    {abierta === a.id ? (
                      <ChevronDown className="w-4 h-4 text-gray-400" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-gray-400" />
                    )}
                    {a.nombre}
                  </span>
                  <span className="block pl-6 text-xs text-gray-400">
                    {a.gerente_nombre ? `Gerente: ${a.gerente_nombre}` : "Sin gerente"}
                    {a.sinTipoCambio > 0 && <span className="text-amber-600"> · {a.sinTipoCambio} sin tipo de cambio</span>}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-right text-gray-700">{a.presupuestoAnual ? pesos(a.presupuestoAnual) : "—"}</td>
                <td className="px-4 py-2.5 text-right text-gray-900">{a.ejercidoAnual ? pesos(a.ejercidoAnual) : "—"}</td>
                {mesCorte > 0 && (
                  <td className={`px-4 py-2.5 text-right font-medium ${a.disponibleMes < 0 ? "text-red-600" : "text-gray-900"}`}>
                    {a.presupuestoAnual || a.ejercidoAnual ? pesos(a.disponibleMes) : "—"}
                  </td>
                )}
                <td className={`px-4 py-2.5 text-right ${a.disponibleAnual < 0 ? "text-red-600 font-medium" : "text-gray-700"}`}>
                  {a.presupuestoAnual || a.ejercidoAnual ? pesos(a.disponibleAnual) : "—"}
                </td>
                <td className="px-4 py-2.5">
                  <Uso ejercido={a.ejercidoAnual} presupuesto={a.presupuestoAnual} />
                </td>
              </tr>
              {abierta === a.id && (
                <tr>
                  <td colSpan={6} className="p-0 border-b border-gray-100">
                    <DetalleArea area={a} anio={anio} />
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t border-gray-200 font-semibold text-gray-800">
            <td className="px-4 py-2.5">Total</td>
            <td className="px-4 py-2.5 text-right">{pesos(total("presupuestoAnual"))}</td>
            <td className="px-4 py-2.5 text-right">{pesos(total("ejercidoAnual"))}</td>
            {mesCorte > 0 && <td className="px-4 py-2.5 text-right">{pesos(total("disponibleMes"))}</td>}
            <td className="px-4 py-2.5 text-right">{pesos(total("disponibleAnual"))}</td>
            <td className="px-4 py-2.5">
              <Uso ejercido={total("ejercidoAnual")} presupuesto={total("presupuestoAnual")} />
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function Captura({ datos, onGuardado }) {
  const [valores, setValores] = useState(() =>
    Object.fromEntries(datos.areas.map((a) => [a.id, a.meses.map((m) => (m.presupuesto ? String(m.presupuesto) : ""))])),
  );
  const [sucio, setSucio] = useState(new Set());
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState(null);

  const num = (v) => {
    const n = Number(String(v).replace(/[$,\s]/g, ""));
    return Number.isFinite(n) ? n : 0;
  };
  const poner = (areaId, i, v) => {
    setValores((x) => ({ ...x, [areaId]: x[areaId].map((m, k) => (k === i ? v : m)) }));
    setSucio((s) => new Set(s).add(areaId));
  };
  const igualTodo = (areaId) => {
    setValores((x) => ({ ...x, [areaId]: Array(12).fill(x[areaId][0]) }));
    setSucio((s) => new Set(s).add(areaId));
  };

  const guardar = async () => {
    setGuardando(true);
    setAviso(null);
    try {
      const filas = [...sucio].map((areaId) => ({ areaId, meses: valores[areaId].map((v) => (v === "" ? 0 : v)) }));
      const r = await comprasService.guardarPresupuestos(datos.anio, filas);
      setAviso({ ok: true, texto: r.message });
      setSucio(new Set());
      onGuardado();
    } catch (e) {
      setAviso({ ok: false, texto: mensajeError(e) });
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
        <table className="text-sm">
          <thead>
            <tr className="text-left text-gray-500 border-b border-gray-100">
              <th className="px-3 py-2.5 font-medium sticky left-0 bg-white">Área</th>
              {MESES.map((m) => (
                <th key={m} className="px-1 py-2.5 font-medium text-right">
                  {m}
                </th>
              ))}
              <th className="px-3 py-2.5 font-medium text-right">Anual</th>
            </tr>
          </thead>
          <tbody>
            {datos.areas.map((a) => (
              <tr key={a.id} className={`border-b border-gray-50 ${sucio.has(a.id) ? "bg-amber-50/40" : ""}`}>
                <td className="px-3 py-1.5 sticky left-0 bg-inherit">
                  <span className="flex items-center gap-1.5 whitespace-nowrap text-gray-800">
                    {a.nombre}
                    <button
                      onClick={() => igualTodo(a.id)}
                      title="Poner el monto de enero en todos los meses"
                      className="p-0.5 text-gray-300 hover:text-[#236093]"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </span>
                </td>
                {valores[a.id].map((v, i) => (
                  <td key={i} className="px-1 py-1.5">
                    <input
                      value={v}
                      onChange={(e) => poner(a.id, i, e.target.value)}
                      inputMode="decimal"
                      placeholder="0"
                      className="w-24 text-right text-sm border border-gray-200 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-[#236093]/30"
                    />
                  </td>
                ))}
                <td className="px-3 py-1.5 text-right font-medium text-gray-900 whitespace-nowrap">
                  {pesos(valores[a.id].reduce((s, x) => s + num(x), 0))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {aviso && (
        <div className={`text-sm rounded-lg px-3 py-2 ${aviso.ok ? "bg-green-50 text-green-800" : "bg-red-50 text-red-700"}`}>
          {aviso.texto}
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-gray-400">
          Montos en pesos y sin IVA, igual que lo que se descuenta al elegir. Lo que no se gasta en un mes pasa al
          siguiente.
        </p>
        <div className="flex items-center gap-3">
          {sucio.size > 0 && <span className="text-xs text-amber-600">{sucio.size} área(s) sin guardar</span>}
          <button
            onClick={guardar}
            disabled={guardando || sucio.size === 0}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-[#236093] text-white rounded-lg hover:bg-[#1c4d76] disabled:opacity-40"
          >
            {guardando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PresupuestosComprasPage() {
  const [anio, setAnio] = useState(new Date().getFullYear());
  const [vista, setVista] = useState("seguimiento");
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let vivo = true;
    comprasService
      .getPresupuestos(anio)
      .then((r) => {
        if (!vivo) return;
        setDatos(r);
        setError(null);
      })
      .catch((e) => vivo && setError(mensajeError(e)));
    return () => {
      vivo = false;
    };
  }, [anio, version]);

  const listos = datos?.anio === anio;
  const actual = new Date().getFullYear();

  return (
    <div className="p-6 space-y-5 max-w-7xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-[#236093]/10 rounded-lg">
            <PiggyBank className="w-6 h-6 text-[#236093]" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Presupuestos de Compras</h1>
            <p className="text-sm text-gray-500">
              Lo que tiene cada área, lo que ya se descontó por las compras elegidas y lo que le queda
            </p>
          </div>
        </div>
        <select
          value={anio}
          onChange={(e) => setAnio(Number(e.target.value))}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm"
        >
          {[actual - 1, actual, actual + 1].map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <div className="flex items-start gap-2 text-sm text-red-700 bg-red-50 rounded-xl px-4 py-3">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          {error}
        </div>
      )}

      {datos?.puedeEditar && (
        <div className="flex gap-1 border-b border-gray-200">
          {[
            { id: "seguimiento", texto: "Seguimiento", icono: BarChart3 },
            { id: "captura", texto: "Capturar", icono: Pencil },
          ].map((p) => {
            const Icono = p.icono;
            return (
              <button
                key={p.id}
                onClick={() => setVista(p.id)}
                className={`flex items-center gap-2 px-4 py-2 text-sm border-b-2 -mb-px ${
                  vista === p.id ? "border-[#236093] text-[#236093] font-medium" : "border-transparent text-gray-500 hover:text-gray-800"
                }`}
              >
                <Icono className="w-4 h-4" />
                {p.texto}
              </button>
            );
          })}
        </div>
      )}

      {!listos ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-7 h-7 animate-spin text-gray-300" />
        </div>
      ) : vista === "captura" && datos.puedeEditar ? (
        // La llave es solo el año: al guardar se recargan los datos sin rehacer la captura,
        // y así no se pierde el aviso de "guardado"
        <Captura key={anio} datos={datos} onGuardado={() => setVersion((v) => v + 1)} />
      ) : (
        <Seguimiento datos={datos} />
      )}
    </div>
  );
}
