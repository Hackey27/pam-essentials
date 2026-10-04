"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { startBarcodeCamera } from "@/lib/barcodeCamera.mjs";

export default function useBarcodeCamera(onCode, onError) {
  const [cameraOpen, setCameraOpen] = useState(false);
  const videoRef = useRef(null);
  const scannerRef = useRef(null);
  const callbacks = useRef({ onCode, onError });
  callbacks.current = { onCode, onError };
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
      closeCamera();
      callbacks.current.onCode(code);
    });
    scannerRef.current = scanner;
    scanner.ready.catch((error) => {
      if (!active) return;
      closeCamera();
      callbacks.current.onError(error?.name === "NotAllowedError" ? "Camera permission was denied. Allow camera access or use a connected scanner." : error?.message || "Could not start camera scanning. Use a connected scanner or type the code.");
    });
    return () => { active = false; scanner.stop(); if (scannerRef.current === scanner) scannerRef.current = null; };
  }, [cameraOpen, closeCamera]);
  return { cameraOpen, videoRef, openCamera, closeCamera };
}
