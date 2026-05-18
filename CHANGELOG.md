# Changelog

All notable changes to Claude RTL Fix will be documented in this file.

## [1.5.5] — Current

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
