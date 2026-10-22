import ExcelJS from "exceljs";
import { saveAs } from "file-saver";

/**
 * Exportación del reporte de checadas a Excel.
 *
 * Dos hojas: el detalle (una persona por turno, con su entrada y su salida) y
 * el resumen por departamento. Es lo que RH compara contra su lista de asistencia,
 * así que va con el número de nómina como número para poder hacer BUSCARV.
 */

const AZUL = "FF236093";

const ESTADO = { A_TIEMPO: "A tiempo", TOLERANCIA: "En tolerancia", RETARDO: "Retardo" };

function encabezar(hoja, columnas) {
  hoja.columns = columnas;
  const fila = hoja.getRow(1);
  fila.font = { bold: true, color: { argb: "FFFFFFFF" } };
  fila.fill = { type: "pattern", pattern: "solid", fgColor: { argb: AZUL } };
  hoja.views = [{ state: "frozen", ySplit: 1 }];
  hoja.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columnas.length } };
}

export const lector = (punto) => (punto || "").replace(/_Door.*$/i, "") || "—";

export async function exportarReporteChecadas({ datos, desde, hasta }) {
  const libro = new ExcelJS.Workbook();
  libro.created = new Date();

  const detalle = libro.addWorksheet("Checadas");
  encabezar(detalle, [
    { header: "Nómina", key: "id", width: 10 },
    { header: "Nombre", key: "nombre", width: 34 },
    { header: "Departamento", key: "departamento", width: 26 },
    { header: "Fecha del turno", key: "fechaTurno", width: 15 },
    { header: "Turno", key: "turno", width: 8 },
    { header: "Fecha entrada", key: "fecha", width: 14 },
    { header: "Entrada", key: "hora", width: 9 },
    { header: "Minutos vs. entrada", key: "minutos", width: 18 },
    { header: "Llegada", key: "estado", width: 14 },
    { header: "Fecha salida", key: "salidaFecha", width: 14 },
    { header: "Salida", key: "salidaHora", width: 9 },
    { header: "Minutos vs. salida", key: "minutosSalida", width: 17 },
    { header: "Salió antes", key: "salioAntes", width: 11 },
    { header: "Checadas", key: "checadas", width: 10 },
    { header: "Lector", key: "lector", width: 12 },
  ]);
  for (const l of datos.detalle) {
    detalle.addRow({
      id: /^\d+$/.test(l.empleado_id) ? Number(l.empleado_id) : l.empleado_id,
      nombre: l.nombre,
      departamento: l.departamento,
      fechaTurno: l.fechaTurno,
      turno: l.turno,
      fecha: l.fecha,
      hora: l.hora,
      minutos: l.minutos,
      estado: ESTADO[l.estado] || l.estado,
      salidaFecha: l.salidaFecha,
      salidaHora: l.salidaHora,
      minutosSalida: l.minutosSalida,
      salioAntes: l.salidaHora ? (l.salioAntes ? "Sí" : "No") : null,
      checadas: l.checadas,
      lector: lector(l.punto),
    });
  }

  const deps = libro.addWorksheet("Por departamento");
  encabezar(deps, [
    { header: "Departamento", key: "departamento", width: 30 },
    { header: "Personas", key: "personas", width: 10 },
    { header: "A tiempo", key: "aTiempo", width: 10 },
    { header: "En tolerancia", key: "tolerancia", width: 14 },
    { header: "Retardo", key: "retardo", width: 10 },
    { header: "Con salida", key: "conSalida", width: 11 },
    { header: "Salieron antes", key: "salieronAntes", width: 14 },
  ]);
  datos.porDepartamento.forEach((d) => deps.addRow(d));

  const buffer = await libro.xlsx.writeBuffer();
  const rango = desde === hasta ? desde : `${desde}_a_${hasta}`;
  saveAs(new Blob([buffer]), `Checadas_${rango}.xlsx`);
}
