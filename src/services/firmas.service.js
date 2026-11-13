import api from "./api";

/**
 * Firmas: cada usuario registra la suya una vez (dibujada) y firma con su PIN.
 */
export const firmasService = {
  /** { registrada, imagen, creada_en, bloqueada_hasta, esAdmin } */
  mia: async () => {
    const { data } = await api.get("/firmas/mia");
    return data.data;
  },

  /** Registrar o cambiar la firma; pide la contraseña del DBX. */
  registrar: async ({ imagen, pin, password }) => {
    const { data } = await api.post("/firmas/mia", { imagen, pin, password });
    return data;
  },

  /** Revisar el PIN sin firmar nada. */
  probar: async (pin) => {
    const { data } = await api.post("/firmas/probar", { pin });
    return data;
  },

  /** Admin: quién tiene firma registrada. */
  todas: async () => {
    const { data } = await api.get("/firmas");
    return data.data;
  },

  /** Admin: quitar la firma de alguien. */
  quitar: async (usuarioId) => {
    const { data } = await api.delete(`/firmas/usuario/${usuarioId}`);
    return data;
  },
};
