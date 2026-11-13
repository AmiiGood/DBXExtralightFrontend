import { useState } from "react";
import { FileDown, Loader2 } from "lucide-react";
import { comprasService } from "../../services/compras.service";

/**
 * Abre en otra pestaña el PDF de una orden de compra: el formato de
 * autorización con las firmas estampadas. Se pide con la sesión (no es un
 * enlace directo) y se abre como archivo local del navegador.
 */
export default function BotonPdfOrden({ ordenId, texto = "Ver PDF", compacto = false }) {
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(null);

  async function abrir(e) {
    e.stopPropagation();
    setCargando(true);
    setError(null);
    // La pestaña se abre en el clic: si se abre después de pedir el PDF, el
    // navegador la toma por ventana emergente y la bloquea
    const pestana = window.open("", "_blank");
    try {
      const blob = await comprasService.pdfOrden(ordenId);
      const url = URL.createObjectURL(blob);
      if (pestana) {
        pestana.opener = null;
        pestana.location.href = url;
      } else {
        // Sin pestaña (bloqueada): se descarga
        const a = document.createElement("a");
        a.href = url;
        a.download = `Orden de compra ${ordenId}.pdf`;
        a.click();
      }
      // Que la pestaña alcance a leerlo antes de soltarlo
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (err) {
      pestana?.close();
      setError(err.response?.status === 404 ? "No tienes acceso a esta orden" : "No se pudo abrir el PDF");
    } finally {
      setCargando(false);
    }
  }

  return (
    <span className="inline-flex flex-col items-end">
      <button
        type="button"
        onClick={abrir}
        disabled={cargando}
        title="Formato de autorización con las firmas"
        className={
          compacto
            ? "p-1.5 rounded-md text-gray-400 hover:text-[#236093] hover:bg-gray-100 disabled:opacity-50"
            : "inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-[#236093] border border-[#236093]/30 rounded-lg hover:bg-[#236093]/5 disabled:opacity-50"
        }
      >
        {cargando ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
        {!compacto && texto}
      </button>
      {error && <span className="text-xs text-red-600 mt-0.5">{error}</span>}
    </span>
  );
}
