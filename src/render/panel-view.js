import { DEFAULT_DISPLAY_BRIGHTNESS, encodeLedColor } from "./display.js?v=20261025";

export class PanelView
{
    constructor(canvas)
    {
        this.canvas = canvas;
        this.ctx = canvas.getContext("2d", { alpha: false });
        this.frame = null;
        this.cell = 16;
        this.gap = 5;
        this.pad = 22;
        this.boost = DEFAULT_DISPLAY_BRIGHTNESS;
    }

    setFrame(frame)
    {
        this.frame = frame;
        this.draw();
    }

    setBoost(amount)
    {
        this.boost = amount;
        this.draw();
    }

    resize()
    {
        this.draw();
    }

    layout(width, height)
    {
        const cols = width;
        const rows = height;
        const innerW = this.cell * cols + this.gap * (cols - 1);
        const innerH = this.cell * rows + this.gap * (rows - 1);
        return {
            width: innerW + this.pad * 2,
            height: innerH + this.pad * 2,
            innerW,
            innerH
        };
    }

    draw()
    {
        const frame = this.frame;
        const ctx = this.ctx;
        if (!frame)
        {
            return;
        }
        const box = this.layout(frame.width, frame.height);
        const dpr = window.devicePixelRatio || 1;
        const pxW = Math.round(box.width * dpr);
        const pxH = Math.round(box.height * dpr);
        if (this.canvas.width !== pxW || this.canvas.height !== pxH)
        {
            this.canvas.width = pxW;
            this.canvas.height = pxH;
        }
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.fillStyle = "#07080c";
        ctx.fillRect(0, 0, box.width, box.height);
        roundRect(ctx, 8, 8, box.width - 16, box.height - 16, 18);
        ctx.fillStyle = "#101218";
        ctx.fill();
        ctx.strokeStyle = "#2a2e3a";
        ctx.lineWidth = 2;
        ctx.stroke();

        const originX = this.pad;
        const originY = this.pad;
        const pitch = this.cell + this.gap;
        const radius = this.cell * 0.46;

        for (let y = 0; y < frame.height; y++)
        {
            for (let x = 0; x < frame.width; x++)
            {
                const i = (y * frame.width + x) * 3;
                const led = encodeLedColor(frame.pixels[i], frame.pixels[i + 1], frame.pixels[i + 2], this.boost);
                const r = led[0];
                const g = led[1];
                const b = led[2];
                const cx = originX + x * pitch + this.cell / 2;
                const cy = originY + y * pitch + this.cell / 2;
                if (r === 0 && g === 0 && b === 0)
                {
                    ctx.beginPath();
                    ctx.fillStyle = "#000000";
                    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
                    ctx.fill();
                    continue;
                }
                ctx.beginPath();
                ctx.fillStyle = "rgba(" + r + "," + g + "," + b + ",0.28)";
                ctx.arc(cx, cy, radius * 1.35, 0, Math.PI * 2);
                ctx.fill();
                ctx.beginPath();
                ctx.fillStyle = "rgb(" + r + "," + g + "," + b + ")";
                ctx.arc(cx, cy, radius, 0, Math.PI * 2);
                ctx.fill();
                ctx.beginPath();
                ctx.fillStyle = "rgba(255,255,255,0.38)";
                ctx.arc(cx - radius * 0.22, cy - radius * 0.24, radius * 0.22, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    }
}

function roundRect(ctx, x, y, w, h, radius)
{
    const r = Math.min(radius, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
}
