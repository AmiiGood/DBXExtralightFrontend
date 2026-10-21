import { useState, useEffect, useCallback } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
} from "recharts";
import {
  ShieldCheck,
  Loader2,
  RefreshCw,
  AlertTriangle,
  FolderCog,
  Info,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { aimsService } from "../../services/aims.service";
import { useAuthStore } from "../../stores/auth.store";

/**
 * Reporte de AIMS: los doce indicadores, cada uno contra su meta.
 *
 * Arriba, una tarjeta por indicador con su último mes cerrado y el acumulado
 * del año, en verde si cumple y en rojo si no. Al elegir una se ve su ficha,
 * los doce meses y lo que explica cada número.
 *
 * ---------------------------------------------------------------------------
 * LO QUE NO SE VE Y SÍ IMPORTA
 * ---------------------------------------------------------------------------
 * Cumplir no siempre es estar arriba: en MTTR e indisponibilidad cumplir es
 * estar ABAJO de la meta. Lo dice `sentido`, y la tarjeta lo escribe (≥ / ≤).
 *
 * Los meses que el área no ha cerrado no aparecen, y los cerrados sin dato
 * (legales de julio a septiembre) se ven como "sin dato", no como cero: en el
 * libro, los meses vacíos salen en 100% o en 0% según la hoja.
 */

const VERDE = "#49a090";
const ROJO = "#b0413e";
const GRIS = "#cbd5e1";
const AZUL = "#236093";

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const MESES_LARGO = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

/** El valor en su unidad: 82.4% o 25 min. */
function formato(v, unidad, decimales = 1) {
  if (v == null) return "—";
  if (unidad === "min") {
    return `${Number(v).toLocaleString("es-MX", { maximumFractionDigits: 0 })} min`;
  }
  return `${(v * 100).toLocaleString("es-MX", { maximumFractionDigits: decimales })}%`;
}

const metaTexto = (k) =>
  k.meta == null ? "Sin meta" : `${k.sentido === "MENOR" ? "≤" : "≥"} ${formato(k.meta, k.unidad, 0)}`;

const colorDe = (cumple) => (cumple == null ? "#64748b" : cumple ? VERDE : ROJO);

function Seccion({ titulo, nota, children }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
      <h2 className="font-semibold text-gray-900">{titulo}</h2>
      {nota && <p className="text-xs text-gray-400 mt-0.5 max-w-3xl">{nota}</p>}
      <div className="mt-4">{children}</div>
    </div>
  );
}

/** De qué libro y de cuándo es el dato. En rojo si falló la lectura. */
function EstadoArchivo({ archivo, onSincronizar, sincronizando, puedeSincronizar }) {
  if (!archivo) return null;
  const sinConfigurar = !archivo.carpeta;
  return (
    <div
      className={`rounded-xl border p-4 ${
        archivo.error
          ? "bg-red-50 border-red-200"
          : sinConfigurar
            ? "bg-amber-50 border-amber-200"
            : "bg-gray-50 border-gray-200"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="text-sm flex items-start gap-2">
          {archivo.error || sinConfigurar ? (
            <AlertTriangle
              className={`w-4 h-4 mt-0.5 shrink-0 ${archivo.error ? "text-red-500" : "text-amber-500"}`}
            />
          ) : (
            <FolderCog className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
          )}
          <div>
            {sinConfigurar ? (
              <span className="text-amber-800">
                Todavía no se configura la carpeta del libro; el reporte enseña la última
                carga.
              </span>
            ) : (
              <span className="font-medium text-gray-700">
                {archivo.archivo || "Todavía no se ha leído el libro"}
              </span>
            )}
            {archivo.error ? (
              <span className="text-red-700"> — {archivo.error}</span>
            ) : (
              archivo.leido && (
                <span className="text-gray-500"> — leído el {archivo.leido}</span>
              )
            )}
          </div>
        </div>
        {puedeSincronizar && !sinConfigurar && (
          <button
            onClick={onSincronizar}
            disabled={sincronizando}
            className="flex items-center gap-2 px-3 py-1.5 text-sm bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            {sincronizando ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            Revisar ahora
          </button>
        )}
      </div>
    </div>
  );
}

/** Tarjeta de un indicador: último mes y acumulado, contra la meta. */
function TarjetaKpi({ kpi, activa, onClick }) {
  const u = kpi.ultimo;
  return (
    <button
      onClick={onClick}
      className={`text-left bg-white rounded-xl shadow-sm border p-4 transition-all hover:shadow-md ${
        activa ? "border-[#236093] ring-2 ring-[#236093]/20" : "border-gray-100"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-mono text-gray-400">{kpi.codigo}</p>
        {u?.cumple == null ? null : u.cumple ? (
          <CheckCircle2 className="w-4 h-4 shrink-0" style={{ color: VERDE }} />
        ) : (
          <XCircle className="w-4 h-4 shrink-0" style={{ color: ROJO }} />
        )}
      </div>
      <p className="text-sm font-medium text-gray-800 mt-1 leading-snug min-h-[2.5rem]">
        {kpi.nombre}
      </p>
      <p className="text-2xl font-bold mt-2" style={{ color: colorDe(u?.cumple) }}>
        {formato(u?.valor, kpi.unidad)}
      </p>
      <p className="text-xs text-gray-400">
        {u ? MESES_LARGO[u.mes - 1] : "sin datos"} · meta {metaTexto(kpi)}
      </p>
      <p className="text-xs text-gray-500 mt-1">
        En el año:{" "}
        <span className="font-medium" style={{ color: colorDe(kpi.acumulado.cumple) }}>
          {formato(kpi.acumulado.valor, kpi.unidad)}
        </span>
      </p>
    </button>
  );
}

const EXPLICA_AGREGADO = {
  PROMEDIO: "promedio de los meses",
  RAZON: "suma del año (cumplido entre planeado de todos los meses)",
  PONDERADO: "promedio pesado por número de OT",
  ULTIMO: "el último mes, porque el indicador ya es acumulado",
};

function TooltipMes({ active, payload, kpi }) {
  if (!active || !payload?.length) return null;
  const m = payload[0].payload;
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-md p-3 text-xs max-w-xs">
      <p className="font-semibold text-gray-900 capitalize">{MESES_LARGO[m.mes - 1]}</p>
      <p style={{ color: colorDe(m.cumple) }} className="font-medium">
        {m.sinDato ? "Sin dato" : formato(m.valor, kpi.unidad)}
      </p>
      {m.detalle?.nota && <p className="text-gray-500 mt-1">{m.detalle.nota}</p>}
    </div>
  );
}

/** El detalle de un indicador: ficha, los doce meses y la tabla. */
function DetalleKpi({ kpi, anio }) {
  // Los doce meses en el eje aunque falten: así se ve qué no ha cerrado
  const porMes = new Map(kpi.meses.map((m) => [m.mes, m]));
  const datos = MESES.map((nombre, i) => {
    const m = porMes.get(i + 1);
    return {
      mes: i + 1,
      nombre,
      valor: m?.valor ?? null,
      cumple: m?.cumple ?? null,
      sinDato: Boolean(m) && m.valor == null,
      detalle: m?.detalle,
    };
  });
  const maximo = Math.max(kpi.meta || 0, ...kpi.meses.map((m) => m.valor || 0));
  const cursos = kpi.extra?.cursos;

  return (
    <Seccion
      titulo={`${kpi.codigo} · ${kpi.nombre}`}
      nota={`${anio}. En el año: ${formato(kpi.acumulado.valor, kpi.unidad)} (${
        EXPLICA_AGREGADO[kpi.agregado] || "promedio"
      }).`}
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={datos} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="nombre" fontSize={12} />
              <YAxis
                fontSize={12}
                width={60}
                domain={[0, kpi.unidad === "%" ? Math.max(1, maximo) : "auto"]}
                tickFormatter={(v) => formato(v, kpi.unidad, 0)}
              />
              <Tooltip content={<TooltipMes kpi={kpi} />} cursor={{ fill: "#f1f5f9" }} />
              {kpi.meta != null && (
                <ReferenceLine
                  y={kpi.meta}
                  stroke={AZUL}
                  strokeDasharray="6 4"
                  label={{
                    value: `Meta ${metaTexto(kpi)}`,
                    position: "insideTopRight",
                    fontSize: 11,
                    fill: AZUL,
                  }}
                />
              )}
              <Bar dataKey="valor" radius={[4, 4, 0, 0]}>
                {datos.map((d) => (
                  <Cell key={d.mes} fill={d.cumple == null ? GRIS : d.cumple ? VERDE : ROJO} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="text-sm space-y-3">
          {[
            ["Definición", kpi.definicion],
            ["Cálculo", kpi.calculo],
            ["Meta", metaTexto(kpi)],
            ["Fuente", kpi.fuente],
          ].map(([t, v]) =>
            v ? (
              <div key={t}>
                <p className="text-xs text-gray-400">{t}</p>
                <p className="text-gray-700">{v}</p>
              </div>
            ) : null,
          )}
        </div>
      </div>

      <div className="overflow-x-auto mt-5">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 border-b border-gray-100">
              <th className="py-2 pr-3 font-medium">Mes</th>
              <th className="py-2 pr-3 font-medium text-right">Valor</th>
              <th className="py-2 pr-3 font-medium">Cumple</th>
              <th className="py-2 font-medium">Detalle</th>
            </tr>
          </thead>
          <tbody>
            {kpi.meses.map((m) => (
              <tr key={m.mes} className="border-b border-gray-50 last:border-0 align-top">
                <td className="py-2 pr-3 text-gray-700 capitalize">{MESES_LARGO[m.mes - 1]}</td>
                <td
                  className="py-2 pr-3 text-right font-medium whitespace-nowrap"
                  style={{ color: colorDe(m.cumple) }}
                >
                  {m.valor == null ? "Sin dato" : formato(m.valor, kpi.unidad)}
                </td>
                <td className="py-2 pr-3">
                  {m.cumple == null ? "—" : m.cumple ? "Sí" : "No"}
                </td>
                <td className="py-2 text-gray-500 text-xs">
                  {m.detalle?.nota}
                  {m.detalle?.faltantes?.length > 0 && (
                    <p className="text-gray-400">Faltaron: {m.detalle.faltantes.join(", ")}</p>
                  )}
                  {m.detalle?.sinPlan?.length > 0 && (
                    <p className="text-gray-400">
                      Hechas sin estar en el plan (no cuentan): {m.detalle.sinPlan.join(", ")}
                    </p>
                  )}
                  {m.detalle?.bus && (
                    <p className="text-gray-400">
                      {Object.entries(m.detalle.bus)
                        .map(([bu, v]) => `${bu} ${formato(v, "%", 0)}`)
                        .join(" · ")}
                    </p>
                  )}
                </td>
              </tr>
            ))}
            {kpi.meses.length === 0 && (
              <tr>
                <td colSpan={4} className="py-6 text-center text-gray-400">
                  Este indicador no tiene meses cerrados en {anio}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {cursos?.length > 0 && (
        <div className="mt-6">
          <h3 className="text-sm font-semibold text-gray-800">Cursos impartidos</h3>
          <div className="overflow-x-auto mt-2">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b border-gray-100">
                  <th className="py-2 pr-3 font-medium">Mes</th>
                  <th className="py-2 pr-3 font-medium">Curso</th>
                  <th className="py-2 pr-3 font-medium text-right">Participantes</th>
                  <th className="py-2 font-medium text-right">Horas</th>
                </tr>
              </thead>
              <tbody>
                {cursos.map((c, i) => (
                  <tr key={i} className="border-b border-gray-50 last:border-0">
                    <td className="py-2 pr-3 text-gray-600 whitespace-nowrap">{c.mes || "—"}</td>
                    <td className="py-2 pr-3 text-gray-800">{c.curso}</td>
                    <td className="py-2 pr-3 text-right text-gray-600">{c.participantes ?? "—"}</td>
                    <td className="py-2 text-right text-gray-600">{c.horas ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Seccion>
  );
}

export default function ReportesAimsPage() {
  const [datos, setDatos] = useState(null);
  const [anio, setAnio] = useState(null);
  const [error, setError] = useState(null);
  const [sincronizando, setSincronizando] = useState(false);
  const [elegido, setElegido] = useState(null);
  const usuario = useAuthStore((s) => s.user);
  const esAdmin = Boolean(usuario?.rol?.esAdmin);

  const cargar = useCallback(async (a) => {
    try {
      const d = await aimsService.getReporte(a);
      setDatos(d);
      setError(null);
    } catch (e) {
      setError(e.response?.data?.message || e.message);
    }
  }, []);

  useEffect(() => {
    cargar(anio);
  }, [cargar, anio]);

  const sincronizar = async () => {
    setSincronizando(true);
    try {
      await aimsService.sincronizar();
      await cargar(anio);
    } catch (e) {
      setError(e.response?.data?.message || e.message);
    } finally {
      setSincronizando(false);
    }
  };

  if (error && !datos) {
    return (
      <div className="p-6">
        <div className="bg-red-50 text-red-700 p-4 rounded-xl">{error}</div>
      </div>
    );
  }
  if (!datos) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  const kpis = datos.indicadores;
  const conDato = kpis.filter((k) => k.ultimo?.cumple != null);
  const cumplen = conDato.filter((k) => k.ultimo.cumple).length;
  const activo = kpis.find((k) => k.codigo === elegido) || kpis[0];

  return (
    <div className="p-6 space-y-5 max-w-7xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-[#236093]/10 rounded-lg">
            <ShieldCheck className="w-6 h-6 text-[#236093]" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Indicadores AIMS</h1>
            <p className="text-sm text-gray-500">Asset Integrity Management System</p>
          </div>
        </div>
        {datos.anios.length > 1 && (
          <select
            value={datos.anio || ""}
            onChange={(e) => setAnio(Number(e.target.value))}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5"
          >
            {datos.anios.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        )}
      </div>

      <EstadoArchivo
        archivo={datos.archivo}
        onSincronizar={sincronizar}
        sincronizando={sincronizando}
        puedeSincronizar={esAdmin}
      />

      {kpis.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 p-10 text-center text-gray-400">
          Todavía no se ha cargado el libro de indicadores.
        </div>
      ) : (
        <>
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-900 flex items-start gap-2">
            <Info className="w-4 h-4 mt-0.5 shrink-0" />
            <span>
              <b>
                {cumplen} de {conDato.length}
              </b>{" "}
              indicadores cumplen su meta en el último mes cerrado. Solo entran los meses
              que el área marcó como cerrados en el libro. En MTTR e indisponibilidad,
              cumplir es quedar <b>por debajo</b> de la meta.
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {kpis.map((k) => (
              <TarjetaKpi
                key={k.codigo}
                kpi={k}
                activa={k.codigo === activo?.codigo}
                onClick={() => setElegido(k.codigo)}
              />
            ))}
          </div>

          {activo && <DetalleKpi kpi={activo} anio={datos.anio} />}
        </>
      )}
    </div>
  );
}
