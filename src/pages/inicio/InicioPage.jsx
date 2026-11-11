import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  Loader2, ChevronRight, CheckCircle2, AlertTriangle, PauseCircle, CircleDashed, Clock3,
  LayoutGrid, Upload, RefreshCw,
} from "lucide-react";
import api from "../../services/api";
import { useAuthStore } from "../../stores/auth.store";
import { todosLosReportes } from "../../config/areas";
import { cargasVisibles } from "../../config/cargas";
import { leerRecientes } from "../../utils/recientes";

/**
 * Inicio: lo primero que ve cada usuario al entrar.
 *
 *   - Pendientes: lo que espera al usuario (aprobar, cotizar, revisar).
 *   - Recientes y todos sus reportes, según sus permisos.
 *   - Para el administrador, cómo van las sincronizaciones automáticas.
 *
 * Reemplaza al tablero de Calidad como pantalla de entrada; ese tablero ahora
 * es un reporte más dentro de Calidad.
 */

const saludo = () => {
  const h = new Date().getHours();
  return h < 12 ? "Buenos días" : h < 19 ? "Buenas tardes" : "Buenas noches";
};

const hace = (min) => {
  if (min == null) return "—";
  if (min < 1) return "hace un momento";
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.floor(h / 24);
  return d === 1 ? "hace 1 día" : `hace ${d} días`;
};

const ESTADOS = {
  ok: { texto: "Al día", icono: CheckCircle2, clase: "text-green-700 bg-green-50" },
  atrasada: { texto: "Atrasada", icono: Clock3, clase: "text-amber-700 bg-amber-50" },
  error: { texto: "Con error", icono: AlertTriangle, clase: "text-red-700 bg-red-50" },
  apagado: { texto: "Apagada", icono: PauseCircle, clase: "text-gray-600 bg-gray-100" },
  "sin-configurar": { texto: "Sin configurar", icono: AlertTriangle, clase: "text-amber-700 bg-amber-50" },
  "sin-datos": { texto: "Sin datos aún", icono: CircleDashed, clase: "text-gray-600 bg-gray-100" },
};

function Bloque({ titulo, accion, children }) {
  return (
    <section className="bg-white border border-gray-200 rounded-xl">
      <div className="flex items-center justify-between px-5 pt-4 pb-2">
        <h2 className="text-sm font-semibold text-gray-800">{titulo}</h2>
        {accion}
      </div>
      <div className="px-5 pb-4">{children}</div>
    </section>
  );
}

function TarjetaReporte({ r }) {
  const Icono = r.icono || LayoutGrid;
  return (
    <Link
      to={r.ruta}
      className="group flex items-start gap-3 p-3 rounded-lg border border-gray-200 hover:border-[#236093]/40 hover:bg-[#236093]/5"
    >
      <div className="p-1.5 rounded-md bg-[#236093]/10 shrink-0">
        <Icono className="w-4 h-4 text-[#236093]" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-gray-500">{r.area}</p>
        <p className="text-sm font-medium text-gray-900 group-hover:text-[#236093]">{r.nombre}</p>
      </div>
    </Link>
  );
}

export default function InicioPage() {
  const usuario = useAuthStore((s) => s.user);
  const esAdmin = Boolean(usuario?.rol?.esAdmin);
  const [datos, setDatos] = useState(null);
  const [modulos, setModulos] = useState(null);
  const [error, setError] = useState(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let vivo = true;
    Promise.all([api.get("/inicio"), api.get("/auth/modulos")])
      .then(([a, b]) => {
        if (!vivo) return;
        setDatos(a.data.data);
        setModulos(b.data.data.modulos || []);
        setError(null);
      })
      .catch((e) => vivo && setError(e.response?.data?.message || e.message));
    return () => {
      vivo = false;
    };
  }, [version]);

  const nombre = (usuario?.nombreCompleto || "").split(" ")[0];
  const fecha = new Date().toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" });

  const reportes = modulos ? todosLosReportes(modulos, esAdmin) : [];
  const porRuta = new Map(reportes.map((r) => [r.ruta, r]));
  const recientes = leerRecientes(usuario?.id).map((r) => porRuta.get(r)).filter(Boolean);
  const cargas = modulos ? cargasVisibles(modulos) : [];
  const nCargas = cargas.reduce((s, g) => s + g.items.length, 0);

  // Agrupados por área para la lista completa
  const areas = [];
  for (const r of reportes) {
    let a = areas.find((x) => x.nombre === r.area);
    if (!a) areas.push((a = { nombre: r.area, reportes: [] }));
    a.reportes.push(r);
  }

  const sinc = (datos?.sincronizaciones || []).map((s) => ({
    ...s,
    estado: s.estado === "ok" && s.limite && s.minutos > s.limite ? "atrasada" : s.estado,
  }));
  const conProblema = sinc.filter((s) => ["error", "atrasada", "sin-configurar"].includes(s.estado)).length;

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          {saludo()}
          {nombre ? `, ${nombre}` : ""}
        </h1>
        <p className="text-sm text-gray-500 first-letter:uppercase">{fecha}</p>
      </div>

      {error && (
        <div className="flex items-start gap-2 text-sm text-red-700 bg-red-50 rounded-xl px-4 py-3">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          {error}
        </div>
      )}

      {!datos || !modulos ? (
        !error && (
          <div className="flex justify-center py-16">
            <Loader2 className="w-7 h-7 animate-spin text-gray-300" />
          </div>
        )
      ) : (
        <div className={`grid gap-5 ${nCargas > 0 || esAdmin ? "lg:grid-cols-3" : "max-w-3xl"}`}>
          <div className={`space-y-5 ${nCargas > 0 || esAdmin ? "lg:col-span-2" : ""}`}>
            <Bloque titulo="Pendientes">
              {datos.pendientes.length === 0 ? (
                <p className="flex items-center gap-2 text-sm text-gray-500 py-2">
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                  Estás al día: no tienes nada esperándote.
                </p>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {datos.pendientes.map((p) => (
                    <li key={p.texto}>
                      <Link to={p.ruta} className="flex items-center gap-3 py-2.5 group">
                        <span className="min-w-8 h-8 px-2 rounded-lg bg-[#236093] text-white text-sm font-semibold flex items-center justify-center tabular-nums">
                          {p.n}
                        </span>
                        <span className="flex-1 text-sm text-gray-800 group-hover:text-[#236093]">{p.texto}</span>
                        <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-[#236093]" />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Bloque>

            {recientes.length > 0 && (
              <Bloque titulo="Abiertos recientemente">
                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                  {recientes.map((r) => (
                    <TarjetaReporte key={r.ruta} r={r} />
                  ))}
                </div>
              </Bloque>
            )}

            <Bloque
              titulo="Tus reportes"
              accion={
                <Link to="/reportes" className="text-xs text-[#236093] hover:underline">
                  Ver por área
                </Link>
              }
            >
              {reportes.length === 0 ? (
                <p className="text-sm text-gray-500 py-2">Todavía no tienes reportes asignados.</p>
              ) : (
                <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
                  {areas.map((a) => (
                    <div key={a.nombre}>
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">{a.nombre}</p>
                      <ul className="space-y-0.5">
                        {a.reportes.map((r) => (
                          <li key={r.ruta}>
                            <Link to={r.ruta} className="text-sm text-gray-700 hover:text-[#236093] hover:underline">
                              {r.nombre}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </Bloque>
          </div>

          <div className="space-y-5">
            {nCargas > 0 && (
              <Bloque titulo="Cargas de datos">
                <p className="text-sm text-gray-600 mb-3">
                  {nCargas === 1 ? "Tienes 1 carga o archivo" : `Tienes ${nCargas} cargas y archivos`} que alimentan los reportes.
                </p>
                <Link
                  to="/cargas"
                  className="inline-flex items-center gap-2 px-3 py-2 text-sm border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  <Upload className="w-4 h-4" />
                  Ir a cargas de datos
                </Link>
              </Bloque>
            )}

            {esAdmin && (
              <Bloque
                titulo={conProblema ? `Sincronizaciones · ${conProblema} por revisar` : "Sincronizaciones"}
                accion={
                  <button
                    onClick={() => setVersion((v) => v + 1)}
                    className="p-1 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100"
                    title="Actualizar"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                }
              >
                <ul className="divide-y divide-gray-100">
                  {sinc.map((s) => {
                    const e = ESTADOS[s.estado] || ESTADOS["sin-datos"];
                    const Icono = e.icono;
                    return (
                      <li key={s.nombre}>
                        <Link to={s.ruta} className="block py-2 group" title={s.detalle || ""}>
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm text-gray-800 group-hover:text-[#236093] min-w-0">{s.nombre}</span>
                            <span className={`inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-md shrink-0 ${e.clase}`}>
                              <Icono className="w-3 h-3" />
                              {e.texto}
                            </span>
                          </div>
                          <p className="text-xs text-gray-400 truncate">
                            {s.estado === "error" && s.detalle
                              ? s.detalle
                              : s.minutos != null
                                ? `${s.que}: ${hace(s.minutos)}`
                                : s.detalle || ""}
                          </p>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </Bloque>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
