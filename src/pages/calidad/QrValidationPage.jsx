import { useState, useEffect, useRef, useCallback } from "react";
import {
  QrCode,
  Search,
  RefreshCw,
  Upload,
  History,
  Package,
  CheckCircle,
  XCircle,
  Database,
  Clock,
  ChevronLeft,
  ChevronRight,
  X,
  FileSpreadsheet,
  Loader2,
  AlertTriangle,
  Eye,
  Filter,
  Zap,
  Camera,
  CameraOff,
  Keyboard,
} from "lucide-react";
import { useAuthStore } from "../../stores/auth.store";
import api from "../../services/api";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";

export default function QrValidationPage() {
  const { user } = useAuthStore();
  const isAdmin = user?.rol?.esAdmin || user?.rol?.nombre === "Administrador";
  const tabs = [
    { id: "escanear", label: "Escanear QR", icon: QrCode },
    { id: "historial", label: "Historial", icon: History },
    ...(isAdmin
      ? [
          { id: "productos", label: "Productos", icon: Package },
          { id: "configuracion", label: "Configuración", icon: Database },
        ]
      : []),
  ];
  const [activeTab, setActiveTab] = useState("escanear");

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="flex overflow-x-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${activeTab === tab.id ? "border-primary text-primary bg-primary/5" : "border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50"}`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>
      {activeTab === "escanear" && <TabEscanear />}
      {activeTab === "historial" && <TabHistorial />}
      {activeTab === "productos" && isAdmin && <TabProductos />}
      {activeTab === "configuracion" && isAdmin && <TabConfiguracion />}
    </div>
  );
}

function InfoField({ label, value, highlight = false }) {
  return (
    <div>
      <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">
        {label}
      </p>
      <p
        className={`text-sm ${highlight ? "font-bold text-primary text-base" : "font-medium text-gray-900"}`}
      >
        {value || "—"}
      </p>
    </div>
  );
}

// ============================================
// Componente de Escáner QR con Cámara
// ============================================
function QrCameraScanner({ onScan, onError, scanning }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const animFrameRef = useRef(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [cameras, setCameras] = useState([]);
  const [selectedCamera, setSelectedCamera] = useState("environment");
  const [jsQR, setJsQR] = useState(null);
  const lastScannedRef = useRef("");
  const lastScannedTimeRef = useRef(0);

  // Cargar jsQR dinámicamente
  useEffect(() => {
    let mounted = true;
    const loadJsQR = async () => {
      try {
        const module = await import("jsqr");
        if (mounted) {
          setJsQR(() => module.default || module);
        }
      } catch (err) {
        console.error("Error cargando jsQR:", err);
        if (mounted) {
          setCameraError(
            "Error al cargar el lector de QR. Verifica que jsqr esté instalado (npm install jsqr).",
          );
        }
      }
    };
    loadJsQR();

    return () => {
      mounted = false;
      stopScanner();
    };
  }, []);

  // Obtener lista de cámaras cuando hay permisos
  const fetchCameras = async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter((d) => d.kind === "videoinput");
      setCameras(videoDevices);
    } catch (e) {
      console.error("Error enumerando cámaras:", e);
    }
  };

  const startScanner = async () => {
    if (!jsQR) {
      setCameraError("El lector QR aún no está listo. Espera un momento.");
      return;
    }

    setCameraError(null);

    try {
      // Detener stream anterior si existe
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }

      // Configurar constraints — usar facingMode para tablets
      let constraints;
      if (selectedCamera === "environment" || selectedCamera === "user") {
        constraints = {
          video: {
            facingMode: { ideal: selectedCamera },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        };
      } else {
        // Si es un deviceId específico
        constraints = {
          video: {
            deviceId: { exact: selectedCamera },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        };
      }

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      // Obtener cámaras disponibles después de tener permiso
      await fetchCameras();

      const video = videoRef.current;
      if (!video) return;

      video.srcObject = stream;
      video.setAttribute("playsinline", "true"); // Importante para iOS/tablets
      video.setAttribute("autoplay", "true");
      video.muted = true;

      await video.play();
      setCameraActive(true);

      // Iniciar escaneo continuo
      requestAnimationFrame(() => scanFrame());
    } catch (err) {
      console.error("Error al iniciar cámara:", err);

      let errorMsg = "No se pudo acceder a la cámara.";
      if (err.name === "NotAllowedError") {
        errorMsg =
          "Permiso de cámara denegado. Ve a la configuración del navegador y permite el acceso a la cámara.";
      } else if (err.name === "NotFoundError") {
        errorMsg = "No se encontró ninguna cámara en este dispositivo.";
      } else if (err.name === "NotReadableError" || err.name === "AbortError") {
        errorMsg =
          "La cámara está siendo usada por otra aplicación. Ciérrala e intenta de nuevo.";
      } else if (err.name === "OverconstrainedError") {
        // Intentar fallback sin constraints específicos
        try {
          const fallbackStream = await navigator.mediaDevices.getUserMedia({
            video: true,
          });
          streamRef.current = fallbackStream;
          const video = videoRef.current;
          if (video) {
            video.srcObject = fallbackStream;
            video.setAttribute("playsinline", "true");
            video.muted = true;
            await video.play();
            setCameraActive(true);
            await fetchCameras();
            requestAnimationFrame(() => scanFrame());
            return;
          }
        } catch (fallbackErr) {
          errorMsg =
            "No se pudo configurar la cámara. Intenta seleccionar otra cámara.";
        }
      }

      setCameraError(errorMsg);
    }
  };

  const scanFrame = () => {
    if (!videoRef.current || !canvasRef.current || !jsQR) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });

    if (video.readyState !== video.HAVE_ENOUGH_DATA) {
      animFrameRef.current = requestAnimationFrame(scanFrame);
      return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: "dontInvert",
    });

    if (code && code.data) {
      const now = Date.now();
      // Debounce: no repetir el mismo código en 3 segundos
      if (
        code.data !== lastScannedRef.current ||
        now - lastScannedTimeRef.current >= 3000
      ) {
        lastScannedRef.current = code.data;
        lastScannedTimeRef.current = now;

        // Solo enviar texto, nunca abrir URL
        onScan(code.data.trim());
      }
    }

    animFrameRef.current = requestAnimationFrame(scanFrame);
  };

  const stopScanner = () => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  };

  const handleCameraChange = async (newCameraId) => {
    setSelectedCamera(newCameraId);
    if (cameraActive) {
      stopScanner();
      // Pequeño delay antes de reiniciar con la nueva cámara
      setTimeout(() => startScanner(), 300);
    }
  };

  return (
    <div className="space-y-4">
      {/* Selector de cámara */}
      {cameras.length > 1 && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Cámara
          </label>
          <select
            className="w-full px-4 py-2.5 rounded-lg border border-gray-300 bg-white text-gray-900 focus:border-primary focus:ring-2 focus:ring-primary/20"
            value={selectedCamera}
            onChange={(e) => handleCameraChange(e.target.value)}
          >
            <option value="environment">📷 Cámara Trasera</option>
            <option value="user">🤳 Cámara Frontal</option>
            {cameras.map((cam, idx) => (
              <option key={cam.deviceId} value={cam.deviceId}>
                {cam.label || `Cámara ${idx + 1}`}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Área del visor de cámara */}
      <div className="relative">
        {/* Video real de la cámara */}
        <div
          className={`relative w-full rounded-xl overflow-hidden bg-black ${
            !cameraActive ? "hidden" : ""
          }`}
        >
          <video
            ref={videoRef}
            className="w-full rounded-xl"
            style={{ maxHeight: "400px", objectFit: "cover" }}
            playsInline
            muted
            autoPlay
          />

          {/* Overlay con guía de escaneo */}
          {cameraActive && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-56 h-56 border-2 border-white/70 rounded-2xl relative">
                {/* Esquinas resaltadas */}
                <div className="absolute -top-0.5 -left-0.5 w-8 h-8 border-t-4 border-l-4 border-primary rounded-tl-xl" />
                <div className="absolute -top-0.5 -right-0.5 w-8 h-8 border-t-4 border-r-4 border-primary rounded-tr-xl" />
                <div className="absolute -bottom-0.5 -left-0.5 w-8 h-8 border-b-4 border-l-4 border-primary rounded-bl-xl" />
                <div className="absolute -bottom-0.5 -right-0.5 w-8 h-8 border-b-4 border-r-4 border-primary rounded-br-xl" />
                {/* Línea de escaneo animada */}
                <div
                  className="absolute left-2 right-2 h-0.5 bg-primary/80 animate-pulse"
                  style={{
                    top: "50%",
                    boxShadow: "0 0 8px rgba(35, 96, 147, 0.6)",
                  }}
                />
              </div>
              <p className="absolute bottom-4 text-white text-sm bg-black/50 px-3 py-1 rounded-full">
                Apunta al código QR
              </p>
            </div>
          )}
        </div>

        {/* Canvas oculto para procesar frames */}
        <canvas ref={canvasRef} className="hidden" />

        {!cameraActive && (
          <div className="flex flex-col items-center justify-center py-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-300">
            <Camera className="w-16 h-16 text-gray-300 mb-4" />
            <p className="text-gray-500 text-sm mb-1">Cámara desactivada</p>
            <p className="text-gray-400 text-xs">
              Presiona "Activar Cámara" para comenzar a escanear
            </p>
          </div>
        )}
      </div>

      {/* Error de cámara */}
      {cameraError && (
        <div className="bg-red-50 rounded-lg p-3 border border-red-200">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">{cameraError}</p>
          </div>
        </div>
      )}

      {/* Botón de activar/desactivar */}
      <div className="flex justify-center gap-3">
        {!cameraActive ? (
          <Button
            onClick={startScanner}
            disabled={!jsQR || scanning}
            className="px-8"
          >
            <Camera className="w-5 h-5 mr-2" />
            Activar Cámara
          </Button>
        ) : (
          <Button variant="outline" onClick={stopScanner} className="px-8">
            <CameraOff className="w-5 h-5 mr-2" />
            Detener Cámara
          </Button>
        )}
      </div>
    </div>
  );
}

// ============================================
// Utilidad de sonidos con AudioContext (sin archivos externos)
// ============================================
const useScanSounds = () => {
  const audioCtxRef = useRef(null);

  const getAudioContext = () => {
    if (!audioCtxRef.current || audioCtxRef.current.state === "closed") {
      audioCtxRef.current = new (
        window.AudioContext || window.webkitAudioContext
      )();
    }
    // Reanudar si está suspendido (restricción de autoplay en navegadores)
    if (audioCtxRef.current.state === "suspended") {
      audioCtxRef.current.resume();
    }
    return audioCtxRef.current;
  };

  const playTone = (frequencies, durations, type = "sine", volume = 0.35) => {
    try {
      const ctx = getAudioContext();
      const gainNode = ctx.createGain();
      gainNode.connect(ctx.destination);

      let startTime = ctx.currentTime;

      frequencies.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const dur = durations[i] || durations[0];

        osc.type = type;
        osc.frequency.setValueAtTime(freq, startTime);

        const noteGain = ctx.createGain();
        noteGain.gain.setValueAtTime(volume, startTime);
        noteGain.gain.exponentialRampToValueAtTime(0.01, startTime + dur);

        osc.connect(noteGain);
        noteGain.connect(ctx.destination);

        osc.start(startTime);
        osc.stop(startTime + dur);

        startTime += dur * 0.7; // Ligero overlap entre notas
      });
    } catch (e) {
      console.warn("Error reproduciendo sonido:", e);
    }
  };

  // Sonido de éxito: dos tonos ascendentes alegres
  const playSuccess = () => {
    playTone([660, 880, 1100], [0.12, 0.12, 0.2], "sine", 0.3);
  };

  // Sonido de error: tono bajo descendente
  const playError = () => {
    playTone([400, 280], [0.2, 0.35], "square", 0.2);
  };

  // Sonido de escaneo detectado (beep corto al leer QR)
  const playBeep = () => {
    playTone([1200], [0.08], "sine", 0.25);
  };

  return { playSuccess, playError, playBeep };
};

// ============================================
// TabEscanear actualizado con cámara y manual
// ============================================
function TabEscanear() {
  const [qrInput, setQrInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [error, setError] = useState(null);
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleScan = async () => {
    if (!qrInput.trim()) return;
    setLoading(true);
    setError(null);
    setResultado(null);
    try {
      const response = await api.post("/qr/escanear", {
        qrCode: qrInput.trim(),
      });
      if (response.data.status === "success") {
        setResultado(response.data.data.escaneo);
      }
    } catch (err) {
      setError(err.response?.data?.message || "Error al procesar el código QR");
    } finally {
      setLoading(false);
      setQrInput("");
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  const handleClear = () => {
    setResultado(null);
    setError(null);
    setQrInput("");
    inputRef.current?.focus();
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <QrCode className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              Escanear Código QR
            </h3>
            <p className="text-sm text-gray-500">
              Usa el escáner o ingresa el código manualmente
            </p>
          </div>
        </div>

        <div className="flex gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              ref={inputRef}
              type="text"
              className="w-full pl-11 pr-4 py-3 rounded-lg border-2 border-primary/30 bg-primary/5 text-gray-900 text-lg focus:border-primary focus:ring-2 focus:ring-primary/20 placeholder-gray-400"
              placeholder="Esperando lectura del escáner..."
              value={qrInput}
              onChange={(e) => setQrInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleScan();
                }
              }}
              autoFocus
            />
          </div>
          <Button onClick={handleScan} isLoading={loading} className="px-6">
            <Search className="w-5 h-5 mr-2" />
            Validar
          </Button>
          {(resultado || error) && (
            <Button variant="ghost" onClick={handleClear}>
              <X className="w-5 h-5" />
            </Button>
          )}
        </div>
        <p className="text-xs text-gray-400 mt-2">
          El campo acepta lectura directa del escáner (presiona Enter
          automáticamente) o entrada manual
        </p>
      </div>

      {loading && (
        <div className="bg-white rounded-xl shadow-sm p-12 border border-gray-100 text-center">
          <Loader2 className="w-12 h-12 text-primary animate-spin mx-auto mb-3" />
          <p className="text-gray-500">Buscando información del producto...</p>
        </div>
      )}

      {error && !loading && (
        <div className="bg-red-50 rounded-xl p-6 border border-red-200">
          <div className="flex items-center gap-3">
            <XCircle className="w-8 h-8 text-red-500 flex-shrink-0" />
            <div>
              <h4 className="font-semibold text-red-900">
                No se encontró información
              </h4>
              <p className="text-sm text-red-700 mt-1">{error}</p>
            </div>
          </div>
        </div>
      )}

      {resultado && !loading && (
        <div className="space-y-4">
          <div
            className={`rounded-xl p-4 border ${resultado.productoEncontrado ? "bg-green-50 border-green-200" : resultado.qrEncontrado ? "bg-yellow-50 border-yellow-200" : "bg-red-50 border-red-200"}`}
          >
            <div className="flex items-center gap-3">
              {resultado.productoEncontrado ? (
                <CheckCircle className="w-8 h-8 text-green-500 flex-shrink-0" />
              ) : resultado.qrEncontrado ? (
                <AlertTriangle className="w-8 h-8 text-yellow-500 flex-shrink-0" />
              ) : (
                <XCircle className="w-8 h-8 text-red-500 flex-shrink-0" />
              )}
              <div>
                <h4
                  className={`font-semibold ${resultado.productoEncontrado ? "text-green-900" : resultado.qrEncontrado ? "text-yellow-900" : "text-red-900"}`}
                >
                  {resultado.productoEncontrado
                    ? "✅ Producto Encontrado"
                    : resultado.qrEncontrado
                      ? "⚠️ QR encontrado pero sin producto en catálogo"
                      : "❌ QR no registrado en el sistema"}
                </h4>
                <p
                  className={`text-sm mt-0.5 ${resultado.productoEncontrado ? "text-green-700" : resultado.qrEncontrado ? "text-yellow-700" : "text-red-700"}`}
                >
                  QR: {resultado.qrNormalizado}
                  {resultado.upc && ` → UPC: ${resultado.upc}`}
                </p>
              </div>
            </div>
          </div>

          {resultado.productoEncontrado && resultado.productos?.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
                <h4 className="font-semibold text-gray-900">
                  Información del Producto
                </h4>
              </div>
              <div className="divide-y divide-gray-100">
                {resultado.productos.map((p, idx) => (
                  <div key={idx} className="p-6">
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      <InfoField label="SKU" value={p.sku} />
                      <InfoField label="UPC" value={p.upc} />
                      <InfoField label="Style No." value={p.styleNo} />
                      <InfoField
                        label="Style Name"
                        value={p.styleName}
                        highlight
                      />
                      <InfoField label="Color" value={p.color} />
                      <InfoField label="Size" value={p.size} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TabHistorial() {
  const [escaneos, setEscaneos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedEscaneo, setSelectedEscaneo] = useState(null);
  const [filters, setFilters] = useState({
    fechaInicio: new Date().toISOString().split("T")[0],
    fechaFin: new Date().toISOString().split("T")[0],
    productoEncontrado: "",
  });
  const [pagination, setPagination] = useState({
    total: 0,
    limit: 20,
    offset: 0,
    pages: 0,
  });
  useEffect(() => {
    fetchEscaneos();
  }, [pagination.offset]);

  const fetchEscaneos = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        limit: pagination.limit.toString(),
        offset: pagination.offset.toString(),
      });
      if (filters.fechaInicio)
        params.append("fechaInicio", `${filters.fechaInicio}T00:00:00`);
      if (filters.fechaFin)
        params.append("fechaFin", `${filters.fechaFin}T23:59:59`);
      if (filters.productoEncontrado)
        params.append("productoEncontrado", filters.productoEncontrado);
      const response = await api.get(`/qr/escaneos?${params}`);
      if (response.data.status === "success") {
        setEscaneos(response.data.data.escaneos);
        setPagination((prev) => ({
          ...prev,
          ...response.data.data.pagination,
        }));
      }
    } catch (error) {
      console.error("Error fetching escaneos:", error);
    } finally {
      setLoading(false);
    }
  };
  const handleSearch = () => {
    setPagination((prev) => ({ ...prev, offset: 0 }));
    fetchEscaneos();
  };
  const currentPage = Math.floor(pagination.offset / pagination.limit) + 1;

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
        <div className="flex flex-wrap items-end gap-4">
          <Input
            type="date"
            label="Fecha Inicio"
            value={filters.fechaInicio}
            onChange={(e) =>
              setFilters((p) => ({ ...p, fechaInicio: e.target.value }))
            }
          />
          <Input
            type="date"
            label="Fecha Fin"
            value={filters.fechaFin}
            onChange={(e) =>
              setFilters((p) => ({ ...p, fechaFin: e.target.value }))
            }
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Estado
            </label>
            <select
              className="w-full px-4 py-2.5 rounded-lg border border-gray-300 bg-white text-gray-900 focus:border-primary focus:ring-2 focus:ring-primary/20"
              value={filters.productoEncontrado}
              onChange={(e) =>
                setFilters((p) => ({
                  ...p,
                  productoEncontrado: e.target.value,
                }))
              }
            >
              <option value="">Todos</option>
              <option value="true">Encontrados</option>
              <option value="false">No encontrados</option>
            </select>
          </div>
          <Button onClick={handleSearch}>
            <Filter className="w-4 h-4 mr-2" />
            Buscar
          </Button>
        </div>
      </div>
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                  Fecha/Hora
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                  QR
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                  UPC
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                  Estado
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                  Usuario
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                  Turno
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">
                  Detalle
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-8 text-center text-gray-500"
                  >
                    Cargando...
                  </td>
                </tr>
              ) : escaneos.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-8 text-center text-gray-500"
                  >
                    No hay escaneos registrados
                  </td>
                </tr>
              ) : (
                escaneos.map((e) => (
                  <tr key={e.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                      {new Date(e.creado_en).toLocaleString("es-MX")}
                    </td>
                    <td className="px-4 py-3 text-sm font-mono text-gray-900">
                      {e.qr_normalizado || "—"}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {e.upc_encontrado || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${e.producto_encontrado ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}
                      >
                        {e.producto_encontrado ? (
                          <>
                            <CheckCircle className="w-3 h-3" />
                            Encontrado
                          </>
                        ) : (
                          <>
                            <XCircle className="w-3 h-3" />
                            No encontrado
                          </>
                        )}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {e.escaneado_por_nombre || "—"}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {e.turno_nombre || "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => setSelectedEscaneo(e)}
                        className="p-1.5 text-gray-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {pagination.pages > 1 && (
          <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between">
            <p className="text-sm text-gray-500">
              Mostrando {pagination.offset + 1} a{" "}
              {Math.min(pagination.offset + pagination.limit, pagination.total)}{" "}
              de {pagination.total}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() =>
                  setPagination((p) => ({ ...p, offset: p.offset - p.limit }))
                }
                disabled={pagination.offset === 0}
                className="p-2 rounded-lg border border-gray-200 disabled:opacity-50 hover:bg-gray-50"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm text-gray-700">
                Página {currentPage} de {pagination.pages}
              </span>
              <button
                onClick={() =>
                  setPagination((p) => ({ ...p, offset: p.offset + p.limit }))
                }
                disabled={currentPage >= pagination.pages}
                className="p-2 rounded-lg border border-gray-200 disabled:opacity-50 hover:bg-gray-50"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
      {selectedEscaneo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setSelectedEscaneo(null)}
          />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                Detalle del Escaneo
              </h3>
              <button
                onClick={() => setSelectedEscaneo(null)}
                className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3">
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500 mb-1">QR Raw</p>
                <p className="text-sm font-mono text-gray-900 break-all">
                  {selectedEscaneo.qr_raw}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500 mb-1">QR Normalizado</p>
                  <p className="text-sm font-mono font-medium text-gray-900">
                    {selectedEscaneo.qr_normalizado || "—"}
                  </p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500 mb-1">UPC</p>
                  <p className="text-sm font-mono font-medium text-gray-900">
                    {selectedEscaneo.upc_encontrado || "—"}
                  </p>
                </div>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500 mb-1">Estado</p>
                <span
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${selectedEscaneo.producto_encontrado ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}
                >
                  {selectedEscaneo.producto_encontrado
                    ? "Producto Encontrado"
                    : "No Encontrado"}
                </span>
              </div>
              {selectedEscaneo.resultado && (
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500 mb-2">Resultado</p>
                  <pre className="text-xs text-gray-700 overflow-x-auto bg-white p-2 rounded border border-gray-200">
                    {JSON.stringify(
                      typeof selectedEscaneo.resultado === "string"
                        ? JSON.parse(selectedEscaneo.resultado)
                        : selectedEscaneo.resultado,
                      null,
                      2,
                    )}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TabProductos() {
  const [productos, setProductos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [pagination, setPagination] = useState({
    total: 0,
    limit: 20,
    offset: 0,
    pages: 0,
  });
  useEffect(() => {
    fetchProductos();
  }, [pagination.offset]);

  const fetchProductos = async (search) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        limit: pagination.limit.toString(),
        offset: pagination.offset.toString(),
      });
      const s = search !== undefined ? search : searchTerm;
      if (s) params.append("search", s);
      const response = await api.get(`/qr/productos?${params}`);
      if (response.data.status === "success") {
        setProductos(response.data.data.productos);
        setPagination((p) => ({ ...p, ...response.data.data.pagination }));
      }
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setLoading(false);
    }
  };
  const handleSearch = () => {
    setPagination((p) => ({ ...p, offset: 0 }));
    fetchProductos();
  };
  const currentPage = Math.floor(pagination.offset / pagination.limit) + 1;

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-300 bg-white text-gray-900 focus:border-primary focus:ring-2 focus:ring-primary/20"
              placeholder="Buscar por SKU, UPC, Style Name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            />
          </div>
          <Button onClick={handleSearch}>Buscar</Button>
        </div>
      </div>
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                  SKU
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                  UPC
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                  Style No.
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                  Style Name
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                  Color
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                  Size
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-8 text-center text-gray-500"
                  >
                    Cargando...
                  </td>
                </tr>
              ) : productos.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-8 text-center text-gray-500"
                  >
                    No hay productos.
                  </td>
                </tr>
              ) : (
                productos.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-mono text-gray-900">
                      {p.sku}
                    </td>
                    <td className="px-4 py-3 text-sm font-mono text-gray-500">
                      {p.upc}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {p.style_no || "—"}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      {p.style_name || "—"}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {p.color || "—"}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {p.size || "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {pagination.pages > 1 && (
          <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between">
            <p className="text-sm text-gray-500">
              {pagination.total} productos en total
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() =>
                  setPagination((p) => ({ ...p, offset: p.offset - p.limit }))
                }
                disabled={pagination.offset === 0}
                className="p-2 rounded-lg border border-gray-200 disabled:opacity-50 hover:bg-gray-50"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm text-gray-700">
                Página {currentPage} de {pagination.pages}
              </span>
              <button
                onClick={() =>
                  setPagination((p) => ({ ...p, offset: p.offset + p.limit }))
                }
                disabled={currentPage >= pagination.pages}
                className="p-2 rounded-lg border border-gray-200 disabled:opacity-50 hover:bg-gray-50"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function TabConfiguracion() {
  const [dashboard, setDashboard] = useState(null);
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncResult, setSyncResult] = useState(null);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const [lastGetTime, setLastGetTime] = useState("");
  const [sincronizaciones, setSincronizaciones] = useState([]);
  const [cargasExcel, setCargasExcel] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const fileInputRef = useRef(null);

  useEffect(() => {
    fetchDashboard();
    fetchHistorial();
  }, []);

  const fetchDashboard = async () => {
    try {
      const r = await api.get("/qr/dashboard");
      if (r.data.status === "success") setDashboard(r.data.data);
    } catch (e) {
      console.error(e);
    }
  };
  const fetchHistorial = async () => {
    setLoadingHistory(true);
    try {
      const [s, c] = await Promise.all([
        api.get("/qr/sincronizaciones"),
        api.get("/qr/cargas-excel"),
      ]);
      if (s.data.status === "success")
        setSincronizaciones(s.data.data.sincronizaciones || []);
      if (c.data.status === "success") setCargasExcel(c.data.data.cargas || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleSync = async () => {
    setSyncLoading(true);
    setSyncResult(null);
    try {
      const body = lastGetTime ? { lastGetTime } : {};
      const r = await api.post("/qr/sincronizar", body);
      if (r.data.status === "success") {
        setSyncResult({
          success: true,
          data: r.data.data.sincronizacion,
          message: r.data.message,
        });
        fetchDashboard();
        fetchHistorial();
      }
    } catch (e) {
      setSyncResult({
        success: false,
        message: e.response?.data?.message || "Error al sincronizar con TUS",
      });
    } finally {
      setSyncLoading(false);
    }
  };

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadLoading(true);
    setUploadResult(null);
    const fd = new FormData();
    fd.append("archivo", file);
    try {
      const r = await api.post("/qr/cargar-excel", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      if (r.data.status === "success") {
        setUploadResult({
          success: true,
          data: r.data.data.carga,
          message: r.data.message,
        });
        fetchDashboard();
        fetchHistorial();
      }
    } catch (err) {
      setUploadResult({
        success: false,
        message: err.response?.data?.message || "Error al cargar el archivo",
      });
    } finally {
      setUploadLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-6">
      {dashboard && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <QrCode className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Mapeos QR→UPC</p>
                <p className="text-xl font-bold text-gray-900">
                  {dashboard.totalMapeos?.toLocaleString() || 0}
                </p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-secondary/10 flex items-center justify-center">
                <Package className="w-5 h-5 text-secondary" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Productos en Catálogo</p>
                <p className="text-xl font-bold text-gray-900">
                  {dashboard.totalProductos?.toLocaleString() || 0}
                </p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
                <Clock className="w-5 h-5 text-accent" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Última Sincronización</p>
                <p className="text-sm font-medium text-gray-900">
                  {dashboard.ultimaSincronizacion
                    ? new Date(
                        dashboard.ultimaSincronizacion.fecha,
                      ).toLocaleString("es-MX")
                    : "Nunca"}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
              <RefreshCw className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">
                Sincronizar API TUS
              </h3>
              <p className="text-sm text-gray-500">Descargar mapeos QR → UPC</p>
            </div>
          </div>
          <div className="space-y-3">
            <Input
              type="text"
              label="Fecha desde (opcional)"
              placeholder="2025-01-01 00:00:00"
              value={lastGetTime}
              onChange={(e) => setLastGetTime(e.target.value)}
            />
            <p className="text-xs text-gray-400">
              Si se deja vacío, se usa la fecha de la última sincronización
              exitosa
            </p>
            <Button
              onClick={handleSync}
              isLoading={syncLoading}
              className="w-full"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Sincronizar Ahora
            </Button>
          </div>
          {syncResult && (
            <div
              className={`mt-4 p-3 rounded-lg text-sm ${syncResult.success ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}
            >
              <p className="font-medium">{syncResult.message}</p>
              {syncResult.data && (
                <div className="mt-2 text-xs space-y-0.5">
                  <p>Recibidos: {syncResult.data.totalRecibidos}</p>
                  <p>Nuevos: {syncResult.data.nuevosInsertados}</p>
                  <p>Ya existentes: {syncResult.data.yaExistentes}</p>
                  <p>Total en BD: {syncResult.data.totalMapeosEnBD}</p>
                </div>
              )}
            </div>
          )}
        </div>
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
              <FileSpreadsheet className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">
                Cargar Catálogo de Productos
              </h3>
              <p className="text-sm text-gray-500">
                Archivo Excel con SKU, UPC, StyleNo, StyleName, Color, Size
              </p>
            </div>
          </div>
          <div className="space-y-3">
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleUpload}
              className="hidden"
            />
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-primary hover:bg-primary/5 transition-colors"
            >
              {uploadLoading ? (
                <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto mb-2" />
              ) : (
                <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
              )}
              <p className="text-sm font-medium text-gray-700">
                {uploadLoading
                  ? "Procesando archivo..."
                  : "Haz clic para seleccionar archivo"}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                .xlsx, .xls o .csv (máx 10MB)
              </p>
            </div>
          </div>
          {uploadResult && (
            <div
              className={`mt-4 p-3 rounded-lg text-sm ${uploadResult.success ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}
            >
              <p className="font-medium">{uploadResult.message}</p>
              {uploadResult.data && (
                <div className="mt-2 text-xs space-y-0.5">
                  <p>Total filas: {uploadResult.data.totalFilas}</p>
                  <p>Válidos: {uploadResult.data.productosValidos}</p>
                  <p>Nuevos: {uploadResult.data.nuevos}</p>
                  <p>Actualizados: {uploadResult.data.actualizados}</p>
                  {uploadResult.data.errores > 0 && (
                    <p className="text-red-600">
                      Errores: {uploadResult.data.errores}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <h4 className="font-semibold text-gray-900 mb-3">
            Últimas Sincronizaciones TUS
          </h4>
          {loadingHistory ? (
            <p className="text-sm text-gray-500">Cargando...</p>
          ) : sincronizaciones.length === 0 ? (
            <p className="text-sm text-gray-500">Sin sincronizaciones</p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {sincronizaciones.slice(0, 10).map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0"
                >
                  <div>
                    <p className="text-sm text-gray-900">
                      {new Date(s.creado_en).toLocaleString("es-MX")}
                    </p>
                    <p className="text-xs text-gray-500">
                      {s.ejecutado_por_nombre || "Sistema"}
                    </p>
                  </div>
                  <span
                    className={`text-xs font-medium px-2 py-0.5 rounded-full ${s.estado === "success" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}
                  >
                    {s.total_registros || 0} recibidos /{" "}
                    {s.nuevos_registros || 0} nuevos
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <h4 className="font-semibold text-gray-900 mb-3">
            Últimas Cargas de Excel
          </h4>
          {loadingHistory ? (
            <p className="text-sm text-gray-500">Cargando...</p>
          ) : cargasExcel.length === 0 ? (
            <p className="text-sm text-gray-500">Sin cargas</p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {cargasExcel.slice(0, 10).map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0"
                >
                  <div>
                    <p className="text-sm text-gray-900 truncate max-w-48">
                      {c.nombre_archivo}
                    </p>
                    <p className="text-xs text-gray-500">
                      {new Date(c.creado_en).toLocaleString("es-MX")} —{" "}
                      {c.cargado_por_nombre}
                    </p>
                  </div>
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                    {c.registros_nuevos} nuevos / {c.registros_actualizados}{" "}
                    actualizados
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
