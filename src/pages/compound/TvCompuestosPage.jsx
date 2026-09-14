import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  BarChart,
  Bar,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  LabelList,
} from "recharts";
import { Maximize2, AlertTriangle, Clock } from "lucide-react";
import { compoundService } from "../../services/compound.service";

/**
 * Modo TV de Compuestos: tablero para pantallas de piso.
 *
 * Misma base que los de Inyección y Moldes: tipografía grande, fondo oscuro,
 * rotación automática y refresco sin que nadie toque nada. Se configura por URL:
 *
 *   /compound/tv?periodo=ultimo&rotacion=20&refresco=5&linea=1&vistas=resumen,causas
 *
 *   periodo   ultimo (por defecto) | mes | semana | anio
 *   rotacion  segundos por vista (por defecto 20)
 *   refresco  minutos entre recargas (por defecto 5)
 *   linea     limita a ciertas líneas, separadas por coma
 *   turno     limita a ciertos turnos, separados por coma
 *   vistas    cuáles mostrar: resumen,causas,recuperacion
 *
 * DIFERENCIA IMPORTANTE con los otros tableros: aquí los datos NO llegan en
 * vivo, llegan cuando alguien sube el Excel. Si la pantalla mostrara "el mes
 * del calendario" se quedaría vacía cada vez que la carga va atrasada — hoy el
 * último dato es de julio. Por eso el periodo por defecto es `ultimo`: el mes
 * del último dato cargado. Y la fecha de ese último dato se muestra siempre,
 * con aviso si ya es vieja, para que nadie tome datos de hace meses por
 * los de hoy.
 */

const FONDO = "#0f172a";
const PANEL = "#1e293b";
const TEXTO = "#e2e8f0";
const TENUE = "#94a3b8";

const VERDE = "#4fc4ad";
const AZUL = "#4d9fe0";
const NARANJA = "#f0913a";
const ROJO = "#e0574f";

/**
 * Colores de causa aclarados para fondo oscuro. Las tres que suman el 89% del
 * paro van fuertes; el resto en grises para que no compitan.
 */
const COLOR_CAUSA = {
  CC: "#f0913a",
  PLAN: "#4d9fe0",
  TMM: "#4fc4ad",
  AM: "#64748b",
  FT: "#7c8a9c",
  FP: "#94a3b8",
  LH: "#b4bfcc",
};

const COLOR_BU = {
  CROCS: "#4d9fe0",
  SUELA: "#a8d84f",
  "PRODUCTO TÉCNICO": "#4fc4ad",
};

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

/** A partir de cuántos días sin carga se avisa que el dato está viejo. */
const DIAS_DATO_VIEJO = 3;

const miles = (n) =>
  n == null ? "—" : Number(n).toLocaleString("es-MX", { maximumFractionDigits: 0 });
const pct = (n, d = 1) => (n == null ? "—" : `${Number(n).toFixed(d)}%`);
const corto = (n) => {
  const v = Number(n);
  if (!Number.isFinite(v)) return "";
  if (Math.abs(v) >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (Math.abs(v) >= 1000) return `${Math.round(v / 1000)}k`;
  return String(Math.round(v));
};

const dd = (n) => String(n).padStart(2, "0");
const iso = (d) => `${d.getFullYear()}-${dd(d.getMonth() + 1)}-${dd(d.getDate())}`;

/** Lee la configuración de la URL una sola vez. */
function leerConfig() {
  const p = new URLSearchParams(window.location.search);
  const lista = (k) =>
    p.get(k) ? p.get(k).split(",").map((s) => s.trim()).filter(Boolean) : [];
  return {
    periodo: p.get("periodo") || "ultimo",
    rotacionMs: (parseInt(p.get("rotacion"), 10) || 20) * 1000,
    refrescoMs: (parseInt(p.get("refresco"), 10) || 5) * 60 * 1000,
    lineas: lista("linea"),
    turnos: lista("turno"),
    vistas: (p.get("vistas") || "resumen,causas,recuperacion")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  };
}

/**
 * Convierte el periodo pedido a filtros, agrupación y etiqueta.
 *
 * `mes` y `semana` siguen al reloj; `ultimo` y `anio` se anclan al último dato
 * cargado, que es lo que tiene sentido cuando los datos llegan por Excel.
 *
 * @param {String} periodo
 * @param {String|null} hasta  'AAAA-MM-DD' del último dato
 */
function resolverPeriodo(periodo, hasta) {
  const hoy = new Date();
  if (periodo === "semana") {
    const inicio = new Date(hoy);
    inicio.setDate(hoy.getDate() - ((hoy.getDay() + 6) % 7));
    return {
      filtros: { fechaInicio: iso(inicio), fechaFin: iso(hoy) },
      agrupar: "fecha",
      etiqueta: "Semana en curso",
    };
  }
  if (periodo === "mes") {
    return {
      filtros: { anio: hoy.getFullYear(), mes: hoy.getMonth() + 1 },
      agrupar: "fecha",
      etiqueta: `${MESES[hoy.getMonth()]} ${hoy.getFullYear()}`,
    };
  }
  // Mediodía para que ningún ajuste de zona recorra la fecha un día
  const ref = hasta ? new Date(`${hasta}T12:00:00`) : hoy;
  if (periodo === "anio") {
    return {
      filtros: { anio: ref.getFullYear() },
      agrupar: "mes",
      etiqueta: `Año ${ref.getFullYear()}`,
    };
  }
  return {
    filtros: { anio: ref.getFullYear(), mes: ref.getMonth() + 1 },
    agrupar: "fecha",
    etiqueta: `${MESES[ref.getMonth()]} ${ref.getFullYear()}`,
  };
}

function Reloj() {
  const [ahora, setAhora] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setAhora(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <span className="tabular-nums">
      {ahora.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}
    </span>
  );
}

function Tarjeta({ titulo, valor, detalle, color }) {
  return (
    <div
      className="rounded-2xl p-5 border-t-8 flex flex-col justify-center"
      style={{ backgroundColor: PANEL, borderColor: color || "#64748b" }}
    >
      <p className="text-lg font-medium truncate" style={{ color: TENUE }}>
        {titulo}
      </p>
      <p className="text-5xl font-bold mt-2 tabular-nums" style={{ color: color || TEXTO }}>
        {valor}
      </p>
      {detalle && (
        <p className="text-base mt-2 tabular-nums" style={{ color: TENUE }}>
          {detalle}
        </p>
      )}
    </div>
  );
}

const Vacio = ({ texto }) => (
  <div className="h-full flex items-center justify-center">
    <p className="text-3xl" style={{ color: TENUE }}>
      {texto}
    </p>
  </div>
);

export default function TvCompuestosPage() {
  const cfg = useMemo(leerConfig, []);
  const [datos, setDatos] = useState(null);
  const [recuperacion, setRecuperacion] = useState(null);
  const [periodo, setPeriodo] = useState(null);
  const [error, setError] = useState(null);
  const [actualizado, setActualizado] = useState(null);
  const [vista, setVista] = useState(0);
  const [progreso, setProgreso] = useState(0);
  const contenedor = useRef(null);

  // ------------------------------------------------------------- datos
  const cargar = useCallback(async () => {
    try {
      const base = { lineas: cfg.lineas, turnos: cfg.turnos };
      // Primero se averigua el último dato cargado: de él depende qué mes se
      // muestra cuando el periodo es `ultimo` o `anio`.
      const general = await compoundService.getDashboard(base, "mes");
      const hasta = general.resumen.hasta
        ? String(general.resumen.hasta).slice(0, 10)
        : null;

      // Si el último mes apenas arranca, se muestra el anterior. Pasa hoy: la
      // captura se cortó el 1 de julio y "julio" serían 4 turnos contra ~120
      // de un mes normal; un tablero así no dice nada y parece una caída.
      // El aviso de "último dato cargado" sigue mostrando la fecha real.
      let referencia = hasta;
      const meses = general.serie || [];
      if (cfg.periodo === "ultimo" && meses.length >= 2) {
        const ultimo = meses[meses.length - 1];
        const anterior = meses[meses.length - 2];
        if (ultimo.registros < anterior.registros * 0.25) {
          const [a, m] = anterior.clave.split("-").map(Number);
          referencia = `${a}-${dd(m)}-15`;
        }
      }
      const p = resolverPeriodo(cfg.periodo, referencia);

      const [d, rec] = await Promise.all([
        compoundService.getDashboard({ ...base, ...p.filtros }, p.agrupar),
        compoundService.getRecuperacion({}, "anio"),
      ]);
      setDatos(d);
      setRecuperacion(rec);
      setPeriodo({ ...p, hasta });
      setActualizado(new Date());
      setError(null);
    } catch (e) {
      // En una TV nadie va a leer un stack: se muestra el aviso y se reintenta
      setError(
        e.response?.status === 401
          ? "La sesión expiró. Hay que volver a entrar en esta pantalla."
          : "No se pudo conectar con el servidor. Reintentando...",
      );
    }
  }, [cfg]);

  useEffect(() => {
    cargar();
    const t = setInterval(cargar, cfg.refrescoMs);
    return () => clearInterval(t);
  }, [cargar, cfg.refrescoMs]);

  // Si falla, reintenta más seguido que el refresco normal
  useEffect(() => {
    if (!error) return;
    const t = setInterval(cargar, 30000);
    return () => clearInterval(t);
  }, [error, cargar]);

  // ---------------------------------------------------------- rotación
  const totalVistas = cfg.vistas.length;
  useEffect(() => {
    if (totalVistas <= 1) return;
    const paso = 100;
    const t = setInterval(() => {
      setProgreso((p) => {
        const siguiente = p + (paso / cfg.rotacionMs) * 100;
        if (siguiente >= 100) {
          setVista((v) => (v + 1) % totalVistas);
          return 0;
        }
        return siguiente;
      });
    }, paso);
    return () => clearInterval(t);
  }, [cfg.rotacionMs, totalVistas]);

  // ------------------------------------- pantalla completa y no dormir
  const pantallaCompleta = () => {
    const el = contenedor.current;
    if (!document.fullscreenElement) el?.requestFullscreen?.();
    else document.exitFullscreen?.();
  };

  useEffect(() => {
    // Evita que el protector de pantalla tape el tablero. No todos los
    // navegadores lo soportan y solo funciona con la pestaña visible.
    let bloqueo = null;
    const pedir = async () => {
      try {
        if ("wakeLock" in navigator) {
          bloqueo = await navigator.wakeLock.request("screen");
        }
      } catch {
        /* el navegador lo negó; la TV puede dormirse */
      }
    };
    pedir();
    const alVolver = () => document.visibilityState === "visible" && pedir();
    document.addEventListener("visibilitychange", alVolver);
    return () => {
      document.removeEventListener("visibilitychange", alVolver);
      bloqueo?.release?.().catch(() => {});
    };
  }, []);

  // Teclas: F pantalla completa, flechas para moverse a mano
  useEffect(() => {
    const alTeclear = (e) => {
      if (e.key === "f" || e.key === "F") pantallaCompleta();
      if (e.key === "ArrowRight") setVista((v) => (v + 1) % totalVistas);
      if (e.key === "ArrowLeft") setVista((v) => (v - 1 + totalVistas) % totalVistas);
    };
    window.addEventListener("keydown", alTeclear);
    return () => window.removeEventListener("keydown", alTeclear);
  }, [totalVistas]);

  const r = datos?.resumen;
  const sinDatos = !r || !r.registros;
  const causas = datos?.causas || [];

  const serieCausas = useMemo(() => {
    if (!datos) return [];
    const porClave = new Map(datos.serie.map((s) => [s.clave, s]));
    return datos.causasSerie.map((c) => ({
      ...c,
      pctParo: porClave.get(c.clave)?.pctParo ?? null,
    }));
  }, [datos]);

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

  // Recuperación del último año con datos, para las tarjetas
  const recuperacionUltimoAnio = useMemo(() => {
    if (!recuperacion?.serie?.length) return { anio: null, filas: [] };
    const anio = recuperacion.serie.map((s) => s.clave).sort().at(-1);
    return { anio, filas: recuperacion.serie.filter((s) => s.clave === anio) };
  }, [recuperacion]);

  const diasSinCarga = periodo?.hasta
    ? Math.floor((Date.now() - new Date(`${periodo.hasta}T12:00:00`).getTime()) / 86400000)
    : null;

  const nombreVista = {
    resumen: "Tiempo muerto",
    causas: "Tiempo muerto por periodo",
    recuperacion: "Recuperación de polvo",
  };
  const actual = cfg.vistas[vista];

  return (
    <div
      ref={contenedor}
      // h-screen y no min-h-screen: con altura mínima los hijos flex no tienen
      // alto definido y las gráficas se colapsan a cero. Sin scroll en una TV.
      className="h-screen w-full flex flex-col overflow-hidden"
      style={{ backgroundColor: FONDO, color: TEXTO }}
    >
      {/* Encabezado */}
      <div className="flex items-center justify-between px-8 pt-6 pb-3">
        <div>
          <h1 className="text-4xl font-bold tracking-tight">Compuestos</h1>
          <p className="text-xl mt-1" style={{ color: TENUE }}>
            {actual === "recuperacion"
              ? "Por año"
              : periodo?.etiqueta || "Cargando..."}
            <span className="mx-3">·</span>
            {nombreVista[actual] || actual}
            {cfg.lineas.length > 0 && (
              <>
                <span className="mx-3">·</span>
                Línea {cfg.lineas.join(", ")}
              </>
            )}
          </p>
        </div>
        <div className="text-right">
          <p className="text-5xl font-bold tabular-nums">
            <Reloj />
          </p>
          {periodo?.hasta && (
            <p
              className="text-base mt-1 flex items-center justify-end gap-1.5"
              style={{ color: diasSinCarga > DIAS_DATO_VIEJO ? NARANJA : TENUE }}
            >
              <Clock className="w-4 h-4" />
              Último dato cargado: {periodo.hasta}
              {diasSinCarga > DIAS_DATO_VIEJO && ` (hace ${diasSinCarga} días)`}
            </p>
          )}
        </div>
      </div>

      {/* Barra de rotación */}
      {totalVistas > 1 && (
        <div className="h-1 mx-8 rounded-full overflow-hidden" style={{ backgroundColor: PANEL }}>
          <div className="h-full transition-none" style={{ width: `${progreso}%`, backgroundColor: AZUL }} />
        </div>
      )}

      {error && (
        <div
          className="mx-8 mt-4 rounded-xl px-5 py-3 flex items-center gap-3 text-lg"
          style={{ backgroundColor: "#7f1d1d", color: "#fecaca" }}
        >
          <AlertTriangle className="w-6 h-6 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Contenido */}
      <div className="flex-1 px-8 py-5 min-h-0">
        {!datos ? (
          <p className="text-2xl" style={{ color: TENUE }}>
            Cargando datos...
          </p>
        ) : actual === "resumen" ? (
          sinDatos ? (
            <Vacio texto={`No hay turnos cargados para ${periodo?.etiqueta}`} />
          ) : (
            <div className="h-full flex flex-col gap-5">
              <div className="grid grid-cols-4 gap-4">
                <Tarjeta
                  titulo="Producción"
                  valor={`${corto(r.produccionKg)} kg`}
                  detalle={`${miles(r.registros)} turnos`}
                  color={AZUL}
                />
                <Tarjeta
                  titulo="Tiempo muerto"
                  valor={pct(r.pctParo)}
                  detalle={`${miles(r.paroHoras)} h de ${miles(r.turnoHoras)} h`}
                  color={r.pctParo > 20 ? ROJO : NARANJA}
                />
                <Tarjeta
                  titulo="Ritmo real"
                  valor={`${miles(r.kgHora)} kg/h`}
                  detalle={`Meta ${miles(r.metaKgHora)} kg/h`}
                  color={r.kgHora >= r.metaKgHora ? VERDE : NARANJA}
                />
                <Tarjeta
                  titulo="Cumplimiento"
                  valor={pct(r.pctCumplimiento)}
                  detalle={`${miles(r.turnosBajoMeta)} turnos bajo meta`}
                  color={r.pctCumplimiento >= 100 ? VERDE : NARANJA}
                />
              </div>
              <div className="flex-1 min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={datos.paretoParo} margin={{ top: 30, right: 30, bottom: 10, left: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                    <XAxis
                      dataKey="nombre"
                      tick={{ fill: TEXTO, fontSize: 19 }}
                      tickFormatter={(v, i) => (datos.paretoParo[i]?.confirmada ? v : `${v} *`)}
                      axisLine={false}
                      interval={0}
                    />
                    <YAxis tick={{ fill: TENUE, fontSize: 18 }} axisLine={false} tickFormatter={corto} />
                    <Bar dataKey="horas" radius={[6, 6, 0, 0]}>
                      {datos.paretoParo.map((c) => (
                        <Cell key={c.codigo} fill={COLOR_CAUSA[c.codigo] || "#64748b"} />
                      ))}
                      <LabelList
                        dataKey="pct"
                        position="top"
                        formatter={(v) => pct(v)}
                        style={{ fill: TEXTO, fontSize: 20, fontWeight: 700 }}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )
        ) : actual === "causas" ? (
          sinDatos ? (
            <Vacio texto={`No hay turnos cargados para ${periodo?.etiqueta}`} />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={serieCausas} margin={{ top: 20, right: 30, bottom: 10, left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                <XAxis dataKey="etiqueta" tick={{ fill: TEXTO, fontSize: 16 }} axisLine={false} />
                <YAxis yAxisId="izq" tick={{ fill: TENUE, fontSize: 18 }} axisLine={false} tickFormatter={corto} />
                <YAxis
                  yAxisId="der"
                  orientation="right"
                  tick={{ fill: ROJO, fontSize: 18 }}
                  axisLine={false}
                  tickFormatter={(v) => `${v}%`}
                />
                {causas.map((c) => (
                  <Bar
                    key={c.codigo}
                    yAxisId="izq"
                    dataKey={c.codigo}
                    stackId="paro"
                    fill={COLOR_CAUSA[c.codigo] || "#64748b"}
                  />
                ))}
                <Line
                  yAxisId="der"
                  type="monotone"
                  dataKey="pctParo"
                  stroke={ROJO}
                  strokeWidth={4}
                  dot={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          )
        ) : !recuperacion?.porBu?.length ? (
          <Vacio texto="No hay datos de recuperación de polvo" />
        ) : (
          <div className="h-full flex flex-col gap-5">
            <div className="grid grid-cols-3 gap-4">
              {recuperacionUltimoAnio.filas.map((b) => {
                const tieneMeta = b.metaPct != null && b.metaPct > 0;
                const cumple = tieneMeta && b.pctReciclado >= b.metaPct;
                return (
                  <Tarjeta
                    key={b.bu}
                    titulo={`${b.bu} · ${recuperacionUltimoAnio.anio}`}
                    valor={pct(b.pctReciclado, 2)}
                    detalle={tieneMeta ? `Meta ${pct(b.metaPct, 0)}` : "Sin meta"}
                    color={!tieneMeta ? TENUE : cumple ? VERDE : NARANJA}
                  />
                );
              })}
            </div>
            <div className="flex-1 min-h-0">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={serieRecuperacion} margin={{ top: 20, right: 30, bottom: 10, left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                  <XAxis dataKey="etiqueta" tick={{ fill: TEXTO, fontSize: 20 }} axisLine={false} />
                  <YAxis tick={{ fill: TENUE, fontSize: 18 }} axisLine={false} tickFormatter={(v) => `${v}%`} />
                  {recuperacion.porBu.map((b) => (
                    <Bar key={b.bu} dataKey={b.bu} fill={COLOR_BU[b.bu] || "#64748b"} radius={[6, 6, 0, 0]} />
                  ))}
                  {recuperacion.porBu.map((b) => (
                    <Line
                      key={`meta-${b.bu}`}
                      type="stepAfter"
                      dataKey={`meta__${b.bu}`}
                      stroke={COLOR_BU[b.bu] || "#64748b"}
                      strokeWidth={3}
                      strokeDasharray="8 6"
                      dot={false}
                    />
                  ))}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

      {/* Pie: leyenda de la vista en curso */}
      <div className="flex items-center justify-between px-8 pb-5 text-lg gap-6">
        <div className="flex gap-5 flex-wrap">
          {actual === "recuperacion"
            ? (recuperacion?.porBu || []).map((b) => (
                <span key={b.bu} className="flex items-center gap-2">
                  <span className="w-4 h-4 rounded" style={{ backgroundColor: COLOR_BU[b.bu] || "#64748b" }} />
                  <span style={{ color: TENUE }}>{b.bu}</span>
                </span>
              ))
            : causas.map((c) => (
                <span key={c.codigo} className="flex items-center gap-2">
                  <span className="w-4 h-4 rounded" style={{ backgroundColor: COLOR_CAUSA[c.codigo] || "#64748b" }} />
                  <span style={{ color: TENUE }}>
                    {c.nombre}
                    {c.confirmada ? "" : " *"}
                  </span>
                </span>
              ))}
          {actual === "causas" && (
            <span className="flex items-center gap-2">
              <span className="w-6 h-1 rounded" style={{ backgroundColor: ROJO }} />
              <span style={{ color: TENUE }}>% tiempo muerto</span>
            </span>
          )}
        </div>
        <span style={{ color: "#475569" }} className="text-sm text-right flex-shrink-0">
          {actual === "recuperacion"
            ? "Línea punteada: meta de cada unidad de negocio"
            : causas.some((c) => !c.confirmada)
              ? "* Sigla sin confirmar por planta"
              : ""}
        </span>
      </div>

      {/* Botón de pantalla completa: discreto, para no estorbar en la TV */}
      <button
        onClick={pantallaCompleta}
        className="fixed bottom-4 right-4 p-3 rounded-full opacity-20 hover:opacity-100 transition-opacity"
        style={{ backgroundColor: PANEL }}
        title="Pantalla completa (tecla F)"
      >
        <Maximize2 className="w-5 h-5" />
      </button>
    </div>
  );
}
