import api from "./api";

/**
 * Reporte de CAPEX.
 *
 * El dato sale del plan de CAPEX que el área guarda en la carpeta de red. El
 * servidor toma la Rev más alta del libro y lo relee cuando cambia; nadie lo
 * sube. Por eso hay dos grupos de llamadas: el reporte y el archivo vigilado.
 */
export const capexService = {
  /** Totales, proyectos con firmas FOAM y gasto por trimestre. */
  getReporte: async () => {
    const { data } = await api.get("/capex/reportes");
    return data.data;
  },

  // -------------------------------------------------------------------------
  // Archivo vigilado
  // -------------------------------------------------------------------------

  getArchivo: async () => {
    const { data } = await api.get("/capex/archivo");
    return data.data;
  },

  /** Carpeta, principio del nombre, hoja, bloque o si se vigila. */
  guardarArchivo: async (cambios) => {
    const { data } = await api.put("/capex/archivo", cambios);
    return data.data;
  },

  /** Qué libro se elegiría y qué trae el bloque, sin cargar nada. */
  probarArchivo: async () => {
    const { data } = await api.post("/capex/archivo/probar");
    return data.data;
  },

  /** Lee ya. `forzar` relee aunque el libro no haya cambiado. */
  sincronizar: async ({ forzar = false } = {}) => {
    const { data } = await api.post(
      "/capex/archivo/sincronizar",
      { forzar },
      { timeout: 0 },
    );
    return { ...data.data, mensaje: data.message };
  },
};
