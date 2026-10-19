import assert from "node:assert/strict";
import test from "node:test";
import { brightnessFromQuery, DEFAULT_DISPLAY_BRIGHTNESS, encodeLedChannel, locationWithBrightness, parseBrightness } from "../src/render/display.js";

test("the screen curve lifts dim LED values and leaves black and full alone", () =>
{
    assert.equal(DEFAULT_DISPLAY_BRIGHTNESS, 100);
    assert.equal(encodeLedChannel(0, 100), 0);
    assert.equal(encodeLedChannel(255, 100), 255);
    assert.equal(encodeLedChannel(51, 0), 51);
    assert.equal(encodeLedChannel(51, 100), 124);
    assert.equal(encodeLedChannel(16, 100), 71);
    assert.equal(encodeLedChannel(100, 100), 168);
    assert.equal(encodeLedChannel(127, 100), 187);
    assert.equal(encodeLedChannel(170, 100), 213);
    assert.equal(encodeLedChannel(220, 100), 239);
    assert.equal(encodeLedChannel(51, 50), 87);
});

test("brightness query is optional and stays in range", () =>
{
    assert.equal(brightnessFromQuery(""), null);
    assert.equal(brightnessFromQuery("?project=tetrisclock"), null);
    assert.equal(brightnessFromQuery("?brightness="), null);
    assert.equal(brightnessFromQuery("?brightness=nope"), null);
    assert.equal(brightnessFromQuery("?brightness=-1"), null);
    assert.equal(brightnessFromQuery("?brightness=101"), null);
    assert.equal(brightnessFromQuery("?brightness=50.5"), null);
    assert.equal(brightnessFromQuery("?project=pongclock&brightness=0"), 0);
    assert.equal(brightnessFromQuery("?brightness=100"), 100);
    assert.equal(parseBrightness(" 40 "), 40);
    assert.equal(parseBrightness(null), null);

    const next = locationWithBrightness({
        pathname: "/projects/panel-player/",
        search: "?project=plasmaclock",
        hash: ""
    }, 80);
    assert.equal(next, "/projects/panel-player/?project=plasmaclock&brightness=80");
});
