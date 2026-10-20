import assert from "node:assert/strict";
import test from "node:test";
import { brightnessFromQuery, DEFAULT_DISPLAY_BRIGHTNESS, DISPLAY_BRIGHTNESS_MAX, encodeLedChannel, locationWithBrightness, parseBrightness } from "../src/render/display.js";

test("the screen curve lifts dim LED values and leaves black and full alone", () =>
{
    assert.equal(DEFAULT_DISPLAY_BRIGHTNESS, 140);
    assert.equal(DISPLAY_BRIGHTNESS_MAX, 160);
    assert.equal(encodeLedChannel(0, 140), 0);
    assert.equal(encodeLedChannel(255, 140), 255);
    assert.equal(encodeLedChannel(51, 0), 51);
    assert.equal(encodeLedChannel(51, 100), 124);
    assert.equal(encodeLedChannel(10, 100), 56);
    assert.equal(encodeLedChannel(10, 140), 84);
    assert.equal(encodeLedChannel(16, 140), 99);
    assert.equal(encodeLedChannel(51, 140), 147);
    assert.equal(encodeLedChannel(100, 140), 185);
    assert.equal(encodeLedChannel(127, 140), 201);
    assert.equal(encodeLedChannel(170, 140), 222);
    assert.equal(encodeLedChannel(220, 140), 242);
    assert.equal(encodeLedChannel(220, 160), 244);
    assert.equal(encodeLedChannel(51, 50), 87);
});

test("screen boost stays monotonic from off through full", () =>
{
    for (const amount of [0, 100, DEFAULT_DISPLAY_BRIGHTNESS, DISPLAY_BRIGHTNESS_MAX])
    {
        let previous = 0;
        for (let value = 0; value <= 255; value++)
        {
            const next = encodeLedChannel(value, amount);
            assert.ok(next >= previous, amount + " dipped at " + value);
            previous = next;
        }
        assert.equal(encodeLedChannel(0, amount), 0);
        assert.equal(encodeLedChannel(255, amount), 255);
        assert.ok(encodeLedChannel(1, amount) >= 1);
    }
});

test("brightness query is optional and stays in range", () =>
{
    assert.equal(brightnessFromQuery(""), null);
    assert.equal(brightnessFromQuery("?project=tetrisclock"), null);
    assert.equal(brightnessFromQuery("?brightness="), null);
    assert.equal(brightnessFromQuery("?brightness=nope"), null);
    assert.equal(brightnessFromQuery("?brightness=-1"), null);
    assert.equal(brightnessFromQuery("?brightness=161"), null);
    assert.equal(brightnessFromQuery("?brightness=50.5"), null);
    assert.equal(brightnessFromQuery("?project=pongclock&brightness=0"), 0);
    assert.equal(brightnessFromQuery("?brightness=140"), 140);
    assert.equal(brightnessFromQuery("?brightness=160"), 160);
    assert.equal(parseBrightness(" 40 "), 40);
    assert.equal(parseBrightness(null), null);

    const next = locationWithBrightness({
        pathname: "/projects/panel-player/",
        search: "?project=plasmaclock",
        hash: ""
    }, 80);
    assert.equal(next, "/projects/panel-player/?project=plasmaclock&brightness=80");
});
