import api from "./api";

/**
 * Reporte de AIMS.
 *
 * El dato sale del libro de indicadores que el área guarda en la carpeta de
 * red ('KPIs AIMS revN …'). El servidor toma la rev más alta y lo relee cuando
 * cambia; nadie lo sube.
 */
export const aimsService = {
  /** Los indicadores del año, mes a mes, con su último valor y el acumulado. */
  getReporte: async (anio) => {
    const { data } = await api.get("/aims/reportes", { params: anio ? { anio } : {} });
    return data.data;
  },

  // -------------------------------------------------------------------------
  // Archivo vigilado
  // -------------------------------------------------------------------------

  getArchivo: async () => {
    const { data } = await api.get("/aims/archivo");
    return data.data;
  },

  /** Carpeta, principio del nombre o si se vigila. */
  guardarArchivo: async (cambios) => {
    const { data } = await api.put("/aims/archivo", cambios);
    return data.data;
  },

  /** Qué libro se elegiría y qué trae, sin cargar nada. */
  probarArchivo: async () => {
    const { data } = await api.post("/aims/archivo/probar");
    return data.data;
  },

  /** Lee ya. `forzar` relee aunque el libro no haya cambiado. */
  sincronizar: async ({ forzar = false } = {}) => {
    const { data } = await api.post("/aims/archivo/sincronizar", { forzar }, { timeout: 0 });
    return { ...data.data, mensaje: data.message };
  },
};
