// ==UserScript==
// @name           ZenLeap - Relative Tab Navigation
// @description    Vim-style relative tab numbering with keyboard navigation
// @include        main
// @author         ZenLeap
// @version        2.4.1  // Keep in sync with VERSION constant below
// ==/UserScript==

(function() {
  'use strict';

  // Version - keep in sync with @version in header above
  const VERSION = '2.4.1';

  // Configuration (defaults, overridden by preferences if set)
  const CONFIG = {
    debug: false,  // Set to true to enable console logging
    currentTabIndicator: '·',  // What to show on current tab
    overflowIndicator: '+',    // For positions > 45
    leapModeTimeout: 3000,     // Auto-cancel leap mode after 3 seconds (not used in browse mode)
    triggerKey: ' ',           // Space key
    triggerModifier: 'ctrlKey' // Ctrl modifier
  };

  // Read preferences from about:config (defined in preferences.json)
  try {
    if (Services && Services.prefs) {
      if (Services.prefs.getPrefType('uc.zenleap.debug') === Services.prefs.PREF_BOOL) {
        CONFIG.debug = Services.prefs.getBoolPref('uc.zenleap.debug');
      }
      if (Services.prefs.getPrefType('uc.zenleap.current_indicator') === Services.prefs.PREF_STRING) {
        const indicator = Services.prefs.getStringPref('uc.zenleap.current_indicator');
        if (indicator) CONFIG.currentTabIndicator = indicator;
      }
    }
  } catch (e) {
    // Services not available, use defaults
  }

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

  // Sidebar state (for compact mode)
  let sidebarWasExpanded = false;  // Track if we expanded the sidebar

  // Jump list (like vim's Ctrl+O / Ctrl+I)
  const MAX_JUMP_LIST_SIZE = 100;
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
  let commandRecency = new Map(); // key -> timestamp of last execution (for recency ranking)
  let commandEnteredFromSearch = false; // true if entered via '>' from search, false if via Ctrl+Shift+/

  // Help modal
  let helpMode = false;
  let helpModal = null;

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
    if (jumpList.length > MAX_JUMP_LIST_SIZE) {
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

  // Multi-word fuzzy match - splits query into words, ALL words must match
  // Each word can match in either title or URL
  // Returns { score, titleIndices, urlIndices } or null if any word doesn't match
  function fuzzyMatch(query, title, url) {
    if (!query) return null;

    const words = query.trim().split(/\s+/).filter(w => w.length > 0);
    if (words.length === 0) return null;

    let totalScore = 0;
    let allTitleIndices = [];
    let allUrlIndices = [];

    for (const word of words) {
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

    // Bonus for matching more words (encourages specific searches)
    totalScore += words.length * 5;

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

      // Exponential decay: floor=0.8, range=1.0, halflife=12 minutes
      const multiplier = 0.8 + 1.0 * Math.exp(-ageMinutes / 12);
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

    // Get visible tabs, optionally excluding the current tab
    const tabs = includeCurrent
      ? getVisibleTabs()
      : getVisibleTabs().filter(tab => tab !== currentTab);
    const totalTabs = tabs.length;

    // Empty query: return tabs sorted purely by recency
    if (!query || query.trim() === '') {
      const sortedTabs = sortTabsByRecency(tabs);
      return sortedTabs.slice(0, 100).map((tab, idx) => ({
        tab,
        score: 100 - idx, // Score reflects sorted position
        titleIndices: [],
        urlIndices: []
      }));
    }

    // With query: combine fuzzy match score × recency multiplier
    const results = [];

    tabs.forEach((tab, idx) => {
      const title = tab.label || '';
      const url = tab.linkedBrowser?.currentURI?.spec || '';

      // Multi-word fuzzy match - all words must match somewhere in title or URL
      const match = fuzzyMatch(query, title, url);

      if (match) {
        const matchScore = match.score;

        // Get recency multiplier (0.8 to 1.8)
        const recencyMultiplier = calculateRecencyMultiplier(tab);

        // Combined score: matchScore × recencyMultiplier
        // Recent tabs get boosted, old tabs get penalized
        const totalScore = matchScore * recencyMultiplier;

        results.push({
          tab,
          score: totalScore,
          matchScore,           // For debugging
          recencyMultiplier,    // For debugging
          titleIndices: match.titleIndices,
          urlIndices: match.urlIndices
        });
      }
    });

    // Sort by combined score descending
    results.sort((a, b) => b.score - a.score);

    // Return top 100 results (1-9 have quick jump labels)
    return results.slice(0, 100);
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

    inputWrapper.appendChild(searchIcon);
    inputWrapper.appendChild(searchInput);
    inputWrapper.appendChild(searchInputDisplay);
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
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        margin-bottom: 2px;
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
        }, 500);
      }},

      // --- Tab Selection (Multi-Step) ---
      { key: 'select-matching-tabs', label: 'Select Matching Tabs...', icon: '🔎', tags: ['tab', 'select', 'search', 'match', 'filter', 'batch'], subFlow: 'tab-search' },

      // --- Tab Movement ---
      { key: 'move-tab-to-top', label: 'Move Tab to Top', icon: '⤒', tags: ['tab', 'move', 'top', 'first', 'beginning'], command: () => {
        const tab = gBrowser.selectedTab;
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
        const tabs = getVisibleTabs();
        if (tabs.length > 0 && tabs[tabs.length - 1] !== tab) {
          gBrowser.moveTabAfter(tab, tabs[tabs.length - 1]);
          log('Moved tab to bottom');
        }
      }},

      // --- Navigation ---
      { key: 'go-first-tab', label: 'Go to First Tab', icon: '⇤', tags: ['navigate', 'first', 'top', 'gg'], command: () => {
        const tabs = getVisibleTabs();
        if (tabs.length > 0) gBrowser.selectedTab = tabs[0];
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

      // --- Folder Management ---
      { key: 'create-folder', label: 'Create Folder with Current Tab', icon: '📁', tags: ['folder', 'create', 'new', 'group', 'tab', 'add'],
        condition: () => !!window.gZenFolders,
        command: () => {
          try {
            const tab = gBrowser.selectedTab;
            gZenFolders.createFolder([tab], { renameFolder: true });
          } catch(e) { log(`Create folder failed: ${e}`); }
      }},

      // --- ZenLeap Meta ---
      { key: 'toggle-debug', label: 'Toggle Debug Logging', icon: '🐛', tags: ['debug', 'log', 'zenleap'], command: () => {
        CONFIG.debug = !CONFIG.debug;
        console.log(`[ZenLeap] Debug logging ${CONFIG.debug ? 'enabled' : 'disabled'}`);
      }},
      { key: 'open-help', label: 'Open Help Modal', icon: '❓', tags: ['help', 'zenleap', 'keybindings'], command: () => {
        exitSearchMode();
        setTimeout(() => enterHelpMode(), 100);
      }},
    ];
  }

  // Generate dynamic commands based on current state
  function getDynamicCommands() {
    const commands = [];

    // Workspace switch commands
    try {
      if (window.gZenWorkspaces) {
        const workspaces = window.gZenWorkspaces.getWorkspaces();
        if (workspaces && Array.isArray(workspaces)) {
          const activeId = window.gZenWorkspaces.activeWorkspace;
          for (const ws of workspaces) {
            const icon = ws.icon || '🗂';
            const name = ws.name || 'Unnamed';
            const isActive = ws.uuid === activeId;
            commands.push({
              key: `switch-workspace:${ws.uuid}`,
              label: `Switch to Workspace: ${name}${isActive ? ' (current)' : ''}`,
              icon: icon,
              tags: ['workspace', 'switch', name.toLowerCase()],
              command: () => { window.gZenWorkspaces.changeWorkspaceWithID(ws.uuid); },
            });
            if (!isActive) {
              commands.push({
                key: `move-to-workspace:${ws.uuid}`,
                label: `Move Tab to Workspace: ${name}`,
                icon: icon,
                tags: ['workspace', 'move', 'tab', name.toLowerCase()],
                command: () => {
                  window.gZenWorkspaces.moveTabToWorkspace(gBrowser.selectedTab, ws.uuid);
                },
              });
            }
          }
        }
      }
    } catch (e) { log(`Error generating workspace commands: ${e}`); }

    // Folder commands
    try {
      const folders = gBrowser.tabContainer.querySelectorAll('zen-folder');
      for (const folder of folders) {
        const name = folder.label || folder.getAttribute('zen-folder-name') || 'Unnamed Folder';
        const folderId = folder.id;
        const activeTab = gBrowser.selectedTab;
        // Skip if tab is already in this folder
        if (activeTab && activeTab.group === folder) continue;

        commands.push({
          key: `add-to-folder:${folderId}`,
          label: `Add Tab to Folder: ${name}`,
          icon: '📂',
          tags: ['folder', 'add', 'move', 'tab', 'group', name.toLowerCase()],
          command: () => {
            try {
              const tabToMove = gBrowser.selectedTab;
              if (!tabToMove) return;
              // Re-fetch folder by ID to avoid stale DOM references
              const targetFolder = document.getElementById(folderId);
              if (!targetFolder) { log(`Folder not found: ${folderId}`); return; }

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

              targetFolder.addTabs([tabToMove]);
              log(`Added tab to folder: ${name}`);
            } catch(e) { log(`Add to folder failed: ${e}`); }
          },
        });
      }
    } catch (e) { log(`Error generating folder commands: ${e}`); }

    return commands;
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
    // Aggressive recency: floor=0.8, range=2.2, halflife=30 minutes
    // Recently used commands get up to 3.0x boost
    return 0.8 + 2.2 * Math.exp(-ageMinutes / 30);
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
    commandSubFlowStack.push({ type: commandSubFlow?.type || 'commands', label: commandSubFlow?.label || 'Commands', query: commandQuery });
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
    }
    renderCommandResults();
    updateBreadcrumb();
    updateSearchVimIndicator();
  }

  function exitSubFlow() {
    searchSelectedIndex = 0;
    const currentType = commandSubFlow?.type;

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
  }

  function getSubFlowPlaceholder(type) {
    switch (type) {
      case 'tab-search': return 'Search tabs to select...';
      case 'action-picker': return 'Choose an action...';
      case 'workspace-picker': return 'Choose a workspace...';
      case 'folder-picker': return 'Choose a folder...';
      case 'split-tab-picker': return 'Search for a tab to split with...';
      case 'folder-name-input': return 'Enter folder name...';
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
      case 'folder-name-input':
        return getFolderNameInputResults(query);
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
      urlIndices: r.urlIndices,
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

    const sortedTabs = sortTabsBySidebarPosition(validTabs);

    const sortedSet = new Set(sortedTabs);
    const visibleTabs = getVisibleTabs();
    try {
      if (position === 'top') {
        // Find the first non-pinned, non-essential tab that is NOT being moved
        const anchor = visibleTabs.find(t => !t.pinned && !t.hasAttribute('zen-essential') && !sortedSet.has(t));
        if (anchor && sortedTabs.length > 0) {
          // Move first tab before the anchor, then chain each subsequent tab after the previous
          // This guarantees the order: sorted[0], sorted[1], ..., anchor
          gBrowser.moveTabBefore(sortedTabs[0], anchor);
          for (let i = 1; i < sortedTabs.length; i++) {
            gBrowser.moveTabAfter(sortedTabs[i], sortedTabs[i - 1]);
          }
        } else if (sortedTabs.length > 1) {
          // All regular tabs are being moved — chain them in order starting from the first
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

      html += `
        <div class="zenleap-search-result ${isSelected ? 'selected' : ''}" data-index="${idx}">
          <img class="zenleap-search-result-favicon" src="${escapeHtml(favicon)}" />
          <div class="zenleap-search-result-info">
            <div class="zenleap-search-result-title">${highlightedTitle}</div>
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

        html += `
          <div class="zenleap-command-result ${isSelected ? 'selected' : ''}" data-index="${idx}">
            <img class="zenleap-search-result-favicon" src="${escapeHtml(favicon)}" />
            <div class="zenleap-command-info">
              <div class="zenleap-command-label">${highlightedTitle}</div>
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
    log('Entered command mode');
  }

  // Exit command mode (back to search)
  function exitCommandMode() {
    commandMode = false;
    commandQuery = '';
    commandSubFlow = null;
    commandSubFlowStack = [];
    commandMatchedTabs = [];
    commandResults = [];
    commandEnteredFromSearch = false;
    searchSelectedIndex = 0;

    // Restore to insert mode for normal search
    searchVimMode = 'insert';

    if (searchInput) {
      searchInput.value = '';
      searchInput.placeholder = 'Search tabs...';
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
    log('Exited command mode');
  }

  // Update the hint bar content based on current mode
  function updateSearchHintBar() {
    if (!searchHintBar) return;

    if (commandMode) {
      if (searchVimMode === 'normal') {
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
          <span><kbd>Esc</kbd> normal mode</span>
        `;
      }
      return;
    }

    if (searchVimMode === 'normal') {
      searchHintBar.innerHTML = `
        <span><kbd>j/k</kbd> navigate</span>
        <span><kbd>Enter</kbd> open</span>
        <span><kbd>x</kbd> close tab</span>
        <span><kbd>1-9</kbd> jump</span>
        <span><kbd>Esc</kbd> close</span>
      `;
    } else {
      searchHintBar.innerHTML = `
        <span><kbd>↑↓</kbd> navigate</span>
        <span><kbd>Enter</kbd> open</span>
        <span><kbd>Ctrl+x</kbd> close tab</span>
        <span><kbd>></kbd> commands</span>
        <span><kbd>Esc</kbd> normal mode</span>
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
        <h1>ZenLeap</h1>
        <span class="zenleap-help-version">v${VERSION}</span>
        <span class="zenleap-help-subtitle">Vim-style Tab Navigation</span>
      </div>

      <div class="zenleap-help-content">
        <div class="zenleap-help-section">
          <h2>🚀 Leap Mode</h2>
          <p class="zenleap-help-trigger"><kbd>Ctrl</kbd> + <kbd>Space</kbd> to activate</p>
          <div class="zenleap-help-grid">
            <div class="zenleap-help-item"><kbd>j</kbd> / <kbd>k</kbd><span>Enter browse mode (down/up)</span></div>
            <div class="zenleap-help-item"><kbd>↑</kbd> / <kbd>↓</kbd><span>Enter browse mode (arrows)</span></div>
            <div class="zenleap-help-item"><kbd>h</kbd> / <kbd>l</kbd><span>Browse + switch workspace (prev/next)</span></div>
            <div class="zenleap-help-item"><kbd>g</kbd><span>G-mode (absolute positioning)</span></div>
            <div class="zenleap-help-item"><kbd>z</kbd><span>Z-mode (scroll commands)</span></div>
            <div class="zenleap-help-item"><kbd>m</kbd><span>Set mark on current tab</span></div>
            <div class="zenleap-help-item"><kbd>M</kbd><span>Clear all marks</span></div>
            <div class="zenleap-help-item"><kbd>'</kbd><span>Jump to mark</span></div>
            <div class="zenleap-help-item"><kbd>o</kbd><span>Jump back in history</span></div>
            <div class="zenleap-help-item"><kbd>i</kbd><span>Jump forward in history</span></div>
            <div class="zenleap-help-item"><kbd>?</kbd><span>Show this help</span></div>
            <div class="zenleap-help-item"><kbd>Esc</kbd><span>Exit leap mode</span></div>
          </div>
        </div>

        <div class="zenleap-help-section">
          <h2>📂 Browse Mode</h2>
          <p class="zenleap-help-trigger">After pressing <kbd>j</kbd> or <kbd>k</kbd> in leap mode</p>
          <div class="zenleap-help-grid">
            <div class="zenleap-help-item"><kbd>j</kbd> / <kbd>k</kbd><span>Move selection down/up</span></div>
            <div class="zenleap-help-item"><kbd>Enter</kbd><span>Open selected tab</span></div>
            <div class="zenleap-help-item"><kbd>x</kbd><span>Close selected tab</span></div>
            <div class="zenleap-help-item"><kbd>1-9</kbd> <kbd>a-z</kbd><span>Jump N tabs from origin</span></div>
            <div class="zenleap-help-item"><kbd>Esc</kbd><span>Cancel, return to original</span></div>
          </div>
        </div>

        <div class="zenleap-help-section">
          <h2>📍 G-Mode</h2>
          <p class="zenleap-help-trigger">After pressing <kbd>g</kbd> in leap mode</p>
          <div class="zenleap-help-grid">
            <div class="zenleap-help-item"><kbd>g</kbd><span>Go to first tab (gg)</span></div>
            <div class="zenleap-help-item"><kbd>G</kbd><span>Go to last tab</span></div>
            <div class="zenleap-help-item"><kbd>1-9</kbd> + <kbd>Enter</kbd><span>Go to tab #N</span></div>
          </div>
        </div>

        <div class="zenleap-help-section">
          <h2>📜 Z-Mode</h2>
          <p class="zenleap-help-trigger">After pressing <kbd>z</kbd> in leap mode</p>
          <div class="zenleap-help-grid">
            <div class="zenleap-help-item"><kbd>z</kbd><span>Center current tab (zz)</span></div>
            <div class="zenleap-help-item"><kbd>t</kbd><span>Scroll to top (zt)</span></div>
            <div class="zenleap-help-item"><kbd>b</kbd><span>Scroll to bottom (zb)</span></div>
          </div>
        </div>

        <div class="zenleap-help-section">
          <h2>🔖 Marks</h2>
          <div class="zenleap-help-grid">
            <div class="zenleap-help-item"><kbd>m</kbd> + <kbd>a-z</kbd><span>Set mark (repeat to toggle off)</span></div>
            <div class="zenleap-help-item"><kbd>M</kbd><span>Clear all marks</span></div>
            <div class="zenleap-help-item"><kbd>'</kbd> + <kbd>a-z</kbd><span>Jump to marked tab</span></div>
            <div class="zenleap-help-item"><kbd>Ctrl</kbd> + <kbd>'</kbd> + <kbd>char</kbd><span>Quick jump (no leap mode)</span></div>
          </div>
        </div>

        <div class="zenleap-help-section">
          <h2>🔍 Tab Search</h2>
          <p class="zenleap-help-trigger"><kbd>Ctrl</kbd> + <kbd>/</kbd> to open</p>

          <h3>Insert Mode</h3>
          <div class="zenleap-help-grid">
            <div class="zenleap-help-item"><kbd>↑</kbd> / <kbd>↓</kbd><span>Navigate results</span></div>
            <div class="zenleap-help-item"><kbd>Ctrl</kbd> + <kbd>j/k</kbd><span>Navigate results</span></div>
            <div class="zenleap-help-item"><kbd>Enter</kbd><span>Open selected tab</span></div>
            <div class="zenleap-help-item"><kbd>Ctrl</kbd> + <kbd>x</kbd><span>Close selected tab</span></div>
            <div class="zenleap-help-item"><kbd>Esc</kbd><span>Switch to normal mode</span></div>
          </div>

          <h3>Normal Mode</h3>
          <div class="zenleap-help-grid">
            <div class="zenleap-help-item"><kbd>j</kbd> / <kbd>k</kbd><span>Navigate results</span></div>
            <div class="zenleap-help-item"><kbd>Enter</kbd><span>Open selected tab</span></div>
            <div class="zenleap-help-item"><kbd>x</kbd><span>Close selected tab</span></div>
            <div class="zenleap-help-item"><kbd>1-9</kbd><span>Quick jump to result</span></div>
            <div class="zenleap-help-item"><kbd>h</kbd> / <kbd>l</kbd><span>Move cursor left/right</span></div>
            <div class="zenleap-help-item"><kbd>w</kbd> / <kbd>b</kbd> / <kbd>e</kbd><span>Word movement</span></div>
            <div class="zenleap-help-item"><kbd>0</kbd> / <kbd>$</kbd><span>Beginning/end of line</span></div>
            <div class="zenleap-help-item"><kbd>i</kbd> / <kbd>a</kbd><span>Insert at/after cursor</span></div>
            <div class="zenleap-help-item"><kbd>I</kbd> / <kbd>A</kbd><span>Insert at beginning/end</span></div>
            <div class="zenleap-help-item"><kbd>s</kbd><span>Substitute character</span></div>
            <div class="zenleap-help-item"><kbd>S</kbd><span>Substitute entire line</span></div>
            <div class="zenleap-help-item"><kbd>D</kbd> / <kbd>C</kbd><span>Delete/change to end</span></div>
            <div class="zenleap-help-item"><kbd>Esc</kbd><span>Close search</span></div>
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
        text-align: center;
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
    commandResults = [];
    commandEnteredFromSearch = false;

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
  function selectSearchResult(index) {
    if (index < 0 || index >= searchResults.length) return;

    const result = searchResults[index];
    if (result && result.tab) {
      // Record jump before navigating
      recordJump(gBrowser.selectedTab);

      gBrowser.selectedTab = result.tab;

      // Record destination
      recordJump(result.tab);

      log(`Opened tab from search: ${result.tab.label}`);
    }

    exitSearchMode();
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

      // Enter to execute/select (both modes)
      if (key === 'Enter') {
        event.preventDefault();
        event.stopPropagation();
        handleCommandSelect();
        return true;
      }

      // Tab key (both modes)
      if (key === 'Tab') {
        event.preventDefault();
        event.stopPropagation();
        handleCommandSelect();
        return true;
      }

      // Escape handling: insert → normal → back/exit
      if (key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        if (searchVimMode === 'insert') {
          // Switch to normal mode
          searchCursorPos = searchInput?.selectionStart || 0;
          searchVimMode = 'normal';
          updateSearchVimIndicator();
        } else {
          // In normal mode: go back or exit
          if (commandSubFlow) {
            exitSubFlow();
            // Re-enter insert mode for the previous sub-flow
            searchVimMode = 'insert';
            updateSearchVimIndicator();
          } else {
            // If entered from search (via '>'), go back to search mode
            // If entered directly (Ctrl+Shift+/), exit entirely
            if (commandEnteredFromSearch) {
              exitCommandMode();
            } else {
              exitSearchMode();
            }
          }
        }
        return true;
      }

      // ---- COMMAND NORMAL MODE ----
      if (searchVimMode === 'normal') {
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

      if (searchVimMode === 'insert') {
        // Switch to normal mode
        // Save cursor position before blurring
        searchCursorPos = searchInput.selectionStart || 0;
        searchVimMode = 'normal';
        updateSearchVimIndicator(); // This will blur the input
      } else {
        // Exit search mode
        exitSearchMode();
      }
      return true;
    }

    // Vim normal mode handling
    if (searchVimMode === 'normal') {
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

    // Detect > prefix to enter command mode
    if (value === '>') {
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
      if (tab.hidden) return false;
      return true;
    });
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
      }, 100);
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

    // Handle help mode - Escape or ? to close
    if (helpMode) {
      if (event.key === 'Escape' || event.key === '?') {
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

    // Check for command mode trigger: Ctrl+Shift+/
    if (event.ctrlKey && event.shiftKey && (event.key === '?' || event.key === '/')) {
      event.preventDefault();
      event.stopPropagation();
      enterSearchMode(true);
      return;
    }

    // Check for search trigger: Ctrl+/
    if (event.ctrlKey && event.key === '/') {
      event.preventDefault();
      event.stopPropagation();
      enterSearchMode();
      return;
    }

    // Check for leap mode trigger: Ctrl+Space
    if (event[CONFIG.triggerModifier] && event.key === CONFIG.triggerKey) {
      event.preventDefault();
      event.stopPropagation();

      if (leapMode) {
        exitLeapMode(false);
      } else {
        enterLeapMode();
      }
      return;
    }

    // Check for quick mark jump: Ctrl+' (works outside leap mode)
    if (event[CONFIG.triggerModifier] && (event.key === "'" || event.key === '`')) {
      event.preventDefault();
      event.stopPropagation();

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

    // Handle keys when in leap mode
    if (!leapMode) return;

    const key = event.key.toLowerCase();
    const originalKey = event.key; // Preserve case for special chars

    // Escape to cancel
    if (key === 'escape') {
      event.preventDefault();
      event.stopPropagation();
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

      if (key === 'j' || key === 'arrowdown') {
        if (event.shiftKey) {
          // Shift+J: select current tab, move down, select new tab
          const tabs = getVisibleTabs();
          if (highlightedTabIndex >= 0 && highlightedTabIndex < tabs.length) {
            selectedTabs.add(tabs[highlightedTabIndex]);
          }
          moveHighlight('down');
          if (highlightedTabIndex >= 0 && highlightedTabIndex < tabs.length) {
            selectedTabs.add(tabs[highlightedTabIndex]);
          }
          updateHighlight();
          updateLeapOverlayState();
          log(`Shift+J: navigate+select (${selectedTabs.size} total)`);
        } else {
          moveHighlight('down');
        }
        return;
      }
      if (key === 'k' || key === 'arrowup') {
        if (event.shiftKey) {
          // Shift+K: select current tab, move up, select new tab
          const tabs = getVisibleTabs();
          if (highlightedTabIndex >= 0 && highlightedTabIndex < tabs.length) {
            selectedTabs.add(tabs[highlightedTabIndex]);
          }
          moveHighlight('up');
          if (highlightedTabIndex >= 0 && highlightedTabIndex < tabs.length) {
            selectedTabs.add(tabs[highlightedTabIndex]);
          }
          updateHighlight();
          updateLeapOverlayState();
          log(`Shift+K: navigate+select (${selectedTabs.size} total)`);
        } else {
          moveHighlight('up');
        }
        return;
      }
      if (key === 'enter') {
        confirmBrowseSelection();
        return;
      }
      if (key === 'x') {
        closeHighlightedTab();
        return;
      }
      // Space = toggle selection on highlighted tab
      if (key === ' ') {
        toggleTabSelection();
        return;
      }
      // y = yank selected tabs
      if (key === 'y') {
        yankSelectedTabs();
        return;
      }
      // p = paste yanked tabs after highlighted tab
      if (key === 'p' && originalKey === 'p') {
        pasteTabs('after');
        return;
      }
      // P = paste yanked tabs before highlighted tab
      if (originalKey === 'P') {
        pasteTabs('before');
        return;
      }

      // h = switch to previous workspace, l = switch to next workspace
      if (key === 'h' || key === 'l') {
        browseWorkspaceSwitch(key === 'h' ? 'prev' : 'next');
        return;
      }

      // G = move highlight to last tab
      if (originalKey === 'G') {
        const tabs = getVisibleTabs();
        highlightedTabIndex = tabs.length - 1;
        updateHighlight();
        updateLeapOverlayState();
        log(`Browse: jumped to last tab (index ${highlightedTabIndex})`);
        return;
      }

      // g = pending gg (move highlight to first tab)
      if (key === 'g' && originalKey === 'g') {
        if (browseGPending) {
          // Second g pressed - move to first tab
          clearTimeout(browseGTimeout);
          browseGPending = false;
          browseGTimeout = null;
          highlightedTabIndex = 0;
          updateHighlight();
          updateLeapOverlayState();
          log(`Browse: jumped to first tab (index 0)`);
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
        }, 500);
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

      // gg - go to first tab
      if (key === 'g' && gNumberBuffer === '') {
        goToAbsoluteTab(1);
        return;
      }

      // G in g-mode - go to last tab
      if (originalKey === 'G' && gNumberBuffer === '') {
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
        }, 800); // 800ms timeout for multi-digit

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

      if (key === 'z') {
        scrollTabIntoView('center');
        exitLeapMode(false);
        return;
      }
      if (key === 't') {
        scrollTabIntoView('top');
        exitLeapMode(false);
        return;
      }
      if (key === 'b') {
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

    if (key === 'j' || key === 'arrowdown') {
      enterBrowseMode('down');
      return;
    }
    if (key === 'k' || key === 'arrowup') {
      enterBrowseMode('up');
      return;
    }
    // G (shift+g) - go to last tab directly (must check before lowercase g)
    if (originalKey === 'G') {
      const tabs = getVisibleTabs();
      goToAbsoluteTab(tabs.length);
      return;
    }
    if (key === 'g') {
      gMode = true;
      gNumberBuffer = '';
      clearTimeout(leapModeTimeout); // No timeout in g-mode
      updateLeapOverlayState();
      log('Entered g-mode');
      return;
    }
    if (key === 'z') {
      zMode = true;
      clearTimeout(leapModeTimeout); // No timeout in z-mode
      updateLeapOverlayState();
      log('Entered z-mode');
      return;
    }
    if (key === 'm' && originalKey !== 'M') {
      markMode = true;
      document.documentElement.setAttribute('data-zenleap-mark-mode', 'true');
      clearTimeout(leapModeTimeout); // No timeout in mark mode
      updateLeapOverlayState();
      log('Entered mark mode');
      return;
    }
    // M (shift+m) - clear all marks
    if (originalKey === 'M') {
      clearAllMarks();
      exitLeapMode(false);
      return;
    }
    if (key === "'" || key === '`') {
      gotoMarkMode = true;
      document.documentElement.setAttribute('data-zenleap-mark-mode', 'true');
      clearTimeout(leapModeTimeout); // No timeout in goto mark mode
      updateLeapOverlayState();
      log('Entered goto mark mode');
      return;
    }
    if (key === 'o') {
      // Jump back in history
      if (jumpBack()) {
        exitLeapMode(true); // Center scroll
      }
      return;
    }
    if (key === 'i') {
      // Jump forward in history
      if (jumpForward()) {
        exitLeapMode(true); // Center scroll
      }
      return;
    }
    // h = enter browse mode + switch to previous workspace
    // l = enter browse mode + switch to next workspace
    if (key === 'h' || key === 'l') {
      // Set browse state directly without highlighting in current workspace —
      // browseWorkspaceSwitch will reset highlight after the workspace switch
      browseMode = true;
      browseDirection = key === 'h' ? 'up' : 'down';
      const tabs = getVisibleTabs();
      const currentTab = gBrowser.selectedTab;
      originalTabIndex = tabs.indexOf(currentTab);
      originalTab = currentTab;
      highlightedTabIndex = 0;
      clearTimeout(leapModeTimeout);
      updateLeapOverlayState();
      browseWorkspaceSwitch(key === 'h' ? 'prev' : 'next');
      return;
    }
    // ? - open help modal
    if (originalKey === '?') {
      enterHelpMode();
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

  // Set up keyboard listener
  function setupKeyboardListener() {
    window.addEventListener('keydown', handleKeyDown, true);
    log('Keyboard listener set up');
  }

  // Add CSS for relative number display and highlight
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
        outline: 2px solid #61afef !important;
        outline-offset: -2px;
        background-color: rgba(97, 175, 239, 0.2) !important;
      }

      tab[data-zenleap-highlight="true"] > .tab-stack > .tab-content {
        background-color: rgba(97, 175, 239, 0.15) !important;
      }

      /* Selected tabs in browse mode (multi-select with Space) */
      tab[data-zenleap-selected="true"] {
        outline: 2px solid #c678dd !important;
        outline-offset: -2px;
        background-color: rgba(198, 120, 221, 0.2) !important;
      }

      tab[data-zenleap-selected="true"] > .tab-stack > .tab-content {
        background-color: rgba(198, 120, 221, 0.15) !important;
      }

      /* Tab that is both highlighted and selected */
      tab[data-zenleap-highlight="true"][data-zenleap-selected="true"] {
        outline: 2px solid #e5c07b !important;
        background-color: rgba(229, 192, 123, 0.25) !important;
      }

      tab[data-zenleap-highlight="true"][data-zenleap-selected="true"] > .tab-stack > .tab-content {
        background-color: rgba(229, 192, 123, 0.2) !important;
      }

      /* Expanded sidebar mode */
      @media (-moz-bool-pref: "zen.view.sidebar-expanded") {
        tab:not([zen-glance-tab="true"]) > .tab-stack > .tab-content[data-zenleap-rel]::after {
          content: attr(data-zenleap-rel) !important;
          font-weight: bold;
          font-size: 80%;
          z-index: 100;
          display: inline-block;
          background-color: #505050;
          color: #e0e0e0;
          text-align: center;
          width: 20px;
          height: 20px;
          line-height: 20px;
          border-radius: 4px;
          margin-left: 3px;
          margin-right: 3px;
          font-family: monospace;
        }

        tab[data-zenleap-direction="current"]:not([zen-glance-tab="true"]) > .tab-stack > .tab-content[data-zenleap-rel]::after {
          background-color: #61afef !important;
          color: #1e1e1e !important;
        }

        tab[data-zenleap-direction="up"]:not([zen-glance-tab="true"]) > .tab-stack > .tab-content[data-zenleap-rel]::after {
          background-color: #455a6f;
        }

        tab[data-zenleap-direction="down"]:not([zen-glance-tab="true"]) > .tab-stack > .tab-content[data-zenleap-rel]::after {
          background-color: #455a6f;
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
          background-color: #61afef !important;
          color: #1e1e1e !important;
          box-shadow: 0 0 8px rgba(97, 175, 239, 0.6);
        }

        /* Marked tab badge - distinct red/magenta color */
        tab[data-zenleap-has-mark="true"]:not([zen-glance-tab="true"]) > .tab-stack > .tab-content[data-zenleap-rel]::after {
          background-color: #e06c75 !important;
          color: #1e1e1e !important;
          font-weight: bold !important;
          box-shadow: 0 0 6px rgba(224, 108, 117, 0.5);
        }
      }

      /* Compact sidebar mode */
      @media not (-moz-bool-pref: "zen.view.sidebar-expanded") {
        tab:not([zen-glance-tab="true"]) > .tab-stack > .tab-content[data-zenleap-rel]::before {
          content: attr(data-zenleap-rel);
          position: absolute;
          top: 2px;
          right: 2px;
          font-weight: bold;
          font-size: 70%;
          z-index: 100;
          color: #abb2bf;
          font-family: monospace;
          text-shadow: 0 0 2px rgba(0,0,0,0.5);
        }

        tab[data-zenleap-direction="current"]:not([zen-glance-tab="true"]) > .tab-stack > .tab-content[data-zenleap-rel]::before {
          color: #61afef !important;
        }

        tab[data-zenleap-highlight="true"]:not([zen-glance-tab="true"]) > .tab-stack > .tab-content[data-zenleap-rel]::before {
          color: #61afef !important;
          text-shadow: 0 0 6px rgba(97, 175, 239, 0.8);
        }

        /* Marked tab in compact mode - distinct red/magenta color */
        tab[data-zenleap-has-mark="true"]:not([zen-glance-tab="true"]) > .tab-stack > .tab-content[data-zenleap-rel]::before {
          color: #e06c75 !important;
          text-shadow: 0 0 4px rgba(224, 108, 117, 0.8);
          font-weight: bold !important;
        }
      }

      /* Leap mode active indicator - green for up, yellow for down */
      :root[data-zenleap-active="true"] tab[data-zenleap-direction="up"]:not([zen-glance-tab="true"]) > .tab-stack > .tab-content[data-zenleap-rel]::after,
      :root[data-zenleap-active="true"] tab[data-zenleap-direction="up"]:not([zen-glance-tab="true"]) > .tab-stack > .tab-content[data-zenleap-rel]::before {
        color: #98c379 !important;
        background-color: #2c4a32 !important;
      }

      :root[data-zenleap-active="true"] tab[data-zenleap-direction="down"]:not([zen-glance-tab="true"]) > .tab-stack > .tab-content[data-zenleap-rel]::after,
      :root[data-zenleap-active="true"] tab[data-zenleap-direction="down"]:not([zen-glance-tab="true"]) > .tab-stack > .tab-content[data-zenleap-rel]::before {
        color: #e5c07b !important;
        background-color: #4a4232 !important;
      }

      /* Mark mode - gray out all non-marked tabs (higher specificity via [data-zenleap-active]) */
      :root[data-zenleap-active="true"][data-zenleap-mark-mode="true"] tab:not([data-zenleap-has-mark="true"]):not([zen-glance-tab="true"]) > .tab-stack > .tab-content[data-zenleap-rel]::after {
        color: #666666 !important;
        background-color: #505050 !important;
        box-shadow: none !important;
      }

      :root[data-zenleap-active="true"][data-zenleap-mark-mode="true"] tab:not([data-zenleap-has-mark="true"]):not([zen-glance-tab="true"]) > .tab-stack > .tab-content[data-zenleap-rel]::before {
        color: #666666 !important;
        text-shadow: none !important;
      }

      /* Mark mode - keep marked tabs red with enhanced visibility */
      :root[data-zenleap-active="true"][data-zenleap-mark-mode="true"] tab[data-zenleap-has-mark="true"]:not([zen-glance-tab="true"]) > .tab-stack > .tab-content[data-zenleap-rel]::after {
        background-color: #e06c75 !important;
        color: #1e1e1e !important;
        box-shadow: 0 0 8px rgba(224, 108, 117, 0.7) !important;
      }

      :root[data-zenleap-active="true"][data-zenleap-mark-mode="true"] tab[data-zenleap-has-mark="true"]:not([zen-glance-tab="true"]) > .tab-stack > .tab-content[data-zenleap-rel]::before {
        color: #e06c75 !important;
        text-shadow: 0 0 6px rgba(224, 108, 117, 0.9) !important;
      }
    `;
    document.head.appendChild(style);
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
