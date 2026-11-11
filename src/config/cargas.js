/**
 * Catálogo de las pantallas que ALIMENTAN los reportes: cargas de Excel a mano
 * y archivos que el sistema vigila solo (carpetas de red y SharePoint).
 *
 * Antes cada una era una entrada del menú lateral; con 10 de ellas el menú se
 * volvió una lista interminable. Ahora viven juntas en "Cargas de datos" y el
 * menú solo enseña esa entrada.
 *
 * `modulo` es el nombre en la tabla `modulos`: con eso se enseña solo lo que el
 * usuario tiene permitido. `area` es el id de config/areas.js (de ahí sale el
 * icono). `tipo`: "manual" = alguien sube el archivo; "automatica" = el
 * sistema lo lee solo y la pantalla es para configurarlo y ver cómo va.
 */
export const CARGAS = [
  { area: "produccion", nombre: "Producción", items: [
    { modulo: "Carga de Producción", tipo: "manual" },
    { modulo: "Carga de Compuestos", tipo: "manual" },
    { modulo: "Archivos de SharePoint", tipo: "automatica" },
  ] },
  { area: "staff", nombre: "STAFF", items: [{ modulo: "Carga de STAFF", tipo: "manual" }] },
  { area: "resultados", nombre: "Resultados", items: [{ modulo: "Carga de Resultados", tipo: "manual" }] },
  { area: "rh", nombre: "Recursos Humanos", items: [{ modulo: "Carga de Checadas", tipo: "manual" }] },
  { area: "finanzas", nombre: "Finanzas", items: [{ modulo: "Carga de Gasto Q4", tipo: "manual" }] },
  { area: "customer-service", nombre: "Customer Service", items: [{ modulo: "Archivos de Customer Service", tipo: "automatica" }] },
  { area: "capex", nombre: "CAPEX", items: [{ modulo: "Archivo de CAPEX", tipo: "automatica" }] },
  { area: "aims", nombre: "AIMS", items: [{ modulo: "Archivo de AIMS", tipo: "automatica" }] },
];

/** Nombres de todos los módulos de carga (para sacarlos del menú lateral). */
export const MODULOS_DE_CARGA = new Set(CARGAS.flatMap((g) => g.items.map((i) => i.modulo)));

/**
 * Las cargas que el usuario puede abrir, por área, con los datos del módulo
 * (ruta y descripción) tal como vienen de /auth/modulos.
 */
export function cargasVisibles(modulos) {
  const porNombre = new Map((modulos || []).map((m) => [m.nombre, m]));
  return CARGAS.map((g) => ({
    ...g,
    items: g.items
      .filter((i) => porNombre.has(i.modulo))
      .map((i) => ({ ...i, ...porNombre.get(i.modulo) })),
  })).filter((g) => g.items.length > 0);
}
