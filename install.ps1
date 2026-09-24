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
    Profile(s) to use: a number from the list, a profile name, or "all".
    Default: the profile Zen opens by default plus every profile that already
    has ZenLeap (interactive runs show the list first).
.PARAMETER ProfileDir
    Use this profile directory directly.
.PARAMETER ZenPath
    Zen Browser installation directory (the folder containing zen.exe).
.PARAMETER Remote
    Install the latest release from GitHub (verified against the release's
    CHECKSUMS.sha256) even when the script sits in a ZenLeap checkout.
.PARAMETER Yes
    Don't ask questions (non-interactive mode).
.PARAMETER RemoveFxAutoconfig
    Also remove fx-autoconfig when uninstalling.
#>
param(
    [ValidateSet("install", "uninstall", "check")]
    [string]$Action = "install",
    [string]$Profile = "",
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
$FxAutoconfigRepo = "https://github.com/MrOtherGuy/fx-autoconfig/archive/refs/heads/master.zip"
$SineModId        = "zenleap-relative-tab-nav"
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

# Zen keeps profiles in %APPDATA%\zen (profiles.ini, Profiles\...) and their
# local data (startupCache) in %LOCALAPPDATA%\zen\Profiles\... The default
# profile is the install's [Install*] Default= entry, not the Default=1 one.
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
        $first = $all.Count
        $installDefaults = New-Object System.Collections.ArrayList
        $flagged = $null
        foreach ($s in (Read-IniSections $ini)) {
            if ($s.Name -match '^Profile\d+$') {
                $path = $s.Values['Path']
                if (-not $path) { continue }
                if ($s.Values['IsRelative'] -eq '0') {
                    $dir = $path
                    $local = $path
                } else {
                    $dir = Join-ProfilePath $root $path
                    $local = Join-ProfilePath $localRoot $path
                }
                if (-not (Test-Path -LiteralPath $dir -PathType Container)) { continue }
                if (@($all | Where-Object { $_.Dir -eq $dir }).Count -gt 0) { continue }
                $name = $s.Values['Name']
                if (-not $name) { $name = Split-Path $dir -Leaf }
                [void]$all.Add([pscustomobject]@{ Name = $name; Dir = $dir; LocalDir = $local; Raw = $path; Root = $root })
                if ($s.Values['Default'] -eq '1') { $flagged = $path }
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

        if (-not $primaryRoot -and $all.Count -gt $first) {
            $primaryRoot = $root
            $matchIdx = New-Object System.Collections.ArrayList
            foreach ($want in $installDefaults) {
                for ($i = $first; $i -lt $all.Count; $i++) {
                    if ($all[$i].Raw -eq $want -and -not $matchIdx.Contains($i)) { [void]$matchIdx.Add($i) }
                }
            }
            if ($matchIdx.Count -gt 1 -and $ZenDir) {
                # Several installs share this root: prefer the one last run from $ZenDir
                foreach ($i in $matchIdx) {
                    $compat = Join-Path $all[$i].Dir "compatibility.ini"
                    if (Test-Path -LiteralPath $compat) {
                        $line = @([IO.File]::ReadAllLines($compat) | Where-Object { $_ -like 'LastPlatformDir=*' })[0]
                        if ($line -and $line.Substring(16).TrimEnd('\', '/') -eq $ZenDir.TrimEnd('\', '/')) {
                            $default = $i
                            break
                        }
                    }
                }
            }
            if ($default -lt 0 -and $matchIdx.Count -gt 0) { $default = $matchIdx[0] }
            if ($default -lt 0 -and $flagged) {
                for ($i = $first; $i -lt $all.Count; $i++) {
                    if ($all[$i].Raw -eq $flagged) { $default = $i; break }
                }
            }
            if ($default -lt 0) { $default = $first }
        }
    }

    if ($all.Count -eq 0) {
        # No usable profiles.ini: directories that look like profiles
        foreach ($root in $roots) {
            $base = Join-Path $root "Profiles"
            if (-not (Test-Path -LiteralPath $base)) { continue }
            foreach ($d in @(Get-ChildItem -LiteralPath $base -Directory)) {
                if ((Test-Path -LiteralPath (Join-Path $d.FullName "prefs.js")) -or (Test-Path -LiteralPath (Join-Path $d.FullName "times.json"))) {
                    [void]$all.Add([pscustomobject]@{ Name = $d.Name; Dir = $d.FullName; LocalDir = (Join-Path (Join-Path $localRoot "Profiles") $d.Name); Raw = "Profiles/$($d.Name)"; Root = $root })
                }
            }
            if ($all.Count -gt 0) { $primaryRoot = $root; break }
        }
        if ($all.Count -eq 1) { $default = 0 }
    }

    if ($all.Count -eq 0) { return $null }
    return @{ Root = $primaryRoot; Profiles = @($all); Default = $default }
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
function Get-FxAutoconfig {
    if ($script:FxSrc) { return $true }
    if ($script:FxFailed) { return $false }
    $script:FxFailed = $true
    try {
        $dir = Join-Path (Get-WorkDir) "fxac-download"
        New-Item -Path $dir -ItemType Directory -Force | Out-Null
        Write-Info "Downloading fx-autoconfig..."
        $zipPath = Join-Path $dir "fxautoconfig.zip"
        Invoke-WebRequest -Uri $FxAutoconfigRepo -OutFile $zipPath -UseBasicParsing
        Expand-Archive -LiteralPath $zipPath -DestinationPath $dir -Force
        $extracted = Get-ChildItem -LiteralPath $dir -Directory | Where-Object { $_.Name -like "fx-autoconfig*" } | Select-Object -First 1
        if (-not $extracted) { return $false }
        $boot = Join-Path (Join-Path (Join-Path (Join-Path $extracted.FullName "profile") "chrome") "utils") "boot.sys.mjs"
        if (-not (Test-Path -LiteralPath $boot)) { return $false }
        $script:FxSrc = $extracted.FullName
        $script:FxVersion = Get-Version $boot
        $script:FxFailed = $false
        return $true
    } catch {
        return $false
    }
}

# fx-autoconfig's program files (config.js, defaults\pref\config-prefs.js) go
# into the Zen installation directory, once for all profiles.
function Install-FxAutoconfigProgram {
    param([string]$ZenDir)
    $configJs = Join-Path $ZenDir "config.js"
    $prefsDir = Join-Path (Join-Path $ZenDir "defaults") "pref"
    $prefsJs = Join-Path $prefsDir "config-prefs.js"

    if (Test-Path -LiteralPath $configJs) {
        $content = Get-Content -LiteralPath $configJs -Raw
        if ($content -notmatch 'userchromejs/content/boot') {
            Write-Warn "$configJs is not fx-autoconfig's (Sine's or another loader's); leaving it alone."
            Write-Info "ZenLeap in chrome\JS only runs if that config.js also loads fx-autoconfig."
            return
        }
        if ($content -match 'boot\.sys\.mjs' -and (Test-Path -LiteralPath $prefsJs)) {
            Write-Status "fx-autoconfig is set up in the Zen installation"
            return
        }
    }

    Write-Info "Installing fx-autoconfig into the Zen installation..."
    if (-not (Get-FxAutoconfig)) {
        Write-Err "Failed to download fx-autoconfig"
        Stop-Installer 1
    }
    $srcConfig = Join-Path (Join-Path $script:FxSrc "program") "config.js"
    $srcPrefs = Join-Path (Join-Path (Join-Path (Join-Path $script:FxSrc "program") "defaults") "pref") "config-prefs.js"
    try {
        New-Item -Path $prefsDir -ItemType Directory -Force | Out-Null
        Copy-Item -LiteralPath $srcConfig -Destination $configJs -Force
        Copy-Item -LiteralPath $srcPrefs -Destination $prefsJs -Force
        Write-Status "Installed fx-autoconfig program files into $ZenDir"
        return
    } catch {}

    # Needs administrator rights. Stage the files where they survive this run.
    $stage = Join-Path (Join-Path "$env:LOCALAPPDATA" "zenleap") "fx-autoconfig-program"
    New-Item -Path $stage -ItemType Directory -Force | Out-Null
    Copy-Item -LiteralPath $srcConfig -Destination (Join-Path $stage "config.js") -Force
    Copy-Item -LiteralPath $srcPrefs -Destination (Join-Path $stage "config-prefs.js") -Force
    $commands = @(
        "New-Item -ItemType Directory -Force -Path $(ConvertTo-Literal $prefsDir) | Out-Null",
        "Copy-Item -LiteralPath $(ConvertTo-Literal (Join-Path $stage 'config.js')) -Destination $(ConvertTo-Literal $configJs) -Force",
        "Copy-Item -LiteralPath $(ConvertTo-Literal (Join-Path $stage 'config-prefs.js')) -Destination $(ConvertTo-Literal $prefsJs) -Force"
    )
    Write-Warn "Copying fx-autoconfig into $ZenDir needs administrator rights."
    if (-not $Yes -and (Confirm-Action "Copy it now with administrator rights (Windows will ask for permission)?" $true)) {
        if ((Invoke-Elevated ($commands -join "; ")) -and (Test-Path -LiteralPath $configJs) -and (Test-Path -LiteralPath $prefsJs)) {
            Write-Status "Installed fx-autoconfig program files into $ZenDir"
            return
        }
        Write-Warn "Could not copy the files with administrator rights."
    }
    $script:FxProgramCommands = $commands
    Write-Info "Run these commands in PowerShell opened with 'Run as administrator':"
    Write-Host ""
    foreach ($c in $commands) { Write-Host "    $c" }
    Write-Host ""
}

# fx-autoconfig's loader in the profile: chrome\utils only (the rest of its
# profile folder is examples). Offers to update an outdated loader.
function Install-FxAutoconfigProfile {
    param([string]$ChromeDir)
    $utils = Join-Path $ChromeDir "utils"
    $boot = Join-Path $utils "boot.sys.mjs"
    if ((Test-Path -LiteralPath $boot) -or (Test-Path -LiteralPath (Join-Path $utils "boot.jsm"))) {
        $have = Get-Version $boot
        if (-not (Get-FxAutoconfig)) {
            Write-Warn "Could not download fx-autoconfig to check for loader updates; keeping the installed one"
            return
        }
        if ($have -and (Compare-Versions $have $script:FxVersion) -ge 0) {
            Write-Status "fx-autoconfig loader $have (up to date)"
            return
        }
        $shown = $(if ($have) { $have } else { "pre-0.8" })
        Write-Warn "This profile's fx-autoconfig loader is outdated ($shown < $($script:FxVersion))."
        if (-not (Confirm-Action "  Update chrome\utils to $($script:FxVersion)?" $true)) {
            Write-Info "Keeping the installed loader"
            return
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
        Write-Err "Failed to download fx-autoconfig"
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
    if (-not (Test-Path -LiteralPath $configJs)) { return }
    if ((Get-Content -LiteralPath $configJs -Raw) -notmatch 'userchromejs/content/boot') {
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
# Installers before 3.5 appended chrome.css to userChrome.css between these
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
    param($P, [string]$SourceDir)
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
        Copy-Item -LiteralPath $srcJs -Destination (Join-Path (Join-Path $sineDir "JS") "zenleap.uc.js") -Force
        $srcCss = Join-Path $SourceDir "chrome.css"
        if (Test-Path -LiteralPath $srcCss) { Copy-Item -LiteralPath $srcCss -Destination (Join-Path $sineDir "chrome.css") -Force }
        if (Test-Path -LiteralPath $srcThemes) { Copy-Item -LiteralPath $srcThemes -Destination (Join-Path $sineDir "zenleap-themes.json") -Force }
        Write-Status "Updated Sine-managed zenleap.uc.js (v$version)"
        return $true
    }
    if (Test-UsesSine $P.Dir) {
        Write-Warn "This profile loads scripts through Sine, which does not run scripts from chrome\JS."
        Write-Info "Install ZenLeap from Sine instead (Sine mods page -> install yashas-salankimatt/ZenLeap)."
        return $false
    }

    Install-FxAutoconfigProfile $chromeDir

    $jsDir = Join-Path $chromeDir "JS"
    New-Item -Path $jsDir -ItemType Directory -Force | Out-Null
    Copy-Item -LiteralPath $srcJs -Destination (Join-Path $jsDir "zenleap.uc.js") -Force
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
function Clear-StartupCache {
    param($Profiles)
    Write-Host ""
    Write-Info "Clearing startup cache..."
    $cleared = $false
    foreach ($p in $Profiles) {
        foreach ($dir in @($p.LocalDir, $p.Dir)) {
            $sc = Join-Path $dir "startupCache"
            if (Test-Path -LiteralPath $sc) {
                Remove-Item -LiteralPath $sc -Recurse -Force -ErrorAction SilentlyContinue
                $cleared = $true
            }
        }
    }
    if ($cleared) {
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

    # Find Zen Browser (needed to install fx-autoconfig; optional otherwise)
    $zenDir = Find-ZenInstall
    if ($zenDir) {
        if ($Action -ne "check") { Write-Status "Found Zen Browser at: $zenDir" }
    } elseif ($Action -eq "install") {
        Write-Err "Could not find Zen Browser installation."
        Write-Info "Install Zen Browser first (https://zen-browser.app/), or pass -ZenPath <folder containing zen.exe>."
        Stop-Installer 1
    }

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

            $needsFx = @($selected | Where-Object { -not (Get-SineZenLeapDir $_.Dir) -and -not (Test-UsesSine $_.Dir) }).Count -gt 0
            if ($needsFx) { Install-FxAutoconfigProgram $zenDir }

            $installed = 0
            foreach ($p in $selected) {
                Write-Host ""
                Write-Host "--- $($p.Name) ---" -ForegroundColor Blue
                if (Install-ZenLeap $p $sourceDir) { $installed++ }
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
            } elseif (Confirm-Action "Open Zen Browser now?") {
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
            if ($zenDir -and (Test-Path -LiteralPath (Join-Path $zenDir "config.js"))) {
                if ((Get-Content -LiteralPath (Join-Path $zenDir "config.js") -Raw) -match 'userchromejs/content/boot') { $hasFx = $true }
            }
            $removeFx = $false
            if ($hasFx) {
                if ($Yes) {
                    $removeFx = [bool]$RemoveFxAutoconfig
                    if (-not $removeFx) { Write-Warn "Skipping fx-autoconfig removal (use -RemoveFxAutoconfig to include)" }
                } else {
                    $removeFx = Confirm-Action "Also remove fx-autoconfig? Other userscripts may depend on it"
                }
            }
            if ($removeFx) {
                foreach ($p in $selected) { Uninstall-FxAutoconfigProfile $p.Dir }
                Uninstall-FxAutoconfigProgram $zenDir
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
