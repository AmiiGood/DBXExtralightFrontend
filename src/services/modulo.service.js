import api from "./api";

export const moduloService = {
  getModulosUsuario: async () => {
    const response = await api.get("/auth/modulos");
    return response.data;
  },
};
