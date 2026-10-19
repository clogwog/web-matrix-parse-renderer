import assert from "node:assert/strict";
import test from "node:test";
import { compileSources } from "../src/cpp/compile.js";
import { createSession } from "../src/cpp/interpreter.js";
import { createClock } from "../src/matrix/clock.js";
import { readPixel } from "../src/matrix/virtual-matrix.js";
import { TETRIS_ENTRIES, loadTetrisFiles } from "../src/projects/tetrisclock/load.js";

test("tetrisclock draws the second frame and drops pieces for 14:35", async () =>
{
    const files = await loadTetrisFiles();
    const program = compileSources(files, TETRIS_ENTRIES);
    const when = new Date(2026, 9, 16, 14, 35, 8).getTime();
    const clock = createClock(when);
    const session = createSession(program, {
        clock,
        files,
        argc: 1,
        argv: ["tetrisclock"]
    });

    const first = session.step(clock.now());
    assert.equal(first.done, false);
    assert.equal(first.frame.width, 32);
    assert.equal(first.frame.height, 32);
    assert.equal(first.frame.brightness, 100);
    assert.equal(countGrey(first.frame), 17);
    assert.equal(countPieces(first.frame), 0);

    const second = session.step(clock.now());
    assert.equal(second.done, false);
    assert.equal(countGrey(second.frame), 17);
    assert.ok(countPieces(second.frame) > 0, "first tetrominoes");
    assert.equal(buffersEqual(first.frame.pixels, second.frame.pixels), false);

    let latest = second;
    for (let i = 0; i < 38; i++)
    {
        latest = session.step(clock.now());
        assert.equal(latest.done, false);
    }
    assert.ok(countPieces(latest.frame) > countPieces(second.frame), "later bricks have landed");
});

function countGrey(frame)
{
    let n = 0;
    for (let y = 0; y < frame.height; y++)
    {
        for (let x = 0; x < frame.width; x++)
        {
            const px = readPixel(frame, x, y);
            if (px[0] === 16 && px[1] === 16 && px[2] === 16)
            {
                n++;
            }
        }
    }
    return n;
}

function countPieces(frame)
{
    let n = 0;
    for (let y = 0; y < frame.height; y++)
    {
        for (let x = 0; x < frame.width; x++)
        {
            const px = readPixel(frame, x, y);
            if (px[0] === 16 && px[1] === 16 && px[2] === 16)
            {
                continue;
            }
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
