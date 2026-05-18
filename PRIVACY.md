# Privacy Policy

**Claude RTL Fix** does not collect, store, or transmit any user data.

## What the extension does

- Reads the DOM of pages on `claude.ai` to find text-bearing elements
- Adds standard HTML `dir` attributes to those elements to fix right-to-left rendering
- Injects a small CSS stylesheet for proper list and blockquote layout
- Stores a single boolean (extension on/off) in your browser's local `chrome.storage.local`, so the toggle setting persists across page loads. This data never leaves your browser.

## What the extension does not do

- It does not make any network requests
- It does not use `fetch`, `eval`, or any form of remote code loading
- It does not collect, transmit, or store any personal information
- It does not use analytics, telemetry, or tracking of any kind
- It does not read or modify the content of your Claude conversations beyond adding direction attributes to layout elements
- It does not share any data with the developer or any third party

## Permissions explained

- **`storage`**: used solely to remember whether you've toggled the extension on or off
- **Host permission for `claude.ai`**: the minimum scope needed to inject the content script that fixes RTL rendering. The extension does not run on any other site.

## Open source

The full source code is available on GitHub. Anyone can audit exactly what the extension does. If anything in this policy is contradicted by the actual code, the code is the truth and this policy is wrong — please open an issue.

## Contact

If you have questions or concerns about this privacy policy, open an issue on the project's GitHub repository.
