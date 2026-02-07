// ==UserScript==
// @name           ZenLeap Agent - Browser Automation for Claude Code
// @description    WebSocket server exposing browser control via MCP for AI agents
// @include        main
// @author         ZenLeap
// @version        0.5.0
// ==/UserScript==

(function() {
  'use strict';

  const VERSION = '0.6.0';
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

  let agentWorkspaceId = null;
  let _ensureWorkspacePromise = null;

  // Track tabs created by the agent
  const agentTabs = new Set();

  async function ensureAgentWorkspace() {
    // Prevent concurrent calls from creating duplicate workspaces
    if (_ensureWorkspacePromise) return _ensureWorkspacePromise;
    _ensureWorkspacePromise = _doEnsureAgentWorkspace();
    try {
      return await _ensureWorkspacePromise;
    } finally {
      _ensureWorkspacePromise = null;
    }
  }

  async function _doEnsureAgentWorkspace() {
    // Return cached ID if workspace still exists
    if (agentWorkspaceId) {
      const ws = gZenWorkspaces?.getWorkspaceFromId(agentWorkspaceId);
      if (ws) return agentWorkspaceId;
      agentWorkspaceId = null;
    }

    if (!gZenWorkspaces) {
      log('gZenWorkspaces not available — workspace scoping disabled');
      return null;
    }

    // Look for existing workspace by name
    const workspaces = gZenWorkspaces.getWorkspaces();
    if (workspaces) {
      const existing = workspaces.find(ws => ws.name === AGENT_WORKSPACE_NAME);
      if (existing) {
        agentWorkspaceId = existing.uuid;
        log('Found workspace: ' + AGENT_WORKSPACE_NAME + ' (' + agentWorkspaceId + ')');
        return agentWorkspaceId;
      }
    }

    // Create new workspace (dontChange=true to avoid UI blocking)
    try {
      const created = await gZenWorkspaces.createAndSaveWorkspace(
        AGENT_WORKSPACE_NAME, undefined, true
      );
      agentWorkspaceId = created.uuid;
      log('Created workspace: ' + AGENT_WORKSPACE_NAME + ' (' + agentWorkspaceId + ')');
      return agentWorkspaceId;
    } catch (e) {
      log('Failed to create workspace: ' + e);
      return null;
    }
  }

  function getWorkspaceTabs(workspaceId) {
    if (!workspaceId) return [];
    return Array.from(gBrowser.tabs).filter(
      tab => tab.getAttribute('zen-workspace-id') === workspaceId
        && tab.linkedBrowser && tab.parentNode
    );
  }

  // Track the agent's "active" tab independently of gBrowser.selectedTab,
  // because agent tabs live in a separate workspace from the user's tabs.
  let currentAgentTab = null;

  function resolveTab(tabId) {
    if (!tabId) {
      // Prefer agent's tracked current tab over gBrowser.selectedTab
      if (currentAgentTab && currentAgentTab.linkedBrowser && currentAgentTab.parentNode) {
        return currentAgentTab;
      }
      return gBrowser.selectedTab;
    }

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

  // ============================================
  // TAB EVENT TRACKING
  // ============================================

  const tabEventQueue = [];

  function setupTabEventTracking() {
    try {
      gBrowser.tabContainer.addEventListener('TabOpen', (event) => {
        const tab = event.target;
        // Check if opener is an agent tab
        const openerBC = tab.linkedBrowser?.browsingContext?.opener;
        const openerTab = openerBC ? gBrowser.getTabForBrowser(openerBC.top?.embedderElement) : null;
        const isAgentChild = openerTab && agentTabs.has(openerTab);

        if (isAgentChild) {
          agentTabs.add(tab);
          // Move to agent workspace
          if (agentWorkspaceId && gZenWorkspaces) {
            gZenWorkspaces.moveTabToWorkspace(tab, agentWorkspaceId);
          }
          log('Agent popup detected: ' + tab.linkedPanel);
        }

        tabEventQueue.push({
          type: 'tab_opened',
          tab_id: tab.linkedPanel,
          opener_tab_id: openerTab?.linkedPanel || null,
          is_agent_tab: isAgentChild || false,
          timestamp: new Date().toISOString(),
        });
        if (tabEventQueue.length > 50) tabEventQueue.shift();
      });

      gBrowser.tabContainer.addEventListener('TabClose', (event) => {
        const tab = event.target;
        agentTabs.delete(tab);
        tabEventQueue.push({
          type: 'tab_closed',
          tab_id: tab.linkedPanel,
          timestamp: new Date().toISOString(),
        });
        if (tabEventQueue.length > 50) tabEventQueue.shift();
      });

      log('Tab event tracking active');
    } catch (e) {
      log('Failed to setup tab event tracking: ' + e);
    }
  }

  // ============================================
  // DIALOG HANDLING
  // ============================================

  const pendingDialogs = [];
  const dialogWindowRefs = new Map(); // dialog object → WeakRef(window)

  const dialogObserver = {
    observe(subject, topic, data) {
      if (topic !== 'common-dialog-loaded') return;
      try {
        const dialogWin = subject;
        const args = dialogWin.arguments?.[0];
        if (!args) return;
        const dialogInfo = {
          type: args.promptType || 'unknown', // alertCheck, confirmCheck, prompt
          message: args.text || '',
          default_value: args.value || '',
          timestamp: new Date().toISOString(),
        };
        // Use WeakRef to avoid retaining dialog window in memory
        dialogWindowRefs.set(dialogInfo, new WeakRef(dialogWin));
        pendingDialogs.push(dialogInfo);
        if (pendingDialogs.length > 20) {
          const old = pendingDialogs.shift();
          dialogWindowRefs.delete(old);
        }
        log('Dialog captured: ' + dialogInfo.type + ' — ' + dialogInfo.message.substring(0, 80));
      } catch (e) {
        log('Dialog observer error: ' + e);
      }
    }
  };

  function setupDialogObserver() {
    try {
      Services.obs.addObserver(dialogObserver, 'common-dialog-loaded');
      log('Dialog observer active');
    } catch (e) {
      log('Failed to setup dialog observer: ' + e);
    }
  }

  // ============================================
  // NAVIGATION STATUS TRACKING
  // ============================================

  // WeakMap: browser → {url, httpStatus, errorCode, loading}
  const navStatusMap = new WeakMap();

  const navProgressListener = {
    QueryInterface: ChromeUtils.generateQI([
      'nsIWebProgressListener',
      'nsISupportsWeakReference',
    ]),

    onStateChange(webProgress, request, stateFlags, status) {
      if (!(stateFlags & Ci.nsIWebProgressListener.STATE_IS_DOCUMENT)) return;
      const browser = webProgress?.browsingContext?.top?.embedderElement;
      if (!browser) return;

      const entry = navStatusMap.get(browser) || {};

      if (stateFlags & Ci.nsIWebProgressListener.STATE_START) {
        entry.loading = true;
        entry.httpStatus = 0;
        entry.errorCode = 0;
        entry.url = request?.name || '';
      }
      if (stateFlags & Ci.nsIWebProgressListener.STATE_STOP) {
        entry.loading = false;
        if (request instanceof Ci.nsIHttpChannel) {
          try {
            entry.httpStatus = request.responseStatus;
          } catch (e) {
            // Channel may be invalid
          }
        }
        if (status !== 0) {
          entry.errorCode = status;
        }
      }
      navStatusMap.set(browser, entry);
    },

    onLocationChange() {},
    onProgressChange() {},
    onSecurityChange() {},
    onStatusChange() {},
    onContentBlockingEvent() {},
  };

  function setupNavTracking() {
    try {
      gBrowser.addTabsProgressListener(navProgressListener);
      log('Navigation status tracking active');
    } catch (e) {
      log('Failed to setup nav tracking: ' + e);
    }
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
          // JPEG is 5-10x smaller than PNG for web page screenshots
          const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
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

  function getActorForTab(tabId, frameId) {
    const tab = resolveTab(tabId);
    if (!tab) throw new Error('Tab not found');
    const browser = tab.linkedBrowser;
    const wg = frameId
      ? getWindowGlobalForFrame(browser, frameId)
      : browser.browsingContext?.currentWindowGlobal;
    if (!wg) throw new Error(frameId ? 'Frame not found: ' + frameId : 'Page not loaded (no currentWindowGlobal)');
    try {
      return wg.getActor('ZenLeapAgent');
    } catch (e) {
      log('getActor failed: ' + e + ' (url: ' + (browser.currentURI?.spec || '?') + ')');
      throw new Error('Cannot access page content: ' + e.message);
    }
  }

  function getWindowGlobalForFrame(browser, frameId) {
    const contexts = browser.browsingContext?.getAllBrowsingContextsInSubtree() || [];
    for (const ctx of contexts) {
      if (ctx.id == frameId) {  // Allow type coercion (int vs string)
        return ctx.currentWindowGlobal;
      }
    }
    return null;
  }

  function listFramesForTab(tabId) {
    const tab = resolveTab(tabId);
    if (!tab) throw new Error('Tab not found');
    const browser = tab.linkedBrowser;
    const topCtx = browser.browsingContext;
    if (!topCtx) throw new Error('Page not loaded');
    const contexts = topCtx.getAllBrowsingContextsInSubtree() || [];
    return contexts.map(ctx => ({
      frame_id: ctx.id,
      url: ctx.currentWindowGlobal?.documentURI?.spec || '',
      is_top: ctx === topCtx,
    }));
  }

  // Interaction commands (click, key press, etc.) can trigger focus loss,
  // navigation, or browsing-context changes that destroy the actor before
  // the sendQuery response arrives. The action WAS dispatched — wrap with
  // a fallback so the caller gets a success result.
  async function actorInteraction(tabId, messageName, data, fallbackResult, frameId) {
    const actor = getActorForTab(tabId, frameId);
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
      const wsId = await ensureAgentWorkspace();
      const tab = gBrowser.addTab(url || 'about:blank', {
        triggeringPrincipal: Services.scriptSecurityManager.getSystemPrincipal()
      });
      agentTabs.add(tab);

      // Move tab to agent workspace
      if (wsId && gZenWorkspaces) {
        gZenWorkspaces.moveTabToWorkspace(tab, wsId);
      }
      // Track as agent's active tab and visually focus it.
      // We assume the ZenLeap AI workspace is the active workspace,
      // so gBrowser.selectedTab will actually show this tab in the UI.
      currentAgentTab = tab;
      gBrowser.selectedTab = tab;
      log('Created tab: ' + tab.linkedPanel + ' -> ' + (url || 'about:blank') + (wsId ? ' [ws:' + wsId + ']' : ''));

      return {
        tab_id: tab.linkedPanel,
        url: url || 'about:blank'
      };
    },

    close_tab: async ({ tab_id }) => {
      const tab = resolveTab(tab_id);
      if (!tab) throw new Error('Tab not found');
      if (currentAgentTab === tab) currentAgentTab = null;
      agentTabs.delete(tab);
      gBrowser.removeTab(tab);
      return { success: true };
    },

    switch_tab: async ({ tab_id }) => {
      const tab = resolveTab(tab_id);
      if (!tab) throw new Error('Tab not found');
      currentAgentTab = tab;
      gBrowser.selectedTab = tab;
      return { success: true };
    },

    list_tabs: async () => {
      // List all tabs in the agent workspace, falling back to tracked tabs
      const wsId = await ensureAgentWorkspace();
      const tabs = wsId ? getWorkspaceTabs(wsId) : [...agentTabs].filter(t => t.linkedBrowser && t.parentNode);
      return tabs.filter(t => t.linkedPanel).map(t => ({
        tab_id: t.linkedPanel,
        title: t.label || '',
        url: t.linkedBrowser?.currentURI?.spec || '',
        active: t === currentAgentTab
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

    // --- Tab Events ---
    get_tab_events: async () => {
      const events = tabEventQueue.splice(0); // drain queue
      return events;
    },

    // --- Dialogs ---
    get_dialogs: async () => {
      return pendingDialogs.map(d => ({
        type: d.type,
        message: d.message,
        default_value: d.default_value,
        timestamp: d.timestamp,
      }));
    },

    handle_dialog: async ({ action, text }) => {
      if (!action) throw new Error('action is required (accept or dismiss)');
      if (pendingDialogs.length === 0) throw new Error('No pending dialogs');
      const dialog = pendingDialogs.shift();
      const dialogWin = dialog._dialog;
      if (!dialogWin || dialogWin.closed) {
        return { success: false, note: 'Dialog already closed' };
      }
      try {
        const ui = dialogWin.document?.getElementById('commonDialog');
        if (!ui) throw new Error('Dialog UI not found');
        if (text !== undefined && dialog.type === 'prompt') {
          const input = dialogWin.document.getElementById('loginTextbox');
          if (input) input.value = text;
        }
        if (action === 'accept') {
          ui.acceptDialog();
        } else {
          ui.cancelDialog();
        }
        return { success: true, action, type: dialog.type };
      } catch (e) {
        return { success: false, error: e.message };
      }
    },

    // --- Navigation Status ---
    get_navigation_status: async ({ tab_id }) => {
      const tab = resolveTab(tab_id);
      if (!tab) throw new Error('Tab not found');
      const browser = tab.linkedBrowser;
      const entry = navStatusMap.get(browser) || {};
      return {
        url: browser.currentURI?.spec || '',
        http_status: entry.httpStatus || 0,
        error_code: entry.errorCode || 0,
        loading: browser.webProgress?.isLoadingDocument || false,
      };
    },

    // --- Frames ---
    list_frames: async ({ tab_id }) => {
      return listFramesForTab(tab_id);
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

    get_dom: async ({ tab_id, frame_id }) => {
      const actor = getActorForTab(tab_id, frame_id);
      return await actor.sendQuery('ZenLeapAgent:ExtractDOM');
    },

    get_page_text: async ({ tab_id, frame_id }) => {
      const actor = getActorForTab(tab_id, frame_id);
      return await actor.sendQuery('ZenLeapAgent:GetPageText');
    },

    get_page_html: async ({ tab_id, frame_id }) => {
      const actor = getActorForTab(tab_id, frame_id);
      return await actor.sendQuery('ZenLeapAgent:GetPageHTML');
    },

    // --- Interaction ---
    click_element: async ({ tab_id, frame_id, index }) => {
      if (index === undefined || index === null) throw new Error('index is required');
      return await actorInteraction(tab_id, 'ZenLeapAgent:ClickElement', { index }, null, frame_id);
    },

    click_coordinates: async ({ tab_id, frame_id, x, y }) => {
      if (x === undefined || y === undefined) throw new Error('x and y are required');
      return await actorInteraction(tab_id, 'ZenLeapAgent:ClickCoordinates', { x, y }, null, frame_id);
    },

    fill_field: async ({ tab_id, frame_id, index, value }) => {
      if (index === undefined || index === null) throw new Error('index is required');
      if (value === undefined) throw new Error('value is required');
      return await actorInteraction(tab_id, 'ZenLeapAgent:FillField', { index, value: String(value) }, null, frame_id);
    },

    select_option: async ({ tab_id, frame_id, index, value }) => {
      if (index === undefined || index === null) throw new Error('index is required');
      if (value === undefined) throw new Error('value is required');
      return await actorInteraction(tab_id, 'ZenLeapAgent:SelectOption', { index, value: String(value) }, null, frame_id);
    },

    type_text: async ({ tab_id, frame_id, text }) => {
      if (!text) throw new Error('text is required');
      return await actorInteraction(tab_id, 'ZenLeapAgent:TypeText', { text }, null, frame_id);
    },

    press_key: async ({ tab_id, frame_id, key, modifiers }) => {
      if (!key) throw new Error('key is required');
      const mods = modifiers || {};
      return await actorInteraction(tab_id, 'ZenLeapAgent:PressKey', { key, modifiers: mods }, { success: true, key }, frame_id);
    },

    scroll: async ({ tab_id, frame_id, direction, amount }) => {
      if (!direction) throw new Error('direction is required (up/down/left/right)');
      return await actorInteraction(tab_id, 'ZenLeapAgent:Scroll', { direction, amount: amount || 500 }, null, frame_id);
    },

    hover: async ({ tab_id, frame_id, index }) => {
      if (index === undefined || index === null) throw new Error('index is required');
      return await actorInteraction(tab_id, 'ZenLeapAgent:Hover', { index }, null, frame_id);
    },

    // --- Console / Eval ---
    console_setup: async ({ tab_id, frame_id }) => {
      return await actorInteraction(tab_id, 'ZenLeapAgent:SetupConsoleCapture', {}, null, frame_id);
    },

    console_get_logs: async ({ tab_id, frame_id }) => {
      const actor = getActorForTab(tab_id, frame_id);
      return await actor.sendQuery('ZenLeapAgent:GetConsoleLogs');
    },

    console_get_errors: async ({ tab_id, frame_id }) => {
      const actor = getActorForTab(tab_id, frame_id);
      return await actor.sendQuery('ZenLeapAgent:GetConsoleErrors');
    },

    console_evaluate: async ({ tab_id, frame_id, expression }) => {
      if (!expression) throw new Error('expression is required');
      const actor = getActorForTab(tab_id, frame_id);
      return await actor.sendQuery('ZenLeapAgent:EvalJS', { expression });
    },

    // --- Clipboard ---
    clipboard_read: async () => {
      try {
        const trans = Cc['@mozilla.org/widget/transferable;1'].createInstance(Ci.nsITransferable);
        trans.init(null);
        trans.addDataFlavor('text/plain');
        Services.clipboard.getData(trans, Ci.nsIClipboard.kGlobalClipboard);
        const data = {};
        const dataLen = {};
        trans.getTransferData('text/plain', data);
        const str = data.value?.QueryInterface(Ci.nsISupportsString);
        return { text: str ? str.data : '' };
      } catch (e) {
        return { text: '', error: e.message };
      }
    },

    clipboard_write: async ({ text }) => {
      if (text === undefined) throw new Error('text is required');
      try {
        const trans = Cc['@mozilla.org/widget/transferable;1'].createInstance(Ci.nsITransferable);
        trans.init(null);
        trans.addDataFlavor('text/plain');
        const str = Cc['@mozilla.org/supports-string;1'].createInstance(Ci.nsISupportsString);
        str.data = text;
        trans.setTransferData('text/plain', str);
        Services.clipboard.setData(trans, null, Ci.nsIClipboard.kGlobalClipboard);
        return { success: true, length: text.length };
      } catch (e) {
        throw new Error('Clipboard write failed: ' + e.message);
      }
    },

    // --- Control ---
    wait: async ({ seconds = 2 }) => {
      await new Promise(r => setTimeout(r, seconds * 1000));
      return { success: true };
    },

    wait_for_element: async ({ tab_id, frame_id, selector, timeout = 10 }) => {
      if (!selector) throw new Error('selector is required');
      const tab = resolveTab(tab_id);
      if (!tab) throw new Error('Tab not found');
      const deadline = Date.now() + timeout * 1000;
      while (Date.now() < deadline) {
        try {
          const actor = getActorForTab(tab_id, frame_id);
          const result = await actor.sendQuery('ZenLeapAgent:QuerySelector', { selector });
          if (result.found) return result;
        } catch (e) {
          // Actor might not be available yet during navigation
        }
        await new Promise(r => setTimeout(r, 250));
      }
      return { found: false, timeout: true };
    },

    wait_for_text: async ({ tab_id, frame_id, text, timeout = 10 }) => {
      if (!text) throw new Error('text is required');
      const tab = resolveTab(tab_id);
      if (!tab) throw new Error('Tab not found');
      const deadline = Date.now() + timeout * 1000;
      while (Date.now() < deadline) {
        try {
          const actor = getActorForTab(tab_id, frame_id);
          const result = await actor.sendQuery('ZenLeapAgent:SearchText', { text });
          if (result.found) return result;
        } catch (e) {
          // Actor might not be available yet during navigation
        }
        await new Promise(r => setTimeout(r, 250));
      }
      return { found: false, timeout: true };
    },

    wait_for_load: async ({ tab_id, timeout = 15 }) => {
      const tab = resolveTab(tab_id);
      if (!tab) throw new Error('Tab not found');
      const browser = tab.linkedBrowser;
      const deadline = Date.now() + timeout * 1000;
      while (browser.webProgress?.isLoadingDocument && Date.now() < deadline) {
        await new Promise(r => setTimeout(r, 200));
      }
      const navEntry = navStatusMap.get(browser) || {};
      return {
        success: true,
        url: browser.currentURI?.spec || '',
        title: tab.label || '',
        loading: browser.webProgress?.isLoadingDocument || false,
        http_status: navEntry.httpStatus || 0,
      };
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
        allFrames: true,
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
    setupNavTracking();
    setupDialogObserver();
    setupTabEventTracking();

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
