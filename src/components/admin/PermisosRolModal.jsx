import { useState, useEffect } from "react";
import {
  Shield,
  Eye,
  Plus,
  Edit2,
  Trash2,
  X,
  Check,
  Copy,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import api from "../../services/api";
import Button from "../../components/ui/Button";

export default function PermisosRolModal({ rol, onClose, onSave }) {
  const [permisos, setPermisos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    if (rol) {
      fetchPermisos();
    }
  }, [rol]);

  const fetchPermisos = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/permisos/roles/${rol.id}`);
      if (response.data.status === "success") {
        setPermisos(response.data.data.permisos);
      }
    } catch (error) {
      console.error("Error fetching permisos:", error);
    } finally {
      setLoading(false);
    }
  };

  const handlePermisoChange = (moduloId, campo, valor) => {
    setPermisos((prev) =>
      prev.map((p) => {
        if (p.modulo_id === moduloId) {
          const updated = { ...p, [campo]: valor };

          // Si se desmarca puede_leer, desmarcar todos los demás
          if (campo === "puede_leer" && !valor) {
            updated.puede_crear = false;
            updated.puede_editar = false;
            updated.puede_eliminar = false;
          }

          // Si se marca cualquier otro permiso, marcar puede_leer automáticamente
          if (campo !== "puede_leer" && valor && !p.puede_leer) {
            updated.puede_leer = true;
          }

          return updated;
        }
        return p;
      }),
    );
  };

  const handleToggleAll = (campo) => {
    const todosActivos = permisos.every((p) => p[campo]);
    setPermisos((prev) =>
      prev.map((p) => {
        const updated = { ...p, [campo]: !todosActivos };

        // Lógica de dependencias
        if (campo === "puede_leer" && todosActivos) {
          updated.puede_crear = false;
          updated.puede_editar = false;
          updated.puede_eliminar = false;
        }
        if (campo !== "puede_leer" && !todosActivos && !p.puede_leer) {
          updated.puede_leer = true;
        }

        return updated;
      }),
    );
  };

  const handleSelectAllModulo = (moduloId, seleccionar) => {
    setPermisos((prev) =>
      prev.map((p) => {
        if (p.modulo_id === moduloId) {
          return {
            ...p,
            puede_leer: seleccionar,
            puede_crear: seleccionar,
            puede_editar: seleccionar,
            puede_eliminar: seleccionar,
          };
        }
        return p;
      }),
    );
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const permisosPayload = permisos.map((p) => ({
        moduloId: p.modulo_id,
        puedeLeer: p.puede_leer,
        puedeCrear: p.puede_crear,
        puedeEditar: p.puede_editar,
        puedeEliminar: p.puede_eliminar,
      }));

      await api.put(`/permisos/roles/${rol.id}`, {
        permisos: permisosPayload,
      });

      if (onSave) onSave();
      onClose();
    } catch (error) {
      console.error("Error saving permisos:", error);
      alert(error.response?.data?.message || "Error al guardar permisos");
    } finally {
      setSaving(false);
    }
  };

  const isAllChecked = (campo) => permisos.every((p) => p[campo]);
  const isSomeChecked = (campo) =>
    permisos.some((p) => p[campo]) && !isAllChecked(campo);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-4xl mx-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Shield className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                Permisos del Rol
              </h3>
              <p className="text-sm text-gray-500">{rol?.nombre}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {rol?.es_admin ? (
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 text-center">
              <Shield className="w-12 h-12 text-purple-500 mx-auto mb-2" />
              <h4 className="font-medium text-purple-900">Rol Administrador</h4>
              <p className="text-sm text-purple-700 mt-1">
                Este rol tiene acceso completo a todos los módulos del sistema.
                Los permisos no pueden ser modificados.
              </p>
            </div>
          ) : loading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div
                  key={i}
                  className="h-12 bg-gray-100 rounded-lg animate-pulse"
                />
              ))}
            </div>
          ) : (
            <>
              {/* Leyenda */}
              <div className="mb-4 flex flex-wrap items-center gap-4 text-sm text-gray-600">
                <span className="flex items-center gap-1">
                  <Eye className="w-4 h-4" /> Leer
                </span>
                <span className="flex items-center gap-1">
                  <Plus className="w-4 h-4" /> Crear
                </span>
                <span className="flex items-center gap-1">
                  <Edit2 className="w-4 h-4" /> Editar
                </span>
                <span className="flex items-center gap-1">
                  <Trash2 className="w-4 h-4" /> Eliminar
                </span>
              </div>

              {/* Tabla de permisos */}
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                        Módulo
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase w-20">
                        <button
                          onClick={() => handleToggleAll("puede_leer")}
                          className="flex items-center justify-center gap-1 mx-auto hover:text-primary"
                          title="Seleccionar/Deseleccionar todos"
                        >
                          <Eye className="w-4 h-4" />
                          <input
                            type="checkbox"
                            checked={isAllChecked("puede_leer")}
                            ref={(el) => {
                              if (el)
                                el.indeterminate = isSomeChecked("puede_leer");
                            }}
                            onChange={() => handleToggleAll("puede_leer")}
                            className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary"
                          />
                        </button>
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase w-20">
                        <button
                          onClick={() => handleToggleAll("puede_crear")}
                          className="flex items-center justify-center gap-1 mx-auto hover:text-primary"
                          title="Seleccionar/Deseleccionar todos"
                        >
                          <Plus className="w-4 h-4" />
                          <input
                            type="checkbox"
                            checked={isAllChecked("puede_crear")}
                            ref={(el) => {
                              if (el)
                                el.indeterminate = isSomeChecked("puede_crear");
                            }}
                            onChange={() => handleToggleAll("puede_crear")}
                            className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary"
                          />
                        </button>
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase w-20">
                        <button
                          onClick={() => handleToggleAll("puede_editar")}
                          className="flex items-center justify-center gap-1 mx-auto hover:text-primary"
                          title="Seleccionar/Deseleccionar todos"
                        >
                          <Edit2 className="w-4 h-4" />
                          <input
                            type="checkbox"
                            checked={isAllChecked("puede_editar")}
                            ref={(el) => {
                              if (el)
                                el.indeterminate =
                                  isSomeChecked("puede_editar");
                            }}
                            onChange={() => handleToggleAll("puede_editar")}
                            className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary"
                          />
                        </button>
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase w-20">
                        <button
                          onClick={() => handleToggleAll("puede_eliminar")}
                          className="flex items-center justify-center gap-1 mx-auto hover:text-primary"
                          title="Seleccionar/Deseleccionar todos"
                        >
                          <Trash2 className="w-4 h-4" />
                          <input
                            type="checkbox"
                            checked={isAllChecked("puede_eliminar")}
                            ref={(el) => {
                              if (el)
                                el.indeterminate =
                                  isSomeChecked("puede_eliminar");
                            }}
                            onChange={() => handleToggleAll("puede_eliminar")}
                            className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary"
                          />
                        </button>
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase w-24">
                        Todos
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {permisos.map((permiso) => {
                      const todosActivos =
                        permiso.puede_leer &&
                        permiso.puede_crear &&
                        permiso.puede_editar &&
                        permiso.puede_eliminar;

                      return (
                        <tr
                          key={permiso.modulo_id}
                          className="hover:bg-gray-50"
                        >
                          <td className="px-4 py-3">
                            <div>
                              <p className="text-sm font-medium text-gray-900">
                                {permiso.modulo_nombre}
                              </p>
                              <p className="text-xs text-gray-500">
                                {permiso.ruta}
                              </p>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <input
                              type="checkbox"
                              checked={permiso.puede_leer}
                              onChange={(e) =>
                                handlePermisoChange(
                                  permiso.modulo_id,
                                  "puede_leer",
                                  e.target.checked,
                                )
                              }
                              className="w-5 h-5 text-primary border-gray-300 rounded focus:ring-primary"
                            />
                          </td>
                          <td className="px-4 py-3 text-center">
                            <input
                              type="checkbox"
                              checked={permiso.puede_crear}
                              onChange={(e) =>
                                handlePermisoChange(
                                  permiso.modulo_id,
                                  "puede_crear",
                                  e.target.checked,
                                )
                              }
                              className="w-5 h-5 text-primary border-gray-300 rounded focus:ring-primary"
                            />
                          </td>
                          <td className="px-4 py-3 text-center">
                            <input
                              type="checkbox"
                              checked={permiso.puede_editar}
                              onChange={(e) =>
                                handlePermisoChange(
                                  permiso.modulo_id,
                                  "puede_editar",
                                  e.target.checked,
                                )
                              }
                              className="w-5 h-5 text-primary border-gray-300 rounded focus:ring-primary"
                            />
                          </td>
                          <td className="px-4 py-3 text-center">
                            <input
                              type="checkbox"
                              checked={permiso.puede_eliminar}
                              onChange={(e) =>
                                handlePermisoChange(
                                  permiso.modulo_id,
                                  "puede_eliminar",
                                  e.target.checked,
                                )
                              }
                              className="w-5 h-5 text-primary border-gray-300 rounded focus:ring-primary"
                            />
                          </td>
                          <td className="px-4 py-3 text-center">
                            <button
                              onClick={() =>
                                handleSelectAllModulo(
                                  permiso.modulo_id,
                                  !todosActivos,
                                )
                              }
                              className={`px-2 py-1 text-xs font-medium rounded-full transition-colors ${
                                todosActivos
                                  ? "bg-green-100 text-green-700 hover:bg-green-200"
                                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                              }`}
                            >
                              {todosActivos ? "Todos" : "Ninguno"}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        {!rol?.es_admin && (
          <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3 flex-shrink-0">
            <Button variant="ghost" onClick={onClose}>
              Cancelar
            </Button>
            <Button onClick={handleSave} isLoading={saving}>
              <Check className="w-4 h-4 mr-2" />
              Guardar Permisos
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
