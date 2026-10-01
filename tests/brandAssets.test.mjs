import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const themes = ["white", "navy", "yellow", "red"];

test("brand SVGs remain responsive vector paths without embedded raster data", () => {
  for (const theme of themes) {
    for (const kind of ["lockup", "symbol"]) {
      const file = join(process.cwd(), "public", "brand", `pam-${kind}-${theme}.svg`);
      const svg = readFileSync(file, "utf8");
      assert.match(svg, /viewBox="0 0 \d+ \d+"/);
      assert.match(svg, /<path\b/);
      assert.doesNotMatch(svg, /<image\b|data:image|<foreignObject\b/i);
      assert.ok(statSync(file).size < 30_000, `${file} is unexpectedly large`);
    }
  }
});

test("white-background artwork keeps the provided brand palette", () => {
  const symbol = readFileSync(join(process.cwd(), "public", "brand", "pam-symbol-white.svg"), "utf8");
  for (const color of ["#00235B", "#FFD166", "#A31621"]) assert.ok(symbol.includes(color));
});
