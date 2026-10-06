export function randomSelectionNote(product) {
  return product?.randomColours || product?.randomShapes ? "Random colours or shapes unless you indicate a choice in notes." : "";
}
