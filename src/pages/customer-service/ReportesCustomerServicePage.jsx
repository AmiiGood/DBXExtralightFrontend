import { useState, useEffect, useMemo, useCallback } from "react";
import {
  ComposedChart,
  ScatterChart,
  Scatter,
  Bar,
  Line,
  XAxis,
  YAxis,
  ZAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
} from "recharts";
import {
  Handshake,
  Loader2,
  RefreshCw,
  Info,
  AlertTriangle,
  FolderCog,
  TrendingUp,
  Package,
} from "lucide-react";
import { customerServiceService } from "../../services/customerService.service";
import { useAuthStore } from "../../stores/auth.store";

/**
 * Reportes de Customer Service.
 *
 * Dos mitades que se miran distinto y por eso van en pestañas separadas:
 *
 *   INDICADORES  OTS, OTIF y SC. Series semanales contra una meta fija. Se lee
 *                de corrido, semana por semana.
 *   MUESTRAS     El detalle de cada solicitud, con cuánto tardó y cuánto debía
 *                tardar. Se lee cortando por familia, cliente o área.
 *
 * ---------------------------------------------------------------------------
 * LO QUE NO SE VE Y SÍ IMPORTA
 * ---------------------------------------------------------------------------
 * El dato no lo sube nadie: sale de dos archivos en una carpeta de red que el
 * área actualiza cada semana. Si el servidor deja de alcanzarlos, el reporte
 * seguiría enseñando el último número bueno sin decir nada. Por eso el aviso de
 * lectura va ARRIBA y en rojo cuando algo falló, no escondido en un pie.
 */

const AZUL = "#236093";
const VERDE = "#49a090";
const NARANJA = "#c9761f";
const ROJO = "#b0413e";
const MORADO = "#7c6bb0";
const GRIS = "#94a3b8";

const COLOR_BU = [AZUL, NARANJA, MORADO, VERDE, ROJO];

const num = (n) =>
  n == null ? "—" : Number(n).toLocaleString("es-MX", { maximumFractionDigits: 0 });
const pct = (n, d = 1) => (n == null ? "—" : `${(Number(n) * 100).toFixed(d)}%`);
const dias = (n, d = 1) =>
  n == null ? "—" : `${Number(n).toLocaleString("es-MX", { maximumFractionDigits: d })} d`;

/** El signo importa: +7 d es tarde, −2 d es antes. */
const desvio = (n) =>
  n == null ? "—" : `${n > 0 ? "+" : ""}${Number(n).toFixed(1)} d`;

const fechaCorta = (f) =>
  !f ? "—" : new Date(f).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "2-digit" });

function Tarjeta({ titulo, valor, detalle, color, aviso, pie }) {
  return (
    <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-100">
      <p className="text-sm text-gray-500 flex items-center gap-1.5">
        {titulo}
        {aviso && (
          <span title={aviso}>
            <Info className="w-3.5 h-3.5 text-gray-400" />
          </span>
        )}
      </p>
      <p className="text-2xl font-bold mt-1" style={{ color: color || "#1f2937" }}>
        {valor}
      </p>
      {detalle && <p className="text-xs text-gray-400 mt-1">{detalle}</p>}
      {pie}
    </div>
  );
}

const Seccion = ({ id, titulo, nota, children, acciones }) => (
  <div
    id={id}
    data-grafica={id}
    className="bg-white rounded-xl shadow-sm border border-gray-100 p-5"
  >
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 className="font-semibold text-gray-900">{titulo}</h2>
        {nota && <p className="text-xs text-gray-400 mt-0.5 max-w-3xl">{nota}</p>}
      </div>
      {acciones}
    </div>
    <div className="mt-4">{children}</div>
  </div>
);

/**
 * De cuándo es el dato, y si algo falló al leerlo.
 *
 * Va siempre visible. Un archivo que dejó de leerse no vacía el reporte —los
 * datos viejos siguen ahí—, así que sin este aviso nadie se enteraría.
 */
function EstadoArchivos({ archivos, onSincronizar, sincronizando, puedeSincronizar }) {
  if (!archivos?.length) return null;
  const conError = archivos.filter((a) => a.error);

  return (
    <div
      className={`rounded-xl border p-4 ${
        conError.length ? "bg-red-50 border-red-200" : "bg-gray-50 border-gray-200"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          {archivos.map((a) => (
            <div key={a.clave} className="text-sm flex items-start gap-2">
              {a.error ? (
                <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
              ) : (
                <FolderCog className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
              )}
              <div>
                <span className="font-medium text-gray-700">{a.archivo}</span>
                {a.error ? (
                  <span className="text-red-700"> — {a.error}</span>
                ) : (
                  <span className="text-gray-500">
                    {" "}
                    — {num(a.filas)} renglones, leído el {a.leido || "—"}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
        {puedeSincronizar && (
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

// ===========================================================================
// INDICADORES
// ===========================================================================

function PestanaKpi({ filtrosDisp, anio, setAnio }) {
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [indicador, setIndicador] = useState("OTIF");

  useEffect(() => {
    if (!anio) return;
    setCargando(true);
    customerServiceService
      .getKpi({ anio, indicador })
      .then(setDatos)
      .catch((e) => setError(e.response?.data?.message || e.message))
      .finally(() => setCargando(false));
  }, [anio, indicador]);

  const serie = useMemo(() => {
    if (!datos?.serie) return [];
    return datos.serie.semanas.map((s) => ({
      ...s,
      ...Object.fromEntries(
        datos.serie.unidades.map((u) => [`bu_${u}`, s.bus[u] ?? null]),
      ),
    }));
  }, [datos]);

  /**
   * ¿La comparativa anual mezcla peras con manzanas?
   *
   * En 2023 y 2024 la hoja de OTIF del libro es una copia exacta de la de OTS
   * —renglón por renglón, las tres unidades— y empiezan a diferir hasta 2025.
   * O sea que el "OTIF" de esos dos años es en realidad el OTS. Comparar la
   * barra de 2024 con la de 2026 sin saberlo lleva a una conclusión falsa.
   */
  const aniosCopiados = useMemo(() => {
    if (!datos?.anual) return [];
    const por = {};
    for (const r of datos.anual) (por[r.anio] ||= {})[r.indicador] = r.promedio;
    return Object.entries(por)
      .filter(([, v]) => v.OTS != null && v.OTIF != null && v.OTS === v.OTIF)
      .map(([a]) => Number(a));
  }, [datos]);

  const anualPivote = useMemo(() => {
    if (!datos?.anual) return [];
    const por = {};
    for (const r of datos.anual) {
      (por[r.anio] ||= { anio: r.anio })[r.indicador] = r.promedio;
      por[r.anio][`sem_${r.indicador}`] = r.semanas;
      por[r.anio][`meta_${r.indicador}`] = r.semanasEnMeta;
    }
    return Object.values(por).sort((a, b) => a.anio - b.anio);
  }, [datos]);

  if (cargando && !datos) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }
  if (error) {
    return <div className="bg-red-50 text-red-700 p-4 rounded-xl">{error}</div>;
  }
  if (!datos) return null;

  const meta = datos.serie.semanas[0]?.meta ?? null;

  return (
    <div className="space-y-5">
      {/* --- Tarjetas de los tres indicadores --- */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {datos.resumen.map((r) => {
          const enMeta = r.ultimoValor >= r.meta;
          return (
            <Tarjeta
              key={r.indicador}
              titulo={`${r.indicador} — ${r.largo}`}
              valor={pct(r.ultimoValor)}
              color={enMeta ? VERDE : ROJO}
              detalle={`Semana ${r.ultimaSemana} · meta ${pct(r.meta, 0)}`}
              aviso={r.descripcion}
              pie={
                <div className="mt-3 pt-3 border-t border-gray-100 text-xs text-gray-500 space-y-0.5">
                  <p>
                    Promedio del año{" "}
                    <span className="font-medium text-gray-700">{pct(r.promedio)}</span>
                  </p>
                  <p>
                    {r.semanasEnMeta} de {r.semanas} semanas en meta
                  </p>
                </div>
              }
            />
          );
        })}
      </div>

      {/* --- Serie semanal --- */}
      <Seccion
        id="cs-kpi-semanal"
        titulo={`${indicador} semana a semana · ${anio}`}
        nota={
          "La línea gruesa es el indicador de la semana completa; las delgadas, cada unidad de negocio. " +
          "Solo se dibujan las semanas con captura: el libro trae el año entero precargado y las que no han llegado valen cero."
        }
        acciones={
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
            {filtrosDisp.kpi.indicadores.map((i) => (
              <button
                key={i.indicador}
                onClick={() => setIndicador(i.indicador)}
                className={`px-3 py-1 text-sm rounded-md transition ${
                  indicador === i.indicador
                    ? "bg-white shadow-sm font-medium text-gray-900"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {i.indicador}
              </button>
            ))}
          </div>
        }
      >
        <ResponsiveContainer width="100%" height={340}>
          <ComposedChart data={serie} margin={{ top: 5, right: 10, bottom: 5, left: -10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
            <XAxis dataKey="etiqueta" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
            <YAxis
              tickFormatter={(v) => `${Math.round(v * 100)}%`}
              domain={[0, 1]}
              tick={{ fontSize: 11 }}
            />
            <Tooltip
              formatter={(v, n) => [pct(v), n.startsWith("bu_") ? n.slice(3) : n]}
              labelFormatter={(l, p) =>
                `Semana ${p?.[0]?.payload?.semana ?? l} · ${p?.[0]?.payload?.mes ?? ""}`
              }
            />
            <Legend
              formatter={(v) => (v.startsWith("bu_") ? v.slice(3) : v)}
              wrapperStyle={{ fontSize: 12 }}
            />
            {meta != null && (
              <ReferenceLine
                y={meta}
                stroke={ROJO}
                strokeDasharray="4 4"
                label={{ value: `Meta ${pct(meta, 0)}`, position: "right", fontSize: 11, fill: ROJO }}
              />
            )}
            {datos.serie.unidades.map((u, i) => (
              <Line
                key={u}
                type="monotone"
                dataKey={`bu_${u}`}
                name={`bu_${u}`}
                stroke={COLOR_BU[(i + 1) % COLOR_BU.length]}
                strokeWidth={1.5}
                dot={false}
                connectNulls
                opacity={0.65}
              />
            ))}
            <Line
              type="monotone"
              dataKey="general"
              name="General"
              stroke={AZUL}
              strokeWidth={3}
              dot={{ r: 2 }}
              connectNulls
            />
          </ComposedChart>
        </ResponsiveContainer>
      </Seccion>

      {/* --- Unidades de negocio --- */}
      <Seccion
        id="cs-kpi-unidades"
        titulo={`${indicador} por unidad de negocio · ${anio}`}
        nota={
          "El peso es lo que cada unidad aporta al indicador general. Crocs pesa cerca del 80%, " +
          "así que el número de la semana es casi el de Crocs: una unidad chica puede estar muy mal sin moverlo."
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b border-gray-100">
                <th className="py-2 font-medium">Unidad</th>
                <th className="py-2 font-medium text-right">Peso</th>
                <th className="py-2 font-medium text-right">Promedio</th>
                <th className="py-2 font-medium text-right">Mediana</th>
                <th className="py-2 font-medium text-right">Peor semana</th>
                <th className="py-2 font-medium text-right">En meta</th>
              </tr>
            </thead>
            <tbody>
              {datos.unidades.map((u) => (
                <tr key={u.bu} className="border-b border-gray-50 last:border-0">
                  <td className="py-2 font-medium text-gray-800">{u.bu}</td>
                  <td className="py-2 text-right text-gray-500">{pct(u.peso, 0)}</td>
                  <td
                    className="py-2 text-right font-medium"
                    style={{ color: u.promedio >= u.meta ? VERDE : ROJO }}
                  >
                    {pct(u.promedio)}
                  </td>
                  <td className="py-2 text-right text-gray-600">{pct(u.mediana)}</td>
                  <td className="py-2 text-right text-gray-500">{pct(u.peor)}</td>
                  <td className="py-2 text-right text-gray-600">
                    {u.semanasEnMeta} / {u.semanas}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Seccion>

      {/* --- Comparativa anual --- */}
      <Seccion
        id="cs-kpi-anual"
        titulo="Promedio por año"
        nota={
          aniosCopiados.length
            ? `Solo se promedian las semanas con captura. Ojo con ${aniosCopiados.join(" y ")}: ` +
              "en el libro la hoja de OTIF de esos años es una copia exacta de la de OTS, así que las dos barras " +
              "son el mismo dato. Las dos hojas empiezan a diferir hasta 2025."
            : "Solo se promedian las semanas con captura."
        }
      >
        <ResponsiveContainer width="100%" height={280}>
          <ComposedChart data={anualPivote} margin={{ top: 5, right: 10, bottom: 5, left: -10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
            <XAxis dataKey="anio" tick={{ fontSize: 12 }} />
            <YAxis
              tickFormatter={(v) => `${Math.round(v * 100)}%`}
              domain={[0, 1]}
              tick={{ fontSize: 11 }}
            />
            <Tooltip
              formatter={(v, n, p) => [
                `${pct(v)}  (${p.payload[`meta_${n}`]} de ${p.payload[`sem_${n}`]} semanas en meta)`,
                n,
              ]}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="OTS" fill={AZUL} radius={[3, 3, 0, 0]} />
            <Bar dataKey="OTIF" fill={NARANJA} radius={[3, 3, 0, 0]} />
            <Bar dataKey="SC" fill={VERDE} radius={[3, 3, 0, 0]} />
          </ComposedChart>
        </ResponsiveContainer>
      </Seccion>
    </div>
  );
}

// ===========================================================================
// MUESTRAS
// ===========================================================================

const CORTE_ETIQUETA = {
  familia: "familia",
  tipo: "tipo",
  bu: "unidad de negocio",
  area: "área solicitante",
  cliente: "cliente",
  periodo: "periodo",
  estado: "estado",
};

function PestanaMuestras({ filtrosDisp }) {
  const [datos, setDatos] = useState(null);
  const [detalle, setDetalle] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [corte, setCorte] = useState("familia");
  const [filtros, setFiltros] = useState({ periodos: [], bus: [], tipos: [], areas: [] });
  const [verDetalle, setVerDetalle] = useState(false);

  useEffect(() => {
    setCargando(true);
    customerServiceService
      .getMuestras(filtros, corte)
      .then(setDatos)
      .catch((e) => setError(e.response?.data?.message || e.message))
      .finally(() => setCargando(false));
  }, [filtros, corte]);

  useEffect(() => {
    if (!verDetalle) return;
    customerServiceService
      .getMuestrasDetalle(filtros, { limite: 500 })
      .then(setDetalle)
      .catch(() => setDetalle(null));
  }, [verDetalle, filtros]);

  const alternar = useCallback((campo, valor) => {
    setFiltros((f) => {
      const actual = f[campo] || [];
      return {
        ...f,
        [campo]: actual.includes(valor)
          ? actual.filter((v) => v !== valor)
          : [...actual, valor],
      };
    });
  }, []);

  /** El máximo de los dos ejes, para que la diagonal salga a 45°. */
  const topeDispersion = useMemo(() => {
    if (!datos?.dispersion?.length) return 10;
    return Math.ceil(
      Math.max(...datos.dispersion.map((d) => Math.max(d.proceso, d.objetivo))) * 1.05,
    );
  }, [datos]);

  if (cargando && !datos) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }
  if (error) {
    return <div className="bg-red-50 text-red-700 p-4 rounded-xl">{error}</div>;
  }
  if (!datos) return null;

  const r = datos.resumen;

  const Grupo = ({ campo, titulo, opciones }) => (
    <div>
      <p className="text-xs text-gray-500 mb-1.5">{titulo}</p>
      <div className="flex flex-wrap gap-1.5">
        {opciones.map((o) => {
          const activo = (filtros[campo] || []).includes(o);
          return (
            <button
              key={o}
              onClick={() => alternar(campo, o)}
              className={`px-2.5 py-1 text-xs rounded-lg border transition ${
                activo
                  ? "bg-[#236093] text-white border-[#236093]"
                  : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
              }`}
            >
              {o}
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="space-y-5">
      {/* --- Filtros --- */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Grupo campo="periodos" titulo="Periodo" opciones={filtrosDisp.muestras.periodos} />
        <Grupo campo="bus" titulo="Unidad de negocio" opciones={filtrosDisp.muestras.bus} />
        <Grupo campo="tipos" titulo="Tipo" opciones={filtrosDisp.muestras.tipos} />
        <Grupo campo="areas" titulo="Área solicitante" opciones={filtrosDisp.muestras.areas} />
      </div>

      {/* --- Tarjetas --- */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Tarjeta
          titulo="Muestras"
          valor={num(r.muestras)}
          detalle={`${fechaCorta(r.desde)} a ${fechaCorta(r.hasta)} · ${r.clientes} clientes`}
        />
        <Tarjeta
          titulo="Cumplimiento"
          valor={pct(r.cumplimiento)}
          color={r.cumplimiento >= 0.8 ? VERDE : ROJO}
          detalle={`${r.enTiempo} de ${r.muestras} entregadas a tiempo`}
          aviso="Cuenta solicitudes, no pares. Es la forma en que lo mide el libro."
          pie={
            <div className="mt-3 pt-3 border-t border-gray-100 text-xs text-gray-500">
              Medido por pares:{" "}
              <span className="font-medium text-gray-700">{pct(r.cumplimientoPares)}</span>{" "}
              ({num(r.paresEnTiempo)} de {num(r.pares)})
            </div>
          }
        />
        <Tarjeta
          titulo="Días de proceso"
          valor={dias(r.diasMediana)}
          detalle={`Objetivo ${dias(r.objetivoPromedio)} · p90 ${dias(r.diasP90)}`}
          aviso="Mediana. El promedio lo jala el caso de 93 días."
          pie={
            <div className="mt-3 pt-3 border-t border-gray-100 text-xs text-gray-500">
              Desvío típico{" "}
              <span
                className="font-medium"
                style={{ color: r.desvioMediana > 0 ? ROJO : VERDE }}
              >
                {desvio(r.desvioMediana)}
              </span>{" "}
              contra el objetivo
            </div>
          }
        />
        <Tarjeta
          titulo="Sin cerrar"
          valor={num(r.abiertas)}
          color={r.abiertas ? NARANJA : VERDE}
          detalle="Solicitudes que siguen abiertas y ya pasaron su fecha"
        />
      </div>

      {/* --- Corte principal --- */}
      <Seccion
        id="cs-muestras-corte"
        titulo={`Cumplimiento por ${CORTE_ETIQUETA[corte]}`}
        nota="Las barras son el conteo de solicitudes; la línea, el porcentaje que salió a tiempo."
        acciones={
          <select
            value={corte}
            onChange={(e) => setCorte(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white"
          >
            {filtrosDisp.cortes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.etiqueta}
              </option>
            ))}
          </select>
        }
      >
        <ResponsiveContainer width="100%" height={320}>
          <ComposedChart
            data={datos.porCorte.grupos}
            margin={{ top: 5, right: 10, bottom: 5, left: -10 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
            <XAxis dataKey="grupo" tick={{ fontSize: 11 }} interval={0} angle={-12} textAnchor="end" height={55} />
            <YAxis yAxisId="i" tick={{ fontSize: 11 }} />
            <YAxis
              yAxisId="d"
              orientation="right"
              domain={[0, 1]}
              tickFormatter={(v) => `${Math.round(v * 100)}%`}
              tick={{ fontSize: 11 }}
            />
            <Tooltip
              formatter={(v, n) => (n === "Cumplimiento" ? pct(v) : num(v))}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar yAxisId="i" dataKey="enTiempo" name="A tiempo" stackId="a" fill={VERDE} />
            <Bar yAxisId="i" dataKey="conRetraso" name="Con retraso" stackId="a" fill={ROJO} />
            <Bar
              yAxisId="i"
              dataKey="abiertas"
              name="Sin cerrar"
              stackId="a"
              fill={NARANJA}
              radius={[3, 3, 0, 0]}
            />
            <Line
              yAxisId="d"
              type="monotone"
              dataKey="cumplimiento"
              name="Cumplimiento"
              stroke={AZUL}
              strokeWidth={2}
              dot={{ r: 3 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </Seccion>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* --- Dispersión --- */}
        <Seccion
          id="cs-muestras-dispersion"
          titulo="Lo que tardó contra lo que debía tardar"
          nota="Cada punto es una solicitud. La diagonal es la fecha comprometida: todo lo que queda arriba llegó tarde."
        >
          <ResponsiveContainer width="100%" height={320}>
            <ScatterChart margin={{ top: 10, right: 15, bottom: 5, left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
              <XAxis
                type="number"
                dataKey="objetivo"
                name="Objetivo"
                unit=" d"
                domain={[0, topeDispersion]}
                tick={{ fontSize: 11 }}
              />
              <YAxis
                type="number"
                dataKey="proceso"
                name="Real"
                unit=" d"
                domain={[0, topeDispersion]}
                tick={{ fontSize: 11 }}
              />
              <ZAxis type="number" dataKey="pares" range={[30, 260]} name="Pares" />
              <Tooltip
                cursor={{ strokeDasharray: "3 3" }}
                content={({ payload }) => {
                  const d = payload?.[0]?.payload;
                  if (!d) return null;
                  return (
                    <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-2.5 text-xs">
                      <p className="font-medium text-gray-800">{d.muestraId || "—"}</p>
                      <p className="text-gray-500">
                        {d.cliente} · {d.familia}
                      </p>
                      <p className="mt-1 text-gray-700">
                        Tardó <b>{dias(d.proceso, 0)}</b> contra {dias(d.objetivo, 0)}{" "}
                        <span style={{ color: d.proceso > d.objetivo ? ROJO : VERDE }}>
                          ({desvio(d.proceso - d.objetivo)})
                        </span>
                      </p>
                      {d.pares != null && (
                        <p className="text-gray-500">{num(d.pares)} pares</p>
                      )}
                    </div>
                  );
                }}
              />
              <ReferenceLine
                segment={[
                  { x: 0, y: 0 },
                  { x: topeDispersion, y: topeDispersion },
                ]}
                stroke={GRIS}
                strokeDasharray="5 5"
              />
              <Scatter data={datos.dispersion} fillOpacity={0.6}>
                {datos.dispersion.map((d) => (
                  <Cell
                    key={d.id}
                    fill={d.proceso > d.objetivo ? ROJO : VERDE}
                  />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </Seccion>

        {/* --- Desvío --- */}
        <Seccion
          id="cs-muestras-desvio"
          titulo="Por cuánto se falló"
          nota="El porcentaje de cumplimiento trata igual un día tarde que un mes. Esto separa las dos cosas."
        >
          <ResponsiveContainer width="100%" height={320}>
            <ComposedChart
              data={datos.desvio}
              layout="vertical"
              margin={{ top: 5, right: 20, bottom: 5, left: 60 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis
                type="category"
                dataKey="rango"
                width={135}
                tick={{ fontSize: 11 }}
              />
              <Tooltip
                formatter={(v, n, p) => [`${num(v)} muestras (${pct(p.payload.porcentaje)})`, "Solicitudes"]}
              />
              <Bar dataKey="muestras" radius={[0, 3, 3, 0]}>
                {datos.desvio.map((d) => (
                  <Cell key={d.rango} fill={d.tarde ? ROJO : VERDE} />
                ))}
              </Bar>
            </ComposedChart>
          </ResponsiveContainer>
        </Seccion>
      </div>

      {/* --- Evolución --- */}
      <Seccion
        id="cs-muestras-mensual"
        titulo="Mes a mes"
        nota="Por fecha de solicitud. La línea es el porcentaje que salió a tiempo."
      >
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={datos.mensual} margin={{ top: 5, right: 10, bottom: 5, left: -10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
            <XAxis dataKey="etiqueta" tick={{ fontSize: 11 }} />
            <YAxis yAxisId="i" tick={{ fontSize: 11 }} />
            <YAxis
              yAxisId="d"
              orientation="right"
              domain={[0, 1]}
              tickFormatter={(v) => `${Math.round(v * 100)}%`}
              tick={{ fontSize: 11 }}
            />
            <Tooltip formatter={(v, n) => (n === "Cumplimiento" ? pct(v) : num(v))} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar yAxisId="i" dataKey="enTiempo" name="A tiempo" stackId="a" fill={VERDE} />
            <Bar yAxisId="i" dataKey="conRetraso" name="Con retraso" stackId="a" fill={ROJO} />
            <Bar
              yAxisId="i"
              dataKey="abiertas"
              name="Sin cerrar"
              stackId="a"
              fill={NARANJA}
              radius={[3, 3, 0, 0]}
            />
            <Line
              yAxisId="d"
              type="monotone"
              dataKey="cumplimiento"
              name="Cumplimiento"
              stroke={AZUL}
              strokeWidth={2}
              dot={{ r: 3 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </Seccion>

      {/* --- Clientes --- */}
      <Seccion
        id="cs-muestras-clientes"
        titulo="Clientes con más solicitudes"
        nota="Los doce primeros. La mediana de días dice si uno en particular se está tardando."
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b border-gray-100">
                <th className="py-2 font-medium">Cliente</th>
                <th className="py-2 font-medium text-right">Solicitudes</th>
                <th className="py-2 font-medium text-right">A tiempo</th>
                <th className="py-2 font-medium text-right">Cumplimiento</th>
                <th className="py-2 font-medium text-right">Pares</th>
                <th className="py-2 font-medium text-right">Días (mediana)</th>
              </tr>
            </thead>
            <tbody>
              {datos.clientes.grupos.map((c) => (
                <tr key={c.grupo} className="border-b border-gray-50 last:border-0">
                  <td className="py-2 font-medium text-gray-800">{c.grupo}</td>
                  <td className="py-2 text-right text-gray-600">{num(c.muestras)}</td>
                  <td className="py-2 text-right text-gray-600">{num(c.enTiempo)}</td>
                  <td
                    className="py-2 text-right font-medium"
                    style={{ color: c.cumplimiento >= 0.8 ? VERDE : ROJO }}
                  >
                    {pct(c.cumplimiento)}
                  </td>
                  <td className="py-2 text-right text-gray-500">{num(c.pares)}</td>
                  <td className="py-2 text-right text-gray-600">{dias(c.diasMediana, 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Seccion>

      {/* --- Detalle --- */}
      <Seccion
        id="cs-muestras-detalle"
        titulo="Detalle"
        nota={verDetalle ? `${num(detalle?.total)} solicitudes con los filtros puestos` : null}
        acciones={
          <button
            onClick={() => setVerDetalle((v) => !v)}
            className="text-sm px-3 py-1.5 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            {verDetalle ? "Ocultar" : "Ver renglón a renglón"}
          </button>
        }
      >
        {verDetalle &&
          (detalle ? (
            <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-white">
                  <tr className="text-left text-gray-500 border-b border-gray-100">
                    <th className="py-2 font-medium">Muestra</th>
                    <th className="py-2 font-medium">Cliente</th>
                    <th className="py-2 font-medium">Familia</th>
                    <th className="py-2 font-medium">Inicio</th>
                    <th className="py-2 font-medium text-right">Días</th>
                    <th className="py-2 font-medium text-right">Objetivo</th>
                    <th className="py-2 font-medium text-right">Desvío</th>
                    <th className="py-2 font-medium text-right">Pares</th>
                    <th className="py-2 font-medium">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {detalle.filas.map((f) => (
                    <tr key={f.id} className="border-b border-gray-50 last:border-0">
                      <td className="py-1.5 text-gray-800">{f.muestraId || "—"}</td>
                      <td className="py-1.5 text-gray-600">{f.cliente || "—"}</td>
                      <td className="py-1.5 text-gray-500">{f.familia || "—"}</td>
                      <td className="py-1.5 text-gray-500">{fechaCorta(f.inicio)}</td>
                      <td className="py-1.5 text-right text-gray-700">{f.diasProceso ?? "—"}</td>
                      <td className="py-1.5 text-right text-gray-500">{f.diasObjetivo ?? "—"}</td>
                      <td
                        className="py-1.5 text-right font-medium"
                        style={{ color: f.desvio > 0 ? ROJO : VERDE }}
                      >
                        {desvio(f.desvio)}
                      </td>
                      <td className="py-1.5 text-right text-gray-500">{num(f.pares)}</td>
                      <td className="py-1.5 text-gray-600">{f.estado}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            </div>
          ))}
      </Seccion>
    </div>
  );
}

// ===========================================================================

export default function ReportesCustomerServicePage() {
  const [filtrosDisp, setFiltrosDisp] = useState(null);
  const [error, setError] = useState(null);
  const [pestana, setPestana] = useState("kpi");
  const [anio, setAnio] = useState(null);
  const [archivos, setArchivos] = useState([]);
  const [sincronizando, setSincronizando] = useState(false);

  const usuario = useAuthStore((s) => s.user);
  const esAdmin = Boolean(usuario?.rol?.esAdmin);

  useEffect(() => {
    customerServiceService
      .getFiltros()
      .then((f) => {
        setFiltrosDisp(f);
        setAnio(f.kpi.anios[0]);
      })
      .catch((e) => setError(e.response?.data?.message || e.message));

    customerServiceService
      .getArchivos()
      .then((e) => setArchivos(e.archivos))
      .catch(() => {});
  }, []);

  const sincronizar = async () => {
    setSincronizando(true);
    try {
      const r = await customerServiceService.sincronizar();
      setArchivos(r.estado.archivos);
      // Volver a pedir los filtros fuerza el refresco de las pestañas, que
      // dependen de ellos.
      setFiltrosDisp(await customerServiceService.getFiltros());
    } catch (e) {
      setError(e.response?.data?.message || e.message);
    } finally {
      setSincronizando(false);
    }
  };

  if (error && !filtrosDisp) {
    return (
      <div className="p-6">
        <div className="bg-red-50 text-red-700 p-4 rounded-xl">{error}</div>
      </div>
    );
  }
  if (!filtrosDisp) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-5 max-w-[1600px] mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-[#236093]/10 rounded-lg">
            <Handshake className="w-6 h-6 text-[#236093]" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Customer Service</h1>
            <p className="text-sm text-gray-500">
              Indicadores de servicio y cumplimiento de muestras
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {pestana === "kpi" && (
            <select
              value={anio || ""}
              onChange={(e) => setAnio(Number(e.target.value))}
              className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white"
            >
              {filtrosDisp.kpi.anios.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          )}
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setPestana("kpi")}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition ${
                pestana === "kpi"
                  ? "bg-white shadow-sm font-medium text-gray-900"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <TrendingUp className="w-4 h-4" />
              Indicadores
            </button>
            <button
              onClick={() => setPestana("muestras")}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition ${
                pestana === "muestras"
                  ? "bg-white shadow-sm font-medium text-gray-900"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <Package className="w-4 h-4" />
              Muestras
            </button>
          </div>
        </div>
      </div>

      <EstadoArchivos
        archivos={archivos}
        onSincronizar={sincronizar}
        sincronizando={sincronizando}
        puedeSincronizar={esAdmin}
      />

      {pestana === "kpi" ? (
        <PestanaKpi filtrosDisp={filtrosDisp} anio={anio} setAnio={setAnio} />
      ) : (
        <PestanaMuestras filtrosDisp={filtrosDisp} />
      )}
    </div>
  );
}
