import assert from "node:assert/strict";
import test from "node:test";
import { compileSources } from "../src/cpp/compile.js";
import { createSession } from "../src/cpp/interpreter.js";
import { createClock } from "../src/matrix/clock.js";
import { readPixel } from "../src/matrix/virtual-matrix.js";
import { MATRIX_ENTRIES, loadMatrixFiles } from "../src/projects/matrixclock/load.js";

test("matrixclock sets 14:35 on the 15th frame and keeps the rain moving", async () =>
{
    const files = await loadMatrixFiles();
    const program = compileSources(files, MATRIX_ENTRIES);
    const when = new Date(2026, 9, 16, 14, 35, 8).getTime();
    const clock = createClock(when);
    const session = createSession(program, {
        clock,
        files,
        argc: 1,
        argv: ["matrixclock"]
    });

    let previous = null;
    let changed = false;
    let lit = 0;
    let fullGreen = 0;
    for (let i = 0; i < 14; i++)
    {
        const step = session.step(clock.now());
        assert.equal(step.done, false);
        noteFrame(step.frame);
    }
    assert.equal(digit(session, "g_hour_ten"), 0);
    assert.equal(digit(session, "g_hour_one"), 0);
    assert.equal(digit(session, "g_minute_ten"), 0);
    assert.equal(digit(session, "g_minute_one"), 0);

    const fifteenth = session.step(clock.now());
    assert.equal(fifteenth.done, false);
    assert.equal(fifteenth.frame.width, 32);
    assert.equal(fifteenth.frame.height, 32);
    assert.equal(fifteenth.frame.brightness, 100);
    assert.equal(digit(session, "g_hour_ten"), 1);
    assert.equal(digit(session, "g_hour_one"), 4);
    assert.equal(digit(session, "g_minute_ten"), 3);
    assert.equal(digit(session, "g_minute_one"), 5);
    noteFrame(fifteenth.frame);

    for (let i = 0; i < 70; i++)
    {
        const step = session.step(clock.now());
        assert.equal(step.done, false);
        noteFrame(step.frame);
    }
    assert.equal(changed, true);
    assert.ok(lit > 8, "rain pixels");
    assert.ok(fullGreen > 0, "digit mask lit by a streak");

    function noteFrame(frame)
    {
        if (previous && !buffersEqual(previous, frame.pixels))
        {
            changed = true;
        }
        previous = frame.pixels;
        lit = Math.max(lit, countLit(frame));
        fullGreen = Math.max(fullGreen, countColor(frame, 70, 170, 24));
    }
});

function digit(session, name)
{
    return session.global.get(name).__fields.num;
}

function countLit(frame)
{
    let n = 0;
    for (let y = 0; y < frame.height; y++)
    {
        for (let x = 0; x < frame.width; x++)
        {
            const px = readPixel(frame, x, y);
            if (px[0] || px[1] || px[2])
            {
                n++;
            }
        }
    }
    return n;
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
