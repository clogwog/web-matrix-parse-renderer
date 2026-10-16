import assert from "node:assert/strict";
import test from "node:test";
import { lex } from "../src/cpp/lexer.js";
import { expandMacros, preprocess, stripComments } from "../src/cpp/preprocessor.js";
import { compileSources } from "../src/cpp/compile.js";
import { createSession } from "../src/cpp/interpreter.js";
import { createClock } from "../src/matrix/clock.js";
import { fontFromBoolArrays } from "../src/matrix/font.js";
import { readPixel } from "../src/matrix/virtual-matrix.js";
import { PACMAN_ENTRIES, loadPacmanFiles } from "../src/projects/pacmanclock/load.js";

test("preprocessor expands digit macros and keeps include guards", () =>
{
    const files = new Map([
        ["digit.h", "#ifndef DIGIT_H\n#define DIGIT_H\nclass Digit {};\n#endif\n"],
        ["digit.cc", "#include \"digit.h\"\n#define XX true\n#define __ false\nstatic bool row[] = { XX, __, XX };\n#include \"digit.h\"\n"]
    ]);
    const pre = preprocess("digit.cc", files);
    assert.equal(pre.macros.get("XX").body.trim(), "true");
    assert.equal(pre.macros.get("__").body.trim(), "false");
    assert.equal(pre.source.split("class Digit").length - 1, 1);
    const tokens = expandMacros(lex(pre.source, "digit.cc", pre.lineMap), pre.macros, lex);
    const values = tokens.map(function (token) { return token.value; });
    assert.ok(values.includes("true"));
    assert.ok(values.includes("false"));
    assert.equal(values.includes("XX"), false);
    assert.equal(values.includes("__"), false);
});

test("stripComments keeps newlines and string contents", () =>
{
    const src = "int a; // tail\nconst char* s = \"http://example\";\n/* block\nstill */ int b;\n";
    const out = stripComments(src);
    assert.match(out, /int a;/);
    assert.match(out, /http:\/\/example/);
    assert.match(out, /int b;/);
    assert.equal(out.includes("tail"), false);
    assert.equal(out.includes("block"), false);
});

test("parser reads a small drawing program", () =>
{
    const source = [
        "static const int W = 4;",
        "void paint(int& x)",
        "{",
        "    x = (uint8_t)200;",
        "}",
        "int main()",
        "{",
        "    for (int i = 0; i < W; ++i)",
        "    {",
        "        SetPixel(i, 0, i * 10, 0, 0);",
        "    }",
        "    int a = 7 / 2;",
        "    int r = 1;",
        "    paint(r);",
        "    SetPixel(0, 1, a, r, 0);",
        "    Swap();",
        "}"
    ].join("\n");
    const files = new Map([["main.cc", source]]);
    const program = compileSources(files, ["main.cc"]);
    const calls = [];
    program.functions.set("SetPixel", {
        __host: true,
        __call(_this, args)
        {
            calls.push(args.map(function (value)
            {
                return value && value.__float ? value.v : value;
            }));
            return 0;
        }
    });
    program.functions.set("Swap", {
        __host: true,
        __call(_this, _args, ctx)
        {
            ctx.frameReady = true;
            ctx.pendingFrame = { calls: calls.slice() };
            return 0;
        }
    });
    const session = createSession(program, { clock: createClock(0) });
    const step = session.step(0);
    assert.equal(step.done, false);
    assert.deepEqual(calls[0], [0, 0, 0, 0, 0]);
    assert.deepEqual(calls[3], [3, 0, 30, 0, 0]);
    assert.deepEqual(calls[4], [0, 1, 3, 200, 0]);
});

test("pacmanclock globals expose colours, digits, and sprites", async () =>
{
    const files = await loadPacmanFiles();
    const program = compileSources(files, PACMAN_ENTRIES);
    const session = createSession(program, {
        clock: createClock(new Date(2026, 9, 16, 14, 35, 0).getTime())
    });
    session.step(session.ctx.clock.now());
    assert.equal(session.global.get("PANEL"), 32);
    assert.equal(session.global.get("WALL_R"), 30);
    assert.equal(session.global.get("WALL_G"), 30);
    assert.equal(session.global.get("WALL_B"), 200);
    assert.equal(session.global.get("PAC_R"), 255);
    assert.equal(session.global.get("COLON_X"), 15);
    const zero = session.global.get("zero");
    assert.deepEqual(zero, [
        [true, true, true],
        [true, false, true],
        [true, false, true],
        [true, false, true],
        [true, true, true]
    ]);
    const eight = session.global.get("eight");
    assert.equal(eight[1][1], false);
    assert.equal(eight[2][0], true);
    const mouth = session.ctx.classes.get("Pacman").statics.get("mouth_right");
    assert.deepEqual(mouth[2], [1, 1, 0, 0, 0]);
    const font = fontFromBoolArrays({
        "0": zero,
        "8": eight
    }, 3, 5);
    assert.deepEqual(font.glyph("0")[0], [1, 1, 1]);
    assert.equal(program.functions.has("main"), true);
    assert.equal(session.ctx.classes.get("Digit").isPod, false);
});

test("pacmanclock frame uses the real clock and moves pacman", async () =>
{
    const files = await loadPacmanFiles();
    const program = compileSources(files, PACMAN_ENTRIES);
    const when = new Date(2026, 9, 16, 14, 35, 8).getTime();
    const clock = createClock(when);
    const session = createSession(program, { clock });
    const first = session.step(clock.now());
    assert.equal(first.done, false);
    assert.equal(first.frame.width, 32);
    assert.equal(first.frame.height, 32);
    assert.equal(first.frame.brightness, 50);
    assert.deepEqual(readPixel(first.frame, 15, 2), [255, 255, 255]);
    assert.deepEqual(readPixel(first.frame, 15, 4), [255, 255, 255]);
    assert.deepEqual(readPixel(first.frame, 7, 1), [255, 255, 255]);
    assert.notDeepEqual(readPixel(first.frame, 12, 1), [255, 255, 255]);
    const yellow = countColor(first.frame, 255, 220, 0);
    const blue = countBlueWalls(first.frame);
    const pellets = countColor(first.frame, 200, 160, 60);
    assert.ok(yellow > 10, "expected pacman pixels, got " + yellow);
    assert.ok(blue > 20, "expected wall pixels, got " + blue);
    assert.ok(pellets > 8, "expected pellets, got " + pellets);
    const start = yellowCells(first.frame);
    clock.advance(500);
    let latest = first;
    for (let i = 0; i < 6; i++)
    {
        latest = session.step(clock.now());
        clock.advance(100);
    }
    const moved = yellowCells(latest.frame);
    assert.ok(moved.length > 0);
    assert.notDeepEqual(start, moved);
});

test("default arguments and in-class initializers run before the constructor body", () =>
{
    const source = [
        "class Box",
        "{",
        "public:",
        "    Box(int v) { this->v = v; }",
        "    int v;",
        "    int bright = 180;",
        "    int seen = bright;",
        "    void Nudge(int steps = 2) { v = v + steps; }",
        "};",
        "int main()",
        "{",
        "    Box b(5);",
        "    b.Nudge();",
        "    SetPixel(0, 0, b.v, b.bright, b.seen);",
        "    Swap();",
        "}"
    ].join("\n");
    const files = new Map([["main.cc", source]]);
    const program = compileSources(files, ["main.cc"]);
    const calls = [];
    program.functions.set("SetPixel", {
        __host: true,
        __call(_this, args)
        {
            calls.push(args);
            return 0;
        }
    });
    program.functions.set("Swap", {
        __host: true,
        __call(_this, _args, ctx)
        {
            ctx.frameReady = true;
            ctx.pendingFrame = { calls: calls.slice() };
            return 0;
        }
    });
    const session = createSession(program, { clock: createClock(0) });
    const step = session.step(0);
    assert.equal(step.done, false);
    assert.deepEqual(calls[0], [0, 0, 7, 180, 180]);
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

function countBlueWalls(frame)
{
    let n = 0;
    for (let i = 0; i < frame.pixels.length; i += 3)
    {
        if (frame.pixels[i] === 30 && frame.pixels[i + 1] === 30 && frame.pixels[i + 2] === 200)
        {
            n++;
        }
    }
    return n;
}

function yellowCells(frame)
{
    const cells = [];
    for (let y = 0; y < frame.height; y++)
    {
        for (let x = 0; x < frame.width; x++)
        {
            const px = readPixel(frame, x, y);
            if (px[0] === 255 && px[1] === 220 && px[2] === 0)
            {
                cells.push(x + "," + y);
            }
        }
    }
    return cells;
}
