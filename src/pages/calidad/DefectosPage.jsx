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

const PROCESOS_CROCS = [
  { value: "ENSAMBLE", label: "Ensamble" },
  { value: "DIGITAL_PRINTING", label: "Digital Printing" },
];

const formatProceso = (p) =>
  PROCESOS_CROCS.find((x) => x.value === p)?.label || p || "";

// Grupo de defecto que corresponde a la selección (CROCS → proceso; resto → GENERAL)
const grupoFor = (unidadNombre, procesoCrocs) =>
  unidadNombre === "CROCS" ? procesoCrocs : "GENERAL";

const emptyForm = {
  areaProduccionId: "",
  unidadNegocioId: "",
  modeloId: "",
  procesoCrocs: "",
  tipoDefectoId: "",
  paresRechazados: "",
  observaciones: "",
};

export default function DefectosPage() {
  const { user } = useAuthStore();
  const [registros, setRegistros] = useState([]);
  const [catalogos, setCatalogos] = useState({
    turnos: [],
    areasProduccion: [],
    unidadesNegocio: [],
    tiposDefectos: [],
    turnoActual: null,
  });
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState(emptyForm);

  // Listas en cascada del formulario
  const [modelos, setModelos] = useState([]);
  const [modeloSearch, setModeloSearch] = useState("");
  const [showModeloDropdown, setShowModeloDropdown] = useState(false);
  const [defectosGrupo, setDefectosGrupo] = useState([]);
  const [defectoSearch, setDefectoSearch] = useState("");
  const [showDefectoDropdown, setShowDefectoDropdown] = useState(false);

  const [filters, setFilters] = useState({
    fechaInicio: "",
    fechaFin: "",
    turnoId: "",
    areaProduccionId: "",
    unidadNegocioId: "",
    tipoDefectoId: "",
  });
  const [appliedFilters, setAppliedFilters] = useState({
    fechaInicio: "",
    fechaFin: "",
    turnoId: "",
    areaProduccionId: "",
    unidadNegocioId: "",
    tipoDefectoId: "",
  });
  const [pagination, setPagination] = useState({
    total: 0,
    limit: 10,
    offset: 0,
    pages: 0,
  });

  const selectedUnidad = useMemo(
    () =>
      catalogos.unidadesNegocio.find(
        (u) => u.id.toString() === formData.unidadNegocioId.toString(),
      ),
    [catalogos.unidadesNegocio, formData.unidadNegocioId],
  );
  const isCrocs = selectedUnidad?.nombre === "CROCS";

  // Filtrado client-side (instantáneo) de modelos y defectos
  const filteredModelos = useMemo(() => {
    const q = modeloSearch.trim().toLowerCase();
    if (!q) return modelos;
    return modelos.filter((m) => m.nombre.toLowerCase().includes(q));
  }, [modelos, modeloSearch]);

  const filteredDefectos = useMemo(() => {
    const q = defectoSearch.trim().toLowerCase();
    if (!q) return defectosGrupo;
    return defectosGrupo.filter((d) => d.nombre.toLowerCase().includes(q));
  }, [defectosGrupo, defectoSearch]);

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

  const fetchModelos = async (unidadNegocioId) => {
    try {
      const res = await api.get(
        `/defectos/modelos?unidadNegocioId=${unidadNegocioId}`,
      );
      if (res.data.status === "success") setModelos(res.data.data.modelos);
    } catch (error) {
      console.error("Error fetching modelos:", error);
      setModelos([]);
    }
  };

  const fetchDefectosGrupo = async (grupo) => {
    try {
      const res = await api.get(`/defectos/tipos-defecto?grupo=${grupo}`);
      if (res.data.status === "success")
        setDefectosGrupo(res.data.data.tiposDefectos);
    } catch (error) {
      console.error("Error fetching defectos:", error);
      setDefectosGrupo([]);
    }
  };

  const fetchRegistros = useCallback(async (currentFilters, offset = 0) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append("limit", "10");
      params.append("offset", offset.toString());

      if (currentFilters.fechaInicio)
        params.append("fechaInicio", currentFilters.fechaInicio);
      if (currentFilters.fechaFin)
        params.append("fechaFin", currentFilters.fechaFin);
      if (currentFilters.turnoId)
        params.append("turnoId", currentFilters.turnoId);
      if (currentFilters.areaProduccionId)
        params.append("areaProduccionId", currentFilters.areaProduccionId);
      if (currentFilters.unidadNegocioId)
        params.append("unidadNegocioId", currentFilters.unidadNegocioId);
      if (currentFilters.tipoDefectoId)
        params.append("tipoDefectoId", currentFilters.tipoDefectoId);

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

  const handleApplyFilters = () => {
    setAppliedFilters({ ...filters });
    fetchRegistros(filters, 0);
  };

  const handleClearFilters = () => {
    const emptyFilters = {
      fechaInicio: "",
      fechaFin: "",
      turnoId: "",
      areaProduccionId: "",
      unidadNegocioId: "",
      tipoDefectoId: "",
    };
    setFilters(emptyFilters);
    setAppliedFilters(emptyFilters);
    fetchRegistros(emptyFilters, 0);
  };

  const handlePageChange = (newOffset) => {
    setPagination((prev) => ({ ...prev, offset: newOffset }));
    fetchRegistros(appliedFilters, newOffset);
  };

  // --- Cascada del formulario -------------------------------------------------

  const handleSelectUnidad = (e) => {
    const unidadNegocioId = e.target.value;
    const unidad = catalogos.unidadesNegocio.find(
      (u) => u.id.toString() === unidadNegocioId,
    );
    // Reset de todo lo que depende de la unidad
    setFormData((prev) => ({
      ...prev,
      unidadNegocioId,
      modeloId: "",
      procesoCrocs: "",
      tipoDefectoId: "",
    }));
    setModeloSearch("");
    setDefectoSearch("");
    setModelos([]);
    setDefectosGrupo([]);

    if (!unidad) return;
    if (unidad.nombre === "CROCS") {
      // Espera a que elijan proceso para cargar defectos
    } else {
      fetchModelos(unidad.id);
      fetchDefectosGrupo("GENERAL");
    }
  };

  const handleSelectProceso = (e) => {
    const procesoCrocs = e.target.value;
    setFormData((prev) => ({ ...prev, procesoCrocs, tipoDefectoId: "" }));
    setDefectoSearch("");
    setDefectosGrupo([]);
    if (procesoCrocs) fetchDefectosGrupo(procesoCrocs);
  };

  const handleSelectModelo = (modelo) => {
    setFormData((prev) => ({ ...prev, modeloId: modelo.id.toString() }));
    setModeloSearch(modelo.nombre);
    setShowModeloDropdown(false);
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

  const resetForm = () => {
    setFormData(emptyForm);
    setModelos([]);
    setModeloSearch("");
    setDefectosGrupo([]);
    setDefectoSearch("");
    setShowModeloDropdown(false);
    setShowDefectoDropdown(false);
    setEditingId(null);
  };

  const openNewModal = () => {
    resetForm();
    setShowModal(true);
  };

  // Cerrar el modal apagando también los dropdowns, si no el overlay a
  // pantalla completa se queda encima de la app bloqueando los clics.
  const closeModal = () => {
    setShowModal(false);
    setShowModeloDropdown(false);
    setShowDefectoDropdown(false);
  };

  const handleEdit = async (registro) => {
    setEditingId(registro.id);
    const unidadNegocioId = registro.unidad_negocio_id?.toString() || "";
    const procesoCrocs = registro.proceso_crocs || "";
    setFormData({
      areaProduccionId:
        catalogos.areasProduccion
          .find((a) => a.nombre === registro.area_produccion)
          ?.id?.toString() || "",
      unidadNegocioId,
      modeloId: registro.modelo_id?.toString() || "",
      procesoCrocs,
      tipoDefectoId: registro.tipo_defecto_id?.toString() || "",
      paresRechazados: registro.pares_rechazados?.toString() || "",
      observaciones: registro.observaciones || "",
    });
    setModeloSearch(registro.modelo || "");
    setDefectoSearch(registro.tipo_defecto || "");

    // Cargar listas dependientes del registro
    const unidad = catalogos.unidadesNegocio.find(
      (u) => u.id.toString() === unidadNegocioId,
    );
    if (unidad) {
      if (unidad.nombre === "CROCS") {
        if (procesoCrocs) fetchDefectosGrupo(procesoCrocs);
      } else {
        fetchModelos(unidad.id);
        fetchDefectosGrupo("GENERAL");
      }
    }
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        areaProduccionId: parseInt(formData.areaProduccionId),
        unidadNegocioId: parseInt(formData.unidadNegocioId),
        modeloId: isCrocs ? null : parseInt(formData.modeloId),
        procesoCrocs: isCrocs ? formData.procesoCrocs : null,
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

  const currentPage = Math.floor(pagination.offset / pagination.limit) + 1;
  const hasActiveFilters = Object.values(filters).some((v) => v !== "");

  // Validación para habilitar el botón de guardar
  const canSubmit =
    formData.areaProduccionId &&
    formData.unidadNegocioId &&
    formData.tipoDefectoId &&
    formData.paresRechazados &&
    (isCrocs ? !!formData.procesoCrocs : !!formData.modeloId);

  const selectClass =
    "w-full px-4 py-2.5 rounded-lg border border-gray-300 bg-white text-gray-900 focus:border-primary focus:ring-2 focus:ring-primary/20";
  const labelClass = "block text-sm font-medium text-gray-700 mb-1.5";

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
        <Button onClick={openNewModal}>
          <Plus className="w-4 h-4 mr-2" />
          Nuevo Registro
        </Button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
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
            <label className={labelClass}>Turno</label>
            <select
              className={selectClass}
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
            <label className={labelClass}>Área</label>
            <select
              className={selectClass}
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
            <label className={labelClass}>Unidad de Negocio</label>
            <select
              className={selectClass}
              value={filters.unidadNegocioId}
              onChange={(e) =>
                setFilters((prev) => ({
                  ...prev,
                  unidadNegocioId: e.target.value,
                }))
              }
            >
              <option value="">Todas</option>
              {catalogos.unidadesNegocio.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nombre}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Defecto</label>
            <select
              className={selectClass}
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
                {[
                  "Fecha",
                  "Turno",
                  "Área",
                  "Unidad",
                  "Modelo / Proceso",
                  "Defecto",
                  "Pares",
                  "Registrado por",
                ].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-gray-500">
                    Cargando...
                  </td>
                </tr>
              ) : registros.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-gray-500">
                    No hay registros
                  </td>
                </tr>
              ) : (
                registros.map((registro) => (
                  <tr key={registro.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">
                      {new Date(registro.fecha_registro).toLocaleDateString(
                        "es-MX",
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
                        {registro.turno}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">
                      {registro.area_produccion}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">
                      {registro.unidad_negocio || "—"}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">
                      {registro.modelo ||
                        formatProceso(registro.proceso_crocs) ||
                        "—"}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {registro.tipo_defecto}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      {registro.pares_rechazados}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">
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
          <div className="absolute inset-0 bg-black/50" onClick={closeModal} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 p-6 max-h-[90vh] overflow-y-auto">
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
              {/* Área */}
              <div>
                <label className={labelClass}>Área de Producción</label>
                <select
                  required
                  className={selectClass}
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

              {/* Unidad de Negocio */}
              <div>
                <label className={labelClass}>Unidad de Negocio</label>
                <select
                  required
                  className={selectClass}
                  value={formData.unidadNegocioId}
                  onChange={handleSelectUnidad}
                >
                  <option value="">Seleccionar unidad</option>
                  {catalogos.unidadesNegocio.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.nombre}
                    </option>
                  ))}
                </select>
              </div>

              {/* CROCS → Proceso ; resto → Modelo (buscador) */}
              {formData.unidadNegocioId &&
                (isCrocs ? (
                  <div>
                    <label className={labelClass}>Proceso</label>
                    <select
                      required
                      className={selectClass}
                      value={formData.procesoCrocs}
                      onChange={handleSelectProceso}
                    >
                      <option value="">Seleccionar proceso</option>
                      {PROCESOS_CROCS.map((p) => (
                        <option key={p.value} value={p.value}>
                          {p.label}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div className="relative">
                    <label className={labelClass}>Modelo</label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="text"
                        className="w-full pl-10 pr-10 py-2.5 rounded-lg border border-gray-300 bg-white text-gray-900 focus:border-primary focus:ring-2 focus:ring-primary/20"
                        placeholder="Buscar modelo..."
                        value={modeloSearch}
                        onChange={(e) => {
                          setModeloSearch(e.target.value);
                          setShowModeloDropdown(true);
                          if (!e.target.value)
                            setFormData((prev) => ({ ...prev, modeloId: "" }));
                        }}
                        onFocus={() => setShowModeloDropdown(true)}
                      />
                      {modeloSearch && (
                        <button
                          type="button"
                          onClick={() => {
                            setModeloSearch("");
                            setFormData((prev) => ({ ...prev, modeloId: "" }));
                          }}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    {showModeloDropdown && (
                      <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                        {filteredModelos.length === 0 ? (
                          <p className="px-4 py-2 text-sm text-gray-500">
                            No se encontraron modelos
                          </p>
                        ) : (
                          filteredModelos.map((m) => (
                            <button
                              key={m.id}
                              type="button"
                              className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 ${
                                formData.modeloId === m.id.toString()
                                  ? "bg-primary/5 text-primary font-medium"
                                  : "text-gray-900"
                              }`}
                              onClick={() => handleSelectModelo(m)}
                            >
                              {m.nombre}
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                ))}

              {/* Defecto (buscador, filtrado por grupo) */}
              <div className="relative">
                <label className={labelClass}>Tipo de Defecto</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    disabled={defectosGrupo.length === 0}
                    className="w-full pl-10 pr-10 py-2.5 rounded-lg border border-gray-300 bg-white text-gray-900 focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:bg-gray-50 disabled:text-gray-400"
                    placeholder={
                      defectosGrupo.length === 0
                        ? "Elige unidad/proceso primero"
                        : "Buscar defecto..."
                    }
                    value={defectoSearch}
                    onChange={(e) => {
                      setDefectoSearch(e.target.value);
                      setShowDefectoDropdown(true);
                      if (!e.target.value)
                        setFormData((prev) => ({ ...prev, tipoDefectoId: "" }));
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
                {showDefectoDropdown && defectosGrupo.length > 0 && (
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

              {/* Pares */}
              <div>
                <label className={labelClass}>Pares Rechazados</label>
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

              {/* Observaciones */}
              <div>
                <label className={labelClass}>Observaciones</label>
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
                <Button type="button" variant="ghost" onClick={closeModal}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={!canSubmit}>
                  {editingId ? "Guardar Cambios" : "Crear Registro"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Click outside para cerrar dropdowns (solo con el modal abierto) */}
      {showModal && (showDefectoDropdown || showModeloDropdown) && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => {
            setShowDefectoDropdown(false);
            setShowModeloDropdown(false);
          }}
        />
      )}
    </div>
  );
}
