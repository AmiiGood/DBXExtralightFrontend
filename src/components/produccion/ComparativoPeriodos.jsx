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
import { ArrowRight, TrendingUp, TrendingDown, Minus, AlertTriangle } from "lucide-react";
import { inyeccionService } from "../../services/inyeccion.service";

/**
 * Comparativo de dos periodos: mes, trimestre, semestre o año.
 *
 * Todo se compara POR BU y nunca en total: unfin, strap, suela y almohada son
 * componentes distintos y no se suman entre sí.
 *
 * Ojo con los signos: en producción subir es bueno, en scrap subir es malo.
 * El delta de %Scrap va en puntos porcentuales, no en variación relativa.
 */

// Los dos periodos que se comparan. Se toman de la paleta del reporte para que
// no aparezcan colores nuevos: el verde es el de Almohada y el azul el primario.
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

const num = (n) =>
  n == null ? "—" : Number(n).toLocaleString("es-MX", { maximumFractionDigits: 0 });
const pct = (n) => (n == null ? "—" : `${Number(n).toFixed(2)}%`);
const signo = (n, sufijo = "") =>
  n == null ? "—" : `${n > 0 ? "+" : ""}${Number(n).toFixed(2)}${sufijo}`;

/** Etiqueta del selector de número según el tipo de periodo. */
function opcionesNumero(tipo) {
  if (tipo === "mes") return MESES.map((m, i) => ({ v: i + 1, t: m }));
  if (tipo === "trimestre")
    return [1, 2, 3, 4].map((n) => ({ v: n, t: `T${n}` }));
  if (tipo === "semestre")
    return [1, 2].map((n) => ({
      v: n,
      t: n === 1 ? "S1 (ene–jun)" : "S2 (jul–dic)",
    }));
  return [];
}

/** Flecha + color. `bueno` invierte el criterio para métricas donde subir es malo. */
function Variacion({ valor, sufijo = "%", subirEsBueno = true }) {
  if (valor == null) return <span className="text-gray-300">—</span>;
  const plano = Math.abs(valor) < 0.005;
  const positivo = valor > 0;
  const favorable = plano ? null : positivo === subirEsBueno;
  const Icono = plano ? Minus : positivo ? TrendingUp : TrendingDown;
  const color = plano
    ? "text-gray-400"
    : favorable
      ? "text-emerald-600"
      : "text-red-600";
  return (
    <span className={`inline-flex items-center gap-1 font-medium ${color}`}>
      <Icono className="w-3.5 h-3.5" />
      {signo(valor, sufijo)}
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
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
        {nums.length > 0 && (
          <select
            value={valor.numero}
            onChange={(e) => onChange({ ...valor, numero: Number(e.target.value) })}
            className="flex-1 border border-gray-200 rounded-lg px-2 py-2 text-sm"
          >
            {nums.map((o) => (
              <option key={o.v} value={o.v}>{o.t}</option>
            ))}
          </select>
        )}
      </div>
    </div>
  );
}

export default function ComparativoPeriodos({
  anios,
  colorBu,
  buFiltradas,
  onDatos,
}) {
  const [tipo, setTipo] = useState("mes");
  const ultimoAnio = anios[0];
  const anteriorAnio = anios[1] ?? anios[0];

  const [a, setA] = useState({ anio: anteriorAnio, numero: 1 });
  const [b, setB] = useState({ anio: ultimoAnio, numero: 1 });
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(null);

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
    inyeccionService
      .comparar(tipo, a, b, buFiltradas)
      .then((d) => {
        setDatos(d);
        // La página lo necesita para incluirlo en la exportación a Excel
        onDatos?.(d);
      })
      .catch((e) => setError(e.response?.data?.errors?.[0]?.msg || e.message))
      .finally(() => setCargando(false));
  }, [tipo, a, b, buFiltradas, onDatos]);

  const datosGrafica = useMemo(
    () =>
      (datos?.delta || []).map((r) => ({
        bu: r.bu,
        [datos.a.etiqueta]: r.produccionA,
        [datos.b.etiqueta]: r.produccionB,
      })),
    [datos],
  );

  const parciales = [datos?.a, datos?.b].filter((x) => x?.parcial);

  return (
    <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 space-y-5">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-1">
          Comparativo entre periodos
        </h3>
        <p className="text-xs text-gray-400">
          Se compara por unidad de negocio; no se suman entre sí
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
              <option key={t.id} value={t.id}>{t.nombre}</option>
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
            {parciales.length === 2 ? "Ambos periodos están" : "El periodo "}
            {parciales.length === 1 && (
              <strong>{parciales[0].etiqueta} está </strong>
            )}
            incompleto: solo hay captura hasta el{" "}
            {parciales.map((p) => p.hastaConDatos).join(" y el ")}. La
            comparación no es contra un periodo completo.
          </span>
        </div>
      )}

      {cargando && <p className="text-gray-400 text-sm py-8 text-center">Cargando...</p>}

      {datos && !cargando && (
        <>
          {/* Gráfica de producción lado a lado */}
          <div data-grafica="comparativo">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={datosGrafica} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="bu" tick={{ fontSize: 11 }} />
              <YAxis
                tick={{ fontSize: 12 }}
                tickFormatter={(v) => (v >= 1000 ? `${v / 1000}k` : v)}
              />
              <Tooltip formatter={(v) => num(v)} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey={datos.a.etiqueta} fill={COLOR_A} />
              <Bar dataKey={datos.b.etiqueta} fill={COLOR_B} />
            </BarChart>
          </ResponsiveContainer>
          </div>

          {/* Tabla de deltas */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-2 text-xs font-semibold text-gray-500 uppercase">BU</th>
                  <th className="text-right py-2 text-xs font-semibold text-gray-500 uppercase" colSpan={3}>
                    Piezas producidas
                  </th>
                  <th className="text-right py-2 text-xs font-semibold text-gray-500 uppercase" colSpan={3}>
                    % Scrap
                  </th>
                </tr>
                <tr className="border-b border-gray-100">
                  <th />
                  <th className="text-right py-1 text-[11px] font-normal text-gray-400">{datos.a.etiqueta}</th>
                  <th className="text-right py-1 text-[11px] font-normal text-gray-400">{datos.b.etiqueta}</th>
                  <th className="text-right py-1 text-[11px] font-normal text-gray-400">Variación</th>
                  <th className="text-right py-1 text-[11px] font-normal text-gray-400">{datos.a.etiqueta}</th>
                  <th className="text-right py-1 text-[11px] font-normal text-gray-400">{datos.b.etiqueta}</th>
                  <th className="text-right py-1 text-[11px] font-normal text-gray-400">Puntos</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {datos.delta.map((r) => (
                  <tr key={r.bu}>
                    <td className="py-2">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-3 h-3 rounded-sm"
                          style={{ backgroundColor: colorBu[r.bu] || "#d1d5db" }}
                        />
                        <span className="text-gray-900">{r.bu}</span>
                      </div>
                    </td>
                    <td className="py-2 text-right text-gray-500">{num(r.produccionA)}</td>
                    <td className="py-2 text-right text-gray-900 font-medium">{num(r.produccionB)}</td>
                    <td className="py-2 text-right">
                      <Variacion valor={r.produccionVariacion} subirEsBueno />
                    </td>
                    <td className="py-2 text-right text-gray-500">{pct(r.pctScrapA)}</td>
                    <td className="py-2 text-right text-gray-900 font-medium">{pct(r.pctScrapB)}</td>
                    <td className="py-2 text-right">
                      <Variacion valor={r.pctScrapDelta} sufijo=" pp" subirEsBueno={false} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="text-xs text-gray-400">
            El % Scrap se compara en puntos porcentuales (pp), no en variación
            relativa. Verde es mejora: más producción o menos scrap.
          </p>
        </>
      )}
    </div>
  );
}
