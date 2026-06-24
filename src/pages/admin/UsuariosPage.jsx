import { useState, useEffect } from "react";
import { Plus, Edit2, UserX, UserCheck, Key, Search } from "lucide-react";
import { useAuthStore } from "../../stores/auth.store";
import api from "../../services/api";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";

export default function UsuariosPage() {
  const { user } = useAuthStore();
  const [usuarios, setUsuarios] = useState([]);
  const [roles, setRoles] = useState([]);
  const [areas, setAreas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [formData, setFormData] = useState({
    nombreUsuario: "",
    email: "",
    password: "",
    nombreCompleto: "",
    rolId: "",
    areaId: "",
  });
  const [newPassword, setNewPassword] = useState("");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [usuariosRes, rolesRes, areasRes] = await Promise.all([
        api.get("/usuarios"),
        api.get("/usuarios/roles"),
        api.get("/usuarios/areas"),
      ]);

      if (usuariosRes.data.status === "success") {
        setUsuarios(usuariosRes.data.data.usuarios);
      }
      if (rolesRes.data.status === "success") {
        setRoles(rolesRes.data.data.roles);
      }
      if (areasRes.data.status === "success") {
        setAreas(areasRes.data.data.areas);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...formData,
        rolId: parseInt(formData.rolId),
        areaId: parseInt(formData.areaId),
      };

      if (editingId) {
        delete payload.password;
        await api.put(`/usuarios/${editingId}`, payload);
      } else {
        await api.post("/usuarios", payload);
      }

      setShowModal(false);
      resetForm();
      fetchData();
    } catch (error) {
      console.error("Error saving usuario:", error);
      alert(error.response?.data?.message || "Error al guardar");
    }
  };

  const handleEdit = (usuario) => {
    setEditingId(usuario.id);
    setFormData({
      nombreUsuario: usuario.nombre_usuario,
      email: usuario.email,
      password: "",
      nombreCompleto: usuario.nombre_completo,
      rolId: usuario.rol_id?.toString() || "",
      areaId: usuario.area_id?.toString() || "",
    });
    setShowModal(true);
  };

  const handleToggleActive = async (usuario) => {
    try {
      if (usuario.activo) {
        await api.patch(`/usuarios/${usuario.id}/desactivar`);
      } else {
        await api.patch(`/usuarios/${usuario.id}/activar`);
      }
      fetchData();
    } catch (error) {
      console.error("Error toggling user:", error);
      alert(error.response?.data?.message || "Error al cambiar estado");
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    try {
      await api.post(`/usuarios/${selectedUserId}/reset-password`, {
        nuevaPassword: newPassword,
      });
      setShowPasswordModal(false);
      setNewPassword("");
      setSelectedUserId(null);
      alert("Contraseña actualizada correctamente");
    } catch (error) {
      console.error("Error resetting password:", error);
      alert(error.response?.data?.message || "Error al resetear contraseña");
    }
  };

  const resetForm = () => {
    setFormData({
      nombreUsuario: "",
      email: "",
      password: "",
      nombreCompleto: "",
      rolId: "",
      areaId: "",
    });
    setEditingId(null);
  };

  const filteredUsuarios = usuarios.filter(
    (u) =>
      u.nombre_completo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.nombre_usuario?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email?.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            Usuarios del Sistema
          </h2>
          <p className="text-sm text-gray-500">
            Gestiona los usuarios y sus permisos
          </p>
        </div>
        <Button
          onClick={() => {
            resetForm();
            setShowModal(true);
          }}
        >
          <Plus className="w-4 h-4 mr-2" />
          Nuevo Usuario
        </Button>
      </div>

      {/* Search */}
      <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
        <Input
          icon={Search}
          placeholder="Buscar por nombre, usuario o email..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                  Usuario
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                  Email
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                  Rol
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                  Área
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
              {loading ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-8 text-center text-gray-500"
                  >
                    Cargando...
                  </td>
                </tr>
              ) : filteredUsuarios.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-8 text-center text-gray-500"
                  >
                    No hay usuarios
                  </td>
                </tr>
              ) : (
                filteredUsuarios.map((usuario) => (
                  <tr key={usuario.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
                          <span className="text-white text-sm font-medium">
                            {usuario.nombre_completo?.charAt(0) || "U"}
                          </span>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {usuario.nombre_completo}
                          </p>
                          <p className="text-xs text-gray-500">
                            @{usuario.nombre_usuario}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {usuario.email}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          usuario.es_admin
                            ? "bg-purple-100 text-purple-700"
                            : "bg-gray-100 text-gray-700"
                        }`}
                      >
                        {usuario.rol_nombre}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {usuario.area_nombre}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          usuario.activo
                            ? "bg-green-100 text-green-700"
                            : "bg-red-100 text-red-700"
                        }`}
                      >
                        {usuario.activo ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {/* No mostrar acciones para el usuario actual */}
                        {usuario.id !== user?.id ? (
                          <>
                            <button
                              onClick={() => handleEdit(usuario)}
                              className="p-1.5 text-gray-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                              title="Editar"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => {
                                setSelectedUserId(usuario.id);
                                setShowPasswordModal(true);
                              }}
                              className="p-1.5 text-gray-400 hover:text-secondary hover:bg-secondary/10 rounded-lg transition-colors"
                              title="Cambiar contraseña"
                            >
                              <Key className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleToggleActive(usuario)}
                              className={`p-1.5 rounded-lg transition-colors ${
                                usuario.activo
                                  ? "text-gray-400 hover:text-red-500 hover:bg-red-50"
                                  : "text-gray-400 hover:text-green-500 hover:bg-green-50"
                              }`}
                              title={usuario.activo ? "Desactivar" : "Activar"}
                            >
                              {usuario.activo ? (
                                <UserX className="w-4 h-4" />
                              ) : (
                                <UserCheck className="w-4 h-4" />
                              )}
                            </button>
                          </>
                        ) : (
                          <span className="text-xs text-gray-400 italic">
                            Tu cuenta
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Usuario */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setShowModal(false)}
          />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              {editingId ? "Editar Usuario" : "Nuevo Usuario"}
            </h3>

            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                label="Nombre Completo"
                required
                value={formData.nombreCompleto}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    nombreCompleto: e.target.value,
                  }))
                }
              />

              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Usuario"
                  required
                  value={formData.nombreUsuario}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      nombreUsuario: e.target.value,
                    }))
                  }
                />
                <Input
                  label="Email"
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, email: e.target.value }))
                  }
                />
              </div>

              {!editingId && (
                <Input
                  label="Contraseña"
                  type="password"
                  required
                  value={formData.password}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      password: e.target.value,
                    }))
                  }
                />
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Rol
                  </label>
                  <select
                    required
                    className="w-full px-4 py-2.5 rounded-lg border border-gray-300 bg-white text-gray-900 focus:border-primary focus:ring-2 focus:ring-primary/20"
                    value={formData.rolId}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        rolId: e.target.value,
                      }))
                    }
                  >
                    <option value="">Seleccionar</option>
                    {roles.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.nombre}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Área
                  </label>
                  <select
                    required
                    className="w-full px-4 py-2.5 rounded-lg border border-gray-300 bg-white text-gray-900 focus:border-primary focus:ring-2 focus:ring-primary/20"
                    value={formData.areaId}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        areaId: e.target.value,
                      }))
                    }
                  >
                    <option value="">Seleccionar</option>
                    {areas.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.nombre}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setShowModal(false)}
                >
                  Cancelar
                </Button>
                <Button type="submit">
                  {editingId ? "Guardar Cambios" : "Crear Usuario"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Reset Password */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setShowPasswordModal(false)}
          />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Resetear Contraseña
            </h3>

            <form onSubmit={handleResetPassword} className="space-y-4">
              <Input
                label="Nueva Contraseña"
                type="password"
                required
                minLength={6}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />

              <div className="flex justify-end gap-3 pt-4">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setShowPasswordModal(false)}
                >
                  Cancelar
                </Button>
                <Button type="submit">Actualizar</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
