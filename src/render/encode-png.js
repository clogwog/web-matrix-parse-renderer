import { deflateSync } from "node:zlib";

function crc32(buffer)
{
    let crc = ~0;
    for (let i = 0; i < buffer.length; i++)
    {
        crc ^= buffer[i];
        for (let k = 0; k < 8; k++)
        {
            const mask = -(crc & 1);
            crc = (crc >>> 1) ^ (0xedb88320 & mask);
        }
    }
    return (~crc) >>> 0;
}

function chunk(type, data)
{
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length, 0);
    const name = Buffer.from(type, "ascii");
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(Buffer.concat([name, data])), 0);
    return Buffer.concat([length, name, data, crc]);
}

export function encodePng(width, height, rgba)
{
    const raw = Buffer.alloc((width * 4 + 1) * height);
    for (let y = 0; y < height; y++)
    {
        const rowStart = y * (width * 4 + 1);
        raw[rowStart] = 0;
        rgba.copy(raw, rowStart + 1, y * width * 4, (y + 1) * width * 4);
    }
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(width, 0);
    ihdr.writeUInt32BE(height, 4);
    ihdr[8] = 8;
    ihdr[9] = 6;
    const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
    const idat = deflateSync(raw);
    return Buffer.concat([
        signature,
        chunk("IHDR", ihdr),
        chunk("IDAT", idat),
        chunk("IEND", Buffer.alloc(0))
    ]);
}
