# Submitting Claude RTL Fix to addons.mozilla.org

This guide takes you from "I have the zip" to "it's live on AMO." Allow ~30 minutes for the first submission.

---

## Step 1 — Create your AMO account (5 min)

1. Go to **https://addons.mozilla.org/developers/**
2. Click **Log in**. If you have a Firefox/Mozilla account already, use it. If not, register — any email works.
3. After logging in, you'll be at the **Add-on Developer Hub**.

There's nothing else to set up account-wise. No payment, no business verification.

---

## Step 2 — Submit the add-on (10 min)

1. From the Developer Hub, click **Submit Your First Add-on** (or "Submit a New Add-on" if you've done this before).
2. Choose **"On this site"** when asked where to host. (The other option is "On your own" / unlisted, which you don't want — that's just signing without listing.)
3. Click **Continue**.
4. On the upload page, click **Select a file** and pick `claude-rtl-fix-firefox.zip`.
5. Wait for the validator. It runs in 5–30 seconds. You should get a green "passed all checks" or a yellow warning. Yellow warnings are usually fine to proceed with; red errors block submission.
6. When prompted, confirm whether the extension's **source code is reviewable as-is** — answer **Yes**. (Your code is plain JS, no minification, no bundler. This skips the "upload separate source package" step.)
7. Click **Continue**.

---

## Step 3 — Fill in the listing (10 min)

This is the part with the most fields. Paste-ready copy for each:

### Name
```
Claude RTL Fix
```

### Add-on URL (auto-suggested as `claude-rtl-fix`)
Leave the auto-suggestion. Don't fight it.

### Summary (max 250 chars)
```
Fixes Hebrew, Arabic, and other right-to-left text rendering on claude.ai. Each paragraph picks the correct direction automatically; code blocks stay LTR. Click the toolbar icon to toggle on or off.
```

### Description (longer, supports basic Markdown)
```
Claude.ai does not set the correct text direction on message content, so Hebrew, Arabic, Farsi, and other right-to-left scripts render with broken alignment, misplaced punctuation, and reversed parentheticals. This extension fixes that.

How it works:

- Each block of text in a Claude message (paragraphs, list items, headings, blockquotes, table cells) is given the standard HTML attribute dir="auto", which lets the browser's built-in Unicode bidi algorithm pick the correct direction based on the first strong-directional character in the block.
- This handles mixed-language messages correctly. An English paragraph followed by a Hebrew paragraph followed by code will each render with the right direction, automatically.
- Code blocks (pre, code, kbd, samp, var) are explicitly forced to dir="ltr", so file paths, shell commands, and source code stay correctly oriented even inside an otherwise right-to-left message.
- A MutationObserver re-applies the fix as Claude streams new tokens in, so it works during live response generation, not just on already-rendered content.

Click the toolbar icon to toggle the extension on or off. The setting persists across page loads. When toggled off, all changes are reverted immediately without needing a reload.

Privacy: this extension does not collect, transmit, or store any data. It only reads the DOM of pages on claude.ai and adds standard HTML direction attributes. No network requests, no analytics, no telemetry.

Source code: see the support site link.
```

### Categories (pick up to 2)
- **Appearance** (primary)
- **Web Development** (secondary, optional)

### Tags
```
hebrew, arabic, rtl, claude, accessibility, bidi
```

### Support email
Your email (this is what users see if they need to contact you).

### Support website
Optional — if you publish the source on GitHub later, link to the repo here. Leave blank if you don't have one yet.

### License
Pick **MIT License** from the dropdown. (Or any other you prefer; MIT is the standard permissive choice for this kind of utility.)

### Privacy Policy
Optional. Since the extension collects nothing, you can skip this. If AMO complains, paste:

```
Claude RTL Fix does not collect, store, or transmit any user data. The extension only reads the DOM of pages on claude.ai and adds standard HTML "dir" attributes to text elements to fix right-to-left rendering. No data leaves your browser. No analytics or telemetry are used.
```

### Screenshots
You'll be asked for at least one. Take screenshots of:

1. A Claude conversation in Hebrew **before** the extension (text aligned to the left, broken punctuation).
2. The same conversation **after** the extension (text aligned to the right, correct punctuation).
3. (Optional) A mixed English/Hebrew message showing per-paragraph direction working correctly.

Recommended size: 1280×800. PNG or JPG.

### Notes for reviewers (private — only AMO reviewers see this)
This field is optional but **strongly recommended** — it speeds up human review significantly. Paste:

```
This extension adds dir="auto" to text-bearing elements (p, li, h1-h6, blockquote, td, th, dd, dt, figcaption, summary) and dir="ltr" to code elements (pre, code, kbd, samp, var) inside pages on claude.ai. This fixes Hebrew/Arabic/RTL rendering which Claude.ai's UI does not handle.

The extension uses no remote code, no eval, no minification. All source is plain readable JavaScript. A MutationObserver handles dynamically streamed content. The toolbar icon toggles the fix on/off via chrome.storage.local. No data is collected or transmitted.

To test: install the extension, visit claude.ai, send any Hebrew message (e.g. "שלום, איך השעה?") — Claude's response should render right-aligned with correct punctuation. Click the toolbar icon to disable; the page reverts to default LTR rendering immediately.
```

---

## Step 4 — Submit and wait

1. Click **Submit Version**.
2. The page will show "Your add-on has been submitted!" and your add-on enters the review queue.
3. You'll get email notifications about the status.

### What happens next

- **Automated validation** has already passed at upload time.
- **Public listing** is usually immediate — your extension should be browsable on AMO within a few minutes of submission.
- **Human review** for new add-ons typically takes anywhere from a few hours to a few business days. Most simple content scripts like this one (no remote code, clear purpose, declared no-data-collection) clear review quickly.
- If a reviewer wants changes, you'll get an email explaining what. Address it, upload a new version with a bumped `version` number in `manifest.json`, and resubmit.

---

## Step 5 — After it's live

- Your extension URL will be `https://addons.mozilla.org/firefox/addon/claude-rtl-fix/`
- Updates: bump the `version` field in `manifest.json` (e.g. `1.0.0` → `1.0.1`), rezip, go to your add-on's page on AMO, click **Upload New Version**. AMO automatically delivers updates to all installed copies — no extra work.
- If you ever want to take it down, you can disable or delete the listing from the Developer Hub.

---

## Common gotchas

- **"Add-on ID already exists"** — someone else used your `gecko.id`. Change it in `manifest.json` to something more unique and rezip.
- **"Source code required"** — happens if AMO thinks your code is minified. It shouldn't trigger here, but if it does, just zip up the `firefox/` folder a second time and upload that as the source code package when prompted.
- **Validator warnings about `host_permissions`** — fine, ignore. Specific HTTPS-only host permissions to a single domain are exactly what reviewers want to see.
- **"Your extension uses an experimental API"** — shouldn't happen with this code. If it does, check your manifest for typos.

---

## What about Chrome Web Store?

Different process, different fees, different review timeline. Chrome Web Store charges a **one-time $5 developer registration fee**, and review is usually faster (often hours). I can write up a Chrome Web Store submission guide too if you want — just ask.
