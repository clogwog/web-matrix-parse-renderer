export function createClock(startMs)
{
    let frozen = startMs == null ? null : startMs;

    return {
        now()
        {
            if (frozen == null)
            {
                return Date.now();
            }
            return frozen;
        },

        set(ms)
        {
            frozen = ms;
        },

        advance(ms)
        {
            if (frozen == null)
            {
                frozen = Date.now();
            }
            frozen += ms;
        },

        isFrozen()
        {
            return frozen != null;
        }
    };
}

export function localParts(ms)
{
    const date = new Date(ms);
    return {
        sec: date.getSeconds(),
        min: date.getMinutes(),
        hour: date.getHours(),
        mday: date.getDate(),
        mon: date.getMonth(),
        year: date.getFullYear() - 1900,
        wday: date.getDay()
    };
}
