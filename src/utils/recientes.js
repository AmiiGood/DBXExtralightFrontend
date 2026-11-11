/**
 * Los últimos reportes que abrió el usuario, para enseñarlos primero en Inicio.
 *
 * Se guardan en el navegador (por usuario): es una comodidad, no un dato. Si
 * el navegador no deja guardar (ventana privada, sitio bloqueado), Inicio
 * simplemente no enseña "Recientes".
 */
const MAXIMO = 6;
const llave = (usuarioId) => `dbx.recientes.${usuarioId || "anon"}`;

export function leerRecientes(usuarioId) {
  try {
    const v = JSON.parse(localStorage.getItem(llave(usuarioId)) || "[]");
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

export function registrarReciente(usuarioId, ruta) {
  try {
    const lista = [ruta, ...leerRecientes(usuarioId).filter((r) => r !== ruta)].slice(0, MAXIMO);
    localStorage.setItem(llave(usuarioId), JSON.stringify(lista));
  } catch {
    // Sin almacenamiento no pasa nada
  }
}
