var ZenLeapPlugin = {
  _intervalId: null,
  _flushId: null,
  _pending: null,
  _api: null,

  init(api) {
    api.ui.log('Tab Timer plugin loaded');

    var self = this;
    self._api = api;
    self._pending = {};

    // Count 5-second ticks in memory and persist them once a minute (and when the plugin
    // stops). The plugin runs in every browser window: only count time in the focused
    // one, and never record sites visited in private windows.
    self._intervalId = setInterval(function() {
      if (!document.hasFocus() || api.browser.isPrivate()) return;
      var tab = api.tabs.getCurrent();
      if (!tab) return;
      var url = api.tabs.getUrl(tab);
      var domain;
      try { domain = new URL(url).hostname; } catch (e) { domain = '(other)'; }
      if (!domain) return;
      self._pending[domain] = (self._pending[domain] || 0) + 5;
    }, 5000);
    self._flushId = setInterval(function() { self._flush(); }, 60000);

    function currentTimes() {
      var times = api.storage.get('domainTimes', {});
      Object.keys(self._pending).forEach(function(domain) {
        times[domain] = (times[domain] || 0) + self._pending[domain];
      });
      return times;
    }

    return {
      commands: {
        'show-time': function() {
          var times = currentTimes();
          var entries = Object.entries(times).sort(function(a, b) { return b[1] - a[1]; });
          if (entries.length === 0) { api.ui.showToast('No time data yet'); return; }

          var totalSecs = entries.reduce(function(s, pair) { return s + pair[1]; }, 0);
          var lines = entries.slice(0, 15).map(function(pair) {
            var domain = pair[0], secs = pair[1];
            var pct = Math.round((secs / totalSecs) * 100);
            var t;
            if (secs >= 3600) t = Math.floor(secs / 3600) + 'h ' + Math.floor((secs % 3600) / 60) + 'm';
            else if (secs >= 60) t = Math.floor(secs / 60) + 'm ' + (secs % 60) + 's';
            else t = secs + 's';
            return '  ' + '█'.repeat(Math.min(Math.ceil(pct / 5), 20)) + ' ' + pct + '%  ' + t + '  ' + domain;
          }).join('\n');

          var totalStr;
          if (totalSecs >= 3600) totalStr = Math.floor(totalSecs / 3600) + 'h ' + Math.floor((totalSecs % 3600) / 60) + 'm';
          else totalStr = Math.floor(totalSecs / 60) + 'm';

          api.ui.showModal('Time by Domain', 'Total tracked: ' + totalStr + '\n\n' + lines);
        },
        'reset-time': function() {
          self._pending = {};
          api.storage.set('domainTimes', {});
          api.ui.showToast('Time tracking data reset');
        },
      },
    };
  },

  // Add the pending seconds to the stored totals (which may include other windows' time)
  _flush() {
    var api = this._api;
    var pending = this._pending;
    if (!api || !pending || Object.keys(pending).length === 0) return;
    var times = api.storage.get('domainTimes', {});
    Object.keys(pending).forEach(function(domain) {
      times[domain] = (times[domain] || 0) + pending[domain];
    });
    var maxDomains = api.settings.getOwn('maxDomains', 200);
    var sorted = Object.entries(times).sort(function(a, b) { return b[1] - a[1]; });
    if (sorted.length > maxDomains) {
      times = {};
      for (var i = 0; i < maxDomains; i++) times[sorted[i][0]] = sorted[i][1];
    }
    api.storage.set('domainTimes', times);
    this._pending = {};
  },

  destroy(api) {
    if (this._intervalId) {
      clearInterval(this._intervalId);
      this._intervalId = null;
    }
    if (this._flushId) {
      clearInterval(this._flushId);
      this._flushId = null;
    }
    this._flush();
    this._api = null;
  },
};
