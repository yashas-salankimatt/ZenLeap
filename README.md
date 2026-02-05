# ZenLeap - Relative Tab Navigation for Zen Browser

A vim-style relative tab numbering and keyboard navigation mod for [Zen Browser](https://zen-browser.app/).

## Features

- **Relative Tab Numbers**: Like vim's relative line numbers, shows distance from current tab
  - Current tab: `·`
  - Nearby tabs: `1`, `2`, `3`, ... `9`
  - Extended range: `A`, `B`, `C`, `D`, `E`, `F` (hex for 10-15)
  - Overflow: `+` (for 16+)

- **Keyboard Navigation**: Quick two-chord navigation
  - `Ctrl+Space` → Enter leap mode
  - `j` or `k` → Set direction (down/up)
  - `1-9` or `a-f` → Jump that many tabs
  - `Escape` → Cancel

## Visual Demo

```
Tab List (vertical):        With ZenLeap:
┌─────────────────┐        ┌─────────────────┐
│ GitHub          │        │ [3] GitHub      │   ← 3 tabs above
│ YouTube         │        │ [2] YouTube     │   ← 2 tabs above
│ Twitter         │        │ [1] Twitter     │   ← 1 tab above
│ ► My Project    │  →     │ [·] My Project  │   ← CURRENT TAB
│ Docs            │        │ [1] Docs        │   ← 1 tab below
│ Stack Overflow  │        │ [2] Stack Over..│   ← 2 tabs below
└─────────────────┘        └─────────────────┘

To jump to GitHub: Ctrl+Space → k → 3
To jump to Docs: Ctrl+Space → j → 1
```

## Requirements

ZenLeap requires **fx-autoconfig** to run JavaScript in Zen Browser.

## Installation

### Step 1: Install fx-autoconfig

1. Download [fx-autoconfig](https://github.com/MrOtherGuy/fx-autoconfig) from GitHub (green "Code" button → "Download ZIP")

2. Extract and copy the **contents** of the `program/` folder to your Zen Browser installation:

   | OS | Path |
   |----|------|
   | **macOS** | `/Applications/Zen Browser.app/Contents/Resources/` |
   | **Windows** | `C:\Program Files\Zen Browser\` |
   | **Linux** | `/opt/zen-browser/` or `/usr/lib/zen/` |

   You should copy:
   - `config.js`
   - `defaults/` folder (containing `pref/config-prefs.js`)

3. Copy the **contents** of the `profile/` folder to your Zen profile's `chrome/` folder:

   - Find your profile: Open Zen → type `about:profiles` → look for "Root Directory"
   - Create a `chrome/` folder inside your profile if it doesn't exist
   - Copy the `utils/` folder from fx-autoconfig into `chrome/`

   Your profile structure should look like:
   ```
   <profile>/
   └── chrome/
       └── utils/
           ├── boot.sys.mjs
           ├── chrome.manifest
           ├── fs.sys.mjs
           ├── uc_api.sys.mjs
           └── utils.sys.mjs
   ```

### Step 2: Install ZenLeap

1. Create a `JS/` folder inside your profile's `chrome/` folder:
   ```
   <profile>/chrome/JS/
   ```

2. Copy `zenleap.uc.js` into `chrome/JS/`:
   ```
   <profile>/chrome/JS/zenleap.uc.js
   ```

3. (Optional) Append `chrome.css` contents to your `userChrome.css` for additional customization:
   ```
   <profile>/chrome/userChrome.css
   ```

### Step 3: Enable and Restart

1. Open `about:config` in Zen Browser

2. Search for and set these to `true`:
   - `toolkit.legacyUserProfileCustomizations.stylesheets`
   - `devtools.chrome.enabled`
   - `devtools.debugger.remote-enabled`

3. Go to `about:support` and click **"Clear Startup Cache"**

4. **Completely restart Zen Browser** (quit and reopen)

## Usage

### Normal Mode
- Tabs display relative numbers automatically
- Current tab shows `·`
- Other tabs show distance: `1`, `2`, `3`, ... `9`, `A`-`F`

### Leap Mode Navigation

| Step | Key | Action |
|------|-----|--------|
| 1 | `Ctrl+Space` | Enter leap mode (overlay appears) |
| 2 | `j` or `k` | Set direction (down/up) |
| 3 | `1-9` or `a-f` | Jump that many tabs |

**Examples:**
- Jump 3 tabs up: `Ctrl+Space` → `k` → `3`
- Jump 5 tabs down: `Ctrl+Space` → `j` → `5`
- Jump 10 tabs up: `Ctrl+Space` → `k` → `a`
- Cancel: `Ctrl+Space` → `Escape`

## Debugging

### Browser Console
Press `Ctrl+Shift+J` (Cmd+Shift+J on macOS) to open the Browser Console. Look for `[ZenLeap]` messages.

### Browser Toolbox
Press `Ctrl+Shift+Alt+I` for full debugging capabilities:
- Inspect tab elements and their `data-zenleap-*` attributes
- Debug JavaScript execution
- Edit CSS live in the Style Editor

### Common Issues

**Numbers not showing:**
- Ensure fx-autoconfig is properly installed
- Check that startup cache was cleared
- Verify the JS file is in `chrome/JS/` (not just `chrome/`)
- Check Browser Console for errors

**Keyboard shortcuts not working:**
- Make sure no extension is capturing `Ctrl+Space`
- Try clicking somewhere in the browser chrome first
- Check for conflicts in `about:addons` → Extensions

## Customization

### CSS Variables

Add these to your `userChrome.css` to customize colors:

```css
:root {
  /* Number badge colors */
  --zenleap-bg: #505050;
  --zenleap-color: #e0e0e0;

  /* Current tab highlight */
  --zenleap-current-bg: #61afef;
  --zenleap-current-color: #1e1e1e;

  /* Direction colors (up/down) */
  --zenleap-up-bg: #455a6f;
  --zenleap-down-bg: #455a6f;

  /* Font sizes */
  --zenleap-font-size: 80%;
  --zenleap-compact-font-size: 70%;
}
```

### Changing the Trigger Key

Edit `zenleap.uc.js` and modify the `CONFIG` object:

```javascript
const CONFIG = {
  triggerKey: ' ',           // Change to another key
  triggerModifier: 'ctrlKey' // Options: 'ctrlKey', 'altKey', 'shiftKey', 'metaKey'
};
```

## Uninstallation

1. Delete `<profile>/chrome/JS/zenleap.uc.js`
2. Remove ZenLeap CSS from `userChrome.css` if added
3. Clear startup cache and restart

To completely remove fx-autoconfig:
1. Delete `config.js` and `defaults/` from Zen installation directory
2. Delete `<profile>/chrome/utils/` folder

## License

MIT License

## Credits

- Inspired by [tab-numbers](https://github.com/philmard/tab-numbers) theme for Zen
- Built with [fx-autoconfig](https://github.com/MrOtherGuy/fx-autoconfig)
- Vim's relative line numbers concept
