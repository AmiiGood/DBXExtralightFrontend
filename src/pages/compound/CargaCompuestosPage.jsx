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
import { compoundService } from "../../services/compound.service";

/**
 * Carga de los Excel de Compuestos.
 *
 * Acepta los dos archivos del área en la misma pantalla:
 *   'Producción Diaria ... .xlsx'  (hoja "Producción compuestos")
 *   'Powder recovery.xlsx'         (hoja "Powder recovery")
 *
 * El usuario no elige a dónde va: el servidor lo decide por las hojas que trae
 * el archivo. Así no hay forma de mandar la producción a la tabla de polvo.
 *
 * Mismo flujo en dos pasos que Inyección: primero se revisa qué trae y solo si
 * se aprueba se escribe. La carga reemplaza el rango de fechas del archivo,
 * pero solo lo que vino de una carga anterior.
 */

const num = (n) =>
  n == null ? "—" : Number(n).toLocaleString("es-MX", { maximumFractionDigits: 0 });

const NOMBRE_DESTINO = {
  PRODUCCION: "Producción diaria",
  RECUPERACION: "Recuperación de polvo",
};

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

export default function CargaCompuestosPage() {
  const [archivo, setArchivo] = useState(null);
  const [analisis, setAnalisis] = useState(null);
  const [historial, setHistorial] = useState([]);
  const [ocupado, setOcupado] = useState(null);
  const [aviso, setAviso] = useState(null);
  const [arrastrando, setArrastrando] = useState(false);
  const inputRef = useRef(null);

  const cargarHistorial = useCallback(() => {
    compoundService
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
      setAnalisis(await compoundService.analizarCarga(archivo));
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
      const r = await compoundService.importarCarga(archivo);
      setAviso({
        tipo: "ok",
        texto:
          `${NOMBRE_DESTINO[r.destino] || r.destino}: cargados ${num(r.insertadas)} renglones ` +
          `del ${r.fechaMin} al ${r.fechaMax}` +
          (r.borradas ? `, reemplazando ${num(r.borradas)} de una carga anterior` : "") +
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
  const esProduccion = a?.destino === "PRODUCCION";

  return (
    <div className="space-y-5">
      <div>
        <Link
          to="/compound/reportes"
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
            <h1 className="text-2xl font-bold text-gray-900">Carga de Compuestos</h1>
            <p className="text-sm text-gray-500">
              Sube el Excel de producción diaria o el de recuperación de polvo
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
          accept=".xlsx,.xlsm"
          onChange={(e) => elegir(e.target.files?.[0])}
          className="hidden"
          id="archivo-compuestos"
        />
        {archivo ? (
          <div className="flex items-center justify-center gap-3">
            <FileSpreadsheet className="w-8 h-8 text-secondary" />
            <div className="text-left">
              <p className="font-medium text-gray-900">{archivo.name}</p>
              <p className="text-xs text-gray-400">
                {(archivo.size / 1024).toFixed(0)} KB
              </p>
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
                htmlFor="archivo-compuestos"
                className="text-primary font-medium cursor-pointer hover:underline"
              >
                búscalo en tu equipo
              </label>
            </p>
            <p className="text-xs text-gray-400 mt-1">
              Debe traer la hoja "Producción compuestos" o "Powder recovery"
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
          <div>
            <h3 className="font-semibold text-gray-900">Esto es lo que trae el archivo</h3>
            <p className="text-xs text-gray-400 mt-0.5">
              Se detectó como <strong>{NOMBRE_DESTINO[a.destino] || a.destino}</strong>
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Dato etiqueta="Renglones" valor={num(a.filas)} />
            <Dato etiqueta="Periodo" valor={`${a.fechaMin} a ${a.fechaMax}`} />
            <Dato etiqueta="Producción" valor={`${num(a.produccionKg)} kg`} />
            {esProduccion ? (
              <Dato
                etiqueta="Tiempo muerto"
                valor={
                  a.turnoHoras
                    ? `${num(a.tiempoMuerto)} h (${((a.tiempoMuerto / a.turnoHoras) * 100).toFixed(1)}%)`
                    : "—"
                }
              />
            ) : (
              <Dato
                etiqueta="Polvo usado"
                valor={
                  a.produccionKg
                    ? `${num(a.polvoKg)} kg (${((a.polvoKg / a.produccionKg) * 100).toFixed(2)}%)`
                    : "—"
                }
              />
            )}
          </div>

          <p className="text-sm text-gray-600">
            {esProduccion
              ? `Líneas: ${(a.lineas || []).join(", ")}`
              : `Unidades de negocio: ${(a.bus || []).join(", ")}`}
          </p>

          {a.seReemplazan > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
              Ya hay <strong>{num(a.seReemplazan)}</strong> renglones cargados en ese
              periodo. Se van a reemplazar por los del archivo.
            </div>
          )}

          {a.avisos?.length > 0 && (
            <div className="text-sm">
              <p className="font-medium text-amber-700 mb-1">A revisar</p>
              <ul className="text-amber-600 list-disc list-inside space-y-0.5">
                {a.avisos.map((t, i) => (
                  <li key={i}>{t}</li>
                ))}
              </ul>
            </div>
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
              disabled={ocupado === "importar"}
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
                  Cargar a la base
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
                  {["Fecha", "Archivo", "Tipo", "Periodo", "Renglones", "Usuario"].map((h) => (
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
                    <td className="px-4 py-2 text-gray-500">
                      {NOMBRE_DESTINO[c.destino] || c.destino}
                    </td>
                    <td className="px-4 py-2 text-gray-500 whitespace-nowrap">
                      {c.fecha_min ? `${c.fecha_min} a ${c.fecha_max}` : "—"}
                    </td>
                    <td className="px-4 py-2 text-gray-900">{num(c.filas_cargadas)}</td>
                    <td className="px-4 py-2 text-gray-500">
                      {/* Las cargas iniciales se hicieron desde la terminal */}
                      {c.usuario || "Script"}
                    </td>
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
