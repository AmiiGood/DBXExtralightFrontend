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

  // -------------------------------------------------------------------------
  // Cotizaciones: Compras manda opciones de proveedores, quien pidió elige
  // -------------------------------------------------------------------------

  /** @param {String} vista  por-cotizar | esperando | elegidas */
  getCotizaciones: async (vista = "por-cotizar") => {
    const { data } = await api.get(`/compras/cotizaciones?vista=${vista}`);
    return data.data;
  },

  /** La solicitud vista desde Compras: borrador, enviada y descartadas. */
  getCotizacion: async (id) => {
    const { data } = await api.get(`/compras/cotizaciones/${id}`);
    return data.data;
  },

  guardarBorrador: async (id, borrador) => {
    const { data } = await api.put(`/compras/cotizaciones/${id}/borrador`, borrador);
    return data.data;
  },

  /** Fotos y PDF de los proveedores; regresa [{ id, nombre_original, tipo_mime }]. */
  subirArchivosCotizacion: async (id, archivos) => {
    const fd = new FormData();
    for (const a of archivos) fd.append("archivos", a);
    const { data } = await api.post(`/compras/cotizaciones/${id}/archivos`, fd, {
      timeout: 0,
      headers: { "Content-Type": "multipart/form-data" },
    });
    return data.data;
  },

  enviarCotizacion: async (id) => {
    const { data } = await api.post(`/compras/cotizaciones/${id}/enviar`);
    return data;
  },

  /** Foto o PDF de un proveedor, como Blob. */
  getArchivoCotizacion: async (archivoId) => {
    const { data } = await api.get(`/compras/cotizacion-archivos/${archivoId}`, { responseType: "blob", timeout: 0 });
    return data;
  },

  /** Un adjunto de la solicitud, visto desde Compras, como Blob. */
  getArchivoSolicitudCompras: async (solicitudId, archivoId) => {
    const { data } = await api.get(`/compras/cotizaciones/${solicitudId}/solicitud-archivos/${archivoId}`, {
      responseType: "blob",
      timeout: 0,
    });
    return data;
  },

  /** Quien pidió elige una opción. */
  elegir: async (id, { opcionId, comentario }) => {
    const { data } = await api.post(`/compras/solicitudes/${id}/elegir`, { opcionId, comentario });
    return data;
  },

  /** Ninguna opción le sirve. */
  pedirOtrasOpciones: async (id, motivo) => {
    const { data } = await api.post(`/compras/solicitudes/${id}/otras-opciones`, { motivo });
    return data;
  },

  // -------------------------------------------------------------------------
  // Presupuestos por área
  // -------------------------------------------------------------------------

  /** Presupuesto y ejercido por mes de todas las áreas, y si el usuario puede capturar. */
  getPresupuestos: async (anio) => {
    const { data } = await api.get(`/compras/presupuestos?anio=${anio}`);
    return data.data;
  },

  /** Las compras elegidas que se le descontaron a un área. */
  getEleccionesPresupuesto: async (areaId, anio) => {
    const { data } = await api.get(`/compras/presupuestos/${areaId}/elecciones?anio=${anio}`);
    return data.data;
  },

  /** @param {Array} filas [{ areaId, meses: [12 montos] }] */
  guardarPresupuestos: async (anio, filas) => {
    const { data } = await api.put(`/compras/presupuestos/${anio}`, { filas });
    return data;
  },

  // -------------------------------------------------------------------------
  // Formatos en papel
  // -------------------------------------------------------------------------

  /** Formatos entre dos fechas (YYYY-MM-DD), con los permisos del usuario. */
  getFormatos: async ({ desde, hasta }) => {
    const { data } = await api.get("/compras/formatos", { params: { desde, hasta } });
    return data.data;
  },

  /** Áreas y lo ya capturado en cada campo, para sugerirlo. */
  getOpcionesFormato: async () => {
    const { data } = await api.get("/compras/formatos/opciones");
    return data.data;
  },

  /** Crea (sin id) o corrige (con id) un formato. */
  guardarFormato: async (id, formato) => {
    const { data } = id
      ? await api.put(`/compras/formatos/${id}`, formato)
      : await api.post("/compras/formatos", formato);
    return data;
  },

  borrarFormato: async (id) => {
    const { data } = await api.delete(`/compras/formatos/${id}`);
    return data;
  },
};
