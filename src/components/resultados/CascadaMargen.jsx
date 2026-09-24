import { useMemo, useState } from "react";

/**
 * Cascada del estado de resultados: de Ventas a EBIT.
 *
 * El libro no grafica el P&L en ningún lado —está como tabla en la hoja
 * 'Margin'— y es justo el dato donde una cascada se lee sola: se ve de dónde
 * sale cada euro y dónde se va.
 *
 * Va en SVG a mano y no en recharts por una razón concreta: una cascada sin
 * LÍNEAS CONECTORAS no se entiende. Sin ellas las barras que flotan a media
 * altura parecen tablitas sueltas en vez de una caída continua, y recharts no
 * tiene forma de dibujarlas sin meterse con sus internos. Aquí además se puede
 * poner el valor sobre cada barra y distinguir por forma —no solo por color—
 * los NIVELES (que nacen del piso, esquina recta) de los MOVIMIENTOS (que
 * flotan, esquina redondeada).
 *
 * OJO con el orden: NO es el de la hoja. 'Variable costs' del Excel ya incluye
 * la mano de obra directa y el margen ENI se calcula antes de restarla, así
 * que la cascada baja por los costos variables sin mano de obra y solo
 * entonces le quita la mano de obra directa. Está verificado al céntimo, y si
 * algún día la hoja cambia, el backend marca el descuadre y aquí se señala.
 */

const COLOR = {
  suma: "#49a090",
  resta: "#b0413e",
  subtotal: "#334155",
};

const ANCHO = 1120;
const ALTO = 430;
const M = { top: 34, right: 24, bottom: 96, left: 80 };

const eur = (n) =>
  n == null
    ? "—"
    : `${Number(n).toLocaleString("es-MX", { maximumFractionDigits: 0 })} €`;

/** Millones abreviados, para el eje y las etiquetas sobre las barras. */
const corto = (n) => {
  const v = Number(n);
  if (!Number.isFinite(v)) return "";
  const s = v < 0 ? "−" : "";
  const a = Math.abs(v);
  if (a >= 1e6) return `${s}${(a / 1e6).toFixed(1)}M`;
  if (a >= 1000) return `${s}${Math.round(a / 1000)}k`;
  return `${s}${Math.round(a)}`;
};

/**
 * Cortes redondos que cubran el rango.
 *
 * El último SIEMPRE queda por encima del máximo: si no, la barra más alta toca
 * el techo del área de dibujo y su etiqueta se sale.
 */
function ticks(min, max) {
  const paso = (max - min) / 4;
  const mag = 10 ** Math.floor(Math.log10(Math.abs(paso) || 1));
  const redondo = Math.ceil(paso / mag) * mag;
  if (!(redondo > 0)) return [min, max];

  const res = [];
  for (let v = Math.floor(min / redondo) * redondo; ; v += redondo) {
    res.push(v);
    if (v >= max || res.length > 20) break;
  }
  return res;
}

export default function CascadaMargen({ cascada }) {
  const [encima, setEncima] = useState(null);

  const geo = useMemo(() => {
    const pasos = cascada || [];
    if (pasos.length === 0) return null;

    // El rango tiene que incluir el cero: si no, una cascada que nunca baja de
    // cero se dibujaría flotando sin piso
    const valores = pasos.flatMap((p) => [p.desde, p.hasta, 0]);
    const max = Math.max(...valores);
    const min = Math.min(...valores);
    const cortes = ticks(min, max);
    const tope = Math.max(max, cortes[cortes.length - 1]);
    const piso = Math.min(min, cortes[0]);

    const anchoUtil = ANCHO - M.left - M.right;
    const altoUtil = ALTO - M.top - M.bottom;
    const banda = anchoUtil / pasos.length;
    const anchoBarra = Math.min(banda * 0.62, 72);

    const y = (v) => M.top + altoUtil * (1 - (v - piso) / (tope - piso || 1));

    const barras = pasos.map((p, i) => {
      const centro = M.left + banda * (i + 0.5);
      const esSubtotal = p.tipo === "subtotal";
      const arriba = esSubtotal ? Math.max(0, p.hasta) : Math.max(p.desde, p.hasta);
      const abajo = esSubtotal ? Math.min(0, p.hasta) : Math.min(p.desde, p.hasta);
      return {
        ...p,
        i,
        centro,
        x: centro - anchoBarra / 2,
        ancho: anchoBarra,
        yArriba: y(arriba),
        yAbajo: y(abajo),
        alto: Math.max(y(abajo) - y(arriba), 2),
        esSubtotal,
      };
    });

    return { barras, cortes, y, banda, anchoBarra, yCero: y(0) };
  }, [cascada]);

  if (!geo) {
    return (
      <p className="text-sm text-gray-400 py-10 text-center">
        Este año no trae estado de resultados
      </p>
    );
  }

  const { barras, cortes, y, yCero } = geo;
  const descuadres = barras.filter((b) => b.descuadre);
  const activo = encima !== null ? barras[encima] : null;

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${ANCHO} ${ALTO}`}
          width="100%"
          style={{ minWidth: 760 }}
          /* data-exportable: el exportador a Excel busca los SVG por aquí,
             porque este no es una gráfica de recharts */
          data-exportable="true"
          role="img"
          aria-label="Cascada del estado de resultados, de ventas a EBIT"
          onMouseLeave={() => setEncima(null)}
        >
          {/* Rejilla y eje */}
          {cortes.map((v) => (
            <g key={v}>
              <line
                x1={M.left}
                x2={ANCHO - M.right}
                y1={y(v)}
                y2={y(v)}
                stroke="#f1f5f9"
                strokeWidth="1"
              />
              <text
                x={M.left - 10}
                y={y(v) + 4}
                textAnchor="end"
                fontSize="11"
                fill="#64748b"
              >
                {corto(v)}
              </text>
            </g>
          ))}

          {/* El cero, más marcado: es de donde nacen los niveles */}
          <line
            x1={M.left}
            x2={ANCHO - M.right}
            y1={yCero}
            y2={yCero}
            stroke="#cbd5e1"
            strokeWidth="1.5"
          />

          {/* Conectoras: unen donde terminó una barra con donde arranca la
              siguiente. Son lo que convierte barras sueltas en una cascada. */}
          {barras.slice(0, -1).map((b, i) => {
            const sig = barras[i + 1];
            return (
              <line
                key={`con-${b.codigo}`}
                x1={b.x + b.ancho}
                x2={sig.x}
                y1={y(b.hasta)}
                y2={y(b.hasta)}
                stroke="#94a3b8"
                strokeWidth="1.5"
                strokeDasharray="3 3"
              />
            );
          })}

          {/* Barras */}
          {barras.map((b) => {
            const color = COLOR[b.tipo] || COLOR.subtotal;
            const resaltada = encima === b.i;
            return (
              <g
                key={b.codigo}
                onMouseEnter={() => setEncima(b.i)}
                style={{ cursor: "default" }}
              >
                {/* Zona de captura: toda la banda, para que no haya que
                    atinarle a una barra de dos píxeles */}
                <rect
                  x={b.centro - geo.banda / 2}
                  y={M.top}
                  width={geo.banda}
                  height={ALTO - M.top - M.bottom}
                  fill={resaltada ? "#f8fafc" : "transparent"}
                />
                <rect
                  x={b.x}
                  y={b.yArriba}
                  width={b.ancho}
                  height={b.alto}
                  /* Los niveles nacen del piso y llevan esquina recta; los
                     movimientos flotan y van redondeados. Así se distinguen
                     sin tener que ir a la leyenda. */
                  rx={b.esSubtotal ? 0 : 3}
                  fill={color}
                  opacity={encima === null || resaltada ? 1 : 0.45}
                />
                {/* Remate del nivel, para que se lea como un piso alcanzado */}
                {b.esSubtotal && (
                  <rect
                    x={b.x}
                    y={b.yArriba - 3}
                    width={b.ancho}
                    height={3}
                    fill="#0f172a"
                    opacity={encima === null || resaltada ? 1 : 0.45}
                  />
                )}

                {/* Valor sobre la barra */}
                <text
                  x={b.centro}
                  y={b.yArriba - 9}
                  textAnchor="middle"
                  fontSize="11"
                  fontWeight={b.esSubtotal ? 700 : 500}
                  fill={b.esSubtotal ? "#0f172a" : color}
                >
                  {b.esSubtotal
                    ? corto(b.hasta)
                    : `${b.delta >= 0 ? "+" : "−"}${corto(Math.abs(b.delta))}`}
                </text>

                {/* Etiqueta del eje, inclinada para que quepa */}
                <text
                  x={b.centro}
                  y={ALTO - M.bottom + 16}
                  textAnchor="end"
                  fontSize="11"
                  fontWeight={b.esSubtotal ? 600 : 400}
                  fill={b.esSubtotal ? "#0f172a" : "#64748b"}
                  transform={`rotate(-32 ${b.centro} ${ALTO - M.bottom + 16})`}
                >
                  {b.nombre}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500">
          <span className="inline-flex items-center gap-1.5">
            <span
              className="w-3 h-3"
              style={{ background: COLOR.subtotal, borderTop: "3px solid #0f172a" }}
            />
            Nivel alcanzado
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm" style={{ background: COLOR.resta }} />
            Lo que resta
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm" style={{ background: COLOR.suma }} />
            Lo que aporta
          </span>
        </div>

        {/* Detalle de la barra bajo el cursor */}
        <p className="text-xs text-gray-500 min-h-[1rem] text-right">
          {activo ? (
            <>
              <strong className="text-gray-900">{activo.nombre}</strong>{" "}
              {activo.esSubtotal
                ? eur(activo.hasta)
                : `${activo.delta >= 0 ? "+" : ""}${eur(activo.delta)} · queda en ${eur(activo.hasta)}`}
              {activo.pctVentas != null &&
                ` · ${(activo.pctVentas * 100).toFixed(1)}% de las ventas`}
              {activo.detalle &&
                ` (${activo.detalle.map((d) => `${d.nombre} ${eur(d.total)}`).join(", ")})`}
            </>
          ) : (
            "Pasa el cursor por una barra para ver el detalle"
          )}
        </p>
      </div>

      {descuadres.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
          El Excel no cuadra con su propia cascada en{" "}
          <strong>{descuadres.map((d) => d.nombre).join(", ")}</strong>. La diferencia
          es de {descuadres.map((d) => eur(d.descuadre)).join(", ")}. Revisar si se
          agregó o cambió algún concepto en la hoja.
        </div>
      )}
    </div>
  );
}
