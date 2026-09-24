# Releasing ZenLeap

A release is a commit on `main` tagged `vX.Y.Z` plus a GitHub release for that tag.

## `main` is a release channel

Several things read the files of a release, and two of them read the **`main` branch**, not a tag:

| What | Where it looks |
|------|----------------|
| In-browser updater of 3.5 and later (fx-autoconfig installs) | `releases/latest` → `tag_name`, then `raw.githubusercontent.com/…/<tag>/JS/zenleap.uc.js` and `<tag>/CHECKSUMS.sha256`. It installs only if the file's SHA-256 matches `CHECKSUMS.sha256` and its `@version` equals the tag. The update dialog shows that version's `CHANGELOG.md` section. |
| In-browser updater of **3.4.0 and older** (every fx-autoconfig install that has not updated yet) | **`main/JS/zenleap.uc.js`**: when its `@version` is higher than the running one, it installs **whatever is on `main`**, unverified, and appends `main/chrome.css` to `userChrome.css`. Tags play no part. |
| Sine (installed copies) | `theme.json` from **`main`**; when its `updatedAt` is later than the installed copy's, Sine downloads the **`main` branch** as a zip. `version` is only displayed. |
| Sine (new installs) | The **`main` branch** as a zip. |
| `install.sh --remote`, `curl … \| bash`, `install.ps1` via `irm … \| iex`, ZenLeap Manager.app | `releases/latest` and the tag, with the same SHA-256 and version checks as the new updater. If a release fails them, they install nothing and tell the user to install from a clone. |
| ZenLeap Manager.app (the download) | The `ZenLeap-Manager-vX.Y.Z-macos.zip` asset of the release. |
| Installing from a clone (`./install.sh`, `install.ps1` next to `JS/`) | The files of that checkout; no release is involved. |

So **whatever is on `main` goes out to Sine users and to everyone still on 3.4.0 or older at their next update check**, as if it were a release. Hence:

- `main` must always be exactly the last release. Develop on other branches; `@version`, `const VERSION` and `theme.json` `version`/`updatedAt` change only in the release commit (`scripts/release.sh` does it).
- **Merging to `main` is releasing.** The merge to `main` and the release tag go out in **one push**, and the GitHub release (with the Manager zip) is published right after it, following the steps below. A merge pushed on its own ships unreleased code to Sine and legacy-updater users while the installers still install the previous release; a tag or release without `main` moves the installers and the new updater on while Sine and legacy-updater users stay behind, and `main` no longer equals the last release.
- Never push a new `updatedAt` to `main` without releasing it, and never let it go backwards: Sine only offers an `updatedAt` later than the installed copy's (`release.sh` and `check-release.sh` enforce this).

`CHECKSUMS.sha256` uses `sha256sum` output format (`<hex>  JS/zenleap.uc.js`) and is committed in the
tagged commit, so it describes exactly the bytes that `raw.githubusercontent.com` serves for that tag.
`.gitattributes` keeps `JS/zenleap.uc.js` LF-only so a Windows checkout cannot change those bytes.

**First release after the Zen 1.22 polish work:** v3.4.0's committed `CHECKSUMS.sha256` does not match
its `zenleap.uc.js`, so the new installers refuse v3.4.0 (and print the clone instructions). Merge that
work to `main` only as part of the next release, following the steps below.

## Steps

1. **Release branch.** Start from the branch that has everything for the release (not from `main`),
   e.g. `git checkout -b release/vX.Y.Z`.

2. **Changelog.** Add a `## [X.Y.Z] - YYYY-MM-DD` section at the top of `CHANGELOG.md`
   (and a row in the "Version History Summary" table).

3. **Bump everything at once:**

   ```bash
   scripts/release.sh X.Y.Z --package
   ```

   This sets `// @version` and `const VERSION` in `JS/zenleap.uc.js`, `version` and `updatedAt`
   (now, UTC) in `theme.json`, the version in `ZenLeap Manager.app/Contents/Info.plist`, regenerates
   `CHECKSUMS.sha256`, builds `dist/ZenLeap-Manager-vX.Y.Z-macos.zip` and runs
   `scripts/check-release.sh X.Y.Z`. Fix anything it reports. It refuses a version that is already
   tagged and an `updatedAt` that is not later than the current one and the last release's, and it
   writes nothing if any edit fails. After a later change to `JS/zenleap.uc.js`, run
   `scripts/release.sh --checksums`, or rerun the whole command (a rerun keeps `updatedAt`).

4. **Test.** The tests are offline and never touch your real profiles or browsers. They need GNU
   coreutils and GNU sed (Linux, or on macOS `brew install coreutils gnu-sed` with their `gnubin`
   folders first in `PATH`); `release.sh` and `check-release.sh` themselves are portable.

   ```bash
   scripts/tests/test-installers.sh                      # install.sh, install-plugin.sh, clean-legacy-css.sh
   TEST_BASH=/path/to/bash-3.2 scripts/tests/test-installers.sh   # macOS /bin/bash compatibility
   TEST_BASH=/path/to/bash-3.2 scripts/tests/test-manager.sh      # ZenLeap Manager.app logic
   PWSH=/path/to/pwsh scripts/tests/test-install-ps1.sh  # install.ps1 (PowerShell 7 on any OS)
   scripts/tests/test-release.sh                         # release.sh and check-release.sh
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

5. **Commit** `Release vX.Y.Z` with `JS/zenleap.uc.js`, `theme.json`, `CHECKSUMS.sha256`,
   `ZenLeap Manager.app/Contents/Info.plist` and `CHANGELOG.md`.

6. **Prepare the GitHub release as a draft** (nothing is public yet: drafts are invisible to users,
   to `releases/latest` and to every updater, and creating one does not create the tag):

   ```bash
   gh release create vX.Y.Z --draft --target main --title vX.Y.Z --notes-file <the CHANGELOG section> \
       dist/ZenLeap-Manager-vX.Y.Z-macos.zip
   ```

   The notes and the Manager zip are uploaded now, so a failed upload is found before anything ships
   and publishing later is one quick command.

7. **Put the release commit on `main` locally and tag it.** `main` must end up on the tagged commit:

   ```bash
   git checkout main
   git pull --ff-only origin main
   git merge --ff-only release/vX.Y.Z      # main is the last release, so this fast-forwards
   git tag vX.Y.Z
   scripts/check-release.sh vX.Y.Z
   ```

   If the merge does not fast-forward, `main` has commits the release branch lacks: merge `main`
   into the release branch and start again at step 3 (delete the draft or update its zip).

8. **Push `main` and the tag in one push:**

   ```bash
   git push --atomic origin main vX.Y.Z
   ```

   `--atomic` makes GitHub take both refs or neither, so `main` never points at a commit without its
   tag. From this moment Sine users and 3.4.0-or-older installs update to the release. If the push is
   rejected, nothing changed on GitHub: fix the cause and push again.

9. **Publish the draft immediately** (it takes the tag you just pushed; `--verify-tag` refuses if the
   tag did not arrive):

   ```bash
   gh release edit vX.Y.Z --draft=false --latest --verify-tag
   ```

   Now the installers, the Manager download and the new updater see the release too. In the seconds
   between steps 8 and 9 they still see the previous release, which is harmless. If publishing fails,
   run the command again; do not push anything else to `main` meanwhile.

10. **Check** that it is live: `./install.sh check` shows vX.Y.Z as the latest version, and
    `curl -fsSL https://raw.githubusercontent.com/yashas-salankimatt/ZenLeap/vX.Y.Z/CHECKSUMS.sha256`
    prints the same hash as `sha256sum JS/zenleap.uc.js`.

Do not edit the files of an existing tag: release a new version instead. After the release, keep
developing on a branch; `main` only moves again with the next release.

## Other files to keep in step

- `scripts/lib/zen-paths.sh` is embedded in `install.sh` and the Manager. After editing it run
  `scripts/sync-lib.sh`; `check-release.sh` fails on stale copies.
- The fx-autoconfig commit and file hashes, and the hashes of fx-autoconfig's example files, are
  pinned in `scripts/lib/zen-paths.sh` and `install.ps1` (and the fx-autoconfig pin in the ZenRipple
  installer, which should use the same one). To move to a newer fx-autoconfig, test it in Zen, then
  update the ref, version and hashes in both files
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
