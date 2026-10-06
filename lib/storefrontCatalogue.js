let pending;
let loadedAt = 0;

export function loadStorefrontCatalogue() {
  if (pending && Date.now() - loadedAt < 30000) return pending;
  loadedAt = Date.now();
  pending = fetch("/api/catalog/products").then(async (response) => {
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "The catalogue is temporarily unavailable.");
    return data;
  }).catch((error) => { pending = null; throw error; });
  return pending;
}
