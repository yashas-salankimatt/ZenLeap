var ZenLeapPlugin = {
  init(api) {
    api.ui.log('Tab Stats plugin loaded');
    return {
      commands: {
        'show-stats': () => {
          const tabs = api.tabs.getAll();
          const domains = {};
          let pinnedCount = 0;
          let totalAge = 0;
          const now = Date.now();

          for (const tab of tabs) {
            const url = api.tabs.getUrl(tab);
            try {
              const hostname = new URL(url).hostname || '(local)';
              domains[hostname] = (domains[hostname] || 0) + 1;
            } catch (e) {
              domains['(other)'] = (domains['(other)'] || 0) + 1;
            }
            if (api.tabs.isPinned(tab)) pinnedCount++;
            totalAge += now - api.tabs.getLastAccessed(tab);
          }

          const topDomains = Object.entries(domains)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([d, c]) => '  ' + d + ': ' + c)
            .join('\n');

          const avgAge = tabs.length > 0 ? Math.round(totalAge / tabs.length / 60000) : 0;

          api.ui.showModal('Tab Statistics', [
            'Total tabs: ' + tabs.length,
            'Pinned: ' + pinnedCount,
            'Avg age: ' + avgAge + ' min',
            'Unique domains: ' + Object.keys(domains).length,
            '',
            'Top domains:',
            topDomains,
          ].join('\n'));
        },

        'domain-breakdown': () => {
          const tabs = api.tabs.getAll();
          const domains = {};

          for (const tab of tabs) {
            const url = api.tabs.getUrl(tab);
            try {
              const hostname = new URL(url).hostname || '(local)';
              domains[hostname] = (domains[hostname] || 0) + 1;
            } catch (e) {
              domains['(other)'] = (domains['(other)'] || 0) + 1;
            }
          }

          const lines = Object.entries(domains)
            .sort((a, b) => b[1] - a[1])
            .map(([d, c]) => {
              const bar = '\u2588'.repeat(Math.min(c, 20));
              return '  ' + bar + ' ' + c + '  ' + d;
            })
            .join('\n');

          api.ui.showModal(
            'Domain Breakdown',
            Object.keys(domains).length + ' domains across ' + tabs.length + ' tabs\n\n' + lines
          );
        },
      },
    };
  },
};
