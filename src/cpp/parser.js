const TYPE_KEYWORDS = new Set([
    "void",
    "bool",
    "int",
    "long",
    "float",
    "double",
    "char",
    "short",
    "unsigned",
    "signed",
    "auto"
]);

const STORAGE = new Set(["static", "extern", "register", "mutable"]);
const QUAL = new Set(["const", "volatile"]);

const PREC = {
    ",": 1,
    "=": 2,
    "+=": 2,
    "-=": 2,
    "*=": 2,
    "/=": 2,
    "%=": 2,
    "&=": 2,
    "|=": 2,
    "^=": 2,
    "<<=": 2,
    ">>=": 2,
    "?": 3,
    "||": 4,
    "&&": 5,
    "|": 6,
    "^": 7,
    "&": 8,
    "==": 9,
    "!=": 9,
    "<": 10,
    ">": 10,
    "<=": 10,
    ">=": 10,
    "<<": 11,
    ">>": 11,
    "+": 12,
    "-": 12,
    "*": 13,
    "/": 13,
    "%": 13
};

const RIGHT_ASSOC = new Set([
    "=",
    "+=",
    "-=",
    "*=",
    "/=",
    "%=",
    "&=",
    "|=",
    "^=",
    "<<=",
    ">>=",
    "?"
]);

function seedTypes()
{
    const known = new Set([
        "void",
        "bool",
        "int",
        "long",
        "float",
        "double",
        "char",
        "short",
        "uint8_t",
        "uint16_t",
        "uint32_t",
        "uint64_t",
        "int8_t",
        "int16_t",
        "int32_t",
        "int64_t",
        "size_t",
        "time_t",
        "string",
        "std::string",
        "vector",
        "std::vector",
        "shared_ptr",
        "std::shared_ptr",
        "GPIO",
        "RGBMatrix",
        "Canvas",
        "rgb_matrix::Font",
        "rgb_matrix::Color",
        "Font",
        "Color",
        "FrameCanvas",
        "timeval",
        "tm",
        "RGBMatrix::Options"
    ]);
    return known;
}

export function createParser(tokens, knownTypes)
{
    const known = knownTypes || seedTypes();
    let pos = 0;

    function tok()
    {
        return tokens[pos];
    }

    function error(message)
    {
        const t = tok();
        const err = new Error(message + " at " + t.file + ":" + t.line + ":" + t.col + " near '" + t.value + "'");
        err.line = t.line;
        err.file = t.file;
        throw err;
    }

    function at(value)
    {
        return tok().value === value;
    }

    function consume()
    {
        const t = tok();
        if (t.type === "eof")
        {
            error("Unexpected end of file");
        }
        pos++;
        return t;
    }

    function expect(value)
    {
        if (!at(value))
        {
            error("Expected '" + value + "'");
        }
        return consume();
    }

    function expectTemplateClose()
    {
        if (at(">>"))
        {
            tok().value = ">";
            return;
        }
        expect(">");
    }

    function consumeIdent()
    {
        if (tok().type !== "ident")
        {
            error("Expected identifier");
        }
        return consume().value;
    }

    function peekQualifiedName()
    {
        if (tok().type !== "ident")
        {
            return null;
        }
        let name = tok().value;
        let i = pos + 1;
        while (tokens[i] && tokens[i].value === "::")
        {
            const next = tokens[i + 1];
            if (!next || next.type !== "ident")
            {
                return name;
            }
            name += "::" + next.value;
            i += 2;
        }
        return name;
    }

    function isTypeKeyword(value)
    {
        return TYPE_KEYWORDS.has(value);
    }

    function isKnownTypeName(value)
    {
        return known.has(value);
    }

    function isTypeToken(token)
    {
        if (!token)
        {
            return false;
        }
        if (token.type === "ident" && (isTypeKeyword(token.value) || isKnownTypeName(token.value) || token.value === "vector" || token.value === "string"))
        {
            return true;
        }
        if (token.value === "struct" || token.value === "class" || token.value === "const" || token.value === "volatile" || token.value === "unsigned" || token.value === "signed")
        {
            return true;
        }
        return false;
    }

    function isDeclStart()
    {
        const t = tok();
        if (t.type === "eof")
        {
            return false;
        }
        if (STORAGE.has(t.value) || QUAL.has(t.value))
        {
            return true;
        }
        if (t.value === "struct" || t.value === "class")
        {
            return true;
        }
        if (t.type === "ident" && (isTypeKeyword(t.value) || isKnownTypeName(t.value) || t.value === "vector" || t.value === "string"))
        {
            return true;
        }
        if (t.type === "ident")
        {
            const qualified = peekQualifiedName();
            if (qualified && known.has(qualified))
            {
                return true;
            }
        }
        return false;
    }

    function isClassDefAhead()
    {
        if (!(at("struct") || at("class")))
        {
            return false;
        }
        const name = tokens[pos + 1];
        const brace = tokens[pos + 2];
        return name && name.type === "ident" && brace && brace.value === "{";
    }

    function isForwardDecl()
    {
        if (!(at("class") || at("struct")))
        {
            return false;
        }
        const name = tokens[pos + 1];
        const semi = tokens[pos + 2];
        return name && name.type === "ident" && semi && semi.value === ";";
    }

    function isCtorDefAhead()
    {
        const a = tokens[pos];
        const b = tokens[pos + 1];
        const c = tokens[pos + 2];
        const d = tokens[pos + 3];
        return a && a.type === "ident" && known.has(a.value)
            && b && b.value === "::"
            && c && c.type === "ident" && c.value === a.value
            && d && d.value === "(";
    }

    function typeToString(typeNode)
    {
        if (!typeNode)
        {
            return null;
        }
        if (typeNode.name === "vector")
        {
            return "vector";
        }
        return typeNode.name;
    }

    function parseTypeNode()
    {
        if (at("struct") || at("class"))
        {
            const kind = consume().value;
            const name = consumeIdent();
            if (at("{"))
            {
                error("Struct body is parsed as a class declaration");
            }
            known.add(name);
            return { defined: false, kind, name };
        }
        if (at("unsigned") || at("signed"))
        {
            let name = consume().value;
            if (tok().type === "ident" && (at("int") || at("long") || at("short") || at("char")))
            {
                name += " " + consume().value;
            }
            return { name };
        }
        if (at("long"))
        {
            consume();
            let name = "long";
            if (at("long"))
            {
                consume();
                name = "long long";
            }
            if (at("int"))
            {
                consume();
            }
            return { name };
        }
        if (tok().type === "ident" && isTypeKeyword(tok().value))
        {
            return { name: consume().value };
        }
        let name = consumeIdent();
        while (at("::"))
        {
            consume();
            name += "::" + consumeIdent();
        }
        const baseName = name.replace(/^std::/, "");
        if ((baseName === "vector" || baseName === "shared_ptr") && at("<"))
        {
            expect("<");
            const arg = parseTypeNode();
            expectTemplateClose();
            return { name: baseName, args: [arg] };
        }
        if (!known.has(name) && name !== "string")
        {
            error("Unknown type '" + name + "'");
        }
        return { name };
    }

    function parseSpecs()
    {
        const spec = {
            isStatic: false,
            isExtern: false,
            isConst: false,
            isVolatile: false,
            type: null
        };
        let sawType = false;
        if (!isDeclStart() && !at("::"))
        {
            error("Expected a declaration");
        }
        while (true)
        {
            if (STORAGE.has(tok().value))
            {
                if (at("static"))
                {
                    spec.isStatic = true;
                }
                if (at("extern"))
                {
                    spec.isExtern = true;
                }
                consume();
                continue;
            }
            if (QUAL.has(tok().value))
            {
                if (at("const"))
                {
                    spec.isConst = true;
                }
                if (at("volatile"))
                {
                    spec.isVolatile = true;
                }
                consume();
                continue;
            }
            if (sawType)
            {
                break;
            }
            if (at("struct") || at("class") || (tok().type === "ident" && (isTypeKeyword(tok().value) || isKnownTypeName(tok().value) || tok().value === "vector" || tok().value === "string" || tok().value === "unsigned" || tok().value === "signed" || tok().value === "long" || known.has(peekQualifiedName()))))
            {
                spec.type = parseTypeNode();
                sawType = true;
                if (spec.type && spec.type.defined)
                {
                    break;
                }
                continue;
            }
            break;
        }
        if (!sawType)
        {
            error("Expected a type");
        }
        return spec;
    }

    function qualifiedFrom(index)
    {
        const start = tokens[index];
        if (!start || start.type !== "ident")
        {
            return null;
        }
        let name = start.value;
        let i = index + 1;
        while (tokens[i] && tokens[i].value === "::")
        {
            const next = tokens[i + 1];
            if (!next || next.type !== "ident")
            {
                return name;
            }
            name += "::" + next.value;
            i += 2;
        }
        return name;
    }

    function looksLikeParams()
    {
        if (!at("("))
        {
            return false;
        }
        const next = tokens[pos + 1];
        if (next && next.value === ")")
        {
            return true;
        }
        if (isTypeToken(next))
        {
            return true;
        }
        const qualified = qualifiedFrom(pos + 1);
        return !!(qualified && known.has(qualified));
    }

    function parseSuffixes()
    {
        const arrays = [];
        let params = null;
        while (true)
        {
            if (at("["))
            {
                expect("[");
                let dim = null;
                if (!at("]"))
                {
                    dim = parseAssignExpr();
                }
                expect("]");
                arrays.push(dim);
                continue;
            }
            if (at("(") && looksLikeParams())
            {
                params = parseParameterList();
                continue;
            }
            break;
        }
        return { arrays, params };
    }

    function parseQualifiedName()
    {
        const first = consumeIdent();
        if (!at("::"))
        {
            return { name: first, className: null };
        }
        const parts = [first];
        while (at("::"))
        {
            consume();
            parts.push(consumeIdent());
        }
        return {
            name: parts[parts.length - 1],
            className: parts.slice(0, -1).join("::")
        };
    }

    function parseDeclarator()
    {
        let pointer = 0;
        let isRef = false;
        while (at("*") || at("&"))
        {
            if (at("*"))
            {
                pointer++;
            }
            else
            {
                isRef = true;
            }
            consume();
            while (at("const") || at("volatile"))
            {
                consume();
            }
        }
        if (at("("))
        {
            expect("(");
            const inner = parseDeclarator();
            expect(")");
            const suf = parseSuffixes();
            if (suf.params == null)
            {
                return {
                    name: inner.name,
                    className: inner.className,
                    pointer: inner.pointer + pointer,
                    isRef: inner.isRef || isRef,
                    arrayDims: [],
                    params: null
                };
            }
            return {
                name: inner.name,
                className: inner.className,
                pointer: inner.pointer + pointer,
                isRef: inner.isRef || isRef,
                arrayDims: inner.arrayDims,
                params: suf.params
            };
        }
        const qn = parseQualifiedName();
        const suf = parseSuffixes();
        return {
            name: qn.name,
            className: qn.className,
            pointer,
            isRef,
            arrayDims: suf.arrays,
            params: suf.params
        };
    }

    function parseParameterList()
    {
        expect("(");
        const params = [];
        if (!at(")"))
        {
            while (true)
            {
                if (at("..."))
                {
                    consume();
                    params.push({ name: null, typeName: "...", pointer: 0, isRef: false, varargs: true });
                    break;
                }
                const spec = parseSpecs();
                let decl = {
                    name: null,
                    className: null,
                    pointer: 0,
                    isRef: false,
                    arrayDims: [],
                    params: null
                };
                if (at("*") || at("&") || at("(") || tok().type === "ident")
                {
                    if (!(tok().type === "ident" && (at("const") || isTypeKeyword(tok().value))))
                    {
                        decl = parseDeclarator();
                    }
                }
                let defaultExpr = null;
                if (at("="))
                {
                    consume();
                    defaultExpr = parseAssignExpr();
                }
                params.push({
                    name: decl.name,
                    typeName: typeToString(spec.type),
                    typeArgs: spec.type && spec.type.args ? spec.type.args : null,
                    pointer: decl.pointer,
                    isRef: decl.isRef,
                    default: defaultExpr,
                    line: tok().line
                });
                if (at(","))
                {
                    consume();
                    continue;
                }
                break;
            }
        }
        expect(")");
        return params;
    }

    function parseBrace()
    {
        const line = tok().line;
        expect("{");
        const items = [];
        if (!at("}"))
        {
            while (true)
            {
                if (at("{"))
                {
                    items.push(parseBrace());
                }
                else
                {
                    items.push(parseAssignExpr());
                }
                if (at(","))
                {
                    consume();
                    if (at("}"))
                    {
                        break;
                    }
                    continue;
                }
                break;
            }
        }
        expect("}");
        return { kind: "brace", items, line };
    }

    function parseArgList()
    {
        expect("(");
        const args = [];
        if (!at(")"))
        {
            while (true)
            {
                args.push(parseAssignExpr());
                if (at(","))
                {
                    consume();
                    continue;
                }
                break;
            }
        }
        expect(")");
        return args;
    }

    function parsePrimary()
    {
        const t = tok();
        if (t.type === "number")
        {
            consume();
            return { kind: "literal", value: t.value, float: t.float, line: t.line };
        }
        if (t.type === "string")
        {
            consume();
            return { kind: "literal", value: t.value, string: true, line: t.line };
        }
        if (t.type === "ident" && (t.value === "true" || t.value === "false"))
        {
            consume();
            return { kind: "literal", value: t.value === "true", line: t.line };
        }
        if (t.type === "ident" && t.value === "this")
        {
            consume();
            return { kind: "this", line: t.line };
        }
        if (at("{"))
        {
            return parseBrace();
        }
        if (at("("))
        {
            const line = t.line;
            expect("(");
            const expr = parseExpr();
            expect(")");
            return { kind: "paren", expr, line };
        }
        if (t.type === "ident")
        {
            let name = consume().value;
            const line = t.line;
            while (at("::"))
            {
                consume();
                name += "::" + consumeIdent();
            }
            return { kind: "ident", name, line };
        }
        error("Expected expression");
    }

    function parseTemplateArgs()
    {
        expect("<");
        const args = [parseTypeNode()];
        while (at(","))
        {
            consume();
            args.push(parseTypeNode());
        }
        expectTemplateClose();
        return args.map(typeToString);
    }

    function parsePostfix()
    {
        let expr = parsePrimary();
        while (true)
        {
            if (expr.kind === "ident" && (expr.name === "make_shared" || expr.name === "std::make_shared") && at("<"))
            {
                const typeArgs = parseTemplateArgs();
                const line = tok().line;
                const args = at("(") ? parseArgList() : [];
                expr = { kind: "call", callee: expr, args, typeArgs, line };
                continue;
            }
            if (at("("))
            {
                const line = tok().line;
                const args = parseArgList();
                expr = { kind: "call", callee: expr, args, line };
                continue;
            }
            if (at("["))
            {
                const line = tok().line;
                expect("[");
                const index = parseExpr();
                expect("]");
                expr = { kind: "index", object: expr, index, line };
                continue;
            }
            if (at(".") || at("->"))
            {
                const arrow = consume().value === "->";
                const line = tok().line;
                const name = consumeIdent();
                expr = { kind: "member", object: expr, name, arrow, line };
                continue;
            }
            if (at("++") || at("--"))
            {
                const op = consume().value;
                expr = { kind: "postfix", op, expr, line: expr.line };
                continue;
            }
            break;
        }
        return expr;
    }

    function looksLikeCast()
    {
        if (!at("("))
        {
            return false;
        }
        const next = tokens[pos + 1];
        if (!isTypeToken(next) || next.value === "const" || next.value === "volatile")
        {
            if (!(next && (next.value === "unsigned" || next.value === "signed" || next.value === "const")))
            {
                if (!(next && isTypeKeyword(next.value)) && !(next && next.type === "ident" && isKnownTypeName(next.value)))
                {
                    return false;
                }
            }
        }
        const saved = pos;
        try
        {
            expect("(");
            if (!(isTypeToken(tok()) || at("unsigned") || at("signed") || at("const")))
            {
                pos = saved;
                return false;
            }
            if (at("const") || at("volatile"))
            {
                consume();
            }
            parseTypeNode();
            while (at("*") || at("&") || at("const") || at("volatile"))
            {
                consume();
            }
            const ok = at(")");
            pos = saved;
            return ok;
        }
        catch (err)
        {
            pos = saved;
            return false;
        }
    }

    function parseUnary()
    {
        if (tok().type === "ident" && tok().value === "sizeof")
        {
            const line = tok().line;
            consume();
            if (at("(") && looksLikeCast())
            {
                expect("(");
                if (at("const") || at("volatile"))
                {
                    consume();
                }
                const type = parseTypeNode();
                while (at("*") || at("&"))
                {
                    consume();
                }
                expect(")");
                return { kind: "sizeof", typeName: typeToString(type), line };
            }
            const expr = parseUnary();
            return { kind: "sizeof", expr, line };
        }
        if (at("new"))
        {
            const line = tok().line;
            consume();
            const type = parseTypeNode();
            let args = [];
            if (at("("))
            {
                args = parseArgList();
            }
            return { kind: "new", typeName: typeToString(type), typeArgs: type.args || null, args, line };
        }
        if (at("delete"))
        {
            const line = tok().line;
            consume();
            const expr = parseUnary();
            return { kind: "delete", expr, line };
        }
        if (at("++") || at("--") || at("+") || at("-") || at("!") || at("~") || at("&") || at("*"))
        {
            const op = consume().value;
            const line = tok().line;
            const expr = parseUnary();
            return { kind: "unary", op, expr, line };
        }
        if (at("(") && looksLikeCast())
        {
            const line = tok().line;
            expect("(");
            if (at("const"))
            {
                consume();
            }
            const type = parseTypeNode();
            while (at("*") || at("&") || at("const"))
            {
                consume();
            }
            expect(")");
            const expr = parseUnary();
            return { kind: "cast", typeName: typeToString(type), expr, line };
        }
        return parsePostfix();
    }

    function parseExprPrec(minPrec)
    {
        let left = parseUnary();
        while (true)
        {
            const op = tok().value;
            const prec = PREC[op];
            if (!prec || prec < minPrec)
            {
                break;
            }
            if (op === "?")
            {
                consume();
                const yes = parseExpr();
                expect(":");
                const no = parseExprPrec(prec);
                left = { kind: "ternary", test: left, yes, no, line: left.line };
                continue;
            }
            consume();
            const nextMin = RIGHT_ASSOC.has(op) ? prec : prec + 1;
            const right = parseExprPrec(nextMin);
            if (prec === 2)
            {
                left = { kind: "assign", op, left, right, line: left.line };
            }
            else
            {
                left = { kind: "binary", op, left, right, line: left.line };
            }
        }
        return left;
    }

    function parseExpr()
    {
        return parseExprPrec(1);
    }

    function parseAssignExpr()
    {
        return parseExprPrec(2);
    }

    function parseBlock()
    {
        const line = tok().line;
        expect("{");
        const statements = [];
        while (!at("}") && tok().type !== "eof")
        {
            statements.push(parseStatement());
        }
        expect("}");
        return { kind: "block", statements, line };
    }

    function parseIf()
    {
        const line = tok().line;
        expect("if");
        expect("(");
        const test = parseExpr();
        expect(")");
        const then = parseStatement();
        let els = null;
        if (tok().type === "ident" && tok().value === "else")
        {
            consume();
            els = parseStatement();
        }
        return { kind: "if", test, then, else: els, line };
    }

    function parseWhile()
    {
        const line = tok().line;
        expect("while");
        expect("(");
        const test = parseExpr();
        expect(")");
        const body = parseStatement();
        return { kind: "while", test, body, line };
    }

    function isRangeFor()
    {
        let depth = 0;
        for (let i = pos; i < tokens.length; i++)
        {
            const v = tokens[i].value;
            if (v === "(")
            {
                depth++;
            }
            else if (v === ")")
            {
                if (depth === 0)
                {
                    return false;
                }
                depth--;
            }
            else if (depth === 0 && v === ";")
            {
                return false;
            }
            else if (depth === 0 && v === ":")
            {
                return true;
            }
        }
        return false;
    }

    function parseFor()
    {
        const line = tok().line;
        expect("for");
        expect("(");
        if (isRangeFor())
        {
            let isConst = false;
            if (tok().type === "ident" && tok().value === "const")
            {
                isConst = true;
                consume();
            }
            if (!(tok().type === "ident" && tok().value === "auto"))
            {
                error("Expected auto in range-for");
            }
            consume();
            let isRef = false;
            if (at("&"))
            {
                isRef = true;
                consume();
            }
            const name = consumeIdent();
            expect(":");
            const iter = parseExpr();
            expect(")");
            const body = parseStatement();
            return { kind: "for-range", isConst, isRef, name, iter, body, line };
        }
        let init = null;
        if (!at(";"))
        {
            if (isDeclStart())
            {
                init = parseVarsOrFunction();
            }
            else
            {
                const expr = parseExpr();
                expect(";");
                init = { kind: "expr", expr, line };
            }
        }
        else
        {
            expect(";");
        }
        let test = null;
        if (!at(";"))
        {
            test = parseExpr();
        }
        expect(";");
        let step = null;
        if (!at(")"))
        {
            step = parseExpr();
        }
        expect(")");
        const body = parseStatement();
        return { kind: "for", init, test, step, body, line };
    }

    function parseSwitch()
    {
        const line = tok().line;
        expect("switch");
        expect("(");
        const expr = parseExpr();
        expect(")");
        expect("{");
        const cases = [];
        while (!at("}") && tok().type !== "eof")
        {
            if (tok().type === "ident" && tok().value === "case")
            {
                consume();
                const value = parseAssignExpr();
                expect(":");
                const statements = [];
                while (!at("}") && !(tok().type === "ident" && (tok().value === "case" || tok().value === "default")))
                {
                    statements.push(parseStatement());
                }
                cases.push({ value, statements });
                continue;
            }
            if (tok().type === "ident" && tok().value === "default")
            {
                consume();
                expect(":");
                const statements = [];
                while (!at("}") && !(tok().type === "ident" && (tok().value === "case" || tok().value === "default")))
                {
                    statements.push(parseStatement());
                }
                cases.push({ isDefault: true, statements });
                continue;
            }
            error("Expected case or default");
        }
        expect("}");
        return { kind: "switch", expr, cases, line };
    }

    function parseStatement()
    {
        if (at("{"))
        {
            return parseBlock();
        }
        if (tok().type === "ident" && tok().value === "if")
        {
            return parseIf();
        }
        if (tok().type === "ident" && tok().value === "while")
        {
            return parseWhile();
        }
        if (tok().type === "ident" && tok().value === "for")
        {
            return parseFor();
        }
        if (tok().type === "ident" && tok().value === "switch")
        {
            return parseSwitch();
        }
        if (tok().type === "ident" && tok().value === "return")
        {
            const line = tok().line;
            consume();
            let expr = null;
            if (!at(";"))
            {
                expr = parseExpr();
            }
            expect(";");
            return { kind: "return", expr, line };
        }
        if (tok().type === "ident" && tok().value === "break")
        {
            const line = tok().line;
            consume();
            expect(";");
            return { kind: "break", line };
        }
        if (tok().type === "ident" && tok().value === "continue")
        {
            const line = tok().line;
            consume();
            expect(";");
            return { kind: "continue", line };
        }
        if (at(";"))
        {
            const line = tok().line;
            consume();
            return { kind: "empty", line };
        }
        if (isClassDefAhead())
        {
            return parseClass();
        }
        if (isDeclStart())
        {
            return parseVarsOrFunction();
        }
        const line = tok().line;
        const expr = parseExpr();
        expect(";");
        return { kind: "expr", expr, line };
    }

    function parseClassBody(className, structKind)
    {
        expect("{");
        const members = [];
        let access = structKind === "class" ? "private" : "public";
        while (!at("}") && tok().type !== "eof")
        {
            if (tok().type === "ident" && (tok().value === "public" || tok().value === "private" || tok().value === "protected") && tokens[pos + 1] && tokens[pos + 1].value === ":")
            {
                access = consume().value;
                expect(":");
                continue;
            }
            if (tok().type === "ident" && tok().value === className && tokens[pos + 1] && tokens[pos + 1].value === "(")
            {
                const line = tok().line;
                consume();
                const params = parseParameterList();
                let trailingConst = false;
                if (tok().type === "ident" && tok().value === "const")
                {
                    trailingConst = true;
                    consume();
                }
                let body = null;
                if (at("{"))
                {
                    body = parseBlock();
                }
                else
                {
                    expect(";");
                }
                members.push({
                    kind: "function",
                    name: className,
                    className,
                    isConstructor: true,
                    params,
                    body,
                    trailingConst,
                    access,
                    line
                });
                continue;
            }
            const decl = parseVarsOrFunction();
            decl.access = access;
            members.push(decl);
        }
        expect("}");
        return members;
    }

    function parseClass()
    {
        const line = tok().line;
        const structKind = consume().value;
        const name = consumeIdent();
        known.add(name);
        const members = parseClassBody(name, structKind);
        expect(";");
        return { kind: "class", structKind, name, members, line };
    }

    function parseConstructorDef()
    {
        const line = tok().line;
        const className = consumeIdent();
        expect("::");
        const name = consumeIdent();
        const params = parseParameterList();
        if (tok().type === "ident" && tok().value === "const")
        {
            consume();
        }
        const inits = [];
        if (at(":"))
        {
            consume();
            while (true)
            {
                const field = consumeIdent();
                const args = parseArgList();
                inits.push({ name: field, args });
                if (!at(","))
                {
                    break;
                }
                consume();
            }
        }
        const body = parseBlock();
        return {
            kind: "function",
            name,
            className,
            isConstructor: true,
            isStatic: false,
            returnType: null,
            params,
            inits,
            body,
            line
        };
    }

    function parseTypedef()
    {
        const line = tok().line;
        expect("typedef");
        if (at("struct") || at("class"))
        {
            const structKind = consume().value;
            if (tok().type === "ident" && !at("{"))
            {
                known.add(consumeIdent());
            }
            expect("{");
            const members = [];
            while (!at("}") && tok().type !== "eof")
            {
                members.push(parseVarsOrFunction());
            }
            expect("}");
            const name = consumeIdent();
            known.add(name);
            expect(";");
            return { kind: "class", structKind, name, members, line };
        }
        const spec = parseSpecs();
        const decl = parseDeclarator();
        known.add(decl.name);
        expect(";");
        return { kind: "typedef", name: decl.name, typeName: typeToString(spec.type), line };
    }

    function parseUsing()
    {
        const line = tok().line;
        consume();
        if (tok().type === "ident" && tok().value === "namespace")
        {
            consume();
            const ns = consumeIdent();
            expect(";");
            return { kind: "using", namespace: ns, line };
        }
        let name = consumeIdent();
        while (at("::"))
        {
            consume();
            name += "::" + consumeIdent();
        }
        expect(";");
        return { kind: "using", name, line };
    }

    function parseVarsOrFunction()
    {
        const line = tok().line;
        const spec = parseSpecs();
        if (spec.type && spec.type.defined && at(";"))
        {
            expect(";");
            return {
                kind: "class",
                structKind: spec.type.kind,
                name: spec.type.name,
                members: spec.type.members,
                line
            };
        }
        if (spec.type && spec.type.defined)
        {
            error("Struct definition must end with ';'");
        }
        const decls = [];
        while (true)
        {
            const decl = parseDeclarator();
            let init = null;
            let ctorArgs = null;
            let trailingConst = false;
            if (decl.params)
            {
                if (tok().type === "ident" && tok().value === "const")
                {
                    trailingConst = true;
                    consume();
                }
                let body = null;
                if (at("{"))
                {
                    body = parseBlock();
                }
                else if (at("="))
                {
                    consume();
                    consume();
                    expect(";");
                }
                else
                {
                    expect(";");
                }
                return {
                    kind: "function",
                    name: decl.name,
                    className: decl.className,
                    isConstructor: decl.className && decl.name === decl.className,
                    isStatic: spec.isStatic,
                    returnType: typeToString(spec.type),
                    params: decl.params,
                    pointer: decl.pointer,
                    body,
                    trailingConst,
                    line
                };
            }
            if (at("="))
            {
                expect("=");
                if (at("{"))
                {
                    init = parseBrace();
                }
                else
                {
                    init = parseAssignExpr();
                }
            }
            else if (at("("))
            {
                ctorArgs = parseArgList();
            }
            decls.push({
                name: decl.name,
                className: decl.className,
                pointer: decl.pointer,
                isRef: decl.isRef,
                arrayDims: decl.arrayDims,
                init,
                ctorArgs
            });
            if (at(","))
            {
                consume();
                continue;
            }
            expect(";");
            break;
        }
        return {
            kind: "vars",
            isStatic: spec.isStatic,
            isConst: spec.isConst,
            isVolatile: spec.isVolatile,
            typeName: typeToString(spec.type),
            typeArgs: spec.type && spec.type.args ? spec.type.args.map(typeToString) : null,
            typeArgNodes: spec.type && spec.type.args ? spec.type.args : null,
            decls,
            line
        };
    }

    function parseTranslationUnit()
    {
        const decls = [];
        while (tok().type !== "eof")
        {
            if (tok().type === "ident" && tok().value === "using")
            {
                decls.push(parseUsing());
                continue;
            }
            if (tok().type === "ident" && tok().value === "typedef")
            {
                decls.push(parseTypedef());
                continue;
            }
            if (isCtorDefAhead())
            {
                decls.push(parseConstructorDef());
                continue;
            }
            if (isForwardDecl())
            {
                const line = tok().line;
                const structKind = consume().value;
                const name = consumeIdent();
                known.add(name);
                expect(";");
                decls.push({ kind: "forward", structKind, name, line });
                continue;
            }
            if (isClassDefAhead())
            {
                decls.push(parseClass());
                continue;
            }
            decls.push(parseVarsOrFunction());
        }
        return decls;
    }

    return {
        parseTranslationUnit,
        known
    };
}

export function parseTokens(tokens, knownTypes)
{
    const parser = createParser(tokens, knownTypes);
    const decls = parser.parseTranslationUnit();
    return { decls, knownTypes: parser.known };
}

export { seedTypes };
