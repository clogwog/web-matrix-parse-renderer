import assert from "node:assert/strict";
import test from "node:test";
import { compileSources } from "../src/cpp/compile.js";
import { createSession } from "../src/cpp/interpreter.js";
import { createClock } from "../src/matrix/clock.js";
import { readPixel } from "../src/matrix/virtual-matrix.js";
import { LIFE_ENTRIES, loadLifeFiles } from "../src/projects/gameoflifegame/load.js";

const BORN = [127, 51, 0];

test("gameoflifegame paints a random field orange and then ages it", async () =>
{
    const files = await loadLifeFiles();
    const program = compileSources(files, LIFE_ENTRIES);
    const when = new Date(2026, 9, 16, 14, 35, 8).getTime();
    const clock = createClock(when);
    const session = createSession(program, {
        clock,
        files,
        argc: 1,
        argv: ["gameoflife"]
    });

    const first = session.step(clock.now());
    assert.equal(first.done, false);
    assert.equal(first.frame.width, 32);
    assert.equal(first.frame.height, 32);
    assert.equal(first.frame.brightness, 100);
    assert.equal(countColor(first.frame, BORN[0], BORN[1], BORN[2]), 531);
    assert.equal(countColor(first.frame, 0, 0, 0), 493);
    assert.equal(session.global.get("cout").text, "speed 95\n");

    const second = session.step(clock.now());
    assert.equal(second.done, false);
    assert.equal(buffersEqual(first.frame.pixels, second.frame.pixels), false);
    assert.equal(countColor(second.frame, BORN[0], BORN[1], BORN[2]) > 0, true);

    const third = session.step(clock.now());
    assert.equal(third.done, false);
    assert.ok(countColor(third.frame, 126, 51, 1) > 0, "age 2 leaves orange");
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
