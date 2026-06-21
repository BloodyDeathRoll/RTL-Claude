// Claude RTL Fix — content script (v1.6.1)
//
// Two-pass fix for RTL text on Claude.ai:
//
//   Pass 1: Per-block direction
//     Set dir="auto" on text-bearing elements. Browser bidi handles direction.
//
//   Pass 2: Container direction
//     For LISTS we set dir="auto" on the <ul>/<ol>/<dl> when any child is RTL.
//     This is critical: dir="auto" (NOT dir="rtl") lets the browser position
//     each <li>'s bullet on its own item's start side. So a Hebrew item gets
//     a bullet on the right; an English item in the same list gets a bullet
//     on the left. Forcing dir="rtl" on the list pins the bullet column to
//     one side and breaks LTR items inside an otherwise-RTL list.
//
//     For TABLES we set dir="rtl" explicitly — column flow needs a single
//     direction for the whole container.
//
//     For BLOCKQUOTES we set dir="rtl" so the side-border lands on the right.
//
// Performance & correctness notes:
//
//   - Direction detection uses regex against textContent rather than
//     getComputedStyle. Reading computed style after DOM writes forces a
//     synchronous layout recalc; doing this in a loop triggers Firefox's
//     slow-script warning. The regex is also more correct: it tells us what
//     the browser WOULD resolve dir="auto" to, without making it actually do
//     the work.
//
//   - The container pass is DEBOUNCED by 150ms so streaming bursts don't
//     flicker as partial tokens arrive.
//
//   - List indentation uses padding-inline-start (logical property) and
//     !important to override Claude.ai's Tailwind utility classes.

(function () {
  'use strict';

  if (window !== window.top) return;

  const STORAGE_KEY = 'claude-rtl-fix-enabled';
  const MARKER_ATTR = 'data-rtl-fix-applied';
  const CONTAINER_MARKER = 'data-rtl-fix-container';
  const STYLE_ID = 'claude-rtl-fix-styles';

  // --- composer input-direction toggle ---
  //
  // A button in the composer area cycles the *input* editor between two
  // states, EN (default LTR) and HE (RTL, right-aligned). This is separate
  // from the response-rendering fix above: it's a deliberate two-state toggle
  // for what you type, NOT auto-detection (auto would flip direction
  // mid-sentence as the first strong character changes while typing).
  const INPUT_DIR_KEY = 'claude-rtl-fix-input-dir';        // 'en' | 'he'
  const INPUT_DIR_ATTR = 'data-claude-input-dir';          // set on <html>
  const INPUT_DIR_STYLE_ID = 'claude-rtl-fix-input-dir-styles';
  const INPUT_DIR_BTN_ID = 'claude-rtl-fix-input-dir-toggle';

  // The new-chat landing composer and the in-thread composer are the SAME
  // ProseMirror contenteditable component, so this one selector covers both.
  // This is the single source of truth for both the CSS :is() rule and the
  // button-injection anchor — confirm it in DevTools if Claude.ai changes the
  // composer markup, then update only this constant + the CSS list below.
  const COMPOSER_SELECTOR = 'div.ProseMirror[contenteditable="true"]';

  const CHUNK_SIZE = 150;
  // Container scan waits this long after the last mutation before running.
  // Long enough that streaming bursts don't flicker; short enough that the
  // fix appears responsive once Claude pauses.
  const CONTAINER_DEBOUNCE_MS = 150;
  // Hard ceiling on the debounce: claude.ai mutates the DOM continuously
  // (streaming indicators, timers, UI), and a pure "reset on every mutation"
  // debounce can be starved forever — the container scan would never run, so
  // pass-2 direction (the only thing that fixes Latin-first RTL lists) would
  // never apply. Once we've been waiting this long, force the scan even if
  // mutations are still arriving.
  const CONTAINER_MAX_WAIT_MS = 600;

  // Cross-browser shims
  const storage = (typeof browser !== 'undefined' && browser.storage)
    ? browser.storage.local
    : chrome.storage.local;
  const storageApi = (typeof browser !== 'undefined' && browser.storage)
    ? browser.storage
    : chrome.storage;

  const yieldToBrowser = (cb) => {
    if (typeof requestIdleCallback === 'function') {
      requestIdleCallback(cb, { timeout: 100 });
    } else {
      requestAnimationFrame(cb);
    }
  };

  const TEXT_BLOCK_SELECTORS = [
    'p', 'li',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'blockquote',
    'td', 'th',
    'dd', 'dt',
    'figcaption',
    'summary',
  ].join(',');

  const CONTAINER_SELECTORS = 'ul, ol, dl, blockquote, table';
  const CODE_SELECTORS = 'pre, code, kbd, samp, var';
  const CODE_TAGS = new Set(['PRE', 'CODE', 'KBD', 'SAMP', 'VAR']);

  // Strong-directional Unicode ranges for direction detection
  const RTL_REGEX = /[\u0590-\u05FF\u0600-\u06FF\u0700-\u074F\u0780-\u07BF\u07C0-\u07FF\u0800-\u082F\u0840-\u085F\u08A0-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFC]/;
  const LTR_REGEX = /[A-Za-z\u00C0-\u024F\u0370-\u03FF\u0400-\u04FF]/;

  function detectDirection(text) {
    if (!text) return null;
    const len = Math.min(text.length, 500);
    for (let i = 0; i < len; i++) {
      const ch = text[i];
      if (RTL_REGEX.test(ch)) return 'rtl';
      if (LTR_REGEX.test(ch)) return 'ltr';
    }
    return null;
  }

  // Dominant direction: counts strong RTL vs LTR characters and returns the
  // majority (ties → rtl). detectDirection() looks only at the FIRST strong
  // character, which mis-classifies a predominantly-Hebrew block that happens
  // to start with a Latin token — e.g. a list item beginning "[Unverified] …"
  // or "**Excel** …" resolves LTR under dir="auto" even though the body is
  // Hebrew. For block-level layout (list items) we want the body's direction,
  // not whatever the first word happens to be.
  function detectDominantDirection(text) {
    if (!text) return null;
    const len = Math.min(text.length, 500);
    let rtl = 0, ltr = 0;
    for (let i = 0; i < len; i++) {
      const ch = text[i];
      if (RTL_REGEX.test(ch)) rtl++;
      else if (LTR_REGEX.test(ch)) ltr++;
    }
    if (rtl === 0 && ltr === 0) return null;
    return rtl >= ltr ? 'rtl' : 'ltr';
  }

  let enabled = true;
  let observer = null;
  let inputDir = 'en';   // 'en' | 'he' — language mode (composer + rendering)

  // Block direction resolver. The EN/HE toggle is the source of truth:
  //
  //   HE mode → the user has declared the whole conversation Hebrew, so every
  //   prose block is RTL, full stop. No character counting — a heading like
  //   "לגבי Claude for Work / Legal Skill:" is mostly Latin by character but is
  //   semantically Hebrew, and counting can never get that right. Embedded
  //   English runs still lay out left-to-right within the RTL line via the
  //   Unicode bidi algorithm. Code is exempt: it's handled by codeDir() and
  //   stays LTR (real source) or follows its own content.
  //
  //   EN mode → fall back to per-block dominant detection (returns null when
  //   the block has no strong character yet).
  function resolveDir(text) {
    if (inputDir === 'he') return 'rtl';
    return detectDominantDirection(text);
  }

  const dirtyContainers = new Set();
  const dirtyBlocks = new Set();
  let containerScanTimer = null;
  let containerScanFirstQueuedAt = 0;

  // --- CSS injection ---
  //
  // Claude.ai uses Tailwind utility classes with high specificity (e.g. nested
  // .prose selectors). To reliably beat those we use !important on layout-
  // critical rules. This is normally a CSS smell, but in a content-script
  // context where we're patching a third-party site it's the right call —
  // we don't control their CSS and can't predict their specificity.
  //
  // Logical properties (padding-inline-start, etc.) automatically pick the
  // correct physical side based on direction.

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      /* Lists whose items we've touched: padding-right needs to be larger
         than the surrounding text blocks' padding (Claude uses 2rem on text
         blocks, 1.5rem default on lists) because the marker for RTL items
         sits in this padding area. 2.8rem matches the text edge while
         leaving room for the bullet/number on the right. */
      ul:has(> li[data-rtl-fix-applied]),
      ol:has(> li[data-rtl-fix-applied]),
      dl:has(> dt[data-rtl-fix-applied]),
      dl:has(> dd[data-rtl-fix-applied]) {
        padding-right: 2.8rem !important;
        list-style-position: outside !important;
      }
      /* Per-item: just text alignment. Don't touch padding — let the <ul>
         padding handle marker placement, and let Claude's existing pl-2 etc
         provide left-side spacing for LTR items. */
      li[data-rtl-fix-applied],
      dt[data-rtl-fix-applied],
      dd[data-rtl-fix-applied] {
        text-align: start !important;
        list-style-position: outside !important;
      }
      /* RTL lists/items: FORCE both direction and right-alignment with
         !important. Setting the dir="rtl" attribute alone is not enough — it
         only carries the low-specificity UA rule [dir=rtl]{direction:rtl},
         which Claude's Tailwind direction/text-align classes override, so the
         number/bullet stays on the left. Same lesson as the code-block and
         composer rules: direction and text-align must be forced together. The
         container dir moves the marker column to the right; the per-item dir
         (set explicitly from each item's dominant direction) keeps a minority
         LTR item left-aligned because it does NOT match dir="rtl". */
      ul[dir="rtl"], ol[dir="rtl"], dl[dir="rtl"],
      li[dir="rtl"], dt[dir="rtl"], dd[dir="rtl"] {
        direction: rtl !important;
        text-align: right !important;
      }
      /* Blockquote: border on the start side regardless of direction */
      blockquote[dir="rtl"] {
        border-inline-start: 3px solid currentColor !important;
        border-inline-end: none !important;
        border-right: none !important;
        border-left: none !important;
        padding-inline-start: 1em !important;
        padding-inline-end: 0 !important;
        opacity: 1 !important;
      }
      /* Block code (fenced) whose content is RTL: flip it RTL *and* right-align
         it — both together. direction alone only reorders glyphs; Claude's
         Tailwind hard-codes a physical text-align, so text-align:right is
         required to actually move the text to the right edge. Real source code
         stays dir="ltr" and is unaffected; only Hebrew-content blocks get
         dir="rtl" set on the <pre>/<code> by codeDir(). */
      pre[dir="rtl"], pre[dir="rtl"] code, pre code[dir="rtl"] {
        direction: rtl !important;
        text-align: right !important;
      }
      /* Inline code inside RTL text: stays LTR and isolated from bidi.
         pre code is excluded so block code keeps its content direction. */
      [dir="rtl"] code:not(pre code), [dir="auto"] code:not(pre code) {
        unicode-bidi: isolate;
        direction: ltr;
      }
      /* Table cells: align to start direction */
      table[dir="rtl"] td, table[dir="rtl"] th {
        text-align: start !important;
      }
    `;
    (document.head || document.documentElement).appendChild(style);
  }

  function removeStyles() {
    const style = document.getElementById(STYLE_ID);
    if (style) style.remove();
  }

  // --- composer input-direction: CSS, attribute, button ---
  //
  // We apply direction via a CSS rule keyed off data-claude-input-dir="he" on
  // <html>, NOT inline styles on the editor node. The composer is a framework-
  // managed contenteditable (ProseMirror) that strips inline styles on
  // re-render, so an attribute on a stable ancestor (<html>) plus a stylesheet
  // is the only reliable lever.
  //
  // We set BOTH direction:rtl and text-align:right with !important. Claude
  // hard-codes a physical `text-align: left` via Tailwind on the editor, so
  // `direction: rtl` alone reorders the text correctly but leaves it pinned to
  // the left edge — text-align:right is required to right-align it.

  function injectInputDirStyles() {
    if (document.getElementById(INPUT_DIR_STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = INPUT_DIR_STYLE_ID;
    // One :is() list covers both the new-chat landing composer and the
    // in-thread composer (both are the same ProseMirror contenteditable),
    // plus its descendant blocks (<p>, etc.) which may carry their own
    // physical text-align from Tailwind.
    style.textContent = `
      html[${INPUT_DIR_ATTR}="he"] :is(
        ${COMPOSER_SELECTOR},
        ${COMPOSER_SELECTOR} *
      ) {
        direction: rtl !important;
        text-align: right !important;
      }
    `;
    (document.head || document.documentElement).appendChild(style);
  }

  function removeInputDirStyles() {
    const style = document.getElementById(INPUT_DIR_STYLE_ID);
    if (style) style.remove();
  }

  function applyInputDir() {
    if (inputDir === 'he') {
      document.documentElement.setAttribute(INPUT_DIR_ATTR, 'he');
    } else {
      document.documentElement.removeAttribute(INPUT_DIR_ATTR);
    }
    updateInputDirButton();
  }

  function clearInputDir() {
    document.documentElement.removeAttribute(INPUT_DIR_ATTR);
  }

  // The control is a two-segment EN | HE switch: both labels are always
  // visible. The active segment is contrasted (full opacity + a filled
  // highlight); the inactive segment is faded but stays clickable.
  function updateInputDirButton() {
    const control = document.getElementById(INPUT_DIR_BTN_ID);
    if (!control) return;
    control.setAttribute('data-state', inputDir);
    const segments = control.querySelectorAll('[data-dir]');
    for (const seg of segments) {
      const active = seg.getAttribute('data-dir') === inputDir;
      seg.setAttribute('aria-pressed', active ? 'true' : 'false');
      seg.style.opacity = active ? '1' : '0.45';
      seg.style.backgroundColor = active
        ? 'color-mix(in srgb, currentColor 18%, transparent)'
        : 'transparent';
    }
  }

  function createInputDirButton() {
    // Inline styles are fine here — these are OUR elements, not the framework-
    // managed contenteditable, so nothing strips them on re-render.
    const control = document.createElement('div');
    control.id = INPUT_DIR_BTN_ID;
    control.setAttribute('role', 'group');
    control.setAttribute('aria-label', 'Composer input direction');
    control.style.cssText = [
      'all: unset',
      'box-sizing: border-box',
      'display: inline-flex',
      'align-items: center',
      'align-self: center',
      'gap: 1px',
      'margin: 0 6px 0 10px',
      'padding: 2px',
      'border-radius: 9999px',
      'border: 1px solid color-mix(in srgb, currentColor 25%, transparent)',
      'vertical-align: middle',
      'color: inherit',
    ].join(';');

    const makeSegment = (dir, label, title) => {
      const seg = document.createElement('button');
      seg.type = 'button';
      seg.setAttribute('data-dir', dir);
      seg.textContent = label;
      seg.title = title;
      seg.style.cssText = [
        'all: unset',
        'box-sizing: border-box',
        'cursor: pointer',
        'display: inline-flex',
        'align-items: center',
        'justify-content: center',
        'min-width: 2em',
        'height: 1.6em',
        'padding: 0 0.45em',
        'font: 600 11px/1 ui-sans-serif, system-ui, -apple-system, sans-serif',
        'letter-spacing: 0.03em',
        'border-radius: 9999px',
        'color: inherit',
        'transition: opacity 0.12s, background-color 0.12s',
      ].join(';');
      seg.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (inputDir === dir) return;
        inputDir = dir;
        applyInputDir();
        rescanAllDirections();   // mode change → re-judge all rendered content
        storage.set({ [INPUT_DIR_KEY]: dir }).catch(() => {});
      });
      return seg;
    };

    control.appendChild(makeSegment('en', 'EN', 'Composer input: English (LTR)'));
    control.appendChild(makeSegment('he', 'HE', 'Composer input: Hebrew (RTL)'));
    return control;
  }

  // Re-injected via the MutationObserver because the composer (and its control
  // row) can be torn down and swapped — e.g. moving between the landing page
  // and a thread. We anchor next to Claude's bottom-left "+" button so the
  // switch sits in that control group; if the "+" isn't found we fall back to
  // the send button's row, then to the editor's parent.
  function injectInputDirButton() {
    if (!enabled) return;
    if (document.getElementById(INPUT_DIR_BTN_ID)) return;

    const editor = document.querySelector(COMPOSER_SELECTOR);
    if (!editor) return;

    // Claude's bottom-left composer "+" (attach/add menu). Labels vary, so try
    // a few; confirm in DevTools if the switch lands in the wrong spot.
    const plusBtn = document.querySelector([
      'button[aria-label*="add" i]',
      'button[aria-label*="attach" i]',
      'button[aria-label*="upload" i]',
      'button[data-testid*="input-menu" i]',
    ].join(','));

    let container, before, anchorEl;
    if (plusBtn && plusBtn.parentElement) {
      container = plusBtn.parentElement;
      before = plusBtn.nextSibling;   // sit immediately after the "+"
      anchorEl = plusBtn;
    } else {
      const sendBtn = document.querySelector(
        'button[aria-label*="Send" i], button[aria-label*="שליחה" i]'
      );
      if (sendBtn && sendBtn.parentElement) {
        container = sendBtn.parentElement;
        before = sendBtn;
        anchorEl = sendBtn;
      } else if (editor.parentElement) {
        container = editor.parentElement;
        before = null;
        anchorEl = null;
      } else {
        return;
      }
    }

    const control = createInputDirButton();
    container.insertBefore(control, before);
    updateInputDirButton();

    // The "+" sits in a control group whose alignment we don't control, so
    // flex/vertical-align centering isn't reliable. Measure the anchor's
    // vertical center and nudge the switch to match it exactly. transform
    // doesn't affect layout flow, and we re-run this on every (re)injection.
    if (anchorEl) {
      const a = anchorEl.getBoundingClientRect();
      const c = control.getBoundingClientRect();
      const delta = (a.top + a.height / 2) - (c.top + c.height / 2);
      if (Math.abs(delta) > 0.5) {
        control.style.transform = `translateY(${delta}px)`;
      }
    }
  }

  function removeInputDirButton() {
    const btn = document.getElementById(INPUT_DIR_BTN_ID);
    if (btn) btn.remove();
  }

  // --- chunked work scheduler ---

  const activeJobs = new Set();

  function processInChunks(items, processItem, onDone) {
    let index = 0;
    const job = { cancelled: false };
    activeJobs.add(job);

    function step() {
      if (job.cancelled) {
        activeJobs.delete(job);
        return;
      }
      const end = Math.min(index + CHUNK_SIZE, items.length);
      for (; index < end; index++) {
        try { processItem(items[index]); } catch (err) { /* swallow */ }
      }
      if (index < items.length) {
        yieldToBrowser(step);
      } else {
        activeJobs.delete(job);
        if (onDone) onDone();
      }
    }

    yieldToBrowser(step);
    return job;
  }

  function cancelAllJobs() {
    for (const job of activeJobs) job.cancelled = true;
    activeJobs.clear();
  }

  // --- pass 1: per-block direction ---

  function fixBlockSync(el) {
    if (el.hasAttribute(MARKER_ATTR)) return;
    if (el.closest(CODE_SELECTORS)) return;
    el.setAttribute('dir', 'auto');
    el.setAttribute(MARKER_ATTR, '1');
  }

  // Block code (a <pre> or the <code> inside one) follows its CONTENT
  // direction: a fenced block of Hebrew prose/pseudo-code right-aligns, while
  // real source code (overwhelmingly ASCII) resolves to LTR. Inline code in
  // prose (file paths, identifiers) is NOT inside a <pre> and always stays LTR.
  function codeDir(el) {
    if (!el.closest('pre')) return 'ltr';
    return detectDirection(el.textContent) === 'rtl' ? 'rtl' : 'ltr';
  }

  function fixCodeSync(el) {
    if (el.hasAttribute(MARKER_ATTR)) return;
    el.setAttribute('dir', codeDir(el));
    el.setAttribute(MARKER_ATTR, '1');
  }

  function applyBlockFixSync(root) {
    if (!root || !root.querySelectorAll) return;
    const textBlocks = root.querySelectorAll(TEXT_BLOCK_SELECTORS);
    for (const el of textBlocks) { fixBlockSync(el); dirtyBlocks.add(el); }
    if (root.matches && root.matches(TEXT_BLOCK_SELECTORS)) { fixBlockSync(root); dirtyBlocks.add(root); }
    const codeBlocks = root.querySelectorAll(CODE_SELECTORS);
    for (const el of codeBlocks) fixCodeSync(el);

    const containers = root.querySelectorAll(CONTAINER_SELECTORS);
    for (const c of containers) dirtyContainers.add(c);
    // Re-queue the NEAREST ancestor container/block too (closest includes root
    // itself). On claude.ai the <ol>/<table>/<p> is inserted before its text
    // streams in; without this, content arriving inside an existing element
    // never re-triggers its direction scan, so it's judged once while empty
    // and never again. This is what left RTL lists and Latin-prefixed Hebrew
    // paragraphs stuck LTR.
    if (root.closest) {
      const ancestor = root.closest(CONTAINER_SELECTORS);
      if (ancestor) dirtyContainers.add(ancestor);
      const blockAncestor = root.closest(TEXT_BLOCK_SELECTORS);
      if (blockAncestor) dirtyBlocks.add(blockAncestor);
    }
  }

  function applyBlockFixChunked(root, onDone) {
    if (!root || !root.querySelectorAll) {
      if (onDone) onDone();
      return;
    }
    const textBlocks = Array.from(root.querySelectorAll(TEXT_BLOCK_SELECTORS));
    const codeBlocks = Array.from(root.querySelectorAll(CODE_SELECTORS));
    const containers = Array.from(root.querySelectorAll(CONTAINER_SELECTORS));
    // Also re-scan the nearest ancestor container/block (closest includes
    // root), so content streamed into an already-present <ol>/<table>/<p>
    // re-triggers its direction scan. See applyBlockFixSync for the rationale.
    if (root.closest) {
      const ancestor = root.closest(CONTAINER_SELECTORS);
      if (ancestor) containers.push(ancestor);
      const blockAncestor = root.closest(TEXT_BLOCK_SELECTORS);
      if (blockAncestor) textBlocks.push(blockAncestor);
    }
    const all = textBlocks.concat(codeBlocks);

    processInChunks(all, (el) => {
      if (el.hasAttribute(MARKER_ATTR)) return;
      if (CODE_TAGS.has(el.tagName)) {
        el.setAttribute('dir', codeDir(el));
        el.setAttribute(MARKER_ATTR, '1');
      } else {
        if (el.closest(CODE_SELECTORS)) return;
        el.setAttribute('dir', 'auto');
        el.setAttribute(MARKER_ATTR, '1');
      }
    }, () => {
      for (const c of containers) dirtyContainers.add(c);
      for (const b of textBlocks) dirtyBlocks.add(b);
      queueContainerScan();
      if (onDone) onDone();
    });
  }

  // Re-evaluate a single text block's direction from its DOMINANT content
  // direction and set it explicitly. This is what fixes a Hebrew paragraph
  // that opens with a Latin token (e.g. "[Certain] …"): dir="auto" would key
  // off the first strong character ('C') and resolve LTR, but the body is
  // Hebrew. When the block has no strong character yet (still empty/streaming)
  // we leave the pass-1 dir="auto" in place and pick it up on a later scan.
  function processTextBlock(el) {
    if (!el.isConnected) return;
    if (el.closest(CODE_SELECTORS)) return;
    const d = resolveDir(el.textContent);
    if (d) el.setAttribute('dir', d);
  }

  // --- pass 2: container direction (debounced) ---
  //
  // Key insight: for LISTS we want each <li> to carry its OWN direction so its
  // bullet/number sits on its own start side — Hebrew items get markers on the
  // right, English items on the left, within one list. We used to do this with
  // dir="auto" and let the browser resolve each item, but dir="auto" keys off
  // the FIRST strong character: a Hebrew item that opens with a Latin token
  // (e.g. "[Unverified] …" or "**Excel** …") resolves LTR and renders with its
  // number on the left. So we now set an EXPLICIT dir on each item from its
  // DOMINANT direction (majority of strong characters), which reflects the
  // body rather than the first word. The container's dir follows the item
  // majority for block alignment, but each item's explicit dir still governs
  // its own marker side, so a minority LTR item inside an RTL list keeps its
  // left-side number.
  //
  // For TABLES and BLOCKQUOTES we set dir="rtl" explicitly because their
  // layout (column flow, border side) really does need a single direction for
  // the whole container.

  function setContainerDir(container, dir) {
    if (!dir) return;
    if (container.getAttribute(CONTAINER_MARKER) === dir) return;
    container.setAttribute('dir', dir);
    container.setAttribute(CONTAINER_MARKER, dir);
  }

  function processContainer(container) {
    if (!container.isConnected) return;
    if (container.closest(CODE_SELECTORS)) return;

    const tag = container.tagName;

    // Lists: give each item an explicit dir from its dominant direction, then
    // align the container to the item majority.
    if (tag === 'UL' || tag === 'OL' || tag === 'DL') {
      const children = tag === 'DL'
        ? container.querySelectorAll(':scope > dt, :scope > dd')
        : container.querySelectorAll(':scope > li');

      let rtlItems = 0, ltrItems = 0;
      for (const child of children) {
        const d = resolveDir(child.textContent);
        if (!d) continue;
        // Explicit per-item dir overrides the dir="auto" set in pass 1, so the
        // item's marker side follows its body rather than its first character.
        child.setAttribute('dir', d);
        if (d === 'rtl') rtlItems++; else ltrItems++;
      }
      if (rtlItems > 0) {
        // RTL majority → align the whole list right; otherwise keep the block
        // neutral ("auto") so a lone RTL item doesn't right-shift an English
        // list. Either way each item keeps its own marker side via its dir.
        setContainerDir(container, rtlItems >= ltrItems ? 'rtl' : 'auto');
      }
      return;
    }

    // Tables: explicit RTL/LTR based on majority of cells
    if (tag === 'TABLE') {
      const cells = container.querySelectorAll('td, th');
      let rtl = 0, ltr = 0;
      for (const cell of cells) {
        const d = resolveDir(cell.textContent);
        if (d === 'rtl') rtl++;
        else if (d === 'ltr') ltr++;
      }
      const previousDir = container.getAttribute(CONTAINER_MARKER);
      if (previousDir === 'rtl') {
        // Sticky: stay RTL unless strong LTR majority
        if (rtl + ltr > 0 && ltr / (rtl + ltr) >= 0.75) {
          setContainerDir(container, 'ltr');
        }
      } else if (rtl > 0 && rtl >= ltr) {
        setContainerDir(container, 'rtl');
      }
      return;
    }

    // Blockquotes: explicit RTL based on the contained paragraphs
    if (tag === 'BLOCKQUOTE') {
      const paragraphs = container.querySelectorAll(':scope > p');
      const text = paragraphs.length > 0
        ? Array.from(paragraphs).map(p => p.textContent).join(' ')
        : container.textContent;
      const dir = resolveDir(text);
      if (dir === 'rtl') {
        setContainerDir(container, 'rtl');
      } else if (dir === 'ltr' && container.getAttribute(CONTAINER_MARKER) === 'rtl') {
        setContainerDir(container, 'ltr');
      }
      return;
    }
  }

  function runContainerScan() {
    containerScanTimer = null;
    containerScanFirstQueuedAt = 0;
    if (!enabled) {
      dirtyContainers.clear();
      dirtyBlocks.clear();
      return;
    }
    const blocks = Array.from(dirtyBlocks);
    dirtyBlocks.clear();
    const containers = Array.from(dirtyContainers);
    dirtyContainers.clear();
    // Blocks first (per-element direction), then containers (container-level
    // direction + list/table layout). Order is not strictly required — both
    // converge to the same per-item dir — but this keeps it predictable.
    if (blocks.length) processInChunks(blocks, processTextBlock);
    if (containers.length) processInChunks(containers, processContainer);
  }

  function queueContainerScan() {
    if (dirtyContainers.size === 0 && dirtyBlocks.size === 0) return;
    // Debounce: each new mutation pushes the scan out by CONTAINER_DEBOUNCE_MS
    // so streaming bursts don't flicker. BUT cap the total wait — if mutations
    // keep arriving (claude.ai never goes fully quiet), force the scan once
    // we've waited CONTAINER_MAX_WAIT_MS, so it can't be starved forever.
    const now = Date.now();
    if (!containerScanFirstQueuedAt) containerScanFirstQueuedAt = now;
    if (containerScanTimer !== null) clearTimeout(containerScanTimer);
    const waited = now - containerScanFirstQueuedAt;
    const delay = waited >= CONTAINER_MAX_WAIT_MS
      ? 0
      : Math.min(CONTAINER_DEBOUNCE_MS, CONTAINER_MAX_WAIT_MS - waited);
    containerScanTimer = setTimeout(runContainerScan, delay);
  }

  // Re-evaluate every block and container on the page. Called when the EN/HE
  // mode flips: HE forces all prose RTL, EN reverts to detection, so already-
  // rendered content must be re-judged. processTextBlock/processContainer
  // overwrite the existing dir, so this both applies and reverts cleanly.
  function rescanAllDirections() {
    if (!enabled) return;
    for (const b of document.querySelectorAll(TEXT_BLOCK_SELECTORS)) dirtyBlocks.add(b);
    for (const c of document.querySelectorAll(CONTAINER_SELECTORS)) dirtyContainers.add(c);
    queueContainerScan();
  }

  // --- removal (chunked) ---

  function removeFixChunked() {
    const fixed = Array.from(
      document.querySelectorAll(`[${MARKER_ATTR}], [${CONTAINER_MARKER}]`)
    );
    if (fixed.length === 0) {
      removeStyles();
      return;
    }
    processInChunks(fixed, (el) => {
      el.removeAttribute('dir');
      el.removeAttribute(MARKER_ATTR);
      el.removeAttribute(CONTAINER_MARKER);
    }, removeStyles);
  }

  // --- mutation observer ---

  const pendingTouched = new Set();
  let flushQueued = false;

  function flushPending() {
    flushQueued = false;
    if (!enabled) {
      pendingTouched.clear();
      return;
    }
    // The composer can be swapped on navigation; re-inject the toggle if it's
    // gone. Cheap when the button already exists (single getElementById).
    injectInputDirButton();
    if (pendingTouched.size === 0) {
      return;
    }
    const touched = Array.from(pendingTouched);
    pendingTouched.clear();

    if (touched.length > CHUNK_SIZE) {
      for (const node of touched) applyBlockFixChunked(node);
    } else {
      for (const node of touched) applyBlockFixSync(node);
      if (touched.length > 0) queueContainerScan();
    }
  }

  function startObserver() {
    if (observer) return;

    injectStyles();
    injectInputDirStyles();
    applyInputDir();
    injectInputDirButton();
    applyBlockFixChunked(document.body);

    observer = new MutationObserver((mutations) => {
      if (!enabled) return;
      for (const m of mutations) {
        if (m.type === 'childList') {
          for (const node of m.addedNodes) {
            if (node.nodeType === Node.ELEMENT_NODE) {
              pendingTouched.add(node);
            } else if (node.nodeType === Node.TEXT_NODE && node.parentElement) {
              pendingTouched.add(node.parentElement);
            }
          }
        } else if (m.type === 'characterData' && m.target.parentElement) {
          pendingTouched.add(m.target.parentElement);
        }
      }
      if (!flushQueued && pendingTouched.size > 0) {
        flushQueued = true;
        yieldToBrowser(flushPending);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });
  }

  function stopObserver() {
    if (observer) {
      observer.disconnect();
      observer = null;
    }
    if (containerScanTimer !== null) {
      clearTimeout(containerScanTimer);
      containerScanTimer = null;
    }
    containerScanFirstQueuedAt = 0;
    cancelAllJobs();
    dirtyContainers.clear();
    dirtyBlocks.clear();
    pendingTouched.clear();
    removeFixChunked();
    // Master off → the input-direction toggle does nothing either.
    clearInputDir();
    removeInputDirButton();
    removeInputDirStyles();
  }

  function setEnabled(value) {
    enabled = value;
    if (enabled) startObserver();
    else stopObserver();
  }

  storage.get([STORAGE_KEY, INPUT_DIR_KEY]).then((result) => {
    inputDir = result[INPUT_DIR_KEY] === 'he' ? 'he' : 'en';
    const stored = result[STORAGE_KEY];
    setEnabled(stored === undefined ? true : stored);
  }).catch(() => {
    inputDir = 'en';
    setEnabled(true);
  });

  storageApi.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if (changes[STORAGE_KEY]) {
      setEnabled(changes[STORAGE_KEY].newValue);
    }
    if (changes[INPUT_DIR_KEY]) {
      inputDir = changes[INPUT_DIR_KEY].newValue === 'he' ? 'he' : 'en';
      if (enabled) {
        applyInputDir();
        rescanAllDirections();   // mode change in another tab → re-judge here too
      }
    }
  });
})();
