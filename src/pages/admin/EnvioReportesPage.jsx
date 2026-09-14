import { useState, useEffect, useCallback } from "react";
import {
  Mail,
  Plus,
  Trash2,
  Send,
  Users,
  CalendarClock,
  History,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Power,
} from "lucide-react";
import { envioReportesService } from "../../services/envioReportes.service";

/**
 * Envío de reportes por correo.
 *
 * Tres pestañas: las listas de destinatarios, las programaciones y la bitácora.
 * Los destinatarios salen únicamente de las listas — no hay campo libre para
 * escribir un correo suelto.
 */

const DIAS = [
  { v: 1, t: "Lunes" },
  { v: 2, t: "Martes" },
  { v: 3, t: "Miércoles" },
  { v: 4, t: "Jueves" },
  { v: 5, t: "Viernes" },
  { v: 6, t: "Sábado" },
  { v: 0, t: "Domingo" },
];

const PERIODOS = [
  { v: "SEMANA_ANTERIOR", t: "La semana anterior" },
  { v: "MES_ANTERIOR", t: "El mes anterior" },
  { v: "MES_ACTUAL", t: "El mes en curso" },
  { v: "TRIMESTRE_ANTERIOR", t: "El trimestre anterior" },
  { v: "ANIO_ACTUAL", t: "El año en curso" },
];

const fechaHora = (v) =>
  v ? new Date(v).toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" }) : "—";

function Aviso({ aviso }) {
  if (!aviso) return null;
  const estilos = {
    ok: "bg-green-50 border-green-200 text-green-700",
    error: "bg-red-50 border-red-200 text-red-700",
    info: "bg-blue-50 border-blue-200 text-blue-700",
  };
  const Icono = aviso.tipo === "ok" ? CheckCircle2 : AlertTriangle;
  return (
    <div className={`rounded-xl p-3 text-sm flex items-start gap-2 border ${estilos[aviso.tipo]}`}>
      <Icono className="w-4 h-4 mt-0.5 flex-shrink-0" />
      <span>{aviso.texto}</span>
    </div>
  );
}

export default function EnvioReportesPage() {
  const [pestana, setPestana] = useState("programaciones");
  const [listas, setListas] = useState([]);
  const [programaciones, setProgramaciones] = useState([]);
  const [planificador, setPlanificador] = useState([]);
  const [envios, setEnvios] = useState([]);
  const [aviso, setAviso] = useState(null);
  const [ocupado, setOcupado] = useState(null);
  const [conexion, setConexion] = useState(null);

  const [listaAbierta, setListaAbierta] = useState(null);
  const [formLista, setFormLista] = useState({ nombre: "", descripcion: "" });
  const [formMiembro, setFormMiembro] = useState({ nombre: "", correo: "" });
  const [formProg, setFormProg] = useState({
    nombre: "",
    listaId: "",
    periodoRelativo: "SEMANA_ANTERIOR",
    frecuencia: "SEMANAL",
    dia: 1,
    hora: 8,
    minuto: 0,
    asunto: "",
    mensaje: "",
  });

  const error = (e) =>
    setAviso({
      tipo: "error",
      texto:
        e.response?.data?.errors?.[0]?.msg ||
        e.response?.data?.message ||
        e.message,
    });

  const cargar = useCallback(async () => {
    try {
      const [ls, ps, es] = await Promise.all([
        envioReportesService.getListas(),
        envioReportesService.getProgramaciones(),
        envioReportesService.getEnvios(30),
      ]);
      setListas(ls);
      setProgramaciones(ps.programaciones);
      setPlanificador(ps.planificador || []);
      setEnvios(es);
    } catch (e) {
      error(e);
    }
  }, []);

  useEffect(() => {
    cargar();
    envioReportesService
      .probarConexion()
      .then(setConexion)
      .catch(() => setConexion({ ok: false }));
  }, [cargar]);

  const accion = async (clave, fn, exito) => {
    setOcupado(clave);
    setAviso(null);
    try {
      const r = await fn();
      if (exito) setAviso({ tipo: "ok", texto: exito(r) });
      await cargar();
      return r;
    } catch (e) {
      error(e);
    } finally {
      setOcupado(null);
    }
  };

  const abrirLista = async (id) => {
    if (listaAbierta?.id === id) return setListaAbierta(null);
    try {
      setListaAbierta(await envioReportesService.getLista(id));
    } catch (e) {
      error(e);
    }
  };

  const proxima = (id) =>
    planificador.find((p) => p.programadoId === id)?.proximaEjecucion;

  return (
    <div className="space-y-5">
      {/* Encabezado */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center">
            <Mail className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Envío de Reportes</h1>
            <p className="text-sm text-gray-500">
              Listas de correo y programación automática
            </p>
          </div>
        </div>
        {conexion && (
          <span
            className={`px-3 py-1.5 rounded-full text-xs font-medium ${
              conexion.ok
                ? "bg-green-50 text-green-700"
                : "bg-red-50 text-red-700"
            }`}
            title={conexion.remitente}
          >
            {conexion.ok
              ? `Correo conectado · ${conexion.modo}`
              : "Sin conexión al servidor de correo"}
          </span>
        )}
      </div>

      <Aviso aviso={aviso} />

      {/* Pestañas */}
      <div className="flex gap-1 border-b border-gray-200">
        {[
          { id: "programaciones", t: "Programaciones", Icono: CalendarClock },
          { id: "listas", t: "Listas de correo", Icono: Users },
          { id: "bitacora", t: "Bitácora", Icono: History },
        ].map(({ id, t, Icono }) => (
          <button
            key={id}
            onClick={() => setPestana(id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              pestana === id
                ? "border-primary text-primary"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            <Icono className="w-4 h-4" />
            {t}
          </button>
        ))}
      </div>

      {/* ------------------------------------------------ PROGRAMACIONES */}
      {pestana === "programaciones" && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            {programaciones.length === 0 ? (
              <p className="p-8 text-center text-gray-400 text-sm">
                Todavía no hay programaciones
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    {["Reporte", "Cuándo", "Periodo", "Lista", "Último envío", ""].map(
                      (h) => (
                        <th
                          key={h}
                          className="px-3 py-2 text-left text-[11px] font-semibold text-gray-500 uppercase"
                        >
                          {h}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {programaciones.map((p) => (
                    <tr key={p.id} className={p.activo ? "" : "opacity-50"}>
                      <td className="px-3 py-2.5">
                        <p className="font-medium text-gray-900">{p.nombre}</p>
                        <p className="text-[11px] text-gray-400">
                          {p.formato} · {p.expresion_cron}
                        </p>
                      </td>
                      <td className="px-3 py-2.5 text-gray-600">
                        {p.horario}
                        {proxima(p.id) && (
                          <p className="text-[11px] text-gray-400">
                            próximo: {fechaHora(proxima(p.id))}
                          </p>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-gray-600">
                        {PERIODOS.find((x) => x.v === p.periodo_relativo)?.t ||
                          p.periodo_relativo}
                      </td>
                      <td className="px-3 py-2.5 text-gray-600">
                        {p.lista_nombre}
                        <span className="text-gray-400"> ({p.destinatarios})</span>
                      </td>
                      <td className="px-3 py-2.5">
                        {p.ultimo_envio ? (
                          <>
                            <span
                              className={
                                p.ultimo_estado === "ENVIADO"
                                  ? "text-green-600"
                                  : "text-red-600"
                              }
                            >
                              {p.ultimo_estado}
                            </span>
                            <p className="text-[11px] text-gray-400">
                              {fechaHora(p.ultimo_envio)}
                            </p>
                          </>
                        ) : (
                          <span className="text-gray-300">nunca</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap text-right">
                        <button
                          onClick={() =>
                            accion(
                              `probar-${p.id}`,
                              () => envioReportesService.probar(p.id, true),
                              (r) =>
                                `Enviado a ${r.destinatarios.join(", ")} — ${r.periodo}, ${r.bytes} bytes`,
                            )
                          }
                          disabled={ocupado === `probar-${p.id}`}
                          className="p-1.5 text-gray-400 hover:text-primary disabled:opacity-40"
                          title="Enviármelo a mí ahora, para probar"
                        >
                          {ocupado === `probar-${p.id}` ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Send className="w-4 h-4" />
                          )}
                        </button>
                        <button
                          onClick={() =>
                            accion(
                              `activo-${p.id}`,
                              () =>
                                envioReportesService.actualizarProgramacion(p.id, {
                                  nombre: p.nombre,
                                  listaId: p.lista_id,
                                  frecuencia: p.frecuencia,
                                  dia: p.dia,
                                  hora: p.hora,
                                  minuto: p.minuto,
                                  activo: !p.activo,
                                }),
                              () => (p.activo ? "Programación pausada" : "Programación activada"),
                            )
                          }
                          className={`p-1.5 ${p.activo ? "text-green-500" : "text-gray-300"} hover:text-primary`}
                          title={p.activo ? "Pausar" : "Activar"}
                        >
                          <Power className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() =>
                            accion(
                              `del-${p.id}`,
                              () => envioReportesService.eliminarProgramacion(p.id),
                              () => "Programación eliminada",
                            )
                          }
                          className="p-1.5 text-gray-300 hover:text-red-500"
                          title="Eliminar"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Alta de programación */}
          <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-100">
            <h3 className="font-semibold text-gray-900 mb-4">Nueva programación</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-gray-500 mb-1">Nombre</label>
                <input
                  value={formProg.nombre}
                  onChange={(e) => setFormProg({ ...formProg, nombre: e.target.value })}
                  placeholder="Reporte semanal de Inyección"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Lista</label>
                <select
                  value={formProg.listaId}
                  onChange={(e) => setFormProg({ ...formProg, listaId: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                >
                  <option value="">Selecciona...</option>
                  {listas
                    .filter((l) => l.activo)
                    .map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.nombre} ({l.miembros})
                      </option>
                    ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Qué incluye</label>
                <select
                  value={formProg.periodoRelativo}
                  onChange={(e) =>
                    setFormProg({ ...formProg, periodoRelativo: e.target.value })
                  }
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                >
                  {PERIODOS.map((p) => (
                    <option key={p.v} value={p.v}>{p.t}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Frecuencia</label>
                <select
                  value={formProg.frecuencia}
                  onChange={(e) =>
                    setFormProg({
                      ...formProg,
                      frecuencia: e.target.value,
                      dia: e.target.value === "MENSUAL" ? 1 : 1,
                    })
                  }
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                >
                  <option value="DIARIA">Diaria</option>
                  <option value="SEMANAL">Semanal</option>
                  <option value="MENSUAL">Mensual</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  {formProg.frecuencia === "MENSUAL" ? "Día del mes" : "Día"}
                </label>
                {formProg.frecuencia === "DIARIA" ? (
                  <input
                    disabled
                    value="todos los días"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-400"
                  />
                ) : formProg.frecuencia === "MENSUAL" ? (
                  <input
                    type="number"
                    min="1"
                    max="31"
                    value={formProg.dia}
                    onChange={(e) => setFormProg({ ...formProg, dia: Number(e.target.value) })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  />
                ) : (
                  <select
                    value={formProg.dia}
                    onChange={(e) => setFormProg({ ...formProg, dia: Number(e.target.value) })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  >
                    {DIAS.map((d) => (
                      <option key={d.v} value={d.v}>{d.t}</option>
                    ))}
                  </select>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Hora</label>
                <div className="flex gap-2 items-center">
                  <input
                    type="number"
                    min="0"
                    max="23"
                    value={formProg.hora}
                    onChange={(e) => setFormProg({ ...formProg, hora: Number(e.target.value) })}
                    className="w-20 border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  />
                  <span className="text-gray-400">:</span>
                  <input
                    type="number"
                    min="0"
                    max="59"
                    value={formProg.minuto}
                    onChange={(e) => setFormProg({ ...formProg, minuto: Number(e.target.value) })}
                    className="w-20 border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  />
                  <span className="text-[11px] text-gray-400">hora de México</span>
                </div>
              </div>
              <div className="md:col-span-3">
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  Mensaje en el correo (opcional)
                </label>
                <input
                  value={formProg.mensaje}
                  onChange={(e) => setFormProg({ ...formProg, mensaje: e.target.value })}
                  placeholder="Resumen de scrap por unidad de negocio del periodo."
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                />
              </div>
            </div>
            <button
              onClick={() =>
                accion(
                  "crear-prog",
                  () => envioReportesService.crearProgramacion(formProg),
                  (r) => `Programación creada: ${r.expresion_cron}`,
                ).then((r) => r && setFormProg({ ...formProg, nombre: "", mensaje: "" }))
              }
              disabled={ocupado === "crear-prog"}
              className="mt-4 flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary-dark disabled:opacity-40"
            >
              <Plus className="w-4 h-4" />
              Crear programación
            </button>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------- LISTAS */}
      {pestana === "listas" && (
        <div className="space-y-4">
          {listas.map((l) => (
            <div key={l.id} className="bg-white rounded-xl shadow-sm border border-gray-100">
              <div className="flex items-center justify-between p-4">
                <button onClick={() => abrirLista(l.id)} className="text-left flex-1">
                  <p className="font-medium text-gray-900">{l.nombre}</p>
                  <p className="text-xs text-gray-400">
                    {l.miembros} destinatarios
                    {l.descripcion ? ` · ${l.descripcion}` : ""}
                  </p>
                </button>
                <button
                  onClick={() =>
                    accion(
                      `dellista-${l.id}`,
                      () => envioReportesService.eliminarLista(l.id),
                      () => "Lista eliminada",
                    )
                  }
                  className="p-1.5 text-gray-300 hover:text-red-500"
                  title="Eliminar lista"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              {listaAbierta?.id === l.id && (
                <div className="border-t border-gray-100 p-4 space-y-3">
                  {listaAbierta.miembros.length === 0 && (
                    <p className="text-sm text-gray-400">Sin destinatarios</p>
                  )}
                  {listaAbierta.miembros.map((m) => (
                    <div key={m.id} className="flex items-center justify-between text-sm">
                      <span>
                        <span className="text-gray-900">{m.correo}</span>
                        {m.nombre && <span className="text-gray-400"> · {m.nombre}</span>}
                      </span>
                      <button
                        onClick={() =>
                          accion(
                            `delm-${m.id}`,
                            async () => {
                              await envioReportesService.eliminarMiembro(m.id);
                              setListaAbierta(await envioReportesService.getLista(l.id));
                            },
                            () => "Destinatario eliminado",
                          )
                        }
                        className="p-1 text-gray-300 hover:text-red-500"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                  <div className="flex gap-2 pt-2">
                    <input
                      value={formMiembro.correo}
                      onChange={(e) =>
                        setFormMiembro({ ...formMiembro, correo: e.target.value })
                      }
                      placeholder="correo@foamcreations.com"
                      className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm"
                    />
                    <input
                      value={formMiembro.nombre}
                      onChange={(e) =>
                        setFormMiembro({ ...formMiembro, nombre: e.target.value })
                      }
                      placeholder="Nombre (opcional)"
                      className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm"
                    />
                    <button
                      onClick={() =>
                        accion(
                          "addm",
                          async () => {
                            await envioReportesService.agregarMiembro(l.id, formMiembro);
                            setListaAbierta(await envioReportesService.getLista(l.id));
                            setFormMiembro({ nombre: "", correo: "" });
                          },
                          () => "Destinatario agregado",
                        )
                      }
                      className="px-4 py-2 bg-primary text-white text-sm rounded-lg hover:bg-primary-dark"
                    >
                      Agregar
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}

          <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-100">
            <h3 className="font-semibold text-gray-900 mb-3">Nueva lista</h3>
            <div className="flex gap-2">
              <input
                value={formLista.nombre}
                onChange={(e) => setFormLista({ ...formLista, nombre: e.target.value })}
                placeholder="Dirección"
                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm"
              />
              <input
                value={formLista.descripcion}
                onChange={(e) =>
                  setFormLista({ ...formLista, descripcion: e.target.value })
                }
                placeholder="Descripción (opcional)"
                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm"
              />
              <button
                onClick={() =>
                  accion(
                    "crear-lista",
                    () => envioReportesService.crearLista(formLista),
                    () => "Lista creada",
                  ).then((r) => r && setFormLista({ nombre: "", descripcion: "" }))
                }
                className="px-4 py-2 bg-primary text-white text-sm rounded-lg hover:bg-primary-dark"
              >
                Crear
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------- BITÁCORA */}
      {pestana === "bitacora" && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
          {envios.length === 0 ? (
            <p className="p-8 text-center text-gray-400 text-sm">Sin envíos todavía</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {["Fecha", "Estado", "Reporte", "Periodo", "Destinatarios", "Tamaño"].map(
                    (h) => (
                      <th
                        key={h}
                        className="px-3 py-2 text-left text-[11px] font-semibold text-gray-500 uppercase"
                      >
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {envios.map((e) => (
                  <tr key={e.id}>
                    <td className="px-3 py-2 text-gray-500 whitespace-nowrap">
                      {fechaHora(e.creado_en)}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${
                          e.estado === "ENVIADO"
                            ? "bg-green-50 text-green-700"
                            : "bg-red-50 text-red-700"
                        }`}
                      >
                        {e.estado}
                      </span>
                      <span className="text-[11px] text-gray-400 ml-1">{e.disparo}</span>
                    </td>
                    <td className="px-3 py-2 text-gray-900">
                      {e.programacion || "—"}
                      {e.error && <p className="text-[11px] text-red-500">{e.error}</p>}
                    </td>
                    <td className="px-3 py-2 text-gray-500">{e.periodo || "—"}</td>
                    <td className="px-3 py-2 text-gray-500 text-xs">
                      {(e.destinatarios || []).join(", ") || "—"}
                    </td>
                    <td className="px-3 py-2 text-gray-500 whitespace-nowrap">
                      {e.bytes ? `${(e.bytes / 1024).toFixed(1)} KB` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
