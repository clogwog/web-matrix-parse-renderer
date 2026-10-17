export function projectIdFromQuery(search, knownIds)
{
    const params = new URLSearchParams(search || "");
    if (!params.has("project"))
    {
        return null;
    }
    const raw = params.get("project");
    if (raw == null)
    {
        return null;
    }
    const id = raw.trim();
    if (!id)
    {
        return null;
    }
    const ids = knownIds || [];
    for (let i = 0; i < ids.length; i++)
    {
        if (ids[i] === id)
        {
            return id;
        }
    }
    return null;
}

export function resolveProjectId(search, knownIds)
{
    const ids = knownIds || [];
    const chosen = projectIdFromQuery(search, ids);
    if (chosen)
    {
        return chosen;
    }
    return ids.length ? ids[0] : null;
}

export function locationWithProject(loc, id)
{
    const params = new URLSearchParams(loc.search || "");
    params.set("project", id);
    const query = params.toString();
    const path = loc.pathname || "";
    const hash = loc.hash || "";
    return path + (query ? "?" + query : "") + hash;
}
