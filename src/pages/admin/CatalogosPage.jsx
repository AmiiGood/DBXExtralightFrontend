import { useState, useEffect } from "react";
import {
  Clock,
  Factory,
  AlertTriangle,
  Shield,
  Building2,
  Plus,
  Edit2,
  ToggleLeft,
  ToggleRight,
  Search,
  X,
  Key,
} from "lucide-react";
import api from "../../services/api";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import PermisosRolModal from "../../components/admin/PermisosRolModal";

const tabs = [
  { id: "turnos", label: "Turnos", icon: Clock },
  { id: "areas-produccion", label: "Áreas de Producción", icon: Factory },
  { id: "tipos-defectos", label: "Tipos de Defectos", icon: AlertTriangle },
  { id: "roles", label: "Roles", icon: Shield },
  { id: "areas", label: "Áreas/Departamentos", icon: Building2 },
];

export default function CatalogosPage() {
  const [activeTab, setActiveTab] = useState("turnos");
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [formData, setFormData] = useState({});
  const [showPermisosModal, setShowPermisosModal] = useState(false);
  const [selectedRolPermisos, setSelectedRolPermisos] = useState(null);

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/catalogos/${activeTab}`);
      if (response.data.status === "success") {
        // El nombre de la propiedad varía según el catálogo
        const dataKey = getDataKey(activeTab);
        setData(response.data.data[dataKey] || []);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  const getDataKey = (tab) => {
    const keys = {
      turnos: "turnos",
      "areas-produccion": "areasProduccion",
      "tipos-defectos": "tiposDefectos",
      roles: "roles",
      areas: "areas",
    };
    return keys[tab];
  };

  const handleCreate = () => {
    setEditingItem(null);
    setFormData(getEmptyFormData());
    setShowModal(true);
  };

  const handleEdit = (item) => {
    setEditingItem(item);
    setFormData(getFormDataFromItem(item));
    setShowModal(true);
  };

  const handleToggleActive = async (item) => {
    try {
      await api.put(`/catalogos/${activeTab}/${item.id}`, {
        activo: !item.activo,
      });
      fetchData();
    } catch (error) {
      console.error("Error toggling active:", error);
      alert(error.response?.data?.message || "Error al cambiar estado");
    }
  };

  const handleOpenPermisos = (rol) => {
    setSelectedRolPermisos(rol);
    setShowPermisosModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = preparePayload();

      if (editingItem) {
        await api.put(`/catalogos/${activeTab}/${editingItem.id}`, payload);
      } else {
        await api.post(`/catalogos/${activeTab}`, payload);
      }

      setShowModal(false);
      fetchData();
    } catch (error) {
      console.error("Error saving:", error);
      alert(error.response?.data?.message || "Error al guardar");
    }
  };

  const getEmptyFormData = () => {
    switch (activeTab) {
      case "turnos":
        return { nombre: "", horaInicio: "", horaFin: "", descripcion: "" };
      case "areas-produccion":
      case "tipos-defectos":
      case "areas":
        return { nombre: "", descripcion: "" };
      case "roles":
        return { nombre: "", descripcion: "", esAdmin: false };
      default:
        return {};
    }
  };

  const getFormDataFromItem = (item) => {
    switch (activeTab) {
      case "turnos":
        return {
          nombre: item.nombre || "",
          horaInicio: item.hora_inicio || "",
          horaFin: item.hora_fin || "",
          descripcion: item.descripcion || "",
        };
      case "areas-produccion":
      case "tipos-defectos":
      case "areas":
        return {
          nombre: item.nombre || "",
          descripcion: item.descripcion || "",
        };
      case "roles":
        return {
          nombre: item.nombre || "",
          descripcion: item.descripcion || "",
          esAdmin: item.es_admin || false,
        };
      default:
        return {};
    }
  };

  const preparePayload = () => {
    switch (activeTab) {
      case "turnos":
        return {
          nombre: formData.nombre,
          horaInicio: formData.horaInicio,
          horaFin: formData.horaFin,
          descripcion: formData.descripcion || undefined,
        };
      case "areas-produccion":
      case "tipos-defectos":
      case "areas":
        return {
          nombre: formData.nombre,
          descripcion: formData.descripcion || undefined,
        };
      case "roles":
        return {
          nombre: formData.nombre,
          descripcion: formData.descripcion || undefined,
          esAdmin: formData.esAdmin,
        };
      default:
        return {};
    }
  };

  const getTabTitle = () => {
    const tab = tabs.find((t) => t.id === activeTab);
    return tab ? tab.label : "";
  };

  const filteredData = data.filter((item) =>
    item.nombre?.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const renderTable = () => {
    if (loading) {
      return (
        <div className="px-4 py-8 text-center text-gray-500">Cargando...</div>
      );
    }

    if (filteredData.length === 0) {
      return (
        <div className="px-4 py-8 text-center text-gray-500">
          No hay registros
        </div>
      );
    }

    switch (activeTab) {
      case "turnos":
        return (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                  ID
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                  Nombre
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                  Hora Inicio
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                  Hora Fin
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                  Descripción
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                  Estado
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredData.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm text-gray-500">{item.id}</td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">
                    {item.nombre}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {item.hora_inicio}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {item.hora_fin}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {item.descripcion || "-"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        item.activo
                          ? "bg-green-100 text-green-700"
                          : "bg-red-100 text-red-700"
                      }`}
                    >
                      {item.activo ? "Activo" : "Inactivo"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {renderActions(item)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        );

      case "roles":
        return (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                  ID
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                  Nombre
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                  Descripción
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                  Admin
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                  Estado
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredData.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm text-gray-500">{item.id}</td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">
                    {item.nombre}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {item.descripcion || "-"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        item.es_admin
                          ? "bg-purple-100 text-purple-700"
                          : "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {item.es_admin ? "Sí" : "No"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        item.activo
                          ? "bg-green-100 text-green-700"
                          : "bg-red-100 text-red-700"
                      }`}
                    >
                      {item.activo ? "Activo" : "Inactivo"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => handleOpenPermisos(item)}
                        className="p-1.5 text-gray-400 hover:text-secondary hover:bg-secondary/10 rounded-lg transition-colors"
                        title="Gestionar permisos"
                      >
                        <Key className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleEdit(item)}
                        className="p-1.5 text-gray-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                        title="Editar"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleToggleActive(item)}
                        className={`p-1.5 rounded-lg transition-colors ${
                          item.activo
                            ? "text-gray-400 hover:text-red-500 hover:bg-red-50"
                            : "text-gray-400 hover:text-green-500 hover:bg-green-50"
                        }`}
                        title={item.activo ? "Desactivar" : "Activar"}
                      >
                        {item.activo ? (
                          <ToggleRight className="w-4 h-4" />
                        ) : (
                          <ToggleLeft className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        );

      default:
        return (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                  ID
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                  Nombre
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                  Descripción
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                  Estado
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredData.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm text-gray-500">{item.id}</td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">
                    {item.nombre}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {item.descripcion || "-"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        item.activo
                          ? "bg-green-100 text-green-700"
                          : "bg-red-100 text-red-700"
                      }`}
                    >
                      {item.activo ? "Activo" : "Inactivo"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {renderActions(item)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        );
    }
  };

  const renderActions = (item) => (
    <div className="flex items-center justify-end gap-1">
      <button
        onClick={() => handleEdit(item)}
        className="p-1.5 text-gray-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
        title="Editar"
      >
        <Edit2 className="w-4 h-4" />
      </button>
      <button
        onClick={() => handleToggleActive(item)}
        className={`p-1.5 rounded-lg transition-colors ${
          item.activo
            ? "text-gray-400 hover:text-red-500 hover:bg-red-50"
            : "text-gray-400 hover:text-green-500 hover:bg-green-50"
        }`}
        title={item.activo ? "Desactivar" : "Activar"}
      >
        {item.activo ? (
          <ToggleRight className="w-4 h-4" />
        ) : (
          <ToggleLeft className="w-4 h-4" />
        )}
      </button>
    </div>
  );

  const renderModalForm = () => {
    switch (activeTab) {
      case "turnos":
        return (
          <>
            <Input
              label="Nombre"
              required
              value={formData.nombre}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, nombre: e.target.value }))
              }
              placeholder="Ej: Turno Matutino"
            />
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Hora Inicio"
                type="time"
                required
                value={formData.horaInicio}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    horaInicio: e.target.value,
                  }))
                }
              />
              <Input
                label="Hora Fin"
                type="time"
                required
                value={formData.horaFin}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, horaFin: e.target.value }))
                }
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Descripción
              </label>
              <textarea
                rows={2}
                className="w-full px-4 py-2.5 rounded-lg border border-gray-300 bg-white text-gray-900 focus:border-primary focus:ring-2 focus:ring-primary/20 resize-none"
                value={formData.descripcion}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    descripcion: e.target.value,
                  }))
                }
                placeholder="Descripción opcional"
              />
            </div>
          </>
        );

      case "roles":
        return (
          <>
            <Input
              label="Nombre"
              required
              value={formData.nombre}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, nombre: e.target.value }))
              }
              placeholder="Ej: Supervisor"
            />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Descripción
              </label>
              <textarea
                rows={2}
                className="w-full px-4 py-2.5 rounded-lg border border-gray-300 bg-white text-gray-900 focus:border-primary focus:ring-2 focus:ring-primary/20 resize-none"
                value={formData.descripcion}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    descripcion: e.target.value,
                  }))
                }
                placeholder="Descripción opcional"
              />
            </div>
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="esAdmin"
                checked={formData.esAdmin}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    esAdmin: e.target.checked,
                  }))
                }
                className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary"
              />
              <label
                htmlFor="esAdmin"
                className="text-sm font-medium text-gray-700"
              >
                Es Administrador (acceso total al sistema)
              </label>
            </div>
          </>
        );

      default:
        return (
          <>
            <Input
              label="Nombre"
              required
              value={formData.nombre}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, nombre: e.target.value }))
              }
              placeholder="Nombre del registro"
            />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Descripción
              </label>
              <textarea
                rows={3}
                className="w-full px-4 py-2.5 rounded-lg border border-gray-300 bg-white text-gray-900 focus:border-primary focus:ring-2 focus:ring-primary/20 resize-none"
                value={formData.descripcion}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    descripcion: e.target.value,
                  }))
                }
                placeholder="Descripción opcional"
              />
            </div>
          </>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="flex overflow-x-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  setSearchTerm("");
                }}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? "border-primary text-primary bg-primary/5"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Header y búsqueda */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            {getTabTitle()}
          </h2>
          <p className="text-sm text-gray-500">
            {filteredData.length} registro{filteredData.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              className="pl-10 pr-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-900 focus:border-primary focus:ring-2 focus:ring-primary/20 w-64"
              placeholder="Buscar por nombre..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <Button onClick={handleCreate}>
            <Plus className="w-4 h-4 mr-2" />
            Nuevo
          </Button>
        </div>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">{renderTable()}</div>
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
                {editingItem ? "Editar" : "Nuevo"} {getTabTitle().slice(0, -1)}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {renderModalForm()}

              <div className="flex justify-end gap-3 pt-4">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setShowModal(false)}
                >
                  Cancelar
                </Button>
                <Button type="submit">
                  {editingItem ? "Guardar Cambios" : "Crear"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Permisos */}
      {showPermisosModal && selectedRolPermisos && (
        <PermisosRolModal
          rol={selectedRolPermisos}
          onClose={() => {
            setShowPermisosModal(false);
            setSelectedRolPermisos(null);
          }}
          onSave={() => {
            fetchData();
          }}
        />
      )}
    </div>
  );
}
