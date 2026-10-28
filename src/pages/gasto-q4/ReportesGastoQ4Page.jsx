import { useState, useEffect, useCallback, useMemo } from "react";
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
  Cell,
  LabelList,
} from "recharts";
import {
  Wallet,
  Loader2,
  RefreshCw,
  Upload,
  Download,
  Search,
  ChevronRight,
  ChevronDown,
  FileSpreadsheet,
  AlertTriangle,
} from "lucide-react";
import { gastoQ4Service } from "../../services/gastoQ4.service";
import { useAuthStore } from "../../stores/auth.store";
import { exportarReporteGastoQ4, TIPO, NOMBRE_MES } from "../../utils/exportarReporteGastoQ4";

/**
 * Reporte de Gasto Q4.
 *
 * Lo que cada área entregó que necesita gastar de octubre a diciembre para
 * seguir operando, "solo lo indispensable". Son un centenar de conceptos: llegan
 * todos y aquí se filtra y se suma, sin volver al servidor.
 *
 * El tipo de gasto (fijo, variable, de una sola vez) lo calcula el servidor a
 * partir de los montos. "Por decidir" son los meses que todavía no empiezan:
 * lo de los meses que ya pasaron, o del que corre, ya está comprometido.
 *
 * En dólares todo se divide entre el último FIX de Banxico que se haya bajado;
 * la pantalla dice cuál y de qué fecha es.
 */

const AZUL = "#236093";
const VERDE = "#49a090";
const AMBAR = "#e0a526";
const GRIS = "#cbd5e1";

const COLOR_TIPO = { FIJO: AZUL, VARIABLE: VERDE, UNICO: AMBAR };
const ESTILO_TIPO = {
  FIJO: "bg-[#236093]/10 text-[#236093]",
  VARIABLE: "bg-[#49a090]/10 text-[#2f7a6c]",
  UNICO: "bg-amber-50 text-amber-700",
  CERO: "bg-gray-100 text-gray-500",
};
const MESES = ["octubre", "noviembre", "diciembre"];
const NUM_MES = { octubre: 10, noviembre: 11, diciembre: 12 };

const normal = (s) =>
  String(s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

/** "noviembre y diciembre", "octubre, noviembre y diciembre". */
const listaMeses = (ms) =>
  ms.length <= 1 ? ms.join("") : `${ms.slice(0, -1).join(", ")} y ${ms[ms.length - 1]}`;

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

const Seccion = ({ titulo, nota, acciones, children }) => (
  <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
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

function Chip({ activo, onClick, children, color }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${
        activo ? "text-white border-transparent" : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
      }`}
      style={activo ? { background: color || AZUL } : undefined}
    >
      {children}
    </button>
  );
}

export default function ReportesGastoQ4Page() {
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState(null);
  const [moneda, setMoneda] = useState("MXN");
  const [area, setArea] = useState("");
  const [tipos, setTipos] = useState([]);
  const [meses, setMeses] = useState(MESES);
  const [q, setQ] = useState("");
  const [abiertas, setAbiertas] = useState(new Set());
  const [actualizandoTc, setActualizandoTc] = useState(false);
  const [exportando, setExportando] = useState(false);
  const usuario = useAuthStore((s) => s.user);
  const esAdmin = Boolean(usuario?.rol?.esAdmin);

  const cargar = useCallback(async () => {
    try {
      setDatos(await gastoQ4Service.getReporte());
      setError(null);
    } catch (e) {
      setError(e.response?.data?.message || e.message);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const tc = datos?.tipoCambio;
  const hayTc = Boolean(tc?.valor);
  const usd = moneda === "USD" && hayTc;
  const conv = useCallback((v) => (usd ? v / tc.valor : v), [usd, tc]);
  const fmt = useCallback(
    (v) =>
      `${usd ? "US$" : "$"}${Number(conv(v)).toLocaleString("es-MX", { maximumFractionDigits: 0 })}`,
    [conv, usd],
  );
  /** Para los ejes y las etiquetas de las barras: $12.4 M, $850 k. */
  const fmtCorto = useCallback(
    (v) => {
      const x = conv(v);
      const s = usd ? "US$" : "$";
      if (Math.abs(x) >= 1e6) return `${s}${(x / 1e6).toLocaleString("es-MX", { maximumFractionDigits: 1 })} M`;
      if (Math.abs(x) >= 1e3) return `${s}${(x / 1e3).toLocaleString("es-MX", { maximumFractionDigits: 0 })} k`;
      return `${s}${Math.round(x)}`;
    },
    [conv, usd],
  );

  const nombreArea = useMemo(
    () => Object.fromEntries((datos?.areas || []).map((a) => [a.clave, a.nombre])),
    [datos],
  );
  const montoSel = useCallback((c) => meses.reduce((a, m) => a + c[m], 0), [meses]);

  // Todo menos el área: es lo que alimenta la gráfica por área (con el área
  // filtrada solo quedaría una barra)
  const sinFiltroArea = useMemo(() => {
    const t = normal(q.trim());
    return (datos?.conceptos || [])
      .filter((c) => tipos.length === 0 || tipos.includes(c.tipo))
      .filter((c) => !t || normal(c.concepto).includes(t))
      .map((c) => ({ ...c, area_nombre: nombreArea[c.area] || c.area }));
  }, [datos, tipos, q, nombreArea]);
  const filtrados = useMemo(
    () => sinFiltroArea.filter((c) => !area || c.area === area),
    [sinFiltroArea, area],
  );

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

  const { carga, hoy } = datos;

  if (!carga) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="bg-white rounded-xl border border-gray-100 p-10 text-center">
          <FileSpreadsheet className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-600">Todavía no se ha cargado el libro de Gasto Q4.</p>
          <Link
            to="/gasto-q4/carga"
            className="inline-flex items-center gap-2 mt-4 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark"
          >
            <Upload className="w-4 h-4" />
            Cargar el archivo
          </Link>
        </div>
      </div>
    );
  }

  // Meses que todavía no empiezan: lo único que todavía se puede decidir
  const pendientes = MESES.filter(
    (m) => carga.anio > hoy.anio || (carga.anio === hoy.anio && NUM_MES[m] > hoy.mes),
  );
  const pendientesSel = pendientes.filter((m) => meses.includes(m));

  const total = filtrados.reduce((a, c) => a + montoSel(c), 0);
  const porDecidir = filtrados.reduce((a, c) => a + pendientesSel.reduce((s, m) => s + c[m], 0), 0);
  const fijos = filtrados.filter((c) => c.tipo === "FIJO");
  // El monto que el concepto repite cada mes
  const fijoMensual = fijos.reduce((a, c) => a + (MESES.map((m) => c[m]).find((v) => v !== 0) || 0), 0);
  // Solo los que caen en los meses elegidos: sin octubre, lo que se paga solo en octubre no cuenta
  const unicos = filtrados.filter((c) => c.tipo === "UNICO" && montoSel(c) !== 0);
  const unico = unicos.reduce((a, c) => a + montoSel(c), 0);
  const areasConDatos = new Set(filtrados.map((c) => c.area)).size;

  // Gráfica por área
  const porArea = Object.values(
    sinFiltroArea.reduce((acc, c) => {
      acc[c.area] = acc[c.area] || { clave: c.area, nombre: c.area_nombre, total: 0 };
      acc[c.area].total += montoSel(c);
      return acc;
    }, {}),
  )
    .filter((a) => a.total !== 0)
    .sort((x, y) => y.total - x.total)
    .map((a) => ({ ...a, valor: conv(a.total) }));

  // Gráfica por mes, apilada por tipo
  const porMes = meses.map((m) => {
    const fila = { mes: NOMBRE_MES[m] };
    for (const t of ["FIJO", "VARIABLE", "UNICO"]) {
      fila[t] = conv(filtrados.filter((c) => c.tipo === t).reduce((a, c) => a + c[m], 0));
    }
    fila.total = fila.FIJO + fila.VARIABLE + fila.UNICO;
    return fila;
  });

  // Tabla: por área, con sus conceptos
  const grupos = Object.values(
    filtrados.reduce((acc, c) => {
      acc[c.area] = acc[c.area] || { clave: c.area, nombre: c.area_nombre, conceptos: [], total: 0 };
      acc[c.area].conceptos.push(c);
      acc[c.area].total += montoSel(c);
      return acc;
    }, {}),
  ).sort((x, y) => y.total - x.total);
  const buscando = q.trim() !== "";
  const abierta = (clave) => buscando || area === clave || abiertas.has(clave);
  const alternar = (clave) =>
    setAbiertas((s) => {
      const n = new Set(s);
      if (n.has(clave)) n.delete(clave);
      else n.add(clave);
      return n;
    });

  const alternarTipo = (t) => setTipos((ts) => (ts.includes(t) ? ts.filter((x) => x !== t) : [...ts, t]));
  const alternarMes = (m) =>
    setMeses((ms) => {
      if (ms.includes(m)) return ms.length === 1 ? ms : ms.filter((x) => x !== m);
      return MESES.filter((x) => ms.includes(x) || x === m);
    });

  const actualizarTc = async () => {
    setActualizandoTc(true);
    try {
      const r = await gastoQ4Service.actualizarTipoCambio();
      setDatos((d) => ({ ...d, tipoCambio: r }));
    } catch (e) {
      setError(e.response?.data?.message || e.message);
    } finally {
      setActualizandoTc(false);
    }
  };

  const exportar = async () => {
    setExportando(true);
    try {
      await exportarReporteGastoQ4({
        conceptos: filtrados,
        meses,
        conv,
        moneda: usd ? "USD" : "MXN",
        notas: [
          ["Archivo", `${carga.archivo || "—"} (hoja ${carga.hoja}), cargado el ${carga.creado_texto}`],
          ["Moneda", usd ? "Dólares" : "Pesos mexicanos"],
          ...(usd ? [["Tipo de cambio", `FIX de Banxico del ${tc.fecha}: ${tc.valor} pesos por dólar`]] : []),
          ["Meses", listaMeses(meses)],
          ["Área", area ? nombreArea[area] : "Todas"],
          ["Tipo de gasto", tipos.length ? tipos.map((t) => TIPO[t]).join(", ") : "Todos"],
          ["Búsqueda", q.trim() || "—"],
          ["Tipo de gasto, cómo se calcula", "Fijo: el mismo monto en dos o tres meses. Variable: dos o tres meses con montos distintos. De una sola vez: un solo mes."],
        ],
      });
    } finally {
      setExportando(false);
    }
  };

  // El dato guardado manda: sin token ya no se actualiza, pero el último sigue sirviendo
  const textoTc = hayTc
    ? `FIX de Banxico del ${tc.fecha}: $${tc.valor.toLocaleString("es-MX", { maximumFractionDigits: 4 })} por dólar`
    : !tc?.configurado
      ? "La vista en dólares necesita el token de Banxico en el servidor (BANXICO_TOKEN)."
      : tc.error || "Todavía no se ha bajado el tipo de cambio.";

  return (
    <div className="p-6 space-y-5 max-w-7xl mx-auto">
      {/* Encabezado */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-[#236093]/10 rounded-lg">
            <Wallet className="w-6 h-6 text-[#236093]" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Gasto indispensable Q4 {carga.anio}</h1>
            <p className="text-sm text-gray-500">
              Lo que cada área necesita gastar de octubre a diciembre para seguir operando
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/gasto-q4/carga"
            className="flex items-center gap-2 px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <Upload className="w-4 h-4" />
            Cargar archivo
          </Link>
          <button
            onClick={exportar}
            disabled={exportando || filtrados.length === 0}
            className="flex items-center gap-2 px-3 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary-dark disabled:opacity-40"
          >
            {exportando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Exportar a Excel
          </button>
        </div>
      </div>

      {/* De dónde sale y la moneda */}
      <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 flex flex-wrap items-center justify-between gap-3 text-sm">
        <div className="flex items-start gap-2 text-gray-600">
          <FileSpreadsheet className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
          <span>
            <span className="font-medium text-gray-700">{carga.archivo || "Archivo sin nombre"}</span> —
            hoja "{carga.hoja}", {carga.conceptos} conceptos. Cargado el {carga.creado_texto}
            {carga.usuario ? ` por ${carga.usuario}` : ""}.
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span
            className={`text-xs ${hayTc || !tc?.configurado ? "text-gray-500" : "text-amber-700"} max-w-xs text-right`}
          >
            {!hayTc && tc?.configurado && <AlertTriangle className="w-3.5 h-3.5 inline mr-1 -mt-0.5" />}
            {textoTc}
          </span>
          {esAdmin && tc?.configurado && (
            <button
              onClick={actualizarTc}
              disabled={actualizandoTc}
              title="Bajar el FIX de Banxico ahora"
              className="p-1.5 text-gray-500 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              {actualizandoTc ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            </button>
          )}
          <div className="flex rounded-lg border border-gray-300 overflow-hidden bg-white">
            {["MXN", "USD"].map((m) => (
              <button
                key={m}
                onClick={() => setMoneda(m)}
                disabled={m === "USD" && !hayTc}
                title={m === "USD" && !hayTc ? textoTc : undefined}
                className={`px-3 py-1.5 text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed ${
                  (m === "USD") === usd ? "bg-[#236093] text-white" : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && <div className="bg-red-50 text-red-700 p-3 rounded-xl text-sm">{error}</div>}

      {/* Filtros */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex flex-wrap items-center gap-x-6 gap-y-3">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">Meses</span>
          {MESES.map((m) => (
            <Chip key={m} activo={meses.includes(m)} onClick={() => alternarMes(m)}>
              {NOMBRE_MES[m]}
            </Chip>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">Tipo</span>
          {["FIJO", "VARIABLE", "UNICO"].map((t) => (
            <Chip key={t} activo={tipos.includes(t)} onClick={() => alternarTipo(t)} color={COLOR_TIPO[t]}>
              {TIPO[t]}
            </Chip>
          ))}
        </div>
        <select
          value={area}
          onChange={(e) => setArea(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm"
        >
          <option value="">Todas las áreas</option>
          {datos.areas
            .filter((a) => datos.conceptos.some((c) => c.area === a.clave))
            .map((a) => (
              <option key={a.clave} value={a.clave}>
                {a.nombre}
              </option>
            ))}
        </select>
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar concepto"
            className="w-full border border-gray-200 rounded-lg pl-9 pr-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
      </div>

      {/* Indicadores */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Tarjeta
          titulo={meses.length === 3 ? "Total Q4" : `Total de ${listaMeses(meses)}`}
          valor={fmt(total)}
          detalle={`${filtrados.length} conceptos de ${areasConDatos} ${areasConDatos === 1 ? "área" : "áreas"}`}
          color={AZUL}
        />
        <Tarjeta
          titulo="Por decidir"
          valor={fmt(porDecidir)}
          detalle={
            pendientesSel.length
              ? `${listaMeses(pendientesSel)}: los meses que todavía no empiezan`
              : "Los meses elegidos ya empezaron o ya pasaron"
          }
        />
        <Tarjeta
          titulo="Gasto fijo al mes"
          valor={fmt(fijoMensual)}
          detalle={`${fijos.length} conceptos con el mismo monto cada mes`}
          color={AZUL}
        />
        <Tarjeta
          titulo="De una sola vez"
          valor={fmt(unico)}
          detalle={`${unicos.length} conceptos que aparecen en un solo mes`}
          color="#b7791f"
        />
      </div>

      {filtrados.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 p-10 text-center text-gray-400">
          Ningún concepto cumple con esos filtros.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
            <div className="lg:col-span-3">
              <Seccion
                titulo="Gasto por área"
                nota="Da clic en una barra para ver solo esa área; otro clic la quita."
              >
                <ResponsiveContainer width="100%" height={Math.max(240, porArea.length * 30 + 20)}>
                  <BarChart data={porArea} layout="vertical" margin={{ top: 0, right: 80, left: 10, bottom: 0 }}>
                    <XAxis type="number" hide />
                    <YAxis type="category" dataKey="nombre" width={150} fontSize={12} tickLine={false} axisLine={false} />
                    <Tooltip
                      formatter={(v) => [fmt(usd ? v * tc.valor : v), "Total"]}
                      cursor={{ fill: "#f1f5f9" }}
                    />
                    <Bar
                      dataKey="valor"
                      radius={[0, 4, 4, 0]}
                      onClick={(d) => setArea((a) => (a === d.clave ? "" : d.clave))}
                      className="cursor-pointer"
                    >
                      {porArea.map((a) => (
                        <Cell key={a.clave} fill={!area || area === a.clave ? AZUL : GRIS} />
                      ))}
                      <LabelList
                        dataKey="total"
                        position="right"
                        formatter={fmtCorto}
                        fontSize={11}
                        fill="#6b7280"
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </Seccion>
            </div>
            <div className="lg:col-span-2">
              <Seccion
                titulo="Gasto por mes"
                nota="Separado por tipo de gasto, para ver de dónde sale cada mes."
              >
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={porMes} margin={{ top: 20, right: 10, left: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="mes" fontSize={12} />
                    <YAxis tickFormatter={(v) => fmtCorto(usd ? v * tc.valor : v)} fontSize={11} width={70} />
                    <Tooltip formatter={(v, k) => [fmt(usd ? v * tc.valor : v), TIPO[k] || k]} />
                    <Legend formatter={(k) => TIPO[k] || k} wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="FIJO" stackId="t" fill={AZUL} />
                    <Bar dataKey="VARIABLE" stackId="t" fill={VERDE} />
                    <Bar dataKey="UNICO" stackId="t" fill={AMBAR} radius={[4, 4, 0, 0]}>
                      <LabelList
                        dataKey="total"
                        position="top"
                        formatter={(v) => fmtCorto(usd ? v * tc.valor : v)}
                        fontSize={11}
                        fill="#374151"
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </Seccion>
            </div>
          </div>

          <Seccion
            titulo="Detalle por área"
            nota={
              "Fijo: el mismo monto en dos o tres meses. Variable: dos o tres meses con montos distintos. " +
              "De una sola vez: un solo mes. El renglón es el del libro, para encontrar el concepto."
            }
            acciones={
              !buscando && (
                <button
                  onClick={() =>
                    setAbiertas((s) => (s.size === grupos.length ? new Set() : new Set(grupos.map((g) => g.clave))))
                  }
                  className="text-sm text-primary hover:underline"
                >
                  {abiertas.size === grupos.length ? "Cerrar todas" : "Abrir todas"}
                </button>
              )
            }
          >
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 border-b border-gray-100">
                    <th className="py-2 pr-3 font-medium">Área / concepto</th>
                    <th className="py-2 pr-3 font-medium">Tipo</th>
                    {meses.map((m) => (
                      <th key={m} className="py-2 pr-3 font-medium text-right">
                        {NOMBRE_MES[m]}
                      </th>
                    ))}
                    <th className="py-2 pr-3 font-medium text-right">Total</th>
                    <th className="py-2 font-medium text-right">%</th>
                  </tr>
                </thead>
                <tbody>
                  {grupos.map((g) => (
                    <GrupoArea
                      key={g.clave}
                      g={g}
                      meses={meses}
                      abierta={abierta(g.clave)}
                      onAlternar={() => alternar(g.clave)}
                      fmt={fmt}
                      montoSel={montoSel}
                      totalGeneral={total}
                    />
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-gray-200 font-semibold text-gray-800">
                    <td className="py-2 pr-3" colSpan={2}>
                      Total
                    </td>
                    {meses.map((m) => (
                      <td key={m} className="py-2 pr-3 text-right whitespace-nowrap">
                        {fmt(filtrados.reduce((a, c) => a + c[m], 0))}
                      </td>
                    ))}
                    <td className="py-2 pr-3 text-right whitespace-nowrap">{fmt(total)}</td>
                    <td className="py-2 text-right">100%</td>
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

function GrupoArea({ g, meses, abierta, onAlternar, fmt, montoSel, totalGeneral }) {
  const pct = (v) => (totalGeneral ? `${((v / totalGeneral) * 100).toFixed(1)}%` : "—");
  return (
    <>
      <tr className="border-b border-gray-100 bg-gray-50/60 hover:bg-gray-50 cursor-pointer" onClick={onAlternar}>
        <td className="py-2 pr-3 font-medium text-gray-900" colSpan={2}>
          <span className="inline-flex items-center gap-1.5">
            {abierta ? (
              <ChevronDown className="w-4 h-4 text-gray-400" />
            ) : (
              <ChevronRight className="w-4 h-4 text-gray-400" />
            )}
            {g.nombre}
            <span className="text-xs font-normal text-gray-400">({g.conceptos.length})</span>
          </span>
        </td>
        {meses.map((m) => (
          <td key={m} className="py-2 pr-3 text-right text-gray-700 whitespace-nowrap">
            {fmt(g.conceptos.reduce((a, c) => a + c[m], 0))}
          </td>
        ))}
        <td className="py-2 pr-3 text-right font-semibold text-gray-900 whitespace-nowrap">{fmt(g.total)}</td>
        <td className="py-2 text-right text-gray-500">{pct(g.total)}</td>
      </tr>
      {abierta &&
        g.conceptos.map((c) => (
          <tr key={c.id} className="border-b border-gray-50">
            <td className="py-1.5 pr-3 pl-7 text-gray-700">
              {c.mostrado}
              <span className="ml-2 text-[10px] text-gray-300">renglón {c.renglon}</span>
            </td>
            <td className="py-1.5 pr-3">
              <span className={`text-[11px] px-2 py-0.5 rounded-full whitespace-nowrap ${ESTILO_TIPO[c.tipo]}`}>
                {TIPO[c.tipo]}
              </span>
            </td>
            {meses.map((m) => (
              <td key={m} className={`py-1.5 pr-3 text-right whitespace-nowrap ${c[m] ? "text-gray-600" : "text-gray-300"}`}>
                {c[m] ? fmt(c[m]) : "—"}
              </td>
            ))}
            <td className="py-1.5 pr-3 text-right text-gray-800 whitespace-nowrap">{fmt(montoSel(c))}</td>
            <td className="py-1.5 text-right text-gray-400">{pct(montoSel(c))}</td>
          </tr>
        ))}
    </>
  );
}
