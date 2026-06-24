import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { User, Lock, Eye, EyeOff } from "lucide-react";
import { useAuthStore } from "../../stores/auth.store";
import Input from "../../components/ui/Input";
import Button from "../../components/ui/Button";

export default function LoginPage() {
  const navigate = useNavigate();
  const { login, isLoading, error, clearError } = useAuthStore();

  const [formData, setFormData] = useState({
    nombreUsuario: "",
    password: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: "" }));
    }
    if (error) clearError();
  };

  const validate = () => {
    const newErrors = {};
    if (!formData.nombreUsuario.trim()) {
      newErrors.nombreUsuario = "El nombre de usuario es requerido";
    }
    if (!formData.password) {
      newErrors.password = "La contraseña es requerida";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    const result = await login(formData.nombreUsuario, formData.password);
    if (result.success) {
      navigate("/dashboard");
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Lado izquierdo - Imagen */}
      <div className="hidden lg:flex lg:w-1/2 relative">
        <div className="absolute inset-0 bg-gradient-to-br from-primary via-secondary to-accent opacity-90" />
        <div
          className="absolute inset-0 bg-cover bg-center mix-blend-overlay"
          style={{
            backgroundImage: `url('https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=1920&q=80')`,
          }}
        />
        <div className="relative z-10 flex flex-col justify-center items-center w-full p-12 text-white">
          <h1 className="text-4xl font-bold mb-4 text-center">
            Sistema Central
          </h1>
          <p className="text-xl text-center text-white/80">
            Plataforma de gestión empresarial
          </p>
        </div>
      </div>

      {/* Lado derecho - Formulario */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center items-center p-8 bg-white">
        <div className="w-full max-w-md">
          {/* Logo */}
          <div className="flex flex-col items-center mb-10">
            <img
              src="/logo.png"
              alt="Logo"
              className="h-24 w-auto mb-6"
              onError={(e) => {
                e.target.style.display = "none";
                e.target.nextSibling.style.display = "flex";
              }}
            />
            <div className="hidden items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-primary to-secondary mb-6">
              <span className="text-3xl font-bold text-white">FC</span>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 text-center">
              Bienvenido
            </h2>
            <p className="text-gray-500 mt-1 text-center">
              Ingresa tus credenciales para continuar
            </p>
          </div>

          {/* Error general */}
          {error && (
            <div className="mb-6 p-4 rounded-lg bg-red-50 border border-red-200">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {/* Formulario */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <Input
              label="Nombre de usuario"
              name="nombreUsuario"
              placeholder="Ingresa tu usuario"
              icon={User}
              value={formData.nombreUsuario}
              onChange={handleChange}
              error={errors.nombreUsuario}
              autoComplete="username"
            />

            <div className="relative">
              <Input
                label="Contraseña"
                name="password"
                type={showPassword ? "text" : "password"}
                placeholder="Ingresa tu contraseña"
                icon={Lock}
                value={formData.password}
                onChange={handleChange}
                error={errors.password}
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-9 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? (
                  <EyeOff className="w-5 h-5" />
                ) : (
                  <Eye className="w-5 h-5" />
                )}
              </button>
            </div>

            <Button
              type="submit"
              className="w-full"
              size="lg"
              isLoading={isLoading}
            >
              Iniciar sesión
            </Button>
          </form>

          {/* Footer */}
          <p className="mt-8 text-center text-sm text-gray-400">
            © {new Date().getFullYear()} Sistema Central. Todos los derechos
            reservados.
          </p>
        </div>
      </div>
    </div>
  );
}
