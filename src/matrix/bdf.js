// Host-side BDF loader matching rgb_matrix::Font in bdf-font.cc:
// FONTBOUNDINGBOX sets height and baseline, glyph rows are left-aligned
// into a 64-bit word, and DrawGlyph treats y as the baseline.

export function parseBdf(text)
{
    const font = {
        height: -1,
        baseline: 0,
        glyphs: new Map()
    };
    const lines = String(text).split(/\r?\n/);
    let codepoint = 0;
    let pending = freshGlyph();
    let glyph = null;
    let row = -1;
    let shift = 0;

    for (const raw of lines)
    {
        const line = raw.trim();
        let match = line.match(/^FONTBOUNDINGBOX\s+(-?\d+)\s+(-?\d+)\s+(-?\d+)\s+(-?\d+)/);
        if (match)
        {
            font.height = parseInt(match[2], 10);
            font.baseline = parseInt(match[4], 10) + font.height;
            continue;
        }
        match = line.match(/^ENCODING\s+(-?\d+)/);
        if (match)
        {
            codepoint = parseInt(match[1], 10);
            continue;
        }
        match = line.match(/^DWIDTH\s+(-?\d+)\s+(-?\d+)/);
        if (match)
        {
            pending.device_width = parseInt(match[1], 10);
            pending.device_height = parseInt(match[2], 10);
            continue;
        }
        match = line.match(/^BBX\s+(-?\d+)\s+(-?\d+)\s+(-?\d+)\s+(-?\d+)/);
        if (match)
        {
            glyph = {
                device_width: pending.device_width,
                device_height: pending.device_height,
                width: parseInt(match[1], 10),
                height: parseInt(match[2], 10),
                x_offset: parseInt(match[3], 10),
                y_offset: parseInt(match[4], 10),
                rows: []
            };
            const bytes = Math.floor((glyph.width + 7) / 8);
            shift = 8 * (8 - bytes) - glyph.x_offset;
            row = -1;
            continue;
        }
        if (line.startsWith("BITMAP"))
        {
            row = 0;
            continue;
        }
        if (glyph && row >= 0 && row < glyph.height && /^[0-9A-Fa-f]+$/.test(line))
        {
            glyph.rows.push(BigInt("0x" + line) << BigInt(shift));
            row++;
            continue;
        }
        if (line.startsWith("ENDCHAR"))
        {
            if (glyph && row === glyph.height)
            {
                font.glyphs.set(codepoint, glyph);
            }
            glyph = null;
            pending = freshGlyph();
            row = -1;
        }
    }
    return font;
}

export function drawBdfText(setPixel, font, x, y, r, g, b, text, extraSpacing)
{
    const glyphs = font && font.glyphs;
    if (!glyphs)
    {
        return 0;
    }
    const start = x | 0;
    let cursor = start;
    const gap = extraSpacing ? extraSpacing | 0 : 0;
    const source = text == null ? "" : String(text);
    for (const ch of source)
    {
        const glyph = glyphs.get(ch.codePointAt(0));
        if (!glyph)
        {
            continue;
        }
        const yPos = (y | 0) - glyph.height - glyph.y_offset;
        for (let row = 0; row < glyph.height; row++)
        {
            let mask = 1n << 63n;
            const bits = glyph.rows[row] || 0n;
            for (let col = 0; col < glyph.device_width; col++)
            {
                if ((bits & mask) !== 0n)
                {
                    setPixel(cursor + col, yPos + row, r, g, b);
                }
                mask >>= 1n;
            }
        }
        cursor += glyph.device_width + gap;
    }
    return cursor - start;
}

function freshGlyph()
{
    return {
        device_width: 0,
        device_height: 0,
        width: 0,
        height: 0,
        x_offset: 0,
        y_offset: 0,
        rows: []
    };
}
