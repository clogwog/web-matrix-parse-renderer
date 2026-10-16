export class VirtualMatrix
{
    constructor(width, height)
    {
        this.width = width;
        this.height = height;
        this.pixels = new Uint8ClampedArray(width * height * 3);
        this.brightness = 100;
    }

    clear()
    {
        this.pixels.fill(0);
    }

    fill(r, g, b)
    {
        for (let y = 0; y < this.height; y++)
        {
            for (let x = 0; x < this.width; x++)
            {
                this.setPixel(x, y, r, g, b);
            }
        }
    }

    setPixel(x, y, r, g, b)
    {
        const px = x | 0;
        const py = y | 0;
        if (px < 0 || py < 0 || px >= this.width || py >= this.height)
        {
            return;
        }
        const i = (py * this.width + px) * 3;
        this.pixels[i] = clamp8(r);
        this.pixels[i + 1] = clamp8(g);
        this.pixels[i + 2] = clamp8(b);
    }

    getPixel(x, y)
    {
        const i = (y * this.width + x) * 3;
        return [this.pixels[i], this.pixels[i + 1], this.pixels[i + 2]];
    }

    snapshot()
    {
        return {
            width: this.width,
            height: this.height,
            brightness: this.brightness,
            pixels: new Uint8ClampedArray(this.pixels)
        };
    }
}

export function clamp8(value)
{
    const n = Number(value);
    if (Number.isNaN(n))
    {
        return 0;
    }
    if (n < 0)
    {
        return 0;
    }
    if (n > 255)
    {
        return 255;
    }
    return n | 0;
}

export function pixelIndex(width, x, y)
{
    return (y * width + x) * 3;
}

export function readPixel(frame, x, y)
{
    const i = pixelIndex(frame.width, x, y);
    return [frame.pixels[i], frame.pixels[i + 1], frame.pixels[i + 2]];
}
