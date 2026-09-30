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
import { customerServiceService } from "../../services/customerService.service";

/**
 * Configuración de los archivos vigilados de Customer Service.
 *
 * Existe por una razón concreta: el nombre de los libros lleva el año dentro
 * ('KPI Customer Service 2026.xlsx') y cambia cada enero. Si el nombre viviera
 * en el código habría que desplegar para arrancar el año; aquí se edita y ya.
 *
 * ---------------------------------------------------------------------------
 * EL BOTÓN DE PROBAR NO CARGA NADA
 * ---------------------------------------------------------------------------
 * Solo revisa que el servidor alcance la ruta, y por eso pide permiso de
 * lectura y no de edición. Es lo que separa las tres cosas que se confunden
 * cuando algo falla: que falte el permiso al recurso compartido, que la carpeta
 * esté mal escrita, o que el archivo se llame distinto.
 */

const num = (n) =>
  n == null ? "—" : Number(n).toLocaleString("es-MX", { maximumFractionDigits: 0 });

const kb = (b) => (b == null ? "—" : `${Math.round(Number(b) / 1024)} KB`);

function Archivo({ config, onGuardado }) {
  const [carpeta, setCarpeta] = useState(config.carpeta);
  const [archivo, setArchivo] = useState(config.archivo);
  const [activo, setActivo] = useState(config.activo);
  const [guardando, setGuardando] = useState(false);
  const [probando, setProbando] = useState(false);
  const [prueba, setPrueba] = useState(null);
  const [aviso, setAviso] = useState(null);

  useEffect(() => {
    setCarpeta(config.carpeta);
    setArchivo(config.archivo);
    setActivo(config.activo);
  }, [config]);

  const cambiado =
    carpeta !== config.carpeta || archivo !== config.archivo || activo !== config.activo;

  const guardar = async () => {
    setGuardando(true);
    setAviso(null);
    setPrueba(null);
    try {
      await customerServiceService.guardarArchivo(config.clave, {
        carpeta,
        archivo,
        activo,
      });
      setAviso({ ok: true, texto: "Guardado. Se leerá en la siguiente revisión." });
      await onGuardado();
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
      setPrueba(await customerServiceService.probarArchivo(config.clave));
    } catch (e) {
      setPrueba({ ok: false, mensaje: e.response?.data?.message || e.message });
    } finally {
      setProbando(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-[#236093]/10 rounded-lg">
            <FileSpreadsheet className="w-5 h-5 text-[#236093]" />
          </div>
          <div>
            <h2 className="font-semibold text-gray-900">{config.nombre}</h2>
            <p className="text-xs text-gray-400">clave {config.clave}</p>
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
          <input
            type="checkbox"
            checked={activo}
            onChange={(e) => setActivo(e.target.checked)}
            className="rounded border-gray-300"
          />
          Vigilar este archivo
        </label>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <label className="text-xs text-gray-500">Carpeta</label>
          <input
            value={carpeta}
            onChange={(e) => setCarpeta(e.target.value)}
            spellCheck={false}
            className="mt-1 w-full text-sm font-mono border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#236093]/30"
          />
          {/* La letra de unidad es el error clásico: 'F:' solo existe dentro de
              la sesión de Windows de quien la mapeó, y el backend no la ve. */}
          {/^[A-Za-z]:/.test(carpeta) && (
            <p className="text-xs text-amber-600 mt-1 flex items-start gap-1">
              <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              Es una unidad mapeada. Esa letra solo existe en la sesión de quien la
              montó; el servidor no la ve. Usar la ruta completa
              (\\servidor\recurso\carpeta).
            </p>
          )}
        </div>
        <div>
          <label className="text-xs text-gray-500">Archivo</label>
          <input
            value={archivo}
            onChange={(e) => setArchivo(e.target.value)}
            spellCheck={false}
            className="mt-1 w-full text-sm font-mono border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#236093]/30"
          />
        </div>
      </div>

      {/* --- Cómo fue la última lectura --- */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm bg-gray-50 rounded-lg p-3">
        <div>
          <p className="text-xs text-gray-500">Renglones</p>
          <p className="font-medium text-gray-800">{num(config.filas)}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Tamaño</p>
          <p className="font-medium text-gray-800">{kb(config.tamano_bytes)}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Guardado por el área</p>
          <p className="font-medium text-gray-800">{config.modificado_texto || "—"}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Leído por el sistema</p>
          <p className="font-medium text-gray-800">{config.leido_texto || "—"}</p>
        </div>
      </div>

      {config.ultimo_error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <div>
            <p>{config.ultimo_error}</p>
            <p className="text-xs text-red-500 mt-0.5">{config.error_texto}</p>
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
              <p className="text-xs opacity-70 font-mono mt-0.5">{prueba.ruta}</p>
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
          {guardando ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          Guardar
        </button>
        <button
          onClick={probar}
          disabled={probando}
          className="flex items-center gap-2 px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
        >
          {probando ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <PlugZap className="w-4 h-4" />
          )}
          Probar la ruta
        </button>
      </div>
    </div>
  );
}

export default function ArchivosCustomerServicePage() {
  const [estado, setEstado] = useState(null);
  const [error, setError] = useState(null);
  const [sincronizando, setSincronizando] = useState(false);
  const [resultado, setResultado] = useState(null);

  const cargar = async () => {
    try {
      setEstado(await customerServiceService.getArchivos());
    } catch (e) {
      setError(e.response?.data?.message || e.message);
    }
  };

  useEffect(() => {
    cargar();
  }, []);

  const sincronizar = async (forzar) => {
    setSincronizando(true);
    setResultado(null);
    try {
      const r = await customerServiceService.sincronizar({ forzar });
      setEstado(r.estado);
      setResultado({ ok: true, texto: r.mensaje, detalle: r.resultado });
    } catch (e) {
      setResultado({ ok: false, texto: e.response?.data?.message || e.message });
    } finally {
      setSincronizando(false);
    }
  };

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 text-red-700 p-4 rounded-xl">{error}</div>
      </div>
    );
  }
  if (!estado) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-5 max-w-5xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-[#236093]/10 rounded-lg">
            <FolderCog className="w-6 h-6 text-[#236093]" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">
              Archivos de Customer Service
            </h1>
            <p className="text-sm text-gray-500">
              De dónde sale el dato del reporte
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => sincronizar(false)}
            disabled={sincronizando}
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
            disabled={sincronizando}
            title="Vuelve a procesar el archivo aunque no haya cambiado"
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            Releer de todas formas
          </button>
        </div>
      </div>

      {/* --- Cómo funciona. Va arriba porque no es obvio: este es el único
              reporte del sistema donde nadie sube nada. --- */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-900">
        <p className="flex items-start gap-2">
          <Clock className="w-4 h-4 mt-0.5 shrink-0" />
          <span>
            El servidor revisa esta carpeta cada {estado.cadaMinutos} minutos y compara
            el contenido de los archivos, no su fecha. Si nadie guardó nada, no hace
            nada; abrir el Excel y cerrarlo sin guardar no cuenta como cambio. Hoy hay{" "}
            <b>{num(estado.conteos.kpi)}</b> renglones de indicadores y{" "}
            <b>{num(estado.conteos.muestras)}</b> de muestras.
          </span>
        </p>
      </div>

      {resultado && (
        <div
          className={`rounded-xl p-4 text-sm ${
            resultado.ok
              ? "bg-green-50 border border-green-200 text-green-800"
              : "bg-red-50 border border-red-200 text-red-700"
          }`}
        >
          <p className="font-medium">{resultado.texto}</p>
          {resultado.detalle?.map((r) => (
            <p key={r.clave} className="text-xs mt-1 opacity-80">
              {r.clave}:{" "}
              {r.omitido
                ? r.motivo
                : !r.ok
                  ? r.mensaje
                  : r.sinCambios
                    ? "sin cambios"
                    : `${num(r.guardadas)} renglones en ${(r.duracionMs / 1000).toFixed(1)} s`}
            </p>
          ))}
        </div>
      )}

      {estado.archivos.map((a) => (
        <Archivo key={a.clave} config={a} onGuardado={cargar} />
      ))}

      {/* --- Bitácora --- */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <h2 className="font-semibold text-gray-900">Últimas revisiones</h2>
        <p className="text-xs text-gray-400 mt-0.5">
          Las que dicen "sin cambios" son las vueltas en que el archivo estaba igual.
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b border-gray-100">
                <th className="py-2 font-medium">Cuándo</th>
                <th className="py-2 font-medium">Archivo</th>
                <th className="py-2 font-medium">Resultado</th>
                <th className="py-2 font-medium text-right">Renglones</th>
                <th className="py-2 font-medium text-right">Duración</th>
              </tr>
            </thead>
            <tbody>
              {estado.corridas.map((c) => (
                <tr key={c.id} className="border-b border-gray-50 last:border-0">
                  <td className="py-2 text-gray-600 whitespace-nowrap">{c.iniciada_texto}</td>
                  <td className="py-2 text-gray-500">{c.clave}</td>
                  <td className="py-2">
                    {!c.exito ? (
                      <span className="text-red-600">{c.mensaje || "Falló"}</span>
                    ) : c.hubo_cambio ? (
                      <span className="text-green-700">Actualizado</span>
                    ) : (
                      <span className="text-gray-400">Sin cambios</span>
                    )}
                  </td>
                  <td className="py-2 text-right text-gray-600">
                    {c.hubo_cambio ? num(c.filas_cargadas) : "—"}
                  </td>
                  <td className="py-2 text-right text-gray-400">
                    {c.duracion_ms == null ? "—" : `${(c.duracion_ms / 1000).toFixed(1)} s`}
                  </td>
                </tr>
              ))}
              {estado.corridas.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-gray-400">
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
