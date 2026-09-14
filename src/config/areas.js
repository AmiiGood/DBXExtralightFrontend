import {
  Factory,
  Boxes,
  Wrench,
  CalendarRange,
  Ruler,
  ClipboardCheck,
  HardHat,
  Warehouse,
  ShoppingCart,
  UserRound,
  Network,
  TrendingUp,
  Target,
  Users,
} from "lucide-react";

/**
 * Catálogo de áreas y sus reportes.
 *
 * Es el índice del menú de reportes: primero se elige el área y dentro se
 * elige el reporte. Vive en el frontend porque cada reporte es una pantalla de
 * React, así que agregar uno implica código de todas formas; tener el índice
 * junto al código evita que la base y la aplicación se desincronicen.
 *
 * Aquí SOLO van reportes. Las pantallas de captura, carga de archivos y el
 * modo TV no entran: se llega a ellas por el menú lateral, no por este índice.
 *
 * Cada reporte lleva `modulo`, que es el nombre con el que está dado de alta en
 * la tabla `modulos`. Con eso el menú solo enseña lo que el usuario tiene
 * permitido, en vez de mandarlo a una pantalla que le va a dar 403.
 *
 * Un reporte SIN `ruta` se muestra como pendiente: sirve para dejar asentado
 * qué se va a construir sin fingir que ya existe.
 */
export const AREAS = [
  {
    id: "produccion",
    nombre: "Producción",
    icono: Factory,
    reportes: [
      {
        nombre: "Reportes de Inyección",
        descripcion:
          "Producción y % Scrap por unidad de negocio, máquina y periodo",
        ruta: "/produccion/reportes",
        modulo: "Reportes de Producción",
      },
      {
        nombre: "Compuestos",
        descripcion:
          "Producción, tiempo muerto por causa y recuperación de polvo",
        ruta: "/compound/reportes",
        modulo: "Reportes de Compuestos",
      },
    ],
  },

  // ---------------------------------------------------------------------
  // Áreas que entran al proyecto pero cuyos reportes están por definirse.
  // Se dejan visibles a propósito: el menú tiene que reflejar el alcance
  // completo aunque todavía no haya nada que abrir.
  //
  // Calidad va aquí aunque ya tenga pantallas propias en el sistema: en este
  // menú solo entran reportes hechos para este proyecto, y de Calidad todavía
  // no se ha hecho ninguno.
  // ---------------------------------------------------------------------
  {
    id: "calidad",
    nombre: "Calidad",
    icono: ClipboardCheck,
    reportes: [],
  },
  {
    id: "moldes",
    nombre: "Moldes",
    icono: Boxes,
    reportes: [
      {
        nombre: "Tiempos de atención",
        descripcion:
          "Tiempo de resolución de los tickets del área, por tema y periodo",
        ruta: "/moldes/reportes",
        modulo: "Reportes de Moldes",
      },
    ],
  },
  {
    id: "mantenimiento",
    nombre: "Mantenimiento",
    icono: Wrench,
    reportes: [],
  },
  {
    id: "planeacion",
    nombre: "Planeación",
    icono: CalendarRange,
    reportes: [],
  },
  {
    id: "ingenieria",
    nombre: "Ingeniería",
    icono: Ruler,
    reportes: [],
  },
  {
    id: "hse",
    nombre: "HSE",
    icono: HardHat,
    reportes: [],
  },
  {
    id: "warehouse",
    nombre: "Warehouse",
    icono: Warehouse,
    reportes: [],
  },
  {
    id: "compras",
    nombre: "Compras",
    icono: ShoppingCart,
    reportes: [],
  },
  {
    id: "rh",
    nombre: "Recursos Humanos",
    icono: UserRound,
    reportes: [],
  },
  {
    id: "mes",
    nombre: "MES",
    icono: Network,
    reportes: [],
  },
  {
    id: "capex",
    nombre: "CAPEX",
    icono: TrendingUp,
    reportes: [],
  },
  {
    id: "resultados",
    nombre: "Resultados",
    icono: Target,
    reportes: [],
  },
  {
    id: "staff",
    nombre: "STAFF",
    icono: Users,
    reportes: [],
  },
];

export const buscarArea = (id) => AREAS.find((a) => a.id === id);

/**
 * Reportes del área que el usuario puede abrir de verdad.
 *
 * Los administradores ven todo. Para el resto se cruza contra los módulos que
 * devuelve /auth/modulos.
 */
export function reportesVisibles(area, modulos, esAdmin) {
  if (!area) return [];
  if (esAdmin) return area.reportes;
  const permitidos = new Set((modulos || []).map((m) => m.nombre));
  return area.reportes.filter((r) => !r.modulo || permitidos.has(r.modulo));
}
