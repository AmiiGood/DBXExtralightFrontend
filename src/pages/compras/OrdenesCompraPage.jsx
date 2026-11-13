import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { FileSignature, Loader2, X, Inbox, History, ListChecks, PenLine, XCircle, CheckCircle2, Hourglass, Info } from "lucide-react";
import { comprasService } from "../../services/compras.service";
import Comparativo from "../../components/compras/Comparativo";
import PresupuestoArea from "../../components/compras/PresupuestoArea";
import FirmasOrden from "../../components/compras/FirmasOrden";
import { SelectTipo, ComboCuenta } from "../../components/compras/CamposCatalogo";
import ConfirmarFirma from "../../components/firmas/ConfirmarFirma";
import BotonPdfOrden from "../../components/compras/BotonPdfOrden";
import { dinero } from "../../components/compras/formatoCompras";

/**
 * Órdenes de compra.
 *
 * Decidida la opción, quien pidió manda la orden de compra y la firman, en
 * este orden: el gerente del área (o su suplente), el jefe de Compras (pone el
 * tipo), Finanzas (pone la cuenta y el centro de costos) y Dirección (si el
 * monto llega al mínimo). Cualquier rechazo la termina.
 *
 * Quién firma no sale del rol: es el gerente del área y las listas de
 * firmantes de Aprobadores. Acepta ?id=N para los correos.
 */

const PESTANAS = [
  { id: "por-firmar", texto: "Por firmar", icono: Inbox },
  { id: "firmadas", texto: "Firmadas por mí", icono: History },
  { id: "todas", texto: "Todas", icono: ListChecks, soloConPermiso: true },
];

const PASO = { GERENTE: "el gerente", COMPRAS: "Compras", FINANZAS: "Finanzas", DIRECCION: "Dirección" };

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

function EstadoOrden({ o }) {
  if (o.estado === "AUTORIZADA") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full border bg-green-50 text-green-700 border-green-200">
        <CheckCircle2 className="w-3 h-3" />
        Autorizada
      </span>
    );
  }
  if (o.estado === "RECHAZADA") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full border bg-red-50 text-red-700 border-red-200">
        <XCircle className="w-3 h-3" />
        Rechazada
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full border bg-amber-50 text-amber-700 border-amber-200">
      <Hourglass className="w-3 h-3" />
      Firma {PASO[o.paso]}
    </span>
  );
}

function Detalle({ id, onCerrar, onCambio }) {
  const [o, setO] = useState(null);
  const [error, setError] = useState(null);
  const [aviso, setAviso] = useState(null);
  const [version, setVersion] = useState(0);
  // Lo que pone quien firma
  const [tipo, setTipo] = useState("");
  const [cuenta, setCuenta] = useState("");
  const [cc, setCc] = useState("");
  const [comentario, setComentario] = useState("");
  const [firmando, setFirmando] = useState(false);
  const [rechazando, setRechazando] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [trabajando, setTrabajando] = useState(false);
  const [errorAccion, setErrorAccion] = useState(null);

  useEffect(() => {
    let vivo = true;
    comprasService
      .getOrden(id)
      .then((r) => vivo && setO(r))
      .catch((e) => vivo && setError(mensajeError(e)));
    return () => {
      vivo = false;
    };
  }, [id, version]);

  useEffect(() => {
    const esc = (e) => e.key === "Escape" && !firmando && onCerrar();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onCerrar, firmando]);

  const terminar = (mensaje) => {
    setAviso(mensaje);
    setFirmando(false);
    setRechazando(false);
    setMotivo("");
    setComentario("");
    setErrorAccion(null);
    setVersion((v) => v + 1);
    onCambio();
  };

  // Antes de pedir el PIN: que no falte lo que pone cada quien
  const faltante = o?.paso === "COMPRAS" && !tipo ? "Escoge el tipo de compra" : o?.paso === "FINANZAS" && !cuenta ? "Escoge la cuenta" : null;

  async function firmar(pin) {
    const r = await comprasService.firmarOrden(o.id, { pin, tipo, cuenta, centroCostos: cc, comentario });
    terminar(r.message);
  }

  async function rechazar() {
    setTrabajando(true);
    setErrorAccion(null);
    try {
      const r = await comprasService.rechazarOrden(o.id, motivo);
      terminar(r.message);
    } catch (e) {
      setErrorAccion(mensajeError(e));
    } finally {
      setTrabajando(false);
    }
  }

  const p = o?.presupuesto;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-6xl my-6">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">{o ? `Orden de compra · ${o.folio} · ${o.asunto}` : "Orden de compra"}</h2>
          <button onClick={onCerrar} className="p-1 rounded-lg text-gray-400 hover:bg-gray-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        {error ? (
          <div className="p-5 text-sm text-red-700">{error}</div>
        ) : !o ? (
          <div className="p-10 flex justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        ) : (
          <div className="p-5 space-y-5">
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-gray-500">
              <EstadoOrden o={o} />
              <span>
                Pidió <b className="text-gray-800">{o.solicitante_nombre}</b> · {o.area_nombre}
              </span>
              <span>
                Ticket <b className="text-gray-800">{o.osticket_numero}</b>
                {o.asignado_nombre && ` · lo atiende ${o.asignado_nombre}`}
              </span>
              <span>Enviada {fecha(o.enviada_en)}</span>
              <span className="ml-auto">
                <BotonPdfOrden ordenId={o.id} />
              </span>
            </div>

            {aviso && <div className="text-sm rounded-lg px-3 py-2 bg-green-50 text-green-800">{aviso}</div>}

            <div className="rounded-lg border border-gray-200 px-4 py-3 space-y-1">
              <p className="text-sm text-gray-800">
                Comprar a <b>{o.proveedor}</b> por <b>{dinero(o.monto, o.moneda)}</b> {o.incluye_iva ? "con IVA" : "+ IVA"}
              </p>
              {o.comentario && <p className="text-sm text-gray-600 italic">“{o.comentario}” — {o.solicitante_nombre}</p>}
              <p className="text-xs text-gray-500 whitespace-pre-wrap">{o.detalle}</p>
            </div>

            {p && (
              <div className="space-y-1">
                <PresupuestoArea saldo={p.saldo} area={o.area_nombre} />
                {p.descontado ? (
                  <p className="text-xs text-gray-500 px-1">
                    Al autorizarse se descontaron {dinero(p.monto)} del presupuesto del área (sin IVA, en pesos).
                  </p>
                ) : (
                  p.monto != null && (
                    <p className={`text-xs px-1 ${p.rebasa ? "text-red-700" : "text-gray-500"}`}>
                      Al quedar autorizada se descontarían {dinero(p.monto)} (sin IVA, en pesos
                      {p.tipoCambio && `, con el FIX de ${p.tipoCambio.valor} del ${p.tipoCambio.fecha}`}).
                      {p.saldo.configurado &&
                        (p.rebasa
                          ? ` Rebasa lo disponible: quedaría en ${dinero(p.quedaMes)} este mes.`
                          : ` Quedarían ${dinero(p.quedaMes)} este mes.`)}
                    </p>
                  )
                )}
              </div>
            )}

            <div>
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Firmas</h3>
              <FirmasOrden orden={o} />
            </div>

            {/* --- Le toca firmar --- */}
            {o.permisos.firmar && (
              <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-4 space-y-3">
                <p className="text-sm font-medium text-gray-900 flex items-center gap-2">
                  <PenLine className="w-4 h-4 text-amber-600" />
                  Te toca firmar como {o.permisos.comoTexto}
                </p>
                {o.paso === "COMPRAS" && (
                  <label className="block max-w-sm">
                    <span className="block text-xs font-medium text-gray-500 mb-1">Tipo de compra</span>
                    <SelectTipo valor={tipo} tipos={o.catalogos?.tipos || []} onCambiar={setTipo} />
                  </label>
                )}
                {o.paso === "FINANZAS" && (
                  <div className="grid grid-cols-1 sm:grid-cols-[2fr_1fr] gap-3">
                    <label className="block">
                      <span className="block text-xs font-medium text-gray-500 mb-1">Cuenta</span>
                      <ComboCuenta valor={cuenta} cuentas={o.catalogos?.cuentas || []} onCambiar={setCuenta} />
                    </label>
                    <label className="block">
                      <span className="block text-xs font-medium text-gray-500 mb-1">Centro de costos</span>
                      <input
                        value={cc}
                        onChange={(e) => setCc(e.target.value)}
                        maxLength={60}
                        className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-[#236093]/30"
                      />
                    </label>
                  </div>
                )}
                {o.paso === "FINANZAS" && o.montoMinimoDireccion > 0 && (
                  <p className="text-xs text-gray-500">
                    Dirección firma si la orden llega a {dinero(o.montoMinimoDireccion)} sin IVA; abajo de eso queda autorizada con tu firma.
                  </p>
                )}

                {rechazando ? (
                  <div className="space-y-2">
                    <textarea
                      value={motivo}
                      onChange={(e) => setMotivo(e.target.value)}
                      rows={2}
                      maxLength={1000}
                      autoFocus
                      placeholder="¿Por qué la rechazas? (obligatorio). La orden y la solicitud terminan aquí."
                      className="w-full text-sm border border-red-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-red-200"
                    />
                    <div className="flex justify-end gap-2">
                      <button onClick={() => setRechazando(false)} className="px-4 py-2 text-sm text-gray-600 rounded-lg hover:bg-gray-100">
                        Volver
                      </button>
                      <button
                        onClick={rechazar}
                        disabled={trabajando || !motivo.trim()}
                        className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                      >
                        {trabajando ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                        Rechazar la orden
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <textarea
                      value={comentario}
                      onChange={(e) => setComentario(e.target.value)}
                      rows={2}
                      maxLength={1000}
                      placeholder="Comentario (opcional)"
                      className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-[#236093]/30"
                    />
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      {faltante && <span className="text-xs text-amber-700 mr-auto">{faltante} para poder firmar.</span>}
                      <button
                        onClick={() => setRechazando(true)}
                        className="inline-flex items-center gap-2 px-4 py-2 text-sm text-red-700 border border-red-200 rounded-lg hover:bg-red-50"
                      >
                        <XCircle className="w-4 h-4" />
                        Rechazar
                      </button>
                      <button
                        onClick={() => setFirmando(true)}
                        disabled={Boolean(faltante)}
                        className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-[#236093] text-white rounded-lg hover:bg-[#1c4d76] disabled:opacity-40"
                      >
                        <PenLine className="w-4 h-4" />
                        Firmar
                      </button>
                    </div>
                  </>
                )}
                {errorAccion && <p className="text-sm text-red-700 bg-red-50 rounded-lg px-3 py-2">{errorAccion}</p>}
              </div>
            )}
            {!o.permisos.firmar && o.permisos.porque && (
              <p className="flex items-center gap-2 text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
                <Info className="w-4 h-4 shrink-0" />
                {o.permisos.porque}
              </p>
            )}

            {o.cotizacion && (
              <div className="space-y-2">
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Opciones que cotizó Compras</h3>
                <Comparativo cotizacion={o.cotizacion} elegidaId={o.opcion_id} />
              </div>
            )}
          </div>
        )}
      </div>

      {firmando && o && (
        <ConfirmarFirma
          titulo="Firmar la orden de compra"
          como={o.permisos.comoTexto}
          textoBoton="Firmar"
          onConfirmar={firmar}
          onCerrar={() => setFirmando(false)}
        >
          <p>
            {o.folio} · <b>{o.proveedor}</b> · {dinero(o.monto, o.moneda)} {o.incluye_iva ? "con IVA" : "+ IVA"}
          </p>
          {tipo && <p className="text-gray-500">Tipo: {tipo}</p>}
          {cuenta && (
            <p className="text-gray-500">
              Cuenta: {cuenta}
              {cc && ` · CC: ${cc}`}
            </p>
          )}
        </ConfirmarFirma>
      )}
    </div>
  );
}

export default function OrdenesCompraPage() {
  const [params, setParams] = useSearchParams();
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState(null);
  const [version, setVersion] = useState(0);
  const recargar = useCallback(() => setVersion((v) => v + 1), []);

  const pedida = params.get("vista");
  const vista = PESTANAS.some((p) => p.id === pedida) ? pedida : "por-firmar";
  const abierta = params.get("id") ? Number(params.get("id")) : null;

  const cambiarParams = (cambios) => {
    const p = new URLSearchParams(params);
    for (const [k, v] of Object.entries(cambios)) {
      if (v == null) p.delete(k);
      else p.set(k, v);
    }
    setParams(p, { replace: true });
  };

  useEffect(() => {
    let vivo = true;
    comprasService
      .getOrdenes(vista)
      .then((r) => {
        if (!vivo) return;
        setDatos({ ...r, vista });
        setError(null);
      })
      .catch((e) => vivo && setError(mensajeError(e)));
    return () => {
      vivo = false;
    };
  }, [vista, version]);

  const listos = datos?.vista === vista;

  return (
    <div className="p-6 space-y-5 max-w-6xl mx-auto">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-[#236093]/10 rounded-lg">
          <FileSignature className="w-6 h-6 text-[#236093]" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Órdenes de compra</h1>
          <p className="text-sm text-gray-500">
            Firman el gerente del área, Compras (tipo), Finanzas (cuenta y CC) y Dirección, en ese orden.
          </p>
        </div>
      </div>

      {error && <div className="bg-red-50 text-red-700 p-3 rounded-xl text-sm">{error}</div>}

      <div className="flex gap-1 border-b border-gray-200">
        {PESTANAS.filter((p) => !p.soloConPermiso || datos?.verTodas).map((p) => {
          const Icono = p.icono;
          const n = p.id === "por-firmar" ? datos?.porFirmar : 0;
          return (
            <button
              key={p.id}
              onClick={() => cambiarParams({ vista: p.id === "por-firmar" ? null : p.id, id: null })}
              className={`flex items-center gap-2 px-4 py-2 text-sm border-b-2 -mb-px ${
                vista === p.id ? "border-[#236093] text-[#236093] font-medium" : "border-transparent text-gray-500 hover:text-gray-800"
              }`}
            >
              <Icono className="w-4 h-4" />
              {p.texto}
              {n > 0 && <span className="px-1.5 py-0.5 text-xs rounded-full text-white bg-amber-500">{n}</span>}
            </button>
          );
        })}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
        {!listos ? (
          <div className="py-12 flex justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        ) : datos.ordenes.length === 0 ? (
          <div className="py-12 text-center text-sm text-gray-400">
            {
              {
                "por-firmar": "No tienes órdenes de compra por firmar",
                firmadas: "Todavía no has firmado ninguna orden",
                todas: "Todavía no hay órdenes de compra",
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
                <th className="px-4 py-2.5 font-medium text-right">Monto</th>
                <th className="px-4 py-2.5 font-medium">Estado</th>
                <th className="px-4 py-2.5 font-medium">Enviada</th>
              </tr>
            </thead>
            <tbody>
              {datos.ordenes.map((o) => (
                <tr
                  key={o.id}
                  onClick={() => cambiarParams({ id: o.id })}
                  className="border-b border-gray-50 last:border-0 hover:bg-gray-50 cursor-pointer"
                >
                  <td className="px-4 py-2.5 whitespace-nowrap">
                    <span className="font-medium text-gray-900">{o.osticket_numero}</span>
                    <span className="block font-mono text-xs text-gray-400">{o.folio}</span>
                  </td>
                  <td className="px-4 py-2.5 text-gray-900">
                    {o.asunto}
                    <span className="block text-xs text-gray-500">{o.proveedor}</span>
                  </td>
                  <td className="px-4 py-2.5 text-gray-600">
                    {o.solicitante_nombre}
                    <span className="block text-xs text-gray-400">{o.area_nombre}</span>
                  </td>
                  <td className="px-4 py-2.5 text-right whitespace-nowrap text-gray-900">
                    {dinero(o.monto, o.moneda)}
                    <span className="block text-xs text-gray-400">{o.incluye_iva ? "con IVA" : "+ IVA"}</span>
                  </td>
                  <td className="px-4 py-2.5">
                    <EstadoOrden o={o} />
                  </td>
                  <td className="px-4 py-2.5 text-gray-500 whitespace-nowrap">
                    {fecha(o.enviada_en)}
                    {o.estado === "EN_FIRMAS" && <span className="block text-xs text-amber-600">{hace(o.enviada_en)}</span>}
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
