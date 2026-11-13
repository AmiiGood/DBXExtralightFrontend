import { useState, useEffect } from "react";
import { PenLine, Loader2, AlertTriangle, CheckCircle2, Save, KeyRound, Lock, Trash2, X } from "lucide-react";
import { firmasService } from "../../services/firmas.service";
import { useAuthStore } from "../../stores/auth.store";
import LienzoFirma from "../../components/firmas/LienzoFirma";
import SelloFirma from "../../components/firmas/SelloFirma";
import ConfirmarFirma from "../../components/firmas/ConfirmarFirma";

/**
 * Mi firma.
 *
 * Cada quien dibuja su firma una sola vez (en la tablet o con el mouse) y
 * escoge un PIN de 4 a 6 números. Después, para firmar algo en el DBX (la orden
 * de compra, por ejemplo) solo escribe el PIN y se estampa esta firma con su
 * nombre, la fecha y la hora. Registrarla o cambiarla pide la contraseña del
 * DBX. El administrador ve quién tiene firma y puede quitarla (si olvidaron el
 * PIN).
 */

const mensajeError = (e) => e.response?.data?.message || e.message;
const fecha = (s) =>
  s ? new Date(s).toLocaleString("es-MX", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";
const estiloCampo =
  "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#236093]/30";

function Registro({ cambio, onListo, onCancelar }) {
  const [imagen, setImagen] = useState(null);
  const [pin, setPin] = useState("");
  const [pin2, setPin2] = useState("");
  const [password, setPassword] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);

  const pinOk = /^\d{4,6}$/.test(pin);
  const iguales = pin === pin2;
  const listo = imagen && pinOk && iguales && password;

  async function guardar(e) {
    e.preventDefault();
    setGuardando(true);
    setError(null);
    try {
      const r = await firmasService.registrar({ imagen, pin, password });
      onListo(r.message);
    } catch (err) {
      setError(mensajeError(err));
      setGuardando(false);
    }
  }

  const soloNumeros = (set) => (e) => set(e.target.value.replace(/\D/g, "").slice(0, 6));

  return (
    <form onSubmit={guardar} className="bg-white border border-gray-200 rounded-xl p-5 space-y-5">
      <div>
        <h2 className="font-semibold text-gray-900">{cambio ? "Cambiar mi firma y mi PIN" : "1. Dibuja tu firma"}</h2>
        <p className="text-sm text-gray-500">Con el dedo o la pluma en la tablet, o con el mouse. Fírmala como en papel.</p>
      </div>
      <LienzoFirma onCambio={setImagen} />

      <div className="grid gap-4 sm:grid-cols-3">
        <label className="block">
          <span className="block text-xs font-medium text-gray-500 mb-1">PIN para firmar (4 a 6 números)</span>
          <input
            type="password"
            inputMode="numeric"
            autoComplete="new-password"
            value={pin}
            onChange={soloNumeros(setPin)}
            className={`${estiloCampo} tracking-[0.3em]`}
          />
        </label>
        <label className="block">
          <span className="block text-xs font-medium text-gray-500 mb-1">Escríbelo otra vez</span>
          <input
            type="password"
            inputMode="numeric"
            autoComplete="new-password"
            value={pin2}
            onChange={soloNumeros(setPin2)}
            className={`${estiloCampo} tracking-[0.3em]`}
          />
          {pin2 && !iguales && <span className="text-xs text-red-600">No coincide</span>}
        </label>
        <label className="block">
          <span className="block text-xs font-medium text-gray-500 mb-1">Tu contraseña del DBX</span>
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={estiloCampo}
          />
          <span className="text-xs text-gray-400">Para confirmar que eres tú</span>
        </label>
      </div>
      <p className="text-xs text-gray-400">
        No uses el mismo número repetido (1111) ni una escalera (1234). El PIN no se lo pide nadie más: si lo olvidas,
        el administrador quita tu firma y la vuelves a registrar.
      </p>

      {error && (
        <p className="flex items-start gap-2 text-sm text-red-700 bg-red-50 rounded-lg px-3 py-2">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          {error}
        </p>
      )}

      <div className="flex justify-end gap-2">
        {cambio && (
          <button type="button" onClick={onCancelar} className="px-4 py-2 text-sm text-gray-600 rounded-lg hover:bg-gray-100">
            Cancelar
          </button>
        )}
        <button
          type="submit"
          disabled={!listo || guardando}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-[#236093] text-white rounded-lg hover:bg-[#1c4d76] disabled:opacity-40"
        >
          {guardando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {cambio ? "Guardar firma nueva" : "Registrar mi firma"}
        </button>
      </div>
    </form>
  );
}

/** Admin: quién tiene firma y quitarla. */
function FirmasRegistradas({ usuarioId, onCambio }) {
  const [lista, setLista] = useState(null);
  const [error, setError] = useState(null);
  const [aviso, setAviso] = useState(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let vivo = true;
    firmasService
      .todas()
      .then((r) => vivo && setLista(r))
      .catch((e) => vivo && setError(mensajeError(e)));
    return () => {
      vivo = false;
    };
  }, [version]);

  async function quitar(f) {
    if (!window.confirm(`¿Quitar la firma de ${f.nombre_completo}? Tendrá que registrarla otra vez para firmar.`)) return;
    try {
      const r = await firmasService.quitar(f.usuario_id);
      setAviso(r.message);
      setVersion((v) => v + 1);
      // Si quitó la suya, que arriba se vea el registro
      if (f.usuario_id === usuarioId) onCambio?.();
    } catch (e) {
      setError(mensajeError(e));
    }
  }

  return (
    <section className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
      <div>
        <h2 className="font-semibold text-gray-900">Firmas registradas</h2>
        <p className="text-sm text-gray-500">Solo lo ve el administrador. Quitar una firma sirve si alguien olvidó su PIN.</p>
      </div>
      {error && <p className="text-sm text-red-700">{error}</p>}
      {aviso && <p className="text-sm text-green-800 bg-green-50 rounded-lg px-3 py-2">{aviso}</p>}
      {!lista ? (
        <Loader2 className="w-5 h-5 animate-spin text-gray-300" />
      ) : lista.length === 0 ? (
        <p className="text-sm text-gray-400">Nadie ha registrado su firma todavía.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
              <th className="py-2 font-medium">Persona</th>
              <th className="py-2 font-medium">Rol</th>
              <th className="py-2 font-medium">Registrada</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {lista.map((f) => (
              <tr key={f.usuario_id} className="border-t border-gray-100">
                <td className="py-2 text-gray-900">
                  {f.nombre_completo}
                  {f.bloqueada && (
                    <span className="ml-2 inline-flex items-center gap-1 text-xs text-red-700">
                      <Lock className="w-3 h-3" />
                      Bloqueada
                    </span>
                  )}
                </td>
                <td className="py-2 text-gray-500">{f.rol || "—"}</td>
                <td className="py-2 text-gray-500">{fecha(f.creada_en)}</td>
                <td className="py-2 text-right">
                  <button onClick={() => quitar(f)} className="p-1.5 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50" title="Quitar firma">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

export default function MiFirmaPage() {
  const { user } = useAuthStore();
  const [firma, setFirma] = useState(null);
  const [error, setError] = useState(null);
  const [aviso, setAviso] = useState(null);
  const [cambiando, setCambiando] = useState(false);
  const [probando, setProbando] = useState(false);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let vivo = true;
    firmasService
      .mia()
      .then((f) => vivo && setFirma(f))
      .catch((e) => vivo && setError(mensajeError(e)));
    return () => {
      vivo = false;
    };
  }, [version]);

  return (
    <div className="p-6 space-y-5 max-w-4xl mx-auto">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-[#236093]/10 rounded-lg">
          <PenLine className="w-6 h-6 text-[#236093]" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Mi firma</h1>
          <p className="text-sm text-gray-500">
            Regístrala una sola vez. Para firmar en el DBX solo escribes tu PIN y se estampa con tu nombre, la fecha y la
            hora.
          </p>
        </div>
      </div>

      {error && <div className="text-sm text-red-700 bg-red-50 rounded-xl px-4 py-3">{error}</div>}
      {aviso && (
        <div className="flex items-center justify-between gap-2 text-sm text-green-800 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            {aviso}
          </span>
          <button onClick={() => setAviso(null)} className="text-green-700/60 hover:text-green-800">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {!firma ? (
        !error && (
          <div className="flex justify-center py-16">
            <Loader2 className="w-7 h-7 animate-spin text-gray-300" />
          </div>
        )
      ) : firma.registrada && !cambiando ? (
        <section className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex flex-wrap items-center gap-8">
            <SelloFirma imagen={firma.imagen} nombre={user?.nombreCompleto} como="Así se verá al firmar" />
            <div className="space-y-3 text-sm">
              <p className="text-gray-600">Registrada el {fecha(firma.creada_en)}</p>
              {firma.bloqueada_hasta && (
                <p className="flex items-center gap-2 text-red-700 bg-red-50 rounded-lg px-3 py-2">
                  <Lock className="w-4 h-4" />
                  Bloqueada por PIN equivocados hasta las{" "}
                  {new Date(firma.bloqueada_hasta).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}.
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setProbando(true)}
                  className="inline-flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  <KeyRound className="w-4 h-4" />
                  Probar mi PIN
                </button>
                <button
                  onClick={() => {
                    setAviso(null);
                    setCambiando(true);
                  }}
                  className="inline-flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  <PenLine className="w-4 h-4" />
                  Cambiar firma o PIN
                </button>
              </div>
            </div>
          </div>
        </section>
      ) : (
        <Registro
          cambio={firma.registrada}
          onCancelar={() => setCambiando(false)}
          onListo={(m) => {
            setAviso(m);
            setCambiando(false);
            setVersion((v) => v + 1);
          }}
        />
      )}

      {/* key: al registrar la suya, la lista se vuelve a pedir */}
      {firma?.esAdmin && (
        <FirmasRegistradas key={version} usuarioId={user?.id} onCambio={() => setVersion((v) => v + 1)} />
      )}

      {probando && (
        <ConfirmarFirma
          titulo="Probar mi PIN"
          como="Prueba: no se firma nada"
          textoBoton="Probar"
          onCerrar={() => setProbando(false)}
          onConfirmar={async (pin) => {
            const r = await firmasService.probar(pin);
            setProbando(false);
            setAviso(r.message);
          }}
        >
          Escribe tu PIN para revisar que lo recuerdas. No se firma nada, pero un PIN equivocado sí cuenta como intento.
        </ConfirmarFirma>
      )}
    </div>
  );
}
