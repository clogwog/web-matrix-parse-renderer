// The clocks write linear LED duty cycles. A browser treats those numbers as
// sRGB, so 10 (Pong centre dashes) and 51 (Tetris at 0.2) look much darker
// than the same PWM on a real panel. 0 leaves the bytes alone. 100 is the
// sRGB transfer. The slider continues to 160, and 140 is the default: a
// little past that transfer. 0 stays black and 255 stays full.
export const DEFAULT_DISPLAY_BRIGHTNESS = 140;
export const DISPLAY_BRIGHTNESS_MAX = 160;
export const DISPLAY_STORAGE_KEY = "panel-player-screen";

export function encodeLedChannel(value, amount)
{
    const channel = clampChannel(value);
    const mix = clampAmount(amount);
    if (mix <= 0 || channel === 0 || channel === 255)
    {
        return channel;
    }
    const srgb = srgbChannel(channel);
    if (mix <= 100)
    {
        return clampChannel(Math.round(channel + (srgb - channel) * (mix / 100)));
    }
    const extra = (mix - 100) / (DISPLAY_BRIGHTNESS_MAX - 100);
    const strong = 255 * Math.pow(channel / 255, 1 / 3.4);
    return clampChannel(Math.round(srgb + (strong - srgb) * extra));
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
    if (amount > DISPLAY_BRIGHTNESS_MAX)
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

function srgbChannel(channel)
{
    const linear = channel / 255;
    const encoded = linear <= 0.0031308
        ? 12.92 * linear
        : 1.055 * Math.pow(linear, 1 / 2.4) - 0.055;
    return encoded * 255;
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
    if (n >= DISPLAY_BRIGHTNESS_MAX)
    {
        return DISPLAY_BRIGHTNESS_MAX;
    }
    return Math.round(n);
}
