import { useId } from "react";

/**
 * Adornos de temporada dibujados a mano en SVG: una tira que se repite a lo
 * ancho (patrón) y un icono chico para el saludo. Sin imágenes ni animaciones,
 * para que no pesen ni distraigan en las PC de la planta.
 *
 * Las fechas y el interruptor están en config/temporadas.js.
 */

// ---------------------------------------------------------------------------
// Piezas
// ---------------------------------------------------------------------------

/** Estrella de 4 puntas con lados curvos (destello). */
const destello = (cx, cy, r) =>
  `M${cx} ${cy - r} Q${cx} ${cy} ${cx + r} ${cy} Q${cx} ${cy} ${cx} ${cy + r} Q${cx} ${cy} ${cx - r} ${cy} Q${cx} ${cy} ${cx} ${cy - r}Z`;

/** Estrella de 5 puntas. */
function estrella(cx, cy, r) {
  const p = [];
  for (let i = 0; i < 10; i++) {
    const rr = i % 2 ? r * 0.45 : r;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    p.push(`${(cx + rr * Math.cos(a)).toFixed(2)},${(cy + rr * Math.sin(a)).toFixed(2)}`);
  }
  return `M${p.join(" L")}Z`;
}

/** Banderita de papel picado colgando del hilo, con el borde de abajo en picos. */
function bandera(x) {
  const pts = [`${x},4`, `${x + 40},4`, `${x + 40},33`];
  for (let i = 40; i > 0; i -= 8) pts.push(`${x + i - 4},39`, `${x + i - 8},33`);
  return `M${pts.join(" L")}Z`;
}

function PapelPicado({ x, color, borde, hueco, calavera, giro }) {
  const cx = x + 20;
  return (
    <g transform={`rotate(${giro} ${cx} 4)`}>
      <path d={bandera(x)} fill={color} stroke={borde || "none"} strokeWidth="1" />
      {calavera ? (
        <g>
          {/* La calaverita es un recorte: se dibuja en el color del hueco */}
          <circle cx={cx} cy="17" r="6.2" fill={hueco} />
          <rect x={cx - 3.6} y="20" width="7.2" height="5.4" rx="1.6" fill={hueco} />
          <circle cx={cx - 2.4} cy="16.6" r="1.7" fill={color} />
          <circle cx={cx + 2.4} cy="16.6" r="1.7" fill={color} />
          <path d={`M${cx} 19 l-1 1.8 h2 z`} fill={color} />
          <path d={`M${cx - 2} 23 v2.2 M${cx} 23 v2.2 M${cx + 2} 23 v2.2`} stroke={color} strokeWidth="0.8" />
        </g>
      ) : (
        <path d={`M${cx} 12 l6 6 l-6 6 l-6 -6 z`} fill={hueco} />
      )}
      <circle cx={x + 7} cy="10" r="2" fill={hueco} />
      <circle cx={x + 33} cy="10" r="2" fill={hueco} />
      <circle cx={x + 7} cy="27" r="1.6" fill={hueco} />
      <circle cx={x + 33} cy="27" r="1.6" fill={hueco} />
    </g>
  );
}

// ---------------------------------------------------------------------------
// Cada temporada: el contenido de un "azulejo" que se repite a lo ancho
// ---------------------------------------------------------------------------

const AZULEJOS = {
  navidad: {
    ancho: 120,
    contenido: (
      <g>
        {/* Guirnalda: dos trazos de verde para que tenga cuerpo */}
        <path d="M0 6 Q60 24 120 6" fill="none" stroke="#1f5c33" strokeWidth="3.2" strokeLinecap="round" />
        <path d="M0 8 Q60 26 120 8" fill="none" stroke="#3f8f52" strokeWidth="1.4" strokeDasharray="2 3" />
        <path d="M60 15 V20 M22 11.4 V16 M98 11.4 V16" stroke="#9aa5b1" strokeWidth="0.9" />
        <circle cx="60" cy="26.5" r="6.5" fill="#b3261e" />
        <circle cx="58" cy="24.5" r="1.8" fill="#fff" opacity="0.55" />
        <rect x="58.2" y="19" width="3.6" height="2.4" rx="0.6" fill="#c9a227" />
        <circle cx="22" cy="20" r="4" fill="#c9a227" />
        <circle cx="98" cy="20" r="4" fill="#c9a227" />
        <path d={estrella(40, 30, 3.2)} fill="#c9a227" opacity="0.8" />
        <path d={estrella(82, 32, 2.6)} fill="#c9a227" opacity="0.6" />
      </g>
    ),
  },
  "anio-nuevo": {
    ancho: 96,
    contenido: (
      <g>
        <path d={destello(20, 20, 9)} fill="#c9a227" />
        <path d={destello(54, 30, 5.5)} fill="#236093" />
        <path d={destello(74, 11, 4.5)} fill="#c9a227" opacity="0.8" />
        <path d={destello(88, 30, 3)} fill="#236093" opacity="0.6" />
        <circle cx="40" cy="9" r="1.6" fill="#9aa5b1" />
        <circle cx="34" cy="34" r="1.2" fill="#c9a227" />
        <circle cx="64" cy="18" r="1.1" fill="#9aa5b1" />
      </g>
    ),
  },
  patrias: {
    ancho: 144,
    contenido: (
      <g>
        <line x1="0" y1="4" x2="144" y2="4" stroke="#8a929b" strokeWidth="1.2" />
        <PapelPicado x={2} color="#0f7a3d" hueco="#ffffff" giro={-2} />
        <PapelPicado x={50} color="#ffffff" borde="#cfd5db" hueco="#e6e9ec" giro={1.5} />
        <PapelPicado x={98} color="#c8102e" hueco="#ffffff" giro={-1} />
      </g>
    ),
  },
  muertos: {
    ancho: 192,
    contenido: (
      <g>
        <line x1="0" y1="4" x2="192" y2="4" stroke="#8a929b" strokeWidth="1.2" />
        <PapelPicado x={2} color="#e8740c" hueco="#ffffff" calavera giro={-2} />
        <PapelPicado x={50} color="#6d2f9c" hueco="#ffffff" giro={1.5} />
        <PapelPicado x={98} color="#f2b705" hueco="#ffffff" calavera giro={-1} />
        <PapelPicado x={146} color="#1d8a5a" hueco="#ffffff" giro={2} />
      </g>
    ),
  },
};

/** Tira decorativa a todo lo ancho. `temporada` viene de useTemporada(). */
export function TiraTemporada({ temporada, alto = 44, className = "" }) {
  const id = useId().replace(/:/g, "");
  const a = temporada && AZULEJOS[temporada.id];
  if (!a) return null;
  return (
    <svg width="100%" height={alto} className={`block ${className}`} aria-hidden="true">
      <defs>
        <pattern id={`t${id}`} width={a.ancho} height={alto} patternUnits="userSpaceOnUse">
          {a.contenido}
        </pattern>
      </defs>
      <rect width="100%" height={alto} fill={`url(#t${id})`} />
    </svg>
  );
}

/** Icono chico para acompañar el saludo. */
export function IconoTemporada({ temporada, className = "w-5 h-5" }) {
  if (!temporada) return null;
  let dibujo = null;
  if (temporada.id === "navidad") dibujo = <path d={estrella(10, 10.5, 8.5)} fill="#c9a227" />;
  if (temporada.id === "anio-nuevo") dibujo = <path d={destello(10, 10, 8.5)} fill="#c9a227" />;
  if (temporada.id === "patrias") {
    dibujo = (
      <g>
        <clipPath id="circulo-patrias">
          <circle cx="10" cy="10" r="8" />
        </clipPath>
        <g clipPath="url(#circulo-patrias)">
          <rect x="2" y="2" width="5.4" height="16" fill="#0f7a3d" />
          <rect x="7.4" y="2" width="5.2" height="16" fill="#fff" />
          <rect x="12.6" y="2" width="5.4" height="16" fill="#c8102e" />
        </g>
        <circle cx="10" cy="10" r="8" fill="none" stroke="#cfd5db" />
      </g>
    );
  }
  if (temporada.id === "muertos") {
    // Cempasúchil: pétalos alrededor de un centro más oscuro
    dibujo = (
      <g>
        {Array.from({ length: 10 }, (_, i) => {
          const a = (i * Math.PI) / 5;
          return <circle key={i} cx={10 + 5.2 * Math.cos(a)} cy={10 + 5.2 * Math.sin(a)} r="3.3" fill="#f28c0f" />;
        })}
        <circle cx="10" cy="10" r="4" fill="#e06a00" />
        <circle cx="10" cy="10" r="1.8" fill="#f7b733" />
      </g>
    );
  }
  return (
    <svg viewBox="0 0 20 20" className={`inline-block shrink-0 ${className}`} aria-hidden="true">
      {dibujo}
    </svg>
  );
}
