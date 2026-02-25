# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| 3.x     | Yes       |
| < 3.0   | No        |

## Reporting a Vulnerability

If you discover a security vulnerability in ZenLeap, please report it responsibly:

1. **Do not** open a public GitHub issue for security vulnerabilities
2. Email the maintainer or send a private message via GitHub
3. Include a description of the vulnerability and steps to reproduce it
4. Allow reasonable time for a fix before public disclosure

## Security Model

ZenLeap runs as a userscript in the browser chrome context (via fx-autoconfig or Sine). This means it has the same privileges as any browser UI code. The script:

- Executes only in the main browser window (`chrome://browser/content/browser.xhtml`)
- Does not inject code into web content pages
- Does not intercept or modify web traffic
- Does not access or store passwords, cookies, or browsing history
- Stores all settings locally in the browser's preference system (`about:config`)

## Third-Party Code

ZenLeap has no third-party runtime dependencies. The plugin system loads user-installed plugins from the local filesystem only.

## Network Access

ZenLeap makes network requests only for:

- **Update checking** — fetches `zenleap.uc.js` from the GitHub repository to compare version numbers
- **Self-updating** — downloads new versions from the GitHub repository when the user initiates an update

No data is sent to any server. See the [Privacy section](README.md#privacy) in the README for details.
