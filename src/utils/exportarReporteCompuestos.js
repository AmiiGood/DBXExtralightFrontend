import ExcelJS from "exceljs";
import { saveAs } from "file-saver";

/**
 * Exportación del reporte de Compuestos a Excel.
 *
 * Genera un libro con lo que está en pantalla, respetando los filtros activos,
 * y con las gráficas incrustadas como imagen.
 *
 * Los porcentajes y las horas van como NÚMERO con formato, no como texto: en
 * una hoja de cálculo se necesita poder ordenar, filtrar y sacar cuentas.
 *
 * Dos avisos que viajan con el archivo, porque el Excel se reenvía y pierde el
 * contexto de la pantalla:
 *   - "Kg sobre meta" es la columna que el Excel de planta llama "Kg PERDIDOS";
 *     vale producción − meta, así que positivo es producir DE MÁS.
 *   - Las causas de paro sin confirmar llevan el nombre supuesto.
 */

const AZUL = "FF236093";
const GRIS = "FF9CA3AF";
const AMBAR = "FFB45309";

const FMT_ENTERO = "#,##0";
const FMT_KG = '#,##0" kg"';
const FMT_HORAS = '#,##0.0" h"';
const FMT_PCT = '0.0"%"';
const FMT_KGH = '#,##0" kg/h"';

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
function nota(hoja, texto, color = GRIS) {
  hoja.addRow([]);
  const fila = hoja.addRow([texto]);
  fila.font = { italic: true, color: { argb: color }, size: 9 };
  return fila;
}

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

/** Columnas de indicadores, compartidas por serie, línea, turno y supervisor. */
const COLUMNAS_INDICADORES = [
  { header: "Turnos", key: "registros", width: 10, style: { numFmt: FMT_ENTERO } },
  { header: "Producción", key: "produccionKg", width: 16, style: { numFmt: FMT_KG } },
  { header: "Horas de turno", key: "turnoHoras", width: 14, style: { numFmt: FMT_HORAS } },
  { header: "Tiempo muerto", key: "paroHoras", width: 14, style: { numFmt: FMT_HORAS } },
  { header: "% Tiempo muerto", key: "pctParo", width: 14, style: { numFmt: FMT_PCT } },
  { header: "Ritmo real", key: "kgHora", width: 12, style: { numFmt: FMT_KGH } },
  { header: "Meta del periodo", key: "metaKg", width: 16, style: { numFmt: FMT_KG } },
  { header: "% Cumplimiento", key: "pctCumplimiento", width: 14, style: { numFmt: FMT_PCT } },
  { header: "Kg sobre meta", key: "kgVsMeta", width: 15, style: { numFmt: FMT_KG } },
];

/** Hoja con un corte (línea, turno, supervisor) y los mismos indicadores. */
function hojaCorte(libro, nombre, encabezado, clave, filas, prefijo = "") {
  const h = libro.addWorksheet(nombre);
  encabezar(h, [{ header: encabezado, key: "corte", width: 22 }, ...COLUMNAS_INDICADORES]);
  for (const f of filas || []) {
    h.addRow({ corte: `${prefijo}${f[clave]}`, ...f });
  }
  return h;
}

/** Texto legible de los filtros que estaban puestos. */
function describirFiltros(filtros, agrupar) {
  return [
    ["Líneas", filtros.lineas?.length ? filtros.lineas.map((l) => `Línea ${l}`).join(", ") : "Todas"],
    ["Turnos", filtros.turnos?.length ? filtros.turnos.map((t) => `Turno ${t}`).join(", ") : "Todos"],
    ["Año", filtros.anio || "Todos"],
    ["Semestre", filtros.semestre ? `S${filtros.semestre}` : "Todos"],
    ["Trimestre", filtros.trimestre ? `T${filtros.trimestre}` : "Todos"],
    ["Mes", filtros.mes ? MESES[filtros.mes - 1] : "Todos"],
    ["Agrupado por", agrupar],
  ];
}

/**
 * @param {Object} opciones
 *   datos         respuesta de getDashboard
 *   recuperacion  respuesta de getRecuperacion (o null)
 *   filtros       filtros activos en pantalla
 *   agrupar       'anio' | 'mes' | 'semana' | 'fecha'
 *   usuario       nombre de quien exporta
 */
export async function exportarReporteCompuestos({
  datos,
  recuperacion,
  filtros,
  agrupar,
  usuario,
}) {
  const libro = new ExcelJS.Workbook();
  libro.creator = usuario || "DBX Extralight";
  libro.created = new Date();

  // Las imágenes se capturan antes de nada: si el usuario navega, se pierden
  const [pngPareto, pngCausas, pngProduccion, pngRecuperacion] = await Promise.all([
    graficaAPng('[data-grafica="pareto"]'),
    graficaAPng('[data-grafica="causas"]'),
    graficaAPng('[data-grafica="produccion"]'),
    graficaAPng('[data-grafica="recuperacion"]'),
  ]);

  const r = datos?.resumen || {};
  const causas = datos?.causas || [];
  const sinConfirmar = causas.filter((c) => !c.confirmada);

  // ------------------------------------------------------------ Parámetros
  const hp = libro.addWorksheet("Parámetros");
  hp.columns = [
    { key: "campo", width: 26 },
    { key: "valor", width: 74 },
  ];
  hp.addRow({ campo: "Reporte", valor: "Compuestos" });
  hp.getRow(1).font = { bold: true, size: 14, color: { argb: AZUL } };
  hp.addRow({});
  hp.addRow({ campo: "Generado por", valor: usuario || "—" });
  hp.addRow({ campo: "Generado el", valor: new Date().toLocaleString("es-MX") });
  hp.addRow({
    campo: "Periodo con datos",
    valor: r.desde
      ? `${String(r.desde).slice(0, 10)} al ${String(r.hasta).slice(0, 10)}`
      : "—",
  });
  hp.addRow({ campo: "Turnos", valor: r.registros ?? 0 });
  hp.addRow({});
  hp.addRow({ campo: "FILTROS APLICADOS", valor: "" });
  hp.lastRow.font = { bold: true };
  for (const [campo, valor] of describirFiltros(filtros, agrupar)) {
    hp.addRow({ campo, valor: String(valor) });
  }
  hp.addRow({});
  const notas = [
    [
      "Kg sobre meta",
      'Es la columna que el Excel de planta llama "Kg PERDIDOS". Vale producción ' +
        "menos meta: un valor POSITIVO significa que se produjo por encima de la " +
        "meta, no que se perdió material. No es scrap.",
    ],
    [
      "Tiempo muerto",
      "Suma de las siete causas capturadas. Difiere ~1% de la columna TIEMPO " +
        "MUERTO del Excel por errores de captura sueltos.",
    ],
  ];
  if (sinConfirmar.length) {
    notas.push([
      "Causas sin confirmar",
      `${sinConfirmar.map((c) => `${c.codigo} = ${c.nombre}`).join(", ")}. ` +
        "El significado de estas siglas es supuesto; falta que planta lo confirme.",
    ]);
  }
  for (const [campo, valor] of notas) {
    hp.addRow({ campo, valor });
    hp.lastRow.getCell("valor").alignment = { wrapText: true, vertical: "top" };
    hp.lastRow.height = 44;
  }
  hp.getColumn("campo").font = { bold: true };

  // --------------------------------------------------------------- Resumen
  const hr = libro.addWorksheet("Resumen");
  encabezar(hr, [
    { header: "Indicador", key: "campo", width: 34 },
    { header: "Valor", key: "valor", width: 18 },
  ]);
  const filasResumen = [
    ["Producción", r.produccionKg, FMT_KG],
    ["Turnos", r.registros, FMT_ENTERO],
    ["Horas de turno", r.turnoHoras, FMT_HORAS],
    ["Tiempo muerto", r.paroHoras, FMT_HORAS],
    ["% Tiempo muerto", r.pctParo, FMT_PCT],
    ["Horas en operación", r.horasOperacion, FMT_HORAS],
    ["Ritmo real", r.kgHora, FMT_KGH],
    ["Meta de ritmo (promedio)", r.metaKgHora, FMT_KGH],
    ["% Cumplimiento", r.pctCumplimiento, FMT_PCT],
    ["Turnos bajo meta", r.turnosBajoMeta, FMT_ENTERO],
    ["Turnos con meta", r.turnosConMeta, FMT_ENTERO],
    ["Kg sobre meta", r.kgVsMeta, FMT_KG],
    ["% sobre meta", r.pctVsMeta, FMT_PCT],
  ];
  for (const [campo, valor, fmt] of filasResumen) {
    const fila = hr.addRow({ campo, valor: valor ?? null });
    fila.getCell("valor").numFmt = fmt;
  }
  hr.getColumn("campo").font = { bold: true };

  // ------------------------------------------------- Pareto de tiempo muerto
  const hpa = libro.addWorksheet("Tiempo muerto por causa");
  encabezar(hpa, [
    { header: "Código", key: "codigo", width: 10 },
    { header: "Causa", key: "nombre", width: 24 },
    { header: "Confirmada", key: "confirmada", width: 16 },
    { header: "Planeada", key: "planeado", width: 11 },
    { header: "Horas", key: "horas", width: 12, style: { numFmt: FMT_HORAS } },
    { header: "% del paro", key: "pct", width: 12, style: { numFmt: FMT_PCT } },
    { header: "% acumulado", key: "pctAcumulado", width: 13, style: { numFmt: FMT_PCT } },
  ]);
  for (const c of datos?.paretoParo || []) {
    const fila = hpa.addRow({
      ...c,
      confirmada: c.confirmada ? "Sí" : "No (supuesta)",
      planeado: c.planeado ? "Sí" : "No",
    });
    if (!c.confirmada) fila.getCell("confirmada").font = { color: { argb: AMBAR } };
  }
  nota(hpa, "Ordenado de mayor a menor. Las primeras causas hasta el 80% acumulado son donde conviene enfocar el esfuerzo.");
  ponerImagen(libro, hpa, pngPareto, hpa.rowCount + 2);

  // ------------------------------------------------ Tiempo muerto por periodo
  const pctPorClave = new Map((datos?.serie || []).map((s) => [s.clave, s.pctParo]));
  const hc = libro.addWorksheet("Tiempo muerto por periodo");
  encabezar(hc, [
    { header: "Periodo", key: "clave", width: 12 },
    { header: "Etiqueta", key: "etiqueta", width: 18 },
    { header: "Horas de turno", key: "turnoHoras", width: 14, style: { numFmt: FMT_HORAS } },
    ...causas.map((c) => ({
      header: `${c.nombre}${c.confirmada ? "" : " *"}`,
      key: c.codigo,
      width: 15,
      style: { numFmt: FMT_HORAS },
    })),
    { header: "Total", key: "total", width: 12, style: { numFmt: FMT_HORAS } },
    { header: "% Tiempo muerto", key: "pctParo", width: 15, style: { numFmt: FMT_PCT } },
  ]);
  for (const p of datos?.causasSerie || []) {
    const total = causas.reduce((a, c) => a + (Number(p[c.codigo]) || 0), 0);
    hc.addRow({ ...p, total, pctParo: pctPorClave.get(p.clave) ?? null });
  }
  hc.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: 5 + causas.length } };
  if (sinConfirmar.length) nota(hc, "* Nombre de causa supuesto, sin confirmar por planta.", AMBAR);
  ponerImagen(libro, hc, pngCausas, hc.rowCount + 2);

  // ----------------------------------------------------------- Producción
  const hs = libro.addWorksheet("Producción por periodo");
  encabezar(hs, [
    { header: "Periodo", key: "clave", width: 12 },
    { header: "Etiqueta", key: "etiqueta", width: 18 },
    ...COLUMNAS_INDICADORES,
  ]);
  for (const s of datos?.serie || []) hs.addRow(s);
  hs.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: 2 + COLUMNAS_INDICADORES.length } };
  ponerImagen(libro, hs, pngProduccion, hs.rowCount + 2);

  // ------------------------------------------------------------- Cortes
  hojaCorte(libro, "Por línea", "Línea", "linea", datos?.porLinea, "Línea ");
  const ht = hojaCorte(libro, "Por turno", "Turno", "turno", datos?.porTurno, "Turno ");
  nota(ht, "No incluye los renglones sin turno: todos traen producción y horas en cero (líneas paradas).");
  const hsu = hojaCorte(libro, "Por supervisor", "Supervisor", "supervisor", datos?.porSupervisor);
  nota(hsu, "Los nombres se unifican al cargar: en el Excel el mismo supervisor aparece escrito de dos formas.");

  // ------------------------------------------------------ Recuperación de polvo
  if (recuperacion?.porBu?.length) {
    const hrec = libro.addWorksheet("Recuperación de polvo");
    encabezar(hrec, [
      { header: "Año", key: "etiqueta", width: 10 },
      { header: "Unidad de negocio", key: "bu", width: 22 },
      { header: "Producción", key: "produccionKg", width: 16, style: { numFmt: FMT_KG } },
      { header: "Polvo usado", key: "polvoKg", width: 14, style: { numFmt: FMT_KG } },
      { header: "Purga recuperada", key: "purgaKg", width: 16, style: { numFmt: FMT_KG } },
      { header: "% Reciclado", key: "pctReciclado", width: 12, style: { numFmt: '0.00"%"' } },
      { header: "Meta", key: "metaPct", width: 10, style: { numFmt: FMT_PCT } },
      { header: "¿Cumple?", key: "cumple", width: 10 },
    ]);
    for (const s of recuperacion.serie || []) {
      const tieneMeta = s.metaPct != null && s.metaPct > 0;
      const fila = hrec.addRow({
        ...s,
        cumple: tieneMeta ? (s.pctReciclado >= s.metaPct ? "Sí" : "No") : "Sin meta",
      });
      if (tieneMeta && s.pctReciclado < s.metaPct) {
        fila.getCell("cumple").font = { color: { argb: "FFDC2626" }, bold: true };
      }
    }
    nota(hrec, "Cada unidad de negocio se compara contra su propia meta: Crocs pasó de 5% a 8% en 2024, Suela va en 5% y Producto Técnico en 2%.");
    ponerImagen(libro, hrec, pngRecuperacion, hrec.rowCount + 2);
  }

  // --------------------------------------------------- Salud de la captura
  const cal = datos?.calidadCaptura;
  if (cal) {
    const hcal = libro.addWorksheet("Salud de la captura");
    encabezar(hcal, [
      { header: "Situación", key: "situacion", width: 26 },
      { header: "Turnos", key: "valor", width: 10, style: { numFmt: FMT_ENTERO } },
      { header: "Qué significa", key: "ayuda", width: 70 },
    ]);
    [
      ["Sin turno A/B", cal.sin_turno, "Todos traen producción y horas en cero: son líneas paradas."],
      ["Sin meta", cal.sin_meta, "No se les puede calcular cumplimiento."],
      ["Producción en cero", cal.produccion_cero, "Turnos sin producir."],
      ["Más paro que horas de turno", cal.paro_mayor_que_turno, "Captura inconsistente: revisar en el Excel de origen."],
      ["Total de turnos", cal.total, ""],
    ].forEach(([situacion, valor, ayuda]) => hcal.addRow({ situacion, valor, ayuda }));
  }

  // ------------------------------------------------------------- Descarga
  const sufijo = [
    filtros.lineas?.length ? `L${filtros.lineas.join("-")}` : null,
    filtros.turnos?.length ? `T${filtros.turnos.join("-")}` : null,
    filtros.anio,
    filtros.semestre && `S${filtros.semestre}`,
    filtros.trimestre && `T${filtros.trimestre}`,
    filtros.mes && MESES[filtros.mes - 1],
  ]
    .filter(Boolean)
    .join("-");

  const nombre = `Compuestos${sufijo ? ` - ${sufijo}` : ""} - ${new Date()
    .toISOString()
    .slice(0, 10)}.xlsx`;

  const buffer = await libro.xlsx.writeBuffer();
  saveAs(new Blob([buffer]), nombre);
  return nombre;
}
