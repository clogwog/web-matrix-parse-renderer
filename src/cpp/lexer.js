const MULTI_OPS = [
    ">>=",
    "<<=",
    "...",
    "==",
    "!=",
    "<=",
    ">=",
    "&&",
    "||",
    "++",
    "--",
    "+=",
    "-=",
    "*=",
    "/=",
    "%=",
    "&=",
    "|=",
    "^=",
    "->",
    "::",
    "<<",
    ">>"
];

const SINGLE_PUNCT = new Set(["(", ")", "{", "}", "[", "]", ";", ",", "?", ":", "~", "!", "+", "-", "*", "/", "%", "&", "|", "^", "=", "<", ">", "."]);

function isIdentStart(c)
{
    return (c >= "A" && c <= "Z") || (c >= "a" && c <= "z") || c === "_";
}

function isIdentCont(c)
{
    return isIdentStart(c) || (c >= "0" && c <= "9");
}

function isDigit(c)
{
    return c >= "0" && c <= "9";
}

export function lex(source, filename, lineMap)
{
    const tokens = [];
    let i = 0;
    let line = 1;
    let col = 1;

    function loc()
    {
        const mapped = lineMap && lineMap[line];
        if (mapped)
        {
            return { line: mapped.line, col, file: mapped.file };
        }
        return { line, col, file: filename || "<input>" };
    }

    function push(type, value, floatLit)
    {
        const at = loc();
        tokens.push({
            type,
            value,
            float: !!floatLit,
            line: at.line,
            col: at.col,
            file: at.file
        });
    }

    function readNumber()
    {
        const start = i;
        let isFloat = false;
        if (source[i] === "0" && (source[i + 1] === "x" || source[i + 1] === "X"))
        {
            i += 2;
            col += 2;
            while (i < source.length && /[0-9a-fA-F]/.test(source[i]))
            {
                i++;
                col++;
            }
            const raw = source.slice(start, i);
            return { value: parseInt(raw, 16), float: false };
        }
        while (i < source.length && isDigit(source[i]))
        {
            i++;
            col++;
        }
        if (source[i] === "." && isDigit(source[i + 1] || " "))
        {
            isFloat = true;
            i++;
            col++;
            while (i < source.length && isDigit(source[i]))
            {
                i++;
                col++;
            }
        }
        if (source[i] === "e" || source[i] === "E")
        {
            isFloat = true;
            i++;
            col++;
            if (source[i] === "+" || source[i] === "-")
            {
                i++;
                col++;
            }
            while (i < source.length && isDigit(source[i]))
            {
                i++;
                col++;
            }
        }
        let suffix = "";
        while (i < source.length && /[uUlLfF]/.test(source[i]))
        {
            suffix += source[i];
            if (source[i] === "f" || source[i] === "F")
            {
                isFloat = true;
            }
            i++;
            col++;
        }
        const raw = source.slice(start, i - suffix.length);
        const value = isFloat ? parseFloat(raw) : parseInt(raw, 10);
        return { value, float: isFloat };
    }

    function readString()
    {
        i++;
        col++;
        let out = "";
        while (i < source.length && source[i] !== "\"")
        {
            if (source[i] === "\\")
            {
                const n = source[i + 1];
                if (n === "n") out += "\n";
                else if (n === "t") out += "\t";
                else if (n === "r") out += "\r";
                else if (n === "0") out += "\0";
                else if (n === "\\") out += "\\";
                else if (n === "\"") out += "\"";
                else if (n === "'") out += "'";
                else out += n || "";
                i += 2;
                col += 2;
                continue;
            }
            out += source[i];
            if (source[i] === "\n")
            {
                line++;
                col = 1;
            }
            else
            {
                col++;
            }
            i++;
        }
        if (source[i] === "\"")
        {
            i++;
            col++;
        }
        return out;
    }

    while (i < source.length)
    {
        const c = source[i];
        if (c === " " || c === "\t" || c === "\r")
        {
            i++;
            col++;
            continue;
        }
        if (c === "\n")
        {
            i++;
            line++;
            col = 1;
            continue;
        }

        if (isIdentStart(c))
        {
            let s = "";
            while (i < source.length && isIdentCont(source[i]))
            {
                s += source[i];
                i++;
                col++;
            }
            push("ident", s, false);
            continue;
        }

        if (isDigit(c) || (c === "." && isDigit(source[i + 1] || "")))
        {
            const num = readNumber();
            push("number", num.value, num.float);
            continue;
        }

        if (c === "\"")
        {
            const str = readString();
            push("string", str, false);
            continue;
        }

        if (c === "'")
        {
            i++;
            col++;
            let ch = source[i] || "";
            i++;
            col++;
            if (ch === "\\")
            {
                ch = source[i] || "";
                i++;
                col++;
            }
            if (source[i] === "'")
            {
                i++;
                col++;
            }
            push("number", ch.charCodeAt(0) || 0, false);
            continue;
        }

        let matched = null;
        for (const op of MULTI_OPS)
        {
            if (source.startsWith(op, i))
            {
                matched = op;
                break;
            }
        }
        if (matched)
        {
            push("op", matched, false);
            i += matched.length;
            col += matched.length;
            continue;
        }

        if (SINGLE_PUNCT.has(c))
        {
            push("op", c, false);
            i++;
            col++;
            continue;
        }

        const at = loc();
        throw new Error("Unexpected character '" + c + "' at " + at.file + ":" + at.line + ":" + at.col);
    }

    const at = loc();
    tokens.push({ type: "eof", value: "", float: false, line: at.line, col: at.col, file: at.file });
    return tokens;
}
