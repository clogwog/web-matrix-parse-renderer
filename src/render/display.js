// The clocks write linear LED duty cycles. A browser treats those numbers as
// sRGB, so 51 (Tetris at 0.2) and 100 (Pong digits) look much darker than the
// same PWM on a real panel. amount 0 leaves the bytes alone. amount 100
// encodes them with the sRGB transfer. 0 stays black and 255 stays full.
export const DEFAULT_DISPLAY_BRIGHTNESS = 100;
export const DISPLAY_STORAGE_KEY = "panel-player-screen";

export function encodeLedChannel(value, amount)
{
    const channel = clampChannel(value);
    const mix = clampAmount(amount) / 100;
    if (mix <= 0 || channel === 0 || channel === 255)
    {
        return channel;
    }
    const linear = channel / 255;
    const encoded = linear <= 0.0031308
        ? 12.92 * linear
        : 1.055 * Math.pow(linear, 1 / 2.4) - 0.055;
    const lifted = encoded * 255;
    return clampChannel(Math.round(channel + (lifted - channel) * mix));
}

export function brightnessFromQuery(search)
{
    const params = new URLSearchParams(search || "");
    if (!params.has("brightness"))
    {
        return null;
    }
    return parseBrightness(params.get("brightness"));
}

export function parseBrightness(raw)
{
    if (raw == null)
    {
        return null;
    }
    const text = String(raw).trim();
    if (!/^\d+$/.test(text))
    {
        return null;
    }
    const amount = Number(text);
    if (amount > 100)
    {
        return null;
    }
    return amount;
}

export function locationWithBrightness(loc, amount)
{
    const params = new URLSearchParams(loc.search || "");
    params.set("brightness", String(clampAmount(amount)));
    const query = params.toString();
    const path = loc.pathname || "";
    const hash = loc.hash || "";
    return path + (query ? "?" + query : "") + hash;
}

function clampChannel(value)
{
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0)
    {
        return 0;
    }
    if (n >= 255)
    {
        return 255;
    }
    return Math.round(n);
}

function clampAmount(amount)
{
    const n = Number(amount);
    if (!Number.isFinite(n) || n <= 0)
    {
        return 0;
    }
    if (n >= 100)
    {
        return 100;
    }
    return Math.round(n);
}
