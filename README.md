# Claude RTL Fix

A browser extension that fixes Hebrew, Arabic, and other right-to-left (RTL) text rendering on **claude.ai**.

Claude.ai's web UI doesn't set the correct text direction on message content, so RTL scripts render with broken alignment, misplaced punctuation, and reversed parentheticals. This extension fixes that.

![Claude RTL Fix icon](icons/icon-128.png)

## What it does

- **Each text block decides its own direction.** Paragraphs, list items, headings, blockquotes, and table cells get `dir="auto"` so the browser's built-in Unicode bidi algorithm picks the correct direction based on the first strong-directional character. Hebrew paragraphs align right; English paragraphs in the same response align left.
- **Lists work correctly for mixed-direction content.** A bulleted list with both Hebrew and English items renders each item's bullet on its own start side — right for Hebrew, left for English — and right-pads the list so the bullets sit properly inside the message bubble instead of overflowing to the page edge.
- **Code blocks stay LTR.** Source code, shell commands, file paths, and inline code are explicitly kept left-to-right so they stay correctly oriented even inside an otherwise-Hebrew message.
- **Streaming works.** A `MutationObserver` re-applies the fix as Claude streams new tokens in, so live response generation renders correctly from the first token.
- **Toggleable.** Click the toolbar icon to turn the fix on/off. The setting persists across pages and browser restarts. When off, the extension removes the changes it made and the page reverts to default rendering immediately.

## Install

The extension is being submitted to the browser stores. While that's in progress, you can install it manually:

### Chrome / Brave / Edge / Arc / Vivaldi / Opera (any Chromium browser)

1. Download `claude-rtl-fix-chrome.zip` from the [Releases](../../releases) page (or zip the `chrome/` folder yourself).
2. Unzip it somewhere permanent — the folder needs to stay where it is.
3. Open `chrome://extensions` (or `edge://extensions`, `brave://extensions`, etc.)
4. Toggle **Developer mode** on (top right)
5. Click **Load unpacked** and select the unzipped folder
6. The aleph (א) icon appears in your toolbar. Click it to toggle on/off.

### Firefox

Release Firefox requires signed extensions, so for permanent install you'll need to wait for the official AMO listing. In the meantime:

**Temporary install (lost on restart):**
1. Download `claude-rtl-fix-firefox.zip` from the Releases page
2. Unzip it
3. Open `about:debugging#/runtime/this-firefox`
4. Click **Load Temporary Add-on…** and select `manifest.json` inside the unzipped folder

**Permanent install (Firefox Developer Edition / Nightly):**
1. In `about:config`, set `xpinstall.signatures.required` to `false`
2. Open `about:addons` → gear icon → **Install Add-on From File…** → select the zip

## How it works

The technical details:

```
content.js
  ├─ Pass 1 — Per-block direction
  │     Set dir="auto" on text-bearing elements (p, li, h1-h6,
  │     blockquote, td, th, dd, dt, etc). Browser bidi handles direction.
  │     Code elements (pre, code, kbd, samp, var) → dir="ltr".
  │
  ├─ Pass 2 — Container direction (debounced 150ms)
  │     For lists: detect direction by regex-testing children's
  │     textContent (avoids getComputedStyle layout thrashing).
  │     For tables/blockquotes: explicit dir="rtl" when content is RTL.
  │
  ├─ CSS injection
  │     padding-right: 2.8rem on lists so RTL bullets have room to sit.
  │     text-align: start on items so each aligns to its own direction.
  │     border-inline-start on blockquotes.
  │     unicode-bidi: isolate on inline code in RTL paragraphs.
  │
  └─ MutationObserver
        Re-applies on streaming token append. Work is chunked across
        animation frames so it never triggers the slow-script warning.

background.js
  └─ on icon click → flip storage flag → content script reacts
```

Direction detection uses regex against textContent (looking for the first strong-directional character in Hebrew, Arabic, Syriac, Thaana, NKo, Samaritan, Mandaic, or Arabic Presentation Forms ranges) rather than `getComputedStyle`, which would force a synchronous layout recalc on every check.

The container scan is debounced by 150ms so streaming bursts don't cause direction flicker as partial tokens arrive. Once a list resolves to RTL, the direction is sticky — it only reverts to LTR if children become strongly LTR (≥75%).

## Folder layout

```
claude-rtl-fix/
├── chrome/                  Manifest V3 build for Chromium browsers
│   ├── manifest.json
│   ├── content.js
│   ├── background.js
│   └── icon-{16,32,48,128}.png
├── firefox/                 Manifest V3 build for Firefox
│   └── (same files, plus browser_specific_settings in manifest)
├── shared/                  Source of truth for content.js + background.js
│   ├── content.js
│   └── background.js
├── icons/                   Source PNGs at extension sizes
├── store-assets/            Promo tiles + large icons for store listings
├── docs/                    Publishing guides
├── make_icons.py            Generate the four extension icon sizes
└── make_store_icons.py      Generate store promo tiles + large icons
```

## Development

The actual code lives in `shared/`. The `chrome/` and `firefox/` folders are build outputs — they contain copies of `shared/content.js` and `shared/background.js` along with their respective `manifest.json` files.

To make a change:

1. Edit `shared/content.js` (and/or `shared/background.js`)
2. Copy to both builds:
   ```bash
   cp shared/content.js shared/background.js chrome/
   cp shared/content.js shared/background.js firefox/
   ```
3. Bump the `version` in both `chrome/manifest.json` and `firefox/manifest.json`
4. Reload the unpacked extension in your browser to test

To package for distribution:

```bash
cd chrome && zip -r ../claude-rtl-fix-chrome.zip . && cd ..
cd firefox && zip -r ../claude-rtl-fix-firefox.zip . && cd ..
```

## Contributing

Issues and PRs welcome. If you find an RTL rendering problem on Claude.ai that the extension doesn't fix:

1. Open the browser inspector on the misbehaving element
2. Take a screenshot of the **Rules** panel and the **Layout** (box model) panel
3. Open an issue with the screenshots and a description of what's wrong

For new RTL languages or scripts: the regex ranges in `shared/content.js` (the `RTL_REGEX` constant) define which Unicode characters trigger RTL detection. If your script isn't covered, send a PR adding its range.

## License

[MIT](LICENSE) — do whatever you want.

## Acknowledgments

Built because Anthropic hasn't shipped proper RTL support for Claude.ai's web UI. If they ever do, this extension becomes unnecessary, which would be the best outcome. Until then.
