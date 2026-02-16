var ZenLeapPlugin = {
  _intervalId: null,

  init(api) {
    api.ui.log('Tab Timer plugin loaded');

    var self = this;
    self._intervalId = setInterval(function() {
      var tab = api.tabs.getCurrent();
      if (!tab) return;
      var url = api.tabs.getUrl(tab);
      var domain;
      try { domain = new URL(url).hostname; } catch (e) { domain = '(other)'; }
      if (!domain) return;

      var times = api.storage.get('domainTimes', {});
      times[domain] = (times[domain] || 0) + 5;

      var maxDomains = api.settings.getOwn('maxDomains', 200);
      var keys = Object.keys(times);
      if (keys.length > maxDomains) {
        var sorted = Object.entries(times).sort(function(a, b) { return b[1] - a[1]; });
        var pruned = {};
        for (var i = 0; i < maxDomains; i++) pruned[sorted[i][0]] = sorted[i][1];
        api.storage.set('domainTimes', pruned);
      } else {
        api.storage.set('domainTimes', times);
      }
    }, 5000);

    return {
      commands: {
        'show-time': function() {
          var times = api.storage.get('domainTimes', {});
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
            return '  ' + '\u2588'.repeat(Math.min(Math.ceil(pct / 5), 20)) + ' ' + pct + '%  ' + t + '  ' + domain;
          }).join('\n');

          var totalStr;
          if (totalSecs >= 3600) totalStr = Math.floor(totalSecs / 3600) + 'h ' + Math.floor((totalSecs % 3600) / 60) + 'm';
          else totalStr = Math.floor(totalSecs / 60) + 'm';

          api.ui.showModal('Time by Domain', 'Total tracked: ' + totalStr + '\n\n' + lines);
        },
        'reset-time': function() {
          api.storage.set('domainTimes', {});
          api.ui.showToast('Time tracking data reset');
        },
      },
    };
  },

  destroy(api) {
    if (this._intervalId) {
      clearInterval(this._intervalId);
      this._intervalId = null;
    }
  },
};
