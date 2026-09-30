import api from "./api";

/**
 * Reportes de Customer Service.
 *
 * El origen no es ni una carga por pantalla ni una réplica de otra base: son
 * dos archivos de Excel que viven en una carpeta de red y que el área actualiza
 * cada semana. El servidor los vigila y los relee cuando cambian.
 *
 * Por eso hay dos grupos de llamadas: las del reporte y las de los archivos
 * vigilados, que es donde se cambia el nombre del libro cuando cambia el año.
 */

function armarFiltros(f = {}) {
  const params = new URLSearchParams();
  for (const campo of ["fechaInicio", "fechaFin"]) {
    if (f[campo]) params.append(campo, f[campo]);
  }
  const listas = {
    periodo: f.periodos,
    bu: f.bus,
    familia: f.familias,
    tipo: f.tipos,
    area: f.areas,
    cliente: f.clientes,
    estado: f.estados,
  };
  for (const [campo, valor] of Object.entries(listas)) {
    if (valor?.length) params.append(campo, valor.join(","));
  }
  return params;
}

export const customerServiceService = {
  /** Años, indicadores y catálogos de las muestras. */
  getFiltros: async () => {
    const { data } = await api.get("/customer-service/reportes/filtros");
    return data.data;
  },

  /**
   * El tablero de OTS, OTIF y SC.
   *
   * @param {Number} anio       el año del tablero
   * @param {String} indicador  cuál se dibuja semana a semana
   * @param {Array}  bus        unidades de negocio a incluir
   */
  getKpi: async ({ anio, indicador = "OTIF", bus } = {}) => {
    const params = new URLSearchParams({ anio, indicador });
    if (bus?.length) params.append("bu", bus.join(","));
    const { data } = await api.get(`/customer-service/reportes/kpi?${params}`);
    return data.data;
  },

  /**
   * El análisis de muestras.
   *
   * @param {String} corte  por dónde se agrupa la gráfica principal
   */
  getMuestras: async (filtros = {}, corte = "familia") => {
    const params = armarFiltros(filtros);
    params.append("corte", corte);
    const { data } = await api.get(`/customer-service/reportes/muestras?${params}`);
    return data.data;
  },

  /** El renglón a renglón. */
  getMuestrasDetalle: async (filtros = {}, { limite = 500, pagina = 1 } = {}) => {
    const params = armarFiltros(filtros);
    params.append("limite", limite);
    params.append("pagina", pagina);
    const { data } = await api.get(
      `/customer-service/reportes/muestras/detalle?${params}`,
    );
    return data.data;
  },

  // -------------------------------------------------------------------------
  // Archivos vigilados
  // -------------------------------------------------------------------------

  /** Qué se vigila, cuándo se leyó y con qué resultado. */
  getArchivos: async () => {
    const { data } = await api.get("/customer-service/archivos");
    return data.data;
  },

  /** Cambia la carpeta, el nombre o si se vigila. */
  guardarArchivo: async (clave, cambios) => {
    const { data } = await api.put(`/customer-service/archivos/${clave}`, cambios);
    return data.data;
  },

  /**
   * Revisa que la ruta se alcance, sin cargar nada.
   *
   * Es lo que hay que usar mientras se gestionan los permisos del recurso
   * compartido: separa "no tengo permiso" de "el archivo se llama distinto".
   */
  probarArchivo: async (clave) => {
    const { data } = await api.post(`/customer-service/archivos/${clave}/probar`);
    return data.data;
  },

  /**
   * Lee ya, sin esperar la vuelta programada.
   *
   * `forzar` relee aunque el archivo no haya cambiado; sirve cuando se corrigió
   * algo del lado del sistema y hay que volver a procesar el mismo libro.
   */
  sincronizar: async ({ clave, forzar = false } = {}) => {
    const { data } = await api.post(
      "/customer-service/archivos/sincronizar",
      { clave, forzar },
      { timeout: 0 },
    );
    return { ...data.data, mensaje: data.message };
  },
};
