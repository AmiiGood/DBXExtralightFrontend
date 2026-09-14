import { useState, useEffect, useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import {
  ArrowRight,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
} from "lucide-react";
import { moldesService } from "../../services/moldes.service";

/**
 * Comparativo de dos periodos: mes, trimestre, semestre o año.
 *
 * Cuidado con los signos: aquí BAJAR ES BUENO. Un tiempo de resolución que baja
 * es una mejora, al revés que la producción del reporte de Inyección. El conteo
 * de tickets no se colorea: que entren más o menos tickets depende de la
 * operación, no del desempeño del área.
 */

// Los dos periodos que se comparan, con los mismos colores del resto del sistema
const COLOR_A = "#49a090";
const COLOR_B = "#236093";

const TIPOS = [
  { id: "mes", nombre: "Mes", tope: 12 },
  { id: "trimestre", nombre: "Trimestre", tope: 4 },
  { id: "semestre", nombre: "Semestre", tope: 2 },
  { id: "anio", nombre: "Año", tope: 1 },
];

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

/** Mínimo de tickets cerrados para que la mediana de un tema signifique algo. */
const MINIMO_PARA_GRAFICAR = 30;

const num = (n) =>
  n == null ? "—" : Number(n).toLocaleString("es-MX", { maximumFractionDigits: 0 });

const signo = (n, sufijo = "%") =>
  n == null ? "—" : `${n > 0 ? "+" : ""}${Number(n).toFixed(1)}${sufijo}`;

/** Etiqueta del selector de número según el tipo de periodo. */
function opcionesNumero(tipo) {
  if (tipo === "mes") return MESES.map((m, i) => ({ v: i + 1, t: m }));
  if (tipo === "trimestre") return [1, 2, 3, 4].map((n) => ({ v: n, t: `T${n}` }));
  if (tipo === "semestre")
    return [1, 2].map((n) => ({
      v: n,
      t: n === 1 ? "S1 (ene–jun)" : "S2 (jul–dic)",
    }));
  return [];
}

/**
 * Flecha + color. En los tiempos de atención bajar es mejorar, así que el
 * criterio va invertido respecto a lo habitual; `neutro` apaga el color para
 * las métricas que no son ni buenas ni malas.
 */
function Variacion({ valor, neutro = false }) {
  if (valor == null) return <span className="text-gray-300">—</span>;
  const plano = Math.abs(valor) < 0.05;
  const Icono = plano ? Minus : valor > 0 ? TrendingUp : TrendingDown;
  const color = neutro
    ? "text-gray-500"
    : plano
      ? "text-gray-400"
      : valor < 0
        ? "text-emerald-600"
        : "text-red-600";
  return (
    <span className={`inline-flex items-center gap-1 font-medium ${color}`}>
      <Icono className="w-3.5 h-3.5" />
      {signo(valor)}
    </span>
  );
}

function SelectorPeriodo({ etiqueta, tipo, anios, valor, onChange, color }) {
  const nums = opcionesNumero(tipo);
  return (
    <div className="flex-1 min-w-52">
      <label className="block text-xs font-medium mb-1" style={{ color }}>
        {etiqueta}
      </label>
      <div className="flex gap-2">
        <select
          value={valor.anio}
          onChange={(e) => onChange({ ...valor, anio: Number(e.target.value) })}
          className="border border-gray-200 rounded-lg px-2 py-2 text-sm"
        >
          {anios.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
        {nums.length > 0 && (
          <select
            value={valor.numero}
            onChange={(e) =>
              onChange({ ...valor, numero: Number(e.target.value) })
            }
            className="flex-1 border border-gray-200 rounded-lg px-2 py-2 text-sm"
          >
            {nums.map((o) => (
              <option key={o.v} value={o.v}>
                {o.t}
              </option>
            ))}
          </select>
        )}
      </div>
    </div>
  );
}

export default function ComparativoMoldes({ anios, temas, formatoHoras, onDatos }) {
  const [tipo, setTipo] = useState("anio");
  const ultimoAnio = anios[0];
  const anteriorAnio = anios[1] ?? anios[0];

  const [a, setA] = useState({ anio: anteriorAnio, numero: 1 });
  const [b, setB] = useState({ anio: ultimoAnio, numero: 1 });
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(null);

  const horas = formatoHoras;

  // Al cambiar de tipo, un número fuera de rango dejaría la consulta inválida
  useEffect(() => {
    const tope = TIPOS.find((t) => t.id === tipo).tope;
    setA((v) => ({ ...v, numero: Math.min(v.numero, tope) }));
    setB((v) => ({ ...v, numero: Math.min(v.numero, tope) }));
  }, [tipo]);

  useEffect(() => {
    if (!a.anio || !b.anio) return;
    const mismo =
      a.anio === b.anio && (tipo === "anio" || a.numero === b.numero);
    if (mismo) {
      setDatos(null);
      onDatos?.(null);
      setError("Elige dos periodos distintos para comparar");
      return;
    }
    setCargando(true);
    setError(null);
    moldesService
      .comparar(tipo, a, b, temas)
      .then((d) => {
        setDatos(d);
        // La página lo necesita para incluirlo en la exportación a Excel
        onDatos?.(d);
      })
      .catch((e) => setError(e.response?.data?.message || e.message))
      .finally(() => setCargando(false));
  }, [tipo, a, b, temas, onDatos]);

  const datosGrafica = useMemo(() => {
    if (!datos) return [];
    return datos.delta
      .filter(
        (d) =>
          d.cerradosA >= MINIMO_PARA_GRAFICAR &&
          d.cerradosB >= MINIMO_PARA_GRAFICAR,
      )
      .slice(0, 10)
      .map((d) => ({
        tema: d.temaCorto,
        [datos.a.etiqueta]: d.medianaA,
        [datos.b.etiqueta]: d.medianaB,
      }));
  }, [datos]);

  const parciales = [datos?.a, datos?.b].filter((x) => x?.parcial);

  return (
    <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 space-y-5">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-1">
          Comparativo entre periodos
        </h3>
        <p className="text-xs text-gray-400">
          Se compara la mediana de resolución, tema por tema
        </p>
      </div>

      {/* Selección */}
      <div className="flex flex-wrap gap-4 items-end">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">
            Comparar por
          </label>
          <select
            value={tipo}
            onChange={(e) => setTipo(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm min-w-32"
          >
            {TIPOS.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nombre}
              </option>
            ))}
          </select>
        </div>
        <SelectorPeriodo
          etiqueta="Periodo A"
          tipo={tipo}
          anios={anios}
          valor={a}
          onChange={setA}
          color={COLOR_A}
        />
        <div className="pb-2.5">
          <ArrowRight className="w-5 h-5 text-gray-300" />
        </div>
        <SelectorPeriodo
          etiqueta="Periodo B"
          tipo={tipo}
          anios={anios}
          valor={b}
          onChange={setB}
          color={COLOR_B}
        />
      </div>

      {error && (
        <div className="bg-amber-50 border border-amber-200 text-amber-700 rounded-lg p-3 text-sm">
          {error}
        </div>
      )}

      {parciales.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-lg p-3 text-sm flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>
            {parciales.length === 2 ? (
              "Los dos periodos están incompletos"
            ) : (
              <>
                <strong>{parciales[0].etiqueta}</strong> todavía no termina
              </>
            )}
            : solo hay tickets hasta el {parciales[0].hastaConDatos}. El conteo
            de tickets no es comparable; los tiempos de resolución sí, porque no
            dependen del tamaño del periodo.
          </span>
        </div>
      )}

      {cargando && (
        <p className="text-gray-400 text-sm py-8 text-center">Cargando...</p>
      )}

      {datos && !cargando && (
        <>
          {/* Resumen */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              {
                titulo: "Tiempo típico",
                a: datos.a.medianaHoras,
                b: datos.b.medianaHoras,
                v: datos.variacion.mediana,
              },
              {
                titulo: "9 de cada 10",
                a: datos.a.p90Horas,
                b: datos.b.p90Horas,
                v: datos.variacion.p90,
              },
              {
                titulo: "Tickets",
                a: datos.a.tickets,
                b: datos.b.tickets,
                v: datos.variacion.tickets,
                conteo: true,
              },
            ].map((m) => (
              <div
                key={m.titulo}
                className="border border-gray-100 rounded-lg p-4"
              >
                <p className="text-xs text-gray-500">{m.titulo}</p>
                <div className="flex items-baseline gap-2 mt-1.5">
                  <span className="text-sm" style={{ color: COLOR_A }}>
                    {m.conteo ? num(m.a) : horas(m.a)}
                  </span>
                  <ArrowRight className="w-3 h-3 text-gray-300" />
                  <span
                    className="text-xl font-bold"
                    style={{ color: COLOR_B }}
                  >
                    {m.conteo ? num(m.b) : horas(m.b)}
                  </span>
                </div>
                <div className="mt-1.5 text-sm">
                  <Variacion valor={m.v} neutro={m.conteo} />
                </div>
              </div>
            ))}
          </div>

          {/* Mediana por tema, lado a lado */}
          {datosGrafica.length > 0 && (
            <div data-grafica="comparativo">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart
                data={datosGrafica}
                margin={{ top: 8, right: 16, bottom: 8, left: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis
                  dataKey="tema"
                  tick={{ fontSize: 11 }}
                  angle={-25}
                  textAnchor="end"
                  height={80}
                  // Sin esto recharts esconde etiquetas para que no se
                  // encimen, y quedan barras sin nombre
                  interval={0}
                />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={horas} />
                <Tooltip formatter={(v) => horas(v)} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey={datos.a.etiqueta} fill={COLOR_A} />
                <Bar dataKey={datos.b.etiqueta} fill={COLOR_B} />
              </BarChart>
            </ResponsiveContainer>
            </div>
          )}

          {/* Tabla de deltas */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-2 text-xs font-semibold text-gray-500 uppercase">
                    Tema
                  </th>
                  <th
                    className="text-right py-2 text-xs font-semibold text-gray-500 uppercase"
                    colSpan={3}
                  >
                    Tiempo típico
                  </th>
                  <th
                    className="text-right py-2 text-xs font-semibold text-gray-500 uppercase"
                    colSpan={3}
                  >
                    Tickets
                  </th>
                </tr>
                <tr className="border-b border-gray-100">
                  <th />
                  {[datos.a.etiqueta, datos.b.etiqueta, "Variación"].map((h) => (
                    <th
                      key={`m-${h}`}
                      className="text-right py-1 text-[11px] font-normal text-gray-400"
                    >
                      {h}
                    </th>
                  ))}
                  {[datos.a.etiqueta, datos.b.etiqueta, "Variación"].map((h) => (
                    <th
                      key={`t-${h}`}
                      className="text-right py-1 text-[11px] font-normal text-gray-400"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {datos.delta.map((r) => {
                  // Con muy pocos tickets cerrados la mediana salta por nada;
                  // se muestra apagada para que no se lea como una tendencia.
                  const pocos =
                    r.cerradosA < MINIMO_PARA_GRAFICAR ||
                    r.cerradosB < MINIMO_PARA_GRAFICAR;
                  return (
                    <tr key={r.tema} className={pocos ? "text-gray-400" : ""}>
                      <td className="py-2 text-gray-900">
                        {r.temaCorto}
                        {pocos && (
                          <span className="ml-1.5 text-[10px] text-gray-400">
                            pocos datos
                          </span>
                        )}
                      </td>
                      <td className="py-2 text-right text-gray-500">
                        {horas(r.medianaA)}
                      </td>
                      <td className="py-2 text-right font-medium">
                        {horas(r.medianaB)}
                      </td>
                      <td className="py-2 text-right">
                        {pocos ? (
                          <span className="text-gray-300">—</span>
                        ) : (
                          <Variacion valor={r.medianaVariacion} />
                        )}
                      </td>
                      <td className="py-2 text-right text-gray-500">
                        {num(r.ticketsA)}
                      </td>
                      <td className="py-2 text-right font-medium">
                        {num(r.ticketsB)}
                      </td>
                      <td className="py-2 text-right">
                        <Variacion valor={r.ticketsVariacion} neutro />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <p className="text-xs text-gray-400">
            En los tiempos de atención verde es mejora: bajar significa resolver
            más rápido. El conteo de tickets va en gris porque depende de la
            operación, no del desempeño del área.
          </p>
        </>
      )}
    </div>
  );
}
