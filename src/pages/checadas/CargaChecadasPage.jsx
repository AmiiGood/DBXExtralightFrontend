import { useState, useEffect, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  History,
  X,
  ArrowLeft,
} from "lucide-react";
import { checadasService } from "../../services/checadas.service";

/**
 * Carga del reporte "Transacciones" de Hikvision.
 *
 * Se sube después de cada cambio de turno (pasadas las 8:20, las 16:20 y las
 * 00:20). Mismo flujo en dos pasos que Compound: primero se revisa qué trae y
 * después se carga.
 *
 * No reemplaza nada: una checada que ya estaba se ignora. Si RH sube dos
 * ventanas que se enciman, o el mismo archivo dos veces, no se duplica.
 */

const num = (n) =>
  n == null ? "—" : Number(n).toLocaleString("es-MX", { maximumFractionDigits: 0 });

function Dato({ etiqueta, valor, resaltar }) {
  return (
    <div>
      <p className="text-xs text-gray-500">{etiqueta}</p>
      <p className={`text-lg font-semibold ${resaltar ? "text-amber-600" : "text-gray-900"}`}>
        {valor}
      </p>
    </div>
  );
}

export default function CargaChecadasPage() {
  const [archivo, setArchivo] = useState(null);
  const [analisis, setAnalisis] = useState(null);
  const [historial, setHistorial] = useState([]);
  const [ocupado, setOcupado] = useState(null);
  const [aviso, setAviso] = useState(null);
  const [arrastrando, setArrastrando] = useState(false);
  const inputRef = useRef(null);

  const cargarHistorial = useCallback(() => {
    checadasService
      .getHistorialCargas()
      .then((h) => setHistorial(Array.isArray(h) ? h : []))
      .catch(() => setHistorial([]));
  }, []);

  useEffect(cargarHistorial, [cargarHistorial]);

  const reiniciar = () => {
    setArchivo(null);
    setAnalisis(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const elegir = (f) => {
    if (!f) return;
    setArchivo(f);
    setAnalisis(null);
    setAviso(null);
  };

  const analizar = async () => {
    if (!archivo) return;
    setOcupado("analizar");
    setAviso(null);
    try {
      setAnalisis(await checadasService.analizarCarga(archivo));
    } catch (e) {
      setAviso({ tipo: "error", texto: e.response?.data?.message || e.message });
    } finally {
      setOcupado(null);
    }
  };

  const importar = async () => {
    setOcupado("importar");
    setAviso(null);
    try {
      const r = await checadasService.importarCarga(archivo);
      setAviso({
        tipo: "ok",
        texto:
          `Cargadas ${num(r.nuevas)} checadas del ${r.periodoDesde}` +
          (r.periodoHasta !== r.periodoDesde ? ` al ${r.periodoHasta}` : "") +
          (r.yaCargadas ? `; ${num(r.yaCargadas)} ya estaban y no se duplicaron` : "") +
          ".",
      });
      reiniciar();
      cargarHistorial();
    } catch (e) {
      setAviso({ tipo: "error", texto: e.response?.data?.message || e.message });
    } finally {
      setOcupado(null);
    }
  };

  const soltar = (e) => {
    e.preventDefault();
    setArrastrando(false);
    elegir(e.dataTransfer.files?.[0]);
  };

  const a = analisis;

  return (
    <div className="space-y-5">
      <div>
        <Link
          to="/checadas/reportes"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-primary mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver al reporte
        </Link>
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center">
            <Upload className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Carga de Checadas</h1>
            <p className="text-sm text-gray-500">
              Sube el reporte de Transacciones que descargas de Hikvision
            </p>
          </div>
        </div>
      </div>

      {aviso && (
        <div
          className={`rounded-xl p-3 text-sm flex items-start gap-2 border ${
            aviso.tipo === "ok"
              ? "bg-green-50 border-green-200 text-green-700"
              : "bg-red-50 border-red-200 text-red-700"
          }`}
        >
          {aviso.tipo === "ok" ? (
            <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          )}
          <p>{aviso.texto}</p>
        </div>
      )}

      {/* Zona de archivo */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setArrastrando(true);
        }}
        onDragLeave={() => setArrastrando(false)}
        onDrop={soltar}
        className={`bg-white rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
          arrastrando ? "border-primary bg-primary/5" : "border-gray-200"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls"
          onChange={(e) => elegir(e.target.files?.[0])}
          className="hidden"
          id="archivo-checadas"
        />
        {archivo ? (
          <div className="flex items-center justify-center gap-3">
            <FileSpreadsheet className="w-8 h-8 text-secondary" />
            <div className="text-left">
              <p className="font-medium text-gray-900">{archivo.name}</p>
              <p className="text-xs text-gray-400">{(archivo.size / 1024).toFixed(0)} KB</p>
            </div>
            <button onClick={reiniciar} className="p-1 text-gray-300 hover:text-red-500">
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <>
            <FileSpreadsheet className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-600">
              Arrastra aquí el archivo o{" "}
              <label
                htmlFor="archivo-checadas"
                className="text-primary font-medium cursor-pointer hover:underline"
              >
                búscalo en tu equipo
              </label>
            </p>
            <p className="text-xs text-gray-400 mt-1">
              El Excel "Transacciones" que exporta Hikvision, de uno o varios días
            </p>
          </>
        )}

        {archivo && !analisis && (
          <button
            onClick={analizar}
            disabled={ocupado === "analizar"}
            className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-lg font-medium hover:bg-primary-dark disabled:opacity-40"
          >
            {ocupado === "analizar" ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Leyendo el archivo...
              </>
            ) : (
              "Revisar contenido"
            )}
          </button>
        )}
      </div>

      {/* Resultado del análisis */}
      {a && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 space-y-5">
          <h3 className="font-semibold text-gray-900">Esto es lo que trae el archivo</h3>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Dato etiqueta="Checadas" valor={num(a.checadas)} />
            <Dato etiqueta="Personas" valor={num(a.personas)} />
            <Dato
              etiqueta="Periodo"
              valor={a.periodoDesde === a.periodoHasta ? a.periodoDesde : `${a.periodoDesde} a ${a.periodoHasta}`}
            />
            <Dato etiqueta="Horario" valor={a.horaMin ? `${a.horaMin} a ${a.horaMax}` : "—"} />
          </div>

          {a.yaCargadas > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
              <strong>{num(a.yaCargadas)}</strong> de estas checadas ya estaban cargadas y no
              se van a duplicar. Se agregan <strong>{num(a.nuevas)}</strong> nuevas.
            </div>
          )}

          {a.avisos?.length > 0 && (
            <ul className="text-sm text-gray-500 list-disc list-inside space-y-0.5">
              {a.avisos.map((t, i) => (
                <li key={i}>{t}</li>
              ))}
            </ul>
          )}

          <div className="flex items-center justify-end gap-3 pt-2 border-t border-gray-100">
            <button
              onClick={reiniciar}
              className="px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
            >
              Cancelar
            </button>
            <button
              onClick={importar}
              disabled={ocupado === "importar" || a.nuevas === 0}
              className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-lg font-medium hover:bg-primary-dark disabled:opacity-40"
            >
              {ocupado === "importar" ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Cargando...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  {a.nuevas === 0 ? "No hay checadas nuevas" : "Cargar a la base"}
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Historial */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="flex items-center gap-2 px-5 py-3 border-b border-gray-100">
          <History className="w-4 h-4 text-gray-400" />
          <h3 className="font-semibold text-gray-900">Cargas anteriores</h3>
        </div>
        {historial.length === 0 ? (
          <p className="p-6 text-center text-sm text-gray-400">Sin cargas todavía</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {["Fecha", "Archivo", "Periodo", "Nuevas", "Ya estaban", "Usuario"].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-2 text-left text-[11px] font-semibold text-gray-500 uppercase"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {historial.map((c) => (
                  <tr key={c.id}>
                    <td className="px-4 py-2 text-gray-500 whitespace-nowrap">{c.creado_texto}</td>
                    <td className="px-4 py-2 text-gray-900">{c.archivo || "—"}</td>
                    <td className="px-4 py-2 text-gray-500 whitespace-nowrap">
                      {c.periodo_desde
                        ? c.periodo_desde === c.periodo_hasta
                          ? c.periodo_desde
                          : `${c.periodo_desde} a ${c.periodo_hasta}`
                        : "—"}
                    </td>
                    <td className="px-4 py-2 text-gray-900">{num(c.filas_nuevas)}</td>
                    <td className="px-4 py-2 text-gray-500">{num(c.ya_cargadas)}</td>
                    <td className="px-4 py-2 text-gray-500">{c.usuario || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
