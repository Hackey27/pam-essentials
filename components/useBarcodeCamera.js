"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { startBarcodeCamera } from "@/lib/barcodeCamera.mjs";

export default function useBarcodeCamera(onCode, onError, options = {}) {
  const [cameraOpen, setCameraOpen] = useState(false);
  const videoRef = useRef(null);
  const scannerRef = useRef(null);
  const callbacks = useRef({ onCode, onError, options });
  callbacks.current = { onCode, onError, options };
  const closeCamera = useCallback(() => {
    scannerRef.current?.stop();
    scannerRef.current = null;
    setCameraOpen(false);
  }, []);
  const openCamera = useCallback(() => setCameraOpen(true), []);
  useEffect(() => {
    if (!cameraOpen || !videoRef.current) return;
    let active = true;
    const scanner = startBarcodeCamera(videoRef.current, (code) => {
      if (!active) return;
      if (!callbacks.current.options.continuous) closeCamera();
      callbacks.current.onCode(code);
    }, {}, { continuous: Boolean(options.continuous), isPaused: () => Boolean(callbacks.current.options.paused || callbacks.current.options.isPaused?.()) });
    scannerRef.current = scanner;
    scanner.ready.catch((error) => {
      if (!active) return;
      if (!callbacks.current.options.keepOpenOnError) closeCamera();
      callbacks.current.onError(error?.name === "NotAllowedError" ? "Camera permission was denied. Allow camera access or use a connected scanner." : error?.message || "Could not start camera scanning. Use a connected scanner or type the code.");
    });
    return () => { active = false; scanner.stop(); if (scannerRef.current === scanner) scannerRef.current = null; };
  }, [cameraOpen, closeCamera, options.continuous]);
  return { cameraOpen, videoRef, openCamera, closeCamera };
}
