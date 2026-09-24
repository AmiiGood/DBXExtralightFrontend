import { useMemo, useState } from "react";

/**
 * Mapa de calor del scrap: una celda por unidad de negocio y mes.
 *
 * Sustituye de un golpe las cinco hojas de scrap del libro, que obligan a
 * abrir una pestaña por unidad de negocio y comparar de memoria. Aquí se ve en
 * un vistazo que Crocs anda en 10% mientras Dual Color se va arriba del 35%, y
 * en qué meses se desbordó.
 *
 * Va en SVG a mano y no en recharts porque recharts no tiene mapa de calor, y
 * lo que hace falta es una rejilla de colores con su escala, no un eje.
 */

/**
 * Rampa de color por porcentaje de scrap.
 *
 * Verde hasta el 10%, ámbar hacia el 25% y rojo del 35% en adelante. Los
 * cortes salen de los datos reales: Crocs vive cerca del 10% y Dual Color
 * arriba del 35%, así que una escala lineal de 0 a 100 dejaría todo del mismo
 * tono y no se distinguiría nada.
 */
const PARADAS = [
  { pct: 0.0, color: [72, 160, 144] },
  { pct: 0.1, color: [149, 184, 73] },
  { pct: 0.2, color: [222, 178, 60] },
  { pct: 0.3, color: [201, 118, 31] },
  { pct: 0.45, color: [160, 45, 45] },
];

function colorDe(pct) {
  if (pct === null || pct === undefined) return "#f1f5f9";
  const v = Math.max(0, Math.min(pct, PARADAS[PARADAS.length - 1].pct));
  let i = 0;
  while (i < PARADAS.length - 2 && v > PARADAS[i + 1].pct) i++;
  const a = PARADAS[i];
  const b = PARADAS[i + 1];
  const t = (v - a.pct) / (b.pct - a.pct || 1);
  const c = a.color.map((x, j) => Math.round(x + (b.color[j] - x) * t));
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
}

/** Texto blanco sobre los tonos oscuros del extremo rojo. */
const textoDe = (pct) => (pct !== null && pct >= 0.19 ? "#ffffff" : "#1f2937");

const MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

const num = (n) =>
  n == null ? "—" : Number(n).toLocaleString("es-MX", { maximumFractionDigits: 0 });

export default function MapaCalorScrap({ celdas, bus, nombres }) {
  const [encima, setEncima] = useState(null);

  // Índice por unidad de negocio y mes, para no recorrer la lista en cada celda
  const porClave = useMemo(() => {
    const m = new Map();
    for (const c of celdas || []) m.set(`${c.bu}|${c.mes}`, c);
    return m;
  }, [celdas]);

  const filas = bus || [];
  if (filas.length === 0 || !celdas?.length) {
    return <p className="text-sm text-gray-400 py-10 text-center">Sin datos de scrap en este año</p>;
  }

  const ANCHO_ETIQUETA = 120;
  const CELDA = 62;
  const ALTO = 42;
  const ancho = ANCHO_ETIQUETA + CELDA * 12;
  const alto = 26 + ALTO * filas.length;

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${ancho} ${alto}`}
          width="100%"
          style={{ minWidth: 680, maxWidth: ancho }}
          /* data-exportable: el exportador a Excel busca los SVG por aquí,
             porque este no es una gráfica de recharts */
          data-exportable="true"
          role="img"
          aria-label="Mapa de calor del porcentaje de scrap por unidad de negocio y mes"
        >
          {MESES.map((m, i) => (
            <text
              key={m}
              x={ANCHO_ETIQUETA + CELDA * i + CELDA / 2}
              y={16}
              textAnchor="middle"
              fontSize="11"
              fill="#64748b"
            >
              {m}
            </text>
          ))}

          {filas.map((bu, f) => (
            <g key={bu}>
              <text
                x={ANCHO_ETIQUETA - 10}
                y={26 + ALTO * f + ALTO / 2 + 4}
                textAnchor="end"
                fontSize="12"
                fill="#1f2937"
                fontWeight="500"
              >
                {nombres?.[bu] || bu}
              </text>
              {MESES.map((_, i) => {
                const c = porClave.get(`${bu}|${i + 1}`);
                const pct = c?.pct ?? null;
                const x = ANCHO_ETIQUETA + CELDA * i;
                const y = 26 + ALTO * f;
                return (
                  <g
                    key={i}
                    onMouseEnter={() => c && setEncima({ ...c, bu })}
                    onMouseLeave={() => setEncima(null)}
                  >
                    <rect
                      x={x + 2}
                      y={y + 2}
                      width={CELDA - 4}
                      height={ALTO - 4}
                      rx="4"
                      fill={colorDe(pct)}
                      stroke={encima && encima.bu === bu && encima.mes === i + 1 ? "#1f2937" : "none"}
                      strokeWidth="2"
                    />
                    {pct !== null && (
                      <text
                        x={x + CELDA / 2}
                        y={y + ALTO / 2 + 4}
                        textAnchor="middle"
                        fontSize="12"
                        fontWeight="600"
                        fill={textoDe(pct)}
                      >
                        {(pct * 100).toFixed(1)}
                      </text>
                    )}
                  </g>
                );
              })}
            </g>
          ))}
        </svg>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Escala */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">0%</span>
          <div className="flex rounded overflow-hidden">
            {Array.from({ length: 24 }, (_, i) => (
              <div
                key={i}
                className="w-3 h-3"
                style={{ background: colorDe((i / 23) * 0.45) }}
              />
            ))}
          </div>
          <span className="text-xs text-gray-500">45% o más</span>
        </div>

        {/* Detalle de la celda bajo el cursor */}
        <p className="text-xs text-gray-500 min-h-[1rem]">
          {encima
            ? `${nombres?.[encima.bu] || encima.bu} · ${encima.etiqueta}: ` +
              `${num(encima.rechazo)} rechazadas de ${num(encima.producido)} producidas ` +
              `(${(encima.pct * 100).toFixed(1)}%)`
            : "Pasa el cursor por una celda para ver las piezas detrás del porcentaje"}
        </p>
      </div>
    </div>
  );
}
