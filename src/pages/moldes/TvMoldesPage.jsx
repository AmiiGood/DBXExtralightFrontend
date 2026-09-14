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
import { Maximize2, AlertTriangle } from "lucide-react";
import { moldesService } from "../../services/moldes.service";

/**
 * Modo TV de Moldes: tablero para pantallas de piso.
 *
 * Pensado para verse a varios metros y quedarse encendido días: tipografía
 * grande, fondo oscuro (menos reflejo y menos consumo que el blanco), rotación
 * automática entre vistas y refresco de datos sin que nadie toque nada.
 *
 * Se configura por URL para que cada televisión muestre algo distinto sin
 * necesitar interfaz:
 *   /moldes/tv?periodo=mes&rotacion=20&refresco=5&tema=Moldes - Cambio de molde
 *
 *   periodo   mes (por defecto) | semana | anio
 *   rotacion  segundos por vista (por defecto 20)
 *   refresco  minutos entre recargas de datos (por defecto 5)
 *   tema      limita a ciertos temas, separados por coma
 *   vistas    cuáles mostrar, separadas por coma: resumen,temas,evolucion
 *
 * El número grande es la MEDIANA, no el promedio: el promedio lo distorsionan
 * unos pocos tickets que quedaron abiertos meses, y en una pantalla que nadie
 * va a cuestionar eso sería engañoso.
 */

const FONDO = "#0f172a";
const PANEL = "#1e293b";
const TEXTO = "#e2e8f0";
const TENUE = "#94a3b8";

// Paleta aclarada para fondo oscuro: los tonos del reporte se apagan aquí
const VERDE = "#4fc4ad";
const AZUL = "#4d9fe0";
const NARANJA = "#f0913a";

/** Entre más tarde el rango, más se calienta la barra. */
const COLOR_RANGO = [
  "#4fc4ad", "#8fce5c", "#d4cc4a", "#f0b13a", "#f0913a", "#e0574f",
];

/** Mínimo de tickets cerrados para que la mediana de un tema signifique algo. */
const MINIMO_TEMA = 30;

const miles = (n) =>
  n == null ? "—" : Number(n).toLocaleString("es-MX", { maximumFractionDigits: 0 });

/**
 * Formatea horas en algo legible a distancia.
 *
 * Los tiempos del área van de minutos a semanas, así que un solo formato no
 * sirve. Sin el ".0" de los valores redondos: en una TV cada carácter cuenta.
 */
function horas(h) {
  if (h == null) return "—";
  const n = Number(h);
  const dec = (v) =>
    Number.isInteger(Number(v.toFixed(1))) ? v.toFixed(0) : v.toFixed(1);
  if (n === 0) return "0";
  if (n < 1) return `${Math.round(n * 60)} min`;
  if (n < 48) return `${dec(n)} h`;
  const dias = n / 24;
  if (dias < 60) return `${dec(dias)} d`;
  return `${dec(dias / 30.44)} meses`;
}

/**
 * El eje de tiempos va en escala logarítmica.
 *
 * La mediana ronda las 3 h y el percentil 90 de un mes malo llega a miles: en
 * escala lineal la mediana queda pegada al eje y no se ve la tendencia.
 */
const TICKS_HORAS = [1, 8, 24, 168, 720, 2160];
const PISO_LOG = 0.5;

/**
 * Marcas del eje que caben en el dato.
 *
 * Si se le pasan siempre las seis, recharts estira el eje hasta la más alta y
 * la gráfica se dibuja aplastada en el borde inferior: con datos de 20 horas no
 * tiene caso que el eje llegue a tres meses. Se quedan las que están por debajo
 * del máximo más una encima, para que la línea no toque el techo.
 */
function ticksQueCaben(valores) {
  const max = Math.max(...valores.filter((v) => v != null), 1);
  const dentro = TICKS_HORAS.filter((t) => t <= max);
  const siguiente = TICKS_HORAS.find((t) => t > max);
  return siguiente ? [...dentro, siguiente] : dentro;
}

/** Lee la configuración de la URL una sola vez. */
function leerConfig() {
  const p = new URLSearchParams(window.location.search);
  const vistas = (p.get("vistas") || "resumen,temas,evolucion")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return {
    periodo: p.get("periodo") || "mes",
    rotacionMs: (parseInt(p.get("rotacion"), 10) || 20) * 1000,
    refrescoMs: (parseInt(p.get("refresco"), 10) || 5) * 60 * 1000,
    temas: p.get("tema") ? p.get("tema").split(",").map((s) => s.trim()) : [],
    vistas,
  };
}

/** Filtros del dashboard según el periodo elegido. */
function filtrosDe(periodo, temas) {
  const hoy = new Date();
  const base = { temas };
  if (periodo === "anio") return { ...base, anio: hoy.getFullYear() };
  if (periodo === "semana") {
    const inicio = new Date(hoy);
    inicio.setDate(hoy.getDate() - ((hoy.getDay() + 6) % 7));
    const dd = (d) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
        d.getDate(),
      ).padStart(2, "0")}`;
    return { ...base, fechaInicio: dd(inicio), fechaFin: dd(hoy) };
  }
  return { ...base, anio: hoy.getFullYear(), mes: hoy.getMonth() + 1 };
}

const TITULO_PERIODO = {
  mes: () =>
    new Date().toLocaleDateString("es-MX", { month: "long", year: "numeric" }),
  semana: () => "Semana en curso",
  anio: () => `Año ${new Date().getFullYear()}`,
};

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

/** Tarjeta grande del encabezado de la vista de resumen. */
function Tarjeta({ titulo, valor, detalle, color }) {
  return (
    <div
      className="rounded-2xl p-5 border-t-8 flex flex-col justify-center"
      style={{ backgroundColor: PANEL, borderColor: color || "#64748b" }}
    >
      <p className="text-lg font-medium truncate" style={{ color: TENUE }}>
        {titulo}
      </p>
      <p
        className="text-5xl font-bold mt-2 tabular-nums"
        style={{ color: color || TEXTO }}
      >
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

export default function TvMoldesPage() {
  const cfg = useMemo(leerConfig, []);
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState(null);
  const [actualizado, setActualizado] = useState(null);
  const [vista, setVista] = useState(0);
  const [progreso, setProgreso] = useState(0);
  const contenedor = useRef(null);

  // ------------------------------------------------------------- datos
  const cargar = useCallback(async () => {
    try {
      const d = await moldesService.getDashboard(
        filtrosDe(cfg.periodo, cfg.temas),
        cfg.periodo === "anio" ? "mes" : "fecha",
      );
      setDatos(d);
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
      if (e.key === "ArrowLeft")
        setVista((v) => (v - 1 + totalVistas) % totalVistas);
    };
    window.addEventListener("keydown", alTeclear);
    return () => window.removeEventListener("keydown", alTeclear);
  }, [totalVistas]);

  const r = datos?.resumen;

  /**
   * Los temas se ordenan por TIEMPO, no por volumen.
   *
   * La pregunta que contesta una pantalla de piso es cuál se está tardando, no
   * cuál tiene más tickets. Van de mayor a menor y con el valor escrito al lado
   * de cada barra: cuando un tema se dispara —hoy Exceso de rebaba— las demás
   * barras quedan cortas, pero la etiqueta se sigue leyendo.
   */
  const porTema = useMemo(
    () =>
      (datos?.porTema || [])
        .filter((t) => t.cerrados >= MINIMO_TEMA && t.mediana != null)
        .sort((a, b) => b.mediana - a.mediana)
        .slice(0, 10),
    [datos],
  );

  /**
   * La escala logarítmica no admite ceros, y un día con pocos tickets puede dar
   * una mediana de minutos. Se levanta al piso para que el punto se dibuje en
   * el borde en vez de romper la gráfica.
   */
  const serie = useMemo(
    () =>
      (datos?.serie || []).map((s) => ({
        ...s,
        mediana: s.mediana == null ? null : Math.max(s.mediana, PISO_LOG),
        p90: s.p90 == null ? null : Math.max(s.p90, PISO_LOG),
      })),
    [datos],
  );

  const ticksEje = useMemo(
    () => ticksQueCaben(serie.flatMap((s) => [s.mediana, s.p90])),
    [serie],
  );

  const nombreVista = {
    resumen: "Tiempos de atención",
    temas: "Por tema",
    evolucion: "Evolución",
  };
  const actual = cfg.vistas[vista];

  return (
    <div
      ref={contenedor}
      // h-screen y no min-h-screen: las gráficas usan alto 100%, y con
      // min-h-screen el contenedor no tiene altura definida, así que los hijos
      // flex se colapsan a cero y el SVG no llega a dibujarse. En una TV
      // tampoco queremos scroll, así que overflow-hidden.
      className="h-screen w-full flex flex-col overflow-hidden"
      style={{ backgroundColor: FONDO, color: TEXTO }}
    >
      {/* Encabezado */}
      <div className="flex items-center justify-between px-8 pt-6 pb-3">
        <div>
          <h1 className="text-4xl font-bold tracking-tight">Moldes</h1>
          <p className="text-xl mt-1" style={{ color: TENUE }}>
            {(TITULO_PERIODO[cfg.periodo] || TITULO_PERIODO.mes)()}
            <span className="mx-3">·</span>
            {nombreVista[actual] || actual}
            {cfg.temas.length === 1 && (
              <>
                <span className="mx-3">·</span>
                {cfg.temas[0].replace(/^Moldes - /, "")}
              </>
            )}
          </p>
        </div>
        <div className="text-right">
          <p className="text-5xl font-bold tabular-nums">
            <Reloj />
          </p>
          <p className="text-sm mt-1" style={{ color: TENUE }}>
            {actualizado
              ? `Datos de las ${actualizado.toLocaleTimeString("es-MX", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}`
              : "Cargando..."}
          </p>
        </div>
      </div>

      {/* Barra de rotación */}
      {totalVistas > 1 && (
        <div
          className="h-1 mx-8 rounded-full overflow-hidden"
          style={{ backgroundColor: PANEL }}
        >
          <div
            className="h-full transition-none"
            style={{ width: `${progreso}%`, backgroundColor: AZUL }}
          />
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
          <div className="h-full flex flex-col gap-5">
            <div className="grid grid-cols-4 gap-4">
              <Tarjeta
                titulo="Tiempo típico"
                valor={horas(r.medianaHoras)}
                detalle="La mitad se resuelve antes"
                color={VERDE}
              />
              <Tarjeta
                titulo="9 de cada 10, antes de"
                valor={horas(r.p90Horas)}
                detalle="Percentil 90"
                color={AZUL}
              />
              <Tarjeta
                titulo="Tickets"
                valor={miles(r.tickets)}
                detalle={`${miles(r.cerrados)} cerrados`}
              />
              <Tarjeta
                titulo="Sin cerrar"
                valor={miles(r.abiertos)}
                detalle={r.abiertos > 0 ? "Pendientes de atención" : "Todo al día"}
                color={r.abiertos > 0 ? NARANJA : VERDE}
              />
            </div>
            <div className="flex-1 min-h-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={datos.distribucion}
                  margin={{ top: 25, right: 30, bottom: 10, left: 10 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                  <XAxis
                    dataKey="rango"
                    tick={{ fill: TEXTO, fontSize: 19 }}
                    axisLine={false}
                  />
                  <YAxis
                    tick={{ fill: TENUE, fontSize: 18 }}
                    axisLine={false}
                    tickFormatter={(v) => (v >= 1000 ? `${v / 1000}k` : v)}
                  />
                  <Bar dataKey="tickets" radius={[6, 6, 0, 0]}>
                    {datos.distribucion.map((_, i) => (
                      <Cell key={i} fill={COLOR_RANGO[i]} />
                    ))}
                    <LabelList
                      dataKey="tickets"
                      position="top"
                      formatter={miles}
                      style={{ fill: TEXTO, fontSize: 18, fontWeight: 600 }}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        ) : actual === "temas" ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={porTema}
              layout="vertical"
              margin={{ top: 10, right: 90, bottom: 10, left: 10 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
              <XAxis
                type="number"
                tick={{ fill: TENUE, fontSize: 18 }}
                axisLine={false}
                tickFormatter={horas}
              />
              <YAxis
                type="category"
                dataKey="temaCorto"
                width={220}
                tick={{ fill: TEXTO, fontSize: 19 }}
                axisLine={false}
                tickLine={false}
              />
              <Bar dataKey="mediana" fill={VERDE} radius={[0, 6, 6, 0]}>
                <LabelList
                  dataKey="mediana"
                  position="right"
                  formatter={horas}
                  style={{ fill: TEXTO, fontSize: 18, fontWeight: 600 }}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={serie} margin={{ top: 20, right: 30, bottom: 10, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
              <XAxis
                dataKey="etiqueta"
                tick={{ fill: TEXTO, fontSize: 17 }}
                axisLine={false}
              />
              <YAxis
                scale="log"
                domain={[PISO_LOG, ticksEje[ticksEje.length - 1]]}
                allowDataOverflow
                ticks={ticksEje}
                tick={{ fill: TENUE, fontSize: 18 }}
                axisLine={false}
                tickFormatter={horas}
              />
              <Line
                type="monotone"
                dataKey="p90"
                stroke={AZUL}
                strokeWidth={4}
                strokeDasharray="8 6"
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="mediana"
                stroke={VERDE}
                strokeWidth={5}
                dot={{ r: 5, fill: VERDE }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Pie: leyenda de la vista en curso y de dónde salen los datos */}
      <div className="flex items-center justify-between px-8 pb-5 text-lg">
        <div className="flex gap-6 flex-wrap">
          {actual === "evolucion" ? (
            <>
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 rounded" style={{ backgroundColor: VERDE }} />
                <span style={{ color: TENUE }}>Tiempo típico (mediana)</span>
              </span>
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 rounded" style={{ backgroundColor: AZUL }} />
                <span style={{ color: TENUE }}>9 de cada 10 (percentil 90)</span>
              </span>
            </>
          ) : (
            <span style={{ color: TENUE }}>
              {actual === "temas"
                ? "Tiempo típico por tema, del más tardado al más rápido"
                : "Cuántos tickets cayeron en cada rango de tiempo"}
            </span>
          )}
        </div>
        <span style={{ color: "#475569" }} className="text-sm">
          {datos?.sincronizacion?.corte
            ? `Tickets de osTicket al ${datos.sincronizacion.corte.slice(0, 16)}`
            : "Tickets de osTicket"}
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
