import { useState, useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import Sidebar from "./Sidebar";
import Header from "./Header";
import api from "../../services/api";

const pageTitles = {
  "/dashboard": "Dashboard",
  "/admin/usuarios": "Gestión de Usuarios",
  "/admin/logs": "Logs del Sistema",
  "/admin/catalogos": "Catálogos",
  "/calidad/defectos": "Registro de Defectos",
  "/calidad/reportes": "Reportes de Calidad",
  "/calidad/qr-validation": "Validación QR",
  "/reportes": "Reportes",
  "/produccion/reportes": "Reportes de Producción",
  "/produccion/carga-produccion": "Carga de Producción",
  "/admin/envio-reportes": "Envío de Reportes",
};

export default function MainLayout() {
  const [modulos, setModulos] = useState([]);
  const [loadingModulos, setLoadingModulos] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const location = useLocation();

  const pageTitle = pageTitles[location.pathname] || "Sistema Central";

  useEffect(() => {
    const fetchModulos = async () => {
      try {
        const response = await api.get("/auth/modulos");
        if (response.data.status === "success") {
          setModulos(response.data.data.modulos);
        }
      } catch (error) {
        console.error("Error fetching modulos:", error);
      } finally {
        setLoadingModulos(false);
      }
    };

    fetchModulos();
  }, []);

  const handleSidebarToggle = (collapsed) => {
    setSidebarCollapsed(collapsed);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar
        modulos={modulos}
        loading={loadingModulos}
        onToggle={handleSidebarToggle}
      />

      <div
        className={`transition-all duration-300 ${
          sidebarCollapsed ? "ml-20" : "ml-64"
        }`}
      >
        <Header title={pageTitle} />

        <main className="p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
