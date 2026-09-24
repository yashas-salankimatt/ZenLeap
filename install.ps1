<#
.SYNOPSIS
    ZenLeap Installer for Windows
.DESCRIPTION
    Installs fx-autoconfig and ZenLeap for Zen Browser on Windows.

    One-liner (installs the latest release: updates the profiles that already
    have ZenLeap, else installs into the profile Zen opens by default):
        irm https://raw.githubusercontent.com/yashas-salankimatt/ZenLeap/main/install.ps1 | iex

    One-liner with options:
        & ([scriptblock]::Create((irm https://raw.githubusercontent.com/yashas-salankimatt/ZenLeap/main/install.ps1))) -Action uninstall

    Or download the script first:
        irm https://raw.githubusercontent.com/yashas-salankimatt/ZenLeap/main/install.ps1 -OutFile install.ps1
        powershell -ExecutionPolicy Bypass -File install.ps1 -Action uninstall

    Zen loads ZenLeap when it starts. The installer never closes Zen for you:
    quit Zen first, or restart it afterwards.

    The parameters are used by their short names (-Action, -Profile,
    -AllProfiles, -ProfileDir, -ZenPath, -Loader, -Remote, -Yes,
    -RemoveFxAutoconfig); the ZL-prefixed names only keep `irm | iex` from
    touching variables of the same name in your session.
.PARAMETER ZLAction
    -Action: install (default), uninstall, or check.
.PARAMETER ZLProfile
    -Profile: profile(s) to use: numbers from the list ("2" or "1,3"; 1 is the
    profile Zen opens by default), a profile or directory name, or "all".
    Several: -Profile 1,"Work". Default: the profiles that already have ZenLeap,
    else the profile Zen opens by default (interactive runs show the list first).
.PARAMETER ZLAllProfiles
    -AllProfiles: same as -Profile all.
.PARAMETER ZLProfileDir
    -ProfileDir: use this profile directory directly (several allowed).
.PARAMETER ZLZenPath
    -ZenPath: Zen Browser installation directory (the folder containing zen.exe).
    Default: the one that last ran the profile, else a standard location.
.PARAMETER ZLLoader
    -Loader: auto (default); fx-autoconfig installs into chrome\JS even where Sine
    manages ZenLeap or seems to be in charge; sine only updates the copies of
    ZenLeap that Sine manages (also with -Yes).
.PARAMETER ZLRemote
    -Remote: install the latest release from GitHub (verified against the
    release's CHECKSUMS.sha256) even when the script sits in a ZenLeap checkout.
.PARAMETER ZLYes
    -Yes: don't ask questions (non-interactive mode). Copies of ZenLeap that
    Sine manages are then left to Sine.
.PARAMETER ZLRemoveFxAutoconfig
    -RemoveFxAutoconfig: also remove fx-autoconfig when uninstalling (it is kept
    where other scripts still use it).
.NOTES
    fx-autoconfig is installed from a tested commit and verified with SHA-256.
    An existing fx-autoconfig (e.g. from ZenRipple) is kept; interactive runs
    offer to update a loader older than the tested one. Environment variables
    FX_AUTOCONFIG_DIR (local checkout) or FX_AUTOCONFIG_REF (another commit)
    select a different, unverified fx-autoconfig.

    Exit status (when run as a file): 0 installed (the summary says if a step
    is left for you); 1 error or cancelled; 2 nothing installed (every selected
    profile was skipped). Under `irm | iex` it is in $LASTEXITCODE instead.
#>
#Requires -Version 5.1
# (#Requires below the help block: in front of it, Get-Help ignores the help.)
[CmdletBinding()]
param(
    # Unique names with the public names as aliases: under `irm | iex` this
    # param block runs in the caller's scope, so $Yes, $Action, ... would
    # overwrite the caller's own variables ($Profile would hide $PROFILE).
    [Alias('Action')] [ValidateSet("install", "uninstall", "check")] [string]$ZLAction = "install",
    [Alias('Profile')] [string[]]$ZLProfile = @(),
    [Alias('AllProfiles')] [switch]$ZLAllProfiles,
    [Alias('ProfileDir')] [string[]]$ZLProfileDir = @(),
    [Alias('ZenPath')] [string]$ZLZenPath = "",
    [Alias('Loader')] [ValidateSet("auto", "fx-autoconfig", "sine")] [string]$ZLLoader = "auto",
    [Alias('Remote')] [switch]$ZLRemote,
    [Alias('Yes')] [switch]$ZLYes,
    [Alias('RemoveFxAutoconfig')] [switch]$ZLRemoveFxAutoconfig
)

# Everything runs inside this script block, so that `irm | iex` leaves no
# functions, variables or preference changes behind in the caller's session
# and never closes it (there is no `exit` in here).
$__zenleapExitCode = & {
param([string]$Action, [string[]]$ProfileSpecs, [bool]$AllProfiles, [string[]]$ProfileDirs, [string]$ZenPath,
      [string]$Loader, [bool]$Remote, [bool]$Yes, [bool]$RemoveFxAutoconfig, [string]$ScriptDir)

$ErrorActionPreference = "Stop"

# --- Configuration ---
$GitHubRepo       = "yashas-salankimatt/ZenLeap"
$RawBase          = "https://raw.githubusercontent.com/$GitHubRepo"
$InstallerUrl     = "$RawBase/main/install.ps1"
$SineModId        = "zenleap-relative-tab-nav"
$ZenMinVersion    = "1.21.7b"   # oldest Zen release ZenLeap supports
$ZenTestedVersion = "1.22.3b"

# fx-autoconfig commit tested with Zen 1.22.3b (Firefox 156; loader 0.10.16). The
# files we copy are checked against these hashes (same pin as install.sh, the
# macOS manager and the ZenRipple installer; scripts/check-release.sh compares them).
$FxPinnedRef     = "dfdab5684faffc112b76ccb1d8cab7f75da0102c"
$FxPinnedVersion = "0.10.16"
$FxPinnedSha256  = @"
80dc421264a3ea04275e1724b7b57234f89254e9582a6c17e9a911b65c3aa6d7  program/config.js
6bfd2ed139d18ff5178e0fc62a3b4058540ddbeba3adc912c0d69edb70c17ece  program/defaults/pref/config-prefs.js
1f0b37d765c7b10b963a465a62a420059e334a18b6b48bd8c09059837e676106  profile/chrome/utils/boot.sys.mjs
d80557b7bdd46f91f0d249f25f1bf66ed83f8c9e620cd0c9334029e4826924d0  profile/chrome/utils/chrome.manifest
1d6302c5484dc914e43685740937f1d89908099f835e53f532338822c31b08af  profile/chrome/utils/fs.sys.mjs
e7fca8757159751df080e5cbfcd27b508d98c5cdfd6434ea14247832418d1f63  profile/chrome/utils/module_loader.mjs
dc7547aecbaac67da94b54e353f8e306a0ca01b2a461e106cc88c63a2e210cac  profile/chrome/utils/uc_api.sys.mjs
3fb7c9799864ee01428722939f324acea1e6065cb63a9298e7bbc59e5adbd96a  profile/chrome/utils/utils.sys.mjs
"@
# fx-autoconfig's example files (unchanged since 2024). Installers up to 3.4
# copied them into every profile; test.uc.js logs "Hi mom, I'm loaded!" in every
# window. Only byte-identical copies are offered for removal.
$FxExamplesSha256 = @"
de6ddbef85afd6b68ffa66243ffe802bd16f31db36fbb8c78f122c99f54516e4  profile/chrome/JS/test.uc.js
1abbcad61de45c1507a286098db059d8cb3fe7ca63fb514d7f71a16e9914b4ff  profile/chrome/JS/userChrome_ag_css.sys.mjs
09543f005ec2aa9ffe68063aa3a3375d0bcef7892bde1244dc917b0e40ba1019  profile/chrome/JS/userChrome_au_css.uc.js
6b6d576dd8c2e3ac79f02a9ef1ebc8a8d3194a77dd9f6ee7fdf75b5e3dc50f0c  profile/chrome/CSS/agent_style.uc.css
fd0925fdbae19e3c3503ec0e2624bfeadbf63b08d4cb1e7000e899b158c393c5  profile/chrome/CSS/author_style.uc.css
6a22fa309f93b22a82b22d06135d69d85c6e782f84fad510bdb7ff46d79ccbe1  profile/chrome/resources/userChrome.ag.css
23453d331dfaf7b0b01fc7a8d220e21bdedd568b48c2d26cb05a256704850f74  profile/chrome/resources/userChrome.au.css
"@
# $ScriptDir: this script's checkout. Empty when run through "irm | iex": then
# there are no local files, whatever the current directory contains.

# --- State ---
$ZL = @{
    WorkDir = $null
    FxSrc = $null
    FxVersion = $null
    FxVerified = $false
    FxFailed = $false
    FxError = $null
    FxProgramCommands = @()
    GreState = @{}          # Zen installation dir -> ok | pending | sine | foreign
    ZenNeedsRestart = $false
    ZenWasRunning = $false
    RunningDirs = @()       # profiles Zen still has open
    ReleaseErrorKind = $null
    PendingMsgs = @()       # why an installed copy won't load yet
}

# --- Helper functions ---
function Write-Status  { param([string]$Msg) Write-Host "[OK] $Msg" -ForegroundColor Green }
function Write-Warn    { param([string]$Msg) Write-Host "[!!] $Msg" -ForegroundColor Yellow }
function Write-Err     { param([string]$Msg) Write-Host "[ERR] $Msg" -ForegroundColor Red }
function Write-Info    { param([string]$Msg) Write-Host "  $Msg" -ForegroundColor Cyan }

# End the installer with an exit code. Under "irm | iex" a plain exit would
# close the user's PowerShell window, so this unwinds to the bottom of the script.
function Stop-Installer {
    param([int]$Code = 1)
    throw (New-Object System.OperationCanceledException "ZenLeapExit:$Code")
}

function Get-Version {
    param([string]$FilePath)
    if ($FilePath -and (Test-Path -LiteralPath $FilePath)) {
        $content = Get-Content -LiteralPath $FilePath -Raw
        if ($content -match '@version\s+([\d.]+)') {
            return $Matches[1]
        }
    }
    return $null
}

function Compare-Versions {
    param([string]$v1, [string]$v2)
    $parts1 = @($v1.Split('.') | ForEach-Object { if ($_ -match '^\d+') { [int]$Matches[0] } else { 0 } })
    $parts2 = @($v2.Split('.') | ForEach-Object { if ($_ -match '^\d+') { [int]$Matches[0] } else { 0 } })
    $max = [Math]::Max($parts1.Count, $parts2.Count)
    for ($i = 0; $i -lt $max; $i++) {
        $a = $(if ($i -lt $parts1.Count) { $parts1[$i] } else { 0 })
        $b = $(if ($i -lt $parts2.Count) { $parts2[$i] } else { 0 })
        if ($a -gt $b) { return 1 }
        if ($a -lt $b) { return -1 }
    }
    return 0
}

function Confirm-Action {
    param([string]$Prompt, [bool]$DefaultYes = $false)
    if ($Yes) { return $true }
    $hint = $(if ($DefaultYes) { "Y/n" } else { "y/n" })
    $response = Read-Host "$Prompt ($hint)"
    if ($response -eq '') { return $DefaultYes }
    return ($response -eq 'y' -or $response -eq 'Y' -or $response -eq 'yes')
}

# Ask even with -Yes (only for things -Yes must never decide on its own); with
# -Yes the answer is no
function Confirm-Explicitly {
    param([string]$Prompt)
    if ($Yes) { return $false }
    $response = Read-Host "$Prompt (y/N)"
    return ($response -eq 'y' -or $response -eq 'Y' -or $response -eq 'yes')
}

# A PowerShell single-quoted literal
function ConvertTo-Literal {
    param([string]$Value)
    return "'" + ($Value -replace "'", "''") + "'"
}

function Get-WorkDir {
    if (-not $ZL.WorkDir) {
        $ZL.WorkDir = Join-Path ([IO.Path]::GetTempPath()) "zenleap-install-$(Get-Random)"
        New-Item -Path $ZL.WorkDir -ItemType Directory -Force | Out-Null
    }
    return $ZL.WorkDir
}

# Run PowerShell commands elevated (UAC prompt). Returns $true on success.
function Invoke-Elevated {
    param([string]$Command)
    try {
        $encoded = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($Command))
        $proc = Start-Process -FilePath "powershell.exe" -Verb RunAs -Wait -PassThru `
            -ArgumentList "-NoProfile -ExecutionPolicy Bypass -EncodedCommand $encoded"
        return ($proc.ExitCode -eq 0)
    } catch {
        return $false
    }
}

# --- Detection ---
# A Zen installation directory: where fx-autoconfig's config.js goes
function Test-ZenDir {
    param([string]$Dir)
    if (-not $Dir) { return $false }
    foreach ($f in @("zen.exe", "omni.ja", "application.ini")) {
        if (Test-Path -LiteralPath (Join-Path $Dir $f)) { return $true }
    }
    return $false
}

function Find-ZenInstall {
    if ($ZenPath) {
        if (-not (Test-Path -LiteralPath $ZenPath -PathType Container)) {
            Write-Err "Directory not found: $ZenPath"
            Stop-Installer 1
        }
        $dir = (Resolve-Path -LiteralPath $ZenPath).ProviderPath
        if (-not (Test-ZenDir $dir)) {
            # A typo must not get fx-autoconfig's config.js
            Write-Warn "$dir does not look like a Zen installation directory (no zen.exe, omni.ja or application.ini)."
            Write-Info "It is the folder that contains zen.exe: about:support > Application Binary shows it."
            if ($Yes -or -not (Confirm-Explicitly "  Use it anyway?")) {
                Write-Err "Not putting fx-autoconfig into it; check -ZenPath."
                Stop-Installer 1
            }
        }
        return $dir
    }

    # Check common install paths
    $candidates = @()
    $bases = @($env:ProgramFiles, ${env:ProgramFiles(x86)})
    if ($env:LOCALAPPDATA) { $bases += @($env:LOCALAPPDATA, (Join-Path $env:LOCALAPPDATA "Programs")) }
    foreach ($base in $bases) {
        if ($base) {
            $candidates += (Join-Path $base "Zen Browser")
            $candidates += (Join-Path $base "Zen")
        }
    }
    foreach ($path in $candidates) {
        if (Test-Path -LiteralPath (Join-Path $path "zen.exe")) {
            return $path
        }
    }

    # Check registry
    $regPaths = @(
        "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\zen.exe",
        "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\zen.exe",
        "HKLM:\SOFTWARE\Zen Browser",
        "HKCU:\SOFTWARE\Zen Browser"
    )
    foreach ($regPath in $regPaths) {
        try {
            $val = (Get-ItemProperty -Path $regPath -ErrorAction SilentlyContinue).'(Default)'
            if ($val) {
                $val = $val.Trim('"')
                if (Test-Path -LiteralPath (Split-Path $val -Parent)) {
                    return Split-Path $val -Parent
                }
            }
        } catch {}
    }

    return $null
}

# Parse an INI file into a list of @{ Name; Values } sections, the way Firefox's
# INI parser reads it: leading blanks and ';'/'#' comment lines are skipped, and
# keys under a malformed section header ("[Profile1]x", "[Profile1") are ignored.
function Read-IniSections {
    param([string]$Path)
    $sections = New-Object System.Collections.ArrayList
    $current = $null
    foreach ($line in [IO.File]::ReadAllLines($Path)) {
        $l = $line.TrimStart(" ", "`t")
        if ($l -eq '' -or $l.StartsWith(';') -or $l.StartsWith('#')) { continue }
        if ($l.StartsWith('[')) {
            $current = $null
            if ($l -match '^\[([^\]]*)\][ \t]*$') {
                $current = [pscustomobject]@{ Name = $Matches[1]; Values = @{} }
                [void]$sections.Add($current)
            }
        } elseif ($current -and $l -match '^([^=]+)=(.*)$') {
            $current.Values[$Matches[1]] = $Matches[2]
        }
    }
    return ,$sections
}

function Join-ProfilePath {
    param([string]$Base, [string]$Relative)
    return [IO.Path]::GetFullPath([IO.Path]::Combine($Base, $Relative))
}

# The candidate that was used most recently (newest prefs.js); ties keep the first
function Select-Newest {
    param($Candidates)
    $best = $null
    $bestTime = [datetime]::MinValue
    foreach ($c in $Candidates) {
        $prefs = Join-Path $c.Dir "prefs.js"
        $t = [datetime]::MinValue
        if (Test-Path -LiteralPath $prefs) { $t = (Get-Item -LiteralPath $prefs).LastWriteTimeUtc }
        if ($null -eq $best -or $t -gt $bestTime) {
            $best = $c
            $bestTime = $t
        }
    }
    return $best
}

# Zen keeps profiles in %APPDATA%\zen (profiles.ini, Profiles\...) and their
# local data (startupCache) in %LOCALAPPDATA%\zen\Profiles\... profiles.ini is
# read like Firefox does: [Profile0], [Profile1], ... up to the first missing
# section or one without IsRelative; entries without Name or Path are skipped.
# The default profile (the install's [Install*]/installs.ini Default=, else
# Default=1, else the most recently used) is listed first.
# Returns @{ Root; Profiles; Default } or $null.
function Find-ZenProfiles {
    param([string]$ZenDir)
    if (-not $env:APPDATA -or -not $env:LOCALAPPDATA) { return $null }
    $localRoot = Join-Path $env:LOCALAPPDATA "zen"
    $all = New-Object System.Collections.ArrayList
    $primaryRoot = $null
    $default = -1
    $roots = @((Join-Path $env:APPDATA "zen"), (Join-Path $env:APPDATA "Zen Browser"))

    foreach ($root in $roots) {
        $ini = Join-Path $root "profiles.ini"
        if (-not (Test-Path -LiteralPath $ini)) { continue }
        $byNumber = @{}
        $installDefaults = New-Object System.Collections.ArrayList
        foreach ($s in (Read-IniSections $ini)) {
            if ($s.Name -match '^Profile(\d+)$' -and "Profile$([int]$Matches[1])" -eq $s.Name) {
                $byNumber[[int]$Matches[1]] = $s.Values
            } elseif ($s.Name -ne 'General' -and $s.Name -ne 'BackgroundTasksProfiles' -and $s.Values['Default']) {
                [void]$installDefaults.Add($s.Values['Default'])   # [Install<hash>]
            }
        }
        $installsIni = Join-Path $root "installs.ini"
        if (Test-Path -LiteralPath $installsIni) {
            foreach ($s in (Read-IniSections $installsIni)) {
                if ($s.Values['Default']) { [void]$installDefaults.Add($s.Values['Default']) }
            }
        }

        $candidates = New-Object System.Collections.ArrayList
        $n = 0
        while ($byNumber.ContainsKey($n) -and $byNumber[$n].ContainsKey('IsRelative')) {
            $v = $byNumber[$n]
            $n++
            if (-not $v['Path'] -or -not $v.ContainsKey('Name')) { continue }
            if ($v['IsRelative'] -eq '1') {
                $dir = Join-ProfilePath $root $v['Path']
                $local = Join-ProfilePath $localRoot $v['Path']
            } else {
                $dir = $v['Path'].TrimEnd('\', '/')
                $local = $dir
            }
            if (-not (Test-Path -LiteralPath $dir -PathType Container)) { continue }
            if (@($all | Where-Object { $_.Dir -eq $dir }).Count -gt 0) { continue }
            if (@($candidates | Where-Object { $_.Dir -eq $dir }).Count -gt 0) { continue }
            [void]$candidates.Add([pscustomobject]@{ Name = $v['Name']; Dir = $dir; LocalDir = $local; Root = $root; Flagged = ($v['Default'] -eq '1') })
        }
        if ($candidates.Count -eq 0) { continue }

        # Which listed profiles are an install's default?
        $inst = New-Object System.Collections.ArrayList
        foreach ($want in $installDefaults) {
            if ([IO.Path]::IsPathRooted($want)) { $full = $want.TrimEnd('\', '/') } else { $full = Join-ProfilePath $root $want }
            foreach ($c in $candidates) {
                if ($c.Dir -eq $full -and -not $inst.Contains($c)) { [void]$inst.Add($c) }
            }
        }
        $pick = $null
        if ($inst.Count -gt 1 -and $ZenDir) {
            foreach ($c in $inst) {
                $lp = Get-LastPlatformDir $c.Dir
                if ($lp -and $lp.TrimEnd('\', '/') -eq $ZenDir.TrimEnd('\', '/')) { $pick = $c; break }
            }
        }
        if (-not $pick) {
            if ($inst.Count -gt 0) {
                $pick = Select-Newest $inst
            } elseif (@($candidates | Where-Object { $_.Flagged }).Count -gt 0) {
                $pick = Select-Newest @($candidates | Where-Object { $_.Flagged })
            } else {
                $pick = Select-Newest $candidates
            }
        }

        # The default first, then the rest in profiles.ini order
        if (-not $primaryRoot) {
            $primaryRoot = $root
            $default = $all.Count
        }
        [void]$all.Add($pick)
        foreach ($c in $candidates) {
            if ($c -ne $pick) { [void]$all.Add($c) }
        }
    }

    if ($all.Count -eq 0) {
        # No usable profiles.ini: directories that look like profiles
        foreach ($root in $roots) {
            $base = Join-Path $root "Profiles"
            if (-not (Test-Path -LiteralPath $base)) { continue }
            foreach ($d in @(Get-ChildItem -LiteralPath $base -Directory)) {
                if ((Test-Path -LiteralPath (Join-Path $d.FullName "prefs.js")) -or (Test-Path -LiteralPath (Join-Path $d.FullName "times.json"))) {
                    [void]$all.Add([pscustomobject]@{ Name = $d.Name; Dir = $d.FullName; LocalDir = (Join-Path (Join-Path $localRoot "Profiles") $d.Name); Root = $root; Flagged = $false })
                }
            }
            if ($all.Count -gt 0) {
                $primaryRoot = $root
                $default = $all.IndexOf((Select-Newest $all))
                break
            }
        }
    }

    if ($all.Count -eq 0) { return $null }
    return @{ Root = $primaryRoot; Profiles = @($all); Default = $default }
}

# compatibility.ini LastPlatformDir of a profile: the Zen installation that last ran it
function Get-LastPlatformDir {
    param([string]$Dir)
    $compat = Join-Path $Dir "compatibility.ini"
    if (-not (Test-Path -LiteralPath $compat)) { return $null }
    $line = @([IO.File]::ReadAllLines($compat) | Where-Object { $_ -like 'LastPlatformDir=*' })[-1]
    if ($line) { return $line.Substring(16) }
    return $null
}

# The Zen installation a profile runs with: -ZenPath, else the one that last
# ran it (if still there), else the one found on this system
function Get-ProfileZenDir {
    param($P, [string]$Fallback)
    if ($ZenPath) { return $Fallback }
    $lp = Get-LastPlatformDir $P.Dir
    if ($lp -and (Test-ZenDir $lp)) {
        return $lp.TrimEnd('\', '/')
    }
    return $Fallback
}

function Get-ProfileLabel {
    param($Found, [int]$Index)
    $p = $Found.Profiles[$Index]
    $label = $p.Name
    $leaf = Split-Path $p.Dir -Leaf
    if ($leaf -ne $p.Name) { $label = "$label  [$leaf]" }
    if (-not $p.Root) {
        $label = "$label  ($($p.Dir))"
    } elseif ($p.Root -ne $Found.Root) {
        $label = "$label  (in $($p.Root))"
    }
    return $label
}

# True if a folder looks like a profile Zen has used
function Test-ProfileDir {
    param([string]$Dir)
    foreach ($f in @("prefs.js", "times.json", "compatibility.ini")) {
        if (Test-Path -LiteralPath (Join-Path $Dir $f)) { return $true }
    }
    return $false
}

function Get-SineZenLeapDir {
    param([string]$Dir)
    $d = Join-Path (Join-Path (Join-Path $Dir "chrome") "sine-mods") $SineModId
    if (Test-Path -LiteralPath (Join-Path (Join-Path $d "JS") "zenleap.uc.js")) { return $d }
    return $null
}

# Which loader runs a profile's scripts (the same rules as install.sh). What
# runs is decided by the Zen installation's config.js ($Status, see
# Get-ProgramStatus; "" if unknown) and the profile's chrome\utils:
#   fxac     fx-autoconfig runs chrome\JS (its loader is in chrome\utils, or
#            chrome\utils is empty: the installer adds it)
#   sine     Sine's bootloader, which only runs Sine mods (Zen's config.js is
#            Sine's, or chrome\utils is Sine's: its chrome.manifest maps sine-mods)
#   foreign  chrome\utils holds some other loader
# Sine can also run on top of fx-autoconfig (chrome\JS\sine.sys.mjs); that is
# "fxac" (chrome\JS scripts run too), see Test-SineActive.
function Get-ProfileLoader {
    param([string]$Dir, [string]$Status)
    $utils = Join-Path (Join-Path $Dir "chrome") "utils"
    if ($Status -eq "sine" -or $Status -eq "sine-noprefs") { return "sine" }
    if ((Test-Path -LiteralPath (Join-Path $utils "boot.sys.mjs")) -or (Test-Path -LiteralPath (Join-Path $utils "boot.jsm"))) { return "fxac" }
    if (-not (Test-Path -LiteralPath $utils) -or @(Get-ChildItem -LiteralPath $utils -Force).Count -eq 0) { return "fxac" }
    $manifest = Join-Path $utils "chrome.manifest"
    if ((Test-Path -LiteralPath $manifest) -and ([IO.File]::ReadAllText($manifest) -match 'sine-mods')) { return "sine" }
    return "foreign"
}

# True if Sine runs (or is set up to run) in a profile: through its bootloader,
# or through fx-autoconfig (chrome\JS\sine.sys.mjs; sine.uc.mjs in older Sine).
# A chrome\sine-mods folder alone is no evidence: it stays behind when Sine is removed.
function Test-SineActive {
    param([string]$Dir, [string]$Status)
    switch (Get-ProfileLoader $Dir $Status) {
        "sine" { return $true }
        "fxac" {
            $js = Join-Path (Join-Path $Dir "chrome") "JS"
            return ((Test-Path -LiteralPath (Join-Path $js "sine.sys.mjs")) -or (Test-Path -LiteralPath (Join-Path $js "sine.uc.mjs")))
        }
    }
    return $false
}

function Get-ZenLeapVersion {
    param([string]$Dir)
    $js = Join-Path (Join-Path (Join-Path $Dir "chrome") "JS") "zenleap.uc.js"
    if (Test-Path -LiteralPath $js) { return Get-Version $js }
    $sine = Get-SineZenLeapDir $Dir
    if ($sine) { return Get-Version (Join-Path (Join-Path $sine "JS") "zenleap.uc.js") }
    return $null
}

# fx-autoconfig example files in a profile that are byte-identical to
# fx-autoconfig's (see $FxExamplesSha256), as full paths
function Get-FxExampleFiles {
    param([string]$Dir)
    $found = @()
    foreach ($line in ($FxExamplesSha256 -split "`n")) {
        if ($line.Trim() -notmatch '^([0-9a-f]{64})\s+profile/chrome/(\S.*)$') { continue }
        $want = $Matches[1]
        $file = Join-Path (Join-Path $Dir "chrome") ($Matches[2] -replace '/', [IO.Path]::DirectorySeparatorChar)
        if ((Test-Path -LiteralPath $file -PathType Leaf) -and (Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash.ToLower() -eq $want) {
            $found += $file
        }
    }
    return $found
}

# Scripts in a profile's chrome\JS that need fx-autoconfig besides ZenLeap
# (e.g. ZenRipple); fx-autoconfig's own examples don't count
function Get-OtherScripts {
    param([string]$Dir)
    $js = Join-Path (Join-Path $Dir "chrome") "JS"
    if (-not (Test-Path -LiteralPath $js)) { return @() }
    $examples = @(Get-FxExampleFiles $Dir)
    $others = @()
    foreach ($f in @(Get-ChildItem -LiteralPath $js -File)) {
        if ($f.Name -notmatch '\.(uc\.js|uc\.mjs|sys\.mjs)$' -or $f.Name -eq 'zenleap.uc.js') { continue }
        if ($examples -contains $f.FullName) { continue }
        $others += $f.Name
    }
    return $others
}

# Folders next to the profiles that are not profiles but hold ZenLeap files
# (installers up to 3.4 treated every folder there as a profile). Looks in the
# roots of the profiles found; returns the leftover files (their chrome folder,
# and user.js when it holds nothing but the stylesheet pref they added).
function Get-LeftoverFiles {
    param($Found)
    $items = @()
    if (-not $Found) { return $items }
    $roots = @($Found.Profiles | Where-Object { $_.Root } | ForEach-Object { $_.Root } | Select-Object -Unique)
    foreach ($root in $roots) {
        foreach ($base in @($root, (Join-Path $root "Profiles"))) {
            if (-not (Test-Path -LiteralPath $base -PathType Container)) { continue }
            foreach ($d in @(Get-ChildItem -LiteralPath $base -Directory)) {
                $zl = Join-Path (Join-Path (Join-Path $d.FullName "chrome") "JS") "zenleap.uc.js"
                if (-not (Test-Path -LiteralPath $zl) -or (Test-ProfileDir $d.FullName)) { continue }
                if (@($Found.Profiles | Where-Object { $_.Dir -eq $d.FullName }).Count -gt 0) { continue }
                $items += (Join-Path $d.FullName "chrome")
                $userJs = Join-Path $d.FullName "user.js"
                if ((Test-Path -LiteralPath $userJs) -and -not @([IO.File]::ReadAllLines($userJs) | Where-Object { $_.Trim() -ne '' -and $_ -notmatch 'toolkit\.legacyUserProfileCustomizations\.stylesheets' }).Count) {
                    $items += $userJs
                }
            }
        }
    }
    return $items
}

# Resolve "all", "2", "1,3" or a profile name to indices; throws on error
function Resolve-ProfileSpec {
    param($Found, [string]$Spec)
    $n = $Found.Profiles.Count
    if ($Spec -eq 'all' -or $Spec -eq 'a' -or $Spec -eq '0') { return @(0..($n - 1)) }
    if ($Spec -match '^\s*\d+([\s,]+\d+)*\s*$') {
        $result = @()
        foreach ($tok in ($Spec -split '[\s,]+' | Where-Object { $_ -ne '' })) {
            $k = [int]$tok
            if ($k -lt 1 -or $k -gt $n) { throw "Invalid profile number $k (valid: 1-$n)" }
            if ($result -notcontains ($k - 1)) { $result += ($k - 1) }
        }
        return $result
    }
    $hits = @()
    for ($i = 0; $i -lt $n; $i++) {
        if ($Found.Profiles[$i].Name -eq $Spec) { $hits += $i }   # -eq is case-insensitive
    }
    if ($hits.Count -eq 0) {
        for ($i = 0; $i -lt $n; $i++) {
            if ((Split-Path $Found.Profiles[$i].Dir -Leaf) -eq $Spec) { $hits += $i }
        }
    }
    if ($hits.Count -eq 1) { return $hits }
    if ($hits.Count -gt 1) { throw "Several profiles are named ""$Spec""; use its number instead" }
    throw "No profile named ""$Spec"" (use a number from the list, a profile name, or ""all"")"
}

# The union of several specs (-Profile 1,"Work" or -Profile all); throws on error.
# "powershell -File install.ps1 -Profile 1,Work" passes the single string
# "1,Work": a spec that names no profile as a whole is split at its commas.
function Resolve-ProfileSpecs {
    param($Found, [string[]]$Specs)
    $result = @()
    foreach ($spec in $Specs) {
        try {
            $ks = @(Resolve-ProfileSpec $Found $spec)
        } catch {
            $parts = @($spec -split ',' | ForEach-Object { $_.Trim() } | Where-Object { $_ })
            if ($parts.Count -lt 2) { throw }
            $ks = @()
            foreach ($part in $parts) { $ks += @(Resolve-ProfileSpec $Found $part) }
        }
        foreach ($k in $ks) {
            if ($result -notcontains $k) { $result += $k }
        }
    }
    return $result
}

function Show-ProfileList {
    param($Found)
    for ($i = 0; $i -lt $Found.Profiles.Count; $i++) {
        $notes = @()
        if ($i -eq $Found.Default) { $notes += "default profile" }
        $v = Get-ZenLeapVersion $Found.Profiles[$i].Dir
        if ($v) { $notes += "ZenLeap $v" }
        $suffix = $(if ($notes.Count -gt 0) { "  - " + ($notes -join ", ") } else { "" })
        Write-Host ("  {0,2}) {1}{2}" -f ($i + 1), (Get-ProfileLabel $Found $i), $suffix)
    }
}

# Decide which profiles to work on. Returns an array of indices.
function Select-Profiles {
    param($Found, [string]$Mode)
    $n = $Found.Profiles.Count
    if ($AllProfiles) { return @(0..($n - 1)) }
    if ($ProfileSpecs.Count -gt 0) {
        try {
            return @(Resolve-ProfileSpecs $Found $ProfileSpecs)
        } catch {
            Write-Err $_.Exception.Message
            Show-ProfileList $Found
            Stop-Installer 1
        }
    }
    if ($Mode -eq 'check') { return @(0..($n - 1)) }

    # Profiles that already have ZenLeap; a first install goes into the profile
    # Zen opens by default
    $suggested = @()
    for ($i = 0; $i -lt $n; $i++) {
        if (Get-ZenLeapVersion $Found.Profiles[$i].Dir) { $suggested += $i }
    }
    if ($suggested.Count -eq 0 -and $Mode -eq 'install' -and $Found.Default -ge 0) { $suggested = @($Found.Default) }
    if ($Mode -eq 'install' -and $n -eq 1) { return @(0) }
    if ($Mode -eq 'uninstall' -and $suggested.Count -eq 0) { return @() }
    if ($Yes) {
        if ($suggested.Count -eq 0) {
            Write-Err "Found $n profiles and could not tell which one Zen uses. Pass -Profile <number|name|all>."
            Show-ProfileList $Found
            Stop-Installer 1
        }
        return $suggested
    }

    Write-Host ""
    Write-Host "Zen profiles (in $($Found.Root)):"
    Show-ProfileList $Found
    $enter = ($suggested | ForEach-Object { $_ + 1 }) -join ","
    while ($true) {
        if ($enter) {
            $ans = Read-Host "Select profile(s) - numbers, a name, ""all"" [Enter = $enter, q = quit]"
        } else {
            $ans = Read-Host "Select profile(s) - numbers, a name, ""all"" [q = quit]"
        }
        if ($ans -eq 'q' -or $ans -eq 'Q') {
            Write-Host "Cancelled."
            Stop-Installer 1
        }
        if ($ans -eq '' -and $enter) { return $suggested }
        if ($ans -ne '') {
            try {
                return @(Resolve-ProfileSpec $Found $ans)
            } catch {
                Write-Warn $_.Exception.Message
            }
        }
    }
}

# Zen holds <profile>\parent.lock open without sharing while it runs
function Test-ProfileInUse {
    param([string]$Dir)
    $lock = Join-Path $Dir "parent.lock"
    if (-not (Test-Path -LiteralPath $lock)) { return $false }
    try {
        $fs = [IO.File]::Open($lock, [IO.FileMode]::Open, [IO.FileAccess]::Read, [IO.FileShare]::None)
        $fs.Close()
        return $false
    } catch [System.IO.IOException] {
        return $true
    } catch {
        return $false
    }
}

# Zen loads ZenLeap at startup: ask the user to quit Zen. Never kill it.
function Wait-ZenClosed {
    param($Profiles)
    while ($true) {
        $running = @($Profiles | Where-Object { Test-ProfileInUse $_.Dir })
        $ZL.RunningDirs = @($running | ForEach-Object { $_.Dir })
        if ($running.Count -eq 0) { return }
        Write-Warn "Zen is running with: $(($running | ForEach-Object { $_.Name }) -join ', ')"
        if ($Yes) {
            Write-Info "Continuing; restart Zen afterwards so it loads the changes."
            $ZL.ZenNeedsRestart = $true
            return
        }
        $ans = Read-Host "  Quit Zen (Ctrl+Shift+Q), then press Enter. 's' = continue anyway (restart Zen later), 'q' = cancel"
        if ($ans -eq 'q' -or $ans -eq 'Q') {
            Write-Host "Cancelled."
            Stop-Installer 1
        }
        if ($ans -eq 's' -or $ans -eq 'S') {
            $ZL.ZenNeedsRestart = $true
            return
        }
        $ZL.ZenWasRunning = $true
    }
}

# --- Releases ---
function Get-LatestReleaseTag {
    $tag = ""
    try {
        $release = Invoke-RestMethod -Uri "https://api.github.com/repos/$GitHubRepo/releases/latest" -UseBasicParsing
        $tag = [string]$release.tag_name
    } catch {}
    if (-not $tag) {
        # API unavailable (e.g. rate-limited): follow the releases/latest redirect
        try {
            $resp = Invoke-WebRequest -Uri "https://github.com/$GitHubRepo/releases/latest" -UseBasicParsing
            $final = $null
            try { $final = $resp.BaseResponse.ResponseUri.AbsoluteUri } catch {}
            if (-not $final) { try { $final = $resp.BaseResponse.RequestMessage.RequestUri.AbsoluteUri } catch {} }
            if ($final -match '/releases/tag/([^/?#]+)$') { $tag = $Matches[1] }
        } catch {}
    }
    if ($tag -notmatch '^[A-Za-z0-9._-]+$') { return $null }
    return $tag
}

# Download release $Tag into $Dest and verify it: zenleap.uc.js must match the
# SHA-256 in the tag's CHECKSUMS.sha256 and carry the tag's version. Throws;
# $ZL.ReleaseErrorKind is "download" when a download failed and "verify" when
# the release itself is not right (then nothing may be installed from it).
function Save-Release {
    param([string]$Tag, [string]$Dest)
    $jsDir = Join-Path $Dest "JS"
    New-Item -Path $jsDir -ItemType Directory -Force | Out-Null
    $js = Join-Path $jsDir "zenleap.uc.js"
    $sums = Join-Path $Dest "CHECKSUMS.sha256"
    $ZL.ReleaseErrorKind = "download"
    try {
        Invoke-WebRequest -Uri "$RawBase/$Tag/JS/zenleap.uc.js" -OutFile $js -UseBasicParsing
    } catch {
        throw "Failed to download zenleap.uc.js ($Tag)"
    }
    $ZL.ReleaseErrorKind = "verify"
    try {
        Invoke-WebRequest -Uri "$RawBase/$Tag/CHECKSUMS.sha256" -OutFile $sums -UseBasicParsing
    } catch {
        throw "the release has no CHECKSUMS.sha256"
    }
    $expected = $null
    foreach ($line in [IO.File]::ReadAllLines($sums)) {
        if ($line -match '^([0-9a-fA-F]{64})\s+\*?JS/zenleap\.uc\.js\s*$') {
            $expected = $Matches[1].ToLower()
            break
        }
    }
    $actual = (Get-FileHash -LiteralPath $js -Algorithm SHA256).Hash.ToLower()
    if (-not $expected -or $expected -ne $actual) {
        $shown = $(if ($expected) { $expected } else { "no entry" })
        throw "zenleap.uc.js does not match the release's CHECKSUMS.sha256 (expected $shown, got $actual)"
    }
    $version = Get-Version $js
    if ("v$version" -ne $Tag -and $version -ne $Tag) {
        throw "zenleap.uc.js reports version $version, not $Tag"
    }
    $ZL.ReleaseErrorKind = $null
    try {
        Invoke-WebRequest -Uri "$RawBase/$Tag/zenleap-themes.json" -OutFile (Join-Path $Dest "zenleap-themes.json") -UseBasicParsing
    } catch {}
}

# The options of this run to repeat when installing from a clone instead, as
# they are typed after "powershell -File install.ps1" (-File passes each value
# as one string: several -Profile values become "1,Work", which
# Resolve-ProfileSpecs splits again)
function Get-RerunArgs {
    $out = @()
    if ($AllProfiles) { $out += "-AllProfiles" }
    if ($ProfileSpecs.Count -gt 0) { $out += "-Profile $(ConvertTo-Literal ($ProfileSpecs -join ','))" }
    if ($ProfileDirs.Count -eq 1) {
        $pd = $ProfileDirs[0]
        if (Test-Path -LiteralPath $pd -PathType Container) { $pd = (Resolve-Path -LiteralPath $pd).ProviderPath }
        $out += "-ProfileDir $(ConvertTo-Literal $pd)"
    }
    if ($ZenPath) {
        $zp = $ZenPath
        if (Test-Path -LiteralPath $zp -PathType Container) { $zp = (Resolve-Path -LiteralPath $zp).ProviderPath }
        $out += "-ZenPath $(ConvertTo-Literal $zp)"
    }
    if ($Loader -and $Loader -ne "auto") { $out += "-Loader $Loader" }
    if ($Yes) { $out += "-Yes" }
    return ($out -join ' ')
}

# The way forward when the latest release fails verification (shown after
# "ZenLeap <tag>, the latest release, could not be verified: <reason>")
function Show-UnverifiedReleaseHelp {
    $opts = Get-RerunArgs
    $cmd = ".\install.ps1" + $(if ($opts) { " $opts" } else { "" })
    Write-Host "Nothing was installed. This is a problem with that release on GitHub, not with"
    Write-Host "your system or your network. Until a release that passes the check is out, install"
    Write-Host "ZenLeap from a copy of the repository: the installer then uses that copy's own"
    Write-Host "files instead of downloading a release."
    Write-Host ""
    Write-Host "    git clone --depth 1 https://github.com/$GitHubRepo.git"
    Write-Host "    cd ZenLeap"
    Write-Host "    powershell -ExecutionPolicy Bypass -File $cmd"
    Write-Host ""
    Write-Host "Without git: download https://github.com/$GitHubRepo/archive/refs/heads/main.zip,"
    Write-Host "extract it, and run the last command in the ZenLeap-main folder it contains."
    if ($ProfileDirs.Count -gt 1) {
        Write-Host "(install.ps1 -File takes one -ProfileDir: run it once per profile folder.)"
    }
}

# Where the ZenLeap files come from: this script's checkout, or the latest release
function Get-SourceDir {
    if (-not $Remote -and $ScriptDir -and (Test-Path -LiteralPath (Join-Path (Join-Path $ScriptDir "JS") "zenleap.uc.js"))) {
        return $ScriptDir
    }
    Write-Info "Looking up the latest ZenLeap release..."
    $tag = Get-LatestReleaseTag
    if (-not $tag) {
        Write-Err "Could not determine the latest ZenLeap release (network?)"
        Stop-Installer 1
    }
    Write-Info "Downloading ZenLeap $tag..."
    $dest = Join-Path (Get-WorkDir) "release"
    try {
        Save-Release $tag $dest
    } catch {
        if ($ZL.ReleaseErrorKind -eq "verify") {
            Write-Err "ZenLeap $tag, the latest release, could not be verified: $($_.Exception.Message)."
            Show-UnverifiedReleaseHelp
        } else {
            Write-Err "$($_.Exception.Message). Check your internet connection and try again."
        }
        Stop-Installer 1
    }
    Write-Status "Downloaded ZenLeap $tag (SHA-256 verified)"
    return $dest
}

# --- fx-autoconfig ---
# Check an extracted fx-autoconfig tree against the pinned hashes: every listed
# file must match and chrome\utils must contain nothing else. Throws.
function Test-FxAutoconfigTree {
    param([string]$Dir)
    $listed = @()
    foreach ($line in ($FxPinnedSha256 -split "`n")) {
        if ($line.Trim() -notmatch '^([0-9a-f]{64})\s+(\S.*)$') { continue }
        $want = $Matches[1]
        $rel = $Matches[2]
        $listed += $rel
        $file = Join-Path $Dir $rel
        if (-not (Test-Path -LiteralPath $file)) { throw "fx-autoconfig download is missing $rel" }
        if ((Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash.ToLower() -ne $want) {
            throw "fx-autoconfig file $rel does not match the tested version"
        }
    }
    $utils = Join-Path (Join-Path (Join-Path $Dir "profile") "chrome") "utils"
    foreach ($f in @(Get-ChildItem -LiteralPath $utils -Force)) {
        if ($listed -cnotcontains "profile/chrome/utils/$($f.Name)") {
            throw "fx-autoconfig download contains an unexpected file: profile/chrome/utils/$($f.Name)"
        }
    }
}

# Copy fx-autoconfig's loader (profile\chrome\utils of $Src) to $Dest. From the
# tested version exactly the pinned files are copied and each copy is checked;
# any other version is copied as it is. Throws (and leaves no $Dest behind).
function Copy-FxAutoconfigUtils {
    param([string]$Src, [string]$Dest)
    if (Test-Path -LiteralPath $Dest) { Remove-Item -LiteralPath $Dest -Recurse -Force }
    New-Item -Path $Dest -ItemType Directory -Force | Out-Null
    try {
        if ($ZL.FxVerified) {
            foreach ($line in ($FxPinnedSha256 -split "`n")) {
                if ($line.Trim() -notmatch '^([0-9a-f]{64})\s+profile/chrome/utils/(\S+)$') { continue }
                $want = $Matches[1]
                $name = $Matches[2]
                $to = Join-Path $Dest $name
                Copy-Item -LiteralPath (Join-Path (Join-Path (Join-Path (Join-Path $Src "profile") "chrome") "utils") $name) -Destination $to -Force
                if ((Get-FileHash -LiteralPath $to -Algorithm SHA256).Hash.ToLower() -ne $want) {
                    throw "the copy of profile/chrome/utils/$name does not match the tested version"
                }
            }
        } else {
            foreach ($item in @(Get-ChildItem -LiteralPath (Join-Path (Join-Path (Join-Path $Src "profile") "chrome") "utils") -Force)) {
                Copy-Item -LiteralPath $item.FullName -Destination $Dest -Recurse -Force
            }
        }
    } catch {
        Remove-Item -LiteralPath $Dest -Recurse -Force -ErrorAction SilentlyContinue
        throw
    }
}

# Get fx-autoconfig once per run: the pinned, tested commit, verified file by
# file. FX_AUTOCONFIG_DIR (local checkout) is verified too and used unverified
# if it is another version; FX_AUTOCONFIG_REF is used unverified.
function Get-FxAutoconfig {
    if ($ZL.FxSrc) { return $true }
    if ($ZL.FxFailed) { return $false }
    $ZL.FxFailed = $true
    try {
        if ($env:FX_AUTOCONFIG_DIR) {
            if (-not (Test-Path -LiteralPath (Join-Path (Join-Path $env:FX_AUTOCONFIG_DIR "program") "config.js"))) {
                throw "FX_AUTOCONFIG_DIR=$($env:FX_AUTOCONFIG_DIR) is not an fx-autoconfig checkout"
            }
            $ZL.FxSrc = (Resolve-Path -LiteralPath $env:FX_AUTOCONFIG_DIR).ProviderPath
            try {
                Test-FxAutoconfigTree $ZL.FxSrc
                $ZL.FxVerified = $true
                Write-Status "Using fx-autoconfig from $($ZL.FxSrc) (FX_AUTOCONFIG_DIR; the tested version)"
            } catch {
                Write-Warn "Using fx-autoconfig from $($ZL.FxSrc) (FX_AUTOCONFIG_DIR, not verified)"
            }
        } else {
            $ref = $(if ($env:FX_AUTOCONFIG_REF) { $env:FX_AUTOCONFIG_REF } else { $FxPinnedRef })
            $dir = Join-Path (Get-WorkDir) "fxac-download"
            New-Item -Path $dir -ItemType Directory -Force | Out-Null
            Write-Info "Downloading fx-autoconfig..."
            $zipPath = Join-Path $dir "fxautoconfig.zip"
            Invoke-WebRequest -Uri "https://github.com/MrOtherGuy/fx-autoconfig/archive/$ref.zip" -OutFile $zipPath -UseBasicParsing
            Expand-Archive -LiteralPath $zipPath -DestinationPath $dir -Force
            $extracted = Get-ChildItem -LiteralPath $dir -Directory | Where-Object { $_.Name -like "fx-autoconfig*" } | Select-Object -First 1
            if (-not $extracted) { throw "unexpected fx-autoconfig archive layout" }
            if ($ref -eq $FxPinnedRef) {
                Test-FxAutoconfigTree $extracted.FullName
                $ZL.FxVerified = $true
            } else {
                Write-Warn "Using fx-autoconfig $ref (FX_AUTOCONFIG_REF: not the tested version, not verified)"
            }
            $ZL.FxSrc = $extracted.FullName
        }
        $ZL.FxVersion = Get-Version (Join-Path (Join-Path (Join-Path (Join-Path $ZL.FxSrc "profile") "chrome") "utils") "boot.sys.mjs")
        $ZL.FxFailed = $false
        return $true
    } catch {
        $ZL.FxError = $_.Exception.Message
        return $false
    }
}

# The loader version this installer installs
function Get-FxTargetVersion {
    if (-not $env:FX_AUTOCONFIG_DIR -and -not $env:FX_AUTOCONFIG_REF) { return $FxPinnedVersion }
    if (Get-FxAutoconfig) { return $ZL.FxVersion }
    return $null
}

# Value of a string pref in a default-prefs file (the last line that sets it
# wins; commented-out lines don't count); $null if the file doesn't set it
function Get-PrefFileValue {
    param([string]$File, [string]$Name)
    $val = $null
    $re = '["'']' + [regex]::Escape($Name) + '["'']\s*,\s*(["''])(.*?)\1'
    try { $lines = [IO.File]::ReadAllLines($File) } catch { return $null }
    foreach ($line in $lines) {
        if ($line -match '^\s*//') { continue }
        $m = [regex]::Match($line, $re)
        if ($m.Success) { $val = $m.Groups[2].Value }
    }
    return $val
}

# The autoconfig file a Zen installation runs (general.config.filename, relative
# to it) and the pref file that sets it: @{ File; Source }, or $null when no
# file sets it. Zen reads <dir>\defaults\pref\*.js in reverse alphabetical
# order, then <dir>\browser\defaults\preferences\*.js, and the last value read
# wins (verified with Zen 1.22.3b; the same as the ZenRipple installer).
function Get-AutoconfigSetting {
    param([string]$ZenDir)
    $result = $null
    foreach ($layer in @((Join-Path (Join-Path $ZenDir "defaults") "pref"), (Join-Path (Join-Path (Join-Path $ZenDir "browser") "defaults") "preferences"))) {
        if (-not (Test-Path -LiteralPath $layer -PathType Container)) { continue }
        $names = [string[]]@(Get-ChildItem -LiteralPath $layer -File -Force -ErrorAction SilentlyContinue | Where-Object { $_.Name -like '*.js' } | ForEach-Object { $_.Name })
        [Array]::Sort($names, [StringComparer]::Ordinal)
        [Array]::Reverse($names)
        foreach ($n in $names) {
            $v = Get-PrefFileValue (Join-Path $layer $n) 'general.config.filename'
            if ($null -ne $v) { $result = @{ File = $v; Source = (Join-Path $layer $n) } }
        }
    }
    return $result
}

# What a Zen installation's autoconfig does at startup (the file that
# general.config.filename names; config.js when no pref names one): fxac
# (fx-autoconfig's config.js and a pref that makes Zen run it), fxac-noprefs
# (no such pref), sine / sine-noprefs (Sine's bootloader), foreign (some other
# autoconfig file, e.g. an enterprise mozilla.cfg or an old fx-autoconfig, or
# autoconfig switched off by an empty filename), or missing (no config.js).
# Same classes as install.sh and the ZenRipple installer.
function Get-ProgramStatus {
    param([string]$ZenDir)
    $setting = Get-AutoconfigSetting $ZenDir
    if ($null -eq $setting) { $name = "config.js"; $suffix = "-noprefs" } else { $name = $setting.File; $suffix = "" }
    if (-not $name -or $name.Contains('/') -or $name.Contains('\')) { return "foreign" }
    $cfg = Join-Path $ZenDir $name
    if (-not (Test-Path -LiteralPath $cfg -PathType Leaf)) {
        if ($name -eq "config.js") { return "missing" }
        return "foreign"
    }
    $content = [IO.File]::ReadAllText($cfg)
    if ($content.Contains('userchromejs/content/boot.sys.mjs')) { return "fxac$suffix" }
    if ($content.Contains('sine.sys.mjs')) { return "sine$suffix" }
    return "foreign"
}

# For messages: the autoconfig file a Zen installation runs and where that is set
function Get-AutoconfigText {
    param([string]$ZenDir)
    $setting = Get-AutoconfigSetting $ZenDir
    if ($null -eq $setting) { return (Join-Path $ZenDir "config.js") }
    if (-not $setting.File) { return "autoconfig switched off (general.config.filename is empty in $($setting.Source))" }
    return "$(Join-Path $ZenDir $setting.File) (general.config.filename in $($setting.Source))"
}

# Copy a file through a temporary name so an interrupted copy never leaves a
# half-written script behind
function Copy-FileSafely {
    param([string]$Source, [string]$Destination)
    $tmp = "$Destination.zenleap-tmp"
    Copy-Item -LiteralPath $Source -Destination $tmp -Force
    Move-Item -LiteralPath $tmp -Destination $Destination -Force
}

# fx-autoconfig's program files (config.js, defaults\pref\config-prefs.js) go
# into a Zen installation directory, once for all its profiles. An existing
# config.js is never replaced: fx-autoconfig's is kept (only a missing pref
# file is added); Sine's or any other one is left alone.
function Install-FxAutoconfigProgram {
    param([string]$ZenDir)
    if ($ZL.GreState.ContainsKey($ZenDir)) { return }
    $appIni = Join-Path $ZenDir "application.ini"
    if (Test-Path -LiteralPath $appIni) {
        $vline = @([IO.File]::ReadAllLines($appIni) | Where-Object { $_ -like 'Version=*' })[0]
        if ($vline -and (Compare-Versions $vline.Substring(8) $ZenMinVersion) -lt 0) {
            Write-Warn "Zen $($vline.Substring(8)) in $ZenDir is older than $ZenMinVersion, the oldest version ZenLeap supports (tested: $ZenTestedVersion)."
        }
    }
    $configJs = Join-Path $ZenDir "config.js"
    $prefsDir = Join-Path (Join-Path $ZenDir "defaults") "pref"
    $prefsJs = Join-Path $prefsDir "config-prefs.js"
    $status = Get-ProgramStatus $ZenDir
    switch ($status) {
        "fxac" {
            Write-Status "fx-autoconfig is set up in $ZenDir"
            $ZL.GreState[$ZenDir] = "ok"
            return
        }
        { $_ -in @("sine", "sine-noprefs") } {
            Write-Warn "$ZenDir starts Sine's bootloader, which only runs Sine mods."
            $ZL.GreState[$ZenDir] = "sine"
            return
        }
        "foreign" {
            Write-Warn "Zen's autoconfig setup in $ZenDir loads neither fx-autoconfig nor Sine; leaving it alone:"
            Write-Info (Get-AutoconfigText $ZenDir)
            Write-Info "ZenLeap in chrome\JS only loads once that loads fx-autoconfig's boot.sys.mjs."
            $ZL.GreState[$ZenDir] = "foreign"
            return
        }
    }

    Write-Info "Installing fx-autoconfig into the Zen installation ($ZenDir)..."
    if (-not (Get-FxAutoconfig)) {
        Write-Err "Could not get fx-autoconfig: $($ZL.FxError)"
        Stop-Installer 1
    }
    $srcConfig = Join-Path (Join-Path $ZL.FxSrc "program") "config.js"
    $srcPrefs = Join-Path (Join-Path (Join-Path (Join-Path $ZL.FxSrc "program") "defaults") "pref") "config-prefs.js"
    $copied = $false
    try {
        New-Item -Path $prefsDir -ItemType Directory -Force | Out-Null
        if ($status -eq "missing") { Copy-FileSafely $srcConfig $configJs }
        Copy-FileSafely $srcPrefs $prefsJs
        $copied = $true
    } catch {}
    if ($copied) {
        if ((Get-ProgramStatus $ZenDir) -eq "fxac") {
            Write-Status "Installed fx-autoconfig's loader files into $ZenDir"
            $ZL.GreState[$ZenDir] = "ok"
        } else {
            # Another pref file wins over config-prefs.js
            Write-Warn "Copied fx-autoconfig's files into $ZenDir, but Zen still runs: $(Get-AutoconfigText $ZenDir)"
            $ZL.GreState[$ZenDir] = "foreign"
        }
        return
    }

    # Needs administrator rights. Stage the files where they survive this run.
    $stage = Join-Path (Join-Path "$env:LOCALAPPDATA" "zenleap") "fx-autoconfig-program"
    New-Item -Path $stage -ItemType Directory -Force | Out-Null
    Copy-Item -LiteralPath $srcConfig -Destination (Join-Path $stage "config.js") -Force
    Copy-Item -LiteralPath $srcPrefs -Destination (Join-Path $stage "config-prefs.js") -Force
    $commands = @("New-Item -ItemType Directory -Force -Path $(ConvertTo-Literal $prefsDir) | Out-Null")
    if ($status -eq "missing") {
        $commands += "Copy-Item -LiteralPath $(ConvertTo-Literal (Join-Path $stage 'config.js')) -Destination $(ConvertTo-Literal $configJs) -Force"
    }
    $commands += "Copy-Item -LiteralPath $(ConvertTo-Literal (Join-Path $stage 'config-prefs.js')) -Destination $(ConvertTo-Literal $prefsJs) -Force"
    Write-Warn "Copying fx-autoconfig into $ZenDir needs administrator rights."
    if (-not $Yes -and (Confirm-Action "Copy it now with administrator rights (Windows will ask for permission)?" $true)) {
        if ((Invoke-Elevated ($commands -join "; ")) -and (Get-ProgramStatus $ZenDir) -eq "fxac") {
            Write-Status "Installed fx-autoconfig's loader files into $ZenDir"
            $ZL.GreState[$ZenDir] = "ok"
            return
        }
        Write-Warn "Could not copy the files with administrator rights."
    }
    $ZL.FxProgramCommands = @($ZL.FxProgramCommands) + $commands | Where-Object { $_ }
    $ZL.GreState[$ZenDir] = "pending"
    Write-Info "Run these commands in PowerShell opened with 'Run as administrator':"
    Write-Host ""
    foreach ($c in $commands) { Write-Host "    $c" }
    Write-Host ""
}

# fx-autoconfig's loader in the profile: chrome\utils only (the rest of its
# profile folder is examples). An existing loader is kept; interactive runs
# offer to update one older than the tested version.
function Install-FxAutoconfigProfile {
    param([string]$ChromeDir)
    $utils = Join-Path $ChromeDir "utils"
    $boot = Join-Path $utils "boot.sys.mjs"
    if ((Test-Path -LiteralPath $boot) -or (Test-Path -LiteralPath (Join-Path $utils "boot.jsm"))) {
        $have = Get-Version $boot
        $target = Get-FxTargetVersion
        if (-not $target -or ($have -and (Compare-Versions $have $target) -ge 0)) {
            Write-Status "fx-autoconfig loader $have already installed"
            return
        }
        $shown = $(if ($have) { $have } else { "pre-0.8" })
        Write-Warn "This profile's fx-autoconfig loader is older than the tested one ($shown < $target)."
        if ($Yes) {
            Write-Info "Leaving it as it is; run the installer without -Yes to update it."
            return
        }
        if (-not (Confirm-Action "  Update chrome\utils to $target?" $true)) {
            Write-Info "Keeping the installed loader"
            return
        }
        if (-not (Get-FxAutoconfig)) {
            Write-Err "Could not get fx-autoconfig: $($ZL.FxError)"
            Stop-Installer 1
        }
        $backup = Join-Path $ChromeDir "utils.zenleap-backup"
        if (Test-Path -LiteralPath $backup) { Remove-Item -LiteralPath $backup -Recurse -Force }
        Move-Item -LiteralPath $utils -Destination $backup
        try {
            Copy-FxAutoconfigUtils $ZL.FxSrc $utils
        } catch {
            Move-Item -LiteralPath $backup -Destination $utils
            Write-Err "Could not update fx-autoconfig's loader: $($_.Exception.Message) (the previous one is back in place)"
            Stop-Installer 1
        }
        Write-Status "Updated fx-autoconfig loader to $($ZL.FxVersion) (previous copy: chrome\utils.zenleap-backup)"
        return
    }
    if ((Test-Path -LiteralPath $utils) -and @(Get-ChildItem -LiteralPath $utils -Force).Count -gt 0) {
        Write-Warn "chrome\utils exists but is not fx-autoconfig's loader; leaving it alone."
        return
    }
    if (-not (Get-FxAutoconfig)) {
        Write-Err "Could not get fx-autoconfig: $($ZL.FxError)"
        Stop-Installer 1
    }
    New-Item -Path $ChromeDir -ItemType Directory -Force | Out-Null
    try {
        Copy-FxAutoconfigUtils $ZL.FxSrc $utils
    } catch {
        Write-Err "Could not install fx-autoconfig's loader: $($_.Exception.Message)"
        Stop-Installer 1
    }
    Write-Status "Installed fx-autoconfig loader (chrome\utils, $($ZL.FxVersion))"
}

# Remove fx-autoconfig's loader from a profile, unless other scripts in its
# chrome\JS (e.g. ZenRipple, or Sine running on fx-autoconfig) still need it
function Uninstall-FxAutoconfigProfile {
    param([string]$Dir)
    $utils = Join-Path (Join-Path $Dir "chrome") "utils"
    if (-not ((Test-Path -LiteralPath (Join-Path $utils "boot.sys.mjs")) -or (Test-Path -LiteralPath (Join-Path $utils "boot.jsm")))) {
        Write-Warn "fx-autoconfig's loader not found in this profile"
        return
    }
    $others = @(Get-OtherScripts $Dir)
    if ($others.Count -gt 0) {
        Write-Warn "Keeping fx-autoconfig in this profile: other scripts in chrome\JS use it ($($others -join ', '))."
        return
    }
    Remove-Item -LiteralPath $utils -Recurse -Force
    Write-Status "Removed chrome\utils\ (fx-autoconfig)"
}

# Remove fx-autoconfig's program files from a Zen installation (only if they
# are fx-autoconfig's, and no profile that runs with it still needs them)
function Uninstall-FxAutoconfigProgram {
    param([string]$ZenDir, $Found)
    if (-not $ZenDir) {
        Write-Warn "Zen installation not found; fx-autoconfig's config.js was not removed (use -ZenPath)"
        return
    }
    $configJs = Join-Path $ZenDir "config.js"
    $prefsJs = Join-Path (Join-Path (Join-Path $ZenDir "defaults") "pref") "config-prefs.js"
    $status = Get-ProgramStatus $ZenDir
    if ($status -eq "missing") { return }
    if ($status -ne "fxac" -and $status -ne "fxac-noprefs") {
        Write-Warn "$configJs is not fx-autoconfig's; leaving it alone"
        return
    }
    # Profiles of this Zen installation whose scripts still need it
    $users = @()
    if ($Found) {
        foreach ($p in $Found.Profiles) {
            if (-not (Test-Path -LiteralPath (Join-Path (Join-Path (Join-Path $p.Dir "chrome") "utils") "boot.sys.mjs"))) { continue }
            if ((Get-ProfileZenDir $p $ZenDir) -ne $ZenDir) { continue }
            if ((Test-Path -LiteralPath (Join-Path (Join-Path (Join-Path $p.Dir "chrome") "JS") "zenleap.uc.js")) -or @(Get-OtherScripts $p.Dir).Count -gt 0) {
                $users += $p.Name
            }
        }
    }
    if ($users.Count -gt 0) {
        Write-Warn "Keeping fx-autoconfig's config.js in ${ZenDir}: scripts in these profiles still need it: $($users -join ', ')."
        return
    }
    try {
        Remove-Item -LiteralPath $configJs -Force
        if (Test-Path -LiteralPath $prefsJs) { Remove-Item -LiteralPath $prefsJs -Force }
        Write-Status "Removed fx-autoconfig's config.js and config-prefs.js"
        return
    } catch {}
    $command = "Remove-Item -LiteralPath $(ConvertTo-Literal $configJs), $(ConvertTo-Literal $prefsJs) -Force -ErrorAction SilentlyContinue"
    if (-not $Yes -and (Invoke-Elevated $command) -and -not (Test-Path -LiteralPath $configJs)) {
        Write-Status "Removed fx-autoconfig's config.js and config-prefs.js"
        return
    }
    Write-Warn "Removing fx-autoconfig from $ZenDir needs administrator rights. In PowerShell opened with 'Run as administrator', run:"
    Write-Host "    $command"
}

# --- userChrome.css ---
# Installers up to 3.4 appended chrome.css to userChrome.css between these
# markers. ZenLeap injects its styles at runtime, so the block is only removed
# (a file with nothing else in it, which those installers created, is deleted).
function Remove-ZenLeapCss {
    param([string]$ChromeDir)
    $file = Join-Path $ChromeDir "userChrome.css"
    if (-not (Test-Path -LiteralPath $file)) { return $false }
    $content = [IO.File]::ReadAllText($file)
    if ($content -notmatch '/\* === ZenLeap Styles === \*/') { return $false }
    Copy-Item -LiteralPath $file -Destination (Join-Path $ChromeDir "userChrome.css.zenleap-backup") -Force
    $pattern = '(?ms)(?:^[ \t]*\r?\n)*^[^\r\n]*/\* === ZenLeap Styles === \*/.*?(?:/\* === End ZenLeap Styles === \*/[^\r\n]*(?:\r?\n|\z)|\z)'
    $content = [regex]::Replace($content, $pattern, '')
    if ($content.Trim() -eq '') {
        Remove-Item -LiteralPath $file -Force
    } else {
        [IO.File]::WriteAllText($file, $content, (New-Object System.Text.UTF8Encoding $false))
    }
    return $true
}

# --- ZenLeap ---
# What to do with a profile whose Zen installation's Get-ProgramStatus is
# $Status (the same rules as install.sh):
#   fxac                install into chrome\JS, loaded by fx-autoconfig
#   sine-update         replace the copy of ZenLeap that Sine manages (-Loader sine)
#   sine-ask            ask whether to replace Sine's copy
#   skip-sine           Sine manages ZenLeap here (-Yes): leave it to Sine
#   skip-no-sine        -Loader sine, but Sine manages no ZenLeap here
#   skip-sine-loader    only Sine mods run in this profile
#   skip-foreign-utils  chrome\utils holds another loader
function Get-InstallPlan {
    param($P, [string]$Status)
    if ($Loader -eq "fx-autoconfig") { return "fxac" }
    if (Get-SineZenLeapDir $P.Dir) {
        if ($Loader -eq "sine") { return "sine-update" }
        if (Test-SineActive $P.Dir $Status) {
            if ($Yes) { return "skip-sine" }
            return "sine-ask"
        }
        # Left over from Sine, which doesn't start here: fx-autoconfig as usual
    } elseif ($Loader -eq "sine") {
        return "skip-no-sine"
    }
    switch (Get-ProfileLoader $P.Dir $Status) {
        "sine" { return "skip-sine-loader" }
        "foreign" { return "skip-foreign-utils" }
    }
    return "fxac"
}

# Install ZenLeap into a profile as planned (see Get-InstallPlan); $Gre is its
# Zen installation. Returns $true if ZenLeap was installed.
function Install-ZenLeap {
    param($P, [string]$SourceDir, [string]$Plan, [string]$Gre)
    $chromeDir = Join-Path $P.Dir "chrome"
    $srcJs = Join-Path (Join-Path $SourceDir "JS") "zenleap.uc.js"
    $srcThemes = Join-Path $SourceDir "zenleap-themes.json"
    $version = Get-Version $srcJs
    $sineDir = Get-SineZenLeapDir $P.Dir
    $status = $(if ($Gre) { Get-ProgramStatus $Gre } else { "" })

    switch ($Plan) {
        { $_ -in @("sine-update", "sine-ask", "skip-sine") } {
            Write-Warn "Sine manages ZenLeap in this profile (v$(Get-Version (Join-Path (Join-Path $sineDir 'JS') 'zenleap.uc.js')))."
            if ($Plan -eq "skip-sine") {
                Write-Info "Left to Sine: update it from Sine's settings. (-Loader sine replaces Sine's copy instead.)"
                return $false
            }
            if ($Plan -eq "sine-ask" -and -not (Confirm-Explicitly "  Replace Sine's copy with v${version}? Sine may replace it again when it updates its mods.")) {
                Write-Warn "Skipped this profile (update ZenLeap from Sine's settings instead)"
                return $false
            }
            Copy-FileSafely $srcJs (Join-Path (Join-Path $sineDir "JS") "zenleap.uc.js")
            $srcCss = Join-Path $SourceDir "chrome.css"
            if (Test-Path -LiteralPath $srcCss) { Copy-Item -LiteralPath $srcCss -Destination (Join-Path $sineDir "chrome.css") -Force }
            if (Test-Path -LiteralPath $srcThemes) { Copy-Item -LiteralPath $srcThemes -Destination (Join-Path $sineDir "zenleap-themes.json") -Force }
            Write-Status "Updated Sine-managed zenleap.uc.js (v$version)"
            return $true
        }
        "skip-no-sine" {
            Write-Warn "Sine manages no copy of ZenLeap in this profile (-Loader sine); skipped."
            Write-Info "Install ZenLeap from Sine's settings, or run the installer without -Loader sine."
            return $false
        }
        "skip-sine-loader" {
            if ($status -eq "sine" -or $status -eq "sine-noprefs") {
                Write-Warn "Zen's config.js in $Gre starts Sine's bootloader, which only runs Sine mods, not scripts in chrome\JS."
            } else {
                Write-Warn "chrome\utils in this profile is Sine's bootloader, which only runs Sine mods, not scripts in chrome\JS."
            }
            Write-Info "Install ZenLeap from Sine instead (Sine's settings: install yashas-salankimatt/ZenLeap)."
            return $false
        }
        "skip-foreign-utils" {
            Write-Warn "chrome\utils in this profile holds another script loader, not fx-autoconfig; leaving it alone."
            Write-Info "ZenLeap needs fx-autoconfig's chrome\utils. Move that folder away and run the installer"
            Write-Info "again to set up fx-autoconfig, or install ZenLeap through that loader."
            return $false
        }
    }

    # fx-autoconfig
    if ($sineDir) {
        if (Test-SineActive $P.Dir $status) {
            Write-Warn "ZenLeap is also a Sine mod in this profile: turn it off in Sine's settings so it doesn't load twice."
        } else {
            Write-Info "chrome\sine-mods\$SineModId is left over from Sine (Sine does not start in this profile); it is not used."
        }
    } elseif (Test-SineActive $P.Dir $status) {
        Write-Info "Sine runs in this profile too. To let Sine manage ZenLeap instead, uninstall it here and install it from Sine."
    }

    Install-FxAutoconfigProfile $chromeDir

    $jsDir = Join-Path $chromeDir "JS"
    New-Item -Path $jsDir -ItemType Directory -Force | Out-Null
    Copy-FileSafely $srcJs (Join-Path $jsDir "zenleap.uc.js")
    Write-Status "Installed zenleap.uc.js (v$version)"

    if (Remove-ZenLeapCss $chromeDir) {
        Write-Status "Removed old ZenLeap styles from userChrome.css (backup: userChrome.css.zenleap-backup)"
    }

    # Themes template (never overwrite the user's)
    $themesFile = Join-Path $chromeDir "zenleap-themes.json"
    if (-not (Test-Path -LiteralPath $themesFile) -and (Test-Path -LiteralPath $srcThemes)) {
        Copy-Item -LiteralPath $srcThemes -Destination $themesFile -Force
        Write-Status "Created zenleap-themes.json template"
    }

    # Anything that keeps it from loading? (Missing program files are reported
    # with their commands.)
    switch ($ZL.GreState[$Gre]) {
        "foreign" { $ZL.PendingMsgs += "$($P.Name): Zen's autoconfig setup does not load fx-autoconfig: $(Get-AutoconfigText $Gre). ZenLeap loads once it loads fx-autoconfig's boot.sys.mjs." }
        "sine" { $ZL.PendingMsgs += "$($P.Name): Zen's config.js in $Gre starts Sine's bootloader, which does not run scripts in chrome\JS." }
    }
    $utils = Join-Path $chromeDir "utils"
    if (-not (Test-Path -LiteralPath (Join-Path $utils "boot.sys.mjs"))) {
        if (Test-Path -LiteralPath (Join-Path $utils "boot.jsm")) {
            $ZL.PendingMsgs += "$($P.Name): its fx-autoconfig loader (chrome\utils\boot.jsm) is too old for this Zen; run the installer without -Yes to update it."
        } else {
            $ZL.PendingMsgs += "$($P.Name): chrome\utils is not fx-autoconfig's loader."
        }
    }
    return $true
}

function Uninstall-ZenLeap {
    param($P)
    $chromeDir = Join-Path $P.Dir "chrome"
    $found = $false
    $jsFile = Join-Path (Join-Path $chromeDir "JS") "zenleap.uc.js"
    if (Test-Path -LiteralPath $jsFile) {
        Remove-Item -LiteralPath $jsFile -Force
        Write-Status "Removed zenleap.uc.js"
        $found = $true
    }
    # The in-browser updater's backup and partial download, and our own temp copy
    foreach ($suffix in @(".bak", ".part", ".zenleap-tmp")) {
        if (Test-Path -LiteralPath "$jsFile$suffix") {
            Remove-Item -LiteralPath "$jsFile$suffix" -Force
            Write-Status "Removed zenleap.uc.js$suffix"
            $found = $true
        }
    }
    if (Remove-ZenLeapCss $chromeDir) {
        Write-Status "Removed ZenLeap styles from userChrome.css (backup: userChrome.css.zenleap-backup)"
        $found = $true
    }
    if (Get-SineZenLeapDir $P.Dir) {
        Write-Warn "ZenLeap is also installed through Sine here; remove it from Sine's mods page."
    }
    if ($found) {
        Write-Status "ZenLeap uninstalled"
    } else {
        Write-Warn "ZenLeap was not installed in this profile (chrome\JS)"
    }
}

# Files that older installers left behind and nothing needs: fx-autoconfig's
# example scripts in the selected profiles (byte-identical copies only), and
# ZenLeap files in folders next to the profiles that are not profiles. Offered
# for removal; -Yes only lists them.
function Invoke-Cleanup {
    param($Found, $Profiles)
    $items = @()
    foreach ($p in $Profiles) { $items += @(Get-FxExampleFiles $p.Dir) }
    $items += @(Get-LeftoverFiles $Found)
    if ($items.Count -eq 0) { return }
    Write-Host ""
    Write-Warn "Older ZenLeap installers left files behind that nothing needs:"
    foreach ($f in $items) { Write-Host "    $f" }
    Write-Info "(fx-autoconfig's example scripts - test.uc.js logs ""Hi mom, I'm loaded!"" in every window -"
    Write-Info "and copies in folders that are not profiles)"
    if ($Yes) {
        Write-Info "Run the installer without -Yes to remove them, or delete them yourself."
        return
    }
    if (-not (Confirm-Action "  Remove them?" $true)) {
        Write-Info "Kept them."
        return
    }
    foreach ($f in $items) { Remove-Item -LiteralPath $f -Recurse -Force -ErrorAction SilentlyContinue }
    foreach ($p in $Profiles) {
        foreach ($d in @("CSS", "resources")) {
            $dir = Join-Path (Join-Path $p.Dir "chrome") $d
            if ((Test-Path -LiteralPath $dir) -and @(Get-ChildItem -LiteralPath $dir -Force).Count -eq 0) {
                Remove-Item -LiteralPath $dir -Force -ErrorAction SilentlyContinue
            }
        }
    }
    Write-Status "Removed them"
}

# --- Cache ---
# InvalidateCaches=1 in compatibility.ini makes Zen drop its startup cache on
# its next start (what about:support's "Clear startup cache" does), which also
# works while Zen is running. Profiles that are not open also get the cache
# directories removed right away.
function Clear-StartupCache {
    param($Profiles)
    if (@($Profiles).Count -eq 0) { return }
    Write-Host ""
    Write-Info "Clearing startup cache..."
    $any = $false
    $later = $false
    foreach ($p in $Profiles) {
        $compat = Join-Path $p.Dir "compatibility.ini"
        if (Test-Path -LiteralPath $compat) {
            $text = [IO.File]::ReadAllText($compat)
            if ($text -notmatch '(?m)^InvalidateCaches=1\s*$') {
                $sep = $(if ($text.Length -gt 0 -and -not $text.EndsWith("`n")) { "`r`n" } else { "" })
                [IO.File]::AppendAllText($compat, "${sep}InvalidateCaches=1`r`n")
            }
            $any = $true
        }
        if ($ZL.RunningDirs -contains $p.Dir) {
            $later = $true
            continue
        }
        foreach ($dir in @($p.LocalDir, $p.Dir)) {
            $sc = Join-Path $dir "startupCache"
            if (Test-Path -LiteralPath $sc) {
                Remove-Item -LiteralPath $sc -Recurse -Force -ErrorAction SilentlyContinue
                $any = $true
            }
        }
    }
    if ($later) {
        Write-Status "Zen will clear its startup cache when it next starts"
    } elseif ($any) {
        Write-Status "Startup cache cleared"
    } else {
        Write-Status "No startup cache to clear"
    }
}

# --- Banner ---
function Show-Banner {
    Write-Host ""
    Write-Host "=============================================" -ForegroundColor Blue
    Write-Host "          ZenLeap Installer (Windows)         " -ForegroundColor Blue
    Write-Host "       Vim-style Relative Tab Navigation      " -ForegroundColor Blue
    Write-Host "=============================================" -ForegroundColor Blue
    Write-Host ""
}

function Show-Usage {
    Write-Host "Usage:" -ForegroundColor Blue
    Write-Host "  Ctrl+Space     Enter leap mode (? inside it shows all keys)"
    Write-Host "  j/k or Up/Dn   Browse tabs"
    Write-Host "  Enter          Open selected tab"
    Write-Host "  x              Close selected tab"
    Write-Host "  gg / G         Go to first / last tab"
    Write-Host "  g{num}         Go to tab number"
    Write-Host "  zz/zt/zb       Scroll center/top/bottom"
    Write-Host "  Escape         Cancel"
    Write-Host "  Ctrl+/         Search tabs"
    Write-Host "  Ctrl+Shift+/   Command palette"
}

# --- Main ---
function Invoke-Main {
    if ($Action -ne "check") { Show-Banner }
    if (($ProfileSpecs.Count -gt 0 -or $AllProfiles) -and $ProfileDirs.Count -gt 0) {
        Write-Err "Use either -Profile or -ProfileDir, not both"
        Stop-Installer 1
    }

    # Find Zen Browser (fx-autoconfig's program files go there). A profile's own
    # compatibility.ini can also name it, so this may be empty for now.
    $zenDir = Find-ZenInstall
    if ($zenDir -and $Action -ne "check") { Write-Status "Found Zen Browser at: $zenDir" }

    # Find profiles
    $found = Find-ZenProfiles $zenDir
    if ($ProfileDirs.Count -gt 0) {
        $selected = @()
        foreach ($pd in $ProfileDirs) {
            if (-not (Test-Path -LiteralPath $pd -PathType Container)) {
                Write-Err "Profile directory not found: $pd"
                Stop-Installer 1
            }
            $full = (Resolve-Path -LiteralPath $pd).ProviderPath
            if ($Action -eq "install" -and -not (Test-ProfileDir $full)) {
                # A typo such as the home folder must not get a chrome folder
                Write-Warn "$full does not look like a Zen profile (no prefs.js, times.json or compatibility.ini)."
                if ($Yes -or -not (Confirm-Explicitly "  Install into it anyway?")) {
                    Write-Err "Not installing into it. Start Zen with that profile once, or run without -Yes to confirm."
                    Stop-Installer 1
                }
            }
            $match = $null
            if ($found) { $match = @($found.Profiles | Where-Object { $_.Dir.TrimEnd('\', '/') -eq $full.TrimEnd('\', '/') })[0] }
            if (-not $match) { $match = [pscustomobject]@{ Name = (Split-Path $full -Leaf); Dir = $full; LocalDir = $full; Root = $null } }
            if (@($selected | Where-Object { $_.Dir -eq $match.Dir }).Count -eq 0) { $selected += $match }
        }
    } else {
        if (-not $found) {
            Write-Err "Could not find any Zen Browser profiles."
            Write-Info "Start Zen Browser once to create a profile, then run this again."
            Write-Info "Checked: $(Join-Path "$env:APPDATA" 'zen')"
            Stop-Installer 1
        }
        $selected = @(Select-Profiles $found $Action | ForEach-Object { $found.Profiles[$_] })
    }
    if ($Action -ne "check") {
        foreach ($p in $selected) { Write-Status "Profile: $($p.Name)" }
    }

    switch ($Action) {
        "install" {
            if ($selected.Count -eq 0) {
                Write-Err "No profile selected"
                Stop-Installer 1
            }
            $sourceDir = Get-SourceDir
            Wait-ZenClosed $selected

            # What to do with each profile; fx-autoconfig's program files once
            # per Zen installation that needs them
            $profileGre = @{}
            $plans = @{}
            foreach ($p in $selected) {
                $gre = Get-ProfileZenDir $p $zenDir
                $plan = Get-InstallPlan $p $(if ($gre) { Get-ProgramStatus $gre } else { "" })
                $plans[$p.Dir] = $plan
                $profileGre[$p.Dir] = $gre
                if ($plan -ne "fxac") { continue }
                if (-not $gre) {
                    Write-Err "Could not find the Zen Browser installation for profile $($p.Name)."
                    Write-Info "Install Zen Browser first (https://zen-browser.app/), or pass -ZenPath <folder containing zen.exe>."
                    Stop-Installer 1
                }
                if (-not $zenDir) { $zenDir = $gre }
                Install-FxAutoconfigProgram $gre
            }

            $installed = @()
            foreach ($p in $selected) {
                Write-Host ""
                Write-Host "--- $($p.Name) ---" -ForegroundColor Blue
                if (Install-ZenLeap $p $sourceDir $plans[$p.Dir] $profileGre[$p.Dir]) { $installed += $p }
            }

            Clear-StartupCache $installed
            Invoke-Cleanup $found $selected

            Write-Host ""
            if ($installed.Count -eq 0) {
                Write-Warn "ZenLeap was not installed into any profile."
                Stop-Installer 2
            }
            if (@($ZL.FxProgramCommands).Count -gt 0 -or @($ZL.PendingMsgs).Count -gt 0) {
                Write-Host "=============================================" -ForegroundColor Yellow
                Write-Host "          One more step needed               " -ForegroundColor Yellow
                Write-Host "=============================================" -ForegroundColor Yellow
                Write-Host ""
                if (@($ZL.FxProgramCommands).Count -gt 0) {
                    Write-Host "ZenLeap is installed in your profile, but it will not load until fx-autoconfig"
                    Write-Host "is in the Zen installation. In PowerShell opened with 'Run as administrator', run:"
                    Write-Host ""
                    foreach ($c in $ZL.FxProgramCommands) { Write-Host "    $c" }
                    Write-Host ""
                    Write-Host "Then (re)start Zen."
                }
                if (@($ZL.PendingMsgs).Count -gt 0) {
                    Write-Host "ZenLeap is installed, but it will not load yet:"
                    foreach ($m in $ZL.PendingMsgs) { Write-Host "  - $m" }
                }
                return
            }
            Write-Host "=============================================" -ForegroundColor Green
            Write-Host "          Installation Complete!               " -ForegroundColor Green
            Write-Host "=============================================" -ForegroundColor Green
            Write-Host ""
            Show-Usage
            Write-Host ""

            if ($ZL.ZenNeedsRestart) {
                Write-Warn "Restart Zen Browser to activate ZenLeap"
            } elseif ($Yes) {
                Write-Warn "Please start Zen Browser to activate ZenLeap"
            } elseif ($zenDir -and (Confirm-Action "Open Zen Browser now?")) {
                Start-Process (Join-Path $zenDir "zen.exe")
            } else {
                Write-Warn "Please start Zen Browser to activate ZenLeap"
            }
        }

        "uninstall" {
            if ($selected.Count -eq 0) {
                Write-Status "ZenLeap is not installed in any Zen profile (use -Profile to pick one anyway)."
                Invoke-Cleanup $found @()
                return
            }
            Wait-ZenClosed $selected

            foreach ($p in $selected) {
                Write-Host ""
                Write-Host "--- $($p.Name) ---" -ForegroundColor Blue
                Uninstall-ZenLeap $p
            }

            # Offer to remove fx-autoconfig (kept where other scripts still use it)
            $hasFx = @($selected | Where-Object { Test-Path -LiteralPath (Join-Path (Join-Path (Join-Path $_.Dir "chrome") "utils") "boot.sys.mjs") }).Count -gt 0
            $gres = @()
            foreach ($p in $selected) {
                $gre = Get-ProfileZenDir $p $zenDir
                if ($gre -and $gres -notcontains $gre) {
                    $gres += $gre
                    $st = Get-ProgramStatus $gre
                    if ($st -eq "fxac" -or $st -eq "fxac-noprefs") { $hasFx = $true }
                }
            }
            $removeFx = $false
            if ($hasFx) {
                if ($Yes) {
                    $removeFx = $RemoveFxAutoconfig
                    if (-not $removeFx) { Write-Warn "Skipping fx-autoconfig removal (use -RemoveFxAutoconfig to include)" }
                } else {
                    $removeFx = Confirm-Action "Also remove fx-autoconfig? It stays where other scripts (e.g. ZenRipple) use it"
                }
            }
            if ($removeFx) {
                foreach ($p in $selected) { Uninstall-FxAutoconfigProfile $p.Dir }
                if ($gres.Count -eq 0) { Uninstall-FxAutoconfigProgram $zenDir $found }
                foreach ($gre in $gres) { Uninstall-FxAutoconfigProgram $gre $found }
            }

            Clear-StartupCache $selected
            Invoke-Cleanup $found $selected

            Write-Host ""
            Write-Status "Uninstallation complete!"
            Write-Info "Your ZenLeap data (chrome\zenleap-themes.json, chrome\zenleap-plugins\, zenleap-sessions\) was kept."

            if ($ZL.ZenWasRunning -and -not $ZL.ZenNeedsRestart -and -not $Yes -and $zenDir) {
                if (Confirm-Action "Reopen Zen Browser?") {
                    Start-Process (Join-Path $zenDir "zen.exe")
                }
            } else {
                Write-Warn "Please restart Zen Browser if it's running."
            }
        }

        "check" {
            # One "<name> [<profile folder>]: STATUS" line per profile (the folder
            # is what about:support > Profile Folder shows)
            $tag = Get-LatestReleaseTag
            $remoteVersion = $(if ($tag) { $tag.TrimStart('v') } else { $null })
            $anyOutdated = $false

            foreach ($p in $selected) {
                $label = "$($p.Name) [$($p.Dir)]"
                $installedVersion = Get-ZenLeapVersion $p.Dir
                if (-not $installedVersion) {
                    Write-Host "${label}: NOT_INSTALLED"
                } elseif (-not $remoteVersion) {
                    Write-Host "${label}: INSTALLED:${installedVersion}:UNKNOWN"
                } elseif ((Compare-Versions $installedVersion $remoteVersion) -ge 0) {
                    Write-Host "${label}: UP_TO_DATE:${installedVersion}:${remoteVersion}"
                } else {
                    Write-Host "${label}: OUTDATED:${installedVersion}:${remoteVersion}"
                    $anyOutdated = $true
                }
            }

            if ($anyOutdated) { Stop-Installer 1 }
        }
    }
}

$exitCode = 0
# GitHub requires TLS 1.2, which older Windows PowerShell does not enable by
# default (process-wide: put back afterwards)
$oldProtocol = $null
try {
    $oldProtocol = [Net.ServicePointManager]::SecurityProtocol
    [Net.ServicePointManager]::SecurityProtocol = $oldProtocol -bor [Net.SecurityProtocolType]::Tls12
} catch {}
try {
    Invoke-Main
} catch [System.OperationCanceledException] {
    if ($_.Exception.Message -match '^ZenLeapExit:(\d+)$') {
        $exitCode = [int]$Matches[1]
    } else {
        Write-Err $_.Exception.Message
        $exitCode = 1
    }
} catch {
    Write-Err $_.Exception.Message
    Write-Info "To run the installer with options: irm $InstallerUrl -OutFile install.ps1; powershell -ExecutionPolicy Bypass -File install.ps1 -?"
    $exitCode = 1
} finally {
    if ($ZL.WorkDir) { Remove-Item -LiteralPath $ZL.WorkDir -Recurse -Force -ErrorAction SilentlyContinue }
    if ($null -ne $oldProtocol) {
        try { [Net.ServicePointManager]::SecurityProtocol = $oldProtocol } catch {}
    }
}
$exitCode

} $ZLAction $ZLProfile $ZLAllProfiles.IsPresent $ZLProfileDir $ZLZenPath $ZLLoader $ZLRemote.IsPresent $ZLYes.IsPresent $ZLRemoveFxAutoconfig.IsPresent $PSScriptRoot

# A script file reports its exit code; under `irm | iex` there is no script
# path, and `exit` would close the user's PowerShell window: $LASTEXITCODE then.
$__zenleapExit = [int]@($__zenleapExitCode)[-1]
Remove-Variable -Name __zenleapExitCode, ZLAction, ZLProfile, ZLAllProfiles, ZLProfileDir, ZLZenPath, ZLLoader, ZLRemote, ZLYes, ZLRemoveFxAutoconfig -ErrorAction SilentlyContinue
if ($PSCommandPath) { exit $__zenleapExit }
$global:LASTEXITCODE = $__zenleapExit
Remove-Variable -Name __zenleapExit -ErrorAction SilentlyContinue
