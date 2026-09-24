import api from "./api";

/**
 * Reportes de Resultados.
 *
 * El tablero de un año viene en UNA llamada: son siete bloques que siempre se
 * ven juntos y partirlos solo multiplicaría los viajes. Las comparaciones
 * entre años van aparte porque no dependen del año elegido y se piden una vez.
 */

export const SERIES_MENSUALES = [
  { codigo: "qty", nombre: "Unidades facturadas" },
  { codigo: "usd", nombre: "Facturación USD" },
  { codigo: "precio", nombre: "Precio por unidad" },
  { codigo: "scrap", nombre: "% de scrap" },
];

export const resultadosService = {
  /** Años con dato, unidades de negocio y último corte cargado. */
  getFiltros: async () => {
    const { data } = await api.get("/resultados/reportes/filtros");
    return data.data;
  },

  /** Los siete bloques del año. */
  getDashboard: async (anio) => {
    const { data } = await api.get(`/resultados/reportes/dashboard?anio=${anio}`);
    return data.data;
  },

  /**
   * Doce meses con una columna por año.
   * @param {String} serie qty | usd | precio | scrap
   */
  getComparativoMensual: async (serie = "qty") => {
    const { data } = await api.get(`/resultados/reportes/mensual?serie=${serie}`);
    return data.data;
  },

  /** Un renglón por año, de 2020 a hoy. */
  getHistorico: async () => {
    const { data } = await api.get("/resultados/reportes/historico");
    return data.data;
  },

  /** Describe lo que trae el Excel sin escribir nada. */
  analizarCarga: async (archivo) => {
    const fd = new FormData();
    fd.append("archivo", archivo);
    const { data } = await api.post("/resultados/carga/analizar", fd, {
      timeout: 0,
      headers: { "Content-Type": "multipart/form-data" },
    });
    return data.data;
  },

  /** Carga el Excel actualizando lo que cambió. */
  importarCarga: async (archivo) => {
    const fd = new FormData();
    fd.append("archivo", archivo);
    const { data } = await api.post("/resultados/carga/importar", fd, {
      timeout: 0,
      headers: { "Content-Type": "multipart/form-data" },
    });
    return data.data;
  },

  /** Últimas cargas de Excel. */
  getHistorialCargas: async () => {
    const { data } = await api.get("/resultados/carga/historial");
    return data.data;
  },
};
