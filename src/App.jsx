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
import UsuariosPage from "./pages/admin/UsuariosPage";
import LogsPage from "./pages/admin/LogsPage";
import CatalogosPage from "./pages/admin/CatalogosPage";

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

      {/* Rutas protegidas con layout */}
      <Route
        element={
          <ProtectedRoute>
            <MainLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/dashboard" element={<DashboardPage />} />

        {/* Calidad */}
        <Route path="/calidad/defectos" element={<DefectosPage />} />
        <Route path="/calidad/reportes" element={<ReportesPage />} />
        <Route path="/calidad/qr-validation" element={<QrValidationPage />} />
        <Route path="/calidad/recepcion-cajas" element={<RecepcionCajasPage />} />

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
