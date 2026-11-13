import { CheckCircle2, Award, AlertTriangle, Loader2, Lightbulb } from "lucide-react";
import ArchivoCompras from "./ArchivoCompras";
import { comprasService } from "../../services/compras.service";
import { dinero } from "./formatoCompras";

/**
 * El comparativo de proveedores, de solo lectura.
 *
 * Es la misma tabla que Compras manda hoy por correo (ticket AD-005426): las
 * partidas a la izquierda y, por cada proveedor, precio unitario, importe, lo
 * que ofrece y su foto; abajo total, tiempo de entrega, crédito y
 * observaciones.
 *
 * Si llega `onElegir`, abajo de cada proveedor sale un botón ("Sugerir X" para
 * quien pidió, "Decidir X" para Compras: lo dice `accion`).
 * `elegidaId` es la que decidió Compras (o eligió el solicitante, en las
 * viejas) y `sugeridaId` la que sugirió quien pidió.
 * Si llega `impacto`, abajo del total sale cuánto descontaría cada opción del
 * presupuesto del área (sin IVA, en pesos) al autorizarse la orden de compra.
 */

const cantidadTexto = (n) => (n == null ? "—" : Number(n).toLocaleString("es-MX", { maximumFractionDigits: 3 }));

export default function Comparativo({
  cotizacion: c,
  elegidaId = null,
  sugeridaId = null,
  onElegir,
  accion = "Elegir",
  eligiendo = null,
  impacto = null,
}) {
  if (!c) return null;
  const cargar = (a) => () => comprasService.getArchivoCotizacion(a.id);
  const celda = "px-3 py-2 border border-gray-200 align-top";
  const encabezado = "px-3 py-1.5 border border-gray-200 text-[11px] font-semibold uppercase tracking-wide";

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm border-collapse">
          <thead>
            <tr className="bg-[#236093] text-white">
              <th className={encabezado} colSpan={3}>
                Producto
              </th>
              {c.opciones.map((o) => (
                <th key={o.id} className={`${encabezado} text-center min-w-[220px]`} colSpan={2}>
                  <div className="flex items-center justify-center gap-1.5 normal-case text-sm">
                    {o.proveedor}
                    {o.id === elegidaId && <CheckCircle2 className="w-4 h-4" />}
                  </div>
                  {o.id === sugeridaId && (
                    <span className="inline-flex items-center gap-1 mt-0.5 px-1.5 py-0.5 rounded-full bg-white/20 text-[10px] font-medium normal-case">
                      <Lightbulb className="w-3 h-3" />
                      Sugerida por quien pidió
                    </span>
                  )}
                </th>
              ))}
            </tr>
            <tr className="bg-gray-50 text-gray-600">
              <th className={`${encabezado} text-left`}>Descripción</th>
              <th className={`${encabezado} text-right`}>Cant.</th>
              <th className={`${encabezado} text-left`}>U.M.</th>
              {c.opciones.map((o) => [
                <th key={`${o.id}-p`} className={`${encabezado} text-right`}>
                  Precio
                </th>,
                <th key={`${o.id}-t`} className={`${encabezado} text-right`}>
                  Total
                </th>,
              ])}
            </tr>
          </thead>
          <tbody>
            {c.partidas.map((p) => (
              <tr key={p.id}>
                <td className={`${celda} text-gray-900`}>{p.descripcion}</td>
                <td className={`${celda} text-right`}>{cantidadTexto(p.cantidad)}</td>
                <td className={`${celda} text-gray-600`}>{p.unidad}</td>
                {c.opciones.map((o) => {
                  const pr = o.precios[p.id];
                  if (!pr || pr.precio == null) {
                    return (
                      <td key={o.id} colSpan={2} className={`${celda} text-center text-xs text-gray-400 italic`}>
                        {pr?.descripcion || "No lo cotizó"}
                      </td>
                    );
                  }
                  return [
                    <td key={`${o.id}-p`} className={`${celda} text-right whitespace-nowrap`}>
                      {dinero(pr.precio, o.moneda)}
                    </td>,
                    <td key={`${o.id}-t`} className={`${celda} text-right whitespace-nowrap font-medium`}>
                      {dinero(pr.importe, o.moneda)}
                    </td>,
                  ];
                })}
              </tr>
            ))}
            {/* Lo que ofrece cada proveedor: descripción y foto, debajo de sus precios */}
            {c.partidas.some((p) => c.opciones.some((o) => o.precios[p.id]?.descripcion || o.precios[p.id]?.imagen)) &&
              c.partidas.map((p) => (
                <tr key={`${p.id}-oferta`} className="bg-gray-50/50">
                  <td className={`${celda} text-xs text-gray-400`} colSpan={3}>
                    Lo que ofrece cada proveedor{c.partidas.length > 1 ? `: ${p.descripcion}` : ""}
                  </td>
                  {c.opciones.map((o) => {
                    const pr = o.precios[p.id];
                    return (
                      <td key={o.id} colSpan={2} className={`${celda} text-xs text-gray-700`}>
                        <div className="flex items-start justify-between gap-2">
                          <span className="whitespace-pre-wrap">{pr?.precio != null ? pr?.descripcion || "" : ""}</span>
                          {pr?.imagen && <ArchivoCompras archivo={pr.imagen} cargar={cargar(pr.imagen)} compacto />}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
          </tbody>
          <tfoot>
            <tr className="bg-[#236093]/10 font-semibold">
              <td className={`${celda} text-right`} colSpan={3}>
                Total {c.incluye_iva ? "(con IVA)" : "(más IVA)"}
              </td>
              {c.opciones.map((o) => (
                <td key={o.id} colSpan={2} className={`${celda} text-right text-base`}>
                  <div className="flex items-center justify-end gap-2">
                    {o.id === c.masBarata && (
                      <span className="inline-flex items-center gap-0.5 text-[11px] font-medium text-green-700 bg-green-50 px-1.5 py-0.5 rounded-full">
                        <Award className="w-3 h-3" />
                        La más barata
                      </span>
                    )}
                    {dinero(o.total, o.moneda)}
                  </div>
                  {!o.completa && (
                    <p className="text-[11px] font-normal text-amber-700 flex items-center justify-end gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      Cotizó {o.cotizadas} de {c.partidas.length} partidas
                    </p>
                  )}
                </td>
              ))}
            </tr>
            {impacto && (
              <tr>
                <td className={`${celda} text-right text-gray-600`} colSpan={3}>
                  Presupuesto del área
                  <span className="block text-[11px] text-gray-400">sin IVA, en pesos, al autorizarse la orden</span>
                </td>
                {c.opciones.map((o) => {
                  const i = impacto.opciones?.[o.id];
                  if (!i) return <td key={o.id} colSpan={2} className={celda} />;
                  if (i.sinTipoCambio) {
                    return (
                      <td key={o.id} colSpan={2} className={`${celda} text-center text-xs text-amber-700`}>
                        Sin tipo de cambio para convertir dólares
                      </td>
                    );
                  }
                  return (
                    <td key={o.id} colSpan={2} className={`${celda} text-right ${i.rebasa ? "bg-red-50" : ""}`}>
                      <span className="text-gray-700">Descontaría {dinero(i.monto)}</span>
                      {impacto.saldo?.configurado && (
                        <span className={`block text-xs ${i.rebasa ? "text-red-700 font-medium" : "text-gray-500"}`}>
                          {i.rebasa ? "Rebasa: quedaría en " : "Quedarían "}
                          {dinero(i.quedaMes)} este mes
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            )}
            {[
              ["Tiempo de entrega", "tiempo_entrega"],
              ["Crédito", "credito"],
              ["Observaciones", "observaciones"],
            ].map(([etiqueta, k]) => (
              <tr key={k}>
                <td className={`${celda} text-right text-gray-600`} colSpan={3}>
                  {etiqueta}
                </td>
                {c.opciones.map((o) => (
                  <td key={o.id} colSpan={2} className={`${celda} text-center text-gray-700 whitespace-pre-wrap`}>
                    {o[k] || "—"}
                  </td>
                ))}
              </tr>
            ))}
            {c.opciones.some((o) => o.archivo) && (
              <tr>
                <td className={`${celda} text-right text-gray-600`} colSpan={3}>
                  Cotización del proveedor
                </td>
                {c.opciones.map((o) => (
                  <td key={o.id} colSpan={2} className={`${celda} text-center`}>
                    {o.archivo ? <ArchivoCompras archivo={o.archivo} cargar={cargar(o.archivo)} compacto /> : "—"}
                  </td>
                ))}
              </tr>
            )}
            {onElegir && (
              <tr>
                <td className="px-3 py-3" colSpan={3} />
                {c.opciones.map((o) => (
                  <td key={o.id} colSpan={2} className="px-3 py-3 text-center">
                    <button
                      onClick={() => onElegir(o)}
                      disabled={eligiendo != null}
                      className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                    >
                      {eligiendo === o.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                      {accion} {o.proveedor}
                    </button>
                  </td>
                ))}
              </tr>
            )}
          </tfoot>
        </table>
      </div>
      {c.mensaje && <p className="text-sm text-gray-600 bg-gray-50 rounded-lg px-3 py-2 whitespace-pre-wrap">{c.mensaje}</p>}
    </div>
  );
}
