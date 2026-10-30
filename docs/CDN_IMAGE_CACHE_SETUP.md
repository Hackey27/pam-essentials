# Public catalogue and image caching
Application protections are independent of CDN configuration. This document does not mean these edge rules have been applied.

## Application
- Catalogue: one shared, single-flight snapshot per Cloud Run instance, valid for 60 seconds. Failures are not cached. Response: `Cache-Control: public, s-maxage=60, stale-while-revalidate=300`.
- Product Firestore reads use a field projection excluding costs, suppliers and barcode history. Field projection reduces payload size, not billed document reads.
- Optional catalogue query: `?mode=retail&q=pen&categoryId=writing&page=1&limit=60&sort=name`. Limit 1–120; mode retail/wholesale; sort default/name/price-asc/price-desc. Filters/pagination run on the cached public snapshot. The existing unparameterised full catalogue remains compatible with current storefront search, variants and comparisons.
- Checkout, stock reservations and POS continue using live authoritative records.
- Images: only widths160,320,640,960,1600, qualities70,85, WebP format. Unknown/duplicate parameters are400. Public route only reads stored files; it never invokes Sharp. Four independent image reads per instance; duplicate work is coalesced; stored variants have a bounded32MB memory cache.
- New authenticated product/hero uploads generate ten immutable stored WebP variants before returning success. One upload transformation job per instance. Originals and assignments remain unchanged.
- Existing images use a60-second-cache original fallback until backfilled. Admin Settings → Stored image sizes → Generate sizes for existing images. This is resumable and processes one original at a time; completed manifests are skipped.

## Cloudflare dashboard (requires domain access)
1. Confirm pamess.com/www DNS records use the proxy and valid TLS. Do not change records blindly or disable certificate validation.
2. Cache Rule: host pamess.com and path starts /images/. Set cache eligibility Eligible for cache; respect origin Cache-Control. Keep the complete query string in the cache key, including w,q,fmt. Do not strip them or share different widths/qualities.
3. Cache Rule: host pamess.com and path exactly /api/catalog/products. Eligible for cache; respect origin Cache-Control. Keep filter/pagination query parameters in the key.
4. Do not cache Admin, POS, account/order APIs, errors503/429, or authenticated upload/backfill responses.
5. Add an /images/* rate-limit rule keyed by client IP. Choose a threshold supported by the plan (initially300requests/minute, short60-second block; tune for shared connections and actual catalogue image bursts). Do not cache rate-limit/error responses.
6. Verify CF-Cache-Status HIT/Age on repeated successful image/catalogue requests; verify different image sizes return different objects and all private endpoints bypass cache.
No Cloudflare credentials or DNS changes belong in source control.

## Cloud Run
Image admission is capped in application code and public Sharp processing is removed. Cloud Run request concurrency and maximum instances apply to a service, not an individual route. Changing the whole shop to concurrency4 would affect checkout/POS and is not part of this patch. A separately routed image service can be provisioned later if needed, with concurrency4–8 and its own max-instance budget.
The current cache is per instance, not a persisted Firestore snapshot; a cold instance or expired snapshot rebuild still reads the projected source collections. Consider a versioned Cloud Storage snapshot with change-event rebuilds if traffic grows.
References: https://docs.cloud.google.com/run/docs/configuring/concurrency , https://developers.cloudflare.com/cache/how-to/cache-rules/ , https://developers.cloudflare.com/cache/how-to/cache-keys/ .
