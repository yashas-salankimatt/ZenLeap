# Releasing ZenLeap

A release is a commit on `main` tagged `vX.Y.Z` plus a GitHub release for that tag.
Several things read the version and the files of a release, so they all have to agree:

| What | Where it looks |
|------|----------------|
| In-browser updater (fx-autoconfig installs) | `releases/latest` → `tag_name`, then `raw.githubusercontent.com/…/<tag>/JS/zenleap.uc.js` and `<tag>/CHECKSUMS.sha256`. It installs only if the file's SHA-256 matches `CHECKSUMS.sha256` and its `@version` equals the tag. The update dialog shows that version's `CHANGELOG.md` section. |
| `install.sh --remote`, `curl … \| bash`, `install.ps1` via `irm … \| iex`, ZenLeap Manager.app | Same: latest release tag, same SHA-256 and version checks. They refuse a release without a matching `CHECKSUMS.sha256` entry. |
| Sine | Fetches `theme.json` from the default branch and updates when `updatedAt` is newer than the installed copy's, then downloads the **default branch** as a zip. `version` is only displayed. |
| ZenLeap Manager.app (the download) | The `ZenLeap-Manager-vX.Y.Z-macos.zip` asset of the release. |

`CHECKSUMS.sha256` uses `sha256sum` output format (`<hex>  JS/zenleap.uc.js`) and is committed in the
tagged commit, so it describes exactly the bytes that `raw.githubusercontent.com` serves for that tag.
`.gitattributes` keeps `JS/zenleap.uc.js` LF-only so a Windows checkout cannot change those bytes.

## Steps

1. **Changelog.** Add a `## [X.Y.Z] - YYYY-MM-DD` section at the top of `CHANGELOG.md`
   (and a row in the "Version History Summary" table).

2. **Bump everything at once:**

   ```bash
   scripts/release.sh X.Y.Z --package
   ```

   This sets `// @version` and `const VERSION` in `JS/zenleap.uc.js`, `version` and `updatedAt`
   (now, UTC) in `theme.json`, the version in `ZenLeap Manager.app/Contents/Info.plist`, regenerates
   `CHECKSUMS.sha256`, builds `dist/ZenLeap-Manager-vX.Y.Z-macos.zip` and runs
   `scripts/check-release.sh X.Y.Z`. Fix anything it reports. After a later change to
   `JS/zenleap.uc.js`, run `scripts/release.sh --checksums` (or rerun the whole command).

3. **Test** (all offline; they never touch your real profiles or browsers):

   ```bash
   scripts/tests/test-installers.sh                      # install.sh, install-plugin.sh, clean-legacy-css.sh
   TEST_BASH=/path/to/bash-3.2 scripts/tests/test-installers.sh   # macOS /bin/bash compatibility
   TEST_BASH=/path/to/bash-3.2 scripts/tests/test-manager.sh      # ZenLeap Manager.app logic
   PWSH=/path/to/pwsh scripts/tests/test-install-ps1.sh  # install.ps1 (PowerShell 7 on any OS)
   ```

   `install.ps1` must stay Windows PowerShell 5.1 compatible. With PSScriptAnalyzer installed:

   ```powershell
   $p = @('win-48_x64_10.0.17763.0_5.1.17763.316_x64_4.0.30319.42000_framework')
   Invoke-ScriptAnalyzer -Path install.ps1 -Settings @{
       IncludeRules = @('PSUseCompatibleCommands', 'PSUseCompatibleSyntax', 'PSUseCompatibleTypes')
       Rules = @{ PSUseCompatibleCommands = @{ Enable = $true; TargetProfiles = $p }
                  PSUseCompatibleTypes = @{ Enable = $true; TargetProfiles = $p }
                  PSUseCompatibleSyntax = @{ Enable = $true; TargetVersions = @('5.1') } } }
   ```

   Also load the new `JS/zenleap.uc.js` in a real Zen (the oldest supported version and the
   current one, see README "Requirements").

4. **Commit** `Release vX.Y.Z` with `JS/zenleap.uc.js`, `theme.json`, `CHECKSUMS.sha256`,
   `ZenLeap Manager.app/Contents/Info.plist` and `CHANGELOG.md`.

5. **Tag and push together**, then publish the GitHub release right away:

   ```bash
   git tag vX.Y.Z
   git push origin main vX.Y.Z
   gh release create vX.Y.Z --title vX.Y.Z --notes-file <the CHANGELOG section> --latest \
       dist/ZenLeap-Manager-vX.Y.Z-macos.zip
   ```

   Order matters. Sine users update from `main` as soon as the new `theme.json` is pushed, and
   the updater and installers only see the new version once the release is published, so do
   not push a new `updatedAt` to `main` without releasing it. Do not edit files of an existing
   tag: re-release with a new version instead.

## Other files to keep in step

- `scripts/lib/zen-paths.sh` is embedded in `install.sh` and the Manager. After editing it run
  `scripts/sync-lib.sh`; `check-release.sh` fails on stale copies.
- The fx-autoconfig commit and file hashes are pinned in `scripts/lib/zen-paths.sh` and
  `install.ps1` (and in the ZenRipple installer, which should use the same pin). To move to a
  newer fx-autoconfig, test it in Zen, then update the ref, version and hashes in both files
  (`sha256sum program/config.js program/defaults/pref/config-prefs.js profile/chrome/utils/*`
  in its checkout); `check-release.sh` compares the two.
- The supported Zen range (`ZEN_MIN_VERSION` / `ZEN_TESTED_VERSION` in `install.sh`,
  `$ZenMinVersion` / `$ZenTestedVersion` in `install.ps1`, README "Requirements") and the
  script's own minimum-version warning should move together.

## Not done yet

Updates are checked against a SHA-256 published in the same repository. That catches corrupted,
truncated or mismatched downloads, but not a compromised GitHub account or repository. Signing
releases (e.g. an Ed25519 key whose public half is embedded in `zenleap.uc.js`, verified with
WebCrypto before installing) is planned.
