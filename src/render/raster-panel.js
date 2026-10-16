export function rasterPanel(frame, options)
{
    const cell = options && options.cell ? options.cell : 16;
    const gap = options && options.gap != null ? options.gap : 5;
    const pad = options && options.pad != null ? options.pad : 22;
    const pitch = cell + gap;
    const width = pad * 2 + frame.width * cell + (frame.width - 1) * gap;
    const height = pad * 2 + frame.height * cell + (frame.height - 1) * gap;
    const rgba = Buffer.alloc(width * height * 4);
    fillRect(rgba, width, 0, 0, width, height, 7, 8, 12, 255);
    fillRoundRect(rgba, width, 8, 8, width - 16, height - 16, 18, 16, 18, 24, 255);

    const radius = cell * 0.46;
    for (let y = 0; y < frame.height; y++)
    {
        for (let x = 0; x < frame.width; x++)
        {
            const i = (y * frame.width + x) * 3;
            const r = frame.pixels[i];
            const g = frame.pixels[i + 1];
            const b = frame.pixels[i + 2];
            const cx = pad + x * pitch + cell / 2;
            const cy = pad + y * pitch + cell / 2;
            if (r === 0 && g === 0 && b === 0)
            {
                stamp(rgba, width, height, cx, cy, radius * 0.72, 26, 29, 39, 255);
                continue;
            }
            stamp(rgba, width, height, cx, cy, radius * 1.35, r, g, b, 72);
            stamp(rgba, width, height, cx, cy, radius, r, g, b, 255);
            stamp(rgba, width, height, cx - radius * 0.22, cy - radius * 0.24, radius * 0.22, 255, 255, 255, 96);
        }
    }
    return { width, height, rgba };
}

function fillRect(rgba, imgW, x, y, w, h, r, g, b, a)
{
    const x0 = Math.max(0, x | 0);
    const y0 = Math.max(0, y | 0);
    const x1 = Math.min(imgW, (x + w) | 0);
    const y1 = Math.min(rgba.length / (imgW * 4), (y + h) | 0);
    for (let yy = y0; yy < y1; yy++)
    {
        for (let xx = x0; xx < x1; xx++)
        {
            blend(rgba, imgW, xx, yy, r, g, b, a);
        }
    }
}

function fillRoundRect(rgba, imgW, x, y, w, h, radius, r, g, b, a)
{
    const x0 = Math.max(0, Math.floor(x));
    const y0 = Math.max(0, Math.floor(y));
    const x1 = Math.min(imgW - 1, Math.ceil(x + w));
    const y1 = Math.min((rgba.length / (imgW * 4)) - 1, Math.ceil(y + h));
    for (let yy = y0; yy <= y1; yy++)
    {
        for (let xx = x0; xx <= x1; xx++)
        {
            if (insideRound(xx + 0.5, yy + 0.5, x, y, w, h, radius))
            {
                blend(rgba, imgW, xx, yy, r, g, b, a);
            }
        }
    }
}

function insideRound(px, py, x, y, w, h, radius)
{
    const r = Math.min(radius, w / 2, h / 2);
    const left = x + r;
    const right = x + w - r;
    const top = y + r;
    const bottom = y + h - r;
    if (px >= left && px <= right && py >= y && py <= y + h)
    {
        return true;
    }
    if (py >= top && py <= bottom && px >= x && px <= x + w)
    {
        return true;
    }
    const corners = [
        [left, top],
        [right, top],
        [right, bottom],
        [left, bottom]
    ];
    for (const corner of corners)
    {
        const dx = px - corner[0];
        const dy = py - corner[1];
        if (dx * dx + dy * dy <= r * r)
        {
            return true;
        }
    }
    return false;
}

function stamp(rgba, imgW, imgH, cx, cy, radius, r, g, b, a)
{
    const x0 = Math.max(0, Math.floor(cx - radius));
    const y0 = Math.max(0, Math.floor(cy - radius));
    const x1 = Math.min(imgW - 1, Math.ceil(cx + radius));
    const y1 = Math.min(imgH - 1, Math.ceil(cy + radius));
    const r2 = radius * radius;
    for (let y = y0; y <= y1; y++)
    {
        for (let x = x0; x <= x1; x++)
        {
            const dx = x + 0.5 - cx;
            const dy = y + 0.5 - cy;
            if (dx * dx + dy * dy <= r2)
            {
                blend(rgba, imgW, x, y, r, g, b, a);
            }
        }
    }
}

function blend(rgba, imgW, x, y, r, g, b, a)
{
    const i = (y * imgW + x) * 4;
    const alpha = a / 255;
    const inv = 1 - alpha;
    rgba[i] = Math.round(r * alpha + rgba[i] * inv);
    rgba[i + 1] = Math.round(g * alpha + rgba[i + 1] * inv);
    rgba[i + 2] = Math.round(b * alpha + rgba[i + 2] * inv);
    rgba[i + 3] = 255;
}
