import { useState, useEffect } from "react";
import { NavLink, useNavigate, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  House,
  Users,
  FileText,
  ClipboardList,
  Settings,
  LogOut,
  PenLine,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  QrCode,
  PackageCheck,
  FileSpreadsheet,
  Factory,
  Mail,
  Upload,
  LayoutGrid,
  ShoppingCart,
  UserCheck,
  Scale,
  PiggyBank,
  ClipboardPenLine,
} from "lucide-react";
import { useAuthStore } from "../../stores/auth.store";
import { MODULOS_DE_REPORTE } from "../../config/areas";
import { MODULOS_DE_CARGA } from "../../config/cargas";

/**
 * Menú lateral.
 *
 * Arriba, tres entradas fijas: Inicio, Reportes por área y Cargas de datos.
 * Debajo, solo las pantallas de TRABAJO (capturar, cotizar, configurar)
 * agrupadas por área. Los reportes no salen aquí porque ya están en
 * "Reportes por área", y las cargas de Excel y archivos vigilados viven juntas
 * en "Cargas de datos": antes el administrador veía ~39 entradas y los
 * reportes salían dos veces.
 *
 * Un módulo nuevo que no esté en ninguna lista no se pierde: cae en "Otros"
 * hasta que se le acomode.
 */

const SECCIONES = [
  {
    titulo: "Compras",
    modulos: ["Solicitudes de Compra", "Cotizaciones de Compras", "Presupuestos de Compras", "Formatos de Compras"],
  },
  {
    titulo: "Calidad",
    modulos: ["FPG-QA-001 Ver.03 OBA ensamble", "Validación QR", "Recepción Cajas"],
  },
  {
    titulo: "Producción",
    modulos: ["Producción Inyección", "Carga Masiva de Artículos"],
  },
  {
    titulo: "Administración",
    modulos: ["Gestión de Usuarios", "Aprobadores de Compras", "Catálogos", "Envío de Reportes", "Logs del Sistema"],
    // Se usa poco: empieza plegada (se abre sola si estás en una de sus pantallas)
    plegada: true,
  },
];

// Dentro de su sección el nombre largo sobra
const ETIQUETAS = {
  "Cotizaciones de Compras": "Cotizaciones",
  "Presupuestos de Compras": "Presupuestos",
  "Formatos de Compras": "Formatos en papel",
  "Producción Inyección": "Captura de inyección",
};

const iconMap = {
  "Gestión de Usuarios": Users,
  "Logs del Sistema": FileText,
  "FPG-QA-001 Ver.03 OBA ensamble": ClipboardList,
  Catálogos: Settings,
  "Validación QR": QrCode,
  "Recepción Cajas": PackageCheck,
  "Carga Masiva de Artículos": FileSpreadsheet,
  "Producción Inyección": Factory,
  "Envío de Reportes": Mail,
  "Solicitudes de Compra": ShoppingCart,
  "Aprobadores de Compras": UserCheck,
  "Cotizaciones de Compras": Scale,
  "Presupuestos de Compras": PiggyBank,
  "Formatos de Compras": ClipboardPenLine,
};

const FIJAS = [
  { id: "__inicio__", nombre: "Inicio", ruta: "/inicio", icono: House },
  { id: "__reportes__", nombre: "Reportes por área", ruta: "/reportes", icono: LayoutGrid },
  { id: "__cargas__", nombre: "Cargas de datos", ruta: "/cargas", icono: Upload, soloConCargas: true },
];

const LLAVE_PLEGADAS = "dbx.menu.plegadas";

function leerPlegadas() {
  try {
    const v = JSON.parse(localStorage.getItem(LLAVE_PLEGADAS) || "null");
    return v && typeof v === "object" ? v : {};
  } catch {
    return {};
  }
}

/** Arma las secciones con lo que el usuario puede abrir. */
function armarSecciones(modulos) {
  const usados = new Set();
  const secciones = SECCIONES.map((s) => {
    const items = s.modulos.map((n) => modulos.find((m) => m.nombre === n)).filter(Boolean);
    items.forEach((m) => usados.add(m.nombre));
    return { ...s, items };
  });
  const otros = modulos.filter(
    (m) =>
      !usados.has(m.nombre) &&
      !MODULOS_DE_REPORTE.has(m.nombre) &&
      !MODULOS_DE_CARGA.has(m.nombre) &&
      m.nombre !== "Dashboard",
  );
  if (otros.length) secciones.push({ titulo: "Otros", items: otros });
  return secciones.filter((s) => s.items.length > 0);
}

export default function Sidebar({ modulos = [], loading = false, onToggle }) {
  const [collapsed, setCollapsed] = useState(false);
  const [plegadas, setPlegadas] = useState(leerPlegadas);
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  useEffect(() => {
    if (onToggle) onToggle(collapsed);
  }, [collapsed, onToggle]);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const secciones = armarSecciones(modulos);
  const tieneCargas = modulos.some((m) => MODULOS_DE_CARGA.has(m.nombre));

  const estaPlegada = (s) => {
    // La sección de la pantalla actual siempre se ve
    if (s.items.some((m) => m.ruta && pathname.startsWith(m.ruta))) return false;
    return plegadas[s.titulo] ?? Boolean(s.plegada);
  };

  const alternar = (s) => {
    const nuevo = { ...plegadas, [s.titulo]: !estaPlegada(s) };
    setPlegadas(nuevo);
    try {
      localStorage.setItem(LLAVE_PLEGADAS, JSON.stringify(nuevo));
    } catch {
      // Sin almacenamiento solo no se recuerda
    }
  };

  const renderNavItem = (item, Icon, texto) => (
    <NavLink
      key={item.id}
      to={item.ruta || "/inicio"}
      className={({ isActive }) => `
        flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200
        ${isActive ? "bg-primary text-white shadow-md" : "text-gray-600 hover:bg-gray-100"}
        ${collapsed ? "justify-center" : ""}
      `}
      title={collapsed ? texto : ""}
    >
      <Icon className="w-5 h-5 flex-shrink-0" />
      {!collapsed && <span className="text-sm font-medium">{texto}</span>}
    </NavLink>
  );

  const renderSection = (s) => {
    const plegada = !collapsed && estaPlegada(s);
    return (
      <div key={s.titulo} className="mb-4">
        {!collapsed && (
          <button
            onClick={() => alternar(s)}
            className="w-full flex items-center justify-between px-3 mb-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wider hover:text-gray-600"
          >
            {s.titulo}
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${plegada ? "-rotate-90" : ""}`} />
          </button>
        )}
        {!plegada && (
          <nav className="space-y-1">
            {s.items.map((m) =>
              renderNavItem(m, iconMap[m.nombre] || LayoutDashboard, ETIQUETAS[m.nombre] || m.nombre),
            )}
          </nav>
        )}
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
              <h1 className="font-bold text-gray-900 text-sm">Sistema Central</h1>
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
        {collapsed ? <ChevronRight className="w-4 h-4 text-gray-600" /> : <ChevronLeft className="w-4 h-4 text-gray-600" />}
      </button>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-10 bg-gray-100 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : (
          <>
            <div className="mb-5 space-y-1">
              {FIJAS.filter((f) => !f.soloConCargas || tieneCargas).map((f) => renderNavItem(f, f.icono, f.nombre))}
            </div>
            {secciones.map(renderSection)}
          </>
        )}
      </div>

      {/* User & Logout */}
      <div className="p-4 border-t border-gray-200">
        {!collapsed && (
          <div className="mb-3 px-3">
            <p className="text-sm font-medium text-gray-900 truncate">{user?.nombreCompleto}</p>
            <p className="text-xs text-gray-500">{user?.rol?.nombre}</p>
          </div>
        )}
        <NavLink
          to="/mi-firma"
          className={({ isActive }) =>
            `w-full flex items-center gap-3 px-3 py-2 mb-1 rounded-lg transition-colors ${collapsed ? "justify-center" : ""} ${
              isActive ? "bg-[#236093]/10 text-[#236093]" : "text-gray-600 hover:bg-gray-100"
            }`
          }
          title={collapsed ? "Mi firma" : ""}
        >
          <PenLine className="w-5 h-5" />
          {!collapsed && <span className="text-sm font-medium">Mi firma</span>}
        </NavLink>
        <button
          onClick={handleLogout}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-red-600 hover:bg-red-50 transition-colors ${collapsed ? "justify-center" : ""}`}
          title={collapsed ? "Cerrar sesión" : ""}
        >
          <LogOut className="w-5 h-5" />
          {!collapsed && <span className="text-sm font-medium">Cerrar sesión</span>}
        </button>
      </div>
    </aside>
  );
}
