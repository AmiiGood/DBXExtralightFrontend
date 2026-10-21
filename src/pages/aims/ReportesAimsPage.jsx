import { useState, useEffect, useCallback, useMemo } from "react";
import {
  ComposedChart,
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
  ShieldCheck,
  Loader2,
  RefreshCw,
  AlertTriangle,
  Info,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { aimsService } from "../../services/aims.service";
import { useAuthStore } from "../../stores/auth.store";

/**
 * Reporte de AIMS.
 *
 * Doce indicadores son muchos para enseñarlos uno por uno. Se agrupan los que
 * se leen juntos (MTTR de Inyección contra el de Compuestos, RCO contra OR,
 * plan anual contra general) y cada grupo es una gráfica, igual que en los
 * demás reportes. Al final va la tabla con los doce contra su meta.
 *
 * ---------------------------------------------------------------------------
 * LO QUE NO SE VE Y SÍ IMPORTA
 * ---------------------------------------------------------------------------
 * Cumplir no siempre es estar arriba: en MTTR e indisponibilidad es quedar
 * ABAJO de la meta. Lo decide `sentido`, no el color de la línea.
 *
 * Los meses que el área no ha cerrado no aparecen, y los cerrados sin dato
 * (legales de julio a septiembre) quedan como hueco, no como cero.
 */

const AZUL = "#236093";
const NARANJA = "#c9761f";
const VERDE = "#49a090";
const ROJO = "#b0413e";
const SERIES = [AZUL, NARANJA];

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const MESES_LARGO = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

/**
 * Qué indicadores van juntos en una gráfica.
 *
 * Un KPI que no esté aquí (un KPI-13 que agreguen al libro) sale solo en una
 * gráfica al final, para que no se pierda.
 */
const GRUPOS = [
  {
    titulo: "Disponibilidad e indisponibilidad operativa",
    nota: "Disponibilidad: producción contra capacidad instalada. Indisponibilidad: tiempo muerto por mantenimiento.",
    kpis: ["AIMS-KPI-01", "AIMS-KPI-02"],
    ancho: true,
  },
  {
    titulo: "Plan de mantenimiento",
    nota: "Máquinas con mantenimiento hecho entre las planeadas del mes.",
    kpis: ["AIMS-KPI-03"],
    barras: true,
  },
  {
    titulo: "Horas de capacitación",
    nota: "Horas impartidas entre horas planeadas.",
    kpis: ["AIMS-KPI-04"],
    barras: true,
  },
  {
    titulo: "MTTR: tiempo medio de reparación",
    nota: "Minutos por orden de trabajo. Cumple quedando por debajo de la meta.",
    kpis: ["AIMS-KPI-07", "AIMS-KPI-09"],
  },
  {
    titulo: "MTBF: tiempo medio entre fallas",
    nota: "Minutos entre una falla y la siguiente.",
    kpis: ["AIMS-KPI-08", "AIMS-KPI-10"],
  },
  {
    titulo: "Cumplimiento legal",
    nota: "Requerimientos críticos para operar (RCO) y otros requerimientos (OR).",
    kpis: ["AIMS-KPI-05", "AIMS-KPI-06"],
  },
  {
    titulo: "Plan AIMS",
    nota: "Puntos cerrados acumulados en el año: del plan anual y del plan general 2026–2027.",
    kpis: ["AIMS-KPI-11", "AIMS-KPI-12"],
  },
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
  k.meta == null ? "—" : `${k.sentido === "MENOR" ? "≤" : "≥"} ${formato(k.meta, k.unidad, 0)}`;

const colorDe = (cumple) => (cumple == null ? "#1f2937" : cumple ? VERDE : ROJO);

/** Nombre corto para leyendas: sin el "%" del principio. */
const corto = (k) => (k.nombre || k.codigo).replace(/^%\s*/, "");

function Tarjeta({ titulo, valor, detalle, color }) {
  return (
    <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-100">
      <p className="text-sm text-gray-500">{titulo}</p>
      <p className="text-3xl font-bold mt-1" style={{ color: color || "#1f2937" }}>
        {valor}
      </p>
      {detalle && <p className="text-xs text-gray-400 mt-1">{detalle}</p>}
    </div>
  );
}

const Seccion = ({ titulo, nota, children, className = "" }) => (
  <div className={`bg-white rounded-xl shadow-sm border border-gray-100 p-5 ${className}`}>
    <h2 className="font-semibold text-gray-900">{titulo}</h2>
    {nota && <p className="text-xs text-gray-400 mb-4 mt-0.5">{nota}</p>}
    {children}
  </div>
);

/** Tarjeta de un indicador por su código. */
function TarjetaKpi({ kpi, titulo }) {
  if (!kpi) return null;
  const u = kpi.ultimo;
  return (
    <Tarjeta
      titulo={titulo || corto(kpi)}
      valor={formato(u?.valor, kpi.unidad)}
      detalle={`${u ? MESES_LARGO[u.mes - 1] : "Sin datos"} · meta ${metaTexto(kpi)}`}
      color={colorDe(u?.cumple)}
    />
  );
}

function TooltipGrupo({ active, payload, kpis }) {
  if (!active || !payload?.length) return null;
  const punto = payload[0].payload;
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-md p-3 text-xs max-w-xs space-y-1.5">
      <p className="font-semibold text-gray-900 capitalize">{MESES_LARGO[punto.mes - 1]}</p>
      {kpis.map((k) => {
        const m = punto[`m_${k.codigo}`];
        if (!m) return null;
        return (
          <div key={k.codigo}>
            <p>
              <span className="text-gray-500">{corto(k)}: </span>
              <span className="font-medium" style={{ color: colorDe(m.cumple) }}>
                {m.valor == null ? "sin dato" : formato(m.valor, k.unidad)}
              </span>
            </p>
            {m.detalle?.nota && <p className="text-gray-400">{m.detalle.nota}</p>}
            {m.detalle?.faltantes?.length > 0 && (
              <p className="text-gray-400">Faltaron: {m.detalle.faltantes.join(", ")}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}

/**
 * Una gráfica con uno o dos indicadores de la misma unidad, mes a mes.
 *
 * Con un solo indicador van barras pintadas según si cumplen la meta; con dos,
 * una línea por indicador y la meta de cada uno punteada en su color.
 */
function GraficaGrupo({ grupo, kpis }) {
  const unidad = kpis[0].unidad;
  const datos = MESES.map((nombre, i) => {
    const punto = { mes: i + 1, nombre };
    for (const k of kpis) {
      const m = k.meses.find((x) => x.mes === i + 1);
      punto[k.codigo] = m?.valor ?? null;
      punto[`m_${k.codigo}`] = m || null;
    }
    return punto;
  });

  // Una línea de meta por valor distinto: si las dos metas son iguales
  // (MTTR 60 y 60), se dibuja una sola.
  const metas = [];
  kpis.forEach((k, i) => {
    if (k.meta != null && !metas.some((m) => m.valor === k.meta)) {
      metas.push({ valor: k.meta, color: kpis.length === 1 ? "#475569" : SERIES[i] });
    }
  });

  // Eje con números redondos: cuatro tramos de 1, 2, 2.5 o 5 × 10^n. Sin
  // esto Recharts parte 365 minutos en 95, 190, 285…
  const maximo = Math.max(
    ...kpis.flatMap((k) => [k.meta || 0, ...k.meses.map((m) => m.valor || 0)]),
  );
  const tramo = (() => {
    const crudo = (unidad === "%" ? Math.max(1, maximo) : maximo || 1) / 4;
    const base = 10 ** Math.floor(Math.log10(crudo));
    return [1, 2, 2.5, 5, 10].map((f) => f * base).find((t) => t >= crudo);
  })();
  const ticks = [0, 1, 2, 3, 4].map((i) => i * tramo);
  // En minutos el eje lleva solo el número: la nota de la sección ya dice la
  // unidad, y "400 min" no cabe en el ancho del eje.
  const eje = (v) =>
    unidad !== "min"
      ? formato(v, unidad, 0)
      : v >= 1000
        ? `${(v / 1000).toLocaleString("es-MX", { maximumFractionDigits: 1 })}k`
        : String(v);

  // La meta va en la leyenda (o en la nota, si es un solo indicador) y no
  // como texto dentro de la gráfica: ahí las barras que llegan a 100% la tapan.
  const nota =
    kpis.length === 1 && kpis[0].meta != null
      ? `${grupo.nota} Meta ${metaTexto(kpis[0])}.`
      : grupo.nota;

  return (
    <Seccion titulo={grupo.titulo} nota={nota} className={grupo.ancho ? "lg:col-span-2" : ""}>
      <ResponsiveContainer width="100%" height={280}>
        <ComposedChart data={datos} margin={{ top: 10, right: 20, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
          <XAxis dataKey="nombre" tick={{ fontSize: 11 }} minTickGap={4} />
          <YAxis
            tick={{ fontSize: 11 }}
            tickFormatter={eje}
            width={44}
            domain={[0, ticks[4]]}
            ticks={ticks}
          />
          <Tooltip content={<TooltipGrupo kpis={kpis} />} cursor={{ fill: "#f8fafc" }} />
          {kpis.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} />}
          {grupo.barras && kpis.length === 1 ? (
            <Bar dataKey={kpis[0].codigo} name={corto(kpis[0])} radius={[3, 3, 0, 0]}>
              {datos.map((d) => {
                const c = d[`m_${kpis[0].codigo}`]?.cumple;
                return <Cell key={d.mes} fill={c == null ? "#dbeafe" : c ? VERDE : ROJO} />;
              })}
            </Bar>
          ) : (
            kpis.map((k, i) => (
              <Line
                key={k.codigo}
                // Recta de punto a punto: la curva suavizada inventa picos y
                // valles entre meses (el MTTR de Compuestos bajaba de cero)
                type="linear"
                dataKey={k.codigo}
                name={k.meta == null ? corto(k) : `${corto(k)} (meta ${metaTexto(k)})`}
                stroke={SERIES[i % SERIES.length]}
                strokeWidth={2.5}
                dot={{ r: 3 }}
                connectNulls={false}
              />
            ))
          )}
          {/* Después de las series, para que la meta quede encima de las barras */}
          {metas.map((m) => (
            <ReferenceLine key={m.valor} y={m.valor} stroke={m.color} strokeDasharray="4 4" />
          ))}
        </ComposedChart>
      </ResponsiveContainer>
    </Seccion>
  );
}

export default function ReportesAimsPage() {
  const [datos, setDatos] = useState(null);
  const [anio, setAnio] = useState(null);
  const [error, setError] = useState(null);
  const [sincronizando, setSincronizando] = useState(false);
  const usuario = useAuthStore((s) => s.user);
  const esAdmin = Boolean(usuario?.rol?.esAdmin);

  const cargar = useCallback(async (a) => {
    try {
      setDatos(await aimsService.getReporte(a));
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

  const porCodigo = useMemo(
    () => new Map((datos?.indicadores || []).map((k) => [k.codigo, k])),
    [datos],
  );

  if (error && !datos) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 text-sm">
        {error}
      </div>
    );
  }
  if (!datos) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-400">
        <Loader2 className="w-6 h-6 animate-spin mr-2" />
        Cargando...
      </div>
    );
  }

  const kpis = datos.indicadores;
  const archivo = datos.archivo;
  const conDato = kpis.filter((k) => k.ultimo?.cumple != null);
  const cumplen = conDato.filter((k) => k.ultimo.cumple).length;
  const ultimoMes = Math.max(0, ...kpis.map((k) => k.ultimo?.mes || 0));

  const agrupados = new Set(GRUPOS.flatMap((g) => g.kpis));
  const grupos = [
    ...GRUPOS.map((g) => ({ ...g, lista: g.kpis.map((c) => porCodigo.get(c)).filter(Boolean) })),
    ...kpis
      .filter((k) => !agrupados.has(k.codigo))
      .map((k) => ({ titulo: `${k.codigo} · ${k.nombre}`, nota: k.definicion, lista: [k], barras: true })),
  ].filter((g) => g.lista.length > 0);

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center">
            <ShieldCheck className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">AIMS</h1>
            <p className="text-sm text-gray-500">
              {datos.anio
                ? `Indicadores ${datos.anio}${ultimoMes ? ` · cerrado a ${MESES_LARGO[ultimoMes - 1]}` : ""}` +
                  (archivo?.archivo ? ` · ${archivo.archivo}` : "")
                : "Asset Integrity Management System"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {datos.anios.length > 1 && (
            <select
              value={datos.anio || ""}
              onChange={(e) => setAnio(Number(e.target.value))}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              {datos.anios.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          )}
          {esAdmin && archivo?.carpeta && (
            <button
              onClick={sincronizar}
              disabled={sincronizando}
              className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
              title="Vuelve a revisar la carpeta sin esperar la siguiente vuelta"
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

      {/* Solo se avisa cuando hay algo que decir: el dato no se está
          actualizando, o todavía no hay de dónde leerlo */}
      {archivo?.error ? (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 text-sm flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>No se pudo leer el libro: {archivo.error}</span>
        </div>
      ) : (
        !archivo?.carpeta && (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-lg p-4 text-sm flex items-start gap-2">
            <Info className="w-4 h-4 mt-0.5 shrink-0" />
            <span>
              Todavía no se configura la carpeta del libro; se muestra la última carga.
            </span>
          </div>
        )
      )}

      {kpis.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 p-10 text-center text-gray-400">
          Todavía no se ha cargado el libro de indicadores.
        </div>
      ) : (
        <>
          {/* Tarjetas */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Tarjeta
              titulo="Indicadores en meta"
              valor={`${cumplen} de ${conDato.length}`}
              detalle="en su último mes cerrado"
              color={cumplen === conDato.length ? VERDE : AZUL}
            />
            <TarjetaKpi kpi={porCodigo.get("AIMS-KPI-01")} />
            <TarjetaKpi kpi={porCodigo.get("AIMS-KPI-03")} titulo="Plan de mantenimiento" />
            <TarjetaKpi kpi={porCodigo.get("AIMS-KPI-12")} titulo="Plan AIMS general" />
          </div>

          {/* Gráficas */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {grupos.map((g) => (
              <GraficaGrupo key={g.titulo} grupo={g} kpis={g.lista} />
            ))}
          </div>

          {/* Todos contra su meta */}
          <Seccion
            titulo="Todos los indicadores"
            nota="El año se calcula según el indicador: promedio de los meses, cumplido entre planeado, pesado por número de órdenes (MTTR y MTBF) o el último mes (plan AIMS, que ya es acumulado)."
          >
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 border-b border-gray-100">
                    <th className="py-2 pr-3 font-medium">Indicador</th>
                    <th className="py-2 pr-3 font-medium text-right">Meta</th>
                    <th className="py-2 pr-3 font-medium text-right">Último mes</th>
                    <th className="py-2 pr-3 font-medium text-right">En el año</th>
                    <th className="py-2 font-medium text-center">Cumple</th>
                  </tr>
                </thead>
                <tbody>
                  {kpis.map((k) => (
                    <tr key={k.codigo} className="border-b border-gray-50 last:border-0">
                      <td className="py-2 pr-3">
                        <span className="text-gray-800" title={k.definicion || undefined}>
                          {k.nombre}
                        </span>
                        <span className="text-xs text-gray-400 ml-2">{k.codigo}</span>
                      </td>
                      <td className="py-2 pr-3 text-right text-gray-500 whitespace-nowrap">
                        {metaTexto(k)}
                      </td>
                      <td className="py-2 pr-3 text-right whitespace-nowrap">
                        <span className="font-medium" style={{ color: colorDe(k.ultimo?.cumple) }}>
                          {formato(k.ultimo?.valor, k.unidad)}
                        </span>
                        {k.ultimo && (
                          <span className="text-xs text-gray-400 ml-1">
                            {MESES[k.ultimo.mes - 1]}
                          </span>
                        )}
                      </td>
                      <td
                        className="py-2 pr-3 text-right font-medium whitespace-nowrap"
                        style={{ color: colorDe(k.acumulado.cumple) }}
                      >
                        {formato(k.acumulado.valor, k.unidad)}
                      </td>
                      <td className="py-2 text-center">
                        {k.ultimo?.cumple == null ? (
                          <span className="text-gray-300">—</span>
                        ) : k.ultimo.cumple ? (
                          <CheckCircle2 className="w-4 h-4 inline" style={{ color: VERDE }} />
                        ) : (
                          <XCircle className="w-4 h-4 inline" style={{ color: ROJO }} />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Seccion>
        </>
      )}
    </div>
  );
}
