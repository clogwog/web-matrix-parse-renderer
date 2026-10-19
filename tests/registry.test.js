import assert from "node:assert/strict";
import test from "node:test";
import { findProject, listProjects, registerProject } from "../src/projects/registry.js";

test("registry lists the four clocks and accepts another project", () =>
{
    const before = listProjects();
    assert.equal(before.length, 4);
    assert.equal(before[0].id, "pacmanclock");
    assert.equal(before[1].id, "pongclock");
    assert.equal(before[2].id, "matrixclock");
    assert.equal(before[3].id, "tetrisclock");
    assert.equal(before[0].repo, "https://github.com/clogwog/pacmanclock");
    assert.equal(before[1].repo, "https://github.com/clogwog/pongclock");
    assert.equal(before[2].repo, "https://github.com/clogwog/matrixclock");
    assert.equal(before[3].repo, "https://github.com/clogwog/tetrisclock");
    assert.equal(before[0].thumb, "css/thumbs/pacmanclock.png");
    assert.equal(before[3].thumb, "css/thumbs/tetrisclock.png");
    assert.equal(findProject("missing").id, "pacmanclock");

    const extra = {
        id: "extra",
        title: "Extra",
        description: "Registered from a test.",
        async start()
        {
            return { stop() {} };
        }
    };
    registerProject(extra);
    assert.equal(findProject("extra").title, "Extra");
    registerProject({
        id: "extra",
        title: "Extra again",
        description: "Replaced.",
        async start()
        {
            return { stop() {} };
        }
    });
    assert.equal(findProject("extra").title, "Extra again");
    assert.equal(listProjects().length, 5);
    assert.equal(listProjects()[0].id, "pacmanclock");
    assert.equal(listProjects()[1].id, "pongclock");
    assert.equal(listProjects()[2].id, "matrixclock");
    assert.equal(listProjects()[3].id, "tetrisclock");
});
