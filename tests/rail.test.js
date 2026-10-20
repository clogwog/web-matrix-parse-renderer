import assert from "node:assert/strict";
import test from "node:test";
import { placeProjectTiles } from "../src/projects/rail.js";

test("tiles run down the left, across the bottom, then up the right", () =>
{
    const wide = placeProjectTiles(10, 720, 80, 12);
    assert.equal(wide.hasRight, false);
    assert.equal(wide.hasBottom, true);
    assert.equal(wide.places[0].edge, "left");
    assert.equal(wide.places[0].x, 0);
    assert.equal(wide.places[0].y, 0);
    assertContinuous(wide.places, 80);
    const left = wide.places.filter(function (place)
    {
        return place.edge === "left";
    });
    assert.equal(left[left.length - 1].y + 80, 720);
    const bottom = wide.places.filter(function (place)
    {
        return place.edge === "bottom";
    });
    assert.ok(bottom.length >= 1);
    assert.equal(bottom[0].x, 92);
    assert.equal(bottom[0].y, 732);

    const around = placeProjectTiles(10, 280, 80, 12);
    assert.equal(around.hasRight, true);
    assertContinuous(around.places, 80);
    const right = around.places.filter(function (place)
    {
        return place.edge === "right";
    });
    assert.ok(right.length >= 2);
    assert.ok(right[0].y > right[1].y);
    assert.equal(right[0].x, 12 + 80 + 280 + 12);
    assert.ok(around.places.every(function (place)
    {
        return place.y >= 0;
    }));
});

test("a short list stays packed at the top left", () =>
{
    const packed = placeProjectTiles(3, 720, 80, 12);
    assert.equal(packed.hasBottom, false);
    assert.equal(packed.hasRight, false);
    assert.deepEqual(packed.places.map(function (place)
    {
        return place.y;
    }), [0, 92, 184]);
});

function assertContinuous(places, tile)
{
    let phase = "left";
    let previous = null;
    for (const place of places)
    {
        if (place.edge !== phase)
        {
            if (phase === "left")
            {
                assert.equal(place.edge, "bottom");
            }
            else if (phase === "bottom")
            {
                assert.equal(place.edge, "right");
            }
            else
            {
                assert.fail("path left the right edge");
            }
            phase = place.edge;
            previous = null;
        }
        if (previous)
        {
            const overlap = previous.x < place.x + tile
                && place.x < previous.x + tile
                && previous.y < place.y + tile
                && place.y < previous.y + tile;
            assert.equal(overlap, false);
            if (place.edge === "left")
            {
                assert.ok(place.y > previous.y);
            }
            if (place.edge === "bottom")
            {
                assert.ok(place.x > previous.x);
            }
            if (place.edge === "right")
            {
                assert.ok(place.y < previous.y);
            }
        }
        previous = place;
    }
}
