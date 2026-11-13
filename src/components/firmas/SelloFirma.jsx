/**
 * Cómo se ve una firma estampada: la firma sobre la línea, abajo el nombre,
 * para qué firmó y cuándo. Es lo que saldrá en la orden de compra y en el
 * formato en PDF.
 */
const fechaHora = (s) =>
  new Date(s || Date.now()).toLocaleString("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

export default function SelloFirma({ imagen, nombre, como, fecha, className = "" }) {
  return (
    <div className={`inline-flex flex-col items-center min-w-[200px] ${className}`}>
      <div className="h-20 w-full flex items-end justify-center">
        {imagen ? (
          <img src={imagen} alt={`Firma de ${nombre}`} className="max-h-20 max-w-[240px] object-contain" />
        ) : (
          <span className="text-xs text-gray-300 pb-2">Sin firma</span>
        )}
      </div>
      <div className="w-full border-t border-gray-400 mt-1 pt-1 text-center">
        <p className="text-sm font-medium text-gray-900">{nombre}</p>
        {como && <p className="text-xs text-gray-500">{como}</p>}
        <p className="text-[11px] text-gray-400">{fechaHora(fecha)}</p>
      </div>
    </div>
  );
}
