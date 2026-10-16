import assert from "node:assert/strict";
import test from "node:test";
import { findProject, listProjects, registerProject } from "../src/projects/registry.js";

test("registry exposes pacmanclock and accepts another project", () =>
{
    const before = listProjects();
    assert.equal(before.length, 1);
    assert.equal(before[0].id, "pacmanclock");
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
    assert.equal(listProjects().length, 2);
});
