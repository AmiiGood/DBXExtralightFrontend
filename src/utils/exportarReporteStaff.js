import ExcelJS from "exceljs";
import { saveAs } from "file-saver";

/**
 * Exportación de los reportes de STAFF a Excel.
 *
 * Genera un libro con lo que está en pantalla —una hoja por bloque, más la PO
 * abierta y las tablas de trimestre— con las gráficas incrustadas como imagen.
 *
 * Sirve para dos cosas: llevar la junta sin el sistema abierto, y reemplazar
 * el paso de pegar capturas de pantalla en la presentación.
 *
 * Los números van como NÚMERO con formato, no como texto, para poder ordenar y
 * sacar cuentas. Los porcentajes se guardan como fracción y se formatean con
 * el 0.0% de Excel, igual que vienen de la base.
 */

const AZUL = "FF236093";
const GRIS = "FF9CA3AF";

const FMT_ENTERO = "#,##0";
const FMT_DECIMAL = "#,##0.0";
const FMT_PCT = "0.00%";

const NOMBRE_BLOQUE = {
  INVOICE: "Facturación",
  INYECCION: "Inyección",
  ENSAMBLE: "Ensamble",
  ROTACION: "Rotación",
};

const NOMBRE_VISTA = {
  junta: "Junta (meses cerrados + últimas semanas + mes en curso)",
  mes: "Solo meses",
  semana: "Solo semanas",
};

/**
 * Convierte una gráfica de recharts (SVG en el DOM) a PNG para incrustarla.
 *
 * Se toma el `svg.recharts-surface` y no el primer svg del contenedor: la
 * leyenda también dibuja íconos SVG y alguno podría quedar antes. Si algo
 * falla se devuelve null y el libro sale sin esa imagen.
 */
async function graficaAPng(selector, escala = 2) {
  try {
    const svg = document.querySelector(`${selector} svg.recharts-surface`);
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

/**
 * Una hoja por bloque: los periodos en renglones y las métricas en columnas,
 * que es al revés de como viene el Excel de origen. Así se puede filtrar y
 * ordenar, cosa imposible en la matriz horizontal original.
 *
 * `pngs` es una lista porque rotación dibuja dos gráficas (personas y
 * porcentajes) sobre la misma tabla.
 */
function hojaBloque(libro, datos, pngs) {
  if (!datos?.periodos?.length) return;

  const hoja = libro.addWorksheet(NOMBRE_BLOQUE[datos.bloque] || datos.bloque);
  const metricas = datos.metricas || [];

  encabezar(hoja, [
    { header: "Periodo", key: "eje", width: 16 },
    { header: "Tipo", key: "tipo", width: 10 },
    { header: "Año", key: "anio", width: 8, style: { numFmt: "0" } },
    ...metricas.map((m) => ({
      header: m.nombre,
      key: m.codigo,
      width: 16,
      style: {
        numFmt:
          m.unidad === "PORCENTAJE"
            ? FMT_PCT
            : datos.bloque === "INVOICE"
              ? FMT_ENTERO
              : FMT_DECIMAL,
      },
    })),
  ]);

  for (const p of datos.periodos) {
    const fila = { eje: p.eje, tipo: p.tipo === "MES" ? "Mes" : "Semana", anio: p.anio };
    for (const m of metricas) fila[m.codigo] = p[m.codigo] ?? null;
    hoja.addRow(fila);
  }

  hoja.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: 3 + metricas.length },
  };

  if (datos.bloque === "INYECCION" || datos.bloque === "ENSAMBLE") {
    nota(
      hoja,
      "Los valores son el PROMEDIO DIARIO del periodo, no el total. El renglón " +
        "del mes trae su propio promedio y no es la suma de sus semanas.",
    );
  }

  let fila = hoja.lastRow.number + 2;
  for (const png of [].concat(pngs).filter(Boolean)) {
    ponerImagen(libro, hoja, png, fila);
    // 20 px por renglón es la altura por omisión de Excel; deja aire entre una
    // imagen y la siguiente
    fila += Math.ceil(png.alto / 20) + 2;
  }
}

/** Tabla de promedio diario por trimestre. */
function hojaTrimestres(libro, datos, nombre) {
  const filas = (datos?.filas || []).filter((f) => !f.esMeta);
  if (!filas.length) return;

  const hoja = libro.addWorksheet(nombre);
  encabezar(hoja, [
    { header: "Unidad de negocio", key: "nombre", width: 26 },
    ...[1, 2, 3, 4].map((t) => ({
      header: `Q${t}`,
      key: `q${t}`,
      width: 12,
      style: { numFmt: FMT_DECIMAL },
    })),
    { header: "Promedio general", key: "general", width: 18, style: { numFmt: FMT_DECIMAL } },
    { header: "Semanas", key: "semanas", width: 10, style: { numFmt: FMT_ENTERO } },
  ]);

  for (const f of filas) {
    hoja.addRow({
      nombre: f.nombre,
      q1: f.trimestres[1]?.promedio ?? null,
      q2: f.trimestres[2]?.promedio ?? null,
      q3: f.trimestres[3]?.promedio ?? null,
      q4: f.trimestres[4]?.promedio ?? null,
      general: f.general,
      semanas: Object.values(f.trimestres).reduce((a, t) => a + t.semanas, 0),
    });
  }

  nota(
    hoja,
    "Promedio de los valores SEMANALES del trimestre (13 semanas por trimestre). " +
      "La tabla equivalente de la presentación se arma a mano y puede diferir " +
      "hasta ~1%.",
  );
}

/** Foto de la PO abierta del corte que esté en pantalla. */
function hojaOpenPo(libro, openPo, png) {
  if (!openPo?.serie?.length) return;

  const hoja = libro.addWorksheet("PO abierta");
  const bus = openPo.bus || [];

  encabezar(hoja, [
    { header: "Mes de entrega", key: "entrega", width: 18 },
    ...bus.map((bu) => ({
      header: bu,
      key: bu,
      width: 15,
      style: { numFmt: FMT_ENTERO },
    })),
    ...bus.map((bu) => ({
      header: `Meta ${bu}`,
      key: `meta__${bu}`,
      width: 15,
      style: { numFmt: FMT_ENTERO },
    })),
  ]);

  for (const f of openPo.serie) hoja.addRow(f);

  const totales = { entrega: "TOTAL" };
  for (const t of openPo.totales || []) {
    totales[t.bu] = t.cantidad;
    totales[`meta__${t.bu}`] = t.meta;
  }
  hoja.addRow(totales);
  hoja.lastRow.font = { bold: true };

  nota(
    hoja,
    `Corte de la semana ${openPo.corte?.semana} de ${openPo.corte?.anio}. Es una ` +
      "foto de la cartera a esa fecha: el Excel de origen la sobreescribe cada " +
      "semana y aquí queda archivada.",
  );

  ponerImagen(libro, hoja, png, hoja.lastRow.number + 2);
}

/**
 * @param {Object} opciones
 *   datos    { invoice, inyeccion, ensamble, rotacion, qInj, qAssy }
 *   openPo   respuesta de getOpenPo (o null)
 *   anio     año en pantalla
 *   vista    'junta' | 'mes' | 'semana'
 *   usuario  nombre de quien exporta
 */
export async function exportarReporteStaff({ datos, openPo, anio, vista, usuario }) {
  const libro = new ExcelJS.Workbook();
  libro.creator = usuario || "DBX Extralight";
  libro.created = new Date();

  // Las imágenes se capturan antes de nada: si el usuario navega, se pierden
  const [pngFact, pngPo, pngInj, pngAssy, pngRot, pngRotPct] = await Promise.all([
    graficaAPng('[data-grafica="facturacion"]'),
    graficaAPng('[data-grafica="openpo"]'),
    graficaAPng('[data-grafica="inyeccion"]'),
    graficaAPng('[data-grafica="ensamble"]'),
    graficaAPng('[data-grafica="rotacion"]'),
    graficaAPng('[data-grafica="rotacion-pct"]'),
  ]);

  // ------------------------------------------------------------ Parámetros
  const hp = libro.addWorksheet("Parámetros");
  hp.columns = [
    { key: "campo", width: 26 },
    { key: "valor", width: 78 },
  ];
  hp.addRow({ campo: "Reporte", valor: "STAFF" });
  hp.getRow(1).font = { bold: true, size: 14, color: { argb: AZUL } };
  hp.addRow({});
  hp.addRow({ campo: "Generado por", valor: usuario || "—" });
  hp.addRow({ campo: "Generado el", valor: new Date().toLocaleString("es-MX") });
  hp.addRow({ campo: "Año", valor: String(anio || "—") });
  hp.addRow({ campo: "Vista", valor: NOMBRE_VISTA[vista] || vista || "—" });
  hp.addRow({
    campo: "Corte de PO abierta",
    valor: openPo?.corte
      ? `Semana ${openPo.corte.semana} de ${openPo.corte.anio}`
      : "—",
  });
  hp.addRow({});
  hp.addRow({ campo: "NOTAS", valor: "" });
  hp.lastRow.font = { bold: true };

  const notas = [
    [
      "Promedio diario",
      "En Inyección y Ensamble el valor NO es el total del periodo: es el " +
        "promedio diario. El renglón del mes trae su propio promedio y no es la " +
        "suma de sus semanas, así que no se deben sumar entre sí.",
    ],
    [
      "PO abierta",
      "Es una foto de la cartera al corte de una semana, no una serie. El Excel " +
        "de origen la sobreescribe cada semana; aquí cada corte queda archivado.",
    ],
    [
      "Almohada",
      "Se cuenta en PIEZAS; el resto de las unidades de negocio, en PARES.",
    ],
  ];
  for (const [campo, valor] of notas) {
    hp.addRow({ campo, valor });
    hp.lastRow.getCell("valor").alignment = { wrapText: true, vertical: "top" };
    hp.lastRow.height = 44;
  }
  hp.getColumn("campo").font = { bold: true };

  // ---------------------------------------------------------- Los bloques
  hojaBloque(libro, datos?.invoice, pngFact);
  hojaOpenPo(libro, openPo, pngPo);
  hojaBloque(libro, datos?.inyeccion, pngInj);
  hojaTrimestres(libro, datos?.qInj, "Inyección por trimestre");
  hojaBloque(libro, datos?.ensamble, pngAssy);
  hojaTrimestres(libro, datos?.qAssy, "Ensamble por trimestre");
  hojaBloque(libro, datos?.rotacion, [pngRot, pngRotPct]);

  const buffer = await libro.xlsx.writeBuffer();
  saveAs(
    new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    `Reporte STAFF ${anio || ""} ${new Date().toISOString().slice(0, 10)}.xlsx`.replace(
      /\s+/g,
      " ",
    ),
  );
}
