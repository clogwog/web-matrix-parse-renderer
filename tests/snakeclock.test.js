import assert from "node:assert/strict";
import test from "node:test";
import { compileSources } from "../src/cpp/compile.js";
import { createSession } from "../src/cpp/interpreter.js";
import { createClock } from "../src/matrix/clock.js";
import { readPixel } from "../src/matrix/virtual-matrix.js";
import { SNAKE_ENTRIES, loadSnakeFiles } from "../src/projects/snakeclock/load.js";

test("snakeclock draws 14:35:08, a green snake, and a red apple", async () =>
{
    const files = await loadSnakeFiles();
    const program = compileSources(files, SNAKE_ENTRIES);
    const when = new Date(2026, 9, 16, 14, 35, 8).getTime();
    const clock = createClock(when);
    const session = createSession(program, {
        clock,
        files,
        argc: 1,
        argv: ["snakeclock"]
    });

    const first = session.step(clock.now());
    assert.equal(first.done, false);
    assert.equal(first.frame.width, 32);
    assert.equal(first.frame.height, 32);
    assert.equal(first.frame.brightness, 100);
    assert.ok(countColor(first.frame, 0, 80, 0) >= 1, "snake body");
    assert.equal(countColor(first.frame, 80, 0, 0), 1, "apple");
    assert.ok(countOther(first.frame) > 15, "time digits");

    let latest = first;
    for (let i = 0; i < 12; i++)
    {
        latest = session.step(clock.now());
        assert.equal(latest.done, false);
    }
    assert.equal(buffersEqual(first.frame.pixels, latest.frame.pixels), false);
    assert.ok(countColor(latest.frame, 0, 80, 0) >= 1, "snake still on the panel");
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

function countOther(frame)
{
    let n = 0;
    for (let y = 0; y < frame.height; y++)
    {
        for (let x = 0; x < frame.width; x++)
        {
            const px = readPixel(frame, x, y);
            if (px[0] === 0 && px[1] === 0 && px[2] === 0)
            {
                continue;
            }
            if (px[0] === 0 && px[1] === 80 && px[2] === 0)
            {
                continue;
            }
            if (px[0] === 80 && px[1] === 0 && px[2] === 0)
            {
                continue;
            }
            n++;
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
