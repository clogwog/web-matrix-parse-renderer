// The clocks write SetPixel bytes. The matrix library then maps each byte
// through CIE1931, and a browser treats canvas values as sRGB. 0 leaves the
// bytes alone. Above 0, the strongest channel follows the lift below (100 is
// the sRGB step, 140 the default, 160 the top) and the other channels keep
// the CIE ratios. 0 stays black and 255 stays full.
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

// RGBMatrix::SetPixel maps each byte through CIE1931 before the PWM bitplanes
// (framebuffer.cc, luminance correction on, 11 planes, brightness 100). A
// per-channel screen lift squeezes a pastel such as Brent's skin toward grey.
// The strongest channel still follows encodeLedChannel, so the slider's
// brightness stays put. The other channels keep the panel's CIE ratios.
export function encodeLedColor(r, g, b, amount)
{
    const raw = [clampChannel(r), clampChannel(g), clampChannel(b)];
    const mix = clampAmount(amount);
    if (mix <= 0 || (raw[0] === 0 && raw[1] === 0 && raw[2] === 0))
    {
        return raw;
    }
    const peak = Math.max(raw[0], raw[1], raw[2]);
    const shownPeak = encodeLedChannel(peak, mix);
    const linear = [cieLinear(raw[0]), cieLinear(raw[1]), cieLinear(raw[2])];
    let peakIndex = 0;
    if (raw[1] > raw[peakIndex])
    {
        peakIndex = 1;
    }
    if (raw[2] > raw[peakIndex])
    {
        peakIndex = 2;
    }
    const yPeak = linear[peakIndex];
    if (yPeak <= 0)
    {
        return [encodeLedChannel(raw[0], mix), encodeLedChannel(raw[1], mix), encodeLedChannel(raw[2], mix)];
    }
    const exposure = srgbToLinear(shownPeak) / yPeak;
    const out = linear.map(function (y)
    {
        return linearToSrgb(y * exposure);
    });
    for (let i = 0; i < 3; i++)
    {
        if (raw[i] === 0)
        {
            out[i] = 0;
        }
        else if (raw[i] === peak || raw[i] === 255)
        {
            out[i] = raw[i] === 255 ? 255 : shownPeak;
        }
        else if (out[i] > shownPeak)
        {
            out[i] = shownPeak;
        }
    }
    return out;
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

// hzeller framebuffer.cc luminance_cie1931, brightness 100, kBitPlanes 11.
function cieLinear(channel)
{
    const planes = 2047;
    const v = channel * 100 / 255;
    const portion = v <= 8 ? v / 902.3 : Math.pow((v + 16) / 116, 3);
    return Math.trunc(planes * portion) / planes;
}

function srgbToLinear(encoded)
{
    const s = encoded / 255;
    if (s <= 0.04045)
    {
        return s / 12.92;
    }
    return Math.pow((s + 0.055) / 1.055, 2.4);
}

function linearToSrgb(y)
{
    if (y <= 0)
    {
        return 0;
    }
    if (y >= 1)
    {
        return 255;
    }
    const encoded = y <= 0.0031308
        ? 12.92 * y
        : 1.055 * Math.pow(y, 1 / 2.4) - 0.055;
    return clampChannel(Math.round(encoded * 255));
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
