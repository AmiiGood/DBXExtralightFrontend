import api from "./api";

/**
 * Reportes de Producción Inyección (páginas Inj e Inj 2 del Power BI).
 */
export const inyeccionService = {
  /** Valores disponibles para los slicers: años, meses, semanas, BUs. */
  getFiltros: async () => {
    const { data } = await api.get("/inyeccion/reportes/filtros");
    return data.data;
  },

  /**
   * Todas las series del dashboard en una llamada.
   * @param {Object} filtros { anio, mes, semana, bu: [], fechaInicio, fechaFin }
   * @param {String} agrupar 'anio' | 'mes' | 'semana' | 'fecha'
   */
  getDashboard: async (filtros = {}, agrupar = "mes") => {
    const params = new URLSearchParams();
    if (filtros.anio) params.append("anio", filtros.anio);
    if (filtros.mes) params.append("mes", filtros.mes);
    if (filtros.semana) params.append("semana", filtros.semana);
    if (filtros.trimestre) params.append("trimestre", filtros.trimestre);
    if (filtros.semestre) params.append("semestre", filtros.semestre);
    if (filtros.fechaInicio) params.append("fechaInicio", filtros.fechaInicio);
    if (filtros.fechaFin) params.append("fechaFin", filtros.fechaFin);
    if (filtros.bu?.length) params.append("bu", filtros.bu.join(","));
    params.append("agrupar", agrupar);

    const { data } = await api.get(`/inyeccion/reportes/dashboard?${params}`);
    return data.data;
  },

  /**
   * Compara dos periodos del mismo tipo.
   * @param {String} tipo  'mes' | 'trimestre' | 'semestre' | 'anio'
   * @param {Object} a     { anio, numero }
   * @param {Object} b     { anio, numero }
   * @param {Array}  bu    unidades de negocio (opcional)
   */
  comparar: async (tipo, a, b, bu) => {
    const params = new URLSearchParams({
      tipo,
      aAnio: a.anio,
      aNum: a.numero ?? 1,
      bAnio: b.anio,
      bNum: b.numero ?? 1,
    });
    if (bu?.length) params.append("bu", bu.join(","));
    const { data } = await api.get(`/inyeccion/reportes/comparar?${params}`);
    return data.data;
  },

  // ------------------------------------------------------- carga del Excel

  /** Resumen de lo que trae el archivo, sin escribir en la base. */
  analizarCarga: async (archivo) => {
    const fd = new FormData();
    fd.append("archivo", archivo);
    const { data } = await api.post("/inyeccion/carga/analizar", fd, {
      // El archivo pasa de 30 MB y el análisis tarda: se anula el timeout
      // por defecto de axios, que cortaría a los 20 segundos.
      timeout: 0,
      headers: { "Content-Type": "multipart/form-data" },
    });
    return data.data;
  },

  /** Carga el archivo. `reemplazar` confirma sobrescribir el rango de fechas. */
  importarCarga: async (archivo, reemplazar = false) => {
    const fd = new FormData();
    fd.append("archivo", archivo);
    fd.append("reemplazar", String(reemplazar));
    const { data } = await api.post("/inyeccion/carga/importar", fd, {
      timeout: 0,
      headers: { "Content-Type": "multipart/form-data" },
    });
    return data.data;
  },

  getHistorialCargas: async () =>
    (await api.get("/inyeccion/carga/historial")).data.data.cargas,

  // ---------------------------------------------------------------- captura

  /** Máquinas activas con sus estaciones, y turnos. */
  getCatalogosCaptura: async () => {
    const { data } = await api.get("/inyeccion/captura/catalogos");
    return data.data;
  },

  /** Renglones ya capturados de una fecha + máquina + turno. */
  getCaptura: async (fecha, maquinaId, turnoId) => {
    const { data } = await api.get(
      `/inyeccion/captura?fecha=${fecha}&maquinaId=${maquinaId}&turnoId=${turnoId}`,
    );
    return data.data.renglones;
  },

  /** Qué máquinas y turnos ya tienen captura ese día. */
  getAvance: async (fecha) => {
    const { data } = await api.get(`/inyeccion/captura/avance?fecha=${fecha}`);
    return data.data.avance;
  },

  /** Guarda el turno completo. */
  guardarCaptura: async (payload) => {
    const { data } = await api.post("/inyeccion/captura", payload);
    return data.data;
  },

  /** Autocompletar de producto semiterminado. */
  buscarProductos: async (q, bu) => {
    const params = new URLSearchParams({ q });
    if (bu) params.append("bu", bu);
    const { data } = await api.get(`/inyeccion/productos?${params}`);
    return data.data.productos;
  },
};
