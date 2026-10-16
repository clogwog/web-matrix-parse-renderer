import { mkdir, writeFile } from "node:fs/promises";
import { compileSources } from "../src/cpp/compile.js";
import { createSession } from "../src/cpp/interpreter.js";
import { createClock } from "../src/matrix/clock.js";
import { PACMAN_ENTRIES, loadPacmanFiles } from "../src/projects/pacmanclock/load.js";
import { encodePng } from "../src/render/encode-png.js";
import { rasterPanel } from "../src/render/raster-panel.js";

const files = await loadPacmanFiles();
const program = compileSources(files, PACMAN_ENTRIES);

async function shoot(name, date, steps, stepMs)
{
    const clock = createClock(date.getTime());
    const session = createSession(program, { clock });
    let frame = null;
    for (let i = 0; i < steps; i++)
    {
        frame = session.step(clock.now()).frame;
        clock.advance(stepMs);
    }
    const image = rasterPanel(frame);
    const png = encodePng(image.width, image.height, image.rgba);
    await writeFile(new URL("../docs/preview/" + name, import.meta.url), png);
    console.log(name, image.width + "x" + image.height);
}

await mkdir(new URL("../docs/preview/", import.meta.url), { recursive: true });
await shoot("pacmanclock-1435.png", new Date(2026, 9, 16, 14, 35, 8), 1, 0);
await shoot("pacmanclock-1435-chomp.png", new Date(2026, 9, 16, 14, 35, 8), 8, 90);
