"use client";

import { useEffect, useId, useRef, useState } from "react";
import {
  Box,
  Typography,
  IconButton,
  Tooltip,
  Button,
} from "@mui/material";
import ICONS from "@/utils/iconUtil";
import LoadingState from "@/components/LoadingState";

const CAMERA_SELECTIONS = {
  AUTO_DEFAULT: "__auto_default__",
  AUTO_ENVIRONMENT: "__auto_environment__",
  AUTO_USER: "__auto_user__",
};

const CAMERA_SCAN_CONFIG = { fps: 10 };

const EXTERNAL_CAMERA_PATTERN = /\b(usb|external|webcam|logitech|uvc)\b/i;
const REAR_CAMERA_PATTERN = /\b(rear|back|environment|world)\b/i;
const FRONT_CAMERA_PATTERN = /\b(front|user|facetime|selfie)\b/i;

const isMediaDevicesSupported = () =>
  typeof navigator !== "undefined" &&
  !!navigator.mediaDevices?.getUserMedia &&
  !!navigator.mediaDevices?.enumerateDevices;

const isAutomaticSelection = (id) =>
  Object.values(CAMERA_SELECTIONS).includes(id);

const normalizeCameraLabel = (camera, index) =>
  camera?.label || (index === 0 ? "Default Camera" : `Camera ${index + 1}`);

const dedupeCameras = (cameras = []) => {
  const seen = new Set();
  return cameras.reduce((result, camera, index) => {
    const id = camera?.id || camera?.deviceId;
    if (!id || seen.has(id)) return result;
    seen.add(id);
    result.push({ id, label: normalizeCameraLabel(camera, index) });
    return result;
  }, []);
};

const getCameraScore = (camera) => {
  const label = camera?.label || "";
  let score = 0;
  if (EXTERNAL_CAMERA_PATTERN.test(label)) score += 60;
  if (REAR_CAMERA_PATTERN.test(label)) score += 30;
  if (FRONT_CAMERA_PATTERN.test(label)) score -= 20;
  return score;
};

const sortCamerasByScore = (cameras = []) =>
  [...dedupeCameras(cameras)].sort((a, b) => {
    const diff = getCameraScore(b) - getCameraScore(a);
    return diff !== 0 ? diff : a.label.localeCompare(b.label);
  });

const buildSelectableCameraOptions = (cameras = []) => {
  const options = [
    { id: CAMERA_SELECTIONS.AUTO_DEFAULT, label: "System default" },
    { id: CAMERA_SELECTIONS.AUTO_ENVIRONMENT, label: "Rear camera" },
    { id: CAMERA_SELECTIONS.AUTO_USER, label: "Front camera" },
  ];
  sortCamerasByScore(cameras).forEach((camera, index) => {
    options.push({ id: camera.id, label: camera.label || `Camera ${index + 1}` });
  });
  return options;
};

const getCameraErrorText = (error) =>
  `${error?.name || ""} ${error?.message || ""} ${typeof error === "string" ? error : ""}`.toLowerCase();

const isPermissionError = (error) => {
  const msg = getCameraErrorText(error);
  return msg.includes("notallowed") || msg.includes("permission");
};

const isNoCameraError = (error) => {
  const msg = getCameraErrorText(error);
  return msg.includes("notfound") || msg.includes("camera not found") || msg.includes("overconstrained");
};

const getCameraErrorMessage = (error) => {
  if (!isMediaDevicesSupported()) return "Camera error.";
  if (isPermissionError(error)) return "Camera permission denied.";
  if (isNoCameraError(error)) return "No camera found.";
  return "Camera error.";
};

const toVideoInputs = (devices = []) =>
  devices
    .filter((d) => d.kind === "videoinput")
    .map((d, i) => ({ id: d.deviceId, label: d.label || normalizeCameraLabel(d, i) }));

const buildCameraStartCandidates = (cameras = [], preferredCameraId = CAMERA_SELECTIONS.AUTO_DEFAULT) => {
  const candidates = [];
  const seen = new Set();
  const ranked = sortCamerasByScore(cameras);

  const add = (key, source, resolvedDeviceId = "") => {
    if (!source || seen.has(key)) return;
    seen.add(key);
    candidates.push({ key, source, resolvedDeviceId });
  };

  if (preferredCameraId && !isAutomaticSelection(preferredCameraId)) {
    add(`device:${preferredCameraId}`, preferredCameraId, preferredCameraId);
    return candidates;
  }

  const frontFirst = [
    ...ranked.filter((c) => FRONT_CAMERA_PATTERN.test(c.label)),
    ...ranked.filter((c) => !FRONT_CAMERA_PATTERN.test(c.label)),
  ];
  const envFirst = [
    ...ranked.filter((c) => EXTERNAL_CAMERA_PATTERN.test(c.label) || REAR_CAMERA_PATTERN.test(c.label) || getCameraScore(c) > 0),
    ...ranked.filter((c) => !EXTERNAL_CAMERA_PATTERN.test(c.label) && !REAR_CAMERA_PATTERN.test(c.label) && getCameraScore(c) <= 0),
  ];

  const ordered =
    preferredCameraId === CAMERA_SELECTIONS.AUTO_USER ? frontFirst
    : preferredCameraId === CAMERA_SELECTIONS.AUTO_ENVIRONMENT ? envFirst
    : ranked;

  ordered.forEach((c) => add(`device:${c.id}`, c.id, c.id));
  if (preferredCameraId === CAMERA_SELECTIONS.AUTO_USER) {
    add("constraint:user", { facingMode: "user" });
    add("constraint:default", {});
  } else if (preferredCameraId === CAMERA_SELECTIONS.AUTO_ENVIRONMENT) {
    add("constraint:environment", { facingMode: "environment" });
    add("constraint:default", {});
  } else {
    add("constraint:environment", { facingMode: "environment" });
    add("constraint:default", {});
  }
  return candidates;
};

export default function QrScanner({ onScanSuccess, onError, onCancel }) {
  const scannerElementId = useId().replace(/:/g, "_");
  const scannerHostRef = useRef(null);
  const scannerRef = useRef(null);
  const scannerModuleRef = useRef(null);
  const requestIdRef = useRef(0);
  const refreshCameraOptionsRef = useRef(null);
  const startScannerForSelectionRef = useRef(null);
  const onScanSuccessRef = useRef(onScanSuccess);
  const onErrorRef = useRef(onError);
  const scanHandledRef = useRef(false);

  const [loading, setLoading] = useState(true);
  const [cameraOptions, setCameraOptions] = useState([]);
  const [activeCameraId, setActiveCameraId] = useState("");
  const [selectedCameraId, setSelectedCameraId] = useState(CAMERA_SELECTIONS.AUTO_DEFAULT);
  const [switchError, setSwitchError] = useState("");

  const selectableCameraOptions = buildSelectableCameraOptions(cameraOptions);

  useEffect(() => { onScanSuccessRef.current = onScanSuccess; }, [onScanSuccess]);
  useEffect(() => { onErrorRef.current = onError; }, [onError]);

  const loadScannerModule = async () => {
    if (scannerModuleRef.current) return scannerModuleRef.current;
    const mod = await import("html5-qrcode");
    scannerModuleRef.current = mod;
    return mod;
  };

  const listAvailableCameras = async (mod) => {
    if (!isMediaDevicesSupported()) return [];
    try {
      return dedupeCameras(await mod.Html5Qrcode.getCameras());
    } catch (error) {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const inputs = dedupeCameras(toVideoInputs(devices));
        if (inputs.length > 0) return inputs;
      } catch {}
      throw error;
    }
  };

  const destroyScanner = async (scannerInstance = scannerRef.current) => {
    const mod = scannerModuleRef.current;
    const scanner = scannerInstance;
    if (!scanner) {
      if (scannerHostRef.current) scannerHostRef.current.innerHTML = "";
      return;
    }
    if (scannerRef.current === scanner) scannerRef.current = null;
    try {
      const state = scanner.getState?.();
      const scanning = mod?.Html5QrcodeScannerState?.SCANNING;
      const paused = mod?.Html5QrcodeScannerState?.PAUSED;
      if (state === scanning || state === paused) await scanner.stop();
    } catch {}
    try { scanner.clear(); } catch {}
    if (scannerHostRef.current && scannerHostRef.current.childElementCount === 0) {
      scannerHostRef.current.innerHTML = "";
    }
  };

  const createScanner = (mod) => {
    if (scannerHostRef.current) scannerHostRef.current.innerHTML = "";
    const scanner = new mod.Html5Qrcode(scannerElementId, {
      verbose: false,
      formatsToSupport: [mod.Html5QrcodeSupportedFormats.QR_CODE],
    });
    scannerRef.current = scanner;
    return scanner;
  };

  const startScannerForSelection = async (nextCameraId) => {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setSwitchError("");
    scanHandledRef.current = false;
    try {
      if (!isMediaDevicesSupported()) throw new Error("Camera API unavailable");
      const mod = await loadScannerModule();
      const discovered = await listAvailableCameras(mod);
      if (requestId !== requestIdRef.current) return;
      setCameraOptions(discovered);
      const candidates = buildCameraStartCandidates(discovered, nextCameraId);
      if (candidates.length === 0) throw new Error("Camera not found");

      let lastError = null;
      for (const candidate of candidates) {
        const scanner = createScanner(mod);
        try {
          await scanner.start(
            candidate.source,
            CAMERA_SCAN_CONFIG,
            async (decodedText) => {
              if (scanHandledRef.current) return;
              scanHandledRef.current = true;
              await destroyScanner(scanner);
              onScanSuccessRef.current?.(decodedText);
            },
            () => {}
          );
          if (requestId !== requestIdRef.current) { await destroyScanner(scanner); return; }
          setActiveCameraId(scanner.getRunningTrackSettings?.()?.deviceId || candidate.resolvedDeviceId || "");
          setSelectedCameraId(nextCameraId);
          setLoading(false);
          setSwitchError("");
          const labeled = await listAvailableCameras(mod).catch(() => discovered);
          if (requestId === requestIdRef.current) setCameraOptions(labeled.length > 0 ? labeled : discovered);
          return;
        } catch (error) {
          lastError = error;
          await destroyScanner(scanner);
        }
      }
      setLoading(false);
      if (discovered.length > 0) { setSwitchError(getCameraErrorMessage(lastError)); return; }
      onErrorRef.current?.(getCameraErrorMessage(lastError));
    } catch (error) {
      setLoading(false);
      onErrorRef.current?.(getCameraErrorMessage(error));
    }
  };

  startScannerForSelectionRef.current = startScannerForSelection;
  refreshCameraOptionsRef.current = async () => {
    try {
      const mod = await loadScannerModule();
      const cameras = await listAvailableCameras(mod);
      setCameraOptions(cameras);
    } catch {}
  };

  useEffect(() => {
    if (!isMediaDevicesSupported()) { onErrorRef.current?.("Camera API unavailable."); return; }
    void startScannerForSelectionRef.current?.(CAMERA_SELECTIONS.AUTO_DEFAULT);
    const handleDeviceChange = () => { void refreshCameraOptionsRef.current?.(); };
    navigator.mediaDevices.addEventListener?.("devicechange", handleDeviceChange);
    return () => {
      requestIdRef.current += 1;
      navigator.mediaDevices.removeEventListener?.("devicechange", handleDeviceChange);
      void destroyScanner();
    };
  }, []);

  const handleCameraChange = async (nextCameraId) => {
    if (!nextCameraId || loading) return;
    if (nextCameraId === selectedCameraId && (!activeCameraId || !isAutomaticSelection(nextCameraId))) return;
    setSelectedCameraId(nextCameraId);
    await destroyScanner();
    await startScannerForSelection(nextCameraId);
  };

  return (
    <Box
      sx={{
        position: "fixed",
        top: 0, left: 0,
        width: "100vw", height: "100vh",
        zIndex: 9999,
        backgroundColor: "#000",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
    >
      <Tooltip title="Cancel scanning">
        <IconButton
          onClick={onCancel}
          sx={{
            position: "absolute", top: 16, right: 16,
            color: "#fff",
            backgroundColor: "rgba(0,0,0,0.5)",
            "&:hover": { backgroundColor: "rgba(255,255,255,0.15)" },
          }}
        >
          <ICONS.close />
        </IconButton>
      </Tooltip>

      <Box
        sx={{
          width: "90vmin", height: "90vmin",
          position: "relative",
          borderRadius: 2, overflow: "hidden",
          boxShadow: 5, bgcolor: "#000",
        }}
      >
        <Box
          id={scannerElementId}
          ref={scannerHostRef}
          sx={{
            width: "100%", height: "100%",
            "& video, & canvas": { width: "100%", height: "100%", objectFit: "cover", display: "block" },
            "& > div": { width: "100%", height: "100%" },
          }}
        />

        {loading && (
          <LoadingState
            cardMaxWidth={340}
            skeletonLines={2}
            sx={{
              position: "absolute",
              inset: 0,
              zIndex: 2,
              backgroundColor: "rgba(0,0,0,0.62)",
              backdropFilter: "blur(8px)",
            }}
          />
        )}

        {!loading && (
          <Box
            sx={{
              position: "absolute", inset: 0,
              border: "2px dashed #00e676",
              pointerEvents: "none", boxSizing: "border-box", zIndex: 1,
            }}
          />
        )}

        {selectableCameraOptions.length > 0 && (
          <Box sx={{ position: "absolute", left: 16, right: 16, bottom: 16, zIndex: 3 }}>
            {switchError && (
              <Typography variant="caption" sx={{ display: "block", mb: 1, color: "#ff8a80", textAlign: "center" }}>
                {switchError}
              </Typography>
            )}
            <Typography variant="caption" sx={{ display: "block", mb: 1, color: "rgba(255,255,255,0.85)", textAlign: "center" }}>
              Choose camera
            </Typography>
            <Box sx={{ display: "flex", gap: 1, overflowX: "auto", pb: 0.5 }}>
              {selectableCameraOptions.map((camera, index) => {
                const isSelected = selectedCameraId === camera.id;
                return (
                  <Button
                    key={camera.id || `camera-${index}`}
                    size="small"
                    variant={isSelected ? "contained" : "outlined"}
                    startIcon={<ICONS.camera />}
                    disabled={loading}
                    onClick={() => { void handleCameraChange(camera.id); }}
                    sx={{
                      flexShrink: 0, minWidth: 140,
                      color: isSelected ? "#000" : "#fff",
                      backgroundColor: isSelected ? "#fff" : "rgba(0,0,0,0.65)",
                      borderColor: "rgba(255,255,255,0.35)",
                      "&:hover": {
                        borderColor: "#fff",
                        backgroundColor: isSelected ? "#f2f2f2" : "rgba(255,255,255,0.12)",
                      },
                    }}
                  >
                    {camera.label || `Camera ${index + 1}`}
                  </Button>
                );
              })}
            </Box>
          </Box>
        )}
      </Box>
    </Box>
  );
}
