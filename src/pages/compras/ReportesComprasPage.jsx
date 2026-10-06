import { useState, useEffect, useCallback } from "react";
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
import { Timer, Loader2, Info, AlertTriangle } from "lucide-react";
import { comprasService } from "../../services/compras.service";

/**
 * Reportes de Compras: la "medición" que promete la propuesta — cuánto tarda
 * cada área en aprobar y cuántas solicitudes se rechazan.
 *
 * Igual que Moldes y TI, la métrica es la MEDIANA con su p90; el promedio va
 * en gris. Las horas son de reloj, no hábiles: un viernes en la tarde que se
 * aprueba el lunes cuenta todo el fin de semana, porque eso es lo que esperó
 * quien pidió.
 *
 * Lo que pidió el propio gerente nace aprobado en cero segundos: cuenta como
 * solicitud pero no entra ni al tiempo de decisión ni a la tasa de rechazo.
 */

const AZUL = "#236093";
const COLORES = { aprobadas: "#16a34a", rechazadas: "#dc2626", pendientes: "#f59e0b", canceladas: "#9ca3af" };
const POCOS = 5;

const hoy = () => new Date().toLocaleDateString("en-CA");
const haceDias = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toLocaleDateString("en-CA");
};

const PERIODOS = [
  { id: "30", texto: "30 días", desde: () => haceDias(30) },
  { id: "90", texto: "90 días", desde: () => haceDias(90) },
  { id: "anio", texto: "Este año", desde: () => `${new Date().getFullYear()}-01-01` },
];

/** 0.4 → "24 min"; 5.25 → "5.3 h"; 70 → "2.9 días" */
function duracion(h) {
  if (h == null) return "—";
  if (h < 1) return `${Math.round(h * 60)} min`;
  if (h < 48) return `${h.toFixed(1)} h`;
  return `${(h / 24).toFixed(1)} días`;
}

const pct = (v) => (v == null ? "—" : `${v.toFixed(1)}%`);
const fecha = (s) => new Date(s).toLocaleString("es-MX", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
const semana = (s) => new Date(`${s}T12:00:00`).toLocaleDateString("es-MX", { day: "2-digit", month: "short" });

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

const Seccion = ({ titulo, nota, children }) => (
  <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
    <h2 className="font-semibold text-gray-900">{titulo}</h2>
    {nota && <p className="text-xs text-gray-400 mt-0.5 max-w-3xl">{nota}</p>}
    <div className="mt-4">{children}</div>
  </div>
);

export default function ReportesComprasPage() {
  const [periodo, setPeriodo] = useState({ id: "90", desde: haceDias(90), hasta: hoy() });
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState(null);
  const [cargando, setCargando] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      setDatos(await comprasService.getReporte(periodo));
    } catch (e) {
      setError(e.response?.data?.message || e.message);
    } finally {
      setCargando(false);
    }
  }, [periodo]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const r = datos?.resumen;
  const masVieja = datos?.pendientes[0];

  return (
    <div className="p-6 space-y-5 max-w-7xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-[#236093]/10 rounded-lg">
            <Timer className="w-6 h-6 text-[#236093]" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Reportes de Compras</h1>
            <p className="text-sm text-gray-500">Cuánto tarda cada área en aprobar y cuántas solicitudes se rechazan</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {PERIODOS.map((p) => (
            <button
              key={p.id}
              onClick={() => setPeriodo({ id: p.id, desde: p.desde(), hasta: hoy() })}
              className={`px-3 py-1.5 text-sm rounded-lg border ${
                periodo.id === p.id ? "bg-[#236093] border-[#236093] text-white" : "border-gray-200 text-gray-600 hover:bg-gray-50"
              }`}
            >
              {p.texto}
            </button>
          ))}
          <input
            type="date"
            value={periodo.desde}
            max={periodo.hasta}
            onChange={(e) => e.target.value && setPeriodo((p) => ({ ...p, id: null, desde: e.target.value }))}
            className="text-sm border border-gray-200 rounded-lg px-2 py-1.5"
          />
          <span className="text-gray-400 text-sm">a</span>
          <input
            type="date"
            value={periodo.hasta}
            min={periodo.desde}
            onChange={(e) => e.target.value && setPeriodo((p) => ({ ...p, id: null, hasta: e.target.value }))}
            className="text-sm border border-gray-200 rounded-lg px-2 py-1.5"
          />
          {cargando && <Loader2 className="w-4 h-4 animate-spin text-gray-400" />}
        </div>
      </div>

      {error && <div className="bg-red-50 text-red-700 p-4 rounded-xl text-sm">{error}</div>}

      {!datos ? (
        !error && (
          <div className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
          </div>
        )
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <Tarjeta
              titulo="Solicitudes"
              valor={r.total.toLocaleString("es-MX")}
              detalle={`${r.aprobadas} aprobadas · ${r.rechazadas} rechazadas · ${r.canceladas} canceladas`}
            />
            <Tarjeta
              titulo="Tiempo para decidir"
              valor={duracion(r.mediana_horas)}
              color={AZUL}
              detalle={r.decididas ? `mediana · p90 ${duracion(r.p90_horas)} · promedio ${duracion(r.promedio_horas)}` : "nada decidido en el periodo"}
              aviso="Desde que se pide hasta que el gerente o suplente decide. Horas de reloj, no hábiles. No cuenta lo que pidió el propio gerente."
            />
            <Tarjeta
              titulo="Rechazo"
              valor={pct(r.pct_rechazo)}
              color={r.pct_rechazo > 20 ? "#dc2626" : undefined}
              detalle={`${r.rechazadas} de ${r.decididas} revisadas`}
              aviso={`Sobre las que revisó un gerente o suplente. Las ${r.propias} que pidió el propio gerente pasaron directo y no cuentan.`}
            />
            <Tarjeta
              titulo="Aprobada → Compras"
              valor={r.mediana_minutos_envio == null ? "—" : duracion(r.mediana_minutos_envio / 60)}
              detalle={r.sin_ticket ? `${r.sin_ticket} aprobada(s) aún sin ticket` : "todas las aprobadas llegaron"}
              color={r.sin_ticket ? "#b45309" : undefined}
              aviso="Mediana entre la aprobación y la creación del ticket en el osTicket de Compras."
            />
            <Tarjeta
              titulo="Esperando ahora"
              valor={datos.pendientes.length}
              color={masVieja?.horas >= 72 ? "#dc2626" : masVieja?.horas >= 24 ? "#b45309" : undefined}
              detalle={masVieja ? `la más vieja lleva ${duracion(masVieja.horas)}` : "nada pendiente"}
              aviso="Sin importar el periodo elegido: lo que espera hoy."
            />
          </div>

          <Seccion
            titulo="Solicitudes por semana"
            nota="Por fecha en que se pidieron. Las pendientes de semanas pasadas siguen esperando decisión."
          >
            {datos.semanal.length === 0 ? (
              <p className="text-sm text-gray-400 py-8 text-center">Sin solicitudes en el periodo</p>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={datos.semanal} margin={{ top: 5, right: 10, left: -10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="semana" tickFormatter={semana} tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip labelFormatter={(s) => `Semana del ${semana(s)}`} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="aprobadas" name="Aprobadas" stackId="a" fill={COLORES.aprobadas} />
                  <Bar dataKey="rechazadas" name="Rechazadas" stackId="a" fill={COLORES.rechazadas} />
                  <Bar dataKey="pendientes" name="Pendientes" stackId="a" fill={COLORES.pendientes} />
                  <Bar dataKey="canceladas" name="Canceladas" stackId="a" fill={COLORES.canceladas} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </Seccion>

          <Seccion
            titulo="Por área"
            nota={`Mediana y p90 del tiempo para decidir. Con menos de ${POCOS} solicitudes revisadas la cifra se marca: un solo caso la mueve mucho.`}
          >
            {datos.porArea.length === 0 ? (
              <p className="text-sm text-gray-400">Sin solicitudes en el periodo</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-500 border-b border-gray-100">
                      <th className="py-2 pr-3 font-medium">Área</th>
                      <th className="py-2 px-3 font-medium text-right">Solicitudes</th>
                      <th className="py-2 px-3 font-medium text-right">Pendientes</th>
                      <th className="py-2 px-3 font-medium text-right">Rechazo</th>
                      <th className="py-2 px-3 font-medium text-right">Mediana</th>
                      <th className="py-2 pl-3 font-medium text-right">p90</th>
                    </tr>
                  </thead>
                  <tbody>
                    {datos.porArea.map((a) => {
                      const pocos = a.decididas < POCOS;
                      return (
                        <tr key={a.id} className="border-b border-gray-50 last:border-0">
                          <td className="py-2 pr-3 text-gray-900">
                            {a.area}
                            {pocos && a.decididas > 0 && (
                              <span className="ml-2 text-xs text-gray-400">pocos datos</span>
                            )}
                          </td>
                          <td className="py-2 px-3 text-right">{a.total}</td>
                          <td className={`py-2 px-3 text-right ${a.pendientes ? "text-amber-600" : "text-gray-400"}`}>{a.pendientes}</td>
                          <td className="py-2 px-3 text-right">
                            {pct(a.pct_rechazo)}
                            <span className="block text-xs text-gray-400">{a.rechazadas} de {a.decididas}</span>
                          </td>
                          <td className={`py-2 px-3 text-right font-medium ${pocos ? "text-gray-400" : "text-[#236093]"}`}>
                            {duracion(a.mediana_horas)}
                          </td>
                          <td className="py-2 pl-3 text-right text-gray-500">{duracion(a.p90_horas)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Seccion>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
            <Seccion titulo="Esperando decisión ahora" nota="Lo más viejo arriba. Ámbar pasado un día, rojo pasados tres.">
              {datos.pendientes.length === 0 ? (
                <p className="text-sm text-gray-400">Nada pendiente.</p>
              ) : (
                <table className="w-full text-sm">
                  <tbody>
                    {datos.pendientes.map((p) => (
                      <tr key={p.id} className="border-b border-gray-50 last:border-0 align-top">
                        <td className="py-2 pr-3">
                          <p className="text-gray-900">
                            <span className="font-mono text-xs text-gray-400 mr-2">{p.folio}</span>
                            {p.asunto}
                          </p>
                          <p className="text-xs text-gray-400">
                            {p.area} · pidió {p.solicitante} · aprueba {p.gerente || "nadie asignado"}
                            {p.suplente && ` o ${p.suplente}`}
                          </p>
                        </td>
                        <td
                          className={`py-2 text-right whitespace-nowrap font-medium ${
                            p.horas >= 72 ? "text-red-600" : p.horas >= 24 ? "text-amber-600" : "text-gray-500"
                          }`}
                        >
                          {p.horas >= 72 && <AlertTriangle className="w-3.5 h-3.5 inline mr-1" />}
                          {duracion(p.horas)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Seccion>

            <Seccion titulo="Por qué se rechaza" nota="Los motivos dicen más que la tasa. Los últimos del periodo.">
              {datos.rechazos.length === 0 ? (
                <p className="text-sm text-gray-400">Ningún rechazo en el periodo.</p>
              ) : (
                <ul className="space-y-3">
                  {datos.rechazos.map((x) => (
                    <li key={x.id} className="text-sm">
                      <p className="text-gray-800">“{x.motivo}”</p>
                      <p className="text-xs text-gray-400">
                        {x.folio} · {x.asunto} · {x.area} · {x.decidio}, {fecha(x.decidido_en)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </Seccion>
          </div>
        </>
      )}
    </div>
  );
}
