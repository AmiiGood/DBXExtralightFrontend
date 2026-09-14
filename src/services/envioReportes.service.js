import api from "./api";

const base = "/envio-reportes";

/**
 * Listas de correo, programaciones de envío y bitácora.
 */
export const envioReportesService = {
  // ------------------------------------------------------------- listas
  getListas: async () => (await api.get(`${base}/listas`)).data.data.listas,
  getLista: async (id) => (await api.get(`${base}/listas/${id}`)).data.data,
  crearLista: async (datos) => (await api.post(`${base}/listas`, datos)).data.data,
  actualizarLista: async (id, datos) =>
    (await api.put(`${base}/listas/${id}`, datos)).data.data,
  eliminarLista: async (id) => (await api.delete(`${base}/listas/${id}`)).data,

  // --------------------------------------------------------- miembros
  agregarMiembro: async (listaId, datos) =>
    (await api.post(`${base}/listas/${listaId}/miembros`, datos)).data.data,
  eliminarMiembro: async (miembroId) =>
    (await api.delete(`${base}/miembros/${miembroId}`)).data,

  // --------------------------------------------------- programaciones
  getProgramaciones: async () =>
    (await api.get(`${base}/programaciones`)).data.data,
  crearProgramacion: async (datos) =>
    (await api.post(`${base}/programaciones`, datos)).data.data,
  actualizarProgramacion: async (id, datos) =>
    (await api.put(`${base}/programaciones/${id}`, datos)).data.data,
  eliminarProgramacion: async (id) =>
    (await api.delete(`${base}/programaciones/${id}`)).data,

  /** Dispara el envío al instante. soloAMi limita el correo a quien lo pide. */
  probar: async (id, soloAMi = false) =>
    (await api.post(`${base}/programaciones/${id}/probar`, { soloAMi })).data.data,

  // ------------------------------------------------ bitácora / estado
  getEnvios: async (limite = 50) =>
    (await api.get(`${base}/envios?limite=${limite}`)).data.data.envios,
  probarConexion: async () =>
    (await api.get(`${base}/probar-conexion`)).data.data,
};
