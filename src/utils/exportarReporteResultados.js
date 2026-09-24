import ExcelJS from "exceljs";
import { saveAs } from "file-saver";

/**
 * Exportación del reporte de Resultados a Excel.
 *
 * Devuelve el libro con la forma que debió tener desde el principio: una hoja
 * por tema, los periodos en renglones y las métricas en columnas, con filtros
 * y sin porcentajes escritos a mano. Las gráficas van incrustadas como imagen.
 *
 * Los porcentajes se guardan como fracción con formato de Excel, así que se
 * pueden ordenar y promediar; y los importes como número, no como texto.
 */

const AZUL = "FF236093";
const GRIS = "FF9CA3AF";

const FMT_ENTERO = "#,##0";
const FMT_DEC1 = "#,##0.0";
const FMT_DEC2 = "#,##0.00";
const FMT_DEC3 = "#,##0.000";
const FMT_PCT = "0.00%";
const FMT_USD = '"$"#,##0.00';
const FMT_EUR = '#,##0" €"';

/**
 * Convierte una gráfica a PNG para incrustarla.
 *
 * Busca primero un SVG de recharts y, si no hay, uno marcado como exportable:
 * el mapa de calor del scrap está hecho a mano y no lleva las clases de
 * recharts.
 */
async function graficaAPng(selector, escala = 2) {
  try {
    const svg =
      document.querySelector(`${selector} svg.recharts-surface`) ||
      document.querySelector(`${selector} svg[data-exportable]`);
    if (!svg) return null;

    const clon = svg.cloneNode(true);
    const caja = svg.getBoundingClientRect();
    const ancho = Math.ceil(caja.width);
    const alto = Math.ceil(caja.height);
    if (!ancho || !alto) return null;

    clon.setAttribute("width", ancho);
    clon.setAttribute("height", alto);
    clon.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    const fondo = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    fondo.setAttribute("width", "100%");
    fondo.setAttribute("height", "100%");
    fondo.setAttribute("fill", "#ffffff");
    clon.insertBefore(fondo, clon.firstChild);

    const texto = new XMLSerializer().serializeToString(clon);
    const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(texto)}`;

    const img = await new Promise((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = url;
    });

    const canvas = document.createElement("canvas");
    canvas.width = ancho * escala;
    canvas.height = alto * escala;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    return { base64: canvas.toDataURL("image/png"), ancho, alto };
  } catch {
    return null;
  }
}

function encabezar(hoja, columnas) {
  hoja.columns = columnas;
  const fila = hoja.getRow(1);
  fila.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
  fila.fill = { type: "pattern", pattern: "solid", fgColor: { argb: AZUL } };
  fila.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  fila.height = 24;
  hoja.views = [{ state: "frozen", ySplit: 1 }];
  hoja.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columnas.length } };
}

function ponerImagen(libro, hoja, png, filaInicio) {
  if (!png) return filaInicio;
  const id = libro.addImage({ base64: png.base64, extension: "png" });
  hoja.addImage(id, {
    tl: { col: 0, row: filaInicio },
    ext: { width: png.ancho, height: png.alto },
  });
  return filaInicio + Math.ceil(png.alto / 20) + 2;
}

function nota(hoja, texto) {
  hoja.addRow([]);
  const fila = hoja.addRow([texto]);
  fila.font = { italic: true, color: { argb: GRIS }, size: 9 };
  return fila;
}

/**
 * @param {Object} opciones
 *   datos      respuesta de getDashboard
 *   historico  respuesta de getHistorico
 *   mensual    respuesta de getComparativoMensual
 *   nombresBu  { CODIGO: 'Nombre' }
 *   anio, usuario
 */
export async function exportarReporteResultados({
  datos, historico, mensual, nombresBu, anio, usuario,
}) {
  const libro = new ExcelJS.Workbook();
  libro.creator = usuario || "DBX Extralight";
  libro.created = new Date();

  const nb = (c) => nombresBu?.[c] || c;
  const BUS = ["CROCS", "FOAM_DESIGN", "SUELA", "DUAL_COLOR"];
  const BUS_CAP = ["CROCS", "SUELA", "FOAM_DESIGN", "DUAL_COLOR", "COMPOUND"];

  // Las imágenes se capturan antes de nada: si el usuario navega, se pierden
  const [pngFact, pngComp, pngPrecio, pngMapa, pngScrap, pngCap, pngPers, pngEne, pngCompound, pngMargen, pngHist] =
    await Promise.all([
      graficaAPng('[data-grafica="facturacion"]'),
      graficaAPng('[data-grafica="comparativo"]'),
      graficaAPng('[data-grafica="precio"]'),
      graficaAPng('[data-grafica="scrap-mapa"]'),
      graficaAPng('[data-grafica="scrap"]'),
      graficaAPng('[data-grafica="capacidad"]'),
      graficaAPng('[data-grafica="personal"]'),
      graficaAPng('[data-grafica="energia"]'),
      graficaAPng('[data-grafica="compound"]'),
      graficaAPng('[data-grafica="margen"]'),
      graficaAPng('[data-grafica="historico"]'),
    ]);

  // ------------------------------------------------------------ Parámetros
  const hp = libro.addWorksheet("Parámetros");
  hp.columns = [{ key: "campo", width: 26 }, { key: "valor", width: 84 }];
  hp.addRow({ campo: "Reporte", valor: "Resultados" });
  hp.getRow(1).font = { bold: true, size: 14, color: { argb: AZUL } };
  hp.addRow({});
  hp.addRow({ campo: "Generado por", valor: usuario || "—" });
  hp.addRow({ campo: "Generado el", valor: new Date().toLocaleString("es-MX") });
  hp.addRow({ campo: "Año", valor: String(anio || "—") });
  hp.addRow({});
  hp.addRow({ campo: "NOTAS", valor: "" });
  hp.lastRow.font = { bold: true };

  for (const [campo, valor] of [
    [
      "Qué se guarda",
      "Solo los absolutos. Todos los porcentajes y razones (% scrap, % de uso, " +
        "tiempo de ciclo, precio por unidad, KWh por unidad) se recalculan al " +
        "consultar, así que un total anual nunca es el promedio de doce porcentajes.",
    ],
    [
      "Hojas que no se leen",
      "'Q.TY (Billed)' y 'USD (Billed)' son 'Fact acumulada' puesta de lado, y " +
        "'TOTAL SCRAP' es la suma exacta de las cuatro hojas de scrap. No se " +
        "guardan para que no puedan descuadrarse con sus partes.",
    ],
    [
      "Estado de resultados",
      "En euros. El orden de la cascada no es el de la hoja: 'Variable costs' ya " +
        "incluye la mano de obra directa, y el margen ENI se calcula antes de " +
        "restarla. Footwear = Suela + Dual Color, y por eso no debe sumarse junto " +
        "con ellas.",
    ],
    [
      "Precio por unidad",
      "No viene en el libro: sale de dividir la facturación en dólares entre las " +
        "unidades. Como cada una vive en su hoja, nunca se había graficado.",
    ],
  ]) {
    hp.addRow({ campo, valor });
    hp.lastRow.getCell("valor").alignment = { wrapText: true, vertical: "top" };
    hp.lastRow.height = 52;
  }
  hp.getColumn("campo").font = { bold: true };

  // ----------------------------------------------------------- Facturación
  if (datos?.facturacion?.serie?.length) {
    const h = libro.addWorksheet("Facturación");
    encabezar(h, [
      { header: "Mes", key: "etiqueta", width: 14 },
      ...BUS.map((bu) => ({ header: `${nb(bu)} (uds)`, key: `qty_${bu}`, width: 15, style: { numFmt: FMT_ENTERO } })),
      { header: "Total unidades", key: "qtyTotal", width: 16, style: { numFmt: FMT_ENTERO } },
      ...BUS.map((bu) => ({ header: `${nb(bu)} (USD)`, key: `usd_${bu}`, width: 16, style: { numFmt: FMT_DEC2 } })),
      { header: "Total USD", key: "usdTotal", width: 16, style: { numFmt: FMT_DEC2 } },
      { header: "Precio por unidad", key: "precio", width: 17, style: { numFmt: FMT_USD } },
    ]);
    for (const f of datos.facturacion.serie) h.addRow(f);
    let fila = ponerImagen(libro, h, pngFact, h.lastRow.number + 2);
    ponerImagen(libro, h, pngComp, fila);
  }

  // ------------------------------------------------------- Precio por unidad
  if (historico?.length) {
    const h = libro.addWorksheet("Precio por unidad");
    encabezar(h, [
      { header: "Año", key: "anio", width: 10, style: { numFmt: "0" } },
      ...BUS.map((bu) => ({ header: nb(bu), key: `precio_${bu}`, width: 15, style: { numFmt: FMT_USD } })),
      { header: "Promedio", key: "precio", width: 15, style: { numFmt: FMT_USD } },
    ]);
    for (const f of historico) h.addRow(f);
    nota(h, "USD por unidad facturada. Sale de dividir la facturación en dólares entre las unidades: no existe como tal en el libro.");
    ponerImagen(libro, h, pngPrecio, h.lastRow.number + 2);
  }

  // ----------------------------------------------------------------- Scrap
  if (datos?.scrap) {
    const h = libro.addWorksheet("Scrap");
    encabezar(h, [
      { header: "Mes", key: "etiqueta", width: 14 },
      ...BUS.map((bu) => ({ header: `% ${nb(bu)}`, key: `pct_${bu}`, width: 14, style: { numFmt: FMT_PCT } })),
      { header: "Producidas", key: "producido", width: 15, style: { numFmt: FMT_ENTERO } },
      { header: "Rechazadas", key: "rechazo", width: 15, style: { numFmt: FMT_ENTERO } },
      { header: "% total", key: "pctTotal", width: 12, style: { numFmt: FMT_PCT } },
    ]);
    for (const f of datos.scrap.serie) h.addRow(f);

    h.addRow([]);
    const enc = h.addRow(["Resumen del año", "Producidas", "Rechazadas", "Netas", "% scrap"]);
    enc.font = { bold: true };
    for (const b of datos.scrap.porBu) {
      const r = h.addRow([nb(b.bu), b.producido, b.rechazo, b.neto, b.pct]);
      r.getCell(2).numFmt = FMT_ENTERO;
      r.getCell(3).numFmt = FMT_ENTERO;
      r.getCell(4).numFmt = FMT_ENTERO;
      r.getCell(5).numFmt = FMT_PCT;
    }
    const t = datos.scrap.total;
    const rt = h.addRow(["TOTAL", t.producido, t.rechazo, t.neto, t.pct]);
    rt.font = { bold: true };
    rt.getCell(2).numFmt = FMT_ENTERO;
    rt.getCell(3).numFmt = FMT_ENTERO;
    rt.getCell(4).numFmt = FMT_ENTERO;
    rt.getCell(5).numFmt = FMT_PCT;

    nota(h, "El total se suma de las cuatro unidades de negocio; reproduce exacto la hoja 'TOTAL SCRAP' del libro.");
    // Las dos: el mapa de calor y la serie mensual
    const fila = ponerImagen(libro, h, pngMapa, h.lastRow.number + 2);
    ponerImagen(libro, h, pngScrap, fila);
  }

  // ------------------------------------------------------------- Capacidad
  if (datos?.capacidad?.serie?.length) {
    const h = libro.addWorksheet("Capacidad");
    encabezar(h, [
      { header: "Mes", key: "etiqueta", width: 14 },
      { header: "Días hábiles", key: "dias", width: 13, style: { numFmt: FMT_ENTERO } },
      ...BUS_CAP.flatMap((bu) => [
        { header: `${nb(bu)} comprometida`, key: `comp_${bu}`, width: 18, style: { numFmt: FMT_DEC1 } },
        { header: `${nb(bu)} % uso`, key: `uso_${bu}`, width: 14, style: { numFmt: FMT_PCT } },
      ]),
    ]);
    for (const f of datos.capacidad.serie) h.addRow(f);
    nota(h, "El % de uso es capacidad comprometida entre instalada. Arriba de 100% se produce por encima de la capacidad nominal.");
    ponerImagen(libro, h, pngCap, h.lastRow.number + 2);
  }

  // -------------------------------------------------------------- Personal
  if (datos?.personal?.serie?.length) {
    const h = libro.addWorksheet("Personal");
    encabezar(h, [
      { header: "Mes", key: "etiqueta", width: 14 },
      { header: "Plantilla", key: "empleados", width: 12, style: { numFmt: FMT_ENTERO } },
      { header: "% rotación", key: "rotacion", width: 12, style: { numFmt: FMT_PCT } },
      { header: "Horas trabajadas", key: "horasTrabajadas", width: 16, style: { numFmt: FMT_ENTERO } },
      { header: "Horas extra", key: "horasExtra", width: 13, style: { numFmt: FMT_ENTERO } },
      { header: "% horas extra", key: "pctExtra", width: 14, style: { numFmt: FMT_PCT } },
      { header: "Horas pagadas", key: "horasPagadas", width: 15, style: { numFmt: FMT_ENTERO } },
      { header: "Unidades buenas", key: "buenas", width: 16, style: { numFmt: FMT_ENTERO } },
      { header: "Ciclo (min/ud)", key: "ciclo", width: 15, style: { numFmt: FMT_DEC3 } },
    ]);
    for (const f of datos.personal.serie) h.addRow(f);
    nota(h, "Tiempo de ciclo = minutos de mano de obra pagada entre unidades buenas.");
    ponerImagen(libro, h, pngPers, h.lastRow.number + 2);
  }

  // --------------------------------------------------------------- Energía
  if (datos?.energia?.serie?.length) {
    const h = libro.addWorksheet("Energía");
    encabezar(h, [
      { header: "Mes", key: "etiqueta", width: 14 },
      { header: "KWh", key: "kwh", width: 14, style: { numFmt: FMT_ENTERO } },
      { header: "Importe", key: "eur", width: 15, style: { numFmt: FMT_EUR } },
      { header: "€ por KWh", key: "eurKwh", width: 13, style: { numFmt: FMT_DEC3 } },
      { header: "KWh por unidad", key: "kwhUnidad", width: 16, style: { numFmt: FMT_DEC3 } },
      { header: "€ por unidad", key: "eurUnidad", width: 14, style: { numFmt: FMT_DEC3 } },
    ]);
    for (const f of datos.energia.serie) h.addRow(f);
    ponerImagen(libro, h, pngEne, h.lastRow.number + 2);
  }

  // -------------------------------------------------------------- Compound
  if (datos?.compound?.serie?.length) {
    const h = libro.addWorksheet("Compound");
    encabezar(h, [
      { header: "Mes", key: "etiqueta", width: 14 },
      { header: "Producido (ton)", key: "producido", width: 16, style: { numFmt: FMT_DEC2 } },
      { header: "Polvo (ton)", key: "polvo", width: 14, style: { numFmt: FMT_DEC2 } },
      { header: "Purga (ton)", key: "purga", width: 14, style: { numFmt: FMT_DEC2 } },
      { header: "Recuperado (ton)", key: "reciclado", width: 17, style: { numFmt: FMT_DEC2 } },
      { header: "Scrap (ton)", key: "scrap", width: 14, style: { numFmt: FMT_DEC2 } },
      { header: "% scrap", key: "pctScrap", width: 12, style: { numFmt: FMT_PCT } },
      { header: "% recuperado", key: "pctReciclado", width: 14, style: { numFmt: FMT_PCT } },
      { header: "Disposición (MXN)", key: "fee", width: 18, style: { numFmt: FMT_ENTERO } },
    ]);
    for (const f of datos.compound.serie) h.addRow(f);
    ponerImagen(libro, h, pngCompound, h.lastRow.number + 2);
  }

  // ---------------------------------------------------------------- Margen
  if (datos?.margen) {
    const h = libro.addWorksheet("Estado de resultados");
    const bus = datos.margen.bus;
    encabezar(h, [
      { header: "Concepto", key: "nombre", width: 32 },
      ...bus.map((b) => ({ header: b.nombre, key: b.codigo, width: 17, style: { numFmt: FMT_DEC2 } })),
      { header: "Total", key: "total", width: 18, style: { numFmt: FMT_DEC2 } },
      { header: "% ventas", key: "pctVentas", width: 12, style: { numFmt: FMT_PCT } },
      { header: "Por unidad", key: "porUnidad", width: 13, style: { numFmt: FMT_DEC3 } },
    ]);
    for (const c of datos.margen.conceptos) {
      const fila = { nombre: c.nombre, total: c.total, pctVentas: c.pctVentas, porUnidad: c.porUnidad };
      for (const b of bus) fila[b.codigo] = c.valores[b.codigo];
      const r = h.addRow(fila);
      if (["mg_margen_eni", "mg_margen_finproject", "mg_ebitda", "mg_ebit"].includes(c.codigo)) {
        r.font = { bold: true };
      }
    }
    nota(h, "En euros. 'Costos variables' ya incluye la mano de obra directa, y el margen ENI se calcula antes de restarla. Footwear = Suela + Dual Color: no sumarlo junto con ellas.");
    ponerImagen(libro, h, pngMargen, h.lastRow.number + 2);
  }

  // ------------------------------------------------------------- Histórico
  if (historico?.length) {
    const h = libro.addWorksheet("Histórico");
    encabezar(h, [
      { header: "Año", key: "anio", width: 10, style: { numFmt: "0" } },
      { header: "Unidades", key: "qty", width: 14, style: { numFmt: FMT_ENTERO } },
      { header: "USD", key: "usd", width: 16, style: { numFmt: FMT_DEC2 } },
      { header: "Precio por unidad", key: "precio", width: 17, style: { numFmt: FMT_USD } },
      { header: "Producidas", key: "producido", width: 14, style: { numFmt: FMT_ENTERO } },
      { header: "Rechazadas", key: "rechazo", width: 14, style: { numFmt: FMT_ENTERO } },
      { header: "% scrap", key: "pctScrap", width: 12, style: { numFmt: FMT_PCT } },
      { header: "Ciclo (min/ud)", key: "ciclo", width: 15, style: { numFmt: FMT_DEC3 } },
      { header: "% horas extra", key: "pctExtra", width: 14, style: { numFmt: FMT_PCT } },
      { header: "KWh", key: "kwh", width: 14, style: { numFmt: FMT_ENTERO } },
      { header: "KWh por unidad", key: "kwhUnidad", width: 16, style: { numFmt: FMT_DEC3 } },
      { header: "Ventas €", key: "ventas", width: 16, style: { numFmt: FMT_DEC2 } },
      { header: "EBITDA €", key: "ebitda", width: 16, style: { numFmt: FMT_DEC2 } },
      { header: "EBIT €", key: "ebit", width: 16, style: { numFmt: FMT_DEC2 } },
    ]);
    for (const f of historico) h.addRow(f);
    ponerImagen(libro, h, pngHist, h.lastRow.number + 2);
  }

  // -------------------------------------------------- Comparativo mensual
  if (mensual?.filas?.length) {
    const h = libro.addWorksheet("Mes a mes");
    const fmt = mensual.serie === "scrap" ? FMT_PCT : mensual.serie === "precio" ? FMT_USD : FMT_ENTERO;
    encabezar(h, [
      { header: "Mes", key: "etiqueta", width: 14 },
      ...mensual.anios.map((a) => ({ header: String(a), key: String(a), width: 14, style: { numFmt: fmt } })),
    ]);
    for (const f of mensual.filas) h.addRow(f);
    nota(h, `Serie: ${mensual.serie}. Es la gráfica que el libro arma con barras agrupadas.`);
  }

  const buffer = await libro.xlsx.writeBuffer();
  saveAs(
    new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    `Resultados ${anio || ""} ${new Date().toISOString().slice(0, 10)}.xlsx`.replace(/\s+/g, " "),
  );
}
