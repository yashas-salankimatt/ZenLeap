// ==UserScript==
// @name           ZenLeap - Relative Tab Navigation
// @description    Vim-style relative tab numbering with keyboard navigation
// @include        main
// @author         ZenLeap
// @version        3.4.0  // Keep in sync with VERSION constant below
// ==/UserScript==

(function() {
  'use strict';

  // Prevent double-loading (e.g. both fx-autoconfig and Sine active)
  if (window.__zenleapLoaded) return;
  window.__zenleapLoaded = true;

  // Version - keep in sync with @version in header above
  const VERSION = '3.4.0';

  // Sine package manager detection — when true, self-update is disabled
  // (Sine manages file installation; ZenLeap only checks & notifies)
  let isSineManaged = false;

  // ============================================
  // SETTINGS SYSTEM
  // ============================================

  const IS_MACOS = Services.appinfo.OS === 'Darwin';

  // Private windows must never persist URLs (sessions, marks, plugin data).
  function isPrivateWindow() {
    try { return PrivateBrowsingUtils.isWindowPrivate(window); } catch (e) { return false; }
  }

  const SETTINGS_SCHEMA = {
    // --- Keybindings: Global Triggers (combo type — key + modifiers) ---
    'keys.global.leapMode':        { default: { key: ' ', ctrl: true, shift: false, alt: false, meta: false }, type: 'combo', label: 'Leap Mode Toggle', description: 'Toggle leap mode on/off', category: 'Keybindings', group: 'Global Triggers' },
    'keys.global.search':          { default: { key: '/', ctrl: true, shift: false, alt: false, meta: false }, type: 'combo', label: 'Tab Search', description: 'Open tab search', category: 'Keybindings', group: 'Global Triggers' },
    'keys.global.commandPalette':  { default: { key: '?', ctrl: true, shift: true, alt: false, meta: false }, type: 'combo', label: 'Command Palette', description: 'Open command palette directly (Ctrl+Shift+/)', category: 'Keybindings', group: 'Global Triggers' },
    'keys.global.quickMark':       { default: { key: "'", ctrl: true, shift: false, alt: false, meta: false }, type: 'combo', label: 'Quick Jump to Mark', description: 'Jump to mark without leap mode', category: 'Keybindings', group: 'Global Triggers' },
    'keys.global.splitFocusLeft':  { default: { key: 'h', code: 'KeyH', ctrl: false, shift: false, alt: true, meta: false }, type: 'combo', label: 'Navigate Left',  description: 'Focus split pane left, or switch to previous workspace',  category: 'Keybindings', group: 'Global Triggers' },
    'keys.global.splitFocusDown':  { default: { key: 'j', code: 'KeyJ', ctrl: false, shift: false, alt: true, meta: false }, type: 'combo', label: 'Navigate Down',  description: 'Focus split pane below, or switch to next tab down',      category: 'Keybindings', group: 'Global Triggers' },
    'keys.global.splitFocusUp':    { default: { key: 'k', code: 'KeyK', ctrl: false, shift: false, alt: true, meta: false }, type: 'combo', label: 'Navigate Up',    description: 'Focus split pane above, or switch to previous tab up',    category: 'Keybindings', group: 'Global Triggers' },
    'keys.global.splitFocusRight': { default: { key: 'l', code: 'KeyL', ctrl: false, shift: false, alt: true, meta: false }, type: 'combo', label: 'Navigate Right', description: 'Focus split pane right, or switch to next workspace',     category: 'Keybindings', group: 'Global Triggers' },
    'keys.global.splitResize':     { default: { key: ' ', code: 'Space', ctrl: false, shift: false, alt: true, meta: false }, type: 'combo', label: 'Split Resize (gTile)', description: 'Open gTile-like grid overlay to resize/move tabs in split view (Alt+Space)', category: 'Keybindings', group: 'Global Triggers' },
    // Shadows the native "reopen closed tab" shortcut (Cmd+Shift+T on macOS, Ctrl+Shift+T elsewhere);
    // falls through to it when there is no recent folder deletion to undo.
    'keys.global.undoFolderDelete': { default: { key: 't', code: 'KeyT', ctrl: !IS_MACOS, shift: true, alt: false, meta: IS_MACOS }, type: 'combo', label: 'Undo Folder Delete', description: `Undo the last folder deletion (${IS_MACOS ? 'Cmd' : 'Ctrl'}+Shift+T)`, category: 'Keybindings', group: 'Global Triggers' },
    'keys.physicalAltFallback':    { default: false, type: 'toggle', label: 'Match Option Shortcuts by Physical Key (macOS)', description: 'On macOS, Option+letter types a character on many layouts (e.g. @ or ł). Off: Option shortcuts only fire when the key types no real character, so those characters can still be typed. On: always match the physical key.', category: 'Keybindings', group: 'Keyboard Layout' },

    // --- Keybindings: Leap Mode ---
    'keys.leap.browseDown':     { default: 'j', type: 'key', label: 'Browse Down', description: 'Enter browse mode downward', category: 'Keybindings', group: 'Leap Mode' },
    'keys.leap.browseDownAlt':  { default: 'arrowdown', type: 'key', label: 'Browse Down (Alt)', description: 'Arrow key alternative', category: 'Keybindings', group: 'Leap Mode' },
    'keys.leap.browseUp':       { default: 'k', type: 'key', label: 'Browse Up', description: 'Enter browse mode upward', category: 'Keybindings', group: 'Leap Mode' },
    'keys.leap.browseUpAlt':    { default: 'arrowup', type: 'key', label: 'Browse Up (Alt)', description: 'Arrow key alternative', category: 'Keybindings', group: 'Leap Mode' },
    'keys.leap.gMode':          { default: 'g', type: 'key', label: 'G-Mode', description: 'Enter absolute positioning mode', category: 'Keybindings', group: 'Leap Mode' },
    'keys.leap.lastTab':        { default: 'G', type: 'key', label: 'Last Tab', description: 'Jump to last tab', category: 'Keybindings', group: 'Leap Mode', caseSensitive: true },
    'keys.leap.zMode':          { default: 'z', type: 'key', label: 'Z-Mode', description: 'Enter scroll command mode', category: 'Keybindings', group: 'Leap Mode' },
    'keys.leap.setMark':        { default: 'm', type: 'key', label: 'Set Mark', description: 'Set mark on current tab', category: 'Keybindings', group: 'Leap Mode' },
    'keys.leap.clearMarks':     { default: 'M', type: 'key', label: 'Clear All Marks', description: 'Remove all marks', category: 'Keybindings', group: 'Leap Mode', caseSensitive: true },
    'keys.leap.gotoMark':       { default: "'", type: 'key', label: 'Jump to Mark', description: 'Enter goto mark mode', category: 'Keybindings', group: 'Leap Mode' },
    'keys.leap.gotoMarkAlt':    { default: '`', type: 'key', label: 'Jump to Mark (Alt)', description: 'Backtick alternative', category: 'Keybindings', group: 'Leap Mode' },
    'keys.leap.jumpBack':       { default: 'o', type: 'key', label: 'Jump Back', description: 'Jump back in tab history', category: 'Keybindings', group: 'Leap Mode' },
    'keys.leap.jumpForward':    { default: 'i', type: 'key', label: 'Jump Forward', description: 'Jump forward in tab history', category: 'Keybindings', group: 'Leap Mode' },
    'keys.leap.help':           { default: '?', type: 'key', label: 'Help', description: 'Show help modal', category: 'Keybindings', group: 'Leap Mode', caseSensitive: true },
    'keys.leap.prevWorkspace':     { default: 'h', type: 'key', label: 'Previous Workspace', description: 'Switch to previous workspace', category: 'Keybindings', group: 'Leap Mode' },
    'keys.leap.prevWorkspaceAlt':  { default: 'arrowleft', type: 'key', label: 'Previous Workspace (Alt)', description: 'Arrow key alternative', category: 'Keybindings', group: 'Leap Mode' },
    'keys.leap.nextWorkspace':     { default: 'l', type: 'key', label: 'Next Workspace', description: 'Switch to next workspace', category: 'Keybindings', group: 'Leap Mode' },
    'keys.leap.nextWorkspaceAlt':  { default: 'arrowright', type: 'key', label: 'Next Workspace (Alt)', description: 'Arrow key alternative', category: 'Keybindings', group: 'Leap Mode' },

    // --- Keybindings: Browse Mode ---
    'keys.browse.down':          { default: 'j', type: 'key', label: 'Move Down', description: 'Move highlight down', category: 'Keybindings', group: 'Browse Mode' },
    'keys.browse.downAlt':       { default: 'arrowdown', type: 'key', label: 'Move Down (Alt)', description: 'Arrow key alternative', category: 'Keybindings', group: 'Browse Mode' },
    'keys.browse.up':            { default: 'k', type: 'key', label: 'Move Up', description: 'Move highlight up', category: 'Keybindings', group: 'Browse Mode' },
    'keys.browse.upAlt':         { default: 'arrowup', type: 'key', label: 'Move Up (Alt)', description: 'Arrow key alternative', category: 'Keybindings', group: 'Browse Mode' },
    'keys.browse.confirm':       { default: 'enter', type: 'key', label: 'Open Tab', description: 'Open highlighted tab', category: 'Keybindings', group: 'Browse Mode' },
    'keys.browse.close':         { default: 'x', type: 'key', label: 'Close Tab(s)', description: 'Close highlighted or selected tabs', category: 'Keybindings', group: 'Browse Mode' },
    'keys.browse.select':        { default: ' ', type: 'key', label: 'Toggle Selection', description: 'Select/deselect highlighted tab', category: 'Keybindings', group: 'Browse Mode' },
    'keys.browse.yank':          { default: 'y', type: 'key', label: 'Yank', description: 'Copy selected tabs to buffer', category: 'Keybindings', group: 'Browse Mode' },
    'keys.browse.pasteAfter':    { default: 'p', type: 'key', label: 'Paste After', description: 'Paste tabs after highlight', category: 'Keybindings', group: 'Browse Mode' },
    'keys.browse.pasteBefore':   { default: 'P', type: 'key', label: 'Paste Before', description: 'Paste tabs before highlight', category: 'Keybindings', group: 'Browse Mode', caseSensitive: true },
    'keys.browse.prevWorkspace':    { default: 'h', type: 'key', label: 'Previous Workspace', description: 'Switch workspace left', category: 'Keybindings', group: 'Browse Mode' },
    'keys.browse.prevWorkspaceAlt': { default: 'arrowleft', type: 'key', label: 'Previous Workspace (Alt)', description: 'Arrow key alternative', category: 'Keybindings', group: 'Browse Mode' },
    'keys.browse.nextWorkspace':    { default: 'l', type: 'key', label: 'Next Workspace', description: 'Switch workspace right', category: 'Keybindings', group: 'Browse Mode' },
    'keys.browse.nextWorkspaceAlt': { default: 'arrowright', type: 'key', label: 'Next Workspace (Alt)', description: 'Arrow key alternative', category: 'Keybindings', group: 'Browse Mode' },
    'keys.browse.gMode':         { default: 'g', type: 'key', label: 'Start gg', description: 'Begin gg to jump to first tab', category: 'Keybindings', group: 'Browse Mode' },
    'keys.browse.lastTab':       { default: 'G', type: 'key', label: 'Last Tab', description: 'Jump to last tab', category: 'Keybindings', group: 'Browse Mode', caseSensitive: true },

    // --- Keybindings: G-Mode ---
    'keys.gMode.first':  { default: 'g', type: 'key', label: 'First Tab (gg)', description: 'Jump to first tab', category: 'Keybindings', group: 'G-Mode' },
    'keys.gMode.last':   { default: 'G', type: 'key', label: 'Last Tab', description: 'Jump to last tab', category: 'Keybindings', group: 'G-Mode', caseSensitive: true },

    // --- Keybindings: Z-Mode ---
    'keys.zMode.center': { default: 'z', type: 'key', label: 'Center (zz)', description: 'Center current tab in view', category: 'Keybindings', group: 'Z-Mode' },
    'keys.zMode.top':    { default: 't', type: 'key', label: 'Top (zt)', description: 'Scroll current tab to top', category: 'Keybindings', group: 'Z-Mode' },
    'keys.zMode.bottom': { default: 'b', type: 'key', label: 'Bottom (zb)', description: 'Scroll current tab to bottom', category: 'Keybindings', group: 'Z-Mode' },

    // --- Keybindings: Search / Command Mode ---
    'keys.search.commandPrefix': { default: '>', type: 'key', label: 'Command Prefix', description: 'Character to enter command mode', category: 'Keybindings', group: 'Search / Command', caseSensitive: true },

    // --- Timing ---
    'timing.leapTimeout':          { default: 3000, type: 'number', label: 'Leap Mode Timeout', description: 'Auto-cancel after (ms)', category: 'Timing', group: 'Timeouts', min: 500, max: 30000, step: 100 },
    'timing.gModeTimeout':         { default: 800, type: 'number', label: 'G-Mode Auto-Execute', description: 'Execute g{num} after (ms)', category: 'Timing', group: 'Timeouts', min: 200, max: 5000, step: 50 },
    'timing.browseGTimeout':       { default: 500, type: 'number', label: 'Browse gg Timeout', description: 'Wait for second g (ms)', category: 'Timing', group: 'Timeouts', min: 100, max: 3000, step: 50 },
    'timing.browseNumberTimeout':  { default: 300, type: 'number', label: 'Browse Number Timeout', description: 'Wait for multi-digit number (ms)', category: 'Timing', group: 'Timeouts', min: 100, max: 2000, step: 50 },
    'timing.workspaceSwitchDelay': { default: 100, type: 'number', label: 'Workspace Switch Delay', description: 'UI update delay after switch (ms)', category: 'Timing', group: 'Delays', min: 50, max: 1000, step: 10 },
    'timing.unloadTabDelay':       { default: 500, type: 'number', label: 'Unload Tab Delay', description: 'Delay before discarding tab (ms)', category: 'Timing', group: 'Delays', min: 100, max: 3000, step: 50 },
    'timing.previewDelay':         { default: 500, type: 'number', label: 'Browse Preview Delay', description: 'Delay before showing tab preview in browse mode (ms)', category: 'Timing', group: 'Delays', min: 0, max: 2000, step: 50 },
    'timing.quickNavSidebarPeek':  { default: 1000, type: 'number', label: 'Quick Nav Sidebar Peek', description: 'Show sidebar after Alt+J/K in compact mode (ms, 0 to disable)', category: 'Timing', group: 'Delays', min: 0, max: 5000, step: 100 },
    'timing.jjThreshold':          { default: 150, type: 'number', label: 'jj Escape Threshold', description: 'Max gap between two j presses to trigger normal mode escape (ms)', category: 'Timing', group: 'Timeouts', min: 50, max: 500, step: 10 },
    'timing.jjEscape':              { default: false, type: 'toggle', label: 'jj Escape to Normal Mode', description: 'Type jj quickly to escape from insert to normal mode in search and URL bars', category: 'Timing', group: 'Timeouts' },

    // --- Display ---
    'display.showRelativeNumbers': { default: 'always', type: 'select', label: 'Show Relative Numbers', description: 'When to show relative distance numbers on tab icons', category: 'Display', group: 'Tab Badges', options: [{ value: 'always', label: 'Always' }, { value: 'active', label: 'In Leap/Browse Mode' }, { value: 'off', label: 'Off' }] },
    'display.persistEssentialMarks': { default: true, type: 'toggle', label: 'Persist Essential Tab Marks', description: 'Save marks on essential tabs across browser restarts', category: 'Display', group: 'Tab Badges' },
    'display.currentTabIndicator': { default: '\u00B7', type: 'text', label: 'Current Tab Indicator', description: 'Badge character on current tab', category: 'Display', group: 'Tab Badges', maxLength: 2 },
    'display.vimModeInBars':        { default: true, type: 'toggle', label: 'Vim Mode in Search/Command', description: 'Enable vim normal mode in search and command bars (and the URL bar, see below). When off, Escape always closes the bar.', category: 'Display', group: 'Search' },
    'display.urlbarVim':            { default: true, type: 'toggle', label: 'Vim Mode in URL Bar', description: 'INSERT/NORMAL modes in the browser URL bar (Ctrl+L). Escape switches to NORMAL once you typed something; otherwise it closes the URL bar as usual.', category: 'Display', group: 'Search' },
    'display.searchAllWorkspaces':  { default: false, type: 'toggle', label: 'Search All Workspaces', description: 'Search tabs across all workspaces, not just the current one', category: 'Display', group: 'Search' },
    'display.searchIncludeEssentialTabs': { default: true, type: 'toggle', label: 'Search Includes Essential Tabs', description: 'Include essential tabs in tab search results', category: 'Display', group: 'Search' },
    'display.ggSkipPinned':         { default: true, type: 'toggle', label: 'gg Skips Pinned Tabs', description: 'When enabled, gg in browse/g-mode jumps to first unpinned tab instead of absolute first', category: 'Display', group: 'Navigation' },
    'display.tabAsEnter':           { default: false, type: 'toggle', label: 'Tab Acts as Enter', description: 'When enabled, Tab executes commands like Enter in the command palette. When off, Tab only performs its explicit bindings (e.g. toggle workspace search).', category: 'Display', group: 'Search' },
    'display.browsePreview':        { default: true, type: 'toggle', label: 'Browse Preview', description: 'Show a floating thumbnail preview of the highlighted tab in browse mode', category: 'Display', group: 'Navigation' },
    'display.maxSearchResults':    { default: 100, type: 'number', label: 'Max Search Results', description: 'Maximum results in tab search', category: 'Display', group: 'Search', min: 10, max: 500, step: 10 },
    'display.maxJumpListSize':     { default: 100, type: 'number', label: 'Max Jump History', description: 'Maximum jump history entries', category: 'Display', group: 'History', min: 10, max: 500, step: 10 },

    'display.refocusOnClose': { default: true, type: 'toggle', label: 'Refocus Page on Close', description: 'Restore keyboard focus to the web page after closing overlays (search, settings, help, reorganize, etc). Fixes compatibility with extensions like Surfing Keys and Vimium.', category: 'Display', group: 'Navigation' },

    // --- Appearance ---
    'appearance.theme': { default: 'meridian', type: 'select', label: 'Theme', description: 'Color theme for all ZenLeap UI components', category: 'Appearance', group: 'Theme', dynamicOptions: 'theme' },
    'appearance.applyToBrowser': { default: false, type: 'toggle', label: 'Apply Theme to Browser', description: 'Also apply the selected theme colors to the Zen Browser chrome (toolbar, sidebar, backgrounds)', category: 'Appearance', group: 'Theme' },

    // --- Advanced ---
    'advanced.debug':              { default: false, type: 'toggle', label: 'Debug Logging', description: 'Log actions to browser console', category: 'Advanced', group: 'Debugging' },
    'advanced.tabRecencyFloor':    { default: 0.8, type: 'number', label: 'Tab Recency Floor', description: 'Minimum recency multiplier', category: 'Advanced', group: 'Recency Tuning', min: 0, max: 2, step: 0.1 },
    'advanced.tabRecencyRange':    { default: 1.0, type: 'number', label: 'Tab Recency Range', description: 'Recency multiplier range', category: 'Advanced', group: 'Recency Tuning', min: 0, max: 5, step: 0.1 },
    'advanced.tabRecencyHalflife': { default: 12, type: 'number', label: 'Tab Recency Halflife', description: 'Minutes until 50% decay', category: 'Advanced', group: 'Recency Tuning', min: 1, max: 120, step: 1 },
    'advanced.cmdRecencyFloor':    { default: 0.8, type: 'number', label: 'Command Recency Floor', description: 'Minimum recency multiplier', category: 'Advanced', group: 'Recency Tuning', min: 0, max: 2, step: 0.1 },
    'advanced.cmdRecencyRange':    { default: 2.2, type: 'number', label: 'Command Recency Range', description: 'Recency multiplier range', category: 'Advanced', group: 'Recency Tuning', min: 0, max: 5, step: 0.1 },
    'advanced.cmdRecencyHalflife': { default: 30, type: 'number', label: 'Command Recency Halflife', description: 'Minutes until 50% decay', category: 'Advanced', group: 'Recency Tuning', min: 1, max: 120, step: 1 },

    // --- Updates ---
    'updates.autoCheck':       { default: true, type: 'toggle', label: 'Check for Updates Automatically', description: 'Periodically check GitHub for new ZenLeap versions', category: 'Advanced', group: 'Updates' },
    'updates.checkFrequency':  { default: 'daily', type: 'select', label: 'Check Frequency', description: 'How often to check for updates', category: 'Advanced', group: 'Updates', options: [{ value: 'startup', label: 'On Startup' }, { value: 'daily', label: 'Daily' }, { value: 'weekly', label: 'Weekly' }] },
    'updates.lastCheckTime':   { default: 0, type: 'number', label: 'Last Check Time', description: 'Timestamp of last update check (internal)', category: 'Advanced', group: 'Updates', hidden: true },
    'updates.dismissedVersion': { default: '', type: 'text', label: 'Dismissed Version', description: 'Version the user dismissed (internal)', category: 'Advanced', group: 'Updates', hidden: true },
    'updates.lastInstalledVersion': { default: '', type: 'text', label: 'Last Installed Version', description: 'Tracks version changes to clear stale state (internal)', category: 'Advanced', group: 'Updates', hidden: true },
  };

  // ============================================
  // SHARED HELPERS
  // ============================================

  // Always-on error reporting. log() is debug-only, which hides Zen API drift
  // from users and bug reports; use this for failures that should be visible.
  function reportError(context, error) {
    console.error(`[ZenLeap] ${context}:`, error);
  }

  // Zen space icons can be emoji text or chrome:// SVG URLs (selectable icon set).
  function isImageIcon(icon) {
    return typeof icon === 'string' &&
      (/^(chrome|resource|moz-src):\/\/\S+\.svg$/i.test(icon) || /^data:image\//i.test(icon));
  }

  // DOM node for an icon (preferred over HTML strings).
  function createIconNode(icon, fallback = '') {
    if (isImageIcon(icon)) {
      const img = document.createElement('img');
      img.className = 'zenleap-icon-img';
      img.src = icon;
      img.alt = '';
      return img;
    }
    const span = document.createElement('span');
    span.className = 'zenleap-icon-text';
    span.textContent = icon || fallback;
    return span;
  }

  // Escaped HTML string for an icon, for renderers that build innerHTML templates.
  function iconHtml(icon, fallback = '') {
    if (isImageIcon(icon)) return `<img class="zenleap-icon-img" src="${escapeHtml(icon)}" alt=""/>`;
    return escapeHtml(icon || fallback);
  }

  // --- ZenRipple (AI agent browser mod) ---
  // ZenRipple runs agents in their own tabs and space next to the user's. ZenLeap does
  // not depend on it: these only read the markers ZenRipple puts on its tabs, so that
  // bulk and heuristic commands (deduplicate, close other tabs, sort, session save)
  // leave the agents' work alone. Single-tab actions the user aims at a tab still work.
  const ZENRIPPLE_PAGES_PREFIX = 'resource://zenripple-pages/';
  const ZENRIPPLE_SPACE_NAME = 'ZenRipple'; // ZenRipple finds its space by this name

  function zenRippleActive() {
    return !!window.__zenrippleInitDone;
  }

  // A tab an agent session owns (ZenRipple stamps every window's copy of it; a tab the
  // user took over keeps data-agent-tab-id but loses the session id).
  function isAgentTab(tab) {
    return !!tab?.hasAttribute?.('data-agent-session-id');
  }

  // ZenRipple's own pages (dashboard, sessions, spawn, settings); ZenRipple recreates them.
  function isZenRipplePage(tab) {
    let url = '';
    try { url = tab?.linkedBrowser?.currentURI?.spec || ''; } catch (e) { /* no browser */ }
    if (url === 'about:blank' && typeof tab?._zenPinnedInitialState?.entry?.url === 'string') {
      url = tab._zenPinnedInitialState.entry.url; // pinned tab not restored yet
    }
    return url.startsWith(ZENRIPPLE_PAGES_PREFIX);
  }

  function isExternallyManagedTab(tab) {
    return isAgentTab(tab) || isZenRipplePage(tab);
  }

  // ZenRipple's agent space (only while ZenRipple runs: otherwise it's an ordinary name)
  function isAgentSpace(workspaceId) {
    if (!workspaceId || !zenRippleActive()) return false;
    try {
      return gZenWorkspaces.getWorkspaces().some(w => w.uuid === workspaceId && w.name === ZENRIPPLE_SPACE_NAME);
    } catch (e) { return false; }
  }

  // "3 ZenRipple tabs stay open" (agent tabs and ZenRipple pages left out of a bulk close)
  function zenRippleTabsKeptNote(count) {
    return `${count} ZenRipple tab${count !== 1 ? 's stay' : ' stays'} open`;
  }

  // ============================================
  // THEME ENGINE
  // ============================================

  // Values shared by every built-in theme
  const THEME_DEFAULTS = {
    rSm: '6px', rMd: '10px', rLg: '14px', rXl: '20px',
    fontUi: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    fontMono: "'SF Mono', 'Fira Code', 'Cascadia Code', monospace",
  };

  // A complete built-in theme from its palette: shared defaults, plus the values a theme
  // derives unless it sets them (accent tints, gTile regions, browse-mode colors).
  function completeThemePalette(palette) {
    const t = { ...THEME_DEFAULTS, ...palette };
    const [r, g, b] = [1, 3, 5].map(i => parseInt(t.accent.slice(i, i + 2), 16));
    const tint = alpha => `rgba(${r},${g},${b},${alpha})`;
    return {
      accentDim: tint('0.10'), accentMid: tint('0.20'), accentGlow: tint('0.35'), accentBorder: tint('0.30'),
      regionBlue: t.blue, regionPurple: t.purple, regionGreen: t.green, regionGold: t.gold,
      highlight: t.accent, mark: t.red, currentBadgeBg: t.accent, currentBadgeColor: t.bgBase,
      badgeColor: t.textPrimary, upBg: t.blue, downBg: t.green,
      ...t,
    };
  }

  const BUILTIN_THEME_PALETTES = {
    // ── Meridian: Warm amber accent, deep navy surfaces ──
    'meridian': {
      name: 'Meridian',
      // Backgrounds
      bgVoid: '#080a0f', bgDeep: '#0c0f15', bgBase: '#10141c',
      bgSurface: '#161b25', bgRaised: '#1c222e', bgElevated: '#242b39', bgHover: '#2a3244',
      // Accent (warm amber); the accent tints are derived from it
      accent: '#d4965a', accentBright: '#e8a96d',
      // Semantic (also the gTile region colors)
      blue: '#5b9fe8', purple: '#a78bdb', green: '#6ec47d',
      red: '#e06b6b', cyan: '#5bbfd7', gold: '#d4b85c',
      // Text
      textPrimary: '#dfe3eb', textSecondary: '#7d8694', textTertiary: '#525b6b', textMuted: '#3c4352',
      // Borders
      borderSubtle: 'rgba(255,255,255,0.04)', borderDefault: 'rgba(255,255,255,0.07)', borderStrong: 'rgba(255,255,255,0.12)',
      // Shadows
      shadowModal: '0 24px 80px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.07)',
      shadowElevated: '0 8px 32px rgba(0,0,0,0.4)',
      shadowKbd: '0 1px 2px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.06)',
      // Effects
      noiseOpacity: '0.018', backdropBlur: '12px', panelAlpha: '0.98',
      // Browse mode (highlight/mark/badges are derived from the palette unless set)
      selected: '#5bbfd7', badgeBg: '#3d4a5c',
    },

    // ── Meridian Transparent: Same palette, translucent panels ──
    'meridian-transparent': {
      name: 'Meridian Transparent',
      bgVoid: '#080a0f', bgDeep: '#0c0f15', bgBase: '#10141c',
      bgSurface: 'rgba(22,27,37,0.88)', bgRaised: 'rgba(28,34,46,0.88)', bgElevated: 'rgba(36,43,57,0.88)', bgHover: 'rgba(42,50,68,0.88)',
      accent: '#d4965a', accentBright: '#e8a96d',
      blue: '#5b9fe8', purple: '#a78bdb', green: '#6ec47d',
      red: '#e06b6b', cyan: '#5bbfd7', gold: '#d4b85c',
      textPrimary: '#dfe3eb', textSecondary: '#7d8694', textTertiary: '#525b6b', textMuted: '#3c4352',
      borderSubtle: 'rgba(255,255,255,0.05)', borderDefault: 'rgba(255,255,255,0.08)', borderStrong: 'rgba(255,255,255,0.14)',
      shadowModal: '0 24px 80px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.08)',
      shadowElevated: '0 8px 32px rgba(0,0,0,0.4)',
      shadowKbd: '0 1px 2px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.06)',
      noiseOpacity: '0.022', backdropBlur: '20px', panelAlpha: '0.88',
      selected: '#5bbfd7', badgeBg: 'rgba(61,74,92,0.92)',
    },

    // ── Dracula: Classic purple-accent dark theme ──
    // Palette: https://draculatheme.com/contribute
    'dracula': {
      name: 'Dracula',
      bgVoid: '#1e1f29', bgDeep: '#21222c', bgBase: '#282a36',
      bgSurface: '#2d2f3d', bgRaised: '#343746', bgElevated: '#3c3f58', bgHover: '#44475a',
      accent: '#bd93f9', accentBright: '#d4b0ff',
      blue: '#8be9fd', purple: '#bd93f9', green: '#50fa7b',
      red: '#ff5555', cyan: '#8be9fd', gold: '#f1fa8c',
      textPrimary: '#f8f8f2', textSecondary: '#bfbfbf', textTertiary: '#6272a4', textMuted: '#44475a',
      borderSubtle: 'rgba(255,255,255,0.04)', borderDefault: 'rgba(255,255,255,0.08)', borderStrong: 'rgba(255,255,255,0.14)',
      shadowModal: '0 24px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.08)',
      shadowElevated: '0 8px 32px rgba(0,0,0,0.45)',
      shadowKbd: '0 1px 2px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.06)',
      noiseOpacity: '0.012', backdropBlur: '12px', panelAlpha: '0.98',
      selected: '#8be9fd', badgeBg: '#565a72',
    },

    // ── Gruvbox Dark: Warm retro palette ──
    // Palette: https://github.com/morhetz/gruvbox
    'gruvbox': {
      name: 'Gruvbox Dark',
      bgVoid: '#1d2021', bgDeep: '#202324', bgBase: '#282828',
      bgSurface: '#32302f', bgRaised: '#3c3836', bgElevated: '#504945', bgHover: '#665c54',
      accent: '#fabd2f', accentBright: '#ffe066',
      blue: '#83a598', purple: '#d3869b', green: '#b8bb26',
      red: '#fb4934', cyan: '#8ec07c', gold: '#fabd2f',
      textPrimary: '#ebdbb2', textSecondary: '#a89984', textTertiary: '#7c6f64', textMuted: '#504945',
      borderSubtle: 'rgba(235,219,178,0.04)', borderDefault: 'rgba(235,219,178,0.08)', borderStrong: 'rgba(235,219,178,0.14)',
      shadowModal: '0 24px 80px rgba(0,0,0,0.55), 0 0 0 1px rgba(235,219,178,0.08)',
      shadowElevated: '0 8px 32px rgba(0,0,0,0.4)',
      shadowKbd: '0 1px 2px rgba(0,0,0,0.4), inset 0 1px 0 rgba(235,219,178,0.06)',
      noiseOpacity: '0.015', backdropBlur: '12px', panelAlpha: '0.98',
      selected: '#83a598', badgeBg: '#665c54',
    },

    // ── Nord: Clean arctic aesthetic ──
    // Palette: https://www.nordtheme.com
    'nord': {
      name: 'Nord',
      bgVoid: '#242933', bgDeep: '#272c36', bgBase: '#2e3440',
      bgSurface: '#343a48', bgRaised: '#3b4252', bgElevated: '#434c5e', bgHover: '#4c566a',
      accent: '#88c0d0', accentBright: '#a3d4e2',
      blue: '#81a1c1', purple: '#b48ead', green: '#a3be8c',
      red: '#bf616a', cyan: '#88c0d0', gold: '#ebcb8b',
      textPrimary: '#eceff4', textSecondary: '#d8dee9', textTertiary: '#7b88a1', textMuted: '#4c566a',
      borderSubtle: 'rgba(236,239,244,0.04)', borderDefault: 'rgba(236,239,244,0.07)', borderStrong: 'rgba(236,239,244,0.12)',
      shadowModal: '0 24px 80px rgba(0,0,0,0.5), 0 0 0 1px rgba(236,239,244,0.07)',
      shadowElevated: '0 8px 32px rgba(0,0,0,0.35)',
      shadowKbd: '0 1px 2px rgba(0,0,0,0.35), inset 0 1px 0 rgba(236,239,244,0.06)',
      noiseOpacity: '0.012', backdropBlur: '12px', panelAlpha: '0.98',
      selected: '#ebcb8b', badgeBg: '#5a6580',
    },

    // ── Catppuccin Mocha: Soothing pastel theme ──
    // Palette: https://github.com/catppuccin/catppuccin
    'catppuccin': {
      name: 'Catppuccin Mocha',
      bgVoid: '#181825', bgDeep: '#1a1a2e', bgBase: '#1e1e2e',
      bgSurface: '#262637', bgRaised: '#313244', bgElevated: '#3b3b52', bgHover: '#45475a',
      accent: '#cba6f7', accentBright: '#dbbfff',
      blue: '#89b4fa', purple: '#cba6f7', green: '#a6e3a1',
      red: '#f38ba8', cyan: '#94e2d5', gold: '#f9e2af',
      textPrimary: '#cdd6f4', textSecondary: '#a6adc8', textTertiary: '#6c7086', textMuted: '#45475a',
      borderSubtle: 'rgba(205,214,244,0.04)', borderDefault: 'rgba(205,214,244,0.07)', borderStrong: 'rgba(205,214,244,0.12)',
      shadowModal: '0 24px 80px rgba(0,0,0,0.55), 0 0 0 1px rgba(205,214,244,0.07)',
      shadowElevated: '0 8px 32px rgba(0,0,0,0.4)',
      shadowKbd: '0 1px 2px rgba(0,0,0,0.4), inset 0 1px 0 rgba(205,214,244,0.06)',
      noiseOpacity: '0.012', backdropBlur: '12px', panelAlpha: '0.98',
      selected: '#94e2d5', badgeBg: '#585b72',
    },

    // ── Tokyo Night: Modern VS Code-popular dark theme ──
    // Palette: https://github.com/enkia/tokyo-night-vscode-theme
    'tokyo-night': {
      name: 'Tokyo Night',
      bgVoid: '#16161e', bgDeep: '#1a1a24', bgBase: '#1a1b26',
      bgSurface: '#1f2030', bgRaised: '#24283b', bgElevated: '#2f3349', bgHover: '#3b3d57',
      accent: '#7aa2f7', accentBright: '#9ab8ff',
      blue: '#7aa2f7', purple: '#bb9af7', green: '#9ece6a',
      red: '#f7768e', cyan: '#7dcfff', gold: '#e0af68',
      textPrimary: '#c0caf5', textSecondary: '#9aa5ce', textTertiary: '#565f89', textMuted: '#3b4261',
      borderSubtle: 'rgba(192,202,245,0.04)', borderDefault: 'rgba(192,202,245,0.07)', borderStrong: 'rgba(192,202,245,0.12)',
      shadowModal: '0 24px 80px rgba(0,0,0,0.55), 0 0 0 1px rgba(192,202,245,0.07)',
      shadowElevated: '0 8px 32px rgba(0,0,0,0.4)',
      shadowKbd: '0 1px 2px rgba(0,0,0,0.4), inset 0 1px 0 rgba(192,202,245,0.06)',
      noiseOpacity: '0.012', backdropBlur: '12px', panelAlpha: '0.98',
      selected: '#e0af68', badgeBg: '#515475', upBg: '#7dcfff',
    },

    // ── Monokai Pro: Classic syntax-highlighting-inspired theme ──
    // Palette: https://monokai.pro
    'monokai': {
      name: 'Monokai',
      bgVoid: '#1a1a1a', bgDeep: '#1e1f1c', bgBase: '#272822',
      bgSurface: '#2d2e27', bgRaised: '#3e3d32', bgElevated: '#49483e', bgHover: '#585840',
      accent: '#a6e22e', accentBright: '#b8f240',
      blue: '#66d9ef', purple: '#ae81ff', green: '#a6e22e',
      red: '#f92672', cyan: '#66d9ef', gold: '#e6db74',
      textPrimary: '#f8f8f2', textSecondary: '#b8b8a8', textTertiary: '#75715e', textMuted: '#49483e',
      borderSubtle: 'rgba(248,248,242,0.04)', borderDefault: 'rgba(248,248,242,0.08)', borderStrong: 'rgba(248,248,242,0.14)',
      shadowModal: '0 24px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(248,248,242,0.08)',
      shadowElevated: '0 8px 32px rgba(0,0,0,0.45)',
      shadowKbd: '0 1px 2px rgba(0,0,0,0.5), inset 0 1px 0 rgba(248,248,242,0.06)',
      noiseOpacity: '0.012', backdropBlur: '12px', panelAlpha: '0.98',
      selected: '#66d9ef', badgeBg: '#585840', downBg: '#ae81ff',
    },

    // ── One Dark Pro: Atom's iconic One Dark ──
    // Palette: https://github.com/Binaryify/OneDark-Pro
    'one-dark': {
      name: 'One Dark Pro',
      bgVoid: '#1b1d23', bgDeep: '#1e2027', bgBase: '#282c34',
      bgSurface: '#2c313a', bgRaised: '#333842', bgElevated: '#3b4048', bgHover: '#434852',
      accent: '#61afef', accentBright: '#7bc4ff',
      blue: '#61afef', purple: '#c678dd', green: '#98c379',
      red: '#e06c75', cyan: '#56b6c2', gold: '#e5c07b',
      textPrimary: '#abb2bf', textSecondary: '#7f848e', textTertiary: '#5c6370', textMuted: '#3e4452',
      borderSubtle: 'rgba(171,178,191,0.04)', borderDefault: 'rgba(171,178,191,0.08)', borderStrong: 'rgba(171,178,191,0.14)',
      shadowModal: '0 24px 80px rgba(0,0,0,0.55), 0 0 0 1px rgba(171,178,191,0.07)',
      shadowElevated: '0 8px 32px rgba(0,0,0,0.4)',
      shadowKbd: '0 1px 2px rgba(0,0,0,0.4), inset 0 1px 0 rgba(171,178,191,0.06)',
      noiseOpacity: '0.012', backdropBlur: '12px', panelAlpha: '0.98',
      selected: '#c678dd', badgeBg: '#4b5263', upBg: '#56b6c2',
    },

    // ── Solarized Dark: Ethan Schoonover's precision-crafted palette ──
    // Palette: https://ethanschoonover.com/solarized
    'solarized-dark': {
      name: 'Solarized Dark',
      bgVoid: '#001e26', bgDeep: '#00212b', bgBase: '#002b36',
      bgSurface: '#073642', bgRaised: '#0a4050', bgElevated: '#0d4e5e', bgHover: '#1a5c6c',
      accent: '#268bd2', accentBright: '#3d9ee5',
      blue: '#268bd2', purple: '#6c71c4', green: '#859900',
      red: '#dc322f', cyan: '#2aa198', gold: '#b58900',
      textPrimary: '#93a1a1', textSecondary: '#839496', textTertiary: '#586e75', textMuted: '#405b62',
      borderSubtle: 'rgba(147,161,161,0.04)', borderDefault: 'rgba(147,161,161,0.08)', borderStrong: 'rgba(147,161,161,0.14)',
      shadowModal: '0 24px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(147,161,161,0.07)',
      shadowElevated: '0 8px 32px rgba(0,0,0,0.45)',
      shadowKbd: '0 1px 2px rgba(0,0,0,0.45), inset 0 1px 0 rgba(147,161,161,0.06)',
      noiseOpacity: '0.012', backdropBlur: '12px', panelAlpha: '0.98',
      selected: '#2aa198', badgeBg: '#1a5c6c', upBg: '#6c71c4',
    },

    // ── GitHub Dark: GitHub's official dark theme ──
    // Palette: https://github.com/primer/primitives
    'github-dark': {
      name: 'GitHub Dark',
      bgVoid: '#0a0c10', bgDeep: '#0d1117', bgBase: '#161b22',
      bgSurface: '#1c2128', bgRaised: '#21262d', bgElevated: '#282e36', bgHover: '#30363d',
      accent: '#58a6ff', accentBright: '#79c0ff',
      blue: '#58a6ff', purple: '#d2a8ff', green: '#3fb950',
      red: '#f85149', cyan: '#56d4dd', gold: '#d29922',
      textPrimary: '#c9d1d9', textSecondary: '#8b949e', textTertiary: '#6e7681', textMuted: '#484f58',
      borderSubtle: 'rgba(201,209,217,0.04)', borderDefault: 'rgba(201,209,217,0.08)', borderStrong: 'rgba(201,209,217,0.14)',
      shadowModal: '0 24px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(201,209,217,0.07)',
      shadowElevated: '0 8px 32px rgba(0,0,0,0.45)',
      shadowKbd: '0 1px 2px rgba(0,0,0,0.45), inset 0 1px 0 rgba(201,209,217,0.06)',
      noiseOpacity: '0.010', backdropBlur: '12px', panelAlpha: '0.98',
      selected: '#d2a8ff', badgeBg: '#30363d', currentBadgeColor: '#0d1117', upBg: '#56d4dd',
    },

    // ── Material Palenight: Material Theme's most popular variant ──
    // Palette: https://github.com/material-theme/vsc-material-theme
    'palenight': {
      name: 'Material Palenight',
      bgVoid: '#1b1e2b', bgDeep: '#1e2132', bgBase: '#292d3e',
      bgSurface: '#2f3344', bgRaised: '#34384a', bgElevated: '#3c4056', bgHover: '#444862',
      accent: '#82aaff', accentBright: '#9fc0ff',
      blue: '#82aaff', purple: '#c792ea', green: '#c3e88d',
      red: '#f07178', cyan: '#89ddff', gold: '#ffcb6b',
      textPrimary: '#a6accd', textSecondary: '#7982a9', textTertiary: '#5c6590', textMuted: '#3c4056',
      borderSubtle: 'rgba(166,172,205,0.04)', borderDefault: 'rgba(166,172,205,0.08)', borderStrong: 'rgba(166,172,205,0.14)',
      shadowModal: '0 24px 80px rgba(0,0,0,0.55), 0 0 0 1px rgba(166,172,205,0.07)',
      shadowElevated: '0 8px 32px rgba(0,0,0,0.4)',
      shadowKbd: '0 1px 2px rgba(0,0,0,0.4), inset 0 1px 0 rgba(166,172,205,0.06)',
      noiseOpacity: '0.012', backdropBlur: '12px', panelAlpha: '0.98',
      selected: '#c792ea', badgeBg: '#444862', upBg: '#89ddff',
    },

    // ── Ayu Dark: Clean minimal dark from Ayu family ──
    // Palette: https://github.com/ayu-theme/ayu-colors
    'ayu-dark': {
      name: 'Ayu Dark',
      bgVoid: '#0a0e14', bgDeep: '#0b0f15', bgBase: '#0d1017',
      bgSurface: '#131721', bgRaised: '#191f2b', bgElevated: '#1f2735', bgHover: '#272f3e',
      accent: '#e6b450', accentBright: '#f0c565',
      blue: '#39bae6', purple: '#d2a6ff', green: '#7fd962',
      red: '#f07178', cyan: '#95e6cb', gold: '#e6b450',
      textPrimary: '#bfbdb6', textSecondary: '#7b7d80', textTertiary: '#565b66', textMuted: '#3d424d',
      borderSubtle: 'rgba(191,189,182,0.04)', borderDefault: 'rgba(191,189,182,0.07)', borderStrong: 'rgba(191,189,182,0.12)',
      shadowModal: '0 24px 80px rgba(0,0,0,0.65), 0 0 0 1px rgba(191,189,182,0.07)',
      shadowElevated: '0 8px 32px rgba(0,0,0,0.5)',
      shadowKbd: '0 1px 2px rgba(0,0,0,0.5), inset 0 1px 0 rgba(191,189,182,0.06)',
      noiseOpacity: '0.015', backdropBlur: '12px', panelAlpha: '0.98',
      selected: '#39bae6', badgeBg: '#272f3e',
    },

    // ── Ayu Mirage: Softer mid-tone variant of Ayu ──
    'ayu-mirage': {
      name: 'Ayu Mirage',
      bgVoid: '#171b24', bgDeep: '#1a1e27', bgBase: '#1f2430',
      bgSurface: '#242936', bgRaised: '#2a2f3c', bgElevated: '#323845', bgHover: '#3a4050',
      accent: '#ffcc66', accentBright: '#ffd980',
      blue: '#73d0ff', purple: '#d4bfff', green: '#bae67e',
      red: '#f28779', cyan: '#95e6cb', gold: '#ffcc66',
      textPrimary: '#cbccc6', textSecondary: '#8a8d93', textTertiary: '#5c6070', textMuted: '#3a4050',
      borderSubtle: 'rgba(203,204,198,0.04)', borderDefault: 'rgba(203,204,198,0.07)', borderStrong: 'rgba(203,204,198,0.12)',
      shadowModal: '0 24px 80px rgba(0,0,0,0.55), 0 0 0 1px rgba(203,204,198,0.07)',
      shadowElevated: '0 8px 32px rgba(0,0,0,0.4)',
      shadowKbd: '0 1px 2px rgba(0,0,0,0.4), inset 0 1px 0 rgba(203,204,198,0.06)',
      noiseOpacity: '0.012', backdropBlur: '12px', panelAlpha: '0.98',
      selected: '#73d0ff', badgeBg: '#3a4050',
    },

    // ── Synthwave '84: Retro-futuristic neon ──
    // Palette: https://github.com/robb0wen/synthwave-vscode
    'synthwave': {
      name: "Synthwave '84",
      bgVoid: '#1a1028', bgDeep: '#1e1336', bgBase: '#262335',
      bgSurface: '#2d2844', bgRaised: '#342e50', bgElevated: '#3e375e', bgHover: '#4a4370',
      accent: '#ff7edb', accentBright: '#ff9de6',
      blue: '#36f9f6', purple: '#ff7edb', green: '#72f1b8',
      red: '#fe4450', cyan: '#36f9f6', gold: '#fede5d',
      textPrimary: '#e0d0ff', textSecondary: '#a599c4', textTertiary: '#6e5e8e', textMuted: '#4a4370',
      borderSubtle: 'rgba(224,208,255,0.04)', borderDefault: 'rgba(224,208,255,0.08)', borderStrong: 'rgba(224,208,255,0.14)',
      shadowModal: '0 24px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(224,208,255,0.08)',
      shadowElevated: '0 8px 32px rgba(0,0,0,0.5)',
      shadowKbd: '0 1px 2px rgba(0,0,0,0.5), inset 0 1px 0 rgba(224,208,255,0.06)',
      noiseOpacity: '0.015', backdropBlur: '14px', panelAlpha: '0.97',
      selected: '#36f9f6', badgeBg: '#4a4370',
    },

    // ── Everforest Dark: Comfortable green-toned theme ──
    // Palette: https://github.com/sainnhe/everforest
    'everforest': {
      name: 'Everforest Dark',
      bgVoid: '#242b2a', bgDeep: '#272e2d', bgBase: '#2d353b',
      bgSurface: '#343e44', bgRaised: '#3d484d', bgElevated: '#475258', bgHover: '#505c62',
      accent: '#a7c080', accentBright: '#b8d294',
      blue: '#7fbbb3', purple: '#d699b6', green: '#a7c080',
      red: '#e67e80', cyan: '#83c092', gold: '#dbbc7f',
      textPrimary: '#d3c6aa', textSecondary: '#9da9a0', textTertiary: '#7a8478', textMuted: '#505c62',
      borderSubtle: 'rgba(211,198,170,0.04)', borderDefault: 'rgba(211,198,170,0.07)', borderStrong: 'rgba(211,198,170,0.12)',
      shadowModal: '0 24px 80px rgba(0,0,0,0.5), 0 0 0 1px rgba(211,198,170,0.07)',
      shadowElevated: '0 8px 32px rgba(0,0,0,0.35)',
      shadowKbd: '0 1px 2px rgba(0,0,0,0.35), inset 0 1px 0 rgba(211,198,170,0.06)',
      noiseOpacity: '0.015', backdropBlur: '12px', panelAlpha: '0.98',
      selected: '#7fbbb3', badgeBg: '#505c62', downBg: '#83c092',
    },

    // ── Kanagawa: Inspired by Katsushika Hokusai's The Great Wave ──
    // Palette: https://github.com/rebelot/kanagawa.nvim
    'kanagawa': {
      name: 'Kanagawa',
      bgVoid: '#16161d', bgDeep: '#181820', bgBase: '#1f1f28',
      bgSurface: '#252530', bgRaised: '#2a2a37', bgElevated: '#363646', bgHover: '#3e3e52',
      accent: '#7e9cd8', accentBright: '#9ab4ec',
      blue: '#7e9cd8', purple: '#957fb8', green: '#76946a',
      red: '#c34043', cyan: '#7aa89f', gold: '#dca561',
      textPrimary: '#dcd7ba', textSecondary: '#9a978a', textTertiary: '#727169', textMuted: '#3e3e52',
      borderSubtle: 'rgba(220,215,186,0.04)', borderDefault: 'rgba(220,215,186,0.07)', borderStrong: 'rgba(220,215,186,0.12)',
      shadowModal: '0 24px 80px rgba(0,0,0,0.55), 0 0 0 1px rgba(220,215,186,0.07)',
      shadowElevated: '0 8px 32px rgba(0,0,0,0.4)',
      shadowKbd: '0 1px 2px rgba(0,0,0,0.4), inset 0 1px 0 rgba(220,215,186,0.06)',
      noiseOpacity: '0.015', backdropBlur: '12px', panelAlpha: '0.98',
      selected: '#dca561', badgeBg: '#3e3e52', upBg: '#7aa89f',
    },

    // ── Rosé Pine: All natural pine, faux fur, and a bit of soho vibes ──
    // Palette: https://rosepinetheme.com
    'rose-pine': {
      name: 'Rosé Pine',
      bgVoid: '#14121c', bgDeep: '#17151f', bgBase: '#191724',
      bgSurface: '#1f1d2e', bgRaised: '#26233a', bgElevated: '#2e2b42', bgHover: '#38354c',
      accent: '#c4a7e7', accentBright: '#d4bbf5',
      blue: '#9ccfd8', purple: '#c4a7e7', green: '#31748f',
      red: '#eb6f92', cyan: '#9ccfd8', gold: '#f6c177',
      textPrimary: '#e0def4', textSecondary: '#908caa', textTertiary: '#6e6a86', textMuted: '#403d52',
      borderSubtle: 'rgba(224,222,244,0.04)', borderDefault: 'rgba(224,222,244,0.07)', borderStrong: 'rgba(224,222,244,0.12)',
      shadowModal: '0 24px 80px rgba(0,0,0,0.55), 0 0 0 1px rgba(224,222,244,0.07)',
      shadowElevated: '0 8px 32px rgba(0,0,0,0.4)',
      shadowKbd: '0 1px 2px rgba(0,0,0,0.4), inset 0 1px 0 rgba(224,222,244,0.06)',
      noiseOpacity: '0.012', backdropBlur: '12px', panelAlpha: '0.98',
      selected: '#9ccfd8', badgeBg: '#38354c',
    },

    // ── Vesper: Warm dark theme with orange accents ──
    // Palette: https://github.com/raunofreiberg/vesper
    'vesper': {
      name: 'Vesper',
      bgVoid: '#0e0e0e', bgDeep: '#101010', bgBase: '#141414',
      bgSurface: '#1b1b1b', bgRaised: '#222222', bgElevated: '#2a2a2a', bgHover: '#333333',
      accent: '#ffc799', accentBright: '#ffd4b0',
      blue: '#8eb8e4', purple: '#d5a8e0', green: '#7fb98f',
      red: '#f5a191', cyan: '#8eb8e4', gold: '#ffc799',
      textPrimary: '#b8b8b8', textSecondary: '#7b7b7b', textTertiary: '#555555', textMuted: '#333333',
      borderSubtle: 'rgba(184,184,184,0.04)', borderDefault: 'rgba(184,184,184,0.07)', borderStrong: 'rgba(184,184,184,0.12)',
      shadowModal: '0 24px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(184,184,184,0.07)',
      shadowElevated: '0 8px 32px rgba(0,0,0,0.5)',
      shadowKbd: '0 1px 2px rgba(0,0,0,0.5), inset 0 1px 0 rgba(184,184,184,0.06)',
      noiseOpacity: '0.018', backdropBlur: '12px', panelAlpha: '0.98',
      selected: '#8eb8e4', badgeBg: '#333333',
    },

    // ── Poimandres: Minimal, dark teal-accented ──
    // Palette: https://github.com/drcmda/poimandres-theme
    'poimandres': {
      name: 'Poimandres',
      bgVoid: '#1a1c2a', bgDeep: '#1b1e2e', bgBase: '#1b2031',
      bgSurface: '#212738', bgRaised: '#272d40', bgElevated: '#303648', bgHover: '#3a4055',
      accent: '#add7ff', accentBright: '#c5e4ff',
      blue: '#add7ff', purple: '#a6accd', green: '#5de4c7',
      red: '#d0679d', cyan: '#89ddff', gold: '#fffac2',
      textPrimary: '#a6accd', textSecondary: '#767c9d', textTertiary: '#506477', textMuted: '#3a4055',
      borderSubtle: 'rgba(166,172,205,0.04)', borderDefault: 'rgba(166,172,205,0.07)', borderStrong: 'rgba(166,172,205,0.12)',
      shadowModal: '0 24px 80px rgba(0,0,0,0.55), 0 0 0 1px rgba(166,172,205,0.07)',
      shadowElevated: '0 8px 32px rgba(0,0,0,0.4)',
      shadowKbd: '0 1px 2px rgba(0,0,0,0.4), inset 0 1px 0 rgba(166,172,205,0.06)',
      noiseOpacity: '0.012', backdropBlur: '12px', panelAlpha: '0.98',
      selected: '#5de4c7', badgeBg: '#3a4055', upBg: '#89ddff',
    },

    // ── Moonlight: Soft purple VS Code theme ──
    // Palette: https://github.com/atomiks/moonlight-vscode-theme
    'moonlight': {
      name: 'Moonlight',
      bgVoid: '#1a1c2e', bgDeep: '#1c1e32', bgBase: '#1e2030',
      bgSurface: '#222436', bgRaised: '#2a2c40', bgElevated: '#32344a', bgHover: '#3c3e56',
      accent: '#82aaff', accentBright: '#a0c4ff',
      blue: '#82aaff', purple: '#c099ff', green: '#c3e88d',
      red: '#ff757f', cyan: '#86e1fc', gold: '#ffc777',
      textPrimary: '#c8d3f5', textSecondary: '#8f98b0', textTertiary: '#636da6', textMuted: '#3c3e56',
      borderSubtle: 'rgba(200,211,245,0.04)', borderDefault: 'rgba(200,211,245,0.07)', borderStrong: 'rgba(200,211,245,0.12)',
      shadowModal: '0 24px 80px rgba(0,0,0,0.55), 0 0 0 1px rgba(200,211,245,0.07)',
      shadowElevated: '0 8px 32px rgba(0,0,0,0.4)',
      shadowKbd: '0 1px 2px rgba(0,0,0,0.4), inset 0 1px 0 rgba(200,211,245,0.06)',
      noiseOpacity: '0.012', backdropBlur: '12px', panelAlpha: '0.98',
      selected: '#c099ff', badgeBg: '#3c3e56', upBg: '#86e1fc',
    },

    // ── Andromeda: Bold, colorful dark theme ──
    // Palette: https://github.com/EliverLara/Andromeda
    'andromeda': {
      name: 'Andromeda',
      bgVoid: '#1a1a24', bgDeep: '#1e1e2a', bgBase: '#23262e',
      bgSurface: '#292c36', bgRaised: '#2f323e', bgElevated: '#383c4a', bgHover: '#414558',
      accent: '#ffe66d', accentBright: '#fff08a',
      blue: '#6ec1e4', purple: '#c74ded', green: '#96e072',
      red: '#ee5d43', cyan: '#00e8c6', gold: '#ffe66d',
      textPrimary: '#d5ced9', textSecondary: '#9a929e', textTertiary: '#6b6370', textMuted: '#414558',
      borderSubtle: 'rgba(213,206,217,0.04)', borderDefault: 'rgba(213,206,217,0.08)', borderStrong: 'rgba(213,206,217,0.14)',
      shadowModal: '0 24px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(213,206,217,0.08)',
      shadowElevated: '0 8px 32px rgba(0,0,0,0.45)',
      shadowKbd: '0 1px 2px rgba(0,0,0,0.45), inset 0 1px 0 rgba(213,206,217,0.06)',
      noiseOpacity: '0.012', backdropBlur: '12px', panelAlpha: '0.98',
      selected: '#00e8c6', badgeBg: '#414558',
    },

    // ── Nightfox: Cool-toned Neovim-born theme ──
    // Palette: https://github.com/EdenEast/nightfox.nvim
    'nightfox': {
      name: 'Nightfox',
      bgVoid: '#131a24', bgDeep: '#152028', bgBase: '#192330',
      bgSurface: '#1e2a38', bgRaised: '#243140', bgElevated: '#29394a', bgHover: '#324456',
      accent: '#719cd6', accentBright: '#8db4e8',
      blue: '#719cd6', purple: '#9d79d6', green: '#81b29a',
      red: '#c94f6d', cyan: '#63cdcf', gold: '#dbc074',
      textPrimary: '#cdcecf', textSecondary: '#93949a', textTertiary: '#6b6e75', textMuted: '#3d4b5c',
      borderSubtle: 'rgba(205,206,207,0.04)', borderDefault: 'rgba(205,206,207,0.07)', borderStrong: 'rgba(205,206,207,0.12)',
      shadowModal: '0 24px 80px rgba(0,0,0,0.55), 0 0 0 1px rgba(205,206,207,0.07)',
      shadowElevated: '0 8px 32px rgba(0,0,0,0.4)',
      shadowKbd: '0 1px 2px rgba(0,0,0,0.4), inset 0 1px 0 rgba(205,206,207,0.06)',
      noiseOpacity: '0.015', backdropBlur: '12px', panelAlpha: '0.98',
      selected: '#dbc074', badgeBg: '#324456', upBg: '#63cdcf',
    },

    // ── Vitesse Dark: Elegant minimal by Anthony Fu ──
    // Palette: https://github.com/antfu/vscode-theme-vitesse
    'vitesse': {
      name: 'Vitesse Dark',
      bgVoid: '#171717', bgDeep: '#1a1a1a', bgBase: '#1e1e1e',
      bgSurface: '#252525', bgRaised: '#2b2b2b', bgElevated: '#333333', bgHover: '#3a3a3a',
      accent: '#4d9375', accentBright: '#5da888',
      blue: '#4c9a91', purple: '#b38bdb', green: '#4d9375',
      red: '#cb7676', cyan: '#5eaab5', gold: '#d4976c',
      textPrimary: '#dbd7ca', textSecondary: '#9a958c', textTertiary: '#6b675d', textMuted: '#3a3a3a',
      borderSubtle: 'rgba(219,215,202,0.04)', borderDefault: 'rgba(219,215,202,0.07)', borderStrong: 'rgba(219,215,202,0.12)',
      shadowModal: '0 24px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(219,215,202,0.07)',
      shadowElevated: '0 8px 32px rgba(0,0,0,0.45)',
      shadowKbd: '0 1px 2px rgba(0,0,0,0.45), inset 0 1px 0 rgba(219,215,202,0.06)',
      noiseOpacity: '0.015', backdropBlur: '12px', panelAlpha: '0.98',
      selected: '#4c9a91', badgeBg: '#3a3a3a', upBg: '#5eaab5',
    },
  };

  const BUILTIN_THEMES = Object.fromEntries(
    Object.entries(BUILTIN_THEME_PALETTES).map(([id, palette]) => [id, completeThemePalette(palette)])
  );

  // Mutable themes map: built-ins + user overrides (populated by loadUserThemes)
  let themes = { ...BUILTIN_THEMES };

  // Helper: build theme options array from current themes map
  function getThemeOptions() {
    return Object.entries(themes).map(([value, t]) => ({ value, label: t.name || value }));
  }

  // Normalize a user-supplied theme color to #rrggbb / rgba(), which every consumer
  // (CSS vars, the hex math in applyTheme, the browser theme) understands. Named and
  // hsl() colors would otherwise turn black. Returns null for unparseable values.
  function normalizeThemeColor(value) {
    if (typeof value !== 'string' || !value.trim()) return null;
    let rgba = null;
    try { rgba = InspectorUtils.colorToRGBA(value.trim()); } catch (e) { rgba = null; }
    if (!rgba) return null;
    const hex = n => Math.round(n).toString(16).padStart(2, '0');
    if (rgba.a >= 1) return `#${hex(rgba.r)}${hex(rgba.g)}${hex(rgba.b)}`;
    return `rgba(${Math.round(rgba.r)},${Math.round(rgba.g)},${Math.round(rgba.b)},${+rgba.a.toFixed(3)})`;
  }

  // Validate a user theme definition: known color keys must parse as CSS colors
  // (normalized), other values must be strings/numbers. Invalid keys are dropped
  // (with a warning) so the base theme's value applies.
  function sanitizeUserTheme(key, def) {
    const out = {};
    for (const [prop, value] of Object.entries(def)) {
      if (prop === 'extends') continue;
      const type = THEME_EDITOR_SCHEMA[prop]?.type;
      if (type === 'color' || type === 'rgba') {
        const color = normalizeThemeColor(value);
        if (color) out[prop] = color;
        else console.warn(`[ZenLeap] Theme "${key}": ignoring invalid color for "${prop}":`, value);
      } else if (typeof value === 'string' || typeof value === 'number') {
        out[prop] = String(value);
      } else {
        console.warn(`[ZenLeap] Theme "${key}": ignoring non-string value for "${prop}"`);
      }
    }
    return out;
  }

  // Load user-defined themes from {profile}/chrome/zenleap-themes.json
  // Supports "extends" to inherit from a built-in or other user theme; themes without
  // "extends" inherit Meridian, so every CSS variable always has a value.
  // Uses topological resolution so extends-chain order doesn't matter.
  async function loadUserThemes() {
    // Reset to built-ins before merging (handles deletions on reload)
    themes = { ...BUILTIN_THEMES };
    const themesPath = PathUtils.join(PathUtils.profileDir, 'chrome', 'zenleap-themes.json');
    try {
      const content = await IOUtils.readUTF8(themesPath);
      const userThemes = JSON.parse(content);
      if (!userThemes || typeof userThemes !== 'object' || Array.isArray(userThemes)) {
        throw new Error('zenleap-themes.json must contain a JSON object');
      }
      const entries = Object.entries(userThemes).filter(([k, v]) => typeof v === 'object' && v && !Array.isArray(v) && !k.startsWith('_'));
      const resolved = new Set();
      const resolving = new Set(); // cycle detection

      function resolve(key, def) {
        if (resolved.has(key)) return;
        if (resolving.has(key)) { console.warn(`[ZenLeap] Circular extends detected for theme "${key}", skipping`); return; }
        resolving.add(key);

        let base = BUILTIN_THEMES.meridian;
        if (def.extends) {
          if (BUILTIN_THEMES[def.extends]) {
            base = BUILTIN_THEMES[def.extends];
          } else {
            const parentEntry = entries.find(([k]) => k === def.extends);
            if (parentEntry) {
              resolve(parentEntry[0], parentEntry[1]);
              base = themes[def.extends] || base;
            } else {
              console.warn(`[ZenLeap] Theme "${key}" extends unknown theme "${def.extends}"; using Meridian`);
            }
          }
        }

        themes[key] = { ...BUILTIN_THEMES.meridian, ...base, ...sanitizeUserTheme(key, def) };
        if (!themes[key].name || typeof themes[key].name !== 'string') themes[key].name = key;
        resolving.delete(key);
        resolved.add(key);
      }

      for (const [key, def] of entries) resolve(key, def);
      log(`Loaded ${entries.length} user theme(s) from zenleap-themes.json`);
      return { count: entries.length, error: null };
    } catch (e) {
      // A missing file is fine — it's optional
      if (e.name === 'NotFoundError' || e.result === 0x80520012) return { count: 0, error: null };
      reportError('Error loading user themes from zenleap-themes.json', e);
      return { count: 0, error: e };
    }
  }

  // Create template zenleap-themes.json if it doesn't exist (never over an existing one,
  // even one that can't be read right now)
  async function ensureThemesFile() {
    const themesPath = PathUtils.join(PathUtils.profileDir, 'chrome', 'zenleap-themes.json');
    try {
      if (await IOUtils.exists(themesPath)) return;
    } catch (e) {
      console.warn('[ZenLeap] Could not check for zenleap-themes.json:', e);
      return;
    }
    const template = JSON.stringify({
      _comment: "ZenLeap User Themes. Use 'extends' to inherit from a built-in theme (themes without it start from Meridian). After editing, run 'Reload Themes' from the ZenLeap command palette (type > in tab search).",
      "example-custom": {
        name: "Example Custom",
        extends: "meridian",
        accent: "#ff6b6b",
        accentBright: "#ff8e8e",
        highlight: "#ff6b6b"
      }
    }, null, 2);
    try {
      // 'create' fails instead of replacing a file another window created meanwhile
      await IOUtils.writeUTF8(themesPath, template, { mode: 'create' });
      log('Created template zenleap-themes.json');
    } catch (writeErr) {
      if (writeErr?.name !== 'NoModificationAllowedError') console.warn('[ZenLeap] Could not create themes template:', writeErr);
    }
  }

  // The themes file as the theme editor changes it: {} when there is none yet, null
  // (after telling the user) when it can't be read or isn't a JSON object, so a
  // hand-edited file with a typo is never overwritten.
  async function readThemesFileForEdit(themesPath) {
    let content;
    try {
      content = await IOUtils.readUTF8(themesPath);
    } catch (e) {
      if (e?.name === 'NotFoundError') return {};
      reportError('Reading zenleap-themes.json failed', e);
      showSettingsToast('error', 'Could not read zenleap-themes.json \u2014 see the Browser Console');
      return null;
    }
    try {
      const parsed = JSON.parse(content);
      if (!_isPlainObject(parsed)) throw new Error('the file must contain a JSON object');
      return parsed;
    } catch (e) {
      reportError('zenleap-themes.json is not valid; it was left unchanged', e);
      showSettingsToast('error', 'zenleap-themes.json has an error: fix it with "Open Themes File", then try again');
      return null;
    }
  }

  function writeThemesFile(themesPath, rawThemes) {
    return IOUtils.writeUTF8(themesPath, JSON.stringify(rawThemes, null, 2), { tmpPath: `${themesPath}.tmp` });
  }

  // Theme editor: schema for all editable theme properties
  const THEME_EDITOR_SCHEMA = {
    // Accent (common)
    accent:          { label: 'Accent',            group: 'Accent',          type: 'color', common: true,  hint: 'Primary highlight color', browser: true },
    accentBright:    { label: 'Accent Bright',     group: 'Accent',          type: 'color', common: true,  hint: 'Hover & focus states' },
    accentDim:       { label: 'Accent Dim',        group: 'Accent',          type: 'rgba',  common: false, hint: 'Subtle accent backgrounds' },
    accentMid:       { label: 'Accent Mid',        group: 'Accent',          type: 'rgba',  common: false, hint: 'Medium accent overlays' },
    accentGlow:      { label: 'Accent Glow',       group: 'Accent',          type: 'rgba',  common: false, hint: 'Glow & shadow effects' },
    accentBorder:    { label: 'Accent Border',     group: 'Accent',          type: 'rgba',  common: false, hint: 'Accented element borders' },
    // Backgrounds
    bgBase:          { label: 'Base',              group: 'Backgrounds',     type: 'color', common: true,  hint: 'Default panel background', browser: true },
    bgSurface:       { label: 'Surface',           group: 'Backgrounds',     type: 'color', common: true,  hint: 'Card & surface backgrounds' },
    bgRaised:        { label: 'Raised',            group: 'Backgrounds',     type: 'color', common: true,  hint: 'Inputs, buttons, raised elements' },
    bgVoid:          { label: 'Void',              group: 'Backgrounds',     type: 'color', common: false, hint: 'Deepest shadow areas' },
    bgDeep:          { label: 'Deep',              group: 'Backgrounds',     type: 'color', common: false, hint: 'Background depth layer', browser: true },
    bgElevated:      { label: 'Elevated',          group: 'Backgrounds',     type: 'color', common: false, hint: 'Floating elements & dropdowns' },
    bgHover:         { label: 'Hover',             group: 'Backgrounds',     type: 'color', common: false, hint: 'Hover state backgrounds' },
    // Text
    textPrimary:     { label: 'Primary',           group: 'Text',            type: 'color', common: true,  hint: 'Main text & headings' },
    textSecondary:   { label: 'Secondary',         group: 'Text',            type: 'color', common: true,  hint: 'Labels & descriptions' },
    textTertiary:    { label: 'Tertiary',          group: 'Text',            type: 'color', common: false, hint: 'Placeholder text' },
    textMuted:       { label: 'Muted',             group: 'Text',            type: 'color', common: false, hint: 'Disabled & de-emphasized' },
    // Browse Mode
    highlight:       { label: 'Highlight',         group: 'Browse Mode',     type: 'color', common: true,  hint: 'Current j/k selection' },
    selected:        { label: 'Selected',          group: 'Browse Mode',     type: 'color', common: true,  hint: 'Multi-selected tabs (v)' },
    mark:            { label: 'Mark',              group: 'Browse Mode',     type: 'color', common: false, hint: 'Marked tab indicator (m)' },
    currentBadgeBg:  { label: 'Current Badge BG',  group: 'Browse Mode',     type: 'color', common: false, hint: 'Active tab badge background' },
    currentBadgeColor:{ label: 'Current Badge Text',group: 'Browse Mode',    type: 'color', common: false, hint: 'Active tab badge text' },
    badgeBg:         { label: 'Badge BG',          group: 'Browse Mode',     type: 'color', common: false, hint: 'Tab number badge background' },
    badgeColor:      { label: 'Badge Text',        group: 'Browse Mode',     type: 'color', common: false, hint: 'Tab number badge text' },
    upBg:            { label: 'Up Direction BG',   group: 'Browse Mode',     type: 'color', common: false, hint: 'Above-viewport indicator' },
    downBg:          { label: 'Down Direction BG', group: 'Browse Mode',     type: 'color', common: false, hint: 'Below-viewport indicator' },
    // Semantic Colors
    blue:            { label: 'Blue',              group: 'Semantic Colors', type: 'color', common: false, hint: 'Info & links' },
    purple:          { label: 'Purple',            group: 'Semantic Colors', type: 'color', common: false, hint: 'Special & featured items' },
    green:           { label: 'Green',             group: 'Semantic Colors', type: 'color', common: false, hint: 'Success & confirmations' },
    red:             { label: 'Red',               group: 'Semantic Colors', type: 'color', common: false, hint: 'Errors & destructive actions' },
    cyan:            { label: 'Cyan',              group: 'Semantic Colors', type: 'color', common: false, hint: 'Highlights & secondary info' },
    gold:            { label: 'Gold',              group: 'Semantic Colors', type: 'color', common: false, hint: 'Warnings & attention' },
    // Borders
    borderSubtle:    { label: 'Border Subtle',     group: 'Borders',         type: 'rgba',  common: false, hint: 'Dividers & separators' },
    borderDefault:   { label: 'Border Default',    group: 'Borders',         type: 'rgba',  common: false, hint: 'Standard element borders' },
    borderStrong:    { label: 'Border Strong',     group: 'Borders',         type: 'rgba',  common: false, hint: 'Inputs & interactive borders' },
    // gTile Regions
    regionBlue:      { label: 'Region Blue',       group: 'gTile Regions',   type: 'color', common: false, hint: 'First split region' },
    regionPurple:    { label: 'Region Purple',     group: 'gTile Regions',   type: 'color', common: false, hint: 'Second split region' },
    regionGreen:     { label: 'Region Green',      group: 'gTile Regions',   type: 'color', common: false, hint: 'Third split region' },
    regionGold:      { label: 'Region Gold',       group: 'gTile Regions',   type: 'color', common: false, hint: 'Fourth split region' },
    // Effects
    noiseOpacity:    { label: 'Noise Opacity',     group: 'Effects',         type: 'text',  common: false, hint: 'Texture grain intensity' },
    backdropBlur:    { label: 'Backdrop Blur',     group: 'Effects',         type: 'text',  common: false, hint: 'Background blur radius' },
    panelAlpha:      { label: 'Panel Alpha',       group: 'Effects',         type: 'text',  common: false, hint: 'Panel transparency level' },
  };

  // Group-level descriptions for the theme editor
  const THEME_GROUP_INFO = {
    'Accent':          { desc: 'Command bar, buttons, active states, focus rings', browserDesc: 'Toolbar & sidebar accent' },
    'Backgrounds':     { desc: 'Panels, modals, overlays, command bar', browserDesc: 'Browser background & toolbar' },
    'Text':            { desc: 'Labels, descriptions, placeholders across all overlays' },
    'Browse Mode':     { desc: 'Tab sidebar highlights, selection, badges, direction indicators' },
    'Semantic Colors': { desc: 'Toasts, status indicators, action button colors' },
    'Borders':         { desc: 'Panel edges, input borders, dividers, separators' },
    'gTile Regions':   { desc: 'Split-view region colors in the gTile overlay grid' },
    'Effects':         { desc: 'Noise texture, backdrop blur, panel transparency' },
  };

  // Command palette groups, in display order (section headers when the input is empty).
  // Commands name their group (see getStaticCommands); one group per enabled plugin is
  // appended at runtime by syncPluginCommandGroups().
  const COMMAND_GROUPS = [
    { id: 'tab-mgmt', label: 'Tab Management', icon: '\u{1F4CB}' },
    { id: 'navigation', label: 'Navigation', icon: '\u{1F9ED}' },
    { id: 'view', label: 'View & Browser', icon: '\u{1F5A5}' },
    { id: 'split', label: 'Split View', icon: '\u25EB' },
    { id: 'workspaces', label: 'Workspaces', icon: '\u{1F5C2}' },
    { id: 'folders', label: 'Folders', icon: '\u{1F4C1}' },
    { id: 'zenleap', label: 'ZenLeap', icon: '\u26A1' },
    { id: 'sessions', label: 'Sessions', icon: '\u{1F4BE}' },
    { id: 'plugins', label: 'Plugins', icon: '\u{1F9E9}' },
  ];
  const STATIC_COMMAND_GROUP_COUNT = COMMAND_GROUPS.length;

  // Command key → group id for the commands currently listed (read by the renderer)
  const _commandGroupMap = new Map();

  // Current settings (defaults + saved overrides)
  const S = {};

  // The pref is the single source of truth for settings shared by every window.
  // Writes are key-level read-merge-write (only keys this window changed), so two
  // windows never revert each other's changes; the other windows pick changes up
  // through a pref observer. NOTE: loadSettings() runs before CONFIG/log() exist,
  // so nothing on the load path may call log() or saveSettings().
  const SETTINGS_PREF = 'uc.zenleap.settings';
  const _settingsSynced = {};     // id -> JSON of the value last read from / written to the pref
  let _settingsSelfWrite = false;
  let _settingsCorruptSeen = null;  // last corrupt pref value this window reported

  function cloneSettingValue(value) {
    return (value && typeof value === 'object') ? JSON.parse(JSON.stringify(value)) : value;
  }

  // Parse the settings pref. Returns {} when unset; on corrupt JSON keeps a copy of the
  // raw string in a sibling pref instead of silently discarding it: one copy per
  // corrupt value, whichever window reads it first (REV-LCMDS-07).
  function readSettingsOverrides() {
    let raw = '';
    try {
      if (Services.prefs.getPrefType(SETTINGS_PREF) !== Services.prefs.PREF_STRING) return {};
      raw = Services.prefs.getStringPref(SETTINGS_PREF, '');
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
      throw new Error('settings pref is not a JSON object');
    } catch (e) {
      if (raw && raw !== _settingsCorruptSeen) {
        _settingsCorruptSeen = raw;
        // Every open window reads the pref: another one may have kept this value already
        const same = Services.prefs.getChildList(`${SETTINGS_PREF}.corrupt-`).find(p => {
          try { return Services.prefs.getStringPref(p, '') === raw; } catch (_) { return false; }
        });
        const backup = same || `${SETTINGS_PREF}.corrupt-${Date.now()}`;
        if (!same) {
          try { Services.prefs.setStringPref(backup, raw); } catch (_) {}
        }
        console.warn(`[ZenLeap] Saved settings are corrupt; using defaults. The original value was copied to about:config "${backup}".`, e);
      }
      return {};
    }
  }

  // Resolve one setting from saved overrides: migrate old formats, validate against
  // the schema, fall back to the default per key.
  function resolveSettingValue(id, schema, overrides, invalidIds) {
    if (Object.prototype.hasOwnProperty.call(overrides, id)) {
      let value = overrides[id];
      // Migrate showRelativeNumbers from boolean to select string (pre-3.x format)
      if (id === 'display.showRelativeNumbers' && typeof value === 'boolean') value = value ? 'always' : 'off';
      if (isValidSettingValue(value, schema)) return cloneSettingValue(value);
      console.warn(`[ZenLeap] Ignoring invalid saved value for setting "${id}":`, overrides[id]);
      invalidIds?.push(id);
    }
    return cloneSettingValue(schema.default);
  }

  // Persist the given keys from S (read-merge-write; keys equal to their default are removed).
  function writeSettingsKeys(ids) {
    if (!ids.length) return;
    const overrides = readSettingsOverrides();
    for (const id of ids) {
      const schema = SETTINGS_SCHEMA[id];
      if (!schema) continue;
      const json = JSON.stringify(S[id]);
      if (json === JSON.stringify(schema.default)) delete overrides[id];
      else overrides[id] = cloneSettingValue(S[id]);
      _settingsSynced[id] = json;
    }
    _settingsSelfWrite = true;
    try { Services.prefs.setStringPref(SETTINGS_PREF, JSON.stringify(overrides)); }
    catch (e) { reportError('Saving settings failed', e); }
    finally { _settingsSelfWrite = false; }
  }

  // Legacy prefs (pre-settings-modal, also exposed by old Sine preferences.json):
  // migrate once into the settings pref, then clear them so they stop overriding it.
  // A legacy pref holding its default value carries no user intent and is just cleared.
  function migrateLegacyPrefs() {
    const changed = [];
    try {
      if (Services.prefs.getPrefType('uc.zenleap.debug') === Services.prefs.PREF_BOOL) {
        if (Services.prefs.getBoolPref('uc.zenleap.debug')) { S['advanced.debug'] = true; changed.push('advanced.debug'); }
        Services.prefs.clearUserPref('uc.zenleap.debug');
      }
      if (Services.prefs.getPrefType('uc.zenleap.current_indicator') === Services.prefs.PREF_STRING) {
        const ind = Services.prefs.getStringPref('uc.zenleap.current_indicator');
        const schema = SETTINGS_SCHEMA['display.currentTabIndicator'];
        if (ind && ind !== schema.default && isValidSettingValue(ind, schema)) {
          S['display.currentTabIndicator'] = ind;
          changed.push('display.currentTabIndicator');
        }
        Services.prefs.clearUserPref('uc.zenleap.current_indicator');
      }
    } catch (e) { console.warn('[ZenLeap] Legacy pref migration failed:', e); }
    return changed;
  }

  function loadSettings() {
    const overrides = readSettingsOverrides();
    const invalidIds = [];
    const toWrite = [];
    for (const [id, schema] of Object.entries(SETTINGS_SCHEMA)) {
      S[id] = resolveSettingValue(id, schema, overrides, invalidIds);
      _settingsSynced[id] = JSON.stringify(Object.prototype.hasOwnProperty.call(overrides, id) && !invalidIds.includes(id) ? overrides[id] : schema.default);
      // Rewrite migrated values (e.g. boolean showRelativeNumbers) in their current format
      if (JSON.stringify(S[id]) !== _settingsSynced[id]) toWrite.push(id);
    }
    toWrite.push(...invalidIds, ...migrateLegacyPrefs());
    // Clear dismissed version when installed version changes (e.g. fresh install)
    if (S['updates.lastInstalledVersion'] !== VERSION) {
      S['updates.dismissedVersion'] = '';
      S['updates.lastInstalledVersion'] = VERSION;
      toWrite.push('updates.dismissedVersion', 'updates.lastInstalledVersion');
    }
    try { writeSettingsKeys([...new Set(toWrite)]); } catch (e) { console.warn('[ZenLeap] Could not persist migrated settings:', e); }
  }

  // Persist every setting this window changed since it last synced with the pref.
  // Callers keep the "mutate S, then saveSettings()" pattern; only changed keys are written.
  function saveSettings() {
    const changed = [];
    for (const id of Object.keys(SETTINGS_SCHEMA)) {
      if (JSON.stringify(S[id]) !== _settingsSynced[id]) changed.push(id);
    }
    writeSettingsKeys(changed);
  }

  // Another window (or about:config) changed the settings pref: adopt the changed keys.
  function reloadSettingsFromPref() {
    const overrides = readSettingsOverrides();
    const changed = [];
    for (const [id, schema] of Object.entries(SETTINGS_SCHEMA)) {
      const value = resolveSettingValue(id, schema, overrides);
      const json = JSON.stringify(value);
      if (json === _settingsSynced[id]) continue;
      _settingsSynced[id] = json;
      S[id] = value;
      changed.push(id);
    }
    if (changed.length === 0) return;
    log(`Settings changed in another window: ${changed.join(', ')}`);
    try {
      // (A theme being previewed stays on screen; leaving the picker applies the new one.)
      if (changed.some(id => id.startsWith('appearance.')) && !_themePreviewing) applyTheme();
      if (changed.some(id => id.startsWith('display.') || id.startsWith('keys.'))) updateRelativeNumbers();
      if (changed.includes('display.browsePreview') && !S['display.browsePreview']) hidePreviewPanel(true);
      if (changed.includes('display.searchAllWorkspaces')) {
        const wsBtn = document.getElementById('zenleap-search-ws-toggle');
        if (wsBtn) {
          wsBtn.textContent = S['display.searchAllWorkspaces'] ? 'All' : 'WS';
          wsBtn.classList.toggle('active', S['display.searchAllWorkspaces']);
        }
      }
      // Only for settings the view shows (the update check writes hidden keys)
      if (settingsMode && !settingsRecordingId && changed.some(id => !SETTINGS_SCHEMA[id]?.hidden)) {
        refreshSettingsViewWhenIdle();
      }
    } catch (e) { reportError('Applying settings changed in another window failed', e); }
  }

  // Re-render the open Settings view, but not under a field being edited: that
  // would throw away what is being typed (number/text fields commit on change).
  // Wait until the field loses focus instead (REV-LCMDS-08).
  let _settingsRefreshField = null; // the field whose blur will re-render
  function refreshSettingsViewWhenIdle() {
    const field = document.activeElement;
    const editing = !!field?.closest?.('#zenleap-settings-body') &&
      !!field.matches?.('input:not([type="checkbox"]), textarea, select');
    if (!editing) { renderSettingsContent(); return; }
    if (_settingsRefreshField === field) return;
    _settingsRefreshField = field;
    field.addEventListener('blur', () => {
      if (_settingsRefreshField !== field) return;
      _settingsRefreshField = null;
      if (settingsMode && !settingsRecordingId) renderSettingsContent();
    }, { once: true });
  }

  // Window-lifetime resources of the settings / plugins / updater code (pref and
  // observer-service observers, the dialog key router, the plugin system). They are
  // released once: on window unload, or earlier when the core teardown() (Sine
  // hot-unload) calls teardownPluginSystem(). Registrations happen at script load,
  // before the core's teardown registry is initialized, hence this separate list.
  const _regionTeardown = [];
  let _regionTornDown = false;

  function onRegionTeardown(fn) {
    _regionTeardown.push(fn);
  }

  function teardownCommandsRegion() {
    if (_regionTornDown) return;
    _regionTornDown = true;
    window.removeEventListener('unload', teardownCommandsRegion);
    for (const fn of _regionTeardown.splice(0).reverse()) {
      try { fn(); } catch (e) { reportError('Teardown step failed', e); }
    }
  }
  window.addEventListener('unload', teardownCommandsRegion, { once: true });

  const _settingsPrefObserver = {
    observe() {
      if (_settingsSelfWrite) return;
      reloadSettingsFromPref();
    },
  };

  // Follow settings changes made by other windows (registered at script load).
  function watchSettingsPref() {
    Services.prefs.addObserver(SETTINGS_PREF, _settingsPrefObserver);
    onRegionTeardown(() => Services.prefs.removeObserver(SETTINGS_PREF, _settingsPrefObserver));
  }

  function resetSetting(id) {
    const schema = SETTINGS_SCHEMA[id];
    if (!schema) return;
    S[id] = cloneSettingValue(schema.default);
    saveSettings();
    if (id === 'appearance.theme' || id === 'appearance.applyToBrowser') applyTheme();
    if (id === 'display.showRelativeNumbers') updateRelativeNumbers();
    if (id === 'display.persistEssentialMarks') {
      if (S[id]) saveEssentialMarks();
      else try { Services.prefs.clearUserPref('uc.zenleap.essentialMarks'); } catch(e) {}
    }
  }

  function resetAllSettings() {
    for (const [id, schema] of Object.entries(SETTINGS_SCHEMA)) {
      S[id] = cloneSettingValue(schema.default);
    }
    saveSettings();
    applyTheme();
    updateRelativeNumbers();
    saveEssentialMarks();
  }

  // ── Export / Import ──

  function exportSettings() {
    const overrides = {};
    for (const [id, schema] of Object.entries(SETTINGS_SCHEMA)) {
      if (schema.hidden) continue;
      if (JSON.stringify(S[id]) !== JSON.stringify(schema.default)) {
        overrides[id] = S[id];
      }
    }
    const payload = {
      _zenleap: true,
      version: VERSION,
      exportedAt: new Date().toISOString(),
      settings: overrides,
    };
    const json = JSON.stringify(payload, null, 2);
    (async () => {
      try {
        // Resolve downloads directory cross-platform:
        // 1. Downloads module (handles macOS/Windows/Linux/XDG correctly)
        // 2. browser.download.dir pref (user override)
        // 3. Home directory fallback
        let downloadsDir;
        try {
          const { Downloads } = ChromeUtils.importESModule('resource://gre/modules/Downloads.sys.mjs');
          downloadsDir = await Downloads.getPreferredDownloadsDirectory();
        } catch (e1) {
          try {
            downloadsDir = Services.prefs.getStringPref('browser.download.dir');
          } catch (e2) {
            downloadsDir = PathUtils.join(PathUtils.homeDir, 'Downloads');
          }
        }
        const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const filePath = PathUtils.join(downloadsDir, `zenleap-settings-${ts}.json`);
        await IOUtils.writeUTF8(filePath, json, { tmpPath: `${filePath}.tmp` });
        showSettingsToast('success', 'Settings exported to Downloads');
      } catch (e) {
        reportError('Exporting settings failed', e);
        showSettingsToast('error', 'Export failed');
      }
    })();
  }

  function importSettingsFromFile() {
    const MAX_FILE_SIZE = 1024 * 1024; // 1 MB guard
    // In chrome context, use nsIFilePicker if available, else hidden <input>
    if (typeof Cc !== 'undefined' && Cc['@mozilla.org/filepicker;1']) {
      const fp = Cc['@mozilla.org/filepicker;1'].createInstance(Ci.nsIFilePicker);
      fp.init(window.browsingContext, 'Import ZenLeap Settings', Ci.nsIFilePicker.modeOpen);
      fp.appendFilter('JSON Files', '*.json');
      fp.appendFilters(Ci.nsIFilePicker.filterAll);
      fp.open(async (result) => {
        if (result === Ci.nsIFilePicker.returnOK && fp.file) {
          try {
            const info = await IOUtils.stat(fp.file.path);
            if (info.size > MAX_FILE_SIZE) {
              showSettingsToast('error', 'File too large (max 1 MB)');
              return;
            }
            const bytes = await IOUtils.read(fp.file.path);
            const text = new TextDecoder().decode(bytes);
            processImportedJSON(text);
          } catch (e) {
            reportError('Reading the settings file failed', e);
            showSettingsToast('error', 'Failed to read file');
          }
        }
      });
    } else {
      // Fallback: hidden file input
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json,application/json';
      input.style.display = 'none';
      input.addEventListener('change', () => {
        const file = input.files[0];
        if (!file) { input.remove(); return; }
        if (file.size > MAX_FILE_SIZE) {
          showSettingsToast('error', 'File too large (max 1 MB)');
          input.remove();
          return;
        }
        const reader = new FileReader();
        reader.onload = () => processImportedJSON(reader.result);
        reader.onerror = () => showSettingsToast('error', 'Failed to read file');
        reader.readAsText(file);
        input.remove();
      });
      document.documentElement.appendChild(input);
      input.click();
    }
  }

  function isValidSettingValue(value, schema) {
    switch (schema.type) {
      case 'toggle': return typeof value === 'boolean';
      case 'number':
        if (typeof value !== 'number' || !Number.isFinite(value)) return false;
        if (schema.min !== undefined && value < schema.min) return false;
        if (schema.max !== undefined && value > schema.max) return false;
        return true;
      case 'text': case 'color': return typeof value === 'string';
      case 'key': return typeof value === 'string' && value.length > 0;
      case 'select': return typeof value === 'string' && (!schema.options || schema.options.some(o => o.value === value));
      case 'combo':
        return typeof value === 'object' && value !== null && !Array.isArray(value) &&
          typeof value.key === 'string' && value.key.length > 0 &&
          (value.code === undefined || typeof value.code === 'string') &&
          ['ctrl', 'shift', 'alt', 'meta'].every(m => value[m] === undefined || typeof value[m] === 'boolean');
      default: return true;
    }
  }

  function processImportedJSON(text) {
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      showSettingsToast('error', 'Invalid JSON file');
      return;
    }
    if (!data || typeof data !== 'object') {
      showSettingsToast('error', 'Invalid settings file');
      return;
    }
    // Accept both { _zenleap, settings: {...} } and raw overrides object
    const incoming = data._zenleap ? (data.settings || {}) : data;
    if (typeof incoming !== 'object') {
      showSettingsToast('error', 'Invalid settings format');
      return;
    }

    // Build diff of changes (only valid values)
    const changes = [];
    const validIncoming = {};
    for (let [id, newVal] of Object.entries(incoming)) {
      const schema = SETTINGS_SCHEMA[id];
      if (!schema || schema.hidden) continue;
      // Old exports stored showRelativeNumbers as a boolean
      if (id === 'display.showRelativeNumbers' && typeof newVal === 'boolean') newVal = newVal ? 'always' : 'off';
      if (!isValidSettingValue(newVal, schema)) continue;
      validIncoming[id] = newVal;
      if (JSON.stringify(S[id]) !== JSON.stringify(newVal)) {
        changes.push({ id, label: schema.label, from: S[id], to: newVal, schema });
      }
    }

    if (changes.length === 0) {
      showSettingsToast('success', 'Settings already match \u2014 nothing to change');
      return;
    }

    showImportConfirmation(changes, validIncoming);
  }

  function applyImportedSettings(incoming) {
    for (const [id, value] of Object.entries(incoming)) {
      const schema = SETTINGS_SCHEMA[id];
      if (!schema || schema.hidden) continue;
      S[id] = cloneSettingValue(value);
    }
    saveSettings();
    applyTheme();
    updateRelativeNumbers();
    if (S['display.persistEssentialMarks']) saveEssentialMarks();
    else try { Services.prefs.clearUserPref('uc.zenleap.essentialMarks'); } catch(e) {}
    renderSettingsContent();
    showSettingsToast('success', 'Settings imported successfully');
  }

  // ── Settings toast notification ──

  let settingsToastEl = null;

  function showSettingsToast(type, message) {
    if (settingsToastEl) { try { settingsToastEl.remove(); } catch(e) {} settingsToastEl = null; }
    const toast = document.createElement('div');
    toast.className = `zenleap-settings-toast ${type}`;

    const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    icon.setAttribute('viewBox', '0 0 24 24');
    icon.setAttribute('fill', 'none');
    icon.setAttribute('stroke', 'currentColor');
    icon.setAttribute('stroke-width', type === 'success' ? '2.5' : '2');
    icon.setAttribute('stroke-linecap', 'round');
    icon.setAttribute('stroke-linejoin', 'round');

    if (type === 'success') {
      const poly = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
      poly.setAttribute('points', '20 6 9 17 4 12');
      icon.appendChild(poly);
    } else {
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', '12'); circle.setAttribute('cy', '12'); circle.setAttribute('r', '10');
      const l1 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      l1.setAttribute('x1', '15'); l1.setAttribute('y1', '9'); l1.setAttribute('x2', '9'); l1.setAttribute('y2', '15');
      const l2 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      l2.setAttribute('x1', '9'); l2.setAttribute('y1', '9'); l2.setAttribute('x2', '15'); l2.setAttribute('y2', '15');
      icon.appendChild(circle); icon.appendChild(l1); icon.appendChild(l2);
    }

    const text = document.createElement('span');
    text.textContent = message;

    toast.appendChild(icon);
    toast.appendChild(text);
    document.documentElement.appendChild(toast);
    settingsToastEl = toast;

    setTimeout(() => {
      toast.style.animation = 'zenleap-settings-toast-out 0.2s ease-in forwards';
      setTimeout(() => { try { toast.remove(); } catch(e) {} if (settingsToastEl === toast) settingsToastEl = null; }, 200);
    }, 2500);
  }

  // ── Import confirmation dialog ──

  function showImportConfirmation(changes, incoming) {
    dismissImportConfirmation();

    const overlay = document.createElement('div');
    overlay.id = 'zenleap-import-overlay';

    const backdrop = document.createElement('div');
    backdrop.className = 'zenleap-import-backdrop';
    backdrop.addEventListener('click', dismissImportConfirmation);

    const dialog = document.createElement('div');
    dialog.className = 'zenleap-import-dialog';

    // Header
    const header = document.createElement('div');
    header.className = 'zenleap-import-dialog-header';

    const iconWrap = document.createElement('div');
    iconWrap.className = 'zenleap-import-dialog-icon';
    const importSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    importSvg.setAttribute('viewBox', '0 0 24 24');
    importSvg.setAttribute('fill', 'none');
    importSvg.setAttribute('stroke', 'currentColor');
    importSvg.setAttribute('stroke-width', '2');
    importSvg.setAttribute('stroke-linecap', 'round');
    importSvg.setAttribute('stroke-linejoin', 'round');
    const p1 = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
    p1.setAttribute('points', '17 8 12 3 7 8');
    const l1 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    l1.setAttribute('x1', '12'); l1.setAttribute('y1', '3'); l1.setAttribute('x2', '12'); l1.setAttribute('y2', '15');
    const p2 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    p2.setAttribute('d', 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4');
    importSvg.appendChild(p1); importSvg.appendChild(l1); importSvg.appendChild(p2);
    iconWrap.appendChild(importSvg);

    const titleWrap = document.createElement('div');
    const title = document.createElement('div');
    title.className = 'zenleap-import-dialog-title';
    title.textContent = 'Import Settings';
    const subtitle = document.createElement('div');
    subtitle.className = 'zenleap-import-dialog-subtitle';
    subtitle.textContent = 'Review changes before applying';
    titleWrap.appendChild(title);
    titleWrap.appendChild(subtitle);

    header.appendChild(iconWrap);
    header.appendChild(titleWrap);

    // Changes list
    const changesList = document.createElement('div');
    changesList.className = 'zenleap-import-changes';

    for (const change of changes) {
      const row = document.createElement('div');
      row.className = 'zenleap-import-change-row';

      const name = document.createElement('span');
      name.className = 'zenleap-import-change-name';
      name.textContent = change.label;

      const fromEl = document.createElement('span');
      fromEl.className = 'zenleap-import-change-from';
      fromEl.textContent = formatImportValue(change.from, change.schema);

      const arrow = document.createElement('span');
      arrow.className = 'zenleap-import-change-arrow';
      arrow.textContent = '\u2192';

      const toEl = document.createElement('span');
      toEl.className = 'zenleap-import-change-to';
      toEl.textContent = formatImportValue(change.to, change.schema);

      row.appendChild(name);
      row.appendChild(fromEl);
      row.appendChild(arrow);
      row.appendChild(toEl);
      changesList.appendChild(row);
    }

    // Summary
    const totalSettings = Object.keys(SETTINGS_SCHEMA).filter(id => !SETTINGS_SCHEMA[id].hidden).length;
    const summary = document.createElement('div');
    summary.className = 'zenleap-import-summary';

    const infoSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    infoSvg.setAttribute('width', '14'); infoSvg.setAttribute('height', '14');
    infoSvg.setAttribute('viewBox', '0 0 24 24');
    infoSvg.setAttribute('fill', 'none');
    infoSvg.style.color = 'var(--zl-accent)';
    infoSvg.setAttribute('stroke', 'currentColor');
    infoSvg.setAttribute('stroke-width', '2');
    infoSvg.setAttribute('stroke-linecap', 'round');
    infoSvg.setAttribute('stroke-linejoin', 'round');
    const ic = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    ic.setAttribute('cx', '12'); ic.setAttribute('cy', '12'); ic.setAttribute('r', '10');
    const il1 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    il1.setAttribute('x1', '12'); il1.setAttribute('y1', '16'); il1.setAttribute('x2', '12'); il1.setAttribute('y2', '12');
    const il2 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    il2.setAttribute('x1', '12'); il2.setAttribute('y1', '8'); il2.setAttribute('x2', '12.01'); il2.setAttribute('y2', '8');
    infoSvg.appendChild(ic); infoSvg.appendChild(il1); infoSvg.appendChild(il2);

    const summaryText = document.createElement('span');
    const strong = document.createElement('strong');
    strong.textContent = changes.length;
    summaryText.appendChild(strong);
    summaryText.appendChild(document.createTextNode(` setting${changes.length === 1 ? '' : 's'} will be changed \u00B7 ${totalSettings - changes.length} unchanged`));

    summary.appendChild(infoSvg);
    summary.appendChild(summaryText);

    // Actions
    const actions = document.createElement('div');
    actions.className = 'zenleap-import-dialog-actions';

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'zenleap-import-btn-cancel';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.addEventListener('click', dismissImportConfirmation);

    const applyBtn = document.createElement('button');
    applyBtn.className = 'zenleap-import-btn-apply';
    applyBtn.textContent = 'Apply Changes';
    applyBtn.addEventListener('click', () => {
      dismissImportConfirmation();
      applyImportedSettings(incoming);
    });

    actions.appendChild(cancelBtn);
    actions.appendChild(applyBtn);

    dialog.appendChild(header);
    dialog.appendChild(changesList);
    dialog.appendChild(summary);
    dialog.appendChild(actions);

    overlay.appendChild(backdrop);
    overlay.appendChild(dialog);
    document.documentElement.appendChild(overlay);

    // Keyboard: Enter/Space press the focused button (Apply first; the user picked
    // the file and sees the changes), Tab/arrows switch buttons, Escape cancels.
    const buttons = [cancelBtn, applyBtn];
    _importDialog = {
      returnFocus: document.commandDispatcher?.focusedElement || null,
      pop: pushDialog(overlay, (event) => {
        if (event.key === 'Escape') {
          dismissImportConfirmation();
        } else if (event.key === 'Enter' || event.key === ' ') {
          if (!event.repeat) (buttons.includes(document.activeElement) ? document.activeElement : applyBtn).click();
        } else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
          buttons[event.key === 'ArrowLeft' ? 0 : 1].focus();
        } else if (event.key === 'Tab') {
          (document.activeElement === cancelBtn ? applyBtn : cancelBtn).focus();
        }
        return true; // modal: nothing else gets keys while it is open
      }, { overViews: true }),
    };
    applyBtn.focus();
  }

  let _importDialog = null; // { pop, returnFocus } while the import confirmation is open

  function dismissImportConfirmation() {
    const existing = document.getElementById('zenleap-import-overlay');
    if (existing) existing.remove();
    const dialog = _importDialog;
    _importDialog = null;
    if (dialog) {
      dialog.pop();
      // Back to where focus was in Settings (e.g. its search box)
      if (settingsMode && dialog.returnFocus?.isConnected) dialog.returnFocus.focus();
    }
  }

  function formatImportValue(value, schema) {
    if (schema?.type === 'combo' && typeof value === 'object') {
      return formatKeyDisplay(value, schema);
    }
    if (schema?.type === 'toggle') return value ? 'on' : 'off';
    if (typeof value === 'string' && value.length > 12) return value.slice(0, 12) + '\u2026';
    return String(value);
  }

  // Option-layer characters the US macOS layout types for the default Alt
  // shortcuts. Matching those by physical key is safe; other layouts type
  // real characters there (Option+L is @ on German, ł on Polish).
  const MAC_US_OPTION_KEYS = { KeyH: '\u02D9', KeyJ: '\u2206', KeyK: '\u02DA', KeyL: '\u00AC', Space: '\u00A0' };

  // `key` values that don't identify a key: a combo recorded with one must
  // match by physical key (else Option+E, stored as 'Dead', matched every dead key).
  const OPAQUE_KEY_NAMES = new Set(['Dead', 'Unidentified', 'Process']);
  const isPrintableAscii = k => typeof k === 'string' && k.length === 1 && k >= ' ' && k <= '~';

  let _macOptionHintShown = false;

  // Helper: check if a keyboard event matches a combo-type setting
  function matchCombo(event, combo) {
    if (!combo || typeof combo !== 'object') return false;
    if (!!event.ctrlKey !== !!combo.ctrl || !!event.shiftKey !== !!combo.shift ||
        !!event.altKey !== !!combo.alt || !!event.metaKey !== !!combo.meta) return false;
    // AltGr types characters (€, ę, @; Windows reports it as Ctrl+Alt): never
    // a shortcut. (macOS: Option is handled below.)
    if (!IS_MACOS && event.getModifierState?.('AltGraph')) return false;
    const want = combo.key;
    if (typeof want === 'string' && !OPAQUE_KEY_NAMES.has(want)) {
      // navKey: layout-aware (Ctrl+' on a Russian layout, Ctrl+dead ' on US-Intl)
      const keys = [event.key, navKey(event)];
      if (keys.includes(want)) return true;
      // Letters: Shift (or Caps Lock) changes the case of event.key; the
      // modifiers were compared above (Meta+Shift+T arrives as key 'T').
      if (want.length === 1 && keys.some(k => k.length === 1 && k.toLowerCase() === want.toLowerCase())) return true;
    }
    if (!combo.code || event.code !== combo.code) return false;
    // Physical-key fallback. On macOS, Option changes `key` to the layout's
    // Option character; only fall back when that is not a real character,
    // unless the user opted in (LEAP-B-01). Elsewhere Alt doesn't change `key`
    // (AltGr isn't altKey).
    if (IS_MACOS && event.altKey) {
      if (S['keys.physicalAltFallback'] || event.key === 'Dead' || event.key === 'Unidentified' ||
          MAC_US_OPTION_KEYS[event.code] === event.key) return true;
      if (!_macOptionHintShown) {
        _macOptionHintShown = true;
        console.info(`[ZenLeap] Option+${event.code.replace(/^Key/, '')} typed "${event.key}" on this keyboard layout, so the ZenLeap shortcut ${formatKeyDisplay(combo, { type: 'combo' })} did not run. To use Option shortcuts by physical key, turn on Settings > Keybindings > "Match Option Shortcuts by Physical Key (macOS)".`);
      }
      return false;
    }
    // Otherwise only for keys that type no ASCII character here (Alt+J on
    // Cyrillic, dead keys) or bindings recorded as one. A different ASCII
    // character is a different key on this layout: Ctrl+/ recorded on US must
    // not fire on German's Ctrl+- (same physical key).
    return !(isPrintableAscii(event.key) && isPrintableAscii(want));
  }

  // Helper: format a key setting for display
  function formatKeyDisplay(value, schema) {
    if (schema?.type === 'combo' && typeof value === 'object') {
      const parts = [];
      if (value.ctrl) parts.push('Ctrl');
      if (value.shift) parts.push('Shift');
      if (value.alt) parts.push('Alt');
      if (value.meta) parts.push('Meta');
      parts.push(formatSingleKey(value.key));
      return parts.join(' + ');
    }
    return formatSingleKey(value);
  }

  function formatSingleKey(key) {
    const map = { ' ': 'Space', 'arrowdown': '↓', 'arrowup': '↑', 'arrowleft': '←', 'arrowright': '→', 'enter': 'Enter', 'escape': 'Esc', 'tab': 'Tab', 'backspace': '⌫', "'": "'", '`': '`' };
    return map[key] || key;
  }

  loadSettings();
  watchSettingsPref();

  // Legacy CONFIG compat — thin wrapper around S for any remaining references
  const CONFIG = {
    get debug() { return S['advanced.debug']; },
    get currentTabIndicator() { return S['display.currentTabIndicator']; },
    get leapModeTimeout() { return S['timing.leapTimeout']; },
    get triggerKey() { return S['keys.global.leapMode'].key; },
    get triggerModifier() { return 'ctrlKey'; },
  };



  // Modifier keys to ignore when pressed alone
  const MODIFIER_KEYS = ['Shift', 'Control', 'Alt', 'Meta', 'CapsLock'];

  // State
  let leapMode = false;
  let browseMode = false;      // true when navigating with j/k
  let zMode = false;           // true after pressing 'z', waiting for z/t/b
  let gMode = false;           // true after pressing 'g', waiting for g or number
  let markMode = false;        // true after pressing 'm', waiting for mark character
  let gotoMarkMode = false;    // true after pressing "'", waiting for mark character
  let gNumberBuffer = '';      // accumulates digits for absolute tab positioning
  let gNumberTimeout = null;   // timeout for multi-digit number entry
  let leapModeTimeout = null;
  let leapOverlay = null;

  // Browse mode state. The highlight is an element (tab or folder); highlightedTabIndex
  // is its position in getVisibleItems(), re-derived by syncHighlight() (see there).
  let highlightedItem = null;
  let highlightedTabIndex = -1;
  let originalTabIndex = -1;
  let originalTab = null;      // direct reference to the tab that triggered browse mode
  let browseDirection = null;  // 'up' or 'down' - initial direction
  let browseGPending = false;  // true after pressing 'g' in browse mode, waiting for second 'g'
  let browseGTimeout = null;   // timeout to cancel pending 'g' in browse mode
  let browseNumberBuffer = ''; // accumulates multi-digit numbers in browse mode
  let browseNumberTimeout = null; // timeout to execute accumulated number jump
  let selectedItems = new Set();  // Set of tab/folder references for multi-select
  let yankItems = [];            // Array of tab/folder references for yank/paste

  // Tab preview state (browse mode)
  let previewPanel = null;
  let previewDebounceTimer = null;
  let previewCurrentTab = null;
  let previewCaptureId = 0;        // Monotonic counter to cancel stale async captures
  let previewCache = new Map();    // tab -> { dataUrl, timestamp }
  const PREVIEW_CACHE_TTL = 30000; // 30 seconds
  const PREVIEW_CAPTURE_DEBOUNCE_MS = 150; // Internal debounce for screenshot capture after panel shows

  // Sidebar state (for compact mode)
  let sidebarWasExpanded = false;  // Track if we expanded the sidebar
  let quickNavPeekTimer = null;    // Timer for hiding sidebar after Alt+J/K peek
  let quickNavPeeking = false;     // True while sidebar is peeked for quick nav

  // Input interception: prevent keyboard events from leaking to web page content
  let contentFocusStolen = false;
  let quickNavRestoreTimer = null;   // Timer to restore focus after Alt+HJKL

  // Jump list (like vim's Ctrl+O / Ctrl+I)
  // Jump list size uses settings: S['display.maxJumpListSize']
  let jumpList = [];           // Array of tab references
  let jumpListIndex = -1;      // Current position in jump list
  let recordingJumps = true;   // Flag to temporarily disable recording

  // Marks (like vim marks)
  let marks = new Map();       // character -> tab reference

  // ============================================
  // TAB SEARCH (Spotlight-like fuzzy finder)
  // ============================================
  let searchMode = false;
  let searchQuery = '';
  let searchResults = [];
  let searchSelectedIndex = 0;
  let searchVimMode = 'insert';  // 'insert' or 'normal'
  let searchCursorPos = 0;
  // jj-to-normal-mode state
  // jj threshold is now configurable via S['timing.jjThreshold']
  let jjPending = false;          // true while waiting for a possible second j
  let jjPendingTimeout = null;    // timeout handle for flushing a single j
  let jjSavedValue = null;        // input value snapshot before first j
  let jjSavedCursor = 0;          // cursor position snapshot before first j
  let searchModal = null;
  let searchInput = null;
  let searchInputDisplay = null;  // Visual display for normal mode with block cursor
  let searchResultsList = null;
  let searchHintBar = null;       // Hint bar below results
  let searchVimIndicator = null;
  let searchBreadcrumb = null;    // Breadcrumb for command sub-flows

  // URL bar vim mode state (Cmd+L / Cmd+T native browser bar)
  let urlbarVimMode = 'insert';   // 'insert' or 'normal'
  let urlbarCursorPos = 0;
  let urlbarVimActive = false;    // true while URL bar is focused and we're managing it
  let urlbarVimIndicator = null;  // INSERT/NORMAL badge in URL bar
  let urlbarVimSetupDone = false; // Tracks if listeners have been attached
  let urlbarSuppressKeypress = false; // Set by keydown handler, cleared by keypress handler
  // jj-to-normal-mode state for URL bar
  let urlbarJjPending = false;
  let urlbarJjPendingTimeout = null;
  let urlbarJjSavedValue = null;
  let urlbarJjSavedCursor = 0;

  // Command mode state
  let commandMode = false;        // true when in command palette mode
  let commandQuery = '';           // search query within command mode
  let commandResults = [];         // filtered command list
  let commandSubFlow = null;      // current sub-flow: { type, data, label }
  let commandSubFlowStack = [];   // breadcrumb stack for nested sub-flows
  let commandMatchedTabs = [];    // tabs matched during select-matching-tabs flow
  let dedupTabsToClose = [];      // tabs identified as duplicates to be closed in dedup-preview
  let commandRecency = new Map(); // key -> timestamp of last execution (for recency ranking)
  let commandEnteredFromSearch = false; // true if entered via '>' from search, false if via Ctrl+Shift+/
  let browseCommandMode = false;        // true when command bar was opened from browse mode
  let browseCommandTabs = [];           // tabs to operate on (selected tabs from browse mode, or highlighted tab)
  let savedBrowseState = null;          // saved browse state to restore on cancel/return

  // Session management state
  let sessionCache = null;         // { sessions: [], loadedAt: timestamp } — brief cache for picker
  let sessionLoadPromise = null;   // In-flight load promise to prevent duplicate disk reads

  // Folder delete modal state (browse mode)
  let folderDeleteMode = false;
  let folderDeleteTarget = null;
  let folderDeleteModal = null;
  let folderUndoStack = [];  // Stack of { type, folderLabel, tabRefs, ... } for undo

  // Help modal
  let helpMode = false;
  let helpModal = null;

  // Reorganize workspaces modal
  let reorgMode = false;
  let reorgModal = null;
  let reorgFocusIndex = 0;       // Currently focused workspace index
  let reorgWorkspaces = [];      // Working copy of workspaces array [{uuid, name, icon}]
  let reorgMovingIndex = -1;     // Index being moved (-1 = not moving)
  let reorgDragState = null;     // Mouse drag state: { index, startY, currentY, clone }
  let reorgOriginalOrder = [];   // Snapshot for detecting changes

  // Settings modal
  let settingsMode = false;
  let settingsModal = null;
  let settingsActiveTab = 'Keybindings';
  let settingsSearchQuery = '';
  let settingsRecordingId = null;
  let settingsRecordingHandler = null;

  // About page state
  let aboutUpdateState = null; // null | 'checking' | 'available' | 'uptodate' | 'error'
  let aboutRemoteVersion = null;

  // Switch Theme shows the highlighted theme without saving it (applyTheme(id));
  // leaving the picker without picking one re-applies the saved theme.
  let _themePreviewing = false;

  // Theme editor state
  let themeEditorActive = false;
  let themeEditorKey = null;
  let themeEditorDraft = {};
  let themeEditorName = '';
  let themeEditorBase = 'meridian';
  let themeEditorExpandedGroups = new Set();

  // gTile mode state
  let gtileMode = false;
  let gtileOverlay = null;
  let gtileFocusedTab = null;
  let gtileSubMode = 'move';         // 'move' or 'resize'
  let gtileActiveRegionIdx = 0;      // Index into gtileTabRects (move mode)
  let gtileHeld = false;             // Tab "picked up" in move mode
  let gtileCursor = { col: 0, row: 0 }; // Cell cursor (resize mode)
  let gtileSelecting = false;
  let gtileAnchor = null;            // { col, row } - resize selection start
  let gtileTabRects = [];            // Tab regions: { tab, left, top, right, bottom, color }
  let gtileRegionElements = new Map(); // tab -> DOM element (for animated transitions)
  let gtileMouseHints = false;       // Show mouse hints when hovering grid
  let gtileDrag = null;              // Move mode mouse drag state
  let gtileMouseSelecting = false;   // Resize mode mouse drag-select active
  let gtileGhostEl = null;           // Ghost element for drag placeholder
  let _gtileDocAbort = null;          // AbortController for gTile document-level listeners

  const GTILE_COLS = 6;
  const GTILE_ROWS = 4;
  const GTILE_REGION_COLORS = ['blue', 'purple', 'green', 'yellow'];

  // Utility: Convert relative distance to display string (always numeric)
  function numberToDisplay(num) {
    if (num === 0) return CONFIG.currentTabIndicator;
    return String(num);
  }

  // ============================================
  // JUMP LIST (like vim's Ctrl+O / Ctrl+I)
  // ============================================

  // Clean up closed tabs from jump list, preserving correct index
  function filterJumpList() {
    if (jumpList.length === 0) return;
    const currentEntry = (jumpListIndex >= 0 && jumpListIndex < jumpList.length)
      ? jumpList[jumpListIndex] : null;
    jumpList = jumpList.filter(isLiveTab);
    if (currentEntry) {
      const newIndex = jumpList.indexOf(currentEntry);
      jumpListIndex = newIndex >= 0 ? newIndex : Math.min(jumpListIndex, jumpList.length - 1);
    } else {
      jumpListIndex = jumpList.length - 1;
    }
  }

  // Record a jump to the jump list
  function recordJump(tab) {
    if (!recordingJumps || !tab) return;
    // A Glance preview is recorded as its parent tab
    try { tab = window.gZenGlanceManager?.getTabOrGlanceParent?.(tab) || tab; } catch (e) { /* keep tab */ }

    // Clean up any closed tabs from the list
    filterJumpList();

    // If we're not at the end of the list, truncate forward history
    if (jumpListIndex >= 0 && jumpListIndex < jumpList.length - 1) {
      jumpList = jumpList.slice(0, jumpListIndex + 1);
    }

    // Don't record if same as current position
    if (jumpList.length > 0 && jumpList[jumpList.length - 1] === tab) {
      return;
    }

    jumpList.push(tab);
    jumpListIndex = jumpList.length - 1;

    // Trim if too long (the limit may have been lowered in settings since the last jump)
    const excess = jumpList.length - S['display.maxJumpListSize'];
    if (excess > 0) {
      jumpList.splice(0, excess);
      jumpListIndex -= excess;
    }

    log(`Recorded jump, list size: ${jumpList.length}, index: ${jumpListIndex}`);
  }

  // Select a tab that may live in another workspace. With record=true the jump list
  // gets exactly origin -> target. Recording is paused while Zen switches workspace,
  // because Zen first selects the target workspace's last-selected tab, which must not
  // become a jump entry. changeWorkspaceWithID() never rejects (Zen catches internally),
  // so success is verified afterwards. Resolves to true if the tab ended up selected.
  async function switchToTabAcrossWorkspaces(tab, { record = true } = {}) {
    if (!tab || tab.closing || !tab.isConnected) return false;
    const origin = currentTab();
    const wsId = tab.getAttribute('zen-workspace-id');
    const needsSwitch = !!(wsId && window.gZenWorkspaces && !tab.hasAttribute('zen-essential') &&
      wsId !== gZenWorkspaces.activeWorkspace);
    if (tab === origin && !needsSwitch) return true;
    if (record) recordJump(origin);
    const wasRecording = recordingJumps;
    recordingJumps = false;
    try {
      if (needsSwitch) {
        await gZenWorkspaces.changeWorkspaceWithID(wsId);
        if (gZenWorkspaces.activeWorkspace !== wsId) {
          reportError('Switching workspace failed', new Error(`workspace ${wsId} did not become active`));
          return false;
        }
        if (tab.closing || !tab.isConnected) return false;
      }
      gBrowser.selectedTab = tab;
    } finally {
      recordingJumps = wasRecording;
    }
    if (record) recordJump(tab);
    return true;
  }

  // Jump backward in the jump list (like vim Ctrl+O)
  let _jumpSwitchInProgress = false;
  function jumpBack() {
    if (_jumpSwitchInProgress) return false;
    // Clean up closed tabs
    filterJumpList();

    if (jumpList.length === 0) {
      log('Jump list is empty');
      return false;
    }

    // If we haven't recorded current position yet, do it now
    if (jumpListIndex === jumpList.length - 1 && currentTab() !== jumpList[jumpListIndex]) {
      recordJump(currentTab());
    }

    if (jumpListIndex > 0) {
      jumpToListIndex(jumpListIndex - 1, 'back');
      return true;
    }

    log('Already at beginning of jump list');
    return false;
  }

  // Jump forward in the jump list (like vim Ctrl+I)
  function jumpForward() {
    if (_jumpSwitchInProgress) return false;
    // Clean up closed tabs
    filterJumpList();

    if (jumpListIndex < jumpList.length - 1) {
      jumpToListIndex(jumpListIndex + 1, 'forward');
      return true;
    }

    log('Already at end of jump list');
    return false;
  }

  // Move the jump-list cursor to newIndex and select that entry without recording it.
  // Same-workspace targets are selected synchronously; the cursor is restored if the
  // switch fails (closed tab, workspace switch did not happen).
  function jumpToListIndex(newIndex, direction) {
    const prevIndex = jumpListIndex;
    jumpListIndex = newIndex;
    _jumpSwitchInProgress = true;
    switchToTabAcrossWorkspaces(jumpList[newIndex], { record: false }).then((ok) => {
      if (ok) {
        log(`Jumped ${direction} to index ${jumpListIndex}`);
      } else {
        jumpListIndex = prevIndex;
        log(`Jump ${direction} failed (tab closed or workspace switch failed)`);
      }
    }).catch((e) => {
      jumpListIndex = prevIndex;
      reportError(`Jump ${direction} failed`, e);
    }).finally(() => {
      _jumpSwitchInProgress = false;
    });
  }

  // ============================================
  // MARKS (like vim marks)
  // ============================================

  // Set a mark on the current tab (or toggle off if same mark on same tab)
  function setMark(char, tab) {
    if (!tab) tab = currentTab();

    // Check if this exact mark is already on this tab - if so, toggle it off
    if (marks.get(char) === tab) {
      marks.delete(char);
      _pluginEventBus.emit('mark:cleared', { char });
      log(`Toggled off mark '${char}' from tab`);
      saveEssentialMarks();
      updateRelativeNumbers();
      return;
    }

    // Remove any existing mark on this tab (one tab = one mark)
    for (const [key, markedTab] of marks) {
      if (markedTab === tab) {
        marks.delete(key);
        log(`Removed existing mark '${key}' from tab`);
        break;
      }
    }

    // Set the new mark (overwrites if char already used on different tab)
    marks.set(char, tab);
    _pluginEventBus.emit('mark:set', { char, tab });
    log(`Set mark '${char}' on tab`);

    // Persist and update display
    saveEssentialMarks();
    updateRelativeNumbers();
  }

  // Clear all marks
  function clearAllMarks() {
    const count = marks.size;
    marks.clear();
    _pluginEventBus.emit('marks:cleared', { count });
    log(`Cleared all marks (${count} marks removed)`);
    saveEssentialMarks();
    updateRelativeNumbers();
  }

  // ── Persistent essential tab marks ──
  // Marks are per window; marks on essential tabs are also persisted (by URL) in a pref
  // shared by all windows. Writes are key-level: a window only rewrites the characters
  // it marks itself, and only deletes an entry while the pref still holds the URL that
  // this window wrote/restored, so windows never clobber each other's marks.

  const ESSENTIAL_MARKS_PREF = 'uc.zenleap.essentialMarks';
  const _essentialMarksOwned = new Map(); // char -> URL this window last wrote to / restored from the pref

  function readEssentialMarksPref() {
    try {
      if (Services.prefs.getPrefType(ESSENTIAL_MARKS_PREF) !== Services.prefs.PREF_STRING) return {};
      const saved = JSON.parse(Services.prefs.getStringPref(ESSENTIAL_MARKS_PREF));
      return (saved && typeof saved === 'object' && !Array.isArray(saved)) ? saved : {};
    } catch (e) {
      console.warn('[ZenLeap] Ignoring corrupt essential marks pref:', e);
      return {};
    }
  }

  function saveEssentialMarks() {
    if (!S['display.persistEssentialMarks']) return;
    if (isPrivateWindow()) return; // never persist URLs from private windows
    const saved = readEssentialMarksPref();
    let changed = false;
    for (const char of new Set([...marks.keys(), ..._essentialMarksOwned.keys()])) {
      const tab = marks.get(char);
      const url = (isLiveTab(tab) && tab.hasAttribute('zen-essential'))
        ? tab.linkedBrowser?.currentURI?.spec : null;
      if (url && url !== 'about:blank') {
        if (saved[char] !== url) { saved[char] = url; changed = true; }
        _essentialMarksOwned.set(char, url);
      } else if (_essentialMarksOwned.has(char)) {
        // Only remove what this window put there; another window may have re-used the char since
        if (saved[char] === _essentialMarksOwned.get(char)) { delete saved[char]; changed = true; }
        _essentialMarksOwned.delete(char);
      }
    }
    if (!changed) return;
    try {
      Services.prefs.setStringPref(ESSENTIAL_MARKS_PREF, JSON.stringify(saved));
    } catch (e) { reportError('Saving essential tab marks failed', e); }
  }

  function restoreEssentialMarks(retriesLeft = 5) {
    if (!S['display.persistEssentialMarks']) return;
    try {
      const saved = readEssentialMarksPref();

      // Build a URL → tab lookup for essential tabs only (consume matched tabs to handle duplicates)
      const essentialByUrl = new Map();
      for (const tab of gBrowser.tabs) {
        if (!tab.hasAttribute('zen-essential') || tab.closing || !tab.parentNode) continue;
        const url = tab.linkedBrowser?.currentURI?.spec;
        if (url && url !== 'about:blank') {
          if (!essentialByUrl.has(url)) essentialByUrl.set(url, []);
          essentialByUrl.get(url).push(tab);
        }
      }

      let restored = 0;
      const unmatched = {};
      for (const [char, url] of Object.entries(saved)) {
        if (typeof char !== 'string' || char.length !== 1 || typeof url !== 'string') continue;
        if (marks.has(char)) continue; // Already restored in a prior retry
        const tabs = essentialByUrl.get(url);
        if (tabs && tabs.length > 0) {
          marks.set(char, tabs.shift()); // Consume the first matching tab
          _essentialMarksOwned.set(char, url);
          restored++;
        } else {
          unmatched[char] = url;
        }
      }
      if (restored > 0) {
        updateRelativeNumbers();
        log(`Restored ${restored} essential tab mark(s)`);
      }

      // Retry for unmatched marks (tabs may still be loading from about:blank)
      if (Object.keys(unmatched).length > 0 && retriesLeft > 0) {
        log(`${Object.keys(unmatched).length} essential mark(s) unmatched, retrying in 1s (${retriesLeft} left)`);
        setTimeout(() => restoreEssentialMarks(retriesLeft - 1), 1000);
      } else if (Object.keys(unmatched).length > 0) {
        dropStaleEssentialMarks(unmatched);
      }
    } catch (e) { reportError('Restoring essential tab marks failed', e); }
  }

  // Restoring gave up: no Essential has these URLs any more (removed while the
  // browser was closed). Drop their entries, which no window can ever claim,
  // unless the pref changed meanwhile. Essentials are the same in every window;
  // a pending one is matched by its session URL too (REV-LCMDS-12).
  function dropStaleEssentialMarks(unmatched) {
    if (isPrivateWindow()) return;
    const urls = new Set();
    for (const tab of gBrowser.tabs) {
      if (!tab.hasAttribute('zen-essential')) continue;
      urls.add(tab.linkedBrowser?.currentURI?.spec);
      try {
        const state = JSON.parse(SessionStore.getTabState(tab));
        const entry = state.entries?.[(state.index || state.entries.length) - 1];
        if (entry?.url) urls.add(entry.url);
      } catch (e) { /* not tracked */ }
    }
    const saved = readEssentialMarksPref();
    const stale = Object.keys(unmatched).filter(char => saved[char] === unmatched[char] && !urls.has(unmatched[char]) && !marks.has(char));
    if (!stale.length) return;
    for (const char of stale) delete saved[char];
    try {
      Services.prefs.setStringPref(ESSENTIAL_MARKS_PREF, JSON.stringify(saved));
      log(`Dropped essential mark(s) ${stale.join(', ')}: their Essentials no longer exist`);
    } catch (e) { reportError('Saving essential tab marks failed', e); }
  }

  // Go to a marked tab
  function goToMark(char) {
    const tab = marks.get(char);
    if (!tab) {
      log(`Mark '${char}' not found`);
      return false;
    }

    if (tab.closing || !tab.parentNode) {
      // Tab was closed, remove the mark
      marks.delete(char);
      saveEssentialMarks();
      log(`Mark '${char}' tab was closed, removing mark`);
      return false;
    }

    // Essential tabs are global, so no workspace switch is needed for them
    switchToTabAcrossWorkspaces(tab).then((ok) => {
      if (ok) {
        _pluginEventBus.emit('mark:jumped', { char, tab });
        log(`Jumped to mark '${char}'`);
      } else if (tab.closing || !tab.isConnected) {
        marks.delete(char);
        saveEssentialMarks();
        log(`Mark '${char}' tab closed during workspace switch, removing mark`);
      }
    }).catch(e => reportError('Jump to mark failed', e));
    return true;
  }

  // Clean up marks for closed tabs
  function cleanupMarks() {
    let cleaned = false;
    for (const [char, tab] of marks) {
      if (!tab || tab.closing || !tab.parentNode) {
        marks.delete(char);
        cleaned = true;
        log(`Cleaned up mark '${char}' for closed tab`);
      }
    }
    if (cleaned) saveEssentialMarks();
  }

  // ============================================
  // TAB SEARCH FUNCTIONS
  // ============================================

  // Lowercase without changing the string length, so match indices computed on the
  // lowered string stay valid for the original (e.g. 'İ'.toLowerCase() is 2 units long).
  function lowerSameLength(text) {
    const lower = text.toLowerCase();
    if (lower.length === text.length) return lower;
    let out = '';
    for (let i = 0; i < text.length; i++) {
      const c = text[i].toLowerCase();
      out += c.length === 1 ? c : c[0];
    }
    return out;
  }

  // Fuzzy match algorithm for a single term - returns { score, indices } or null if no match
  function fuzzyMatchSingle(query, text) {
    if (!query || !text) return null;

    const queryLower = lowerSameLength(query);
    const textLower = lowerSameLength(text);
    const queryLen = queryLower.length;
    const textLen = textLower.length;

    if (queryLen > textLen) return null;

    // Check for exact substring match first — gives large bonus
    const exactPos = textLower.indexOf(queryLower);
    if (exactPos >= 0) {
      const indices = [];
      for (let i = 0; i < queryLen; i++) indices.push(exactPos + i);
      // Large bonus for exact substring: base + length bonus (must beat fuzzy * max recency multiplier)
      let exactScore = 200 + queryLen * 25;
      // Extra bonus if match starts at a word boundary
      if (exactPos === 0 || /[\s\-_./]/.test(text[exactPos - 1])) {
        exactScore += 50;
      }
      // Extra bonus if query matches the full word
      const afterEnd = exactPos + queryLen;
      if ((exactPos === 0 || /[\s\-_./]/.test(text[exactPos - 1])) &&
          (afterEnd >= textLen || /[\s\-_./]/.test(text[afterEnd]))) {
        exactScore += 30;
      }
      // Bonus for earlier position
      exactScore -= exactPos * 0.5;
      return { score: exactScore, indices };
    }

    // Fallback to fuzzy matching
    let score = 0;
    let queryIdx = 0;
    let indices = [];
    let lastMatchIdx = -1;
    let consecutiveMatches = 0;

    for (let i = 0; i < textLen && queryIdx < queryLen; i++) {
      if (textLower[i] === queryLower[queryIdx]) {
        indices.push(i);

        // Bonus for consecutive matches
        if (lastMatchIdx === i - 1) {
          consecutiveMatches++;
          score += 10 + consecutiveMatches * 5;
        } else {
          consecutiveMatches = 0;
          score += 5;
        }

        // Bonus for word boundary match
        if (i === 0 || /[\s\-_./]/.test(text[i - 1])) {
          score += 15;
        }

        // Bonus for case match
        if (query[queryIdx] === text[i]) {
          score += 2;
        }

        // Penalty for distance from start
        score -= i * 0.1;

        lastMatchIdx = i;
        queryIdx++;
      }
    }

    // Must match all query characters
    if (queryIdx !== queryLen) return null;

    return { score, indices };
  }

  // Score, filter, and sort picker results by fuzzy match relevance.
  // Matched characters inside the label are returned as labelIndices for highlighting.
  function fuzzyFilterAndSort(results, query) {
    if (!query) return results;
    const scored = [];
    for (const r of results) {
      const target = `${r.label} ${(r.tags || []).join(' ')}`;
      const match = fuzzyMatchSingle(query, target);
      if (match) {
        const labelLen = r.label.length;
        scored.push({ ...r, score: match.score, labelIndices: match.indices.filter(i => i < labelLen) });
      }
    }
    scored.sort((a, b) => b.score - a.score);
    return scored;
  }

  // Parse search query into exact terms (quoted) and fuzzy terms (unquoted)
  // Example: '"YouTube" test "GitHub"' → { exactTerms: ["YouTube", "GitHub"], fuzzyTerms: ["test"] }
  let _parsedQueryCache = { query: null, parsed: null };
  function parseSearchQuery(query) {
    if (!query) return { exactTerms: [], fuzzyTerms: [] };
    // fuzzyMatch() runs once per tab per keystroke with the same query; parse it once
    if (_parsedQueryCache.query === query) return _parsedQueryCache.parsed;

    const exactTerms = [];
    // Match double-quoted strings as exact match terms
    const remaining = query.replace(/"([^"]+)"/g, (_, term) => {
      exactTerms.push(term);
      return ' ';
    });

    const fuzzyTerms = remaining.trim().split(/\s+/).filter(w => w.length > 0);
    const parsed = { exactTerms, fuzzyTerms };
    _parsedQueryCache = { query, parsed };
    return parsed;
  }

  // Exact match - finds all occurrences of term in text (case-insensitive)
  // Returns array of character indices where the term matches
  function exactMatchIndices(term, text) {
    if (!term || !text) return null;
    const termLower = lowerSameLength(term);
    const textLower = lowerSameLength(text);
    const idx = textLower.indexOf(termLower);
    if (idx === -1) return null;

    const indices = [];
    for (let i = idx; i < idx + term.length; i++) {
      indices.push(i);
    }
    return indices;
  }

  // Multi-word fuzzy match - splits query into words, ALL words must match
  // Each word can match in either title or URL
  // Supports exact matching with "quoted terms" and fuzzy matching for unquoted words
  // Returns { score, titleIndices, urlIndices } or null if any word doesn't match
  function fuzzyMatch(query, title, url) {
    if (!query) return null;

    const { exactTerms, fuzzyTerms } = parseSearchQuery(query);
    if (exactTerms.length === 0 && fuzzyTerms.length === 0) return null;

    let totalScore = 0;
    let allTitleIndices = [];
    let allUrlIndices = [];

    // Check exact terms first — ALL must match (AND logic)
    for (const term of exactTerms) {
      const titleIdx = exactMatchIndices(term, title || '');
      const urlIdx = exactMatchIndices(term, url || '');

      if (!titleIdx && !urlIdx) {
        return null; // Exact term not found anywhere
      }

      // Exact matches get high score bonus (title weighted 2x)
      if (titleIdx) {
        totalScore += term.length * 20; // High bonus for exact title match
        allTitleIndices.push(...titleIdx);
      }
      if (urlIdx) {
        totalScore += term.length * 10;
        allUrlIndices.push(...urlIdx);
      }
    }

    // Check fuzzy terms — ALL must match
    for (const word of fuzzyTerms) {
      const titleMatch = fuzzyMatchSingle(word, title || '');
      const urlMatch = fuzzyMatchSingle(word, url || '');

      // Word must match in either title or url
      if (!titleMatch && !urlMatch) {
        return null; // This word doesn't match anywhere, fail the whole query
      }

      // Use the better match (title weighted 2x)
      const titleScore = titleMatch ? titleMatch.score * 2 : 0;
      const urlScore = urlMatch ? urlMatch.score : 0;

      // Add both scores if both match, otherwise just the one that matched
      if (titleMatch && urlMatch) {
        // Both match - use combined score but avoid double counting
        totalScore += Math.max(titleScore, urlScore) + Math.min(titleScore, urlScore) * 0.3;
        allTitleIndices.push(...titleMatch.indices);
        allUrlIndices.push(...urlMatch.indices);
      } else if (titleMatch) {
        totalScore += titleScore;
        allTitleIndices.push(...titleMatch.indices);
      } else {
        totalScore += urlScore;
        allUrlIndices.push(...urlMatch.indices);
      }
    }

    // Bonus for matching more terms (encourages specific searches)
    totalScore += (exactTerms.length + fuzzyTerms.length) * 5;

    return {
      score: totalScore,
      titleIndices: [...new Set(allTitleIndices)].sort((a, b) => a - b),
      urlIndices: [...new Set(allUrlIndices)].sort((a, b) => a - b)
    };
  }

  // Centralized accessor for tab last-accessed time.
  // Firefox exposes `tab.lastAccessed` (public API) and `tab._lastAccessed`
  // (internal). Using a single helper avoids inconsistent field access.
  function getTabLastAccessed(tab) {
    const pub = tab.lastAccessed;
    if (pub && typeof pub === 'number' && pub > 0) return pub;
    const priv = tab._lastAccessed;
    if (priv && typeof priv === 'number' && priv > 0) return priv;
    return 0;
  }

  // Calculate recency multiplier for a tab (0.8 to 1.8)
  // Uses exponential decay: recently accessed tabs get boosted, old tabs get penalized
  // Formula: multiplier = 0.8 + 1.0 × e^(-ageMinutes / 12)
  //
  // | Age        | Multiplier | Effect       |
  // |------------|------------|--------------|
  // | 0 min      | 1.80       | +80% boost   |
  // | 3 min      | 1.58       | +58% boost   |
  // | 10 min     | 1.23       | +23% boost   |
  // | 20 min     | 0.99       | neutral      |
  // | 30 min     | 0.88       | -12% penalty |
  // | 1 hour     | 0.81       | -19% penalty |
  // | 1 day+     | 0.80       | -20% floor   |
  //
  function calculateRecencyMultiplier(tab) {
    const lastAccessed = getTabLastAccessed(tab);

    if (lastAccessed > 0) {
      const now = Date.now();
      const ageMs = Math.max(0, now - lastAccessed);
      const ageMinutes = ageMs / (1000 * 60);

      const multiplier = S['advanced.tabRecencyFloor'] + S['advanced.tabRecencyRange'] * Math.exp(-ageMinutes / S['advanced.tabRecencyHalflife']);
      return multiplier;
    }

    // Fallback: neutral multiplier when lastAccessed unavailable
    return 1.0;
  }

  // Sort tabs by recency (most recently accessed first)
  // Uses lastAccessed where available, falls back to 0 for tabs without it
  function sortTabsByRecency(tabs) {
    if (tabs.length === 0) return tabs;

    // Check if any tab has lastAccessed data
    const hasAnyRecency = tabs.some(t => getTabLastAccessed(t) > 0);

    if (!hasAnyRecency) {
      log('lastAccessed not available on any tab, using default order');
      return tabs;
    }

    // Sort by lastAccessed descending (most recent first)
    return [...tabs].sort((a, b) => getTabLastAccessed(b) - getTabLastAccessed(a));
  }

  // Search tabs and return sorted results
  // Combines fuzzy match score with recency bonus for ranking
  // Omits the current tab from results (you don't need to search for where you already are)
  function searchTabs(query, { includeCurrent = false } = {}) {
    const current = currentTab();

    // Get searchable tabs (respects cross-workspace setting), optionally excluding current
    const tabs = includeCurrent
      ? getSearchableTabs()
      : getSearchableTabs().filter(tab => tab !== current);

    // Empty query: return tabs sorted purely by recency
    if (!query || query.trim() === '') {
      const sortedTabs = sortTabsByRecency(tabs);
      return sortedTabs.slice(0, S['display.maxSearchResults']).map((tab, idx) => ({
        tab,
        score: 100 - idx,
        titleIndices: [],
        urlIndices: [],
        workspaceName: getTabWorkspaceName(tab),
        isEssential: tab.hasAttribute('zen-essential')
      }));
    }

    // With query: combine fuzzy match score × recency multiplier
    const results = [];

    tabs.forEach((tab, idx) => {
      const title = tab.label || '';
      const url = tab.linkedBrowser?.currentURI?.spec || '';

      // Multi-word fuzzy match (supports "exact" and fuzzy terms)
      const match = fuzzyMatch(query, title, url);

      if (match) {
        const matchScore = match.score;
        const recencyMultiplier = calculateRecencyMultiplier(tab);
        const totalScore = matchScore * recencyMultiplier;

        results.push({
          tab,
          score: totalScore,
          matchScore,
          recencyMultiplier,
          titleIndices: match.titleIndices,
          urlIndices: match.urlIndices,
          workspaceName: getTabWorkspaceName(tab),
          isEssential: tab.hasAttribute('zen-essential')
        });
      }
    });

    // Sort by combined score descending
    results.sort((a, b) => b.score - a.score);

    return results.slice(0, S['display.maxSearchResults']);
  }

  // Create search modal
  function createSearchModal() {
    if (searchModal) return;

    searchModal = document.createElement('div');
    searchModal.id = 'zenleap-search-modal';

    const backdrop = document.createElement('div');
    backdrop.id = 'zenleap-search-backdrop';
    backdrop.addEventListener('click', () => exitSearchMode());

    const container = document.createElement('div');
    container.id = 'zenleap-search-container';

    const inputWrapper = document.createElement('div');
    inputWrapper.id = 'zenleap-search-input-wrapper';

    const searchIcon = document.createElement('span');
    searchIcon.id = 'zenleap-search-icon';
    searchIcon.textContent = '🔍';

    searchInput = document.createElement('input');
    searchInput.id = 'zenleap-search-input';
    searchInput.type = 'text';
    searchInput.placeholder = 'Search tabs...';
    searchInput.autocomplete = 'off';
    searchInput.spellcheck = false;
    searchInput.setAttribute('tabindex', '0');

    // Display element for normal mode - shows text with block cursor
    searchInputDisplay = document.createElement('div');
    searchInputDisplay.id = 'zenleap-search-input-display';
    searchInputDisplay.style.display = 'none';

    searchVimIndicator = document.createElement('span');
    searchVimIndicator.id = 'zenleap-search-vim-indicator';
    searchVimIndicator.textContent = 'INSERT';

    // Cross-workspace toggle button (created via createElement for chrome context safety)
    const wsToggle = document.createElement('button');
    wsToggle.id = 'zenleap-search-ws-toggle';
    wsToggle.title = 'Toggle cross-workspace search';
    wsToggle.textContent = S['display.searchAllWorkspaces'] ? 'All' : 'WS';
    wsToggle.classList.toggle('active', S['display.searchAllWorkspaces']);
    wsToggle.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggleCrossWorkspaceSearch();
      searchInput.focus();
    });

    inputWrapper.appendChild(searchIcon);
    inputWrapper.appendChild(searchInput);
    inputWrapper.appendChild(searchInputDisplay);
    inputWrapper.appendChild(wsToggle);
    inputWrapper.appendChild(searchVimIndicator);

    searchBreadcrumb = document.createElement('div');
    searchBreadcrumb.id = 'zenleap-search-breadcrumb';
    searchBreadcrumb.style.display = 'none';

    searchResultsList = document.createElement('div');
    searchResultsList.id = 'zenleap-search-results';

    // Event delegation for click handlers (avoids re-attaching per render)
    searchResultsList.addEventListener('click', (e) => {
      const resultEl = e.target.closest('.zenleap-search-result, .zenleap-command-result');
      if (!resultEl) return;
      const idx = parseInt(resultEl.dataset.index);
      if (isNaN(idx)) return;
      if (commandMode) {
        searchSelectedIndex = idx;
        handleCommandSelect();
      } else {
        selectSearchResult(idx);
      }
    });

    // Event delegation for favicon errors
    searchResultsList.addEventListener('error', (e) => {
      if (e.target.matches('.zenleap-search-result-favicon')) {
        e.target.src = 'chrome://branding/content/icon32.png';
      }
    }, true); // useCapture for error events (they don't bubble)

    searchHintBar = document.createElement('div');
    searchHintBar.id = 'zenleap-search-hint-bar';

    container.appendChild(inputWrapper);
    container.appendChild(searchBreadcrumb);
    container.appendChild(searchResultsList);
    container.appendChild(searchHintBar);

    searchModal.appendChild(backdrop);
    searchModal.appendChild(container);

    // Inject styles
    injectStyleBlock('zenleap-search-styles', `
      #zenleap-search-modal {
        position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
        z-index: 100000; display: none; justify-content: center;
        align-items: flex-start; padding-top: 15vh;
      }
      #zenleap-search-modal.active { display: flex; }

      #zenleap-search-backdrop {
        position: absolute; top: 0; left: 0; width: 100%; height: 100%;
        background: var(--zl-backdrop);
        backdrop-filter: blur(var(--zl-backdrop-blur));
      }

      #zenleap-search-container {
        position: relative; width: 90%; max-width: 600px;
        background: var(--zl-bg-surface);
        border-radius: var(--zl-r-xl);
        box-shadow: var(--zl-shadow-modal);
        overflow: hidden;
        animation: zenleap-search-appear 0.28s cubic-bezier(0.16, 1, 0.3, 1) both;
        font-family: var(--zl-font-ui);
      }

      @keyframes zenleap-search-appear {
        from { opacity: 0; transform: scale(0.96) translateY(-8px); }
        to { opacity: 1; transform: scale(1) translateY(0); }
      }

      #zenleap-search-input-wrapper {
        display: flex; align-items: center;
        padding: 14px 20px; gap: 12px;
        border-bottom: 1px solid var(--zl-border-subtle);
      }

      #zenleap-search-icon {
        color: var(--zl-text-tertiary); font-size: 15px; flex-shrink: 0; opacity: 0.7;
      }

      #zenleap-search-input,
      #zenleap-search-input-display {
        flex: 1; background: transparent; border: none; outline: none;
        font-size: 15px; font-weight: 400;
        color: var(--zl-text-primary);
        font-family: var(--zl-font-ui);
        height: 27px; line-height: 27px; padding: 0; margin: 0; box-sizing: border-box;
      }

      #zenleap-search-input { caret-color: var(--zl-accent); }
      #zenleap-search-input::placeholder { color: var(--zl-text-muted); }
      #zenleap-search-input-display { white-space: pre; }

      #zenleap-search-input-display .cursor-char {
        background: var(--zl-accent); color: var(--zl-bg-base);
        animation: zenleap-cursor-char-blink 1s step-end infinite;
      }
      #zenleap-search-input-display .cursor-empty {
        display: inline-block; width: 0; height: 1em;
        vertical-align: text-bottom;
        border-left: 2px solid var(--zl-accent);
        margin-left: -1px;
        animation: zenleap-cursor-empty-blink 1s step-end infinite;
      }
      @keyframes zenleap-cursor-char-blink {
        0%, 100% { background-color: var(--zl-accent); }
        50% { background-color: transparent; color: var(--zl-text-primary); }
      }
      @keyframes zenleap-cursor-empty-blink {
        0%, 100% { opacity: 1; }
        50% { opacity: 0; }
      }
      #zenleap-search-input-display .placeholder { color: var(--zl-text-muted); }

      #zenleap-search-ws-toggle {
        font-family: var(--zl-font-mono); font-size: 9px; font-weight: 600;
        letter-spacing: 0.5px; text-transform: uppercase;
        padding: 3px 8px; border-radius: 4px;
        background: var(--zl-border-subtle);
        color: var(--zl-text-tertiary);
        border: 1px solid var(--zl-border-default);
        cursor: pointer; transition: all 0.15s; flex-shrink: 0;
      }
      #zenleap-search-ws-toggle:hover {
        background: var(--zl-border-default);
        color: var(--zl-text-secondary);
      }
      #zenleap-search-ws-toggle.active {
        background: color-mix(in srgb, var(--zl-purple) 12%, transparent);
        color: var(--zl-purple);
        border-color: color-mix(in srgb, var(--zl-purple) 25%, transparent);
      }

      #zenleap-search-vim-indicator {
        font-family: var(--zl-font-mono); font-size: 9px; font-weight: 700;
        letter-spacing: 0.5px; text-transform: uppercase;
        padding: 3px 8px; border-radius: 4px;
        background: var(--zl-accent); color: var(--zl-bg-base);
        flex-shrink: 0;
      }
      #zenleap-search-vim-indicator.normal { background: var(--zl-gold); }

      #zenleap-search-results {
        max-height: 60vh; overflow-y: auto;
        scrollbar-width: thin; scrollbar-color: var(--zl-border-strong) transparent;
      }

      .zenleap-search-result {
        display: flex; align-items: center; padding: 10px 20px; gap: 12px;
        cursor: pointer; transition: background 0.1s;
        border-left: 2px solid transparent;
      }

      .zenleap-search-result:hover { background: var(--zl-bg-raised); }
      .zenleap-search-result.selected {
        background: var(--zl-accent-dim);
        border-left-color: var(--zl-accent);
      }

      .zenleap-search-result-favicon {
        width: 20px; height: 20px; border-radius: 5px;
        object-fit: contain; flex-shrink: 0;
        background: var(--zl-bg-elevated); padding: 2px;
      }

      .zenleap-search-result-info { flex: 1; min-width: 0; overflow: hidden; }

      .zenleap-search-result-title {
        font-size: 13px; font-weight: 500; color: var(--zl-text-primary);
        display: flex; align-items: center; gap: 8px; margin-bottom: 1px; min-width: 0;
        white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      }
      .zenleap-search-result-title-text {
        white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        flex: 1; min-width: 0;
      }
      .zenleap-search-result-url {
        font-size: 11px; color: var(--zl-text-tertiary);
        white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      }
      .zenleap-search-result-title .match,
      .zenleap-search-result-url .match {
        color: var(--zl-accent-bright); font-weight: 600;
      }

      .zenleap-search-result-badges {
        display: inline-flex; align-items: center; gap: 6px; flex-shrink: 0;
      }
      .zenleap-search-result-badge {
        display: inline-flex; align-items: center;
        font-size: 10px; font-weight: 600;
        padding: 1px 7px; border-radius: 999px;
        white-space: nowrap;
        border: 1px solid transparent;
        letter-spacing: 0.02em;
      }
      .zenleap-search-result-ws {
        background: rgba(167,139,219,0.12); color: var(--zl-purple);
        border-color: rgba(167,139,219,0.22);
      }
      .zenleap-search-result-essential {
        background: color-mix(in srgb, var(--zl-gold) 14%, transparent);
        color: var(--zl-gold);
        border-color: color-mix(in srgb, var(--zl-gold) 32%, transparent);
      }

      .zenleap-search-result-label {
        font-family: var(--zl-font-mono); font-size: 11px; font-weight: 600;
        padding: 3px 8px; border-radius: 5px;
        background: var(--zl-bg-elevated); color: var(--zl-text-tertiary);
        flex-shrink: 0;
      }
      .zenleap-search-result.selected .zenleap-search-result-label {
        background: var(--zl-accent); color: var(--zl-bg-base);
      }

      .zenleap-search-empty {
        padding: 48px 20px; text-align: center;
        color: var(--zl-text-muted); font-size: 13px;
      }

      #zenleap-search-hint-bar {
        display: flex; gap: 10px; justify-content: center; flex-wrap: wrap;
        padding: 8px 16px;
        border-top: 1px solid var(--zl-border-subtle);
        font-size: 11px; color: var(--zl-text-muted);
        font-family: var(--zl-font-ui);
      }
      #zenleap-search-hint-bar span {
        display: inline-flex; align-items: center; gap: 5px;
      }
      #zenleap-search-hint-bar kbd {
        display: inline-flex; align-items: center; justify-content: center;
        min-width: 18px; height: 18px; padding: 0 5px;
        font-family: var(--zl-font-mono); font-size: 9px; font-weight: 600;
        color: var(--zl-text-secondary);
        background: var(--zl-bg-raised);
        border: 1px solid var(--zl-border-strong);
        border-radius: 4px;
        box-shadow: var(--zl-shadow-kbd);
      }

      /* ═══ Command mode ═══ */
      #zenleap-search-breadcrumb {
        display: flex; align-items: center; padding: 8px 20px; gap: 6px;
        border-bottom: 1px solid var(--zl-border-subtle);
        font-size: 12px; color: var(--zl-text-secondary);
        font-family: var(--zl-font-mono);
      }
      .zenleap-breadcrumb-item { color: var(--zl-accent); }
      .zenleap-breadcrumb-sep { color: var(--zl-text-muted); }

      .zenleap-command-result {
        display: flex; align-items: center; padding: 10px 20px; gap: 12px;
        cursor: pointer; transition: background 0.1s;
        border-left: 2px solid transparent;
      }
      .zenleap-command-result:hover { background: var(--zl-bg-raised); }
      .zenleap-command-result.selected {
        background: var(--zl-accent-dim);
        border-left-color: var(--zl-accent);
      }

      .zenleap-command-icon {
        width: 28px; height: 28px;
        display: flex; align-items: center; justify-content: center;
        font-size: 16px; flex-shrink: 0;
        border-radius: var(--zl-r-sm);
        background: var(--zl-bg-elevated);
        border: 1px solid var(--zl-border-subtle);
      }
      .zenleap-icon-img {
        width: 16px; height: 16px; object-fit: contain;
        -moz-context-properties: fill, fill-opacity;
        fill: currentColor;
      }

      .zenleap-command-info { flex: 1; min-width: 0; overflow: hidden; }

      .zenleap-command-label {
        font-size: 13px; font-weight: 500; color: var(--zl-text-primary);
        white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      }
      .zenleap-command-label:has(.zenleap-search-result-badges) {
        display: flex; align-items: center; gap: 8px; min-width: 0; text-overflow: clip;
      }
      .zenleap-command-label .match { color: var(--zl-accent-bright); font-weight: 600; }

      .zenleap-command-sublabel {
        font-size: 11px; color: var(--zl-text-tertiary);
        white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      }
      .zenleap-command-sublabel .match { color: var(--zl-accent-bright); font-weight: 600; }

      .zenleap-command-result-label {
        font-family: var(--zl-font-mono); font-size: 11px; font-weight: 600;
        padding: 3px 8px; border-radius: 5px;
        background: var(--zl-bg-elevated); color: var(--zl-text-tertiary);
        flex-shrink: 0;
      }
      .zenleap-command-result.selected .zenleap-command-result-label {
        background: var(--zl-accent); color: var(--zl-bg-base);
      }

      .zenleap-command-prefix {
        color: var(--zl-accent); font-weight: 700; font-size: 18px; flex-shrink: 0;
      }

      .zenleap-command-count {
        padding: 6px 20px; font-size: 12px; color: var(--zl-accent);
        font-family: var(--zl-font-mono);
        border-bottom: 1px solid var(--zl-border-subtle);
      }

      /* ═══ Command bar group headers ═══ */
      .zenleap-command-group-header {
        padding: 12px 20px 4px;
        font-size: 10px; font-weight: 600;
        letter-spacing: 1px; text-transform: uppercase;
        color: var(--zl-text-secondary);
        font-family: var(--zl-font-ui);
        pointer-events: none;
        user-select: none;
        display: flex; align-items: center; gap: 6px;
      }
      .zenleap-command-group-icon {
        font-size: 12px;
      }
      .zenleap-command-group-header:not(:first-child) {
        margin-top: 4px;
        border-top: 1px solid var(--zl-border-subtle);
        padding-top: 12px;
      }

      /* Session detail view */
      .zenleap-command-result.zenleap-session-header {
        border-top: 1px solid var(--zl-border-default);
        padding-top: 12px; pointer-events: none;
      }
      .zenleap-command-result.zenleap-session-header .zenleap-command-label {
        font-weight: 600; color: var(--zl-purple); font-size: 13px;
      }
      .zenleap-command-result.zenleap-session-header .zenleap-command-sublabel {
        color: var(--zl-text-muted);
      }
    `);

    document.documentElement.appendChild(searchModal);

    // Add input event listener
    searchInput.addEventListener('input', handleSearchInput);

    // Handle keydown on input for insert mode navigation
    searchInput.addEventListener('keydown', (e) => {
      // --- jj-to-normal-mode intercept (insert mode only, vim enabled, jj enabled) ---
      if (S['display.vimModeInBars'] && S['timing.jjEscape'] && searchVimMode === 'insert' &&
          e.key === 'j' && !e.ctrlKey && !e.altKey && !e.metaKey) {
        e.preventDefault();
        e.stopPropagation();
        if (jjPending) {
          // Second j within threshold → escape to normal mode + navigate down
          const savedVal = jjSavedValue;
          const savedCur = jjSavedCursor;
          cancelPendingJJ();
          // Restore input to pre-jj state (undo any leaked j)
          searchInput.value = savedVal !== null ? savedVal : '';
          if (commandMode) {
            commandQuery = searchInput.value;
            renderCommandResults();
          } else {
            searchQuery = searchInput.value;
            renderSearchResults();
          }
          searchCursorPos = savedCur;
          searchVimMode = 'normal';
          updateSearchVimIndicator();
          moveSearchSelection('down');
        } else {
          // First j → save state, hold it, wait for possible second j
          jjSavedValue = searchInput.value;
          jjSavedCursor = searchInput.selectionStart || 0;
          jjPending = true;
          jjPendingTimeout = setTimeout(flushPendingJ, S['timing.jjThreshold']);
        }
        return;
      }

      // Flush/cancel pending j when any other key arrives
      if (jjPending) {
        if (e.key === 'Escape') {
          cancelPendingJJ(); // discard held j on Escape
        } else {
          flushPendingJ();   // insert held j before processing this key
        }
      }

      // Let navigation/action keys propagate to handleSearchKeyDown
      if ((e.ctrlKey && (e.key === 'j' || e.key === 'k')) ||
          e.key === 'ArrowUp' || e.key === 'ArrowDown' ||
          e.key === 'Enter' || e.key === 'Escape' ||
          e.key === 'Tab') {
        return; // Let handleSearchKeyDown handle these
      }
      // In command mode, let Backspace propagate when input is empty (to exit command mode)
      if (commandMode && e.key === 'Backspace' && searchInput.value === '') {
        return; // Let handleSearchKeyDown handle this
      }
      // In command normal mode, let ALL keys propagate (handled by handleSearchKeyDown)
      if (commandMode && searchVimMode === 'normal') {
        return;
      }
      // Stop propagation for normal typing (but allow default behavior)
      e.stopPropagation();
    });

    log('Search modal created');
  }

  // Highlight matched characters in text. Consecutive matches share one span, and a
  // match on either half of a surrogate pair (emoji) highlights the whole character.
  function highlightMatches(text, indices) {
    if (!indices || indices.length === 0) return escapeHtml(text);

    const isHigh = (i) => { const c = text.charCodeAt(i); return c >= 0xD800 && c <= 0xDBFF; };
    const isLow = (i) => { const c = text.charCodeAt(i); return c >= 0xDC00 && c <= 0xDFFF; };
    const marked = new Set();
    for (const idx of indices) {
      if (idx < 0 || idx >= text.length) continue;
      marked.add(idx);
      if (isHigh(idx) && isLow(idx + 1)) marked.add(idx + 1);
      if (isLow(idx) && idx > 0 && isHigh(idx - 1)) marked.add(idx - 1);
    }

    let result = '';
    let i = 0;
    while (i < text.length) {
      const start = i;
      const inMatch = marked.has(i);
      while (i < text.length && marked.has(i) === inMatch) i++;
      const chunk = escapeHtml(text.slice(start, i));
      result += inMatch ? `<span class="match">${chunk}</span>` : chunk;
    }
    return result;
  }

  // Escape HTML special characters (XHTML-safe)
  function escapeHtml(text) {
    if (text == null) return '';
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }


  // ============================================
  // PLUGIN SYSTEM
  // ============================================
  //
  // External plugins live in <profile>/chrome/zenleap-plugins/<id>/{manifest.json,plugin.js}.
  // - plugin.js runs with full chrome privileges (same trust level as chrome/JS), each
  //   plugin in its own system-principal sandbox whose prototype is the browser window,
  //   so window globals (gBrowser, Services, document, timers) resolve as before.
  //   Disabling/uninstalling calls the plugin's destroy hook and nukes the sandbox.
  // - The manifest is validated and the enabled flag checked BEFORE plugin.js is read;
  //   newly discovered plugins start disabled until enabled in the Plugin Manager.
  // - Plugins run once per browser window. Their data (enabled flag, storage, settings)
  //   is shared by all windows: every window keeps the merged state in memory, changes
  //   are broadcast to the other windows and written atomically to
  //   zenleap-plugin-data.json. In private windows storage writes stay in memory for
  //   that window only (never persisted); settings (configuration) are saved.
  // - Plugin API notes: only ONE destroy hook runs (the object returned by init() if it
  //   has its own destroy(), otherwise ZenLeapPlugin.destroy(api)); events are delivered
  //   asynchronously; browser.getSelectedText() returns a Promise of the whole selection,
  //   except inside a page's text field (only its first 150 characters can be read there:
  //   browser.getSelection() resolves to { text, truncated } to tell); tabs.getAll()/findBy*
  //   cover the active workspace unless called with { allWorkspaces: true }. While a
  //   Glance is open, tabs.getCurrent() (and the tabs.* default tab) is the Glance's
  //   parent tab; browser.* acts on the page on screen (the Glance).
  //   commands.execute(key) runs a command without the palette's confirmation step
  //   (the plugin asked for it); commands that need input open the palette.
  //   tabs.closeOthers/closeToLeft/closeToRight, like the palette, leave pinned tabs and
  //   ZenRipple's agent tabs and pages open.
  //   init() throwing means no destroy() call; timers from the plugin's global
  //   setTimeout/setInterval are cleared when it is disabled.

  // ── Plugin State ──
  let _pluginRegistry = new Map();       // pluginId -> { manifest, enabled, loaded, instance, exports, sandbox, error, _dynamicCommands }
  let _pluginData = {};                  // pluginId -> { enabled, isNew?, storage, settings } — shared (persisted) state
  let _pluginManagerMode = false;
  let _pluginManagerModal = null;
  let _pluginManagerView = 'list';       // 'list' | 'detail'
  let _pluginManagerDetailId = null;
  let _pluginManagerFocus = 0;           // keyboard-focused card in the list view

  const PLUGIN_ID_RE = /^[a-zA-Z0-9_-]+$/;
  const PLUGIN_COMMAND_KEY_RE = /^[\w.:-]+$/;

  function safePluginText(value, fallback = '', maxLength = 200) {
    return typeof value === 'string' && value.trim() ? value.trim().slice(0, maxLength) : fallback;
  }

  // ── Plugin Event Bus ──
  // Handlers are called asynchronously (next task) so a slow plugin can never delay
  // tab switching or other ZenLeap work.
  const _pluginEventBus = {
    _listeners: new Map(),
    on(event, callback, pluginId) {
      if (typeof callback !== 'function') return;
      if (!this._listeners.has(event)) this._listeners.set(event, new Set());
      this._listeners.get(event).add({ callback, pluginId });
    },
    off(event, callback, pluginId) {
      const set = this._listeners.get(event);
      if (!set) return;
      for (const entry of set) {
        if (entry.callback === callback && (!pluginId || entry.pluginId === pluginId)) {
          set.delete(entry);
          break;
        }
      }
    },
    once(event, callback, pluginId) {
      const wrapper = (data) => {
        this.off(event, wrapper, pluginId);
        callback(data);
      };
      this.on(event, wrapper, pluginId);
    },
    _lastWorkspaceId: null,
    emit(event, data) {
      if (event === 'workspace:changed') {
        // More than one part of ZenLeap may listen to Zen's workspace changes; plugins
        // get one event per actual change, always with workspaceId.
        const workspaceId = data?.workspaceId || data?.workspace?.uuid || null;
        if (workspaceId && workspaceId === this._lastWorkspaceId) return;
        this._lastWorkspaceId = workspaceId;
        data = { workspaceId, workspace: data?.workspace || null };
      }
      const set = this._listeners.get(event);
      if (!set || set.size === 0) return;
      const entries = [...set];
      setTimeout(() => {
        for (const entry of entries) {
          if (!set.has(entry)) continue; // removed meanwhile
          try { entry.callback(data); }
          catch (e) { console.error(`[ZenLeap] Plugin "${entry.pluginId}" event handler error (${event}):`, e); }
        }
      }, 0);
    },
    removeAllForPlugin(pluginId) {
      for (const [, set] of this._listeners) {
        for (const entry of [...set]) {
          if (entry.pluginId === pluginId) set.delete(entry);
        }
      }
    },
  };

  // ── Plugin Data Persistence ──
  const _pluginDataPath = PathUtils.join(PathUtils.profileDir, 'chrome', 'zenleap-plugin-data.json');
  const PLUGIN_DATA_TOPIC = 'zenleap-plugin-data-changed';
  const PLUGIN_STORAGE_QUOTA = 512 * 1024; // 512KB per plugin
  const _windowUid = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  let _pluginSaveTimer = null;
  let _pluginSavePromise = Promise.resolve();
  let _pluginDataLoaded = false;          // true once the file was read (or found missing/quarantined)
  const _pluginDirty = new Map();         // pluginId -> Set of changed paths (see pluginPath())
  const _pendingRemotePluginChanges = []; // broadcasts received before our own load finished
  const _pluginPrivateOverlay = new Map(); // private windows: pluginId -> { storage: Map } (settings persist)

  function _isPlainObject(v) {
    return v != null && typeof v === 'object' && !Array.isArray(v);
  }

  function clonePluginValue(value) {
    return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
  }

  // Dirty paths: '*' (whole entry), 'enabled', 'isNew', 'storage'/'settings' (whole object),
  // or 'storage\0<key>' / 'settings\0<key>' (storage keys may contain dots).
  function pluginPath(field, key) {
    return key === undefined ? field : `${field}\0${key}`;
  }

  function markPluginDataDirty(pluginId, path) {
    if (!_pluginDirty.has(pluginId)) _pluginDirty.set(pluginId, new Set());
    _pluginDirty.get(pluginId).add(path);
    savePluginData();
  }

  function copyPluginDataPath(src, dst, path) {
    if (path === '*') {
      for (const k of Object.keys(dst)) delete dst[k];
      Object.assign(dst, clonePluginValue(src) || {});
      return;
    }
    const [field, key] = path.split('\0');
    if (key === undefined) {
      if (src && src[field] !== undefined) dst[field] = clonePluginValue(src[field]);
      else delete dst[field];
      return;
    }
    if (!_isPlainObject(dst[field])) dst[field] = {};
    if (src && _isPlainObject(src[field]) && Object.prototype.hasOwnProperty.call(src[field], key)) {
      dst[field][key] = clonePluginValue(src[field][key]);
    } else {
      delete dst[field][key];
    }
  }

  // Move an unparseable data file aside (instead of silently overwriting it later).
  async function quarantineCorruptPluginData(error) {
    const aside = _pluginDataPath.replace(/\.json$/, `.corrupt-${Date.now()}.json`);
    try {
      await IOUtils.move(_pluginDataPath, aside);
      console.error(`[ZenLeap] Plugin data file was corrupt and has been moved to ${aside}; starting with empty plugin data.`, error);
      return true;
    } catch (e) {
      reportError('Plugin data file is corrupt and could not be moved aside; plugin data will not be saved this session', e);
      return false;
    }
  }

  async function loadPluginData() {
    let loaded = null;
    let usable = true;
    try {
      const text = await IOUtils.readUTF8(_pluginDataPath);
      try {
        loaded = JSON.parse(text);
        if (!_isPlainObject(loaded)) throw new Error('top level is not an object');
      } catch (parseError) {
        loaded = null;
        usable = await quarantineCorruptPluginData(parseError);
      }
    } catch (e) {
      if (e?.name !== 'NotFoundError') {
        usable = false;
        reportError('Reading plugin data failed; plugin data will not be saved this session', e);
      }
    }

    if (loaded) {
      for (const [id, entry] of Object.entries(loaded)) {
        if (PLUGIN_ID_RE.test(id) && _isPlainObject(entry)) _pluginData[id] = entry;
      }
    } else if (usable) {
      // Migrate from old pref-based storage
      try {
        if (Services.prefs.getPrefType('uc.zenleap.plugins') === Services.prefs.PREF_STRING) {
          const parsed = JSON.parse(Services.prefs.getStringPref('uc.zenleap.plugins'));
          if (_isPlainObject(parsed)) {
            for (const [id, entry] of Object.entries(parsed)) {
              if (PLUGIN_ID_RE.test(id) && _isPlainObject(entry)) {
                _pluginData[id] = entry;
                markPluginDataDirty(id, '*');
              }
            }
            Services.prefs.clearUserPref('uc.zenleap.plugins');
            log('Migrated plugin data from prefs to file');
          }
        }
      } catch (e) {
        console.warn('[ZenLeap] Plugin pref migration failed:', e);
      }
    }

    _pluginDataLoaded = usable;
    // Changes other windows broadcast while we were reading are newer than the file
    for (const changed of _pendingRemotePluginChanges.splice(0)) applyRemotePluginChanges(changed);
  }

  // Write the shared plugin state now: broadcast the changed entries to the other
  // windows (synchronously, so any later write from any window includes them), then
  // write the whole file atomically. IOUtils runs writes in order on one queue.
  function flushPluginData() {
    if (_pluginSaveTimer) { clearTimeout(_pluginSaveTimer); _pluginSaveTimer = null; }
    if (!_pluginDataLoaded || _pluginDirty.size === 0) return _pluginSavePromise;
    const changed = {};
    for (const id of _pluginDirty.keys()) changed[id] = _pluginData[id] ? clonePluginValue(_pluginData[id]) : null;
    _pluginDirty.clear();
    try {
      Services.obs.notifyObservers(null, PLUGIN_DATA_TOPIC, JSON.stringify({ sender: _windowUid, changed }));
    } catch (e) { reportError('Broadcasting plugin data change failed', e); }
    // Serialize when the write runs, not now: a write queued behind one still in
    // flight then includes what other windows broadcast meanwhile, instead of
    // landing after their newer write with older data (REV-LCMDS-13).
    _pluginSavePromise = _pluginSavePromise
      .then(() => IOUtils.writeUTF8(_pluginDataPath, JSON.stringify(_pluginData), { tmpPath: `${_pluginDataPath}.tmp` }))
      .catch(e => reportError('Saving plugin data failed', e));
    return _pluginSavePromise;
  }

  function savePluginData() {
    if (_pluginSaveTimer) return;
    _pluginSaveTimer = setTimeout(() => {
      _pluginSaveTimer = null;
      flushPluginData();
    }, 500);
  }

  // Another window changed plugin data: adopt its entries, but keep the keys this
  // window changed and has not flushed yet (they are newer).
  function applyRemotePluginChanges(changed) {
    for (const [id, remote] of Object.entries(changed || {})) {
      if (!PLUGIN_ID_RE.test(id)) continue;
      const localDirty = _pluginDirty.get(id);
      if (remote === null || !_isPlainObject(remote)) {
        // Uninstalled in another window: that wins over this window's unflushed
        // changes, which would otherwise write the plugin's entry back (REV-LCMDS-13)
        _pluginDirty.delete(id);
        delete _pluginData[id];
      } else {
        const merged = clonePluginValue(remote);
        if (localDirty && _pluginData[id]) {
          for (const path of localDirty) copyPluginDataPath(_pluginData[id], merged, path);
        }
        _pluginData[id] = merged;
      }
      reconcilePluginWithData(id);
    }
  }

  function _onPluginDataBroadcast(subject, topic, data) {
    let msg;
    try { msg = JSON.parse(data); } catch (e) { return; }
    if (!msg || msg.sender === _windowUid) return;
    if (!_pluginDataLoaded) { _pendingRemotePluginChanges.push(msg.changed); return; }
    applyRemotePluginChanges(msg.changed);
  }

  // Keep this window's plugin registry in line with the shared enabled flags
  // (another window enabled/disabled/uninstalled a plugin).
  function reconcilePluginWithData(pluginId) {
    const entry = _pluginRegistry.get(pluginId);
    if (!entry) return;
    const data = _pluginData[pluginId];
    if (!data) {
      if (!entry.manifest.builtIn) unregisterPlugin(pluginId, { persist: false });
      return;
    }
    const wantEnabled = isPluginEnabledInData(entry.manifest);
    if (wantEnabled && !entry.enabled) enablePlugin(pluginId, { persist: false });
    else if (!wantEnabled && entry.enabled) disablePlugin(pluginId, { persist: false });
    else if (_pluginManagerMode) renderPluginManagerContent();
  }

  function isPluginEnabledInData(manifest) {
    const data = _pluginData[manifest.id];
    // Built-in plugins are on unless disabled; external ones only when explicitly enabled
    return manifest.builtIn ? data?.enabled !== false : data?.enabled === true;
  }

  function checkStorageQuota(storage, pluginId) {
    try {
      const size = JSON.stringify(storage).length;
      if (size > PLUGIN_STORAGE_QUOTA) {
        console.warn(`[ZenLeap] Plugin "${pluginId}" storage exceeds quota (${Math.round(size / 1024)}KB / ${PLUGIN_STORAGE_QUOTA / 1024}KB)`);
        return false;
      }
    } catch (e) {
      console.warn(`[ZenLeap] Plugin "${pluginId}" storage quota check failed:`, e);
      return false;
    }
    return true;
  }

  // Scoped key/value store for a plugin field ('storage' or 'settings'). In private
  // windows 'storage' writes (plugin data, which may hold URLs) go to a per-window
  // overlay that is never persisted; 'settings' are configuration and are saved
  // (REV-LCMDS-06).
  function pluginStore(pluginId, field) {
    const priv = field === 'storage' && isPrivateWindow();
    const overlay = () => {
      if (!_pluginPrivateOverlay.has(pluginId)) _pluginPrivateOverlay.set(pluginId, { storage: new Map() });
      return _pluginPrivateOverlay.get(pluginId)[field];
    };
    const DELETED = Symbol.for('zenleap.plugin.deleted');
    const persisted = () => _pluginData[pluginId]?.[field] || {};
    const getAll = () => {
      const all = { ...persisted() };
      if (priv) {
        for (const [k, v] of overlay()) {
          if (v === DELETED) delete all[k]; else all[k] = v;
        }
      }
      return all;
    };
    return {
      has(key) { return Object.prototype.hasOwnProperty.call(getAll(), key); },
      // Copies: a plugin mutating a returned object must not change the shared state
      // behind the store's back (it would never be marked for saving)
      get(key) { return clonePluginValue(getAll()[key]); },
      getAll: () => clonePluginValue(getAll()),
      set(key, value) {
        const stored = clonePluginValue(value);
        if (field === 'storage' && !checkStorageQuota({ ...getAll(), [key]: stored }, pluginId)) return false;
        if (priv) { overlay().set(key, stored); return true; }
        if (!_pluginData[pluginId]) _pluginData[pluginId] = {};
        if (!_isPlainObject(_pluginData[pluginId][field])) _pluginData[pluginId][field] = {};
        _pluginData[pluginId][field][key] = stored;
        markPluginDataDirty(pluginId, pluginPath(field, key));
        return true;
      },
      remove(key) {
        if (priv) { overlay().set(key, DELETED); return; }
        if (_pluginData[pluginId]?.[field] && key in _pluginData[pluginId][field]) {
          delete _pluginData[pluginId][field][key];
          markPluginDataDirty(pluginId, pluginPath(field, key));
        }
      },
      clear() {
        if (priv) {
          for (const k of Object.keys(getAll())) overlay().set(k, DELETED);
          return;
        }
        if (!_pluginData[pluginId]) return;
        _pluginData[pluginId][field] = {};
        markPluginDataDirty(pluginId, field);
      },
    };
  }

  // ── Selected text (plugin API) ──
  // Read through Firefox's own content actors; ZenLeap puts no script into pages. The
  // find bar's Finder locates the frame or text field holding the selection but returns
  // at most 150 characters with whitespace collapsed. "View Selection Source" returns
  // the selection's markup, which Firefox's plain-text serializer turns into the full
  // text, line breaks included. Returns { text, truncated }: truncated when only
  // Finder's 150 characters were readable (a selection inside a page's text field).
  const FINDER_SELECTION_MAX = 150;

  async function readSelectedText() {
    try {
      const focused = document.commandDispatcher.focusedElement;
      if (focused && typeof focused.selectionStart === 'number' && focused.selectionEnd > focused.selectionStart) {
        return { text: focused.value.slice(focused.selectionStart, focused.selectionEnd), truncated: false };
      }
      let bc = gBrowser.selectedBrowser?.browsingContext;
      let preview = '';
      for (let depth = 0; bc && depth < 16; depth++) {
        const info = await bc.currentWindowGlobal?.getActor('Finder').sendQuery('Finder:GetInitialSelection', {});
        if (!info?.focusedChildBrowserContextId) { preview = info?.selectedText || ''; break; }
        bc = BrowsingContext.get(info.focusedChildBrowserContextId);
      }
      if (!preview || !bc) return { text: '', truncated: false };
      let full = '';
      try {
        const source = await bc.currentWindowGlobal.getActor('ViewSource').sendQuery('ViewSource:GetSelection', {});
        full = selectionTextFromSource(source?.URL);
      } catch (e) { /* no document selection, e.g. the selection is in a text field */ }
      // Only use it if it is the selection Finder saw (Finder trims and collapses whitespace)
      if (full && full.replace(/\s+/g, ' ').includes(preview.slice(0, 100))) return { text: full, truncated: false };
      return { text: preview, truncated: preview.length >= FINDER_SELECTION_MAX };
    } catch (e) {
      reportError('Reading the selected text failed', e);
      return { text: '', truncated: false };
    }
  }

  // "View Selection Source" answers with view-source:data:text/html,<markup>, where the
  // selection starts at U+FDD0 and ends at U+FDEF. convertToPlainText() parses the markup
  // into an inert document (no scripts, no loads) and serializes it the way
  // Selection.toString() does, except that it can't see CSS-hidden elements.
  function selectionTextFromSource(url) {
    if (typeof url !== 'string' || !url.startsWith('view-source:data:')) return '';
    const markup = decodeURIComponent(url.slice(url.indexOf(',') + 1));
    const text = Cc['@mozilla.org/parserutils;1'].getService(Ci.nsIParserUtils).convertToPlainText(markup, 0, 0);
    const start = text.indexOf('﷐');
    const end = text.indexOf('﷯', start + 1);
    return start >= 0 && end > start ? text.slice(start + 1, end).trim() : '';
  }

  // ── Scoped Plugin API Factory ──
  // Each plugin gets its own API instance with storage/events scoped to its ID
  function createScopedPluginAPI(pluginId) {
    const liveTab = (tab) => isLiveTab(tab) ? tab : null;
    const allTabs = ({ allWorkspaces = false } = {}) => {
      let tabs = null;
      if (allWorkspaces) { try { tabs = window.gZenWorkspaces?.allStoredTabs; } catch (e) { tabs = null; } }
      if (!tabs?.length) tabs = gBrowser.tabs;
      return Array.from(tabs).filter(t => !t.hidden && !t.closing && !t.hasAttribute('zen-empty-tab') && !t.hasAttribute('zen-glance-tab'));
    };
    // Bulk close like Firefox's own "close other/left/right tabs": one undo batch, and the
    // standard warning dialog when that many tabs could not all be restored.
    const closeTabsWithWarning = (tabs, closingEnum) => TabOps.close(tabs, { warn: closingEnum });
    const workspaceIdOf = (wsOrId) => typeof wsOrId === 'string' ? wsOrId : wsOrId?.uuid;
    const resolveTheme = () => themes[S['appearance.theme']] || themes.meridian;
    const storage = pluginStore(pluginId, 'storage');
    const ownSettings = pluginStore(pluginId, 'settings');

    return {
      // ─── Tab Operations ───
      tabs: {
        // The tab in the tab list (a Glance's parent); browser.* acts on the page on screen
        getCurrent: () => currentTab(),
        // Active workspace (+ essentials) by default; { allWorkspaces: true } for every workspace
        getAll: (opts) => allTabs(opts),
        getVisible: () => getVisibleTabs(),
        getByIndex: (i) => {
          const tabs = getVisibleTabs();
          return (i >= 0 && i < tabs.length) ? tabs[i] : null;
        },
        findByUrl: (pattern, opts) => {
          const tabs = allTabs(opts);
          if (pattern instanceof RegExp) return tabs.filter(t => pattern.test(t.linkedBrowser?.currentURI?.spec || ''));
          return tabs.filter(t => (t.linkedBrowser?.currentURI?.spec || '').includes(pattern));
        },
        findByTitle: (pattern, opts) => {
          const tabs = allTabs(opts);
          if (pattern instanceof RegExp) return tabs.filter(t => pattern.test(t.label || ''));
          return tabs.filter(t => (t.label || '').toLowerCase().includes(String(pattern).toLowerCase()));
        },
        select: (tab) => { if (liveTab(tab)) return switchToTabAcrossWorkspaces(tab); return Promise.resolve(false); },
        close: (tab) => { if (liveTab(tab)) gBrowser.removeTab(tab); },
        closeTabs: (tabs) => closeTabsWithWarning(Array.from(tabs || []), gBrowser.closingTabsEnum.MULTI_SELECTED),
        // Like the palette commands: pinned tabs and ZenRipple's agent tabs/pages stay open
        closeOthers: (keepTab) => {
          const keep = keepTab || currentTab();
          return closeTabsWithWarning(getVisibleTabs().filter(t => t !== keep && !t.pinned && !isExternallyManagedTab(t)), gBrowser.closingTabsEnum.OTHER);
        },
        closeToRight: (fromTab) => {
          const tabs = getVisibleTabs();
          const idx = tabs.indexOf(fromTab || currentTab());
          return idx < 0 ? 0 : closeTabsWithWarning(tabs.slice(idx + 1).filter(t => !t.pinned && !isExternallyManagedTab(t)), gBrowser.closingTabsEnum.TO_END);
        },
        closeToLeft: (fromTab) => {
          const tabs = getVisibleTabs();
          const idx = tabs.indexOf(fromTab || currentTab());
          return idx < 0 ? 0 : closeTabsWithWarning(tabs.slice(0, idx).filter(t => !t.pinned && !isExternallyManagedTab(t)), gBrowser.closingTabsEnum.TO_START);
        },
        // User-intent tab creation: Zen's Space Routing rules apply unless { skipRoute: true }
        create: (url, opts = {}) => gBrowser.addTab(url || 'about:newtab', {
          triggeringPrincipal: Services.scriptSecurityManager.createNullPrincipal({}),
          skipRoute: !!opts.skipRoute,
        }),
        duplicate: (tab) => {
          const t = tab || currentTab();
          return gBrowser.duplicateTab(t, true, { tabIndex: t.index + 1 });
        },
        move: (tab, toIndex) => {
          const tabs = getVisibleTabs();
          if (liveTab(tab) && toIndex >= 0 && toIndex < tabs.length && tabs[toIndex] !== tab) {
            gBrowser.moveTabBefore(tab, tabs[toIndex]);
          }
        },
        pin: (tab) => gBrowser.pinTab(tab || currentTab()),
        unpin: (tab) => gBrowser.unpinTab(tab || currentTab()),
        isPinned: (tab) => (tab || currentTab()).pinned,
        mute: (tab) => { const t = tab || currentTab(); if (!t.hasAttribute('muted')) t.toggleMuteAudio(); },
        unmute: (tab) => { const t = tab || currentTab(); if (t.hasAttribute('muted')) t.toggleMuteAudio(); },
        toggleMute: (tab) => (tab || currentTab()).toggleMuteAudio(),
        isMuted: (tab) => (tab || currentTab()).hasAttribute('muted'),
        reload: (tab) => gBrowser.reloadTab(tab || currentTab()),
        // Firefox picks another tab to select first when unloading the selected one
        unload: (tab) => TabOps.unload([tab || currentTab()]),
        getUrl: (tab) => (tab || currentTab()).linkedBrowser?.currentURI?.spec || '',
        getTitle: (tab) => (tab || currentTab()).label || '',
        getLastAccessed: (tab) => getTabLastAccessed(tab || currentTab()),
        getFavicon: (tab) => (tab || currentTab()).image || '',
        isLoading: (tab) => (tab || currentTab()).hasAttribute('busy'),
        isPending: (tab) => (tab || currentTab()).hasAttribute('pending'),
        isEssential: (tab) => (tab || currentTab()).hasAttribute('zen-essential'),
        // Returns false when Zen refuses (essentials limit, container-specific essentials)
        addToEssentials: (tab) => {
          const t = tab || currentTab();
          try {
            if (!window.gZenPinnedTabManager?.canEssentialBeAdded(t)) return false;
            return gZenPinnedTabManager.addToEssentials(t) !== false;
          } catch (e) { reportError(`Plugin "${pluginId}": addToEssentials failed`, e); return false; }
        },
        removeFromEssentials: (tab) => {
          try { window.gZenPinnedTabManager?.removeEssentials(tab || currentTab()); }
          catch (e) { reportError(`Plugin "${pluginId}": removeFromEssentials failed`, e); }
        },
        bookmark: (tab) => {
          try {
            const t = tab || currentTab();
            if (t === gBrowser.selectedTab) PlacesCommandHook.bookmarkPage();
            else PlacesCommandHook.bookmarkTabs([t]);
          } catch (e) { reportError(`Plugin "${pluginId}": bookmark failed`, e); }
        },
      },

      // ─── Workspace Operations ───
      workspaces: {
        getAll: () => {
          try { return window.gZenWorkspaces?.getWorkspaces() || []; } catch (e) { return []; }
        },
        getCurrent: () => {
          try { return window.gZenWorkspaces?.activeWorkspace || null; } catch (e) { return null; }
        },
        getById: (id) => {
          try {
            const all = window.gZenWorkspaces?.getWorkspaces() || [];
            return all.find(ws => ws.uuid === id) || null;
          } catch (e) { return null; }
        },
        getByName: (name) => {
          try {
            const all = window.gZenWorkspaces?.getWorkspaces() || [];
            return all.find(ws => ws.name?.toLowerCase() === String(name).toLowerCase()) || null;
          } catch (e) { return null; }
        },
        switchTo: async (wsOrId) => {
          const id = workspaceIdOf(wsOrId);
          if (!id || !window.gZenWorkspaces) return false;
          await gZenWorkspaces.changeWorkspaceWithID(id);
          return gZenWorkspaces.activeWorkspace === id;
        },
        // Returns the new workspace's data ({ uuid, name, ... }) or null.
        // options: { icon, switchTo = false }
        create: async (name, options = {}) => {
          try {
            if (!window.gZenWorkspaces) return null;
            return await gZenWorkspaces.createAndSaveWorkspace(
              safePluginText(name, 'New Workspace', 100),
              typeof options.icon === 'string' ? options.icon : undefined,
              /* dontChange */ !options.switchTo,
            ) || null;
          } catch (e) { reportError(`Plugin "${pluginId}": workspaces.create failed`, e); return null; }
        },
        // Deletes the workspace AND closes all of its tabs, pinned tabs and folders
        // (Zen >= 1.19.4b semantics). Resolves true when Zen confirms, false on timeout.
        delete: async (wsOrId, { timeoutMs = 5000 } = {}) => {
          const id = workspaceIdOf(wsOrId);
          if (!id || !window.gZenWorkspaces) return false;
          try {
            return await removeWorkspaceWithTimeout(id, timeoutMs);
          } catch (e) { reportError(`Plugin "${pluginId}": workspaces.delete failed`, e); return false; }
        },
        rename: async (wsOrId, newName) => {
          try {
            const id = workspaceIdOf(wsOrId);
            const ws = (window.gZenWorkspaces?.getWorkspaces() || []).find(w => w.uuid === id);
            if (!ws) return false;
            ws.name = safePluginText(newName, ws.name, 100);
            await gZenWorkspaces.saveWorkspace(ws);
            return true;
          } catch (e) { reportError(`Plugin "${pluginId}": workspaces.rename failed`, e); return false; }
        },
        moveTabTo: (tab, wsOrId) => {
          const id = workspaceIdOf(wsOrId);
          if (!id || !window.gZenWorkspaces) return false;
          return TabOps.moveToWorkspace([tab || gBrowser.selectedTab], id) > 0;
        },
      },

      // ─── Folder Operations ───
      folders: {
        getAll: () => {
          try { return Array.from(gBrowser.tabContainer.querySelectorAll('zen-folder')); } catch (e) { return []; }
        },
        getByName: (name) => {
          try {
            const wanted = String(name).toLowerCase();
            return Array.from(gBrowser.tabContainer.querySelectorAll('zen-folder')).find(f => (f.label || '').toLowerCase() === wanted) || null;
          } catch (e) { return null; }
        },
        create: (tabs, name) => {
          try {
            if (!window.gZenFolders) return null;
            const validTabs = (tabs || [gBrowser.selectedTab]).filter(t => liveTab(t));
            if (validTabs.length === 0) return null;
            return gZenFolders.createFolder(validTabs, { label: safePluginText(name, 'New Folder', 100), renameFolder: !name });
          } catch (e) { reportError(`Plugin "${pluginId}": folders.create failed`, e); return null; }
        },
        // Deletes the folder and closes its tabs (restorable from recently closed)
        delete: async (folder) => {
          try { if (folder?.isZenFolder) { await folder.delete(); return true; } }
          catch (e) { reportError(`Plugin "${pluginId}": folders.delete failed`, e); }
          return false;
        },
        rename: (folder, newName) => {
          if (!folder?.isZenFolder || !newName) return false;
          folder.name = safePluginText(newName, folder.label, 100); // fires ZenFolderRenamed
          return true;
        },
        getTabs: (folder) => {
          try { return folder?.tabs?.filter(t => !t.hasAttribute('zen-empty-tab')) || []; }
          catch (e) { return []; }
        },
        addTab: (folder, tab) => {
          try {
            if (!folder?.isZenFolder || !liveTab(tab)) return false;
            if (!window.gZenFolders?.canDropElement(folder, tab)) return false;
            folder.addTabs([tab]);
            return true;
          } catch (e) { reportError(`Plugin "${pluginId}": folders.addTab failed`, e); return false; }
        },
        removeTab: (tab) => {
          try { if (liveTab(tab) && tab.group) gBrowser.ungroupTab(tab); }
          catch (e) { reportError(`Plugin "${pluginId}": folders.removeTab failed`, e); }
        },
        setIcon: (folder) => {
          try { if (folder?.isZenFolder) gZenFolders.changeFolderUserIcon(folder); }
          catch (e) { reportError(`Plugin "${pluginId}": folders.setIcon failed`, e); }
        },
        createSubfolder: (folder) => {
          try { if (folder?.isZenFolder) folder.createSubfolder(); }
          catch (e) { reportError(`Plugin "${pluginId}": folders.createSubfolder failed`, e); }
        },
      },

      // ─── Split View Operations ───
      splitView: {
        isActive: () => {
          try { return !!window.gZenViewSplitter?.splitViewActive; } catch (e) { return false; }
        },
        split: (tabs) => {
          try {
            if (window.gZenViewSplitter && tabs?.length >= 2) {
              gZenViewSplitter.splitTabs(tabs.slice(0, 4));
              return true;
            }
          } catch (e) { reportError(`Plugin "${pluginId}": splitView.split failed`, e); }
          return false;
        },
        unsplit: () => {
          try { if (window.gZenViewSplitter?.splitViewActive) gZenViewSplitter.unsplitCurrentView(); }
          catch (e) { reportError(`Plugin "${pluginId}": splitView.unsplit failed`, e); }
        },
        getLayout: () => {
          try {
            const s = window.gZenViewSplitter;
            if (!s?.splitViewActive) return null;
            return s._data?.[s.currentView]?.layoutTree || null;
          } catch (e) { return null; }
        },
        rotate: () => {
          try { rotateSplitLayout(); } catch (e) { reportError(`Plugin "${pluginId}": splitView.rotate failed`, e); }
        },
      },

      // ─── Marks ───
      marks: {
        set: (char, tab) => setMark(char, tab),
        get: (char) => marks.get(char) || null,
        clear: (char) => { marks.delete(char); saveEssentialMarks(); updateRelativeNumbers(); },
        clearAll: () => clearAllMarks(),
        getAll: () => {
          const result = {};
          for (const [char, tab] of marks) result[char] = tab;
          return result;
        },
        jump: (char) => goToMark(char),
      },

      // ─── Navigation ───
      navigation: {
        jumpBack: () => jumpBack(),
        jumpForward: () => jumpForward(),
      },

      // ─── Commands ───
      commands: {
        register: (cmds) => {
          // Register dynamic commands for this plugin
          const entry = _pluginRegistry.get(pluginId);
          if (!entry) return;
          const toAdd = (Array.isArray(cmds) ? cmds : [cmds]).map(c => sanitizePluginCommand(c, pluginId)).filter(Boolean);
          entry._dynamicCommands.push(...toAdd);
          invalidateCommandCache();
        },
        unregister: (cmdKey) => {
          const entry = _pluginRegistry.get(pluginId);
          if (!entry) return;
          entry._dynamicCommands = entry._dynamicCommands.filter(c => c.key !== cmdKey);
          invalidateCommandCache();
        },
        // Programmatic, like workspaces.delete: commands that ask for confirmation in
        // the palette (close other/left/right tabs, ...) run directly; commands that
        // need input (sub-flows) open the palette on that step. Returns false for an
        // unknown key (REV-LCMDS-10).
        execute: (cmdKey) => {
          const cmd = getAllCommands().find(c => c.key === cmdKey);
          if (!cmd) return false;
          if (cmd.subFlow) {
            if (!searchMode) enterSearchMode(true);
            executeCommand(cmd);
          } else {
            commandRecency.set(cmd.key, Date.now());
            runCommand(cmd);
          }
          return true;
        },
        getAll: () => getAllCommands().map(c => ({ key: c.key, label: c.label, icon: c.icon })),
      },

      // ─── Browser ───
      browser: {
        // User-intent navigation: Zen's Space Routing applies unless { skipRoute: true }
        openUrl: (url, options = {}) => {
          const principal = Services.scriptSecurityManager.createNullPrincipal({});
          if (options.newTab !== false) {
            return gBrowser.addTab(url, { triggeringPrincipal: principal, skipRoute: !!options.skipRoute });
          }
          gBrowser.selectedBrowser.loadURI(Services.io.newURI(url), { triggeringPrincipal: principal });
          return gBrowser.selectedTab;
        },
        getCurrentUrl: () => gBrowser.selectedBrowser?.currentURI?.spec || '',
        isPrivate: () => isPrivateWindow(),
        goBack: () => { try { gBrowser.selectedBrowser.goBack(); } catch (e) {} },
        goForward: () => { try { gBrowser.selectedBrowser.goForward(); } catch (e) {} },
        reload: () => { try { gBrowser.reloadTab(gBrowser.selectedTab); } catch (e) {} },
        forceReload: () => { try { gBrowser.selectedBrowser.reloadWithFlags(Ci.nsIWebNavigation.LOAD_FLAGS_BYPASS_CACHE); } catch (e) {} },
        // Firefox's page zoom (remembered per site, like Ctrl+=); resolve when applied
        zoomIn: () => Promise.resolve().then(() => FullZoom.enlarge()).catch(e => reportError(`Plugin "${pluginId}": zoomIn failed`, e)),
        zoomOut: () => Promise.resolve().then(() => FullZoom.reduce()).catch(e => reportError(`Plugin "${pluginId}": zoomOut failed`, e)),
        zoomReset: () => Promise.resolve().then(() => FullZoom.reset()).catch(e => reportError(`Plugin "${pluginId}": zoomReset failed`, e)),
        getZoom: () => { try { return ZoomManager.zoom; } catch (e) { return 1; } },
        copyToClipboard: (text) => {
          try {
            const cb = Cc['@mozilla.org/widget/clipboardhelper;1'].getService(Ci.nsIClipboardHelper);
            cb.copyString(String(text));
          } catch (e) { reportError(`Plugin "${pluginId}": copyToClipboard failed`, e); }
        },
        toggleFullscreen: () => { try { BrowserCommands.fullScreen(); } catch (e) {} },
        // Async (content lives in another process). The selection in the focused chrome
        // input (e.g. the URL bar) if any, otherwise the page selection.
        getSelectedText: async () => {
          const { text, truncated } = await readSelectedText();
          if (truncated) console.warn(`[ZenLeap] Plugin "${pluginId}": only the first ${FINDER_SELECTION_MAX} characters of the selection could be read`);
          return text;
        },
        // Same as getSelectedText(), as { text, truncated }: truncated is true when only the
        // first 150 characters could be read (e.g. a selection inside a page's text field).
        getSelection: () => readSelectedText(),
        getPageTitle: () => {
          try { return gBrowser.selectedTab.label || gBrowser.selectedBrowser.contentTitle || ''; } catch (e) { return ''; }
        },
        fetch: (url, options = {}) => {
          return new Promise((resolve, reject) => {
            try {
              const xhr = new XMLHttpRequest();
              xhr.open(options.method || 'GET', url, true);
              if (options.headers) {
                for (const [k, v] of Object.entries(options.headers)) xhr.setRequestHeader(k, v);
              }
              xhr.onload = () => resolve({ ok: xhr.status >= 200 && xhr.status < 300, status: xhr.status, statusText: xhr.statusText,
                text: () => Promise.resolve(xhr.responseText), json: () => Promise.resolve().then(() => JSON.parse(xhr.responseText)),
                headers: { get: (name) => xhr.getResponseHeader(name) },
              });
              xhr.onerror = () => reject(new Error('Network error'));
              xhr.ontimeout = () => reject(new Error('Request timed out'));
              if (options.timeout) xhr.timeout = options.timeout;
              xhr.send(options.body || null);
            } catch (e) { reject(e); }
          });
        },
      },

      // ─── UI ───
      ui: {
        showToast: (message, duration) => showZenLeapToast(message, duration),
        showModal: (title, content) => _pluginShowStatsModal(title, content),
        showConfirm: (title, message) => _pluginShowConfirm(title, message),
        showPrompt: (title, placeholder, defaultValue, options) => _pluginShowPrompt(title, placeholder, defaultValue, options),
        log: (msg) => { if (CONFIG.debug) console.log(`[ZenLeap:${pluginId}] ${msg}`); },
        getAccentColor: () => resolveTheme().accent,
        getThemeColors: () => {
          const t = resolveTheme();
          return {
            accent: t.accent, accentBright: t.accentBright,
            currentTabBg: t.currentBadgeBg, currentTabColor: t.currentBadgeColor,
            badgeBg: t.badgeBg, badgeColor: t.badgeColor,
            markColor: t.mark, highlightBorder: t.highlight, selectedBorder: t.selected,
            background: t.bgBase, surface: t.bgSurface, text: t.textPrimary, textSecondary: t.textSecondary,
            border: t.borderDefault, success: t.green, error: t.red, warning: t.gold,
          };
        },
      },

      // ─── Scoped Storage ───
      storage: {
        get: (key, defaultValue) => storage.get(key) ?? defaultValue,
        set: (key, value) => {
          if (!storage.set(key, value)) log(`Plugin "${pluginId}" storage.set rejected: quota exceeded`);
        },
        remove: (key) => storage.remove(key),
        getAll: () => storage.getAll(),
        clear: () => storage.clear(),
      },

      // ─── Scoped Events ───
      events: {
        on: (event, callback) => _pluginEventBus.on(event, callback, pluginId),
        off: (event, callback) => _pluginEventBus.off(event, callback, pluginId),
        once: (event, callback) => _pluginEventBus.once(event, callback, pluginId),
      },

      // ─── Plugin Settings (plugin's own settings from manifest) ───
      settings: {
        get: (key) => cloneSettingValue(S[key]), // Read ZenLeap settings (read-only)
        getOwn: (key, defaultValue) => {
          if (ownSettings.has(key)) return ownSettings.get(key);
          // Fall back to manifest default
          const schema = _pluginRegistry.get(pluginId)?.manifest?.settings?.[key];
          return schema?.default ?? defaultValue;
        },
        setOwn: (key, value) => {
          ownSettings.set(key, value);
          _pluginEventBus.emit('plugin:settingChanged', { pluginId, key, value });
        },
        getOwnSchema: () => _pluginRegistry.get(pluginId)?.manifest?.settings || {},
      },

      // ─── File I/O (convenience helpers rooted at the plugin's data directory) ───
      // Not a security boundary: plugins run with full chrome privileges anyway.
      fs: (() => {
        const pluginDataDir = PathUtils.join(PathUtils.profileDir, 'chrome', 'zenleap-plugins', pluginId, 'data');
        const resolvePath = (rel) => PathUtils.join(pluginDataDir, ...(rel ? [rel] : [])); // PathUtils rejects '..' and absolute segments
        return {
          readText: async (rel) => {
            try { return await IOUtils.readUTF8(resolvePath(rel)); } catch (e) { return null; }
          },
          writeText: async (rel, content) => {
            try {
              const p = resolvePath(rel);
              await IOUtils.makeDirectory(PathUtils.parent(p), { ignoreExisting: true });
              await IOUtils.writeUTF8(p, content, { tmpPath: `${p}.tmp` });
              return true;
            } catch (e) { return false; }
          },
          readJSON: async (rel) => {
            try { return JSON.parse(await IOUtils.readUTF8(resolvePath(rel))); } catch (e) { return null; }
          },
          writeJSON: async (rel, data) => {
            try {
              const p = resolvePath(rel);
              await IOUtils.makeDirectory(PathUtils.parent(p), { ignoreExisting: true });
              await IOUtils.writeUTF8(p, JSON.stringify(data), { tmpPath: `${p}.tmp` });
              return true;
            } catch (e) { return false; }
          },
          exists: async (rel) => {
            try { await IOUtils.stat(resolvePath(rel)); return true; } catch (e) { return false; }
          },
          mkdir: async (rel) => {
            try { await IOUtils.makeDirectory(resolvePath(rel), { ignoreExisting: true }); return true; } catch (e) { return false; }
          },
          listDir: async (rel) => {
            try {
              const abs = await IOUtils.getChildren(resolvePath(rel));
              return abs.map(p => PathUtils.filename(p));
            } catch (e) { return []; }
          },
          remove: async (rel) => {
            try { await IOUtils.remove(resolvePath(rel)); return true; } catch (e) { return false; }
          },
          joinPath: (...parts) => PathUtils.join(...parts),
        };
      })(),

      // ─── Version info ───
      version: VERSION,
      pluginId: pluginId,
    };
  }

  // ── Dialog stack (plugin dialogs, settings import) ──
  // Keys for ZenLeap's small modal dialogs are routed here BEFORE the main keydown
  // handler: this listener is registered at script load, i.e. before init() registers
  // handleKeyDown, and consumes the keys it handles, so Escape/Enter act on the top
  // dialog only (not also on the view underneath). It also gives the Plugin Manager
  // keyboard navigation.
  const _dialogStack = []; // [{ el, onKey(event) -> handled, overViews }]

  // overViews: the dialog was opened from a ZenLeap view (settings import) and sits
  // on top of it, so it gets the keys even while that view is open.
  function pushDialog(el, onKey, { overViews = false } = {}) {
    const dialog = { el, onKey, overViews };
    _dialogStack.push(dialog);
    return () => {
      const i = _dialogStack.indexOf(dialog);
      if (i >= 0) _dialogStack.splice(i, 1);
    };
  }

  function _routeDialogKeys(event) {
    while (_dialogStack.length && !_dialogStack[_dialogStack.length - 1].el.isConnected) _dialogStack.pop();
    const top = _dialogStack[_dialogStack.length - 1];
    // A ZenLeap view opened on top of a dialog (palette, settings, ...) gets the keys
    if (!top?.overViews && (searchMode || settingsMode || helpMode || reorgMode || gtileMode || updateMode || leapMode || folderDeleteMode)) return;
    let handled = false;
    try {
      if (top) handled = !!top.onKey(event);
      else if (_pluginManagerMode) handled = handlePluginManagerKey(event);
    } catch (e) { reportError('Dialog key handling failed', e); }
    if (handled) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }

  window.addEventListener('keydown', _routeDialogKeys, true);
  onRegionTeardown(() => window.removeEventListener('keydown', _routeDialogKeys, true));

  // ── Plugin dialog styles (themed; injected once) ──
  function ensurePluginUiStyles() {
    injectStyleBlock('zenleap-plugin-ui-styles', `
      @keyframes zenleap-pm-appear {
        from { opacity: 0; transform: scale(0.97) translateY(-6px); }
        to { opacity: 1; transform: scale(1) translateY(0); }
      }
      .zenleap-plugin-dialog {
        position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
        z-index: 100010; display: flex; justify-content: center; align-items: center; padding: 20px;
        box-sizing: border-box;
      }
      .zenleap-plugin-dialog-backdrop {
        position: absolute; top: 0; left: 0; width: 100%; height: 100%;
        background: var(--zl-backdrop); backdrop-filter: var(--zl-blur);
      }
      .zenleap-plugin-dialog-card {
        position: relative; width: 90%; max-width: 420px; max-height: 70vh;
        background: var(--zl-bg-surface); border-radius: var(--zl-r-lg);
        box-shadow: var(--zl-shadow-modal); display: flex; flex-direction: column; overflow: hidden;
        font-family: var(--zl-font-ui); animation: zenleap-pm-appear 0.2s ease-out;
      }
      .zenleap-plugin-dialog-card.wide { max-width: 520px; }
      .zenleap-plugin-dialog-header {
        padding: 18px 22px 12px; display: flex; justify-content: space-between; align-items: center; gap: 12px;
      }
      .zenleap-plugin-dialog-card.wide .zenleap-plugin-dialog-header { border-bottom: 1px solid var(--zl-border-subtle); }
      .zenleap-plugin-dialog-title { margin: 0; font-size: 16px; font-weight: 700; color: var(--zl-accent); }
      .zenleap-plugin-dialog-message { margin: 0 22px 18px; font-size: 13px; color: var(--zl-text-secondary); line-height: 1.5; white-space: pre-wrap; }
      .zenleap-plugin-dialog-body {
        padding: 16px 22px; overflow-y: auto; flex: 1; font-size: 13px; color: var(--zl-text-secondary);
        white-space: pre-wrap; font-family: var(--zl-font-mono); line-height: 1.6;
        scrollbar-width: thin; scrollbar-color: var(--zl-border-strong) transparent;
      }
      .zenleap-plugin-dialog-input {
        margin: 0 22px 18px; padding: 10px 14px; box-sizing: border-box; width: calc(100% - 44px);
        background: var(--zl-bg-raised); border: 1px solid var(--zl-border-strong);
        border-radius: var(--zl-r-sm); color: var(--zl-text-primary); font-size: 14px; outline: none; font-family: inherit;
      }
      .zenleap-plugin-dialog-input:focus { border-color: var(--zl-accent); }
      .zenleap-plugin-dialog-actions { display: flex; justify-content: flex-end; gap: 8px; padding: 0 22px 18px; }
      .zenleap-plugin-dialog-footer {
        padding: 10px 22px; border-top: 1px solid var(--zl-border-subtle); text-align: center;
        font-size: 11px; color: var(--zl-text-muted);
      }
      .zenleap-plugin-btn {
        padding: 6px 16px; border-radius: var(--zl-r-sm); cursor: pointer; font-size: 13px; font-family: inherit;
        background: var(--zl-bg-raised); border: 1px solid var(--zl-border-strong); color: var(--zl-text-secondary);
      }
      .zenleap-plugin-btn:hover, .zenleap-plugin-btn:focus-visible { border-color: var(--zl-accent-border); color: var(--zl-text-primary); }
      .zenleap-plugin-btn.primary { background: var(--zl-accent-mid); border-color: var(--zl-accent-border); color: var(--zl-accent-bright); font-weight: 600; }
      .zenleap-plugin-btn.icon { background: none; border: none; color: var(--zl-text-muted); font-size: 16px; padding: 4px 8px; }
      .zenleap-plugin-btn.icon:hover { color: var(--zl-text-primary); background: var(--zl-bg-hover); }
    `);
  }

  function buildPluginDialog({ title, wide = false }) {
    ensurePluginUiStyles();
    const modal = document.createElement('div');
    modal.className = 'zenleap-plugin-dialog';
    const backdrop = document.createElement('div');
    backdrop.className = 'zenleap-plugin-dialog-backdrop';
    const card = document.createElement('div');
    card.className = `zenleap-plugin-dialog-card${wide ? ' wide' : ''}`;
    const header = document.createElement('div');
    header.className = 'zenleap-plugin-dialog-header';
    const h = document.createElement('h3');
    h.className = 'zenleap-plugin-dialog-title';
    h.textContent = String(title ?? '');
    header.appendChild(h);
    card.appendChild(header);
    modal.appendChild(backdrop);
    modal.appendChild(card);
    return { modal, backdrop, card, header };
  }

  function makePluginButton(label, className = '') {
    const btn = document.createElement('button');
    btn.className = `zenleap-plugin-btn ${className}`.trim();
    btn.textContent = label;
    return btn;
  }

  // ── Confirm Dialog ── (Enter = confirm, Escape = cancel)
  // defaultCancel: Enter means Cancel unless Confirm has focus (Tab moves there)
  function _pluginShowConfirm(title, message, { defaultCancel = false } = {}) {
    return new Promise((resolve) => {
      const { modal, backdrop, card } = buildPluginDialog({ title });
      const p = document.createElement('p');
      p.className = 'zenleap-plugin-dialog-message';
      p.textContent = String(message ?? '');
      const btns = document.createElement('div');
      btns.className = 'zenleap-plugin-dialog-actions';
      const cancel = makePluginButton('Cancel');
      const confirm = makePluginButton('Confirm', 'primary');
      let popDialog = null;
      const close = (result) => { popDialog?.(); modal.remove(); resolve(result); };
      backdrop.addEventListener('click', () => close(false));
      cancel.addEventListener('click', () => close(false));
      confirm.addEventListener('click', () => close(true));
      btns.appendChild(cancel);
      btns.appendChild(confirm);
      card.appendChild(p);
      card.appendChild(btns);
      document.documentElement.appendChild(modal);
      popDialog = pushDialog(modal, (e) => {
        if (e.key === 'Escape') { close(false); return true; }
        if (e.key === 'Enter') { close(defaultCancel ? document.activeElement === confirm : document.activeElement !== cancel); return true; }
        return false;
      });
      if (defaultCancel) cancel.focus();
    });
  }

  // ── Prompt Dialog ── (Enter = OK, Escape = cancel; options.password masks the input)
  function _pluginShowPrompt(title, placeholder, defaultValue, options = {}) {
    return new Promise((resolve) => {
      const { modal, backdrop, card } = buildPluginDialog({ title });
      const input = document.createElement('input');
      input.type = options?.password ? 'password' : 'text';
      input.className = 'zenleap-plugin-dialog-input';
      input.value = defaultValue || '';
      input.placeholder = placeholder || '';
      const btns = document.createElement('div');
      btns.className = 'zenleap-plugin-dialog-actions';
      const cancel = makePluginButton('Cancel');
      const ok = makePluginButton('OK', 'primary');
      let popDialog = null;
      const close = (val) => { popDialog?.(); modal.remove(); resolve(val); };
      backdrop.addEventListener('click', () => close(null));
      cancel.addEventListener('click', () => close(null));
      ok.addEventListener('click', () => close(input.value));
      btns.appendChild(cancel);
      btns.appendChild(ok);
      card.appendChild(input);
      card.appendChild(btns);
      document.documentElement.appendChild(modal);
      popDialog = pushDialog(modal, (e) => {
        if (e.key === 'Escape') { close(null); return true; }
        if (e.key === 'Enter') { close(document.activeElement === cancel ? null : input.value); return true; }
        return false;
      });
      setTimeout(() => input.focus(), 50);
    });
  }

  // ── Stats/Content Modal (shared) ──
  function _pluginShowStatsModal(title, content) {
    document.getElementById('zenleap-plugin-stats-modal')?.remove(); // its dialog-stack entry is dropped once disconnected

    const { modal, backdrop, card, header } = buildPluginDialog({ title, wide: true });
    modal.id = 'zenleap-plugin-stats-modal';
    let popDialog = null;
    const closeModal = () => { popDialog?.(); modal.remove(); };
    backdrop.addEventListener('click', closeModal);
    const closeBtn = makePluginButton('✕', 'icon');
    closeBtn.addEventListener('click', closeModal);
    header.appendChild(closeBtn);
    const body = document.createElement('div');
    body.className = 'zenleap-plugin-dialog-body';
    body.textContent = String(content ?? '');
    const ftr = document.createElement('div');
    ftr.className = 'zenleap-plugin-dialog-footer';
    ftr.textContent = 'Press Escape or click outside to close · j/k to scroll';
    card.appendChild(body);
    card.appendChild(ftr);
    document.documentElement.appendChild(modal);
    popDialog = pushDialog(modal, (e) => {
      if (e.key === 'Escape' || e.key === 'Enter') { closeModal(); return true; }
      if (e.key === 'j' || e.key === 'ArrowDown') { body.scrollBy({ top: 60 }); return true; }
      if (e.key === 'k' || e.key === 'ArrowUp') { body.scrollBy({ top: -60 }); return true; }
      return false;
    });
  }

  // ── Plugin Lifecycle ──

  // Validate one command from a manifest or api.commands.register(); returns null if unusable.
  function sanitizePluginCommand(cmd, pluginId) {
    if (!_isPlainObject(cmd) || typeof cmd.key !== 'string' || !PLUGIN_COMMAND_KEY_RE.test(cmd.key)) {
      console.warn(`[ZenLeap] Plugin "${pluginId}": skipping command with a missing/invalid key`, cmd?.key);
      return null;
    }
    return {
      ...cmd,
      label: safePluginText(cmd.label, cmd.key, 120),
      icon: cmd.icon === undefined ? undefined : safeIconText(cmd.icon, '🧩'),
      tags: Array.isArray(cmd.tags) ? cmd.tags.filter(t => typeof t === 'string').map(t => t.slice(0, 40)) : [],
      condition: typeof cmd.condition === 'function' ? cmd.condition : undefined,
      command: typeof cmd.command === 'function' ? cmd.command : undefined,
      subFlow: typeof cmd.subFlow === 'string' ? cmd.subFlow : undefined,
    };
  }

  // Validate a manifest before any plugin code runs; returns a normalized copy or null.
  function validatePluginManifest(raw, source) {
    if (!_isPlainObject(raw)) { console.warn(`[ZenLeap] Skipping plugin at ${source}: manifest is not an object`); return null; }
    if (typeof raw.id !== 'string' || !PLUGIN_ID_RE.test(raw.id)) { console.warn(`[ZenLeap] Skipping plugin at ${source}: invalid id`, raw.id); return null; }
    if (typeof raw.name !== 'string' || !raw.name.trim()) { console.warn(`[ZenLeap] Skipping plugin "${raw.id}": missing name`); return null; }
    if (raw.minZenLeapVersion !== undefined) {
      const cmp = compareVersions(VERSION, raw.minZenLeapVersion);
      if (Number.isNaN(cmp)) { console.warn(`[ZenLeap] Skipping plugin "${raw.id}": unreadable minZenLeapVersion`, raw.minZenLeapVersion); return null; }
      if (cmp < 0) { console.warn(`[ZenLeap] Skipping plugin "${raw.name}": requires ZenLeap v${raw.minZenLeapVersion}+`); return null; }
    }
    const settings = {};
    if (_isPlainObject(raw.settings)) {
      for (const [key, schema] of Object.entries(raw.settings)) {
        if (!_isPlainObject(schema) || !['toggle', 'number', 'text'].includes(schema.type)) continue;
        settings[key] = {
          ...schema,
          label: safePluginText(schema.label, key, 100),
          description: safePluginText(schema.description, '', 300),
        };
      }
    }
    return {
      ...raw,
      name: safePluginText(raw.name, raw.id, 100),
      version: safePluginText(String(raw.version ?? ''), '1.0.0', 30),
      description: safePluginText(raw.description, '', 500),
      author: safePluginText(raw.author, 'Unknown', 100),
      icon: safeIconText(raw.icon, '🧩'),
      settings,
      commands: (Array.isArray(raw.commands) ? raw.commands : []).map(c => sanitizePluginCommand(c, raw.id)).filter(Boolean),
    };
  }

  const _newPluginNames = []; // found by the current scan, announced together

  // Register a plugin manifest. Built-in manifests carry init/destroy directly; external
  // ones carry _scriptPath and their plugin.js is only evaluated when enabled.
  function registerPlugin(rawManifest) {
    const manifest = validatePluginManifest(rawManifest, rawManifest?._path || 'built-in');
    if (!manifest) return false;
    if (_pluginRegistry.has(manifest.id)) {
      console.warn(`[ZenLeap] Plugin id "${manifest.id}" is already registered; skipping ${manifest._path || 'built-in plugin'}`);
      return false;
    }

    if (!_isPlainObject(_pluginData[manifest.id])) {
      // First time we see this plugin: external plugins stay disabled until the user enables them
      _pluginData[manifest.id] = manifest.builtIn
        ? { enabled: true, storage: {}, settings: {} }
        : { enabled: false, isNew: true, storage: {}, settings: {} };
      markPluginDataDirty(manifest.id, '*');
      if (!manifest.builtIn) {
        console.info(`[ZenLeap] New plugin found: "${manifest.name}" (${manifest.id}). Enable it in Manage Plugins to run it.`);
        _newPluginNames.push(manifest.name);
      }
    }

    const entry = {
      manifest,
      enabled: false,
      loaded: !!manifest.builtIn,
      exports: manifest.builtIn ? manifest : null,
      sandbox: null,
      instance: null,
      error: null,
      _dynamicCommands: [],
    };
    _pluginRegistry.set(manifest.id, entry);

    if (isPluginEnabledInData(manifest)) activatePlugin(entry);
    invalidateCommandCache();
    _pluginEventBus.emit('plugin:registered', { pluginId: manifest.id, name: manifest.name });
    return true;
  }

  // Evaluate an external plugin's script in its own sandbox. freshCompartment:
  // a system-principal sandbox otherwise shares the window's compartment, and
  // Cu.nukeSandbox() then throws instead of cutting the plugin off (REV-LCMDS-01).
  async function loadPluginScript(entry, activation) {
    const { manifest } = entry;
    const source = await IOUtils.readUTF8(manifest._scriptPath);
    // Disabled (or re-enabled) while the file was read: never run its code for
    // a stale activation (REV-LCMDS-03)
    if (entry._activation !== activation || !entry.enabled) return;
    const sandbox = Cu.Sandbox(Services.scriptSecurityManager.getSystemPrincipal(), {
      sandboxName: `ZenLeap plugin: ${manifest.id}`,
      sandboxPrototype: window,
      wantXrays: false,
      freshCompartment: true,
    });
    trackPluginTimers(entry, sandbox);
    try {
      Cu.evalInSandbox(source, sandbox, 'latest', PathUtils.toFileURI(manifest._scriptPath), 1);
      const exported = sandbox.ZenLeapPlugin;
      if (!exported || typeof exported !== 'object') throw new Error('plugin.js must define a ZenLeapPlugin object');
      entry.sandbox = sandbox;
      entry.exports = exported;
      entry.loaded = true;
    } catch (e) {
      clearPluginTimers(entry);
      nukePluginSandbox(sandbox, manifest);
      throw e; // the plugin's own error
    }
  }

  // The plugin's global setTimeout/setInterval (and clear*): timers it leaves
  // running are cleared when it is disabled, instead of calling into its dead
  // sandbox on every tick.
  function trackPluginTimers(entry, sandbox) {
    const timers = entry._timers = new Set();
    sandbox.setTimeout = (fn, ms, ...args) => {
      if (typeof fn !== 'function') return window.setTimeout(fn, ms, ...args);
      const id = window.setTimeout((...a) => { timers.delete(id); fn(...a); }, ms, ...args);
      timers.add(id);
      return id;
    };
    sandbox.setInterval = (fn, ms, ...args) => {
      const id = window.setInterval(fn, ms, ...args);
      timers.add(id);
      return id;
    };
    sandbox.clearTimeout = (id) => { timers.delete(id); window.clearTimeout(id); };
    sandbox.clearInterval = (id) => { timers.delete(id); window.clearInterval(id); };
  }

  function clearPluginTimers(entry) {
    for (const id of entry._timers || []) window.clearTimeout(id); // clears intervals too
    entry._timers?.clear();
  }

  // Cut a plugin's code off: its functions (timers, listeners, observers it
  // left behind) become dead wrappers.
  function nukePluginSandbox(sandbox, manifest) {
    try { Cu.nukeSandbox(sandbox); }
    catch (e) { reportError(`Plugin "${manifest.name}": releasing its sandbox failed`, e); }
  }

  // Load (if needed) and init a plugin in this window. Each activation has a
  // token: a disable (or another enable) while plugin.js loads supersedes it.
  async function activatePlugin(entry) {
    const { manifest } = entry;
    const activation = entry._activation = {};
    entry.enabled = true;
    entry.error = null;
    entry._initFailed = false;
    try {
      if (!entry.loaded) await loadPluginScript(entry, activation);
      if (entry._activation !== activation || !entry.enabled || _pluginRegistry.get(manifest.id) !== entry) return; // disabled/removed while loading
      if (!entry.loaded) return;
      if (typeof entry.exports.init === 'function') {
        try {
          entry.instance = entry.exports.init(createScopedPluginAPI(manifest.id)) || {};
        } catch (e) {
          entry._initFailed = true; // no destroy() for an init() that threw (REV-LCMDS-11)
          throw e;
        }
      }
      log(`Plugin "${manifest.name}" initialized`);
    } catch (e) {
      entry.error = e?.message || String(e);
      entry.instance = null;
      console.error(`[ZenLeap] Plugin "${manifest.name}" failed to load:`, e);
    }
    invalidateCommandCache();
    if (_pluginManagerMode) renderPluginManagerContent();
  }

  // Run the plugin's destroy hook (exactly one; none if init() threw) and
  // release its sandbox.
  function deactivatePlugin(entry) {
    const { manifest, instance, exports } = entry;
    entry._activation = null;
    try {
      if (entry._initFailed) { /* init() threw: nothing to tear down; the sandbox nuke cuts it off */ }
      else if (instance && instance !== exports && typeof instance.destroy === 'function') instance.destroy();
      else if (typeof exports?.destroy === 'function') exports.destroy(createScopedPluginAPI(manifest.id));
    } catch (e) { console.error(`[ZenLeap] Plugin "${manifest.name}" destroy failed:`, e); }
    entry._initFailed = false;
    _pluginEventBus.removeAllForPlugin(manifest.id);
    entry.instance = null;
    entry._dynamicCommands = [];
    clearPluginTimers(entry);
    if (entry.sandbox) {
      nukePluginSandbox(entry.sandbox, manifest);
      entry.sandbox = null;
      entry.exports = null;
      entry.loaded = false;
    }
  }

  function unregisterPlugin(pluginId, { persist = true } = {}) {
    const entry = _pluginRegistry.get(pluginId);
    if (!entry) return false;

    if (entry.enabled) deactivatePlugin(entry);
    _pluginEventBus.emit('plugin:unregistered', { pluginId });
    _pluginRegistry.delete(pluginId);
    _pluginPrivateOverlay.delete(pluginId);
    if (persist) {
      delete _pluginData[pluginId];
      markPluginDataDirty(pluginId, '*');
      flushPluginData();
    }
    invalidateCommandCache();
    if (_pluginManagerMode) renderPluginManagerContent();
    return true;
  }

  function enablePlugin(pluginId, { persist = true } = {}) {
    const entry = _pluginRegistry.get(pluginId);
    if (!entry || entry.enabled) return;

    if (persist) {
      _pluginData[pluginId] = _pluginData[pluginId] || {};
      _pluginData[pluginId].enabled = true;
      delete _pluginData[pluginId].isNew;
      markPluginDataDirty(pluginId, 'enabled');
      markPluginDataDirty(pluginId, 'isNew');
      flushPluginData();
    }
    activatePlugin(entry);
    _pluginEventBus.emit('plugin:enabled', { pluginId });
    log(`Plugin "${entry.manifest.name}" enabled`);
  }

  function disablePlugin(pluginId, { persist = true } = {}) {
    const entry = _pluginRegistry.get(pluginId);
    if (!entry || !entry.enabled) return;

    _pluginEventBus.emit('plugin:disabled', { pluginId });
    deactivatePlugin(entry);
    entry.enabled = false;
    entry.error = null;
    if (persist) {
      _pluginData[pluginId] = _pluginData[pluginId] || {};
      _pluginData[pluginId].enabled = false;
      markPluginDataDirty(pluginId, 'enabled');
      flushPluginData();
    }

    invalidateCommandCache();
    if (_pluginManagerMode) renderPluginManagerContent();
    log(`Plugin "${entry.manifest.name}" disabled`);
  }

  // ── Get Plugin Commands ──
  // Plugin commands are grouped per plugin in the palette (after the built-in groups).
  function getPluginCommands() {
    const commands = [];
    const groups = [];
    for (const [pluginId, entry] of _pluginRegistry) {
      if (!entry.enabled || !entry.loaded) continue;
      const groupId = `plugin:${pluginId}`;
      groups.push({ id: groupId, label: entry.manifest.name, icon: entry.manifest.icon, keys: [] });
      const tags = ['plugin', pluginId, entry.manifest.name.toLowerCase()];

      // Commands from manifest (implementations from init()'s return value or the exports)
      for (const cmd of entry.manifest.commands) {
        const impl = entry.instance?.commands?.[cmd.key] || entry.exports?.commands?.[cmd.key] || cmd.command;
        commands.push({
          key: `plugin:${pluginId}:${cmd.key}`,
          label: cmd.label,
          icon: cmd.icon || entry.manifest.icon,
          tags: [...cmd.tags, ...tags],
          group: groupId,
          condition: cmd.condition,
          command: typeof impl === 'function' ? impl : undefined,
          subFlow: cmd.subFlow,
        });
      }

      // Dynamic commands registered at runtime
      for (const cmd of entry._dynamicCommands) {
        commands.push({
          key: `plugin:${pluginId}:dyn:${cmd.key}`,
          label: cmd.label,
          icon: cmd.icon || entry.manifest.icon,
          tags: [...cmd.tags, ...tags],
          group: groupId,
          condition: cmd.condition,
          command: cmd.command,
        });
      }
    }
    syncPluginCommandGroups(groups);
    return commands;
  }

  // Give each plugin its own palette section (after the built-in groups).
  function syncPluginCommandGroups(groups) {
    COMMAND_GROUPS.splice(STATIC_COMMAND_GROUP_COUNT, COMMAND_GROUPS.length, ...groups);
  }

  function getRegisteredPlugins() {
    const plugins = [];
    for (const [id, entry] of _pluginRegistry) {
      plugins.push({
        id,
        name: entry.manifest.name,
        version: entry.manifest.version,
        description: entry.manifest.description,
        author: entry.manifest.author,
        icon: entry.manifest.icon,
        enabled: entry.enabled,
        isNew: !entry.enabled && !!_pluginData[id]?.isNew,
        error: entry.error,
        commandCount: entry.manifest.commands.length + entry._dynamicCommands.length,
        builtIn: !!entry.manifest.builtIn,
        hasSettings: Object.keys(entry.manifest.settings).length > 0,
      });
    }
    return plugins;
  }

  // ── External Plugin Loader ──
  async function getPluginsDirectory() {
    const dir = PathUtils.join(PathUtils.profileDir, 'chrome', 'zenleap-plugins');
    try { await IOUtils.makeDirectory(dir, { ignoreExisting: true }); }
    catch (e) { reportError('Failed to create the plugins directory', e); }
    return dir;
  }

  async function loadExternalPlugins() {
    const dir = await getPluginsDirectory();
    let children;
    try { children = await IOUtils.getChildren(dir); }
    catch (e) { reportError('Failed to list the plugins directory', e); return; }

    for (const childPath of children.sort()) {
      try {
        const stat = await IOUtils.stat(childPath);
        if (stat.type !== 'directory') continue;

        let manifestText;
        try { manifestText = await IOUtils.readUTF8(PathUtils.join(childPath, 'manifest.json')); }
        catch (e) { continue; } // No manifest, skip

        let manifest;
        try { manifest = JSON.parse(manifestText); }
        catch (e) { console.warn(`[ZenLeap] Skipping plugin at ${childPath}: manifest.json is not valid JSON`, e); continue; }

        const scriptPath = PathUtils.join(childPath, 'plugin.js');
        if (!(await IOUtils.exists(scriptPath))) {
          console.warn(`[ZenLeap] Skipping plugin at ${childPath}: no plugin.js found`);
          continue;
        }

        // registerPlugin validates the manifest and only evaluates plugin.js when enabled
        if (registerPlugin({ ...manifest, builtIn: false, _path: childPath, _scriptPath: scriptPath })) {
          log(`Registered external plugin: ${manifest.name} v${manifest.version || '1.0.0'}`);
        }
      } catch (e) {
        console.error(`[ZenLeap] Error loading plugin from ${childPath}:`, e);
      }
    }

    // One toast for everything this scan found
    const found = _newPluginNames.splice(0);
    if (found.length === 1) {
      showZenLeapToast(`New ZenLeap plugin found: ${found[0]} \u2014 enable it in Manage Plugins`, 6000);
    } else if (found.length > 1) {
      showZenLeapToast(`${found.length} new ZenLeap plugins found (${found.join(', ')}) \u2014 enable them in Manage Plugins`, 8000);
    }
  }

  // Uninstall an external plugin (remove files and data)
  async function uninstallExternalPlugin(pluginId) {
    const entry = _pluginRegistry.get(pluginId);
    if (!entry || entry.manifest.builtIn) return false;

    const pluginPath = entry.manifest._path;
    unregisterPlugin(pluginId);

    if (pluginPath) {
      try {
        await IOUtils.remove(pluginPath, { recursive: true });
        log(`Removed plugin files: ${pluginPath}`);
      } catch (e) { reportError(`Failed to remove the files of plugin "${pluginId}"`, e); }
    }
    return true;
  }

  // ============================================
  // PLUGIN MANAGER UI
  // ============================================

  function createPluginManagerModal() {
    if (_pluginManagerModal) return;
    ensurePluginUiStyles();

    const modal = document.createElement('div');
    modal.id = 'zenleap-plugin-manager-modal';
    const backdrop = document.createElement('div');
    backdrop.id = 'zenleap-plugin-manager-backdrop';
    backdrop.addEventListener('click', () => exitPluginManagerMode());
    const container = document.createElement('div');
    container.id = 'zenleap-plugin-manager-container';
    modal.appendChild(backdrop);
    modal.appendChild(container);

    injectStyleBlock('zenleap-plugin-manager-styles', `
      #zenleap-plugin-manager-modal { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; z-index: 100003; display: none; justify-content: center; align-items: center; padding: 20px; box-sizing: border-box; }
      #zenleap-plugin-manager-modal.active { display: flex; }
      #zenleap-plugin-manager-backdrop { position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: var(--zl-backdrop); backdrop-filter: var(--zl-blur); }
      #zenleap-plugin-manager-container { position: relative; width: 95%; max-width: 680px; max-height: 80vh; background: var(--zl-bg-surface); border-radius: var(--zl-r-xl); box-shadow: var(--zl-shadow-modal); overflow: hidden; display: flex; flex-direction: column; animation: zenleap-pm-appear 0.2s ease-out; font-family: var(--zl-font-ui); color: var(--zl-text-primary); }
      .zenleap-pm-header { padding: 20px 24px 16px; border-bottom: 1px solid var(--zl-border-subtle); display: flex; justify-content: space-between; align-items: center; }
      .zenleap-pm-header h1 { margin: 0; font-size: 20px; font-weight: 700; color: var(--zl-accent); }
      .zenleap-pm-subtitle { display: block; margin-top: 3px; font-size: 11px; color: var(--zl-text-tertiary); }
      .zenleap-pm-close { background: none; border: none; color: var(--zl-text-muted); font-size: 18px; cursor: pointer; padding: 4px 8px; border-radius: var(--zl-r-sm); transition: all 0.15s; }
      .zenleap-pm-close:hover { color: var(--zl-text-primary); background: var(--zl-bg-hover); }
      .zenleap-pm-body { flex: 1; overflow-y: auto; padding: 8px 0; scrollbar-width: thin; scrollbar-color: var(--zl-border-strong) transparent; }
      .zenleap-pm-plugin-card { display: flex; align-items: center; gap: 14px; padding: 14px 24px; transition: background 0.12s; cursor: pointer; border-left: 2px solid transparent; }
      .zenleap-pm-plugin-card:hover { background: var(--zl-bg-raised); }
      .zenleap-pm-plugin-card.focused { background: var(--zl-accent-dim); border-left-color: var(--zl-accent); }
      .zenleap-pm-plugin-icon { font-size: 28px; width: 44px; height: 44px; display: flex; align-items: center; justify-content: center; background: var(--zl-accent-dim); border-radius: var(--zl-r-md); flex-shrink: 0; }
      .zenleap-pm-plugin-icon .zenleap-icon-img { width: 24px; height: 24px; }
      .zenleap-pm-plugin-info { flex: 1; min-width: 0; }
      .zenleap-pm-plugin-name { font-size: 14px; font-weight: 600; color: var(--zl-text-primary); display: flex; align-items: center; gap: 8px; }
      .zenleap-pm-badge { font-size: 9px; font-weight: 600; padding: 2px 6px; border-radius: 4px; text-transform: uppercase; letter-spacing: 0.5px; }
      .zenleap-pm-badge-builtin { background: var(--zl-accent-dim); color: var(--zl-accent); }
      .zenleap-pm-badge-version { background: var(--zl-bg-raised); color: var(--zl-text-tertiary); }
      .zenleap-pm-badge-external { background: color-mix(in srgb, var(--zl-green) 15%, transparent); color: var(--zl-green); }
      .zenleap-pm-badge-new { background: color-mix(in srgb, var(--zl-gold) 18%, transparent); color: var(--zl-gold); }
      .zenleap-pm-badge-error { background: color-mix(in srgb, var(--zl-red) 18%, transparent); color: var(--zl-red); }
      .zenleap-pm-plugin-desc { font-size: 12px; color: var(--zl-text-secondary); margin-top: 3px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .zenleap-pm-plugin-meta { font-size: 11px; color: var(--zl-text-tertiary); margin-top: 3px; }
      .zenleap-pm-plugin-meta.error { color: var(--zl-red); }
      .zenleap-pm-plugin-actions { display: flex; gap: 6px; flex-shrink: 0; }
      .zenleap-pm-toggle-btn { padding: 6px 14px; border-radius: var(--zl-r-sm); font-size: 12px; font-weight: 500; cursor: pointer; transition: all 0.15s; border: 1px solid; font-family: inherit; }
      .zenleap-pm-toggle-btn.enabled { background: var(--zl-accent-dim); border-color: var(--zl-accent-border); color: var(--zl-accent); }
      .zenleap-pm-toggle-btn.enabled:hover { background: color-mix(in srgb, var(--zl-red) 15%, transparent); border-color: color-mix(in srgb, var(--zl-red) 30%, transparent); color: var(--zl-red); }
      .zenleap-pm-toggle-btn.disabled { background: var(--zl-bg-raised); border-color: var(--zl-border-strong); color: var(--zl-text-secondary); }
      .zenleap-pm-toggle-btn.disabled:hover { background: color-mix(in srgb, var(--zl-green) 15%, transparent); border-color: color-mix(in srgb, var(--zl-green) 30%, transparent); color: var(--zl-green); }
      .zenleap-pm-uninstall-btn { background: none; border: 1px solid color-mix(in srgb, var(--zl-red) 25%, transparent); color: var(--zl-red); padding: 6px 10px; border-radius: var(--zl-r-sm); font-size: 12px; cursor: pointer; transition: all 0.15s; font-family: inherit; }
      .zenleap-pm-uninstall-btn:hover { background: color-mix(in srgb, var(--zl-red) 15%, transparent); }
      .zenleap-pm-empty { padding: 40px 20px; text-align: center; color: var(--zl-text-muted); font-size: 14px; }
      .zenleap-pm-footer { padding: 12px 24px; border-top: 1px solid var(--zl-border-subtle); display: flex; justify-content: space-between; align-items: center; gap: 12px; font-size: 11px; color: var(--zl-text-muted); }
      .zenleap-pm-footer-keys { white-space: nowrap; flex-shrink: 0; }
      .zenleap-pm-footer-hint { font-style: italic; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .zenleap-pm-detail-header { padding: 20px 24px 16px; border-bottom: 1px solid var(--zl-border-subtle); }
      .zenleap-pm-detail-back { background: none; border: none; color: var(--zl-text-secondary); font-size: 13px; cursor: pointer; padding: 4px 0; margin-bottom: 8px; display: flex; align-items: center; gap: 4px; font-family: inherit; }
      .zenleap-pm-detail-back:hover { color: var(--zl-accent); }
      .zenleap-pm-detail-title { display: flex; align-items: center; gap: 12px; }
      .zenleap-pm-detail-icon { font-size: 32px; width: 48px; height: 48px; display: flex; align-items: center; justify-content: center; background: var(--zl-accent-dim); border-radius: var(--zl-r-lg); }
      .zenleap-pm-detail-name { font-size: 20px; font-weight: 700; color: var(--zl-text-primary); margin: 0; }
      .zenleap-pm-detail-author { font-size: 12px; color: var(--zl-text-secondary); margin-top: 2px; }
      .zenleap-pm-detail-body { padding: 20px 24px; overflow-y: auto; flex: 1; scrollbar-width: thin; scrollbar-color: var(--zl-border-strong) transparent; }
      .zenleap-pm-detail-section { margin-bottom: 20px; }
      .zenleap-pm-detail-section h3 { font-size: 11px; font-weight: 600; color: var(--zl-accent); text-transform: uppercase; letter-spacing: 0.8px; margin: 0 0 10px; }
      .zenleap-pm-detail-desc { font-size: 13px; color: var(--zl-text-secondary); line-height: 1.5; margin: 0; }
      .zenleap-pm-detail-error { font-size: 12px; color: var(--zl-red); font-family: var(--zl-font-mono); white-space: pre-wrap; }
      .zenleap-pm-cmd-row { display: flex; align-items: center; gap: 10px; padding: 8px 12px; border-radius: var(--zl-r-md); background: var(--zl-bg-raised); margin-bottom: 4px; }
      .zenleap-pm-cmd-icon { font-size: 16px; width: 24px; text-align: center; }
      .zenleap-pm-cmd-label { font-size: 13px; color: var(--zl-text-primary); }
      .zenleap-pm-cmd-tags { font-size: 11px; color: var(--zl-text-tertiary); margin-left: auto; }
      .zenleap-pm-setting-row { display: flex; align-items: center; gap: 12px; padding: 8px 12px; border-radius: var(--zl-r-md); }
      .zenleap-pm-setting-row:hover { background: var(--zl-bg-raised); }
      .zenleap-pm-setting-label { flex: 1; }
      .zenleap-pm-setting-name { font-size: 13px; font-weight: 500; color: var(--zl-text-primary); }
      .zenleap-pm-setting-desc { font-size: 11px; color: var(--zl-text-tertiary); margin-top: 2px; }
      .zenleap-pm-input { background: var(--zl-bg-raised); border: 1px solid var(--zl-border-strong); color: var(--zl-text-primary); padding: 5px 10px; border-radius: var(--zl-r-sm); font-size: 13px; outline: none; font-family: inherit; }
      .zenleap-pm-input:focus { border-color: var(--zl-accent); }
      .zenleap-pm-switch { position: relative; display: inline-block; width: 36px; height: 20px; flex-shrink: 0; }
      .zenleap-pm-switch input { opacity: 0; width: 0; height: 0; position: absolute; }
      .zenleap-pm-switch-slider { position: absolute; cursor: pointer; inset: 0; background: var(--zl-bg-elevated); border: 1px solid var(--zl-border-strong); border-radius: 20px; transition: background 0.2s; }
      .zenleap-pm-switch-slider::before { content: ''; position: absolute; height: 14px; width: 14px; left: 2px; top: 2px; background: var(--zl-text-secondary); border-radius: 50%; transition: transform 0.2s, background 0.2s; }
      .zenleap-pm-switch input:checked + .zenleap-pm-switch-slider { background: var(--zl-accent-mid); border-color: var(--zl-accent-border); }
      .zenleap-pm-switch input:checked + .zenleap-pm-switch-slider::before { transform: translateX(16px); background: var(--zl-accent); }
      .zenleap-pm-path-info { font-size: 11px; color: var(--zl-text-tertiary); font-family: var(--zl-font-mono); word-break: break-all; background: var(--zl-bg-raised); padding: 8px 12px; border-radius: var(--zl-r-sm); margin-top: 8px; }
    `);
    document.documentElement.appendChild(modal);
    _pluginManagerModal = modal;
  }

  function renderPluginManagerContent() {
    const container = document.getElementById('zenleap-plugin-manager-container');
    if (!container) return;
    while (container.firstChild) container.removeChild(container.firstChild);
    if (_pluginManagerView === 'detail' && _pluginManagerDetailId) renderPluginDetail(container);
    else renderPluginList(container);
  }

  function togglePluginEnabled(pluginId) {
    const entry = _pluginRegistry.get(pluginId);
    if (!entry) return;
    if (entry.enabled) disablePlugin(pluginId); else enablePlugin(pluginId);
    renderPluginManagerContent();
  }

  async function confirmAndUninstallPlugin(plugin) {
    // Deletes files and data: Enter cancels (REV-LCMDS-09)
    const confirmed = await _pluginShowConfirm('Uninstall Plugin', `Uninstall "${plugin.name}"? This will remove all plugin files and data.`, { defaultCancel: true });
    if (!confirmed) return;
    await uninstallExternalPlugin(plugin.id);
    _pluginManagerView = 'list';
    _pluginManagerDetailId = null;
    renderPluginManagerContent();
  }

  function openPluginDetail(pluginId) {
    _pluginManagerView = 'detail';
    _pluginManagerDetailId = pluginId;
    renderPluginManagerContent();
  }

  function renderPluginList(container) {
    const header = document.createElement('div');
    header.className = 'zenleap-pm-header';
    const headerLeft = document.createElement('div');
    const h1 = document.createElement('h1');
    h1.textContent = 'Plugins';
    const sub = document.createElement('span');
    sub.className = 'zenleap-pm-subtitle';
    sub.textContent = 'Plugins run with full browser privileges — only enable plugins you trust';
    headerLeft.appendChild(h1);
    headerLeft.appendChild(sub);
    header.appendChild(headerLeft);
    const closeBtn = document.createElement('button');
    closeBtn.className = 'zenleap-pm-close';
    closeBtn.textContent = '✕';
    closeBtn.addEventListener('click', () => exitPluginManagerMode());
    header.appendChild(closeBtn);

    const body = document.createElement('div');
    body.className = 'zenleap-pm-body';
    const plugins = getRegisteredPlugins();
    _pluginManagerFocus = Math.max(0, Math.min(_pluginManagerFocus, plugins.length - 1));
    if (plugins.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'zenleap-pm-empty';
      empty.textContent = 'No plugins installed';
      body.appendChild(empty);
    } else {
      plugins.forEach((plugin, idx) => {
        const card = document.createElement('div');
        card.className = `zenleap-pm-plugin-card${idx === _pluginManagerFocus ? ' focused' : ''}`;
        card.dataset.pluginId = plugin.id;
        const icon = document.createElement('div');
        icon.className = 'zenleap-pm-plugin-icon';
        icon.appendChild(createIconNode(plugin.icon, '🧩'));
        const info = document.createElement('div');
        info.className = 'zenleap-pm-plugin-info';
        info.addEventListener('click', () => { _pluginManagerFocus = idx; openPluginDetail(plugin.id); });
        const nameRow = document.createElement('div');
        nameRow.className = 'zenleap-pm-plugin-name';
        nameRow.appendChild(document.createTextNode(plugin.name));
        const badge = (cls, text) => { const b = document.createElement('span'); b.className = `zenleap-pm-badge ${cls}`; b.textContent = text; nameRow.appendChild(b); };
        badge('zenleap-pm-badge-version', `v${plugin.version}`);
        badge(plugin.builtIn ? 'zenleap-pm-badge-builtin' : 'zenleap-pm-badge-external', plugin.builtIn ? 'Built-in' : 'External');
        if (plugin.isNew) badge('zenleap-pm-badge-new', 'New');
        if (plugin.error) badge('zenleap-pm-badge-error', 'Error');
        const desc = document.createElement('div');
        desc.className = 'zenleap-pm-plugin-desc';
        desc.textContent = plugin.description;
        const meta = document.createElement('div');
        meta.className = `zenleap-pm-plugin-meta${plugin.error ? ' error' : ''}`;
        meta.textContent = plugin.error
          ? `Failed to load: ${plugin.error}`
          : plugin.isNew
            ? 'New plugin found — enable it to run it'
            : `${plugin.commandCount} command${plugin.commandCount !== 1 ? 's' : ''} · by ${plugin.author}`;
        info.appendChild(nameRow);
        info.appendChild(desc);
        info.appendChild(meta);
        const actions = document.createElement('div');
        actions.className = 'zenleap-pm-plugin-actions';
        const toggleBtn = document.createElement('button');
        toggleBtn.className = `zenleap-pm-toggle-btn ${plugin.enabled ? 'enabled' : 'disabled'}`;
        toggleBtn.textContent = plugin.enabled ? 'Enabled' : 'Disabled';
        toggleBtn.addEventListener('click', (e) => { e.stopPropagation(); _pluginManagerFocus = idx; togglePluginEnabled(plugin.id); });
        actions.appendChild(toggleBtn);
        if (!plugin.builtIn) {
          const unBtn = document.createElement('button');
          unBtn.className = 'zenleap-pm-uninstall-btn';
          unBtn.textContent = 'Uninstall';
          unBtn.addEventListener('click', (e) => { e.stopPropagation(); confirmAndUninstallPlugin(plugin); });
          actions.appendChild(unBtn);
        }
        card.appendChild(icon);
        card.appendChild(info);
        card.appendChild(actions);
        body.appendChild(card);
      });
    }

    const footer = document.createElement('div');
    footer.className = 'zenleap-pm-footer';
    const fLeft = document.createElement('span');
    fLeft.className = 'zenleap-pm-footer-keys';
    fLeft.textContent = plugins.length
      ? 'j/k select · Enter details · Space enable/disable · Esc close'
      : 'Esc close';
    footer.appendChild(fLeft);
    const fRight = document.createElement('span');
    fRight.className = 'zenleap-pm-footer-hint';
    fRight.textContent = 'Loading...';
    getPluginsDirectory().then(dir => { fRight.textContent = `Plugins dir: ${dir}`; fRight.title = dir; });
    footer.appendChild(fRight);

    container.appendChild(header);
    container.appendChild(body);
    container.appendChild(footer);
    body.querySelector('.zenleap-pm-plugin-card.focused')?.scrollIntoView({ block: 'nearest' });
  }

  function renderPluginDetail(container) {
    const entry = _pluginRegistry.get(_pluginManagerDetailId);
    if (!entry) { _pluginManagerView = 'list'; renderPluginManagerContent(); return; }
    const { manifest } = entry;
    const plugin = getRegisteredPlugins().find(p => p.id === _pluginManagerDetailId);

    const header = document.createElement('div');
    header.className = 'zenleap-pm-detail-header';
    const backBtn = document.createElement('button');
    backBtn.className = 'zenleap-pm-detail-back';
    backBtn.textContent = '← Back to plugins';
    backBtn.addEventListener('click', () => { _pluginManagerView = 'list'; _pluginManagerDetailId = null; renderPluginManagerContent(); });
    const titleRow = document.createElement('div');
    titleRow.className = 'zenleap-pm-detail-title';
    const iconEl = document.createElement('div');
    iconEl.className = 'zenleap-pm-detail-icon';
    iconEl.appendChild(createIconNode(manifest.icon, '🧩'));
    const titleInfo = document.createElement('div');
    const nameEl = document.createElement('h2');
    nameEl.className = 'zenleap-pm-detail-name';
    nameEl.textContent = manifest.name;
    const authorEl = document.createElement('div');
    authorEl.className = 'zenleap-pm-detail-author';
    authorEl.textContent = `v${manifest.version} · by ${manifest.author}`;
    titleInfo.appendChild(nameEl);
    titleInfo.appendChild(authorEl);
    titleRow.appendChild(iconEl);
    titleRow.appendChild(titleInfo);
    header.appendChild(backBtn);
    header.appendChild(titleRow);

    const body = document.createElement('div');
    body.className = 'zenleap-pm-detail-body';
    const section = (title) => {
      const sec = document.createElement('div');
      sec.className = 'zenleap-pm-detail-section';
      const h3 = document.createElement('h3');
      h3.textContent = title;
      sec.appendChild(h3);
      body.appendChild(sec);
      return sec;
    };

    if (entry.error) {
      const pre = document.createElement('div');
      pre.className = 'zenleap-pm-detail-error';
      pre.textContent = entry.error;
      section('Load error').appendChild(pre);
    }

    // Description
    if (manifest.description) {
      const p = document.createElement('p');
      p.className = 'zenleap-pm-detail-desc';
      p.textContent = manifest.description;
      section('Description').appendChild(p);
    }

    // Commands
    if (manifest.commands.length > 0) {
      const sec = section(`Commands (${manifest.commands.length})`);
      for (const cmd of manifest.commands) {
        const row = document.createElement('div');
        row.className = 'zenleap-pm-cmd-row';
        const ci = document.createElement('span'); ci.className = 'zenleap-pm-cmd-icon'; ci.appendChild(createIconNode(cmd.icon || manifest.icon, '🧩'));
        const cl = document.createElement('span'); cl.className = 'zenleap-pm-cmd-label'; cl.textContent = cmd.label;
        const ct = document.createElement('span'); ct.className = 'zenleap-pm-cmd-tags'; ct.textContent = cmd.tags.join(', ');
        row.appendChild(ci); row.appendChild(cl); row.appendChild(ct);
        sec.appendChild(row);
      }
    }

    // Plugin settings
    const settingEntries = Object.entries(manifest.settings);
    if (settingEntries.length > 0) {
      const sec = section('Settings');
      const api = createScopedPluginAPI(_pluginManagerDetailId);
      for (const [key, schema] of settingEntries) {
        const row = document.createElement('div');
        row.className = 'zenleap-pm-setting-row';
        const label = document.createElement('div');
        label.className = 'zenleap-pm-setting-label';
        const nameSpan = document.createElement('span');
        nameSpan.className = 'zenleap-pm-setting-name';
        nameSpan.textContent = schema.label;
        label.appendChild(nameSpan);
        if (schema.description) { const d = document.createElement('div'); d.className = 'zenleap-pm-setting-desc'; d.textContent = schema.description; label.appendChild(d); }
        row.appendChild(label);

        const control = document.createElement('div');
        const currentVal = api.settings.getOwn(key);
        if (schema.type === 'toggle') {
          const toggle = document.createElement('label');
          toggle.className = 'zenleap-pm-switch';
          const cb = document.createElement('input');
          cb.type = 'checkbox';
          cb.checked = !!currentVal;
          const slider = document.createElement('span');
          slider.className = 'zenleap-pm-switch-slider';
          toggle.appendChild(cb);
          toggle.appendChild(slider);
          cb.addEventListener('change', () => { api.settings.setOwn(key, cb.checked); });
          control.appendChild(toggle);
        } else if (schema.type === 'number') {
          const input = document.createElement('input');
          input.type = 'number';
          input.className = 'zenleap-pm-input';
          input.style.width = '80px';
          input.value = currentVal ?? '';
          if (schema.min !== undefined) input.min = schema.min;
          if (schema.max !== undefined) input.max = schema.max;
          if (schema.step !== undefined) input.step = schema.step;
          input.addEventListener('change', () => {
            let v = parseFloat(input.value);
            if (!Number.isFinite(v)) v = schema.default;
            if (typeof schema.min === 'number') v = Math.max(schema.min, v);
            if (typeof schema.max === 'number') v = Math.min(schema.max, v);
            input.value = v;
            api.settings.setOwn(key, v);
          });
          control.appendChild(input);
        } else if (schema.type === 'text') {
          const input = document.createElement('input');
          input.type = 'text';
          input.className = 'zenleap-pm-input';
          input.style.width = '120px';
          input.value = currentVal || '';
          input.addEventListener('change', () => { api.settings.setOwn(key, input.value); });
          control.appendChild(input);
        }
        row.appendChild(control);
        sec.appendChild(row);
      }
    }

    // Path info for external plugins
    if (manifest._path) {
      const pathInfo = document.createElement('div');
      pathInfo.className = 'zenleap-pm-path-info';
      pathInfo.textContent = manifest._path;
      section('Location').appendChild(pathInfo);
    }

    // Actions
    const actSec = section('Actions');
    const actRow = document.createElement('div');
    actRow.style.cssText = 'display: flex; gap: 8px;';
    const toggleBtn = document.createElement('button');
    toggleBtn.className = `zenleap-pm-toggle-btn ${plugin.enabled ? 'enabled' : 'disabled'}`;
    toggleBtn.textContent = plugin.enabled ? 'Enabled' : 'Disabled';
    toggleBtn.addEventListener('click', () => togglePluginEnabled(plugin.id));
    actRow.appendChild(toggleBtn);
    if (!plugin.builtIn) {
      const unBtn = document.createElement('button');
      unBtn.className = 'zenleap-pm-uninstall-btn';
      unBtn.textContent = 'Uninstall';
      unBtn.addEventListener('click', () => confirmAndUninstallPlugin(plugin));
      actRow.appendChild(unBtn);
    }
    actSec.appendChild(actRow);

    const footer = document.createElement('div');
    footer.className = 'zenleap-pm-footer';
    footer.textContent = 'h/Backspace back · j/k scroll · Space enable/disable · Esc back';

    container.appendChild(header);
    container.appendChild(body);
    container.appendChild(footer);
  }

  // Keyboard navigation for the Plugin Manager (Escape is handled by the main key handler).
  function handlePluginManagerKey(event) {
    if (event.key === 'Escape' || event.ctrlKey || event.altKey || event.metaKey) return false;
    const target = event.composedTarget || event.target;
    if (target?.closest?.('input, textarea')) return false;
    const isDetail = _pluginManagerView === 'detail' && _pluginManagerDetailId;
    const key = event.key;
    if (isDetail) {
      const body = _pluginManagerModal?.querySelector('.zenleap-pm-detail-body');
      if (key === 'j' || key === 'ArrowDown') { body?.scrollBy({ top: 60 }); return true; }
      if (key === 'k' || key === 'ArrowUp') { body?.scrollBy({ top: -60 }); return true; }
      if (key === 'h' || key === 'Backspace' || key === 'ArrowLeft') {
        _pluginManagerView = 'list';
        _pluginManagerDetailId = null;
        renderPluginManagerContent();
        return true;
      }
      if (key === ' ' || key === 'e') { togglePluginEnabled(_pluginManagerDetailId); return true; }
      return false;
    }
    const plugins = getRegisteredPlugins();
    if (plugins.length === 0) return false;
    if (key === 'j' || key === 'ArrowDown') { _pluginManagerFocus = Math.min(_pluginManagerFocus + 1, plugins.length - 1); renderPluginManagerContent(); return true; }
    if (key === 'k' || key === 'ArrowUp') { _pluginManagerFocus = Math.max(_pluginManagerFocus - 1, 0); renderPluginManagerContent(); return true; }
    const focused = plugins[_pluginManagerFocus];
    if (!focused) return false;
    if (key === 'Enter' || key === 'l' || key === 'ArrowRight') { openPluginDetail(focused.id); return true; }
    if (key === ' ' || key === 'e') { togglePluginEnabled(focused.id); return true; }
    return false;
  }

  function enterPluginManagerMode() {
    if (_pluginManagerMode) return;
    if (settingsMode) exitSettingsMode();
    if (helpMode) exitHelpMode();
    if (leapMode) exitLeapMode(false);
    if (searchMode) exitSearchMode();
    createPluginManagerModal();
    _pluginManagerMode = true;
    _pluginManagerView = 'list';
    _pluginManagerDetailId = null;
    _pluginManagerFocus = 0;
    renderPluginManagerContent();
    _pluginManagerModal.classList.add('active');
    log('Entered plugin manager mode');
  }

  function exitPluginManagerMode() {
    if (!_pluginManagerMode) return;
    _pluginManagerMode = false;
    if (_pluginManagerModal) _pluginManagerModal.classList.remove('active');
    if (S['display.refocusOnClose']) try { gBrowser.selectedBrowser.focus(); } catch (_) {}
    log('Exited plugin manager mode');
  }

  // ── Initialize Plugin System ──
  function _onWorkspaceChangedForPlugins({ workspace } = {}) {
    _pluginEventBus.emit('workspace:changed', { workspaceId: workspace?.uuid || null, workspace: workspace || null });
  }

  // Window unload / hot-unload: stop plugins (destroy hooks, sandboxes) and flush pending
  // data. Runs before destroy() (registered at script load); clearing the flags below
  // makes destroy()'s legacy full-file flush a no-op so it cannot overwrite newer data.
  function _pluginSystemUnload() {
    try { Services.obs.removeObserver(_onPluginDataBroadcast, PLUGIN_DATA_TOPIC); } catch (e) {}
    try { window.gZenWorkspaces?.removeChangeListeners?.(_onWorkspaceChangedForPlugins); } catch (e) {}
    for (const entry of _pluginRegistry.values()) {
      if (entry.enabled) deactivatePlugin(entry);
    }
    flushPluginData();
    _pluginDataLoaded = false;
  }
  onRegionTeardown(_pluginSystemUnload);

  // Hook called by the core teardown() on window unload and on Sine hot-unload. It
  // releases everything registered through onRegionTeardown (plugins, the settings and
  // update observers, the dialog key router); calling it more than once is harmless.
  function teardownPluginSystem() {
    teardownCommandsRegion();
  }

  async function initPluginSystem() {
    // Listen before reading the file, so changes broadcast meanwhile are not lost
    Services.obs.addObserver(_onPluginDataBroadcast, PLUGIN_DATA_TOPIC);
    try { window.gZenWorkspaces?.addChangeListeners?.(_onWorkspaceChangedForPlugins); }
    catch (e) { reportError('Could not subscribe to workspace changes for plugins', e); }
    await loadPluginData();
    await loadExternalPlugins();
    log(`Plugin system initialized: ${_pluginRegistry.size} plugin(s) registered`);
  }


  // ============================================
  // TAB / FOLDER / WORKSPACE HELPERS (commands, sub-flows, sessions)
  // ============================================

  // A tab that still exists (not being closed, still in the document)
  function isLiveTab(tab) {
    return !!tab && !tab.closing && tab.isConnected;
  }

  function liveTabs(tabs) {
    return Array.from(tabs || []).filter(isLiveTab);
  }

  // Display name of a Zen folder
  function folderName(folder) {
    return folder?.label || 'Unnamed Folder';
  }

  // Tabs in a folder (recursively), without Zen's placeholder tabs
  function folderTabCount(folder) {
    return folder?.tabs?.filter(t => !t.hasAttribute('zen-empty-tab')).length || 0;
  }

  // Workspaces exist in this window (not a private/unsynced window)
  function workspacesEnabled() {
    try { return !!window.gZenWorkspaces && !gZenWorkspaces.privateWindowOrDisabled; } catch (e) { return false; }
  }

  function workspaceCount() {
    try { return workspacesEnabled() ? (gZenWorkspaces.getWorkspaces()?.length || 0) : 0; } catch (e) { return 0; }
  }

  // Regular Zen folders of the active workspace, in sidebar order. Live folders are
  // excluded: Zen manages their tabs itself (matches Zen's own "Move to folder" menu).
  function getWorkspaceFolders() {
    let folders;
    try { folders = Array.from(gBrowser.tabContainer.querySelectorAll('zen-folder')); } catch (e) { return []; }
    const activeWsId = window.gZenWorkspaces?.activeWorkspace;
    return folders.filter(f => {
      if (!f.isZenFolder || f.isLiveFolder) return false;
      const wsId = f.getAttribute('zen-workspace-id');
      return !activeWsId || !wsId || wsId === activeWsId;
    });
  }

  function getWorkspaceName(workspaceId) {
    try { return gZenWorkspaces.getWorkspaces().find(w => w.uuid === workspaceId)?.name || null; }
    catch (e) { return null; }
  }

  // Sort tabs by their current sidebar position to preserve relative order.
  // Covers every workspace (gBrowser.tabs only holds the active one on Zen 1.2x).
  function sortTabsBySidebarPosition(tabs) {
    let allTabs;
    try { allTabs = window.gZenWorkspaces?.allStoredTabs; } catch (e) { allTabs = null; }
    if (!allTabs?.length) allTabs = gBrowser.tabs;
    const positionMap = new Map();
    Array.from(allTabs).forEach((t, idx) => positionMap.set(t, idx));
    return [...tabs].sort((a, b) => (positionMap.get(a) ?? Infinity) - (positionMap.get(b) ?? Infinity));
  }

  // Batch tab operations through Tabbrowser/Zen: one call per batch (one undo entry,
  // consistent tab caches and events) instead of per-tab loops or raw DOM moves.
  const TabOps = {
    // Close as one batch: a single "reopen closed tabs" restores all of them. `warn`
    // (a gBrowser.closingTabsEnum value) shows Firefox's own "close N tabs?" prompt
    // where Firefox would; returns the number of tabs closed.
    close(tabs, { warn } = {}) {
      const valid = liveTabs(tabs);
      if (valid.length === 0) return 0;
      if (warn !== undefined && !gBrowser.warnAboutClosingTabs(valid.length, warn)) return 0;
      gBrowser.removeTabs(valid);
      return valid.length;
    },
    // Firefox selects another tab first when the current one is unloaded, and handles
    // split views and beforeunload; resolves to the number of tabs unloaded.
    unload(tabs) {
      const valid = liveTabs(tabs).filter(t => !t.hasAttribute('pending'));
      if (valid.length === 0) return Promise.resolve(0);
      return gBrowser.explicitUnloadTabs(valid).then(() => valid.length);
    },
    // One ordered batch in sidebar order. Zen's moveTabsToWorkspace keeps the order (and
    // reverses its argument in place when new tabs go to the top): pass a fresh array.
    moveToWorkspace(tabs, workspaceId) {
      const valid = sortTabsBySidebarPosition(liveTabs(tabs));
      if (valid.length === 0 || !window.gZenWorkspaces) return 0;
      gZenWorkspaces.moveTabsToWorkspace([...valid], workspaceId);
      return valid.length;
    },
  };

  // Zen resolves removeWorkspace() only on its next ZenWorkspacesUIUpdate; never wait forever.
  function removeWorkspaceWithTimeout(workspaceId, timeoutMs = 5000) {
    let timer;
    const timeout = new Promise(resolve => { timer = setTimeout(() => resolve(false), timeoutMs); });
    const removal = Promise.resolve(gZenWorkspaces.removeWorkspace(workspaceId)).then(() => true);
    return Promise.race([removal, timeout]).finally(() => clearTimeout(timer));
  }

  // Small transient message at the bottom of the window (command results, plugins).
  let _toastTimer = null;
  function showZenLeapToast(message, duration = 3000) {
    injectStyleBlock('zenleap-toast-styles', `
        @keyframes zenleap-toast-rise {
          from { opacity: 0; transform: translateX(-50%) translateY(8px); }
          to { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
        #zenleap-toast {
          position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%);
          background: var(--zl-bg-elevated); color: var(--zl-text-primary); padding: 10px 20px;
          border-radius: var(--zl-r-md); font-size: 13px; z-index: 100010; max-width: 80vw;
          border: 1px solid var(--zl-accent-border); box-shadow: var(--zl-shadow-elevated);
          animation: zenleap-toast-rise 0.2s ease-out; font-family: var(--zl-font-ui);
        }
      `);
    let toast = document.getElementById('zenleap-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'zenleap-toast';
      document.documentElement.appendChild(toast);
    }
    toast.textContent = String(message ?? '');
    toast.style.display = 'block';
    clearTimeout(_toastTimer);
    _toastTimer = setTimeout(() => { toast.style.display = 'none'; }, duration);
  }

  // Icons from plugins, session files or synced spaces end up in HTML templates: keep
  // them to short plain text (emoji) or an icon URL so they can never break the
  // XHTML parser; fall back when nothing usable is left.
  function safeIconText(icon, fallback = '') {
    if (typeof icon !== 'string') return fallback;
    const cleaned = icon.replace(/[<>&"'`]/g, '').trim();
    if (!cleaned) return fallback;
    return isImageIcon(cleaned) ? cleaned : Array.from(cleaned).slice(0, 8).join('');
  }

  // The tab the user is "on". While a Glance preview is open the selected tab is the
  // glance child; tab-list operations (position, pinning, folders, workspaces, marks,
  // jumps) act on its parent. Page operations (reload, mute, bookmark, close) keep
  // using gBrowser.selectedTab, like Zen's own shortcuts.
  function currentTab() {
    const tab = gBrowser.selectedTab;
    try {
      return window.gZenGlanceManager?.getTabOrGlanceParent?.(tab) || tab;
    } catch (e) {
      return tab;
    }
  }

  // Data of the active split view (null when none is active)
  function activeSplitView() {
    const splitter = window.gZenViewSplitter;
    return splitter?.splitViewActive ? (splitter._data?.[splitter.currentView] || null) : null;
  }

  // ============================================
  // COMMAND PALETTE
  // ============================================

  // Each command gets the group named by the closest preceding group id string.
  function withCommandGroups(entries) {
    let group = null;
    const commands = [];
    for (const entry of entries) {
      if (typeof entry === 'string') group = entry;
      else commands.push(entry.group ? entry : { ...entry, group });
    }
    return commands;
  }

  // Static commands registry
  function getStaticCommands() {
    return withCommandGroups([
      'tab-mgmt',
      // --- Tab Management ---
      // A real, selected new tab through Firefox's standard path (focuses the URL bar).
      // Zen's floating URL bar that replaces new tabs stays on Ctrl+T.
      { key: 'new-tab', label: 'New Tab', icon: '+', tags: ['tab', 'create', 'open', 'mk'], command: () => { openTrustedLinkIn(BROWSER_NEW_TAB_URL, 'tab'); } },
      { key: 'close-tab', label: 'Close Current Tab', icon: '✕', tags: ['tab', 'close', 'remove', 'del', 'rm', 'cl'], command: () => { gBrowser.removeTab(gBrowser.selectedTab); } },
      // Bulk closes: confirm step (counts, Cancel first) when more than one tab would close;
      // removeTabs() closes them as one batch (one "Reopen closed tabs" restores them all)
      { key: 'close-other-tabs', label: 'Close Other Tabs', icon: '✕', tags: ['tab', 'close', 'other', 'del', 'rm', 'cl'],
        confirm: () => bulkCloseConfirmation(getOtherUnpinnedTabs(), n => `Close ${n} other tabs`),
        command: () => { closeTabsInBulk(getOtherUnpinnedTabs()); } },
      { key: 'close-tabs-right', label: 'Close Tabs to the Right', icon: '✕→', tags: ['tab', 'close', 'right', 'del', 'rm', 'cl'],
        confirm: () => bulkCloseConfirmation(getUnpinnedTabsBeside('right'), n => `Close ${n} tabs to the right`),
        command: () => { closeTabsInBulk(getUnpinnedTabsBeside('right')); } },
      { key: 'close-tabs-left', label: 'Close Tabs to the Left', icon: '←✕', tags: ['tab', 'close', 'left', 'del', 'rm', 'cl'],
        confirm: () => bulkCloseConfirmation(getUnpinnedTabsBeside('left'), n => `Close ${n} tabs to the left`),
        command: () => { closeTabsInBulk(getUnpinnedTabsBeside('left')); } },
      // Inserted next to the source tab, like Zen's own duplicate command
      { key: 'duplicate-tab', label: 'Duplicate Tab', icon: '⊕', tags: ['tab', 'duplicate', 'copy', 'clone', 'dup', 'cp'], command: () => {
        const tab = gBrowser.selectedTab;
        gBrowser.duplicateTab(tab, true, { tabIndex: tab.index + 1 });
      }},
      { key: 'pin-unpin-tab', label: 'Pin/Unpin Tab', icon: '📌', tags: ['tab', 'pin', 'unpin'], command: () => {
        const tab = currentTab();
        if (tab.pinned) gBrowser.unpinTab(tab); else gBrowser.pinTab(tab);
      }},

      // --- Zen Essential / Pinned Tab ---
      // Zen enforces the essentials limit and container-specific essentials
      { key: 'add-to-essentials', label: 'Add Tab to Essentials', icon: '⭐', tags: ['tab', 'essential', 'add', 'star', 'zen'],
        condition: () => {
          const tab = currentTab();
          return !!window.gZenPinnedTabManager && !tab.hasAttribute('zen-essential') && !tab.group &&
            gZenPinnedTabManager.canEssentialBeAdded(tab);
        },
        command: () => { gZenPinnedTabManager.addToEssentials(currentTab()); } },
      { key: 'remove-from-essentials', label: 'Remove from Essentials', icon: '⭐', tags: ['tab', 'essential', 'remove', 'unstar', 'zen'],
        condition: () => !!window.gZenPinnedTabManager && currentTab().hasAttribute('zen-essential'),
        command: () => { gZenPinnedTabManager.removeEssentials(currentTab()); } },
      // Zen's own tab context-menu commands, which Zen only adds in normal windows
      { key: 'rename-tab', label: 'Rename Tab', icon: '✏', tags: ['tab', 'rename', 'title', 'edit', 'name', 'ren', 'zen'],
        condition: () => !!document.getElementById('context_zen-edit-tab-title'),
        command: () => runTabContextCommand('context_zen-edit-tab-title', { key: 'rename-tab', label: 'Rename Tab' }) },
      { key: 'edit-tab-icon', label: 'Edit Tab Icon', icon: '🎨', tags: ['tab', 'icon', 'emoji', 'edit', 'custom', 'zen'],
        condition: () => !!document.getElementById('context_zen-edit-tab-icon'),
        command: () => runTabContextCommand('context_zen-edit-tab-icon', { key: 'edit-tab-icon', label: 'Edit Tab Icon' }) },
      { key: 'reset-pinned-tab', label: 'Reset Pinned Tab', icon: '↺', tags: ['tab', 'pinned', 'reset', 'original', 'zen'],
        condition: () => !!window.gZenPinnedTabManager && currentTab().pinned,
        command: () => { gZenPinnedTabManager.resetPinnedTab(currentTab()); } },
      { key: 'replace-pinned-url', label: 'Replace Pinned URL with Current', icon: '📌', tags: ['tab', 'pinned', 'replace', 'url', 'current', 'update', 'zen'],
        condition: () => !!window.gZenPinnedTabManager && currentTab().pinned,
        command: () => { gZenPinnedTabManager.replacePinnedUrlWithCurrent(currentTab()); } },
      { key: 'mute-unmute-tab', label: 'Mute/Unmute Tab', icon: '🔇', tags: ['tab', 'mute', 'unmute', 'audio', 'sound'], command: () => { gBrowser.selectedTab.toggleMuteAudio(); } },
      { key: 'find-playing-tab', label: 'Find Playing Tab', icon: '🔊', tags: ['tab', 'audio', 'media', 'sound', 'playing', 'music', 'video', 'find', 'go'],
        command: async () => {
          const playingTabs = getPlayingTabs();
          if (playingTabs.length === 0) {
            showZenLeapToast('No tab is playing audio');
            return;
          }
          if (playingTabs.length === 1) {
            await switchToTabAcrossWorkspaces(playingTabs[0]);
            return;
          }
          // Multiple playing tabs — re-enter the palette to pick one (lists all workspaces)
          enterSearchMode(true);
          enterSubFlow('playing-tabs', 'Find Playing Tab');
        }
      },
      // Firefox selects another tab first (and handles split views / beforeunload)
      { key: 'unload-tab', label: 'Unload Tab (Save Memory)', icon: '💤', tags: ['tab', 'unload', 'discard', 'memory', 'suspend'],
        command: () => TabOps.unload([currentTab()]) },

      // --- Tab Actions (Context Menu Parity) ---
      { key: 'reload-tab', label: 'Reload Tab', icon: '🔄', tags: ['tab', 'reload', 'refresh', 'r'], command: () => { gBrowser.reloadTab(gBrowser.selectedTab); } },
      { key: 'bookmark-tab', label: 'Bookmark Tab', icon: '🔖', tags: ['tab', 'bookmark', 'save', 'star', 'bm'], command: () => { PlacesCommandHook.bookmarkPage(); } },
      { key: 'reopen-closed-tab', label: 'Reopen Closed Tab', icon: '↩', tags: ['tab', 'reopen', 'undo', 'closed', 'restore', 'undoclose'], command: () => { SessionStore.undoCloseTab(window, 0); } },
      { key: 'select-all-tabs', label: 'Select All Tabs (Browse Mode)', icon: '☑', tags: ['tab', 'select', 'all', 'sel'], command: () => {
        const allTabs = liveTabs(getVisibleTabs());
        selectTabsInBrowseMode(allTabs);
      }},
      // --- Tab Selection (Multi-Step) ---
      { key: 'select-matching-tabs', label: 'Select Matching Tabs...', icon: '🔎', tags: ['tab', 'select', 'search', 'match', 'filter', 'batch', 'sel', 'find'], subFlow: 'tab-search' },
      { key: 'deduplicate-tabs', label: 'Deduplicate Tabs (Close Duplicates)', icon: '🧹', tags: ['tab', 'duplicate', 'deduplicate', 'close', 'clean', 'unique', 'dedup'], subFlow: 'dedup-preview' },

      // --- Tab Movement ---
      { key: 'move-tab-to-top', label: 'Move Tab to Top', icon: '⤒', tags: ['tab', 'move', 'top', 'first', 'beginning', 'mv'], command: () => {
        const tab = currentTab();
        // Unpin if pinned (except essentials) so it can move to the regular tab area
        if (tab.pinned && !tab.hasAttribute('zen-essential')) gBrowser.unpinTab(tab);
        const tabs = getVisibleTabs();
        // Find the first non-pinned, non-essential tab position
        const firstRegularIdx = tabs.findIndex(t => !t.pinned && !t.hasAttribute('zen-essential'));
        if (firstRegularIdx >= 0 && tabs[firstRegularIdx] !== tab) {
          gBrowser.moveTabBefore(tab, tabs[firstRegularIdx]);
          log('Moved tab to top (below pinned/essential)');
        }
      }},
      { key: 'move-tab-to-bottom', label: 'Move Tab to Bottom', icon: '⤓', tags: ['tab', 'move', 'bottom', 'last', 'end', 'mv'], command: () => {
        const tab = currentTab();
        // Unpin if pinned (except essentials) so it can move to the regular tab area
        if (tab.pinned && !tab.hasAttribute('zen-essential')) gBrowser.unpinTab(tab);
        const tabs = getVisibleTabs();
        if (tabs.length > 0 && tabs[tabs.length - 1] !== tab) {
          gBrowser.moveTabAfter(tab, tabs[tabs.length - 1]);
          log('Moved tab to bottom');
        }
      }},

      // --- Tab Sorting ---
      { key: 'sort-tabs', label: 'Sort Tabs...', icon: '↕', tags: ['tab', 'sort', 'order', 'organize', 'domain', 'title', 'recency', 'alphabetical', 'group'], subFlow: 'sort-picker' },
      { key: 'group-by-domain', label: 'Group Tabs by Domain', icon: '📁', tags: ['tab', 'group', 'domain', 'folder', 'host', 'url', 'site', 'organize', 'auto'],
        condition: () => !!window.gZenFolders,
        command: () => { groupLooseTabsByDomain(); exitSearchMode(); } },

      'navigation',
      // --- Navigation ---
      { key: 'go-first-tab', label: 'Go to First Tab', icon: '⇤', tags: ['navigate', 'first', 'top', 'gg', 'nav', 'go'], command: () => {
        const tabs = getVisibleTabs();
        if (tabs.length === 0) return;
        if (S['display.ggSkipPinned']) {
          const firstUnpinned = tabs.findIndex(t => !t.pinned && !t.hasAttribute('zen-essential'));
          gBrowser.selectedTab = tabs[firstUnpinned >= 0 ? firstUnpinned : 0];
        } else {
          gBrowser.selectedTab = tabs[0];
        }
      }},
      { key: 'go-last-tab', label: 'Go to Last Tab', icon: '⇥', tags: ['navigate', 'last', 'bottom', 'end', 'nav', 'go'], command: () => {
        const tabs = getVisibleTabs();
        if (tabs.length > 0) gBrowser.selectedTab = tabs[tabs.length - 1];
      }},
      { key: 'browse-mode-down', label: 'Enter Browse Mode (Down)', icon: '↓', tags: ['browse', 'navigate', 'down'], command: () => {
        exitSearchMode();
        setTimeout(() => { enterLeapMode(); enterBrowseMode('down'); }, 100);
      }},
      { key: 'browse-mode-up', label: 'Enter Browse Mode (Up)', icon: '↑', tags: ['browse', 'navigate', 'up'], command: () => {
        exitSearchMode();
        setTimeout(() => { enterLeapMode(); enterBrowseMode('up'); }, 100);
      }},
      { key: 'open-tab-search', label: 'Open Tab Search', icon: '🔍', tags: ['search', 'find', 'tab'], command: () => {
        exitCommandMode();
      }},

      'view',
      // --- View & Browser ---
      { key: 'toggle-fullscreen', label: 'Toggle Fullscreen', icon: '⛶', tags: ['view', 'fullscreen', 'screen'], command: () => { window.fullScreen = !window.fullScreen; } },
      // Zen's own toggle (same as its keyboard shortcut)
      { key: 'toggle-sidebar', label: 'Toggle Sidebar Expanded/Compact', icon: '◫', tags: ['sidebar', 'compact', 'expand', 'toggle', 'tog', 'sb'], command: () => {
        document.getElementById('cmd_zenToggleSidebar').doCommand();
      }},
      // Firefox's page zoom (Ctrl+= / Ctrl+- / Ctrl+0): remembered per site, reader view and PDFs included
      { key: 'zoom-in', label: 'Zoom In', icon: '🔍+', tags: ['zoom', 'in', 'bigger'], command: () => FullZoom.enlarge() },
      { key: 'zoom-out', label: 'Zoom Out', icon: '🔍-', tags: ['zoom', 'out', 'smaller'], command: () => FullZoom.reduce() },
      { key: 'zoom-reset', label: 'Reset Zoom', icon: '🔍=', tags: ['zoom', 'reset', 'default'], command: () => FullZoom.reset() },

      'split',
      // --- Split View ---
      { key: 'unsplit-view', label: 'Unsplit View', icon: '▣', tags: ['split', 'unsplit', 'close', 'cl'], command: () => {
        if (window.gZenViewSplitter?.splitViewActive) window.gZenViewSplitter.unsplitCurrentView();
      }, condition: () => window.gZenViewSplitter?.splitViewActive },
      { key: 'split-with-tab', label: 'Split View with Tab...', icon: '◫', tags: ['split', 'view', 'side'], subFlow: 'split-tab-picker' },
      { key: 'split-rotate-tabs', label: 'Split View: Rotate Tabs', icon: '🔄', tags: ['split', 'view', 'swap', 'rotate', 'tabs', 'panes'], command: () => {
        const splitter = window.gZenViewSplitter;
        const viewData = activeSplitView();
        if (!viewData || (viewData.tabs?.length ?? 0) < 2) return;
        const nodes = viewData.tabs.map(t => splitter.getSplitNodeFromTab(t));
        if (!nodes.every(n => n)) return;
        // 2 tabs: swap; 3+: rotate (last goes to first position, everything shifts right)
        for (let i = nodes.length - 1; i > 0; i--) splitter.swapNodes(nodes[i], nodes[i - 1]);
        splitter.applyGridLayout(viewData.layoutTree);
      }, condition: () => (activeSplitView()?.tabs?.length ?? 0) >= 2 },
      { key: 'split-rotate-layout', label: 'Split View: Rotate Layout', icon: '\u27F3', tags: ['split', 'view', 'rotate', 'layout', 'orientation', 'horizontal', 'vertical'], command: () => {
        rotateSplitLayout();
      }, condition: () => !!activeSplitView()?.layoutTree },
      { key: 'split-reset-sizes', label: 'Split View: Reset Layout Sizes', icon: '\u2B1C', tags: ['split', 'view', 'reset', 'sizes', 'equal', 'normalize', 'balance'], command: () => {
        resetLayoutSizes();
      }, condition: () => !!activeSplitView()?.layoutTree },
      { key: 'remove-tab-from-split', label: 'Remove Tab from Split View', icon: '\u229F', tags: ['split', 'unsplit', 'remove', 'tab', 'maximize', 'extract', 'detach', 'pop'], command: () => {
        const container = currentTab().linkedBrowser?.closest('.browserSidebarContainer');
        // Zen >= 1.19b: removeTabFromSplit(event, container); a non-Shift event keeps the tab selected
        if (container) window.gZenViewSplitter.removeTabFromSplit({ shiftKey: false }, container);
      }, condition: () => !!activeSplitView()?.tabs?.includes(currentTab()) },
      { key: 'split-resize-gtile', label: 'Split View: Resize (gTile)', icon: '\u25A6', tags: ['split', 'view', 'resize', 'gtile', 'grid', 'tile', 'move', 'layout'], command: () => {
        enterGtileMode();
      }, condition: () => (activeSplitView()?.tabs?.length ?? 0) >= 2 },

      'workspaces',
      // --- Workspace Management ---
      { key: 'create-workspace', label: 'Create New Workspace', icon: '➕', tags: ['workspace', 'new', 'create', 'mk', 'ws'],
        condition: () => workspacesEnabled(),
        subFlow: 'create-workspace-input' },
      // Zen does not allow deleting the last workspace; deleting closes all of the workspace's tabs
      { key: 'delete-workspace', label: 'Delete Workspace...', icon: '🗑', tags: ['workspace', 'delete', 'remove', 'destroy', 'del', 'rm', 'ws'],
        condition: () => workspaceCount() > 1,
        subFlow: 'delete-workspace-picker' },
      { key: 'switch-workspace', label: 'Switch to Workspace...', icon: '🗂', tags: ['workspace', 'switch', 'change', 'sw', 'ws', 'go'],
        condition: () => workspaceCount() > 0,
        subFlow: 'switch-workspace-picker' },
      { key: 'move-to-workspace', label: 'Move Tab to Workspace...', icon: '🗂', tags: ['workspace', 'move', 'tab', 'mv', 'ws'],
        condition: () => workspaceCount() > 1,
        subFlow: 'move-to-workspace-picker' },
      { key: 'rename-workspace', label: 'Rename Workspace...', icon: '✏', tags: ['workspace', 'rename', 'edit', 'name', 'ren', 'ws'],
        condition: () => workspaceCount() > 0,
        subFlow: 'rename-workspace-picker' },
      { key: 'reorganize-workspaces', label: 'Reorganize Workspaces', icon: '↕', tags: ['workspace', 'reorder', 'reorganize', 'sort', 'move', 'arrange', 'order', 'ws'],
        condition: () => workspaceCount() > 1,
        command: () => { exitSearchMode(); setTimeout(() => enterReorgMode(), 50); } },

      'folders',
      // --- Folder Management ---
      { key: 'create-folder', label: 'Create Folder with Current Tab', icon: '📁', tags: ['folder', 'create', 'new', 'group', 'tab', 'add', 'mk', 'fld', 'fol'],
        condition: () => !!window.gZenFolders && !currentTab().hasAttribute('zen-essential'),
        command: () => { gZenFolders.createFolder([currentTab()], { renameFolder: true }); } },
      { key: 'delete-folder', label: 'Delete Folder...', icon: '🗑', tags: ['folder', 'delete', 'remove', 'destroy', 'group', 'del', 'rm', 'fld', 'fol'],
        condition: () => getWorkspaceFolders().length > 0,
        subFlow: 'delete-folder-picker' },
      { key: 'add-to-folder', label: 'Add Tab to Folder...', icon: '📂', tags: ['folder', 'add', 'move', 'tab', 'group', 'mv', 'fld', 'fol'],
        condition: () => !currentTab().hasAttribute('zen-essential') && getWorkspaceFolders().some(f => f !== currentTab().group),
        subFlow: 'add-to-folder-picker' },
      { key: 'rename-folder', label: 'Rename Folder...', icon: '✏', tags: ['folder', 'rename', 'edit', 'name', 'group', 'ren', 'fld', 'fol'],
        condition: () => getWorkspaceFolders().length > 0,
        subFlow: 'rename-folder-picker' },
      { key: 'change-folder-icon', label: 'Change Folder Icon...', icon: '🎨', tags: ['folder', 'icon', 'emoji', 'edit', 'fld', 'fol'],
        condition: () => !!window.gZenFolders && getWorkspaceFolders().length > 0,
        subFlow: 'change-folder-icon-picker' },
      { key: 'unload-folder-tabs', label: 'Unload All Tabs in Folder...', icon: '💤', tags: ['folder', 'unload', 'discard', 'memory', 'suspend', 'fld', 'fol'],
        condition: () => getWorkspaceFolders().length > 0,
        subFlow: 'unload-folder-picker' },
      { key: 'create-subfolder', label: 'Create Subfolder...', icon: '📁', tags: ['folder', 'subfolder', 'create', 'new', 'nested', 'mk', 'fld', 'fol'],
        condition: () => !!window.gZenFolders && getWorkspaceFolders().length > 0,
        subFlow: 'create-subfolder-picker' },
      { key: 'convert-folder-to-workspace', label: 'Convert Folder to Workspace...', icon: '🗂', tags: ['folder', 'workspace', 'convert', 'space', 'fld', 'fol'],
        condition: () => !!window.gZenFolders && workspacesEnabled() && getWorkspaceFolders().length > 0,
        subFlow: 'folder-to-workspace-picker' },
      { key: 'unpack-folder', label: 'Unpack Folder (Keep Tabs)...', icon: '📦', tags: ['folder', 'unpack', 'dissolve', 'remove', 'keep', 'tabs', 'fld', 'fol'],
        condition: () => !!window.gZenFolders && getWorkspaceFolders().length > 0,
        subFlow: 'unpack-folder-picker' },
      { key: 'move-folder-to-workspace', label: 'Move Folder to Workspace...', icon: '🗂', tags: ['folder', 'move', 'workspace', 'space', 'mv', 'fld', 'fol'],
        condition: () => !!window.gZenFolders && workspaceCount() > 1 && getWorkspaceFolders().length > 0,
        subFlow: 'move-folder-to-ws-folder-picker' },

      'zenleap',
      // --- ZenLeap Meta ---
      { key: 'toggle-browse-preview', label: 'Toggle Browse Preview', icon: '🖼', tags: ['preview', 'browse', 'thumbnail', 'zenleap'], command: () => {
        S['display.browsePreview'] = !S['display.browsePreview'];
        saveSettings();
        if (!S['display.browsePreview']) hidePreviewPanel(true);
        log(`Browse preview ${S['display.browsePreview'] ? 'enabled' : 'disabled'}`);
      }},
      { key: 'toggle-debug', label: 'Toggle Debug Logging', icon: '🐛', tags: ['debug', 'log', 'zenleap'], command: () => {
        S['advanced.debug'] = !S['advanced.debug'];
        saveSettings();
        console.log(`[ZenLeap] Debug logging ${S['advanced.debug'] ? 'enabled' : 'disabled'}`);
      }},
      { key: 'open-help', label: 'Open Help Modal', icon: '❓', tags: ['help', 'zenleap', 'keybindings'], command: () => {
        exitSearchMode();
        setTimeout(() => enterHelpMode(), 100);
      }},
      { key: 'open-settings', label: 'Open Settings', icon: '⚙', tags: ['settings', 'config', 'preferences', 'customize', 'keybindings', 'cfg', 'prefs'], command: () => {
        exitSearchMode();
        setTimeout(() => enterSettingsMode(), 100);
      }},
      { key: 'check-update', label: 'Check for Updates', icon: '⬆', tags: ['update', 'check', 'version', 'upgrade', 'install', 'download', 'zenleap'], command: () => {
        exitSearchMode();
        setTimeout(() => enterUpdateMode(), 100);
      }},
      { key: 'switch-theme', label: 'Switch Theme...', icon: '🎨', tags: ['theme', 'color', 'scheme', 'appearance', 'switch', 'meridian', 'dracula', 'nord', 'gruvbox', 'catppuccin', 'tokyo'], subFlow: 'theme-picker' },
      { key: 'reload-themes', label: 'Reload Themes', icon: '🎨', tags: ['theme', 'reload', 'refresh', 'custom', 'user'], command: async () => {
        const { count, error } = await loadUserThemes();
        applyTheme();
        showZenLeapToast(error
          ? 'zenleap-themes.json has an error \u2014 see the Browser Console (built-in themes still work)'
          : `Themes reloaded: ${count} custom theme${count !== 1 ? 's' : ''}`);
      }},
      { key: 'open-themes-file', label: 'Open Themes File', icon: '📝', tags: ['theme', 'edit', 'custom', 'file', 'json'], command: async () => {
        await ensureThemesFile();
        const themesPath = PathUtils.join(PathUtils.profileDir, 'chrome', 'zenleap-themes.json');
        const file = Cc['@mozilla.org/file/local;1'].createInstance(Ci.nsIFile);
        file.initWithPath(themesPath);
        try {
          file.launch(); // the desktop's default editor for .json files
        } catch (e) {
          // No handler registered: show the file in a tab instead
          gBrowser.selectedTab = gBrowser.addTab(PathUtils.toFileURI(themesPath), {
            triggeringPrincipal: Services.scriptSecurityManager.getSystemPrincipal(),
            skipRoute: true,
          });
        }
      }},

      'plugins',
      // --- Plugin Management ---
      { key: 'plugin-manager', label: 'Manage Plugins', icon: '🧩', tags: ['plugin', 'plugins', 'manage', 'extensions', 'addons', 'install', 'uninstall', 'enable', 'disable'], command: () => {
        exitSearchMode();
        setTimeout(() => enterPluginManagerMode(), 100);
      }},

      'sessions',
      // --- Session Management --- (not in private windows: nothing from them may be written to disk)
      { key: 'save-session', label: 'Save Workspace Session', icon: '💾', tags: ['session', 'save', 'snapshot', 'backup', 'checkpoint', 'workspace', 'resurrect'],
        condition: () => !isPrivateWindow(), subFlow: 'save-session-scope' },
      { key: 'restore-session', label: 'Restore Workspace Session...', icon: '📥', tags: ['session', 'restore', 'load', 'resume', 'workspace', 'resurrect'],
        condition: () => workspacesEnabled(), subFlow: 'restore-session-picker' },
      { key: 'list-sessions', label: 'List Saved Sessions', icon: '📋', tags: ['session', 'list', 'saved', 'history', 'snapshots', 'view'],
        condition: () => !isPrivateWindow(), subFlow: 'list-sessions-picker' },
    ]);
  }

  // Generate dynamic commands based on current state
  function getDynamicCommands() {
    if (!browseCommandMode || browseCommandTabs.length === 0) return [];

    const count = browseCommandTabs.length;
    const tabLabel = count === 1 ? 'Highlighted Tab' : `${count} Selected Tabs`;
    const browseTags = ['browse', 'selected', 'selection', 'highlighted'];

    return [
      { key: 'browse:close', label: `Close ${tabLabel}`, icon: '✕', tags: [...browseTags, 'close', 'remove', 'delete'],
        command: () => { closeMatchedTabs(browseCommandTabs); } },
      { key: 'browse:move-workspace', label: `Move ${tabLabel} to Workspace...`, icon: '🗂', tags: [...browseTags, 'move', 'workspace'],
        condition: () => workspaceCount() > 1,
        subFlow: 'browse-workspace-picker' },
      { key: 'browse:add-folder', label: `Add ${tabLabel} to Folder...`, icon: '📂', tags: [...browseTags, 'folder', 'add', 'group'],
        condition: () => getWorkspaceFolders().length > 0,
        subFlow: 'browse-folder-picker' },
      { key: 'browse:create-folder', label: `Create Folder with ${tabLabel}`, icon: '📁', tags: [...browseTags, 'folder', 'create', 'new', 'group'],
        condition: () => !!window.gZenFolders,
        subFlow: 'browse-folder-name-input' },
      { key: 'browse:move-top', label: `Move ${tabLabel} to Top`, icon: '⤒', tags: [...browseTags, 'move', 'top', 'first'],
        command: () => { moveMatchedTabsToPosition(browseCommandTabs, 'top'); } },
      { key: 'browse:move-bottom', label: `Move ${tabLabel} to Bottom`, icon: '⤓', tags: [...browseTags, 'move', 'bottom', 'last'],
        command: () => { moveMatchedTabsToPosition(browseCommandTabs, 'bottom'); } },
      { key: 'browse:pin-unpin', label: `Pin/Unpin ${tabLabel}`, icon: '📌', tags: [...browseTags, 'pin', 'unpin'],
        command: () => { pinUnpinMatchedTabs(browseCommandTabs); } },
      { key: 'browse:mute-unmute', label: `Mute/Unmute ${tabLabel}`, icon: '🔇', tags: [...browseTags, 'mute', 'unmute', 'audio', 'sound'],
        command: () => { muteUnmuteMatchedTabs(browseCommandTabs); } },
      { key: 'browse:duplicate', label: `Duplicate ${tabLabel}`, icon: '⊕', tags: [...browseTags, 'duplicate', 'copy', 'clone'],
        command: () => { duplicateMatchedTabs(browseCommandTabs); } },
      { key: 'browse:unload', label: `Unload ${tabLabel} (Save Memory)`, icon: '💤', tags: [...browseTags, 'unload', 'discard', 'memory', 'suspend'],
        command: () => { unloadMatchedTabs(browseCommandTabs); } },
      { key: 'browse:split-view', label: `Split ${tabLabel} into Split View`, icon: '◫', tags: [...browseTags, 'split', 'view', 'side', 'pane'],
        condition: () => !!window.gZenViewSplitter && browseCommandTabs.length >= 2 && browseCommandTabs.length <= 4,
        command: () => { splitBrowseTabs(browseCommandTabs); } },
      { key: 'browse:reload', label: `Reload ${tabLabel}`, icon: '🔄', tags: [...browseTags, 'reload', 'refresh'],
        command: () => { reloadMatchedTabs(browseCommandTabs); } },
      { key: 'browse:bookmark', label: `Bookmark ${tabLabel}`, icon: '🔖', tags: [...browseTags, 'bookmark', 'save', 'star'],
        command: () => { bookmarkMatchedTabs(browseCommandTabs); } },
    ];
  }

  // Get all available commands (static + dynamic + plugins), filtered by their
  // conditions. Conditions (DOM queries, workspace lookups) are evaluated once per
  // palette session, not per keystroke: the list is cached until invalidated (opening
  // or leaving search/command mode, plugin changes).
  let _commandListCache = null;

  function getAllCommands() {
    if (_commandListCache) return _commandListCache;
    const all = [...getStaticCommands(), ...getDynamicCommands(), ...getPluginCommands()];
    _commandListCache = all.filter(cmd => {
      if (!cmd.condition) return true;
      try { return !!cmd.condition(); } catch (e) { return false; }
    });
    _commandGroupMap.clear();
    for (const cmd of _commandListCache) {
      if (cmd.group) _commandGroupMap.set(cmd.key, cmd.group);
    }
    return _commandListCache;
  }

  function invalidateCommandCache() {
    _commandListCache = null;
  }

  // Filter commands by query using fuzzy match
  function calculateCommandRecencyMultiplier(cmdKey) {
    const lastUsed = commandRecency.get(cmdKey);
    if (!lastUsed) return 1.0; // No recency data, neutral
    const ageMs = Math.max(0, Date.now() - lastUsed);
    const ageMinutes = ageMs / (1000 * 60);
    return S['advanced.cmdRecencyFloor'] + S['advanced.cmdRecencyRange'] * Math.exp(-ageMinutes / S['advanced.cmdRecencyHalflife']);
  }

  function filterCommands(query) {
    const all = getAllCommands();

    if (!query || query.trim() === '') {
      // No query: sort by command group order, then alphabetical within groups
      // Build group index for O(1) lookup
      const groupOrder = new Map();
      COMMAND_GROUPS.forEach((g, i) => groupOrder.set(g.id, i));
      const sorted = [...all];
      sorted.sort((a, b) => {
        const aIdx = groupOrder.get(a.group) ?? 999;
        const bIdx = groupOrder.get(b.group) ?? 999;
        if (aIdx !== bIdx) return aIdx - bIdx;
        return a.label.localeCompare(b.label);
      });
      return sorted;
    }

    // Multi-word fuzzy match: split query into words, ALL must match in label+tags
    const words = query.trim().split(/\s+/).filter(w => w.length > 0);
    const results = [];

    for (const cmd of all) {
      const searchTarget = `${cmd.label} ${(cmd.tags || []).join(' ')}`;
      let totalScore = 0;
      let allIndices = [];
      let allMatched = true;

      for (const word of words) {
        const match = fuzzyMatchSingle(word.toLowerCase(), searchTarget.toLowerCase());
        if (!match) {
          allMatched = false;
          break;
        }
        totalScore += match.score;
        // Only collect indices that fall within the label (for highlighting)
        const labelLen = cmd.label.length;
        allIndices.push(...match.indices.filter(i => i < labelLen));
      }

      if (!allMatched) continue;

      // Bonus for more words matched
      totalScore += words.length * 5;

      // Apply recency multiplier
      const recencyMult = calculateCommandRecencyMultiplier(cmd.key);
      totalScore *= recencyMult;

      // A label containing the whole query as typed outranks fuzzy matches, whatever
      // their recency (typing a command's exact name must find that command first)
      const phrase = words.join(' ').toLowerCase();
      const labelLower = cmd.label.toLowerCase();
      if (labelLower.startsWith(phrase)) totalScore += 2000;
      else if (labelLower.includes(phrase)) totalScore += 1000;

      results.push({
        ...cmd,
        score: totalScore,
        labelIndices: [...new Set(allIndices)].sort((a, b) => a - b),
      });
    }

    results.sort((a, b) => b.score - a.score);
    return results;
  }

  // Failures users care about: always to the console, plus a short toast.
  function notifyCommandFailure(cmd, error) {
    reportError(`Command "${cmd.label}" (${cmd.key}) failed`, error);
    showZenLeapToast(`${cmd.label} failed \u2014 see the Browser Console`);
    _pluginEventBus.emit('command:failed', { key: cmd.key, error: error?.message || String(error) });
  }

  // Run one of Zen's tab context-menu commands on the current tab once the palette has
  // closed (Zen's inline editor and icon picker need the palette gone first).
  function runTabContextCommand(menuItemId, cmd) {
    const tab = currentTab();
    exitSearchMode();
    setTimeout(() => {
      try {
        TabContextMenu.contextTab = tab;
        document.getElementById(menuItemId).doCommand();
      } catch (e) { notifyCommandFailure(cmd, e); }
    }, 100);
  }

  // Execute a command or enter its sub-flow
  function executeCommand(cmd) {
    // Track recency for all commands (including sub-flow commands)
    commandRecency.set(cmd.key, Date.now());

    if (cmd.subFlow) {
      enterSubFlow(cmd.subFlow, cmd.label);
      return;
    }
    // Destructive commands describe what they will do; ask first when they return a description
    if (typeof cmd.confirm === 'function') {
      let confirmation = null;
      try { confirmation = cmd.confirm(); } catch (e) { notifyCommandFailure(cmd, e); return; }
      if (confirmation) {
        enterSubFlow('command-confirm', cmd.label);
        commandSubFlow.data = { cmd, ...confirmation };
        renderCommandResults();
        return;
      }
    }
    runCommand(cmd);
  }

  function runCommand(cmd) {
    if (typeof cmd.command !== 'function') return;
    // Save browse command tabs before exitSearchMode clears them,
    // so browse command closures can still reference browseCommandTabs
    const savedBrowseTabs = browseCommandTabs.length > 0 ? [...browseCommandTabs] : null;
    exitSearchMode();
    if (savedBrowseTabs) browseCommandTabs = savedBrowseTabs;
    try {
      const result = cmd.command();
      if (result && typeof result.then === 'function') {
        result.then(() => {
          _pluginEventBus.emit('command:executed', { key: cmd.key, label: cmd.label });
          log(`Executed async command: ${cmd.key}`);
        }).catch(e => notifyCommandFailure(cmd, e));
      } else {
        _pluginEventBus.emit('command:executed', { key: cmd.key, label: cmd.label });
        log(`Executed command: ${cmd.key}`);
      }
    } catch (e) {
      notifyCommandFailure(cmd, e);
    }
    browseCommandTabs = [];
  }

  // Confirmation results for 'command-confirm': Cancel is first, so a stray Enter is harmless.
  function getCommandConfirmResults() {
    const data = commandSubFlow?.data;
    if (!data) return [];
    return [
      { key: 'command-confirm:cancel', label: 'Cancel', icon: '↩', sublabel: data.cancelLabel || 'Do nothing', tags: [] },
      { key: 'command-confirm:run', label: data.label, icon: data.icon || '\u26A0', sublabel: data.sublabel || '', tags: [] },
    ];
  }

  // ── Bulk tab closing (Close Other / Left / Right) ──
  // ZenRipple's agent tabs and pages are left open: in the agents' space the user means
  // "close the tabs I opened here", not "end every agent's work".
  function getOtherUnpinnedTabs() {
    const current = currentTab();
    return getVisibleTabs().filter(t => t !== current && !t.pinned);
  }

  function getUnpinnedTabsBeside(side) {
    const tabs = getVisibleTabs();
    const idx = tabs.indexOf(currentTab());
    if (idx < 0) return [];
    return (side === 'right' ? tabs.slice(idx + 1) : tabs.slice(0, idx)).filter(t => !t.pinned);
  }

  // Ask before closing more than one tab (returns null = no confirmation needed)
  function bulkCloseConfirmation(tabs, describe) {
    const kept = tabs.filter(isExternallyManagedTab).length;
    const count = tabs.length - kept;
    if (count <= 1) return null;
    return {
      label: describe(count),
      icon: '✕',
      sublabel: `Closed tabs can be reopened with Reopen Closed Tab${kept ? ` \u00B7 ${zenRippleTabsKeptNote(kept)}` : ''}`,
      cancelLabel: 'Keep all tabs open',
    };
  }

  // Close as one batch, without ZenRipple's tabs; says so when no confirmation did.
  function closeTabsInBulk(tabs) {
    const userTabs = tabs.filter(t => !isExternallyManagedTab(t));
    const kept = tabs.length - userTabs.length;
    const closed = TabOps.close(userTabs);
    if (kept && closed <= 1) {
      showZenLeapToast(`${closed ? 'Closed 1 tab' : 'Nothing to close'} \u2014 ${zenRippleTabsKeptNote(kept)}`);
    }
    return closed;
  }

  // ============================================
  // COMMAND SUB-FLOW SYSTEM
  // ============================================

  // Every sub-flow is one entry in SUBFLOWS (defined at the end of this section):
  //   placeholder       input placeholder text
  //   results(q, data)  result rows for the current query
  //   select(r, data)   Enter on a row
  //   readOnly          fixed list (preview/confirmation): the input can't be typed into
  //   onEnter/onExit    optional hooks
  // enterSubFlow/getSubFlowResults/handleSubFlowSelect dispatch through the table, so a
  // new flow is defined in one place.

  function enterSubFlow(type, label, data = null) {
    commandSubFlowStack.push({ type: commandSubFlow?.type || 'commands', label: commandSubFlow?.label || 'Commands', query: commandQuery, data: commandSubFlow?.data || null });
    commandSubFlow = { type, label, data };
    commandQuery = '';
    SUBFLOWS[type]?.onEnter?.();
    searchSelectedIndex = 0;
    searchCursorPos = 0;

    // Always enter insert mode when entering a sub-flow
    searchVimMode = 'insert';

    if (searchInput) {
      searchInput.value = '';
      searchInput.placeholder = getSubFlowPlaceholder(type);
      searchInput.readOnly = !!SUBFLOWS[type]?.readOnly;
    }
    renderCommandResults();
    updateBreadcrumb();
    updateSearchVimIndicator();
    updateWsToggleVisibility();
  }

  function exitSubFlow() {
    searchSelectedIndex = 0;
    SUBFLOWS[commandSubFlow?.type]?.onExit?.();
    if (searchInput) searchInput.readOnly = false;

    if (commandSubFlowStack.length === 0) {
      if (browseCommandMode) {
        // Return to browse mode instead of command list root
        returnToBrowseMode();
        return;
      }
      // Back to command list root
      commandSubFlow = null;
      commandQuery = '';
      commandMatchedTabs = [];
      if (searchInput) {
        searchInput.value = '';
        searchInput.placeholder = 'Type a command...';
      }
      renderCommandResults();
      updateBreadcrumb();
      updateSearchHintBar();
      return;
    }
    const prev = commandSubFlowStack.pop();
    if (prev.type === 'commands') {
      commandSubFlow = null;
      commandQuery = prev.query || '';
    } else {
      // Restore the previous step's data (e.g. the session being restored)
      commandSubFlow = { type: prev.type, label: prev.label, data: prev.data || null };
      commandQuery = prev.query || '';
    }
    // Only clear matched tabs when going back to tab-search or to root
    // Preserve them when going back to action-picker (needs the count)
    if (!commandSubFlow || commandSubFlow.type === 'tab-search') {
      commandMatchedTabs = [];
    }
    // The restored query keeps the caret at its end, as when it was typed
    searchCursorPos = commandQuery.length;
    if (searchInput) {
      searchInput.value = commandQuery;
      searchInput.placeholder = commandSubFlow ? getSubFlowPlaceholder(commandSubFlow.type) : 'Type a command...';
      searchInput.readOnly = !!SUBFLOWS[commandSubFlow?.type]?.readOnly;
      searchInput.setSelectionRange(commandQuery.length, commandQuery.length);
    }
    renderCommandResults();
    updateBreadcrumb();
    updateSearchHintBar();
    updateWsToggleVisibility();
  }

  function getSubFlowPlaceholder(type) {
    return SUBFLOWS[type]?.placeholder ?? 'Type a command...';
  }

  function updateBreadcrumb() {
    if (!searchBreadcrumb) return;
    if (!commandMode) {
      searchBreadcrumb.style.display = 'none';
      return;
    }
    const parts = [];
    for (const item of commandSubFlowStack) {
      if (item.label && item.type !== 'commands') parts.push(item.label);
    }
    if (commandSubFlow) parts.push(commandSubFlow.label);

    if (parts.length === 0) {
      searchBreadcrumb.style.display = 'none';
    } else {
      searchBreadcrumb.style.display = 'flex';
      searchBreadcrumb.innerHTML = parts.map(p => `<span class="zenleap-breadcrumb-item">${escapeHtml(p)}</span>`).join('<span class="zenleap-breadcrumb-sep">›</span>');
    }
  }

  // Get sub-flow results based on type
  function getSubFlowResults() {
    const flow = SUBFLOWS[commandSubFlow?.type];
    return flow ? flow.results(commandQuery, commandSubFlow.data) : [];
  }

  // Handle sub-flow selection (Enter on a result)
  function handleSubFlowSelect(result) {
    const flow = SUBFLOWS[commandSubFlow?.type];
    if (flow?.select) flow.select(result, commandSubFlow.data);
  }

  // ── Picker builders ──

  // Workspaces as picker rows. Options: markCurrent (label "(current)"), excludeActive,
  // currentLast (never pre-select the current workspace), createKey (adds a
  // "+ Create New Workspace" row with that key), emptyLabel (row shown when empty),
  // moving (tabs go there: ZenRipple's agent space is listed last, with a note).
  function workspacePickerResults(query, { keyPrefix, verb, icon = '🗂', markCurrent = false, excludeActive = false, currentLast = false, createKey = null, emptyLabel = null, moving = false } = {}) {
    const activeId = window.gZenWorkspaces?.activeWorkspace;
    const rows = [];
    try {
      for (const ws of (gZenWorkspaces.getWorkspaces() || [])) {
        const isActive = ws.uuid === activeId;
        if (excludeActive && isActive) continue;
        const name = ws.name || 'Unnamed';
        const agentSpace = isAgentSpace(ws.uuid);
        rows.push({
          key: `${keyPrefix}:${ws.uuid}`,
          label: `${name}${markCurrent && isActive ? ' (current)' : ''}`,
          icon: safeIconText(ws.icon, icon),
          ...(agentSpace ? { sublabel: 'ZenRipple agent space: agents can see and use the tabs here' } : {}),
          tags: ['workspace', ...(verb ? [verb] : []), name.toLowerCase()],
          workspaceId: ws.uuid,
          workspaceName: name,
          isActive,
          agentSpace,
        });
      }
    } catch (e) { reportError('Listing workspaces failed', e); }
    if (rows.length === 0 && emptyLabel) {
      return [{ key: `${keyPrefix}:none`, label: emptyLabel, icon: '🗂', tags: [] }];
    }
    if (currentLast) rows.sort((a, b) => (a.isActive ? 1 : 0) - (b.isActive ? 1 : 0));
    if (moving) rows.sort((a, b) => (a.agentSpace ? 1 : 0) - (b.agentSpace ? 1 : 0));
    const filtered = fuzzyFilterAndSort(rows, query);
    if (createKey) filtered.push({ key: createKey, label: '+ Create New Workspace', icon: '➕', tags: ['workspace', 'new', 'create'] });
    return filtered;
  }

  // Folders of the active workspace (no live folders) as picker rows. Options: canNest
  // (only folders that may get a subfolder), skip (a folder to leave out), counts (tab
  // count sublabel), createKey (adds a "Create New Folder" row with that key).
  function folderPickerResults(query, { keyPrefix, verb, icon, canNest = false, skip = null, counts = true, createKey = null } = {}) {
    const maxDepth = Services.prefs.getIntPref('zen.folders.max-subfolders', 5);
    const rows = [];
    for (const folder of getWorkspaceFolders()) {
      if (folder === skip) continue;
      // Zen refuses subfolders beyond its nesting limit (same rule as its context menu)
      if (canNest && (folder.level ?? 0) >= maxDepth - 1) continue;
      const name = folderName(folder);
      const row = { key: `${keyPrefix}:${folder.id}`, label: name, icon, tags: ['folder', ...(verb ? [verb] : []), name.toLowerCase()], folder };
      if (counts) {
        const tabCount = folderTabCount(folder);
        row.sublabel = `${tabCount} tab${tabCount !== 1 ? 's' : ''}`;
      }
      rows.push(row);
    }
    if (createKey) {
      rows.push({ key: createKey, label: 'Create New Folder', icon: '📁+', tags: ['folder', 'new', 'create'] });
    } else if (rows.length === 0) {
      return [{ key: `${keyPrefix}:none`, label: 'No folders found', icon: '📂', tags: [] }];
    }
    return fuzzyFilterAndSort(rows, query);
  }

  // A free-text step: a prompt row until something is typed, then a confirm row.
  function textInputResults(query, { keyPrefix, icon, prompt, confirm, confirmIcon = icon }) {
    const text = (query || '').trim();
    if (!text) return [{ key: `${keyPrefix}:prompt`, label: prompt, icon, tags: [] }];
    return [{ key: `${keyPrefix}:confirm`, label: confirm(text), icon: confirmIcon, tags: [] }];
  }

  const FOLDER_NAME_INPUT = {
    keyPrefix: 'folder-name', icon: '📁', confirmIcon: '📁+',
    prompt: 'Type a name for the new folder and press Enter',
    confirm: name => `Create folder: "${name}"`,
  };

  // ── Individual result lists ──

  // Theme picker sub-flow: lists all themes (built-in + user) with grouping
  function getThemePickerResults(query) {
    const currentTheme = S['appearance.theme'];
    const results = [];

    for (const [id, t] of Object.entries(themes)) {
      const isCurrent = id === currentTheme;
      const isBuiltIn = !!BUILTIN_THEMES[id];
      results.push({
        key: `theme:${id}`,
        label: `${t.name || id}${isCurrent ? ' (current)' : ''}`,
        sublabel: isBuiltIn ? 'Built-in' : 'Custom',
        icon: isCurrent ? '◉' : (isBuiltIn ? '◎' : '✎'),
        tags: ['theme', (t.name || id).toLowerCase(), isBuiltIn ? 'built-in' : 'custom'],
        themeId: id,
      });
    }

    return fuzzyFilterAndSort(results, query);
  }

  // Leaving the theme picker (Escape, back, closing the palette) while a theme is
  // previewed: show the saved theme again (the one just picked, if any).
  function endThemePreview() {
    if (!_themePreviewing) return;
    _themePreviewing = false;
    applyTheme();
  }

  // Browser theme confirmation sub-flow
  function getThemeBrowserConfirmResults(query) {
    const options = [
      { key: 'theme-browser:yes', label: 'Yes, apply to browser too', icon: '✓', tags: ['yes', 'apply', 'browser'] },
      { key: 'theme-browser:no', label: 'No, only ZenLeap', icon: '✕', tags: ['no', 'zenleap', 'only'] },
    ];
    return fuzzyFilterAndSort(options, query);
  }

  // What deleting a workspace closes (same selection as Zen's removeWorkspace()).
  function getWorkspaceOwnedItems(workspaceId) {
    let stored = [];
    try { stored = Array.from(gZenWorkspaces.allStoredTabs || []); } catch (e) { stored = []; }
    const tabs = stored.filter(t =>
      t.getAttribute('zen-workspace-id') === workspaceId &&
      !t.hasAttribute('zen-essential') && !t.hasAttribute('zen-empty-tab')
    );
    const folders = Array.from(gBrowser.tabContainer.querySelectorAll('zen-folder'))
      .filter(f => f.getAttribute('zen-workspace-id') === workspaceId);
    return { tabs, folders, pinned: tabs.filter(t => t.pinned).length };
  }

  function getDeleteWorkspaceConfirmResults(data) {
    if (!data?.workspaceId) return [];
    const { tabs, folders, pinned } = getWorkspaceOwnedItems(data.workspaceId);
    const plural = (n, w) => `${n} ${w}${n !== 1 ? 's' : ''}`;
    const details = [pinned ? `${pinned} pinned` : '', folders.length ? plural(folders.length, 'folder') : ''].filter(Boolean).join(', ');
    return [
      { key: 'delete-workspace:cancel', label: 'Cancel', icon: '↩', sublabel: `Keep "${data.workspaceName}"`, tags: [] },
      {
        key: 'delete-workspace:confirm',
        label: `Delete "${data.workspaceName}" and close ${plural(tabs.length, 'tab')}${details ? ` (${details})` : ''}`,
        icon: '🗑',
        sublabel: 'Closed tabs can be reopened one at a time (up to your recently-closed limit); the workspace itself cannot be restored',
        tags: [],
      },
    ];
  }

  function getDeleteFolderConfirmResults(data) {
    const folder = data?.folder;
    if (!folder?.isConnected) return [{ key: 'delete-folder:gone', label: 'The folder no longer exists', icon: '📂', tags: [] }];
    const n = folderTabCount(folder);
    const tabsText = `${n} tab${n !== 1 ? 's' : ''}`;
    return [
      { key: 'delete-folder:cancel', label: 'Cancel', icon: '↩', sublabel: `Keep "${folderName(folder)}"`, tags: [] },
      { key: 'delete-folder:keep-tabs', label: `Delete folder only (keep ${tabsText})`, icon: '📦', sublabel: 'The tabs stay in the workspace', tags: [] },
      { key: 'delete-folder:with-tabs', label: `Delete folder and close ${tabsText}`, icon: '🗑', sublabel: `Undo with ${formatKeyDisplay(S['keys.global.undoFolderDelete'], SETTINGS_SCHEMA['keys.global.undoFolderDelete'])} within 30 seconds`, tags: [] },
    ];
  }

  function getTabSearchSubFlowResults(query) {
    // Search tabs including current tab (for batch selection)
    const results = searchTabs(query, { includeCurrent: true });
    commandMatchedTabs = results.map(r => r.tab);
    return results.map(r => ({
      key: `matched-tab:${r.tab.index}`,
      label: r.tab.label || 'Untitled',
      sublabel: r.tab.linkedBrowser?.currentURI?.spec || '',
      icon: '☑',
      isTab: true,
      tab: r.tab,
      titleIndices: r.titleIndices,
      urlIndices: r.urlIndices,
      workspaceName: r.workspaceName,
      isEssential: r.isEssential,
    }));
  }

  function getActionPickerResults(query) {
    const count = commandMatchedTabs.length;
    const actions = [
      { key: 'action:browse-select', label: `Select ${count} tabs in Browse Mode`, icon: '👁', tags: ['select', 'browse'] },
      { key: 'action:close-all', label: `Close ${count} matching tabs`, icon: '✕', tags: ['close', 'delete', 'remove'] },
      { key: 'action:move-workspace', label: `Move ${count} tabs to workspace...`, icon: '🗂', tags: ['move', 'workspace'], subFlow: 'workspace-picker' },
      { key: 'action:add-folder', label: `Add ${count} tabs to folder...`, icon: '📂', tags: ['folder', 'add', 'group'], subFlow: 'folder-picker' },
      { key: 'action:move-to-top', label: `Move ${count} tabs to top`, icon: '⤒', tags: ['move', 'top', 'first', 'beginning'] },
      { key: 'action:move-to-bottom', label: `Move ${count} tabs to bottom`, icon: '⤓', tags: ['move', 'bottom', 'last', 'end'] },
      { key: 'action:unload-all', label: `Unload ${count} matching tabs`, icon: '💤', tags: ['unload', 'discard', 'memory', 'suspend'] },
    ];
    return fuzzyFilterAndSort(actions, query);
  }

  function getSortPickerResults(query) {
    const options = [
      { key: 'sort:domain', label: 'By Domain', icon: '🌐', tags: ['domain', 'host', 'url', 'site'] },
      { key: 'sort:title-az', label: 'By Title (A → Z)', icon: '🔤', tags: ['title', 'name', 'alphabetical', 'az', 'alpha'] },
      { key: 'sort:title-za', label: 'By Title (Z → A)', icon: '🔤', tags: ['title', 'name', 'alphabetical', 'za', 'reverse'] },
      { key: 'sort:recency-newest', label: 'By Recency (Newest First)', icon: '🕐', tags: ['recent', 'new', 'newest', 'time', 'last'] },
      { key: 'sort:recency-oldest', label: 'By Recency (Oldest First)', icon: '🕰', tags: ['old', 'oldest', 'stale', 'time', 'first'] },
    ];
    return fuzzyFilterAndSort(options, query);
  }

  function getSplitTabPickerResults(query) {
    // Reuse tab search for split view picker
    const results = searchTabs(query);
    return results.map(r => ({
      key: `split-tab:${r.tab.index}`,
      label: r.tab.label || 'Untitled',
      sublabel: r.tab.linkedBrowser?.currentURI?.spec || '',
      icon: '◫',
      isTab: true,
      tab: r.tab,
      titleIndices: r.titleIndices,
      workspaceName: r.workspaceName,
      isEssential: r.isEssential,
      urlIndices: r.urlIndices,
    }));
  }

  // Tabs currently playing audio, across all workspaces (finding one is the point,
  // so this ignores the search-scope setting instead of flipping it).
  function getPlayingTabs() {
    let allTabs;
    try {
      const stored = window.gZenWorkspaces?.allStoredTabs;
      allTabs = stored?.length > 0 ? Array.from(stored) : Array.from(gBrowser.tabs);
    } catch (e) { allTabs = Array.from(gBrowser.tabs); }
    return allTabs.filter(tab =>
      isLiveTab(tab) &&
      !tab.hasAttribute('zen-empty-tab') &&
      tab.hasAttribute('soundplaying')
    );
  }

  function getPlayingTabsResults(query) {
    const playingTabs = getPlayingTabs();

    let results = playingTabs.map(tab => ({
      key: `playing-tab:${tab.index}`,
      label: tab.label || 'Untitled',
      sublabel: tab.linkedBrowser?.currentURI?.spec || '',
      icon: tab.hasAttribute('muted') ? '🔇' : '🔊',
      isTab: true,
      tab: tab,
      titleIndices: [],
      urlIndices: [],
      workspaceName: getTabWorkspaceName(tab),
      isEssential: tab.hasAttribute('zen-essential'),
    }));

    // Apply fuzzy filter if query is provided
    if (query) {
      results = results.filter(r => {
        const match = fuzzyMatch(query, r.label, r.sublabel);
        if (!match) return false;
        r.titleIndices = match.titleIndices;
        r.urlIndices = match.urlIndices;
        return true;
      });
    }

    return results;
  }

  function getDedupPreviewResults() {
    // Get tabs based on current cross-workspace setting
    let allTabs;
    if (S['display.searchAllWorkspaces'] && window.gZenWorkspaces) {
      try {
        const stored = gZenWorkspaces.allStoredTabs;
        allTabs = stored && stored.length > 0 ? Array.from(stored) : Array.from(gBrowser.tabs);
      } catch (e) {
        allTabs = Array.from(gBrowser.tabs);
      }
    } else {
      allTabs = getVisibleTabs();
    }

    // Filter to valid, non-essential, non-pinned tabs. ZenRipple's agent tabs and pages
    // are never candidates: an agent's copy of a page is its working tab, and dedup
    // would always pick it (the user never selects it, so it is the least recent).
    const validTabs = allTabs.filter(t =>
      isLiveTab(t) &&
      !t.pinned &&
      !t.hasAttribute('zen-essential') &&
      !t.hasAttribute('zen-glance-tab') &&
      !t.hasAttribute('zen-empty-tab')
    );
    const managed = validTabs.filter(isExternallyManagedTab);
    const candidates = managed.length ? validTabs.filter(t => !isExternallyManagedTab(t)) : validTabs;

    // Group by URL
    const urlGroups = new Map();
    for (const tab of candidates) {
      const url = tab.linkedBrowser?.currentURI?.spec;
      if (!url || url === 'about:blank' || url === 'about:newtab') continue;
      if (!urlGroups.has(url)) urlGroups.set(url, []);
      urlGroups.get(url).push(tab);
    }

    // For each group with >1 tab, keep the most recently accessed, collect the rest
    const tabsToClose = [];
    for (const [, tabs] of urlGroups) {
      if (tabs.length < 2) continue;
      tabs.sort((a, b) => getTabLastAccessed(b) - getTabLastAccessed(a));
      for (let i = 1; i < tabs.length; i++) {
        tabsToClose.push(tabs[i]);
      }
    }

    dedupTabsToClose = tabsToClose;
    if (tabsToClose.length === 0) {
      const sublabel = S['display.searchAllWorkspaces'] ? 'No page is open twice in any workspace'
        : 'No page is open twice in this workspace \u2014 Tab includes all workspaces';
      return [{ key: 'dedup:none', label: 'No duplicate tabs found', icon: '\u2713', sublabel, tags: [] }];
    }

    // Cancel first and preselected; the duplicates below are the preview (REV-LCMDS-09)
    const n = tabsToClose.length;
    const actions = [
      { key: 'dedup:cancel', label: 'Cancel', icon: '↩', sublabel: 'Close nothing', tags: [] },
      { key: 'dedup:close', label: `Close ${n} duplicate tab${n !== 1 ? 's' : ''}`, icon: '🧹', tags: [],
        sublabel: `The most recently used copy of each page stays open${managed.length ? ` \u00B7 ZenRipple agent tabs are not included` : ''}` },
    ];
    return actions.concat(tabsToClose.map(tab => ({
      key: `dedup-tab:${tab.index}`,
      label: tab.label || 'Untitled',
      sublabel: tab.linkedBrowser?.currentURI?.spec || '',
      icon: '🧹',
      isTab: true,
      tab: tab,
      titleIndices: [],
      urlIndices: [],
      workspaceName: getTabWorkspaceName(tab),
    })));
  }

  // ── Selection helpers shared by several flows ──

  function enterCreateWorkspaceStep(data) {
    enterSubFlow('create-workspace-input', 'New Workspace', data);
  }

  // Run a folder action from a picker after the palette has closed (Zen's pickers and
  // inline editors need the palette gone first).
  function afterPalette(action, what) {
    exitSearchMode();
    setTimeout(() => {
      try { action(); } catch (e) {
        reportError(`${what} failed`, e);
        showZenLeapToast(`${what} failed — see the Browser Console`);
      }
    }, 100);
  }

  // ── The sub-flow table ──
  const SUBFLOWS = {
    // Select matching tabs → action
    'tab-search': {
      placeholder: 'Search tabs to select...',
      onEnter: () => { commandMatchedTabs = []; },
      results: q => getTabSearchSubFlowResults(q),
      select: () => enterSubFlow('action-picker', `${commandMatchedTabs.length} tabs`),
    },
    'action-picker': {
      placeholder: 'Choose an action...',
      results: q => getActionPickerResults(q),
      select: (r) => {
        if (r.subFlow) enterSubFlow(r.subFlow, r.label);
        else if (r.key === 'action:browse-select') selectTabsInBrowseMode(commandMatchedTabs);
        else if (r.key === 'action:close-all') closeMatchedTabs(commandMatchedTabs);
        else if (r.key === 'action:move-to-top') moveMatchedTabsToPosition(commandMatchedTabs, 'top');
        else if (r.key === 'action:move-to-bottom') moveMatchedTabsToPosition(commandMatchedTabs, 'bottom');
        else if (r.key === 'action:unload-all') unloadMatchedTabs(commandMatchedTabs);
      },
    },
    'workspace-picker': {
      placeholder: 'Choose a workspace...',
      results: q => workspacePickerResults(q, { keyPrefix: 'ws', createKey: 'ws:create-new', moving: true }),
      select: (r) => {
        if (r.key === 'ws:create-new') enterCreateWorkspaceStep({ originFlow: 'workspace-picker' });
        else moveTabsToWorkspace(commandMatchedTabs, r.workspaceId);
      },
    },
    'folder-picker': {
      placeholder: 'Choose a folder...',
      results: q => folderPickerResults(q, { keyPrefix: 'folder', icon: '📂', counts: false, createKey: 'folder:new' }),
      select: (r) => {
        // Name input sub-flow instead of Zen's inline rename (unreliable from the palette)
        if (r.key === 'folder:new') enterSubFlow('folder-name-input', 'Name new folder');
        else addTabsToFolder(commandMatchedTabs, r);
      },
    },
    'folder-name-input': {
      placeholder: 'Enter folder name...',
      results: q => textInputResults(q, FOLDER_NAME_INPUT),
      select: () => {
        const name = (commandQuery || '').trim();
        if (name) createFolderWithName(commandMatchedTabs, name);
      },
    },

    // Tab pickers
    'split-tab-picker': {
      placeholder: 'Search for a tab to split with...',
      onEnter: () => { commandMatchedTabs = []; },
      results: q => getSplitTabPickerResults(q),
      select: r => splitWithTab(r.tab),
    },
    'playing-tabs': {
      placeholder: 'Search playing tabs...',
      onEnter: () => { commandMatchedTabs = []; },
      results: q => getPlayingTabsResults(q),
      select: (r) => {
        exitSearchMode();
        if (r.tab) switchToTabAcrossWorkspaces(r.tab).catch(e => reportError('Switching to playing tab failed', e));
      },
    },
    'dedup-preview': {
      placeholder: 'Duplicates to close — choose with ↓ and Enter',
      readOnly: true,
      onExit: () => { hidePreviewPanel(true); dedupTabsToClose = []; },
      results: () => getDedupPreviewResults(),
      select: (r) => {
        if (r?.key === 'dedup:cancel') { exitSubFlow(); return; }
        if (r?.key === 'dedup:none') { exitSearchMode(); return; }
        // "Close N" (or a previewed duplicate): close them as one batch
        const count = TabOps.close(dedupTabsToClose);
        if (count) log(`Deduplicated: closed ${count} duplicate tab(s)`);
        dedupTabsToClose = [];
        hidePreviewPanel(true);
        exitSearchMode();
      },
    },
    'sort-picker': {
      placeholder: 'Sort by...',
      results: q => getSortPickerResults(q),
      select: (r) => {
        if (r.key === 'sort:domain') sortLooseTabsByDomain();
        else if (r.key === 'sort:title-az') sortLooseTabsByTitle();
        else if (r.key === 'sort:title-za') sortLooseTabsByTitleReverse();
        else if (r.key === 'sort:recency-newest') sortLooseTabsByRecencyNewest();
        else if (r.key === 'sort:recency-oldest') sortLooseTabsByRecencyOldest();
        exitSearchMode();
      },
    },

    // Confirmation of a command that declared confirm()
    'command-confirm': {
      placeholder: 'Confirm — choose with ↓ and Enter',
      readOnly: true,
      results: () => getCommandConfirmResults(),
      select: (r, data) => {
        if (r.key === 'command-confirm:run' && data?.cmd) runCommand(data.cmd);
        else exitSubFlow();
      },
    },

    // Workspaces
    'create-workspace-input': {
      placeholder: 'Enter new workspace name...',
      results: q => textInputResults(q, {
        keyPrefix: 'create-workspace-input', icon: '➕',
        prompt: 'Type a name for the new workspace and press Enter',
        confirm: name => `Create workspace: "${name}"`,
      }),
      select: (r, data) => {
        const name = commandQuery.trim();
        if (r.key === 'create-workspace-input:confirm' && name) handleCreateWorkspaceAndChain(name, data);
      },
    },
    'delete-workspace-picker': {
      placeholder: 'Select a workspace to delete...',
      // Deleting closes the workspace's tabs: never pre-select the current workspace
      results: q => workspacePickerResults(q, { keyPrefix: 'delete-workspace', verb: 'delete', icon: '🗑', markCurrent: true, currentLast: true, emptyLabel: 'No workspaces found' }),
      select: (r) => {
        if (r.workspaceId) enterSubFlow('delete-workspace-confirm', `Delete: ${r.workspaceName}`, { workspaceId: r.workspaceId, workspaceName: r.workspaceName });
      },
    },
    'delete-workspace-confirm': {
      placeholder: 'Deleting a workspace closes its tabs — choose with ↓ and Enter',
      readOnly: true,
      results: (q, data) => getDeleteWorkspaceConfirmResults(data),
      select: (r, data) => {
        if (r.key === 'delete-workspace:confirm' && data?.workspaceId) deleteWorkspace(data.workspaceId);
        else exitSubFlow();
      },
    },
    'switch-workspace-picker': {
      placeholder: 'Select a workspace to switch to...',
      results: q => workspacePickerResults(q, { keyPrefix: 'switch-workspace', verb: 'switch', markCurrent: true, createKey: 'switch-workspace:create-new' }),
      select: (r) => {
        if (r.key === 'switch-workspace:create-new') {
          enterCreateWorkspaceStep({ originFlow: 'switch-workspace-picker' });
        } else if (r.workspaceId) {
          exitSearchMode();
          gZenWorkspaces.changeWorkspaceWithID(r.workspaceId);
        }
      },
    },
    'move-to-workspace-picker': {
      placeholder: 'Select a workspace to move tab to...',
      results: q => workspacePickerResults(q, { keyPrefix: 'move-to-workspace', verb: 'move', excludeActive: true, createKey: 'move-to-workspace:create-new', moving: true }),
      select: (r) => {
        if (r.key === 'move-to-workspace:create-new') {
          enterCreateWorkspaceStep({ originFlow: 'move-to-workspace-picker', tabToMove: currentTab() });
        } else if (r.workspaceId) {
          const tabToMove = currentTab();
          exitSearchMode();
          // Move, then follow the tab into the target workspace
          TabOps.moveToWorkspace([tabToMove], r.workspaceId);
          noteMovedIntoAgentSpace([tabToMove], r.workspaceId);
          switchToTabAcrossWorkspaces(tabToMove).catch(e => reportError('Following moved tab failed', e));
        }
      },
    },
    'rename-workspace-picker': {
      placeholder: 'Select a workspace to rename...',
      results: q => workspacePickerResults(q, { keyPrefix: 'rename-workspace', verb: 'rename', icon: '✏', markCurrent: true, emptyLabel: 'No workspaces found' }),
      select: (r) => {
        if (r.workspaceId) enterSubFlow('rename-workspace-input', `Rename: ${r.workspaceName}`, { workspaceId: r.workspaceId, workspaceName: r.workspaceName });
      },
    },
    'rename-workspace-input': {
      placeholder: 'Enter new workspace name...',
      results: q => textInputResults(q, {
        keyPrefix: 'rename-workspace-input', icon: '✏',
        prompt: 'Type a new name for the workspace and press Enter',
        confirm: name => `Rename workspace to: "${name}"`,
      }),
      select: (r, data) => {
        const name = commandQuery.trim();
        if (r.key === 'rename-workspace-input:confirm' && name && data?.workspaceId) renameWorkspace(data.workspaceId, name);
      },
    },

    // Folders
    'delete-folder-picker': {
      placeholder: 'Select a folder to delete...',
      results: q => folderPickerResults(q, { keyPrefix: 'delete-folder', verb: 'delete', icon: '🗑' }),
      select: (r) => {
        if (r.folder) enterSubFlow('delete-folder-confirm', `Delete: ${r.label}`, { folder: r.folder });
      },
    },
    'delete-folder-confirm': {
      placeholder: 'What should happen to the folder’s tabs?',
      readOnly: true,
      results: (q, data) => getDeleteFolderConfirmResults(data),
      select: (r, data) => {
        const folder = data?.folder;
        if (r.key === 'delete-folder:keep-tabs' && folder) {
          exitSearchMode();
          dissolveFolder(folder).catch(e => reportError('Deleting folder failed', e));
        } else if (r.key === 'delete-folder:with-tabs' && folder) {
          exitSearchMode();
          deleteFolderWithTabs(folder).catch(e => reportError('Deleting folder failed', e));
        } else {
          exitSubFlow();
        }
      },
    },
    'add-to-folder-picker': {
      placeholder: 'Select a folder to add tab to...',
      // Skip the folder the tab is already in
      results: q => folderPickerResults(q, { keyPrefix: 'add-to-folder', verb: 'add', icon: '📂', skip: currentTab()?.group }),
      select: (r) => { if (r.folder) addTabToFolder(r.folder); },
    },
    'rename-folder-picker': {
      placeholder: 'Select a folder to rename...',
      results: q => folderPickerResults(q, { keyPrefix: 'rename-folder', verb: 'rename', icon: '✏' }),
      select: (r) => {
        if (r.folder) enterSubFlow('rename-folder-input', `Rename: ${r.label}`, { folderId: r.folder.id, folderName: r.label });
      },
    },
    'rename-folder-input': {
      placeholder: 'Enter new folder name...',
      results: q => textInputResults(q, {
        keyPrefix: 'rename-folder-input', icon: '✏',
        prompt: 'Type a new name for the folder and press Enter',
        confirm: name => `Rename folder to: "${name}"`,
      }),
      select: (r, data) => {
        const name = commandQuery.trim();
        if (r.key === 'rename-folder-input:confirm' && name && data?.folderId) renameFolder(data.folderId, name);
      },
    },
    'change-folder-icon-picker': {
      placeholder: 'Select a folder to change icon...',
      results: q => folderPickerResults(q, { keyPrefix: 'change-icon-folder', verb: 'change-icon', icon: '🎨' }),
      select: (r) => {
        if (r.folder) afterPalette(() => gZenFolders.changeFolderUserIcon(r.folder), 'Change folder icon');
      },
    },
    'unload-folder-picker': {
      placeholder: 'Select a folder to unload tabs...',
      results: q => folderPickerResults(q, { keyPrefix: 'unload-folder', verb: 'unload', icon: '💤' }),
      select: (r) => {
        if (!r.folder) return;
        exitSearchMode();
        // Zen's own "Unload all tabs" for folders: unloads (per the pinned-tab close
        // behavior pref) and collapses the folder
        try {
          r.folder.unloadAllTabs(new CustomEvent('ZenLeapUnloadFolder'));
          log(`Unloaded tabs in folder: ${folderName(r.folder)}`);
        } catch (e) { reportError('Unloading folder tabs failed', e); }
      },
    },
    'create-subfolder-picker': {
      placeholder: 'Select a parent folder...',
      results: q => folderPickerResults(q, { keyPrefix: 'subfolder-folder', verb: 'subfolder', icon: '📁', canNest: true }),
      select: (r) => {
        if (r.folder) afterPalette(() => r.folder.createSubfolder(), 'Create subfolder');
      },
    },
    'folder-to-workspace-picker': {
      placeholder: 'Select a folder to convert to workspace...',
      results: q => folderPickerResults(q, { keyPrefix: 'convert-folder', verb: 'convert', icon: '🗂' }),
      select: (r) => {
        exitSearchMode();
        if (r.folder) convertFolderToWorkspace(r.folder).catch(e => reportError('Convert folder to workspace failed', e));
      },
    },
    'unpack-folder-picker': {
      placeholder: 'Select a folder to unpack...',
      results: q => folderPickerResults(q, { keyPrefix: 'unpack-folder', verb: 'unpack', icon: '📦' }),
      select: (r) => {
        exitSearchMode();
        if (!r.folder) return;
        Promise.resolve(r.folder.unpackTabs())
          .then(() => log(`Unpacked folder: ${folderName(r.folder)}`))
          .catch(e => reportError('Unpack folder failed', e));
      },
    },
    'move-folder-to-ws-folder-picker': {
      placeholder: 'Select a folder to move...',
      results: q => folderPickerResults(q, { keyPrefix: 'move-ws-folder', verb: 'move-ws', icon: '🗂' }),
      select: (r) => {
        if (r.folder) enterSubFlow('move-folder-to-ws-workspace-picker', `Move: ${r.label}`, { folder: r.folder, folderName: r.label });
      },
    },
    'move-folder-to-ws-workspace-picker': {
      placeholder: 'Select destination workspace...',
      results: q => workspacePickerResults(q, { keyPrefix: 'move-to-workspace', verb: 'move', excludeActive: true, createKey: 'move-to-workspace:create-new', moving: true }),
      select: (r, data) => {
        if (r.key === 'move-to-workspace:create-new') {
          enterCreateWorkspaceStep({ originFlow: 'move-folder-to-ws-workspace-picker', folder: data?.folder, folderName: data?.folderName });
        } else if (r.workspaceId) {
          exitSearchMode();
          if (data?.folder && window.gZenFolders) {
            try {
              gZenFolders.changeFolderToSpace(data.folder, r.workspaceId);
              noteMovedIntoAgentSpace(data.folder.tabs || [], r.workspaceId);
              log(`Moved folder "${data.folderName}" to workspace`);
            } catch (e) { reportError('Move folder to workspace failed', e); }
          }
        }
      },
    },

    // Browse-mode selection (the palette opened from browse mode acts on browseCommandTabs)
    'browse-workspace-picker': {
      placeholder: 'Choose a workspace...',
      results: q => workspacePickerResults(q, { keyPrefix: 'ws', createKey: 'ws:create-new', moving: true }),
      select: (r) => {
        if (r.key === 'ws:create-new') enterCreateWorkspaceStep({ originFlow: 'browse-workspace-picker' });
        else if (r.workspaceId) moveTabsToWorkspace(browseCommandTabs, r.workspaceId);
      },
    },
    'browse-folder-picker': {
      placeholder: 'Choose a folder...',
      results: q => folderPickerResults(q, { keyPrefix: 'folder', icon: '📂', counts: false, createKey: 'folder:new' }),
      select: (r) => {
        if (r.key === 'folder:new') enterSubFlow('browse-folder-name-input', 'Name new folder');
        else addTabsToFolder(browseCommandTabs, r);
      },
    },
    'browse-folder-name-input': {
      placeholder: 'Enter folder name...',
      results: q => textInputResults(q, FOLDER_NAME_INPUT),
      select: () => {
        const name = (commandQuery || '').trim();
        if (name) createFolderWithName(browseCommandTabs, name);
      },
    },

    // Sessions
    'save-session-scope': {
      placeholder: 'What to save?',
      results: q => getSaveSessionScopeResults(q),
      select: r => enterSubFlow('save-session-input', 'Add Comment', { scope: r.key === 'save-scope:all' ? 'all' : 'current' }),
    },
    'save-session-input': {
      placeholder: 'Type a comment for this snapshot and press Enter...',
      results: q => getSaveSessionInputResults(q),
      select: () => handleSaveSession(commandQuery.trim()),
    },
    'restore-session-picker': {
      placeholder: 'Select a session to restore...',
      results: q => getRestoreSessionPickerResults(q),
      select: (r) => { if (r.sessionData) enterSubFlow('restore-session-mode', 'Restore Mode', { session: r.sessionData }); },
    },
    'restore-session-mode': {
      placeholder: 'How to restore?',
      results: q => getRestoreSessionModeResults(q),
      select: (r, data) => {
        if (r.key === 'restore-mode:new') handleRestoreSession(data?.session, 'new');
        // Destructive: confirm (with counts) first
        else if (r.key === 'restore-mode:replace') enterSubFlow('restore-replace-confirm', 'Replace Current Workspace', { session: data?.session });
      },
    },
    'restore-replace-confirm': {
      placeholder: 'Replacing closes the current workspace’s tabs — choose with ↓ and Enter',
      readOnly: true,
      results: () => getRestoreReplaceConfirmResults(),
      select: (r, data) => {
        if (r.key === 'restore-replace:confirm') handleRestoreSession(data?.session, 'replace');
        else exitSubFlow();
      },
    },
    'list-sessions-picker': {
      placeholder: 'Browse saved sessions...',
      results: q => getListSessionsPickerResults(q),
      select: (r) => { if (r.sessionData) enterSubFlow('session-detail-view', r.label, { session: r.sessionData }); },
    },
    'session-detail-view': {
      placeholder: 'Session contents (Esc to go back)',
      readOnly: true,
      results: q => getSessionDetailViewResults(q),
      select: (r, data) => { if (data?.session) enterSubFlow('restore-session-mode', 'Restore Mode', { session: data.session }); },
    },
    'delete-session-confirm': {
      placeholder: 'Delete session? Choose with ↓ and Enter',
      readOnly: true,
      results: () => getDeleteSessionConfirmResults(),
      select: (r, data) => {
        if (r.key === 'delete-session:confirm' && data?.sessionId) {
          deleteSessionFile(data.sessionId).then(() => {
            sessionCache = null;
            sessionLoadPromise = null;
            exitSubFlow();
          }).catch(e => {
            reportError('Deleting session failed', e);
            exitSubFlow();
          });
        } else if (r.key === 'delete-session:cancel') {
          exitSubFlow();
        }
      },
    },

    // Themes
    'theme-picker': {
      placeholder: 'Select a theme...',
      onExit: () => endThemePreview(),
      results: q => getThemePickerResults(q),
      select: (r) => {
        if (!r.themeId) return;
        _themePreviewing = false;
        S['appearance.theme'] = r.themeId;
        saveSettings();
        applyTheme();
        // Ask about browser application
        enterSubFlow('theme-browser-confirm', 'Apply to Browser?');
      },
    },
    'theme-browser-confirm': {
      placeholder: 'Apply theme to browser too?',
      results: q => getThemeBrowserConfirmResults(q),
      select: (r) => {
        if (r.key === 'theme-browser:yes') S['appearance.applyToBrowser'] = true;
        else if (r.key === 'theme-browser:no') S['appearance.applyToBrowser'] = false;
        saveSettings();
        applyBrowserTheme();
        exitSearchMode();
      },
    },
  };

  // Action executors for sub-flows
  function selectTabsInBrowseMode(tabs) {
    exitSearchMode();
    setTimeout(() => {
      enterLeapMode();
      // Enter browse mode at the first matched tab
      const visibleItems = getVisibleItems();
      const firstMatchIdx = tabs.length > 0 ? visibleItems.indexOf(tabs[0]) : -1;

      browseMode = true;
      browseDirection = 'down';
      const currentIdx = findCurrentItemIndex(visibleItems);
      originalTabIndex = currentIdx >= 0 ? currentIdx : 0;
      originalTab = currentTab();
      setHighlight(firstMatchIdx >= 0 ? firstMatchIdx : originalTabIndex, visibleItems);

      // Pre-select the matched tabs
      selectedItems.clear();
      for (const t of tabs) {
        if (isLiveTab(t)) selectedItems.add(t);
      }

      updateHighlight();
      updateLeapOverlayState();
      log(`Browse mode with ${selectedItems.size} pre-selected tabs`);
    }, 100);
  }

  // Close a user-selected set of tabs as one batch; Firefox's own warning appears when
  // more tabs than can be reopened would close.
  function closeMatchedTabs(tabs) {
    exitSearchMode();
    const count = TabOps.close(tabs, { warn: gBrowser.closingTabsEnum.MULTI_SELECTED });
    log(`Closed ${count} matching tabs`);
  }

  // Unload (discard) matched tabs to save memory. Firefox picks another tab to select
  // first when the current one is included, and handles split views/beforeunload.
  function unloadMatchedTabs(tabs) {
    exitSearchMode();
    TabOps.unload(tabs)
      .then(count => log(`Unloaded ${count} matching tabs`))
      .catch(e => reportError('Unloading tabs failed', e));
  }

  function reloadMatchedTabs(tabs) {
    const validTabs = liveTabs(tabs);
    for (const t of validTabs) gBrowser.reloadTab(t);
    log(`Reloaded ${validTabs.length} tabs`);
    exitSearchMode();
  }

  function bookmarkMatchedTabs(tabs) {
    const validTabs = liveTabs(tabs);
    try {
      // Use bookmarkTabs() which is the same API the context menu uses
      PlacesCommandHook.bookmarkTabs(validTabs);
    } catch(e) { reportError('Bookmarking tabs failed', e); }
    exitSearchMode();
  }

  // --- Tab Sorting Helpers ---

  // Extract hostname from a tab's URL (returns '' for about: pages, etc.)
  function getDomainFromTab(tab) {
    try {
      const url = tab.linkedBrowser?.currentURI?.spec;
      if (!url || url.startsWith('about:') || url.startsWith('moz-extension:')) return '';
      return new URL(url).hostname;
    } catch (e) { return ''; }
  }

  // Get loose tabs eligible for sorting: non-pinned, non-essential, not in folders, and
  // not ZenRipple's (it keeps each agent session's tabs together; foldering them would
  // also pin them, which ZenRipple reads as "the user took this tab")
  function getSortableLooseTabs() {
    return getVisibleTabs().filter(t =>
      !t.pinned &&
      !t.hasAttribute('zen-essential') &&
      !t.group &&
      !t.closing &&
      !isExternallyManagedTab(t)
    );
  }

  // Reorder loose tabs in the sidebar to match a sorted array.
  // Pinned tabs, essential tabs, and folder contents are left in place.
  function reorderTabsInSortedOrder(sortedTabs) {
    if (sortedTabs.length < 2) return;

    try {
      const visibleTabs = getVisibleTabs();
      // Find the first non-pinned, non-essential position as our anchor
      const firstRegularIdx = visibleTabs.findIndex(t => !t.pinned && !t.hasAttribute('zen-essential'));
      if (firstRegularIdx < 0) return;

      // Place the sorted tabs, in order, at the first regular position
      gBrowser.moveTabsBefore(sortedTabs, visibleTabs[firstRegularIdx]);
    } catch (e) { reportError('Reordering tabs failed', e); }
  }

  // Sort all loose tabs by domain, grouping same-domain tabs together
  function sortLooseTabsByDomain() {
    const tabs = getSortableLooseTabs();
    if (tabs.length < 2) return;

    const sorted = [...tabs].sort((a, b) => {
      const domA = getDomainFromTab(a);
      const domB = getDomainFromTab(b);
      if (domA !== domB) return domA.localeCompare(domB);
      return 0; // stable sort preserves original order within same domain
    });

    reorderTabsInSortedOrder(sorted);
    log(`Sorted ${sorted.length} tabs by domain`);
  }

  // Sort all loose tabs alphabetically by title (A → Z)
  function sortLooseTabsByTitle() {
    const tabs = getSortableLooseTabs();
    if (tabs.length < 2) return;

    const sorted = [...tabs].sort((a, b) =>
      (a.label || '').localeCompare(b.label || '')
    );

    reorderTabsInSortedOrder(sorted);
    log(`Sorted ${sorted.length} tabs by title A-Z`);
  }

  // Sort all loose tabs alphabetically by title (Z → A)
  function sortLooseTabsByTitleReverse() {
    const tabs = getSortableLooseTabs();
    if (tabs.length < 2) return;

    const sorted = [...tabs].sort((a, b) =>
      (b.label || '').localeCompare(a.label || '')
    );

    reorderTabsInSortedOrder(sorted);
    log(`Sorted ${sorted.length} tabs by title Z-A`);
  }

  // Sort all loose tabs by recency (most recent first)
  function sortLooseTabsByRecencyNewest() {
    const tabs = getSortableLooseTabs();
    if (tabs.length < 2) return;

    const sorted = sortTabsByRecency(tabs); // already sorts most-recent-first
    reorderTabsInSortedOrder(sorted);
    log(`Sorted ${sorted.length} tabs by recency (newest first)`);
  }

  // Sort all loose tabs by recency (oldest first)
  function sortLooseTabsByRecencyOldest() {
    const tabs = getSortableLooseTabs();
    if (tabs.length < 2) return;

    const sorted = sortTabsByRecency(tabs).reverse();
    reorderTabsInSortedOrder(sorted);
    log(`Sorted ${sorted.length} tabs by recency (oldest first)`);
  }

  // Group loose tabs by domain, creating a folder per domain (2+ tabs)
  function groupLooseTabsByDomain() {
    if (!window.gZenFolders) { log('Folders not available'); return; }

    const looseTabs = getSortableLooseTabs();
    if (looseTabs.length === 0) return;

    // Group by domain
    const domainGroups = new Map();
    for (const tab of looseTabs) {
      const domain = getDomainFromTab(tab);
      if (!domain) continue; // skip about: pages, etc.
      if (!domainGroups.has(domain)) domainGroups.set(domain, []);
      domainGroups.get(domain).push(tab);
    }

    // Create folders for domains with 2+ tabs
    let folderCount = 0;
    for (const [domain, tabs] of domainGroups) {
      if (tabs.length < 2) continue;
      const sortedTabs = sortTabsBySidebarPosition(tabs);
      gZenFolders.createFolder(sortedTabs, {
        label: domain,
        renameFolder: false,
      });
      folderCount++;
    }
    log(`Created ${folderCount} domain folders`);
  }

  function moveMatchedTabsToPosition(tabs, position) {
    exitSearchMode();
    const validTabs = liveTabs(tabs);
    if (validTabs.length === 0) return;

    // Move tabs from other workspaces into the current workspace first (one ordered batch)
    if (workspacesEnabled()) {
      const currentWsId = gZenWorkspaces.activeWorkspace;
      TabOps.moveToWorkspace(validTabs.filter(t => {
        const wsId = t.getAttribute('zen-workspace-id');
        return wsId && wsId !== currentWsId && !t.hasAttribute('zen-essential');
      }), currentWsId);
    }

    // Unpin any pinned tabs (except essentials) so they can cross the pinned/unpinned DOM boundary
    for (const tab of validTabs) {
      if (tab.pinned && !tab.hasAttribute('zen-essential')) {
        gBrowser.unpinTab(tab);
      }
    }

    const sortedTabs = sortTabsBySidebarPosition(validTabs);
    const sortedSet = new Set(sortedTabs);
    const visibleTabs = getVisibleTabs();
    try {
      if (position === 'top') {
        // Anchor: the first regular tab that is not being moved (or the first regular tab)
        const anchor = visibleTabs.find(t => !t.pinned && !t.hasAttribute('zen-essential') && !sortedSet.has(t))
          || visibleTabs.find(t => !t.pinned && !t.hasAttribute('zen-essential'));
        if (anchor && anchor !== sortedTabs[0]) gBrowser.moveTabsBefore(sortedTabs, anchor);
        else if (anchor && sortedTabs.length > 1) gBrowser.moveTabsAfter(sortedTabs.slice(1), sortedTabs[0]);
      } else {
        const lastTab = visibleTabs[visibleTabs.length - 1];
        if (lastTab && lastTab !== sortedTabs[0]) gBrowser.moveTabsAfter(sortedTabs, lastTab);
        else if (sortedTabs.length > 1) gBrowser.moveTabsAfter(sortedTabs.slice(1), sortedTabs[0]);
      }
      log(`Moved ${sortedTabs.length} tabs to ${position}`);
    } catch (e) { reportError(`Moving tabs to the ${position} failed`, e); }
  }

  function moveTabsToWorkspace(tabs, workspaceId) {
    try {
      const count = TabOps.moveToWorkspace(tabs, workspaceId);
      if (count) noteMovedIntoAgentSpace(tabs, workspaceId);
      log(`Moved ${count} tabs to workspace ${workspaceId}`);
    } catch (e) { reportError('Moving tabs to workspace failed', e); }
    exitSearchMode();
  }

  // The user moved their own tabs into ZenRipple's agent space: say what that means.
  function noteMovedIntoAgentSpace(tabs, workspaceId) {
    if (!isAgentSpace(workspaceId) || !Array.from(tabs || []).some(t => isLiveTab(t) && !isAgentTab(t))) return;
    showZenLeapToast('Moved to the ZenRipple space: ZenRipple agents can see and use the tabs there', 6000);
  }

  async function handleCreateWorkspaceAndChain(name, data) {
    if (!window.gZenWorkspaces) { log('gZenWorkspaces not available'); exitSearchMode(); return; }

    const originFlow = data?.originFlow;

    try {
      await gZenWorkspaces.createAndSaveWorkspace(name, undefined, false, 0);
    } catch (e) {
      reportError('Creating workspace failed', e);
      exitSearchMode();
      return;
    }

    // createAndSaveWorkspace with dontChange=false auto-switches; get the new workspace ID
    const newWsId = gZenWorkspaces.activeWorkspace;

    switch (originFlow) {
      case 'workspace-picker':
        // Move matched tabs (from tab-search → action-picker → workspace-picker) to new workspace
        moveTabsToWorkspace(commandMatchedTabs, newWsId);
        return; // moveTabsToWorkspace calls exitSearchMode

      case 'switch-workspace-picker':
        // Already switched by createAndSaveWorkspace
        exitSearchMode();
        return;

      case 'move-to-workspace-picker': {
        // Move the captured tab to the new (already active) workspace and select it
        const tabToMove = data?.tabToMove;
        exitSearchMode();
        if (isLiveTab(tabToMove)) {
          TabOps.moveToWorkspace([tabToMove], newWsId);
          await switchToTabAcrossWorkspaces(tabToMove);
        }
        return;
      }

      case 'browse-workspace-picker':
        // Move browse-selected tabs to new workspace
        moveTabsToWorkspace(browseCommandTabs, newWsId);
        return; // moveTabsToWorkspace calls exitSearchMode

      case 'move-folder-to-ws-workspace-picker':
        // Move folder to new workspace
        if (data?.folder && window.gZenFolders) {
          try {
            gZenFolders.changeFolderToSpace(data.folder, newWsId);
            log(`Moved folder "${data.folderName}" to new workspace "${name}"`);
          } catch(e) { reportError('Moving folder to workspace failed', e); }
        }
        exitSearchMode();
        return;

      default:
        // Standalone create-workspace command — already switched, just exit
        exitSearchMode();
        return;
    }
  }

  function addTabsToFolder(tabs, folderResult) {
    exitSearchMode();
    const validTabs = liveTabs(tabs);
    // Re-fetch folder by ID to avoid stale DOM references
    const targetFolder = folderResult?.folder ? document.getElementById(folderResult.folder.id) : null;
    if (validTabs.length === 0 || !targetFolder) { log('Add to folder: no tabs or folder not found'); return; }

    // Sort tabs by sidebar position to preserve relative order
    const sortedTabs = sortTabsBySidebarPosition(validTabs);
    try {
      // Tabs from other workspaces move over first (one ordered batch)
      const targetWorkspaceId = targetFolder.getAttribute('zen-workspace-id');
      if (targetWorkspaceId && workspacesEnabled()) {
        TabOps.moveToWorkspace(sortedTabs.filter(t => (t.getAttribute('zen-workspace-id') || gZenWorkspaces.activeWorkspace) !== targetWorkspaceId), targetWorkspaceId);
      }
      // Zen folders hold pinned tabs
      for (const t of sortedTabs) {
        if (!t.pinned) gBrowser.pinTab(t);
      }
      targetFolder.addTabs(sortedTabs);
      log(`Added ${sortedTabs.length} tabs to folder: ${folderName(targetFolder)}`);
    } catch (e) { reportError('Adding tabs to folder failed', e); }
  }

  function createFolderWithName(tabs, name) {
    exitSearchMode();
    const validTabs = liveTabs(tabs).filter(t => !t.hasAttribute('zen-essential'));
    if (validTabs.length === 0 || !window.gZenFolders) return;

    // Sort tabs by sidebar position to preserve relative order
    const sortedTabs = sortTabsBySidebarPosition(validTabs);
    try {
      // gZenFolders.createFolder handles pinning tabs internally
      gZenFolders.createFolder(sortedTabs, { label: name, renameFolder: false });
      log(`Created folder "${name}" with ${sortedTabs.length} tabs`);
    } catch (e) { reportError('Creating folder failed', e); }
  }

  // Duplicate matched tabs (each copy goes right after its source, like Zen's own duplicate)
  function duplicateMatchedTabs(tabs) {
    exitSearchMode();
    const validTabs = liveTabs(tabs);
    for (const t of validTabs) gBrowser.duplicateTab(t, true, { tabIndex: t.index + 1 });
    log(`Duplicated ${validTabs.length} tabs`);
  }

  // Pin or unpin matched tabs (smart toggle: if any unpinned, pin all; else unpin all)
  function pinUnpinMatchedTabs(tabs) {
    const validTabs = liveTabs(tabs);
    const anyUnpinned = validTabs.some(t => !t.pinned);
    for (const t of validTabs) {
      if (anyUnpinned) { if (!t.pinned) gBrowser.pinTab(t); }
      else { if (t.pinned) gBrowser.unpinTab(t); }
    }
    log(`${anyUnpinned ? 'Pinned' : 'Unpinned'} ${validTabs.length} tabs`);
    exitSearchMode();
  }

  // Mute or unmute matched tabs
  function muteUnmuteMatchedTabs(tabs) {
    const validTabs = liveTabs(tabs);
    for (const t of validTabs) t.toggleMuteAudio();
    log(`Toggled mute on ${validTabs.length} tabs`);
    exitSearchMode();
  }

  function splitWithTab(tab) {
    try {
      if (window.gZenViewSplitter && tab) {
        window.gZenViewSplitter.splitTabs([currentTab(), tab]);
        log(`Split view with tab: ${tab.label}`);
      }
    } catch (e) { reportError('Split view failed', e); }
    exitSearchMode();
  }

  function splitBrowseTabs(tabs) {
    try {
      if (window.gZenViewSplitter && tabs.length >= 2) {
        const validTabs = tabs.filter(t =>
          isLiveTab(t) &&
          !t.hidden && !t.hasAttribute('zen-empty-tab') &&
          !t.hasAttribute('zen-essential') && !t.hasAttribute('zen-glance-tab') &&
          !t.splitView
        ).slice(0, 4);
        if (validTabs.length >= 2) {
          window.gZenViewSplitter.splitTabs(validTabs);
          log(`Split view with ${validTabs.length} browse-selected tabs`);
        } else {
          log('Not enough valid tabs for split view after filtering');
        }
      }
    } catch (e) { reportError('Split view failed', e); }
    exitSearchMode();
  }

  async function deleteWorkspace(workspaceId) {
    exitSearchMode();
    if (!workspacesEnabled()) return;
    const name = getWorkspaceName(workspaceId) || workspaceId;
    try {
      const confirmed = await removeWorkspaceWithTimeout(workspaceId);
      if (confirmed || !gZenWorkspaces.getWorkspaces().some(w => w.uuid === workspaceId)) {
        log(`Deleted workspace: ${name}`);
      } else {
        console.warn(`[ZenLeap] Deleting workspace "${name}": Zen did not remove it within 5 seconds`);
        showZenLeapToast(`Workspace "${name}" was not deleted — see the Browser Console`);
      }
    } catch (e) {
      reportError(`Deleting workspace "${name}" failed`, e);
      showZenLeapToast(`Deleting workspace "${name}" failed — see the Browser Console`);
    }
  }

  function addTabToFolder(folder) {
    addTabsToFolder([currentTab()], { folder });
  }

  function renameFolder(folderId, newName) {
    exitSearchMode();
    const targetFolder = document.getElementById(folderId);
    if (!targetFolder?.isZenFolder) { log('Folder not found for rename'); return; }
    const oldName = folderName(targetFolder);
    try {
      // The name setter fires ZenFolderRenamed (Zen syncs/saves the label)
      targetFolder.name = newName;
      log(`Renamed folder: "${oldName}" → "${newName}"`);
    } catch (e) { reportError('Renaming folder failed', e); }
  }

  function renameWorkspace(workspaceId, newName) {
    try {
      if (!window.gZenWorkspaces) { log('gZenWorkspaces not available'); exitSearchMode(); return; }
      const workspaces = window.gZenWorkspaces.getWorkspaces();
      const workspaceData = workspaces.find(ws => ws.uuid === workspaceId);
      if (!workspaceData) { log('Workspace not found for rename'); exitSearchMode(); return; }
      const oldName = workspaceData.name || 'Unnamed';
      workspaceData.name = newName;
      if (typeof gZenWorkspaces.saveWorkspace === 'function') {
        gZenWorkspaces.saveWorkspace(workspaceData);
      } else {
        log('No API available to save workspace');
        exitSearchMode();
        return;
      }
      // Update the workspace indicator UI if this is the active workspace
      if (workspaceId === window.gZenWorkspaces.activeWorkspace) {
        const indicator = gZenWorkspaces.workspaceElement?.(workspaceId)?.indicator;
        if (indicator) {
          const nameEl = indicator.querySelector('.zen-current-workspace-indicator-name');
          if (nameEl) nameEl.textContent = newName;
        }
      }
      log(`Renamed workspace: "${oldName}" → "${newName}"`);
    } catch (e) { reportError('Renaming workspace failed', e); }
    exitSearchMode();
  }

  // ============================================
  // SESSION MANAGEMENT (save / restore / list)
  // ============================================

  // --- Core I/O ---

  async function getSessionsDir() {
    const dir = PathUtils.join(PathUtils.profileDir, 'zenleap-sessions');
    await IOUtils.makeDirectory(dir, { createAncestors: true, ignoreExisting: true });
    return dir;
  }

  // Session files may be old, hand-edited or damaged: keep what is usable and drop
  // what isn't (null workspaces or layout items, numeric names/comments), so one bad
  // file can't break the session pickers (REV-LCMDS-05). Returns null if unusable.
  function sessionText(value, fallback) {
    if (typeof value === 'string') return value;
    return (typeof value === 'number' || typeof value === 'boolean') ? String(value) : fallback;
  }

  function normalizeLayoutItems(items, depth = 0) {
    if (!Array.isArray(items) || depth > 32) return [];
    const out = [];
    for (const item of items) {
      if (!_isPlainObject(item)) continue;
      if (item.type === 'folder') {
        out.push({ ...item, name: sessionText(item.name, ''), children: normalizeLayoutItems(item.children, depth + 1) });
      } else if (item.type === 'tab') {
        out.push({ ...item, url: sessionText(item.url, 'about:blank'), title: sessionText(item.title, '') });
      }
    }
    return out;
  }

  function normalizeSessionData(data) {
    if (!_isPlainObject(data) || !data.version || typeof data.id !== 'string' || !Array.isArray(data.workspaces)) return null;
    const workspaces = data.workspaces.filter(_isPlainObject).map(ws => {
      const out = { ...ws, name: sessionText(ws.name, 'Workspace') };
      if (Array.isArray(ws.layout)) out.layout = normalizeLayoutItems(ws.layout);
      // v1 files: flat tab and folder lists
      if (Array.isArray(ws.tabs)) out.tabs = ws.tabs.filter(_isPlainObject);
      if (Array.isArray(ws.folders)) out.folders = ws.folders.filter(_isPlainObject);
      return out;
    });
    // Stats are derived from the layout (older files have none, edited ones may be wrong)
    return { ...data, comment: sessionText(data.comment, ''), workspaces, stats: computeSessionStats(workspaces) };
  }

  async function loadAllSessions() {
    // Return cached sessions if fresh (< 5 seconds old)
    if (sessionCache && (Date.now() - sessionCache.loadedAt < 5000)) {
      return sessionCache.sessions;
    }
    // Reuse in-flight load to prevent duplicate concurrent disk reads
    if (sessionLoadPromise) return sessionLoadPromise;

    sessionLoadPromise = (async () => {
      const sessions = [];
      try {
        const dir = await getSessionsDir();
        const children = await IOUtils.getChildren(dir);
        for (const filePath of children) {
          if (!filePath.endsWith('.json')) continue;
          try {
            const data = normalizeSessionData(await IOUtils.readJSON(filePath));
            if (data) {
              data._filePath = filePath;
              sessions.push(data);
            } else {
              console.warn(`[ZenLeap] Skipping session file with unexpected format: ${filePath}`);
            }
          } catch (e) {
            console.warn(`[ZenLeap] Skipping unreadable session file ${filePath}:`, e);
          }
        }
      } catch (e) {
        reportError('Loading saved sessions failed', e);
      } finally {
        sessionLoadPromise = null;
      }
      sessions.sort((a, b) => new Date(b.savedAt) - new Date(a.savedAt));
      sessionCache = { sessions, loadedAt: Date.now() };
      return sessions;
    })();

    return sessionLoadPromise;
  }

  async function saveSessionToFile(sessionData) {
    if (isPrivateWindow()) throw new Error('Sessions cannot be saved from a private window');
    const dir = await getSessionsDir();
    const filePath = PathUtils.join(dir, `${sessionData.id}.json`);
    await IOUtils.writeJSON(filePath, sessionData, { tmpPath: `${filePath}.tmp` });
    sessionCache = null;
    sessionLoadPromise = null;
    log(`Session saved: ${filePath}`);
  }

  // Keep only the most recent automatic backups (made before "Replace" restores).
  const MAX_AUTO_BACKUP_SESSIONS = 5;
  async function pruneAutoBackupSessions() {
    try {
      const sessions = (await loadAllSessions()).filter(s => s.autoBackup);
      for (const old of sessions.slice(MAX_AUTO_BACKUP_SESSIONS)) {
        await IOUtils.remove(old._filePath, { ignoreAbsent: true });
      }
      if (sessions.length > MAX_AUTO_BACKUP_SESSIONS) { sessionCache = null; sessionLoadPromise = null; }
    } catch (e) { log(`Pruning auto-backup sessions failed: ${e}`); }
  }

  async function deleteSessionFile(sessionId) {
    const dir = await getSessionsDir();
    const filePath = PathUtils.join(dir, `${sessionId}.json`);
    try {
      await IOUtils.remove(filePath);
      log(`Session deleted: ${sessionId}`);
    } catch (e) {
      reportError('Deleting session file failed', e);
    }
    sessionCache = null;
    sessionLoadPromise = null;
  }

  // --- Data Collection (v2: tree-based layout matching DOM structure) ---

  // withState (folder-delete undo only, never written to files): the tab's full
  // SessionStore state (history, scroll, form data) and container.
  function collectTabItem(tab, splitGroupMap, { withState = false } = {}) {
    const item = {
      type: 'tab',
      url: tab.linkedBrowser?.currentURI?.spec || 'about:blank',
      title: tab.label || 'Untitled',
      pinned: !!tab.pinned,
      essential: tab.hasAttribute('zen-essential'),
      customLabel: (typeof tab.zenStaticLabel === 'string' && tab.zenStaticLabel) ? tab.zenStaticLabel : null,
      splitGroupIndex: splitGroupMap?.get(tab) ?? null,
    };
    // Custom (user-chosen) tab icon; only small local icons (Zen's picker uses chrome:/data: SVGs)
    const icon = tab.zenStaticIcon;
    if (typeof icon === 'string' && /^(chrome|data):/.test(icon) && icon.length < 65536) item.customIcon = icon;
    if (withState) {
      item.userContextId = tab.userContextId || 0;
      try { item.sessionState = SessionStore.getTabState(tab); } catch (e) { /* not tracked yet: URL only */ }
    }
    return item;
  }

  function collectFolderTree(folder, splitGroupMap, options = {}) {
    const children = [];
    try {
      // allItems returns immediate children (tabs + nested folders), excluding
      // structural elements like zen-tab-group-start and separator
      const items = folder.allItems || [];
      for (const item of items) {
        if (item.isZenFolder) {
          children.push(collectFolderTree(item, splitGroupMap, options));
        } else if (gBrowser.isTab(item) && !item.hasAttribute('zen-empty-tab') && !(options.skipManaged && isExternallyManagedTab(item))) {
          children.push(collectTabItem(item, splitGroupMap, options));
        }
      }
    } catch (e) { reportError(`Saving the tabs of folder "${folderName(folder)}" failed`, e); }
    return {
      type: 'folder',
      name: folderName(folder),
      collapsed: !!folder.collapsed,
      children,
    };
  }

  // Session save. ZenRipple's agent tabs and pages are left out: they belong to agent
  // sessions (restored they would be ownerless copies) and ZenRipple recreates its pages.
  function collectWorkspaceLayout(wsData, { includeEssentials = true } = {}) {
    const wsId = wsData?.uuid;
    const layout = [];
    const addTab = (tab) => { if (!isExternallyManagedTab(tab)) layout.push(collectTabItem(tab, splitGroupMap)); };

    // Build split group map: tab -> groupIndex
    const splitGroupMap = new Map();
    const splitGroups = [];
    try {
      if (window.gZenViewSplitter?._data) {
        for (const group of gZenViewSplitter._data) {
          const groupTabs = (group.tabs || []).filter(t =>
            isLiveTab(t) && !isExternallyManagedTab(t) &&
            (t.getAttribute('zen-workspace-id') === wsId || t.hasAttribute('zen-essential'))
          );
          if (groupTabs.length >= 2) {
            const idx = splitGroups.length;
            splitGroups.push({ gridType: group.gridType || 'grid' });
            for (const t of groupTabs) splitGroupMap.set(t, idx);
          }
        }
      }
    } catch (e) { reportError('Saving the split views failed', e); }

    // Essential tabs are shared across workspaces (separate DOM section).
    // Collect them first so they appear at the top of the layout.
    if (includeEssentials) {
      const essentialTabs = Array.from(gBrowser.tabs).filter(t =>
        t.hasAttribute('zen-essential') && !t.hasAttribute('zen-empty-tab') && !t.hasAttribute('zen-glance-tab')
      );
      for (const tab of essentialTabs) {
        addTab(tab);
      }
    }

    // Walk workspace-specific DOM containers for folders, pinned tabs, and normal tabs
    const wsElement = window.gZenWorkspaces?.workspaceElement?.(wsId);

    if (wsElement) {
      // Pinned section: folders + standalone pinned tabs (in DOM/visual order)
      const pinnedContainer = wsElement.pinnedTabsContainer;
      if (pinnedContainer) {
        for (const child of pinnedContainer.children) {
          if (child.classList?.contains('pinned-tabs-container-separator')) continue;
          if (child.classList?.contains('zen-tab-group-start')) continue;
          if (child.classList?.contains('space-fake-collapsible-start')) continue;
          if (child.id === 'tabbrowser-arrowscrollbox-periphery') continue;
          if (child.isZenFolder) {
            layout.push(collectFolderTree(child, splitGroupMap, { skipManaged: true }));
          } else if (gBrowser.isTab(child)) {
            if (child.hasAttribute('zen-empty-tab') || child.hasAttribute('zen-glance-tab')) continue;
            if (child.hasAttribute('zen-essential')) continue; // already collected above
            addTab(child);
          } else if (gBrowser.isTabGroup(child)) {
            // Split view groups are tab-group elements (not folders) — flatten their tabs
            for (const groupChild of (child.tabs || child.children || [])) {
              if (!gBrowser.isTab(groupChild)) continue;
              if (groupChild.hasAttribute('zen-empty-tab') || groupChild.hasAttribute('zen-glance-tab')) continue;
              if (groupChild.hasAttribute('zen-essential')) continue;
              addTab(groupChild);
            }
          }
        }
      }

      // Normal section: unpinned tabs (in DOM/visual order)
      const normalContainer = wsElement.tabsContainer;
      if (normalContainer) {
        for (const child of normalContainer.children) {
          if (gBrowser.isTab(child)) {
            if (child.hasAttribute('zen-empty-tab') || child.hasAttribute('zen-glance-tab')) continue;
            addTab(child);
          } else if (gBrowser.isTabGroup(child)) {
            // Split view groups are tab-group elements (not folders) — flatten their tabs
            for (const groupChild of (child.tabs || child.children || [])) {
              if (!gBrowser.isTab(groupChild)) continue;
              if (groupChild.hasAttribute('zen-empty-tab') || groupChild.hasAttribute('zen-glance-tab')) continue;
              addTab(groupChild);
            }
          }
        }
      }
    } else {
      // Fallback: workspace element unavailable, iterate gBrowser.tabs
      const allTabs = Array.from(gBrowser.tabs);
      const wsTabs = wsId
        ? allTabs.filter(t => t.getAttribute('zen-workspace-id') === wsId && !t.hasAttribute('zen-empty-tab') && !t.hasAttribute('zen-glance-tab') && !t.hasAttribute('zen-essential'))
        : getVisibleTabs().filter(t => !t.hasAttribute('zen-essential'));
      for (const tab of wsTabs) {
        addTab(tab);
      }
    }

    const activeTab = currentTab();
    const activeTabUrl = (activeTab && activeTab.getAttribute('zen-workspace-id') === wsId && !isExternallyManagedTab(activeTab))
      ? (activeTab.linkedBrowser?.currentURI?.spec || '') : '';

    const result = {
      name: wsData?.name || 'Unnamed Workspace',
      icon: wsData?.icon || '',
      theme: wsData?.theme || null,
      activeTabUrl: activeTabUrl || getFirstTabUrl(layout),
      layout,
    };
    if (splitGroups.length > 0) result.splitGroups = splitGroups;
    return result;
  }

  function getFirstTabUrl(items) {
    for (const item of items) {
      if (item.type === 'tab') return item.url;
      if (item.type === 'folder' && item.children) {
        const url = getFirstTabUrl(item.children);
        if (url) return url;
      }
    }
    return '';
  }

  function countLayoutStats(items) {
    let tabs = 0, folders = 0, pinned = 0, essential = 0;
    for (const item of items) {
      if (item.type === 'folder') {
        folders++;
        const s = countLayoutStats(item.children || []);
        tabs += s.tabs; folders += s.folders; pinned += s.pinned; essential += s.essential;
      } else if (item.type === 'tab') {
        tabs++;
        if (item.pinned || item.essential) pinned++;
        if (item.essential) essential++;
      }
    }
    return { tabs, folders, pinned, essential };
  }

  // Get layout from workspace data (handles v1 and v2 session formats)
  function getWorkspaceLayout(ws) {
    if (!_isPlainObject(ws)) return [];
    if (Array.isArray(ws.layout)) return ws.layout;
    // Convert v1 format (flat tabs + folders arrays) to v2 layout tree
    if (!Array.isArray(ws.tabs)) return [];
    const layout = [];
    const sorted = [...ws.tabs].sort((a, b) => (a.position || 0) - (b.position || 0));
    const folderTabs = new Map();
    for (const tab of sorted) {
      if (tab.folderName) {
        if (!folderTabs.has(tab.folderName)) folderTabs.set(tab.folderName, []);
        folderTabs.get(tab.folderName).push(tab);
      }
    }
    for (const tab of sorted) {
      if (tab.essential) layout.push({ type: 'tab', url: tab.url, title: tab.title, pinned: true, essential: true });
    }
    for (const [name, tabs] of folderTabs) {
      const meta = ws.folders?.find(f => f.name === name);
      layout.push({
        type: 'folder', name, collapsed: meta?.collapsed || false,
        children: tabs.map(t => ({ type: 'tab', url: t.url, title: t.title, pinned: true, essential: false })),
      });
    }
    for (const tab of sorted) {
      if (tab.pinned && !tab.essential && !tab.folderName) layout.push({ type: 'tab', url: tab.url, title: tab.title, pinned: true, essential: false });
    }
    for (const tab of sorted) {
      if (!tab.pinned && !tab.essential && !tab.folderName) layout.push({ type: 'tab', url: tab.url, title: tab.title, pinned: false, essential: false });
    }
    return layout;
  }

  function computeSessionStats(workspaces) {
    let totalTabCount = 0, totalFolderCount = 0, totalPinnedCount = 0, totalEssentialCount = 0;
    for (const ws of workspaces) {
      const st = countLayoutStats(getWorkspaceLayout(ws));
      totalTabCount += st.tabs; totalFolderCount += st.folders;
      totalPinnedCount += st.pinned; totalEssentialCount += st.essential;
    }
    return { workspaceCount: workspaces.length, totalTabCount, totalFolderCount, totalPinnedCount, totalEssentialCount };
  }

  function collectSession(scope, comment, { autoBackup = false } = {}) {
    const timestamp = Date.now();
    const id = `session-${timestamp}`;
    const workspacesData = [];

    if (scope === 'all' && window.gZenWorkspaces) {
      const allWs = window.gZenWorkspaces.getWorkspaces();
      if (allWs && Array.isArray(allWs)) {
        // Essentials are global: record them once (with the first workspace), not per workspace
        allWs.forEach((ws, i) => workspacesData.push(collectWorkspaceLayout(ws, { includeEssentials: i === 0 })));
      }
    } else {
      let currentWs = null;
      if (window.gZenWorkspaces) {
        const activeId = gZenWorkspaces.activeWorkspace;
        const allWs = gZenWorkspaces.getWorkspaces();
        currentWs = allWs?.find(w => w.uuid === activeId) || null;
      }
      workspacesData.push(collectWorkspaceLayout(currentWs));
    }

    const session = {
      version: 2,
      id,
      savedAt: new Date(timestamp).toISOString(),
      comment: comment || '',
      scope,
      workspaces: workspacesData,
      stats: computeSessionStats(workspacesData),
    };
    if (autoBackup) session.autoBackup = true;
    return session;
  }

  // --- Save Flow ---

  function getSaveSessionScopeResults(query) {
    const results = [];
    let wsName = 'Current Workspace';
    let wsCount = 1;
    try {
      if (window.gZenWorkspaces) {
        const activeId = gZenWorkspaces.activeWorkspace;
        const allWs = gZenWorkspaces.getWorkspaces();
        const active = allWs?.find(w => w.uuid === activeId);
        if (active) wsName = active.name || wsName;
        wsCount = allWs?.length || 1;
      }
    } catch (e) {}
    results.push({ key: 'save-scope:current', label: 'Current Workspace', icon: '🗂', sublabel: wsName, tags: ['current', 'workspace'] });
    results.push({ key: 'save-scope:all', label: 'All Workspaces', icon: '📚', sublabel: `${wsCount} workspace${wsCount !== 1 ? 's' : ''}`, tags: ['all', 'workspaces'] });
    return fuzzyFilterAndSort(results, query);
  }

  function getSaveSessionInputResults(query) {
    const comment = (query || '').trim();
    if (!comment) {
      return [{ key: 'save-session:confirm', label: 'Press Enter to save (no comment)', icon: '💾', tags: [] }];
    }
    return [{ key: 'save-session:confirm', label: `Save: "${comment}"`, icon: '💾', tags: [] }];
  }

  function handleSaveSession(comment) {
    const scope = commandSubFlow?.data?.scope || 'current';
    exitSearchMode();
    if (isPrivateWindow()) {
      showZenLeapToast('Sessions are not saved from private windows');
      return;
    }
    const sessionData = collectSession(scope, comment);
    saveSessionToFile(sessionData).then(() => {
      showZenLeapToast(`Session saved (${sessionData.stats.totalTabCount} tab${sessionData.stats.totalTabCount !== 1 ? 's' : ''})`);
      log(`Session saved: ${sessionData.id} (${scope}, ${sessionData.stats.totalTabCount} tabs)`);
    }).catch(e => {
      reportError('Saving session failed', e);
      showZenLeapToast('Saving the session failed \u2014 see the Browser Console');
    });
  }

  // --- Restore Flow ---

  function formatSessionDate(isoStr) {
    try {
      const d = new Date(isoStr);
      const now = new Date();
      const diff = now - d;
      if (diff < 60000) return 'just now';
      if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
      if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
      if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
      return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined });
    } catch (e) { return isoStr; }
  }

  function buildSessionPickerResults(sessions, keyPrefix) {
    if (sessions.length === 0) {
      return [{ key: `${keyPrefix}:empty`, label: 'No saved sessions', icon: '📭', sublabel: 'Use "Save Workspace Session" to create one', tags: [] }];
    }
    return sessions.map(s => {
      const wsNames = (s.workspaces || []).map(w => w.name).join(', ') || 'Unknown';
      const commentPart = s.comment ? ` — ${s.comment}` : '';
      const label = `${wsNames}${commentPart}`;
      const scopeBadge = s.scope === 'all' ? '[all] ' : '';
      const tabCount = s.stats?.totalTabCount || 0;
      const folderCount = s.stats?.totalFolderCount || 0;
      const sublabel = `${scopeBadge}${formatSessionDate(s.savedAt)} · ${tabCount} tab${tabCount !== 1 ? 's' : ''}${folderCount > 0 ? ` · ${folderCount} folder${folderCount !== 1 ? 's' : ''}` : ''}`;
      const icon = safeIconText(s.workspaces?.[0]?.icon, '🗂');
      return {
        key: `${keyPrefix}:${s.id}`,
        label,
        sublabel,
        icon,
        tags: ['session', wsNames.toLowerCase(), (s.comment || '').toLowerCase()],
        sessionData: s,
      };
    });
  }

  // Sessions for the (synchronous) pickers: the cached list, refreshed in the background
  // when it is older than the load cache (files may have changed since). Returns null
  // while nothing has been loaded yet; the picker re-renders once loading finishes.
  function getSessionsForPicker() {
    const stale = !sessionCache || Date.now() - sessionCache.loadedAt >= 5000;
    if (stale && !sessionLoadPromise) {
      loadAllSessions().then(() => { if (commandSubFlow) renderCommandResults(); });
    }
    return sessionCache?.sessions ?? null;
  }

  function getRestoreSessionPickerResults(query) {
    const sessions = getSessionsForPicker();
    if (!sessions) return [{ key: 'restore:loading', label: 'Loading sessions...', icon: '⏳', tags: [] }];
    return fuzzyFilterAndSort(buildSessionPickerResults(sessions, 'restore-session'), query);
  }

  function getRestoreSessionModeResults(query) {
    const session = commandSubFlow?.data?.session;
    const workspaces = Array.isArray(session?.workspaces) ? session.workspaces : [];
    if (workspaces.length === 0) {
      return [{ key: 'restore-mode:invalid', label: 'This session has no workspaces to restore', icon: '\u26A0', tags: [] }];
    }
    const isMultiWs = workspaces.length > 1;
    const results = [
      { key: 'restore-mode:new', label: `Create New Workspace${isMultiWs ? 's' : ''}`, icon: '➕', sublabel: 'Opens saved tabs in new workspace(s)', tags: ['new', 'create'] },
    ];
    // Only offer replace for single-workspace sessions (and never in private windows,
    // where the automatic backup cannot be saved)
    if (!isMultiWs && !isPrivateWindow()) {
      results.push({ key: 'restore-mode:replace', label: 'Replace Current Workspace...', icon: '🔄', sublabel: 'Closes the current workspace\u2019s tabs first (a backup session is saved)', tags: ['replace', 'current'], subFlow: 'restore-replace-confirm' });
    }
    return fuzzyFilterAndSort(results, query);
  }

  // What "Replace Current Workspace" would close: folders and non-essential tabs of the
  // active workspace, except ZenRipple's agent tabs and pages (kept: the agents' work).
  function getActiveWorkspaceContents() {
    const activeWsId = window.gZenWorkspaces?.activeWorkspace;
    const folders = Array.from(gBrowser.tabContainer.querySelectorAll('zen-folder')).filter(f => {
      const fWsId = f.getAttribute('zen-workspace-id');
      return !activeWsId || !fWsId || fWsId === activeWsId;
    });
    const all = getVisibleTabs().filter(t =>
      !t.hasAttribute('zen-essential') && !t.hasAttribute('zen-empty-tab') &&
      (!activeWsId || t.getAttribute('zen-workspace-id') === activeWsId)
    );
    const tabs = all.filter(t => !isExternallyManagedTab(t));
    return { folders, tabs, kept: all.length - tabs.length };
  }

  function getRestoreReplaceConfirmResults() {
    const session = commandSubFlow?.data?.session;
    const { folders, tabs, kept } = getActiveWorkspaceContents();
    const wsName = getWorkspaceName(window.gZenWorkspaces?.activeWorkspace) || 'current workspace';
    const restoreCount = countLayoutStats(withoutZenRipplePages(getWorkspaceLayout(session?.workspaces?.[0]))).tabs;
    const plural = (n, w) => `${n} ${w}${n !== 1 ? 's' : ''}`;
    return [
      { key: 'restore-replace:cancel', label: 'Cancel', icon: '↩', sublabel: 'Keep the current workspace as it is', tags: [] },
      {
        key: 'restore-replace:confirm',
        label: `Replace "${wsName}": close ${plural(tabs.length, 'tab')}${folders.length ? ` and ${plural(folders.length, 'folder')}` : ''}`,
        icon: '🔄',
        sublabel: `Then restores ${plural(restoreCount, 'tab')}. The current tabs are saved as a backup session first.${kept ? ` ${zenRippleTabsKeptNote(kept)}.` : ''}`,
        tags: [],
      },
    ];
  }

  async function handleRestoreSession(sessionData, mode) {
    if (!sessionData || !Array.isArray(sessionData.workspaces) || sessionData.workspaces.length === 0) {
      showZenLeapToast('This session has nothing to restore');
      return;
    }
    exitSearchMode();

    try {
      if (mode === 'new') {
        for (const wsData of sessionData.workspaces) {
          await restoreWorkspaceAsNew(wsData);
        }
      } else if (mode === 'replace') {
        const wsData = sessionData.workspaces[0];
        if (getWorkspaceLayout(wsData).length === 0) {
          showZenLeapToast('Nothing to restore: the saved workspace is empty. The current workspace was not changed.');
          return;
        }
        if (isPrivateWindow()) {
          showZenLeapToast('Replacing a workspace is not available in private windows');
          return;
        }
        // Save what is about to be closed; never replace without a backup
        const label = sessionData.comment || getWorkspaceName(window.gZenWorkspaces?.activeWorkspace) || sessionData.id;
        const backup = collectSession('current', `Auto-backup before restoring "${label}"`, { autoBackup: true });
        try {
          await saveSessionToFile(backup);
        } catch (e) {
          reportError('Could not save a backup session; replace was cancelled', e);
          showZenLeapToast('Replace cancelled: the backup session could not be saved');
          return;
        }
        pruneAutoBackupSessions();
        await restoreWorkspaceReplace(wsData);
        showZenLeapToast('Workspace replaced \u2014 the previous tabs were saved as a backup session');
      }
      log(`Session restored: ${sessionData.id} (${mode})`);
    } catch (e) {
      reportError('Restoring session failed', e);
      showZenLeapToast('Restoring the session failed \u2014 see the Browser Console');
    }
  }

  // Poll for a condition to become true, with a timeout fallback.
  // Replaces fixed setTimeout sleeps in the restore pipeline for robustness:
  // finishes as soon as the condition holds (fast machines), but never hangs
  // indefinitely (slow machines).
  function waitFor(condition, { timeout = 2000, interval = 50 } = {}) {
    return new Promise((resolve) => {
      if (condition()) { resolve(true); return; }
      const start = Date.now();
      const timer = setInterval(() => {
        if (condition() || Date.now() - start >= timeout) {
          clearInterval(timer);
          resolve(condition());
        }
      }, interval);
    });
  }

  async function restoreWorkspaceAsNew(wsData) {
    if (!window.gZenWorkspaces) {
      log('gZenWorkspaces not available for restore');
      return;
    }

    const prevWsId = gZenWorkspaces.activeWorkspace;
    let name = (typeof wsData.name === 'string' && wsData.name.trim()) ? wsData.name.trim().slice(0, 100) : 'Restored';
    let icon = sanitizeSessionIcon(wsData.icon);
    // ZenRipple adopts the space with its name as its agents' space: a restored copy of
    // it gets its own name (and the default icon), never a second "ZenRipple" space.
    if (name.toLowerCase() === ZENRIPPLE_SPACE_NAME.toLowerCase()) {
      name = `${name} (restored)`;
      icon = undefined;
    }

    try {
      await gZenWorkspaces.createAndSaveWorkspace(
        name,
        icon,
        false, // dontChange = false, so it switches to the new workspace
        0      // containerTabId
      );
    } catch (e) {
      reportError('Creating a workspace for the restored session failed', e);
      return;
    }

    // Wait for workspace switch to complete (new workspace becomes active)
    await waitFor(() => gZenWorkspaces.activeWorkspace && gZenWorkspaces.activeWorkspace !== prevWsId, { timeout: 3000 });
    await restoreLayout(wsData);
  }

  async function restoreWorkspaceReplace(wsData) {
    const { folders: existingFolders, tabs: existingTabs } = getActiveWorkspaceContents();

    const placeholder = gBrowser.addTab('about:blank', {
      triggeringPrincipal: Services.scriptSecurityManager.getSystemPrincipal(),
      skipRoute: true,
    });
    // Wait for placeholder tab to be in the DOM before selecting it
    await waitFor(() => isLiveTab(placeholder));
    gBrowser.selectedTab = placeholder;

    // delete() closes the folder's tabs as one restorable group
    await Promise.all(existingFolders.map(folder =>
      Promise.resolve().then(() => folder.delete()).catch(e => reportError(`Removing folder "${folderName(folder)}" during replace failed`, e))
    ));
    // Wait for folders to be removed from the DOM
    await waitFor(() => existingFolders.every(f => !f.parentNode));

    const tabsToRemove = liveTabs(existingTabs).filter(t => t !== placeholder);
    if (tabsToRemove.length > 0) gBrowser.removeTabs(tabsToRemove);
    // Wait for old tabs to start closing / leave the DOM
    await waitFor(() => tabsToRemove.every(t => t.closing || !t.parentNode));

    await restoreLayout(wsData);

    if (isLiveTab(placeholder)) gBrowser.removeTab(placeholder);
  }

  // Space icons read from a session file: emoji text or Zen's own chrome:// SVG icons only
  function sanitizeSessionIcon(icon) {
    if (typeof icon !== 'string' || !icon || icon.length > 200 || /[<>&"'`]/.test(icon)) return undefined;
    if (isImageIcon(icon)) return /^chrome:\/\//.test(icon) ? icon : undefined;
    return icon.includes(':') ? undefined : icon;
  }

  // --- Restore: tree-based layout restoration ---

  async function restoreLayout(wsData) {
    const layout = withoutZenRipplePages(getWorkspaceLayout(wsData));
    if (!layout || layout.length === 0) return;

    const openedTabs = []; // [{ item, tab }]
    const normalTabRefs = []; // unpinned tabs for explicit reordering

    for (const item of layout) {
      if (item?.type === 'tab') {
        restoreTabItem(item, openedTabs, normalTabRefs);
      } else if (item?.type === 'folder' && window.gZenFolders) {
        await restoreFolderFromLayout(item, null, openedTabs, normalTabRefs);
      } else if (item?.type === 'folder') {
        // No folder support: open folder tabs as flat
        for (const child of flattenLayoutTabs(item)) {
          restoreTabItem(child, openedTabs, normalTabRefs);
        }
      }
    }

    // Fix unpinned tab order: addTab can insert at wrong position when
    // zen.view.show-newtab-button-top is true (every tab goes to the same
    // position, reversing order). Explicitly move them into correct order.
    if (normalTabRefs.length > 1) {
      // Wait for all normal tabs to be in the DOM before reordering
      await waitFor(() => normalTabRefs.every(isLiveTab));
      const normalContainer = gZenWorkspaces?.activeWorkspaceStrip;
      if (normalContainer) {
        for (const tab of normalTabRefs) {
          if (isLiveTab(tab)) moveTabToSectionEnd(normalContainer, tab);
        }
      }
    }

    // Verify DOM layout matches saved layout and fix remaining discrepancies.
    // Loop until order is confirmed correct (Zen may async-reorder after our moves).
    await verifyRestoredLayout(layout, openedTabs);

    // Restore split views: recreate split groups from saved data
    if (wsData.splitGroups?.length > 0 && window.gZenViewSplitter) {
      for (let i = 0; i < wsData.splitGroups.length; i++) {
        const groupInfo = wsData.splitGroups[i];
        const groupTabs = openedTabs
          .filter(o => o.item.splitGroupIndex === i)
          .map(o => o.tab)
          .filter(isLiveTab);
        if (groupTabs.length >= 2) {
          try {
            gZenViewSplitter.splitTabs(groupTabs, groupInfo.gridType);
          } catch (e) { reportError(`Restoring split view group ${i} failed`, e); }
        }
      }
    }

    // Select the tab matching activeTabUrl
    if (wsData.activeTabUrl) {
      const target = openedTabs.find(o => o.item.url === wsData.activeTabUrl)?.tab
        || Array.from(gBrowser.tabs).find(t => t.linkedBrowser?.currentURI?.spec === wsData.activeTabUrl);
      if (target && !target.closing) gBrowser.selectedTab = target;
    } else if (openedTabs.length > 0) {
      gBrowser.selectedTab = openedTabs[0].tab;
    }
  }

  function applyCustomLabel(tab, item) {
    if (typeof item.customLabel === 'string' && item.customLabel) {
      tab.zenStaticLabel = item.customLabel;
      try { gBrowser._setTabLabel(tab, item.customLabel); } catch (e) {}
    }
  }

  function applyCustomIcon(tab, item) {
    if (typeof item.customIcon === 'string' && /^(chrome|data):/.test(item.customIcon)) {
      tab.zenStaticIcon = item.customIcon;
      try { gBrowser.setIcon(tab, item.customIcon); } catch (e) {}
    }
  }

  // Open one saved tab: lazily (it loads when first selected, like Firefox's own session
  // restore), in place (skipRoute: Space Routing must not move restored tabs to other
  // spaces), never running javascript: URLs read from a file.
  function addRestoredTab(item, { tabState = false } = {}) {
    let url = typeof item.url === 'string' && item.url ? item.url : 'about:blank';
    if (/^\s*javascript:/i.test(url)) url = 'about:blank';
    const tab = gBrowser.addTab(url, {
      triggeringPrincipal: Services.scriptSecurityManager.getSystemPrincipal(),
      skipAnimation: true,
      skipRoute: true,
      createLazyBrowser: true,
      lazyTabTitle: typeof item.title === 'string' ? item.title : url,
      ...(tabState && Number.isInteger(item.userContextId) ? { userContextId: item.userContextId } : {}),
    });
    // Undo of a folder deletion: bring back the tab's history, scroll and form data
    // (the state is from this session's memory, never from a file).
    if (tabState && typeof item.sessionState === 'string') {
      try { SessionStore.setTabState(tab, item.sessionState); }
      catch (e) { reportError(`Restoring the history of "${item.title}" failed`, e); }
    }
    // Zen assigns a tab's workspace when its browser is inserted, which lazy tabs only
    // get on first selection; without this they would lose their workspace on restart.
    if (workspacesEnabled()) tab.setAttribute('zen-workspace-id', gZenWorkspaces.activeWorkspace);
    applyCustomLabel(tab, item);
    applyCustomIcon(tab, item);
    return tab;
  }

  function restoreTabItem(item, openedTabs, normalTabRefs) {
    if (item.essential) {
      const existing = Array.from(gBrowser.tabs).find(t =>
        t.hasAttribute('zen-essential') && t.linkedBrowser?.currentURI?.spec === item.url
      );
      if (existing) {
        openedTabs.push({ item, tab: existing });
        return;
      }
      const tab = addRestoredTab(item);
      // Zen's API enforces the essentials limit / container rules and notifies window sync
      let added = false;
      try {
        if (window.gZenPinnedTabManager?.canEssentialBeAdded(tab)) added = gZenPinnedTabManager.addToEssentials(tab) !== false;
      } catch (e) { reportError('Restoring an essential tab failed', e); }
      if (!added) {
        gBrowser.pinTab(tab);
        log(`Could not add "${item.title}" to essentials (limit reached?); restored as a pinned tab`);
      }
      openedTabs.push({ item, tab });
    } else if (item.pinned) {
      const tab = addRestoredTab(item);
      gBrowser.pinTab(tab);
      openedTabs.push({ item, tab });
    } else {
      const tab = addRestoredTab(item);
      openedTabs.push({ item, tab });
      normalTabRefs.push(tab);
    }
  }

  // Append a tab at the end of a workspace's normal section through Tabbrowser, so its
  // tab caches, TabMove (SessionStore, window sync) and Zen's invariants stay consistent.
  function moveTabToSectionEnd(container, tab) {
    const periphery = container.querySelector('#tabbrowser-arrowscrollbox-periphery');
    gBrowser.zenHandleTabMove(tab, () => {
      if (periphery) container.insertBefore(tab, periphery);
      else container.appendChild(tab);
    });
  }

  // options.tabState: apply the tabs' saved SessionStore state (folder-delete undo)
  async function restoreFolderFromLayout(folderItem, insertAfterElement, openedTabs, normalTabRefs, options = {}) {
    // Phase 1: create direct tab children, defer subfolders
    const directTabRefs = [];
    const childItems = []; // { type: 'tab'|'folder', ref?, data? }

    for (const child of (Array.isArray(folderItem.children) ? folderItem.children : [])) {
      if (child?.type === 'tab') {
        const tab = addRestoredTab(child, options);
        directTabRefs.push(tab);
        openedTabs.push({ item: child, tab });
        childItems.push({ type: 'tab', ref: tab });
      } else if (child?.type === 'folder') {
        childItems.push({ type: 'folder', data: child, ref: null });
      }
    }

    // Wait for all folder tabs to be present in the DOM before creating the folder
    await waitFor(() => directTabRefs.every(isLiveTab));

    // Phase 2: create folder with its direct tabs
    const folderOpts = {
      label: (typeof folderItem.name === 'string' && folderItem.name) ? folderItem.name.slice(0, 100) : 'Restored Folder',
      renameFolder: false,
      collapsed: false, // expand first, collapse after children are placed
    };
    if (insertAfterElement) {
      folderOpts.insertAfter = insertAfterElement;
    }

    let folder;
    try {
      folder = gZenFolders.createFolder(directTabRefs, folderOpts);
    } catch (e) {
      reportError(`Restoring folder "${folderOpts.label}" failed`, e);
      return null;
    }

    // Wait for the folder element to be present in the DOM
    await waitFor(() => folder && folder.parentNode);

    // Phase 3: insert subfolders at correct positions.
    // Walk children in saved order, tracking the last DOM element so we can
    // position each subfolder right after the previous sibling.
    let lastElement = null;
    for (const childItem of childItems) {
      if (childItem.type === 'tab') {
        lastElement = childItem.ref;
      } else if (childItem.type === 'folder') {
        const subInsertAfter = lastElement || folder.groupStartElement;
        const subFolder = await restoreFolderFromLayout(
          childItem.data, subInsertAfter, openedTabs, normalTabRefs, options
        );
        if (subFolder) lastElement = subFolder;
      }
    }

    // Collapse after all children are in place (Zen needs a tick to measure heights)
    if (folderItem.collapsed) {
      setTimeout(() => { try { folder.collapsed = true; } catch (e) {} }, 0);
    }

    return folder;
  }

  // Sessions saved by older versions can hold ZenRipple's pages (dashboard, session
  // pages): ZenRipple recreates those itself, a restored copy would be a duplicate.
  function withoutZenRipplePages(items) {
    const out = [];
    for (const item of items || []) {
      if (item?.type === 'tab' && typeof item.url === 'string' && item.url.startsWith(ZENRIPPLE_PAGES_PREFIX)) continue;
      out.push(item?.type === 'folder' ? { ...item, children: withoutZenRipplePages(item.children) } : item);
    }
    return out;
  }

  function flattenLayoutTabs(item) {
    const tabs = [];
    if (item.type === 'tab') {
      tabs.push(item);
    } else if (item.type === 'folder' && item.children) {
      for (const child of item.children) {
        tabs.push(...flattenLayoutTabs(child));
      }
    }
    return tabs;
  }

  // Verify restored layout matches saved order by checking the sidebar DOM.
  // Loops until order is confirmed correct or max attempts reached, because
  // Zen may asynchronously reorder tabs after our DOM moves; each attempt ends
  // as soon as the order is right.
  async function verifyRestoredLayout(layout, openedTabs) {
    const MAX_ATTEMPTS = 5;
    const ATTEMPT_TIMEOUT_MS = 500;

    try {
      const wsElement = gZenWorkspaces?.activeWorkspaceElement;
      if (!wsElement) return;

      const normalContainer = wsElement.tabsContainer;
      if (!normalContainer) return;

      // The restored unpinned tabs, in saved order. Compared by element, not URL: the
      // same URL can be saved more than once.
      const expectedTabRefs = [];
      for (const { item, tab } of openedTabs) {
        if (!item.pinned && !item.essential && tab && !tab.closing) expectedTabRefs.push(tab);
      }
      if (expectedTabRefs.length === 0) {
        log('Verify: no normal tabs to verify');
        return;
      }
      const expectedSet = new Set(expectedTabRefs);

      // Only the restored tabs' relative order matters: Replace's placeholder tab and
      // old tabs that are still closing share the container for a moment.
      function firstMismatch() {
        const actual = [...normalContainer.children].filter(c => expectedSet.has(c));
        if (actual.length < expectedTabRefs.length) return actual.length;
        return expectedTabRefs.findIndex((tab, i) => actual[i] !== tab);
      }

      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        // Wait for order to become correct (exits early if Zen finishes reorder)
        const settled = await waitFor(() => firstMismatch() === -1, { timeout: ATTEMPT_TIMEOUT_MS });
        if (settled) {
          log(`Verify: order confirmed correct on attempt ${attempt}`);
          return;
        }
        log(`Verify: attempt ${attempt}: restored tab ${firstMismatch()} of ${expectedTabRefs.length} is out of place, reordering`);
        for (const tab of expectedTabRefs) {
          if (isLiveTab(tab)) moveTabToSectionEnd(normalContainer, tab);
        }
      }

      console.warn(`[ZenLeap] Restored tabs may not be in their saved order (still different after ${MAX_ATTEMPTS} attempts)`);
    } catch (e) {
      console.warn('[ZenLeap] Checking the restored tab order failed:', e);
    }
  }

  // --- List / Detail Flow ---

  function getListSessionsPickerResults(query) {
    const sessions = getSessionsForPicker();
    if (!sessions) return [{ key: 'list:loading', label: 'Loading sessions...', icon: '⏳', tags: [] }];
    return fuzzyFilterAndSort(buildSessionPickerResults(sessions, 'list-session'), query);
  }

  function getSessionDetailViewResults(query) {
    const session = commandSubFlow?.data?.session;
    if (!session) return [{ key: 'detail:error', label: 'No session data', icon: '⚠', tags: [] }];

    const results = [];

    // Header with session info
    const dateStr = formatSessionDate(session.savedAt);
    const workspaces = Array.isArray(session.workspaces) ? session.workspaces : [];
    const stats = _isPlainObject(session.stats) ? session.stats : computeSessionStats(workspaces);
    results.push({
      key: 'detail:info',
      label: `${session.comment || 'No comment'} — saved ${dateStr}`,
      icon: '💾',
      sublabel: `${stats.totalTabCount} tabs · ${stats.workspaceCount} workspace${stats.workspaceCount !== 1 ? 's' : ''}`,
      tags: [],
    });

    workspaces.forEach((ws, wsIdx) => {
      if (workspaces.length > 1) {
        const wsLayout = getWorkspaceLayout(ws);
        const wsTabCount = wsLayout ? countLayoutStats(wsLayout).tabs : 0;
        results.push({
          key: `detail:ws-${wsIdx}`,
          label: String(ws?.name || 'Unnamed'),
          icon: safeIconText(ws?.icon, '🗂'),
          sublabel: `${wsTabCount} tabs`,
          tags: [],
          isHeader: true,
        });
      }

      // Render the layout tree — mirrors actual tab strip structure
      const layout = getWorkspaceLayout(ws);
      if (layout && layout.length > 0) {
        buildDetailItemsFromLayout(layout, results, 0);
      } else {
        results.push({ key: `detail:empty-${wsIdx}`, label: 'No tabs', icon: '', tags: [] });
      }
    });

    // Footer hint
    results.push({
      key: 'detail:footer',
      label: 'Enter to restore · d to delete',
      icon: '',
      sublabel: '',
      tags: [],
      isHeader: true,
    });

    return results;
  }

  function buildDetailItemsFromLayout(layout, results, depth) {
    const indent = '\u00A0\u00A0\u00A0'.repeat(depth); // non-breaking spaces per depth level

    for (const item of layout) {
      if (item.type === 'folder') {
        const tabCount = countLayoutItemTabs(item);
        const collapsedTag = item.collapsed ? ' [collapsed]' : '';
        results.push({
          key: `detail:folder-${depth}-${item.name}-${results.length}`,
          label: `${indent}📁 ${item.name} (${tabCount} tab${tabCount !== 1 ? 's' : ''})${collapsedTag}`,
          icon: '',
          tags: [],
          isHeader: true,
        });
        if (item.children && item.children.length > 0) {
          buildDetailItemsFromLayout(item.children, results, depth + 1);
        }
      } else if (item.type === 'tab') {
        const prefix = item.essential ? '⭐ ' : item.pinned ? '📌 ' : '';
        const displayTitle = item.customLabel || item.title;
        const labelSuffix = item.customLabel ? ` (${item.title})` : '';
        results.push({
          key: `detail:tab-${depth}-${results.length}`,
          label: `${indent}${prefix}${displayTitle}${labelSuffix}`,
          sublabel: item.url,
          icon: '',
          tags: [],
        });
      }
    }
  }

  function countLayoutItemTabs(item) {
    if (item.type === 'tab') return 1;
    if (item.type === 'folder') {
      let count = 0;
      for (const child of (item.children || [])) {
        count += countLayoutItemTabs(child);
      }
      return count;
    }
    return 0;
  }

  // Cancel first and preselected, like every destructive confirmation (REV-LCMDS-09)
  function getDeleteSessionConfirmResults() {
    const sessionId = commandSubFlow?.data?.sessionId;
    return [
      { key: 'delete-session:cancel', label: 'Cancel', icon: '↩', sublabel: 'Keep this session', tags: [] },
      { key: 'delete-session:confirm', label: 'Delete this session permanently', icon: '🗑', sublabel: sessionId || '', tags: [] },
    ];
  }

  // ============================================
  // UPDATE SYSTEM
  // ============================================

  // Self-update (disabled for Sine installs). The latest GitHub *release* is found via
  // the releases API; the script is downloaded ONCE from that tag, verified against the
  // tag's CHECKSUMS.sha256 (sha256sum format) and its @version, then written atomically
  // over the file this script was loaded from, keeping the previous file as .bak.
  // Releases without a checksum entry are never auto-installed.
  const ZENLEAP_REPO = 'yashas-salankimatt/ZenLeap';
  const ZENLEAP_RELEASE_API_URL = `https://api.github.com/repos/${ZENLEAP_REPO}/releases/latest`;
  const ZENLEAP_RAW_BASE_URL = `https://raw.githubusercontent.com/${ZENLEAP_REPO}`;
  const ZENLEAP_SCRIPT_REPO_PATH = 'JS/zenleap.uc.js';
  const UPDATE_MAX_BYTES = 10 * 1024 * 1024;
  const UPDATE_AVAILABLE_TOPIC = 'zenleap-update-available';
  // URL this script was loaded from (e.g. chrome://userscripts/content/zenleap.uc.js)
  const ZENLEAP_LOADED_FROM = (() => { try { return Components.stack.filename || ''; } catch (e) { return ''; } })();

  let updateModal = null;
  let updateMode = false;
  let updateModalState = null; // 'checking' | 'available' | 'progress' | 'success' | 'error' | 'uptodate'
  let updateToast = null;
  let updateToastVersion = null;
  let updateStylesInjected = false;

  // Detect Sine package manager install (disables self-update when found)
  async function detectSineInstall() {
    try {
      const sinePath = PathUtils.join(
        PathUtils.profileDir, 'chrome', 'sine-mods', 'zenleap-relative-tab-nav'
      );
      isSineManaged = await IOUtils.exists(sinePath);
      if (isSineManaged) log('Sine-managed installation detected — self-update disabled');
    } catch (e) {
      log(`Sine detection failed (non-critical): ${e}`);
      isSineManaged = false;
    }
  }

  // Parse version from script content (matches @version X.Y.Z)
  function parseVersionFromContent(content) {
    const match = content.match(/@version\s+([0-9.]+)/);
    return match ? match[1] : null;
  }

  // Compare dotted versions ("3.10.0" > "3.9.1"; a leading "v" is ignored; a
  // pre-release suffix sorts before its release: "3.5.0-beta" < "3.5.0").
  // Returns -1, 0, 1, or NaN when either side is unreadable.
  function compareVersions(v1, v2) {
    const parse = (v) => {
      const m = String(v ?? '').trim().match(/^v?(\d+(?:\.\d+)*)(-[0-9A-Za-z.-]+)?$/);
      return m ? { parts: m[1].split('.').map(Number), pre: !!m[2] } : null;
    };
    const a = parse(v1), b = parse(v2);
    if (!a || !b) return NaN;
    for (let i = 0; i < Math.max(a.parts.length, b.parts.length); i++) {
      const x = a.parts[i] || 0;
      const y = b.parts[i] || 0;
      if (x !== y) return x > y ? 1 : -1;
    }
    if (a.pre !== b.pre) return a.pre ? -1 : 1;
    return 0;
  }

  // true if v1 >= v2 (false when either version is unreadable)
  function versionGte(v1, v2) {
    return compareVersions(v1, v2) >= 0;
  }

  // Parse changelog for a specific version from CHANGELOG.md content
  function parseChangelog(content, targetVersion) {
    const lines = content.split('\n');
    const items = [];
    let inSection = false;

    for (const line of lines) {
      // Match version headers like "## 2.9.0" or "## [2.9.0]" or "## v2.9.0"
      const headerMatch = line.match(/^##\s+\[?v?([0-9.]+)\]?/);
      if (headerMatch) {
        if (inSection) break; // We've passed our section
        if (headerMatch[1] === targetVersion) inSection = true;
        continue;
      }

      if (inSection && line.trim().startsWith('-')) {
        const text = line.trim().replace(/^-\s*/, '');
        // Detect tag: **New:** or **Fix:** or **Improved:** etc.
        const tagMatch = text.match(/^\*\*(\w+)[:\*]+\*?\*?\s*/);
        let tag = '';
        let desc = text;
        if (tagMatch) {
          tag = tagMatch[1].toLowerCase();
          desc = text.slice(tagMatch[0].length);
        }
        items.push({ tag, desc });
      }
    }
    return items;
  }

  // HTTP GET via XMLHttpRequest. responseType 'arraybuffer' resolves to a Uint8Array.
  function httpGet(url, { timeoutMs = 15000, responseType = 'text', headers = {} } = {}) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('GET', url, true);
      xhr.timeout = timeoutMs;
      xhr.responseType = responseType;
      for (const [k, v] of Object.entries(headers)) xhr.setRequestHeader(k, v);
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(responseType === 'arraybuffer' ? new Uint8Array(xhr.response) : xhr.response);
        } else {
          const err = new Error(`HTTP ${xhr.status} for ${url}`);
          err.status = xhr.status;
          reject(err);
        }
      };
      xhr.onerror = () => reject(new Error(`Network error for ${url}`));
      xhr.ontimeout = () => reject(new Error(`Request timed out: ${url}`));
      xhr.send();
    });
  }

  // Latest published release: { tag, version }. The tag is validated because it becomes
  // part of the download URLs.
  async function fetchLatestRelease() {
    const text = await httpGet(ZENLEAP_RELEASE_API_URL, { headers: { Accept: 'application/vnd.github+json' } });
    let data;
    try { data = JSON.parse(text); } catch (e) { throw new Error('Unreadable response from the GitHub releases API'); }
    const tag = typeof data?.tag_name === 'string' ? data.tag_name.trim() : '';
    if (!/^v?\d+(\.\d+){1,3}$/.test(tag)) throw new Error(`Unexpected release tag "${tag}"`);
    return { tag, version: tag.replace(/^v/i, '') };
  }

  // Expected SHA-256 for repoPath from a sha256sum-style file ("<hex>  <path>").
  function findChecksum(checksumsText, repoPath) {
    for (const line of String(checksumsText || '').split(/\r?\n/)) {
      const m = line.trim().match(/^([0-9a-fA-F]{64})\s+\*?(?:\.\/)?(\S.*)$/);
      if (m && m[2].trim() === repoPath) return m[1].toLowerCase();
    }
    return null;
  }

  async function sha256Hex(bytes) {
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
  }

  // File the running script was loaded from, so an update replaces it (never a second
  // copy that loads next to it). Falls back to <profile>/chrome/JS/zenleap.uc.js.
  function resolveRunningScriptPath() {
    const fallback = PathUtils.join(PathUtils.profileDir, 'chrome', 'JS', 'zenleap.uc.js');
    try {
      let uri = Services.io.newURI(ZENLEAP_LOADED_FROM.replace(/[?#].*$/, ''));
      if (uri.schemeIs('chrome')) {
        uri = Cc['@mozilla.org/chrome/chrome-registry;1'].getService(Ci.nsIChromeRegistry).convertChromeURL(uri);
      }
      if (uri.schemeIs('file')) {
        const path = uri.QueryInterface(Ci.nsIFileURL).file.path;
        if (/\.uc\.js$/i.test(path)) return path;
      }
    } catch (e) { console.warn(`[ZenLeap] Could not resolve the running script's path (${ZENLEAP_LOADED_FROM}); updates go to chrome/JS/zenleap.uc.js:`, e); }
    return fallback;
  }

  // Check for updates — returns { available, remoteVersion, tag, changelog[] } or null on error
  async function checkForZenLeapUpdate() {
    try {
      const { tag, version } = await fetchLatestRelease();
      const available = compareVersions(version, VERSION) > 0;

      // Fetch changelog (best-effort)
      let changelog = [];
      if (available) {
        try {
          const clContent = await httpGet(`${ZENLEAP_RAW_BASE_URL}/${tag}/CHANGELOG.md`);
          changelog = parseChangelog(clContent, version);
        } catch (e) { /* changelog fetch failed, non-critical */ }
      }

      return { available, remoteVersion: version, tag, changelog };
    } catch (e) {
      console.warn('[ZenLeap] Update check failed:', e);
      return null;
    }
  }

  // Download, verify and install the latest release.
  // Callback: onProgress('downloading' | 'verifying' | 'installing-js' | 'done' | 'error', detail?)
  async function downloadAndInstallUpdate(onProgress) {
    // Hard block: Sine-managed installs must never self-update
    if (isSineManaged) {
      const msg = 'Self-update is disabled — this installation is managed by Sine';
      log(msg);
      onProgress('error', msg);
      return { success: false, error: msg };
    }

    let partPath = null;
    try {
      onProgress('downloading', 'Looking up the latest release');
      const { tag, version } = await fetchLatestRelease();
      if (compareVersions(version, VERSION) <= 0) throw new Error(`The latest release (${version}) is not newer than ${VERSION}`);

      // --- Download the script once; these exact bytes are verified and installed ---
      onProgress('downloading', `Downloading zenleap.uc.js ${tag}`);
      const bytes = await httpGet(`${ZENLEAP_RAW_BASE_URL}/${tag}/${ZENLEAP_SCRIPT_REPO_PATH}`, { responseType: 'arraybuffer', timeoutMs: 60000 });
      if (bytes.length === 0 || bytes.length > UPDATE_MAX_BYTES) throw new Error(`Unexpected download size (${bytes.length} bytes)`);

      onProgress('verifying', 'Verifying checksum');
      let checksums = '';
      try {
        checksums = await httpGet(`${ZENLEAP_RAW_BASE_URL}/${tag}/CHECKSUMS.sha256`);
      } catch (e) {
        if (e.status !== 404) throw e;
      }
      const expected = findChecksum(checksums, ZENLEAP_SCRIPT_REPO_PATH);
      if (!expected) {
        throw new Error(`Release ${tag} has no published checksum for ${ZENLEAP_SCRIPT_REPO_PATH}, so it cannot be installed automatically. Update with the installer instead.`);
      }
      const actual = await sha256Hex(bytes);
      if (actual !== expected) throw new Error(`Checksum mismatch for ${tag} (expected ${expected.slice(0, 12)}…, got ${actual.slice(0, 12)}…). Nothing was installed.`);

      let text;
      try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
      catch (e) { throw new Error('Downloaded script is not valid UTF-8'); }
      const fileVersion = parseVersionFromContent(text);
      if (fileVersion !== version) throw new Error(`Downloaded script is version ${fileVersion || '(none)'}, but release ${tag} was expected. Nothing was installed.`);

      // --- Install over the running script: backup, atomic write, verify, roll back on failure ---
      const jsPath = resolveRunningScriptPath();
      const backupPath = `${jsPath}.bak`;
      partPath = `${jsPath}.part`;
      onProgress('installing-js', `Writing ${PathUtils.filename(jsPath)}`);
      await IOUtils.makeDirectory(PathUtils.parent(jsPath), { createAncestors: true, ignoreExisting: true });
      const hadOriginal = await IOUtils.exists(jsPath);
      if (hadOriginal) await IOUtils.copy(jsPath, backupPath);
      let replaced = false;
      try {
        await IOUtils.write(jsPath, bytes, { tmpPath: partPath });
        replaced = true; // the temp file was renamed over the script
        const written = await IOUtils.read(jsPath);
        if (await sha256Hex(written) !== expected) throw new Error('The installed file does not match the verified download');
      } catch (e) {
        // A failed write never touched the script (the rename is the last step),
        // so only a replaced file is restored, again through a temp file + rename:
        // copying over it would truncate it first, and on a full disk leave it
        // empty (REV-LCMDS-02).
        if (replaced && hadOriginal) {
          try { await IOUtils.write(jsPath, await IOUtils.read(backupPath), { tmpPath: partPath }); }
          catch (restoreError) { reportError(`Update: restoring the previous version from ${backupPath} failed`, restoreError); }
        }
        throw new Error(`Writing the update failed (${e.message}); the previous version was kept.`);
      }
      log(`Updated ${jsPath} to v${version} (previous version saved as ${PathUtils.filename(backupPath)})`);

      onProgress('done', version);
      return { success: true, version, path: jsPath, backupPath: hadOriginal ? backupPath : null };
    } catch (e) {
      reportError('Update install failed', e);
      onProgress('error', e.message);
      return { success: false, error: e.message };
    } finally {
      if (partPath) IOUtils.remove(partPath, { ignoreAbsent: true }).catch(() => {});
    }
  }

  // Should we auto-check based on settings? S mirrors the shared pref, so a check done
  // by another window moments ago is visible here.
  function shouldAutoCheckForUpdates() {
    if (!S['updates.autoCheck']) return false;
    const freq = S['updates.checkFrequency'];
    const lastCheck = S['updates.lastCheckTime'] || 0;
    const now = Date.now();

    if (freq === 'startup') {
      // Once per browser session (not once per window)
      let processStart = 0;
      try { processStart = Services.startup.getStartupInfo().process?.getTime() || 0; } catch (e) {}
      return lastCheck < processStart;
    }
    if (freq === 'daily') return (now - lastCheck) > 24 * 60 * 60 * 1000;
    if (freq === 'weekly') return (now - lastCheck) > 7 * 24 * 60 * 60 * 1000;
    return false;
  }

  // ============================================
  // UPDATE MODAL UI
  // ============================================

  function createUpdateModal() {
    if (updateModal) return;

    const modal = document.createElement('div');
    modal.id = 'zenleap-update-modal';

    const backdrop = document.createElement('div');
    backdrop.id = 'zenleap-update-backdrop';
    backdrop.addEventListener('click', () => exitUpdateMode());

    const container = document.createElement('div');
    container.id = 'zenleap-update-container';

    // Header
    const header = document.createElement('div');
    header.className = 'zenleap-update-header';
    const title = updateEl('h2', null, 'Checking for Updates');
    title.id = 'zenleap-update-title';
    const subtitle = updateEl('span', 'zenleap-update-subtitle', 'Contacting GitHub...');
    subtitle.id = 'zenleap-update-subtitle';
    header.appendChild(updateEl('div', null, title, subtitle));
    const closeBtn = document.createElement('button');
    closeBtn.className = 'zenleap-update-close-btn';
    closeBtn.title = 'Close';
    closeBtn.textContent = '\u2715';
    closeBtn.addEventListener('click', () => exitUpdateMode());
    header.appendChild(closeBtn);

    // Body (states rendered dynamically)
    const body = document.createElement('div');
    body.id = 'zenleap-update-body';

    container.appendChild(header);
    container.appendChild(body);
    modal.appendChild(backdrop);
    modal.appendChild(container);

    ensureUpdateStyles();
    document.documentElement.appendChild(modal);

    updateModal = modal;
  }

  function ensureUpdateStyles() {
    if (updateStylesInjected) return;
    updateStylesInjected = true;

    injectStyleBlock('zenleap-update-styles', `
      #zenleap-update-modal {
        position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
        z-index: 100002; display: none; justify-content: center; align-items: center; padding: 20px;
      }
      #zenleap-update-modal.active { display: flex; }
      #zenleap-update-backdrop {
        position: absolute; top: 0; left: 0; width: 100%; height: 100%;
        background: var(--zl-backdrop); backdrop-filter: var(--zl-blur);
      }
      #zenleap-update-container {
        position: relative; width: 95%; max-width: 480px;
        background: var(--zl-bg-surface); border-radius: var(--zl-r-xl);
        box-shadow: var(--zl-shadow-modal); border: 1px solid var(--zl-border-subtle);
        overflow: hidden; display: flex; flex-direction: column;
        animation: zenleap-modal-enter 0.35s cubic-bezier(0.16, 1, 0.3, 1);
      }
      .zenleap-update-header {
        padding: 20px 24px 16px; border-bottom: 1px solid var(--zl-border-subtle);
        display: flex; justify-content: space-between; align-items: flex-start;
      }
      .zenleap-update-header h2 {
        margin: 0; font-size: 18px; font-weight: 700; color: var(--zl-accent);
      }
      .zenleap-update-subtitle {
        display: block; margin-top: 4px; font-size: 12px; color: var(--zl-text-secondary);
      }
      .zenleap-update-close-btn {
        background: none; border: none; color: var(--zl-text-muted); font-size: 18px; cursor: pointer;
        padding: 4px 8px; border-radius: var(--zl-r-sm); transition: all 0.15s; line-height: 1;
      }
      .zenleap-update-close-btn:hover { color: var(--zl-text-primary); background: var(--zl-bg-hover); }

      /* Version pills */
      .zenleap-update-versions {
        display: flex; align-items: center; gap: 16px;
        padding: 20px 24px; border-bottom: 1px solid var(--zl-border-subtle);
      }
      .zenleap-version-pill {
        flex: 1; display: flex; flex-direction: column; align-items: center; gap: 6px;
        padding: 14px 12px; border-radius: var(--zl-r-md);
        background: var(--zl-bg-raised); border: 1px solid var(--zl-border-subtle);
      }
      .zenleap-version-pill-label {
        font-size: 10px; font-weight: 600; text-transform: uppercase;
        letter-spacing: 0.8px; color: var(--zl-text-muted);
      }
      .zenleap-version-pill-number {
        font-size: 22px; font-weight: 700; font-family: var(--zl-font-mono); color: var(--zl-text-secondary);
      }
      .zenleap-version-pill.new .zenleap-version-pill-number { color: var(--zl-success); }
      .zenleap-version-pill.new {
        border-color: rgba(152,195,121,0.2); background: rgba(152,195,121,0.1);
      }
      .zenleap-version-arrow { font-size: 20px; color: var(--zl-text-muted); flex-shrink: 0; }

      /* Changelog */
      .zenleap-update-changelog {
        padding: 16px 24px; border-bottom: 1px solid var(--zl-border-subtle);
        max-height: 180px; overflow-y: auto;
      }
      .zenleap-update-changelog { scrollbar-width: thin; scrollbar-color: var(--zl-border-strong) transparent; }
      .zenleap-update-changelog h3 {
        font-size: 11px; font-weight: 600; text-transform: uppercase;
        letter-spacing: 0.8px; color: var(--zl-accent); margin: 0 0 10px;
      }
      .zenleap-update-changelog-item {
        display: flex; align-items: flex-start; gap: 8px; padding: 4px 0;
        font-size: 13px; color: var(--zl-text-primary); line-height: 1.4;
      }
      .zenleap-changelog-tag {
        font-size: 10px; font-weight: 600; padding: 1px 6px; border-radius: var(--zl-r-sm);
        text-transform: uppercase; letter-spacing: 0.3px; flex-shrink: 0; margin-top: 2px;
      }
      .zenleap-changelog-tag.new { background: rgba(152,195,121,0.2); color: var(--zl-success); }
      .zenleap-changelog-tag.fix { background: rgba(224,108,117,0.2); color: var(--zl-error); }
      .zenleap-changelog-tag.improved { background: var(--zl-accent-20); color: var(--zl-accent); }
      .zenleap-changelog-tag.changed { background: rgba(229,192,123,0.2); color: var(--zl-warning); }

      /* Actions */
      .zenleap-update-actions {
        padding: 16px 24px; display: flex; gap: 10px; justify-content: flex-end;
      }
      .zenleap-update-btn {
        border: none; font-family: var(--zl-font-ui);
        font-size: 13px; font-weight: 500; padding: 8px 20px; border-radius: var(--zl-r-md);
        cursor: pointer; transition: all 0.15s;
      }
      .zenleap-update-btn.secondary {
        background: var(--zl-bg-raised); color: var(--zl-text-secondary);
        border: 1px solid var(--zl-border-subtle);
      }
      .zenleap-update-btn.secondary:hover { background: var(--zl-bg-hover); color: var(--zl-text-primary); }
      .zenleap-update-btn.primary {
        background: var(--zl-accent-20); color: var(--zl-accent);
        border: 1px solid var(--zl-accent-border);
      }
      .zenleap-update-btn.primary:hover { background: var(--zl-accent-40); border-color: var(--zl-accent); }
      .zenleap-update-btn.restart {
        background: color-mix(in srgb, var(--zl-success) 20%, transparent); color: var(--zl-success);
        border: 1px solid color-mix(in srgb, var(--zl-success) 30%, transparent);
      }
      .zenleap-update-btn.restart:hover { background: color-mix(in srgb, var(--zl-success) 30%, transparent); border-color: color-mix(in srgb, var(--zl-success) 50%, transparent); }
      .zenleap-update-btn kbd {
        display: inline-block; font-family: var(--zl-font-mono); font-size: 10px; font-weight: 600;
        background: var(--zl-bg-elevated); padding: 1px 5px; border-radius: var(--zl-r-sm);
        margin-left: 6px; opacity: 0.7;
      }

      /* Progress */
      .zenleap-update-progress {
        padding: 28px 24px; display: flex; flex-direction: column; align-items: center; gap: 16px;
      }
      .zenleap-update-progress-status { font-size: 14px; font-weight: 500; color: var(--zl-text-primary); }
      .zenleap-update-progress-bar-track {
        width: 100%; height: 4px; background: var(--zl-bg-raised);
        border-radius: 2px; overflow: hidden;
      }
      .zenleap-update-progress-bar-fill {
        height: 100%; background: var(--zl-accent); border-radius: 2px;
        transition: width 0.3s ease; box-shadow: 0 0 8px var(--zl-accent-40);
      }
      .zenleap-update-progress-bar-fill.indeterminate {
        width: 40% !important;
        animation: zenleap-progress-slide 1.2s ease-in-out infinite;
      }
      @keyframes zenleap-progress-slide {
        0%   { transform: translateX(-100%); }
        100% { transform: translateX(350%); }
      }
      .zenleap-update-progress-detail { font-size: 11px; color: var(--zl-text-muted); }

      /* Result states */
      .zenleap-update-result {
        padding: 28px 24px; display: flex; flex-direction: column;
        align-items: center; gap: 12px; text-align: center;
      }
      .zenleap-update-result-icon {
        width: 48px; height: 48px; border-radius: 50%;
        display: flex; align-items: center; justify-content: center; font-size: 22px;
        animation: zenleap-result-pop 0.3s ease-out;
      }
      @keyframes zenleap-result-pop {
        0%   { transform: scale(0); opacity: 0; }
        60%  { transform: scale(1.15); }
        100% { transform: scale(1); opacity: 1; }
      }
      .zenleap-update-result-icon.success {
        background: rgba(152,195,121,0.1); border: 2px solid rgba(152,195,121,0.3);
      }
      .zenleap-update-result-icon.error {
        background: rgba(224,108,117,0.2); border: 2px solid rgba(224,108,117,0.3);
      }
      .zenleap-update-result-icon.uptodate {
        background: var(--zl-accent-dim); border: 2px solid var(--zl-accent-border);
      }
      .zenleap-update-result-title { font-size: 16px; font-weight: 600; }
      .zenleap-update-result-title.success { color: var(--zl-success); }
      .zenleap-update-result-title.error { color: var(--zl-error); }
      .zenleap-update-result-title.uptodate { color: var(--zl-accent); }
      .zenleap-update-result-detail { font-size: 12px; color: var(--zl-text-secondary); line-height: 1.5; }

      /* Toast notification — centered bottom bar */
      #zenleap-update-toast {
        position: fixed; bottom: 32px; left: 50%; transform: translateX(-50%);
        z-index: 100001;
        background: var(--zl-bg-surface);
        border: 1px solid var(--zl-border-subtle);
        border-radius: var(--zl-r-md); padding: 10px 20px;
        box-shadow: var(--zl-shadow-modal);
        animation: zenleap-toast-in 0.3s ease-out;
        display: flex; align-items: center; gap: 12px;
        backdrop-filter: var(--zl-blur);
        white-space: nowrap;
      }
      @keyframes zenleap-toast-in {
        from { opacity: 0; transform: translateX(-50%) translateY(12px); }
        to   { opacity: 1; transform: translateX(-50%) translateY(0); }
      }
      @keyframes zenleap-toast-out {
        from { opacity: 1; transform: translateX(-50%) translateY(0); }
        to   { opacity: 0; transform: translateX(-50%) translateY(12px); }
      }
      .zenleap-toast-text {
        font-size: 13px; color: var(--zl-text-primary);
      }
      .zenleap-toast-text strong { color: var(--zl-accent); font-weight: 600; }
      .zenleap-toast-btn {
        font-family: var(--zl-font-ui); font-size: 12px; font-weight: 600; cursor: pointer;
        padding: 4px 12px; border-radius: var(--zl-r-sm);
        background: transparent; color: var(--zl-text-primary);
        border: 1px solid var(--zl-border-strong);
      }
      .zenleap-toast-btn:hover { background: var(--zl-bg-elevated); }
      .zenleap-toast-btn.primary {
        background: var(--zl-accent-dim); color: var(--zl-accent); border-color: var(--zl-accent-border);
      }
      .zenleap-toast-btn.primary:hover { background: var(--zl-accent-mid); }
    `);
  }

  // Build an element with class and children (strings become text nodes). The chrome
  // document is XHTML, where innerHTML with HTML-only markup such as <br> throws.
  function updateEl(tag, className, ...children) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    for (const child of children) {
      if (child == null) continue;
      el.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
    }
    return el;
  }

  function setUpdateHeader(title, subtitle) {
    const titleEl = document.getElementById('zenleap-update-title');
    const subtitleEl = document.getElementById('zenleap-update-subtitle');
    if (titleEl) titleEl.textContent = title;
    if (subtitleEl) subtitleEl.textContent = subtitle;
  }

  function setUpdateBody() {
    const body = document.getElementById('zenleap-update-body');
    if (body) body.replaceChildren();
    return body;
  }

  function renderUpdateAvailable(remoteVersion, changelog) {
    updateModalState = 'available';
    setUpdateHeader('Update Available', 'A new version of ZenLeap is ready');
    const body = setUpdateBody();
    if (!body) return;

    // Version comparison
    const versions = updateEl('div', 'zenleap-update-versions',
      updateEl('div', 'zenleap-version-pill',
        updateEl('span', 'zenleap-version-pill-label', 'Installed'),
        updateEl('span', 'zenleap-version-pill-number', VERSION)),
      updateEl('span', 'zenleap-version-arrow', '\u2192'),
      updateEl('div', 'zenleap-version-pill new',
        updateEl('span', 'zenleap-version-pill-label', 'Available'),
        updateEl('span', 'zenleap-version-pill-number', String(remoteVersion))));
    body.appendChild(versions);

    // Sine notice — shown prominently between version pills and changelog
    if (isSineManaged) {
      const sineBar = document.createElement('div');
      sineBar.style.cssText = 'padding:10px 24px;border-bottom:1px solid var(--zl-border-subtle);display:flex;align-items:center;justify-content:center;gap:8px;background:var(--zl-accent-dim);';
      const sineText = updateEl('span', null, 'Update through the Sine mod settings page');
      sineText.style.cssText = 'font-size:13px;color:var(--zl-accent);font-weight:600;';
      sineBar.appendChild(sineText);
      body.appendChild(sineBar);
    }

    // Changelog
    if (changelog && changelog.length > 0) {
      const cl = document.createElement('div');
      cl.className = 'zenleap-update-changelog';
      const h3 = document.createElement('h3');
      h3.textContent = "What's New";
      cl.appendChild(h3);
      for (const item of changelog) {
        const row = document.createElement('div');
        row.className = 'zenleap-update-changelog-item';
        if (item.tag) {
          const tagClass = { new: 'new', fix: 'fix', improved: 'improved', changed: 'changed' }[item.tag] || 'improved';
          row.appendChild(updateEl('span', `zenleap-changelog-tag ${tagClass}`, item.tag));
        }
        const desc = document.createElement('span');
        desc.textContent = item.desc;
        row.appendChild(desc);
        cl.appendChild(row);
      }
      body.appendChild(cl);
    }

    // Actions
    const actions = document.createElement('div');
    actions.className = 'zenleap-update-actions';

    if (isSineManaged) {
      // Sine-managed: show informational message instead of update button
      actions.style.flexDirection = 'column';
      actions.style.alignItems = 'center';
      actions.style.gap = '12px';

      const sineNotice = document.createElement('div');
      sineNotice.style.cssText = 'font-size:12px;color:var(--zl-text-secondary);text-align:center;line-height:1.5;';
      const sineName = updateEl('strong', null, 'Sine');
      sineName.style.color = 'var(--zl-accent)';
      sineNotice.append('This installation is managed by ', sineName, '.', document.createElement('br'), 'Update through the Sine mod settings page.');
      actions.appendChild(sineNotice);

      const closeBtn = document.createElement('button');
      closeBtn.className = 'zenleap-update-btn secondary';
      closeBtn.textContent = 'Close';
      const closeKbd = document.createElement('kbd');
      closeKbd.textContent = 'Esc';
      closeBtn.appendChild(closeKbd);
      closeBtn.addEventListener('click', () => exitUpdateMode());
      actions.appendChild(closeBtn);
    } else {
      const laterBtn = document.createElement('button');
      laterBtn.className = 'zenleap-update-btn secondary';
      laterBtn.textContent = 'Later';
      const laterKbd = document.createElement('kbd');
      laterKbd.textContent = 'Esc';
      laterBtn.appendChild(laterKbd);
      laterBtn.addEventListener('click', () => {
        exitUpdateMode();
      });

      const updateBtn = document.createElement('button');
      updateBtn.className = 'zenleap-update-btn primary';
      updateBtn.textContent = 'Update Now';
      const updateKbd = document.createElement('kbd');
      updateKbd.textContent = '\u21B5';
      updateBtn.appendChild(updateKbd);
      updateBtn.addEventListener('click', () => {
        performUpdate();
      });

      actions.appendChild(laterBtn);
      actions.appendChild(updateBtn);
    }
    body.appendChild(actions);
  }

  function renderUpdateProgress(status, detail) {
    updateModalState = 'progress';
    const headerText = { downloading: 'Downloading from GitHub', verifying: 'Verifying the download' }[status] || 'Installing to profile';
    setUpdateHeader('Updating ZenLeap', headerText);
    const body = setUpdateBody();
    if (!body) return;

    const progress = document.createElement('div');
    progress.className = 'zenleap-update-progress';

    const statusText = document.createElement('span');
    statusText.className = 'zenleap-update-progress-status';
    statusText.textContent = { downloading: 'Downloading update...', verifying: 'Verifying update...' }[status] || 'Installing update...';

    const track = document.createElement('div');
    track.className = 'zenleap-update-progress-bar-track';
    const fill = document.createElement('div');
    fill.className = 'zenleap-update-progress-bar-fill';
    if (status === 'downloading') {
      fill.classList.add('indeterminate');
    } else {
      fill.style.width = status === 'verifying' ? '55%' : '80%';
    }
    track.appendChild(fill);

    const detailText = document.createElement('span');
    detailText.className = 'zenleap-update-progress-detail';
    detailText.textContent = detail || '';

    progress.appendChild(statusText);
    progress.appendChild(track);
    progress.appendChild(detailText);
    body.appendChild(progress);
  }

  function renderUpdateSuccess(newVersion) {
    updateModalState = 'success';
    setUpdateHeader('Update Complete', 'ZenLeap has been updated successfully');
    const body = setUpdateBody();
    if (!body) return;

    const result = updateEl('div', 'zenleap-update-result',
      updateEl('div', 'zenleap-update-result-icon success', '\u2713'),
      updateEl('div', 'zenleap-update-result-title success', `Updated to v${newVersion}`),
      updateEl('div', 'zenleap-update-result-detail',
        'ZenLeap has been updated (the previous version was kept as a .bak file).',
        document.createElement('br'),
        'Restart Zen Browser to activate the new version.'));
    body.appendChild(result);

    const actions = document.createElement('div');
    actions.className = 'zenleap-update-actions';
    actions.style.justifyContent = 'center';

    const restartBtn = document.createElement('button');
    restartBtn.className = 'zenleap-update-btn restart';
    restartBtn.textContent = 'Restart Browser';
    const restartKbd = document.createElement('kbd');
    restartKbd.textContent = '\u21B5';
    restartBtn.appendChild(restartKbd);
    restartBtn.addEventListener('click', () => {
      try {
        Services.startup.quit(Services.startup.eAttemptQuit | Services.startup.eRestart);
      } catch (e) {
        reportError('Restarting the browser failed', e);
      }
    });

    const closeBtn = document.createElement('button');
    closeBtn.className = 'zenleap-update-btn secondary';
    closeBtn.textContent = 'Later';
    const closeKbd = document.createElement('kbd');
    closeKbd.textContent = 'Esc';
    closeBtn.appendChild(closeKbd);
    closeBtn.addEventListener('click', () => exitUpdateMode());

    actions.appendChild(closeBtn);
    actions.appendChild(restartBtn);
    body.appendChild(actions);
  }

  function renderUpdateError(errorMsg) {
    updateModalState = 'error';
    setUpdateHeader('Update Failed', 'Something went wrong during the update');
    const body = setUpdateBody();
    if (!body) return;

    const result = document.createElement('div');
    result.className = 'zenleap-update-result';
    const icon = document.createElement('div');
    icon.className = 'zenleap-update-result-icon error';
    icon.textContent = '!';
    const title = document.createElement('div');
    title.className = 'zenleap-update-result-title error';
    title.textContent = 'Update Failed';
    const detail = document.createElement('div');
    detail.className = 'zenleap-update-result-detail';
    detail.textContent = errorMsg || 'Could not download the update. Check your internet connection and try again.';
    result.appendChild(icon);
    result.appendChild(title);
    result.appendChild(detail);
    body.appendChild(result);

    const actions = document.createElement('div');
    actions.className = 'zenleap-update-actions';
    actions.style.justifyContent = 'center';

    const closeBtn = document.createElement('button');
    closeBtn.className = 'zenleap-update-btn secondary';
    closeBtn.textContent = 'Close';
    const errCloseKbd = document.createElement('kbd');
    errCloseKbd.textContent = 'Esc';
    closeBtn.appendChild(errCloseKbd);
    closeBtn.addEventListener('click', () => exitUpdateMode());

    const retryBtn = document.createElement('button');
    retryBtn.className = 'zenleap-update-btn primary';
    retryBtn.textContent = 'Retry';
    const retryKbd = document.createElement('kbd');
    retryKbd.textContent = '\u21B5';
    retryBtn.appendChild(retryKbd);
    retryBtn.addEventListener('click', () => performUpdate());

    actions.appendChild(closeBtn);
    if (!isSineManaged) {
      actions.appendChild(retryBtn);
    }
    body.appendChild(actions);
  }

  function renderUpdateUpToDate() {
    updateModalState = 'uptodate';
    setUpdateHeader('Check for Updates', 'Version check complete');
    const body = setUpdateBody();
    if (!body) return;

    const result = updateEl('div', 'zenleap-update-result',
      updateEl('div', 'zenleap-update-result-icon uptodate', '\u2713'),
      updateEl('div', 'zenleap-update-result-title uptodate', "You're up to date"),
      updateEl('div', 'zenleap-update-result-detail', `ZenLeap v${VERSION} is the latest version`));
    body.appendChild(result);

    const actions = document.createElement('div');
    actions.className = 'zenleap-update-actions';
    actions.style.justifyContent = 'center';

    const closeBtn = document.createElement('button');
    closeBtn.className = 'zenleap-update-btn secondary';
    closeBtn.textContent = 'Close';
    const utdKbd = document.createElement('kbd');
    utdKbd.textContent = 'Esc';
    closeBtn.appendChild(utdKbd);
    closeBtn.addEventListener('click', () => exitUpdateMode());

    actions.appendChild(closeBtn);
    body.appendChild(actions);
  }

  function renderUpdateChecking() {
    updateModalState = 'checking';
    setUpdateHeader('Checking for Updates', 'Contacting GitHub...');
    const body = setUpdateBody();
    if (!body) return;

    const progress = document.createElement('div');
    progress.className = 'zenleap-update-progress';

    const statusText = document.createElement('span');
    statusText.className = 'zenleap-update-progress-status';
    statusText.textContent = 'Checking for updates...';

    const track = document.createElement('div');
    track.className = 'zenleap-update-progress-bar-track';
    const fill = document.createElement('div');
    fill.className = 'zenleap-update-progress-bar-fill indeterminate';
    track.appendChild(fill);

    progress.appendChild(statusText);
    progress.appendChild(track);
    body.appendChild(progress);
  }

  // Perform the actual update (download + install)
  async function performUpdate() {
    // Hard block: Sine-managed installs must never self-update
    if (isSineManaged) return;

    renderUpdateProgress('downloading', 'Fetching files from GitHub');
    const result = await downloadAndInstallUpdate((status, detail) => {
      if (!updateMode) return;
      if (status === 'downloading' || status === 'verifying' || status.startsWith('installing')) {
        renderUpdateProgress(status, detail);
      }
    });
    if (!updateMode) return; // user dismissed during install
    if (result.success) {
      renderUpdateSuccess(result.version);
    } else {
      renderUpdateError(result.error);
    }
  }

  // Enter update mode — check for updates and show modal
  async function enterUpdateMode() {
    if (updateMode) return;
    if (leapMode) exitLeapMode(false);
    if (searchMode) exitSearchMode();
    if (helpMode) exitHelpMode();
    if (settingsMode) exitSettingsMode();
    if (reorgMode) exitReorgMode(false);

    createUpdateModal();
    updateMode = true;
    updateModal.classList.add('active');

    renderUpdateChecking();

    const result = await checkForZenLeapUpdate();
    if (!updateMode) return; // user dismissed while checking
    if (!result) {
      renderUpdateError('Could not reach GitHub. Check your internet connection.');
    } else if (result.available) {
      renderUpdateAvailable(result.remoteVersion, result.changelog);
    } else {
      renderUpdateUpToDate();
    }
  }

  function exitUpdateMode() {
    if (!updateMode) return;
    updateMode = false;
    updateModalState = null;
    if (updateModal) updateModal.classList.remove('active');
    if (S['display.refocusOnClose']) try { gBrowser.selectedBrowser.focus(); } catch (_) {}
  }

  // Update toast: a centered bar with Update/Details and Dismiss buttons. Enter/Escape
  // also work while nothing else has keyboard focus. It hides itself after a while
  // (hover pauses that); only "Dismiss" (or Escape) skips this version for good.
  const UPDATE_TOAST_AUTOHIDE_MS = 15000;
  let _updateToastTimer = null;

  function armUpdateToastTimer() {
    clearTimeout(_updateToastTimer);
    _updateToastTimer = setTimeout(() => dismissUpdateToast(false), UPDATE_TOAST_AUTOHIDE_MS);
  }

  function showUpdateToast(remoteVersion) {
    // Don't show if user explicitly dismissed the toast for this version
    if (S['updates.dismissedVersion'] === remoteVersion) return;

    ensureUpdateStyles();
    dismissUpdateToast();

    const toast = document.createElement('div');
    toast.id = 'zenleap-update-toast';
    toast.setAttribute('role', 'status');

    const text = updateEl('span', 'zenleap-toast-text', 'ZenLeap ', updateEl('strong', null, `v${remoteVersion}`), ' available');
    if (isSineManaged) text.append(' \u2014 update via ', updateEl('strong', null, 'Sine'));

    const open = updateEl('button', 'zenleap-toast-btn primary', isSineManaged ? 'Details' : 'Update');
    open.addEventListener('click', () => { dismissUpdateToast(false); enterUpdateMode(); });
    const dismiss = updateEl('button', 'zenleap-toast-btn', 'Dismiss');
    dismiss.title = `Don't show this again for v${remoteVersion}`;
    dismiss.addEventListener('click', () => dismissUpdateToast(true));

    toast.append(text, open, dismiss);
    toast.addEventListener('mouseenter', () => clearTimeout(_updateToastTimer));
    toast.addEventListener('mouseleave', () => { if (updateToast === toast) armUpdateToastTimer(); });

    document.documentElement.appendChild(toast);
    updateToast = toast;
    updateToastVersion = remoteVersion;
    armUpdateToastTimer();
  }

  function dismissUpdateToast(suppress) {
    clearTimeout(_updateToastTimer);
    _updateToastTimer = null;
    if (updateToast) {
      if (suppress && updateToastVersion) {
        S['updates.dismissedVersion'] = updateToastVersion;
        saveSettings();
      }
      updateToast.style.animation = 'zenleap-toast-out 0.2s ease-in forwards';
      const ref = updateToast;
      setTimeout(() => { try { ref.remove(); } catch(e) {} }, 200);
      updateToast = null;
      updateToastVersion = null;
    }
  }

  // Auto-check for updates (called from init in every window). The persisted check time
  // doubles as a cross-window lock: it is claimed synchronously before the request, and
  // other windows see it through the settings observer, so only one window checks.
  async function autoCheckForUpdates() {
    if (!shouldAutoCheckForUpdates()) return;

    // Record check time (only auto-checks count for cooldown, not manual checks)
    S['updates.lastCheckTime'] = Date.now();
    saveSettings();

    const result = await checkForZenLeapUpdate();
    if (result && result.available) {
      // Clear dismissed version if a newer version supersedes it
      const dismissed = S['updates.dismissedVersion'];
      if (dismissed && dismissed !== result.remoteVersion && !versionGte(dismissed, result.remoteVersion)) {
        S['updates.dismissedVersion'] = '';
        saveSettings();
      }
      // Show the toast once, in the window the user is looking at
      Services.obs.notifyObservers(null, UPDATE_AVAILABLE_TOPIC, result.remoteVersion);
    }
  }

  function _onUpdateAvailableBroadcast(subject, topic, version) {
    if (!/^\d+(\.\d+)*$/.test(version || '')) return;
    try {
      const top = BrowserWindowTracker.getTopWindow();
      if (top && top !== window) return;
    } catch (e) { /* no tracker: show it here */ }
    showUpdateToast(version);
  }
  Services.obs.addObserver(_onUpdateAvailableBroadcast, UPDATE_AVAILABLE_TOPIC);
  onRegionTeardown(() => Services.obs.removeObserver(_onUpdateAvailableBroadcast, UPDATE_AVAILABLE_TOPIC));

  // ============================================
  // FOLDER DELETE MODAL (browse mode)
  // ============================================

  // Undo entries for folder deletions (newest last). Entries expire after 30 s; the
  // undo shortcut falls through to the native "reopen closed tab" when none applies.
  const FOLDER_UNDO_WINDOW_MS = 30000;
  const FOLDER_UNDO_MAX_ENTRIES = 10;

  function pushFolderUndo(entry) {
    folderUndoStack.push({ ...entry, timestamp: Date.now() });
    if (folderUndoStack.length > FOLDER_UNDO_MAX_ENTRIES) {
      folderUndoStack.splice(0, folderUndoStack.length - FOLDER_UNDO_MAX_ENTRIES);
    }
  }

  // Everything needed to rebuild a folder later: its tree (tabs by URL, subfolders),
  // label, collapsed state, workspace and position.
  function snapshotFolder(folder) {
    return {
      folderLabel: folderName(folder),
      folderId: folder.id,
      workspaceId: folder.getAttribute('zen-workspace-id'),
      tree: collectFolderTree(folder, null, { withState: true }),
      anchor: folder.previousElementSibling,
      parentFolder: folder.group?.isZenFolder ? folder.group : null,
    };
  }

  // Delete a folder and close its tabs (undoable via the undo-folder-delete shortcut).
  async function deleteFolderWithTabs(folder) {
    const target = folder?.isConnected ? folder : document.getElementById(folder?.id);
    if (!target?.isZenFolder) return false;
    const snapshot = snapshotFolder(target);
    pushFolderUndo({ type: 'folder-and-contents', tabCount: folderTabCount(target), ...snapshot });
    await target.delete();
    log(`Deleted folder and contents: ${snapshot.folderLabel}`);
    return true;
  }

  // Delete a folder but keep its tabs (undo re-creates the folder around them).
  async function dissolveFolder(folder) {
    const target = folder?.isConnected ? folder : document.getElementById(folder?.id);
    if (!target?.isZenFolder) return false;
    const tabs = target.tabs.filter(t => !t.hasAttribute('zen-empty-tab'));
    pushFolderUndo({
      type: 'folder-only',
      folderLabel: folderName(target),
      folderId: target.id,
      collapsed: !!target.collapsed,
      tabRefs: tabs,
    });
    await target.unpackTabs();
    log(`Deleted folder (kept tabs): ${folderName(target)} (${tabs.length} tabs freed)`);
    return true;
  }

  // Port of Zen's private ZenFolders.#convertFolderToSpace (zen-omni ZenFolders.mjs:593,
  // used by the folder context menu) — keep in sync with upstream. Includes upstream's
  // final pass that re-tags every tab with the new workspace id; without it the tabs
  // return to the old workspace after a restart. Additionally re-tags moved subfolders.
  async function convertFolderToWorkspace(folder) {
    if (!folder?.isZenFolder || !folder.isConnected || !window.gZenWorkspaces) return null;
    const currentWorkspace = gZenWorkspaces.getActiveWorkspaceFromCache();
    const selectedTab = folder.tabs.find(tab => tab.selected);
    const icon = folder.icon?.querySelector('svg .icon image');
    const label = folderName(folder);
    const movedFolders = [];

    const newSpace = await gZenWorkspaces.createAndSaveWorkspace(
      label,
      icon?.getAttribute('href'),
      /* dontChange */ false,
      currentWorkspace?.containerTabId || 0,
      {
        beforeChangeCallback: async (newWorkspace) => {
          await new Promise((resolve) => {
            requestAnimationFrame(async () => {
              try {
                const workspacePinnedContainer = gZenWorkspaces.workspaceElement(newWorkspace.uuid).pinnedTabsContainer;
                const items = folder.allItems.filter(tab => !tab.hasAttribute('zen-empty-tab'));
                for (const item of items) {
                  if (item.isZenFolder) movedFolders.push(item, ...item.querySelectorAll('zen-folder'));
                }
                workspacePinnedContainer.append(...items);
                await folder.delete();
                gBrowser.tabContainer._invalidateCachedTabs();
                if (selectedTab) {
                  selectedTab.setAttribute('zen-workspace-id', newWorkspace.uuid);
                  selectedTab.removeAttribute('folder-active');
                  gZenWorkspaces.lastSelectedWorkspaceTabs[newWorkspace.uuid] = selectedTab;
                }
              } catch (e) {
                reportError('Convert folder to workspace: moving the folder contents failed', e);
              } finally {
                resolve();
              }
            });
          });
        },
      }
    );
    if (!newSpace) return null;

    // Change the ID for all tabs (the new workspace is active now)
    for (const tab of gBrowser.tabs) {
      if (!tab.hasAttribute('zen-essential')) {
        tab.setAttribute('zen-workspace-id', newSpace.uuid);
        tab.style.opacity = '';
        tab.style.height = '';
      }
      gBrowser.TabStateFlusher.flush(tab.linkedBrowser);
      if (gZenWorkspaces.lastSelectedWorkspaceTabs[currentWorkspace?.uuid] === tab) {
        // No longer the last selected tab of the previous workspace
        delete gZenWorkspaces.lastSelectedWorkspaceTabs[currentWorkspace.uuid];
      }
    }
    for (const sub of movedFolders) sub.setAttribute('zen-workspace-id', newSpace.uuid);
    log(`Converted folder "${label}" to workspace`);
    return newSpace;
  }

  function showFolderDeleteModal(folder) {
    folderDeleteMode = true;
    folderDeleteTarget = folder;

    const name = folderName(folder);
    const tabCount = folderTabCount(folder);

    if (!folderDeleteModal) {
      folderDeleteModal = document.createElement('div');
      folderDeleteModal.id = 'zenleap-folder-delete-modal';
      document.documentElement.appendChild(folderDeleteModal);
    }

    folderDeleteModal.innerHTML = '';

    const backdrop = document.createElement('div');
    backdrop.className = 'zenleap-folder-delete-backdrop';
    backdrop.addEventListener('click', () => closeFolderDeleteModal());

    const container = document.createElement('div');
    container.className = 'zenleap-folder-delete-container';

    const title = document.createElement('div');
    title.className = 'zenleap-folder-delete-title';
    title.textContent = `Delete "${name}" (${tabCount} tab${tabCount !== 1 ? 's' : ''})?`;
    container.appendChild(title);

    const deleteAll = createDeleteOption('1', `Delete folder and close ${tabCount} tab${tabCount !== 1 ? 's' : ''}`, 'Removes the folder and closes all tabs inside it', () => deleteFolderAndContents(folderDeleteTarget));
    deleteAll.classList.add('destructive');
    container.appendChild(deleteAll);
    container.appendChild(createDeleteOption('2', 'Delete folder only (keep tabs)', 'Removes the folder but keeps all tabs', () => deleteFolderKeepTabs(folderDeleteTarget)));
    container.appendChild(createDeleteOption('Esc', 'Cancel', '', () => closeFolderDeleteModal()));

    folderDeleteModal.appendChild(backdrop);
    folderDeleteModal.appendChild(container);
    folderDeleteModal.classList.add('active');
    log(`Showing folder delete modal for "${name}"`);
  }

  function createDeleteOption(shortcut, label, sublabel, action) {
    const option = document.createElement('div');
    option.className = 'zenleap-folder-delete-option';
    option.addEventListener('click', action);

    const kbd = document.createElement('kbd');
    kbd.textContent = shortcut;

    const text = document.createElement('div');
    text.className = 'zenleap-folder-delete-option-text';

    const labelEl = document.createElement('span');
    labelEl.className = 'zenleap-folder-delete-label';
    labelEl.textContent = label;
    text.appendChild(labelEl);

    if (sublabel) {
      const sub = document.createElement('span');
      sub.className = 'zenleap-folder-delete-sublabel';
      sub.textContent = sublabel;
      text.appendChild(sub);
    }

    option.appendChild(kbd);
    option.appendChild(text);
    return option;
  }

  function closeFolderDeleteModal() {
    folderDeleteMode = false;
    folderDeleteTarget = null;
    if (folderDeleteModal) {
      folderDeleteModal.classList.remove('active');
    }
    // Return to browse mode (it was never exited)
    updateHighlight();
  }

  // Browse-mode modal option 1
  function deleteFolderAndContents(folder) {
    _expectedGone.add(folder);
    for (const t of folder?.tabs || []) _expectedGone.add(t);
    closeFolderDeleteModal();
    deleteFolderWithTabs(folder)
      .catch(e => reportError('Deleting folder and its tabs failed', e))
      .finally(() => adjustHighlightAfterDeletion());
  }

  // Browse-mode modal option 2
  function deleteFolderKeepTabs(folder) {
    _expectedGone.add(folder);
    closeFolderDeleteModal();
    dissolveFolder(folder)
      .catch(e => reportError('Deleting folder failed', e))
      .finally(() => adjustHighlightAfterDeletion());
  }

  function adjustHighlightAfterDeletion() {
    refreshBrowseAfterClose();
  }

  // Rebuild a folder deleted together with its tabs from its snapshot: its tabs are
  // reopened (lazily) and the Zen folder structure (subfolders, order, collapsed
  // state) is recreated at its old position. Firefox's closed-group entry for it is
  // dropped: restoring that would bring back a plain tab group, not a Zen folder.
  async function restoreDeletedFolder(entry) {
    if (!window.gZenFolders) return;
    if (entry.workspaceId && workspacesEnabled() && entry.workspaceId !== gZenWorkspaces.activeWorkspace &&
        gZenWorkspaces.getWorkspaces().some(w => w.uuid === entry.workspaceId)) {
      await gZenWorkspaces.changeWorkspaceWithID(entry.workspaceId);
    }
    try { SessionStore.forgetClosedTabGroup(window, entry.folderId); } catch (e) { /* no closed-group entry */ }

    const anchor = (entry.anchor?.isConnected && !entry.anchor.closing) ? entry.anchor : null;
    const insertAfter = anchor || (entry.parentFolder?.isConnected ? entry.parentFolder.groupStartElement : null);
    const openedTabs = [];
    const folder = await restoreFolderFromLayout(entry.tree, insertAfter, openedTabs, [], { tabState: true });
    if (folder) {
      const current = openedTabs.find(o => o.tab && !o.tab.closing)?.tab;
      if (current && !entry.tree.collapsed) gBrowser.selectedTab = current;
      log(`Undo: restored folder "${entry.folderLabel}" with ${openedTabs.length} tabs`);
    }
  }

  // Undo the last folder deletion. Returns true if handled, false to let the browser
  // handle the shortcut (native "reopen closed tab").
  function undoLastFolderDelete() {
    if (folderUndoStack.length === 0) {
      return false; // Nothing to undo, let the browser's native shortcut handle it
    }

    const entry = folderUndoStack[folderUndoStack.length - 1];

    // Only undo if recent
    if (Date.now() - entry.timestamp > FOLDER_UNDO_WINDOW_MS) {
      folderUndoStack.length = 0;
      return false;
    }
    folderUndoStack.pop();

    if (entry.type === 'folder-and-contents') {
      // Entries without a snapshot (pushed by code that deleted the folder itself):
      // let the native shortcut reopen the closed tab group.
      if (!entry.tree) return false;
      restoreDeletedFolder(entry).catch(e => reportError('Undo folder delete failed', e));
      return true;
    }

    if (entry.type === 'folder-only') {
      // Recreate folder with the tabs that are still alive
      const remaining = liveTabs(entry.tabRefs);
      if (remaining.length === 0) {
        log('Undo: all tabs from deleted folder are gone');
        return true;
      }
      if (!window.gZenFolders) return false;
      try {
        gZenFolders.createFolder(remaining, { label: entry.folderLabel, renameFolder: false, collapsed: entry.collapsed });
        log(`Undo: recreated folder "${entry.folderLabel}" with ${remaining.length} tabs`);
      } catch (e) { reportError('Undo folder delete failed', e); }
      return true; // We handled it
    }

    return false;
  }

  // Switch focus to the split pane in the given direction
  function splitFocusInDirection(direction) {
    try {
      const splitter = window.gZenViewSplitter;
      if (!splitter?.splitViewActive) return false;

      const viewData = splitter?._data?.[splitter.currentView];
      if (!viewData?.tabs || viewData.tabs.length < 2) return false;

      const current = currentTab();
      const currentNode = splitter.getSplitNodeFromTab(current);
      if (!currentNode?.positionToRoot) return false;

      const cur = currentNode.positionToRoot;
      const curCenterX = (cur.left + (100 - cur.right)) / 2;
      const curCenterY = (cur.top + (100 - cur.bottom)) / 2;

      let bestTab = null;
      let bestDistance = Infinity;

      for (const tab of viewData.tabs) {
        if (tab === current) continue;

        const node = splitter.getSplitNodeFromTab(tab);
        if (!node?.positionToRoot) continue;

        const pos = node.positionToRoot;
        const centerX = (pos.left + (100 - pos.right)) / 2;
        const centerY = (pos.top + (100 - pos.bottom)) / 2;

        const dx = centerX - curCenterX;
        const dy = centerY - curCenterY;

        let isInDirection = false;
        let distance = 0;

        switch (direction) {
          case 'left':
            isInDirection = dx < -0.1;
            distance = Math.abs(dx) + Math.abs(dy) * 2;
            break;
          case 'right':
            isInDirection = dx > 0.1;
            distance = Math.abs(dx) + Math.abs(dy) * 2;
            break;
          case 'up':
            isInDirection = dy < -0.1;
            distance = Math.abs(dy) + Math.abs(dx) * 2;
            break;
          case 'down':
            isInDirection = dy > 0.1;
            distance = Math.abs(dy) + Math.abs(dx) * 2;
            break;
        }

        if (isInDirection && distance < bestDistance) {
          bestDistance = distance;
          bestTab = tab;
        }
      }

      if (bestTab) {
        gBrowser.selectedTab = bestTab;
        log(`Split focus: moved ${direction} to tab "${bestTab.label}"`);
        return true;
      } else {
        log(`Split focus: no pane found ${direction} of current`);
        return false;
      }
    } catch (e) {
      log(`Split focus failed: ${e}`);
      return false;
    }
  }

  // Get the positionToRoot bounds for the currently focused split pane.
  // Returns null when split view is inactive or the tab has no split node.
  function getSplitBounds() {
    try {
      const splitter = window.gZenViewSplitter;
      if (!splitter?.splitViewActive) return null;
      const node = splitter.getSplitNodeFromTab(gBrowser.selectedTab);
      return node?.positionToRoot || null;
    } catch (e) { return null; }
  }

  // Quick-switch to adjacent tab without entering browse/leap mode.
  // When skipSplitGroup is true, skip tabs belonging to the current split
  // group so that navigating at a split boundary jumps directly to the
  // first non-split tab outside the group.
  function quickSwitchTab(direction, skipSplitGroup = false) {
    const items = getVisibleItems().filter(item => !isFolder(item));
    // During a Glance the selected tab is the glance child; move from its parent
    const currentIndex = items.indexOf(currentTab());
    if (currentIndex === -1) return;

    let splitTabs = null;
    if (skipSplitGroup) {
      const splitter = window.gZenViewSplitter;
      const viewData = splitter?._data?.[splitter?.currentView];
      if (viewData?.tabs) splitTabs = new Set(viewData.tabs);
    }

    let newIndex = -1;
    if (direction === 'down') {
      for (let i = currentIndex + 1; i < items.length; i++) {
        if (!splitTabs || !splitTabs.has(items[i])) { newIndex = i; break; }
      }
    } else {
      for (let i = currentIndex - 1; i >= 0; i--) {
        if (!splitTabs || !splitTabs.has(items[i])) { newIndex = i; break; }
      }
    }

    if (newIndex !== -1 && newIndex !== currentIndex) {
      gBrowser.selectedTab = items[newIndex];
      log(`Quick switch tab ${direction}: "${items[newIndex].label}"`);
    }
  }

  // Quick-switch workspace without entering browse/leap mode
  async function quickSwitchWorkspace(direction) {
    try {
      if (!window.gZenWorkspaces) return;
      const workspaces = window.gZenWorkspaces.getWorkspaces();
      if (!Array.isArray(workspaces) || workspaces.length < 2) return;

      const currentId = window.gZenWorkspaces.activeWorkspace;
      const currentIdx = workspaces.findIndex(ws => ws.uuid === currentId);
      if (currentIdx < 0) return;

      let newIdx;
      if (direction === 'prev') {
        newIdx = currentIdx > 0 ? currentIdx - 1 : workspaces.length - 1;
      } else {
        newIdx = currentIdx < workspaces.length - 1 ? currentIdx + 1 : 0;
      }

      await window.gZenWorkspaces.changeWorkspaceWithID(workspaces[newIdx].uuid);
      log(`Quick switch workspace ${direction}`);
    } catch (e) { log(`Quick workspace switch failed: ${e}`); }
  }

  // ============================================
  // GTILE MODE (Split View Resize Overlay)
  // ============================================

  function getNodeClasses() {
    const splitter = window.gZenViewSplitter;
    const viewData = splitter._data[splitter.currentView];
    if (!viewData?.layoutTree) return null;

    const SplitNode = viewData.layoutTree.constructor;
    let LeafNode = null;
    function findLeaf(node) {
      if (!node.children) { LeafNode = node.constructor; return; }
      for (const child of node.children) {
        findLeaf(child);
        if (LeafNode) return;
      }
    }
    findLeaf(viewData.layoutTree);
    if (!LeafNode) return null;
    return { SplitNode, LeafNode };
  }

  // Install a new layout tree for the current split view and re-render it.
  // A flat tree is also recorded as Zen's matching gridType (all columns =
  // vsep, all rows = hsep), so Zen's own layout commands see the real state;
  // nested custom trees keep the previous gridType (LEAP-B-31).
  function commitSplitTree(viewData, tree) {
    const splitter = window.gZenViewSplitter;
    splitter.removeSplitters();
    splitter._tabToSplitNode.clear();
    viewData.layoutTree = tree;
    const flat = tree?.children?.length && tree.children.every(c => !c.children || c.children.length === 0);
    if (flat && tree.direction === 'row') viewData.gridType = 'vsep';
    else if (flat && tree.direction === 'column') viewData.gridType = 'hsep';
    splitter.applyGridLayout(tree);
  }

  // CSS inset for a region given in percent of the grid (2px gutter).
  function gtileInset(rect) {
    const gap = 2;
    return `calc(${rect.top}% + ${gap}px) calc(${rect.right}% + ${gap}px) calc(${rect.bottom}% + ${gap}px) calc(${rect.left}% + ${gap}px)`;
  }

  function createGtileOverlay() {
    if (gtileOverlay) return;

    gtileOverlay = document.createElement('div');
    gtileOverlay.id = 'zenleap-gtile-overlay';

    const backdrop = document.createElement('div');
    backdrop.id = 'zenleap-gtile-backdrop';
    backdrop.addEventListener('click', () => exitGtileMode(false));

    const panel = document.createElement('div');
    panel.id = 'zenleap-gtile-panel';

    // Header
    const header = document.createElement('div');
    header.className = 'zenleap-gtile-header';

    const title = document.createElement('div');
    title.className = 'zenleap-gtile-title';
    title.textContent = 'Split Layout';

    const modeSwitch = document.createElement('div');
    modeSwitch.className = 'zenleap-gtile-mode-switch';

    const slider = document.createElement('div');
    slider.className = 'zenleap-gtile-mode-slider';

    const moveBtn = document.createElement('div');
    moveBtn.className = 'gtile-mode-btn active';
    moveBtn.dataset.mode = 'move';
    moveBtn.textContent = 'Move';

    const resizeBtn = document.createElement('div');
    resizeBtn.className = 'gtile-mode-btn';
    resizeBtn.dataset.mode = 'resize';
    resizeBtn.textContent = 'Resize';

    modeSwitch.appendChild(slider);
    modeSwitch.appendChild(moveBtn);
    modeSwitch.appendChild(resizeBtn);

    // Resize target info (shown in resize mode, replaces title)
    const targetInfo = document.createElement('div');
    targetInfo.className = 'zenleap-gtile-target-info';

    const targetDot = document.createElement('div');
    targetDot.className = 'gtile-target-dot';
    const targetLabel = document.createElement('div');
    targetLabel.className = 'gtile-target-label';
    targetLabel.textContent = 'Resizing';
    const targetName = document.createElement('div');
    targetName.className = 'gtile-target-name';

    targetInfo.appendChild(targetDot);
    targetInfo.appendChild(targetLabel);
    targetInfo.appendChild(targetName);

    header.appendChild(title);
    header.appendChild(targetInfo);
    header.appendChild(modeSwitch);

    // Grid
    const grid = document.createElement('div');
    grid.id = 'zenleap-gtile-grid';

    // Cell layer (visible in resize mode)
    const cellLayer = document.createElement('div');
    cellLayer.className = 'zenleap-gtile-cell-layer';

    for (let r = 0; r < GTILE_ROWS; r++) {
      for (let c = 0; c < GTILE_COLS; c++) {
        const cell = document.createElement('div');
        cell.className = 'zenleap-gtile-cell';
        cell.dataset.row = r;
        cell.dataset.col = c;
        cellLayer.appendChild(cell);
      }
    }

    // Selection rect overlay
    const sel = document.createElement('div');
    sel.className = 'zenleap-gtile-sel';

    // Ghost element (drag placeholder)
    gtileGhostEl = document.createElement('div');
    gtileGhostEl.className = 'zenleap-gtile-ghost';
    gtileGhostEl.style.display = 'none';

    grid.appendChild(cellLayer);
    grid.appendChild(sel);
    grid.appendChild(gtileGhostEl);

    // Hints bar
    const hints = document.createElement('div');
    hints.id = 'zenleap-gtile-hints';

    panel.appendChild(header);
    panel.appendChild(grid);
    panel.appendChild(hints);

    gtileOverlay.appendChild(backdrop);
    gtileOverlay.appendChild(panel);

    document.documentElement.appendChild(gtileOverlay);

    // --- Mouse event wiring ---
    setupGtileMouseEvents(grid, cellLayer, modeSwitch);

    log('gTile overlay created');
  }

  function enterGtileMode() {
    if (gtileMode) return;

    const splitter = window.gZenViewSplitter;
    if (!splitter?.splitViewActive) return;

    const viewData = splitter._data[splitter.currentView];
    if (!viewData?.tabs || viewData.tabs.length < 2) return;

    // Exit other modes
    if (leapMode) exitLeapMode(false);
    if (searchMode) exitSearchMode();
    if (helpMode) exitHelpMode();
    if (settingsMode) exitSettingsMode();
    if (reorgMode) exitReorgMode(false);

    createGtileOverlay();

    gtileMode = true;
    gtileFocusedTab = gBrowser.selectedTab;
    gtileSubMode = 'move';
    gtileHeld = false;
    gtileSelecting = false;
    gtileAnchor = null;
    gtileCursor = { col: 0, row: 0 };

    // Map current tab positions to proportional regions
    mapCurrentLayoutToGrid(viewData);

    // Set active region to the focused tab
    gtileActiveRegionIdx = gtileTabRects.findIndex(r => r.tab === gtileFocusedTab);
    if (gtileActiveRegionIdx < 0) gtileActiveRegionIdx = 0;

    gtileMouseHints = false;
    gtileDrag = null;
    gtileMouseSelecting = false;

    gtileOverlay.classList.add('active', 'mode-move');
    gtileOverlay.classList.remove('mode-resize');
    updateGtileOverlay();
    attachGtileDocListeners();
    armModeGuards('gtile', () => exitGtileMode(false), { inside: '#zenleap-gtile-panel' });

    log('Entered gTile mode (move)');
  }

  function exitGtileMode(apply) {
    if (!gtileMode) return;
    disarmModeGuards('gtile');
    _gtileDocAbort?.abort();
    _gtileDocAbort = null;
    _gtileMoveMouseDown = null;
    _gtileResizeMouseStart = null;

    if (apply && gtileSubMode === 'resize') {
      applyGtileLayout();
    }

    gtileMode = false;
    gtileOverlay.classList.remove('active', 'mode-move', 'mode-resize');
    gtileFocusedTab = null;
    gtileTabRects = [];
    gtileSelecting = false;
    gtileAnchor = null;
    gtileHeld = false;
    gtileDrag = null;
    gtileMouseSelecting = false;
    if (gtileGhostEl) gtileGhostEl.style.display = 'none';

    // Remove region elements
    for (const el of gtileRegionElements.values()) {
      el.remove();
    }
    gtileRegionElements.clear();

    log('Exited gTile mode');
  }

  function mapCurrentLayoutToGrid(viewData) {
    gtileTabRects = [];
    const splitter = window.gZenViewSplitter;

    for (let i = 0; i < viewData.tabs.length; i++) {
      const tab = viewData.tabs[i];
      const node = splitter.getSplitNodeFromTab(tab);
      if (!node?.positionToRoot) continue;

      const pos = node.positionToRoot;
      gtileTabRects.push({
        tab,
        left: pos.left,
        top: pos.top,
        right: pos.right,
        bottom: pos.bottom,
        color: GTILE_REGION_COLORS[i % GTILE_REGION_COLORS.length],
      });
    }
  }

  function updateGtileOverlay() {
    if (!gtileOverlay) return;

    const grid = gtileOverlay.querySelector('#zenleap-gtile-grid');
    const hints = gtileOverlay.querySelector('#zenleap-gtile-hints');
    const cellLayer = grid.querySelector('.zenleap-gtile-cell-layer');

    // --- Update mode button classes ---
    gtileOverlay.querySelectorAll('.gtile-mode-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.mode === gtileSubMode);
    });

    // --- Sync region elements (keyed by tab for smooth transitions) ---
    const currentTabs = new Set(gtileTabRects.map(r => r.tab));

    // Remove stale elements
    for (const [tab, el] of gtileRegionElements) {
      if (!currentTabs.has(tab)) {
        el.remove();
        gtileRegionElements.delete(tab);
      }
    }

    // Create or update region elements
    for (let i = 0; i < gtileTabRects.length; i++) {
      const rect = gtileTabRects[i];
      let region = gtileRegionElements.get(rect.tab);

      if (!region) {
        region = document.createElement('div');
        region.className = 'zenleap-gtile-region';

        const titleEl = document.createElement('div');
        titleEl.className = 'gtile-region-title';
        const badgeEl = document.createElement('div');
        badgeEl.className = 'gtile-region-badge';

        region.appendChild(titleEl);
        region.appendChild(badgeEl);
        grid.insertBefore(region, cellLayer);
        gtileRegionElements.set(rect.tab, region);
      }

      // Update position (CSS transitions handle animation)
      // Skip position update for region being mouse-dragged (it follows the mouse directly)
      const isDragging = gtileDrag && gtileDrag.isDragging && gtileDrag.idx === i;
      if (!isDragging) {
        region.style.inset = gtileInset(rect);
      }
      region.dataset.color = rect.color;

      // Update active/held/resize-target/drag state
      const isActive = gtileSubMode === 'move' && i === gtileActiveRegionIdx && !isDragging;
      region.classList.toggle('gtile-active', isActive);
      region.classList.toggle('gtile-held', gtileSubMode === 'move' && i === gtileActiveRegionIdx && gtileHeld && !isDragging);
      region.classList.toggle('gtile-resize-target', gtileSubMode === 'resize' && rect.tab === gtileFocusedTab);
      region.classList.toggle('gtile-dragging', isDragging);
      region.classList.toggle('gtile-swap-target', gtileDrag && gtileDrag.isDragging && gtileDrag.swapIdx === i);

      // Update text
      region.querySelector('.gtile-region-title').textContent = rect.tab.label?.substring(0, 30) || 'Tab';
      const w = Math.round(100 - rect.left - rect.right);
      const h = Math.round(100 - rect.top - rect.bottom);
      region.querySelector('.gtile-region-badge').textContent = `${w}% \u00D7 ${h}%`;
    }

    // --- Resize target info (header) ---
    const targetInfoEl = gtileOverlay.querySelector('.zenleap-gtile-target-info');
    if (targetInfoEl && gtileSubMode === 'resize' && gtileFocusedTab) {
      const targetRect = gtileTabRects.find(r => r.tab === gtileFocusedTab);
      const t = _appliedTheme;
      const colorMap = { blue: t.regionBlue, purple: t.regionPurple, green: t.regionGreen, yellow: t.regionGold };
      const hue = targetRect ? colorMap[targetRect.color] || t.accent : t.accent;
      targetInfoEl.querySelector('.gtile-target-dot').style.setProperty('--target-hue', hue);
      targetInfoEl.querySelector('.gtile-target-name').textContent = gtileFocusedTab.label || 'Tab';
    }

    // --- Cell layer (resize mode) ---
    const cells = grid.querySelectorAll('.zenleap-gtile-cell');
    const sel = grid.querySelector('.zenleap-gtile-sel');

    if (gtileSubMode === 'resize') {
      // Reset cells
      cells.forEach(cell => { cell.className = 'zenleap-gtile-cell'; });

      // Cursor
      const cursorIdx = gtileCursor.row * GTILE_COLS + gtileCursor.col;
      if (cursorIdx >= 0 && cursorIdx < cells.length) {
        cells[cursorIdx].classList.add('gtile-cursor');
      }

      // Selection
      if (gtileSelecting && gtileAnchor) {
        const c1 = Math.min(gtileAnchor.col, gtileCursor.col);
        const r1 = Math.min(gtileAnchor.row, gtileCursor.row);
        const c2 = Math.max(gtileAnchor.col, gtileCursor.col);
        const r2 = Math.max(gtileAnchor.row, gtileCursor.row);

        for (let r = r1; r <= r2; r++) {
          for (let c = c1; c <= c2; c++) {
            const idx = r * GTILE_COLS + c;
            if (idx >= 0 && idx < cells.length) {
              cells[idx].classList.add('gtile-selected');
            }
          }
        }

        // Position selection rect overlay
        if (sel) {
          sel.classList.add('visible');
          sel.style.top = `${r1 / GTILE_ROWS * 100}%`;
          sel.style.left = `${c1 / GTILE_COLS * 100}%`;
          sel.style.bottom = `${(GTILE_ROWS - r2 - 1) / GTILE_ROWS * 100}%`;
          sel.style.right = `${(GTILE_COLS - c2 - 1) / GTILE_COLS * 100}%`;
        }
      } else if (sel) {
        sel.classList.remove('visible');
      }
    } else {
      // Move mode — reset cell layer
      cells.forEach(cell => { cell.className = 'zenleap-gtile-cell'; });
      if (sel) sel.classList.remove('visible');
    }

    // --- Update hints (adaptive: keyboard by default, mouse when hovering grid) ---
    if (hints) {
      if (gtileSubMode === 'move') {
        if (gtileMouseHints) {
          hints.innerHTML = (gtileDrag && gtileDrag.isDragging)
            ? '<span><kbd>Drag</kbd> swap</span><span><kbd>Release</kbd> drop</span><span><kbd>Esc</kbd> cancel</span>'
            : '<span><kbd>Click</kbd> select</span><span><kbd>Drag</kbd> swap</span><span><kbd>r</kbd> rotate</span><span><kbd>R</kbd> reset</span><span><kbd>Tab</kbd> resize</span><span><kbd>Esc</kbd> close</span>';
        } else {
          hints.innerHTML = gtileHeld
            ? '<span><kbd>hjkl</kbd> swap</span><span><kbd>Enter</kbd> drop</span><span><kbd>r</kbd> rotate</span><span><kbd>R</kbd> reset</span><span><kbd>Esc</kbd> close</span>'
            : '<span><kbd>hjkl</kbd> nav</span><span><kbd>⇧hjkl</kbd> swap</span><span><kbd>Enter</kbd> grab</span><span><kbd>r</kbd> rotate</span><span><kbd>R</kbd> reset</span><span><kbd>Tab</kbd> resize</span><span><kbd>Esc</kbd> close</span>';
        }
      } else {
        if (gtileMouseHints) {
          hints.innerHTML = (gtileSelecting || gtileMouseSelecting)
            ? '<span><kbd>Drag</kbd> extend</span><span><kbd>Release</kbd> apply</span><span><kbd>Esc</kbd> cancel</span>'
            : '<span><kbd>Drag</kbd> resize</span><span><kbd>Click</kbd> other pane: target</span><span><kbd>Enter</kbd> apply</span><span><kbd>1-9</kbd> preset</span><span><kbd>Tab</kbd> move</span><span><kbd>Esc</kbd> close</span>';
        } else {
          hints.innerHTML = gtileSelecting
            ? '<span><kbd>hjkl</kbd> extend</span><span><kbd>Enter</kbd> apply</span><span><kbd>Esc</kbd> cancel</span>'
            : '<span><kbd>⇧hjkl</kbd> target</span><span><kbd>hjkl</kbd> cursor</span><span><kbd>Enter</kbd> anchor</span><span><kbd>r/R</kbd> rotate/reset</span><span><kbd>1-9</kbd> preset</span><span><kbd>Tab</kbd> move</span><span><kbd>Esc</kbd> close</span>';
        }
      }
    }
  }

  function handleGtileKeyDown(event) {
    // Switch hints back to keyboard on any keypress
    if (gtileMouseHints) {
      gtileMouseHints = false;
    }

    const key = event.key.toLowerCase();
    const code = event.code;

    // Escape during mouse drag — cancel drag
    if (key === 'escape' && gtileDrag) {
      cancelGtileDrag();
      updateGtileOverlay();
      return true;
    }

    // Tab — toggle sub-mode
    if (key === 'tab') {
      if (gtileDrag) cancelGtileDrag();
      gtileMouseSelecting = false;
      setGtileSubMode(gtileSubMode === 'move' ? 'resize' : 'move');
      updateGtileOverlay();
      return true;
    }

    // Escape
    if (key === 'escape') {
      if (gtileSubMode === 'resize' && (gtileSelecting || gtileMouseSelecting)) {
        gtileSelecting = false;
        gtileMouseSelecting = false;
        gtileAnchor = null;
        updateGtileOverlay();
      } else if (gtileSubMode === 'move' && gtileHeld) {
        gtileHeld = false;
        updateGtileOverlay();
      } else {
        exitGtileMode(false);
      }
      return true;
    }

    if (gtileSubMode === 'move') {
      return handleGtileMoveMode(event, key, code);
    } else {
      return handleGtileResizeMode(event, key, code);
    }
  }

  function handleGtileMoveMode(event, key, code) {
    let dir = null;
    if (key === 'h' || key === 'arrowleft' || code === 'KeyH') dir = 'left';
    else if (key === 'l' || key === 'arrowright' || code === 'KeyL') dir = 'right';
    else if (key === 'k' || key === 'arrowup' || code === 'KeyK') dir = 'up';
    else if (key === 'j' || key === 'arrowdown' || code === 'KeyJ') dir = 'down';

    if (dir) {
      if (event.shiftKey || gtileHeld) {
        performGtileSwap(dir);
      } else {
        const neighborIdx = findGtileNeighbor(dir);
        if (neighborIdx >= 0) {
          gtileActiveRegionIdx = neighborIdx;
          updateGtileOverlay();
        }
      }
      return true;
    }

    // R (shift+r): reset layout sizes
    if (event.shiftKey && (key === 'r' || code === 'KeyR')) {
      handleGtileReset();
      return true;
    }

    // r: rotate layout
    if (key === 'r' || code === 'KeyR') {
      handleGtileRotate();
      return true;
    }

    // Enter/Space: toggle held (grab/drop)
    if (key === 'enter' || key === ' ') {
      gtileHeld = !gtileHeld;
      updateGtileOverlay();
      return true;
    }

    // Number presets → switch to resize mode
    if (key >= '1' && key <= '9') {
      setGtileSubMode('resize');
      const preset = getGtilePreset(parseInt(key));
      if (preset) {
        gtileAnchor = { col: preset.col1, row: preset.row1 };
        gtileCursor.col = preset.col2 - 1;
        gtileCursor.row = preset.row2 - 1;
        gtileSelecting = true;
        updateGtileOverlay();
      }
      return true;
    }

    return true; // Swallow all keys
  }

  function handleGtileResizeMode(event, key, code) {
    // Shift+R: reset layout sizes (must be before shift catch-all)
    if (event.shiftKey && (key === 'r' || code === 'KeyR') && !gtileSelecting) {
      handleGtileReset();
      return true;
    }

    // Shift+direction: switch resize target to adjacent tab
    if (event.shiftKey) {
      let dir = null;
      if (key === 'h' || key === 'arrowleft' || code === 'KeyH') dir = 'left';
      else if (key === 'l' || key === 'arrowright' || code === 'KeyL') dir = 'right';
      else if (key === 'k' || key === 'arrowup' || code === 'KeyK') dir = 'up';
      else if (key === 'j' || key === 'arrowdown' || code === 'KeyJ') dir = 'down';

      if (dir) {
        switchGtileResizeTarget(dir);
        return true;
      }
      // Shift held with non-direction key — swallow without action
      return true;
    }

    // Movement (cursor)
    let moved = false;
    if (key === 'h' || key === 'arrowleft' || code === 'KeyH') {
      if (gtileCursor.col > 0) { gtileCursor.col--; moved = true; }
    } else if (key === 'l' || key === 'arrowright' || code === 'KeyL') {
      if (gtileCursor.col < GTILE_COLS - 1) { gtileCursor.col++; moved = true; }
    } else if (key === 'k' || key === 'arrowup' || code === 'KeyK') {
      if (gtileCursor.row > 0) { gtileCursor.row--; moved = true; }
    } else if (key === 'j' || key === 'arrowdown' || code === 'KeyJ') {
      if (gtileCursor.row < GTILE_ROWS - 1) { gtileCursor.row++; moved = true; }
    }

    if (moved) {
      updateGtileOverlay();
      return true;
    }

    // r: rotate layout (not during active selection)
    if ((key === 'r' || code === 'KeyR') && !gtileSelecting) {
      handleGtileRotate();
      return true;
    }

    // Enter/Space — anchor or confirm
    if (key === 'enter' || key === ' ') {
      if (!gtileSelecting) {
        gtileSelecting = true;
        gtileAnchor = { col: gtileCursor.col, row: gtileCursor.row };
        updateGtileOverlay();
      } else {
        exitGtileMode(true);
      }
      return true;
    }

    // Number presets
    if (key >= '1' && key <= '9') {
      const preset = getGtilePreset(parseInt(key));
      if (preset) {
        gtileAnchor = { col: preset.col1, row: preset.row1 };
        gtileCursor.col = preset.col2 - 1;
        gtileCursor.row = preset.row2 - 1;
        gtileSelecting = true;
        updateGtileOverlay();
      }
      return true;
    }

    return true; // Swallow all keys
  }

  function findGtileNeighbor(direction) {
    if (gtileTabRects.length === 0) return -1;
    const active = gtileTabRects[gtileActiveRegionIdx];
    if (!active) return -1;

    const ax = active.left + (100 - active.left - active.right) / 2;
    const ay = active.top + (100 - active.top - active.bottom) / 2;
    const aL = active.left;
    const aR = 100 - active.right;
    const aT = active.top;
    const aB = 100 - active.bottom;

    let bestIdx = -1;
    let bestDist = Infinity;

    for (let i = 0; i < gtileTabRects.length; i++) {
      if (i === gtileActiveRegionIdx) continue;
      const r = gtileTabRects[i];
      const rx = r.left + (100 - r.left - r.right) / 2;
      const ry = r.top + (100 - r.top - r.bottom) / 2;
      const rL = r.left;
      const rR = 100 - r.right;
      const rT = r.top;
      const rB = 100 - r.bottom;

      let valid = false;
      let dist = 0;

      if (direction === 'right' && rx > ax) {
        if (rB > aT + 1 && rT < aB - 1) { valid = true; dist = rx - ax; }
      } else if (direction === 'left' && rx < ax) {
        if (rB > aT + 1 && rT < aB - 1) { valid = true; dist = ax - rx; }
      } else if (direction === 'down' && ry > ay) {
        if (rR > aL + 1 && rL < aR - 1) { valid = true; dist = ry - ay; }
      } else if (direction === 'up' && ry < ay) {
        if (rR > aL + 1 && rL < aR - 1) { valid = true; dist = ay - ry; }
      }

      if (valid && dist < bestDist) {
        bestDist = dist;
        bestIdx = i;
      }
    }

    return bestIdx;
  }

  function performGtileSwap(direction) {
    const neighborIdx = findGtileNeighbor(direction);
    if (neighborIdx < 0) return;
    performGtileSwapByIndex(gtileActiveRegionIdx, neighborIdx);
    updateGtileOverlay();
  }

  function switchGtileResizeTarget(direction) {
    // Find the focused tab's index in gtileTabRects
    const currentIdx = gtileTabRects.findIndex(r => r.tab === gtileFocusedTab);
    if (currentIdx < 0) return;

    // Temporarily set activeRegionIdx to current target so findGtileNeighbor works
    const savedIdx = gtileActiveRegionIdx;
    gtileActiveRegionIdx = currentIdx;
    const neighborIdx = findGtileNeighbor(direction);
    gtileActiveRegionIdx = savedIdx;

    if (neighborIdx < 0) return;

    // Switch resize target
    gtileFocusedTab = gtileTabRects[neighborIdx].tab;
    // Reset selection when switching target
    gtileSelecting = false;
    gtileAnchor = null;
    updateGtileOverlay();
  }

  // --- Mouse support for gTile overlay ---

  function cancelGtileDrag() {
    if (!gtileDrag) return;
    const el = gtileRegionElements.get(gtileTabRects[gtileDrag.idx]?.tab);
    if (el) {
      el.classList.remove('gtile-dragging');
      el.style.transition = '';
    }
    if (gtileGhostEl) gtileGhostEl.style.display = 'none';
    // Revert swap partner position
    if (gtileDrag.swapIdx >= 0) {
      const origRect = gtileDrag.origRects[gtileDrag.swapIdx];
      const r = gtileTabRects[gtileDrag.swapIdx];
      r.left = origRect.left; r.top = origRect.top;
      r.right = origRect.right; r.bottom = origRect.bottom;
    }
    gtileDrag = null;
    updateGtileOverlay();
  }

  // Swap two panes in the split tree; the active region follows the first.
  function performGtileSwapByIndex(aIdx, bIdx) {
    const splitter = window.gZenViewSplitter;
    if (!splitter) return;
    const aRect = gtileTabRects[aIdx];
    const bRect = gtileTabRects[bIdx];
    const node1 = splitter.getSplitNodeFromTab(aRect.tab);
    const node2 = splitter.getSplitNodeFromTab(bRect.tab);
    if (!node1 || !node2) return;
    splitter.swapNodes(node1, node2);
    const viewData = splitter._data[splitter.currentView];
    splitter.applyGridLayout(viewData.layoutTree);
    const activeTab = aRect.tab;
    mapCurrentLayoutToGrid(viewData);
    gtileActiveRegionIdx = gtileTabRects.findIndex(r => r.tab === activeTab);
    if (gtileActiveRegionIdx < 0) gtileActiveRegionIdx = 0;
  }

  // Mouse state shared by the grid listeners and the document-level ones.
  let _gtileMoveMouseDown = null;   // { idx, startX, startY, offsetXPct, offsetYPct, regW, regH }
  let _gtileResizeMouseStart = null; // { x, y, potentialTargetTab }
  const GTILE_DRAG_THRESHOLD = 5;   // px — below this a press is a click, not a drag

  function setGtileSubMode(mode) {
    gtileSubMode = mode;
    gtileOverlay.classList.toggle('mode-move', mode === 'move');
    gtileOverlay.classList.toggle('mode-resize', mode === 'resize');
    gtileSelecting = false;
    gtileAnchor = null;
    if (mode === 'resize') {
      gtileHeld = false;
      const activeRect = gtileTabRects[gtileActiveRegionIdx];
      if (activeRect) {
        gtileFocusedTab = activeRect.tab;
        // Position cell cursor at center of that region
        const cx = (activeRect.left + (100 - activeRect.right)) / 2;
        const cy = (activeRect.top + (100 - activeRect.bottom)) / 2;
        gtileCursor.col = Math.max(0, Math.min(GTILE_COLS - 1, Math.round(cx / 100 * GTILE_COLS - 0.5)));
        gtileCursor.row = Math.max(0, Math.min(GTILE_ROWS - 1, Math.round(cy / 100 * GTILE_ROWS - 0.5)));
      }
    }
  }

  // Grid cell under a mouse event, clamped to the grid.
  function gtileCellAt(grid, e) {
    const gridRect = grid.getBoundingClientRect();
    return {
      col: Math.max(0, Math.min(GTILE_COLS - 1, Math.floor((e.clientX - gridRect.left) / gridRect.width * GTILE_COLS))),
      row: Math.max(0, Math.min(GTILE_ROWS - 1, Math.floor((e.clientY - gridRect.top) / gridRect.height * GTILE_ROWS))),
    };
  }

  // Listeners on the overlay's own elements (live as long as the overlay).
  function setupGtileMouseEvents(grid, cellLayer, modeSwitch) {
    // --- Hint detection: mouse hints on grid hover, revert on leave ---
    grid.addEventListener('mousemove', () => {
      if (!gtileMode) return;
      if (!gtileMouseHints) {
        gtileMouseHints = true;
        updateGtileOverlay();
      }
    }, { passive: true });

    grid.addEventListener('mouseleave', () => {
      if (!gtileMode) return;
      if (gtileMouseHints && !(gtileDrag && gtileDrag.isDragging) && !gtileMouseSelecting) {
        gtileMouseHints = false;
        updateGtileOverlay();
      }
    }, { passive: true });

    // --- Mode switch: clickable ---
    modeSwitch.querySelectorAll('.gtile-mode-btn').forEach(btn => {
      btn.style.cursor = 'pointer';
      btn.addEventListener('click', (e) => {
        if (!gtileMode) return;
        e.stopPropagation();
        const newMode = btn.dataset.mode;
        if (newMode === gtileSubMode) return;
        setGtileSubMode(newMode);
        updateGtileOverlay();
      });
    });

    // --- Move mode: click to select, drag to grab & swap ---
    grid.addEventListener('mousedown', (e) => {
      if (!gtileMode || gtileSubMode !== 'move' || e.button !== 0) return;

      // Find which region was clicked
      const regionEl = e.target.closest('.zenleap-gtile-region');
      if (!regionEl) return;

      const clickedTab = [...gtileRegionElements.entries()].find(([, el]) => el === regionEl)?.[0];
      if (!clickedTab) return;
      const idx = gtileTabRects.findIndex(r => r.tab === clickedTab);
      if (idx < 0) return;

      e.preventDefault();
      gtileActiveRegionIdx = idx;

      const gridRect = grid.getBoundingClientRect();
      const regionRect = regionEl.getBoundingClientRect();
      const rect = gtileTabRects[idx];
      _gtileMoveMouseDown = {
        idx,
        startX: e.clientX, startY: e.clientY,
        offsetXPct: (e.clientX - regionRect.left) / gridRect.width * 100,
        offsetYPct: (e.clientY - regionRect.top) / gridRect.height * 100,
        regW: 100 - rect.left - rect.right,
        regH: 100 - rect.top - rect.bottom,
      };
      updateGtileOverlay();
    });

    // --- Resize mode: hover tracking on cells ---
    cellLayer.addEventListener('mousemove', (e) => {
      if (!gtileMode || gtileSubMode !== 'resize') return;
      const cell = gtileCellAt(grid, e);
      gtileCursor.col = cell.col;
      gtileCursor.row = cell.row;
      updateGtileOverlay();
    });

    // --- Resize mode: press starts a cell selection at the pressed cell. On
    // release, a drag applies the layout; a click (no movement) only sets the
    // anchor (Enter applies) or, on another pane, makes it the resize target.
    // A plain click used to apply a 1×1-cell layout (LEAP-B-12).
    cellLayer.addEventListener('mousedown', (e) => {
      if (!gtileMode || gtileSubMode !== 'resize' || e.button !== 0) return;
      e.preventDefault();

      const gridRect = grid.getBoundingClientRect();
      const clickXPct = (e.clientX - gridRect.left) / gridRect.width * 100;
      const clickYPct = (e.clientY - gridRect.top) / gridRect.height * 100;

      // Check if click is over a non-target region (for potential target change on simple click)
      let potentialTargetTab = null;
      for (const rect of gtileTabRects) {
        if (rect.tab === gtileFocusedTab) continue;
        if (clickXPct >= rect.left && clickXPct <= (100 - rect.right) &&
            clickYPct >= rect.top && clickYPct <= (100 - rect.bottom)) {
          potentialTargetTab = rect.tab;
          break;
        }
      }

      _gtileResizeMouseStart = { x: e.clientX, y: e.clientY, potentialTargetTab };

      const cell = gtileCellAt(grid, e);
      gtileAnchor = { col: cell.col, row: cell.row };
      gtileCursor.col = cell.col;
      gtileCursor.row = cell.row;
      gtileSelecting = true;
      gtileMouseSelecting = true;
      updateGtileOverlay();
    });
  }

  // Document-level listeners (drags may leave the grid). Attached while gTile
  // is open and removed again when it closes (LEAP-B-31).
  function attachGtileDocListeners() {
    _gtileDocAbort?.abort();
    _gtileDocAbort = new AbortController();
    const grid = gtileOverlay?.querySelector('#zenleap-gtile-grid');
    if (!grid) return;
    const passiveSig = { passive: true, signal: _gtileDocAbort.signal };
    const sig = { signal: _gtileDocAbort.signal };

    // Move mode: drag a region to swap it with the one under the pointer
    document.addEventListener('mousemove', (e) => {
      if (!_gtileMoveMouseDown || !gtileMode || gtileSubMode !== 'move') return;

      const dx = e.clientX - _gtileMoveMouseDown.startX;
      const dy = e.clientY - _gtileMoveMouseDown.startY;

      if (!gtileDrag && Math.sqrt(dx * dx + dy * dy) < GTILE_DRAG_THRESHOLD) return;

      // Enter drag mode
      if (!gtileDrag) {
        gtileDrag = {
          idx: _gtileMoveMouseDown.idx,
          isDragging: true,
          swapIdx: -1,
          origRects: gtileTabRects.map(r => ({ left: r.left, top: r.top, right: r.right, bottom: r.bottom })),
          offsetXPct: _gtileMoveMouseDown.offsetXPct,
          offsetYPct: _gtileMoveMouseDown.offsetYPct,
          regW: _gtileMoveMouseDown.regW,
          regH: _gtileMoveMouseDown.regH,
        };

        const regionEl = gtileRegionElements.get(gtileTabRects[gtileDrag.idx]?.tab);
        if (regionEl) {
          regionEl.classList.add('gtile-dragging');
          // Disable position transitions on dragged element
          regionEl.style.transition = 'transform 0.12s ease-out, box-shadow 0.15s, border-color 0.15s';
        }

        // Show ghost at original position
        if (gtileGhostEl) {
          gtileGhostEl.style.display = 'block';
          gtileGhostEl.style.inset = gtileInset(gtileDrag.origRects[gtileDrag.idx]);
        }
        updateGtileOverlay();
      }

      // Position dragged region following mouse
      const gridRect = grid.getBoundingClientRect();
      const mxPct = (e.clientX - gridRect.left) / gridRect.width * 100;
      const myPct = (e.clientY - gridRect.top) / gridRect.height * 100;
      const newL = Math.max(0, Math.min(100 - gtileDrag.regW, mxPct - gtileDrag.offsetXPct));
      const newT = Math.max(0, Math.min(100 - gtileDrag.regH, myPct - gtileDrag.offsetYPct));

      const regionEl = gtileRegionElements.get(gtileTabRects[gtileDrag.idx]?.tab);
      if (regionEl) {
        regionEl.style.inset = gtileInset({ left: newL, top: newT, right: 100 - newL - gtileDrag.regW, bottom: 100 - newT - gtileDrag.regH });
      }

      // Hit test: which original region zone is mouse cursor over?
      let bestIdx = -1;
      for (let i = 0; i < gtileTabRects.length; i++) {
        if (i === gtileDrag.idx) continue;
        const o = gtileDrag.origRects[i];
        if (mxPct >= o.left && mxPct <= (100 - o.right) && myPct >= o.top && myPct <= (100 - o.bottom)) {
          bestIdx = i;
          break;
        }
      }

      // Update swap partner if changed
      if (bestIdx !== gtileDrag.swapIdx) {
        // Revert previous partner
        if (gtileDrag.swapIdx >= 0) {
          Object.assign(gtileTabRects[gtileDrag.swapIdx], gtileDrag.origRects[gtileDrag.swapIdx]);
        }
        if (bestIdx >= 0) {
          // Partner takes the dragged region's place; ghost marks the landing zone
          Object.assign(gtileTabRects[bestIdx], gtileDrag.origRects[gtileDrag.idx]);
          if (gtileGhostEl) gtileGhostEl.style.inset = gtileInset(gtileDrag.origRects[bestIdx]);
        } else if (gtileGhostEl) {
          // No partner: ghost at drag origin
          gtileGhostEl.style.inset = gtileInset(gtileDrag.origRects[gtileDrag.idx]);
        }
        gtileDrag.swapIdx = bestIdx;
        updateGtileOverlay();
      }
    }, passiveSig);

    document.addEventListener('mouseup', () => {
      if (!gtileMode || gtileSubMode !== 'move') { _gtileMoveMouseDown = null; return; }
      if (!_gtileMoveMouseDown) return;

      if (gtileDrag && gtileDrag.isDragging) {
        const draggedEl = gtileRegionElements.get(gtileTabRects[gtileDrag.idx]?.tab);
        if (draggedEl) {
          draggedEl.classList.remove('gtile-dragging');
          draggedEl.style.transition = '';
        }
        if (gtileGhostEl) gtileGhostEl.style.display = 'none';

        const { idx: aIdx, swapIdx: bIdx, origRects } = gtileDrag;
        // Restore original rects (the real swap re-maps them from the tree)
        gtileTabRects.forEach((r, i) => Object.assign(r, origRects[i]));
        gtileDrag = null;
        if (bIdx >= 0) {
          performGtileSwapByIndex(aIdx, bIdx);
          flashGtileGrid('gtile-rotated'); // green-ish confirmation pulse
        }
        updateGtileOverlay();
      }

      _gtileMoveMouseDown = null;
    }, sig);

    // Resize mode: drag extends the selection (also outside the cells)
    document.addEventListener('mousemove', (e) => {
      if (!gtileMode || gtileSubMode !== 'resize' || !gtileMouseSelecting) return;
      const cell = gtileCellAt(grid, e);
      gtileCursor.col = cell.col;
      gtileCursor.row = cell.row;
      updateGtileOverlay();
    }, passiveSig);

    // Release: a drag applies the selection; a click keeps it as an anchor
    // (Enter applies) or changes the resize target when it hit another pane.
    document.addEventListener('mouseup', (e) => {
      if (!gtileMode || gtileSubMode !== 'resize' || !gtileMouseSelecting) return;
      gtileMouseSelecting = false;

      const start = _gtileResizeMouseStart;
      _gtileResizeMouseStart = null;
      const didDrag = start &&
        (Math.abs(e.clientX - start.x) > GTILE_DRAG_THRESHOLD ||
         Math.abs(e.clientY - start.y) > GTILE_DRAG_THRESHOLD);

      if (!didDrag) {
        if (start?.potentialTargetTab) {
          // Simple click on a non-target region — change resize target
          gtileFocusedTab = start.potentialTargetTab;
          gtileSelecting = false;
          gtileAnchor = null;
        }
        updateGtileOverlay();
        return;
      }

      // Drag completed — apply the layout (same as pressing Enter with a selection)
      if (gtileSelecting && gtileAnchor) {
        exitGtileMode(true);
      }
    }, sig);
  }

  // Short feedback animation on the grid: gtile-rotated, gtile-reset, gtile-error.
  function flashGtileGrid(cls) {
    const grid = gtileOverlay?.querySelector('#zenleap-gtile-grid');
    if (!grid) return;
    grid.classList.remove(cls);
    void grid.offsetHeight; // restart the animation
    grid.classList.add(cls);
    setTimeout(() => grid.classList.remove(cls), 400);
  }

  // After the layout changed (rotate/reset): re-read the regions and keep the
  // active pane (move mode) or resize target (resize mode).
  function refreshGtileAfterLayoutChange() {
    const splitter = window.gZenViewSplitter;
    const activeTab = gtileSubMode === 'move' ? gtileTabRects[gtileActiveRegionIdx]?.tab : gtileFocusedTab;
    mapCurrentLayoutToGrid(splitter._data[splitter.currentView]);
    if (gtileSubMode === 'resize') {
      // Cell coordinates are meaningless after a layout change
      gtileSelecting = false;
      gtileAnchor = null;
      gtileCursor = { col: 0, row: 0 };
    }
    if (activeTab) {
      const newIdx = gtileTabRects.findIndex(r => r.tab === activeTab);
      gtileActiveRegionIdx = newIdx >= 0 ? newIdx : 0;
    }
    updateGtileOverlay();
  }

  // Tabs of a split tree's leaves in visual order (left-to-right / top-to-bottom).
  function splitLeafTabs(node, out = []) {
    if (!node) return out;
    if (!node.children || node.children.length === 0) {
      if (node.tab) out.push(node.tab);
    } else {
      node.children.forEach(child => splitLeafTabs(child, out));
    }
    return out;
  }

  // --- Split Layout Rotation ---
  // Cycles through 4 arrangements for 3-tab layouts:
  //   1. row: [single, col:[a,b]]  — left single, right stacked
  //   2. row: [col:[a,b], single]  — right single, left stacked
  //   3. col: [single, row:[a,b]]  — top single, bottom side-by-side
  //   4. col: [row:[a,b], single]  — bottom single, top side-by-side
  // For 2 tabs: toggles row ↔ column direction.
  function rotateSplitLayout() {
    const splitter = window.gZenViewSplitter;
    if (!splitter?.splitViewActive) return false;

    const viewData = splitter._data[splitter.currentView];
    if (!viewData?.layoutTree) return false;

    const root = viewData.layoutTree;
    const tabs = viewData.tabs;
    if (!tabs || tabs.length < 2) return false;

    // 2 tabs: simple direction toggle
    if (tabs.length === 2) {
      if (root.direction === 'row') {
        root.direction = 'column';
      } else if (root.direction === 'column') {
        root.direction = 'row';
      }
      commitSplitTree(viewData, root);
      return true;
    }

    // 3 tabs: cycle through 6 arrangements
    // 0: left single  | right 2 stacked vertically   (root=row, [leaf, col])
    // 1: right single | left 2 stacked vertically     (root=row, [col, leaf])
    // 2: top single   | bottom 2 side-by-side         (root=column, [leaf, row])
    // 3: bottom single| top 2 side-by-side            (root=column, [row, leaf])
    // 4: 3 vertical columns                           (root=row, [leaf, leaf, leaf])
    // 5: 3 horizontal rows                            (root=column, [leaf, leaf, leaf])
    if (tabs.length === 3) {
      const classes = getNodeClasses();
      if (!classes) return false;

      // Collect all 3 tabs in current visual order (left-to-right / top-to-bottom)
      const allTabs = splitLeafTabs(root);
      if (allTabs.length !== 3) return false;

      // Detect current position and identify single/pair tabs
      let pos;
      let singleTab = null;
      let pairTabs = [];
      const isAllLeaves = root.children?.length === 3 &&
        root.children.every(c => !c.children || c.children.length === 0);

      if (isAllLeaves) {
        pos = root.direction === 'row' ? 4 : 5;
      } else if (root.children?.length === 2) {
        const [first, second] = root.children;
        const firstIsLeaf = !first.children || first.children.length === 0;
        const secondIsLeaf = !second.children || second.children.length === 0;

        if (firstIsLeaf && !secondIsLeaf) {
          singleTab = first.tab;
          pairTabs = second.children.filter(c => c.tab).map(c => c.tab);
        } else if (!firstIsLeaf && secondIsLeaf) {
          singleTab = second.tab;
          pairTabs = first.children.filter(c => c.tab).map(c => c.tab);
        }

        if (root.direction === 'row' && firstIsLeaf) pos = 0;
        else if (root.direction === 'row' && !firstIsLeaf) pos = 1;
        else if (root.direction === 'column' && firstIsLeaf) pos = 2;
        else pos = 3;
      } else {
        pos = -1; // unknown layout, start from 0
      }

      const nextPos = (pos + 1) % 6;
      const size3 = parseFloat((100 / 3).toFixed(4));

      let newRoot;
      if (nextPos === 4) {
        // 3 vertical columns
        newRoot = new classes.SplitNode('row', 100);
        newRoot.children = [
          new classes.LeafNode(allTabs[0], size3),
          new classes.LeafNode(allTabs[1], size3),
          new classes.LeafNode(allTabs[2], size3),
        ];
      } else if (nextPos === 5) {
        // 3 horizontal rows
        newRoot = new classes.SplitNode('column', 100);
        newRoot.children = [
          new classes.LeafNode(allTabs[0], size3),
          new classes.LeafNode(allTabs[1], size3),
          new classes.LeafNode(allTabs[2], size3),
        ];
      } else {
        // Positions 0-3: single + pair arrangements
        // Preserve single tab identity across rotations; fall back to first tab
        if (!singleTab || pairTabs.length !== 2) {
          singleTab = allTabs[0];
          pairTabs = [allTabs[1], allTabs[2]];
        }

        const singleLeaf = new classes.LeafNode(singleTab, 50);
        const pairLeafA = new classes.LeafNode(pairTabs[0], 50);
        const pairLeafB = new classes.LeafNode(pairTabs[1], 50);

        const pairDir = (nextPos <= 1) ? 'column' : 'row';
        const rootDir = (nextPos <= 1) ? 'row' : 'column';
        const singleFirst = (nextPos === 0 || nextPos === 2);

        const pairNode = new classes.SplitNode(pairDir, 50);
        pairNode.children = [pairLeafA, pairLeafB];

        newRoot = new classes.SplitNode(rootDir, 100);
        newRoot.children = singleFirst
          ? [singleLeaf, pairNode]
          : [pairNode, singleLeaf];
      }

      // Apply
      commitSplitTree(viewData, newRoot);
      return true;
    }

    // 4+ tabs: cycle through toggle + all-columns + all-rows
    // Detect if all children are direct leaves of root
    const classes4 = getNodeClasses();
    if (!classes4) return false;

    const allTabs4 = splitLeafTabs(root);
    if (allTabs4.length < 2) return false;

    const isAllLeaves4 = root.children?.length === allTabs4.length &&
      root.children.every(c => !c.children || c.children.length === 0);

    const size4 = parseFloat((100 / allTabs4.length).toFixed(4));

    if (isAllLeaves4 && root.direction === 'row') {
      // Currently all-columns → next is all-rows
      const newRoot = new classes4.SplitNode('column', 100);
      newRoot.children = allTabs4.map(t => new classes4.LeafNode(t, size4));
      commitSplitTree(viewData, newRoot);
    } else if (isAllLeaves4 && root.direction === 'column') {
      // Currently all-rows → next is toggle directions (back to nested layout)
      // Rebuild as default 2x2 grid (row of two columns)
      const half = Math.ceil(allTabs4.length / 2);
      const leftTabs = allTabs4.slice(0, half);
      const rightTabs = allTabs4.slice(half);

      const leftNode = new classes4.SplitNode('column', 50);
      leftNode.children = leftTabs.map(t => new classes4.LeafNode(t, parseFloat((100 / leftTabs.length).toFixed(4))));
      const rightNode = new classes4.SplitNode('column', 50);
      rightNode.children = rightTabs.map(t => new classes4.LeafNode(t, parseFloat((100 / rightTabs.length).toFixed(4))));

      const newRoot = new classes4.SplitNode('row', 100);
      newRoot.children = [leftNode, rightNode];
      commitSplitTree(viewData, newRoot);
    } else {
      // Nested layout → next is all-columns
      const newRoot = new classes4.SplitNode('row', 100);
      newRoot.children = allTabs4.map(t => new classes4.LeafNode(t, size4));
      commitSplitTree(viewData, newRoot);
    }
    return true;
  }

  function handleGtileRotate() {
    if (rotateSplitLayout()) {
      refreshGtileAfterLayoutChange();
      flashGtileGrid('gtile-rotated');
    }
  }

  function resetLayoutSizes() {
    const splitter = window.gZenViewSplitter;
    if (!splitter?.splitViewActive) return false;

    const viewData = splitter._data[splitter.currentView];
    if (!viewData?.layoutTree) return false;

    function normalizeSizes(node) {
      if (!node.children || node.children.length === 0) return;
      const equalSize = parseFloat((100 / node.children.length).toFixed(4));
      for (const child of node.children) {
        child.sizeInParent = equalSize;
        normalizeSizes(child);
      }
    }
    normalizeSizes(viewData.layoutTree);

    splitter.removeSplitters();
    splitter.applyGridLayout(viewData.layoutTree);
    return true;
  }

  function handleGtileReset() {
    if (resetLayoutSizes()) {
      refreshGtileAfterLayoutChange();
      flashGtileGrid('gtile-reset');
    }
  }

  function getGtilePreset(num) {
    switch (num) {
      case 1: return { col1: 0, row1: 0, col2: 3, row2: GTILE_ROWS }; // left half
      case 2: return { col1: 3, row1: 0, col2: GTILE_COLS, row2: GTILE_ROWS }; // right half
      case 3: return { col1: 0, row1: 0, col2: GTILE_COLS, row2: 2 }; // top half
      case 4: return { col1: 0, row1: 2, col2: GTILE_COLS, row2: GTILE_ROWS }; // bottom half
      case 5: return { col1: 0, row1: 0, col2: 4, row2: GTILE_ROWS }; // left 2/3
      case 6: return { col1: 2, row1: 0, col2: GTILE_COLS, row2: GTILE_ROWS }; // right 2/3
      case 7: return { col1: 0, row1: 0, col2: 2, row2: GTILE_ROWS }; // left 1/3
      case 8: return { col1: 2, row1: 0, col2: 4, row2: GTILE_ROWS }; // center 1/3
      case 9: return { col1: 4, row1: 0, col2: GTILE_COLS, row2: GTILE_ROWS }; // right 1/3
      default: return null;
    }
  }

  // --- gTile Layout Application ---

  function applyGtileLayout() {
    if (!gtileAnchor || !gtileFocusedTab) return;

    const splitter = window.gZenViewSplitter;
    if (!splitter?.splitViewActive) return;

    const viewData = splitter._data[splitter.currentView];
    if (!viewData?.tabs) return;

    // Get selected rectangle for the focused tab
    const selCol1 = Math.min(gtileAnchor.col, gtileCursor.col);
    const selRow1 = Math.min(gtileAnchor.row, gtileCursor.row);
    const selCol2 = Math.max(gtileAnchor.col, gtileCursor.col) + 1;
    const selRow2 = Math.max(gtileAnchor.row, gtileCursor.row) + 1;

    const focusedRect = { tab: gtileFocusedTab, col1: selCol1, row1: selRow1, col2: selCol2, row2: selRow2 };

    const otherTabs = viewData.tabs.filter(t => t !== gtileFocusedTab);
    if (otherTabs.length === 0) return;

    // Build occupancy grid
    const occupied = [];
    for (let r = 0; r < GTILE_ROWS; r++) {
      occupied.push([]);
      for (let c = 0; c < GTILE_COLS; c++) {
        occupied[r].push(r >= selRow1 && r < selRow2 && c >= selCol1 && c < selCol2);
      }
    }

    const classes = getNodeClasses();
    if (!classes) {
      reportError('gTile', 'could not get split node classes');
      return;
    }

    // Best tiling of the remaining space, other tabs assigned by proximity
    const assignedRects = chooseRemainingLayout(focusedRect, otherTabs, occupied, classes);
    if (!assignedRects) {
      log('gTile: No valid layout found — selection leaves no valid partition for remaining tabs');
      flashGtileGrid('gtile-error');
      return;
    }

    const tree = buildSplitTreeFromRects([focusedRect, ...assignedRects], GTILE_COLS, GTILE_ROWS, classes);
    if (!tree) {
      log('gTile: Failed to build split tree from rectangles');
      flashGtileGrid('gtile-error');
      return;
    }

    // Apply the new layout
    try {
      commitSplitTree(viewData, tree);
      log('gTile: Layout applied successfully');
    } catch (e) {
      reportError('gTile: applying layout failed', e);
    }
  }

  // All ways to tile the unoccupied cells with exactly numRects rectangles.
  // The grid is 6×4 and at most 3 other panes remain, so this stays small.
  function enumeratePartitions(occupied, numRects, cols, rows, limit = 5000) {
    const results = [];
    const walk = (occ, left, acc) => {
      if (results.length >= limit) return;
      let startR = -1, startC = -1;
      for (let r = 0; r < rows && startR === -1; r++) {
        for (let c = 0; c < cols && startR === -1; c++) {
          if (!occ[r][c]) { startR = r; startC = c; }
        }
      }
      if (startR === -1) {
        if (left === 0) results.push(acc);
        return;
      }
      if (left === 0) return;
      for (let endC = startC + 1; endC <= cols && !occ[startR][endC - 1]; endC++) {
        for (let endR = startR + 1; endR <= rows; endR++) {
          let free = true;
          for (let c = startC; c < endC && free; c++) if (occ[endR - 1][c]) free = false;
          if (!free) break;
          const next = occ.map(row => [...row]);
          for (let r = startR; r < endR; r++) for (let c = startC; c < endC; c++) next[r][c] = true;
          walk(next, left - 1, [...acc, { col1: startC, row1: startR, col2: endC, row2: endR }]);
        }
      }
    };
    walk(occupied, numRects, []);
    return results;
  }

  function permutations(items) {
    if (items.length <= 1) return [items];
    const out = [];
    items.forEach((item, i) => {
      for (const rest of permutations([...items.slice(0, i), ...items.slice(i + 1)])) out.push([item, ...rest]);
    });
    return out;
  }

  // Pick the best way to lay out the other panes around the focused one:
  // balanced areas, no slivers, and panes staying close to where they were
  // (the old depth-first search returned the first, often lopsided, tiling:
  // LEAP-B-11). Returns [{tab, col1, row1, col2, row2}] or null.
  function chooseRemainingLayout(focusedRect, otherTabs, occupied, classes) {
    const splitter = window.gZenViewSplitter;
    const centerOf = (tab) => {
      const pos = splitter.getSplitNodeFromTab(tab)?.positionToRoot;
      return pos ? { x: (pos.left + 100 - pos.right) / 2, y: (pos.top + 100 - pos.bottom) / 2 } : { x: 50, y: 50 };
    };
    const tabCenters = otherTabs.map(centerOf);
    // Physical cell size: the grid is drawn 16:9, so a cell is (16/6):(9/4)
    const cellW = 16 / GTILE_COLS, cellH = 9 / GTILE_ROWS;
    let best = null;
    for (const regions of enumeratePartitions(occupied, otherTabs.length, GTILE_COLS, GTILE_ROWS)) {
      const areas = regions.map(r => (r.col2 - r.col1) * (r.row2 - r.row1));
      const total = areas.reduce((a, b) => a + b, 0);
      const imbalance = (Math.max(...areas) - Math.min(...areas)) / total;
      const sliver = regions.reduce((sum, r) => {
        const w = (r.col2 - r.col1) * cellW, h = (r.row2 - r.row1) * cellH;
        return sum + Math.max(0, Math.max(w / h, h / w) - 2.5);
      }, 0);
      const centers = regions.map(r => ({
        x: ((r.col1 + r.col2) / 2) / GTILE_COLS * 100,
        y: ((r.row1 + r.row2) / 2) / GTILE_ROWS * 100,
      }));
      for (const order of permutations(regions.map((_, i) => i))) {
        const moved = order.reduce((sum, ri, t) =>
          sum + Math.hypot(tabCenters[t].x - centers[ri].x, tabCenters[t].y - centers[ri].y), 0) / (100 * otherTabs.length);
        const score = imbalance * 3 + sliver + moved;
        if (best && score >= best.score) continue;
        const assigned = order.map((ri, t) => ({ tab: otherTabs[t], ...regions[ri] }));
        // Only layouts expressible as nested row/column splits are usable
        if (!buildSplitTreeFromRects([focusedRect, ...assigned], GTILE_COLS, GTILE_ROWS, classes)) continue;
        best = { score, assigned };
      }
    }
    return best ? best.assigned : null;
  }

  function buildSplitTreeFromRects(tabRects, cols, rows, classes) {
    if (tabRects.length === 0) return null;

    if (tabRects.length === 1) {
      return new classes.LeafNode(tabRects[0].tab, 100);
    }

    // Try vertical cuts: find all column boundaries where no rect crosses
    const vCuts = [];
    for (let c = 1; c < cols; c++) {
      if (tabRects.every(r => r.col2 <= c || r.col1 >= c)) {
        vCuts.push(c);
      }
    }

    if (vCuts.length > 0) {
      const boundaries = [0, ...vCuts, cols];
      const children = [];

      for (let i = 0; i < boundaries.length - 1; i++) {
        const lb = boundaries[i];
        const rb = boundaries[i + 1];
        const sliceRects = tabRects
          .filter(r => r.col1 >= lb && r.col2 <= rb)
          .map(r => ({ ...r, col1: r.col1 - lb, col2: r.col2 - lb }));

        if (sliceRects.length === 0) continue;

        const child = buildSplitTreeFromRects(sliceRects, rb - lb, rows, classes);
        if (!child) return null;
        child.sizeInParent = (rb - lb) / cols * 100;
        children.push(child);
      }

      if (children.length === 1) return children[0];

      const node = new classes.SplitNode("row", 100);
      node.children = children;
      return node;
    }

    // Try horizontal cuts
    const hCuts = [];
    for (let r = 1; r < rows; r++) {
      if (tabRects.every(rect => rect.row2 <= r || rect.row1 >= r)) {
        hCuts.push(r);
      }
    }

    if (hCuts.length > 0) {
      const boundaries = [0, ...hCuts, rows];
      const children = [];

      for (let i = 0; i < boundaries.length - 1; i++) {
        const tb = boundaries[i];
        const bb = boundaries[i + 1];
        const sliceRects = tabRects
          .filter(r => r.row1 >= tb && r.row2 <= bb)
          .map(r => ({ ...r, row1: r.row1 - tb, row2: r.row2 - tb }));

        if (sliceRects.length === 0) continue;

        const child = buildSplitTreeFromRects(sliceRects, cols, bb - tb, classes);
        if (!child) return null;
        child.sizeInParent = (bb - tb) / rows * 100;
        children.push(child);
      }

      if (children.length === 1) return children[0];

      const node = new classes.SplitNode("column", 100);
      node.children = children;
      return node;
    }

    // No valid cuts — layout is not representable as a split tree
    return null;
  }

  function getSearchResultBadgesHtml({ workspaceName = null, isEssential = false } = {}) {
    const badges = [];

    if (isEssential) {
      badges.push('<span class="zenleap-search-result-badge zenleap-search-result-essential">Essential</span>');
    } else if (workspaceName) {
      badges.push(`<span class="zenleap-search-result-badge zenleap-search-result-ws">${escapeHtml(workspaceName)}</span>`);
    }

    if (badges.length === 0) return '';
    return `<span class="zenleap-search-result-badges">${badges.join('')}</span>`;
  }

  // Render search results
  function renderSearchResults() {
    if (!searchResultsList) return;

    searchResults = searchTabs(searchQuery);

    if (searchResults.length === 0) {
      searchResultsList.innerHTML = '<div class="zenleap-search-empty">No matching tabs found</div>';
      hidePreviewPanel(true);
      return;
    }

    // Clamp selected index
    if (searchSelectedIndex >= searchResults.length) {
      searchSelectedIndex = searchResults.length - 1;
    }
    if (searchSelectedIndex < 0) {
      searchSelectedIndex = 0;
    }

    let html = '';
    searchResults.forEach((result, idx) => {
      const tab = result.tab;
      const title = tab.label || 'Untitled';
      const url = tab.linkedBrowser?.currentURI?.spec || '';
      // Use default favicon if none available, and ensure it's a safe string
      let favicon = tab.image;
      if (!favicon || typeof favicon !== 'string' || favicon.trim() === '') {
        favicon = 'chrome://branding/content/icon32.png';
      }
      const isSelected = idx === searchSelectedIndex;
      const label = idx < 9 ? idx + 1 : ''; // Only 1-9 have quick jump labels

      const highlightedTitle = highlightMatches(title, result.titleIndices);
      const highlightedUrl = highlightMatches(url, result.urlIndices);

      const badges = getSearchResultBadgesHtml({
        workspaceName: result.workspaceName,
        isEssential: result.isEssential
      });

      html += `
        <div class="zenleap-search-result ${isSelected ? 'selected' : ''}" data-index="${idx}">
          <img class="zenleap-search-result-favicon" src="${escapeHtml(favicon)}" />
          <div class="zenleap-search-result-info">
            <div class="zenleap-search-result-title"><span class="zenleap-search-result-title-text">${highlightedTitle}</span>${badges}</div>
            <div class="zenleap-search-result-url">${highlightedUrl}</div>
          </div>
          ${label ? `<span class="zenleap-search-result-label">${label}</span>` : ''}
        </div>
      `;
    });

    searchResultsList.innerHTML = html;

    // Update hint bar
    updateSearchHintBar();

    // Scroll selected into view
    const selectedEl = searchResultsList.querySelector('.zenleap-search-result.selected');
    if (selectedEl) {
      selectedEl.scrollIntoView({ block: 'nearest', behavior: 'auto' });
    }

    // Show preview panel for selected tab in search mode (debounced)
    if (searchResults.length > 0) {
      const selectedResult = searchResults[searchSelectedIndex];
      if (selectedResult?.tab) {
        hidePreviewPanelVisual();
        previewDebounceTimer = setTimeout(() => {
          showPreviewForTab(selectedResult.tab, { force: true });
          positionPreviewPanelForModal();
        }, S['timing.previewDelay']);
      } else {
        hidePreviewPanelVisual();
      }
    }
  }

  // Render command palette results
  function renderCommandResults() {
    if (!searchResultsList) return;

    let results;
    if (commandSubFlow) {
      results = getSubFlowResults();
    } else {
      results = filterCommands(commandQuery);
    }
    commandResults = results;

    if (results.length === 0) {
      const emptyMsg = commandSubFlow ? 'No results found' : 'No matching commands';
      searchResultsList.innerHTML = `<div class="zenleap-search-empty">${emptyMsg}</div>`;
      updateSearchHintBar();
      hidePreviewPanel(true);
      return;
    }

    // Clamp selected index
    if (searchSelectedIndex >= results.length) searchSelectedIndex = results.length - 1;
    if (searchSelectedIndex < 0) searchSelectedIndex = 0;

    let html = '';

    // Show tab count for tab-search sub-flow
    if (commandSubFlow?.type === 'tab-search' && commandQuery) {
      html += `<div class="zenleap-command-count">${commandMatchedTabs.length} tab${commandMatchedTabs.length !== 1 ? 's' : ''} match${commandMatchedTabs.length === 1 ? 'es' : ''} — press Enter to choose action</div>`;
    }

    // Show count header for dedup-preview sub-flow
    if (commandSubFlow?.type === 'dedup-preview') {
      const count = dedupTabsToClose.length;
      if (count > 0) {
        html += `<div class="zenleap-command-count">${count} duplicate${count !== 1 ? 's' : ''} found — choose "Close" to close them</div>`;
      }
    }

    // When showing all commands (no query, no sub-flow), group by section
    const showGroups = !commandQuery && !commandSubFlow;
    let lastGroupId = null;

    results.forEach((cmd, idx) => {
      const isSelected = idx === searchSelectedIndex;
      const label = idx < 9 ? idx + 1 : '';

      // Insert group header if entering a new group
      if (showGroups && !cmd.isTab) {
        const groupId = _commandGroupMap.get(cmd.key);
        if (groupId && groupId !== lastGroupId) {
          lastGroupId = groupId;
          const group = COMMAND_GROUPS.find(g => g.id === groupId);
          if (group) {
            html += `<div class="zenleap-command-group-header"><span class="zenleap-command-group-icon">${iconHtml(group.icon)}</span>${escapeHtml(group.label)}</div>`;
          }
        }
      }

      if (cmd.isTab) {
        // Tab result (for sub-flows like tab-search, split-tab-picker)
        const title = cmd.label || 'Untitled';
        const url = cmd.sublabel || '';
        let favicon = cmd.tab?.image;
        if (!favicon || typeof favicon !== 'string' || favicon.trim() === '') {
          favicon = 'chrome://branding/content/icon32.png';
        }
        const highlightedTitle = highlightMatches(title, cmd.titleIndices);
        const highlightedUrl = highlightMatches(url, cmd.urlIndices);
        const cmdBadges = getSearchResultBadgesHtml({
          workspaceName: cmd.workspaceName,
          isEssential: cmd.isEssential
        });

        html += `
          <div class="zenleap-command-result ${isSelected ? 'selected' : ''}" data-index="${idx}">
            <img class="zenleap-search-result-favicon" src="${escapeHtml(favicon)}" />
            <div class="zenleap-command-info">
              <div class="zenleap-command-label"><span class="zenleap-search-result-title-text">${highlightedTitle}</span>${cmdBadges}</div>
              <div class="zenleap-command-sublabel">${highlightedUrl}</div>
            </div>
            ${label ? `<span class="zenleap-command-result-label">${label}</span>` : ''}
          </div>`;
      } else {
        // Command result
        const highlightedLabel = cmd.labelIndices ? highlightMatches(cmd.label, cmd.labelIndices) : escapeHtml(cmd.label);
        const hasArrow = cmd.subFlow ? ' →' : '';
        const headerClass = cmd.isHeader ? ' zenleap-session-header' : '';

        html += `
          <div class="zenleap-command-result ${isSelected ? 'selected' : ''}${headerClass}" data-index="${idx}">
            <div class="zenleap-command-icon">${iconHtml(cmd.icon, '⚡')}</div>
            <div class="zenleap-command-info">
              <div class="zenleap-command-label">${highlightedLabel}${hasArrow}</div>
              ${cmd.sublabel ? `<div class="zenleap-command-sublabel">${escapeHtml(cmd.sublabel)}</div>` : ''}
            </div>
            ${label ? `<span class="zenleap-command-result-label">${label}</span>` : ''}
          </div>`;
      }
    });

    searchResultsList.innerHTML = html;
    updateSearchHintBar();

    // Scroll selected into view
    const selectedEl = searchResultsList.querySelector('.zenleap-command-result.selected');
    if (selectedEl) selectedEl.scrollIntoView({ block: 'nearest', behavior: 'auto' });

    // Show preview panel for any sub-flow result that has a tab (debounced)
    if (commandSubFlow && commandResults.length > 0) {
      const selectedResult = commandResults[searchSelectedIndex];
      if (selectedResult?.tab) {
        hidePreviewPanelVisual();
        previewDebounceTimer = setTimeout(() => {
          showPreviewForTab(selectedResult.tab, { force: true });
          positionPreviewPanelForModal();
        }, S['timing.previewDelay']);
      } else {
        hidePreviewPanelVisual();
      }
    }
  }

  // Handle selecting a command result (Enter or click)
  function handleCommandSelect() {
    if (commandResults.length === 0) return;
    if (searchSelectedIndex < 0 || searchSelectedIndex >= commandResults.length) return;

    const result = commandResults[searchSelectedIndex];

    if (commandSubFlow) {
      handleSubFlowSelect(result);
    } else {
      executeCommand(result);
    }
  }

  // Enter command mode
  function enterCommandMode() {
    commandMode = true;
    commandQuery = '';
    commandSubFlow = null;
    commandSubFlowStack = [];
    commandMatchedTabs = [];
    searchSelectedIndex = 0;

    // Force insert mode so input is visible and focusable
    searchVimMode = 'insert';

    if (searchInput) {
      searchInput.value = '';
      searchInput.placeholder = 'Type a command...';
    }

    // Update icon to show > prefix
    const icon = document.getElementById('zenleap-search-icon');
    if (icon) {
      icon.textContent = '>';
      icon.classList.add('zenleap-command-prefix');
    }

    updateBreadcrumb();
    renderCommandResults();
    updateSearchVimIndicator();
    updateWsToggleVisibility();
    log('Entered command mode');
  }

  // Exit command mode (back to search)
  function exitCommandMode() {
    commandMode = false;
    commandQuery = '';
    commandSubFlow = null;
    commandSubFlowStack = [];
    commandMatchedTabs = [];
    dedupTabsToClose = [];
    commandResults = [];
    commandEnteredFromSearch = false;
    searchSelectedIndex = 0;
    invalidateCommandCache();

    // Restore to insert mode for normal search
    searchVimMode = 'insert';

    if (searchInput) {
      searchInput.value = '';
      searchInput.placeholder = 'Search tabs...';
      searchInput.readOnly = false;
    }

    // Restore search icon
    const icon = document.getElementById('zenleap-search-icon');
    if (icon) {
      icon.textContent = '🔍';
      icon.classList.remove('zenleap-command-prefix');
    }

    if (searchBreadcrumb) searchBreadcrumb.style.display = 'none';

    renderSearchResults();
    updateSearchVimIndicator();
    updateWsToggleVisibility();
    log('Exited command mode');
  }

  // Update the hint bar content based on current mode
  function updateSearchHintBar() {
    if (!searchHintBar) return;

    const vimEnabled = S['display.vimModeInBars'];

    if (commandMode) {
      if (commandSubFlow?.type === 'dedup-preview') {
        const scopeLabel = S['display.searchAllWorkspaces'] ? 'this ws' : 'all ws';
        if (vimEnabled && searchVimMode === 'normal') {
          searchHintBar.innerHTML = `
            <span><kbd>j/k</kbd> nav</span>
            <span><kbd>1-9</kbd> jump</span>
            <span><kbd>o</kbd> go to tab</span>
            <span><kbd>Tab</kbd> ${scopeLabel}</span>
            <span><kbd>Enter</kbd> delete</span>
            <span><kbd>Esc</kbd> cancel</span>
          `;
        } else {
          searchHintBar.innerHTML = `
            <span><kbd>↑↓</kbd> nav</span>
            <span><kbd>Ctrl+o</kbd> go to tab</span>
            <span><kbd>Tab</kbd> ${scopeLabel}</span>
            <span><kbd>Enter</kbd> delete</span>
            <span><kbd>Esc</kbd> cancel</span>
          `;
        }
        return;
      }
      if (commandSubFlow?.type === 'session-detail-view') {
        if (vimEnabled && searchVimMode === 'normal') {
          searchHintBar.innerHTML = `
            <span><kbd>j/k</kbd> scroll</span>
            <span><kbd>Enter</kbd> restore</span>
            <span><kbd>d</kbd> delete</span>
            <span><kbd>Esc</kbd> back</span>
          `;
        } else {
          searchHintBar.innerHTML = `
            <span><kbd>↑↓</kbd> scroll</span>
            <span><kbd>Enter</kbd> restore</span>
            <span><kbd>Ctrl+d</kbd> delete</span>
            <span><kbd>Esc</kbd> back</span>
          `;
        }
        return;
      }
      if (commandSubFlow?.type === 'list-sessions-picker') {
        if (vimEnabled && searchVimMode === 'normal') {
          searchHintBar.innerHTML = `
            <span><kbd>j/k</kbd> navigate</span>
            <span><kbd>Enter</kbd> preview</span>
            <span><kbd>d</kbd> delete</span>
            <span><kbd>Esc</kbd> back</span>
          `;
        } else {
          searchHintBar.innerHTML = `
            <span><kbd>↑↓</kbd> navigate</span>
            <span><kbd>Enter</kbd> preview</span>
            <span><kbd>Ctrl+d</kbd> delete</span>
            <span><kbd>Esc</kbd> back</span>
          `;
        }
        return;
      }
      if (vimEnabled && searchVimMode === 'normal') {
        searchHintBar.innerHTML = `
          <span><kbd>j/k</kbd> nav</span>
          <span><kbd>1-9</kbd> jump</span>
          <span><kbd>Enter</kbd> ${commandSubFlow ? 'select' : 'run'}</span>
          <span><kbd>i</kbd> insert</span>
          <span><kbd>Esc</kbd> ${commandSubFlow ? 'back' : 'exit'}</span>
        `;
      } else {
        searchHintBar.innerHTML = `
          <span><kbd>↑↓</kbd> nav</span>
          <span><kbd>Enter</kbd> ${commandSubFlow ? 'select' : 'run'}</span>
          <span><kbd>Esc</kbd> ${vimEnabled ? 'normal' : (commandSubFlow ? 'back' : 'exit')}</span>
        `;
      }
      return;
    }

    const wsLabel = S['display.searchAllWorkspaces'] ? 'this ws' : 'all ws';
    if (vimEnabled && searchVimMode === 'normal') {
      searchHintBar.innerHTML = `
        <span><kbd>j/k</kbd> nav</span>
        <span><kbd>1-9</kbd> jump</span>
        <span><kbd>Enter</kbd> open</span>
        <span><kbd>x</kbd> close</span>
        <span><kbd>Tab</kbd> ${wsLabel}</span>
        <span><kbd>Esc</kbd> exit</span>
      `;
    } else {
      searchHintBar.innerHTML = `
        <span><kbd>↑↓</kbd> nav</span>
        <span><kbd>Enter</kbd> open</span>
        <span><kbd>Tab</kbd> ${wsLabel}</span>
        <span><kbd>Ctrl+x</kbd> close</span>
        <span><kbd>></kbd> cmds</span>
        <span><kbd>Esc</kbd> ${vimEnabled ? 'normal' : 'exit'}</span>
      `;
    }
  }

  // ============================================
  // HELP MODAL
  // ============================================

  // Help content is generated from the current keybindings each time it opens,
  // so rebinding a key updates the help (it used to be hard-coded: LEAP-B-18).
  function helpSections() {
    const k = (id) => formatKeyDisplay(S[id], SETTINGS_SCHEMA[id]);
    const combo = (id) => k(id).split(' + ');
    const or = (...ids) => ids.flatMap((id, i) => (i ? ['~/', k(id)] : [k(id)]));
    const themeCount = Object.keys(BUILTIN_THEMES).length;
    return [
      { title: '\u{1F680} Leap Mode', trigger: [...combo('keys.global.leapMode'), '~to activate'], items: [
        [or('keys.leap.browseDown', 'keys.leap.browseUp'), 'Enter browse mode (down/up)'],
        [or('keys.leap.browseDownAlt', 'keys.leap.browseUpAlt'), 'Enter browse mode (arrows)'],
        [or('keys.leap.prevWorkspace', 'keys.leap.nextWorkspace'), 'Browse + switch workspace'],
        [[k('keys.leap.gMode')], 'G-mode (absolute positioning)'],
        [[k('keys.leap.zMode')], 'Z-mode (scroll commands)'],
        [['0'], 'Jump to first unpinned tab'],
        [['$'], 'Jump to last tab'],
        [[k('keys.leap.lastTab')], 'Jump to last item'],
        [[k('keys.leap.setMark')], 'Set mark on current tab'],
        [[k('keys.leap.clearMarks')], 'Clear all marks'],
        [or('keys.leap.gotoMark', 'keys.leap.gotoMarkAlt'), 'Jump to mark'],
        [or('keys.leap.jumpBack', 'keys.leap.jumpForward'), 'Jump back / forward in history'],
        [[k('keys.leap.help')], 'Show this help'],
        [['Esc'], 'Exit leap mode (clicking elsewhere exits too)'],
      ] },
      { title: '\u{1F4C2} Browse Mode', trigger: ['~After', k('keys.leap.browseDown'), '~or', k('keys.leap.browseUp'), '~in leap mode'], items: [
        [or('keys.browse.down', 'keys.browse.up'), 'Move highlight down/up'],
        [['Shift', `~+${k('keys.browse.down')}/${k('keys.browse.up')}`], 'Move + extend selection'],
        [[k('keys.browse.select')], 'Toggle selection'],
        [[k('keys.browse.yank')], 'Yank highlighted or selected items'],
        [or('keys.browse.pasteAfter', 'keys.browse.pasteBefore'), 'Paste after / before'],
        [or('keys.browse.prevWorkspace', 'keys.browse.nextWorkspace'), 'Switch workspace'],
        [[`${k('keys.browse.gMode')}${k('keys.browse.gMode')}`, '~/', k('keys.browse.lastTab')], 'Jump to first / last item'],
        [[k('keys.browse.confirm')], 'Open tab / toggle folder'],
        [[k('keys.browse.close')], 'Close tab(s); on a folder: delete dialog'],
        [combo('keys.global.commandPalette'), 'Command palette for the selection'],
        [['1-9'], 'Open the tab N items from where browsing started'],
        [['Esc'], 'Clear selection, then return to original tab'],
      ] },
      { title: '\u{1F4CD} G-Mode', trigger: ['~After', k('keys.leap.gMode'), '~in leap mode'], items: [
        [[k('keys.gMode.first')], 'Go to first tab (gg)'],
        [[k('keys.gMode.last')], 'Go to last tab'],
        [['1-9', '~+', 'Enter'], 'Go to tab #N'],
      ] },
      { title: '\u{1F4DC} Z-Mode', trigger: ['~After', k('keys.leap.zMode'), '~in leap mode'], items: [
        [[k('keys.zMode.center')], 'Center current tab'],
        [[k('keys.zMode.top')], 'Scroll to top'],
        [[k('keys.zMode.bottom')], 'Scroll to bottom'],
      ] },
      { title: '\u{1F516} Marks', items: [
        [[k('keys.leap.setMark'), '~+', 'a-z 0-9'], 'Set mark (repeat to toggle off)'],
        [[k('keys.leap.clearMarks')], 'Clear all marks'],
        [[k('keys.leap.gotoMark'), '~+', 'char'], 'Jump to marked tab'],
        [[...combo('keys.global.quickMark'), '~+', 'char'], 'Quick jump (no leap mode)'],
      ] },
      { title: '\u{1F50D} Tab Search', trigger: [...combo('keys.global.search'), '~to open'], items: [
        [['↑', '~/', '↓', '~or', 'Ctrl', '~+j/k'], 'Navigate results'],
        [['Enter'], 'Open selected tab'],
        [['Tab'], 'Toggle this workspace / all'],
        [['Ctrl', '~+', 'x'], 'Close selected tab'],
        [[k('keys.search.commandPrefix')], 'Switch to command mode'],
        [['Esc'], S['display.vimModeInBars'] ? 'Normal mode (j/k, 1-9, x, vim motions); Esc again closes' : 'Close search'],
      ] },
      { title: '⚙ Command Palette', trigger: [...combo('keys.global.commandPalette'), '~or type', k('keys.search.commandPrefix'), '~in search'], items: [
        [['↑', '~/', '↓', '~or', 'j', '~/', 'k'], 'Navigate commands'],
        [['Enter'], 'Run command / choose'],
        [['1-9'], 'Quick jump + run (normal mode)'],
        [['Esc'], 'Back / close'],
      ] },
      { title: '\u{1F4BE} Workspace Sessions', trigger: ['~Via the command palette'], items: [
        [['~save session'], 'Save current workspace tabs + folders'],
        [['~restore session'], 'Restore a saved session'],
        [['~list sessions'], 'Browse and manage saved sessions'],
      ] },
      { title: '\u{1F9ED} Quick Navigation', trigger: ['~Works without leap mode'], items: [
        [combo('keys.global.splitFocusDown'), 'Next tab (or split pane below)'],
        [combo('keys.global.splitFocusUp'), 'Previous tab (or split pane above)'],
        [combo('keys.global.splitFocusLeft'), 'Previous workspace (or pane left)'],
        [combo('keys.global.splitFocusRight'), 'Next workspace (or pane right)'],
        [combo('keys.global.splitResize'), 'gTile split layout overlay'],
        [combo('keys.global.undoFolderDelete'), 'Undo the last folder deletion'],
      ] },
      ...(isUrlbarVimEnabled() ? [{ title: '⌨ URL Bar Vim', trigger: ['Ctrl', '~+', 'L', '~starts in INSERT'], items: [
        [['Esc'], 'NORMAL mode (after typing; otherwise closes as usual)'],
        [['j', '~/', 'k', '~/', 'g', '~/', 'G'], 'Select suggestion'],
        [['h l w b e 0 $'], 'Move cursor'],
        [['x s S D C p u'], 'Edit / paste / undo'],
        [['i a I A'], 'Back to INSERT'],
        [['Enter'], 'Open the URL or suggestion'],
      ] }] : []),
      { title: '\u{1F3A8} Themes', trigger: ['~Settings › Appearance or the command palette'], items: [
        [[`~${k('keys.search.commandPrefix')} switch theme`], 'Pick a theme (live preview)'],
        [[`~${k('keys.search.commandPrefix')} reload themes`], 'Reload themes from zenleap-themes.json'],
        [[`~${k('keys.search.commandPrefix')} open themes file`], 'Edit zenleap-themes.json'],
      ], note: `${themeCount} built-in themes. Create your own in Settings › Appearance › Custom Themes.` },
    ];
  }

  function renderHelpContent() {
    const content = helpModal?.querySelector('.zenleap-help-content');
    if (!content) return;
    const tokens = (list) => {
      const frag = document.createDocumentFragment();
      for (const t of list) {
        if (typeof t === 'string' && t.startsWith('~')) {
          frag.appendChild(document.createTextNode(` ${t.slice(1)} `));
        } else {
          const kbd = document.createElement('kbd');
          kbd.textContent = t;
          frag.appendChild(kbd);
        }
      }
      return frag;
    };
    content.replaceChildren();
    for (const section of helpSections()) {
      const el = document.createElement('div');
      el.className = 'zenleap-help-section';
      const h2 = document.createElement('h2');
      h2.textContent = section.title;
      el.appendChild(h2);
      if (section.trigger) {
        const p = document.createElement('p');
        p.className = 'zenleap-help-trigger';
        p.appendChild(tokens(section.trigger));
        el.appendChild(p);
      }
      const grid = document.createElement('div');
      grid.className = 'zenleap-help-grid';
      for (const [keys, text] of section.items) {
        const item = document.createElement('div');
        item.className = 'zenleap-help-item';
        const keysEl = document.createElement('span');
        keysEl.className = 'zenleap-help-keys';
        keysEl.appendChild(tokens(keys));
        const desc = document.createElement('span');
        desc.className = 'zenleap-help-desc';
        desc.textContent = text;
        item.appendChild(keysEl);
        item.appendChild(desc);
        grid.appendChild(item);
      }
      el.appendChild(grid);
      if (section.note) {
        const note = document.createElement('p');
        note.className = 'zenleap-help-note';
        note.textContent = section.note;
        el.appendChild(note);
      }
      content.appendChild(el);
    }
  }

  function createHelpModal() {
    if (helpModal) return;

    helpModal = document.createElement('div');
    helpModal.id = 'zenleap-help-modal';

    const backdrop = document.createElement('div');
    backdrop.id = 'zenleap-help-backdrop';
    backdrop.addEventListener('click', () => exitHelpMode());

    const container = document.createElement('div');
    container.id = 'zenleap-help-container';

    container.innerHTML = `
      <div class="zenleap-help-header">
        <div>
          <h1>ZenLeap</h1>
          <span class="zenleap-help-version">v${VERSION}</span>
          <span class="zenleap-help-subtitle">Vim-style Tab Navigation</span>
        </div>
      </div>

      <div class="zenleap-help-content"></div>

      <div class="zenleap-help-footer">
        <span><kbd>j</kbd>/<kbd>k</kbd> scroll &#183; <kbd>g</kbd>/<kbd>G</kbd> top/bottom &#183; <kbd>Esc</kbd> close</span>
      </div>
    `;

    helpModal.appendChild(backdrop);
    helpModal.appendChild(container);

    // Inject styles
    injectStyleBlock('zenleap-help-styles', `
      #zenleap-help-modal {
        position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
        z-index: 100001; display: none; justify-content: center; align-items: center; padding: 20px;
      }
      #zenleap-help-modal.active { display: flex; }
      #zenleap-help-backdrop {
        position: absolute; top: 0; left: 0; width: 100%; height: 100%;
        background: var(--zl-backdrop); backdrop-filter: var(--zl-blur);
      }
      #zenleap-help-container {
        position: relative; width: 95%; max-width: 900px; max-height: 85vh;
        background: var(--zl-bg-surface); border-radius: var(--zl-r-xl);
        box-shadow: var(--zl-shadow-modal); border: 1px solid var(--zl-border-subtle);
        overflow: hidden; display: flex; flex-direction: column;
        animation: zenleap-modal-enter 0.35s cubic-bezier(0.16, 1, 0.3, 1);
      }
      .zenleap-help-header {
        padding: 24px 32px 20px; border-bottom: 1px solid var(--zl-border-subtle);
        display: flex; align-items: center; justify-content: center; position: relative;
      }
      .zenleap-help-header > div { text-align: center; }
      .zenleap-help-settings-btn {
        position: absolute; right: 24px; top: 50%; transform: translateY(-50%);
        background: var(--zl-accent-dim); border: 1px solid var(--zl-accent-border);
        color: var(--zl-text-secondary); font-size: 13px; padding: 6px 14px;
        border-radius: var(--zl-r-md); cursor: pointer; display: flex; align-items: center; gap: 6px;
        transition: all 0.2s ease; font-family: var(--zl-font-ui); white-space: nowrap;
      }
      .zenleap-help-settings-btn:hover {
        background: var(--zl-accent-20); border-color: var(--zl-accent-40); color: var(--zl-accent);
      }
      .zenleap-help-header h1 {
        margin: 0; font-size: 28px; font-weight: 700; color: var(--zl-accent);
        letter-spacing: -0.5px; display: inline;
      }
      .zenleap-help-version {
        font-size: 12px; color: var(--zl-text-muted); margin-left: 12px; font-family: var(--zl-font-mono);
      }
      .zenleap-help-subtitle {
        display: block; margin-top: 6px; font-size: 14px; color: var(--zl-text-secondary); font-weight: 400;
      }
      .zenleap-help-content {
        flex: 1; overflow-y: auto; padding: 24px 32px;
        display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 24px;
      }
      .zenleap-help-section {
        background: var(--zl-bg-raised); border-radius: var(--zl-r-lg);
        padding: 20px; border: 1px solid var(--zl-border-subtle);
      }
      .zenleap-help-section h2 {
        margin: 0 0 12px 0; font-size: 16px; font-weight: 600; color: var(--zl-text-primary);
      }
      .zenleap-help-section h3 {
        margin: 16px 0 10px 0; font-size: 12px; font-weight: 600; color: var(--zl-text-secondary);
        text-transform: uppercase; letter-spacing: 0.5px;
      }
      .zenleap-help-trigger {
        margin: 0 0 14px 0; font-size: 12px; color: var(--zl-text-muted);
      }
      .zenleap-help-grid { display: flex; flex-direction: column; gap: 8px; }
      .zenleap-help-item { display: flex; align-items: center; gap: 12px; font-size: 13px; }
      .zenleap-help-keys { flex-shrink: 0; color: var(--zl-text-muted); font-size: 11px; }
      .zenleap-help-note { margin: 8px 0 0; font-size: 11px; color: var(--zl-text-muted); }
      .zenleap-help-trigger kbd {
        background: var(--zl-accent-dim); color: var(--zl-accent); padding: 2px 6px;
        border-radius: var(--zl-r-sm); font-family: var(--zl-font-mono); font-size: 11px;
        border: 1px solid var(--zl-accent-border);
      }
      .zenleap-help-item kbd {
        background: var(--zl-accent-dim); color: var(--zl-accent); padding: 3px 8px;
        border-radius: var(--zl-r-sm); font-family: var(--zl-font-mono); font-size: 11px; font-weight: 600;
        border: 1px solid var(--zl-accent-border); min-width: 20px; text-align: center;
        box-shadow: var(--zl-shadow-kbd);
      }
      .zenleap-help-item .zenleap-help-desc { color: var(--zl-text-secondary); flex: 1; }
      .zenleap-help-footer {
        padding: 16px 32px; border-top: 1px solid var(--zl-border-subtle);
        text-align: center; font-size: 12px; color: var(--zl-text-muted);
      }
      .zenleap-help-footer kbd {
        background: var(--zl-bg-elevated); color: var(--zl-text-secondary);
        padding: 2px 6px; border-radius: var(--zl-r-sm); font-family: var(--zl-font-mono); font-size: 10px;
      }
      .zenleap-help-content { scrollbar-width: thin; scrollbar-color: var(--zl-border-strong) transparent; }
    `);

    document.documentElement.appendChild(helpModal);

    // Create settings button programmatically (innerHTML strips <button> in chrome context)
    const helpHeader = container.querySelector('.zenleap-help-header');
    if (helpHeader) {
      const settingsBtn = document.createElement('button');
      settingsBtn.className = 'zenleap-help-settings-btn';
      settingsBtn.title = 'Settings';
      settingsBtn.textContent = '\u2699 Settings';
      settingsBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        exitHelpMode();
        setTimeout(() => enterSettingsMode(), 50);
      });
      helpHeader.appendChild(settingsBtn);
    }

    log('Help modal created');
  }

  function enterHelpMode() {
    if (helpMode) return;

    // Exit other modes if active
    if (leapMode) exitLeapMode(false);
    if (reorgMode) exitReorgMode(false);

    createHelpModal();
    renderHelpContent();

    helpMode = true;
    _overlayFocus = captureFocusTarget();
    helpModal.classList.add('active');
    armModeGuards('help', (reason) => exitHelpMode({ restoreFocus: reason !== 'focus' }), {
      inside: '#zenleap-help-container',
    });

    log('Entered help mode');
  }

  function exitHelpMode({ restoreFocus = true } = {}) {
    if (!helpMode) return;

    disarmModeGuards('help');
    helpMode = false;
    helpModal.classList.remove('active');

    restoreOverlayFocus(restoreFocus);
    log('Exited help mode');
  }

  // ============================================
  // REORGANIZE WORKSPACES MODAL
  // ============================================

  function createReorgModal() {
    if (reorgModal) return;

    const modal = document.createElement('div');
    modal.id = 'zenleap-reorg-modal';

    const backdrop = document.createElement('div');
    backdrop.id = 'zenleap-reorg-backdrop';
    backdrop.addEventListener('click', () => exitReorgMode());

    const container = document.createElement('div');
    container.id = 'zenleap-reorg-container';

    // Header
    const header = document.createElement('div');
    header.className = 'zenleap-reorg-header';
    const headerContent = document.createElement('div');
    const h1 = document.createElement('h1');
    h1.textContent = 'Reorder Workspaces';
    const subtitle = document.createElement('span');
    subtitle.className = 'zenleap-reorg-subtitle';
    subtitle.textContent = 'Drag or use keyboard to rearrange';
    headerContent.appendChild(h1);
    headerContent.appendChild(subtitle);
    header.appendChild(headerContent);

    // Workspace list
    const list = document.createElement('div');
    list.id = 'zenleap-reorg-list';

    // Footer with keyboard hints
    const footer = document.createElement('div');
    footer.className = 'zenleap-reorg-footer';
    footer.innerHTML = [
      '<span><kbd>j</kbd><kbd>k</kbd> navigate</span>',
      '<span><kbd>J</kbd><kbd>K</kbd> move</span>',
      '<span><kbd>\u21B5</kbd> confirm</span>',
      '<span><kbd>esc</kbd> cancel</span>',
    ].join('');

    container.appendChild(header);
    container.appendChild(list);
    container.appendChild(footer);
    modal.appendChild(backdrop);
    modal.appendChild(container);

    // Styles
    injectStyleBlock('zenleap-reorg-styles', `
      #zenleap-reorg-modal {
        position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
        z-index: 100001; display: none; justify-content: center; align-items: center; padding: 20px;
      }
      #zenleap-reorg-modal.active { display: flex; }
      #zenleap-reorg-backdrop {
        position: absolute; top: 0; left: 0; width: 100%; height: 100%;
        background: var(--zl-backdrop); backdrop-filter: var(--zl-blur);
      }
      #zenleap-reorg-container {
        position: relative; width: 95%; max-width: 440px;
        background: var(--zl-bg-surface); border-radius: var(--zl-r-xl);
        box-shadow: var(--zl-shadow-modal); border: 1px solid var(--zl-border-subtle);
        overflow: hidden; display: flex; flex-direction: column;
        animation: zenleap-modal-enter 0.35s cubic-bezier(0.16, 1, 0.3, 1);
        font-family: var(--zl-font-ui);
      }
      .zenleap-reorg-header {
        padding: 20px 24px 16px; border-bottom: 1px solid var(--zl-border-subtle);
        text-align: center;
      }
      .zenleap-reorg-header h1 {
        margin: 0; font-size: 18px; font-weight: 700; color: var(--zl-accent);
        letter-spacing: -0.3px;
      }
      .zenleap-reorg-subtitle {
        display: block; margin-top: 4px; font-size: 12px; color: var(--zl-text-muted); font-weight: 400;
      }
      #zenleap-reorg-list {
        padding: 8px 0; max-height: 60vh; overflow-y: auto;
      }
      #zenleap-reorg-list { scrollbar-width: thin; scrollbar-color: var(--zl-border-strong) transparent; }

      .zenleap-reorg-item {
        display: flex; align-items: center; padding: 10px 20px; gap: 12px;
        cursor: grab; transition: background 0.1s, transform 0.18s cubic-bezier(0.2, 0, 0, 1),
          box-shadow 0.18s ease, border-color 0.1s;
        border-left: 2px solid transparent;
        position: relative;
        user-select: none;
      }
      .zenleap-reorg-item:hover { background: var(--zl-bg-raised); }
      .zenleap-reorg-item.focused {
        background: var(--zl-accent-dim);
        border-left-color: var(--zl-accent);
      }
      .zenleap-reorg-item.moving {
        background: var(--zl-accent-mid);
        border-left-color: var(--zl-accent-bright);
        box-shadow: 0 4px 16px rgba(0,0,0,0.25);
        z-index: 2;
      }
      .zenleap-reorg-item.dragging {
        opacity: 0.9;
        box-shadow: var(--zl-shadow-elevated);
        z-index: 10;
        cursor: grabbing;
        transition: box-shadow 0.15s ease;
      }
      .zenleap-reorg-item.swap-up {
        animation: zenleap-reorg-swap-up 0.18s cubic-bezier(0.2, 0, 0, 1);
      }
      .zenleap-reorg-item.swap-down {
        animation: zenleap-reorg-swap-down 0.18s cubic-bezier(0.2, 0, 0, 1);
      }

      @keyframes zenleap-reorg-swap-up {
        from { transform: translateY(100%); } to { transform: translateY(0); }
      }
      @keyframes zenleap-reorg-swap-down {
        from { transform: translateY(-100%); } to { transform: translateY(0); }
      }

      .zenleap-reorg-grip {
        color: var(--zl-text-muted); font-size: 14px; flex-shrink: 0;
        opacity: 0.4; transition: opacity 0.15s;
        cursor: grab; width: 16px; text-align: center;
        line-height: 1;
      }
      .zenleap-reorg-item:hover .zenleap-reorg-grip,
      .zenleap-reorg-item.focused .zenleap-reorg-grip { opacity: 0.8; }

      .zenleap-reorg-pos {
        font-family: var(--zl-font-mono); font-size: 11px; font-weight: 600;
        color: var(--zl-text-muted); min-width: 18px; text-align: center;
        flex-shrink: 0;
      }
      .zenleap-reorg-item.focused .zenleap-reorg-pos { color: var(--zl-accent); }

      .zenleap-reorg-icon {
        font-size: 18px; flex-shrink: 0; width: 24px; text-align: center;
        display: inline-flex; align-items: center; justify-content: center;
      }
      .zenleap-reorg-icon .zenleap-icon-img { width: 18px; height: 18px; }

      .zenleap-reorg-name {
        flex: 1; min-width: 0; font-size: 14px; font-weight: 500;
        color: var(--zl-text-primary);
        white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      }

      .zenleap-reorg-active-badge {
        font-family: var(--zl-font-mono); font-size: 9px; font-weight: 700;
        letter-spacing: 0.5px; text-transform: uppercase;
        padding: 2px 8px; border-radius: 4px;
        background: var(--zl-current-bg); color: var(--zl-current-color);
        flex-shrink: 0;
      }

      .zenleap-reorg-footer {
        display: flex; gap: 12px; justify-content: center; flex-wrap: wrap;
        padding: 10px 16px;
        border-top: 1px solid var(--zl-border-subtle);
        font-size: 11px; color: var(--zl-text-muted);
        font-family: var(--zl-font-ui);
      }
      .zenleap-reorg-footer span {
        display: inline-flex; align-items: center; gap: 4px;
      }
      .zenleap-reorg-footer kbd {
        display: inline-flex; align-items: center; justify-content: center;
        min-width: 18px; height: 18px; padding: 0 5px;
        font-family: var(--zl-font-mono); font-size: 9px; font-weight: 600;
        color: var(--zl-text-secondary);
        background: var(--zl-bg-raised);
        border: 1px solid var(--zl-border-strong);
        border-radius: 4px;
        box-shadow: var(--zl-shadow-kbd);
      }

    `);

    document.documentElement.appendChild(modal);

    reorgModal = modal;
    log('Reorganize workspaces modal created');
  }

  function renderReorgList() {
    const list = document.getElementById('zenleap-reorg-list');
    if (!list) return;

    const activeId = window.gZenWorkspaces?.activeWorkspace;

    // Remove old children
    while (list.firstChild) list.removeChild(list.firstChild);

    reorgWorkspaces.forEach((ws, i) => {
      const item = document.createElement('div');
      item.className = 'zenleap-reorg-item';
      item.dataset.index = i;
      if (i === reorgFocusIndex) item.classList.add('focused');
      if (i === reorgMovingIndex) item.classList.add('moving');

      // Drag grip
      const grip = document.createElement('span');
      grip.className = 'zenleap-reorg-grip';
      grip.textContent = '\u2807'; // vertical ellipsis (⠇)

      // Position number
      const pos = document.createElement('span');
      pos.className = 'zenleap-reorg-pos';
      pos.textContent = String(i + 1);

      // Icon (emoji or one of Zen's chrome:// SVG space icons)
      const icon = document.createElement('span');
      icon.className = 'zenleap-reorg-icon';
      icon.appendChild(createIconNode(ws.icon, '\uD83D\uDDC2'));

      // Name
      const name = document.createElement('span');
      name.className = 'zenleap-reorg-name';
      name.textContent = ws.name || 'Unnamed';

      item.appendChild(grip);
      item.appendChild(pos);
      item.appendChild(icon);
      item.appendChild(name);

      // Active badge
      if (ws.uuid === activeId) {
        const badge = document.createElement('span');
        badge.className = 'zenleap-reorg-active-badge';
        badge.textContent = 'active';
        item.appendChild(badge);
      }

      // Mouse drag handlers
      item.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        e.preventDefault();
        startReorgDrag(i, e.clientY);
      });

      // Click to focus
      item.addEventListener('click', (e) => {
        if (reorgDragState || reorgFocusIndex === i) return;
        reorgFocusIndex = i;
        renderReorgList();
      });

      list.appendChild(item);
    });
  }

  let _reorgDragAbort = null; // window listeners of an in-progress drag

  function startReorgDrag(index, startY) {
    reorgDragState = { index, startY, currentY: startY, moved: false };

    const onMouseMove = (e) => {
      if (!reorgDragState) return;
      reorgDragState.currentY = e.clientY;

      const list = document.getElementById('zenleap-reorg-list');
      if (!list) return;

      const items = list.querySelectorAll('.zenleap-reorg-item');
      const dragItem = items[reorgDragState.index];
      if (!dragItem) return;

      // Activate drag visual after 5px movement
      if (!reorgDragState.moved && Math.abs(e.clientY - reorgDragState.startY) > 5) {
        reorgDragState.moved = true;
        dragItem.classList.add('dragging');
      }

      if (!reorgDragState.moved) return;

      // Calculate drag offset
      const dy = e.clientY - reorgDragState.startY;
      dragItem.style.transform = `translateY(${dy}px)`;

      // Determine if we crossed a neighbor
      const dragIdx = reorgDragState.index;
      for (let i = 0; i < items.length; i++) {
        if (i === dragIdx) continue;
        const rect = items[i].getBoundingClientRect();
        const mid = rect.top + rect.height / 2;

        if (i < dragIdx && e.clientY < mid) {
          // Move up
          reorgSwapDrag(dragIdx, i);
          return;
        }
        if (i > dragIdx && e.clientY > mid) {
          // Move down
          reorgSwapDrag(dragIdx, i);
          return;
        }
      }
    };

    const onMouseUp = () => {
      _reorgDragAbort?.abort();
      _reorgDragAbort = null;

      if (reorgDragState) {
        const list = document.getElementById('zenleap-reorg-list');
        if (list) {
          const items = list.querySelectorAll('.zenleap-reorg-item');
          const dragItem = items[reorgDragState.index];
          if (dragItem) {
            dragItem.classList.remove('dragging');
            dragItem.style.transform = '';
          }
        }
        reorgFocusIndex = reorgDragState.index;
        reorgDragState = null;
        renderReorgList();
      }
    };

    _reorgDragAbort?.abort();
    _reorgDragAbort = new AbortController();
    const dragOpts = { capture: true, signal: _reorgDragAbort.signal };
    window.addEventListener('mousemove', onMouseMove, dragOpts);
    window.addEventListener('mouseup', onMouseUp, dragOpts);
  }

  function reorgSwapDrag(fromIdx, toIdx) {
    // Swap in data
    const ws = reorgWorkspaces.splice(fromIdx, 1)[0];
    reorgWorkspaces.splice(toIdx, 0, ws);

    // Update drag state
    reorgDragState.index = toIdx;
    reorgDragState.startY = reorgDragState.currentY;

    // Re-render
    renderReorgList();

    // Re-apply dragging state to the moved item
    const list = document.getElementById('zenleap-reorg-list');
    if (list) {
      const items = list.querySelectorAll('.zenleap-reorg-item');
      const dragItem = items[toIdx];
      if (dragItem) {
        dragItem.classList.add('dragging');
        // Apply swap animation to displaced item
        const displaced = items[fromIdx];
        if (displaced) {
          displaced.classList.add(toIdx < fromIdx ? 'swap-down' : 'swap-up');
          displaced.addEventListener('animationend', () => {
            displaced.classList.remove('swap-up', 'swap-down');
          }, { once: true });
        }
      }
    }
  }

  function reorgMoveItem(fromIdx, toIdx) {
    if (toIdx < 0 || toIdx >= reorgWorkspaces.length) return;

    const ws = reorgWorkspaces.splice(fromIdx, 1)[0];
    reorgWorkspaces.splice(toIdx, 0, ws);

    // Update focus & moving index
    reorgFocusIndex = toIdx;
    reorgMovingIndex = toIdx;

    renderReorgList();

    // Animate the displaced item
    const list = document.getElementById('zenleap-reorg-list');
    if (list) {
      const displaced = list.querySelectorAll('.zenleap-reorg-item')[fromIdx];
      if (displaced) {
        displaced.classList.add(toIdx < fromIdx ? 'swap-down' : 'swap-up');
        displaced.addEventListener('animationend', () => {
          displaced.classList.remove('swap-up', 'swap-down');
        }, { once: true });
      }
    }

    // Scroll focused item into view
    scrollReorgFocusIntoView();
  }

  function scrollReorgFocusIntoView() {
    const list = document.getElementById('zenleap-reorg-list');
    if (!list) return;
    const items = list.querySelectorAll('.zenleap-reorg-item');
    if (items[reorgFocusIndex]) {
      items[reorgFocusIndex].scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }

  async function applyReorgChanges() {
    if (!window.gZenWorkspaces) return;

    // Capture local copies before any async work (exitReorgMode clears these synchronously)
    const targetOrder = [...reorgWorkspaces];
    const originalOrder = [...reorgOriginalOrder];

    // Compare with original order and apply changes
    let changed = false;
    for (let i = 0; i < targetOrder.length; i++) {
      if (targetOrder[i].uuid !== originalOrder[i].uuid) {
        changed = true;
        break;
      }
    }

    if (!changed) {
      log('Workspace order unchanged');
      return;
    }

    // Apply the new order using reorderWorkspace API. The space list may have
    // changed while the modal was open (Spaces sync, another window): work
    // from the current list by uuid, keep spaces added meanwhile at the end.
    try {
      const currentIds = gZenWorkspaces.getWorkspaces().map(w => w.uuid);
      const wanted = targetOrder.map(w => w.uuid).filter(id => currentIds.includes(id));
      for (const id of currentIds) if (!wanted.includes(id)) wanted.push(id);
      for (let targetIdx = 0; targetIdx < wanted.length; targetIdx++) {
        const currentIdx = gZenWorkspaces.getWorkspaces().findIndex(w => w.uuid === wanted[targetIdx]);
        if (currentIdx >= 0 && currentIdx !== targetIdx) {
          await gZenWorkspaces.reorderWorkspace(wanted[targetIdx], targetIdx);
        }
      }
      log(`Reorganized ${wanted.length} workspaces`);
    } catch (e) {
      reportError('Reorganizing workspaces failed', e);
    }
  }

  function enterReorgMode() {
    if (reorgMode) return;

    // Exit other modes
    if (leapMode) exitLeapMode(false);
    if (searchMode) exitSearchMode();

    // Load workspaces
    if (!window.gZenWorkspaces) { log('gZenWorkspaces not available'); return; }
    // Zen ignores reordering in private / non-synced windows
    if (gZenWorkspaces.privateWindowOrDisabled) { log('Workspaces cannot be reordered in this window'); return; }
    const workspaces = gZenWorkspaces.getWorkspaces();
    if (!workspaces || workspaces.length < 2) { log('Not enough workspaces to reorganize'); return; }

    reorgWorkspaces = workspaces.map(ws => ({ uuid: ws.uuid, name: ws.name || 'Unnamed', icon: ws.icon || '' }));
    reorgOriginalOrder = reorgWorkspaces.map(ws => ({ ...ws }));
    reorgFocusIndex = 0;
    reorgMovingIndex = -1;

    createReorgModal();
    renderReorgList();

    reorgMode = true;
    _overlayFocus = captureFocusTarget();
    reorgModal.classList.add('active');
    armModeGuards('reorg', (reason) => exitReorgMode(false, { restoreFocus: reason !== 'focus' }), {
      inside: '#zenleap-reorg-container',
    });

    log('Entered reorganize workspaces mode');
  }

  function exitReorgMode(apply = false, { restoreFocus = true } = {}) {
    if (!reorgMode) return;

    disarmModeGuards('reorg');
    _reorgDragAbort?.abort();
    _reorgDragAbort = null;

    if (apply) {
      applyReorgChanges();
    }

    reorgMode = false;
    reorgModal.classList.remove('active');
    reorgWorkspaces = [];
    reorgOriginalOrder = [];
    reorgFocusIndex = 0;
    reorgMovingIndex = -1;
    reorgDragState = null;

    restoreOverlayFocus(restoreFocus);
    log('Exited reorganize workspaces mode');
  }

  function handleReorgKeyDown(event) {
    if (!reorgMode) return false;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    const key = event.key;
    const count = reorgWorkspaces.length;

    // Escape — cancel (discard changes)
    if (key === 'Escape') {
      exitReorgMode(false);
      return true;
    }

    // Enter — confirm (apply changes)
    if (key === 'Enter') {
      exitReorgMode(true);
      return true;
    }

    // Navigate: j / ArrowDown
    if (key === 'j' || key === 'ArrowDown') {
      if (!event.shiftKey) {
        // Navigate down
        reorgMovingIndex = -1;
        reorgFocusIndex = Math.min(reorgFocusIndex + 1, count - 1);
        renderReorgList();
        scrollReorgFocusIntoView();
        return true;
      }
    }

    // Navigate: k / ArrowUp
    if (key === 'k' || key === 'ArrowUp') {
      if (!event.shiftKey) {
        // Navigate up
        reorgMovingIndex = -1;
        reorgFocusIndex = Math.max(reorgFocusIndex - 1, 0);
        renderReorgList();
        scrollReorgFocusIntoView();
        return true;
      }
    }

    // Move down: J (shift+j) or Shift+ArrowDown
    if ((key === 'J') || (key === 'ArrowDown' && event.shiftKey)) {
      if (reorgFocusIndex < count - 1) {
        reorgMoveItem(reorgFocusIndex, reorgFocusIndex + 1);
      }
      return true;
    }

    // Move up: K (shift+k) or Shift+ArrowUp
    if ((key === 'K') || (key === 'ArrowUp' && event.shiftKey)) {
      if (reorgFocusIndex > 0) {
        reorgMoveItem(reorgFocusIndex, reorgFocusIndex - 1);
      }
      return true;
    }

    // g — jump to top
    if (key === 'g') {
      reorgMovingIndex = -1;
      reorgFocusIndex = 0;
      renderReorgList();
      scrollReorgFocusIntoView();
      return true;
    }

    // G — jump to bottom
    if (key === 'G') {
      reorgMovingIndex = -1;
      reorgFocusIndex = count - 1;
      renderReorgList();
      scrollReorgFocusIntoView();
      return true;
    }

    return true; // Swallow all keys in reorg mode
  }

  // ============================================
  // SETTINGS MODAL
  // ============================================

  function createSettingsModal() {
    if (settingsModal) return;

    // Set to non-null only after successful creation to allow retry on failure
    const modal = document.createElement('div');
    modal.id = 'zenleap-settings-modal';

    const backdrop = document.createElement('div');
    backdrop.id = 'zenleap-settings-backdrop';
    backdrop.addEventListener('click', () => exitSettingsMode());

    const container = document.createElement('div');
    container.id = 'zenleap-settings-container';

    // Header (create button via createElement — innerHTML strips <button> in chrome context)
    const header = document.createElement('div');
    header.className = 'zenleap-settings-header';
    header.innerHTML = `<div><h1>Settings</h1><span class="zenleap-settings-subtitle">ZenLeap Configuration</span></div>`;
    const closeBtn = document.createElement('button');
    closeBtn.className = 'zenleap-settings-close-btn';
    closeBtn.title = 'Close';
    closeBtn.textContent = '\u2715';
    closeBtn.addEventListener('click', () => exitSettingsMode());
    header.appendChild(closeBtn);

    // Search (create input via createElement — innerHTML strips <input> in chrome context)
    const searchWrap = document.createElement('div');
    searchWrap.className = 'zenleap-settings-search';
    const searchIcon = document.createElement('span');
    searchIcon.className = 'zenleap-settings-search-icon';
    searchIcon.textContent = '\uD83D\uDD0D';
    const searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.id = 'zenleap-settings-search-input';
    searchInput.placeholder = 'Search all settings\u2026';
    searchInput.addEventListener('input', (e) => {
      settingsSearchQuery = e.target.value.toLowerCase();
      const tabsEl = document.getElementById('zenleap-settings-tabs');
      if (tabsEl) {
        if (settingsSearchQuery) {
          tabsEl.classList.add('searching');
        } else {
          tabsEl.classList.remove('searching');
        }
      }
      renderSettingsContent();
    });
    searchWrap.appendChild(searchIcon);
    searchWrap.appendChild(searchInput);

    // Tabs
    const tabs = document.createElement('div');
    tabs.className = 'zenleap-settings-tabs';
    tabs.id = 'zenleap-settings-tabs';
    ['Keybindings', 'Timing', 'Appearance', 'Display', 'Advanced', 'Plugins', 'About'].forEach(cat => {
      const btn = document.createElement('button');
      btn.textContent = cat;
      btn.dataset.tab = cat;
      if (cat === settingsActiveTab) btn.classList.add('active');
      btn.addEventListener('click', () => {
        if (cat === 'Plugins') {
          // Open plugin manager instead of settings tab
          exitSettingsMode();
          setTimeout(() => enterPluginManagerMode(), 100);
          return;
        }
        if (themeEditorActive && cat !== 'Appearance') {
          themeEditorActive = false;
          applyTheme();
        }
        settingsActiveTab = cat;
        tabs.querySelectorAll('button').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        renderSettingsContent();
        if (cat === 'About') checkAboutUpdate();
      });
      tabs.appendChild(btn);
    });

    // Body
    const body = document.createElement('div');
    body.id = 'zenleap-settings-body';

    // Footer (create button via createElement — innerHTML strips <button> in chrome context)
    const footer = document.createElement('div');
    footer.className = 'zenleap-settings-footer';

    // Left side: Export + Import
    const footerActions = document.createElement('div');
    footerActions.className = 'zenleap-settings-footer-actions';

    const exportBtn = document.createElement('button');
    exportBtn.className = 'zenleap-settings-pill zenleap-pill-export';
    const exportSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    exportSvg.setAttribute('viewBox', '0 0 24 24');
    exportSvg.setAttribute('fill', 'none');
    exportSvg.setAttribute('stroke', 'currentColor');
    exportSvg.setAttribute('stroke-width', '2');
    exportSvg.setAttribute('stroke-linecap', 'round');
    exportSvg.setAttribute('stroke-linejoin', 'round');
    const ePath1 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    ePath1.setAttribute('d', 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4');
    const ePoly = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
    ePoly.setAttribute('points', '7 10 12 15 17 10');
    const eLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    eLine.setAttribute('x1', '12'); eLine.setAttribute('y1', '15'); eLine.setAttribute('x2', '12'); eLine.setAttribute('y2', '3');
    exportSvg.appendChild(ePath1); exportSvg.appendChild(ePoly); exportSvg.appendChild(eLine);
    const exportLabel = document.createElement('span');
    exportLabel.textContent = 'Export';
    exportBtn.appendChild(exportSvg);
    exportBtn.appendChild(exportLabel);
    exportBtn.addEventListener('click', () => exportSettings());

    const importBtn = document.createElement('button');
    importBtn.className = 'zenleap-settings-pill zenleap-pill-import';
    const importSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    importSvg.setAttribute('viewBox', '0 0 24 24');
    importSvg.setAttribute('fill', 'none');
    importSvg.setAttribute('stroke', 'currentColor');
    importSvg.setAttribute('stroke-width', '2');
    importSvg.setAttribute('stroke-linecap', 'round');
    importSvg.setAttribute('stroke-linejoin', 'round');
    const iPath1 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    iPath1.setAttribute('d', 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4');
    const iPoly = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
    iPoly.setAttribute('points', '17 8 12 3 7 8');
    const iLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    iLine.setAttribute('x1', '12'); iLine.setAttribute('y1', '3'); iLine.setAttribute('x2', '12'); iLine.setAttribute('y2', '15');
    importSvg.appendChild(iPath1); importSvg.appendChild(iPoly); importSvg.appendChild(iLine);
    const importLabel = document.createElement('span');
    importLabel.textContent = 'Import';
    importBtn.appendChild(importSvg);
    importBtn.appendChild(importLabel);
    importBtn.addEventListener('click', () => importSettingsFromFile());

    footerActions.appendChild(exportBtn);
    footerActions.appendChild(importBtn);

    // Right side: Reset All
    const resetAllBtn = document.createElement('button');
    resetAllBtn.className = 'zenleap-settings-reset-all';
    resetAllBtn.textContent = 'Reset All to Defaults';
    resetAllBtn.addEventListener('click', () => {
      resetAllSettings();
      renderSettingsContent();
    });

    footer.appendChild(footerActions);
    footer.appendChild(resetAllBtn);

    container.appendChild(header);
    container.appendChild(searchWrap);
    container.appendChild(tabs);
    container.appendChild(body);
    container.appendChild(footer);

    modal.appendChild(backdrop);
    modal.appendChild(container);

    // Inject styles
    injectStyleBlock('zenleap-settings-styles', `
      #zenleap-settings-modal {
        position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
        z-index: 100002; display: none; justify-content: center; align-items: center; padding: 20px;
      }
      #zenleap-settings-modal.active { display: flex; }
      #zenleap-settings-backdrop {
        position: absolute; top: 0; left: 0; width: 100%; height: 100%;
        background: var(--zl-backdrop); backdrop-filter: var(--zl-blur);
      }
      #zenleap-settings-container {
        position: relative; width: 95%; max-width: 750px; max-height: 85vh;
        background: var(--zl-bg-surface); border-radius: var(--zl-r-xl);
        box-shadow: var(--zl-shadow-modal); border: 1px solid var(--zl-border-subtle);
        overflow: hidden; display: flex; flex-direction: column;
        animation: zenleap-modal-enter 0.35s cubic-bezier(0.16, 1, 0.3, 1);
      }
      .zenleap-settings-header {
        padding: 20px 24px 16px; border-bottom: 1px solid var(--zl-border-subtle);
        display: flex; justify-content: space-between; align-items: center;
      }
      .zenleap-settings-header h1 {
        margin: 0; font-size: 22px; font-weight: 700; color: var(--zl-accent); display: inline;
      }
      .zenleap-settings-subtitle {
        display: block; margin-top: 4px; font-size: 12px; color: var(--zl-text-secondary);
      }
      .zenleap-settings-close-btn {
        background: none; border: none; color: var(--zl-text-muted); font-size: 18px; cursor: pointer;
        padding: 4px 8px; border-radius: var(--zl-r-sm); transition: all 0.15s;
      }
      .zenleap-settings-close-btn:hover { color: var(--zl-text-primary); background: var(--zl-bg-hover); }
      .zenleap-settings-search {
        display: flex; align-items: center; padding: 12px 24px; gap: 10px;
        border-bottom: 1px solid var(--zl-border-subtle);
      }
      .zenleap-settings-search-icon { font-size: 14px; opacity: 0.5; }
      #zenleap-settings-search-input {
        flex: 1; background: transparent; border: none; outline: none;
        font-size: 14px; color: var(--zl-text-primary); caret-color: var(--zl-accent);
        font-family: var(--zl-font-ui);
      }
      #zenleap-settings-search-input::placeholder { color: var(--zl-text-muted); }
      .zenleap-settings-tabs {
        display: flex; padding: 0 24px; gap: 4px;
        border-bottom: 1px solid var(--zl-border-subtle);
      }
      .zenleap-settings-tabs.searching {
        display: none;
      }
      .zenleap-settings-tabs button {
        background: none; border: none; color: var(--zl-text-secondary); font-size: 13px; font-weight: 500;
        padding: 10px 16px; cursor: pointer; border-bottom: 2px solid transparent;
        transition: all 0.15s; font-family: var(--zl-font-ui);
      }
      .zenleap-settings-tabs button:hover { color: var(--zl-text-primary); }
      .zenleap-settings-tabs button.active {
        color: var(--zl-accent); border-bottom-color: var(--zl-accent);
      }
      #zenleap-settings-body { flex: 1; overflow-y: auto; padding: 16px 24px; }
      #zenleap-settings-body { scrollbar-width: thin; scrollbar-color: var(--zl-border-strong) transparent; }
      .zenleap-settings-group { margin-bottom: 20px; }
      .zenleap-settings-group h3 {
        margin: 0 0 10px; font-size: 11px; font-weight: 600; color: var(--zl-accent);
        text-transform: uppercase; letter-spacing: 0.8px;
      }
      .zenleap-settings-row {
        display: flex; align-items: center; gap: 12px; padding: 8px 12px;
        border-radius: var(--zl-r-md); transition: background 0.1s;
      }
      .zenleap-settings-row:hover { background: var(--zl-bg-hover); }
      .zenleap-settings-row.modified .zenleap-settings-name { color: var(--zl-warning); }
      .zenleap-settings-label { flex: 1; min-width: 0; }
      .zenleap-settings-name {
        font-size: 13px; font-weight: 500; color: var(--zl-text-primary); display: block;
      }
      .zenleap-settings-desc {
        font-size: 11px; color: var(--zl-text-muted); display: block; margin-top: 2px;
      }
      .zenleap-settings-note {
        font-size: 11px; color: var(--zl-warning); display: block; margin-top: 3px;
      }
      .zenleap-settings-note[data-kind="error"] { color: var(--zl-error); }
      .zenleap-settings-control { flex-shrink: 0; }
      .zenleap-key-recorder {
        background: var(--zl-accent-dim); border: 1px solid var(--zl-accent-border);
        color: var(--zl-accent); padding: 5px 14px; border-radius: var(--zl-r-sm); cursor: pointer;
        font-family: var(--zl-font-mono); font-size: 12px; font-weight: 600;
        min-width: 80px; text-align: center; transition: all 0.15s;
      }
      .zenleap-key-recorder:hover {
        background: var(--zl-accent-20); border-color: var(--zl-accent-40);
      }
      .zenleap-key-recorder.recording {
        background: var(--zl-accent-20); border-color: var(--zl-accent);
        animation: zenleap-recording-pulse 1s ease-in-out infinite;
      }
      @keyframes zenleap-recording-pulse {
        0%, 100% { box-shadow: 0 0 0 0 var(--zl-accent-40); }
        50% { box-shadow: 0 0 0 6px transparent; }
      }
      .zenleap-settings-control input[type="number"],
      .zenleap-settings-control input[type="text"] {
        background: var(--zl-bg-raised); border: 1px solid var(--zl-border-strong);
        color: var(--zl-text-primary); padding: 5px 10px; border-radius: var(--zl-r-sm); font-size: 13px;
        width: 80px; outline: none; transition: border-color 0.15s; font-family: var(--zl-font-ui);
      }
      .zenleap-settings-control input[type="text"] { width: 50px; text-align: center; font-family: var(--zl-font-mono); }
      .zenleap-settings-control input:focus { border-color: var(--zl-accent); }
      .zenleap-settings-reset-btn {
        background: none; border: none; color: var(--zl-text-muted); font-size: 16px; cursor: pointer;
        padding: 4px 6px; border-radius: var(--zl-r-sm); transition: all 0.15s; flex-shrink: 0;
      }
      .zenleap-settings-reset-btn:hover { color: var(--zl-error); background: color-mix(in srgb, var(--zl-error) 10%, transparent); }
      .zenleap-settings-footer {
        padding: 14px 24px; border-top: 1px solid var(--zl-border-subtle);
        display: flex; align-items: center; justify-content: space-between;
      }
      .zenleap-settings-footer-actions {
        display: flex; align-items: center; gap: 6px;
      }
      .zenleap-settings-pill {
        display: inline-flex; align-items: center; gap: 6px;
        padding: 7px 14px; border-radius: var(--zl-r-sm); border: 1px solid transparent;
        font-size: 12px; font-weight: 500; cursor: pointer; transition: all 0.18s;
        font-family: var(--zl-font-ui); white-space: nowrap;
      }
      .zenleap-settings-pill svg { width: 14px; height: 14px; flex-shrink: 0; transition: transform 0.18s; }
      .zenleap-pill-export {
        background: var(--zl-accent-dim); border-color: var(--zl-accent-border); color: var(--zl-accent);
      }
      .zenleap-pill-export:hover {
        background: var(--zl-accent-mid); border-color: var(--zl-accent);
      }
      .zenleap-pill-export:hover svg { transform: translateY(-1px); }
      .zenleap-pill-export:active { transform: scale(0.97); }
      .zenleap-pill-import {
        background: var(--zl-bg-raised); border-color: var(--zl-border-strong); color: var(--zl-text-secondary);
      }
      .zenleap-pill-import:hover {
        background: var(--zl-bg-hover); border-color: var(--zl-border-strong); color: var(--zl-text-primary);
      }
      .zenleap-pill-import:hover svg { transform: translateY(1px); }
      .zenleap-pill-import:active { transform: scale(0.97); }
      .zenleap-settings-reset-all {
        background: color-mix(in srgb, var(--zl-error) 8%, transparent);
        border: 1px solid color-mix(in srgb, var(--zl-error) 20%, transparent);
        color: var(--zl-error); padding: 7px 14px; border-radius: var(--zl-r-sm); cursor: pointer;
        font-size: 12px; font-weight: 500; transition: all 0.18s; font-family: var(--zl-font-ui);
      }
      .zenleap-settings-reset-all:hover {
        background: color-mix(in srgb, var(--zl-error) 15%, transparent); border-color: color-mix(in srgb, var(--zl-error) 35%, transparent);
      }
      .zenleap-settings-reset-all:active { transform: scale(0.97); }
      .zenleap-color-picker {
        width: 32px; height: 32px; border: none; border-radius: var(--zl-r-sm);
        cursor: pointer; padding: 0; background: none; -moz-appearance: none; appearance: none;
      }
      .zenleap-color-picker::-moz-color-swatch {
        border: 2px solid var(--zl-border-strong); border-radius: var(--zl-r-sm);
      }
      .zenleap-color-hex {
        background: var(--zl-bg-raised); border: 1px solid var(--zl-border-strong);
        color: var(--zl-text-primary); padding: 5px 8px; border-radius: var(--zl-r-sm); font-size: 12px;
        width: 72px; font-family: var(--zl-font-mono); text-align: center; outline: none;
        transition: border-color 0.15s;
      }
      .zenleap-color-hex:focus { border-color: var(--zl-accent); }
      .zenleap-select {
        background: var(--zl-bg-raised); border: 1px solid var(--zl-border-strong);
        color: var(--zl-text-primary); padding: 5px 28px 5px 10px; border-radius: var(--zl-r-sm); font-size: 13px;
        font-family: var(--zl-font-ui); outline: none; transition: border-color 0.15s; cursor: pointer;
        -moz-appearance: none; appearance: none;
        background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
        background-repeat: no-repeat; background-position: right 8px center;
      }
      .zenleap-select:focus { border-color: var(--zl-accent); }
      .zenleap-select option { background: var(--zl-bg-deep); color: var(--zl-text-primary); }
      .zenleap-settings-empty {
        padding: 40px 20px; text-align: center; color: var(--zl-text-muted); font-size: 14px;
      }

      /* ═══ Cross-tab search: category sections & badges ═══ */
      .zenleap-settings-search-results-header {
        display: flex; align-items: center; justify-content: space-between;
        padding: 0 0 10px; margin-bottom: 4px;
        border-bottom: 1px solid var(--zl-border-subtle);
      }
      .zenleap-settings-search-results-header .zenleap-search-result-count {
        font-size: 11px; color: var(--zl-text-muted); font-weight: 500;
        letter-spacing: 0.3px;
      }
      .zenleap-settings-search-results-header .zenleap-search-clear-btn {
        background: none; border: 1px solid var(--zl-border-subtle); color: var(--zl-text-secondary);
        font-size: 11px; padding: 2px 10px; border-radius: var(--zl-r-sm); cursor: pointer;
        font-family: var(--zl-font-ui); transition: all 0.15s;
      }
      .zenleap-settings-search-results-header .zenleap-search-clear-btn:hover {
        color: var(--zl-text-primary); border-color: var(--zl-border-strong);
        background: var(--zl-bg-hover);
      }
      .zenleap-settings-category-section {
        margin-bottom: 20px;
      }
      .zenleap-settings-category-header {
        display: flex; align-items: center; gap: 10px; margin-bottom: 12px; padding-top: 8px;
      }
      .zenleap-settings-category-header .zenleap-cat-label {
        font-size: 12px; font-weight: 600; color: var(--zl-text-primary);
        letter-spacing: 0.3px;
      }
      .zenleap-settings-category-header .zenleap-cat-divider {
        flex: 1; height: 1px; background: var(--zl-border-subtle);
      }
      .zenleap-settings-category-header .zenleap-cat-count {
        font-size: 10px; color: var(--zl-text-muted); font-weight: 500;
      }
      .zenleap-settings-category-badge {
        display: inline-flex; align-items: center; gap: 4px;
        font-size: 9px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.6px;
        padding: 2px 7px; border-radius: 3px;
        background: var(--zl-accent-dim); color: var(--zl-accent); border: 1px solid var(--zl-accent-border);
        cursor: pointer; transition: all 0.15s; vertical-align: middle; margin-left: 6px;
        line-height: 1.4;
      }
      .zenleap-settings-category-badge:hover {
        background: var(--zl-accent-mid); border-color: var(--zl-accent);
      }

      /* ═══ About Page ═══ */
      .zenleap-about {
        display: flex; flex-direction: column; align-items: center;
        padding: 32px 16px 24px; gap: 20px; min-height: 100%;
      }
      .zenleap-about-hero { text-align: center; margin-bottom: 4px; }
      .zenleap-about-title {
        margin: 0; font-size: 32px; font-weight: 700; color: var(--zl-accent);
        letter-spacing: -0.5px; line-height: 1;
      }
      .zenleap-about-tagline {
        margin: 12px 0 0; font-size: 15px; font-weight: 500; color: var(--zl-text-primary);
        letter-spacing: -0.2px;
      }
      .zenleap-about-desc {
        margin: 6px 0 0; font-size: 12px; color: var(--zl-text-muted);
        max-width: 320px; line-height: 1.5;
      }
      .zenleap-about-card {
        width: 100%; max-width: 360px;
        background: var(--zl-bg-raised); border: 1px solid var(--zl-border-subtle);
        border-radius: var(--zl-r-lg); padding: 14px 18px;
        transition: border-color 0.15s;
      }
      .zenleap-about-card:hover { border-color: var(--zl-border-strong); }
      .zenleap-about-version-row {
        display: flex; justify-content: space-between; align-items: center;
      }
      .zenleap-about-version-label {
        font-size: 13px; font-weight: 500; color: var(--zl-text-secondary);
      }
      .zenleap-about-version-right {
        display: flex; align-items: center; gap: 10px;
      }
      .zenleap-about-version-num {
        font-size: 13px; font-weight: 600; color: var(--zl-text-primary);
        font-family: var(--zl-font-mono);
      }
      .zenleap-about-update-badge {
        font-size: 11px; font-weight: 500; padding: 2px 10px;
        border-radius: 999px; font-family: var(--zl-font-ui);
        transition: all 0.2s ease;
      }
      .zenleap-about-update-badge.checking {
        color: var(--zl-text-muted); background: var(--zl-bg-elevated);
        animation: zenleap-about-pulse 1.5s ease-in-out infinite;
      }
      .zenleap-about-update-badge.available {
        color: var(--zl-accent); background: var(--zl-accent-dim);
        border: 1px solid var(--zl-accent-border);
      }
      .zenleap-about-update-badge.uptodate {
        color: var(--zl-green, var(--zl-text-muted)); background: color-mix(in srgb, var(--zl-green, var(--zl-text-muted)) 12%, transparent);
      }
      .zenleap-about-update-badge.error {
        color: var(--zl-text-muted); background: var(--zl-bg-elevated);
      }
      @keyframes zenleap-about-pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.5; }
      }
      .zenleap-about-update-hint {
        margin-top: 10px; text-align: center; font-size: 12px; color: var(--zl-text-muted);
        animation: zenleap-modal-enter 0.3s ease;
      }
      .zenleap-about-update-hint kbd {
        background: var(--zl-accent-dim); color: var(--zl-accent); padding: 2px 7px;
        border-radius: var(--zl-r-sm); font-family: var(--zl-font-mono); font-size: 11px;
        font-weight: 600; border: 1px solid var(--zl-accent-border);
        box-shadow: var(--zl-shadow-kbd);
      }
      .zenleap-about-link-row {
        display: flex; align-items: center; gap: 10px;
        padding: 4px 0; border-radius: var(--zl-r-sm); transition: all 0.15s;
        cursor: pointer;
      }
      .zenleap-about-link-row:hover .zenleap-about-link-url { color: var(--zl-accent); }
      .zenleap-about-link-icon {
        color: var(--zl-text-secondary); display: flex; align-items: center; flex-shrink: 0;
      }
      .zenleap-about-link-label {
        font-size: 13px; font-weight: 500; color: var(--zl-text-secondary); flex-shrink: 0;
      }
      .zenleap-about-link-url {
        font-size: 12px; color: var(--zl-text-muted); font-family: var(--zl-font-mono);
        transition: color 0.15s; margin-left: auto;
      }
      .zenleap-about-footer {
        margin-top: 8px; font-size: 11px; color: var(--zl-text-muted);
        font-style: italic; opacity: 0.7; text-align: center;
      }

      /* ═══ Theme Editor ═══ */
      .zenleap-theme-editor-section {
        margin-top: 24px; border-top: 1px solid var(--zl-border-subtle); padding-top: 16px;
      }
      .zenleap-theme-editor-header {
        display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;
      }
      .zenleap-theme-editor-header h3 {
        margin: 0; font-size: 11px; font-weight: 600; color: var(--zl-accent);
        text-transform: uppercase; letter-spacing: 0.8px;
      }
      .zenleap-theme-editor-create-btn {
        background: var(--zl-accent-dim); border: 1px solid var(--zl-accent-border);
        color: var(--zl-accent); padding: 5px 14px; border-radius: var(--zl-r-sm);
        cursor: pointer; font-size: 12px; font-weight: 500; font-family: var(--zl-font-ui);
        transition: all 0.15s;
      }
      .zenleap-theme-editor-create-btn:hover {
        background: var(--zl-accent-mid); border-color: var(--zl-accent);
      }
      .zenleap-theme-editor-empty {
        padding: 20px; text-align: center; color: var(--zl-text-muted); font-size: 12px;
        font-style: italic;
      }
      /* Theme Cards */
      .zenleap-theme-cards { display: flex; flex-direction: column; gap: 6px; margin-bottom: 12px; }
      .zenleap-theme-card {
        display: flex; align-items: center; gap: 10px; padding: 8px 12px;
        background: var(--zl-bg-raised); border: 1px solid var(--zl-border-subtle);
        border-radius: var(--zl-r-md); transition: all 0.15s;
      }
      .zenleap-theme-card:hover { border-color: var(--zl-border-strong); background: var(--zl-bg-elevated); }
      .zenleap-theme-card.active-theme { border-color: var(--zl-accent-border); }
      .zenleap-theme-swatches { display: flex; gap: 3px; flex-shrink: 0; }
      .zenleap-theme-swatch {
        width: 14px; height: 14px; border-radius: 3px; border: 1px solid var(--zl-border-subtle);
      }
      .zenleap-theme-card-info { flex: 1; min-width: 0; }
      .zenleap-theme-card-name { font-size: 13px; font-weight: 500; color: var(--zl-text-primary); }
      .zenleap-theme-card-actions { display: flex; gap: 6px; flex-shrink: 0; }
      .zenleap-theme-card-btn {
        background: none; border: 1px solid var(--zl-border-strong); color: var(--zl-text-secondary);
        padding: 3px 10px; border-radius: var(--zl-r-sm); cursor: pointer; font-size: 11px;
        font-family: var(--zl-font-ui); transition: all 0.15s;
      }
      .zenleap-theme-card-btn:hover { color: var(--zl-text-primary); background: var(--zl-bg-hover); }
      .zenleap-theme-card-btn.delete:hover {
        color: var(--zl-error); border-color: color-mix(in srgb, var(--zl-error) 30%, transparent); background: color-mix(in srgb, var(--zl-error) 10%, transparent);
      }
      /* Editor Panel */
      .zenleap-theme-editor-panel {
        background: var(--zl-bg-deep); border: 1px solid var(--zl-border-default);
        border-radius: var(--zl-r-md); padding: 16px; margin-top: 12px;
      }
      .zenleap-theme-editor-panel-header {
        display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;
        font-size: 14px; font-weight: 600; color: var(--zl-accent);
      }
      .zenleap-theme-editor-row {
        display: flex; align-items: center; gap: 12px; margin-bottom: 10px;
      }
      .zenleap-theme-editor-label {
        font-size: 12px; font-weight: 500; color: var(--zl-text-secondary); width: 100px; flex-shrink: 0;
      }
      .zenleap-theme-editor-input {
        flex: 1; background: var(--zl-bg-raised); border: 1px solid var(--zl-border-strong);
        color: var(--zl-text-primary); padding: 6px 10px; border-radius: var(--zl-r-sm);
        font-size: 13px; font-family: var(--zl-font-ui); outline: none; transition: border-color 0.15s;
      }
      .zenleap-theme-editor-input:focus { border-color: var(--zl-accent); }
      /* Preview Strip */
      .zenleap-theme-preview-strip {
        display: flex; align-items: center; gap: 10px; margin: 12px 0 16px;
        padding: 10px 12px; background: var(--zl-bg-void); border-radius: var(--zl-r-sm);
        border: 1px solid var(--zl-border-subtle);
      }
      .zenleap-theme-preview-label {
        font-size: 10px; font-weight: 600; color: var(--zl-text-muted);
        text-transform: uppercase; letter-spacing: 0.5px; flex-shrink: 0;
      }
      .zenleap-theme-preview-swatches { display: flex; gap: 4px; flex: 1; }
      .zenleap-theme-preview-swatch {
        flex: 1; height: 24px; border-radius: 4px; border: 1px solid var(--zl-border-subtle);
        transition: background 0.15s;
      }
      /* Property Groups */
      .zenleap-theme-editor-group { margin-bottom: 16px; }
      .zenleap-theme-editor-group-header {
        display: flex; align-items: center; gap: 6px;
        font-size: 10px; font-weight: 600; color: var(--zl-text-muted);
        text-transform: uppercase; letter-spacing: 0.6px; margin-bottom: 2px;
        padding-bottom: 4px; border-bottom: 1px solid var(--zl-border-subtle);
      }
      .zenleap-theme-group-browser-badge {
        font-size: 8px; font-weight: 700; letter-spacing: 0.5px;
        color: var(--zl-accent); background: var(--zl-accent-dim);
        border: 1px solid var(--zl-accent-border); border-radius: 3px;
        padding: 1px 5px; text-transform: uppercase; cursor: default;
        line-height: 1.2;
      }
      .zenleap-theme-group-desc {
        font-size: 10px; color: var(--zl-text-muted); font-style: italic;
        margin-bottom: 6px; opacity: 0.7; line-height: 1.4;
      }
      .zenleap-theme-group-browser-note {
        color: var(--zl-accent); font-style: italic; opacity: 0.9;
      }
      .zenleap-theme-prop-row {
        display: flex; align-items: center; gap: 8px; padding: 4px 8px;
        border-radius: var(--zl-r-sm); transition: background 0.1s;
      }
      .zenleap-theme-prop-row:hover { background: rgba(255,255,255,0.02); }
      .zenleap-theme-prop-row.overridden { background: var(--zl-accent-dim); }
      .zenleap-theme-prop-label {
        width: 140px; flex-shrink: 0;
      }
      .zenleap-theme-prop-label-top {
        display: flex; align-items: center; gap: 4px;
        font-size: 12px; font-weight: 500; color: var(--zl-text-primary);
      }
      .zenleap-theme-prop-hint {
        display: block; font-size: 9px; color: var(--zl-text-muted);
        line-height: 1.3; margin-top: 1px; opacity: 0.7;
      }
      .zenleap-theme-prop-browser-badge {
        display: inline-flex; align-items: center; justify-content: center;
        font-size: 8px; font-weight: 700; color: var(--zl-accent);
        background: var(--zl-accent-dim); border: 1px solid var(--zl-accent-border);
        border-radius: 3px; width: 14px; height: 14px; flex-shrink: 0;
        cursor: default; line-height: 1;
      }
      .zenleap-theme-prop-inherited {
        display: flex; align-items: center; gap: 4px; font-size: 10px; color: var(--zl-text-muted);
        width: 100px; flex-shrink: 0; overflow: hidden; text-overflow: ellipsis;
      }
      .zenleap-theme-prop-dot {
        display: inline-block; width: 8px; height: 8px; border-radius: 2px;
        border: 1px solid var(--zl-border-subtle); flex-shrink: 0;
      }
      .zenleap-theme-prop-control {
        display: flex; align-items: center; gap: 6px; flex: 1; justify-content: flex-end;
      }
      .zenleap-theme-prop-clear {
        background: none; border: none; color: var(--zl-text-muted); font-size: 14px;
        cursor: pointer; padding: 2px 4px; border-radius: var(--zl-r-sm);
        transition: all 0.15s; flex-shrink: 0;
      }
      .zenleap-theme-prop-clear:hover { color: var(--zl-error); background: rgba(224,108,117,0.1); }
      .zenleap-theme-editor-expand-btn {
        background: none; border: none; color: var(--zl-text-muted); font-size: 11px;
        cursor: pointer; padding: 4px 8px; margin-top: 4px; border-radius: var(--zl-r-sm);
        font-family: var(--zl-font-ui); transition: all 0.15s;
      }
      .zenleap-theme-editor-expand-btn:hover { color: var(--zl-text-secondary); background: var(--zl-bg-hover); }
      /* Action Buttons */
      .zenleap-theme-editor-actions {
        display: flex; gap: 8px; justify-content: flex-end; margin-top: 16px;
        padding-top: 12px; border-top: 1px solid var(--zl-border-subtle);
      }
      .zenleap-theme-editor-save-btn {
        background: var(--zl-accent); border: 1px solid var(--zl-accent); color: var(--zl-bg-base);
        padding: 6px 20px; border-radius: var(--zl-r-sm); cursor: pointer;
        font-size: 12px; font-weight: 600; font-family: var(--zl-font-ui); transition: all 0.15s;
      }
      .zenleap-theme-editor-save-btn:hover { filter: brightness(1.1); }
      .zenleap-theme-editor-cancel-btn {
        background: var(--zl-bg-raised); border: 1px solid var(--zl-border-strong);
        color: var(--zl-text-secondary); padding: 6px 16px; border-radius: var(--zl-r-sm);
        cursor: pointer; font-size: 12px; font-weight: 500; font-family: var(--zl-font-ui);
        transition: all 0.15s;
      }
      .zenleap-theme-editor-cancel-btn:hover { color: var(--zl-text-primary); background: var(--zl-bg-hover); }
      /* Import confirmation dialog */
      #zenleap-import-overlay {
        position: fixed; inset: 0; z-index: 100010;
        display: flex; align-items: center; justify-content: center; padding: 20px;
        animation: zenleap-import-overlay-in 0.2s ease-out;
      }
      @keyframes zenleap-import-overlay-in { from { opacity: 0; } to { opacity: 1; } }
      .zenleap-import-backdrop {
        position: absolute; inset: 0; background: var(--zl-backdrop); backdrop-filter: blur(4px);
      }
      .zenleap-import-dialog {
        position: relative; width: 100%; max-width: 440px;
        background: var(--zl-bg-surface); border: 1px solid var(--zl-border-subtle);
        border-radius: var(--zl-r-xl); overflow: hidden;
        box-shadow: var(--zl-shadow-modal);
        animation: zenleap-import-dialog-in 0.25s cubic-bezier(0.16, 1, 0.3, 1);
      }
      @keyframes zenleap-import-dialog-in {
        from { opacity: 0; transform: scale(0.96) translateY(-6px); }
        to { opacity: 1; transform: scale(1) translateY(0); }
      }
      .zenleap-import-dialog-header {
        padding: 18px 20px 14px; display: flex; align-items: center; gap: 10px;
      }
      .zenleap-import-dialog-icon {
        width: 32px; height: 32px; border-radius: var(--zl-r-md);
        background: var(--zl-accent-dim);
        display: flex; align-items: center; justify-content: center; flex-shrink: 0;
      }
      .zenleap-import-dialog-icon svg { width: 16px; height: 16px; color: var(--zl-accent); }
      .zenleap-import-dialog-title { font-size: 15px; font-weight: 600; color: var(--zl-text-primary); }
      .zenleap-import-dialog-subtitle { font-size: 12px; color: var(--zl-text-muted); margin-top: 2px; }
      .zenleap-import-changes {
        padding: 0 20px; max-height: 220px; overflow-y: auto;
      }
      .zenleap-import-changes { scrollbar-width: thin; scrollbar-color: var(--zl-border-strong) transparent; }
      .zenleap-import-change-row {
        display: flex; align-items: center; gap: 10px;
        padding: 8px 10px; border-radius: var(--zl-r-sm); font-size: 12px; transition: background 0.1s;
      }
      .zenleap-import-change-row:hover { background: var(--zl-bg-hover); }
      .zenleap-import-change-name { flex: 1; color: var(--zl-text-secondary); font-weight: 500; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .zenleap-import-change-arrow { color: var(--zl-text-muted); flex-shrink: 0; font-size: 11px; }
      .zenleap-import-change-from { color: var(--zl-text-tertiary); font-family: var(--zl-font-mono); font-size: 11px; max-width: 70px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .zenleap-import-change-to { color: var(--zl-gold); font-family: var(--zl-font-mono); font-size: 11px; font-weight: 600; max-width: 70px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .zenleap-import-summary {
        margin: 12px 20px; padding: 8px 12px;
        background: var(--zl-accent-dim); border: 1px solid var(--zl-accent-border);
        border-radius: var(--zl-r-md); font-size: 12px; color: var(--zl-text-tertiary);
        display: flex; align-items: center; gap: 6px;
      }
      .zenleap-import-summary strong { color: var(--zl-accent); font-weight: 600; }
      .zenleap-import-dialog-actions {
        padding: 14px 20px; display: flex; align-items: center; justify-content: flex-end; gap: 8px;
        border-top: 1px solid var(--zl-border-subtle);
      }
      .zenleap-import-btn-cancel {
        padding: 7px 16px; border-radius: var(--zl-r-sm); border: 1px solid var(--zl-border-strong);
        background: var(--zl-bg-raised); color: var(--zl-text-secondary); font-size: 12px; font-weight: 500;
        font-family: var(--zl-font-ui); cursor: pointer; transition: all 0.15s;
      }
      .zenleap-import-btn-cancel:hover, .zenleap-import-btn-cancel:focus-visible { background: var(--zl-bg-hover); color: var(--zl-text-primary); }
      .zenleap-import-btn-apply {
        padding: 7px 18px; border-radius: var(--zl-r-sm); border: 1px solid var(--zl-accent-border);
        background: var(--zl-accent-dim); color: var(--zl-accent); font-size: 12px; font-weight: 600;
        font-family: var(--zl-font-ui); cursor: pointer; transition: all 0.15s;
      }
      .zenleap-import-btn-apply:hover { background: var(--zl-accent-mid); border-color: var(--zl-accent); }
      .zenleap-import-btn-cancel:focus-visible, .zenleap-import-btn-apply:focus-visible { outline: 2px solid var(--zl-accent); outline-offset: 2px; }
      .zenleap-import-btn-apply:active, .zenleap-import-btn-cancel:active { transform: scale(0.97); }
      /* Settings toast */
      .zenleap-settings-toast {
        position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%);
        z-index: 100020; display: inline-flex; align-items: center; gap: 8px;
        padding: 10px 18px; background: var(--zl-bg-surface);
        border: 1px solid var(--zl-border-subtle); border-radius: var(--zl-r-md);
        box-shadow: var(--zl-shadow-modal);
        font-size: 13px; font-weight: 500; backdrop-filter: blur(12px);
        font-family: var(--zl-font-ui);
        animation: zenleap-settings-toast-in 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        white-space: nowrap;
      }
      @keyframes zenleap-settings-toast-in {
        from { opacity: 0; transform: translateX(-50%) translateY(8px) scale(0.96); }
        to { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); }
      }
      @keyframes zenleap-settings-toast-out {
        from { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); }
        to { opacity: 0; transform: translateX(-50%) translateY(4px) scale(0.97); }
      }
      .zenleap-settings-toast svg { width: 15px; height: 15px; flex-shrink: 0; }
      .zenleap-settings-toast.success { border-color: color-mix(in srgb, var(--zl-success) 15%, transparent); color: var(--zl-success); }
      .zenleap-settings-toast.error { border-color: color-mix(in srgb, var(--zl-error) 15%, transparent); color: var(--zl-error); }
    `);
    document.documentElement.appendChild(modal);

    // Only assign after successful creation so failures allow retry
    settingsModal = modal;

    renderSettingsContent();
    log('Settings modal created');
  }

  function renderSettingsContent() {
    const body = document.getElementById('zenleap-settings-body');
    if (!body) return;
    const scrollTop = body.scrollTop;
    body.innerHTML = '';

    // Toggle search / footer visibility based on tab
    const isAbout = settingsActiveTab === 'About';
    const searchBar = body.parentElement?.querySelector('.zenleap-settings-search');
    const footer = body.parentElement?.querySelector('.zenleap-settings-footer');
    if (searchBar) searchBar.style.display = isAbout ? 'none' : '';
    if (footer) footer.style.display = isAbout ? 'none' : '';

    // About tab — custom layout
    if (isAbout) {
      body.appendChild(renderAboutContent());
      return;
    }

    const isSearching = !!settingsSearchQuery;

    if (isSearching) {
      // Cross-tab search: search ALL categories
      const entries = Object.entries(SETTINGS_SCHEMA).filter(([id, schema]) => {
        if (schema.hidden) return false;
        const text = `${schema.label} ${schema.description || ''} ${schema.group} ${id}`.toLowerCase();
        return text.includes(settingsSearchQuery);
      });

      if (entries.length === 0) {
        body.innerHTML = '<div class="zenleap-settings-empty">No settings match your search</div>';
        return;
      }

      // Results header with count + clear button
      const resultsHeader = document.createElement('div');
      resultsHeader.className = 'zenleap-settings-search-results-header';
      const countSpan = document.createElement('span');
      countSpan.className = 'zenleap-search-result-count';
      countSpan.textContent = `${entries.length} result${entries.length !== 1 ? 's' : ''} across all tabs`;
      resultsHeader.appendChild(countSpan);
      const clearBtn = document.createElement('button');
      clearBtn.className = 'zenleap-search-clear-btn';
      clearBtn.textContent = 'Clear search';
      clearBtn.addEventListener('click', () => {
        const input = document.getElementById('zenleap-settings-search-input');
        if (input) { input.value = ''; input.focus(); }
        settingsSearchQuery = '';
        const tabsEl = document.getElementById('zenleap-settings-tabs');
        if (tabsEl) tabsEl.classList.remove('searching');
        renderSettingsContent();
      });
      resultsHeader.appendChild(clearBtn);
      body.appendChild(resultsHeader);

      // Group by category, then by group within each category
      const categoryOrder = ['Keybindings', 'Timing', 'Appearance', 'Display', 'Advanced'];
      const byCategory = new Map();
      for (const [id, schema] of entries) {
        const cat = schema.category;
        if (!byCategory.has(cat)) byCategory.set(cat, []);
        byCategory.get(cat).push([id, schema]);
      }

      for (const cat of categoryOrder) {
        if (!byCategory.has(cat)) continue;
        const catEntries = byCategory.get(cat);

        // Category section
        const catSection = document.createElement('div');
        catSection.className = 'zenleap-settings-category-section';

        // Category header with label, divider, and count
        const catHeader = document.createElement('div');
        catHeader.className = 'zenleap-settings-category-header';
        const catLabel = document.createElement('span');
        catLabel.className = 'zenleap-cat-label';
        catLabel.textContent = cat;
        const catDivider = document.createElement('span');
        catDivider.className = 'zenleap-cat-divider';
        const catCount = document.createElement('span');
        catCount.className = 'zenleap-cat-count';
        catCount.textContent = `${catEntries.length}`;
        catHeader.appendChild(catLabel);
        catHeader.appendChild(catDivider);
        catHeader.appendChild(catCount);
        catSection.appendChild(catHeader);

        // Sub-group within category
        const groups = new Map();
        for (const [id, schema] of catEntries) {
          const g = schema.group || 'General';
          if (!groups.has(g)) groups.set(g, []);
          groups.get(g).push([id, schema]);
        }

        for (const [groupName, items] of groups) {
          const groupDiv = document.createElement('div');
          groupDiv.className = 'zenleap-settings-group';
          const h3 = document.createElement('h3');
          h3.textContent = groupName;
          // Add a clickable category badge to navigate to that tab
          const badge = document.createElement('span');
          badge.className = 'zenleap-settings-category-badge';
          badge.textContent = cat;
          badge.title = `Go to ${cat} tab`;
          badge.addEventListener('click', () => {
            const input = document.getElementById('zenleap-settings-search-input');
            if (input) { input.value = ''; }
            settingsSearchQuery = '';
            settingsActiveTab = cat;
            const tabsEl = document.getElementById('zenleap-settings-tabs');
            if (tabsEl) {
              tabsEl.classList.remove('searching');
              tabsEl.querySelectorAll('button').forEach(b => {
                b.classList.toggle('active', b.dataset.tab === cat);
              });
            }
            renderSettingsContent();
          });
          h3.appendChild(badge);
          groupDiv.appendChild(h3);

          for (const [id, schema] of items) {
            groupDiv.appendChild(createSettingRow(id, schema));
          }
          catSection.appendChild(groupDiv);
        }

        body.appendChild(catSection);
      }
    } else {
      // Normal tab-scoped view (no search)
      const entries = Object.entries(SETTINGS_SCHEMA).filter(([id, schema]) => {
        if (schema.hidden) return false;
        return schema.category === settingsActiveTab;
      });

      // Group by subcategory
      const groups = new Map();
      for (const [id, schema] of entries) {
        const g = schema.group || 'General';
        if (!groups.has(g)) groups.set(g, []);
        groups.get(g).push([id, schema]);
      }

      if (groups.size === 0) {
        body.innerHTML = '<div class="zenleap-settings-empty">No settings found</div>';
        return;
      }

      for (const [groupName, items] of groups) {
        const groupDiv = document.createElement('div');
        groupDiv.className = 'zenleap-settings-group';
        const h3 = document.createElement('h3');
        h3.textContent = groupName;
        groupDiv.appendChild(h3);

        for (const [id, schema] of items) {
          groupDiv.appendChild(createSettingRow(id, schema));
        }
        body.appendChild(groupDiv);
      }

      // Theme editor section (Appearance tab only)
      if (settingsActiveTab === 'Appearance') {
        body.appendChild(renderThemeEditorSection());
      }
    }

    body.scrollTop = scrollTop;
  }

  function createSettingRow(id, schema) {
    const row = document.createElement('div');
    row.className = 'zenleap-settings-row';
    row.dataset.id = id;

    const isModified = JSON.stringify(S[id]) !== JSON.stringify(schema.default);
    if (isModified) row.classList.add('modified');

    // Label
    const label = document.createElement('div');
    label.className = 'zenleap-settings-label';
    const nameSpan = document.createElement('span');
    nameSpan.className = 'zenleap-settings-name';
    nameSpan.textContent = schema.label;
    label.appendChild(nameSpan);
    if (schema.description) {
      const descSpan = document.createElement('span');
      descSpan.className = 'zenleap-settings-desc';
      descSpan.textContent = schema.description;
      label.appendChild(descSpan);
    }

    // Control
    const control = document.createElement('div');
    control.className = 'zenleap-settings-control';

    if (schema.type === 'combo' || schema.type === 'key') {
      const btn = document.createElement('button');
      btn.className = 'zenleap-key-recorder';
      btn.textContent = formatKeyDisplay(S[id], schema);
      btn.addEventListener('click', () => startKeyRecording(id, btn));
      control.appendChild(btn);
    } else if (schema.type === 'number') {
      const input = document.createElement('input');
      input.type = 'number';
      input.value = S[id];
      if (schema.min !== undefined) input.min = schema.min;
      if (schema.max !== undefined) input.max = schema.max;
      if (schema.step !== undefined) input.step = schema.step;
      input.addEventListener('change', () => {
        let val = parseFloat(input.value);
        if (isNaN(val)) val = schema.default;
        if (schema.min !== undefined && val < schema.min) val = schema.min;
        if (schema.max !== undefined && val > schema.max) val = schema.max;
        S[id] = val;
        input.value = val;
        saveSettings();
        row.classList.toggle('modified', JSON.stringify(S[id]) !== JSON.stringify(schema.default));
      });
      control.appendChild(input);
    } else if (schema.type === 'text') {
      const input = document.createElement('input');
      input.type = 'text';
      input.value = S[id];
      if (schema.maxLength) input.maxLength = schema.maxLength;
      input.addEventListener('input', () => {
        S[id] = input.value;
        saveSettings();
        row.classList.toggle('modified', JSON.stringify(S[id]) !== JSON.stringify(schema.default));
      });
      control.appendChild(input);
    } else if (schema.type === 'toggle') {
      const toggle = document.createElement('label');
      toggle.className = 'zenleap-toggle';
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = !!S[id];
      const slider = document.createElement('span');
      slider.className = 'zenleap-toggle-slider';
      toggle.appendChild(cb);
      toggle.appendChild(slider);
      cb.addEventListener('change', () => {
        S[id] = cb.checked;
        saveSettings();
        row.classList.toggle('modified', JSON.stringify(S[id]) !== JSON.stringify(schema.default));
        if (id === 'appearance.applyToBrowser') applyBrowserTheme();
        if (id === 'display.persistEssentialMarks') {
          if (cb.checked) saveEssentialMarks();
          else try { Services.prefs.clearUserPref('uc.zenleap.essentialMarks'); } catch(e) {}
        }
      });
      control.appendChild(toggle);
    } else if (schema.type === 'select') {
      const select = document.createElement('select');
      select.className = 'zenleap-select';
      const opts = schema.dynamicOptions === 'theme' ? getThemeOptions() : (schema.options || []);
      for (const opt of opts) {
        const option = document.createElement('option');
        option.value = opt.value;
        option.textContent = opt.label;
        if (S[id] === opt.value) option.selected = true;
        select.appendChild(option);
      }
      select.addEventListener('change', () => {
        S[id] = select.value;
        saveSettings();
        if (id === 'appearance.theme') applyTheme();
        if (id === 'display.showRelativeNumbers') updateRelativeNumbers();
        row.classList.toggle('modified', JSON.stringify(S[id]) !== JSON.stringify(schema.default));
      });
      control.appendChild(select);
    }

    // Reset button
    const resetBtn = document.createElement('button');
    resetBtn.className = 'zenleap-settings-reset-btn';
    resetBtn.textContent = '\u21BA';
    resetBtn.title = `Reset to default: ${formatKeyDisplay(schema.default, schema)}`;
    resetBtn.addEventListener('click', () => {
      resetSetting(id);
      renderSettingsContent();
    });

    row.appendChild(label);
    row.appendChild(control);
    row.appendChild(resetBtn);
    if (schema.type === 'combo' || schema.type === 'key') showKeyConflictNote(row, id);
    return row;
  }

  // --- Key binding conflicts (LEAP-B-16 / LEAP-COMPAT-23) ---

  // Single-key settings that are live in the same mode (duplicates there make
  // one of them unreachable). Browse mode also honours the leap-mode keys below.
  const KEY_GROUP_EXTRAS = {
    'Browse Mode': ['keys.leap.browseDown', 'keys.leap.browseDownAlt', 'keys.leap.browseUp', 'keys.leap.browseUpAlt',
                    'keys.leap.setMark', 'keys.leap.clearMarks', 'keys.leap.gotoMark', 'keys.leap.gotoMarkAlt'],
  };

  function sameSingleKey(idA, a, idB, b) {
    if (typeof a !== 'string' || typeof b !== 'string' || !a || !b) return false;
    const csA = !!SETTINGS_SCHEMA[idA]?.caseSensitive, csB = !!SETTINGS_SCHEMA[idB]?.caseSensitive;
    if (csA && csB) return a === b;
    if (csA || csB) return false; // e.g. G (case-sensitive) vs g: G is checked first by design
    return a.toLowerCase() === b.toLowerCase();
  }

  function sameCombo(a, b) {
    if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
    const keyEq = a.key === b.key || (a.code && a.code === b.code);
    return keyEq && !!a.ctrl === !!b.ctrl && !!a.shift === !!b.shift && !!a.alt === !!b.alt && !!a.meta === !!b.meta;
  }

  const VK_KEY_NAMES = { VK_RETURN: 'enter', VK_ESCAPE: 'escape', VK_TAB: 'tab', VK_BACK: 'backspace', VK_DELETE: 'delete',
                         VK_LEFT: 'arrowleft', VK_RIGHT: 'arrowright', VK_UP: 'arrowup', VK_DOWN: 'arrowdown', VK_HOME: 'home',
                         VK_END: 'end', VK_SPACE: ' ' };

  // Readable names for Zen shortcuts: Zen's localized names live in the
  // preferences FTL (not loaded in browser windows); fall back to the id.
  let _zenPrefsL10n = null;
  function zenShortcutLabel(sc) {
    const l10nId = sc.getL10NID?.();
    if (!l10nId) return Promise.resolve(null);
    try {
      _zenPrefsL10n ??= new Localization(['browser/preferences/zen-preferences.ftl']);
      return _zenPrefsL10n.formatValue(l10nId).catch(() => null);
    } catch (e) {
      return Promise.resolve(null);
    }
  }

  function zenShortcutFallbackName(sc) {
    const id = String(sc.getID?.() || sc.getAction?.() || 'shortcut');
    return id.replace(/^(id:)?(key_|zen-)/, '').replace(/-shortcut$/, '')
      .replace(/[-_]/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();
  }

  // Enabled Zen/Firefox shortcuts (Zen's shortcut registry) that use `combo`.
  function zenShortcutsUsing(combo) {
    const list = window.gZenKeyboardShortcutsManager?._currentShortcutList;
    if (!Array.isArray(list) || !combo?.key) return [];
    const want = String(combo.key).toLowerCase();
    const out = [];
    for (const sc of list) {
      try {
        if (sc.isDisabled?.()) continue;
        let k = sc.getKeyNameOrCode?.();
        if (!k) continue;
        k = VK_KEY_NAMES[k] ?? (/^VK_/.test(k) ? k.slice(3) : k);
        k = String(k).toLowerCase();
        if (k === 'space') k = ' ';
        if (k !== want) continue;
        const m = sc.getModifiers();
        const ctrl = IS_MACOS ? !!m.control : !!(m.control || m.accel);
        const meta = IS_MACOS ? !!(m.meta || m.accel) : !!m.meta;
        if (ctrl === !!combo.ctrl && meta === !!combo.meta && !!m.alt === !!combo.alt && !!m.shift === !!combo.shift) {
          out.push(sc);
        }
      } catch (e) { /* malformed entry */ }
    }
    return out;
  }

  // Human-readable list of what else uses the binding of `settingId`.
  // Zen shortcut names are localized asynchronously via `onLabels`.
  function findKeyConflicts(settingId, value = S[settingId], onLabels = null) {
    const schema = SETTINGS_SCHEMA[settingId];
    if (!schema) return [];
    const names = [];
    if (schema.type === 'combo') {
      for (const [id, other] of Object.entries(SETTINGS_SCHEMA)) {
        if (id !== settingId && other.type === 'combo' && sameCombo(value, S[id])) names.push(`ZenLeap: ${other.label}`);
      }
      // Undo Folder Delete shadows Cmd+Shift+T on purpose and falls through to it
      const zen = settingId === 'keys.global.undoFolderDelete' ? [] : zenShortcutsUsing(value);
      const zenNames = zen.map(zenShortcutFallbackName);
      names.push(...zenNames.map(n => `Zen: ${n}`));
      if (zen.length && onLabels) {
        Promise.all(zen.map(zenShortcutLabel)).then(labels => {
          if (labels.every(l => !l)) return;
          const resolved = labels.map((l, i) => `Zen: ${l || zenNames[i]}`);
          onLabels([...names.filter(n => !n.startsWith('Zen: ')), ...resolved]);
        });
      }
    } else if (schema.type === 'key') {
      const peers = new Set(Object.keys(SETTINGS_SCHEMA).filter(id => SETTINGS_SCHEMA[id].group === schema.group));
      for (const id of KEY_GROUP_EXTRAS[schema.group] || []) peers.add(id);
      for (const [group, extras] of Object.entries(KEY_GROUP_EXTRAS)) {
        if (extras.includes(settingId)) {
          for (const id of Object.keys(SETTINGS_SCHEMA)) if (SETTINGS_SCHEMA[id].group === group) peers.add(id);
        }
      }
      for (const id of peers) {
        if (id !== settingId && SETTINGS_SCHEMA[id]?.type === 'key' && sameSingleKey(settingId, value, id, S[id])) {
          names.push(`ZenLeap: ${SETTINGS_SCHEMA[id].label}`);
        }
      }
    }
    return names;
  }

  // Startup check: one console warning per global trigger that collides with
  // an enabled Zen/Firefox shortcut (ZenLeap handles it first).
  function warnShortcutConflicts() {
    for (const id of GLOBAL_COMBO_IDS) {
      if (id === 'keys.global.undoFolderDelete') continue;
      const zen = zenShortcutsUsing(S[id]);
      if (!zen.length) continue;
      console.warn(`[ZenLeap] ${SETTINGS_SCHEMA[id].label} (${formatKeyDisplay(S[id], SETTINGS_SCHEMA[id])}) is also bound in Zen (${zen.map(sc => sc.getID?.() || zenShortcutFallbackName(sc)).join(', ')}). ZenLeap handles it first; rebind one of them in ZenLeap Settings or Zen's keyboard shortcuts.`);
    }
  }

  // Show (or clear) a warning line under a settings row.
  function setSettingsRowNote(row, text, kind = 'warning') {
    if (!row) return;
    let note = row.querySelector('.zenleap-settings-note');
    if (!text) { note?.remove(); return; }
    if (!note) {
      note = document.createElement('span');
      note.className = 'zenleap-settings-note';
      row.querySelector('.zenleap-settings-label')?.appendChild(note);
    }
    note.dataset.kind = kind;
    note.textContent = `⚠ ${text}`;
  }

  function showKeyConflictNote(row, settingId) {
    const render = (names) => setSettingsRowNote(row, names.length ? `Also used by ${names.join(', ')}` : '');
    render(findKeyConflicts(settingId, S[settingId], render));
  }

  // Key recording for rebinding
  function startKeyRecording(settingId, buttonElement) {
    stopKeyRecording();
    settingsRecordingId = settingId;
    const schema = SETTINGS_SCHEMA[settingId];
    const row = buttonElement.closest('.zenleap-settings-row');

    buttonElement.textContent = 'Press key…';
    buttonElement.classList.add('recording');

    settingsRecordingHandler = (event) => {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      if (event.key === 'Escape') {
        stopKeyRecording();
        renderSettingsContent();
        return;
      }

      // Ignore bare modifier keys and IME composition
      if (NON_ACTION_KEYS.has(event.key) || event.isComposing) return;

      let value;
      if (schema.type === 'combo') {
        // Global triggers run before any focus check: a plain key would fire
        // while typing in every web page.
        const isFKey = /^F\d{1,2}$/.test(event.key);
        if (!event.ctrlKey && !event.altKey && !event.metaKey && !isFKey) {
          setSettingsRowNote(row, 'Global shortcuts need Ctrl, Alt or Cmd (or an F-key). Press another combination or Esc.', 'error');
          return;
        }
        // AltGr (Ctrl+Alt on Windows) types characters; matchCombo ignores it.
        if (!IS_MACOS && event.getModifierState?.('AltGraph')) {
          setSettingsRowNote(row, 'AltGr types characters and can’t be part of a shortcut. Press another combination or Esc.', 'error');
          return;
        }
        value = {
          // Layout-independent (Latin letter on a Cyrillic layout), like single keys
          key: navKey(event),
          code: event.code,
          ctrl: event.ctrlKey,
          shift: event.shiftKey,
          alt: event.altKey,
          meta: event.metaKey,
        };
      } else {
        if (event.ctrlKey || event.altKey || event.metaKey) {
          setSettingsRowNote(row, 'Mode keys are single keys without Ctrl/Alt/Cmd. Press another key or Esc.', 'error');
          return;
        }
        // Store the key keyMatches() compares: on a Cyrillic/Greek layout the
        // letter keys record as their Latin letters, so the binding works on
        // every layout (the raw character matched nothing: REV-LCORE-01).
        const key = navKey(event);
        if (OPAQUE_KEY_NAMES.has(key)) {
          // A dead (accent) key reports only 'Dead': it would match every dead key
          setSettingsRowNote(row, 'This key types an accent and can’t be told apart from others. Press another key or Esc.', 'error');
          return;
        }
        value = schema.caseSensitive ? key : key.toLowerCase();
      }

      S[settingId] = value;
      saveSettings();
      stopKeyRecording();
      renderSettingsContent();
      // renderSettingsContent shows conflicts for every key row, this one included
    };

    window.addEventListener('keydown', settingsRecordingHandler, true);
  }

  function stopKeyRecording() {
    if (settingsRecordingHandler) {
      window.removeEventListener('keydown', settingsRecordingHandler, true);
      settingsRecordingHandler = null;
    }
    settingsRecordingId = null;
  }

  function enterSettingsMode() {
    if (settingsMode) return;
    if (helpMode) exitHelpMode();
    if (leapMode) exitLeapMode(false);
    if (searchMode) exitSearchMode();
    if (reorgMode) exitReorgMode(false);

    createSettingsModal();
    settingsMode = true;
    _overlayFocus = captureFocusTarget();
    settingsModal.classList.add('active');
    // Settings stays open when the window loses focus (color pickers, editing
    // the themes file in another app) but closes on click-away / URL bar focus.
    armModeGuards('settings', (reason) => exitSettingsMode({ restoreFocus: reason !== 'focus' }), {
      inside: '#zenleap-settings-container, #zenleap-import-overlay, .zenleap-settings-toast',
      exitOnDeactivate: false,
    });

    setTimeout(() => {
      const input = document.getElementById('zenleap-settings-search-input');
      if (input) input.focus();
    }, 50);

    log('Entered settings mode');
  }

  function exitSettingsMode({ restoreFocus = true } = {}) {
    if (!settingsMode) return;
    disarmModeGuards('settings');
    dismissImportConfirmation();
    stopKeyRecording();
    if (themeEditorActive) {
      themeEditorActive = false;
      applyTheme();
    }
    // Reset search state so reopening starts fresh
    settingsSearchQuery = '';
    const searchInput = document.getElementById('zenleap-settings-search-input');
    if (searchInput) searchInput.value = '';
    const tabsEl = document.getElementById('zenleap-settings-tabs');
    if (tabsEl) tabsEl.classList.remove('searching');

    settingsMode = false;
    settingsModal.classList.remove('active');
    aboutUpdateState = null;
    aboutRemoteVersion = null;
    restoreOverlayFocus(restoreFocus);
    log('Exited settings mode');
  }

  // ── About Page ─────────────────────────────────────────────────

  let _aboutCheckInFlight = false;

  async function checkAboutUpdate() {
    if (_aboutCheckInFlight) return;
    _aboutCheckInFlight = true;
    aboutUpdateState = 'checking';
    aboutRemoteVersion = null;
    renderAboutVersionStatus();

    const result = await checkForZenLeapUpdate();
    _aboutCheckInFlight = false;
    if (!settingsMode || settingsActiveTab !== 'About') return;

    if (!result) {
      aboutUpdateState = 'error';
    } else if (result.available) {
      aboutUpdateState = 'available';
      aboutRemoteVersion = result.remoteVersion;
    } else {
      aboutUpdateState = 'uptodate';
    }
    renderAboutVersionStatus();
  }

  function renderAboutVersionStatus() {
    const badge = document.getElementById('zenleap-about-update-badge');
    const hint = document.getElementById('zenleap-about-update-hint');
    if (!badge) return;

    badge.className = 'zenleap-about-update-badge';

    if (aboutUpdateState === 'checking') {
      badge.textContent = 'checking\u2026';
      badge.classList.add('checking');
      if (hint) hint.style.display = 'none';
    } else if (aboutUpdateState === 'available') {
      badge.textContent = `v${aboutRemoteVersion} available`;
      badge.classList.add('available');
      if (hint) hint.style.display = '';
    } else if (aboutUpdateState === 'uptodate') {
      badge.textContent = 'up to date';
      badge.classList.add('uptodate');
      if (hint) hint.style.display = 'none';
    } else if (aboutUpdateState === 'error') {
      badge.textContent = 'check failed';
      badge.classList.add('error');
      if (hint) hint.style.display = 'none';
    }
  }

  function renderAboutContent() {
    const wrap = document.createElement('div');
    wrap.className = 'zenleap-about';

    // ── Logo / Title ──
    const hero = document.createElement('div');
    hero.className = 'zenleap-about-hero';

    const title = document.createElement('h2');
    title.className = 'zenleap-about-title';
    title.textContent = 'ZenLeap';
    hero.appendChild(title);

    const tagline = document.createElement('p');
    tagline.className = 'zenleap-about-tagline';
    tagline.textContent = 'Navigate at the speed of thought.';
    hero.appendChild(tagline);

    const desc = document.createElement('p');
    desc.className = 'zenleap-about-desc';
    desc.textContent = 'Vim-style keyboard navigation for your browser. Less reaching, more doing.';
    hero.appendChild(desc);

    wrap.appendChild(hero);

    // ── Version card ──
    const versionCard = document.createElement('div');
    versionCard.className = 'zenleap-about-card';

    const versionRow = document.createElement('div');
    versionRow.className = 'zenleap-about-version-row';

    const versionLabel = document.createElement('span');
    versionLabel.className = 'zenleap-about-version-label';
    versionLabel.textContent = 'Version';

    const versionRight = document.createElement('div');
    versionRight.className = 'zenleap-about-version-right';

    const versionNum = document.createElement('span');
    versionNum.className = 'zenleap-about-version-num';
    versionNum.textContent = `v${VERSION}`;

    const updateBadge = document.createElement('span');
    updateBadge.id = 'zenleap-about-update-badge';
    updateBadge.className = 'zenleap-about-update-badge';

    versionRight.appendChild(versionNum);
    versionRight.appendChild(updateBadge);
    versionRow.appendChild(versionLabel);
    versionRow.appendChild(versionRight);
    versionCard.appendChild(versionRow);

    // Update hint (shown only when update available)
    const updateHint = document.createElement('div');
    updateHint.id = 'zenleap-about-update-hint';
    updateHint.className = 'zenleap-about-update-hint';
    updateHint.style.display = 'none';

    if (isSineManaged) {
      const hintText = document.createTextNode('Update via Sine');
      updateHint.appendChild(hintText);
    } else {
      const hintKbd = document.createElement('kbd');
      hintKbd.textContent = '\u21B5';
      const hintText = document.createTextNode(' to update');
      updateHint.appendChild(hintKbd);
      updateHint.appendChild(hintText);
    }
    versionCard.appendChild(updateHint);

    wrap.appendChild(versionCard);

    // ── Links card ──
    const linksCard = document.createElement('div');
    linksCard.className = 'zenleap-about-card';

    const githubRow = document.createElement('div');
    githubRow.className = 'zenleap-about-link-row';

    const ghIcon = document.createElement('span');
    ghIcon.className = 'zenleap-about-link-icon';
    ghIcon.innerHTML = `<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>`;

    const ghLabel = document.createElement('span');
    ghLabel.className = 'zenleap-about-link-label';
    ghLabel.textContent = 'GitHub';

    const ghUrl = document.createElement('span');
    ghUrl.className = 'zenleap-about-link-url';
    ghUrl.textContent = 'yashas-salankimatt/ZenLeap';

    githubRow.appendChild(ghIcon);
    githubRow.appendChild(ghLabel);
    githubRow.appendChild(ghUrl);

    githubRow.addEventListener('click', () => {
      // A web page: open it like a web link (null principal), not as system
      openWebLinkIn('https://github.com/yashas-salankimatt/ZenLeap', 'tab');
      exitSettingsMode();
    });

    linksCard.appendChild(githubRow);
    wrap.appendChild(linksCard);

    // ── Footer ──
    const footer = document.createElement('div');
    footer.className = 'zenleap-about-footer';
    footer.textContent = 'Made for those who\u2019d rather not touch the mouse.';
    wrap.appendChild(footer);

    // Set initial badge state
    setTimeout(() => renderAboutVersionStatus(), 0);

    return wrap;
  }

  // ── Theme Editor ──────────────────────────────────────────────

  function getUserThemeKeys() {
    return Object.keys(themes).filter(k => !BUILTIN_THEMES[k]);
  }

  function renderThemeEditorSection() {
    const section = document.createElement('div');
    section.className = 'zenleap-theme-editor-section';

    const header = document.createElement('div');
    header.className = 'zenleap-theme-editor-header';
    const title = document.createElement('h3');
    title.textContent = 'Custom Themes';
    header.appendChild(title);

    const createBtn = document.createElement('button');
    createBtn.className = 'zenleap-theme-editor-create-btn';
    createBtn.textContent = '+ New Theme';
    createBtn.addEventListener('click', () => {
      themeEditorActive = true;
      themeEditorKey = null;
      themeEditorDraft = {};
      themeEditorName = '';
      themeEditorBase = 'meridian';
      themeEditorExpandedGroups.clear();
      renderSettingsContent();
    });
    header.appendChild(createBtn);
    section.appendChild(header);

    const userKeys = getUserThemeKeys();
    if (userKeys.length > 0) {
      const list = document.createElement('div');
      list.className = 'zenleap-theme-cards';
      for (const key of userKeys) list.appendChild(createThemeCard(key));
      section.appendChild(list);
    } else if (!themeEditorActive) {
      const empty = document.createElement('div');
      empty.className = 'zenleap-theme-editor-empty';
      empty.textContent = 'No custom themes yet. Create one to get started.';
      section.appendChild(empty);
    }

    if (themeEditorActive) section.appendChild(renderThemeEditorPanel());
    return section;
  }

  function createThemeCard(key) {
    const theme = resolveTheme(key);
    const card = document.createElement('div');
    card.className = 'zenleap-theme-card';
    if (S['appearance.theme'] === key) card.classList.add('active-theme');

    const swatches = document.createElement('div');
    swatches.className = 'zenleap-theme-swatches';
    for (const color of [theme.accent, theme.bgBase, theme.bgSurface, theme.textPrimary, theme.highlight || theme.accent]) {
      const s = document.createElement('span');
      s.className = 'zenleap-theme-swatch';
      s.style.background = color;
      swatches.appendChild(s);
    }

    const info = document.createElement('div');
    info.className = 'zenleap-theme-card-info';
    const nameSpan = document.createElement('span');
    nameSpan.className = 'zenleap-theme-card-name';
    nameSpan.textContent = theme.name || key;
    info.appendChild(nameSpan);

    const actions = document.createElement('div');
    actions.className = 'zenleap-theme-card-actions';

    const editBtn = document.createElement('button');
    editBtn.className = 'zenleap-theme-card-btn';
    editBtn.textContent = 'Edit';
    editBtn.addEventListener('click', () => openThemeForEditing(key));
    actions.appendChild(editBtn);

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'zenleap-theme-card-btn delete';
    deleteBtn.dataset.key = key;
    deleteBtn.textContent = 'Delete';
    deleteBtn.addEventListener('click', () => deleteUserTheme(key));
    actions.appendChild(deleteBtn);

    card.appendChild(swatches);
    card.appendChild(info);
    card.appendChild(actions);
    return card;
  }

  async function openThemeForEditing(key) {
    const themesPath = PathUtils.join(PathUtils.profileDir, 'chrome', 'zenleap-themes.json');
    const rawThemes = await readThemesFileForEdit(themesPath);
    if (!rawThemes) return;
    try {
      const rawDef = rawThemes[key];
      if (!_isPlainObject(rawDef)) return;

      themeEditorActive = true;
      themeEditorKey = key;
      themeEditorName = rawDef.name || key;
      themeEditorBase = rawDef.extends || 'meridian';
      themeEditorExpandedGroups.clear();

      const { name: _n, extends: _e, ...overrides } = rawDef;
      themeEditorDraft = { ...overrides };

      applyThemeEditorPreview();
      renderSettingsContent();
    } catch (e) {
      reportError('Opening the theme for editing failed', e);
    }
  }

  function renderThemeEditorPanel() {
    const panel = document.createElement('div');
    panel.className = 'zenleap-theme-editor-panel';

    // Header
    const panelHeader = document.createElement('div');
    panelHeader.className = 'zenleap-theme-editor-panel-header';
    const panelTitle = document.createElement('span');
    panelTitle.textContent = themeEditorKey ? `Editing: ${themeEditorName}` : 'New Theme';
    panelHeader.appendChild(panelTitle);
    const closeBtn = document.createElement('button');
    closeBtn.className = 'zenleap-settings-close-btn';
    closeBtn.textContent = '\u2715';
    closeBtn.addEventListener('click', () => {
      themeEditorActive = false;
      applyTheme();
      renderSettingsContent();
    });
    panelHeader.appendChild(closeBtn);
    panel.appendChild(panelHeader);

    // Name input
    const nameRow = document.createElement('div');
    nameRow.className = 'zenleap-theme-editor-row';
    const nameLabel = document.createElement('label');
    nameLabel.textContent = 'Name';
    nameLabel.className = 'zenleap-theme-editor-label';
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.value = themeEditorName;
    nameInput.placeholder = 'My Custom Theme';
    nameInput.className = 'zenleap-theme-editor-input zenleap-theme-editor-name';
    nameInput.addEventListener('input', () => { themeEditorName = nameInput.value; });
    nameRow.appendChild(nameLabel);
    nameRow.appendChild(nameInput);
    panel.appendChild(nameRow);

    // Base theme selector
    const baseRow = document.createElement('div');
    baseRow.className = 'zenleap-theme-editor-row';
    const baseLabel = document.createElement('label');
    baseLabel.textContent = 'Base Theme';
    baseLabel.className = 'zenleap-theme-editor-label';
    const baseSelect = document.createElement('select');
    baseSelect.className = 'zenleap-select';
    for (const [key, t] of Object.entries(BUILTIN_THEMES)) {
      const opt = document.createElement('option');
      opt.value = key;
      opt.textContent = t.name;
      if (key === themeEditorBase) opt.selected = true;
      baseSelect.appendChild(opt);
    }
    baseSelect.addEventListener('change', () => {
      themeEditorBase = baseSelect.value;
      applyThemeEditorPreview();
      renderSettingsContent();
    });
    baseRow.appendChild(baseLabel);
    baseRow.appendChild(baseSelect);
    panel.appendChild(baseRow);

    // Preview strip
    panel.appendChild(renderThemePreviewStrip());

    // Property groups
    const groupOrder = ['Accent', 'Backgrounds', 'Text', 'Browse Mode',
                        'Semantic Colors', 'Borders', 'gTile Regions', 'Effects'];
    const grouped = new Map();
    for (const [prop, schema] of Object.entries(THEME_EDITOR_SCHEMA)) {
      const g = schema.group;
      if (!grouped.has(g)) grouped.set(g, []);
      grouped.get(g).push([prop, schema]);
    }

    for (const groupName of groupOrder) {
      const props = grouped.get(groupName);
      if (!props) continue;

      const commonProps = props.filter(([, s]) => s.common);
      const advancedProps = props.filter(([, s]) => !s.common);
      const isExpanded = themeEditorExpandedGroups.has(groupName);

      const groupDiv = document.createElement('div');
      groupDiv.className = 'zenleap-theme-editor-group';
      const groupHeader = document.createElement('div');
      groupHeader.className = 'zenleap-theme-editor-group-header';
      const groupTitle = document.createElement('span');
      groupTitle.textContent = groupName;
      groupHeader.appendChild(groupTitle);
      const groupInfo = THEME_GROUP_INFO[groupName];
      if (groupInfo?.browserDesc) {
        const browserBadge = document.createElement('span');
        browserBadge.className = 'zenleap-theme-group-browser-badge';
        browserBadge.textContent = 'Browser';
        browserBadge.title = groupInfo.browserDesc;
        groupHeader.appendChild(browserBadge);
      }
      groupDiv.appendChild(groupHeader);
      if (groupInfo?.desc) {
        const groupDesc = document.createElement('div');
        groupDesc.className = 'zenleap-theme-group-desc';
        groupDesc.textContent = groupInfo.desc;
        if (groupInfo.browserDesc) {
          const browserNote = document.createElement('span');
          browserNote.className = 'zenleap-theme-group-browser-note';
          browserNote.textContent = ` \u00B7 ${groupInfo.browserDesc} when "Apply to Browser" is on`;
          groupDesc.appendChild(browserNote);
        }
        groupDiv.appendChild(groupDesc);
      }

      for (const [prop, schema] of commonProps) {
        groupDiv.appendChild(createThemePropertyRow(prop, schema));
      }

      if (advancedProps.length > 0) {
        const toggleBtn = document.createElement('button');
        toggleBtn.className = 'zenleap-theme-editor-expand-btn';
        toggleBtn.textContent = isExpanded
          ? `\u25B4 Hide ${advancedProps.length} more`
          : `\u25BE Show ${advancedProps.length} more`;
        toggleBtn.addEventListener('click', () => {
          if (isExpanded) themeEditorExpandedGroups.delete(groupName);
          else themeEditorExpandedGroups.add(groupName);
          renderSettingsContent();
        });
        groupDiv.appendChild(toggleBtn);

        if (isExpanded) {
          for (const [prop, schema] of advancedProps) {
            groupDiv.appendChild(createThemePropertyRow(prop, schema));
          }
        }
      }
      panel.appendChild(groupDiv);
    }

    // Actions
    const actions = document.createElement('div');
    actions.className = 'zenleap-theme-editor-actions';
    const saveBtn = document.createElement('button');
    saveBtn.className = 'zenleap-theme-editor-save-btn';
    saveBtn.textContent = themeEditorKey ? 'Save Changes' : 'Create Theme';
    saveBtn.addEventListener('click', () => saveThemeFromEditor());
    actions.appendChild(saveBtn);
    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'zenleap-theme-editor-cancel-btn';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.addEventListener('click', () => {
      themeEditorActive = false;
      applyTheme();
      renderSettingsContent();
    });
    actions.appendChild(cancelBtn);
    panel.appendChild(actions);

    return panel;
  }

  function createThemePropertyRow(prop, schema) {
    const base = BUILTIN_THEMES[themeEditorBase] || BUILTIN_THEMES.meridian;
    const baseValue = base[prop] || '';
    const hasOverride = prop in themeEditorDraft;
    const currentValue = hasOverride ? themeEditorDraft[prop] : baseValue;

    const row = document.createElement('div');
    row.className = 'zenleap-theme-prop-row';
    if (hasOverride) row.classList.add('overridden');

    const labelWrap = document.createElement('div');
    labelWrap.className = 'zenleap-theme-prop-label';
    const labelTop = document.createElement('div');
    labelTop.className = 'zenleap-theme-prop-label-top';
    const label = document.createElement('span');
    label.textContent = schema.label;
    labelTop.appendChild(label);
    if (schema.browser) {
      const badge = document.createElement('span');
      badge.className = 'zenleap-theme-prop-browser-badge';
      badge.textContent = 'B';
      badge.title = 'Also applies to Zen Browser chrome';
      labelTop.appendChild(badge);
    }
    labelWrap.appendChild(labelTop);
    if (schema.hint) {
      const hint = document.createElement('span');
      hint.className = 'zenleap-theme-prop-hint';
      hint.textContent = schema.hint;
      labelWrap.appendChild(hint);
    }

    const inherited = document.createElement('span');
    inherited.className = 'zenleap-theme-prop-inherited';
    if (schema.type === 'color' && baseValue.startsWith('#')) {
      const dot = document.createElement('span');
      dot.className = 'zenleap-theme-prop-dot';
      dot.style.background = baseValue;
      inherited.appendChild(dot);
    }
    const inheritedText = document.createElement('span');
    inheritedText.textContent = hasOverride ? `base: ${baseValue}` : '(inherited)';
    inherited.appendChild(inheritedText);

    const control = document.createElement('div');
    control.className = 'zenleap-theme-prop-control';

    if (schema.type === 'color') {
      const colorInput = document.createElement('input');
      colorInput.type = 'color';
      colorInput.className = 'zenleap-color-picker';
      colorInput.value = toHex6(currentValue);
      const hexInput = document.createElement('input');
      hexInput.type = 'text';
      hexInput.className = 'zenleap-color-hex';
      hexInput.value = hasOverride ? themeEditorDraft[prop] : '';
      hexInput.placeholder = baseValue;
      colorInput.addEventListener('input', () => {
        themeEditorDraft[prop] = colorInput.value;
        hexInput.value = colorInput.value;
        row.classList.add('overridden');
        clearBtn.style.visibility = 'visible';
        applyThemeEditorPreview();
      });
      hexInput.addEventListener('change', () => {
        const val = hexInput.value.trim();
        if (/^#[0-9a-fA-F]{6}$/i.test(val)) {
          themeEditorDraft[prop] = val;
          colorInput.value = val;
          row.classList.add('overridden');
          clearBtn.style.visibility = 'visible';
          applyThemeEditorPreview();
        } else if (val === '') {
          delete themeEditorDraft[prop];
          colorInput.value = toHex6(baseValue);
          row.classList.remove('overridden');
          clearBtn.style.visibility = 'hidden';
          applyThemeEditorPreview();
        }
      });
      control.appendChild(colorInput);
      control.appendChild(hexInput);
    } else {
      const textInput = document.createElement('input');
      textInput.type = 'text';
      textInput.className = 'zenleap-color-hex';
      if (schema.type === 'rgba') textInput.style.width = '160px';
      textInput.value = hasOverride ? themeEditorDraft[prop] : '';
      textInput.placeholder = baseValue;
      textInput.addEventListener('change', () => {
        const val = textInput.value.trim();
        if (val === '') {
          delete themeEditorDraft[prop];
          row.classList.remove('overridden');
          clearBtn.style.visibility = 'hidden';
        } else {
          themeEditorDraft[prop] = val;
          row.classList.add('overridden');
          clearBtn.style.visibility = 'visible';
        }
        applyThemeEditorPreview();
      });
      control.appendChild(textInput);
    }

    const clearBtn = document.createElement('button');
    clearBtn.className = 'zenleap-theme-prop-clear';
    clearBtn.textContent = '\u21BA';
    clearBtn.title = 'Revert to base theme value';
    clearBtn.style.visibility = hasOverride ? 'visible' : 'hidden';
    clearBtn.addEventListener('click', () => {
      delete themeEditorDraft[prop];
      applyThemeEditorPreview();
      renderSettingsContent();
    });

    row.appendChild(labelWrap);
    row.appendChild(inherited);
    row.appendChild(control);
    row.appendChild(clearBtn);
    return row;
  }

  function renderThemePreviewStrip() {
    const base = BUILTIN_THEMES[themeEditorBase] || BUILTIN_THEMES.meridian;
    const merged = { ...base, ...themeEditorDraft };

    const strip = document.createElement('div');
    strip.className = 'zenleap-theme-preview-strip';
    const previewLabel = document.createElement('span');
    previewLabel.className = 'zenleap-theme-preview-label';
    previewLabel.textContent = 'Preview';
    strip.appendChild(previewLabel);

    const swatchRow = document.createElement('div');
    swatchRow.className = 'zenleap-theme-preview-swatches';
    for (const key of ['bgBase', 'bgSurface', 'bgRaised', 'accent', 'accentBright',
                        'textPrimary', 'textSecondary', 'highlight', 'selected', 'mark']) {
      const swatch = document.createElement('div');
      swatch.className = 'zenleap-theme-preview-swatch';
      swatch.style.background = merged[key];
      swatch.title = `${key}: ${merged[key]}`;
      swatchRow.appendChild(swatch);
    }
    strip.appendChild(swatchRow);
    return strip;
  }

  // Live preview of the theme being edited, at most once per frame (color
  // inputs fire on every drag step; LEAP-B-34).
  let _themeEditorPreviewRaf = 0;
  function applyThemeEditorPreview() {
    if (!themeEditorActive || _themeEditorPreviewRaf) return;
    _themeEditorPreviewRaf = requestAnimationFrame(() => {
      _themeEditorPreviewRaf = 0;
      if (!themeEditorActive) return;
      const base = BUILTIN_THEMES[themeEditorBase] || BUILTIN_THEMES.meridian;
      const previewKey = '__zenleap_preview__';
      themes[previewKey] = { ...base, name: themeEditorName, ...themeEditorDraft };
      try { applyTheme(previewKey); } finally { delete themes[previewKey]; }
    });
  }

  async function saveThemeFromEditor() {
    if (!themeEditorName.trim()) {
      const nameInput = settingsModal?.querySelector('.zenleap-theme-editor-name');
      if (nameInput) { nameInput.style.borderColor = 'var(--zl-error)'; nameInput.placeholder = 'Name required'; setTimeout(() => { nameInput.style.borderColor = ''; nameInput.placeholder = 'Theme name'; }, 2000); }
      return;
    }

    const themesPath = PathUtils.join(PathUtils.profileDir, 'chrome', 'zenleap-themes.json');
    const rawThemes = await readThemesFileForEdit(themesPath);
    if (!rawThemes) return;

    const key = themeEditorKey || generateThemeKey(themeEditorName, rawThemes);

    if (themeEditorKey && themeEditorKey !== key) {
      delete rawThemes[themeEditorKey];
    }

    const def = { name: themeEditorName.trim(), extends: themeEditorBase };
    for (const [prop, value] of Object.entries(themeEditorDraft)) {
      def[prop] = value;
    }
    rawThemes[key] = def;

    try {
      await writeThemesFile(themesPath, rawThemes);
      log(`Saved theme "${themeEditorName}" to zenleap-themes.json`);
    } catch (e) {
      reportError('Saving the theme failed', e);
      showSettingsToast('error', 'Saving the theme failed \u2014 see the Browser Console');
      return;
    }

    await loadUserThemes();
    S['appearance.theme'] = key;
    saveSettings();
    applyTheme();

    themeEditorActive = false;
    renderSettingsContent();
  }

  async function deleteUserTheme(key) {
    const themeName = themes[key]?.name || key;
    // Show inline confirmation on the delete button
    const btn = settingsModal?.querySelector(`.zenleap-theme-card-btn.delete[data-key="${CSS.escape(key)}"]`);
    if (btn && !btn.dataset.confirming) {
      btn.dataset.confirming = 'true';
      btn.textContent = 'Confirm?';
      btn.style.color = 'var(--zl-error)';
      btn.style.borderColor = 'var(--zl-error)';
      setTimeout(() => { if (btn.dataset.confirming) { delete btn.dataset.confirming; btn.textContent = 'Delete'; btn.style.color = ''; btn.style.borderColor = ''; } }, 3000);
      return;
    }

    const themesPath = PathUtils.join(PathUtils.profileDir, 'chrome', 'zenleap-themes.json');
    const rawThemes = await readThemesFileForEdit(themesPath);
    if (!rawThemes) return;
    try {
      delete rawThemes[key];
      await writeThemesFile(themesPath, rawThemes);
      log(`Deleted theme "${themeName}"`);
    } catch (e) {
      reportError('Deleting the theme failed', e);
      showSettingsToast('error', 'Deleting the theme failed \u2014 see the Browser Console');
      return;
    }

    if (S['appearance.theme'] === key) {
      S['appearance.theme'] = 'meridian';
      saveSettings();
    }

    await loadUserThemes();
    applyTheme();

    if (themeEditorActive && themeEditorKey === key) {
      themeEditorActive = false;
    }
    renderSettingsContent();
  }

  // Enter command bar from browse mode with context
  function enterBrowseCommandMode() {
    const items = getVisibleItems();

    // Collect tabs: selected tabs (sorted by position), or just the highlighted tab
    let collectedTabs;
    if (selectedItems.size > 0) {
      collectedTabs = sortTabsBySidebarPosition(liveTabs([...selectedItems].filter(t => !isFolder(t))));
    } else if (!highlightStillThere(items)) {
      return;
    } else if (highlightedItem) {
      // Only operate on tabs, not folders
      if (isFolder(highlightedItem)) {
        log('Cannot enter browse command mode on a folder');
        return;
      }
      collectedTabs = [highlightedItem];
    } else {
      collectedTabs = [];
    }

    if (collectedTabs.length === 0) {
      log('No tabs to operate on from browse mode');
      return;
    }

    // Save browse state for restoration on cancel
    savedBrowseState = saveBrowseState();
    browseCommandMode = true;
    browseCommandTabs = collectedTabs;

    // Clear any pending browse timeouts so they don't fire during command bar
    browseGPending = false;
    clearTimeout(browseGTimeout);
    browseGTimeout = null;
    browseNumberBuffer = '';
    clearTimeout(browseNumberTimeout);
    browseNumberTimeout = null;

    // Hide browse UI without fully tearing down leap mode
    clearHighlight();
    hideLeapOverlay();
    hidePreviewPanel(true);

    // Reset mode flags so enterSearchMode doesn't try to exit leap mode again
    leapMode = false;
    browseMode = false;
    disarmModeGuards('leap');

    // Open the full command bar (browse commands injected via getDynamicCommands)
    enterSearchMode(true);
    log(`Browse command mode with ${browseCommandTabs.length} tab(s)`);
  }

  // Return to browse mode from command bar (on cancel/Esc)
  function returnToBrowseMode() {
    if (!savedBrowseState) {
      exitSearchMode();
      return;
    }

    // Close search modal
    searchMode = false;
    disarmModeGuards('search');
    _overlayFocus = null;
    if (searchModal) searchModal.classList.remove('active');

    // Reset vim mode for next search open
    searchVimMode = 'insert';

    // Reset command state
    commandMode = false;
    commandQuery = '';
    commandSubFlow = null;
    commandSubFlowStack = [];
    commandMatchedTabs = [];
    dedupTabsToClose = [];
    commandResults = [];
    commandEnteredFromSearch = false;
    invalidateCommandCache();
    if (searchInput) searchInput.readOnly = false;
    hidePreviewPanel(true);

    // Restore search icon and placeholder
    const icon = document.getElementById('zenleap-search-icon');
    if (icon) {
      icon.textContent = '🔍';
      icon.classList.remove('zenleap-command-prefix');
    }
    if (searchBreadcrumb) searchBreadcrumb.style.display = 'none';

    // Ensure input is reset for next open
    if (searchInput) {
      searchInput.style.display = '';
      searchInput.placeholder = 'Search tabs...';
      searchInput.blur();
    }
    if (searchInputDisplay) {
      searchInputDisplay.style.display = 'none';
    }

    // Restore browse state
    restoreBrowseState(savedBrowseState);

    // Refresh relative numbers (needed for 'active' mode since they may have been
    // stripped while leapMode/browseMode were false during command bar)
    if (S['display.showRelativeNumbers'] === 'active') updateRelativeNumbers();

    // Clean up browse command state
    browseCommandMode = false;
    browseCommandTabs = [];
    savedBrowseState = null;

    // Re-show browse mode UI
    document.documentElement.setAttribute('data-zenleap-active', 'true');
    stealFocusFromContent();
    showLeapOverlay();
    armLeapGuards();
    updateHighlight();
    updateLeapOverlayState();
    log('Returned to browse mode from command bar');
  }

  // Enter search mode
  function enterSearchMode(asCommand = false) {
    if (searchMode) return;

    // Exit other modes if active
    if (leapMode) exitLeapMode(false);
    if (reorgMode) exitReorgMode(false);
    if (helpMode) exitHelpMode();
    if (gtileMode) exitGtileMode(false);

    createSearchModal();
    if (!browseCommandMode) _overlayFocus = captureFocusTarget();
    armModeGuards('search', (reason) => exitSearchMode({ restoreFocus: reason !== 'focus' }), {
      inside: '#zenleap-search-container, #zenleap-preview-panel',
    });

    // Reset all search state
    searchMode = true;
    searchQuery = '';
    searchSelectedIndex = 0;
    searchVimMode = 'insert';
    searchCursorPos = 0;
    cancelPendingJJ();

    // Reset command state
    commandMode = false;
    commandQuery = '';
    commandSubFlow = null;
    commandSubFlowStack = [];
    commandMatchedTabs = [];
    commandResults = [];
    commandEnteredFromSearch = false;
    invalidateCommandCache();

    // Reset input value
    searchInput.value = '';

    // Show modal
    searchModal.classList.add('active');

    if (asCommand) {
      // Enter command mode directly (Ctrl+Shift+/) — escape exits entirely
      commandEnteredFromSearch = false;
      enterCommandMode();
    } else {
      // Render results (shows all tabs when query is empty)
      renderSearchResults();
    }

    // Use updateSearchVimIndicator to properly set up input/display visibility
    // This ensures input is shown and display is hidden for insert mode
    updateSearchVimIndicator();
    updateWsToggleVisibility();

    _pluginEventBus.emit('searchMode:enter', { asCommand });
    log(`Entered search mode${asCommand ? ' (command)' : ''}`);
  }

  // Exit search mode. restoreFocus=false when focus already moved elsewhere on
  // purpose (e.g. Ctrl+L put it into the URL bar).
  function exitSearchMode({ restoreFocus = true } = {}) {
    if (!searchMode) return;

    disarmModeGuards('search');
    searchMode = false;
    searchModal.classList.remove('active');
    cancelPendingJJ();
    clearTimeout(_searchInputDebounceTimer);

    // Reset vim mode to insert for next time
    searchVimMode = 'insert';

    // Leaving while a theme is previewed: back to the saved theme
    endThemePreview();

    // Reset command state
    commandMode = false;
    commandQuery = '';
    commandSubFlow = null;
    commandSubFlowStack = [];
    commandMatchedTabs = [];
    dedupTabsToClose = [];
    commandResults = [];
    commandEnteredFromSearch = false;
    invalidateCommandCache();
    if (searchInput) searchInput.readOnly = false;
    hidePreviewPanel(true);

    // Restore search icon and placeholder
    const icon = document.getElementById('zenleap-search-icon');
    if (icon) {
      icon.textContent = '🔍';
      icon.classList.remove('zenleap-command-prefix');
    }
    if (searchBreadcrumb) searchBreadcrumb.style.display = 'none';

    // Ensure input is visible and display is hidden for next open
    if (searchInput) {
      searchInput.style.display = '';
      searchInput.placeholder = 'Search tabs...';
      searchInput.blur();
    }
    if (searchInputDisplay) {
      searchInputDisplay.style.display = 'none';
    }

    // Clean up browse command state and restore focus/attributes from leap mode
    const wasBrowseCommand = browseCommandMode;
    if (browseCommandMode) {
      document.documentElement.removeAttribute('data-zenleap-active');
      restoreFocusToContent(restoreFocus);
      // Strip relative numbers if in 'active' mode (leap/browse modes are already false)
      if (S['display.showRelativeNumbers'] === 'active') updateRelativeNumbers();
      // Restore sidebar if we expanded it for compact mode
      if (sidebarWasExpanded) {
        setTimeout(() => {
          hideFloatingSidebar();
          log('Hid sidebar after browse command exit');
        }, 150);
      }
      sidebarWasExpanded = false;
    }
    browseCommandMode = false;
    browseCommandTabs = [];
    savedBrowseState = null;

    if (wasBrowseCommand) _overlayFocus = null;
    else restoreOverlayFocus(restoreFocus);
    _pluginEventBus.emit('searchMode:exit', {});
    log('Exited search mode');
  }

  // Select and open a search result. Guarded: a second Enter while the
  // workspace switch is awaited must not select again (LEAP-B-37).
  let _selectingSearchResult = false;
  async function selectSearchResult(index) {
    if (_selectingSearchResult) return;
    if (index < 0 || index >= searchResults.length) return;

    const result = searchResults[index];
    if (result && result.tab) {
      _selectingSearchResult = true;
      // Record jump before navigating; the workspace switch selects that
      // space's last tab first, which must not land in the jump list.
      recordJump(currentTab());
      recordingJumps = false;
      try {
        // Switch workspace if the tab belongs to a different workspace (async)
        if (result.workspaceName && window.gZenWorkspaces) {
          const tabWsId = result.tab.getAttribute('zen-workspace-id');
          if (tabWsId) {
            await gZenWorkspaces.changeWorkspaceWithID(tabWsId);
          }
        }
        if (result.tab.isConnected && !result.tab.closing) {
          gBrowser.selectedTab = result.tab;
          log(`Opened tab from search: ${result.tab.label}`);
        }
      } catch (e) {
        reportError('Opening search result failed', e);
      } finally {
        recordingJumps = true;
        _selectingSearchResult = false;
      }

      // Record destination
      recordJump(result.tab);
    }

    exitSearchMode();
  }

  // Show/hide WS toggle based on whether we're in a search-like context
  function updateWsToggleVisibility() {
    const wsBtn = document.getElementById('zenleap-search-ws-toggle');
    if (!wsBtn) return;
    // Show only in tab search (not command mode) or tab-search/split-tab-picker sub-flows
    const isTabSearchSubFlow = commandSubFlow && (commandSubFlow.type === 'tab-search' || commandSubFlow.type === 'split-tab-picker' || commandSubFlow.type === 'dedup-preview' || commandSubFlow.type === 'playing-tabs');
    const shouldShow = !commandMode || isTabSearchSubFlow;
    wsBtn.style.display = shouldShow ? '' : 'none';
  }

  // Toggle cross-workspace search and refresh results
  function toggleCrossWorkspaceSearch() {
    S['display.searchAllWorkspaces'] = !S['display.searchAllWorkspaces'];
    saveSettings();
    // Update the WS toggle button if it exists
    const wsBtn = document.getElementById('zenleap-search-ws-toggle');
    if (wsBtn) {
      wsBtn.textContent = S['display.searchAllWorkspaces'] ? 'All' : 'WS';
      wsBtn.classList.toggle('active', S['display.searchAllWorkspaces']);
    }
    // Re-render results with new scope
    if (commandMode) {
      renderCommandResults();
    } else {
      renderSearchResults();
    }
    log(`Cross-workspace search: ${S['display.searchAllWorkspaces'] ? 'ON' : 'OFF'}`);
  }

  // Close the selected search result tab
  function closeSelectedSearchResult() {
    if (searchSelectedIndex < 0 || searchSelectedIndex >= searchResults.length) return;

    const result = searchResults[searchSelectedIndex];
    if (!result || !result.tab) return;

    const tabToClose = result.tab;
    const tabLabel = tabToClose.label;

    // Close the tab, then re-run the search (it clamps the selection)
    gBrowser.removeTab(tabToClose, { animate: false });
    log(`Closed tab from search: ${tabLabel}`);
    renderSearchResults();
  }

  // Move search selection (lightweight — no DOM rebuild or re-search)
  function moveSearchSelection(direction) {
    const results = commandMode ? commandResults : searchResults;
    if (results.length === 0) return;

    const oldIndex = searchSelectedIndex;

    if (direction === 'down') {
      searchSelectedIndex = (searchSelectedIndex + 1) % results.length;
    } else {
      searchSelectedIndex = (searchSelectedIndex - 1 + results.length) % results.length;
    }

    updateSelectionHighlight(oldIndex, searchSelectedIndex);
  }

  // Lightweight highlight update — toggles .selected class without rebuilding DOM
  function updateSelectionHighlight(oldIndex, newIndex) {
    if (!searchResultsList) return;
    const resultClass = commandMode ? 'zenleap-command-result' : 'zenleap-search-result';
    const items = searchResultsList.querySelectorAll(`.${resultClass}`);

    // Remove old highlight
    if (oldIndex >= 0 && oldIndex < items.length) {
      items[oldIndex].classList.remove('selected');
    }

    // Add new highlight
    if (newIndex >= 0 && newIndex < items.length) {
      items[newIndex].classList.add('selected');
      items[newIndex].scrollIntoView({ block: 'nearest', behavior: 'auto' });
    }

    // Live-preview theme when navigating the theme-picker (the saved theme
    // setting only changes when a theme is picked)
    if (commandSubFlow?.type === 'theme-picker') {
      const results = commandMode ? commandResults : searchResults;
      const selectedResult = results[newIndex];
      if (selectedResult?.themeId && themes[selectedResult.themeId]) {
        _themePreviewing = true;
        applyTheme(selectedResult.themeId);
      }
    }

    // Update preview debounce
    const results = commandMode ? commandResults : searchResults;
    if (results.length > 0) {
      const selectedResult = results[newIndex];
      const hasTab = commandMode ? (commandSubFlow && selectedResult?.tab) : selectedResult?.tab;
      if (hasTab) {
        hidePreviewPanelVisual();
        previewDebounceTimer = setTimeout(() => {
          showPreviewForTab(selectedResult.tab, { force: true });
          positionPreviewPanelForModal();
        }, S['timing.previewDelay']);
      } else {
        hidePreviewPanelVisual();
      }
    }
  }

  // Hide preview panel visually without clearing the thumbnail cache
  function hidePreviewPanelVisual() {
    if (previewPanel) {
      previewPanel.style.display = 'none';
    }
    clearTimeout(previewDebounceTimer);
    previewCaptureId++;
    previewCurrentTab = null;
  }

  // Update search vim indicator and handle focus/display based on mode
  function updateSearchVimIndicator() {
    if (!searchVimIndicator) return;

    // When vim mode is disabled, hide indicator and always show input
    if (!S['display.vimModeInBars']) {
      searchVimIndicator.style.display = 'none';
      if (searchInputDisplay) searchInputDisplay.style.display = 'none';
      if (searchInput) {
        searchInput.style.display = '';
        searchInput.focus();
      }
      updateSearchHintBar();
      return;
    }
    searchVimIndicator.style.display = '';

    if (searchVimMode === 'insert') {
      searchVimIndicator.textContent = commandMode ? 'COMMAND I' : 'INSERT';
      searchVimIndicator.classList.remove('normal');

      // Show input, hide display
      if (searchInputDisplay) {
        searchInputDisplay.style.display = 'none';
      }
      if (searchInput) {
        searchInput.style.display = '';
        // Sync input value when returning to insert mode from normal mode
        if (commandMode) {
          searchInput.value = commandQuery;
        }

        // Focus with retry mechanism (max 30 attempts ~500ms)
        let focusRetries = 0;
        const focusInput = () => {
          if (searchInput && searchMode && searchVimMode === 'insert') {
            searchInput.focus();
            searchInput.setSelectionRange(searchCursorPos, searchCursorPos);
            if (document.activeElement !== searchInput) {
              focusRetries++;
              if (focusRetries < 30) {
                requestAnimationFrame(focusInput);
              } else {
                log('Search input focus failed after 30 attempts');
              }
            } else {
              log('Search input focused');
            }
          }
        };
        requestAnimationFrame(focusInput);
      }
    } else {
      searchVimIndicator.textContent = commandMode ? 'COMMAND N' : 'NORMAL';
      searchVimIndicator.classList.add('normal');

      // Hide input, show display with block cursor
      if (searchInput) {
        searchInput.style.display = 'none';
        searchInput.blur();
      }
      if (searchInputDisplay) {
        searchInputDisplay.style.display = '';
        renderSearchDisplay();
      }
    }

    // Update hint bar to reflect current mode
    updateSearchHintBar();
  }

  // ---- jj-to-normal-mode helpers ----
  function cancelPendingJJ() {
    if (jjPendingTimeout) {
      clearTimeout(jjPendingTimeout);
      jjPendingTimeout = null;
    }
    jjPending = false;
    jjSavedValue = null;
  }

  function flushPendingJ() {
    if (!jjPending) return;
    const savedVal = jjSavedValue;
    const savedCur = jjSavedCursor;
    cancelPendingJJ();
    if (!searchInput) return;
    // Restore to saved state then insert j (handles leaked j from preventDefault failing)
    searchInput.value = (savedVal !== null ? savedVal : '').slice(0, savedCur) + 'j' +
                        (savedVal !== null ? savedVal : '').slice(savedCur);
    searchInput.selectionStart = searchInput.selectionEnd = savedCur + 1;
    searchInput.dispatchEvent(new Event('input', { bubbles: true }));
  }

  // Handle search mode keyboard input
  function handleSearchKeyDown(event) {
    const key = event.key;

    // ---- COMMAND MODE HANDLING ----
    if (commandMode) {
      // Navigation keys (work in both insert and normal)
      if ((event.ctrlKey && key === 'j') || key === 'ArrowDown') {
        event.preventDefault();
        event.stopPropagation();
        moveSearchSelection('down');
        return true;
      }
      if ((event.ctrlKey && key === 'k') || key === 'ArrowUp') {
        event.preventDefault();
        event.stopPropagation();
        moveSearchSelection('up');
        return true;
      }

      // In dedup-preview: 'o' (normal) or Ctrl+o (insert) to go to the selected tab for inspection
      if (commandSubFlow?.type === 'dedup-preview') {
        if ((searchVimMode === 'normal' && key === 'o') || (event.ctrlKey && key === 'o')) {
          event.preventDefault();
          event.stopPropagation();
          const selected = commandResults[searchSelectedIndex];
          if (selected?.tab) {
            hidePreviewPanel(true);
            exitSearchMode();
            gBrowser.selectedTab = selected.tab;
            log(`Dedup preview: switched to tab "${selected.tab.label}" for inspection`);
          }
          return true;
        }
      }

      // In session list or detail view: 'd' (normal) or Ctrl+d (insert) to delete session
      if (commandSubFlow?.type === 'session-detail-view' || commandSubFlow?.type === 'list-sessions-picker') {
        if ((searchVimMode === 'normal' && key === 'd') || (event.ctrlKey && key === 'd')) {
          event.preventDefault();
          event.stopPropagation();
          // Get session from data (detail view) or from currently highlighted result (list view)
          let session = commandSubFlow.data?.session;
          if (!session && commandSubFlow.type === 'list-sessions-picker') {
            const selected = commandResults[searchSelectedIndex];
            session = selected?.sessionData;
          }
          if (session) {
            enterSubFlow('delete-session-confirm', 'Delete Session');
            commandSubFlow.data = { sessionId: session.id };
          }
          return true;
        }
      }

      // Enter to execute/select (both modes)
      if (key === 'Enter') {
        event.preventDefault();
        event.stopPropagation();
        handleCommandSelect();
        return true;
      }

      // Tab key — toggle workspace search in tab-search/split-tab-picker sub-flows, else act as Enter (if setting enabled)
      if (key === 'Tab') {
        event.preventDefault();
        event.stopPropagation();
        if (commandSubFlow && (commandSubFlow.type === 'tab-search' || commandSubFlow.type === 'split-tab-picker' || commandSubFlow.type === 'dedup-preview' || commandSubFlow.type === 'playing-tabs')) {
          toggleCrossWorkspaceSearch();
        } else if (S['display.tabAsEnter']) {
          handleCommandSelect();
        }
        return true;
      }

      // Escape handling: insert → normal → back/exit
      if (key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        if (!S['display.vimModeInBars'] || searchVimMode !== 'insert') {
          // Vim disabled or already in normal mode: go back or exit
          if (commandSubFlow) {
            exitSubFlow();
            searchVimMode = 'insert';
            updateSearchVimIndicator();
          } else if (browseCommandMode) {
            returnToBrowseMode();
          } else if (commandEnteredFromSearch) {
            exitCommandMode();
          } else {
            exitSearchMode();
          }
        } else {
          // Switch to normal mode
          searchCursorPos = searchInput?.selectionStart || 0;
          searchVimMode = 'normal';
          updateSearchVimIndicator();
        }
        return true;
      }

      // ---- COMMAND NORMAL MODE ----
      if (S['display.vimModeInBars'] && searchVimMode === 'normal') {
        event.preventDefault();
        event.stopPropagation();

        handleBarVimNormalMode(key, event);
        return true;
      }

      // ---- COMMAND INSERT MODE ----
      // Backspace when input is empty and no sub-flow: go back
      if (key === 'Backspace' && (searchInput?.value || '') === '' && !commandSubFlow) {
        event.preventDefault();
        event.stopPropagation();
        if (browseCommandMode) {
          returnToBrowseMode();
        } else if (commandEnteredFromSearch) {
          exitCommandMode();
        } else {
          exitSearchMode();
        }
        return true;
      }

      // Let all other keys pass through to input for typing
      return false;
    }

    // ---- NORMAL SEARCH MODE HANDLING ----

    // Navigation keys work in both modes
    if ((event.ctrlKey && key === 'j') || key === 'ArrowDown') {
      event.preventDefault();
      event.stopPropagation();
      moveSearchSelection('down');
      return true;
    }

    if ((event.ctrlKey && key === 'k') || key === 'ArrowUp') {
      event.preventDefault();
      event.stopPropagation();
      moveSearchSelection('up');
      return true;
    }

    // Enter to select
    if (key === 'Enter') {
      event.preventDefault();
      event.stopPropagation();
      selectSearchResult(searchSelectedIndex);
      return true;
    }

    // Tab to toggle cross-workspace search (works in both insert and normal mode)
    if (key === 'Tab') {
      event.preventDefault();
      event.stopPropagation();
      toggleCrossWorkspaceSearch();
      return true;
    }

    // Ctrl+X to close selected tab (works in insert mode)
    if (event.ctrlKey && key === 'x') {
      event.preventDefault();
      event.stopPropagation();
      closeSelectedSearchResult();
      return true;
    }

    // Escape handling
    if (key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();

      if (!S['display.vimModeInBars'] || searchVimMode === 'normal') {
        // Vim disabled or already in normal mode: exit search
        exitSearchMode();
      } else {
        // Switch to normal mode
        // Save cursor position before blurring
        searchCursorPos = searchInput.selectionStart || 0;
        searchVimMode = 'normal';
        updateSearchVimIndicator(); // This will blur the input
      }
      return true;
    }

    // Vim normal mode handling
    if (S['display.vimModeInBars'] && searchVimMode === 'normal') {
      event.preventDefault();
      event.stopPropagation();

      handleBarVimNormalMode(key, event);
      return true;
    }

    // Insert mode - let input handle it, but update state
    // We'll handle this in the input event
    return false;
  }

  // Vim NORMAL mode in the tab-search and command bar (one implementation for
  // both; they differ only in the text/results they edit and in what x does).
  function handleBarVimNormalMode(key, event) {
    const bar = commandMode
      ? {
          text: commandQuery || '',
          count: commandResults.length,
          setText: (v) => { commandQuery = v; if (searchInput) searchInput.value = v; },
          render: renderCommandResults,
          pick: (idx) => { searchSelectedIndex = idx; handleCommandSelect(); },
        }
      : {
          text: searchQuery,
          count: searchResults.length,
          setText: (v) => { searchQuery = v; if (searchInput) searchInput.value = v; },
          render: renderSearchResults,
          pick: (idx) => selectSearchResult(idx),
        };
    const text = bar.text;
    const len = text.length;
    const toInsert = (pos = searchCursorPos) => {
      searchCursorPos = pos;
      searchVimMode = 'insert';
      updateSearchVimIndicator(); // This will show input, focus and set cursor
    };
    const deleteRange = (start, end) => {
      bar.setText(text.slice(0, start) + text.slice(end));
      bar.render();
    };

    // Quick jump with numbers 1-9
    if (key >= '1' && key <= '9') {
      const idx = parseInt(key) - 1;
      if (idx < bar.count) bar.pick(idx);
      return;
    }

    // Result navigation: j/k, G = last, g = first
    if (key === 'j') { moveSearchSelection('down'); return; }
    if (key === 'k') { moveSearchSelection('up'); return; }
    if (key === 'G' || key === 'g') {
      if (bar.count > 0) {
        const oldIndex = searchSelectedIndex;
        searchSelectedIndex = key === 'G' ? bar.count - 1 : 0;
        updateSelectionHighlight(oldIndex, searchSelectedIndex);
      }
      return;
    }

    switch (key) {
      // Cursor movement
      case 'h': searchCursorPos = Math.max(0, searchCursorPos - 1); renderSearchDisplay(); break;
      case 'l': searchCursorPos = Math.min(len > 0 ? len - 1 : 0, searchCursorPos + 1); renderSearchDisplay(); break;
      case '0': searchCursorPos = 0; renderSearchDisplay(); break;
      case '$': searchCursorPos = Math.max(0, len - 1); renderSearchDisplay(); break;
      case 'w': // Word forward
        searchCursorPos = findNextWordBoundary(text, searchCursorPos, 'forward');
        if (searchCursorPos >= len && len > 0) searchCursorPos = len - 1;
        renderSearchDisplay();
        break;
      case 'b': // Word backward
        searchCursorPos = findNextWordBoundary(text, searchCursorPos, 'backward');
        renderSearchDisplay();
        break;
      case 'e': // End of word
        searchCursorPos = findWordEnd(text, searchCursorPos);
        if (searchCursorPos >= len && len > 0) searchCursorPos = len - 1;
        renderSearchDisplay();
        break;

      // Insert mode switches
      case 'i': toInsert(); break;
      case 'a': toInsert(Math.min(len, searchCursorPos + 1)); break;
      case 'I': toInsert(0); break;
      case 'A': toInsert(len); break;

      // Editing
      case 'x':
        // Tab search: x closes the selected tab; command bar: delete character
        if (!commandMode) { closeSelectedSearchResult(); break; }
        // falls through
      case 'd': // Delete character (like x)
        if (searchCursorPos < len) {
          deleteRange(searchCursorPos, searchCursorPos + 1);
          const newLen = bar.text.length - 1;
          if (searchCursorPos >= newLen && newLen > 0) searchCursorPos = newLen - 1;
          renderSearchDisplay();
        }
        break;
      case 's': // Substitute (delete char and enter insert)
        if (searchCursorPos < len) deleteRange(searchCursorPos, searchCursorPos + 1);
        toInsert();
        break;
      case 'S': // Substitute entire line
        searchSelectedIndex = 0;
        deleteRange(0, len);
        toInsert(0);
        break;
      case 'D': // Delete to end of line
        deleteRange(searchCursorPos, len);
        if (searchCursorPos > 0) searchCursorPos -= 1;
        renderSearchDisplay();
        break;
      case 'C': // Change to end of line
        deleteRange(searchCursorPos, len);
        toInsert();
        break;
    }
  }

  // Find next word boundary
  function findNextWordBoundary(text, pos, direction) {
    const len = text.length;

    if (direction === 'forward') {
      // Skip current word
      while (pos < len && !/\s/.test(text[pos])) pos++;
      // Skip whitespace
      while (pos < len && /\s/.test(text[pos])) pos++;
      return pos;
    } else {
      // Move back one
      if (pos > 0) pos--;
      // Skip whitespace
      while (pos > 0 && /\s/.test(text[pos])) pos--;
      // Find start of word
      while (pos > 0 && !/\s/.test(text[pos - 1])) pos--;
      return pos;
    }
  }

  // Find end of current word
  function findWordEnd(text, pos) {
    const len = text.length;
    if (pos >= len) return len;

    // Move forward one
    pos++;
    // Skip whitespace
    while (pos < len && /\s/.test(text[pos])) pos++;
    // Find end of word
    while (pos < len && !/\s/.test(text[pos])) pos++;
    return Math.max(0, pos - 1);
  }

  // ============================================
  // URL BAR VIM MODE (Cmd+L / Cmd+T native bar)
  // ============================================

  function getUrlbarInput() {
    try { return gURLBar?.inputField; } catch (e) { return null; }
  }

  // URL-bar vim mode has its own toggle; it also follows the general
  // "Vim Mode in Search/Command" switch, as it always has.
  function isUrlbarVimEnabled() {
    return !!S['display.vimModeInBars'] && S['display.urlbarVim'] !== false;
  }

  // Did the user edit the URL bar text since it was focused? Firefox's
  // valueIsTyped is not enough: URL autofill (typing "gith" completes to
  // "github.com/") resets it although the text is the user's (REV-LCORE-02).
  let urlbarEditedSinceFocus = false;

  // Text the user typed that Escape should keep (switching to NORMAL): typed
  // since focus, or typed earlier and still shown (Firefox keeps a tab's typed
  // URL-bar text). An untouched bar, including Zen's empty Ctrl+T bar, closes.
  function urlbarHasTypedText() {
    return urlbarEditedSinceFocus || (gURLBar.valueIsTyped && !!gURLBar.value &&
      gURLBar.getAttribute('pageproxystate') === 'invalid');
  }

  // --- jj helpers for URL bar ---
  function cancelUrlbarJJ() {
    if (urlbarJjPendingTimeout) {
      clearTimeout(urlbarJjPendingTimeout);
      urlbarJjPendingTimeout = null;
    }
    urlbarJjPending = false;
    urlbarJjSavedValue = null;
  }

  function flushUrlbarJ() {
    if (!urlbarJjPending) return;
    const savedVal = urlbarJjSavedValue;
    const savedCur = urlbarJjSavedCursor;
    cancelUrlbarJJ();
    const input = getUrlbarInput();
    if (!input) return;
    // Insert the held 'j' at the saved cursor position
    input.value = (savedVal !== null ? savedVal : '').slice(0, savedCur) + 'j' +
                  (savedVal !== null ? savedVal : '').slice(savedCur);
    input.setSelectionRange(savedCur + 1, savedCur + 1);
    urlbarEditedSinceFocus = true; // the user typed that 'j'
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }

  // --- Comprehensive keydown handler attached on gURLBar (moz-urlbar ancestor) ---
  // MUST be on the ancestor (not the input) with capture:true so it fires
  // during the capture phase BEFORE the event reaches the input element.
  // stopPropagation() then prevents the event from ever reaching the input,
  // which is the only reliable way to prevent moz-urlbar's internal editor
  // from processing the keystroke. Handlers on the input itself fire too
  // late — moz-urlbar registers its own handlers first and the editor
  // processes keys before our preventDefault can take effect.
  function urlbarInputKeyHandler(e) {
    if (!urlbarVimActive || !isUrlbarVimEnabled()) return;
    if (e.isComposing || e.keyCode === 229) return;

    // Skip modifier-only keys — they never generate keypress/beforeinput
    // and would leave urlbarSuppressKeypress stuck true.
    if (e.key === 'Shift' || e.key === 'Control' || e.key === 'Alt' || e.key === 'Meta') return;

    // A new key: a flag left by the previous keydown is stale. A keydown that
    // was preventDefault()ed gets no keypress, so without this reset the
    // first character typed after i/a/A was swallowed.
    urlbarSuppressKeypress = false;

    // ---- NORMAL MODE: intercept ALL keys ----
    if (urlbarVimMode === 'normal') {
      // Escape in normal mode: let Firefox close the URL bar
      if (e.key === 'Escape') {
        urlbarVimActive = false;
        urlbarVimMode = 'insert';
        cancelUrlbarJJ();
        hideUrlbarVimIndicator();
        gURLBar?.removeAttribute('data-zenleap-vim');
        // Don't preventDefault — let Firefox handle Escape (revert + close)
        return;
      }

      // Let browser shortcuts (Cmd/Ctrl+key) pass through unmodified,
      // except Ctrl+j which we handle as "accept suggestion".
      if (e.metaKey || (e.ctrlKey && e.key !== 'j')) return;

      // Stop event from reaching input entirely + prevent default action.
      // CRITICAL: set suppress flag BEFORE dispatching to vim handler,
      // because the handler may switch to insert mode (i/a/I/A/s/S/C).
      // The subsequent keypress event would then see insert mode and let
      // the character through. The flag ensures keypress is also blocked.
      urlbarSuppressKeypress = true;
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      handleUrlbarVimNormalMode(e.key, e);
      return;
    }

    // ---- INSERT MODE ----
    // Escape: switch to normal mode — but only once the user typed something.
    // Otherwise (nothing typed, or a search-mode chip to leave) Firefox's own
    // Escape handling runs, so a single Escape still closes the URL bar
    // (incl. Zen's floating Ctrl+T bar) as it does without ZenLeap.
    if (e.key === 'Escape') {
      flushUrlbarJ(); // Commit any pending 'j' before deciding
      if (!urlbarHasTypedText() || gURLBar.searchMode) return;
      urlbarSuppressKeypress = true;
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      const input = getUrlbarInput();
      urlbarCursorPos = input ? (input.selectionStart || 0) : 0;
      urlbarVimMode = 'normal';
      updateUrlbarVimIndicator();
      return;
    }

    // jj detection in insert mode
    const input = getUrlbarInput();
    if (!input) return;

    if (S['timing.jjEscape'] && e.key === 'j' && !e.ctrlKey && !e.altKey && !e.metaKey) {
      urlbarSuppressKeypress = true;
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      if (urlbarJjPending) {
        // Second j within threshold → escape to normal mode
        const savedVal = urlbarJjSavedValue;
        const savedCur = urlbarJjSavedCursor;
        cancelUrlbarJJ();
        input.value = savedVal !== null ? savedVal : '';
        input.dispatchEvent(new Event('input', { bubbles: true }));
        urlbarCursorPos = savedCur;
        urlbarVimMode = 'normal';
        updateUrlbarVimIndicator();
        // Navigate down to first result so user is on a result in normal mode
        try {
          if (gURLBar.view?.isOpen) {
            gURLBar.controller.userSelectionBehavior = 'arrow';
            gURLBar.view.selectBy(1, { reverse: false });
          }
        } catch (_e) { /* ignore */ }
      } else {
        // First j → save state, wait for possible second j
        urlbarJjSavedValue = input.value;
        urlbarJjSavedCursor = input.selectionStart || 0;
        urlbarJjPending = true;
        urlbarJjPendingTimeout = setTimeout(flushUrlbarJ, S['timing.jjThreshold']);
      }
      return;
    }

    // Flush pending j when any other key arrives — clear suppress flag so
    // this character's keypress fires normally (fixes #47: next char swallowed)
    if (urlbarJjPending) {
      flushUrlbarJ();
      urlbarSuppressKeypress = false;
    }
  }

  // Keypress handler — blocks the keypress event that follows an intercepted
  // keydown. Without this, mode-switching keys (i/a/I/A/s/S/C) would type
  // their character: keydown switches mode to insert, then keypress fires,
  // sees insert mode, and lets the character through. The suppress flag
  // bridges this gap. Uses setTimeout to defer clearing so that beforeinput
  // (which fires after keypress) can also see the flag.
  function urlbarKeypressHandler(e) {
    if (urlbarSuppressKeypress) {
      // Defer clear so beforeinput handler can also see the flag
      setTimeout(() => { urlbarSuppressKeypress = false; }, 0);
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      return;
    }
    if (!urlbarVimActive || !isUrlbarVimEnabled()) return;
    // Belt-and-suspenders: also block keypress if still in normal mode
    if (urlbarVimMode === 'normal' && e.key !== 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
    }
  }

  // beforeinput handler — last line of defense against text insertion.
  // Checks the suppress flag (deferred-cleared by keypress) and normal mode.
  function urlbarBeforeinputHandler(e) {
    if (_urlbarProgrammaticEdit) return;
    if (urlbarSuppressKeypress) {
      e.preventDefault();
      return;
    }
    if (!urlbarVimActive || !isUrlbarVimEnabled()) return;
    if (urlbarVimMode === 'normal') {
      e.preventDefault();
      return;
    }
    urlbarEditedSinceFocus = true; // typing, deleting, pasting, IME
  }

  // --- Focus/blur handlers attached to inputField ---
  function onUrlbarFocus() {
    if (urlbarVimActive) return; // Already active
    urlbarVimActive = true;
    urlbarVimMode = 'insert';
    urlbarCursorPos = 0;
    urlbarSuppressKeypress = false;
    urlbarEditedSinceFocus = false;
    cancelUrlbarJJ();
    if (isUrlbarVimEnabled()) {
      ensureUrlbarVimIndicator();
      updateUrlbarVimIndicator();
    }
  }

  function onUrlbarBlur() {
    if (!urlbarVimActive) return;
    flushUrlbarJ(); // Commit any pending 'j' before deactivating
    urlbarVimActive = false;
    urlbarVimMode = 'insert';
    urlbarCursorPos = 0;
    urlbarSuppressKeypress = false;
    hideUrlbarVimIndicator();
    gURLBar?.removeAttribute('data-zenleap-vim');
  }

  // Lazily attach listeners (inputField may not exist at init).
  function lazySetupUrlbarVim() {
    if (urlbarVimSetupDone) return;

    const input = getUrlbarInput();
    if (!input) return;

    // Attach keydown/keypress/beforeinput on gURLBar (the moz-urlbar ancestor)
    // in capture phase. This fires BEFORE the event reaches the input element,
    // and stopPropagation() prevents the input from ever seeing it.
    // This is the ONLY reliable way to prevent moz-urlbar's internal editor
    // from processing keystrokes.
    listen(gURLBar, 'keydown', urlbarInputKeyHandler, true);
    listen(gURLBar, 'keypress', urlbarKeypressHandler, true);

    // beforeinput on the input itself — last line of defense
    listen(input, 'beforeinput', urlbarBeforeinputHandler, true);

    // Focus/blur listeners for immediate badge display
    listen(input, 'focus', onUrlbarFocus);
    listen(input, 'blur', onUrlbarBlur);

    urlbarVimSetupDone = true;
    log('URL bar vim mode listeners attached (on gURLBar capture)');

    // If already focused, activate immediately
    if (gURLBar.focused) onUrlbarFocus();
  }

  // --- Indicator badge ---
  function ensureUrlbarVimIndicator() {
    if (urlbarVimIndicator && urlbarVimIndicator.isConnected) return;

    // moz-urlbar uses class, not id, for this container
    const container = gURLBar?.querySelector('.urlbar-input-container');
    if (!container) return;

    urlbarVimIndicator = document.createElement('span');
    urlbarVimIndicator.id = 'zenleap-urlbar-vim-indicator';
    urlbarVimIndicator.textContent = 'INSERT';

    // Append at the end of the input container (right side)
    container.appendChild(urlbarVimIndicator);
  }

  function updateUrlbarVimIndicator() {
    if (!isUrlbarVimEnabled()) {
      hideUrlbarVimIndicator();
      // Clean up normal mode state if we were in it (setting was toggled off)
      if (urlbarVimMode === 'normal') {
        urlbarVimMode = 'insert';
        const input = getUrlbarInput();
        if (input) {
          const pos = urlbarCursorPos;
          input.setSelectionRange(pos, pos); // collapse block cursor selection
          input.focus();
        }
      }
      gURLBar?.removeAttribute('data-zenleap-vim');
      return;
    }
    if (!urlbarVimIndicator) return;

    urlbarVimIndicator.style.display = 'inline-flex';

    if (urlbarVimMode === 'insert') {
      urlbarVimIndicator.textContent = 'INSERT';
      urlbarVimIndicator.classList.remove('normal');
      gURLBar?.removeAttribute('data-zenleap-vim');
    } else {
      urlbarVimIndicator.textContent = 'NORMAL';
      urlbarVimIndicator.classList.add('normal');
      gURLBar?.setAttribute('data-zenleap-vim', 'normal');
      updateUrlbarBlockCursor();
    }
  }

  function hideUrlbarVimIndicator() {
    if (urlbarVimIndicator) urlbarVimIndicator.style.display = 'none';
  }

  // Use native selection to simulate a block cursor in normal mode.
  // Selecting exactly one character at the cursor position creates
  // a highlighted block, styled via ::selection CSS.
  function updateUrlbarBlockCursor() {
    const input = getUrlbarInput();
    if (!input) return;

    const text = input.value || '';
    const len = text.length;

    if (len === 0) {
      input.setSelectionRange(0, 0);
      return;
    }

    // Clamp cursor position
    if (urlbarCursorPos >= len) urlbarCursorPos = len - 1;
    if (urlbarCursorPos < 0) urlbarCursorPos = 0;

    // Select the character at cursor to create block cursor appearance
    input.setSelectionRange(urlbarCursorPos, urlbarCursorPos + 1);
  }

  // --- Vim normal mode commands for URL bar ---
  function handleUrlbarVimNormalMode(key, event) {
    const input = getUrlbarInput();
    if (!input) return;

    const text = input.value || '';
    const len = text.length;

    // Enter / Ctrl+j to accept the currently selected autocomplete suggestion.
    // Must be checked BEFORE j/k navigation so Ctrl+j isn't caught by the j branch.
    if (key === 'Enter' || (event.ctrlKey && key === 'j')) {
      // Exit vim state and let Firefox process the navigation
      urlbarVimMode = 'insert';
      urlbarVimActive = false;
      cancelUrlbarJJ();
      hideUrlbarVimIndicator();
      gURLBar?.removeAttribute('data-zenleap-vim');
      input.setSelectionRange(input.value.length, input.value.length);
      // Create a fresh event — the original was preventDefault'd/stopPropagation'd
      // by the capture-phase handler. handleCommand may inspect these flags.
      try {
        const syntheticEvent = new KeyboardEvent('keydown', {
          key: 'Enter', code: 'Enter', bubbles: true, cancelable: true,
          ctrlKey: event.ctrlKey, shiftKey: event.shiftKey,
          altKey: event.altKey, metaKey: event.metaKey,
        });
        gURLBar.handleCommand(syntheticEvent);
      } catch (e) {
        // Never load the typed text ourselves: that would bypass the URL bar's
        // checks and run with the system principal (javascript:, file:, ...).
        reportError('URL bar navigation failed', e);
      }
      return;
    }

    // Result navigation with j/k — use the view's selectBy API.
    // Set userSelectionBehavior to "arrow" to match Firefox's internal handling,
    // which prevents re-search and preserves the result list.
    if (key === 'j' && !event.ctrlKey && !event.altKey && !event.metaKey) {
      try {
        if (gURLBar.view?.isOpen) {
          gURLBar.controller.userSelectionBehavior = 'arrow';
          gURLBar.view.selectBy(1, { reverse: false });
        }
      } catch (e) { /* ignore */ }
      return;
    }
    if (key === 'k' && !event.ctrlKey && !event.altKey && !event.metaKey) {
      try {
        if (gURLBar.view?.isOpen) {
          gURLBar.controller.userSelectionBehavior = 'arrow';
          gURLBar.view.selectBy(1, { reverse: true });
        }
      } catch (e) { /* ignore */ }
      return;
    }

    // Cursor movement commands
    switch (key) {
      case 'h': // Left
        urlbarCursorPos = Math.max(0, urlbarCursorPos - 1);
        updateUrlbarBlockCursor();
        break;

      case 'l': // Right
        urlbarCursorPos = Math.min(len > 0 ? len - 1 : 0, urlbarCursorPos + 1);
        updateUrlbarBlockCursor();
        break;

      case '0': // Beginning of line
        urlbarCursorPos = 0;
        updateUrlbarBlockCursor();
        break;

      case '$': // End of line
        urlbarCursorPos = Math.max(0, len - 1);
        updateUrlbarBlockCursor();
        break;

      case 'w': // Word forward
        urlbarCursorPos = findNextWordBoundary(text, urlbarCursorPos, 'forward');
        if (urlbarCursorPos >= len && len > 0) urlbarCursorPos = len - 1;
        updateUrlbarBlockCursor();
        break;

      case 'b': // Word backward
        urlbarCursorPos = findNextWordBoundary(text, urlbarCursorPos, 'backward');
        updateUrlbarBlockCursor();
        break;

      case 'e': // End of word
        urlbarCursorPos = findWordEnd(text, urlbarCursorPos);
        if (urlbarCursorPos >= len && len > 0) urlbarCursorPos = len - 1;
        updateUrlbarBlockCursor();
        break;

      case 'G': // Go to last autocomplete result
        urlbarSelectRow(Infinity);
        break;

      case 'g': // Go to first autocomplete result
        urlbarSelectRow(0);
        break;

      // Insert mode switches
      case 'i': // Insert at cursor
        urlbarVimMode = 'insert';
        input.setSelectionRange(urlbarCursorPos, urlbarCursorPos);
        input.focus();
        updateUrlbarVimIndicator();
        break;

      case 'a': // Insert after cursor
        urlbarCursorPos = Math.min(len, urlbarCursorPos + 1);
        urlbarVimMode = 'insert';
        input.setSelectionRange(urlbarCursorPos, urlbarCursorPos);
        input.focus();
        updateUrlbarVimIndicator();
        break;

      case 'I': // Insert at beginning
        urlbarCursorPos = 0;
        urlbarVimMode = 'insert';
        input.setSelectionRange(0, 0);
        input.focus();
        updateUrlbarVimIndicator();
        break;

      case 'A': // Insert at end
        urlbarCursorPos = len;
        urlbarVimMode = 'insert';
        input.setSelectionRange(len, len);
        input.focus();
        updateUrlbarVimIndicator();
        break;

      // Editing commands (through the editor, so u can undo them)
      case 'x': // Delete character at cursor
      case 'd': // Delete character (like x for simplicity)
        if (urlbarCursorPos < len) {
          urlbarEdit(input, urlbarCursorPos, urlbarCursorPos + 1, '');
          if (urlbarCursorPos >= input.value.length && input.value.length > 0) {
            urlbarCursorPos = input.value.length - 1;
          }
          updateUrlbarBlockCursor();
        }
        break;

      case 's': // Substitute (delete char and enter insert)
        if (urlbarCursorPos < len) {
          urlbarEdit(input, urlbarCursorPos, urlbarCursorPos + 1, '');
        }
        urlbarVimMode = 'insert';
        input.setSelectionRange(urlbarCursorPos, urlbarCursorPos);
        input.focus();
        updateUrlbarVimIndicator();
        break;

      case 'S': // Substitute entire line (clear all and enter insert mode)
        urlbarEdit(input, 0, len, '');
        urlbarCursorPos = 0;
        urlbarVimMode = 'insert';
        input.setSelectionRange(0, 0);
        input.focus();
        updateUrlbarVimIndicator();
        break;

      case 'D': // Delete to end of line
        urlbarEdit(input, urlbarCursorPos, len, '');
        if (urlbarCursorPos > 0 && input.value.length > 0) {
          urlbarCursorPos = input.value.length - 1;
        } else {
          urlbarCursorPos = 0;
        }
        updateUrlbarBlockCursor();
        break;

      case 'C': // Change to end of line (delete to end + insert)
        urlbarEdit(input, urlbarCursorPos, len, '');
        urlbarVimMode = 'insert';
        input.setSelectionRange(urlbarCursorPos, urlbarCursorPos);
        input.focus();
        updateUrlbarVimIndicator();
        break;

      case 'u': // Undo the last edit (typing or a normal-mode edit above)
        input.focus();
        _urlbarProgrammaticEdit = true;
        try { document.execCommand('undo'); } catch (e) { /* undo not available */ }
        finally { _urlbarProgrammaticEdit = false; }
        urlbarCursorPos = Math.min(input.selectionStart || 0, Math.max(0, input.value.length - 1));
        updateUrlbarBlockCursor();
        break;

      case 'p': // Paste after cursor from clipboard
        navigator.clipboard.readText().then(clip => {
          if (!clip) return;
          // Re-read current state — the async gap may have allowed changes
          const inp = getUrlbarInput();
          if (!inp || !urlbarVimActive || urlbarVimMode !== 'normal') return;
          const pos = Math.min(urlbarCursorPos + 1, (inp.value || '').length);
          urlbarEdit(inp, pos, pos, clip);
          urlbarCursorPos = pos + clip.length - 1;
          updateUrlbarBlockCursor();
        }).catch(() => { /* clipboard read failed */ });
        break;
    }
  }

  // Select the first (0) or last (Infinity) row of the open URL bar popup, the
  // way arrow keys select (updates the input to that result).
  function urlbarSelectRow(index) {
    try {
      const view = gURLBar.view;
      if (!view?.isOpen) return;
      const count = view.visibleRowCount || 0;
      if (!count) return;
      gURLBar.controller.cancelQuery?.();
      gURLBar.controller.userSelectionBehavior = 'arrow';
      view.selectedRowIndex = Math.max(0, Math.min(count - 1, index));
    } catch (e) { /* view closed meanwhile */ }
  }

  // Replace [start, end) of the URL bar text through its editor, so the edit
  // is undoable and fires the same input events as typing.
  let _urlbarProgrammaticEdit = false;
  function urlbarEdit(input, start, end, text) {
    if (start === end && !text) return;
    input.focus();
    input.setSelectionRange(start, end);
    let ok = false;
    _urlbarProgrammaticEdit = true;
    try {
      ok = text ? document.execCommand('insertText', false, text) : document.execCommand('delete', false);
    } catch (e) {
      ok = false;
    } finally {
      _urlbarProgrammaticEdit = false;
    }
    if (!ok) {
      input.setRangeText(text, start, end, 'end');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }

  // --- Setup: inject CSS for URL bar vim mode (called at init, no inputField dependency) ---
  function setupUrlbarVimMode() {
    // Prevent double-initialization of CSS
    if (document.getElementById('zenleap-urlbar-vim-styles')) return;

    injectStyleBlock('zenleap-urlbar-vim-styles', `
      #zenleap-urlbar-vim-indicator {
        font-family: var(--zl-font-mono, 'JetBrains Mono', monospace);
        font-size: 9px;
        font-weight: 700;
        padding: 2px 6px;
        border-radius: 4px;
        background: var(--zl-accent, #7c6fef);
        color: var(--zl-bg-base, #1a1a2e);
        margin-left: 4px;
        flex-shrink: 0;
        line-height: 1;
        align-self: center;
        pointer-events: none;
        z-index: 1;
        order: 999;
      }
      #zenleap-urlbar-vim-indicator.normal {
        background: var(--zl-gold, #d4a754);
      }
      /* Block cursor via ::selection styling in normal mode */
      #urlbar[data-zenleap-vim="normal"] .urlbar-input::selection,
      #urlbar[data-zenleap-vim="normal"] input.urlbar-input::selection {
        background-color: var(--zl-gold, #d4a754) !important;
        color: var(--zl-bg-deep, #13131f) !important;
      }
      #urlbar[data-zenleap-vim="normal"] .urlbar-input::-moz-selection,
      #urlbar[data-zenleap-vim="normal"] input.urlbar-input::-moz-selection {
        background-color: var(--zl-gold, #d4a754) !important;
        color: var(--zl-bg-deep, #13131f) !important;
      }
    `);

    log('URL bar vim mode CSS injected');
    // Attach now so the INSERT badge shows on focus, not on the first keystroke
    // (handleKeyDown still retries lazily if the URL bar wasn't ready yet).
    lazySetupUrlbarVim();
  }


  // Render the display element with block cursor for normal mode
  function renderSearchDisplay() {
    if (!searchInputDisplay) return;

    const text = commandMode ? commandQuery : searchQuery;
    const pos = searchCursorPos;
    const placeholder = commandMode
      ? (commandSubFlow ? getSubFlowPlaceholder(commandSubFlow.type) : 'Type a command...')
      : 'Search tabs...';

    if (text.length === 0) {
      // Empty - show placeholder with cursor
      searchInputDisplay.innerHTML = `<span class="cursor-empty"></span><span class="placeholder">${placeholder}</span>`;
      return;
    }

    // Split text around cursor position
    const before = escapeHtml(text.slice(0, pos));
    const cursorChar = pos < text.length ? escapeHtml(text[pos]) : '';
    const after = pos < text.length ? escapeHtml(text.slice(pos + 1)) : '';

    if (pos >= text.length) {
      // Cursor at end - show block cursor after text
      searchInputDisplay.innerHTML = `${before}<span class="cursor-empty"></span>`;
    } else {
      // Cursor on a character - highlight that character
      searchInputDisplay.innerHTML = `${before}<span class="cursor-char">${cursorChar}</span>${after}`;
    }
  }

  // Handle search input changes (debounced to avoid re-running the full
  // search pipeline on every keystroke during fast typing).
  let _searchInputDebounceTimer = null;
  const SEARCH_INPUT_DEBOUNCE_MS = 32; // ~2 animation frames

  function handleSearchInput(event) {
    const value = searchInput.value;

    // Command prefix detection must be synchronous (don't debounce mode switches)
    if (!commandMode && value === S['keys.search.commandPrefix']) {
      clearTimeout(_searchInputDebounceTimer);
      searchInput.value = '';
      commandEnteredFromSearch = true;
      enterCommandMode();
      return;
    }

    // Debounce the search/command pipeline
    clearTimeout(_searchInputDebounceTimer);
    _searchInputDebounceTimer = setTimeout(() => {
      if (commandMode) {
        commandQuery = value;
        searchSelectedIndex = 0;
        renderCommandResults();
      } else {
        searchQuery = value;
        searchCursorPos = searchInput.selectionStart;
        searchSelectedIndex = 0;
        renderSearchResults();
      }
    }, SEARCH_INPUT_DEBOUNCE_MS);
  }

  // Get visible tabs
  function getVisibleTabs() {
    const tabs = Array.from(gBrowser.tabs);
    return tabs.filter(tab => {
      if (tab.hasAttribute('zen-glance-tab')) return false;
      if (tab.hasAttribute('zen-empty-tab')) return false;
      if (tab.hidden) return false;
      return true;
    });
  }

  // Check if an item is a zen-folder element
  function isFolder(item) {
    return item && item.tagName && item.tagName.toLowerCase() === 'zen-folder';
  }

  // Nearest enclosing Zen folder of a tab or folder, looking through split-view
  // groups (a split inside a folder belongs to that folder). The space's
  // collapsible pinned section is not a folder. null for loose items.
  function parentFolderOf(el) {
    let group = el?.group;
    while (group && !isFolder(group)) group = group.group;
    return group || null;
  }

  // Is a tab or folder actually shown in the sidebar? Zen's own `visible`
  // getters encode the rules: collapsed (nested) folders hide their content
  // except the active tabs, split-view groups inside folders included, and a
  // collapsed pinned section hides its pinned tabs and folders except the
  // active ones (LEAP-B-09 / LEAP-COMPAT-09).
  function isItemShown(item) {
    // A split view is drawn as one row: all its panes show when one does.
    // (In a collapsed folder Zen keeps the selected split visible, but its
    // tab getter reports the other pane hidden: REV-LCORE-07.)
    if (!isFolder(item) && item.group?.hasAttribute?.('split-view-group')) {
      return item.group.tabs.some(isShownByZen);
    }
    return isShownByZen(item);
  }

  function isShownByZen(item) {
    if (typeof item.visible === 'boolean') return item.visible;
    // Fallback for builds without the getters: walk the folder ancestry.
    if (!isFolder(item) && item.hasAttribute('folder-active')) return true;
    for (let g = item.group; g; g = g.group) {
      if (isFolder(g) && g.collapsed) return false;
    }
    return true;
  }

  // Get visible tabs AND folders in DOM order (for browse mode navigation)
  // Uses a microtask-scoped cache so multiple calls within the same event handler
  // (e.g. moveHighlight -> updateHighlight -> updateLeapOverlayState) reuse one result
  // instead of rescanning and re-sorting the DOM each time.
  let _visibleItemsCache = null;

  function getVisibleItems() {
    if (_visibleItemsCache) return _visibleItemsCache;

    const tabs = getVisibleTabs().filter(isItemShown);
    const activeWsId = window.gZenWorkspaces?.activeWorkspace;
    const folders = Array.from(
      gBrowser.tabContainer.querySelectorAll('zen-folder')
    ).filter(folder => {
      const folderWsId = folder.getAttribute('zen-workspace-id');
      if (activeWsId && folderWsId && folderWsId !== activeWsId) return false;
      return isItemShown(folder);
    });
    const combined = [...tabs, ...folders];
    combined.sort((a, b) => {
      const position = a.compareDocumentPosition(b);
      if (position & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
      if (position & Node.DOCUMENT_POSITION_PRECEDING) return 1;
      return 0;
    });

    _visibleItemsCache = combined;
    // Invalidate at end of current microtask so next event gets fresh data
    Promise.resolve().then(() => { _visibleItemsCache = null; });
    return combined;
  }

  // Get tabs for search — respects cross-workspace setting
  function getSearchableTabs() {
    const includeEssentialTabs = S['display.searchIncludeEssentialTabs'];
    const isSearchableTab = (tab) =>
      tab &&
      !tab.hasAttribute('zen-glance-tab') &&
      !tab.hasAttribute('zen-empty-tab') &&
      (includeEssentialTabs || !tab.hasAttribute('zen-essential'));

    if (S['display.searchAllWorkspaces'] && window.gZenWorkspaces) {
      // Use Zen's allStoredTabs which traverses all workspace DOM containers
      try {
        const allTabs = gZenWorkspaces.allStoredTabs;
        if (allTabs && allTabs.length > 0) {
          return Array.from(allTabs).filter(isSearchableTab);
        }
      } catch (e) {
        log(`allStoredTabs failed, falling back: ${e}`);
      }
    }
    return getVisibleTabs().filter(isSearchableTab);
  }

  // Build a workspace ID -> name map once, then reuse for all tabs in a search render.
  // Avoids O(results × workspaces) repeated getWorkspaces() calls.
  let _wsNameMap = null;
  let _wsNameMapTime = 0;
  const WS_NAME_MAP_TTL = 500;

  function getWorkspaceNameMap() {
    const now = Date.now();
    if (_wsNameMap && (now - _wsNameMapTime) < WS_NAME_MAP_TTL) return _wsNameMap;
    const map = new Map();
    try {
      if (!window.gZenWorkspaces) {
        _wsNameMap = map;
        _wsNameMapTime = now;
        return map;
      }
      const workspaces = gZenWorkspaces.getWorkspaces();
      if (Array.isArray(workspaces)) {
        for (const ws of workspaces) {
          map.set(ws.uuid, ws.name);
        }
      }
    } catch (e) {
      // Don't cache on error — allow retry on next call
      log(`getWorkspaceNameMap failed: ${e}`);
      return map;
    }
    _wsNameMap = map;
    _wsNameMapTime = now;
    return map;
  }

  // Get workspace name for a tab (returns null if same as active workspace)
  function getTabWorkspaceName(tab) {
    try {
      if (!window.gZenWorkspaces) return null;
      const tabWsId = tab.getAttribute('zen-workspace-id');
      const activeWsId = gZenWorkspaces.activeWorkspace;
      if (!tabWsId || tabWsId === activeWsId) return null;
      const wsMap = getWorkspaceNameMap();
      return wsMap.get(tabWsId) || null;
    } catch (e) {
      return null;
    }
  }

  // Index of the first loose unpinned tab (where "the tabs" start below
  // essentials, pinned tabs and folders); -1 if there is none.
  function firstUnpinnedIndex(items) {
    return items.findIndex(t => !isFolder(t) && !t.pinned && !t.hasAttribute('zen-essential'));
  }

  // Where numbering starts when no sidebar item is current (Zen selects its
  // hidden empty tab in a fresh space or window): a virtual position just
  // above the first unpinned tab. Items below count 1, 2, ... down, items
  // above 1, 2, ... up, and nothing gets the current-tab indicator.
  function virtualOriginIndex(items) {
    const first = firstUnpinnedIndex(items);
    return first >= 0 ? first : items.length;
  }

  // Find the index of the current tab within the visible items list.
  // Handles the case where the selected tab is inside a collapsed folder
  // (including nested subfolders) by returning the folder's index instead.
  // Returns -1 only when the tab is truly absent from the list.
  function findCurrentItemIndex(items) {
    const current = currentTab();
    // First pass: direct match.  Prioritized so that a folder-active tab
    // (visible despite its parent folder being collapsed) is found before
    // the folder's contains() check would claim it.
    for (let i = 0; i < items.length; i++) {
      if (items[i] === current) return i;
    }
    // Second pass: check collapsed folders for DOM containment
    // (handles tabs fully hidden inside collapsed folders/subfolders)
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (isFolder(item) && item.collapsed && item.contains(current)) return i;
    }
    return -1;
  }

  // Attribute writes that skip no-op changes: every write restyles the tab and
  // queues mutation records for Zen's observers, so with hundreds of tabs only
  // the badges whose value changed should be touched (LEAP-B-24).
  function setAttrIfChanged(el, name, value) {
    if (el.getAttribute(name) !== value) el.setAttribute(name, value);
  }

  function removeAttrIfPresent(el, name) {
    if (el.hasAttribute(name)) el.removeAttribute(name);
  }

  // Tabs/folders that carry badge attributes (from the previous update).
  let _badgedItems = new Set();

  // Remove all badge state from a tab or folder.
  function clearItemBadge(item) {
    removeAttrIfPresent(item, 'data-zenleap-direction');
    removeAttrIfPresent(item, 'data-zenleap-distance');
    removeAttrIfPresent(item, 'data-zenleap-has-mark');
    removeAttrIfPresent(item, 'data-zenleap-rel');
    const inner = isFolder(item)
      ? item.querySelector(':scope > .tab-group-label-container')
      : item.querySelector(':scope > .tab-stack > .tab-content');
    if (inner) {
      removeAttrIfPresent(inner, 'data-zenleap-rel');
      removeAttrIfPresent(inner, 'data-zenleap-mark');
    }
  }

  // Update relative numbers on all tabs
  // Optimized: builds a reverse mark map (tab→char) once per call for O(1) lookup
  // instead of iterating the marks map per tab.
  function updateRelativeNumbers() {
    if (_tornDown) return;
    // Use folder-aware list: collapsed folders count as one item,
    // their hidden child tabs are excluded, and folder elements are included.
    const items = getVisibleItems();

    // Clean stale badges from elements that left the visible items list
    // (e.g. tabs hidden by folder collapse, subfolders inside collapsed parents).
    // Without this, badges persist on hidden elements due to Zen's CSS animation
    // approach (opacity/height transitions instead of display:none). The badge
    // text lives on .tab-content / the folder label, the direction on the host.
    const itemsSet = new Set(items);
    for (const host of _badgedItems) {
      if (!itemsSet.has(host)) clearItemBadge(host);
    }
    _badgedItems = itemsSet;

    // Check relative numbers display mode: 'always', 'active' (leap/browse only), 'off'
    const relMode = S['display.showRelativeNumbers'];
    if (relMode === 'off' || (relMode === 'active' && !leapMode && !browseMode)) {
      for (const item of items) clearItemBadge(item);
      _badgedItems = new Set();
      removeAttrIfPresent(document.documentElement, 'data-zenleap-badges');
      return;
    }
    setAttrIfChanged(document.documentElement, 'data-zenleap-badges', 'true');

    const currentIndex = findCurrentItemIndex(items);
    if (items.length === 0) return;

    // No current item (Zen's empty tab is selected): number from a virtual
    // origin instead of pretending the first essential is current.
    const origin = currentIndex === -1 ? virtualOriginIndex(items) : null;

    // Clean up marks for closed tabs
    cleanupMarks();

    // Build reverse mark map for O(1) lookup per tab (instead of O(marks) via getMarkForTab)
    const tabToMark = new Map();
    for (const [char, markedTab] of marks) {
      tabToMark.set(markedTab, char);
    }

    items.forEach((item, index) => {
      let relativeDistance, direction;
      if (origin === null) {
        relativeDistance = Math.abs(index - currentIndex);
        direction = index < currentIndex ? 'up' : (index > currentIndex ? 'down' : 'current');
      } else {
        relativeDistance = index < origin ? origin - index : index - origin + 1;
        direction = index < origin ? 'up' : 'down';
      }
      const displayChar = numberToDisplay(relativeDistance);

      const mark = tabToMark.get(item) || null;

      setAttrIfChanged(item, 'data-zenleap-direction', direction);

      if (isFolder(item)) {
        // Folders: set on both the folder and its label container so the
        // ::after pseudo on .tab-group-label-container can read the attribute.
        setAttrIfChanged(item, 'data-zenleap-rel', displayChar);
        const labelContainer = item.querySelector(':scope > .tab-group-label-container');
        if (labelContainer) setAttrIfChanged(labelContainer, 'data-zenleap-rel', displayChar);
      } else {
        const tabContent = item.querySelector(':scope > .tab-stack > .tab-content');
        if (tabContent) {
          if (mark) {
            // Show mark instead of relative number
            setAttrIfChanged(tabContent, 'data-zenleap-rel', mark);
            setAttrIfChanged(tabContent, 'data-zenleap-mark', mark);
            setAttrIfChanged(item, 'data-zenleap-has-mark', 'true');
          } else {
            // Show relative number
            setAttrIfChanged(tabContent, 'data-zenleap-rel', displayChar);
            removeAttrIfPresent(tabContent, 'data-zenleap-mark');
            removeAttrIfPresent(item, 'data-zenleap-has-mark');
          }
        }
      }
    });

    log(`Updated ${items.length} items (tabs + folders), current at index ${currentIndex}${origin !== null ? `, virtual origin ${origin}` : ''}`);
  }

  // Coalesce rapid relative-number updates into a single animation frame.
  // Used by event listeners that can fire in quick succession (TabOpen, TabClose,
  // ZenWorkspaceChanged) to avoid redundant DOM writes.
  let _relNumRafId = 0;
  function scheduleRelativeNumberUpdate() {
    if (_relNumRafId) return;
    _relNumRafId = requestAnimationFrame(() => {
      _relNumRafId = 0;
      updateRelativeNumbers();
      refreshBrowseHighlight();
    });
  }

  // Overlay element references
  let overlayModeLabel = null;
  let overlayDirectionLabel = null;
  let overlayHintLabel = null;

  // Create leap mode overlay
  function createLeapOverlay() {
    if (leapOverlay) return;

    leapOverlay = document.createElement('div');
    leapOverlay.id = 'zenleap-overlay';

    const content = document.createElement('div');
    content.id = 'zenleap-overlay-content';

    overlayModeLabel = document.createElement('span');
    overlayModeLabel.id = 'zenleap-mode-label';
    overlayModeLabel.textContent = 'LEAP';

    overlayDirectionLabel = document.createElement('span');
    overlayDirectionLabel.id = 'zenleap-direction-label';
    overlayDirectionLabel.textContent = '';

    overlayHintLabel = document.createElement('span');
    overlayHintLabel.id = 'zenleap-hint-label';
    overlayHintLabel.textContent = '';

    const sep1 = document.createElement('span');
    sep1.className = 'zenleap-hud-sep';
    const sep2 = document.createElement('span');
    sep2.className = 'zenleap-hud-sep';

    content.appendChild(overlayModeLabel);
    content.appendChild(sep1);
    content.appendChild(overlayDirectionLabel);
    content.appendChild(sep2);
    content.appendChild(overlayHintLabel);
    leapOverlay.appendChild(content);

    document.documentElement.appendChild(leapOverlay);
    log('Leap overlay created');
  }

  // Show leap mode overlay
  function showLeapOverlay() {
    createLeapOverlay();
    leapOverlay.style.display = 'block';
    updateLeapOverlayState();
  }

  // Hide leap mode overlay
  function hideLeapOverlay() {
    if (leapOverlay) {
      leapOverlay.style.display = 'none';
    }
  }

  // === TAB PREVIEW PANEL (Browse Mode) ===

  function createPreviewPanel() {
    if (previewPanel) return;

    previewPanel = document.createElement('div');
    previewPanel.id = 'zenleap-preview-panel';

    // Build internal structure with createElement (Firefox strips <img> from innerHTML in chrome context)
    const thumbContainer = document.createElement('div');
    thumbContainer.id = 'zenleap-preview-thumb-container';

    const thumbImg = document.createElement('img');
    thumbImg.id = 'zenleap-preview-thumb';
    thumbContainer.appendChild(thumbImg);

    const placeholder = document.createElement('div');
    placeholder.id = 'zenleap-preview-placeholder';
    placeholder.textContent = 'Tab not loaded';
    thumbContainer.appendChild(placeholder);

    const info = document.createElement('div');
    info.id = 'zenleap-preview-info';

    const titleRow = document.createElement('div');
    titleRow.id = 'zenleap-preview-title-row';

    const favicon = document.createElement('img');
    favicon.id = 'zenleap-preview-favicon';
    titleRow.appendChild(favicon);

    const titleSpan = document.createElement('span');
    titleSpan.id = 'zenleap-preview-title';
    titleRow.appendChild(titleSpan);

    info.appendChild(titleRow);

    const urlDiv = document.createElement('div');
    urlDiv.id = 'zenleap-preview-url';
    info.appendChild(urlDiv);

    previewPanel.appendChild(thumbContainer);
    previewPanel.appendChild(info);

    injectStyleBlock('zenleap-preview-styles', `
      #zenleap-preview-panel {
        position: fixed;
        z-index: 100003;
        width: 320px;
        background: var(--zl-bg-surface);
        border: 1px solid var(--zl-border-subtle);
        border-radius: var(--zl-r-lg);
        box-shadow: var(--zl-shadow-modal);
        backdrop-filter: var(--zl-blur);
        overflow: hidden;
        display: none;
        pointer-events: none;
        animation: zenleap-preview-appear 0.12s ease-out;
      }
      @keyframes zenleap-preview-appear {
        from { opacity: 0; transform: translateY(4px) scale(0.97); }
        to { opacity: 1; transform: translateY(0) scale(1); }
      }
      #zenleap-preview-thumb-container {
        width: 100%;
        height: 180px;
        background: var(--zl-bg-deep);
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
      }
      #zenleap-preview-thumb {
        width: 100%;
        height: 100%;
        object-fit: cover;
        object-position: top;
        display: none;
      }
      #zenleap-preview-placeholder {
        color: var(--zl-text-muted);
        font-family: var(--zl-font-mono);
        font-size: 12px;
        display: none;
      }
      #zenleap-preview-info {
        padding: 10px 12px;
      }
      #zenleap-preview-title-row {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 4px;
      }
      #zenleap-preview-favicon {
        width: 16px;
        height: 16px;
        flex-shrink: 0;
      }
      #zenleap-preview-title {
        font-size: 13px;
        font-weight: 600;
        color: var(--zl-text-primary);
        font-family: var(--zl-font-ui);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      #zenleap-preview-url {
        font-size: 11px;
        color: var(--zl-text-secondary);
        font-family: var(--zl-font-mono);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
    `);
    document.documentElement.appendChild(previewPanel);
    log('Preview panel created');
  }

  function showPreviewForTab(tab, { force = false } = {}) {
    if (!force && !S['display.browsePreview']) return;
    if (!previewPanel) createPreviewPanel();

    // Clean expired cache entries
    cleanPreviewCache();

    previewCurrentTab = tab;
    const captureId = ++previewCaptureId;

    const titleEl = document.getElementById('zenleap-preview-title');
    const urlEl = document.getElementById('zenleap-preview-url');
    const faviconEl = document.getElementById('zenleap-preview-favicon');
    const thumbEl = document.getElementById('zenleap-preview-thumb');
    const placeholderEl = document.getElementById('zenleap-preview-placeholder');

    // Immediately show title + URL + favicon (sync)
    const title = tab.label || 'Untitled';
    const url = tab.linkedBrowser?.currentURI?.spec || '';
    let faviconSrc = tab.image;
    if (!faviconSrc || typeof faviconSrc !== 'string' || faviconSrc.trim() === '') {
      faviconSrc = 'chrome://branding/content/icon32.png';
    }

    titleEl.textContent = title;
    urlEl.textContent = url;
    faviconEl.src = faviconSrc;

    // Position and show the panel
    positionPreviewPanel(tab);
    previewPanel.style.display = 'block';

    // If tab is unloaded (pending), show placeholder
    if (tab.hasAttribute('pending')) {
      thumbEl.style.display = 'none';
      placeholderEl.style.display = 'block';
      placeholderEl.textContent = 'Tab not loaded';
      return;
    }

    // Check cache
    const cached = previewCache.get(tab);
    if (cached && (Date.now() - cached.timestamp) < PREVIEW_CACHE_TTL) {
      thumbEl.src = cached.dataUrl;
      thumbEl.style.display = 'block';
      placeholderEl.style.display = 'none';
      return;
    }

    // Show loading state and capture async
    thumbEl.style.display = 'none';
    placeholderEl.style.display = 'block';
    placeholderEl.textContent = 'Loading preview...';
    captureTabThumbnail(tab, captureId);
  }

  async function captureTabThumbnail(tab, captureId) {
    try {
      const browser = tab.linkedBrowser;
      if (!browser?.browsingContext?.currentWindowGlobal) {
        if (captureId === previewCaptureId) {
          const el = document.getElementById('zenleap-preview-placeholder');
          if (el) { el.textContent = 'Preview unavailable'; el.style.display = 'block'; }
        }
        return;
      }

      // Snapshot the tab's current viewport (rect = null), i.e. what the user
      // was looking at, at the preview's width and the screen's pixel density.
      // No content script needed (the old scroll-position frame script broke
      // after process switches and injected code into web pages).
      const w = browser.clientWidth || 1280;
      const scale = (320 / w) * (window.devicePixelRatio || 1);
      const imageBitmap = await browser.browsingContext.currentWindowGlobal
        .drawSnapshot(null, scale, 'white');

      // Check if this capture is still relevant
      if (captureId !== previewCaptureId) {
        imageBitmap.close();
        return;
      }

      // Convert to data URL via canvas
      const canvas = document.createElement('canvas');
      canvas.width = imageBitmap.width;
      canvas.height = imageBitmap.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(imageBitmap, 0, 0);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      imageBitmap.close();

      // Cache it
      previewCache.set(tab, { dataUrl, timestamp: Date.now() });

      // Update UI if still relevant
      if (captureId === previewCaptureId) {
        const thumbEl = document.getElementById('zenleap-preview-thumb');
        const placeholderEl = document.getElementById('zenleap-preview-placeholder');
        if (thumbEl && placeholderEl) {
          thumbEl.src = dataUrl;
          thumbEl.style.display = 'block';
          placeholderEl.style.display = 'none';
        }
      }
    } catch (e) {
      log(`Preview capture failed: ${e}`);
      if (captureId === previewCaptureId) {
        const el = document.getElementById('zenleap-preview-placeholder');
        if (el) { el.textContent = 'Preview unavailable'; el.style.display = 'block'; }
      }
    }
  }

  function positionPreviewPanel(tab) {
    if (!previewPanel) return;

    // Next to the sidebar, on the page side of it (left of a right-side sidebar)
    const PANEL_WIDTH = 320, GAP = 12;
    const sidebar = document.getElementById('navigator-toolbox');
    const anchorRect = (sidebar || tab).getBoundingClientRect();
    let onRight = false;
    try {
      onRight = window.gZenCompactModeManager?.sidebarIsOnRight ??
        Services.prefs.getBoolPref('zen.tabs.vertical.right-side', false);
    } catch (e) { /* pref missing */ }
    let leftPos = onRight ? anchorRect.left - PANEL_WIDTH - GAP : anchorRect.right + GAP;

    // Vertically center near the highlighted tab
    const tabRect = tab.getBoundingClientRect();
    const panelHeight = 250;
    let topPos = tabRect.top + (tabRect.height / 2) - (panelHeight / 2);

    // Clamp to viewport
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;
    topPos = Math.max(8, Math.min(topPos, viewportHeight - panelHeight - 8));
    leftPos = Math.max(8, Math.min(leftPos, viewportWidth - PANEL_WIDTH - 8));

    previewPanel.style.left = `${leftPos}px`;
    previewPanel.style.top = `${topPos}px`;
  }

  function positionPreviewPanelForModal() {
    if (!previewPanel) return;

    const container = document.getElementById('zenleap-search-container');
    if (!container) return;

    const containerRect = container.getBoundingClientRect();
    const selectedEl = searchResultsList?.querySelector('.zenleap-command-result.selected, .zenleap-search-result.selected');

    // Position to the right of the search container
    let leftPos = containerRect.right + 12;

    // Vertically: align with the selected result row, or center on container
    const panelHeight = 250;
    let topPos;
    if (selectedEl) {
      const selectedRect = selectedEl.getBoundingClientRect();
      topPos = selectedRect.top + (selectedRect.height / 2) - (panelHeight / 2);
    } else {
      topPos = containerRect.top + 50;
    }

    // Clamp to viewport
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;
    topPos = Math.max(8, Math.min(topPos, viewportHeight - panelHeight - 8));
    leftPos = Math.min(leftPos, viewportWidth - 340);

    // If it would go off the right edge, place on the left
    if (leftPos + 320 > viewportWidth) {
      leftPos = containerRect.left - 332;
      if (leftPos < 8) leftPos = 8;
    }

    previewPanel.style.left = `${leftPos}px`;
    previewPanel.style.top = `${topPos}px`;
  }

  function hidePreviewPanel(clearCache = false) {
    if (previewPanel) {
      previewPanel.style.display = 'none';
    }
    clearTimeout(previewDebounceTimer);
    previewCaptureId++;
    previewCurrentTab = null;
    if (clearCache) {
      previewCache.clear();
    }
  }

  function cleanPreviewCache() {
    const now = Date.now();
    for (const [tab, entry] of previewCache) {
      if ((now - entry.timestamp) > PREVIEW_CACHE_TTL || tab.closing || !tab.parentNode) {
        previewCache.delete(tab);
      }
    }
  }

  // Compact mode with a hideable sidebar. Zen writes zen-compact-mode="true" or
  // "false" on :root, so presence of the attribute means nothing; when only the
  // toolbar is hidden (hide-tabbar off) the sidebar never needs revealing.
  function isCompactModeEnabled() {
    const mgr = window.gZenCompactModeManager;
    if (mgr) return !!mgr.preference && !!mgr.canHideSidebar;
    return document.documentElement.getAttribute('zen-compact-mode') === 'true';
  }

  function getSidebarElement() {
    return window.gZenCompactModeManager?.sidebar || document.getElementById('navigator-toolbox');
  }

  // Is the (floating) sidebar actually on screen? Zen keeps a hidden compact
  // sidebar just outside the window: left of 0 with tabs on the left, right of
  // innerWidth with tabs on the right. Visible = more than half of it overlaps
  // the window, or Zen marks it shown (user toggle / hover).
  function isSidebarVisible() {
    const sidebar = getSidebarElement();
    if (!sidebar) return false;
    if (sidebar.hasAttribute('zen-user-show') || sidebar.hasAttribute('zen-has-hover')) return true;
    const style = window.getComputedStyle(sidebar);
    if (style.display === 'none' || style.visibility === 'hidden') return false;
    const rect = sidebar.getBoundingClientRect();
    if (!rect.width) return false;
    const onScreen = Math.min(rect.right, window.innerWidth) - Math.max(rect.left, 0);
    return onScreen > rect.width / 2;
  }

  // Show the floating sidebar (compact mode) the way Zen's own "show sidebar"
  // command does (zen-user-show). Returns true if ZenLeap showed it and should
  // hide it again, false if it was already visible.
  function showFloatingSidebar() {
    if (isSidebarVisible()) {
      log('Sidebar already visible, not showing');
      return false;
    }
    const sidebar = getSidebarElement();
    if (!sidebar) return false;
    sidebar.toggleAttribute('zen-user-show', true);
    log('Showed floating sidebar');
    return true;
  }

  // Hide the floating sidebar again (idempotent).
  function hideFloatingSidebar() {
    const sidebar = getSidebarElement();
    if (!sidebar?.hasAttribute('zen-user-show')) return false;
    sidebar.removeAttribute('zen-user-show');
    log('Hid floating sidebar');
    return true;
  }

  // Temporarily show the sidebar after Alt+J/K in compact mode.
  // Each call resets the hide timer so rapid presses extend the peek.
  function peekSidebarForQuickNav() {
    const duration = S['timing.quickNavSidebarPeek'];
    if (!duration || !isCompactModeEnabled()) return;

    // If leap/browse mode is active, the sidebar is already managed
    if (leapMode) return;

    clearTimeout(quickNavPeekTimer);

    if (!quickNavPeeking) {
      if (showFloatingSidebar()) {
        quickNavPeeking = true;
      } else {
        return; // sidebar already visible or couldn't show
      }
    }

    quickNavPeekTimer = setTimeout(() => {
      if (quickNavPeeking && !leapMode) {
        hideFloatingSidebar();
        quickNavPeeking = false;
      }
      quickNavPeekTimer = null;
    }, duration);
  }

  // Update overlay state
  function updateLeapOverlayState() {
    if (!leapOverlay || !overlayDirectionLabel || !overlayHintLabel) return;

    // Set mark mode attribute for CSS styling
    if (markMode || gotoMarkMode) {
      document.documentElement.setAttribute('data-zenleap-mark-mode', 'true');
    } else {
      document.documentElement.removeAttribute('data-zenleap-mark-mode');
    }

    if (browseMode) {
      // Browse mode
      leapOverlay.classList.add('leap-direction-set');
      overlayModeLabel.textContent = 'BROWSE';
      const items = getVisibleItems();
      const index = highlightedItem ? items.indexOf(highlightedItem) : -1;
      const pos = `${index + 1}/${items.length}`;
      let statusParts = [pos];

      // Show folder info when highlighted
      const onFolder = index >= 0 && isFolder(highlightedItem);
      if (onFolder) {
        const tabCount = highlightedItem.tabs?.filter(t => !t.hasAttribute('zen-empty-tab')).length || 0;
        statusParts.push(`folder (${tabCount})`);
      }

      if (selectedItems.size > 0) statusParts.push(`${selectedItems.size} sel`);
      if (yankItems.length > 0) statusParts.push(`${yankItems.length} yanked`);
      overlayDirectionLabel.textContent = statusParts.join(' | ');

      // Mark/goto-mark sub-modes override browse hints
      if (markMode) {
        overlayModeLabel.textContent = 'MARK';
        overlayHintLabel.textContent = 'a-z/0-9 to set on highlighted tab (same char toggles off)  Esc=cancel';
      } else if (gotoMarkMode) {
        overlayModeLabel.textContent = 'GOTO';
        overlayHintLabel.textContent = 'press mark character to jump highlight  Esc=cancel';
      } else if (_browseNotice) {
        overlayHintLabel.textContent = _browseNotice.text;
      } else {
        // Show contextual hints based on highlighted item type
        if (onFolder && yankItems.length > 0) {
          overlayHintLabel.textContent = 'p=paste after  P=paste before  Enter=toggle fold  j/k=move  Esc=cancel';
        } else if (onFolder) {
          overlayHintLabel.textContent = 'Space=select  Enter=toggle fold  y=yank  x=delete  j/k=move  Esc=cancel';
        } else if (yankItems.length > 0) {
          overlayHintLabel.textContent = 'p=paste after  P=paste before  j/k=move  Esc=cancel';
        } else if (selectedItems.size > 0) {
          overlayHintLabel.textContent = 'y=yank  x=close sel  Ctrl+Shift+/=cmds  Space=toggle  Esc=cancel';
        } else {
          overlayHintLabel.textContent = "j/k=move  Space=select  m=mark  '=goto mark  Enter=open  x=close  Esc=cancel";
        }
      }
    } else if (markMode) {
      leapOverlay.classList.add('leap-direction-set');
      overlayModeLabel.textContent = 'MARK';
      overlayDirectionLabel.textContent = 'm';
      overlayHintLabel.textContent = 'a-z/0-9 to set (same char toggles off)';
    } else if (gotoMarkMode) {
      leapOverlay.classList.add('leap-direction-set');
      overlayModeLabel.textContent = 'GOTO';
      overlayDirectionLabel.textContent = "'";
      overlayHintLabel.textContent = 'press mark character to jump';
    } else if (gMode) {
      leapOverlay.classList.add('leap-direction-set');
      overlayModeLabel.textContent = 'LEAP';
      if (gNumberBuffer) {
        overlayDirectionLabel.textContent = `g${gNumberBuffer}`;
        overlayHintLabel.textContent = 'type number, then Enter or wait';
      } else {
        overlayDirectionLabel.textContent = 'g';
        overlayHintLabel.textContent = 'g=first  G=last  0-9=go to tab #';
      }
    } else if (zMode) {
      leapOverlay.classList.add('leap-direction-set');
      overlayModeLabel.textContent = 'LEAP';
      overlayDirectionLabel.textContent = 'z';
      overlayHintLabel.textContent = 'z=center  t=top  b=bottom';
    } else {
      leapOverlay.classList.remove('leap-direction-set');
      overlayModeLabel.textContent = 'LEAP';
      overlayDirectionLabel.textContent = '';
      overlayHintLabel.textContent = "j/k=browse  g=goto  m=mark  M=clear  '=jump  o/i=hist";
    }
  }

  // Steal focus from content area to prevent keyboard events from reaching web pages
  // (e.g., Space toggling YouTube playback, j/k editing Google Sheets,
  //  about:newtab search input capturing browse mode keys)
  let _leapFocus = null; // where focus was before ZenLeap took it (see restoreFocusToContent)
  function stealFocusFromContent() {
    if (contentFocusStolen) return;
    try {
      _leapFocus = captureFocusTarget();
      const browser = gBrowser.selectedBrowser;
      browser.blur();
      // Also blur any focused element inside content (especially about:newtab search)
      try { browser.browsingContext?.window?.document?.activeElement?.blur(); } catch (_) {}
      contentFocusStolen = true;
      log('Stole focus from content');
    } catch (e) {
      log(`Failed to steal focus from content: ${e}`);
    }
  }

  // Give focus back after leaving leap mode: to the element that had it (URL
  // bar, find bar, ...) or, if that was the page or the tab changed, the page.
  function restoreFocusToContent(restore = true) {
    if (!contentFocusStolen) return;
    contentFocusStolen = false;
    const saved = _leapFocus;
    _leapFocus = null;
    if (!restore) return;
    restoreFocusTarget(saved);
    log('Restored focus after leap mode');
  }

  // Intercept input for Alt+HJKL quick navigation: steal focus from content
  // to prevent keydown/keyup leaking to web pages, then restore after a delay.
  function interceptQuickNav() {
    stealFocusFromContent();
    clearTimeout(quickNavRestoreTimer);
    quickNavRestoreTimer = setTimeout(() => {
      if (!leapMode && !searchMode && !commandMode && !settingsMode && !helpMode && !reorgMode) {
        restoreFocusToContent();
      }
    }, 200);
  }

  // Enter leap mode
  function enterLeapMode() {
    if (leapMode) return;

    leapMode = true;
    browseMode = false;
    zMode = false;
    setHighlight(-1, []);
    originalTabIndex = -1;
    browseDirection = null;
    sidebarWasExpanded = false;

    // Cancel any active quick-nav sidebar peek (leap mode manages sidebar itself)
    clearTimeout(quickNavPeekTimer);
    quickNavPeekTimer = null;
    quickNavPeeking = false;

    // Cancel any pending quick-nav focus restore (leap mode manages focus itself)
    clearTimeout(quickNavRestoreTimer);
    quickNavRestoreTimer = null;

    // Steal focus from content to prevent input leaking to web pages
    stealFocusFromContent();

    // Show relative numbers if in "active" mode (leap/browse only)
    if (S['display.showRelativeNumbers'] === 'active') updateRelativeNumbers();

    // Show sidebar if in compact mode and sidebar is not already visible
    if (isCompactModeEnabled()) {
      // showFloatingSidebar checks visibility internally and returns false if already visible
      sidebarWasExpanded = showFloatingSidebar();
      log(`Compact mode active, expanded sidebar: ${sidebarWasExpanded}`);
    }

    document.documentElement.setAttribute('data-zenleap-active', 'true');
    showLeapOverlay();
    armLeapGuards();

    // Set timeout (will be cleared if entering browse mode)
    armLeapTimeout();

    _pluginEventBus.emit('leapMode:enter', {});
    log('Entered leap mode');
  }

  // --- Browse highlight: tracked by element ---
  // Tabs opened, closed or moved above the highlight (an agent working in the same
  // space, a page opening a tab, window sync) must never make Enter/x act on another
  // tab than the one drawn as highlighted. So the highlight is an element:
  // setHighlight() is the only way to move it, and syncHighlight() re-derives its
  // index before every render and action. When the element is gone, the highlight
  // moves to its nearest surviving neighbour and the action is not carried out.
  let _highlightSnapshot = [];               // items as of the last sync, to find neighbours
  let _expectedGone = new WeakSet();         // items the user closed/moved on purpose
  let _browseWorkspaceSwitching = 0;         // h/l in progress: the old space's items leave on purpose
  let _browseNotice = null;                  // { text, timer }: shown instead of the key hints

  function setHighlight(index, items = getVisibleItems()) {
    highlightedItem = index >= 0 && index < items.length ? items[index] : null;
    highlightedTabIndex = highlightedItem ? index : -1;
    _highlightSnapshot = items;
  }

  // Re-derive the highlight's index. Returns false when the highlighted element is no
  // longer shown; the highlight then moves to the item after it (or before it, or the
  // one `prefer` says), and a notice says so unless its removal was expected.
  function syncHighlight(items = getVisibleItems(), { prefer = 'next' } = {}) {
    if (!highlightedItem) {
      if (highlightedTabIndex >= 0) setHighlight(Math.min(highlightedTabIndex, items.length - 1), items);
      return true;
    }
    // A tab that is closing stays in the tab strip until its close animation ends
    const idx = highlightedItem.closing ? -1 : items.indexOf(highlightedItem);
    if (idx >= 0) {
      highlightedTabIndex = idx;
      _highlightSnapshot = items;
      return true;
    }
    const gone = highlightedItem;
    const old = _highlightSnapshot.includes(gone) ? _highlightSnapshot : items;
    const oldIdx = old.indexOf(gone);
    const shown = new Set(items.filter(item => !item.closing));
    let next = null, prev = null;
    if (oldIdx >= 0) {
      for (let i = oldIdx + 1; i < old.length && !next; i++) if (shown.has(old[i])) next = old[i];
      for (let i = oldIdx - 1; i >= 0 && !prev; i--) if (shown.has(old[i])) prev = old[i];
    }
    const target = (prefer === 'prev' ? (prev || next) : (next || prev)) ||
      [...shown][Math.min(Math.max(highlightedTabIndex, 0), shown.size - 1)] || null;
    setHighlight(target ? items.indexOf(target) : -1, items);
    if (!_expectedGone.has(gone) && !_browseWorkspaceSwitching) {
      const what = isFolder(gone) ? 'folder' : 'tab';
      const where = target === prev ? 'the item above' : 'the next item';
      flashBrowseNotice(`The highlighted ${what} was closed or moved — now on ${where}`);
    }
    return false;
  }

  // For key actions: true when the highlighted element is still there. Otherwise the
  // highlight moved (see syncHighlight) and the key does nothing: the user sees what
  // the next press will act on first.
  function highlightStillThere(items = getVisibleItems()) {
    if (syncHighlight(items)) return true;
    updateHighlight();
    updateLeapOverlayState();
    return false;
  }

  // Tabs/folders were added, removed or moved (TabOpen/Close/Move, folder changes,
  // workspace switch): keep drawing the highlight on the same element.
  function refreshBrowseHighlight() {
    if (!browseMode || !leapMode || !highlightedItem) return;
    const items = getVisibleItems();
    if (items.length === 0) return;
    if (syncHighlight(items)) {
      updateLeapOverlayState(); // position ("3/12") may have changed
    } else {
      updateHighlight();
      updateLeapOverlayState();
    }
  }

  function flashBrowseNotice(text) {
    clearTimeout(_browseNotice?.timer);
    _browseNotice = {
      text,
      timer: setTimeout(() => {
        _browseNotice = null;
        if (browseMode) updateLeapOverlayState();
      }, 3000),
    };
    updateLeapOverlayState();
  }

  function clearBrowseNotice() {
    clearTimeout(_browseNotice?.timer);
    _browseNotice = null;
  }

  // Enter browse mode
  function enterBrowseMode(direction) {
    const items = getVisibleItems();
    const current = currentTab();
    const currentIndex = findCurrentItemIndex(items);

    // Evict the active tab's preview from cache — the user was just interacting
    // with it (scrolling, typing, etc.) so any cached snapshot is likely stale.
    previewCache.delete(current);

    if (currentIndex === -1) {
      // Current tab not in visible items (Zen's empty tab in a fresh space or
      // window). Start from the same virtual origin the badges use, so the
      // first j lands on the item numbered 1 and digit jumps match the badges.
      if (items.length === 0) {
        log('Cannot enter browse mode: no visible items');
        return;
      }
      const origin = virtualOriginIndex(items);

      browseMode = true;
      browseDirection = direction;
      originalTabIndex = direction === 'down' ? origin - 1 : origin;
      originalTab = current;
      setHighlight(direction === 'down' ? Math.min(origin, items.length - 1) : Math.max(origin - 1, 0), items);
    } else {
      browseMode = true;
      browseDirection = direction;
      originalTabIndex = currentIndex;
      originalTab = current;

      // Move highlight one step in the initial direction
      setHighlight(direction === 'down' ? Math.min(currentIndex + 1, items.length - 1) : Math.max(currentIndex - 1, 0), items);
    }

    // Clear the timeout - browse mode has no timeout
    clearTimeout(leapModeTimeout);

    updateHighlight();
    updateLeapOverlayState();
    _pluginEventBus.emit('browseMode:enter', { direction });
    log(`Entered browse mode, direction=${direction}, highlight=${highlightedTabIndex}`);
  }

  // Update the visual highlight on the browsed item (tab or folder).
  // When syncSelection is false (the hot j/k path), only the old and new
  // highlighted items are touched — O(1) instead of O(N).
  let _previousHighlightedItem = null;

  function updateHighlight({ syncSelection = true } = {}) {
    const items = getVisibleItems();
    syncHighlight(items);

    if (syncSelection) {
      // Full sync: iterate all items to reconcile selection markers.
      // Needed when selection state changed (shift+move, toggle, clear, etc.)
      // Items that left the list (other workspace, collapsed folder) lose theirs too.
      for (const el of gBrowser.tabContainer.querySelectorAll('[data-zenleap-highlight]')) {
        el.removeAttribute('data-zenleap-highlight');
      }
      items.forEach(item => {
        item.removeAttribute('data-zenleap-highlight');
        if (selectedItems.has(item)) {
          item.setAttribute('data-zenleap-selected', 'true');
        } else {
          item.removeAttribute('data-zenleap-selected');
        }
      });
    } else {
      // Fast path: only remove highlight from the previous item
      if (_previousHighlightedItem) {
        _previousHighlightedItem.removeAttribute('data-zenleap-highlight');
      }
    }

    // Add highlight to the current browsed item
    if (highlightedItem) {
      highlightedItem.setAttribute('data-zenleap-highlight', 'true');
      _previousHighlightedItem = highlightedItem;

      // Scroll the highlighted item into view
      scrollTabToView(highlightedItem, 'center');

      // Trigger preview panel update (debounced by configurable delay)
      // Only show preview for tabs, not folders
      if (S['display.browsePreview'] && browseMode && !isFolder(highlightedItem)) {
        clearTimeout(previewDebounceTimer);
        previewCaptureId++; // Cancel any in-flight capture
        // Hide panel visually but preserve cache — during browse navigation we want
        // to reuse cached thumbnails when revisiting tabs, not recapture each time.
        hidePreviewPanel();
        previewDebounceTimer = setTimeout(() => {
          if (browseMode && highlightedItem && !isFolder(highlightedItem) && getVisibleItems().includes(highlightedItem)) {
            showPreviewForTab(highlightedItem);
          }
        }, S['timing.previewDelay']);
      } else if (isFolder(highlightedItem)) {
        // Hide preview when navigating over a folder (preserve cache for same reason)
        clearTimeout(previewDebounceTimer);
        hidePreviewPanel();
      }
    } else {
      _previousHighlightedItem = null;
    }
  }

  // Clear all highlights and selections
  function clearHighlight() {
    const items = getVisibleItems();
    items.forEach(item => {
      item.removeAttribute('data-zenleap-highlight');
      item.removeAttribute('data-zenleap-selected');
    });
    // Also clean stale highlights on elements that left the visible items list
    // (e.g. a folder-active tab that lost the attribute after tab switch)
    for (const el of gBrowser.tabContainer.querySelectorAll('[data-zenleap-highlight], [data-zenleap-selected]')) {
      el.removeAttribute('data-zenleap-highlight');
      el.removeAttribute('data-zenleap-selected');
    }
    _previousHighlightedItem = null;
    // Dismiss folder delete modal / close confirmation if open
    if (folderDeleteMode) {
      closeFolderDeleteModal();
    }
    if (browseCloseConfirmMode) {
      browseCloseConfirmMode = false;
      browseClosePending = null;
      document.getElementById('zenleap-close-confirm-modal')?.classList.remove('active');
    }
  }

  // Move highlight up or down. Returns false when the highlighted element was gone:
  // the highlight then lands on its neighbour in that direction, which is where the
  // user was heading anyway.
  function moveHighlight(direction) {
    const items = getVisibleItems();
    const stayed = syncHighlight(items, { prefer: direction === 'down' ? 'next' : 'prev' });
    if (stayed) {
      setHighlight(direction === 'down' ? Math.min(highlightedTabIndex + 1, items.length - 1) : Math.max(highlightedTabIndex - 1, 0), items);
    }

    // Fast path: only update old/new highlight items, skip full selection sync
    updateHighlight({ syncSelection: false });
    updateLeapOverlayState();
    log(`Moved highlight ${direction} to ${highlightedTabIndex}`);
    return stayed;
  }

  // Shift+move: expand or contract selection based on direction
  function shiftMoveHighlight(direction) {
    const items = getVisibleItems();
    const prevIndex = items.indexOf(highlightedItem);
    if (!moveHighlight(direction)) return; // it had gone: don't select what the user didn't see
    if (prevIndex >= 0 && highlightedTabIndex !== prevIndex) {
      const prevItem = items[prevIndex];
      const newItem = items[highlightedTabIndex];
      if (selectedItems.has(newItem)) {
        // Contracting: deselect the item we left
        selectedItems.delete(prevItem);
      } else {
        // Expanding: select both old and new position
        selectedItems.add(prevItem);
        selectedItems.add(newItem);
      }
    }
    updateHighlight();
    updateLeapOverlayState();
  }

  // Switch workspace in browse mode (h = prev, l = next)
  let _browseWorkspaceSwitchId = 0;
  async function browseWorkspaceSwitch(direction) {
    try {
      if (!window.gZenWorkspaces) { log('Workspaces not available'); return; }
      const workspaces = window.gZenWorkspaces.getWorkspaces();
      if (!Array.isArray(workspaces) || workspaces.length < 2) { log('Not enough workspaces'); return; }

      const currentId = window.gZenWorkspaces.activeWorkspace;
      const currentIdx = workspaces.findIndex(ws => ws.uuid === currentId);
      if (currentIdx < 0) return;

      let newIdx;
      if (direction === 'prev') {
        newIdx = currentIdx > 0 ? currentIdx - 1 : workspaces.length - 1;
      } else {
        newIdx = currentIdx < workspaces.length - 1 ? currentIdx + 1 : 0;
      }

      const newWorkspace = workspaces[newIdx];
      log(`Browse: switching workspace ${direction} to "${newWorkspace.name || newWorkspace.uuid}"`);

      // Switch workspace — this changes which tabs are visible. The promise
      // settles once Zen finished the switch; re-highlight right away (a
      // delayed reset used to overwrite keys pressed in the meantime).
      const switchId = ++_browseWorkspaceSwitchId;
      _browseWorkspaceSwitching++;
      try {
        await window.gZenWorkspaces.changeWorkspaceWithID(newWorkspace.uuid);
      } finally {
        _browseWorkspaceSwitching--;
      }
      if (switchId !== _browseWorkspaceSwitchId || !browseMode) return;

      // After workspace switch, highlight the active tab in the new workspace
      _visibleItemsCache = null; // Ensure fresh data after workspace switch
      const newItems = getVisibleItems();
      const activeIdx = findCurrentItemIndex(newItems);
      // Fresh space (Zen's empty tab selected): start at the first tab
      setHighlight(activeIdx >= 0 ? activeIdx : Math.min(virtualOriginIndex(newItems), newItems.length - 1), newItems);
      if (newItems.length > 0) {
        updateHighlight();
        updateRelativeNumbers();
        updateLeapOverlayState();
      }
      log(`Browse: workspace switched, ${newItems.length} items visible, highlight=${highlightedTabIndex}`);
    } catch (e) { reportError('Workspace switch failed', e); }
  }

  // Jump directly to the item badged N in the highlight's direction and open it.
  // Counts from the origin the badges use, recomputed from the current list:
  // after h/l the badges belong to the new space (REV-LCORE-04), and after a
  // paste the current tab may have moved.
  function jumpAndOpenTab(distance) {
    const items = getVisibleItems();
    syncHighlight(items);
    const currentIndex = findCurrentItemIndex(items);

    let direction;
    let targetIndex;
    if (currentIndex < 0) {
      // Zen's empty tab is selected: the badges count from a virtual origin
      const origin = virtualOriginIndex(items);
      direction = highlightedTabIndex >= origin ? 'down' : 'up';
      targetIndex = direction === 'down' ? origin - 1 + distance : origin - distance;
    } else {
      if (highlightedTabIndex < currentIndex) {
        direction = 'up';
      } else if (highlightedTabIndex > currentIndex) {
        direction = 'down';
      } else {
        // Highlight is on the current tab (where h/l land): the browse
        // direction decides, unless only the other direction has an item
        // badged `distance`.
        const fits = (dir) => dir === 'down' ? currentIndex + distance < items.length : currentIndex - distance >= 0;
        const other = browseDirection === 'down' ? 'up' : 'down';
        direction = !fits(browseDirection) && fits(other) ? other : browseDirection;
      }
      targetIndex = direction === 'down' ? currentIndex + distance : currentIndex - distance;
    }

    // Clamp to valid range
    targetIndex = Math.max(0, Math.min(items.length - 1, targetIndex));

    if (targetIndex >= 0 && targetIndex < items.length) {
      const target = items[targetIndex];
      if (isFolder(target)) {
        // If jumping lands on a folder, move highlight there and stay in browse mode
        setHighlight(targetIndex, items);
        updateHighlight();
        updateLeapOverlayState();
        log(`Jumped ${direction} ${distance}, highlighted folder "${target.label}"`);
        return;
      }
      gBrowser.selectedTab = target;
      log(`Jumped ${direction} ${distance}, opened tab ${targetIndex}`);
    }

    exitLeapMode(true); // Center scroll on new tab
  }

  // Confirm selection - open the highlighted tab, or toggle folder collapse
  function confirmBrowseSelection() {
    const items = getVisibleItems();
    if (!highlightStillThere(items)) return;

    if (highlightedItem) {
      const item = highlightedItem;
      if (isFolder(item)) {
        // Toggle folder collapse/expand and stay in browse mode
        item.collapsed = !item.collapsed;
        log(`Toggled folder "${item.label}" collapsed=${item.collapsed}`);
        // The visible items change (the folder's tabs); redraw after the DOM settles.
        setTimeout(() => {
          _visibleItemsCache = null; // Invalidate after folder collapse/expand
          updateHighlight();
          updateLeapOverlayState();
          updateRelativeNumbers();
        }, 50);
        return; // Stay in browse mode
      }
      gBrowser.selectedTab = item;
      log(`Confirmed selection: opened tab ${highlightedTabIndex}`);
    }

    exitLeapMode(true); // true = center scroll on new tab
  }

  // Close tabs the way Zen's own close command would: pinned tabs and
  // Essentials follow zen.pinned-tab-manager.close-shortcut-behavior (by
  // default reset + unload rather than close), the rest close as one batch so a
  // single Ctrl+Shift+T restores them (LEAP-B-23). Returns a promise.
  function closeTabsLikeZen(tabs, event) {
    tabs = liveTabs(tabs);
    const pinned = tabs.filter(t => t.pinned);
    const normal = tabs.filter(t => !t.pinned);
    const warn = normal.length > 1 ? gBrowser.closingTabsEnum.MULTI_SELECTED : undefined;
    if (normal.length && !TabOps.close(normal, { warn })) return Promise.resolve(false);
    if (!pinned.length) return Promise.resolve(true);
    if (typeof window.gZenPinnedTabManager?.onCloseTabShortcut === 'function') {
      const evt = event || new KeyboardEvent('keydown');
      return gZenPinnedTabManager.onCloseTabShortcut(evt, pinned).then(() => true, (e) => {
        reportError('Closing pinned tabs failed', e);
        return false;
      });
    }
    gBrowser.removeTabs(pinned);
    return Promise.resolve(true);
  }

  // Re-sync browse mode after the user closed or removed items: a closed highlighted
  // item hands the highlight to the item after it (or before it, if it was the last).
  function refreshBrowseAfterClose() {
    if (!browseMode) return;
    _visibleItemsCache = null;
    const newItems = getVisibleItems();
    if (newItems.length === 0) {
      exitLeapMode(false);
      return;
    }
    updateHighlight();
    updateLeapOverlayState();
  }

  // Close the highlighted tab/folder (or all selected items if any are selected)
  function closeHighlightedTab(event) {
    const items = getVisibleItems();

    // If there are selected items, close all of them (tabs and folders)
    if (selectedItems.size > 0) {
      const itemsToClose = [...selectedItems].filter(t => t && t.isConnected);
      const foldersToClose = itemsToClose.filter(isFolder)
        // a selected subfolder goes away with its selected parent folder
        .filter((f, _, all) => !all.some(other => other !== f && other.contains(f)));
      const tabsToClose = itemsToClose.filter(t => !isFolder(t) && !t.closing &&
        !foldersToClose.some(f => f.contains(t)));
      if (foldersToClose.length > 0) {
        // Deleting folders closes everything inside them: confirm first (LEAP-B-17)
        showBrowseCloseConfirm(tabsToClose, foldersToClose, event);
        return;
      }
      log(`Closing ${tabsToClose.length} selected tabs`);
      selectedItems.clear();
      for (const t of tabsToClose) _expectedGone.add(t);
      syncHighlight(items);
      closeTabsLikeZen(tabsToClose, event).then(() => refreshBrowseAfterClose());
      refreshBrowseAfterClose();
      return;
    }

    // Single item close (no selection)
    if (!highlightStillThere(items)) return;
    if (!highlightedItem) {
      log('No valid item to close');
      return;
    }

    const item = highlightedItem;

    // If it's a folder, show the deletion modal instead
    if (isFolder(item)) {
      showFolderDeleteModal(item);
      return;
    }

    log(`Closing tab at index ${highlightedTabIndex}`);
    _expectedGone.add(item);
    closeTabsLikeZen([item], event).then(() => refreshBrowseAfterClose());
    refreshBrowseAfterClose();
  }

  // --- Confirm step: closing a selection that contains folders ---
  let browseCloseConfirmMode = false;
  let browseClosePending = null; // { tabs, folders, event }

  function showBrowseCloseConfirm(tabs, folders, event) {
    browseCloseConfirmMode = true;
    browseClosePending = { tabs, folders, event };

    const insideCount = folders.reduce((n, f) => n + folderTabCount(f), 0);
    const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

    let modal = document.getElementById('zenleap-close-confirm-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'zenleap-close-confirm-modal';
      modal.className = 'zenleap-confirm-modal';
      document.documentElement.appendChild(modal);
    }
    modal.replaceChildren();

    const backdrop = document.createElement('div');
    backdrop.className = 'zenleap-folder-delete-backdrop';
    backdrop.addEventListener('click', () => closeBrowseCloseConfirm());

    const container = document.createElement('div');
    container.className = 'zenleap-folder-delete-container';

    const title = document.createElement('div');
    title.className = 'zenleap-folder-delete-title';
    const parts = [];
    if (tabs.length) parts.push(`close ${plural(tabs.length, 'tab')}`);
    parts.push(`delete ${plural(folders.length, 'folder')} (${plural(insideCount, 'tab')} inside)`);
    const text = parts.join(' and ');
    title.textContent = `${text[0].toUpperCase()}${text.slice(1)}?`;
    container.appendChild(title);

    const option = (shortcut, label, sublabel, action, destructive) => {
      const el = createDeleteOption(shortcut, label, sublabel, action);
      if (destructive) el.classList.add('destructive');
      return el;
    };
    container.appendChild(option('1', 'Delete folders and everything in them',
      `Closes ${plural(tabs.length + insideCount, 'tab')} in total`, () => confirmBrowseClose(true), true));
    container.appendChild(option('2', 'Delete folders but keep their tabs',
      `Closes ${plural(tabs.length, 'selected tab')}; folder tabs stay open`, () => confirmBrowseClose(false), false));
    container.appendChild(option('Esc', 'Cancel', 'Nothing is closed', () => closeBrowseCloseConfirm(), false));

    modal.appendChild(backdrop);
    modal.appendChild(container);
    modal.classList.add('active');
    log(`Confirm closing ${tabs.length} tabs + ${folders.length} folders`);
  }

  function closeBrowseCloseConfirm() {
    browseCloseConfirmMode = false;
    browseClosePending = null;
    document.getElementById('zenleap-close-confirm-modal')?.classList.remove('active');
    if (browseMode) updateHighlight();
  }

  // Enter/Space/Escape cancel: the default is always the non-destructive choice.
  function handleBrowseCloseConfirmKey(event) {
    if (event.repeat) return;
    const digit = digitFor(event);
    if (digit === '1') confirmBrowseClose(true);
    else if (digit === '2') confirmBrowseClose(false);
    else if (event.key === 'Escape' || event.key === 'Enter' || event.key === ' ') closeBrowseCloseConfirm();
  }

  async function confirmBrowseClose(withContents) {
    const pending = browseClosePending;
    closeBrowseCloseConfirm();
    if (!pending) return;
    const { tabs, folders, event } = pending;
    selectedItems.clear();
    for (const item of [...tabs, ...folders]) _expectedGone.add(item);
    syncHighlight();
    // Same helpers as the folder-delete modal and palette: they record an undo
    // snapshot, so the undo shortcut rebuilds the real Zen folder (subfolders,
    // position, space) instead of reopening a plain tab group.
    for (const folder of folders) {
      if (!folder.isConnected) continue;
      try {
        await (withContents ? deleteFolderWithTabs(folder) : dissolveFolder(folder));
      } catch (e) {
        reportError(`Deleting folder "${folderName(folder)}" failed`, e);
      }
    }
    await closeTabsLikeZen(tabs, event);
    refreshBrowseAfterClose();
  }

  // Toggle selection on the highlighted item (tab or folder)
  function toggleItemSelection() {
    const items = getVisibleItems();
    if (!highlightStillThere(items) || !highlightedItem) return;

    const item = highlightedItem;
    if (selectedItems.has(item)) {
      selectedItems.delete(item);
      log(`Deselected item at index ${highlightedTabIndex}`);
    } else {
      selectedItems.add(item);
      log(`Selected item at index ${highlightedTabIndex} (${selectedItems.size} total)`);
    }

    updateHighlight();
    updateLeapOverlayState();
  }

  // Yank selected items (tabs and/or folders) into buffer
  function yankSelectedItems() {
    // If nothing explicitly selected, yank the highlighted item (tab or folder)
    if (selectedItems.size === 0) {
      if (!highlightStillThere()) return;
      if (highlightedItem) selectedItems.add(highlightedItem);
    }

    if (selectedItems.size === 0) {
      log('No items selected to yank');
      return;
    }

    // Deduplicate: remove individual tabs whose parent folder is also selected
    // (they will move with their folder automatically)
    // (tabs and subfolders anywhere inside a selected folder, split groups included)
    const selectedFolders = [...selectedItems].filter(isFolder);
    for (const item of [...selectedItems]) {
      if (selectedFolders.some(f => f !== item && f.contains(item))) {
        selectedItems.delete(item);
      }
    }

    // Store references in DOM order (tabs and folders)
    const items = getVisibleItems();
    yankItems = items.filter(t => selectedItems.has(t));
    const count = yankItems.length;

    // Clear selection visuals
    selectedItems.clear();

    updateHighlight();
    updateLeapOverlayState();
    log(`Yanked ${count} items`);
  }

  // Paste yanked items (tabs and/or folders) after or before the highlighted item
  // Handles cross-pinned/unpinned, cross-folder, and cross-workspace moves
  // Folders nest into the anchor's folder when anchor is a tab inside a folder (with depth/circular guards);
  // if anchor is a tab in a folder, loose tabs join that folder; if anchor is a folder, they stay loose.
  // Every move goes through gBrowser.moveTabBefore/After (which accept zen-folder
  // elements) or gBrowser.zenHandleTabMove, so TabMove/TabGroupMoved fire and the
  // tab caches, SessionStore and window sync stay consistent (LEAP-B-04).
  function pasteItems(position) {
    if (yankItems.length === 0) {
      log('No items in yank buffer');
      return;
    }

    if (!highlightStillThere() || !highlightedItem) return;

    const anchorItem = highlightedItem;

    // Filter out closed/removed items
    yankItems = yankItems.filter(item => {
      if (isFolder(item)) return item.isConnected;
      return item && !item.closing && item.isConnected;
    });
    if (yankItems.length === 0) {
      log('All yanked items have been closed');
      return;
    }

    // Determine anchor context
    const anchorIsFolder = isFolder(anchorItem);
    const anchorTab = anchorIsFolder ? null : anchorItem;
    const anchorFolder = anchorIsFolder ? null : parentFolderOf(anchorItem);
    const anchorPinned = anchorIsFolder ? false : anchorItem.pinned;
    const anchorWorkspaceId = anchorItem.getAttribute('zen-workspace-id') || window.gZenWorkspaces?.activeWorkspace;

    const movedToOtherSpace = [];

    // Separate yanked items into folders and loose tabs
    const yankFolders = yankItems.filter(isFolder);
    const yankLooseTabs = yankItems.filter(item => !isFolder(item));

    log(`Paste: position=${position}, anchor="${anchorItem.label}", folders=${yankFolders.length}, tabs=${yankLooseTabs.length}`);

    // Chain moves so multiple items keep their order: the first goes
    // before/after the anchor, each next one after the previously placed item.
    const placeChain = (elements, anchor) => {
      if (!elements.length) return;
      if (position === 'after') gBrowser.moveTabAfter(elements[0], anchor);
      else gBrowser.moveTabBefore(elements[0], anchor);
      for (let i = 1; i < elements.length; i++) gBrowser.moveTabAfter(elements[i], elements[i - 1]);
    };

    // --- Phase 1: Move loose tabs ---
    for (const tab of yankLooseTabs) {
      // 1a. Cross-workspace
      if (window.gZenWorkspaces) {
        const tabWsId = tab.getAttribute('zen-workspace-id') || window.gZenWorkspaces.activeWorkspace;
        if (tabWsId !== anchorWorkspaceId) {
          window.gZenWorkspaces.moveTabToWorkspace(tab, anchorWorkspaceId);
          movedToOtherSpace.push(tab);
          log(`  Moved tab "${tab.label}" to workspace ${anchorWorkspaceId}`);
        }
      }

      // 1b. Remove from old folder if needed
      const tabFolder = parentFolderOf(tab);
      if (tabFolder && tabFolder !== anchorFolder) {
        try { gBrowser.ungroupTab(tab); } catch(e) { reportError('Removing tab from folder failed', e); }
      }

      // 1c. Match pinned state (only when anchor is a tab)
      if (!anchorIsFolder) {
        if (anchorPinned && !tab.pinned) {
          gBrowser.pinTab(tab);
        } else if (!anchorPinned && !anchorFolder && tab.pinned) {
          gBrowser.unpinTab(tab);
        }
      }
    }

    // Position loose tabs
    if (yankLooseTabs.length > 0) {
      try {
        // Relative to a folder they stay loose siblings of the folder (Zen moves
        // unpinned tabs to the top of the unpinned section instead).
        placeChain(yankLooseTabs, anchorItem);

        // Add loose tabs to anchor's folder if anchor is a tab inside a folder
        if (!anchorIsFolder && anchorFolder) {
          const tabsToAdd = yankLooseTabs.filter(t => parentFolderOf(t) !== anchorFolder);
          if (tabsToAdd.length > 0) {
            for (const t of tabsToAdd) { if (!t.pinned) gBrowser.pinTab(t); }
            anchorFolder.addTabs(tabsToAdd);
            log(`  Added ${tabsToAdd.length} tabs to folder "${anchorFolder.label}"`);
          }
        }
      } catch (e) {
        reportError('Pasting tabs failed', e);
      }
    }

    // --- Phase 2: Move folders ---
    // Folders live in the pinned section (or inside another folder), which
    // gBrowser.moveTabBefore/After enforce for zen-folder elements.
    let folderAfterRef = null;
    for (const folder of yankFolders) {
      // A folder can't go next to (or into) something inside itself; every
      // fallback position would be inside it too (HierarchyRequestError).
      if (folder.contains(anchorItem)) {
        log(`  Cannot paste folder "${folder.label}" inside itself — skipped`);
        continue;
      }

      // 2a. Cross-workspace: update workspace IDs on folder and all its tabs
      const folderWsId = folder.getAttribute('zen-workspace-id');
      if (folderWsId && folderWsId !== anchorWorkspaceId && window.gZenFolders) {
        try {
          // hasDndSwitch: true means only update IDs, don't auto-reposition or switch workspace
          gZenFolders.changeFolderToSpace(folder, anchorWorkspaceId, { hasDndSwitch: true });
          movedToOtherSpace.push(...(folder.tabs || []));
          log(`  Moved folder "${folder.label}" to workspace ${anchorWorkspaceId}`);
        } catch(e) { reportError('Moving folder to workspace failed', e); }
      }

      // 2b. Position folder based on anchor type:
      //   - Anchor is a folder: place as sibling before/after it
      //   - Anchor is a tab inside a folder: nest into that folder (before/after the tab)
      //   - Anchor is a pinned loose tab: place as sibling
      //   - Anchor is an unpinned loose tab: end of the pinned section
      let ref;
      if (anchorIsFolder) {
        ref = anchorItem;
      } else if (anchorFolder) {
        // (Circular nesting is excluded above: the anchor is outside `folder`.)
        let canNest = true;
        // Guard: max nesting depth. Check it here: moveTabBefore/After would
        // otherwise move the folder's *parent* when the drop is not allowed.
        if (window.gZenFolders?.canDropElement && !gZenFolders.canDropElement(folder, anchorTab)) {
          canNest = false;
          log(`  Cannot nest folder "${folder.label}" — max nesting depth reached — placing as sibling`);
        }
        ref = canNest ? anchorTab : anchorFolder;
        if (canNest) log(`  Nesting folder "${folder.label}" inside "${anchorFolder.label}"`);
      } else if (anchorTab && anchorTab.pinned) {
        ref = anchorTab;
      } else {
        ref = null;
      }

      try {
        if (ref) {
          if (position === 'after') {
            gBrowser.moveTabAfter(folder, folderAfterRef || ref);
            folderAfterRef = folder;
          } else {
            gBrowser.moveTabBefore(folder, ref);
          }
        } else {
          // Anchor is an unpinned tab: put the folder at the end of the pinned
          // section, just above the separator (moveTabBefore would re-target a
          // folder dropped next to an unpinned tab onto the last pinned tab,
          // which may be inside another folder).
          const wsEl = window.gZenWorkspaces?.workspaceElement(anchorWorkspaceId);
          const pinnedContainer = wsEl?.pinnedTabsContainer;
          const separator = pinnedContainer?.querySelector(':scope > .pinned-tabs-container-separator');
          if (!pinnedContainer) throw new Error('pinned section not found');
          gBrowser.zenHandleTabMove(folder, () => {
            if (separator) separator.before(folder);
            else pinnedContainer.appendChild(folder);
          });
        }
      } catch (e) {
        reportError(`Pasting folder "${folder.label}" failed`, e);
      }
    }

    log(`Pasted ${yankLooseTabs.length} tabs + ${yankFolders.length} folders ${position} anchor`);
    noteMovedIntoAgentSpace(movedToOtherSpace, anchorWorkspaceId);

    // Clear yank buffer
    yankItems = [];

    // Refresh visible items and update display
    _visibleItemsCache = null;
    updateRelativeNumbers();
    updateHighlight();
    updateLeapOverlayState();
  }

  // Save browse mode state for transition to command bar
  function saveBrowseState() {
    return {
      highlightedItem, highlightedTabIndex, highlightSnapshot: _highlightSnapshot, originalTabIndex, originalTab,
      browseDirection, selectedItems: new Set(selectedItems),
      yankItems: [...yankItems], sidebarWasExpanded
    };
  }

  // Restore browse mode state after returning from command bar
  function restoreBrowseState(state) {
    leapMode = true;
    browseMode = true;
    highlightedItem = state.highlightedItem;
    highlightedTabIndex = state.highlightedTabIndex;
    _highlightSnapshot = state.highlightSnapshot || [];
    originalTabIndex = state.originalTabIndex;
    originalTab = state.originalTab;
    browseDirection = state.browseDirection;
    selectedItems = new Set(state.selectedItems);
    yankItems = [...state.yankItems];
    sidebarWasExpanded = state.sidebarWasExpanded;
  }

  // Cancel browse mode - return to original tab
  function cancelBrowseMode() {
    // Use the direct tab reference to return to the original tab,
    // since tab indices may have shifted after yank/paste operations
    if (originalTab && !originalTab.closing && originalTab.parentNode) {
      // (originalTab may be a Glance's parent: don't reselect it, that would close the Glance)
      if (originalTab !== currentTab()) gBrowser.selectedTab = originalTab;
      log(`Cancelled, returned to original tab "${originalTab.label}"`);
    } else {
      // Fallback to index if the tab reference is gone
      const items = getVisibleItems();
      if (originalTabIndex >= 0 && originalTabIndex < items.length) {
        const fallback = items[originalTabIndex];
        if (!isFolder(fallback)) {
          gBrowser.selectedTab = fallback;
        }
        log(`Cancelled, returned to original item by index ${originalTabIndex}`);
      }
    }

    exitLeapMode(true); // Center scroll on original tab
  }

  // Exit leap mode. restoreFocus=false when focus already moved somewhere on
  // purpose (the user clicked into the URL bar, find bar, ...).
  function exitLeapMode(centerScroll = false, { restoreFocus = true } = {}) {
    disarmModeGuards('leap');
    clearHighlight();
    hidePreviewPanel(true);

    // Hide sidebar if we expanded it on entry
    if (sidebarWasExpanded) {
      // Small delay to let the user see their selection before hiding
      setTimeout(() => {
        hideFloatingSidebar();
        log('Hid sidebar on leap mode exit');
      }, 100);
    }
    sidebarWasExpanded = false;

    leapMode = false;
    browseMode = false;
    zMode = false;
    gMode = false;
    markMode = false;
    gotoMarkMode = false;
    gNumberBuffer = '';
    clearTimeout(gNumberTimeout);
    setHighlight(-1, []);
    _expectedGone = new WeakSet();
    clearBrowseNotice();
    originalTabIndex = -1;
    originalTab = null;
    browseDirection = null;
    browseGPending = false;
    clearTimeout(browseGTimeout);
    browseGTimeout = null;
    browseNumberBuffer = '';
    clearTimeout(browseNumberTimeout);
    browseNumberTimeout = null;
    selectedItems.clear();
    yankItems = [];

    // Hide relative numbers if in "active" mode (leap/browse only)
    if (S['display.showRelativeNumbers'] === 'active') updateRelativeNumbers();

    // Reset folder delete modal state
    folderDeleteMode = false;
    folderDeleteTarget = null;
    if (folderDeleteModal) {
      folderDeleteModal.classList.remove('active');
    }

    clearTimeout(leapModeTimeout);
    document.documentElement.removeAttribute('data-zenleap-active');
    document.documentElement.removeAttribute('data-zenleap-mark-mode');
    hideLeapOverlay();

    if (centerScroll) {
      // Small delay to let tab selection settle
      setTimeout(() => scrollTabIntoView('center'), 50);
    }

    // Restore focus so keyboard input resumes where it was (usually the page)
    restoreFocusToContent(restoreFocus);

    _pluginEventBus.emit('leapMode:exit', {});
    log('Exited leap mode');
  }

  // Go to absolute tab position (1-indexed)
  function goToAbsoluteTab(tabNumber) {
    const items = getVisibleItems();
    if (items.length === 0) return;

    // tabNumber is 1-indexed, convert to 0-indexed
    const targetIndex = Math.max(0, Math.min(items.length - 1, tabNumber - 1));
    const target = items[targetIndex];
    if (isFolder(target)) {
      // Jump to folder: enter browse mode with highlight on the folder
      if (!browseMode) {
        browseMode = true;
        browseDirection = 'down';
        originalTabIndex = findCurrentItemIndex(items);
        if (originalTabIndex === -1) originalTabIndex = 0;
        originalTab = currentTab();
        clearTimeout(leapModeTimeout);
      }
      setHighlight(targetIndex, items);
      updateHighlight();
      updateLeapOverlayState();
      updateRelativeNumbers();
      log(`Jumped to folder at position ${tabNumber}`);
    } else {
      gBrowser.selectedTab = target;
      log(`Jumped to absolute tab ${tabNumber} (index ${targetIndex})`);
      exitLeapMode(true);
    }
  }

  // Find scrollable tab container by walking up from a starting element.
  // Tries the target tab first (so scroll math matches the element being scrolled to),
  // then falls back to gBrowser.selectedTab (for targets outside the scroll container,
  // e.g. essential tabs in the fixed #zen-essentials area).
  function findScrollableTabContainer(tab) {
    const candidates = [];
    if (tab) candidates.push(tab);
    const selectedTab = gBrowser.selectedTab;
    if (selectedTab && selectedTab !== tab) candidates.push(selectedTab);

    for (const startTab of candidates) {
      let element = startTab.parentElement;
      let depth = 0;
      const maxDepth = 15;

      while (element && depth < maxDepth) {
        if (element.scrollbox && element.scrollbox.scrollHeight > element.scrollbox.clientHeight) {
          // Unwrap: if .scrollbox is an arrowscrollbox (e.g. pinned section's .scrollbox
          // points to the arrowscrollbox element), get its inner scrollbox part instead
          const target = element.scrollbox;
          return target.scrollbox || target;
        }

        const hasOverflowContent = element.scrollHeight > element.clientHeight;
        if (hasOverflowContent) {
          const style = window.getComputedStyle(element);
          const canScroll = style.overflowY === 'auto' || style.overflowY === 'scroll';
          const isScrollbox = element.tagName?.toLowerCase() === 'scrollbox' ||
                              element.tagName?.toLowerCase() === 'arrowscrollbox';

          if (canScroll || isScrollbox) {
            return element;
          }
        }

        element = element.parentElement;
        depth++;
      }
    }

    const selectors = ['#tabbrowser-arrowscrollbox', 'arrowscrollbox', '#tabbrowser-tabs'];
    for (const selector of selectors) {
      const el = document.querySelector(selector);
      if (el?.scrollbox?.scrollHeight > el?.scrollbox?.clientHeight) {
        const target = el.scrollbox;
        return target.scrollbox || target;
      }
      if (el?.scrollHeight > el?.clientHeight) {
        return el;
      }
    }

    return null;
  }

  // Scroll a specific tab into view
  function scrollTabToView(tab, position) {
    if (!tab) return;

    const scrollContainer = findScrollableTabContainer(tab);
    if (!scrollContainer) {
      const block = position === 'center' ? 'center' : (position === 'top' ? 'start' : 'end');
      tab.scrollIntoView({ behavior: 'smooth', block: block });
      return;
    }

    const containerRect = scrollContainer.getBoundingClientRect();
    const tabRect = tab.getBoundingClientRect();
    const currentScrollTop = scrollContainer.scrollTop;

    const tabTopInContainer = tabRect.top - containerRect.top + currentScrollTop;
    const tabBottomInContainer = tabTopInContainer + tabRect.height;
    const tabCenterInContainer = tabTopInContainer + tabRect.height / 2;

    const viewHeight = containerRect.height;
    const maxScroll = Math.max(0, scrollContainer.scrollHeight - viewHeight);

    if (maxScroll <= 0) return;

    let targetScroll;
    const padding = 10;

    if (position === 'center') {
      targetScroll = tabCenterInContainer - viewHeight / 2;
    } else if (position === 'top') {
      targetScroll = tabTopInContainer - padding;
    } else if (position === 'bottom') {
      targetScroll = tabBottomInContainer - viewHeight + padding;
    }

    targetScroll = Math.max(0, Math.min(maxScroll, targetScroll));

    if (Math.abs(targetScroll - currentScrollTop) < 2) return;

    scrollContainer.scrollTo({ top: targetScroll, behavior: 'smooth' });
  }

  // Scroll current tab into view
  function scrollTabIntoView(position) {
    const tab = currentTab();
    if (tab) {
      scrollTabToView(tab, position);
      log(`Scrolled ${position}`);
    }
  }

  // ============================================
  // KEYBOARD HELPERS
  // ============================================

  function consumeEvent(event) {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
  }

  // Keys that never trigger anything on their own.
  const NON_ACTION_KEYS = new Set([...MODIFIER_KEYS, 'AltGraph', 'OS', 'Fn', 'FnLock', 'Hyper', 'Super', 'Symbol', 'SymbolLock', 'NumLock', 'ScrollLock']);

  // US-layout characters (unshifted, shifted) of the punctuation keys.
  const US_PUNCTUATION_KEYS = {
    Quote: ["'", '"'], Backquote: ['`', '~'], Slash: ['/', '?'], Semicolon: [';', ':'],
    Comma: [',', '<'], Period: ['.', '>'], BracketLeft: ['[', '{'], BracketRight: [']', '}'],
    Backslash: ['\\', '|'], Minus: ['-', '_'], Equal: ['=', '+'],
  };

  // A letter of a non-Latin script (Cyrillic, Greek, Hebrew, Arabic, ...) or
  // a non-ASCII digit (Persian ۱): what a layout without Latin letters types.
  const NON_LATIN_CHAR_RE = /^(?:(?!\p{Script=Latin})\p{L}|(?![0-9])\p{Nd})$/u;

  // The key a single-key binding is compared against. Layout-aware, like
  // Vim's langmap: on non-Latin layouts (Cyrillic, Greek, ...) letters, digits
  // and the letters on punctuation keys (Russian э on the ' key, ё on `) fall
  // back to the physical key's US character; ASCII characters those layouts
  // type are kept (Russian ? is Shift+7). A dead-key apostrophe/backtick
  // (US-International) still counts as ' and `. Latin layouts keep their own
  // characters (AZERTY 'a' = a, é is not 2).
  function navKey(event) {
    const k = event.key;
    const code = event.code || '';
    if (k === 'Dead' && !event.shiftKey) {
      if (code === 'Quote') return "'";
      if (code === 'Backquote') return '`';
    }
    if (NON_LATIN_CHAR_RE.test(k)) {
      if (/^Key[A-Z]$/.test(code)) return event.shiftKey ? code.slice(3) : code.slice(3).toLowerCase();
      const digit = /^(?:Digit|Numpad)(\d)$/.exec(code);
      if (digit) return digit[1];
      const us = US_PUNCTUATION_KEYS[code];
      if (us) return us[event.shiftKey ? 1 : 0];
    }
    return k;
  }

  // Does `event` press the single-key setting `settingId`? Case-sensitive
  // settings (G, M, P, ?) must match exactly; the others ignore case, so
  // Shift+J still counts as j (it extends the selection in browse mode).
  // The raw key counts too: bindings saved before the layout fallback existed
  // hold the layout's own character (о for j on a Russian layout).
  function keyMatches(event, settingId) {
    const bound = S[settingId];
    if (typeof bound !== 'string' || bound === '') return false;
    const k = navKey(event), raw = event.key;
    if (SETTINGS_SCHEMA[settingId]?.caseSensitive) return k === bound || raw === bound;
    const b = bound.toLowerCase();
    return k.toLowerCase() === b || raw.toLowerCase() === b;
  }

  function keyMatchesAny(event, ...settingIds) {
    return settingIds.some(id => keyMatches(event, id));
  }

  // Mark names are single letters/digits. Named keys (ArrowDown, Tab, F5, ...)
  // must never become marks.
  function markCharFor(event) {
    const k = navKey(event);
    return /^[a-z0-9]$/i.test(k) ? k.toLowerCase() : null;
  }

  function digitFor(event) {
    const k = navKey(event);
    return /^[0-9]$/.test(k) ? k : null;
  }

  // Whether the last (non-repeat) undo-folder-delete press undid something.
  let _undoChordHandled = false;

  // Global trigger combos (keys.global.*), in the order they are checked.
  const GLOBAL_COMBO_IDS = Object.keys(SETTINGS_SCHEMA).filter(id => SETTINGS_SCHEMA[id].type === 'combo');
  // Holding these chords may auto-repeat (tab/pane navigation); every other
  // trigger toggles a mode and must ignore auto-repeat.
  const REPEATABLE_COMBOS = new Set(['keys.global.splitFocusDown', 'keys.global.splitFocusUp']);

  function matchedGlobalCombo(event) {
    for (const id of GLOBAL_COMBO_IDS) {
      if (matchCombo(event, S[id])) return id;
    }
    return null;
  }

  // True when keyboard focus is somewhere the user types or interacts:
  // web content, the URL bar, the find bar or any editable chrome field.
  function isTypingContext() {
    const fe = document.commandDispatcher?.focusedElement || document.activeElement;
    if (!fe || fe === document.documentElement || fe === document.body) return false;
    if (fe.localName === 'browser' || fe.localName === 'iframe') return true;
    if (fe.isContentEditable) return true;
    return !!fe.closest?.('input, textarea, [contenteditable="true"], #urlbar, findbar');
  }

  // Any ZenLeap mode or overlay that owns the keyboard right now.
  function isAnyZenLeapModeActive() {
    return leapMode || browseMode || searchMode || helpMode || reorgMode || folderDeleteMode ||
      gtileMode || settingsMode || updateMode || _pluginManagerMode || browseCloseConfirmMode;
  }

  // Sub-modes (g, z, mark, goto-mark) get a generous timeout instead of none,
  // so a forgotten half-typed command can't linger indefinitely.
  const LEAP_SUBMODE_TIMEOUT_MS = 60000;

  function armLeapTimeout(ms = CONFIG.leapModeTimeout) {
    clearTimeout(leapModeTimeout);
    leapModeTimeout = setTimeout(() => {
      if (leapMode && !browseMode) {
        log('Leap mode timed out');
        exitLeapMode();
      }
    }, ms);
  }

  // gTile needs an active split view with at least two panes.
  function gtileCanOpen() {
    return (activeSplitView()?.tabs?.length ?? 0) >= 2;
  }

  // Escape that closes a <select> dropdown (Firefox's #ContentSelectDropdown,
  // used for chrome documents too) hides it before the keydown reaches the
  // DOM, in the same task: remember that until the task ends.
  let _selectPopupJustClosed = false;

  function onPopupHiding(event) {
    if (event.target?.id !== 'ContentSelectDropdownPopup') return;
    _selectPopupJustClosed = true;
    setTimeout(() => { _selectPopupJustClosed = false; }, 0);
  }

  // Key events that belong to a window-/tab-modal dialog (prompt(), close-tabs
  // warning, ...) hosted in a sub-document of this window. ZenLeap must never
  // swallow Enter/Escape meant for those.
  function isEventForDialog(event) {
    const doc = event.target?.ownerDocument;
    if (!doc || doc === document) return false;
    const frame = doc.defaultView?.browsingContext?.embedderElement;
    return !!frame && (frame.classList?.contains('dialogFrame') ||
      !!frame.closest?.('.dialogBox, .dialogOverlay, #window-modal-dialog, dialog'));
  }

  // ============================================
  // MODE EXIT GUARDS + FOCUS RESTORE
  // ============================================

  // While a keyboard mode or overlay is open, a click outside ZenLeap's UI, the
  // window losing focus, or focus moving into an editable field (URL bar, find
  // bar, ...) ends it. Otherwise text typed after clicking into a page would
  // still run ZenLeap commands (typing "fox" closed a tab: LEAP-B-02).
  const _modeGuards = new Map(); // mode name -> AbortController

  function isEditableChromeElement(el) {
    if (!el || el.localName === 'browser') return false;
    return !!(el.isContentEditable || el.closest?.('input, textarea, #urlbar, findbar'));
  }

  // Popups (select dropdowns, context menus, tooltips) live outside the overlay
  // but belong to it.
  const GUARD_IGNORE_SELECTOR = 'menupopup, panel, tooltip, #ContentSelectDropdown';

  function armModeGuards(name, onExit, { inside = '', exitOnDeactivate = true } = {}) {
    disarmModeGuards(name);
    const ac = new AbortController();
    _modeGuards.set(name, ac);
    const opts = { capture: true, signal: ac.signal };
    const isInside = (el) => !!(el?.closest?.(GUARD_IGNORE_SELECTOR) || (inside && el?.closest?.(inside)));
    // Window-/tab-modal dialogs (Firefox's "close N tabs?" prompt, prompt())
    // are sub-documents: their clicks and focus are not click-away.
    const isAway = (e) => !isInside(e.target) && !isEventForDialog(e);
    const exit = (reason) => {
      if (!_modeGuards.has(name) || _modeGuards.get(name) !== ac) return;
      disarmModeGuards(name);
      try { onExit(reason); } catch (e) { reportError(`Leaving ${name} mode failed`, e); }
    };
    window.addEventListener('mousedown', (e) => {
      if (isAway(e)) exit('click');
    }, opts);
    window.addEventListener('focusin', (e) => {
      if (isAway(e) && isEditableChromeElement(e.target)) exit('focus');
    }, opts);
    if (exitOnDeactivate) {
      window.addEventListener('deactivate', () => exit('deactivate'), opts);
    }
  }

  function disarmModeGuards(name) {
    _modeGuards.get(name)?.abort();
    _modeGuards.delete(name);
  }

  function disarmAllModeGuards() {
    for (const ac of _modeGuards.values()) ac.abort();
    _modeGuards.clear();
  }

  function armLeapGuards() {
    armModeGuards('leap', (reason) => exitLeapMode(false, { restoreFocus: reason !== 'focus' }), {
      inside: '#zenleap-folder-delete-modal, #zenleap-close-confirm-modal, #zenleap-preview-panel',
    });
  }

  // Focus to return to when a mode/overlay closes: the element that had it
  // before (URL bar, find bar, ...) unless the selected tab changed meanwhile;
  // then the new page gets it (LEAP-B-26).
  function captureFocusTarget() {
    let el = null;
    try { el = document.commandDispatcher?.focusedElement || null; } catch (e) { /* ignore */ }
    if (el?.closest?.('[id^="zenleap-"]')) el = null;
    return { el, tab: gBrowser.selectedTab };
  }

  function restoreFocusTarget(saved) {
    try {
      const el = saved?.el;
      if (el && el.isConnected && el.localName !== 'browser' && saved.tab === gBrowser.selectedTab) {
        el.focus();
        return;
      }
      gBrowser.selectedBrowser.focus();
    } catch (e) { /* window closing */ }
  }

  // Overlays (help, reorganize, settings, search) remember where focus was.
  let _overlayFocus = null;

  function restoreOverlayFocus(restore = true) {
    const saved = _overlayFocus;
    _overlayFocus = null;
    if (restore && S['display.refocusOnClose']) restoreFocusTarget(saved);
  }

  // Handle keydown events
  function handleKeyDown(event) {
    // Keys consumed by an input method (composition) belong to the IME.
    if (event.isComposing || event.keyCode === 229) return;
    // Keys typed into a prompt/dialog belong to it.
    if (isEventForDialog(event)) return;

    // Ignore modifier keys pressed alone
    if (NON_ACTION_KEYS.has(event.key)) {
      return;
    }

    // Handle plugin manager mode - Escape to close
    if (_pluginManagerMode) {
      if (event.key === 'Escape') {
        consumeEvent(event);
        if (_pluginManagerView === 'detail') {
          _pluginManagerView = 'list';
          _pluginManagerDetailId = null;
          renderPluginManagerContent();
        } else {
          exitPluginManagerMode();
        }
      }
      return;
    }

    // Handle settings mode - Escape to close, Enter to update from About tab
    if (settingsMode) {
      // Escape that just closed a <select> dropdown was the dropdown's
      if (event.key === 'Escape' && !settingsRecordingId && !_selectPopupJustClosed) {
        consumeEvent(event);
        // Dismiss import confirmation first if open, otherwise close settings
        if (document.getElementById('zenleap-import-overlay')) {
          dismissImportConfirmation();
        } else {
          exitSettingsMode();
        }
      } else if (event.key === 'Enter' && settingsActiveTab === 'About' && aboutUpdateState === 'available' && !isSineManaged) {
        consumeEvent(event);
        exitSettingsMode();
        enterUpdateMode();
      }
      return;
    }

    // Handle update mode - Escape to close, Enter for primary action
    if (updateMode) {
      consumeEvent(event);
      if (event.key === 'Escape') {
        exitUpdateMode();
      } else if (event.key === 'Enter') {
        if (updateModalState === 'available') {
          if (isSineManaged) exitUpdateMode(); else performUpdate();
        }
        else if (updateModalState === 'success') {
          try { Services.startup.quit(Services.startup.eAttemptQuit | Services.startup.eRestart); } catch(e) { log(`Restart failed: ${e}`); }
        }
        else if (updateModalState === 'error') {
          if (isSineManaged) exitUpdateMode(); else performUpdate(); // retry
        }
        else if (updateModalState === 'uptodate') exitUpdateMode();
      }
      return;
    }

    // Update toast - Enter opens the update flow, Escape dismisses. Only when
    // nothing else wants these keys: no ZenLeap overlay, and focus is not in
    // web content, the URL bar, the find bar or any other editable field.
    if (updateToast && !event.repeat && !isAnyZenLeapModeActive() && !isTypingContext() &&
        !event.ctrlKey && !event.altKey && !event.metaKey && !event.shiftKey) {
      if (event.key === 'Enter') {
        consumeEvent(event);
        dismissUpdateToast(false);
        enterUpdateMode();
        return;
      } else if (event.key === 'Escape') {
        consumeEvent(event);
        dismissUpdateToast(true);
        return;
      }
    }

    // Handle reorganize workspaces mode
    if (reorgMode) {
      handleReorgKeyDown(event);
      return;
    }

    // Handle help mode - j/k scroll, Escape or help key to close
    if (helpMode) {
      consumeEvent(event);
      if (event.key === 'Escape' || keyMatches(event, 'keys.leap.help')) {
        exitHelpMode();
        return;
      }
      // j/k/arrows scroll the help content
      const scrollEl = helpModal?.querySelector('.zenleap-help-content');
      if (scrollEl) {
        const k = navKey(event);
        if (k === 'j' || k === 'ArrowDown') { scrollEl.scrollBy({ top: 80, behavior: 'smooth' }); return; }
        if (k === 'k' || k === 'ArrowUp') { scrollEl.scrollBy({ top: -80, behavior: 'smooth' }); return; }
        if (k === 'G') { scrollEl.scrollTo({ top: scrollEl.scrollHeight, behavior: 'smooth' }); return; }
        if (k === 'g') { scrollEl.scrollTo({ top: 0, behavior: 'smooth' }); return; }
      }
      return;
    }

    // Confirm step for closing a browse-mode selection that includes folders
    if (browseCloseConfirmMode) {
      consumeEvent(event);
      handleBrowseCloseConfirmKey(event);
      return;
    }

    // Handle folder delete modal
    if (folderDeleteMode) {
      consumeEvent(event);
      if (event.key === 'Escape') {
        closeFolderDeleteModal();
        return;
      }
      if (event.repeat) return;
      const digit = digitFor(event);
      if (digit === '1') {
        deleteFolderAndContents(folderDeleteTarget);
        return;
      }
      if (digit === '2') {
        deleteFolderKeepTabs(folderDeleteTarget);
        return;
      }
      return; // Swallow all other keys while modal is open
    }

    // Handle gTile mode
    if (gtileMode) {
      consumeEvent(event);
      handleGtileKeyDown(event);
      return;
    }

    // Handle URL bar vim mode (Cmd+L / Cmd+T native browser bar).
    // Key interception happens at the input level (urlbarInputKeyHandler) because
    // window-level preventDefault cannot stop moz-urlbar's internal editor.
    // This block only blocks other ZenLeap handlers while the URL bar is in
    // NORMAL mode.
    if (!searchMode && !leapMode) {
      try {
        const _gURLBarFocused = typeof gURLBar !== 'undefined' && gURLBar && gURLBar.focused;
        if (_gURLBarFocused) {
          if (!urlbarVimSetupDone) lazySetupUrlbarVim();
          if (isUrlbarVimEnabled() && urlbarVimActive && urlbarVimMode === 'normal') return;
        }
      } catch (_e) { /* ignore */ }
    }

    // Handle search mode input first
    if (searchMode) {
      if (handleSearchKeyDown(event)) {
        return;
      }
      // Let unhandled keys (insert mode typing) pass through to input
      return;
    }

    // Global trigger combos
    const comboId = matchedGlobalCombo(event);
    if (comboId && event.repeat && !REPEATABLE_COMBOS.has(comboId) && comboId !== 'keys.global.undoFolderDelete') {
      // Holding a trigger chord auto-repeats; don't toggle the mode ~15x/s.
      // (Alt+Space without a split view is left alone, see below.)
      if (comboId !== 'keys.global.splitResize' || gtileCanOpen()) consumeEvent(event);
      return;
    }

    // Check for command mode trigger
    if (comboId === 'keys.global.commandPalette') {
      consumeEvent(event);
      if (leapMode && browseMode) {
        enterBrowseCommandMode();
      } else {
        enterSearchMode(true);
      }
      return;
    }

    // Check for search trigger
    if (comboId === 'keys.global.search') {
      consumeEvent(event);
      enterSearchMode();
      return;
    }

    // Check for leap mode trigger
    if (comboId === 'keys.global.leapMode') {
      consumeEvent(event);
      if (leapMode) {
        exitLeapMode(false);
      } else {
        // Steal focus immediately to minimize chance of the trigger key leaking to content
        stealFocusFromContent();
        enterLeapMode();
      }
      return;
    }

    // Check for quick mark jump (works outside leap mode)
    if (comboId === 'keys.global.quickMark') {
      consumeEvent(event);
      if (!leapMode) {
        // Set mark mode state AND attribute BEFORE entering leap mode
        // This ensures CSS sees mark-mode before leap-active is set
        gotoMarkMode = true;
        document.documentElement.setAttribute('data-zenleap-mark-mode', 'true');
        enterLeapMode();
        armLeapTimeout(LEAP_SUBMODE_TIMEOUT_MS);
        log('Quick goto mark mode via Ctrl+\'');
      }
      return;
    }

    // Check for undo folder delete (Ctrl/Cmd+Shift+T)
    if (comboId === 'keys.global.undoFolderDelete') {
      // Holding the chord: the repeats belong to the first press. After an
      // undo they are swallowed (they would reopen closed tabs natively);
      // otherwise the native shortcut keeps them (REV-LCORE-12).
      if (event.repeat) {
        if (_undoChordHandled) consumeEvent(event);
        return;
      }
      _undoChordHandled = undoLastFolderDelete();
      // If not handled, let browser's native Ctrl/Cmd+Shift+T proceed
      if (_undoChordHandled) consumeEvent(event);
      return;
    }

    // Alt+HJKL: Quick navigation with split-view awareness.
    // - Not in split: J/K switch tabs, H/L switch workspaces
    // - In split, not at boundary: focus adjacent pane (existing behavior)
    // - In split, at boundary: J/K navigate to first non-split tab outside
    //   the group; H/L switch workspaces
    if (comboId && comboId.startsWith('keys.global.split')) {
      const EDGE = 0.1; // threshold for "pane touches edge" (percentage)
      const pos = getSplitBounds(); // null when split view inactive

      if (comboId === 'keys.global.splitFocusDown') {
        consumeEvent(event);
        interceptQuickNav();
        if (pos && pos.bottom > EDGE) {
          splitFocusInDirection('down');
        } else {
          quickSwitchTab('down', !!pos);
          peekSidebarForQuickNav();
        }
        return;
      }
      if (comboId === 'keys.global.splitFocusUp') {
        consumeEvent(event);
        interceptQuickNav();
        if (pos && pos.top > EDGE) {
          splitFocusInDirection('up');
        } else {
          quickSwitchTab('up', !!pos);
          peekSidebarForQuickNav();
        }
        return;
      }
      if (comboId === 'keys.global.splitFocusLeft') {
        consumeEvent(event);
        interceptQuickNav();
        if (pos && pos.left > EDGE) {
          splitFocusInDirection('left');
        } else {
          quickSwitchWorkspace('prev');
          peekSidebarForQuickNav();
        }
        return;
      }
      if (comboId === 'keys.global.splitFocusRight') {
        consumeEvent(event);
        interceptQuickNav();
        if (pos && pos.right > EDGE) {
          splitFocusInDirection('right');
        } else {
          quickSwitchWorkspace('next');
          peekSidebarForQuickNav();
        }
        return;
      }
      // Alt+Space — open gTile resize overlay. Only consumed when there is a
      // split view to resize, so Alt+Space still opens the window menu
      // (Windows) or types a non-breaking space (macOS) otherwise.
      if (comboId === 'keys.global.splitResize') {
        if (!gtileCanOpen()) return;
        consumeEvent(event);
        enterGtileMode();
        return;
      }
    }

    // Handle keys when in leap mode
    if (!leapMode) return;

    const key = navKey(event);

    // Escape to cancel
    if (key === 'Escape') {
      consumeEvent(event);

      // Exit mark/goto-mark sub-mode first (in both leap and browse mode)
      if (markMode || gotoMarkMode) {
        markMode = false;
        gotoMarkMode = false;
        updateLeapOverlayState();
        log('Escaped mark/goto-mark sub-mode');
        return;
      }

      if (browseMode) {
        // Two-stage escape: first clears any pending state, second exits browse mode
        const hasSelection = selectedItems.size > 0;
        const hasYankBuffer = yankItems.length > 0;
        const hasPendingNumber = browseNumberBuffer.length > 0;
        const hasPendingG = browseGPending;

        if (hasSelection || hasYankBuffer || hasPendingNumber || hasPendingG) {
          selectedItems.clear();
          yankItems = [];
          browseNumberBuffer = '';
          clearTimeout(browseNumberTimeout);
          browseNumberTimeout = null;
          browseGPending = false;
          clearTimeout(browseGTimeout);
          browseGTimeout = null;
          updateHighlight();
          updateLeapOverlayState();
          log('Cleared selection/yank/pending state, staying in browse mode');
        } else {
          cancelBrowseMode();
        }
      } else {
        exitLeapMode(false);
      }
      return;
    }

    // === BROWSE MODE HANDLING ===
    // When mark/goto-mark sub-mode is active, skip browse keys and fall through
    // to the mark/goto-mark handlers below.
    if (browseMode && !markMode && !gotoMarkMode) {
      consumeEvent(event);

      const digit = digitFor(event);

      // If a number buffer is accumulating and a non-digit key is pressed,
      // cancel the pending number jump (the user changed their mind)
      if (browseNumberBuffer && digit === null) {
        clearTimeout(browseNumberTimeout);
        browseNumberTimeout = null;
        browseNumberBuffer = '';
      }

      if (keyMatchesAny(event, 'keys.browse.down', 'keys.browse.downAlt', 'keys.leap.browseDown', 'keys.leap.browseDownAlt')) {
        event.shiftKey ? shiftMoveHighlight('down') : moveHighlight('down');
        return;
      }
      if (keyMatchesAny(event, 'keys.browse.up', 'keys.browse.upAlt', 'keys.leap.browseUp', 'keys.leap.browseUpAlt')) {
        event.shiftKey ? shiftMoveHighlight('up') : moveHighlight('up');
        return;
      }
      // One-shot actions: ignore auto-repeat (holding x must not close a run of tabs)
      if (event.repeat) return;

      if (keyMatches(event, 'keys.browse.confirm')) {
        confirmBrowseSelection();
        return;
      }
      if (keyMatches(event, 'keys.browse.close')) {
        closeHighlightedTab(event);
        return;
      }
      if (keyMatches(event, 'keys.browse.select')) {
        toggleItemSelection();
        return;
      }
      // Case-sensitive bindings first (P before p, G before g, M before m)
      if (keyMatches(event, 'keys.browse.pasteBefore')) {
        pasteItems('before');
        return;
      }
      if (keyMatches(event, 'keys.browse.yank')) {
        yankSelectedItems();
        return;
      }
      if (keyMatches(event, 'keys.browse.pasteAfter')) {
        pasteItems('after');
        return;
      }
      if (keyMatchesAny(event, 'keys.browse.prevWorkspace', 'keys.browse.prevWorkspaceAlt',
                               'keys.browse.nextWorkspace', 'keys.browse.nextWorkspaceAlt')) {
        const isPrev = keyMatchesAny(event, 'keys.browse.prevWorkspace', 'keys.browse.prevWorkspaceAlt');
        browseWorkspaceSwitch(isPrev ? 'prev' : 'next');
        return;
      }

      // M = clear all marks
      if (keyMatches(event, 'keys.leap.clearMarks')) {
        clearAllMarks();
        updateHighlight();
        updateLeapOverlayState();
        log('Browse: cleared all marks');
        return;
      }

      // m = set mark on highlighted tab
      if (keyMatches(event, 'keys.leap.setMark')) {
        markMode = true;
        updateLeapOverlayState();
        log('Browse: entered mark mode');
        return;
      }

      // ' = goto mark (move highlight to marked tab)
      if (keyMatchesAny(event, 'keys.leap.gotoMark', 'keys.leap.gotoMarkAlt')) {
        gotoMarkMode = true;
        updateLeapOverlayState();
        log('Browse: entered goto mark mode');
        return;
      }

      // G = move highlight to last item
      if (keyMatches(event, 'keys.browse.lastTab')) {
        const items = getVisibleItems();
        setHighlight(items.length - 1, items);
        updateHighlight();
        updateLeapOverlayState();
        log(`Browse: jumped to last item (index ${highlightedTabIndex})`);
        return;
      }

      // g = pending gg (move highlight to first item)
      if (keyMatches(event, 'keys.browse.gMode')) {
        if (browseGPending) {
          // Second g pressed - move to first item (or first unpinned if setting enabled)
          clearTimeout(browseGTimeout);
          browseGPending = false;
          browseGTimeout = null;
          const items = getVisibleItems();
          const firstUnpinned = S['display.ggSkipPinned'] ? firstUnpinnedIndex(items) : -1;
          setHighlight(firstUnpinned >= 0 ? firstUnpinned : 0, items);
          updateHighlight();
          updateLeapOverlayState();
          log(`Browse: jumped to first tab (index ${highlightedTabIndex})`);
          return;
        }
        // First g pressed - wait for second g
        browseGPending = true;
        browseGTimeout = setTimeout(() => {
          browseGPending = false;
          browseGTimeout = null;
          log(`Browse: g timed out with no second g`);
        }, S['timing.browseGTimeout']);
        return;
      }

      // If g was pending but another key was pressed, cancel it
      if (browseGPending) {
        clearTimeout(browseGTimeout);
        browseGPending = false;
        browseGTimeout = null;
      }

      // Digit keys: accumulate multi-digit number with timeout
      if (digit !== null && (digit !== '0' || browseNumberBuffer.length > 0)) {
        browseNumberBuffer += digit;
        clearTimeout(browseNumberTimeout);
        browseNumberTimeout = setTimeout(() => {
          browseNumberTimeout = null;
          const distance = parseInt(browseNumberBuffer);
          browseNumberBuffer = '';
          if (distance >= 1) {
            log(`Browse: jumping distance ${distance}`);
            jumpAndOpenTab(distance);
          }
        }, S['timing.browseNumberTimeout']);
        return;
      }

      return;
    }

    // === G-MODE HANDLING ===
    if (gMode) {
      consumeEvent(event);
      if (event.repeat) return;
      const digit = digitFor(event);

      // G in g-mode - go to last tab (case-sensitive, so check before gg)
      if (keyMatches(event, 'keys.gMode.last') && gNumberBuffer === '') {
        const items = getVisibleItems();
        goToAbsoluteTab(items.length);
        return;
      }

      // gg - go to first tab (or first unpinned if setting enabled)
      if (keyMatches(event, 'keys.gMode.first') && gNumberBuffer === '') {
        if (S['display.ggSkipPinned']) {
          const items = getVisibleItems();
          const firstUnpinned = firstUnpinnedIndex(items);
          const targetIdx = firstUnpinned >= 0 ? firstUnpinned : 0;
          const target = items[targetIdx];
          if (isFolder(target)) {
            goToAbsoluteTab(targetIdx + 1);
          } else {
            gBrowser.selectedTab = target;
            log(`Jumped to first unpinned tab via gg (index ${targetIdx})`);
            exitLeapMode(true);
          }
        } else {
          goToAbsoluteTab(1);
        }
        return;
      }

      // Number keys - accumulate for absolute position
      if (digit !== null) {
        gNumberBuffer += digit;
        clearTimeout(gNumberTimeout);
        updateLeapOverlayState();

        // Set timeout to auto-execute after pause
        gNumberTimeout = setTimeout(() => {
          if (gNumberBuffer) {
            const tabNum = parseInt(gNumberBuffer);
            if (tabNum > 0) {
              goToAbsoluteTab(tabNum);
            } else {
              // 0 alone could mean first tab or cancel
              gMode = false;
              gNumberBuffer = '';
              updateLeapOverlayState();
            }
          }
        }, S['timing.gModeTimeout']);

        log(`g-mode number buffer: ${gNumberBuffer}`);
        return;
      }

      // Enter to confirm number immediately
      if (key === 'Enter' && gNumberBuffer) {
        clearTimeout(gNumberTimeout);
        const tabNum = parseInt(gNumberBuffer);
        if (tabNum > 0) {
          goToAbsoluteTab(tabNum);
        }
        return;
      }

      // Invalid key, exit g-mode but stay in leap mode
      gMode = false;
      gNumberBuffer = '';
      clearTimeout(gNumberTimeout);
      updateLeapOverlayState();
      log(`Invalid g-mode key: ${key}, exiting g-mode`);
      return;
    }

    // === Z-MODE HANDLING ===
    if (zMode) {
      consumeEvent(event);
      if (event.repeat) return;

      if (keyMatches(event, 'keys.zMode.center')) {
        scrollTabIntoView('center');
        exitLeapMode(false);
        return;
      }
      if (keyMatches(event, 'keys.zMode.top')) {
        scrollTabIntoView('top');
        exitLeapMode(false);
        return;
      }
      if (keyMatches(event, 'keys.zMode.bottom')) {
        scrollTabIntoView('bottom');
        exitLeapMode(false);
        return;
      }

      // Invalid key, exit z-mode but stay in leap mode
      zMode = false;
      updateLeapOverlayState();
      log(`Invalid z-mode key: ${key}, exiting z-mode`);
      return;
    }

    // === MARK MODE HANDLING ===
    if (markMode) {
      consumeEvent(event);
      if (event.repeat) return;

      // Accept a-z and 0-9 as mark characters
      const markChar = markCharFor(event);
      if (markChar) {
        // In browse mode, mark the highlighted tab; otherwise mark the current tab
        let targetTab = currentTab();
        if (browseMode && (highlightedItem || highlightedTabIndex >= 0)) {
          if (!highlightStillThere()) {
            markMode = false;
            updateLeapOverlayState();
            return;
          }
          const item = highlightedItem;
          if (!item || isFolder(item)) {
            // Can't mark a folder — exit mark sub-mode silently
            markMode = false;
            updateLeapOverlayState();
            log('Cannot set mark on folder');
            return;
          }
          targetTab = item;
        }
        setMark(markChar, targetTab);
        if (browseMode) {
          // Stay in browse mode, just exit mark sub-mode
          markMode = false;
          updateHighlight();
          updateLeapOverlayState();
        } else {
          exitLeapMode(false);
        }
        return;
      }

      // Invalid key, exit mark mode but stay in leap/browse mode
      markMode = false;
      updateLeapOverlayState();
      log(`Invalid mark key: ${key}, exiting mark mode`);
      return;
    }

    // === GOTO MARK MODE HANDLING ===
    if (gotoMarkMode) {
      consumeEvent(event);
      if (event.repeat) return;

      // Accept a-z and 0-9 as mark characters
      const markChar = markCharFor(event);
      if (markChar) {
        if (browseMode) {
          // In browse mode, move highlight to the marked tab
          const markedTab = marks.get(markChar);
          if (markedTab && !markedTab.closing && markedTab.parentNode) {
            const items = getVisibleItems();
            const idx = items.indexOf(markedTab);
            if (idx >= 0) {
              setHighlight(idx, items);
              gotoMarkMode = false;
              updateHighlight();
              updateLeapOverlayState();
              log(`Browse: moved highlight to mark '${markChar}'`);
            } else {
              gotoMarkMode = false;
              updateLeapOverlayState();
              log(`Mark '${markChar}' tab not in current visible items`);
            }
          } else {
            gotoMarkMode = false;
            updateLeapOverlayState();
            if (markedTab && (markedTab.closing || !markedTab.parentNode)) {
              marks.delete(markChar);
              saveEssentialMarks();
              log(`Mark '${markChar}' tab was closed, removing mark`);
            } else {
              log(`Mark '${markChar}' not found`);
            }
          }
        } else {
          if (goToMark(markChar)) {
            exitLeapMode(true); // Center scroll on the marked tab
          } else {
            // Mark not found, stay in goto mark mode for retry
            log(`Mark '${markChar}' not found`);
          }
        }
        return;
      }

      // Invalid key, exit goto mark mode but stay in leap/browse mode
      gotoMarkMode = false;
      updateLeapOverlayState();
      log(`Invalid goto mark key: ${key}, exiting goto mark mode`);
      return;
    }

    // === INITIAL LEAP MODE (waiting for j/k/g/z/m/'/o/i) ===
    consumeEvent(event);

    if (keyMatchesAny(event, 'keys.leap.browseDown', 'keys.leap.browseDownAlt')) {
      enterBrowseMode('down');
      return;
    }
    if (keyMatchesAny(event, 'keys.leap.browseUp', 'keys.leap.browseUpAlt')) {
      enterBrowseMode('up');
      return;
    }
    if (event.repeat) return;
    // Case-sensitive bindings first (G before g, M before m, ? before /)
    if (keyMatches(event, 'keys.leap.lastTab')) {
      const items = getVisibleItems();
      goToAbsoluteTab(items.length);
      return;
    }
    if (keyMatches(event, 'keys.leap.clearMarks')) {
      clearAllMarks();
      exitLeapMode(false);
      return;
    }
    if (keyMatches(event, 'keys.leap.help')) {
      enterHelpMode();
      return;
    }
    if (keyMatches(event, 'keys.leap.gMode')) {
      gMode = true;
      gNumberBuffer = '';
      armLeapTimeout(LEAP_SUBMODE_TIMEOUT_MS);
      updateLeapOverlayState();
      log('Entered g-mode');
      return;
    }
    if (keyMatches(event, 'keys.leap.zMode')) {
      zMode = true;
      armLeapTimeout(LEAP_SUBMODE_TIMEOUT_MS);
      updateLeapOverlayState();
      log('Entered z-mode');
      return;
    }
    if (keyMatches(event, 'keys.leap.setMark')) {
      markMode = true;
      document.documentElement.setAttribute('data-zenleap-mark-mode', 'true');
      armLeapTimeout(LEAP_SUBMODE_TIMEOUT_MS);
      updateLeapOverlayState();
      log('Entered mark mode');
      return;
    }
    if (keyMatchesAny(event, 'keys.leap.gotoMark', 'keys.leap.gotoMarkAlt')) {
      gotoMarkMode = true;
      document.documentElement.setAttribute('data-zenleap-mark-mode', 'true');
      armLeapTimeout(LEAP_SUBMODE_TIMEOUT_MS);
      updateLeapOverlayState();
      log('Entered goto mark mode');
      return;
    }
    if (keyMatches(event, 'keys.leap.jumpBack')) {
      if (jumpBack()) exitLeapMode(true);
      return;
    }
    if (keyMatches(event, 'keys.leap.jumpForward')) {
      if (jumpForward()) exitLeapMode(true);
      return;
    }
    if (keyMatchesAny(event, 'keys.leap.prevWorkspace', 'keys.leap.prevWorkspaceAlt',
                             'keys.leap.nextWorkspace', 'keys.leap.nextWorkspaceAlt')) {
      const isPrev = keyMatchesAny(event, 'keys.leap.prevWorkspace', 'keys.leap.prevWorkspaceAlt');
      browseMode = true;
      browseDirection = isPrev ? 'up' : 'down';
      const wsItems = getVisibleItems();
      originalTabIndex = findCurrentItemIndex(wsItems);
      if (originalTabIndex === -1) originalTabIndex = 0;
      originalTab = currentTab();
      setHighlight(0, wsItems);
      clearTimeout(leapModeTimeout);
      updateLeapOverlayState();
      browseWorkspaceSwitch(isPrev ? 'prev' : 'next');
      return;
    }

    // 0 = jump to first unpinned tab (like vim's 0 goes to start of line)
    if (key === '0') {
      const items = getVisibleItems();
      const firstUnpinned = firstUnpinnedIndex(items);
      if (firstUnpinned >= 0) {
        const target = items[firstUnpinned];
        gBrowser.selectedTab = target;
        log(`Jumped to first unpinned tab (index ${firstUnpinned})`);
      }
      exitLeapMode(true);
      return;
    }

    // $ = jump to last tab (like vim's $ goes to end of line)
    if (event.key === '$') {
      const items = getVisibleItems();
      if (items.length > 0) {
        // Find the last non-folder item, or fall back to last item
        let lastTabIdx = items.length - 1;
        while (lastTabIdx >= 0 && isFolder(items[lastTabIdx])) lastTabIdx--;
        if (lastTabIdx >= 0) {
          gBrowser.selectedTab = items[lastTabIdx];
          log(`Jumped to last tab (index ${lastTabIdx})`);
        }
      }
      exitLeapMode(true);
      return;
    }

    // Any other key in initial leap mode - ignore (don't exit, just wait for valid command)
    log(`Unrecognized key in leap mode: ${key}`);
  }

  // Set up event listeners for tab changes
  function setupTabListeners() {
    const tc = gBrowser.tabContainer;
    listen(tc, 'TabSelect', (event) => {
      // Synchronous on purpose: updating in the next frame would restyle and
      // re-layout the tab strip a second time after Zen's own flush. Writes are
      // change-only, so the follow-up pass Zen's folder-active mutation
      // triggers is cheap.
      updateRelativeNumbers();
      if (recordingJumps && event.target) {
        recordJump(event.target);
      }
      _pluginEventBus.emit('tab:activated', { tab: event.target });
    });

    listen(tc, 'TabOpen', (event) => {
      scheduleRelativeNumberUpdate();
      _pluginEventBus.emit('tab:created', { tab: event.target });
    });

    listen(tc, 'TabClose', (event) => {
      scheduleRelativeNumberUpdate();
      if (gtileMode && gtileTabRects.some(r => r.tab === event.target)) {
        // A split pane closed under the gTile overlay: its regions are stale
        exitGtileMode(false);
      }
      _pluginEventBus.emit('tab:closed', { tab: event.target });
    });

    listen(tc, 'TabMove', (event) => {
      scheduleRelativeNumberUpdate();
      _pluginEventBus.emit('tab:moved', { tab: event.target });
    });

    listen(tc, 'TabGroupMoved', () => scheduleRelativeNumberUpdate());

    // Workspace switches (Zen has no ZenWorkspaceChanged DOM event; this is its
    // documented hook). Zen awaits these callbacks, so keep it cheap.
    try {
      // (Plugins get workspace:changed from the plugin system's own listener.)
      const onWorkspaceChanged = () => {
        if (_tornDown) return;
        _visibleItemsCache = null;
        scheduleRelativeNumberUpdate();
      };
      gZenWorkspaces.addChangeListeners(onWorkspaceChanged);
      onTeardown(() => gZenWorkspaces.removeChangeListeners?.(onWorkspaceChanged));
    } catch (e) {
      reportError('Could not register workspace change listener', e);
    }

    // Watch for folder collapse/expand, folder-active changes and the space's
    // collapsed pinned section to refresh relative numbers.
    _folderObserver = new MutationObserver(() => {
      _visibleItemsCache = null;
      scheduleRelativeNumberUpdate();
    });
    _folderObserver.observe(tc, {
      attributes: true,
      attributeFilter: ['collapsed', 'folder-active', 'collapsedpinnedtabs'],
      subtree: true,
    });
    onTeardown(() => { _folderObserver?.disconnect(); _folderObserver = null; });

    log('Tab listeners set up');
  }

  // Suppress keyups whose keydown ZenLeap consumed, so they don't reach the page
  // (e.g. the Space keyup after Ctrl+Space, or j/k keyups in browse mode).
  // Keyups of keys the page did receive must pass, or web apps see stuck keys.
  const _consumedKeyCodes = new Set();
  // Modifiers held down (code -> element focused when they went down), and
  // those held through a chord ZenLeap consumed. When that chord moved focus
  // (Alt+J lands on another tab or split pane), the modifier's keyup would
  // reach a page that never saw its keydown (REV-LCORE-03).
  const _heldModifiers = new Map();
  const _chordModifiers = new Map();
  const MODIFIER_CODE_RE = /^(?:Alt|Control|Shift|Meta|OS)(?:Left|Right)$/;

  function clearKeyTracking() {
    _consumedKeyCodes.clear();
    _heldModifiers.clear();
    _chordModifiers.clear();
  }

  // Where a key event is delivered: the focused element. (A keyup that races a
  // tab switch keeps the old <browser> as event.target in chrome, but Firefox
  // forwards it to the newly focused page.)
  function keyFocusTarget(event) {
    return document.commandDispatcher?.focusedElement || event.target;
  }

  // Web content: a remote <browser>, or an element of an in-process page.
  function isContentKeyTarget(target) {
    return target?.localName === 'browser' || (!!target?.ownerDocument && target.ownerDocument !== document);
  }

  function handleKeyUp(event) {
    const code = event.code || event.key;
    const consumed = _consumedKeyCodes.delete(code);
    const chordTarget = _chordModifiers.get(code);
    _chordModifiers.delete(code);
    _heldModifiers.delete(code);
    const target = chordTarget === undefined ? null : keyFocusTarget(event);
    const orphan = !!target && target !== chordTarget && isContentKeyTarget(target);
    if (consumed || orphan || (urlbarVimActive && urlbarVimMode === 'normal' && gURLBar?.focused)) {
      consumeEvent(event);
    }
  }

  // Window-level keydown entry point: remembers which keys ZenLeap consumed so
  // handleKeyUp can swallow exactly their keyups.
  function onWindowKeyDown(event) {
    const code = event.code || event.key;
    const wasPrevented = event.defaultPrevented;
    handleKeyDown(event);
    if (!wasPrevented && event.defaultPrevented) {
      _consumedKeyCodes.add(code);
      for (const [mod, target] of _heldModifiers) _chordModifiers.set(mod, target);
    } else {
      _consumedKeyCodes.delete(code);
      if (MODIFIER_CODE_RE.test(code) && !event.repeat) {
        _heldModifiers.set(code, keyFocusTarget(event));
        _chordModifiers.delete(code);
      }
    }
  }

  // Set up keyboard listener
  function setupKeyboardListener() {
    listen(window, 'keydown', onWindowKeyDown, true);
    listen(window, 'keyup', handleKeyUp, true);
    listen(window, 'popuphiding', onPopupHiding, true);
    // A deactivated window never gets the pending keyups. (Not 'blur': moving
    // focus between chrome and a page, as a tab switch does, blurs the window
    // too, between Alt+J's keydown and its keyup.)
    listen(window, 'deactivate', clearKeyTracking);

    // Close gTile overlay if split view is deactivated externally
    listen(window, 'ZenViewSplitter:SplitViewDeactivated', () => {
      if (gtileMode) exitGtileMode(false);
    });
    log('Keyboard listener set up');
  }

  // Add CSS for relative number display and highlight
  // Convert hex color (#RRGGBB) to rgba string
  function hexToRgba(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  // Normalize any CSS color (hex, rgb(), hsl(), named, ...) to #RRGGBB for
  // <input type="color"> and the derived rgba() variables. Invalid values
  // return `fallback` (the regex parser used to turn red / hsl() black).
  function toHex6(val, fallback = '#000000') {
    if (typeof val !== 'string' || !val.trim()) return fallback;
    const v = val.trim();
    if (/^#[0-9a-fA-F]{6}$/.test(v)) return v;
    try {
      const rgba = InspectorUtils.colorToRGBA(v);
      if (rgba) return '#' + [rgba.r, rgba.g, rgba.b].map(n => Math.round(n).toString(16).padStart(2, '0')).join('');
    } catch (e) { /* not a color */ }
    return fallback;
  }

  // The theme to apply: user themes are completed with Meridian's values, so
  // one that sets only a few keys (or has no `extends`) never yields
  // `undefined` CSS values (LEAP-A-18). Color values that aren't valid CSS
  // colors (e.g. half-typed in the theme editor) fall back to Meridian's too:
  // one bad --zl-accent would break every rule using it (REV-LCORE-11).
  function resolveTheme(themeId) {
    const base = BUILTIN_THEMES.meridian;
    const t = themes[themeId] || themes.meridian || base;
    if (t === base) return base;
    const resolved = { ...base, ...t };
    for (const [prop, spec] of Object.entries(THEME_EDITOR_SCHEMA)) {
      if (spec.type !== 'color' && spec.type !== 'rgba') continue;
      const value = resolved[prop];
      if (value === base[prop]) continue;
      let valid = false;
      try { valid = typeof value === 'string' && InspectorUtils.isValidCSSColor(value.trim()); } catch (e) { /* treat as invalid */ }
      if (!valid) resolved[prop] = base[prop];
    }
    return resolved;
  }

  // Theme object currently applied (the saved theme or a live preview).
  let _appliedTheme = BUILTIN_THEMES.meridian;

  // Generate a kebab-case theme key from a display name
  function generateThemeKey(name, existingThemes) {
    let key = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    if (!key) key = 'custom-theme';
    let candidate = key;
    let i = 2;
    while (BUILTIN_THEMES[candidate] || (existingThemes[candidate] && existingThemes[candidate].name !== name.trim())) {
      candidate = `${key}-${i++}`;
    }
    return candidate;
  }

  // Apply theme: set all CSS custom properties on :root from the active theme.
  // previewThemeId shows another theme without touching the saved setting, so
  // an unrelated saveSettings() during a live preview can't persist it
  // (LEAP-A-36).
  function applyTheme(previewThemeId = null) {
    if (_tornDown) return;
    const themeName = previewThemeId || S['appearance.theme'] || 'meridian';
    const t = resolveTheme(themeName);
    const base = BUILTIN_THEMES.meridian;
    _appliedTheme = t;
    const root = document.documentElement;

    // Background layers
    root.style.setProperty('--zl-bg-void', t.bgVoid);
    root.style.setProperty('--zl-bg-deep', t.bgDeep);
    root.style.setProperty('--zl-bg-base', t.bgBase);
    root.style.setProperty('--zl-bg-surface', t.bgSurface);
    root.style.setProperty('--zl-bg-raised', t.bgRaised);
    root.style.setProperty('--zl-bg-elevated', t.bgElevated);
    root.style.setProperty('--zl-bg-hover', t.bgHover);
    // Accent
    root.style.setProperty('--zl-accent', t.accent);
    root.style.setProperty('--zl-accent-bright', t.accentBright);
    root.style.setProperty('--zl-accent-dim', t.accentDim);
    root.style.setProperty('--zl-accent-mid', t.accentMid);
    root.style.setProperty('--zl-accent-glow', t.accentGlow);
    root.style.setProperty('--zl-accent-border', t.accentBorder);
    // Derived accent opacities (for browse mode compatibility)
    const accentHex = toHex6(t.accent, base.accent);
    root.style.setProperty('--zl-accent-20', hexToRgba(accentHex, 0.2));
    root.style.setProperty('--zl-accent-15', hexToRgba(accentHex, 0.15));
    root.style.setProperty('--zl-accent-60', hexToRgba(accentHex, 0.6));
    root.style.setProperty('--zl-accent-80', hexToRgba(accentHex, 0.8));
    root.style.setProperty('--zl-accent-40', hexToRgba(accentHex, 0.4));
    // Semantic colors
    root.style.setProperty('--zl-blue', t.blue);
    root.style.setProperty('--zl-purple', t.purple);
    root.style.setProperty('--zl-green', t.green);
    root.style.setProperty('--zl-red', t.red);
    root.style.setProperty('--zl-cyan', t.cyan);
    root.style.setProperty('--zl-gold', t.gold);
    // Semantic aliases
    root.style.setProperty('--zl-success', t.green);
    root.style.setProperty('--zl-error', t.red);
    root.style.setProperty('--zl-warning', t.gold);
    // gTile regions
    root.style.setProperty('--zl-region-blue', t.regionBlue);
    root.style.setProperty('--zl-region-purple', t.regionPurple);
    root.style.setProperty('--zl-region-green', t.regionGreen);
    root.style.setProperty('--zl-region-gold', t.regionGold);
    // Text
    root.style.setProperty('--zl-text-primary', t.textPrimary);
    root.style.setProperty('--zl-text-secondary', t.textSecondary);
    root.style.setProperty('--zl-text-tertiary', t.textTertiary);
    root.style.setProperty('--zl-text-muted', t.textMuted);
    // Borders
    root.style.setProperty('--zl-border-subtle', t.borderSubtle);
    root.style.setProperty('--zl-border-default', t.borderDefault);
    root.style.setProperty('--zl-border-strong', t.borderStrong);
    // Radii
    root.style.setProperty('--zl-r-sm', t.rSm);
    root.style.setProperty('--zl-r-md', t.rMd);
    root.style.setProperty('--zl-r-lg', t.rLg);
    root.style.setProperty('--zl-r-xl', t.rXl);
    // Fonts
    root.style.setProperty('--zl-font-ui', t.fontUi);
    root.style.setProperty('--zl-font-mono', t.fontMono);
    // Shadows
    root.style.setProperty('--zl-shadow-modal', t.shadowModal);
    root.style.setProperty('--zl-shadow-elevated', t.shadowElevated);
    root.style.setProperty('--zl-shadow-kbd', t.shadowKbd);
    // Effects
    root.style.setProperty('--zl-noise-opacity', t.noiseOpacity);
    root.style.setProperty('--zl-backdrop-blur', t.backdropBlur);
    root.style.setProperty('--zl-panel-alpha', t.panelAlpha);
    root.style.setProperty('--zl-backdrop', `rgba(0,0,0,${parseFloat(t.panelAlpha) >= 0.95 ? '0.65' : '0.5'})`);
    root.style.setProperty('--zl-blur', `blur(${t.backdropBlur})`);

    // Browse mode variables (derived from theme — normalize for user themes)
    const highlight = toHex6(t.highlight, base.highlight);
    const selected = toHex6(t.selected, base.selected);
    const mark = toHex6(t.mark, base.mark);

    root.style.setProperty('--zl-highlight', highlight);
    root.style.setProperty('--zl-highlight-20', hexToRgba(highlight, 0.2));
    root.style.setProperty('--zl-highlight-15', hexToRgba(highlight, 0.15));
    root.style.setProperty('--zl-highlight-60', hexToRgba(highlight, 0.6));
    root.style.setProperty('--zl-highlight-80', hexToRgba(highlight, 0.8));
    root.style.setProperty('--zl-selected', selected);
    root.style.setProperty('--zl-selected-20', hexToRgba(selected, 0.2));
    root.style.setProperty('--zl-selected-15', hexToRgba(selected, 0.15));
    root.style.setProperty('--zl-mark', mark);
    root.style.setProperty('--zl-mark-50', hexToRgba(mark, 0.5));
    root.style.setProperty('--zl-mark-70', hexToRgba(mark, 0.7));
    root.style.setProperty('--zl-mark-80', hexToRgba(mark, 0.8));
    root.style.setProperty('--zl-mark-90', hexToRgba(mark, 0.9));
    root.style.setProperty('--zl-current-bg', t.currentBadgeBg);
    root.style.setProperty('--zl-current-color', t.currentBadgeColor);
    root.style.setProperty('--zl-badge-bg', t.badgeBg);
    root.style.setProperty('--zl-badge-color', t.badgeColor);
    root.style.setProperty('--zl-up-bg', t.upBg);
    root.style.setProperty('--zl-down-bg', t.downBg);

    // Blend highlight + selected for the combo state
    const hR = parseInt(highlight.slice(1, 3), 16), hG = parseInt(highlight.slice(3, 5), 16), hB = parseInt(highlight.slice(5, 7), 16);
    const sR = parseInt(selected.slice(1, 3), 16), sG = parseInt(selected.slice(3, 5), 16), sB = parseInt(selected.slice(5, 7), 16);
    const blendHex = `#${Math.round((hR + sR) / 2).toString(16).padStart(2, '0')}${Math.round((hG + sG) / 2).toString(16).padStart(2, '0')}${Math.round((hB + sB) / 2).toString(16).padStart(2, '0')}`;
    root.style.setProperty('--zl-highlight-selected', blendHex);
    root.style.setProperty('--zl-highlight-selected-20', hexToRgba(blendHex, 0.25));
    root.style.setProperty('--zl-highlight-selected-15', hexToRgba(blendHex, 0.2));

    // Apply theme to Zen Browser chrome if enabled
    applyBrowserTheme(t);
  }

  // Zen Browser CSS properties managed by browser theme application
  const _zenBrowserProps = [
    '--zen-primary-color',
    '--zen-main-browser-background',
    '--zen-main-browser-background-toolbar',
    '--zen-toolbar-element-bg',
    '--zen-toolbar-element-bg-hover',
    '--zen-branding-bg',
    '--zen-branding-bg-reverse',
    '--zen-colors-primary',
    '--zen-colors-secondary',
    '--zen-colors-tertiary',
    '--zen-colors-border',
    '--zen-colors-border-contrast',
    '--zen-colors-input-bg',
    '--zen-colors-primary-foreground',
    '--zen-urlbar-background',
    '--toolbox-textcolor',
    '--toolbar-color',
  ];

  // Apply or revert Zen Browser chrome theme colors.
  // New Zen (1.19+) sets --zen-main-browser-background on #zen-browser-background
  // and --zen-main-browser-background-toolbar on #zen-toolbar-background instead
  // of on :root. We target both for backwards compatibility with older Zen.
  // Element-level properties that we manage on the dedicated background elements.
  const _zenBgElProps = [
    '--zen-main-browser-background',
    '--zen-main-browser-background-old',
    '--zen-background-opacity',
  ];
  const _zenToolbarBgElProps = [
    '--zen-main-browser-background-toolbar',
    '--zen-main-browser-background-toolbar-old',
    '--zen-background-opacity',
  ];

  // Resolve the background element targets. Uses gZenThemePicker's getters when
  // available (stays in sync with Zen's own references), falls back to getElementById.
  function _getZenBgEl() {
    return window.gZenThemePicker?.browserBackgroundElement
      || document.getElementById('zen-browser-background');
  }
  function _getZenToolbarBgEl() {
    return window.gZenThemePicker?.toolbarBackgroundElement
      || document.getElementById('zen-toolbar-background');
  }

  // Remove ZenLeap's browser-chrome overrides so Zen's own theme takes over.
  function revertBrowserTheme() {
    const root = document.documentElement;
    document.getElementById('zenleap-browser-theme')?.remove();
    for (const prop of _zenBrowserProps) root.style.removeProperty(prop);
    // Clean up -old and opacity from :root too (defensive, for legacy Zen)
    root.style.removeProperty('--zen-main-browser-background-old');
    root.style.removeProperty('--zen-main-browser-background-toolbar-old');
    root.style.removeProperty('--zen-background-opacity');
    const zenBgEl = _getZenBgEl();
    const zenToolbarBgEl = _getZenToolbarBgEl();
    if (zenBgEl) {
      for (const prop of _zenBgElProps) zenBgEl.style.removeProperty(prop);
    }
    if (zenToolbarBgEl) {
      for (const prop of _zenToolbarBgElProps) zenToolbarBgEl.style.removeProperty(prop);
    }
  }

  // applyBrowserTheme accepts an options object:
  //   t: theme object (resolved from settings if omitted)
  //   duringAnimation: true when called from the workspace-change wrapper, so we
  //     avoid clobbering --zen-background-opacity and -old variants mid-transition.
  function applyBrowserTheme(opts) {
    // Support legacy call signature: applyBrowserTheme(themeObj)
    // Discriminate by checking for 'duringAnimation' key (never present on theme objects).
    let t, duringAnimation = false;
    if (opts && typeof opts === 'object' && 'duringAnimation' in opts) {
      t = opts.t;
      duringAnimation = !!opts.duringAnimation;
    } else {
      t = opts;
    }

    const root = document.documentElement;
    const zenBgEl = _getZenBgEl();
    const zenToolbarBgEl = _getZenToolbarBgEl();

    // Always remove injected stylesheet first
    const existingStyle = document.getElementById('zenleap-browser-theme');
    if (existingStyle) existingStyle.remove();

    if (!S['appearance.applyToBrowser']) {
      revertBrowserTheme();
      return;
    }

    // Use the theme object passed from applyTheme(), or the applied one
    if (!t) t = _appliedTheme;
    const base = BUILTIN_THEMES.meridian;

    // Resolve all theme colors
    const accent = toHex6(t.accent, base.accent);
    const bgBase = toHex6(t.bgBase, base.bgBase);
    const bgDeep = toHex6(t.bgDeep, base.bgDeep);
    const bgSurface = toHex6(t.bgSurface, base.bgSurface);
    const bgRaised = toHex6(t.bgRaised, base.bgRaised);
    const textPrimary = toHex6(t.textPrimary, base.textPrimary);
    const textSecondary = toHex6(t.textSecondary, base.textSecondary);
    const textMuted = toHex6(t.textMuted, base.textMuted);

    const bgGradient = `linear-gradient(135deg, ${bgDeep} 0%, ${bgBase} 100%)`;
    const toolbarGradient = `linear-gradient(135deg, ${bgBase} 0%, ${bgDeep} 100%)`;

    // Core browser chrome properties — always set on :root for properties that
    // remain there in all Zen versions
    root.style.setProperty('--zen-primary-color', accent);

    // Background gradients: Zen reads these from its dedicated background
    // elements (#zen-browser-background / #zen-toolbar-background), not :root.
    if (zenBgEl) {
      zenBgEl.style.setProperty('--zen-main-browser-background', bgGradient);
      // During workspace-switch animations, Zen is animating --zen-background-opacity
      // via a spring. Only set -old and opacity when NOT mid-animation (initial apply,
      // settings change) so we don't disrupt the cross-fade.
      if (!duringAnimation) {
        zenBgEl.style.setProperty('--zen-main-browser-background-old', bgGradient);
        zenBgEl.style.setProperty('--zen-background-opacity', '1');
      }
    }
    if (zenToolbarBgEl) {
      zenToolbarBgEl.style.setProperty('--zen-main-browser-background-toolbar', toolbarGradient);
      if (!duringAnimation) {
        zenToolbarBgEl.style.setProperty('--zen-main-browser-background-toolbar-old', toolbarGradient);
        zenToolbarBgEl.style.setProperty('--zen-background-opacity', '1');
      }
    }
    // Toolbar element backgrounds (urlbar collapsed state)
    root.style.setProperty('--zen-toolbar-element-bg', hexToRgba(textPrimary, 0.08));
    root.style.setProperty('--zen-toolbar-element-bg-hover', hexToRgba(textPrimary, 0.15));

    // Text colors
    root.style.setProperty('--toolbox-textcolor', textPrimary);
    root.style.setProperty('--toolbar-color', textPrimary);

    // Branding (base bg and contrast text)
    root.style.setProperty('--zen-branding-bg', bgDeep);
    root.style.setProperty('--zen-branding-bg-reverse', textPrimary);

    // Zen derived color cascade
    root.style.setProperty('--zen-colors-primary', bgSurface);
    root.style.setProperty('--zen-colors-secondary', bgRaised);
    root.style.setProperty('--zen-colors-tertiary', bgBase);
    root.style.setProperty('--zen-colors-border', hexToRgba(textSecondary, 0.2));
    root.style.setProperty('--zen-colors-border-contrast', hexToRgba(textSecondary, 0.11));
    root.style.setProperty('--zen-colors-input-bg', bgRaised);
    root.style.setProperty('--zen-colors-primary-foreground', textSecondary);
    root.style.setProperty('--zen-urlbar-background', bgSurface);

    // Inject urlbar-specific overrides for selectors with hardcoded light-dark() values
    const style = document.createElement('style');
    style.id = 'zenleap-browser-theme';
    style.textContent = `
      /* ZenLeap browser theme: URL bar overrides */
      #urlbar[breakout-extend="true"] .urlbar-background {
        --zen-urlbar-background-base: ${bgSurface} !important;
        background-color: ${bgSurface} !important;
        box-shadow: 0px 30px 140px -15px rgba(0, 0, 0, 0.6) !important;
        outline: 0.5px solid ${hexToRgba(textPrimary, 0.12)} !important;
      }
      .urlbarView-row {
        color: ${textSecondary} !important;
      }
      .urlbarView-row[selected] {
        --zen-selected-bg: ${accent} !important;
        background-color: ${accent} !important;
      }
      .urlbarView-row[selected] *,
      .urlbarView-row[selected] .urlbarView-title-separator::before {
        color: ${bgDeep} !important;
      }
      .urlbarView-title {
        color: ${textPrimary} !important;
      }
      .urlbarView-url,
      .urlbarView-title-separator::before {
        color: ${textMuted} !important;
      }
      .urlbarView-row:hover:not([selected]),
      .urlbarView-row:hover:not([selected]) .urlbarView-favicon {
        background-color: ${hexToRgba(textPrimary, 0.05)} !important;
      }
      .urlbarView-favicon {
        background-color: ${hexToRgba(textPrimary, 0.04)} !important;
      }
      .urlbarView-shortcutContent {
        background-color: ${hexToRgba(textPrimary, 0.05)} !important;
        color: ${textSecondary} !important;
      }
      .urlbarView-prettyName {
        background-color: ${hexToRgba(textPrimary, 0.1)} !important;
        color: ${textSecondary} !important;
      }
      #urlbar-label-box,
      #urlbar-search-mode-indicator {
        background-color: ${accent} !important;
        color: ${bgDeep} !important;
      }
      #urlbar .urlbar-input-box {
        color: ${textPrimary} !important;
      }
      .urlbar-input::placeholder {
        color: ${textMuted} !important;
      }
    `;
    document.head.appendChild(style);
  }

  // Hook into Zen workspace changes to re-apply browser theme
  let _workspaceHookRetries = 0;
  function setupWorkspaceThemeHook() {
    if (_tornDown) return;
    if (!window.gZenThemePicker || !window.gZenWorkspaces) {
      if (++_workspaceHookRetries > 50) {
        log('Workspace theme hook: globals not found after 50 retries, skipping');
        return;
      }
      lifetimeTimeout(setupWorkspaceThemeHook, 100);
      return;
    }

    // Guard against double-wrapping if another copy is (still) loaded in this window
    if (gZenThemePicker._zenleapWrapped) {
      log('Workspace theme hook already installed, skipping');
      return;
    }

    // Primary: wrap onWorkspaceChange for zero-flash override.
    // Zen calls this inside a requestAnimationFrame during workspace switches,
    // which overwrites our CSS custom properties. By wrapping it, we re-apply
    // our theme in the same rAF callback — before the browser paints — so the
    // user never sees native Zen colors flash through.
    try {
      const picker = gZenThemePicker;
      const hadOwn = Object.prototype.hasOwnProperty.call(picker, 'onWorkspaceChange');
      const previous = picker.onWorkspaceChange;
      const _origOnWorkspaceChange = previous.bind(picker);
      const wrapper = (...args) => {
        const result = _origOnWorkspaceChange(...args);
        if (S['appearance.applyToBrowser']) {
          // Pass duringAnimation so we don't clobber Zen's cross-fade spring
          try { applyBrowserTheme({ duringAnimation: true }); } catch (e) { log(`Warning: applyBrowserTheme failed: ${e}`); }
          // Zen repaints every window showing this space from here, bypassing
          // their own wrappers: let their ZenLeap re-apply too (LEAP-B-34).
          try { Services.obs.notifyObservers(window, 'zenleap:reapply-browser-theme'); } catch (e) { /* ignore */ }
        }
        return result;
      };
      picker.onWorkspaceChange = wrapper;
      picker._zenleapWrapped = true;
      onTeardown(() => {
        if (picker.onWorkspaceChange === wrapper) {
          if (hadOwn) picker.onWorkspaceChange = previous;
          else delete picker.onWorkspaceChange;
        }
        delete picker._zenleapWrapped;
      });
    } catch (e) {
      log(`Warning: Could not wrap onWorkspaceChange: ${e}`);
    }

    // Fallback: also use the official change listener API. During animated
    // switches this fires AFTER the rAF (since _animateTabs takes ~200ms),
    // so the onWorkspaceChange wrapper is the primary defense. This listener
    // covers any future code paths that reset CSS properties without going
    // through onWorkspaceChange.
    try {
      const onChange = () => {
        if (S['appearance.applyToBrowser'] && !_tornDown) {
          // Change listeners fire after _animateTabs completes, so the animation
          // is done. Call without duringAnimation to sync -old and opacity values.
          try { applyBrowserTheme(); } catch (e) { log(`Warning: applyBrowserTheme failed: ${e}`); }
        }
      };
      gZenWorkspaces.addChangeListeners(onChange);
      onTeardown(() => gZenWorkspaces.removeChangeListeners?.(onChange));
    } catch (e) {
      log(`Warning: Could not add workspace change listener: ${e}`);
    }

    const reapplyObserver = {
      observe(subject) {
        if (subject === window || _tornDown || !S['appearance.applyToBrowser']) return;
        try { applyBrowserTheme({ duringAnimation: true }); } catch (e) { log(`Warning: applyBrowserTheme failed: ${e}`); }
      },
    };
    Services.obs.addObserver(reapplyObserver, 'zenleap:reapply-browser-theme');
    onTeardown(() => Services.obs.removeObserver(reapplyObserver, 'zenleap:reapply-browser-theme'));

    log('Workspace theme hook installed');

    // Re-apply browser theme now: gZenThemePicker.onWorkspaceChange() was likely
    // already called (unwrapped) during SessionStore restoration before we could
    // install the hook, overwriting our --zen-* CSS properties.
    if (S['appearance.applyToBrowser']) {
      try { applyBrowserTheme(); } catch (e) { log(`Warning: applyBrowserTheme failed: ${e}`); }
    }

    // Safety net: re-apply after Zen's workspace initialization fully completes.
    // The rAF in _updateWorkspaceState likely already fired by the time
    // promiseInitialized resolves, but we double-rAF to handle any edge cases
    // where additional CSS property resets happen near initialization.
    // If the onWorkspaceChange wrapper is working, this is redundant but harmless.
    if (gZenWorkspaces.promiseInitialized?.then) {
      gZenWorkspaces.promiseInitialized.then(() => {
        if (S['appearance.applyToBrowser'] && !_tornDown) {
          requestAnimationFrame(() => requestAnimationFrame(() => {
            try { applyBrowserTheme(); } catch (e) { log(`Warning: applyBrowserTheme failed: ${e}`); }
          }));
        }
      });
    }
  }

  // Legacy compat wrapper
  function applyThemeColors() { applyTheme(); }

  // Inject a named stylesheet once. Lazily created UI (help, reorganize,
  // settings, preview, URL bar) adds its styles on first use; teardown removes
  // every ZenLeap style element with the rest of its DOM.
  function injectStyleBlock(id, css) {
    if (document.getElementById(id)) return;
    const style = document.createElement('style');
    style.id = id;
    style.textContent = css;
    document.head.appendChild(style);
  }

  function injectStyles() {
    // Remove any existing style element for idempotent reinjection
    const existing = document.getElementById('zenleap-styles');
    if (existing) existing.remove();

    const style = document.createElement('style');
    style.id = 'zenleap-styles';
    style.textContent = `
      /* ═══ Base styles ═══ */
      tab[data-zenleap-rel] {
        position: relative;
      }

      /* ═══ Themed scrollbars (Firefox: scrollbar-width/-color, not ::-webkit-scrollbar) ═══ */
      .zenleap-themed-scroll {
        scrollbar-width: thin;
        scrollbar-color: var(--zl-border-strong) transparent;
      }

      /* ═══ Icons: emoji text or Zen's chrome:// SVG space icons ═══ */
      .zenleap-icon-img {
        width: 16px; height: 16px; object-fit: contain;
        -moz-context-properties: fill, fill-opacity;
        fill: currentColor;
      }

      /* ═══ Shared modal animation ═══ */
      @keyframes zenleap-modal-enter {
        from { opacity: 0; transform: scale(0.96) translateY(-8px); }
        to { opacity: 1; transform: scale(1) translateY(0); }
      }
      /* Toggle switch (Settings) */
      .zenleap-toggle {
        position: relative; display: inline-block; width: 40px; height: 22px; cursor: pointer;
      }
      .zenleap-toggle input { opacity: 0; width: 0; height: 0; }
      .zenleap-toggle-slider {
        position: absolute; top: 0; left: 0; right: 0; bottom: 0;
        background: var(--zl-border-strong); border-radius: 11px; transition: background 0.2s;
      }
      .zenleap-toggle-slider::before {
        content: ''; position: absolute; height: 16px; width: 16px;
        left: 3px; bottom: 3px; background: var(--zl-text-secondary); border-radius: 50%;
        transition: all 0.2s;
      }
      .zenleap-toggle input:checked + .zenleap-toggle-slider { background: var(--zl-accent-40); }
      .zenleap-toggle input:checked + .zenleap-toggle-slider::before {
        transform: translateX(18px); background: var(--zl-accent);
      }

      /* ═══ Browse Mode: Highlighted tab ═══ */
      tab[data-zenleap-highlight="true"] {
        outline: 2px solid var(--zl-highlight) !important;
        outline-offset: -2px;
        background-color: var(--zl-highlight-20) !important;
      }

      tab[data-zenleap-highlight="true"] > .tab-stack > .tab-content {
        background-color: var(--zl-highlight-15) !important;
      }

      /* ═══ Browse Mode: Selected tabs (multi-select) ═══ */
      tab[data-zenleap-selected="true"] {
        outline: 2px solid var(--zl-selected) !important;
        outline-offset: -2px;
        background-color: var(--zl-selected-20) !important;
      }

      tab[data-zenleap-selected="true"] > .tab-stack > .tab-content {
        background-color: var(--zl-selected-15) !important;
      }

      /* ═══ Browse Mode: Both highlighted and selected ═══ */
      tab[data-zenleap-highlight="true"][data-zenleap-selected="true"] {
        outline: 2px solid var(--zl-highlight-selected) !important;
        background-color: var(--zl-highlight-selected-20) !important;
      }

      tab[data-zenleap-highlight="true"][data-zenleap-selected="true"] > .tab-stack > .tab-content {
        background-color: var(--zl-highlight-selected-15) !important;
      }

      /* ═══ Browse Mode: Folder highlight/select ═══ */
      zen-folder[data-zenleap-highlight="true"] {
        outline: 2px solid var(--zl-highlight) !important;
        outline-offset: -2px;
        background-color: var(--zl-highlight-20) !important;
        border-radius: var(--zl-r-sm) !important;
      }

      zen-folder[data-zenleap-selected="true"] {
        outline: 2px solid var(--zl-selected) !important;
        outline-offset: -2px;
        background-color: var(--zl-selected-20) !important;
        border-radius: var(--zl-r-sm) !important;
      }

      zen-folder[data-zenleap-highlight="true"][data-zenleap-selected="true"] {
        outline: 2px solid var(--zl-highlight-selected) !important;
        outline-offset: -2px;
        background-color: var(--zl-highlight-selected-20) !important;
        border-radius: var(--zl-r-sm) !important;
      }

      /* ═══ Folder relative number badges ═══ */
      /* Badge is positioned inside .tab-group-label-container so it aligns
         with the folder label row (not the entire folder including child tabs). */
      zen-folder[data-zenleap-rel] > .tab-group-label-container {
        position: relative;
      }
      /* Clip the folder label text so it fades before hitting the badge.
         Zen's label is width:100% with no overflow handling, unlike tab labels. */
      zen-folder[data-zenleap-rel] > .tab-group-label-container > label.tab-group-label {
        overflow: hidden !important;
        text-overflow: ellipsis !important;
        white-space: nowrap !important;
        mask-image: linear-gradient(to right, black calc(100% - 30px), transparent 100%) !important;
      }
      zen-folder[data-zenleap-rel] > .tab-group-label-container::after {
        content: attr(data-zenleap-rel) !important;
        font-weight: bold !important;
        font-size: 80% !important;
        z-index: 100 !important;
        display: inline-block !important;
        background-color: var(--zl-badge-bg) !important;
        color: var(--zl-badge-color) !important;
        text-align: center !important;
        min-width: 20px !important;
        height: 20px !important;
        line-height: 20px !important;
        padding: 0 3px !important;
        border-radius: 4px !important;
        font-family: var(--zl-font-mono) !important;
        position: absolute !important;
        right: 11px !important; /* lines up with the tab badges' right edge */
        top: 50% !important;
        transform: translateY(-50%) !important;
      }
      zen-folder[data-zenleap-direction="current"] > .tab-group-label-container[data-zenleap-rel]::after {
        background-color: var(--zl-current-bg) !important;
        color: var(--zl-current-color) !important;
      }
      zen-folder[data-zenleap-direction="up"] > .tab-group-label-container[data-zenleap-rel]::after {
        background-color: var(--zl-up-bg) !important;
        color: var(--zl-current-color) !important;
      }
      zen-folder[data-zenleap-direction="down"] > .tab-group-label-container[data-zenleap-rel]::after {
        background-color: var(--zl-down-bg) !important;
        color: var(--zl-current-color) !important;
      }
      zen-folder[data-zenleap-highlight="true"] > .tab-group-label-container[data-zenleap-rel]::after {
        background-color: var(--zl-highlight) !important;
        color: var(--zl-current-color) !important;
        box-shadow: 0 0 8px var(--zl-highlight-60) !important;
      }

      /* ═══ Folder Delete Modal / browse close confirmation ═══ */
      #zenleap-folder-delete-modal,
      #zenleap-close-confirm-modal {
        display: none;
        position: fixed;
        inset: 0;
        z-index: 10001;
      }

      #zenleap-folder-delete-modal.active,
      #zenleap-close-confirm-modal.active {
        display: block;
      }

      .zenleap-folder-delete-backdrop {
        position: absolute;
        inset: 0;
        background: var(--zl-backdrop);
        backdrop-filter: blur(var(--zl-backdrop-blur));
      }

      .zenleap-folder-delete-container {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: var(--zl-bg-surface);
        border-radius: var(--zl-r-xl);
        box-shadow: var(--zl-shadow-modal);
        padding: 24px;
        min-width: 360px;
        max-width: 480px;
        font-family: var(--zl-font-ui);
        animation: zenleap-modal-enter 0.28s cubic-bezier(0.16, 1, 0.3, 1) both;
      }

      .zenleap-folder-delete-title {
        font-size: 14px;
        font-weight: 600;
        color: var(--zl-text-primary);
        margin-bottom: 16px;
        padding-bottom: 12px;
        border-bottom: 1px solid var(--zl-border-subtle);
      }

      .zenleap-folder-delete-option {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 10px 12px;
        border-radius: var(--zl-r-md);
        cursor: pointer;
        transition: background 0.12s;
      }

      .zenleap-folder-delete-option:hover {
        background: var(--zl-bg-raised);
      }

      .zenleap-folder-delete-option kbd {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 22px;
        height: 22px;
        padding: 0 7px;
        font-family: var(--zl-font-mono);
        font-size: 10px;
        font-weight: 600;
        color: var(--zl-text-secondary);
        background: var(--zl-bg-raised);
        border: 1px solid var(--zl-border-strong);
        border-radius: 5px;
        box-shadow: var(--zl-shadow-kbd);
      }

      .zenleap-folder-delete-option-text {
        display: flex;
        flex-direction: column;
      }

      .zenleap-folder-delete-label {
        color: var(--zl-text-primary);
        font-size: 13px;
        font-weight: 500;
      }

      .zenleap-folder-delete-sublabel {
        color: var(--zl-text-tertiary);
        font-size: 11px;
        margin-top: 2px;
      }

      .zenleap-folder-delete-option.destructive .zenleap-folder-delete-label {
        color: var(--zl-red);
      }
      .zenleap-folder-delete-option.destructive:hover {
        background: rgba(224,107,107,0.08);
      }

      /* Expanded sidebar mode */
      @media -moz-pref("zen.view.sidebar-expanded") {
        tab:not([zen-glance-tab="true"]) > .tab-stack > .tab-content[data-zenleap-rel]::after {
          content: attr(data-zenleap-rel) !important;
          font-weight: bold !important;
          font-size: 80% !important;
          z-index: 100 !important;
          display: inline-block !important;
          background-color: var(--zl-badge-bg) !important;
          color: var(--zl-badge-color) !important;
          text-align: center !important;
          min-width: 20px !important;
          height: 20px !important;
          line-height: 20px !important;
          padding: 0 3px !important;
          border-radius: 4px !important;
          margin-left: 3px !important;
          margin-right: 3px !important;
          font-family: var(--zl-font-mono) !important;
        }

        tab[data-zenleap-direction="current"]:not([zen-glance-tab="true"]) > .tab-stack > .tab-content[data-zenleap-rel]::after {
          background-color: var(--zl-current-bg) !important;
          color: var(--zl-current-color) !important;
        }

        tab[data-zenleap-direction="up"]:not([zen-glance-tab="true"]) > .tab-stack > .tab-content[data-zenleap-rel]::after {
          background-color: var(--zl-up-bg) !important;
          color: var(--zl-current-color) !important;
        }

        tab[data-zenleap-direction="down"]:not([zen-glance-tab="true"]) > .tab-stack > .tab-content[data-zenleap-rel]::after {
          background-color: var(--zl-down-bg) !important;
          color: var(--zl-current-color) !important;
        }

        /* Hide badge on hover to make room for close button */
        tab:not([zen-glance-tab="true"]):hover > .tab-stack > .tab-content[data-zenleap-rel]::after {
          display: none !important;
        }

        /* The badge sits where the close button is: on badged tabs, show the
           close button on hover only (untouched when badges are off) */
        tab:has(> .tab-stack > .tab-content[data-zenleap-rel]):not(:hover) .tab-close-button {
          display: none !important;
        }
        tab:has(> .tab-stack > .tab-content[data-zenleap-rel]):hover .tab-close-button {
          display: flex !important;
          visibility: visible !important;
          opacity: 1 !important;
        }

        /* Split views render as one row of mini tabs: the full-size inline
           badge overflows there, use a small pill at the tab's right edge */
        tab-group[split-view-group] tab > .tab-stack > .tab-content[data-zenleap-rel]::after {
          display: none !important;
        }
        tab-group[split-view-group] tab:not([zen-glance-tab="true"]) > .tab-stack > .tab-content[data-zenleap-rel]::before {
          content: attr(data-zenleap-rel) !important;
          position: absolute !important;
          top: 50% !important;
          right: 2px !important;
          transform: translateY(-50%) !important;
          min-width: 14px !important;
          height: 14px !important;
          line-height: 14px !important;
          padding: 0 2px !important;
          border-radius: 3px !important;
          font-weight: bold !important;
          font-size: 9px !important;
          text-align: center !important;
          z-index: 100 !important;
          background-color: var(--zl-badge-bg) !important;
          color: var(--zl-badge-color) !important;
          font-family: var(--zl-font-mono) !important;
        }
        tab-group[split-view-group] tab[data-zenleap-direction="current"] > .tab-stack > .tab-content[data-zenleap-rel]::before {
          background-color: var(--zl-current-bg) !important;
          color: var(--zl-current-color) !important;
        }
        tab-group[split-view-group] tab[data-zenleap-direction="up"] > .tab-stack > .tab-content[data-zenleap-rel]::before {
          background-color: var(--zl-up-bg) !important;
          color: var(--zl-current-color) !important;
        }
        tab-group[split-view-group] tab[data-zenleap-direction="down"] > .tab-stack > .tab-content[data-zenleap-rel]::before {
          background-color: var(--zl-down-bg) !important;
          color: var(--zl-current-color) !important;
        }
        tab-group[split-view-group] tab[data-zenleap-highlight="true"] > .tab-stack > .tab-content[data-zenleap-rel]::before {
          background-color: var(--zl-highlight) !important;
        }
        tab-group[split-view-group] tab[data-zenleap-has-mark="true"] > .tab-stack > .tab-content[data-zenleap-rel]::before {
          background-color: var(--zl-mark) !important;
        }

        /* Highlighted tab badge */
        tab[data-zenleap-highlight="true"]:not([zen-glance-tab="true"]) > .tab-stack > .tab-content[data-zenleap-rel]::after {
          background-color: var(--zl-highlight) !important;
          color: var(--zl-current-color) !important;
          box-shadow: 0 0 8px var(--zl-highlight-60) !important;
        }

        /* Marked tab badge */
        tab[data-zenleap-has-mark="true"]:not([zen-glance-tab="true"]) > .tab-stack > .tab-content[data-zenleap-rel]::after {
          background-color: var(--zl-mark) !important;
          color: var(--zl-current-color) !important;
          font-weight: bold !important;
          box-shadow: 0 0 6px var(--zl-mark-50) !important;
        }
      }

      /* ═══ Compact sidebar mode ═══ */
      @media not -moz-pref("zen.view.sidebar-expanded") {
        tab:not([zen-glance-tab="true"]) > .tab-stack > .tab-content[data-zenleap-rel]::before {
          content: attr(data-zenleap-rel) !important;
          position: absolute !important;
          top: 2px !important;
          right: 2px !important;
          font-weight: bold !important;
          font-size: 70% !important;
          z-index: 100 !important;
          color: var(--zl-badge-color) !important;
          font-family: var(--zl-font-mono) !important;
          text-shadow: 0 0 2px rgba(0,0,0,0.5) !important;
        }

        tab[data-zenleap-direction="current"]:not([zen-glance-tab="true"]) > .tab-stack > .tab-content[data-zenleap-rel]::before {
          color: var(--zl-current-bg) !important;
        }

        tab[data-zenleap-highlight="true"]:not([zen-glance-tab="true"]) > .tab-stack > .tab-content[data-zenleap-rel]::before {
          color: var(--zl-highlight) !important;
          text-shadow: 0 0 6px var(--zl-highlight-80) !important;
        }

        tab[data-zenleap-has-mark="true"]:not([zen-glance-tab="true"]) > .tab-stack > .tab-content[data-zenleap-rel]::before {
          color: var(--zl-mark) !important;
          text-shadow: 0 0 4px var(--zl-mark-80) !important;
          font-weight: bold !important;
        }
      }

      /* ═══ Leap mode active: direction colors ═══ */
      :root[data-zenleap-active="true"] tab[data-zenleap-direction="up"]:not([zen-glance-tab="true"]) > .tab-stack > .tab-content[data-zenleap-rel]::after,
      :root[data-zenleap-active="true"] tab[data-zenleap-direction="up"]:not([zen-glance-tab="true"]) > .tab-stack > .tab-content[data-zenleap-rel]::before {
        color: var(--zl-current-color) !important;
        background-color: var(--zl-up-bg) !important;
      }

      :root[data-zenleap-active="true"] tab[data-zenleap-direction="down"]:not([zen-glance-tab="true"]) > .tab-stack > .tab-content[data-zenleap-rel]::after,
      :root[data-zenleap-active="true"] tab[data-zenleap-direction="down"]:not([zen-glance-tab="true"]) > .tab-stack > .tab-content[data-zenleap-rel]::before {
        color: var(--zl-current-color) !important;
        background-color: var(--zl-down-bg) !important;
      }

      /* ═══ Mark mode: gray non-marked, enhance marked ═══ */
      :root[data-zenleap-active="true"][data-zenleap-mark-mode="true"] tab:not([data-zenleap-has-mark="true"]):not([zen-glance-tab="true"]) > .tab-stack > .tab-content[data-zenleap-rel]::after {
        color: var(--zl-text-muted) !important;
        background-color: var(--zl-badge-bg) !important;
        box-shadow: none !important;
      }

      :root[data-zenleap-active="true"][data-zenleap-mark-mode="true"] tab:not([data-zenleap-has-mark="true"]):not([zen-glance-tab="true"]) > .tab-stack > .tab-content[data-zenleap-rel]::before {
        color: var(--zl-text-muted) !important;
        text-shadow: none !important;
      }

      :root[data-zenleap-active="true"][data-zenleap-mark-mode="true"] tab[data-zenleap-has-mark="true"]:not([zen-glance-tab="true"]) > .tab-stack > .tab-content[data-zenleap-rel]::after {
        background-color: var(--zl-mark) !important;
        color: var(--zl-current-color) !important;
        box-shadow: 0 0 8px var(--zl-mark-70) !important;
      }

      :root[data-zenleap-active="true"][data-zenleap-mark-mode="true"] tab[data-zenleap-has-mark="true"]:not([zen-glance-tab="true"]) > .tab-stack > .tab-content[data-zenleap-rel]::before {
        color: var(--zl-mark) !important;
        text-shadow: 0 0 6px var(--zl-mark-90) !important;
      }

      /* ═══ Leap HUD (pill at bottom center) ═══ */
      #zenleap-overlay {
        display: none;
        position: fixed !important;
        bottom: 24px !important;
        left: 50% !important;
        transform: translateX(-50%) !important;
        z-index: 10000 !important;
        background: var(--zl-bg-surface) !important;
        border: 1px solid var(--zl-accent-border) !important;
        outline: none !important;
        border-radius: 14px !important;
        padding: 10px 22px !important;
        box-shadow: var(--zl-shadow-elevated), 0 0 30px var(--zl-accent-dim) !important;
        backdrop-filter: blur(var(--zl-backdrop-blur)) !important;
        pointer-events: none !important;
        animation: zenleap-hud-enter 0.25s cubic-bezier(0.16, 1, 0.3, 1) both;
        font-family: var(--zl-font-ui) !important;
        white-space: nowrap !important;
      }

      @keyframes zenleap-hud-enter {
        from { opacity: 0; transform: translateX(-50%) translateY(8px) scale(0.96); }
        to { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); }
      }

      #zenleap-overlay-content {
        display: flex !important;
        align-items: center !important;
        gap: 14px !important;
      }

      #zenleap-mode-label {
        font-size: 12px !important;
        font-weight: 700 !important;
        color: var(--zl-accent) !important;
        font-family: var(--zl-font-mono) !important;
        letter-spacing: 0.5px !important;
      }

      .zenleap-hud-sep {
        width: 1px !important;
        height: 16px !important;
        background: var(--zl-border-strong) !important;
        flex-shrink: 0 !important;
      }

      #zenleap-direction-label {
        font-size: 12px !important;
        font-weight: 600 !important;
        color: var(--zl-green) !important;
        font-family: var(--zl-font-mono) !important;
      }

      #zenleap-hint-label {
        font-size: 11px !important;
        color: var(--zl-text-tertiary) !important;
        font-family: var(--zl-font-mono) !important;
      }

      #zenleap-overlay.leap-direction-set #zenleap-hint-label {
        color: var(--zl-gold) !important;
      }

      /* Hide separators when their adjacent label is empty */
      #zenleap-direction-label:empty { display: none !important; }
      #zenleap-hint-label:empty { display: none !important; }
      /* Sep before direction: hide when direction is empty */
      .zenleap-hud-sep:has(+ #zenleap-direction-label:empty) { display: none !important; }
      /* Sep before hint: hide when hint is empty */
      .zenleap-hud-sep:has(+ #zenleap-hint-label:empty) { display: none !important; }

      /* ═══ gTile Overlay ═══ */
      #zenleap-gtile-overlay {
        position: fixed;
        top: 0; left: 0;
        width: 100vw; height: 100vh;
        z-index: 100003;
        display: none;
        justify-content: center;
        align-items: center;
        padding: 20px;
      }
      #zenleap-gtile-overlay.active { display: flex; }

      #zenleap-gtile-backdrop {
        position: absolute;
        top: 0; left: 0;
        width: 100%; height: 100%;
        background: var(--zl-backdrop);
        backdrop-filter: blur(var(--zl-backdrop-blur));
      }

      #zenleap-gtile-panel {
        position: relative;
        width: 95%;
        max-width: 640px;
        background: var(--zl-bg-surface);
        border-radius: var(--zl-r-xl);
        box-shadow: var(--zl-shadow-modal);
        overflow: hidden;
        display: flex;
        flex-direction: column;
        animation: zenleap-modal-enter 0.28s cubic-bezier(0.16, 1, 0.3, 1) both;
      }

      /* uses shared @keyframes zenleap-modal-enter from base styles */

      .zenleap-gtile-header {
        padding: 16px 20px 14px;
        border-bottom: 1px solid var(--zl-border-subtle);
        display: flex;
        align-items: center;
        justify-content: space-between;
      }
      .zenleap-gtile-title {
        font-size: 10px;
        font-weight: 600;
        color: var(--zl-text-tertiary);
        text-transform: uppercase;
        letter-spacing: 1.5px;
        font-family: var(--zl-font-ui);
      }

      .zenleap-gtile-mode-switch {
        position: relative;
        display: flex;
        background: var(--zl-border-subtle);
        border-radius: var(--zl-r-sm);
        padding: 2px;
        gap: 2px;
      }
      .zenleap-gtile-mode-slider {
        position: absolute;
        top: 2px; left: 2px;
        width: calc(50% - 2px);
        height: calc(100% - 4px);
        background: var(--zl-accent-dim);
        border: 1px solid var(--zl-accent-border);
        border-radius: var(--zl-r-sm);
        transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        pointer-events: none;
      }
      #zenleap-gtile-overlay.mode-resize .zenleap-gtile-mode-slider {
        transform: translateX(100%);
      }
      .gtile-mode-btn {
        position: relative;
        z-index: 1;
        padding: 5px 14px;
        border: none;
        background: transparent;
        color: var(--zl-text-tertiary);
        font-size: 11px;
        font-weight: 600;
        font-family: var(--zl-font-ui);
        letter-spacing: 0.3px;
        cursor: default;
        transition: color 0.15s;
        border-radius: var(--zl-r-sm);
        white-space: nowrap;
      }
      .gtile-mode-btn.active { color: var(--zl-accent); }

      #zenleap-gtile-grid {
        position: relative;
        margin: 16px;
        aspect-ratio: 16 / 9;
        border-radius: var(--zl-r-lg);
        background: var(--zl-border-subtle);
        border: 1px solid var(--zl-border-default);
        overflow: hidden;
        background-image:
          linear-gradient(to right, var(--zl-border-subtle) 1px, transparent 1px),
          linear-gradient(to bottom, var(--zl-border-subtle) 1px, transparent 1px);
        background-size: calc(100% / ${GTILE_COLS}) calc(100% / ${GTILE_ROWS});
        background-position: -1px -1px;
      }
      #zenleap-gtile-overlay.mode-resize #zenleap-gtile-grid {
        background-image:
          linear-gradient(to right, var(--zl-border-default) 1px, transparent 1px),
          linear-gradient(to bottom, var(--zl-border-default) 1px, transparent 1px);
      }

      .zenleap-gtile-region {
        position: absolute;
        border-radius: var(--zl-r-sm);
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        padding: 8px 10px;
        transition:
          inset 0.25s cubic-bezier(0.4, 0, 0.2, 1),
          background 0.15s, box-shadow 0.15s, border-color 0.15s;
        border: 1.5px solid transparent;
        overflow: hidden;
        user-select: none;
      }
      .zenleap-gtile-region::before {
        content: '';
        position: absolute;
        inset: 0;
        border-radius: inherit;
        opacity: 0.12;
        background: var(--region-hue);
        transition: opacity 0.15s;
      }
      .zenleap-gtile-region:hover::before,
      .zenleap-gtile-region.gtile-active::before { opacity: 0.18; }

      /* Region color variants (themed) */
      .zenleap-gtile-region[data-color="blue"]   { --region-hue: var(--zl-region-blue);   border-color: var(--zl-accent-border); }
      .zenleap-gtile-region[data-color="purple"] { --region-hue: var(--zl-region-purple); border-color: color-mix(in srgb, var(--zl-region-purple) 20%, transparent); }
      .zenleap-gtile-region[data-color="green"]  { --region-hue: var(--zl-region-green);  border-color: color-mix(in srgb, var(--zl-region-green) 20%, transparent); }
      .zenleap-gtile-region[data-color="yellow"] { --region-hue: var(--zl-region-gold);   border-color: color-mix(in srgb, var(--zl-region-gold) 20%, transparent); }

      .zenleap-gtile-region.gtile-active {
        z-index: 2;
        border-color: var(--zl-accent-glow) !important;
        box-shadow: 0 0 0 1px var(--zl-accent-border), 0 0 20px var(--zl-accent-dim);
      }
      .zenleap-gtile-region.gtile-held {
        z-index: 3;
        border-color: var(--zl-accent) !important;
        box-shadow: 0 0 0 2px var(--zl-accent-glow), 0 4px 24px var(--zl-accent-dim);
      }
      .zenleap-gtile-region.gtile-held::before { opacity: 0.25; }
      .zenleap-gtile-region.gtile-held .gtile-region-title { color: var(--zl-accent); }

      .zenleap-gtile-region.gtile-dragging {
        z-index: 10;
        border-color: var(--zl-accent) !important;
        box-shadow: 0 0 0 2px var(--zl-accent-glow), 0 8px 32px var(--zl-accent-mid), 0 16px 48px rgba(0,0,0,0.4);
        transform: scale(1.03);
        cursor: grabbing;
        pointer-events: none;
        transition: transform 0.12s ease-out, box-shadow 0.15s, border-color 0.15s;
      }
      .zenleap-gtile-region.gtile-dragging::before { opacity: 0.25; }
      .zenleap-gtile-region.gtile-dragging .gtile-region-title { color: var(--zl-accent); }

      .zenleap-gtile-region.gtile-swap-target {
        z-index: 1;
        border-color: var(--zl-accent-glow) !important;
      }
      .zenleap-gtile-region.gtile-swap-target::before { opacity: 0.2; }

      .zenleap-gtile-ghost {
        position: absolute;
        border-radius: var(--zl-r-sm);
        border: 1.5px dashed var(--zl-accent-border);
        background: var(--zl-accent-dim);
        pointer-events: none;
        z-index: 0;
        transition: inset 0.25s cubic-bezier(0.4, 0, 0.2, 1);
      }

      #zenleap-gtile-overlay.mode-move .zenleap-gtile-region { cursor: grab; }
      #zenleap-gtile-overlay.mode-move .zenleap-gtile-region.gtile-dragging { cursor: grabbing; }

      .gtile-region-title {
        position: relative;
        font-size: 11px;
        font-weight: 500;
        color: var(--zl-text-secondary);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        font-family: var(--zl-font-ui);
        transition: color 0.15s;
        line-height: 1.3;
      }
      .zenleap-gtile-region.gtile-active .gtile-region-title { color: var(--zl-text-primary); }
      .gtile-region-badge {
        position: relative;
        font-size: 9px;
        font-weight: 500;
        color: var(--zl-text-muted);
        font-family: var(--zl-font-mono);
        letter-spacing: 0.3px;
        transition: color 0.15s;
      }
      .zenleap-gtile-region.gtile-active .gtile-region-badge { color: var(--zl-text-tertiary); }

      .zenleap-gtile-cell-layer {
        position: absolute;
        inset: 0;
        display: grid;
        grid-template-columns: repeat(${GTILE_COLS}, 1fr);
        grid-template-rows: repeat(${GTILE_ROWS}, 1fr);
        gap: 0;
        z-index: 5;
        opacity: 0;
        pointer-events: none;
        transition: opacity 0.15s;
      }
      #zenleap-gtile-overlay.mode-resize .zenleap-gtile-cell-layer {
        opacity: 1;
        pointer-events: auto;
      }
      .zenleap-gtile-cell {
        border: 1px solid transparent;
        border-radius: 3px;
        margin: 2px;
        transition: background 0.08s, border-color 0.08s;
        cursor: crosshair;
      }
      .zenleap-gtile-cell.gtile-cursor {
        border-color: rgba(255,255,255,0.6);
        background: rgba(255,255,255,0.08);
        box-shadow: inset 0 0 0 1px rgba(255,255,255,0.15);
      }
      .zenleap-gtile-cell.gtile-selected {
        background: var(--zl-accent-glow);
        border-color: var(--zl-accent-glow);
      }
      .zenleap-gtile-cell.gtile-selected.gtile-cursor {
        background: var(--zl-accent-glow);
        border-color: var(--zl-accent);
        box-shadow: 0 0 8px var(--zl-accent-dim);
      }

      .zenleap-gtile-sel {
        position: absolute;
        z-index: 4;
        border-radius: var(--zl-r-sm);
        border: 2px solid var(--zl-accent-glow);
        background: var(--zl-accent-dim);
        pointer-events: none;
        opacity: 0;
        transition: opacity 0.12s, inset 0.1s;
      }
      #zenleap-gtile-overlay.mode-resize .zenleap-gtile-sel.visible { opacity: 1; }

      #zenleap-gtile-hints {
        display: flex;
        gap: 10px;
        justify-content: center;
        flex-wrap: wrap;
        padding: 8px 16px;
        border-top: 1px solid var(--zl-border-subtle);
        font-size: 11px;
        color: var(--zl-text-muted);
        font-family: var(--zl-font-ui);
      }
      #zenleap-gtile-hints kbd {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 18px;
        height: 18px;
        padding: 0 5px;
        font-family: var(--zl-font-mono);
        font-size: 9px;
        font-weight: 600;
        color: var(--zl-text-secondary);
        background: var(--zl-bg-raised);
        border: 1px solid var(--zl-border-strong);
        border-radius: 4px;
        box-shadow: var(--zl-shadow-kbd);
        margin-right: 2px;
      }

      .zenleap-gtile-target-info {
        display: none;
        align-items: center;
        gap: 10px;
        min-width: 0;
        flex: 1;
        margin-right: 16px;
        overflow: hidden;
      }
      #zenleap-gtile-overlay.mode-resize .zenleap-gtile-title { display: none; }
      #zenleap-gtile-overlay.mode-resize .zenleap-gtile-target-info {
        display: flex;
        animation: gtile-target-fadein 0.18s ease-out;
      }
      @keyframes gtile-target-fadein {
        from { opacity: 0; transform: translateX(-6px); }
        to { opacity: 1; transform: translateX(0); }
      }

      .gtile-target-dot {
        width: 8px; height: 8px;
        border-radius: 50%;
        background: var(--target-hue, var(--zl-accent));
        flex-shrink: 0;
        box-shadow: 0 0 8px var(--target-hue, var(--zl-accent));
        animation: gtile-dot-pulse 2.4s ease-in-out infinite;
      }
      @keyframes gtile-dot-pulse {
        0%, 100% { opacity: 0.8; }
        50% { opacity: 1; }
      }

      .gtile-target-label {
        font-size: 10px;
        font-weight: 600;
        color: var(--zl-text-muted);
        text-transform: uppercase;
        letter-spacing: 0.5px;
        font-family: var(--zl-font-ui);
        flex-shrink: 0;
      }
      .gtile-target-name {
        font-size: 12px;
        font-weight: 500;
        color: var(--zl-text-secondary);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        font-family: var(--zl-font-ui);
        flex: 1;
        min-width: 0;
      }

      #zenleap-gtile-overlay.mode-resize .zenleap-gtile-region.gtile-resize-target {
        z-index: 3;
        border-color: var(--region-hue) !important;
        border-width: 2px;
        box-shadow:
          0 0 0 1px color-mix(in srgb, var(--region-hue) 35%, transparent),
          0 0 20px color-mix(in srgb, var(--region-hue) 15%, transparent);
      }
      #zenleap-gtile-overlay.mode-resize .zenleap-gtile-region.gtile-resize-target::before { opacity: 0.22; }
      #zenleap-gtile-overlay.mode-resize .zenleap-gtile-region.gtile-resize-target .gtile-region-title { color: var(--zl-text-primary); }
      #zenleap-gtile-overlay.mode-resize .zenleap-gtile-region.gtile-resize-target .gtile-region-badge { color: var(--zl-text-secondary); }

      #zenleap-gtile-overlay.mode-resize .zenleap-gtile-region:not(.gtile-resize-target) {
        opacity: 0.4;
        transition: opacity 0.2s ease-out;
        cursor: pointer;
      }
      #zenleap-gtile-overlay.mode-resize .zenleap-gtile-region:not(.gtile-resize-target)::before { opacity: 0.05; }

      #zenleap-gtile-grid.gtile-rotated { animation: gtile-rotate-pulse 0.4s ease-out; }
      @keyframes gtile-rotate-pulse {
        0% { border-color: var(--zl-accent-glow); box-shadow: inset 0 0 24px var(--zl-accent-dim); }
        100% { border-color: var(--zl-border-default); box-shadow: none; }
      }
      #zenleap-gtile-grid.gtile-reset { animation: gtile-reset-pulse 0.4s ease-out; }
      @keyframes gtile-reset-pulse {
        0% { border-color: var(--zl-green); box-shadow: inset 0 0 24px rgba(110,196,125,0.07); }
        100% { border-color: var(--zl-border-default); box-shadow: none; }
      }
      #zenleap-gtile-grid.gtile-error {
        animation: gtile-shake 0.35s ease-out;
        border-color: var(--zl-red) !important;
      }
      @keyframes gtile-shake {
        0%, 100% { transform: translateX(0); }
        20% { transform: translateX(-3px); }
        40% { transform: translateX(3px); }
        60% { transform: translateX(-2px); }
        80% { transform: translateX(2px); }
      }

      #zenleap-gtile-panel { scrollbar-width: thin; scrollbar-color: var(--zl-border-strong) transparent; }
    `;
    document.head.appendChild(style);
    applyTheme();
    log('Styles injected');
  }

  // Logging utility
  function log(message) {
    if (CONFIG.debug) {
      console.log(`[ZenLeap] ${message}`);
    }
  }

  // ============================================
  // LIFECYCLE: init, teardown registry, Sine hot-unload
  // ============================================

  // Oldest Zen release this version targets. Older builds still load, but get
  // one console warning (fallbacks for pre-floor versions were removed).
  const MIN_ZEN_VERSION = '1.21.7b';

  // Teardown registry. Window-lifetime listeners pass this signal (see listen())
  // so teardown removes them all at once; observers, wrappers and other
  // resources register a callback with onTeardown().
  const _lifetime = new AbortController();
  const _teardownCallbacks = [];
  let _tornDown = false;

  function onTeardown(fn) {
    _teardownCallbacks.push(fn);
  }

  // addEventListener bound to this instance's lifetime.
  function listen(target, type, handler, options = {}) {
    if (typeof options === 'boolean') options = { capture: options };
    target.addEventListener(type, handler, { ...options, signal: _lifetime.signal });
  }

  // setTimeout that teardown cancels (for deferred init-time work).
  function lifetimeTimeout(fn, ms) {
    const id = setTimeout(() => { if (!_tornDown) fn(); }, ms);
    onTeardown(() => clearTimeout(id));
    return id;
  }

  // Compare "1.22.3b"-style versions numerically (suffix letters are ignored).
  function zenVersionAtLeast(version, min) {
    const parse = v => String(v).trim().replace(/[a-z]+\d*$/i, '').split('.').map(n => parseInt(n, 10) || 0);
    const a = parse(version), b = parse(min);
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
      if ((a[i] || 0) !== (b[i] || 0)) return (a[i] || 0) > (b[i] || 0);
    }
    return true;
  }

  function warnIfZenTooOld() {
    try {
      const version = Services.appinfo.version;
      if (zenVersionAtLeast(version, MIN_ZEN_VERSION)) return;
      if (!isFirstBrowserWindow()) return;
      console.warn(`[ZenLeap] Zen ${version} is older than the minimum supported version ${MIN_ZEN_VERSION}. Some features may not work; please update Zen Browser.`);
    } catch (e) { /* appinfo unavailable */ }
  }

  // Session-wide warnings are logged from the first browser window only.
  function isFirstBrowserWindow() {
    try {
      let windows = 0;
      for (const _w of Services.wm.getEnumerator('navigator:browser')) windows++;
      return windows <= 1;
    } catch (e) {
      return true;
    }
  }

  // Attributes ZenLeap sets on tabs, folders, the URL bar and :root.
  const ZENLEAP_ATTRS = [
    'data-zenleap-rel', 'data-zenleap-direction', 'data-zenleap-distance', 'data-zenleap-has-mark',
    'data-zenleap-mark', 'data-zenleap-highlight', 'data-zenleap-selected', 'data-zenleap-vim',
    'data-zenleap-active', 'data-zenleap-mark-mode', 'data-zenleap-badges',
  ];

  // Close every ZenLeap mode/overlay without side effects on the page.
  function exitAllModes() {
    const steps = [
      () => { if (gtileMode) exitGtileMode(false); },
      () => { if (reorgMode) exitReorgMode(false); },
      () => { if (settingsMode) exitSettingsMode(); },
      () => { if (helpMode) exitHelpMode(); },
      () => { if (searchMode) exitSearchMode(); },
      () => { if (folderDeleteMode) closeFolderDeleteModal(); },
      () => { if (leapMode || browseMode) exitLeapMode(false); },
      () => { if (updateMode) exitUpdateMode(); },
      () => { if (_pluginManagerMode) exitPluginManagerMode(); },
      () => { if (updateToast) dismissUpdateToast(false); },
      () => { if (quickNavPeeking || sidebarWasExpanded) { hideFloatingSidebar(); quickNavPeeking = false; } },
    ];
    for (const step of steps) {
      try { step(); } catch (e) { reportError('Closing mode during teardown failed', e); }
    }
  }

  // Remove everything this instance added. `full` (Sine unload / disable / hot
  // reload) also removes ZenLeap's DOM, attributes and theme overrides so a
  // re-injected copy starts clean; on window unload the DOM goes away anyway.
  function teardown({ full = true } = {}) {
    if (_tornDown) return;
    if (full) exitAllModes();
    disarmAllModeGuards();
    _tornDown = true;

    _lifetime.abort();
    for (const fn of _teardownCallbacks.splice(0).reverse()) {
      try { fn(); } catch (e) { reportError('Teardown step failed', e); }
    }
    for (const t of [leapModeTimeout, gNumberTimeout, browseGTimeout, browseNumberTimeout, previewDebounceTimer,
                     quickNavPeekTimer, quickNavRestoreTimer, jjPendingTimeout, urlbarJjPendingTimeout,
                     _searchInputDebounceTimer]) {
      clearTimeout(t);
    }
    if (_relNumRafId) cancelAnimationFrame(_relNumRafId);

    // Plugins (destroy hooks, sandboxes, data flush), the settings/update
    // observers and the dialog key router of the commands region.
    try { teardownPluginSystem(); } catch (e) { reportError('Plugin teardown failed', e); }

    if (full) {
      try {
        // ZenLeap's elements, and the id-less ones appended to the root
        // (plugin dialogs, the settings toast)
        for (const el of document.querySelectorAll('[id^="zenleap-"], :root > [class^="zenleap-"], :root > [class*=" zenleap-"]')) {
          el.remove();
        }
        const attrSelector = ZENLEAP_ATTRS.map(a => `[${a}]`).join(',');
        for (const el of document.querySelectorAll(attrSelector)) {
          for (const a of ZENLEAP_ATTRS) el.removeAttribute(a);
        }
        for (const a of ZENLEAP_ATTRS) document.documentElement.removeAttribute(a);
        const rootStyle = document.documentElement.style;
        for (const prop of [...rootStyle]) {
          if (prop.startsWith('--zl-')) rootStyle.removeProperty(prop);
        }
        revertBrowserTheme();
      } catch (e) { reportError('Removing ZenLeap DOM failed', e); }
      // Let a re-injected copy (Sine hot reload) initialize.
      delete window.__zenleapLoaded;
    }
    log(`ZenLeap torn down (${full ? 'full' : 'window unload'})`);
  }

  // Initialize
  let initRetries = 0;
  const MAX_INIT_RETRIES = 40;
  let _zenleapInitDone = false;
  let _folderObserver = null;         // MutationObserver for folder collapse/expand

  function init() {
    if (_zenleapInitDone || _tornDown) {
      log('ZenLeap already initialized, skipping re-init');
      return;
    }

    log(`Initializing ZenLeap v${VERSION}...`);

    if (!window.gBrowser?.tabs || !window.gZenWorkspaces) {
      initRetries++;
      if (initRetries > MAX_INIT_RETRIES) {
        console.error('[ZenLeap] Failed to initialize after ' + MAX_INIT_RETRIES + ' retries. gBrowser not available.');
        return;
      }
      log(`gBrowser not ready, retrying (attempt ${initRetries}/${MAX_INIT_RETRIES})`);
      lifetimeTimeout(init, initRetries < 5 ? 50 : 500);
      return;
    }

    _zenleapInitDone = true;
    warnIfZenTooOld();

    injectStyles();
    // Load user themes async; re-apply theme once loaded (built-in applies immediately via injectStyles)
    loadUserThemes().then(() => { if (!_tornDown) applyTheme(); });
    ensureThemesFile();
    initPluginSystem().catch(e => console.error('[ZenLeap] Plugin system init failed:', e));
    setupTabListeners();
    setupKeyboardListener();
    setupUrlbarVimMode();
    setupWorkspaceThemeHook();
    updateRelativeNumbers();

    // Window unload: remove listeners/observers (prevents shutdown hangs), flush data.
    listen(window, 'unload', () => teardown({ full: false }), { once: true });

    log(`ZenLeap v${VERSION} initialized successfully!`);

    // Restore essential tab marks (delayed to let essential tabs finish loading URLs)
    lifetimeTimeout(() => restoreEssentialMarks(), 2000);

    // Zen loads its shortcut registry asynchronously; check for collisions later
    if (isFirstBrowserWindow()) lifetimeTimeout(() => warnShortcutConflicts(), 5000);

    // Detect Sine install, then auto-check for updates (delayed to not block startup)
    detectSineInstall().then(() => {
      lifetimeTimeout(() => autoCheckForUpdates(), 5000);
    });
  }

  // Sine (>= Jun 2026) hot-unloads mods through this hook: on disable, update or
  // rebuild it calls the callback, then may re-inject the script. It attributes
  // the callback to this file via Components.stack, so register synchronously.
  try {
    window.addUnloadListener?.(() => teardown({ full: true }));
  } catch (e) { reportError('Registering Sine unload listener failed', e); }

  // Start initialization. fx-autoconfig injects during the window's
  // DOMContentLoaded (readyState "interactive") and Sine on "load" ("complete"),
  // so normally init runs now. Only wait while still "loading", and only for
  // this document's own event: tab-modal prompts and parent-process pages
  // (about:preferences) bubble their DOMContentLoaded up to this document.
  if (document.readyState === 'loading') {
    listen(document, 'DOMContentLoaded', function onChromeDocReady(event) {
      if (event.target !== document) return;
      document.removeEventListener('DOMContentLoaded', onChromeDocReady);
      init();
    });
  } else {
    init();
  }

})();
