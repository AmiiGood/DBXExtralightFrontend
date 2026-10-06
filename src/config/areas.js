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
  Headphones,
  ShieldCheck,
  Handshake,
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
    id: "aims",
    // Asset Integrity Management System. Va con el nombre corto porque es como
    // se le dice en planta; el largo queda en la descripción del área.
    nombre: "AIMS",
    icono: ShieldCheck,
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
    reportes: [
      {
        nombre: "Aprobación de solicitudes",
        descripcion:
          "Cuánto tarda cada área en aprobar, cuántas se rechazan y por qué, y lo que espera hoy",
        ruta: "/compras/reportes",
        modulo: "Reportes de Compras",
      },
    ],
  },
  {
    id: "customer-service",
    nombre: "Customer Service",
    icono: Handshake,
    reportes: [
      {
        nombre: "Servicio y muestras",
        descripcion:
          "OTS, OTIF y nivel de servicio semana a semana, y cumplimiento de los tiempos de muestras",
        ruta: "/customer-service/reportes",
        modulo: "Reportes de Customer Service",
      },
    ],
  },
  {
    id: "rh",
    nombre: "Recursos Humanos",
    icono: UserRound,
    reportes: [],
  },
  {
    id: "ti",
    nombre: "TI",
    icono: Headphones,
    reportes: [
      {
        nombre: "Mesa de ayuda",
        descripcion:
          "Tiempo de resolución y de primera respuesta por tema, reparto de la carga y backlog",
        ruta: "/ti/reportes",
        modulo: "Reportes de TI",
      },
    ],
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
    reportes: [
      {
        nombre: "Tablero de Resultados",
        descripcion:
          "Facturación, precio por unidad, scrap, capacidad, personal, energía, compound y estado de resultados",
        ruta: "/resultados/reportes",
        modulo: "Reportes de Resultados",
      },
    ],
  },
  {
    id: "staff",
    nombre: "STAFF",
    icono: Users,
    reportes: [
      {
        nombre: "Junta de STAFF",
        descripcion:
          "Facturación, PO abierta, inyección, ensamble y rotación de plantilla",
        ruta: "/staff/reportes",
        modulo: "Reportes de STAFF",
      },
    ],
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
