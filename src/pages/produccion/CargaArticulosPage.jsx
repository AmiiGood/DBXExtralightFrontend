import { useState, useEffect, useMemo, useCallback } from "react";
import {
  FileSpreadsheet, Plus, Trash2, Search, Download, AlertTriangle,
  AlertCircle, Loader2, Save,
} from "lucide-react";
import api from "../../services/api";
import Button from "../../components/ui/Button";
import {
  COLUMNAS,
  construirFilas,
  generarWorkbook,
  nombreArchivo,
} from "../../utils/articlesMassiveLoad";

let bloqueSeq = 1;
const nuevoBloque = () => ({
  id: bloqueSeq++,
  entrada: "",
  productos: [],
  rango: [0, 0],
  excluidos: new Set(),
  unfinId: "",
  strapId: "",
  prefijo: "A5",
  buscando: false,
  error: null,
});

const etiquetaSem = (item) =>
  `${item.codigo ? `${item.codigo} — ` : ""}${item.nombre}${item.obsoleto ? " (obsoleto)" : ""}${!item.codigo ? " (sin código)" : ""}`;

const productosIncluidos = (bloque) =>
  bloque.productos.filter(
    (p, i) =>
      i >= bloque.rango[0] &&
      i <= bloque.rango[1] &&
      !bloque.excluidos.has(p.sku),
  );

// ── Advertencia de color faltante con alta rápida ─────────────
function AvisoColor({ aviso, onGuardado }) {
  const [nombre, setNombre] = useState(aviso.sugerencia || "");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);

  const guardar = async () => {
    if (!nombre.trim()) return;
    setGuardando(true);
    setError(null);
    try {
      const res = await api.post("/articulos-massive/colores", {
        codigo: aviso.color,
        nombre: nombre.trim(),
      });
      onGuardado(res.data.data.color);
    } catch (e) {
      setError(e.response?.data?.message || "Error al guardar el color");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <li className="flex flex-wrap items-center gap-2 py-1.5">
      <AlertTriangle className="w-4 h-4 text-yellow-500 flex-shrink-0" />
      <span className="text-sm text-gray-700">{aviso.mensaje}</span>
      <span className="inline-flex items-center gap-1.5">
        <input
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="Nombre del color"
          className="border border-gray-300 rounded-md px-2 py-1 text-sm w-44 focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
        <Button size="sm" variant="outline" onClick={guardar} isLoading={guardando}>
          <Save className="w-3.5 h-3.5 mr-1" /> Guardar color
        </Button>
      </span>
      {error && <span className="text-sm text-red-600">{error}</span>}
    </li>
  );
}

// ── Slider doble para rango de tallas ─────────────────────────
const thumb =
  "[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 " +
  "[&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:border-2 " +
  "[&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:shadow [&::-webkit-slider-thumb]:cursor-pointer " +
  "[&::-webkit-slider-thumb]:pointer-events-auto [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 " +
  "[&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-primary [&::-moz-range-thumb]:border-2 " +
  "[&::-moz-range-thumb]:border-white [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:pointer-events-auto";

function SliderTallas({ tallas, rango, onChange }) {
  const n = tallas.length;
  if (n === 0) return null;
  const [desde, hasta] = rango;
  const pct = (i) => (n === 1 ? 0 : (i / (n - 1)) * 100);

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm text-gray-600">Rango de tallas</span>
        <span className="text-sm font-semibold text-gray-800">
          {tallas[desde]} — {tallas[hasta]}
          <span className="ml-2 font-normal text-gray-500">
            ({hasta - desde + 1} tallas)
          </span>
        </span>
      </div>
      <div className="relative h-6">
        <div className="absolute top-1/2 -translate-y-1/2 w-full h-1.5 bg-gray-200 rounded-full" />
        <div
          className="absolute top-1/2 -translate-y-1/2 h-1.5 bg-primary rounded-full"
          style={{ left: `${pct(desde)}%`, width: `${pct(hasta) - pct(desde)}%` }}
        />
        <input
          type="range"
          min={0}
          max={n - 1}
          value={desde}
          onChange={(e) => onChange([Math.min(Number(e.target.value), hasta), hasta])}
          className={`absolute inset-0 w-full appearance-none bg-transparent pointer-events-none ${thumb}`}
        />
        <input
          type="range"
          min={0}
          max={n - 1}
          value={hasta}
          onChange={(e) => onChange([desde, Math.max(Number(e.target.value), desde)])}
          className={`absolute inset-0 w-full appearance-none bg-transparent pointer-events-none ${thumb}`}
        />
      </div>
      <div className="flex justify-between mt-1 text-[10px] text-gray-400">
        <span>{tallas[0]}</span>
        <span>{tallas[n - 1]}</span>
      </div>
    </div>
  );
}

// ── Bloque (un modelo estilo-color) ───────────────────────────
function Bloque({ bloque, numero, catalogos, onChange, onQuitar }) {
  const set = (patch) => onChange({ ...bloque, ...patch });

  const buscar = async () => {
    const partes = bloque.entrada.trim().split("-").filter(Boolean);
    if (partes.length !== 2) {
      set({
        error:
          'Captura estilo y color separados por guion, ej. "10001-214" (sin la talla)',
      });
      return;
    }
    set({ buscando: true, error: null });
    try {
      const res = await api.post("/articulos-massive/productos/buscar", {
        estilo: partes[0],
        color: partes[1],
      });
      const { productos } = res.data.data;
      set({
        buscando: false,
        productos,
        rango: [0, Math.max(0, productos.length - 1)],
        excluidos: new Set(),
        error:
          productos.length === 0
            ? "No hay productos cargados en el DBX para ese estilo-color. Súbelos primero con el Avery en Validación QR."
            : null,
      });
    } catch (e) {
      set({
        buscando: false,
        error: e.response?.data?.message || "Error al buscar productos",
      });
    }
  };

  const toggleExcluido = (sku) => {
    const excluidos = new Set(bloque.excluidos);
    if (excluidos.has(sku)) excluidos.delete(sku);
    else excluidos.add(sku);
    set({ excluidos });
  };

  const incluidos = productosIncluidos(bloque);

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-800">Bloque {numero}</h3>
        <button
          onClick={onQuitar}
          className="text-gray-400 hover:text-red-500 transition-colors"
          title="Quitar bloque"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <label className="text-sm text-gray-600 flex-1 min-w-56">
          Estilo-Color
          <input
            value={bloque.entrada}
            onChange={(e) => set({ entrada: e.target.value })}
            onKeyDown={(e) => e.key === "Enter" && buscar()}
            placeholder="Ej. 10001-214"
            className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </label>
        <Button size="sm" onClick={buscar} isLoading={bloque.buscando} className="mb-0.5">
          <Search className="w-4 h-4 mr-1.5" /> Buscar tallas
        </Button>
      </div>

      {bloque.error && (
        <p className="text-sm text-red-600 flex items-center gap-1.5">
          <AlertCircle className="w-4 h-4" /> {bloque.error}
        </p>
      )}

      {bloque.productos.length > 0 && (
        <>
          <SliderTallas
            tallas={bloque.productos.map((p) => p.size)}
            rango={bloque.rango}
            onChange={(rango) => set({ rango })}
          />

          <div>
            <p className="text-xs text-gray-500 mb-1.5">
              {incluidos.length} tallas incluidas — también puedes desmarcar
              tallas individuales dentro del rango
            </p>
            <div className="flex flex-wrap gap-1.5">
              {bloque.productos.map((p, i) => {
                const enRango = i >= bloque.rango[0] && i <= bloque.rango[1];
                const activo = enRango && !bloque.excluidos.has(p.sku);
                return (
                  <button
                    key={p.sku}
                    onClick={() => enRango && toggleExcluido(p.sku)}
                    disabled={!enRango}
                    title={`${p.sku}${p.upc ? ` · UPC ${p.upc}` : " · SIN UPC"}`}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                      activo
                        ? p.upc
                          ? "bg-green-50 border-green-300 text-green-800"
                          : "bg-yellow-50 border-yellow-300 text-yellow-800"
                        : enRango
                          ? "bg-gray-50 border-gray-200 text-gray-400 line-through"
                          : "bg-gray-50 border-gray-100 text-gray-300"
                    }`}
                  >
                    {p.size}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <label className="text-sm text-gray-600">
              Unfin
              <select
                value={bloque.unfinId}
                onChange={(e) => set({ unfinId: e.target.value })}
                className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              >
                <option value="">Sin Unfin</option>
                {catalogos.unfin.map((u) => (
                  <option key={u.id} value={u.id} disabled={!u.codigo}>
                    {etiquetaSem(u)}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm text-gray-600">
              Strap
              <select
                value={bloque.strapId}
                onChange={(e) => set({ strapId: e.target.value })}
                className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              >
                <option value="">Sin Strap</option>
                {catalogos.strap.map((s) => (
                  <option key={s.id} value={s.id} disabled={!s.codigo}>
                    {etiquetaSem(s)}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm text-gray-600">
              Prefijo Unfin/Strap
              <select
                value={bloque.prefijo}
                onChange={(e) => set({ prefijo: e.target.value })}
                className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              >
                <option value="">Sin prefijo</option>
                <option value="A5">A5</option>
              </select>
            </label>
          </div>
        </>
      )}
    </div>
  );
}

// ── Página ────────────────────────────────────────────────────
export default function CargaArticulosPage() {
  const [catalogos, setCatalogos] = useState(null);
  const [errorCarga, setErrorCarga] = useState(null);
  const [bloques, setBloques] = useState(() => [nuevoBloque()]);
  const [descargando, setDescargando] = useState(false);

  useEffect(() => {
    api
      .get("/articulos-massive/catalogos")
      .then((res) => setCatalogos(res.data.data))
      .catch((e) =>
        setErrorCarga(e.response?.data?.message || "Error al cargar catálogos"),
      );
  }, []);

  const actualizarBloque = useCallback((b) => {
    setBloques((prev) => prev.map((x) => (x.id === b.id ? b : x)));
  }, []);

  const bloquesListos = useMemo(
    () =>
      bloques
        .map((b) => ({
          productos: productosIncluidos(b),
          unfinId: b.unfinId ? Number(b.unfinId) : null,
          strapId: b.strapId ? Number(b.strapId) : null,
          prefijo: b.prefijo,
        }))
        .filter((b) => b.productos.length > 0),
    [bloques],
  );

  const { filas, advertencias } = useMemo(() => {
    if (!catalogos || bloquesListos.length === 0)
      return { filas: [], advertencias: [] };
    return construirFilas(bloquesListos, catalogos);
  }, [bloquesListos, catalogos]);

  const totalFilas = filas.filter(Boolean).length;
  const errores = advertencias.filter((a) => a.nivel === "error");

  const onColorGuardado = (color) => {
    setCatalogos((prev) => ({
      ...prev,
      colores: [
        ...prev.colores.filter((c) => c.codigo !== color.codigo),
        color,
      ].sort((a, b) => a.codigo.localeCompare(b.codigo)),
    }));
  };

  const descargar = async () => {
    setDescargando(true);
    try {
      const ExcelJS = (await import("exceljs")).default;
      const { saveAs } = await import("file-saver");
      const wb = generarWorkbook(ExcelJS.Workbook, filas);
      const buf = await wb.xlsx.writeBuffer();
      saveAs(new Blob([buf]), nombreArchivo(bloquesListos, catalogos));
    } finally {
      setDescargando(false);
    }
  };

  if (errorCarga) {
    return (
      <div className="p-6">
        <p className="text-red-600 flex items-center gap-2">
          <AlertCircle className="w-5 h-5" /> {errorCarga}
        </p>
      </div>
    );
  }

  if (!catalogos) {
    return (
      <div className="p-6 flex items-center gap-2 text-gray-500">
        <Loader2 className="w-5 h-5 animate-spin" /> Cargando catálogos…
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-4">
      {/* Encabezado */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <FileSpreadsheet className="w-7 h-7 text-primary" />
            Carga Masiva de Artículos
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Genera el archivo ARTICLES MASSIVE LOAD (hoja "Articles") a partir
            de los productos ya cargados en el DBX. Las filas Unfin y Strap se
            generan automáticamente según el modelo que elijas en cada bloque.
          </p>
        </div>
        <Button
          onClick={descargar}
          isLoading={descargando}
          disabled={totalFilas === 0}
        >
          <Download className="w-4 h-4 mr-2" />
          Descargar ({totalFilas} filas)
        </Button>
      </div>

      {/* Bloques */}
      {bloques.map((b, i) => (
        <Bloque
          key={b.id}
          bloque={b}
          numero={i + 1}
          catalogos={catalogos}
          onChange={actualizarBloque}
          onQuitar={() =>
            setBloques((prev) =>
              prev.length > 1 ? prev.filter((x) => x.id !== b.id) : prev,
            )
          }
        />
      ))}
      <Button
        variant="outline"
        size="sm"
        onClick={() => setBloques((prev) => [...prev, nuevoBloque()])}
      >
        <Plus className="w-4 h-4 mr-1.5" /> Agregar bloque
      </Button>

      {/* Advertencias */}
      {advertencias.length > 0 && (
        <div
          className={`rounded-xl border p-4 ${errores.length ? "bg-red-50 border-red-200" : "bg-yellow-50 border-yellow-200"}`}
        >
          <h3 className="font-semibold text-gray-800 mb-1 flex items-center gap-2">
            <AlertTriangle
              className={`w-5 h-5 ${errores.length ? "text-red-500" : "text-yellow-500"}`}
            />
            Advertencias ({advertencias.length})
          </h3>
          <ul className="divide-y divide-gray-200/60">
            {advertencias.map((a, i) =>
              a.tipo === "color" ? (
                <AvisoColor key={`c-${a.color}`} aviso={a} onGuardado={onColorGuardado} />
              ) : (
                <li key={i} className="flex items-start gap-2 py-1.5 text-sm text-gray-700">
                  {a.nivel === "error" ? (
                    <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                  )}
                  {a.mensaje}
                </li>
              ),
            )}
          </ul>
        </div>
      )}

      {/* Vista previa */}
      {totalFilas > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
            <h3 className="font-semibold text-gray-800">Vista previa</h3>
            <span className="text-sm text-gray-500">{totalFilas} filas</span>
          </div>
          <div className="overflow-x-auto max-h-[28rem] overflow-y-auto">
            <table className="min-w-full text-xs">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  {COLUMNAS.map((c) => (
                    <th key={c} className="px-3 py-2 text-left font-semibold text-gray-600 whitespace-nowrap">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filas.map((f, i) =>
                  f === null ? null : (
                    <tr key={i} className="hover:bg-gray-50">
                      {f.map((v, j) => (
                        <td key={j} className="px-3 py-1.5 whitespace-nowrap text-gray-700">
                          {v}
                        </td>
                      ))}
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
