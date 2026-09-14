import { useState, useEffect, useCallback, useRef } from "react";
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  History,
  X,
} from "lucide-react";
import { inyeccionService } from "../../services/inyeccion.service";

/**
 * Carga del Excel de Producción Inyección.
 *
 * Flujo en dos pasos a propósito: primero se analiza el archivo y se muestra
 * qué trae, y solo si el usuario lo aprueba se escribe en la base. Cargar 300
 * mil filas sin ver antes qué son es demasiado fácil de lamentar.
 *
 * La carga reemplaza el rango de fechas del archivo, pero solo lo que cargó una
 * importación previa: lo capturado a mano nunca se borra.
 */

const num = (n) =>
  n == null ? "—" : Number(n).toLocaleString("es-MX", { maximumFractionDigits: 0 });

const fecha = (v) => (v ? String(v).slice(0, 10) : "—");

function Dato({ etiqueta, valor, resaltar }) {
  return (
    <div>
      <p className="text-xs text-gray-500">{etiqueta}</p>
      <p
        className={`text-lg font-semibold ${resaltar ? "text-amber-600" : "text-gray-900"}`}
      >
        {valor}
      </p>
    </div>
  );
}

export default function CargaProduccionPage() {
  const [archivo, setArchivo] = useState(null);
  const [analisis, setAnalisis] = useState(null);
  const [historial, setHistorial] = useState([]);
  const [ocupado, setOcupado] = useState(null);
  const [aviso, setAviso] = useState(null);
  const [arrastrando, setArrastrando] = useState(false);
  const inputRef = useRef(null);

  const cargarHistorial = useCallback(() => {
    inyeccionService
      .getHistorialCargas()
      .then(setHistorial)
      .catch(() => setHistorial([]));
  }, []);

  useEffect(cargarHistorial, [cargarHistorial]);

  const error = (e) =>
    setAviso({
      tipo: "error",
      texto: e.response?.data?.message || e.message,
      // 409 = ya hay datos en ese rango; se puede reintentar confirmando
      confirmable: e.response?.status === 409,
    });

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
      setAnalisis(await inyeccionService.analizarCarga(archivo));
    } catch (e) {
      error(e);
    } finally {
      setOcupado(null);
    }
  };

  const importar = async (reemplazar) => {
    setOcupado("importar");
    setAviso(null);
    try {
      const r = await inyeccionService.importarCarga(archivo, reemplazar);
      setAviso({
        tipo: "ok",
        texto:
          `Cargadas ${num(r.insertadas)} filas del ${fecha(r.fechaMin)} al ${fecha(r.fechaMax)}` +
          (r.reemplazados ? `, reemplazando ${num(r.reemplazados)} anteriores` : "") +
          (r.productosNuevos ? `. ${num(r.productosNuevos)} productos nuevos` : "") +
          `. Tardó ${(r.duracionMs / 1000).toFixed(0)}s.`,
      });
      setArchivo(null);
      setAnalisis(null);
      if (inputRef.current) inputRef.current.value = "";
      cargarHistorial();
    } catch (e) {
      error(e);
    } finally {
      setOcupado(null);
    }
  };

  const soltar = (e) => {
    e.preventDefault();
    setArrastrando(false);
    elegir(e.dataTransfer.files?.[0]);
  };

  const r = analisis?.resumen;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center">
          <Upload className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Carga de Producción</h1>
          <p className="text-sm text-gray-500">
            Sube el Excel de Producción Inyección para actualizar los reportes
          </p>
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
          <div>
            <p>{aviso.texto}</p>
            {aviso.confirmable && (
              <button
                onClick={() => importar(true)}
                disabled={ocupado === "importar"}
                className="mt-2 px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-medium hover:bg-red-700 disabled:opacity-40"
              >
                Reemplazar de todas formas
              </button>
            )}
          </div>
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
          id="archivo-produccion"
        />
        {archivo ? (
          <div className="flex items-center justify-center gap-3">
            <FileSpreadsheet className="w-8 h-8 text-secondary" />
            <div className="text-left">
              <p className="font-medium text-gray-900">{archivo.name}</p>
              <p className="text-xs text-gray-400">
                {(archivo.size / 1024 / 1024).toFixed(1)} MB
              </p>
            </div>
            <button
              onClick={() => {
                setArchivo(null);
                setAnalisis(null);
                if (inputRef.current) inputRef.current.value = "";
              }}
              className="p-1 text-gray-300 hover:text-red-500"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <>
            <FileSpreadsheet className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-600">
              Arrastra aquí el archivo o{" "}
              <label
                htmlFor="archivo-produccion"
                className="text-primary font-medium cursor-pointer hover:underline"
              >
                búscalo en tu equipo
              </label>
            </p>
            <p className="text-xs text-gray-400 mt-1">
              Debe ser .xlsx con la hoja "Producción"
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
      {analisis && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 space-y-5">
          <h3 className="font-semibold text-gray-900">Esto es lo que trae el archivo</h3>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Dato etiqueta="Filas a cargar" valor={num(analisis.filas)} />
            <Dato
              etiqueta="Periodo"
              valor={`${fecha(analisis.fechaMin)} a ${fecha(analisis.fechaMax)}`}
            />
            <Dato etiqueta="Productos distintos" valor={num(analisis.productos)} />
            <Dato
              etiqueta="De rezago"
              valor={num(r?.scrapPorModelo)}
            />
          </div>

          {/* Qué se va a reemplazar */}
          {analisis.yaCargado?.existentes > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
              <p className="font-medium">
                Ya hay {num(analisis.yaCargado.existentes)} registros en ese periodo
              </p>
              <p className="mt-1">
                Se reemplazarán los {num(analisis.yaCargado.importados)} que vinieron
                de una carga anterior.
                {analisis.yaCargado.capturados > 0 && (
                  <>
                    {" "}
                    Los {num(analisis.yaCargado.capturados)} capturados a mano{" "}
                    <strong>no se tocan</strong>, así que revisa que no estén
                    también en el Excel o quedarían contados dos veces.
                  </>
                )}
              </p>
            </div>
          )}

          {/* Cosas que el parser corrigió o descartó */}
          {r && (
            <div className="text-sm text-gray-600 space-y-1">
              {r.sinMaquina > 0 && (
                <p>· {num(r.sinMaquina)} filas vacías que se omiten</p>
              )}
              {r.tallaCorregida > 0 && (
                <p>
                  · {num(r.tallaCorregida)} tallas que Excel convirtió en fecha, se
                  reconstruyen
                </p>
              )}
              {r.produccionRecalculada > 0 && (
                <p>
                  · {num(r.produccionRecalculada)} filas sin producción pero con
                  contadores, se recalculan
                </p>
              )}
              {r.scrapNegativo > 0 && (
                <p>· {num(r.scrapNegativo)} ajustes de rezago con scrap negativo</p>
              )}
              {r.estacionNoReconocida > 0 && (
                <p className="text-amber-600">
                  · {num(r.estacionNoReconocida)} estaciones no reconocidas, quedan
                  sin estación
                </p>
              )}
            </div>
          )}

          {analisis.advertencias?.length > 0 && (
            <div className="text-sm">
              <p className="font-medium text-amber-700 mb-1">Advertencias</p>
              <ul className="text-amber-600 list-disc list-inside space-y-0.5">
                {analisis.advertencias.slice(0, 5).map((a, i) => (
                  <li key={i}>{a.mensaje}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Totales por BU */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-2 text-xs font-semibold text-gray-500 uppercase">
                    Unidad de negocio
                  </th>
                  <th className="text-right py-2 text-xs font-semibold text-gray-500 uppercase">
                    Filas
                  </th>
                  <th className="text-right py-2 text-xs font-semibold text-gray-500 uppercase">
                    Piezas
                  </th>
                  <th className="text-right py-2 text-xs font-semibold text-gray-500 uppercase">
                    Scrap
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {(analisis.porBu || []).map((b) => (
                  <tr key={b.bu}>
                    <td className="py-2 text-gray-900">{b.bu}</td>
                    <td className="py-2 text-right text-gray-500">{num(b.filas)}</td>
                    <td className="py-2 text-right text-gray-900">
                      {num(b.produccion)}
                    </td>
                    <td className="py-2 text-right text-gray-900">{num(b.scrap)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between gap-4 pt-2 border-t border-gray-100">
            <p className="text-xs text-gray-400">
              Cargar 300 mil filas tarda unos minutos. No cierres la pestaña.
            </p>
            <button
              onClick={() => importar(analisis.yaCargado?.importados > 0)}
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
                  {["Fecha", "Archivo", "Periodo", "Filas cargadas", "Usuario"].map(
                    (h) => (
                      <th
                        key={h}
                        className="px-4 py-2 text-left text-[11px] font-semibold text-gray-500 uppercase"
                      >
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {historial.map((c) => (
                  <tr key={c.id}>
                    <td className="px-4 py-2 text-gray-500 whitespace-nowrap">
                      {new Date(c.creado_en).toLocaleString("es-MX", {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </td>
                    <td className="px-4 py-2 text-gray-900">{c.nombre_archivo}</td>
                    <td className="px-4 py-2 text-gray-500">
                      {c.desde ? `${fecha(c.desde)} a ${fecha(c.hasta)}` : "—"}
                    </td>
                    <td className="px-4 py-2 text-gray-900">
                      {num(c.registros_nuevos)}
                    </td>
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
