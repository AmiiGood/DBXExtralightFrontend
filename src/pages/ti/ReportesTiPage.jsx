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
  ResponsiveContainer,
  ReferenceLine,
  Cell,
} from "recharts";
import {
  Headphones, RotateCcw, Loader2, RefreshCw, Info, AlertTriangle, Clock,
} from "lucide-react";
import { tiService } from "../../services/ti.service";
import { useAuthStore } from "../../stores/auth.store";

/**
 * Reportes de TI.
 *
 * Mismo origen que Moldes —osTicket, leído de una réplica local— pero mide dos
 * tiempos y no uno:
 *
 *   RESOLUCIÓN         lo que tarda el área en cerrar.
 *   PRIMERA RESPUESTA  lo que tarda alguien en contestar. Es lo que percibe
 *                      quien levantó el ticket, y el reporte de Moldes no lo
 *                      tiene porque ahí no aplica igual.
 *
 * La métrica es la MEDIANA, no el promedio, y aquí la diferencia es brutal: en
 * "Otro Software" la mediana es 4.2 h y el promedio 194 h, porque unos pocos
 * tickets se quedaron abiertos meses. El promedio se muestra en gris, con
 * advertencia, porque es la cifra a la que la gente está acostumbrada.
 *
 * La sección de equipo va SIN NOMBRES a propósito: enseña cómo se reparte la
 * carga y cuántas personas atienden, no quién tarda más. "Agente 1" es
 * simplemente el que más tickets lleva en el periodo filtrado.
 */

const AZUL = "#236093";
const VERDE = "#49a090";
const NARANJA = "#c9761f";
const ROJO = "#b0413e";
const MORADO = "#7c6bb0";
const GRIS = "#94a3b8";

/** Horas legibles: bajo dos días en horas, arriba en días. */
const dur = (h) => {
  if (h == null) return "—";
  const v = Number(h);
  if (v < 1) return `${Math.round(v * 60)} min`;
  if (v < 48) return `${v.toFixed(1)} h`;
  return `${(v / 24).toFixed(1)} d`;
};

const num = (n) =>
  n == null ? "—" : Number(n).toLocaleString("es-MX", { maximumFractionDigits: 0 });
const pct = (n, d = 1) => (n == null ? "—" : `${(Number(n) * 100).toFixed(d)}%`);

/** Marcas del eje logarítmico que de verdad caben en el rango del dato. */
function ticksLog(max) {
  const todas = [1, 4, 12, 24, 72, 168, 720, 2160];
  return todas.filter((t) => t <= max * 1.2);
}

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
      <p className="text-2xl font-bold mt-1" style={{ color: color || "#1f2937" }}>
        {valor}
      </p>
      {detalle && <p className="text-xs text-gray-400 mt-1">{detalle}</p>}
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

export default function ReportesTiPage() {
  const [filtrosDisp, setFiltrosDisp] = useState(null);
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [agrupar, setAgrupar] = useState("mes");
  const [sincronizando, setSincronizando] = useState(false);
  const [filtros, setFiltros] = useState({ anio: "", temas: [] });

  const usuario = useAuthStore((s) => s.user);
  const esAdmin = Boolean(usuario?.rol?.esAdmin);

  useEffect(() => {
    tiService
      .getFiltros()
      .then(setFiltrosDisp)
      .catch((e) => setError(e.response?.data?.message || e.message));
  }, []);

  const cargar = () => {
    setCargando(true);
    setError(null);
    tiService
      .getDashboard(filtros, agrupar)
      .then(setDatos)
      .catch((e) => setError(e.response?.data?.message || e.message))
      .finally(() => setCargando(false));
  };

  useEffect(cargar, [filtros, agrupar]);

  const sincronizar = async () => {
    setSincronizando(true);
    setError(null);
    try {
      await tiService.sincronizar(false);
      cargar();
    } catch (e) {
      setError(e.response?.data?.message || e.message);
    } finally {
      setSincronizando(false);
    }
  };

  const alternarTema = (tema) =>
    setFiltros((f) => ({
      ...f,
      temas: f.temas.includes(tema)
        ? f.temas.filter((t) => t !== tema)
        : [...f.temas, tema],
    }));

  const limpiar = () => {
    setFiltros({ anio: "", temas: [] });
    setAgrupar("mes");
  };

  const r = datos?.resumen;

  /** Los temas que sí tienen suficientes tickets para graficarse. */
  const temasGraficables = useMemo(
    () => (datos?.porTema || []).filter((t) => !t.pocosDatos),
    [datos],
  );

  const topeLog = useMemo(() => {
    const vals = (datos?.serie || []).flatMap((s) => [s.p90, s.mediana]).filter(Boolean);
    return vals.length ? Math.max(...vals) : 100;
  }, [datos]);

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center">
            <Headphones className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">TI</h1>
            <p className="text-sm text-gray-500">
              {r?.desde
                ? `${r.desde} al ${r.hasta} · ${num(r.tickets)} tickets`
                : "Tiempos de atención de la mesa de ayuda"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {esAdmin && (
            <button
              onClick={sincronizar}
              disabled={sincronizando}
              className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
              title="Trae de osTicket lo que haya cambiado. El servidor ya lo hace cada 15 minutos."
            >
              {sincronizando ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              Actualizar
            </button>
          )}
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

      {datos?.sincronizacion && (
        <p className="text-xs text-gray-400 -mt-2">
          Los tickets se leen de una copia local que se actualiza cada 15 minutos.
          Última: {datos.sincronizacion.fecha}
          {datos.sincronizacion.corte && ` · al corte de ${datos.sincronizacion.corte}`}
        </p>
      )}

      {/* Filtros */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 space-y-4">
        <div>
          <p className="text-xs font-medium text-gray-500 mb-2">Tema</p>
          <div className="flex flex-wrap gap-2">
            {(filtrosDisp?.temas || []).map((t) => (
              <button
                key={t.tema}
                onClick={() => alternarTema(t.tema)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                  filtros.temas.includes(t.tema)
                    ? "bg-primary text-white border-primary"
                    : "bg-white text-gray-600 border-gray-200 hover:border-primary/40"
                }`}
              >
                {t.tema} <span className="opacity-60">{t.tickets}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Año</label>
            <select
              value={filtros.anio}
              onChange={(e) => setFiltros((f) => ({ ...f, anio: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
            >
              <option value="">Todos</option>
              {(filtrosDisp?.anios || []).map((a) => (
                <option key={a.anio} value={a.anio}>
                  {a.anio} ({a.tickets})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Agrupar por
            </label>
            <select
              value={agrupar}
              onChange={(e) => setAgrupar(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
            >
              <option value="mes">Mes</option>
              <option value="trimestre">Trimestre</option>
              <option value="anio">Año</option>
            </select>
          </div>
        </div>
      </div>

      {cargando && !datos ? (
        <div className="flex items-center justify-center py-20 text-gray-400">
          <Loader2 className="w-6 h-6 animate-spin mr-2" />
          Cargando...
        </div>
      ) : (
        datos && (
          <>
            {/* Tarjetas */}
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
              <Tarjeta
                titulo="Tickets"
                valor={num(r.tickets)}
                detalle={`${num(r.cerrados)} cerrados`}
                color={AZUL}
              />
              <Tarjeta
                titulo="Resolución (mediana)"
                valor={dur(r.mediana)}
                detalle={`p90 ${dur(r.p90)}`}
                color={VERDE}
              />
              <Tarjeta
                titulo="Primera respuesta"
                valor={dur(r.medianaRespuesta)}
                detalle={`p90 ${dur(r.p90Respuesta)}`}
                color={AZUL}
                aviso="Cuánto tarda alguien en contestar el ticket. Es lo que percibe quien lo levantó, aunque la solución tarde más."
              />
              <Tarjeta
                titulo="Resueltos en 24 h"
                valor={pct(r.pctEn24h)}
                detalle={`${num(r.en24h)} de ${num(r.cerrados)}`}
                color={r.pctEn24h >= 0.6 ? VERDE : NARANJA}
              />
              <Tarjeta
                titulo="Promedio"
                valor={dur(r.promedio)}
                detalle="No usar para decidir"
                color={GRIS}
                aviso={
                  "El promedio lo dominan unos pocos tickets que quedaron abiertos " +
                  `meses; el más tardado de este corte llevó ${dur(r.maximo)}. ` +
                  "La mediana es la que dice lo que pasa un día normal."
                }
              />
              <Tarjeta
                titulo="Abiertos"
                valor={num(datos.backlog.total)}
                detalle={`${num(datos.backlog.masDeUnMes)} con más de un mes`}
                color={datos.backlog.masDeUnMes > 0 ? ROJO : VERDE}
              />
            </div>

            {/* ----------------------------------------------- Por tema */}
            <Seccion
              id="temas"
              titulo="Cuánto tarda cada tema"
              nota={
                "Barras: mediana de resolución. Línea: p90, el 10% que más tarda. " +
                `Los temas con menos de ${filtrosDisp?.minimoParaGraficar ?? 30} ` +
                "tickets cerrados no se grafican, una mediana de tres datos no dice nada."
              }
            >
              <ResponsiveContainer width="100%" height={340}>
                <ComposedChart data={temasGraficables} margin={{ top: 10, right: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis
                    dataKey="tema"
                    tick={{ fontSize: 11 }}
                    angle={-30}
                    textAnchor="end"
                    height={90}
                    interval={0}
                  />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    tickFormatter={dur}
                    scale="log"
                    domain={["auto", "auto"]}
                    ticks={ticksLog(Math.max(...temasGraficables.map((t) => t.p90 || 1), 1))}
                    allowDataOverflow
                  />
                  <Tooltip formatter={(v) => dur(v)} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="mediana" name="Mediana" radius={[3, 3, 0, 0]}>
                    {temasGraficables.map((t) => (
                      <Cell
                        key={t.tema}
                        // Rojo a partir de un día: ahí deja de ser "lo atendieron hoy"
                        fill={t.mediana > 24 ? ROJO : t.mediana > 8 ? NARANJA : VERDE}
                      />
                    ))}
                  </Bar>
                  <Line
                    type="monotone"
                    dataKey="p90"
                    name="p90"
                    stroke="#1f2937"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="medianaRespuesta"
                    name="Primera respuesta"
                    stroke={AZUL}
                    strokeWidth={2}
                    strokeDasharray="5 4"
                    dot={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>

              <div className="mt-5 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      {["Tema", "Tickets", "Mediana", "p90", "1ª respuesta", "En 24 h", "Promedio"].map((h) => (
                        <th
                          key={h}
                          className="px-3 py-2 text-right text-[11px] font-semibold text-gray-500 uppercase first:text-left"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {datos.porTema.map((t) => (
                      <tr key={t.tema} className={t.pocosDatos ? "text-gray-400" : ""}>
                        <td className="px-3 py-1.5 text-gray-900">
                          {t.tema}
                          {t.pocosDatos && (
                            <span className="ml-2 text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">
                              pocos datos
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-1.5 text-right tabular-nums">{num(t.tickets)}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums font-semibold text-gray-900">
                          {dur(t.mediana)}
                        </td>
                        <td className="px-3 py-1.5 text-right tabular-nums">{dur(t.p90)}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums">{dur(t.medianaRespuesta)}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums">{pct(t.pctEn24h)}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums text-gray-400">{dur(t.promedio)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Seccion>

            {/* ---------------------------------------------- Evolución */}
            <Seccion
              id="evolucion"
              titulo="Cómo se ha movido"
              nota="Eje logarítmico: la mediana anda en horas y el p90 de un mes malo en semanas, no caben juntos en escala lineal."
            >
              <ResponsiveContainer width="100%" height={340}>
                <ComposedChart data={datos.serie} margin={{ top: 10, right: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="etiqueta" tick={{ fontSize: 11 }} angle={-30} textAnchor="end" height={80} />
                  <YAxis
                    yAxisId="izq"
                    tick={{ fontSize: 11 }}
                    tickFormatter={dur}
                    scale="log"
                    domain={["auto", "auto"]}
                    ticks={ticksLog(topeLog)}
                    allowDataOverflow
                  />
                  <YAxis yAxisId="der" orientation="right" tick={{ fontSize: 11 }} />
                  <Tooltip
                    formatter={(v, n) => (n === "Tickets" ? num(v) : dur(v))}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar yAxisId="der" dataKey="tickets" name="Tickets" fill="#e2e8f0" radius={[3, 3, 0, 0]} />
                  <Line yAxisId="izq" type="monotone" dataKey="mediana" name="Mediana" stroke={VERDE} strokeWidth={2.5} dot={{ r: 2 }} />
                  <Line yAxisId="izq" type="monotone" dataKey="p90" name="p90" stroke={ROJO} strokeWidth={2} dot={false} />
                  <Line yAxisId="izq" type="monotone" dataKey="medianaRespuesta" name="1ª respuesta" stroke={AZUL} strokeWidth={2} strokeDasharray="5 4" dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </Seccion>

            {/* ------------------------------------------------- Equipo */}
            <Seccion
              id="equipo"
              titulo="Cómo se reparte el trabajo"
              nota="Sin nombres a propósito: enseña la distribución de la carga, no a las personas. El número de agente es su lugar por volumen en este corte y cambia con los filtros."
            >
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
                <Tarjeta titulo="Agentes" valor={num(datos.equipo.cuantos)} detalle="atendieron al menos un ticket" color={AZUL} />
                <Tarjeta
                  titulo="Carga del mayor"
                  valor={pct(datos.equipo.parteDelMayor)}
                  detalle="del total asignado"
                  color={datos.equipo.parteDelMayor > 0.5 ? ROJO : VERDE}
                  aviso="Arriba de la mitad en una sola persona, el área depende de que esa persona esté."
                />
                <Tarjeta titulo="Sin asignar" valor={num(datos.equipo.sinAsignar)} detalle="nadie los tomó" color={datos.equipo.sinAsignar > 0 ? NARANJA : VERDE} />
                <Tarjeta titulo="Reabiertos" valor={num(r.reabiertos)} detalle={`${pct(r.tickets ? r.reabiertos / r.tickets : null, 2)} del total`} color={MORADO} />
              </div>

              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={datos.equipo.agentes} margin={{ top: 10, right: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="etiqueta" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v, n) => (n === "Parte" ? pct(v) : num(v))} />
                  <Bar dataKey="tickets" name="Tickets" radius={[3, 3, 0, 0]}>
                    {datos.equipo.agentes.map((a) => (
                      <Cell key={a.posicion} fill={a.parte > 0.5 ? ROJO : AZUL} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Seccion>

            {/* ------------------------------------------------ Backlog */}
            <Seccion
              id="backlog"
              titulo="Lo que sigue abierto"
              nota="No respeta el filtro de fechas a propósito: un ticket abierto desde hace un año importa hoy aunque el corte apunte a este mes."
            >
              {datos.backlog.total === 0 ? (
                <p className="text-sm text-gray-400 py-6 text-center">
                  No hay tickets abiertos
                </p>
              ) : (
                <>
                  {datos.backlog.sinAsignar > 0 && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800 flex items-start gap-2 mb-4">
                      <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                      <p>
                        <strong>
                          {num(datos.backlog.sinAsignar)} de {num(datos.backlog.total)}
                        </strong>{" "}
                        tickets abiertos no tienen agente asignado, y{" "}
                        <strong>{num(datos.backlog.sinResponder)}</strong> no han recibido
                        ninguna respuesta. No es trabajo en proceso: es trabajo que nadie
                        tomó.
                      </p>
                    </div>
                  )}

                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
                    {datos.backlog.porAntiguedad.map((rango) => (
                      <div key={rango.clave} className="border border-gray-100 rounded-lg p-3">
                        <p className="text-xs text-gray-500">{rango.etiqueta}</p>
                        <p
                          className="text-xl font-bold mt-0.5"
                          style={{
                            color:
                              rango.clave === "viejo"
                                ? ROJO
                                : rango.clave === "meses"
                                  ? NARANJA
                                  : "#1f2937",
                          }}
                        >
                          {num(rango.tickets)}
                        </p>
                        <p className="text-xs text-gray-400">
                          {num(rango.sinAsignar)} sin asignar
                        </p>
                      </div>
                    ))}
                  </div>

                  <div className="overflow-x-auto max-h-96 overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr>
                          {["Ticket", "Tema", "Creado", "Días abierto", "Estado"].map((h) => (
                            <th
                              key={h}
                              className="px-3 py-2 text-left text-[11px] font-semibold text-gray-500 uppercase"
                            >
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {datos.backlog.tickets.map((t) => (
                          <tr key={t.numero}>
                            <td className="px-3 py-1.5 font-mono text-gray-900">{t.numero}</td>
                            <td className="px-3 py-1.5 text-gray-600">{t.tema}</td>
                            <td className="px-3 py-1.5 text-gray-500 whitespace-nowrap">{t.creado}</td>
                            <td
                              className="px-3 py-1.5 tabular-nums font-semibold"
                              style={{ color: t.dias > 180 ? ROJO : t.dias > 30 ? NARANJA : "#1f2937" }}
                            >
                              {num(t.dias)}
                            </td>
                            <td className="px-3 py-1.5">
                              {!t.asignado && (
                                <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full mr-1">
                                  sin asignar
                                </span>
                              )}
                              {!t.respondido && (
                                <span className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full">
                                  sin respuesta
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </Seccion>

            {/* ------------------------------------- Los que más tardaron */}
            <Seccion
              id="peores"
              titulo="Los que más tardaron"
              nota="Son los que inflan el promedio. Los marcados como reabiertos llevan el tiempo total: osTicket solo guarda la última fecha de cierre, así que un ticket resuelto rápido y reabierto meses después aparece enorme."
            >
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      {["Ticket", "Tema", "Creado", "Cerrado", "Tardó"].map((h) => (
                        <th
                          key={h}
                          className="px-3 py-2 text-left text-[11px] font-semibold text-gray-500 uppercase last:text-right"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {datos.peores.map((t) => (
                      <tr key={t.numero}>
                        <td className="px-3 py-1.5 font-mono text-gray-900">
                          {t.numero}
                          {t.fueReabierto && (
                            <span className="ml-2 text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full">
                              reabierto
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-1.5 text-gray-600">{t.tema}</td>
                        <td className="px-3 py-1.5 text-gray-500 whitespace-nowrap">{t.creado}</td>
                        <td className="px-3 py-1.5 text-gray-500 whitespace-nowrap">{t.cerrado}</td>
                        <td
                          className={`px-3 py-1.5 text-right tabular-nums font-semibold ${
                            t.fueReabierto ? "text-gray-400" : "text-gray-900"
                          }`}
                        >
                          {dur(t.horas)}
                        </td>
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
