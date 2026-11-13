import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Scale, Loader2, X, Inbox, Hourglass, CheckCircle2, AlertTriangle, History, FileEdit, Lightbulb, BadgeCheck,
} from "lucide-react";
import { comprasService } from "../../services/compras.service";
import ArchivoCompras from "../../components/compras/ArchivoCompras";
import Comparativo from "../../components/compras/Comparativo";
import PresupuestoArea from "../../components/compras/PresupuestoArea";
import { dinero } from "../../components/compras/formatoCompras";
import EditorCotizacion from "../../components/compras/EditorCotizacion";

/**
 * Cotizaciones de Compras.
 *
 * La bandeja del agente: las solicitudes aprobadas cuyo ticket tiene asignado
 * en osTicket (el jefe de Compras ve todas). Aquí captura las opciones de
 * proveedores y se las manda a quien pidió, que da su sugerencia técnica desde
 * Solicitudes de Compra. La decisión es de Compras: puede ser otra opción
 * (diciendo por qué) o sin esperar la sugerencia.
 *
 * El asignado se lee de osTicket: si reasignan el ticket allá, la solicitud se
 * mueve sola de bandeja. Acepta ?vista=…&id=N para los correos.
 */

const PESTANAS = [
  { id: "por-cotizar", texto: "Por cotizar", icono: Inbox, urgente: true },
  { id: "esperando", texto: "Esperando sugerencia", icono: Hourglass },
  { id: "por-decidir", texto: "Por decidir", icono: Lightbulb, urgente: true },
  { id: "decididas", texto: "Decididas", icono: CheckCircle2 },
];
// Los correos de antes traen ?vista=elegidas
const ALIAS = { elegidas: "decididas" };

const EVENTOS = {
  CREADA: "Solicitud enviada",
  APROBADA: "Aprobada",
  ENVIADA: "Ticket creado en Compras",
  COTIZADA: "Opciones enviadas",
  OTRAS_OPCIONES: "Pidió otras opciones",
  SUGERIDA: "Dio su sugerencia técnica",
  DECIDIDA: "Compras decidió",
  ELEGIDA: "Eligió proveedor",
  OC_ENVIADA: "Envió la orden de compra",
  OC_FIRMA_GERENTE: "Firmó el gerente",
  OC_FIRMA_COMPRAS: "Firmó Compras",
  OC_FIRMA_FINANZAS: "Firmó Finanzas",
  OC_FIRMA_DIRECCION: "Firmó Dirección",
  OC_AUTORIZADA: "Orden de compra autorizada",
  OC_RECHAZADA: "Rechazó la orden de compra",
};

const fecha = (s) =>
  s ? new Date(s).toLocaleString("es-MX", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—";

function hace(s) {
  if (!s) return "";
  const h = Math.max(0, (Date.now() - new Date(s).getTime()) / 3600000);
  if (h < 1) return `hace ${Math.max(1, Math.round(h * 60))} min`;
  if (h < 24) return `hace ${Math.round(h)} h`;
  const d = Math.round(h / 24);
  return `hace ${d} día${d === 1 ? "" : "s"}`;
}

const mensajeError = (e) => e.response?.data?.message || e.message;

function Detalle({ id, onCerrar, onCambio }) {
  const [sol, setSol] = useState(null);
  const [error, setError] = useState(null);
  const [aviso, setAviso] = useState(null);
  // Subirlo vuelve a pedir la solicitud (después de mandar opciones)
  const [version, setVersion] = useState(0);
  // Decidir: la opción que se va a confirmar y por qué
  const [porDecidir, setPorDecidir] = useState(null);
  const [nota, setNota] = useState("");
  const [decidiendo, setDecidiendo] = useState(false);
  const [errorDecision, setErrorDecision] = useState(null);

  async function decidir() {
    setDecidiendo(true);
    setErrorDecision(null);
    try {
      const r = await comprasService.decidirCotizacion(id, { opcionId: porDecidir.id, nota });
      setAviso(r.message);
      setPorDecidir(null);
      setNota("");
      setVersion((v) => v + 1);
      onCambio();
    } catch (e) {
      setErrorDecision(mensajeError(e));
    } finally {
      setDecidiendo(false);
    }
  }

  useEffect(() => {
    let vivo = true;
    comprasService
      .getCotizacion(id)
      .then((r) => vivo && setSol(r))
      .catch((e) => vivo && setError(mensajeError(e)));
    return () => {
      vivo = false;
    };
  }, [id, version]);

  useEffect(() => {
    const esc = (e) => e.key === "Escape" && onCerrar();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onCerrar]);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-6xl my-6">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">
            {sol ? `${sol.folio} · ${sol.asunto}` : "Solicitud"}
          </h2>
          <button onClick={onCerrar} className="p-1 rounded-lg text-gray-400 hover:bg-gray-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        {error ? (
          <div className="p-5 text-sm text-red-700">{error}</div>
        ) : !sol ? (
          <div className="p-10 flex justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        ) : (
          <div className="p-5 space-y-6">
            <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-gray-500">
              <span>
                Ticket <b className="text-gray-800">{sol.osticket_numero}</b>
                {sol.osticket_estado && ` · ${sol.osticket_estado}`}
              </span>
              <span>
                Pidió <b className="text-gray-800">{sol.solicitante_nombre}</b> · {sol.area_nombre}
              </span>
              <span>Aprobó {sol.decidido_por_nombre || "—"}</span>
              <span>Asignado a {sol.asignado_nombre || "nadie en osTicket"}</span>
            </div>

            {aviso && (
              <div className="text-sm rounded-lg px-3 py-2 bg-green-50 text-green-800 flex items-center justify-between">
                {aviso}
                <button onClick={() => setAviso(null)}>
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            <div>
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Lo que pidió</h3>
              <p className="text-sm text-gray-800 whitespace-pre-wrap">{sol.detalle}</p>
              {sol.archivos.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2 mt-3">
                  {sol.archivos.map((a) => (
                    <ArchivoCompras
                      key={a.id}
                      archivo={a}
                      cargar={() => comprasService.getArchivoSolicitudCompras(sol.id, a.id)}
                    />
                  ))}
                </div>
              )}
              {/* Para cotizar sabiendo cuánto le queda al área */}
              <div className="mt-3">
                <PresupuestoArea saldo={sol.presupuesto} area={sol.area_nombre} />
              </div>
            </div>

            {/* Último motivo para pedir otras opciones: lo primero que hay que ver al recotizar */}
            {sol.estado === "EN_COMPRAS" && sol.descartadas.length > 0 && (
              <div className="text-sm bg-amber-50 border border-amber-200 text-amber-800 rounded-lg px-3 py-2">
                <b>{sol.solicitante_nombre}</b> pidió otras opciones: “{sol.descartadas[0].motivo_descarte}”
              </div>
            )}

            {sol.estado === "EN_COMPRAS" &&
              (sol.permisos.cotizar ? (
                <div>
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                    Opciones de proveedores
                  </h3>
                  <EditorCotizacion
                    solicitudId={sol.id}
                    borrador={sol.borrador}
                    asunto={sol.asunto}
                    onEnviada={(m) => {
                      setAviso(m);
                      setVersion((v) => v + 1);
                      onCambio();
                    }}
                  />
                </div>
              ) : (
                <p className="text-sm text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
                  Todavía no se mandan opciones. Tu rol puede ver esta solicitud pero no cotizar.
                </p>
              ))}

            {sol.enviada && (
              <div>
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                  {
                    {
                      COTIZADA: "Opciones enviadas · esperando la sugerencia de quien pidió",
                      SUGERIDA: "Opciones enviadas · ya sugirió, te toca decidir",
                      DECIDIDA: "Opciones enviadas · decidida · falta que quien pidió mande la orden de compra",
                      ELEGIDA: "Opciones enviadas · ya eligió",
                      EN_FIRMAS: "Opciones enviadas · decidida · orden de compra en firmas",
                      AUTORIZADA: "Opciones enviadas · decidida · orden de compra autorizada",
                      NO_AUTORIZADA: "Opciones enviadas · decidida · orden de compra rechazada",
                    }[sol.estado]
                  }
                </h3>
                <p className="text-xs text-gray-500 mb-2">
                  Las mandó {sol.enviada.enviada_por_nombre} el {fecha(sol.enviada.enviada_en)}
                </p>

                {sol.opcion_sugerida_id && (
                  <div className="mb-3 text-sm text-indigo-800 bg-indigo-50 rounded-lg px-3 py-2">
                    <Lightbulb className="w-4 h-4 inline -mt-0.5 mr-1" />
                    <b>{sol.solicitante_nombre}</b> sugiere{" "}
                    <b>{sol.enviada.opciones.find((o) => o.id === sol.opcion_sugerida_id)?.proveedor}</b> ·{" "}
                    {fecha(sol.sugerido_en)}
                    {sol.sugerencia ? (
                      <span className="block mt-0.5">Su opinión técnica: “{sol.sugerencia}”</span>
                    ) : (
                      <span className="block mt-0.5 text-indigo-700/70">No escribió por qué.</span>
                    )}
                  </div>
                )}
                {sol.estado === "COTIZADA" && sol.permisos.decidir && (
                  <p className="mb-3 text-xs text-gray-500">
                    Puedes decidir sin esperar la sugerencia; queda registrado que fue así.
                  </p>
                )}

                <Comparativo
                  cotizacion={sol.enviada}
                  elegidaId={sol.opcion_elegida_id}
                  sugeridaId={sol.opcion_sugerida_id}
                  impacto={sol.impacto}
                  accion="Decidir"
                  onElegir={sol.permisos.decidir && !porDecidir ? (o) => { setPorDecidir(o); setErrorDecision(null); } : undefined}
                />

                {porDecidir && (
                  <div className="mt-3 border border-green-200 bg-green-50/50 rounded-lg p-3 space-y-2">
                    <p className="text-sm text-gray-800">
                      Vas a decidir a <b>{porDecidir.proveedor}</b> por{" "}
                      <b>{dinero(porDecidir.total, porDecidir.moneda)}</b>
                      {sol.enviada.incluye_iva ? " con IVA" : " + IVA"}.
                      {!porDecidir.completa && " Ojo: no cotizó todas las partidas."}
                    </p>
                    {sol.opcion_sugerida_id && sol.opcion_sugerida_id !== porDecidir.id && (
                      <p className="text-sm text-amber-800 bg-amber-50 rounded-md px-2 py-1">
                        No es la que sugirió quien pidió: escribe por qué, se lo hacemos saber.
                      </p>
                    )}
                    <textarea
                      value={nota}
                      onChange={(e) => setNota(e.target.value)}
                      rows={2}
                      maxLength={1000}
                      placeholder={
                        sol.opcion_sugerida_id && sol.opcion_sugerida_id !== porDecidir.id
                          ? "¿Por qué esta opción y no la sugerida? (obligatorio)"
                          : "Comentario para quien pidió (opcional)"
                      }
                      className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-200"
                    />
                    {errorDecision && <p className="text-sm text-red-700">{errorDecision}</p>}
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => {
                          setPorDecidir(null);
                          setErrorDecision(null);
                        }}
                        className="px-4 py-2 text-sm text-gray-600 rounded-lg hover:bg-gray-100"
                      >
                        Volver
                      </button>
                      <button
                        disabled={
                          decidiendo ||
                          (sol.opcion_sugerida_id && sol.opcion_sugerida_id !== porDecidir.id && !nota.trim())
                        }
                        onClick={decidir}
                        className="flex items-center gap-2 px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                      >
                        {decidiendo ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                        Confirmar decisión
                      </button>
                    </div>
                  </div>
                )}

                {["DECIDIDA", "EN_FIRMAS", "AUTORIZADA", "NO_AUTORIZADA"].includes(sol.estado) && (
                  <div className="mt-3 text-sm text-teal-800 bg-teal-50 rounded-lg px-3 py-2">
                    <BadgeCheck className="w-4 h-4 inline -mt-0.5 mr-1" />
                    {sol.elegido_por_nombre || "Compras"} decidió{" "}
                    <b>{sol.enviada.opciones.find((o) => o.id === sol.opcion_elegida_id)?.proveedor}</b> por{" "}
                    <b>{dinero(sol.monto_elegido, sol.moneda_elegida)}</b>
                    {sol.enviada.incluye_iva ? " con IVA" : " + IVA"} · {fecha(sol.elegido_en)}
                    {sol.decision_nota && <span className="block mt-0.5">“{sol.decision_nota}”</span>}
                  </div>
                )}
                {sol.estado === "ELEGIDA" && (
                  <p className="mt-3 text-sm text-green-800 bg-green-50 rounded-lg px-3 py-2">
                    Eligió{" "}
                    <b>{sol.enviada.opciones.find((o) => o.id === sol.opcion_elegida_id)?.proveedor}</b> por{" "}
                    <b>{dinero(sol.monto_elegido, sol.moneda_elegida)}</b>
                    {sol.enviada.incluye_iva ? " con IVA" : " + IVA"} · {fecha(sol.elegido_en)}
                  </p>
                )}
              </div>
            )}

            {sol.descartadas.length > 0 && (
              <details className="text-sm">
                <summary className="cursor-pointer text-gray-500 hover:text-gray-800">
                  {sol.descartadas.length} cotización{sol.descartadas.length === 1 ? "" : "es"} anterior
                  {sol.descartadas.length === 1 ? "" : "es"} que no le sirvieron
                </summary>
                <div className="space-y-4 mt-3">
                  {sol.descartadas.map((d) => (
                    <div key={d.id}>
                      <p className="text-xs text-gray-500 mb-1">
                        Enviada el {fecha(d.enviada_en)} · motivo: “{d.motivo_descarte}”
                      </p>
                      <Comparativo cotizacion={d} />
                    </div>
                  ))}
                </div>
              </details>
            )}

            <div>
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Historial</h3>
              <ol className="space-y-1.5">
                {sol.eventos.map((ev, i) => (
                  <li key={i} className="flex gap-3 text-sm">
                    <span className="text-gray-400 whitespace-nowrap w-28 shrink-0">{fecha(ev.creado_en)}</span>
                    <span>
                      <span className="text-gray-800">{EVENTOS[ev.tipo] || ev.tipo}</span>
                      {ev.usuario_nombre && <span className="text-gray-500"> · {ev.usuario_nombre}</span>}
                      {ev.detalle && ev.tipo !== "CREADA" && <span className="block text-gray-500">{ev.detalle}</span>}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function CotizacionesComprasPage() {
  const [params, setParams] = useSearchParams();
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState(null);

  const pedida = ALIAS[params.get("vista")] || params.get("vista");
  const vista = PESTANAS.some((p) => p.id === pedida) ? pedida : "por-cotizar";
  const abierta = params.get("id") ? Number(params.get("id")) : null;

  const cambiarParams = (cambios) => {
    const p = new URLSearchParams(params);
    for (const [k, v] of Object.entries(cambios)) {
      if (v == null) p.delete(k);
      else p.set(k, v);
    }
    setParams(p, { replace: true });
  };

  const [version, setVersion] = useState(0);
  const recargar = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    let vivo = true;
    comprasService
      .getCotizaciones(vista)
      .then((r) => {
        if (!vivo) return;
        // Se guarda de qué pestaña son: al cambiar de pestaña, hasta que llegue
        // la respuesta se muestra "cargando" y no las filas de la otra
        setDatos({ ...r, vista });
        setError(null);
      })
      .catch((e) => vivo && setError(mensajeError(e)));
    return () => {
      vivo = false;
    };
  }, [vista, version]);

  const listos = datos?.vista === vista;
  const todas = datos?.alcance?.todas;

  return (
    <div className="p-6 space-y-5 max-w-6xl mx-auto">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-[#236093]/10 rounded-lg">
          <Scale className="w-6 h-6 text-[#236093]" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Cotizaciones de Compras</h1>
          <p className="text-sm text-gray-500">
            {todas
              ? "Todas las solicitudes en Compras"
              : "Las solicitudes cuyo ticket tienes asignado en osTicket"}
          </p>
        </div>
      </div>

      {error && <div className="bg-red-50 text-red-700 p-3 rounded-xl text-sm">{error}</div>}
      {datos?.aviso && (
        <div className="flex items-start gap-2 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          {datos.aviso}
        </div>
      )}

      <div className="flex gap-1 border-b border-gray-200">
        {PESTANAS.map((p) => {
          const Icono = p.icono;
          const n = datos?.contadores?.[p.id];
          return (
            <button
              key={p.id}
              onClick={() => cambiarParams({ vista: p.id === "por-cotizar" ? null : p.id, id: null })}
              className={`flex items-center gap-2 px-4 py-2 text-sm border-b-2 -mb-px ${
                vista === p.id ? "border-[#236093] text-[#236093] font-medium" : "border-transparent text-gray-500 hover:text-gray-800"
              }`}
            >
              <Icono className="w-4 h-4" />
              {p.texto}
              {n > 0 && (
                <span className={`px-1.5 py-0.5 text-xs rounded-full text-white ${p.urgente ? "bg-amber-500" : "bg-gray-400"}`}>
                  {n}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
        {!listos ? (
          <div className="py-12 flex justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        ) : datos.filas.length === 0 ? (
          <div className="py-12 text-center text-sm text-gray-400">
            {
              {
                "por-cotizar": "No tienes solicitudes por cotizar",
                esperando: "No hay opciones esperando la sugerencia de quien pidió",
                "por-decidir": "No hay sugerencias esperando tu decisión",
                decididas: "Todavía no hay ninguna decidida",
              }[vista]
            }
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b border-gray-100">
                <th className="px-4 py-2.5 font-medium">Ticket</th>
                <th className="px-4 py-2.5 font-medium">Asunto</th>
                <th className="px-4 py-2.5 font-medium">Pidió</th>
                {todas && <th className="px-4 py-2.5 font-medium">Asignado</th>}
                <th className="px-4 py-2.5 font-medium">
                  {
                    {
                      "por-cotizar": "En Compras desde",
                      esperando: "Opciones enviadas",
                      "por-decidir": "Sugirió",
                      decididas: "Decidida",
                    }[vista]
                  }
                </th>
              </tr>
            </thead>
            <tbody>
              {datos.filas.map((s) => (
                <tr
                  key={s.id}
                  onClick={() => cambiarParams({ id: s.id })}
                  className="border-b border-gray-50 last:border-0 hover:bg-gray-50 cursor-pointer"
                >
                  <td className="px-4 py-2.5 whitespace-nowrap">
                    <span className="font-medium text-gray-900">{s.osticket_numero}</span>
                    <span className="block font-mono text-xs text-gray-400">{s.folio}</span>
                  </td>
                  <td className="px-4 py-2.5 text-gray-900">
                    {s.asunto}
                    <span className="flex flex-wrap items-center gap-2 mt-0.5 text-xs">
                      {s.con_borrador && (
                        <span className="inline-flex items-center gap-1 text-[#236093]">
                          <FileEdit className="w-3 h-3" />
                          Borrador
                        </span>
                      )}
                      {s.descartadas > 0 && (
                        <span className="inline-flex items-center gap-1 text-amber-700">
                          <History className="w-3 h-3" />
                          Pidió otras opciones
                        </span>
                      )}
                      {s.osticket_estado && <span className="text-gray-400">{s.osticket_estado}</span>}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-gray-600">
                    {s.solicitante_nombre}
                    <span className="block text-xs text-gray-400">{s.area_nombre}</span>
                  </td>
                  {todas && (
                    <td className="px-4 py-2.5 text-gray-600">
                      {s.asignado_nombre || <span className="text-gray-400">Sin asignar</span>}
                      {s.asignado_nombre && !s.asignado_en_dbx && (
                        <span className="block text-xs text-amber-700" title={s.asignado_email}>
                          Sin usuario en el DBX
                        </span>
                      )}
                    </td>
                  )}
                  <td className="px-4 py-2.5 text-gray-500 whitespace-nowrap">
                    {vista === "decididas" ? (
                      <>
                        <span className="text-gray-900">{s.proveedor_elegido}</span>
                        <span className="block text-xs">
                          {dinero(s.monto_elegido, s.moneda_elegida)} · {fecha(s.elegido_en)}
                        </span>
                      </>
                    ) : vista === "por-decidir" ? (
                      <>
                        <span className="text-gray-900">{s.proveedor_sugerido}</span>
                        <span className="block text-xs text-amber-600">{hace(s.sugerido_en)}</span>
                      </>
                    ) : (
                      <>
                        {fecha(vista === "esperando" ? s.cotizada_en : s.enviado_en)}
                        <span className={`block text-xs ${vista === "por-cotizar" ? "text-amber-600" : ""}`}>
                          {hace(vista === "esperando" ? s.cotizada_en : s.enviado_en)}
                        </span>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {abierta && <Detalle id={abierta} onCerrar={() => cambiarParams({ id: null })} onCambio={recargar} />}
    </div>
  );
}
