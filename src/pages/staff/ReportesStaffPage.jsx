import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Users, RotateCcw, Loader2, Download, Upload } from "lucide-react";
import { staffService } from "../../services/staff.service";
import { exportarReporteStaff } from "../../utils/exportarReporteStaff";
import { useAuthStore } from "../../stores/auth.store";

/**
 * Reportes de STAFF.
 *
 * Sustituye la presentación semanal 'Staff Meeting Week NN', cuyas gráficas son
 * capturas de pantalla pegadas del Excel. Va todo en una sola página y en el
 * mismo orden del deck —facturación, PO abierta, inyección, ensamble— para
 * poder recorrerla en la junta sin brincar entre pestañas. Al final se agrega
 * rotación de plantilla, que el Excel lleva al día y la presentación no
 * graficaba.
 *
 * La vista "junta" es la que arma alguien a mano cada lunes en el Excel: los
 * meses ya cerrados del año, las últimas semanas sueltas y al final el mes en
 * curso. Con el archivo de la semana 35 da Ene..Jul, semanas 32 a 35 y Agosto,
 * que es exactamente lo que traen las diapositivas.
 *
 * Los valores son los que captura STAFF y se muestran tal cual.
 */

/** Un color por unidad de negocio, igual en los cuatro bloques. */
const COLOR_SERIE = {
  CROCS: "#236093",
  SUELA: "#95b849",
  SOLE: "#95b849",
  ALMOHADA: "#c9761f",
  FOAM_CANADA: "#b0413e",
  "FOAM CANADA": "#b0413e",
  DUAL_COLOR: "#7c6bb0",
  "DUAL COLOR": "#7c6bb0",
  PLANTILLA: "#236093",
  BAJAS: "#b0413e",
  PCT_BAJAS: "#b0413e",
  PCT_AUSENTISMO: "#c9761f",
  PCT_ANTIGUEDAD: "#49a090",
  VARIANTES: "#7c6bb0",
  ADMINISTRACION: "#94a3b8",
  BUDGET: "#cbd5e1",
  TOTAL_FOAM: "#64748b",
};

const GRIS = "#94a3b8";

const color = (serie) => COLOR_SERIE[serie] || GRIS;

const num = (n) =>
  n == null ? "—" : Number(n).toLocaleString("es-MX", { maximumFractionDigits: 0 });
const pct = (n, d = 1) => (n == null ? "—" : `${(Number(n) * 100).toFixed(d)}%`);

/** Miles abreviados para los ejes: 1.2M / 340k. */
const corto = (n) => {
  const v = Number(n);
  if (!Number.isFinite(v)) return "";
  if (Math.abs(v) >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (Math.abs(v) >= 1000) return `${Math.round(v / 1000)}k`;
  return String(Math.round(v));
};

/** Formatea según la unidad de la métrica: los porcentajes vienen en fracción. */
const formatear = (valor, unidad) =>
  unidad === "PORCENTAJE" ? pct(valor) : num(valor);

function Tarjeta({ titulo, valor, detalle, color: c }) {
  return (
    <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-100">
      <p className="text-sm text-gray-500">{titulo}</p>
      <p className="text-2xl font-bold mt-1" style={{ color: c || "#1f2937" }}>
        {valor}
      </p>
      {detalle && <p className="text-xs text-gray-400 mt-1">{detalle}</p>}
    </div>
  );
}

const Select = ({ etiqueta, valor, onChange, children }) => (
  <div>
    <label className="block text-xs font-medium text-gray-500 mb-1">{etiqueta}</label>
    <select
      value={valor}
      onChange={(e) => onChange(e.target.value)}
      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
    >
      {children}
    </select>
  </div>
);

/** Cabecera de sección. data-grafica: el exportador busca ahí el SVG. */
const Seccion = ({ titulo, nota, children, grafica, acciones }) => (
  <div
    data-grafica={grafica}
    className="bg-white rounded-xl shadow-sm border border-gray-100 p-5"
  >
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 className="font-semibold text-gray-900">{titulo}</h2>
        {nota && <p className="text-xs text-gray-400 mt-0.5">{nota}</p>}
      </div>
      {acciones}
    </div>
    <div className="mt-4">{children}</div>
  </div>
);

/**
 * Gráfica de un bloque: una barra por serie y una línea punteada por su meta.
 *
 * Se dibuja a partir del catálogo que devuelve la API en vez de una lista fija:
 * agregar una BU al Excel no debería obligar a tocar esta pantalla.
 *
 * `seriesDerecha` manda esas series a un segundo eje. Hace falta en facturación,
 * donde Crocs factura medio millón de pares y las demás unidades cuarenta mil:
 * en un solo eje las tres chicas quedan pegadas al suelo y no se lee nada. La
 * presentación original resolvía lo mismo con dos ejes.
 */
function GraficaBloque({ datos, altura = 340, seriesDerecha = [] }) {
  const metricas = datos?.metricas || [];
  const esPorcentaje = metricas.length > 0 && metricas.every((m) => m.unidad === "PORCENTAJE");
  const hayDerecha = seriesDerecha.length > 0;
  const ladoDe = (m) => (seriesDerecha.includes(m.serie) ? "der" : "izq");

  if (!datos?.periodos?.length) {
    return <p className="text-sm text-gray-400 py-10 text-center">Sin datos en este periodo</p>;
  }

  const unidadDe = (nombre) => (metricas.find((m) => m.nombre === nombre) || {}).unidad;
  const formatoEje = esPorcentaje ? (v) => `${(v * 100).toFixed(0)}%` : corto;

  // Con un solo eje se usa igual el id "izq": así las series no tienen que
  // saber si hay segundo eje o no.
  return (
    <ResponsiveContainer width="100%" height={altura}>
      <ComposedChart data={datos.periodos} margin={{ top: 10, right: 10 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
        <XAxis dataKey="eje" tick={{ fontSize: 11 }} angle={-30} textAnchor="end" height={70} />
        <YAxis yAxisId="izq" tick={{ fontSize: 11 }} tickFormatter={formatoEje} />
        {hayDerecha && (
          <YAxis
            yAxisId="der"
            orientation="right"
            tick={{ fontSize: 11 }}
            tickFormatter={formatoEje}
          />
        )}
        <Tooltip formatter={(v, n) => formatear(v, unidadDe(n))} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        {metricas
          .filter((m) => !m.es_meta)
          .map((m) => (
            <Bar
              key={m.codigo}
              yAxisId={ladoDe(m)}
              dataKey={m.codigo}
              name={
                hayDerecha && ladoDe(m) === "der" ? `${m.nombre} (eje derecho)` : m.nombre
              }
              fill={color(m.serie)}
              radius={[3, 3, 0, 0]}
            />
          ))}
        {metricas
          .filter((m) => m.es_meta)
          .map((m) => (
            <Line
              key={m.codigo}
              yAxisId={ladoDe(m)}
              type="monotone"
              dataKey={m.codigo}
              name={m.nombre}
              stroke={color(m.serie)}
              strokeWidth={2}
              strokeDasharray="5 4"
              dot={false}
              // connectNulls: las metas se cargan por adelantado y las semanas
              // aún sin facturar dejan huecos que cortarían la línea
              connectNulls
            />
          ))}
      </ComposedChart>
    </ResponsiveContainer>
  );
}

/**
 * Tabla de promedio diario por trimestre (diapositivas 6 y 8 del deck).
 *
 * El promedio sale de los valores SEMANALES del trimestre. La tabla del deck se
 * arma a mano y no dice con qué corte, así que hay diferencias de hasta ~1% en
 * algunas celdas; aquí la definición es siempre la misma.
 */
function TablaTrimestres({ datos }) {
  const filas = (datos?.filas || []).filter((f) => !f.esMeta);
  if (!filas.length) {
    return <p className="text-sm text-gray-400 py-6 text-center">Sin datos del año</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-2 text-left text-[11px] font-semibold text-gray-500 uppercase">
              Unidad de negocio
            </th>
            {[1, 2, 3, 4].map((t) => (
              <th
                key={t}
                className="px-4 py-2 text-right text-[11px] font-semibold text-gray-500 uppercase"
              >
                Q{t}
              </th>
            ))}
            <th className="px-4 py-2 text-right text-[11px] font-semibold text-gray-500 uppercase">
              Promedio
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {filas.map((f) => (
            <tr key={f.codigo}>
              <td className="px-4 py-2">
                <span className="inline-flex items-center gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-sm"
                    style={{ background: color(f.serie) }}
                  />
                  <span className="text-gray-900">{f.nombre}</span>
                </span>
              </td>
              {[1, 2, 3, 4].map((t) => (
                <td key={t} className="px-4 py-2 text-right text-gray-600 tabular-nums">
                  {f.trimestres[t] ? num(f.trimestres[t].promedio) : "—"}
                </td>
              ))}
              <td className="px-4 py-2 text-right font-semibold text-gray-900 tabular-nums">
                {num(f.general)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function ReportesStaffPage() {
  const [filtrosDisp, setFiltrosDisp] = useState(null);
  const [anio, setAnio] = useState("");
  const [vista, setVista] = useState("junta");
  const [corte, setCorte] = useState(null);

  const [datos, setDatos] = useState(null);
  const [openPo, setOpenPo] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [exportando, setExportando] = useState(false);

  const usuario = useAuthStore((s) => s.user);
  const esAdmin = Boolean(usuario?.rol?.esAdmin);

  useEffect(() => {
    staffService
      .getFiltros()
      .then((f) => {
        setFiltrosDisp(f);
        // Por omisión el año más reciente con dato: es del que se habla
        if (f.anios?.length) setAnio(String(f.anios[0].anio));
      })
      .catch((e) => setError(e.response?.data?.message || e.message));
  }, []);

  useEffect(() => {
    if (!anio) return;
    setCargando(true);
    setError(null);

    Promise.all([
      staffService.getSerie("INVOICE", { anio, vista }),
      staffService.getSerie("INYECCION", { anio, vista }),
      staffService.getSerie("ENSAMBLE", { anio, vista }),
      staffService.getSerie("ROTACION", { anio, vista: vista === "junta" ? "semana" : vista }),
      staffService.getTrimestres("INYECCION", anio),
      staffService.getTrimestres("ENSAMBLE", anio),
    ])
      .then(([invoice, inyeccion, ensamble, rotacion, qInj, qAssy]) =>
        setDatos({ invoice, inyeccion, ensamble, rotacion, qInj, qAssy }),
      )
      .catch((e) => setError(e.response?.data?.message || e.message))
      .finally(() => setCargando(false));
  }, [anio, vista]);

  useEffect(() => {
    staffService
      .getOpenPo(corte)
      .then(setOpenPo)
      .catch((e) => setError(e.response?.data?.message || e.message));
  }, [corte]);

  const limpiar = () => {
    setVista("junta");
    setCorte(null);
    if (filtrosDisp?.anios?.length) setAnio(String(filtrosDisp.anios[0].anio));
  };

  const exportar = async () => {
    setExportando(true);
    setError(null);
    try {
      await exportarReporteStaff({
        datos,
        openPo,
        anio,
        vista,
        usuario: usuario?.nombreCompleto || usuario?.nombreUsuario,
      });
    } catch (e) {
      setError(`No se pudo generar el Excel: ${e.message}`);
    } finally {
      setExportando(false);
    }
  };

  /** Facturado contra meta del año, para las tarjetas de arriba. */
  const resumenFacturacion = useMemo(() => {
    // Solo los meses: en la vista 'junta' conviven meses y semanas, y como en
    // facturación el mes SÍ es la suma de sus semanas, sumar los dos contaría
    // dos veces lo mismo
    const meses = (datos?.invoice?.periodos || []).filter((p) => p.tipo === "MES");
    if (meses.length === 0) return null;
    const suma = (codigo) =>
      meses.reduce((a, p) => a + (p[codigo] ?? 0), 0);
    return {
      crocs: suma("inv_crocs"),
      crocsMeta: suma("inv_crocs_meta"),
      foam: suma("inv_foam_canada"),
      sole: suma("inv_sole"),
      dual: suma("inv_dual_color"),
      meses: meses.length,
    };
  }, [datos]);

  const cumplimiento =
    resumenFacturacion?.crocsMeta
      ? (resumenFacturacion.crocs / resumenFacturacion.crocsMeta) * 100
      : null;

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center">
            <Users className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">STAFF</h1>
            <p className="text-sm text-gray-500">
              Facturación, PO abierta, inyección, ensamble y rotación
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {esAdmin && (
            <Link
              to="/staff/carga"
              className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <Upload className="w-4 h-4" />
              Cargar Excel
            </Link>
          )}
          <button
            onClick={exportar}
            disabled={exportando || !datos}
            className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
            title="Descarga lo que está en pantalla, con las gráficas incluidas"
          >
            {exportando ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            Exportar
          </button>
          <button
            onClick={limpiar}
            className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            Limpiar
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 text-sm">
          {error}
        </div>
      )}

      {/* Filtros */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Select etiqueta="Año" valor={anio} onChange={setAnio}>
            {(filtrosDisp?.anios || []).map((a) => (
              <option key={a.anio} value={a.anio}>
                {a.anio}
              </option>
            ))}
          </Select>
          <Select etiqueta="Vista" valor={vista} onChange={setVista}>
            <option value="junta">Junta (meses + últimas semanas)</option>
            <option value="mes">Solo meses</option>
            <option value="semana">Solo semanas</option>
          </Select>
        </div>
        <p className="text-xs text-gray-400 mt-3">
          La vista de junta arma la misma selección que se prepara a mano en el
          Excel: los meses ya cerrados del año, las últimas cuatro semanas y el
          mes en curso.
        </p>
      </div>

      {cargando && !datos ? (
        <div className="flex items-center justify-center py-20 text-gray-400">
          <Loader2 className="w-6 h-6 animate-spin mr-2" />
          Cargando...
        </div>
      ) : (
        datos && (
          <>
            {/* Tarjetas de facturación */}
            {resumenFacturacion && (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <Tarjeta
                  titulo="Crocs facturado"
                  valor={num(resumenFacturacion.crocs)}
                  detalle={`${resumenFacturacion.meses} meses de ${anio}`}
                  color="#236093"
                />
                <Tarjeta
                  titulo="Cumplimiento Crocs"
                  valor={cumplimiento == null ? "—" : `${cumplimiento.toFixed(1)}%`}
                  detalle={`Meta ${num(resumenFacturacion.crocsMeta)}`}
                  color={cumplimiento >= 100 ? "#49a090" : "#c9761f"}
                />
                <Tarjeta
                  titulo="Foam Canada"
                  valor={num(resumenFacturacion.foam)}
                  detalle="Pares facturados"
                  color="#b0413e"
                />
                <Tarjeta
                  titulo="Sole"
                  valor={num(resumenFacturacion.sole)}
                  detalle={`Dual Color ${num(resumenFacturacion.dual)}`}
                  color="#95b849"
                />
              </div>
            )}

            {/* 1. Facturación */}
            <Seccion
              grafica="facturacion"
              titulo="Facturación FCMX"
              nota="Pares facturados por unidad de negocio. Línea punteada: la meta del periodo. Crocs va en el eje derecho, que es diez veces más grande que el de las demás."
            >
              <GraficaBloque
                datos={datos.invoice}
                altura={360}
                seriesDerecha={["CROCS"]}
              />
            </Seccion>

            {/* 2. PO abierta */}
            <Seccion
              grafica="openpo"
              titulo="PO abierta"
              nota={
                openPo?.corte
                  ? `Cartera al corte de la semana ${openPo.corte.semana} de ${openPo.corte.anio}, por mes de entrega comprometido.`
                  : "Cartera por mes de entrega comprometido."
              }
              acciones={
                (openPo?.cortes?.length || 0) > 1 && (
                  <select
                    value={
                      openPo?.corte ? `${openPo.corte.anio}-${openPo.corte.semana}` : ""
                    }
                    onChange={(e) => {
                      const [a, s] = e.target.value.split("-");
                      setCorte({ anio: Number(a), semana: Number(s) });
                    }}
                    className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm"
                  >
                    {openPo.cortes.map((c) => (
                      <option key={`${c.anio}-${c.semana}`} value={`${c.anio}-${c.semana}`}>
                        Semana {c.semana} de {c.anio}
                      </option>
                    ))}
                  </select>
                )
              }
            >
              {!openPo?.serie?.length ? (
                <p className="text-sm text-gray-400 py-10 text-center">
                  Todavía no hay ningún corte de PO abierta cargado
                </p>
              ) : (
                <>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
                    {openPo.totales.map((t) => (
                      <Tarjeta
                        key={t.bu}
                        titulo={t.bu}
                        valor={num(t.cantidad)}
                        // A propósito NO se compara contra la meta aquí: la meta
                        // de PO abierta es por mes de entrega, y sumar las de
                        // todos los meses da un número contra el que la cartera
                        // siempre va a salir corta. La comparación válida es mes
                        // a mes, y esa está en la gráfica de abajo.
                        detalle={`En ${
                          openPo.serie.filter((f) => f[t.bu] != null).length
                        } meses de entrega`}
                        color={color(t.bu)}
                      />
                    ))}
                  </div>
                  <ResponsiveContainer width="100%" height={340}>
                    <ComposedChart data={openPo.serie} margin={{ top: 10, right: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                      <XAxis
                        dataKey="entrega"
                        tick={{ fontSize: 11 }}
                        angle={-30}
                        textAnchor="end"
                        height={80}
                      />
                      {/* Crocs aparte: son medio millón de pares contra treinta
                          mil de las demás BU */}
                      <YAxis yAxisId="izq" tick={{ fontSize: 11 }} tickFormatter={corto} />
                      <YAxis
                        yAxisId="der"
                        orientation="right"
                        tick={{ fontSize: 11 }}
                        tickFormatter={corto}
                      />
                      <Tooltip formatter={(v) => num(v)} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      {openPo.bus.map((bu) => (
                        <Bar
                          key={bu}
                          yAxisId={bu === "CROCS" ? "der" : "izq"}
                          dataKey={bu}
                          name={bu === "CROCS" ? "CROCS (eje derecho)" : bu}
                          fill={color(bu)}
                          radius={[3, 3, 0, 0]}
                        />
                      ))}
                      {openPo.bus.map((bu) => (
                        <Line
                          key={`meta__${bu}`}
                          yAxisId={bu === "CROCS" ? "der" : "izq"}
                          type="monotone"
                          dataKey={`meta__${bu}`}
                          name={`Meta ${bu}`}
                          stroke={color(bu)}
                          strokeWidth={2}
                          strokeDasharray="5 4"
                          dot={false}
                          connectNulls
                        />
                      ))}
                    </ComposedChart>
                  </ResponsiveContainer>
                </>
              )}
            </Seccion>

            {/* 3. Inyección */}
            <Seccion
              grafica="inyeccion"
              titulo="Inyección"
              nota="Producción promedio diaria por unidad de negocio, contra su meta. Almohada va en piezas; el resto en pares. Crocs va en el eje derecho: produce ocho veces más que suela o almohada."
            >
              <GraficaBloque
                datos={datos.inyeccion}
                altura={360}
                seriesDerecha={["CROCS"]}
              />
              <div className="mt-6">
                <h3 className="text-sm font-semibold text-gray-700 mb-2">
                  Promedio diario por trimestre {anio}
                </h3>
                <TablaTrimestres datos={datos.qInj} />
              </div>
            </Seccion>

            {/* 4. Ensamble */}
            <Seccion
              grafica="ensamble"
              titulo="Ensamble"
              nota="Producción promedio diaria por unidad de negocio, contra su meta. Crocs va en el eje derecho."
            >
              <GraficaBloque
                datos={datos.ensamble}
                altura={360}
                seriesDerecha={["CROCS"]}
              />
              <div className="mt-6">
                <h3 className="text-sm font-semibold text-gray-700 mb-2">
                  Promedio diario por trimestre {anio}
                </h3>
                <TablaTrimestres datos={datos.qAssy} />
              </div>
            </Seccion>

            {/* 5. Rotación */}
            <Seccion
              grafica="rotacion"
              titulo="Rotación de plantilla"
              nota="Va semana a semana siempre: el Excel no lleva el corte mensual de este bloque. No estaba en la presentación."
            >
              <GraficaRotacion datos={datos.rotacion} />
            </Seccion>
          </>
        )
      )}
    </div>
  );
}

/**
 * Rotación: dos gráficas, porque mezclar personas y porcentajes en un solo eje
 * deja las tres líneas de porcentaje pegadas al suelo.
 */
function GraficaRotacion({ datos }) {
  const personas = useMemo(
    () => (datos?.metricas || []).filter((m) => m.unidad === "PERSONAS"),
    [datos],
  );
  const porcentajes = useMemo(
    () => (datos?.metricas || []).filter((m) => m.unidad === "PORCENTAJE"),
    [datos],
  );

  if (!datos?.periodos?.length) {
    return <p className="text-sm text-gray-400 py-10 text-center">Sin datos en este periodo</p>;
  }

  const ultimo = datos.periodos[datos.periodos.length - 1];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Tarjeta
          titulo="Plantilla"
          valor={num(ultimo.rot_plantilla)}
          detalle={`Meta ${num(ultimo.rot_plantilla_meta)} · ${ultimo.eje}`}
          color="#236093"
        />
        <Tarjeta
          titulo="Bajas"
          valor={num(ultimo.rot_bajas)}
          detalle={`${pct(ultimo.rot_pct_bajas, 2)} de la plantilla`}
          color="#b0413e"
        />
        <Tarjeta
          titulo="Ausentismo"
          valor={pct(ultimo.rot_pct_ausentismo, 2)}
          detalle={`Variantes ${pct(ultimo.rot_variantes, 1)}`}
          color="#c9761f"
        />
        <Tarjeta
          titulo="Total Foam"
          valor={num(ultimo.rot_total_foam)}
          detalle={`Administración ${num(ultimo.rot_administracion)}`}
          color="#64748b"
        />
      </div>

      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-2">Personal</h3>
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={datos.periodos} margin={{ top: 10, right: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
            <XAxis dataKey="eje" tick={{ fontSize: 11 }} angle={-30} textAnchor="end" height={70} />
            {/* Dos ejes: las bajas son 15 personas contra una plantilla de 730 y
                en un eje compartido quedan aplastadas contra el suelo */}
            <YAxis yAxisId="izq" tick={{ fontSize: 11 }} tickFormatter={corto} />
            <YAxis
              yAxisId="der"
              orientation="right"
              tick={{ fontSize: 11 }}
              tickFormatter={corto}
            />
            <Tooltip formatter={(v) => num(v)} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar
              yAxisId="izq"
              dataKey="rot_plantilla"
              name="Plantilla"
              fill={color("PLANTILLA")}
              radius={[3, 3, 0, 0]}
            />
            <Bar
              yAxisId="der"
              dataKey="rot_bajas"
              name="Bajas (eje derecho)"
              fill={color("BAJAS")}
              radius={[3, 3, 0, 0]}
            />
            {/* El resto son referencias de tamaño de la planta, no cantidades a
                comparar con la plantilla semana a semana: van como línea */}
            {personas
              .filter((m) => !["rot_plantilla", "rot_bajas"].includes(m.codigo))
              .map((m) => (
                <Line
                  key={m.codigo}
                  yAxisId="izq"
                  type="monotone"
                  dataKey={m.codigo}
                  name={m.nombre}
                  stroke={color(m.serie)}
                  strokeWidth={2}
                  strokeDasharray={m.es_meta ? "5 4" : undefined}
                  dot={false}
                  connectNulls
                />
              ))}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* data-grafica propio: la sección envolvente ya tiene el suyo y el
          exportador toma el PRIMER svg de cada uno, así que sin esto la
          gráfica de indicadores no saldría en el Excel */}
      <div data-grafica="rotacion-pct">
        <h3 className="text-sm font-semibold text-gray-700 mb-2">Indicadores</h3>
        <ResponsiveContainer width="100%" height={280}>
          <ComposedChart data={datos.periodos} margin={{ top: 10, right: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
            <XAxis dataKey="eje" tick={{ fontSize: 11 }} angle={-30} textAnchor="end" height={70} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v * 100).toFixed(0)}%`} />
            <Tooltip formatter={(v) => pct(v, 2)} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            {porcentajes.map((m) => (
              <Line
                key={m.codigo}
                type="monotone"
                dataKey={m.codigo}
                name={m.nombre}
                stroke={color(m.serie)}
                strokeWidth={m.es_meta ? 2 : 2.5}
                strokeDasharray={m.es_meta ? "5 4" : undefined}
                dot={false}
                connectNulls
              />
            ))}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
