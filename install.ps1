#Requires -Version 5.1
<#
.SYNOPSIS
    ZenLeap Installer for Windows
.DESCRIPTION
    Installs fx-autoconfig and ZenLeap for Zen Browser on Windows.

    One-liner (installs the latest release into the profile Zen opens by default):
        irm https://raw.githubusercontent.com/yashas-salankimatt/ZenLeap/main/install.ps1 | iex

    With options, download the script first:
        irm https://raw.githubusercontent.com/yashas-salankimatt/ZenLeap/main/install.ps1 -OutFile install.ps1
        powershell -ExecutionPolicy Bypass -File install.ps1 -Action uninstall

    Zen loads ZenLeap when it starts. The installer never closes Zen for you:
    quit Zen first, or restart it afterwards.
.PARAMETER Action
    install (default), uninstall, or check
.PARAMETER Profile
    Profile(s) to use: numbers from the list ("2" or "1,3"; 1 is the profile
    Zen opens by default), a profile or directory name, or "all".
    Default: the profile Zen opens by default plus every profile that already
    has ZenLeap (interactive runs show the list first).
.PARAMETER AllProfiles
    Same as -Profile all.
.PARAMETER ProfileDir
    Use this profile directory directly.
.PARAMETER ZenPath
    Zen Browser installation directory (the folder containing zen.exe).
    Default: the one that last ran the profile, else a standard location.
.PARAMETER Remote
    Install the latest release from GitHub (verified against the release's
    CHECKSUMS.sha256) even when the script sits in a ZenLeap checkout.
.PARAMETER Yes
    Don't ask questions (non-interactive mode).
.PARAMETER RemoveFxAutoconfig
    Also remove fx-autoconfig when uninstalling.
.NOTES
    fx-autoconfig is installed from a tested commit and verified with SHA-256.
    An existing fx-autoconfig (e.g. from ZenRipple) is kept; interactive runs
    offer to update a loader older than the tested one. Environment variables
    FX_AUTOCONFIG_DIR (local checkout) or FX_AUTOCONFIG_REF (another commit)
    select a different, unverified fx-autoconfig.
#>
param(
    [ValidateSet("install", "uninstall", "check")]
    [string]$Action = "install",
    [string]$Profile = "",
    [switch]$AllProfiles,
    [string]$ProfileDir = "",
    [string]$ZenPath = "",
    [switch]$Remote,
    [switch]$Yes,
    [switch]$RemoveFxAutoconfig
)

$ErrorActionPreference = "Stop"

# GitHub requires TLS 1.2, which older Windows PowerShell does not enable by default
try {
    [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
} catch {}

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
# Directory of this script's checkout. Empty when run through "irm | iex":
# then there are no local files, whatever the current directory contains.
$ScriptDir = $PSScriptRoot

# --- State ---
$script:WorkDir = $null
$script:FxSrc = $null
$script:FxVersion = $null
$script:FxFailed = $false
$script:FxProgramCommands = $null
$script:ZenNeedsRestart = $false
$script:ZenWasRunning = $false
$script:GreState = @{}        # Zen installation dir -> ok | pending | sine | foreign
$script:FxError = $null
$script:RunningDirs = @()     # profiles Zen still has open

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

# A PowerShell single-quoted literal
function ConvertTo-Literal {
    param([string]$Value)
    return "'" + ($Value -replace "'", "''") + "'"
}

function Get-WorkDir {
    if (-not $script:WorkDir) {
        $script:WorkDir = Join-Path ([IO.Path]::GetTempPath()) "zenleap-install-$(Get-Random)"
        New-Item -Path $script:WorkDir -ItemType Directory -Force | Out-Null
    }
    return $script:WorkDir
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
function Find-ZenInstall {
    if ($ZenPath) {
        if (-not (Test-Path -LiteralPath $ZenPath -PathType Container)) {
            Write-Err "Directory not found: $ZenPath"
            Stop-Installer 1
        }
        return (Resolve-Path -LiteralPath $ZenPath).ProviderPath
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

# Parse an INI file into a list of @{ Name; Values } sections
function Read-IniSections {
    param([string]$Path)
    $sections = New-Object System.Collections.ArrayList
    $current = $null
    foreach ($line in [IO.File]::ReadAllLines($Path)) {
        $l = $line.Trim()
        if ($l -match '^\[(.*)\]$') {
            $current = [pscustomobject]@{ Name = $Matches[1]; Values = @{} }
            [void]$sections.Add($current)
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
    $line = @([IO.File]::ReadAllLines($compat) | Where-Object { $_ -like 'LastPlatformDir=*' })[0]
    if ($line) { return $line.Substring(16) }
    return $null
}

# The Zen installation a profile runs with: -ZenPath, else the one that last
# ran it (if still there), else the one found on this system
function Get-ProfileZenDir {
    param($P, [string]$Fallback)
    if ($ZenPath) { return $Fallback }
    $lp = Get-LastPlatformDir $P.Dir
    if ($lp -and ((Test-Path -LiteralPath (Join-Path $lp "zen.exe")) -or (Test-Path -LiteralPath (Join-Path $lp "omni.ja")))) {
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

function Get-SineZenLeapDir {
    param([string]$Dir)
    $d = Join-Path (Join-Path (Join-Path $Dir "chrome") "sine-mods") $SineModId
    if (Test-Path -LiteralPath (Join-Path (Join-Path $d "JS") "zenleap.uc.js")) { return $d }
    return $null
}

# Sine's loader only runs Sine mods, not fx-autoconfig scripts in chrome\JS
function Test-UsesSine {
    param([string]$Dir)
    $chrome = Join-Path $Dir "chrome"
    if (Test-Path -LiteralPath (Join-Path (Join-Path $chrome "JS") "sine.sys.mjs")) { return $true }
    $manifest = Join-Path (Join-Path $chrome "utils") "chrome.manifest"
    if ((Test-Path -LiteralPath $manifest) -and ((Get-Content -LiteralPath $manifest -Raw) -match 'sine-mods')) { return $true }
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
    if ($Profile) {
        try {
            return @(Resolve-ProfileSpec $Found $Profile)
        } catch {
            Write-Err $_.Exception.Message
            Show-ProfileList $Found
            Stop-Installer 1
        }
    }
    if ($Mode -eq 'check') { return @(0..($n - 1)) }

    $suggested = @()
    for ($i = 0; $i -lt $n; $i++) {
        if ((Get-ZenLeapVersion $Found.Profiles[$i].Dir) -or ($Mode -eq 'install' -and $i -eq $Found.Default)) {
            $suggested += $i
        }
    }
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
        $script:RunningDirs = @($running | ForEach-Object { $_.Dir })
        if ($running.Count -eq 0) { return }
        Write-Warn "Zen is running with: $(($running | ForEach-Object { $_.Name }) -join ', ')"
        if ($Yes) {
            Write-Info "Continuing; restart Zen afterwards so it loads the changes."
            $script:ZenNeedsRestart = $true
            return
        }
        $ans = Read-Host "  Quit Zen (Ctrl+Shift+Q), then press Enter. 's' = continue anyway (restart Zen later), 'q' = cancel"
        if ($ans -eq 'q' -or $ans -eq 'Q') {
            Write-Host "Cancelled."
            Stop-Installer 1
        }
        if ($ans -eq 's' -or $ans -eq 'S') {
            $script:ZenNeedsRestart = $true
            return
        }
        $script:ZenWasRunning = $true
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
# SHA-256 in the tag's CHECKSUMS.sha256 and carry the tag's version. Throws.
function Save-Release {
    param([string]$Tag, [string]$Dest)
    $jsDir = Join-Path $Dest "JS"
    New-Item -Path $jsDir -ItemType Directory -Force | Out-Null
    $js = Join-Path $jsDir "zenleap.uc.js"
    $sums = Join-Path $Dest "CHECKSUMS.sha256"
    try {
        Invoke-WebRequest -Uri "$RawBase/$Tag/JS/zenleap.uc.js" -OutFile $js -UseBasicParsing
    } catch {
        throw "Failed to download zenleap.uc.js ($Tag)"
    }
    try {
        Invoke-WebRequest -Uri "$RawBase/$Tag/CHECKSUMS.sha256" -OutFile $sums -UseBasicParsing
    } catch {
        throw "Release $Tag has no CHECKSUMS.sha256; refusing to install unverified code"
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
        throw "zenleap.uc.js from $Tag does not match the release's CHECKSUMS.sha256 (expected $expected, got $actual); refusing to install it"
    }
    $version = Get-Version $js
    if ("v$version" -ne $Tag -and $version -ne $Tag) {
        throw "zenleap.uc.js from $Tag reports version $version; refusing to install it"
    }
    try {
        Invoke-WebRequest -Uri "$RawBase/$Tag/zenleap-themes.json" -OutFile (Join-Path $Dest "zenleap-themes.json") -UseBasicParsing
    } catch {}
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
        Write-Err $_.Exception.Message
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
        if ($listed -notcontains "profile/chrome/utils/$($f.Name)") {
            throw "fx-autoconfig download contains an unexpected file: profile/chrome/utils/$($f.Name)"
        }
    }
}

# Get fx-autoconfig once per run: the pinned, tested commit, verified file by
# file. FX_AUTOCONFIG_DIR (local checkout) and FX_AUTOCONFIG_REF are unverified.
function Get-FxAutoconfig {
    if ($script:FxSrc) { return $true }
    if ($script:FxFailed) { return $false }
    $script:FxFailed = $true
    try {
        if ($env:FX_AUTOCONFIG_DIR) {
            if (-not (Test-Path -LiteralPath (Join-Path (Join-Path $env:FX_AUTOCONFIG_DIR "program") "config.js"))) {
                throw "FX_AUTOCONFIG_DIR=$($env:FX_AUTOCONFIG_DIR) is not an fx-autoconfig checkout"
            }
            $script:FxSrc = (Resolve-Path -LiteralPath $env:FX_AUTOCONFIG_DIR).ProviderPath
            Write-Warn "Using fx-autoconfig from $($script:FxSrc) (FX_AUTOCONFIG_DIR, not verified)"
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
            } else {
                Write-Warn "Using fx-autoconfig $ref (FX_AUTOCONFIG_REF: not the tested version, not verified)"
            }
            $script:FxSrc = $extracted.FullName
        }
        $script:FxVersion = Get-Version (Join-Path (Join-Path (Join-Path (Join-Path $script:FxSrc "profile") "chrome") "utils") "boot.sys.mjs")
        $script:FxFailed = $false
        return $true
    } catch {
        $script:FxError = $_.Exception.Message
        return $false
    }
}

# The loader version this installer installs
function Get-FxTargetVersion {
    if (-not $env:FX_AUTOCONFIG_DIR -and -not $env:FX_AUTOCONFIG_REF) { return $FxPinnedVersion }
    if (Get-FxAutoconfig) { return $script:FxVersion }
    return $null
}

# What a Zen installation's autoconfig does at startup: fxac (fx-autoconfig with
# its pref file), fxac-noprefs, sine (Sine's bootloader), foreign, or missing
function Get-ProgramStatus {
    param([string]$ZenDir)
    $configJs = Join-Path $ZenDir "config.js"
    if (-not (Test-Path -LiteralPath $configJs)) { return "missing" }
    $content = [IO.File]::ReadAllText($configJs)
    if ($content -match 'userchromejs/content/boot\.sys\.mjs') {
        $prefDir = Join-Path (Join-Path $ZenDir "defaults") "pref"
        if (Test-Path -LiteralPath $prefDir) {
            foreach ($f in @(Get-ChildItem -LiteralPath $prefDir -Filter "*.js" -File)) {
                if ([IO.File]::ReadAllText($f.FullName) -match 'general\.config\.filename') { return "fxac" }
            }
        }
        return "fxac-noprefs"
    }
    if ($content -match 'sine\.sys\.mjs') { return "sine" }
    return "foreign"
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
    if ($script:GreState.ContainsKey($ZenDir)) { return }
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
            $script:GreState[$ZenDir] = "ok"
            return
        }
        "sine" {
            Write-Warn "$ZenDir starts Sine's bootloader, which only runs Sine mods."
            $script:GreState[$ZenDir] = "sine"
            return
        }
        "foreign" {
            Write-Warn "$configJs is not fx-autoconfig's (another loader, or an old fx-autoconfig); leaving it alone."
            Write-Info "ZenLeap in chrome\JS only loads if that file loads fx-autoconfig's boot.sys.mjs."
            $script:GreState[$ZenDir] = "foreign"
            return
        }
    }

    Write-Info "Installing fx-autoconfig into the Zen installation ($ZenDir)..."
    if (-not (Get-FxAutoconfig)) {
        Write-Err "Could not get fx-autoconfig: $($script:FxError)"
        Stop-Installer 1
    }
    $srcConfig = Join-Path (Join-Path $script:FxSrc "program") "config.js"
    $srcPrefs = Join-Path (Join-Path (Join-Path (Join-Path $script:FxSrc "program") "defaults") "pref") "config-prefs.js"
    try {
        New-Item -Path $prefsDir -ItemType Directory -Force | Out-Null
        if ($status -eq "missing") { Copy-FileSafely $srcConfig $configJs }
        Copy-FileSafely $srcPrefs $prefsJs
        Write-Status "Installed fx-autoconfig's loader files into $ZenDir"
        $script:GreState[$ZenDir] = "ok"
        return
    } catch {}

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
            $script:GreState[$ZenDir] = "ok"
            return
        }
        Write-Warn "Could not copy the files with administrator rights."
    }
    $script:FxProgramCommands = @($script:FxProgramCommands) + $commands | Where-Object { $_ }
    $script:GreState[$ZenDir] = "pending"
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
            Write-Err "Could not get fx-autoconfig: $($script:FxError)"
            Stop-Installer 1
        }
        $backup = Join-Path $ChromeDir "utils.zenleap-backup"
        if (Test-Path -LiteralPath $backup) { Remove-Item -LiteralPath $backup -Recurse -Force }
        Move-Item -LiteralPath $utils -Destination $backup
        Copy-Item -LiteralPath (Join-Path (Join-Path (Join-Path $script:FxSrc "profile") "chrome") "utils") -Destination $utils -Recurse -Force
        Write-Status "Updated fx-autoconfig loader to $($script:FxVersion) (previous copy: chrome\utils.zenleap-backup)"
        return
    }
    if ((Test-Path -LiteralPath $utils) -and @(Get-ChildItem -LiteralPath $utils -Force).Count -gt 0) {
        Write-Warn "chrome\utils exists but is not fx-autoconfig's loader; leaving it alone."
        return
    }
    if (-not (Get-FxAutoconfig)) {
        Write-Err "Could not get fx-autoconfig: $($script:FxError)"
        Stop-Installer 1
    }
    New-Item -Path $ChromeDir -ItemType Directory -Force | Out-Null
    if (Test-Path -LiteralPath $utils) { Remove-Item -LiteralPath $utils -Recurse -Force }
    Copy-Item -LiteralPath (Join-Path (Join-Path (Join-Path $script:FxSrc "profile") "chrome") "utils") -Destination $utils -Recurse -Force
    Write-Status "Installed fx-autoconfig loader (chrome\utils, $($script:FxVersion))"
}

function Uninstall-FxAutoconfigProfile {
    param([string]$Dir)
    $utils = Join-Path (Join-Path $Dir "chrome") "utils"
    if (Test-UsesSine $Dir) {
        Write-Warn "chrome\utils belongs to Sine in this profile; not removing it"
        return
    }
    if ((Test-Path -LiteralPath (Join-Path $utils "boot.sys.mjs")) -or (Test-Path -LiteralPath (Join-Path $utils "boot.jsm"))) {
        Remove-Item -LiteralPath $utils -Recurse -Force
        Write-Status "Removed chrome\utils\ (fx-autoconfig)"
    } else {
        Write-Warn "fx-autoconfig's loader not found in this profile"
    }
}

function Uninstall-FxAutoconfigProgram {
    param([string]$ZenDir)
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
# markers. ZenLeap injects its styles at runtime, so the block is only removed.
function Remove-ZenLeapCss {
    param([string]$ChromeDir)
    $file = Join-Path $ChromeDir "userChrome.css"
    if (-not (Test-Path -LiteralPath $file)) { return $false }
    $content = [IO.File]::ReadAllText($file)
    if ($content -notmatch '/\* === ZenLeap Styles === \*/') { return $false }
    Copy-Item -LiteralPath $file -Destination (Join-Path $ChromeDir "userChrome.css.zenleap-backup") -Force
    $pattern = '(?ms)(?:^[ \t]*\r?\n)*^[^\r\n]*/\* === ZenLeap Styles === \*/.*?(?:/\* === End ZenLeap Styles === \*/[^\r\n]*(?:\r?\n|\z)|\z)'
    $content = [regex]::Replace($content, $pattern, '')
    [IO.File]::WriteAllText($file, $content, (New-Object System.Text.UTF8Encoding $false))
    return $true
}

# --- ZenLeap ---
function Install-ZenLeap {
    param($P, [string]$SourceDir, [string]$GreStatus)
    $chromeDir = Join-Path $P.Dir "chrome"
    $srcJs = Join-Path (Join-Path $SourceDir "JS") "zenleap.uc.js"
    $srcThemes = Join-Path $SourceDir "zenleap-themes.json"
    $version = Get-Version $srcJs

    # ZenLeap installed as a Sine mod in this profile
    $sineDir = Get-SineZenLeapDir $P.Dir
    if ($sineDir) {
        Write-Warn "ZenLeap is installed through Sine in this profile (v$(Get-Version (Join-Path (Join-Path $sineDir 'JS') 'zenleap.uc.js')))"
        if (-not (Confirm-Action "  Replace Sine's copy with v$version?")) {
            Write-Warn "Skipped this profile (update ZenLeap from Sine's mods page instead)"
            return $false
        }
        Copy-FileSafely $srcJs (Join-Path (Join-Path $sineDir "JS") "zenleap.uc.js")
        $srcCss = Join-Path $SourceDir "chrome.css"
        if (Test-Path -LiteralPath $srcCss) { Copy-Item -LiteralPath $srcCss -Destination (Join-Path $sineDir "chrome.css") -Force }
        if (Test-Path -LiteralPath $srcThemes) { Copy-Item -LiteralPath $srcThemes -Destination (Join-Path $sineDir "zenleap-themes.json") -Force }
        Write-Status "Updated Sine-managed zenleap.uc.js (v$version)"
        return $true
    }
    if ((Test-UsesSine $P.Dir) -or $GreStatus -eq "sine") {
        if (Test-UsesSine $P.Dir) {
            Write-Warn "This profile loads scripts through Sine, which does not run scripts from chrome\JS."
        } else {
            Write-Warn "This Zen installation starts Sine's bootloader, which does not run scripts from chrome\JS."
        }
        Write-Info "Install ZenLeap from Sine instead (Sine mods page -> install yashas-salankimatt/ZenLeap)."
        return $false
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

# --- Cache ---
# InvalidateCaches=1 in compatibility.ini makes Zen drop its startup cache on
# its next start (what about:support's "Clear startup cache" does), which also
# works while Zen is running. Profiles that are not open also get the cache
# directories removed right away.
function Clear-StartupCache {
    param($Profiles)
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
        if ($script:RunningDirs -contains $p.Dir) {
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
    if ($Profile -and $ProfileDir) {
        Write-Err "Use either -Profile or -ProfileDir, not both"
        Stop-Installer 1
    }

    # Find Zen Browser (fx-autoconfig's program files go there). A profile's own
    # compatibility.ini can also name it, so this may be empty for now.
    $zenDir = Find-ZenInstall
    if ($zenDir -and $Action -ne "check") { Write-Status "Found Zen Browser at: $zenDir" }

    # Find profiles
    $found = Find-ZenProfiles $zenDir
    if ($ProfileDir) {
        if (-not (Test-Path -LiteralPath $ProfileDir -PathType Container)) {
            Write-Err "Profile directory not found: $ProfileDir"
            Stop-Installer 1
        }
        $full = (Resolve-Path -LiteralPath $ProfileDir).ProviderPath
        $match = $null
        if ($found) { $match = @($found.Profiles | Where-Object { $_.Dir.TrimEnd('\', '/') -eq $full.TrimEnd('\', '/') })[0] }
        if (-not $match) { $match = [pscustomobject]@{ Name = (Split-Path $full -Leaf); Dir = $full; LocalDir = $full; Raw = $full; Root = $null } }
        $selected = @($match)
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

            # fx-autoconfig's program files, once per Zen installation in use
            $profileGre = @{}
            foreach ($p in $selected) {
                if ((Get-SineZenLeapDir $p.Dir) -or (Test-UsesSine $p.Dir)) { continue }
                $gre = Get-ProfileZenDir $p $zenDir
                if (-not $gre) {
                    Write-Err "Could not find the Zen Browser installation for profile $($p.Name)."
                    Write-Info "Install Zen Browser first (https://zen-browser.app/), or pass -ZenPath <folder containing zen.exe>."
                    Stop-Installer 1
                }
                if (-not $zenDir) { $zenDir = $gre }
                $profileGre[$p.Dir] = $gre
                Install-FxAutoconfigProgram $gre
            }

            $installed = 0
            foreach ($p in $selected) {
                Write-Host ""
                Write-Host "--- $($p.Name) ---" -ForegroundColor Blue
                $greStatus = ""
                if ($profileGre.ContainsKey($p.Dir)) { $greStatus = $script:GreState[$profileGre[$p.Dir]] }
                if (Install-ZenLeap $p $sourceDir $greStatus) { $installed++ }
            }

            Clear-StartupCache $selected

            Write-Host ""
            if ($installed -eq 0) {
                Write-Warn "ZenLeap was not installed into any profile."
                Stop-Installer 1
            }
            if ($script:FxProgramCommands) {
                Write-Host "=============================================" -ForegroundColor Yellow
                Write-Host "          One more step needed               " -ForegroundColor Yellow
                Write-Host "=============================================" -ForegroundColor Yellow
                Write-Host ""
                Write-Host "ZenLeap is installed in your profile, but it will not load until fx-autoconfig"
                Write-Host "is in the Zen installation. In PowerShell opened with 'Run as administrator', run:"
                Write-Host ""
                foreach ($c in $script:FxProgramCommands) { Write-Host "    $c" }
                Write-Host ""
                Write-Host "Then (re)start Zen."
                return
            }
            Write-Host "=============================================" -ForegroundColor Green
            Write-Host "          Installation Complete!               " -ForegroundColor Green
            Write-Host "=============================================" -ForegroundColor Green
            Write-Host ""
            Show-Usage
            Write-Host ""

            if ($script:ZenNeedsRestart) {
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
                return
            }
            Wait-ZenClosed $selected

            foreach ($p in $selected) {
                Write-Host ""
                Write-Host "--- $($p.Name) ---" -ForegroundColor Blue
                Uninstall-ZenLeap $p
            }

            # Offer to remove fx-autoconfig (other userscripts may depend on it)
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
                    $removeFx = [bool]$RemoveFxAutoconfig
                    if (-not $removeFx) { Write-Warn "Skipping fx-autoconfig removal (use -RemoveFxAutoconfig to include)" }
                } else {
                    $removeFx = Confirm-Action "Also remove fx-autoconfig? Other userscripts (e.g. ZenRipple) may depend on it"
                }
            }
            if ($removeFx) {
                foreach ($p in $selected) { Uninstall-FxAutoconfigProfile $p.Dir }
                if ($gres.Count -eq 0) { Uninstall-FxAutoconfigProgram $zenDir }
                foreach ($gre in $gres) { Uninstall-FxAutoconfigProgram $gre }
            }

            Clear-StartupCache $selected

            Write-Host ""
            Write-Status "Uninstallation complete!"
            Write-Info "Your ZenLeap data (chrome\zenleap-themes.json, chrome\zenleap-plugins\, zenleap-sessions\) was kept."

            if ($script:ZenWasRunning -and -not $script:ZenNeedsRestart -and -not $Yes -and $zenDir) {
                if (Confirm-Action "Reopen Zen Browser?") {
                    Start-Process (Join-Path $zenDir "zen.exe")
                }
            } else {
                Write-Warn "Please restart Zen Browser if it's running."
            }
        }

        "check" {
            $tag = Get-LatestReleaseTag
            $remoteVersion = $(if ($tag) { $tag.TrimStart('v') } else { $null })
            $anyOutdated = $false

            foreach ($p in $selected) {
                $installedVersion = Get-ZenLeapVersion $p.Dir
                if (-not $installedVersion) {
                    Write-Host "$($p.Name): NOT_INSTALLED"
                } elseif (-not $remoteVersion) {
                    Write-Host "$($p.Name): INSTALLED:${installedVersion}:UNKNOWN"
                } elseif ((Compare-Versions $installedVersion $remoteVersion) -ge 0) {
                    Write-Host "$($p.Name): UP_TO_DATE:${installedVersion}:${remoteVersion}"
                } else {
                    Write-Host "$($p.Name): OUTDATED:${installedVersion}:${remoteVersion}"
                    $anyOutdated = $true
                }
            }

            if ($anyOutdated) { Stop-Installer 1 }
        }
    }
}

$exitCode = 0
try {
    Invoke-Main
} catch [System.OperationCanceledException] {
    if ($_.Exception.Message -match '^ZenLeapExit:(\d+)$') {
        $exitCode = [int]$Matches[1]
    } else {
        throw
    }
} catch {
    Write-Err $_.Exception.Message
    Write-Info "To run the installer with options: irm $InstallerUrl -OutFile install.ps1; powershell -ExecutionPolicy Bypass -File install.ps1 -?"
    $exitCode = 1
} finally {
    if ($script:WorkDir) { Remove-Item -LiteralPath $script:WorkDir -Recurse -Force -ErrorAction SilentlyContinue }
}

if ($exitCode -ne 0) {
    if ($PSCommandPath) {
        exit $exitCode   # run as a file: report the exit code
    }
    $global:LASTEXITCODE = $exitCode   # irm | iex: keep the user's window open
}
