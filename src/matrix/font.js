export class BitmapFont
{
    constructor(glyphs, width, height)
    {
        this.glyphs = glyphs;
        this.width = width;
        this.height = height;
    }

    glyph(ch)
    {
        const key = String(ch);
        const rows = this.glyphs[key];
        if (!rows)
        {
            return null;
        }
        return rows;
    }

    draw(matrix, ch, x, y, r, g, b)
    {
        const rows = this.glyph(ch);
        if (!rows)
        {
            return 0;
        }
        for (let row = 0; row < rows.length; row++)
        {
            const bits = rows[row];
            for (let col = 0; col < bits.length; col++)
            {
                if (bits[col])
                {
                    matrix.setPixel(x + col, y + row, r, g, b);
                }
            }
        }
        return rows[0] ? rows[0].length : 0;
    }
}

export function fontFromBoolArrays(arrays, width, height)
{
    const glyphs = {};
    for (const name of Object.keys(arrays))
    {
        const src = arrays[name];
        const rows = [];
        for (let y = 0; y < src.length; y++)
        {
            const row = [];
            for (let x = 0; x < src[y].length; x++)
            {
                row.push(src[y][x] ? 1 : 0);
            }
            rows.push(row);
        }
        glyphs[name] = rows;
    }
    return new BitmapFont(glyphs, width, height);
}
