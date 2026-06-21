# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A browser extension (Chrome/Chromium + Firefox, Manifest V3) that fixes RTL text rendering on **claude.ai**. There is no build system, package manager, or test suite — it's plain vanilla JS injected as a content script. "Building" means copying source files between folders and zipping.

## Source of truth and the copy-to-build workflow

`shared/content.js` and `shared/background.js` are the **only** files you edit. The `chrome/` and `firefox/` folders are build outputs that contain *copies* of those two files plus their own browser-specific `manifest.json` (which are NOT copied — they differ and must each be edited in place).

After editing either shared file, propagate to both builds:

```bash
cp shared/content.js shared/background.js chrome/
cp shared/content.js shared/background.js firefox/
```

`content.js`, `background.js` are byte-identical across `shared/`, `chrome/`, and `firefox/`. If `diff` shows them differing, the copy step was skipped — that's a bug, not a feature.

### Manifest differences (edit each in place, never cross-copy)

- `chrome/manifest.json` uses `"background": { "service_worker": "background.js" }`.
- `firefox/manifest.json` uses `"background": { "scripts": ["background.js"] }` and adds a `browser_specific_settings.gecko` block (extension id, `strict_min_version`, data-collection declaration).
- The `version` field must be bumped in **both** manifests together for a release.

## Releasing

1. Bump `version` in both manifests (and the `vX.Y.Z` comment at the top of `shared/content.js`).
2. Copy shared files to both build folders (above).
3. Package:
   ```bash
   cd chrome && zip -r ../claude-rtl-fix-chrome-X.Y.Z.zip . && cd ..
   cd firefox && zip -r ../claude-rtl-fix-firefox-X.Y.Z.zip . && cd ..
   ```
4. Update `CHANGELOG.md`.

Store submission specifics live in `docs/PUBLISHING_GUIDE.md` and `docs/AMO_SUBMISSION_GUIDE.md`.

## Testing changes

There is no automated test harness — verify in a real browser against claude.ai.

- **Firefox** (preferred per project workflow): `about:debugging#/runtime/this-firefox` → **Load Temporary Add-on…** → select `firefox/manifest.json`. Reload the temporary add-on after each edit+copy. Do not rely on zips or signing for the dev loop.
- **Chrome**: `chrome://extensions` → Developer mode → **Load unpacked** → select `chrome/`. Click reload after each edit+copy.

## Icons

`make_icons.py` (extension sizes) and `make_store_icons.py` (store promo tiles) regenerate the PNGs via Pillow. Note their hardcoded `OUT` paths point at `/home/claude/...` and predate this repo layout — they generate assets but won't write to the right folders without path edits. Icons rarely change; treat these as one-off generators, not part of the normal loop.

## Architecture of `shared/content.js`

The whole extension is one IIFE. It does two conceptually separate things that share infrastructure:

### 1. Response rendering fix (the core feature)

Two passes, both reading direction via the `RTL_REGEX` / `LTR_REGEX` character-range tests against `textContent` — **never** `getComputedStyle` (which forces synchronous layout recalc in a loop and trips Firefox's slow-script warning).

- **Pass 1 (per-block, sync or chunked):** sets `dir="auto"` on text-bearing blocks (`p, li, h1–h6, blockquote, td, th, dd, dt, …`) and `dir="ltr"` on code elements (`pre, code, kbd, samp, var`). The browser's bidi algorithm resolves each block independently.
- **Pass 2 (container, debounced 150ms):** For **lists** sets `dir="auto"` on the `<ul>/<ol>/<dl>` (NOT `dir="rtl"` — `auto` lets each `<li>` place its own bullet on its own start side, which is what makes mixed-direction lists work). For **tables** and **blockquotes** sets explicit `dir="rtl"` because their layout needs one direction for the whole container. Table/blockquote direction is **sticky**: once RTL, only reverts to LTR on a ≥75% strong-LTR majority, to avoid flicker mid-stream.

Marker attributes (`data-rtl-fix-applied`, `data-rtl-fix-container`) make passes idempotent and make teardown possible.

### 2. Composer input-direction toggle (EN | HE switch)

A separate, **manual** two-state control injected into the composer toolbar — deliberately NOT auto-detection (auto would flip direction mid-sentence as you type). It works by setting `data-claude-input-dir="he"` on `<html>` and relying on an injected stylesheet keyed off that attribute. Inline styles on the editor itself don't work: the composer is a ProseMirror contenteditable that strips inline styles on re-render, so the attribute-on-a-stable-ancestor + stylesheet approach is the only reliable lever. `COMPOSER_SELECTOR` (`div.ProseMirror[contenteditable="true"]`) is the single source of truth for both the CSS rule and the button-injection anchor.

### Shared infrastructure

- **MutationObserver** on `document.body` re-applies both features as Claude streams tokens and as the composer is torn down/swapped on navigation. Work is chunked across `requestIdleCallback`/`requestAnimationFrame` (`processInChunks`, `CHUNK_SIZE = 150`) so long DOM sweeps never block.
- **CSS injection** uses `!important` and logical properties (`padding-inline-start`, `border-inline-start`) deliberately — we're patching a third-party Tailwind site whose specificity we don't control.
- **Cross-browser storage** is shimmed (`browser.storage` vs `chrome.storage`). State: `claude-rtl-fix-enabled` (master on/off, toggled by the toolbar icon via `background.js`) and `claude-rtl-fix-input-dir` (`en`/`he`). `storage.onChanged` keeps tabs in sync.
- Turning the master flag off (`setEnabled(false)`) fully reverses everything: removes all `dir` attributes/markers, the injected styles, the composer button, and the input-dir attribute.

`background.js` is minimal: on toolbar-icon click it flips `claude-rtl-fix-enabled` and updates the icon badge/title. The content script reacts via `storage.onChanged`.

## Adding RTL language support

The `RTL_REGEX` constant in `shared/content.js` defines which Unicode ranges trigger RTL detection (currently Hebrew, Arabic, Syriac, Thaana, NKo, Samaritan, Mandaic, Arabic Presentation Forms). Add a script by extending that range — then copy to both builds.

## Selectors are brittle by nature

This extension patches a site it doesn't own. `COMPOSER_SELECTOR`, the `+`/send-button anchors in `injectInputDirButton`, and the text/container/code selector lists all depend on claude.ai's current DOM. If a feature stops landing in the right place, the first suspect is a claude.ai markup change — confirm in DevTools and update the relevant constant.
