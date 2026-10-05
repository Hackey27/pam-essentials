import { createScanGate } from "./scannerWorkflow.mjs";

const formats = ["qr_code", "code_128", "code_39", "code_93", "ean_13", "ean_8", "upc_a", "upc_e", "data_matrix", "pdf417"];

// One camera pipeline for Admin and POS. Stop also handles cancellation while
// permission, the reader import, or a decode is still pending.
export function startBarcodeCamera(video, onCode, environment = {}, { continuous = false, isPaused = () => false } = {}) {
  const mediaDevices = environment.mediaDevices ?? globalThis.navigator?.mediaDevices;
  const Detector = environment.Detector ?? globalThis.BarcodeDetector;
  const schedule = environment.schedule ?? globalThis.requestAnimationFrame;
  const cancel = environment.cancel ?? globalThis.cancelAnimationFrame;
  const loadReader = environment.loadReader ?? (() => import("@zxing/browser"));
  let stopped = false;
  let stream;
  let controls;
  let frame;
  const gate = createScanGate(environment.now);
  function stop() {
    stopped = true;
    if (frame != null) cancel(frame);
    controls?.stop();
    controls = null;
    stream?.getTracks().forEach((track) => track.stop());
    stream = null;
    video.srcObject = null;
  }
  function accept(code) {
    if (stopped || isPaused()) return;
    if (continuous && !gate(code) || !code) return;
    if (!continuous) stop();
    onCode(code);
  }
  const ready = (async () => {
    try {
      if (!mediaDevices?.getUserMedia) throw new Error("Camera scanning is unavailable here. Use a connected scanner or type the code.");
      let detector;
      if (Detector) {
        try {
          const supported = typeof Detector.getSupportedFormats === "function" ? await Detector.getSupportedFormats() : formats;
          const available = formats.filter((format) => supported.includes(format));
          if (available.length) detector = new Detector({ formats: available });
        } catch { /* Use the reader fallback if native detection is unavailable. */ }
      }
      if (stopped) return;
      const acquired = await mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: "environment" } } });
      if (stopped) { acquired.getTracks().forEach((track) => track.stop()); return; }
      stream = acquired;
      if (!detector) {
        const { BrowserMultiFormatReader } = await loadReader();
        if (stopped) return;
        const reader = new BrowserMultiFormatReader(undefined, { delayBetweenScanAttempts: 100, delayBetweenScanSuccess: 100 });
        const scanning = await reader.decodeFromStream(stream, video, (result, _error, readerControls) => {
          if (!stopped) { controls = readerControls; accept(result?.getText() || ""); }
        });
        if (stopped) scanning?.stop();
        else controls = scanning;
        return;
      }
      video.srcObject = stream;
      await video.play();
      if (stopped) return;
      const inspect = async () => {
        if (stopped) return;
        try {
          if (!isPaused() && video.readyState >= 2) {
            const codes = await detector.detect(video);
            const code = codes.find((entry) => entry.rawValue)?.rawValue;
            accept(code || "");
            if (stopped) return;
          }
        } catch { /* Ignore a transient unreadable frame and keep scanning. */ }
        if (!stopped) frame = schedule(inspect);
      };
      frame = schedule(inspect);
    } catch (error) {
      const cancelled = stopped;
      stop();
      if (!cancelled) throw error;
    }
  })();
  return { stop, ready };
}
