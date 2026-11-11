import { useState, useEffect } from "react";
import api from "../services/api";

/**
 * Adornos de temporada: un saludo y una tira decorativa en Inicio y en la
 * pantalla de inicio de sesión. Solo ahí: captura, reportes y modo TV no se
 * tocan.
 *
 * Las fechas son por calendario (día y mes, inclusivas) y se repiten cada año.
 * El administrador puede apagarlos para todos (tabla sistema_config).
 *
 * Para verlos fuera de fecha: agregar ?temporada=navidad (o anio-nuevo,
 * patrias, muertos) a la dirección de Inicio o del inicio de sesión.
 */
export const TEMPORADAS = [
  { id: "muertos", desde: [10, 28], hasta: [11, 2], saludo: "Feliz Día de Muertos" },
  { id: "navidad", desde: [12, 1], hasta: [12, 24], saludo: "¡Felices fiestas!" },
  { id: "anio-nuevo", desde: [12, 25], hasta: [1, 6], saludo: "¡Feliz año nuevo!" },
  { id: "patrias", desde: [9, 1], hasta: [9, 16], saludo: "¡Viva México!" },
];

const clave = (mes, dia) => mes * 100 + dia;

/** La temporada de una fecha (o la que pide ?temporada= en la dirección). */
export function temporadaActual(fecha = new Date()) {
  try {
    const forzada = new URLSearchParams(window.location.search).get("temporada");
    if (forzada) return TEMPORADAS.find((t) => t.id === forzada) || null;
  } catch {
    // Sin window (pruebas): se sigue con la fecha
  }
  const hoy = clave(fecha.getMonth() + 1, fecha.getDate());
  return (
    TEMPORADAS.find((t) => {
      const a = clave(...t.desde);
      const b = clave(...t.hasta);
      // Año nuevo cruza el cambio de año (25 dic → 6 ene)
      return a <= b ? hoy >= a && hoy <= b : hoy >= a || hoy <= b;
    }) || null
  );
}

let cache = null;

/**
 * La temporada que toca mostrar, o null si no hay o el admin las apagó.
 * Devuelve también `activos` y `cambiar(activos)` para el interruptor.
 */
export function useTemporada() {
  const temporada = temporadaActual();
  const [activos, setActivos] = useState(cache);

  useEffect(() => {
    if (!temporada || cache !== null) return;
    let vivo = true;
    api
      .get("/inicio/adornos")
      .then((r) => {
        cache = r.data?.data?.activos !== false;
        if (vivo) setActivos(cache);
      })
      .catch(() => {
        cache = true;
        if (vivo) setActivos(true);
      });
    return () => {
      vivo = false;
    };
  }, [temporada]);

  const cambiar = async (valor) => {
    await api.put("/inicio/adornos", { activos: valor });
    cache = valor;
    setActivos(valor);
  };

  return { temporada: activos ? temporada : null, enTemporada: temporada, activos, cambiar };
}
