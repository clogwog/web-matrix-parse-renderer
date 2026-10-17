import { mkdir, writeFile } from "node:fs/promises";
import { compileSources } from "../src/cpp/compile.js";
import { createSession } from "../src/cpp/interpreter.js";
import { createClock } from "../src/matrix/clock.js";
import { PACMAN_ENTRIES, loadPacmanFiles } from "../src/projects/pacmanclock/load.js";
import { PONG_ENTRIES, loadPongFiles } from "../src/projects/pongclock/load.js";
import { MATRIX_ENTRIES, loadMatrixFiles } from "../src/projects/matrixclock/load.js";
import { encodePng } from "../src/render/encode-png.js";
import { rasterPanel } from "../src/render/raster-panel.js";

const pacmanFiles = await loadPacmanFiles();
const pacmanProgram = compileSources(pacmanFiles, PACMAN_ENTRIES);
const pongFiles = await loadPongFiles();
const pongProgram = compileSources(pongFiles, PONG_ENTRIES);
const matrixFiles = await loadMatrixFiles();
const matrixProgram = compileSources(matrixFiles, MATRIX_ENTRIES);

async function shoot(name, program, date, steps, stepMs, files)
{
    const clock = createClock(date.getTime());
    const session = createSession(program, { clock, files });
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
await shoot("pacmanclock-1435.png", pacmanProgram, new Date(2026, 9, 16, 14, 35, 8), 1, 0, pacmanFiles);
await shoot("pacmanclock-1435-chomp.png", pacmanProgram, new Date(2026, 9, 16, 14, 35, 8), 8, 90, pacmanFiles);
await shoot("pongclock-1435.png", pongProgram, new Date(2026, 9, 16, 14, 35, 8), 1, 0, pongFiles);
await shoot("matrixclock-1435.png", matrixProgram, new Date(2026, 9, 16, 14, 35, 8), 215, 0, matrixFiles);
