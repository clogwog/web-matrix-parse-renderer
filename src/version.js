// Bump this string on every deploy, then run `node scripts/stamp-version.js`.
// The same token is written onto the CSS link, every relative module import,
// and the fetched .cc / .h / .bdf URLs so a long-lived CDN entry cannot win.
export const BUILD_VERSION = "20261024";

export function withAssetVersion(url)
{
    const next = new URL(url.href);
    next.searchParams.set("v", BUILD_VERSION);
    return next;
}
