import { useState, useRef, useEffect, useCallback } from "react";

// ─── STORAGE KEY ───
const STORAGE_KEY = "passagene_camera_settings";

// ─── DEFAULT PRO SETTINGS (tabela do laboratório) ───
const DEFAULT_SETTINGS = {
  // Resolução & Frame
  width: 1920,
  height: 1080,
  frameRate: 60,
  // Lente
  lens: "tele",
  // ISO
  iso: 100,
  // Shutter Speed
  shutterSpeed: "1/125",
  // Foco
  focusMode: "manual",
  focusDistance: 50,
  // White Balance
  whiteBalance: "manual",
  whiteBalanceTemp: 4000,
  // Estabilização
  stabilization: false,
  // HDR
  hdr: false,
  // LOG
  logProfile: false,
  // Codec
  codec: "h264",
  // Alta taxa de bits
  highBitrate: true,
  // HDR10+
  hdr10plus: false,
  // Duração
  maxDuration: 10,
};

// ─── PRESET: Microscópio (configuração padrão lab) ───
const MICROSCOPE_PRESET = {
  lens: "tele",
  width: 1920,
  height: 1080,
  frameRate: 60,
  iso: 100,
  shutterSpeed: "1/125",
  focusMode: "manual",
  focusDistance: 50,
  whiteBalance: "manual",
  whiteBalanceTemp: 4000,
  stabilization: false,
  hdr: false,
  logProfile: false,
  codec: "h264",
  highBitrate: true,
  hdr10plus: false,
  maxDuration: 10,
};
const LENS_OPTIONS = [
  { value: "wide", label: "W — Wide", icon: "📷" },
  { value: "ultrawide", label: "UW — Ultra Wide", icon: "🔭" },
  { value: "tele", label: "T — Telefoto", icon: "🔬" },
];

const RESOLUTION_OPTIONS = [
  { value: "1280x720x30", label: "HD 30fps", w: 1280, h: 720, fps: 30 },
  { value: "1280x720x60", label: "HD 60fps", w: 1280, h: 720, fps: 60 },
  { value: "1920x1080x30", label: "FHD 30fps", w: 1920, h: 1080, fps: 30 },
  { value: "1920x1080x60", label: "FHD 60fps", w: 1920, h: 1080, fps: 60 },
  { value: "2560x1440x30", label: "QHD 30fps", w: 2560, h: 1440, fps: 30 },
  { value: "3840x2160x30", label: "4K 30fps", w: 3840, h: 2160, fps: 30 },
  { value: "3840x2160x60", label: "4K 60fps", w: 3840, h: 2160, fps: 60 },
];

const ISO_OPTIONS = [50, 100, 200, 400, 800, 1600, 3200];

const SHUTTER_OPTIONS = [
  "1/30", "1/60", "1/125", "1/250", "1/500", "1/1000", "1/2000",
];

const FOCUS_OPTIONS = [
  { value: "manual", label: "MF — Manual" },
  { value: "continuous", label: "AF-C — Contínuo" },
  { value: "single", label: "AF-S — Único" },
];

const WB_PRESETS = [
  { value: 2700, label: "🕯️ Tungstênio", temp: 2700 },
  { value: 4000, label: "💡 Fluorescente", temp: 4000 },
  { value: 5500, label: "☀️ Luz do dia", temp: 5500 },
  { value: 6500, label: "☁️ Nublado", temp: 6500 },
  { value: 7500, label: "🌫️ Sombra", temp: 7500 },
];

// ─── PERSISTENCE ───
function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      return { ...MICROSCOPE_PRESET, ...saved };
    }
  } catch (e) { }
  return { ...MICROSCOPE_PRESET };
}

function saveSettings(settings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch (e) { }
}

// ─── MIME TYPE DETECTION ───
function getSupportedMimeType(preferH265 = false) {
  const h265 = ["video/mp4;codecs=hvc1", "video/mp4;codecs=hev1"];
  const h264 = [
    "video/mp4;codecs=avc1.424028,mp4a.40.2",
    "video/mp4;codecs=avc1.42E01E",
    "video/mp4;codecs=avc1",
    "video/mp4",
  ];
  const fallback = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"];
  const candidates = preferH265 ? [...h265, ...h264, ...fallback] : [...h264, ...h265, ...fallback];
  for (const type of candidates) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(type)) return type;
  }
  return "";
}

// ─── COMPONENT ───
export default function EmbryoCamera({ onVideoConfirmed, onClose }) {
  const [phase, setPhase] = useState("config");
  const [settings, setSettings] = useState(loadSettings);
  const [isRecording, setIsRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [recordedBlob, setRecordedBlob] = useState(null);
  const [recordedUrl, setRecordedUrl] = useState(null);
  const [error, setError] = useState(null);
  const [streamInfo, setStreamInfo] = useState(null);
  const [devices, setDevices] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState("");
  const [zoom, setZoom] = useState(1);
  const [torch, setTorch] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  const [zoomRange, setZoomRange] = useState({ min: 1, max: 1 });
  const [saveIndicator, setSaveIndicator] = useState(false);
  const [settingsTab, setSettingsTab] = useState("video");
  const [capReport, setCapReport] = useState(null); // { param: { status, requested, actual, note } }
  const [showReport, setShowReport] = useState(false);

  const videoRef = useRef(null);
  const previewRef = useRef(null);
  const streamRef = useRef(null);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const startTimeRef = useRef(null);

  // ─── AUTO-SAVE on every settings change ───
  useEffect(() => {
    saveSettings(settings);
    setSaveIndicator(true);
    const t = setTimeout(() => setSaveIndicator(false), 1200);
    return () => clearTimeout(t);
  }, [settings]);

  const set = (field, value) => {
    setSettings((prev) => ({ ...prev, [field]: value }));
  };

  const resetDefaults = () => {
    setSettings({ ...MICROSCOPE_PRESET });
  };

  // ─── Camera detection ───
  useEffect(() => {
    let cancelled = false;
    async function detectCameras() {
      try {
        const tempStream = await navigator.mediaDevices.getUserMedia({ video: true });
        tempStream.getTracks().forEach((t) => t.stop());
        if (cancelled) return;
        const devs = await navigator.mediaDevices.enumerateDevices();
        const cams = devs.filter((d) => d.kind === "videoinput");

        const enriched = await Promise.all(
          cams.map(async (cam, i) => {
            let facing = "unknown";
            let capabilities = {};
            let s;
            try {
              s = await navigator.mediaDevices.getUserMedia({ video: { deviceId: { exact: cam.deviceId } } });
              const track = s.getVideoTracks()[0];
              const st = track.getSettings();
              capabilities = track.getCapabilities?.() || {};
              facing = st.facingMode || "unknown";
              track.stop();
            } catch {
              s?.getTracks().forEach((t) => t.stop());
            }

            const rawLabel = cam.label || "";
            let friendlyLabel = rawLabel;
            const lower = rawLabel.toLowerCase();
            if (lower.includes("ultra") || lower.includes("wide angle") || lower.includes("0.5"))
              friendlyLabel = `Ultra-angular (${rawLabel})`;
            else if (lower.includes("tele") || lower.includes("zoom") || lower.includes("2x") || lower.includes("3x") || lower.includes("5x"))
              friendlyLabel = `Telefoto (${rawLabel})`;
            else if (lower.includes("macro"))
              friendlyLabel = `Macro (${rawLabel})`;
            else if (lower.includes("front") || facing === "user")
              friendlyLabel = `Frontal (${rawLabel || "Câmera " + (i + 1)})`;
            else if (!rawLabel)
              friendlyLabel = `Câmera ${i + 1}`;

            return {
              deviceId: cam.deviceId, label: rawLabel, friendlyLabel, facing,
              maxWidth: capabilities.width?.max || 0, maxHeight: capabilities.height?.max || 0,
              hasZoom: !!capabilities.zoom, hasTorch: !!capabilities.torch,
            };
          })
        );

        enriched.sort((a, b) => {
          if (a.facing === "environment" && b.facing !== "environment") return -1;
          if (a.facing !== "environment" && b.facing === "environment") return 1;
          return b.maxWidth - a.maxWidth;
        });

        if (cancelled) return;
        setDevices(enriched);
        if (enriched.length > 0 && !selectedDevice) {
          const rear = enriched.find((d) => d.facing === "environment");
          setSelectedDevice(rear ? rear.deviceId : enriched[0].deviceId);
        }
      } catch {
        if (cancelled) return;
        const devs = await navigator.mediaDevices.enumerateDevices();
        const cams = devs.filter((d) => d.kind === "videoinput").map((d, i) => ({
          deviceId: d.deviceId, label: d.label, friendlyLabel: d.label || `Câmera ${i + 1}`,
          facing: "unknown", maxWidth: 0, maxHeight: 0, hasZoom: false, hasTorch: false,
        }));
        if (cancelled) return;
        setDevices(cams);
        if (cams.length > 0 && !selectedDevice) setSelectedDevice(cams[0].deviceId);
      }
    }
    detectCameras();
    return () => { cancelled = true; };
  }, []);

  // ─── Open camera ───
  const openCamera = useCallback(async () => {
    setError(null);
    setCapReport(null);
    setShowReport(true);
    const report = {};

    try {
      const constraints = {
        video: {
          width: { ideal: settings.width }, height: { ideal: settings.height },
          frameRate: { ideal: settings.frameRate },
          ...(selectedDevice ? { deviceId: { exact: selectedDevice } } : { facingMode: "environment" }),
        },
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      const track = stream.getVideoTracks()[0];
      const st = track.getSettings();
      const caps = track.getCapabilities?.() || {};

      setStreamInfo({ width: st.width, height: st.height, frameRate: st.frameRate, deviceLabel: track.label });

      // ── Resolution check ──
      const resMatch = st.width === settings.width && st.height === settings.height;
      report.resolution = {
        status: resMatch ? "ok" : "adapted",
        requested: `${settings.width}×${settings.height}`,
        actual: `${st.width}×${st.height}`,
        note: resMatch ? null : `Dispositivo entregou ${st.width}×${st.height}`,
      };

      // ── Frame rate check ──
      const fpsMatch = Math.abs((st.frameRate || 0) - settings.frameRate) < 2;
      report.frameRate = {
        status: fpsMatch ? "ok" : "adapted",
        requested: `${settings.frameRate}fps`,
        actual: `${(st.frameRate || 0).toFixed(0)}fps`,
        note: fpsMatch ? null : `Entregou ${(st.frameRate || 0).toFixed(0)}fps`,
      };

      // ── ISO ──
      if (caps.iso) {
        const clamped = Math.max(caps.iso.min, Math.min(caps.iso.max, settings.iso));
        const exact = clamped === settings.iso;
        report.iso = {
          status: exact ? "ok" : "adapted",
          requested: `ISO ${settings.iso}`,
          actual: `ISO ${clamped}`,
          note: exact ? null : `Faixa do device: ${caps.iso.min}–${caps.iso.max}. Usando ${clamped}`,
        };
      } else {
        report.iso = { status: "unsupported", requested: `ISO ${settings.iso}`, actual: "Auto", note: "Controle manual de ISO não suportado" };
      }

      // ── Shutter ──
      if (caps.exposureMode && caps.exposureTime) {
        const shutterMap = { "1/30": 33333, "1/60": 16667, "1/125": 8000, "1/250": 4000, "1/500": 2000, "1/1000": 1000, "1/2000": 500 };
        const us = shutterMap[settings.shutterSpeed] || 8000;
        const clamped = Math.max(caps.exposureTime.min, Math.min(caps.exposureTime.max, us));
        const exact = clamped === us;
        report.shutter = {
          status: exact ? "ok" : "adapted",
          requested: settings.shutterSpeed,
          actual: exact ? settings.shutterSpeed : `~1/${Math.round(1000000 / clamped)}`,
          note: exact ? null : `Faixa: 1/${Math.round(1000000 / caps.exposureTime.min)}–1/${Math.round(1000000 / caps.exposureTime.max)}`,
        };
      } else {
        report.shutter = { status: "unsupported", requested: settings.shutterSpeed, actual: "Auto", note: "Controle manual de exposição não suportado" };
      }

      // ── Focus ──
      if (caps.focusMode) {
        const modeMap = { manual: "manual", continuous: "continuous", single: "single-shot" };
        const mode = modeMap[settings.focusMode] || "continuous";
        const supported = caps.focusMode.includes(mode);
        if (supported) {
          report.focus = { status: "ok", requested: settings.focusMode === "manual" ? "MF" : "AF", actual: settings.focusMode === "manual" ? "MF" : "AF", note: null };
          if (settings.focusMode === "manual" && caps.focusDistance) {
            report.focusDistance = { status: "ok", requested: `${settings.focusDistance}%`, actual: `${settings.focusDistance}%`, note: null };
          } else if (settings.focusMode === "manual" && !caps.focusDistance) {
            report.focusDistance = { status: "unsupported", requested: `${settings.focusDistance}%`, actual: "—", note: "Distância focal manual não suportada" };
          }
        } else {
          report.focus = { status: "unsupported", requested: settings.focusMode === "manual" ? "MF" : "AF", actual: "AF-C (fallback)", note: `Modo "${settings.focusMode}" não disponível. Modos: ${caps.focusMode.join(", ")}` };
        }
      } else {
        report.focus = { status: "unsupported", requested: settings.focusMode === "manual" ? "MF" : "AF", actual: "Auto (fixo)", note: "Sem controle de foco neste device" };
      }

      // ── White Balance ──
      if (caps.whiteBalanceMode) {
        if (settings.whiteBalance === "manual" && caps.colorTemperature) {
          const ct = Math.max(caps.colorTemperature.min, Math.min(caps.colorTemperature.max, settings.whiteBalanceTemp));
          const exact = ct === settings.whiteBalanceTemp;
          report.whiteBalance = {
            status: exact ? "ok" : "adapted",
            requested: `${settings.whiteBalanceTemp}K`,
            actual: `${ct}K`,
            note: exact ? null : `Faixa: ${caps.colorTemperature.min}K–${caps.colorTemperature.max}K`,
          };
        } else if (settings.whiteBalance === "manual" && !caps.colorTemperature) {
          report.whiteBalance = { status: "unsupported", requested: `${settings.whiteBalanceTemp}K`, actual: "Auto", note: "Temperatura manual não suportada, usando auto" };
        } else {
          report.whiteBalance = { status: "ok", requested: "Auto", actual: "Auto", note: null };
        }
      } else {
        report.whiteBalance = { status: "unsupported", requested: `${settings.whiteBalanceTemp}K`, actual: "Auto (fixo)", note: "Sem controle de WB neste device" };
      }

      // ── Stabilization ──
      // Nota: estabilização é informativa, não controlável via API
      report.stabilization = {
        status: "info",
        requested: settings.stabilization ? "ON" : "OFF",
        actual: "—",
        note: "Estabilização depende do hardware/app nativo. Config salva como referência.",
      };

      // ── HDR ──
      report.hdr = {
        status: "info",
        requested: settings.hdr ? "ON" : "OFF",
        actual: "—",
        note: "HDR não controlável via MediaRecorder. Config salva como referência.",
      };

      // ── HDR10+ ──
      report.hdr10plus = {
        status: "info",
        requested: settings.hdr10plus ? "ON" : "OFF",
        actual: "—",
        note: "HDR10+ não controlável via web. Config salva como referência.",
      };

      // ── LOG ──
      report.logProfile = {
        status: "info",
        requested: settings.logProfile ? "ON" : "OFF",
        actual: "—",
        note: "Perfil LOG não controlável via web. Config salva como referência.",
      };

      // ── Codec ──
      const mimeType = getSupportedMimeType(settings.codec === "h265");
      const gotH265 = mimeType.includes("hvc1") || mimeType.includes("hev1");
      const gotH264 = mimeType.includes("avc1") || (mimeType.includes("mp4") && !gotH265);
      const wantedH265 = settings.codec === "h265";
      if (wantedH265 && gotH265) {
        report.codec = { status: "ok", requested: "H.265", actual: "H.265", note: null };
      } else if (wantedH265 && !gotH265) {
        report.codec = { status: "adapted", requested: "H.265", actual: gotH264 ? "H.264" : "WebM", note: "H.265 não suportado, usando fallback" };
      } else if (!wantedH265 && gotH264) {
        report.codec = { status: "ok", requested: "H.264", actual: "H.264", note: null };
      } else {
        report.codec = { status: "adapted", requested: "H.264", actual: mimeType.includes("webm") ? "WebM VP9" : mimeType, note: "MP4 H.264 não suportado" };
      }

      // ── Torch ──
      if (caps.torch) {
        setTorchSupported(true);
        report.torch = { status: "ok", requested: "—", actual: "Disponível", note: null };
      } else {
        setTorchSupported(false);
        report.torch = { status: "unsupported", requested: "—", actual: "Não disponível", note: "Flash/torch não suportado neste device" };
      }

      // ── Zoom ──
      if (caps.zoom) {
        setZoomRange({ min: caps.zoom.min, max: caps.zoom.max });
        setZoom(st.zoom || 1);
        report.zoom = { status: "ok", requested: "—", actual: `${caps.zoom.min.toFixed(1)}×–${caps.zoom.max.toFixed(1)}×`, note: null };
      } else {
        setZoomRange({ min: 1, max: 1 });
        report.zoom = { status: "unsupported", requested: "—", actual: "1× fixo", note: "Zoom digital não suportado" };
      }

      // ── Apply advanced constraints ──
      const advanced = [];
      if (caps.iso) advanced.push({ iso: Math.max(caps.iso.min, Math.min(caps.iso.max, settings.iso)) });
      if (caps.whiteBalanceMode) {
        if (settings.whiteBalance === "manual" && caps.colorTemperature) {
          advanced.push({ whiteBalanceMode: "manual" });
          advanced.push({ colorTemperature: Math.max(caps.colorTemperature.min, Math.min(caps.colorTemperature.max, settings.whiteBalanceTemp)) });
        } else {
          advanced.push({ whiteBalanceMode: "continuous" });
        }
      }
      if (caps.focusMode) {
        const modeMap = { manual: "manual", continuous: "continuous", single: "single-shot" };
        const mode = modeMap[settings.focusMode] || "continuous";
        if (caps.focusMode.includes(mode)) advanced.push({ focusMode: mode });
        if (settings.focusMode === "manual" && caps.focusDistance) {
          const fd = caps.focusDistance.min + (caps.focusDistance.max - caps.focusDistance.min) * (settings.focusDistance / 100);
          advanced.push({ focusDistance: fd });
        }
      }
      if (caps.exposureMode && caps.exposureTime) {
        advanced.push({ exposureMode: "manual" });
        const shutterMap = { "1/30": 33333, "1/60": 16667, "1/125": 8000, "1/250": 4000, "1/500": 2000, "1/1000": 1000, "1/2000": 500 };
        const us = shutterMap[settings.shutterSpeed] || 8000;
        advanced.push({ exposureTime: Math.max(caps.exposureTime.min, Math.min(caps.exposureTime.max, us)) });
      }

      if (advanced.length > 0) {
        try { await track.applyConstraints({ advanced }); } catch (e) { console.warn("Some constraints not supported:", e.message); }
      }

      // ── Count results ──
      const counts = { ok: 0, adapted: 0, unsupported: 0, info: 0 };
      Object.values(report).forEach((r) => counts[r.status]++);
      report._summary = counts;

      setCapReport(report);
      if (videoRef.current) videoRef.current.srcObject = stream;
      setPhase("camera");
    } catch (err) {
      if (err.name === "NotAllowedError") setError("Permissão da câmera negada.");
      else if (err.name === "NotFoundError") setError("Nenhuma câmera encontrada.");
      else if (err.name === "OverconstrainedError") setError(`Resolução ${settings.width}x${settings.height}@${settings.frameRate}fps não suportada.`);
      else setError(`Erro: ${err.message}`);
    }
  }, [settings, selectedDevice]);

  const closeCamera = () => {
    if (streamRef.current) { streamRef.current.getTracks().forEach((t) => t.stop()); streamRef.current = null; }
    if (timerRef.current) clearInterval(timerRef.current);
    setIsRecording(false); setElapsed(0); setPhase("config"); setStreamInfo(null);
    setTorchSupported(false); setZoomRange({ min: 1, max: 1 });
  };

  const applyZoom = async (val) => {
    setZoom(val);
    const track = streamRef.current?.getVideoTracks()[0];
    if (track) try { await track.applyConstraints({ advanced: [{ zoom: val }] }); } catch (e) { }
  };

  const toggleTorch = async () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (track) try { await track.applyConstraints({ advanced: [{ torch: !torch }] }); setTorch(!torch); } catch (e) { }
  };

  // ─── Recording ───
  const startRecording = () => {
    if (!streamRef.current) return;
    chunksRef.current = [];
    setRecordedBlob(null); setRecordedUrl(null);
    setShowReport(false);

    const mimeType = getSupportedMimeType(settings.codec === "h265");
    if (!mimeType) { setError("Navegador não suporta gravação."); return; }

    const bitrate = settings.highBitrate
      ? (settings.width >= 3840 ? 40_000_000 : 16_000_000)
      : (settings.width >= 3840 ? 20_000_000 : 8_000_000);

    const recorder = new MediaRecorder(streamRef.current, { mimeType, videoBitsPerSecond: bitrate });
    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mimeType });
      setRecordedBlob(blob); setRecordedUrl(URL.createObjectURL(blob)); setPhase("preview");
    };

    recorderRef.current = recorder;
    recorder.start(500);
    startTimeRef.current = Date.now();
    setElapsed(0); setIsRecording(true);
    timerRef.current = setInterval(() => {
      const sec = Math.floor((Date.now() - startTimeRef.current) / 1000);
      setElapsed(sec);
      if (sec >= settings.maxDuration) stopRecording();
    }, 250);
  };

  const stopRecording = () => {
    if (recorderRef.current && recorderRef.current.state !== "inactive") recorderRef.current.stop();
    if (timerRef.current) clearInterval(timerRef.current);
    setIsRecording(false);
    if (streamRef.current) { streamRef.current.getTracks().forEach((t) => t.stop()); streamRef.current = null; }
  };

  const downloadVideo = () => {
    if (!recordedBlob) return;
    const a = document.createElement("a"); a.href = recordedUrl;
    const ext = recordedBlob.type.includes("mp4") ? "mp4" : "webm";
    a.download = `embryo_${new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)}.${ext}`;
    a.click();
  };

  const discardAndReturn = () => {
    if (recordedUrl) URL.revokeObjectURL(recordedUrl);
    setRecordedBlob(null); setRecordedUrl(null); setElapsed(0); setPhase("config");
  };

  const reRecord = () => {
    if (recordedUrl) URL.revokeObjectURL(recordedUrl);
    setRecordedBlob(null); setRecordedUrl(null); setElapsed(0); openCamera();
  };

  const handleClose = () => {
    if (streamRef.current) { streamRef.current.getTracks().forEach((t) => t.stop()); streamRef.current = null; }
    if (timerRef.current) clearInterval(timerRef.current);
    if (onClose) onClose();
  };

  const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  const progress = settings.maxDuration > 0 ? (elapsed / settings.maxDuration) * 100 : 0;

  // ─── PALETTE ───
  const P = {
    bg: "#0a0e17", surface: "#111827", surfaceAlt: "#1a2236",
    border: "#1e293b", accent: "#0ea5e9", accentDim: "rgba(14,165,233,0.15)",
    danger: "#ef4444", dangerDim: "rgba(239,68,68,0.15)",
    success: "#10b981", successDim: "rgba(16,185,129,0.15)",
    warn: "#f59e0b", warnDim: "rgba(245,158,11,0.15)",
    text: "#f1f5f9", textDim: "#94a3b8", textMuted: "#64748b",
    recording: "#ef4444",
  };
  const font = "'IBM Plex Sans', -apple-system, sans-serif";
  const mono = "'IBM Plex Mono', 'SF Mono', monospace";

  const labelSt = { display: "block", fontSize: 10, fontWeight: 700, color: P.textMuted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 5 };
  const chipSt = (active, color = P.accent, dim = P.accentDim) => ({
    padding: "7px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", transition: "all 0.12s",
    border: `1.5px solid ${active ? color : P.border}`,
    background: active ? dim : "transparent",
    color: active ? color : P.textDim,
  });
  const toggleSt = (on, color = P.accent) => ({
    padding: "8px 16px", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer",
    border: `1.5px solid ${on ? color : P.border}`,
    background: on ? (color === P.danger ? P.dangerDim : color === P.warn ? P.warnDim : P.accentDim) : "transparent",
    color: on ? color : P.textMuted, transition: "all 0.12s",
  });

  const SectionTitle = ({ children }) => (
    <div style={{ fontSize: 11, fontWeight: 700, color: P.textMuted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12, marginTop: 4 }}>{children}</div>
  );

  const TABS = [
    { key: "video", label: "Vídeo", icon: "🎬" },
    { key: "image", label: "Imagem", icon: "🎨" },
    { key: "codec", label: "Codec", icon: "⚙️" },
  ];

  return (
    <div style={{ fontFamily: font, background: P.bg, color: P.text, minHeight: "100vh", display: "flex", flexDirection: "column" }}>

      {error && (
        <div style={{ margin: "10px 16px 0", padding: "10px 14px", background: P.dangerDim, border: `1px solid ${P.danger}40`, borderRadius: 10, fontSize: 12, color: "#fca5a5", display: "flex", alignItems: "center", gap: 8 }}>⚠️ {error}</div>
      )}

      {/* ═══ CONFIG PHASE ═══ */}
      {phase === "config" && (
        <div style={{ flex: 1, overflow: "auto", padding: "0 16px 20px" }}>

          {/* Summary bar + close */}
          <div style={{ margin: "14px 0", padding: "10px 14px", background: P.surfaceAlt, borderRadius: 10, display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ flex: 1, display: "flex", flexWrap: "wrap", gap: "6px 14px", fontFamily: mono, fontSize: 11, color: P.textDim }}>
              <span style={{ color: P.accent, fontWeight: 700 }}>{settings.width}×{settings.height} {settings.frameRate}fps</span>
              <span>ISO {settings.iso}</span>
              <span>SS {settings.shutterSpeed}</span>
              <span>WB {settings.whiteBalanceTemp}K</span>
              <span>{settings.focusMode === "manual" ? "MF" : "AF"}</span>
              <span>{settings.codec === "h265" ? "H.265" : "H.264"}</span>
              {settings.highBitrate && <span style={{ color: P.warn }}>HQ</span>}
              {settings.stabilization && <span>OIS</span>}
              {saveIndicator && <span style={{ color: P.success, fontWeight: 600, animation: "fadeIn 0.2s" }}>✓</span>}
            </div>
            <button onClick={handleClose} style={{ background: "none", border: "none", color: P.textMuted, fontSize: 18, cursor: "pointer", padding: "2px 6px", lineHeight: 1 }} title="Fechar câmera">✕</button>
          </div>

          {/* Preset: Microscópio */}
          {(() => {
            const PRESET_IGNORE = ["whiteBalance", "whiteBalanceTemp", "focusMode", "focusDistance"];
            const isPreset = Object.entries(MICROSCOPE_PRESET).filter(([k]) => !PRESET_IGNORE.includes(k)).every(([k, v]) => settings[k] === v);
            return (
              <button
                onClick={() => setSettings((prev) => ({ ...prev, ...MICROSCOPE_PRESET }))}
                style={{
                  width: "100%", marginBottom: 10, padding: "12px 16px", borderRadius: 12,
                  border: `1.5px solid ${isPreset ? P.accent : P.border}`,
                  background: isPreset ? P.accentDim : P.surface,
                  color: P.text, cursor: "pointer", textAlign: "left", transition: "all 0.12s",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 22 }}>🔬</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>Microscópio — Padrão Lab</div>
                    <div style={{ fontSize: 10, color: P.textMuted, fontFamily: mono, marginTop: 3 }}>
                      Telefoto · FHD 60fps · ISO 100 · SS 1/125 · H.264 HQ · Estab OFF
                    </div>
                  </div>
                  {isPreset && <span style={{ color: P.accent, fontWeight: 700, fontSize: 14 }}>✓</span>}
                </div>
              </button>
            );
          })()}

          {/* Aviso: ajustes no microscópio */}
          <div style={{
            marginBottom: 16, padding: "10px 14px", borderRadius: 10,
            background: "rgba(245,158,11,0.08)", border: `1px solid rgba(245,158,11,0.2)`,
            display: "flex", gap: 10, alignItems: "flex-start",
          }}>
            <span style={{ fontSize: 16, marginTop: 1 }}>🔧</span>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: P.warn, marginBottom: 3 }}>Ajustar no microscópio</div>
              <div style={{ fontSize: 10, color: P.textDim, lineHeight: 1.5 }}>
                <strong style={{ color: P.text }}>White Balance</strong> — ajustar diretamente na iluminação do microscópio (referência: 4000K)<br />
                <strong style={{ color: P.text }}>Foco</strong> — ajustar pelo micrométrico do microscópio, não pelo celular
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div style={{ display: "flex", gap: 4, marginBottom: 16 }}>
            {TABS.map((tab) => (
              <button key={tab.key} onClick={() => setSettingsTab(tab.key)}
                style={{ flex: 1, padding: "10px 0", borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: "pointer", border: `1.5px solid ${settingsTab === tab.key ? P.accent : P.border}`, background: settingsTab === tab.key ? P.accentDim : P.surface, color: settingsTab === tab.key ? P.accent : P.textDim, transition: "all 0.12s" }}>
                {tab.icon} {tab.label}
              </button>
            ))}
          </div>

          {/* TAB: VIDEO */}
          {settingsTab === "video" && (
            <div style={{ background: P.surface, borderRadius: 14, border: `1px solid ${P.border}`, padding: 18 }}>
              <SectionTitle>Lente</SectionTitle>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 18 }}>
                {LENS_OPTIONS.map((l) => (
                  <button key={l.value} onClick={() => set("lens", l.value)} style={chipSt(settings.lens === l.value)}>{l.icon} {l.label}</button>
                ))}
              </div>

              <SectionTitle>Resolução & Frame Rate</SectionTitle>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 18 }}>
                {RESOLUTION_OPTIONS.map((r) => (
                  <button key={r.value} onClick={() => setSettings((p) => ({ ...p, width: r.w, height: r.h, frameRate: r.fps }))} style={chipSt(settings.width === r.w && settings.height === r.h && settings.frameRate === r.fps)}>{r.label}</button>
                ))}
              </div>

              <SectionTitle>Duração Máxima</SectionTitle>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
                <input type="range" min={5} max={120} step={5} value={settings.maxDuration} onChange={(e) => set("maxDuration", Number(e.target.value))} style={{ flex: 1, accentColor: P.accent }} />
                <span style={{ fontFamily: mono, fontSize: 14, fontWeight: 700, color: P.text, minWidth: 42, textAlign: "right" }}>{settings.maxDuration}s</span>
              </div>

              <SectionTitle>Estabilização</SectionTitle>
              <div style={{ display: "flex", gap: 8, marginBottom: 6 }}>
                <button onClick={() => set("stabilization", false)} style={toggleSt(!settings.stabilization)}>OFF</button>
                <button onClick={() => set("stabilization", true)} style={toggleSt(settings.stabilization)}>ON — OIS</button>
              </div>
              <div style={{ fontSize: 10, color: P.textMuted }}>Recomendado OFF para microscópio (evita artefatos)</div>
            </div>
          )}

          {/* TAB: IMAGE */}
          {settingsTab === "image" && (
            <div style={{ background: P.surface, borderRadius: 14, border: `1px solid ${P.border}`, padding: 18 }}>
              <SectionTitle>ISO</SectionTitle>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 18 }}>
                {ISO_OPTIONS.map((v) => (
                  <button key={v} onClick={() => set("iso", v)} style={chipSt(settings.iso === v)}>{v}</button>
                ))}
              </div>

              <SectionTitle>Shutter Speed</SectionTitle>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 18 }}>
                {SHUTTER_OPTIONS.map((v) => (
                  <button key={v} onClick={() => set("shutterSpeed", v)} style={chipSt(settings.shutterSpeed === v)}>{v}</button>
                ))}
              </div>

              <SectionTitle>Foco</SectionTitle>
              <div style={{ padding: "6px 10px", marginBottom: 8, borderRadius: 8, background: "rgba(245,158,11,0.08)", border: `1px solid rgba(245,158,11,0.15)`, fontSize: 10, color: P.warn, display: "flex", alignItems: "center", gap: 6 }}>
                🔧 Ajustar pelo micrométrico do microscópio
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: settings.focusMode === "manual" ? 10 : 18 }}>
                {FOCUS_OPTIONS.map((f) => (
                  <button key={f.value} onClick={() => set("focusMode", f.value)} style={chipSt(settings.focusMode === f.value, P.warn, P.warnDim)}>{f.label}</button>
                ))}
              </div>
              {settings.focusMode === "manual" && (
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
                  <span style={{ fontSize: 10, color: P.warn }}>Perto</span>
                  <input type="range" min={0} max={100} value={settings.focusDistance} onChange={(e) => set("focusDistance", Number(e.target.value))} style={{ flex: 1, accentColor: P.warn }} />
                  <span style={{ fontSize: 10, color: P.warn }}>Longe</span>
                  <span style={{ fontFamily: mono, fontSize: 12, color: P.warn, fontWeight: 700, minWidth: 32, textAlign: "right" }}>{settings.focusDistance}%</span>
                </div>
              )}

              <SectionTitle>White Balance</SectionTitle>
              <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                <button onClick={() => set("whiteBalance", "auto")} style={toggleSt(settings.whiteBalance === "auto", P.warn)}>Auto</button>
                <button onClick={() => set("whiteBalance", "manual")} style={toggleSt(settings.whiteBalance === "manual", P.warn)}>Manual</button>
              </div>
              {settings.whiteBalance === "manual" && (
                <>
                  <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 8, marginTop: 8 }}>
                    {WB_PRESETS.map((wb) => (
                      <button key={wb.value} onClick={() => set("whiteBalanceTemp", wb.temp)} style={chipSt(settings.whiteBalanceTemp === wb.temp, P.warn, P.warnDim)}>{wb.label}</button>
                    ))}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 4 }}>
                    <span style={{ fontSize: 10, color: P.warn }}>2000K</span>
                    <input type="range" min={2000} max={10000} step={100} value={settings.whiteBalanceTemp} onChange={(e) => set("whiteBalanceTemp", Number(e.target.value))} style={{ flex: 1, accentColor: P.warn }} />
                    <span style={{ fontSize: 10, color: P.warn }}>10000K</span>
                    <span style={{ fontFamily: mono, fontSize: 13, fontWeight: 700, color: P.warn, minWidth: 50, textAlign: "right" }}>{settings.whiteBalanceTemp}K</span>
                  </div>
                </>
              )}
              <div style={{ padding: "6px 10px", marginTop: 6, borderRadius: 8, background: "rgba(245,158,11,0.08)", border: `1px solid rgba(245,158,11,0.15)`, fontSize: 10, color: P.warn, display: "flex", alignItems: "center", gap: 6 }}>
                🔧 Ajustar pela iluminação do microscópio (ref: 4000K)
              </div>
            </div>
          )}

          {/* TAB: CODEC */}
          {settingsTab === "codec" && (
            <div style={{ background: P.surface, borderRadius: 14, border: `1px solid ${P.border}`, padding: 18 }}>
              <SectionTitle>Codec</SectionTitle>
              <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
                <button onClick={() => set("codec", "h264")} style={chipSt(settings.codec === "h264")}>H.264 (AVC)</button>
                <button onClick={() => set("codec", "h265")} style={chipSt(settings.codec === "h265")}>H.265 (HEVC)</button>
              </div>

              <SectionTitle>Alta Taxa de Bits</SectionTitle>
              <div style={{ display: "flex", gap: 8, marginBottom: 6 }}>
                <button onClick={() => set("highBitrate", false)} style={toggleSt(!settings.highBitrate)}>OFF — Normal</button>
                <button onClick={() => set("highBitrate", true)} style={toggleSt(settings.highBitrate, P.warn)}>ON — High Quality</button>
              </div>
              <div style={{ fontSize: 10, color: P.textMuted, marginBottom: 18 }}>
                {settings.highBitrate ? `~${settings.width >= 3840 ? "40" : "16"} Mbps — Arquivos maiores, melhor detalhe` : `~${settings.width >= 3840 ? "20" : "8"} Mbps — Tamanho moderado`}
              </div>

              <SectionTitle>HDR</SectionTitle>
              <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
                <button onClick={() => set("hdr", false)} style={toggleSt(!settings.hdr)}>OFF</button>
                <button onClick={() => set("hdr", true)} style={toggleSt(settings.hdr)}>ON</button>
              </div>

              <SectionTitle>HDR10+</SectionTitle>
              <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
                <button onClick={() => set("hdr10plus", false)} style={toggleSt(!settings.hdr10plus)}>OFF</button>
                <button onClick={() => set("hdr10plus", true)} style={toggleSt(settings.hdr10plus, P.warn)}>ON</button>
              </div>

              <SectionTitle>LOG Profile</SectionTitle>
              <div style={{ display: "flex", gap: 8, marginBottom: 6 }}>
                <button onClick={() => set("logProfile", false)} style={toggleSt(!settings.logProfile)}>OFF</button>
                <button onClick={() => set("logProfile", true)} style={toggleSt(settings.logProfile)}>ON</button>
              </div>
              <div style={{ fontSize: 10, color: P.textMuted }}>Perfil flat para pós-produção. Não recomendado para análise AI direta.</div>
            </div>
          )}

          {/* Camera selector */}
          {devices.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: P.textMuted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Câmera ({devices.length})</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {devices.map((d) => {
                  const sel = selectedDevice === d.deviceId;
                  const isRear = d.facing === "environment";
                  const isFront = d.facing === "user";
                  return (
                    <button key={d.deviceId} onClick={() => setSelectedDevice(d.deviceId)}
                      style={{ textAlign: "left", padding: "10px 12px", borderRadius: 10, border: `1.5px solid ${sel ? P.accent : P.border}`, background: sel ? P.accentDim : P.surface, color: P.text, cursor: "pointer", transition: "all 0.12s" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 15 }}>{isFront ? "🤳" : isRear ? "📷" : "🎥"}</span>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 12, fontWeight: 600 }}>{d.friendlyLabel}</div>
                          <div style={{ fontSize: 10, color: P.textMuted, fontFamily: mono, marginTop: 2, display: "flex", gap: 6 }}>
                            {d.maxWidth > 0 && <span>{d.maxWidth}×{d.maxHeight}</span>}
                            <span style={{ color: isRear ? P.success : "#f59e0b" }}>{isRear ? "Traseira" : isFront ? "Frontal" : "—"}</span>
                            {d.hasZoom && <span>🔍</span>}
                            {d.hasTorch && <span>💡</span>}
                          </div>
                        </div>
                        {sel && <span style={{ color: P.accent, fontWeight: 700, fontSize: 14 }}>✓</span>}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Last diagnostic report */}
          {capReport && (
            <div style={{ marginTop: 16, background: P.surface, borderRadius: 14, border: `1px solid ${P.border}`, padding: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: P.textMuted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span>📋 Último Diagnóstico</span>
                <button onClick={() => setCapReport(null)} style={{ background: "none", border: "none", color: P.textMuted, cursor: "pointer", fontSize: 10 }}>Limpar</button>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10, fontSize: 10, fontWeight: 600 }}>
                {capReport._summary?.ok > 0 && <span style={{ color: P.success, background: P.successDim, padding: "3px 8px", borderRadius: 6 }}>✓ {capReport._summary.ok} aplicado{capReport._summary.ok > 1 ? "s" : ""}</span>}
                {capReport._summary?.adapted > 0 && <span style={{ color: P.warn, background: P.warnDim, padding: "3px 8px", borderRadius: 6 }}>⚠ {capReport._summary.adapted} adaptado{capReport._summary.adapted > 1 ? "s" : ""}</span>}
                {capReport._summary?.unsupported > 0 && <span style={{ color: P.danger, background: P.dangerDim, padding: "3px 8px", borderRadius: 6 }}>✕ {capReport._summary.unsupported} não suportado{capReport._summary.unsupported > 1 ? "s" : ""}</span>}
              </div>
              {Object.entries(capReport).filter(([k, r]) => k !== "_summary" && (r.status === "adapted" || r.status === "unsupported")).map(([key, r]) => {
                const paramLabels = { resolution: "Resolução", frameRate: "Frame Rate", iso: "ISO", shutter: "Shutter", focus: "Foco", focusDistance: "Dist. Focal", whiteBalance: "White Balance", stabilization: "Estabilização", hdr: "HDR", hdr10plus: "HDR10+", logProfile: "LOG", codec: "Codec", torch: "Flash", zoom: "Zoom" };
                const color = r.status === "unsupported" ? P.danger : P.warn;
                const icon = r.status === "unsupported" ? "✕" : "⚠";
                return (
                  <div key={key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 0", borderBottom: `1px solid ${P.border}`, fontSize: 11 }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ color, fontWeight: 700 }}>{icon}</span>
                      <span style={{ color: P.textDim }}>{paramLabels[key] || key}</span>
                    </span>
                    <span style={{ fontFamily: mono, fontSize: 10, display: "flex", gap: 6 }}>
                      <span style={{ color: P.textMuted, textDecoration: "line-through" }}>{r.requested}</span>
                      <span style={{ color, fontWeight: 600 }}>{r.actual}</span>
                    </span>
                  </div>
                );
              })}
              {capReport._summary?.unsupported === 0 && capReport._summary?.adapted === 0 && (
                <div style={{ fontSize: 11, color: P.success, fontWeight: 600 }}>✓ Todas as configurações foram aplicadas com sucesso!</div>
              )}
            </div>
          )}

          {/* Bottom actions */}
          <div style={{ marginTop: 18, display: "flex", gap: 10 }}>
            <button onClick={resetDefaults} style={{ padding: "12px 18px", borderRadius: 12, border: `1px solid ${P.border}`, background: "transparent", color: P.textMuted, fontSize: 13, cursor: "pointer" }}>🔄 Reset</button>
            <button onClick={openCamera} style={{ flex: 1, padding: "14px", borderRadius: 12, border: "none", background: `linear-gradient(135deg, ${P.accent}, #6366f1)`, color: "#fff", fontWeight: 700, fontSize: 15, cursor: "pointer", boxShadow: `0 4px 20px ${P.accent}40` }}>📹 Gravar</button>
          </div>
        </div>
      )}

      {/* ═══ CAMERA PHASE ═══ */}
      {phase === "camera" && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", position: "relative", background: "#000" }}>
          <video ref={videoRef} autoPlay playsInline muted style={{ flex: 1, width: "100%", objectFit: "contain", background: "#000" }} />

          {streamInfo && (
            <div style={{ position: "absolute", top: 10, left: 10, right: isRecording ? "auto" : 10, display: "flex", flexDirection: "column", gap: 6, maxWidth: isRecording ? "60%" : "100%" }}>
              {/* Mini status bar */}
              <div
                onClick={() => setShowReport((v) => !v)}
                style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)", padding: "6px 12px", borderRadius: 8, fontSize: 10, fontFamily: mono, color: P.textDim, display: "flex", gap: 10, alignItems: "center", cursor: "pointer" }}
              >
                <span style={{ color: isRecording ? P.recording : P.success, fontSize: 14 }}>●</span>
                <span>{streamInfo.width}×{streamInfo.height}</span>
                <span>{streamInfo.frameRate?.toFixed(0)}fps</span>
                {capReport?._summary && (
                  <>
                    {capReport._summary.ok > 0 && <span style={{ color: P.success }}>✓{capReport._summary.ok}</span>}
                    {capReport._summary.adapted > 0 && <span style={{ color: P.warn }}>⚠{capReport._summary.adapted}</span>}
                    {capReport._summary.unsupported > 0 && <span style={{ color: P.danger }}>✕{capReport._summary.unsupported}</span>}
                  </>
                )}
                <span style={{ color: P.textMuted, fontSize: 9 }}>{showReport ? "▲" : "▼"}</span>
              </div>

              {/* Microscope reminder */}
              {settings.lens === "tele" && settings.focusMode === "manual" && !isRecording && (
                <div style={{ background: "rgba(245,158,11,0.15)", backdropFilter: "blur(8px)", padding: "5px 10px", borderRadius: 7, fontSize: 9, color: P.warn, display: "flex", alignItems: "center", gap: 6 }}>
                  🔧 WB e Foco: ajustar no microscópio
                </div>
              )}

              {/* Full capability report */}
              {showReport && capReport && !isRecording && (
                <div style={{
                  background: "rgba(0,0,0,0.88)", backdropFilter: "blur(12px)",
                  borderRadius: 12, padding: 14, maxHeight: "55vh", overflowY: "auto",
                  border: `1px solid rgba(255,255,255,0.08)`,
                }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: P.text, marginBottom: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span>📋 Diagnóstico do Dispositivo</span>
                    <button onClick={() => setShowReport(false)} style={{ background: "none", border: "none", color: P.textMuted, cursor: "pointer", fontSize: 14 }}>✕</button>
                  </div>

                  {/* Summary counts */}
                  <div style={{ display: "flex", gap: 12, marginBottom: 12, fontSize: 11, fontWeight: 600 }}>
                    {capReport._summary.ok > 0 && <span style={{ color: P.success, background: P.successDim, padding: "3px 8px", borderRadius: 6 }}>✓ {capReport._summary.ok} aplicado{capReport._summary.ok > 1 ? "s" : ""}</span>}
                    {capReport._summary.adapted > 0 && <span style={{ color: P.warn, background: P.warnDim, padding: "3px 8px", borderRadius: 6 }}>⚠ {capReport._summary.adapted} adaptado{capReport._summary.adapted > 1 ? "s" : ""}</span>}
                    {capReport._summary.unsupported > 0 && <span style={{ color: P.danger, background: P.dangerDim, padding: "3px 8px", borderRadius: 6 }}>✕ {capReport._summary.unsupported} não suportado{capReport._summary.unsupported > 1 ? "s" : ""}</span>}
                    {capReport._summary.info > 0 && <span style={{ color: P.textMuted, background: "rgba(100,116,139,0.15)", padding: "3px 8px", borderRadius: 6 }}>ℹ {capReport._summary.info} referência</span>}
                  </div>

                  {/* Individual items */}
                  {Object.entries(capReport).filter(([k]) => k !== "_summary").map(([key, r]) => {
                    const statusColors = { ok: P.success, adapted: P.warn, unsupported: P.danger, info: P.textMuted };
                    const statusIcons = { ok: "✓", adapted: "⚠", unsupported: "✕", info: "ℹ" };
                    const statusLabels = { ok: "Aplicado", adapted: "Adaptado", unsupported: "Não suportado", info: "Referência" };
                    const paramLabels = {
                      resolution: "Resolução", frameRate: "Frame Rate", iso: "ISO", shutter: "Shutter",
                      focus: "Foco", focusDistance: "Dist. Focal", whiteBalance: "White Balance",
                      stabilization: "Estabilização", hdr: "HDR", hdr10plus: "HDR10+", logProfile: "LOG",
                      codec: "Codec", torch: "Flash", zoom: "Zoom",
                    };
                    const color = statusColors[r.status];
                    return (
                      <div key={key} style={{
                        padding: "8px 10px", marginBottom: 4, borderRadius: 8,
                        background: r.status === "unsupported" ? "rgba(239,68,68,0.06)" : r.status === "adapted" ? "rgba(245,158,11,0.06)" : "transparent",
                        borderLeft: `3px solid ${color}`,
                      }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ color, fontSize: 12, fontWeight: 700 }}>{statusIcons[r.status]}</span>
                            <span style={{ fontSize: 11, fontWeight: 600, color: P.text }}>{paramLabels[key] || key}</span>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: mono, fontSize: 10 }}>
                            {r.status !== "ok" && r.status !== "info" && (
                              <span style={{ color: P.textMuted, textDecoration: "line-through" }}>{r.requested}</span>
                            )}
                            <span style={{ color: r.status === "ok" ? P.success : color, fontWeight: 600 }}>{r.actual}</span>
                          </div>
                        </div>
                        {r.note && (
                          <div style={{ fontSize: 9, color: P.textMuted, marginTop: 3, marginLeft: 20 }}>{r.note}</div>
                        )}
                      </div>
                    );
                  })}

                  {/* Overall verdict */}
                  <div style={{
                    marginTop: 10, padding: "8px 12px", borderRadius: 8, fontSize: 10, fontWeight: 600,
                    background: capReport._summary.unsupported > 2 ? P.dangerDim : capReport._summary.unsupported > 0 ? P.warnDim : P.successDim,
                    color: capReport._summary.unsupported > 2 ? P.danger : capReport._summary.unsupported > 0 ? P.warn : P.success,
                  }}>
                    {capReport._summary.unsupported === 0 && capReport._summary.adapted === 0
                      ? "✓ Todas as configurações aplicadas com sucesso!"
                      : capReport._summary.unsupported > 2
                        ? `⚠ ${capReport._summary.unsupported} configs não suportadas. Para controle total, considere usar o app nativo da câmera.`
                        : `ℹ Algumas configs foram adaptadas ou não estão disponíveis neste device. Resolução e codec estão OK.`
                    }
                  </div>
                </div>
              )}
            </div>
          )}

          {isRecording && (
            <div style={{ position: "absolute", top: 10, right: 10, background: "rgba(239,68,68,0.2)", backdropFilter: "blur(8px)", padding: "6px 14px", borderRadius: 8, display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 9, height: 9, borderRadius: "50%", background: P.recording, animation: "pulse 1s infinite" }} />
              <span style={{ fontFamily: mono, fontSize: 16, fontWeight: 700, color: "#fff" }}>{fmt(elapsed)}</span>
              <span style={{ fontSize: 11, color: P.textDim }}>/ {fmt(settings.maxDuration)}</span>
            </div>
          )}

          {isRecording && (
            <div style={{ position: "absolute", bottom: 100, left: 16, right: 16 }}>
              <div style={{ height: 3, borderRadius: 2, background: "rgba(255,255,255,0.12)", overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${Math.min(progress, 100)}%`, background: progress > 85 ? P.recording : P.accent, borderRadius: 2, transition: "width 0.25s linear" }} />
              </div>
            </div>
          )}

          <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "14px 16px 26px", background: "linear-gradient(transparent, rgba(0,0,0,0.85))", display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "center" }}>
              {zoomRange.max > 1 && (
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 10, color: P.textMuted }}>Zoom</span>
                  <input type="range" min={zoomRange.min} max={zoomRange.max} step={0.1} value={zoom} onChange={(e) => applyZoom(Number(e.target.value))} style={{ width: 100, accentColor: P.accent }} />
                  <span style={{ fontSize: 10, color: P.textDim, fontFamily: mono }}>{zoom.toFixed(1)}×</span>
                </div>
              )}
              {torchSupported && (
                <button onClick={toggleTorch} style={{ background: torch ? P.accentDim : "rgba(255,255,255,0.1)", border: `1px solid ${torch ? P.accent : "transparent"}`, color: torch ? P.accent : P.textDim, padding: "5px 12px", borderRadius: 7, fontSize: 11, cursor: "pointer" }}>💡 {torch ? "On" : "Off"}</button>
              )}
            </div>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 24 }}>
              <button onClick={closeCamera} style={{ width: 44, height: 44, borderRadius: "50%", background: "rgba(255,255,255,0.1)", border: "none", color: "#fff", fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
              <button onClick={isRecording ? stopRecording : startRecording} style={{ width: 68, height: 68, borderRadius: "50%", border: `3px solid ${isRecording ? P.recording : "#fff"}`, background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s" }}>
                <div style={{ width: isRecording ? 24 : 52, height: isRecording ? 24 : 52, borderRadius: isRecording ? 5 : "50%", background: P.recording, transition: "all 0.2s" }} />
              </button>
              {devices.length > 1 && !isRecording ? (
                <button onClick={() => {
                  const idx = devices.findIndex((d) => d.deviceId === selectedDevice);
                  const next = devices[(idx + 1) % devices.length];
                  setSelectedDevice(next.deviceId);
                  if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
                  setTimeout(() => {
                    navigator.mediaDevices.getUserMedia({ video: { width: { ideal: settings.width }, height: { ideal: settings.height }, frameRate: { ideal: settings.frameRate }, deviceId: { exact: next.deviceId } }, audio: false }).then((stream) => {
                      streamRef.current = stream;
                      const track = stream.getVideoTracks()[0];
                      const st = track.getSettings();
                      const caps = track.getCapabilities?.() || {};
                      setStreamInfo({ width: st.width, height: st.height, frameRate: st.frameRate, deviceLabel: track.label });
                      if (caps.zoom) { setZoomRange({ min: caps.zoom.min, max: caps.zoom.max }); setZoom(st.zoom || 1); } else { setZoomRange({ min: 1, max: 1 }); }
                      setTorchSupported(!!caps.torch); setTorch(false);
                      if (videoRef.current) videoRef.current.srcObject = stream;
                    });
                  }, 100);
                }} style={{ width: 44, height: 44, borderRadius: "50%", background: "rgba(255,255,255,0.1)", border: "none", color: "#fff", fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>🔄</button>
              ) : <div style={{ width: 44 }} />}
            </div>
          </div>
          <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.3}} @keyframes fadeIn{from{opacity:0}to{opacity:1}}`}</style>
        </div>
      )}

      {/* ═══ PREVIEW PHASE ═══ */}
      {phase === "preview" && recordedUrl && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "auto" }}>
          <div style={{ flex: 1, background: "#000", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <video ref={previewRef} src={recordedUrl} controls playsInline style={{ maxWidth: "100%", maxHeight: "60vh", borderRadius: 4 }} />
          </div>
          <div style={{ padding: 16 }}>
            <div style={{ background: P.surface, borderRadius: 10, border: `1px solid ${P.border}`, padding: "12px 14px", marginBottom: 14 }}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 14px", fontFamily: mono, fontSize: 11, color: P.textDim }}>
                <span>Duração: {fmt(elapsed)}</span>
                <span>Tamanho: {(recordedBlob.size / 1024 / 1024).toFixed(2)} MB</span>
                <span>Formato: {recordedBlob.type}</span>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 14px", fontFamily: mono, fontSize: 10, color: P.textMuted, marginTop: 4 }}>
                <span>{settings.width}×{settings.height} {settings.frameRate}fps</span>
                <span>ISO {settings.iso}</span>
                <span>SS {settings.shutterSpeed}</span>
                <span>WB {settings.whiteBalanceTemp}K</span>
                <span>{settings.highBitrate ? "High Bitrate" : "Normal"}</span>
              </div>
              {capReport && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 8px", marginTop: 6, fontSize: 10 }}>
                  {capReport._summary?.ok > 0 && <span style={{ color: P.success, fontWeight: 600 }}>✓{capReport._summary.ok} aplicados</span>}
                  {capReport._summary?.adapted > 0 && <span style={{ color: P.warn, fontWeight: 600 }}>⚠{capReport._summary.adapted} adaptados</span>}
                  {capReport._summary?.unsupported > 0 && <span style={{ color: P.danger, fontWeight: 600 }}>✕{capReport._summary.unsupported} não suportados</span>}
                </div>
              )}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={downloadVideo} style={{ flex: 1, padding: "13px", borderRadius: 11, border: "none", background: P.success, color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>⬇ Salvar</button>
              <button onClick={reRecord} style={{ flex: 1, padding: "13px", borderRadius: 11, border: `1.5px solid ${P.accent}`, background: "transparent", color: P.accent, fontWeight: 600, fontSize: 14, cursor: "pointer" }}>🔄 Regravar</button>
              <button onClick={discardAndReturn} style={{ padding: "13px 16px", borderRadius: 11, border: `1px solid ${P.border}`, background: "transparent", color: P.textMuted, fontSize: 13, cursor: "pointer" }}>🗑</button>
            </div>
            <button
              onClick={() => onVideoConfirmed && recordedBlob && onVideoConfirmed(recordedBlob)}
              disabled={!onVideoConfirmed}
              style={{
                width: "100%", marginTop: 10, padding: "13px", borderRadius: 11,
                border: onVideoConfirmed ? "none" : `1px dashed ${P.border}`,
                background: onVideoConfirmed ? `linear-gradient(135deg, ${P.accent}, #6366f1)` : P.surfaceAlt,
                color: onVideoConfirmed ? "#fff" : P.textMuted,
                fontWeight: onVideoConfirmed ? 700 : 400,
                fontSize: 12,
                cursor: onVideoConfirmed ? "pointer" : "not-allowed",
                opacity: onVideoConfirmed ? 1 : 0.7,
                boxShadow: onVideoConfirmed ? `0 4px 20px ${P.accent}40` : "none",
              }}
            >
              {onVideoConfirmed ? "🧠 Usar este Vídeo" : "🧠 Enviar para Análise AI (em breve)"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
