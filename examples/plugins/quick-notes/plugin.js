var ZenLeapPlugin = {
  init(api) {
    api.ui.log('Quick Notes plugin loaded');

    function noteUrlKey(url) {
      try { var u = new URL(url); return u.hostname + u.pathname; }
      catch (e) { return url; }
    }

    function showNoteEditor(url) {
      var existingEditor = document.getElementById('zenleap-plugin-note-editor');
      if (existingEditor) existingEditor.remove();

      var key = noteUrlKey(url);
      var existing = api.storage.get(key, '');

      var modal = document.createElement('div');
      modal.id = 'zenleap-plugin-note-editor';
      modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; z-index: 100010; display: flex; justify-content: center; align-items: center; padding: 20px;';

      var backdrop = document.createElement('div');
      backdrop.style.cssText = 'position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.6); backdrop-filter: blur(6px);';

      var card = document.createElement('div');
      card.style.cssText = 'position: relative; width: 90%; max-width: 480px; background: rgba(25,25,30,0.98); border-radius: 14px; box-shadow: 0 12px 48px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.1); overflow: hidden; display: flex; flex-direction: column; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;';

      var header = document.createElement('div');
      header.style.cssText = 'padding: 16px 20px 12px; border-bottom: 1px solid rgba(255,255,255,0.1);';
      var h2 = document.createElement('h2');
      h2.style.cssText = 'margin: 0 0 4px; font-size: 16px; font-weight: 700; color: #61afef;';
      h2.textContent = 'Quick Note';
      var urlLabel = document.createElement('div');
      urlLabel.style.cssText = 'font-size: 11px; color: #666; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;';
      urlLabel.textContent = key;
      header.appendChild(h2);
      header.appendChild(urlLabel);

      var textarea = document.createElement('textarea');
      textarea.value = existing;
      textarea.placeholder = 'Type your note here...';
      textarea.style.cssText = 'margin: 16px 20px; padding: 12px; min-height: 120px; max-height: 300px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.12); border-radius: 8px; color: #e0e0e0; font-size: 13px; resize: vertical; outline: none; font-family: inherit; line-height: 1.5;';
      textarea.addEventListener('focus', function() { textarea.style.borderColor = '#61afef'; });
      textarea.addEventListener('blur', function() { textarea.style.borderColor = 'rgba(255,255,255,0.12)'; });

      var footer = document.createElement('div');
      footer.style.cssText = 'padding: 12px 20px; border-top: 1px solid rgba(255,255,255,0.08); display: flex; justify-content: flex-end; gap: 8px;';

      var cancelBtn = document.createElement('button');
      cancelBtn.textContent = 'Cancel';
      cancelBtn.style.cssText = 'background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12); color: #aaa; padding: 6px 16px; border-radius: 6px; cursor: pointer; font-size: 13px; font-family: inherit;';

      var saveBtn = document.createElement('button');
      saveBtn.textContent = 'Save';
      saveBtn.style.cssText = 'background: rgba(97,175,239,0.2); border: 1px solid rgba(97,175,239,0.4); color: #61afef; padding: 6px 16px; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 600; font-family: inherit;';

      var close = function() { modal.remove(); window.removeEventListener('keydown', escHandler, true); };
      var escHandler = function(e) { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); } };
      window.addEventListener('keydown', escHandler, true);
      cancelBtn.addEventListener('click', close);
      backdrop.addEventListener('click', close);
      saveBtn.addEventListener('click', function() {
        var val = textarea.value.trim();
        if (val) { api.storage.set(key, val); api.ui.showToast('Note saved'); }
        else { api.storage.remove(key); api.ui.showToast('Note cleared'); }
        close();
      });

      footer.appendChild(cancelBtn);
      footer.appendChild(saveBtn);
      card.appendChild(header);
      card.appendChild(textarea);
      card.appendChild(footer);
      modal.appendChild(backdrop);
      modal.appendChild(card);
      document.documentElement.appendChild(modal);
      setTimeout(function() { textarea.focus(); }, 50);
    }

    function showNotesViewer() {
      var allData = api.storage.getAll();
      var entries = Object.entries(allData).filter(function(pair) { return typeof pair[1] === 'string' && pair[1].trim(); });
      if (entries.length === 0) { api.ui.showToast('No notes saved yet'); return; }
      var content = entries.map(function(pair) { return '\u2500\u2500 ' + pair[0] + ' \u2500\u2500\n' + pair[1]; }).join('\n\n');
      api.ui.showModal('Notes (' + entries.length + ')', content);
    }

    return {
      commands: {
        'add-note': function() {
          showNoteEditor(api.tabs.getUrl());
        },
        'view-notes': function() {
          showNotesViewer();
        },
        'clear-note': function() {
          var key = noteUrlKey(api.tabs.getUrl());
          api.storage.remove(key);
          api.ui.showToast('Note cleared');
        },
      },
    };
  },
};
