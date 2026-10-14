# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run start` — Vite dev server on `localhost:8000` opening `/demo/`, with parallel `vite build --watch` so the demo loads `dist/widget-sidenav.js`.
- `npm run build` — Production library build via Vite/Rollup to `dist/`.
- `npm run watch` — `vite build --watch` only (no dev server).
- `npm run types` — Regenerate `src/definition-schema.d.ts` from `src/definition-schema.json` using `json2ts` (run after editing the schema).
- `npm run release` — `npm version patch`: preflight guards (on `main`, clean tree, not behind `origin/main`, generated files current, build passes), then the bump and a `dist/` rebuild (the `version` hook, so the local build registers the new tag), then commit, bare-semver tag, `git push --follow-tags`, then waits on the CI run and fails if the npm publish fails. `npm run release:minor` / `release:major` for other bumps.
- `npm run link` / `npm run unlink` — Link/unlink against a sibling `../RESWARM/frontend` checkout for local integration testing.

There is no test runner or linter configured. Node `>=24.9.0` and npm `>=10.0.2` are required (see `engines`).

## Architecture

Single-file Lit 3 web component (`src/widget-sidenav.ts`) packaged as an ES module library for the IronFlock dashboard platform.

### Versioned custom element tag

The element is registered as `widget-sidenav-versionplaceholder`. At build time, `@rollup/plugin-replace` (configured in `vite.config.ts`) substitutes `versionplaceholder` with the version from `package.json` everywhere it appears, producing tags like `widget-sidenav-1.0.14`. Consumers must use the version-suffixed tag (see `demo/index.html`, which reads `package.json` at runtime to build the tag dynamically). This versioning scheme lets multiple widget versions coexist on the same page in IronFlock dashboards.

### Build pipeline

`vite.config.ts` produces an ES library (`dist/widget-sidenav.js`) with `lit`, `@lit/*`, and `@material/web` marked as Rollup `external`. They must be supplied at runtime by the host (typically via an import map). `@material/web` is a peer dependency, not bundled.

### Schema-driven configuration

`src/definition-schema.json` is the source of truth for the widget's `inputData` shape. It is a JSON Schema with extra IronFlock-specific keys (`order`, `dataDrivenDisabled`, rich `description` fields aimed at AI agents/dashboard editors) consumed by the IronFlock dashboard editor to render configuration UI. `src/definition-schema.d.ts` is generated from it via `npm run types` — never edit the `.d.ts` by hand. `src/default-data.json` provides demo data matching the schema.

### Component contract

The component exposes three reactive properties and one event:
- `inputData: SideNavigationConfiguration` — title, route, variables, style, and `navItems[]` per the schema.
- `theme: { theme_name, theme_object }` — falls back behind CSS custom properties `--re-text-color` and `--re-tile-background-color`, which take precedence (resolved in `registerTheme`). These are not snapshotted: `registerTheme()` stores a `var(--re-…, <theme value>)` chain, so a change to the host property repaints the tile live without the widget being told.
- `route: string` — the host's current route. `matchesRoute` highlights an item when the route starts with an absolute item route (`/...`) or ends with / equals a relative one.
- `nav-submit` CustomEvent (bubbles, composed) with `{ path }` — emitted on title/item click for the SPA host to handle navigation.

`resolveRoute` performs two transforms before matching/dispatch: `{{label}}` substitution from `inputData.variables` (URL-encoded), and wildcard segment substitution where `*` in an item route is replaced by the corresponding segment of the current `route`.

### Demo harness

`demo/index.html` is the development entrypoint: it fetches `package.json` to build the versioned tag, loads `dist/widget-sidenav.js`, fetches `src/default-data.json` as `inputData`, and applies a theme from `demo/themes/{light,chalk,vintage}.json`. Material Symbols and fonts are pulled from Google Fonts CDN.

## `aiSelection` in `src/definition-schema.json`

The schema root carries an `aiSelection` block next to `title` and `description`. It is **not** JSON Schema and describes no config field — it exists so the IronFlock AI's Widget Builder can pick the right widget for a given shape of data, using knowledge only the widget author has:

```jsonc
"aiSelection": {
  "dataShape": "…what columns this widget consumes and what each one means…",
  "useWhen":   ["…a situation, naming the properties that express it…"],
  "notFor":    ["…a situation this widget is wrong for, naming the widget to use instead…"]
}
```

It is inert everywhere else, and must stay that way: `json2ts` ignores it (the generated `.d.ts` is byte-identical with and without it), the dashboard config editor renders only `schema.properties`, and the AI service's `validate_widget` validates *configs* against the schema, skipping unknown Draft-7 keywords.

When maintaining it:

- `notFor` is the high-value half and the part plain descriptions always omit. Every entry must name the widget that *should* be used, or it rejects without routing.
- Write for an LLM with no other documentation: describe the visible result and the user's intent, not the implementation.
- Prefer entries that discriminate against a *neighbouring* widget. Generic rejections are cheap; the ones that pay are those an author could plausibly get wrong.
- The `notFor` lists are a set across all `widget-*` repos and are meant to be reciprocal — if this widget routes to another for some case, that widget should usually route back for the converse. Changing one side is a cue to check the other.
- Update it whenever a property changes what this widget can *do*, not just how it looks.
