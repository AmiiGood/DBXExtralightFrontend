import { useState, useEffect } from "react";
import {
  FolderCog,
  Loader2,
  RefreshCw,
  Save,
  PlugZap,
  CheckCircle2,
  AlertTriangle,
  FileSpreadsheet,
  Clock,
} from "lucide-react";
import { capexService } from "../../services/capex.service";

/**
 * De dónde sale el reporte de CAPEX.
 *
 * No se configura un archivo sino el PRINCIPIO de su nombre: el libro se
 * guarda como uno nuevo en cada revisión ('... Rev 04', 'Rev 05') y el servidor
 * toma solo el de la Rev más alta. Cuando sale una revisión nueva no hay que
 * tocar nada aquí.
 *
 * Lo que sí cambia al arrancar otro año es la hoja y el bloque (hoy 'Capex
 * update 2025-2026' y 'CAPEX 2026'). Por eso son editables y no constantes.
 *
 * El botón de probar no carga nada: dice qué libro elegiría y qué trae el
 * bloque, para ver el efecto de un cambio antes de que pase la revisión.
 */

const num = (n) =>
  n == null ? "—" : Number(n).toLocaleString("es-MX", { maximumFractionDigits: 0 });

const kb = (b) => (b == null ? "—" : `${Math.round(Number(b) / 1024)} KB`);

function Campo({ etiqueta, valor, onChange, ayuda, ancho }) {
  return (
    <div className={ancho}>
      <label className="text-xs text-gray-500">{etiqueta}</label>
      <input
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        spellCheck={false}
        className="mt-1 w-full text-sm font-mono border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#236093]/30"
      />
      {ayuda}
    </div>
  );
}

export default function ArchivoCapexPage() {
  const [estado, setEstado] = useState(null);
  const [form, setForm] = useState(null);
  const [error, setError] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [probando, setProbando] = useState(false);
  const [sincronizando, setSincronizando] = useState(false);
  const [prueba, setPrueba] = useState(null);
  const [aviso, setAviso] = useState(null);

  const aplicar = (e) => {
    setEstado(e);
    const c = e.config;
    setForm({
      carpeta: c.carpeta,
      patron: c.patron,
      hoja: c.hoja,
      bloque: c.bloque,
      activo: c.activo,
    });
  };

  const cargar = async () => {
    try {
      aplicar(await capexService.getArchivo());
    } catch (e) {
      setError(e.response?.data?.message || e.message);
    }
  };

  useEffect(() => {
    cargar();
  }, []);

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 text-red-700 p-4 rounded-xl">{error}</div>
      </div>
    );
  }
  if (!estado || !form) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  const c = estado.config;
  const cambiado = ["carpeta", "patron", "hoja", "bloque", "activo"].some(
    (k) => form[k] !== c[k],
  );
  const poner = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));

  const guardar = async () => {
    setGuardando(true);
    setAviso(null);
    setPrueba(null);
    try {
      await capexService.guardarArchivo(form);
      setAviso({ ok: true, texto: "Guardado. Se leerá en la siguiente revisión." });
      await cargar();
    } catch (e) {
      setAviso({ ok: false, texto: e.response?.data?.message || e.message });
    } finally {
      setGuardando(false);
    }
  };

  const probar = async () => {
    setProbando(true);
    setPrueba(null);
    try {
      setPrueba(await capexService.probarArchivo());
    } catch (e) {
      setPrueba({ ok: false, mensaje: e.response?.data?.message || e.message });
    } finally {
      setProbando(false);
    }
  };

  const sincronizar = async (forzar) => {
    setSincronizando(true);
    setAviso(null);
    try {
      const r = await capexService.sincronizar({ forzar });
      aplicar(r.estado);
      setAviso({ ok: r.resultado.ok !== false, texto: r.mensaje });
    } catch (e) {
      setAviso({ ok: false, texto: e.response?.data?.message || e.message });
    } finally {
      setSincronizando(false);
    }
  };

  return (
    <div className="p-6 space-y-5 max-w-5xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-[#236093]/10 rounded-lg">
            <FolderCog className="w-6 h-6 text-[#236093]" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Archivo de CAPEX</h1>
            <p className="text-sm text-gray-500">De dónde sale el dato del reporte</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => sincronizar(false)}
            disabled={sincronizando || cambiado}
            className="flex items-center gap-2 px-3 py-1.5 text-sm bg-[#236093] text-white rounded-lg hover:bg-[#1c4d76] disabled:opacity-50"
          >
            {sincronizando ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            Revisar ahora
          </button>
          <button
            onClick={() => sincronizar(true)}
            disabled={sincronizando || cambiado}
            title="Vuelve a procesar el libro aunque no haya cambiado"
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            Releer de todas formas
          </button>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-900">
        <p className="flex items-start gap-2">
          <Clock className="w-4 h-4 mt-0.5 shrink-0" />
          <span>
            Cada {estado.cadaMinutos} minutos el servidor busca en la carpeta los libros
            cuyo nombre empieza como se indica abajo, toma el de la <b>Rev más alta</b> y
            lo relee si cambió. Cuando el área guarda una revisión nueva no hay que hacer
            nada aquí. Del libro se lee solo el bloque indicado, sin los renglones
            ocultos.
          </span>
        </p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-[#236093]/10 rounded-lg">
              <FileSpreadsheet className="w-5 h-5 text-[#236093]" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-900">{c.nombre}</h2>
              <p className="text-xs text-gray-400">
                {c.archivo
                  ? `Último leído: ${c.archivo}`
                  : "Todavía no se ha leído ningún libro"}
              </p>
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
            <input
              type="checkbox"
              checked={form.activo}
              onChange={(e) => poner("activo")(e.target.checked)}
              className="rounded border-gray-300"
            />
            Vigilar la carpeta
          </label>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Campo
            etiqueta="Carpeta"
            valor={form.carpeta}
            onChange={poner("carpeta")}
            ancho="lg:col-span-2"
            ayuda={
              /^[A-Za-z]:/.test(form.carpeta) && (
                <p className="text-xs text-amber-600 mt-1 flex items-start gap-1">
                  <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  Es una unidad mapeada. Esa letra solo existe en la sesión de quien la
                  montó; el servidor no la ve. Usar la ruta completa
                  (\\servidor\recurso\carpeta). F: es \\172.16.101.124\AREAS.
                </p>
              )
            }
          />
          <Campo
            etiqueta="El nombre del libro empieza con"
            valor={form.patron}
            onChange={poner("patron")}
            ancho="lg:col-span-2"
          />
          <Campo etiqueta="Hoja" valor={form.hoja} onChange={poner("hoja")} />
          <Campo
            etiqueta="Bloque (título donde empieza)"
            valor={form.bloque}
            onChange={poner("bloque")}
          />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm bg-gray-50 rounded-lg p-3">
          <div>
            <p className="text-xs text-gray-500">Revisión</p>
            <p className="font-medium text-gray-800">{c.revision ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Renglones</p>
            <p className="font-medium text-gray-800">{num(c.filas)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Con firmas FOAM</p>
            <p className="font-medium text-gray-800">{num(c.aprobados)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Guardado por el área</p>
            <p className="font-medium text-gray-800">{c.modificado_texto || "—"}</p>
            <p className="text-xs text-gray-400">{kb(c.tamano_bytes)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Leído por el sistema</p>
            <p className="font-medium text-gray-800">{c.leido_texto || "—"}</p>
          </div>
        </div>

        {c.avisos && !c.ultimo_error && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
            <p className="font-medium">Avisos de la última lectura</p>
            {c.avisos.split(" | ").map((a) => (
              <p key={a} className="text-xs mt-1">
                {a}
              </p>
            ))}
          </div>
        )}

        {c.ultimo_error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            <div>
              <p>{c.ultimo_error}</p>
              <p className="text-xs text-red-500 mt-0.5">{c.error_texto}</p>
            </div>
          </div>
        )}

        {prueba && (
          <div
            className={`rounded-lg p-3 text-sm flex items-start gap-2 ${
              prueba.ok
                ? "bg-green-50 border border-green-200 text-green-800"
                : "bg-red-50 border border-red-200 text-red-700"
            }`}
          >
            {prueba.ok ? (
              <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            )}
            <div>
              <p>{prueba.mensaje}</p>
              {prueba.ruta && (
                <p className="text-xs opacity-70 font-mono mt-0.5 break-all">{prueba.ruta}</p>
              )}
            </div>
          </div>
        )}

        {aviso && (
          <div
            className={`rounded-lg p-3 text-sm ${
              aviso.ok
                ? "bg-green-50 border border-green-200 text-green-800"
                : "bg-red-50 border border-red-200 text-red-700"
            }`}
          >
            {aviso.texto}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <button
            onClick={guardar}
            disabled={!cambiado || guardando}
            className="flex items-center gap-2 px-3 py-1.5 text-sm bg-[#236093] text-white rounded-lg hover:bg-[#1c4d76] disabled:opacity-40"
          >
            {guardando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Guardar
          </button>
          <button
            onClick={probar}
            disabled={probando || cambiado}
            title={cambiado ? "Guardar primero: se prueba lo guardado" : undefined}
            className="flex items-center gap-2 px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            {probando ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <PlugZap className="w-4 h-4" />
            )}
            Probar
          </button>
        </div>
      </div>

      {/* --- Bitácora --- */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <h2 className="font-semibold text-gray-900">Últimas revisiones</h2>
        <p className="text-xs text-gray-400 mt-0.5">
          Las que dicen "sin cambios" son las vueltas en que el libro estaba igual.
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b border-gray-100">
                <th className="py-2 font-medium">Cuándo</th>
                <th className="py-2 font-medium">Rev</th>
                <th className="py-2 font-medium">Resultado</th>
                <th className="py-2 font-medium text-right">Renglones</th>
                <th className="py-2 font-medium text-right">Firmas FOAM</th>
                <th className="py-2 font-medium text-right">Duración</th>
              </tr>
            </thead>
            <tbody>
              {estado.corridas.map((r) => (
                <tr key={r.id} className="border-b border-gray-50 last:border-0">
                  <td className="py-2 text-gray-600 whitespace-nowrap">{r.iniciada_texto}</td>
                  <td className="py-2 text-gray-500">{r.revision ?? "—"}</td>
                  <td className="py-2">
                    {!r.exito ? (
                      <span className="text-red-600">{r.mensaje || "Falló"}</span>
                    ) : r.hubo_cambio ? (
                      <span className="text-green-700">Actualizado</span>
                    ) : (
                      <span className="text-gray-400">Sin cambios</span>
                    )}
                  </td>
                  <td className="py-2 text-right text-gray-600">
                    {r.hubo_cambio ? num(r.filas_cargadas) : "—"}
                  </td>
                  <td className="py-2 text-right text-gray-600">
                    {r.hubo_cambio ? num(r.aprobados) : "—"}
                  </td>
                  <td className="py-2 text-right text-gray-400">
                    {r.duracion_ms == null ? "—" : `${(r.duracion_ms / 1000).toFixed(1)} s`}
                  </td>
                </tr>
              ))}
              {estado.corridas.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-gray-400">
                    Todavía no se ha revisado la carpeta
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
