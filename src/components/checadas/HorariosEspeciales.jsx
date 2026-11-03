import { useState, useEffect, useRef } from "react";
import { CalendarClock, FileSpreadsheet, Loader2, Upload, X, CheckCircle2, AlertTriangle } from "lucide-react";
import { checadasService } from "../../services/checadas.service";

/**
 * Horarios especiales: quién no entra a los turnos de planta (C, A, B).
 *
 * RH lleva el libro "horarios compuesto y admon": los administrativos de 8:30 a
 * 18:00 y los de Compuestos de 12 horas (de día, de noche o rolando). A esas
 * personas el reporte las compara solo contra sus turnos.
 *
 * Mismo flujo en dos pasos que la carga de checadas. Cada carga REEMPLAZA la
 * lista: quien ya no viene en el libro regresa a los turnos generales.
 */

const rango = (t) => `${t.inicio} a ${t.fin}`;

function Grupo({ turnos, personas, perfiles }) {
  return (
    <div className="border border-gray-100 rounded-lg p-3">
      <p className="text-sm font-medium text-gray-900">
        {turnos.map((t, i) => (
          <span key={t.clave || i}>
            {i > 0 && <span className="text-gray-400 font-normal"> o </span>}
            {t.nombre ? `${t.nombre} (${rango(t)})` : rango(t)}
          </span>
        ))}
      </p>
      <p className="text-xs text-gray-500 mt-0.5">
        <b className="text-gray-700">{personas}</b> persona{personas === 1 ? "" : "s"}
        {perfiles?.length > 0 && ` · ${perfiles.join(", ")}`}
      </p>
    </div>
  );
}

export default function HorariosEspeciales() {
  const [vigente, setVigente] = useState(null);
  const [version, setVersion] = useState(0);
  const [archivo, setArchivo] = useState(null);
  const [analisis, setAnalisis] = useState(null);
  const [ocupado, setOcupado] = useState(null);
  const [aviso, setAviso] = useState(null);
  const inputRef = useRef(null);

  useEffect(() => {
    let vivo = true;
    checadasService
      .getHorarios()
      .then((r) => vivo && setVigente(r))
      .catch(() => vivo && setVigente({ grupos: [], personas: 0, ultimaCarga: null }));
    return () => {
      vivo = false;
    };
  }, [version]);

  const reiniciar = () => {
    setArchivo(null);
    setAnalisis(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const paso = async (tipo, fn) => {
    setOcupado(tipo);
    setAviso(null);
    try {
      await fn();
    } catch (e) {
      setAviso({ tipo: "error", texto: e.response?.data?.message || e.message });
    } finally {
      setOcupado(null);
    }
  };

  const analizar = () => paso("analizar", async () => setAnalisis(await checadasService.analizarHorarios(archivo)));

  const importar = () =>
    paso("importar", async () => {
      const r = await checadasService.importarHorarios(archivo);
      setAviso({
        tipo: "ok",
        texto:
          `Lista de horarios especiales actualizada: ${r.personas} personas.` +
          (r.turnosCreados.length
            ? ` Se dieron de alta los turnos ${r.turnosCreados.map((t) => `${t.nombre}`).join(", ")}.`
            : ""),
      });
      reiniciar();
      setVersion((v) => v + 1);
    });

  const a = analisis;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100">
      <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <CalendarClock className="w-4 h-4 text-gray-400" />
          <h3 className="font-semibold text-gray-900">Horarios especiales</h3>
        </div>
        {vigente?.ultimaCarga && (
          <span className="text-xs text-gray-400">
            {vigente.ultimaCarga.archivo || "Lista"} · {vigente.ultimaCarga.creado_texto}
            {vigente.ultimaCarga.usuario ? ` · ${vigente.ultimaCarga.usuario}` : ""}
          </span>
        )}
      </div>

      <div className="p-5 space-y-4">
        <p className="text-sm text-gray-500">
          Quien está en esta lista se compara contra <b>su</b> horario y no contra los turnos C, A y B. Los de
          Compuestos que rolan caen solos en el de día o en el de noche según la hora en que entran.
        </p>

        {!vigente ? (
          <Loader2 className="w-5 h-5 animate-spin text-gray-300" />
        ) : vigente.grupos.length === 0 ? (
          <p className="text-sm text-gray-400">Todavía no se ha cargado la lista: todos se comparan contra C, A y B.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {vigente.grupos.map((g) => (
              <Grupo key={g.turnos.join("-")} turnos={g.detalle || []} personas={g.personas} perfiles={g.perfiles} />
            ))}
          </div>
        )}

        {aviso && (
          <div
            className={`rounded-lg p-3 text-sm flex items-start gap-2 border ${
              aviso.tipo === "ok" ? "bg-green-50 border-green-200 text-green-700" : "bg-red-50 border-red-200 text-red-700"
            }`}
          >
            {aviso.tipo === "ok" ? <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" /> : <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />}
            <p>{aviso.texto}</p>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3 border-t border-gray-100 pt-4">
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls"
            id="archivo-horarios"
            className="hidden"
            onChange={(e) => {
              setArchivo(e.target.files?.[0] || null);
              setAnalisis(null);
              setAviso(null);
            }}
          />
          {archivo ? (
            <span className="inline-flex items-center gap-2 text-sm text-gray-700">
              <FileSpreadsheet className="w-4 h-4 text-secondary" />
              {archivo.name}
              <button onClick={reiniciar} className="text-gray-300 hover:text-red-500">
                <X className="w-4 h-4" />
              </button>
            </span>
          ) : (
            <label
              htmlFor="archivo-horarios"
              className="inline-flex items-center gap-2 px-3 py-2 text-sm border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50"
            >
              <Upload className="w-4 h-4" />
              Subir libro de horarios
            </label>
          )}
          {archivo && !a && (
            <button
              onClick={analizar}
              disabled={ocupado === "analizar"}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary-dark disabled:opacity-40"
            >
              {ocupado === "analizar" && <Loader2 className="w-4 h-4 animate-spin" />}
              Revisar contenido
            </button>
          )}
        </div>

        {a && (
          <div className="border border-gray-200 rounded-lg p-4 space-y-3 bg-gray-50/50">
            <p className="text-sm text-gray-800">
              El libro trae <b>{a.personas}</b> personas con horario especial (hoja "{a.hoja}").
              {a.cambios.antes > 0 &&
                ` Contra la lista actual: ${a.cambios.nuevas} nuevas, ${a.cambios.siguen} siguen y ${a.cambios.salen} salen (regresan a C, A y B).`}
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {a.grupos.map((g, i) => (
                <Grupo
                  key={i}
                  turnos={g.opciones.map((o) => (o.turno ? { ...o.turno, inicio: o.inicio, fin: o.fin } : o))}
                  personas={g.personas}
                  perfiles={g.perfiles}
                />
              ))}
            </div>
            {a.turnosNuevos.length > 0 && (
              <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                Estos horarios todavía no existen como turno y se darán de alta al cargar, con 20 minutos de
                tolerancia: {a.turnosNuevos.join(", ")}.
              </p>
            )}
            {a.avisos.length > 0 && (
              <ul className="text-sm text-gray-500 list-disc list-inside space-y-0.5">
                {a.avisos.map((t, i) => (
                  <li key={i}>{t}</li>
                ))}
              </ul>
            )}
            <div className="flex justify-end gap-2">
              <button onClick={reiniciar} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">
                Cancelar
              </button>
              <button
                onClick={importar}
                disabled={ocupado === "importar" || a.personas === 0}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary-dark disabled:opacity-40"
              >
                {ocupado === "importar" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                {vigente?.personas ? "Reemplazar la lista" : "Cargar la lista"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
