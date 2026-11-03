import { useState, useEffect } from "react";
import { Loader2, FileText, FileSpreadsheet, Download } from "lucide-react";

/**
 * Miniatura de imagen o ficha de archivo de Compras.
 *
 * El contenido se baja con el token (no hay URL pública), por eso recibe
 * `cargar`: una función que regresa el Blob. Así sirve igual para los adjuntos
 * de la solicitud, vistos por quien pidió o por Compras, y para las fotos y
 * PDF de los proveedores.
 *
 * `compacto` es para las celdas del comparativo: una miniatura chica que abre
 * la imagen completa.
 */
export default function ArchivoCompras({ archivo, cargar, compacto = false }) {
  const [url, setUrl] = useState(null);
  const esImagen = archivo.tipo_mime.startsWith("image/");

  useEffect(() => {
    if (!esImagen) return;
    let vivo = true;
    let creada;
    cargar()
      .then((blob) => {
        creada = URL.createObjectURL(blob);
        if (vivo) setUrl(creada);
      })
      .catch(() => {});
    return () => {
      vivo = false;
      if (creada) URL.revokeObjectURL(creada);
    };
    // `cargar` cambia en cada render del padre; lo que importa es el archivo
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [archivo.id, esImagen]);

  const abrir = async (descargar) => {
    const blob = await cargar();
    const u = URL.createObjectURL(blob);
    if (descargar) {
      const a = document.createElement("a");
      a.href = u;
      a.download = archivo.nombre_original;
      a.click();
    } else {
      window.open(u, "_blank");
    }
    setTimeout(() => URL.revokeObjectURL(u), 60000);
  };

  const Icono = archivo.tipo_mime.includes("pdf") ? FileText : FileSpreadsheet;
  const visible = esImagen || archivo.tipo_mime.includes("pdf");

  if (compacto) {
    return (
      <button
        type="button"
        onClick={() => abrir(!visible)}
        title={archivo.nombre_original}
        className="inline-flex items-center justify-center w-14 h-14 rounded-md border border-gray-200 bg-white overflow-hidden hover:border-[#236093]"
      >
        {esImagen ? (
          url ? (
            <img src={url} alt={archivo.nombre_original} className="w-full h-full object-contain" />
          ) : (
            <Loader2 className="w-4 h-4 animate-spin text-gray-300" />
          )
        ) : (
          <Icono className="w-6 h-6 text-gray-400" />
        )}
      </button>
    );
  }

  return (
    <div className="border border-gray-100 rounded-lg overflow-hidden bg-white">
      <button
        type="button"
        onClick={() => abrir(!visible)}
        className="block w-full h-28 bg-gray-50 hover:bg-gray-100"
        title={visible ? "Abrir" : "Descargar"}
      >
        {esImagen ? (
          url ? (
            <img src={url} alt={archivo.nombre_original} className="w-full h-full object-cover" />
          ) : (
            <Loader2 className="w-5 h-5 mx-auto animate-spin text-gray-300" />
          )
        ) : (
          <Icono className="w-8 h-8 mx-auto text-gray-400" />
        )}
      </button>
      <div className="flex items-center gap-1 px-2 py-1.5">
        <span className="text-xs text-gray-600 truncate flex-1" title={archivo.nombre_original}>
          {archivo.nombre_original}
        </span>
        <button type="button" onClick={() => abrir(true)} className="text-gray-400 hover:text-[#236093]" title="Descargar">
          <Download className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
