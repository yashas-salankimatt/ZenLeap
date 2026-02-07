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

export class ZenLeapAgentChild extends JSWindowActorChild {
  #elementMap = new Map(); // index → WeakRef(element)
  #consoleLogs = [];
  #consoleErrors = [];
  #captureSetup = false;
  #cursorOverlay = null;

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
    el.click();
    return { success: true, tag: el.tagName.toLowerCase(), text: this.#getVisibleText(el).substring(0, 100) };
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

  #typeText(text) {
    const win = this.contentWindow;
    const doc = win?.document;
    const target = doc?.activeElement || doc?.body;
    if (!target) throw new Error('No active element to type into');
    // Append characters to input/textarea value and dispatch input events.
    // Avoids KeyboardEvent which runs trusted from JSWindowActor and can crash tabs.
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
    const doc = win?.document;
    const target = doc?.activeElement || doc?.body;
    if (!target) throw new Error('No active element for key press');
    // Defer key event dispatch: KeyboardEvent from a JSWindowActor child is
    // trusted, so special keys (Escape, Tab, Enter) trigger browser-level
    // handlers that can crash/navigate the tab. Dispatching after a setTimeout
    // lets the sendQuery response return before side effects occur.
    const opts = {
      key,
      bubbles: true,
      ctrlKey: !!modifiers.ctrl,
      shiftKey: !!modifiers.shift,
      altKey: !!modifiers.alt,
      metaKey: !!modifiers.meta,
    };
    win.setTimeout(() => {
      try {
        target.dispatchEvent(new win.KeyboardEvent('keydown', opts));
        target.dispatchEvent(new win.KeyboardEvent('keyup', opts));
      } catch (e) {
        // Tab may have been destroyed by the key event — expected for Escape/Tab/etc.
      }
    }, 0);
    return { success: true, key };
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
    const opts = { bubbles: true, clientX: cx, clientY: cy };
    el.dispatchEvent(new this.contentWindow.MouseEvent('mouseenter', opts));
    el.dispatchEvent(new this.contentWindow.MouseEvent('mouseover', opts));
    el.dispatchEvent(new this.contentWindow.MouseEvent('mousemove', opts));
    return { success: true, tag: el.tagName.toLowerCase(), text: this.#getVisibleText(el).substring(0, 100) };
  }

  #clickCoordinates(x, y) {
    const doc = this.contentWindow?.document;
    if (!doc) throw new Error('No document');
    this.#showCursor(x, y);
    const el = doc.elementFromPoint(x, y);
    if (!el) throw new Error('No element at coordinates (' + x + ', ' + y + ')');
    const opts = { bubbles: true, clientX: x, clientY: y };
    el.dispatchEvent(new this.contentWindow.MouseEvent('mousedown', opts));
    el.dispatchEvent(new this.contentWindow.MouseEvent('mouseup', opts));
    el.dispatchEvent(new this.contentWindow.MouseEvent('click', opts));
    return { success: true, tag: el.tagName.toLowerCase(), text: this.#getVisibleText(el).substring(0, 100) };
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
    // Auto-remove after 5 seconds
    this.contentWindow.setTimeout(() => this.#removeCursor(), 5000);
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
