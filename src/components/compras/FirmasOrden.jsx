import { Hourglass, XCircle, MinusCircle } from "lucide-react";
import SelloFirma from "../firmas/SelloFirma";
import { dinero } from "./formatoCompras";

/**
 * Las cuatro firmas de una orden de compra, en el orden del flujo: gerente,
 * Compras (tipo), Finanzas (cuenta y CC) y Dirección. Cada lugar muestra la
 * firma estampada, a quién le toca, el rechazo o que Dirección no hizo falta.
 */

const PASOS = [
  { paso: "GERENTE", nombre: "Gerente del área" },
  { paso: "COMPRAS", nombre: "Compras" },
  { paso: "FINANZAS", nombre: "Finanzas" },
  { paso: "DIRECCION", nombre: "Dirección" },
];

export default function FirmasOrden({ orden }) {
  if (!orden) return null;
  const firma = (p) => orden.firmas?.find((f) => f.paso === p);

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
        {PASOS.map(({ paso, nombre }) => {
          const f = firma(paso);
          const toca = orden.estado === "EN_FIRMAS" && orden.paso === paso;
          const rechazo = orden.estado === "RECHAZADA" && orden.rechazada_paso === paso;
          const sinDireccion = paso === "DIRECCION" && orden.requiere_direccion === false;
          return (
            <div
              key={paso}
              className={`rounded-lg border px-2 py-2 flex flex-col items-center text-center min-h-[150px] ${
                toca
                  ? "border-amber-300 bg-amber-50/60"
                  : rechazo
                    ? "border-red-200 bg-red-50/60"
                    : "border-gray-200 bg-white"
              }`}
            >
              <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 self-start">{nombre}</p>
              {f ? (
                <>
                  <SelloFirma imagen={f.imagen} nombre={f.nombre} como={f.comoTexto} fecha={f.firmado_en} className="min-w-0 w-full" />
                  {f.comentario && <p className="text-xs text-gray-500 italic mt-1">“{f.comentario}”</p>}
                </>
              ) : rechazo ? (
                <div className="flex-1 flex flex-col items-center justify-center gap-1 text-sm text-red-700">
                  <XCircle className="w-5 h-5" />
                  <span>
                    Rechazó <b>{orden.rechazada_por_nombre}</b>
                  </span>
                  <span className="text-xs italic">“{orden.motivo_rechazo}”</span>
                </div>
              ) : sinDireccion ? (
                <div className="flex-1 flex flex-col items-center justify-center gap-1 text-xs text-gray-500">
                  <MinusCircle className="w-5 h-5 text-gray-300" />
                  No hizo falta: {dinero(orden.monto_mxn_sin_iva)} sin IVA, abajo del mínimo de{" "}
                  {dinero(orden.monto_minimo_direccion)}
                </div>
              ) : toca ? (
                <div className="flex-1 flex flex-col items-center justify-center gap-1 text-sm text-amber-700">
                  <Hourglass className="w-5 h-5" />
                  Esperando su firma
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center text-xs text-gray-300">
                  {orden.estado === "EN_FIRMAS" ? "Después" : "—"}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {(orden.clasif_tipo || orden.cuenta) && (
        <p className="text-xs text-gray-500 flex flex-wrap gap-x-4">
          {orden.clasif_tipo && (
            <span>
              Tipo: <b className="text-gray-700">{orden.clasif_tipo}</b>
            </span>
          )}
          {orden.cuenta && (
            <span>
              Cuenta: <b className="text-gray-700">{orden.cuenta}</b>
              {orden.cuenta_nombre && ` · ${orden.cuenta_nombre}`}
            </span>
          )}
          {orden.centro_costos && (
            <span>
              CC: <b className="text-gray-700">{orden.centro_costos}</b>
            </span>
          )}
        </p>
      )}
    </div>
  );
}
