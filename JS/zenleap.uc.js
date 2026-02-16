// ==UserScript==
// @name           ZenLeap - Relative Tab Navigation
// @description    Vim-style relative tab numbering with keyboard navigation
// @include        main
// @author         ZenLeap
// @version        3.2.0  // Keep in sync with VERSION constant below
// ==/UserScript==

(function() {
  'use strict';

  // Version - keep in sync with @version in header above
  const VERSION = '3.2.0';

  // ============================================
  // SETTINGS SYSTEM
  // ============================================

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
    'keys.global.undoFolderDelete': { default: { key: 't', ctrl: false, shift: true, alt: false, meta: true }, type: 'combo', label: 'Undo Folder Delete', description: 'Undo the last folder deletion (Cmd+Shift+T)', category: 'Keybindings', group: 'Global Triggers' },

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

    // --- Display ---
    'display.currentTabIndicator': { default: '\u00B7', type: 'text', label: 'Current Tab Indicator', description: 'Badge character on current tab', category: 'Display', group: 'Tab Badges', maxLength: 2 },
    'display.vimModeInBars':        { default: true, type: 'toggle', label: 'Vim Mode in Search/Command', description: 'Enable vim normal mode in search and command bars. When off, Escape always closes the bar.', category: 'Display', group: 'Search' },
    'display.searchAllWorkspaces':  { default: false, type: 'toggle', label: 'Search All Workspaces', description: 'Search tabs across all workspaces, not just the current one', category: 'Display', group: 'Search' },
    'display.ggSkipPinned':         { default: true, type: 'toggle', label: 'gg Skips Pinned Tabs', description: 'When enabled, gg in browse/g-mode jumps to first unpinned tab instead of absolute first', category: 'Display', group: 'Navigation' },
    'display.tabAsEnter':           { default: false, type: 'toggle', label: 'Tab Acts as Enter', description: 'When enabled, Tab executes commands like Enter in the command palette. When off, Tab only performs its explicit bindings (e.g. toggle workspace search).', category: 'Display', group: 'Search' },
    'display.browsePreview':        { default: true, type: 'toggle', label: 'Browse Preview', description: 'Show a floating thumbnail preview of the highlighted tab in browse mode', category: 'Display', group: 'Navigation' },
    'display.maxSearchResults':    { default: 100, type: 'number', label: 'Max Search Results', description: 'Maximum results in tab search', category: 'Display', group: 'Search', min: 10, max: 500, step: 10 },
    'display.maxJumpListSize':     { default: 100, type: 'number', label: 'Max Jump History', description: 'Maximum jump history entries', category: 'Display', group: 'History', min: 10, max: 500, step: 10 },

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
  // THEME ENGINE
  // ============================================

  const BUILTIN_THEMES = {
    // ── Meridian: Warm amber accent, deep navy surfaces ──
    'meridian': {
      name: 'Meridian',
      // Backgrounds
      bgVoid: '#080a0f', bgDeep: '#0c0f15', bgBase: '#10141c',
      bgSurface: '#161b25', bgRaised: '#1c222e', bgElevated: '#242b39', bgHover: '#2a3244',
      // Accent (warm amber)
      accent: '#d4965a', accentBright: '#e8a96d',
      accentDim: 'rgba(212,150,90,0.10)', accentMid: 'rgba(212,150,90,0.20)',
      accentGlow: 'rgba(212,150,90,0.35)', accentBorder: 'rgba(212,150,90,0.30)',
      // Semantic
      blue: '#5b9fe8', purple: '#a78bdb', green: '#6ec47d',
      red: '#e06b6b', cyan: '#5bbfd7', gold: '#d4b85c',
      // gTile regions
      regionBlue: '#5b9fe8', regionPurple: '#a78bdb', regionGreen: '#6ec47d', regionGold: '#d4b85c',
      // Text
      textPrimary: '#dfe3eb', textSecondary: '#7d8694', textTertiary: '#525b6b', textMuted: '#3c4352',
      // Borders
      borderSubtle: 'rgba(255,255,255,0.04)', borderDefault: 'rgba(255,255,255,0.07)', borderStrong: 'rgba(255,255,255,0.12)',
      // Radii
      rSm: '6px', rMd: '10px', rLg: '14px', rXl: '20px',
      // Fonts
      fontUi: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      fontMono: "'SF Mono', 'Fira Code', 'Cascadia Code', monospace",
      // Shadows
      shadowModal: '0 24px 80px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.07)',
      shadowElevated: '0 8px 32px rgba(0,0,0,0.4)',
      shadowKbd: '0 1px 2px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.06)',
      // Effects
      noiseOpacity: '0.018', backdropBlur: '12px', panelAlpha: '0.98',
      // Browse mode (derived from palette)
      highlight: '#d4965a', selected: '#5bbfd7', mark: '#e06b6b',
      currentBadgeBg: '#d4965a', currentBadgeColor: '#10141c',
      badgeBg: '#3d4a5c', badgeColor: '#dfe3eb',
      upBg: '#5b9fe8', downBg: '#6ec47d',
    },

    // ── Meridian Transparent: Same palette, translucent panels ──
    'meridian-transparent': {
      name: 'Meridian Transparent',
      bgVoid: '#080a0f', bgDeep: '#0c0f15', bgBase: '#10141c',
      bgSurface: 'rgba(22,27,37,0.88)', bgRaised: 'rgba(28,34,46,0.88)',
      bgElevated: 'rgba(36,43,57,0.88)', bgHover: 'rgba(42,50,68,0.88)',
      accent: '#d4965a', accentBright: '#e8a96d',
      accentDim: 'rgba(212,150,90,0.10)', accentMid: 'rgba(212,150,90,0.20)',
      accentGlow: 'rgba(212,150,90,0.35)', accentBorder: 'rgba(212,150,90,0.30)',
      blue: '#5b9fe8', purple: '#a78bdb', green: '#6ec47d',
      red: '#e06b6b', cyan: '#5bbfd7', gold: '#d4b85c',
      regionBlue: '#5b9fe8', regionPurple: '#a78bdb', regionGreen: '#6ec47d', regionGold: '#d4b85c',
      textPrimary: '#dfe3eb', textSecondary: '#7d8694', textTertiary: '#525b6b', textMuted: '#3c4352',
      borderSubtle: 'rgba(255,255,255,0.05)', borderDefault: 'rgba(255,255,255,0.08)', borderStrong: 'rgba(255,255,255,0.14)',
      rSm: '6px', rMd: '10px', rLg: '14px', rXl: '20px',
      fontUi: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      fontMono: "'SF Mono', 'Fira Code', 'Cascadia Code', monospace",
      shadowModal: '0 24px 80px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.08)',
      shadowElevated: '0 8px 32px rgba(0,0,0,0.4)',
      shadowKbd: '0 1px 2px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.06)',
      noiseOpacity: '0.022', backdropBlur: '20px', panelAlpha: '0.88',
      highlight: '#d4965a', selected: '#5bbfd7', mark: '#e06b6b',
      currentBadgeBg: '#d4965a', currentBadgeColor: '#10141c',
      badgeBg: 'rgba(61,74,92,0.92)', badgeColor: '#dfe3eb',
      upBg: '#5b9fe8', downBg: '#6ec47d',
    },

    // ── Dracula: Classic purple-accent dark theme ──
    // Palette: https://draculatheme.com/contribute
    'dracula': {
      name: 'Dracula',
      bgVoid: '#1e1f29', bgDeep: '#21222c', bgBase: '#282a36',
      bgSurface: '#2d2f3d', bgRaised: '#343746', bgElevated: '#3c3f58', bgHover: '#44475a',
      accent: '#bd93f9', accentBright: '#d4b0ff',
      accentDim: 'rgba(189,147,249,0.10)', accentMid: 'rgba(189,147,249,0.20)',
      accentGlow: 'rgba(189,147,249,0.35)', accentBorder: 'rgba(189,147,249,0.30)',
      blue: '#8be9fd', purple: '#bd93f9', green: '#50fa7b',
      red: '#ff5555', cyan: '#8be9fd', gold: '#f1fa8c',
      regionBlue: '#8be9fd', regionPurple: '#bd93f9', regionGreen: '#50fa7b', regionGold: '#f1fa8c',
      textPrimary: '#f8f8f2', textSecondary: '#bfbfbf', textTertiary: '#6272a4', textMuted: '#44475a',
      borderSubtle: 'rgba(255,255,255,0.04)', borderDefault: 'rgba(255,255,255,0.08)', borderStrong: 'rgba(255,255,255,0.14)',
      rSm: '6px', rMd: '10px', rLg: '14px', rXl: '20px',
      fontUi: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      fontMono: "'SF Mono', 'Fira Code', 'Cascadia Code', monospace",
      shadowModal: '0 24px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.08)',
      shadowElevated: '0 8px 32px rgba(0,0,0,0.45)',
      shadowKbd: '0 1px 2px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.06)',
      noiseOpacity: '0.012', backdropBlur: '12px', panelAlpha: '0.98',
      highlight: '#bd93f9', selected: '#8be9fd', mark: '#ff5555',
      currentBadgeBg: '#bd93f9', currentBadgeColor: '#282a36',
      badgeBg: '#565a72', badgeColor: '#f8f8f2',
      upBg: '#8be9fd', downBg: '#50fa7b',
    },

    // ── Gruvbox Dark: Warm retro palette ──
    // Palette: https://github.com/morhetz/gruvbox
    'gruvbox': {
      name: 'Gruvbox Dark',
      bgVoid: '#1d2021', bgDeep: '#202324', bgBase: '#282828',
      bgSurface: '#32302f', bgRaised: '#3c3836', bgElevated: '#504945', bgHover: '#665c54',
      accent: '#fabd2f', accentBright: '#ffe066',
      accentDim: 'rgba(250,189,47,0.10)', accentMid: 'rgba(250,189,47,0.20)',
      accentGlow: 'rgba(250,189,47,0.35)', accentBorder: 'rgba(250,189,47,0.30)',
      blue: '#83a598', purple: '#d3869b', green: '#b8bb26',
      red: '#fb4934', cyan: '#8ec07c', gold: '#fabd2f',
      regionBlue: '#83a598', regionPurple: '#d3869b', regionGreen: '#b8bb26', regionGold: '#fabd2f',
      textPrimary: '#ebdbb2', textSecondary: '#a89984', textTertiary: '#7c6f64', textMuted: '#504945',
      borderSubtle: 'rgba(235,219,178,0.04)', borderDefault: 'rgba(235,219,178,0.08)', borderStrong: 'rgba(235,219,178,0.14)',
      rSm: '6px', rMd: '10px', rLg: '14px', rXl: '20px',
      fontUi: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      fontMono: "'SF Mono', 'Fira Code', 'Cascadia Code', monospace",
      shadowModal: '0 24px 80px rgba(0,0,0,0.55), 0 0 0 1px rgba(235,219,178,0.08)',
      shadowElevated: '0 8px 32px rgba(0,0,0,0.4)',
      shadowKbd: '0 1px 2px rgba(0,0,0,0.4), inset 0 1px 0 rgba(235,219,178,0.06)',
      noiseOpacity: '0.015', backdropBlur: '12px', panelAlpha: '0.98',
      highlight: '#fabd2f', selected: '#83a598', mark: '#fb4934',
      currentBadgeBg: '#fabd2f', currentBadgeColor: '#282828',
      badgeBg: '#665c54', badgeColor: '#ebdbb2',
      upBg: '#83a598', downBg: '#b8bb26',
    },

    // ── Nord: Clean arctic aesthetic ──
    // Palette: https://www.nordtheme.com
    'nord': {
      name: 'Nord',
      bgVoid: '#242933', bgDeep: '#272c36', bgBase: '#2e3440',
      bgSurface: '#343a48', bgRaised: '#3b4252', bgElevated: '#434c5e', bgHover: '#4c566a',
      accent: '#88c0d0', accentBright: '#a3d4e2',
      accentDim: 'rgba(136,192,208,0.10)', accentMid: 'rgba(136,192,208,0.20)',
      accentGlow: 'rgba(136,192,208,0.35)', accentBorder: 'rgba(136,192,208,0.30)',
      blue: '#81a1c1', purple: '#b48ead', green: '#a3be8c',
      red: '#bf616a', cyan: '#88c0d0', gold: '#ebcb8b',
      regionBlue: '#81a1c1', regionPurple: '#b48ead', regionGreen: '#a3be8c', regionGold: '#ebcb8b',
      textPrimary: '#eceff4', textSecondary: '#d8dee9', textTertiary: '#7b88a1', textMuted: '#4c566a',
      borderSubtle: 'rgba(236,239,244,0.04)', borderDefault: 'rgba(236,239,244,0.07)', borderStrong: 'rgba(236,239,244,0.12)',
      rSm: '6px', rMd: '10px', rLg: '14px', rXl: '20px',
      fontUi: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      fontMono: "'SF Mono', 'Fira Code', 'Cascadia Code', monospace",
      shadowModal: '0 24px 80px rgba(0,0,0,0.5), 0 0 0 1px rgba(236,239,244,0.07)',
      shadowElevated: '0 8px 32px rgba(0,0,0,0.35)',
      shadowKbd: '0 1px 2px rgba(0,0,0,0.35), inset 0 1px 0 rgba(236,239,244,0.06)',
      noiseOpacity: '0.012', backdropBlur: '12px', panelAlpha: '0.98',
      highlight: '#88c0d0', selected: '#ebcb8b', mark: '#bf616a',
      currentBadgeBg: '#88c0d0', currentBadgeColor: '#2e3440',
      badgeBg: '#5a6580', badgeColor: '#eceff4',
      upBg: '#81a1c1', downBg: '#a3be8c',
    },

    // ── Catppuccin Mocha: Soothing pastel theme ──
    // Palette: https://github.com/catppuccin/catppuccin
    'catppuccin': {
      name: 'Catppuccin Mocha',
      bgVoid: '#181825', bgDeep: '#1a1a2e', bgBase: '#1e1e2e',
      bgSurface: '#262637', bgRaised: '#313244', bgElevated: '#3b3b52', bgHover: '#45475a',
      accent: '#cba6f7', accentBright: '#dbbfff',
      accentDim: 'rgba(203,166,247,0.10)', accentMid: 'rgba(203,166,247,0.20)',
      accentGlow: 'rgba(203,166,247,0.35)', accentBorder: 'rgba(203,166,247,0.30)',
      blue: '#89b4fa', purple: '#cba6f7', green: '#a6e3a1',
      red: '#f38ba8', cyan: '#94e2d5', gold: '#f9e2af',
      regionBlue: '#89b4fa', regionPurple: '#cba6f7', regionGreen: '#a6e3a1', regionGold: '#f9e2af',
      textPrimary: '#cdd6f4', textSecondary: '#a6adc8', textTertiary: '#6c7086', textMuted: '#45475a',
      borderSubtle: 'rgba(205,214,244,0.04)', borderDefault: 'rgba(205,214,244,0.07)', borderStrong: 'rgba(205,214,244,0.12)',
      rSm: '6px', rMd: '10px', rLg: '14px', rXl: '20px',
      fontUi: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      fontMono: "'SF Mono', 'Fira Code', 'Cascadia Code', monospace",
      shadowModal: '0 24px 80px rgba(0,0,0,0.55), 0 0 0 1px rgba(205,214,244,0.07)',
      shadowElevated: '0 8px 32px rgba(0,0,0,0.4)',
      shadowKbd: '0 1px 2px rgba(0,0,0,0.4), inset 0 1px 0 rgba(205,214,244,0.06)',
      noiseOpacity: '0.012', backdropBlur: '12px', panelAlpha: '0.98',
      highlight: '#cba6f7', selected: '#94e2d5', mark: '#f38ba8',
      currentBadgeBg: '#cba6f7', currentBadgeColor: '#1e1e2e',
      badgeBg: '#585b72', badgeColor: '#cdd6f4',
      upBg: '#89b4fa', downBg: '#a6e3a1',
    },

    // ── Tokyo Night: Modern VS Code-popular dark theme ──
    // Palette: https://github.com/enkia/tokyo-night-vscode-theme
    'tokyo-night': {
      name: 'Tokyo Night',
      bgVoid: '#16161e', bgDeep: '#1a1a24', bgBase: '#1a1b26',
      bgSurface: '#1f2030', bgRaised: '#24283b', bgElevated: '#2f3349', bgHover: '#3b3d57',
      accent: '#7aa2f7', accentBright: '#9ab8ff',
      accentDim: 'rgba(122,162,247,0.10)', accentMid: 'rgba(122,162,247,0.20)',
      accentGlow: 'rgba(122,162,247,0.35)', accentBorder: 'rgba(122,162,247,0.30)',
      blue: '#7aa2f7', purple: '#bb9af7', green: '#9ece6a',
      red: '#f7768e', cyan: '#7dcfff', gold: '#e0af68',
      regionBlue: '#7aa2f7', regionPurple: '#bb9af7', regionGreen: '#9ece6a', regionGold: '#e0af68',
      textPrimary: '#c0caf5', textSecondary: '#9aa5ce', textTertiary: '#565f89', textMuted: '#3b4261',
      borderSubtle: 'rgba(192,202,245,0.04)', borderDefault: 'rgba(192,202,245,0.07)', borderStrong: 'rgba(192,202,245,0.12)',
      rSm: '6px', rMd: '10px', rLg: '14px', rXl: '20px',
      fontUi: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      fontMono: "'SF Mono', 'Fira Code', 'Cascadia Code', monospace",
      shadowModal: '0 24px 80px rgba(0,0,0,0.55), 0 0 0 1px rgba(192,202,245,0.07)',
      shadowElevated: '0 8px 32px rgba(0,0,0,0.4)',
      shadowKbd: '0 1px 2px rgba(0,0,0,0.4), inset 0 1px 0 rgba(192,202,245,0.06)',
      noiseOpacity: '0.012', backdropBlur: '12px', panelAlpha: '0.98',
      highlight: '#7aa2f7', selected: '#e0af68', mark: '#f7768e',
      currentBadgeBg: '#7aa2f7', currentBadgeColor: '#1a1b26',
      badgeBg: '#515475', badgeColor: '#c0caf5',
      upBg: '#7dcfff', downBg: '#9ece6a',
    },

    // ── Monokai Pro: Classic syntax-highlighting-inspired theme ──
    // Palette: https://monokai.pro
    'monokai': {
      name: 'Monokai',
      bgVoid: '#1a1a1a', bgDeep: '#1e1f1c', bgBase: '#272822',
      bgSurface: '#2d2e27', bgRaised: '#3e3d32', bgElevated: '#49483e', bgHover: '#585840',
      accent: '#a6e22e', accentBright: '#b8f240',
      accentDim: 'rgba(166,226,46,0.10)', accentMid: 'rgba(166,226,46,0.20)',
      accentGlow: 'rgba(166,226,46,0.35)', accentBorder: 'rgba(166,226,46,0.30)',
      blue: '#66d9ef', purple: '#ae81ff', green: '#a6e22e',
      red: '#f92672', cyan: '#66d9ef', gold: '#e6db74',
      regionBlue: '#66d9ef', regionPurple: '#ae81ff', regionGreen: '#a6e22e', regionGold: '#e6db74',
      textPrimary: '#f8f8f2', textSecondary: '#b8b8a8', textTertiary: '#75715e', textMuted: '#49483e',
      borderSubtle: 'rgba(248,248,242,0.04)', borderDefault: 'rgba(248,248,242,0.08)', borderStrong: 'rgba(248,248,242,0.14)',
      rSm: '6px', rMd: '10px', rLg: '14px', rXl: '20px',
      fontUi: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      fontMono: "'SF Mono', 'Fira Code', 'Cascadia Code', monospace",
      shadowModal: '0 24px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(248,248,242,0.08)',
      shadowElevated: '0 8px 32px rgba(0,0,0,0.45)',
      shadowKbd: '0 1px 2px rgba(0,0,0,0.5), inset 0 1px 0 rgba(248,248,242,0.06)',
      noiseOpacity: '0.012', backdropBlur: '12px', panelAlpha: '0.98',
      highlight: '#a6e22e', selected: '#66d9ef', mark: '#f92672',
      currentBadgeBg: '#a6e22e', currentBadgeColor: '#272822',
      badgeBg: '#585840', badgeColor: '#f8f8f2',
      upBg: '#66d9ef', downBg: '#ae81ff',
    },

    // ── One Dark Pro: Atom's iconic One Dark ──
    // Palette: https://github.com/Binaryify/OneDark-Pro
    'one-dark': {
      name: 'One Dark Pro',
      bgVoid: '#1b1d23', bgDeep: '#1e2027', bgBase: '#282c34',
      bgSurface: '#2c313a', bgRaised: '#333842', bgElevated: '#3b4048', bgHover: '#434852',
      accent: '#61afef', accentBright: '#7bc4ff',
      accentDim: 'rgba(97,175,239,0.10)', accentMid: 'rgba(97,175,239,0.20)',
      accentGlow: 'rgba(97,175,239,0.35)', accentBorder: 'rgba(97,175,239,0.30)',
      blue: '#61afef', purple: '#c678dd', green: '#98c379',
      red: '#e06c75', cyan: '#56b6c2', gold: '#e5c07b',
      regionBlue: '#61afef', regionPurple: '#c678dd', regionGreen: '#98c379', regionGold: '#e5c07b',
      textPrimary: '#abb2bf', textSecondary: '#7f848e', textTertiary: '#5c6370', textMuted: '#3e4452',
      borderSubtle: 'rgba(171,178,191,0.04)', borderDefault: 'rgba(171,178,191,0.08)', borderStrong: 'rgba(171,178,191,0.14)',
      rSm: '6px', rMd: '10px', rLg: '14px', rXl: '20px',
      fontUi: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      fontMono: "'SF Mono', 'Fira Code', 'Cascadia Code', monospace",
      shadowModal: '0 24px 80px rgba(0,0,0,0.55), 0 0 0 1px rgba(171,178,191,0.07)',
      shadowElevated: '0 8px 32px rgba(0,0,0,0.4)',
      shadowKbd: '0 1px 2px rgba(0,0,0,0.4), inset 0 1px 0 rgba(171,178,191,0.06)',
      noiseOpacity: '0.012', backdropBlur: '12px', panelAlpha: '0.98',
      highlight: '#61afef', selected: '#c678dd', mark: '#e06c75',
      currentBadgeBg: '#61afef', currentBadgeColor: '#282c34',
      badgeBg: '#4b5263', badgeColor: '#abb2bf',
      upBg: '#56b6c2', downBg: '#98c379',
    },

    // ── Solarized Dark: Ethan Schoonover's precision-crafted palette ──
    // Palette: https://ethanschoonover.com/solarized
    'solarized-dark': {
      name: 'Solarized Dark',
      bgVoid: '#001e26', bgDeep: '#00212b', bgBase: '#002b36',
      bgSurface: '#073642', bgRaised: '#0a4050', bgElevated: '#0d4e5e', bgHover: '#1a5c6c',
      accent: '#268bd2', accentBright: '#3d9ee5',
      accentDim: 'rgba(38,139,210,0.10)', accentMid: 'rgba(38,139,210,0.20)',
      accentGlow: 'rgba(38,139,210,0.35)', accentBorder: 'rgba(38,139,210,0.30)',
      blue: '#268bd2', purple: '#6c71c4', green: '#859900',
      red: '#dc322f', cyan: '#2aa198', gold: '#b58900',
      regionBlue: '#268bd2', regionPurple: '#6c71c4', regionGreen: '#859900', regionGold: '#b58900',
      textPrimary: '#93a1a1', textSecondary: '#839496', textTertiary: '#586e75', textMuted: '#405b62',
      borderSubtle: 'rgba(147,161,161,0.04)', borderDefault: 'rgba(147,161,161,0.08)', borderStrong: 'rgba(147,161,161,0.14)',
      rSm: '6px', rMd: '10px', rLg: '14px', rXl: '20px',
      fontUi: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      fontMono: "'SF Mono', 'Fira Code', 'Cascadia Code', monospace",
      shadowModal: '0 24px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(147,161,161,0.07)',
      shadowElevated: '0 8px 32px rgba(0,0,0,0.45)',
      shadowKbd: '0 1px 2px rgba(0,0,0,0.45), inset 0 1px 0 rgba(147,161,161,0.06)',
      noiseOpacity: '0.012', backdropBlur: '12px', panelAlpha: '0.98',
      highlight: '#268bd2', selected: '#2aa198', mark: '#dc322f',
      currentBadgeBg: '#268bd2', currentBadgeColor: '#002b36',
      badgeBg: '#1a5c6c', badgeColor: '#93a1a1',
      upBg: '#6c71c4', downBg: '#859900',
    },

    // ── GitHub Dark: GitHub's official dark theme ──
    // Palette: https://github.com/primer/primitives
    'github-dark': {
      name: 'GitHub Dark',
      bgVoid: '#0a0c10', bgDeep: '#0d1117', bgBase: '#161b22',
      bgSurface: '#1c2128', bgRaised: '#21262d', bgElevated: '#282e36', bgHover: '#30363d',
      accent: '#58a6ff', accentBright: '#79c0ff',
      accentDim: 'rgba(88,166,255,0.10)', accentMid: 'rgba(88,166,255,0.20)',
      accentGlow: 'rgba(88,166,255,0.35)', accentBorder: 'rgba(88,166,255,0.30)',
      blue: '#58a6ff', purple: '#d2a8ff', green: '#3fb950',
      red: '#f85149', cyan: '#56d4dd', gold: '#d29922',
      regionBlue: '#58a6ff', regionPurple: '#d2a8ff', regionGreen: '#3fb950', regionGold: '#d29922',
      textPrimary: '#c9d1d9', textSecondary: '#8b949e', textTertiary: '#6e7681', textMuted: '#484f58',
      borderSubtle: 'rgba(201,209,217,0.04)', borderDefault: 'rgba(201,209,217,0.08)', borderStrong: 'rgba(201,209,217,0.14)',
      rSm: '6px', rMd: '10px', rLg: '14px', rXl: '20px',
      fontUi: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      fontMono: "'SF Mono', 'Fira Code', 'Cascadia Code', monospace",
      shadowModal: '0 24px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(201,209,217,0.07)',
      shadowElevated: '0 8px 32px rgba(0,0,0,0.45)',
      shadowKbd: '0 1px 2px rgba(0,0,0,0.45), inset 0 1px 0 rgba(201,209,217,0.06)',
      noiseOpacity: '0.010', backdropBlur: '12px', panelAlpha: '0.98',
      highlight: '#58a6ff', selected: '#d2a8ff', mark: '#f85149',
      currentBadgeBg: '#58a6ff', currentBadgeColor: '#0d1117',
      badgeBg: '#30363d', badgeColor: '#c9d1d9',
      upBg: '#56d4dd', downBg: '#3fb950',
    },

    // ── Material Palenight: Material Theme's most popular variant ──
    // Palette: https://github.com/material-theme/vsc-material-theme
    'palenight': {
      name: 'Material Palenight',
      bgVoid: '#1b1e2b', bgDeep: '#1e2132', bgBase: '#292d3e',
      bgSurface: '#2f3344', bgRaised: '#34384a', bgElevated: '#3c4056', bgHover: '#444862',
      accent: '#82aaff', accentBright: '#9fc0ff',
      accentDim: 'rgba(130,170,255,0.10)', accentMid: 'rgba(130,170,255,0.20)',
      accentGlow: 'rgba(130,170,255,0.35)', accentBorder: 'rgba(130,170,255,0.30)',
      blue: '#82aaff', purple: '#c792ea', green: '#c3e88d',
      red: '#f07178', cyan: '#89ddff', gold: '#ffcb6b',
      regionBlue: '#82aaff', regionPurple: '#c792ea', regionGreen: '#c3e88d', regionGold: '#ffcb6b',
      textPrimary: '#a6accd', textSecondary: '#7982a9', textTertiary: '#5c6590', textMuted: '#3c4056',
      borderSubtle: 'rgba(166,172,205,0.04)', borderDefault: 'rgba(166,172,205,0.08)', borderStrong: 'rgba(166,172,205,0.14)',
      rSm: '6px', rMd: '10px', rLg: '14px', rXl: '20px',
      fontUi: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      fontMono: "'SF Mono', 'Fira Code', 'Cascadia Code', monospace",
      shadowModal: '0 24px 80px rgba(0,0,0,0.55), 0 0 0 1px rgba(166,172,205,0.07)',
      shadowElevated: '0 8px 32px rgba(0,0,0,0.4)',
      shadowKbd: '0 1px 2px rgba(0,0,0,0.4), inset 0 1px 0 rgba(166,172,205,0.06)',
      noiseOpacity: '0.012', backdropBlur: '12px', panelAlpha: '0.98',
      highlight: '#82aaff', selected: '#c792ea', mark: '#f07178',
      currentBadgeBg: '#82aaff', currentBadgeColor: '#292d3e',
      badgeBg: '#444862', badgeColor: '#a6accd',
      upBg: '#89ddff', downBg: '#c3e88d',
    },

    // ── Ayu Dark: Clean minimal dark from Ayu family ──
    // Palette: https://github.com/ayu-theme/ayu-colors
    'ayu-dark': {
      name: 'Ayu Dark',
      bgVoid: '#0a0e14', bgDeep: '#0b0f15', bgBase: '#0d1017',
      bgSurface: '#131721', bgRaised: '#191f2b', bgElevated: '#1f2735', bgHover: '#272f3e',
      accent: '#e6b450', accentBright: '#f0c565',
      accentDim: 'rgba(230,180,80,0.10)', accentMid: 'rgba(230,180,80,0.20)',
      accentGlow: 'rgba(230,180,80,0.35)', accentBorder: 'rgba(230,180,80,0.30)',
      blue: '#39bae6', purple: '#d2a6ff', green: '#7fd962',
      red: '#f07178', cyan: '#95e6cb', gold: '#e6b450',
      regionBlue: '#39bae6', regionPurple: '#d2a6ff', regionGreen: '#7fd962', regionGold: '#e6b450',
      textPrimary: '#bfbdb6', textSecondary: '#7b7d80', textTertiary: '#565b66', textMuted: '#3d424d',
      borderSubtle: 'rgba(191,189,182,0.04)', borderDefault: 'rgba(191,189,182,0.07)', borderStrong: 'rgba(191,189,182,0.12)',
      rSm: '6px', rMd: '10px', rLg: '14px', rXl: '20px',
      fontUi: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      fontMono: "'SF Mono', 'Fira Code', 'Cascadia Code', monospace",
      shadowModal: '0 24px 80px rgba(0,0,0,0.65), 0 0 0 1px rgba(191,189,182,0.07)',
      shadowElevated: '0 8px 32px rgba(0,0,0,0.5)',
      shadowKbd: '0 1px 2px rgba(0,0,0,0.5), inset 0 1px 0 rgba(191,189,182,0.06)',
      noiseOpacity: '0.015', backdropBlur: '12px', panelAlpha: '0.98',
      highlight: '#e6b450', selected: '#39bae6', mark: '#f07178',
      currentBadgeBg: '#e6b450', currentBadgeColor: '#0d1017',
      badgeBg: '#272f3e', badgeColor: '#bfbdb6',
      upBg: '#39bae6', downBg: '#7fd962',
    },

    // ── Ayu Mirage: Softer mid-tone variant of Ayu ──
    'ayu-mirage': {
      name: 'Ayu Mirage',
      bgVoid: '#171b24', bgDeep: '#1a1e27', bgBase: '#1f2430',
      bgSurface: '#242936', bgRaised: '#2a2f3c', bgElevated: '#323845', bgHover: '#3a4050',
      accent: '#ffcc66', accentBright: '#ffd980',
      accentDim: 'rgba(255,204,102,0.10)', accentMid: 'rgba(255,204,102,0.20)',
      accentGlow: 'rgba(255,204,102,0.35)', accentBorder: 'rgba(255,204,102,0.30)',
      blue: '#73d0ff', purple: '#d4bfff', green: '#bae67e',
      red: '#f28779', cyan: '#95e6cb', gold: '#ffcc66',
      regionBlue: '#73d0ff', regionPurple: '#d4bfff', regionGreen: '#bae67e', regionGold: '#ffcc66',
      textPrimary: '#cbccc6', textSecondary: '#8a8d93', textTertiary: '#5c6070', textMuted: '#3a4050',
      borderSubtle: 'rgba(203,204,198,0.04)', borderDefault: 'rgba(203,204,198,0.07)', borderStrong: 'rgba(203,204,198,0.12)',
      rSm: '6px', rMd: '10px', rLg: '14px', rXl: '20px',
      fontUi: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      fontMono: "'SF Mono', 'Fira Code', 'Cascadia Code', monospace",
      shadowModal: '0 24px 80px rgba(0,0,0,0.55), 0 0 0 1px rgba(203,204,198,0.07)',
      shadowElevated: '0 8px 32px rgba(0,0,0,0.4)',
      shadowKbd: '0 1px 2px rgba(0,0,0,0.4), inset 0 1px 0 rgba(203,204,198,0.06)',
      noiseOpacity: '0.012', backdropBlur: '12px', panelAlpha: '0.98',
      highlight: '#ffcc66', selected: '#73d0ff', mark: '#f28779',
      currentBadgeBg: '#ffcc66', currentBadgeColor: '#1f2430',
      badgeBg: '#3a4050', badgeColor: '#cbccc6',
      upBg: '#73d0ff', downBg: '#bae67e',
    },

    // ── Synthwave '84: Retro-futuristic neon ──
    // Palette: https://github.com/robb0wen/synthwave-vscode
    'synthwave': {
      name: "Synthwave '84",
      bgVoid: '#1a1028', bgDeep: '#1e1336', bgBase: '#262335',
      bgSurface: '#2d2844', bgRaised: '#342e50', bgElevated: '#3e375e', bgHover: '#4a4370',
      accent: '#ff7edb', accentBright: '#ff9de6',
      accentDim: 'rgba(255,126,219,0.10)', accentMid: 'rgba(255,126,219,0.20)',
      accentGlow: 'rgba(255,126,219,0.35)', accentBorder: 'rgba(255,126,219,0.30)',
      blue: '#36f9f6', purple: '#ff7edb', green: '#72f1b8',
      red: '#fe4450', cyan: '#36f9f6', gold: '#fede5d',
      regionBlue: '#36f9f6', regionPurple: '#ff7edb', regionGreen: '#72f1b8', regionGold: '#fede5d',
      textPrimary: '#e0d0ff', textSecondary: '#a599c4', textTertiary: '#6e5e8e', textMuted: '#4a4370',
      borderSubtle: 'rgba(224,208,255,0.04)', borderDefault: 'rgba(224,208,255,0.08)', borderStrong: 'rgba(224,208,255,0.14)',
      rSm: '6px', rMd: '10px', rLg: '14px', rXl: '20px',
      fontUi: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      fontMono: "'SF Mono', 'Fira Code', 'Cascadia Code', monospace",
      shadowModal: '0 24px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(224,208,255,0.08)',
      shadowElevated: '0 8px 32px rgba(0,0,0,0.5)',
      shadowKbd: '0 1px 2px rgba(0,0,0,0.5), inset 0 1px 0 rgba(224,208,255,0.06)',
      noiseOpacity: '0.015', backdropBlur: '14px', panelAlpha: '0.97',
      highlight: '#ff7edb', selected: '#36f9f6', mark: '#fe4450',
      currentBadgeBg: '#ff7edb', currentBadgeColor: '#262335',
      badgeBg: '#4a4370', badgeColor: '#e0d0ff',
      upBg: '#36f9f6', downBg: '#72f1b8',
    },

    // ── Everforest Dark: Comfortable green-toned theme ──
    // Palette: https://github.com/sainnhe/everforest
    'everforest': {
      name: 'Everforest Dark',
      bgVoid: '#242b2a', bgDeep: '#272e2d', bgBase: '#2d353b',
      bgSurface: '#343e44', bgRaised: '#3d484d', bgElevated: '#475258', bgHover: '#505c62',
      accent: '#a7c080', accentBright: '#b8d294',
      accentDim: 'rgba(167,192,128,0.10)', accentMid: 'rgba(167,192,128,0.20)',
      accentGlow: 'rgba(167,192,128,0.35)', accentBorder: 'rgba(167,192,128,0.30)',
      blue: '#7fbbb3', purple: '#d699b6', green: '#a7c080',
      red: '#e67e80', cyan: '#83c092', gold: '#dbbc7f',
      regionBlue: '#7fbbb3', regionPurple: '#d699b6', regionGreen: '#a7c080', regionGold: '#dbbc7f',
      textPrimary: '#d3c6aa', textSecondary: '#9da9a0', textTertiary: '#7a8478', textMuted: '#505c62',
      borderSubtle: 'rgba(211,198,170,0.04)', borderDefault: 'rgba(211,198,170,0.07)', borderStrong: 'rgba(211,198,170,0.12)',
      rSm: '6px', rMd: '10px', rLg: '14px', rXl: '20px',
      fontUi: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      fontMono: "'SF Mono', 'Fira Code', 'Cascadia Code', monospace",
      shadowModal: '0 24px 80px rgba(0,0,0,0.5), 0 0 0 1px rgba(211,198,170,0.07)',
      shadowElevated: '0 8px 32px rgba(0,0,0,0.35)',
      shadowKbd: '0 1px 2px rgba(0,0,0,0.35), inset 0 1px 0 rgba(211,198,170,0.06)',
      noiseOpacity: '0.015', backdropBlur: '12px', panelAlpha: '0.98',
      highlight: '#a7c080', selected: '#7fbbb3', mark: '#e67e80',
      currentBadgeBg: '#a7c080', currentBadgeColor: '#2d353b',
      badgeBg: '#505c62', badgeColor: '#d3c6aa',
      upBg: '#7fbbb3', downBg: '#83c092',
    },

    // ── Kanagawa: Inspired by Katsushika Hokusai's The Great Wave ──
    // Palette: https://github.com/rebelot/kanagawa.nvim
    'kanagawa': {
      name: 'Kanagawa',
      bgVoid: '#16161d', bgDeep: '#181820', bgBase: '#1f1f28',
      bgSurface: '#252530', bgRaised: '#2a2a37', bgElevated: '#363646', bgHover: '#3e3e52',
      accent: '#7e9cd8', accentBright: '#9ab4ec',
      accentDim: 'rgba(126,156,216,0.10)', accentMid: 'rgba(126,156,216,0.20)',
      accentGlow: 'rgba(126,156,216,0.35)', accentBorder: 'rgba(126,156,216,0.30)',
      blue: '#7e9cd8', purple: '#957fb8', green: '#76946a',
      red: '#c34043', cyan: '#7aa89f', gold: '#dca561',
      regionBlue: '#7e9cd8', regionPurple: '#957fb8', regionGreen: '#76946a', regionGold: '#dca561',
      textPrimary: '#dcd7ba', textSecondary: '#9a978a', textTertiary: '#727169', textMuted: '#3e3e52',
      borderSubtle: 'rgba(220,215,186,0.04)', borderDefault: 'rgba(220,215,186,0.07)', borderStrong: 'rgba(220,215,186,0.12)',
      rSm: '6px', rMd: '10px', rLg: '14px', rXl: '20px',
      fontUi: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      fontMono: "'SF Mono', 'Fira Code', 'Cascadia Code', monospace",
      shadowModal: '0 24px 80px rgba(0,0,0,0.55), 0 0 0 1px rgba(220,215,186,0.07)',
      shadowElevated: '0 8px 32px rgba(0,0,0,0.4)',
      shadowKbd: '0 1px 2px rgba(0,0,0,0.4), inset 0 1px 0 rgba(220,215,186,0.06)',
      noiseOpacity: '0.015', backdropBlur: '12px', panelAlpha: '0.98',
      highlight: '#7e9cd8', selected: '#dca561', mark: '#c34043',
      currentBadgeBg: '#7e9cd8', currentBadgeColor: '#1f1f28',
      badgeBg: '#3e3e52', badgeColor: '#dcd7ba',
      upBg: '#7aa89f', downBg: '#76946a',
    },

    // ── Rosé Pine: All natural pine, faux fur, and a bit of soho vibes ──
    // Palette: https://rosepinetheme.com
    'rose-pine': {
      name: 'Rosé Pine',
      bgVoid: '#14121c', bgDeep: '#17151f', bgBase: '#191724',
      bgSurface: '#1f1d2e', bgRaised: '#26233a', bgElevated: '#2e2b42', bgHover: '#38354c',
      accent: '#c4a7e7', accentBright: '#d4bbf5',
      accentDim: 'rgba(196,167,231,0.10)', accentMid: 'rgba(196,167,231,0.20)',
      accentGlow: 'rgba(196,167,231,0.35)', accentBorder: 'rgba(196,167,231,0.30)',
      blue: '#9ccfd8', purple: '#c4a7e7', green: '#31748f',
      red: '#eb6f92', cyan: '#9ccfd8', gold: '#f6c177',
      regionBlue: '#9ccfd8', regionPurple: '#c4a7e7', regionGreen: '#31748f', regionGold: '#f6c177',
      textPrimary: '#e0def4', textSecondary: '#908caa', textTertiary: '#6e6a86', textMuted: '#403d52',
      borderSubtle: 'rgba(224,222,244,0.04)', borderDefault: 'rgba(224,222,244,0.07)', borderStrong: 'rgba(224,222,244,0.12)',
      rSm: '6px', rMd: '10px', rLg: '14px', rXl: '20px',
      fontUi: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      fontMono: "'SF Mono', 'Fira Code', 'Cascadia Code', monospace",
      shadowModal: '0 24px 80px rgba(0,0,0,0.55), 0 0 0 1px rgba(224,222,244,0.07)',
      shadowElevated: '0 8px 32px rgba(0,0,0,0.4)',
      shadowKbd: '0 1px 2px rgba(0,0,0,0.4), inset 0 1px 0 rgba(224,222,244,0.06)',
      noiseOpacity: '0.012', backdropBlur: '12px', panelAlpha: '0.98',
      highlight: '#c4a7e7', selected: '#9ccfd8', mark: '#eb6f92',
      currentBadgeBg: '#c4a7e7', currentBadgeColor: '#191724',
      badgeBg: '#38354c', badgeColor: '#e0def4',
      upBg: '#9ccfd8', downBg: '#31748f',
    },

    // ── Vesper: Warm dark theme with orange accents ──
    // Palette: https://github.com/raunofreiberg/vesper
    'vesper': {
      name: 'Vesper',
      bgVoid: '#0e0e0e', bgDeep: '#101010', bgBase: '#141414',
      bgSurface: '#1b1b1b', bgRaised: '#222222', bgElevated: '#2a2a2a', bgHover: '#333333',
      accent: '#ffc799', accentBright: '#ffd4b0',
      accentDim: 'rgba(255,199,153,0.10)', accentMid: 'rgba(255,199,153,0.20)',
      accentGlow: 'rgba(255,199,153,0.35)', accentBorder: 'rgba(255,199,153,0.30)',
      blue: '#8eb8e4', purple: '#d5a8e0', green: '#7fb98f',
      red: '#f5a191', cyan: '#8eb8e4', gold: '#ffc799',
      regionBlue: '#8eb8e4', regionPurple: '#d5a8e0', regionGreen: '#7fb98f', regionGold: '#ffc799',
      textPrimary: '#b8b8b8', textSecondary: '#7b7b7b', textTertiary: '#555555', textMuted: '#333333',
      borderSubtle: 'rgba(184,184,184,0.04)', borderDefault: 'rgba(184,184,184,0.07)', borderStrong: 'rgba(184,184,184,0.12)',
      rSm: '6px', rMd: '10px', rLg: '14px', rXl: '20px',
      fontUi: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      fontMono: "'SF Mono', 'Fira Code', 'Cascadia Code', monospace",
      shadowModal: '0 24px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(184,184,184,0.07)',
      shadowElevated: '0 8px 32px rgba(0,0,0,0.5)',
      shadowKbd: '0 1px 2px rgba(0,0,0,0.5), inset 0 1px 0 rgba(184,184,184,0.06)',
      noiseOpacity: '0.018', backdropBlur: '12px', panelAlpha: '0.98',
      highlight: '#ffc799', selected: '#8eb8e4', mark: '#f5a191',
      currentBadgeBg: '#ffc799', currentBadgeColor: '#141414',
      badgeBg: '#333333', badgeColor: '#b8b8b8',
      upBg: '#8eb8e4', downBg: '#7fb98f',
    },

    // ── Poimandres: Minimal, dark teal-accented ──
    // Palette: https://github.com/drcmda/poimandres-theme
    'poimandres': {
      name: 'Poimandres',
      bgVoid: '#1a1c2a', bgDeep: '#1b1e2e', bgBase: '#1b2031',
      bgSurface: '#212738', bgRaised: '#272d40', bgElevated: '#303648', bgHover: '#3a4055',
      accent: '#add7ff', accentBright: '#c5e4ff',
      accentDim: 'rgba(173,215,255,0.10)', accentMid: 'rgba(173,215,255,0.20)',
      accentGlow: 'rgba(173,215,255,0.35)', accentBorder: 'rgba(173,215,255,0.30)',
      blue: '#add7ff', purple: '#a6accd', green: '#5de4c7',
      red: '#d0679d', cyan: '#89ddff', gold: '#fffac2',
      regionBlue: '#add7ff', regionPurple: '#a6accd', regionGreen: '#5de4c7', regionGold: '#fffac2',
      textPrimary: '#a6accd', textSecondary: '#767c9d', textTertiary: '#506477', textMuted: '#3a4055',
      borderSubtle: 'rgba(166,172,205,0.04)', borderDefault: 'rgba(166,172,205,0.07)', borderStrong: 'rgba(166,172,205,0.12)',
      rSm: '6px', rMd: '10px', rLg: '14px', rXl: '20px',
      fontUi: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      fontMono: "'SF Mono', 'Fira Code', 'Cascadia Code', monospace",
      shadowModal: '0 24px 80px rgba(0,0,0,0.55), 0 0 0 1px rgba(166,172,205,0.07)',
      shadowElevated: '0 8px 32px rgba(0,0,0,0.4)',
      shadowKbd: '0 1px 2px rgba(0,0,0,0.4), inset 0 1px 0 rgba(166,172,205,0.06)',
      noiseOpacity: '0.012', backdropBlur: '12px', panelAlpha: '0.98',
      highlight: '#add7ff', selected: '#5de4c7', mark: '#d0679d',
      currentBadgeBg: '#add7ff', currentBadgeColor: '#1b2031',
      badgeBg: '#3a4055', badgeColor: '#a6accd',
      upBg: '#89ddff', downBg: '#5de4c7',
    },

    // ── Moonlight: Soft purple VS Code theme ──
    // Palette: https://github.com/atomiks/moonlight-vscode-theme
    'moonlight': {
      name: 'Moonlight',
      bgVoid: '#1a1c2e', bgDeep: '#1c1e32', bgBase: '#1e2030',
      bgSurface: '#222436', bgRaised: '#2a2c40', bgElevated: '#32344a', bgHover: '#3c3e56',
      accent: '#82aaff', accentBright: '#a0c4ff',
      accentDim: 'rgba(130,170,255,0.10)', accentMid: 'rgba(130,170,255,0.20)',
      accentGlow: 'rgba(130,170,255,0.35)', accentBorder: 'rgba(130,170,255,0.30)',
      blue: '#82aaff', purple: '#c099ff', green: '#c3e88d',
      red: '#ff757f', cyan: '#86e1fc', gold: '#ffc777',
      regionBlue: '#82aaff', regionPurple: '#c099ff', regionGreen: '#c3e88d', regionGold: '#ffc777',
      textPrimary: '#c8d3f5', textSecondary: '#8f98b0', textTertiary: '#636da6', textMuted: '#3c3e56',
      borderSubtle: 'rgba(200,211,245,0.04)', borderDefault: 'rgba(200,211,245,0.07)', borderStrong: 'rgba(200,211,245,0.12)',
      rSm: '6px', rMd: '10px', rLg: '14px', rXl: '20px',
      fontUi: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      fontMono: "'SF Mono', 'Fira Code', 'Cascadia Code', monospace",
      shadowModal: '0 24px 80px rgba(0,0,0,0.55), 0 0 0 1px rgba(200,211,245,0.07)',
      shadowElevated: '0 8px 32px rgba(0,0,0,0.4)',
      shadowKbd: '0 1px 2px rgba(0,0,0,0.4), inset 0 1px 0 rgba(200,211,245,0.06)',
      noiseOpacity: '0.012', backdropBlur: '12px', panelAlpha: '0.98',
      highlight: '#82aaff', selected: '#c099ff', mark: '#ff757f',
      currentBadgeBg: '#82aaff', currentBadgeColor: '#1e2030',
      badgeBg: '#3c3e56', badgeColor: '#c8d3f5',
      upBg: '#86e1fc', downBg: '#c3e88d',
    },

    // ── Andromeda: Bold, colorful dark theme ──
    // Palette: https://github.com/EliverLara/Andromeda
    'andromeda': {
      name: 'Andromeda',
      bgVoid: '#1a1a24', bgDeep: '#1e1e2a', bgBase: '#23262e',
      bgSurface: '#292c36', bgRaised: '#2f323e', bgElevated: '#383c4a', bgHover: '#414558',
      accent: '#ffe66d', accentBright: '#fff08a',
      accentDim: 'rgba(255,230,109,0.10)', accentMid: 'rgba(255,230,109,0.20)',
      accentGlow: 'rgba(255,230,109,0.35)', accentBorder: 'rgba(255,230,109,0.30)',
      blue: '#6ec1e4', purple: '#c74ded', green: '#96e072',
      red: '#ee5d43', cyan: '#00e8c6', gold: '#ffe66d',
      regionBlue: '#6ec1e4', regionPurple: '#c74ded', regionGreen: '#96e072', regionGold: '#ffe66d',
      textPrimary: '#d5ced9', textSecondary: '#9a929e', textTertiary: '#6b6370', textMuted: '#414558',
      borderSubtle: 'rgba(213,206,217,0.04)', borderDefault: 'rgba(213,206,217,0.08)', borderStrong: 'rgba(213,206,217,0.14)',
      rSm: '6px', rMd: '10px', rLg: '14px', rXl: '20px',
      fontUi: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      fontMono: "'SF Mono', 'Fira Code', 'Cascadia Code', monospace",
      shadowModal: '0 24px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(213,206,217,0.08)',
      shadowElevated: '0 8px 32px rgba(0,0,0,0.45)',
      shadowKbd: '0 1px 2px rgba(0,0,0,0.45), inset 0 1px 0 rgba(213,206,217,0.06)',
      noiseOpacity: '0.012', backdropBlur: '12px', panelAlpha: '0.98',
      highlight: '#ffe66d', selected: '#00e8c6', mark: '#ee5d43',
      currentBadgeBg: '#ffe66d', currentBadgeColor: '#23262e',
      badgeBg: '#414558', badgeColor: '#d5ced9',
      upBg: '#6ec1e4', downBg: '#96e072',
    },

    // ── Nightfox: Cool-toned Neovim-born theme ──
    // Palette: https://github.com/EdenEast/nightfox.nvim
    'nightfox': {
      name: 'Nightfox',
      bgVoid: '#131a24', bgDeep: '#152028', bgBase: '#192330',
      bgSurface: '#1e2a38', bgRaised: '#243140', bgElevated: '#29394a', bgHover: '#324456',
      accent: '#719cd6', accentBright: '#8db4e8',
      accentDim: 'rgba(113,156,214,0.10)', accentMid: 'rgba(113,156,214,0.20)',
      accentGlow: 'rgba(113,156,214,0.35)', accentBorder: 'rgba(113,156,214,0.30)',
      blue: '#719cd6', purple: '#9d79d6', green: '#81b29a',
      red: '#c94f6d', cyan: '#63cdcf', gold: '#dbc074',
      regionBlue: '#719cd6', regionPurple: '#9d79d6', regionGreen: '#81b29a', regionGold: '#dbc074',
      textPrimary: '#cdcecf', textSecondary: '#93949a', textTertiary: '#6b6e75', textMuted: '#3d4b5c',
      borderSubtle: 'rgba(205,206,207,0.04)', borderDefault: 'rgba(205,206,207,0.07)', borderStrong: 'rgba(205,206,207,0.12)',
      rSm: '6px', rMd: '10px', rLg: '14px', rXl: '20px',
      fontUi: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      fontMono: "'SF Mono', 'Fira Code', 'Cascadia Code', monospace",
      shadowModal: '0 24px 80px rgba(0,0,0,0.55), 0 0 0 1px rgba(205,206,207,0.07)',
      shadowElevated: '0 8px 32px rgba(0,0,0,0.4)',
      shadowKbd: '0 1px 2px rgba(0,0,0,0.4), inset 0 1px 0 rgba(205,206,207,0.06)',
      noiseOpacity: '0.015', backdropBlur: '12px', panelAlpha: '0.98',
      highlight: '#719cd6', selected: '#dbc074', mark: '#c94f6d',
      currentBadgeBg: '#719cd6', currentBadgeColor: '#192330',
      badgeBg: '#324456', badgeColor: '#cdcecf',
      upBg: '#63cdcf', downBg: '#81b29a',
    },

    // ── Vitesse Dark: Elegant minimal by Anthony Fu ──
    // Palette: https://github.com/antfu/vscode-theme-vitesse
    'vitesse': {
      name: 'Vitesse Dark',
      bgVoid: '#171717', bgDeep: '#1a1a1a', bgBase: '#1e1e1e',
      bgSurface: '#252525', bgRaised: '#2b2b2b', bgElevated: '#333333', bgHover: '#3a3a3a',
      accent: '#4d9375', accentBright: '#5da888',
      accentDim: 'rgba(77,147,117,0.10)', accentMid: 'rgba(77,147,117,0.20)',
      accentGlow: 'rgba(77,147,117,0.35)', accentBorder: 'rgba(77,147,117,0.30)',
      blue: '#4c9a91', purple: '#b38bdb', green: '#4d9375',
      red: '#cb7676', cyan: '#5eaab5', gold: '#d4976c',
      regionBlue: '#4c9a91', regionPurple: '#b38bdb', regionGreen: '#4d9375', regionGold: '#d4976c',
      textPrimary: '#dbd7ca', textSecondary: '#9a958c', textTertiary: '#6b675d', textMuted: '#3a3a3a',
      borderSubtle: 'rgba(219,215,202,0.04)', borderDefault: 'rgba(219,215,202,0.07)', borderStrong: 'rgba(219,215,202,0.12)',
      rSm: '6px', rMd: '10px', rLg: '14px', rXl: '20px',
      fontUi: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      fontMono: "'SF Mono', 'Fira Code', 'Cascadia Code', monospace",
      shadowModal: '0 24px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(219,215,202,0.07)',
      shadowElevated: '0 8px 32px rgba(0,0,0,0.45)',
      shadowKbd: '0 1px 2px rgba(0,0,0,0.45), inset 0 1px 0 rgba(219,215,202,0.06)',
      noiseOpacity: '0.015', backdropBlur: '12px', panelAlpha: '0.98',
      highlight: '#4d9375', selected: '#4c9a91', mark: '#cb7676',
      currentBadgeBg: '#4d9375', currentBadgeColor: '#1e1e1e',
      badgeBg: '#3a3a3a', badgeColor: '#dbd7ca',
      upBg: '#5eaab5', downBg: '#4d9375',
    },
  };

  // Mutable themes map: built-ins + user overrides (populated by loadUserThemes)
  let themes = { ...BUILTIN_THEMES };

  // Helper: build theme options array from current themes map
  function getThemeOptions() {
    return Object.entries(themes).map(([value, t]) => ({ value, label: t.name || value }));
  }

  // Load user-defined themes from {profile}/chrome/zenleap-themes.json
  // Supports "extends" to inherit from a built-in or other user theme.
  // Uses topological resolution so extends-chain order doesn't matter.
  async function loadUserThemes() {
    // Reset to built-ins before merging (handles deletions on reload)
    themes = { ...BUILTIN_THEMES };
    const themesPath = PathUtils.join(PathUtils.profileDir, 'chrome', 'zenleap-themes.json');
    try {
      const content = await IOUtils.readUTF8(themesPath);
      const userThemes = JSON.parse(content);
      const entries = Object.entries(userThemes).filter(([k, v]) => typeof v === 'object' && v && !k.startsWith('_'));
      const resolved = new Set();
      const resolving = new Set(); // cycle detection

      function resolve(key, def) {
        if (resolved.has(key)) return;
        if (resolving.has(key)) { console.warn(`[ZenLeap] Circular extends detected for theme "${key}", skipping`); return; }
        resolving.add(key);

        let base = {};
        if (def.extends) {
          if (BUILTIN_THEMES[def.extends]) {
            base = BUILTIN_THEMES[def.extends];
          } else {
            const parentEntry = entries.find(([k]) => k === def.extends);
            if (parentEntry) {
              resolve(parentEntry[0], parentEntry[1]);
              base = themes[def.extends] || {};
            }
          }
        }

        const { extends: _, ...rest } = def;
        themes[key] = { ...base, ...rest };
        if (!themes[key].name) themes[key].name = key;
        resolving.delete(key);
        resolved.add(key);
      }

      for (const [key, def] of entries) resolve(key, def);
      log(`Loaded ${entries.length} user theme(s) from zenleap-themes.json`);
    } catch (e) {
      // Silently ignore missing file — it's optional
      if (e.name !== 'NotFoundError' && (!e.result || e.result !== 0x80520012)) {
        console.warn('[ZenLeap] Error loading user themes:', e);
      }
    }
  }

  // Create template zenleap-themes.json if it doesn't exist
  async function ensureThemesFile() {
    const themesPath = PathUtils.join(PathUtils.profileDir, 'chrome', 'zenleap-themes.json');
    try {
      await IOUtils.read(themesPath, { maxBytes: 1 });
    } catch (e) {
      // File doesn't exist — create template
      const template = JSON.stringify({
        _comment: "ZenLeap User Themes. Use 'extends' to inherit from a built-in theme. Run :reload-themes after editing.",
        "example-custom": {
          name: "Example Custom",
          extends: "meridian",
          accent: "#ff6b6b",
          accentBright: "#ff8e8e",
          highlight: "#ff6b6b"
        }
      }, null, 2);
      try {
        await IOUtils.writeUTF8(themesPath, template);
        log('Created template zenleap-themes.json');
      } catch (writeErr) {
        console.warn('[ZenLeap] Could not create themes template:', writeErr);
      }
    }
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

  // Command palette group definitions (for section headers when input is empty)
  const COMMAND_GROUPS = [
    { id: 'tab-mgmt', label: 'Tab Management', icon: '\u{1F4CB}', keys: ['new-tab','close-tab','close-other-tabs','close-tabs-right','close-tabs-left','duplicate-tab','pin-unpin-tab','add-to-essentials','remove-from-essentials','rename-tab','edit-tab-icon','reset-pinned-tab','replace-pinned-url','mute-unmute-tab','unload-tab','reload-tab','bookmark-tab','reopen-closed-tab','select-all-tabs','select-matching-tabs','deduplicate-tabs','move-tab-to-top','move-tab-to-bottom','sort-tabs','group-by-domain'] },
    { id: 'navigation', label: 'Navigation', icon: '\u{1F9ED}', keys: ['go-first-tab','go-last-tab','browse-mode-down','browse-mode-up','open-tab-search'] },
    { id: 'view', label: 'View & Browser', icon: '\u{1F5A5}', keys: ['toggle-fullscreen','toggle-sidebar','zoom-in','zoom-out','zoom-reset'] },
    { id: 'split', label: 'Split View', icon: '\u25EB', keys: ['unsplit-view','split-with-tab','split-rotate-tabs','split-rotate-layout','split-reset-sizes','remove-tab-from-split','split-resize-gtile'] },
    { id: 'workspaces', label: 'Workspaces', icon: '\u{1F5C2}', keys: ['create-workspace','delete-workspace','switch-workspace','move-to-workspace','rename-workspace','reorganize-workspaces'] },
    { id: 'folders', label: 'Folders', icon: '\u{1F4C1}', keys: ['create-folder','delete-folder','add-to-folder','rename-folder','change-folder-icon','unload-folder-tabs','create-subfolder','convert-folder-to-workspace','unpack-folder','move-folder-to-workspace'] },
    { id: 'zenleap', label: 'ZenLeap', icon: '\u26A1', keys: ['toggle-browse-preview','toggle-debug','open-help','open-settings','check-update','switch-theme','reload-themes','open-themes-file'] },
    { id: 'sessions', label: 'Sessions', icon: '\u{1F4BE}', keys: ['save-session','restore-session','list-sessions'] },
  ];

  // Build reverse lookup: command key → group id
  const _commandGroupMap = new Map();
  for (const g of COMMAND_GROUPS) {
    for (const k of g.keys) _commandGroupMap.set(k, g.id);
  }

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
      // Clear dismissed version when installed version changes (e.g. fresh install)
      if (S['updates.lastInstalledVersion'] !== VERSION) {
        S['updates.dismissedVersion'] = '';
        S['updates.lastInstalledVersion'] = VERSION;
        saveSettings();
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
    if (id === 'appearance.theme') applyTheme();
  }

  function resetAllSettings() {
    for (const [id, schema] of Object.entries(SETTINGS_SCHEMA)) {
      S[id] = typeof schema.default === 'object' ? JSON.parse(JSON.stringify(schema.default)) : schema.default;
    }
    saveSettings();
    applyTheme();
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
        await IOUtils.write(filePath, new TextEncoder().encode(json));
        showSettingsToast('success', 'Settings exported to Downloads');
      } catch (e) {
        log(`Export failed: ${e}`);
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
            log(`Import read failed: ${e}`);
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
        if (typeof value !== 'number' || isNaN(value)) return false;
        if (schema.min !== undefined && value < schema.min) return false;
        if (schema.max !== undefined && value > schema.max) return false;
        return true;
      case 'text': case 'color': case 'key': return typeof value === 'string';
      case 'select': return typeof value === 'string' && (!schema.options || schema.options.some(o => o.value === value));
      case 'combo': return typeof value === 'object' && value !== null && typeof value.key === 'string';
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
    for (const [id, newVal] of Object.entries(incoming)) {
      const schema = SETTINGS_SCHEMA[id];
      if (!schema || schema.hidden) continue;
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
      S[id] = typeof value === 'object' ? JSON.parse(JSON.stringify(value)) : value;
    }
    saveSettings();
    applyThemeColors();
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
  }

  function dismissImportConfirmation() {
    const existing = document.getElementById('zenleap-import-overlay');
    if (existing) existing.remove();
  }

  function formatImportValue(value, schema) {
    if (schema?.type === 'combo' && typeof value === 'object') {
      return formatKeyDisplay(value, schema);
    }
    if (schema?.type === 'toggle') return value ? 'on' : 'off';
    if (typeof value === 'string' && value.length > 12) return value.slice(0, 12) + '\u2026';
    return String(value);
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

  // Browse mode state
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
  let quickNavInterceptedUntil = 0;  // Suppress keyup events until this timestamp
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

  // Theme live-preview state (for Switch Theme command)
  let _themePreviewOriginal = null; // theme ID to restore on Escape

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
      _pluginEventBus.emit('mark:cleared', { char });
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
    _pluginEventBus.emit('mark:set', { char, tab });
    log(`Set mark '${char}' on tab`);

    // Update display to show the mark
    updateRelativeNumbers();
  }

  // Clear all marks
  function clearAllMarks() {
    const count = marks.size;
    marks.clear();
    _pluginEventBus.emit('marks:cleared', { count });
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

    _pluginEventBus.emit('mark:jumped', { char, tab });
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

  // Score, filter, and sort picker results by fuzzy match relevance
  function fuzzyFilterAndSort(results, query) {
    if (!query) return results;
    const scored = [];
    for (const r of results) {
      const target = `${r.label} ${(r.tags || []).join(' ')}`;
      const match = fuzzyMatchSingle(query.toLowerCase(), target.toLowerCase());
      if (match) {
        scored.push({ ...r, score: match.score });
      }
    }
    scored.sort((a, b) => b.score - a.score);
    return scored;
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
    const style = document.createElement('style');
    style.id = 'zenleap-search-styles';
    style.textContent = `
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
      }
      #zenleap-search-results::-webkit-scrollbar { width: 6px; }
      #zenleap-search-results::-webkit-scrollbar-track { background: transparent; }
      #zenleap-search-results::-webkit-scrollbar-thumb { background: var(--zl-border-strong); border-radius: 3px; }

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

      .zenleap-search-result-ws {
        display: inline-block; font-size: 10px; font-weight: 500;
        padding: 1px 6px; border-radius: 3px;
        background: rgba(167,139,219,0.12); color: var(--zl-purple);
        white-space: nowrap; flex-shrink: 0;
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

      .zenleap-command-info { flex: 1; min-width: 0; overflow: hidden; }

      .zenleap-command-label {
        font-size: 13px; font-weight: 500; color: var(--zl-text-primary);
        white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      }
      .zenleap-command-label:has(.zenleap-search-result-ws) {
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
    `;

    document.head.appendChild(style);
    document.documentElement.appendChild(searchModal);

    // Add input event listener
    searchInput.addEventListener('input', handleSearchInput);

    // Handle keydown on input for insert mode navigation
    searchInput.addEventListener('keydown', (e) => {
      // --- jj-to-normal-mode intercept (insert mode only, vim enabled) ---
      if (S['display.vimModeInBars'] && searchVimMode === 'insert' &&
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
  // PLUGIN SYSTEM
  // ============================================

  // ── Plugin State ──
  let _pluginRegistry = new Map();       // pluginId -> { manifest, enabled, instance }
  let _pluginData = {};                  // Persisted state (enabled/disabled, settings, storage)
  let _pluginManagerMode = false;
  let _pluginManagerModal = null;
  let _pluginManagerView = 'list';       // 'list' | 'detail'
  let _pluginManagerDetailId = null;

  // ── Plugin Event Bus ──
  const _pluginEventBus = {
    _listeners: new Map(),
    on(event, callback, pluginId) {
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
    emit(event, data) {
      const set = this._listeners.get(event);
      if (!set || set.size === 0) return;
      for (const { callback } of [...set]) {
        try { callback(data); }
        catch (e) { console.error(`[ZenLeap] Plugin event handler error (${event}):`, e); }
      }
    },
    removeAllForPlugin(pluginId) {
      for (const [, set] of this._listeners) {
        const toRemove = [];
        for (const entry of set) {
          if (entry.pluginId === pluginId) toRemove.push(entry);
        }
        for (const entry of toRemove) set.delete(entry);
      }
    },
  };

  // ── Plugin Data Persistence ──
  function loadPluginData() {
    try {
      if (Services?.prefs?.getPrefType('uc.zenleap.plugins') === Services.prefs.PREF_STRING) {
        _pluginData = JSON.parse(Services.prefs.getStringPref('uc.zenleap.plugins'));
      }
    } catch (e) { _pluginData = {}; }
  }

  let _pluginSaveTimer = null;
  const PLUGIN_STORAGE_QUOTA = 512 * 1024; // 512KB per plugin

  function savePluginData() {
    if (_pluginSaveTimer) return;
    _pluginSaveTimer = setTimeout(() => {
      _pluginSaveTimer = null;
      try {
        const json = JSON.stringify(_pluginData);
        Services.prefs.setStringPref('uc.zenleap.plugins', json);
      } catch (e) {
        console.error('[ZenLeap] Failed to save plugin data:', e);
      }
    }, 500);
  }

  function savePluginDataImmediate() {
    if (_pluginSaveTimer) { clearTimeout(_pluginSaveTimer); _pluginSaveTimer = null; }
    try {
      Services.prefs.setStringPref('uc.zenleap.plugins', JSON.stringify(_pluginData));
    } catch (e) {
      console.error('[ZenLeap] Failed to save plugin data:', e);
    }
  }

  function checkStorageQuota(pluginId) {
    const data = _pluginData[pluginId]?.storage;
    if (!data) return true;
    try {
      const size = JSON.stringify(data).length;
      if (size > PLUGIN_STORAGE_QUOTA) {
        console.warn(`[ZenLeap] Plugin "${pluginId}" storage exceeds quota (${Math.round(size / 1024)}KB / ${PLUGIN_STORAGE_QUOTA / 1024}KB)`);
        return false;
      }
    } catch (e) {}
    return true;
  }

  // ── Scoped Plugin API Factory ──
  // Each plugin gets its own API instance with storage/events scoped to its ID
  function createScopedPluginAPI(pluginId) {
    return {
      // ─── Tab Operations ───
      tabs: {
        getCurrent: () => gBrowser.selectedTab,
        getAll: () => Array.from(gBrowser.tabs).filter(t => !t.hidden && !t.closing),
        getVisible: () => getVisibleTabs(),
        getByIndex: (i) => {
          const tabs = getVisibleTabs();
          return (i >= 0 && i < tabs.length) ? tabs[i] : null;
        },
        findByUrl: (pattern) => {
          const tabs = Array.from(gBrowser.tabs).filter(t => !t.hidden && !t.closing);
          if (pattern instanceof RegExp) return tabs.filter(t => pattern.test(t.linkedBrowser?.currentURI?.spec || ''));
          return tabs.filter(t => (t.linkedBrowser?.currentURI?.spec || '').includes(pattern));
        },
        findByTitle: (pattern) => {
          const tabs = Array.from(gBrowser.tabs).filter(t => !t.hidden && !t.closing);
          if (pattern instanceof RegExp) return tabs.filter(t => pattern.test(t.label || ''));
          return tabs.filter(t => (t.label || '').toLowerCase().includes(pattern.toLowerCase()));
        },
        select: (tab) => { if (tab) gBrowser.selectedTab = tab; },
        close: (tab) => { if (tab) gBrowser.removeTab(tab); },
        closeTabs: (tabs) => {
          if (!tabs?.length) return;
          try { gBrowser.removeTabs(tabs, { animate: true, suppressTabbedBrowserSessionStoreUpdate: false }); }
          catch (e) { for (const t of tabs) { try { gBrowser.removeTab(t); } catch (_) {} } }
        },
        closeOthers: (keepTab) => {
          const keep = keepTab || gBrowser.selectedTab;
          const tabs = getVisibleTabs().filter(t => t !== keep && !t.pinned);
          for (const t of tabs) gBrowser.removeTab(t);
        },
        closeToRight: (fromTab) => {
          const tabs = getVisibleTabs();
          const idx = tabs.indexOf(fromTab || gBrowser.selectedTab);
          if (idx >= 0) for (let i = tabs.length - 1; i > idx; i--) if (!tabs[i].pinned) gBrowser.removeTab(tabs[i]);
        },
        closeToLeft: (fromTab) => {
          const tabs = getVisibleTabs();
          const idx = tabs.indexOf(fromTab || gBrowser.selectedTab);
          if (idx >= 0) for (let i = idx - 1; i >= 0; i--) if (!tabs[i].pinned) gBrowser.removeTab(tabs[i]);
        },
        create: (url) => gBrowser.addTab(url || 'about:newtab', {
          triggeringPrincipal: Services.scriptSecurityManager.createNullPrincipal({}),
        }),
        duplicate: (tab) => gBrowser.duplicateTab(tab || gBrowser.selectedTab),
        move: (tab, toIndex) => {
          const tabs = getVisibleTabs();
          if (toIndex >= 0 && toIndex < tabs.length) {
            const target = tabs[toIndex];
            if (target) gBrowser.moveTabBefore(tab, target);
          }
        },
        pin: (tab) => gBrowser.pinTab(tab || gBrowser.selectedTab),
        unpin: (tab) => gBrowser.unpinTab(tab || gBrowser.selectedTab),
        isPinned: (tab) => (tab || gBrowser.selectedTab).pinned,
        mute: (tab) => { const t = tab || gBrowser.selectedTab; if (!t.hasAttribute('muted')) t.toggleMuteAudio(); },
        unmute: (tab) => { const t = tab || gBrowser.selectedTab; if (t.hasAttribute('muted')) t.toggleMuteAudio(); },
        toggleMute: (tab) => (tab || gBrowser.selectedTab).toggleMuteAudio(),
        isMuted: (tab) => (tab || gBrowser.selectedTab).hasAttribute('muted'),
        reload: (tab) => gBrowser.reloadTab(tab || gBrowser.selectedTab),
        unload: (tab) => {
          const t = tab || gBrowser.selectedTab;
          if (t !== gBrowser.selectedTab) { gBrowser.discardBrowser(t); return; }
          const others = Array.from(gBrowser.tabs).filter(x => x !== t && !x.hidden && !x.hasAttribute('pending'));
          others.sort((a, b) => getTabLastAccessed(b) - getTabLastAccessed(a));
          if (others[0]) gBrowser.selectedTab = others[0];
          setTimeout(() => gBrowser.discardBrowser(t), 500);
        },
        getUrl: (tab) => (tab || gBrowser.selectedTab).linkedBrowser?.currentURI?.spec || '',
        getTitle: (tab) => (tab || gBrowser.selectedTab).label || '',
        getLastAccessed: (tab) => getTabLastAccessed(tab || gBrowser.selectedTab),
        getFavicon: (tab) => (tab || gBrowser.selectedTab).image || '',
        isLoading: (tab) => (tab || gBrowser.selectedTab).hasAttribute('busy'),
        isPending: (tab) => (tab || gBrowser.selectedTab).hasAttribute('pending'),
        isEssential: (tab) => (tab || gBrowser.selectedTab).hasAttribute('zen-essential'),
        addToEssentials: (tab) => {
          try { if (window.gZenPinnedTabManager) gZenPinnedTabManager.addToEssentials(tab || gBrowser.selectedTab); }
          catch (e) {}
        },
        removeFromEssentials: (tab) => {
          try { if (window.gZenPinnedTabManager) gZenPinnedTabManager.removeEssentials(tab || gBrowser.selectedTab); }
          catch (e) {}
        },
        bookmark: (tab) => {
          try { PlacesCommandHook.bookmarkPage(); } catch (e) {}
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
            return all.find(ws => ws.name?.toLowerCase() === name.toLowerCase()) || null;
          } catch (e) { return null; }
        },
        switchTo: (wsOrId) => {
          try {
            const id = typeof wsOrId === 'string' ? wsOrId : wsOrId?.uuid;
            if (id) window.gZenWorkspaces.changeWorkspaceWithID(id);
          } catch (e) {}
        },
        create: async (name) => {
          try {
            if (!window.gZenWorkspaces) return null;
            const ws = { name: name || 'New Workspace' };
            await gZenWorkspaces.createAndSaveWorkspace(ws);
            return ws;
          } catch (e) { return null; }
        },
        delete: async (wsOrId) => {
          try {
            const id = typeof wsOrId === 'string' ? wsOrId : wsOrId?.uuid;
            if (id && window.gZenWorkspaces) {
              if (typeof gZenWorkspaces.removeWorkspace === 'function') await gZenWorkspaces.removeWorkspace(id);
              else if (typeof gZenWorkspaces.deleteWorkspace === 'function') await gZenWorkspaces.deleteWorkspace(id);
            }
          } catch (e) {}
        },
        rename: async (wsOrId, newName) => {
          try {
            const id = typeof wsOrId === 'string' ? wsOrId : wsOrId?.uuid;
            const all = window.gZenWorkspaces?.getWorkspaces() || [];
            const ws = all.find(w => w.uuid === id);
            if (ws) { ws.name = newName; await gZenWorkspaces.saveWorkspace(ws); }
          } catch (e) {}
        },
        moveTabTo: (tab, wsOrId) => {
          try {
            const id = typeof wsOrId === 'string' ? wsOrId : wsOrId?.uuid;
            if (id && window.gZenWorkspaces) gZenWorkspaces.moveTabToWorkspace(tab || gBrowser.selectedTab, id);
          } catch (e) {}
        },
      },

      // ─── Folder Operations ───
      folders: {
        getAll: () => {
          try {
            return Array.from(gBrowser.tabContainer.querySelectorAll('zen-folder'));
          } catch (e) { return []; }
        },
        getByName: (name) => {
          try {
            const folders = gBrowser.tabContainer.querySelectorAll('zen-folder');
            for (const f of folders) {
              if ((f.label || f.getAttribute('zen-folder-name') || '').toLowerCase() === name.toLowerCase()) return f;
            }
          } catch (e) {}
          return null;
        },
        create: (tabs, name) => {
          try {
            if (!window.gZenFolders) return null;
            const validTabs = (tabs || [gBrowser.selectedTab]).filter(t => t && !t.closing && t.parentNode);
            if (validTabs.length === 0) return null;
            gZenFolders.createFolder(validTabs, { label: name || 'New Folder', renameFolder: !name });
            return true;
          } catch (e) { return null; }
        },
        delete: (folder) => {
          try {
            if (typeof folder.delete === 'function') folder.delete();
            else if (typeof gBrowser.removeTabGroup === 'function') gBrowser.removeTabGroup(folder, { isUserTriggered: true });
          } catch (e) {}
        },
        rename: (folder, newName) => {
          try {
            if (folder && newName) {
              folder.label = newName;
              folder.setAttribute('zen-folder-name', newName);
            }
          } catch (e) {}
        },
        getTabs: (folder) => {
          try { return folder?.tabs?.filter(t => !t.hasAttribute('zen-empty-tab')) || []; }
          catch (e) { return []; }
        },
        addTab: (folder, tab) => {
          try {
            if (folder && tab && window.gZenFolders) {
              if (gZenFolders.canDropElement && !gZenFolders.canDropElement(folder, tab)) return false;
              gBrowser.moveTabAfter(tab, folder.tabs?.[folder.tabs.length - 1] || tab);
              return true;
            }
          } catch (e) {}
          return false;
        },
        removeTab: (tab) => {
          try {
            if (tab && window.gZenFolders) gZenFolders.ungroupTabsFromActiveGroups([tab]);
          } catch (e) {}
        },
        setIcon: (folder) => {
          try { if (folder && window.gZenFolders) gZenFolders.changeFolderUserIcon(folder); }
          catch (e) {}
        },
        createSubfolder: (folder) => {
          try { if (folder && window.gZenFolders) gZenFolders.createSubfolder(folder); }
          catch (e) {}
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
          } catch (e) {}
          return false;
        },
        unsplit: () => {
          try { if (window.gZenViewSplitter?.splitViewActive) gZenViewSplitter.unsplitCurrentView(); }
          catch (e) {}
        },
        getLayout: () => {
          try {
            const s = window.gZenViewSplitter;
            if (!s?.splitViewActive) return null;
            return s._data?.[s.currentView]?.layoutTree || null;
          } catch (e) { return null; }
        },
        rotate: () => {
          try { rotateSplitLayout(); } catch (e) {}
        },
      },

      // ─── Marks ───
      marks: {
        set: (char, tab) => setMark(char, tab),
        get: (char) => marks.get(char) || null,
        clear: (char) => { marks.delete(char); updateRelativeNumbers(); },
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
        jumpBack: () => {
          filterJumpList();
          if (jumpListIndex > 0) {
            jumpListIndex--;
            recordingJumps = false;
            gBrowser.selectedTab = jumpList[jumpListIndex];
            recordingJumps = true;
          }
        },
        jumpForward: () => {
          filterJumpList();
          if (jumpListIndex < jumpList.length - 1) {
            jumpListIndex++;
            recordingJumps = false;
            gBrowser.selectedTab = jumpList[jumpListIndex];
            recordingJumps = true;
          }
        },
      },

      // ─── Commands ───
      commands: {
        register: (cmds) => {
          // Register dynamic commands for this plugin
          const entry = _pluginRegistry.get(pluginId);
          if (!entry) return;
          if (!entry._dynamicCommands) entry._dynamicCommands = [];
          const toAdd = Array.isArray(cmds) ? cmds : [cmds];
          for (const cmd of toAdd) {
            entry._dynamicCommands.push(cmd);
          }
          invalidateCommandCache();
        },
        unregister: (cmdKey) => {
          const entry = _pluginRegistry.get(pluginId);
          if (!entry?._dynamicCommands) return;
          entry._dynamicCommands = entry._dynamicCommands.filter(c => c.key !== cmdKey);
          invalidateCommandCache();
        },
        execute: (cmdKey) => {
          const all = getAllCommands();
          const cmd = all.find(c => c.key === cmdKey);
          if (cmd) executeCommand(cmd);
        },
        getAll: () => getAllCommands().map(c => ({ key: c.key, label: c.label, icon: c.icon })),
      },

      // ─── Browser ───
      browser: {
        openUrl: (url, options) => {
          const principal = Services.scriptSecurityManager.createNullPrincipal({});
          if (options?.newTab !== false) {
            return gBrowser.addTab(url, { triggeringPrincipal: principal });
          }
          gBrowser.selectedBrowser.loadURI(Services.io.newURI(url), { triggeringPrincipal: principal });
        },
        getCurrentUrl: () => gBrowser.selectedBrowser?.currentURI?.spec || '',
        goBack: () => { try { gBrowser.selectedBrowser.goBack(); } catch (e) {} },
        goForward: () => { try { gBrowser.selectedBrowser.goForward(); } catch (e) {} },
        reload: () => { try { gBrowser.reloadTab(gBrowser.selectedTab); } catch (e) {} },
        forceReload: () => { try { gBrowser.selectedBrowser.reloadWithFlags(Ci.nsIWebNavigation.LOAD_FLAGS_BYPASS_CACHE); } catch (e) {} },
        zoomIn: () => { try { ZoomManager.enlarge(); } catch (e) {} },
        zoomOut: () => { try { ZoomManager.reduce(); } catch (e) {} },
        zoomReset: () => { try { ZoomManager.reset(); } catch (e) {} },
        getZoom: () => { try { return ZoomManager.zoom; } catch (e) { return 1; } },
        copyToClipboard: (text) => {
          try {
            const cb = Cc['@mozilla.org/widget/clipboardhelper;1'].getService(Ci.nsIClipboardHelper);
            cb.copyString(text);
          } catch (e) {}
        },
        toggleFullscreen: () => { try { BrowserCommands.fullScreen(); } catch (e) {} },
        getSelectedText: () => {
          try {
            const focusedWindow = document.commandDispatcher.focusedWindow;
            const sel = focusedWindow?.getSelection();
            return sel ? sel.toString() : '';
          } catch (e) { return ''; }
        },
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
        showToast: (message, duration) => _pluginShowToast(message, duration),
        showModal: (title, content) => _pluginShowStatsModal(title, content),
        showConfirm: (title, message) => _pluginShowConfirm(title, message),
        showPrompt: (title, placeholder, defaultValue) => _pluginShowPrompt(title, placeholder, defaultValue),
        log: (msg) => { if (CONFIG.debug) console.log(`[ZenLeap:${pluginId}] ${msg}`); },
        getAccentColor: () => S['appearance.accentColor'],
        getThemeColors: () => ({
          accent: S['appearance.accentColor'],
          currentTabBg: S['appearance.currentTabBg'],
          currentTabColor: S['appearance.currentTabColor'],
          badgeBg: S['appearance.badgeBg'],
          badgeColor: S['appearance.badgeColor'],
          markColor: S['appearance.markColor'],
          highlightBorder: S['appearance.highlightBorder'],
          selectedBorder: S['appearance.selectedBorder'],
        }),
      },

      // ─── Scoped Storage ───
      storage: {
        get: (key, defaultValue) => {
          const pd = _pluginData[pluginId];
          return pd?.storage?.[key] ?? defaultValue;
        },
        set: (key, value) => {
          if (!_pluginData[pluginId]) _pluginData[pluginId] = {};
          if (!_pluginData[pluginId].storage) _pluginData[pluginId].storage = {};
          _pluginData[pluginId].storage[key] = value;
          if (!checkStorageQuota(pluginId)) {
            delete _pluginData[pluginId].storage[key];
            log(`Plugin "${pluginId}" storage.set rejected: quota exceeded`);
            return;
          }
          savePluginData();
        },
        remove: (key) => {
          if (_pluginData[pluginId]?.storage) {
            delete _pluginData[pluginId].storage[key];
            savePluginData();
          }
        },
        getAll: () => _pluginData[pluginId]?.storage ? { ..._pluginData[pluginId].storage } : {},
        clear: () => {
          if (_pluginData[pluginId]) _pluginData[pluginId].storage = {};
          savePluginData();
        },
      },

      // ─── Scoped Events ───
      events: {
        on: (event, callback) => _pluginEventBus.on(event, callback, pluginId),
        off: (event, callback) => _pluginEventBus.off(event, callback, pluginId),
        once: (event, callback) => _pluginEventBus.once(event, callback, pluginId),
      },

      // ─── Plugin Settings (plugin's own settings from manifest) ───
      settings: {
        get: (key) => S[key], // Read ZenLeap settings (read-only)
        getOwn: (key, defaultValue) => {
          const pd = _pluginData[pluginId];
          if (pd?.settings?.[key] !== undefined) return pd.settings[key];
          // Fall back to manifest default
          const entry = _pluginRegistry.get(pluginId);
          const schema = entry?.manifest?.settings?.[key];
          return schema?.default ?? defaultValue;
        },
        setOwn: (key, value) => {
          if (!_pluginData[pluginId]) _pluginData[pluginId] = {};
          if (!_pluginData[pluginId].settings) _pluginData[pluginId].settings = {};
          _pluginData[pluginId].settings[key] = value;
          savePluginData();
          _pluginEventBus.emit('plugin:settingChanged', { pluginId, key, value });
        },
        getOwnSchema: () => {
          const entry = _pluginRegistry.get(pluginId);
          return entry?.manifest?.settings || {};
        },
      },

      // ─── File I/O (sandboxed to plugin data directory) ───
      fs: (() => {
        const pluginDataDir = PathUtils.join(PathUtils.profileDir, 'chrome', 'zenleap-plugins', pluginId, 'data');
        const resolvePath = (rel) => {
          const resolved = PathUtils.join(pluginDataDir, rel);
          // Prevent path traversal: resolved path must start with pluginDataDir
          if (!resolved.startsWith(pluginDataDir)) {
            throw new Error('Path traversal not allowed');
          }
          return resolved;
        };
        return {
          readText: async (rel) => {
            try { return await IOUtils.readUTF8(resolvePath(rel)); } catch (e) { return null; }
          },
          writeText: async (rel, content) => {
            try {
              const p = resolvePath(rel);
              await IOUtils.makeDirectory(PathUtils.parent(p), { ignoreExisting: true });
              await IOUtils.writeUTF8(p, content);
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
              await IOUtils.writeUTF8(p, JSON.stringify(data));
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
              const abs = await IOUtils.getChildren(resolvePath(rel || '.'));
              return abs.map(p => p.split('/').pop().split('\\').pop());
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

  // ── Plugin Toast ──
  let _pluginToastTimer = null;
  function _pluginShowToast(message, duration = 3000) {
    let toast = document.getElementById('zenleap-plugin-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'zenleap-plugin-toast';
      document.documentElement.appendChild(toast);
    }
    toast.textContent = message;
    toast.style.cssText = `
      position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%);
      background: rgba(30, 30, 35, 0.95); color: #e0e0e0; padding: 10px 20px;
      border-radius: 8px; font-size: 13px; z-index: 100010;
      border: 1px solid rgba(97, 175, 239, 0.3);
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
      animation: zenleap-toast-in 0.2s ease-out;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;
    toast.style.display = 'block';
    clearTimeout(_pluginToastTimer);
    _pluginToastTimer = setTimeout(() => { toast.style.display = 'none'; }, duration);
  }

  // ── Confirm Dialog ──
  function _pluginShowConfirm(title, message) {
    return new Promise((resolve) => {
      const modal = document.createElement('div');
      modal.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
        z-index: 100010; display: flex; justify-content: center; align-items: center;
      `;
      const backdrop = document.createElement('div');
      backdrop.style.cssText = `
        position: absolute; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0,0,0,0.6); backdrop-filter: blur(6px);
      `;
      const card = document.createElement('div');
      card.style.cssText = `
        position: relative; width: 90%; max-width: 400px;
        background: rgba(25,25,30,0.98); border-radius: 14px;
        box-shadow: 0 12px 48px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.1);
        padding: 24px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      `;
      const h = document.createElement('h3');
      h.textContent = title;
      h.style.cssText = 'margin: 0 0 12px; font-size: 16px; color: #61afef;';
      const p = document.createElement('p');
      p.textContent = message;
      p.style.cssText = 'margin: 0 0 20px; font-size: 13px; color: #ccc; line-height: 1.5;';
      const btns = document.createElement('div');
      btns.style.cssText = 'display: flex; justify-content: flex-end; gap: 8px;';
      const cancel = document.createElement('button');
      cancel.textContent = 'Cancel';
      cancel.style.cssText = 'background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12); color: #aaa; padding: 6px 16px; border-radius: 6px; cursor: pointer; font-size: 13px; font-family: inherit;';
      const confirm = document.createElement('button');
      confirm.textContent = 'Confirm';
      confirm.style.cssText = 'background: rgba(97,175,239,0.2); border: 1px solid rgba(97,175,239,0.4); color: #61afef; padding: 6px 16px; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 600; font-family: inherit;';
      const close = (result) => { modal.remove(); window.removeEventListener('keydown', esc, true); resolve(result); };
      const esc = (e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(false); } };
      window.addEventListener('keydown', esc, true);
      backdrop.addEventListener('click', () => close(false));
      cancel.addEventListener('click', () => close(false));
      confirm.addEventListener('click', () => close(true));
      btns.appendChild(cancel);
      btns.appendChild(confirm);
      card.appendChild(h);
      card.appendChild(p);
      card.appendChild(btns);
      modal.appendChild(backdrop);
      modal.appendChild(card);
      document.documentElement.appendChild(modal);
    });
  }

  // ── Prompt Dialog ──
  function _pluginShowPrompt(title, placeholder, defaultValue) {
    return new Promise((resolve) => {
      const modal = document.createElement('div');
      modal.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
        z-index: 100010; display: flex; justify-content: center; align-items: center;
      `;
      const backdrop = document.createElement('div');
      backdrop.style.cssText = `
        position: absolute; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0,0,0,0.6); backdrop-filter: blur(6px);
      `;
      const card = document.createElement('div');
      card.style.cssText = `
        position: relative; width: 90%; max-width: 420px;
        background: rgba(25,25,30,0.98); border-radius: 14px;
        box-shadow: 0 12px 48px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.1);
        padding: 24px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      `;
      const h = document.createElement('h3');
      h.textContent = title;
      h.style.cssText = 'margin: 0 0 16px; font-size: 16px; color: #61afef;';
      const input = document.createElement('input');
      input.type = 'text';
      input.value = defaultValue || '';
      input.placeholder = placeholder || '';
      input.style.cssText = `
        width: 100%; box-sizing: border-box; padding: 10px 14px; margin-bottom: 20px;
        background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.12);
        border-radius: 8px; color: #e0e0e0; font-size: 14px; outline: none;
        font-family: inherit;
      `;
      input.addEventListener('focus', () => { input.style.borderColor = '#61afef'; });
      input.addEventListener('blur', () => { input.style.borderColor = 'rgba(255,255,255,0.12)'; });
      const btns = document.createElement('div');
      btns.style.cssText = 'display: flex; justify-content: flex-end; gap: 8px;';
      const cancel = document.createElement('button');
      cancel.textContent = 'Cancel';
      cancel.style.cssText = 'background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12); color: #aaa; padding: 6px 16px; border-radius: 6px; cursor: pointer; font-size: 13px; font-family: inherit;';
      const ok = document.createElement('button');
      ok.textContent = 'OK';
      ok.style.cssText = 'background: rgba(97,175,239,0.2); border: 1px solid rgba(97,175,239,0.4); color: #61afef; padding: 6px 16px; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 600; font-family: inherit;';
      const close = (val) => { modal.remove(); window.removeEventListener('keydown', keyHandler, true); resolve(val); };
      const keyHandler = (e) => {
        if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(null); }
        if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); close(input.value); }
      };
      window.addEventListener('keydown', keyHandler, true);
      backdrop.addEventListener('click', () => close(null));
      cancel.addEventListener('click', () => close(null));
      ok.addEventListener('click', () => close(input.value));
      btns.appendChild(cancel);
      btns.appendChild(ok);
      card.appendChild(h);
      card.appendChild(input);
      card.appendChild(btns);
      modal.appendChild(backdrop);
      modal.appendChild(card);
      document.documentElement.appendChild(modal);
      setTimeout(() => input.focus(), 50);
    });
  }

  // ── Stats/Content Modal (shared) ──
  function _pluginShowStatsModal(title, content) {
    const existing = document.getElementById('zenleap-plugin-stats-modal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'zenleap-plugin-stats-modal';
    modal.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
      z-index: 100010; display: flex; justify-content: center; align-items: center; padding: 20px;
    `;
    const handler = (e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeModal(); } };
    const closeModal = () => { modal.remove(); window.removeEventListener('keydown', handler, true); };

    const backdrop = document.createElement('div');
    backdrop.style.cssText = `position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.6); backdrop-filter: blur(6px);`;
    backdrop.addEventListener('click', closeModal);

    const card = document.createElement('div');
    card.style.cssText = `
      position: relative; width: 90%; max-width: 520px; max-height: 70vh;
      background: rgba(25,25,30,0.98); border-radius: 14px;
      box-shadow: 0 12px 48px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.1);
      overflow: hidden; display: flex; flex-direction: column;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;
    const hdr = document.createElement('div');
    hdr.style.cssText = 'padding: 18px 22px 14px; border-bottom: 1px solid rgba(255,255,255,0.1); display: flex; justify-content: space-between; align-items: center;';
    const h2 = document.createElement('h2');
    h2.textContent = title;
    h2.style.cssText = 'margin: 0; font-size: 18px; font-weight: 700; color: #61afef;';
    const closeBtn = document.createElement('button');
    closeBtn.textContent = '\u2715';
    closeBtn.style.cssText = 'background: none; border: none; color: #666; font-size: 16px; cursor: pointer; padding: 4px 8px; border-radius: 4px;';
    closeBtn.addEventListener('click', closeModal);
    hdr.appendChild(h2);
    hdr.appendChild(closeBtn);
    const body = document.createElement('div');
    body.style.cssText = `padding: 18px 22px; overflow-y: auto; flex: 1; font-size: 13px; color: #ccc; white-space: pre-wrap; font-family: 'SF Mono', 'Fira Code', monospace; line-height: 1.6;`;
    body.textContent = content;
    const ftr = document.createElement('div');
    ftr.style.cssText = 'padding: 12px 22px; border-top: 1px solid rgba(255,255,255,0.08); text-align: center; font-size: 11px; color: #555;';
    ftr.textContent = 'Press Escape or click outside to close';
    card.appendChild(hdr);
    card.appendChild(body);
    card.appendChild(ftr);
    modal.appendChild(backdrop);
    modal.appendChild(card);
    window.addEventListener('keydown', handler, true);
    document.documentElement.appendChild(modal);
  }

  // ── Plugin Lifecycle ──
  function registerPlugin(manifest) {
    if (!manifest?.id || !manifest?.name) { log('Plugin registration failed: missing id or name'); return false; }
    if (!/^[a-zA-Z0-9_-]+$/.test(manifest.id)) { log(`Plugin registration failed: invalid id "${manifest.id}"`); return false; }
    if (_pluginRegistry.has(manifest.id)) { log(`Plugin "${manifest.id}" already registered`); return false; }

    // Validate commands array if present
    if (manifest.commands && Array.isArray(manifest.commands)) {
      manifest.commands = manifest.commands.filter(cmd => {
        if (!cmd.key || typeof cmd.key !== 'string') { log(`Plugin "${manifest.id}": skipping command with missing key`); return false; }
        if (cmd.tags && !Array.isArray(cmd.tags)) cmd.tags = [];
        return true;
      });
    } else if (manifest.commands) {
      manifest.commands = [];
    }

    if (!_pluginData[manifest.id]) {
      _pluginData[manifest.id] = { enabled: true, storage: {}, settings: {} };
      savePluginData();
    }

    const entry = {
      manifest,
      enabled: _pluginData[manifest.id].enabled !== false,
      instance: null,
      _dynamicCommands: [],
    };

    _pluginRegistry.set(manifest.id, entry);

    if (entry.enabled && manifest.init) {
      try {
        const api = createScopedPluginAPI(manifest.id);
        entry.instance = manifest.init(api) || {};
        log(`Plugin "${manifest.name}" initialized`);
      } catch (e) {
        console.error(`[ZenLeap] Plugin "${manifest.name}" init failed:`, e);
        entry.instance = null;
      }
    }

    invalidateCommandCache();
    _pluginEventBus.emit('plugin:registered', { pluginId: manifest.id, name: manifest.name });
    return true;
  }

  function unregisterPlugin(pluginId) {
    const entry = _pluginRegistry.get(pluginId);
    if (!entry) return false;

    if (entry.instance?.destroy) { try { entry.instance.destroy(); } catch (e) {} }
    if (entry.manifest.destroy) {
      try { entry.manifest.destroy(createScopedPluginAPI(pluginId)); } catch (e) {}
    }

    _pluginEventBus.emit('plugin:unregistered', { pluginId });
    _pluginEventBus.removeAllForPlugin(pluginId);
    _pluginRegistry.delete(pluginId);
    delete _pluginData[pluginId];
    savePluginDataImmediate();
    invalidateCommandCache();
    return true;
  }

  function enablePlugin(pluginId) {
    const entry = _pluginRegistry.get(pluginId);
    if (!entry || entry.enabled) return;

    entry.enabled = true;
    _pluginData[pluginId] = _pluginData[pluginId] || {};
    _pluginData[pluginId].enabled = true;
    savePluginData();

    if (entry.manifest.init) {
      try {
        const api = createScopedPluginAPI(pluginId);
        entry.instance = entry.manifest.init(api) || {};
      } catch (e) {
        console.error(`[ZenLeap] Plugin "${entry.manifest.name}" init failed:`, e);
        entry.instance = null;
      }
    }

    invalidateCommandCache();
    _pluginEventBus.emit('plugin:enabled', { pluginId });
    log(`Plugin "${entry.manifest.name}" enabled`);
  }

  function disablePlugin(pluginId) {
    const entry = _pluginRegistry.get(pluginId);
    if (!entry || !entry.enabled) return;

    if (entry.instance?.destroy) { try { entry.instance.destroy(); } catch (e) {} }
    if (entry.manifest.destroy) {
      try { entry.manifest.destroy(createScopedPluginAPI(pluginId)); } catch (e) {}
    }

    _pluginEventBus.emit('plugin:disabled', { pluginId });
    _pluginEventBus.removeAllForPlugin(pluginId);
    entry.enabled = false;
    entry.instance = null;
    entry._dynamicCommands = [];
    _pluginData[pluginId] = _pluginData[pluginId] || {};
    _pluginData[pluginId].enabled = false;
    savePluginDataImmediate();

    invalidateCommandCache();
    log(`Plugin "${entry.manifest.name}" disabled`);
  }

  // ── Get Plugin Commands ──
  function getPluginCommands() {
    const commands = [];
    for (const [pluginId, entry] of _pluginRegistry) {
      if (!entry.enabled) continue;

      // Commands from manifest
      if (entry.manifest.commands) {
        for (const cmd of entry.manifest.commands) {
          const cmdImpl = entry.instance?.commands?.[cmd.key];
          commands.push({
            key: `plugin:${pluginId}:${cmd.key}`,
            label: cmd.label,
            icon: cmd.icon || entry.manifest.icon || '🧩',
            tags: [...(cmd.tags || []), 'plugin', pluginId, entry.manifest.name.toLowerCase()],
            group: entry.manifest.name,
            condition: cmd.condition,
            command: cmdImpl || cmd.command,
            subFlow: cmd.subFlow,
          });
        }
      }

      // Dynamic commands registered at runtime
      if (entry._dynamicCommands) {
        for (const cmd of entry._dynamicCommands) {
          commands.push({
            key: `plugin:${pluginId}:dyn:${cmd.key}`,
            label: cmd.label,
            icon: cmd.icon || entry.manifest.icon || '🧩',
            tags: [...(cmd.tags || []), 'plugin', pluginId, entry.manifest.name.toLowerCase()],
            group: entry.manifest.name,
            condition: cmd.condition,
            command: cmd.command,
          });
        }
      }
    }
    return commands;
  }

  function getRegisteredPlugins() {
    const plugins = [];
    for (const [id, entry] of _pluginRegistry) {
      plugins.push({
        id,
        name: entry.manifest.name,
        version: entry.manifest.version || '1.0.0',
        description: entry.manifest.description || '',
        author: entry.manifest.author || 'Unknown',
        icon: entry.manifest.icon || '🧩',
        enabled: entry.enabled,
        commandCount: (entry.manifest.commands?.length || 0) + (entry._dynamicCommands?.length || 0),
        builtIn: !!entry.manifest.builtIn,
        hasSettings: !!(entry.manifest.settings && Object.keys(entry.manifest.settings).length > 0),
      });
    }
    return plugins;
  }

  // ── External Plugin Loader ──
  async function getPluginsDirectory() {
    const dir = PathUtils.join(PathUtils.profileDir, 'chrome', 'zenleap-plugins');
    try { await IOUtils.makeDirectory(dir, { ignoreExisting: true }); }
    catch (e) { log(`Failed to create plugins directory: ${e}`); }
    return dir;
  }

  async function loadExternalPlugins() {
    const dir = await getPluginsDirectory();
    let children;
    try { children = await IOUtils.getChildren(dir); }
    catch (e) { log(`Failed to list plugins directory: ${e}`); return; }

    for (const childPath of children) {
      try {
        const stat = await IOUtils.stat(childPath);
        if (stat.type !== 'directory') continue;

        const manifestPath = PathUtils.join(childPath, 'manifest.json');
        let manifestText;
        try { manifestText = await IOUtils.readUTF8(manifestPath); }
        catch (e) { continue; } // No manifest, skip

        const manifest = JSON.parse(manifestText);
        if (!manifest.id || !manifest.name) { log(`Skipping plugin at ${childPath}: missing id or name`); continue; }

        // Check version compatibility
        if (manifest.minZenLeapVersion && !versionGte(VERSION, manifest.minZenLeapVersion)) {
          log(`Skipping plugin "${manifest.name}": requires ZenLeap v${manifest.minZenLeapVersion}+`);
          continue;
        }

        // Verify plugin script exists
        const pluginPath = PathUtils.join(childPath, 'plugin.js');
        try { await IOUtils.stat(pluginPath); }
        catch (e) { log(`Skipping plugin "${manifest.name}": no plugin.js found`); continue; }

        // Execute plugin in a controlled scope
        const scope = {};
        try {
          const fileUri = PathUtils.toFileURI(pluginPath);
          Services.scriptloader.loadSubScript(fileUri, scope);
        } catch (e) {
          console.error(`[ZenLeap] Failed to load plugin "${manifest.name}":`, e);
          continue;
        }

        // Merge the manifest with plugin exports
        const pluginExport = scope.ZenLeapPlugin || {};
        const fullManifest = {
          ...manifest,
          init: pluginExport.init ? pluginExport.init.bind(pluginExport) : null,
          destroy: pluginExport.destroy ? pluginExport.destroy.bind(pluginExport) : null,
          _path: childPath,
        };

        // Commands from manifest get their implementations from plugin exports
        if (fullManifest.commands && pluginExport.commands) {
          for (const cmd of fullManifest.commands) {
            if (pluginExport.commands[cmd.key]) {
              cmd.command = pluginExport.commands[cmd.key];
            }
          }
        }

        registerPlugin(fullManifest);
        log(`Loaded external plugin: ${manifest.name} v${manifest.version || '1.0.0'}`);
      } catch (e) {
        console.error(`[ZenLeap] Error loading plugin from ${childPath}:`, e);
      }
    }
  }

  // Uninstall an external plugin (remove files)
  async function uninstallExternalPlugin(pluginId) {
    const entry = _pluginRegistry.get(pluginId);
    if (!entry || entry.manifest.builtIn) return false;

    const pluginPath = entry.manifest._path;
    unregisterPlugin(pluginId);

    if (pluginPath) {
      try {
        await IOUtils.remove(pluginPath, { recursive: true });
        log(`Removed plugin files: ${pluginPath}`);
      } catch (e) { log(`Failed to remove plugin files: ${e}`); }
    }
    return true;
  }

  // Install a plugin from a directory path (copy to plugins dir)
  async function installPluginFromPath(sourcePath) {
    try {
      const manifestText = await IOUtils.readUTF8(PathUtils.join(sourcePath, 'manifest.json'));
      const manifest = JSON.parse(manifestText);
      if (!manifest.id || !manifest.name) return { success: false, error: 'Invalid manifest' };

      const destDir = PathUtils.join(await getPluginsDirectory(), manifest.id);
      await IOUtils.makeDirectory(destDir, { ignoreExisting: true });

      // Copy all files recursively
      async function copyDir(src, dest) {
        await IOUtils.makeDirectory(dest, { ignoreExisting: true });
        const children = await IOUtils.getChildren(src);
        for (const child of children) {
          const stat = await IOUtils.stat(child);
          const name = child.split('/').pop().split('\\').pop();
          if (stat.type === 'directory') {
            await copyDir(child, PathUtils.join(dest, name));
          } else {
            const content = await IOUtils.read(child);
            await IOUtils.write(PathUtils.join(dest, name), content);
          }
        }
      }
      await copyDir(sourcePath, destDir);

      // Load the plugin
      await loadExternalPlugins();
      return { success: true, pluginId: manifest.id, name: manifest.name };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  // ============================================
  // PLUGIN MANAGER UI
  // ============================================

  function createPluginManagerModal() {
    if (_pluginManagerModal) return;

    const modal = document.createElement('div');
    modal.id = 'zenleap-plugin-manager-modal';
    const backdrop = document.createElement('div');
    backdrop.id = 'zenleap-plugin-manager-backdrop';
    backdrop.addEventListener('click', () => exitPluginManagerMode());
    const container = document.createElement('div');
    container.id = 'zenleap-plugin-manager-container';
    modal.appendChild(backdrop);
    modal.appendChild(container);

    const style = document.createElement('style');
    style.id = 'zenleap-plugin-manager-styles';
    style.textContent = `
      #zenleap-plugin-manager-modal { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; z-index: 100003; display: none; justify-content: center; align-items: center; padding: 20px; }
      #zenleap-plugin-manager-modal.active { display: flex; }
      #zenleap-plugin-manager-backdrop { position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.7); backdrop-filter: blur(8px); }
      #zenleap-plugin-manager-container { position: relative; width: 95%; max-width: 680px; max-height: 80vh; background: rgba(25,25,30,0.98); border-radius: 16px; box-shadow: 0 12px 48px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.1); overflow: hidden; display: flex; flex-direction: column; animation: zenleap-settings-appear 0.2s ease-out; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
      .zenleap-pm-header { padding: 20px 24px 16px; border-bottom: 1px solid rgba(255,255,255,0.1); display: flex; justify-content: space-between; align-items: center; }
      .zenleap-pm-header h1 { margin: 0; font-size: 20px; font-weight: 700; color: #61afef; }
      .zenleap-pm-subtitle { display: block; margin-top: 3px; font-size: 11px; color: #666; }
      .zenleap-pm-close { background: none; border: none; color: #666; font-size: 18px; cursor: pointer; padding: 4px 8px; border-radius: 4px; transition: all 0.15s; }
      .zenleap-pm-close:hover { color: #e0e0e0; background: rgba(255,255,255,0.1); }
      .zenleap-pm-body { flex: 1; overflow-y: auto; padding: 8px 0; }
      .zenleap-pm-body::-webkit-scrollbar { width: 8px; }
      .zenleap-pm-body::-webkit-scrollbar-track { background: transparent; }
      .zenleap-pm-body::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 4px; }
      .zenleap-pm-plugin-card { display: flex; align-items: center; gap: 14px; padding: 14px 24px; transition: background 0.12s; cursor: pointer; }
      .zenleap-pm-plugin-card:hover { background: rgba(255,255,255,0.04); }
      .zenleap-pm-plugin-icon { font-size: 28px; width: 44px; height: 44px; display: flex; align-items: center; justify-content: center; background: rgba(97,175,239,0.08); border-radius: 10px; flex-shrink: 0; }
      .zenleap-pm-plugin-info { flex: 1; min-width: 0; }
      .zenleap-pm-plugin-name { font-size: 14px; font-weight: 600; color: #e0e0e0; display: flex; align-items: center; gap: 8px; }
      .zenleap-pm-badge { font-size: 9px; font-weight: 600; padding: 2px 6px; border-radius: 4px; text-transform: uppercase; letter-spacing: 0.5px; }
      .zenleap-pm-badge-builtin { background: rgba(97,175,239,0.15); color: #61afef; }
      .zenleap-pm-badge-version { background: rgba(255,255,255,0.06); color: #888; }
      .zenleap-pm-badge-external { background: rgba(152,195,121,0.15); color: #98c379; }
      .zenleap-pm-plugin-desc { font-size: 12px; color: #888; margin-top: 3px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .zenleap-pm-plugin-meta { font-size: 11px; color: #555; margin-top: 3px; }
      .zenleap-pm-plugin-actions { display: flex; gap: 6px; flex-shrink: 0; }
      .zenleap-pm-toggle-btn { padding: 6px 14px; border-radius: 6px; font-size: 12px; font-weight: 500; cursor: pointer; transition: all 0.15s; border: 1px solid; font-family: inherit; }
      .zenleap-pm-toggle-btn.enabled { background: rgba(97,175,239,0.15); border-color: rgba(97,175,239,0.3); color: #61afef; }
      .zenleap-pm-toggle-btn.enabled:hover { background: rgba(224,108,117,0.15); border-color: rgba(224,108,117,0.3); color: #e06c75; }
      .zenleap-pm-toggle-btn.disabled { background: rgba(255,255,255,0.04); border-color: rgba(255,255,255,0.12); color: #888; }
      .zenleap-pm-toggle-btn.disabled:hover { background: rgba(152,195,121,0.15); border-color: rgba(152,195,121,0.3); color: #98c379; }
      .zenleap-pm-uninstall-btn { background: none; border: 1px solid rgba(224,108,117,0.2); color: #e06c75; padding: 6px 10px; border-radius: 6px; font-size: 12px; cursor: pointer; transition: all 0.15s; font-family: inherit; }
      .zenleap-pm-uninstall-btn:hover { background: rgba(224,108,117,0.15); border-color: rgba(224,108,117,0.4); }
      .zenleap-pm-empty { padding: 40px 20px; text-align: center; color: #555; font-size: 14px; }
      .zenleap-pm-footer { padding: 12px 24px; border-top: 1px solid rgba(255,255,255,0.08); display: flex; justify-content: space-between; align-items: center; font-size: 11px; color: #555; }
      .zenleap-pm-footer-hint { font-style: italic; }
      .zenleap-pm-detail-header { padding: 20px 24px 16px; border-bottom: 1px solid rgba(255,255,255,0.1); }
      .zenleap-pm-detail-back { background: none; border: none; color: #888; font-size: 13px; cursor: pointer; padding: 4px 0; margin-bottom: 8px; display: flex; align-items: center; gap: 4px; font-family: inherit; }
      .zenleap-pm-detail-back:hover { color: #61afef; }
      .zenleap-pm-detail-title { display: flex; align-items: center; gap: 12px; }
      .zenleap-pm-detail-icon { font-size: 32px; width: 48px; height: 48px; display: flex; align-items: center; justify-content: center; background: rgba(97,175,239,0.08); border-radius: 12px; }
      .zenleap-pm-detail-name { font-size: 20px; font-weight: 700; color: #e0e0e0; margin: 0; }
      .zenleap-pm-detail-author { font-size: 12px; color: #888; margin-top: 2px; }
      .zenleap-pm-detail-body { padding: 20px 24px; overflow-y: auto; flex: 1; }
      .zenleap-pm-detail-section { margin-bottom: 20px; }
      .zenleap-pm-detail-section h3 { font-size: 11px; font-weight: 600; color: #61afef; text-transform: uppercase; letter-spacing: 0.8px; margin: 0 0 10px; }
      .zenleap-pm-detail-desc { font-size: 13px; color: #ccc; line-height: 1.5; }
      .zenleap-pm-cmd-row { display: flex; align-items: center; gap: 10px; padding: 8px 12px; border-radius: 8px; background: rgba(255,255,255,0.02); margin-bottom: 4px; }
      .zenleap-pm-cmd-icon { font-size: 16px; width: 24px; text-align: center; }
      .zenleap-pm-cmd-label { font-size: 13px; color: #e0e0e0; }
      .zenleap-pm-cmd-tags { font-size: 11px; color: #555; margin-left: auto; }
      .zenleap-pm-setting-row { display: flex; align-items: center; gap: 12px; padding: 8px 12px; border-radius: 8px; }
      .zenleap-pm-setting-row:hover { background: rgba(255,255,255,0.03); }
      .zenleap-pm-setting-label { flex: 1; }
      .zenleap-pm-setting-name { font-size: 13px; font-weight: 500; color: #e0e0e0; }
      .zenleap-pm-setting-desc { font-size: 11px; color: #666; margin-top: 2px; }
      .zenleap-pm-path-info { font-size: 11px; color: #555; font-family: monospace; word-break: break-all; background: rgba(255,255,255,0.03); padding: 8px 12px; border-radius: 6px; margin-top: 8px; }
    `;
    document.head.appendChild(style);
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

  function renderPluginList(container) {
    const header = document.createElement('div');
    header.className = 'zenleap-pm-header';
    const headerLeft = document.createElement('div');
    const h1 = document.createElement('h1');
    h1.textContent = 'Plugins';
    const sub = document.createElement('span');
    sub.className = 'zenleap-pm-subtitle';
    sub.textContent = 'Manage ZenLeap plugins';
    headerLeft.appendChild(h1);
    headerLeft.appendChild(sub);
    header.appendChild(headerLeft);
    const closeBtn = document.createElement('button');
    closeBtn.className = 'zenleap-pm-close';
    closeBtn.textContent = '\u2715';
    closeBtn.addEventListener('click', () => exitPluginManagerMode());
    header.appendChild(closeBtn);

    const body = document.createElement('div');
    body.className = 'zenleap-pm-body';
    const plugins = getRegisteredPlugins();
    if (plugins.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'zenleap-pm-empty';
      empty.textContent = 'No plugins installed';
      body.appendChild(empty);
    } else {
      for (const plugin of plugins) {
        const card = document.createElement('div');
        card.className = 'zenleap-pm-plugin-card';
        const icon = document.createElement('div');
        icon.className = 'zenleap-pm-plugin-icon';
        icon.textContent = plugin.icon;
        const info = document.createElement('div');
        info.className = 'zenleap-pm-plugin-info';
        info.addEventListener('click', () => { _pluginManagerView = 'detail'; _pluginManagerDetailId = plugin.id; renderPluginManagerContent(); });
        const nameRow = document.createElement('div');
        nameRow.className = 'zenleap-pm-plugin-name';
        nameRow.appendChild(document.createTextNode(plugin.name));
        const vBadge = document.createElement('span');
        vBadge.className = 'zenleap-pm-badge zenleap-pm-badge-version';
        vBadge.textContent = `v${plugin.version}`;
        nameRow.appendChild(vBadge);
        if (plugin.builtIn) { const b = document.createElement('span'); b.className = 'zenleap-pm-badge zenleap-pm-badge-builtin'; b.textContent = 'Built-in'; nameRow.appendChild(b); }
        else { const b = document.createElement('span'); b.className = 'zenleap-pm-badge zenleap-pm-badge-external'; b.textContent = 'External'; nameRow.appendChild(b); }
        const desc = document.createElement('div');
        desc.className = 'zenleap-pm-plugin-desc';
        desc.textContent = plugin.description;
        const meta = document.createElement('div');
        meta.className = 'zenleap-pm-plugin-meta';
        meta.textContent = `${plugin.commandCount} command${plugin.commandCount !== 1 ? 's' : ''} · by ${plugin.author}`;
        info.appendChild(nameRow);
        info.appendChild(desc);
        info.appendChild(meta);
        const actions = document.createElement('div');
        actions.className = 'zenleap-pm-plugin-actions';
        const toggleBtn = document.createElement('button');
        toggleBtn.className = `zenleap-pm-toggle-btn ${plugin.enabled ? 'enabled' : 'disabled'}`;
        toggleBtn.textContent = plugin.enabled ? 'Enabled' : 'Disabled';
        toggleBtn.addEventListener('click', (e) => { e.stopPropagation(); if (plugin.enabled) disablePlugin(plugin.id); else enablePlugin(plugin.id); renderPluginManagerContent(); });
        actions.appendChild(toggleBtn);
        if (!plugin.builtIn) {
          const unBtn = document.createElement('button');
          unBtn.className = 'zenleap-pm-uninstall-btn';
          unBtn.textContent = 'Uninstall';
          unBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const confirmed = await _pluginShowConfirm('Uninstall Plugin', `Uninstall "${plugin.name}"? This will remove all plugin files and data.`);
            if (!confirmed) return;
            await uninstallExternalPlugin(plugin.id);
            renderPluginManagerContent();
          });
          actions.appendChild(unBtn);
        }
        card.appendChild(icon);
        card.appendChild(info);
        card.appendChild(actions);
        body.appendChild(card);
      }
    }

    const footer = document.createElement('div');
    footer.className = 'zenleap-pm-footer';
    const fLeft = document.createElement('span');
    fLeft.textContent = `${plugins.length} plugin${plugins.length !== 1 ? 's' : ''} installed`;
    footer.appendChild(fLeft);
    const fRight = document.createElement('span');
    fRight.className = 'zenleap-pm-footer-hint';
    fRight.textContent = 'Loading...';
    getPluginsDirectory().then(dir => { fRight.textContent = `Plugins dir: ${dir}`; });
    footer.appendChild(fRight);

    container.appendChild(header);
    container.appendChild(body);
    container.appendChild(footer);
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
    backBtn.textContent = '\u2190 Back to plugins';
    backBtn.addEventListener('click', () => { _pluginManagerView = 'list'; _pluginManagerDetailId = null; renderPluginManagerContent(); });
    const titleRow = document.createElement('div');
    titleRow.className = 'zenleap-pm-detail-title';
    const iconEl = document.createElement('div');
    iconEl.className = 'zenleap-pm-detail-icon';
    iconEl.textContent = manifest.icon || '🧩';
    const titleInfo = document.createElement('div');
    const nameEl = document.createElement('h2');
    nameEl.className = 'zenleap-pm-detail-name';
    nameEl.textContent = manifest.name;
    const authorEl = document.createElement('div');
    authorEl.className = 'zenleap-pm-detail-author';
    authorEl.textContent = `v${manifest.version || '1.0.0'} · by ${manifest.author || 'Unknown'}`;
    titleInfo.appendChild(nameEl);
    titleInfo.appendChild(authorEl);
    titleRow.appendChild(iconEl);
    titleRow.appendChild(titleInfo);
    header.appendChild(backBtn);
    header.appendChild(titleRow);

    const body = document.createElement('div');
    body.className = 'zenleap-pm-detail-body';

    // Description
    if (manifest.description) {
      const sec = document.createElement('div');
      sec.className = 'zenleap-pm-detail-section';
      const h3 = document.createElement('h3');
      h3.textContent = 'Description';
      const p = document.createElement('p');
      p.className = 'zenleap-pm-detail-desc';
      p.textContent = manifest.description;
      sec.appendChild(h3);
      sec.appendChild(p);
      body.appendChild(sec);
    }

    // Commands
    if (manifest.commands?.length > 0) {
      const sec = document.createElement('div');
      sec.className = 'zenleap-pm-detail-section';
      const h3 = document.createElement('h3');
      h3.textContent = `Commands (${manifest.commands.length})`;
      sec.appendChild(h3);
      for (const cmd of manifest.commands) {
        const row = document.createElement('div');
        row.className = 'zenleap-pm-cmd-row';
        const ci = document.createElement('span'); ci.className = 'zenleap-pm-cmd-icon'; ci.textContent = cmd.icon || manifest.icon || '🧩';
        const cl = document.createElement('span'); cl.className = 'zenleap-pm-cmd-label'; cl.textContent = cmd.label;
        const ct = document.createElement('span'); ct.className = 'zenleap-pm-cmd-tags'; ct.textContent = (cmd.tags || []).join(', ');
        row.appendChild(ci); row.appendChild(cl); row.appendChild(ct);
        sec.appendChild(row);
      }
      body.appendChild(sec);
    }

    // Plugin settings
    if (manifest.settings && Object.keys(manifest.settings).length > 0) {
      const sec = document.createElement('div');
      sec.className = 'zenleap-pm-detail-section';
      const h3 = document.createElement('h3');
      h3.textContent = 'Settings';
      sec.appendChild(h3);
      const api = createScopedPluginAPI(_pluginManagerDetailId);
      for (const [key, schema] of Object.entries(manifest.settings)) {
        const row = document.createElement('div');
        row.className = 'zenleap-pm-setting-row';
        const label = document.createElement('div');
        label.className = 'zenleap-pm-setting-label';
        const nameSpan = document.createElement('span');
        nameSpan.className = 'zenleap-pm-setting-name';
        nameSpan.textContent = schema.label || key;
        label.appendChild(nameSpan);
        if (schema.description) { const d = document.createElement('div'); d.className = 'zenleap-pm-setting-desc'; d.textContent = schema.description; label.appendChild(d); }
        row.appendChild(label);

        const control = document.createElement('div');
        const currentVal = api.settings.getOwn(key);
        if (schema.type === 'toggle') {
          const toggle = document.createElement('label');
          toggle.className = 'zenleap-toggle';
          const cb = document.createElement('input');
          cb.type = 'checkbox';
          cb.checked = !!currentVal;
          const slider = document.createElement('span');
          slider.className = 'zenleap-toggle-slider';
          toggle.appendChild(cb);
          toggle.appendChild(slider);
          cb.addEventListener('change', () => { api.settings.setOwn(key, cb.checked); });
          control.appendChild(toggle);
        } else if (schema.type === 'number') {
          const input = document.createElement('input');
          input.type = 'number';
          input.value = currentVal;
          if (schema.min !== undefined) input.min = schema.min;
          if (schema.max !== undefined) input.max = schema.max;
          if (schema.step !== undefined) input.step = schema.step;
          input.style.cssText = 'background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12); color: #e0e0e0; padding: 5px 10px; border-radius: 6px; font-size: 13px; width: 80px; outline: none; font-family: inherit;';
          input.addEventListener('change', () => { api.settings.setOwn(key, parseFloat(input.value) || schema.default); });
          control.appendChild(input);
        } else if (schema.type === 'text') {
          const input = document.createElement('input');
          input.type = 'text';
          input.value = currentVal || '';
          input.style.cssText = 'background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12); color: #e0e0e0; padding: 5px 10px; border-radius: 6px; font-size: 13px; width: 120px; outline: none; font-family: inherit;';
          input.addEventListener('change', () => { api.settings.setOwn(key, input.value); });
          control.appendChild(input);
        }
        row.appendChild(control);
        sec.appendChild(row);
      }
      body.appendChild(sec);
    }

    // Path info for external plugins
    if (manifest._path) {
      const sec = document.createElement('div');
      sec.className = 'zenleap-pm-detail-section';
      const h3 = document.createElement('h3');
      h3.textContent = 'Location';
      sec.appendChild(h3);
      const pathInfo = document.createElement('div');
      pathInfo.className = 'zenleap-pm-path-info';
      pathInfo.textContent = manifest._path;
      sec.appendChild(pathInfo);
      body.appendChild(sec);
    }

    // Actions
    const actSec = document.createElement('div');
    actSec.className = 'zenleap-pm-detail-section';
    const actH3 = document.createElement('h3');
    actH3.textContent = 'Actions';
    actSec.appendChild(actH3);
    const actRow = document.createElement('div');
    actRow.style.cssText = 'display: flex; gap: 8px;';
    const toggleBtn = document.createElement('button');
    toggleBtn.className = `zenleap-pm-toggle-btn ${plugin.enabled ? 'enabled' : 'disabled'}`;
    toggleBtn.textContent = plugin.enabled ? 'Enabled' : 'Disabled';
    toggleBtn.addEventListener('click', () => { if (plugin.enabled) disablePlugin(plugin.id); else enablePlugin(plugin.id); renderPluginManagerContent(); });
    actRow.appendChild(toggleBtn);
    if (!plugin.builtIn) {
      const unBtn = document.createElement('button');
      unBtn.className = 'zenleap-pm-uninstall-btn';
      unBtn.textContent = 'Uninstall';
      unBtn.addEventListener('click', async () => {
        const confirmed = await _pluginShowConfirm('Uninstall Plugin', `Uninstall "${plugin.name}"? This will remove all plugin files and data.`);
        if (!confirmed) return;
        await uninstallExternalPlugin(plugin.id);
        _pluginManagerView = 'list';
        _pluginManagerDetailId = null;
        renderPluginManagerContent();
      });
      actRow.appendChild(unBtn);
    }
    actSec.appendChild(actRow);
    body.appendChild(actSec);

    container.appendChild(header);
    container.appendChild(body);
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
    renderPluginManagerContent();
    _pluginManagerModal.classList.add('active');
    log('Entered plugin manager mode');
  }

  function exitPluginManagerMode() {
    if (!_pluginManagerMode) return;
    _pluginManagerMode = false;
    if (_pluginManagerModal) _pluginManagerModal.classList.remove('active');
    log('Exited plugin manager mode');
  }

  // ── Initialize Plugin System ──
  async function initPluginSystem() {
    loadPluginData();
    await loadExternalPlugins();
    log(`Plugin system initialized: ${_pluginRegistry.size} plugin(s) loaded`);
  }



  // ============================================
  // COMMAND PALETTE
  // ============================================

  // Static commands registry
  function getStaticCommands() {
    return [
      // --- Tab Management ---
      { key: 'new-tab', label: 'New Tab', icon: '+', tags: ['tab', 'create', 'open', 'mk'], command: () => { gBrowser.addTab('about:newtab', { triggeringPrincipal: Services.scriptSecurityManager.getSystemPrincipal() }); } },
      { key: 'close-tab', label: 'Close Current Tab', icon: '✕', tags: ['tab', 'close', 'remove', 'del', 'rm', 'cl'], command: () => { gBrowser.removeTab(gBrowser.selectedTab); } },
      { key: 'close-other-tabs', label: 'Close Other Tabs', icon: '✕', tags: ['tab', 'close', 'other', 'del', 'rm', 'cl'], command: () => {
        const current = gBrowser.selectedTab;
        const tabs = getVisibleTabs().filter(t => t !== current && !t.pinned);
        for (const t of tabs) gBrowser.removeTab(t);
      }},
      { key: 'close-tabs-right', label: 'Close Tabs to the Right', icon: '✕→', tags: ['tab', 'close', 'right', 'del', 'rm', 'cl'], command: () => {
        const tabs = getVisibleTabs();
        const idx = tabs.indexOf(gBrowser.selectedTab);
        if (idx >= 0) for (let i = tabs.length - 1; i > idx; i--) if (!tabs[i].pinned) gBrowser.removeTab(tabs[i]);
      }},
      { key: 'close-tabs-left', label: 'Close Tabs to the Left', icon: '←✕', tags: ['tab', 'close', 'left', 'del', 'rm', 'cl'], command: () => {
        const tabs = getVisibleTabs();
        const idx = tabs.indexOf(gBrowser.selectedTab);
        if (idx >= 0) for (let i = idx - 1; i >= 0; i--) if (!tabs[i].pinned) gBrowser.removeTab(tabs[i]);
      }},
      { key: 'duplicate-tab', label: 'Duplicate Tab', icon: '⊕', tags: ['tab', 'duplicate', 'copy', 'clone', 'dup', 'cp'], command: () => { gBrowser.duplicateTab(gBrowser.selectedTab); } },
      { key: 'pin-unpin-tab', label: 'Pin/Unpin Tab', icon: '📌', tags: ['tab', 'pin', 'unpin'], command: () => {
        const tab = gBrowser.selectedTab;
        if (tab.pinned) gBrowser.unpinTab(tab); else gBrowser.pinTab(tab);
      }},

      // --- Zen Essential / Pinned Tab ---
      { key: 'add-to-essentials', label: 'Add Tab to Essentials', icon: '⭐', tags: ['tab', 'essential', 'add', 'star', 'zen'],
        condition: () => {
          try {
            const tab = gBrowser.selectedTab;
            return !!window.gZenPinnedTabManager && !tab.hasAttribute('zen-essential') && !tab.group;
          } catch(e) { return false; }
        },
        command: () => {
          try { gZenPinnedTabManager.addToEssentials(gBrowser.selectedTab); }
          catch(e) { log(`Add to essentials failed: ${e}`); }
      }},
      { key: 'remove-from-essentials', label: 'Remove from Essentials', icon: '⭐', tags: ['tab', 'essential', 'remove', 'unstar', 'zen'],
        condition: () => {
          try { return !!window.gZenPinnedTabManager && gBrowser.selectedTab.hasAttribute('zen-essential'); }
          catch(e) { return false; }
        },
        command: () => {
          try { gZenPinnedTabManager.removeEssentials(gBrowser.selectedTab); }
          catch(e) { log(`Remove from essentials failed: ${e}`); }
      }},
      { key: 'rename-tab', label: 'Rename Tab', icon: '✏', tags: ['tab', 'rename', 'title', 'edit', 'name', 'ren', 'zen'],
        command: () => {
          const tab = gBrowser.selectedTab;
          exitSearchMode();
          setTimeout(() => {
            try {
              TabContextMenu.contextTab = tab;
              document.getElementById('context_zen-edit-tab-title')?.doCommand();
            } catch(e) { log(`Rename tab failed: ${e}`); }
          }, 100);
      }},
      { key: 'edit-tab-icon', label: 'Edit Tab Icon', icon: '🎨', tags: ['tab', 'icon', 'emoji', 'edit', 'custom', 'zen'],
        command: () => {
          const tab = gBrowser.selectedTab;
          exitSearchMode();
          setTimeout(() => {
            try {
              TabContextMenu.contextTab = tab;
              document.getElementById('context_zen-edit-tab-icon')?.doCommand();
            } catch(e) { log(`Edit tab icon failed: ${e}`); }
          }, 100);
      }},
      { key: 'reset-pinned-tab', label: 'Reset Pinned Tab', icon: '↺', tags: ['tab', 'pinned', 'reset', 'original', 'zen'],
        condition: () => {
          try { return !!window.gZenPinnedTabManager && gBrowser.selectedTab.pinned; }
          catch(e) { return false; }
        },
        command: () => {
          try { gZenPinnedTabManager.resetPinnedTab(gBrowser.selectedTab); }
          catch(e) { log(`Reset pinned tab failed: ${e}`); }
      }},
      { key: 'replace-pinned-url', label: 'Replace Pinned URL with Current', icon: '📌', tags: ['tab', 'pinned', 'replace', 'url', 'current', 'update', 'zen'],
        condition: () => {
          try { return !!window.gZenPinnedTabManager && gBrowser.selectedTab.pinned; }
          catch(e) { return false; }
        },
        command: () => {
          try { gZenPinnedTabManager.replacePinnedUrlWithCurrent(gBrowser.selectedTab); }
          catch(e) { log(`Replace pinned URL failed: ${e}`); }
      }},
      { key: 'mute-unmute-tab', label: 'Mute/Unmute Tab', icon: '🔇', tags: ['tab', 'mute', 'unmute', 'audio', 'sound'], command: () => { gBrowser.selectedTab.toggleMuteAudio(); } },
      { key: 'unload-tab', label: 'Unload Tab (Save Memory)', icon: '💤', tags: ['tab', 'unload', 'discard', 'memory', 'suspend'], command: () => {
        const current = gBrowser.selectedTab;
        // Find the most recently accessed tab to switch to
        const tabs = Array.from(gBrowser.tabs)
          .filter(t => t !== current && !t.hasAttribute('pending') && !t.hidden);
        tabs.sort((a, b) => getTabLastAccessed(b) - getTabLastAccessed(a));
        const target = tabs[0];
        if (target) {
          gBrowser.selectedTab = target;
        }
        // Discard after a short delay to let the tab switch complete
        setTimeout(() => {
          try { gBrowser.discardBrowser(current); } catch(e) { log(`Unload tab failed: ${e}`); }
        }, S['timing.unloadTabDelay']);
      }},

      // --- Tab Actions (Context Menu Parity) ---
      { key: 'reload-tab', label: 'Reload Tab', icon: '🔄', tags: ['tab', 'reload', 'refresh', 'r'], command: () => { gBrowser.reloadTab(gBrowser.selectedTab); } },
      { key: 'bookmark-tab', label: 'Bookmark Tab', icon: '🔖', tags: ['tab', 'bookmark', 'save', 'star', 'bm'], command: () => {
        try { PlacesCommandHook.bookmarkPage(); }
        catch(e) { log(`Bookmark tab failed: ${e}`); }
      }},
      { key: 'reopen-closed-tab', label: 'Reopen Closed Tab', icon: '↩', tags: ['tab', 'reopen', 'undo', 'closed', 'restore', 'undoclose'], command: () => {
        try { SessionStore.undoCloseTab(window, 0); }
        catch(e) { log(`Reopen closed tab failed: ${e}`); }
      }},
      { key: 'select-all-tabs', label: 'Select All Tabs (Browse Mode)', icon: '☑', tags: ['tab', 'select', 'all', 'sel'], command: () => {
        const allTabs = getVisibleTabs().filter(t => !t.closing && t.parentNode);
        selectTabsInBrowseMode(allTabs);
      }},
      // --- Tab Selection (Multi-Step) ---
      { key: 'select-matching-tabs', label: 'Select Matching Tabs...', icon: '🔎', tags: ['tab', 'select', 'search', 'match', 'filter', 'batch', 'sel', 'find'], subFlow: 'tab-search' },
      { key: 'deduplicate-tabs', label: 'Deduplicate Tabs (Close Duplicates)', icon: '🧹', tags: ['tab', 'duplicate', 'deduplicate', 'close', 'clean', 'unique', 'dedup'], subFlow: 'dedup-preview' },

      // --- Tab Movement ---
      { key: 'move-tab-to-top', label: 'Move Tab to Top', icon: '⤒', tags: ['tab', 'move', 'top', 'first', 'beginning', 'mv'], command: () => {
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
      { key: 'move-tab-to-bottom', label: 'Move Tab to Bottom', icon: '⤓', tags: ['tab', 'move', 'bottom', 'last', 'end', 'mv'], command: () => {
        const tab = gBrowser.selectedTab;
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

      // --- View & Browser ---
      { key: 'toggle-fullscreen', label: 'Toggle Fullscreen', icon: '⛶', tags: ['view', 'fullscreen', 'screen'], command: () => { window.fullScreen = !window.fullScreen; } },
      { key: 'toggle-sidebar', label: 'Toggle Sidebar Expanded/Compact', icon: '◫', tags: ['sidebar', 'compact', 'expand', 'toggle', 'tog', 'sb'], command: () => {
        try {
          const current = Services.prefs.getBoolPref('zen.view.sidebar-expanded');
          Services.prefs.setBoolPref('zen.view.sidebar-expanded', !current);
        } catch (e) { log(`Toggle sidebar failed: ${e}`); }
      }},
      { key: 'zoom-in', label: 'Zoom In', icon: '🔍+', tags: ['zoom', 'in', 'bigger'], command: () => { ZoomManager.enlarge(); } },
      { key: 'zoom-out', label: 'Zoom Out', icon: '🔍-', tags: ['zoom', 'out', 'smaller'], command: () => { ZoomManager.reduce(); } },
      { key: 'zoom-reset', label: 'Reset Zoom', icon: '🔍=', tags: ['zoom', 'reset', 'default'], command: () => { ZoomManager.reset(); } },

      // --- Split View ---
      { key: 'unsplit-view', label: 'Unsplit View', icon: '▣', tags: ['split', 'unsplit', 'close', 'cl'], command: () => {
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
      { key: 'split-rotate-layout', label: 'Split View: Rotate Layout', icon: '\u27F3', tags: ['split', 'view', 'rotate', 'layout', 'orientation', 'horizontal', 'vertical'], command: () => {
        try {
          rotateSplitLayout();
        } catch (e) { log(`Split rotate layout failed: ${e}`); }
      }, condition: () => {
        try {
          const splitter = window.gZenViewSplitter;
          if (!splitter?.splitViewActive) return false;
          const viewData = splitter._data[splitter.currentView];
          return !!(viewData?.layoutTree);
        } catch(e) { return false; }
      }},
      { key: 'split-reset-sizes', label: 'Split View: Reset Layout Sizes', icon: '\u2B1C', tags: ['split', 'view', 'reset', 'sizes', 'equal', 'normalize', 'balance'], command: () => {
        try {
          resetLayoutSizes();
        } catch (e) { log(`Split reset sizes failed: ${e}`); }
      }, condition: () => {
        try {
          const splitter = window.gZenViewSplitter;
          if (!splitter?.splitViewActive) return false;
          const viewData = splitter._data[splitter.currentView];
          return !!(viewData?.layoutTree);
        } catch(e) { return false; }
      }},
      { key: 'remove-tab-from-split', label: 'Remove Tab from Split View', icon: '\u229F', tags: ['split', 'unsplit', 'remove', 'tab', 'maximize', 'extract', 'detach', 'pop'], command: () => {
        try {
          const container = gBrowser.selectedTab.linkedBrowser?.closest('.browserSidebarContainer');
          if (container) window.gZenViewSplitter.removeTabFromSplit(container);
        } catch (e) { log(`Remove tab from split failed: ${e}`); }
      }, condition: () => {
        try {
          if (!window.gZenViewSplitter?.splitViewActive) return false;
          const viewData = window.gZenViewSplitter._data[window.gZenViewSplitter.currentView];
          return viewData?.tabs?.includes(gBrowser.selectedTab);
        } catch(e) { return false; }
      }},
      { key: 'split-resize-gtile', label: 'Split View: Resize (gTile)', icon: '\u25A6', tags: ['split', 'view', 'resize', 'gtile', 'grid', 'tile', 'move', 'layout'], command: () => {
        enterGtileMode();
      }, condition: () => {
        try {
          return window.gZenViewSplitter?.splitViewActive &&
            window.gZenViewSplitter._data[window.gZenViewSplitter.currentView]?.tabs?.length >= 2;
        } catch(e) { return false; }
      }},

      // --- Workspace Management ---
      { key: 'create-workspace', label: 'Create New Workspace', icon: '➕', tags: ['workspace', 'new', 'create', 'mk', 'ws'],
        subFlow: 'create-workspace-input' },
      { key: 'delete-workspace', label: 'Delete Workspace...', icon: '🗑', tags: ['workspace', 'delete', 'remove', 'destroy', 'del', 'rm', 'ws'],
        condition: () => {
          try { return !!window.gZenWorkspaces && (window.gZenWorkspaces.getWorkspaces()?.length || 0) > 0; } catch(e) { return false; }
        },
        subFlow: 'delete-workspace-picker' },
      { key: 'switch-workspace', label: 'Switch to Workspace...', icon: '🗂', tags: ['workspace', 'switch', 'change', 'sw', 'ws', 'go'],
        condition: () => {
          try { return !!window.gZenWorkspaces && (window.gZenWorkspaces.getWorkspaces()?.length || 0) > 0; } catch(e) { return false; }
        },
        subFlow: 'switch-workspace-picker' },
      { key: 'move-to-workspace', label: 'Move Tab to Workspace...', icon: '🗂', tags: ['workspace', 'move', 'tab', 'mv', 'ws'],
        condition: () => {
          try { return !!window.gZenWorkspaces && (window.gZenWorkspaces.getWorkspaces()?.length || 0) > 1; } catch(e) { return false; }
        },
        subFlow: 'move-to-workspace-picker' },
      { key: 'rename-workspace', label: 'Rename Workspace...', icon: '✏', tags: ['workspace', 'rename', 'edit', 'name', 'ren', 'ws'],
        condition: () => {
          try { return !!window.gZenWorkspaces && (window.gZenWorkspaces.getWorkspaces()?.length || 0) > 0; } catch(e) { return false; }
        },
        subFlow: 'rename-workspace-picker' },
      { key: 'reorganize-workspaces', label: 'Reorganize Workspaces', icon: '↕', tags: ['workspace', 'reorder', 'reorganize', 'sort', 'move', 'arrange', 'order', 'ws'],
        condition: () => {
          try { return !!window.gZenWorkspaces && (window.gZenWorkspaces.getWorkspaces()?.length || 0) > 1; } catch(e) { return false; }
        },
        command: () => { exitSearchMode(); setTimeout(() => enterReorgMode(), 50); } },

      // --- Folder Management ---
      { key: 'create-folder', label: 'Create Folder with Current Tab', icon: '📁', tags: ['folder', 'create', 'new', 'group', 'tab', 'add', 'mk', 'fld', 'fol'],
        condition: () => !!window.gZenFolders,
        command: () => {
          try {
            const tab = gBrowser.selectedTab;
            gZenFolders.createFolder([tab], { renameFolder: true });
          } catch(e) { log(`Create folder failed: ${e}`); }
      }},
      { key: 'delete-folder', label: 'Delete Folder...', icon: '🗑', tags: ['folder', 'delete', 'remove', 'destroy', 'group', 'del', 'rm', 'fld', 'fol'],
        condition: () => {
          try { return gBrowser.tabContainer.querySelectorAll('zen-folder').length > 0; } catch(e) { return false; }
        },
        subFlow: 'delete-folder-picker' },
      { key: 'add-to-folder', label: 'Add Tab to Folder...', icon: '📂', tags: ['folder', 'add', 'move', 'tab', 'group', 'mv', 'fld', 'fol'],
        condition: () => {
          try { return gBrowser.tabContainer.querySelectorAll('zen-folder').length > 0; } catch(e) { return false; }
        },
        subFlow: 'add-to-folder-picker' },
      { key: 'rename-folder', label: 'Rename Folder...', icon: '✏', tags: ['folder', 'rename', 'edit', 'name', 'group', 'ren', 'fld', 'fol'],
        condition: () => {
          try { return gBrowser.tabContainer.querySelectorAll('zen-folder').length > 0; } catch(e) { return false; }
        },
        subFlow: 'rename-folder-picker' },
      { key: 'change-folder-icon', label: 'Change Folder Icon...', icon: '🎨', tags: ['folder', 'icon', 'emoji', 'edit', 'fld', 'fol'],
        condition: () => {
          try { return !!window.gZenFolders && gBrowser.tabContainer.querySelectorAll('zen-folder').length > 0; } catch(e) { return false; }
        },
        subFlow: 'change-folder-icon-picker' },
      { key: 'unload-folder-tabs', label: 'Unload All Tabs in Folder...', icon: '💤', tags: ['folder', 'unload', 'discard', 'memory', 'suspend', 'fld', 'fol'],
        condition: () => {
          try { return gBrowser.tabContainer.querySelectorAll('zen-folder').length > 0; } catch(e) { return false; }
        },
        subFlow: 'unload-folder-picker' },
      { key: 'create-subfolder', label: 'Create Subfolder...', icon: '📁', tags: ['folder', 'subfolder', 'create', 'new', 'nested', 'mk', 'fld', 'fol'],
        condition: () => {
          try { return !!window.gZenFolders && gBrowser.tabContainer.querySelectorAll('zen-folder').length > 0; } catch(e) { return false; }
        },
        subFlow: 'create-subfolder-picker' },
      { key: 'convert-folder-to-workspace', label: 'Convert Folder to Workspace...', icon: '🗂', tags: ['folder', 'workspace', 'convert', 'space', 'fld', 'fol'],
        condition: () => {
          try { return !!window.gZenFolders && !!window.gZenWorkspaces && gBrowser.tabContainer.querySelectorAll('zen-folder').length > 0; } catch(e) { return false; }
        },
        subFlow: 'folder-to-workspace-picker' },
      { key: 'unpack-folder', label: 'Unpack Folder (Keep Tabs)...', icon: '📦', tags: ['folder', 'unpack', 'dissolve', 'remove', 'keep', 'tabs', 'fld', 'fol'],
        condition: () => {
          try { return !!window.gZenFolders && gBrowser.tabContainer.querySelectorAll('zen-folder').length > 0; } catch(e) { return false; }
        },
        subFlow: 'unpack-folder-picker' },
      { key: 'move-folder-to-workspace', label: 'Move Folder to Workspace...', icon: '🗂', tags: ['folder', 'move', 'workspace', 'space', 'mv', 'fld', 'fol'],
        condition: () => {
          try {
            return !!window.gZenFolders && !!window.gZenWorkspaces &&
              (window.gZenWorkspaces.getWorkspaces()?.length || 0) > 1 &&
              gBrowser.tabContainer.querySelectorAll('zen-folder').length > 0;
          } catch(e) { return false; }
        },
        subFlow: 'move-folder-to-ws-folder-picker' },

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
      { key: 'reload-themes', label: 'Reload Themes', icon: '🎨', tags: ['theme', 'reload', 'refresh', 'custom', 'user'], command: () => {
        loadUserThemes().then(() => { applyTheme(); log('Themes reloaded'); });
      }},
      { key: 'open-themes-file', label: 'Open Themes File', icon: '📝', tags: ['theme', 'edit', 'custom', 'file', 'json'], command: async () => {
        await ensureThemesFile();
        const themesPath = PathUtils.join(PathUtils.profileDir, 'chrome', 'zenleap-themes.json');
        const file = Cc['@mozilla.org/file/local;1'].createInstance(Ci.nsIFile);
        file.initWithPath(themesPath);
        try { file.launch(); } catch (e) { console.warn('[ZenLeap] Could not open themes file:', e); }
      }},

      // --- Plugin Management ---
      { key: 'plugin-manager', label: 'Manage Plugins', icon: '🧩', tags: ['plugin', 'plugins', 'manage', 'extensions', 'addons', 'install', 'uninstall', 'enable', 'disable'], command: () => {
        exitSearchMode();
        setTimeout(() => enterPluginManagerMode(), 100);
      }},

      // --- Session Management ---
      { key: 'save-session', label: 'Save Workspace Session', icon: '💾', tags: ['session', 'save', 'snapshot', 'backup', 'checkpoint', 'workspace', 'resurrect'], subFlow: 'save-session-scope' },
      { key: 'restore-session', label: 'Restore Workspace Session...', icon: '📥', tags: ['session', 'restore', 'load', 'resume', 'workspace', 'resurrect'], subFlow: 'restore-session-picker' },
      { key: 'list-sessions', label: 'List Saved Sessions', icon: '📋', tags: ['session', 'list', 'saved', 'history', 'snapshots', 'view'], subFlow: 'list-sessions-picker' },
    ];
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
        condition: () => { try { return !!window.gZenWorkspaces && (window.gZenWorkspaces.getWorkspaces()?.length || 0) > 1; } catch(e) { return false; } },
        subFlow: 'browse-workspace-picker' },
      { key: 'browse:add-folder', label: `Add ${tabLabel} to Folder...`, icon: '📂', tags: [...browseTags, 'folder', 'add', 'group'],
        condition: () => { try { return gBrowser.tabContainer.querySelectorAll('zen-folder').length > 0; } catch(e) { return false; } },
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
        condition: () => { try { return !!window.gZenViewSplitter && browseCommandTabs.length >= 2 && browseCommandTabs.length <= 4; } catch(e) { return false; } },
        command: () => { splitBrowseTabs(browseCommandTabs); } },
      { key: 'browse:reload', label: `Reload ${tabLabel}`, icon: '🔄', tags: [...browseTags, 'reload', 'refresh'],
        command: () => { reloadMatchedTabs(browseCommandTabs); } },
      { key: 'browse:bookmark', label: `Bookmark ${tabLabel}`, icon: '🔖', tags: [...browseTags, 'bookmark', 'save', 'star'],
        command: () => { bookmarkMatchedTabs(browseCommandTabs); } },
    ];
  }

  // Get all available commands (static + dynamic)
  // Caches the condition-filtered command list briefly to avoid re-evaluating
  // expensive conditions (DOM queries, workspace lookups) on every keystroke.
  // Cache is invalidated after 500ms or when command mode is exited.
  let _commandListCache = null;
  let _commandListCacheTime = 0;
  const COMMAND_CACHE_TTL = 500;

  function getAllCommands() {
    const now = Date.now();
    if (_commandListCache && (now - _commandListCacheTime) < COMMAND_CACHE_TTL) {
      return _commandListCache;
    }
    const statics = getStaticCommands();
    const dynamics = getDynamicCommands();
    const plugins = getPluginCommands();
    const all = [...statics, ...dynamics, ...plugins];
    // Filter by condition
    _commandListCache = all.filter(cmd => !cmd.condition || cmd.condition());
    _commandListCacheTime = now;
    return _commandListCache;
  }

  function invalidateCommandCache() {
    _commandListCache = null;
    _commandListCacheTime = 0;
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
        const aGroup = _commandGroupMap.get(a.key);
        const bGroup = _commandGroupMap.get(b.key);
        const aIdx = aGroup ? (groupOrder.get(aGroup) ?? 999) : 999;
        const bIdx = bGroup ? (groupOrder.get(bGroup) ?? 999) : 999;
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
          }).catch(e => {
            _pluginEventBus.emit('command:failed', { key: cmd.key, error: e.message });
            log(`Async command failed: ${cmd.key}: ${e}`);
          });
        } else {
          _pluginEventBus.emit('command:executed', { key: cmd.key, label: cmd.label });
          log(`Executed command: ${cmd.key}`);
        }
      } catch (e) {
        _pluginEventBus.emit('command:failed', { key: cmd.key, error: e.message });
        log(`Command failed: ${cmd.key}: ${e}`);
      }
      browseCommandTabs = [];
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
    // Save current theme for live-preview restore on Escape
    if (type === 'theme-picker') {
      _themePreviewOriginal = S['appearance.theme'] || 'meridian';
    }
    searchSelectedIndex = 0;
    searchCursorPos = 0;

    // Always enter insert mode when entering a sub-flow
    searchVimMode = 'insert';

    if (searchInput) {
      searchInput.value = '';
      searchInput.placeholder = getSubFlowPlaceholder(type);
      searchInput.readOnly = (type === 'dedup-preview' || type === 'session-detail-view' || type === 'delete-session-confirm');
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
      hidePreviewPanel(true);
      dedupTabsToClose = [];
      if (searchInput) searchInput.readOnly = false;
    }

    // Clean up session readonly state when leaving session views
    if (currentType === 'session-detail-view' || currentType === 'delete-session-confirm') {
      if (searchInput) searchInput.readOnly = false;
    }

    // Restore original theme when backing out of theme-picker
    if (currentType === 'theme-picker' && _themePreviewOriginal) {
      S['appearance.theme'] = _themePreviewOriginal;
      saveSettings();
      applyTheme();
      _themePreviewOriginal = null;
    }

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
      case 'create-workspace-input': return 'Enter new workspace name...';
      case 'save-session-scope': return 'What to save?';
      case 'save-session-input': return 'Type a comment for this snapshot and press Enter...';
      case 'restore-session-picker': return 'Select a session to restore...';
      case 'restore-session-mode': return 'How to restore?';
      case 'list-sessions-picker': return 'Browse saved sessions...';
      case 'session-detail-view': return 'Session contents (Esc to go back)';
      case 'delete-session-confirm': return 'Press Enter to confirm deletion...';
      case 'browse-workspace-picker': return 'Choose a workspace...';
      case 'browse-folder-picker': return 'Choose a folder...';
      case 'browse-folder-name-input': return 'Enter folder name...';
      case 'sort-picker': return 'Sort by...';
      case 'change-folder-icon-picker': return 'Select a folder to change icon...';
      case 'unload-folder-picker': return 'Select a folder to unload tabs...';
      case 'unload-folder-progress': return 'Unloading...';
      case 'create-subfolder-picker': return 'Select a parent folder...';
      case 'folder-to-workspace-picker': return 'Select a folder to convert to workspace...';
      case 'unpack-folder-picker': return 'Select a folder to unpack...';
      case 'move-folder-to-ws-folder-picker': return 'Select a folder to move...';
      case 'move-folder-to-ws-workspace-picker': return 'Select destination workspace...';
      case 'theme-picker': return 'Select a theme...';
      case 'theme-browser-confirm': return 'Apply theme to browser too?';
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
      case 'create-workspace-input':
        return getCreateWorkspaceInputResults(query);
      case 'save-session-scope':
        return getSaveSessionScopeResults(query);
      case 'save-session-input':
        return getSaveSessionInputResults(query);
      case 'restore-session-picker':
        return getRestoreSessionPickerResults(query);
      case 'restore-session-mode':
        return getRestoreSessionModeResults(query);
      case 'list-sessions-picker':
        return getListSessionsPickerResults(query);
      case 'session-detail-view':
        return getSessionDetailViewResults(query);
      case 'delete-session-confirm':
        return getDeleteSessionConfirmResults();
      case 'browse-workspace-picker':
        return getWorkspacePickerResults(query);
      case 'browse-folder-picker':
        return getFolderPickerResults(query);
      case 'browse-folder-name-input':
        return getFolderNameInputResults(query);
      case 'sort-picker':
        return getSortPickerResults(query);
      case 'change-folder-icon-picker':
        return getFolderPickerForAction(query, '🎨', 'change-icon');
      case 'unload-folder-picker':
        return getFolderPickerForAction(query, '💤', 'unload');
      case 'unload-folder-progress': {
        const data = commandSubFlow?.data;
        const count = data?.getCount?.() || 0;
        const total = data?.total || 0;
        const done = count >= total;
        return [{ key: 'unload-progress', label: done ? `Done — unloaded ${total} tab${total !== 1 ? 's' : ''}` : `Unloading... ${count} / ${total}`, icon: done ? '✓' : '💤', tags: [] }];
      }
      case 'create-subfolder-picker':
        return getFolderPickerForAction(query, '📁', 'subfolder');
      case 'folder-to-workspace-picker':
        return getFolderPickerForAction(query, '🗂', 'convert');
      case 'unpack-folder-picker':
        return getFolderPickerForAction(query, '📦', 'unpack');
      case 'move-folder-to-ws-folder-picker':
        return getFolderPickerForAction(query, '🗂', 'move-ws');
      case 'move-folder-to-ws-workspace-picker':
        return getMoveToWorkspacePickerResults(query);
      case 'theme-picker':
        return getThemePickerResults(query);
      case 'theme-browser-confirm':
        return getThemeBrowserConfirmResults(query);
      default:
        return [];
    }
  }

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

  // Browser theme confirmation sub-flow
  function getThemeBrowserConfirmResults(query) {
    const options = [
      { key: 'theme-browser:yes', label: 'Yes, apply to browser too', icon: '✓', tags: ['yes', 'apply', 'browser'] },
      { key: 'theme-browser:no', label: 'No, only ZenLeap', icon: '✕', tags: ['no', 'zenleap', 'only'] },
    ];
    return fuzzyFilterAndSort(options, query);
  }

  function getFolderNameInputResults(query) {
    const name = (query || '').trim();
    if (!name) {
      return [{ key: 'folder-name:prompt', label: 'Type a name for the new folder and press Enter', icon: '📁', tags: [] }];
    }
    return [{ key: 'folder-name:confirm', label: `Create folder: "${name}"`, icon: '📁+', tags: [] }];
  }

  // Generic folder picker for context-menu-parity sub-flows
  function getFolderPickerForAction(query, icon, actionPrefix) {
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
          key: `${actionPrefix}-folder:${folder.id}`,
          label: name,
          sublabel: `${tabCount} tab${tabCount !== 1 ? 's' : ''}`,
          icon,
          tags: ['folder', actionPrefix, name.toLowerCase()],
          folder: folder,
        });
      }
    } catch (e) { log(`Error getting folders for ${actionPrefix}: ${e}`); }
    if (results.length === 0) {
      return [{ key: `${actionPrefix}-folder:none`, label: 'No folders found', icon: '📂', tags: [] }];
    }
    return fuzzyFilterAndSort(results, query);
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
    return fuzzyFilterAndSort(results, query);
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
    return fuzzyFilterAndSort(results, query);
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
    const filtered = fuzzyFilterAndSort(results, query);
    filtered.push({ key: 'switch-workspace:create-new', label: '+ Create New Workspace', icon: '➕', tags: ['workspace', 'new', 'create'] });
    return filtered;
  }

  function getMoveToWorkspacePickerResults(query) {
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
              workspaceId: ws.uuid,
            });
          }
        }
      }
    } catch (e) { log(`Error getting workspaces for move: ${e}`); }
    const filtered = fuzzyFilterAndSort(results, query);
    filtered.push({ key: 'move-to-workspace:create-new', label: '+ Create New Workspace', icon: '➕', tags: ['workspace', 'new', 'create'] });
    return filtered;
  }

  function getRenameWorkspacePickerResults(query) {
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
              key: `rename-workspace:${ws.uuid}`,
              label: `${name}${isActive ? ' (current)' : ''}`,
              icon: ws.icon || '✏',
              tags: ['workspace', 'rename', name.toLowerCase()],
              workspaceId: ws.uuid,
            });
          }
        }
      }
    } catch (e) { log(`Error getting workspaces for rename: ${e}`); }
    if (results.length === 0) {
      return [{ key: 'rename-workspace:none', label: 'No workspaces found', icon: '🗂', tags: [] }];
    }
    return fuzzyFilterAndSort(results, query);
  }

  function getAddToFolderPickerResults(query) {
    const results = [];
    try {
      const activeTab = gBrowser.selectedTab;
      const activeWsId = window.gZenWorkspaces?.activeWorkspace;
      const folders = gBrowser.tabContainer.querySelectorAll('zen-folder');
      for (const folder of folders) {
        const folderWsId = folder.getAttribute('zen-workspace-id');
        if (activeWsId && folderWsId && folderWsId !== activeWsId) continue;
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
    return fuzzyFilterAndSort(results, query);
  }

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
    return fuzzyFilterAndSort(results, query);
  }

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

  function getCreateWorkspaceInputResults(query) {
    const name = (query || '').trim();
    if (!name) {
      return [{ key: 'create-workspace-input:prompt', label: 'Type a name for the new workspace and press Enter', icon: '➕', tags: [] }];
    }
    return [{ key: 'create-workspace-input:confirm', label: `Create workspace: "${name}"`, icon: '➕', tags: [] }];
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
    const filtered = fuzzyFilterAndSort(results, query);
    filtered.push({ key: 'ws:create-new', label: '+ Create New Workspace', icon: '➕', tags: ['workspace', 'new', 'create'] });
    return filtered;
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
    return fuzzyFilterAndSort(results, query);
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

    // For each group with >1 tab, keep the most recently accessed, collect the rest
    const tabsToClose = [];
    for (const [url, tabs] of urlGroups) {
      if (tabs.length < 2) continue;
      tabs.sort((a, b) => getTabLastAccessed(b) - getTabLastAccessed(a));
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
        if (result.key === 'ws:create-new') {
          enterSubFlow('create-workspace-input', 'New Workspace');
          commandSubFlow.data = { originFlow: 'workspace-picker' };
        } else {
          moveTabsToWorkspace(commandMatchedTabs, result.workspaceId);
        }
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
        hidePreviewPanel(true);
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
        if (result.key === 'switch-workspace:create-new') {
          enterSubFlow('create-workspace-input', 'New Workspace');
          commandSubFlow.data = { originFlow: 'switch-workspace-picker' };
        } else if (result.workspaceId) {
          window.gZenWorkspaces.changeWorkspaceWithID(result.workspaceId);
          exitSearchMode();
        }
        break;

      case 'move-to-workspace-picker':
        if (result.key === 'move-to-workspace:create-new') {
          enterSubFlow('create-workspace-input', 'New Workspace');
          commandSubFlow.data = { originFlow: 'move-to-workspace-picker', tabToMove: gBrowser.selectedTab };
        } else if (result.workspaceId) {
          const tabToMove = gBrowser.selectedTab;
          window.gZenWorkspaces.moveTabToWorkspace(tabToMove, result.workspaceId);
          // Switch to the target workspace and focus the moved tab
          setTimeout(() => {
            window.gZenWorkspaces.changeWorkspaceWithID(result.workspaceId);
            setTimeout(() => { gBrowser.selectedTab = tabToMove; }, S['timing.workspaceSwitchDelay'] || 100);
          }, S['timing.workspaceSwitchDelay'] || 100);
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
          enterSubFlow('rename-folder-input', `Rename: ${result.label}`);
          commandSubFlow.data = { folderId: result.folder.id, folderName: result.label };
        }
        break;

      case 'rename-workspace-picker':
        if (result.workspaceId) {
          enterSubFlow('rename-workspace-input', `Rename: ${result.label.replace(' (current)', '')}`);
          commandSubFlow.data = { workspaceId: result.workspaceId, workspaceName: result.label.replace(' (current)', '') };
        }
        break;

      case 'rename-folder-input':
        if (result.key === 'rename-folder-input:confirm') {
          const name = commandQuery.trim();
          const data = commandSubFlow?.data;
          if (name && data?.folderId) {
            renameFolder(data.folderId, name);
          }
        }
        break;

      case 'rename-workspace-input':
        if (result.key === 'rename-workspace-input:confirm') {
          const name = commandQuery.trim();
          const data = commandSubFlow?.data;
          if (name && data?.workspaceId) {
            renameWorkspace(data.workspaceId, name);
          }
        }
        break;

      case 'create-workspace-input':
        if (result.key === 'create-workspace-input:confirm') {
          const name = commandQuery.trim();
          if (name) {
            handleCreateWorkspaceAndChain(name, commandSubFlow?.data);
          }
        }
        break;

      // --- Session Management Sub-Flows ---
      case 'save-session-scope': {
        const saveScope = result.key === 'save-scope:all' ? 'all' : 'current';
        enterSubFlow('save-session-input', 'Add Comment');
        commandSubFlow.data = { scope: saveScope };
        break;
      }

      case 'save-session-input':
        handleSaveSession(commandQuery.trim());
        break;

      case 'restore-session-picker':
        if (result.sessionData) {
          enterSubFlow('restore-session-mode', 'Restore Mode');
          commandSubFlow.data = { session: result.sessionData };
          renderCommandResults(); // re-render now that data is set
        }
        break;

      case 'restore-session-mode': {
        const restoreSession = commandSubFlow.data?.session;
        if (result.key === 'restore-mode:new') {
          handleRestoreSession(restoreSession, 'new');
        } else if (result.key === 'restore-mode:replace') {
          handleRestoreSession(restoreSession, 'replace');
        }
        break;
      }

      case 'list-sessions-picker':
        if (result.sessionData) {
          enterSubFlow('session-detail-view', result.label);
          commandSubFlow.data = { session: result.sessionData };
          renderCommandResults(); // re-render now that data is set
        }
        break;

      case 'session-detail-view': {
        const detailSession = commandSubFlow.data?.session;
        if (detailSession) {
          enterSubFlow('restore-session-mode', 'Restore Mode');
          commandSubFlow.data = { session: detailSession };
          renderCommandResults(); // re-render now that data is set
        }
        break;
      }

      case 'delete-session-confirm':
        if (result.key === 'delete-session:confirm') {
          const sessionId = commandSubFlow.data?.sessionId;
          if (sessionId) {
            deleteSessionFile(sessionId).then(() => {
              sessionCache = null;
              sessionLoadPromise = null;
              exitSubFlow();
            }).catch(e => {
              log(`Delete session failed: ${e}`);
              exitSubFlow();
            });
          }
        } else if (result.key === 'delete-session:cancel') {
          exitSubFlow();
        }
        break;
      case 'sort-picker':
        if (result.key === 'sort:domain') sortLooseTabsByDomain();
        else if (result.key === 'sort:title-az') sortLooseTabsByTitle();
        else if (result.key === 'sort:title-za') sortLooseTabsByTitleReverse();
        else if (result.key === 'sort:recency-newest') sortLooseTabsByRecencyNewest();
        else if (result.key === 'sort:recency-oldest') sortLooseTabsByRecencyOldest();
        exitSearchMode();
        break;

      // Browse command mode sub-flows
      case 'browse-workspace-picker':
        if (result.key === 'ws:create-new') {
          enterSubFlow('create-workspace-input', 'New Workspace');
          commandSubFlow.data = { originFlow: 'browse-workspace-picker' };
        } else if (result.workspaceId) {
          moveTabsToWorkspace(browseCommandTabs, result.workspaceId);
        }
        break;

      case 'browse-folder-picker':
        if (result.key === 'folder:new') {
          enterSubFlow('browse-folder-name-input', 'Name new folder');
        } else {
          addTabsToFolder(browseCommandTabs, result);
        }
        break;

      case 'browse-folder-name-input': {
        const browseFolderName = (commandQuery || '').trim();
        if (browseFolderName) {
          createFolderWithName(browseCommandTabs, browseFolderName);
        }
        break;
      }

      // --- Folder context-menu-parity sub-flows ---
      case 'change-folder-icon-picker':
        if (result.folder) {
          const targetFolder = result.folder;
          exitSearchMode();
          setTimeout(() => {
            try {
              if (typeof gZenFolders?.changeFolderUserIcon === 'function') gZenFolders.changeFolderUserIcon(targetFolder);
              else log('changeFolderUserIcon not available');
            } catch(e) { log(`Change folder icon failed: ${e}`); }
          }, 100);
        }
        break;

      case 'unload-folder-picker':
        if (result.folder) {
          const targetFolder = result.folder;
          if (targetFolder) {
            // Show "Unloading..." sub-flow while tabs are being discarded
            enterSubFlow('unload-folder-progress', `Unload: ${targetFolder.label || 'folder'}`);
            const folderTabs = (targetFolder.tabs || []).filter(t =>
              t && !t.hasAttribute('zen-empty-tab') && !t.hasAttribute('pending') && !t.closing
            );
            const total = folderTabs.length;
            let count = 0;
            // Unload tabs one at a time with a small delay so the UI stays responsive
            function unloadNext() {
              if (count < total) {
                try { gBrowser.discardBrowser(folderTabs[count]); } catch(e) {}
                count++;
                renderCommandResults();
                setTimeout(unloadNext, 50);
              } else {
                log(`Unloaded ${count} tabs in folder: ${targetFolder.label || 'folder'}`);
                exitSearchMode();
              }
            }
            // Store progress state for the sub-flow results to read
            commandSubFlow.data = { total, getCount: () => count };
            renderCommandResults();
            setTimeout(unloadNext, 50);
          }
        }
        break;

      case 'create-subfolder-picker':
        if (result.folder) {
          const targetFolder = result.folder;
          exitSearchMode();
          setTimeout(() => {
            try {
              if (typeof targetFolder.createSubfolder === 'function') targetFolder.createSubfolder();
              else if (typeof gZenFolders?.createSubfolder === 'function') gZenFolders.createSubfolder(targetFolder);
              else log('createSubfolder not available');
            } catch(e) { log(`Create subfolder failed: ${e}`); }
          }, 100);
        }
        break;

      case 'folder-to-workspace-picker':
        if (result.folder) {
          const targetFolder = result.folder;
          if (targetFolder && window.gZenWorkspaces) {
            (async () => {
              try {
                const folderName = targetFolder.label || 'Untitled';
                const currentWorkspace = gZenWorkspaces.getActiveWorkspaceFromCache();
                const icon = targetFolder.icon?.querySelector('svg .icon image');
                let selectedTab = targetFolder.tabs?.find(t => t.selected);

                const newSpace = await gZenWorkspaces.createAndSaveWorkspace(
                  folderName,
                  icon?.getAttribute('href'),
                  false,
                  currentWorkspace?.containerTabId || 0,
                  {
                    beforeChangeCallback: async (newWorkspace) => {
                      await new Promise((resolve) => {
                        requestAnimationFrame(async () => {
                          const wsPinnedContainer = gZenWorkspaces.workspaceElement(newWorkspace.uuid)?.pinnedTabsContainer;
                          const tabs = (targetFolder.allItems || targetFolder.tabs || []).filter(t => !t.hasAttribute('zen-empty-tab'));
                          if (wsPinnedContainer) wsPinnedContainer.append(...tabs);
                          if (typeof targetFolder.delete === 'function') await targetFolder.delete();
                          gBrowser.tabContainer._invalidateCachedTabs();
                          if (selectedTab) {
                            selectedTab.setAttribute('zen-workspace-id', newWorkspace.uuid);
                            selectedTab.removeAttribute('folder-active');
                            gZenWorkspaces.lastSelectedWorkspaceTabs[newWorkspace.uuid] = selectedTab;
                          }
                          resolve();
                        });
                      });
                    },
                  }
                );
                log(`Converted folder "${folderName}" to workspace`);
              } catch(e) { log(`Convert folder to workspace failed: ${e}`); }
            })();
          }
        }
        exitSearchMode();
        break;

      case 'unpack-folder-picker':
        if (result.folder) {
          const targetFolder = result.folder;
          try {
            if (typeof targetFolder.unpackTabs === 'function') targetFolder.unpackTabs();
            else if (typeof gZenFolders?.ungroupTabsFromActiveGroups === 'function') {
              const tabs = (targetFolder.tabs || []).filter(t => t && !t.hasAttribute('zen-empty-tab'));
              gZenFolders.ungroupTabsFromActiveGroups(tabs);
            }
            log(`Unpacked folder: ${targetFolder.label || 'folder'}`);
          } catch(e) { log(`Unpack folder failed: ${e}`); }
        }
        exitSearchMode();
        break;

      case 'move-folder-to-ws-folder-picker':
        if (result.folder) {
          enterSubFlow('move-folder-to-ws-workspace-picker', `Move: ${result.label}`);
          commandSubFlow.data = { folder: result.folder, folderName: result.label };
        }
        break;

      case 'move-folder-to-ws-workspace-picker':
        if (result.key === 'move-to-workspace:create-new') {
          const prevData = commandSubFlow?.data;
          enterSubFlow('create-workspace-input', 'New Workspace');
          commandSubFlow.data = { originFlow: 'move-folder-to-ws-workspace-picker', folder: prevData?.folder, folderName: prevData?.folderName };
        } else if (result.workspaceId) {
          const folderData = commandSubFlow?.data;
          if (folderData?.folder && window.gZenFolders) {
            try {
              gZenFolders.changeFolderToSpace(folderData.folder, result.workspaceId);
              log(`Moved folder "${folderData.folderName}" to workspace`);
            } catch(e) { log(`Move folder to workspace failed: ${e}`); }
          }
          exitSearchMode();
        }
        break;

      // --- Theme Sub-Flows ---
      case 'theme-picker':
        if (result.themeId) {
          // User confirmed — clear preview state so exitSubFlow won't revert
          _themePreviewOriginal = null;
          S['appearance.theme'] = result.themeId;
          saveSettings();
          applyTheme();
          // Ask about browser application
          enterSubFlow('theme-browser-confirm', 'Apply to Browser?');
        }
        break;

      case 'theme-browser-confirm':
        if (result.key === 'theme-browser:yes') {
          S['appearance.applyToBrowser'] = true;
        } else if (result.key === 'theme-browser:no') {
          S['appearance.applyToBrowser'] = false;
        }
        saveSettings();
        applyBrowserTheme();
        exitSearchMode();
        break;
    }
  }

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
      const currentTab = gBrowser.selectedTab;
      const currentIdx = visibleItems.indexOf(currentTab);
      originalTabIndex = currentIdx >= 0 ? currentIdx : 0;
      originalTab = currentTab;
      highlightedTabIndex = firstMatchIdx >= 0 ? firstMatchIdx : originalTabIndex;

      // Pre-select the matched tabs
      selectedItems.clear();
      for (const t of tabs) {
        if (t && !t.closing && t.parentNode) selectedItems.add(t);
      }

      updateHighlight();
      updateLeapOverlayState();
      log(`Browse mode with ${selectedItems.size} pre-selected tabs`);
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
      alternates.sort((a, b) => getTabLastAccessed(b) - getTabLastAccessed(a));
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

  function reloadMatchedTabs(tabs) {
    const validTabs = tabs.filter(t => t && !t.closing && t.parentNode);
    for (const t of validTabs) gBrowser.reloadTab(t);
    log(`Reloaded ${validTabs.length} tabs`);
    exitSearchMode();
  }

  function bookmarkMatchedTabs(tabs) {
    const validTabs = tabs.filter(t => t && !t.closing && t.parentNode);
    try {
      // Use bookmarkTabs() which is the same API the context menu uses
      PlacesCommandHook.bookmarkTabs(validTabs);
    } catch(e) { log(`Bookmark tabs failed: ${e}`); }
    exitSearchMode();
  }

  // Sort tabs by their current sidebar position to preserve relative order
  function sortTabsBySidebarPosition(tabs) {
    const visibleTabs = getVisibleTabs();
    const positionMap = new Map();
    visibleTabs.forEach((t, idx) => positionMap.set(t, idx));
    return [...tabs].sort((a, b) => (positionMap.get(a) ?? 0) - (positionMap.get(b) ?? 0));
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

  // Get loose tabs eligible for sorting: non-pinned, non-essential, not in folders
  function getSortableLooseTabs() {
    return getVisibleTabs().filter(t =>
      !t.pinned &&
      !t.hasAttribute('zen-essential') &&
      !t.group &&
      !t.closing
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

      // Place first sorted tab at the first regular position
      gBrowser.moveTabBefore(sortedTabs[0], visibleTabs[firstRegularIdx]);
      for (let i = 1; i < sortedTabs.length; i++) {
        gBrowser.moveTabAfter(sortedTabs[i], sortedTabs[i - 1]);
      }
    } catch (e) { log(`Tab reorder failed: ${e}`); }
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

  async function handleCreateWorkspaceAndChain(name, data) {
    if (!window.gZenWorkspaces) { log('gZenWorkspaces not available'); exitSearchMode(); return; }

    const originFlow = data?.originFlow;

    try {
      await gZenWorkspaces.createAndSaveWorkspace(name, undefined, false, 0);
    } catch (e) {
      log(`Create workspace failed: ${e}`);
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
        // Move the captured tab to the new workspace
        const tabToMove = data?.tabToMove;
        if (tabToMove && !tabToMove.closing) {
          window.gZenWorkspaces.moveTabToWorkspace(tabToMove, newWsId);
          setTimeout(() => { gBrowser.selectedTab = tabToMove; }, S['timing.workspaceSwitchDelay'] || 100);
        }
        exitSearchMode();
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
          } catch(e) { log(`Move folder to workspace failed: ${e}`); }
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

  // Duplicate matched tabs
  function duplicateMatchedTabs(tabs) {
    const validTabs = tabs.filter(t => t && !t.closing && t.parentNode);
    for (const t of validTabs) gBrowser.duplicateTab(t);
    log(`Duplicated ${validTabs.length} tabs`);
    exitSearchMode();
  }

  // Pin or unpin matched tabs (smart toggle: if any unpinned, pin all; else unpin all)
  function pinUnpinMatchedTabs(tabs) {
    const validTabs = tabs.filter(t => t && !t.closing && t.parentNode);
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
    const validTabs = tabs.filter(t => t && !t.closing && t.parentNode);
    for (const t of validTabs) t.toggleMuteAudio();
    log(`Toggled mute on ${validTabs.length} tabs`);
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

  function splitBrowseTabs(tabs) {
    try {
      if (window.gZenViewSplitter && tabs.length >= 2) {
        const validTabs = tabs.filter(t =>
          t && !t.closing && t.parentNode &&
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
    } catch (e) { log(`Browse split failed: ${e}`); }
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

  // ============================================
  // SESSION MANAGEMENT (save / restore / list)
  // ============================================

  // --- Core I/O ---

  async function getSessionsDir() {
    const dir = PathUtils.join(PathUtils.profileDir, 'zenleap-sessions');
    await IOUtils.makeDirectory(dir, { createAncestors: true, ignoreExisting: true });
    return dir;
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
            const data = await IOUtils.readJSON(filePath);
            if (data && data.version && data.id) {
              data._filePath = filePath;
              sessions.push(data);
            }
          } catch (e) {
            log(`Skipping corrupt session file: ${filePath}: ${e}`);
          }
        }
      } catch (e) {
        log(`Error loading sessions: ${e}`);
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
    const dir = await getSessionsDir();
    const filePath = PathUtils.join(dir, `${sessionData.id}.json`);
    await IOUtils.writeJSON(filePath, sessionData);
    sessionCache = null;
    sessionLoadPromise = null;
    log(`Session saved: ${filePath}`);
  }

  async function deleteSessionFile(sessionId) {
    const dir = await getSessionsDir();
    const filePath = PathUtils.join(dir, `${sessionId}.json`);
    try {
      await IOUtils.remove(filePath);
      log(`Session deleted: ${sessionId}`);
    } catch (e) {
      log(`Delete session file failed: ${e}`);
    }
    sessionCache = null;
    sessionLoadPromise = null;
  }

  // --- Data Collection (v2: tree-based layout matching DOM structure) ---

  function collectTabItem(tab) {
    return {
      type: 'tab',
      url: tab.linkedBrowser?.currentURI?.spec || 'about:blank',
      title: tab.label || 'Untitled',
      favicon: tab.getAttribute('image') || '',
      pinned: !!tab.pinned,
      essential: tab.hasAttribute('zen-essential'),
      customLabel: (typeof tab.zenStaticLabel === 'string' && tab.zenStaticLabel) ? tab.zenStaticLabel : null,
    };
  }

  function collectFolderTree(folder) {
    const children = [];
    try {
      // allItems returns immediate children (tabs + nested folders), excluding
      // structural elements like zen-tab-group-start and separator
      const items = folder.allItems || [];
      for (const item of items) {
        if (item.isZenFolder) {
          children.push(collectFolderTree(item));
        } else if (gBrowser.isTab(item) && !item.hasAttribute('zen-empty-tab')) {
          children.push(collectTabItem(item));
        }
      }
    } catch (e) { log(`Error collecting folder tree: ${e}`); }
    return {
      type: 'folder',
      name: folder.label || folder.getAttribute('zen-folder-name') || 'Unnamed Folder',
      collapsed: !!folder.collapsed,
      children,
    };
  }

  function collectWorkspaceLayout(wsData) {
    const wsId = wsData?.uuid;
    const layout = [];

    // Essential tabs are shared across workspaces (separate DOM section).
    // Collect them first so they appear at the top of the layout.
    const essentialTabs = Array.from(gBrowser.tabs).filter(t =>
      t.hasAttribute('zen-essential') && !t.hasAttribute('zen-empty-tab') && !t.hasAttribute('zen-glance-tab')
    );
    for (const tab of essentialTabs) {
      layout.push(collectTabItem(tab));
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
            layout.push(collectFolderTree(child));
          } else if (gBrowser.isTab(child)) {
            if (child.hasAttribute('zen-empty-tab') || child.hasAttribute('zen-glance-tab')) continue;
            if (child.hasAttribute('zen-essential')) continue; // already collected above
            layout.push(collectTabItem(child));
          }
        }
      }

      // Normal section: unpinned tabs (in DOM/visual order)
      const normalContainer = wsElement.tabsContainer;
      if (normalContainer) {
        for (const child of normalContainer.children) {
          if (!gBrowser.isTab(child)) continue;
          if (child.hasAttribute('zen-empty-tab') || child.hasAttribute('zen-glance-tab')) continue;
          layout.push(collectTabItem(child));
        }
      }
    } else {
      // Fallback: workspace element unavailable, iterate gBrowser.tabs
      const allTabs = Array.from(gBrowser.tabs);
      const wsTabs = wsId
        ? allTabs.filter(t => t.getAttribute('zen-workspace-id') === wsId && !t.hasAttribute('zen-empty-tab') && !t.hasAttribute('zen-glance-tab') && !t.hasAttribute('zen-essential'))
        : getVisibleTabs().filter(t => !t.hasAttribute('zen-essential'));
      for (const tab of wsTabs) {
        layout.push(collectTabItem(tab));
      }
    }

    const activeTab = gBrowser.selectedTab;
    const activeTabUrl = (activeTab && activeTab.getAttribute('zen-workspace-id') === wsId)
      ? (activeTab.linkedBrowser?.currentURI?.spec || '') : '';

    return {
      name: wsData?.name || 'Unnamed Workspace',
      icon: wsData?.icon || '',
      theme: wsData?.theme || null,
      activeTabUrl: activeTabUrl || getFirstTabUrl(layout),
      layout,
    };
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
    if (ws.layout) return ws.layout;
    // Convert v1 format (flat tabs + folders arrays) to v2 layout tree
    if (!ws.tabs) return [];
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
      if (tab.essential) layout.push({ type: 'tab', url: tab.url, title: tab.title, favicon: tab.favicon || '', pinned: true, essential: true });
    }
    for (const [name, tabs] of folderTabs) {
      const meta = ws.folders?.find(f => f.name === name);
      layout.push({
        type: 'folder', name, collapsed: meta?.collapsed || false,
        children: tabs.map(t => ({ type: 'tab', url: t.url, title: t.title, favicon: t.favicon || '', pinned: true, essential: false })),
      });
    }
    for (const tab of sorted) {
      if (tab.pinned && !tab.essential && !tab.folderName) layout.push({ type: 'tab', url: tab.url, title: tab.title, favicon: tab.favicon || '', pinned: true, essential: false });
    }
    for (const tab of sorted) {
      if (!tab.pinned && !tab.essential && !tab.folderName) layout.push({ type: 'tab', url: tab.url, title: tab.title, favicon: tab.favicon || '', pinned: false, essential: false });
    }
    return layout;
  }

  function collectSession(scope, comment) {
    const timestamp = Date.now();
    const id = `session-${timestamp}`;
    const workspacesData = [];

    if (scope === 'all' && window.gZenWorkspaces) {
      const allWs = window.gZenWorkspaces.getWorkspaces();
      if (allWs && Array.isArray(allWs)) {
        for (const ws of allWs) {
          workspacesData.push(collectWorkspaceLayout(ws));
        }
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

    let totalTabCount = 0, totalFolderCount = 0, totalPinnedCount = 0, totalEssentialCount = 0;
    for (const ws of workspacesData) {
      const s = countLayoutStats(ws.layout);
      totalTabCount += s.tabs; totalFolderCount += s.folders;
      totalPinnedCount += s.pinned; totalEssentialCount += s.essential;
    }

    return {
      version: 2,
      id,
      savedAt: new Date(timestamp).toISOString(),
      comment: comment || '',
      scope,
      workspaces: workspacesData,
      stats: { workspaceCount: workspacesData.length, totalTabCount, totalFolderCount, totalPinnedCount, totalEssentialCount },
    };
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
    const sessionData = collectSession(scope, comment);
    exitSearchMode();
    saveSessionToFile(sessionData).then(() => {
      log(`Session saved: ${sessionData.id} (${scope}, ${sessionData.stats.totalTabCount} tabs)`);
    }).catch(e => {
      log(`Save session failed: ${e}`);
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
      const icon = s.workspaces?.[0]?.icon || '🗂';
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

  function getRestoreSessionPickerResults(query) {
    // loadAllSessions is async, but subflow results are sync — use cached data
    if (!sessionCache) {
      // Trigger async load and show loading state
      loadAllSessions().then(() => renderCommandResults());
      return [{ key: 'restore:loading', label: 'Loading sessions...', icon: '⏳', tags: [] }];
    }
    const results = buildSessionPickerResults(sessionCache.sessions, 'restore-session');
    return fuzzyFilterAndSort(results, query);
  }

  function getRestoreSessionModeResults(query) {
    const session = commandSubFlow?.data?.session;
    const isMultiWs = session && session.workspaces.length > 1;
    const results = [
      { key: 'restore-mode:new', label: `Create New Workspace${isMultiWs ? 's' : ''}`, icon: '➕', sublabel: 'Opens saved tabs in new workspace(s)', tags: ['new', 'create'] },
    ];
    // Only offer replace for single-workspace sessions
    if (!isMultiWs) {
      results.push({ key: 'restore-mode:replace', label: 'Replace Current Workspace', icon: '🔄', sublabel: 'Replaces tabs in current workspace', tags: ['replace', 'current'] });
    }
    return fuzzyFilterAndSort(results, query);
  }

  async function handleRestoreSession(sessionData, mode) {
    if (!sessionData || !sessionData.workspaces) { log('Invalid session data'); return; }
    exitSearchMode();

    try {
      if (mode === 'new') {
        for (const wsData of sessionData.workspaces) {
          await restoreWorkspaceAsNew(wsData);
        }
      } else if (mode === 'replace') {
        await restoreWorkspaceReplace(sessionData.workspaces[0]);
      }
      log(`Session restored: ${sessionData.id} (${mode})`);
    } catch (e) {
      log(`Restore session failed: ${e}`);
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

    try {
      await gZenWorkspaces.createAndSaveWorkspace(
        wsData.name || 'Restored',
        wsData.icon || undefined,
        false, // dontChange = false, so it switches to the new workspace
        0      // containerTabId
      );
    } catch (e) {
      log(`Create workspace failed: ${e}`);
      return;
    }

    // Wait for workspace switch to complete (new workspace becomes active)
    await waitFor(() => gZenWorkspaces.activeWorkspace && gZenWorkspaces.activeWorkspace !== prevWsId, { timeout: 3000 });
    await restoreLayout(wsData);
  }

  async function restoreWorkspaceReplace(wsData) {
    const principal = Services.scriptSecurityManager.getSystemPrincipal();

    const existingFolders = Array.from(gBrowser.tabContainer.querySelectorAll('zen-folder')).filter(f => {
      const fWsId = f.getAttribute('zen-workspace-id');
      const activeWsId = window.gZenWorkspaces?.activeWorkspace;
      return !activeWsId || !fWsId || fWsId === activeWsId;
    });
    const activeWsId = window.gZenWorkspaces?.activeWorkspace;
    const existingTabs = getVisibleTabs().filter(t =>
      !t.hasAttribute('zen-essential') && !t.hasAttribute('zen-empty-tab') &&
      (!activeWsId || t.getAttribute('zen-workspace-id') === activeWsId)
    );

    const placeholder = gBrowser.addTab('about:blank', { triggeringPrincipal: principal });
    // Wait for placeholder tab to be in the DOM before selecting it
    await waitFor(() => placeholder.parentNode && !placeholder.closing);
    gBrowser.selectedTab = placeholder;

    for (const folder of existingFolders) {
      try {
        if (typeof folder.delete === 'function') folder.delete();
        else if (typeof gBrowser.removeTabGroup === 'function') gBrowser.removeTabGroup(folder, { isUserTriggered: true });
      } catch (e) { log(`Remove folder during replace failed: ${e}`); }
    }
    // Wait for folders to be removed from the DOM
    await waitFor(() => existingFolders.every(f => !f.parentNode));

    const tabsToRemove = existingTabs.filter(t => t !== placeholder && !t.closing && t.parentNode);
    if (tabsToRemove.length > 0) {
      try { gBrowser.removeTabs(tabsToRemove, { closeWindowWithLastTab: false }); }
      catch (e) { for (const t of tabsToRemove) { try { gBrowser.removeTab(t); } catch (e2) {} } }
    }
    // Wait for old tabs to start closing / leave the DOM
    await waitFor(() => tabsToRemove.every(t => t.closing || !t.parentNode));

    await restoreLayout(wsData);

    try {
      if (!placeholder.closing && placeholder.parentNode) gBrowser.removeTab(placeholder);
    } catch (e) {}
  }

  // --- Restore: tree-based layout restoration ---

  async function restoreLayout(wsData) {
    const layout = getWorkspaceLayout(wsData);
    if (!layout || layout.length === 0) return;

    const principal = Services.scriptSecurityManager.getSystemPrincipal();
    const openedTabs = []; // [{ item, tab }]
    const normalTabRefs = []; // unpinned tabs for explicit reordering

    for (const item of layout) {
      if (item.type === 'tab') {
        restoreTabItem(item, openedTabs, normalTabRefs, principal);
      } else if (item.type === 'folder' && window.gZenFolders) {
        await restoreFolderFromLayout(item, null, openedTabs, normalTabRefs, principal);
      } else if (item.type === 'folder') {
        // No folder support: open folder tabs as flat
        for (const child of flattenLayoutTabs(item)) {
          restoreTabItem(child, openedTabs, normalTabRefs, principal);
        }
      }
    }

    // Fix unpinned tab order: addTab can insert at wrong position when
    // zen.view.show-newtab-button-top is true (every tab goes to the same
    // position, reversing order). Explicitly move them into correct order.
    if (normalTabRefs.length > 1) {
      // Wait for all normal tabs to be in the DOM before reordering
      await waitFor(() => normalTabRefs.every(t => t && t.parentNode && !t.closing));
      const normalContainer = gZenWorkspaces?.activeWorkspaceStrip;
      if (normalContainer) {
        const periphery = normalContainer.querySelector('#tabbrowser-arrowscrollbox-periphery');
        for (const tab of normalTabRefs) {
          if (tab && tab.parentNode && !tab.closing) {
            if (periphery) normalContainer.insertBefore(tab, periphery);
            else normalContainer.appendChild(tab);
          }
        }
      }
    }

    // Verify DOM layout matches saved layout and fix remaining discrepancies.
    // Loop until order is confirmed correct (Zen may async-reorder after our moves).
    await verifyRestoredLayout(layout, openedTabs);

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
    if (item.customLabel) {
      tab.zenStaticLabel = item.customLabel;
      try { gBrowser._setTabLabel(tab, item.customLabel); } catch (e) {}
    }
  }

  function restoreTabItem(item, openedTabs, normalTabRefs, principal) {
    if (item.essential) {
      const existing = Array.from(gBrowser.tabs).find(t =>
        t.hasAttribute('zen-essential') && t.linkedBrowser?.currentURI?.spec === item.url
      );
      if (existing) return;
      const tab = gBrowser.addTab(item.url, { triggeringPrincipal: principal, skipAnimation: true });
      tab.setAttribute('zen-essential', 'true');
      gBrowser.pinTab(tab);
      applyCustomLabel(tab, item);
      openedTabs.push({ item, tab });
    } else if (item.pinned) {
      const tab = gBrowser.addTab(item.url, { triggeringPrincipal: principal, skipAnimation: true });
      gBrowser.pinTab(tab);
      applyCustomLabel(tab, item);
      openedTabs.push({ item, tab });
    } else {
      const tab = gBrowser.addTab(item.url, { triggeringPrincipal: principal, skipAnimation: true });
      applyCustomLabel(tab, item);
      openedTabs.push({ item, tab });
      normalTabRefs.push(tab);
    }
  }

  async function restoreFolderFromLayout(folderItem, insertAfterElement, openedTabs, normalTabRefs, principal) {
    // Phase 1: create direct tab children, defer subfolders
    const directTabRefs = [];
    const childItems = []; // { type: 'tab'|'folder', ref?, data? }

    for (const child of folderItem.children) {
      if (child.type === 'tab') {
        const tab = gBrowser.addTab(child.url, { triggeringPrincipal: principal, skipAnimation: true });
        applyCustomLabel(tab, child);
        directTabRefs.push(tab);
        openedTabs.push({ item: child, tab });
        childItems.push({ type: 'tab', ref: tab });
      } else if (child.type === 'folder') {
        childItems.push({ type: 'folder', data: child, ref: null });
      }
    }

    // Wait for all folder tabs to be present in the DOM before creating the folder
    await waitFor(() => directTabRefs.every(t => t.parentNode && !t.closing));

    // Phase 2: create folder with its direct tabs
    const folderOpts = {
      label: folderItem.name,
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
      log(`Create folder "${folderItem.name}" failed: ${e}`);
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
          childItem.data, subInsertAfter, openedTabs, normalTabRefs, principal
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
  // Zen may asynchronously reorder tabs after our DOM moves.
  // Uses waitFor() instead of fixed delays so verification completes as soon
  // as Zen's async reorders finish.
  async function verifyRestoredLayout(layout, openedTabs) {
    const MAX_ATTEMPTS = 5;
    const ATTEMPT_TIMEOUT_MS = 500;

    try {
      const wsElement = gZenWorkspaces?.activeWorkspaceElement;
      if (!wsElement) return;

      const normalContainer = wsElement.tabsContainer;
      if (!normalContainer) return;

      // Build expected tab ref order from layout.
      // We compare by element reference (not URL) because tabs haven't loaded
      // yet — currentURI.spec is still about:blank right after addTab().
      const expectedTabRefs = [];
      const tabRefToUrl = new Map(); // for debug logging
      for (const { item, tab } of openedTabs) {
        if (!item.pinned && !item.essential && tab && !tab.closing) {
          expectedTabRefs.push(tab);
          tabRefToUrl.set(tab, item.url);
        }
      }
      if (expectedTabRefs.length === 0) {
        log('Verify: no normal tabs to verify');
        return;
      }

      const shorten = u => { try { return new URL(u).hostname + new URL(u).pathname.slice(0, 30); } catch (e) { return (u || '').slice(0, 50); } };

      // Helper: read current DOM order and check against expected
      function checkOrder() {
        const actualTabRefs = [];
        for (const child of normalContainer.children) {
          if (!gBrowser.isTab(child)) continue;
          if (child.hasAttribute('zen-empty-tab') || child.hasAttribute('zen-glance-tab')) continue;
          actualTabRefs.push(child);
        }
        if (actualTabRefs.length < expectedTabRefs.length) return { correct: false, actualTabRefs, firstMismatchIdx: -1 };
        for (let i = 0; i < expectedTabRefs.length; i++) {
          if (actualTabRefs[i] !== expectedTabRefs[i]) return { correct: false, actualTabRefs, firstMismatchIdx: i };
        }
        return { correct: true, actualTabRefs, firstMismatchIdx: -1 };
      }

      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        // Wait for order to become correct (exits early if Zen finishes reorder)
        const settled = await waitFor(() => checkOrder().correct, { timeout: ATTEMPT_TIMEOUT_MS });
        if (settled) {
          log(`Verify: order confirmed correct on attempt ${attempt}`);
          return;
        }

        const { actualTabRefs, firstMismatchIdx } = checkOrder();

        // Debug: show expected vs actual
        log(`Verify: attempt ${attempt} — expected ${expectedTabRefs.length} tabs, DOM has ${actualTabRefs.length}, first mismatch at index ${firstMismatchIdx}`);
        const debugLen = Math.max(expectedTabRefs.length, actualTabRefs.length);
        for (let i = 0; i < Math.min(debugLen, 15); i++) {
          const exp = tabRefToUrl.get(expectedTabRefs[i]) || '(none)';
          const act = tabRefToUrl.get(actualTabRefs[i]) || `(unknown: ${actualTabRefs[i]?.linkedBrowser?.currentURI?.spec || '?'})`;
          const marker = expectedTabRefs[i] === actualTabRefs[i] ? '  ' : '>>';
          log(`  ${marker} [${i}] expected: ${shorten(exp)}  |  actual: ${shorten(act)}`);
        }

        // Reorder by moving each expected tab to correct position
        const periphery = normalContainer.querySelector('#tabbrowser-arrowscrollbox-periphery');
        for (const tab of expectedTabRefs) {
          if (tab && tab.parentNode && !tab.closing) {
            if (periphery) normalContainer.insertBefore(tab, periphery);
            else normalContainer.appendChild(tab);
          }
        }
      }

      log(`Verify: gave up after ${MAX_ATTEMPTS} attempts — order may still be wrong`);
    } catch (e) {
      log(`Verify layout failed (non-fatal): ${e}`);
    }
  }

  // --- List / Detail Flow ---

  function getListSessionsPickerResults(query) {
    if (!sessionCache) {
      loadAllSessions().then(() => renderCommandResults());
      return [{ key: 'list:loading', label: 'Loading sessions...', icon: '⏳', tags: [] }];
    }
    const results = buildSessionPickerResults(sessionCache.sessions, 'list-session');
    return fuzzyFilterAndSort(results, query);
  }

  function getSessionDetailViewResults(query) {
    const session = commandSubFlow?.data?.session;
    if (!session) return [{ key: 'detail:error', label: 'No session data', icon: '⚠', tags: [] }];

    const results = [];

    // Header with session info
    const dateStr = formatSessionDate(session.savedAt);
    results.push({
      key: 'detail:info',
      label: `${session.comment || 'No comment'} — saved ${dateStr}`,
      icon: '💾',
      sublabel: `${session.stats.totalTabCount} tabs · ${session.stats.workspaceCount} workspace${session.stats.workspaceCount !== 1 ? 's' : ''}`,
      tags: [],
    });

    for (const ws of session.workspaces) {
      if (session.workspaces.length > 1) {
        const wsLayout = getWorkspaceLayout(ws);
        const wsTabCount = wsLayout ? countLayoutStats(wsLayout).tabs : 0;
        results.push({
          key: `detail:ws-${ws.name}`,
          label: `${ws.icon || '🗂'} ${ws.name}`,
          icon: '',
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
        results.push({ key: 'detail:empty', label: 'No tabs', icon: '', tags: [] });
      }
    }

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

  function getDeleteSessionConfirmResults() {
    const sessionId = commandSubFlow?.data?.sessionId;
    return [
      { key: 'delete-session:confirm', label: 'Delete this session permanently? Press Enter.', icon: '🗑', sublabel: sessionId || '', tags: [] },
      { key: 'delete-session:cancel', label: 'Press Esc to cancel', icon: '↩', tags: [] },
    ];
  }

  // ============================================
  // UPDATE SYSTEM
  // ============================================

  const ZENLEAP_SCRIPT_URL = 'https://raw.githubusercontent.com/yashas-salankimatt/ZenLeap/main/JS/zenleap.uc.js';
  const ZENLEAP_CSS_URL = 'https://raw.githubusercontent.com/yashas-salankimatt/ZenLeap/main/chrome.css';
  const ZENLEAP_CHANGELOG_URL = 'https://raw.githubusercontent.com/yashas-salankimatt/ZenLeap/main/CHANGELOG.md';

  let updateModal = null;
  let updateMode = false;
  let updateModalState = null; // 'checking' | 'available' | 'progress' | 'success' | 'error' | 'uptodate'
  let updateToast = null;
  let updateToastVersion = null;
  let updateStylesInjected = false;

  // Parse version from script content (matches @version X.Y.Z)
  function parseVersionFromContent(content) {
    const match = content.match(/@version\s+([0-9.]+)/);
    return match ? match[1] : null;
  }

  // Compare semantic versions: true if v1 >= v2
  function versionGte(v1, v2) {
    const a = v1.split('.').map(Number);
    const b = v2.split('.').map(Number);
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
      const x = a[i] || 0;
      const y = b[i] || 0;
      if (x > y) return true;
      if (x < y) return false;
    }
    return true; // equal
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

  // HTTP GET via XMLHttpRequest (fetch hangs in Firefox chrome context)
  function httpGet(url, timeoutMs = 15000) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('GET', url, true);
      xhr.timeout = timeoutMs;
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(xhr.responseText);
        } else {
          reject(new Error(`HTTP ${xhr.status}`));
        }
      };
      xhr.onerror = () => reject(new Error('Network error'));
      xhr.ontimeout = () => reject(new Error('Request timed out'));
      xhr.send();
    });
  }

  // Check for updates — returns { available, remoteVersion, changelog[] } or null on error
  async function checkForZenLeapUpdate() {
    try {
      const content = await httpGet(ZENLEAP_SCRIPT_URL);
      const remoteVersion = parseVersionFromContent(content);
      if (!remoteVersion) throw new Error('Could not parse remote version');

      const available = !versionGte(VERSION, remoteVersion);

      // Fetch changelog (best-effort)
      let changelog = [];
      if (available) {
        try {
          const clContent = await httpGet(ZENLEAP_CHANGELOG_URL);
          changelog = parseChangelog(clContent, remoteVersion);
        } catch (e) { /* changelog fetch failed, non-critical */ }
      }

      return { available, remoteVersion, changelog };
    } catch (e) {
      log(`Update check failed: ${e}`);
      return null;
    }
  }

  // Download and install the update
  // Callback: onProgress('downloading' | 'installing-js' | 'installing-css' | 'done' | 'error', detail?)
  async function downloadAndInstallUpdate(onProgress) {
    try {
      // --- Download JS ---
      onProgress('downloading', 'Fetching zenleap.uc.js from GitHub');
      const jsContent = await httpGet(ZENLEAP_SCRIPT_URL);

      const newVersion = parseVersionFromContent(jsContent);
      if (!newVersion) throw new Error('Downloaded JS has no version');

      // --- Download CSS ---
      onProgress('downloading', 'Fetching chrome.css from GitHub');
      const cssContent = await httpGet(ZENLEAP_CSS_URL);

      // --- Install JS ---
      onProgress('installing-js', 'Writing zenleap.uc.js to profile');
      const jsDir = PathUtils.join(PathUtils.profileDir, 'chrome', 'JS');
      await IOUtils.makeDirectory(jsDir, { createAncestors: true, ignoreExisting: true });
      const jsPath = PathUtils.join(jsDir, 'zenleap.uc.js');
      await IOUtils.write(jsPath, new TextEncoder().encode(jsContent));
      log(`Updated zenleap.uc.js to v${newVersion}`);

      // --- Install CSS ---
      onProgress('installing-css', 'Updating styles in userChrome.css');
      const chromeDir = PathUtils.join(PathUtils.profileDir, 'chrome');
      const userChromePath = PathUtils.join(chromeDir, 'userChrome.css');

      let existingCSS = '';
      try {
        const existingBytes = await IOUtils.read(userChromePath);
        existingCSS = new TextDecoder().decode(existingBytes);
      } catch (e) {
        // File doesn't exist yet — that's fine
      }

      // Remove old ZenLeap styles (between markers)
      const markerStart = '/* === ZenLeap Styles === */';
      const markerEnd = '/* === End ZenLeap Styles === */';
      const startIdx = existingCSS.indexOf(markerStart);
      const endIdx = existingCSS.indexOf(markerEnd);
      if (startIdx !== -1 && (endIdx === -1 || endIdx >= startIdx)) {
        // Remove from just before the marker (including leading newlines) to end of end-marker
        let removeStart = startIdx;
        while (removeStart > 0 && existingCSS[removeStart - 1] === '\n') removeStart--;
        const removeEnd = endIdx !== -1 ? endIdx + markerEnd.length : existingCSS.length;
        existingCSS = existingCSS.slice(0, removeStart) + existingCSS.slice(removeEnd);
      }

      // Append new styles
      const newCSS = existingCSS.trimEnd() + '\n\n' + markerStart + '\n' + cssContent + '\n' + markerEnd + '\n';
      await IOUtils.write(userChromePath, new TextEncoder().encode(newCSS));
      log('Updated styles in userChrome.css');

      onProgress('done', newVersion);
      return { success: true, version: newVersion };
    } catch (e) {
      log(`Update install failed: ${e}`);
      onProgress('error', e.message);
      return { success: false, error: e.message };
    }
  }

  // Should we auto-check based on settings?
  function shouldAutoCheckForUpdates() {
    if (!S['updates.autoCheck']) return false;
    const freq = S['updates.checkFrequency'];
    const lastCheck = S['updates.lastCheckTime'] || 0;
    const now = Date.now();

    if (freq === 'startup') return true;
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
    header.innerHTML = `<div><h2 id="zenleap-update-title">Checking for Updates</h2><span class="zenleap-update-subtitle" id="zenleap-update-subtitle">Contacting GitHub...</span></div>`;
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

    const style = document.createElement('style');
    style.id = 'zenleap-update-styles';
    style.textContent = `
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
      .zenleap-update-changelog::-webkit-scrollbar { width: 6px; }
      .zenleap-update-changelog::-webkit-scrollbar-track { background: transparent; }
      .zenleap-update-changelog::-webkit-scrollbar-thumb { background: var(--zl-border-strong); border-radius: 3px; }
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
      .zenleap-toast-keys {
        display: flex; align-items: center; gap: 8px;
        margin-left: 4px; font-size: 11px; color: var(--zl-text-muted);
      }
      .zenleap-toast-keys kbd {
        display: inline-block; font-family: var(--zl-font-mono); font-size: 10px; font-weight: 600;
        background: var(--zl-bg-elevated); color: var(--zl-text-secondary);
        padding: 2px 6px; border-radius: var(--zl-r-sm); border: 1px solid var(--zl-border-subtle);
      }
    `;
    document.head.appendChild(style);
  }

  function setUpdateHeader(title, subtitle) {
    const titleEl = document.getElementById('zenleap-update-title');
    const subtitleEl = document.getElementById('zenleap-update-subtitle');
    if (titleEl) titleEl.textContent = title;
    if (subtitleEl) subtitleEl.textContent = subtitle;
  }

  function setUpdateBody() {
    const body = document.getElementById('zenleap-update-body');
    if (body) body.innerHTML = '';
    return body;
  }

  function renderUpdateAvailable(remoteVersion, changelog) {
    updateModalState = 'available';
    setUpdateHeader('Update Available', 'A new version of ZenLeap is ready');
    const body = setUpdateBody();
    if (!body) return;

    // Version comparison
    const versions = document.createElement('div');
    versions.className = 'zenleap-update-versions';
    versions.innerHTML = `
      <div class="zenleap-version-pill">
        <span class="zenleap-version-pill-label">Installed</span>
        <span class="zenleap-version-pill-number">${VERSION}</span>
      </div>
      <span class="zenleap-version-arrow">\u2192</span>
      <div class="zenleap-version-pill new">
        <span class="zenleap-version-pill-label">Available</span>
        <span class="zenleap-version-pill-number">${remoteVersion}</span>
      </div>
    `;
    body.appendChild(versions);

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
          row.innerHTML = `<span class="zenleap-changelog-tag ${tagClass}">${item.tag}</span>`;
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
    body.appendChild(actions);
  }

  function renderUpdateProgress(status, detail) {
    updateModalState = 'progress';
    setUpdateHeader('Updating ZenLeap', status === 'downloading' ? 'Downloading from GitHub' : 'Installing to profile');
    const body = setUpdateBody();
    if (!body) return;

    const progress = document.createElement('div');
    progress.className = 'zenleap-update-progress';

    const statusText = document.createElement('span');
    statusText.className = 'zenleap-update-progress-status';
    statusText.textContent = status === 'downloading' ? 'Downloading update...' : 'Installing update...';

    const track = document.createElement('div');
    track.className = 'zenleap-update-progress-bar-track';
    const fill = document.createElement('div');
    fill.className = 'zenleap-update-progress-bar-fill';
    if (status === 'downloading') {
      fill.classList.add('indeterminate');
    } else {
      fill.style.width = '75%';
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

    const result = document.createElement('div');
    result.className = 'zenleap-update-result';
    result.innerHTML = `
      <div class="zenleap-update-result-icon success">\u2713</div>
      <div class="zenleap-update-result-title success">Updated to v${newVersion}</div>
      <div class="zenleap-update-result-detail">ZenLeap has been updated. Restart Zen Browser<br>to activate the new version.</div>
    `;
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
        log(`Restart failed: ${e}`);
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
    actions.appendChild(retryBtn);
    body.appendChild(actions);
  }

  function renderUpdateUpToDate() {
    updateModalState = 'uptodate';
    setUpdateHeader('Check for Updates', 'Version check complete');
    const body = setUpdateBody();
    if (!body) return;

    const result = document.createElement('div');
    result.className = 'zenleap-update-result';
    result.innerHTML = `
      <div class="zenleap-update-result-icon uptodate">\u2713</div>
      <div class="zenleap-update-result-title uptodate">You're up to date</div>
      <div class="zenleap-update-result-detail">ZenLeap v${VERSION} is the latest version</div>
    `;
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
    renderUpdateProgress('downloading', 'Fetching files from GitHub');
    const result = await downloadAndInstallUpdate((status, detail) => {
      if (!updateMode) return;
      if (status === 'downloading' || status.startsWith('installing')) {
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
  }

  // Show update toast notification — persistent centered bar
  function showUpdateToast(remoteVersion) {
    // Don't show if user explicitly dismissed the toast for this version
    if (S['updates.dismissedVersion'] === remoteVersion) return;

    ensureUpdateStyles();
    dismissUpdateToast();

    const toast = document.createElement('div');
    toast.id = 'zenleap-update-toast';

    const text = document.createElement('span');
    text.className = 'zenleap-toast-text';
    text.innerHTML = `ZenLeap <strong>v${remoteVersion}</strong> available`;

    const keys = document.createElement('span');
    keys.className = 'zenleap-toast-keys';
    keys.innerHTML = `<kbd>\u21B5</kbd> update <kbd>Esc</kbd> dismiss`;

    toast.appendChild(text);
    toast.appendChild(keys);

    document.documentElement.appendChild(toast);
    updateToast = toast;
    updateToastVersion = remoteVersion;
  }

  function dismissUpdateToast(suppress) {
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

  // Auto-check for updates (called from init)
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
      showUpdateToast(result.remoteVersion);
    }
  }

  // ============================================
  // FOLDER DELETE MODAL (browse mode)
  // ============================================

  function showFolderDeleteModal(folder) {
    folderDeleteMode = true;
    folderDeleteTarget = folder;

    const folderName = folder.label || folder.getAttribute('zen-folder-name') || 'Unnamed Folder';
    const tabCount = folder.tabs?.filter(t => !t.hasAttribute('zen-empty-tab')).length || 0;

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
    title.textContent = `Delete "${folderName}" (${tabCount} tab${tabCount !== 1 ? 's' : ''})?`;
    container.appendChild(title);

    container.appendChild(createDeleteOption('1', 'Delete folder and all tabs', 'Removes the folder and closes all tabs inside it', () => deleteFolderAndContents(folderDeleteTarget)));
    container.appendChild(createDeleteOption('2', 'Delete folder only (keep tabs)', 'Removes the folder but keeps all tabs', () => deleteFolderKeepTabs(folderDeleteTarget)));
    container.appendChild(createDeleteOption('Esc', 'Cancel', '', () => closeFolderDeleteModal()));

    folderDeleteModal.appendChild(backdrop);
    folderDeleteModal.appendChild(container);
    folderDeleteModal.classList.add('active');
    log(`Showing folder delete modal for "${folderName}"`);
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

  function deleteFolderAndContents(folder) {
    try {
      const targetFolder = document.getElementById(folder.id);
      if (!targetFolder) { closeFolderDeleteModal(); return; }

      const name = targetFolder.label || targetFolder.getAttribute('zen-folder-name') || 'Unnamed Folder';
      const tabs = targetFolder.tabs?.filter(t => !t.hasAttribute('zen-empty-tab')) || [];

      // Store undo data BEFORE deleting
      folderUndoStack.push({
        type: 'folder-and-contents',
        folderLabel: name,
        folderId: folder.id,
        tabCount: tabs.length,
        timestamp: Date.now(),
      });

      // Use zen-folder's native delete() which cleans up zen-empty-tab placeholders first,
      // matching the command bar's deleteFolder() behavior
      if (typeof targetFolder.delete === 'function') {
        targetFolder.delete();
      } else if (typeof gBrowser.removeTabGroup === 'function') {
        gBrowser.removeTabGroup(targetFolder, { isUserTriggered: true });
      }

      log(`Deleted folder and contents: ${name} (${tabs.length} tabs)`);
    } catch (e) { log(`Delete folder+contents failed: ${e}`); }

    closeFolderDeleteModal();
    adjustHighlightAfterDeletion();
  }

  function deleteFolderKeepTabs(folder) {
    try {
      const targetFolder = document.getElementById(folder.id);
      if (!targetFolder) { closeFolderDeleteModal(); return; }

      const name = targetFolder.label || targetFolder.getAttribute('zen-folder-name') || 'Unnamed Folder';
      const tabs = targetFolder.tabs?.filter(t => !t.hasAttribute('zen-empty-tab')) || [];

      // Store undo data: folder metadata + tab references for recreation
      folderUndoStack.push({
        type: 'folder-only',
        folderLabel: name,
        folderId: folder.id,
        tabRefs: tabs.map(t => t),
        timestamp: Date.now(),
      });

      // Unpack tabs from the folder (keeps tabs, removes folder structure)
      if (typeof targetFolder.unpackTabs === 'function') {
        targetFolder.unpackTabs();
      } else {
        // Fallback: manually ungroup each tab, then delete the empty folder
        for (const tab of tabs) {
          try { gBrowser.ungroupTab(tab); } catch (e) { /* tab may already be ungrouped */ }
        }
        // Now delete the empty folder shell
        if (typeof gBrowser.removeTabGroup === 'function') {
          gBrowser.removeTabGroup(targetFolder, { isUserTriggered: false });
        } else if (typeof targetFolder.delete === 'function') {
          targetFolder.delete();
        }
      }

      log(`Deleted folder (kept tabs): ${name} (${tabs.length} tabs freed)`);
    } catch (e) { log(`Delete folder (keep tabs) failed: ${e}`); }

    closeFolderDeleteModal();
    adjustHighlightAfterDeletion();
  }

  function adjustHighlightAfterDeletion() {
    _visibleItemsCache = null; // Invalidate after DOM mutation (folder/tab deletion)
    const newItems = getVisibleItems();
    if (newItems.length === 0) {
      exitLeapMode(false);
      return;
    }
    if (highlightedTabIndex >= newItems.length) {
      highlightedTabIndex = newItems.length - 1;
    }
    updateHighlight();
    updateLeapOverlayState();
  }

  // Undo the last folder deletion. Returns true if handled, false to let browser handle.
  function undoLastFolderDelete() {
    if (folderUndoStack.length === 0) {
      return false; // Nothing to undo, let browser's native Cmd+Shift+T handle it
    }

    const entry = folderUndoStack[folderUndoStack.length - 1];

    // Only undo if recent (within 30 seconds)
    if (Date.now() - entry.timestamp > 30000) {
      folderUndoStack.length = 0;
      return false;
    }

    if (entry.type === 'folder-and-contents') {
      // For folder+contents: native SessionStore handles this since we used isUserTriggered: true
      // Pop the entry and let the browser's Cmd+Shift+T restore it
      folderUndoStack.pop();
      return false; // Do NOT prevent default — let browser handle
    }

    if (entry.type === 'folder-only') {
      // Recreate folder with the tabs that are still alive
      folderUndoStack.pop();
      const liveTabs = entry.tabRefs.filter(t => t && !t.closing && t.parentNode);
      if (liveTabs.length === 0) {
        log('Undo: all tabs from deleted folder are gone');
        return true;
      }
      try {
        if (window.gZenFolders) {
          gZenFolders.createFolder(liveTabs, {
            label: entry.folderLabel,
            renameFolder: false,
          });
          log(`Undo: recreated folder "${entry.folderLabel}" with ${liveTabs.length} tabs`);
        } else {
          log('Undo: gZenFolders not available');
          return false;
        }
      } catch (e) { log(`Undo folder recreation failed: ${e}`); }
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

      const currentTab = gBrowser.selectedTab;
      const currentNode = splitter.getSplitNodeFromTab(currentTab);
      if (!currentNode?.positionToRoot) return false;

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
    const currentTab = gBrowser.selectedTab;
    const currentIndex = items.indexOf(currentTab);
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

    log('Entered gTile mode (move)');
  }

  function exitGtileMode(apply) {
    if (!gtileMode) return;

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
        const gap = 2;
        region.style.inset = `calc(${rect.top}% + ${gap}px) calc(${rect.right}% + ${gap}px) calc(${rect.bottom}% + ${gap}px) calc(${rect.left}% + ${gap}px)`;
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
      const t = themes[S['appearance.theme']] || themes.meridian;
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
            : '<span><kbd>Drag</kbd> select</span><span><kbd>Click</kbd> target</span><span><kbd>1-9</kbd> preset</span><span><kbd>Tab</kbd> move</span><span><kbd>Esc</kbd> close</span>';
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
      if (gtileSubMode === 'move') {
        gtileSubMode = 'resize';
        gtileOverlay.classList.remove('mode-move');
        gtileOverlay.classList.add('mode-resize');
        gtileHeld = false;
        // Set focused tab to active region's tab for resize
        const activeRect = gtileTabRects[gtileActiveRegionIdx];
        if (activeRect) {
          gtileFocusedTab = activeRect.tab;
          // Position cell cursor at center of that region
          const cx = (activeRect.left + (100 - activeRect.right)) / 2;
          const cy = (activeRect.top + (100 - activeRect.bottom)) / 2;
          gtileCursor.col = Math.max(0, Math.min(GTILE_COLS - 1, Math.round(cx / 100 * GTILE_COLS - 0.5)));
          gtileCursor.row = Math.max(0, Math.min(GTILE_ROWS - 1, Math.round(cy / 100 * GTILE_ROWS - 0.5)));
        }
        gtileSelecting = false;
        gtileAnchor = null;
      } else {
        gtileSubMode = 'move';
        gtileOverlay.classList.remove('mode-resize');
        gtileOverlay.classList.add('mode-move');
        gtileSelecting = false;
        gtileAnchor = null;
      }
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
      gtileSubMode = 'resize';
      gtileOverlay.classList.remove('mode-move');
      gtileOverlay.classList.add('mode-resize');
      gtileHeld = false;
      const activeRect = gtileTabRects[gtileActiveRegionIdx];
      if (activeRect) gtileFocusedTab = activeRect.tab;
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

    const splitter = window.gZenViewSplitter;
    if (!splitter) return;

    const activeRect = gtileTabRects[gtileActiveRegionIdx];
    const neighborRect = gtileTabRects[neighborIdx];

    const node1 = splitter.getSplitNodeFromTab(activeRect.tab);
    const node2 = splitter.getSplitNodeFromTab(neighborRect.tab);
    if (!node1 || !node2) return;

    // Swap nodes in the split tree
    splitter.swapNodes(node1, node2);

    // Re-apply layout to update browser positions
    const viewData = splitter._data[splitter.currentView];
    splitter.applyGridLayout(viewData.layoutTree);

    // Re-map regions from updated layout
    const activeTab = activeRect.tab;
    mapCurrentLayoutToGrid(viewData);

    // Follow the active tab
    gtileActiveRegionIdx = gtileTabRects.findIndex(r => r.tab === activeTab);
    if (gtileActiveRegionIdx < 0) gtileActiveRegionIdx = 0;

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

  function performGtileSwapByIndex(aIdx, bIdx) {
    // Actually swap the tabs in the split tree (same logic as performGtileSwap)
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

  function setupGtileMouseEvents(grid, cellLayer, modeSwitch) {
    const DRAG_THRESHOLD = 5;

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
        if (newMode === 'resize') {
          gtileSubMode = 'resize';
          gtileOverlay.classList.remove('mode-move');
          gtileOverlay.classList.add('mode-resize');
          gtileHeld = false;
          const activeRect = gtileTabRects[gtileActiveRegionIdx];
          if (activeRect) {
            gtileFocusedTab = activeRect.tab;
            const cx = (activeRect.left + (100 - activeRect.right)) / 2;
            const cy = (activeRect.top + (100 - activeRect.bottom)) / 2;
            gtileCursor.col = Math.max(0, Math.min(GTILE_COLS - 1, Math.round(cx / 100 * GTILE_COLS - 0.5)));
            gtileCursor.row = Math.max(0, Math.min(GTILE_ROWS - 1, Math.round(cy / 100 * GTILE_ROWS - 0.5)));
          }
          gtileSelecting = false;
          gtileAnchor = null;
        } else {
          gtileSubMode = 'move';
          gtileOverlay.classList.remove('mode-resize');
          gtileOverlay.classList.add('mode-move');
          gtileSelecting = false;
          gtileAnchor = null;
        }
        updateGtileOverlay();
      });
    });

    // --- Move mode: click to select, drag to grab & swap ---
    let moveMouseDown = null; // { idx, startX, startY, offsetXPct, offsetYPct, regW, regH }

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
      moveMouseDown = {
        idx,
        startX: e.clientX, startY: e.clientY,
        offsetXPct: (e.clientX - regionRect.left) / gridRect.width * 100,
        offsetYPct: (e.clientY - regionRect.top) / gridRect.height * 100,
        regW: 100 - rect.left - rect.right,
        regH: 100 - rect.top - rect.bottom,
      };
      updateGtileOverlay();
    });

    document.addEventListener('mousemove', (e) => {
      if (!moveMouseDown || !gtileMode || gtileSubMode !== 'move') return;

      const dx = e.clientX - moveMouseDown.startX;
      const dy = e.clientY - moveMouseDown.startY;

      if (!gtileDrag && Math.sqrt(dx * dx + dy * dy) < DRAG_THRESHOLD) return;

      // Enter drag mode
      if (!gtileDrag) {
        gtileDrag = {
          idx: moveMouseDown.idx,
          isDragging: true,
          swapIdx: -1,
          origRects: gtileTabRects.map(r => ({ left: r.left, top: r.top, right: r.right, bottom: r.bottom })),
          offsetXPct: moveMouseDown.offsetXPct,
          offsetYPct: moveMouseDown.offsetYPct,
          regW: moveMouseDown.regW,
          regH: moveMouseDown.regH,
        };

        const regionEl = gtileRegionElements.get(gtileTabRects[gtileDrag.idx]?.tab);
        if (regionEl) {
          regionEl.classList.add('gtile-dragging');
          // Disable position transitions on dragged element
          regionEl.style.transition = 'transform 0.12s ease-out, box-shadow 0.15s, border-color 0.15s';
        }

        // Show ghost at original position
        const orig = gtileDrag.origRects[gtileDrag.idx];
        const gap = 2;
        if (gtileGhostEl) {
          gtileGhostEl.style.display = 'block';
          gtileGhostEl.style.inset = `calc(${orig.top}% + ${gap}px) calc(${orig.right}% + ${gap}px) calc(${orig.bottom}% + ${gap}px) calc(${orig.left}% + ${gap}px)`;
        }
        updateGtileOverlay();
      }

      // Position dragged region following mouse
      const gridRect = grid.getBoundingClientRect();
      const mxPct = (e.clientX - gridRect.left) / gridRect.width * 100;
      const myPct = (e.clientY - gridRect.top) / gridRect.height * 100;
      let newL = Math.max(0, Math.min(100 - gtileDrag.regW, mxPct - gtileDrag.offsetXPct));
      let newT = Math.max(0, Math.min(100 - gtileDrag.regH, myPct - gtileDrag.offsetYPct));
      const newR = 100 - newL - gtileDrag.regW;
      const newB = 100 - newT - gtileDrag.regH;

      const regionEl = gtileRegionElements.get(gtileTabRects[gtileDrag.idx]?.tab);
      if (regionEl) {
        const gap = 2;
        regionEl.style.inset = `calc(${newT}% + ${gap}px) calc(${newR}% + ${gap}px) calc(${newB}% + ${gap}px) calc(${newL}% + ${gap}px)`;
      }

      // Hit test: which original region zone is mouse cursor over?
      const cursorXPct = mxPct, cursorYPct = myPct;
      let bestIdx = -1;
      for (let i = 0; i < gtileTabRects.length; i++) {
        if (i === gtileDrag.idx) continue;
        const o = gtileDrag.origRects[i];
        if (cursorXPct >= o.left && cursorXPct <= (100 - o.right) &&
            cursorYPct >= o.top && cursorYPct <= (100 - o.bottom)) {
          bestIdx = i;
          break;
        }
      }

      // Update swap partner if changed
      if (bestIdx !== gtileDrag.swapIdx) {
        // Revert previous partner
        if (gtileDrag.swapIdx >= 0) {
          const prevOrig = gtileDrag.origRects[gtileDrag.swapIdx];
          const prevRect = gtileTabRects[gtileDrag.swapIdx];
          prevRect.left = prevOrig.left; prevRect.top = prevOrig.top;
          prevRect.right = prevOrig.right; prevRect.bottom = prevOrig.bottom;
        }
        // Set new partner
        if (bestIdx >= 0) {
          const dragOrig = gtileDrag.origRects[gtileDrag.idx];
          const partnerRect = gtileTabRects[bestIdx];
          partnerRect.left = dragOrig.left; partnerRect.top = dragOrig.top;
          partnerRect.right = dragOrig.right; partnerRect.bottom = dragOrig.bottom;
          // Ghost moves to partner's original position (landing zone)
          const partnerOrig = gtileDrag.origRects[bestIdx];
          const gap = 2;
          if (gtileGhostEl) {
            gtileGhostEl.style.inset = `calc(${partnerOrig.top}% + ${gap}px) calc(${partnerOrig.right}% + ${gap}px) calc(${partnerOrig.bottom}% + ${gap}px) calc(${partnerOrig.left}% + ${gap}px)`;
          }
        } else {
          // No partner: ghost at drag origin
          const orig = gtileDrag.origRects[gtileDrag.idx];
          const gap = 2;
          if (gtileGhostEl) {
            gtileGhostEl.style.inset = `calc(${orig.top}% + ${gap}px) calc(${orig.right}% + ${gap}px) calc(${orig.bottom}% + ${gap}px) calc(${orig.left}% + ${gap}px)`;
          }
        }
        gtileDrag.swapIdx = bestIdx;
        updateGtileOverlay();
      }
    }, { passive: true });

    document.addEventListener('mouseup', (e) => {
      if (!gtileMode || gtileSubMode !== 'move') { moveMouseDown = null; return; }
      if (!moveMouseDown) return;

      if (gtileDrag && gtileDrag.isDragging) {
        const draggedEl = gtileRegionElements.get(gtileTabRects[gtileDrag.idx]?.tab);
        if (draggedEl) {
          draggedEl.classList.remove('gtile-dragging');
          draggedEl.style.transition = '';
        }
        if (gtileGhostEl) gtileGhostEl.style.display = 'none';

        if (gtileDrag.swapIdx >= 0) {
          // Confirm swap via the split tree
          const aIdx = gtileDrag.idx;
          const bIdx = gtileDrag.swapIdx;
          // Restore original rects before performing real swap
          for (let i = 0; i < gtileTabRects.length; i++) {
            const orig = gtileDrag.origRects[i];
            gtileTabRects[i].left = orig.left; gtileTabRects[i].top = orig.top;
            gtileTabRects[i].right = orig.right; gtileTabRects[i].bottom = orig.bottom;
          }
          gtileDrag = null;
          performGtileSwapByIndex(aIdx, bIdx);
          flashGtileGrid('gtile-rotated'); // green-ish confirmation pulse
        } else {
          // No swap target: revert
          const orig = gtileDrag.origRects[gtileDrag.idx];
          gtileTabRects[gtileDrag.idx].left = orig.left;
          gtileTabRects[gtileDrag.idx].top = orig.top;
          gtileTabRects[gtileDrag.idx].right = orig.right;
          gtileTabRects[gtileDrag.idx].bottom = orig.bottom;
          gtileDrag = null;
        }
        updateGtileOverlay();
      }

      moveMouseDown = null;
    });

    // --- Resize mode: hover tracking on cells ---
    cellLayer.addEventListener('mousemove', (e) => {
      if (!gtileMode || gtileSubMode !== 'resize') return;
      const gridRect = grid.getBoundingClientRect();
      const col = Math.max(0, Math.min(GTILE_COLS - 1, Math.floor((e.clientX - gridRect.left) / gridRect.width * GTILE_COLS)));
      const row = Math.max(0, Math.min(GTILE_ROWS - 1, Math.floor((e.clientY - gridRect.top) / gridRect.height * GTILE_ROWS)));
      gtileCursor.col = col;
      gtileCursor.row = row;
      updateGtileOverlay();
    });

    // --- Resize mode: click+drag to select cells, or click non-target region to change target ---
    // Disambiguate click vs drag: always start cell selection on mousedown,
    // but on mouseup if the mouse didn't move, treat as a click to change target.
    let resizeMouseStart = null; // { x, y, potentialTargetTab }
    cellLayer.addEventListener('mousedown', (e) => {
      if (!gtileMode || gtileSubMode !== 'resize' || e.button !== 0) return;
      e.preventDefault();

      const gridRect = grid.getBoundingClientRect();
      const clickXPct = (e.clientX - gridRect.left) / gridRect.width * 100;
      const clickYPct = (e.clientY - gridRect.top) / gridRect.height * 100;

      // Check if click is over a non-target region (for potential target change on simple click)
      let potentialTargetTab = null;
      for (let i = 0; i < gtileTabRects.length; i++) {
        const rect = gtileTabRects[i];
        if (rect.tab === gtileFocusedTab) continue;
        if (clickXPct >= rect.left && clickXPct <= (100 - rect.right) &&
            clickYPct >= rect.top && clickYPct <= (100 - rect.bottom)) {
          potentialTargetTab = rect.tab;
          break;
        }
      }

      resizeMouseStart = { x: e.clientX, y: e.clientY, potentialTargetTab };

      // Always start cell selection (drag will extend it, click will be caught on mouseup)
      const col = Math.max(0, Math.min(GTILE_COLS - 1, Math.floor(clickXPct / 100 * GTILE_COLS)));
      const row = Math.max(0, Math.min(GTILE_ROWS - 1, Math.floor(clickYPct / 100 * GTILE_ROWS)));
      gtileAnchor = { col, row };
      gtileCursor.col = col;
      gtileCursor.row = row;
      gtileSelecting = true;
      gtileMouseSelecting = true;
      updateGtileOverlay();
    });

    // Drag extends selection (document-level for dragging outside cells)
    document.addEventListener('mousemove', (e) => {
      if (!gtileMode || gtileSubMode !== 'resize' || !gtileMouseSelecting) return;
      const gridRect = grid.getBoundingClientRect();
      const col = Math.max(0, Math.min(GTILE_COLS - 1, Math.floor((e.clientX - gridRect.left) / gridRect.width * GTILE_COLS)));
      const row = Math.max(0, Math.min(GTILE_ROWS - 1, Math.floor((e.clientY - gridRect.top) / gridRect.height * GTILE_ROWS)));
      gtileCursor.col = col;
      gtileCursor.row = row;
      updateGtileOverlay();
    }, { passive: true });

    // Release: disambiguate click (change target) vs drag (apply cell selection)
    document.addEventListener('mouseup', (e) => {
      if (!gtileMode || gtileSubMode !== 'resize' || !gtileMouseSelecting) return;
      gtileMouseSelecting = false;

      const CLICK_THRESHOLD = 5; // px — below this, treat as a click not a drag
      const didDrag = resizeMouseStart &&
        (Math.abs(e.clientX - resizeMouseStart.x) > CLICK_THRESHOLD ||
         Math.abs(e.clientY - resizeMouseStart.y) > CLICK_THRESHOLD);

      if (!didDrag && resizeMouseStart?.potentialTargetTab) {
        // Simple click on a non-target region — change resize target
        gtileFocusedTab = resizeMouseStart.potentialTargetTab;
        gtileSelecting = false;
        gtileAnchor = null;
        resizeMouseStart = null;
        updateGtileOverlay();
        return;
      }

      resizeMouseStart = null;
      // Drag completed — apply the layout (same as pressing Enter with a selection)
      if (gtileSelecting && gtileAnchor) {
        exitGtileMode(true);
      }
    });

  }

  function flashGtileGrid(cls) {
    const grid = gtileOverlay?.querySelector('#zenleap-gtile-grid');
    if (!grid) return;
    grid.classList.remove(cls);
    void grid.offsetHeight;
    grid.classList.add(cls);
    setTimeout(() => grid.classList.remove(cls), 400);
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
      splitter.removeSplitters();
      splitter._tabToSplitNode.clear();
      splitter.applyGridLayout(root);
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
      let allTabs = [];
      function collectTabs(node) {
        if (!node) return;
        if (!node.children || node.children.length === 0) {
          if (node.tab) allTabs.push(node.tab);
        } else {
          node.children.forEach(collectTabs);
        }
      }
      collectTabs(root);
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
      splitter.removeSplitters();
      splitter._tabToSplitNode.clear();
      viewData.layoutTree = newRoot;
      splitter.applyGridLayout(newRoot);
      return true;
    }

    // 4+ tabs: cycle through toggle + all-columns + all-rows
    // Detect if all children are direct leaves of root
    const classes4 = getNodeClasses();
    if (!classes4) return false;

    let allTabs4 = [];
    function collectTabs4(node) {
      if (!node) return;
      if (!node.children || node.children.length === 0) {
        if (node.tab) allTabs4.push(node.tab);
      } else {
        node.children.forEach(collectTabs4);
      }
    }
    collectTabs4(root);
    if (allTabs4.length < 2) return false;

    const isAllLeaves4 = root.children?.length === allTabs4.length &&
      root.children.every(c => !c.children || c.children.length === 0);

    const size4 = parseFloat((100 / allTabs4.length).toFixed(4));

    if (isAllLeaves4 && root.direction === 'row') {
      // Currently all-columns → next is all-rows
      const newRoot = new classes4.SplitNode('column', 100);
      newRoot.children = allTabs4.map(t => new classes4.LeafNode(t, size4));
      splitter.removeSplitters();
      splitter._tabToSplitNode.clear();
      viewData.layoutTree = newRoot;
      splitter.applyGridLayout(newRoot);
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
      splitter.removeSplitters();
      splitter._tabToSplitNode.clear();
      viewData.layoutTree = newRoot;
      splitter.applyGridLayout(newRoot);
    } else {
      // Nested layout → next is all-columns
      const newRoot = new classes4.SplitNode('row', 100);
      newRoot.children = allTabs4.map(t => new classes4.LeafNode(t, size4));
      splitter.removeSplitters();
      splitter._tabToSplitNode.clear();
      viewData.layoutTree = newRoot;
      splitter.applyGridLayout(newRoot);
    }
    return true;
  }

  function flashGtileRotate() {
    const grid = gtileOverlay?.querySelector('#zenleap-gtile-grid');
    if (grid) {
      grid.classList.remove('gtile-rotated');
      // Force reflow to restart animation
      void grid.offsetWidth;
      grid.classList.add('gtile-rotated');
      setTimeout(() => grid.classList.remove('gtile-rotated'), 400);
    }
  }

  function handleGtileRotate() {
    if (rotateSplitLayout()) {
      // Re-map regions from updated layout
      const splitter = window.gZenViewSplitter;
      const viewData = splitter._data[splitter.currentView];
      mapCurrentLayoutToGrid(viewData);

      // Maintain active region / focused tab across rotation
      if (gtileSubMode === 'move') {
        const activeTab = gtileTabRects[gtileActiveRegionIdx]?.tab;
        if (activeTab) {
          const newIdx = gtileTabRects.findIndex(r => r.tab === activeTab);
          gtileActiveRegionIdx = newIdx >= 0 ? newIdx : 0;
        }
      } else if (gtileSubMode === 'resize') {
        // Reset selection state — cell coordinates are meaningless after layout change
        gtileSelecting = false;
        gtileAnchor = null;
        gtileCursor = { col: 0, row: 0 };

        // Re-find focused tab in new region order
        if (gtileFocusedTab) {
          const newIdx = gtileTabRects.findIndex(r => r.tab === gtileFocusedTab);
          gtileActiveRegionIdx = newIdx >= 0 ? newIdx : 0;
        }
      }

      updateGtileOverlay();
      flashGtileRotate();
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

  function flashGtileReset() {
    const grid = gtileOverlay?.querySelector('#zenleap-gtile-grid');
    if (grid) {
      grid.classList.remove('gtile-reset');
      void grid.offsetWidth;
      grid.classList.add('gtile-reset');
      setTimeout(() => grid.classList.remove('gtile-reset'), 400);
    }
  }

  function handleGtileReset() {
    if (resetLayoutSizes()) {
      const splitter = window.gZenViewSplitter;
      const viewData = splitter._data[splitter.currentView];
      mapCurrentLayoutToGrid(viewData);

      if (gtileSubMode === 'move') {
        const activeTab = gtileTabRects[gtileActiveRegionIdx]?.tab;
        if (activeTab) {
          const newIdx = gtileTabRects.findIndex(r => r.tab === activeTab);
          gtileActiveRegionIdx = newIdx >= 0 ? newIdx : 0;
        }
      } else if (gtileSubMode === 'resize') {
        gtileSelecting = false;
        gtileAnchor = null;
        gtileCursor = { col: 0, row: 0 };
        if (gtileFocusedTab) {
          const newIdx = gtileTabRects.findIndex(r => r.tab === gtileFocusedTab);
          gtileActiveRegionIdx = newIdx >= 0 ? newIdx : 0;
        }
      }

      updateGtileOverlay();
      flashGtileReset();
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

    // Find valid rectangular partition of remaining space
    const remainingRects = partitionRemainingSpace(occupied, otherTabs.length, GTILE_COLS, GTILE_ROWS);
    if (!remainingRects) {
      log('gTile: No valid layout found — selection leaves no valid partition for remaining tabs');
      flashGtileError();
      return;
    }

    // Assign other tabs to remaining regions by proximity to their current positions
    const assignedRects = assignTabsToRegions(otherTabs, remainingRects);

    // Build the final set of rects
    const allRects = [focusedRect, ...assignedRects];

    // Build split tree from rectangles
    const classes = getNodeClasses();
    if (!classes) {
      log('gTile: Could not get node classes');
      return;
    }

    const tree = buildSplitTreeFromRects(allRects, GTILE_COLS, GTILE_ROWS, classes);
    if (!tree) {
      log('gTile: Failed to build split tree from rectangles');
      flashGtileError();
      return;
    }

    // Apply the new layout
    try {
      splitter.removeSplitters();
      splitter._tabToSplitNode.clear();
      viewData.layoutTree = tree;
      splitter.applyGridLayout(tree);
      log('gTile: Layout applied successfully');
    } catch (e) {
      log(`gTile: Error applying layout: ${e}`);
    }
  }

  function flashGtileError() {
    const grid = gtileOverlay?.querySelector('#zenleap-gtile-grid');
    if (grid) {
      grid.classList.add('gtile-error');
      setTimeout(() => grid.classList.remove('gtile-error'), 400);
    }
  }

  function partitionRemainingSpace(occupied, numRects, cols, rows) {
    // Find first unoccupied cell (scan top-left to bottom-right)
    let startR = -1, startC = -1;
    for (let r = 0; r < rows && startR === -1; r++) {
      for (let c = 0; c < cols && startR === -1; c++) {
        if (!occupied[r][c]) { startR = r; startC = c; }
      }
    }

    if (startR === -1) {
      return numRects === 0 ? [] : null;
    }
    if (numRects === 0) return null;

    // Try all possible rectangles starting from (startR, startC)
    for (let endC = startC + 1; endC <= cols; endC++) {
      // Check column validity at startR
      if (occupied[startR][endC - 1]) break;

      for (let endR = startR + 1; endR <= rows; endR++) {
        // Check if entire row strip from startC..endC is unoccupied at row endR-1
        let rowValid = true;
        for (let c = startC; c < endC; c++) {
          if (occupied[endR - 1][c]) { rowValid = false; break; }
        }
        if (!rowValid) break;

        // Also verify full rectangle is unoccupied (handles irregular previous placements)
        let rectValid = true;
        for (let r = startR; r < endR && rectValid; r++) {
          for (let c = startC; c < endC && rectValid; c++) {
            if (occupied[r][c]) rectValid = false;
          }
        }
        if (!rectValid) break;

        // Try this rectangle
        const newOccupied = occupied.map(row => [...row]);
        for (let r = startR; r < endR; r++) {
          for (let c = startC; c < endC; c++) {
            newOccupied[r][c] = true;
          }
        }

        const rest = partitionRemainingSpace(newOccupied, numRects - 1, cols, rows);
        if (rest !== null) {
          return [{ col1: startC, row1: startR, col2: endC, row2: endR }, ...rest];
        }
      }
    }

    return null;
  }

  function assignTabsToRegions(tabs, regions) {
    // Greedy assignment: match each tab to the closest unassigned region
    const splitter = window.gZenViewSplitter;
    const assigned = [];
    const usedRegions = new Set();

    // Compute current center of each tab
    const tabCenters = tabs.map(tab => {
      const node = splitter.getSplitNodeFromTab(tab);
      if (!node?.positionToRoot) return { x: 50, y: 50 };
      const pos = node.positionToRoot;
      return {
        x: (pos.left + (100 - pos.right)) / 2,
        y: (pos.top + (100 - pos.bottom)) / 2,
      };
    });

    // Compute center of each region (in percentage space)
    const regionCenters = regions.map(r => ({
      x: ((r.col1 + r.col2) / 2) / GTILE_COLS * 100,
      y: ((r.row1 + r.row2) / 2) / GTILE_ROWS * 100,
    }));

    for (let t = 0; t < tabs.length; t++) {
      let bestRegion = -1;
      let bestDist = Infinity;
      for (let ri = 0; ri < regions.length; ri++) {
        if (usedRegions.has(ri)) continue;
        const dx = tabCenters[t].x - regionCenters[ri].x;
        const dy = tabCenters[t].y - regionCenters[ri].y;
        const dist = dx * dx + dy * dy;
        if (dist < bestDist) { bestDist = dist; bestRegion = ri; }
      }
      usedRegions.add(bestRegion);
      assigned.push({ tab: tabs[t], ...regions[bestRegion] });
    }

    return assigned;
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
      if (count === 0) {
        html += `<div class="zenleap-command-count">No duplicate tabs found</div>`;
      } else {
        html += `<div class="zenleap-command-count">${count} duplicate${count !== 1 ? 's' : ''} will be closed — press Enter to confirm</div>`;
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
            html += `<div class="zenleap-command-group-header"><span class="zenleap-command-group-icon">${group.icon}</span>${escapeHtml(group.label)}</div>`;
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
        const headerClass = cmd.isHeader ? ' zenleap-session-header' : '';

        html += `
          <div class="zenleap-command-result ${isSelected ? 'selected' : ''}${headerClass}" data-index="${idx}">
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
            <div class="zenleap-help-item"><kbd>0</kbd><span>Jump to first unpinned tab</span></div>
            <div class="zenleap-help-item"><kbd>$</kbd><span>Jump to last tab</span></div>
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
            <div class="zenleap-help-item"><kbd>Shift</kbd>+<kbd>J</kbd>/<kbd>K</kbd><span>Navigate + extend selection</span></div>
            <div class="zenleap-help-item"><kbd>Space</kbd><span>Toggle selection on tab</span></div>
            <div class="zenleap-help-item"><kbd>y</kbd> / <kbd>Y</kbd><span>Yank highlighted or selected tabs</span></div>
            <div class="zenleap-help-item"><kbd>p</kbd> / <kbd>P</kbd><span>Paste after / before</span></div>
            <div class="zenleap-help-item"><kbd>h</kbd> / <kbd>l</kbd> / <kbd>&#8592;</kbd> / <kbd>&#8594;</kbd><span>Switch workspace</span></div>
            <div class="zenleap-help-item"><kbd>gg</kbd> / <kbd>G</kbd><span>Jump to first / last tab</span></div>
            <div class="zenleap-help-item"><kbd>Enter</kbd><span>Open tab / toggle folder</span></div>
            <div class="zenleap-help-item"><kbd>x</kbd><span>Close selected/highlighted tab(s)</span></div>
            <div class="zenleap-help-item"><kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>/</kbd><span>Command bar with selection</span></div>
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
          <h2>&#128190; Workspace Sessions</h2>
          <p class="zenleap-help-trigger">Via command palette (<kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>/</kbd>)</p>
          <div class="zenleap-help-grid">
            <div class="zenleap-help-item"><kbd>> save session</kbd><span>Save current workspace tabs + folders</span></div>
            <div class="zenleap-help-item"><kbd>> restore session</kbd><span>Restore a saved session</span></div>
            <div class="zenleap-help-item"><kbd>> list sessions</kbd><span>Browse and manage saved sessions</span></div>
          </div>
        </div>

        <div class="zenleap-help-section">
          <h2>&#9881; Quick Navigation</h2>
          <p class="zenleap-help-trigger">Works globally without entering leap mode</p>
          <div class="zenleap-help-grid">
            <div class="zenleap-help-item"><kbd>Alt</kbd>+<kbd>j</kbd><span>Next tab (or split pane below)</span></div>
            <div class="zenleap-help-item"><kbd>Alt</kbd>+<kbd>k</kbd><span>Previous tab (or split pane above)</span></div>
            <div class="zenleap-help-item"><kbd>Alt</kbd>+<kbd>h</kbd><span>Previous workspace (or pane left)</span></div>
            <div class="zenleap-help-item"><kbd>Alt</kbd>+<kbd>l</kbd><span>Next workspace (or pane right)</span></div>
            <div class="zenleap-help-item"><kbd>Alt</kbd>+<kbd>Space</kbd><span>gTile resize overlay</span></div>
          </div>
        </div>

        <div class="zenleap-help-section">
          <h2>&#127912; Themes</h2>
          <p class="zenleap-help-trigger">Settings &gt; Appearance or command palette</p>
          <div class="zenleap-help-grid">
            <div class="zenleap-help-item"><kbd>&gt; settings</kbd><span>Appearance tab: theme selector + editor</span></div>
            <div class="zenleap-help-item"><kbd>&gt; reload-themes</kbd><span>Reload themes from JSON file</span></div>
            <div class="zenleap-help-item"><kbd>&gt; open-themes-file</kbd><span>Open zenleap-themes.json in editor</span></div>
          </div>
          <p style="margin: 8px 0 0; font-size: 11px; color: var(--zl-text-muted);">7 built-in themes. Create custom themes in Settings &gt; Appearance &gt; Custom Themes.</p>
        </div>
      </div>

      <div class="zenleap-help-footer">
        <span><kbd>j</kbd>/<kbd>k</kbd> scroll &#183; <kbd>g</kbd>/<kbd>G</kbd> top/bottom &#183; <kbd>Esc</kbd> close</span>
      </div>
    `;

    helpModal.appendChild(backdrop);
    helpModal.appendChild(container);

    // Inject styles
    const style = document.createElement('style');
    style.id = 'zenleap-help-styles';
    style.textContent = `
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
      .zenleap-help-item kbd {
        background: var(--zl-accent-dim); color: var(--zl-accent); padding: 3px 8px;
        border-radius: var(--zl-r-sm); font-family: var(--zl-font-mono); font-size: 11px; font-weight: 600;
        border: 1px solid var(--zl-accent-border); min-width: 20px; text-align: center;
        box-shadow: var(--zl-shadow-kbd);
      }
      .zenleap-help-item span { color: var(--zl-text-secondary); flex: 1; }
      .zenleap-help-footer {
        padding: 16px 32px; border-top: 1px solid var(--zl-border-subtle);
        text-align: center; font-size: 12px; color: var(--zl-text-muted);
      }
      .zenleap-help-footer kbd {
        background: var(--zl-bg-elevated); color: var(--zl-text-secondary);
        padding: 2px 6px; border-radius: var(--zl-r-sm); font-family: var(--zl-font-mono); font-size: 10px;
      }
      .zenleap-help-content::-webkit-scrollbar { width: 8px; }
      .zenleap-help-content::-webkit-scrollbar-track { background: transparent; }
      .zenleap-help-content::-webkit-scrollbar-thumb { background: var(--zl-border-strong); border-radius: 4px; }
      .zenleap-help-content::-webkit-scrollbar-thumb:hover { background: var(--zl-text-muted); }
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

    // Exit other modes if active
    if (leapMode) exitLeapMode(false);
    if (reorgMode) exitReorgMode(false);

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
    const style = document.createElement('style');
    style.id = 'zenleap-reorg-styles';
    style.textContent = `
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
      #zenleap-reorg-list::-webkit-scrollbar { width: 6px; }
      #zenleap-reorg-list::-webkit-scrollbar-track { background: transparent; }
      #zenleap-reorg-list::-webkit-scrollbar-thumb { background: var(--zl-border-strong); border-radius: 3px; }

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
      }

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

    `;

    document.head.appendChild(style);
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

      // Icon
      const icon = document.createElement('span');
      icon.className = 'zenleap-reorg-icon';
      icon.textContent = ws.icon || '\uD83D\uDDC2';

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
      window.removeEventListener('mousemove', onMouseMove, true);
      window.removeEventListener('mouseup', onMouseUp, true);

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

    window.addEventListener('mousemove', onMouseMove, true);
    window.addEventListener('mouseup', onMouseUp, true);
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

    // Apply the new order using reorderWorkspace API
    // Iterate from first to last, placing each workspace at its target index
    try {
      for (let targetIdx = 0; targetIdx < targetOrder.length; targetIdx++) {
        const ws = targetOrder[targetIdx];
        const currentWorkspaces = gZenWorkspaces.getWorkspaces();
        const currentIdx = currentWorkspaces.findIndex(w => w.uuid === ws.uuid);
        if (currentIdx !== targetIdx) {
          await gZenWorkspaces.reorderWorkspace(ws.uuid, targetIdx);
        }
      }
      log(`Reorganized ${targetOrder.length} workspaces`);
    } catch (e) {
      log(`Reorganize workspaces failed: ${e}`);
    }
  }

  function enterReorgMode() {
    if (reorgMode) return;

    // Exit other modes
    if (leapMode) exitLeapMode(false);
    if (searchMode) exitSearchMode();

    // Load workspaces
    if (!window.gZenWorkspaces) { log('gZenWorkspaces not available'); return; }
    const workspaces = gZenWorkspaces.getWorkspaces();
    if (!workspaces || workspaces.length < 2) { log('Not enough workspaces to reorganize'); return; }

    reorgWorkspaces = workspaces.map(ws => ({ uuid: ws.uuid, name: ws.name || 'Unnamed', icon: ws.icon || '' }));
    reorgOriginalOrder = reorgWorkspaces.map(ws => ({ ...ws }));
    reorgFocusIndex = 0;
    reorgMovingIndex = -1;

    createReorgModal();
    renderReorgList();

    reorgMode = true;
    reorgModal.classList.add('active');

    log('Entered reorganize workspaces mode');
  }

  function exitReorgMode(apply = false) {
    if (!reorgMode) return;

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
      #zenleap-settings-body::-webkit-scrollbar { width: 8px; }
      #zenleap-settings-body::-webkit-scrollbar-track { background: transparent; }
      #zenleap-settings-body::-webkit-scrollbar-thumb { background: var(--zl-border-strong); border-radius: 4px; }
      #zenleap-settings-body::-webkit-scrollbar-thumb:hover { background: var(--zl-text-muted); }
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
      /* Toggle switch */
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
      .zenleap-color-control { display: flex; align-items: center; gap: 8px; }
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
      .zenleap-import-changes::-webkit-scrollbar { width: 6px; }
      .zenleap-import-changes::-webkit-scrollbar-track { background: transparent; }
      .zenleap-import-changes::-webkit-scrollbar-thumb { background: var(--zl-border-strong); border-radius: 3px; }
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
      .zenleap-import-btn-cancel:hover { background: var(--zl-bg-hover); color: var(--zl-text-primary); }
      .zenleap-import-btn-apply {
        padding: 7px 18px; border-radius: var(--zl-r-sm); border: 1px solid var(--zl-accent-border);
        background: var(--zl-accent-dim); color: var(--zl-accent); font-size: 12px; font-weight: 600;
        font-family: var(--zl-font-ui); cursor: pointer; transition: all 0.15s;
      }
      .zenleap-import-btn-apply:hover { background: var(--zl-accent-mid); border-color: var(--zl-accent); }
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
        row.classList.toggle('modified', JSON.stringify(S[id]) !== JSON.stringify(schema.default));
      });
      control.appendChild(select);
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
    if (reorgMode) exitReorgMode(false);

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

    const hintKbd = document.createElement('kbd');
    hintKbd.textContent = '\u21B5';
    const hintText = document.createTextNode(' to update');
    updateHint.appendChild(hintKbd);
    updateHint.appendChild(hintText);
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
      gBrowser.addTab('https://github.com/yashas-salankimatt/ZenLeap', {
        triggeringPrincipal: Services.scriptSecurityManager.getSystemPrincipal(),
      });
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
    const theme = themes[key];
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
    try {
      const content = await IOUtils.readUTF8(themesPath);
      const rawThemes = JSON.parse(content);
      const rawDef = rawThemes[key];
      if (!rawDef) return;

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
      console.warn('[ZenLeap] Error loading theme for editing:', e);
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

  function applyThemeEditorPreview() {
    if (!themeEditorActive) return;
    const base = BUILTIN_THEMES[themeEditorBase] || BUILTIN_THEMES.meridian;
    const merged = { ...base, name: themeEditorName, ...themeEditorDraft };
    const previewKey = '__zenleap_preview__';
    themes[previewKey] = merged;
    const prevTheme = S['appearance.theme'];
    S['appearance.theme'] = previewKey;
    applyTheme();
    S['appearance.theme'] = prevTheme;
    delete themes[previewKey];
  }

  async function saveThemeFromEditor() {
    if (!themeEditorName.trim()) {
      const nameInput = settingsModal?.querySelector('.zenleap-theme-editor-name');
      if (nameInput) { nameInput.style.borderColor = 'var(--zl-error)'; nameInput.placeholder = 'Name required'; setTimeout(() => { nameInput.style.borderColor = ''; nameInput.placeholder = 'Theme name'; }, 2000); }
      return;
    }

    const themesPath = PathUtils.join(PathUtils.profileDir, 'chrome', 'zenleap-themes.json');
    let rawThemes = {};
    try {
      const content = await IOUtils.readUTF8(themesPath);
      rawThemes = JSON.parse(content);
    } catch (e) { /* start fresh */ }

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
      await IOUtils.writeUTF8(themesPath, JSON.stringify(rawThemes, null, 2));
      log(`Saved theme "${themeEditorName}" to zenleap-themes.json`);
    } catch (e) {
      console.warn('[ZenLeap] Error saving theme:', e);
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
    const btn = settingsModal?.querySelector(`.zenleap-theme-card-btn.delete[data-key="${key}"]`);
    if (btn && !btn.dataset.confirming) {
      btn.dataset.confirming = 'true';
      btn.textContent = 'Confirm?';
      btn.style.color = 'var(--zl-error)';
      btn.style.borderColor = 'var(--zl-error)';
      setTimeout(() => { if (btn.dataset.confirming) { delete btn.dataset.confirming; btn.textContent = 'Delete'; btn.style.color = ''; btn.style.borderColor = ''; } }, 3000);
      return;
    }

    const themesPath = PathUtils.join(PathUtils.profileDir, 'chrome', 'zenleap-themes.json');
    try {
      const content = await IOUtils.readUTF8(themesPath);
      const rawThemes = JSON.parse(content);
      delete rawThemes[key];
      await IOUtils.writeUTF8(themesPath, JSON.stringify(rawThemes, null, 2));
      log(`Deleted theme "${themeName}"`);
    } catch (e) {
      console.warn('[ZenLeap] Error deleting theme:', e);
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

    // Collect tabs: selected tabs (sorted by position), or just highlighted tab
    // Use getVisibleItems() to resolve highlighted item (which may be a folder),
    // since highlightedTabIndex indexes into the items list (tabs + folders)
    let collectedTabs;
    if (selectedItems.size > 0) {
      collectedTabs = sortTabsBySidebarPosition([...selectedItems].filter(t => t && !t.closing && t.parentNode && !isFolder(t)));
    } else if (highlightedTabIndex >= 0 && highlightedTabIndex < items.length) {
      const highlightedItem = items[highlightedTabIndex];
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

    // Clean up browse command state
    browseCommandMode = false;
    browseCommandTabs = [];
    savedBrowseState = null;

    // Re-show browse mode UI
    document.documentElement.setAttribute('data-zenleap-active', 'true');
    stealFocusFromContent();
    showLeapOverlay();
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

    createSearchModal();

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

  // Exit search mode
  function exitSearchMode() {
    if (!searchMode) return;

    searchMode = false;
    searchModal.classList.remove('active');
    cancelPendingJJ();
    clearTimeout(_searchInputDebounceTimer);

    // Reset vim mode to insert for next time
    searchVimMode = 'insert';

    // Restore theme if exiting while in theme live-preview
    if (_themePreviewOriginal) {
      S['appearance.theme'] = _themePreviewOriginal;
      saveSettings();
      applyTheme();
      _themePreviewOriginal = null;
    }

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
    if (browseCommandMode) {
      document.documentElement.removeAttribute('data-zenleap-active');
      restoreFocusToContent();
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

    _pluginEventBus.emit('searchMode:exit', {});
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

    // Live-preview theme when navigating the theme-picker
    if (commandSubFlow?.type === 'theme-picker') {
      const results = commandMode ? commandResults : searchResults;
      const selectedResult = results[newIndex];
      if (selectedResult?.themeId && themes[selectedResult.themeId]) {
        S['appearance.theme'] = selectedResult.themeId;
        applyTheme();
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

        handleCommandVimNormalMode(key, event);
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
        const oldIndex = searchSelectedIndex;
        searchSelectedIndex = commandResults.length - 1;
        updateSelectionHighlight(oldIndex, searchSelectedIndex);
      }
      return;
    }
    if (key === 'g') {
      const oldIndex = searchSelectedIndex;
      searchSelectedIndex = 0;
      updateSelectionHighlight(oldIndex, searchSelectedIndex);
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

  // ============================================
  // URL BAR VIM MODE (Cmd+L / Cmd+T native bar)
  // ============================================

  function getUrlbarInput() {
    try { return gURLBar?.inputField; } catch (e) { return null; }
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
    if (!urlbarVimActive || !S['display.vimModeInBars']) return;

    // Skip modifier-only keys — they never generate keypress/beforeinput
    // and would leave urlbarSuppressKeypress stuck true.
    if (e.key === 'Shift' || e.key === 'Control' || e.key === 'Alt' || e.key === 'Meta') return;

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
    // Escape: switch to normal mode
    if (e.key === 'Escape') {
      urlbarSuppressKeypress = true;
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      flushUrlbarJ(); // Commit any pending 'j' before switching modes
      const input = getUrlbarInput();
      urlbarCursorPos = input ? (input.selectionStart || 0) : 0;
      urlbarVimMode = 'normal';
      updateUrlbarVimIndicator();
      return;
    }

    // jj detection in insert mode
    const input = getUrlbarInput();
    if (!input) return;

    if (e.key === 'j' && !e.ctrlKey && !e.altKey && !e.metaKey) {
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

    // Flush pending j when any other key arrives
    if (urlbarJjPending) {
      flushUrlbarJ();
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
    if (!urlbarVimActive || !S['display.vimModeInBars']) return;
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
    if (urlbarSuppressKeypress) {
      e.preventDefault();
      return;
    }
    if (!urlbarVimActive || !S['display.vimModeInBars']) return;
    if (urlbarVimMode === 'normal') {
      e.preventDefault();
    }
  }

  // --- Focus/blur handlers attached to inputField ---
  function onUrlbarFocus() {
    if (urlbarVimActive) return; // Already active
    urlbarVimActive = true;
    urlbarVimMode = 'insert';
    urlbarCursorPos = 0;
    urlbarSuppressKeypress = false;
    cancelUrlbarJJ();
    if (S['display.vimModeInBars']) {
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
    gURLBar.addEventListener('keydown', urlbarInputKeyHandler, true);
    gURLBar.addEventListener('keypress', urlbarKeypressHandler, true);

    // beforeinput on the input itself — last line of defense
    input.addEventListener('beforeinput', urlbarBeforeinputHandler, true);

    // Focus/blur listeners for immediate badge display
    input.addEventListener('focus', onUrlbarFocus);
    input.addEventListener('blur', onUrlbarBlur);

    urlbarVimSetupDone = true;
    log('URL bar vim mode listeners attached (on gURLBar capture)');

    // If already focused, activate immediately
    if (gURLBar.focused) onUrlbarFocus();
  }

  // --- Indicator badge ---
  function ensureUrlbarVimIndicator() {
    if (urlbarVimIndicator && urlbarVimIndicator.isConnected) return;

    // moz-urlbar uses class, not id, for this container
    const container = gURLBar?.querySelector('.urlbar-input-container')
      || gURLBar?.inputField?.closest('.urlbar-input-container');
    if (!container) return;

    urlbarVimIndicator = document.createElement('span');
    urlbarVimIndicator.id = 'zenleap-urlbar-vim-indicator';
    urlbarVimIndicator.textContent = 'INSERT';

    // Append at the end of the input container (right side)
    container.appendChild(urlbarVimIndicator);
  }

  function updateUrlbarVimIndicator() {
    if (!S['display.vimModeInBars']) {
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
        // handleCommand failed — try loading the URL directly as fallback
        try {
          const url = input.value.trim();
          if (url) {
            gBrowser.loadURI(Services.io.newURI(url), {
              triggeringPrincipal: Services.scriptSecurityManager.getSystemPrincipal(),
            });
          }
        } catch (_) { /* truly no recourse */ }
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
        try {
          if (gURLBar.view?.isOpen) {
            gURLBar.controller.userSelectionBehavior = 'arrow';
            const count = gURLBar.view.visibleRowCount || 0;
            if (count > 0) gURLBar.view.selectBy(count, { reverse: false });
          }
        } catch (e) { /* ignore */ }
        break;

      case 'g': // Go to first autocomplete result
        try {
          if (gURLBar.view?.isOpen) {
            gURLBar.controller.userSelectionBehavior = 'arrow';
            const count = gURLBar.view.visibleRowCount || 0;
            if (count > 0) gURLBar.view.selectBy(count, { reverse: true });
          }
        } catch (e) { /* ignore */ }
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

      // Editing commands
      case 'x': // Delete character at cursor
        if (urlbarCursorPos < len) {
          input.value = text.slice(0, urlbarCursorPos) + text.slice(urlbarCursorPos + 1);
          if (urlbarCursorPos >= input.value.length && input.value.length > 0) {
            urlbarCursorPos = input.value.length - 1;
          }
          input.dispatchEvent(new Event('input', { bubbles: true }));
          updateUrlbarBlockCursor();
        }
        break;

      case 's': // Substitute (delete char and enter insert)
        if (urlbarCursorPos < len) {
          input.value = text.slice(0, urlbarCursorPos) + text.slice(urlbarCursorPos + 1);
          input.dispatchEvent(new Event('input', { bubbles: true }));
        }
        urlbarVimMode = 'insert';
        input.setSelectionRange(urlbarCursorPos, urlbarCursorPos);
        input.focus();
        updateUrlbarVimIndicator();
        break;

      case 'S': // Substitute entire line (clear all and enter insert mode)
        input.value = '';
        urlbarCursorPos = 0;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        urlbarVimMode = 'insert';
        input.setSelectionRange(0, 0);
        input.focus();
        updateUrlbarVimIndicator();
        break;

      case 'D': // Delete to end of line
        input.value = text.slice(0, urlbarCursorPos);
        if (urlbarCursorPos > 0 && input.value.length > 0) {
          urlbarCursorPos = input.value.length - 1;
        } else {
          urlbarCursorPos = 0;
        }
        input.dispatchEvent(new Event('input', { bubbles: true }));
        updateUrlbarBlockCursor();
        break;

      case 'C': // Change to end of line (delete to end + insert)
        input.value = text.slice(0, urlbarCursorPos);
        input.dispatchEvent(new Event('input', { bubbles: true }));
        urlbarVimMode = 'insert';
        input.setSelectionRange(urlbarCursorPos, urlbarCursorPos);
        input.focus();
        updateUrlbarVimIndicator();
        break;

      case 'd': // Delete character (like x for simplicity)
        if (urlbarCursorPos < len) {
          input.value = text.slice(0, urlbarCursorPos) + text.slice(urlbarCursorPos + 1);
          if (urlbarCursorPos >= input.value.length && input.value.length > 0) {
            urlbarCursorPos = input.value.length - 1;
          }
          input.dispatchEvent(new Event('input', { bubbles: true }));
          updateUrlbarBlockCursor();
        }
        break;

      case 'u': // Undo — trigger native undo on the input
        input.focus();
        try { document.execCommand('undo'); } catch (e) { /* undo not available */ }
        urlbarCursorPos = input.selectionStart || 0;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        updateUrlbarBlockCursor();
        break;

      case 'p': // Paste after cursor from clipboard
        navigator.clipboard.readText().then(clip => {
          if (!clip) return;
          // Re-read current state — the async gap may have allowed changes
          const inp = getUrlbarInput();
          if (!inp || !urlbarVimActive || urlbarVimMode !== 'normal') return;
          const currentText = inp.value || '';
          const currentLen = currentText.length;
          const pos = Math.min(urlbarCursorPos + 1, currentLen);
          inp.value = currentText.slice(0, pos) + clip + currentText.slice(pos);
          urlbarCursorPos = pos + clip.length - 1;
          inp.dispatchEvent(new Event('input', { bubbles: true }));
          updateUrlbarBlockCursor();
        }).catch(() => { /* clipboard read failed */ });
        break;
    }
  }

  // --- Setup: inject CSS for URL bar vim mode (called at init, no inputField dependency) ---
  function setupUrlbarVimMode() {
    // Prevent double-initialization of CSS
    if (document.getElementById('zenleap-urlbar-vim-styles')) return;

    const style = document.createElement('style');
    style.id = 'zenleap-urlbar-vim-styles';
    style.textContent = `
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
    `;
    document.head.appendChild(style);

    log('URL bar vim mode CSS injected');
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

  // Get visible tabs AND folders in DOM order (for browse mode navigation)
  // Uses a microtask-scoped cache so multiple calls within the same event handler
  // (e.g. moveHighlight -> updateHighlight -> updateLeapOverlayState) reuse one result
  // instead of rescanning and re-sorting the DOM each time.
  let _visibleItemsCache = null;

  function getVisibleItems() {
    if (_visibleItemsCache) return _visibleItemsCache;

    const tabs = getVisibleTabs().filter(tab => {
      // Exclude tabs inside collapsed folders — Zen hides the container,
      // not individual tabs, so tab.hidden stays false
      const folder = tab.group;
      if (folder && folder.isZenFolder && folder.collapsed) return false;
      return true;
    });
    const folders = Array.from(
      gBrowser.tabContainer.querySelectorAll('zen-folder')
    ).filter(folder => {
      const activeWsId = window.gZenWorkspaces?.activeWorkspace;
      const folderWsId = folder.getAttribute('zen-workspace-id');
      if (activeWsId && folderWsId && folderWsId !== activeWsId) return false;
      return true;
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

  // Update relative numbers on all tabs
  // Optimized: builds a reverse mark map (tab→char) once per call for O(1) lookup
  // instead of iterating the marks map per tab.
  function updateRelativeNumbers() {
    const tabs = getVisibleTabs();
    const currentTab = gBrowser.selectedTab;
    let currentIndex = tabs.indexOf(currentTab);

    // If the current tab isn't in the visible list (e.g. new tab page),
    // fall back to index 0 so relative numbers still render correctly.
    if (currentIndex === -1) {
      if (tabs.length === 0) return;
      currentIndex = 0;
    }

    // Clean up marks for closed tabs
    cleanupMarks();

    // Build reverse mark map for O(1) lookup per tab (instead of O(marks) via getMarkForTab)
    const tabToMark = new Map();
    for (const [char, markedTab] of marks) {
      tabToMark.set(markedTab, char);
    }

    tabs.forEach((tab, index) => {
      const relativeDistance = Math.abs(index - currentIndex);
      const direction = index < currentIndex ? 'up' : (index > currentIndex ? 'down' : 'current');
      const displayChar = numberToDisplay(relativeDistance);

      const mark = tabToMark.get(tab) || null;

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

  // Coalesce rapid relative-number updates into a single animation frame.
  // Used by event listeners that can fire in quick succession (TabOpen, TabClose,
  // ZenWorkspaceChanged) to avoid redundant DOM writes.
  let _relNumRafId = 0;
  function scheduleRelativeNumberUpdate() {
    if (_relNumRafId) return;
    _relNumRafId = requestAnimationFrame(() => {
      _relNumRafId = 0;
      updateRelativeNumbers();
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

    const style = document.createElement('style');
    style.id = 'zenleap-preview-styles';
    style.textContent = `
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
    // Uses a single static frame script per browser to avoid accumulating scripts,
    // but includes a per-call requestId so concurrent responses don't collide.
    try {
      return new Promise((resolve) => {
        const mm = browser.messageManager;
        if (!mm) { resolve({ x: 0, y: 0 }); return; }
        const requestId = Date.now() + '_' + Math.random();
        const timer = setTimeout(() => {
          try { mm.removeMessageListener('ZenLeap:ScrollPos:Response', handler); } catch (e) {}
          resolve({ x: 0, y: 0 });
        }, 300);
        function handler(msg) {
          if (msg.data?.requestId !== requestId) return; // Not our response
          clearTimeout(timer);
          try { mm.removeMessageListener('ZenLeap:ScrollPos:Response', handler); } catch (e) {}
          resolve(msg.data || { x: 0, y: 0 });
        }
        mm.addMessageListener('ZenLeap:ScrollPos:Response', handler);
        // Install the static frame script once per browser (allowDelayedLoad=false prevents re-injection)
        if (!browser._zenleapScrollScriptLoaded) {
          mm.loadFrameScript(`data:,
            addMessageListener('ZenLeap:ScrollPos:Request', function(msg) {
              sendAsyncMessage('ZenLeap:ScrollPos:Response', {
                requestId: msg.data && msg.data.requestId,
                x: content.scrollX || 0,
                y: content.scrollY || 0
              });
            });
          `, false);
          browser._zenleapScrollScriptLoaded = true;
        }
        mm.sendAsyncMessage('ZenLeap:ScrollPos:Request', { requestId });
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
      const pos = `${highlightedTabIndex + 1}/${items.length}`;
      let statusParts = [pos];

      // Show folder info when highlighted
      if (highlightedTabIndex >= 0 && highlightedTabIndex < items.length) {
        const highlightedItem = items[highlightedTabIndex];
        if (isFolder(highlightedItem)) {
          const tabCount = highlightedItem.tabs?.filter(t => !t.hasAttribute('zen-empty-tab')).length || 0;
          statusParts.push(`folder (${tabCount})`);
        }
      }

      if (selectedItems.size > 0) statusParts.push(`${selectedItems.size} sel`);
      if (yankItems.length > 0) statusParts.push(`${yankItems.length} yanked`);
      overlayDirectionLabel.textContent = statusParts.join(' | ');

      // Show contextual hints based on highlighted item type
      const onFolder = highlightedTabIndex >= 0 && highlightedTabIndex < items.length && isFolder(items[highlightedTabIndex]);
      if (onFolder && yankItems.length > 0) {
        overlayHintLabel.textContent = 'p=paste after  P=paste before  Enter=toggle fold  j/k=move  Esc=cancel';
      } else if (onFolder) {
        overlayHintLabel.textContent = 'Space=select  Enter=toggle fold  y=yank  x=delete  j/k=move  Esc=cancel';
      } else if (yankItems.length > 0) {
        overlayHintLabel.textContent = 'p=paste after  P=paste before  j/k=move  Esc=cancel';
      } else if (selectedItems.size > 0) {
        overlayHintLabel.textContent = 'y=yank  x=close sel  Ctrl+Shift+/=cmds  Space=toggle  Esc=cancel';
      } else {
        overlayHintLabel.textContent = 'j/k=move  Space=select  Ctrl+Shift+/=cmds  Enter=open  x=close  Esc=cancel';
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
  function stealFocusFromContent() {
    if (contentFocusStolen) return;
    try {
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

  // Intercept input for Alt+HJKL quick navigation: steal focus from content
  // to prevent keydown/keyup leaking to web pages, then restore after a delay.
  function interceptQuickNav() {
    stealFocusFromContent();
    quickNavInterceptedUntil = Date.now() + 300;
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
    highlightedTabIndex = -1;
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

    _pluginEventBus.emit('leapMode:enter', {});
    log('Entered leap mode');
  }

  // Enter browse mode
  function enterBrowseMode(direction) {
    const items = getVisibleItems();
    const currentTab = gBrowser.selectedTab;
    const currentIndex = items.indexOf(currentTab);

    // Evict the active tab's preview from cache — the user was just interacting
    // with it (scrolling, typing, etc.) so any cached snapshot is likely stale.
    previewCache.delete(currentTab);

    if (currentIndex === -1) {
      // Current tab not in visible items (e.g. new tab page, empty workspace tab).
      // Fall back to the first unpinned tab so browse mode can still start.
      if (items.length === 0) {
        log('Cannot enter browse mode: no visible items');
        return;
      }
      const firstUnpinned = items.findIndex(t => !isFolder(t) && !t.pinned && !t.hasAttribute('zen-essential'));
      const fallbackIndex = firstUnpinned >= 0 ? firstUnpinned : 0;

      browseMode = true;
      browseDirection = direction;
      originalTabIndex = fallbackIndex;
      originalTab = currentTab;
      highlightedTabIndex = fallbackIndex;
    } else {
      browseMode = true;
      browseDirection = direction;
      originalTabIndex = currentIndex;
      originalTab = items[currentIndex];

      // Move highlight one step in the initial direction
      if (direction === 'down') {
        highlightedTabIndex = Math.min(currentIndex + 1, items.length - 1);
      } else {
        highlightedTabIndex = Math.max(currentIndex - 1, 0);
      }
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

    if (syncSelection) {
      // Full sync: iterate all items to reconcile selection markers.
      // Needed when selection state changed (shift+move, toggle, clear, etc.)
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
    if (highlightedTabIndex >= 0 && highlightedTabIndex < items.length) {
      const highlightedItem = items[highlightedTabIndex];
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
          const currentItems = getVisibleItems();
          if (highlightedTabIndex >= 0 && highlightedTabIndex < currentItems.length) {
            const currentItem = currentItems[highlightedTabIndex];
            if (!isFolder(currentItem)) {
              showPreviewForTab(currentItem);
            }
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
    _previousHighlightedItem = null;
    // Dismiss folder delete modal if open
    if (folderDeleteMode) {
      closeFolderDeleteModal();
    }
  }

  // Move highlight up or down
  function moveHighlight(direction) {
    const items = getVisibleItems();

    if (direction === 'down') {
      highlightedTabIndex = Math.min(highlightedTabIndex + 1, items.length - 1);
    } else {
      highlightedTabIndex = Math.max(highlightedTabIndex - 1, 0);
    }

    // Fast path: only update old/new highlight items, skip full selection sync
    updateHighlight({ syncSelection: false });
    updateLeapOverlayState();
    log(`Moved highlight ${direction} to ${highlightedTabIndex}`);
  }

  // Shift+move: expand or contract selection based on direction
  function shiftMoveHighlight(direction) {
    const items = getVisibleItems();
    const prevIndex = highlightedTabIndex;
    moveHighlight(direction);
    if (highlightedTabIndex !== prevIndex) {
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
        _visibleItemsCache = null; // Ensure fresh data after workspace switch
        const newItems = getVisibleItems();
        const activeIdx = newItems.indexOf(gBrowser.selectedTab);
        highlightedTabIndex = activeIdx >= 0 ? activeIdx : 0;
        if (newItems.length > 0) {
          updateHighlight();
          updateRelativeNumbers();
          updateLeapOverlayState();
        }
        log(`Browse: workspace switched, ${newItems.length} items visible, highlight=${highlightedTabIndex}`);
      }, S['timing.workspaceSwitchDelay']);
    } catch (e) { log(`Workspace switch failed: ${e}`); }
  }

  // Jump directly to a tab N positions from original and open it
  // Direction is determined by where the highlight currently is relative to original
  function jumpAndOpenTab(distance) {
    const items = getVisibleItems();

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
    targetIndex = Math.max(0, Math.min(items.length - 1, targetIndex));

    if (targetIndex >= 0 && targetIndex < items.length) {
      const target = items[targetIndex];
      if (isFolder(target)) {
        // If jumping lands on a folder, toggle it instead
        target.collapsed = !target.collapsed;
        log(`Jumped ${direction} ${distance} from original, toggled folder "${target.label}"`);
        exitLeapMode(true);
        return;
      }
      gBrowser.selectedTab = target;
      log(`Jumped ${direction} ${distance} from original (highlight was ${highlightedTabIndex < originalTabIndex ? 'above' : 'below'}), opened tab ${targetIndex}`);
    }

    exitLeapMode(true); // Center scroll on new tab
  }

  // Confirm selection - open the highlighted tab, or toggle folder collapse
  function confirmBrowseSelection() {
    const items = getVisibleItems();

    if (highlightedTabIndex >= 0 && highlightedTabIndex < items.length) {
      const item = items[highlightedTabIndex];
      if (isFolder(item)) {
        // Toggle folder collapse/expand and stay in browse mode
        item.collapsed = !item.collapsed;
        log(`Toggled folder "${item.label}" collapsed=${item.collapsed}`);
        // After toggling, the visible items list changes. Re-index after DOM settles.
        setTimeout(() => {
          _visibleItemsCache = null; // Invalidate after folder collapse/expand
          const newItems = getVisibleItems();
          const newIdx = newItems.indexOf(item);
          if (newIdx >= 0) {
            highlightedTabIndex = newIdx;
          }
          updateHighlight();
          updateLeapOverlayState();
        }, 50);
        return; // Stay in browse mode
      }
      gBrowser.selectedTab = item;
      log(`Confirmed selection: opened tab ${highlightedTabIndex}`);
    }

    exitLeapMode(true); // true = center scroll on new tab
  }

  // Close the highlighted tab/folder (or all selected items if any are selected)
  function closeHighlightedTab() {
    const items = getVisibleItems();

    // If there are selected items, close all of them (tabs and folders)
    if (selectedItems.size > 0) {
      const itemsToClose = [...selectedItems].filter(t => t && t.parentNode);
      const tabsToClose = itemsToClose.filter(t => !isFolder(t) && !t.closing);
      const foldersToClose = itemsToClose.filter(isFolder);
      log(`Closing ${tabsToClose.length} selected tabs + ${foldersToClose.length} folders`);
      for (const tab of tabsToClose) {
        gBrowser.removeTab(tab);
      }
      for (const folder of foldersToClose) {
        try { folder.delete(); } catch(e) { log(`Folder delete failed: ${e}`); }
      }
      selectedItems.clear();

      _visibleItemsCache = null; // Invalidate after DOM mutation
      const newItems = getVisibleItems();
      if (newItems.length === 0) {
        exitLeapMode(false);
        return;
      }
      // Clamp highlight index
      if (highlightedTabIndex >= newItems.length) {
        highlightedTabIndex = newItems.length - 1;
      }
      updateHighlight();
      updateLeapOverlayState();
      return;
    }

    // Single item close (no selection)
    if (highlightedTabIndex < 0 || highlightedTabIndex >= items.length) {
      log('No valid item to close');
      return;
    }

    const item = items[highlightedTabIndex];

    // If it's a folder, show the deletion modal instead
    if (isFolder(item)) {
      showFolderDeleteModal(item);
      return;
    }

    const wasLast = highlightedTabIndex === items.length - 1;

    gBrowser.removeTab(item);
    log(`Closed tab at index ${highlightedTabIndex}`);

    _visibleItemsCache = null; // Invalidate after DOM mutation
    const newItems = getVisibleItems();

    if (newItems.length === 0) {
      exitLeapMode(false);
      return;
    }

    if (wasLast || highlightedTabIndex >= newItems.length) {
      highlightedTabIndex = newItems.length - 1;
    }

    updateHighlight();
    updateLeapOverlayState();
  }

  // Toggle selection on the highlighted item (tab or folder)
  function toggleItemSelection() {
    const items = getVisibleItems();
    if (highlightedTabIndex < 0 || highlightedTabIndex >= items.length) return;

    const item = items[highlightedTabIndex];
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
      const items = getVisibleItems();
      if (highlightedTabIndex >= 0 && highlightedTabIndex < items.length) {
        selectedItems.add(items[highlightedTabIndex]);
      }
    }

    if (selectedItems.size === 0) {
      log('No items selected to yank');
      return;
    }

    // Deduplicate: remove individual tabs whose parent folder is also selected
    // (they will move with their folder automatically)
    const selectedFolders = new Set([...selectedItems].filter(isFolder));
    for (const item of [...selectedItems]) {
      if (!isFolder(item)) {
        const parentFolder = item.group?.isZenFolder ? item.group : null;
        if (parentFolder && selectedFolders.has(parentFolder)) {
          selectedItems.delete(item);
        }
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
  function pasteItems(position) {
    if (yankItems.length === 0) {
      log('No items in yank buffer');
      return;
    }

    const items = getVisibleItems();
    if (highlightedTabIndex < 0 || highlightedTabIndex >= items.length) return;

    const anchorItem = items[highlightedTabIndex];

    // Filter out closed/removed items
    yankItems = yankItems.filter(item => {
      if (isFolder(item)) return item.parentNode;
      return item && !item.closing && item.parentNode;
    });
    if (yankItems.length === 0) {
      log('All yanked items have been closed');
      return;
    }

    // Determine anchor context
    const anchorIsFolder = isFolder(anchorItem);
    const anchorTab = anchorIsFolder ? null : anchorItem;
    const anchorFolder = anchorIsFolder ? null : (anchorItem.group?.isZenFolder ? anchorItem.group : null);
    const anchorPinned = anchorIsFolder ? false : anchorItem.pinned;
    const anchorWorkspaceId = anchorItem.getAttribute('zen-workspace-id') || window.gZenWorkspaces?.activeWorkspace;

    // Separate yanked items into folders and loose tabs
    const yankFolders = yankItems.filter(isFolder);
    const yankLooseTabs = yankItems.filter(item => !isFolder(item));

    log(`Paste: position=${position}, anchor="${anchorItem.label}", folders=${yankFolders.length}, tabs=${yankLooseTabs.length}`);

    // --- Phase 1: Move loose tabs ---
    for (const tab of yankLooseTabs) {
      // 1a. Cross-workspace
      if (window.gZenWorkspaces) {
        const tabWsId = tab.getAttribute('zen-workspace-id') || window.gZenWorkspaces.activeWorkspace;
        if (tabWsId !== anchorWorkspaceId) {
          window.gZenWorkspaces.moveTabToWorkspace(tab, anchorWorkspaceId);
          log(`  Moved tab "${tab.label}" to workspace ${anchorWorkspaceId}`);
        }
      }

      // 1b. Remove from old folder if needed
      const tabFolder = tab.group?.isZenFolder ? tab.group : null;
      if (tabFolder && tabFolder !== anchorFolder) {
        try { gBrowser.ungroupTab(tab); } catch(e) { log(`  Ungroup failed: ${e}`); }
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
      if (anchorIsFolder) {
        // gBrowser.moveTabAfter/Before expect tab elements, not folders.
        // Use the folder's tabs as a reference point, or DOM positioning for empty folders.
        const folderTabs = anchorItem.tabs;
        if (position === 'after') {
          if (folderTabs && folderTabs.length > 0) {
            let afterTarget = folderTabs[folderTabs.length - 1];
            for (const tab of yankLooseTabs) {
              gBrowser.moveTabAfter(tab, afterTarget);
              afterTarget = tab;
            }
          } else {
            // Empty folder — use DOM positioning for first tab, chain the rest
            anchorItem.after(yankLooseTabs[0]);
            for (let i = 1; i < yankLooseTabs.length; i++) {
              gBrowser.moveTabAfter(yankLooseTabs[i], yankLooseTabs[i - 1]);
            }
          }
        } else {
          if (folderTabs && folderTabs.length > 0) {
            gBrowser.moveTabBefore(yankLooseTabs[0], folderTabs[0]);
          } else {
            anchorItem.before(yankLooseTabs[0]);
          }
          for (let i = 1; i < yankLooseTabs.length; i++) {
            gBrowser.moveTabAfter(yankLooseTabs[i], yankLooseTabs[i - 1]);
          }
        }
      } else {
        if (position === 'after') {
          let afterTarget = anchorItem;
          for (const tab of yankLooseTabs) {
            gBrowser.moveTabAfter(tab, afterTarget);
            afterTarget = tab;
          }
        } else {
          gBrowser.moveTabBefore(yankLooseTabs[0], anchorItem);
          for (let i = 1; i < yankLooseTabs.length; i++) {
            gBrowser.moveTabAfter(yankLooseTabs[i], yankLooseTabs[i - 1]);
          }
        }

        // Add loose tabs to anchor's folder if anchor is a tab inside a folder
        if (anchorFolder) {
          const tabsToAdd = yankLooseTabs.filter(t => t.group !== anchorFolder);
          if (tabsToAdd.length > 0) {
            for (const t of tabsToAdd) { if (!t.pinned) gBrowser.pinTab(t); }
            anchorFolder.addTabs(tabsToAdd);
            log(`  Added ${tabsToAdd.length} tabs to folder "${anchorFolder.label}"`);
          }
        }
      }
    }

    // --- Phase 2: Move folders ---
    // Track insertion reference for 'after' positioning to preserve folder order.
    // Without this, each .after(anchor) would insert right after the same anchor,
    // reversing the order of multiple folders (e.g. [A,B,C] after X → X,C,B,A).
    // Starts null — each branch uses its own reference for the first folder,
    // then subsequent folders chain from the previously placed one.
    let folderAfterRef = null;
    for (const folder of yankFolders) {
      // 2a. Cross-workspace: update workspace IDs on folder and all its tabs
      const folderWsId = folder.getAttribute('zen-workspace-id');
      if (folderWsId && folderWsId !== anchorWorkspaceId && window.gZenFolders) {
        try {
          // hasDndSwitch: true means only update IDs, don't auto-reposition or switch workspace
          gZenFolders.changeFolderToSpace(folder, anchorWorkspaceId, { hasDndSwitch: true });
          log(`  Moved folder "${folder.label}" to workspace ${anchorWorkspaceId}`);
        } catch(e) { log(`  changeFolderToSpace failed: ${e}`); }
      }

      // 2b. Position folder based on anchor type:
      //   - Anchor is a folder: place as sibling before/after it
      //   - Anchor is a tab inside a folder: nest into that folder (before/after the tab)
      //   - Anchor is a pinned loose tab: place as sibling
      //   - Anchor is an unpinned loose tab: place into pinnedTabsContainer
      // Folders must always live in the pinnedTabsContainer (or inside another folder's container).
      if (anchorIsFolder) {
        if (position === 'after') {
          (folderAfterRef || anchorItem).after(folder);
          folderAfterRef = folder;
        } else {
          anchorItem.before(folder);
        }
      } else if (anchorFolder) {
        // Anchor is a tab inside a folder — nest the yanked folder into anchorFolder
        // by positioning relative to the anchor tab (which lives in anchorFolder's container).
        // Check constraints first.
        let canNest = true;

        // Guard: circular nesting — don't nest a folder inside itself or its own descendants
        let ancestor = anchorFolder;
        while (ancestor) {
          if (ancestor === folder) { canNest = false; break; }
          ancestor = ancestor.group?.isZenFolder ? ancestor.group : null;
        }
        if (!canNest) {
          log(`  Cannot nest folder "${folder.label}" inside its own descendant — placing as sibling`);
        }

        // Guard: max nesting depth — use Zen's canDropElement if available
        if (canNest && window.gZenFolders?.canDropElement) {
          try {
            if (!gZenFolders.canDropElement(folder, anchorTab)) {
              canNest = false;
              log(`  Cannot nest folder "${folder.label}" — max nesting depth reached — placing as sibling`);
            }
          } catch(e) { /* proceed with nesting if check fails */ }
        }

        if (canNest) {
          if (position === 'after') {
            (folderAfterRef || anchorTab).after(folder);
            folderAfterRef = folder;
          } else {
            anchorTab.before(folder);
          }
          log(`  Nested folder "${folder.label}" inside "${anchorFolder.label}"`);
        } else {
          // Fall back to sibling placement next to the parent folder
          if (position === 'after') {
            (folderAfterRef || anchorFolder).after(folder);
            folderAfterRef = folder;
          } else {
            anchorFolder.before(folder);
          }
        }
      } else if (anchorTab && anchorTab.pinned) {
        // Anchor is a pinned tab (no folder) — safe to position relative to it
        if (position === 'after') {
          (folderAfterRef || anchorTab).after(folder);
          folderAfterRef = folder;
        } else {
          anchorTab.before(folder);
        }
      } else {
        // Anchor is an unpinned tab — folder must go into the pinnedTabsContainer
        const wsEl = window.gZenWorkspaces?.workspaceElement(anchorWorkspaceId);
        const pinnedContainer = wsEl?.pinnedTabsContainer;
        if (pinnedContainer) {
          const separator = pinnedContainer.querySelector('.pinned-tabs-container-separator');
          if (separator) {
            separator.before(folder);
          } else {
            pinnedContainer.appendChild(folder);
          }
        } else {
          if (position === 'after') {
            (folderAfterRef || anchorTab).after(folder);
            folderAfterRef = folder;
          } else {
            anchorTab.before(folder);
          }
        }
      }
    }

    log(`Pasted ${yankLooseTabs.length} tabs + ${yankFolders.length} folders ${position} anchor`);

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
      highlightedTabIndex, originalTabIndex, originalTab,
      browseDirection, selectedItems: new Set(selectedItems),
      yankItems: [...yankItems], sidebarWasExpanded
    };
  }

  // Restore browse mode state after returning from command bar
  function restoreBrowseState(state) {
    leapMode = true;
    browseMode = true;
    highlightedTabIndex = state.highlightedTabIndex;
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
      gBrowser.selectedTab = originalTab;
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

  // Exit leap mode
  function exitLeapMode(centerScroll = false) {
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
    highlightedTabIndex = -1;
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

    // Restore focus to content area so keyboard input resumes going to the web page
    restoreFocusToContent();

    _pluginEventBus.emit('leapMode:exit', {});
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

    // Handle plugin manager mode - Escape to close
    if (_pluginManagerMode) {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
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
      if (event.key === 'Escape' && !settingsRecordingId) {
        event.preventDefault();
        event.stopPropagation();
        // Dismiss import confirmation first if open, otherwise close settings
        if (document.getElementById('zenleap-import-overlay')) {
          dismissImportConfirmation();
        } else {
          exitSettingsMode();
        }
      } else if (event.key === 'Enter' && settingsActiveTab === 'About' && aboutUpdateState === 'available') {
        event.preventDefault();
        event.stopPropagation();
        exitSettingsMode();
        enterUpdateMode();
      }
      return;
    }

    // Handle update mode - Escape to close, Enter for primary action
    if (updateMode) {
      event.preventDefault();
      event.stopPropagation();
      if (event.key === 'Escape') {
        exitUpdateMode();
      } else if (event.key === 'Enter') {
        if (updateModalState === 'available') performUpdate();
        else if (updateModalState === 'success') {
          try { Services.startup.quit(Services.startup.eAttemptQuit | Services.startup.eRestart); } catch(e) { log(`Restart failed: ${e}`); }
        }
        else if (updateModalState === 'error') performUpdate(); // retry
        else if (updateModalState === 'uptodate') exitUpdateMode();
      }
      return;
    }

    // Handle update toast - Enter to open update flow, Escape to dismiss
    if (updateToast && !searchMode && !leapMode && !helpMode && !reorgMode && !folderDeleteMode) {
      if (event.key === 'Enter') {
        event.preventDefault();
        event.stopPropagation();
        dismissUpdateToast(false);
        enterUpdateMode();
        return;
      } else if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
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
      event.preventDefault();
      event.stopPropagation();
      if (event.key === 'Escape' || event.key === S['keys.leap.help']) {
        exitHelpMode();
        return;
      }
      // j/k/arrows scroll the help content
      const scrollEl = helpModal?.querySelector('.zenleap-help-content');
      if (scrollEl) {
        if (event.key === 'j' || event.key === 'ArrowDown') { scrollEl.scrollBy({ top: 80, behavior: 'smooth' }); return; }
        if (event.key === 'k' || event.key === 'ArrowUp') { scrollEl.scrollBy({ top: -80, behavior: 'smooth' }); return; }
        if (event.key === 'g') { scrollEl.scrollTo({ top: 0, behavior: 'smooth' }); return; }
        if (event.key === 'G') { scrollEl.scrollTo({ top: scrollEl.scrollHeight, behavior: 'smooth' }); return; }
      }
      return;
    }

    // Handle folder delete modal
    if (folderDeleteMode) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      if (event.key === 'Escape') {
        closeFolderDeleteModal();
        return;
      }
      if (event.key === '1') {
        deleteFolderAndContents(folderDeleteTarget);
        return;
      }
      if (event.key === '2') {
        deleteFolderKeepTabs(folderDeleteTarget);
        return;
      }
      return; // Swallow all other keys while modal is open
    }

    // Handle gTile mode
    if (gtileMode) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      handleGtileKeyDown(event);
      return;
    }

    // Handle URL bar vim mode (Cmd+L / Cmd+T native browser bar).
    // Key interception happens at the input level (urlbarInputKeyHandler) because
    // window-level preventDefault cannot stop moz-urlbar's internal editor.
    // This block only: (1) lazily attaches listeners, (2) blocks other ZenLeap
    // handlers from processing keys while the URL bar is focused.
    if (!searchMode && !leapMode && !settingsMode && !helpMode && !reorgMode && !gtileMode && !folderDeleteMode) {
      try {
        const _gURLBarFocused = typeof gURLBar !== 'undefined' && gURLBar && gURLBar.focused;
        if (_gURLBarFocused) {
          // Lazily set up input-level listeners if not done yet
          if (!urlbarVimSetupDone) lazySetupUrlbarVim();
          // In normal mode, block all other ZenLeap handlers.
          // Actual key prevention is at input level.
          if (S['display.vimModeInBars'] && urlbarVimActive && urlbarVimMode === 'normal') return;
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

    // Check for command mode trigger
    if (matchCombo(event, S['keys.global.commandPalette'])) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      if (leapMode && browseMode) {
        enterBrowseCommandMode();
      } else {
        enterSearchMode(true);
      }
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

    // Check for undo folder delete (Cmd+Shift+T)
    if (matchCombo(event, S['keys.global.undoFolderDelete'])) {
      const handled = undoLastFolderDelete();
      if (handled) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        return;
      }
      // If not handled, let browser's native Cmd+Shift+T proceed
      return;
    }

    // Alt+HJKL: Quick navigation with split-view awareness.
    // - Not in split: J/K switch tabs, H/L switch workspaces
    // - In split, not at boundary: focus adjacent pane (existing behavior)
    // - In split, at boundary: J/K navigate to first non-split tab outside
    //   the group; H/L switch workspaces
    {
      const EDGE = 0.1; // threshold for "pane touches edge" (percentage)
      const pos = getSplitBounds(); // null when split view inactive

      if (matchCombo(event, S['keys.global.splitFocusDown'])) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        interceptQuickNav();
        if (pos && pos.bottom > EDGE) {
          splitFocusInDirection('down');
        } else {
          quickSwitchTab('down', !!pos);
          peekSidebarForQuickNav();
        }
        return;
      }
      if (matchCombo(event, S['keys.global.splitFocusUp'])) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        interceptQuickNav();
        if (pos && pos.top > EDGE) {
          splitFocusInDirection('up');
        } else {
          quickSwitchTab('up', !!pos);
          peekSidebarForQuickNav();
        }
        return;
      }
      if (matchCombo(event, S['keys.global.splitFocusLeft'])) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        interceptQuickNav();
        if (pos && pos.left > EDGE) {
          splitFocusInDirection('left');
        } else {
          quickSwitchWorkspace('prev');
          peekSidebarForQuickNav();
        }
        return;
      }
      if (matchCombo(event, S['keys.global.splitFocusRight'])) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        interceptQuickNav();
        if (pos && pos.right > EDGE) {
          splitFocusInDirection('right');
        } else {
          quickSwitchWorkspace('next');
          peekSidebarForQuickNav();
        }
        return;
      }
      // Alt+Space — open gTile resize overlay
      if (matchCombo(event, S['keys.global.splitResize'])) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        enterGtileMode();
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
    if (browseMode) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      // If a number buffer is accumulating and a non-digit key is pressed,
      // cancel the pending number jump (the user changed their mind)
      if (browseNumberBuffer && !(key >= '0' && key <= '9')) {
        clearTimeout(browseNumberTimeout);
        browseNumberTimeout = null;
        browseNumberBuffer = '';
      }

      if (key === S['keys.browse.down'] || key === S['keys.browse.downAlt']) {
        event.shiftKey ? shiftMoveHighlight('down') : moveHighlight('down');
        return;
      }
      if (key === S['keys.browse.up'] || key === S['keys.browse.upAlt']) {
        event.shiftKey ? shiftMoveHighlight('up') : moveHighlight('up');
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
        toggleItemSelection();
        return;
      }
      if (key === S['keys.browse.yank']) {
        yankSelectedItems();
        return;
      }
      if (originalKey === S['keys.browse.pasteBefore']) {
        pasteItems('before');
        return;
      }
      if (key === S['keys.browse.pasteAfter']) {
        pasteItems('after');
        return;
      }
      if (key === S['keys.browse.prevWorkspace'] || key === S['keys.browse.prevWorkspaceAlt'] ||
          key === S['keys.browse.nextWorkspace'] || key === S['keys.browse.nextWorkspaceAlt']) {
        const isPrev = key === S['keys.browse.prevWorkspace'] || key === S['keys.browse.prevWorkspaceAlt'];
        browseWorkspaceSwitch(isPrev ? 'prev' : 'next');
        return;
      }

      // G = move highlight to last item
      if (originalKey === S['keys.browse.lastTab']) {
        const items = getVisibleItems();
        highlightedTabIndex = items.length - 1;
        updateHighlight();
        updateLeapOverlayState();
        log(`Browse: jumped to last item (index ${highlightedTabIndex})`);
        return;
      }

      // g = pending gg (move highlight to first item)
      if (key === S['keys.browse.gMode'] && originalKey === S['keys.browse.gMode']) {
        if (browseGPending) {
          // Second g pressed - move to first item (or first unpinned if setting enabled)
          clearTimeout(browseGTimeout);
          browseGPending = false;
          browseGTimeout = null;
          if (S['display.ggSkipPinned']) {
            const items = getVisibleItems();
            const firstUnpinned = items.findIndex(t => !isFolder(t) && !t.pinned && !t.hasAttribute('zen-essential'));
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
      if (key >= '1' && key <= '9' || (key === '0' && browseNumberBuffer.length > 0)) {
        browseNumberBuffer += key;
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
      if (recordingJumps && event.target) {
        recordJump(event.target);
      }
      _pluginEventBus.emit('tab:activated', { tab: event.target });
    });

    gBrowser.tabContainer.addEventListener('TabOpen', (event) => {
      scheduleRelativeNumberUpdate();
      _pluginEventBus.emit('tab:created', { tab: event.target });
    });

    gBrowser.tabContainer.addEventListener('TabClose', (event) => {
      scheduleRelativeNumberUpdate();
      _pluginEventBus.emit('tab:closed', { tab: event.target });
    });

    gBrowser.tabContainer.addEventListener('TabMove', (event) => {
      scheduleRelativeNumberUpdate();
      _pluginEventBus.emit('tab:moved', { tab: event.target });
    });

    document.addEventListener('ZenWorkspaceChanged', (event) => {
      scheduleRelativeNumberUpdate();
      _pluginEventBus.emit('workspace:changed', { event });
    });

    log('Tab listeners set up');
  }

  // Suppress keyup events while in active modes or after quick-nav interception
  // to prevent them from leaking to content
  // (e.g., Space keyup reaching YouTube after Ctrl+Space keydown entered Leap Mode,
  //  or Alt/J/K keyup reaching content after Alt+HJKL navigation,
  //  or browse mode j/k reaching about:newtab search input)
  function handleKeyUp(event) {
    if (leapMode || searchMode || commandMode || settingsMode || helpMode || reorgMode || gtileMode
        || folderDeleteMode || (urlbarVimActive && urlbarVimMode === 'normal')
        || Date.now() < quickNavInterceptedUntil) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
    }
  }

  // Set up keyboard listener
  function setupKeyboardListener() {
    window.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('keyup', handleKeyUp, true);

    // Close gTile overlay if split view is deactivated externally
    window.addEventListener('ZenViewSplitter:SplitViewDeactivated', () => {
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

  // Normalize any color string to strict #RRGGBB for <input type="color">
  function toHex6(val) {
    if (!val) return '#000000';
    if (/^#[0-9a-fA-F]{6}$/i.test(val)) return val;
    if (/^#[0-9a-fA-F]{3}$/i.test(val)) {
      const [, r, g, b] = val.match(/^#(.)(.)(.)$/);
      return `#${r}${r}${g}${g}${b}${b}`;
    }
    const m = val.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
    if (m) return '#' + [m[1], m[2], m[3]].map(n => parseInt(n).toString(16).padStart(2, '0')).join('');
    return '#000000';
  }

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

  // Apply theme: set all CSS custom properties on :root from the active theme
  function applyTheme() {
    const themeName = S['appearance.theme'] || 'meridian';
    const t = themes[themeName] || themes.meridian;
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
    const accentHex = toHex6(t.accent);
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
    const highlight = toHex6(t.highlight);
    const selected = toHex6(t.selected);
    const mark = toHex6(t.mark);

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
    '--toolbar-bgcolor',
  ];

  // Apply or revert Zen Browser chrome theme colors
  function applyBrowserTheme(t) {
    const root = document.documentElement;

    // Always remove injected stylesheet first
    const existingStyle = document.getElementById('zenleap-browser-theme');
    if (existingStyle) existingStyle.remove();

    if (!S['appearance.applyToBrowser']) {
      // Revert: remove our overrides so Zen's own theme takes over
      for (const prop of _zenBrowserProps) root.style.removeProperty(prop);
      return;
    }

    // Use the theme object passed from applyTheme(), or resolve it
    if (!t) {
      const themeName = S['appearance.theme'] || 'meridian';
      t = themes[themeName] || themes.meridian;
    }

    // Resolve all theme colors
    const accent = toHex6(t.accent);
    const accentBright = toHex6(t.accentBright);
    const bgBase = toHex6(t.bgBase);
    const bgDeep = toHex6(t.bgDeep);
    const bgSurface = toHex6(t.bgSurface);
    const bgRaised = toHex6(t.bgRaised);
    const bgVoid = toHex6(t.bgVoid);
    const textPrimary = toHex6(t.textPrimary);
    const textSecondary = toHex6(t.textSecondary);
    const textMuted = toHex6(t.textMuted);

    // Core browser chrome properties
    root.style.setProperty('--zen-primary-color', accent);
    root.style.setProperty('--zen-main-browser-background', `linear-gradient(135deg, ${bgDeep} 0%, ${bgBase} 100%)`);
    root.style.setProperty('--zen-main-browser-background-toolbar', `linear-gradient(135deg, ${bgBase} 0%, ${bgDeep} 100%)`);

    // Toolbar element backgrounds (urlbar collapsed state)
    root.style.setProperty('--zen-toolbar-element-bg', hexToRgba(textPrimary, 0.08));
    root.style.setProperty('--zen-toolbar-element-bg-hover', hexToRgba(textPrimary, 0.15));

    // Text colors
    root.style.setProperty('--toolbox-textcolor', textPrimary);
    root.style.setProperty('--toolbar-color', textPrimary);
    root.style.setProperty('--toolbar-bgcolor', hexToRgba(bgBase, 0.6));

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
      .urlbar {
        --urlbarView-separator-color: ${hexToRgba(textPrimary, 0.1)} !important;
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
    if (!window.gZenThemePicker || !window.gZenWorkspaces) {
      if (++_workspaceHookRetries > 10) {
        log('Workspace theme hook: globals not found after 10 retries, skipping');
        return;
      }
      setTimeout(setupWorkspaceThemeHook, 500);
      return;
    }

    // Guard against double-wrapping if the script is reloaded in the same window
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
      const _origOnWorkspaceChange = gZenThemePicker.onWorkspaceChange.bind(gZenThemePicker);
      gZenThemePicker.onWorkspaceChange = (...args) => {
        _origOnWorkspaceChange(...args);
        if (S['appearance.applyToBrowser']) {
          applyBrowserTheme();
        }
      };
      gZenThemePicker._zenleapWrapped = true;
    } catch (e) {
      log(`Warning: Could not wrap onWorkspaceChange: ${e}`);
    }

    // Safety net: also use the official change listener API so any other code
    // path that resets CSS properties gets caught after animations complete.
    gZenWorkspaces.addChangeListeners(() => {
      if (S['appearance.applyToBrowser']) {
        applyBrowserTheme();
      }
    });

    log('Workspace theme hook installed');
  }

  // Legacy compat wrapper
  function applyThemeColors() { applyTheme(); }

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

      /* ═══ Themed scrollbars ═══ */
      .zenleap-themed-scroll::-webkit-scrollbar { width: 6px; }
      .zenleap-themed-scroll::-webkit-scrollbar-track { background: transparent; }
      .zenleap-themed-scroll::-webkit-scrollbar-thumb {
        background: var(--zl-border-strong);
        border-radius: 3px;
      }
      .zenleap-themed-scroll::-webkit-scrollbar-thumb:hover {
        background: var(--zl-accent-mid);
      }

      /* ═══ Shared modal animation ═══ */
      @keyframes zenleap-modal-enter {
        from { opacity: 0; transform: scale(0.96) translateY(-8px); }
        to { opacity: 1; transform: scale(1) translateY(0); }
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

      /* ═══ Folder Delete Modal ═══ */
      #zenleap-folder-delete-modal {
        display: none;
        position: fixed;
        inset: 0;
        z-index: 10001;
      }

      #zenleap-folder-delete-modal.active {
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

        /* Marked tab badge */
        tab[data-zenleap-has-mark="true"]:not([zen-glance-tab="true"]) > .tab-stack > .tab-content[data-zenleap-rel]::after {
          background-color: var(--zl-mark) !important;
          color: var(--zl-current-color) !important;
          font-weight: bold !important;
          box-shadow: 0 0 6px var(--zl-mark-50) !important;
        }
      }

      /* ═══ Compact sidebar mode ═══ */
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

      #zenleap-gtile-panel::-webkit-scrollbar { width: 6px; }
      #zenleap-gtile-panel::-webkit-scrollbar-track { background: transparent; }
      #zenleap-gtile-panel::-webkit-scrollbar-thumb {
        background: var(--zl-border-strong);
        border-radius: 3px;
      }
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

  // Initialize
  let initRetries = 0;
  const MAX_INIT_RETRIES = 20;
  let _zenleapInitDone = false;

  function init() {
    if (_zenleapInitDone) {
      log('ZenLeap already initialized, skipping re-init');
      return;
    }

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

    _zenleapInitDone = true;

    injectStyles();
    // Load user themes async; re-apply theme once loaded (built-in applies immediately via injectStyles)
    loadUserThemes().then(() => applyTheme());
    ensureThemesFile();
    initPluginSystem(); // Async — built-in plugins load synchronously, external plugins load in background
    setupTabListeners();
    setupKeyboardListener();
    setupUrlbarVimMode();
    setupWorkspaceThemeHook();
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

    // Auto-check for updates (delayed to not block startup)
    setTimeout(() => autoCheckForUpdates(), 5000);
  }

  // Start initialization
  if (document.readyState === 'complete') {
    init();
  } else {
    document.addEventListener('DOMContentLoaded', init);
  }

})();
