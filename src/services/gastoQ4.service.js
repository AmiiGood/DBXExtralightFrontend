import api from "./api";

/**
 * Gasto Q4: lo que cada área necesita gastar de octubre a diciembre, "solo lo
 * indispensable", del libro Budget Acumulado (hoja Q42026).
 *
 * Se carga una vez; volver a subirlo reemplaza lo anterior.
 */
export const gastoQ4Service = {
  /** Todos los conceptos con su tipo de gasto, y el tipo de cambio FIX. */
  getReporte: async () => {
    const { data } = await api.get("/gasto-q4/reportes");
    return data.data;
  },

  /** Baja el FIX de Banxico en ese momento. */
  actualizarTipoCambio: async () => {
    const { data } = await api.post("/gasto-q4/tipo-cambio/actualizar");
    return data.data;
  },

  /** Lo que trae el archivo y lo que reemplazaría, sin cargarlo. */
  analizarCarga: async (archivo) => {
    const fd = new FormData();
    fd.append("archivo", archivo);
    const { data } = await api.post("/gasto-q4/carga/analizar", fd, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return data.data;
  },

  /** Carga el archivo y reemplaza la carga anterior. */
  importarCarga: async (archivo) => {
    const fd = new FormData();
    fd.append("archivo", archivo);
    const { data } = await api.post("/gasto-q4/carga/importar", fd, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return data.data;
  },

  getHistorialCargas: async () => {
    const { data } = await api.get("/gasto-q4/carga/historial");
    return data.data;
  },
};
