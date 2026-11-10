import { useState, useEffect } from "react";
import {
  ClipboardPenLine, Loader2, Plus, Pencil, Trash2, Download, AlertTriangle, X, Save, Search,
} from "lucide-react";
import { comprasService } from "../../services/compras.service";
import { dinero } from "../../components/compras/formatoCompras";
import { exportarFormatosCompras } from "../../utils/exportarFormatosCompras";

/**
 * Formatos de Compras.
 *
 * Captura del "Formato de autorización y registro de compras" en papel, mientras
 * el flujo con firmas no está en el sistema, y su reporte. Quien firmó va como
 * texto; tipo, cuenta y centro de costos también, con sugerencias de lo ya
 * capturado, hasta que Compras y Finanzas manden sus listas.
 *
 * Un formato se puede capturar a medias y completarse después: está completo
 * cuando tiene las cuatro firmas (gerente, Compras, Dirección y Finanzas).
 */

const FIRMAS = [
  { campo: "autorizo_gerente", corto: "G", nombre: "Gerente" },
  { campo: "autorizo_compras", corto: "C", nombre: "Compras" },
  { campo: "autorizo_direccion", corto: "D", nombre: "Dirección" },
  { campo: "autorizo_finanzas", corto: "F", nombre: "Finanzas" },
];

const hoy = () => new Date().toLocaleDateString("en-CA");
const fechaCorta = (s) =>
  s ? new Date(`${s}T12:00:00`).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" }) : "—";
const mensajeError = (e) => e.response?.data?.message || e.message;
const pesos = (n) => dinero(n);

// Fila del API → estado del formulario (los nombres que espera el API al guardar)
const aFormulario = (f) => ({
  ticket: f?.ticket || "",
  fecha: f?.fecha || hoy(),
  areaId: f?.compras_area_id ? String(f.compras_area_id) : "",
  requerimiento: f?.requerimiento || "",
  monto: f?.monto != null ? String(f.monto) : "",
  moneda: f?.moneda || "MXN",
  autorizoGerente: f?.autorizo_gerente || "",
  clasifTipo: f?.clasif_tipo || "",
  autorizoCompras: f?.autorizo_compras || "",
  autorizoDireccion: f?.autorizo_direccion || "",
  cuenta: f?.cuenta || "",
  centroCostos: f?.centro_costos || "",
  autorizoFinanzas: f?.autorizo_finanzas || "",
  observaciones: f?.observaciones || "",
});

const estiloCampo =
  "w-full border border-gray-200 rounded-md px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#236093]/30";

function Campo({ etiqueta, children, className = "" }) {
  return (
    <label className={`block ${className}`}>
      <span className="block text-xs font-medium text-gray-500 mb-1">{etiqueta}</span>
      {children}
    </label>
  );
}

/** Un bloque del formato: el título del recuadro y sus campos. */
function Bloque({ titulo, firma, children }) {
  return (
    <fieldset className="border border-gray-200 rounded-lg p-3">
      <legend className="px-1 text-xs font-semibold text-gray-700 uppercase tracking-wide">
        {titulo}
        {firma && <span className="ml-2 normal-case font-normal text-[#236093]">firma</span>}
      </legend>
      <div className="grid gap-3 sm:grid-cols-3">{children}</div>
    </fieldset>
  );
}

function Formulario({ formato, opciones, onCerrar, onGuardado }) {
  const [d, setD] = useState(() => aFormulario(formato));
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);
  const poner = (campo) => (e) => setD((x) => ({ ...x, [campo]: e.target.value }));
  const sug = opciones?.sugerencias || {};

  // Texto con sugerencias de lo ya capturado
  const texto = (campo, lista, extra = {}) => (
    <>
      <input value={d[campo]} onChange={poner(campo)} list={`dl-${campo}`} className={estiloCampo} {...extra} />
      <datalist id={`dl-${campo}`}>
        {(sug[lista] || []).map((v) => (
          <option key={v} value={v} />
        ))}
      </datalist>
    </>
  );

  async function guardar(e) {
    e.preventDefault();
    setGuardando(true);
    setError(null);
    try {
      await comprasService.guardarFormato(formato?.id, d);
      onGuardado(formato ? "Formato guardado" : "Formato capturado");
    } catch (err) {
      setError(mensajeError(err));
      setGuardando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/30 flex items-start justify-center p-4 overflow-y-auto">
      <form onSubmit={guardar} className="bg-white rounded-xl shadow-xl w-full max-w-3xl my-8">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
          <div>
            <h2 className="font-semibold text-gray-900">
              {formato ? `Corregir formato${formato.ticket ? ` ${formato.ticket}` : ""}` : "Capturar formato"}
            </h2>
            <p className="text-xs text-gray-500">Formato de autorización y registro de compras</p>
          </div>
          <button type="button" onClick={onCerrar} className="p-1.5 rounded-md text-gray-400 hover:bg-gray-100" aria-label="Cerrar">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <Bloque titulo="Solicitud">
            <Campo etiqueta="No. de ticket">
              <input value={d.ticket} onChange={poner("ticket")} placeholder="AD-…" className={estiloCampo} maxLength={32} />
            </Campo>
            <Campo etiqueta="Fecha *">
              <input type="date" value={d.fecha} onChange={poner("fecha")} required className={estiloCampo} />
            </Campo>
            <Campo etiqueta="Área solicitante *">
              <select value={d.areaId} onChange={poner("areaId")} required className={estiloCampo}>
                <option value="">Elige…</option>
                {(opciones?.areas || []).map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.nombre}
                  </option>
                ))}
              </select>
            </Campo>
            <Campo etiqueta="Requerimiento *" className="sm:col-span-3">
              <textarea value={d.requerimiento} onChange={poner("requerimiento")} required rows={2} className={estiloCampo} />
            </Campo>
            <Campo etiqueta="Costo / cotización" className="sm:col-span-2">
              <div className="flex gap-2">
                <input
                  value={d.monto}
                  onChange={poner("monto")}
                  inputMode="decimal"
                  placeholder="0.00"
                  className={`${estiloCampo} text-right`}
                />
                <div className="flex rounded-md border border-gray-200 overflow-hidden shrink-0">
                  {["MXN", "USD"].map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setD((x) => ({ ...x, moneda: m }))}
                      className={`px-3 text-sm ${d.moneda === m ? "bg-[#236093] text-white" : "text-gray-600 hover:bg-gray-50"}`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>
            </Campo>
          </Bloque>

          <Bloque titulo="Autorización del gerente de área" firma>
            <Campo etiqueta="Nombre de quien firmó" className="sm:col-span-2">
              {texto("autorizoGerente", "autorizo_gerente")}
            </Campo>
          </Bloque>

          <Bloque titulo="Compras" firma>
            <Campo etiqueta="Tipo">{texto("clasifTipo", "clasif_tipo")}</Campo>
            <Campo etiqueta="Autorizó">{texto("autorizoCompras", "autorizo_compras")}</Campo>
            <p className="self-end pb-2 text-xs text-gray-400">El área es la del solicitante.</p>
          </Bloque>

          <Bloque titulo="Dirección / Gerencia de Operaciones" firma>
            <Campo etiqueta="Autorizó" className="sm:col-span-2">
              {texto("autorizoDireccion", "autorizo_direccion")}
            </Campo>
          </Bloque>

          <Bloque titulo="Finanzas" firma>
            <Campo etiqueta="Cuenta">{texto("cuenta", "cuenta")}</Campo>
            <Campo etiqueta="Centro de costos">{texto("centroCostos", "centro_costos")}</Campo>
            <Campo etiqueta="Autorizó">{texto("autorizoFinanzas", "autorizo_finanzas")}</Campo>
          </Bloque>

          <Campo etiqueta="Observaciones">
            <textarea value={d.observaciones} onChange={poner("observaciones")} rows={2} className={estiloCampo} />
          </Campo>

          <p className="text-xs text-gray-400">
            Si al formato le falta una firma, captúralo así y complétalo después. Tipo, cuenta y centro de costos se
            escriben a mano mientras llegan las listas de Compras y Finanzas; se sugiere lo ya capturado.
          </p>

          {error && (
            <div className="flex items-start gap-2 text-sm text-red-700 bg-red-50 rounded-lg px-3 py-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              {error}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 px-5 py-3 border-t border-gray-100">
          <button type="button" onClick={onCerrar} className="px-4 py-2 text-sm text-gray-600 rounded-lg hover:bg-gray-100">
            Cancelar
          </button>
          <button
            type="submit"
            disabled={guardando}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-[#236093] text-white rounded-lg hover:bg-[#1c4d76] disabled:opacity-40"
          >
            {guardando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Guardar
          </button>
        </div>
      </form>
    </div>
  );
}

/** Las cuatro firmas como casillas: llena si ya firmó. */
function Firmas({ f }) {
  return (
    <div className="flex gap-1">
      {FIRMAS.map((x) => {
        const quien = f[x.campo];
        return (
          <span
            key={x.campo}
            title={`${x.nombre}: ${quien || "sin firma"}`}
            className={`w-5 h-5 rounded text-[10px] font-semibold flex items-center justify-center ${
              quien ? "bg-[#236093] text-white" : "border border-dashed border-gray-300 text-gray-400"
            }`}
          >
            {x.corto}
          </span>
        );
      })}
    </div>
  );
}

function Kpi({ titulo, valor, detalle }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl px-4 py-3">
      <p className="text-xs text-gray-500">{titulo}</p>
      <p className="text-2xl font-semibold text-gray-900 tabular-nums">{valor}</p>
      {detalle && <p className="text-xs text-gray-400 mt-0.5">{detalle}</p>}
    </div>
  );
}

/** Total en pesos por un campo, con una barra contra el mayor. */
function Desglose({ titulo, filas, clave }) {
  const grupos = new Map();
  for (const f of filas) {
    const k = f[clave] || "Sin capturar";
    const g = grupos.get(k) || { nombre: k, n: 0, total: 0 };
    g.n += 1;
    g.total += f.monto_mxn || 0;
    grupos.set(k, g);
  }
  const lista = [...grupos.values()].sort((a, b) => b.total - a.total || b.n - a.n);
  const max = Math.max(1, ...lista.map((g) => g.total));
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <h3 className="text-sm font-semibold text-gray-800 mb-2">{titulo}</h3>
      {lista.length === 0 ? (
        <p className="text-xs text-gray-400">Sin formatos.</p>
      ) : (
        <table className="w-full text-sm">
          <tbody>
            {lista.map((g) => (
              <tr key={g.nombre} className="border-t border-gray-100 first:border-0">
                <td className={`py-1.5 pr-2 ${g.nombre === "Sin capturar" ? "text-gray-400 italic" : "text-gray-700"}`}>
                  {g.nombre}
                </td>
                <td className="py-1.5 pr-2 w-28">
                  <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                    <div className="h-full bg-[#236093]" style={{ width: `${(g.total / max) * 100}%` }} />
                  </div>
                </td>
                <td className="py-1.5 pr-2 text-right text-xs text-gray-400 whitespace-nowrap">{g.n}</td>
                <td className="py-1.5 text-right font-medium tabular-nums whitespace-nowrap">{pesos(g.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default function FormatosComprasPage() {
  const [desde, setDesde] = useState(`${new Date().getFullYear()}-01-01`);
  const [hasta, setHasta] = useState(hoy());
  const [areaId, setAreaId] = useState("");
  const [estado, setEstado] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [datos, setDatos] = useState(null);
  const [opciones, setOpciones] = useState(null);
  const [error, setError] = useState(null);
  const [aviso, setAviso] = useState(null);
  const [version, setVersion] = useState(0);
  // null = cerrado; {} = nuevo; fila = corregir
  const [editando, setEditando] = useState(null);

  useEffect(() => {
    let vivo = true;
    comprasService
      .getFormatos({ desde, hasta })
      .then((r) => {
        if (!vivo) return;
        setDatos(r);
        setError(null);
      })
      .catch((e) => vivo && setError(mensajeError(e)));
    return () => {
      vivo = false;
    };
  }, [desde, hasta, version]);

  // Las sugerencias crecen con cada captura
  useEffect(() => {
    let vivo = true;
    comprasService
      .getOpcionesFormato()
      .then((r) => vivo && setOpciones(r))
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, [version]);

  const permisos = datos?.permisos || {};
  const q = busqueda.trim().toLowerCase();
  const filas = (datos?.filas || []).filter(
    (f) =>
      (!areaId || String(f.compras_area_id) === areaId) &&
      (!estado || (estado === "completos" ? f.completo : !f.completo)) &&
      (!q ||
        [f.ticket, f.requerimiento, f.clasif_tipo, f.cuenta, f.centro_costos, f.observaciones, ...FIRMAS.map((x) => f[x.campo])]
          .filter(Boolean)
          .some((v) => v.toLowerCase().includes(q))),
  );

  const total = filas.reduce((s, f) => s + (f.monto_mxn || 0), 0);
  const pendientes = filas.filter((f) => !f.completo);
  const dolares = filas.filter((f) => f.moneda === "USD");
  const sinTc = dolares.filter((f) => f.monto != null && f.monto_mxn == null).length;
  // Qué firma falta más seguido, para saber dónde se atoran
  const faltaMas = FIRMAS.map((x) => ({ ...x, n: pendientes.filter((f) => f.faltan.includes(x.nombre)).length }))
    .filter((x) => x.n)
    .sort((a, b) => b.n - a.n);

  const puedeCorregir = (f) => permisos.editar || (permisos.crear && f.capturado_por === datos?.usuarioId);

  async function borrar(f) {
    if (!window.confirm(`¿Borrar el formato${f.ticket ? ` ${f.ticket}` : ""} del ${fechaCorta(f.fecha)}? No se puede deshacer.`)) return;
    try {
      await comprasService.borrarFormato(f.id);
      setAviso("Formato borrado");
      setVersion((v) => v + 1);
    } catch (e) {
      setError(mensajeError(e));
    }
  }

  function exportar() {
    const area = opciones?.areas?.find((a) => String(a.id) === areaId);
    exportarFormatosCompras({
      filas,
      notas: [
        ["Periodo", `${fechaCorta(desde)} a ${fechaCorta(hasta)}`],
        ["Área solicitante", area?.nombre || "Todas"],
        ["Estado", estado === "completos" ? "Completos" : estado === "pendientes" ? "Con firmas pendientes" : "Todos"],
        ["Búsqueda", busqueda.trim() || "—"],
        ["Formatos", filas.length],
        [
          "Costo en pesos",
          "Los dólares se convierten con el FIX de Banxico del día del formato (o el último publicado antes). Sin tipo de cambio no suman.",
        ],
        ["Origen", "Formato de autorización y registro de compras en papel, capturado en el DBX"],
      ],
    });
  }

  return (
    <div className="p-6 space-y-5 max-w-7xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-[#236093]/10 rounded-lg">
            <ClipboardPenLine className="w-6 h-6 text-[#236093]" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Formatos de Compras</h1>
            <p className="text-sm text-gray-500">
              Los formatos de autorización en papel, capturados para tener reportes mientras el flujo con firmas llega al
              sistema
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={exportar}
            disabled={!filas.length}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-40"
          >
            <Download className="w-4 h-4" />
            Excel
          </button>
          {permisos.crear && (
            <button
              onClick={() => {
                setAviso(null);
                setEditando({});
              }}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-[#236093] text-white rounded-lg hover:bg-[#1c4d76]"
            >
              <Plus className="w-4 h-4" />
              Capturar formato
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3 bg-white border border-gray-200 rounded-xl px-4 py-3">
        <Campo etiqueta="Desde">
          <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className={estiloCampo} />
        </Campo>
        <Campo etiqueta="Hasta">
          <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} className={estiloCampo} />
        </Campo>
        <Campo etiqueta="Área solicitante">
          <select value={areaId} onChange={(e) => setAreaId(e.target.value)} className={estiloCampo}>
            <option value="">Todas</option>
            {(opciones?.areas || []).map((a) => (
              <option key={a.id} value={a.id}>
                {a.nombre}
              </option>
            ))}
          </select>
        </Campo>
        <Campo etiqueta="Firmas">
          <select value={estado} onChange={(e) => setEstado(e.target.value)} className={estiloCampo}>
            <option value="">Todos</option>
            <option value="completos">Completos</option>
            <option value="pendientes">Con firmas pendientes</option>
          </select>
        </Campo>
        <Campo etiqueta="Buscar" className="flex-1 min-w-48">
          <div className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Ticket, requerimiento, tipo, cuenta, quién firmó…"
              className={`${estiloCampo} pl-8`}
            />
          </div>
        </Campo>
      </div>

      {error && (
        <div className="flex items-start gap-2 text-sm text-red-700 bg-red-50 rounded-xl px-4 py-3">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          {error}
        </div>
      )}
      {aviso && <div className="text-sm rounded-lg px-3 py-2 bg-green-50 text-green-800">{aviso}</div>}

      {!datos ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-7 h-7 animate-spin text-gray-300" />
        </div>
      ) : (
        <>
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
            <Kpi titulo="Formatos" valor={filas.length} />
            <Kpi
              titulo="Costo total en pesos"
              valor={pesos(total)}
              detalle={sinTc ? `${sinTc} en dólares sin tipo de cambio, no suman` : "Tal como viene en el formato"}
            />
            <Kpi
              titulo="Con firmas pendientes"
              valor={pendientes.length}
              detalle={faltaMas.length ? `Falta más: ${faltaMas.map((x) => `${x.nombre} (${x.n})`).join(", ")}` : "Todos firmados"}
            />
            <Kpi titulo="En dólares" valor={dolares.length} detalle="Convertidos con el FIX del día del formato" />
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <Desglose titulo="Por área solicitante" filas={filas} clave="area_nombre" />
            <Desglose titulo="Por tipo (Compras)" filas={filas} clave="clasif_tipo" />
          </div>

          <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
                  <th className="px-4 py-2 font-medium">Fecha</th>
                  <th className="px-3 py-2 font-medium">Ticket</th>
                  <th className="px-3 py-2 font-medium">Área</th>
                  <th className="px-3 py-2 font-medium">Requerimiento</th>
                  <th className="px-3 py-2 font-medium text-right">Costo</th>
                  <th className="px-3 py-2 font-medium">Tipo</th>
                  <th className="px-3 py-2 font-medium">Cuenta · CC</th>
                  <th className="px-3 py-2 font-medium">Firmas</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {filas.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-10 text-center text-sm text-gray-400">
                      {datos.filas.length ? "Ningún formato con esos filtros." : "Todavía no hay formatos capturados en este periodo."}
                    </td>
                  </tr>
                ) : (
                  filas.map((f) => (
                    <tr key={f.id} className="border-t border-gray-100 align-top hover:bg-gray-50/60">
                      <td className="px-4 py-2 whitespace-nowrap text-gray-600">{fechaCorta(f.fecha)}</td>
                      <td className="px-3 py-2 font-mono text-xs text-gray-600 whitespace-nowrap">{f.ticket || "—"}</td>
                      <td className="px-3 py-2 text-gray-700">{f.area_nombre}</td>
                      <td className="px-3 py-2 text-gray-900 max-w-xs">
                        {f.requerimiento}
                        {f.observaciones && <span className="block text-xs text-gray-400">{f.observaciones}</span>}
                      </td>
                      <td className="px-3 py-2 text-right whitespace-nowrap tabular-nums">
                        {f.monto == null ? "—" : dinero(f.monto, f.moneda)}
                        {f.moneda === "USD" && (
                          <span className="block text-xs text-gray-400">
                            {f.monto_mxn == null ? "sin tipo de cambio" : pesos(f.monto_mxn)}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-gray-700">
                        {f.clasif_tipo || "—"}
                      </td>
                      <td className="px-3 py-2 text-gray-700 whitespace-nowrap">
                        {f.cuenta || f.centro_costos ? `${f.cuenta || "—"} · ${f.centro_costos || "—"}` : "—"}
                      </td>
                      <td className="px-3 py-2">
                        <Firmas f={f} />
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-right">
                        {puedeCorregir(f) && (
                          <button
                            onClick={() => {
                              setAviso(null);
                              setEditando(f);
                            }}
                            className="p-1.5 rounded-md text-gray-400 hover:text-[#236093] hover:bg-gray-100"
                            title="Corregir o completar"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                        )}
                        {permisos.eliminar && (
                          <button
                            onClick={() => borrar(f)}
                            className="p-1.5 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50"
                            title="Borrar"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {editando && (
        <Formulario
          formato={editando.id ? editando : null}
          opciones={opciones}
          onCerrar={() => setEditando(null)}
          onGuardado={(texto) => {
            setEditando(null);
            setAviso(texto);
            setVersion((v) => v + 1);
          }}
        />
      )}
    </div>
  );
}
