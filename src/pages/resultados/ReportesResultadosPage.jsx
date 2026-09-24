import { useState, useEffect, useMemo, useRef } from "react";
import { Link } from "react-router-dom";
import {
  ComposedChart,
  BarChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
} from "recharts";
import {
  Target, RotateCcw, Loader2, Download, Upload, TrendingUp, TrendingDown, Minus,
} from "lucide-react";
import { resultadosService, SERIES_MENSUALES } from "../../services/resultados.service";
import { exportarReporteResultados } from "../../utils/exportarReporteResultados";
import MapaCalorScrap from "../../components/resultados/MapaCalorScrap";
import CascadaMargen from "../../components/resultados/CascadaMargen";
import { useAuthStore } from "../../stores/auth.store";

/**
 * Reportes de Resultados.
 *
 * Sustituye el libro 'DATA-FCMX-AAAA Mes.xlsx': catorce hojas y diez gráficas,
 * todas barras agrupadas comparando cinco años mes a mes.
 *
 * Aquí las catorce hojas caben en ocho secciones, porque la mitad del libro
 * son re-acomodos de los mismos números. Y como en la base solo viven los
 * absolutos, se pudieron armar tres cosas que el Excel no tiene:
 *
 *   El PRECIO POR UNIDAD, que sale de cruzar dos hojas distintas
 *   ('Fact acumulada USD' entre 'Fact acumulada QTY'). Por vivir en hojas
 *   separadas nadie lo grafica, y cuenta la mejor historia del libro: el
 *   precio promedio pasó de 3.22 a 4.66 USD por unidad entre 2020 y 2026.
 *
 *   El MAPA DE CALOR del scrap, que reemplaza cinco hojas donde hay que ir
 *   comparando de pestaña en pestaña.
 *
 *   La CASCADA del estado de resultados, que en el libro es una tabla.
 */

const AZUL = "#236093";
const VERDE = "#49a090";
const NARANJA = "#c9761f";
const ROJO = "#b0413e";
const MORADO = "#7c6bb0";
const GRIS = "#94a3b8";

const COLOR_BU = {
  CROCS: AZUL,
  FOAM_DESIGN: NARANJA,
  SUELA: "#95b849",
  DUAL_COLOR: MORADO,
  COMPOUND: VERDE,
  FOOTWEAR: "#95b849",
  PLANTA: GRIS,
};

/** Un color por año, del más viejo (claro) al más reciente (oscuro y azul). */
const COLOR_ANIO = ["#cbd5e1", "#a8b4c2", "#8fa3b8", "#6f8aa6", "#4a7396", "#2f6a9a", "#236093"];

const num = (n, d = 0) =>
  n == null ? "—" : Number(n).toLocaleString("es-MX", { maximumFractionDigits: d });
const pct = (n, d = 1) => (n == null ? "—" : `${(Number(n) * 100).toFixed(d)}%`);
/** Dinero: siempre con los decimales pedidos, para que no salga "$6.5". */
const usd = (n, d = 0) =>
  n == null
    ? "—"
    : `$${Number(n).toLocaleString("es-MX", {
        minimumFractionDigits: d,
        maximumFractionDigits: d,
      })}`;
const eur = (n, d = 0) => (n == null ? "—" : `${num(n, d)} €`);

/** Millones y miles abreviados para los ejes. */
const corto = (n) => {
  const v = Number(n);
  if (!Number.isFinite(v)) return "";
  if (Math.abs(v) >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (Math.abs(v) >= 1000) return `${Math.round(v / 1000)}k`;
  return String(Math.round(v));
};

const pctEje = (v) => `${(v * 100).toFixed(0)}%`;

/**
 * Tarjeta con comparación contra el año anterior.
 *
 * `mejorMenos` invierte la lectura del color: en scrap, rotación o consumo,
 * bajar es bueno.
 */
function Tarjeta({ titulo, valor, detalle, previo, actual, mejorMenos, color }) {
  let delta = null;
  if (previo != null && actual != null && previo !== 0) {
    delta = (actual - previo) / Math.abs(previo);
  }
  const mejora = delta == null ? null : mejorMenos ? delta < 0 : delta > 0;
  const Icono = delta == null || Math.abs(delta) < 0.005 ? Minus : delta > 0 ? TrendingUp : TrendingDown;

  return (
    <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-100">
      <p className="text-sm text-gray-500">{titulo}</p>
      <p className="text-2xl font-bold mt-1" style={{ color: color || "#1f2937" }}>
        {valor}
      </p>
      <div className="flex items-center gap-2 mt-1">
        {delta != null && (
          <span
            className="inline-flex items-center gap-1 text-xs font-medium"
            style={{ color: mejora === null ? GRIS : mejora ? VERDE : ROJO }}
          >
            <Icono className="w-3.5 h-3.5" />
            {(Math.abs(delta) * 100).toFixed(1)}%
          </span>
        )}
        {detalle && <span className="text-xs text-gray-400">{detalle}</span>}
      </div>
    </div>
  );
}

const Seccion = ({ id, titulo, nota, children, acciones, refSeccion }) => (
  <div
    id={id}
    ref={refSeccion}
    data-grafica={id}
    className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 scroll-mt-4"
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

const SECCIONES = [
  ["facturacion", "Facturación"],
  ["precio", "Precio por unidad"],
  ["scrap", "Scrap"],
  ["capacidad", "Capacidad"],
  ["personal", "Personal"],
  ["energia", "Energía"],
  ["compound", "Compound"],
  ["margen", "Estado de resultados"],
  ["historico", "Histórico"],
];

export default function ReportesResultadosPage() {
  const [filtros, setFiltros] = useState(null);
  const [anio, setAnio] = useState("");
  const [datos, setDatos] = useState(null);
  const [historico, setHistorico] = useState([]);
  const [serieMensual, setSerieMensual] = useState("qty");
  const [mensual, setMensual] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [exportando, setExportando] = useState(false);

  const usuario = useAuthStore((s) => s.user);
  const esAdmin = Boolean(usuario?.rol?.esAdmin);
  const navRef = useRef(null);

  useEffect(() => {
    Promise.all([resultadosService.getFiltros(), resultadosService.getHistorico()])
      .then(([f, h]) => {
        setFiltros(f);
        setHistorico(h);
        if (f.anios?.length) setAnio(String(f.anios[0].anio));
      })
      .catch((e) => setError(e.response?.data?.message || e.message));
  }, []);

  useEffect(() => {
    if (!anio) return;
    setCargando(true);
    setError(null);
    resultadosService
      .getDashboard(anio)
      .then(setDatos)
      .catch((e) => setError(e.response?.data?.message || e.message))
      .finally(() => setCargando(false));
  }, [anio]);

  useEffect(() => {
    resultadosService
      .getComparativoMensual(serieMensual)
      .then(setMensual)
      .catch(() => setMensual(null));
  }, [serieMensual]);

  const nombresBu = useMemo(
    () => Object.fromEntries((filtros?.bus || []).map((b) => [b.codigo, b.nombre])),
    [filtros],
  );

  /** El año anterior, para las flechas de las tarjetas. */
  const previo = useMemo(
    () => historico.find((h) => h.anio === Number(anio) - 1) || null,
    [historico, anio],
  );
  const actual = useMemo(
    () => historico.find((h) => h.anio === Number(anio)) || null,
    [historico, anio],
  );

  const exportar = async () => {
    setExportando(true);
    setError(null);
    try {
      await exportarReporteResultados({
        datos,
        historico,
        mensual,
        nombresBu,
        anio,
        usuario: usuario?.nombreCompleto || usuario?.nombreUsuario,
      });
    } catch (e) {
      setError(`No se pudo generar el Excel: ${e.message}`);
    } finally {
      setExportando(false);
    }
  };

  const irA = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const d = datos;
  const busOperativas = ["CROCS", "FOAM_DESIGN", "SUELA", "DUAL_COLOR"];
  const busCapacidad = ["CROCS", "SUELA", "FOAM_DESIGN", "DUAL_COLOR", "COMPOUND"];

  const ultima = filtros?.ultimaCarga;

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center">
            <Target className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Resultados</h1>
            <p className="text-sm text-gray-500">
              {ultima?.corte_anio
                ? `Último corte cargado: ${filtros.meses[(ultima.corte_mes || 1) - 1]?.nombre} de ${ultima.corte_anio}`
                : "Facturación, scrap, capacidad, personal, energía, compound y P&L"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {esAdmin && (
            <Link
              to="/resultados/carga"
              className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <Upload className="w-4 h-4" />
              Cargar Excel
            </Link>
          )}
          <button
            onClick={exportar}
            disabled={exportando || !d}
            className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
            title="Descarga lo que está en pantalla, con las gráficas incluidas"
          >
            {exportando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Exportar
          </button>
          <button
            onClick={() => filtros?.anios?.length && setAnio(String(filtros.anios[0].anio))}
            className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            Limpiar
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 text-sm">
          {error}
        </div>
      )}

      {/* Año + navegación entre secciones. Se queda pegado arriba porque la
          página es larga y brincar de sección a sección es lo normal aquí. */}
      <div
        ref={navRef}
        className="sticky top-0 z-20 bg-gray-50/95 backdrop-blur-sm -mx-4 px-4 py-3 border-b border-gray-100"
      >
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={anio}
            onChange={(e) => setAnio(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm font-semibold bg-white"
          >
            {(filtros?.anios || []).map((a) => (
              <option key={a.anio} value={a.anio}>
                {a.anio}
              </option>
            ))}
          </select>
          <div className="flex flex-wrap gap-1.5">
            {SECCIONES.map(([id, nombre]) => (
              <button
                key={id}
                onClick={() => irA(id)}
                className="px-2.5 py-1 rounded-full text-xs font-medium bg-white border border-gray-200 text-gray-600 hover:border-primary/40 hover:text-primary transition-colors"
              >
                {nombre}
              </button>
            ))}
          </div>
        </div>
      </div>

      {cargando && !d ? (
        <div className="flex items-center justify-center py-20 text-gray-400">
          <Loader2 className="w-6 h-6 animate-spin mr-2" />
          Cargando...
        </div>
      ) : (
        d && (
          <>
            {/* Tarjetas del año contra el anterior */}
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
              <Tarjeta
                titulo="Unidades facturadas"
                valor={num(d.facturacion.total.qty)}
                previo={previo?.qty}
                actual={actual?.qty}
                color={AZUL}
              />
              <Tarjeta
                titulo="Facturación"
                valor={`${num(d.facturacion.total.usd / 1e6, 1)} M USD`}
                previo={previo?.usd}
                actual={actual?.usd}
                color={AZUL}
              />
              <Tarjeta
                titulo="Precio por unidad"
                valor={usd(d.facturacion.total.precio, 2)}
                previo={previo?.precio}
                actual={actual?.precio}
                color={VERDE}
              />
              <Tarjeta
                titulo="Scrap"
                valor={pct(d.scrap.total.pct)}
                detalle={`${num(d.scrap.total.rechazo)} pzas`}
                previo={previo?.pctScrap}
                actual={actual?.pctScrap}
                mejorMenos
                color={d.scrap.total.pct > 0.14 ? ROJO : NARANJA}
              />
              <Tarjeta
                titulo="Tiempo de ciclo"
                valor={`${num(d.personal.resumen.ciclo, 1)} min`}
                detalle="por unidad buena"
                previo={previo?.ciclo}
                actual={actual?.ciclo}
                mejorMenos
                color={VERDE}
              />
              <Tarjeta
                titulo="EBIT"
                valor={d.margen ? eur(d.margen.conceptos.find((c) => c.codigo === "mg_ebit")?.total) : "—"}
                detalle={d.margen ? pct(d.margen.conceptos.find((c) => c.codigo === "mg_ebit")?.pctVentas) + " de ventas" : null}
                color={AZUL}
              />
            </div>

            {/* ---------------------------------------------- 1. Facturación */}
            <Seccion
              id="facturacion"
              titulo="Facturación"
              nota="Barras: unidades facturadas por unidad de negocio. Línea: facturación en dólares, en el eje derecho."
            >
              <ResponsiveContainer width="100%" height={340}>
                <ComposedChart data={d.facturacion.serie} margin={{ top: 10, right: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="eje" tick={{ fontSize: 11 }} />
                  <YAxis yAxisId="izq" tick={{ fontSize: 11 }} tickFormatter={corto} />
                  <YAxis yAxisId="der" orientation="right" tick={{ fontSize: 11 }} tickFormatter={corto} />
                  <Tooltip
                    formatter={(v, n) => (String(n).startsWith("USD") ? usd(v) : num(v))}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  {busOperativas.map((bu) => (
                    <Bar
                      key={bu}
                      yAxisId="izq"
                      dataKey={`qty_${bu}`}
                      name={nombresBu[bu] || bu}
                      stackId="q"
                      fill={COLOR_BU[bu]}
                    />
                  ))}
                  <Line
                    yAxisId="der"
                    type="monotone"
                    dataKey="usdTotal"
                    name="USD facturados"
                    stroke="#1f2937"
                    strokeWidth={2.5}
                    dot={{ r: 3 }}
                  />
                </ComposedChart>
              </ResponsiveContainer>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-5">
                {d.facturacion.porBu.map((b) => (
                  <div key={b.bu} className="border border-gray-100 rounded-lg p-3">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-sm" style={{ background: COLOR_BU[b.bu] }} />
                      <span className="text-sm font-medium text-gray-900">
                        {nombresBu[b.bu] || b.bu}
                      </span>
                    </div>
                    <p className="text-lg font-bold text-gray-900 mt-1">{num(b.qty)}</p>
                    <p className="text-xs text-gray-500">
                      {pct(b.pctQty)} de las unidades · {pct(b.pctUsd)} del valor
                    </p>
                    <p className="text-xs text-gray-400">{usd(b.precio, 2)} por unidad</p>
                  </div>
                ))}
              </div>
            </Seccion>

            {/* Comparativo entre años: la gráfica principal del libro */}
            <Seccion
              id="comparativo"
              titulo="Mes a mes, año contra año"
              nota="Es la gráfica que el libro hace con barras agrupadas. En líneas se leen mejor siete años a la vez."
              acciones={
                <select
                  value={serieMensual}
                  onChange={(e) => setSerieMensual(e.target.value)}
                  className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm"
                >
                  {SERIES_MENSUALES.map((s) => (
                    <option key={s.codigo} value={s.codigo}>
                      {s.nombre}
                    </option>
                  ))}
                </select>
              }
            >
              {!mensual ? (
                <p className="text-sm text-gray-400 py-10 text-center">Cargando…</p>
              ) : (
                <ResponsiveContainer width="100%" height={340}>
                  <ComposedChart data={mensual.filas} margin={{ top: 10, right: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="eje" tick={{ fontSize: 11 }} />
                    <YAxis
                      tick={{ fontSize: 11 }}
                      tickFormatter={serieMensual === "scrap" ? pctEje : corto}
                      domain={serieMensual === "precio" ? ["auto", "auto"] : undefined}
                    />
                    <Tooltip
                      formatter={(v) =>
                        serieMensual === "scrap"
                          ? pct(v)
                          : serieMensual === "precio"
                            ? usd(v, 2)
                            : num(v)
                      }
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    {mensual.anios.map((a, i) => (
                      <Line
                        key={a}
                        type="monotone"
                        dataKey={String(a)}
                        name={String(a)}
                        stroke={COLOR_ANIO[i % COLOR_ANIO.length]}
                        strokeWidth={a === Number(anio) ? 3 : 1.75}
                        dot={false}
                        connectNulls
                      />
                    ))}
                  </ComposedChart>
                </ResponsiveContainer>
              )}
            </Seccion>

            {/* -------------------------------------------- 2. Precio unidad */}
            <Seccion
              id="precio"
              titulo="Precio por unidad"
              nota="No está en el libro: sale de dividir la hoja de dólares entre la de unidades. Como viven en hojas distintas, nadie lo grafica."
            >
              <ResponsiveContainer width="100%" height={320}>
                <ComposedChart data={historico} margin={{ top: 10, right: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="anio" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${v.toFixed(1)}`} />
                  <Tooltip formatter={(v) => usd(v, 2)} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  {busOperativas.map((bu) => (
                    <Line
                      key={bu}
                      type="monotone"
                      dataKey={`precio_${bu}`}
                      name={nombresBu[bu] || bu}
                      stroke={COLOR_BU[bu]}
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      connectNulls
                    />
                  ))}
                  <Line
                    type="monotone"
                    dataKey="precio"
                    name="Promedio"
                    stroke="#1f2937"
                    strokeWidth={3}
                    strokeDasharray="5 4"
                    dot={{ r: 3 }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </Seccion>

            {/* --------------------------------------------------- 3. Scrap */}
            <Seccion
              id="scrap"
              titulo="Scrap"
              nota="El mapa reemplaza las cinco hojas de scrap del libro. El total no se lee de 'TOTAL SCRAP': se suma de las cuatro unidades, que da exactamente lo mismo y no puede descuadrarse."
            >
              {/* Ancla propia: la sección ya tiene la suya y el exportador toma
                  el primer SVG de recharts de cada una, así que sin esto el mapa
                  de calor —que no es de recharts— no saldría en el Excel */}
              <div data-grafica="scrap-mapa">
                <MapaCalorScrap
                  celdas={d.scrap.celdas}
                  bus={busOperativas}
                  nombres={nombresBu}
                />
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mt-6">
                {d.scrap.porBu.map((b) => (
                  <div key={b.bu} className="border border-gray-100 rounded-lg p-3">
                    <p className="text-xs text-gray-500">{nombresBu[b.bu] || b.bu}</p>
                    <p className="text-xl font-bold mt-0.5" style={{ color: COLOR_BU[b.bu] }}>
                      {pct(b.pct)}
                    </p>
                    <p className="text-xs text-gray-400">
                      {num(b.rechazo)} de {num(b.producido)}
                    </p>
                  </div>
                ))}
                <div className="border border-gray-200 bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500">Total planta</p>
                  <p className="text-xl font-bold text-gray-900 mt-0.5">{pct(d.scrap.total.pct)}</p>
                  <p className="text-xs text-gray-400">
                    {num(d.scrap.total.rechazo)} de {num(d.scrap.total.producido)}
                  </p>
                </div>
              </div>

              <div className="mt-6">
                <h3 className="text-sm font-semibold text-gray-700 mb-2">
                  Producción y scrap mes a mes
                </h3>
                <ResponsiveContainer width="100%" height={300}>
                  <ComposedChart data={d.scrap.serie} margin={{ top: 10, right: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="eje" tick={{ fontSize: 11 }} />
                    <YAxis yAxisId="izq" tick={{ fontSize: 11 }} tickFormatter={corto} />
                    <YAxis
                      yAxisId="der"
                      orientation="right"
                      tick={{ fontSize: 11 }}
                      tickFormatter={pctEje}
                    />
                    <Tooltip
                      formatter={(v, n) => (String(n).startsWith("%") ? pct(v) : num(v))}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar yAxisId="izq" dataKey="producido" name="Producidas" fill="#cbd5e1" radius={[3, 3, 0, 0]} />
                    <Bar yAxisId="izq" dataKey="rechazo" name="Rechazadas" fill={ROJO} radius={[3, 3, 0, 0]} />
                    <Line
                      yAxisId="der"
                      type="monotone"
                      dataKey="pctTotal"
                      name="% de scrap"
                      stroke="#1f2937"
                      strokeWidth={2.5}
                      dot={{ r: 3 }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </Seccion>

            {/* ----------------------------------------------- 4. Capacidad */}
            <Seccion
              id="capacidad"
              titulo="Uso de capacidad"
              nota="Capacidad comprometida contra la instalada. La línea del 100% es el límite: arriba de ahí se produce por encima de la capacidad nominal."
            >
              <ResponsiveContainer width="100%" height={340}>
                <ComposedChart data={d.capacidad.serie} margin={{ top: 10, right: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="eje" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={pctEje} />
                  <Tooltip formatter={(v) => pct(v)} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  {busCapacidad.map((bu) => (
                    <Bar
                      key={bu}
                      dataKey={`uso_${bu}`}
                      name={nombresBu[bu] || bu}
                      fill={COLOR_BU[bu]}
                      radius={[3, 3, 0, 0]}
                    />
                  ))}
                  <ReferenceLine
                    y={1}
                    stroke={ROJO}
                    strokeDasharray="4 4"
                    label={{ value: "100%", position: "right", fontSize: 11, fill: ROJO }}
                  />
                </ComposedChart>
              </ResponsiveContainer>

              <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mt-5">
                {d.capacidad.porBu.map((b) => (
                  <div key={b.bu} className="border border-gray-100 rounded-lg p-3">
                    <p className="text-xs text-gray-500">{nombresBu[b.bu] || b.bu}</p>
                    <p
                      className="text-xl font-bold mt-0.5"
                      style={{ color: b.pctUso > 1 ? ROJO : b.pctUso > 0.8 ? VERDE : NARANJA }}
                    >
                      {pct(b.pctUso)}
                    </p>
                    <p className="text-xs text-gray-400">
                      {num(b.comprometida, 0)} de {num(b.instalada, 0)} al día
                    </p>
                  </div>
                ))}
              </div>

              {d.carga?.length > 0 && (
                <div className="mt-6">
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">
                    Carga de PO abierta
                  </h3>
                  <p className="text-xs text-gray-400 mb-3">
                    Cuántos días de trabajo tiene comprometidos cada unidad de negocio
                    al corte del archivo.
                  </p>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    {d.carga.map((c) => (
                      <div key={c.bu} className="border border-gray-100 rounded-lg p-3">
                        <p className="text-xs text-gray-500">{c.nombre}</p>
                        <p className="text-xl font-bold text-gray-900 mt-0.5">
                          {num(c.dias, 1)} días
                        </p>
                        <p className="text-xs text-gray-400">{num(c.qty)} unidades</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Seccion>

            {/* ------------------------------------------------ 5. Personal */}
            <Seccion
              id="personal"
              titulo="Personal"
              nota="Barras: plantilla. Líneas: rotación y horas extra, en el eje derecho."
            >
              <ResponsiveContainer width="100%" height={320}>
                <ComposedChart data={d.personal.serie} margin={{ top: 10, right: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="eje" tick={{ fontSize: 11 }} />
                  <YAxis yAxisId="izq" tick={{ fontSize: 11 }} />
                  <YAxis yAxisId="der" orientation="right" tick={{ fontSize: 11 }} tickFormatter={pctEje} />
                  <Tooltip formatter={(v, n) => (String(n).startsWith("%") ? pct(v, 2) : num(v))} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar yAxisId="izq" dataKey="empleados" name="Plantilla" fill={AZUL} radius={[3, 3, 0, 0]} />
                  <Line yAxisId="der" type="monotone" dataKey="rotacion" name="% rotación" stroke={ROJO} strokeWidth={2.5} dot={false} />
                  <Line yAxisId="der" type="monotone" dataKey="pctExtra" name="% horas extra" stroke={NARANJA} strokeWidth={2.5} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>

              <div className="mt-6">
                <h3 className="text-sm font-semibold text-gray-700 mb-1">
                  Tiempo de ciclo
                </h3>
                <p className="text-xs text-gray-400 mb-3">
                  Minutos de mano de obra pagada por unidad buena. Es el indicador que
                  mejor resume el año y en el libro vive en una columna escondida.
                </p>
                <ResponsiveContainer width="100%" height={260}>
                  <ComposedChart data={d.personal.serie} margin={{ top: 10, right: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="eje" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} domain={["auto", "auto"]} />
                    <Tooltip formatter={(v) => `${num(v, 2)} min`} />
                    <Line type="monotone" dataKey="ciclo" name="min / unidad buena" stroke={VERDE} strokeWidth={3} dot={{ r: 3 }} />
                    <ReferenceLine
                      y={d.personal.resumen.ciclo}
                      stroke={GRIS}
                      strokeDasharray="4 4"
                      label={{
                        value: `Año: ${num(d.personal.resumen.ciclo, 2)}`,
                        position: "right",
                        fontSize: 11,
                        fill: GRIS,
                      }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </Seccion>

            {/* ------------------------------------------------- 6. Energía */}
            <Seccion
              id="energia"
              titulo="Energía"
              nota="Barras: consumo en KWh. Líneas: precio del KWh y consumo por unidad buena producida, en el eje derecho."
            >
              <ResponsiveContainer width="100%" height={320}>
                <ComposedChart data={d.energia.serie} margin={{ top: 10, right: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="eje" tick={{ fontSize: 11 }} />
                  <YAxis yAxisId="izq" tick={{ fontSize: 11 }} tickFormatter={corto} />
                  <YAxis yAxisId="der" orientation="right" tick={{ fontSize: 11 }} />
                  <Tooltip
                    formatter={(v, n) =>
                      String(n).includes("KWh") && !String(n).includes("por")
                        ? `${num(v)} KWh`
                        : num(v, 3)
                    }
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar yAxisId="izq" dataKey="kwh" name="KWh" fill="#a8b4c2" radius={[3, 3, 0, 0]} />
                  <Line yAxisId="der" type="monotone" dataKey="eurKwh" name="€ por KWh" stroke={NARANJA} strokeWidth={2.5} dot={false} />
                  <Line yAxisId="der" type="monotone" dataKey="kwhUnidad" name="KWh por unidad" stroke={VERDE} strokeWidth={2.5} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-5">
                <div className="border border-gray-100 rounded-lg p-3">
                  <p className="text-xs text-gray-500">Consumo del año</p>
                  <p className="text-xl font-bold text-gray-900 mt-0.5">{num(d.energia.resumen.kwh)}</p>
                  <p className="text-xs text-gray-400">KWh</p>
                </div>
                <div className="border border-gray-100 rounded-lg p-3">
                  <p className="text-xs text-gray-500">Importe</p>
                  <p className="text-xl font-bold text-gray-900 mt-0.5">{eur(d.energia.resumen.eur)}</p>
                  <p className="text-xs text-gray-400">{num(d.energia.resumen.eurKwh, 3)} € por KWh</p>
                </div>
                <div className="border border-gray-100 rounded-lg p-3">
                  <p className="text-xs text-gray-500">Por unidad buena</p>
                  <p className="text-xl font-bold text-gray-900 mt-0.5">{num(d.energia.resumen.kwhUnidad, 3)}</p>
                  <p className="text-xs text-gray-400">KWh por unidad</p>
                </div>
                <div className="border border-gray-100 rounded-lg p-3">
                  <p className="text-xs text-gray-500">Costo por unidad</p>
                  <p className="text-xl font-bold text-gray-900 mt-0.5">{num(d.energia.resumen.eurUnidad, 3)} €</p>
                  <p className="text-xs text-gray-400">de energía</p>
                </div>
              </div>
            </Seccion>

            {/* ------------------------------------------------ 7. Compound */}
            <Seccion
              id="compound"
              titulo="Compound"
              nota="Toneladas producidas contra el porcentaje de scrap y el de material recuperado."
            >
              <ResponsiveContainer width="100%" height={320}>
                <ComposedChart data={d.compound.serie} margin={{ top: 10, right: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="eje" tick={{ fontSize: 11 }} />
                  <YAxis yAxisId="izq" tick={{ fontSize: 11 }} />
                  <YAxis yAxisId="der" orientation="right" tick={{ fontSize: 11 }} tickFormatter={pctEje} />
                  <Tooltip formatter={(v, n) => (String(n).startsWith("%") ? pct(v, 2) : `${num(v, 2)} ton`)} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar yAxisId="izq" dataKey="producido" name="Producido" fill={VERDE} radius={[3, 3, 0, 0]} />
                  <Bar yAxisId="izq" dataKey="scrap" name="Scrap" fill={ROJO} radius={[3, 3, 0, 0]} />
                  <Line yAxisId="der" type="monotone" dataKey="pctScrap" name="% de scrap" stroke="#1f2937" strokeWidth={2.5} dot={false} />
                  <Line yAxisId="der" type="monotone" dataKey="pctReciclado" name="% recuperado" stroke={AZUL} strokeWidth={2.5} strokeDasharray="5 4" dot={false} />
                </ComposedChart>
              </ResponsiveContainer>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-5">
                <div className="border border-gray-100 rounded-lg p-3">
                  <p className="text-xs text-gray-500">Producido</p>
                  <p className="text-xl font-bold text-gray-900 mt-0.5">{num(d.compound.resumen.producido, 1)}</p>
                  <p className="text-xs text-gray-400">toneladas</p>
                </div>
                <div className="border border-gray-100 rounded-lg p-3">
                  <p className="text-xs text-gray-500">Scrap</p>
                  <p className="text-xl font-bold mt-0.5" style={{ color: ROJO }}>{pct(d.compound.resumen.pctScrap)}</p>
                  <p className="text-xs text-gray-400">{num(d.compound.resumen.scrap, 1)} ton</p>
                </div>
                <div className="border border-gray-100 rounded-lg p-3">
                  <p className="text-xs text-gray-500">Recuperado</p>
                  <p className="text-xl font-bold mt-0.5" style={{ color: VERDE }}>{pct(d.compound.resumen.pctReciclado)}</p>
                  <p className="text-xs text-gray-400">{num(d.compound.resumen.reciclado, 1)} ton</p>
                </div>
                <div className="border border-gray-100 rounded-lg p-3">
                  <p className="text-xs text-gray-500">Costo de disposición</p>
                  <p className="text-xl font-bold text-gray-900 mt-0.5">${num(d.compound.resumen.fee)}</p>
                  <p className="text-xs text-gray-400">MXN en el año</p>
                </div>
              </div>
            </Seccion>

            {/* -------------------------------------------------- 8. Margen */}
            <Seccion
              id="margen"
              titulo="Estado de resultados"
              nota="En euros. El orden de la cascada no es el de la hoja: 'Costos variables' del Excel ya incluye la mano de obra directa, y el margen ENI se calcula antes de restarla."
            >
              {!d.margen ? (
                <p className="text-sm text-gray-400 py-10 text-center">
                  Este año no trae estado de resultados
                </p>
              ) : (
                <>
                  <CascadaMargen cascada={d.margen.cascada} />

                  <div className="mt-6 overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-3 py-2 text-left text-[11px] font-semibold text-gray-500 uppercase">
                            Concepto
                          </th>
                          {d.margen.bus.map((b) => (
                            <th key={b.codigo} className="px-3 py-2 text-right text-[11px] font-semibold text-gray-500 uppercase">
                              {b.nombre}
                            </th>
                          ))}
                          <th className="px-3 py-2 text-right text-[11px] font-semibold text-gray-500 uppercase">
                            Total
                          </th>
                          <th className="px-3 py-2 text-right text-[11px] font-semibold text-gray-500 uppercase">
                            % ventas
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {d.margen.conceptos.map((c) => {
                          const esNivel = ["mg_margen_eni", "mg_margen_finproject", "mg_ebitda", "mg_ebit"].includes(c.codigo);
                          return (
                            <tr key={c.codigo} className={esNivel ? "bg-gray-50 font-semibold" : ""}>
                              <td className="px-3 py-1.5 text-gray-900">{c.nombre}</td>
                              {d.margen.bus.map((b) => (
                                <td key={b.codigo} className="px-3 py-1.5 text-right text-gray-600 tabular-nums">
                                  {c.codigo === "mg_qty_vendida"
                                    ? num(c.valores[b.codigo])
                                    : eur(c.valores[b.codigo])}
                                </td>
                              ))}
                              <td className="px-3 py-1.5 text-right text-gray-900 tabular-nums">
                                {c.codigo === "mg_qty_vendida" ? num(c.total) : eur(c.total)}
                              </td>
                              <td className="px-3 py-1.5 text-right text-gray-400 tabular-nums">
                                {c.codigo === "mg_qty_vendida" ? "—" : pct(c.pctVentas)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </Seccion>

            {/* ----------------------------------------------- 9. Histórico */}
            <Seccion
              id="historico"
              titulo="Siete años de un vistazo"
              nota="Todo sale de los absolutos, así que los porcentajes anuales son correctos: el scrap del año es el rechazo total entre lo producido total, no el promedio de los doce porcentajes mensuales."
            >
              <ResponsiveContainer width="100%" height={320}>
                <ComposedChart data={historico} margin={{ top: 10, right: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="anio" tick={{ fontSize: 11 }} />
                  <YAxis yAxisId="izq" tick={{ fontSize: 11 }} tickFormatter={corto} />
                  <YAxis yAxisId="der" orientation="right" tick={{ fontSize: 11 }} tickFormatter={pctEje} />
                  <Tooltip formatter={(v, n) => (String(n).startsWith("%") ? pct(v) : num(v))} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar yAxisId="izq" dataKey="qty" name="Unidades facturadas" radius={[3, 3, 0, 0]}>
                    {historico.map((h) => (
                      <Cell key={h.anio} fill={h.anio === Number(anio) ? AZUL : "#cbd5e1"} />
                    ))}
                  </Bar>
                  <Line yAxisId="der" type="monotone" dataKey="pctScrap" name="% de scrap" stroke={ROJO} strokeWidth={2.5} dot={{ r: 3 }} connectNulls />
                </ComposedChart>
              </ResponsiveContainer>

              <div className="mt-6 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      {["Año", "Unidades", "USD", "Precio", "% scrap", "Ciclo", "KWh/ud", "Ventas €", "EBITDA €", "EBIT €"].map((h) => (
                        <th key={h} className="px-3 py-2 text-right text-[11px] font-semibold text-gray-500 uppercase first:text-left">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {historico.map((h) => (
                      <tr key={h.anio} className={h.anio === Number(anio) ? "bg-primary/5 font-semibold" : ""}>
                        <td className="px-3 py-1.5 text-gray-900">{h.anio}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums text-gray-600">{num(h.qty)}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums text-gray-600">{num(h.usd / 1e6, 1)}M</td>
                        <td className="px-3 py-1.5 text-right tabular-nums text-gray-600">{usd(h.precio, 2)}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums text-gray-600">{pct(h.pctScrap)}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums text-gray-600">{num(h.ciclo, 1)}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums text-gray-600">{num(h.kwhUnidad, 2)}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums text-gray-600">{h.ventas ? num(h.ventas / 1e6, 1) + "M" : "—"}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums text-gray-600">{h.ebitda ? num(h.ebitda / 1e6, 1) + "M" : "—"}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums text-gray-600">{h.ebit ? num(h.ebit / 1e6, 1) + "M" : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Seccion>
          </>
        )
      )}
    </div>
  );
}
