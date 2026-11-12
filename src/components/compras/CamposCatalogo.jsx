import { useState, useRef } from "react";
import { X, AlertTriangle } from "lucide-react";

/**
 * Campos de la captura de formatos que salen de las listas de Compras (tipo) y
 * Finanzas (cuenta). Lo capturado a mano antes de las listas se sigue viendo y
 * se marca como "fuera de la lista" para que se reclasifique.
 */

const estilo =
  "w-full border border-gray-200 rounded-md px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#236093]/30";

// Sin acentos ni mayúsculas, para buscar "produccion" y hallar "PRODUCCIÓN"
const plano = (s) =>
  String(s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

function FueraDeLista({ quien }) {
  return (
    <span className="mt-1 flex items-center gap-1 text-xs text-amber-700">
      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
      Fuera de la lista de {quien}
    </span>
  );
}

/** Tipo de compra: lista desplegable con los tipos activos. */
export function SelectTipo({ valor, tipos, onCambiar }) {
  const activos = tipos.filter((t) => t.activo);
  const enLista = !valor || activos.some((t) => t.nombre === valor);
  return (
    <>
      <select value={valor} onChange={(e) => onCambiar(e.target.value)} className={estilo}>
        <option value="">Sin tipo</option>
        {!enLista && <option value={valor}>{valor}</option>}
        {activos.map((t) => (
          <option key={t.id} value={t.nombre}>
            {t.nombre}
          </option>
        ))}
      </select>
      {!enLista && <FueraDeLista quien="Compras" />}
    </>
  );
}

/**
 * Cuenta contable: se busca por número o por nombre y se guarda el número.
 * Enter elige la resaltada (sin mandar el formulario); Esc cierra.
 */
export function ComboCuenta({ valor, cuentas, onCambiar }) {
  // null = no se está escribiendo: se muestra la cuenta elegida
  const [texto, setTexto] = useState(null);
  const [resaltada, setResaltada] = useState(0);
  const entrada = useRef(null);

  const actual = cuentas.find((c) => c.codigo === valor);
  const mostrado = texto ?? (valor ? (actual ? `${actual.codigo} · ${actual.nombre}` : valor) : "");
  const abierto = texto !== null;

  const q = plano(texto).trim();
  const digitos = q.replace(/\D/g, "");
  const lista = abierto
    ? cuentas.filter((c) => c.activo && (!q || plano(c.nombre).includes(q) || (digitos && c.codigo.includes(digitos))))
    : [];

  function elegir(c) {
    onCambiar(c.codigo);
    setTexto(null);
  }

  function teclas(e) {
    if (!abierto) {
      if (e.key === "ArrowDown") {
        setTexto("");
        setResaltada(0);
      }
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setResaltada((i) => Math.min(i + 1, lista.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setResaltada((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (lista[resaltada]) elegir(lista[resaltada]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setTexto(null);
    }
  }

  return (
    <div className="relative">
      <input
        ref={entrada}
        value={mostrado}
        onChange={(e) => {
          setTexto(e.target.value);
          setResaltada(0);
        }}
        onFocus={() => {
          setTexto("");
          setResaltada(0);
        }}
        onBlur={() => setTexto(null)}
        onKeyDown={teclas}
        placeholder="Número o nombre…"
        className={`${estilo} ${valor ? "pr-7" : ""}`}
        role="combobox"
        aria-expanded={abierto}
        aria-autocomplete="list"
      />
      {valor && !abierto && (
        <button
          type="button"
          onClick={() => onCambiar("")}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 rounded text-gray-400 hover:text-gray-600"
          aria-label="Quitar la cuenta"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
      {abierto && (
        <ul
          role="listbox"
          className="absolute z-10 mt-1 w-[26rem] max-w-[80vw] max-h-64 overflow-y-auto bg-white border border-gray-200 rounded-lg shadow-lg py-1 text-sm"
        >
          {lista.length === 0 ? (
            <li className="px-3 py-2 text-gray-400">Ninguna cuenta con “{texto}”.</li>
          ) : (
            lista.map((c, i) => (
              <li
                key={c.codigo}
                role="option"
                aria-selected={i === resaltada}
                // mousedown en vez de click: el clic llega antes de que el campo pierda el foco
                onMouseDown={(e) => {
                  e.preventDefault();
                  elegir(c);
                  entrada.current?.blur();
                }}
                onMouseEnter={() => setResaltada(i)}
                className={`px-3 py-1.5 cursor-pointer flex gap-3 ${i === resaltada ? "bg-[#236093]/10" : ""}`}
              >
                <span className="font-mono text-xs text-gray-500 pt-0.5 shrink-0">{c.codigo}</span>
                <span className="text-gray-800">{c.nombre}</span>
              </li>
            ))
          )}
        </ul>
      )}
      {valor && !actual && <FueraDeLista quien="Finanzas" />}
    </div>
  );
}
