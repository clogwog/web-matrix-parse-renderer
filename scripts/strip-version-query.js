// Node resolves import specifiers as filenames. Browsers treat "?v=" as a
// cache key and still load the file. Drop the query before Node resolves.

export async function resolve(specifier, context, nextResolve)
{
    const cut = specifier.indexOf("?");
    if (cut !== -1)
    {
        return nextResolve(specifier.slice(0, cut), context);
    }
    return nextResolve(specifier, context);
}
