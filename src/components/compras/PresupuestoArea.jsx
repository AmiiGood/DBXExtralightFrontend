import { PiggyBank } from "lucide-react";
import { dinero } from "./formatoCompras";

/**
 * Cuánto le queda al área este mes y en el año.
 *
 * Lo ve el gerente al aprobar, quien pidió al elegir y Compras al cotizar. El
 * disponible del mes incluye lo que sobró de los meses anteriores. Sin
 * presupuesto capturado solo lo dice: no hay contra qué comparar.
 */

const MES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

export default function PresupuestoArea({ saldo, area }) {
  if (!saldo) return null;
  if (!saldo.configurado) {
    return (
      <p className="flex items-center gap-2 text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
        <PiggyBank className="w-4 h-4 text-gray-400 shrink-0" />
        {area ? `${area} no tiene` : "El área no tiene"} presupuesto capturado para {saldo.anio}.
      </p>
    );
  }
  const negativo = saldo.disponibleMes < 0;
  return (
    <div
      className={`flex flex-wrap items-center gap-x-5 gap-y-1 text-sm rounded-lg px-3 py-2 border ${
        negativo ? "bg-red-50 border-red-200" : "bg-gray-50 border-gray-100"
      }`}
    >
      <span className="flex items-center gap-2 text-gray-600">
        <PiggyBank className={`w-4 h-4 shrink-0 ${negativo ? "text-red-500" : "text-[#236093]"}`} />
        Presupuesto{area ? ` de ${area}` : " del área"}
      </span>
      <span className="text-gray-600">
        Disponible a {MES[saldo.mes - 1]}:{" "}
        <b className={negativo ? "text-red-700" : "text-gray-900"}>{dinero(saldo.disponibleMes)}</b>
      </span>
      <span className="text-gray-500">
        Del año: {dinero(saldo.disponibleAnual)} de {dinero(saldo.presupuestoAnual)}
      </span>
      <span className="text-xs text-gray-400">Sin IVA, en pesos</span>
    </div>
  );
}
