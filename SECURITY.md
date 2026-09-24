# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| 3.x     | Yes       |
| < 3.0   | No        |

ZenLeap supports Zen Browser 1.21.7b and newer (tested on 1.22.3b).

## Reporting a Vulnerability

If you discover a security vulnerability in ZenLeap, please report it responsibly:

1. **Do not** open a public GitHub issue for security vulnerabilities
2. Email the maintainer or send a private message via GitHub
3. Include a description of the vulnerability and steps to reproduce it
4. Allow reasonable time for a fix before public disclosure

## Security Model

ZenLeap is a userscript for the browser's own interface (chrome), loaded by fx-autoconfig or Sine. It runs with the same full privileges as the browser UI: it can read and change every tab, the profile's files and the browser's preferences. Install it, and any plugin, only from sources you trust.

What the script does:

- It runs only in browser windows (`chrome://browser/content/browser.xhtml`).
- It does not inject scripts into web pages and does not intercept or modify web traffic. Browse-mode tab previews are screenshots the browser renders for the tab (`drawSnapshot`); they are kept in memory only.
- It does not read passwords or cookies.

Data it stores, all locally in your profile:

- Settings, essential-tab marks and update-check state: preferences (`uc.zenleap.*` in `about:config`).
- Custom themes: `chrome/zenleap-themes.json`.
- Plugins and their data: `chrome/zenleap-plugins/`, `chrome/zenleap-plugin-data.json`.
- Workspace sessions you save: `zenleap-sessions/`. These contain the titles and URLs of the saved tabs. Tabs from private windows are never saved.
- Settings exports: only where you save them.

## Plugins

Plugins (`chrome/zenleap-plugins/<id>/plugin.js`) run with full browser privileges, the same as ZenLeap itself; ZenLeap does not sandbox what they can access. A newly found plugin stays disabled until you enable it in the Plugin Manager ("Manage Plugins" in the command palette), and a disabled plugin's code is not run. Plugins can make network requests of their own (for example the Readwise Reader example talks to Readwise). `install-plugin.sh` only copies a plugin folder; review a plugin before enabling it.

## Network Access

ZenLeap itself only contacts GitHub, and sends no data:

- **Update check**: `api.github.com/repos/yashas-salankimatt/ZenLeap/releases/latest` for the latest release tag (automatically, at most as often as set in Settings > Advanced > Updates, or on "Check for Updates").
- **Changelog**: `CHANGELOG.md` from the repository, shown in the update dialog.
- **Self-update** (fx-autoconfig installs, only when you confirm): `JS/zenleap.uc.js` and `CHECKSUMS.sha256` of that release tag from `raw.githubusercontent.com`. The file is installed only if its SHA-256 matches the release's `CHECKSUMS.sha256` and its version matches the tag; it is written atomically and the previous version is kept as a backup. Installs managed by Sine are updated by Sine instead.

The installers (`install.sh`, `install.ps1`, ZenLeap Manager) download the same verified release files, and fx-autoconfig from a pinned commit whose files are checked against SHA-256 hashes in the installer. They never run `sudo` by themselves, never close or kill Zen, and only change files in the profiles you select (plus fx-autoconfig's two files in Zen's installation directory, when they are missing).

**Limitation:** the checksum is published in the same GitHub repository as the code. It protects against corrupted, truncated or mismatched downloads, but not against a compromise of the repository or the maintainer's GitHub account. Signed releases are planned.

## Third-Party Code

ZenLeap has no third-party runtime dependencies. It relies on a script loader you install separately: [fx-autoconfig](https://github.com/MrOtherGuy/fx-autoconfig) (set up by the installers) or [Sine](https://github.com/CosmoCreeper/Sine).

See also the [Privacy section](README.md#privacy) of the README.
