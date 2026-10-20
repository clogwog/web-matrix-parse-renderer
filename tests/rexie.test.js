import assert from "node:assert/strict";
import test from "node:test";
import { compileSources } from "../src/cpp/compile.js";
import { createSession } from "../src/cpp/interpreter.js";
import { createClock } from "../src/matrix/clock.js";
import { readPixel } from "../src/matrix/virtual-matrix.js";
import { REXIE_ENTRIES, loadRexieFiles } from "../src/projects/rexie/load.js";

const TEXT = [20, 20, 20];
const BODY = [34, 34, 34];

test("rexie draws 14:35 over the dinosaur and then finishes", async () =>
{
    const files = await loadRexieFiles();
    const program = compileSources(files, REXIE_ENTRIES);
    const when = new Date(2026, 9, 16, 14, 35, 8).getTime();
    const clock = createClock(when);
    const session = createSession(program, {
        clock,
        files,
        argc: 1,
        argv: ["rexie"]
    });

    const first = session.step(clock.now());
    assert.equal(first.done, false);
    assert.equal(first.frame.width, 32);
    assert.equal(first.frame.height, 32);
    assert.equal(first.frame.brightness, 100);
    const icons = session.global.get("animation_icons");
    assert.equal(icons.length, 80);
    assert.equal(icons[0].length, 3072);
    assert.deepEqual(readPixel(first.frame, 4, 2), TEXT);
    assert.deepEqual(readPixel(first.frame, 10, 20), BODY);
    assert.equal(countColor(first.frame, TEXT[0], TEXT[1], TEXT[2]), 46);

    const second = session.step(clock.now());
    assert.equal(second.done, false);
    assert.equal(buffersEqual(first.frame.pixels, second.frame.pixels), false);
    assert.deepEqual(readPixel(second.frame, 4, 2), TEXT);

    let latest = second;
    for (let i = 2; i < 160; i++)
    {
        latest = session.step(clock.now());
        assert.equal(latest.done, false);
    }
    const finished = session.step(clock.now());
    assert.equal(finished.done, true);
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
