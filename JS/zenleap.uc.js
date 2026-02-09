// ==UserScript==
// @name           ZenLeap - Relative Tab Navigation
// @description    Vim-style relative tab numbering with keyboard navigation
// @include        main
// @author         ZenLeap
// @version        2.6.0  // Keep in sync with VERSION constant below
// ==/UserScript==

(function() {
  'use strict';

  // Version - keep in sync with @version in header above
  const VERSION = '2.7.0';

  // ============================================
  // SETTINGS SYSTEM
  // ============================================

  const SETTINGS_SCHEMA = {
    // --- Keybindings: Global Triggers (combo type — key + modifiers) ---
    'keys.global.leapMode':        { default: { key: ' ', ctrl: true, shift: false, alt: false, meta: false }, type: 'combo', label: 'Leap Mode Toggle', description: 'Toggle leap mode on/off', category: 'Keybindings', group: 'Global Triggers' },
    'keys.global.search':          { default: { key: '/', ctrl: true, shift: false, alt: false, meta: false }, type: 'combo', label: 'Tab Search', description: 'Open tab search', category: 'Keybindings', group: 'Global Triggers' },
    'keys.global.commandPalette':  { default: { key: '?', ctrl: true, shift: true, alt: false, meta: false }, type: 'combo', label: 'Command Palette', description: 'Open command palette directly (Ctrl+Shift+/)', category: 'Keybindings', group: 'Global Triggers' },
    'keys.global.quickMark':       { default: { key: "'", ctrl: true, shift: false, alt: false, meta: false }, type: 'combo', label: 'Quick Jump to Mark', description: 'Jump to mark without leap mode', category: 'Keybindings', group: 'Global Triggers' },
    'keys.global.splitFocusLeft':  { default: { key: 'h', code: 'KeyH', ctrl: false, shift: false, alt: true, meta: false }, type: 'combo', label: 'Split Focus Left',  description: 'Focus split pane to the left',  category: 'Keybindings', group: 'Global Triggers' },
    'keys.global.splitFocusDown':  { default: { key: 'j', code: 'KeyJ', ctrl: false, shift: false, alt: true, meta: false }, type: 'combo', label: 'Split Focus Down',  description: 'Focus split pane below',         category: 'Keybindings', group: 'Global Triggers' },
    'keys.global.splitFocusUp':    { default: { key: 'k', code: 'KeyK', ctrl: false, shift: false, alt: true, meta: false }, type: 'combo', label: 'Split Focus Up',    description: 'Focus split pane above',         category: 'Keybindings', group: 'Global Triggers' },
    'keys.global.splitFocusRight': { default: { key: 'l', code: 'KeyL', ctrl: false, shift: false, alt: true, meta: false }, type: 'combo', label: 'Split Focus Right', description: 'Focus split pane to the right', category: 'Keybindings', group: 'Global Triggers' },

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
    'timing.workspaceSwitchDelay': { default: 100, type: 'number', label: 'Workspace Switch Delay', description: 'UI update delay after switch (ms)', category: 'Timing', group: 'Delays', min: 50, max: 1000, step: 10 },
    'timing.unloadTabDelay':       { default: 500, type: 'number', label: 'Unload Tab Delay', description: 'Delay before discarding tab (ms)', category: 'Timing', group: 'Delays', min: 100, max: 3000, step: 50 },
    'timing.previewDelay':         { default: 500, type: 'number', label: 'Browse Preview Delay', description: 'Delay before showing tab preview in browse mode (ms)', category: 'Timing', group: 'Delays', min: 0, max: 2000, step: 50 },

    // --- Display ---
    'display.currentTabIndicator': { default: '\u00B7', type: 'text', label: 'Current Tab Indicator', description: 'Badge character on current tab', category: 'Display', group: 'Tab Badges', maxLength: 2 },
    'display.overflowIndicator':   { default: '+', type: 'text', label: 'Overflow Indicator', description: 'Badge for positions > 45', category: 'Display', group: 'Tab Badges', maxLength: 2 },
    'display.vimModeInBars':        { default: true, type: 'toggle', label: 'Vim Mode in Search/Command', description: 'Enable vim normal mode in search and command bars. When off, Escape always closes the bar.', category: 'Display', group: 'Search' },
    'display.searchAllWorkspaces':  { default: false, type: 'toggle', label: 'Search All Workspaces', description: 'Search tabs across all workspaces, not just the current one', category: 'Display', group: 'Search' },
    'display.ggSkipPinned':         { default: true, type: 'toggle', label: 'gg Skips Pinned Tabs', description: 'When enabled, gg in browse/g-mode jumps to first unpinned tab instead of absolute first', category: 'Display', group: 'Navigation' },
    'display.tabAsEnter':           { default: false, type: 'toggle', label: 'Tab Acts as Enter', description: 'When enabled, Tab executes commands like Enter in the command palette. When off, Tab only performs its explicit bindings (e.g. toggle workspace search).', category: 'Display', group: 'Search' },
    'display.browsePreview':        { default: true, type: 'toggle', label: 'Browse Preview', description: 'Show a floating thumbnail preview of the highlighted tab in browse mode', category: 'Display', group: 'Navigation' },
    'display.maxSearchResults':    { default: 100, type: 'number', label: 'Max Search Results', description: 'Maximum results in tab search', category: 'Display', group: 'Search', min: 10, max: 500, step: 10 },
    'display.maxJumpListSize':     { default: 100, type: 'number', label: 'Max Jump History', description: 'Maximum jump history entries', category: 'Display', group: 'History', min: 10, max: 500, step: 10 },

    // --- Appearance ---
    'appearance.accentColor':      { default: '#61afef', type: 'color', label: 'Accent Color', description: 'Primary accent used for highlights and indicators', category: 'Appearance', group: 'Core Colors' },
    'appearance.currentTabBg':     { default: '#61afef', type: 'color', label: 'Current Tab Badge', description: 'Background of the current tab badge', category: 'Appearance', group: 'Tab Badges' },
    'appearance.currentTabColor':  { default: '#1e1e1e', type: 'color', label: 'Current Tab Badge Text', description: 'Text color of the current tab badge', category: 'Appearance', group: 'Tab Badges' },
    'appearance.badgeBg':          { default: '#505050', type: 'color', label: 'Default Badge Background', description: 'Background of regular tab badges', category: 'Appearance', group: 'Tab Badges' },
    'appearance.badgeColor':       { default: '#e0e0e0', type: 'color', label: 'Default Badge Text', description: 'Text color of regular tab badges', category: 'Appearance', group: 'Tab Badges' },
    'appearance.upDirectionBg':    { default: '#455a6f', type: 'color', label: 'Up Direction Badge', description: 'Badge color for tabs above current', category: 'Appearance', group: 'Tab Badges' },
    'appearance.downDirectionBg':  { default: '#455a6f', type: 'color', label: 'Down Direction Badge', description: 'Badge color for tabs below current', category: 'Appearance', group: 'Tab Badges' },
    'appearance.markColor':        { default: '#e06c75', type: 'color', label: 'Mark Indicator', description: 'Color for marked tab badges', category: 'Appearance', group: 'Marks & Selection' },
    'appearance.highlightBorder':  { default: '#61afef', type: 'color', label: 'Browse Highlight', description: 'Outline color of highlighted tab in browse mode', category: 'Appearance', group: 'Marks & Selection' },
    'appearance.selectedBorder':   { default: '#c678dd', type: 'color', label: 'Multi-Select Border', description: 'Outline color of selected tabs', category: 'Appearance', group: 'Marks & Selection' },

    // --- Advanced ---
    'advanced.debug':              { default: false, type: 'toggle', label: 'Debug Logging', description: 'Log actions to browser console', category: 'Advanced', group: 'Debugging' },
    'advanced.tabRecencyFloor':    { default: 0.8, type: 'number', label: 'Tab Recency Floor', description: 'Minimum recency multiplier', category: 'Advanced', group: 'Recency Tuning', min: 0, max: 2, step: 0.1 },
    'advanced.tabRecencyRange':    { default: 1.0, type: 'number', label: 'Tab Recency Range', description: 'Recency multiplier range', category: 'Advanced', group: 'Recency Tuning', min: 0, max: 5, step: 0.1 },
    'advanced.tabRecencyHalflife': { default: 12, type: 'number', label: 'Tab Recency Halflife', description: 'Minutes until 50% decay', category: 'Advanced', group: 'Recency Tuning', min: 1, max: 120, step: 1 },
    'advanced.cmdRecencyFloor':    { default: 0.8, type: 'number', label: 'Command Recency Floor', description: 'Minimum recency multiplier', category: 'Advanced', group: 'Recency Tuning', min: 0, max: 2, step: 0.1 },
    'advanced.cmdRecencyRange':    { default: 2.2, type: 'number', label: 'Command Recency Range', description: 'Recency multiplier range', category: 'Advanced', group: 'Recency Tuning', min: 0, max: 5, step: 0.1 },
    'advanced.cmdRecencyHalflife': { default: 30, type: 'number', label: 'Command Recency Halflife', description: 'Minutes until 50% decay', category: 'Advanced', group: 'Recency Tuning', min: 1, max: 120, step: 1 },
  };

  // Current settings (defaults + saved overrides)
  const S = {};

  function loadSettings() {
    for (const [id, schema] of Object.entries(SETTINGS_SCHEMA)) {
      S[id] = typeof schema.default === 'object' ? JSON.parse(JSON.stringify(schema.default)) : schema.default;
    }
    try {
      if (Services?.prefs?.getPrefType('uc.zenleap.settings') === Services.prefs.PREF_STRING) {
        try {
          const saved = JSON.parse(Services.prefs.getStringPref('uc.zenleap.settings'));
          for (const [id, value] of Object.entries(saved)) {
            if (SETTINGS_SCHEMA[id]) S[id] = value;
          }
        } catch (parseErr) { /* corrupt JSON in saved settings, using defaults */ }
      }
      // Migrate legacy prefs
      if (Services?.prefs?.getPrefType('uc.zenleap.debug') === Services.prefs.PREF_BOOL) {
        S['advanced.debug'] = Services.prefs.getBoolPref('uc.zenleap.debug');
      }
      if (Services?.prefs?.getPrefType('uc.zenleap.current_indicator') === Services.prefs.PREF_STRING) {
        const ind = Services.prefs.getStringPref('uc.zenleap.current_indicator');
        if (ind) S['display.currentTabIndicator'] = ind;
      }
    } catch (e) { /* Services not available */ }
  }

  function saveSettings() {
    const overrides = {};
    for (const [id, schema] of Object.entries(SETTINGS_SCHEMA)) {
      if (JSON.stringify(S[id]) !== JSON.stringify(schema.default)) {
        overrides[id] = S[id];
      }
    }
    try { Services.prefs.setStringPref('uc.zenleap.settings', JSON.stringify(overrides)); } catch (e) {}
  }

  function resetSetting(id) {
    const schema = SETTINGS_SCHEMA[id];
    if (!schema) return;
    S[id] = typeof schema.default === 'object' ? JSON.parse(JSON.stringify(schema.default)) : schema.default;
    saveSettings();
    if (schema.type === 'color') applyThemeColors();
  }

  function resetAllSettings() {
    for (const [id, schema] of Object.entries(SETTINGS_SCHEMA)) {
      S[id] = typeof schema.default === 'object' ? JSON.parse(JSON.stringify(schema.default)) : schema.default;
    }
    saveSettings();
    applyThemeColors();
  }

  // Helper: check if a keyboard event matches a combo-type setting
  function matchCombo(event, combo) {
    if (!combo || typeof combo !== 'object') return false;
    const keyMatch = event.key === combo.key ||
      (combo.code && event.code === combo.code);
    return keyMatch &&
      !!event.ctrlKey === !!combo.ctrl &&
      !!event.shiftKey === !!combo.shift &&
      !!event.altKey === !!combo.alt &&
      !!event.metaKey === !!combo.meta;
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
    return map[key] || (key?.length === 1 ? key : key);
  }

  loadSettings();

  // Legacy CONFIG compat — thin wrapper around S for any remaining references
  const CONFIG = {
    get debug() { return S['advanced.debug']; },
    get currentTabIndicator() { return S['display.currentTabIndicator']; },
    get overflowIndicator() { return S['display.overflowIndicator']; },
    get leapModeTimeout() { return S['timing.leapTimeout']; },
    get triggerKey() { return S['keys.global.leapMode'].key; },
    get triggerModifier() { return 'ctrlKey'; },
  };

  // Special characters for distances 36-45 (shift + number row)
  const SPECIAL_CHARS = ['!', '@', '#', '$', '%', '^', '&', '*', '(', ')'];

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

  // Browse mode state
  let highlightedTabIndex = -1;
  let originalTabIndex = -1;
  let originalTab = null;      // direct reference to the tab that triggered browse mode
  let browseDirection = null;  // 'up' or 'down' - initial direction
  let browseGPending = false;  // true after pressing 'g' in browse mode, waiting for second 'g'
  let browseGTimeout = null;   // timeout to cancel pending 'g' in browse mode
  let selectedTabs = new Set();  // Set of tab references for multi-select
  let yankBuffer = [];           // Array of tab references for yank/paste

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

  // Input interception: prevent keyboard events from leaking to web page content
  let contentFocusStolen = false;

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
  let searchModal = null;
  let searchInput = null;
  let searchInputDisplay = null;  // Visual display for normal mode with block cursor
  let searchResultsList = null;
  let searchHintBar = null;       // Hint bar below results
  let searchVimIndicator = null;
  let searchBreadcrumb = null;    // Breadcrumb for command sub-flows

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

  // Help modal
  let helpMode = false;
  let helpModal = null;

  // Settings modal
  let settingsMode = false;
  let settingsModal = null;
  let settingsActiveTab = 'Keybindings';
  let settingsSearchQuery = '';
  let settingsRecordingId = null;
  let settingsRecordingHandler = null;

  // Utility: Convert number to display character
  function numberToDisplay(num) {
    if (num === 0) return CONFIG.currentTabIndicator;
    if (num >= 1 && num <= 9) return String(num);
    if (num >= 10 && num <= 35) return String.fromCharCode(65 + num - 10); // A-Z
    if (num >= 36 && num <= 45) return SPECIAL_CHARS[num - 36];
    return CONFIG.overflowIndicator;
  }

  // Utility: Convert display character back to number
  function displayToNumber(char) {
    if (char >= '1' && char <= '9') return parseInt(char);
    const upper = char.toUpperCase();
    if (upper >= 'A' && upper <= 'Z') return upper.charCodeAt(0) - 65 + 10;
    const specialIndex = SPECIAL_CHARS.indexOf(char);
    if (specialIndex !== -1) return 36 + specialIndex;
    return null;
  }

  // ============================================
  // JUMP LIST (like vim's Ctrl+O / Ctrl+I)
  // ============================================

  // Clean up closed tabs from jump list, preserving correct index
  function filterJumpList() {
    if (jumpList.length === 0) return;
    const currentEntry = (jumpListIndex >= 0 && jumpListIndex < jumpList.length)
      ? jumpList[jumpListIndex] : null;
    jumpList = jumpList.filter(t => t && !t.closing && t.parentNode);
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

    // Trim if too long
    if (jumpList.length > S['display.maxJumpListSize']) {
      jumpList.shift();
      jumpListIndex--;
    }

    log(`Recorded jump, list size: ${jumpList.length}, index: ${jumpListIndex}`);
  }

  // Jump backward in the jump list (like vim Ctrl+O)
  function jumpBack() {
    // Clean up closed tabs
    filterJumpList();

    if (jumpList.length === 0) {
      log('Jump list is empty');
      return false;
    }

    // If we haven't recorded current position yet, do it now
    if (jumpListIndex === jumpList.length - 1 && gBrowser.selectedTab !== jumpList[jumpListIndex]) {
      recordJump(gBrowser.selectedTab);
    }

    if (jumpListIndex > 0) {
      jumpListIndex--;
      recordingJumps = false;  // Don't record this navigation
      gBrowser.selectedTab = jumpList[jumpListIndex];
      recordingJumps = true;
      log(`Jumped back to index ${jumpListIndex}`);
      return true;
    }

    log('Already at beginning of jump list');
    return false;
  }

  // Jump forward in the jump list (like vim Ctrl+I)
  function jumpForward() {
    // Clean up closed tabs
    filterJumpList();

    if (jumpListIndex < jumpList.length - 1) {
      jumpListIndex++;
      recordingJumps = false;  // Don't record this navigation
      gBrowser.selectedTab = jumpList[jumpListIndex];
      recordingJumps = true;
      log(`Jumped forward to index ${jumpListIndex}`);
      return true;
    }

    log('Already at end of jump list');
    return false;
  }

  // ============================================
  // MARKS (like vim marks)
  // ============================================

  // Set a mark on the current tab (or toggle off if same mark on same tab)
  function setMark(char, tab) {
    if (!tab) tab = gBrowser.selectedTab;

    // Check if this exact mark is already on this tab - if so, toggle it off
    if (marks.get(char) === tab) {
      marks.delete(char);
      log(`Toggled off mark '${char}' from tab`);
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
    log(`Set mark '${char}' on tab`);

    // Update display to show the mark
    updateRelativeNumbers();
  }

  // Clear all marks
  function clearAllMarks() {
    const count = marks.size;
    marks.clear();
    log(`Cleared all marks (${count} marks removed)`);
    updateRelativeNumbers();
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
      log(`Mark '${char}' tab was closed, removing mark`);
      return false;
    }

    // Record current position before jumping
    recordJump(gBrowser.selectedTab);

    // Jump to marked tab
    gBrowser.selectedTab = tab;

    // Record the destination
    recordJump(tab);

    log(`Jumped to mark '${char}'`);
    return true;
  }

  // Get mark character for a tab (if it has one)
  function getMarkForTab(tab) {
    for (const [char, markedTab] of marks) {
      if (markedTab === tab) {
        return char;
      }
    }
    return null;
  }

  // Clean up marks for closed tabs
  function cleanupMarks() {
    for (const [char, tab] of marks) {
      if (!tab || tab.closing || !tab.parentNode) {
        marks.delete(char);
        log(`Cleaned up mark '${char}' for closed tab`);
      }
    }
  }

  // ============================================
  // TAB SEARCH FUNCTIONS
  // ============================================

  // Fuzzy match algorithm for a single term - returns { score, indices } or null if no match
  function fuzzyMatchSingle(query, text) {
    if (!query || !text) return null;

    const queryLower = query.toLowerCase();
    const textLower = text.toLowerCase();
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

  // Parse search query into exact terms (quoted) and fuzzy terms (unquoted)
  // Example: '"YouTube" test "GitHub"' → { exactTerms: ["YouTube", "GitHub"], fuzzyTerms: ["test"] }
  function parseSearchQuery(query) {
    if (!query) return { exactTerms: [], fuzzyTerms: [] };

    const exactTerms = [];
    // Match double-quoted strings as exact match terms
    const remaining = query.replace(/"([^"]+)"/g, (_, term) => {
      exactTerms.push(term);
      return ' ';
    });

    const fuzzyTerms = remaining.trim().split(/\s+/).filter(w => w.length > 0);
    return { exactTerms, fuzzyTerms };
  }

  // Exact match - finds all occurrences of term in text (case-insensitive)
  // Returns array of character indices where the term matches
  function exactMatchIndices(term, text) {
    if (!term || !text) return null;
    const termLower = term.toLowerCase();
    const textLower = text.toLowerCase();
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
    const lastAccessed = tab.lastAccessed;

    // Check if lastAccessed is available and valid
    if (lastAccessed && typeof lastAccessed === 'number' && lastAccessed > 0) {
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
    const hasAnyRecency = tabs.some(t =>
      t.lastAccessed && typeof t.lastAccessed === 'number' && t.lastAccessed > 0
    );

    if (!hasAnyRecency) {
      log('lastAccessed not available on any tab, using default order');
      return tabs;
    }

    // Sort by lastAccessed descending (most recent first)
    return [...tabs].sort((a, b) => {
      const aTime = a.lastAccessed || 0;
      const bTime = b.lastAccessed || 0;
      return bTime - aTime;
    });
  }

  // Search tabs and return sorted results
  // Combines fuzzy match score with recency bonus for ranking
  // Omits the current tab from results (you don't need to search for where you already are)
  function searchTabs(query, { includeCurrent = false } = {}) {
    const currentTab = gBrowser.selectedTab;

    // Get searchable tabs (respects cross-workspace setting), optionally excluding current
    const tabs = includeCurrent
      ? getSearchableTabs()
      : getSearchableTabs().filter(tab => tab !== currentTab);

    // Empty query: return tabs sorted purely by recency
    if (!query || query.trim() === '') {
      const sortedTabs = sortTabsByRecency(tabs);
      return sortedTabs.slice(0, S['display.maxSearchResults']).map((tab, idx) => ({
        tab,
        score: 100 - idx,
        titleIndices: [],
        urlIndices: [],
        workspaceName: getTabWorkspaceName(tab)
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
          workspaceName: getTabWorkspaceName(tab)
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

    searchHintBar = document.createElement('div');
    searchHintBar.id = 'zenleap-search-hint-bar';

    container.appendChild(inputWrapper);
    container.appendChild(searchBreadcrumb);
    container.appendChild(searchResultsList);
    container.appendChild(searchHintBar);

    searchModal.appendChild(backdrop);
    searchModal.appendChild(container);

    // Inject styles
    const style = document.createElement('style');
    style.id = 'zenleap-search-styles';
    style.textContent = `
      #zenleap-search-modal {
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        z-index: 100000;
        display: none;
        justify-content: center;
        align-items: flex-start;
        padding-top: 15vh;
      }

      #zenleap-search-modal.active {
        display: flex;
      }

      #zenleap-search-backdrop {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        backdrop-filter: blur(4px);
      }

      #zenleap-search-container {
        position: relative;
        width: 90%;
        max-width: 600px;
        background: rgba(30, 30, 30, 0.95);
        border-radius: 12px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.1);
        overflow: hidden;
        animation: zenleap-search-appear 0.15s ease-out;
      }

      @keyframes zenleap-search-appear {
        from {
          opacity: 0;
          transform: translateY(-20px) scale(0.95);
        }
        to {
          opacity: 1;
          transform: translateY(0) scale(1);
        }
      }

      #zenleap-search-input-wrapper {
        display: flex;
        align-items: center;
        padding: 16px 20px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        gap: 12px;
      }

      #zenleap-search-icon {
        font-size: 20px;
        opacity: 0.6;
      }

      #zenleap-search-input,
      #zenleap-search-input-display {
        flex: 1;
        background: transparent;
        border: none;
        outline: none;
        font-size: 18px;
        color: #e0e0e0;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        height: 27px;
        line-height: 27px;
        padding: 0;
        margin: 0;
        box-sizing: border-box;
      }

      #zenleap-search-input {
        caret-color: #61afef;
      }

      #zenleap-search-input::placeholder {
        color: #666;
      }

      #zenleap-search-input-display {
        white-space: pre;
      }

      #zenleap-search-input-display .cursor-char {
        background: #61afef;
        color: #1e1e1e;
        animation: zenleap-cursor-char-blink 1s step-end infinite;
      }

      #zenleap-search-input-display .cursor-empty {
        display: inline-block;
        width: 0;
        height: 1em;
        vertical-align: text-bottom;
        border-left: 2px solid #61afef;
        margin-left: -1px;
        animation: zenleap-cursor-empty-blink 1s step-end infinite;
      }

      /* Cursor on character: only blink the background, keep character visible */
      @keyframes zenleap-cursor-char-blink {
        0%, 100% { background-color: #61afef; }
        50% { background-color: transparent; color: #e0e0e0; }
      }

      /* Cursor at end of text: blink the line */
      @keyframes zenleap-cursor-empty-blink {
        0%, 100% { opacity: 1; }
        50% { opacity: 0; }
      }

      #zenleap-search-input-display .placeholder {
        color: #666;
      }

      #zenleap-search-ws-toggle {
        font-size: 10px;
        font-weight: 600;
        font-family: monospace;
        padding: 3px 8px;
        border-radius: 4px;
        background: rgba(255, 255, 255, 0.08);
        color: #666;
        border: 1px solid rgba(255, 255, 255, 0.1);
        cursor: pointer;
        transition: all 0.15s;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        flex-shrink: 0;
      }

      #zenleap-search-ws-toggle:hover {
        background: rgba(255, 255, 255, 0.12);
        color: #888;
      }

      #zenleap-search-ws-toggle.active {
        background: rgba(198, 120, 221, 0.2);
        color: #c678dd;
        border-color: rgba(198, 120, 221, 0.4);
      }

      #zenleap-search-vim-indicator {
        font-size: 10px;
        font-weight: 600;
        font-family: monospace;
        padding: 3px 8px;
        border-radius: 4px;
        background: #61afef;
        color: #1e1e1e;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }

      #zenleap-search-vim-indicator.normal {
        background: #e5c07b;
      }

      #zenleap-search-results {
        max-height: 60vh;
        overflow-y: auto;
      }

      .zenleap-search-result {
        display: flex;
        align-items: center;
        padding: 12px 20px;
        cursor: pointer;
        transition: background 0.1s ease;
        gap: 12px;
      }

      .zenleap-search-result:hover {
        background: rgba(255, 255, 255, 0.05);
      }

      .zenleap-search-result.selected {
        background: rgba(97, 175, 239, 0.2);
      }

      .zenleap-search-result-favicon {
        width: 20px;
        height: 20px;
        border-radius: 4px;
        object-fit: contain;
        flex-shrink: 0;
      }

      .zenleap-search-result-info {
        flex: 1;
        min-width: 0;
        overflow: hidden;
      }

      .zenleap-search-result-title {
        font-size: 14px;
        font-weight: 500;
        color: #e0e0e0;
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 2px;
        min-width: 0;
      }

      .zenleap-search-result-title-text {
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        flex: 1;
        min-width: 0;
      }

      .zenleap-search-result-url {
        font-size: 12px;
        color: #888;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .zenleap-search-result-title .match,
      .zenleap-search-result-url .match {
        color: #61afef;
        font-weight: 600;
      }

      .zenleap-search-result-ws {
        display: inline-block;
        font-size: 10px;
        font-weight: 500;
        padding: 1px 6px;
        border-radius: 3px;
        background: rgba(198, 120, 221, 0.2);
        color: #c678dd;
        white-space: nowrap;
        flex-shrink: 0;
      }

      .zenleap-search-result-label {
        font-size: 12px;
        font-weight: 600;
        font-family: monospace;
        padding: 4px 8px;
        border-radius: 4px;
        background: rgba(255, 255, 255, 0.1);
        color: #888;
        flex-shrink: 0;
      }

      .zenleap-search-result.selected .zenleap-search-result-label {
        background: #61afef;
        color: #1e1e1e;
      }

      .zenleap-search-empty {
        padding: 40px 20px;
        text-align: center;
        color: #666;
        font-size: 14px;
      }

      #zenleap-search-hint-bar {
        padding: 12px 20px;
        border-top: 1px solid rgba(255, 255, 255, 0.1);
        font-size: 11px;
        color: #666;
        display: flex;
        gap: 16px;
        justify-content: center;
        flex-shrink: 0;
      }

      #zenleap-search-hint-bar kbd {
        background: rgba(255, 255, 255, 0.1);
        padding: 2px 6px;
        border-radius: 3px;
        font-family: monospace;
        font-size: 10px;
      }

      /* Command mode styles */
      #zenleap-search-breadcrumb {
        display: flex;
        align-items: center;
        padding: 8px 20px;
        gap: 6px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.05);
        font-size: 12px;
        color: #888;
        font-family: monospace;
      }

      .zenleap-breadcrumb-item {
        color: #61afef;
      }

      .zenleap-breadcrumb-sep {
        color: #555;
      }

      .zenleap-command-result {
        display: flex;
        align-items: center;
        padding: 10px 20px;
        cursor: pointer;
        transition: background 0.1s ease;
        gap: 12px;
      }

      .zenleap-command-result:hover {
        background: rgba(255, 255, 255, 0.05);
      }

      .zenleap-command-result.selected {
        background: rgba(97, 175, 239, 0.2);
      }

      .zenleap-command-icon {
        width: 28px;
        height: 28px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 16px;
        flex-shrink: 0;
        border-radius: 6px;
        background: rgba(255, 255, 255, 0.06);
      }

      .zenleap-command-info {
        flex: 1;
        min-width: 0;
        overflow: hidden;
      }

      .zenleap-command-label {
        font-size: 14px;
        font-weight: 500;
        color: #e0e0e0;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .zenleap-command-label:has(.zenleap-search-result-ws) {
        display: flex;
        align-items: center;
        gap: 8px;
        min-width: 0;
        text-overflow: clip;
      }

      .zenleap-command-label .match {
        color: #61afef;
        font-weight: 600;
      }

      .zenleap-command-sublabel {
        font-size: 12px;
        color: #888;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .zenleap-command-sublabel .match {
        color: #61afef;
        font-weight: 600;
      }

      .zenleap-command-result-label {
        font-size: 12px;
        font-weight: 600;
        font-family: monospace;
        padding: 4px 8px;
        border-radius: 4px;
        background: rgba(255, 255, 255, 0.1);
        color: #888;
        flex-shrink: 0;
      }

      .zenleap-command-result.selected .zenleap-command-result-label {
        background: #61afef;
        color: #1e1e1e;
      }

      .zenleap-command-prefix {
        color: #e5c07b;
        font-weight: 700;
        font-size: 18px;
        flex-shrink: 0;
      }

      .zenleap-command-count {
        padding: 6px 20px;
        font-size: 12px;
        color: #61afef;
        font-family: monospace;
        border-bottom: 1px solid rgba(255, 255, 255, 0.05);
      }
    `;

    document.head.appendChild(style);
    document.documentElement.appendChild(searchModal);

    // Add input event listener
    searchInput.addEventListener('input', handleSearchInput);

    // Handle keydown on input for insert mode navigation
    searchInput.addEventListener('keydown', (e) => {
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

  // Highlight matched characters in text
  function highlightMatches(text, indices) {
    if (!indices || indices.length === 0) return escapeHtml(text);

    let result = '';
    let lastIdx = 0;

    for (const idx of indices) {
      if (idx > lastIdx) {
        result += escapeHtml(text.slice(lastIdx, idx));
      }
      result += `<span class="match">${escapeHtml(text[idx])}</span>`;
      lastIdx = idx + 1;
    }

    if (lastIdx < text.length) {
      result += escapeHtml(text.slice(lastIdx));
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
  // COMMAND PALETTE
  // ============================================

  // Static commands registry
  function getStaticCommands() {
    return [
      // --- Tab Management ---
      { key: 'new-tab', label: 'New Tab', icon: '+', tags: ['tab', 'create', 'open'], command: () => { gBrowser.addTab('about:newtab', { triggeringPrincipal: Services.scriptSecurityManager.getSystemPrincipal() }); } },
      { key: 'close-tab', label: 'Close Current Tab', icon: '✕', tags: ['tab', 'close', 'remove'], command: () => { gBrowser.removeTab(gBrowser.selectedTab); } },
      { key: 'close-other-tabs', label: 'Close Other Tabs', icon: '✕', tags: ['tab', 'close', 'other'], command: () => {
        const current = gBrowser.selectedTab;
        const tabs = getVisibleTabs().filter(t => t !== current && !t.pinned);
        for (const t of tabs) gBrowser.removeTab(t);
      }},
      { key: 'close-tabs-right', label: 'Close Tabs to the Right', icon: '✕→', tags: ['tab', 'close', 'right'], command: () => {
        const tabs = getVisibleTabs();
        const idx = tabs.indexOf(gBrowser.selectedTab);
        if (idx >= 0) for (let i = tabs.length - 1; i > idx; i--) if (!tabs[i].pinned) gBrowser.removeTab(tabs[i]);
      }},
      { key: 'close-tabs-left', label: 'Close Tabs to the Left', icon: '←✕', tags: ['tab', 'close', 'left'], command: () => {
        const tabs = getVisibleTabs();
        const idx = tabs.indexOf(gBrowser.selectedTab);
        if (idx >= 0) for (let i = idx - 1; i >= 0; i--) if (!tabs[i].pinned) gBrowser.removeTab(tabs[i]);
      }},
      { key: 'duplicate-tab', label: 'Duplicate Tab', icon: '⊕', tags: ['tab', 'duplicate', 'copy', 'clone'], command: () => { gBrowser.duplicateTab(gBrowser.selectedTab); } },
      { key: 'pin-unpin-tab', label: 'Pin/Unpin Tab', icon: '📌', tags: ['tab', 'pin', 'unpin'], command: () => {
        const tab = gBrowser.selectedTab;
        if (tab.pinned) gBrowser.unpinTab(tab); else gBrowser.pinTab(tab);
      }},
      { key: 'mute-unmute-tab', label: 'Mute/Unmute Tab', icon: '🔇', tags: ['tab', 'mute', 'unmute', 'audio', 'sound'], command: () => { gBrowser.selectedTab.toggleMuteAudio(); } },
      { key: 'unload-tab', label: 'Unload Tab (Save Memory)', icon: '💤', tags: ['tab', 'unload', 'discard', 'memory', 'suspend'], command: () => {
        const current = gBrowser.selectedTab;
        // Find the most recently accessed tab to switch to
        const tabs = Array.from(gBrowser.tabs)
          .filter(t => t !== current && !t.hasAttribute('pending') && !t.hidden);
        tabs.sort((a, b) => (b._lastAccessed || 0) - (a._lastAccessed || 0));
        const target = tabs[0];
        if (target) {
          gBrowser.selectedTab = target;
        }
        // Discard after a short delay to let the tab switch complete
        setTimeout(() => {
          try { gBrowser.discardBrowser(current); } catch(e) { log(`Unload tab failed: ${e}`); }
        }, S['timing.unloadTabDelay']);
      }},

      // --- Tab Selection (Multi-Step) ---
      { key: 'select-matching-tabs', label: 'Select Matching Tabs...', icon: '🔎', tags: ['tab', 'select', 'search', 'match', 'filter', 'batch'], subFlow: 'tab-search' },
      { key: 'deduplicate-tabs', label: 'Deduplicate Tabs (Close Duplicates)', icon: '🧹', tags: ['tab', 'duplicate', 'deduplicate', 'close', 'clean', 'unique'], subFlow: 'dedup-preview' },

      // --- Tab Movement ---
      { key: 'move-tab-to-top', label: 'Move Tab to Top', icon: '⤒', tags: ['tab', 'move', 'top', 'first', 'beginning'], command: () => {
        const tab = gBrowser.selectedTab;
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
      { key: 'move-tab-to-bottom', label: 'Move Tab to Bottom', icon: '⤓', tags: ['tab', 'move', 'bottom', 'last', 'end'], command: () => {
        const tab = gBrowser.selectedTab;
        // Unpin if pinned (except essentials) so it can move to the regular tab area
        if (tab.pinned && !tab.hasAttribute('zen-essential')) gBrowser.unpinTab(tab);
        const tabs = getVisibleTabs();
        if (tabs.length > 0 && tabs[tabs.length - 1] !== tab) {
          gBrowser.moveTabAfter(tab, tabs[tabs.length - 1]);
          log('Moved tab to bottom');
        }
      }},

      // --- Navigation ---
      { key: 'go-first-tab', label: 'Go to First Tab', icon: '⇤', tags: ['navigate', 'first', 'top', 'gg'], command: () => {
        const tabs = getVisibleTabs();
        if (tabs.length === 0) return;
        if (S['display.ggSkipPinned']) {
          const firstUnpinned = tabs.findIndex(t => !t.pinned && !t.hasAttribute('zen-essential'));
          gBrowser.selectedTab = tabs[firstUnpinned >= 0 ? firstUnpinned : 0];
        } else {
          gBrowser.selectedTab = tabs[0];
        }
      }},
      { key: 'go-last-tab', label: 'Go to Last Tab', icon: '⇥', tags: ['navigate', 'last', 'bottom', 'end'], command: () => {
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

      // --- View & Browser ---
      { key: 'toggle-fullscreen', label: 'Toggle Fullscreen', icon: '⛶', tags: ['view', 'fullscreen', 'screen'], command: () => { window.fullScreen = !window.fullScreen; } },
      { key: 'toggle-sidebar', label: 'Toggle Sidebar Expanded/Compact', icon: '◫', tags: ['sidebar', 'compact', 'expand', 'toggle'], command: () => {
        try {
          const current = Services.prefs.getBoolPref('zen.view.sidebar-expanded');
          Services.prefs.setBoolPref('zen.view.sidebar-expanded', !current);
        } catch (e) { log(`Toggle sidebar failed: ${e}`); }
      }},
      { key: 'zoom-in', label: 'Zoom In', icon: '🔍+', tags: ['zoom', 'in', 'bigger'], command: () => { ZoomManager.enlarge(); } },
      { key: 'zoom-out', label: 'Zoom Out', icon: '🔍-', tags: ['zoom', 'out', 'smaller'], command: () => { ZoomManager.reduce(); } },
      { key: 'zoom-reset', label: 'Reset Zoom', icon: '🔍=', tags: ['zoom', 'reset', 'default'], command: () => { ZoomManager.reset(); } },

      // --- Split View ---
      { key: 'unsplit-view', label: 'Unsplit View', icon: '▣', tags: ['split', 'unsplit', 'close'], command: () => {
        try { if (window.gZenViewSplitter?.splitViewActive) window.gZenViewSplitter.unsplitCurrentView(); } catch (e) { log(`Unsplit failed: ${e}`); }
      }, condition: () => { try { return window.gZenViewSplitter?.splitViewActive; } catch(e) { return false; } } },
      { key: 'split-with-tab', label: 'Split View with Tab...', icon: '◫', tags: ['split', 'view', 'side'], subFlow: 'split-tab-picker' },
      { key: 'split-rotate-tabs', label: 'Split View: Rotate Tabs', icon: '🔄', tags: ['split', 'view', 'swap', 'rotate', 'tabs', 'panes'], command: () => {
        try {
          const splitter = window.gZenViewSplitter;
          if (!splitter?.splitViewActive) return;
          const viewData = splitter._data[splitter.currentView];
          if (!viewData || !viewData.tabs || viewData.tabs.length < 2) return;

          if (viewData.tabs.length === 2) {
            // For 2 tabs: simple swap
            const node1 = splitter.getSplitNodeFromTab(viewData.tabs[0]);
            const node2 = splitter.getSplitNodeFromTab(viewData.tabs[1]);
            splitter.swapNodes(node1, node2);
            splitter.applyGridLayout(viewData.layoutTree);
          } else {
            // For 3+ tabs: rotate positions (shift each tab to the next position)
            const nodes = viewData.tabs.map(t => splitter.getSplitNodeFromTab(t));
            if (nodes.length > 0 && nodes.every(n => n)) {
              // Rotate: last goes to first position, everything shifts right
              const lastNode = nodes[nodes.length - 1];
              for (let i = nodes.length - 1; i > 0; i--) {
                splitter.swapNodes(nodes[i], nodes[i - 1]);
              }
              splitter.applyGridLayout(viewData.layoutTree);
            }
          }
        } catch (e) { log(`Split rotate tabs failed: ${e}`); }
      }, condition: () => {
        try {
          return window.gZenViewSplitter?.splitViewActive &&
            window.gZenViewSplitter._data[window.gZenViewSplitter.currentView]?.tabs?.length >= 2;
        } catch(e) { return false; }
      }},
      { key: 'split-rotate-layout', label: 'Split View: Rotate Layout', icon: '⟳', tags: ['split', 'view', 'rotate', 'layout', 'orientation', 'horizontal', 'vertical'], command: () => {
        try {
          const splitter = window.gZenViewSplitter;
          if (!splitter?.splitViewActive) return;
          const viewData = splitter._data[splitter.currentView];
          if (!viewData || !viewData.layoutTree) return;

          const layoutTree = viewData.layoutTree;

          // Check if layout is rotatable (must have a simple direction to toggle)
          function canRotateTree(node) {
            if (!node) return false;
            // A leaf node (no children) can't be rotated
            if (!node.children || node.children.length === 0) return false;
            return node.direction === 'row' || node.direction === 'column';
          }

          function rotateTree(node) {
            if (!node) return;
            if (node.direction === 'row') {
              node.direction = 'column';
            } else if (node.direction === 'column') {
              node.direction = 'row';
            }
            // Recursively rotate nested layouts
            if (node.children) {
              for (const child of node.children) {
                rotateTree(child);
              }
            }
          }

          if (!canRotateTree(layoutTree)) {
            log('Layout is not rotatable');
            return;
          }

          rotateTree(layoutTree);
          splitter.activateSplitView(viewData, true);
        } catch (e) { log(`Split rotate layout failed: ${e}`); }
      }, condition: () => {
        try {
          const splitter = window.gZenViewSplitter;
          if (!splitter?.splitViewActive) return false;
          const viewData = splitter._data[splitter.currentView];
          if (!viewData?.layoutTree) return false;
          const lt = viewData.layoutTree;
          return lt.direction === 'row' || lt.direction === 'column';
        } catch(e) { return false; }
      }},

      // --- Workspace Management ---
      { key: 'create-workspace', label: 'Create New Workspace', icon: '➕', tags: ['workspace', 'new', 'create'], command: () => {
        try { document.getElementById('cmd_zenOpenWorkspaceCreation')?.doCommand(); } catch(e) { log(`Create workspace failed: ${e}`); }
      }},
      { key: 'delete-workspace', label: 'Delete Workspace...', icon: '🗑', tags: ['workspace', 'delete', 'remove', 'destroy'],
        condition: () => {
          try { return !!window.gZenWorkspaces && (window.gZenWorkspaces.getWorkspaces()?.length || 0) > 0; } catch(e) { return false; }
        },
        subFlow: 'delete-workspace-picker' },
      { key: 'switch-workspace', label: 'Switch to Workspace...', icon: '🗂', tags: ['workspace', 'switch', 'change'],
        condition: () => {
          try { return !!window.gZenWorkspaces && (window.gZenWorkspaces.getWorkspaces()?.length || 0) > 0; } catch(e) { return false; }
        },
        subFlow: 'switch-workspace-picker' },
      { key: 'move-to-workspace', label: 'Move Tab to Workspace...', icon: '🗂', tags: ['workspace', 'move', 'tab'],
        condition: () => {
          try { return !!window.gZenWorkspaces && (window.gZenWorkspaces.getWorkspaces()?.length || 0) > 1; } catch(e) { return false; }
        },
        subFlow: 'move-to-workspace-picker' },
      { key: 'rename-workspace', label: 'Rename Workspace...', icon: '✏', tags: ['workspace', 'rename', 'edit', 'name'],
        condition: () => {
          try { return !!window.gZenWorkspaces && (window.gZenWorkspaces.getWorkspaces()?.length || 0) > 0; } catch(e) { return false; }
        },
        subFlow: 'rename-workspace-picker' },

      // --- Folder Management ---
      { key: 'create-folder', label: 'Create Folder with Current Tab', icon: '📁', tags: ['folder', 'create', 'new', 'group', 'tab', 'add'],
        condition: () => !!window.gZenFolders,
        command: () => {
          try {
            const tab = gBrowser.selectedTab;
            gZenFolders.createFolder([tab], { renameFolder: true });
          } catch(e) { log(`Create folder failed: ${e}`); }
      }},
      { key: 'delete-folder', label: 'Delete Folder...', icon: '🗑', tags: ['folder', 'delete', 'remove', 'destroy', 'group'],
        condition: () => {
          try { return gBrowser.tabContainer.querySelectorAll('zen-folder').length > 0; } catch(e) { return false; }
        },
        subFlow: 'delete-folder-picker' },
      { key: 'add-to-folder', label: 'Add Tab to Folder...', icon: '📂', tags: ['folder', 'add', 'move', 'tab', 'group'],
        condition: () => {
          try { return gBrowser.tabContainer.querySelectorAll('zen-folder').length > 0; } catch(e) { return false; }
        },
        subFlow: 'add-to-folder-picker' },
      { key: 'rename-folder', label: 'Rename Folder...', icon: '✏', tags: ['folder', 'rename', 'edit', 'name', 'group'],
        condition: () => {
          try { return gBrowser.tabContainer.querySelectorAll('zen-folder').length > 0; } catch(e) { return false; }
        },
        subFlow: 'rename-folder-picker' },

      // --- ZenLeap Meta ---
      { key: 'toggle-browse-preview', label: 'Toggle Browse Preview', icon: '🖼', tags: ['preview', 'browse', 'thumbnail', 'zenleap'], command: () => {
        S['display.browsePreview'] = !S['display.browsePreview'];
        saveSettings();
        if (!S['display.browsePreview']) hidePreviewPanel();
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
      { key: 'open-settings', label: 'Open Settings', icon: '⚙', tags: ['settings', 'config', 'preferences', 'customize', 'keybindings'], command: () => {
        exitSearchMode();
        setTimeout(() => enterSettingsMode(), 100);
      }},
    ];
  }

  // Generate dynamic commands based on current state
  function getDynamicCommands() {
    return [];
  }

  // Get all available commands (static + dynamic)
  function getAllCommands() {
    const statics = getStaticCommands();
    const dynamics = getDynamicCommands();
    const all = [...statics, ...dynamics];
    // Filter by condition
    return all.filter(cmd => !cmd.condition || cmd.condition());
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
      // No query: sort by recency, then alphabetical
      const sorted = [...all];
      sorted.sort((a, b) => {
        const aRecency = commandRecency.get(a.key) || 0;
        const bRecency = commandRecency.get(b.key) || 0;
        if (aRecency !== bRecency) return bRecency - aRecency; // Most recent first
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

      results.push({
        ...cmd,
        score: totalScore,
        labelIndices: [...new Set(allIndices)].sort((a, b) => a - b),
      });
    }

    results.sort((a, b) => b.score - a.score);
    return results;
  }

  // Execute a command or enter its sub-flow
  function executeCommand(cmd) {
    // Track recency for all commands (including sub-flow commands)
    commandRecency.set(cmd.key, Date.now());

    if (cmd.subFlow) {
      enterSubFlow(cmd.subFlow, cmd.label);
      return;
    }
    if (typeof cmd.command === 'function') {
      exitSearchMode();
      try {
        cmd.command();
        log(`Executed command: ${cmd.key}`);
      } catch (e) {
        log(`Command failed: ${cmd.key}: ${e}`);
      }
    }
  }

  // ============================================
  // COMMAND SUB-FLOW SYSTEM
  // ============================================

  function enterSubFlow(type, label) {
    commandSubFlowStack.push({ type: commandSubFlow?.type || 'commands', label: commandSubFlow?.label || 'Commands', query: commandQuery, data: commandSubFlow?.data || null });
    commandSubFlow = { type, label, data: null };
    commandQuery = '';
    // Only reset matched tabs when entering a fresh tab-search (not when moving to action-picker/workspace-picker/folder-picker which depend on them)
    if (type === 'tab-search' || type === 'split-tab-picker') {
      commandMatchedTabs = [];
    }
    searchSelectedIndex = 0;
    searchCursorPos = 0;

    // Always enter insert mode when entering a sub-flow
    searchVimMode = 'insert';

    if (searchInput) {
      searchInput.value = '';
      searchInput.placeholder = getSubFlowPlaceholder(type);
      searchInput.readOnly = (type === 'dedup-preview');
    }
    renderCommandResults();
    updateBreadcrumb();
    updateSearchVimIndicator();
    updateWsToggleVisibility();
  }

  function exitSubFlow() {
    searchSelectedIndex = 0;
    const currentType = commandSubFlow?.type;

    // Clean up dedup-preview state when leaving it
    if (currentType === 'dedup-preview') {
      hidePreviewPanel();
      dedupTabsToClose = [];
      if (searchInput) searchInput.readOnly = false;
    }

    if (commandSubFlowStack.length === 0) {
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
      commandSubFlow = { type: prev.type, label: prev.label, data: null };
      commandQuery = prev.query || '';
    }
    // Only clear matched tabs when going back to tab-search or to root
    // Preserve them when going back to action-picker (needs the count)
    if (!commandSubFlow || commandSubFlow.type === 'tab-search') {
      commandMatchedTabs = [];
    }
    if (searchInput) {
      searchInput.value = commandQuery;
      searchInput.placeholder = commandSubFlow ? getSubFlowPlaceholder(commandSubFlow.type) : 'Type a command...';
    }
    renderCommandResults();
    updateBreadcrumb();
    updateSearchHintBar();
    updateWsToggleVisibility();
  }

  function getSubFlowPlaceholder(type) {
    switch (type) {
      case 'tab-search': return 'Search tabs to select...';
      case 'action-picker': return 'Choose an action...';
      case 'workspace-picker': return 'Choose a workspace...';
      case 'folder-picker': return 'Choose a folder...';
      case 'split-tab-picker': return 'Search for a tab to split with...';
      case 'dedup-preview': return 'Duplicates to close — Enter to confirm';
      case 'folder-name-input': return 'Enter folder name...';
      case 'delete-folder-picker': return 'Select a folder to delete...';
      case 'delete-workspace-picker': return 'Select a workspace to delete...';
      case 'switch-workspace-picker': return 'Select a workspace to switch to...';
      case 'move-to-workspace-picker': return 'Select a workspace to move tab to...';
      case 'add-to-folder-picker': return 'Select a folder to add tab to...';
      case 'rename-folder-picker': return 'Select a folder to rename...';
      case 'rename-workspace-picker': return 'Select a workspace to rename...';
      case 'rename-folder-input': return 'Enter new folder name...';
      case 'rename-workspace-input': return 'Enter new workspace name...';
      default: return 'Type a command...';
    }
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
    if (!commandSubFlow) return [];
    const query = commandQuery;

    switch (commandSubFlow.type) {
      case 'tab-search':
        return getTabSearchSubFlowResults(query);
      case 'action-picker':
        return getActionPickerResults(query);
      case 'workspace-picker':
        return getWorkspacePickerResults(query);
      case 'folder-picker':
        return getFolderPickerResults(query);
      case 'split-tab-picker':
        return getSplitTabPickerResults(query);
      case 'dedup-preview':
        return getDedupPreviewResults();
      case 'folder-name-input':
        return getFolderNameInputResults(query);
      case 'delete-folder-picker':
        return getDeleteFolderPickerResults(query);
      case 'delete-workspace-picker':
        return getDeleteWorkspacePickerResults(query);
      case 'switch-workspace-picker':
        return getSwitchWorkspacePickerResults(query);
      case 'move-to-workspace-picker':
        return getMoveToWorkspacePickerResults(query);
      case 'add-to-folder-picker':
        return getAddToFolderPickerResults(query);
      case 'rename-folder-picker':
        return getRenameFolderPickerResults(query);
      case 'rename-workspace-picker':
        return getRenameWorkspacePickerResults(query);
      case 'rename-folder-input':
        return getRenameFolderInputResults(query);
      case 'rename-workspace-input':
        return getRenameWorkspaceInputResults(query);
      default:
        return [];
    }
  }

  function getFolderNameInputResults(query) {
    const name = (query || '').trim();
    if (!name) {
      return [{ key: 'folder-name:prompt', label: 'Type a name for the new folder and press Enter', icon: '📁', tags: [] }];
    }
    return [{ key: 'folder-name:confirm', label: `Create folder: "${name}"`, icon: '📁+', tags: [] }];
  }

  function getDeleteFolderPickerResults(query) {
    const results = [];
    try {
      const activeWsId = window.gZenWorkspaces?.activeWorkspace;
      const folders = gBrowser.tabContainer.querySelectorAll('zen-folder');
      for (const folder of folders) {
        // Only show folders in the current workspace
        const folderWsId = folder.getAttribute('zen-workspace-id');
        if (activeWsId && folderWsId && folderWsId !== activeWsId) continue;

        const name = folder.label || folder.getAttribute('zen-folder-name') || 'Unnamed Folder';
        // Exclude zen-empty-tab placeholders from count
        const tabCount = folder.tabs?.filter(t => !t.hasAttribute('zen-empty-tab')).length || 0;
        results.push({
          key: `delete-folder:${folder.id}`,
          label: name,
          sublabel: `${tabCount} tab${tabCount !== 1 ? 's' : ''}`,
          icon: '🗑',
          tags: ['folder', 'delete', name.toLowerCase()],
          folder: folder,
        });
      }
    } catch (e) { log(`Error getting folders for delete: ${e}`); }
    if (results.length === 0) {
      return [{ key: 'delete-folder:none', label: 'No folders found', icon: '📂', tags: [] }];
    }
    if (!query) return results;
    return results.filter(r => {
      const target = `${r.label} ${(r.tags || []).join(' ')}`;
      return fuzzyMatchSingle(query.toLowerCase(), target.toLowerCase());
    });
  }

  function getDeleteWorkspacePickerResults(query) {
    const results = [];
    try {
      if (window.gZenWorkspaces) {
        const workspaces = window.gZenWorkspaces.getWorkspaces();
        const activeId = window.gZenWorkspaces.activeWorkspace;
        if (workspaces && Array.isArray(workspaces)) {
          for (const ws of workspaces) {
            const name = ws.name || 'Unnamed';
            const isActive = ws.uuid === activeId;
            results.push({
              key: `delete-workspace:${ws.uuid}`,
              label: `${name}${isActive ? ' (current)' : ''}`,
              icon: ws.icon || '🗑',
              tags: ['workspace', 'delete', name.toLowerCase()],
              workspaceId: ws.uuid,
            });
          }
        }
      }
    } catch (e) { log(`Error getting workspaces for delete: ${e}`); }
    if (results.length === 0) {
      return [{ key: 'delete-workspace:none', label: 'No workspaces found', icon: '🗂', tags: [] }];
    }
    if (!query) return results;
    return results.filter(r => {
      const target = `${r.label} ${(r.tags || []).join(' ')}`;
      return fuzzyMatchSingle(query.toLowerCase(), target.toLowerCase());
    });
  }

  function getSwitchWorkspacePickerResults(query) {
    const results = [];
    try {
      if (window.gZenWorkspaces) {
        const workspaces = window.gZenWorkspaces.getWorkspaces();
        const activeId = window.gZenWorkspaces.activeWorkspace;
        if (workspaces && Array.isArray(workspaces)) {
          for (const ws of workspaces) {
            const name = ws.name || 'Unnamed';
            const isActive = ws.uuid === activeId;
            results.push({
              key: `switch-workspace:${ws.uuid}`,
              label: `${name}${isActive ? ' (current)' : ''}`,
              icon: ws.icon || '🗂',
              tags: ['workspace', 'switch', name.toLowerCase()],
              workspaceId: ws.uuid,
            });
          }
        }
      }
    } catch (e) { log(`Error getting workspaces for switch: ${e}`); }
    if (results.length === 0) {
      return [{ key: 'switch-workspace:none', label: 'No workspaces found', icon: '🗂', tags: [] }];
  function getRenameFolderPickerResults(query) {
    const results = [];
    try {
      const activeWsId = window.gZenWorkspaces?.activeWorkspace;
      const folders = gBrowser.tabContainer.querySelectorAll('zen-folder');
      for (const folder of folders) {
        const folderWsId = folder.getAttribute('zen-workspace-id');
        if (activeWsId && folderWsId && folderWsId !== activeWsId) continue;

        const name = folder.label || folder.getAttribute('zen-folder-name') || 'Unnamed Folder';
        const tabCount = folder.tabs?.filter(t => !t.hasAttribute('zen-empty-tab')).length || 0;
        results.push({
          key: `rename-folder:${folder.id}`,
          label: name,
          sublabel: `${tabCount} tab${tabCount !== 1 ? 's' : ''}`,
          icon: '✏',
          tags: ['folder', 'rename', name.toLowerCase()],
          folder: folder,
        });
      }
    } catch (e) { log(`Error getting folders for rename: ${e}`); }
    if (results.length === 0) {
      return [{ key: 'rename-folder:none', label: 'No folders found', icon: '📂', tags: [] }];
    }
    if (!query) return results;
    return results.filter(r => {
      const target = `${r.label} ${(r.tags || []).join(' ')}`;
      return fuzzyMatchSingle(query.toLowerCase(), target.toLowerCase());
    });
  }

  function getMoveToWorkspacePickerResults(query) {
  function getRenameWorkspacePickerResults(query) {
    const results = [];
    try {
      if (window.gZenWorkspaces) {
        const workspaces = window.gZenWorkspaces.getWorkspaces();
        const activeId = window.gZenWorkspaces.activeWorkspace;
        if (workspaces && Array.isArray(workspaces)) {
          for (const ws of workspaces) {
            if (ws.uuid === activeId) continue;
            const name = ws.name || 'Unnamed';
            results.push({
              key: `move-to-workspace:${ws.uuid}`,
              label: name,
              icon: ws.icon || '🗂',
              tags: ['workspace', 'move', name.toLowerCase()],
            const name = ws.name || 'Unnamed';
            const isActive = ws.uuid === activeId;
            results.push({
              key: `rename-workspace:${ws.uuid}`,
              label: `${name}${isActive ? ' (current)' : ''}`,
              icon: ws.icon || '✏',
              tags: ['workspace', 'rename', name.toLowerCase()],
              workspaceId: ws.uuid,
            });
          }
        }
      }
    } catch (e) { log(`Error getting workspaces for move: ${e}`); }
    if (results.length === 0) {
      return [{ key: 'move-to-workspace:none', label: 'No other workspaces found', icon: '🗂', tags: [] }];
    } catch (e) { log(`Error getting workspaces for rename: ${e}`); }
    if (results.length === 0) {
      return [{ key: 'rename-workspace:none', label: 'No workspaces found', icon: '🗂', tags: [] }];
    }
    if (!query) return results;
    return results.filter(r => {
      const target = `${r.label} ${(r.tags || []).join(' ')}`;
      return fuzzyMatchSingle(query.toLowerCase(), target.toLowerCase());
    });
  }

  function getAddToFolderPickerResults(query) {
    const results = [];
    try {
      const activeTab = gBrowser.selectedTab;
      const folders = gBrowser.tabContainer.querySelectorAll('zen-folder');
      for (const folder of folders) {
        // Skip if tab is already in this folder
        if (activeTab && activeTab.group === folder) continue;
        const name = folder.label || folder.getAttribute('zen-folder-name') || 'Unnamed Folder';
        const tabCount = folder.tabs?.filter(t => !t.hasAttribute('zen-empty-tab')).length || 0;
        results.push({
          key: `add-to-folder:${folder.id}`,
          label: name,
          sublabel: `${tabCount} tab${tabCount !== 1 ? 's' : ''}`,
          icon: '📂',
          tags: ['folder', 'add', name.toLowerCase()],
          folder: folder,
        });
      }
    } catch (e) { log(`Error getting folders for add: ${e}`); }
    if (results.length === 0) {
      return [{ key: 'add-to-folder:none', label: 'No folders found', icon: '📂', tags: [] }];
    }
    if (!query) return results;
    return results.filter(r => {
      const target = `${r.label} ${(r.tags || []).join(' ')}`;
      return fuzzyMatchSingle(query.toLowerCase(), target.toLowerCase());
    });
  function getRenameFolderInputResults(query) {
    const name = (query || '').trim();
    if (!name) {
      return [{ key: 'rename-folder-input:prompt', label: 'Type a new name for the folder and press Enter', icon: '✏', tags: [] }];
    }
    return [{ key: 'rename-folder-input:confirm', label: `Rename folder to: "${name}"`, icon: '✏', tags: [] }];
  }

  function getRenameWorkspaceInputResults(query) {
    const name = (query || '').trim();
    if (!name) {
      return [{ key: 'rename-workspace-input:prompt', label: 'Type a new name for the workspace and press Enter', icon: '✏', tags: [] }];
    }
    return [{ key: 'rename-workspace-input:confirm', label: `Rename workspace to: "${name}"`, icon: '✏', tags: [] }];
  }

  function getTabSearchSubFlowResults(query) {
    // Search tabs including current tab (for batch selection)
    const results = searchTabs(query, { includeCurrent: true });
    commandMatchedTabs = results.map(r => r.tab);
    return results.map(r => ({
      key: `matched-tab:${r.tab._tPos}`,
      label: r.tab.label || 'Untitled',
      sublabel: r.tab.linkedBrowser?.currentURI?.spec || '',
      icon: '☑',
      isTab: true,
      tab: r.tab,
      titleIndices: r.titleIndices,
      urlIndices: r.urlIndices,
      workspaceName: r.workspaceName,
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
    if (!query) return actions;
    return actions.filter(a => {
      const target = `${a.label} ${(a.tags || []).join(' ')}`;
      return fuzzyMatchSingle(query.toLowerCase(), target.toLowerCase());
    });
  }

  function getWorkspacePickerResults(query) {
    const results = [];
    try {
      if (window.gZenWorkspaces) {
        const workspaces = window.gZenWorkspaces.getWorkspaces();
        if (workspaces && Array.isArray(workspaces)) {
          for (const ws of workspaces) {
            const name = ws.name || 'Unnamed';
            results.push({
              key: `ws:${ws.uuid}`,
              label: name,
              icon: ws.icon || '🗂',
              tags: ['workspace', name.toLowerCase()],
              workspaceId: ws.uuid,
            });
          }
        }
      }
    } catch (e) { log(`Error getting workspaces: ${e}`); }
    if (!query) return results;
    return results.filter(r => {
      const target = `${r.label} ${(r.tags || []).join(' ')}`;
      return fuzzyMatchSingle(query.toLowerCase(), target.toLowerCase());
    });
  }

  function getFolderPickerResults(query) {
    const results = [];
    try {
      const folders = gBrowser.tabContainer.querySelectorAll('zen-folder');
      for (const folder of folders) {
        const name = folder.label || folder.getAttribute('zen-folder-name') || 'Unnamed Folder';
        results.push({
          key: `folder:${folder.id}`,
          label: name,
          icon: '📂',
          tags: ['folder', name.toLowerCase()],
          folder: folder,
        });
      }
    } catch (e) { log(`Error getting folders: ${e}`); }
    results.push({ key: 'folder:new', label: 'Create New Folder', icon: '📁+', tags: ['folder', 'new', 'create'] });
    if (!query) return results;
    return results.filter(r => {
      const target = `${r.label} ${(r.tags || []).join(' ')}`;
      return fuzzyMatchSingle(query.toLowerCase(), target.toLowerCase());
    });
  }

  function getSplitTabPickerResults(query) {
    // Reuse tab search for split view picker
    const results = searchTabs(query);
    return results.map(r => ({
      key: `split-tab:${r.tab._tPos}`,
      label: r.tab.label || 'Untitled',
      sublabel: r.tab.linkedBrowser?.currentURI?.spec || '',
      icon: '◫',
      isTab: true,
      tab: r.tab,
      titleIndices: r.titleIndices,
      workspaceName: r.workspaceName,
      urlIndices: r.urlIndices,
    }));
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

    // Filter to valid, non-essential, non-pinned tabs (same logic as deduplicateTabs)
    const validTabs = allTabs.filter(t =>
      t && !t.closing && t.parentNode &&
      !t.pinned &&
      !t.hasAttribute('zen-essential') &&
      !t.hasAttribute('zen-glance-tab') &&
      !t.hasAttribute('zen-empty-tab')
    );

    // Group by URL
    const urlGroups = new Map();
    for (const tab of validTabs) {
      const url = tab.linkedBrowser?.currentURI?.spec;
      if (!url || url === 'about:blank' || url === 'about:newtab') continue;
      if (!urlGroups.has(url)) urlGroups.set(url, []);
      urlGroups.get(url).push(tab);
    }

    // For each group with >1 tab, keep the most recently accessed, collect the rest
    const tabsToClose = [];
    for (const [url, tabs] of urlGroups) {
      if (tabs.length < 2) continue;
      tabs.sort((a, b) => (b._lastAccessed || 0) - (a._lastAccessed || 0));
      for (let i = 1; i < tabs.length; i++) {
        tabsToClose.push(tabs[i]);
      }
    }

    dedupTabsToClose = tabsToClose;

    return tabsToClose.map(tab => ({
      key: `dedup-tab:${tab._tPos}`,
      label: tab.label || 'Untitled',
      sublabel: tab.linkedBrowser?.currentURI?.spec || '',
      icon: '🧹',
      isTab: true,
      tab: tab,
      titleIndices: [],
      urlIndices: [],
      workspaceName: getTabWorkspaceName(tab),
    }));
  }

  // Handle sub-flow selection (Enter on a result)
  function handleSubFlowSelect(result) {
    if (!commandSubFlow) return;

    switch (commandSubFlow.type) {
      case 'tab-search':
        // Move to action picker
        enterSubFlow('action-picker', `${commandMatchedTabs.length} tabs`);
        break;

      case 'action-picker':
        if (result.subFlow) {
          enterSubFlow(result.subFlow, result.label);
        } else if (result.key === 'action:browse-select') {
          selectTabsInBrowseMode(commandMatchedTabs);
        } else if (result.key === 'action:close-all') {
          closeMatchedTabs(commandMatchedTabs);
        } else if (result.key === 'action:move-to-top') {
          moveMatchedTabsToPosition(commandMatchedTabs, 'top');
        } else if (result.key === 'action:move-to-bottom') {
          moveMatchedTabsToPosition(commandMatchedTabs, 'bottom');
        } else if (result.key === 'action:unload-all') {
          unloadMatchedTabs(commandMatchedTabs);
        }
        break;

      case 'workspace-picker':
        moveTabsToWorkspace(commandMatchedTabs, result.workspaceId);
        break;

      case 'folder-picker':
        if (result.key === 'folder:new') {
          // Enter name input sub-flow instead of using Zen's broken rename UI
          enterSubFlow('folder-name-input', 'Name new folder');
        } else {
          addTabsToFolder(commandMatchedTabs, result);
        }
        break;

      case 'folder-name-input': {
        const folderName = (commandQuery || '').trim();
        if (folderName) {
          createFolderWithName(commandMatchedTabs, folderName);
        }
        break;
      }

      case 'split-tab-picker':
        splitWithTab(result.tab);
        break;

      case 'dedup-preview':
        if (dedupTabsToClose.length > 0) {
          const count = dedupTabsToClose.length;
          for (const t of dedupTabsToClose) {
            try { gBrowser.removeTab(t); } catch (e) { log(`Failed to close duplicate tab: ${e}`); }
          }
          log(`Deduplicated: closed ${count} duplicate tab(s)`);
          dedupTabsToClose = [];
        }
        hidePreviewPanel();
        exitSearchMode();
        break;

      case 'delete-folder-picker':
        if (result.folder) {
          deleteFolder(result.folder);
        }
        break;

      case 'delete-workspace-picker':
        if (result.workspaceId) {
          deleteWorkspace(result.workspaceId);
        }
        break;

      case 'switch-workspace-picker':
        if (result.workspaceId) {
          window.gZenWorkspaces.changeWorkspaceWithID(result.workspaceId);
          exitSearchMode();
        }
        break;

      case 'move-to-workspace-picker':
        if (result.workspaceId) {
          window.gZenWorkspaces.moveTabToWorkspace(gBrowser.selectedTab, result.workspaceId);
          exitSearchMode();
        }
        break;

      case 'add-to-folder-picker':
        if (result.folder) {
          addTabToFolder(result.folder);
        }
        break;
      case 'rename-folder-picker':
        if (result.folder) {
          commandSubFlow.data = { folderId: result.folder.id };
          enterSubFlow('rename-folder-input', `Rename: ${result.label}`);
        }
        break;

      case 'rename-workspace-picker':
        if (result.workspaceId) {
          commandSubFlow.data = { workspaceId: result.workspaceId };
          enterSubFlow('rename-workspace-input', `Rename: ${result.label}`);
        }
        break;

      case 'rename-folder-input': {
        const newFolderName = (commandQuery || '').trim();
        if (newFolderName) {
          const prevData = commandSubFlowStack[commandSubFlowStack.length - 1]?.data;
          const folderId = prevData?.folderId || commandSubFlow.data?.folderId;
          if (folderId) {
            renameFolder(folderId, newFolderName);
          }
        }
        break;
      }

      case 'rename-workspace-input': {
        const newWsName = (commandQuery || '').trim();
        if (newWsName) {
          const prevData = commandSubFlowStack[commandSubFlowStack.length - 1]?.data;
          const wsId = prevData?.workspaceId || commandSubFlow.data?.workspaceId;
          if (wsId) {
            renameWorkspace(wsId, newWsName);
          }
        }
        break;
      }
    }
  }

  // Action executors for sub-flows
  function selectTabsInBrowseMode(tabs) {
    exitSearchMode();
    setTimeout(() => {
      enterLeapMode();
      // Enter browse mode at the first matched tab
      const visibleTabs = getVisibleTabs();
      const firstMatchIdx = tabs.length > 0 ? visibleTabs.indexOf(tabs[0]) : -1;

      browseMode = true;
      browseDirection = 'down';
      const currentTab = gBrowser.selectedTab;
      const currentIdx = visibleTabs.indexOf(currentTab);
      originalTabIndex = currentIdx >= 0 ? currentIdx : 0;
      originalTab = currentTab;
      highlightedTabIndex = firstMatchIdx >= 0 ? firstMatchIdx : originalTabIndex;

      // Pre-select the matched tabs
      selectedTabs.clear();
      for (const t of tabs) {
        if (t && !t.closing && t.parentNode) selectedTabs.add(t);
      }

      updateHighlight();
      updateLeapOverlayState();
      log(`Browse mode with ${selectedTabs.size} pre-selected tabs`);
    }, 100);
  }

  function closeMatchedTabs(tabs) {
    const validTabs = tabs.filter(t => t && !t.closing && t.parentNode);
    const count = validTabs.length;
    for (const t of validTabs) gBrowser.removeTab(t);
    log(`Closed ${count} matching tabs`);
    exitSearchMode();
  }

  // Unload (discard) matched tabs to save memory
  function unloadMatchedTabs(tabs) {
    const validTabs = tabs.filter(t =>
      t && !t.closing && t.parentNode && !t.hasAttribute('pending')
    );
    if (validTabs.length === 0) {
      log('No tabs to unload (all already unloaded or invalid)');
      exitSearchMode();
      return;
    }

    const currentTab = gBrowser.selectedTab;
    const currentIsMatched = validTabs.includes(currentTab);

    if (currentIsMatched) {
      // Switch to the most recently accessed non-matched, non-pending tab
      const matchedSet = new Set(validTabs);
      const alternates = Array.from(gBrowser.tabs)
        .filter(t => t && !t.closing && t.parentNode && !matchedSet.has(t) &&
                      !t.hasAttribute('pending') && !t.hidden);
      alternates.sort((a, b) => (b._lastAccessed || 0) - (a._lastAccessed || 0));
      if (alternates[0]) {
        gBrowser.selectedTab = alternates[0];
      }
    }

    const count = validTabs.length;
    // Discard after delay to let any tab switch complete
    setTimeout(() => {
      for (const tab of validTabs) {
        try {
          gBrowser.discardBrowser(tab);
        } catch (e) {
          log(`Failed to unload tab: ${e}`);
        }
      }
      log(`Unloaded ${count} matching tabs`);
    }, S['timing.unloadTabDelay']);

    exitSearchMode();
  }

  // Sort tabs by their current sidebar position to preserve relative order
  function sortTabsBySidebarPosition(tabs) {
    const visibleTabs = getVisibleTabs();
    const positionMap = new Map();
    visibleTabs.forEach((t, idx) => positionMap.set(t, idx));
    return [...tabs].sort((a, b) => (positionMap.get(a) ?? 0) - (positionMap.get(b) ?? 0));
  }

  function moveMatchedTabsToPosition(tabs, position) {
    const validTabs = tabs.filter(t => t && !t.closing && t.parentNode);
    if (validTabs.length === 0) { exitSearchMode(); return; }

    // Move tabs from other workspaces into the current workspace first
    if (window.gZenWorkspaces) {
      const currentWsId = gZenWorkspaces.activeWorkspace;
      for (const tab of validTabs) {
        const tabWsId = tab.getAttribute('zen-workspace-id');
        if (tabWsId && tabWsId !== currentWsId) {
          gZenWorkspaces.moveTabToWorkspace(tab, currentWsId);
        }
      }
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
        // Find the first non-pinned, non-essential tab that is NOT being moved
        const anchor = visibleTabs.find(t => !t.pinned && !t.hasAttribute('zen-essential') && !sortedSet.has(t));
        if (anchor && sortedTabs.length > 0) {
          // Move first tab before the anchor, then chain each subsequent tab after the previous
          gBrowser.moveTabBefore(sortedTabs[0], anchor);
          for (let i = 1; i < sortedTabs.length; i++) {
            gBrowser.moveTabAfter(sortedTabs[i], sortedTabs[i - 1]);
          }
        } else {
          // All regular tabs are being moved (or single tab) — find first regular tab as anchor
          const firstRegular = visibleTabs.find(t => !t.pinned && !t.hasAttribute('zen-essential'));
          if (firstRegular) {
            gBrowser.moveTabBefore(sortedTabs[0], firstRegular);
            for (let i = 1; i < sortedTabs.length; i++) {
              gBrowser.moveTabAfter(sortedTabs[i], sortedTabs[i - 1]);
            }
          }
        }
      } else {
        // Move to bottom - chain each tab after the previous, starting after the last visible tab
        if (sortedTabs.length > 0) {
          const lastVisible = getVisibleTabs();
          const lastTab = lastVisible[lastVisible.length - 1];
          if (lastTab && lastTab !== sortedTabs[0]) {
            gBrowser.moveTabAfter(sortedTabs[0], lastTab);
          }
          for (let i = 1; i < sortedTabs.length; i++) {
            gBrowser.moveTabAfter(sortedTabs[i], sortedTabs[i - 1]);
          }
        }
      }
      log(`Moved ${sortedTabs.length} tabs to ${position}`);
    } catch (e) { log(`Move to ${position} failed: ${e}`); }
    exitSearchMode();
  }

  function moveTabsToWorkspace(tabs, workspaceId) {
    try {
      for (const t of tabs) {
        if (t && !t.closing && t.parentNode) {
          window.gZenWorkspaces.moveTabToWorkspace(t, workspaceId);
        }
      }
      log(`Moved ${tabs.length} tabs to workspace ${workspaceId}`);
    } catch (e) { log(`Move to workspace failed: ${e}`); }
    exitSearchMode();
  }

  function addTabsToFolder(tabs, folderResult) {
    const validTabs = tabs.filter(t => t && !t.closing && t.parentNode);
    if (validTabs.length === 0) { exitSearchMode(); return; }

    // Sort tabs by sidebar position to preserve relative order
    const sortedTabs = sortTabsBySidebarPosition(validTabs);

    try {
      // Re-fetch folder by ID to avoid stale DOM references
      const targetFolder = folderResult.folder ?
        document.getElementById(folderResult.folder.id) : null;
      if (!targetFolder) { log('Target folder not found'); exitSearchMode(); return; }

      // Handle workspace and pin for each tab
      const targetWorkspaceId = targetFolder.getAttribute('zen-workspace-id');
      for (const t of sortedTabs) {
        if (targetWorkspaceId && window.gZenWorkspaces) {
          const currentWsId = t.getAttribute('zen-workspace-id') || window.gZenWorkspaces.activeWorkspace;
          if (currentWsId !== targetWorkspaceId) {
            window.gZenWorkspaces.moveTabToWorkspace(t, targetWorkspaceId);
          }
        }
        if (!t.pinned) gBrowser.pinTab(t);
      }
      targetFolder.addTabs(sortedTabs);
      log(`Added ${sortedTabs.length} tabs to folder: ${targetFolder.label}`);
    } catch (e) { log(`Add to folder failed: ${e}`); }
    exitSearchMode();
  }

  function createFolderWithName(tabs, folderName) {
    const validTabs = tabs.filter(t => t && !t.closing && t.parentNode);
    if (validTabs.length === 0) { exitSearchMode(); return; }

    // Sort tabs by sidebar position to preserve relative order
    const sortedTabs = sortTabsBySidebarPosition(validTabs);

    try {
      if (!window.gZenFolders) {
        log('gZenFolders not available');
        exitSearchMode();
        return;
      }
      // gZenFolders.createFolder handles pinning tabs internally
      gZenFolders.createFolder(sortedTabs, {
        label: folderName,
        renameFolder: false,
      });
      log(`Created folder "${folderName}" with ${sortedTabs.length} tabs`);
    } catch (e) { log(`Create folder with name failed: ${e}`); }
    exitSearchMode();
  }

  function splitWithTab(tab) {
    try {
      if (window.gZenViewSplitter && tab) {
        window.gZenViewSplitter.splitTabs([gBrowser.selectedTab, tab]);
        log(`Split view with tab: ${tab.label}`);
      }
    } catch (e) { log(`Split failed: ${e}`); }
    exitSearchMode();
  }

  function addTabToFolder(folder) {
    try {
      const tabToMove = gBrowser.selectedTab;
      if (!tabToMove) { exitSearchMode(); return; }
      // Re-fetch folder by ID to avoid stale DOM references
      const targetFolder = document.getElementById(folder.id);
      if (!targetFolder) { log(`Folder not found: ${folder.id}`); exitSearchMode(); return; }

      // Handle cross-workspace moves
      const targetWorkspaceId = targetFolder.getAttribute('zen-workspace-id');
      if (targetWorkspaceId && window.gZenWorkspaces) {
        const currentWorkspaceId = tabToMove.getAttribute('zen-workspace-id') || window.gZenWorkspaces.activeWorkspace;
        if (currentWorkspaceId !== targetWorkspaceId) {
          window.gZenWorkspaces.moveTabToWorkspace(tabToMove, targetWorkspaceId);
        }
      }

      // Pin tab if not already pinned (Zen folders require pinned tabs)
      if (!tabToMove.pinned) {
        gBrowser.pinTab(tabToMove);
      }

      const name = targetFolder.label || targetFolder.getAttribute('zen-folder-name') || 'Unnamed Folder';
      targetFolder.addTabs([tabToMove]);
      log(`Added tab to folder: ${name}`);
    } catch(e) { log(`Add to folder failed: ${e}`); }
    exitSearchMode();
  }

  function deleteFolder(folder) {
    try {
      // Re-fetch folder by ID to avoid stale DOM references
      const targetFolder = document.getElementById(folder.id);
      if (!targetFolder) { log('Folder not found for deletion'); exitSearchMode(); return; }
      const name = targetFolder.label || targetFolder.getAttribute('zen-folder-name') || 'Unnamed Folder';
      // Use zen-folder's native delete() which cleans up zen-empty-tab placeholders first
      if (typeof targetFolder.delete === 'function') {
        targetFolder.delete();
      } else if (typeof gBrowser.removeTabGroup === 'function') {
        gBrowser.removeTabGroup(targetFolder, { isUserTriggered: true });
      }
      log(`Deleted folder: ${name}`);
    } catch (e) { log(`Delete folder failed: ${e}`); }
    exitSearchMode();
  }

  function deleteWorkspace(workspaceId) {
    try {
      if (!window.gZenWorkspaces) { log('gZenWorkspaces not available'); exitSearchMode(); return; }
      // Use Zen's workspace removal API
      if (typeof gZenWorkspaces.removeWorkspace === 'function') {
        gZenWorkspaces.removeWorkspace(workspaceId);
      } else if (typeof gZenWorkspaces.deleteWorkspace === 'function') {
        gZenWorkspaces.deleteWorkspace(workspaceId);
      } else {
        log('No API available to delete workspace');
        exitSearchMode();
        return;
      }
      log(`Deleted workspace: ${workspaceId}`);
    } catch (e) { log(`Delete workspace failed: ${e}`); }
    exitSearchMode();
  }

  function renameFolder(folderId, newName) {
    try {
      const targetFolder = document.getElementById(folderId);
      if (!targetFolder) { log('Folder not found for rename'); exitSearchMode(); return; }
      const oldName = targetFolder.label || targetFolder.getAttribute('zen-folder-name') || 'Unnamed Folder';
      // Use the folder's name setter which triggers ZenFolderRenamed event
      if ('name' in targetFolder) {
        targetFolder.name = newName;
      } else if (targetFolder.labelElement) {
        targetFolder.label = newName;
      } else {
        targetFolder.setAttribute('zen-folder-name', newName);
      }
      log(`Renamed folder: "${oldName}" → "${newName}"`);
    } catch (e) { log(`Rename folder failed: ${e}`); }
    exitSearchMode();
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
    } catch (e) { log(`Rename workspace failed: ${e}`); }
    exitSearchMode();
  }

  // Switch focus to the split pane in the given direction
  function splitFocusInDirection(direction) {
    try {
      const splitter = window.gZenViewSplitter;
      if (!splitter?.splitViewActive) return;

      const viewData = splitter._data[splitter.currentView];
      if (!viewData?.tabs || viewData.tabs.length < 2) return;

      const currentTab = gBrowser.selectedTab;
      const currentNode = splitter.getSplitNodeFromTab(currentTab);
      if (!currentNode?.positionToRoot) return;

      const cur = currentNode.positionToRoot;
      const curCenterX = (cur.left + (100 - cur.right)) / 2;
      const curCenterY = (cur.top + (100 - cur.bottom)) / 2;

      let bestTab = null;
      let bestDistance = Infinity;

      for (const tab of viewData.tabs) {
        if (tab === currentTab) continue;

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
      } else {
        log(`Split focus: no pane found ${direction} of current`);
      }
    } catch (e) {
      log(`Split focus failed: ${e}`);
    }
  }

  // Deduplicate tabs: find tabs with same URL, keep most recent, close the rest
  function deduplicateTabs() {
    // Get ALL tabs across all workspaces
    let allTabs;
    try {
      if (window.gZenWorkspaces?.allStoredTabs) {
        allTabs = Array.from(gZenWorkspaces.allStoredTabs);
      } else {
        allTabs = Array.from(gBrowser.tabs);
      }
    } catch (e) {
      allTabs = Array.from(gBrowser.tabs);
    }

    // Filter to valid, non-essential, non-pinned tabs
    const validTabs = allTabs.filter(t =>
      t && !t.closing && t.parentNode &&
      !t.pinned &&
      !t.hasAttribute('zen-essential') &&
      !t.hasAttribute('zen-glance-tab') &&
      !t.hasAttribute('zen-empty-tab')
    );

    // Group by URL
    const urlGroups = new Map();
    for (const tab of validTabs) {
      const url = tab.linkedBrowser?.currentURI?.spec;
      if (!url || url === 'about:blank' || url === 'about:newtab') continue;
      if (!urlGroups.has(url)) urlGroups.set(url, []);
      urlGroups.get(url).push(tab);
    }

    // For each group with >1 tab, keep the most recently accessed, close the rest
    let closedCount = 0;
    for (const [url, tabs] of urlGroups) {
      if (tabs.length < 2) continue;
      tabs.sort((a, b) => (b._lastAccessed || 0) - (a._lastAccessed || 0));
      for (let i = 1; i < tabs.length; i++) {
        try {
          gBrowser.removeTab(tabs[i]);
          closedCount++;
        } catch (e) {
          log(`Failed to close duplicate tab: ${e}`);
        }
      }
    }

    log(`Deduplicated: closed ${closedCount} duplicate tab(s)`);
  }

  // Render search results
  function renderSearchResults() {
    if (!searchResultsList) return;

    searchResults = searchTabs(searchQuery);

    if (searchResults.length === 0) {
      searchResultsList.innerHTML = '<div class="zenleap-search-empty">No matching tabs found</div>';
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

      const wsBadge = result.workspaceName ? `<span class="zenleap-search-result-ws">${escapeHtml(result.workspaceName)}</span>` : '';

      html += `
        <div class="zenleap-search-result ${isSelected ? 'selected' : ''}" data-index="${idx}">
          <img class="zenleap-search-result-favicon" src="${escapeHtml(favicon)}" />
          <div class="zenleap-search-result-info">
            <div class="zenleap-search-result-title"><span class="zenleap-search-result-title-text">${highlightedTitle}</span>${wsBadge}</div>
            <div class="zenleap-search-result-url">${highlightedUrl}</div>
          </div>
          ${label ? `<span class="zenleap-search-result-label">${label}</span>` : ''}
        </div>
      `;
    });

    // Add hint bar
    html += `
    `;

    searchResultsList.innerHTML = html;

    // Update hint bar
    updateSearchHintBar();

    // Add click handlers and favicon error handlers
    searchResultsList.querySelectorAll('.zenleap-search-result').forEach(el => {
      el.addEventListener('click', () => {
        const idx = parseInt(el.dataset.index);
        selectSearchResult(idx);
      });

      // Handle favicon load errors
      const img = el.querySelector('.zenleap-search-result-favicon');
      if (img) {
        img.addEventListener('error', () => {
          img.src = 'chrome://branding/content/icon32.png';
        });
      }
    });

    // Scroll selected into view
    const selectedEl = searchResultsList.querySelector('.zenleap-search-result.selected');
    if (selectedEl) {
      selectedEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
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
      if (count === 0) {
        html += `<div class="zenleap-command-count">No duplicate tabs found</div>`;
      } else {
        html += `<div class="zenleap-command-count">${count} duplicate${count !== 1 ? 's' : ''} will be closed — press Enter to confirm</div>`;
      }
    }

    results.forEach((cmd, idx) => {
      const isSelected = idx === searchSelectedIndex;
      const label = idx < 9 ? idx + 1 : '';

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
        const cmdWsBadge = cmd.workspaceName ? `<span class="zenleap-search-result-ws">${escapeHtml(cmd.workspaceName)}</span>` : '';

        html += `
          <div class="zenleap-command-result ${isSelected ? 'selected' : ''}" data-index="${idx}">
            <img class="zenleap-search-result-favicon" src="${escapeHtml(favicon)}" />
            <div class="zenleap-command-info">
              <div class="zenleap-command-label"><span class="zenleap-search-result-title-text">${highlightedTitle}</span>${cmdWsBadge}</div>
              <div class="zenleap-command-sublabel">${highlightedUrl}</div>
            </div>
            ${label ? `<span class="zenleap-command-result-label">${label}</span>` : ''}
          </div>`;
      } else {
        // Command result
        const highlightedLabel = cmd.labelIndices ? highlightMatches(cmd.label, cmd.labelIndices) : escapeHtml(cmd.label);
        const hasArrow = cmd.subFlow ? ' →' : '';

        html += `
          <div class="zenleap-command-result ${isSelected ? 'selected' : ''}" data-index="${idx}">
            <div class="zenleap-command-icon">${cmd.icon || '⚡'}</div>
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

    // Add click handlers and favicon error handlers
    searchResultsList.querySelectorAll('.zenleap-command-result').forEach(el => {
      el.addEventListener('click', () => {
        const idx = parseInt(el.dataset.index);
        searchSelectedIndex = idx;
        handleCommandSelect();
      });
      const img = el.querySelector('.zenleap-search-result-favicon');
      if (img) {
        img.addEventListener('error', () => { img.src = 'chrome://branding/content/icon32.png'; });
      }
    });

    // Scroll selected into view
    const selectedEl = searchResultsList.querySelector('.zenleap-command-result.selected');
    if (selectedEl) selectedEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });

    // Show preview panel for dedup-preview sub-flow
    if (commandSubFlow?.type === 'dedup-preview' && commandResults.length > 0) {
      const selectedResult = commandResults[searchSelectedIndex];
      if (selectedResult?.tab) {
        showPreviewForTab(selectedResult.tab, { force: true });
        positionPreviewPanelForModal();
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
        const scopeLabel = S['display.searchAllWorkspaces'] ? 'this workspace' : 'all workspaces';
        if (vimEnabled && searchVimMode === 'normal') {
          searchHintBar.innerHTML = `
            <span><kbd>j/k</kbd> navigate</span>
            <span><kbd>1-9</kbd> jump</span>
            <span><kbd>o</kbd> go to tab</span>
            <span><kbd>Tab</kbd> ${scopeLabel}</span>
            <span><kbd>Enter</kbd> confirm delete</span>
            <span><kbd>Esc</kbd> cancel</span>
          `;
        } else {
          searchHintBar.innerHTML = `
            <span><kbd>↑↓</kbd> navigate</span>
            <span><kbd>Ctrl+o</kbd> go to tab</span>
            <span><kbd>Tab</kbd> ${scopeLabel}</span>
            <span><kbd>Enter</kbd> confirm delete</span>
            <span><kbd>Esc</kbd> cancel</span>
          `;
        }
        return;
      }
      if (vimEnabled && searchVimMode === 'normal') {
        searchHintBar.innerHTML = `
          <span><kbd>j/k</kbd> navigate</span>
          <span><kbd>1-9</kbd> jump</span>
          <span><kbd>Enter</kbd> ${commandSubFlow ? 'select' : 'execute'}</span>
          <span><kbd>i</kbd> insert</span>
          <span><kbd>Esc</kbd> ${commandSubFlow ? 'back' : 'exit'}</span>
        `;
      } else {
        searchHintBar.innerHTML = `
          <span><kbd>↑↓</kbd> navigate</span>
          <span><kbd>Enter</kbd> ${commandSubFlow ? 'select' : 'execute'}</span>
          <span><kbd>Esc</kbd> ${vimEnabled ? 'normal mode' : (commandSubFlow ? 'back' : 'exit')}</span>
        `;
      }
      return;
    }

    if (vimEnabled && searchVimMode === 'normal') {
      searchHintBar.innerHTML = `
        <span><kbd>j/k</kbd> navigate</span>
        <span><kbd>Enter</kbd> open</span>
        <span><kbd>x</kbd> close tab</span>
        <span><kbd>Tab</kbd> all workspaces</span>
        <span><kbd>1-9</kbd> jump</span>
        <span><kbd>Esc</kbd> close</span>
      `;
    } else {
      searchHintBar.innerHTML = `
        <span><kbd>↑↓</kbd> navigate</span>
        <span><kbd>Enter</kbd> open</span>
        <span><kbd>Tab</kbd> all workspaces</span>
        <span><kbd>Ctrl+x</kbd> close tab</span>
        <span><kbd>></kbd> commands</span>
        <span><kbd>Esc</kbd> ${vimEnabled ? 'normal mode' : 'close'}</span>
      `;
    }
  }

  // ============================================
  // HELP MODAL
  // ============================================

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

      <div class="zenleap-help-content">
        <div class="zenleap-help-section">
          <h2>&#128640; Leap Mode</h2>
          <p class="zenleap-help-trigger"><kbd>Ctrl</kbd> + <kbd>Space</kbd> to activate</p>
          <div class="zenleap-help-grid">
            <div class="zenleap-help-item"><kbd>j</kbd> / <kbd>k</kbd><span>Enter browse mode (down/up)</span></div>
            <div class="zenleap-help-item"><kbd>&#8593;</kbd> / <kbd>&#8595;</kbd><span>Enter browse mode (arrows)</span></div>
            <div class="zenleap-help-item"><kbd>h</kbd> / <kbd>l</kbd><span>Browse + switch workspace</span></div>
            <div class="zenleap-help-item"><kbd>&#8592;</kbd> / <kbd>&#8594;</kbd><span>Browse + switch workspace (arrows)</span></div>
            <div class="zenleap-help-item"><kbd>g</kbd><span>G-mode (absolute positioning)</span></div>
            <div class="zenleap-help-item"><kbd>z</kbd><span>Z-mode (scroll commands)</span></div>
            <div class="zenleap-help-item"><kbd>m</kbd><span>Set mark on current tab</span></div>
            <div class="zenleap-help-item"><kbd>M</kbd><span>Clear all marks</span></div>
            <div class="zenleap-help-item"><kbd>'</kbd><span>Jump to mark</span></div>
            <div class="zenleap-help-item"><kbd>o</kbd> / <kbd>i</kbd><span>Jump back / forward in history</span></div>
            <div class="zenleap-help-item"><kbd>?</kbd><span>Show this help</span></div>
            <div class="zenleap-help-item"><kbd>Esc</kbd><span>Exit leap mode</span></div>
          </div>
        </div>

        <div class="zenleap-help-section">
          <h2>&#128194; Browse Mode</h2>
          <p class="zenleap-help-trigger">After pressing <kbd>j</kbd> or <kbd>k</kbd> in leap mode</p>
          <div class="zenleap-help-grid">
            <div class="zenleap-help-item"><kbd>j</kbd> / <kbd>k</kbd><span>Move highlight down/up</span></div>
            <div class="zenleap-help-item"><kbd>Shift</kbd>+<kbd>J</kbd>/<kbd>K</kbd><span>Navigate + select</span></div>
            <div class="zenleap-help-item"><kbd>Space</kbd><span>Toggle selection on tab</span></div>
            <div class="zenleap-help-item"><kbd>y</kbd><span>Yank (copy) selected tabs</span></div>
            <div class="zenleap-help-item"><kbd>p</kbd> / <kbd>P</kbd><span>Paste after / before</span></div>
            <div class="zenleap-help-item"><kbd>h</kbd> / <kbd>l</kbd> / <kbd>&#8592;</kbd> / <kbd>&#8594;</kbd><span>Switch workspace</span></div>
            <div class="zenleap-help-item"><kbd>gg</kbd> / <kbd>G</kbd><span>Jump to first / last tab</span></div>
            <div class="zenleap-help-item"><kbd>Enter</kbd><span>Open highlighted tab</span></div>
            <div class="zenleap-help-item"><kbd>x</kbd><span>Close selected/highlighted tab(s)</span></div>
            <div class="zenleap-help-item"><kbd>1-9</kbd> <kbd>a-z</kbd><span>Jump N tabs from origin</span></div>
            <div class="zenleap-help-item"><kbd>Esc</kbd><span>Cancel, return to original</span></div>
          </div>
        </div>

        <div class="zenleap-help-section">
          <h2>&#128205; G-Mode</h2>
          <p class="zenleap-help-trigger">After pressing <kbd>g</kbd> in leap mode</p>
          <div class="zenleap-help-grid">
            <div class="zenleap-help-item"><kbd>g</kbd><span>Go to first tab (gg)</span></div>
            <div class="zenleap-help-item"><kbd>G</kbd><span>Go to last tab</span></div>
            <div class="zenleap-help-item"><kbd>1-9</kbd> + <kbd>Enter</kbd><span>Go to tab #N</span></div>
          </div>
        </div>

        <div class="zenleap-help-section">
          <h2>&#128220; Z-Mode</h2>
          <p class="zenleap-help-trigger">After pressing <kbd>z</kbd> in leap mode</p>
          <div class="zenleap-help-grid">
            <div class="zenleap-help-item"><kbd>z</kbd><span>Center current tab (zz)</span></div>
            <div class="zenleap-help-item"><kbd>t</kbd><span>Scroll to top (zt)</span></div>
            <div class="zenleap-help-item"><kbd>b</kbd><span>Scroll to bottom (zb)</span></div>
          </div>
        </div>

        <div class="zenleap-help-section">
          <h2>&#128278; Marks</h2>
          <div class="zenleap-help-grid">
            <div class="zenleap-help-item"><kbd>m</kbd> + <kbd>a-z</kbd><span>Set mark (repeat to toggle off)</span></div>
            <div class="zenleap-help-item"><kbd>M</kbd><span>Clear all marks</span></div>
            <div class="zenleap-help-item"><kbd>'</kbd> + <kbd>a-z</kbd><span>Jump to marked tab</span></div>
            <div class="zenleap-help-item"><kbd>Ctrl</kbd>+<kbd>'</kbd>+<kbd>char</kbd><span>Quick jump (no leap mode)</span></div>
          </div>
        </div>

        <div class="zenleap-help-section">
          <h2>&#128269; Tab Search</h2>
          <p class="zenleap-help-trigger"><kbd>Ctrl</kbd> + <kbd>/</kbd> to open</p>

          <h3>Insert Mode</h3>
          <div class="zenleap-help-grid">
            <div class="zenleap-help-item"><kbd>&#8593;</kbd>/<kbd>&#8595;</kbd> or <kbd>Ctrl</kbd>+<kbd>j/k</kbd><span>Navigate results</span></div>
            <div class="zenleap-help-item"><kbd>Enter</kbd><span>Open selected tab</span></div>
            <div class="zenleap-help-item"><kbd>Ctrl</kbd>+<kbd>x</kbd><span>Close selected tab</span></div>
            <div class="zenleap-help-item"><kbd>></kbd><span>Enter command mode</span></div>
            <div class="zenleap-help-item"><kbd>Esc</kbd><span>Switch to normal mode</span></div>
          </div>

          <h3>Normal Mode</h3>
          <div class="zenleap-help-grid">
            <div class="zenleap-help-item"><kbd>j</kbd>/<kbd>k</kbd><span>Navigate results</span></div>
            <div class="zenleap-help-item"><kbd>1-9</kbd><span>Quick jump to result</span></div>
            <div class="zenleap-help-item"><kbd>x</kbd><span>Close selected tab</span></div>
            <div class="zenleap-help-item"><kbd>h/l/w/b/e/0/$</kbd><span>Vim cursor movement</span></div>
            <div class="zenleap-help-item"><kbd>i/a/I/A</kbd><span>Enter insert mode</span></div>
            <div class="zenleap-help-item"><kbd>s/S/D/C</kbd><span>Substitute/delete/change</span></div>
            <div class="zenleap-help-item"><kbd>Esc</kbd><span>Close search</span></div>
          </div>
        </div>

        <div class="zenleap-help-section">
          <h2>&#9881; Command Palette</h2>
          <p class="zenleap-help-trigger"><kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>/</kbd> or type <kbd>></kbd> in search</p>
          <div class="zenleap-help-grid">
            <div class="zenleap-help-item"><kbd>j</kbd>/<kbd>k</kbd> or <kbd>&#8593;</kbd>/<kbd>&#8595;</kbd><span>Navigate commands</span></div>
            <div class="zenleap-help-item"><kbd>Enter</kbd><span>Execute command</span></div>
            <div class="zenleap-help-item"><kbd>1-9</kbd><span>Quick jump + execute</span></div>
            <div class="zenleap-help-item"><kbd>Esc</kbd><span>Back / close</span></div>
          </div>
        </div>

        <div class="zenleap-help-section">
          <h2>&#9638; Split View</h2>
          <p class="zenleap-help-trigger">When split view is active (works globally)</p>
          <div class="zenleap-help-grid">
            <div class="zenleap-help-item"><kbd>Alt</kbd>+<kbd>h</kbd><span>Focus pane to the left</span></div>
            <div class="zenleap-help-item"><kbd>Alt</kbd>+<kbd>j</kbd><span>Focus pane below</span></div>
            <div class="zenleap-help-item"><kbd>Alt</kbd>+<kbd>k</kbd><span>Focus pane above</span></div>
            <div class="zenleap-help-item"><kbd>Alt</kbd>+<kbd>l</kbd><span>Focus pane to the right</span></div>
          </div>
        </div>
      </div>

      <div class="zenleap-help-footer">
        <span>Press <kbd>Esc</kbd> or <kbd>?</kbd> to close</span>
      </div>
    `;

    helpModal.appendChild(backdrop);
    helpModal.appendChild(container);

    // Inject styles
    const style = document.createElement('style');
    style.id = 'zenleap-help-styles';
    style.textContent = `
      #zenleap-help-modal {
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        z-index: 100001;
        display: none;
        justify-content: center;
        align-items: center;
        padding: 20px;
      }

      #zenleap-help-modal.active {
        display: flex;
      }

      #zenleap-help-backdrop {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.7);
        backdrop-filter: blur(8px);
      }

      #zenleap-help-container {
        position: relative;
        width: 95%;
        max-width: 900px;
        max-height: 85vh;
        background: rgba(25, 25, 30, 0.98);
        border-radius: 16px;
        box-shadow: 0 12px 48px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.1);
        overflow: hidden;
        display: flex;
        flex-direction: column;
        animation: zenleap-help-appear 0.2s ease-out;
      }

      @keyframes zenleap-help-appear {
        from {
          opacity: 0;
          transform: scale(0.95) translateY(-10px);
        }
        to {
          opacity: 1;
          transform: scale(1) translateY(0);
        }
      }

      .zenleap-help-header {
        padding: 24px 32px 20px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        display: flex;
        align-items: center;
        justify-content: center;
        position: relative;
      }

      .zenleap-help-header > div {
        text-align: center;
      }

      .zenleap-help-settings-btn {
        position: absolute;
        right: 24px;
        top: 50%;
        transform: translateY(-50%);
        background: rgba(97, 175, 239, 0.1);
        border: 1px solid rgba(97, 175, 239, 0.25);
        color: #abb2bf;
        font-size: 13px;
        padding: 6px 14px;
        border-radius: 8px;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 6px;
        transition: all 0.2s ease;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        white-space: nowrap;
      }

      .zenleap-help-settings-btn:hover {
        background: rgba(97, 175, 239, 0.2);
        border-color: rgba(97, 175, 239, 0.4);
        color: #61afef;
      }

      .zenleap-help-header h1 {
        margin: 0;
        font-size: 28px;
        font-weight: 700;
        color: #61afef;
        letter-spacing: -0.5px;
        display: inline;
      }

      .zenleap-help-version {
        font-size: 12px;
        color: #666;
        margin-left: 12px;
        font-family: monospace;
      }

      .zenleap-help-subtitle {
        display: block;
        margin-top: 6px;
        font-size: 14px;
        color: #888;
        font-weight: 400;
      }

      .zenleap-help-content {
        flex: 1;
        overflow-y: auto;
        padding: 24px 32px;
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
        gap: 24px;
      }

      .zenleap-help-section {
        background: rgba(255, 255, 255, 0.03);
        border-radius: 12px;
        padding: 20px;
        border: 1px solid rgba(255, 255, 255, 0.06);
      }

      .zenleap-help-section h2 {
        margin: 0 0 12px 0;
        font-size: 16px;
        font-weight: 600;
        color: #e0e0e0;
      }

      .zenleap-help-section h3 {
        margin: 16px 0 10px 0;
        font-size: 12px;
        font-weight: 600;
        color: #888;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }

      .zenleap-help-trigger {
        margin: 0 0 14px 0;
        font-size: 12px;
        color: #666;
      }

      .zenleap-help-grid {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .zenleap-help-item {
        display: flex;
        align-items: center;
        gap: 12px;
        font-size: 13px;
      }

      .zenleap-help-item kbd {
        background: rgba(97, 175, 239, 0.15);
        color: #61afef;
        padding: 3px 8px;
        border-radius: 4px;
        font-family: monospace;
        font-size: 11px;
        font-weight: 600;
        border: 1px solid rgba(97, 175, 239, 0.3);
        min-width: 20px;
        text-align: center;
      }

      .zenleap-help-item span {
        color: #aaa;
        flex: 1;
      }

      .zenleap-help-footer {
        padding: 16px 32px;
        border-top: 1px solid rgba(255, 255, 255, 0.1);
        text-align: center;
        font-size: 12px;
        color: #666;
      }

      .zenleap-help-footer kbd {
        background: rgba(255, 255, 255, 0.1);
        color: #888;
        padding: 2px 6px;
        border-radius: 3px;
        font-family: monospace;
        font-size: 10px;
      }

      /* Scrollbar styling */
      .zenleap-help-content::-webkit-scrollbar {
        width: 8px;
      }

      .zenleap-help-content::-webkit-scrollbar-track {
        background: transparent;
      }

      .zenleap-help-content::-webkit-scrollbar-thumb {
        background: rgba(255, 255, 255, 0.1);
        border-radius: 4px;
      }

      .zenleap-help-content::-webkit-scrollbar-thumb:hover {
        background: rgba(255, 255, 255, 0.2);
      }
    `;

    document.head.appendChild(style);
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

    // Exit leap mode if active
    if (leapMode) {
      exitLeapMode(false);
    }

    createHelpModal();

    helpMode = true;
    helpModal.classList.add('active');

    log('Entered help mode');
  }

  function exitHelpMode() {
    if (!helpMode) return;

    helpMode = false;
    helpModal.classList.remove('active');

    log('Exited help mode');
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
    searchInput.placeholder = 'Search settings...';
    searchInput.addEventListener('input', (e) => {
      settingsSearchQuery = e.target.value.toLowerCase();
      renderSettingsContent();
    });
    searchWrap.appendChild(searchIcon);
    searchWrap.appendChild(searchInput);

    // Tabs
    const tabs = document.createElement('div');
    tabs.className = 'zenleap-settings-tabs';
    tabs.id = 'zenleap-settings-tabs';
    ['Keybindings', 'Timing', 'Appearance', 'Display', 'Advanced'].forEach(cat => {
      const btn = document.createElement('button');
      btn.textContent = cat;
      btn.dataset.tab = cat;
      if (cat === settingsActiveTab) btn.classList.add('active');
      btn.addEventListener('click', () => {
        settingsActiveTab = cat;
        tabs.querySelectorAll('button').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        renderSettingsContent();
      });
      tabs.appendChild(btn);
    });

    // Body
    const body = document.createElement('div');
    body.id = 'zenleap-settings-body';

    // Footer (create button via createElement — innerHTML strips <button> in chrome context)
    const footer = document.createElement('div');
    footer.className = 'zenleap-settings-footer';
    const resetAllBtn = document.createElement('button');
    resetAllBtn.className = 'zenleap-settings-reset-all';
    resetAllBtn.textContent = 'Reset All to Defaults';
    resetAllBtn.addEventListener('click', () => {
      resetAllSettings();
      renderSettingsContent();
    });
    footer.appendChild(resetAllBtn);

    container.appendChild(header);
    container.appendChild(searchWrap);
    container.appendChild(tabs);
    container.appendChild(body);
    container.appendChild(footer);

    modal.appendChild(backdrop);
    modal.appendChild(container);

    // Inject styles
    const style = document.createElement('style');
    style.id = 'zenleap-settings-styles';
    style.textContent = `
      #zenleap-settings-modal {
        position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
        z-index: 100002; display: none; justify-content: center; align-items: center; padding: 20px;
      }
      #zenleap-settings-modal.active { display: flex; }
      #zenleap-settings-backdrop {
        position: absolute; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0, 0, 0, 0.7); backdrop-filter: blur(8px);
      }
      #zenleap-settings-container {
        position: relative; width: 95%; max-width: 750px; max-height: 85vh;
        background: rgba(25, 25, 30, 0.98); border-radius: 16px;
        box-shadow: 0 12px 48px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.1);
        overflow: hidden; display: flex; flex-direction: column;
        animation: zenleap-settings-appear 0.2s ease-out;
      }
      @keyframes zenleap-settings-appear {
        from { opacity: 0; transform: scale(0.95) translateY(-10px); }
        to { opacity: 1; transform: scale(1) translateY(0); }
      }
      .zenleap-settings-header {
        padding: 20px 24px 16px; border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        display: flex; justify-content: space-between; align-items: center;
      }
      .zenleap-settings-header h1 {
        margin: 0; font-size: 22px; font-weight: 700; color: #61afef; display: inline;
      }
      .zenleap-settings-subtitle {
        display: block; margin-top: 4px; font-size: 12px; color: #888;
      }
      .zenleap-settings-close-btn {
        background: none; border: none; color: #666; font-size: 18px; cursor: pointer;
        padding: 4px 8px; border-radius: 4px; transition: all 0.15s;
      }
      .zenleap-settings-close-btn:hover { color: #e0e0e0; background: rgba(255,255,255,0.1); }
      .zenleap-settings-search {
        display: flex; align-items: center; padding: 12px 24px; gap: 10px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.06);
      }
      .zenleap-settings-search-icon { font-size: 14px; opacity: 0.5; }
      #zenleap-settings-search-input {
        flex: 1; background: transparent; border: none; outline: none;
        font-size: 14px; color: #e0e0e0; caret-color: #61afef;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      }
      #zenleap-settings-search-input::placeholder { color: #555; }
      .zenleap-settings-tabs {
        display: flex; padding: 0 24px; gap: 4px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.06);
      }
      .zenleap-settings-tabs button {
        background: none; border: none; color: #888; font-size: 13px; font-weight: 500;
        padding: 10px 16px; cursor: pointer; border-bottom: 2px solid transparent;
        transition: all 0.15s; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      }
      .zenleap-settings-tabs button:hover { color: #ccc; }
      .zenleap-settings-tabs button.active {
        color: #61afef; border-bottom-color: #61afef;
      }
      #zenleap-settings-body {
        flex: 1; overflow-y: auto; padding: 16px 24px;
      }
      #zenleap-settings-body::-webkit-scrollbar { width: 8px; }
      #zenleap-settings-body::-webkit-scrollbar-track { background: transparent; }
      #zenleap-settings-body::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 4px; }
      #zenleap-settings-body::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.2); }
      .zenleap-settings-group { margin-bottom: 20px; }
      .zenleap-settings-group h3 {
        margin: 0 0 10px; font-size: 11px; font-weight: 600; color: #61afef;
        text-transform: uppercase; letter-spacing: 0.8px;
      }
      .zenleap-settings-row {
        display: flex; align-items: center; gap: 12px; padding: 8px 12px;
        border-radius: 8px; transition: background 0.1s;
      }
      .zenleap-settings-row:hover { background: rgba(255, 255, 255, 0.03); }
      .zenleap-settings-row.modified .zenleap-settings-name { color: #e5c07b; }
      .zenleap-settings-label { flex: 1; min-width: 0; }
      .zenleap-settings-name {
        font-size: 13px; font-weight: 500; color: #e0e0e0; display: block;
      }
      .zenleap-settings-desc {
        font-size: 11px; color: #666; display: block; margin-top: 2px;
      }
      .zenleap-settings-control { flex-shrink: 0; }
      .zenleap-key-recorder {
        background: rgba(97, 175, 239, 0.1); border: 1px solid rgba(97, 175, 239, 0.3);
        color: #61afef; padding: 5px 14px; border-radius: 6px; cursor: pointer;
        font-family: monospace; font-size: 12px; font-weight: 600;
        min-width: 80px; text-align: center; transition: all 0.15s;
      }
      .zenleap-key-recorder:hover {
        background: rgba(97, 175, 239, 0.2); border-color: rgba(97, 175, 239, 0.5);
      }
      .zenleap-key-recorder.recording {
        background: rgba(97, 175, 239, 0.25); border-color: #61afef;
        animation: zenleap-recording-pulse 1s ease-in-out infinite;
      }
      @keyframes zenleap-recording-pulse {
        0%, 100% { box-shadow: 0 0 0 0 rgba(97, 175, 239, 0.4); }
        50% { box-shadow: 0 0 0 6px rgba(97, 175, 239, 0); }
      }
      .zenleap-settings-control input[type="number"],
      .zenleap-settings-control input[type="text"] {
        background: rgba(255, 255, 255, 0.06); border: 1px solid rgba(255, 255, 255, 0.12);
        color: #e0e0e0; padding: 5px 10px; border-radius: 6px; font-size: 13px;
        width: 80px; outline: none; transition: border-color 0.15s;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      }
      .zenleap-settings-control input[type="text"] { width: 50px; text-align: center; font-family: monospace; }
      .zenleap-settings-control input:focus { border-color: #61afef; }
      /* Toggle switch */
      .zenleap-toggle {
        position: relative; display: inline-block; width: 40px; height: 22px; cursor: pointer;
      }
      .zenleap-toggle input { opacity: 0; width: 0; height: 0; }
      .zenleap-toggle-slider {
        position: absolute; top: 0; left: 0; right: 0; bottom: 0;
        background: rgba(255, 255, 255, 0.12); border-radius: 11px;
        transition: background 0.2s;
      }
      .zenleap-toggle-slider::before {
        content: ''; position: absolute; height: 16px; width: 16px;
        left: 3px; bottom: 3px; background: #888; border-radius: 50%;
        transition: all 0.2s;
      }
      .zenleap-toggle input:checked + .zenleap-toggle-slider { background: rgba(97, 175, 239, 0.4); }
      .zenleap-toggle input:checked + .zenleap-toggle-slider::before {
        transform: translateX(18px); background: #61afef;
      }
      .zenleap-settings-reset-btn {
        background: none; border: none; color: #555; font-size: 16px; cursor: pointer;
        padding: 4px 6px; border-radius: 4px; transition: all 0.15s; flex-shrink: 0;
      }
      .zenleap-settings-reset-btn:hover { color: #e06c75; background: rgba(224, 108, 117, 0.1); }
      .zenleap-settings-footer {
        padding: 12px 24px; border-top: 1px solid rgba(255, 255, 255, 0.1);
        display: flex; justify-content: center;
      }
      .zenleap-settings-reset-all {
        background: rgba(224, 108, 117, 0.1); border: 1px solid rgba(224, 108, 117, 0.3);
        color: #e06c75; padding: 6px 16px; border-radius: 6px; cursor: pointer;
        font-size: 12px; font-weight: 500; transition: all 0.15s;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      }
      .zenleap-settings-reset-all:hover {
        background: rgba(224, 108, 117, 0.2); border-color: rgba(224, 108, 117, 0.5);
      }
      .zenleap-color-control {
        display: flex; align-items: center; gap: 8px;
      }
      .zenleap-color-picker {
        width: 32px; height: 32px; border: none; border-radius: 6px;
        cursor: pointer; padding: 0; background: none;
        -moz-appearance: none; appearance: none;
      }
      .zenleap-color-picker::-moz-color-swatch {
        border: 2px solid rgba(255, 255, 255, 0.15); border-radius: 6px;
      }
      .zenleap-color-hex {
        background: rgba(255, 255, 255, 0.06); border: 1px solid rgba(255, 255, 255, 0.12);
        color: #e0e0e0; padding: 5px 8px; border-radius: 6px; font-size: 12px;
        width: 72px; font-family: monospace; text-align: center; outline: none;
        transition: border-color 0.15s;
      }
      .zenleap-color-hex:focus { border-color: #61afef; }
      .zenleap-settings-empty {
        padding: 40px 20px; text-align: center; color: #555; font-size: 14px;
      }
    `;
    document.head.appendChild(style);
    document.documentElement.appendChild(modal);

    // Only assign after successful creation so failures allow retry
    settingsModal = modal;

    renderSettingsContent();
    log('Settings modal created');
  }

  function renderSettingsContent() {
    const body = document.getElementById('zenleap-settings-body');
    if (!body) return;
    body.innerHTML = '';

    const entries = Object.entries(SETTINGS_SCHEMA).filter(([id, schema]) => {
      if (schema.category !== settingsActiveTab) return false;
      if (settingsSearchQuery) {
        const text = `${schema.label} ${schema.description || ''} ${schema.group} ${id}`.toLowerCase();
        return text.includes(settingsSearchQuery);
      }
      return true;
    });

    // Group by subcategory
    const groups = new Map();
    for (const [id, schema] of entries) {
      const g = schema.group || 'General';
      if (!groups.has(g)) groups.set(g, []);
      groups.get(g).push([id, schema]);
    }

    if (groups.size === 0) {
      body.innerHTML = '<div class="zenleap-settings-empty">No settings match your search</div>';
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
      });
      control.appendChild(toggle);
    } else if (schema.type === 'color') {
      const colorWrap = document.createElement('div');
      colorWrap.className = 'zenleap-color-control';
      const colorInput = document.createElement('input');
      colorInput.type = 'color';
      colorInput.value = S[id];
      colorInput.className = 'zenleap-color-picker';
      const hexInput = document.createElement('input');
      hexInput.type = 'text';
      hexInput.value = S[id];
      hexInput.maxLength = 7;
      hexInput.className = 'zenleap-color-hex';
      colorInput.addEventListener('input', () => {
        S[id] = colorInput.value;
        hexInput.value = colorInput.value;
        saveSettings();
        applyThemeColors();
        row.classList.toggle('modified', S[id] !== schema.default);
      });
      hexInput.addEventListener('change', () => {
        const val = hexInput.value.trim();
        if (/^#[0-9a-fA-F]{6}$/.test(val)) {
          S[id] = val;
          colorInput.value = val;
          saveSettings();
          applyThemeColors();
          row.classList.toggle('modified', S[id] !== schema.default);
        } else {
          hexInput.value = S[id]; // Revert invalid input
        }
      });
      colorWrap.appendChild(colorInput);
      colorWrap.appendChild(hexInput);
      control.appendChild(colorWrap);
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
    return row;
  }

  // Key recording for rebinding
  function startKeyRecording(settingId, buttonElement) {
    stopKeyRecording();
    settingsRecordingId = settingId;
    const schema = SETTINGS_SCHEMA[settingId];

    buttonElement.textContent = 'Press key\u2026';
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

      // Ignore bare modifier keys
      if (['Shift', 'Control', 'Alt', 'Meta', 'CapsLock'].includes(event.key)) return;

      if (schema.type === 'combo') {
        S[settingId] = {
          key: event.key,
          code: event.code,
          ctrl: event.ctrlKey,
          shift: event.shiftKey,
          alt: event.altKey,
          meta: event.metaKey,
        };
      } else {
        S[settingId] = schema.caseSensitive ? event.key : event.key.toLowerCase();
      }

      saveSettings();
      stopKeyRecording();
      renderSettingsContent();
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

    createSettingsModal();
    settingsMode = true;
    settingsModal.classList.add('active');

    setTimeout(() => {
      const input = document.getElementById('zenleap-settings-search-input');
      if (input) input.focus();
    }, 50);

    log('Entered settings mode');
  }

  function exitSettingsMode() {
    if (!settingsMode) return;
    stopKeyRecording();
    settingsMode = false;
    settingsModal.classList.remove('active');
    log('Exited settings mode');
  }

  // Enter search mode
  function enterSearchMode(asCommand = false) {
    if (searchMode) return;

    // Exit leap mode if active
    if (leapMode) {
      exitLeapMode(false);
    }

    createSearchModal();

    // Reset all search state
    searchMode = true;
    searchQuery = '';
    searchSelectedIndex = 0;
    searchVimMode = 'insert';
    searchCursorPos = 0;

    // Reset command state
    commandMode = false;
    commandQuery = '';
    commandSubFlow = null;
    commandSubFlowStack = [];
    commandMatchedTabs = [];
    commandResults = [];
    commandEnteredFromSearch = false;

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

    log(`Entered search mode${asCommand ? ' (command)' : ''}`);
  }

  // Exit search mode
  function exitSearchMode() {
    if (!searchMode) return;

    searchMode = false;
    searchModal.classList.remove('active');

    // Reset vim mode to insert for next time
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
    if (searchInput) searchInput.readOnly = false;
    hidePreviewPanel();

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

    log('Exited search mode');
  }

  // Select and open a search result
  async function selectSearchResult(index) {
    if (index < 0 || index >= searchResults.length) return;

    const result = searchResults[index];
    if (result && result.tab) {
      // Record jump before navigating
      recordJump(gBrowser.selectedTab);

      // Switch workspace if the tab belongs to a different workspace (async)
      if (result.workspaceName && window.gZenWorkspaces) {
        const tabWsId = result.tab.getAttribute('zen-workspace-id');
        if (tabWsId) {
          await gZenWorkspaces.changeWorkspaceWithID(tabWsId);
        }
      }

      gBrowser.selectedTab = result.tab;

      // Record destination
      recordJump(result.tab);

      log(`Opened tab from search: ${result.tab.label}`);
    }

    exitSearchMode();
  }

  // Show/hide WS toggle based on whether we're in a search-like context
  function updateWsToggleVisibility() {
    const wsBtn = document.getElementById('zenleap-search-ws-toggle');
    if (!wsBtn) return;
    // Show only in tab search (not command mode) or tab-search/split-tab-picker sub-flows
    const isTabSearchSubFlow = commandSubFlow && (commandSubFlow.type === 'tab-search' || commandSubFlow.type === 'split-tab-picker' || commandSubFlow.type === 'dedup-preview');
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

    // Close the tab
    gBrowser.removeTab(tabToClose);
    log(`Closed tab from search: ${tabLabel}`);

    // Remove from results array
    searchResults.splice(searchSelectedIndex, 1);

    // Adjust selection if needed
    if (searchResults.length === 0) {
      // No more results, re-run search to refresh
      renderSearchResults();
    } else {
      // Keep selection in bounds
      if (searchSelectedIndex >= searchResults.length) {
        searchSelectedIndex = searchResults.length - 1;
      }
      // Re-render with updated results
      renderSearchResults();
    }
  }

  // Move search selection
  function moveSearchSelection(direction) {
    const results = commandMode ? commandResults : searchResults;
    if (results.length === 0) return;

    if (direction === 'down') {
      searchSelectedIndex = (searchSelectedIndex + 1) % results.length;
    } else {
      searchSelectedIndex = (searchSelectedIndex - 1 + results.length) % results.length;
    }

    if (commandMode) {
      renderCommandResults();
    } else {
      renderSearchResults();
    }
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
            hidePreviewPanel();
            exitSearchMode();
            gBrowser.selectedTab = selected.tab;
            log(`Dedup preview: switched to tab "${selected.tab.label}" for inspection`);
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
        if (commandSubFlow && (commandSubFlow.type === 'tab-search' || commandSubFlow.type === 'split-tab-picker' || commandSubFlow.type === 'dedup-preview')) {
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

        handleCommandVimNormalMode(key, event);
        return true;
      }

      // ---- COMMAND INSERT MODE ----
      // Backspace when input is empty and no sub-flow: go back
      if (key === 'Backspace' && (searchInput?.value || '') === '' && !commandSubFlow) {
        event.preventDefault();
        event.stopPropagation();
        if (commandEnteredFromSearch) {
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

      handleVimNormalMode(key, event);
      return true;
    }

    // Insert mode - let input handle it, but update state
    // We'll handle this in the input event
    return false;
  }

  // Handle vim normal mode commands
  function handleVimNormalMode(key, event) {
    const text = searchQuery;
    const len = text.length;

    // Quick jump with numbers 1-9
    if (key >= '1' && key <= '9') {
      const idx = parseInt(key) - 1;
      if (idx < searchResults.length) {
        selectSearchResult(idx);
      }
      return;
    }

    // Result navigation with j/k in normal mode
    if (key === 'j') {
      moveSearchSelection('down');
      return;
    }
    if (key === 'k') {
      moveSearchSelection('up');
      return;
    }

    // Cursor movement commands
    switch (key) {
      case 'h': // Left
        searchCursorPos = Math.max(0, searchCursorPos - 1);
        renderSearchDisplay();
        break;

      case 'l': // Right
        searchCursorPos = Math.min(len > 0 ? len - 1 : 0, searchCursorPos + 1);
        renderSearchDisplay();
        break;

      case '0': // Beginning of line
        searchCursorPos = 0;
        renderSearchDisplay();
        break;

      case '$': // End of line
        searchCursorPos = Math.max(0, len - 1);
        renderSearchDisplay();
        break;

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
      case 'i': // Insert at cursor
        searchVimMode = 'insert';
        updateSearchVimIndicator(); // This will focus and set cursor
        break;

      case 'a': // Insert after cursor
        searchCursorPos = Math.min(len, searchCursorPos + 1);
        searchVimMode = 'insert';
        updateSearchVimIndicator(); // This will focus and set cursor
        break;

      case 'I': // Insert at beginning
        searchCursorPos = 0;
        searchVimMode = 'insert';
        updateSearchVimIndicator(); // This will focus and set cursor
        break;

      case 'A': // Insert at end
        searchCursorPos = len;
        searchVimMode = 'insert';
        updateSearchVimIndicator(); // This will focus and set cursor
        break;

      // Editing commands
      case 'x': // Close selected tab
        closeSelectedSearchResult();
        break;

      case 's': // Substitute (delete and insert)
        if (searchCursorPos < len) {
          searchQuery = text.slice(0, searchCursorPos) + text.slice(searchCursorPos + 1);
          searchInput.value = searchQuery;
          renderSearchResults();
        }
        searchVimMode = 'insert';
        updateSearchVimIndicator(); // This will show input and focus
        break;

      case 'D': // Delete to end of line
        searchQuery = text.slice(0, searchCursorPos);
        searchInput.value = searchQuery;
        // Adjust cursor to end
        if (searchCursorPos > 0) searchCursorPos = searchQuery.length > 0 ? searchQuery.length - 1 : 0;
        renderSearchResults();
        renderSearchDisplay();
        break;

      case 'C': // Change to end of line
        searchQuery = text.slice(0, searchCursorPos);
        searchInput.value = searchQuery;
        renderSearchResults();
        searchVimMode = 'insert';
        updateSearchVimIndicator(); // This will show input and focus
        break;

      case 'S': // Substitute entire line (clear all and enter insert mode)
        searchQuery = '';
        searchInput.value = '';
        searchCursorPos = 0;
        renderSearchResults();
        searchVimMode = 'insert';
        updateSearchVimIndicator(); // This will show input and focus
        break;

      case 'd': // Wait for second key (dd for delete line)
        // For simplicity, just clear on 'd' press
        // A more complete implementation would wait for the second key
        // For now, we'll treat 'd' alone as delete character like 'x'
        if (searchCursorPos < len) {
          searchQuery = text.slice(0, searchCursorPos) + text.slice(searchCursorPos + 1);
          searchInput.value = searchQuery;
          if (searchCursorPos >= searchQuery.length && searchQuery.length > 0) {
            searchCursorPos = searchQuery.length - 1;
          }
          renderSearchResults();
          renderSearchDisplay();
        }
        break;
    }
  }

  // Handle vim normal mode commands in command bar
  function handleCommandVimNormalMode(key, event) {
    const text = commandQuery || '';
    const len = text.length;

    // Quick jump with numbers 1-9
    if (key >= '1' && key <= '9') {
      const idx = parseInt(key) - 1;
      if (idx < commandResults.length) {
        searchSelectedIndex = idx;
        handleCommandSelect();
      }
      return;
    }

    // Result navigation with j/k
    if (key === 'j') { moveSearchSelection('down'); return; }
    if (key === 'k') { moveSearchSelection('up'); return; }

    // G to go to last result, g to first
    if (key === 'G') {
      if (commandResults.length > 0) {
        searchSelectedIndex = commandResults.length - 1;
        renderCommandResults();
      }
      return;
    }
    if (key === 'g') {
      searchSelectedIndex = 0;
      renderCommandResults();
      return;
    }

    // Cursor movement commands
    switch (key) {
      case 'h': // Left
        searchCursorPos = Math.max(0, searchCursorPos - 1);
        renderSearchDisplay();
        break;

      case 'l': // Right
        searchCursorPos = Math.min(len > 0 ? len - 1 : 0, searchCursorPos + 1);
        renderSearchDisplay();
        break;

      case '0': // Beginning of line
        searchCursorPos = 0;
        renderSearchDisplay();
        break;

      case '$': // End of line
        searchCursorPos = Math.max(0, len - 1);
        renderSearchDisplay();
        break;

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
      case 'i':
        searchVimMode = 'insert';
        updateSearchVimIndicator();
        break;

      case 'a': // Insert after cursor
        searchCursorPos = Math.min(len, searchCursorPos + 1);
        searchVimMode = 'insert';
        updateSearchVimIndicator();
        break;

      case 'I': // Insert at beginning
        searchCursorPos = 0;
        searchVimMode = 'insert';
        updateSearchVimIndicator();
        break;

      case 'A': // Insert at end
        searchCursorPos = len;
        searchVimMode = 'insert';
        updateSearchVimIndicator();
        break;

      // Editing commands
      case 'x': // Delete character at cursor
        if (searchCursorPos < len) {
          commandQuery = text.slice(0, searchCursorPos) + text.slice(searchCursorPos + 1);
          if (searchInput) searchInput.value = commandQuery;
          if (searchCursorPos >= commandQuery.length && commandQuery.length > 0) {
            searchCursorPos = commandQuery.length - 1;
          }
          renderCommandResults();
          renderSearchDisplay();
        }
        break;

      case 's': // Substitute (delete char and enter insert)
        if (searchCursorPos < len) {
          commandQuery = text.slice(0, searchCursorPos) + text.slice(searchCursorPos + 1);
          if (searchInput) searchInput.value = commandQuery;
          renderCommandResults();
        }
        searchVimMode = 'insert';
        updateSearchVimIndicator();
        break;

      case 'S': // Substitute entire line
        commandQuery = '';
        if (searchInput) searchInput.value = '';
        searchCursorPos = 0;
        searchSelectedIndex = 0;
        renderCommandResults();
        searchVimMode = 'insert';
        updateSearchVimIndicator();
        break;

      case 'D': // Delete to end of line
        commandQuery = text.slice(0, searchCursorPos);
        if (searchInput) searchInput.value = commandQuery;
        if (searchCursorPos > 0) searchCursorPos = commandQuery.length > 0 ? commandQuery.length - 1 : 0;
        renderCommandResults();
        renderSearchDisplay();
        break;

      case 'C': // Change to end of line (delete to end + insert mode)
        commandQuery = text.slice(0, searchCursorPos);
        if (searchInput) searchInput.value = commandQuery;
        renderCommandResults();
        searchVimMode = 'insert';
        updateSearchVimIndicator();
        break;

      case 'd': // Delete character (like x for simplicity)
        if (searchCursorPos < len) {
          commandQuery = text.slice(0, searchCursorPos) + text.slice(searchCursorPos + 1);
          if (searchInput) searchInput.value = commandQuery;
          if (searchCursorPos >= commandQuery.length && commandQuery.length > 0) {
            searchCursorPos = commandQuery.length - 1;
          }
          renderCommandResults();
          renderSearchDisplay();
        }
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

  // Update input cursor position
  function updateInputCursor() {
    if (!searchInput) return;
    searchInput.setSelectionRange(searchCursorPos, searchCursorPos);
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

  // Handle search input changes
  function handleSearchInput(event) {
    const value = searchInput.value;

    if (commandMode) {
      // In command mode, update command query and re-render
      commandQuery = value;
      searchSelectedIndex = 0;
      renderCommandResults();
      return;
    }

    // Detect command prefix to enter command mode
    if (value === S['keys.search.commandPrefix']) {
      searchInput.value = '';
      commandEnteredFromSearch = true;
      enterCommandMode();
      return;
    }

    searchQuery = value;
    searchCursorPos = searchInput.selectionStart;
    searchSelectedIndex = 0; // Reset selection on query change
    renderSearchResults();
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

  // Get tabs for search — respects cross-workspace setting
  function getSearchableTabs() {
    if (S['display.searchAllWorkspaces'] && window.gZenWorkspaces) {
      // Use Zen's allStoredTabs which traverses all workspace DOM containers
      try {
        const allTabs = gZenWorkspaces.allStoredTabs;
        if (allTabs && allTabs.length > 0) {
          return Array.from(allTabs).filter(tab =>
            !tab.hasAttribute('zen-glance-tab') && !tab.hasAttribute('zen-essential') && !tab.hasAttribute('zen-empty-tab')
          );
        }
      } catch (e) {
        log(`allStoredTabs failed, falling back: ${e}`);
      }
    }
    return getVisibleTabs();
  }

  // Get workspace name for a tab (returns null if same as active workspace)
  function getTabWorkspaceName(tab) {
    try {
      if (!window.gZenWorkspaces) return null;
      const tabWsId = tab.getAttribute('zen-workspace-id');
      const activeWsId = gZenWorkspaces.activeWorkspace;
      if (!tabWsId || tabWsId === activeWsId) return null;
      const workspaces = gZenWorkspaces.getWorkspaces();
      if (!workspaces) return null;
      const ws = workspaces.find(w => w.uuid === tabWsId);
      return ws ? ws.name : null;
    } catch (e) {
      return null;
    }
  }

  // Update relative numbers on all tabs
  function updateRelativeNumbers() {
    const tabs = getVisibleTabs();
    const currentTab = gBrowser.selectedTab;
    const currentIndex = tabs.indexOf(currentTab);

    if (currentIndex === -1) {
      log('Current tab not found in visible tabs');
      return;
    }

    // Clean up marks for closed tabs
    cleanupMarks();

    tabs.forEach((tab, index) => {
      const relativeDistance = Math.abs(index - currentIndex);
      const direction = index < currentIndex ? 'up' : (index > currentIndex ? 'down' : 'current');
      const displayChar = numberToDisplay(relativeDistance);

      // Check if this tab has a mark
      const mark = getMarkForTab(tab);

      tab.setAttribute('data-zenleap-direction', direction);
      tab.setAttribute('data-zenleap-distance', relativeDistance);

      const tabContent = tab.querySelector('.tab-content');
      if (tabContent) {
        if (mark) {
          // Show mark instead of relative number
          tabContent.setAttribute('data-zenleap-rel', mark);
          tabContent.setAttribute('data-zenleap-mark', mark);
          tab.setAttribute('data-zenleap-has-mark', 'true');
        } else {
          // Show relative number
          tabContent.setAttribute('data-zenleap-rel', displayChar);
          tabContent.removeAttribute('data-zenleap-mark');
          tab.removeAttribute('data-zenleap-has-mark');
        }
      }
    });

    log(`Updated ${tabs.length} tabs, current at index ${currentIndex}`);
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

    content.appendChild(overlayModeLabel);
    content.appendChild(overlayDirectionLabel);
    content.appendChild(overlayHintLabel);
    leapOverlay.appendChild(content);

    const style = document.createElement('style');
    style.id = 'zenleap-overlay-styles';
    style.textContent = `
      #zenleap-overlay {
        position: fixed;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%);
        z-index: 10000;
        background: rgba(30, 30, 30, 0.95);
        border: 2px solid #61afef;
        border-radius: 8px;
        padding: 12px 24px;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
        pointer-events: none;
        display: none;
      }
      #zenleap-overlay-content {
        display: flex;
        align-items: center;
        gap: 12px;
      }
      #zenleap-mode-label {
        font-size: 14px;
        font-weight: bold;
        color: #61afef;
        font-family: monospace;
      }
      #zenleap-direction-label {
        font-size: 14px;
        font-weight: bold;
        color: #98c379;
        font-family: monospace;
      }
      #zenleap-hint-label {
        font-size: 12px;
        color: #abb2bf;
        font-family: monospace;
      }
      #zenleap-overlay.leap-direction-set #zenleap-hint-label {
        color: #e5c07b;
      }
    `;
    document.head.appendChild(style);
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

    const style = document.createElement('style');
    style.id = 'zenleap-preview-styles';
    style.textContent = `
      #zenleap-preview-panel {
        position: fixed;
        z-index: 100003;
        width: 320px;
        background: rgba(30, 30, 30, 0.95);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 10px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
        backdrop-filter: blur(8px);
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
        background: #1a1a1a;
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
        color: #666;
        font-family: monospace;
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
        color: #e0e0e0;
        font-family: -apple-system, BlinkMacSystemFont, sans-serif;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      #zenleap-preview-url {
        font-size: 11px;
        color: #888;
        font-family: monospace;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
    `;
    document.head.appendChild(style);
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

  // Get scroll position from a tab's content process
  function getTabScrollPosition(browser) {
    // Method 1: direct contentWindow access
    try {
      const win = browser.contentWindow;
      if (win && typeof win.scrollY === 'number') {
        return Promise.resolve({ x: win.scrollX || 0, y: win.scrollY || 0 });
      }
    } catch (e) {}
    // Method 2: unwrapped access (bypass Xray wrappers)
    try {
      const win = browser.contentWindow?.wrappedJSObject;
      if (win && typeof win.scrollY === 'number') {
        return Promise.resolve({ x: win.scrollX || 0, y: win.scrollY || 0 });
      }
    } catch (e) {}
    // Method 3: frame script injection (Fission-compatible, queries content process directly)
    try {
      return new Promise((resolve) => {
        const mm = browser.messageManager;
        if (!mm) { resolve({ x: 0, y: 0 }); return; }
        const msgId = 'ZenLeap:ScrollPos:' + Date.now() + Math.random();
        const timer = setTimeout(() => {
          try { mm.removeMessageListener(msgId, handler); } catch (e) {}
          resolve({ x: 0, y: 0 });
        }, 300);
        function handler(msg) {
          clearTimeout(timer);
          try { mm.removeMessageListener(msgId, handler); } catch (e) {}
          resolve(msg.data || { x: 0, y: 0 });
        }
        mm.addMessageListener(msgId, handler);
        mm.loadFrameScript(`data:,sendAsyncMessage('${msgId}', {x: content.scrollX || 0, y: content.scrollY || 0})`, false);
      });
    } catch (e) {}
    return Promise.resolve({ x: 0, y: 0 });
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

      const w = browser.clientWidth || 1280;
      const h = browser.clientHeight || 720;
      // Get the tab's scroll position to capture what the user was actually looking at
      const scroll = await getTabScrollPosition(browser);
      const rect = new DOMRect(scroll.x, scroll.y, w, h);
      const scale = 320 / w;
      const imageBitmap = await browser.browsingContext.currentWindowGlobal
        .drawSnapshot(rect, scale, 'white');

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

    const sidebar = document.getElementById('navigator-toolbox');
    let leftPos;

    if (sidebar) {
      const sidebarRect = sidebar.getBoundingClientRect();
      leftPos = sidebarRect.right + 12;
    } else {
      const tabRect = tab.getBoundingClientRect();
      leftPos = tabRect.right + 12;
    }

    // Vertically center near the highlighted tab
    const tabRect = tab.getBoundingClientRect();
    const panelHeight = 250;
    let topPos = tabRect.top + (tabRect.height / 2) - (panelHeight / 2);

    // Clamp to viewport
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;
    topPos = Math.max(8, Math.min(topPos, viewportHeight - panelHeight - 8));
    leftPos = Math.min(leftPos, viewportWidth - 340);

    previewPanel.style.left = `${leftPos}px`;
    previewPanel.style.top = `${topPos}px`;
  }

  function positionPreviewPanelForModal() {
    if (!previewPanel) return;

    const container = document.getElementById('zenleap-search-container');
    if (!container) return;

    const containerRect = container.getBoundingClientRect();
    const selectedEl = searchResultsList?.querySelector('.zenleap-command-result.selected');

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

  function hidePreviewPanel() {
    if (previewPanel) {
      previewPanel.style.display = 'none';
    }
    clearTimeout(previewDebounceTimer);
    previewCaptureId++;
    previewCurrentTab = null;
    previewCache.clear();
  }

  function cleanPreviewCache() {
    const now = Date.now();
    for (const [tab, entry] of previewCache) {
      if ((now - entry.timestamp) > PREVIEW_CACHE_TTL || tab.closing || !tab.parentNode) {
        previewCache.delete(tab);
      }
    }
  }

  // Check if we're in compact mode (sidebar CAN be hidden)
  function isCompactModeEnabled() {
    // Check for compact mode attribute on root
    if (document.documentElement.hasAttribute('zen-compact-mode') ||
        document.documentElement.hasAttribute('compact-mode')) {
      return true;
    }

    // Check the preference directly
    try {
      return Services.prefs.getBoolPref('zen.view.compact', false);
    } catch (e) {
      return false;
    }
  }

  // Check if sidebar is currently ACTUALLY visible on screen
  // In compact mode, the sidebar always has a small sliver visible (for hover trigger)
  // - Hidden: left=-223, right=5 (only ~5px visible)
  // - Visible: left=-4, right=224 (most of width visible)
  // So we check if MORE THAN HALF of the sidebar is on-screen
  function isSidebarVisible() {
    const sidebar = document.getElementById('navigator-toolbox');
    if (!sidebar) {
      log('Sidebar visible check: #navigator-toolbox not found');
      return false;
    }

    const rect = sidebar.getBoundingClientRect();
    const style = window.getComputedStyle(sidebar);

    // Check basic CSS visibility
    if (style.display === 'none' || style.visibility === 'hidden' || parseFloat(style.opacity) < 0.1) {
      log('Sidebar visible check: hidden via CSS');
      return false;
    }

    // The key check: how much of the sidebar is actually visible?
    // rect.right tells us how many pixels from the left edge of viewport to the right edge of sidebar
    // If rect.right > half the sidebar width, most of it is visible
    const visibleWidth = Math.max(0, rect.right);
    const visiblePercent = (visibleWidth / rect.width) * 100;
    const isVisible = visiblePercent > 50;

    log(`Sidebar visible check: right=${rect.right}, width=${rect.width}, visiblePercent=${visiblePercent.toFixed(0)}%, isVisible=${isVisible}`);
    return isVisible;
  }

  // Show the floating sidebar (for compact mode)
  // Returns true if we actually toggled it (so we know to toggle it back)
  function showFloatingSidebar() {
    // First check if sidebar is already visible - don't toggle if it is!
    if (isSidebarVisible()) {
      log('Sidebar already visible, not toggling');
      return false;  // Return false = we didn't change anything
    }

    // Try multiple methods to show the sidebar

    // Method 1: Execute Zen's command to show sidebar in compact mode
    const showSidebarCmd = document.getElementById('cmd_zenCompactModeShowSidebar');
    if (showSidebarCmd) {
      try {
        showSidebarCmd.doCommand();
        log('Showed sidebar via cmd_zenCompactModeShowSidebar');
        return true;
      } catch (e) {
        log(`cmd_zenCompactModeShowSidebar failed: ${e}`);
      }
    }

    // Method 2: Try the toggle sidebar command
    const toggleSidebarCmd = document.getElementById('cmd_zenToggleSidebar');
    if (toggleSidebarCmd) {
      try {
        toggleSidebarCmd.doCommand();
        log('Showed sidebar via cmd_zenToggleSidebar');
        return true;
      } catch (e) {
        log(`cmd_zenToggleSidebar failed: ${e}`);
      }
    }

    // Method 3: Dispatch a synthetic mouse event to trigger hover behavior
    const sidebarTrigger = document.querySelector('#zen-sidebar-box-container') ||
                           document.getElementById('TabsToolbar');
    if (sidebarTrigger) {
      const mouseEnterEvent = new MouseEvent('mouseenter', {
        bubbles: true,
        cancelable: true,
        view: window
      });
      sidebarTrigger.dispatchEvent(mouseEnterEvent);
      log('Dispatched mouseenter event to sidebar');
      return true;
    }

    log('Could not show floating sidebar - no method worked');
    return false;
  }

  // Hide the floating sidebar (restore compact mode state)
  function hideFloatingSidebar() {
    // First check if sidebar is actually visible - don't toggle if already hidden!
    if (!isSidebarVisible()) {
      log('Sidebar already hidden, not toggling');
      return false;
    }

    // Method 1: Try the hide sidebar command
    const hideSidebarCmd = document.getElementById('cmd_zenCompactModeShowSidebar');
    if (hideSidebarCmd) {
      try {
        // This command toggles, so call it again to hide
        hideSidebarCmd.doCommand();
        log('Hid sidebar via cmd_zenCompactModeShowSidebar');
        return true;
      } catch (e) {
        log(`cmd_zenCompactModeShowSidebar (hide) failed: ${e}`);
      }
    }

    // Method 2: Try the toggle sidebar command
    const toggleSidebarCmd = document.getElementById('cmd_zenToggleSidebar');
    if (toggleSidebarCmd) {
      try {
        toggleSidebarCmd.doCommand();
        log('Hid sidebar via cmd_zenToggleSidebar');
        return true;
      } catch (e) {
        log(`cmd_zenToggleSidebar (hide) failed: ${e}`);
      }
    }

    // Method 3: Dispatch mouseleave to trigger hover-off behavior
    const sidebarTrigger = document.querySelector('#zen-sidebar-box-container') ||
                           document.getElementById('TabsToolbar');
    if (sidebarTrigger) {
      const mouseLeaveEvent = new MouseEvent('mouseleave', {
        bubbles: true,
        cancelable: true,
        view: window
      });
      sidebarTrigger.dispatchEvent(mouseLeaveEvent);
      log('Dispatched mouseleave event to sidebar');
      return true;
    }

    log('Could not hide floating sidebar');
    return false;
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
      const tabs = getVisibleTabs();
      const pos = `${highlightedTabIndex + 1}/${tabs.length}`;
      let statusParts = [pos];
      if (selectedTabs.size > 0) statusParts.push(`${selectedTabs.size} sel`);
      if (yankBuffer.length > 0) statusParts.push(`${yankBuffer.length} yanked`);
      overlayDirectionLabel.textContent = statusParts.join(' | ');

      // Show contextual hints
      if (yankBuffer.length > 0) {
        overlayHintLabel.textContent = 'p=paste after  P=paste before  j/k=move  Esc=cancel';
      } else if (selectedTabs.size > 0) {
        overlayHintLabel.textContent = 'y=yank  x=close sel  Space=toggle  j/k=move  Esc=cancel';
      } else {
        overlayHintLabel.textContent = 'j/k=move  Space=select  Enter=open  x=close  Esc=cancel';
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
  // (e.g., Space toggling YouTube playback, j/k editing Google Sheets)
  function stealFocusFromContent() {
    if (contentFocusStolen) return;
    try {
      gBrowser.selectedBrowser.blur();
      contentFocusStolen = true;
      log('Stole focus from content');
    } catch (e) {
      log(`Failed to steal focus from content: ${e}`);
    }
  }

  // Restore focus to the content area after leaving leap mode
  function restoreFocusToContent() {
    if (!contentFocusStolen) return;
    try {
      gBrowser.selectedBrowser.focus();
      log('Restored focus to content');
    } catch (e) {
      log(`Failed to restore focus to content: ${e}`);
    }
    contentFocusStolen = false;
  }

  // Enter leap mode
  function enterLeapMode() {
    if (leapMode) return;

    leapMode = true;
    browseMode = false;
    zMode = false;
    highlightedTabIndex = -1;
    originalTabIndex = -1;
    browseDirection = null;
    sidebarWasExpanded = false;

    // Steal focus from content to prevent input leaking to web pages
    stealFocusFromContent();

    // Show sidebar if in compact mode and sidebar is not already visible
    if (isCompactModeEnabled()) {
      // showFloatingSidebar checks visibility internally and returns false if already visible
      sidebarWasExpanded = showFloatingSidebar();
      log(`Compact mode active, expanded sidebar: ${sidebarWasExpanded}`);
    }

    document.documentElement.setAttribute('data-zenleap-active', 'true');
    showLeapOverlay();

    // Set timeout (will be cleared if entering browse mode)
    clearTimeout(leapModeTimeout);
    leapModeTimeout = setTimeout(() => {
      if (leapMode && !browseMode) {
        log('Leap mode timed out');
        exitLeapMode();
      }
    }, CONFIG.leapModeTimeout);

    log('Entered leap mode');
  }

  // Enter browse mode
  function enterBrowseMode(direction) {
    const tabs = getVisibleTabs();
    const currentTab = gBrowser.selectedTab;
    const currentIndex = tabs.indexOf(currentTab);

    if (currentIndex === -1) {
      log('Cannot enter browse mode: current tab not found');
      return;
    }

    browseMode = true;
    browseDirection = direction;
    originalTabIndex = currentIndex;
    originalTab = tabs[currentIndex];

    // Move highlight one step in the initial direction
    if (direction === 'down') {
      highlightedTabIndex = Math.min(currentIndex + 1, tabs.length - 1);
    } else {
      highlightedTabIndex = Math.max(currentIndex - 1, 0);
    }

    // Clear the timeout - browse mode has no timeout
    clearTimeout(leapModeTimeout);

    updateHighlight();
    updateLeapOverlayState();
    log(`Entered browse mode, direction=${direction}, highlight=${highlightedTabIndex}`);
  }

  // Update the visual highlight on the browsed tab
  function updateHighlight() {
    const tabs = getVisibleTabs();

    // Remove highlight from all tabs, update selection markers
    tabs.forEach(tab => {
      tab.removeAttribute('data-zenleap-highlight');
      if (selectedTabs.has(tab)) {
        tab.setAttribute('data-zenleap-selected', 'true');
      } else {
        tab.removeAttribute('data-zenleap-selected');
      }
    });

    // Add highlight to the current browsed tab
    if (highlightedTabIndex >= 0 && highlightedTabIndex < tabs.length) {
      const highlightedTab = tabs[highlightedTabIndex];
      highlightedTab.setAttribute('data-zenleap-highlight', 'true');

      // Scroll the highlighted tab into view
      scrollTabToView(highlightedTab, 'center');

      // Trigger preview panel update (debounced by configurable delay)
      if (S['display.browsePreview'] && browseMode) {
        clearTimeout(previewDebounceTimer);
        previewCaptureId++; // Cancel any in-flight capture
        hidePreviewPanel();
        previewDebounceTimer = setTimeout(() => {
          if (highlightedTabIndex >= 0 && highlightedTabIndex < getVisibleTabs().length) {
            showPreviewForTab(getVisibleTabs()[highlightedTabIndex]);
          }
        }, S['timing.previewDelay']);
      }
    }
  }

  // Clear all highlights and selections
  function clearHighlight() {
    const tabs = getVisibleTabs();
    tabs.forEach(tab => {
      tab.removeAttribute('data-zenleap-highlight');
      tab.removeAttribute('data-zenleap-selected');
    });
  }

  // Move highlight up or down
  function moveHighlight(direction) {
    const tabs = getVisibleTabs();

    if (direction === 'down') {
      highlightedTabIndex = Math.min(highlightedTabIndex + 1, tabs.length - 1);
    } else {
      highlightedTabIndex = Math.max(highlightedTabIndex - 1, 0);
    }

    updateHighlight();
    updateLeapOverlayState();
    log(`Moved highlight ${direction} to ${highlightedTabIndex}`);
  }

  // Switch workspace in browse mode (h = prev, l = next)
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

      // Switch workspace — this changes which tabs are visible
      await window.gZenWorkspaces.changeWorkspaceWithID(newWorkspace.uuid);

      // After workspace switch, highlight the active tab in the new workspace
      setTimeout(() => {
        const newTabs = getVisibleTabs();
        const activeIdx = newTabs.indexOf(gBrowser.selectedTab);
        highlightedTabIndex = activeIdx >= 0 ? activeIdx : 0;
        if (newTabs.length > 0) {
          updateHighlight();
          updateRelativeNumbers();
          updateLeapOverlayState();
        }
        log(`Browse: workspace switched, ${newTabs.length} tabs visible, highlight=${highlightedTabIndex}`);
      }, S['timing.workspaceSwitchDelay']);
    } catch (e) { log(`Workspace switch failed: ${e}`); }
  }

  // Jump directly to a tab N positions from original and open it
  // Direction is determined by where the highlight currently is relative to original
  function jumpAndOpenTab(distance) {
    const tabs = getVisibleTabs();

    // Determine direction based on current highlight position vs original
    let direction;
    if (highlightedTabIndex < originalTabIndex) {
      direction = 'up';
    } else if (highlightedTabIndex > originalTabIndex) {
      direction = 'down';
    } else {
      // Highlight is on original tab, use initial browse direction as fallback
      direction = browseDirection;
    }

    let targetIndex;
    if (direction === 'down') {
      targetIndex = originalTabIndex + distance;
    } else {
      targetIndex = originalTabIndex - distance;
    }

    // Clamp to valid range
    targetIndex = Math.max(0, Math.min(tabs.length - 1, targetIndex));

    if (targetIndex >= 0 && targetIndex < tabs.length) {
      gBrowser.selectedTab = tabs[targetIndex];
      log(`Jumped ${direction} ${distance} from original (highlight was ${highlightedTabIndex < originalTabIndex ? 'above' : 'below'}), opened tab ${targetIndex}`);
    }

    exitLeapMode(true); // Center scroll on new tab
  }

  // Confirm selection - open the highlighted tab
  function confirmBrowseSelection() {
    const tabs = getVisibleTabs();

    if (highlightedTabIndex >= 0 && highlightedTabIndex < tabs.length) {
      gBrowser.selectedTab = tabs[highlightedTabIndex];
      log(`Confirmed selection: opened tab ${highlightedTabIndex}`);
    }

    exitLeapMode(true); // true = center scroll on new tab
  }

  // Close the highlighted tab (or all selected tabs if any are selected)
  function closeHighlightedTab() {
    const tabs = getVisibleTabs();

    // If there are selected tabs, close all of them
    if (selectedTabs.size > 0) {
      const tabsToClose = [...selectedTabs].filter(t => t && !t.closing && t.parentNode);
      log(`Closing ${tabsToClose.length} selected tabs`);
      for (const tab of tabsToClose) {
        gBrowser.removeTab(tab);
      }
      selectedTabs.clear();

      const newTabs = getVisibleTabs();
      if (newTabs.length === 0) {
        exitLeapMode(false);
        return;
      }
      // Clamp highlight index
      if (highlightedTabIndex >= newTabs.length) {
        highlightedTabIndex = newTabs.length - 1;
      }
      updateHighlight();
      updateLeapOverlayState();
      return;
    }

    // Single tab close (no selection)
    if (highlightedTabIndex < 0 || highlightedTabIndex >= tabs.length) {
      log('No valid tab to close');
      return;
    }

    const tabToClose = tabs[highlightedTabIndex];
    const wasLastTab = highlightedTabIndex === tabs.length - 1;

    gBrowser.removeTab(tabToClose);
    log(`Closed tab at index ${highlightedTabIndex}`);

    const newTabs = getVisibleTabs();

    if (newTabs.length === 0) {
      exitLeapMode(false);
      return;
    }

    if (wasLastTab || highlightedTabIndex >= newTabs.length) {
      highlightedTabIndex = newTabs.length - 1;
    }

    updateHighlight();
    updateLeapOverlayState();
  }

  // Toggle selection on the highlighted tab
  function toggleTabSelection() {
    const tabs = getVisibleTabs();
    if (highlightedTabIndex < 0 || highlightedTabIndex >= tabs.length) return;

    const tab = tabs[highlightedTabIndex];
    if (selectedTabs.has(tab)) {
      selectedTabs.delete(tab);
      log(`Deselected tab at index ${highlightedTabIndex}`);
    } else {
      selectedTabs.add(tab);
      log(`Selected tab at index ${highlightedTabIndex} (${selectedTabs.size} total)`);
    }

    updateHighlight();
    updateLeapOverlayState();
  }

  // Yank selected tabs into buffer
  function yankSelectedTabs() {
    if (selectedTabs.size === 0) {
      log('No tabs selected to yank');
      return;
    }

    // Store references in order of their current position
    const tabs = getVisibleTabs();
    yankBuffer = tabs.filter(t => selectedTabs.has(t));
    const count = yankBuffer.length;

    // Clear selection visuals
    selectedTabs.clear();

    updateHighlight();
    updateLeapOverlayState();
    log(`Yanked ${count} tabs`);
  }

  // Paste yanked tabs after or before the highlighted tab
  // Handles cross-pinned/unpinned, cross-folder, and cross-workspace moves
  function pasteTabs(position) {
    if (yankBuffer.length === 0) {
      log('No tabs in yank buffer');
      return;
    }

    const tabs = getVisibleTabs();
    if (highlightedTabIndex < 0 || highlightedTabIndex >= tabs.length) return;

    const anchorTab = tabs[highlightedTabIndex];

    // Filter out any yanked tabs that have been closed since yanking
    yankBuffer = yankBuffer.filter(t => t && !t.closing && t.parentNode);
    if (yankBuffer.length === 0) {
      log('All yanked tabs have been closed');
      return;
    }

    log(`Paste: position=${position}, anchor="${anchorTab.label}", yankCount=${yankBuffer.length}`);

    // Determine anchor context for cross-boundary moves
    const anchorPinned = anchorTab.pinned;
    const anchorFolder = anchorTab.group?.isZenFolder ? anchorTab.group : null;
    const anchorWorkspaceId = anchorTab.getAttribute('zen-workspace-id') || window.gZenWorkspaces?.activeWorkspace;

    // Prepare each yanked tab: match workspace, pinned state, folder membership
    for (const tab of yankBuffer) {
      // 1. Cross-workspace: move tab to anchor's workspace if different
      if (window.gZenWorkspaces) {
        const tabWsId = tab.getAttribute('zen-workspace-id') || window.gZenWorkspaces.activeWorkspace;
        if (tabWsId !== anchorWorkspaceId) {
          window.gZenWorkspaces.moveTabToWorkspace(tab, anchorWorkspaceId);
          log(`  Moved "${tab.label}" to workspace ${anchorWorkspaceId}`);
        }
      }

      // 2. Cross-folder: remove from old folder if needed
      const tabFolder = tab.group?.isZenFolder ? tab.group : null;
      if (tabFolder && tabFolder !== anchorFolder) {
        try { gBrowser.ungroupTab(tab); } catch(e) { log(`  Ungroup failed: ${e}`); }
      }

      // 3. Cross-pinned: match pinned state to anchor's area
      //    Don't unpin if we'll be adding to a folder (folders require pinned tabs)
      if (anchorPinned && !tab.pinned) {
        gBrowser.pinTab(tab);
        log(`  Pinned "${tab.label}" to match anchor`);
      } else if (!anchorPinned && !anchorFolder && tab.pinned) {
        gBrowser.unpinTab(tab);
        log(`  Unpinned "${tab.label}" to match anchor`);
      }
    }

    // Now position the tabs using moveTabBefore/moveTabAfter
    if (position === 'after') {
      let afterTarget = anchorTab;
      for (const tab of yankBuffer) {
        gBrowser.moveTabAfter(tab, afterTarget);
        afterTarget = tab;
      }
    } else {
      // Use chaining: first before anchor, rest after previous
      gBrowser.moveTabBefore(yankBuffer[0], anchorTab);
      for (let i = 1; i < yankBuffer.length; i++) {
        gBrowser.moveTabAfter(yankBuffer[i], yankBuffer[i - 1]);
      }
    }

    // 4. Add to anchor's folder if it has one
    if (anchorFolder) {
      const tabsToAdd = yankBuffer.filter(t => t.group !== anchorFolder);
      if (tabsToAdd.length > 0) {
        for (const t of tabsToAdd) { if (!t.pinned) gBrowser.pinTab(t); }
        anchorFolder.addTabs(tabsToAdd);
        log(`  Added ${tabsToAdd.length} tabs to folder "${anchorFolder.label}"`);
      }
    }

    log(`Pasted ${yankBuffer.length} tabs ${position} anchor "${anchorTab.label}"`);

    // Clear yank buffer
    yankBuffer = [];

    // Refresh visible tabs and update display
    updateRelativeNumbers();
    updateHighlight();
    updateLeapOverlayState();
  }

  // Cancel browse mode - return to original tab
  function cancelBrowseMode() {
    // Use the direct tab reference to return to the original tab,
    // since tab indices may have shifted after yank/paste operations
    if (originalTab && !originalTab.closing && originalTab.parentNode) {
      gBrowser.selectedTab = originalTab;
      log(`Cancelled, returned to original tab "${originalTab.label}"`);
    } else {
      // Fallback to index if the tab reference is gone
      const tabs = getVisibleTabs();
      if (originalTabIndex >= 0 && originalTabIndex < tabs.length) {
        gBrowser.selectedTab = tabs[originalTabIndex];
        log(`Cancelled, returned to original tab by index ${originalTabIndex}`);
      }
    }

    exitLeapMode(true); // Center scroll on original tab
  }

  // Exit leap mode
  function exitLeapMode(centerScroll = false) {
    clearHighlight();
    hidePreviewPanel();

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
    highlightedTabIndex = -1;
    originalTabIndex = -1;
    originalTab = null;
    browseDirection = null;
    browseGPending = false;
    clearTimeout(browseGTimeout);
    browseGTimeout = null;
    selectedTabs.clear();
    yankBuffer = [];

    clearTimeout(leapModeTimeout);
    document.documentElement.removeAttribute('data-zenleap-active');
    document.documentElement.removeAttribute('data-zenleap-mark-mode');
    hideLeapOverlay();

    if (centerScroll) {
      // Small delay to let tab selection settle
      setTimeout(() => scrollTabIntoView('center'), 50);
    }

    // Restore focus to content area so keyboard input resumes going to the web page
    restoreFocusToContent();

    log('Exited leap mode');
  }

  // Go to absolute tab position (1-indexed)
  function goToAbsoluteTab(tabNumber) {
    const tabs = getVisibleTabs();
    if (tabs.length === 0) return;

    // tabNumber is 1-indexed, convert to 0-indexed
    const targetIndex = Math.max(0, Math.min(tabs.length - 1, tabNumber - 1));
    gBrowser.selectedTab = tabs[targetIndex];
    log(`Jumped to absolute tab ${tabNumber} (index ${targetIndex})`);
    exitLeapMode(true);
  }

  // Navigate to tab by relative distance (direct jump, no browse mode)
  function navigateToTab(direction, distance) {
    const tabs = getVisibleTabs();
    const currentTab = gBrowser.selectedTab;
    const currentIndex = tabs.indexOf(currentTab);

    if (currentIndex === -1) {
      log('Cannot navigate: current tab not in visible tabs');
      return false;
    }

    let targetIndex;
    if (direction === 'up') {
      targetIndex = currentIndex - distance;
    } else {
      targetIndex = currentIndex + distance;
    }

    targetIndex = Math.max(0, Math.min(tabs.length - 1, targetIndex));

    if (targetIndex !== currentIndex) {
      gBrowser.selectedTab = tabs[targetIndex];
      log(`Navigated ${direction} ${distance} tabs to index ${targetIndex}`);
      return true;
    }

    log(`Already at boundary, cannot navigate ${direction}`);
    return false;
  }

  // Find scrollable tab container
  function findScrollableTabContainer() {
    const currentTab = gBrowser.selectedTab;
    if (!currentTab) return null;

    let element = currentTab.parentElement;
    let depth = 0;
    const maxDepth = 15;

    while (element && depth < maxDepth) {
      if (element.scrollbox && element.scrollbox.scrollHeight > element.scrollbox.clientHeight) {
        return element.scrollbox;
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

    const selectors = ['#tabbrowser-arrowscrollbox', 'arrowscrollbox', '#tabbrowser-tabs'];
    for (const selector of selectors) {
      const el = document.querySelector(selector);
      if (el?.scrollbox?.scrollHeight > el?.scrollbox?.clientHeight) {
        return el.scrollbox;
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

    const scrollContainer = findScrollableTabContainer();
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
    const currentTab = gBrowser.selectedTab;
    if (currentTab) {
      scrollTabToView(currentTab, position);
      log(`Scrolled ${position}`);
    }
  }

  // Handle keydown events
  function handleKeyDown(event) {
    // Ignore modifier keys pressed alone
    if (MODIFIER_KEYS.includes(event.key)) {
      return;
    }

    // Handle settings mode - Escape to close, all other keys handled by modal
    if (settingsMode) {
      if (event.key === 'Escape' && !settingsRecordingId) {
        event.preventDefault();
        event.stopPropagation();
        exitSettingsMode();
      }
      return;
    }

    // Handle help mode - Escape or help key to close
    if (helpMode) {
      if (event.key === 'Escape' || event.key === S['keys.leap.help']) {
        event.preventDefault();
        event.stopPropagation();
        exitHelpMode();
        return;
      }
      // Any other key also closes help mode
      event.preventDefault();
      event.stopPropagation();
      exitHelpMode();
      return;
    }

    // Handle search mode input first
    if (searchMode) {
      if (handleSearchKeyDown(event)) {
        return;
      }
      // Let unhandled keys (insert mode typing) pass through to input
      return;
    }

    // Check for command mode trigger
    if (matchCombo(event, S['keys.global.commandPalette'])) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      enterSearchMode(true);
      return;
    }

    // Check for search trigger
    if (matchCombo(event, S['keys.global.search'])) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      enterSearchMode();
      return;
    }

    // Check for leap mode trigger
    if (matchCombo(event, S['keys.global.leapMode'])) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

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
    if (matchCombo(event, S['keys.global.quickMark'])) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      if (!leapMode) {
        // Set mark mode state AND attribute BEFORE entering leap mode
        // This ensures CSS sees mark-mode before leap-active is set
        gotoMarkMode = true;
        document.documentElement.setAttribute('data-zenleap-mark-mode', 'true');
        enterLeapMode();
        clearTimeout(leapModeTimeout);
        log('Quick goto mark mode via Ctrl+\'');
      }
      return;
    }

    // Check for split view focus switching (global combos, only when split is active)
    if (window.gZenViewSplitter?.splitViewActive) {
      if (matchCombo(event, S['keys.global.splitFocusLeft'])) {
        event.preventDefault();
        event.stopPropagation();
        splitFocusInDirection('left');
        return;
      }
      if (matchCombo(event, S['keys.global.splitFocusDown'])) {
        event.preventDefault();
        event.stopPropagation();
        splitFocusInDirection('down');
        return;
      }
      if (matchCombo(event, S['keys.global.splitFocusUp'])) {
        event.preventDefault();
        event.stopPropagation();
        splitFocusInDirection('up');
        return;
      }
      if (matchCombo(event, S['keys.global.splitFocusRight'])) {
        event.preventDefault();
        event.stopPropagation();
        splitFocusInDirection('right');
        return;
      }
    }

    // Handle keys when in leap mode
    if (!leapMode) return;

    const key = event.key.toLowerCase();
    const originalKey = event.key; // Preserve case for special chars

    // Escape to cancel
    if (key === 'escape') {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      if (browseMode) {
        cancelBrowseMode();
      } else {
        exitLeapMode(false);
      }
      return;
    }

    // === BROWSE MODE HANDLING ===
    if (browseMode) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      if (key === S['keys.browse.down'] || key === S['keys.browse.downAlt']) {
        if (event.shiftKey) {
          const tabs = getVisibleTabs();
          if (highlightedTabIndex >= 0 && highlightedTabIndex < tabs.length) selectedTabs.add(tabs[highlightedTabIndex]);
          moveHighlight('down');
          if (highlightedTabIndex >= 0 && highlightedTabIndex < tabs.length) selectedTabs.add(tabs[highlightedTabIndex]);
          updateHighlight();
          updateLeapOverlayState();
        } else {
          moveHighlight('down');
        }
        return;
      }
      if (key === S['keys.browse.up'] || key === S['keys.browse.upAlt']) {
        if (event.shiftKey) {
          const tabs = getVisibleTabs();
          if (highlightedTabIndex >= 0 && highlightedTabIndex < tabs.length) selectedTabs.add(tabs[highlightedTabIndex]);
          moveHighlight('up');
          if (highlightedTabIndex >= 0 && highlightedTabIndex < tabs.length) selectedTabs.add(tabs[highlightedTabIndex]);
          updateHighlight();
          updateLeapOverlayState();
        } else {
          moveHighlight('up');
        }
        return;
      }
      if (key === S['keys.browse.confirm']) {
        confirmBrowseSelection();
        return;
      }
      if (key === S['keys.browse.close']) {
        closeHighlightedTab();
        return;
      }
      if (key === S['keys.browse.select']) {
        toggleTabSelection();
        return;
      }
      if (key === S['keys.browse.yank']) {
        yankSelectedTabs();
        return;
      }
      if (originalKey === S['keys.browse.pasteBefore']) {
        pasteTabs('before');
        return;
      }
      if (key === S['keys.browse.pasteAfter']) {
        pasteTabs('after');
        return;
      }
      if (key === S['keys.browse.prevWorkspace'] || key === S['keys.browse.prevWorkspaceAlt'] ||
          key === S['keys.browse.nextWorkspace'] || key === S['keys.browse.nextWorkspaceAlt']) {
        const isPrev = key === S['keys.browse.prevWorkspace'] || key === S['keys.browse.prevWorkspaceAlt'];
        browseWorkspaceSwitch(isPrev ? 'prev' : 'next');
        return;
      }

      // G = move highlight to last tab
      if (originalKey === S['keys.browse.lastTab']) {
        const tabs = getVisibleTabs();
        highlightedTabIndex = tabs.length - 1;
        updateHighlight();
        updateLeapOverlayState();
        log(`Browse: jumped to last tab (index ${highlightedTabIndex})`);
        return;
      }

      // g = pending gg (move highlight to first tab)
      if (key === S['keys.browse.gMode'] && originalKey === S['keys.browse.gMode']) {
        if (browseGPending) {
          // Second g pressed - move to first tab (or first unpinned if setting enabled)
          clearTimeout(browseGTimeout);
          browseGPending = false;
          browseGTimeout = null;
          if (S['display.ggSkipPinned']) {
            const tabs = getVisibleTabs();
            const firstUnpinned = tabs.findIndex(t => !t.pinned && !t.hasAttribute('zen-essential'));
            highlightedTabIndex = firstUnpinned >= 0 ? firstUnpinned : 0;
          } else {
            highlightedTabIndex = 0;
          }
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
          // Timeout expired without second g - perform the normal jump for 'g' (distance 16)
          const gDistance = displayToNumber('g');
          if (gDistance !== null && gDistance >= 1) {
            log(`Browse: g timed out, jumping distance ${gDistance}`);
            jumpAndOpenTab(gDistance);
          }
        }, S['timing.browseGTimeout']);
        return;
      }

      // If g was pending but another key was pressed, cancel it
      if (browseGPending) {
        clearTimeout(browseGTimeout);
        browseGPending = false;
        browseGTimeout = null;
      }

      // Number/letter to jump N tabs from ORIGINAL tab and open it
      const distance = displayToNumber(originalKey);
      if (distance !== null && distance >= 1) {
        jumpAndOpenTab(distance);
        return;
      }

      return;
    }

    // === G-MODE HANDLING ===
    if (gMode) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      // gg - go to first tab (or first unpinned if setting enabled)
      if (key === S['keys.gMode.first'] && gNumberBuffer === '') {
        if (S['display.ggSkipPinned']) {
          const tabs = getVisibleTabs();
          const firstUnpinned = tabs.findIndex(t => !t.pinned && !t.hasAttribute('zen-essential'));
          const targetIdx = firstUnpinned >= 0 ? firstUnpinned : 0;
          gBrowser.selectedTab = tabs[targetIdx];
          log(`Jumped to first unpinned tab via gg (index ${targetIdx})`);
          exitLeapMode(true);
        } else {
          goToAbsoluteTab(1);
        }
        return;
      }

      // G in g-mode - go to last tab
      if (originalKey === S['keys.gMode.last'] && gNumberBuffer === '') {
        const tabs = getVisibleTabs();
        goToAbsoluteTab(tabs.length);
        return;
      }

      // Number keys - accumulate for absolute position
      if (key >= '0' && key <= '9') {
        gNumberBuffer += key;
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
      if (key === 'enter' && gNumberBuffer) {
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
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      if (key === S['keys.zMode.center']) {
        scrollTabIntoView('center');
        exitLeapMode(false);
        return;
      }
      if (key === S['keys.zMode.top']) {
        scrollTabIntoView('top');
        exitLeapMode(false);
        return;
      }
      if (key === S['keys.zMode.bottom']) {
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
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      // Accept a-z and 0-9 as mark characters
      if ((key >= 'a' && key <= 'z') || (key >= '0' && key <= '9')) {
        setMark(key, gBrowser.selectedTab);
        exitLeapMode(false);
        return;
      }

      // Invalid key, exit mark mode but stay in leap mode
      markMode = false;
      updateLeapOverlayState();
      log(`Invalid mark key: ${key}, exiting mark mode`);
      return;
    }

    // === GOTO MARK MODE HANDLING ===
    if (gotoMarkMode) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      // Accept a-z and 0-9 as mark characters
      if ((key >= 'a' && key <= 'z') || (key >= '0' && key <= '9')) {
        if (goToMark(key)) {
          exitLeapMode(true); // Center scroll on the marked tab
        } else {
          // Mark not found, stay in goto mark mode for retry
          log(`Mark '${key}' not found`);
        }
        return;
      }

      // Invalid key, exit goto mark mode but stay in leap mode
      gotoMarkMode = false;
      updateLeapOverlayState();
      log(`Invalid goto mark key: ${key}, exiting goto mark mode`);
      return;
    }

    // === INITIAL LEAP MODE (waiting for j/k/g/z/m/'/o/i) ===
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    if (key === S['keys.leap.browseDown'] || key === S['keys.leap.browseDownAlt']) {
      enterBrowseMode('down');
      return;
    }
    if (key === S['keys.leap.browseUp'] || key === S['keys.leap.browseUpAlt']) {
      enterBrowseMode('up');
      return;
    }
    if (originalKey === S['keys.leap.lastTab']) {
      const tabs = getVisibleTabs();
      goToAbsoluteTab(tabs.length);
      return;
    }
    if (key === S['keys.leap.gMode']) {
      gMode = true;
      gNumberBuffer = '';
      clearTimeout(leapModeTimeout);
      updateLeapOverlayState();
      log('Entered g-mode');
      return;
    }
    if (key === S['keys.leap.zMode']) {
      zMode = true;
      clearTimeout(leapModeTimeout);
      updateLeapOverlayState();
      log('Entered z-mode');
      return;
    }
    if (key === S['keys.leap.setMark'] && originalKey !== S['keys.leap.clearMarks']) {
      markMode = true;
      document.documentElement.setAttribute('data-zenleap-mark-mode', 'true');
      clearTimeout(leapModeTimeout);
      updateLeapOverlayState();
      log('Entered mark mode');
      return;
    }
    if (originalKey === S['keys.leap.clearMarks']) {
      clearAllMarks();
      exitLeapMode(false);
      return;
    }
    if (key === S['keys.leap.gotoMark'] || key === S['keys.leap.gotoMarkAlt']) {
      gotoMarkMode = true;
      document.documentElement.setAttribute('data-zenleap-mark-mode', 'true');
      clearTimeout(leapModeTimeout);
      updateLeapOverlayState();
      log('Entered goto mark mode');
      return;
    }
    if (key === S['keys.leap.jumpBack']) {
      if (jumpBack()) exitLeapMode(true);
      return;
    }
    if (key === S['keys.leap.jumpForward']) {
      if (jumpForward()) exitLeapMode(true);
      return;
    }
    if (key === S['keys.leap.prevWorkspace'] || key === S['keys.leap.prevWorkspaceAlt'] ||
        key === S['keys.leap.nextWorkspace'] || key === S['keys.leap.nextWorkspaceAlt']) {
      const isPrev = key === S['keys.leap.prevWorkspace'] || key === S['keys.leap.prevWorkspaceAlt'];
      browseMode = true;
      browseDirection = isPrev ? 'up' : 'down';
      const tabs = getVisibleTabs();
      const currentTab = gBrowser.selectedTab;
      originalTabIndex = tabs.indexOf(currentTab);
      originalTab = currentTab;
      highlightedTabIndex = 0;
      clearTimeout(leapModeTimeout);
      updateLeapOverlayState();
      browseWorkspaceSwitch(isPrev ? 'prev' : 'next');
      return;
    }
    if (originalKey === S['keys.leap.help']) {
      enterHelpMode();
      return;
    }

    // 0 = jump to first unpinned tab (like vim's 0 goes to start of line)
    if (key === '0') {
      const tabs = getVisibleTabs();
      const firstUnpinned = tabs.findIndex(t => !t.pinned && !t.hasAttribute('zen-essential'));
      if (firstUnpinned >= 0) {
        gBrowser.selectedTab = tabs[firstUnpinned];
        log(`Jumped to first unpinned tab (index ${firstUnpinned})`);
      }
      exitLeapMode(true);
      return;
    }

    // $ = jump to last tab (like vim's $ goes to end of line)
    if (originalKey === '$') {
      const tabs = getVisibleTabs();
      if (tabs.length > 0) {
        gBrowser.selectedTab = tabs[tabs.length - 1];
        log(`Jumped to last tab (index ${tabs.length - 1})`);
      }
      exitLeapMode(true);
      return;
    }

    // Any other key in initial leap mode - ignore (don't exit, just wait for valid command)
    log(`Unrecognized key in leap mode: ${key}`);
  }

  // Set up event listeners for tab changes
  function setupTabListeners() {
    gBrowser.tabContainer.addEventListener('TabSelect', (event) => {
      updateRelativeNumbers();
      // Record tab change to jump list
      if (recordingJumps && event.target) {
        recordJump(event.target);
      }
    });

    gBrowser.tabContainer.addEventListener('TabOpen', () => {
      setTimeout(updateRelativeNumbers, 50);
    });

    gBrowser.tabContainer.addEventListener('TabClose', () => {
      setTimeout(updateRelativeNumbers, 50);
    });

    gBrowser.tabContainer.addEventListener('TabMove', () => {
      updateRelativeNumbers();
    });

    document.addEventListener('ZenWorkspaceChanged', () => {
      setTimeout(updateRelativeNumbers, 100);
    });

    log('Tab listeners set up');
  }

  // Suppress keyup events while in active modes to prevent them from leaking to content
  // (e.g., Space keyup reaching YouTube after Ctrl+Space keydown entered Leap Mode)
  function handleKeyUp(event) {
    if (leapMode || searchMode || commandMode || settingsMode || helpMode) {
      event.preventDefault();
      event.stopPropagation();
    }
  }

  // Set up keyboard listener
  function setupKeyboardListener() {
    window.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('keyup', handleKeyUp, true);
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

  // Apply theme colors as CSS custom properties on :root
  function applyThemeColors() {
    const root = document.documentElement;
    const accent = S['appearance.accentColor'];
    const currentBg = S['appearance.currentTabBg'];
    const currentColor = S['appearance.currentTabColor'];
    const badgeBg = S['appearance.badgeBg'];
    const badgeColor = S['appearance.badgeColor'];
    const upBg = S['appearance.upDirectionBg'];
    const downBg = S['appearance.downDirectionBg'];
    const mark = S['appearance.markColor'];
    const highlight = S['appearance.highlightBorder'];
    const selected = S['appearance.selectedBorder'];

    root.style.setProperty('--zl-accent', accent);
    root.style.setProperty('--zl-accent-20', hexToRgba(accent, 0.2));
    root.style.setProperty('--zl-accent-15', hexToRgba(accent, 0.15));
    root.style.setProperty('--zl-accent-60', hexToRgba(accent, 0.6));
    root.style.setProperty('--zl-accent-80', hexToRgba(accent, 0.8));
    root.style.setProperty('--zl-current-bg', currentBg);
    root.style.setProperty('--zl-current-color', currentColor);
    root.style.setProperty('--zl-badge-bg', badgeBg);
    root.style.setProperty('--zl-badge-color', badgeColor);
    root.style.setProperty('--zl-up-bg', upBg);
    root.style.setProperty('--zl-down-bg', downBg);
    root.style.setProperty('--zl-mark', mark);
    root.style.setProperty('--zl-mark-50', hexToRgba(mark, 0.5));
    root.style.setProperty('--zl-mark-70', hexToRgba(mark, 0.7));
    root.style.setProperty('--zl-mark-80', hexToRgba(mark, 0.8));
    root.style.setProperty('--zl-mark-90', hexToRgba(mark, 0.9));
    root.style.setProperty('--zl-highlight', highlight);
    root.style.setProperty('--zl-highlight-20', hexToRgba(highlight, 0.2));
    root.style.setProperty('--zl-highlight-15', hexToRgba(highlight, 0.15));
    root.style.setProperty('--zl-highlight-60', hexToRgba(highlight, 0.6));
    root.style.setProperty('--zl-highlight-80', hexToRgba(highlight, 0.8));
    root.style.setProperty('--zl-selected', selected);
    root.style.setProperty('--zl-selected-20', hexToRgba(selected, 0.2));
    root.style.setProperty('--zl-selected-15', hexToRgba(selected, 0.15));

    // Blend highlight + selected for the combo state (average the two colors)
    const hR = parseInt(highlight.slice(1, 3), 16), hG = parseInt(highlight.slice(3, 5), 16), hB = parseInt(highlight.slice(5, 7), 16);
    const sR = parseInt(selected.slice(1, 3), 16), sG = parseInt(selected.slice(3, 5), 16), sB = parseInt(selected.slice(5, 7), 16);
    const blendHex = `#${Math.round((hR + sR) / 2).toString(16).padStart(2, '0')}${Math.round((hG + sG) / 2).toString(16).padStart(2, '0')}${Math.round((hB + sB) / 2).toString(16).padStart(2, '0')}`;
    root.style.setProperty('--zl-highlight-selected', blendHex);
    root.style.setProperty('--zl-highlight-selected-20', hexToRgba(blendHex, 0.25));
    root.style.setProperty('--zl-highlight-selected-15', hexToRgba(blendHex, 0.2));
  }

  function injectStyles() {
    const style = document.createElement('style');
    style.id = 'zenleap-styles';
    style.textContent = `
      /* Base styles */
      tab[data-zenleap-rel] {
        position: relative;
      }

      /* Highlighted tab in browse mode */
      tab[data-zenleap-highlight="true"] {
        outline: 2px solid var(--zl-highlight) !important;
        outline-offset: -2px;
        background-color: var(--zl-highlight-20) !important;
      }

      tab[data-zenleap-highlight="true"] > .tab-stack > .tab-content {
        background-color: var(--zl-highlight-15) !important;
      }

      /* Selected tabs in browse mode (multi-select with Space) */
      tab[data-zenleap-selected="true"] {
        outline: 2px solid var(--zl-selected) !important;
        outline-offset: -2px;
        background-color: var(--zl-selected-20) !important;
      }

      tab[data-zenleap-selected="true"] > .tab-stack > .tab-content {
        background-color: var(--zl-selected-15) !important;
      }

      /* Tab that is both highlighted and selected */
      tab[data-zenleap-highlight="true"][data-zenleap-selected="true"] {
        outline: 2px solid var(--zl-highlight-selected) !important;
        background-color: var(--zl-highlight-selected-20) !important;
      }

      tab[data-zenleap-highlight="true"][data-zenleap-selected="true"] > .tab-stack > .tab-content {
        background-color: var(--zl-highlight-selected-15) !important;
      }

      /* Expanded sidebar mode */
      @media (-moz-bool-pref: "zen.view.sidebar-expanded") {
        tab:not([zen-glance-tab="true"]) > .tab-stack > .tab-content[data-zenleap-rel]::after {
          content: attr(data-zenleap-rel) !important;
          font-weight: bold !important;
          font-size: 80% !important;
          z-index: 100 !important;
          display: inline-block !important;
          background-color: var(--zl-badge-bg) !important;
          color: var(--zl-badge-color) !important;
          text-align: center !important;
          width: 20px !important;
          height: 20px !important;
          line-height: 20px !important;
          border-radius: 4px !important;
          margin-left: 3px !important;
          margin-right: 3px !important;
          font-family: monospace !important;
        }

        tab[data-zenleap-direction="current"]:not([zen-glance-tab="true"]) > .tab-stack > .tab-content[data-zenleap-rel]::after {
          background-color: var(--zl-current-bg) !important;
          color: var(--zl-current-color) !important;
        }

        tab[data-zenleap-direction="up"]:not([zen-glance-tab="true"]) > .tab-stack > .tab-content[data-zenleap-rel]::after {
          background-color: var(--zl-up-bg) !important;
        }

        tab[data-zenleap-direction="down"]:not([zen-glance-tab="true"]) > .tab-stack > .tab-content[data-zenleap-rel]::after {
          background-color: var(--zl-down-bg) !important;
        }

        /* Hide badge on hover to make room for close button */
        tab:not([zen-glance-tab="true"]):hover > .tab-stack > .tab-content[data-zenleap-rel]::after {
          display: none !important;
        }

        /* Hide close button by default */
        tab .tab-close-button {
          display: none !important;
        }

        /* Show close button on hover */
        tab:hover .tab-close-button {
          display: flex !important;
          visibility: visible !important;
          opacity: 1 !important;
        }

        /* Highlighted tab badge */
        tab[data-zenleap-highlight="true"]:not([zen-glance-tab="true"]) > .tab-stack > .tab-content[data-zenleap-rel]::after {
          background-color: var(--zl-highlight) !important;
          color: var(--zl-current-color) !important;
          box-shadow: 0 0 8px var(--zl-highlight-60) !important;
        }

        /* Marked tab badge - distinct color */
        tab[data-zenleap-has-mark="true"]:not([zen-glance-tab="true"]) > .tab-stack > .tab-content[data-zenleap-rel]::after {
          background-color: var(--zl-mark) !important;
          color: var(--zl-current-color) !important;
          font-weight: bold !important;
          box-shadow: 0 0 6px var(--zl-mark-50) !important;
        }
      }

      /* Compact sidebar mode */
      @media not (-moz-bool-pref: "zen.view.sidebar-expanded") {
        tab:not([zen-glance-tab="true"]) > .tab-stack > .tab-content[data-zenleap-rel]::before {
          content: attr(data-zenleap-rel) !important;
          position: absolute !important;
          top: 2px !important;
          right: 2px !important;
          font-weight: bold !important;
          font-size: 70% !important;
          z-index: 100 !important;
          color: var(--zl-badge-color) !important;
          font-family: monospace !important;
          text-shadow: 0 0 2px rgba(0,0,0,0.5) !important;
        }

        tab[data-zenleap-direction="current"]:not([zen-glance-tab="true"]) > .tab-stack > .tab-content[data-zenleap-rel]::before {
          color: var(--zl-current-bg) !important;
        }

        tab[data-zenleap-highlight="true"]:not([zen-glance-tab="true"]) > .tab-stack > .tab-content[data-zenleap-rel]::before {
          color: var(--zl-highlight) !important;
          text-shadow: 0 0 6px var(--zl-highlight-80) !important;
        }

        /* Marked tab in compact mode */
        tab[data-zenleap-has-mark="true"]:not([zen-glance-tab="true"]) > .tab-stack > .tab-content[data-zenleap-rel]::before {
          color: var(--zl-mark) !important;
          text-shadow: 0 0 4px var(--zl-mark-80) !important;
          font-weight: bold !important;
        }
      }

      /* Leap mode active indicator - uses direction colors */
      :root[data-zenleap-active="true"] tab[data-zenleap-direction="up"]:not([zen-glance-tab="true"]) > .tab-stack > .tab-content[data-zenleap-rel]::after,
      :root[data-zenleap-active="true"] tab[data-zenleap-direction="up"]:not([zen-glance-tab="true"]) > .tab-stack > .tab-content[data-zenleap-rel]::before {
        color: var(--zl-badge-color) !important;
        background-color: var(--zl-up-bg) !important;
      }

      :root[data-zenleap-active="true"] tab[data-zenleap-direction="down"]:not([zen-glance-tab="true"]) > .tab-stack > .tab-content[data-zenleap-rel]::after,
      :root[data-zenleap-active="true"] tab[data-zenleap-direction="down"]:not([zen-glance-tab="true"]) > .tab-stack > .tab-content[data-zenleap-rel]::before {
        color: var(--zl-badge-color) !important;
        background-color: var(--zl-down-bg) !important;
      }

      /* Mark mode - gray out all non-marked tabs */
      :root[data-zenleap-active="true"][data-zenleap-mark-mode="true"] tab:not([data-zenleap-has-mark="true"]):not([zen-glance-tab="true"]) > .tab-stack > .tab-content[data-zenleap-rel]::after {
        color: #666666 !important;
        background-color: var(--zl-badge-bg) !important;
        box-shadow: none !important;
      }

      :root[data-zenleap-active="true"][data-zenleap-mark-mode="true"] tab:not([data-zenleap-has-mark="true"]):not([zen-glance-tab="true"]) > .tab-stack > .tab-content[data-zenleap-rel]::before {
        color: #666666 !important;
        text-shadow: none !important;
      }

      /* Mark mode - keep marked tabs with enhanced visibility */
      :root[data-zenleap-active="true"][data-zenleap-mark-mode="true"] tab[data-zenleap-has-mark="true"]:not([zen-glance-tab="true"]) > .tab-stack > .tab-content[data-zenleap-rel]::after {
        background-color: var(--zl-mark) !important;
        color: var(--zl-current-color) !important;
        box-shadow: 0 0 8px var(--zl-mark-70) !important;
      }

      :root[data-zenleap-active="true"][data-zenleap-mark-mode="true"] tab[data-zenleap-has-mark="true"]:not([zen-glance-tab="true"]) > .tab-stack > .tab-content[data-zenleap-rel]::before {
        color: var(--zl-mark) !important;
        text-shadow: 0 0 6px var(--zl-mark-90) !important;
      }
    `;
    document.head.appendChild(style);
    applyThemeColors();
    log('Styles injected');
  }

  // Logging utility
  function log(message) {
    if (CONFIG.debug) {
      console.log(`[ZenLeap] ${message}`);
    }
  }

  // Initialize
  let initRetries = 0;
  const MAX_INIT_RETRIES = 20;

  function init() {
    log(`Initializing ZenLeap v${VERSION}...`);

    if (!gBrowser || !gBrowser.tabs) {
      initRetries++;
      if (initRetries > MAX_INIT_RETRIES) {
        console.error('[ZenLeap] Failed to initialize after ' + MAX_INIT_RETRIES + ' retries. gBrowser not available.');
        return;
      }
      log(`gBrowser not ready, retrying in 500ms (attempt ${initRetries}/${MAX_INIT_RETRIES})`);
      setTimeout(init, 500);
      return;
    }

    injectStyles();
    setupTabListeners();
    setupKeyboardListener();
    updateRelativeNumbers();

    log(`ZenLeap v${VERSION} initialized successfully!`);
    log('Press Ctrl+Space to enter leap mode (auto-expands sidebar in compact mode)');
    log('  j/k/↑↓ = browse mode | Enter=open | x=close | Esc=cancel');
    log('  g = goto (gg=first, G=last, g{num}=tab #)');
    log('  z = scroll (zz=center, zt=top, zb=bottom)');
    log('  m{char} = set/toggle mark | M = clear all marks');
    log('  \'{char} = goto mark | Ctrl+\'{char} = quick goto');
    log('  o = jump back | i = jump forward');
    log('Press Ctrl+/ for tab search (vim-style fuzzy finder)');
  }

  // Start initialization
  if (document.readyState === 'complete') {
    init();
  } else {
    document.addEventListener('DOMContentLoaded', init);
  }

})();
