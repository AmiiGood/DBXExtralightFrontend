import api from "./api";

/**
 * Checadas de reloj.
 *
 * RH descarga de Hikvision el reporte "Transacciones" después de cada cambio de
 * turno y lo sube aquí. DBX le pone el turno a cada checada y dice quién llegó
 * a tiempo, en tolerancia o con retardo.
 */
export const checadasService = {
  /** Fechas con checadas, departamentos y turnos. */
  getFiltros: async () => {
    const { data } = await api.get("/checadas/reportes/filtros");
    return data.data;
  },

  /**
   * El reporte de un rango de fechas (del turno).
   *
   * @param {Object} f { desde, hasta, turnos[], departamentos[], estados[], salida, q }
   *   salida: 'ANTES' (salieron antes de terminar el turno) | 'SIN' (sin salida)
   */
  getReporte: async (f) => {
    const params = new URLSearchParams({ desde: f.desde, hasta: f.hasta });
    if (f.turnos?.length) params.append("turno", f.turnos.join(","));
    if (f.departamentos?.length) params.append("departamento", f.departamentos.join(","));
    if (f.estados?.length) params.append("estado", f.estados.join(","));
    if (f.salida) params.append("salida", f.salida);
    if (f.q) params.append("q", f.q);
    if (f.horaDesde) params.append("horaDesde", f.horaDesde);
    if (f.horaHasta) params.append("horaHasta", f.horaHasta);
    const { data } = await api.get(`/checadas/reportes?${params}`);
    return data.data;
  },

  /** Lo que trae el archivo, sin cargarlo. */
  analizarCarga: async (archivo) => {
    const fd = new FormData();
    fd.append("archivo", archivo);
    const { data } = await api.post("/checadas/carga/analizar", fd, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return data.data;
  },

  /** Carga las checadas nuevas del archivo. */
  importarCarga: async (archivo) => {
    const fd = new FormData();
    fd.append("archivo", archivo);
    const { data } = await api.post("/checadas/carga/importar", fd, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return data.data;
  },

  getHistorialCargas: async () => {
    const { data } = await api.get("/checadas/carga/historial");
    return data.data;
  },
};
