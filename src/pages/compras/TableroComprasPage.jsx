import { useState, useEffect } from "react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import { BarChart3, Loader2, AlertTriangle, Download } from "lucide-react";
import api from "../../services/api";
import { dinero } from "../../components/compras/formatoCompras";
import { exportarTableroCompras } from "../../utils/exportarTableroCompras";

/**
 * Tablero de Compras, para Dirección (Celina y Stefano). Solo consulta: no
 * enseña la captura de formatos ni las cotizaciones, y es un módulo aparte para
 * darles permiso solo a esto.
 *
 * Mientras se usa el formato en papel, el gasto autorizado son los formatos
 * capturados. Todo se puede ver en pesos o en dólares (FIX de Banxico del día
 * de cada formato; el presupuesto, con el FIX más reciente).
 *
 * Dos gráficas siguen los renglones del P&L de Finanzas (MANUTENZIONE y ALTRI
 * COSTI FISSI): el gasto de las cuentas de cada renglón, juntando las que
 * tienen el mismo concepto. Una cuenta puede estar en los dos. Lo que se
 * compra con cuentas que no están en ninguno de los dos va a "Otros gastos",
 * por cuenta.
 *
 * Gráficas: una serie cada una, en el azul del DBX. El rojo solo marca un área
 * que rebasó su presupuesto, y siempre va con la palabra "Rebasa".
 */

const AZUL = "#236093";
const PISTA = "#e5e7eb";
const ROJO = "#b42318";
// Los renglones del P&L vienen en italiano (así los usa Finproject)
const EN_ESPANOL = { MANUTENZIONE: "mantenimiento", "ALTRI COSTI FISSI": "otros costos fijos" };
const MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

const hoy = () => new Date().toLocaleDateString("en-CA");
const mensajeError = (e) => e.response?.data?.message || e.message;

/** $1.2 M, $350 k: para ejes, donde no cabe el número completo. */
function corto(n, moneda) {
  const s = moneda === "USD" ? "US$" : "$";
  const a = Math.abs(n);
  if (a >= 1e6) return `${s}${(n / 1e6).toFixed(a >= 1e7 ? 0 : 1)} M`;
  if (a >= 1e3) return `${s}${Math.round(n / 1e3)} k`;
  return `${s}${Math.round(n)}`;
}

function Kpi({ titulo, valor, detalle, alerta }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl px-4 py-3">
      <p className="text-xs text-gray-500">{titulo}</p>
      <p className={`text-2xl font-semibold tabular-nums ${alerta ? "text-red-700" : "text-gray-900"}`}>{valor}</p>
      {detalle && <p className="text-xs text-gray-400 mt-0.5">{detalle}</p>}
    </div>
  );
}

function Tarjeta({ titulo, nota, children, className = "" }) {
  return (
    <section className={`bg-white border border-gray-200 rounded-xl p-4 ${className}`}>
      <h2 className="text-sm font-semibold text-gray-800">{titulo}</h2>
      {nota && <p className="text-xs text-gray-400 mb-3">{nota}</p>}
      {!nota && <div className="mb-3" />}
      {children}
    </section>
  );
}

/** Un renglón del P&L: gasto por concepto, con los conceptos sin gasto al final. */
function GrupoCuentas({ g, moneda, sinCuenta, como = "por concepto, con las cuentas de Finanzas", vacio }) {
  const titulo = g.grupo.charAt(0) + g.grupo.slice(1).toLowerCase();
  const max = Math.max(1, ...g.conceptos.map((c) => c.total));
  const nota = [
    `${dinero(g.total, moneda)} en ${g.n} ${g.n === 1 ? "compra" : "compras"} · ${como}`,
    sinCuenta ? `${sinCuenta} ${sinCuenta === 1 ? "compra sin cuenta capturada no entra" : "compras sin cuenta capturada no entran"}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <Tarjeta titulo={`${titulo}${EN_ESPANOL[g.grupo] ? ` (${EN_ESPANOL[g.grupo]})` : ""}`} nota={nota}>
      {g.conceptos.length === 0 && vacio && <p className="text-sm text-gray-400 py-6 text-center">{vacio}</p>}
      <ul className="space-y-2.5">
        {g.conceptos.map((c) => {
          const cuentas = c.cuentas.map((x) => `${x.codigo} ${x.nombre}`).join("\n");
          const resumen = c.total
            ? `${dinero(c.total, moneda)} en ${c.n} ${c.n === 1 ? "compra" : "compras"}`
            : "Sin gasto en el periodo";
          return (
            <li key={c.clave} title={`${c.nombre}\n${resumen}\n\n${cuentas}`}>
              <div className="flex items-baseline justify-between gap-2 text-sm">
                <span className={`truncate ${c.total ? "text-gray-700" : "text-gray-400"}`}>{c.nombre}</span>
                <span className="text-xs text-gray-500 tabular-nums whitespace-nowrap">
                  {c.total ? (
                    <>
                      <b className="text-gray-900 font-semibold">{corto(c.total, moneda)}</b> · {c.n}
                    </>
                  ) : (
                    "—"
                  )}
                </span>
              </div>
              {c.total > 0 && (
                <div className="h-2.5 mt-1 rounded" style={{ width: `max(${(c.total / max) * 100}%, 3px)`, background: AZUL }} />
              )}
            </li>
          );
        })}
      </ul>
    </Tarjeta>
  );
}

/** Tooltip de la gráfica por mes: texto en tinta, no en el color de la serie. */
function TooltipMes({ active, payload, moneda }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm px-3 py-2 text-xs">
      <p className="font-medium text-gray-800">{d.etiquetaLarga}</p>
      <p className="text-gray-600">
        {dinero(d.total, moneda)} · {d.n} {d.n === 1 ? "compra" : "compras"}
      </p>
    </div>
  );
}

export default function TableroComprasPage() {
  const [desde, setDesde] = useState(`${new Date().getFullYear()}-01-01`);
  const [hasta, setHasta] = useState(hoy());
  const [areaId, setAreaId] = useState("");
  const [moneda, setMoneda] = useState("MXN");
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let vivo = true;
    api
      .get("/compras/tablero", { params: { desde, hasta } })
      .then((r) => {
        if (!vivo) return;
        setDatos(r.data.data);
        setError(null);
      })
      .catch((e) => vivo && setError(mensajeError(e)));
    return () => {
      vivo = false;
    };
  }, [desde, hasta]);

  // --- Cálculos (en la moneda elegida) ---
  const campo = moneda === "USD" ? "monto_usd" : "monto_mxn";
  const tc = datos?.tipoCambio?.valor || null;
  const formatos = (datos?.formatos || []).filter((f) => !areaId || String(f.area_id) === areaId);
  const conMonto = formatos.filter((f) => f[campo] != null);
  const sinTc = formatos.filter((f) => f.monto != null && f[campo] == null).length;
  const gasto = conMonto.reduce((s, f) => s + f[campo], 0);
  const aMoneda = (mxn) => (moneda === "USD" ? (tc ? mxn / tc : null) : mxn);
  const presupuestoMxn = (datos?.presupuesto || [])
    .filter((p) => !areaId || String(p.area_id) === areaId)
    .reduce((s, p) => s + p.monto_mxn, 0);
  const presupuesto = aMoneda(presupuestoMxn);
  const disponible = presupuesto == null ? null : presupuesto - gasto;
  // Dirección firma al final: cuentan las que ya tienen las otras tres firmas
  const esperanDireccion = formatos.filter((f) => f.espera_direccion).length;

  // Por área: gasto contra presupuesto
  const porArea = (datos?.areas || [])
    .filter((a) => !areaId || String(a.id) === areaId)
    .map((a) => {
      const g = conMonto.filter((f) => f.area_id === a.id).reduce((s, f) => s + f[campo], 0);
      const p = aMoneda((datos.presupuesto.find((x) => x.area_id === a.id)?.monto_mxn) || 0) || 0;
      return { ...a, gasto: g, presupuesto: p };
    })
    .filter((a) => a.gasto > 0 || a.presupuesto > 0)
    .sort((x, y) => y.gasto - x.gasto || y.presupuesto - x.presupuesto);
  const maxArea = Math.max(1, ...porArea.map((a) => Math.max(a.gasto, a.presupuesto)));

  // Por mes: todos los meses del periodo, aunque no tengan compras
  const meses = [];
  if (datos) {
    const [y0, m0] = datos.desde.split("-").map(Number);
    const [y1, m1] = datos.hasta.split("-").map(Number);
    for (let i = y0 * 12 + (m0 - 1); i <= y1 * 12 + (m1 - 1); i++) {
      const y = Math.floor(i / 12);
      const m = (i % 12) + 1;
      const clave = `${y}-${String(m).padStart(2, "0")}`;
      const delMes = conMonto.filter((f) => f.fecha.startsWith(clave));
      meses.push({
        clave,
        etiqueta: y0 === y1 ? MESES[m - 1] : `${MESES[m - 1]} ${String(y).slice(2)}`,
        etiquetaLarga: `${MESES[m - 1]} ${y}`,
        total: delMes.reduce((s, f) => s + f[campo], 0),
        n: delMes.length,
      });
    }
  }

  // Por tipo
  const tipos = new Map();
  for (const f of conMonto) {
    const k = f.clasif_tipo || "Sin tipo";
    const t = tipos.get(k) || { nombre: k, total: 0, n: 0 };
    t.total += f[campo];
    t.n += 1;
    tipos.set(k, t);
  }
  const porTipo = [...tipos.values()].sort((a, b) => b.total - a.total);
  const maxTipo = Math.max(1, ...porTipo.map((t) => t.total));

  // Renglones del P&L (Finanzas): cada uno por su lado; una cuenta puede estar en varios
  const sinCuenta = conMonto.filter((f) => !f.cuenta).length;
  const grupos = [];
  for (const r of datos?.gruposCuenta || []) {
    let g = grupos.find((x) => x.grupo === r.grupo);
    if (!g) grupos.push((g = { grupo: r.grupo, conceptos: [], porCuenta: new Map(), total: 0, n: 0 }));
    const clave = r.concepto.trim().toLowerCase();
    let c = g.conceptos.find((x) => x.clave === clave);
    if (!c) g.conceptos.push((c = { clave, nombre: r.concepto, cuentas: [], total: 0, n: 0 }));
    c.cuentas.push({ codigo: r.codigo, nombre: r.cuenta_nombre });
    g.porCuenta.set(r.codigo, c);
  }
  for (const g of grupos) {
    for (const f of conMonto) {
      const c = g.porCuenta.get(f.cuenta);
      if (!c) continue;
      c.total += f[campo];
      c.n += 1;
      g.total += f[campo];
      g.n += 1;
    }
    g.conceptos.sort((a, b) => b.total - a.total || a.nombre.localeCompare(b.nombre, "es"));
  }

  // Otros gastos: compras con cuenta que no está en ningún renglón, una barra por cuenta
  const enGrupo = new Set((datos?.gruposCuenta || []).map((r) => r.codigo));
  const otros = { grupo: "OTROS GASTOS", conceptos: [], total: 0, n: 0 };
  for (const f of conMonto) {
    if (!f.cuenta || enGrupo.has(f.cuenta)) continue;
    let c = otros.conceptos.find((x) => x.clave === f.cuenta);
    if (!c) {
      const nombre = f.cuenta_nombre || "fuera de la lista de Finanzas";
      otros.conceptos.push((c = { clave: f.cuenta, nombre: `${f.cuenta} · ${nombre}`, cuentas: [{ codigo: f.cuenta, nombre }], total: 0, n: 0 }));
    }
    c.total += f[campo];
    c.n += 1;
    otros.total += f[campo];
    otros.n += 1;
  }
  otros.conceptos.sort((a, b) => b.total - a.total);

  const grandes = [...conMonto].sort((a, b) => b[campo] - a[campo]).slice(0, 10);
  const nombreArea = (datos?.areas || []).find((a) => String(a.id) === areaId)?.nombre;

  function exportar() {
    exportarTableroCompras({
      moneda,
      kpis: [
        ["Gasto autorizado", gasto],
        ["Compras", conMonto.length],
        ["Presupuesto del periodo", presupuesto],
        ["Disponible", disponible],
        ["Esperan firma de Dirección", esperanDireccion],
      ],
      porArea,
      meses,
      porTipo,
      grupos: grupos.length ? [...grupos, otros] : [],
      formatos: conMonto,
      campo,
      notas: [
        ["Periodo", `${datos.desde} a ${datos.hasta}`],
        ["Área", nombreArea || "Todas"],
        ["Moneda", moneda === "USD" ? "Dólares" : "Pesos"],
        ["Gasto", "Formatos de autorización capturados, tal como vienen en el formato (pueden incluir IVA)"],
        ["Presupuesto", "Presupuesto de Compras de los meses del periodo, sin IVA"],
        ["Tipo de cambio", "FIX de Banxico del día de cada formato; el presupuesto en dólares usa el FIX más reciente" + (tc ? ` (${tc} del ${datos.tipoCambio.fecha})` : "")],
      ],
    });
  }

  return (
    <div className="p-6 space-y-5 max-w-7xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-[#236093]/10 rounded-lg">
            <BarChart3 className="w-6 h-6 text-[#236093]" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Tablero de Compras</h1>
            <p className="text-sm text-gray-500">Gasto autorizado contra presupuesto, por área, mes, renglón del P&L y tipo</p>
          </div>
        </div>
        <button
          onClick={exportar}
          disabled={!datos || conMonto.length === 0}
          className="inline-flex items-center gap-2 px-3 py-2 text-sm border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-40"
        >
          <Download className="w-4 h-4" />
          Excel
        </button>
      </div>

      {/* Filtros: una fila, arriba de todas las gráficas */}
      <div className="flex flex-wrap items-end gap-3 bg-white border border-gray-200 rounded-xl px-4 py-3">
        <label className="block">
          <span className="block text-xs font-medium text-gray-500 mb-1">Desde</span>
          <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className="border border-gray-200 rounded-md px-2.5 py-1.5 text-sm" />
        </label>
        <label className="block">
          <span className="block text-xs font-medium text-gray-500 mb-1">Hasta</span>
          <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} className="border border-gray-200 rounded-md px-2.5 py-1.5 text-sm" />
        </label>
        <label className="block">
          <span className="block text-xs font-medium text-gray-500 mb-1">Área</span>
          <select value={areaId} onChange={(e) => setAreaId(e.target.value)} className="border border-gray-200 rounded-md px-2.5 py-1.5 text-sm">
            <option value="">Todas</option>
            {(datos?.areas || []).map((a) => (
              <option key={a.id} value={a.id}>
                {a.nombre}
              </option>
            ))}
          </select>
        </label>
        <div>
          <span className="block text-xs font-medium text-gray-500 mb-1">Moneda</span>
          <div className="flex rounded-md border border-gray-200 overflow-hidden">
            {[
              ["MXN", "Pesos"],
              ["USD", "Dólares"],
            ].map(([m, t]) => (
              <button
                key={m}
                onClick={() => setMoneda(m)}
                className={`px-3 py-1.5 text-sm ${moneda === m ? "bg-[#236093] text-white" : "text-gray-600 hover:bg-gray-50"}`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
        {moneda === "USD" && (
          <p className="text-xs text-gray-400 pb-2">
            {tc ? `FIX del día de cada formato · presupuesto a ${tc} (${datos.tipoCambio.fecha})` : "Sin tipo de cambio guardado"}
          </p>
        )}
      </div>

      {error && (
        <div className="flex items-start gap-2 text-sm text-red-700 bg-red-50 rounded-xl px-4 py-3">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          {error}
        </div>
      )}

      {!datos ? (
        !error && (
          <div className="flex justify-center py-16">
            <Loader2 className="w-7 h-7 animate-spin text-gray-300" />
          </div>
        )
      ) : (
        <>
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
            <Kpi
              titulo="Gasto autorizado"
              valor={dinero(gasto, moneda)}
              detalle={sinTc ? `${sinTc} sin tipo de cambio, no suman` : `${datos.desde} a ${datos.hasta}`}
            />
            <Kpi titulo="Compras" valor={conMonto.length.toLocaleString("es-MX")} detalle={nombreArea || "Todas las áreas"} />
            <Kpi
              titulo="Presupuesto disponible"
              valor={!presupuestoMxn ? "—" : dinero(disponible, moneda)}
              detalle={!presupuestoMxn ? "Sin presupuesto capturado en el periodo" : `de ${dinero(presupuesto, moneda)} del periodo${disponible < 0 ? " · rebasado" : ""}`}
              alerta={presupuestoMxn > 0 && disponible < 0}
            />
            <Kpi
              titulo="Esperan firma de Dirección"
              valor={esperanDireccion}
              detalle={esperanDireccion ? "Ya firmaron gerente, Compras y Finanzas" : "Ninguna pendiente"}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Tarjeta
              titulo="Gasto por área contra presupuesto"
              nota="La barra gris es el presupuesto del periodo; la azul, lo gastado"
            >
              {porArea.length === 0 ? (
                <p className="text-sm text-gray-400 py-6 text-center">Sin compras ni presupuesto en el periodo.</p>
              ) : (
                <ul className="space-y-2.5">
                  {porArea.map((a) => {
                    const rebasa = a.presupuesto > 0 && a.gasto > a.presupuesto;
                    return (
                      <li key={a.id} title={`${a.nombre}: ${dinero(a.gasto, moneda)} de ${a.presupuesto ? dinero(a.presupuesto, moneda) : "sin presupuesto"}`}>
                        <div className="flex items-baseline justify-between gap-2 text-sm">
                          <span className="text-gray-700 truncate">{a.nombre}</span>
                          <span className="text-xs text-gray-500 tabular-nums whitespace-nowrap">
                            {rebasa && (
                              <span className="inline-flex items-center gap-0.5 text-red-700 font-medium mr-1.5">
                                <AlertTriangle className="w-3 h-3" />
                                Rebasa
                              </span>
                            )}
                            <b className="text-gray-900 font-semibold">{corto(a.gasto, moneda)}</b>
                            {a.presupuesto > 0 ? ` de ${corto(a.presupuesto, moneda)}` : " · sin presupuesto"}
                          </span>
                        </div>
                        <div className="relative h-2.5 mt-1">
                          <div className="absolute inset-y-0 left-0 rounded" style={{ width: `${(a.presupuesto / maxArea) * 100}%`, background: PISTA }} />
                          <div
                            className="absolute inset-y-0 left-0 rounded"
                            style={{ width: `max(${(a.gasto / maxArea) * 100}%, ${a.gasto > 0 ? "3px" : "0px"})`, background: rebasa ? ROJO : AZUL }}
                          />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Tarjeta>

            <Tarjeta titulo={`Gasto por mes${moneda === "USD" ? " (dólares)" : ""}`}>
              {meses.every((m) => m.total === 0) ? (
                <p className="text-sm text-gray-400 py-6 text-center">Sin compras en el periodo.</p>
              ) : (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={meses} margin={{ top: 8, right: 8, left: 4, bottom: 0 }}>
                      <CartesianGrid vertical={false} stroke="#eef0f2" />
                      <XAxis dataKey="etiqueta" tickLine={false} axisLine={{ stroke: "#d5dbe1" }} tick={{ fontSize: 11, fill: "#5d6b78" }} />
                      <YAxis tickLine={false} axisLine={false} width={64} tick={{ fontSize: 11, fill: "#5d6b78" }} tickFormatter={(v) => corto(v, moneda)} />
                      <Tooltip cursor={{ fill: "#236093", fillOpacity: 0.06 }} content={<TooltipMes moneda={moneda} />} />
                      <Bar dataKey="total" fill={AZUL} radius={[4, 4, 0, 0]} maxBarSize={36} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Tarjeta>
          </div>

          {grupos.length > 0 && (
            <div className="grid gap-4 lg:grid-cols-2">
              {grupos.map((g) => (
                <GrupoCuentas key={g.grupo} g={g} moneda={moneda} sinCuenta={sinCuenta} />
              ))}
              <GrupoCuentas
                g={otros}
                moneda={moneda}
                sinCuenta={sinCuenta}
                como={`por cuenta, las que no están en ${grupos.map((g) => g.grupo.charAt(0) + g.grupo.slice(1).toLowerCase()).join(" ni en ")}`}
                vacio="Todas las compras del periodo con cuenta caen en los renglones de arriba."
              />
            </div>
          )}

          <div className="grid gap-4 lg:grid-cols-2">
            <Tarjeta titulo="En qué se gasta" nota="Por tipo de compra (lo asigna Compras)">
              {porTipo.length === 0 ? (
                <p className="text-sm text-gray-400 py-6 text-center">Sin compras en el periodo.</p>
              ) : (
                <ul className="space-y-2.5">
                  {porTipo.map((t) => (
                    <li key={t.nombre} title={`${t.nombre}: ${dinero(t.total, moneda)} en ${t.n} ${t.n === 1 ? "compra" : "compras"}`}>
                      <div className="flex items-baseline justify-between gap-2 text-sm">
                        <span className={`truncate ${t.nombre === "Sin tipo" ? "text-gray-400 italic" : "text-gray-700"}`}>{t.nombre}</span>
                        <span className="text-xs text-gray-500 tabular-nums whitespace-nowrap">
                          <b className="text-gray-900 font-semibold">{corto(t.total, moneda)}</b> · {t.n}
                        </span>
                      </div>
                      <div className="h-2.5 mt-1 rounded" style={{ width: `max(${(t.total / maxTipo) * 100}%, 3px)`, background: AZUL }} />
                    </li>
                  ))}
                </ul>
              )}
            </Tarjeta>

            <Tarjeta titulo="Las compras más grandes del periodo">
              {grandes.length === 0 ? (
                <p className="text-sm text-gray-400 py-6 text-center">Sin compras en el periodo.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
                        <th className="py-1.5 pr-3 font-medium">Fecha</th>
                        <th className="py-1.5 pr-3 font-medium">Área</th>
                        <th className="py-1.5 pr-3 font-medium">Requerimiento</th>
                        <th className="py-1.5 font-medium text-right">Monto</th>
                      </tr>
                    </thead>
                    <tbody>
                      {grandes.map((f) => (
                        <tr key={f.id} className="border-t border-gray-100 align-top">
                          <td className="py-1.5 pr-3 text-gray-500 whitespace-nowrap">{f.fecha.slice(8, 10)}/{f.fecha.slice(5, 7)}</td>
                          <td className="py-1.5 pr-3 text-gray-700">{f.area_nombre}</td>
                          <td className="py-1.5 pr-3 text-gray-900">
                            {f.requerimiento}
                            {f.clasif_tipo && <span className="block text-xs text-gray-400">{f.clasif_tipo}</span>}
                          </td>
                          <td className="py-1.5 text-right font-medium tabular-nums whitespace-nowrap">{dinero(f[campo], moneda)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Tarjeta>
          </div>

          <p className="text-xs text-gray-400">
            El gasto son los formatos de autorización capturados, tal como vienen en el formato (pueden incluir IVA). El
            presupuesto es el de Compras para los meses del periodo, sin IVA. Cuando el flujo con firmas esté en el sistema,
            el gasto saldrá de las órdenes de compra autorizadas.
          </p>
        </>
      )}
    </div>
  );
}
