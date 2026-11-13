import { useRef, useEffect } from "react";
import { Eraser } from "lucide-react";

/**
 * Lienzo para dibujar la firma con el dedo, la pluma de la tablet o el mouse.
 *
 * Guarda los trazos (en pixeles de pantalla) para redibujarlos si cambia el
 * tamaño. Al terminar cada trazo llama a `onCambio` con un PNG recortado a lo
 * dibujado (fondo transparente, tinta oscura), o con null si se borró.
 */

const TINTA = "#14213d";
const GROSOR = 2.6;

function trazar(ctx, puntos, escala = 1, dx = 0, dy = 0) {
  if (puntos.length === 0) return;
  ctx.beginPath();
  const p0 = puntos[0];
  ctx.moveTo((p0.x - dx) * escala, (p0.y - dy) * escala);
  if (puntos.length === 1) {
    // Un toque: un punto
    ctx.arc((p0.x - dx) * escala, (p0.y - dy) * escala, (GROSOR * escala) / 2, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  // Curvas entre puntos medios: la línea sale suave aunque lleguen pocos eventos
  for (let i = 1; i < puntos.length - 1; i++) {
    const a = puntos[i];
    const b = puntos[i + 1];
    ctx.quadraticCurveTo((a.x - dx) * escala, (a.y - dy) * escala, ((a.x + b.x) / 2 - dx) * escala, ((a.y + b.y) / 2 - dy) * escala);
  }
  const ultimo = puntos[puntos.length - 1];
  ctx.lineTo((ultimo.x - dx) * escala, (ultimo.y - dy) * escala);
  ctx.stroke();
}

function pincel(ctx, escala) {
  ctx.strokeStyle = TINTA;
  ctx.fillStyle = TINTA;
  ctx.lineWidth = GROSOR * escala;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
}

/** PNG recortado a lo dibujado, al doble de resolución para que se vea nítido impreso. */
function exportar(trazos) {
  const todos = trazos.flat();
  if (todos.length === 0) return null;
  const margen = 8;
  const minX = Math.min(...todos.map((p) => p.x)) - margen;
  const minY = Math.min(...todos.map((p) => p.y)) - margen;
  const maxX = Math.max(...todos.map((p) => p.x)) + margen;
  const maxY = Math.max(...todos.map((p) => p.y)) + margen;
  const escala = 2;
  const c = document.createElement("canvas");
  c.width = Math.ceil((maxX - minX) * escala);
  c.height = Math.ceil((maxY - minY) * escala);
  const ctx = c.getContext("2d");
  pincel(ctx, escala);
  for (const t of trazos) trazar(ctx, t, escala, minX, minY);
  return c.toDataURL("image/png");
}

export default function LienzoFirma({ onCambio, alto = 200 }) {
  const lienzo = useRef(null);
  const trazos = useRef([]);
  const actual = useRef(null);

  // Ajusta el tamaño real del canvas a su tamaño en pantalla (y a la densidad
  // de la pantalla) y redibuja lo que hubiera
  useEffect(() => {
    const c = lienzo.current;
    const ajustar = () => {
      const dpr = window.devicePixelRatio || 1;
      c.width = Math.round(c.clientWidth * dpr);
      c.height = Math.round(c.clientHeight * dpr);
      const ctx = c.getContext("2d");
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      pincel(ctx, 1);
      for (const t of trazos.current) trazar(ctx, t);
    };
    ajustar();
    const obs = new ResizeObserver(ajustar);
    obs.observe(c);
    return () => obs.disconnect();
  }, []);

  const punto = (e) => {
    const r = lienzo.current.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const redibujar = () => {
    const c = lienzo.current;
    const ctx = c.getContext("2d");
    ctx.clearRect(0, 0, c.width, c.height);
    for (const t of trazos.current) trazar(ctx, t);
    if (actual.current) trazar(ctx, actual.current);
  };

  const empezar = (e) => {
    e.preventDefault();
    lienzo.current.setPointerCapture(e.pointerId);
    actual.current = [punto(e)];
    redibujar();
  };

  const mover = (e) => {
    if (!actual.current) return;
    // Con pluma o dedo llegan eventos agrupados: se usan todos para no perder detalle
    const eventos = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
    for (const ev of eventos.length ? eventos : [e]) actual.current.push(punto(ev));
    redibujar();
  };

  const terminar = () => {
    if (!actual.current) return;
    trazos.current.push(actual.current);
    actual.current = null;
    onCambio?.(exportar(trazos.current));
  };

  const borrar = () => {
    trazos.current = [];
    actual.current = null;
    redibujar();
    onCambio?.(null);
  };

  return (
    <div className="space-y-2">
      <div className="relative rounded-lg border-2 border-dashed border-gray-300 bg-white">
        <canvas
          ref={lienzo}
          onPointerDown={empezar}
          onPointerMove={mover}
          onPointerUp={terminar}
          onPointerCancel={terminar}
          className="block w-full cursor-crosshair"
          style={{ height: alto, touchAction: "none" }}
          aria-label="Área para dibujar tu firma"
        />
        {/* La línea donde se firma */}
        <div className="pointer-events-none absolute left-6 right-6 border-b border-gray-300" style={{ top: alto * 0.72 }} />
        <span className="pointer-events-none absolute left-6 text-xs text-gray-300" style={{ top: alto * 0.72 + 4 }}>
          Firma aquí
        </span>
      </div>
      <button
        type="button"
        onClick={borrar}
        className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900"
      >
        <Eraser className="w-4 h-4" />
        Borrar y volver a firmar
      </button>
    </div>
  );
}
