import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
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
import { Clock, Loader2, Download, Upload, RotateCcw, Search, Info } from "lucide-react";
import { checadasService } from "../../services/checadas.service";
import { exportarReporteChecadas, lector } from "../../utils/exportarReporteChecadas";

/**
 * Reporte de checadas.
 *
 * Quién checó en cada turno, cómo llegó (a tiempo, en tolerancia hasta 20
 * minutos, o con retardo) y, si el archivo trae el día completo, a qué hora
 * salió. Sale del reporte de Transacciones de Hikvision que sube RH.
 *
 * Las checadas de cada persona se agrupan en jornadas (ver ChecadasReporte en
 * el backend): la primera es la entrada, la última es la salida y lo de en medio
 * (comida, pasadas por la catraca) no cuenta como entrada a otro turno.
 *
 * ---------------------------------------------------------------------------
 * LO QUE NO SE VE Y SÍ IMPORTA
 * ---------------------------------------------------------------------------
 * El turno no viene en el archivo: se asigna por la entrada más cercana. Quien
 * checa a las 7:51 es del A, no del C, y quien checa a las 23:45 es del C del
 * día siguiente. Por eso las fechas del filtro son las del TURNO.
 *
 * Solo aparece quien checó. Para saber quién faltó haría falta la plantilla.
 */

const VERDE = "#49a090";
const NARANJA = "#c9761f";
const ROJO = "#b0413e";
const AZUL = "#236093";
const MORADO = "#7c6bb0";

const ESTADOS = [
  { clave: "A_TIEMPO", nombre: "A tiempo", color: VERDE },
  { clave: "TOLERANCIA", nombre: "En tolerancia", color: NARANJA },
  { clave: "RETARDO", nombre: "Retardo", color: ROJO },
];
const NOMBRE_ESTADO = Object.fromEntries(ESTADOS.map((e) => [e.clave, e]));

const POR_PAGINA = 100;

const num = (n) =>
  n == null ? "—" : Number(n).toLocaleString("es-MX", { maximumFractionDigits: 0 });

const fechaCorta = (iso) => {
  if (!iso) return "—";
  const [a, m, d] = iso.split("-");
  return `${d}/${m}/${a}`;
};

/** -9 → "9 min antes"; 8 → "8 min después"; 0 → "puntual". */
const diferencia = (m) => (m === 0 ? "puntual" : m < 0 ? `${-m} min antes` : `${m} min después`);

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

const Seccion = ({ titulo, nota, children, acciones }) => (
  <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 className="font-semibold text-gray-900">{titulo}</h2>
        {nota && <p className="text-xs text-gray-400 mt-0.5 mb-4">{nota}</p>}
      </div>
      {acciones}
    </div>
    {children}
  </div>
);

const Chip = ({ activo, onClick, children, color }) => (
  <button
    onClick={onClick}
    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
      activo
        ? "text-white border-transparent"
        : "bg-white text-gray-600 border-gray-200 hover:border-primary/40"
    }`}
    style={activo ? { background: color || AZUL } : undefined}
  >
    {children}
  </button>
);

const pct = (n, total) => (total ? `${((n / total) * 100).toFixed(0)}% de ${num(total)}` : null);

export default function ReportesChecadasPage() {
  const [disp, setDisp] = useState(null);
  const [filtros, setFiltros] = useState(null);
  const [busqueda, setBusqueda] = useState("");
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [exportando, setExportando] = useState(false);
  const [pagina, setPagina] = useState(1);

  // Al entrar: el último día con checadas
  useEffect(() => {
    checadasService
      .getFiltros()
      .then((d) => {
        setDisp(d);
        const dia = d.hasta || new Date().toISOString().slice(0, 10);
        setFiltros({ desde: dia, hasta: dia, turnos: [], departamentos: [], estados: [], salida: "", q: "" });
      })
      .catch((e) => {
        setError(e.response?.data?.message || e.message);
        setCargando(false);
      });
  }, []);

  // La búsqueda espera a que se deje de teclear
  useEffect(() => {
    const t = setTimeout(() => setFiltros((f) => (f && f.q !== busqueda ? { ...f, q: busqueda } : f)), 350);
    return () => clearTimeout(t);
  }, [busqueda]);

  useEffect(() => {
    if (!filtros || !filtros.desde || !filtros.hasta) return;
    setCargando(true);
    setPagina(1);
    checadasService
      .getReporte(filtros)
      .then((d) => {
        setDatos(d);
        setError(null);
      })
      .catch((e) => setError(e.response?.data?.message || e.message))
      .finally(() => setCargando(false));
  }, [filtros]);

  const alternar = (campo, valor) =>
    setFiltros((f) => ({
      ...f,
      [campo]: f[campo].includes(valor) ? f[campo].filter((v) => v !== valor) : [...f[campo], valor],
    }));

  const limpiar = () => {
    const dia = disp?.hasta || filtros.desde;
    setBusqueda("");
    setFiltros({ desde: dia, hasta: dia, turnos: [], departamentos: [], estados: [], salida: "", q: "" });
  };

  const exportar = async () => {
    setExportando(true);
    try {
      await exportarReporteChecadas({ datos, desde: filtros.desde, hasta: filtros.hasta });
    } finally {
      setExportando(false);
    }
  };

  const grafica = useMemo(
    () =>
      (datos?.porDepartamento || []).map((d) => ({
        departamento: d.departamento,
        "A tiempo": d.aTiempo,
        "En tolerancia": d.tolerancia,
        Retardo: d.retardo,
      })),
    [datos],
  );

  const r = datos?.resumen;
  const turnoNombre = Object.fromEntries((disp?.turnos || []).map((t) => [t.clave, t]));
  const paginas = Math.max(1, Math.ceil((datos?.detalle.length || 0) / POR_PAGINA));
  const visibles = (datos?.detalle || []).slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA);
  const tolerancia = disp?.turnos?.[0]?.tolerancia_min ?? 20;

  if (error && !datos) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 text-sm">{error}</div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center">
            <Clock className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Checadas</h1>
            <p className="text-sm text-gray-500">
              {filtros
                ? filtros.desde === filtros.hasta
                  ? `Turnos del ${fechaCorta(filtros.desde)}`
                  : `Turnos del ${fechaCorta(filtros.desde)} al ${fechaCorta(filtros.hasta)}`
                : "Quién checó en cada turno"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/checadas/carga"
            className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <Upload className="w-4 h-4" />
            Cargar archivo
          </Link>
          <button
            onClick={exportar}
            disabled={exportando || !datos?.detalle.length}
            className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
          >
            {exportando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Exportar
          </button>
          <button
            onClick={limpiar}
            disabled={!filtros}
            className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            Limpiar
          </button>
        </div>
      </div>

      {/* Filtros */}
      {filtros && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Desde</label>
              <input
                type="date"
                value={filtros.desde}
                onChange={(e) => setFiltros((f) => ({ ...f, desde: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Hasta</label>
              <input
                type="date"
                value={filtros.hasta}
                onChange={(e) => setFiltros((f) => ({ ...f, hasta: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Departamento</label>
              <select
                value={filtros.departamentos[0] || ""}
                onChange={(e) =>
                  setFiltros((f) => ({ ...f, departamentos: e.target.value ? [e.target.value] : [] }))
                }
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                <option value="">Todos</option>
                {(disp?.departamentos || []).map((d) => (
                  <option key={d.departamento} value={d.departamento}>
                    {d.departamento}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Salida</label>
              <select
                value={filtros.salida}
                onChange={(e) => setFiltros((f) => ({ ...f, salida: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                <option value="">Todas</option>
                <option value="ANTES">Salieron antes</option>
                <option value="SIN">Sin salida</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Buscar</label>
              <div className="relative">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  placeholder="Nombre o nómina"
                  className="w-full border border-gray-200 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-6">
            <div>
              <p className="text-xs font-medium text-gray-500 mb-2">Turno</p>
              <div className="flex gap-2">
                {(disp?.turnos || []).map((t) => (
                  <Chip key={t.clave} activo={filtros.turnos.includes(t.clave)} onClick={() => alternar("turnos", t.clave)}>
                    {t.nombre} · {t.inicio.slice(0, 5)}
                  </Chip>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 mb-2">Llegada</p>
              <div className="flex gap-2">
                {ESTADOS.map((e) => (
                  <Chip
                    key={e.clave}
                    activo={filtros.estados.includes(e.clave)}
                    onClick={() => alternar("estados", e.clave)}
                    color={e.color}
                  >
                    {e.nombre}
                  </Chip>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {cargando && !datos ? (
        <div className="flex items-center justify-center py-20 text-gray-400">
          <Loader2 className="w-6 h-6 animate-spin mr-2" />
          Cargando...
        </div>
      ) : !datos || r.personas === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 p-10 text-center text-gray-400">
          {filtros.turnos.length || filtros.departamentos.length || filtros.estados.length || filtros.salida || filtros.q ? (
            "Nadie cumple con esos filtros en ese rango de fechas."
          ) : (
            <>
              No hay checadas en ese rango.{" "}
              <Link to="/checadas/carga" className="text-primary hover:underline">
                Cargar un archivo
              </Link>
            </>
          )}
        </div>
      ) : (
        <>
          {/* Tarjetas */}
          <div className={`grid grid-cols-2 gap-4 ${r.conSalida ? "lg:grid-cols-5" : "lg:grid-cols-4"}`}>
            <Tarjeta
              titulo="Checaron"
              valor={num(r.personas)}
              detalle={
                r.personas === r.empleados
                  ? "personas"
                  : `${num(r.empleados)} personas en ${num(r.personas)} turnos`
              }
              color={AZUL}
            />
            <Tarjeta titulo="A tiempo" valor={num(r.aTiempo)} detalle={pct(r.aTiempo, r.personas)} color={VERDE} />
            <Tarjeta
              titulo="En tolerancia"
              valor={num(r.tolerancia)}
              detalle={`hasta ${tolerancia} min después de la entrada`}
              color={NARANJA}
            />
            <Tarjeta
              titulo="Retardo"
              valor={num(r.retardo)}
              detalle={`más de ${tolerancia} min después`}
              color={r.retardo ? ROJO : "#1f2937"}
            />
            {/* Solo con archivos del día completo: los de ventana no traen salidas */}
            {r.conSalida > 0 && (
              <Tarjeta
                titulo="Salieron antes"
                valor={num(r.salieronAntes)}
                detalle={`de ${num(r.conSalida)} con salida registrada`}
                color={r.salieronAntes ? MORADO : "#1f2937"}
              />
            )}
          </div>

          {/* Por departamento */}
          <Seccion
            titulo="Llegadas por departamento"
            nota="Personas que checaron en cada departamento, según cómo llegaron."
          >
            <ResponsiveContainer width="100%" height={Math.max(220, grafica.length * 30 + 60)}>
              <BarChart data={grafica} layout="vertical" margin={{ left: 10, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                <YAxis type="category" dataKey="departamento" width={180} tick={{ fontSize: 11 }} interval={0} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="A tiempo" stackId="a" fill={VERDE} />
                <Bar dataKey="En tolerancia" stackId="a" fill={NARANJA} />
                <Bar dataKey="Retardo" stackId="a" fill={ROJO} radius={[0, 3, 3, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Seccion>

          {/* Por turno, cuando el rango tiene más de uno */}
          {datos.porTurno.length > 1 && (
            <Seccion titulo="Por turno" nota="Fecha del turno: el C empieza a las 00:00, así que quien checa a las 23:45 cuenta para el día siguiente.">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-500 border-b border-gray-100">
                      <th className="py-2 pr-3 font-medium">Fecha</th>
                      <th className="py-2 pr-3 font-medium">Turno</th>
                      <th className="py-2 pr-3 font-medium text-right">Checaron</th>
                      <th className="py-2 pr-3 font-medium text-right">A tiempo</th>
                      <th className="py-2 pr-3 font-medium text-right">En tolerancia</th>
                      <th className="py-2 pr-3 font-medium text-right">Retardo</th>
                      {r.conSalida > 0 && <th className="py-2 font-medium text-right">Salieron antes</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {datos.porTurno.map((t) => (
                      <tr key={`${t.fecha}-${t.turno}`} className="border-b border-gray-50 last:border-0">
                        <td className="py-2 pr-3 text-gray-700">{fechaCorta(t.fecha)}</td>
                        <td className="py-2 pr-3 text-gray-700">{turnoNombre[t.turno]?.nombre || t.turno}</td>
                        <td className="py-2 pr-3 text-right font-medium">{num(t.personas)}</td>
                        <td className="py-2 pr-3 text-right" style={{ color: VERDE }}>{num(t.aTiempo)}</td>
                        <td className="py-2 pr-3 text-right" style={{ color: NARANJA }}>{num(t.tolerancia)}</td>
                        <td className="py-2 pr-3 text-right" style={{ color: t.retardo ? ROJO : undefined }}>
                          {num(t.retardo)}
                        </td>
                        {r.conSalida > 0 && (
                          <td className="py-2 text-right" style={{ color: t.salieronAntes ? MORADO : undefined }}>
                            {num(t.salieronAntes)}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Seccion>
          )}

          {/* Detalle */}
          <Seccion
            titulo="Detalle"
            nota={
              "Una persona por turno. Entrada: su primera checada; salida: la última, si fue al menos 4 horas después." +
              (r.intermedias ? ` Se juntaron ${num(r.intermedias)} checadas intermedias (comida, pasadas por la catraca).` : "") +
              " Solo aparece quien checó."
            }
          >
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 border-b border-gray-100">
                    <th className="py-2 pr-3 font-medium">Nómina</th>
                    <th className="py-2 pr-3 font-medium">Nombre</th>
                    <th className="py-2 pr-3 font-medium">Departamento</th>
                    <th className="py-2 pr-3 font-medium">Turno</th>
                    <th className="py-2 pr-3 font-medium">Entrada</th>
                    <th className="py-2 pr-3 font-medium">Llegada</th>
                    <th className="py-2 pr-3 font-medium">Salida</th>
                    <th className="py-2 pr-3 font-medium text-right">Checadas</th>
                    <th className="py-2 font-medium">Lector</th>
                  </tr>
                </thead>
                <tbody>
                  {visibles.map((l) => {
                    const e = NOMBRE_ESTADO[l.estado];
                    return (
                      <tr key={`${l.empleado_id}-${l.fechaTurno}-${l.turno}`} className="border-b border-gray-50 last:border-0">
                        <td className="py-2 pr-3 font-mono text-xs text-gray-600">{l.empleado_id}</td>
                        <td className="py-2 pr-3 text-gray-800">{l.nombre || "—"}</td>
                        <td className="py-2 pr-3 text-gray-600" title={l.departamento_ruta || undefined}>
                          {l.departamento || "—"}
                        </td>
                        <td className="py-2 pr-3 text-gray-600 whitespace-nowrap">
                          {l.turno}
                          {filtros.desde !== filtros.hasta && (
                            <span className="text-xs text-gray-400 ml-1">{fechaCorta(l.fechaTurno)}</span>
                          )}
                        </td>
                        <td className="py-2 pr-3 whitespace-nowrap">
                          <span className="font-medium text-gray-800">{l.hora}</span>
                          {l.fecha !== l.fechaTurno && (
                            <span className="text-xs text-gray-400 ml-1" title="Checó la noche anterior al turno">
                              {fechaCorta(l.fecha)}
                            </span>
                          )}
                        </td>
                        <td className="py-2 pr-3 whitespace-nowrap">
                          <span
                            className="inline-block px-2 py-0.5 rounded-full text-xs font-medium"
                            style={{ color: e.color, background: `${e.color}1a` }}
                          >
                            {e.nombre}
                          </span>
                          <span className="text-xs text-gray-400 ml-2">{diferencia(l.minutos)}</span>
                        </td>
                        <td className="py-2 pr-3 whitespace-nowrap">
                          {l.salidaHora ? (
                            <>
                              <span className="font-medium text-gray-800">{l.salidaHora}</span>
                              {l.salidaFecha !== l.fechaTurno && (
                                <span className="text-xs text-gray-400 ml-1">{fechaCorta(l.salidaFecha)}</span>
                              )}
                              {l.salioAntes ? (
                                <span
                                  className="ml-2 inline-block px-2 py-0.5 rounded-full text-xs font-medium"
                                  style={{ color: MORADO, background: `${MORADO}1a` }}
                                >
                                  Salió {-l.minutosSalida} min antes
                                </span>
                              ) : (
                                <span className="text-xs text-gray-400 ml-2">
                                  {l.minutosSalida === 0 ? "a la hora" : `${l.minutosSalida} min después`}
                                </span>
                              )}
                            </>
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </td>
                        <td className="py-2 pr-3 text-right text-gray-500">{l.checadas}</td>
                        <td className="py-2 text-gray-500 text-xs">{lector(l.punto)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {paginas > 1 && (
              <div className="flex items-center justify-between mt-4 text-sm text-gray-500">
                <span>
                  {num((pagina - 1) * POR_PAGINA + 1)}–{num(Math.min(pagina * POR_PAGINA, datos.detalle.length))} de{" "}
                  {num(datos.detalle.length)}
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPagina((p) => Math.max(1, p - 1))}
                    disabled={pagina === 1}
                    className="px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40"
                  >
                    Anterior
                  </button>
                  <button
                    onClick={() => setPagina((p) => Math.min(paginas, p + 1))}
                    disabled={pagina === paginas}
                    className="px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40"
                  >
                    Siguiente
                  </button>
                </div>
              </div>
            )}
            {datos.truncado && (
              <p className="text-xs text-amber-600 mt-3 flex items-center gap-1">
                <Info className="w-3.5 h-3.5" />
                Se muestran los primeros 10,000 renglones; acota el rango de fechas para ver el resto.
              </p>
            )}
          </Seccion>
        </>
      )}
    </div>
  );
}
