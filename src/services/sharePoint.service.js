import api from "./api";

/**
 * Archivos que el servidor lee solo de SharePoint.
 *
 * Hoy son los libros de Compound e Inyección. El servidor los consulta por
 * Microsoft Graph y, si cambiaron, los pasa al mismo importador de la pantalla
 * de carga de cada reporte.
 */
export const sharePointService = {
  /** Qué se vigila, cuándo se leyó y con qué resultado. */
  getArchivos: async () => {
    const { data } = await api.get("/sharepoint/archivos");
    return data.data;
  },

  /** Cambia la URL de la carpeta, el nombre o si se vigila. */
  guardarArchivo: async (clave, cambios) => {
    const { data } = await api.put(`/sharepoint/archivos/${clave}`, cambios);
    return data.data;
  },

  /** Revisa que el archivo se alcance, sin bajarlo ni cargarlo. */
  probarArchivo: async (clave) => {
    const { data } = await api.post(`/sharepoint/archivos/${clave}/probar`);
    return data.data;
  },

  /**
   * Lee ya, sin esperar la vuelta programada.
   *
   * `forzar` relee aunque no haya cambiado, aunque alguien lo esté editando y
   * aunque ya haya fallado con ese mismo contenido.
   */
  sincronizar: async ({ clave, forzar = false } = {}) => {
    const { data } = await api.post(
      "/sharepoint/archivos/sincronizar",
      { clave, forzar },
      { timeout: 0 },
    );
    return { ...data.data, mensaje: data.message };
  },
};
