import { withAssetVersion } from "../../version.js?v=20261028";

const FILES = [
    "sources/snakeclock.cpp",
    "sources/pongnumberfont.bdf",
    "sources/led-matrix.h",
    "sources/graphics.h",
    "stubs/unistd.h",
    "stubs/ctime",
    "stubs/deque",
    "stubs/cmath",
    "stubs/sys/time.h",
    "stubs/stdlib.h"
];

function mapKey(relative)
{
    if (relative.startsWith("sources/"))
    {
        return relative.slice("sources/".length);
    }
    return relative;
}

export async function loadSnakeFiles()
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

export const SNAKE_ENTRIES = ["snakeclock.cpp"];
