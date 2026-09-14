import { useState, useEffect, useMemo, useCallback } from "react";
import {
  Factory,
  Save,
  Plus,
  Trash2,
  Copy,
  CheckCircle2,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { inyeccionService } from "../../services/inyeccion.service";
import BuscadorProducto from "../../components/produccion/BuscadorProducto";

/**
 * Captura de producción de inyección.
 *
 * Sustituye la hoja "Producción" del Excel. La unidad de captura es el TURNO
 * de una máquina en un día: se elige fecha + máquina + turno y sale la grilla
 * con las estaciones de esa máquina ya precargadas.
 *
 * El capturista teclea contadores y scrap; ciclos y producción se calculan
 * solos (producción queda editable, porque hay días sin lectura de contadores).
 */

const hoyISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
};

const num = (v) => (v === "" || v == null ? null : Number(v));
const fmt = (n) =>
  n == null ? "—" : Number(n).toLocaleString("es-MX", { maximumFractionDigits: 2 });

/** Renglón vacío para una estación. */
const nuevoRenglon = (estacion) => ({
  clave: `n${Math.random().toString(36).slice(2)}`,
  id: null,
  estacionId: estacion?.id ?? null,
  estacion: estacion?.codigo ?? "",
  producto: null,
  cavidades: estacion?.cavidadesDefault ?? "",
  contadorInicial: "",
  contadorFinal: "",
  produccion: "",
  produccionTocada: false,
  scrap: "",
  observaciones: "",
});

export default function CapturaInyeccionPage() {
  const [catalogos, setCatalogos] = useState(null);
  const [fecha, setFecha] = useState(hoyISO);
  const [maquinaId, setMaquinaId] = useState("");
  const [turnoId, setTurnoId] = useState("");

  const [renglones, setRenglones] = useState([]);
  const [eliminados, setEliminados] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState(null);
  const [avance, setAvance] = useState([]);

  const maquina = useMemo(
    () => catalogos?.maquinas.find((m) => m.id === Number(maquinaId)),
    [catalogos, maquinaId],
  );

  useEffect(() => {
    inyeccionService
      .getCatalogosCaptura()
      .then(setCatalogos)
      .catch((e) => setAviso({ tipo: "error", texto: e.message }));
  }, []);

  useEffect(() => {
    if (!fecha) return;
    inyeccionService.getAvance(fecha).then(setAvance).catch(() => setAvance([]));
  }, [fecha]);

  /** Carga el turno: lo ya capturado, o la grilla vacía con las estaciones. */
  const cargarTurno = useCallback(async () => {
    if (!fecha || !maquinaId || !turnoId || !maquina) return;
    setCargando(true);
    setAviso(null);
    setEliminados([]);
    try {
      const existentes = await inyeccionService.getCaptura(fecha, maquinaId, turnoId);

      if (existentes.length > 0) {
        setRenglones(
          existentes.map((r) => ({
            clave: `e${r.id}`,
            id: r.id,
            estacionId: r.estacion_id,
            estacion: r.estacion || "",
            producto: r.producto_id
              ? { id: r.producto_id, sku: r.sku, descripcion: r.descripcion }
              : null,
            cavidades: r.cavidades ?? "",
            contadorInicial: r.contador_inicial ?? "",
            contadorFinal: r.contador_final ?? "",
            produccion: r.produccion ?? "",
            produccionTocada: true,
            scrap: r.scrap ?? "",
            observaciones: r.observaciones ?? "",
          })),
        );
        setAviso({
          tipo: "info",
          texto: `Este turno ya tiene ${existentes.length} renglones capturados. Se están editando.`,
        });
      } else {
        setRenglones(maquina.estaciones.map(nuevoRenglon));
      }
    } catch (e) {
      setAviso({
        tipo: "error",
        texto: e.response?.data?.message || e.message,
      });
    } finally {
      setCargando(false);
    }
  }, [fecha, maquinaId, turnoId, maquina]);

  useEffect(() => {
    cargarTurno();
  }, [cargarTurno]);

  /** Actualiza un campo y recalcula la producción mientras no la hayan tocado. */
  const editar = (clave, campo, valor) => {
    setRenglones((rs) =>
      rs.map((r) => {
        if (r.clave !== clave) return r;
        const n = { ...r, [campo]: valor };
        if (campo === "produccion") n.produccionTocada = true;
        if (["contadorInicial", "contadorFinal", "cavidades"].includes(campo)) {
          const ini = num(n.contadorInicial);
          const fin = num(n.contadorFinal);
          const cav = num(n.cavidades);
          if (!n.produccionTocada && ini != null && fin != null && cav != null) {
            n.produccion = Math.max(0, (fin - ini) * cav);
          }
        }
        return n;
      }),
    );
  };

  const agregarRenglon = (indice) => {
    setRenglones((rs) => {
      const base = rs[indice];
      const copia = nuevoRenglon(null);
      copia.estacionId = base.estacionId;
      copia.estacion = base.estacion;
      copia.cavidades = base.cavidades;
      const out = [...rs];
      out.splice(indice + 1, 0, copia);
      return out;
    });
  };

  const quitarRenglon = (clave) => {
    setRenglones((rs) => {
      const r = rs.find((x) => x.clave === clave);
      if (r?.id) setEliminados((e) => [...e, r.id]);
      return rs.filter((x) => x.clave !== clave);
    });
  };

  /** Copia el producto de un renglón a todos los que no tengan uno. */
  const aplicarATodos = (producto) => {
    setRenglones((rs) =>
      rs.map((r) => (r.producto ? r : { ...r, producto })),
    );
  };

  const ciclos = (r) => {
    const ini = num(r.contadorInicial);
    const fin = num(r.contadorFinal);
    return ini != null && fin != null ? fin - ini : null;
  };

  const errores = useMemo(() => {
    const e = [];
    renglones.forEach((r, i) => {
      const c = ciclos(r);
      if (c != null && c < 0) {
        e.push(`Renglón ${i + 1} (${r.estacion}): el contador final es menor que el inicial`);
      }
      if (num(r.scrap) != null && num(r.scrap) < 0) {
        e.push(`Renglón ${i + 1} (${r.estacion}): el scrap no puede ser negativo`);
      }
      if (num(r.produccion) > 0 && !r.producto) {
        e.push(`Renglón ${i + 1} (${r.estacion}): falta el producto`);
      }
    });
    return e;
  }, [renglones]);

  const totales = useMemo(() => {
    let prod = 0;
    let scrap = 0;
    let conDato = 0;
    for (const r of renglones) {
      const p = num(r.produccion) || 0;
      const s = num(r.scrap) || 0;
      prod += p;
      scrap += s;
      if (p || s || r.producto) conDato++;
    }
    return { prod, scrap, conDato, pct: prod > 0 ? (scrap / prod) * 100 : null };
  }, [renglones]);

  const guardar = async () => {
    if (errores.length > 0) return;
    setGuardando(true);
    setAviso(null);
    try {
      const payload = {
        fecha,
        maquinaId: Number(maquinaId),
        turnoId: Number(turnoId),
        eliminados,
        renglones: renglones.map((r) => ({
          id: r.id,
          estacionId: r.estacionId,
          productoId: r.producto?.id ?? null,
          cavidades: num(r.cavidades) ?? 0,
          contadorInicial: num(r.contadorInicial),
          contadorFinal: num(r.contadorFinal),
          produccion: num(r.produccion) ?? 0,
          scrap: num(r.scrap) ?? 0,
          observaciones: r.observaciones || null,
        })),
      };
      const res = await inyeccionService.guardarCaptura(payload);
      setAviso({
        tipo: "ok",
        texto:
          `Guardado: ${res.insertados} nuevos, ${res.actualizados} editados` +
          (res.eliminados ? `, ${res.eliminados} borrados` : "") +
          (res.omitidos ? `. ${res.omitidos} renglones vacíos se omitieron.` : "."),
      });
      setEliminados([]);
      await cargarTurno();
      inyeccionService.getAvance(fecha).then(setAvance).catch(() => {});
    } catch (e) {
      const err = e.response?.data;
      setAviso({
        tipo: "error",
        texto: err?.errors?.[0]?.msg || err?.message || e.message,
      });
    } finally {
      setGuardando(false);
    }
  };

  const listo = fecha && maquinaId && turnoId;

  return (
    <div className="space-y-5">
      {/* Encabezado */}
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center">
          <Factory className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Captura de Producción</h1>
          <p className="text-sm text-gray-500">Inyección · un turno por máquina</p>
        </div>
      </div>

      {/* Selección del turno */}
      <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Fecha</label>
            <input
              type="date"
              value={fecha}
              max={hoyISO()}
              onChange={(e) => setFecha(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Máquina</label>
            <select
              value={maquinaId}
              onChange={(e) => setMaquinaId(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm min-w-36"
            >
              <option value="">Selecciona...</option>
              {(catalogos?.maquinas || []).map((m) => (
                <option key={m.id} value={m.id}>
                  {m.codigo}
                  {m.unidad_negocio ? ` · ${m.unidad_negocio}` : ""}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Turno</label>
            <select
              value={turnoId}
              onChange={(e) => setTurnoId(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm min-w-40"
            >
              <option value="">Selecciona...</option>
              {(catalogos?.turnos || []).map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nombre} ({String(t.hora_inicio).slice(0, 5)}–
                  {String(t.hora_fin).slice(0, 5)})
                </option>
              ))}
            </select>
          </div>

          {avance.length > 0 && (
            <div className="flex-1 min-w-48">
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Ya capturado este día
              </label>
              <div className="flex flex-wrap gap-1.5">
                {avance.map((a, i) => (
                  <span
                    key={i}
                    className="px-2 py-1 rounded-full bg-secondary/10 text-secondary text-[11px] font-medium"
                    title={`${fmt(a.produccion)} pares · ${fmt(a.scrap)} scrap`}
                  >
                    {a.maquina} · {a.turno.replace("Turno ", "")}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {aviso && (
        <div
          className={`rounded-xl p-3 text-sm flex items-start gap-2 ${
            aviso.tipo === "error"
              ? "bg-red-50 border border-red-200 text-red-700"
              : aviso.tipo === "ok"
                ? "bg-green-50 border border-green-200 text-green-700"
                : "bg-blue-50 border border-blue-200 text-blue-700"
          }`}
        >
          {aviso.tipo === "ok" ? (
            <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          )}
          <span>{aviso.texto}</span>
        </div>
      )}

      {!listo ? (
        <div className="bg-white rounded-xl shadow-sm p-12 border border-gray-100 text-center">
          <p className="text-gray-400">
            Elige fecha, máquina y turno para empezar la captura
          </p>
        </div>
      ) : cargando ? (
        <div className="bg-white rounded-xl shadow-sm p-12 border border-gray-100 text-center">
          <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" />
        </div>
      ) : (
        <>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    {[
                      "Estación",
                      "Producto",
                      "Cavidades",
                      "Inicial",
                      "Final",
                      "Ciclos",
                      "Producción",
                      "Scrap",
                      "",
                    ].map((h, i) => (
                      <th
                        key={i}
                        className={`px-2 py-2 text-[11px] font-semibold text-gray-500 uppercase ${
                          i >= 2 && i <= 7 ? "text-right" : "text-left"
                        }`}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {renglones.map((r, i) => {
                    const c = ciclos(r);
                    const malo = c != null && c < 0;
                    return (
                      <tr key={r.clave} className={malo ? "bg-red-50" : ""}>
                        <td className="px-2 py-1.5 font-medium text-gray-700 whitespace-nowrap">
                          {r.estacion || "—"}
                        </td>
                        <td className="px-2 py-1.5 w-64">
                          <div className="flex items-center gap-1">
                            <div className="flex-1 min-w-0">
                              <BuscadorProducto
                                valor={r.producto}
                                onChange={(p) => editar(r.clave, "producto", p)}
                              />
                            </div>
                            {r.producto && i === 0 && (
                              <button
                                type="button"
                                onClick={() => aplicarATodos(r.producto)}
                                className="p-1 text-gray-300 hover:text-primary flex-shrink-0"
                                title="Aplicar este producto a las estaciones sin producto"
                              >
                                <Copy className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                        {["cavidades", "contadorInicial", "contadorFinal"].map((campo) => (
                          <td key={campo} className="px-2 py-1.5">
                            <input
                              type="number"
                              step="any"
                              min="0"
                              value={r[campo]}
                              onChange={(e) => editar(r.clave, campo, e.target.value)}
                              className="w-20 text-right px-2 py-1 text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-primary"
                            />
                          </td>
                        ))}
                        <td
                          className={`px-2 py-1.5 text-right text-xs font-medium ${
                            malo ? "text-red-600" : "text-gray-500"
                          }`}
                        >
                          {c == null ? "—" : fmt(c)}
                        </td>
                        <td className="px-2 py-1.5">
                          <input
                            type="number"
                            step="any"
                            min="0"
                            value={r.produccion}
                            onChange={(e) => editar(r.clave, "produccion", e.target.value)}
                            title={
                              r.produccionTocada
                                ? "Valor capturado a mano"
                                : "Calculado: ciclos × cavidades"
                            }
                            className={`w-24 text-right px-2 py-1 text-xs border rounded focus:outline-none focus:ring-1 focus:ring-primary ${
                              r.produccionTocada
                                ? "border-amber-300 bg-amber-50"
                                : "border-gray-200 bg-gray-50"
                            }`}
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <input
                            type="number"
                            step="any"
                            min="0"
                            value={r.scrap}
                            onChange={(e) => editar(r.clave, "scrap", e.target.value)}
                            className="w-20 text-right px-2 py-1 text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-primary"
                          />
                        </td>
                        <td className="px-2 py-1.5 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => agregarRenglon(i)}
                            className="p-1 text-gray-300 hover:text-primary"
                            title="Otro SKU en esta misma estación"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => quitarRenglon(r.clave)}
                            className="p-1 text-gray-300 hover:text-red-500"
                            title="Quitar renglón"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="bg-gray-50 font-medium">
                  <tr>
                    <td colSpan={6} className="px-2 py-2 text-right text-xs text-gray-500">
                      Total del turno ({totales.conDato} de {renglones.length} con dato)
                    </td>
                    <td className="px-2 py-2 text-right text-gray-900">
                      {fmt(totales.prod)}
                    </td>
                    <td className="px-2 py-2 text-right text-gray-900">
                      {fmt(totales.scrap)}
                      {totales.pct != null && (
                        <span className="block text-[11px] font-normal text-gray-400">
                          {totales.pct.toFixed(2)}%
                        </span>
                      )}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {errores.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3">
              <p className="text-sm font-medium text-red-700 mb-1">
                Hay que corregir antes de guardar:
              </p>
              <ul className="text-sm text-red-600 list-disc list-inside space-y-0.5">
                {errores.slice(0, 6).map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex items-center justify-between gap-4">
            <p className="text-xs text-gray-400">
              La producción se calcula sola con (final − inicial) × cavidades. Si la
              escribes a mano se marca en ámbar y ya no se recalcula.
            </p>
            <button
              onClick={guardar}
              disabled={guardando || errores.length > 0}
              className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-lg font-medium hover:bg-primary-dark disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {guardando ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              Guardar turno
            </button>
          </div>
        </>
      )}
    </div>
  );
}
