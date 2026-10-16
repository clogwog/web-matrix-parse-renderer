export function stripComments(src)
{
    let out = "";
    let i = 0;
    while (i < src.length)
    {
        const c = src[i];
        if (c === "\"" || c === "'")
        {
            const q = c;
            out += src[i];
            i++;
            while (i < src.length)
            {
                const d = src[i];
                out += d;
                i++;
                if (d === "\\")
                {
                    if (i < src.length)
                    {
                        out += src[i];
                        i++;
                    }
                    continue;
                }
                if (d === q)
                {
                    break;
                }
            }
            continue;
        }
        if (c === "/" && src[i + 1] === "/")
        {
            i += 2;
            while (i < src.length && src[i] !== "\n")
            {
                i++;
            }
            continue;
        }
        if (c === "/" && src[i + 1] === "*")
        {
            i += 2;
            while (i < src.length && !(src[i] === "*" && src[i + 1] === "/"))
            {
                if (src[i] === "\n")
                {
                    out += "\n";
                }
                i++;
            }
            if (src[i] === "*" && src[i + 1] === "/")
            {
                i += 2;
            }
            continue;
        }
        out += c;
        i++;
    }
    return out;
}

function joinContinuations(src)
{
    return src.replace(/\\\r?\n/g, "");
}

function parseDefine(rest)
{
    const match = rest.match(/^([A-Za-z_][A-Za-z0-9_]*)(\(([^)]*)\))?\s*([\s\S]*)$/);
    if (!match)
    {
        throw new Error("Bad #define " + rest);
    }
    const name = match[1];
    const params = match[2]
        ? match[3].split(",").map(function (s) { return s.trim(); }).filter(Boolean)
        : null;
    const body = match[4] || "";
    return { name, params, body };
}

function bodiesEqual(a, b)
{
    const sameParams = (a.params == null && b.params == null)
        || (!!a.params && !!b.params && a.params.join(",") === b.params.join(","));
    return sameParams && a.body.trim() === b.body.trim();
}

function resolveInclude(spec, quoted, from, fileMap)
{
    const tries = [];
    if (quoted)
    {
        const slash = from.lastIndexOf("/");
        const dir = slash >= 0 ? from.slice(0, slash) : "";
        tries.push(dir ? dir + "/" + spec : spec);
    }
    tries.push(spec);
    tries.push("stubs/" + spec);
    for (const t of tries)
    {
        if (fileMap.has(t))
        {
            return t;
        }
    }
    throw new Error("Cannot include <" + spec + "> from " + from + " (tried " + tries.join(", ") + ")");
}

export function preprocess(entry, fileMap)
{
    const macros = new Map();
    const once = new Set();
    const chunks = [];

    function emit(text, file, line)
    {
        chunks.push({ text, file, line });
    }

    function processFile(name, stack)
    {
        if (stack.indexOf(name) !== -1)
        {
            throw new Error("Include cycle: " + stack.concat(name).join(" -> "));
        }
        if (once.has(name))
        {
            return;
        }
        const raw = fileMap.get(name);
        if (raw == null)
        {
            throw new Error("Missing source file " + name);
        }
        if (raw.includes("#pragma once"))
        {
            once.add(name);
        }
        const stripped = joinContinuations(stripComments(raw));
        const lines = stripped.split(/\r?\n/);
        const cond = [];

        function enabled()
        {
            for (const frame of cond)
            {
                if (!frame.enabled)
                {
                    return false;
                }
            }
            return true;
        }

        for (let li = 0; li < lines.length; li++)
        {
            const line = lines[li];
            const trimmed = line.trim();
            if (trimmed.startsWith("#"))
            {
                const body = trimmed.replace(/^#\s*/, "");
                const head = body.split(/\s+/)[0];
                if (head === "pragma")
                {
                    continue;
                }
                if (head === "ifndef" || head === "ifdef" || head === "if")
                {
                    const parent = enabled();
                    let taken = false;
                    if (head === "ifndef")
                    {
                        const macroName = body.split(/\s+/)[1];
                        taken = !macros.has(macroName);
                    }
                    else if (head === "ifdef")
                    {
                        const macroName = body.split(/\s+/)[1];
                        taken = macros.has(macroName);
                    }
                    else
                    {
                        const expr = body.replace(/^if\s+/, "").trim();
                        if (expr === "0")
                        {
                            taken = false;
                        }
                        else if (expr === "1")
                        {
                            taken = true;
                        }
                        else if (expr.startsWith("!defined"))
                        {
                            const macroName = expr.replace(/!defined\s*\(?\s*([A-Za-z0-9_]+)\s*\)?/, "$1");
                            taken = !macros.has(macroName);
                        }
                        else if (expr.startsWith("defined"))
                        {
                            const macroName = expr.replace(/defined\s*\(?\s*([A-Za-z0-9_]+)\s*\)?/, "$1");
                            taken = macros.has(macroName);
                        }
                        else
                        {
                            taken = true;
                        }
                    }
                    cond.push({
                        enabled: parent && taken,
                        parentEnabled: parent,
                        branchTaken: taken,
                        elseSeen: false
                    });
                    continue;
                }
                if (head === "else")
                {
                    const frame = cond[cond.length - 1];
                    if (!frame || frame.elseSeen)
                    {
                        throw new Error("#else mismatch in " + name + ":" + (li + 1));
                    }
                    frame.elseSeen = true;
                    frame.enabled = frame.parentEnabled && !frame.branchTaken;
                    continue;
                }
                if (head === "endif")
                {
                    if (!cond.length)
                    {
                        throw new Error("#endif mismatch in " + name + ":" + (li + 1));
                    }
                    cond.pop();
                    continue;
                }
                if (!enabled())
                {
                    continue;
                }
                if (head === "define")
                {
                    const def = parseDefine(body.replace(/^define\s+/, ""));
                    const prev = macros.get(def.name);
                    if (prev && !bodiesEqual(prev, def))
                    {
                        throw new Error("Macro redefined: " + def.name + " in " + name);
                    }
                    macros.set(def.name, def);
                    continue;
                }
                if (head === "include")
                {
                    const inc = body.replace(/^include\s+/, "").trim();
                    let spec = "";
                    let quoted = false;
                    if (inc.startsWith("\""))
                    {
                        quoted = true;
                        spec = inc.slice(1, inc.indexOf("\"", 1));
                    }
                    else if (inc.startsWith("<"))
                    {
                        spec = inc.slice(1, inc.indexOf(">"));
                    }
                    else
                    {
                        throw new Error("Bad include " + inc + " in " + name);
                    }
                    const resolved = resolveInclude(spec, quoted, name, fileMap);
                    processFile(resolved, stack.concat(name));
                    continue;
                }
                if (head === "undef")
                {
                    const macroName = body.split(/\s+/)[1];
                    macros.delete(macroName);
                    continue;
                }
                throw new Error("Unsupported directive #" + head + " in " + name + ":" + (li + 1));
            }
            if (!enabled())
            {
                continue;
            }
            emit(line, name, li + 1);
        }
        if (cond.length)
        {
            throw new Error("Unclosed #if in " + name);
        }
    }

    processFile(entry, []);
    const lineMap = [null];
    const source = chunks.map(function (chunk)
    {
        lineMap.push({ file: chunk.file, line: chunk.line });
        return chunk.text;
    }).join("\n");
    return { source, macros, lineMap };
}

function lexBody(body, lex)
{
    if (!body || !body.trim())
    {
        return [];
    }
    const tokens = lex(body, "<macro>", null);
    return tokens.filter(function (t) { return t.type !== "eof"; });
}

function readMacroArgs(tokens, start)
{
    let i = start;
    if (!tokens[i] || tokens[i].value !== "(")
    {
        return null;
    }
    i++;
    const args = [];
    let current = [];
    let depth = 1;
    while (i < tokens.length && depth > 0)
    {
        const t = tokens[i];
        if (t.value === "(")
        {
            depth++;
            current.push(t);
        }
        else if (t.value === ")")
        {
            depth--;
            if (depth === 0)
            {
                args.push(current);
                i++;
                break;
            }
            current.push(t);
        }
        else if (t.value === "," && depth === 1)
        {
            args.push(current);
            current = [];
        }
        else
        {
            current.push(t);
        }
        i++;
    }
    return { args, next: i };
}

export function expandMacros(tokens, macros, lex)
{
    const expanding = new Set();

    function expandList(list)
    {
        const out = [];
        for (let i = 0; i < list.length; i++)
        {
            const t = list[i];
            if (t.type !== "ident" || !macros.has(t.value) || expanding.has(t.value))
            {
                out.push(t);
                continue;
            }
            const macro = macros.get(t.value);
            if (macro.params)
            {
                const parsed = readMacroArgs(list, i + 1);
                if (!parsed || list[i + 1].value !== "(")
                {
                    out.push(t);
                    continue;
                }
                const bodyTokens = lexBody(macro.body, lex);
                const substituted = [];
                for (const bt of bodyTokens)
                {
                    const idx = macro.params.indexOf(bt.value);
                    if (bt.type === "ident" && idx !== -1)
                    {
                        const argTokens = parsed.args[idx] || [];
                        for (const at of argTokens)
                        {
                            substituted.push(at);
                        }
                    }
                    else
                    {
                        substituted.push(bt);
                    }
                }
                expanding.add(t.value);
                const expanded = expandList(substituted);
                expanding.delete(t.value);
                for (const et of expanded)
                {
                    out.push(et);
                }
                i = parsed.next - 1;
                continue;
            }
            const bodyTokens = lexBody(macro.body, lex);
            expanding.add(t.value);
            const expanded = expandList(bodyTokens);
            expanding.delete(t.value);
            for (const et of expanded)
            {
                out.push(et);
            }
        }
        return out;
    }

    const expanded = expandList(tokens.filter(function (t) { return t.type !== "eof"; }));
    const last = tokens[tokens.length - 1];
    expanded.push(last);
    return expanded;
}
