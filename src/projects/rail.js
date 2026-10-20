// Square project icons follow one path around the LED panel: down the left
// side, across the bottom, then up the right side when the first two edges
// are full. A short list stays packed from the top-left and does not stretch.
export const PROJECT_TILE = 80;
export const PROJECT_TILE_GAP = 12;

export function placeProjectTiles(count, panel, tile, gap)
{
    const pitch = tile + gap;
    const leftSlots = Math.max(1, Math.round(panel / pitch));
    const bottomSlots = Math.max(1, Math.floor((panel + gap) / pitch));
    const places = [];
    const leftCount = Math.min(count, leftSlots);
    const stretchLeft = leftCount === leftSlots && leftSlots > 1;
    const leftStep = stretchLeft ? (panel - tile) / (leftSlots - 1) : pitch;

    for (let index = 0; index < count; index++)
    {
        if (index < leftSlots)
        {
            places.push({
                edge: "left",
                x: 0,
                y: Math.round(index * leftStep)
            });
            continue;
        }
        const bottomIndex = index - leftSlots;
        if (bottomIndex < bottomSlots)
        {
            places.push({
                edge: "bottom",
                x: (bottomIndex + 1) * pitch,
                y: panel + gap
            });
            continue;
        }
        const rightIndex = bottomIndex - bottomSlots;
        places.push({
            edge: "right",
            x: tile + gap + panel + gap,
            y: panel - tile - rightIndex * pitch
        });
    }

    let shift = 0;
    for (const place of places)
    {
        if (place.y < shift)
        {
            shift = place.y;
        }
    }
    if (shift < 0)
    {
        for (const place of places)
        {
            place.y -= shift;
        }
        shift = -shift;
    }
    else
    {
        shift = 0;
    }

    return {
        places: places,
        leftSlots: leftSlots,
        bottomSlots: bottomSlots,
        hasBottom: count > leftSlots,
        hasRight: count > leftSlots + bottomSlots,
        panelX: tile + gap,
        panelY: shift
    };
}
