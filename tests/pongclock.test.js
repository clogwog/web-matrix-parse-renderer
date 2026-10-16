import assert from "node:assert/strict";
import test from "node:test";
import { compileSources } from "../src/cpp/compile.js";
import { createSession } from "../src/cpp/interpreter.js";
import { createClock } from "../src/matrix/clock.js";
import { readPixel } from "../src/matrix/virtual-matrix.js";
import { PONG_ENTRIES, loadPongFiles } from "../src/projects/pongclock/load.js";

test("pongclock draws 14:35, the centre line, and a moving ball", async () =>
{
    const files = await loadPongFiles();
    const program = compileSources(files, PONG_ENTRIES);
    const when = new Date(2026, 9, 16, 14, 35, 8).getTime();
    const clock = createClock(when);
    const session = createSession(program, { clock, files });
    const first = session.step(clock.now());
    assert.equal(first.done, false);
    assert.equal(first.frame.width, 32);
    assert.equal(first.frame.height, 32);
    assert.equal(first.frame.brightness, 100);
    assert.deepEqual(readPixel(first.frame, 8, 0), [100, 100, 100]);
    assert.deepEqual(readPixel(first.frame, 10, 0), [100, 100, 100]);
    assert.deepEqual(readPixel(first.frame, 13, 0), [100, 100, 100]);
    assert.deepEqual(readPixel(first.frame, 17, 0), [100, 100, 100]);
    assert.deepEqual(readPixel(first.frame, 22, 0), [100, 100, 100]);
    assert.ok(countColor(first.frame, 10, 10, 10) >= 12, "centre dashes");
    assert.ok(rowEnergy(first.frame, 31) > 0, "second hand");
    assert.ok(countBright(first.frame, 0) + countBright(first.frame, 1) + countBright(first.frame, 30) + countBright(first.frame, 31) > 4, "paddles");

    const second = session.step(clock.now());
    assert.equal(buffersEqual(first.frame.pixels, second.frame.pixels), false);
});

function countColor(frame, r, g, b)
{
    let n = 0;
    for (let y = 0; y < frame.height; y++)
    {
        for (let x = 0; x < frame.width; x++)
        {
            const px = readPixel(frame, x, y);
            if (px[0] === r && px[1] === g && px[2] === b)
            {
                n++;
            }
        }
    }
    return n;
}

function countBright(frame, x)
{
    let n = 0;
    for (let y = 0; y < frame.height; y++)
    {
        const px = readPixel(frame, x, y);
        if (px[0] >= 100 && px[0] === px[1] && px[1] === px[2])
        {
            n++;
        }
    }
    return n;
}

function rowEnergy(frame, y)
{
    let n = 0;
    for (let x = 0; x < frame.width; x++)
    {
        const px = readPixel(frame, x, y);
        n += px[0] + px[1] + px[2];
    }
    return n;
}

function buffersEqual(a, b)
{
    if (a.length !== b.length)
    {
        return false;
    }
    for (let i = 0; i < a.length; i++)
    {
        if (a[i] !== b[i])
        {
            return false;
        }
    }
    return true;
}
