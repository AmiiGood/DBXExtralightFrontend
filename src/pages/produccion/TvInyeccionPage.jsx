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
import { inyeccionService } from "../../services/inyeccion.service";

/**
 * Modo TV: tablero para pantallas de piso.
 *
 * Pensado para verse a varios metros y quedarse encendido días: tipografía
 * grande, fondo oscuro (menos reflejo y menos consumo que el blanco), rotación
 * automática entre vistas y refresco de datos sin que nadie toque nada.
 *
 * Se configura por URL para que cada televisión muestre algo distinto sin
 * necesitar interfaz:
 *   /produccion/tv?periodo=ultimo&rotacion=20&refresco=5&bu=Crocs Unfin,Suela
 *
 *   periodo   ultimo (por defecto) | mes | semana | anio
 *   rotacion  segundos por vista (por defecto 20)
 *   refresco  minutos entre recargas de datos (por defecto 5)
 *   bu        limita a ciertas unidades de negocio
 *   vistas    cuáles mostrar, separadas por coma: bu,maquinas,evolucion
 *
 * POR QUÉ `ultimo` Y NO EL MES DEL CALENDARIO: los datos no llegan en vivo,
 * llegan cuando alguien sube el Excel de producción. Antes el tablero pedía el
 * mes en curso y, en cuanto la carga iba atrasada, la pantalla se quedaba en
 * blanco sin decir por qué (pasó en septiembre de 2026, con la última carga al
 * 8 de agosto). Ahora muestra el mes del último dato cargado y siempre enseña
 * esa fecha, en naranja si ya es vieja. `mes` sigue disponible para quien
 * prefiera el calendario.
 */

const COLOR_BU = {
  "Crocs Unfin": "#4d9fe0",
  "Crocs Strap": "#7bc4f5",
  Suela: "#a8d84f",
  Almohada: "#4fc4ad",
  "Dual Color": "#f0913a",
};

// Fotos servidas desde /public.
//
// Casi todas son las mismas del reporte, pero el strap usa aquí la versión
// BLANCA: la pieza real es negra y sobre el fondo oscuro del tablero
// desaparecía. Las demás tienen suficiente contraste tal cual.
const IMAGEN_BU = {
  "Crocs Unfin": "/CROCS.png",
  "Crocs Strap": "/STRAP.white.webp",
  "Dual Color": "/DUALCOLOR.png",
  Suela: "/SUELA.png",
  Almohada: "/ALMOHADA.png",
};

const FONDO = "#0f172a";
const PANEL = "#1e293b";
const TEXTO = "#e2e8f0";
const TENUE = "#94a3b8";
const NARANJA = "#f0913a";

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

/** A partir de cuántos días sin carga se avisa que el dato está viejo. */
const DIAS_DATO_VIEJO = 3;

const miles = (n) =>
  n == null ? "—" : Number(n).toLocaleString("es-MX", { maximumFractionDigits: 0 });
const pct = (n) => (n == null ? "—" : `${Number(n).toFixed(1)}%`);

const dd = (n) => String(n).padStart(2, "0");
const iso = (d) => `${d.getFullYear()}-${dd(d.getMonth() + 1)}-${dd(d.getDate())}`;

/** Lee la configuración de la URL una sola vez. */
function leerConfig() {
  const p = new URLSearchParams(window.location.search);
  const vistas = (p.get("vistas") || "bu,maquinas,evolucion")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return {
    periodo: p.get("periodo") || "ultimo",
    rotacionMs: (parseInt(p.get("rotacion"), 10) || 20) * 1000,
    refrescoMs: (parseInt(p.get("refresco"), 10) || 5) * 60 * 1000,
    bu: p.get("bu") ? p.get("bu").split(",").map((s) => s.trim()) : [],
    vistas,
  };
}

/**
 * Convierte el periodo pedido a filtros, agrupación y etiqueta.
 *
 * `mes` y `semana` siguen al reloj; `ultimo` y `anio` se anclan a la fecha de
 * referencia (el último dato cargado), que es lo que tiene sentido cuando los
 * datos llegan por Excel.
 *
 * @param {String} periodo
 * @param {String|null} referencia  'AAAA-MM-DD'
 * @param {String[]} bu
 */
function resolverPeriodo(periodo, referencia, bu) {
  const hoy = new Date();
  const base = { bu };
  if (periodo === "semana") {
    const inicio = new Date(hoy);
    inicio.setDate(hoy.getDate() - ((hoy.getDay() + 6) % 7));
    return {
      filtros: { ...base, fechaInicio: iso(inicio), fechaFin: iso(hoy) },
      agrupar: "fecha",
      etiqueta: "Semana en curso",
    };
  }
  if (periodo === "mes") {
    return {
      filtros: { ...base, anio: hoy.getFullYear(), mes: hoy.getMonth() + 1 },
      agrupar: "fecha",
      etiqueta: `${MESES[hoy.getMonth()]} ${hoy.getFullYear()}`,
    };
  }
  // Mediodía para que ningún ajuste de zona recorra la fecha un día
  const ref = referencia ? new Date(`${referencia}T12:00:00`) : hoy;
  if (periodo === "anio") {
    return {
      filtros: { ...base, anio: ref.getFullYear() },
      agrupar: "mes",
      etiqueta: `Año ${ref.getFullYear()}`,
    };
  }
  return {
    filtros: { ...base, anio: ref.getFullYear(), mes: ref.getMonth() + 1 },
    agrupar: "fecha",
    etiqueta: `${MESES[ref.getMonth()]} ${ref.getFullYear()}`,
  };
}

/**
 * Si el último mes apenas arranca, devuelve una fecha del mes anterior.
 *
 * Un mes con una semana capturada se ve como una caída brutal de producción
 * que no ocurrió. Se compara el volumen del último mes contra el anterior y,
 * si no llega al 25%, se usa el anterior. Sumar piezas de BU distintas NO tiene
 * significado como indicador; aquí solo se usa para medir qué tan completa
 * está la captura del mes, y nunca se muestra.
 */
function mesConDatosSuficientes(serie, hasta) {
  const volumen = new Map();
  for (const r of serie || []) {
    const m = String(r.periodo || "").match(/^(\d{4})-(\d{2})/);
    if (!m) continue;
    const clave = `${m[1]}-${m[2]}`;
    volumen.set(clave, (volumen.get(clave) || 0) + (Number(r.produccion) || 0));
  }
  const meses = [...volumen.keys()].sort();
  if (meses.length < 2) return hasta;
  const ultimo = volumen.get(meses[meses.length - 1]);
  const anterior = volumen.get(meses[meses.length - 2]);
  if (anterior > 0 && ultimo < anterior * 0.25) {
    return `${meses[meses.length - 2]}-15`;
  }
  return hasta;
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

const Vacio = ({ texto }) => (
  <div className="h-full flex items-center justify-center">
    <p className="text-3xl text-center" style={{ color: TENUE }}>
      {texto}
    </p>
  </div>
);

export default function TvInyeccionPage() {
  const cfg = useMemo(leerConfig, []);
  const [datos, setDatos] = useState(null);
  const [periodo, setPeriodo] = useState(null);
  const [error, setError] = useState(null);
  const [vista, setVista] = useState(0);
  const [progreso, setProgreso] = useState(0);
  const contenedor = useRef(null);

  // ------------------------------------------------------------- datos
  const cargar = useCallback(async () => {
    try {
      // Primero se averigua el último dato cargado y el volumen por mes: de eso
      // depende qué periodo se muestra con `ultimo` y `anio`.
      const general = await inyeccionService.getDashboard({ bu: cfg.bu }, "mes");
      const hasta = general.totales?.hasta
        ? String(general.totales.hasta).slice(0, 10)
        : null;
      const referencia =
        cfg.periodo === "ultimo" ? mesConDatosSuficientes(general.serie, hasta) : hasta;
      const p = resolverPeriodo(cfg.periodo, referencia, cfg.bu);

      const d = await inyeccionService.getDashboard(p.filtros, p.agrupar);
      setDatos(d);
      setPeriodo({ etiqueta: p.etiqueta, hasta });
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

  const porBu = (datos?.porBu || []).filter((r) => r.bu);
  const porMaquina = (datos?.porMaquina || []).slice(0, 12);
  // Antes un periodo sin datos dejaba la pantalla en blanco sin explicación
  const sinDatos = datos && !datos.totales?.registros;

  const serie = useMemo(() => {
    if (!datos?.serie) return [];
    const mapa = new Map();
    for (const r of datos.serie) {
      if (!r.bu) continue;
      if (!mapa.has(r.periodo)) {
        mapa.set(r.periodo, { periodo: r.periodo, etiqueta: r.etiqueta });
      }
      mapa.get(r.periodo)[r.bu] = r.pct_scrap;
    }
    return [...mapa.values()].sort((a, b) => a.periodo.localeCompare(b.periodo));
  }, [datos]);

  const diasSinCarga = periodo?.hasta
    ? Math.floor((Date.now() - new Date(`${periodo.hasta}T12:00:00`).getTime()) / 86400000)
    : null;

  const nombreVista = { bu: "Scrap por unidad de negocio", maquinas: "Por máquina", evolucion: "Evolución" };
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
          <h1 className="text-4xl font-bold tracking-tight">Producción Inyección</h1>
          <p className="text-xl mt-1" style={{ color: TENUE }}>
            {periodo?.etiqueta || "Cargando..."}
            <span className="mx-3">·</span>
            {nombreVista[actual] || actual}
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
          <div
            className="h-full transition-none"
            style={{ width: `${progreso}%`, backgroundColor: "#4d9fe0" }}
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
        ) : sinDatos ? (
          <Vacio
            texto={
              `No hay producción cargada para ${periodo?.etiqueta}.` +
              (periodo?.hasta ? ` El último dato es del ${periodo.hasta}.` : "")
            }
          />
        ) : actual === "bu" ? (
          <div className="h-full flex flex-col gap-5">
            <div
              className="grid gap-4"
              style={{ gridTemplateColumns: `repeat(${porBu.length || 1}, minmax(0,1fr))` }}
            >
              {porBu.map((r) => (
                <div
                  key={r.bu}
                  className="rounded-2xl p-5 border-t-8"
                  style={{ backgroundColor: PANEL, borderColor: COLOR_BU[r.bu] || "#64748b" }}
                >
                  <div className="flex items-center gap-3">
                    {/* Datos a la izquierda, foto a la derecha */}
                    <div className="min-w-0 flex-1">
                      <p className="text-lg font-medium truncate" style={{ color: TENUE }}>
                        {r.bu}
                      </p>
                      <p
                        className="text-5xl font-bold mt-2 tabular-nums"
                        style={{ color: COLOR_BU[r.bu] || TEXTO }}
                      >
                        {pct(r.pct_scrap)}
                      </p>
                      <p className="text-base mt-2 tabular-nums" style={{ color: TENUE }}>
                        {miles(r.produccion)} pzas
                      </p>
                    </div>
                    {IMAGEN_BU[r.bu] && (
                      <img
                        src={IMAGEN_BU[r.bu]}
                        alt=""
                        onError={(e) => {
                          e.currentTarget.style.display = "none";
                        }}
                        className="h-24 w-36 object-contain flex-shrink-0"
                      />
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex-1 min-h-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={porBu} margin={{ top: 20, right: 30, bottom: 10, left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                  <XAxis dataKey="bu" tick={{ fill: TEXTO, fontSize: 20 }} axisLine={false} />
                  <YAxis
                    tick={{ fill: TENUE, fontSize: 18 }}
                    axisLine={false}
                    tickFormatter={(v) => (v >= 1000 ? `${v / 1000}k` : v)}
                  />
                  <Bar dataKey="produccion" radius={[6, 6, 0, 0]}>
                    {porBu.map((r) => (
                      <Cell key={r.bu} fill={COLOR_BU[r.bu] || "#64748b"} />
                    ))}
                    <LabelList
                      dataKey="produccion"
                      position="top"
                      formatter={miles}
                      style={{ fill: TEXTO, fontSize: 18, fontWeight: 600 }}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        ) : actual === "maquinas" ? (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={porMaquina} margin={{ top: 25, right: 40, bottom: 10, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
              <XAxis dataKey="maquina" tick={{ fill: TEXTO, fontSize: 20 }} axisLine={false} />
              <YAxis
                yAxisId="izq"
                tick={{ fill: TENUE, fontSize: 18 }}
                axisLine={false}
                tickFormatter={(v) => (v >= 1000 ? `${v / 1000}k` : v)}
              />
              <YAxis
                yAxisId="der"
                orientation="right"
                tick={{ fill: "#f0913a", fontSize: 18 }}
                axisLine={false}
                tickFormatter={(v) => `${v}%`}
              />
              <Bar yAxisId="izq" dataKey="produccion" fill="#4d9fe0" radius={[6, 6, 0, 0]} />
              <Line
                yAxisId="der"
                type="monotone"
                dataKey="pct_scrap"
                stroke="#f0913a"
                strokeWidth={4}
                dot={{ r: 5, fill: "#f0913a" }}
              >
                <LabelList
                  dataKey="pct_scrap"
                  position="top"
                  formatter={(v) => `${Number(v).toFixed(1)}%`}
                  style={{ fill: "#f0913a", fontSize: 17, fontWeight: 600 }}
                />
              </Line>
            </ComposedChart>
          </ResponsiveContainer>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={serie} margin={{ top: 20, right: 30, bottom: 10, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
              <XAxis dataKey="etiqueta" tick={{ fill: TEXTO, fontSize: 18 }} axisLine={false} />
              <YAxis
                tick={{ fill: TENUE, fontSize: 18 }}
                axisLine={false}
                tickFormatter={(v) => `${v}%`}
              />
              {porBu.map((r) => (
                <Line
                  key={r.bu}
                  type="monotone"
                  dataKey={r.bu}
                  stroke={COLOR_BU[r.bu] || "#64748b"}
                  strokeWidth={4}
                  dot={false}
                />
              ))}
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Pie: leyenda y aviso de que no se suman */}
      <div className="flex items-center justify-between px-8 pb-5 text-lg">
        <div className="flex gap-6 flex-wrap">
          {porBu.map((r) => (
            <span key={r.bu} className="flex items-center gap-2">
              <span
                className="w-4 h-4 rounded"
                style={{ backgroundColor: COLOR_BU[r.bu] || "#64748b" }}
              />
              <span style={{ color: TENUE }}>{r.bu}</span>
            </span>
          ))}
        </div>
        <span style={{ color: "#475569" }} className="text-sm">
          Cada BU es un componente distinto; no se suman entre sí
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
