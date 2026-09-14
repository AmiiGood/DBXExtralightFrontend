import ExcelJS from "exceljs";
import { saveAs } from "file-saver";

/**
 * Exportación del reporte de Moldes a Excel.
 *
 * Genera un libro con lo que está en pantalla, respetando los filtros activos,
 * y con las gráficas incrustadas como imagen.
 *
 * Los tiempos van como NÚMERO de horas, no como texto ("3.8 h"). En pantalla
 * conviene la versión legible, pero en una hoja de cálculo lo que se necesita
 * es poder ordenar, filtrar y sacar cuentas. Donde los valores son grandes se
 * agrega una columna de días al lado.
 *
 * No incluye el detalle ticket por ticket: son 109 mil renglones. Solo salen
 * los diez más largos, que son los que se revisan a mano.
 */

const AZUL = "FF236093";
const VERDE = "FF059669";
const ROJO = "FFDC2626";
const GRIS = "FF9CA3AF";

const FMT_ENTERO = "#,##0";
const FMT_HORAS = '#,##0.00" h"';
const FMT_DIAS = '#,##0.0" d"';
const FMT_PCT = '0.0"%"';
const FMT_VAR = '+0.0"%";-0.0"%"';

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
function ponerImagen(libro, hoja, png, filaInicio) {
  if (!png) return;
  const id = libro.addImage({ base64: png.base64, extension: "png" });
  hoja.addImage(id, {
    tl: { col: 0, row: filaInicio },
    ext: { width: png.ancho, height: png.alto },
  });
}

/** Pie de hoja en gris chico. */
function nota(hoja, texto) {
  hoja.addRow([]);
  const fila = hoja.addRow([texto]);
  fila.font = { italic: true, color: { argb: GRIS }, size: 9 };
  return fila;
}

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

const dias = (h) => (h == null ? null : h / 24);

/** Texto legible de los filtros que estaban puestos. */
function describirFiltros(filtros, agrupar) {
  return [
    [
      "Temas",
      filtros.temas?.length
        ? filtros.temas.map((t) => t.replace(/^Moldes - /, "")).join(", ")
        : "Todos los del área",
    ],
    ["Año", filtros.anio || "Todos"],
    ["Semestre", filtros.semestre ? `S${filtros.semestre}` : "Todos"],
    ["Trimestre", filtros.trimestre ? `T${filtros.trimestre}` : "Todos"],
    ["Mes", filtros.mes ? MESES[filtros.mes - 1] : "Todos"],
    ["Agrupado por", agrupar],
  ];
}

/**
 * @param {Object} opciones
 *   datos       respuesta de getDashboard
 *   comparativo respuesta de comparar (o null si no se ha usado)
 *   filtros     filtros activos en pantalla
 *   agrupar     'anio' | 'mes' | 'semana' | 'fecha'
 *   usuario     nombre de quien exporta
 */
export async function exportarReporteMoldes({
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
  const [pngSerie, pngDistribucion, pngTemas, pngComparativo] =
    await Promise.all([
      graficaAPng('[data-grafica="serie"]'),
      graficaAPng('[data-grafica="distribucion"]'),
      graficaAPng('[data-grafica="temas"]'),
      graficaAPng('[data-grafica="comparativo"]'),
    ]);

  const r = datos?.resumen || {};

  // ------------------------------------------------------------ Parámetros
  const hp = libro.addWorksheet("Parámetros");
  hp.columns = [
    { key: "campo", width: 26 },
    { key: "valor", width: 70 },
  ];
  hp.addRow({ campo: "Reporte", valor: "Moldes — Tiempos de atención" });
  hp.getRow(1).font = { bold: true, size: 14, color: { argb: AZUL } };
  hp.addRow({});
  hp.addRow({ campo: "Generado por", valor: usuario || "—" });
  hp.addRow({ campo: "Generado el", valor: new Date().toLocaleString("es-MX") });
  hp.addRow({
    campo: "Datos de osTicket al",
    valor: datos?.sincronizacion?.corte || "—",
  });
  hp.addRow({ campo: "Último ticket", valor: r.ultimoTicket || "—" });
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
      "El indicador principal es la MEDIANA, no el promedio. El promedio lo " +
      "distorsionan unos pocos tickets que quedaron abiertos meses; la " +
      "mediana refleja el caso normal y el percentil 90 el caso malo. " +
      "Los tiempos van en horas como número, para poder ordenarlos y calcular.",
  });
  hp.lastRow.getCell("valor").alignment = { wrapText: true };
  hp.lastRow.height = 46;
  hp.getColumn("campo").font = { bold: true };

  // --------------------------------------------------------------- Resumen
  const hr = libro.addWorksheet("Resumen");
  encabezar(hr, [
    { header: "Indicador", key: "campo", width: 34 },
    { header: "Valor", key: "valor", width: 16 },
    { header: "Unidad", key: "unidad", width: 12 },
  ]);
  const filasResumen = [
    ["Tickets", r.tickets, "tickets", FMT_ENTERO],
    ["Cerrados", r.cerrados, "tickets", FMT_ENTERO],
    ["Sin cerrar", r.abiertos, "tickets", FMT_ENTERO],
    ["Reabiertos", r.reabiertos, "tickets", FMT_ENTERO],
    ["Tiempo típico (mediana)", r.medianaHoras, "horas", FMT_HORAS],
    ["9 de cada 10 antes de (p90)", r.p90Horas, "horas", FMT_HORAS],
    ["Promedio", r.mediaHoras, "horas", FMT_HORAS],
    ["Mínimo", r.minimoHoras, "horas", FMT_HORAS],
    ["Máximo", r.maximoHoras, "horas", FMT_HORAS],
  ];
  for (const [campo, valor, unidad, fmt] of filasResumen) {
    const fila = hr.addRow({ campo, valor: valor ?? null, unidad });
    fila.getCell("valor").numFmt = fmt;
  }
  hr.getColumn("campo").font = { bold: true };
  nota(
    hr,
    "El promedio se incluye por referencia, pero no sirve para seguir la " +
      "tendencia del área: unos pocos tickets olvidados lo mueven solos.",
  );

  // -------------------------------------------------------------- Evolución
  const hs = libro.addWorksheet("Evolución");
  encabezar(hs, [
    { header: "Periodo", key: "clave", width: 12 },
    { header: "Etiqueta", key: "etiqueta", width: 18 },
    { header: "Tickets", key: "tickets", width: 12, style: { numFmt: FMT_ENTERO } },
    { header: "Cerrados", key: "cerrados", width: 12, style: { numFmt: FMT_ENTERO } },
    { header: "Mediana", key: "mediana", width: 14, style: { numFmt: FMT_HORAS } },
    { header: "Percentil 90", key: "p90", width: 14, style: { numFmt: FMT_HORAS } },
    { header: "Promedio", key: "media", width: 14, style: { numFmt: FMT_HORAS } },
  ]);
  for (const s of datos?.serie || []) {
    hs.addRow({
      clave: s.clave,
      etiqueta: s.etiqueta,
      tickets: s.tickets,
      cerrados: s.cerrados,
      mediana: s.mediana,
      p90: s.p90,
      media: s.media,
    });
  }
  hs.autoFilter = { from: "A1", to: "G1" };
  ponerImagen(libro, hs, pngSerie, hs.rowCount + 2);

  // ----------------------------------------------------------- Distribución
  const hd = libro.addWorksheet("Distribución");
  encabezar(hd, [
    { header: "Rango", key: "rango", width: 20 },
    { header: "Tickets", key: "tickets", width: 12, style: { numFmt: FMT_ENTERO } },
    { header: "% del total", key: "pct", width: 14, style: { numFmt: FMT_PCT } },
  ]);
  for (const d of datos?.distribucion || []) {
    hd.addRow({ rango: d.rango, tickets: d.tickets, pct: d.porcentaje });
  }
  nota(hd, "Solo tickets cerrados.");
  ponerImagen(libro, hd, pngDistribucion, hd.rowCount + 2);

  // --------------------------------------------------------------- Por tema
  const ht = libro.addWorksheet("Por tema");
  encabezar(ht, [
    { header: "Tema", key: "tema", width: 26 },
    { header: "Tickets", key: "tickets", width: 12, style: { numFmt: FMT_ENTERO } },
    { header: "Cerrados", key: "cerrados", width: 12, style: { numFmt: FMT_ENTERO } },
    { header: "Sin cerrar", key: "abiertos", width: 12, style: { numFmt: FMT_ENTERO } },
    { header: "Mediana", key: "mediana", width: 14, style: { numFmt: FMT_HORAS } },
    { header: "Percentil 90", key: "p90", width: 14, style: { numFmt: FMT_HORAS } },
    { header: "Promedio", key: "media", width: 14, style: { numFmt: FMT_HORAS } },
  ]);
  for (const t of datos?.porTema || []) {
    ht.addRow({
      tema: t.temaCorto,
      tickets: t.tickets,
      cerrados: t.cerrados,
      abiertos: t.tickets - t.cerrados,
      mediana: t.mediana,
      p90: t.p90,
      media: t.media,
    });
  }
  ht.autoFilter = { from: "A1", to: "G1" };
  ponerImagen(libro, ht, pngTemas, ht.rowCount + 2);

  // -------------------------------------------------------- Los más largos
  const hl = libro.addWorksheet("Los más largos");
  encabezar(hl, [
    { header: "Ticket", key: "numero", width: 12 },
    { header: "Tema", key: "tema", width: 24 },
    { header: "Estado", key: "estado", width: 12 },
    { header: "Creado", key: "creado", width: 20 },
    { header: "Cerrado", key: "cerrado", width: 20 },
    { header: "Tardó", key: "horas", width: 14, style: { numFmt: FMT_HORAS } },
    { header: "Días", key: "dias", width: 10, style: { numFmt: FMT_DIAS } },
    { header: "Reabierto", key: "reabierto", width: 20 },
    { header: "Tras reabrir", key: "trasReabrir", width: 14, style: { numFmt: FMT_HORAS } },
  ]);
  for (const m of datos?.masLargos || []) {
    const fila = hl.addRow({
      numero: m.numero,
      tema: m.tema,
      estado: m.estado,
      creado: m.creado,
      cerrado: m.cerrado,
      horas: m.horas,
      dias: dias(m.horas),
      reabierto: m.reabierto || "",
      trasReabrir: m.horasTrasReabrir,
    });
    // Los reabiertos van atenuados: su tiempo total no mide trabajo continuo
    if (m.reabierto) {
      fila.font = { color: { argb: GRIS } };
    }
  }
  nota(
    hl,
    "Los reabiertos aparecen en gris: osTicket solo guarda la última fecha de " +
      "cierre, así que su tiempo total se mide desde la creación original y no " +
      "corresponde al trabajo real. Para esos, mire la columna Tras reabrir.",
  );

  // ------------------------------------------------------------ Comparativo
  if (comparativo?.delta?.length) {
    const hc = libro.addWorksheet("Comparativo");
    hc.addRow([
      `Comparativo por ${comparativo.tipo}: ${comparativo.a.etiqueta} contra ${comparativo.b.etiqueta}`,
    ]);
    hc.getRow(1).font = { bold: true, size: 12, color: { argb: AZUL } };
    hc.addRow([]);

    for (const p of [comparativo.a, comparativo.b]) {
      if (p.parcial) {
        const aviso = hc.addRow([
          `${p.etiqueta} todavía no termina: solo hay tickets hasta el ${p.hastaConDatos}. ` +
            "El conteo no es comparable; los tiempos sí.",
        ]);
        aviso.font = { italic: true, color: { argb: "FFB45309" }, size: 9 };
      }
    }
    hc.addRow([]);

    const enc = hc.addRow([
      "Tema",
      `Mediana ${comparativo.a.etiqueta}`,
      `Mediana ${comparativo.b.etiqueta}`,
      "Variación",
      `Tickets ${comparativo.a.etiqueta}`,
      `Tickets ${comparativo.b.etiqueta}`,
      "Variación",
    ]);
    enc.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
    enc.fill = { type: "pattern", pattern: "solid", fgColor: { argb: AZUL } };
    enc.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    enc.height = 24;

    for (const d of comparativo.delta) {
      const fila = hc.addRow([
        d.temaCorto,
        d.medianaA,
        d.medianaB,
        d.medianaVariacion,
        d.ticketsA,
        d.ticketsB,
        d.ticketsVariacion,
      ]);
      fila.getCell(2).numFmt = FMT_HORAS;
      fila.getCell(3).numFmt = FMT_HORAS;
      fila.getCell(4).numFmt = FMT_VAR;
      fila.getCell(5).numFmt = FMT_ENTERO;
      fila.getCell(6).numFmt = FMT_ENTERO;
      fila.getCell(7).numFmt = FMT_VAR;
      // Verde = mejora. Aquí bajar es bueno: menos tiempo de resolución.
      if (d.medianaVariacion != null) {
        fila.getCell(4).font = {
          color: { argb: d.medianaVariacion <= 0 ? VERDE : ROJO },
        };
      }
      // El conteo de tickets no se colorea: depende de la operación
      fila.getCell(7).font = { color: { argb: GRIS } };
    }

    hc.columns.forEach((c, i) => {
      c.width = i === 0 ? 26 : 18;
    });
    nota(
      hc,
      "Verde es mejora: en tiempos de atención bajar significa resolver más " +
        "rápido. El conteo de tickets va en gris porque depende de la " +
        "operación, no del desempeño del área.",
    );
    ponerImagen(libro, hc, pngComparativo, hc.rowCount + 2);
  }

  // ------------------------------------------------------------- Descarga
  const sufijo = [
    filtros.temas?.length === 1
      ? filtros.temas[0].replace(/^Moldes - /, "")
      : null,
    filtros.anio,
    filtros.semestre && `S${filtros.semestre}`,
    filtros.trimestre && `T${filtros.trimestre}`,
    filtros.mes && MESES[filtros.mes - 1],
  ]
    .filter(Boolean)
    .join("-");

  const nombre = `Moldes${sufijo ? ` - ${sufijo}` : ""} - ${new Date()
    .toISOString()
    .slice(0, 10)}.xlsx`;

  const buffer = await libro.xlsx.writeBuffer();
  saveAs(new Blob([buffer]), nombre);
  return nombre;
}
