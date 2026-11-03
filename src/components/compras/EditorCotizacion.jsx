import { useState, useRef } from "react";
import { Plus, Trash2, Loader2, Save, Send, ImagePlus, FileUp, Eye, EyeOff, X } from "lucide-react";
import { comprasService } from "../../services/compras.service";
import ArchivoCompras from "./ArchivoCompras";
import Comparativo from "./Comparativo";
import { dinero } from "./formatoCompras";

/**
 * Editor del comparativo de proveedores, para Compras.
 *
 * Arriba lo que se va a comprar (partidas); abajo una tarjeta por proveedor con
 * su precio por partida, lo que ofrece, la foto, entrega, crédito,
 * observaciones y el PDF de su cotización. Los totales se calculan solos.
 *
 * Se guarda como borrador cuando se quiera; "Mandar" guarda y envía. Las
 * partidas sin descripción y los proveedores sin nombre no se guardan.
 */

const MAX_OPCIONES = 8;
const nuevaClave = () => `n${Math.random().toString(36).slice(2, 10)}`;
const partidaVacia = () => ({ clave: nuevaClave(), descripcion: "", cantidad: "", unidad: "PZS" });
const opcionVacia = () => ({
  clave: nuevaClave(),
  proveedor: "",
  moneda: "MXN",
  tiempoEntrega: "",
  credito: "",
  observaciones: "",
  archivo: null,
  precios: {},
});

/** Del borrador que regresa el servidor al estado de la pantalla. */
function desdeServidor(b, asunto) {
  if (!b || (b.partidas.length === 0 && b.opciones.length === 0)) {
    return {
      mensaje: b?.mensaje || "",
      incluyeIva: Boolean(b?.incluye_iva),
      partidas: [{ ...partidaVacia(), descripcion: asunto || "" }],
      opciones: [opcionVacia(), opcionVacia()],
    };
  }
  return {
    mensaje: b.mensaje || "",
    incluyeIva: b.incluye_iva,
    partidas: b.partidas.map((p) => ({
      clave: String(p.id),
      descripcion: p.descripcion,
      cantidad: p.cantidad ?? "",
      unidad: p.unidad,
    })),
    opciones: b.opciones.map((o) => ({
      clave: String(o.id),
      proveedor: o.proveedor,
      moneda: o.moneda,
      tiempoEntrega: o.tiempo_entrega || "",
      credito: o.credito || "",
      observaciones: o.observaciones || "",
      archivo: o.archivo,
      precios: Object.fromEntries(
        Object.entries(o.precios).map(([pid, pr]) => [
          String(pid),
          { precio: pr.precio ?? "", descripcion: pr.descripcion || "", imagen: pr.imagen },
        ]),
      ),
    })),
  };
}

const haciaServidor = (e) => ({
  mensaje: e.mensaje,
  incluyeIva: e.incluyeIva,
  partidas: e.partidas.map(({ clave, descripcion, cantidad, unidad }) => ({ clave, descripcion, cantidad, unidad })),
  opciones: e.opciones.map((o) => ({
    proveedor: o.proveedor,
    moneda: o.moneda,
    tiempoEntrega: o.tiempoEntrega,
    credito: o.credito,
    observaciones: o.observaciones,
    archivoId: o.archivo?.id || null,
    precios: Object.fromEntries(
      Object.entries(o.precios).map(([k, pr]) => [
        k,
        { precio: pr.precio, descripcion: pr.descripcion, imagenId: pr.imagen?.id || null },
      ]),
    ),
  })),
});

const num = (v) => {
  if (v === "" || v == null) return null;
  const n = Number(String(v).replace(/[$,\s]/g, ""));
  return Number.isFinite(n) ? n : null;
};

/** El estado de la pantalla con la forma del comparativo, para la vista previa. */
function comoComparativo(e) {
  const partidas = e.partidas
    .filter((p) => p.descripcion.trim())
    .map((p) => ({ id: p.clave, descripcion: p.descripcion, cantidad: num(p.cantidad), unidad: p.unidad || "PZS" }));
  const opciones = e.opciones
    .filter((o) => o.proveedor.trim())
    .map((o) => {
      let total = 0;
      let cotizadas = 0;
      const precios = {};
      for (const p of partidas) {
        const pr = o.precios[p.id];
        if (!pr) continue;
        const precio = num(pr.precio);
        const importe = precio != null && p.cantidad != null ? precio * p.cantidad : null;
        if (importe != null) {
          total += importe;
          cotizadas++;
        }
        precios[p.id] = { precio, descripcion: pr.descripcion, imagen: pr.imagen, importe };
      }
      return {
        id: o.clave,
        proveedor: o.proveedor,
        moneda: o.moneda,
        tiempo_entrega: o.tiempoEntrega,
        credito: o.credito,
        observaciones: o.observaciones,
        archivo: o.archivo,
        precios,
        total: Math.round(total * 100) / 100,
        cotizadas,
        completa: cotizadas === partidas.length,
      };
    });
  const comparables = opciones.filter((o) => o.completa && o.cotizadas > 0);
  const masBarata =
    comparables.length > 1 && new Set(comparables.map((o) => o.moneda)).size === 1
      ? comparables.reduce((a, b) => (b.total < a.total ? b : a)).id
      : null;
  return { partidas, opciones, mensaje: e.mensaje, incluye_iva: e.incluyeIva, masBarata };
}

// Sin ancho propio: cada campo dice el suyo (con w-full aquí, w-20 o flex-1 no ganaban)
const campo =
  "text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#236093]/30";

export default function EditorCotizacion({ solicitudId, borrador, asunto, onEnviada }) {
  const [e, setE] = useState(() => desdeServidor(borrador, asunto));
  const [sucio, setSucio] = useState(false);
  const [ocupado, setOcupado] = useState(null);
  const [aviso, setAviso] = useState(null);
  const [previa, setPrevia] = useState(false);
  const archivoRef = useRef(null);
  const destino = useRef(null);

  const cambiar = (fn) => {
    setE((x) => fn(structuredClone(x)));
    setSucio(true);
  };
  const setPartida = (i, k, v) => cambiar((x) => ((x.partidas[i][k] = v), x));
  const setOpcion = (i, k, v) => cambiar((x) => ((x.opciones[i][k] = v), x));
  const setPrecio = (i, clave, k, v) =>
    cambiar((x) => {
      x.opciones[i].precios[clave] = { precio: "", descripcion: "", imagen: null, ...x.opciones[i].precios[clave], [k]: v };
      return x;
    });

  const guardar = async () => {
    const b = await comprasService.guardarBorrador(solicitudId, haciaServidor(e));
    setE(desdeServidor(b, asunto));
    setSucio(false);
    return b;
  };

  const accion = async (tipo) => {
    setOcupado(tipo);
    setAviso(null);
    try {
      if (tipo === "guardar") {
        await guardar();
        setAviso({ ok: true, texto: "Borrador guardado" });
      } else {
        await guardar();
        const r = await comprasService.enviarCotizacion(solicitudId);
        onEnviada(r.message);
      }
    } catch (err) {
      setAviso({ ok: false, texto: err.response?.data?.message || err.message });
    } finally {
      setOcupado(null);
    }
  };

  /** Foto de una partida (`{ opcion, partida }`) o PDF del proveedor (`{ opcion }`). */
  const pedirArchivo = (d) => {
    destino.current = d;
    archivoRef.current.accept = d.partida ? "image/*" : ".pdf,image/*";
    archivoRef.current.value = "";
    archivoRef.current.click();
  };
  const subir = async (file) => {
    const d = destino.current;
    if (!file || !d) return;
    setOcupado(`archivo-${d.opcion}-${d.partida || ""}`);
    setAviso(null);
    try {
      const [a] = await comprasService.subirArchivosCotizacion(solicitudId, [file]);
      if (d.partida) setPrecio(d.opcion, d.partida, "imagen", a);
      else setOpcion(d.opcion, "archivo", a);
    } catch (err) {
      setAviso({ ok: false, texto: err.response?.data?.message || err.message });
    } finally {
      setOcupado(null);
    }
  };

  const vista = comoComparativo(e);
  const cargar = (a) => () => comprasService.getArchivoCotizacion(a.id);

  return (
    <div className="space-y-5">
      <input ref={archivoRef} type="file" className="hidden" onChange={(ev) => subir(ev.target.files?.[0])} />

      {/* --- Partidas --- */}
      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-2">Lo que se va a comprar</h3>
        <div className="space-y-2">
          {e.partidas.map((p, i) => (
            <div key={p.clave} className="flex items-center gap-2">
              <input
                value={p.descripcion}
                onChange={(ev) => setPartida(i, "descripcion", ev.target.value)}
                placeholder="Descripción (ej. Adaptador de red USB a Ethernet)"
                maxLength={300}
                className={`${campo} flex-1 min-w-0`}
              />
              <input
                value={p.cantidad}
                onChange={(ev) => setPartida(i, "cantidad", ev.target.value)}
                placeholder="Cant."
                inputMode="decimal"
                className={`${campo} w-20 shrink-0 text-right`}
              />
              <input
                value={p.unidad}
                onChange={(ev) => setPartida(i, "unidad", ev.target.value.toUpperCase())}
                placeholder="U.M."
                maxLength={20}
                className={`${campo} w-20 shrink-0`}
              />
              <button
                onClick={() => cambiar((x) => (x.partidas.splice(i, 1), x))}
                disabled={e.partidas.length === 1}
                className="p-1.5 text-gray-300 hover:text-red-500 disabled:opacity-30"
                title="Quitar partida"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
        <button
          onClick={() => cambiar((x) => (x.partidas.push(partidaVacia()), x))}
          className="mt-2 inline-flex items-center gap-1.5 text-sm text-[#236093] hover:underline"
        >
          <Plus className="w-4 h-4" />
          Agregar partida
        </button>
      </div>

      {/* --- Proveedores --- */}
      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-2">Proveedores</h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3">
          {e.opciones.map((o, i) => {
            const total = vista.opciones.find((v) => v.id === o.clave);
            return (
              <div key={o.clave} className="border border-gray-200 rounded-xl p-3 space-y-3 bg-white">
                <div className="flex items-center gap-2">
                  <input
                    value={o.proveedor}
                    onChange={(ev) => setOpcion(i, "proveedor", ev.target.value)}
                    placeholder={`Proveedor ${i + 1}`}
                    maxLength={160}
                    className={`${campo} flex-1 min-w-0 font-medium`}
                  />
                  <select
                    value={o.moneda}
                    onChange={(ev) => setOpcion(i, "moneda", ev.target.value)}
                    className={`${campo} w-20 shrink-0`}
                  >
                    <option value="MXN">MXN</option>
                    <option value="USD">USD</option>
                  </select>
                  <button
                    onClick={() => cambiar((x) => (x.opciones.splice(i, 1), x))}
                    className="p-1.5 text-gray-300 hover:text-red-500"
                    title="Quitar proveedor"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {e.partidas.map((p) => {
                  const pr = o.precios[p.clave] || {};
                  const cant = num(p.cantidad);
                  const precio = num(pr.precio);
                  const subiendo = ocupado === `archivo-${i}-${p.clave}`;
                  return (
                    <div key={p.clave} className="rounded-lg bg-gray-50 p-2 space-y-1.5">
                      <p className="text-xs text-gray-500 truncate" title={p.descripcion}>
                        {p.descripcion || "Partida sin descripción"}
                        {cant != null && ` · ${cant} ${p.unidad}`}
                      </p>
                      <div className="flex items-center gap-2">
                        <input
                          value={pr.precio ?? ""}
                          onChange={(ev) => setPrecio(i, p.clave, "precio", ev.target.value)}
                          placeholder="Precio unitario"
                          inputMode="decimal"
                          className={`${campo} w-32 shrink-0 text-right bg-white`}
                        />
                        <span className="text-xs text-gray-500 flex-1 text-right">
                          {precio != null && cant != null ? dinero(precio * cant, o.moneda) : "No lo cotizó"}
                        </span>
                      </div>
                      <div className="flex items-start gap-2">
                        <textarea
                          value={pr.descripcion ?? ""}
                          onChange={(ev) => setPrecio(i, p.clave, "descripcion", ev.target.value)}
                          placeholder="Lo que ofrece (marca, modelo, características)"
                          rows={2}
                          maxLength={1000}
                          className={`${campo} flex-1 min-w-0 bg-white resize-none`}
                        />
                        {pr.imagen ? (
                          <div className="relative">
                            <ArchivoCompras archivo={pr.imagen} cargar={cargar(pr.imagen)} compacto />
                            <button
                              onClick={() => setPrecio(i, p.clave, "imagen", null)}
                              className="absolute -top-1.5 -right-1.5 p-0.5 bg-white border border-gray-200 rounded-full text-gray-400 hover:text-red-500"
                              title="Quitar foto"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => pedirArchivo({ opcion: i, partida: p.clave })}
                            disabled={subiendo}
                            className="w-14 h-14 flex items-center justify-center border border-dashed border-gray-300 rounded-md text-gray-400 hover:text-[#236093] hover:border-[#236093] bg-white"
                            title="Agregar foto"
                          >
                            {subiendo ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImagePlus className="w-5 h-5" />}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}

                <div className="grid grid-cols-2 gap-2">
                  <input
                    value={o.tiempoEntrega}
                    onChange={(ev) => setOpcion(i, "tiempoEntrega", ev.target.value)}
                    placeholder="Entrega (ej. 1 sem)"
                    maxLength={80}
                    className={`${campo} w-full`}
                  />
                  <input
                    value={o.credito}
                    onChange={(ev) => setOpcion(i, "credito", ev.target.value)}
                    placeholder="Crédito (ej. 30 días)"
                    maxLength={80}
                    className={`${campo} w-full`}
                  />
                </div>
                <textarea
                  value={o.observaciones}
                  onChange={(ev) => setOpcion(i, "observaciones", ev.target.value)}
                  placeholder="Observaciones"
                  rows={2}
                  maxLength={1000}
                  className={`${campo} w-full resize-none`}
                />
                <div className="flex items-center justify-between gap-2">
                  {o.archivo ? (
                    <span className="flex items-center gap-2 text-xs text-gray-600 min-w-0">
                      <ArchivoCompras archivo={o.archivo} cargar={cargar(o.archivo)} compacto />
                      <span className="truncate">{o.archivo.nombre_original}</span>
                      <button onClick={() => setOpcion(i, "archivo", null)} className="text-gray-300 hover:text-red-500">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </span>
                  ) : (
                    <button
                      onClick={() => pedirArchivo({ opcion: i })}
                      disabled={ocupado === `archivo-${i}-`}
                      className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-[#236093]"
                    >
                      {ocupado === `archivo-${i}-` ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileUp className="w-3.5 h-3.5" />}
                      Adjuntar su cotización (PDF)
                    </button>
                  )}
                  <span className="text-sm font-semibold text-gray-900 whitespace-nowrap">
                    {total ? dinero(total.total, o.moneda) : "—"}
                  </span>
                </div>
              </div>
            );
          })}
          {e.opciones.length < MAX_OPCIONES && (
            <button
              onClick={() => cambiar((x) => (x.opciones.push(opcionVacia()), x))}
              className="min-h-[120px] flex flex-col items-center justify-center gap-1 border-2 border-dashed border-gray-200 rounded-xl text-sm text-gray-500 hover:text-[#236093] hover:border-[#236093]"
            >
              <Plus className="w-5 h-5" />
              Agregar proveedor
            </button>
          )}
        </div>
      </div>

      {/* --- Mensaje e IVA --- */}
      <div className="space-y-2">
        <textarea
          value={e.mensaje}
          onChange={(ev) => cambiar((x) => ((x.mensaje = ev.target.value), x))}
          rows={2}
          maxLength={2000}
          placeholder="Mensaje para quien pidió (opcional): recomendaciones, dudas, algo a considerar"
          className={`${campo} w-full`}
        />
        <label className="inline-flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={e.incluyeIva}
            onChange={(ev) => cambiar((x) => ((x.incluyeIva = ev.target.checked), x))}
            className="rounded border-gray-300"
          />
          Los precios incluyen IVA
        </label>
      </div>

      {previa && vista.opciones.length > 0 && (
        <div className="border-t border-gray-100 pt-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-2">Así lo va a ver quien pidió</h3>
          <Comparativo cotizacion={vista} />
        </div>
      )}

      {aviso && (
        <div className={`text-sm rounded-lg px-3 py-2 ${aviso.ok ? "bg-green-50 text-green-800" : "bg-red-50 text-red-700"}`}>
          {aviso.texto}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 pt-4">
        <button
          onClick={() => setPrevia((v) => !v)}
          className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-[#236093]"
        >
          {previa ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          {previa ? "Ocultar vista previa" : "Ver cómo lo verá quien pidió"}
        </button>
        <div className="flex items-center gap-2">
          {sucio && <span className="text-xs text-amber-600">Cambios sin guardar</span>}
          <button
            onClick={() => accion("guardar")}
            disabled={ocupado != null}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            {ocupado === "guardar" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Guardar borrador
          </button>
          <button
            onClick={() => {
              if (window.confirm("¿Mandar estas opciones a quien pidió? Ya no se podrán cambiar hasta que elija o pida otras.")) {
                accion("enviar");
              }
            }}
            disabled={ocupado != null}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-[#236093] text-white rounded-lg hover:bg-[#1c4d76] disabled:opacity-50"
          >
            {ocupado === "enviar" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Mandar a quien pidió
          </button>
        </div>
      </div>
    </div>
  );
}
