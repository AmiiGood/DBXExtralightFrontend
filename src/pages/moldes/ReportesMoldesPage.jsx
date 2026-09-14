import { useState, useEffect, useMemo, useCallback } from "react";
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
  Cell,
} from "recharts";
import {
  Boxes,
  RotateCcw,
  Loader2,
  RefreshCw,
  Download,
  Tv,
  AlertTriangle,
  Clock,
  RotateCw,
} from "lucide-react";
import { moldesService } from "../../services/moldes.service";
import ComparativoMoldes from "../../components/moldes/ComparativoMoldes";
import { exportarReporteMoldes } from "../../utils/exportarReporteMoldes";
import { useAuthStore } from "../../stores/auth.store";

/**
 * Reportes de Moldes.
 *
 * Sustituye al Power BI "Reporte Moldes, Cambio de Molde". Mide el tiempo que
 * tarda el área en resolver los tickets que le levantan en osTicket.
 *
 * Dos diferencias con el reporte original, ambas a propósito:
 *
 *   El tema es un filtro, no una constante. El Power BI solo veía "Cambio de
 *   molde"; el área atiende 17 temas distintos.
 *
 *   El número grande es la MEDIANA, no el promedio. El promedio crudo lo
 *   mueven unos cuantos tickets que quedaron olvidados meses: pasa de 37 h en
 *   2024 a 5 h en 2026 sin que el área haya cambiado nada. Se sigue mostrando,
 *   pero abajo y advertido.
 */

const AZUL = "#236093";
const VERDE = "#49a090";
const NARANJA = "#c9761f";
const GRIS = "#94a3b8";

/** Colores de la distribución: entre más tarde, más se calienta la barra. */
const COLOR_RANGO = ["#49a090", "#7bb35f", "#b8b23f", "#d99a2b", "#c9761f", "#b0413e"];

/**
 * El eje de tiempos va en escala logarítmica.
 *
 * La mediana ronda las 3 h mientras que el percentil 90 de un mes malo llega a
 * miles: en escala lineal la mediana queda pegada al eje y no se ve la
 * tendencia, que es justo lo que interesa. Los cortes son las unidades con las
 * que se habla del área — una hora, una jornada, un día, una semana, un mes.
 */
const TICKS_HORAS = [1, 8, 24, 168, 720, 2160];
const PISO_LOG = 0.5;

/**
 * Marcas del eje que caben en el dato.
 *
 * Si se le pasan siempre las seis, recharts estira el eje hasta la más alta y
 * la gráfica se dibuja aplastada en el borde inferior: con datos de 20 horas no
 * tiene caso que el eje llegue a tres meses. Se quedan las que están por debajo
 * del máximo más una encima, para que la línea no toque el techo.
 */
function ticksQueCaben(valores) {
  const max = Math.max(...valores.filter((v) => v != null), 1);
  const dentro = TICKS_HORAS.filter((t) => t <= max);
  const siguiente = TICKS_HORAS.find((t) => t > max);
  return siguiente ? [...dentro, siguiente] : dentro;
}

/**
 * Formatea horas en algo legible.
 *
 * Los tiempos del área van de minutos a semanas, así que un solo formato no
 * sirve: 0.42 h no se lee, y 11403 h tampoco.
 */
function horas(h) {
  if (h == null) return "—";
  const n = Number(h);
  // Un decimal, pero sin el ".0" de los valores redondos: las marcas del eje
  // caen justo en números enteros y "24 h" se lee mejor que "24.0 h".
  const dec = (v) => (Number.isInteger(Number(v.toFixed(1))) ? v.toFixed(0) : v.toFixed(1));
  if (n === 0) return "0";
  if (n < 1) return `${Math.round(n * 60)} min`;
  if (n < 48) return `${dec(n)} h`;
  const dias = n / 24;
  if (dias < 60) return `${dec(dias)} días`;
  return `${dec(dias / 30.44)} meses`;
}

const num = (n) =>
  n == null ? "—" : Number(n).toLocaleString("es-MX", { maximumFractionDigits: 0 });

const fechaCorta = (t) => (t ? String(t).slice(0, 16).replace("T", " ") : "—");

function Tarjeta({ titulo, valor, detalle, color, aviso }) {
  return (
    <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-100">
      <p className="text-sm text-gray-500 flex items-center gap-1.5">
        {titulo}
        {aviso && (
          <span title={aviso}>
            <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
          </span>
        )}
      </p>
      <p className="text-3xl font-bold mt-1" style={{ color: color || "#1f2937" }}>
        {valor}
      </p>
      {detalle && <p className="text-xs text-gray-400 mt-1">{detalle}</p>}
    </div>
  );
}

function TooltipHoras({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-sm">
      <p className="font-semibold text-gray-900 mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} style={{ color: p.color }}>
          {p.name}:{" "}
          <span className="font-medium">
            {p.dataKey === "tickets" ? num(p.value) : horas(p.value)}
          </span>
        </p>
      ))}
    </div>
  );
}

const Select = ({ etiqueta, valor, onChange, children }) => (
  <div>
    <label className="block text-xs font-medium text-gray-500 mb-1">{etiqueta}</label>
    <select
      value={valor}
      onChange={(e) => onChange(e.target.value)}
      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
    >
      {children}
    </select>
  </div>
);

export default function ReportesMoldesPage() {
  const [filtrosDisp, setFiltrosDisp] = useState(null);
  const [datos, setDatos] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [agrupar, setAgrupar] = useState("mes");
  const [sincronizando, setSincronizando] = useState(false);
  const [exportando, setExportando] = useState(false);
  const [comparativo, setComparativo] = useState(null);
  const [recargar, setRecargar] = useState(0);
  const usuario = useAuthStore((s) => s.user);

  const [filtros, setFiltros] = useState({
    temas: [],
    anio: "",
    semestre: "",
    trimestre: "",
    mes: "",
  });

  useEffect(() => {
    moldesService
      .getFiltros()
      .then(setFiltrosDisp)
      .catch((e) => console.error("Error cargando filtros:", e));
  }, []);

  useEffect(() => {
    setLoading(true);
    setError(null);
    moldesService
      .getDashboard(filtros, agrupar)
      .then(setDatos)
      .catch((e) => setError(e.response?.data?.message || e.message))
      .finally(() => setLoading(false));
  }, [filtros, agrupar, recargar]);

  const r = datos?.resumen;

  const toggleTema = (tema) =>
    setFiltros((f) => ({
      ...f,
      temas: f.temas.includes(tema)
        ? f.temas.filter((x) => x !== tema)
        : [...f.temas, tema],
    }));

  const limpiar = () => {
    setFiltros({ temas: [], anio: "", semestre: "", trimestre: "", mes: "" });
    setAgrupar("mes");
  };

  const sincronizar = async () => {
    setSincronizando(true);
    setError(null);
    try {
      await moldesService.sincronizar(false);
      setRecargar((n) => n + 1);
    } catch (e) {
      setError(e.response?.data?.message || e.message);
    } finally {
      setSincronizando(false);
    }
  };

  /**
   * El comparativo se guarda aquí para poder incluirlo en el Excel.
   * Va con useCallback porque el hijo lo tiene en un useEffect: una función
   * nueva en cada render lo haría consultar sin parar.
   */
  const recibirComparativo = useCallback((d) => setComparativo(d), []);

  const exportar = async () => {
    setExportando(true);
    setError(null);
    try {
      await exportarReporteMoldes({
        datos,
        comparativo,
        filtros,
        agrupar,
        usuario: usuario?.nombreCompleto || usuario?.nombreUsuario,
      });
    } catch (e) {
      setError(`No se pudo generar el Excel: ${e.message}`);
    } finally {
      setExportando(false);
    }
  };

  /**
   * Enlace al modo TV, arrastrando el tema que esté filtrado.
   *
   * Así quien deja la pantalla puesta ve lo mismo que estaba mirando, sin
   * tener que armar la URL a mano.
   */
  const enlaceTv = useMemo(() => {
    const p = new URLSearchParams({ periodo: "mes", rotacion: "20", refresco: "5" });
    if (filtros.temas.length) p.set("tema", filtros.temas.join(","));
    return `/moldes/tv?${p}`;
  }, [filtros.temas]);

  /** Años con datos, del más reciente al más viejo. */
  const aniosDisponibles = useMemo(
    () => (filtrosDisp?.anios || []).map((a) => a.anio),
    [filtrosDisp],
  );

  /** Los temas más pesados primero; el resto cabe en el mismo bloque. */
  const temasOrdenados = useMemo(
    () => filtrosDisp?.temas || [],
    [filtrosDisp],
  );

  /**
   * La escala logarítmica no admite ceros, y un periodo con muy pocos tickets
   * puede dar una mediana de minutos. Se levanta al piso de la escala para que
   * el punto se dibuje en el borde en vez de romper la gráfica; el tooltip
   * sigue mostrando el valor real.
   */
  const serieGrafica = useMemo(
    () =>
      (datos?.serie || []).map((s) => ({
        ...s,
        mediana: s.mediana == null ? null : Math.max(s.mediana, PISO_LOG),
        p90: s.p90 == null ? null : Math.max(s.p90, PISO_LOG),
      })),
    [datos],
  );

  const ticksEje = useMemo(
    () => ticksQueCaben(serieGrafica.flatMap((s) => [s.mediana, s.p90])),
    [serieGrafica],
  );

  // Solo se grafican los temas con suficientes tickets cerrados para que la
  // mediana signifique algo. Con 3 o 4 tickets el número es ruido.
  const porTemaGrafica = useMemo(
    () => (datos?.porTema || []).filter((t) => t.cerrados >= 30).slice(0, 12),
    [datos],
  );

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center">
            <Boxes className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Moldes</h1>
            <p className="text-sm text-gray-500">
              Tiempo de atención de los tickets del área
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {datos?.sincronizacion && (
            <span className="text-xs text-gray-400 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              Datos al {fechaCorta(datos.sincronizacion.corte)}
            </span>
          )}
          <button
            onClick={sincronizar}
            disabled={sincronizando}
            title="Trae de osTicket los tickets nuevos y los que cambiaron"
            className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
          >
            <RefreshCw
              className={`w-4 h-4 ${sincronizando ? "animate-spin" : ""}`}
            />
            Actualizar
          </button>
          <a
            href={enlaceTv}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            title="Abre el tablero para pantallas de piso en otra pestaña"
          >
            <Tv className="w-4 h-4" />
            Modo TV
          </a>
          <button
            onClick={exportar}
            disabled={exportando || !datos}
            className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
            title="Descarga lo que está en pantalla, con las gráficas incluidas"
          >
            {exportando ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            Exportar
          </button>
          <button
            onClick={limpiar}
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

      {/* Filtros */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 space-y-4">
        <div>
          <p className="text-xs font-medium text-gray-500 mb-2">
            Tema
            <span className="ml-2 font-normal text-gray-400">
              {filtros.temas.length === 0
                ? "todos los del área"
                : `${filtros.temas.length} seleccionado${filtros.temas.length > 1 ? "s" : ""}`}
            </span>
          </p>
          <div className="flex flex-wrap gap-2">
            {temasOrdenados.map((t) => {
              const activo = filtros.temas.includes(t.tema);
              return (
                <button
                  key={t.tema}
                  onClick={() => toggleTema(t.tema)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                    activo
                      ? "bg-primary text-white border-primary"
                      : "bg-white text-gray-600 border-gray-200 hover:border-primary/40"
                  }`}
                >
                  {t.temaCorto}
                  <span className={activo ? "opacity-70" : "text-gray-400"}>
                    {" "}
                    · {num(t.tickets)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <Select
            etiqueta="Año"
            valor={filtros.anio}
            onChange={(v) => setFiltros((f) => ({ ...f, anio: v }))}
          >
            <option value="">Todos</option>
            {(filtrosDisp?.anios || []).map((a) => (
              <option key={a.anio} value={a.anio}>
                {a.anio}
              </option>
            ))}
          </Select>
          <Select
            etiqueta="Semestre"
            valor={filtros.semestre}
            onChange={(v) => setFiltros((f) => ({ ...f, semestre: v }))}
          >
            <option value="">Todos</option>
            <option value="1">S1 (ene-jun)</option>
            <option value="2">S2 (jul-dic)</option>
          </Select>
          <Select
            etiqueta="Trimestre"
            valor={filtros.trimestre}
            onChange={(v) => setFiltros((f) => ({ ...f, trimestre: v }))}
          >
            <option value="">Todos</option>
            {[1, 2, 3, 4].map((t) => (
              <option key={t} value={t}>
                T{t}
              </option>
            ))}
          </Select>
          <Select
            etiqueta="Mes"
            valor={filtros.mes}
            onChange={(v) => setFiltros((f) => ({ ...f, mes: v }))}
          >
            <option value="">Todos</option>
            {(filtrosDisp?.meses || []).map((m) => (
              <option key={m.numero} value={m.numero}>
                {m.nombre}
              </option>
            ))}
          </Select>
          <Select etiqueta="Agrupar por" valor={agrupar} onChange={setAgrupar}>
            <option value="anio">Año</option>
            <option value="mes">Mes</option>
            <option value="semana">Semana</option>
            <option value="fecha">Día</option>
          </Select>
        </div>
      </div>

      {loading && !datos ? (
        <div className="flex items-center justify-center py-20 text-gray-400">
          <Loader2 className="w-6 h-6 animate-spin mr-2" />
          Cargando...
        </div>
      ) : (
        datos && (
          <>
            {/* Tarjetas */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
              <Tarjeta
                titulo="Tiempo típico de atención"
                valor={horas(r.medianaHoras)}
                detalle="Mediana: la mitad se resuelve antes"
                color={VERDE}
              />
              <Tarjeta
                titulo="9 de cada 10, antes de"
                valor={horas(r.p90Horas)}
                detalle="Percentil 90"
                color={AZUL}
              />
              <Tarjeta
                titulo="Tickets"
                valor={num(r.tickets)}
                detalle={`${num(r.cerrados)} cerrados · ${num(r.reabiertos)} reabiertos`}
              />
              <Tarjeta
                titulo="Sin cerrar"
                valor={num(r.abiertos)}
                detalle={
                  r.ultimoTicket ? `Último: ${fechaCorta(r.ultimoTicket)}` : null
                }
                color={r.abiertos > 0 ? NARANJA : undefined}
              />
              <Tarjeta
                titulo="Promedio"
                valor={horas(r.mediaHoras)}
                detalle={`Máximo: ${horas(r.maximoHoras)}`}
                color={GRIS}
                aviso={
                  "El promedio lo distorsionan unos pocos tickets que quedaron " +
                  "abiertos mucho tiempo. Para seguir la tendencia del área use " +
                  "la mediana."
                }
              />
            </div>

            {/* Evolución */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <h2 className="font-semibold text-gray-900">
                Evolución del tiempo de atención
              </h2>
              <p className="text-xs text-gray-400 mb-4">
                Barras: tickets atendidos. Líneas: tiempo de resolución, en
                escala logarítmica.
              </p>
              <div data-grafica="serie">
              <ResponsiveContainer width="100%" height={320}>
                <ComposedChart data={serieGrafica}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis
                    dataKey="etiqueta"
                    tick={{ fontSize: 11 }}
                    angle={-30}
                    textAnchor="end"
                    height={70}
                  />
                  <YAxis yAxisId="izq" tick={{ fontSize: 11 }} />
                  <YAxis
                    yAxisId="der"
                    orientation="right"
                    scale="log"
                    domain={[PISO_LOG, ticksEje[ticksEje.length - 1]]}
                    allowDataOverflow
                    ticks={ticksEje}
                    tick={{ fontSize: 11 }}
                    tickFormatter={horas}
                  />
                  <Tooltip content={<TooltipHoras />} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar
                    yAxisId="izq"
                    dataKey="tickets"
                    name="Tickets"
                    fill="#dbeafe"
                    radius={[3, 3, 0, 0]}
                  />
                  <Line
                    yAxisId="der"
                    type="monotone"
                    dataKey="mediana"
                    name="Mediana"
                    stroke={VERDE}
                    strokeWidth={2.5}
                    dot={{ r: 3 }}
                  />
                  <Line
                    yAxisId="der"
                    type="monotone"
                    dataKey="p90"
                    name="Percentil 90"
                    stroke={AZUL}
                    strokeWidth={2}
                    strokeDasharray="5 4"
                    dot={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Distribución */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                <h2 className="font-semibold text-gray-900">
                  Cuánto tardan los tickets
                </h2>
                <p className="text-xs text-gray-400 mb-4">
                  Solo tickets cerrados
                </p>
                <div data-grafica="distribucion">
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart
                    data={datos.distribucion}
                    layout="vertical"
                    margin={{ left: 20 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis
                      type="category"
                      dataKey="rango"
                      width={100}
                      tick={{ fontSize: 11 }}
                    />
                    <Tooltip
                      formatter={(v, n, p) => [
                        `${num(v)} tickets (${p.payload.porcentaje.toFixed(1)}%)`,
                        "Tickets",
                      ]}
                    />
                    <Bar dataKey="tickets" radius={[0, 3, 3, 0]}>
                      {datos.distribucion.map((_, i) => (
                        <Cell key={i} fill={COLOR_RANGO[i]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                </div>
              </div>

              {/* Por tema */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                <h2 className="font-semibold text-gray-900">Tiempo por tema</h2>
                <p className="text-xs text-gray-400 mb-4">
                  Temas con al menos 30 tickets cerrados
                </p>
                <div data-grafica="temas">
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart
                    data={porTemaGrafica}
                    layout="vertical"
                    margin={{ left: 30 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis
                      type="number"
                      tick={{ fontSize: 11 }}
                      tickFormatter={(v) => `${v}h`}
                    />
                    <YAxis
                      type="category"
                      dataKey="temaCorto"
                      width={120}
                      tick={{ fontSize: 11 }}
                    />
                    <Tooltip
                      formatter={(v, n, p) => [
                        `${horas(v)} · ${num(p.payload.tickets)} tickets`,
                        "Mediana",
                      ]}
                    />
                    <Bar dataKey="mediana" fill={VERDE} radius={[0, 3, 3, 0]} />
                  </BarChart>
                </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Comparativo entre periodos */}
            {aniosDisponibles.length > 0 && (
              <ComparativoMoldes
                anios={aniosDisponibles}
                temas={filtros.temas}
                formatoHoras={horas}
                onDatos={recibirComparativo}
              />
            )}

            {/* Detalle por tema */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-5 pb-3">
                <h2 className="font-semibold text-gray-900">Detalle por tema</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
                    <tr>
                      <th className="text-left px-5 py-2.5 font-medium">Tema</th>
                      <th className="text-right px-5 py-2.5 font-medium">Tickets</th>
                      <th className="text-right px-5 py-2.5 font-medium">Sin cerrar</th>
                      <th className="text-right px-5 py-2.5 font-medium">Mediana</th>
                      <th className="text-right px-5 py-2.5 font-medium">P90</th>
                      <th className="text-right px-5 py-2.5 font-medium">Promedio</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {(datos.porTema || []).map((t) => (
                      <tr key={t.tema} className="hover:bg-gray-50">
                        <td className="px-5 py-2.5 text-gray-900">{t.temaCorto}</td>
                        <td className="px-5 py-2.5 text-right">{num(t.tickets)}</td>
                        <td className="px-5 py-2.5 text-right text-gray-400">
                          {num(t.tickets - t.cerrados)}
                        </td>
                        <td className="px-5 py-2.5 text-right font-medium">
                          {horas(t.mediana)}
                        </td>
                        <td className="px-5 py-2.5 text-right">{horas(t.p90)}</td>
                        <td className="px-5 py-2.5 text-right text-gray-400">
                          {horas(t.media)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Tickets más largos */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-5 pb-3">
                <h2 className="font-semibold text-gray-900">
                  Los tickets que más tardaron
                </h2>
                <p className="text-xs text-gray-400 mt-1">
                  Son los que distorsionan el promedio. Suelen ser tickets que se
                  quedaron abiertos y se cerraron en lote tiempo después. Los
                  marcados como <strong>reabierto</strong> son otra cosa: se
                  atendieron rápido, se reabrieron meses más tarde y osTicket
                  solo guarda la última fecha de cierre.
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
                    <tr>
                      <th className="text-left px-5 py-2.5 font-medium">Ticket</th>
                      <th className="text-left px-5 py-2.5 font-medium">Tema</th>
                      <th className="text-left px-5 py-2.5 font-medium">Creado</th>
                      <th className="text-left px-5 py-2.5 font-medium">Cerrado</th>
                      <th className="text-right px-5 py-2.5 font-medium">Tardó</th>
                      <th className="text-right px-5 py-2.5 font-medium">
                        Tras reabrir
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {(datos.masLargos || []).map((m) => (
                      <tr key={m.numero} className="hover:bg-gray-50">
                        <td className="px-5 py-2.5 font-mono text-xs text-gray-500">
                          {m.numero}
                        </td>
                        <td className="px-5 py-2.5">
                          {m.tema}
                          {m.reabierto && (
                            <span
                              className="ml-2 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-violet-50 text-violet-700 border border-violet-200"
                              title={`Reabierto el ${fechaCorta(m.reabierto)}. El tiempo total se mide desde la creación original, no desde la reapertura.`}
                            >
                              <RotateCw className="w-3 h-3" />
                              reabierto
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-2.5 text-gray-500">
                          {fechaCorta(m.creado)}
                        </td>
                        <td className="px-5 py-2.5 text-gray-500">
                          {fechaCorta(m.cerrado)}
                        </td>
                        {/* El total se atenúa cuando hubo reapertura: sigue
                            siendo el dato que usa el reporte, pero no mide
                            trabajo continuo y no debe leerse como tal. */}
                        <td
                          className={`px-5 py-2.5 text-right font-medium ${
                            m.reabierto ? "text-gray-400" : "text-amber-700"
                          }`}
                        >
                          {horas(m.horas)}
                        </td>
                        <td className="px-5 py-2.5 text-right">
                          {m.horasTrasReabrir == null ? (
                            <span className="text-gray-300">—</span>
                          ) : (
                            <span className="font-medium text-violet-700">
                              {horas(m.horasTrasReabrir)}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )
      )}
    </div>
  );
}
