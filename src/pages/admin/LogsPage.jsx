import { useState, useEffect } from "react";
import {
  Search,
  Filter,
  Eye,
  X,
  ChevronLeft,
  ChevronRight,
  Calendar,
  User,
  Activity,
  Database,
  Clock,
  Monitor,
  FileText,
  Download,
  LogIn,
  LogOut,
  Lock,
  Plus,
  Pencil,
  Trash2,
  Pause,
  Play,
  KeyRound,
  XCircle,
  ShieldCheck,
  ShieldX,
} from "lucide-react";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import api from "../../services/api";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";

const accionColors = {
  LOGIN_SUCCESS: "bg-green-100 text-green-700",
  LOGIN_FAILED: "bg-red-100 text-red-700",
  LOGOUT: "bg-gray-100 text-gray-700",
  CREATE: "bg-blue-100 text-blue-700",
  UPDATE: "bg-yellow-100 text-yellow-700",
  DELETE: "bg-red-100 text-red-700",
  DEACTIVATE: "bg-orange-100 text-orange-700",
  ACTIVATE: "bg-green-100 text-green-700",
  RESET_PASSWORD: "bg-purple-100 text-purple-700",
  CHANGE_PASSWORD: "bg-purple-100 text-purple-700",
  CHANGE_PASSWORD_FAILED: "bg-red-100 text-red-700",
};

const accionIcons = {
  LOGIN_SUCCESS: LogIn,
  LOGIN_FAILED: ShieldX,
  LOGOUT: LogOut,
  CREATE: Plus,
  UPDATE: Pencil,
  DELETE: Trash2,
  DEACTIVATE: Pause,
  ACTIVATE: Play,
  RESET_PASSWORD: KeyRound,
  CHANGE_PASSWORD: ShieldCheck,
  CHANGE_PASSWORD_FAILED: XCircle,
};

// Componente para renderizar el icono de acción
const AccionIcon = ({ accion, className = "w-3.5 h-3.5" }) => {
  const IconComponent = accionIcons[accion] || FileText;
  return <IconComponent className={className} />;
};

// Helper function to format date as DD/MM/YYYY HH:mm:ss
const formatDate = (dateString) => {
  const date = new Date(dateString);
  const day = date.getDate().toString().padStart(2, "0");
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const year = date.getFullYear();
  const hours = date.getHours().toString().padStart(2, "0");
  const minutes = date.getMinutes().toString().padStart(2, "0");
  const seconds = date.getSeconds().toString().padStart(2, "0");
  return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
};

// Helper function to format date as DD/MM/YYYY (without time)
const formatDateOnly = (dateString) => {
  const date = new Date(dateString);
  const day = date.getDate().toString().padStart(2, "0");
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};

export default function LogsPage() {
  const [logs, setLogs] = useState([]);
  const [catalogos, setCatalogos] = useState({
    acciones: [],
    modulos: [],
    tablas: [],
    usuarios: [],
  });
  const [estadisticas, setEstadisticas] = useState({
    estadisticas: [],
    actividadUsuarios: [],
  });
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedLog, setSelectedLog] = useState(null);

  const [filters, setFilters] = useState({
    fechaInicio: new Date(new Date().setDate(new Date().getDate() - 7))
      .toISOString()
      .split("T")[0],
    fechaFin: new Date().toISOString().split("T")[0],
    usuarioId: "",
    accion: "",
    modulo: "",
    search: "",
  });

  const [pagination, setPagination] = useState({
    total: 0,
    limit: 6,
    offset: 0,
    pages: 0,
  });

  useEffect(() => {
    fetchCatalogos();
  }, []);

  useEffect(() => {
    fetchLogs();
    fetchEstadisticas();
  }, [pagination.offset]);

  const fetchCatalogos = async () => {
    try {
      const response = await api.get("/logs/catalogos");
      if (response.data.status === "success") {
        setCatalogos(response.data.data);
      }
    } catch (error) {
      console.error("Error fetching catalogos:", error);
    }
  };

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        limit: pagination.limit.toString(),
        offset: pagination.offset.toString(),
      });

      if (filters.fechaInicio)
        params.append("fechaInicio", `${filters.fechaInicio}T00:00:00`);
      if (filters.fechaFin)
        params.append("fechaFin", `${filters.fechaFin}T23:59:59`);
      if (filters.usuarioId) params.append("usuarioId", filters.usuarioId);
      if (filters.accion) params.append("accion", filters.accion);
      if (filters.modulo) params.append("modulo", filters.modulo);
      if (filters.search) params.append("search", filters.search);

      const response = await api.get(`/logs?${params}`);
      if (response.data.status === "success") {
        setLogs(response.data.data.logs);
        setPagination((prev) => ({
          ...prev,
          ...response.data.data.pagination,
        }));
      }
    } catch (error) {
      console.error("Error fetching logs:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchEstadisticas = async () => {
    try {
      const params = new URLSearchParams();
      if (filters.fechaInicio)
        params.append("fechaInicio", `${filters.fechaInicio}T00:00:00`);
      if (filters.fechaFin)
        params.append("fechaFin", `${filters.fechaFin}T23:59:59`);

      const response = await api.get(`/logs/estadisticas?${params}`);
      if (response.data.status === "success") {
        setEstadisticas(response.data.data);
      }
    } catch (error) {
      console.error("Error fetching estadisticas:", error);
    }
  };

  const handleSearch = () => {
    setPagination((prev) => ({ ...prev, offset: 0 }));
    fetchLogs();
    fetchEstadisticas();
  };

  const handleClearFilters = () => {
    setFilters({
      fechaInicio: new Date(new Date().setDate(new Date().getDate() - 7))
        .toISOString()
        .split("T")[0],
      fechaFin: new Date().toISOString().split("T")[0],
      usuarioId: "",
      accion: "",
      modulo: "",
      search: "",
    });
  };

  const handleViewDetail = (log) => {
    setSelectedLog(log);
    setShowDetailModal(true);
  };

  const exportToExcel = async () => {
    setExporting(true);
    try {
      const params = new URLSearchParams({
        limit: "500",
        offset: "0",
      });

      if (filters.fechaInicio)
        params.append("fechaInicio", `${filters.fechaInicio}T00:00:00`);
      if (filters.fechaFin)
        params.append("fechaFin", `${filters.fechaFin}T23:59:59`);
      if (filters.usuarioId) params.append("usuarioId", filters.usuarioId);
      if (filters.accion) params.append("accion", filters.accion);
      if (filters.modulo) params.append("modulo", filters.modulo);
      if (filters.search) params.append("search", filters.search);

      const response = await api.get(`/logs?${params}`);
      const logsData = (response.data.data?.logs || []).sort(
        (a, b) => new Date(a.creado_en) - new Date(b.creado_en),
      );

      const workbook = new ExcelJS.Workbook();
      workbook.creator = "Sistema Central";
      workbook.created = new Date();

      const wsLogs = workbook.addWorksheet("Logs del Sistema");
      wsLogs.columns = [
        { header: "ID", key: "id", width: 8 },
        { header: "Fecha/Hora", key: "fecha", width: 20 },
        { header: "Usuario", key: "usuario", width: 20 },
        { header: "Acción", key: "accion", width: 18 },
        { header: "Módulo", key: "modulo", width: 25 },
        { header: "Tabla Afectada", key: "tabla", width: 18 },
        { header: "ID Registro", key: "registroId", width: 12 },
        { header: "Descripción", key: "descripcion", width: 50 },
        { header: "IP", key: "ip", width: 15 },
      ];

      wsLogs.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
      wsLogs.getRow(1).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF236093" },
      };
      wsLogs.getRow(1).alignment = { vertical: "middle", horizontal: "center" };

      logsData.forEach((log) => {
        const row = wsLogs.addRow({
          id: log.id,
          fecha: formatDate(log.creado_en),
          usuario: log.usuario_nombre || log.nombre_usuario || "Sistema",
          accion: log.accion,
          modulo: log.modulo,
          tabla: log.tabla_afectada || "",
          registroId: log.registro_id || "",
          descripcion: log.descripcion,
          ip: log.ip_address || "",
        });

        const accionColorMap = {
          LOGIN_SUCCESS: "FFE8F5E9",
          LOGIN_FAILED: "FFFFEBEE",
          LOGOUT: "FFF5F5F5",
          CREATE: "FFE3F2FD",
          UPDATE: "FFFFFDE7",
          DELETE: "FFFFEBEE",
          DEACTIVATE: "FFFFF3E0",
          ACTIVATE: "FFE8F5E9",
          RESET_PASSWORD: "FFF3E5F5",
          CHANGE_PASSWORD: "FFF3E5F5",
        };

        if (accionColorMap[log.accion]) {
          row.eachCell((cell) => {
            cell.fill = {
              type: "pattern",
              pattern: "solid",
              fgColor: { argb: accionColorMap[log.accion] },
            };
          });
        }
      });

      wsLogs.eachRow((row) => {
        row.eachCell((cell) => {
          cell.border = {
            top: { style: "thin", color: { argb: "FFE0E0E0" } },
            left: { style: "thin", color: { argb: "FFE0E0E0" } },
            bottom: { style: "thin", color: { argb: "FFE0E0E0" } },
            right: { style: "thin", color: { argb: "FFE0E0E0" } },
          };
        });
      });

      const wsResumen = workbook.addWorksheet("Resumen por Acción");
      wsResumen.columns = [
        { header: "Acción", key: "accion", width: 25 },
        { header: "Total", key: "total", width: 15 },
        { header: "Porcentaje", key: "porcentaje", width: 15 },
      ];

      wsResumen.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
      wsResumen.getRow(1).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF49A090" },
      };

      const totalLogs = logsData.length;
      estadisticas.estadisticas.forEach((e) => {
        wsResumen.addRow({
          accion: e.accion,
          total: parseInt(e.total),
          porcentaje: `${((parseInt(e.total) / totalLogs) * 100).toFixed(1)}%`,
        });
      });

      const wsUsuarios = workbook.addWorksheet("Actividad por Usuario");
      wsUsuarios.columns = [
        { header: "Usuario", key: "usuario", width: 25 },
        { header: "Nombre Completo", key: "nombre", width: 30 },
        { header: "Total Acciones", key: "total", width: 15 },
      ];

      wsUsuarios.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
      wsUsuarios.getRow(1).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF95B849" },
      };

      estadisticas.actividadUsuarios.forEach((u) => {
        wsUsuarios.addRow({
          usuario: u.nombre_usuario,
          nombre: u.nombre_completo,
          total: parseInt(u.total_acciones),
        });
      });

      const logsConDatos = logsData.filter(
        (l) => l.datos_anteriores || l.datos_nuevos,
      );
      if (logsConDatos.length > 0) {
        const wsDatos = workbook.addWorksheet("Cambios Detallados");
        wsDatos.columns = [
          { header: "ID Log", key: "id", width: 8 },
          { header: "Fecha", key: "fecha", width: 20 },
          { header: "Usuario", key: "usuario", width: 20 },
          { header: "Acción", key: "accion", width: 15 },
          { header: "Tabla", key: "tabla", width: 15 },
          { header: "Datos Anteriores", key: "datosAnteriores", width: 50 },
          { header: "Datos Nuevos", key: "datosNuevos", width: 50 },
        ];

        wsDatos.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
        wsDatos.getRow(1).fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FF9C27B0" },
        };

        logsConDatos.forEach((log) => {
          wsDatos.addRow({
            id: log.id,
            fecha: formatDate(log.creado_en),
            usuario: log.usuario_nombre || log.nombre_usuario || "Sistema",
            accion: log.accion,
            tabla: log.tabla_afectada || "",
            datosAnteriores: log.datos_anteriores
              ? JSON.stringify(log.datos_anteriores)
              : "",
            datosNuevos: log.datos_nuevos
              ? JSON.stringify(log.datos_nuevos)
              : "",
          });
        });
      }

      const buffer = await workbook.xlsx.writeBuffer();
      const data = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });

      const fileName = `Logs_Sistema_${filters.fechaInicio}_${filters.fechaFin}.xlsx`;
      saveAs(data, fileName);
    } catch (error) {
      console.error("Error exporting:", error);
      alert(error.response?.data?.message || "Error al exportar los logs");
    } finally {
      setExporting(false);
    }
  };

  const currentPage = Math.floor(pagination.offset / pagination.limit) + 1;

  const totalAcciones = estadisticas.estadisticas.reduce(
    (sum, e) => sum + parseInt(e.total || 0),
    0,
  );

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Activity className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Acciones</p>
              <p className="text-xl font-bold text-gray-900">{totalAcciones}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
              <User className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Usuarios Activos</p>
              <p className="text-xl font-bold text-gray-900">
                {estadisticas.actividadUsuarios.length}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
              <Database className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Tipos de Acción</p>
              <p className="text-xl font-bold text-gray-900">
                {estadisticas.estadisticas.length}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
              <Clock className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Período</p>
              <p className="text-sm font-medium text-gray-900">
                {formatDateOnly(filters.fechaInicio)} -{" "}
                {formatDateOnly(filters.fechaFin)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-300 bg-white text-gray-900 focus:border-primary focus:ring-2 focus:ring-primary/20"
                  placeholder="Buscar en descripción o usuario..."
                  value={filters.search}
                  onChange={(e) =>
                    setFilters((prev) => ({ ...prev, search: e.target.value }))
                  }
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => setShowFilters(!showFilters)}
              >
                <Filter className="w-4 h-4 mr-2" />
                Filtros
              </Button>
              <Button onClick={handleSearch}>Buscar</Button>
              <Button
                variant="secondary"
                onClick={exportToExcel}
                isLoading={exporting}
              >
                <Download className="w-4 h-4 mr-2" />
                Exportar
              </Button>
            </div>
          </div>
        </div>

        {/* Expanded Filters */}
        {showFilters && (
          <div className="p-4 bg-gray-50 border-b border-gray-100">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <Input
                type="date"
                label="Fecha Inicio"
                value={filters.fechaInicio}
                onChange={(e) =>
                  setFilters((prev) => ({
                    ...prev,
                    fechaInicio: e.target.value,
                  }))
                }
              />
              <Input
                type="date"
                label="Fecha Fin"
                value={filters.fechaFin}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, fechaFin: e.target.value }))
                }
              />
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Usuario
                </label>
                <select
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-300 bg-white text-gray-900 focus:border-primary focus:ring-2 focus:ring-primary/20"
                  value={filters.usuarioId}
                  onChange={(e) =>
                    setFilters((prev) => ({
                      ...prev,
                      usuarioId: e.target.value,
                    }))
                  }
                >
                  <option value="">Todos</option>
                  {catalogos.usuarios.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.nombre_completo || u.nombre_usuario}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Acción
                </label>
                <select
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-300 bg-white text-gray-900 focus:border-primary focus:ring-2 focus:ring-primary/20"
                  value={filters.accion}
                  onChange={(e) =>
                    setFilters((prev) => ({ ...prev, accion: e.target.value }))
                  }
                >
                  <option value="">Todas</option>
                  {catalogos.acciones.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Módulo
                </label>
                <select
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-300 bg-white text-gray-900 focus:border-primary focus:ring-2 focus:ring-primary/20"
                  value={filters.modulo}
                  onChange={(e) =>
                    setFilters((prev) => ({ ...prev, modulo: e.target.value }))
                  }
                >
                  <option value="">Todos</option>
                  {catalogos.modulos.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex justify-end mt-4">
              <Button variant="ghost" size="sm" onClick={handleClearFilters}>
                Limpiar filtros
              </Button>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Main Table */}
        <div className="lg:col-span-3 bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                    Fecha/Hora
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                    Usuario
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                    Acción
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                    Módulo
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                    Descripción
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">
                    Detalle
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-8 text-center text-gray-500"
                    >
                      Cargando...
                    </td>
                  </tr>
                ) : logs.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-8 text-center text-gray-500"
                    >
                      No hay registros de log
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr key={log.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                        {formatDate(log.creado_en)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
                            <span className="text-white text-xs font-medium">
                              {log.usuario_nombre?.charAt(0) ||
                                log.nombre_usuario?.charAt(0) ||
                                "?"}
                            </span>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              {log.nombre_usuario || "Sistema"}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                            accionColors[log.accion] ||
                            "bg-gray-100 text-gray-700"
                          }`}
                        >
                          <AccionIcon accion={log.accion} />
                          {log.accion}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {log.modulo}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500 max-w-xs truncate">
                        {log.descripcion}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => handleViewDetail(log)}
                          className="p-1.5 text-gray-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                          title="Ver detalle"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pagination.pages > 1 && (
            <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between">
              <p className="text-sm text-gray-500">
                Mostrando {pagination.offset + 1} a{" "}
                {Math.min(
                  pagination.offset + pagination.limit,
                  pagination.total,
                )}{" "}
                de {pagination.total}
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() =>
                    setPagination((prev) => ({
                      ...prev,
                      offset: prev.offset - prev.limit,
                    }))
                  }
                  disabled={pagination.offset === 0}
                  className="p-2 rounded-lg border border-gray-200 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-sm text-gray-700">
                  Página {currentPage} de {pagination.pages}
                </span>
                <button
                  onClick={() =>
                    setPagination((prev) => ({
                      ...prev,
                      offset: prev.offset + prev.limit,
                    }))
                  }
                  disabled={currentPage >= pagination.pages}
                  className="p-2 rounded-lg border border-gray-200 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar Stats */}
        <div className="space-y-4">
          {/* Acciones por tipo */}
          <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
            <h4 className="text-sm font-semibold text-gray-900 mb-3">
              Acciones por Tipo
            </h4>
            {estadisticas.estadisticas.length === 0 ? (
              <p className="text-sm text-gray-500">Sin datos</p>
            ) : (
              <div className="space-y-2">
                {estadisticas.estadisticas.slice(0, 8).map((e, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between text-sm"
                  >
                    <span
                      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${
                        accionColors[e.accion] || "bg-gray-100 text-gray-700"
                      }`}
                    >
                      <AccionIcon accion={e.accion} className="w-3 h-3" />
                      {e.accion}
                    </span>
                    <span className="text-gray-500">{e.total}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Usuarios más activos */}
          <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
            <h4 className="text-sm font-semibold text-gray-900 mb-3">
              Usuarios Más Activos
            </h4>
            {estadisticas.actividadUsuarios.length === 0 ? (
              <p className="text-sm text-gray-500">Sin datos</p>
            ) : (
              <div className="space-y-2">
                {estadisticas.actividadUsuarios.slice(0, 5).map((u, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
                      <span className="text-white text-xs font-medium">
                        {u.nombre_completo?.charAt(0) || "?"}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {u.nombre_usuario}
                      </p>
                    </div>
                    <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                      {u.total_acciones}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Detail Modal */}
      {showDetailModal && selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setShowDetailModal(false)}
          />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">
                Detalle del Log
              </h3>
              <button
                onClick={() => setShowDetailModal(false)}
                className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500 mb-1">ID</p>
                  <p className="text-sm font-medium text-gray-900">
                    #{selectedLog.id}
                  </p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500 mb-1">Fecha/Hora</p>
                  <p className="text-sm font-medium text-gray-900">
                    {formatDate(selectedLog.creado_en)}
                  </p>
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500 mb-1">Usuario</p>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
                    <span className="text-white text-sm font-medium">
                      {selectedLog.usuario_nombre?.charAt(0) || "?"}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {selectedLog.usuario_nombre || "Sistema"}
                    </p>
                    <p className="text-xs text-gray-500">
                      @{selectedLog.nombre_usuario || "system"}
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500 mb-1">Acción</p>
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                      accionColors[selectedLog.accion] ||
                      "bg-gray-100 text-gray-700"
                    }`}
                  >
                    <AccionIcon accion={selectedLog.accion} />
                    {selectedLog.accion}
                  </span>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500 mb-1">Módulo</p>
                  <p className="text-sm font-medium text-gray-900">
                    {selectedLog.modulo}
                  </p>
                </div>
              </div>

              {(selectedLog.tabla_afectada || selectedLog.registro_id) && (
                <div className="grid grid-cols-2 gap-4">
                  {selectedLog.tabla_afectada && (
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-xs text-gray-500 mb-1">
                        Tabla Afectada
                      </p>
                      <p className="text-sm font-medium text-gray-900">
                        {selectedLog.tabla_afectada}
                      </p>
                    </div>
                  )}
                  {selectedLog.registro_id && (
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-xs text-gray-500 mb-1">ID Registro</p>
                      <p className="text-sm font-medium text-gray-900">
                        #{selectedLog.registro_id}
                      </p>
                    </div>
                  )}
                </div>
              )}

              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500 mb-1">Descripción</p>
                <p className="text-sm text-gray-900">
                  {selectedLog.descripcion}
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {selectedLog.ip_address && (
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs text-gray-500 mb-1 flex items-center gap-1">
                      <Monitor className="w-3 h-3" /> IP Address
                    </p>
                    <p className="text-sm font-mono text-gray-900">
                      {selectedLog.ip_address}
                    </p>
                  </div>
                )}
                {selectedLog.user_agent && (
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs text-gray-500 mb-1 flex items-center gap-1">
                      <FileText className="w-3 h-3" /> User Agent
                    </p>
                    <p className="text-xs text-gray-900 break-all">
                      {selectedLog.user_agent}
                    </p>
                  </div>
                )}
              </div>

              {selectedLog.datos_anteriores && (
                <div className="bg-red-50 rounded-lg p-3">
                  <p className="text-xs text-red-600 mb-2 font-medium">
                    Datos Anteriores
                  </p>
                  <pre className="text-xs text-gray-700 overflow-x-auto bg-white p-2 rounded border border-red-100">
                    {JSON.stringify(selectedLog.datos_anteriores, null, 2)}
                  </pre>
                </div>
              )}

              {selectedLog.datos_nuevos && (
                <div className="bg-green-50 rounded-lg p-3">
                  <p className="text-xs text-green-600 mb-2 font-medium">
                    Datos Nuevos
                  </p>
                  <pre className="text-xs text-gray-700 overflow-x-auto bg-white p-2 rounded border border-green-100">
                    {JSON.stringify(selectedLog.datos_nuevos, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
