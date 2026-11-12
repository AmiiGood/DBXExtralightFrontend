import { useState } from "react";
import { X, Plus, Pencil, Check, Loader2, AlertTriangle, Search } from "lucide-react";
import { comprasService } from "../../services/compras.service";

/**
 * Las listas de los formatos: tipos de compra (Compras), cuentas contables
 * (Finanzas) y áreas solicitantes. Se agregan, se renombran y se desactivan; no
 * se borran, porque hay formatos que las usan. Renombrar un tipo corrige
 * también esos formatos. Las áreas ligadas al osTicket de Compras solo se ven:
 * se configuran en Aprobadores.
 */

const estilo =
  "border border-gray-200 rounded-md px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#236093]/30";
const mensajeError = (e) => e.response?.data?.message || e.message;
const plano = (s) =>
  String(s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

function Fila({ clave, nombre, activo, onGuardar, soloLectura }) {
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState(nombre);
  const [ocupado, setOcupado] = useState(false);

  async function guardar(cambios) {
    setOcupado(true);
    const ok = await onGuardar({ nombre, activo, ...cambios });
    setOcupado(false);
    if (ok) setEditando(false);
  }

  return (
    <li
      className={`flex items-center gap-2 px-3 py-1.5 border-t border-gray-100 first:border-0 ${activo ? "" : "bg-gray-50"}`}
    >
      {clave && <span className="font-mono text-xs text-gray-500 w-24 shrink-0">{clave}</span>}
      {editando ? (
        <form
          className="flex-1 flex gap-1"
          onSubmit={(e) => {
            e.preventDefault();
            guardar({ nombre: texto });
          }}
        >
          <input
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            className={`${estilo} flex-1 py-1`}
            autoFocus
          />
          <button
            type="submit"
            disabled={ocupado}
            className="p-1.5 rounded-md text-[#236093] hover:bg-gray-100"
            aria-label="Guardar"
          >
            {ocupado ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
          </button>
          <button
            type="button"
            onClick={() => {
              setTexto(nombre);
              setEditando(false);
            }}
            className="p-1.5 rounded-md text-gray-400 hover:bg-gray-100"
            aria-label="Cancelar"
          >
            <X className="w-4 h-4" />
          </button>
        </form>
      ) : (
        <>
          <span className={`flex-1 text-sm ${activo ? "text-gray-800" : "text-gray-400 line-through"}`}>{nombre}</span>
          {soloLectura ? (
            <span className="text-xs text-gray-400 w-[6.5rem] text-right" title={soloLectura}>
              osTicket
            </span>
          ) : (
            <>
              <button
                onClick={() => setEditando(true)}
                className="p-1.5 rounded-md text-gray-400 hover:text-[#236093] hover:bg-gray-100"
                title="Cambiar el nombre"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => guardar({ activo: !activo })}
                disabled={ocupado}
                className={`text-xs px-2 py-0.5 rounded-full border w-20 ${
                  activo
                    ? "border-[#236093]/30 text-[#236093] hover:bg-[#236093]/5"
                    : "border-gray-300 text-gray-500 hover:bg-gray-100"
                }`}
                title={activo ? "Ya no se podrá escoger en formatos nuevos" : "Volver a mostrarla en la captura"}
              >
                {activo ? "Activa" : "Inactiva"}
              </button>
            </>
          )}
        </>
      )}
    </li>
  );
}

export default function ListasCompras({ opciones, onCerrar, onCambio }) {
  const [pestana, setPestana] = useState("tipos");
  const [busqueda, setBusqueda] = useState("");
  const [nuevo, setNuevo] = useState({ codigo: "", nombre: "" });
  const [error, setError] = useState(null);
  const [aviso, setAviso] = useState(null);
  const [agregando, setAgregando] = useState(false);

  const esCuentas = pestana === "cuentas";
  const esAreas = pestana === "areas";
  const q = plano(busqueda).trim();
  const tipos = (opciones?.tipos || []).filter((t) => !q || plano(t.nombre).includes(q));
  const cuentas = (opciones?.cuentas || []).filter((c) => !q || plano(c.nombre).includes(q) || c.codigo.includes(q));
  const areas = (opciones?.areasLista || []).filter((a) => !q || plano(a.nombre).includes(q));
  const visibles = esCuentas ? cuentas : esAreas ? areas : tipos;

  async function correr(promesa, texto) {
    setError(null);
    setAviso(null);
    try {
      const r = await promesa;
      const n = r?.data?.formatos;
      setAviso(n ? `${texto}; ${n} formato${n === 1 ? "" : "s"} con el nombre anterior se corrigieron` : texto);
      onCambio();
      return true;
    } catch (e) {
      setError(mensajeError(e));
      return false;
    }
  }

  async function agregar(e) {
    e.preventDefault();
    setAgregando(true);
    const ok = esCuentas
      ? await correr(comprasService.guardarCuenta(true, nuevo), "Cuenta agregada")
      : esAreas
        ? await correr(comprasService.guardarAreaSolicitante(null, { nombre: nuevo.nombre }), "Área agregada")
        : await correr(comprasService.guardarTipo(null, { nombre: nuevo.nombre }), "Tipo agregado");
    setAgregando(false);
    if (ok) setNuevo({ codigo: "", nombre: "" });
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/30 flex items-start justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl my-8">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
          <div>
            <h2 className="font-semibold text-gray-900">Listas de los formatos</h2>
            <p className="text-xs text-gray-500">Tipos de compra, cuentas contables y áreas solicitantes</p>
          </div>
          <button onClick={onCerrar} className="p-1.5 rounded-md text-gray-400 hover:bg-gray-100" aria-label="Cerrar">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex rounded-lg border border-gray-200 overflow-hidden">
              {[
                ["tipos", `Tipos (${opciones?.tipos?.length || 0})`],
                ["cuentas", `Cuentas (${opciones?.cuentas?.length || 0})`],
                ["areas", `Áreas (${opciones?.areasLista?.length || 0})`],
              ].map(([id, etiqueta]) => (
                <button
                  key={id}
                  onClick={() => {
                    setPestana(id);
                    setBusqueda("");
                    setError(null);
                    setAviso(null);
                  }}
                  className={`px-3 py-1.5 text-sm ${pestana === id ? "bg-[#236093] text-white" : "text-gray-600 hover:bg-gray-50"}`}
                >
                  {etiqueta}
                </button>
              ))}
            </div>
            <div className="relative flex-1 min-w-40">
              <Search className="w-4 h-4 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder={esCuentas ? "Número o nombre…" : esAreas ? "Buscar área…" : "Buscar tipo…"}
                className={`${estilo} w-full pl-8`}
              />
            </div>
          </div>

          <form onSubmit={agregar} className="flex gap-2">
            {esCuentas && (
              <input
                value={nuevo.codigo}
                onChange={(e) => setNuevo((x) => ({ ...x, codigo: e.target.value }))}
                placeholder="Número"
                inputMode="numeric"
                className={`${estilo} w-32 font-mono`}
                required
              />
            )}
            <input
              value={nuevo.nombre}
              onChange={(e) => setNuevo((x) => ({ ...x, nombre: e.target.value }))}
              placeholder={esCuentas ? "Nombre de la cuenta" : esAreas ? "Nombre del área" : "Nombre del tipo"}
              className={`${estilo} flex-1`}
              required
            />
            <button
              type="submit"
              disabled={agregando}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-[#236093] text-white rounded-lg hover:bg-[#1c4d76] disabled:opacity-40"
            >
              {agregando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Agregar
            </button>
          </form>

          {error && (
            <div className="flex items-start gap-2 text-sm text-red-700 bg-red-50 rounded-lg px-3 py-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              {error}
            </div>
          )}
          {aviso && <div className="text-sm rounded-lg px-3 py-2 bg-green-50 text-green-800">{aviso}</div>}

          <ul className="border border-gray-200 rounded-lg max-h-[50vh] overflow-y-auto">
            {esAreas
              ? areas.map((a) => (
                  <Fila
                    key={a.id}
                    nombre={a.nombre}
                    activo={a.activo}
                    soloLectura={
                      a.con_osticket ? "Ligada a un tema del osTicket de Compras: se configura en Aprobadores" : null
                    }
                    onGuardar={(d) => correr(comprasService.guardarAreaSolicitante(a.id, d), "Área guardada")}
                  />
                ))
              : esCuentas
                ? cuentas.map((c) => (
                    <Fila
                      key={c.codigo}
                      clave={c.codigo}
                      nombre={c.nombre}
                      activo={c.activo}
                      onGuardar={(d) =>
                        correr(
                          comprasService.guardarCuenta(false, {
                            ...d,
                            codigo: c.codigo,
                          }),
                          "Cuenta guardada",
                        )
                      }
                    />
                  ))
                : tipos.map((t) => (
                    <Fila
                      key={t.id}
                      nombre={t.nombre}
                      activo={t.activo}
                      onGuardar={(d) => correr(comprasService.guardarTipo(t.id, d), "Tipo guardado")}
                    />
                  ))}
            {visibles.length === 0 && (
              <li className="px-3 py-6 text-center text-sm text-gray-400">Nada con “{busqueda}”.</li>
            )}
          </ul>
          <p className="text-xs text-gray-400">
            {esAreas
              ? "Las áreas que agregas aquí son para compras sin ticket: salen en Formatos, Presupuestos y el Tablero, no en Solicitudes. Las marcadas osTicket se configuran en Aprobadores."
              : "Una inactiva ya no se ofrece en la captura, pero los formatos que la usan la conservan."}
          </p>
        </div>
      </div>
    </div>
  );
}
