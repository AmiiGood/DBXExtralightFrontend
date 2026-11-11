import { Navigate } from "react-router-dom";

/**
 * La raíz del sistema manda a todos a Inicio, que ya se arma según lo que cada
 * usuario puede abrir (sus pendientes, sus reportes y, para el administrador,
 * el estado de las sincronizaciones). Antes el administrador caía en el
 * tablero de Calidad.
 */
export default function PaginaInicio() {
  return <Navigate to="/inicio" replace />;
}
