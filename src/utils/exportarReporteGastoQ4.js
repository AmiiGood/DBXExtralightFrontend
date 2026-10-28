import ExcelJS from "exceljs";
import { saveAs } from "file-saver";

/**
 * Exportación del reporte de Gasto Q4 a Excel.
 *
 * Lo que esté filtrado en pantalla, en la moneda que se esté viendo. Tres hojas:
 * por área, el detalle por concepto y una de notas con el tipo de cambio y los
 * filtros, para que quien reciba el archivo sepa de dónde salen los números.
 * Los montos van como número (no como texto) para poder sumarlos.
 */

const AZUL = "FF236093";

export const TIPO = {
  FIJO: "Fijo",
  VARIABLE: "Variable",
  UNICO: "De una sola vez",
  CERO: "En ceros",
};

export const NOMBRE_MES = { octubre: "Octubre", noviembre: "Noviembre", diciembre: "Diciembre" };

function encabezar(hoja, columnas) {
  hoja.columns = columnas;
  const fila = hoja.getRow(1);
  fila.font = { bold: true, color: { argb: "FFFFFFFF" } };
  fila.fill = { type: "pattern", pattern: "solid", fgColor: { argb: AZUL } };
  hoja.views = [{ state: "frozen", ySplit: 1 }];
  hoja.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columnas.length } };
}

/**
 * @param {Object} p
 *   conceptos   los filtrados, ya con `area_nombre`
 *   meses       los meses elegidos ('octubre', …)
 *   conv        monto en pesos → monto en la moneda elegida
 *   moneda      'MXN' | 'USD'
 *   notas       [[etiqueta, valor], …] para la hoja de notas
 */
export async function exportarReporteGastoQ4({ conceptos, meses, conv, moneda, notas }) {
  const libro = new ExcelJS.Workbook();
  libro.created = new Date();
  const formato = moneda === "USD" ? '"US$"#,##0.00' : '"$"#,##0.00';
  const total = (c) => meses.reduce((a, m) => a + c[m], 0);

  // Por área
  const porArea = libro.addWorksheet("Por área");
  encabezar(porArea, [
    { header: "Área", key: "area", width: 24 },
    { header: "Conceptos", key: "n", width: 11 },
    ...meses.map((m) => ({ header: NOMBRE_MES[m], key: m, width: 16, style: { numFmt: formato } })),
    { header: "Total", key: "total", width: 18, style: { numFmt: formato } },
  ]);
  const areas = [];
  for (const c of conceptos) {
    let a = areas.find((x) => x.area === c.area_nombre);
    if (!a) {
      a = { area: c.area_nombre, n: 0, total: 0, ...Object.fromEntries(meses.map((m) => [m, 0])) };
      areas.push(a);
    }
    a.n++;
    for (const m of meses) a[m] += conv(c[m]);
    a.total += conv(total(c));
  }
  areas.sort((x, y) => y.total - x.total).forEach((a) => porArea.addRow(a));
  const fin = porArea.addRow({
    area: "Total",
    n: conceptos.length,
    ...Object.fromEntries(meses.map((m) => [m, areas.reduce((s, a) => s + a[m], 0)])),
    total: areas.reduce((s, a) => s + a.total, 0),
  });
  fin.font = { bold: true };

  // Detalle
  const detalle = libro.addWorksheet("Conceptos");
  encabezar(detalle, [
    { header: "Área", key: "area", width: 22 },
    { header: "Concepto", key: "concepto", width: 52 },
    { header: "Tipo de gasto", key: "tipo", width: 16 },
    ...meses.map((m) => ({ header: NOMBRE_MES[m], key: m, width: 15, style: { numFmt: formato } })),
    { header: "Total", key: "total", width: 17, style: { numFmt: formato } },
    { header: "Renglón en el libro", key: "renglon", width: 18 },
  ]);
  for (const c of conceptos) {
    detalle.addRow({
      area: c.area_nombre,
      concepto: c.mostrado,
      tipo: TIPO[c.tipo] || c.tipo,
      ...Object.fromEntries(meses.map((m) => [m, conv(c[m])])),
      total: conv(total(c)),
      renglon: c.renglon,
    });
  }

  // Notas
  const hojaNotas = libro.addWorksheet("Notas");
  hojaNotas.columns = [
    { key: "a", width: 26 },
    { key: "b", width: 70 },
  ];
  for (const [a, b] of notas) hojaNotas.addRow({ a, b }).getCell(1).font = { bold: true };

  const buffer = await libro.xlsx.writeBuffer();
  const hoy = new Date().toISOString().slice(0, 10);
  saveAs(
    new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    `Gasto Q4 ${moneda} ${hoy}.xlsx`,
  );
}
