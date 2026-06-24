import { useState, useEffect } from "react";
import { BarChart3, TrendingDown, Calendar, Download } from "lucide-react";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import api from "../../services/api";
import Input from "../../components/ui/Input";
import Button from "../../components/ui/Button";

export default function ReportesPage() {
  const [resumenTurno, setResumenTurno] = useState([]);
  const [topDefectos, setTopDefectos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [fechas, setFechas] = useState({
    fechaInicio: new Date().toISOString().split("T")[0],
    fechaFin: "",
  });

  const formatTurno = (turno) => turno.replace("Turno ", "");

  useEffect(() => {
    fetchReportes();
  }, []);

  const buildDateParams = () => {
    const params = new URLSearchParams();
    if (fechas.fechaInicio) {
      params.append("fechaInicio", `${fechas.fechaInicio}T00:00:00`);
    }
    if (fechas.fechaFin) {
      params.append("fechaFin", `${fechas.fechaFin}T23:59:59`);
    } else if (fechas.fechaInicio) {
      // Si no hay fecha fin, usar la fecha de inicio como fin (mismo día)
      params.append("fechaFin", `${fechas.fechaInicio}T23:59:59`);
    }
    return params.toString();
  };

  const fetchReportes = async () => {
    setLoading(true);
    try {
      const dateParams = buildDateParams();

      const [resumenRes, topRes] = await Promise.all([
        api.get(`/defectos/resumen-turno?${dateParams}`),
        api.get(`/defectos/top-defectos?limit=10&${dateParams}`),
      ]);

      if (resumenRes.data.status === "success") {
        setResumenTurno(resumenRes.data.data.resumen);
      }
      if (topRes.data.status === "success") {
        setTopDefectos(topRes.data.data.topDefectos);
      }
    } catch (error) {
      console.error("Error fetching reportes:", error);
    } finally {
      setLoading(false);
    }
  };

  const exportToExcel = async () => {
    setExporting(true);
    try {
      const params = new URLSearchParams();
      if (fechas.fechaInicio) {
        params.append("fechaInicio", fechas.fechaInicio);
      }
      if (fechas.fechaFin) {
        params.append("fechaFin", `${fechas.fechaFin}T23:59:59`);
      } else if (fechas.fechaInicio) {
        params.append("fechaFin", `${fechas.fechaInicio}T23:59:59`);
      }
      params.append("limit", "500");

      const response = await api.get(`/defectos?${params}`);
      const registros = (response.data.data?.registros || []).sort(
        (a, b) => new Date(a.fecha_registro) - new Date(b.fecha_registro),
      );

      // Crear workbook
      const workbook = new ExcelJS.Workbook();
      workbook.creator = "Sistema Central";
      workbook.created = new Date();

      // Hoja 1: Registros detallados
      const wsRegistros = workbook.addWorksheet("Registros Detallados");
      wsRegistros.columns = [
        { header: "Fecha", key: "fecha", width: 12 },
        { header: "Turno", key: "turno", width: 10 },
        { header: "Área de Producción", key: "area", width: 20 },
        { header: "Tipo de Defecto", key: "defecto", width: 30 },
        { header: "Pares Rechazados", key: "pares", width: 18 },
        { header: "Observaciones", key: "observaciones", width: 30 },
        { header: "Registrado Por", key: "registradoPor", width: 20 },
      ];

      // Estilo del header
      wsRegistros.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
      wsRegistros.getRow(1).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF236093" },
      };

      registros.forEach((r) => {
        wsRegistros.addRow({
          fecha: formatFecha(r.fecha_registro),
          turno: formatTurno(r.turno),
          area: r.area_produccion,
          defecto: r.tipo_defecto,
          pares: r.pares_rechazados,
          observaciones: r.observaciones || "",
          registradoPor: r.registrado_por_nombre,
        });
      });

      // Hoja 2: Resumen por turno
      const wsResumen = workbook.addWorksheet("Resumen por Turno");
      wsResumen.columns = [
        { header: "Fecha", key: "fecha", width: 12 },
        { header: "Turno", key: "turno", width: 10 },
        { header: "Total Registros", key: "registros", width: 15 },
        { header: "Total Pares Rechazados", key: "pares", width: 22 },
      ];

      wsResumen.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
      wsResumen.getRow(1).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF49A090" },
      };

      resumenTurno.forEach((r) => {
        wsResumen.addRow({
          fecha: formatFecha(r.fecha_registro),
          turno: formatTurno(r.turno),
          registros: r.total_registros,
          pares: r.total_pares_rechazados,
        });
      });

      // Hoja 3: Top Defectos
      const wsTop = workbook.addWorksheet("Top Defectos");
      wsTop.columns = [
        { header: "Posición", key: "posicion", width: 10 },
        { header: "Tipo de Defecto", key: "defecto", width: 30 },
        { header: "Total Registros", key: "registros", width: 15 },
        { header: "Total Pares Rechazados", key: "pares", width: 22 },
      ];

      wsTop.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
      wsTop.getRow(1).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF95B849" },
      };

      topDefectos.forEach((d, i) => {
        wsTop.addRow({
          posicion: i + 1,
          defecto: d.defecto,
          registros: d.total_registros,
          pares: d.total_pares_rechazados,
        });
      });

      // Generar archivo
      const buffer = await workbook.xlsx.writeBuffer();
      const data = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });

      const fechaInicioStr = fechas.fechaInicio || "inicio";
      const fechaFinStr = fechas.fechaFin || fechas.fechaInicio || "fin";
      const fileName = `FPG-QA-001 Ver.03 OBA ensamble.xlsx`;
      saveAs(data, fileName);
    } catch (error) {
      console.error("Error exporting:", error.response?.data);
      alert(error.response?.data?.message || "Error al exportar el reporte");
    } finally {
      setExporting(false);
    }
  };

  const totalPares = topDefectos.reduce(
    (sum, d) => sum + parseInt(d.total_pares_rechazados || 0),
    0,
  );
  const maxPares = Math.max(
    ...topDefectos.map((d) => parseInt(d.total_pares_rechazados || 0)),
    1,
  );

  const formatFecha = (fecha) => {
    const d = new Date(fecha);
    const dia = String(d.getDate()).padStart(2, "0");
    const mes = String(d.getMonth() + 1).padStart(2, "0");
    const anio = d.getFullYear();
    return `${dia}/${mes}/${anio}`;
  };

  const formatPeriodo = () => {
    if (fechas.fechaInicio && fechas.fechaFin) {
      return `${fechas.fechaInicio} - ${fechas.fechaFin}`;
    }
    if (fechas.fechaInicio) {
      return fechas.fechaInicio;
    }
    return "Sin definir";
  };

  return (
    <div className="space-y-6">
      {/* Filtros de fecha */}
      <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
        <div className="flex flex-wrap items-end gap-4">
          <Input
            type="date"
            label="Fecha Inicio"
            value={fechas.fechaInicio}
            onChange={(e) =>
              setFechas((prev) => ({ ...prev, fechaInicio: e.target.value }))
            }
          />
          <Input
            type="date"
            label="Fecha Fin (opcional)"
            value={fechas.fechaFin}
            onChange={(e) =>
              setFechas((prev) => ({ ...prev, fechaFin: e.target.value }))
            }
          />
          <Button onClick={fetchReportes} isLoading={loading}>
            <Calendar className="w-4 h-4 mr-2" />
            Aplicar
          </Button>
          <Button
            variant="secondary"
            onClick={exportToExcel}
            isLoading={exporting}
            disabled={!fechas.fechaInicio}
          >
            <Download className="w-4 h-4 mr-2" />
            Exportar Excel
          </Button>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-red-100 flex items-center justify-center">
              <TrendingDown className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Pares Rechazados</p>
              <p className="text-2xl font-bold text-gray-900">
                {totalPares.toLocaleString()}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <BarChart3 className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Registros</p>
              <p className="text-2xl font-bold text-gray-900">
                {topDefectos.reduce(
                  (sum, d) => sum + parseInt(d.total_registros || 0),
                  0,
                )}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-secondary/10 flex items-center justify-center">
              <Calendar className="w-6 h-6 text-secondary" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Período</p>
              <p className="text-sm font-medium text-gray-900">
                {formatPeriodo()}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Defectos */}
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Top 10 Defectos
          </h3>
          {loading ? (
            <p className="text-gray-500">Cargando...</p>
          ) : topDefectos.length === 0 ? (
            <p className="text-gray-500">
              No hay datos para el período seleccionado
            </p>
          ) : (
            <div className="space-y-3">
              {topDefectos.map((defecto, index) => (
                <div
                  key={defecto.id || index}
                  className="flex items-center gap-3"
                >
                  <span className="w-6 text-sm font-medium text-gray-400">
                    {index + 1}
                  </span>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-gray-900 truncate">
                        {defecto.defecto}
                      </span>
                      <span className="text-sm text-gray-500">
                        {parseInt(
                          defecto.total_pares_rechazados,
                        ).toLocaleString()}{" "}
                        pares
                      </span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-primary to-secondary rounded-full transition-all"
                        style={{
                          width: `${(parseInt(defecto.total_pares_rechazados) / maxPares) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Resumen por Turno */}
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Resumen por Turno
          </h3>
          {loading ? (
            <p className="text-gray-500">Cargando...</p>
          ) : resumenTurno.length === 0 ? (
            <p className="text-gray-500">
              No hay datos para el período seleccionado
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left py-2 text-xs font-semibold text-gray-500 uppercase">
                      Fecha
                    </th>
                    <th className="text-left py-2 text-xs font-semibold text-gray-500 uppercase">
                      Turno
                    </th>
                    <th className="text-right py-2 text-xs font-semibold text-gray-500 uppercase">
                      Registros
                    </th>
                    <th className="text-right py-2 text-xs font-semibold text-gray-500 uppercase">
                      Pares
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {resumenTurno.slice(0, 15).map((item, index) => (
                    <tr key={index}>
                      <td className="py-2 text-sm text-gray-900">
                        {formatFecha(item.fecha)}
                      </td>
                      <td className="py-2">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
                          {formatTurno(item.turno)}
                        </span>
                      </td>
                      <td className="py-2 text-sm text-gray-500 text-right">
                        {item.total_registros}
                      </td>
                      <td className="py-2 text-sm font-medium text-gray-900 text-right">
                        {parseInt(item.total_pares_rechazados).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
