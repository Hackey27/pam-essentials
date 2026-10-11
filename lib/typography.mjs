export const TYPOGRAPHY_KEY = "STOREFRONT_TYPOGRAPHY";
export const typographyFonts = [
  { id: "nunito", label: "Nunito Sans", css: '"Nunito Sans Variable", "Nunito Sans", system-ui, sans-serif' },
  { id: "comfortaa", label: "Comfortaa", css: '"Comfortaa Variable", "Comfortaa", system-ui, sans-serif' },
  { id: "system", label: "System sans serif", css: 'system-ui, sans-serif' },
  { id: "arial", label: "Arial", css: 'Arial, sans-serif' },
  { id: "georgia", label: "Georgia", css: 'Georgia, serif' },
];
const family = (key, label, value) => ({ key, label, type: "font", value });
const size = (key, label, value, min = 12, max = 28) => ({ key, label, type: "number", value, min, max });
const colour = (key, label, value) => ({ key, label, type: "color", value });
const textFields = [family("fontFamily", "Font family", "nunito"), { key: "fontWeight", label: "Font weight", type: "weight", value: 400 }, { key: "fontStyle", label: "Font style", type: "style", value: "normal" }];
export const typographySections = [
  { id: "website", title: "Website typography", fields: [...textFields, size("fontSize", "Base font size (px)", 16, 12, 22), size("lineHeight", "Line spacing", 1.5, 1.2, 2), colour("textColor", "Base text colour", "#17222d"), family("headingFamily", "Heading font", "comfortaa"), colour("headingColor", "Heading colour", "#00235b")] },
  { id: "announcement", title: "Announcement popups", fields: [...textFields, size("fontSize", "Message font size (px)", 16), colour("textColor", "Message colour", "#17222d"), colour("backgroundColor", "Message background", "#eaf0f8"), family("headingFamily", "Title font", "comfortaa"), size("headingSize", "Title font size (px)", 16, 14, 36), colour("headingColor", "Title colour", "#00235b")] },
  { id: "crawler", title: "Announcement crawler", fields: [...textFields.map((field) => field.key === "fontWeight" ? { ...field, value: 700 } : field), size("fontSize", "Font size (px)", 12.16, 10, 22), colour("textColor", "Text colour", "#ffffff"), colour("backgroundColor", "Background colour", "#00235b"), colour("linkColor", "Action link colour", "#ffd166")] },
];
const object = (value) => value && typeof value === "object" && !Array.isArray(value);
function validField(field, value) {
  if (field.type === "font") return typographyFonts.some((font) => font.id === value);
  if (field.type === "number") return typeof value === "number" && Number.isFinite(value) && value >= field.min && value <= field.max;
  if (field.type === "color") return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value);
  if (field.type === "weight") return [400, 600, 700, 800, 900].includes(value);
  return ["normal", "italic"].includes(value);
}
export function normalizeTypography(value) {
  return { version: 1, ...Object.fromEntries(typographySections.map((section) => [section.id, Object.fromEntries(section.fields.map((field) => [field.key, validField(field, value?.[section.id]?.[field.key]) ? value[section.id][field.key] : field.value]))])) };
}
export function validTypography(value) {
  return object(value) && value.version === 1 && Object.keys(value).every((key) => key === "version" || typographySections.some((section) => section.id === key)) && typographySections.every((section) => object(value[section.id]) && Object.keys(value[section.id]).every((key) => section.fields.some((field) => field.key === key)) && section.fields.every((field) => validField(field, value[section.id][field.key])));
}
export const fontCss = (id) => typographyFonts.find((font) => font.id === id)?.css || typographyFonts[0].css;
export function typographyCss(value) {
  const { website: w, announcement: a, crawler: c } = normalizeTypography(value);
  const headingRule = w.headingColor.toLowerCase() === "#00235b" ? "" : `.pam-customer-theme :is(h1,h2,h3):not(:where(.account-hero *, .info-hero *, .hero.has-web-image *, .hero.has-mobile-image *)){color:var(--pam-heading-color);}`;
  return `html.pam-customer-theme{font-size:${w.fontSize}px;--font-body:${fontCss(w.fontFamily)};--font-brand:${fontCss(w.headingFamily)};--ink:${w.textColor};--pam-heading-color:${w.headingColor};}
.pam-customer-theme body{font-weight:${w.fontWeight};font-style:${w.fontStyle};line-height:${w.lineHeight};}
${headingRule}
.pam-customer-theme .announcement-list article{font-family:${fontCss(a.fontFamily)};font-size:${a.fontSize}px;font-weight:${a.fontWeight};font-style:${a.fontStyle};color:${a.textColor};background:${a.backgroundColor};}
.pam-customer-theme .announcement-list h3{font-family:${fontCss(a.headingFamily)};font-size:${a.headingSize}px;color:${a.headingColor};}
.pam-customer-theme .top-announcement-crawler{height:${Math.max(28, Math.ceil(c.fontSize * 1.5 + 8))}px;font-family:${fontCss(c.fontFamily)};font-size:${c.fontSize}px;font-weight:${c.fontWeight};font-style:${c.fontStyle};color:${c.textColor};background:${c.backgroundColor};}
.pam-customer-theme .top-announcement-track a{color:${c.linkColor};text-decoration:underline;}`;
}
