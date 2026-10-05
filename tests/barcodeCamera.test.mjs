import test from "node:test";
import assert from "node:assert/strict";
import { startBarcodeCamera } from "../lib/barcodeCamera.mjs";

function fixture() {
  let stopped = 0;
  const stream = { getTracks: () => [{ stop: () => stopped++ }] };
  const video = { readyState: 2, srcObject: null, async play() {} };
  const frames = [];
  const codes = [];
  const mediaDevices = { async getUserMedia(constraints) { assert.equal(constraints.audio, false); assert.equal(constraints.video.facingMode.ideal, "environment"); return stream; } };
  return { video, stream, frames, codes, stops: () => stopped, env: { mediaDevices, schedule: (callback) => { frames.push(callback); return frames.length; }, cancel() {} } };
}

test("native camera pipeline records exactly one barcode and releases the camera", async () => {
  const f = fixture();
  let formats;
  class Detector {
    static async getSupportedFormats() { return ["ean_13", "code_128", "unsupported"]; }
    constructor(options) { formats = options.formats; }
    async detect() { return [{ rawValue: "0123456789012" }]; }
  }
  const camera = startBarcodeCamera(f.video, (code) => f.codes.push(code), { ...f.env, Detector, loadReader: () => { throw new Error("Native detection should not load the fallback"); } });
  await camera.ready;
  assert.deepEqual(formats, ["code_128", "ean_13"]);
  assert.equal(f.video.srcObject, f.stream);
  await f.frames[0]();
  await f.frames[0]();
  assert.deepEqual(f.codes, ["0123456789012"]);
  assert.equal(f.stops(), 1);
  assert.equal(f.video.srcObject, null);
});

test("fallback uses the same rear camera stream with faster repeated decoding", async () => {
  const f = fixture();
  let callback;
  let stopped = 0;
  const controls = { stop: () => stopped++ };
  class UnsupportedDetector { static async getSupportedFormats() { return []; } }
  class Reader {
    constructor(_hints, options) { assert.equal(options.delayBetweenScanAttempts, 100); }
    async decodeFromStream(stream, video, onResult) { assert.equal(stream, f.stream); assert.equal(video, f.video); callback = onResult; return controls; }
  }
  const camera = startBarcodeCamera(f.video, (code) => f.codes.push(code), { ...f.env, Detector: UnsupportedDetector, loadReader: async () => ({ BrowserMultiFormatReader: Reader }) });
  await camera.ready;
  callback({ getText: () => "ABC-123" }, null, controls);
  callback({ getText: () => "ABC-123" }, null, controls);
  assert.deepEqual(f.codes, ["ABC-123"]);
  assert.equal(stopped, 1);
  assert.equal(f.stops(), 1);
});

test("closing before camera permission resolves stops the acquired stream and never records a code", async () => {
  const f = fixture();
  let acquire;
  const pending = new Promise((resolve) => { acquire = resolve; });
  const camera = startBarcodeCamera(f.video, (code) => f.codes.push(code), { ...f.env, mediaDevices: { getUserMedia: () => pending } });
  camera.stop();
  acquire(f.stream);
  await camera.ready;
  assert.equal(f.stops(), 1);
  assert.deepEqual(f.codes, []);
});

test("permission failure is reported without keeping the camera open", async () => {
  const f = fixture();
  const error = Object.assign(new Error("Denied"), { name: "NotAllowedError" });
  const camera = startBarcodeCamera(f.video, () => {}, { ...f.env, mediaDevices: { async getUserMedia() { throw error; } } });
  await assert.rejects(camera.ready, { name: "NotAllowedError" });
  assert.equal(f.video.srcObject, null);
});

test("closing during native decode discards a late result", async () => {
  const f = fixture();
  let finish;
  class Detector { async detect() { return new Promise((resolve) => { finish = resolve; }); } }
  const camera = startBarcodeCamera(f.video, (code) => f.codes.push(code), { ...f.env, Detector });
  await camera.ready;
  const inspecting = f.frames[0]();
  camera.stop();
  finish([{ rawValue: "late-result" }]);
  await inspecting;
  assert.deepEqual(f.codes, []);
  assert.equal(f.stops(), 1);
});


test("continuous native scanning keeps the stream, pauses for a popup, and rearms after removal", async () => {
  const f = fixture();
  let time = 0;
  let paused = false;
  const values = ["111", "111", "", "111", "222"];
  class Detector { async detect() { const rawValue = values.shift(); return rawValue ? [{ rawValue }] : []; } }
  const camera = startBarcodeCamera(f.video, (code) => f.codes.push(code), { ...f.env, Detector, now: () => time }, { continuous: true, isPaused: () => paused });
  await camera.ready;
  await f.frames.at(-1)();
  paused = true;
  await f.frames.at(-1)();
  paused = false;
  await f.frames.at(-1)();
  assert.deepEqual(f.codes, ["111"]);
  assert.equal(f.stops(), 0);
  assert.equal(f.video.srcObject, f.stream);
  await f.frames.at(-1)();
  time = 800;
  await f.frames.at(-1)();
  await f.frames.at(-1)();
  assert.deepEqual(f.codes, ["111", "111", "222"]);
  camera.stop();
  assert.equal(f.stops(), 1);
});

test("continuous fallback remains open and suppresses repeated frames while prompts are acknowledged", async () => {
  const f = fixture();
  let callback;
  let stopped = 0;
  let paused = false;
  let time = 0;
  const controls = { stop: () => stopped++ };
  class NoNativeFormats { static async getSupportedFormats() { return []; } }
  class Reader { async decodeFromStream(_stream, _video, listener) { callback = listener; return controls; } }
  const camera = startBarcodeCamera(f.video, (code) => f.codes.push(code), { ...f.env, Detector: NoNativeFormats, now: () => time, loadReader: async () => ({ BrowserMultiFormatReader: Reader }) }, { continuous: true, isPaused: () => paused });
  await camera.ready;
  const result = (code) => ({ getText: () => code });
  callback(result("111"), null, controls);
  paused = true;
  callback(result("222"), null, controls);
  paused = false;
  callback(result("111"), null, controls);
  assert.deepEqual(f.codes, ["111"]);
  callback(null, new Error("No barcode"), controls);
  time = 800;
  callback(result("111"), null, controls);
  callback(result("222"), null, controls);
  assert.deepEqual(f.codes, ["111", "111", "222"]);
  assert.equal(stopped, 0);
  assert.equal(f.stops(), 0);
  camera.stop();
  assert.equal(stopped, 1);
  assert.equal(f.stops(), 1);
});
