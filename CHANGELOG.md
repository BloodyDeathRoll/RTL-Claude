# Changelog

All notable changes to Claude RTL Fix will be documented in this file.

## [1.6.1] — Current

Two RTL-detection fixes for content that *starts* with a Latin token but is predominantly Hebrew:

- **Fenced code blocks.** Block code was unconditionally forced to `dir="ltr"`, so a fenced block containing Hebrew prose/pseudo-code rendered left-to-right and left-aligned. Block code (`<pre>` and the `<code>` inside it) now follows its actual content direction via `codeDir()`: strongly-RTL content gets `dir="rtl"`, while genuine source code (overwhelmingly ASCII) still resolves to LTR. Inline code in prose (file paths, identifiers — not inside a `<pre>`) is unchanged and stays LTR-isolated. The accompanying CSS rule sets both `direction: rtl !important` and `text-align: right !important` together, since Claude.ai's Tailwind hard-codes a physical text-align that direction alone won't override.

- **List items.** List direction relied on `dir="auto"`, which keys off the *first* strong character — so a Hebrew item opening with a Latin token (e.g. `[Unverified] …`, `**Excel** …`) resolved LTR and rendered with its bullet/number on the left. Direction is now decided by `detectDominantDirection()` (majority of strong characters) and set explicitly on each item, so a predominantly-Hebrew item flips RTL regardless of its first word. Each item keeps its own direction, so a minority LTR item inside an otherwise-RTL list still gets its marker on the left. The same dominant-direction detection now also drives table-cell and blockquote direction.

Two supporting fixes were needed to make the list change actually take effect on live pages:

- **Container re-scan on streamed content.** claude.ai inserts an `<ol>`/`<table>` *before* its rows/items stream in, so the container's direction was judged once while empty and never re-checked. Any change now also re-queues its nearest ancestor container for a direction re-scan.
- **Debounce ceiling.** The container scan was debounced and reset on every mutation; because claude.ai mutates continuously, the scan could be starved indefinitely and never run. A `CONTAINER_MAX_WAIT_MS` ceiling now forces the scan even while mutations keep arriving.
- **Block-level re-scan.** Direction re-evaluation was extended from list/table/blockquote containers to standalone text blocks (paragraphs, headings, cells), so a Latin-prefixed Hebrew paragraph like `[Certain] …` no longer stays LTR.

The EN/HE toggle is now the source of truth for **rendering**, not just the composer. In **HE** mode every prose block is forced RTL via `resolveDir()` — no character counting — so headings that are mostly Latin by character but semantically Hebrew (e.g. `לגבי Claude for Work / Legal Skill:`) render correctly; embedded English runs still lay out LTR within the line via the Unicode bidi algorithm. Code is exempt and stays LTR. **EN** mode keeps the existing auto-detection. Flipping the toggle re-judges all on-screen content live and syncs across tabs.

## [1.6.0]

Added an **EN/HE input-direction toggle** to the message composer. A small button in the composer's control row cycles between two explicit states: **EN** (default, unchanged LTR) and **HE** (the composer renders right-to-left and right-aligned). This is a deliberate two-state toggle rather than auto-detection — `dir="auto"` on the editor flips direction mid-sentence as the first strong character changes while you type, which is jarring for a live input field.

Implementation notes: the direction is applied via a CSS rule keyed off `data-claude-input-dir="he"` on `<html>`, not inline styles on the editor — the composer is a framework-managed (ProseMirror) contenteditable that strips inline styles on re-render. The rule sets both `direction: rtl !important` and `text-align: right !important` because Claude.ai hard-codes a physical `text-align: left` via Tailwind, so direction alone won't right-align. A single `:is()` selector list covers both the new-chat landing composer and the in-thread composer. The choice persists in `chrome.storage.local`, restores on load, and reacts to `storage.onChanged` — mirroring the master on/off toggle. The button is re-injected via the existing `MutationObserver` since the composer can be torn down and swapped, and it respects the master on/off (when the extension is off, the toggle, its styles, and the `<html>` attribute are all removed).

## [1.5.5]

The `<ul>`/`<ol>`/`<dl>` containers now get `padding-right: 2.8rem` so RTL bullets/numbers have room to sit inside the message bubble instead of overflowing to its outer edge. Identified via DevTools inspection — Claude.ai's text blocks use `padding-right: 2rem` and lists use `padding-right: 1.5rem`, leaving no room for the marker to occupy.

## [1.5.4 → 1.5.0]

Iterations on the mixed-direction list layout. Tried per-item physical padding (1.5.4), `:has()` selectors targeting the list via children's marker attribute (1.5.3), symmetric physical padding on both `<ul>` and `<li>` (1.5.2), `list-style-position: inside` (1.5.1), and switching the `<ul>` to `dir="auto"` so each `<li>` independently picks bullet side (1.5.0). The final answer turned out to be specificity- and width-related, not bidi-related.

## [1.4.0 → 1.4.1]

Debounced the container direction scan by 150ms to prevent flicker as streaming tokens arrive (a partial item's first character may be neutral or LTR before its Hebrew content lands). Made the direction decision sticky-RTL so brief LTR-looking content doesn't cause flips. CSS bumped to `!important` to override Claude.ai's Tailwind utility classes.

## [1.3.0]

Eliminated `getComputedStyle` from the container pass. Reading computed style after DOM writes forced synchronous layout recalc, which triggered Firefox's slow-script warning even with chunking. Replaced with regex-based direction detection against `textContent` — pure JS, never touches layout, and is what `dir="auto"` does internally anyway.

## [1.2.0]

Chunked all bulk DOM passes (initial scan, toggle on/off, large mutation batches) into batches of 100 elements per animation frame to prevent the main thread from being blocked. Added targeted container rescan via a `dirtyContainers` Set instead of whole-document scans on every mutation.

## [1.1.0]

Added the two-pass approach: per-block direction (set `dir="auto"` on text-bearing elements) plus container direction (propagate to `<ul>`/`<ol>`/`<table>`/`<blockquote>` so list bullets, table column flow, and blockquote borders flip too). Injected CSS for proper marker positioning and inline code isolation.

## [1.0.0]

Initial release. Single-pass `dir="auto"` on text-bearing elements, `dir="ltr"` on code elements, `MutationObserver` for streaming responses, toolbar icon toggle, cross-browser (Chrome MV3 / Firefox MV2 at the time).
