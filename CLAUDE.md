# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run start` — Vite dev server on `localhost:8000` opening `/demo/`, with parallel `vite build --watch` so the demo loads `dist/widget-sidenav.js`.
- `npm run build` — Production library build via Vite/Rollup to `dist/`.
- `npm run watch` — `vite build --watch` only (no dev server).
- `npm run types` — Regenerate `src/definition-schema.d.ts` from `src/definition-schema.json` using `json2ts` (run after editing the schema).
- `just lint` — what the CI gate checks besides the build: regenerating the committed generated files (`npm run types`) changes nothing. `just build` = `npm run build`.
- `just merge` / `just release-patch` (`release-minor`, `release-major`) — pull requests into `main` from a feature branch with everything committed: a no-release one, or a release one whose merge publishes to npm in CI (`.github/workflows/build-publish.yml`), then the release GitHub App tags the bare version and creates the GitHub release. Never `npm publish`, tag or edit the version by hand.
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
- `theme: { theme_name, theme_object }` — falls back behind the CSS custom property `--re-text-color`, which takes precedence (resolved in `registerTheme`). These are not snapshotted: `registerTheme()` stores a `var(--re-…, <theme value>)` chain, so a change to the host property repaints the tile live without the widget being told. The widget paints no tile background of its own, only an explicitly configured `style.backgroundColor`: studio's `widget-item` already paints `--re-tile-background-color` on the tile, and painting it again here composited a translucent tile colour twice.
- `route: string` — the host's current route. `matchesRoute` highlights an item when the route starts with an absolute item route (`/...`) or ends with / equals a relative one.
- `nav-submit` CustomEvent (bubbles, composed) with `{ path }` — emitted on title/item click for the SPA host to handle navigation.

`resolveRoute` performs two transforms before matching/dispatch: `{{label}}` substitution from `inputData.variables` (URL-encoded), and wildcard segment substitution where `*` in an item route is replaced by the corresponding segment of the current `route`.

### Demo harness

`demo/index.html` is the development entrypoint: it fetches `package.json` to build the versioned tag, loads `dist/widget-sidenav.js`, fetches `src/default-data.json` as `inputData`, and applies a theme from `demo/themes/{light,chalk,vintage}.json`. Material Symbols and fonts are pulled from Google Fonts CDN.

### Icon names (`src/icon-names.ts`)

`iconName` can be bound to data, so the widget draws an icon only for a value the icon font draws as one. Anything else (an unknown name, a number, `null`, text with spaces) shows no icon rather than the raw word. `IconNames.name()` decides by measuring on a canvas. Material Symbols turns a name it knows, in any letter case, into one ligature glyph one em wide, and other text keeps one glyph per character, each also one em wide in this font. So a value is a name when it measures one em and narrower than its characters measured one at a time. In Chromium and Firefox that accepted all 3,873 names of material-symbols 0.44.6 and rejected near misses such as `homee`, `hom` and `tv_`. Measuring asks the font Studio actually loads, where a list of names would go stale as Google adds icons. Verdicts are cached per name, capped at 1000 because bound values can be anything.

Nothing is drawn until the font has loaded, and Studio swaps the font's stylesheet in from a preload, so a widget can render before it exists. Until then `probe()` renders a hidden word in the icon font, and `loadingdone` on `document.fonts` renders the widget again. Keep the probe: the browser loads a font face only when something uses it, and without the probe a page where nothing else uses the icon font never shows the icons. The same file is in widget-sidenav, widget-navbar and widget-navbutton; change them together.

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

## `layout` in `src/definition-schema.json`

The schema root also carries `"layout": {"fixedWidth": true, "width": 184}`: the widget keeps a fixed width of about 184 px, because a menu has the width of its labels, not a share of the screen. Like `aiSelection` it is not JSON Schema and describes no config field. Studio sets `fixedWidth` and the matching grid size when the widget is dropped onto a board, the IronFlock AI does the same when it places the widget, and the ironflock-templates validator warns about a board position without `fixedWidth`. Change `width` when the widget's natural width changes.
