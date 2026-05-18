// Claude RTL Fix — background service worker
// Toggles the fix on/off when the extension icon is clicked,
// and updates the icon badge to reflect current state.

const STORAGE_KEY = 'claude-rtl-fix-enabled';

// Cross-browser API shim
const api = (typeof browser !== 'undefined') ? browser : chrome;

async function getEnabled() {
  const result = await api.storage.local.get([STORAGE_KEY]);
  return result[STORAGE_KEY] === undefined ? true : result[STORAGE_KEY];
}

async function setBadge(enabled) {
  const action = api.action || api.browserAction; // MV3 vs MV2
  if (!action) return;

  if (enabled) {
    await action.setBadgeText({ text: '' });
    await action.setTitle({ title: 'Claude RTL Fix: ON (click to disable)' });
  } else {
    await action.setBadgeText({ text: 'OFF' });
    if (action.setBadgeBackgroundColor) {
      await action.setBadgeBackgroundColor({ color: '#888' });
    }
    await action.setTitle({ title: 'Claude RTL Fix: OFF (click to enable)' });
  }
}

// Init badge on startup
(async () => {
  const enabled = await getEnabled();
  await setBadge(enabled);
})();

// Toggle on icon click
const action = api.action || api.browserAction;
if (action && action.onClicked) {
  action.onClicked.addListener(async () => {
    const current = await getEnabled();
    const next = !current;
    await api.storage.local.set({ [STORAGE_KEY]: next });
    await setBadge(next);
  });
}
