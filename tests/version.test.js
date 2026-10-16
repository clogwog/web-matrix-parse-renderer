import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { BUILD_VERSION, withAssetVersion } from "../src/version.js";

const root = fileURLToPath(new URL("..", import.meta.url)).replace(/\/$/, "");
const token = "?v=" + BUILD_VERSION;

test("asset version is on the css link, the entry module, and every relative import", async () =>
{
    const html = await readFile(join(root, "index.html"), "utf8");
    assert.equal(html.includes("href=\"css/app.css" + token + "\""), true);
    assert.equal(html.includes("src=\"src/main.js" + token + "\""), true);

    const files = [];
    await walkJs(join(root, "src"), files);
    const misses = [];
    for (const path of files)
    {
        const source = await readFile(path, "utf8");
        const pattern = /(?:from|import)\s*\(?\s*(['"])([^'"]+)\1/g;
        let found = pattern.exec(source);
        while (found)
        {
            const spec = found[2];
            if (spec.startsWith(".") && !spec.includes(token))
            {
                misses.push(path.slice(root.length + 1) + " -> " + spec);
            }
            if (!spec.startsWith(".") && spec.includes("?v="))
            {
                misses.push(path.slice(root.length + 1) + " versioned a non-relative import " + spec);
            }
            found = pattern.exec(source);
        }
    }
    assert.deepEqual(misses, [], "run node scripts/stamp-version.js after bumping BUILD_VERSION");
});

test("fetched project files keep a relative path and the build query", () =>
{
    const base = "https://clogwog.net/projects/panel-player/src/projects/pongclock/load.js" + token;
    const raw = new URL("sources/pongclock.cc", base);
    const busted = withAssetVersion(raw);
    assert.equal(busted.pathname, "/projects/panel-player/src/projects/pongclock/sources/pongclock.cc");
    assert.equal(busted.searchParams.get("v"), BUILD_VERSION);
    assert.equal(busted.searchParams.getAll("v").length, 1);
});

async function walkJs(dir, out)
{
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries)
    {
        const path = join(dir, entry.name);
        if (entry.isDirectory())
        {
            await walkJs(path, out);
        }
        else if (entry.name.endsWith(".js"))
        {
            out.push(path);
        }
    }
}
