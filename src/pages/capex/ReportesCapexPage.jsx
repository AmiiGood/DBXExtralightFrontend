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
import {
  TrendingUp,
  Loader2,
  RefreshCw,
  AlertTriangle,
  FolderCog,
  Info,
} from "lucide-react";
import { capexService } from "../../services/capex.service";
import { useAuthStore } from "../../stores/auth.store";

/**
 * Reporte de CAPEX.
 *
 * Enseña SOLO los proyectos del bloque CAPEX 2026 que ya tienen Firmas FOAM
 * en verde: es el final del proceso interno, y lo que sigue (firmas de
 * Italia) ya no entra. El área pidió no enseñar el resto del avance porque en
 * el libro no está al día.
 *
 * Un código puede tener varios renglones (26-MEX-05 'Wood audit' son seis
 * sub-proyectos) y cada uno cuenta por separado, con su propia nota para
 * distinguirlos.
 */

const AZUL = "#236093";
const VERDE = "#49a090";

const eur = (n) =>
  n == null ? "—" : `${Number(n).toLocaleString("es-MX", { maximumFractionDigits: 0 })} €`;

/** Para los ejes: 420 k €. */
const eurCorto = (n) =>
  Math.abs(n) >= 1000
    ? `${(n / 1000).toLocaleString("es-MX", { maximumFractionDigits: 0 })} k €`
    : `${n} €`;

function Tarjeta({ titulo, valor, detalle, color }) {
  return (
    <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-100">
      <p className="text-sm text-gray-500">{titulo}</p>
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

/**
 * De qué libro y de cuándo es el dato. Va arriba y en rojo si falló la
 * lectura: el reporte seguiría enseñando lo último bueno sin decir nada.
 */
function EstadoArchivo({ archivo, onSincronizar, sincronizando, puedeSincronizar }) {
  if (!archivo) return null;
  return (
    <div
      className={`rounded-xl border p-4 ${
        archivo.error ? "bg-red-50 border-red-200" : "bg-gray-50 border-gray-200"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="text-sm flex items-start gap-2">
          {archivo.error ? (
            <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
          ) : (
            <FolderCog className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
          )}
          <div>
            <span className="font-medium text-gray-700">
              {archivo.archivo || "Todavía no se ha leído el libro"}
            </span>
            {archivo.error ? (
              <span className="text-red-700"> — {archivo.error}</span>
            ) : (
              archivo.leido && (
                <span className="text-gray-500">
                  {" "}
                  — hoja "{archivo.hoja}", bloque {archivo.bloque}. Leído el {archivo.leido}
                </span>
              )
            )}
          </div>
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

export default function ReportesCapexPage() {
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState(null);
  const [sincronizando, setSincronizando] = useState(false);
  const usuario = useAuthStore((s) => s.user);
  const esAdmin = Boolean(usuario?.rol?.esAdmin);

  const cargar = useCallback(async () => {
    try {
      setDatos(await capexService.getReporte());
      setError(null);
    } catch (e) {
      setError(e.response?.data?.message || e.message);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const sincronizar = async () => {
    setSincronizando(true);
    try {
      await capexService.sincronizar();
      await cargar();
    } catch (e) {
      setError(e.response?.data?.message || e.message);
    } finally {
      setSincronizando(false);
    }
  };

  if (error && !datos) {
    return (
      <div className="p-6">
        <div className="bg-red-50 text-red-700 p-4 rounded-xl">{error}</div>
      </div>
    );
  }
  if (!datos) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  const { resumen: r, proyectos, trimestres } = datos;
  const etiqueta = (p) => (p.notas ? `${p.codigo} · ${p.notas}` : p.codigo);
  const grafica = proyectos.map((p) => ({
    nombre: etiqueta(p),
    Presupuesto: p.monto || 0,
    Gastado: p.gastado || 0,
  }));
  const total = (k) => proyectos.reduce((a, p) => a + (p[k] || 0), 0);

  return (
    <div className="p-6 space-y-5 max-w-7xl mx-auto">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-[#236093]/10 rounded-lg">
          <TrendingUp className="w-6 h-6 text-[#236093]" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Reporte de CAPEX</h1>
          <p className="text-sm text-gray-500">
            Proyectos del {r.bloque || "CAPEX 2026"} con firmas FOAM
          </p>
        </div>
      </div>

      <EstadoArchivo
        archivo={datos.archivo}
        onSincronizar={sincronizar}
        sincronizando={sincronizando}
        puedeSincronizar={esAdmin}
      />

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-900 flex items-start gap-2">
        <Info className="w-4 h-4 mt-0.5 shrink-0" />
        <span>
          Solo entran los proyectos con <b>Firmas FOAM</b> en verde en el libro: ya
          terminaron el proceso interno. Las firmas de Italia no se consideran. Los
          renglones que el área tiene ocultos en el libro tampoco.
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Tarjeta
          titulo="Proyectos con firmas FOAM"
          valor={r.aprobados}
          detalle={`de ${r.renglones} renglones del ${r.bloque || "bloque"}`}
          color={AZUL}
        />
        <Tarjeta
          titulo="Monto con firmas FOAM"
          valor={eur(r.monto_aprobado)}
          detalle={
            r.pctPresupuesto == null
              ? null
              : `${(r.pctPresupuesto * 100).toFixed(1)}% de ${eur(r.presupuesto)} del ${r.bloque}`
          }
          color={VERDE}
        />
        <Tarjeta titulo="Gastado" valor={eur(r.gastado_aprobado)} detalle="de esos proyectos" />
        <Tarjeta titulo="Por ejercer" valor={eur(r.porEjercer)} detalle="monto menos gastado" />
      </div>

      {proyectos.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 p-10 text-center text-gray-400">
          Ningún proyecto del bloque tiene todavía Firmas FOAM en verde.
        </div>
      ) : (
        <>
          <Seccion
            titulo="Monto y gastado por proyecto"
            nota="Monto a gastar en 2026 según el libro, contra lo gastado a la fecha."
          >
            <ResponsiveContainer width="100%" height={Math.max(180, grafica.length * 56)}>
              <BarChart data={grafica} layout="vertical" margin={{ left: 10, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" tickFormatter={eurCorto} fontSize={12} />
                <YAxis type="category" dataKey="nombre" width={210} fontSize={12} />
                <Tooltip formatter={(v) => eur(v)} />
                <Legend />
                <Bar dataKey="Presupuesto" fill={AZUL} radius={[0, 4, 4, 0]} />
                <Bar dataKey="Gastado" fill={VERDE} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Seccion>

          <Seccion
            titulo="Detalle"
            nota="Los gastos por trimestre y el gastado vienen tal cual del libro."
          >
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 border-b border-gray-100">
                    <th className="py-2 pr-3 font-medium">Código</th>
                    <th className="py-2 pr-3 font-medium">Proyecto</th>
                    <th className="py-2 pr-3 font-medium">Dueño</th>
                    <th className="py-2 pr-3 font-medium text-right">Monto 2026</th>
                    <th className="py-2 pr-3 font-medium text-right">Relación técnica</th>
                    {trimestres.map((t) => (
                      <th key={t.trimestre} className="py-2 pr-3 font-medium text-right">
                        {t.trimestre}
                      </th>
                    ))}
                    <th className="py-2 font-medium text-right">Gastado</th>
                  </tr>
                </thead>
                <tbody>
                  {proyectos.map((p) => (
                    <tr key={p.id} className="border-b border-gray-50 last:border-0 align-top">
                      <td className="py-2 pr-3 font-mono text-xs text-gray-600 whitespace-nowrap">
                        {p.codigo}
                      </td>
                      <td className="py-2 pr-3 text-gray-800">
                        {p.descripcion}
                        {p.notas && <p className="text-xs text-gray-400">{p.notas}</p>}
                      </td>
                      <td className="py-2 pr-3 text-gray-600 whitespace-nowrap">{p.dueno || "—"}</td>
                      <td className="py-2 pr-3 text-right whitespace-nowrap">
                        {p.monto == null ? p.monto_texto || "—" : eur(p.monto)}
                      </td>
                      <td className="py-2 pr-3 text-right text-gray-600 whitespace-nowrap">
                        {eur(p.monto_relacion_tecnica)}
                      </td>
                      {["gasto_q1", "gasto_q2", "gasto_q3", "gasto_q4"].map((q, i) => (
                        <td
                          key={q}
                          className="py-2 pr-3 text-right text-gray-600 whitespace-nowrap"
                          title={p.notas_gasto?.[i] || undefined}
                        >
                          {eur(p[q])}
                          {p.notas_gasto?.[i] && (
                            <p className="text-[10px] text-gray-400">{p.notas_gasto[i]}</p>
                          )}
                        </td>
                      ))}
                      <td className="py-2 text-right font-medium whitespace-nowrap">
                        {eur(p.gastado)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-gray-200 font-semibold text-gray-800">
                    <td className="py-2 pr-3" colSpan={3}>
                      Total
                    </td>
                    <td className="py-2 pr-3 text-right whitespace-nowrap">{eur(total("monto"))}</td>
                    <td className="py-2 pr-3 text-right whitespace-nowrap">
                      {eur(total("monto_relacion_tecnica"))}
                    </td>
                    {trimestres.map((t) => (
                      <td key={t.trimestre} className="py-2 pr-3 text-right whitespace-nowrap">
                        {eur(t.gasto)}
                      </td>
                    ))}
                    <td className="py-2 text-right whitespace-nowrap">{eur(total("gastado"))}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </Seccion>
        </>
      )}
    </div>
  );
}
