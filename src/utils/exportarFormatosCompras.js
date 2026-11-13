import ExcelJS from "exceljs";
import { saveAs } from "file-saver";

/**
 * Exportación de los formatos de compras capturados a Excel.
 *
 * Lo filtrado en pantalla. Cuatro hojas: el detalle (una fila por formato, con
 * los mismos campos que el papel), los totales por área y por tipo, y una de
 * notas con los filtros y cómo se convierten los dólares. Los montos van como
 * número para poder sumarlos.
 */

const AZUL = "FF236093";
const PESOS = '"$"#,##0.00';

function encabezar(hoja, columnas) {
  hoja.columns = columnas;
  const fila = hoja.getRow(1);
  fila.font = { bold: true, color: { argb: "FFFFFFFF" } };
  fila.fill = { type: "pattern", pattern: "solid", fgColor: { argb: AZUL } };
  hoja.views = [{ state: "frozen", ySplit: 1 }];
  hoja.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columnas.length } };
}

function agrupar(filas, clave) {
  const grupos = new Map();
  for (const f of filas) {
    const k = clave(f) || "(sin capturar)";
    const g = grupos.get(k) || { nombre: k, n: 0, total: 0, sinTc: 0 };
    g.n += 1;
    if (f.monto_mxn != null) g.total += f.monto_mxn;
    else if (f.monto != null) g.sinTc += 1;
    grupos.set(k, g);
  }
  return [...grupos.values()].sort((a, b) => b.total - a.total);
}

/**
 * @param {Object} p
 *   filas   los formatos filtrados (como llegan del API)
 *   notas   [[etiqueta, valor], …]
 */
export async function exportarFormatosCompras({ filas, notas }) {
  const libro = new ExcelJS.Workbook();
  libro.created = new Date();

  const detalle = libro.addWorksheet("Formatos");
  encabezar(detalle, [
    { header: "Fecha", key: "fecha", width: 12 },
    { header: "Ticket", key: "ticket", width: 14 },
    { header: "Área solicitante", key: "area", width: 24 },
    { header: "Requerimiento", key: "requerimiento", width: 40 },
    { header: "Costo", key: "monto", width: 15, style: { numFmt: "#,##0.00" } },
    { header: "Moneda", key: "moneda", width: 9 },
    { header: "Tipo de cambio", key: "tc", width: 14, style: { numFmt: "0.0000" } },
    { header: "Costo en pesos", key: "mxn", width: 16, style: { numFmt: PESOS } },
    { header: "Autorizó gerente", key: "gerente", width: 22 },
    { header: "Tipo (Compras)", key: "tipo", width: 20 },
    { header: "Autorizó Compras", key: "compras", width: 22 },
    { header: "Cuenta", key: "cuenta", width: 14 },
    { header: "Nombre de la cuenta", key: "cuentaNombre", width: 30 },
    { header: "Centro de costos", key: "cc", width: 16 },
    { header: "Autorizó Finanzas", key: "finanzas", width: 22 },
    { header: "Autorizó Dirección", key: "direccion", width: 20 },
    { header: "Estado", key: "estado", width: 26 },
    { header: "Observaciones", key: "obs", width: 30 },
    { header: "Capturó", key: "capturo", width: 22 },
  ]);
  for (const f of filas) {
    detalle.addRow({
      fecha: new Date(`${f.fecha}T12:00:00`),
      ticket: f.ticket,
      area: f.area_nombre,
      requerimiento: f.requerimiento,
      monto: f.monto,
      moneda: f.moneda,
      tc: f.tipo_cambio,
      mxn: f.monto_mxn,
      gerente: f.autorizo_gerente,
      tipo: f.clasif_tipo,
      compras: f.autorizo_compras,
      direccion: f.autorizo_direccion,
      cuenta: f.cuenta,
      cuentaNombre: f.cuenta_nombre,
      cc: f.centro_costos,
      finanzas: f.autorizo_finanzas,
      estado: f.completo ? "Completo" : `Falta: ${f.faltan.join(", ")}`,
      obs: f.observaciones,
      capturo: f.capturado_por_nombre,
    });
  }
  detalle.getColumn("fecha").numFmt = "dd/mm/yyyy";

  for (const [nombre, titulo, clave] of [
    ["Por área", "Área solicitante", (f) => f.area_nombre],
    ["Por tipo", "Tipo (Compras)", (f) => f.clasif_tipo],
  ]) {
    const hoja = libro.addWorksheet(nombre);
    encabezar(hoja, [
      { header: titulo, key: "nombre", width: 28 },
      { header: "Formatos", key: "n", width: 11 },
      { header: "Total en pesos", key: "total", width: 18, style: { numFmt: PESOS } },
      { header: "En dólares sin tipo de cambio", key: "sinTc", width: 28 },
    ]);
    for (const g of agrupar(filas, clave)) hoja.addRow({ ...g, sinTc: g.sinTc || null });
  }

  const hojaNotas = libro.addWorksheet("Notas");
  hojaNotas.columns = [
    { key: "a", width: 26 },
    { key: "b", width: 80 },
  ];
  for (const [a, b] of notas) hojaNotas.addRow({ a, b }).getCell(1).font = { bold: true };

  const buffer = await libro.xlsx.writeBuffer();
  const hoy = new Date().toLocaleDateString("en-CA");
  saveAs(
    new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    `Formatos de compras ${hoy}.xlsx`,
  );
}
