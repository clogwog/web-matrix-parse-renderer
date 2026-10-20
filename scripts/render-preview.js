import { mkdir, writeFile } from "node:fs/promises";
import { compileSources } from "../src/cpp/compile.js";
import { createSession } from "../src/cpp/interpreter.js";
import { createClock } from "../src/matrix/clock.js";
import { PACMAN_ENTRIES, loadPacmanFiles } from "../src/projects/pacmanclock/load.js";
import { PONG_ENTRIES, loadPongFiles } from "../src/projects/pongclock/load.js";
import { MATRIX_ENTRIES, loadMatrixFiles } from "../src/projects/matrixclock/load.js";
import { TETRIS_ENTRIES, loadTetrisFiles } from "../src/projects/tetrisclock/load.js";
import { PLASMA_ENTRIES, loadPlasmaFiles } from "../src/projects/plasmaclock/load.js";
import { SNAKE_ENTRIES, loadSnakeFiles } from "../src/projects/snakeclock/load.js";
import { MARIO_ENTRIES, loadMarioFiles } from "../src/projects/marioclock/load.js";
import { LIFE_ENTRIES, loadLifeFiles } from "../src/projects/gameoflifegame/load.js";
import { DANCE_ENTRIES, loadDanceFiles } from "../src/projects/dancemonkey/load.js";
import { REXIE_ENTRIES, loadRexieFiles } from "../src/projects/rexie/load.js";
import { encodePng } from "../src/render/encode-png.js";
import { rasterPanel } from "../src/render/raster-panel.js";

const pacmanFiles = await loadPacmanFiles();
const pacmanProgram = compileSources(pacmanFiles, PACMAN_ENTRIES);
const pongFiles = await loadPongFiles();
const pongProgram = compileSources(pongFiles, PONG_ENTRIES);
const matrixFiles = await loadMatrixFiles();
const matrixProgram = compileSources(matrixFiles, MATRIX_ENTRIES);
const tetrisFiles = await loadTetrisFiles();
const tetrisProgram = compileSources(tetrisFiles, TETRIS_ENTRIES);
const plasmaFiles = await loadPlasmaFiles();
const plasmaProgram = compileSources(plasmaFiles, PLASMA_ENTRIES);
const snakeFiles = await loadSnakeFiles();
const snakeProgram = compileSources(snakeFiles, SNAKE_ENTRIES);
const marioFiles = await loadMarioFiles();
const marioProgram = compileSources(marioFiles, MARIO_ENTRIES);
const lifeFiles = await loadLifeFiles();
const lifeProgram = compileSources(lifeFiles, LIFE_ENTRIES);
const danceFiles = await loadDanceFiles();
const danceProgram = compileSources(danceFiles, DANCE_ENTRIES);
const rexieFiles = await loadRexieFiles();
const rexieProgram = compileSources(rexieFiles, REXIE_ENTRIES);

function downscale(src, srcW, srcH, dstW, dstH)
{
    const rgba = Buffer.alloc(dstW * dstH * 4);
    for (let y = 0; y < dstH; y++)
    {
        const sy0 = Math.floor(y * srcH / dstH);
        const sy1 = Math.max(sy0 + 1, Math.floor((y + 1) * srcH / dstH));
        for (let x = 0; x < dstW; x++)
        {
            const sx0 = Math.floor(x * srcW / dstW);
            const sx1 = Math.max(sx0 + 1, Math.floor((x + 1) * srcW / dstW));
            let r = 0;
            let g = 0;
            let b = 0;
            let a = 0;
            let n = 0;
            for (let sy = sy0; sy < sy1; sy++)
            {
                for (let sx = sx0; sx < sx1; sx++)
                {
                    const i = (sy * srcW + sx) * 4;
                    r += src[i];
                    g += src[i + 1];
                    b += src[i + 2];
                    a += src[i + 3];
                    n++;
                }
            }
            const o = (y * dstW + x) * 4;
            rgba[o] = Math.round(r / n);
            rgba[o + 1] = Math.round(g / n);
            rgba[o + 2] = Math.round(b / n);
            rgba[o + 3] = Math.round(a / n);
        }
    }
    return rgba;
}

async function shoot(name, program, date, steps, stepMs, files, thumb)
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
    if (thumb)
    {
        const small = downscale(image.rgba, image.width, image.height, 192, 192);
        const icon = encodePng(192, 192, small);
        await writeFile(new URL("../css/thumbs/" + thumb, import.meta.url), icon);
        console.log(thumb, "192x192");
    }
}

await mkdir(new URL("../docs/preview/", import.meta.url), { recursive: true });
await shoot("pacmanclock-1435.png", pacmanProgram, new Date(2026, 9, 16, 14, 35, 8), 1, 0, pacmanFiles);
await shoot("pacmanclock-1435-chomp.png", pacmanProgram, new Date(2026, 9, 16, 14, 35, 8), 8, 90, pacmanFiles);
await shoot("pongclock-1435.png", pongProgram, new Date(2026, 9, 16, 14, 35, 8), 1, 0, pongFiles);
await shoot("matrixclock-1435.png", matrixProgram, new Date(2026, 9, 16, 14, 35, 8), 215, 0, matrixFiles);
await shoot("tetrisclock-1435.png", tetrisProgram, new Date(2026, 9, 16, 14, 35, 8), 80, 0, tetrisFiles);
await shoot("plasmaclock-1435.png", plasmaProgram, new Date(2026, 9, 16, 14, 35, 8), 1, 0, plasmaFiles);
await shoot("snakeclock-1435.png", snakeProgram, new Date(2026, 9, 16, 14, 35, 8), 16, 0, snakeFiles, "snakeclock.png");
await shoot("marioclock-1435.png", marioProgram, new Date(2026, 9, 16, 14, 35, 8), 138, 0, marioFiles, "marioclock.png");
await shoot("gameoflifegame-1435.png", lifeProgram, new Date(2026, 9, 16, 14, 35, 8), 40, 0, lifeFiles, "gameoflifegame.png");
await shoot("dancemonkey-1435.png", danceProgram, new Date(2026, 9, 16, 14, 35, 8), 16, 0, danceFiles, "dancemonkey.png");
await shoot("rexie-1435.png", rexieProgram, new Date(2026, 9, 16, 14, 35, 8), 20, 0, rexieFiles, "rexie.png");
