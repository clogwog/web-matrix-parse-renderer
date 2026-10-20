import assert from "node:assert/strict";
import test from "node:test";
import { compileSources } from "../src/cpp/compile.js";
import { createSession } from "../src/cpp/interpreter.js";
import { createClock } from "../src/matrix/clock.js";
import { readPixel } from "../src/matrix/virtual-matrix.js";
import { MARIO_ENTRIES, loadMarioFiles } from "../src/projects/marioclock/load.js";

const GOLD = [120, 100, 30];
const HAT = [127, 0, 0];

test("marioclock draws 14:35 and walks Mario onto the panel", async () =>
{
    const files = await loadMarioFiles();
    const program = compileSources(files, MARIO_ENTRIES);
    const when = new Date(2026, 9, 16, 14, 35, 8).getTime();
    const clock = createClock(when);
    const session = createSession(program, {
        clock,
        files,
        argc: 1,
        argv: ["marioclock"]
    });

    const first = session.step(clock.now());
    assert.equal(first.done, false);
    assert.equal(first.frame.width, 32);
    assert.equal(first.frame.height, 32);
    assert.equal(first.frame.brightness, 100);
    assert.deepEqual(readPixel(first.frame, 8, 1), GOLD);
    assert.deepEqual(readPixel(first.frame, 7, 1), [0, 0, 0]);
    assert.deepEqual(readPixel(first.frame, 21, 4), [0, 0, 0]);
    assert.equal(countColor(first.frame, HAT[0], HAT[1], HAT[2]), 0);

    let walking = first;
    for (let i = 1; i < 138; i++)
    {
        walking = session.step(clock.now());
        assert.equal(walking.done, false);
    }
    assert.deepEqual(readPixel(walking.frame, 8, 1), GOLD);
    assert.ok(countColor(walking.frame, HAT[0], HAT[1], HAT[2]) > 0, "mario hat");
    assert.equal(buffersEqual(first.frame.pixels, walking.frame.pixels), false);

    clock.set(new Date(2026, 9, 16, 14, 36, 0).getTime());
    let bumped = walking;
    let landed = false;
    for (let i = 0; i < 800; i++)
    {
        bumped = session.step(clock.now());
        assert.equal(bumped.done, false);
        const a = readPixel(bumped.frame, 21, 4);
        const b = readPixel(bumped.frame, 22, 4);
        const c = readPixel(bumped.frame, 23, 4);
        if (same(a, GOLD) && same(b, [0, 0, 0]) && same(c, GOLD))
        {
            landed = true;
            break;
        }
    }
    assert.equal(landed, true, "new minute digit 6 settled");
    assert.deepEqual(readPixel(bumped.frame, 8, 1), GOLD);
});

function same(px, rgb)
{
    return px[0] === rgb[0] && px[1] === rgb[1] && px[2] === rgb[2];
}

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
