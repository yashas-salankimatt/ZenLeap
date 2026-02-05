// ==UserScript==
// @name           ZenLeap - Relative Tab Navigation
// @description    Vim-style relative tab numbering with keyboard navigation
// @include        main
// @author         ZenLeap
// @version        2.4.0
// ==/UserScript==

(function() {
  'use strict';

  // Configuration
  const CONFIG = {
    debug: true,
    currentTabIndicator: '·',  // What to show on current tab
    overflowIndicator: '+',    // For positions > 45
    leapModeTimeout: 3000,     // Auto-cancel leap mode after 3 seconds (not used in browse mode)
    triggerKey: ' ',           // Space key
    triggerModifier: 'ctrlKey' // Ctrl modifier
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
  let browseDirection = null;  // 'up' or 'down' - initial direction

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

  // Record a jump to the jump list
  function recordJump(tab) {
    if (!recordingJumps || !tab) return;

    // Clean up any closed tabs from the list
    jumpList = jumpList.filter(t => t && !t.closing && t.parentNode);

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
    jumpList = jumpList.filter(t => t && !t.closing && t.parentNode);

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
    jumpList = jumpList.filter(t => t && !t.closing && t.parentNode);

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
  // Falls back to original order if lastAccessed is unavailable
  function sortTabsByRecency(tabs) {
    if (tabs.length === 0) return tabs;

    // Check if lastAccessed is available by sampling first tab
    const sampleTab = tabs[0];
    const hasLastAccessed = sampleTab.lastAccessed &&
      typeof sampleTab.lastAccessed === 'number' &&
      sampleTab.lastAccessed > 0;

    if (!hasLastAccessed) {
      // Fallback: return original order (Firefox may already order by recency)
      log('lastAccessed not available, using default tab order');
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
  function searchTabs(query) {
    const currentTab = gBrowser.selectedTab;

    // Get visible tabs, excluding the current tab
    const tabs = getVisibleTabs().filter(tab => tab !== currentTab);
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

    // Log all results for debugging
    if (results.length > 0 && CONFIG.debug) {
      const debugLines = [`\n=== Search Results for "${query}" ===`];
      const topResults = results.slice(0, 15); // Show top 15
      topResults.forEach((r, i) => {
        const tab = r.tab;
        const lastAccessed = tab.lastAccessed;
        const ageMs = lastAccessed ? Date.now() - lastAccessed : 0;
        const ageMins = (ageMs / 60000).toFixed(1);
        debugLines.push(
          `#${i + 1}: "${tab.label.substring(0, 50)}"` +
          `\n    total=${r.score.toFixed(1)} | match=${r.matchScore.toFixed(1)} | mult=${r.recencyMultiplier.toFixed(2)}x` +
          `\n    lastAccessed=${ageMins}min ago`
        );
      });
      debugLines.push(`=== End Results ===\n`);
      log(debugLines.join('\n'));
    }

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

    searchResultsList = document.createElement('div');
    searchResultsList.id = 'zenleap-search-results';

    searchHintBar = document.createElement('div');
    searchHintBar.id = 'zenleap-search-hint-bar';

    container.appendChild(inputWrapper);
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
    `;

    document.head.appendChild(style);
    document.documentElement.appendChild(searchModal);

    // Add input event listener
    searchInput.addEventListener('input', handleSearchInput);

    // Handle keydown on input for insert mode navigation
    searchInput.addEventListener('keydown', (e) => {
      // In insert mode, let navigation keys be handled by our main handler
      if ((e.ctrlKey && (e.key === 'j' || e.key === 'k')) ||
          e.key === 'ArrowUp' || e.key === 'ArrowDown' ||
          e.key === 'Enter' || e.key === 'Escape') {
        return; // Let handleSearchKeyDown handle these
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

  // Update the hint bar content based on current mode
  function updateSearchHintBar() {
    if (!searchHintBar) return;

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
        <span class="zenleap-help-version">v2.3.0</span>
        <span class="zenleap-help-subtitle">Vim-style Tab Navigation</span>
      </div>

      <div class="zenleap-help-content">
        <div class="zenleap-help-section">
          <h2>🚀 Leap Mode</h2>
          <p class="zenleap-help-trigger"><kbd>Ctrl</kbd> + <kbd>Space</kbd> to activate</p>
          <div class="zenleap-help-grid">
            <div class="zenleap-help-item"><kbd>j</kbd> / <kbd>k</kbd><span>Enter browse mode (down/up)</span></div>
            <div class="zenleap-help-item"><kbd>↑</kbd> / <kbd>↓</kbd><span>Enter browse mode (arrows)</span></div>
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
  function enterSearchMode() {
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

    // Reset input value
    searchInput.value = '';

    // Show modal
    searchModal.classList.add('active');

    // Render results (shows all tabs when query is empty)
    renderSearchResults();

    // Use updateSearchVimIndicator to properly set up input/display visibility
    // This ensures input is shown and display is hidden for insert mode
    updateSearchVimIndicator();

    log('Entered search mode');
  }

  // Exit search mode
  function exitSearchMode() {
    if (!searchMode) return;

    searchMode = false;
    searchModal.classList.remove('active');

    // Reset vim mode to insert for next time
    searchVimMode = 'insert';

    // Ensure input is visible and display is hidden for next open
    if (searchInput) {
      searchInput.style.display = '';
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
    if (searchResults.length === 0) return;

    if (direction === 'down') {
      searchSelectedIndex = (searchSelectedIndex + 1) % searchResults.length;
    } else {
      searchSelectedIndex = (searchSelectedIndex - 1 + searchResults.length) % searchResults.length;
    }

    renderSearchResults();
  }

  // Update search vim indicator and handle focus/display based on mode
  function updateSearchVimIndicator() {
    if (!searchVimIndicator) return;

    if (searchVimMode === 'insert') {
      searchVimIndicator.textContent = 'INSERT';
      searchVimIndicator.classList.remove('normal');

      // Show input, hide display
      if (searchInputDisplay) {
        searchInputDisplay.style.display = 'none';
      }
      if (searchInput) {
        searchInput.style.display = '';

        // Focus with retry mechanism
        const focusInput = () => {
          if (searchInput && searchMode && searchVimMode === 'insert') {
            searchInput.focus();
            searchInput.setSelectionRange(searchCursorPos, searchCursorPos);
            if (document.activeElement !== searchInput) {
              requestAnimationFrame(focusInput);
            } else {
              log('Search input focused');
            }
          }
        };
        requestAnimationFrame(focusInput);
      }
    } else {
      searchVimIndicator.textContent = 'NORMAL';
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

    const text = searchQuery;
    const pos = searchCursorPos;

    if (text.length === 0) {
      // Empty - show placeholder with cursor
      searchInputDisplay.innerHTML = '<span class="cursor-empty"></span><span class="placeholder">Search tabs...</span>';
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
    searchQuery = searchInput.value;
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
      overlayDirectionLabel.textContent = pos;
      overlayHintLabel.textContent = 'j/k/↑↓=move  Enter=open  x=close  Esc=cancel';
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

    // Remove highlight from all tabs
    tabs.forEach(tab => {
      tab.removeAttribute('data-zenleap-highlight');
    });

    // Add highlight to the current browsed tab
    if (highlightedTabIndex >= 0 && highlightedTabIndex < tabs.length) {
      const highlightedTab = tabs[highlightedTabIndex];
      highlightedTab.setAttribute('data-zenleap-highlight', 'true');

      // Scroll the highlighted tab into view
      scrollTabToView(highlightedTab, 'center');
    }
  }

  // Clear all highlights
  function clearHighlight() {
    const tabs = getVisibleTabs();
    tabs.forEach(tab => {
      tab.removeAttribute('data-zenleap-highlight');
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

  // Close the highlighted tab
  function closeHighlightedTab() {
    const tabs = getVisibleTabs();

    if (highlightedTabIndex < 0 || highlightedTabIndex >= tabs.length) {
      log('No valid tab to close');
      return;
    }

    const tabToClose = tabs[highlightedTabIndex];
    const wasLastTab = highlightedTabIndex === tabs.length - 1;

    // Close the tab
    gBrowser.removeTab(tabToClose);
    log(`Closed tab at index ${highlightedTabIndex}`);

    // Update tabs list after close
    const newTabs = getVisibleTabs();

    if (newTabs.length === 0) {
      // All tabs closed, exit
      exitLeapMode(false);
      return;
    }

    // Adjust highlight index
    if (wasLastTab || highlightedTabIndex >= newTabs.length) {
      // Was last tab or index now out of bounds, move to previous
      highlightedTabIndex = newTabs.length - 1;
    }
    // Otherwise keep same index (which now points to the next tab)

    updateHighlight();
    updateLeapOverlayState();
  }

  // Cancel browse mode - return to original tab
  function cancelBrowseMode() {
    const tabs = getVisibleTabs();

    if (originalTabIndex >= 0 && originalTabIndex < tabs.length) {
      gBrowser.selectedTab = tabs[originalTabIndex];
      log(`Cancelled, returned to original tab ${originalTabIndex}`);
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
    browseDirection = null;

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
        moveHighlight('down');
        return;
      }
      if (key === 'k' || key === 'arrowup') {
        moveHighlight('up');
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
  function init() {
    log('Initializing ZenLeap v2.3.0...');

    if (!gBrowser || !gBrowser.tabs) {
      log('gBrowser not ready, retrying in 500ms');
      setTimeout(init, 500);
      return;
    }

    injectStyles();
    setupTabListeners();
    setupKeyboardListener();
    updateRelativeNumbers();

    log('ZenLeap v2.3.0 initialized successfully!');
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
