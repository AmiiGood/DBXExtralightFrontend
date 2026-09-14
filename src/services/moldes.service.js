import api from "./api";

/**
 * Reportes de Moldes.
 *
 * El origen es osTicket, pero el backend lee una réplica local que se
 * sincroniza cada 15 minutos. Por eso el dashboard trae también la fecha del
 * último corte: la pantalla tiene que poder decir de cuándo es el dato.
 */

/** Arma los query params comunes a dashboard y comparar. */
function armarFiltros(filtros = {}) {
  const params = new URLSearchParams();
  for (const campo of [
    "anio",
    "mes",
    "semana",
    "trimestre",
    "semestre",
    "fechaInicio",
    "fechaFin",
  ]) {
    if (filtros[campo]) params.append(campo, filtros[campo]);
  }
  if (filtros.temas?.length) params.append("tema", filtros.temas.join(","));
  return params;
}

export const moldesService = {
  /** Temas, años y meses disponibles para los selectores. */
  getFiltros: async () => {
    const { data } = await api.get("/moldes/reportes/filtros");
    return data.data;
  },

  /**
   * Todo el tablero en una llamada.
   * @param {Object} filtros { temas: [], anio, mes, semana, trimestre, semestre }
   * @param {String} agrupar 'anio' | 'mes' | 'semana' | 'fecha'
   */
  getDashboard: async (filtros = {}, agrupar = "mes") => {
    const params = armarFiltros(filtros);
    params.append("agrupar", agrupar);
    const { data } = await api.get(`/moldes/reportes/dashboard?${params}`);
    return data.data;
  },

  /**
   * Compara dos periodos del mismo tipo.
   * @param {String} tipo 'mes' | 'trimestre' | 'semestre' | 'anio'
   * @param {Object} a    { anio, numero }
   * @param {Object} b    { anio, numero }
   * @param {Array}  temas
   */
  comparar: async (tipo, a, b, temas) => {
    const params = new URLSearchParams({
      tipo,
      aAnio: a.anio,
      aNum: a.numero ?? 1,
      bAnio: b.anio,
      bNum: b.numero ?? 1,
    });
    if (temas?.length) params.append("tema", temas.join(","));
    const { data } = await api.get(`/moldes/reportes/comparar?${params}`);
    return data.data;
  },

  /** Qué tan fresca está la réplica. */
  getSincronizacion: async () => {
    const { data } = await api.get("/moldes/sincronizacion");
    return data.data;
  },

  /** Fuerza una sincronización sin esperar a la programada. */
  sincronizar: async (completa = false) => {
    const { data } = await api.post("/moldes/sincronizacion", { completa });
    return data.data;
  },
};
