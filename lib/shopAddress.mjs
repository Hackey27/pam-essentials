export const CURRENT_SHOP_ADDRESS = "Atlas Bus Station, 37 Atankpa Tettey Street, Awoshie, Accra";
const LEGACY_SHOP_ADDRESS = "PAM Essentials & More, Awoshie, Accra, Ghana";

export const currentShopAddress = (value) => !value || String(value).trim() === LEGACY_SHOP_ADDRESS ? CURRENT_SHOP_ADDRESS : String(value);
