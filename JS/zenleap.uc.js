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
    overflowIndicator: '+',    // For positions > 15
    leapModeTimeout: 3000,     // Auto-cancel leap mode after 3 seconds
    triggerKey: ' ',           // Space key
    triggerModifier: 'ctrlKey' // Ctrl modifier
  };

  // State
  let leapMode = false;
  let leapDirection = null; // 'up' (k) or 'down' (j)
  let zMode = false;        // true after pressing 'z', waiting for z/t/b
  let leapModeTimeout = null;
  let leapOverlay = null;

  // Utility: Convert number to display character
  function numberToDisplay(num) {
    if (num === 0) return CONFIG.currentTabIndicator;
    if (num >= 1 && num <= 9) return String(num);
    if (num >= 10 && num <= 15) return String.fromCharCode(65 + num - 10); // A-F
    return CONFIG.overflowIndicator;
  }

  // Utility: Convert display character back to number
  function displayToNumber(char) {
    const upper = char.toUpperCase();
    if (upper >= '1' && upper <= '9') return parseInt(upper);
    if (upper >= 'A' && upper <= 'F') return upper.charCodeAt(0) - 65 + 10;
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
      // Direction set: waiting for number
      leapOverlay.classList.add('leap-direction-set');
      overlayDirectionLabel.textContent = leapDirection === 'up' ? '↑ UP' : '↓ DOWN';
      overlayHintLabel.textContent = 'Press 1-9 or a-f to jump';
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
    // Strategy: Walk up from current tab to find the actual scrollable ancestor
    const currentTab = gBrowser.selectedTab;
    if (!currentTab) {
      log('findScrollableTabContainer: No current tab');
      return null;
    }

    // Walk up from the tab to find scrollable parent
    let element = currentTab.parentElement;
    let depth = 0;
    const maxDepth = 20;

    while (element && depth < maxDepth) {
      // Check if this element is actually scrollable (has overflow content)
      const hasOverflowContent = element.scrollHeight > element.clientHeight;
      const style = window.getComputedStyle(element);
      const canScroll = style.overflowY === 'auto' || style.overflowY === 'scroll' ||
                        style.overflow === 'auto' || style.overflow === 'scroll';

      // Also check for XUL scrollbox
      const isScrollbox = element.tagName?.toLowerCase() === 'scrollbox' ||
                          element.tagName?.toLowerCase() === 'arrowscrollbox' ||
                          element.classList?.contains('scrollbox');

      if (hasOverflowContent && (canScroll || isScrollbox)) {
        log(`findScrollableTabContainer: Found at depth ${depth}: ${element.tagName}#${element.id}.${element.className}`);
        log(`  scrollHeight=${element.scrollHeight}, clientHeight=${element.clientHeight}`);
        return element;
      }

      // Check for Firefox/XUL scrollbox property
      if (element.scrollbox && element.scrollbox.scrollHeight > element.scrollbox.clientHeight) {
        log(`findScrollableTabContainer: Found scrollbox property at depth ${depth}`);
        return element.scrollbox;
      }

      element = element.parentElement;
      depth++;
    }

    // Fallback: Try known selectors and check which one is actually scrollable
    const selectors = [
      '#tabbrowser-arrowscrollbox',
      '#tabbrowser-tabs',
      '.tabbrowser-tabs',
      '#TabsToolbar',
      '#zen-sidebar-tabs-wrapper',
      '#vertical-pinned-tabs-container',
      '.zen-workspace-tabs-section',
      'arrowscrollbox',
      '[orient="vertical"]'
    ];

    for (const selector of selectors) {
      const el = document.querySelector(selector);
      if (el) {
        // Check the element itself
        if (el.scrollHeight > el.clientHeight) {
          log(`findScrollableTabContainer: Fallback found ${selector}, scrollHeight=${el.scrollHeight}, clientHeight=${el.clientHeight}`);
          return el.scrollbox || el;
        }
        // Check if it has a scrollbox child/property
        if (el.scrollbox && el.scrollbox.scrollHeight > el.scrollbox.clientHeight) {
          log(`findScrollableTabContainer: Fallback found ${selector}.scrollbox`);
          return el.scrollbox;
        }
      }
    }

    // Last resort: find ANY element with vertical scroll that contains tabs
    const allScrollable = document.querySelectorAll('*');
    for (const el of allScrollable) {
      if (el.scrollHeight > el.clientHeight + 100) { // At least 100px of overflow
        if (el.querySelector('tab') || el.closest('tab')) {
          log(`findScrollableTabContainer: Last resort found ${el.tagName}#${el.id}`);
          return el;
        }
      }
    }

    log('findScrollableTabContainer: Could not find scrollable container');
    // Debug: log the tab's ancestry
    let debug = currentTab;
    let ancestry = [];
    while (debug && ancestry.length < 15) {
      ancestry.push(`${debug.tagName}#${debug.id}(sh:${debug.scrollHeight},ch:${debug.clientHeight})`);
      debug = debug.parentElement;
    }
    log('Tab ancestry: ' + ancestry.join(' > '));

    return null;
  }

  // Scroll the current tab into view at a specific position
  // position: 'center', 'top', or 'bottom'
  function scrollTabIntoView(position) {
    const currentTab = gBrowser.selectedTab;
    if (!currentTab) {
      log('No current tab to scroll to');
      return;
    }

    const scrollContainer = findScrollableTabContainer();
    if (!scrollContainer) {
      log('Could not find scrollable tab container - trying scrollIntoView fallback');
      // Fallback: use native scrollIntoView
      try {
        const block = position === 'center' ? 'center' : (position === 'top' ? 'start' : 'end');
        currentTab.scrollIntoView({ behavior: 'smooth', block: block });
        log(`Used scrollIntoView fallback with block=${block}`);
      } catch (e) {
        log(`scrollIntoView fallback failed: ${e}`);
      }
      return;
    }

    // Get dimensions
    const containerRect = scrollContainer.getBoundingClientRect();
    const tabRect = currentTab.getBoundingClientRect();
    const currentScrollTop = scrollContainer.scrollTop;

    log(`scrollTabIntoView: container rect: top=${containerRect.top}, height=${containerRect.height}`);
    log(`scrollTabIntoView: tab rect: top=${tabRect.top}, height=${tabRect.height}`);
    log(`scrollTabIntoView: currentScrollTop=${currentScrollTop}, scrollHeight=${scrollContainer.scrollHeight}`);

    // Calculate tab position relative to scroll container's content
    // tabRect is relative to viewport, we need to adjust for container position and current scroll
    const tabTopInContainer = tabRect.top - containerRect.top + currentScrollTop;
    const tabBottomInContainer = tabTopInContainer + tabRect.height;
    const tabCenterInContainer = tabTopInContainer + tabRect.height / 2;

    const viewHeight = containerRect.height;
    const contentHeight = scrollContainer.scrollHeight;
    const maxScroll = Math.max(0, contentHeight - viewHeight);

    log(`scrollTabIntoView: viewHeight=${viewHeight}, contentHeight=${contentHeight}, maxScroll=${maxScroll}`);

    // Check if scrolling is even possible
    if (maxScroll <= 0) {
      log('Tab container is not scrollable (all tabs fit in view) - trying scrollIntoView fallback');
      // Try fallback anyway
      try {
        const block = position === 'center' ? 'center' : (position === 'top' ? 'start' : 'end');
        currentTab.scrollIntoView({ behavior: 'smooth', block: block });
        log(`Used scrollIntoView fallback with block=${block}`);
      } catch (e) {
        log(`scrollIntoView fallback failed: ${e}`);
      }
      return;
    }

    let targetScroll;
    const padding = 10; // Small padding from edges

    if (position === 'center') {
      // Center the tab in the viewport
      targetScroll = tabCenterInContainer - viewHeight / 2;
      log(`Centering tab: tabCenter=${tabCenterInContainer}, viewHeight=${viewHeight}, target=${targetScroll}`);
    } else if (position === 'top') {
      // Put tab at the top of viewport
      targetScroll = tabTopInContainer - padding;
      log(`Moving tab to top: tabTop=${tabTopInContainer}, target=${targetScroll}`);
    } else if (position === 'bottom') {
      // Put tab at the bottom of viewport
      targetScroll = tabBottomInContainer - viewHeight + padding;
      log(`Moving tab to bottom: tabBottom=${tabBottomInContainer}, viewHeight=${viewHeight}, target=${targetScroll}`);
    }

    // Clamp to valid scroll range
    targetScroll = Math.max(0, Math.min(maxScroll, targetScroll));

    // Only scroll if there's a meaningful change
    if (Math.abs(targetScroll - currentScrollTop) < 2) {
      log(`Already at ${position} position (or close enough)`);
      return;
    }

    // Smooth scroll
    scrollContainer.scrollTo({
      top: targetScroll,
      behavior: 'smooth'
    });

    log(`Scrolled to ${position}: ${currentScrollTop} -> ${targetScroll}`);
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
    log('  j/k + 1-9/a-f = jump N tabs down/up');
    log('  zz = center tab | zt = tab to top | zb = tab to bottom');
  }

  // Start initialization when DOM is ready
  if (document.readyState === 'complete') {
    init();
  } else {
    document.addEventListener('DOMContentLoaded', init);
  }

})();
