import test from "node:test";
import assert from "node:assert/strict";
import { createCompactSearchTimer } from "../lib/compactSearch.mjs";

function fixture() {
  let time = 0, id = 0, closes = 0;
  const pending = new Map();
  const timer = createCompactSearchTimer({ onClose: () => closes++, now: () => time,
    setTimer: (fn, delay) => { pending.set(++id, { at: time + delay, fn }); return id; },
    clearTimer: (id) => pending.delete(id) });
  const advance = (ms) => {
    const end = time + ms;
    while (pending.size) {
      const [nextId, next] = [...pending].sort((a, b) => a[1].at - b[1].at)[0];
      if (next.at > end) break;
      time = next.at; pending.delete(nextId); next.fn();
    }
    time = end;
  };
  return { timer, advance, closes: () => closes, pending };
}

test("idle search closes at ten seconds; typing starts a fresh idle interval", () => {
  const f = fixture(); f.advance(9999); assert.equal(f.closes(), 0);
  f.timer.interact(true); f.advance(9999); assert.equal(f.closes(), 0);
  f.advance(1); assert.equal(f.closes(), 1);
});
test("continuous page scrolling cannot extend the thirty-second typing limit", () => {
  const f = fixture();
  for (let i = 0; i < 59; i++) { f.advance(500); f.timer.pageScroll(); }
  assert.equal(f.closes(), 0); f.advance(500); assert.equal(f.closes(), 1);
});
test("typing while browsing resets the thirty-second limit", () => {
  const f = fixture();
  for (let i = 0; i < 40; i++) { f.advance(500); f.timer.pageScroll(); }
  f.timer.interact(true);
  for (let i = 0; i < 59; i++) { f.advance(500); f.timer.pageScroll(); }
  assert.equal(f.closes(), 0); f.advance(500); assert.equal(f.closes(), 1);
});
test("after scrolling stops the normal ten-second idle interval resumes", () => {
  const f = fixture(); f.advance(3000); f.timer.pageScroll();
  f.advance(9999); assert.equal(f.closes(), 0); f.advance(1); assert.equal(f.closes(), 1);
});
test("outside click closes after one second and returning inside cancels it", () => {
  const f = fixture(); f.timer.outside(); f.advance(999); assert.equal(f.closes(), 0);
  f.timer.interact(); f.advance(1); assert.equal(f.closes(), 0);
  f.timer.outside(); f.advance(1000); assert.equal(f.closes(), 1);
});
test("repeated outside clicks do not postpone dismissal; disposal cancels every timer", () => {
  const f = fixture(); f.timer.outside(); f.advance(600); f.timer.outside();
  f.advance(400); assert.equal(f.closes(), 1); assert.equal(f.pending.size, 0);
  const g = fixture(); g.timer.pageScroll(); g.timer.outside(); g.timer.dispose();
  g.advance(60000); assert.equal(g.closes(), 0); assert.equal(g.pending.size, 0);
});
