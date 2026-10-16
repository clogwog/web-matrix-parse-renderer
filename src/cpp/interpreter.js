import { VirtualMatrix } from "../matrix/virtual-matrix.js";
import { localParts } from "../matrix/clock.js";

const HOST_STRUCTS = new Map([
    ["timeval", [
        { name: "tv_sec", typeName: "long" },
        { name: "tv_usec", typeName: "long" }
    ]],
    ["tm", [
        { name: "tm_sec", typeName: "int" },
        { name: "tm_min", typeName: "int" },
        { name: "tm_hour", typeName: "int" },
        { name: "tm_mday", typeName: "int" },
        { name: "tm_mon", typeName: "int" },
        { name: "tm_year", typeName: "int" },
        { name: "tm_wday", typeName: "int" }
    ]],
    ["RGBMatrix::Options", [
        { name: "hardware_mapping", typeName: "string" },
        { name: "rows", typeName: "int" },
        { name: "cols", typeName: "int" },
        { name: "chain_length", typeName: "int" },
        { name: "parallel", typeName: "int" },
        { name: "disable_hardware_pulsing", typeName: "bool" },
        { name: "brightness", typeName: "int" },
        { name: "pwm_bits", typeName: "int" }
    ]]
]);

function defaultField(typeName)
{
    if (typeName === "bool")
    {
        return false;
    }
    if (typeName === "string")
    {
        return "";
    }
    if (typeName === "float" || typeName === "double")
    {
        return { __float: true, v: 0 };
    }
    return 0;
}

function num(value)
{
    if (value && typeof value === "object" && value.__float)
    {
        return value.v;
    }
    if (typeof value === "boolean")
    {
        return value ? 1 : 0;
    }
    if (typeof value === "number")
    {
        return value;
    }
    if (value == null)
    {
        return 0;
    }
    return Number(value) || 0;
}

function isFloat(value)
{
    return !!(value && typeof value === "object" && value.__float);
}

function asFloat(value)
{
    return { __float: true, v: num(value) };
}

function truthy(value)
{
    if (isFloat(value))
    {
        return value.v !== 0;
    }
    if (value && value.__ptr)
    {
        return true;
    }
    return !!value;
}

function applyBin(op, left, right)
{
    const lf = isFloat(left);
    const rf = isFloat(right);
    const floating = lf || rf;
    const a = num(left);
    const b = num(right);
    if (op === "+")
    {
        return floating ? asFloat(a + b) : a + b;
    }
    if (op === "-")
    {
        return floating ? asFloat(a - b) : a - b;
    }
    if (op === "*")
    {
        return floating ? asFloat(a * b) : a * b;
    }
    if (op === "/")
    {
        if (floating)
        {
            return asFloat(a / b);
        }
        return Math.trunc(a / b);
    }
    if (op === "%")
    {
        return Math.trunc(a % b);
    }
    if (op === "==")
    {
        return a === b;
    }
    if (op === "!=")
    {
        return a !== b;
    }
    if (op === "<")
    {
        return a < b;
    }
    if (op === ">")
    {
        return a > b;
    }
    if (op === "<=")
    {
        return a <= b;
    }
    if (op === ">=")
    {
        return a >= b;
    }
    if (op === "|")
    {
        return (a | b) | 0;
    }
    if (op === "&")
    {
        return (a & b) | 0;
    }
    if (op === "^")
    {
        return (a ^ b) | 0;
    }
    if (op === "<<")
    {
        return a << b;
    }
    if (op === ">>")
    {
        return a >> b;
    }
    throw new Error("Unsupported operator " + op);
}

function castValue(typeName, value)
{
    const n = num(value);
    if (typeName === "float" || typeName === "double")
    {
        return asFloat(n);
    }
    if (typeName === "uint8_t")
    {
        let t = Math.trunc(n);
        if (t < 0)
        {
            t = 0;
        }
        if (t > 255)
        {
            t = 255;
        }
        return t;
    }
    if (typeName === "unsigned" || typeName === "unsigned int")
    {
        return Math.trunc(n) >>> 0;
    }
    return Math.trunc(n);
}

class Scope
{
    constructor(parent, kind, ctx)
    {
        this.parent = parent || null;
        this.kind = kind;
        this.ctx = ctx || (parent ? parent.ctx : null);
        this.vars = new Map();
        this.refs = new Map();
        this.thisObj = null;
        this.fn = null;
    }

    define(name, value)
    {
        this.vars.set(name, value);
    }

    defineRef(name, lv)
    {
        this.refs.set(name, lv);
    }

    get(name)
    {
        let scope = this;
        while (scope)
        {
            if (scope.refs.has(name))
            {
                return scope.refs.get(name).get();
            }
            if (scope.vars.has(name))
            {
                return scope.vars.get(name);
            }
            scope = scope.parent;
        }
        const fnScope = findFn(this);
        if (fnScope && fnScope.thisObj)
        {
            const obj = fnScope.thisObj;
            if (obj.__fields && Object.prototype.hasOwnProperty.call(obj.__fields, name))
            {
                return obj.__fields[name];
            }
            const method = lookupMethod(this.ctx, obj.__class, name);
            if (method)
            {
                return { __userFn: method, __this: obj };
            }
            const cls = this.ctx.classes.get(obj.__class);
            if (cls && cls.statics.has(name))
            {
                return cls.statics.get(name);
            }
        }
        if (this.ctx.functions.has(name))
        {
            const fn = this.ctx.functions.get(name);
            if (fn.__host)
            {
                return fn;
            }
            return { __userFn: fn, __this: null };
        }
        throw new ReferenceError("Unknown name '" + name + "' at line " + this.ctx.line);
    }

    lookupSlot(name)
    {
        let scope = this;
        while (scope)
        {
            if (scope.refs.has(name))
            {
                return scope.refs.get(name);
            }
            if (scope.vars.has(name))
            {
                const box = scope;
                return {
                    get()
                    {
                        return box.vars.get(name);
                    },
                    set(value)
                    {
                        box.vars.set(name, value);
                    }
                };
            }
            scope = scope.parent;
        }
        const fnScope = findFn(this);
        if (fnScope && fnScope.thisObj)
        {
            const obj = fnScope.thisObj;
            if (obj.__fields && Object.prototype.hasOwnProperty.call(obj.__fields, name))
            {
                return {
                    get()
                    {
                        return obj.__fields[name];
                    },
                    set(value)
                    {
                        obj.__fields[name] = value;
                    }
                };
            }
        }
        throw new ReferenceError("Cannot assign '" + name + "' at line " + this.ctx.line);
    }
}

function findFn(scope)
{
    let cursor = scope;
    while (cursor)
    {
        if (cursor.kind === "func")
        {
            return cursor;
        }
        cursor = cursor.parent;
    }
    return null;
}

function lookupMethod(ctx, className, name)
{
    const cls = ctx.classes.get(className);
    if (!cls)
    {
        return null;
    }
    return cls.methods.get(name) || null;
}

function makeString(text)
{
    const value = text == null ? "" : String(text);
    return {
        __class: "string",
        s: value,
        c_str()
        {
            return value;
        }
    };
}

export function linkProgram(units)
{
    const classes = new Map();
    const functions = new Map();
    const globalVars = [];

    function registerClass(node)
    {
        let cls = classes.get(node.name);
        if (!cls)
        {
            cls = {
                name: node.name,
                fields: [],
                methods: new Map(),
                ctor: null,
                statics: new Map(),
                isPod: true
            };
            classes.set(node.name, cls);
        }
        for (const member of node.members)
        {
            if (member.kind === "vars")
            {
                for (const decl of member.decls)
                {
                    if (member.isStatic)
                    {
                        if (!cls.statics.has(decl.name))
                        {
                            cls.statics.set(decl.name, undefined);
                        }
                    }
                    else if (!cls.fields.some(function (field) { return field.name === decl.name; }))
                    {
                        cls.fields.push({ name: decl.name, typeName: member.typeName });
                    }
                }
            }
            else if (member.kind === "function")
            {
                cls.isPod = false;
                if (member.isConstructor || member.name === node.name)
                {
                    if (member.body || !cls.ctor)
                    {
                        cls.ctor = member;
                    }
                }
                else if (member.body || !cls.methods.has(member.name))
                {
                    cls.methods.set(member.name, member);
                }
            }
        }
        if (cls.methods.size || cls.ctor)
        {
            cls.isPod = false;
        }
    }

    function registerFunction(node)
    {
        if (node.className)
        {
            let cls = classes.get(node.className);
            if (!cls)
            {
                cls = {
                    name: node.className,
                    fields: [],
                    methods: new Map(),
                    ctor: null,
                    statics: new Map(),
                    isPod: false
                };
                classes.set(node.className, cls);
            }
            cls.isPod = false;
            if (node.isConstructor || node.name === node.className)
            {
                if (node.body || !cls.ctor)
                {
                    cls.ctor = node;
                }
            }
            else if (node.body || !cls.methods.has(node.name))
            {
                cls.methods.set(node.name, node);
            }
            return;
        }
        const prev = functions.get(node.name);
        if (!prev || (node.body && !prev.body))
        {
            functions.set(node.name, node);
        }
    }

    for (const unit of units)
    {
        for (const decl of unit.decls)
        {
            if (decl.kind === "class")
            {
                registerClass(decl);
            }
            else if (decl.kind === "function")
            {
                registerFunction(decl);
            }
            else if (decl.kind === "vars")
            {
                globalVars.push(decl);
            }
        }
    }

    return { classes, functions, globalVars };
}

export function createSession(program, options)
{
    const opts = options || {};
    const ctx = {
        classes: program.classes,
        functions: new Map(program.functions),
        clock: opts.clock,
        now: opts.clock ? opts.clock.now() : Date.now(),
        argc: opts.argc == null ? 1 : opts.argc,
        argv: opts.argv || ["pacmanclock"],
        line: 0,
        frameReady: false,
        pendingFrame: null,
        stmtCount: 0,
        stmtLimit: opts.stmtLimit || 4000000,
        randState: 1,
        matrix: null,
        lastError: null
    };

    const global = new Scope(null, "global", ctx);
    ctx.global = global;
    installHosts(ctx);

    const generator = run(program, ctx, global);

    return {
        ctx,
        global,
        step(nowMs)
        {
            if (nowMs != null)
            {
                ctx.now = nowMs;
            }
            else if (ctx.clock)
            {
                ctx.now = ctx.clock.now();
            }
            else
            {
                ctx.now = Date.now();
            }
            const result = generator.next();
            if (result.done)
            {
                return { done: true, frame: ctx.pendingFrame };
            }
            return { done: false, frame: result.value };
        }
    };
}

function installHosts(ctx)
{
    function host(fn)
    {
        return { __host: true, __call: fn };
    }

    const rand = host(function ()
    {
        ctx.randState = (Math.imul(ctx.randState, 1103515245) + 12345) >>> 0;
        return (ctx.randState >>> 16) & 0x7fff;
    });
    const srand = host(function (_this, args)
    {
        ctx.randState = (num(args[0]) >>> 0) || 1;
        return 0;
    });
    const timeFn = host(function ()
    {
        return Math.floor(ctx.now / 1000);
    });
    const localtime = host(function ()
    {
        const parts = localParts(ctx.now);
        return {
            __struct: "tm",
            tm_sec: parts.sec,
            tm_min: parts.min,
            tm_hour: parts.hour,
            tm_mday: parts.mday,
            tm_mon: parts.mon,
            tm_year: parts.year,
            tm_wday: parts.wday
        };
    });
    const gettimeofday = host(function (_this, args)
    {
        const ptr = args[0];
        const target = ptr && ptr.__ptr ? ptr.lv.get() : ptr;
        if (!target || typeof target !== "object")
        {
            throw new Error("gettimeofday expects a timeval");
        }
        const ms = ctx.now;
        target.tv_sec = Math.floor(ms / 1000);
        target.tv_usec = Math.floor(ms % 1000) * 1000;
        return 0;
    });
    const difftime = host(function (_this, args)
    {
        return num(args[0]) - num(args[1]);
    });
    const memset = host(function (_this, args)
    {
        const dest = args[0] && args[0].__ptr ? args[0].lv.get() : args[0];
        const value = num(args[1]);
        fillValue(dest, value);
        return dest;
    });
    const sizeofFn = host(function (_this, args)
    {
        return roughSize(args[0]);
    });
    const absFn = host(function (_this, args)
    {
        const value = args[0];
        const n = Math.abs(num(value));
        return isFloat(value) ? asFloat(n) : n;
    });
    const maxFn = host(function (_this, args)
    {
        return num(args[0]) >= num(args[1]) ? args[0] : args[1];
    });
    const fmodf = host(function (_this, args)
    {
        return asFloat(num(args[0]) % num(args[1]));
    });
    const fabsf = host(function (_this, args)
    {
        return asFloat(Math.abs(num(args[0])));
    });
    const stoi = host(function (_this, args)
    {
        const raw = args[0];
        const text = raw && raw.s != null ? raw.s : String(raw);
        const parsed = parseInt(text, 10);
        if (Number.isNaN(parsed))
        {
            throw new Error("stoi failed");
        }
        return parsed;
    });
    const noop = host(function ()
    {
        return 0;
    });

    const table = {
        rand,
        srand,
        time: timeFn,
        localtime,
        gettimeofday,
        difftime,
        memset,
        sizeof: sizeofFn,
        abs: absFn,
        "std::abs": absFn,
        "std::max": maxFn,
        "std::stoi": stoi,
        fmodf,
        fabsf,
        syslog: noop,
        openlog: noop,
        setlogmask: noop,
        printf: noop,
        signal: noop
    };
    for (const name of Object.keys(table))
    {
        ctx.functions.set(name, table[name]);
    }
    ctx.hostCtors = new Map();
    ctx.hostCtors.set("GPIO", function ()
    {
        return {
            __class: "GPIO",
            Init()
            {
                return true;
            }
        };
    });
    ctx.hostCtors.set("RGBMatrix", function (args)
    {
        return constructMatrix(ctx, args);
    });
}

function fillValue(dest, value)
{
    if (Array.isArray(dest))
    {
        for (let i = 0; i < dest.length; i++)
        {
            if (Array.isArray(dest[i]))
            {
                fillValue(dest[i], value);
            }
            else if (dest[i] && dest[i].__struct)
            {
                fillValue(dest[i], value);
            }
            else
            {
                dest[i] = value;
            }
        }
        return;
    }
    if (dest && dest.__struct)
    {
        for (const key of Object.keys(dest))
        {
            if (key === "__struct")
            {
                continue;
            }
            dest[key] = value;
        }
    }
}

function roughSize(value)
{
    const target = value && value.__ptr ? value.lv.get() : value;
    if (Array.isArray(target))
    {
        if (target.length && Array.isArray(target[0]))
        {
            return target.length * target[0].length;
        }
        return target.length;
    }
    return 1;
}

function createCanvas(width, height)
{
    const matrix = new VirtualMatrix(width, height);
    return {
        __class: "FrameCanvas",
        __matrix: matrix,
        SetPixel(x, y, r, g, b)
        {
            matrix.setPixel(num(x), num(y), num(r), num(g), num(b));
        },
        Clear()
        {
            matrix.clear();
        },
        Fill(r, g, b)
        {
            matrix.fill(num(r), num(g), num(b));
        }
    };
}

function constructMatrix(ctx, args)
{
    const optsArg = args[1];
    const opts = optsArg && optsArg.__ptr ? optsArg.lv.get() : optsArg;
    const rows = num(opts && opts.rows) || 32;
    const cols = num(opts && opts.cols) || 32;
    const chain = num(opts && opts.chain_length) || 1;
    const width = cols * chain;
    const height = rows;
    const front = createCanvas(width, height);
    const back = createCanvas(width, height);
    const matrix = {
        __class: "RGBMatrix",
        width,
        height,
        brightness: opts && opts.brightness != null ? num(opts.brightness) : 100,
        options: opts,
        active: front,
        spare: back,
        CreateFrameCanvas()
        {
            return this.spare;
        },
        SwapOnVSync(canvas)
        {
            const shown = canvas || this.spare;
            const returned = this.active;
            this.active = shown;
            this.spare = returned;
            const snap = shown.__matrix.snapshot();
            snap.brightness = this.brightness;
            ctx.pendingFrame = snap;
            ctx.frameReady = true;
            return returned;
        },
        Clear()
        {
            this.active.Clear();
        }
    };
    ctx.matrix = matrix;
    return matrix;
}

function* run(program, ctx, global)
{
    for (const decl of program.globalVars)
    {
        yield* execVars(decl, global, ctx);
    }
    const main = ctx.functions.get("main");
    if (!main || !main.body)
    {
        throw new Error("No main() to run");
    }
    const scope = new Scope(global, "func", ctx);
    scope.fn = main;
    if (main.params[0] && main.params[0].name)
    {
        scope.define(main.params[0].name, ctx.argc);
    }
    if (main.params[1] && main.params[1].name)
    {
        scope.define(main.params[1].name, ctx.argv);
    }
    yield* execStatement(main.body, scope, ctx);
}

function guard(ctx)
{
    ctx.stmtCount++;
    if (ctx.stmtCount > ctx.stmtLimit)
    {
        throw new Error("Statement limit exceeded at line " + ctx.line + " (possible infinite loop)");
    }
}

function* execStatement(node, env, ctx)
{
    if (!node || node.kind === "empty" || node.kind === "using")
    {
        return;
    }
    if (node.line)
    {
        ctx.line = node.line;
    }
    guard(ctx);
    switch (node.kind)
    {
        case "block":
            yield* execBlock(node, env, ctx);
            return;
        case "if":
            yield* execIf(node, env, ctx);
            return;
        case "while":
            yield* execWhile(node, env, ctx);
            return;
        case "for":
            yield* execFor(node, env, ctx);
            return;
        case "for-range":
            yield* execForRange(node, env, ctx);
            return;
        case "switch":
            yield* execSwitch(node, env, ctx);
            return;
        case "return":
            ctx.flow = {
                type: "return",
                value: node.expr ? yield* evalExpr(node.expr, env, ctx) : 0
            };
            return;
        case "break":
            ctx.flow = { type: "break" };
            return;
        case "continue":
            ctx.flow = { type: "continue" };
            return;
        case "vars":
            yield* execVars(node, env, ctx);
            break;
        case "class":
            defineLocalClass(node, ctx);
            break;
        case "expr":
            yield* evalExpr(node.expr, env, ctx);
            break;
        default:
            throw new Error("Bad statement " + node.kind + " at line " + ctx.line);
    }
    if (ctx.flow)
    {
        return;
    }
    if (ctx.frameReady)
    {
        const frame = ctx.pendingFrame;
        ctx.frameReady = false;
        ctx.stmtCount = 0;
        yield frame;
    }
}

function* execBlock(node, env, ctx)
{
    const scope = new Scope(env, "block", ctx);
    for (const statement of node.statements)
    {
        yield* execStatement(statement, scope, ctx);
        if (ctx.flow)
        {
            return;
        }
    }
}

function* execIf(node, env, ctx)
{
    if (truthy(yield* evalExpr(node.test, env, ctx)))
    {
        yield* execStatement(node.then, env, ctx);
    }
    else if (node.else)
    {
        yield* execStatement(node.else, env, ctx);
    }
}

function* execWhile(node, env, ctx)
{
    while (truthy(yield* evalExpr(node.test, env, ctx)))
    {
        yield* execStatement(node.body, env, ctx);
        if (ctx.flow && ctx.flow.type === "return")
        {
            return;
        }
        if (ctx.flow && ctx.flow.type === "break")
        {
            ctx.flow = null;
            return;
        }
        if (ctx.flow && ctx.flow.type === "continue")
        {
            ctx.flow = null;
        }
    }
}

function* execFor(node, env, ctx)
{
    const scope = new Scope(env, "block", ctx);
    if (node.init)
    {
        if (node.init.kind === "vars")
        {
            yield* execVars(node.init, scope, ctx);
        }
        else if (node.init.kind === "expr")
        {
            yield* evalExpr(node.init.expr, scope, ctx);
        }
        else
        {
            yield* execStatement(node.init, scope, ctx);
        }
    }
    while (true)
    {
        if (node.test && !truthy(yield* evalExpr(node.test, scope, ctx)))
        {
            break;
        }
        yield* execStatement(node.body, scope, ctx);
        if (ctx.flow && ctx.flow.type === "return")
        {
            return;
        }
        if (ctx.flow && ctx.flow.type === "break")
        {
            ctx.flow = null;
            return;
        }
        if (ctx.flow && ctx.flow.type === "continue")
        {
            ctx.flow = null;
        }
        if (node.step)
        {
            yield* evalExpr(node.step, scope, ctx);
        }
    }
}

function* execForRange(node, env, ctx)
{
    const value = yield* evalExpr(node.iter, env, ctx);
    const items = value && value.__vector ? value.items : value;
    if (!items || typeof items.length !== "number")
    {
        throw new Error("range-for needs a vector or array at line " + ctx.line);
    }
    for (let i = 0; i < items.length; i++)
    {
        const scope = new Scope(env, "block", ctx);
        scope.define(node.name, items[i]);
        yield* execStatement(node.body, scope, ctx);
        if (ctx.flow && ctx.flow.type === "return")
        {
            return;
        }
        if (ctx.flow && ctx.flow.type === "break")
        {
            ctx.flow = null;
            return;
        }
        if (ctx.flow && ctx.flow.type === "continue")
        {
            ctx.flow = null;
        }
    }
}

function* execSwitch(node, env, ctx)
{
    const key = yield* evalExpr(node.expr, env, ctx);
    let matched = false;
    for (const clause of node.cases)
    {
        if (!matched)
        {
            if (clause.isDefault)
            {
                matched = true;
            }
            else
            {
                const label = yield* evalExpr(clause.value, env, ctx);
                if (num(label) === num(key))
                {
                    matched = true;
                }
            }
        }
        if (!matched)
        {
            continue;
        }
        for (const statement of clause.statements)
        {
            yield* execStatement(statement, env, ctx);
            if (ctx.flow && ctx.flow.type === "break")
            {
                ctx.flow = null;
                return;
            }
            if (ctx.flow && (ctx.flow.type === "return" || ctx.flow.type === "continue"))
            {
                return;
            }
        }
    }
}

function defineLocalClass(node, ctx)
{
    let cls = ctx.classes.get(node.name);
    if (!cls)
    {
        cls = {
            name: node.name,
            fields: [],
            methods: new Map(),
            ctor: null,
            statics: new Map(),
            isPod: true
        };
        ctx.classes.set(node.name, cls);
    }
    for (const member of node.members)
    {
        if (member.kind !== "vars")
        {
            cls.isPod = false;
            continue;
        }
        for (const decl of member.decls)
        {
            if (!cls.fields.some(function (field) { return field.name === decl.name; }))
            {
                cls.fields.push({ name: decl.name, typeName: member.typeName });
            }
        }
    }
}

function* execVars(node, env, ctx)
{
    for (const decl of node.decls)
    {
        if (decl.className)
        {
            const value = yield* makeInit(node, decl, env, ctx);
            const cls = ctx.classes.get(decl.className);
            if (!cls)
            {
                throw new Error("No class " + decl.className);
            }
            cls.statics.set(decl.name, value);
            continue;
        }
        const fnScope = findFn(env);
        if (node.isStatic && fnScope)
        {
            if (!fnScope.fn.statics)
            {
                fnScope.fn.statics = new Map();
            }
            if (!fnScope.fn.statics.has(decl.name))
            {
                fnScope.fn.statics.set(decl.name, yield* makeInit(node, decl, env, ctx));
            }
            env.define(decl.name, fnScope.fn.statics.get(decl.name));
            continue;
        }
        const value = yield* makeInit(node, decl, env, ctx);
        env.define(decl.name, value);
    }
}

function* makeInit(node, decl, env, ctx)
{
    if (decl.arrayDims && decl.arrayDims.length)
    {
        return yield* allocArray(node.typeName, decl.arrayDims, decl.init, env, ctx);
    }
    if (decl.ctorArgs)
    {
        return yield* construct(node.typeName, decl.ctorArgs, env, ctx);
    }
    if (decl.init)
    {
        const value = yield* evalExpr(decl.init, env, ctx);
        return coerceAssign(null, value);
    }
    if (node.typeName === "vector")
    {
        return {
            __vector: true,
            elemType: node.typeArgs ? node.typeArgs[0] : null,
            items: []
        };
    }
    if (ctx.hostCtors && ctx.hostCtors.has(node.typeName))
    {
        return ctx.hostCtors.get(node.typeName)([], ctx);
    }
    if (isUserClass(ctx, node.typeName))
    {
        return yield* construct(node.typeName, [], env, ctx);
    }
    if (isStructType(ctx, node.typeName))
    {
        return makeStruct(ctx, node.typeName);
    }
    if (node.typeName === "bool")
    {
        return false;
    }
    if (node.typeName === "float" || node.typeName === "double")
    {
        return asFloat(0);
    }
    if (decl.pointer)
    {
        return null;
    }
    return 0;
}

function isUserClass(ctx, name)
{
    const cls = ctx.classes.get(name);
    return !!(cls && !cls.isPod);
}

function isStructType(ctx, name)
{
    if (HOST_STRUCTS.has(name))
    {
        return true;
    }
    const cls = ctx.classes.get(name);
    return !!(cls && cls.isPod);
}

function fieldNames(ctx, typeName)
{
    if (HOST_STRUCTS.has(typeName))
    {
        return HOST_STRUCTS.get(typeName).map(function (field) { return field.name; });
    }
    const cls = ctx.classes.get(typeName);
    if (!cls)
    {
        throw new Error("No fields for " + typeName + " at line " + ctx.line);
    }
    return cls.fields.map(function (field) { return field.name; });
}

function makeStruct(ctx, typeName)
{
    const obj = { __struct: typeName };
    if (HOST_STRUCTS.has(typeName))
    {
        for (const field of HOST_STRUCTS.get(typeName))
        {
            obj[field.name] = defaultField(field.typeName);
        }
        if (typeName === "RGBMatrix::Options")
        {
            obj.rows = 32;
            obj.cols = 32;
            obj.chain_length = 1;
            obj.parallel = 1;
            obj.brightness = 100;
        }
        return obj;
    }
    const cls = ctx.classes.get(typeName);
    if (!cls)
    {
        throw new Error("Unknown struct " + typeName + " at line " + ctx.line);
    }
    for (const field of cls.fields)
    {
        obj[field.name] = defaultField(field.typeName);
    }
    return obj;
}

function makeInstance(ctx, typeName)
{
    const cls = ctx.classes.get(typeName);
    if (!cls)
    {
        throw new Error("Unknown class " + typeName);
    }
    const obj = { __class: typeName, __fields: {} };
    for (const field of cls.fields)
    {
        obj.__fields[field.name] = defaultField(field.typeName);
    }
    return obj;
}

function* construct(typeName, argNodes, env, ctx)
{
    if (typeName === "string")
    {
        const args = [];
        for (const arg of argNodes)
        {
            args.push(yield* evalExpr(arg, env, ctx));
        }
        const raw = args[0];
        const text = raw && raw.s != null ? raw.s : raw == null ? "" : String(raw);
        return makeString(text);
    }
    if (typeName === "vector")
    {
        return { __vector: true, elemType: null, items: [] };
    }
    if (ctx.hostCtors && ctx.hostCtors.has(typeName))
    {
        const args = [];
        for (const arg of argNodes)
        {
            args.push(yield* evalExpr(arg, env, ctx));
        }
        return ctx.hostCtors.get(typeName)(args, ctx);
    }
    const obj = makeInstance(ctx, typeName);
    const cls = ctx.classes.get(typeName);
    if (cls && cls.ctor && cls.ctor.body)
    {
        yield* callUser(cls.ctor, obj, argNodes, env, ctx);
    }
    return obj;
}

function* callUser(fn, thisObj, argNodes, callerEnv, ctx)
{
    const scope = new Scope(ctx.global, "func", ctx);
    scope.fn = fn;
    scope.thisObj = thisObj;
    for (let i = 0; i < fn.params.length; i++)
    {
        const param = fn.params[i];
        if (!param || !param.name)
        {
            if (argNodes[i])
            {
                yield* evalExpr(argNodes[i], callerEnv, ctx);
            }
            continue;
        }
        if (param.isRef)
        {
            const lv = yield* evalLValue(argNodes[i], callerEnv, ctx);
            scope.defineRef(param.name, lv);
        }
        else
        {
            const value = yield* evalExpr(argNodes[i], callerEnv, ctx);
            scope.define(param.name, coerceAssign(null, value));
        }
    }
    const savedFlow = ctx.flow;
    ctx.flow = null;
    yield* execStatement(fn.body, scope, ctx);
    let returned = 0;
    if (ctx.flow && ctx.flow.type === "return")
    {
        returned = ctx.flow.value;
        ctx.flow = savedFlow && savedFlow.type !== "return" ? savedFlow : null;
    }
    else if (ctx.flow && ctx.flow.type !== "return")
    {
        const flow = ctx.flow;
        ctx.flow = null;
        throw new Error("'" + flow.type + "' escaped function " + fn.name + " at line " + ctx.line);
    }
    else
    {
        ctx.flow = savedFlow || null;
    }
    return returned;
}

function coerceAssign(current, value)
{
    if (value && value.__brace)
    {
        return value;
    }
    if (value && value.__struct)
    {
        return Object.assign({ __struct: value.__struct }, value);
    }
    return value;
}

function braceToStruct(ctx, typeName, brace)
{
    const obj = makeStruct(ctx, typeName);
    const names = fieldNames(ctx, typeName);
    for (let i = 0; i < names.length; i++)
    {
        let value = brace.items[i];
        if (value && value.__float)
        {
            value = value.v;
        }
        obj[names[i]] = value;
    }
    return obj;
}

function* allocArray(typeName, dims, init, env, ctx)
{
    const sizes = [];
    for (const dim of dims)
    {
        if (dim == null)
        {
            sizes.push(0);
        }
        else
        {
            sizes.push(Math.trunc(num(yield* evalExpr(dim, env, ctx))));
        }
    }
    if (sizes.length === 1)
    {
        const arr = new Array(sizes[0]);
        const structElem = isStructType(ctx, typeName);
        for (let i = 0; i < sizes[0]; i++)
        {
            arr[i] = structElem ? makeStruct(ctx, typeName) : 0;
        }
        if (init && init.kind === "brace")
        {
            for (let i = 0; i < sizes[0] && i < init.items.length; i++)
            {
                if (structElem)
                {
                    arr[i] = yield* structFromInit(typeName, init.items[i], env, ctx);
                }
                else
                {
                    arr[i] = yield* evalExpr(init.items[i], env, ctx);
                }
            }
        }
        return arr;
    }
    if (sizes.length === 2)
    {
        const rows = sizes[0];
        const cols = sizes[1];
        const arr = [];
        for (let r = 0; r < rows; r++)
        {
            const row = new Array(cols);
            for (let c = 0; c < cols; c++)
            {
                row[c] = 0;
            }
            arr.push(row);
        }
        if (init && init.kind === "brace")
        {
            const nested = init.items.length > 0 && init.items[0].kind === "brace";
            if (nested)
            {
                for (let r = 0; r < rows && r < init.items.length; r++)
                {
                    const rowInit = init.items[r];
                    for (let c = 0; c < cols && c < rowInit.items.length; c++)
                    {
                        arr[r][c] = scalar(yield* evalExpr(rowInit.items[c], env, ctx));
                    }
                }
            }
            else
            {
                let k = 0;
                for (let r = 0; r < rows; r++)
                {
                    for (let c = 0; c < cols; c++)
                    {
                        if (k < init.items.length)
                        {
                            arr[r][c] = scalar(yield* evalExpr(init.items[k], env, ctx));
                        }
                        k++;
                    }
                }
            }
        }
        return arr;
    }
    throw new Error("Only 1D and 2D arrays are supported (line " + ctx.line + ")");
}

function* structFromInit(typeName, node, env, ctx)
{
    if (!node || node.kind !== "brace")
    {
        const value = yield* evalExpr(node, env, ctx);
        if (value && value.__struct)
        {
            return Object.assign({ __struct: value.__struct }, value);
        }
        return value;
    }
    const obj = makeStruct(ctx, typeName);
    const names = fieldNames(ctx, typeName);
    for (let i = 0; i < names.length && i < node.items.length; i++)
    {
        obj[names[i]] = scalar(yield* evalExpr(node.items[i], env, ctx));
    }
    return obj;
}

function scalar(value)
{
    if (value && value.__float)
    {
        return value.v;
    }
    return value;
}

function* evalExpr(node, env, ctx)
{
    if (!node)
    {
        return 0;
    }
    if (node.line)
    {
        ctx.line = node.line;
    }
    switch (node.kind)
    {
        case "literal":
            if (node.string)
            {
                return node.value;
            }
            if (node.float)
            {
                return asFloat(node.value);
            }
            return node.value;
        case "ident":
            return env.get(node.name);
        case "this":
        {
            const fnScope = findFn(env);
            if (!fnScope || !fnScope.thisObj)
            {
                throw new Error("'this' outside a method at line " + ctx.line);
            }
            return fnScope.thisObj;
        }
        case "paren":
            return yield* evalExpr(node.expr, env, ctx);
        case "brace":
        {
            const items = [];
            for (const item of node.items)
            {
                items.push(yield* evalExpr(item, env, ctx));
            }
            return { __brace: true, items };
        }
        case "unary":
            return yield* evalUnary(node, env, ctx);
        case "postfix":
            return yield* evalPostfix(node, env, ctx);
        case "assign":
        {
            const lv = yield* evalLValue(node.left, env, ctx);
            let value = yield* evalExpr(node.right, env, ctx);
            if (node.op !== "=")
            {
                value = applyBin(node.op.slice(0, -1), lv.get(), value);
            }
            value = assignInto(ctx, lv.get(), value);
            lv.set(value);
            return value;
        }
        case "binary":
        {
            if (node.op === "&&")
            {
                const left = yield* evalExpr(node.left, env, ctx);
                if (!truthy(left))
                {
                    return left;
                }
                return yield* evalExpr(node.right, env, ctx);
            }
            if (node.op === "||")
            {
                const left = yield* evalExpr(node.left, env, ctx);
                if (truthy(left))
                {
                    return left;
                }
                return yield* evalExpr(node.right, env, ctx);
            }
            if (node.op === ",")
            {
                yield* evalExpr(node.left, env, ctx);
                return yield* evalExpr(node.right, env, ctx);
            }
            const left = yield* evalExpr(node.left, env, ctx);
            const right = yield* evalExpr(node.right, env, ctx);
            return applyBin(node.op, left, right);
        }
        case "ternary":
            if (truthy(yield* evalExpr(node.test, env, ctx)))
            {
                return yield* evalExpr(node.yes, env, ctx);
            }
            return yield* evalExpr(node.no, env, ctx);
        case "cast":
            return castValue(node.typeName, yield* evalExpr(node.expr, env, ctx));
        case "sizeof":
            if (node.expr)
            {
                return roughSize(yield* evalExpr(node.expr, env, ctx));
            }
            return 1;
        case "new":
            return yield* construct(node.typeName, node.args, env, ctx);
        case "delete":
            yield* evalExpr(node.expr, env, ctx);
            return 0;
        case "call":
            return yield* evalCall(node, env, ctx);
        case "member":
        {
            const obj = unwrap(yield* evalExpr(node.object, env, ctx));
            return readMember(obj, node.name, ctx);
        }
        case "index":
        {
            const arr = yield* evalExpr(node.object, env, ctx);
            const index = Math.trunc(num(yield* evalExpr(node.index, env, ctx)));
            return readIndex(arr, index, ctx);
        }
        default:
            throw new Error("Bad expression " + node.kind + " at line " + ctx.line);
    }
}

function assignInto(ctx, current, value)
{
    if (value && value.__brace)
    {
        const typeName = current && current.__struct;
        if (!typeName)
        {
            throw new Error("Brace initializer has no struct type at line " + ctx.line);
        }
        return braceToStruct(ctx, typeName, value);
    }
    if (value && value.__struct)
    {
        return Object.assign({ __struct: value.__struct }, value);
    }
    return value;
}

function unwrap(value)
{
    if (value && value.__ptr)
    {
        return value.lv.get();
    }
    return value;
}

function readIndex(arr, index, ctx)
{
    const target = arr && arr.__vector ? arr.items : arr;
    if (!target || typeof target.length !== "number")
    {
        throw new Error("Indexing a non-array at line " + ctx.line);
    }
    if (index < 0 || index >= target.length)
    {
        throw new Error("Index " + index + " out of range " + target.length + " at line " + ctx.line);
    }
    return target[index];
}

function readMember(obj, name, ctx)
{
    if (obj == null)
    {
        throw new Error("Member '" + name + "' on null at line " + ctx.line);
    }
    if (obj.__fields && Object.prototype.hasOwnProperty.call(obj.__fields, name))
    {
        return obj.__fields[name];
    }
    if (obj.__vector)
    {
        return bindVector(obj, name, ctx);
    }
    if (obj.__class && ctx.classes.has(obj.__class))
    {
        const method = lookupMethod(ctx, obj.__class, name);
        if (method)
        {
            return { __userFn: method, __this: obj };
        }
    }
    if (typeof obj[name] === "function")
    {
        return {
            __host: true,
            __this: obj,
            __call: function (_this, args)
            {
                return obj[name].apply(obj, args.map(scalar));
            }
        };
    }
    if (Object.prototype.hasOwnProperty.call(obj, name))
    {
        return obj[name];
    }
    throw new Error("No member '" + name + "' at line " + ctx.line);
}

function bindVector(vec, name, ctx)
{
    return {
        __host: true,
        __this: vec,
        __call: function (_this, args)
        {
            if (name === "push_back")
            {
                let value = args[0];
                if (value && value.__brace)
                {
                    value = braceToStruct(ctx, vec.elemType, value);
                }
                else if (value && value.__struct)
                {
                    value = Object.assign({ __struct: value.__struct }, value);
                }
                vec.items.push(value);
                return 0;
            }
            if (name === "clear")
            {
                vec.items.length = 0;
                return 0;
            }
            if (name === "empty")
            {
                return vec.items.length === 0;
            }
            if (name === "size")
            {
                return vec.items.length;
            }
            if (name === "back")
            {
                return vec.items[vec.items.length - 1];
            }
            if (name === "pop_back")
            {
                vec.items.pop();
                return 0;
            }
            throw new Error("vector has no method " + name);
        }
    };
}

function* evalUnary(node, env, ctx)
{
    if (node.op === "++" || node.op === "--")
    {
        const lv = yield* evalLValue(node.expr, env, ctx);
        const next = num(lv.get()) + (node.op === "++" ? 1 : -1);
        lv.set(next);
        return next;
    }
    if (node.op === "&")
    {
        const lv = yield* evalLValue(node.expr, env, ctx);
        return { __ptr: true, lv };
    }
    const value = yield* evalExpr(node.expr, env, ctx);
    if (node.op === "!")
    {
        return !truthy(value);
    }
    if (node.op === "-")
    {
        return isFloat(value) ? asFloat(-num(value)) : -num(value);
    }
    if (node.op === "+")
    {
        return isFloat(value) ? asFloat(num(value)) : num(value);
    }
    if (node.op === "~")
    {
        return ~num(value);
    }
    if (node.op === "*")
    {
        return unwrap(value);
    }
    throw new Error("Bad unary " + node.op);
}

function* evalPostfix(node, env, ctx)
{
    const lv = yield* evalLValue(node.expr, env, ctx);
    const current = num(lv.get());
    const next = current + (node.op === "++" ? 1 : -1);
    lv.set(next);
    return current;
}

function* evalLValue(node, env, ctx)
{
    if (node.kind === "ident")
    {
        return env.lookupSlot(node.name);
    }
    if (node.kind === "member")
    {
        const obj = unwrap(yield* evalExpr(node.object, env, ctx));
        if (obj && obj.__fields && Object.prototype.hasOwnProperty.call(obj.__fields, node.name))
        {
            return {
                get()
                {
                    return obj.__fields[node.name];
                },
                set(value)
                {
                    obj.__fields[node.name] = value;
                }
            };
        }
        return {
            get()
            {
                return obj[node.name];
            },
            set(value)
            {
                obj[node.name] = value;
            }
        };
    }
    if (node.kind === "index")
    {
        const arr = yield* evalExpr(node.object, env, ctx);
        const index = Math.trunc(num(yield* evalExpr(node.index, env, ctx)));
        const target = arr && arr.__vector ? arr.items : arr;
        if (!target || index < 0 || index >= target.length)
        {
            throw new Error("Bad index lvalue " + index + " at line " + ctx.line);
        }
        return {
            get()
            {
                return target[index];
            },
            set(value)
            {
                target[index] = value;
            }
        };
    }
    if (node.kind === "paren")
    {
        return yield* evalLValue(node.expr, env, ctx);
    }
    throw new Error("Not an lvalue (" + node.kind + ") at line " + ctx.line);
}

function* evalCall(node, env, ctx)
{
    let callee;
    if (node.callee.kind === "member")
    {
        const obj = unwrap(yield* evalExpr(node.callee.object, env, ctx));
        callee = readMember(obj, node.callee.name, ctx);
    }
    else
    {
        callee = yield* evalExpr(node.callee, env, ctx);
    }
    if (!callee)
    {
        throw new Error("Call of null at line " + ctx.line);
    }
    if (callee.__host)
    {
        const args = [];
        for (const arg of node.args)
        {
            args.push(yield* evalExpr(arg, env, ctx));
        }
        return callee.__call(callee.__this, args, ctx);
    }
    if (callee.__userFn)
    {
        return yield* callUser(callee.__userFn, callee.__this, node.args, env, ctx);
    }
    throw new Error("Not a function at line " + ctx.line);
}
