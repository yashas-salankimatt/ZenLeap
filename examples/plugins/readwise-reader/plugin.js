var ZenLeapPlugin = {
  init(api) {
    api.ui.log('Readwise Reader plugin loaded');

    // The token is configuration: it lives in the plugin's settings, which are
    // saved from private windows too. Older versions kept it in storage.
    function getToken() {
      var token = api.settings.getOwn('access_token', '');
      if (!token) {
        var legacy = api.storage.get('access_token', '');
        if (legacy) {
          api.settings.setOwn('access_token', legacy);
          api.storage.remove('access_token');
          token = legacy;
        }
      }
      return token || '';
    }

    function hasToken() {
      return getToken().length > 0;
    }

    async function saveToReader(url, opts) {
      var token = getToken();
      var body = { url: url };
      if (opts.title) body.title = opts.title;
      if (opts.html) {
        body.html = opts.html;
        body.should_clean_html = true;
      }
      if (opts.summary) body.summary = opts.summary;
      body.saved_using = 'ZenLeap';
      if (opts.tags) body.tags = opts.tags;
      if (opts.notes) body.notes = opts.notes;

      var resp = await api.browser.fetch('https://readwise.io/api/v3/save/', {
        method: 'POST',
        headers: {
          'Authorization': 'Token ' + token,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        timeout: 15000,
      });

      if (!resp.ok) {
        var text = await resp.text();
        throw new Error('Readwise API error (' + resp.status + '): ' + text);
      }
      return resp.json();
    }

    async function validateToken(token) {
      var resp = await api.browser.fetch('https://readwise.io/api/v2/auth/', {
        method: 'GET',
        headers: { 'Authorization': 'Token ' + token },
        timeout: 10000,
      });
      return resp.status === 204;
    }

    return {
      commands: {
        'configure': async function() {
          var existing = getToken();
          var masked = existing ? existing.slice(0, 6) + '...' + existing.slice(-4) : '';
          var placeholder = existing ? 'Current: ' + masked : 'Paste your Readwise access token';

          var token = await api.ui.showPrompt('Readwise Reader', placeholder, '', { password: true });
          if (token === null) return;

          token = token.trim();
          if (!token) {
            if (existing) {
              var clear = await api.ui.showConfirm('Clear Token', 'Remove your saved Readwise access token?');
              if (clear) {
                api.settings.setOwn('access_token', '');
                api.storage.remove('access_token');
                api.ui.showToast('Readwise token cleared');
              }
            }
            return;
          }

          api.ui.showToast('Validating token...');
          try {
            var valid = await validateToken(token);
            if (valid) {
              api.settings.setOwn('access_token', token);
              api.storage.remove('access_token');
              api.ui.showToast('Readwise token saved');
            } else {
              api.ui.showToast('Invalid token — check your access token');
            }
          } catch (e) {
            api.ui.showToast('Failed to validate: ' + e.message);
          }
        },

        'save-page': async function() {
          if (!hasToken()) {
            api.ui.showToast('Set up Readwise first (run Configure Readwise Reader)');
            return;
          }
          var url = api.browser.getCurrentUrl();
          var title = api.browser.getPageTitle();
          if (!url || url === 'about:blank') {
            api.ui.showToast('No page to save');
            return;
          }
          api.ui.showToast('Saving to Reader...');
          try {
            await saveToReader(url, { title: title });
            api.ui.showToast('Saved to Reader');
          } catch (e) {
            api.ui.showToast('Failed: ' + e.message);
          }
        },

        'save-selection': async function() {
          if (!hasToken()) {
            api.ui.showToast('Set up Readwise first (run Configure Readwise Reader)');
            return;
          }
          // Async: the page lives in a content process. getSelection() also says whether
          // the text had to be cut short (a selection inside a text field on the page).
          var picked = api.browser.getSelection
            ? await api.browser.getSelection()
            : { text: await api.browser.getSelectedText(), truncated: false };
          var selection = picked.text;
          if (!selection || !selection.trim()) {
            api.ui.showToast('No text selected — select text on the page first');
            return;
          }
          var url = api.browser.getCurrentUrl();
          var title = api.browser.getPageTitle();
          if (!url || url === 'about:blank') {
            api.ui.showToast('No page URL');
            return;
          }
          api.ui.showToast('Saving selection to Reader...');
          try {
            var html = '<blockquote>' + selection.replace(/&/g, '&amp;').replace(/</g, '&lt;') + '</blockquote>';
            await saveToReader(url, {
              title: title,
              notes: 'Selection from ZenLeap:\n\n' + selection,
              html: html,
            });
            api.ui.showToast(picked.truncated
              ? 'Saved to Reader, but only the first ' + selection.length + ' characters of the selection could be read'
              : 'Selection saved to Reader');
          } catch (e) {
            api.ui.showToast('Failed: ' + e.message);
          }
        },
      },
    };
  },
};
