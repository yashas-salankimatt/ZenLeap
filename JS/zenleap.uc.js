// ==UserScript==
// @name           ZenLeap - Relative Tab Navigation
// @description    Vim-style relative tab numbering with keyboard navigation
// @include        main
// @author         ZenLeap
// @version        2.1.0
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

    tabs.forEach((tab, index) => {
      const relativeDistance = Math.abs(index - currentIndex);
      const direction = index < currentIndex ? 'up' : (index > currentIndex ? 'down' : 'current');
      const displayChar = numberToDisplay(relativeDistance);

      tab.setAttribute('data-zenleap-direction', direction);
      tab.setAttribute('data-zenleap-distance', relativeDistance);

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

  // Check if sidebar is currently hidden (compact mode active)
  function isSidebarHidden() {
    // Check if compact mode is hiding the sidebar
    // Method 1: Check for compact mode attribute on root
    const isCompactMode = document.documentElement.hasAttribute('zen-compact-mode') ||
                          document.documentElement.hasAttribute('compact-mode');

    // Method 2: Check the preference directly
    try {
      const compactModeEnabled = Services.prefs.getBoolPref('zen.view.compact', false);
      const hideSidebar = Services.prefs.getBoolPref('zen.view.compact.hide-tabbar', true);
      if (compactModeEnabled && hideSidebar) {
        return true;
      }
    } catch (e) {
      // Prefs might not exist
    }

    // Method 3: Check actual visibility of sidebar
    const sidebar = document.getElementById('navigator-toolbox') ||
                    document.getElementById('TabsToolbar') ||
                    document.querySelector('#zen-sidebar-box-container');

    if (sidebar) {
      const style = window.getComputedStyle(sidebar);
      if (style.display === 'none' || style.visibility === 'hidden' ||
          style.opacity === '0' || parseInt(style.width) === 0) {
        return true;
      }
    }

    return isCompactMode;
  }

  // Show the floating sidebar (for compact mode)
  function showFloatingSidebar() {
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

    // Method 3: Set the sidebar expanded preference temporarily
    try {
      Services.prefs.setBoolPref('zen.view.sidebar-expanded.on-hover', true);
      log('Set zen.view.sidebar-expanded.on-hover to true');
      return true;
    } catch (e) {
      log(`Setting sidebar-expanded pref failed: ${e}`);
    }

    // Method 4: Dispatch a synthetic mouse event to trigger hover behavior
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

    if (browseMode) {
      // Browse mode
      leapOverlay.classList.add('leap-direction-set');
      overlayModeLabel.textContent = 'BROWSE';
      const tabs = getVisibleTabs();
      const pos = `${highlightedTabIndex + 1}/${tabs.length}`;
      overlayDirectionLabel.textContent = pos;
      overlayHintLabel.textContent = 'j/k=move  Enter=open  x=close  Esc=cancel';
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
      overlayHintLabel.textContent = 'j/k=browse  g=goto  z=scroll';
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

    // Show sidebar if in compact mode
    if (isSidebarHidden()) {
      sidebarWasExpanded = showFloatingSidebar();
      log(`Expanded sidebar on leap mode entry: ${sidebarWasExpanded}`);
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
    gNumberBuffer = '';
    clearTimeout(gNumberTimeout);
    highlightedTabIndex = -1;
    originalTabIndex = -1;
    browseDirection = null;

    clearTimeout(leapModeTimeout);
    document.documentElement.removeAttribute('data-zenleap-active');
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

      if (key === 'j') {
        moveHighlight('down');
        return;
      }
      if (key === 'k') {
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

    // === INITIAL LEAP MODE (waiting for j/k/g/z or direct jump) ===
    event.preventDefault();
    event.stopPropagation();

    if (key === 'j') {
      enterBrowseMode('down');
      return;
    }
    if (key === 'k') {
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

    // Any other key in initial leap mode - ignore (don't exit, just wait for valid command)
    log(`Unrecognized key in leap mode: ${key}`);
  }

  // Set up event listeners for tab changes
  function setupTabListeners() {
    gBrowser.tabContainer.addEventListener('TabSelect', () => {
      updateRelativeNumbers();
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

        tab:not([zen-glance-tab="true"]) > .tab-stack > .tab-content[data-zenleap-rel]:hover::after {
          opacity: 0;
          width: 0;
          margin: 0;
        }

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

        /* Highlighted tab badge */
        tab[data-zenleap-highlight="true"]:not([zen-glance-tab="true"]) > .tab-stack > .tab-content[data-zenleap-rel]::after {
          background-color: #61afef !important;
          color: #1e1e1e !important;
          box-shadow: 0 0 8px rgba(97, 175, 239, 0.6);
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
    log('Initializing ZenLeap v2.0...');

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
    log('Press Ctrl+Space to enter leap mode (auto-expands sidebar in compact mode)');
    log('  j/k = browse mode (j/k=move, Enter=open, x=close, Esc=cancel)');
    log('  gg = first tab | G = last tab | g{num} = go to tab #');
    log('  z + z/t/b = scroll center/top/bottom');
  }

  // Start initialization
  if (document.readyState === 'complete') {
    init();
  } else {
    document.addEventListener('DOMContentLoaded', init);
  }

})();
