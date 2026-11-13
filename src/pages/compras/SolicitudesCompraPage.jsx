import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import {
  ShoppingCart,
  Plus,
  Loader2,
  X,
  Paperclip,
  FileText,
  FileSpreadsheet,
  Download,
  CheckCircle2,
  XCircle,
  Clock,
  Ban,
  Send,
  AlertTriangle,
  Inbox,
  History,
  Upload,
  Scale,
  BadgeCheck,
  RotateCcw,
  Hourglass,
  Lightbulb,
  FileSignature,
  PenLine,
} from "lucide-react";
import { comprasService } from "../../services/compras.service";
import ArchivoCompras from "../../components/compras/ArchivoCompras";
import Comparativo from "../../components/compras/Comparativo";
import PresupuestoArea from "../../components/compras/PresupuestoArea";
import { dinero } from "../../components/compras/formatoCompras";
import FirmasOrden from "../../components/compras/FirmasOrden";
import ConfirmarFirma from "../../components/firmas/ConfirmarFirma";

/**
 * Solicitudes de Compra.
 *
 * Una sola pantalla para las dos caras del proceso: quien pide ve sus
 * solicitudes y en qué van; quien aprueba (gerente o suplente de un área) ve
 * además su bandeja. La bandeja NO depende del rol: aparece si el usuario está
 * registrado como aprobador en "Aprobadores de Compras".
 *
 * Acepta ?vista=pendientes&id=N para que los correos de aviso lleguen directo
 * a la solicitud.
 */

const ESTADOS = {
  PENDIENTE: { texto: "Pendiente", clase: "bg-amber-50 text-amber-700 border-amber-200", icono: Clock },
  APROBADA: { texto: "Aprobada", clase: "bg-green-50 text-green-700 border-green-200", icono: CheckCircle2 },
  RECHAZADA: { texto: "Rechazada", clase: "bg-red-50 text-red-700 border-red-200", icono: XCircle },
  CANCELADA: { texto: "Cancelada", clase: "bg-gray-50 text-gray-500 border-gray-200", icono: Ban },
  EN_COMPRAS: { texto: "En Compras", clase: "bg-blue-50 text-blue-700 border-blue-200", icono: Send },
  COTIZADA: { texto: "Da tu sugerencia", clase: "bg-violet-50 text-violet-700 border-violet-200", icono: Scale },
  SUGERIDA: { texto: "Compras decide", clase: "bg-indigo-50 text-indigo-700 border-indigo-200", icono: Hourglass },
  DECIDIDA: { texto: "Compras decidió", clase: "bg-teal-50 text-teal-700 border-teal-200", icono: BadgeCheck },
  // Las de antes del 13-nov-2026: las elegía quien pidió
  ELEGIDA: { texto: "Proveedor elegido", clase: "bg-teal-50 text-teal-700 border-teal-200", icono: BadgeCheck },
  // La orden de compra
  EN_FIRMAS: { texto: "Orden en firmas", clase: "bg-amber-50 text-amber-700 border-amber-200", icono: FileSignature },
  AUTORIZADA: { texto: "Autorizada", clase: "bg-green-50 text-green-700 border-green-200", icono: CheckCircle2 },
  NO_AUTORIZADA: { texto: "Orden rechazada", clase: "bg-red-50 text-red-700 border-red-200", icono: XCircle },
};

const EVENTOS = {
  CREADA: "Solicitud enviada",
  APROBADA: "Aprobada",
  RECHAZADA: "Rechazada",
  CANCELADA: "Cancelada por quien la pidió",
  ENVIADA: "Ticket creado en Compras",
  ERROR_ENVIO: "No se pudo crear el ticket",
  COTIZADA: "Compras mandó opciones",
  OTRAS_OPCIONES: "Pidió otras opciones",
  SUGERIDA: "Dio su sugerencia técnica",
  DECIDIDA: "Compras decidió",
  ELEGIDA: "Eligió proveedor",
  OC_ENVIADA: "Envió la orden de compra",
  OC_FIRMA_GERENTE: "Firmó la orden",
  OC_FIRMA_COMPRAS: "Firmó la orden",
  OC_FIRMA_FINANZAS: "Firmó la orden",
  OC_FIRMA_DIRECCION: "Firmó la orden",
  OC_AUTORIZADA: "Orden de compra autorizada",
  OC_RECHAZADA: "Rechazó la orden de compra",
};

const COMO = {
  GERENTE: "gerente",
  SUPLENTE: "suplente",
  PROPIA: "la pidió el gerente",
  COMPRAS: "Compras",
  FINANZAS: "Finanzas",
  DIRECCION: "Dirección",
};

const fecha = (s) =>
  s
    ? new Date(s).toLocaleString("es-MX", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

/** "hace 3 h", "hace 2 días": lo que importa en la bandeja es cuánto lleva esperando. */
function hace(s) {
  if (!s) return "";
  const min = Math.max(0, (Date.now() - new Date(s).getTime()) / 60000);
  if (min < 60) return `hace ${Math.round(min)} min`;
  const h = min / 60;
  if (h < 24) return `hace ${Math.round(h)} h`;
  const d = Math.round(h / 24);
  return `hace ${d} día${d === 1 ? "" : "s"}`;
}

const tamano = (b) =>
  b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`;

const mensajeError = (e) => e.response?.data?.message || e.message;

function Estado({ estado }) {
  const e = ESTADOS[estado] || ESTADOS.PENDIENTE;
  const Icono = e.icono;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full border ${e.clase}`}>
      <Icono className="w-3 h-3" />
      {e.texto}
    </span>
  );
}

function Modal({ titulo, onCerrar, children, ancho = "max-w-2xl" }) {
  useEffect(() => {
    const esc = (e) => e.key === "Escape" && onCerrar();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onCerrar]);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 overflow-y-auto">
      <div className={`bg-white rounded-xl shadow-xl w-full ${ancho} my-8`}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">{titulo}</h2>
          <button onClick={onCerrar} className="p-1 rounded-lg text-gray-400 hover:bg-gray-100">
            <X className="w-5 h-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ===========================================================================
// Nueva solicitud
// ===========================================================================

function NuevaSolicitud({ contexto, onCerrar, onCreada }) {
  const [asunto, setAsunto] = useState("");
  const [detalle, setDetalle] = useState("");
  const [archivos, setArchivos] = useState([]);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);
  const input = useRef(null);
  const { maxMb, maxTotalMb, maxArchivos, extensiones } = contexto.archivos;
  const totalBytes = archivos.reduce((suma, f) => suma + f.size, 0);
  const excedeTotal = totalBytes > maxTotalMb * 1024 * 1024;

  const agregar = (lista) => {
    setError(null);
    const nuevos = [];
    for (const f of lista) {
      const ext = f.name.slice(f.name.lastIndexOf(".")).toLowerCase();
      if (!extensiones.includes(ext)) {
        setError(`"${f.name}" no se acepta. Solo imágenes, PDF y Excel.`);
        continue;
      }
      if (f.size > maxMb * 1024 * 1024) {
        setError(`"${f.name}" pesa ${tamano(f.size)}; el máximo es ${maxMb} MB.`);
        continue;
      }
      nuevos.push(f);
    }
    setArchivos((prev) => {
      const todos = [...prev, ...nuevos];
      if (todos.length > maxArchivos) {
        setError(`Máximo ${maxArchivos} archivos por solicitud.`);
        return todos.slice(0, maxArchivos);
      }
      return todos;
    });
  };

  const enviar = async (e) => {
    e.preventDefault();
    setEnviando(true);
    setError(null);
    try {
      const r = await comprasService.crear({ asunto, detalle }, archivos);
      onCreada(r.data);
    } catch (err) {
      setError(mensajeError(err));
      setEnviando(false);
    }
  };

  const area = contexto.area;
  const listo = asunto.trim() && detalle.trim() && !excedeTotal && !enviando;

  return (
    <Modal titulo="Nueva solicitud de compra" onCerrar={onCerrar}>
      <form onSubmit={enviar} className="p-5 space-y-4">
        <div className="text-sm bg-gray-50 rounded-lg px-3 py-2 text-gray-600">
          Área <b className="text-gray-900">{area.nombre}</b>. La revisa{" "}
          <b className="text-gray-900">{area.gerente_nombre}</b>
          {area.suplente_nombre && <> o, si no está, {area.suplente_nombre}</>}
          {" "}antes de que llegue a Compras.
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700">Asunto</label>
          <input
            value={asunto}
            onChange={(e) => setAsunto(e.target.value)}
            maxLength={200}
            autoFocus
            placeholder="Qué necesitas, en una línea"
            className="mt-1 w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#236093]/30"
          />
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700">Detalle</label>
          <textarea
            value={detalle}
            onChange={(e) => setDetalle(e.target.value)}
            maxLength={5000}
            rows={6}
            placeholder="Cantidad, especificaciones, para qué es, proveedor sugerido, para cuándo se necesita…"
            className="mt-1 w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#236093]/30"
          />
          <p className="text-xs text-gray-400 text-right">{detalle.length} / 5000</p>
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700">Archivos</label>
          <div
            onClick={() => input.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              agregar(Array.from(e.dataTransfer.files));
            }}
            className="mt-1 border-2 border-dashed border-gray-200 rounded-lg px-4 py-5 text-center cursor-pointer hover:border-[#236093]/40 hover:bg-[#236093]/5"
          >
            <Upload className="w-5 h-5 mx-auto text-gray-400" />
            <p className="text-sm text-gray-600 mt-1">Arrastra aquí o haz clic para elegir</p>
            <p className="text-xs text-gray-400">
              Imágenes, PDF o Excel · hasta {maxMb} MB cada uno y {maxTotalMb} MB en total ·
              máximo {maxArchivos}
            </p>
          </div>
          <input
            ref={input}
            type="file"
            multiple
            accept={extensiones.join(",")}
            className="hidden"
            onChange={(e) => {
              agregar(Array.from(e.target.files));
              e.target.value = "";
            }}
          />
          {archivos.length > 0 && (
            <ul className="mt-2 space-y-1">
              {archivos.map((f, i) => (
                <li key={`${f.name}-${i}`} className="flex items-center gap-2 text-sm bg-gray-50 rounded-lg px-3 py-1.5">
                  <Paperclip className="w-4 h-4 text-gray-400 shrink-0" />
                  <span className="truncate flex-1">{f.name}</span>
                  <span className="text-xs text-gray-400">{tamano(f.size)}</span>
                  <button
                    type="button"
                    onClick={() => setArchivos((prev) => prev.filter((_, j) => j !== i))}
                    className="text-gray-400 hover:text-red-600"
                    title="Quitar"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          {excedeTotal && (
            <p className="text-xs text-red-600 mt-1">
              Entre todos pesan {tamano(totalBytes)}; el máximo es {maxTotalMb} MB. Quita alguno.
            </p>
          )}
        </div>

        {/* Compras contesta por osTicket al correo del usuario. Si osTicket no
            lo conoce, crea un usuario nuevo con él: si está mal, nadie recibe
            la respuesta. */}
        {contexto.correoEnOsticket === false && (
          <div className="flex items-start gap-2 text-xs text-amber-800 bg-amber-50 rounded-lg px-3 py-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>
              Compras te contestará a <b>{contexto.correo || "(sin correo)"}</b>, que todavía no
              está en su sistema de tickets. Si no es tu correo de la empresa, pide a TI que lo
              corrija antes de enviar.
            </span>
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2 text-sm text-red-700 bg-red-50 rounded-lg px-3 py-2">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onCerrar} className="px-4 py-2 text-sm text-gray-600 rounded-lg hover:bg-gray-100">
            Cancelar
          </button>
          <button
            type="submit"
            disabled={!listo}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-[#236093] text-white rounded-lg hover:bg-[#1c4d76] disabled:opacity-50"
          >
            {enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Enviar a aprobación
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ===========================================================================
// Detalle
// ===========================================================================

function Detalle({ id, conexion, onCerrar, onCambio }) {
  const [sol, setSol] = useState(null);
  const [error, setError] = useState(null);
  const [comentario, setComentario] = useState("");
  const [rechazando, setRechazando] = useState(false);
  const [trabajando, setTrabajando] = useState(false);
  const [aviso, setAviso] = useState(null);
  // Sugerir proveedor: la opción que se va a confirmar y, aparte, pedir otras
  const [porSugerir, setPorSugerir] = useState(null);
  const [notaSugerencia, setNotaSugerencia] = useState("");
  const [pidiendoOtras, setPidiendoOtras] = useState(false);
  const [motivo, setMotivo] = useState("");
  // Orden de compra: comentario y, si es el gerente, la ventana del PIN
  const [notaOrden, setNotaOrden] = useState("");
  const [firmandoOrden, setFirmandoOrden] = useState(false);

  const cargar = useCallback(async () => {
    try {
      setSol(await comprasService.getSolicitud(id));
    } catch (e) {
      setError(mensajeError(e));
    }
  }, [id]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const accion = async (fn) => {
    setTrabajando(true);
    setAviso(null);
    try {
      const r = await fn();
      setAviso({ ok: true, texto: r.message });
      setRechazando(false);
      setComentario("");
      setPorSugerir(null);
      setNotaSugerencia("");
      setPidiendoOtras(false);
      setMotivo("");
      setNotaOrden("");
      await cargar();
      onCambio();
    } catch (e) {
      setAviso({ ok: false, texto: mensajeError(e) });
    } finally {
      setTrabajando(false);
    }
  };

  return (
    <Modal
      titulo={sol ? `${sol.folio} · ${sol.asunto}` : "Solicitud"}
      onCerrar={onCerrar}
      // El comparativo necesita ancho: con tres proveedores ya no cabe en el angosto
      ancho={sol?.cotizacion ? "max-w-6xl" : "max-w-2xl"}
    >
      {error ? (
        <div className="p-5 text-sm text-red-700">{error}</div>
      ) : !sol ? (
        <div className="p-10 flex justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      ) : (
        <div className="p-5 space-y-5">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-500">
            <Estado estado={sol.estado} />
            <span>
              Pidió <b className="text-gray-800">{sol.solicitante_nombre}</b>
            </span>
            <span>{sol.area_nombre}</span>
            <span>{fecha(sol.creado_en)}</span>
          </div>

          {sol.estado === "APROBADA" && (
            <p className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
              {!conexion
                ? "Aprobada. Queda en espera de pasar a Compras: la conexión con su sistema de tickets todavía no está activa."
                : sol.ultimo_error_envio
                  ? "Aprobada, pero todavía no llega a Compras: su sistema de tickets no respondió. Se reintenta solo cada pocos minutos."
                  : "Aprobada. Se está creando el ticket en Compras."}
            </p>
          )}
          {["EN_COMPRAS", "COTIZADA", "SUGERIDA", "DECIDIDA", "ELEGIDA", "EN_FIRMAS", "AUTORIZADA", "NO_AUTORIZADA"].includes(sol.estado) &&
            sol.osticket_numero && (
            <p className="text-sm text-blue-700 bg-blue-50 rounded-lg px-3 py-2">
              Ticket de Compras <b>{sol.osticket_numero}</b>
              {sol.asignado_nombre && <> · lo atiende {sol.asignado_nombre}</>}
              {sol.osticket_estado && <> · {sol.osticket_estado}</>}
              {sol.estado === "EN_COMPRAS" && (
                <span className="block text-xs text-blue-600/80 mt-0.5">
                  Cuando Compras tenga opciones de proveedores te llegan aquí para que des tu sugerencia técnica.
                </span>
              )}
            </p>
          )}

          <p className="text-sm text-gray-800 whitespace-pre-wrap">{sol.detalle}</p>

          {/* El gerente lo ve al aprobar; quien pidió, mientras espera y al sugerir */}
          {sol.presupuesto && <PresupuestoArea saldo={sol.presupuesto} area={sol.area_nombre} />}

          {/* --- Opciones de Compras --- */}
          {sol.cotizacion && (
            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                {sol.estado === "COTIZADA" ? "Compras te mandó estas opciones" : "Opciones de Compras"}
              </h3>
              {sol.estado === "COTIZADA" && sol.permisos.sugerir && (
                <p className="text-sm text-violet-800 bg-violet-50 rounded-lg px-3 py-2">
                  Sugiere la opción que técnicamente te sirve y explica por qué. Compras toma en cuenta tu sugerencia y
                  decide.
                </p>
              )}
              {sol.estado === "SUGERIDA" && (
                <p className="text-sm text-indigo-800 bg-indigo-50 rounded-lg px-3 py-2">
                  <Lightbulb className="w-4 h-4 inline -mt-0.5 mr-1" />
                  {sol.permisos.sugerir ? "Sugeriste" : `${sol.solicitante_nombre} sugirió`}{" "}
                  <b>{sol.cotizacion.opciones.find((o) => o.id === sol.opcion_sugerida_id)?.proveedor}</b> el{" "}
                  {fecha(sol.sugerido_en)}
                  {sol.sugerencia && <> · “{sol.sugerencia}”</>}. Ahora Compras decide.
                  {sol.permisos.sugerir && (
                    <span className="block text-xs text-indigo-700/80 mt-0.5">
                      Mientras Compras no decida, puedes cambiar tu sugerencia o pedir otras opciones.
                    </span>
                  )}
                </p>
              )}
              {["DECIDIDA", "EN_FIRMAS", "AUTORIZADA", "NO_AUTORIZADA"].includes(sol.estado) && (
                <div className="text-sm text-teal-800 bg-teal-50 rounded-lg px-3 py-2">
                  <BadgeCheck className="w-4 h-4 inline -mt-0.5 mr-1" />
                  {sol.elegido_por_nombre || "Compras"} decidió{" "}
                  <b>{sol.cotizacion.opciones.find((o) => o.id === sol.opcion_elegida_id)?.proveedor}</b> por{" "}
                  <b>{dinero(sol.monto_elegido, sol.moneda_elegida)}</b>
                  {sol.cotizacion.incluye_iva ? " con IVA" : " + IVA"} el {fecha(sol.elegido_en)}
                  {sol.opcion_sugerida_id && sol.opcion_sugerida_id !== sol.opcion_elegida_id && (
                    <span className="block mt-0.5">
                      Se había sugerido a {sol.cotizacion.opciones.find((o) => o.id === sol.opcion_sugerida_id)?.proveedor}.
                      {sol.decision_nota && <> Compras explicó: “{sol.decision_nota}”</>}
                    </span>
                  )}
                  {(!sol.opcion_sugerida_id || sol.opcion_sugerida_id === sol.opcion_elegida_id) && sol.decision_nota && (
                    <span className="block mt-0.5">Comentó: “{sol.decision_nota}”</span>
                  )}
                  {sol.estado === "DECIDIDA" && !sol.permisos.enviarOrden && (
                    <span className="block text-xs text-teal-700/80 mt-0.5">
                      Lo siguiente es que {sol.solicitante_nombre} mande la orden de compra.
                    </span>
                  )}
                </div>
              )}
              {sol.estado === "ELEGIDA" && (
                <p className="text-sm text-teal-800 bg-teal-50 rounded-lg px-3 py-2">
                  Elegiste{" "}
                  <b>{sol.cotizacion.opciones.find((o) => o.id === sol.opcion_elegida_id)?.proveedor}</b> por{" "}
                  <b>{dinero(sol.monto_elegido, sol.moneda_elegida)}</b>
                  {sol.cotizacion.incluye_iva ? " con IVA" : " + IVA"} el {fecha(sol.elegido_en)}; Compras sigue con la compra.
                  {sol.monto_presupuesto != null && (
                    <span className="block text-xs text-teal-700/80 mt-0.5">
                      Se descontaron {dinero(sol.monto_presupuesto)} del presupuesto de tu área (sin IVA, en pesos).
                    </span>
                  )}
                </p>
              )}
              <Comparativo
                cotizacion={sol.cotizacion}
                elegidaId={sol.opcion_elegida_id}
                sugeridaId={sol.opcion_sugerida_id}
                impacto={sol.impacto}
                accion="Sugerir"
                onElegir={sol.permisos.sugerir && !porSugerir && !pidiendoOtras ? setPorSugerir : undefined}
              />

              {porSugerir && (
                <div className="border border-violet-200 bg-violet-50/50 rounded-lg p-3 space-y-2">
                  <p className="text-sm text-gray-800">
                    Vas a sugerir a <b>{porSugerir.proveedor}</b> por <b>{dinero(porSugerir.total, porSugerir.moneda)}</b>
                    {sol.cotizacion.incluye_iva ? " con IVA" : " + IVA"}.
                    {!porSugerir.completa && " Ojo: no cotizó todas las partidas."}
                  </p>
                  {sol.impacto?.opciones?.[porSugerir.id]?.monto != null && (
                    <p
                      className={`text-sm rounded-md px-2 py-1 ${
                        sol.impacto.opciones[porSugerir.id].rebasa ? "bg-red-100 text-red-800" : "text-gray-600"
                      }`}
                    >
                      Si Compras la decide, al autorizarse la orden de compra se descontarían{" "}
                      {dinero(sol.impacto.opciones[porSugerir.id].monto)} del presupuesto de tu área.
                      {sol.impacto.saldo?.configurado &&
                        (sol.impacto.opciones[porSugerir.id].rebasa
                          ? ` Hoy rebasaría lo disponible: quedaría en ${dinero(sol.impacto.opciones[porSugerir.id].quedaMes)} este mes.`
                          : ` Hoy te quedarían ${dinero(sol.impacto.opciones[porSugerir.id].quedaMes)} este mes.`)}
                    </p>
                  )}
                  <textarea
                    value={notaSugerencia}
                    onChange={(e) => setNotaSugerencia(e.target.value)}
                    rows={3}
                    maxLength={1000}
                    placeholder="Tu opinión técnica para Compras: ¿por qué esta opción? (calidad, compatibilidad, marca, tiempo de entrega…)"
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-200"
                  />
                  <div className="flex justify-end gap-2">
                    <button onClick={() => setPorSugerir(null)} className="px-4 py-2 text-sm text-gray-600 rounded-lg hover:bg-gray-100">
                      Volver
                    </button>
                    <button
                      disabled={trabajando}
                      onClick={() =>
                        accion(() => comprasService.sugerir(sol.id, { opcionId: porSugerir.id, comentario: notaSugerencia }))
                      }
                      className="flex items-center gap-2 px-4 py-2 text-sm bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50"
                    >
                      {trabajando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lightbulb className="w-4 h-4" />}
                      Mandar sugerencia
                    </button>
                  </div>
                </div>
              )}

              {sol.permisos.sugerir && !porSugerir && (
                pidiendoOtras ? (
                  <div className="border border-amber-200 bg-amber-50/50 rounded-lg p-3 space-y-2">
                    <textarea
                      value={motivo}
                      onChange={(e) => setMotivo(e.target.value)}
                      rows={2}
                      maxLength={1000}
                      placeholder="¿Por qué ninguna te sirve? (obligatorio; ej. necesito otra marca, el tiempo de entrega es muy largo)"
                      className="w-full text-sm border border-amber-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-200"
                    />
                    <div className="flex justify-end gap-2">
                      <button onClick={() => setPidiendoOtras(false)} className="px-4 py-2 text-sm text-gray-600 rounded-lg hover:bg-gray-100">
                        Volver
                      </button>
                      <button
                        disabled={trabajando || !motivo.trim()}
                        onClick={() => accion(() => comprasService.pedirOtrasOpciones(sol.id, motivo))}
                        className="flex items-center gap-2 px-4 py-2 text-sm bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50"
                      >
                        <RotateCcw className="w-4 h-4" />
                        Pedir otras opciones
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex justify-end">
                    <button
                      onClick={() => setPidiendoOtras(true)}
                      className="inline-flex items-center gap-1.5 text-sm text-amber-700 hover:underline"
                    >
                      <RotateCcw className="w-4 h-4" />
                      Ninguna me sirve, pedir otras opciones
                    </button>
                  </div>
                )
              )}
            </div>
          )}

          {/* --- Orden de compra --- */}
          {sol.permisos.enviarOrden && (
            <div className="rounded-lg border border-[#236093]/30 bg-[#236093]/5 p-4 space-y-3">
              <p className="text-sm text-gray-800 flex items-start gap-2">
                <FileSignature className="w-4 h-4 mt-0.5 text-[#236093] shrink-0" />
                <span>
                  Compras ya decidió. Manda la <b>orden de compra</b> para que la firmen
                  {sol.permisos.firmaAlEnviar ? " " : " tu gerente, "}Compras, Finanzas y Dirección.
                  {sol.permisos.firmaAlEnviar && (
                    <span className="block text-xs text-gray-500 mt-0.5">
                      Como eres el gerente del área, tu firma va al mandarla: te pide tu PIN.
                    </span>
                  )}
                </span>
              </p>
              <textarea
                value={notaOrden}
                onChange={(e) => setNotaOrden(e.target.value)}
                rows={2}
                maxLength={1000}
                placeholder="Comentario para quienes firman (opcional): para qué es, si urge…"
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-[#236093]/30"
              />
              <div className="flex justify-end">
                <button
                  disabled={trabajando}
                  onClick={() =>
                    sol.permisos.firmaAlEnviar
                      ? setFirmandoOrden(true)
                      : accion(() => comprasService.enviarOrden(sol.id, { comentario: notaOrden }))
                  }
                  className="flex items-center gap-2 px-4 py-2 text-sm bg-[#236093] text-white rounded-lg hover:bg-[#1c4d76] disabled:opacity-50"
                >
                  {trabajando ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : sol.permisos.firmaAlEnviar ? (
                    <PenLine className="w-4 h-4" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                  {sol.permisos.firmaAlEnviar ? "Firmar y mandar la orden" : "Mandar la orden de compra"}
                </button>
              </div>
            </div>
          )}
          {sol.orden && (
            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Orden de compra</h3>
              {sol.orden.estado === "AUTORIZADA" && (
                <p className="text-sm text-green-800 bg-green-50 rounded-lg px-3 py-2">
                  <CheckCircle2 className="w-4 h-4 inline -mt-0.5 mr-1" />
                  Autorizada el {fecha(sol.orden.terminada_en)}. Compras sigue con la compra sobre el mismo ticket.
                  {sol.monto_presupuesto != null && (
                    <span className="block text-xs text-green-700/80 mt-0.5">
                      Se descontaron {dinero(sol.monto_presupuesto)} del presupuesto del área (sin IVA, en pesos).
                    </span>
                  )}
                </p>
              )}
              {sol.orden.estado === "RECHAZADA" && (
                <p className="text-sm text-red-700 bg-red-50 rounded-lg px-3 py-2">
                  <XCircle className="w-4 h-4 inline -mt-0.5 mr-1" />
                  {sol.orden.rechazada_por_nombre} la rechazó el {fecha(sol.orden.terminada_en)}: “{sol.orden.motivo_rechazo}”. La
                  solicitud termina aquí.
                </p>
              )}
              <FirmasOrden orden={sol.orden} />
            </div>
          )}

          {sol.archivos.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {sol.archivos.map((a) => (
                <ArchivoCompras key={a.id} archivo={a} cargar={() => comprasService.getArchivo(sol.id, a.id)} />
              ))}
            </div>
          )}

          {/* --- Bitácora --- */}
          <div>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Historial</h3>
            <ol className="space-y-2">
              {sol.eventos.map((ev, i) => (
                <li key={i} className="flex gap-3 text-sm">
                  <span className="text-gray-400 whitespace-nowrap w-28 shrink-0">{fecha(ev.creado_en)}</span>
                  <div>
                    <span className="text-gray-800">{EVENTOS[ev.tipo] || ev.tipo}</span>
                    <span className="text-gray-500">
                      {" "}· {ev.usuario_nombre}
                      {ev.como && ` (${COMO[ev.como] || ev.como})`}
                    </span>
                    {ev.detalle && ev.tipo !== "CREADA" && (
                      <p className="text-gray-600 italic">“{ev.detalle}”</p>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </div>

          {aviso && (
            <div
              className={`text-sm rounded-lg px-3 py-2 ${
                aviso.ok ? "bg-green-50 text-green-800" : "bg-red-50 text-red-700"
              }`}
            >
              {aviso.texto}
            </div>
          )}

          {/* --- Acciones --- */}
          {sol.permisos.decidir && (
            <div className="border-t border-gray-100 pt-4 space-y-3">
              <textarea
                value={comentario}
                onChange={(e) => setComentario(e.target.value)}
                rows={2}
                placeholder={rechazando ? "Motivo del rechazo (obligatorio)" : "Comentario (opcional)"}
                className={`w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 ${
                  rechazando ? "border-red-200 focus:ring-red-200" : "border-gray-200 focus:ring-[#236093]/30"
                }`}
              />
              <div className="flex justify-end gap-2">
                {rechazando ? (
                  <>
                    <button onClick={() => setRechazando(false)} className="px-4 py-2 text-sm text-gray-600 rounded-lg hover:bg-gray-100">
                      Volver
                    </button>
                    <button
                      disabled={trabajando || !comentario.trim()}
                      onClick={() => accion(() => comprasService.decidir(sol.id, { aprobar: false, comentario }))}
                      className="flex items-center gap-2 px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                    >
                      <XCircle className="w-4 h-4" />
                      Confirmar rechazo
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      disabled={trabajando}
                      onClick={() => setRechazando(true)}
                      className="flex items-center gap-2 px-4 py-2 text-sm text-red-700 border border-red-200 rounded-lg hover:bg-red-50 disabled:opacity-50"
                    >
                      <XCircle className="w-4 h-4" />
                      Rechazar
                    </button>
                    <button
                      disabled={trabajando}
                      onClick={() => accion(() => comprasService.decidir(sol.id, { aprobar: true, comentario }))}
                      className="flex items-center gap-2 px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                    >
                      {trabajando ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                      Aprobar
                    </button>
                  </>
                )}
              </div>
            </div>
          )}

          {sol.permisos.cancelar && (
            <div className="border-t border-gray-100 pt-4 flex justify-end">
              <button
                disabled={trabajando}
                onClick={() => {
                  if (window.confirm(`¿Cancelar la solicitud ${sol.folio}? Ya no le llegará a tu gerente.`)) {
                    accion(() => comprasService.cancelar(sol.id));
                  }
                }}
                className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                <Ban className="w-4 h-4" />
                Cancelar solicitud
              </button>
            </div>
          )}
        </div>
      )}

      {/* El gerente que pidió firma al mandar la orden; si el PIN falla, el error sale en la ventana */}
      {firmandoOrden && sol && (
        <ConfirmarFirma
          titulo="Firmar y mandar la orden de compra"
          como="Gerente del área (la pidió)"
          textoBoton="Firmar y mandar"
          onCerrar={() => setFirmandoOrden(false)}
          onConfirmar={async (pin) => {
            const r = await comprasService.enviarOrden(sol.id, { comentario: notaOrden, pin });
            setFirmandoOrden(false);
            setNotaOrden("");
            setAviso({ ok: true, texto: r.message });
            await cargar();
            onCambio();
          }}
        >
          <p>
            {sol.folio} · <b>{sol.cotizacion?.opciones.find((o) => o.id === sol.opcion_elegida_id)?.proveedor}</b> ·{" "}
            {dinero(sol.monto_elegido, sol.moneda_elegida)}
          </p>
        </ConfirmarFirma>
      )}
    </Modal>
  );
}

// ===========================================================================
// Página
// ===========================================================================

export default function SolicitudesCompraPage() {
  const [params, setParams] = useSearchParams();
  const [contexto, setContexto] = useState(null);
  const [filas, setFilas] = useState(null);
  const [error, setError] = useState(null);
  const [nueva, setNueva] = useState(false);
  const [aviso, setAviso] = useState(null);

  const vista = params.get("vista") || "mias";
  const abierta = params.get("id") ? Number(params.get("id")) : null;
  const esBandeja = vista !== "mias";

  const cambiarParams = (cambios) => {
    const p = new URLSearchParams(params);
    for (const [k, v] of Object.entries(cambios)) {
      if (v == null) p.delete(k);
      else p.set(k, v);
    }
    setParams(p, { replace: true });
  };

  const cargarContexto = useCallback(async () => {
    try {
      setContexto(await comprasService.getContexto());
    } catch (e) {
      setError(mensajeError(e));
    }
  }, []);

  const cargarFilas = useCallback(async () => {
    setFilas(null);
    try {
      setFilas(await comprasService.getSolicitudes(vista));
    } catch (e) {
      setError(mensajeError(e));
    }
  }, [vista]);

  useEffect(() => {
    cargarContexto();
  }, [cargarContexto]);

  useEffect(() => {
    cargarFilas();
  }, [cargarFilas]);

  const refrescar = () => {
    cargarContexto();
    cargarFilas();
  };

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 text-red-700 p-4 rounded-xl">{error}</div>
      </div>
    );
  }
  if (!contexto) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  const apruebaAlgo = contexto.aprueba.length > 0;
  const varias = contexto.aprueba.length > 1;

  const pestanas = [
    { id: "mias", texto: "Mis solicitudes", icono: ShoppingCart, contador: contexto.porElegir + (contexto.porEnviarOrden || 0) },
    ...(apruebaAlgo
      ? [
          { id: "pendientes", texto: "Por aprobar", icono: Inbox, contador: contexto.pendientes },
          { id: "decididas", texto: "Ya decididas", icono: History },
        ]
      : []),
  ];

  return (
    <div className="p-6 space-y-5 max-w-6xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-[#236093]/10 rounded-lg">
            <ShoppingCart className="w-6 h-6 text-[#236093]" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Solicitudes de Compra</h1>
            <p className="text-sm text-gray-500">
              {contexto.area
                ? <>Tu área: {contexto.area.nombre}{contexto.area.gerente_nombre && <> · aprueba {contexto.area.gerente_nombre}</>}</>
                : "Pide a Compras con la autorización de tu gerente"}
            </p>
          </div>
        </div>

        <button
          onClick={() => setNueva(true)}
          disabled={!contexto.puedePedir}
          className="flex items-center gap-2 px-4 py-2 text-sm bg-[#236093] text-white rounded-lg hover:bg-[#1c4d76] disabled:opacity-50"
        >
          <Plus className="w-4 h-4" />
          Nueva solicitud
        </button>
      </div>

      {!contexto.puedePedir && (
        <div className="flex items-start gap-2 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          {!contexto.area
            ? "Tu área todavía no está dada de alta para pedir a Compras. Pídele a TI que la configure."
            : `El área "${contexto.area.nombre}" todavía no tiene quién apruebe. Pídele a TI que la configure.`}
        </div>
      )}

      {contexto.porElegir > 0 && (
        <div className="flex items-center gap-2 text-sm text-violet-800 bg-violet-50 border border-violet-200 rounded-xl px-4 py-3">
          <Scale className="w-4 h-4 shrink-0" />
          {contexto.porElegir === 1
            ? "Compras te mandó opciones de proveedores en una solicitud: ábrela y da tu sugerencia técnica."
            : `Compras te mandó opciones de proveedores en ${contexto.porElegir} solicitudes: ábrelas y da tu sugerencia técnica.`}
        </div>
      )}

      {contexto.porEnviarOrden > 0 && (
        <div className="flex items-center gap-2 text-sm text-[#236093] bg-[#236093]/5 border border-[#236093]/20 rounded-xl px-4 py-3">
          <FileSignature className="w-4 h-4 shrink-0" />
          {contexto.porEnviarOrden === 1
            ? "Compras ya decidió una de tus solicitudes: ábrela y manda la orden de compra."
            : `Compras ya decidió ${contexto.porEnviarOrden} de tus solicitudes: ábrelas y manda la orden de compra.`}
        </div>
      )}

      {aviso && (
        <div className="flex items-center justify-between gap-2 text-sm text-green-800 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
          <span>{aviso}</span>
          <button onClick={() => setAviso(null)} className="text-green-700/60 hover:text-green-800">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {pestanas.length > 1 && (
        <div className="flex gap-1 border-b border-gray-200">
          {pestanas.map((p) => {
            const Icono = p.icono;
            const activa = vista === p.id;
            return (
              <button
                key={p.id}
                onClick={() => cambiarParams({ vista: p.id === "mias" ? null : p.id, id: null })}
                className={`flex items-center gap-2 px-4 py-2 text-sm border-b-2 -mb-px ${
                  activa
                    ? "border-[#236093] text-[#236093] font-medium"
                    : "border-transparent text-gray-500 hover:text-gray-800"
                }`}
              >
                <Icono className="w-4 h-4" />
                {p.texto}
                {p.contador > 0 && (
                  <span className="px-1.5 py-0.5 text-xs rounded-full bg-amber-500 text-white">{p.contador}</span>
                )}
              </button>
            );
          })}
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
        {!filas ? (
          <div className="py-12 flex justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        ) : filas.length === 0 ? (
          <div className="py-12 text-center text-sm text-gray-400">
            {vista === "pendientes"
              ? "No tienes nada esperando tu aprobación"
              : vista === "decididas"
                ? "Todavía no has decidido ninguna solicitud"
                : "Todavía no has hecho ninguna solicitud"}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b border-gray-100">
                <th className="px-4 py-2.5 font-medium">Folio</th>
                <th className="px-4 py-2.5 font-medium">Asunto</th>
                {esBandeja && <th className="px-4 py-2.5 font-medium">Pidió</th>}
                {esBandeja && varias && <th className="px-4 py-2.5 font-medium">Área</th>}
                <th className="px-4 py-2.5 font-medium">{vista === "decididas" ? "Decidida" : "Fecha"}</th>
                <th className="px-4 py-2.5 font-medium">Estado</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((s) => (
                <tr
                  key={s.id}
                  onClick={() => cambiarParams({ id: s.id })}
                  className="border-b border-gray-50 last:border-0 hover:bg-gray-50 cursor-pointer"
                >
                  <td className="px-4 py-2.5 font-mono text-xs text-gray-500 whitespace-nowrap">{s.folio}</td>
                  <td className="px-4 py-2.5 text-gray-900">
                    <span className="inline-flex items-center gap-1.5">
                      {s.asunto}
                      {s.archivos > 0 && (
                        <span className="inline-flex items-center text-xs text-gray-400" title={`${s.archivos} archivo(s)`}>
                          <Paperclip className="w-3.5 h-3.5" />
                          {s.archivos}
                        </span>
                      )}
                    </span>
                  </td>
                  {esBandeja && <td className="px-4 py-2.5 text-gray-600 whitespace-nowrap">{s.solicitante_nombre}</td>}
                  {esBandeja && varias && <td className="px-4 py-2.5 text-gray-500">{s.area_nombre}</td>}
                  <td className="px-4 py-2.5 text-gray-500 whitespace-nowrap">
                    {vista === "decididas" ? fecha(s.decidido_en) : fecha(s.creado_en)}
                    {vista === "pendientes" && <span className="block text-xs text-amber-600">{hace(s.creado_en)}</span>}
                  </td>
                  <td className="px-4 py-2.5 whitespace-nowrap">
                    <Estado estado={s.estado} />
                    {s.osticket_numero && <span className="ml-2 text-xs text-gray-500">{s.osticket_numero}</span>}
                    {["DECIDIDA", "ELEGIDA", "EN_FIRMAS", "AUTORIZADA", "NO_AUTORIZADA"].includes(s.estado) && s.monto_elegido != null && (
                      <span className="block text-xs text-gray-600 mt-0.5">{dinero(s.monto_elegido, s.moneda_elegida)}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {nueva && (
        <NuevaSolicitud
          contexto={contexto}
          onCerrar={() => setNueva(false)}
          onCreada={(r) => {
            setNueva(false);
            setAviso(
              r.estado === "APROBADA"
                ? `Solicitud ${r.folio} registrada. Como eres el gerente del área, quedó aprobada.`
                : `Solicitud ${r.folio} enviada. Aquí puedes ver en qué va.`,
            );
            if (vista !== "mias") cambiarParams({ vista: null });
            else refrescar();
          }}
        />
      )}

      {abierta && (
        <Detalle
          id={abierta}
          conexion={contexto.conexionOsticket}
          onCerrar={() => cambiarParams({ id: null })}
          onCambio={refrescar}
        />
      )}
    </div>
  );
}
