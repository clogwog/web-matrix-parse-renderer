import { withAssetVersion } from "../../version.js?v=20261026";

const FILES = [
    "sources/gameoflife.cc",
    "sources/pongnumberfont.bdf",
    "sources/led-matrix.h",
    "sources/graphics.h",
    "stubs/unistd.h",
    "stubs/math.h",
    "stubs/stdio.h",
    "stubs/functional",
    "stubs/cstdlib",
    "stubs/iostream",
    "stubs/cstring",
    "stubs/ctime",
    "stubs/signal.h",
    "stubs/syslog.h",
    "stubs/sys/time.h",
    "stubs/random"
];

function mapKey(relative)
{
    if (relative.startsWith("sources/"))
    {
        return relative.slice("sources/".length);
    }
    return relative;
}

export async function loadLifeFiles()
{
    const map = new Map();
    for (const relative of FILES)
    {
        const text = await readProjectFile(relative);
        map.set(mapKey(relative), text);
    }
    return map;
}

async function readProjectFile(relative)
{
    const url = new URL(relative, import.meta.url);
    if (typeof process !== "undefined" && process.versions && process.versions.node)
    {
        const { readFile } = await import("node:fs/promises");
        const { fileURLToPath } = await import("node:url");
        return readFile(fileURLToPath(url), "utf8");
    }
    const response = await fetch(withAssetVersion(url));
    if (!response.ok)
    {
        throw new Error("Failed to fetch " + relative + " (" + response.status + ")");
    }
    return response.text();
}

export const LIFE_ENTRIES = ["gameoflife.cc"];
