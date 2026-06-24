import { create } from "zustand";
import { authService } from "../services/auth.service";

export const useAuthStore = create((set) => ({
  user: authService.getCurrentUser(),
  token: authService.getToken(),
  isAuthenticated: authService.isAuthenticated(),
  isLoading: false,
  error: null,

  login: async (nombreUsuario, password) => {
    set({ isLoading: true, error: null });
    try {
      const response = await authService.login(nombreUsuario, password);
      const { token, usuario } = response.data;

      localStorage.setItem("token", token);
      localStorage.setItem("user", JSON.stringify(usuario));

      set({
        user: usuario,
        token,
        isAuthenticated: true,
        isLoading: false,
      });

      return { success: true };
    } catch (error) {
      const message =
        error.response?.data?.message || "Error al iniciar sesión";
      set({ error: message, isLoading: false });
      return { success: false, error: message };
    }
  },

  logout: () => {
    authService.logout();
    set({
      user: null,
      token: null,
      isAuthenticated: false,
      error: null,
    });
  },

  clearError: () => set({ error: null }),
}));
