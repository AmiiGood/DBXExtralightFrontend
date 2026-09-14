import { useState, useEffect, useMemo } from "react";
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
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
} from "recharts";
import { Factory, RotateCcw, Download, Loader2, Tv } from "lucide-react";
import { inyeccionService } from "../../services/inyeccion.service";
import ComparativoPeriodos from "../../components/produccion/ComparativoPeriodos";
import { exportarReporteInyeccion } from "../../utils/exportarReporteInyeccion";
import { useAuthStore } from "../../stores/auth.store";

/**
 * Reportes de Producción Inyección.
 *
 * Reproduce las páginas "Inj" e "Inj 2" del Power BI:
 *   Inj    tarjetas de %Scrap por BU + combo Producción/Scrap/%Scrap por periodo
 *   Inj 2  Producción y %Scrap por máquina + Producción por BU
 *
 * %Scrap = scrap / producción, igual que la medida DAX del reporte original.
 */

const COLOR_BU = {
  "Crocs Unfin": "#236093",
  "Crocs Strap": "#2d7ab8",
  Suela: "#95b849",
  Almohada: "#49a090",
  "Dual Color": "#c9761f",
};

/**
 * Una tarjeta por unidad de negocio. Se conservan los nombres del Power BI
 * (Outsole, Technical Item) salvo el de Crocs: allá se llama "% Scrap Crocs"
 * pero mide solo Unfin, así que aquí se nombra "Crocs Unfin" y se agrega Strap,
 * que en el reporte original no tiene tarjeta.
 *
 * Las imágenes viven en /public. Las de Crocs, Dual Color, Suela y Almohada son
 * las mismas del Power BI; la del strap se agregó después.
 *
 * No hay total: cada BU es un componente distinto y no se suman entre sí.
 */
const TARJETAS = [
  { titulo: "% Scrap Crocs Unfin", bu: "Crocs Unfin", imagen: "/CROCS.png" },
  { titulo: "% Scrap Crocs Strap", bu: "Crocs Strap", imagen: "/STRAP.webp" },
  { titulo: "% Scrap Dual Color", bu: "Dual Color", imagen: "/DUALCOLOR.png" },
  { titulo: "% Scrap Outsole", bu: "Suela", imagen: "/SUELA.png" },
  { titulo: "% Scrap Technical Item", bu: "Almohada", imagen: "/ALMOHADA.png" },
];

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

const num = (n) =>
  n == null ? "—" : Number(n).toLocaleString("es-MX", { maximumFractionDigits: 0 });
const pct = (n) => (n == null ? "—" : `${Number(n).toFixed(2)}%`);

function Tarjeta({ titulo, valor, detalle, color, imagen }) {
  return (
    <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-100">
      <div className="flex items-center gap-3">
        {/* Los datos mandan: se quedan a la izquierda y se llevan el espacio
            sobrante. La foto es acompañamiento y no encoge el número. */}
        <div className="min-w-0 flex-1">
          <p className="text-sm text-gray-500 truncate" title={titulo}>
            {titulo}
          </p>
          <p className="text-3xl font-bold mt-1" style={{ color }}>
            {valor}
          </p>
          {detalle && <p className="text-xs text-gray-400 mt-1">{detalle}</p>}
        </div>
        {imagen && (
          <img
            src={imagen}
            alt=""
            // Decorativa: si el archivo no está, la tarjeta sigue sirviendo
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
            className="h-16 w-24 object-contain flex-shrink-0"
          />
        )}
      </div>
    </div>
  );
}

function TooltipPersonalizado({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-sm">
      <p className="font-semibold text-gray-900 mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} style={{ color: p.color }}>
          {p.name}:{" "}
          <span className="font-medium">
            {String(p.dataKey).startsWith("pct") ? pct(p.value) : num(p.value)}
          </span>
        </p>
      ))}
    </div>
  );
}

export default function ReportesInyeccionPage() {
  const [filtrosDisp, setFiltrosDisp] = useState(null);
  const [datos, setDatos] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [agrupar, setAgrupar] = useState("mes");
  const [comparativo, setComparativo] = useState(null);
  const [exportando, setExportando] = useState(false);
  const usuario = useAuthStore((s) => s.user);
  const [filtros, setFiltros] = useState({
    anio: "",
    semestre: "",
    trimestre: "",
    mes: "",
    semana: "",
    bu: [],
  });

  useEffect(() => {
    inyeccionService
      .getFiltros()
      .then(setFiltrosDisp)
      .catch((e) => console.error("Error cargando filtros:", e));
  }, []);

  useEffect(() => {
    setLoading(true);
    setError(null);
    inyeccionService
      .getDashboard(filtros, agrupar)
      .then(setDatos)
      .catch((e) => setError(e.response?.data?.message || e.message))
      .finally(() => setLoading(false));
  }, [filtros, agrupar]);

  const anios = useMemo(
    () => [...new Set(filtrosDisp?.periodos.map((p) => p.anio) || [])].sort((a, b) => b - a),
    [filtrosDisp],
  );
  const semanas = useMemo(() => {
    const p = filtrosDisp?.periodos || [];
    const f = filtros.anio ? p.filter((x) => x.anio === Number(filtros.anio)) : p;
    return [...new Set(f.map((x) => x.semana))].sort((a, b) => a - b);
  }, [filtrosDisp, filtros.anio]);

  const busActivas = useMemo(
    () => (datos?.porBu || []).filter((b) => b.bu).map((b) => b.bu),
    [datos],
  );

  /**
   * La serie viene larga (una fila por periodo y BU); se pivotea a ancha.
   *
   * Cada BU queda en su propia columna de producción y su propio %Scrap. No se
   * calcula un total del periodo a propósito: sumar unfin, strap, suela y
   * almohada no da una cantidad con significado.
   */
  const serieAncha = useMemo(() => {
    if (!datos?.serie) return [];
    const mapa = new Map();
    for (const r of datos.serie) {
      if (!r.bu) continue;
      if (!mapa.has(r.periodo)) {
        mapa.set(r.periodo, { periodo: r.periodo, etiqueta: r.etiqueta });
      }
      const fila = mapa.get(r.periodo);
      fila[r.bu] = r.produccion || 0;
      fila[`pct__${r.bu}`] = r.pct_scrap;
    }
    return [...mapa.values()].sort((a, b) => a.periodo.localeCompare(b.periodo));
  }, [datos]);

  const porBuGrafica = useMemo(
    () => (datos?.porBu || []).filter((b) => b.bu && b.produccion > 0),
    [datos],
  );

  const limpiar = () => {
    setFiltros({ anio: "", semestre: "", trimestre: "", mes: "", semana: "", bu: [] });
    setAgrupar("mes");
  };

  const exportar = async () => {
    setExportando(true);
    setError(null);
    try {
      await exportarReporteInyeccion({
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

  const toggleBu = (bu) =>
    setFiltros((f) => ({
      ...f,
      bu: f.bu.includes(bu) ? f.bu.filter((x) => x !== bu) : [...f.bu, bu],
    }));

  const t = datos?.totales;

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center">
            <Factory className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Producción Inyección</h1>
            <p className="text-sm text-gray-500">
              {t?.desde
                ? `${String(t.desde).slice(0, 10)} al ${String(t.hasta).slice(0, 10)} · ` +
                  `${num(t.registros)} registros` +
                  (t.registros_rezago
                    ? ` (${num(t.registros_rezago)} de rezago)`
                    : "")
                : "Cargando periodo..."}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="/produccion/tv?periodo=ultimo&rotacion=20&refresco=5"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            title="Abre el tablero para pantallas de piso en otra pestaña"
          >
            <Tv className="w-4 h-4" />
            Modo TV
          </a>
          <button
            onClick={limpiar}
            className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            Limpiar filtros
          </button>
          <button
            onClick={exportar}
            disabled={exportando || loading || !datos}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary-dark disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            title="Genera un Excel con lo que está en pantalla, respetando los filtros"
          >
            {exportando ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            Exportar Excel
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Año</label>
            <select
              value={filtros.anio}
              onChange={(e) => setFiltros({ ...filtros, anio: e.target.value })}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm min-w-28"
            >
              <option value="">Todos</option>
              {anios.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Semestre</label>
            <select
              value={filtros.semestre}
              onChange={(e) => setFiltros({ ...filtros, semestre: e.target.value })}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm min-w-32"
            >
              <option value="">Todos</option>
              <option value="1">S1 (ene–jun)</option>
              <option value="2">S2 (jul–dic)</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Trimestre</label>
            <select
              value={filtros.trimestre}
              onChange={(e) => setFiltros({ ...filtros, trimestre: e.target.value })}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm min-w-28"
            >
              <option value="">Todos</option>
              {[1, 2, 3, 4].map((n) => (
                <option key={n} value={n}>T{n}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Mes</label>
            <select
              value={filtros.mes}
              onChange={(e) => setFiltros({ ...filtros, mes: e.target.value })}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm min-w-32"
            >
              <option value="">Todos</option>
              {MESES.map((m, i) => (
                <option key={m} value={i + 1}>{m}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Semana</label>
            <select
              value={filtros.semana}
              onChange={(e) => setFiltros({ ...filtros, semana: e.target.value })}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm min-w-28"
            >
              <option value="">Todas</option>
              {semanas.map((s) => (
                <option key={s} value={s}>Semana {s}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Ver por</label>
            <select
              value={agrupar}
              onChange={(e) => setAgrupar(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm min-w-28"
            >
              <option value="anio">Año</option>
              <option value="semestre">Semestre</option>
              <option value="trimestre">Trimestre</option>
              <option value="mes">Mes</option>
              <option value="semana">Semana</option>
              <option value="fecha">Día</option>
            </select>
          </div>
          <div className="flex-1 min-w-64">
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Unidad de negocio
            </label>
            <div className="flex flex-wrap gap-2">
              {(filtrosDisp?.unidadesNegocio || []).map(({ bu }) => {
                const activo = filtros.bu.includes(bu);
                return (
                  <button
                    key={bu}
                    onClick={() => toggleBu(bu)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                      activo
                        ? "text-white border-transparent"
                        : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                    }`}
                    style={activo ? { backgroundColor: COLOR_BU[bu] || "#236093" } : undefined}
                  >
                    {bu}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm">
          {error}
        </div>
      )}

      {/* %Scrap por unidad de negocio. Sin total: no son sumables entre sí. */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {TARJETAS.map(({ titulo, bu, imagen }) => {
          const d = datos?.porBu?.find((x) => x.bu === bu);
          return (
            <Tarjeta
              key={bu}
              titulo={titulo}
              valor={loading ? "..." : pct(d?.pct_scrap)}
              detalle={d ? `${num(d.produccion)} piezas producidas` : "sin datos"}
              color={COLOR_BU[bu]}
              imagen={imagen}
            />
          );
        })}
      </div>

      {/* Inj: Producción y Scrap por periodo */}
      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
        <h3 className="text-lg font-semibold text-gray-900 mb-1">
          Producción y Scrap por unidad de negocio
        </h3>
        <p className="text-xs text-gray-400 mb-3">
          Barras: piezas producidas. Línea punteada: % Scrap de esa misma BU
        </p>
        {loading ? (
          <p className="text-gray-500 py-20 text-center">Cargando...</p>
        ) : serieAncha.length === 0 ? (
          <p className="text-gray-500 py-20 text-center">
            No hay datos para los filtros seleccionados
          </p>
        ) : (
          // El atributo data-grafica lo usa la exportación a Excel para
          // encontrar el SVG y convertirlo a imagen.
          <div data-grafica="serie">
          <ResponsiveContainer width="100%" height={360}>
            <ComposedChart data={serieAncha} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="etiqueta" tick={{ fontSize: 12 }} />
              <YAxis
                yAxisId="izq"
                tick={{ fontSize: 12 }}
                tickFormatter={(v) => (v >= 1000 ? `${v / 1000}k` : v)}
              />
              <YAxis
                yAxisId="der"
                orientation="right"
                tick={{ fontSize: 12 }}
                tickFormatter={(v) => `${v}%`}
              />
              <Tooltip content={<TooltipPersonalizado />} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {busActivas.map((bu) => (
                <Bar
                  key={bu}
                  yAxisId="izq"
                  dataKey={bu}
                  name={bu}
                  fill={COLOR_BU[bu] || "#9ca3af"}
                />
              ))}
              {busActivas.map((bu) => (
                <Line
                  key={`pct-${bu}`}
                  yAxisId="der"
                  type="monotone"
                  dataKey={`pct__${bu}`}
                  name={`% Scrap ${bu}`}
                  stroke={COLOR_BU[bu] || "#9ca3af"}
                  strokeWidth={2}
                  strokeDasharray="4 3"
                  dot={false}
                />
              ))}
            </ComposedChart>
          </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Inj 2: por máquina */}
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 lg:col-span-2">
          <h3 className="text-lg font-semibold text-gray-900 mb-1">
            Producción y % Scrap por máquina
          </h3>
          <p className="text-xs text-gray-400 mb-4">
            No incluye el rezago, que no tiene máquina asignada
          </p>
          {loading ? (
            <p className="text-gray-500 py-20 text-center">Cargando...</p>
          ) : (
            <div data-grafica="maquinas">
            <ResponsiveContainer width="100%" height={340}>
              <ComposedChart
                data={datos?.porMaquina || []}
                margin={{ top: 8, right: 16, bottom: 8, left: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="maquina" tick={{ fontSize: 11 }} interval={0} angle={-45} height={60} textAnchor="end" />
                <YAxis
                  yAxisId="izq"
                  tick={{ fontSize: 12 }}
                  tickFormatter={(v) => (v >= 1000 ? `${v / 1000}k` : v)}
                />
                <YAxis
                  yAxisId="der"
                  orientation="right"
                  tick={{ fontSize: 12 }}
                  tickFormatter={(v) => `${v}%`}
                />
                <Tooltip content={<TooltipPersonalizado />} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar yAxisId="izq" dataKey="produccion" name="Producción" fill="#236093" />
                <Line
                  yAxisId="der"
                  type="monotone"
                  dataKey="pct_scrap"
                  name="% Scrap"
                  stroke="#c9761f"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Inj 2: producción por BU */}
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900 mb-1">
            Producción por BU
          </h3>
          <p className="text-xs text-gray-400 mb-3">
            Cada BU es un componente distinto; no son volúmenes comparables
            entre sí
          </p>
          {loading ? (
            <p className="text-gray-500 py-20 text-center">Cargando...</p>
          ) : (
            <>
              <div data-grafica="bu">
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie
                    data={porBuGrafica}
                    dataKey="produccion"
                    nameKey="bu"
                    innerRadius={55}
                    outerRadius={95}
                    paddingAngle={2}
                  >
                    {porBuGrafica.map((e) => (
                      <Cell key={e.bu} fill={COLOR_BU[e.bu] || "#9ca3af"} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => num(v)} />
                </PieChart>
              </ResponsiveContainer>
              </div>
              <div className="space-y-2 mt-2">
                {porBuGrafica.map((e) => (
                  <div key={e.bu} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="w-3 h-3 rounded-sm flex-shrink-0"
                        style={{ backgroundColor: COLOR_BU[e.bu] || "#9ca3af" }}
                      />
                      <span className="text-gray-600 truncate">{e.bu}</span>
                    </div>
                    <span className="font-medium text-gray-900">{num(e.produccion)}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Comparativo entre periodos */}
      {anios.length > 0 && (
        <ComparativoPeriodos
          anios={anios}
          colorBu={COLOR_BU}
          buFiltradas={filtros.bu}
          onDatos={setComparativo}
        />
      )}

      {/* Detalle por BU */}
      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Detalle por unidad de negocio
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left py-2 text-xs font-semibold text-gray-500 uppercase">BU</th>
                <th className="text-right py-2 text-xs font-semibold text-gray-500 uppercase">Registros</th>
                <th className="text-right py-2 text-xs font-semibold text-gray-500 uppercase">Producción</th>
                <th className="text-right py-2 text-xs font-semibold text-gray-500 uppercase">Scrap</th>
                <th className="text-right py-2 text-xs font-semibold text-gray-500 uppercase">% Scrap</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {(datos?.porBu || []).map((r) => (
                <tr key={r.bu || "sin"}>
                  <td className="py-2 text-sm text-gray-900">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-3 h-3 rounded-sm"
                        style={{ backgroundColor: COLOR_BU[r.bu] || "#d1d5db" }}
                      />
                      {r.bu || "Sin clasificar"}
                    </div>
                  </td>
                  <td className="py-2 text-sm text-gray-500 text-right">{num(r.registros)}</td>
                  <td className="py-2 text-sm text-gray-900 text-right">{num(r.produccion)}</td>
                  <td className="py-2 text-sm text-gray-900 text-right">{num(r.scrap)}</td>
                  <td className="py-2 text-sm font-medium text-right" style={{ color: COLOR_BU[r.bu] }}>
                    {pct(r.pct_scrap)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
