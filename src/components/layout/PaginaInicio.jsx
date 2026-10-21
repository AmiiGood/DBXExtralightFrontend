import { useState, useEffect } from "react";
import { Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import api from "../../services/api";
import { useAuthStore } from "../../stores/auth.store";
import { rutaDeInicio } from "../../config/areas";

/**
 * Manda a cada usuario a la página que le toca al entrar. La regla está en
 * `rutaDeInicio` (config/areas.js).
 */
export default function PaginaInicio() {
  const usuario = useAuthStore((s) => s.user);
  const esAdmin = Boolean(usuario?.rol?.esAdmin);
  const [destino, setDestino] = useState(esAdmin ? "/dashboard" : null);

  useEffect(() => {
    if (esAdmin) return;
    api
      .get("/auth/modulos")
      .then((r) => setDestino(rutaDeInicio(usuario, r.data?.data?.modulos || [])))
      // Sin módulos no hay a dónde mandarlo mejor que el índice de reportes,
      // que avisa si no tiene ninguno.
      .catch(() => setDestino("/reportes"));
  }, [esAdmin, usuario]);

  if (!destino) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }
  return <Navigate to={destino} replace />;
}
