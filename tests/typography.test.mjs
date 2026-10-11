import test from "node:test";
import assert from "node:assert/strict";
import { normalizeTypography, typographyCss, validTypography } from "../lib/typography.mjs";
test("typography defaults match current design and validates bounded options", () => {
  const theme = normalizeTypography(); assert.equal(theme.website.fontSize, 16); assert.equal(theme.website.fontFamily, "nunito"); assert.equal(validTypography(theme), true);
  theme.website.fontFamily = "url(https://example.invalid/unsafe)"; assert.equal(validTypography(theme), false); assert.equal(normalizeTypography(theme).website.fontFamily, "nunito");
  theme.website.fontFamily = "arial"; theme.website.textColor = "red;display:none"; assert.equal(validTypography(theme), false);
  theme.website.textColor = "#112233"; theme.website.fontSize = 999; assert.equal(validTypography(theme), false);
});
test("safe CSS scopes customer pages and separates popup/crawler text", () => {
  const theme = normalizeTypography(); theme.website.fontSize = 18; theme.announcement.fontStyle = "italic"; theme.crawler.textColor = "#ffd166";
  const css = typographyCss(theme); assert.match(css, /html.pam-customer-theme\{font-size:18px/); assert.match(css, /announcement-list article[^}]+font-style:italic/); assert.match(css, /top-announcement-crawler[^}]+#ffd166/);
});
