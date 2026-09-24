import api from "./api";

/**
 * Reportes de TI.
 *
 * Igual que Moldes, el origen es osTicket pero el reporte lee una réplica
 * local: el servidor de la mesa de ayuda nunca recibe la carga del tablero.
 * Por eso hay un endpoint de sincronización — el equivalente al "importar" de
 * los reportes que salen de un Excel.
 */

function armarFiltros(filtros = {}) {
  const params = new URLSearchParams();
  for (const campo of ["anio", "fechaInicio", "fechaFin"]) {
    if (filtros[campo]) params.append(campo, filtros[campo]);
  }
  if (filtros.temas?.length) params.append("tema", filtros.temas.join(","));
  return params;
}

export const tiService = {
  /** Temas y años disponibles. */
  getFiltros: async () => {
    const { data } = await api.get("/ti/reportes/filtros");
    return data.data;
  },

  /**
   * Todo el tablero en una llamada.
   * @param {String} agrupar 'anio' | 'trimestre' | 'mes'
   */
  getDashboard: async (filtros = {}, agrupar = "mes") => {
    const params = armarFiltros(filtros);
    params.append("agrupar", agrupar);
    const { data } = await api.get(`/ti/reportes/dashboard?${params}`);
    return data.data;
  },

  /** Qué tan fresca está la réplica. */
  getEstadoSincronizacion: async () => {
    const { data } = await api.get("/ti/sincronizacion");
    return data.data;
  },

  /**
   * Fuerza una sincronización.
   *
   * El servidor ya la corre cada 15 minutos; esto es para no esperar. La
   * completa vuelve a traer todo el histórico y solo hace falta si se sospecha
   * que la réplica quedó incompleta.
   */
  sincronizar: async (completa = false) => {
    const { data } = await api.post("/ti/sincronizacion", { completa }, { timeout: 0 });
    return data.data;
  },
};
