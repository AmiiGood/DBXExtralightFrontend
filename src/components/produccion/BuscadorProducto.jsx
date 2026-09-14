import { useState, useEffect, useRef } from "react";
import { Search, X } from "lucide-react";
import { inyeccionService } from "../../services/inyeccion.service";

/**
 * Autocompletar de producto semiterminado por SKU o descripción.
 *
 * El catálogo trae 3,545 SKUs, así que se busca en el servidor con un respiro
 * de 300 ms en vez de traerlo completo al navegador.
 */
export default function BuscadorProducto({ valor, onChange, autoFocus }) {
  const [texto, setTexto] = useState("");
  const [resultados, setResultados] = useState([]);
  const [abierto, setAbierto] = useState(false);
  const [buscando, setBuscando] = useState(false);
  const [resaltado, setResaltado] = useState(0);
  const contenedor = useRef(null);

  // Cerrar al hacer clic fuera
  useEffect(() => {
    const fuera = (e) => {
      if (contenedor.current && !contenedor.current.contains(e.target)) {
        setAbierto(false);
      }
    };
    document.addEventListener("mousedown", fuera);
    return () => document.removeEventListener("mousedown", fuera);
  }, []);

  useEffect(() => {
    if (texto.trim().length < 2) {
      setResultados([]);
      return;
    }
    let cancelado = false;
    setBuscando(true);
    const t = setTimeout(() => {
      inyeccionService
        .buscarProductos(texto.trim())
        .then((r) => {
          if (!cancelado) {
            setResultados(r);
            setResaltado(0);
            setAbierto(true);
          }
        })
        .catch(() => !cancelado && setResultados([]))
        .finally(() => !cancelado && setBuscando(false));
    }, 300);
    return () => {
      cancelado = true;
      clearTimeout(t);
    };
  }, [texto]);

  const elegir = (p) => {
    onChange(p);
    setTexto("");
    setAbierto(false);
    setResultados([]);
  };

  const teclas = (e) => {
    if (!abierto || resultados.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setResaltado((i) => Math.min(i + 1, resultados.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setResaltado((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      elegir(resultados[resaltado]);
    } else if (e.key === "Escape") {
      setAbierto(false);
    }
  };

  // Ya hay producto elegido: se muestra como etiqueta, no como buscador
  if (valor?.id) {
    return (
      <div className="flex items-center gap-1 min-w-0">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-gray-900 truncate" title={valor.sku}>
            {valor.sku}
          </p>
          <p className="text-[11px] text-gray-400 truncate" title={valor.descripcion}>
            {valor.descripcion}
          </p>
        </div>
        <button
          type="button"
          onClick={() => onChange(null)}
          className="p-1 text-gray-300 hover:text-red-500 flex-shrink-0"
          title="Quitar producto"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div ref={contenedor} className="relative">
      <div className="relative">
        <Search className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-gray-300" />
        <input
          value={texto}
          autoFocus={autoFocus}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={teclas}
          onFocus={() => resultados.length > 0 && setAbierto(true)}
          placeholder="SKU o descripción"
          className="w-full pl-7 pr-2 py-1 text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      {abierto && (
        <div className="absolute z-30 mt-1 w-80 max-h-64 overflow-y-auto bg-white border border-gray-200 rounded-lg shadow-lg">
          {buscando && (
            <p className="px-3 py-2 text-xs text-gray-400">Buscando...</p>
          )}
          {!buscando && resultados.length === 0 && (
            <p className="px-3 py-2 text-xs text-gray-400">Sin resultados</p>
          )}
          {resultados.map((p, i) => (
            <button
              key={p.id}
              type="button"
              onMouseEnter={() => setResaltado(i)}
              onClick={() => elegir(p)}
              className={`w-full text-left px-3 py-1.5 border-b border-gray-50 last:border-0 ${
                i === resaltado ? "bg-primary/5" : ""
              }`}
            >
              <p className="text-xs font-medium text-gray-900">{p.sku}</p>
              <p className="text-[11px] text-gray-500 truncate">
                {p.descripcion}
                {p.bu_reporte && (
                  <span className="text-gray-300"> · {p.bu_reporte}</span>
                )}
              </p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
