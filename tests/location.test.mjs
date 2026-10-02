import test from "node:test";
import assert from "node:assert/strict";
import { isGoogleMapsUrl } from "../lib/location.mjs";

test("admin location accepts genuine HTTPS Google Maps links only", () => {
  assert.equal(isGoogleMapsUrl(""), true);
  assert.equal(isGoogleMapsUrl("https://maps.app.goo.gl/AbCdEf"), true);
  assert.equal(isGoogleMapsUrl("https://www.google.com/maps/place/Awoshie"), true);
  assert.equal(isGoogleMapsUrl("http://maps.app.goo.gl/AbCdEf"), false);
  assert.equal(isGoogleMapsUrl("https://maps.app.goo.gl.evil.example/path"), false);
  assert.equal(isGoogleMapsUrl("https://example.com/maps/place/Awoshie"), false);
});
