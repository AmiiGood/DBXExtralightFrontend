import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuthStore } from "../../stores/auth.store";
import {
  ClipboardList,
  AlertTriangle,
  CheckCircle,
  TrendingUp,
  Plus,
  QrCode,
  Package,
  XCircle,
} from "lucide-react";
import api from "../../services/api";

const formatTurno = (turno) => {
  if (!turno) return "";
  return turno.replace(/^Turno\s*/i, "");
};

const StatCard = ({ title, value, icon: Icon, color, subtitle, loading }) => (
  <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-gray-500">{title}</p>
        {loading ? (
          <div className="h-8 w-20 bg-gray-200 rounded animate-pulse mt-1" />
        ) : (
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
        )}
        {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
      </div>
      <div
        className={`w-12 h-12 rounded-xl flex items-center justify-center ${color}`}
      >
        <Icon className="w-6 h-6 text-white" />
      </div>
    </div>
  </div>
);

export default function DashboardPage() {
  const { user } = useAuthStore();
  const isQrRole = user?.rol?.nombre === "Validación QR";

  // Si es rol QR exclusivo, mostrar dashboard QR
  if (isQrRole) {
    return <QrDashboard user={user} />;
  }

  // Dashboard normal para otros roles
  return <DefaultDashboard user={user} />;
}

// ============================================
// Dashboard QR (para rol "Validación QR")
// ============================================
function QrDashboard({ user }) {
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchQrDashboard();
  }, []);

  const fetchQrDashboard = async () => {
    setLoading(true);
    try {
      const response = await api.get("/qr/dashboard");
      if (response.data.status === "success") {
        setDashboard(response.data.data);
      }
    } catch (error) {
      console.error("Error fetching QR dashboard:", error);
    } finally {
      setLoading(false);
    }
  };

  const escaneosHoy = dashboard?.escanosHoy || {};

  return (
    <div className="space-y-6">
      {/* Welcome banner */}
      <div className="bg-gradient-to-r from-primary to-secondary rounded-2xl p-6 text-white">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold">
              ¡Bienvenido, {user?.nombreCompleto?.split(" ")[0]}!
            </h2>
            <p className="text-white/80 mt-1">
              {new Date().toLocaleDateString("es-MX", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </p>
            <p className="text-white/90 mt-2 text-sm">
              Módulo de Validación QR
            </p>
          </div>
          <Link
            to="/calidad/qr-validation"
            className="inline-flex items-center gap-2 bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-lg transition-colors"
          >
            <QrCode className="w-5 h-5" />
            <span>Escanear QR</span>
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Escaneos Hoy"
          value={escaneosHoy.totalEscaneos || 0}
          icon={QrCode}
          color="bg-primary"
          loading={loading}
        />
        <StatCard
          title="Encontrados Hoy"
          value={escaneosHoy.encontrados || 0}
          icon={CheckCircle}
          color="bg-green-500"
          loading={loading}
        />
        <StatCard
          title="No Encontrados Hoy"
          value={escaneosHoy.noEncontrados || 0}
          icon={XCircle}
          color="bg-red-500"
          loading={loading}
        />
        <StatCard
          title="Total Mapeos QR"
          value={(dashboard?.totalMapeos || 0).toLocaleString()}
          icon={Package}
          color="bg-secondary"
          loading={loading}
        />
      </div>

      {/* Acciones rápidas */}
      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Acciones Rápidas
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Link
            to="/calidad/qr-validation"
            className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors border border-gray-100"
          >
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <QrCode className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="font-medium text-gray-900">Escanear QR</p>
              <p className="text-sm text-gray-500">
                Validar un código QR de producto
              </p>
            </div>
          </Link>
          <Link
            to="/calidad/qr-validation"
            onClick={() =>
              setTimeout(() => {
                /* el tab de historial se selecciona manualmente */
              }, 100)
            }
            className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors border border-gray-100"
          >
            <div className="w-10 h-10 rounded-lg bg-secondary/10 flex items-center justify-center">
              <ClipboardList className="w-5 h-5 text-secondary" />
            </div>
            <div>
              <p className="font-medium text-gray-900">Ver Historial</p>
              <p className="text-sm text-gray-500">
                Consultar escaneos realizados
              </p>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}

// ============================================
// Dashboard Default (para Admin, Calidad, etc.)
// ============================================
function DefaultDashboard({ user }) {
  const [stats, setStats] = useState({
    registrosHoy: 0,
    paresHoy: 0,
    topDefectoHoy: null,
    turnoActual: null,
  });
  const [topDefectos, setTopDefectos] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const today = new Date().toISOString().split("T")[0];
      const fechaInicio = `${today}T00:00:00`;
      const fechaFin = `${today}T23:59:59`;

      const [registrosRes, topRes, catalogosRes] = await Promise.all([
        api.get(
          `/defectos?fechaInicio=${fechaInicio}&fechaFin=${fechaFin}&limit=100`,
        ),
        api.get(
          `/defectos/top-defectos?limit=5&fechaInicio=${fechaInicio}&fechaFin=${fechaFin}`,
        ),
        api.get("/defectos/catalogos"),
      ]);

      if (registrosRes.data.status === "success") {
        const registros = registrosRes.data.data.registros || [];
        const totalPares = registros.reduce(
          (sum, r) => sum + (r.pares_rechazados || 0),
          0,
        );
        setStats((prev) => ({
          ...prev,
          registrosHoy: registros.length,
          paresHoy: totalPares,
        }));
      }

      if (topRes.data.status === "success") {
        const top = topRes.data.data.topDefectos || [];
        setTopDefectos(top);
        if (top.length > 0) {
          setStats((prev) => ({ ...prev, topDefectoHoy: top[0].defecto }));
        }
      }

      if (catalogosRes.data.status === "success") {
        setStats((prev) => ({
          ...prev,
          turnoActual: catalogosRes.data.data.turnoActual,
        }));
      }
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Welcome banner */}
      <div className="bg-gradient-to-r from-primary to-secondary rounded-2xl p-6 text-white">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold">
              ¡Bienvenido, {user?.nombreCompleto?.split(" ")[0]}!
            </h2>
            <p className="text-white/80 mt-1">
              {new Date().toLocaleDateString("es-MX", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </p>
            {stats.turnoActual && (
              <p className="text-white/90 mt-2 text-sm">
                Turno actual:{" "}
                <span className="font-semibold">
                  {formatTurno(stats.turnoActual.nombre)}
                </span>
              </p>
            )}
          </div>
          <Link
            to="/calidad/defectos"
            className="inline-flex items-center gap-2 bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-lg transition-colors"
          >
            <Plus className="w-5 h-5" />
            <span>Nuevo Registro</span>
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Registros Hoy"
          value={stats.registrosHoy}
          icon={ClipboardList}
          color="bg-primary"
          loading={loading}
        />
        <StatCard
          title="Pares Rechazados Hoy"
          value={stats.paresHoy.toLocaleString()}
          icon={AlertTriangle}
          color="bg-red-500"
          loading={loading}
        />
        <StatCard
          title="Defecto más frecuente"
          value={stats.topDefectoHoy || "Sin datos"}
          icon={TrendingUp}
          color="bg-secondary"
          loading={loading}
        />
        <StatCard
          title="Tu Área"
          value={user?.area?.nombre || "-"}
          icon={CheckCircle}
          color="bg-accent"
          subtitle={user?.rol?.nombre}
          loading={false}
        />
      </div>

      {/* Content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Defectos del día */}
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Top Defectos del Día
          </h3>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-10 bg-gray-100 rounded animate-pulse"
                />
              ))}
            </div>
          ) : topDefectos.length === 0 ? (
            <p className="text-gray-500 text-sm">No hay registros para hoy</p>
          ) : (
            <div className="space-y-3">
              {topDefectos.map((defecto, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-medium flex items-center justify-center">
                      {index + 1}
                    </span>
                    <span className="text-sm text-gray-900">
                      {defecto.defecto}
                    </span>
                  </div>
                  <span className="text-sm font-medium text-gray-500">
                    {parseInt(defecto.total_pares_rechazados).toLocaleString()}{" "}
                    pares
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Acciones rápidas */}
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Acciones Rápidas
          </h3>
          <div className="space-y-3">
            <Link
              to="/calidad/defectos"
              className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors border border-gray-100"
            >
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <ClipboardList className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="font-medium text-gray-900">Registrar Defecto</p>
                <p className="text-sm text-gray-500">
                  Crear un nuevo registro de defecto
                </p>
              </div>
            </Link>
            <Link
              to="/calidad/reportes"
              className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors border border-gray-100"
            >
              <div className="w-10 h-10 rounded-lg bg-secondary/10 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-secondary" />
              </div>
              <div>
                <p className="font-medium text-gray-900">Ver Reportes</p>
                <p className="text-sm text-gray-500">
                  Consultar estadísticas y exportar
                </p>
              </div>
            </Link>
            {user?.rol?.esAdmin && (
              <Link
                to="/admin/usuarios"
                className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors border border-gray-100"
              >
                <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
                  <CheckCircle className="w-5 h-5 text-accent" />
                </div>
                <div>
                  <p className="font-medium text-gray-900">
                    Gestionar Usuarios
                  </p>
                  <p className="text-sm text-gray-500">
                    Administrar usuarios del sistema
                  </p>
                </div>
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
