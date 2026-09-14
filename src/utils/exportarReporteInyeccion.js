import ExcelJS from "exceljs";
import { saveAs } from "file-saver";

/**
 * Exportación del reporte de Producción Inyección a Excel.
 *
 * Genera un libro con lo que está en pantalla, respetando los filtros activos.
 * No incluye el detalle renglón por renglón: son 336 mil registros y el
 * navegador no los aguanta. Para eso haría falta un endpoint del servidor.
 *
 * Se exporta por unidad de negocio y nunca en total: unfin, strap, suela y
 * almohada son componentes distintos y no se suman entre sí.
 */

const AZUL = "FF236093";
const GRIS = "FFF3F4F6";

const FMT_ENTERO = "#,##0";
const FMT_PCT = '0.00"%"';

/**
 * Convierte una gráfica de recharts (SVG en el DOM) a PNG para incrustarla.
 *
 * Se serializa el SVG tal cual y se dibuja en un canvas. Recharts pinta los
 * colores como atributos, no como CSS externo, así que no hay que inlinear
 * estilos. Si algo falla se devuelve null y el libro sale sin esa imagen.
 *
 * @param {String} selector  contenedor con [data-grafica="..."]
 * @param {Number} escala    2 = doble resolución, para que no se vea pixeleado
 */
async function graficaAPng(selector, escala = 2) {
  try {
    const svg = document.querySelector(`${selector} svg`);
    if (!svg) return null;

    const clon = svg.cloneNode(true);
    const caja = svg.getBoundingClientRect();
    const ancho = Math.ceil(caja.width);
    const alto = Math.ceil(caja.height);
    if (!ancho || !alto) return null;

    clon.setAttribute("width", ancho);
    clon.setAttribute("height", alto);
    clon.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    // Fondo blanco: el canvas es transparente y en Excel se vería sucio
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

/** Encabezado con el formato del resto del sistema. */
function encabezar(hoja, columnas) {
  hoja.columns = columnas;
  const fila = hoja.getRow(1);
  fila.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
  fila.fill = { type: "pattern", pattern: "solid", fgColor: { argb: AZUL } };
  fila.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  fila.height = 22;
  hoja.views = [{ state: "frozen", ySplit: 1 }];
}

/** Inserta una imagen debajo del contenido de la hoja. */
function ponerImagen(libro, hoja, png, filaInicio, anchoCeldas = 8) {
  if (!png) return;
  const id = libro.addImage({ base64: png.base64, extension: "png" });
  hoja.addImage(id, {
    tl: { col: 0, row: filaInicio },
    ext: { width: png.ancho, height: png.alto },
  });
}

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

/** Texto legible de los filtros que estaban puestos. */
function describirFiltros(filtros, agrupar) {
  const partes = [];
  partes.push(["Año", filtros.anio || "Todos"]);
  partes.push([
    "Semestre",
    filtros.semestre ? `S${filtros.semestre}` : "Todos",
  ]);
  partes.push(["Trimestre", filtros.trimestre ? `T${filtros.trimestre}` : "Todos"]);
  partes.push(["Mes", filtros.mes ? MESES[filtros.mes - 1] : "Todos"]);
  partes.push(["Semana", filtros.semana ? `Semana ${filtros.semana}` : "Todas"]);
  partes.push([
    "Unidades de negocio",
    filtros.bu?.length ? filtros.bu.join(", ") : "Todas",
  ]);
  partes.push(["Agrupado por", agrupar]);
  return partes;
}

/**
 * @param {Object} opciones
 *   datos       respuesta de getDashboard
 *   comparativo respuesta de comparar (o null si no se ha usado)
 *   filtros     filtros activos en pantalla
 *   agrupar     'mes' | 'trimestre' | ...
 *   usuario     nombre de quien exporta
 */
export async function exportarReporteInyeccion({
  datos,
  comparativo,
  filtros,
  agrupar,
  usuario,
}) {
  const libro = new ExcelJS.Workbook();
  libro.creator = usuario || "DBX Extralight";
  libro.created = new Date();

  // Las imágenes se capturan antes de nada: si el usuario navega, se pierden
  const [pngSerie, pngMaquinas, pngBu, pngComparativo] = await Promise.all([
    graficaAPng('[data-grafica="serie"]'),
    graficaAPng('[data-grafica="maquinas"]'),
    graficaAPng('[data-grafica="bu"]'),
    graficaAPng('[data-grafica="comparativo"]'),
  ]);

  // ------------------------------------------------------------ Parámetros
  const hp = libro.addWorksheet("Parámetros");
  hp.columns = [
    { key: "campo", width: 26 },
    { key: "valor", width: 60 },
  ];
  hp.addRow({ campo: "Reporte", valor: "Producción Inyección" });
  hp.getRow(1).font = { bold: true, size: 14, color: { argb: AZUL } };
  hp.addRow({});
  hp.addRow({ campo: "Generado por", valor: usuario || "—" });
  hp.addRow({
    campo: "Generado el",
    valor: new Date().toLocaleString("es-MX"),
  });
  const t = datos?.totales;
  hp.addRow({
    campo: "Periodo con datos",
    valor: t?.desde
      ? `${String(t.desde).slice(0, 10)} al ${String(t.hasta).slice(0, 10)}`
      : "—",
  });
  hp.addRow({ campo: "Registros", valor: t?.registros ?? 0 });
  hp.addRow({
    campo: "de ellos, rezago",
    valor: t?.registros_rezago ?? 0,
  });
  hp.addRow({});
  hp.addRow({ campo: "FILTROS APLICADOS", valor: "" });
  hp.lastRow.font = { bold: true };
  for (const [campo, valor] of describirFiltros(filtros, agrupar)) {
    hp.addRow({ campo, valor: String(valor) });
  }
  hp.addRow({});
  hp.addRow({
    campo: "Nota",
    valor:
      "Cada unidad de negocio es un componente distinto (unfin, strap, suela, " +
      "almohada). No se suman entre sí, por eso el reporte no lleva totales.",
  });
  hp.lastRow.getCell("valor").alignment = { wrapText: true };
  hp.lastRow.height = 30;
  hp.getColumn("campo").font = { bold: true };

  // -------------------------------------------------------- Resumen por BU
  const hb = libro.addWorksheet("Resumen por BU");
  encabezar(hb, [
    { header: "Unidad de negocio", key: "bu", width: 20 },
    { header: "Registros", key: "registros", width: 12, style: { numFmt: FMT_ENTERO } },
    { header: "Piezas producidas", key: "produccion", width: 18, style: { numFmt: FMT_ENTERO } },
    { header: "Scrap", key: "scrap", width: 14, style: { numFmt: FMT_ENTERO } },
    { header: "% Scrap", key: "pct", width: 12, style: { numFmt: FMT_PCT } },
  ]);
  for (const r of datos?.porBu || []) {
    hb.addRow({
      bu: r.bu || "Sin clasificar",
      registros: r.registros,
      produccion: r.produccion,
      scrap: r.scrap,
      pct: r.pct_scrap,
    });
  }
  ponerImagen(libro, hb, pngBu, hb.rowCount + 2);

  // --------------------------------------------------------------- Serie
  const hs = libro.addWorksheet("Serie del periodo");
  encabezar(hs, [
    { header: "Periodo", key: "periodo", width: 14 },
    { header: "Etiqueta", key: "etiqueta", width: 14 },
    { header: "Unidad de negocio", key: "bu", width: 20 },
    { header: "Piezas producidas", key: "produccion", width: 18, style: { numFmt: FMT_ENTERO } },
    { header: "Scrap", key: "scrap", width: 14, style: { numFmt: FMT_ENTERO } },
    { header: "% Scrap", key: "pct", width: 12, style: { numFmt: FMT_PCT } },
  ]);
  for (const r of datos?.serie || []) {
    if (!r.bu) continue;
    hs.addRow({
      periodo: r.periodo,
      etiqueta: r.etiqueta,
      bu: r.bu,
      produccion: r.produccion,
      scrap: r.scrap,
      pct: r.pct_scrap,
    });
  }
  hs.autoFilter = { from: "A1", to: "F1" };
  ponerImagen(libro, hs, pngSerie, hs.rowCount + 2);

  // ------------------------------------------------------------ Máquinas
  const hm = libro.addWorksheet("Por máquina");
  encabezar(hm, [
    { header: "Máquina", key: "maquina", width: 14 },
    { header: "Piezas producidas", key: "produccion", width: 18, style: { numFmt: FMT_ENTERO } },
    { header: "Scrap", key: "scrap", width: 14, style: { numFmt: FMT_ENTERO } },
    { header: "% Scrap", key: "pct", width: 12, style: { numFmt: FMT_PCT } },
  ]);
  for (const r of datos?.porMaquina || []) {
    hm.addRow({
      maquina: r.maquina,
      produccion: r.produccion,
      scrap: r.scrap,
      pct: r.pct_scrap,
    });
  }
  hm.addRow({});
  const nota = hm.addRow({
    maquina: "No incluye el rezago, que no tiene máquina asignada",
  });
  nota.font = { italic: true, color: { argb: "FF9CA3AF" }, size: 9 };
  ponerImagen(libro, hm, pngMaquinas, hm.rowCount + 2);

  // ---------------------------------------------------------- Comparativo
  if (comparativo?.delta?.length) {
    const hc = libro.addWorksheet("Comparativo");
    const ea = comparativo.a.etiqueta;
    const eb = comparativo.b.etiqueta;

    hc.addRow([`Comparativo por ${comparativo.tipo}: ${ea} vs ${eb}`]);
    hc.getRow(1).font = { bold: true, size: 12, color: { argb: AZUL } };
    hc.addRow([
      `${ea}: ${comparativo.a.desde} a ${comparativo.a.hasta}` +
        (comparativo.a.parcial
          ? ` — INCOMPLETO, con datos hasta ${comparativo.a.hastaConDatos}`
          : ""),
    ]);
    hc.addRow([
      `${eb}: ${comparativo.b.desde} a ${comparativo.b.hasta}` +
        (comparativo.b.parcial
          ? ` — INCOMPLETO, con datos hasta ${comparativo.b.hastaConDatos}`
          : ""),
    ]);
    for (const n of [2, 3]) {
      if (
        (n === 2 && comparativo.a.parcial) ||
        (n === 3 && comparativo.b.parcial)
      ) {
        hc.getRow(n).font = { color: { argb: "FFB45309" }, bold: true };
      }
    }
    hc.addRow([]);

    const filaEncabezado = hc.rowCount + 1;
    hc.addRow([
      "Unidad de negocio",
      `Piezas ${ea}`,
      `Piezas ${eb}`,
      "Variación %",
      `% Scrap ${ea}`,
      `% Scrap ${eb}`,
      "Diferencia (pp)",
    ]);
    const fe = hc.getRow(filaEncabezado);
    fe.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
    fe.fill = { type: "pattern", pattern: "solid", fgColor: { argb: AZUL } };
    fe.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    fe.height = 24;

    for (const r of comparativo.delta) {
      const fila = hc.addRow([
        r.bu,
        r.produccionA,
        r.produccionB,
        r.produccionVariacion,
        r.pctScrapA,
        r.pctScrapB,
        r.pctScrapDelta,
      ]);
      fila.getCell(2).numFmt = FMT_ENTERO;
      fila.getCell(3).numFmt = FMT_ENTERO;
      fila.getCell(4).numFmt = '+0.00"%";-0.00"%"';
      fila.getCell(5).numFmt = FMT_PCT;
      fila.getCell(6).numFmt = FMT_PCT;
      fila.getCell(7).numFmt = '+0.00" pp";-0.00" pp"';
      // Verde = mejora. En producción subir es bueno; en scrap, bajar.
      if (r.produccionVariacion != null) {
        fila.getCell(4).font = {
          color: { argb: r.produccionVariacion >= 0 ? "FF059669" : "FFDC2626" },
        };
      }
      if (r.pctScrapDelta != null) {
        fila.getCell(7).font = {
          color: { argb: r.pctScrapDelta <= 0 ? "FF059669" : "FFDC2626" },
        };
      }
    }

    hc.columns.forEach((c, i) => {
      c.width = i === 0 ? 20 : 16;
    });
    hc.addRow([]);
    const pie = hc.addRow([
      "El % Scrap se compara en puntos porcentuales (pp), no en variación relativa.",
    ]);
    pie.font = { italic: true, color: { argb: "FF9CA3AF" }, size: 9 };
    ponerImagen(libro, hc, pngComparativo, hc.rowCount + 2);
  }

  // ------------------------------------------------------------- Descarga
  const sufijo = [
    filtros.anio,
    filtros.semestre && `S${filtros.semestre}`,
    filtros.trimestre && `T${filtros.trimestre}`,
    filtros.mes && MESES[filtros.mes - 1],
    filtros.semana && `sem${filtros.semana}`,
  ]
    .filter(Boolean)
    .join("-");

  const nombre = `Produccion Inyeccion${sufijo ? ` - ${sufijo}` : ""} - ${
    new Date().toISOString().slice(0, 10)
  }.xlsx`;

  const buffer = await libro.xlsx.writeBuffer();
  saveAs(new Blob([buffer]), nombre);
  return nombre;
}
