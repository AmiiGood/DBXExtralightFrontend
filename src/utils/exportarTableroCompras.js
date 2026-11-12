import ExcelJS from "exceljs";
import { saveAs } from "file-saver";

/**
 * Exportación del Tablero de Compras: lo que se ve en pantalla, en la moneda
 * elegida. Montos como número para poder sumarlos.
 */
const AZUL = "FF236093";
// Las sumas de decimales dejan colas (111920.04000000002): a centavos
const cent = (n) => (n == null ? null : Math.round(n * 100) / 100);

function encabezar(hoja, columnas) {
  hoja.columns = columnas;
  const fila = hoja.getRow(1);
  fila.font = { bold: true, color: { argb: "FFFFFFFF" } };
  fila.fill = { type: "pattern", pattern: "solid", fgColor: { argb: AZUL } };
  hoja.views = [{ state: "frozen", ySplit: 1 }];
}

export async function exportarTableroCompras({ moneda, kpis, porArea, meses, porTipo, formatos, campo, notas }) {
  const libro = new ExcelJS.Workbook();
  libro.created = new Date();
  const fmt = moneda === "USD" ? '"US$"#,##0.00' : '"$"#,##0.00';

  const resumen = libro.addWorksheet("Resumen");
  encabezar(resumen, [
    { header: "Indicador", key: "a", width: 30 },
    { header: moneda === "USD" ? "Valor (dólares)" : "Valor (pesos)", key: "b", width: 20 },
  ]);
  kpis.forEach(([a, b], i) => {
    const fila = resumen.addRow({ a, b: i !== 1 && i !== 4 ? cent(b) : b });
    // Compras y firmas pendientes son conteos, no dinero
    if (i !== 1 && i !== 4) fila.getCell(2).numFmt = fmt;
  });

  const areas = libro.addWorksheet("Por área");
  encabezar(areas, [
    { header: "Área", key: "nombre", width: 28 },
    { header: "Gasto", key: "gasto", width: 18, style: { numFmt: fmt } },
    { header: "Presupuesto", key: "presupuesto", width: 18, style: { numFmt: fmt } },
    { header: "Disponible", key: "disp", width: 18, style: { numFmt: fmt } },
  ]);
  for (const a of porArea) {
    areas.addRow({ nombre: a.nombre, gasto: cent(a.gasto), presupuesto: cent(a.presupuesto), disp: a.presupuesto ? cent(a.presupuesto - a.gasto) : null });
  }

  const porMes = libro.addWorksheet("Por mes");
  encabezar(porMes, [
    { header: "Mes", key: "etiquetaLarga", width: 14 },
    { header: "Compras", key: "n", width: 10 },
    { header: "Gasto", key: "total", width: 18, style: { numFmt: fmt } },
  ]);
  meses.forEach((m) => porMes.addRow({ ...m, total: cent(m.total) }));

  const tipos = libro.addWorksheet("Por tipo");
  encabezar(tipos, [
    { header: "Tipo", key: "nombre", width: 28 },
    { header: "Compras", key: "n", width: 10 },
    { header: "Gasto", key: "total", width: 18, style: { numFmt: fmt } },
  ]);
  porTipo.forEach((t) => tipos.addRow({ ...t, total: cent(t.total) }));

  const det = libro.addWorksheet("Compras");
  encabezar(det, [
    { header: "Fecha", key: "fecha", width: 12 },
    { header: "Ticket", key: "ticket", width: 14 },
    { header: "Área", key: "area", width: 24 },
    { header: "Requerimiento", key: "req", width: 40 },
    { header: "Tipo", key: "tipo", width: 20 },
    { header: "Cuenta", key: "cuenta", width: 14 },
    { header: "Nombre de la cuenta", key: "cuentaNombre", width: 30 },
    { header: "Centro de costos", key: "cc", width: 16 },
    { header: "Monto original", key: "monto", width: 16, style: { numFmt: "#,##0.00" } },
    { header: "Moneda original", key: "moneda", width: 10 },
    { header: moneda === "USD" ? "Monto en dólares" : "Monto en pesos", key: "convertido", width: 18, style: { numFmt: fmt } },
  ]);
  for (const f of formatos) {
    det.addRow({
      fecha: new Date(`${f.fecha}T12:00:00`),
      ticket: f.ticket,
      area: f.area_nombre,
      req: f.requerimiento,
      tipo: f.clasif_tipo,
      cuenta: f.cuenta,
      cuentaNombre: f.cuenta_nombre,
      cc: f.centro_costos,
      monto: f.monto,
      moneda: f.moneda,
      convertido: f[campo],
    });
  }
  det.getColumn("fecha").numFmt = "dd/mm/yyyy";

  const hojaNotas = libro.addWorksheet("Notas");
  hojaNotas.columns = [
    { key: "a", width: 22 },
    { key: "b", width: 90 },
  ];
  for (const [a, b] of notas) hojaNotas.addRow({ a, b }).getCell(1).font = { bold: true };

  const buffer = await libro.xlsx.writeBuffer();
  saveAs(
    new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    `Tablero de compras ${moneda} ${new Date().toLocaleDateString("en-CA")}.xlsx`,
  );
}
