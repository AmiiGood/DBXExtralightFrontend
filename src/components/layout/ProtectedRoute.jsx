import { Navigate, useLocation } from "react-router-dom";
import { useAuthStore } from "../../stores/auth.store";

export default function ProtectedRoute({ children, allowedRoles = [] }) {
  const { isAuthenticated, user } = useAuthStore();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles.length > 0 && !allowedRoles.includes(user?.rol?.nombre)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return children;
}
