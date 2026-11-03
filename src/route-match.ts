/**
 * Decides which navigation items are active for the current route.
 *
 * Routes are compared segment by segment, never as strings, so `/ab` does not
 * match `/abc`. Of all items that match, only the most specific ones are active:
 * an item naming the current page beats one naming a section it is in, a deeper
 * section beats a shallower one, and an item that also names the page's query
 * parameters beats one that does not. Two items with the same route are both
 * active.
 *
 * - An absolute item route (`/machines`) matches its own page and every page
 *   below it (`/machines/42`). The board root (`/`) matches only itself, since
 *   every page is below it.
 * - A relative item route (`settings`) matches a page whose path ends with it.
 *   Studio resolves it against the current page (it replaces the last segment),
 *   so it names a page, never a section.
 * - Query parameters in an item route must all be in the current route with the
 *   same value. A parameter with an empty, `undefined` or `null` value, which
 *   Studio removes on navigation, must be missing.
 *
 * Studio passes `route` with its segments URL-encoded and its `?query`, and
 * routes built from variables are encoded, so both sides are decoded segment by
 * segment before comparing.
 */

type ParsedRoute = { segments: string[]; query: URLSearchParams }
type Match = { exact: boolean; depth: number; params: number }

// Studio's nav-submit handler deletes a query parameter given one of these values.
const REMOVED_VALUES = new Set(['', 'undefined', 'null'])

function decodeSegment(segment: string): string {
    try {
        return decodeURIComponent(segment)
    } catch {
        return segment
    }
}

function parseRoute(route: string): ParsedRoute {
    const queryStart = route.indexOf('?')
    const path = queryStart < 0 ? route : route.slice(0, queryStart)
    return {
        segments: path.split('/').filter(Boolean).map(decodeSegment),
        query: new URLSearchParams(queryStart < 0 ? '' : route.slice(queryStart + 1))
    }
}

function matchedParams(item: URLSearchParams, current: URLSearchParams): number | undefined {
    let count = 0
    for (const [key, value] of item) {
        const matches = REMOVED_VALUES.has(value) ? !current.has(key) : current.get(key) === value
        if (!matches) return undefined
        count++
    }
    return count
}

function matchRoute(itemRoute: string, current: ParsedRoute): Match | undefined {
    const item = parseRoute(itemRoute)
    const params = matchedParams(item.query, current.query)
    if (params === undefined) return undefined

    const depth = item.segments.length
    // A route without a path names the board root. Every page is below the
    // root, so it would otherwise be active everywhere.
    if (depth === 0 && current.segments.length > 0) return undefined

    const offset = itemRoute.startsWith('/') ? 0 : current.segments.length - depth
    if (offset < 0) return undefined
    if (item.segments.some((segment, i) => segment !== current.segments[offset + i])) return undefined

    return { exact: offset + depth === current.segments.length, depth, params }
}

function compareMatches(a: Match, b: Match): number {
    return Number(a.exact) - Number(b.exact) || a.depth - b.depth || a.params - b.params
}

/**
 * For each item route, whether that item is active on `route`. An item without
 * a route is never active. Outside a board `route` is undefined and counts as
 * the board root.
 */
export function activeItems(itemRoutes: readonly (string | undefined)[], route?: string): boolean[] {
    const current = parseRoute(String(route ?? ''))
    const matches = itemRoutes.map((itemRoute) =>
        itemRoute ? matchRoute(String(itemRoute), current) : undefined
    )
    let best: Match | undefined
    for (const match of matches) {
        if (match && (!best || compareMatches(match, best) > 0)) best = match
    }
    return matches.map((match) => !!match && !!best && compareMatches(match, best) === 0)
}
