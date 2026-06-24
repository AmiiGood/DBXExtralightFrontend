import { useState, useEffect } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  FileText,
  ClipboardList,
  BarChart3,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  QrCode,
  PackageCheck,
} from "lucide-react";
import { useAuthStore } from "../../stores/auth.store";

const iconMap = {
  Dashboard: LayoutDashboard,
  "Gestión de Usuarios": Users,
  "Logs del Sistema": FileText,
  "FPG-QA-001 Ver.03 OBA ensamble": ClipboardList,
  "Reportes de Calidad": BarChart3,
  Catálogos: Settings,
  "Validación QR": QrCode,
  "Recepción Cajas": PackageCheck,
};

const moduleRoutes = {
  Dashboard: "/dashboard",
  "Gestión de Usuarios": "/admin/usuarios",
  "Logs del Sistema": "/admin/logs",
  "FPG-QA-001 Ver.03 OBA ensamble": "/calidad/defectos",
  "Reportes de Calidad": "/calidad/reportes",
  Catálogos: "/admin/catalogos",
  "Validación QR": "/calidad/qr-validation",
  "Recepción Cajas": "/calidad/recepcion-cajas",
};

export default function Sidebar({ modulos = [], loading = false, onToggle }) {
  const [collapsed, setCollapsed] = useState(false);
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (onToggle) onToggle(collapsed);
  }, [collapsed, onToggle]);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const adminModulos = modulos.filter((m) =>
    ["Gestión de Usuarios", "Logs del Sistema", "Catálogos"].includes(m.nombre),
  );
  const calidadModulos = modulos.filter((m) =>
    [
      "FPG-QA-001 Ver.03 OBA ensamble",
      "Reportes de Calidad",
      "Validación QR",
      "Recepción Cajas",
    ].includes(m.nombre),
  );
  const dashboardModulo = modulos.find((m) => m.nombre === "Dashboard");

  const renderNavItem = (modulo) => {
    const Icon = iconMap[modulo.nombre] || LayoutDashboard;
    const route = modulo.ruta || moduleRoutes[modulo.nombre] || "/dashboard";

    return (
      <NavLink
        key={modulo.id}
        to={route}
        className={({ isActive }) => `
          flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200
          ${isActive ? "bg-primary text-white shadow-md" : "text-gray-600 hover:bg-gray-100"}
          ${collapsed ? "justify-center" : ""}
        `}
        title={collapsed ? modulo.nombre : ""}
      >
        <Icon className="w-5 h-5 flex-shrink-0" />
        {!collapsed && (
          <span className="text-sm font-medium">{modulo.nombre}</span>
        )}
      </NavLink>
    );
  };

  const renderSection = (title, items) => {
    if (items.length === 0) return null;
    return (
      <div className="mb-6">
        {!collapsed && (
          <h3 className="px-3 mb-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
            {title}
          </h3>
        )}
        <nav className="space-y-1">{items.map(renderNavItem)}</nav>
      </div>
    );
  };

  return (
    <aside
      className={`fixed left-0 top-0 h-screen bg-white border-r border-gray-200 flex flex-col transition-all duration-300 z-40 ${collapsed ? "w-20" : "w-64"}`}
    >
      {/* Header */}
      <div
        className={`p-4 border-b border-gray-200 flex items-center ${collapsed ? "justify-center" : "justify-between"}`}
      >
        {!collapsed && (
          <div className="flex items-center gap-3">
            <img
              src="/logo.png"
              alt="Logo"
              className="h-10 w-auto"
              onError={(e) => {
                e.target.style.display = "none";
                e.target.nextSibling.style.display = "flex";
              }}
            />
            <div className="hidden w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-secondary items-center justify-center">
              <span className="text-white font-bold text-sm">FC</span>
            </div>
            <div>
              <h1 className="font-bold text-gray-900 text-sm">
                Sistema Central
              </h1>
              <p className="text-xs text-gray-500">Foam Creations</p>
            </div>
          </div>
        )}
        {collapsed && (
          <>
            <img
              src="/logo.png"
              alt="Logo"
              className="h-10 w-auto"
              onError={(e) => {
                e.target.style.display = "none";
                e.target.nextSibling.style.display = "flex";
              }}
            />
            <div className="hidden w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-secondary items-center justify-center">
              <span className="text-white font-bold text-sm">FC</span>
            </div>
          </>
        )}
      </div>

      {/* Toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-20 w-6 h-6 bg-white border border-gray-200 rounded-full flex items-center justify-center shadow-sm hover:shadow-md transition-shadow"
      >
        {collapsed ? (
          <ChevronRight className="w-4 h-4 text-gray-600" />
        ) : (
          <ChevronLeft className="w-4 h-4 text-gray-600" />
        )}
      </button>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-10 bg-gray-100 rounded-lg animate-pulse"
              />
            ))}
          </div>
        ) : (
          <>
            {dashboardModulo && (
              <div className="mb-6">{renderNavItem(dashboardModulo)}</div>
            )}
            {renderSection("Calidad", calidadModulos)}
            {renderSection("Administración", adminModulos)}
          </>
        )}
      </div>

      {/* User & Logout */}
      <div className="p-4 border-t border-gray-200">
        {!collapsed && (
          <div className="mb-3 px-3">
            <p className="text-sm font-medium text-gray-900 truncate">
              {user?.nombreCompleto}
            </p>
            <p className="text-xs text-gray-500">{user?.rol?.nombre}</p>
          </div>
        )}
        <button
          onClick={handleLogout}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-red-600 hover:bg-red-50 transition-colors ${collapsed ? "justify-center" : ""}`}
          title={collapsed ? "Cerrar sesión" : ""}
        >
          <LogOut className="w-5 h-5" />
          {!collapsed && (
            <span className="text-sm font-medium">Cerrar sesión</span>
          )}
        </button>
      </div>
    </aside>
  );
}
