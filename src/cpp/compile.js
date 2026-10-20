import { lex } from "./lexer.js?v=20261024";
import { expandMacros, preprocess } from "./preprocessor.js?v=20261024";
import { parseTokens, seedTypes } from "./parser.js?v=20261024";
import { linkProgram } from "./interpreter.js?v=20261024";

export function compileSources(fileMap, entries)
{
    const known = seedTypes();
    const units = [];
    for (const entry of entries)
    {
        const pre = preprocess(entry, fileMap);
        let tokens = lex(pre.source, entry, pre.lineMap);
        tokens = expandMacros(tokens, pre.macros, lex);
        const parsed = parseTokens(tokens, known);
        units.push({
            entry,
            decls: parsed.decls,
            source: pre.source
        });
    }
    const program = linkProgram(units);
    program.units = units;
    return program;
}
