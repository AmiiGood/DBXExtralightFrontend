import { useState, useEffect, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import {
  Upload, FileSpreadsheet, CheckCircle2, AlertTriangle, Loader2, History, X, ArrowLeft,
} from "lucide-react";
import { resultadosService } from "../../services/resultados.service";

/**
 * Carga del Excel mensual de Resultados ('DATA-FCMX-AAAA Mes.xlsx').
 *
 * Mismo flujo en dos pasos que los demás módulos: primero se revisa qué trae
 * el archivo y solo si se aprueba se escribe.
 *
 * Dos cosas propias de este libro que la pantalla deja claras:
 *
 *   La carga NO borra por rango. El archivo vuelve a traer todo el histórico
 *   cada mes, así que actualiza lo que cambió y agrega lo nuevo. Aquí importa
 *   más que en ningún otro módulo: la historia arranca en 2020 y no existe en
 *   otro lado.
 *
 *   Tres hojas no se leen y eso NO es un error: 'Q.TY (Billed)', 'USD (Billed)'
 *   y 'TOTAL SCRAP' son re-acomodos de las demás. Se enseñan como tales para
 *   que nadie crea que la carga quedó incompleta.
 */

const num = (n) =>
  n == null ? "—" : Number(n).toLocaleString("es-MX", { maximumFractionDigits: 0 });

const NOMBRE_BLOQUE = {
  FACTURACION: "Facturación",
  CAPACIDAD: "Capacidad",
  CARGA: "Carga de PO",
  PERSONAL: "Personal",
  ENERGIA: "Energía",
  COMPOUND: "Compound",
  SCRAP: "Scrap",
  MARGEN: "Estado de resultados",
};

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

function Dato({ etiqueta, valor }) {
  return (
    <div>
      <p className="text-xs text-gray-500">{etiqueta}</p>
      <p className="text-lg font-semibold text-gray-900">{valor}</p>
    </div>
  );
}

export default function CargaResultadosPage() {
  const [archivo, setArchivo] = useState(null);
  const [analisis, setAnalisis] = useState(null);
  const [historial, setHistorial] = useState([]);
  const [ocupado, setOcupado] = useState(null);
  const [aviso, setAviso] = useState(null);
  const [arrastrando, setArrastrando] = useState(false);
  const inputRef = useRef(null);

  const cargarHistorial = useCallback(() => {
    resultadosService
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
      setAnalisis(await resultadosService.analizarCarga(archivo));
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
      const r = await resultadosService.importarCarga(archivo);
      setAviso({
        tipo: "ok",
        texto: `Cargados ${num(r.valores)} valores de ${r.anioMin} a ${r.anioMax}.`,
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
          to="/resultados/reportes"
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
            <h1 className="text-2xl font-bold text-gray-900">Carga de Resultados</h1>
            <p className="text-sm text-gray-500">
              Sube el Excel mensual ("DATA-FCMX-2026 Agosto.xlsx")
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
          id="archivo-resultados"
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
                htmlFor="archivo-resultados"
                className="text-primary font-medium cursor-pointer hover:underline"
              >
                búscalo en tu equipo
              </label>
            </p>
            <p className="text-xs text-gray-400 mt-1">
              El año y el mes salen del nombre del archivo, así que conviene no
              cambiárselo
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

      {a && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 space-y-5">
          <div>
            <h3 className="font-semibold text-gray-900">Esto es lo que trae el archivo</h3>
            <p className="text-xs text-gray-400 mt-0.5">
              Todavía no se ha escrito nada en la base
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Dato etiqueta="Valores" valor={num(a.valores)} />
            <Dato etiqueta="Años" valor={`${a.anioMin} a ${a.anioMax}`} />
            <Dato
              etiqueta="Corte"
              valor={
                a.corte?.mes ? `${MESES[a.corte.mes - 1]} ${a.corte.anio}` : String(a.corte?.anio ?? "—")
              }
            />
            <Dato etiqueta="Hojas leídas" valor={String(a.hojasLeidas?.length ?? 0)} />
          </div>

          <div className="flex flex-wrap gap-2">
            {Object.entries(a.porBloque || {}).map(([b, n]) => (
              <span
                key={b}
                className="px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600"
              >
                {NOMBRE_BLOQUE[b] || b}: {num(n)}
              </span>
            ))}
          </div>

          {a.hojasIgnoradas?.length > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
              No se leen <strong>{a.hojasIgnoradas.join(", ")}</strong>, y está bien:
              son re-acomodos de las otras hojas. "TOTAL SCRAP" es la suma exacta de
              las cuatro hojas de scrap, y las dos de "Billed" son "Fact acumulada"
              puesta de lado.
            </div>
          )}

          {a.yaCargados > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
              Ya hay <strong>{num(a.yaCargados)}</strong> valores cargados de esos años.
              Los que traiga el archivo se van a actualizar; lo que no mencione se
              queda como está.
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
                  {["Fecha", "Archivo", "Años", "Corte", "Valores", "Usuario"].map((h) => (
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
                      {c.anio_min ? `${c.anio_min} a ${c.anio_max}` : "—"}
                    </td>
                    <td className="px-4 py-2 text-gray-500 whitespace-nowrap">
                      {c.corte_mes ? `${MESES[c.corte_mes - 1]} ${c.corte_anio}` : c.corte_anio || "—"}
                    </td>
                    <td className="px-4 py-2 text-gray-900">{num(c.filas_cargadas)}</td>
                    <td className="px-4 py-2 text-gray-500">
                      {/* La carga inicial se hizo desde la terminal */}
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
