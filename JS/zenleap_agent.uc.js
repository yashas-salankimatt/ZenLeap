// ==UserScript==
// @name           ZenLeap Agent - Browser Automation for Claude Code
// @description    WebSocket server exposing browser control via MCP for AI agents
// @include        main
// @author         ZenLeap
// @version        0.4.0
// ==/UserScript==

(function() {
  'use strict';

  const VERSION = '0.4.0';
  const AGENT_PORT = 9876;
  const WS_MAGIC = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
  const AGENT_WORKSPACE_NAME = 'ZenLeap AI';

  const logBuffer = [];
  const MAX_LOG_LINES = 200;

  function log(msg) {
    const line = new Date().toISOString() + ' ' + msg;
    console.log('[ZenLeap Agent] ' + msg);
    logBuffer.push(line);
    if (logBuffer.length > MAX_LOG_LINES) logBuffer.shift();
  }

  // ============================================
  // WEBSOCKET SERVER (XPCOM nsIServerSocket)
  // ============================================

  // Use a browser-global to prevent multiple instances across windows.
  // fx-autoconfig loads .uc.js per-window; we only want one server.
  const GLOBAL_KEY = '__zenleapAgentServer';

  let serverSocket = null;
  let activeConnection = null;

  function startServer() {
    // Check if another window already started the server
    if (Services.appinfo && globalThis[GLOBAL_KEY]) {
      log('Server already running in another window — skipping');
      return;
    }

    // Clean up any stale server from a previous load
    stopServer();

    try {
      serverSocket = Cc['@mozilla.org/network/server-socket;1']
        .createInstance(Ci.nsIServerSocket);
      serverSocket.init(AGENT_PORT, true, -1); // loopback only
      serverSocket.asyncListen({
        onSocketAccepted(server, transport) {
          log('New connection from ' + transport.host + ':' + transport.port);
          if (activeConnection) {
            log('Closing previous connection');
            activeConnection.close();
          }
          activeConnection = new WebSocketConnection(transport);
        },
        onStopListening(server, status) {
          log('Server stopped: ' + status);
        }
      });
      globalThis[GLOBAL_KEY] = true;
      log('WebSocket server listening on localhost:' + AGENT_PORT);
    } catch (e) {
      log('Failed to start server: ' + e);
      if (String(e).includes('NS_ERROR_SOCKET_ADDRESS_IN_USE')) {
        log('Port ' + AGENT_PORT + ' in use. Another instance may be running.');
        // Don't retry aggressively — the port will free when the other process exits
      } else {
        log('Will retry in 5s...');
        setTimeout(startServer, 5000);
      }
    }
  }

  function stopServer() {
    if (activeConnection) {
      try { activeConnection.close(); } catch (e) {}
      activeConnection = null;
    }
    if (serverSocket) {
      try { serverSocket.close(); } catch (e) {}
      serverSocket = null;
    }
    globalThis[GLOBAL_KEY] = false;
  }

  // ============================================
  // WEBSOCKET CONNECTION
  // ============================================

  class WebSocketConnection {
    #transport;
    #inputStream;
    #outputStream;
    #bos; // BinaryOutputStream
    #handshakeComplete = false;
    #handshakeBuffer = '';
    #frameBuffer = new Uint8Array(0);
    #closed = false;
    #pump;

    constructor(transport) {
      this.#transport = transport;
      this.#inputStream = transport.openInputStream(0, 0, 0);
      // OPEN_UNBUFFERED (2) prevents output buffering so writes go directly to socket
      this.#outputStream = transport.openOutputStream(2, 0, 0);
      this.#bos = Cc['@mozilla.org/binaryoutputstream;1']
        .createInstance(Ci.nsIBinaryOutputStream);
      this.#bos.setOutputStream(this.#outputStream);

      this.#pump = Cc['@mozilla.org/network/input-stream-pump;1']
        .createInstance(Ci.nsIInputStreamPump);
      this.#pump.init(this.#inputStream, 0, 0, false);
      this.#pump.asyncRead(this);
    }

    // --- nsIStreamListener ---

    onStartRequest(request) {}

    onStopRequest(request, status) {
      log('Connection closed (pump stopped, status: ' + status + ')');
      this.#closed = true;
      if (activeConnection === this) activeConnection = null;
    }

    onDataAvailable(request, stream, offset, count) {
      try {
        // IMPORTANT: Use nsIBinaryInputStream, NOT nsIScriptableInputStream.
        // nsIScriptableInputStream.read() truncates at 0x00 bytes, losing data.
        const bis = Cc['@mozilla.org/binaryinputstream;1']
          .createInstance(Ci.nsIBinaryInputStream);
        bis.setInputStream(stream);
        const byteArray = bis.readByteArray(count);
        log('onDataAvailable: ' + byteArray.length + ' bytes');

        if (!this.#handshakeComplete) {
          // Handshake is ASCII, safe to convert to string
          const data = String.fromCharCode.apply(null, byteArray);
          this.#handleHandshake(data);
        } else {
          this.#handleWebSocketData(new Uint8Array(byteArray));
        }
      } catch (e) {
        log('Error in onDataAvailable: ' + e + '\n' + e.stack);
      }
    }

    // --- WebSocket Handshake (RFC 6455) ---

    #handleHandshake(data) {
      this.#handshakeBuffer += data;
      const endOfHeaders = this.#handshakeBuffer.indexOf('\r\n\r\n');
      if (endOfHeaders === -1) return; // incomplete headers

      const request = this.#handshakeBuffer.substring(0, endOfHeaders);
      const remaining = this.#handshakeBuffer.substring(endOfHeaders + 4);
      this.#handshakeBuffer = '';

      // Extract Sec-WebSocket-Key
      const keyMatch = request.match(/Sec-WebSocket-Key:\s*(.+)/i);
      if (!keyMatch) {
        log('Invalid WebSocket handshake — no Sec-WebSocket-Key');
        this.close();
        return;
      }

      const key = keyMatch[1].trim();
      const acceptKey = this.#computeAcceptKey(key + WS_MAGIC);

      const response =
        'HTTP/1.1 101 Switching Protocols\r\n' +
        'Upgrade: websocket\r\n' +
        'Connection: Upgrade\r\n' +
        'Sec-WebSocket-Accept: ' + acceptKey + '\r\n\r\n';

      this.#writeRaw(response);
      this.#handshakeComplete = true;
      log('WebSocket handshake complete');

      // Process any remaining data as WebSocket frames (convert to Uint8Array)
      if (remaining.length > 0) {
        const remainingBytes = new Uint8Array(remaining.length);
        for (let i = 0; i < remaining.length; i++) {
          remainingBytes[i] = remaining.charCodeAt(i);
        }
        this.#handleWebSocketData(remainingBytes);
      }
    }

    #computeAcceptKey(str) {
      const hash = Cc['@mozilla.org/security/hash;1']
        .createInstance(Ci.nsICryptoHash);
      hash.init(Ci.nsICryptoHash.SHA1);
      const data = Array.from(str, c => c.charCodeAt(0));
      hash.update(data, data.length);
      return hash.finish(true); // base64 encoded
    }

    // --- WebSocket Frame Parsing ---

    #handleWebSocketData(newBytes) {
      // newBytes is a Uint8Array (binary-safe from nsIBinaryInputStream)
      const combined = new Uint8Array(this.#frameBuffer.length + newBytes.length);
      combined.set(this.#frameBuffer);
      combined.set(newBytes, this.#frameBuffer.length);
      this.#frameBuffer = combined;

      // Parse all complete frames
      while (this.#frameBuffer.length >= 2) {
        const frame = this.#parseFrame(this.#frameBuffer);
        if (!frame) break; // incomplete

        this.#frameBuffer = this.#frameBuffer.slice(frame.totalLength);

        if (frame.opcode === 0x1) {
          // Text frame
          this.#onMessage(frame.payload);
        } else if (frame.opcode === 0x8) {
          // Close frame
          this.#sendCloseFrame();
          this.close();
          return;
        } else if (frame.opcode === 0x9) {
          // Ping — respond with pong
          this.#sendFrame(frame.payload, 0xA);
        }
        // Ignore pong (0xA) and other opcodes
      }
    }

    #parseFrame(buf) {
      if (buf.length < 2) return null;

      const byte0 = buf[0];
      const byte1 = buf[1];
      const opcode = byte0 & 0x0F;
      const masked = (byte1 & 0x80) !== 0;
      let payloadLength = byte1 & 0x7F;
      let offset = 2;

      if (payloadLength === 126) {
        if (buf.length < 4) return null;
        payloadLength = (buf[2] << 8) | buf[3];
        offset = 4;
      } else if (payloadLength === 127) {
        if (buf.length < 10) return null;
        payloadLength = 0;
        for (let i = 0; i < 8; i++) {
          payloadLength = payloadLength * 256 + buf[2 + i];
        }
        offset = 10;
      }

      let maskKey = null;
      if (masked) {
        if (buf.length < offset + 4) return null;
        maskKey = buf.slice(offset, offset + 4);
        offset += 4;
      }

      if (buf.length < offset + payloadLength) return null;

      let payload = buf.slice(offset, offset + payloadLength);
      if (masked && maskKey) {
        payload = new Uint8Array(payload);
        for (let i = 0; i < payload.length; i++) {
          payload[i] ^= maskKey[i % 4];
        }
      }

      const text = new TextDecoder().decode(payload);
      return { opcode, payload: text, totalLength: offset + payloadLength };
    }

    // --- WebSocket Frame Sending ---

    #sendFrame(data, opcode = 0x1) {
      if (this.#closed) return;
      try {
        const payload = new TextEncoder().encode(data);
        const header = [];

        // FIN + opcode
        header.push(0x80 | opcode);

        // Length (server-to-client is NOT masked)
        if (payload.length < 126) {
          header.push(payload.length);
        } else if (payload.length < 65536) {
          header.push(126, (payload.length >> 8) & 0xFF, payload.length & 0xFF);
        } else {
          header.push(127);
          // Upper 4 bytes always 0 (payloads < 4GB).
          // Cannot use >> for shifts >= 32; JS bitwise ops are 32-bit.
          header.push(0, 0, 0, 0);
          header.push(
            (payload.length >> 24) & 0xFF,
            (payload.length >> 16) & 0xFF,
            (payload.length >> 8) & 0xFF,
            payload.length & 0xFF
          );
        }

        const frame = new Uint8Array(header.length + payload.length);
        frame.set(new Uint8Array(header));
        frame.set(payload, header.length);

        this.#writeBinary(frame);
      } catch (e) {
        log('Error sending frame: ' + e);
      }
    }

    #sendCloseFrame() {
      this.#sendFrame('', 0x8);
    }

    send(text) {
      this.#sendFrame(text);
    }

    // --- Raw I/O ---

    #writeRaw(str) {
      if (this.#closed) return;
      try {
        this.#bos.writeBytes(str, str.length);
      } catch (e) {
        log('Error writing raw: ' + e);
        this.close();
      }
    }

    #writeBinary(uint8arr) {
      if (this.#closed) return;
      try {
        // Chunk to avoid stack overflow in String.fromCharCode.apply for large payloads (>64KB)
        const CHUNK = 8192;
        let written = 0;
        while (written < uint8arr.length) {
          const end = Math.min(written + CHUNK, uint8arr.length);
          const slice = uint8arr.subarray(written, end);
          const str = String.fromCharCode.apply(null, slice);
          this.#bos.writeBytes(str, str.length);
          written = end;
        }
        log('writeBinary: ' + uint8arr.length + ' bytes');
      } catch (e) {
        log('Error writing binary: ' + e + '\n' + e.stack);
        this.close();
      }
    }

    close() {
      this.#closed = true;
      try { this.#inputStream.close(); } catch (e) {}
      try { this.#outputStream.close(); } catch (e) {}
      try { this.#transport.close(0); } catch (e) {}
      if (activeConnection === this) activeConnection = null;
    }

    // --- Message Handling ---

    #onMessage(text) {
      let msg;
      try {
        msg = JSON.parse(text);
      } catch (e) {
        log('Invalid JSON: ' + text.substring(0, 100));
        this.send(JSON.stringify({
          id: null,
          error: { code: -32700, message: 'Parse error' }
        }));
        return;
      }

      // Handle JSON-RPC
      this.#handleCommand(msg).then(response => {
        this.send(JSON.stringify(response));
      }).catch(e => {
        log('Unhandled error in command handler: ' + e);
        this.send(JSON.stringify({
          id: msg.id || null,
          error: { code: -1, message: 'Internal error: ' + e.message }
        }));
      });
    }

    async #handleCommand(msg) {
      const handler = commandHandlers[msg.method];
      if (!handler) {
        return {
          id: msg.id,
          error: { code: -32601, message: 'Unknown method: ' + msg.method }
        };
      }
      try {
        log('Handling: ' + msg.method);
        // Timeout protection — 30s to accommodate screenshot/DOM extraction
        const result = await Promise.race([
          handler(msg.params || {}),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Command timed out after 30s')), 30000)
          )
        ]);
        log('Completed: ' + msg.method);
        return { id: msg.id, result };
      } catch (e) {
        log('Error in ' + msg.method + ': ' + e);
        return {
          id: msg.id,
          error: { code: -1, message: e.message }
        };
      }
    }
  }

  // ============================================
  // WORKSPACE MANAGEMENT
  // ============================================

  // Track tabs created by the agent (WeakSet so closed tabs are GC'd)
  const agentTabs = new Set();

  function resolveTab(tabId) {
    if (!tabId) return gBrowser.selectedTab;

    // Match by linkedPanel ID
    for (const tab of gBrowser.tabs) {
      if (tab.linkedPanel === tabId) return tab;
    }
    // Match by URL
    for (const tab of gBrowser.tabs) {
      if (tab.linkedBrowser?.currentURI?.spec === tabId) return tab;
    }
    return null;
  }

  function getAgentTabs() {
    // Clean up closed tabs
    for (const tab of agentTabs) {
      if (!tab.linkedBrowser || !tab.parentNode) {
        agentTabs.delete(tab);
      }
    }
    return [...agentTabs];
  }

  // ============================================
  // SCREENSHOT
  // ============================================

  const MAX_SCREENSHOT_WIDTH = 1568; // Claude's recommended max image width

  async function screenshotTab(tab) {
    const browser = tab.linkedBrowser;
    const browsingContext = browser.browsingContext;
    const wg = browsingContext?.currentWindowGlobal;

    if (wg) {
      try {
        // drawSnapshot(rect, scale, bgColor) — null rect = full viewport
        const bitmap = await wg.drawSnapshot(null, 1, 'white');
        try {
          const canvas = document.createElement('canvas');
          // Resize to max width while maintaining aspect ratio
          if (bitmap.width > MAX_SCREENSHOT_WIDTH) {
            canvas.width = MAX_SCREENSHOT_WIDTH;
            canvas.height = Math.round(bitmap.height * (MAX_SCREENSHOT_WIDTH / bitmap.width));
          } else {
            canvas.width = bitmap.width;
            canvas.height = bitmap.height;
          }
          const ctx = canvas.getContext('2d');
          ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL('image/png');
          return { image: dataUrl, width: canvas.width, height: canvas.height };
        } finally {
          bitmap.close(); // Prevent memory leak
        }
      } catch (e) {
        log('drawSnapshot failed, trying PageThumbs fallback: ' + e);
      }
    }

    // Fallback: PageThumbs
    try {
      const { PageThumbs } = ChromeUtils.importESModule(
        'resource://gre/modules/PageThumbs.sys.mjs'
      );
      const blob = await PageThumbs.captureToBlob(browser, {
        fullScale: true,
        fullViewport: true,
      });
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
      });
      return { image: dataUrl, width: null, height: null };
    } catch (e2) {
      throw new Error('Screenshot failed: drawSnapshot: ' + e2 + '; PageThumbs unavailable');
    }
  }

  // ============================================
  // ACTOR HELPERS
  // ============================================

  function getActorForTab(tabId) {
    const tab = resolveTab(tabId);
    if (!tab) throw new Error('Tab not found');
    const browser = tab.linkedBrowser;
    const wg = browser.browsingContext?.currentWindowGlobal;
    if (!wg) throw new Error('Page not loaded (no currentWindowGlobal)');
    try {
      return wg.getActor('ZenLeapAgent');
    } catch (e) {
      log('getActor failed: ' + e + ' (url: ' + (browser.currentURI?.spec || '?') + ')');
      throw new Error('Cannot access page content: ' + e.message);
    }
  }

  // Interaction commands (click, key press, etc.) can trigger focus loss,
  // navigation, or browsing-context changes that destroy the actor before
  // the sendQuery response arrives. The action WAS dispatched — wrap with
  // a fallback so the caller gets a success result.
  async function actorInteraction(tabId, messageName, data, fallbackResult) {
    const actor = getActorForTab(tabId);
    try {
      return await actor.sendQuery(messageName, data);
    } catch (e) {
      if (String(e).includes('destroyed') || String(e).includes('AbortError')) {
        log(messageName + ': actor destroyed (action was dispatched)');
        return fallbackResult || { success: true, note: 'Action dispatched (actor destroyed before confirmation)' };
      }
      throw e;
    }
  }

  // ============================================
  // COMMAND HANDLERS
  // ============================================

  const commandHandlers = {
    // --- Ping / Debug ---
    ping: async () => {
      return { pong: true, version: VERSION };
    },

    get_agent_logs: async () => {
      return { logs: logBuffer.slice(-50) };
    },

    // --- Tab Management ---
    create_tab: async ({ url }) => {
      const tab = gBrowser.addTab(url || 'about:blank', {
        triggeringPrincipal: Services.scriptSecurityManager.getSystemPrincipal()
      });
      gBrowser.selectedTab = tab;
      agentTabs.add(tab);
      log('Created tab: ' + tab.linkedPanel + ' -> ' + (url || 'about:blank'));

      return {
        tab_id: tab.linkedPanel,
        url: url || 'about:blank'
      };
    },

    close_tab: async ({ tab_id }) => {
      const tab = resolveTab(tab_id);
      if (!tab) throw new Error('Tab not found');
      agentTabs.delete(tab);
      gBrowser.removeTab(tab);
      return { success: true };
    },

    switch_tab: async ({ tab_id }) => {
      const tab = resolveTab(tab_id);
      if (!tab) throw new Error('Tab not found');
      gBrowser.selectedTab = tab;
      return { success: true };
    },

    list_tabs: async () => {
      const tabs = getAgentTabs();
      return tabs.map(t => ({
        tab_id: t.linkedPanel,
        title: t.label || '',
        url: t.linkedBrowser?.currentURI?.spec || '',
        active: t === gBrowser.selectedTab
      }));
    },

    // --- Navigation ---
    navigate: async ({ url, tab_id }) => {
      const tab = resolveTab(tab_id);
      if (!tab) throw new Error('Tab not found');
      // Defer navigation so response is sent before any process swap
      setTimeout(() => {
        try {
          const browser = tab.linkedBrowser;
          const loadOpts = {
            triggeringPrincipal: Services.scriptSecurityManager.getSystemPrincipal()
          };
          if (typeof browser.fixupAndLoadURIString === 'function') {
            browser.fixupAndLoadURIString(url, loadOpts);
          } else {
            browser.loadURI(Services.io.newURI(url), loadOpts);
          }
        } catch (e) {
          log('Navigate error (deferred): ' + e);
        }
      }, 0);
      return { success: true };
    },

    go_back: async ({ tab_id }) => {
      const tab = resolveTab(tab_id);
      if (!tab) throw new Error('Tab not found');
      tab.linkedBrowser.goBack();
      return { success: true };
    },

    go_forward: async ({ tab_id }) => {
      const tab = resolveTab(tab_id);
      if (!tab) throw new Error('Tab not found');
      tab.linkedBrowser.goForward();
      return { success: true };
    },

    reload: async ({ tab_id }) => {
      const tab = resolveTab(tab_id);
      if (!tab) throw new Error('Tab not found');
      tab.linkedBrowser.reload();
      return { success: true };
    },

    // --- Observation ---
    get_page_info: async ({ tab_id }) => {
      const tab = resolveTab(tab_id);
      if (!tab) throw new Error('Tab not found');
      const browser = tab.linkedBrowser;
      return {
        url: browser.currentURI?.spec || '',
        title: tab.label || '',
        loading: browser.webProgress?.isLoadingDocument || false,
        can_go_back: browser.canGoBack,
        can_go_forward: browser.canGoForward
      };
    },

    screenshot: async ({ tab_id }) => {
      const tab = resolveTab(tab_id);
      if (!tab) throw new Error('Tab not found');
      return await screenshotTab(tab);
    },

    get_dom: async ({ tab_id }) => {
      const actor = getActorForTab(tab_id);
      return await actor.sendQuery('ZenLeapAgent:ExtractDOM');
    },

    get_page_text: async ({ tab_id }) => {
      const actor = getActorForTab(tab_id);
      return await actor.sendQuery('ZenLeapAgent:GetPageText');
    },

    get_page_html: async ({ tab_id }) => {
      const actor = getActorForTab(tab_id);
      return await actor.sendQuery('ZenLeapAgent:GetPageHTML');
    },

    // --- Interaction ---
    click_element: async ({ tab_id, index }) => {
      if (index === undefined || index === null) throw new Error('index is required');
      return await actorInteraction(tab_id, 'ZenLeapAgent:ClickElement', { index });
    },

    click_coordinates: async ({ tab_id, x, y }) => {
      if (x === undefined || y === undefined) throw new Error('x and y are required');
      return await actorInteraction(tab_id, 'ZenLeapAgent:ClickCoordinates', { x, y });
    },

    fill_field: async ({ tab_id, index, value }) => {
      if (index === undefined || index === null) throw new Error('index is required');
      if (value === undefined) throw new Error('value is required');
      return await actorInteraction(tab_id, 'ZenLeapAgent:FillField', { index, value: String(value) });
    },

    select_option: async ({ tab_id, index, value }) => {
      if (index === undefined || index === null) throw new Error('index is required');
      if (value === undefined) throw new Error('value is required');
      return await actorInteraction(tab_id, 'ZenLeapAgent:SelectOption', { index, value: String(value) });
    },

    type_text: async ({ tab_id, text }) => {
      if (!text) throw new Error('text is required');
      return await actorInteraction(tab_id, 'ZenLeapAgent:TypeText', { text });
    },

    press_key: async ({ tab_id, key, modifiers }) => {
      if (!key) throw new Error('key is required');
      return await actorInteraction(tab_id, 'ZenLeapAgent:PressKey', { key, modifiers: modifiers || {} }, { success: true, key });
    },

    scroll: async ({ tab_id, direction, amount }) => {
      if (!direction) throw new Error('direction is required (up/down/left/right)');
      return await actorInteraction(tab_id, 'ZenLeapAgent:Scroll', { direction, amount: amount || 500 });
    },

    hover: async ({ tab_id, index }) => {
      if (index === undefined || index === null) throw new Error('index is required');
      return await actorInteraction(tab_id, 'ZenLeapAgent:Hover', { index });
    },

    // --- Console / Eval ---
    console_setup: async ({ tab_id }) => {
      return await actorInteraction(tab_id, 'ZenLeapAgent:SetupConsoleCapture');
    },

    console_get_logs: async ({ tab_id }) => {
      const actor = getActorForTab(tab_id);
      return await actor.sendQuery('ZenLeapAgent:GetConsoleLogs');
    },

    console_get_errors: async ({ tab_id }) => {
      const actor = getActorForTab(tab_id);
      return await actor.sendQuery('ZenLeapAgent:GetConsoleErrors');
    },

    console_evaluate: async ({ tab_id, expression }) => {
      if (!expression) throw new Error('expression is required');
      const actor = getActorForTab(tab_id);
      return await actor.sendQuery('ZenLeapAgent:EvalJS', { expression });
    },

    // --- Control ---
    wait: async ({ seconds = 2 }) => {
      await new Promise(r => setTimeout(r, seconds * 1000));
      return { success: true };
    },
  };

  // ============================================
  // ACTOR REGISTRATION
  // ============================================

  const ACTOR_GLOBAL_KEY = '__zenleapActorsRegistered';

  function registerActors() {
    // Actors are browser-global — only register once across all windows
    if (globalThis[ACTOR_GLOBAL_KEY]) {
      log('Actors already registered');
      return;
    }

    try {
      // file:// is NOT a trusted scheme for actor modules.
      // Register a resource:// substitution so Firefox trusts the URIs.
      const actorsDir = Services.dirsvc.get('UChrm', Ci.nsIFile);
      actorsDir.append('JS');
      actorsDir.append('actors');

      const resProto = Services.io
        .getProtocolHandler('resource')
        .QueryInterface(Ci.nsIResProtocolHandler);
      resProto.setSubstitution('zenleap-agent', Services.io.newFileURI(actorsDir));
      log('Registered resource://zenleap-agent/ -> ' + actorsDir.path);

      const parentURI = 'resource://zenleap-agent/ZenLeapAgentParent.sys.mjs';
      const childURI = 'resource://zenleap-agent/ZenLeapAgentChild.sys.mjs';

      ChromeUtils.registerWindowActor('ZenLeapAgent', {
        parent: { esModuleURI: parentURI },
        child: { esModuleURI: childURI },
        allFrames: false,
        matches: ['*://*/*'],
      });

      globalThis[ACTOR_GLOBAL_KEY] = true;
      log('JSWindowActor ZenLeapAgent registered');
    } catch (e) {
      if (String(e).includes('NotSupportedError') || String(e).includes('already been registered')) {
        // Already registered by another window — expected under fx-autoconfig
        globalThis[ACTOR_GLOBAL_KEY] = true;
        log('Actors already registered (caught re-registration)');
      } else {
        log('Actor registration failed: ' + e);
      }
    }
  }

  // ============================================
  // INITIALIZATION
  // ============================================

  let initRetries = 0;
  const MAX_INIT_RETRIES = 20;

  function init() {
    log('Initializing ZenLeap Agent v' + VERSION + '...');

    if (!gBrowser || !gBrowser.tabs) {
      initRetries++;
      if (initRetries > MAX_INIT_RETRIES) {
        log('Failed to initialize after ' + MAX_INIT_RETRIES + ' retries. gBrowser not available.');
        return;
      }
      log('gBrowser not ready, retrying in 500ms (attempt ' + initRetries + '/' + MAX_INIT_RETRIES + ')');
      setTimeout(init, 500);
      return;
    }

    startServer();
    registerActors();

    log('ZenLeap Agent v' + VERSION + ' initialized. Server on localhost:' + AGENT_PORT);
  }

  // Clean up on window close
  window.addEventListener('unload', () => {
    stopServer();
  });

  // Start initialization
  if (document.readyState === 'complete') {
    init();
  } else {
    document.addEventListener('DOMContentLoaded', init);
  }

})();
