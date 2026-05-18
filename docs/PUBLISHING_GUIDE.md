# Publishing Claude RTL Fix to all browser stores

You have v1.5.5 working — time to publish. There are three stores that matter, and submitting to those three covers the entire desktop browser ecosystem:

| Store | Cost | Review time | Reach |
|---|---|---|---|
| **Chrome Web Store** | $5 one-time | hours to a few days | Chrome, Brave, Arc, Vivaldi, Opera (all install from CWS) |
| **Firefox AMO** | Free | minutes (auto) to days (human) | Firefox |
| **Edge Add-ons** | Free | hours to a week | Edge users who don't pull from CWS |

**Strategy: do Chrome and Firefox first.** Edge can wait — its store is small, the audience overlap with Chrome is near-total (Edge can install from CWS), and the ROI is lowest. Opera also accepts Chrome installs natively now, so don't bother with their separate store.

The total cost to publish everywhere is **$5**. The time investment is roughly an hour of forms across the three stores once you have screenshots and listing copy ready.

---

## What you need before starting (do this once, reuse for all three stores)

### 1. Screenshots

Each store wants at least one screenshot. The same screenshots work everywhere. Recommended:

- **Screenshot 1 — the hero:** A Hebrew Claude conversation rendered correctly with the extension on. Include some bullet points and a code block to showcase the mixed-direction handling.
- **Screenshot 2 — before/after:** Same conversation with the extension off (broken) and on (fixed), side by side or as two stacked panels.
- **Screenshot 3 (optional) — mixed content:** A response that has Hebrew paragraphs, English paragraphs, code, and a bulleted list — proving each block picks its own direction.

Sizes per store:
- **CWS:** 1280×800 or 640×400 (PNG/JPG, max 5)
- **AMO:** any reasonable size, typically 1280×800 (max 10)
- **Edge:** 1366×768 minimum, up to 10 images

If you make 1280×800 PNGs, all three stores will accept them.

### 2. Listing copy

Use the same copy across stores (the AMO submission guide I wrote earlier has paste-ready text — short summary, long description, tags). Keep it consistent so users searching across stores see the same thing.

### 3. Privacy policy

Optional, but Edge sometimes nags about it. The simplest solution: a public GitHub README or a single static HTML page hosted anywhere (GitHub Pages, your own domain, even a Gist) that says some version of:

> Claude RTL Fix does not collect, store, or transmit any user data. The extension only reads the DOM of pages on claude.ai and adds standard HTML "dir" attributes and CSS to fix right-to-left rendering. No data leaves your browser.

Put this URL in your bookmarks; you'll paste it into store forms.

### 4. (Recommended) Put the source on GitHub

Not strictly required for any store, but:
- Makes you look more legit during human review
- Becomes your "support URL" in store forms
- Lets users send PRs and report issues
- Free to host

If you don't already have a repo, push the source. Use the public README I wrote earlier as your repo's README.

---

## Chrome Web Store ($5, fastest reach)

This single submission also gets your extension installable on Brave, Arc, Vivaldi, and Opera — they all install directly from CWS.

### Step 1 — Pay the registration fee (one-time)

1. Go to **https://chrome.google.com/webstore/devconsole/**
2. Sign in with the Google Account you want to publish under. Strongly recommended: use a dedicated Google Account, not your personal one. If your personal Gmail ever gets banned, you don't want to lose your developer access too.
3. You'll be prompted to pay **$5 USD one-time**. This unlocks your developer dashboard for life and lets you publish up to 20 extensions under that account.

### Step 2 — Submit the extension

1. From the Developer Dashboard, click **Add new item**.
2. Upload `claude-rtl-fix-chrome.zip` (the manifest must be at the root of the zip — yours is, you're good).
3. Fill in the listing fields:
   - **Description**: paste from the AMO guide
   - **Category**: Productivity (or Accessibility)
   - **Language**: English (you can add Hebrew as an additional language for localized listings if you want)
   - **Screenshots**: upload at least one
   - **Small promotional tile** (440×280): required, plus optional 920×680 marquee. You can make this in any image editor — a clean image with the extension name and the aleph icon works.
   - **Privacy practices**: declare "Does not collect user data" — answer the questionnaire honestly (your extension does none of the listed data collection categories).
4. Set visibility to **Public**.
5. Submit for review.

### Review

CWS automated review usually clears in **minutes to a few hours**. Some submissions trigger human review (extensions with broad host permissions sometimes do). If yours hits human review, expect a few business days.

When it's live, your extension will be at:
`https://chromewebstore.google.com/detail/claude-rtl-fix/<some-id>`

### Updates

When you ship a new version: bump `version` in `manifest.json`, rezip, go to your item's page in the dashboard, click **Package** → **Upload new package**. CWS rolls updates out to all installed copies automatically.

---

## Firefox AMO (free)

You already have my AMO submission guide for this — I wrote it back in v1.0.0. The process is unchanged. Quick recap:

1. Go to **https://addons.mozilla.org/developers/**, log in (any email — no fee).
2. Submit a New Add-on → **"On this site"** (= public listing).
3. Upload `claude-rtl-fix-firefox.zip`.
4. Validator runs in seconds. Confirm source is reviewable as-is (yes — plain JS).
5. Fill in listing using the paste-ready copy from `AMO_SUBMISSION_GUIDE.md`.
6. Submit.

### Review

Public listing usually goes live in **minutes** after passing automated validation. Human review for new extensions adds **hours to a few business days** but doesn't block listing visibility.

When it's live: `https://addons.mozilla.org/firefox/addon/claude-rtl-fix/`

### Updates

Bump `version` in `manifest.json`, rezip, go to your add-on's page on AMO, click **Upload New Version**. AMO auto-delivers updates to all installed copies.

---

## Edge Add-ons (free, optional)

Edge users can already install Chrome Web Store extensions, so the audience for an Edge-store-only listing is small. But it's free, takes ~30 minutes once your CWS listing is up, and gives you a Microsoft-store badge. Worth doing eventually but not urgent.

### Step 1 — Register for Partner Center

1. Go to **https://partner.microsoft.com/dashboard/microsoftedge/public/account/registration**
2. Sign in with a Microsoft Account (an `@outlook.com`, `@live.com`, or `@hotmail.com` address). You can also sign in with GitHub credentials and Microsoft will auto-create the linked MSA for you.
3. Choose **Individual** account type (unless you're publishing on behalf of a registered business).
4. Fill in publisher display name, contact info, accept terms, click Finish.
5. Wait for the verification email (usually within 24 hours).

### Step 2 — Submit

1. In Partner Center, click **Create new extension**.
2. Upload the same zip you used for Chrome — `claude-rtl-fix-chrome.zip` works fine, since Edge is Chromium-based and supports identical manifest format. **No code changes needed.**
3. Wait for the package to validate.
4. Fill in the **Properties** page (visibility = Public, category = Productivity, privacy policy URL = your hosted privacy policy).
5. Fill in **Store Listings** (English at minimum) — paste from the AMO guide.
6. Upload screenshots.
7. **Logo image (300×300)** required — your 128px icon scaled up will work, or remake it at 300px from your icon source.
8. Submit.

### Review

Edge has both automated and content-compliance review. Typical time: **24 hours to about a week**. They sometimes ask for clarifications via the Partner Center messaging — check your dashboard periodically.

When it's live: `https://microsoftedge.microsoft.com/addons/detail/<id>`

### Updates

Same pattern: bump version, rezip, upload new package via Partner Center. Edge takes longer to review updates than Chrome but they propagate the same way.

---

## What about Opera, Brave, Arc, Vivaldi?

**Don't bother with separate submissions.** All four browsers either install directly from the Chrome Web Store or have made CWS-compatibility their default flow:

- **Brave**: installs CWS extensions natively, no separate store
- **Arc**: installs CWS extensions natively, no separate store
- **Vivaldi**: installs CWS extensions natively, no separate store
- **Opera**: officially supports CWS installs (since Opera 70). Their own Opera Add-ons store exists but has notoriously slow review times (often 3+ weeks) and a small audience. Skip it.

Your CWS listing is the entire Chromium ecosystem.

---

## After everything is published

**Ship a v1.0.0-final tag.** Once you have the CWS and AMO listings live, that's your "1.0 launch" — bump from `1.5.5` to `2.0.0` (or whatever you want) and do one final synchronized release on both stores so users have the same version everywhere.

**Add the store links to your README.** Both stores give you install buttons or badges you can embed. Examples:

```markdown
## Install

- **[Chrome / Brave / Edge / Arc / Vivaldi / Opera](https://chromewebstore.google.com/detail/claude-rtl-fix/<id>)**
- **[Firefox](https://addons.mozilla.org/firefox/addon/claude-rtl-fix/)**
- **[Edge (Microsoft store)](https://microsoftedge.microsoft.com/addons/detail/<id>)** *(if you do that one)*
```

**Watch the reviews.** CWS and AMO both let users leave star ratings and reviews. For RTL fixes specifically, expect the Hebrew/Arabic-speaking audience to be highly vocal — both glowingly positive and quick to flag any regressions. Read the reviews; they're how you'll find the next bug.

**Plan for one update.** Almost no first version survives without a minor patch. Within a week of publishing, expect one user to report something unusual you didn't catch — a new Claude.ai layout, a specific page that doesn't get fixed, a CSS selector clash. Have the dev workflow ready (edit, rezip, upload) so you can ship a 1.0.1 quickly.

---

## A note on review risk for this specific extension

A few things in your favor:

- **Single, narrow host permission** — only `claude.ai`. Reviewers like this much more than `<all_urls>`.
- **No remote code execution** — no `fetch`, no `eval`, no `<script src>` to a CDN.
- **No data collection** — your privacy declaration is honest.
- **Plain JavaScript** — no minification, no bundler, fully readable to a human reviewer.
- **Clear, legitimate purpose** — fixing RTL rendering is a category of extension reviewers see often and approve readily.

One thing that may add a small amount of review friction: your extension manipulates the DOM of a third-party site (Anthropic's). Some reviewers will want to see that you're not injecting tracking or modifying user content beyond direction attributes. Your reviewer notes (in AMO and Edge — CWS doesn't expose this field as prominently) should explain in one sentence what you're doing. The paste-ready copy in the AMO guide already handles this.

Good luck with the launches.
