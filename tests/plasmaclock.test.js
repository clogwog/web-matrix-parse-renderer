import assert from "node:assert/strict";
import test from "node:test";
import { compileSources } from "../src/cpp/compile.js";
import { createSession } from "../src/cpp/interpreter.js";
import { createClock } from "../src/matrix/clock.js";
import { drawBdfText, parseBdf } from "../src/matrix/bdf.js";
import { readPixel } from "../src/matrix/virtual-matrix.js";
import { PLASMA_ENTRIES, loadPlasmaFiles } from "../src/projects/plasmaclock/load.js";

test("plasmaclock cuts 14:35 out of a moving plasma field", async () =>
{
    const files = await loadPlasmaFiles();
    const program = compileSources(files, PLASMA_ENTRIES);
    const when = new Date(2026, 9, 16, 14, 35, 8).getTime();
    const clock = createClock(when);
    const session = createSession(program, {
        clock,
        files,
        argc: 1,
        argv: ["plasmaclock"]
    });

    const first = session.step(clock.now());
    assert.equal(first.done, false);
    assert.equal(first.frame.width, 32);
    assert.equal(first.frame.height, 32);
    assert.equal(first.frame.brightness, 100);

    const font = parseBdf(files.get("10x20.bdf"));
    const ink = [];
    drawBdfText(function (x, y)
    {
        ink.push([x, y]);
    }, font, 0, 14, 0, 0, 0, "14");
    drawBdfText(function (x, y)
    {
        ink.push([x, y]);
    }, font, 12, 30, 0, 0, 0, "35");
    let onPanel = 0;
    for (const point of ink)
    {
        const x = point[0];
        const y = point[1];
        if (x < 0 || y < 0 || x >= 32 || y >= 32)
        {
            continue;
        }
        onPanel++;
        const px = readPixel(first.frame, x, y);
        assert.deepEqual(px, [0, 0, 0]);
    }
    assert.ok(onPanel > 100, "digit ink");
    assert.equal(countBlack(first.frame), onPanel);
    assert.ok(countPlasma(first.frame) > 700, "plasma field");

    const second = session.step(clock.now());
    assert.equal(second.done, false);
    assert.equal(buffersEqual(first.frame.pixels, second.frame.pixels), false);
});

function countBlack(frame)
{
    let n = 0;
    for (let y = 0; y < frame.height; y++)
    {
        for (let x = 0; x < frame.width; x++)
        {
            const px = readPixel(frame, x, y);
            if (px[0] === 0 && px[1] === 0 && px[2] === 0)
            {
                n++;
            }
        }
    }
    return n;
}

function countPlasma(frame)
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
