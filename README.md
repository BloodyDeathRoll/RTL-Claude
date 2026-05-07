# Claude RTL Fix

A browser extension that fixes Hebrew, Arabic, and other RTL text rendering on **claude.ai**.

It works by walking each message and setting `dir="auto"` on every text-bearing block (`<p>`, `<li>`, `<h1..h6>`, `<blockquote>`, etc.). The browser's built-in Unicode bidi algorithm then picks the correct direction for each block based on the first strong-directional character. Code blocks (`<pre>`, `<code>`, `<kbd>`, `<samp>`, `<var>`) are forced to `dir="ltr"` so code, file paths, and shell commands stay correctly oriented even inside an otherwise-Hebrew message.

A `MutationObserver` re-applies the fix as Claude streams new tokens in, so it works during live response generation — not just on already-rendered content.

## What's in the box

- `claude-rtl-fix-chrome.zip` — load into any Chromium browser (Chrome, Edge, Brave, Arc, Opera, Vivaldi)
- `claude-rtl-fix-firefox.zip` — load into Firefox
- `chrome/` and `firefox/` — unpacked source folders if you'd rather load them directly

## Install — Chrome / Edge / Brave / any Chromium

1. Unzip `claude-rtl-fix-chrome.zip` somewhere permanent (the folder needs to stay where it is — Chrome reads from disk).
2. Open `chrome://extensions` (or `edge://extensions`, `brave://extensions`, etc.).
3. Toggle **Developer mode** on (top right).
4. Click **Load unpacked** and select the unzipped folder.
5. The aleph icon (א) appears in your toolbar. Click it to toggle on/off — when off, the badge shows `OFF`.

## Install — Firefox

There are two paths depending on whether you want it to survive a browser restart.

**Path A — sideload via `about:debugging` (does NOT survive restart, but is one-click):**

1. Unzip `claude-rtl-fix-firefox.zip`.
2. Open `about:debugging#/runtime/this-firefox`.
3. Click **Load Temporary Add-on…** and select the `manifest.json` inside the unzipped folder.
4. Done. Note: temporary add-ons are removed when Firefox restarts — you'll need to reload it next session.

**Path B — Firefox Developer Edition / Nightly / Unbranded (survives restart):**

These builds allow unsigned extensions if you flip a flag.

1. Open `about:config` and set `xpinstall.signatures.required` to `false`.
2. Open `about:addons`, click the gear icon → **Install Add-on From File…**, select `claude-rtl-fix-firefox.zip`.

Regular release Firefox **requires signed extensions** for permanent install. To get a signed `.xpi` you'd need to submit it to addons.mozilla.org for review, which I haven't done. Path A is the practical option for release Firefox.

## Toggling

Click the toolbar icon. Badge shows `OFF` when disabled, blank when enabled. The setting persists across page loads and browser restarts.

When you toggle **off**, the extension removes the `dir` attributes it added, restoring the page's default LTR rendering immediately — no reload needed.

## How it works (technical)

```
content.js
  ├─ TEXT_BLOCK_SELECTORS  → set dir="auto" (browser bidi decides per block)
  ├─ CODE_SELECTORS        → set dir="ltr"  (code is always LTR)
  └─ MutationObserver      → re-apply on streaming token append
                              (childList + characterData + subtree)

background.js
  └─ on icon click → flip storage flag → content script reacts via storage.onChanged
```

The content script is idempotent — it marks elements with `data-rtl-fix-applied` so it doesn't re-process them on every mutation.

`dir="auto"` is the right primitive here because it handles **mixed-language messages correctly**. A response that has an English paragraph, then a Hebrew paragraph, then code, then more Hebrew — each block gets its own direction without you having to detect anything.

## Why this is needed

Claude.ai's web UI doesn't set `dir="auto"` on message content, so Hebrew text renders left-to-right by default. Punctuation lands in the wrong place, line wrapping breaks awkwardly, and parenthetical/quoted phrases come out backwards. Setting `direction: rtl` alone is not enough — you also need `text-align: right` for the text to actually align to the correct margin. `dir="auto"` gives you both behaviors in one attribute, applied per block.

## File layout

```
claude-rtl-fix/
├── chrome/                  ← Manifest V3 build
│   ├── manifest.json
│   ├── content.js
│   ├── background.js
│   └── icon-{16,32,48,128}.png
├── firefox/                 ← Manifest V2 build
│   └── (same files)
├── shared/                  ← source of truth for content.js + background.js
├── icons/                   ← source PNGs
└── make_icons.py            ← icon generator
```

## License

MIT — do whatever you want.
