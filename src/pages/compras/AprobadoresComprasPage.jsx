import { useState, useEffect, useCallback } from "react";
import {
  UserCheck,
  Loader2,
  Save,
  AlertTriangle,
  CheckCircle2,
  Link2,
  Send,
  RefreshCw,
  PlugZap,
} from "lucide-react";
import { comprasService } from "../../services/compras.service";
import AvisosCompras from "../../components/compras/AvisosCompras";

/**
 * Quién aprueba las solicitudes de Compra de cada área.
 *
 * Cada área es un tema del osTicket de Compras (base osticketadm). Aquí se
 * asignan gerente y suplente, y qué áreas de DBX piden a través de cada una.
 * Vive en pantalla y no en código porque los gerentes cambian, y el arranque es
 * un piloto con TI al que se van sumando áreas.
 *
 * El aviso de "sin acceso al módulo" importa: la bandeja sale por dato, pero
 * para abrir la pantalla el ROL del gerente necesita el permiso de lectura de
 * "Solicitudes de Compra". Sin él tendría pendientes que nunca vería.
 */

const mensajeError = (e) => e.response?.data?.message || e.message;

const fecha = (s) =>
  s
    ? new Date(s).toLocaleString("es-MX", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

/**
 * Aprobadas que no han llegado a Compras.
 *
 * El envío se reintenta solo cada 5 minutos hasta `maxIntentos`; pasado eso se
 * queda aquí esperando a que alguien vea el error y dé "Reintentar". Lo normal
 * es que esta lista esté vacía.
 */
function Envios() {
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState(null);
  const [trabajando, setTrabajando] = useState(null);
  const [avisos, setAvisos] = useState({});

  const cargar = useCallback(async () => {
    try {
      setDatos(await comprasService.getEnvios());
    } catch (e) {
      setError(mensajeError(e));
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const reenviar = async (s) => {
    setTrabajando(s.id);
    try {
      const r = await comprasService.reenviar(s.id);
      setAvisos((a) => ({ ...a, [s.id]: { ok: true, texto: r.message } }));
    } catch (e) {
      setAvisos((a) => ({ ...a, [s.id]: { ok: false, texto: mensajeError(e) } }));
    } finally {
      setTrabajando(null);
      cargar();
    }
  };

  if (error) return <div className="bg-red-50 text-red-700 p-4 rounded-xl text-sm">{error}</div>;
  if (!datos) return null;

  const { conexion, porEnviar } = datos;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold text-gray-900 flex items-center gap-2">
            <Send className="w-4 h-4 text-[#236093]" />
            Envío a Compras
          </h2>
          <p className="text-xs text-gray-400 mt-0.5">
            Cada aprobada se vuelve ticket en el osTicket de Compras. Si no llega, se reintenta
            sola cada 5 min hasta {conexion.maxIntentos} veces.
          </p>
        </div>
        <span
          className={`inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-full ${
            conexion.configurada ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"
          }`}
        >
          <PlugZap className="w-3.5 h-3.5" />
          {conexion.configurada ? conexion.destino : "Sin conexión configurada"}
        </span>
      </div>

      {!conexion.configurada && (
        <p className="text-sm text-amber-800 bg-amber-50 rounded-lg px-3 py-2">
          Faltan OSTICKET_COMPRAS_API_URL y OSTICKET_COMPRAS_API_KEY en el servidor. Mientras
          tanto las solicitudes se aprueban, pero no llegan a Compras.
        </p>
      )}

      {porEnviar.length === 0 ? (
        <p className="text-sm text-gray-400">Todas las aprobadas ya llegaron a Compras.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 border-b border-gray-100">
              <th className="py-2 font-medium">Folio</th>
              <th className="py-2 font-medium">Solicitud</th>
              <th className="py-2 font-medium">Aprobada</th>
              <th className="py-2 font-medium">Último intento</th>
              <th className="py-2" />
            </tr>
          </thead>
          <tbody>
            {porEnviar.map((s) => (
              <tr key={s.id} className="border-b border-gray-50 last:border-0 align-top">
                <td className="py-2 font-mono text-xs text-gray-500">{s.folio}</td>
                <td className="py-2">
                  <p className="text-gray-900">{s.asunto}</p>
                  <p className="text-xs text-gray-400">
                    {s.solicitante_nombre} · {s.area_nombre}
                  </p>
                </td>
                <td className="py-2 text-gray-500 whitespace-nowrap">{fecha(s.decidido_en)}</td>
                <td className="py-2 text-xs">
                  {s.ultimo_error_envio ? (
                    <span className="text-red-600">{s.ultimo_error_envio}</span>
                  ) : (
                    <span className="text-gray-400">
                      {s.intentos_envio ? "En proceso" : "Sin intentar"}
                    </span>
                  )}
                  <span className="block text-gray-400">
                    {s.intentos_envio} intento{s.intentos_envio === 1 ? "" : "s"}
                  </span>
                  {avisos[s.id] && (
                    <span className={`block ${avisos[s.id].ok ? "text-green-700" : "text-red-600"}`}>
                      {avisos[s.id].texto}
                    </span>
                  )}
                </td>
                <td className="py-2 text-right">
                  <button
                    onClick={() => reenviar(s)}
                    disabled={!conexion.configurada || trabajando === s.id}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40"
                  >
                    {trabajando === s.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <RefreshCw className="w-3.5 h-3.5" />
                    )}
                    Reintentar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function SelectUsuario({ valor, onCambio, usuarios, excluir, vacio }) {
  return (
    <select
      value={valor ?? ""}
      onChange={(e) => onCambio(e.target.value ? Number(e.target.value) : null)}
      className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-[#236093]/30"
    >
      <option value="">{vacio}</option>
      {usuarios
        .filter((u) => u.id !== excluir)
        .map((u) => (
          <option key={u.id} value={u.id}>
            {u.nombre_completo}
            {u.area ? ` · ${u.area}` : ""}
          </option>
        ))}
    </select>
  );
}

function FilaArea({ area, usuarios, onGuardado }) {
  const [gerente, setGerente] = useState(area.gerente_id);
  const [suplente, setSuplente] = useState(area.suplente_id);
  const [activo, setActivo] = useState(area.activo);
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState(null);

  useEffect(() => {
    setGerente(area.gerente_id);
    setSuplente(area.suplente_id);
    setActivo(area.activo);
  }, [area]);

  const cambiado =
    gerente !== area.gerente_id || suplente !== area.suplente_id || activo !== area.activo;

  const sinModulo = [gerente, suplente]
    .filter(Boolean)
    .map((id) => usuarios.find((u) => u.id === id))
    .filter((u) => u && !u.tiene_modulo);

  const guardar = async () => {
    setGuardando(true);
    setAviso(null);
    try {
      await comprasService.guardarArea(area.id, {
        gerenteId: gerente,
        suplenteId: gerente ? suplente : null,
        activo,
      });
      setAviso({ ok: true, texto: "Guardado" });
      await onGuardado();
    } catch (e) {
      setAviso({ ok: false, texto: mensajeError(e) });
    } finally {
      setGuardando(false);
    }
  };

  return (
    <tr className="border-b border-gray-50 last:border-0 align-top">
      <td className="px-4 py-3">
        <p className="font-medium text-gray-900">{area.nombre}</p>
        <p className="text-xs text-gray-400">
          tema {area.osticket_topic_id}
          {area.pendientes > 0 && <span className="text-amber-600"> · {area.pendientes} pendiente(s)</span>}
        </p>
        {area.areas_dbx.length > 0 && (
          <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
            <Link2 className="w-3 h-3" />
            {area.areas_dbx.map((a) => a.nombre).join(", ")}
          </p>
        )}
      </td>
      <td className="px-4 py-3 min-w-56">
        <SelectUsuario valor={gerente} onCambio={setGerente} usuarios={usuarios} excluir={suplente} vacio="— Sin gerente —" />
      </td>
      <td className="px-4 py-3 min-w-56">
        <SelectUsuario
          valor={gerente ? suplente : null}
          onCambio={setSuplente}
          usuarios={usuarios}
          excluir={gerente}
          vacio={gerente ? "— Sin suplente —" : "Primero el gerente"}
        />
        {sinModulo.map((u) => (
          <p key={u.id} className="text-xs text-amber-700 mt-1 flex items-start gap-1">
            <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
            El rol de {u.nombre_completo} ({u.rol}) no puede abrir "Solicitudes de Compra": no vería su bandeja.
          </p>
        ))}
      </td>
      <td className="px-4 py-3 text-center">
        <input
          type="checkbox"
          checked={activo}
          onChange={(e) => setActivo(e.target.checked)}
          className="rounded border-gray-300 mt-2"
        />
      </td>
      <td className="px-4 py-3 text-right whitespace-nowrap">
        <button
          onClick={guardar}
          disabled={!cambiado || guardando}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-[#236093] text-white rounded-lg hover:bg-[#1c4d76] disabled:opacity-40"
        >
          {guardando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Guardar
        </button>
        {aviso && (
          <p className={`text-xs mt-1 ${aviso.ok ? "text-green-700" : "text-red-600"}`}>
            {aviso.ok && <CheckCircle2 className="w-3 h-3 inline mr-1" />}
            {aviso.texto}
          </p>
        )}
      </td>
    </tr>
  );
}

export default function AprobadoresComprasPage() {
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState(null);
  const [avisoDbx, setAvisoDbx] = useState(null);

  const cargar = useCallback(async () => {
    try {
      setDatos(await comprasService.getAprobadores());
    } catch (e) {
      setError(mensajeError(e));
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const ligar = async (areaDbx, comprasAreaId) => {
    setAvisoDbx(null);
    try {
      await comprasService.ligarAreaDbx(areaDbx.id, comprasAreaId);
      await cargar();
    } catch (e) {
      setAvisoDbx(mensajeError(e));
    }
  };

  if (error) {
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

  const configuradas = datos.areas.filter((a) => a.activo && a.gerente_id).length;

  return (
    <div className="p-6 space-y-5 max-w-6xl mx-auto">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-[#236093]/10 rounded-lg">
          <UserCheck className="w-6 h-6 text-[#236093]" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Aprobadores de Compras</h1>
          <p className="text-sm text-gray-500">
            {configuradas} de {datos.areas.length} áreas pueden pedir. Un área sin gerente no
            puede pedir: así nadie manda solicitudes que nadie va a ver.
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 border-b border-gray-100">
              <th className="px-4 py-2.5 font-medium">Área de Compras</th>
              <th className="px-4 py-2.5 font-medium">Gerente</th>
              <th className="px-4 py-2.5 font-medium">Suplente</th>
              <th className="px-4 py-2.5 font-medium text-center">Activa</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {datos.areas.map((a) => (
              <FilaArea key={a.id} area={a} usuarios={datos.usuarios} onGuardado={cargar} />
            ))}
          </tbody>
        </table>
      </div>

      <Envios />

      <AvisosCompras />

      {/* --- Áreas de DBX --- */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <h2 className="font-semibold text-gray-900">Áreas de DBX</h2>
        <p className="text-xs text-gray-400 mt-0.5">
          El área de la solicitud sale del usuario. Aquí se dice a qué área de Compras pide
          cada área de DBX; varias pueden caer en la misma.
        </p>
        {avisoDbx && <p className="text-sm text-red-600 mt-2">{avisoDbx}</p>}
        <div className="mt-4 grid grid-cols-1 xl:grid-cols-2 gap-3">
          {datos.areasDbx.map((a) => (
            <div
              key={a.id}
              className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 bg-gray-50 rounded-lg px-3 py-2"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800">{a.nombre}</p>
                <p className="text-xs text-gray-400">{a.usuarios} usuario(s)</p>
              </div>
              <select
                value={a.compras_area_id ?? ""}
                onChange={(e) => ligar(a, e.target.value ? Number(e.target.value) : null)}
                className="w-full sm:w-64 shrink-0 text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white"
              >
                <option value="">— No pide a Compras —</option>
                {datos.areas.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
