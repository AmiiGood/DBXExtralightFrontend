import api from "./api";

/**
 * Reportes de Compound.
 *
 * Dos orígenes distintos: la producción diaria por línea y turno, y la
 * recuperación de polvo por BU. Van en endpoints separados porque son archivos
 * distintos, con otra granularidad y otro rango de fechas.
 */

function armarFiltros(filtros = {}) {
  const params = new URLSearchParams();
  for (const campo of [
    "anio", "mes", "trimestre", "semestre", "fechaInicio", "fechaFin",
  ]) {
    if (filtros[campo]) params.append(campo, filtros[campo]);
  }
  if (filtros.lineas?.length) params.append("linea", filtros.lineas.join(","));
  if (filtros.turnos?.length) params.append("turno", filtros.turnos.join(","));
  if (filtros.supervisores?.length)
    params.append("supervisor", filtros.supervisores.join(","));
  if (filtros.bus?.length) params.append("bu", filtros.bus.join(","));
  return params;
}

export const compoundService = {
  /** Años, líneas, turnos, supervisores y BU disponibles. */
  getFiltros: async () => {
    const { data } = await api.get("/compound/reportes/filtros");
    return data.data;
  },

  /**
   * Producción y tiempo muerto.
   * @param {String} agrupar 'anio' | 'mes' | 'semana' | 'fecha'
   */
  getDashboard: async (filtros = {}, agrupar = "mes") => {
    const params = armarFiltros(filtros);
    params.append("agrupar", agrupar);
    const { data } = await api.get(`/compound/reportes/dashboard?${params}`);
    return data.data;
  },

  /** Recuperación de polvo por BU, contra su meta. */
  getRecuperacion: async (filtros = {}, agrupar = "anio") => {
    const params = armarFiltros(filtros);
    params.append("agrupar", agrupar);
    const { data } = await api.get(`/compound/reportes/recuperacion?${params}`);
    return data.data;
  },

  /** Compara dos periodos, con el delta por causa de paro. */
  comparar: async (tipo, a, b, filtros = {}) => {
    const params = armarFiltros(filtros);
    params.append("tipo", tipo);
    params.append("aAnio", a.anio);
    params.append("aNum", a.numero ?? 1);
    params.append("bAnio", b.anio);
    params.append("bNum", b.numero ?? 1);
    const { data } = await api.get(`/compound/reportes/comparar?${params}`);
    return data.data;
  },

  /**
   * Describe lo que trae el Excel sin escribir nada. El servidor decide a qué
   * tabla va por las hojas del archivo, no por lo que diga la pantalla.
   */
  analizarCarga: async (archivo) => {
    const fd = new FormData();
    fd.append("archivo", archivo);
    const { data } = await api.post("/compound/carga/analizar", fd, {
      timeout: 0,
      headers: { "Content-Type": "multipart/form-data" },
    });
    return data.data;
  },

  /** Carga el Excel reemplazando su rango de fechas. */
  importarCarga: async (archivo) => {
    const fd = new FormData();
    fd.append("archivo", archivo);
    const { data } = await api.post("/compound/carga/importar", fd, {
      timeout: 0,
      headers: { "Content-Type": "multipart/form-data" },
    });
    return data.data;
  },

  /** Últimas cargas de Excel. */
  getHistorialCargas: async () => {
    const { data } = await api.get("/compound/carga/historial");
    return data.data;
  },
};
