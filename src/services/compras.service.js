import api from "./api";

/**
 * Solicitudes de Compra con aprobación del gerente.
 *
 * Quien pide captura aquí; el gerente (o suplente) de su área aprueba o
 * rechaza; las aprobadas se vuelven ticket en el osTicket de Compras. Quién
 * aprueba no sale del rol sino de la configuración de cada área, por eso la
 * pantalla arranca pidiendo el contexto del usuario.
 */
export const comprasService = {
  /** Área del usuario, quién le aprueba, qué aprueba él y cuánto le espera. */
  getContexto: async () => {
    const { data } = await api.get("/compras/contexto");
    return data.data;
  },

  /** @param {String} vista  mias | pendientes | decididas */
  getSolicitudes: async (vista = "mias") => {
    const { data } = await api.get(`/compras/solicitudes?vista=${vista}`);
    return data.data;
  },

  getSolicitud: async (id) => {
    const { data } = await api.get(`/compras/solicitudes/${id}`);
    return data.data;
  },

  /**
   * @param {Object} solicitud  { asunto, detalle }
   * @param {File[]} archivos
   */
  crear: async ({ asunto, detalle }, archivos = []) => {
    const fd = new FormData();
    fd.append("asunto", asunto);
    fd.append("detalle", detalle);
    for (const a of archivos) fd.append("archivos", a);
    const { data } = await api.post("/compras/solicitudes", fd, {
      // Hasta 10 archivos de 10 MB por una red de planta
      timeout: 0,
      headers: { "Content-Type": "multipart/form-data" },
    });
    return data;
  },

  /** El archivo como Blob: las imágenes se previsualizan sin exponer el token en la URL. */
  getArchivo: async (solicitudId, archivoId) => {
    const { data } = await api.get(
      `/compras/solicitudes/${solicitudId}/archivos/${archivoId}`,
      { responseType: "blob", timeout: 0 },
    );
    return data;
  },

  decidir: async (id, { aprobar, comentario }) => {
    const { data } = await api.post(`/compras/solicitudes/${id}/decision`, {
      aprobar,
      comentario,
    });
    return data;
  },

  cancelar: async (id) => {
    const { data } = await api.post(`/compras/solicitudes/${id}/cancelar`);
    return data;
  },

  // -------------------------------------------------------------------------
  // Envío a osTicket
  // -------------------------------------------------------------------------

  /** A dónde apunta la conexión y qué aprobadas no han llegado a Compras. */
  getEnvios: async () => {
    const { data } = await api.get("/compras/envios");
    return data.data;
  },

  /** Reintento a mano. Espera a osTicket, por eso sin límite de tiempo. */
  reenviar: async (id) => {
    const { data } = await api.post(`/compras/solicitudes/${id}/reenviar`, null, { timeout: 0 });
    return data;
  },

  // -------------------------------------------------------------------------
  // Avisos por correo
  // -------------------------------------------------------------------------

  /** Configuración, horario legible y últimos correos. */
  getAvisos: async () => {
    const { data } = await api.get("/compras/avisos");
    return data.data;
  },

  /** { avisosActivos, avisoInmediato, recordatorioHoras, recordatorioDias } */
  guardarAvisos: async (cambios) => {
    const { data } = await api.put("/compras/avisos", cambios);
    return data;
  },

  /** Correo de prueba a uno mismo. */
  probarAviso: async () => {
    const { data } = await api.post("/compras/avisos/prueba", null, { timeout: 0 });
    return data;
  },

  /** Manda ya el recordatorio a los aprobadores reales. */
  mandarRecordatorios: async () => {
    const { data } = await api.post("/compras/avisos/recordatorios", null, { timeout: 0 });
    return data;
  },

  // -------------------------------------------------------------------------
  // Reporte
  // -------------------------------------------------------------------------

  /** @param {Object} periodo { desde, hasta } en AAAA-MM-DD */
  getReporte: async ({ desde, hasta }) => {
    const { data } = await api.get(`/compras/reportes?desde=${desde}&hasta=${hasta}`);
    return data.data;
  },

  // -------------------------------------------------------------------------
  // Aprobadores
  // -------------------------------------------------------------------------

  getAprobadores: async () => {
    const { data } = await api.get("/compras/aprobadores");
    return data.data;
  },

  guardarArea: async (id, { gerenteId, suplenteId, activo }) => {
    const { data } = await api.put(`/compras/aprobadores/areas/${id}`, {
      gerenteId,
      suplenteId,
      activo,
    });
    return data;
  },

  ligarAreaDbx: async (id, comprasAreaId) => {
    const { data } = await api.put(`/compras/aprobadores/areas-dbx/${id}`, {
      comprasAreaId,
    });
    return data;
  },
};
