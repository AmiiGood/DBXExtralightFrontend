/**
 * Lógica de generación del archivo "ARTICLES MASSIVE LOAD".
 *
 * Separada de la página para poder probarla de forma aislada. No toca la API:
 * recibe los productos del Avery (productos_crocs) y los catálogos, y devuelve
 * las filas de la hoja "Articles" + advertencias de validación.
 */

export const COLUMNAS = [
  "Code",
  "Description",
  "Accounting Category",
  "Product Group",
  "Product Family",
  "Color",
  "ColorDescription",
  "UM",
  "SIZE",
  "QTY P/BOX",
  "UPC CODE",
  "GroupCode",
  "GroupDescription",
  "BU",
];

// Anchos de columna medidos del archivo de referencia "214 Taupe" (A..K;
// L..N quedan con el ancho por defecto, igual que el original).
const ANCHOS = [19.6, 30.9, 19.3, 13.7, 19.0, 5.7, 15.9, 6.6, 8.6, 10.6, 13.0];

const BU = "Crocs";

/**
 * Indexa los catálogos por su llave para búsquedas rápidas.
 */
export function indexarCatalogos(catalogos) {
  return {
    colores: new Map(catalogos.colores.map((c) => [c.codigo, c])),
    estilos: new Map(catalogos.estilos.map((e) => [e.codigo, e])),
    unfin: new Map(catalogos.unfin.map((u) => [u.id, u])),
    strap: new Map(catalogos.strap.map((s) => [s.id, s])),
    tallas: new Map(catalogos.tallas.map((t) => [t.talla, t])),
  };
}

/**
 * Deriva el nombre del color a partir del style_name del Avery
 * ("Classic Taupe" - estilo "Classic" → "Taupe"). Puede venir abreviado.
 */
export function derivarNombreColor(producto, estilo) {
  if (!estilo || !producto.style_name) return null;
  const prefijo = `${estilo.nombre} `;
  if (producto.style_name.startsWith(prefijo)) {
    const resto = producto.style_name.slice(prefijo.length).trim();
    return resto || null;
  }
  return null;
}

function codigoSem(prefijo, codigo, color, sufijo) {
  const pre = prefijo ? `${prefijo}-` : "";
  return `${pre}${codigo}-${color}-${sufijo}`;
}

/**
 * Product Family.
 *
 * Sigue dos reglas distintas (relación de familias recibida el 2026-09-11):
 *   PF     una familia por estilo, sin talla     ASSEM-1-CLSC
 *   Unfin  base del modelo + talla del PF        A1CLASSIC_M2W4
 *   Strap  base del modelo + talla del strap     A1CLASSIC_S_M2
 * La base del strap ya trae el "_S" en el catálogo.
 */
const familiaSem = (base, talla) => (base ? `${base}_${talla}` : "");

/**
 * Construye las filas del archivo a partir de los bloques configurados.
 *
 * @param {Array} bloques - [{ productos, unfinId|null, strapId|null, prefijo: ""|"A5" }]
 * @param {Object} catalogos - { colores, estilos, unfin, strap, tallas } (arrays de la API)
 * @returns {{ filas: Array<Array>, advertencias: Array<{tipo, nivel, mensaje, sku?, color?, sugerencia?}> }}
 *   filas: arreglo de filas de 14 columnas; una fila null = separador de bloque.
 */
export function construirFilas(bloques, catalogos) {
  const idx = indexarCatalogos(catalogos);
  const filas = [];
  const advertencias = [];
  const coloresAvisados = new Set();
  // Una sola advertencia por estilo/modelo sin familia, no una por talla
  const familiasAvisadas = new Set();

  const avisar = (a) => advertencias.push(a);

  const avisarFamilia = (clave, mensaje) => {
    if (familiasAvisadas.has(clave)) return;
    familiasAvisadas.add(clave);
    avisar({ tipo: "familia", nivel: "aviso", mensaje });
  };

  // El archivo agrupa por tipo de artículo a lo largo de TODOS los bloques:
  // primero todo el PT, luego todos los Unfin y al final todos los Strap.
  const filasPF = [];
  const filasUnfin = [];
  const filasStrap = [];

  bloques.forEach((bloque, nBloque) => {
    if (!bloque.productos || bloque.productos.length === 0) return;

    const unfin = bloque.unfinId ? idx.unfin.get(bloque.unfinId) : null;
    const strap = bloque.strapId ? idx.strap.get(bloque.strapId) : null;
    const prefijo = bloque.prefijo || "";

    if (bloque.unfinId && unfin && !unfin.codigo) {
      avisar({
        tipo: "unfin_sin_codigo",
        nivel: "error",
        mensaje: `Bloque ${nBloque + 1}: el modelo "${unfin.nombre}" no tiene código asignado; no se generarán sus filas Unfin.`,
      });
    }
    if (unfin?.obsoleto) {
      avisar({
        tipo: "obsoleto",
        nivel: "aviso",
        mensaje: `Bloque ${nBloque + 1}: el unfin "${unfin.nombre}" está marcado como obsoleto.`,
      });
    }
    if (strap?.obsoleto) {
      avisar({
        tipo: "obsoleto",
        nivel: "aviso",
        mensaje: `Bloque ${nBloque + 1}: el strap "${strap.nombre}" está marcado como obsoleto.`,
      });
    }
    if (unfin?.codigo && !unfin.familia_base) {
      avisarFamilia(
        `unfin:${unfin.id}`,
        `El unfin "${unfin.nombre}" no tiene Product Family en el catálogo; sus filas la llevarán vacía.`,
      );
    }
    if (strap?.codigo && !strap.familia_base) {
      avisarFamilia(
        `strap:${strap.id}`,
        `El strap "${strap.nombre}" no tiene Product Family en el catálogo; sus filas la llevarán vacía.`,
      );
    }

    for (const p of bloque.productos) {
      const estilo = idx.estilos.get(p.style_no);
      const talla = idx.tallas.get(p.size);
      const colorCat = idx.colores.get(p.color);

      if (!estilo) {
        avisar({
          tipo: "estilo",
          nivel: "error",
          sku: p.sku,
          mensaje: `${p.sku}: el estilo ${p.style_no} no está en el catálogo de estilos; se usará el nombre del Avery ("${p.style_name}").`,
        });
      } else {
        if (estilo.obsoleto) {
          avisar({
            tipo: "obsoleto",
            nivel: "aviso",
            sku: p.sku,
            mensaje: `${p.sku}: el estilo ${p.style_no} (${estilo.nombre}) está marcado como obsoleto.`,
          });
        }
        if (!estilo.familia) {
          avisarFamilia(
            `estilo:${estilo.codigo}`,
            `El estilo ${estilo.codigo} (${estilo.nombre}) no tiene Product Family en el catálogo; sus filas PF la llevarán vacía.`,
          );
        }
      }

      if (!talla) {
        avisar({
          tipo: "talla",
          nivel: "error",
          sku: p.sku,
          mensaje: `${p.sku}: la talla "${p.size}" no está en el catálogo de equivalencias; su QTY quedará vacío y no se generarán Unfin/Strap para esta fila.`,
        });
      }

      let nombreColor = colorCat?.nombre || null;
      if (!nombreColor) {
        const sugerencia = derivarNombreColor(p, estilo);
        nombreColor = sugerencia;
        if (!coloresAvisados.has(p.color)) {
          coloresAvisados.add(p.color);
          avisar({
            tipo: "color",
            nivel: "aviso",
            color: p.color,
            sugerencia: sugerencia || "",
            mensaje: sugerencia
              ? `El color ${p.color} no está en el catálogo; se usará "${sugerencia}" (derivado del Avery, puede venir abreviado). Verifícalo o dalo de alta.`
              : `El color ${p.color} no está en el catálogo y no se pudo derivar su nombre; ColorDescription quedará vacío.`,
          });
        }
      }

      if (!p.upc) {
        avisar({
          tipo: "upc",
          nivel: "aviso",
          sku: p.sku,
          mensaje: `${p.sku}: no tiene UPC en la base; la columna UPC CODE quedará vacía.`,
        });
      }

      const nombreEstilo = estilo?.nombre || p.style_name || "";
      const tallaDisplay = talla?.talla_display || p.size;

      // ---- Fila PF -------------------------------------------------------
      filasPF.push([
        p.sku,
        `${nombreEstilo} ${nombreColor || ""} ${tallaDisplay}`.replace(/\s+/g, " ").trim(),
        "PF",
        nombreEstilo,
        estilo?.familia || "",
        p.color,
        nombreColor || "",
        "PARES",
        p.size,
        talla ? talla.qty_pares : "",
        p.upc || "",
        p.style_no,
        nombreEstilo,
        BU,
      ]);

      // ---- Fila Unfin ----------------------------------------------------
      if (unfin?.codigo && talla) {
        const grupoUnfin = `${prefijo ? `${prefijo}-` : ""}${unfin.codigo}`;
        filasUnfin.push([
          codigoSem(prefijo, unfin.codigo, p.color, talla.sufijo_unfin),
          `${unfin.nombre} ${nombreColor || ""} ${tallaDisplay}`.replace(/\s+/g, " ").trim(),
          "SEM",
          unfin.nombre,
          familiaSem(unfin.familia_base, talla.talla),
          p.color,
          nombreColor || "",
          "PARES",
          p.size,
          talla.qty_pares,
          "",
          grupoUnfin,
          unfin.nombre,
          BU,
        ]);
      }

      // ---- Fila Strap ----------------------------------------------------
      if (strap?.codigo && talla) {
        const grupoStrap = `${prefijo ? `${prefijo}-` : ""}${strap.codigo}`;
        filasStrap.push([
          codigoSem(prefijo, strap.codigo, p.color, talla.sufijo_strap),
          `${strap.nombre} ${nombreColor || ""} ${talla.talla_strap}`.replace(/\s+/g, " ").trim(),
          "SEM",
          strap.nombre,
          familiaSem(strap.familia_base, talla.talla_strap),
          p.color,
          nombreColor || "",
          "PIEZA",
          talla.talla_strap,
          talla.qty_strap,
          "",
          grupoStrap,
          strap.nombre,
          BU,
        ]);
      }
    }

  });

  // Sin filas vacías de separación
  filas.push(...filasPF, ...filasUnfin, ...filasStrap);

  return { filas, advertencias };
}

/**
 * Construye el workbook de ExcelJS con el formato exacto del archivo de
 * referencia: hoja "Articles", Calibri 11 sin estilos, UPC como texto.
 *
 * @param {Function} ExcelJSWorkbook - constructor ExcelJS.Workbook (se inyecta
 *   para que la página lo cargue con import dinámico).
 */
export function generarWorkbook(ExcelJSWorkbook, filas) {
  const wb = new ExcelJSWorkbook();
  const ws = wb.addWorksheet("Articles");

  ANCHOS.forEach((w, i) => {
    ws.getColumn(i + 1).width = w;
  });

  ws.addRow(COLUMNAS);

  for (const fila of filas) {
    if (fila === null) {
      ws.addRow([]);
      continue;
    }
    // QTY (índice 9) numérica; todo lo demás texto (Color y UPC conservan
    // ceros a la izquierda).
    const valores = fila.map((v, i) => {
      if (i === 9) return v === "" ? null : Number(v);
      return v === "" ? null : String(v);
    });
    ws.addRow(valores);
  }

  return wb;
}

/**
 * Nombre de archivo sugerido, siguiendo la convención de los ejemplos:
 * "ARTICLES MASSIVE LOAD - {color} {nombre color} -{estilo}.xlsx"
 */
export function nombreArchivo(bloques, catalogos) {
  const idx = indexarCatalogos(catalogos);
  const partes = [];
  for (const b of bloques) {
    const p = b.productos?.[0];
    if (!p) continue;
    const color = idx.colores.get(p.color);
    partes.push(`${p.color} ${color?.nombre || ""}`.trim() + ` -${p.style_no}`);
  }
  const desc = partes.length
    ? [...new Set(partes)].join(", ")
    : new Date().toISOString().slice(0, 10);
  return `ARTICLES MASSIVE LOAD - ${desc}.xlsx`;
}
