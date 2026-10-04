import { variantKey } from "./adminVariants.mjs";

export function productOptions(product) {
  const options = { ...(product?.variantOptions || {}) };
  for (const key of ["colour", "size"]) if (!options[key] && product?.[key]) options[key] = product[key];
  return options;
}

export function variantTitles(variants) {
  const configured = variants.find((item) => Array.isArray(item.variantTitles) && item.variantTitles.length)?.variantTitles;
  if (configured) return configured.map((item) => ({ title: item.title, key: variantKey(item.title) }));
  const keys = [...new Set(variants.flatMap((item) => Object.keys(productOptions(item))))];
  return keys.map((key) => ({ title: key.charAt(0).toUpperCase() + key.slice(1), key }));
}

export function variantDetail(product, titles) {
  const options = productOptions(product);
  const keys = titles?.length ? titles.map((item) => item.key) : Object.keys(options);
  return keys.map((key) => options[key]).filter(Boolean).join(" / ");
}

export function selectVariant(variants, selected, key, value, strictOthers = false) {
  const current = productOptions(selected);
  const matches = variants.filter((item) => productOptions(item)[key] === value && Number(item.stock) > 0 && Number(item.price) > 0 && (!strictOthers || Object.entries(current).every(([other, option]) => other === key || productOptions(item)[other] === option)));
  return matches.sort((a, b) => {
    const score = (item) => Object.entries(current).filter(([other, option]) => other !== key && productOptions(item)[other] === option).length;
    return score(b) - score(a);
  })[0] || null;
}
