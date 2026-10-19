import assert from "node:assert/strict";
import test from "node:test";
import { locationWithProject, projectIdFromQuery, resolveProjectId } from "../src/projects/url.js";

const IDS = ["pacmanclock", "pongclock", "matrixclock", "tetrisclock", "plasmaclock"];

test("project query accepts the clock ids and ignores anything else", () =>
{
    assert.equal(projectIdFromQuery("", IDS), null);
    assert.equal(projectIdFromQuery("?", IDS), null);
    assert.equal(projectIdFromQuery("?project=", IDS), null);
    assert.equal(projectIdFromQuery("?project=   ", IDS), null);
    assert.equal(projectIdFromQuery("?project=nope", IDS), null);
    assert.equal(projectIdFromQuery("?project=Pongclock", IDS), null);
    assert.equal(projectIdFromQuery("?project=pacmanclock", IDS), "pacmanclock");
    assert.equal(projectIdFromQuery("?project=pongclock", IDS), "pongclock");
    assert.equal(projectIdFromQuery("?project=matrixclock", IDS), "matrixclock");
    assert.equal(projectIdFromQuery("?project=tetrisclock", IDS), "tetrisclock");
    assert.equal(resolveProjectId("?project=tetrisclock", IDS), "tetrisclock");
    assert.equal(projectIdFromQuery("?project=plasmaclock", IDS), "plasmaclock");
    assert.equal(resolveProjectId("?project=plasmaclock", IDS), "plasmaclock");
    assert.equal(projectIdFromQuery("?v=20261018&project=pongclock", IDS), "pongclock");
    assert.equal(resolveProjectId("", IDS), "pacmanclock");
    assert.equal(resolveProjectId("?project=missing", IDS), "pacmanclock");
    assert.equal(resolveProjectId("?project=matrixclock", IDS), "matrixclock");
    assert.equal(resolveProjectId("?project=extra", []), null);
});

test("project query keeps the subpath and the other parameters", () =>
{
    const bare = locationWithProject({
        pathname: "/projects/panel-player/",
        search: "",
        hash: ""
    }, "pacmanclock");
    assert.equal(bare, "/projects/panel-player/?project=pacmanclock");

    const kept = locationWithProject({
        pathname: "/projects/panel-player/index.html",
        search: "?v=20261018",
        hash: "#panel"
    }, "matrixclock");
    assert.equal(kept, "/projects/panel-player/index.html?v=20261018&project=matrixclock#panel");

    const replaced = locationWithProject({
        pathname: "/projects/panel-player/",
        search: "?project=pacmanclock&v=1",
        hash: ""
    }, "pongclock");
    assert.equal(replaced, "/projects/panel-player/?project=pongclock&v=1");
});
