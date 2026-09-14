import { useState, useEffect } from "react";
import { Link, useParams, Navigate } from "react-router-dom";
import { ArrowLeft, ChevronRight, ExternalLink, Construction } from "lucide-react";
import api from "../../services/api";
import { useAuthStore } from "../../stores/auth.store";
import { buscarArea, reportesVisibles } from "../../config/areas";

/**
 * Reportes de un área.
 *
 * Segundo nivel del menú: se llega desde /reportes y aquí se elige el reporte.
 */
export default function AreaDetallePage() {
  const { areaId } = useParams();
  const area = buscarArea(areaId);
  const [modulos, setModulos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const usuario = useAuthStore((s) => s.user);
  const esAdmin = Boolean(usuario?.rol?.esAdmin);

  useEffect(() => {
    api
      .get("/auth/modulos")
      .then((r) => setModulos(r.data?.data?.modulos || []))
      .catch(() => setModulos([]))
      .finally(() => setCargando(false));
  }, []);

  // Un área inventada en la URL regresa al menú, no a una pantalla en blanco
  if (!area) return <Navigate to="/reportes" replace />;

  const reportes = reportesVisibles(area, modulos, esAdmin);
  const Icono = area.icono;

  return (
    <div className="space-y-6">
      <div>
        <Link
          to="/reportes"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-primary mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Todas las áreas
        </Link>
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center">
            <Icono className="w-6 h-6 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">{area.nombre}</h1>
        </div>
      </div>

      {cargando ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : reportes.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-gray-200 p-12 text-center">
          <Construction className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">
            Todavía no hay reportes para esta área
          </p>
          <p className="text-sm text-gray-400 mt-1 max-w-md mx-auto">
            Está dentro del alcance del proyecto; falta acordar qué información
            necesita y de dónde sale.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {reportes.map((r) => {
            const contenido = (
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-semibold text-gray-900 flex items-center gap-2">
                    {r.nombre}
                    {r.nuevaPestana && (
                      <ExternalLink className="w-3.5 h-3.5 text-gray-300" />
                    )}
                  </p>
                  <p className="text-sm text-gray-400 mt-0.5">{r.descripcion}</p>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-300 flex-shrink-0" />
              </div>
            );

            const clases =
              "block bg-white rounded-xl border border-gray-100 shadow-sm p-5 " +
              "hover:shadow-md hover:border-primary/30 transition-all";

            // El modo TV abre en otra pestaña: se proyecta y se deja fijo
            return r.nuevaPestana ? (
              <a
                key={r.nombre}
                href={r.ruta}
                target="_blank"
                rel="noreferrer"
                className={clases}
              >
                {contenido}
              </a>
            ) : (
              <Link key={r.nombre} to={r.ruta} className={clases}>
                {contenido}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
