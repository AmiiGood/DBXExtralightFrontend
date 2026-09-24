import api from "./api";

/**
 * Reportes de STAFF.
 *
 * Todo sale del mismo Excel semanal, pero se pide por bloque: cada uno es una
 * gráfica distinta de la presentación y se ve por separado en pantalla.
 *
 * La PO abierta va aparte porque no es una serie de tiempo: es la foto de la
 * cartera al corte de una semana.
 */

export const BLOQUES = [
  { codigo: "INVOICE", nombre: "Facturación" },
  { codigo: "INYECCION", nombre: "Inyección" },
  { codigo: "ENSAMBLE", nombre: "Ensamble" },
  { codigo: "ROTACION", nombre: "Rotación" },
];

export const staffService = {
  /** Años, bloques y cortes de PO abierta disponibles. */
  getFiltros: async () => {
    const { data } = await api.get("/staff/reportes/filtros");
    return data.data;
  },

  /**
   * Serie de un bloque, pivoteada para graficar.
   *
   * @param {String} bloque  INVOICE | INYECCION | ENSAMBLE | ROTACION
   * @param {Object} opciones { anio, vista: 'junta'|'mes'|'semana', semanas }
   */
  getSerie: async (bloque, opciones = {}) => {
    const params = new URLSearchParams({ bloque });
    if (opciones.anio) params.append("anio", opciones.anio);
    if (opciones.vista) params.append("vista", opciones.vista);
    if (opciones.semanas) params.append("semanas", opciones.semanas);
    const { data } = await api.get(`/staff/reportes/serie?${params}`);
    return data.data;
  },

  /** Promedio diario por trimestre: las tablas de la presentación. */
  getTrimestres: async (bloque, anio) => {
    const params = new URLSearchParams({ bloque, anio });
    const { data } = await api.get(`/staff/reportes/trimestres?${params}`);
    return data.data;
  },

  /** Foto de la PO abierta. Sin corte devuelve el más reciente. */
  getOpenPo: async (corte) => {
    const params = new URLSearchParams();
    if (corte?.anio && corte?.semana) {
      params.append("anio", corte.anio);
      params.append("semana", corte.semana);
    }
    const { data } = await api.get(`/staff/reportes/open-po?${params}`);
    return data.data;
  },

  /**
   * Describe lo que trae el Excel sin escribir nada.
   *
   * `corte` solo hace falta cuando el nombre del archivo no trae la semana:
   * es el único lugar donde viene, y sin ella no se puede archivar la PO
   * abierta.
   */
  analizarCarga: async (archivo, corte) => {
    const fd = new FormData();
    fd.append("archivo", archivo);
    if (corte?.semana) {
      fd.append("semana", corte.semana);
      fd.append("anio", corte.anio);
    }
    const { data } = await api.post("/staff/carga/analizar", fd, {
      timeout: 0,
      headers: { "Content-Type": "multipart/form-data" },
    });
    return data.data;
  },

  /** Carga el Excel: actualiza las series y archiva la PO abierta. */
  importarCarga: async (archivo, corte) => {
    const fd = new FormData();
    fd.append("archivo", archivo);
    if (corte?.semana) {
      fd.append("semana", corte.semana);
      fd.append("anio", corte.anio);
    }
    const { data } = await api.post("/staff/carga/importar", fd, {
      timeout: 0,
      headers: { "Content-Type": "multipart/form-data" },
    });
    return data.data;
  },

  /** Últimas cargas de Excel. */
  getHistorialCargas: async () => {
    const { data } = await api.get("/staff/carga/historial");
    return data.data;
  },
};
