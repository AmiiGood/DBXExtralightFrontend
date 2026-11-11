import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Loader2, Upload, RefreshCw, ChevronRight, LayoutGrid } from "lucide-react";
import api from "../../services/api";
import { cargasVisibles } from "../../config/cargas";
import { buscarArea } from "../../config/areas";

/**
 * Cargas de datos: todas las pantallas que alimentan los reportes en un solo
 * lugar (antes eran 10 entradas sueltas del menú lateral).
 *
 * Dos tipos: las que se suben a mano (Excel) y los archivos que el sistema lee
 * solo de una carpeta de red o de SharePoint; en esas la pantalla es para
 * configurar de dónde lee y ver cómo va.
 */
const TIPO = {
  manual: { texto: "Se sube a mano", icono: Upload, clase: "text-[#236093] bg-[#236093]/10" },
  automatica: { texto: "Se lee solo", icono: RefreshCw, clase: "text-green-700 bg-green-50" },
};

export default function CargasPage() {
  const [modulos, setModulos] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let vivo = true;
    api
      .get("/auth/modulos")
      .then((r) => vivo && setModulos(r.data.data.modulos || []))
      .catch((e) => vivo && setError(e.response?.data?.message || e.message));
    return () => {
      vivo = false;
    };
  }, []);

  const grupos = modulos ? cargasVisibles(modulos) : [];

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-[#236093]/10 rounded-lg">
          <Upload className="w-6 h-6 text-[#236093]" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Cargas de datos</h1>
          <p className="text-sm text-gray-500">
            Lo que alimenta los reportes: los Excel que se suben a mano y los archivos que el sistema lee solo
          </p>
        </div>
      </div>

      {error && <div className="text-sm text-red-700 bg-red-50 rounded-xl px-4 py-3">{error}</div>}

      {!modulos ? (
        !error && (
          <div className="flex justify-center py-16">
            <Loader2 className="w-7 h-7 animate-spin text-gray-300" />
          </div>
        )
      ) : grupos.length === 0 ? (
        <p className="text-sm text-gray-500 bg-white border border-gray-200 rounded-xl px-5 py-8 text-center">
          No tienes cargas de datos asignadas.
        </p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {grupos.map((g) => {
            const Icono = buscarArea(g.area)?.icono || LayoutGrid;
            return (
              <section key={g.area} className="bg-white border border-gray-200 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Icono className="w-4 h-4 text-gray-400" />
                  <h2 className="text-sm font-semibold text-gray-800">{g.nombre}</h2>
                </div>
                <ul className="divide-y divide-gray-100">
                  {g.items.map((i) => {
                    const t = TIPO[i.tipo];
                    const IconoTipo = t.icono;
                    return (
                      <li key={i.modulo}>
                        <Link to={i.ruta} className="flex items-start gap-3 py-2.5 group">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 group-hover:text-[#236093]">{i.modulo}</p>
                            {i.descripcion && <p className="text-xs text-gray-500">{i.descripcion}</p>}
                            <span className={`mt-1 inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded ${t.clase}`}>
                              <IconoTipo className="w-3 h-3" />
                              {t.texto}
                            </span>
                          </div>
                          <ChevronRight className="w-4 h-4 mt-1 text-gray-300 group-hover:text-[#236093]" />
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
