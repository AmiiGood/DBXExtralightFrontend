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
import { gastoQ4Service } from "../../services/gastoQ4.service";

/**
 * Carga del libro Budget Acumulado (gasto indispensable Q4 por área).
 *
 * Mismo flujo en dos pasos que Checadas: primero se revisa qué trae y después
 * se carga. A diferencia de Checadas, una carga nueva REEMPLAZA la anterior: es
 * un plan, no una bitácora, y dos versiones sumadas darían el doble.
 */

const pesos = (n) =>
  n == null ? "—" : `$${Number(n).toLocaleString("es-MX", { maximumFractionDigits: 0 })}`;
const num = (n) => (n == null ? "—" : Number(n).toLocaleString("es-MX"));

function Dato({ etiqueta, valor, detalle }) {
  return (
    <div>
      <p className="text-xs text-gray-500">{etiqueta}</p>
      <p className="text-lg font-semibold text-gray-900">{valor}</p>
      {detalle && <p className="text-xs text-gray-400">{detalle}</p>}
    </div>
  );
}

export default function CargaGastoQ4Page() {
  const [archivo, setArchivo] = useState(null);
  const [analisis, setAnalisis] = useState(null);
  const [historial, setHistorial] = useState([]);
  const [ocupado, setOcupado] = useState(null);
  const [aviso, setAviso] = useState(null);
  const [arrastrando, setArrastrando] = useState(false);
  const inputRef = useRef(null);

  const cargarHistorial = useCallback(() => {
    gastoQ4Service
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
      setAnalisis(await gastoQ4Service.analizarCarga(archivo));
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
      const r = await gastoQ4Service.importarCarga(archivo);
      setAviso({
        tipo: "ok",
        texto:
          `Cargados ${num(r.conceptos)} conceptos de ${r.areas} áreas por ${pesos(r.total)}` +
          (r.reemplazados ? `; reemplazaron a los ${num(r.reemplazados)} de la carga anterior` : "") +
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
  const bloqueado = a && (a.desconocidas.length > 0 || a.conceptos === 0);

  return (
    <div className="space-y-5">
      <div>
        <Link
          to="/gasto-q4/reportes"
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
            <h1 className="text-2xl font-bold text-gray-900">Carga de Gasto Q4</h1>
            <p className="text-sm text-gray-500">
              Sube el libro Budget Acumulado con lo que cada área necesita de octubre a diciembre
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
          id="archivo-gasto-q4"
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
                htmlFor="archivo-gasto-q4"
                className="text-primary font-medium cursor-pointer hover:underline"
              >
                búscalo en tu equipo
              </label>
            </p>
            <p className="text-xs text-gray-400 mt-1">
              Se lee la hoja del trimestre (Q42026): Departamento, Concepto, octubre, noviembre y
              diciembre
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
            <Dato etiqueta="Hoja" valor={a.hoja} detalle={`Año ${a.anio}`} />
            <Dato etiqueta="Conceptos" valor={num(a.conceptos)} />
            <Dato etiqueta="Áreas" valor={a.porArea.length} />
            <Dato
              etiqueta="Total de octubre a diciembre"
              valor={pesos(a.total)}
              detalle={
                a.cuadra == null
                  ? "El archivo no trae renglón de sumas"
                  : a.cuadra
                    ? "Cuadra con el renglón de sumas del archivo"
                    : `El renglón de sumas del archivo dice ${pesos(a.totalArchivo)}`
              }
            />
          </div>

          {a.desconocidas.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
              Estos departamentos no están en el catálogo de áreas:{" "}
              <strong>{a.desconocidas.join(", ")}</strong>. Corrige el nombre en el archivo o pide
              que se agreguen; mientras tanto no se puede cargar.
            </div>
          )}

          {a.cuadra === false && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
              Lo que se leyó suma {pesos(a.total)} y el renglón de sumas del archivo dice{" "}
              {pesos(a.totalArchivo)}. Revisa que la suma abarque todos los renglones.
            </div>
          )}

          {a.vigente && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
              Ya hay una carga: <strong>{a.vigente.archivo || "sin nombre"}</strong>, del{" "}
              {a.vigente.creado_texto}
              {a.vigente.usuario ? ` por ${a.vigente.usuario}` : ""} ({num(a.vigente.conceptos)}{" "}
              conceptos, {pesos(a.vigente.total)}). Si cargas este archivo, <strong>la reemplaza</strong>.
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b border-gray-100">
                  <th className="py-2 pr-3 font-medium">Área</th>
                  <th className="py-2 pr-3 font-medium text-right">Conceptos</th>
                  <th className="py-2 font-medium text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {a.porArea.map((r) => (
                  <tr key={r.clave} className="border-b border-gray-50 last:border-0">
                    <td className="py-1.5 pr-3 text-gray-800">{r.nombre}</td>
                    <td className="py-1.5 pr-3 text-right text-gray-600">{r.conceptos}</td>
                    <td className="py-1.5 text-right text-gray-900">{pesos(r.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {(a.repetidos.length > 0 || a.avisos.length > 0) && (
            <ul className="text-sm text-gray-500 list-disc list-inside space-y-0.5">
              {a.repetidos.map((r) => (
                <li key={`${r.area}-${r.concepto}`}>
                  {r.area} trae {r.veces} veces "{r.concepto}" con montos distintos; en el reporte
                  salen numerados.
                </li>
              ))}
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
              disabled={ocupado === "importar" || bloqueado}
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
                  {a.vigente ? "Reemplazar la carga anterior" : "Cargar a la base"}
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
                  {["Fecha", "Archivo", "Hoja", "Conceptos", "Total", "Usuario", ""].map((h) => (
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
                    <td className="px-4 py-2 text-gray-500">{c.hoja || "—"}</td>
                    <td className="px-4 py-2 text-gray-900">{num(c.conceptos)}</td>
                    <td className="px-4 py-2 text-gray-900 whitespace-nowrap">{pesos(c.total)}</td>
                    <td className="px-4 py-2 text-gray-500">{c.usuario || "—"}</td>
                    <td className="px-4 py-2">
                      {c.vigente ? (
                        <span className="text-xs font-medium text-green-700 bg-green-50 px-2 py-0.5 rounded-full">
                          Vigente
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">Reemplazada</span>
                      )}
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
