import { useAuthStore } from "../../stores/auth.store";

export default function Header({ title }) {
  const { user } = useAuthStore();

  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6">
      {/* Left side - Page title */}
      <div>
        <h1 className="text-xl font-semibold text-gray-900">{title}</h1>
      </div>

      {/* Right side - User info */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
          <span className="text-white text-sm font-medium">
            {user?.nombreCompleto?.charAt(0) || "U"}
          </span>
        </div>
        <div className="hidden md:block">
          <p className="text-sm font-medium text-gray-900">
            {user?.nombreCompleto}
          </p>
          <p className="text-xs text-gray-500">{user?.area?.nombre}</p>
        </div>
      </div>
    </header>
  );
}
