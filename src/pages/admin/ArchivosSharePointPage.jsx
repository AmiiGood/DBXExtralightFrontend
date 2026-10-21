import { useState, useEffect } from "react";
import {
  Cloud,
  Loader2,
  RefreshCw,
  Save,
  PlugZap,
  CheckCircle2,
  AlertTriangle,
  FileSpreadsheet,
  Clock,
  KeyRound,
} from "lucide-react";
import { sharePointService } from "../../services/sharePoint.service";

/**
 * Archivos que el servidor lee solo de SharePoint.
 *
 * Los libros de Compound e Inyección viven en SharePoint y había que bajarlos
 * y subirlos a mano por la pantalla de carga. Aquí se dice en qué carpeta
 * están y cómo se llaman; el servidor los revisa y, cuando cambian, los carga
 * con el mismo importador de esa pantalla.
 *
 * La pantalla de carga manual sigue existiendo: sirve para un archivo que no
 * está en SharePoint o para cargar algo antes de que pase la revisión.
 *
 * ---------------------------------------------------------------------------
 * EL BOTÓN DE PROBAR NO CARGA NADA
 * ---------------------------------------------------------------------------
 * Solo pide los datos del archivo, y por eso basta el permiso de lectura. Es lo
 * que separa las cosas que se confunden cuando algo falla: que falten las
 * credenciales, que la app no tenga permiso al sitio, que la URL esté mal o
 * que el archivo se llame distinto (en ese caso dice qué hay en la carpeta).
 */

const num = (n) =>
  n == null ? "—" : Number(n).toLocaleString("es-MX", { maximumFractionDigits: 0 });

const mb = (b) => (b == null ? "—" : `${(Number(b) / 1048576).toFixed(1)} MB`);

function Archivo({ config, onGuardado, onLeer, ocupado }) {
  const [ubicacion, setUbicacion] = useState(config.ubicacion);
  const [archivo, setArchivo] = useState(config.archivo);
  const [activo, setActivo] = useState(config.activo);
  const [guardando, setGuardando] = useState(false);
  const [probando, setProbando] = useState(false);
  const [prueba, setPrueba] = useState(null);
  const [aviso, setAviso] = useState(null);

  useEffect(() => {
    setUbicacion(config.ubicacion);
    setArchivo(config.archivo);
    setActivo(config.activo);
  }, [config]);

  const cambiado =
    ubicacion !== config.ubicacion ||
    archivo !== config.archivo ||
    activo !== config.activo;

  const guardar = async () => {
    setGuardando(true);
    setAviso(null);
    setPrueba(null);
    try {
      await sharePointService.guardarArchivo(config.clave, { ubicacion, archivo, activo });
      setAviso({
        ok: true,
        texto: activo
          ? "Guardado. Se leerá en la siguiente revisión."
          : "Guardado. No se lee mientras esté apagado.",
      });
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
      setPrueba(await sharePointService.probarArchivo(config.clave));
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
            <p className="text-xs text-gray-400">
              va al reporte de {config.reporte || config.importador} · clave {config.clave}
            </p>
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
          <input
            type="checkbox"
            checked={activo}
            onChange={(e) => setActivo(e.target.checked)}
            className="rounded border-gray-300"
          />
          Leer este archivo solo
        </label>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <label className="text-xs text-gray-500">Carpeta en SharePoint (URL)</label>
          <input
            value={ubicacion}
            onChange={(e) => setUbicacion(e.target.value)}
            spellCheck={false}
            placeholder="https://finprojectspa.sharepoint.com/sites/…/Shared Documents/…"
            className="mt-1 w-full text-sm font-mono border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#236093]/30"
          />
          {/* El enlace de "Compartir" es el error típico: es un token que la
              app, con permiso solo a ciertos sitios, no puede resolver. */}
          {/\/:[a-z]:\//i.test(ubicacion) ? (
            <p className="text-xs text-amber-600 mt-1 flex items-start gap-1">
              <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              Es un enlace para compartir. Abrir la carpeta en el navegador y copiar la
              dirección de la barra.
            </p>
          ) : (
            <p className="text-xs text-gray-400 mt-1">
              Abrir la carpeta en el navegador y copiar la dirección de la barra.
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
          <p className="text-xs text-gray-500">Renglones cargados</p>
          <p className="font-medium text-gray-800">{num(config.filas)}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Tamaño</p>
          <p className="font-medium text-gray-800">{mb(config.tamano_bytes)}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Guardado en SharePoint</p>
          <p className="font-medium text-gray-800">{config.modificado_texto || "—"}</p>
          {config.modificado_por && (
            <p className="text-xs text-gray-400">{config.modificado_por}</p>
          )}
        </div>
        <div>
          <p className="text-xs text-gray-500">Leído por el sistema</p>
          <p className="font-medium text-gray-800">{config.leido_texto || "—"}</p>
        </div>
      </div>

      {config.resumen && !config.ultimo_error && (
        <p className="text-xs text-gray-500">Última carga: {config.resumen}</p>
      )}

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
            {prueba.ruta && <p className="text-xs opacity-70 mt-0.5">{prueba.ruta}</p>}
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
        <button
          onClick={() => onLeer(config.clave)}
          disabled={ocupado || cambiado || !config.ubicacion}
          title="Baja y carga este archivo ahora, aunque no haya cambiado"
          className="flex items-center gap-2 px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
        >
          <RefreshCw className="w-4 h-4" />
          Cargar ahora
        </button>
      </div>
    </div>
  );
}

export default function ArchivosSharePointPage() {
  const [estado, setEstado] = useState(null);
  const [error, setError] = useState(null);
  const [sincronizando, setSincronizando] = useState(false);
  const [resultado, setResultado] = useState(null);

  const cargar = async () => {
    try {
      setEstado(await sharePointService.getArchivos());
    } catch (e) {
      setError(e.response?.data?.message || e.message);
    }
  };

  useEffect(() => {
    cargar();
  }, []);

  const sincronizar = async ({ clave, forzar }) => {
    setSincronizando(true);
    setResultado(null);
    try {
      const r = await sharePointService.sincronizar({ clave, forzar });
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
            <Cloud className="w-6 h-6 text-[#236093]" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Archivos de SharePoint</h1>
            <p className="text-sm text-gray-500">
              Los libros que el sistema lee solo, sin subirlos a mano
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => sincronizar({ forzar: false })}
            disabled={sincronizando || !estado.configurado}
            className="flex items-center gap-2 px-3 py-1.5 text-sm bg-[#236093] text-white rounded-lg hover:bg-[#1c4d76] disabled:opacity-50"
          >
            {sincronizando ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            Revisar ahora
          </button>
        </div>
      </div>

      {!estado.configurado && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-900 flex items-start gap-2">
          <KeyRound className="w-4 h-4 mt-0.5 shrink-0" />
          <span>
            El servidor todavía no tiene credenciales para entrar a SharePoint. Falta
            registrar la aplicación en Azure y poner <code>SP_TENANT_ID</code>,{" "}
            <code>SP_CLIENT_ID</code> y <code>SP_CLIENT_SECRET</code> en el .env del
            backend. Los pasos están en DESPLIEGUE_SHAREPOINT.md.
          </span>
        </div>
      )}

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-900">
        <p className="flex items-start gap-2">
          <Clock className="w-4 h-4 mt-0.5 shrink-0" />
          <span>
            Cada {estado.cadaMinutos} minutos el servidor compara el contenido de cada
            archivo con el de la última lectura; si no cambió, no lo baja. Si alguien lo
            guardó hace menos de {estado.reposoMinutos} minutos, espera a que deje de
            cambiar para no cargar una captura a medias. Al cargarlo se reemplaza el
            rango de fechas que trae el archivo, igual que en la carga manual: lo
            capturado a mano no se toca.
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
                  : r.enEdicion
                    ? r.mensaje
                    : r.sinCambios
                      ? "sin cambios"
                      : `${r.resumen} en ${(r.duracionMs / 1000).toFixed(1)} s`}
            </p>
          ))}
        </div>
      )}

      {estado.archivos.map((a) => (
        <Archivo
          key={a.clave}
          config={a}
          onGuardado={cargar}
          onLeer={(clave) => sincronizar({ clave, forzar: true })}
          ocupado={sincronizando || !estado.configurado}
        />
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
                      <span className="text-green-700">Cargado</span>
                    ) : (
                      <span className="text-gray-400">{c.mensaje || "Sin cambios"}</span>
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
                    Todavía no se ha revisado SharePoint
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
