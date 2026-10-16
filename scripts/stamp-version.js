import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url)).replace(/\/$/, "");
const versionFile = await readFile(join(root, "src/version.js"), "utf8");
const match = versionFile.match(/export const BUILD_VERSION = "([^"]+)"/);
if (!match)
{
    throw new Error("BUILD_VERSION not found in src/version.js");
}
const version = match[1];
const token = "?v=" + version;

function stampSpecifier(spec)
{
    if (!spec.startsWith("."))
    {
        return spec;
    }
    const hashAt = spec.indexOf("#");
    const hash = hashAt === -1 ? "" : spec.slice(hashAt);
    const before = hashAt === -1 ? spec : spec.slice(0, hashAt);
    const queryAt = before.indexOf("?");
    const path = queryAt === -1 ? before : before.slice(0, queryAt);
    return path + token + hash;
}

function stampModuleSource(source)
{
    return source.replace(/((?:from|import)\s*\(?\s*)(['"])(\.[^'"]+)\2/g, function (_all, lead, quote, spec)
    {
        return lead + quote + stampSpecifier(spec) + quote;
    });
}

function stampHtml(source)
{
    return source
        .replace(/href="css\/app\.css(?:\?[^"]*)?"/, "href=\"css/app.css" + token + "\"")
        .replace(/src="src\/main\.js(?:\?[^"]*)?"/, "src=\"src/main.js" + token + "\"");
}

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

const jsFiles = [];
await walkJs(join(root, "src"), jsFiles);
for (const path of jsFiles)
{
    const source = await readFile(path, "utf8");
    const next = stampModuleSource(source);
    if (next !== source)
    {
        await writeFile(path, next);
        console.log(path.slice(root.length + 1));
    }
}

const htmlPath = join(root, "index.html");
const html = await readFile(htmlPath, "utf8");
const nextHtml = stampHtml(html);
if (nextHtml !== html)
{
    await writeFile(htmlPath, nextHtml);
    console.log("index.html");
}

console.log("stamped " + token);
