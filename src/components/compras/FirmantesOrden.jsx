import { useState, useEffect } from "react";
import { FileSignature, Loader2, X, Save, AlertTriangle } from "lucide-react";
import { comprasService } from "../../services/compras.service";
import { dinero } from "./formatoCompras";

/**
 * Quiénes firman la orden de compra por Compras, Finanzas y Dirección, y desde
 * qué monto firma Dirección. El gerente no va aquí: sale de cada área.
 *
 * Por Compras firma el jefe (decisión del 13-nov-2026); se puede agregar a
 * quien lo cubre. Basta una firma por papel: cualquiera de la lista.
 */

const PAPELES = [
  { id: "COMPRAS", nombre: "Compras", ayuda: "El jefe de Compras (y quien lo cubra). Pone el tipo." },
  { id: "FINANZAS", nombre: "Finanzas", ayuda: "Pone la cuenta y el centro de costos." },
  { id: "DIRECCION", nombre: "Dirección", ayuda: "La última firma. Basta una de las personas." },
];

const mensajeError = (e) => e.response?.data?.message || e.message;

export default function FirmantesOrden({ usuarios }) {
  const [datos, setDatos] = useState(null);
  const [lista, setLista] = useState({ COMPRAS: [], FINANZAS: [], DIRECCION: [] });
  const [minimo, setMinimo] = useState("0");
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState(null);
  const [error, setError] = useState(null);

  const tomar = (d) => {
    setDatos(d);
    setLista(Object.fromEntries(PAPELES.map((p) => [p.id, d[p.id].map((u) => u.id)])));
    setMinimo(String(d.montoMinimo ?? 0));
  };

  useEffect(() => {
    comprasService.getFirmantes().then(tomar).catch((e) => setError(mensajeError(e)));
  }, []);

  const nombre = (id) => usuarios.find((u) => u.id === id)?.nombre_completo || `Usuario ${id}`;
  const sinFirma = (papel, id) => datos?.[papel]?.find((u) => u.id === id)?.tiene_firma === false;

  async function guardar() {
    setGuardando(true);
    setAviso(null);
    try {
      const r = await comprasService.guardarFirmantes({ ...lista, montoMinimo: minimo });
      tomar(r.data);
      setAviso({ ok: true, texto: r.message });
    } catch (e) {
      setAviso({ ok: false, texto: mensajeError(e) });
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 space-y-4">
      <div>
        <h2 className="font-semibold text-gray-900 flex items-center gap-2">
          <FileSignature className="w-5 h-5 text-[#236093]" />
          Firmas de la orden de compra
        </h2>
        <p className="text-xs text-gray-400 mt-0.5">
          Firman en este orden: el gerente del área (el de arriba), Compras, Finanzas y Dirección. Para firmar, cada quien
          registra su firma una vez en “Mi firma”. Nadie firma su propia orden.
        </p>
      </div>

      {error ? (
        <p className="text-sm text-red-700">{error}</p>
      ) : !datos ? (
        <div className="flex justify-center py-4">
          <Loader2 className="w-5 h-5 animate-spin text-gray-300" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            {PAPELES.map((p) => (
              <div key={p.id} className="bg-gray-50 rounded-lg p-3 space-y-2">
                <div>
                  <p className="text-sm font-medium text-gray-800">{p.nombre}</p>
                  <p className="text-xs text-gray-400">{p.ayuda}</p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {lista[p.id].length === 0 && <span className="text-xs text-amber-700">Nadie: las órdenes se quedarían aquí</span>}
                  {lista[p.id].map((id) => (
                    <span
                      key={id}
                      className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 text-xs bg-white border border-gray-200 rounded-full"
                    >
                      {nombre(id)}
                      {sinFirma(p.id, id) && (
                        <AlertTriangle className="w-3 h-3 text-amber-500" title="Todavía no registra su firma" />
                      )}
                      <button
                        onClick={() => setLista((l) => ({ ...l, [p.id]: l[p.id].filter((x) => x !== id) }))}
                        className="p-0.5 rounded-full text-gray-400 hover:bg-gray-100"
                        aria-label={`Quitar a ${nombre(id)}`}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
                <select
                  value=""
                  onChange={(e) => e.target.value && setLista((l) => ({ ...l, [p.id]: [...l[p.id], Number(e.target.value)] }))}
                  className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white"
                >
                  <option value="">Agregar a alguien…</option>
                  {usuarios
                    .filter((u) => !lista[p.id].includes(u.id))
                    .map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.nombre_completo}
                        {u.area ? ` · ${u.area}` : ""}
                      </option>
                    ))}
                </select>
              </div>
            ))}
          </div>
          {PAPELES.some((p) => lista[p.id].some((id) => sinFirma(p.id, id))) && (
            <p className="text-xs text-amber-700 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> Quien tiene el triángulo todavía no registra su firma: no podrá firmar hasta hacerlo.
            </p>
          )}

          <div className="flex flex-wrap items-end gap-3">
            <label className="block">
              <span className="block text-xs font-medium text-gray-500 mb-1">Dirección firma desde (sin IVA, en pesos)</span>
              <input
                value={minimo}
                onChange={(e) => setMinimo(e.target.value.replace(/[^\d.]/g, ""))}
                inputMode="decimal"
                className="w-44 text-sm border border-gray-200 rounded-lg px-3 py-1.5"
              />
            </label>
            <p className="text-xs text-gray-500 pb-2 flex-1 min-w-[200px]">
              {Number(minimo) > 0
                ? `Abajo de ${dinero(Number(minimo))} la orden queda autorizada con la firma de Finanzas.`
                : "En 0, Dirección firma todas las órdenes."}
            </p>
            <button
              onClick={guardar}
              disabled={guardando}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-[#236093] text-white rounded-lg hover:bg-[#1c4d76] disabled:opacity-50"
            >
              {guardando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Guardar firmantes
            </button>
          </div>
          {aviso && (
            <p className={`text-sm rounded-lg px-3 py-2 ${aviso.ok ? "bg-green-50 text-green-800" : "bg-red-50 text-red-700"}`}>
              {aviso.texto}
            </p>
          )}
        </>
      )}
    </div>
  );
}
