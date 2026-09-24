import { Routes, Route, Navigate } from "react-router-dom";
import { useAuthStore } from "./stores/auth.store";
import ProtectedRoute from "./components/layout/ProtectedRoute";
import MainLayout from "./components/layout/MainLayout";
import LoginPage from "./pages/auth/LoginPage";
import DashboardPage from "./pages/dashboard/DashboardPage";
import DefectosPage from "./pages/calidad/DefectosPage";
import ReportesPage from "./pages/calidad/ReportesPage";
import QrValidationPage from "./pages/calidad/QrValidationPage";
import RecepcionCajasPage from "./pages/calidad/RecepcionCajasPage";
import CargaArticulosPage from "./pages/produccion/CargaArticulosPage";
import ReportesInyeccionPage from "./pages/produccion/ReportesInyeccionPage";
import ReportesMoldesPage from "./pages/moldes/ReportesMoldesPage";
import TvMoldesPage from "./pages/moldes/TvMoldesPage";
import ReportesCompoundPage from "./pages/compound/ReportesCompoundPage";
import CargaCompuestosPage from "./pages/compound/CargaCompuestosPage";
import TvCompuestosPage from "./pages/compound/TvCompuestosPage";
import ReportesStaffPage from "./pages/staff/ReportesStaffPage";
import CargaStaffPage from "./pages/staff/CargaStaffPage";
import ReportesResultadosPage from "./pages/resultados/ReportesResultadosPage";
import CargaResultadosPage from "./pages/resultados/CargaResultadosPage";
import CapturaInyeccionPage from "./pages/produccion/CapturaInyeccionPage";
import CargaProduccionPage from "./pages/produccion/CargaProduccionPage";
import TvInyeccionPage from "./pages/produccion/TvInyeccionPage";
import UsuariosPage from "./pages/admin/UsuariosPage";
import LogsPage from "./pages/admin/LogsPage";
import CatalogosPage from "./pages/admin/CatalogosPage";
import EnvioReportesPage from "./pages/admin/EnvioReportesPage";
import AreasPage from "./pages/reportes/AreasPage";
import AreaDetallePage from "./pages/reportes/AreaDetallePage";

function App() {
  const { isAuthenticated } = useAuthStore();

  return (
    <Routes>
      {/* Rutas públicas */}
      <Route
        path="/login"
        element={
          isAuthenticated ? <Navigate to="/dashboard" replace /> : <LoginPage />
        }
      />

      {/* Modo TV: protegido, pero SIN el layout (nada de menú ni encabezado,
          la pantalla es para colgarse en piso y no se navega) */}
      <Route
        path="/produccion/tv"
        element={
          <ProtectedRoute>
            <TvInyeccionPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/moldes/tv"
        element={
          <ProtectedRoute>
            <TvMoldesPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/compound/tv"
        element={
          <ProtectedRoute>
            <TvCompuestosPage />
          </ProtectedRoute>
        }
      />

      {/* Rutas protegidas con layout */}
      <Route
        element={
          <ProtectedRoute>
            <MainLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/dashboard" element={<DashboardPage />} />

        {/* Menú de reportes: primero el área, luego el reporte */}
        <Route path="/reportes" element={<AreasPage />} />
        <Route path="/reportes/:areaId" element={<AreaDetallePage />} />

        {/* Calidad */}
        <Route path="/calidad/defectos" element={<DefectosPage />} />
        <Route path="/calidad/reportes" element={<ReportesPage />} />
        <Route path="/calidad/qr-validation" element={<QrValidationPage />} />
        <Route path="/calidad/recepcion-cajas" element={<RecepcionCajasPage />} />

        {/* Producción */}
        <Route
          path="/produccion/carga-articulos"
          element={<CargaArticulosPage />}
        />
        <Route
          path="/produccion/reportes"
          element={<ReportesInyeccionPage />}
        />
        <Route
          path="/produccion/carga-produccion"
          element={<CargaProduccionPage />}
        />
        {/* El formulario de captura queda accesible por URL pero fuera del
            menú: por ahora la información entra por el Excel. */}
        <Route
          path="/produccion/inyeccion"
          element={<CapturaInyeccionPage />}
        />

        {/* Moldes */}
        <Route path="/moldes/reportes" element={<ReportesMoldesPage />} />

        {/* Compuestos */}
        <Route path="/compound/reportes" element={<ReportesCompoundPage />} />
        <Route path="/compound/carga" element={<CargaCompuestosPage />} />

        {/* STAFF */}
        <Route path="/staff/reportes" element={<ReportesStaffPage />} />
        <Route path="/staff/carga" element={<CargaStaffPage />} />

        {/* Resultados */}
        <Route path="/resultados/reportes" element={<ReportesResultadosPage />} />
        <Route path="/resultados/carga" element={<CargaResultadosPage />} />

        {/* Admin */}
        <Route
          path="/admin/usuarios"
          element={
            <ProtectedRoute allowedRoles={["Administrador"]}>
              <UsuariosPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/logs"
          element={
            <ProtectedRoute allowedRoles={["Administrador"]}>
              <LogsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/envio-reportes"
          element={
            <ProtectedRoute allowedRoles={["Administrador"]}>
              <EnvioReportesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/catalogos"
          element={
            <ProtectedRoute allowedRoles={["Administrador"]}>
              <CatalogosPage />
            </ProtectedRoute>
          }
        />
      </Route>

      {/* Página no autorizado */}
      <Route
        path="/unauthorized"
        element={
          <div className="min-h-screen flex items-center justify-center bg-gray-50">
            <div className="text-center">
              <h1 className="text-4xl font-bold text-gray-900 mb-2">403</h1>
              <p className="text-gray-500 mb-4">
                No tienes permisos para acceder a esta página
              </p>
              <a href="/dashboard" className="text-primary hover:underline">
                Volver al inicio
              </a>
            </div>
          </div>
        }
      />

      {/* Redirección por defecto */}
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export default App;
