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
import { staffService } from "../../services/staff.service";

/**
 * Carga del Excel semanal de la junta de STAFF.
 *
 * Mismo flujo en dos pasos que Inyección y Compuestos: primero se revisa qué
 * trae el archivo y solo si se aprueba se escribe.
 *
 * Con una diferencia importante: aquí la carga NO borra por rango. El Excel
 * vuelve a traer todo el histórico cada semana, así que actualiza lo que
 * cambió y agrega lo nuevo. Un archivo recortado no puede borrar historia.
 *
 * Lo único que sí se reemplaza es la foto de PO abierta, y solo la de la
 * semana de corte que trae el archivo. Esa semana sale del NOMBRE
 * ('... WEEK 35.xlsx') porque por dentro el archivo no la dice en ningún lado;
 * si alguien lo renombró, se captura a mano aquí.
 */

const num = (n) =>
  n == null ? "—" : Number(n).toLocaleString("es-MX", { maximumFractionDigits: 0 });

const NOMBRE_BLOQUE = {
  INVOICE: "Facturación",
  INYECCION: "Inyección",
  ENSAMBLE: "Ensamble",
  ROTACION: "Rotación",
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

export default function CargaStaffPage() {
  const [archivo, setArchivo] = useState(null);
  const [analisis, setAnalisis] = useState(null);
  const [historial, setHistorial] = useState([]);
  const [ocupado, setOcupado] = useState(null);
  const [aviso, setAviso] = useState(null);
  const [arrastrando, setArrastrando] = useState(false);
  // Solo se usa cuando el nombre del archivo no trae la semana
  const [semana, setSemana] = useState("");
  const [anio, setAnio] = useState(String(new Date().getFullYear()));
  const inputRef = useRef(null);

  const cargarHistorial = useCallback(() => {
    staffService
      .getHistorialCargas()
      .then((h) => setHistorial(Array.isArray(h) ? h : []))
      .catch(() => setHistorial([]));
  }, []);

  useEffect(cargarHistorial, [cargarHistorial]);

  const reiniciar = () => {
    setArchivo(null);
    setAnalisis(null);
    setSemana("");
    if (inputRef.current) inputRef.current.value = "";
  };

  const elegir = (f) => {
    if (!f) return;
    setArchivo(f);
    setAnalisis(null);
    setAviso(null);
  };

  const corteManual = () =>
    semana ? { semana: Number(semana), anio: Number(anio) } : null;

  const analizar = async () => {
    if (!archivo) return;
    setOcupado("analizar");
    setAviso(null);
    try {
      const r = await staffService.analizarCarga(archivo, corteManual());
      setAnalisis(r);
      // Si el nombre del archivo ya traía la semana, se precarga por si hay
      // que corregirla antes de importar
      if (r.corte && !semana) {
        setSemana(String(r.corte.semana));
        setAnio(String(r.corte.anio));
      }
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
      const r = await staffService.importarCarga(archivo, corteManual());
      setAviso({
        tipo: "ok",
        texto:
          `Cargados ${num(r.valores)} valores en ${num(r.periodos)} periodos ` +
          `(${r.periodoMin} a ${r.periodoMax})` +
          (r.openPoFilas
            ? `, y la PO abierta del corte de la semana ${r.corte.semana} de ${r.corte.anio}`
            : "") +
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
          to="/staff/reportes"
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
            <h1 className="text-2xl font-bold text-gray-900">Carga de STAFF</h1>
            <p className="text-sm text-gray-500">
              Sube el Excel de la junta ("2026 CPC JUNTA DE STAFF WEEK NN.xlsx")
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
          id="archivo-staff"
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
                htmlFor="archivo-staff"
                className="text-primary font-medium cursor-pointer hover:underline"
              >
                búscalo en tu equipo
              </label>
            </p>
            <p className="text-xs text-gray-400 mt-1">
              Debe traer las hojas "Data Tracking" y "Compras"
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
              Todavía no se ha escrito nada en la base
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Dato etiqueta="Valores" valor={num(a.valores)} />
            <Dato etiqueta="Periodos" valor={`${num(a.periodos)} (${a.periodoMin} a ${a.periodoMax})`} />
            <Dato etiqueta="Años" valor={(a.anios || []).join(", ")} />
            <Dato etiqueta="PO abierta" valor={`${num(a.openPoFilas)} renglones`} />
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

          {/* Semana de corte: solo importa para la PO abierta */}
          <div className="bg-gray-50 border border-gray-100 rounded-lg p-4">
            <p className="text-sm font-medium text-gray-700 mb-1">
              Semana de corte de la PO abierta
            </p>
            <p className="text-xs text-gray-500 mb-3">
              La PO abierta es una foto que el Excel sobreescribe cada semana. Se
              archiva con esta semana para poder comparar después. Sale del nombre
              del archivo; corrígela si no es la correcta.
            </p>
            <div className="flex items-end gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Semana</label>
                <input
                  type="number"
                  min="1"
                  max="53"
                  value={semana}
                  onChange={(e) => setSemana(e.target.value)}
                  className="w-24 border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  placeholder="35"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Año</label>
                <input
                  type="number"
                  min="2021"
                  max="2100"
                  value={anio}
                  onChange={(e) => setAnio(e.target.value)}
                  className="w-28 border border-gray-200 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              {!semana && (
                <p className="text-xs text-amber-700 pb-2">
                  Sin semana no se carga la PO abierta; las demás series sí.
                </p>
              )}
            </div>
          </div>

          {a.yaCargados > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
              Ya hay <strong>{num(a.yaCargados)}</strong> valores cargados de esos
              periodos. Los que traiga el archivo se van a actualizar; lo que no
              mencione se queda como está.
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
                  {["Fecha", "Archivo", "Periodos", "Valores", "PO abierta", "Usuario"].map((h) => (
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
                      {c.periodo_min ? `${c.periodo_min} a ${c.periodo_max}` : "—"}
                    </td>
                    <td className="px-4 py-2 text-gray-900">{num(c.filas_cargadas)}</td>
                    <td className="px-4 py-2 text-gray-500 whitespace-nowrap">
                      {c.open_po_filas
                        ? `${num(c.open_po_filas)} · sem ${c.corte_semana}/${c.corte_anio}`
                        : "—"}
                    </td>
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
