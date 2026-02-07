// ZenLeapAgentChild.sys.mjs — Content-process actor for DOM extraction and page content.
// Runs in the content process under Fission; communicates with parent via sendQuery/receiveMessage.

const MAX_TEXT_LENGTH = 200000;  // 200K chars for page text
const MAX_HTML_LENGTH = 500000;  // 500K chars for page HTML

const INTERACTIVE_TAGS = new Set([
  'a', 'button', 'input', 'select', 'textarea', 'details', 'summary',
]);

const INTERACTIVE_ROLES = new Set([
  'button', 'link', 'textbox', 'checkbox', 'radio', 'combobox',
  'menuitem', 'tab', 'switch', 'option',
]);

// Characters requiring Shift modifier (US keyboard layout)
const SHIFT_CHARS = new Set('~!@#$%^&*()_+{}|:"<>?');

// Shifted character → base key (US keyboard layout)
const SHIFT_MAP = {
  '~': '`', '!': '1', '@': '2', '#': '3', '$': '4', '%': '5',
  '^': '6', '&': '7', '*': '8', '(': '9', ')': '0',
  '_': '-', '+': '=', '{': '[', '}': ']', '|': '\\',
  ':': ';', '"': "'", '<': ',', '>': '.', '?': '/',
};

// nsITextInputProcessor flag: key is non-printable (Enter, Tab, Arrow, etc.)
const TIP_KEY_NON_PRINTABLE = 0x02;

export class ZenLeapAgentChild extends JSWindowActorChild {
  #elementMap = new Map(); // index → WeakRef(element)
  #consoleLogs = [];
  #consoleErrors = [];
  #captureSetup = false;
  #cursorOverlay = null;
  #tip = null; // nsITextInputProcessor instance (cached)

  receiveMessage(message) {
    const data = message.data || {};
    switch (message.name) {
      case 'ZenLeapAgent:ExtractDOM':
        return this.#extractDOM();
      case 'ZenLeapAgent:GetPageText':
        return this.#getPageText();
      case 'ZenLeapAgent:GetPageHTML':
        return this.#getPageHTML();
      case 'ZenLeapAgent:ClickElement':
        return this.#clickElement(data.index);
      case 'ZenLeapAgent:FillField':
        return this.#fillField(data.index, data.value);
      case 'ZenLeapAgent:SelectOption':
        return this.#selectOption(data.index, data.value);
      case 'ZenLeapAgent:TypeText':
        return this.#typeText(data.text);
      case 'ZenLeapAgent:PressKey':
        return this.#pressKey(data.key, data.modifiers || {});
      case 'ZenLeapAgent:Scroll':
        return this.#scroll(data.direction, data.amount);
      case 'ZenLeapAgent:Hover':
        return this.#hover(data.index);
      case 'ZenLeapAgent:ClickCoordinates':
        return this.#clickCoordinates(data.x, data.y);
      case 'ZenLeapAgent:SetupConsoleCapture':
        return this.#setupConsoleCapture();
      case 'ZenLeapAgent:GetConsoleLogs':
        return { logs: [...this.#consoleLogs] };
      case 'ZenLeapAgent:GetConsoleErrors':
        return { errors: [...this.#consoleErrors] };
      case 'ZenLeapAgent:EvalJS':
        return this.#evalInContent(data.expression);
      case 'ZenLeapAgent:QuerySelector':
        return this.#querySelector(data.selector);
      case 'ZenLeapAgent:SearchText':
        return this.#searchText(data.text);
      default:
        return { error: 'Unknown message: ' + message.name };
    }
  }

  // --- DOM Extraction ---

  #extractDOM() {
    const doc = this.contentWindow?.document;
    if (!doc?.body) {
      return {
        elements: [],
        url: doc?.location?.href || '',
        title: doc?.title || '',
      };
    }

    const elements = [];
    this.#elementMap.clear();
    let index = 0;
    const MAX_DEPTH = 50;

    const walk = (node, depth = 0) => {
      if (node.nodeType !== 1) return; // ELEMENT_NODE only
      if (depth > MAX_DEPTH) return; // Prevent stack overflow on deep/cyclic DOMs

      const tag = node.tagName.toLowerCase();
      const role = node.getAttribute('role');
      const isInteractive =
        INTERACTIVE_TAGS.has(tag) ||
        INTERACTIVE_ROLES.has(role) ||
        node.hasAttribute('onclick') ||
        (node.hasAttribute('tabindex') && node.getAttribute('tabindex') !== '-1') ||
        node.getAttribute('contenteditable') === 'true';

      // Mark iframes with their browsingContext ID for frame_id targeting
      if (tag === 'iframe' && this.#isVisible(node)) {
        const frameBC = node.browsingContext;
        if (frameBC) {
          elements.push({
            index: index,
            tag: 'iframe',
            text: node.getAttribute('title') || node.getAttribute('name') || '',
            attributes: {
              src: node.src || '',
              name: node.name || undefined,
              frame_id: frameBC.id,
            },
            rect: (() => {
              const r = node.getBoundingClientRect();
              return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
            })(),
          });
          this.#elementMap.set(index, new WeakRef(node));
          index++;
        }
      }

      if (isInteractive && this.#isVisible(node)) {
        const rect = node.getBoundingClientRect();
        const attrs = {};
        if (node.type) attrs.type = node.type;
        if (node.name) attrs.name = node.name;
        if (node.href) attrs.href = node.href;
        if (node.value) attrs.value = node.value.substring(0, 50);
        if (node.checked !== undefined) attrs.checked = node.checked;
        if (node.disabled) attrs.disabled = true;

        this.#elementMap.set(index, new WeakRef(node));
        elements.push({
          index: index++,
          tag,
          role: role || undefined,
          text: this.#getVisibleText(node).substring(0, 100),
          attributes: attrs,
          rect: {
            x: Math.round(rect.x),
            y: Math.round(rect.y),
            w: Math.round(rect.width),
            h: Math.round(rect.height),
          },
        });
      }

      // Enter shadow DOM (openOrClosedShadowRoot is Gecko-specific, handles closed roots)
      const shadow = node.openOrClosedShadowRoot || node.shadowRoot;
      if (shadow) {
        for (const child of shadow.children) walk(child, depth + 1);
      }

      for (const child of node.children) walk(child, depth + 1);
    };

    walk(doc.body);
    return {
      elements,
      url: doc.location?.href || '',
      title: doc.title || '',
    };
  }

  #isVisible(el) {
    const style = this.contentWindow.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
      return false;
    }
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  #getVisibleText(el) {
    return (
      el.getAttribute('aria-label') ||
      el.getAttribute('placeholder') ||
      el.getAttribute('alt') ||
      el.getAttribute('title') ||
      el.textContent?.trim() ||
      ''
    );
  }

  // --- Page Text ---

  #getPageText() {
    const doc = this.contentWindow?.document;
    if (!doc?.body) return { text: '' };
    let text = doc.body.innerText || '';
    if (text.length > MAX_TEXT_LENGTH) {
      text = text.substring(0, MAX_TEXT_LENGTH) + '\n[...truncated at 200K chars]';
    }
    return { text };
  }

  // --- Page HTML ---

  #getPageHTML() {
    const doc = this.contentWindow?.document;
    if (!doc?.documentElement) return { html: '' };
    let html = doc.documentElement.outerHTML || '';
    if (html.length > MAX_HTML_LENGTH) {
      html = html.substring(0, MAX_HTML_LENGTH) + '\n<!-- truncated at 500K chars -->';
    }
    return { html };
  }

  // --- Interaction ---

  #getElement(index) {
    const ref = this.#elementMap.get(index);
    if (!ref) throw new Error('Element index ' + index + ' not found — run get_dom first');
    const el = ref.deref();
    if (!el) throw new Error('Element index ' + index + ' was garbage collected — run get_dom again');
    if (!el.isConnected) throw new Error('Element index ' + index + ' is no longer in the DOM — run get_dom again');
    return el;
  }

  #clickElement(index) {
    const el = this.#getElement(index);
    el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' });
    const rect = el.getBoundingClientRect();
    const cx = rect.x + rect.width / 2;
    const cy = rect.y + rect.height / 2;
    this.#showCursor(cx, cy);
    // Use windowUtils.sendMouseEvent for native-level trusted mouse events
    const utils = this.contentWindow?.windowUtils;
    let method;
    if (utils?.sendMouseEvent) {
      method = 'windowUtils';
      utils.sendMouseEvent('mousedown', cx, cy, 0, 1, 0);
      utils.sendMouseEvent('mouseup', cx, cy, 0, 1, 0);
    } else {
      method = 'el.click';
      el.click();
    }
    // Always ensure focus — sendMouseEvent doesn't trigger focus change,
    // and el.click() doesn't always focus either
    el.focus();
    const doc = this.contentWindow?.document;
    return {
      success: true,
      tag: el.tagName.toLowerCase(),
      text: this.#getVisibleText(el).substring(0, 100),
      method,
      focused: doc?.activeElement === el,
    };
  }

  #fillField(index, value) {
    const el = this.#getElement(index);
    const tag = el.tagName.toLowerCase();
    if (tag !== 'input' && tag !== 'textarea' && el.getAttribute('contenteditable') !== 'true') {
      throw new Error('Element [' + index + '] is <' + tag + '>, not a fillable field');
    }
    el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' });
    el.focus();
    if (el.getAttribute('contenteditable') === 'true') {
      el.textContent = value;
    } else {
      // Use the correct prototype's setter based on element type.
      // HTMLInputElement.prototype.value and HTMLTextAreaElement.prototype.value
      // are DIFFERENT setters — using the wrong one throws.
      const nativeSetter = this.#getValueSetter(el);
      if (nativeSetter) {
        nativeSetter.call(el, value);
      } else {
        el.value = value;
      }
    }
    el.dispatchEvent(new this.contentWindow.Event('input', { bubbles: true }));
    el.dispatchEvent(new this.contentWindow.Event('change', { bubbles: true }));
    return { success: true, tag, value: value.substring(0, 50) };
  }

  #getValueSetter(el) {
    const win = this.contentWindow;
    const tag = el.tagName.toLowerCase();
    if (tag === 'textarea') {
      return Object.getOwnPropertyDescriptor(
        win.HTMLTextAreaElement.prototype, 'value'
      )?.set;
    }
    if (tag === 'input') {
      return Object.getOwnPropertyDescriptor(
        win.HTMLInputElement.prototype, 'value'
      )?.set;
    }
    return null;
  }

  #selectOption(index, value) {
    const el = this.#getElement(index);
    if (el.tagName.toLowerCase() !== 'select') {
      throw new Error('Element [' + index + '] is <' + el.tagName.toLowerCase() + '>, not a <select>');
    }
    el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' });
    el.focus();
    // Try matching by value first, then by visible text
    let found = false;
    for (const opt of el.options) {
      if (opt.value === value || opt.textContent.trim() === value) {
        el.value = opt.value;
        found = true;
        break;
      }
    }
    if (!found) {
      const available = Array.from(el.options).map(o => o.value + ' ("' + o.textContent.trim() + '")').join(', ');
      throw new Error('Option "' + value + '" not found. Available: ' + available);
    }
    el.dispatchEvent(new this.contentWindow.Event('change', { bubbles: true }));
    return { success: true, value: el.value };
  }

  // --- nsITextInputProcessor (TIP) ---
  // Produces trusted keyboard events (isTrusted:true) through Gecko's full
  // event pipeline. Unlike dispatchEvent, TIP events are indistinguishable
  // from real user keypresses — works for canvas-based apps (Google Sheets),
  // contenteditable, and standard form fields. Targets the specific content
  // window without stealing OS-level focus from other windows.

  #getTextInputProcessor() {
    const win = this.contentWindow;
    if (!win) throw new Error('No content window');
    if (!this.#tip) {
      this.#tip = Cc['@mozilla.org/text-input-processor;1']
        .createInstance(Ci.nsITextInputProcessor);
    }
    // Begin (or re-validate) transaction targeting this content window
    if (!this.#tip.beginInputTransactionForTests(win)) {
      // Stale — create fresh instance
      this.#tip = Cc['@mozilla.org/text-input-processor;1']
        .createInstance(Ci.nsITextInputProcessor);
      if (!this.#tip.beginInputTransactionForTests(win)) {
        throw new Error('Cannot begin text input transaction');
      }
    }
    return this.#tip;
  }

  #charToCode(char) {
    const c = char.toLowerCase();
    if (c >= 'a' && c <= 'z') return 'Key' + c.toUpperCase();
    if (c >= '0' && c <= '9') return 'Digit' + c;
    const map = {
      ' ': 'Space', '-': 'Minus', '=': 'Equal',
      '[': 'BracketLeft', ']': 'BracketRight',
      '\\': 'Backslash', ';': 'Semicolon', "'": 'Quote',
      ',': 'Comma', '.': 'Period', '/': 'Slash', '`': 'Backquote',
    };
    return map[c] || '';
  }

  // Compute DOM keyCode for a character. Apps like Google Sheets check keyCode
  // (not just key/code) to handle character input on their canvas.
  #charToKeyCode(char) {
    // Shifted symbols → use base key's keyCode
    const base = SHIFT_MAP[char];
    if (base) return this.#charToKeyCode(base);
    const c = char.toUpperCase();
    if (c >= 'A' && c <= 'Z') return c.charCodeAt(0);     // 65-90
    if (char >= '0' && char <= '9') return char.charCodeAt(0); // 48-57
    if (char === ' ') return 32;
    const punctMap = {
      ';': 186, '=': 187, ',': 188, '-': 189, '.': 190, '/': 191,
      '`': 192, '[': 219, '\\': 220, ']': 221, "'": 222,
    };
    return punctMap[char] || 0;
  }

  #typeText(text) {
    let tip;
    try {
      tip = this.#getTextInputProcessor();
    } catch (e) {
      // TIP unavailable — fall back to value-setter approach
      const result = this.#typeTextFallback(text, this.contentWindow);
      result.method = 'fallback';
      return result;
    }

    const KE = this.contentWindow.KeyboardEvent;
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      try {
        // Control characters → special key presses
        if (char === '\t') {
          const e = new KE('', { key: 'Tab', code: 'Tab' });
          tip.keydown(e, TIP_KEY_NON_PRINTABLE);
          tip.keyup(e, TIP_KEY_NON_PRINTABLE);
          continue;
        }
        if (char === '\n' || char === '\r') {
          const e = new KE('', { key: 'Enter', code: 'Enter' });
          tip.keydown(e, TIP_KEY_NON_PRINTABLE);
          tip.keyup(e, TIP_KEY_NON_PRINTABLE);
          continue;
        }

        // Determine if Shift is needed
        const isUpper = char >= 'A' && char <= 'Z';
        const isShiftSym = SHIFT_CHARS.has(char);
        const needsShift = isUpper || isShiftSym;

        // Physical key code and DOM keyCode (based on base character)
        const code = isShiftSym
          ? this.#charToCode(SHIFT_MAP[char])
          : this.#charToCode(char);
        const keyCode = this.#charToKeyCode(char);

        if (needsShift) {
          tip.keydown(new KE('', { key: 'Shift', code: 'ShiftLeft', keyCode: 16 }));
        }

        const event = new KE('', { key: char, code, keyCode });
        tip.keydown(event);
        tip.keyup(event);

        if (needsShift) {
          tip.keyup(new KE('', { key: 'Shift', code: 'ShiftLeft' }));
        }
      } catch (e) {
        // TIP may fail if page navigated (Tab/Enter can cause this)
        return { success: true, typed: i, total: text.length, method: 'textInputProcessor' };
      }
    }

    return { success: true, length: text.length, method: 'textInputProcessor' };
  }

  #typeTextFallback(text, win) {
    const doc = win.document;
    const target = doc?.activeElement || doc?.body;
    if (!target) throw new Error('No active element to type into');

    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
      const nativeSetter = this.#getValueSetter(target);
      const current = target.value || '';
      if (nativeSetter) {
        nativeSetter.call(target, current + text);
      } else {
        target.value = current + text;
      }
      target.dispatchEvent(new win.Event('input', { bubbles: true }));
      target.dispatchEvent(new win.Event('change', { bubbles: true }));
    } else if (target.getAttribute('contenteditable') === 'true') {
      target.textContent = (target.textContent || '') + text;
      target.dispatchEvent(new win.Event('input', { bubbles: true }));
    }
    return { success: true, length: text.length };
  }

  #pressKey(key, modifiers) {
    const win = this.contentWindow;
    if (!win) throw new Error('No content window for key press');

    // Normalize key name
    if (key === 'Space') key = ' ';

    // Keys that can destroy the actor (navigation, focus loss)
    const destructive = new Set(['Tab', 'Escape', 'Enter']);
    const shouldDefer = destructive.has(key);

    const execute = () => {
      let tip;
      try {
        tip = this.#getTextInputProcessor();
      } catch (e) {
        this.#pressKeyFallback(key, modifiers, win);
        return;
      }

      const KE = win.KeyboardEvent;
      const mods = [];

      // Activate modifier keys
      if (modifiers.shift) {
        const e = new KE('', { key: 'Shift', code: 'ShiftLeft' });
        tip.keydown(e); mods.push(e);
      }
      if (modifiers.ctrl) {
        const e = new KE('', { key: 'Control', code: 'ControlLeft' });
        tip.keydown(e); mods.push(e);
      }
      if (modifiers.alt) {
        const e = new KE('', { key: 'Alt', code: 'AltLeft' });
        tip.keydown(e); mods.push(e);
      }
      if (modifiers.meta) {
        const e = new KE('', { key: 'Meta', code: 'MetaLeft' });
        tip.keydown(e); mods.push(e);
      }

      // Determine code, keyCode, and flags
      const isNonPrintable = key.length > 1;
      const code = isNonPrintable ? key : this.#charToCode(key);
      const flags = isNonPrintable ? TIP_KEY_NON_PRINTABLE : 0;
      const keyCode = isNonPrintable ? 0 : this.#charToKeyCode(key);

      const event = new KE('', { key, code, keyCode });
      tip.keydown(event, flags);
      tip.keyup(event, flags);

      // Deactivate modifiers in reverse order
      for (const mod of mods.reverse()) {
        tip.keyup(mod);
      }
    };

    if (shouldDefer) {
      win.setTimeout(() => {
        try { execute(); } catch (e) { /* actor may be destroyed */ }
      }, 0);
    } else {
      execute();
    }

    return { success: true, key, method: 'textInputProcessor' };
  }

  #pressKeyFallback(key, modifiers, win) {
    const doc = win.document;
    const target = doc?.activeElement || doc?.body;
    if (!target) return;
    const opts = {
      key,
      bubbles: true,
      ctrlKey: !!modifiers.ctrl,
      shiftKey: !!modifiers.shift,
      altKey: !!modifiers.alt,
      metaKey: !!modifiers.meta,
    };
    target.dispatchEvent(new win.KeyboardEvent('keydown', opts));
    target.dispatchEvent(new win.KeyboardEvent('keyup', opts));
  }

  #scroll(direction, amount) {
    const win = this.contentWindow;
    if (!win) throw new Error('No content window');
    const px = amount || 500;
    switch (direction) {
      case 'up':    win.scrollBy(0, -px); break;
      case 'down':  win.scrollBy(0, px); break;
      case 'left':  win.scrollBy(-px, 0); break;
      case 'right': win.scrollBy(px, 0); break;
      default: throw new Error('Invalid direction: ' + direction + ' (use up/down/left/right)');
    }
    return {
      success: true,
      scrollX: Math.round(win.scrollX),
      scrollY: Math.round(win.scrollY),
    };
  }

  #hover(index) {
    const el = this.#getElement(index);
    el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' });
    const rect = el.getBoundingClientRect();
    const cx = rect.x + rect.width / 2;
    const cy = rect.y + rect.height / 2;
    // Use windowUtils for native-level mouse events
    const utils = this.contentWindow?.windowUtils;
    if (utils?.sendMouseEvent) {
      utils.sendMouseEvent('mousemove', cx, cy, 0, 0, 0);
    } else {
      const opts = { bubbles: true, clientX: cx, clientY: cy };
      el.dispatchEvent(new this.contentWindow.MouseEvent('mouseenter', opts));
      el.dispatchEvent(new this.contentWindow.MouseEvent('mouseover', opts));
      el.dispatchEvent(new this.contentWindow.MouseEvent('mousemove', opts));
    }
    return { success: true, tag: el.tagName.toLowerCase(), text: this.#getVisibleText(el).substring(0, 100) };
  }

  #clickCoordinates(x, y) {
    const win = this.contentWindow;
    const doc = win?.document;
    if (!doc) throw new Error('No document');
    this.#showCursor(x, y);
    const el = doc.elementFromPoint(x, y);
    // Use windowUtils for native-level trusted mouse events
    const utils = win.windowUtils;
    if (utils?.sendMouseEvent) {
      utils.sendMouseEvent('mousedown', x, y, 0, 1, 0);
      utils.sendMouseEvent('mouseup', x, y, 0, 1, 0);
      // sendMouseEvent doesn't trigger focus change — ensure focus explicitly
      if (el) el.focus();
    } else {
      if (!el) throw new Error('No element at coordinates (' + x + ', ' + y + ')');
      const opts = { bubbles: true, clientX: x, clientY: y };
      el.dispatchEvent(new win.MouseEvent('mousedown', opts));
      el.dispatchEvent(new win.MouseEvent('mouseup', opts));
      el.dispatchEvent(new win.MouseEvent('click', opts));
    }
    return {
      success: true,
      tag: el?.tagName?.toLowerCase() || 'unknown',
      text: el ? this.#getVisibleText(el).substring(0, 100) : '',
    };
  }

  // --- Console Capture ---

  #formatArg(value) {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    if (value instanceof this.contentWindow.Error) {
      return value.message + (value.stack ? '\n' + value.stack : '');
    }
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }

  #setupConsoleCapture() {
    if (this.#captureSetup) return { success: true, note: 'already setup' };
    const win = this.contentWindow;
    if (!win) throw new Error('No content window');

    const self = this;
    // Access unwrapped console to get originals and set content-visible wrappers.
    // Xray wrappers prevent chrome-scope assignments from being visible to content
    // code, so we must use wrappedJSObject + Cu.exportFunction.
    const unwrapped = win.console.wrappedJSObject;
    const origLog = unwrapped.log.bind(unwrapped);
    const origWarn = unwrapped.warn.bind(unwrapped);
    const origError = unwrapped.error.bind(unwrapped);
    const origInfo = unwrapped.info.bind(unwrapped);

    const makeWrapper = (level, origFn, isError) => {
      return Cu.exportFunction(function(...args) {
        const message = Array.from(args).map(a => self.#formatArg(a)).join(' ');
        self.#consoleLogs.push({ level, message, timestamp: new Date().toISOString() });
        if (self.#consoleLogs.length > 500) self.#consoleLogs.shift();
        if (isError) {
          self.#consoleErrors.push({ type: 'console.error', message, timestamp: new Date().toISOString() });
          if (self.#consoleErrors.length > 100) self.#consoleErrors.shift();
        }
        origFn(...args);
      }, win);
    };

    unwrapped.log = makeWrapper('log', origLog, false);
    unwrapped.warn = makeWrapper('warn', origWarn, false);
    unwrapped.error = makeWrapper('error', origError, true);
    unwrapped.info = makeWrapper('info', origInfo, false);

    // Capture uncaught errors
    win.addEventListener('error', (event) => {
      self.#consoleErrors.push({
        type: 'uncaught_error',
        message: event.message || '',
        filename: event.filename || '',
        lineno: event.lineno || 0,
        colno: event.colno || 0,
        stack: event.error?.stack || '',
        timestamp: new Date().toISOString(),
      });
      if (self.#consoleErrors.length > 100) self.#consoleErrors.shift();
    });

    // Capture unhandled promise rejections
    win.addEventListener('unhandledrejection', (event) => {
      const reason = event.reason;
      self.#consoleErrors.push({
        type: 'unhandled_rejection',
        message: reason?.message || String(reason),
        stack: reason?.stack || '',
        timestamp: new Date().toISOString(),
      });
      if (self.#consoleErrors.length > 100) self.#consoleErrors.shift();
    });

    this.#captureSetup = true;
    return { success: true };
  }

  // --- Virtual Cursor ---

  #showCursor(x, y) {
    const doc = this.contentWindow?.document;
    if (!doc) return;
    // Validate inputs are finite numbers
    const numX = Number(x);
    const numY = Number(y);
    if (!Number.isFinite(numX) || !Number.isFinite(numY)) return;
    // Remove previous cursor
    this.#removeCursor();
    // Create cursor overlay: red crosshair with ring
    const cursor = doc.createElement('div');
    cursor.id = '__zenleap_cursor';
    // Use individual style properties (not cssText concatenation) to prevent CSS injection
    cursor.style.position = 'fixed';
    cursor.style.zIndex = '2147483647';
    cursor.style.pointerEvents = 'none';
    cursor.style.left = (numX - 12) + 'px';
    cursor.style.top = (numY - 12) + 'px';
    cursor.style.width = '24px';
    cursor.style.height = '24px';
    cursor.style.border = '3px solid red';
    cursor.style.borderRadius = '50%';
    cursor.style.background = 'rgba(255,0,0,0.2)';
    cursor.style.boxShadow = '0 0 8px rgba(255,0,0,0.6)';
    // Crosshair lines
    const hLine = doc.createElement('div');
    hLine.style.cssText = 'position:absolute;top:50%;left:-4px;right:-4px;height:1px;background:red;transform:translateY(-50%)';
    const vLine = doc.createElement('div');
    vLine.style.cssText = 'position:absolute;left:50%;top:-4px;bottom:-4px;width:1px;background:red;transform:translateX(-50%)';
    cursor.appendChild(hLine);
    cursor.appendChild(vLine);
    doc.documentElement.appendChild(cursor);
    this.#cursorOverlay = cursor;
    // Auto-remove after 60 seconds (or when cursor moves)
    this.contentWindow.setTimeout(() => this.#removeCursor(), 60000);
  }

  #removeCursor() {
    if (this.#cursorOverlay && this.#cursorOverlay.parentNode) {
      this.#cursorOverlay.parentNode.removeChild(this.#cursorOverlay);
    }
    this.#cursorOverlay = null;
  }

  // --- Element/Text Query ---

  #querySelector(selector) {
    const doc = this.contentWindow?.document;
    if (!doc) return { found: false };
    const el = doc.querySelector(selector);
    if (!el) return { found: false };
    return {
      found: true,
      tag: el.tagName.toLowerCase(),
      text: this.#getVisibleText(el).substring(0, 100),
    };
  }

  #searchText(text) {
    const doc = this.contentWindow?.document;
    if (!doc?.body) return { found: false };
    const bodyText = doc.body.innerText || '';
    return { found: bodyText.includes(text) };
  }

  // --- JS Evaluation ---

  #evalInContent(expression) {
    const win = this.contentWindow;
    if (!win) throw new Error('No content window');
    try {
      const result = win.eval(expression);
      return { result: this.#formatArg(result) };
    } catch (e) {
      return { error: e.message, stack: e.stack || '' };
    }
  }
}
