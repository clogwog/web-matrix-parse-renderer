import { withAssetVersion } from "../../version.js?v=20261019";

const FILES = [
    "sources/pacmanclock.cc",
    "sources/digit.cc",
    "sources/digit.h",
    "sources/led-matrix.h",
    "sources/graphics.h",
    "stubs/stdio.h",
    "stubs/cstdlib",
    "stubs/cstddef",
    "stubs/unistd.h",
    "stubs/cstring",
    "stubs/iostream",
    "stubs/ctime",
    "stubs/cmath",
    "stubs/vector",
    "stubs/string",
    "stubs/algorithm",
    "stubs/signal.h",
    "stubs/syslog.h",
    "stubs/sys/time.h"
];

function mapKey(relative)
{
    if (relative.startsWith("sources/"))
    {
        return relative.slice("sources/".length);
    }
    return relative;
}

export async function loadPacmanFiles()
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

export const PACMAN_ENTRIES = ["digit.cc", "pacmanclock.cc"];
