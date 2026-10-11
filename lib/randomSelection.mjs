export function randomSelectionNote(product, notes = "") {
  if (String(notes || "").trim()) return "";
  const choices = [product?.randomColours && "colours", product?.randomSizes && "sizes", product?.randomShapes && "shapes"].filter(Boolean);
  if (!choices.length) return "";
  const label = choices.length > 1 ? `${choices.slice(0, -1).join(", ")} or ${choices.at(-1)}` : choices[0];
  return `Random ${label} unless you indicate a choice in notes.`;
}
