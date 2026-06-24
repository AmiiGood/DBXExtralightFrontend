import { useState, useEffect, useRef } from "react";
import {
  QrCode, CheckCircle2, Clock, XCircle, ChevronRight,
  Loader2, BarChart2, AlertTriangle, BoxSelect, Keyboard,
  ArrowLeft, Package,
} from "lucide-react";
import api from "../../services/api";
import Button from "../../components/ui/Button";

// ── Sonidos ───────────────────────────────────────────────────
const useScanSound = () => {
  const ctx = useRef(null);
  const play = (freqs, durs, type = "sine", vol = 0.3) => {
    try {
      if (!ctx.current || ctx.current.state === "closed")
        ctx.current = new (window.AudioContext || window.webkitAudioContext)();
      if (ctx.current.state === "suspended") ctx.current.resume();
      let t = ctx.current.currentTime;
      freqs.forEach((f, i) => {
        const o = ctx.current.createOscillator();
        const g = ctx.current.createGain();
        o.type = type; o.frequency.value = f;
        g.gain.setValueAtTime(vol, t);
        g.gain.exponentialRampToValueAtTime(0.01, t + durs[i]);
        o.connect(g); g.connect(ctx.current.destination);
        o.start(t); o.stop(t + durs[i]);
        t += durs[i] * 0.75;
      });
    } catch (_) {}
  };
  return {
    ok:   () => play([660, 880], [0.1, 0.18]),
    err:  () => play([330, 220], [0.2, 0.3], "square", 0.2),
    done: () => play([660, 880, 1100], [0.1, 0.1, 0.2]),
  };
};

function Badge({ children, color = "gray" }) {
  const map = {
    green:  "bg-green-100 text-green-700",
    yellow: "bg-yellow-100 text-yellow-700",
    blue:   "bg-blue-100 text-blue-700",
    gray:   "bg-gray-100 text-gray-600",
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${map[color]}`}>
      {children}
    </span>
  );
}

function ProgressBar({ value, max }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  const color = pct >= 100 ? "bg-green-500" : pct > 50 ? "bg-blue-500" : "bg-yellow-400";
  return (
    <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
      <div className={`h-2.5 rounded-full transition-all duration-300 ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

function ScanInput({ onScan, loading, placeholder }) {
  const [value, setValue] = useState("");
  const ref = useRef(null);
  const timerRef = useRef(null);
  const prevLoading = useRef(loading);

  // Focus inicial
  useEffect(() => { ref.current?.focus(); }, []);

  // Re-focus cuando loading pase de true a false (API respondió)
  useEffect(() => {
    if (prevLoading.current && !loading) {
      ref.current?.focus();
    }
    prevLoading.current = loading;
  }, [loading]);

  // Re-focus al hacer click en la página, salvo que el click haya sido en el input mismo
  useEffect(() => {
    const onFocusLost = (e) => {
      if (!loading && ref.current && !ref.current.contains(e.target)) {
        ref.current.focus();
      }
    };
    document.addEventListener("click", onFocusLost);
    return () => document.removeEventListener("click", onFocusLost);
  }, [loading]);

  const submit = (val) => {
    const v = (val ?? value).trim();
    if (!v || loading) return;
    onScan(v);
    setValue("");
  };

  const handleChange = (e) => {
    const v = e.target.value;
    setValue(v);
    clearTimeout(timerRef.current);
    if (v.trim()) {
      timerRef.current = setTimeout(() => submit(v), 80);
    }
  };

  return (
    <div className="flex gap-3">
      <div className="flex-1 relative">
        <Keyboard className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          ref={ref}
          className="w-full pl-10 pr-4 py-3 rounded-lg border-2 border-primary/30 bg-primary/5 text-gray-900 text-base focus:border-primary focus:ring-2 focus:ring-primary/20 placeholder-gray-400"
          placeholder={placeholder}
          value={value}
          onChange={handleChange}
          onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); clearTimeout(timerRef.current); submit(); } }}
          disabled={loading}
        />
      </div>
      <Button onClick={() => submit()} isLoading={loading} disabled={!value.trim()}>
        Registrar
      </Button>
    </div>
  );
}

function Alert({ type, text }) {
  const styles = {
    ok:   "bg-green-100 border-2 border-green-400 text-green-800",
    err:  "bg-red-100 border-2 border-red-400 text-red-800",
    warn: "bg-yellow-100 border-2 border-yellow-400 text-yellow-800",
  };
  const Icon = type === "ok" ? CheckCircle2 : type === "warn" ? AlertTriangle : XCircle;
  return (
    <div className={`flex items-center gap-3 px-5 py-4 rounded-xl ${styles[type]}`}>
      <Icon className="w-6 h-6 shrink-0" />
      <span className="text-base font-semibold">{text}</span>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────
export default function RecepcionCajasPage() {
  const tabs = [
    { id: "scan", label: "Escanear", icon: QrCode },
    { id: "reportes", label: "Reportes", icon: BarChart2 },
  ];
  const [tab, setTab] = useState("scan");

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="flex overflow-x-auto">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setTab(id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors
                ${tab === id ? "border-primary text-primary bg-primary/5" : "border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50"}`}>
              <Icon className="w-4 h-4" /> {label}
            </button>
          ))}
        </div>
      </div>
      {tab === "scan"     && <TabScan />}
      {tab === "reportes" && <TabReportes />}
    </div>
  );
}

// ── TAB SCAN ─────────────────────────────────────────────────
function TabScan() {
  const [vista, setVista] = useState("caja"); // "caja" | "pares"
  const [caja, setCaja] = useState(null);
  const [pares, setPares] = useState([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState(null);
  const snd = useScanSound();

  const setMsgTemp = (m) => { setMsg(m); };

  // Escanear QR de caja
  const handleScanCaja = async (raw) => {
    setLoading(true);
    setMsg(null);
    try {
      const r = await api.post("/recepcion/cajas/escanear", { qrRaw: raw });
      const { caja: c, retomada } = r.data.data;
      if (c.completa) {
        // Ya completada: solo alerta, no cambiar vista
        snd.err();
        setMsgTemp({ type: "warn", text: `⚠️ Esta caja ya está completa (${c.pares_escaneados}/${c.pares_esperados} pares). Escanea otra.` });
      } else {
        // Nueva o retomada: ir a escanear pares
        setCaja(c);
        setPares(c.pares || []);
        setVista("pares");
        if (retomada) {
          snd.ok();
          setMsgTemp({ type: "warn", text: `Caja retomada — faltan ${c.pares_esperados - c.pares_escaneados} pares` });
        } else {
          snd.ok();
          setMsgTemp({ type: "ok", text: `Caja registrada: ${c.sku} — ${c.pares_esperados} pares esperados` });
        }
      }
    } catch (e) {
      snd.err();
      setMsgTemp({ type: "err", text: e.response?.data?.message || "Error al escanear caja" });
    } finally {
      setLoading(false);
    }
  };

  // Escanear QR de par
  const handleScanPar = async (raw) => {
    if (!caja) return;
    setLoading(true);
    setMsg(null);
    try {
      const r = await api.post(`/recepcion/cajas/${caja.id}/pares`, { qrRaw: raw });
      const { caja: cajaAct, parEscaneado, completa, faltantes, upc } = r.data.data;
      setCaja(cajaAct);
      setPares(prev => [{ qr_raw: raw, upc, creado_en: new Date().toISOString() }, ...prev]);
      if (completa) {
        snd.done();
        setMsgTemp({ type: "ok", text: `🎉 ¡Caja completa! ${cajaAct.pares_esperados} pares verificados.` });
        setTimeout(() => {
          volverACaja();
        }, 2000);
      } else {
        snd.ok();
        setMsgTemp({ type: "ok", text: `Par ${parEscaneado} de ${cajaAct.pares_esperados}${upc ? ` — UPC: ${upc}` : ""} — faltan ${faltantes}` });
      }
    } catch (e) {
      snd.err();
      setMsgTemp({ type: "err", text: e.response?.data?.message || "Error al escanear par" });
    } finally {
      setLoading(false);
    }
  };

  const volverACaja = () => {
    setVista("caja");
    setCaja(null);
    setPares([]);
    setMsg(null);
  };

  const pct = caja ? Math.min(100, (caja.pares_escaneados / caja.pares_esperados) * 100) : 0;

  return (
    <div className="space-y-4">

      {/* VISTA: escanear caja */}
      {vista === "caja" && (
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <BoxSelect className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Escanear Caja</h3>
              <p className="text-xs text-gray-400">Escanea el QR de la etiqueta de la caja</p>
            </div>
          </div>
          <ScanInput onScan={handleScanCaja} loading={loading} placeholder="Escanea el QR de la caja..." />
          <p className="text-xs text-gray-400 mt-2">
            Formato: <code className="bg-gray-100 px-1 rounded">ID$SKU$PARES$CONSECUTIVO</code>
          </p>
          {msg && <div className="mt-3"><Alert {...msg} /></div>}
        </div>
      )}

      {/* VISTA: escanear pares */}
      {vista === "pares" && caja && (
        <>
          {/* Info de la caja */}
          <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-100">
            <div className="flex items-start justify-between mb-4">
              <div>
                <button onClick={volverACaja} className="flex items-center gap-1 text-xs text-primary hover:underline mb-2">
                  <ArrowLeft className="w-3 h-3" /> Escanear otra caja
                </button>
                <p className="text-xs text-gray-400 uppercase tracking-wide">Caja activa</p>
                <p className="text-xl font-bold text-gray-900 mt-0.5">{caja.sku}</p>
                <p className="text-sm text-gray-500">
                  Consecutivo: <span className="font-mono font-medium">{caja.consecutivo}</span>
                </p>
              </div>
              <div className="text-right">
                <p className="text-4xl font-bold text-primary leading-none">{caja.pares_escaneados}</p>
                <p className="text-sm text-gray-400 mt-1">de {caja.pares_esperados} pares</p>
              </div>
            </div>
            <ProgressBar value={caja.pares_escaneados} max={caja.pares_esperados} />
            <div className="flex items-center justify-between mt-2">
              <span className="text-xs text-gray-400">{pct.toFixed(0)}%</span>
              {caja.completa
                ? <Badge color="green"><CheckCircle2 className="w-3 h-3" /> Completa</Badge>
                : <Badge color="yellow"><Clock className="w-3 h-3" /> Faltan {caja.pares_esperados - caja.pares_escaneados}</Badge>
              }
            </div>
          </div>

          {/* Input escaneo par */}
          {!caja.completa ? (
            <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-100">
              <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <QrCode className="w-4 h-4 text-primary" /> Escanear Par
              </h3>
              <ScanInput onScan={handleScanPar} loading={loading} placeholder="Escanea la etiqueta del par..." />
              {msg && <div className="mt-3"><Alert {...msg} /></div>}
            </div>
          ) : (
            <div className="space-y-3">
              {msg && <Alert {...msg} />}
              <div className="bg-green-50 rounded-xl p-5 border border-green-200 text-center">
                <CheckCircle2 className="w-10 h-10 text-green-500 mx-auto mb-2" />
                <p className="font-semibold text-green-800">¡Caja completa!</p>
                <p className="text-sm text-green-600 mt-1">{caja.pares_esperados} pares verificados</p>
                <button onClick={volverACaja}
                  className="mt-4 px-5 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors">
                  Escanear siguiente caja
                </button>
              </div>
            </div>
          )}

          {/* Lista pares */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
              <h4 className="font-semibold text-gray-700 text-sm">
                Pares escaneados ({pares.length})
              </h4>
            </div>
            {pares.length === 0 ? (
              <div className="p-8 text-center text-gray-400 text-sm">
                <Package className="w-8 h-8 mx-auto mb-2 opacity-30" />
                Aún no hay pares escaneados
              </div>
            ) : (
              <div className="divide-y divide-gray-100 max-h-80 overflow-y-auto">
                {pares.map((p, i) => (
                  <div key={p.id || i} className="flex items-center justify-between px-5 py-2.5">
                    <span className="font-mono text-sm text-gray-800 truncate max-w-xs">{p.qr_raw}</span>
                    <div className="flex items-center gap-3 ml-2 shrink-0">
                      {p.upc && <span className="text-xs text-gray-400 font-mono">{p.upc}</span>}
                      <span className="text-xs text-gray-400">
                        {new Date(p.creado_en).toLocaleTimeString("es-MX")}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ── TAB REPORTES ──────────────────────────────────────────────
function TabReportes() {
  const [filters, setFilters] = useState({ fechaInicio: "", fechaFin: "", sku: "", completa: "" });
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const descargarExcel = async () => {
    if (!data) return;
    const ExcelJS = (await import("exceljs")).default;
    const { saveAs } = await import("file-saver");

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Recepción");

    ws.columns = [
      { header: "Consecutivo",    key: "consecutivo",     width: 14 },
      { header: "SKU",            key: "sku",             width: 24 },
      { header: "Pares Esperados",key: "pares_esperados", width: 16 },
      { header: "Pares Escaneados",key:"pares_escaneados",width: 17 },
      { header: "Estado",         key: "estado",          width: 12 },
      { header: "Fecha",          key: "fecha",           width: 22 },
      { header: "Usuario",        key: "usuario",         width: 20 },
    ];

    // Header style
    ws.getRow(1).eachCell(cell => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1e3a5f" } };
      cell.font = { color: { argb: "FFFFFFFF" }, bold: true };
      cell.alignment = { vertical: "middle", horizontal: "center" };
    });

    data.cajas.forEach(c => {
      const row = ws.addRow({
        consecutivo:     c.consecutivo,
        sku:             c.sku,
        pares_esperados: c.pares_esperados,
        pares_escaneados:c.pares_escaneados,
        estado:          c.completa ? "Completa" : "Pendiente",
        fecha:           new Date(c.creado_en).toLocaleString("es-MX"),
        usuario:         c.creado_por_nombre || "",
      });
      const estadoCell = row.getCell("estado");
      estadoCell.font = { color: { argb: c.completa ? "FF16a34a" : "FFca8a04" }, bold: true };
    });

    const buf = await wb.xlsx.writeBuffer();
    saveAs(new Blob([buf]), `recepcion_${new Date().toISOString().slice(0,10)}.xlsx`);
  };

  const imprimirPDF = () => {
    if (!data) return;
    const fecha = new Date().toLocaleString("es-MX");
    const { totalCajas, cajasCompletas, cajasPendientes, totalParesEsperados, totalParesEscaneados } = data.resumen;
    const filas = data.cajas.map(c => `
      <tr>
        <td>${c.consecutivo}</td>
        <td>${c.sku}</td>
        <td style="text-align:center">${c.pares_esperados}</td>
        <td style="text-align:center">${c.pares_escaneados}</td>
        <td style="text-align:center;color:${c.completa ? '#16a34a' : '#ca8a04'};font-weight:600">${c.completa ? 'Completa' : 'Pendiente'}</td>
        <td>${new Date(c.creado_en).toLocaleString("es-MX")}</td>
        <td>${c.creado_por_nombre || '—'}</td>
      </tr>`).join("");

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
      <title>Reporte Recepción</title>
      <style>
        body{font-family:Arial,sans-serif;font-size:11px;margin:24px;color:#111}
        h1{font-size:17px;margin-bottom:2px} .sub{color:#666;margin-bottom:16px}
        .cards{display:flex;gap:16px;margin-bottom:16px;flex-wrap:wrap}
        .card{background:#f3f4f6;border-radius:6px;padding:8px 14px}
        .card p{margin:0;font-size:9px;color:#555;text-transform:uppercase}
        .card b{font-size:18px}
        table{width:100%;border-collapse:collapse}
        thead{background:#1e3a5f;color:#fff}
        th{padding:7px 9px;text-align:left;font-size:10px;text-transform:uppercase}
        td{padding:6px 9px;border-bottom:1px solid #e5e7eb}
        tr:nth-child(even){background:#f9fafb}
        @media print{@page{margin:1cm}}
      </style>
    </head><body>
      <h1>Reporte de Recepción de Cajas</h1>
      <div class="sub">Generado: ${fecha}</div>
      <div class="cards">
        <div class="card"><p>Total Cajas</p><b>${totalCajas}</b></div>
        <div class="card"><p>Completas</p><b style="color:#16a34a">${cajasCompletas}</b></div>
        <div class="card"><p>Pendientes</p><b style="color:#ca8a04">${cajasPendientes}</b></div>
        <div class="card"><p>Pares Esperados</p><b>${totalParesEsperados}</b></div>
        <div class="card"><p>Pares Escaneados</p><b>${totalParesEscaneados}</b></div>
      </div>
      <table>
        <thead><tr><th>Consecutivo</th><th>SKU</th><th>Esperados</th><th>Escaneados</th><th>Estado</th><th>Fecha</th><th>Usuario</th></tr></thead>
        <tbody>${filas}</tbody>
      </table>
      <script>window.onload=()=>window.print()<\/script>
    </body></html>`;

    const w = window.open("", "_blank");
    w.document.write(html);
    w.document.close();
  };

  const buscar = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.fechaInicio) params.set("fechaInicio", `${filters.fechaInicio}T00:00:00`);
      if (filters.fechaFin)    params.set("fechaFin",    `${filters.fechaFin}T23:59:59`);
      if (filters.sku)         params.set("sku",         filters.sku);
      if (filters.completa !== "") params.set("completa", filters.completa);
      const r = await api.get(`/recepcion/reportes?${params}`);
      setData(r.data.data);
    } finally { setLoading(false); }
  };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-100">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Fecha inicio</label>
            <input type="date" className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:border-primary focus:ring-2 focus:ring-primary/20"
              value={filters.fechaInicio} onChange={e => setFilters(p => ({ ...p, fechaInicio: e.target.value }))} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Fecha fin</label>
            <input type="date" className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:border-primary focus:ring-2 focus:ring-primary/20"
              value={filters.fechaFin} onChange={e => setFilters(p => ({ ...p, fechaFin: e.target.value }))} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">SKU</label>
            <input type="text" placeholder="Filtrar por SKU..." className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:border-primary focus:ring-2 focus:ring-primary/20"
              value={filters.sku} onChange={e => setFilters(p => ({ ...p, sku: e.target.value }))}
              onKeyDown={e => e.key === "Enter" && buscar()} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Estado</label>
            <select className="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white text-sm focus:border-primary focus:ring-2 focus:ring-primary/20"
              value={filters.completa} onChange={e => setFilters(p => ({ ...p, completa: e.target.value }))}>
              <option value="">Todas</option>
              <option value="true">Completas</option>
              <option value="false">Pendientes</option>
            </select>
          </div>
        </div>
        <div className="mt-4 flex gap-3 flex-wrap">
          <Button onClick={buscar} isLoading={loading}>Generar reporte</Button>
          <button onClick={descargarExcel} disabled={!data}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border-2 border-green-600 text-green-700 font-medium text-sm hover:bg-green-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
            📅 Descargar Excel
          </button>
          <button onClick={imprimirPDF} disabled={!data}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border-2 border-red-500 text-red-600 font-medium text-sm hover:bg-red-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
            📄 Descargar PDF
          </button>
        </div>
      </div>

      {data && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {[
              { label: "Total cajas",       value: data.resumen.totalCajas,            color: "blue" },
              { label: "Completas",         value: data.resumen.cajasCompletas,         color: "green" },
              { label: "Pendientes",        value: data.resumen.cajasPendientes,        color: "yellow" },
              { label: "Pares esperados",   value: data.resumen.totalParesEsperados,    color: "blue" },
              { label: "Pares escaneados",  value: data.resumen.totalParesEscaneados,   color: "green" },
            ].map(({ label, value, color }) => {
              const map = {
                blue:   "bg-blue-50 border-blue-200 text-blue-700",
                green:  "bg-green-50 border-green-200 text-green-700",
                yellow: "bg-yellow-50 border-yellow-200 text-yellow-700",
              };
              return (
                <div key={label} className={`rounded-xl p-4 border ${map[color]}`}>
                  <p className="text-xs uppercase tracking-wide mb-1 opacity-70">{label}</p>
                  <p className="text-2xl font-bold">{value}</p>
                </div>
              );
            })}
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100 text-xs font-semibold text-gray-500 uppercase">
                  <tr>
                    <th className="px-4 py-3 text-left">Consecutivo</th>
                    <th className="px-4 py-3 text-left">SKU</th>
                    <th className="px-4 py-3 text-center">Esperados</th>
                    <th className="px-4 py-3 text-center">Escaneados</th>
                    <th className="px-4 py-3 text-left">Estado</th>
                    <th className="px-4 py-3 text-left">Fecha</th>
                    <th className="px-4 py-3 text-left">Usuario</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.cajas.length === 0 ? (
                    <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">Sin resultados</td></tr>
                  ) : data.cajas.map(c => (
                    <tr key={c.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-mono font-medium text-gray-900">{c.consecutivo}</td>
                      <td className="px-4 py-3 font-mono text-gray-700">{c.sku}</td>
                      <td className="px-4 py-3 text-center">{c.pares_esperados}</td>
                      <td className="px-4 py-3 text-center">{c.pares_escaneados}</td>
                      <td className="px-4 py-3">
                        {c.completa
                          ? <Badge color="green"><CheckCircle2 className="w-3 h-3" /> Completa</Badge>
                          : <Badge color="yellow"><Clock className="w-3 h-3" /> Pendiente</Badge>}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">
                        {new Date(c.creado_en).toLocaleString("es-MX")}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">{c.creado_por_nombre}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
