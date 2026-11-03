/**
 * Formato de montos de Compras: "$2,090.50" en pesos, "$1,200.00 USD" en dólares.
 * Va aparte de los componentes para que el recargado en caliente de Vite siga
 * funcionando (un archivo de componentes solo debe exportar componentes).
 */
export const dinero = (n, moneda = "MXN") =>
  n == null
    ? "—"
    : `$${Number(n).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${
        moneda === "USD" ? " USD" : ""
      }`;
