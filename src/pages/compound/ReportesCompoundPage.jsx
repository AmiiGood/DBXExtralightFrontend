import { useState, useEffect, useMemo } from "react";
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
  Cell,
  ReferenceLine,
} from "recharts";
import {
  FlaskConical,
  RotateCcw,
  Loader2,
  AlertTriangle,
  Info,
  Tv,
  Download,
} from "lucide-react";
import { compoundService } from "../../services/compound.service";
import { exportarReporteCompuestos } from "../../utils/exportarReporteCompuestos";
import { useAuthStore } from "../../stores/auth.store";

/**
 * Reportes de Compuestos.
 *
 * El área se llama "Compuestos" en pantalla; los identificadores internos
 * (ruta, tablas comp_*, archivos) se quedaron en "compound" a propósito, para
 * no reasignar permisos ni renombrar media docena de archivos sin ganar nada.
 *
 * Sustituye las dos páginas del .pbix Compound y agrega lo que el Excel ya
 * traía sin graficar: el tiempo muerto abierto por causa. Tres causas explican
 * el 89% del paro, y ahí está lo único accionable del área.
 *
 * Dos correcciones respecto al Power BI, ambas visibles en pantalla:
 *
 *   Lo que el .pbix llama "%Scrap" no es scrap. La columna "Kg PERDIDOS" del
 *   Excel vale producción − meta, con el signo al revés del nombre: da +223,972
 *   kg, o sea 5.8% POR ENCIMA de la meta. Aquí se llama "kg sobre meta".
 *
 *   La meta de reciclado no es una sola. Crocs pasó de 5% a 8% en 2024, Suela
 *   va en 5% y Producto Técnico en 2%. Cada BU se compara contra la suya.
 */

const AZUL = "#236093";
const VERDE = "#49a090";
const NARANJA = "#c9761f";
const ROJO = "#b0413e";
const GRIS = "#94a3b8";

/**
 * Un color por causa de paro.
 *
 * Los tres primeros son los que importan (89% del paro) y llevan tonos
 * fuertes; el resto va en grises para que no compitan visualmente.
 */
const COLOR_CAUSA = {
  CC: "#c9761f",
  PLAN: "#236093",
  TMM: "#49a090",
  AM: "#8fa3b8",
  FT: "#a8b4c2",
  FP: "#c2cbd6",
  LH: "#dde2e8",
};

const COLOR_BU = {
  CROCS: "#236093",
  SUELA: "#95b849",
  "PRODUCTO TÉCNICO": "#49a090",
};

const num = (n) =>
  n == null ? "—" : Number(n).toLocaleString("es-MX", { maximumFractionDigits: 0 });
const dec = (n, d = 1) => (n == null ? "—" : Number(n).toFixed(d));
const pct = (n, d = 1) => (n == null ? "—" : `${Number(n).toFixed(d)}%`);
const kg = (n) => (n == null ? "—" : `${num(n)} kg`);
const horas = (n) => (n == null ? "—" : `${dec(n)} h`);

/** Miles abreviados para los ejes: 1.2M / 340k. */
const corto = (n) => {
  const v = Number(n);
  if (!Number.isFinite(v)) return "";
  if (Math.abs(v) >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (Math.abs(v) >= 1000) return `${Math.round(v / 1000)}k`;
  return String(Math.round(v));
};

function Tarjeta({ titulo, valor, detalle, color, aviso }) {
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
      <p className="text-3xl font-bold mt-1" style={{ color: color || "#1f2937" }}>
        {valor}
      </p>
      {detalle && <p className="text-xs text-gray-400 mt-1">{detalle}</p>}
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

/** Cabecera de sección, para no repetir el mismo bloque cinco veces. */
const Seccion = ({ titulo, nota, children, className = "", grafica }) => (
  // data-grafica: el exportador a Excel busca aquí la gráfica a incrustar
  <div
    data-grafica={grafica}
    className={`bg-white rounded-xl shadow-sm border border-gray-100 p-5 ${className}`}
  >
    <h2 className="font-semibold text-gray-900">{titulo}</h2>
    {nota && <p className="text-xs text-gray-400 mb-4 mt-0.5">{nota}</p>}
    {children}
  </div>
);

export default function ReportesCompoundPage() {
  const [filtrosDisp, setFiltrosDisp] = useState(null);
  const [datos, setDatos] = useState(null);
  const [recuperacion, setRecuperacion] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [agrupar, setAgrupar] = useState("mes");
  const [exportando, setExportando] = useState(false);
  const usuario = useAuthStore((s) => s.user);

  const [filtros, setFiltros] = useState({
    anio: "", mes: "", trimestre: "", semestre: "", lineas: [], turnos: [],
  });

  useEffect(() => {
    compoundService
      .getFiltros()
      .then(setFiltrosDisp)
      .catch((e) => console.error("Error cargando filtros:", e));
  }, []);

  useEffect(() => {
    setLoading(true);
    setError(null);
    Promise.all([
      compoundService.getDashboard(filtros, agrupar),
      compoundService.getRecuperacion(
        { anio: filtros.anio || undefined },
        "anio",
      ),
    ])
      .then(([d, r]) => {
        setDatos(d);
        setRecuperacion(r);
      })
      .catch((e) => setError(e.response?.data?.message || e.message))
      .finally(() => setLoading(false));
  }, [filtros, agrupar]);

  const alternar = (campo, valor) =>
    setFiltros((f) => ({
      ...f,
      [campo]: f[campo].includes(valor)
        ? f[campo].filter((x) => x !== valor)
        : [...f[campo], valor],
    }));

  const limpiar = () => {
    setFiltros({ anio: "", mes: "", trimestre: "", semestre: "", lineas: [], turnos: [] });
    setAgrupar("mes");
  };

  const exportar = async () => {
    setExportando(true);
    setError(null);
    try {
      await exportarReporteCompuestos({
        datos,
        recuperacion,
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

  /** Enlace al modo TV, arrastrando las líneas y turnos filtrados. */
  const enlaceTv = useMemo(() => {
    const p = new URLSearchParams({ periodo: "ultimo", rotacion: "20", refresco: "5" });
    if (filtros.lineas.length) p.set("linea", filtros.lineas.join(","));
    if (filtros.turnos.length) p.set("turno", filtros.turnos.join(","));
    return `/compound/tv?${p}`;
  }, [filtros.lineas, filtros.turnos]);

  const r = datos?.resumen;

  /** Serie de causas + el %paro del periodo, para el apilado con línea. */
  const serieCausas = useMemo(() => {
    if (!datos) return [];
    const porClave = new Map(datos.serie.map((s) => [s.clave, s]));
    return datos.causasSerie.map((c) => ({
      ...c,
      pctParo: porClave.get(c.clave)?.pctParo ?? null,
    }));
  }, [datos]);

  /** Recuperación pivoteada: una columna de % por BU y una de meta por BU. */
  const serieRecuperacion = useMemo(() => {
    if (!recuperacion) return [];
    const mapa = new Map();
    for (const s of recuperacion.serie) {
      if (!mapa.has(s.clave)) mapa.set(s.clave, { clave: s.clave, etiqueta: s.etiqueta });
      const fila = mapa.get(s.clave);
      fila[s.bu] = s.pctReciclado;
      fila[`meta__${s.bu}`] = s.metaPct;
    }
    return [...mapa.values()].sort((a, b) => a.clave.localeCompare(b.clave));
  }, [recuperacion]);

  const busActivas = useMemo(
    () => (recuperacion?.porBu || []).map((b) => b.bu),
    [recuperacion],
  );

  const cal = datos?.calidadCaptura;
  const hayCausasSinConfirmar = (datos?.causas || []).some((c) => !c.confirmada);

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center">
            <FlaskConical className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Compuestos</h1>
            <p className="text-sm text-gray-500">
              {r?.desde
                ? `${String(r.desde).slice(0, 10)} al ${String(r.hasta).slice(0, 10)} · ${num(r.registros)} turnos`
                : "Producción, tiempo muerto y recuperación de polvo"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
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
          {exportando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
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
        <div className="flex flex-wrap gap-6">
          <div>
            <p className="text-xs font-medium text-gray-500 mb-2">Línea</p>
            <div className="flex gap-2">
              {(filtrosDisp?.lineas || []).map((l) => (
                <button
                  key={l.linea}
                  onClick={() => alternar("lineas", l.linea)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                    filtros.lineas.includes(l.linea)
                      ? "bg-primary text-white border-primary"
                      : "bg-white text-gray-600 border-gray-200 hover:border-primary/40"
                  }`}
                >
                  Línea {l.linea}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 mb-2">Turno</p>
            <div className="flex gap-2">
              {(filtrosDisp?.turnos || []).map((t) => (
                <button
                  key={t.turno}
                  onClick={() => alternar("turnos", t.turno)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                    filtros.turnos.includes(t.turno)
                      ? "bg-primary text-white border-primary"
                      : "bg-white text-gray-600 border-gray-200 hover:border-primary/40"
                  }`}
                >
                  Turno {t.turno}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <Select etiqueta="Año" valor={filtros.anio} onChange={(v) => setFiltros((f) => ({ ...f, anio: v }))}>
            <option value="">Todos</option>
            {(filtrosDisp?.anios || []).map((a) => (
              <option key={a.anio} value={a.anio}>{a.anio}</option>
            ))}
          </Select>
          <Select etiqueta="Semestre" valor={filtros.semestre} onChange={(v) => setFiltros((f) => ({ ...f, semestre: v }))}>
            <option value="">Todos</option>
            <option value="1">S1 (ene-jun)</option>
            <option value="2">S2 (jul-dic)</option>
          </Select>
          <Select etiqueta="Trimestre" valor={filtros.trimestre} onChange={(v) => setFiltros((f) => ({ ...f, trimestre: v }))}>
            <option value="">Todos</option>
            {[1, 2, 3, 4].map((t) => <option key={t} value={t}>T{t}</option>)}
          </Select>
          <Select etiqueta="Mes" valor={filtros.mes} onChange={(v) => setFiltros((f) => ({ ...f, mes: v }))}>
            <option value="">Todos</option>
            {(filtrosDisp?.meses || []).map((m) => (
              <option key={m.numero} value={m.numero}>{m.nombre}</option>
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
              <Tarjeta titulo="Producción" valor={kg(r.produccionKg)} detalle={`${num(r.registros)} turnos`} color={AZUL} />
              <Tarjeta
                titulo="Tiempo muerto"
                valor={pct(r.pctParo)}
                detalle={`${horas(r.paroHoras)} de ${num(r.turnoHoras)} h`}
                color={r.pctParo > 20 ? ROJO : NARANJA}
              />
              <Tarjeta
                titulo="Ritmo real"
                valor={`${dec(r.kgHora, 0)} kg/h`}
                detalle={`Meta ${dec(r.metaKgHora, 0)} kg/h`}
                color={r.kgHora >= r.metaKgHora ? VERDE : NARANJA}
              />
              <Tarjeta
                titulo="Cumplimiento"
                valor={pct(r.pctCumplimiento)}
                detalle={`${num(r.turnosBajoMeta)} de ${num(r.turnosConMeta)} turnos bajo meta`}
                color={r.pctCumplimiento >= 100 ? VERDE : NARANJA}
              />
              <Tarjeta
                titulo="Kg sobre meta"
                valor={kg(r.kgVsMeta)}
                detalle={pct(r.pctVsMeta) + " sobre la meta acumulada"}
                color={r.kgVsMeta >= 0 ? VERDE : ROJO}
                aviso={
                  'En el Excel esta columna se llama "Kg PERDIDOS", pero vale ' +
                  "producción menos meta: un valor positivo significa que se " +
                  "produjo POR ENCIMA de la meta, no que se perdió material. " +
                  "El Power BI la graficaba como %Scrap, que es incorrecto."
                }
              />
            </div>

            {/* Pareto de causas */}
            <Seccion
              grafica="pareto"
              titulo="A qué se va el tiempo muerto"
              nota={
                "Barras: horas por causa. Línea: porcentaje acumulado. " +
                (hayCausasSinConfirmar
                  ? "Las causas con asterisco tienen el nombre supuesto; falta que planta confirme la sigla."
                  : "")
              }
            >
              <ResponsiveContainer width="100%" height={320}>
                <ComposedChart data={datos.paretoParo} margin={{ top: 10, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis
                    dataKey="nombre"
                    tick={{ fontSize: 11 }}
                    tickFormatter={(v, i) =>
                      datos.paretoParo[i]?.confirmada ? v : `${v} *`
                    }
                    angle={-20}
                    textAnchor="end"
                    height={70}
                  />
                  <YAxis yAxisId="izq" tick={{ fontSize: 11 }} tickFormatter={corto} />
                  <YAxis
                    yAxisId="der"
                    orientation="right"
                    domain={[0, 100]}
                    tick={{ fontSize: 11 }}
                    tickFormatter={(v) => `${v}%`}
                  />
                  <Tooltip
                    formatter={(v, n) =>
                      n === "% acumulado" ? pct(v) : horas(v)
                    }
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar yAxisId="izq" dataKey="horas" name="Horas de paro" radius={[3, 3, 0, 0]}>
                    {datos.paretoParo.map((c) => (
                      <Cell key={c.codigo} fill={COLOR_CAUSA[c.codigo] || GRIS} />
                    ))}
                  </Bar>
                  <Line
                    yAxisId="der"
                    type="monotone"
                    dataKey="pctAcumulado"
                    name="% acumulado"
                    stroke="#1f2937"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                  {/* El 80% es el corte clásico de Pareto: lo que está a la
                      izquierda es donde vale la pena invertir esfuerzo */}
                  <ReferenceLine
                    yAxisId="der"
                    y={80}
                    stroke={GRIS}
                    strokeDasharray="4 4"
                    label={{ value: "80%", position: "right", fontSize: 11, fill: GRIS }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </Seccion>

            {/* Causas a lo largo del tiempo */}
            <Seccion
              grafica="causas"
              titulo="Cómo se ha movido el tiempo muerto"
              nota="Barras apiladas: horas de cada causa. Línea: % de tiempo muerto sobre las horas de turno."
            >
              <ResponsiveContainer width="100%" height={340}>
                <ComposedChart data={serieCausas}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="etiqueta" tick={{ fontSize: 11 }} angle={-30} textAnchor="end" height={80} />
                  <YAxis yAxisId="izq" tick={{ fontSize: 11 }} tickFormatter={corto} />
                  <YAxis yAxisId="der" orientation="right" tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}%`} />
                  <Tooltip formatter={(v, n) => (n === "% tiempo muerto" ? pct(v) : horas(v))} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  {(datos.causas || []).map((c) => (
                    <Bar
                      key={c.codigo}
                      yAxisId="izq"
                      dataKey={c.codigo}
                      name={c.nombre + (c.confirmada ? "" : " *")}
                      stackId="paro"
                      fill={COLOR_CAUSA[c.codigo] || GRIS}
                    />
                  ))}
                  <Line
                    yAxisId="der"
                    type="monotone"
                    dataKey="pctParo"
                    name="% tiempo muerto"
                    stroke={ROJO}
                    strokeWidth={2.5}
                    dot={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </Seccion>

            {/* Producción y cumplimiento */}
            <Seccion
              grafica="produccion"
              titulo="Producción y cumplimiento"
              nota="Barras: kilos producidos. Línea: porcentaje de cumplimiento contra la meta del periodo."
            >
              <ResponsiveContainer width="100%" height={320}>
                <ComposedChart data={datos.serie}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="etiqueta" tick={{ fontSize: 11 }} angle={-30} textAnchor="end" height={80} />
                  <YAxis yAxisId="izq" tick={{ fontSize: 11 }} tickFormatter={corto} />
                  <YAxis yAxisId="der" orientation="right" tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}%`} />
                  <Tooltip formatter={(v, n) => (n === "Producción" ? kg(v) : pct(v))} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar yAxisId="izq" dataKey="produccionKg" name="Producción" fill="#dbeafe" radius={[3, 3, 0, 0]} />
                  <Line
                    yAxisId="der"
                    type="monotone"
                    dataKey="pctCumplimiento"
                    name="% cumplimiento"
                    stroke={AZUL}
                    strokeWidth={2.5}
                    dot={{ r: 3 }}
                  />
                  <ReferenceLine yAxisId="der" y={100} stroke={VERDE} strokeDasharray="4 4" />
                </ComposedChart>
              </ResponsiveContainer>
            </Seccion>

            {/* Cortes: línea, turno, supervisor */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Seccion titulo="Línea 1 contra Línea 2" nota="Producción y tiempo muerto de cada línea">
                <TablaCorte
                  filas={datos.porLinea}
                  clave="linea"
                  encabezado="Línea"
                  prefijo="Línea "
                />
              </Seccion>
              <Seccion
                titulo="Turno A contra Turno B"
                nota="El dato está en el Excel y el Power BI no lo usaba"
              >
                <TablaCorte
                  filas={datos.porTurno}
                  clave="turno"
                  encabezado="Turno"
                  prefijo="Turno "
                />
              </Seccion>
            </div>

            <Seccion
              titulo="Por supervisor"
              nota="Los nombres se unifican al cargar: en el Excel el mismo supervisor aparece escrito de dos formas."
            >
              <TablaCorte filas={datos.porSupervisor} clave="supervisor" encabezado="Supervisor" />
            </Seccion>

            {/* Recuperación de polvo */}
            {recuperacion && recuperacion.porBu.length > 0 && (
              <Seccion
                grafica="recuperacion"
                titulo="Recuperación de polvo"
                nota="Cada unidad de negocio se compara contra SU meta: Crocs pasó de 5% a 8% en 2024, Suela va en 5% y Producto Técnico en 2%."
              >
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
                  {recuperacion.porBu.map((b) => {
                    const cumple = b.metaPct != null && b.pctReciclado >= b.metaPct;
                    return (
                      <div key={b.bu} className="border border-gray-100 rounded-lg p-4">
                        <p className="text-xs text-gray-500">{b.bu}</p>
                        <p
                          className="text-2xl font-bold mt-1"
                          style={{ color: cumple ? VERDE : NARANJA }}
                        >
                          {pct(b.pctReciclado, 2)}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          Meta {pct(b.metaPct, 0)} · {kg(b.polvoKg)} de polvo
                        </p>
                      </div>
                    );
                  })}
                </div>
                <ResponsiveContainer width="100%" height={300}>
                  <ComposedChart data={serieRecuperacion}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="etiqueta" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}%`} />
                    <Tooltip formatter={(v) => pct(v, 2)} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    {busActivas.map((bu) => (
                      <Bar key={bu} dataKey={bu} name={bu} fill={COLOR_BU[bu] || GRIS} radius={[3, 3, 0, 0]} />
                    ))}
                    {busActivas.map((bu) => (
                      <Line
                        key={`meta-${bu}`}
                        type="stepAfter"
                        dataKey={`meta__${bu}`}
                        name={`Meta ${bu}`}
                        stroke={COLOR_BU[bu] || GRIS}
                        strokeWidth={2}
                        strokeDasharray="5 4"
                        dot={false}
                      />
                    ))}
                  </ComposedChart>
                </ResponsiveContainer>
              </Seccion>
            )}

            {/* Salud de la captura */}
            {cal && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <h2 className="font-semibold text-amber-900">Salud de la captura</h2>
                    <p className="text-xs text-amber-700 mt-0.5 mb-3">
                      De {num(cal.total)} turnos cargados. Estos renglones se
                      guardan igual, pero quedan fuera de los porcentajes que
                      necesitan un denominador.
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      {[
                        ["Sin turno A/B", cal.sin_turno, "Todos traen producción y horas en cero: son líneas paradas."],
                        ["Sin meta", cal.sin_meta, "No se les puede calcular cumplimiento."],
                        ["Producción en cero", cal.produccion_cero, "Turnos sin producir."],
                        ["Más paro que turno", cal.paro_mayor_que_turno, "Captura inconsistente: revisar."],
                      ].map(([titulo, valor, ayuda]) => (
                        <div key={titulo} title={ayuda}>
                          <p className="text-2xl font-bold text-amber-900">{num(valor)}</p>
                          <p className="text-xs text-amber-700">{titulo}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )
      )}
    </div>
  );
}

/** Tabla de un corte (línea, turno, supervisor) con los mismos indicadores. */
function TablaCorte({ filas, clave, encabezado, prefijo = "" }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-gray-500 text-xs uppercase tracking-wide">
          <tr className="border-b border-gray-100">
            <th className="text-left py-2 font-medium">{encabezado}</th>
            <th className="text-right py-2 font-medium">Producción</th>
            <th className="text-right py-2 font-medium">% Paro</th>
            <th className="text-right py-2 font-medium">kg/h</th>
            <th className="text-right py-2 font-medium">Cumpl.</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {filas.map((f) => (
            <tr key={f[clave]} className="hover:bg-gray-50">
              <td className="py-2 text-gray-900">{prefijo}{f[clave]}</td>
              <td className="py-2 text-right">{num(f.produccionKg)}</td>
              <td
                className="py-2 text-right font-medium"
                style={{ color: f.pctParo > 20 ? ROJO : "#1f2937" }}
              >
                {pct(f.pctParo)}
              </td>
              <td className="py-2 text-right">{dec(f.kgHora, 0)}</td>
              <td className="py-2 text-right">{pct(f.pctCumplimiento)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
