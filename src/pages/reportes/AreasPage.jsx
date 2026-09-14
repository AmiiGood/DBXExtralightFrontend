import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { LayoutGrid, ChevronRight, Construction } from "lucide-react";
import api from "../../services/api";
import { useAuthStore } from "../../stores/auth.store";
import { AREAS, reportesVisibles } from "../../config/areas";

/**
 * Menú de reportes por área.
 *
 * Primer nivel: se elige el área. Las que todavía no tienen reportes se
 * muestran igual, marcadas como pendientes, para que el menú refleje el
 * alcance completo del proyecto y no solo lo ya construido.
 */
export default function AreasPage() {
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

  const conReportes = AREAS.filter(
    (a) => reportesVisibles(a, modulos, esAdmin).length > 0,
  );
  const pendientes = AREAS.filter(
    (a) => reportesVisibles(a, modulos, esAdmin).length === 0,
  );

  const Tarjeta = ({ area, disponible }) => {
    const n = reportesVisibles(area, modulos, esAdmin).length;
    const Icono = area.icono;
    const contenido = (
      <>
        <div className="flex items-start justify-between">
          <div
            className={`w-12 h-12 rounded-xl flex items-center justify-center ${
              disponible ? "bg-primary/10" : "bg-gray-100"
            }`}
          >
            <Icono
              className={`w-6 h-6 ${disponible ? "text-primary" : "text-gray-300"}`}
            />
          </div>
          {disponible ? (
            <ChevronRight className="w-5 h-5 text-gray-300" />
          ) : (
            <span className="text-[10px] font-medium text-gray-400 bg-gray-100 px-2 py-1 rounded-full">
              Por definir
            </span>
          )}
        </div>
        <h3
          className={`mt-4 font-semibold ${disponible ? "text-gray-900" : "text-gray-400"}`}
        >
          {area.nombre}
        </h3>
        {disponible && (
          <p className="text-xs text-primary font-medium mt-1">
            {n} {n === 1 ? "reporte" : "reportes"}
          </p>
        )}
      </>
    );

    const clases =
      "bg-white rounded-xl border p-5 transition-all " +
      (disponible
        ? "border-gray-100 shadow-sm hover:shadow-md hover:border-primary/30"
        : "border-dashed border-gray-200");

    return disponible ? (
      <Link to={`/reportes/${area.id}`} className={`block ${clases}`}>
        {contenido}
      </Link>
    ) : (
      <div className={clases}>{contenido}</div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center">
          <LayoutGrid className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reportes</h1>
          <p className="text-sm text-gray-500">Elige el área para ver sus reportes</p>
        </div>
      </div>

      {cargando ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-40 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          {conReportes.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {conReportes.map((a) => (
                <Tarjeta key={a.id} area={a} disponible />
              ))}
            </div>
          )}

          {pendientes.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Construction className="w-4 h-4 text-gray-400" />
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
                  Áreas por definir
                </h2>
              </div>
              <p className="text-xs text-gray-400 mb-4">
                Ya están dentro del alcance, falta acordar qué reporte necesita
                cada una
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {pendientes.map((a) => (
                  <Tarjeta key={a.id} area={a} disponible={false} />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
