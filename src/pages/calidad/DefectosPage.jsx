import { useState, useEffect, useMemo, useCallback } from "react";
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  ChevronLeft,
  ChevronRight,
  X,
  Filter,
} from "lucide-react";
import { useAuthStore } from "../../stores/auth.store";
import api from "../../services/api";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";

export default function DefectosPage() {
  const { user } = useAuthStore();
  const [registros, setRegistros] = useState([]);
  const [catalogos, setCatalogos] = useState({
    turnos: [],
    areasProduccion: [],
    tiposDefectos: [],
    turnoActual: null,
  });
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    areaProduccionId: "",
    tipoDefectoId: "",
    paresRechazados: "",
    observaciones: "",
  });
  const [defectoSearch, setDefectoSearch] = useState("");
  const [showDefectoDropdown, setShowDefectoDropdown] = useState(false);
  const [filters, setFilters] = useState({
    fechaInicio: "",
    fechaFin: "",
    turnoId: "",
    areaProduccionId: "",
    tipoDefectoId: "",
  });
  const [appliedFilters, setAppliedFilters] = useState({
    fechaInicio: "",
    fechaFin: "",
    turnoId: "",
    areaProduccionId: "",
    tipoDefectoId: "",
  });
  const [pagination, setPagination] = useState({
    total: 0,
    limit: 10,
    offset: 0,
    pages: 0,
  });

  // Filtrar defectos para búsqueda
  const filteredDefectos = useMemo(() => {
    if (!defectoSearch.trim()) return catalogos.tiposDefectos;
    return catalogos.tiposDefectos.filter((d) =>
      d.nombre.toLowerCase().includes(defectoSearch.toLowerCase()),
    );
  }, [catalogos.tiposDefectos, defectoSearch]);

  const fetchCatalogos = async () => {
    try {
      const response = await api.get("/defectos/catalogos");
      if (response.data.status === "success") {
        setCatalogos(response.data.data);
      }
    } catch (error) {
      console.error("Error fetching catalogos:", error);
    }
  };

  const fetchRegistros = useCallback(async (currentFilters, offset = 0) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append("limit", "10");
      params.append("offset", offset.toString());

      // Agregar filtros solo si tienen valor
      if (currentFilters.fechaInicio) {
        params.append("fechaInicio", currentFilters.fechaInicio);
      }
      if (currentFilters.fechaFin) {
        params.append("fechaFin", currentFilters.fechaFin);
      }
      if (currentFilters.turnoId) {
        params.append("turnoId", currentFilters.turnoId);
      }
      if (currentFilters.areaProduccionId) {
        params.append("areaProduccionId", currentFilters.areaProduccionId);
      }
      if (currentFilters.tipoDefectoId) {
        params.append("tipoDefectoId", currentFilters.tipoDefectoId);
      }

      console.log("Fetching with params:", params.toString());

      const response = await api.get(`/defectos?${params.toString()}`);
      if (response.data.status === "success") {
        setRegistros(response.data.data.registros);
        setPagination((prev) => ({
          ...prev,
          ...response.data.data.pagination,
          offset: offset,
        }));
      }
    } catch (error) {
      console.error("Error fetching registros:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCatalogos();
    fetchRegistros(appliedFilters, 0);
  }, []);

  // Función para aplicar filtros
  const handleApplyFilters = () => {
    console.log("Applying filters:", filters);
    setAppliedFilters({ ...filters });
    fetchRegistros(filters, 0);
  };

  // Función para limpiar filtros
  const handleClearFilters = () => {
    const emptyFilters = {
      fechaInicio: "",
      fechaFin: "",
      turnoId: "",
      areaProduccionId: "",
      tipoDefectoId: "",
    };
    setFilters(emptyFilters);
    setAppliedFilters(emptyFilters);
    fetchRegistros(emptyFilters, 0);
  };

  // Paginación
  const handlePageChange = (newOffset) => {
    setPagination((prev) => ({ ...prev, offset: newOffset }));
    fetchRegistros(appliedFilters, newOffset);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        areaProduccionId: parseInt(formData.areaProduccionId),
        tipoDefectoId: parseInt(formData.tipoDefectoId),
        paresRechazados: parseInt(formData.paresRechazados),
        observaciones: formData.observaciones || undefined,
      };

      if (editingId) {
        await api.put(`/defectos/${editingId}`, payload);
      } else {
        await api.post("/defectos", payload);
      }

      setShowModal(false);
      resetForm();
      fetchRegistros(appliedFilters, pagination.offset);
    } catch (error) {
      console.error("Error saving registro:", error);
      alert(error.response?.data?.message || "Error al guardar");
    }
  };

  const handleEdit = (registro) => {
    setEditingId(registro.id);
    const defecto = catalogos.tiposDefectos.find(
      (d) => d.nombre === registro.tipo_defecto,
    );
    setFormData({
      areaProduccionId:
        catalogos.areasProduccion
          .find((a) => a.nombre === registro.area_produccion)
          ?.id?.toString() || "",
      tipoDefectoId: defecto?.id?.toString() || "",
      paresRechazados: registro.pares_rechazados?.toString() || "",
      observaciones: registro.observaciones || "",
    });
    setDefectoSearch(registro.tipo_defecto || "");
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!confirm("¿Estás seguro de eliminar este registro?")) return;
    try {
      await api.delete(`/defectos/${id}`);
      fetchRegistros(appliedFilters, pagination.offset);
    } catch (error) {
      console.error("Error deleting registro:", error);
      alert(error.response?.data?.message || "Error al eliminar");
    }
  };

  const resetForm = () => {
    setFormData({
      areaProduccionId: "",
      tipoDefectoId: "",
      paresRechazados: "",
      observaciones: "",
    });
    setDefectoSearch("");
    setEditingId(null);
  };

  const handleSelectDefecto = (defecto) => {
    setFormData((prev) => ({ ...prev, tipoDefectoId: defecto.id.toString() }));
    setDefectoSearch(defecto.nombre);
    setShowDefectoDropdown(false);
  };

  const handleParesChange = (e) => {
    const value = e.target.value.replace(/\D/g, "");
    setFormData((prev) => ({ ...prev, paresRechazados: value }));
  };

  const currentPage = Math.floor(pagination.offset / pagination.limit) + 1;
  const hasActiveFilters = Object.values(filters).some((v) => v !== "");

  return (
    <div className="space-y-6">
      {/* Header con info de turno actual */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            Registros de Defectos
          </h2>
          <p className="text-sm text-gray-500">
            Turno actual:{" "}
            <span className="font-medium text-primary">
              {catalogos.turnoActual?.nombre || "Cargando..."}
            </span>
          </p>
        </div>
        <Button
          onClick={() => {
            resetForm();
            setShowModal(true);
          }}
        >
          <Plus className="w-4 h-4 mr-2" />
          Nuevo Registro
        </Button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Input
            type="date"
            label="Fecha Inicio"
            value={filters.fechaInicio}
            onChange={(e) =>
              setFilters((prev) => ({ ...prev, fechaInicio: e.target.value }))
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
              Turno
            </label>
            <select
              className="w-full px-4 py-2.5 rounded-lg border border-gray-300 bg-white text-gray-900 focus:border-primary focus:ring-2 focus:ring-primary/20"
              value={filters.turnoId}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, turnoId: e.target.value }))
              }
            >
              <option value="">Todos</option>
              {catalogos.turnos.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nombre}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Área
            </label>
            <select
              className="w-full px-4 py-2.5 rounded-lg border border-gray-300 bg-white text-gray-900 focus:border-primary focus:ring-2 focus:ring-primary/20"
              value={filters.areaProduccionId}
              onChange={(e) =>
                setFilters((prev) => ({
                  ...prev,
                  areaProduccionId: e.target.value,
                }))
              }
            >
              <option value="">Todas</option>
              {catalogos.areasProduccion.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.nombre}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Defecto
            </label>
            <select
              className="w-full px-4 py-2.5 rounded-lg border border-gray-300 bg-white text-gray-900 focus:border-primary focus:ring-2 focus:ring-primary/20"
              value={filters.tipoDefectoId}
              onChange={(e) =>
                setFilters((prev) => ({
                  ...prev,
                  tipoDefectoId: e.target.value,
                }))
              }
            >
              <option value="">Todos</option>
              {catalogos.tiposDefectos.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.nombre}
                </option>
              ))}
            </select>
          </div>
        </div>
        {/* Botones de filtro */}
        <div className="flex items-center justify-end gap-3 mt-4">
          {hasActiveFilters && (
            <Button variant="ghost" onClick={handleClearFilters}>
              <X className="w-4 h-4 mr-2" />
              Limpiar
            </Button>
          )}
          <Button onClick={handleApplyFilters}>
            <Filter className="w-4 h-4 mr-2" />
            Aplicar Filtros
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                  Fecha
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                  Turno
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                  Área
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                  Defecto
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                  Pares
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                  Registrado por
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-8 text-center text-gray-500"
                  >
                    Cargando...
                  </td>
                </tr>
              ) : registros.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-8 text-center text-gray-500"
                  >
                    No hay registros
                  </td>
                </tr>
              ) : (
                registros.map((registro) => (
                  <tr key={registro.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {new Date(registro.fecha_registro).toLocaleDateString(
                        "es-MX",
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
                        {registro.turno}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {registro.area_produccion}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {registro.tipo_defecto}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      {registro.pares_rechazados}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {registro.registrado_por_nombre}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleEdit(registro)}
                          className="p-1.5 text-gray-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        {user?.rol?.esAdmin && (
                          <button
                            onClick={() => handleDelete(registro.id)}
                            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
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
              {Math.min(pagination.offset + pagination.limit, pagination.total)}{" "}
              de {pagination.total}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() =>
                  handlePageChange(pagination.offset - pagination.limit)
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
                  handlePageChange(pagination.offset + pagination.limit)
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

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setShowModal(false)}
          />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                {editingId ? "Editar Registro" : "Nuevo Registro de Defecto"}
              </h3>
              {catalogos.turnoActual && !editingId && (
                <span className="text-sm bg-primary/10 text-primary px-3 py-1 rounded-full">
                  {catalogos.turnoActual.nombre}
                </span>
              )}
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Área de Producción
                </label>
                <select
                  required
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-300 bg-white text-gray-900 focus:border-primary focus:ring-2 focus:ring-primary/20"
                  value={formData.areaProduccionId}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      areaProduccionId: e.target.value,
                    }))
                  }
                >
                  <option value="">Seleccionar área</option>
                  {catalogos.areasProduccion.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.nombre}
                    </option>
                  ))}
                </select>
              </div>

              {/* Búsqueda de defecto */}
              <div className="relative">
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Tipo de Defecto
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    className="w-full pl-10 pr-10 py-2.5 rounded-lg border border-gray-300 bg-white text-gray-900 focus:border-primary focus:ring-2 focus:ring-primary/20"
                    placeholder="Buscar defecto..."
                    value={defectoSearch}
                    onChange={(e) => {
                      setDefectoSearch(e.target.value);
                      setShowDefectoDropdown(true);
                      if (!e.target.value) {
                        setFormData((prev) => ({ ...prev, tipoDefectoId: "" }));
                      }
                    }}
                    onFocus={() => setShowDefectoDropdown(true)}
                  />
                  {defectoSearch && (
                    <button
                      type="button"
                      onClick={() => {
                        setDefectoSearch("");
                        setFormData((prev) => ({ ...prev, tipoDefectoId: "" }));
                      }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Dropdown de defectos */}
                {showDefectoDropdown && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {filteredDefectos.length === 0 ? (
                      <p className="px-4 py-2 text-sm text-gray-500">
                        No se encontraron defectos
                      </p>
                    ) : (
                      filteredDefectos.map((defecto) => (
                        <button
                          key={defecto.id}
                          type="button"
                          className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 ${
                            formData.tipoDefectoId === defecto.id.toString()
                              ? "bg-primary/5 text-primary font-medium"
                              : "text-gray-900"
                          }`}
                          onClick={() => handleSelectDefecto(defecto)}
                        >
                          {defecto.nombre}
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Pares Rechazados
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  required
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-300 bg-white text-gray-900 focus:border-primary focus:ring-2 focus:ring-primary/20"
                  placeholder="Cantidad de pares"
                  value={formData.paresRechazados}
                  onChange={handleParesChange}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Observaciones
                </label>
                <textarea
                  rows={3}
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-300 bg-white text-gray-900 focus:border-primary focus:ring-2 focus:ring-primary/20 resize-none"
                  value={formData.observaciones}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      observaciones: e.target.value,
                    }))
                  }
                  placeholder="Observaciones adicionales (opcional)"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setShowModal(false)}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={
                    !formData.tipoDefectoId || !formData.paresRechazados
                  }
                >
                  {editingId ? "Guardar Cambios" : "Crear Registro"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Click outside to close dropdown */}
      {showDefectoDropdown && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowDefectoDropdown(false)}
        />
      )}
    </div>
  );
}
