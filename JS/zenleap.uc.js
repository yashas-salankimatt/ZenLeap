// ==UserScript==
// @name           ZenLeap - Relative Tab Navigation
// @description    Vim-style relative tab numbering with keyboard navigation
// @include        main
// @author         ZenLeap
// @version        1.0.0
// ==/UserScript==

(function() {
  'use strict';

  // Configuration
  const CONFIG = {
    debug: true,
    currentTabIndicator: '·',  // What to show on current tab (could be '0' or '·')
    overflowIndicator: '+',    // For positions > 45
    leapModeTimeout: 3000,     // Auto-cancel leap mode after 3 seconds
    triggerKey: ' ',           // Space key
    triggerModifier: 'ctrlKey' // Ctrl modifier
  };

  // Special characters for distances 36-45 (shift + number row)
  const SPECIAL_CHARS = ['!', '@', '#', '$', '%', '^', '&', '*', '(', ')'];

  // State
  let leapMode = false;
  let leapDirection = null; // 'up' (k) or 'down' (j)
  let zMode = false;        // true after pressing 'z', waiting for z/t/b
  let leapModeTimeout = null;
  let leapOverlay = null;

  // Utility: Convert number to display character
  // 0 = current, 1-9 = digits, 10-35 = A-Z, 36-45 = special chars
  function numberToDisplay(num) {
    if (num === 0) return CONFIG.currentTabIndicator;
    if (num >= 1 && num <= 9) return String(num);
    if (num >= 10 && num <= 35) return String.fromCharCode(65 + num - 10); // A-Z
    if (num >= 36 && num <= 45) return SPECIAL_CHARS[num - 36]; // !@#$%^&*()
    return CONFIG.overflowIndicator; // 46+
  }

  // Utility: Convert display character back to number
  // Supports: 1-9, A-Z (case insensitive), !@#$%^&*()
  function displayToNumber(char) {
    // Digits 1-9
    if (char >= '1' && char <= '9') return parseInt(char);

    // Letters A-Z (case insensitive) = 10-35
    const upper = char.toUpperCase();
    if (upper >= 'A' && upper <= 'Z') return upper.charCodeAt(0) - 65 + 10;

    // Special characters = 36-45
    const specialIndex = SPECIAL_CHARS.indexOf(char);
    if (specialIndex !== -1) return 36 + specialIndex;

    return null;
  }

  // Get visible tabs (excluding glance tabs and hidden workspace tabs)
  function getVisibleTabs() {
    const tabs = Array.from(gBrowser.tabs);
    return tabs.filter(tab => {
      // Exclude glance tabs
      if (tab.hasAttribute('zen-glance-tab')) return false;
      // Exclude hidden tabs
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

    tabs.forEach((tab, index) => {
      const relativeDistance = Math.abs(index - currentIndex);
      const direction = index < currentIndex ? 'up' : (index > currentIndex ? 'down' : 'current');
      const displayChar = numberToDisplay(relativeDistance);

      // Set data attributes on the tab element (for CSS selectors)
      tab.setAttribute('data-zenleap-direction', direction);
      tab.setAttribute('data-zenleap-distance', relativeDistance);

      // IMPORTANT: Set data-zenleap-rel on .tab-content because CSS attr()
      // only reads from the element the pseudo-element is attached to
      const tabContent = tab.querySelector('.tab-content');
      if (tabContent) {
        tabContent.setAttribute('data-zenleap-rel', displayChar);
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

    // Create elements programmatically to avoid innerHTML sanitization issues
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
    overlayHintLabel.textContent = 'Press j (down) or k (up)';

    content.appendChild(overlayModeLabel);
    content.appendChild(overlayDirectionLabel);
    content.appendChild(overlayHintLabel);
    leapOverlay.appendChild(content);

    // Add styles
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
    // Reset state for new leap mode session
    if (overlayDirectionLabel) overlayDirectionLabel.textContent = '';
    if (overlayHintLabel) overlayHintLabel.textContent = 'j/k=jump  z=scroll';
    leapOverlay.classList.remove('leap-direction-set');
  }

  // Hide leap mode overlay
  function hideLeapOverlay() {
    if (leapOverlay) {
      leapOverlay.style.display = 'none';
    }
  }

  // Update overlay state based on current leap mode state
  function updateLeapOverlayState() {
    if (!leapOverlay || !overlayDirectionLabel || !overlayHintLabel) return;

    if (zMode) {
      // Z-mode: waiting for z, t, or b
      leapOverlay.classList.add('leap-direction-set');
      overlayDirectionLabel.textContent = 'z';
      overlayHintLabel.textContent = 'z=center  t=top  b=bottom';
    } else if (leapDirection) {
      // Direction set: waiting for number/letter
      leapOverlay.classList.add('leap-direction-set');
      overlayDirectionLabel.textContent = leapDirection === 'up' ? '↑ UP' : '↓ DOWN';
      overlayHintLabel.textContent = '1-9, a-z, or !@#$%^&*()';
    } else {
      // Initial state: waiting for j, k, or z
      leapOverlay.classList.remove('leap-direction-set');
      overlayDirectionLabel.textContent = '';
      overlayHintLabel.textContent = 'j/k=jump  z=scroll';
    }
  }

  // Enter leap mode
  function enterLeapMode() {
    if (leapMode) return;

    leapMode = true;
    leapDirection = null;
    document.documentElement.setAttribute('data-zenleap-active', 'true');
    showLeapOverlay();

    // Auto-cancel after timeout
    clearTimeout(leapModeTimeout);
    leapModeTimeout = setTimeout(() => {
      if (leapMode) {
        log('Leap mode timed out');
        exitLeapMode();
      }
    }, CONFIG.leapModeTimeout);

    log('Entered leap mode');
  }

  // Exit leap mode
  function exitLeapMode() {
    leapMode = false;
    leapDirection = null;
    zMode = false;
    clearTimeout(leapModeTimeout);
    document.documentElement.removeAttribute('data-zenleap-active');
    hideLeapOverlay();
    log('Exited leap mode');
  }

  // Navigate to tab by relative distance
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

    // Clamp to valid range
    targetIndex = Math.max(0, Math.min(tabs.length - 1, targetIndex));

    if (targetIndex !== currentIndex) {
      gBrowser.selectedTab = tabs[targetIndex];
      log(`Navigated ${direction} ${distance} tabs to index ${targetIndex}`);
      return true;
    }

    log(`Already at boundary, cannot navigate ${direction}`);
    return false;
  }

  // Find the scrollable tab container
  function findScrollableTabContainer() {
    const currentTab = gBrowser.selectedTab;
    if (!currentTab) return null;

    // Walk up from the tab to find scrollable parent
    let element = currentTab.parentElement;
    let depth = 0;
    const maxDepth = 15;

    while (element && depth < maxDepth) {
      // Check for Firefox/XUL scrollbox property (most common in Zen)
      if (element.scrollbox && element.scrollbox.scrollHeight > element.scrollbox.clientHeight) {
        return element.scrollbox;
      }

      // Check if this element is directly scrollable
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

    // Fallback: try known selectors
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

  // Scroll the current tab into view at a specific position
  // position: 'center', 'top', or 'bottom'
  function scrollTabIntoView(position) {
    const currentTab = gBrowser.selectedTab;
    if (!currentTab) return;

    const scrollContainer = findScrollableTabContainer();
    if (!scrollContainer) {
      // Fallback: use native scrollIntoView
      const block = position === 'center' ? 'center' : (position === 'top' ? 'start' : 'end');
      currentTab.scrollIntoView({ behavior: 'smooth', block: block });
      log(`Scroll fallback: scrollIntoView(${block})`);
      return;
    }

    // Get dimensions
    const containerRect = scrollContainer.getBoundingClientRect();
    const tabRect = currentTab.getBoundingClientRect();
    const currentScrollTop = scrollContainer.scrollTop;

    // Calculate tab position relative to scroll container's content
    const tabTopInContainer = tabRect.top - containerRect.top + currentScrollTop;
    const tabBottomInContainer = tabTopInContainer + tabRect.height;
    const tabCenterInContainer = tabTopInContainer + tabRect.height / 2;

    const viewHeight = containerRect.height;
    const maxScroll = Math.max(0, scrollContainer.scrollHeight - viewHeight);

    // Check if scrolling is possible
    if (maxScroll <= 0) {
      log('All tabs fit in view, no scroll needed');
      return;
    }

    let targetScroll;
    const padding = 10;

    if (position === 'center') {
      targetScroll = tabCenterInContainer - viewHeight / 2;
    } else if (position === 'top') {
      targetScroll = tabTopInContainer - padding;
    } else if (position === 'bottom') {
      targetScroll = tabBottomInContainer - viewHeight + padding;
    }

    // Clamp to valid range
    targetScroll = Math.max(0, Math.min(maxScroll, targetScroll));

    // Only scroll if meaningful change
    if (Math.abs(targetScroll - currentScrollTop) < 2) {
      log(`Already at ${position}`);
      return;
    }

    scrollContainer.scrollTo({ top: targetScroll, behavior: 'smooth' });
    log(`Scrolled ${position}: ${Math.round(currentScrollTop)} -> ${Math.round(targetScroll)}`);
  }

  // Handle keydown events
  function handleKeyDown(event) {
    // Check for leap mode trigger: Ctrl+Space
    if (event[CONFIG.triggerModifier] && event.key === CONFIG.triggerKey) {
      event.preventDefault();
      event.stopPropagation();

      if (leapMode) {
        exitLeapMode();
      } else {
        enterLeapMode();
      }
      return;
    }

    // Handle keys when in leap mode
    if (!leapMode) return;

    const key = event.key.toLowerCase();

    // Escape to cancel
    if (key === 'escape') {
      event.preventDefault();
      event.stopPropagation();
      exitLeapMode();
      return;
    }

    // Handle z-mode (after pressing 'z')
    if (zMode) {
      event.preventDefault();
      event.stopPropagation();

      if (key === 'z') {
        // zz - center current tab
        scrollTabIntoView('center');
        exitLeapMode();
        return;
      }
      if (key === 't') {
        // zt - current tab to top
        scrollTabIntoView('top');
        exitLeapMode();
        return;
      }
      if (key === 'b') {
        // zb - current tab to bottom
        scrollTabIntoView('bottom');
        exitLeapMode();
        return;
      }

      // Invalid key in z-mode, exit z-mode but stay in leap mode
      zMode = false;
      updateLeapOverlayState();
      log(`Invalid z-mode key: ${key}, exiting z-mode`);
      return;
    }

    // Direction keys (j/k) or z-mode entry
    if (!leapDirection) {
      if (key === 'j') {
        event.preventDefault();
        event.stopPropagation();
        leapDirection = 'down';
        updateLeapOverlayState();
        log('Direction set: down (j)');
        return;
      }
      if (key === 'k') {
        event.preventDefault();
        event.stopPropagation();
        leapDirection = 'up';
        updateLeapOverlayState();
        log('Direction set: up (k)');
        return;
      }
      if (key === 'z') {
        event.preventDefault();
        event.stopPropagation();
        zMode = true;
        updateLeapOverlayState();
        log('Entered z-mode (press z/t/b)');
        return;
      }
      return;
    }

    // Number/hex keys for distance (when direction is set)
    const distance = displayToNumber(key);
    if (distance !== null && distance >= 1) {
      event.preventDefault();
      event.stopPropagation();
      navigateToTab(leapDirection, distance);
      exitLeapMode();
      return;
    }
  }

  // Set up event listeners for tab changes
  function setupTabListeners() {
    // Listen for tab selection changes
    gBrowser.tabContainer.addEventListener('TabSelect', () => {
      updateRelativeNumbers();
    });

    // Listen for tab open/close
    gBrowser.tabContainer.addEventListener('TabOpen', () => {
      setTimeout(updateRelativeNumbers, 50); // Small delay for DOM update
    });

    gBrowser.tabContainer.addEventListener('TabClose', () => {
      setTimeout(updateRelativeNumbers, 50);
    });

    // Listen for tab moves
    gBrowser.tabContainer.addEventListener('TabMove', () => {
      updateRelativeNumbers();
    });

    // Listen for workspace changes (Zen-specific)
    document.addEventListener('ZenWorkspaceChanged', () => {
      setTimeout(updateRelativeNumbers, 100);
    });

    log('Tab listeners set up');
  }

  // Set up keyboard listener
  function setupKeyboardListener() {
    // Use capture phase to intercept before other handlers
    window.addEventListener('keydown', handleKeyDown, true);
    log('Keyboard listener set up');
  }

  // Add CSS for relative number display
  function injectStyles() {
    const style = document.createElement('style');
    style.id = 'zenleap-styles';
    style.textContent = `
      /* Base styles for relative tab numbers */
      tab[data-zenleap-rel] {
        position: relative;
      }

      /* Expanded sidebar mode */
      @media (-moz-bool-pref: "zen.view.sidebar-expanded") {
        /* Main number badge - reads data-zenleap-rel from .tab-content */
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

        /* Current tab styling */
        tab[data-zenleap-direction="current"]:not([zen-glance-tab="true"]) > .tab-stack > .tab-content[data-zenleap-rel]::after {
          background-color: #61afef !important;
          color: #1e1e1e !important;
        }

        /* Tabs above current */
        tab[data-zenleap-direction="up"]:not([zen-glance-tab="true"]) > .tab-stack > .tab-content[data-zenleap-rel]::after {
          background-color: #455a6f;
        }

        /* Tabs below current */
        tab[data-zenleap-direction="down"]:not([zen-glance-tab="true"]) > .tab-stack > .tab-content[data-zenleap-rel]::after {
          background-color: #455a6f;
        }

        /* Hide on hover, show close button */
        tab:not([zen-glance-tab="true"]) > .tab-stack > .tab-content[data-zenleap-rel]:hover::after {
          opacity: 0;
          width: 0;
          margin: 0;
        }

        /* Hide close button by default */
        tab .tab-close-button {
          visibility: hidden;
          opacity: 0;
          width: 0;
          margin: 0;
        }

        tab:hover .tab-close-button {
          visibility: visible;
          opacity: 1;
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

        /* Current tab in compact mode */
        tab[data-zenleap-direction="current"]:not([zen-glance-tab="true"]) > .tab-stack > .tab-content[data-zenleap-rel]::before {
          color: #61afef !important;
        }
      }

      /* Leap mode active indicator */
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
    log('Initializing ZenLeap...');

    // Wait for browser to be ready
    if (!gBrowser || !gBrowser.tabs) {
      log('gBrowser not ready, retrying in 500ms');
      setTimeout(init, 500);
      return;
    }

    injectStyles();
    setupTabListeners();
    setupKeyboardListener();
    updateRelativeNumbers();

    log('ZenLeap initialized successfully!');
    log('Press Ctrl+Space to enter leap mode');
    log('  j/k + 1-9/a-z/!@#$%^&*() = jump 1-45 tabs down/up');
    log('  zz = center tab | zt = tab to top | zb = tab to bottom');
  }

  // Start initialization when DOM is ready
  if (document.readyState === 'complete') {
    init();
  } else {
    document.addEventListener('DOMContentLoaded', init);
  }

})();
