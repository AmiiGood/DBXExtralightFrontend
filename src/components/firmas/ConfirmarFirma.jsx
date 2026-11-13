import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { X, Loader2, PenLine, AlertTriangle, Lock } from "lucide-react";
import { firmasService } from "../../services/firmas.service";
import { useAuthStore } from "../../stores/auth.store";
import SelloFirma from "./SelloFirma";

/**
 * Ventana para firmar algo con el PIN.
 *
 * Muestra cómo va a quedar la firma (la registrada, con el nombre y la hora) y
 * pide el PIN. `onConfirmar(pin)` hace lo que se firma; si truena, su mensaje
 * sale aquí (PIN equivocado, cuántos intentos quedan, bloqueada…).
 * Si la persona no tiene firma, la manda a registrarla.
 */
export default function ConfirmarFirma({ titulo = "Firmar", como, children, textoBoton = "Firmar", onConfirmar, onCerrar }) {
  const { user } = useAuthStore();
  const [firma, setFirma] = useState(null);
  const [pin, setPin] = useState("");
  const [error, setError] = useState(null);
  const [firmando, setFirmando] = useState(false);

  useEffect(() => {
    let vivo = true;
    firmasService
      .mia()
      .then((f) => vivo && setFirma(f))
      .catch((e) => vivo && setError(e.response?.data?.message || e.message));
    return () => {
      vivo = false;
    };
  }, []);

  useEffect(() => {
    const esc = (e) => e.key === "Escape" && !firmando && onCerrar();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onCerrar, firmando]);

  async function firmar(e) {
    e.preventDefault();
    setFirmando(true);
    setError(null);
    try {
      await onConfirmar(pin);
    } catch (err) {
      setError(err.response?.data?.message || err.message);
      setPin("");
      setFirmando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center bg-black/40 p-4 overflow-y-auto">
      <form onSubmit={firmar} className="bg-white rounded-xl shadow-xl w-full max-w-md my-10">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2">
            <PenLine className="w-5 h-5 text-[#236093]" />
            {titulo}
          </h2>
          <button type="button" onClick={onCerrar} disabled={firmando} className="p-1 rounded-lg text-gray-400 hover:bg-gray-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {children && <div className="text-sm text-gray-700">{children}</div>}

          {!firma && !error ? (
            <div className="flex justify-center py-6">
              <Loader2 className="w-6 h-6 animate-spin text-gray-300" />
            </div>
          ) : firma && !firma.registrada ? (
            <div className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-3">
              Todavía no registras tu firma. Hazlo una sola vez en{" "}
              <Link to="/mi-firma" className="font-medium underline">
                Mi firma
              </Link>{" "}
              y regresa a firmar.
            </div>
          ) : (
            firma && (
              <>
                <div className="flex justify-center bg-gray-50 rounded-lg py-3">
                  <SelloFirma imagen={firma.imagen} nombre={user?.nombreCompleto} como={como} />
                </div>
                {firma.bloqueada_hasta ? (
                  <p className="text-sm text-red-700 bg-red-50 rounded-lg px-3 py-2 flex items-center gap-2">
                    <Lock className="w-4 h-4 shrink-0" />
                    Tu firma está bloqueada por PIN equivocados. Intenta más tarde o pide al administrador que la quite.
                  </p>
                ) : (
                  <label className="block">
                    <span className="block text-xs font-medium text-gray-500 mb-1">Tu PIN de firma</span>
                    <input
                      type="password"
                      inputMode="numeric"
                      autoComplete="off"
                      maxLength={6}
                      value={pin}
                      onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                      autoFocus
                      className="w-full text-center tracking-[0.5em] text-xl border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#236093]/30"
                    />
                  </label>
                )}
              </>
            )
          )}

          {error && (
            <p className="flex items-start gap-2 text-sm text-red-700 bg-red-50 rounded-lg px-3 py-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              {error}
            </p>
          )}
        </div>

        <div className="flex justify-end gap-2 px-5 py-3 border-t border-gray-100">
          <button type="button" onClick={onCerrar} disabled={firmando} className="px-4 py-2 text-sm text-gray-600 rounded-lg hover:bg-gray-100">
            Cancelar
          </button>
          {firma?.registrada && !firma.bloqueada_hasta && (
            <button
              type="submit"
              disabled={firmando || pin.length < 4}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-[#236093] text-white rounded-lg hover:bg-[#1c4d76] disabled:opacity-40"
            >
              {firmando ? <Loader2 className="w-4 h-4 animate-spin" /> : <PenLine className="w-4 h-4" />}
              {textoBoton}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
