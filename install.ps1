#Requires -Version 5.1
<#
.SYNOPSIS
    ZenLeap Installer for Windows
.DESCRIPTION
    Downloads and installs fx-autoconfig and ZenLeap for Zen Browser on Windows.
    One-liner: irm https://raw.githubusercontent.com/yashas-salankimatt/ZenLeap/main/install.ps1 | iex
.PARAMETER Action
    install (default), uninstall, or check
.PARAMETER Profile
    Profile index (1-based). Omit to install to ALL profiles.
.PARAMETER Yes
    Auto-confirm all prompts (non-interactive mode).
#>
param(
    [ValidateSet("install", "uninstall", "check")]
    [string]$Action = "install",
    [int]$Profile = 0,
    [switch]$Yes
)

$ErrorActionPreference = "Stop"

# --- Configuration ---
$FxAutoconfigRepo = "https://github.com/MrOtherGuy/fx-autoconfig/archive/refs/heads/master.zip"
$ZenLeapScriptUrl = "https://raw.githubusercontent.com/yashas-salankimatt/ZenLeap/main/JS/zenleap.uc.js"
$ZenLeapCssUrl    = "https://raw.githubusercontent.com/yashas-salankimatt/ZenLeap/main/chrome.css"
$ZenLeapThemesUrl = "https://raw.githubusercontent.com/yashas-salankimatt/ZenLeap/main/zenleap-themes.json"
# Determine script directory (for local file detection)
$ScriptDir = if ($PSScriptRoot) { $PSScriptRoot } else { $PWD.Path }

# --- Helper functions ---
function Write-Status  { param([string]$Msg) Write-Host "[OK] $Msg" -ForegroundColor Green }
function Write-Warn    { param([string]$Msg) Write-Host "[!!] $Msg" -ForegroundColor Yellow }
function Write-Err     { param([string]$Msg) Write-Host "[ERR] $Msg" -ForegroundColor Red }
function Write-Info    { param([string]$Msg) Write-Host "  $Msg" -ForegroundColor Cyan }

function Get-Version {
    param([string]$FilePath)
    if (Test-Path $FilePath) {
        $content = Get-Content $FilePath -Raw
        if ($content -match '@version\s+([\d.]+)') {
            return $Matches[1]
        }
    }
    return $null
}

function Get-RemoteVersion {
    try {
        $content = Invoke-RestMethod -Uri $ZenLeapScriptUrl -UseBasicParsing
        if ($content -match '@version\s+([\d.]+)') {
            return $Matches[1]
        }
    } catch {}
    return $null
}

function Compare-Versions {
    param([string]$v1, [string]$v2)
    $parts1 = $v1.Split('.') | ForEach-Object { [int]$_ }
    $parts2 = $v2.Split('.') | ForEach-Object { [int]$_ }
    $max = [Math]::Max($parts1.Count, $parts2.Count)
    for ($i = 0; $i -lt $max; $i++) {
        $a = if ($i -lt $parts1.Count) { $parts1[$i] } else { 0 }
        $b = if ($i -lt $parts2.Count) { $parts2[$i] } else { 0 }
        if ($a -gt $b) { return 1 }
        if ($a -lt $b) { return -1 }
    }
    return 0
}

function Confirm-Action {
    param([string]$Prompt)
    if ($Yes) { return $true }
    $response = Read-Host "$Prompt (y/n)"
    return ($response -eq 'y' -or $response -eq 'Y')
}

function Test-IsAdmin {
    $principal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Request-Admin {
    if (-not (Test-IsAdmin)) {
        Write-Warn "fx-autoconfig installation requires Administrator privileges."
        Write-Info "The script will re-launch as Administrator to copy files to Program Files."

        # Build argument list to re-run this script elevated
        $scriptPath = $PSCommandPath
        if (-not $scriptPath) {
            # Running via irm | iex -- save script to temp and re-invoke
            Write-Err "Cannot self-elevate when run via 'irm | iex'."
            Write-Err "Please run PowerShell as Administrator and try again, or download and run:"
            Write-Info "  irm $ZenLeapScriptUrl -OutFile install.ps1; powershell -ExecutionPolicy Bypass -File install.ps1"
            exit 1
        }
        $argList = "-ExecutionPolicy Bypass -File `"$scriptPath`" -Action $Action"
        if ($Profile -gt 0) { $argList += " -Profile $Profile" }
        if ($Yes) { $argList += " -Yes" }

        Start-Process powershell -Verb RunAs -ArgumentList $argList -Wait
        exit $LASTEXITCODE
    }
}

# --- Detection ---
function Find-ZenInstall {
    # Check common install paths
    $candidates = @(
        "$env:ProgramFiles\Zen Browser",
        "${env:ProgramFiles(x86)}\Zen Browser",
        "$env:ProgramFiles\Zen",
        "${env:ProgramFiles(x86)}\Zen",
        "$env:LOCALAPPDATA\Zen Browser",
        "$env:LOCALAPPDATA\Zen"
    )

    foreach ($path in $candidates) {
        if (Test-Path "$path\zen.exe") {
            return $path
        }
    }

    # Check registry
    $regPaths = @(
        "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\zen.exe",
        "HKLM:\SOFTWARE\Zen Browser",
        "HKCU:\SOFTWARE\Zen Browser"
    )
    foreach ($regPath in $regPaths) {
        try {
            $val = (Get-ItemProperty -Path $regPath -ErrorAction SilentlyContinue).'(Default)'
            if ($val -and (Test-Path (Split-Path $val -Parent))) {
                return Split-Path $val -Parent
            }
        } catch {}
    }

    return $null
}

function Find-ZenProfiles {
    $profileBases = @(
        "$env:APPDATA\zen\Profiles",
        "$env:APPDATA\Zen Browser\Profiles"
    )

    foreach ($base in $profileBases) {
        if (Test-Path $base) {
            $profiles = Get-ChildItem -Path $base -Directory
            if ($profiles.Count -gt 0) {
                return @{
                    Base = $base
                    Profiles = $profiles
                }
            }
        }
    }
    return $null
}

function Stop-ZenBrowser {
    $zenProcs = Get-Process -Name "zen" -ErrorAction SilentlyContinue
    if ($zenProcs) {
        if (Confirm-Action "Zen Browser is running. Close it to continue?") {
            $zenProcs | ForEach-Object { $_.CloseMainWindow() | Out-Null }
            Start-Sleep -Seconds 2
            # Force kill if still running
            $zenProcs = Get-Process -Name "zen" -ErrorAction SilentlyContinue
            if ($zenProcs) {
                $zenProcs | Stop-Process -Force
                Start-Sleep -Seconds 1
            }
            Write-Status "Zen Browser closed"
            return $true
        } else {
            Write-Warn "Please close Zen Browser manually and run again."
            exit 1
        }
    }
    return $false
}

# --- fx-autoconfig ---
function Test-FxAutoconfig {
    param([string]$ChromeDir)
    return (Test-Path "$ChromeDir\utils\boot.sys.mjs") -or (Test-Path "$ChromeDir\utils\chrome.manifest")
}

function Install-FxAutoconfig {
    param([string]$ZenDir, [string]$ChromeDir)

    Write-Host ""
    Write-Info "Installing fx-autoconfig..."

    $tempDir = Join-Path $env:TEMP "fxautoconfig_$(Get-Random)"
    New-Item -Path $tempDir -ItemType Directory -Force | Out-Null

    try {
        # Download
        Write-Info "Downloading fx-autoconfig..."
        $zipPath = Join-Path $tempDir "fxautoconfig.zip"
        Invoke-WebRequest -Uri $FxAutoconfigRepo -OutFile $zipPath -UseBasicParsing

        # Extract
        Write-Info "Extracting..."
        Expand-Archive -Path $zipPath -DestinationPath $tempDir -Force

        $extracted = Get-ChildItem -Path $tempDir -Directory -Filter "fx-autoconfig*" | Select-Object -First 1
        if (-not $extracted) {
            throw "Could not find extracted fx-autoconfig files"
        }

        # Install program files to Zen directory
        $programDir = Join-Path $extracted.FullName "program"
        if (Test-Path $programDir) {
            $prefsDir = Join-Path $ZenDir "defaults\pref"
            if (-not (Test-Path $prefsDir)) {
                New-Item -Path $prefsDir -ItemType Directory -Force | Out-Null
            }
            Copy-Item -Path "$programDir\config.js" -Destination "$ZenDir\config.js" -Force
            Copy-Item -Path "$programDir\defaults\pref\config-prefs.js" -Destination "$prefsDir\config-prefs.js" -Force
            Write-Status "Installed fx-autoconfig program files to $ZenDir"
        }

        # Install profile chrome files
        $profileChrome = Join-Path $extracted.FullName "profile\chrome"
        if (Test-Path $profileChrome) {
            if (-not (Test-Path $ChromeDir)) {
                New-Item -Path $ChromeDir -ItemType Directory -Force | Out-Null
            }
            Copy-Item -Path "$profileChrome\*" -Destination $ChromeDir -Recurse -Force
            Write-Status "Installed fx-autoconfig profile files to $ChromeDir"
        }
    } finally {
        Remove-Item -Path $tempDir -Recurse -Force -ErrorAction SilentlyContinue
    }
}

function Uninstall-FxAutoconfig {
    param([string]$ZenDir, [string]$ChromeDir)

    Write-Info "Uninstalling fx-autoconfig..."
    $found = $false

    if (Test-Path "$ZenDir\config.js") {
        Remove-Item "$ZenDir\config.js" -Force
        Write-Status "Removed config.js"
        $found = $true
    }
    if (Test-Path "$ZenDir\defaults\pref\config-prefs.js") {
        Remove-Item "$ZenDir\defaults\pref\config-prefs.js" -Force
        Write-Status "Removed config-prefs.js"
        $found = $true
    }
    if (Test-Path "$ChromeDir\utils") {
        Remove-Item "$ChromeDir\utils" -Recurse -Force
        Write-Status "Removed chrome\utils\"
        $found = $true
    }

    if (-not $found) {
        Write-Warn "fx-autoconfig files not found"
    }
}

# --- ZenLeap ---
function Install-ZenLeap {
    param([string]$ProfileDir, [string]$ChromeDir)

    Write-Info "Installing ZenLeap..."

    $jsDir = Join-Path $ChromeDir "JS"
    if (-not (Test-Path $jsDir)) {
        New-Item -Path $jsDir -ItemType Directory -Force | Out-Null
    }

    # Determine source: local files (git clone) or remote download
    $localScript = Join-Path $ScriptDir "JS\zenleap.uc.js"
    $localCss = Join-Path $ScriptDir "chrome.css"
    $localThemes = Join-Path $ScriptDir "zenleap-themes.json"
    $useLocal = Test-Path $localScript

    # Install zenleap.uc.js
    if ($useLocal) {
        Write-Info "Using local zenleap.uc.js..."
        Copy-Item -Path $localScript -Destination "$jsDir\zenleap.uc.js" -Force
    } else {
        Write-Info "Downloading zenleap.uc.js..."
        Invoke-WebRequest -Uri $ZenLeapScriptUrl -OutFile "$jsDir\zenleap.uc.js" -UseBasicParsing
    }
    $version = Get-Version "$jsDir\zenleap.uc.js"
    Write-Status "Installed zenleap.uc.js (v$version)"

    # Install CSS
    $userChromeFile = Join-Path $ChromeDir "userChrome.css"
    if ($useLocal -and (Test-Path $localCss)) {
        Write-Info "Using local chrome.css..."
        $cssContent = Get-Content $localCss -Raw
    } else {
        Write-Info "Downloading chrome.css..."
        $cssContent = Invoke-RestMethod -Uri $ZenLeapCssUrl -UseBasicParsing
    }

    $zenleapBlock = "`n/* === ZenLeap Styles === */`n$cssContent`n/* === End ZenLeap Styles === */"
    if (Test-Path $userChromeFile) {
        # Remove old ZenLeap styles
        $existing = Get-Content $userChromeFile -Raw
        if ($existing -match '(?s)/\* === ZenLeap Styles === \*/.*?(/\* === End ZenLeap Styles === \*/)?') {
            $existing = $existing -replace '(?s)\r?\n?/\* === ZenLeap Styles === \*/.*?(/\* === End ZenLeap Styles === \*/)?', ''
        }
        Set-Content -Path $userChromeFile -Value ($existing + $zenleapBlock) -NoNewline
        Write-Status "Updated styles in userChrome.css"
    } else {
        Set-Content -Path $userChromeFile -Value "/* === ZenLeap Styles === */`n$cssContent`n/* === End ZenLeap Styles === */" -NoNewline
        Write-Status "Created userChrome.css with styles"
    }

    # Install themes template (don't overwrite user customizations)
    $themesFile = Join-Path $ChromeDir "zenleap-themes.json"
    if (-not (Test-Path $themesFile)) {
        if ($useLocal -and (Test-Path $localThemes)) {
            Copy-Item -Path $localThemes -Destination $themesFile -Force
            Write-Status "Created zenleap-themes.json template"
        } else {
            try {
                Invoke-WebRequest -Uri $ZenLeapThemesUrl -OutFile $themesFile -UseBasicParsing
                Write-Status "Created zenleap-themes.json template"
            } catch {
                Write-Warn "Could not download themes template (non-critical)"
            }
        }
    }

    # Set required preferences via user.js
    $userJs = Join-Path $ProfileDir "user.js"
    $pref = 'user_pref("toolkit.legacyUserProfileCustomizations.stylesheets", true);'

    if (Test-Path $userJs) {
        $content = Get-Content $userJs -Raw
        if ($content -notmatch 'toolkit\.legacyUserProfileCustomizations\.stylesheets') {
            Add-Content -Path $userJs -Value "`n$pref"
        }
    } else {
        Set-Content -Path $userJs -Value $pref
    }
    Write-Status "Set required preferences"
}

function Uninstall-ZenLeap {
    param([string]$ChromeDir)

    Write-Info "Uninstalling ZenLeap..."
    $found = $false

    $jsFile = Join-Path $ChromeDir "JS\zenleap.uc.js"
    if (Test-Path $jsFile) {
        Remove-Item $jsFile -Force
        Write-Status "Removed zenleap.uc.js"
        $found = $true
    } else {
        Write-Warn "zenleap.uc.js not found"
    }

    $userChromeFile = Join-Path $ChromeDir "userChrome.css"
    if (Test-Path $userChromeFile) {
        $content = Get-Content $userChromeFile -Raw
        if ($content -match 'ZenLeap Styles') {
            $content = $content -replace '(?s)\r?\n?/\* === ZenLeap Styles === \*/.*?(/\* === End ZenLeap Styles === \*/)?', ''
            Set-Content -Path $userChromeFile -Value $content -NoNewline
            Write-Status "Removed styles from userChrome.css"
            $found = $true
        } else {
            Write-Warn "ZenLeap styles not found in userChrome.css"
        }
    }

    if (-not $found) {
        Write-Warn "ZenLeap was not installed in this profile"
    }
}

# --- Cache ---
function Clear-StartupCache {
    Write-Host ""
    Write-Info "Clearing startup cache..."

    $cacheDirs = @(
        "$env:LOCALAPPDATA\zen",
        "$env:APPDATA\zen"
    )

    $cleared = $false
    foreach ($dir in $cacheDirs) {
        $startup = Join-Path $dir "startupCache"
        if (Test-Path $startup) {
            Remove-Item $startup -Recurse -Force -ErrorAction SilentlyContinue
            $cleared = $true
        }
    }

    # Also clear profile-level startup caches
    $profileData = Find-ZenProfiles
    if ($profileData) {
        foreach ($p in $profileData.Profiles) {
            $sc = Join-Path $p.FullName "startupCache"
            if (Test-Path $sc) {
                Remove-Item $sc -Recurse -Force -ErrorAction SilentlyContinue
                $cleared = $true
            }
        }
    }

    if ($cleared) {
        Write-Status "Startup cache cleared"
    } else {
        Write-Warn "No startup cache found (this is OK)"
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

# --- Main ---
function Main {
    if ($Action -ne "check") { Show-Banner }

    # Find Zen Browser
    $zenDir = Find-ZenInstall
    if (-not $zenDir) {
        Write-Err "Could not find Zen Browser installation."
        Write-Info "Please install Zen Browser first: https://zen-browser.app/"
        Write-Info "Checked: Program Files\Zen Browser, Program Files\Zen, LocalAppData\Zen Browser"
        exit 1
    }
    Write-Status "Found Zen Browser at: $zenDir"

    # Find profiles
    $profileData = Find-ZenProfiles
    if (-not $profileData) {
        Write-Err "Could not find any Zen Browser profiles."
        Write-Info "Please run Zen Browser at least once to create a profile."
        Write-Info "Checked: $env:APPDATA\zen\Profiles, $env:APPDATA\Zen Browser\Profiles"
        exit 1
    }

    $allProfiles = $profileData.Profiles

    # Select profiles
    if ($Profile -gt 0) {
        if ($Profile -gt $allProfiles.Count) {
            Write-Err "Invalid profile index $Profile (valid range: 1-$($allProfiles.Count))"
            exit 1
        }
        $selectedProfiles = @($allProfiles[$Profile - 1])
        Write-Status "Selected profile (index $Profile): $($selectedProfiles[0].Name)"
    } else {
        $selectedProfiles = $allProfiles
        if ($selectedProfiles.Count -eq 1) {
            Write-Status "Found profile: $($selectedProfiles[0].Name)"
        } else {
            Write-Status "Found $($selectedProfiles.Count) profiles (operating on all):"
            foreach ($p in $selectedProfiles) {
                $jsFile = Join-Path $p.FullName "chrome\JS\zenleap.uc.js"
                $status = if (Test-Path $jsFile) { " (ZenLeap installed)" } else { "" }
                Write-Host "    - $($p.Name)$status"
            }
        }
    }

    switch ($Action) {
        "install" {
            $zenWasRunning = $null -ne (Get-Process -Name "zen" -ErrorAction SilentlyContinue)
            Stop-ZenBrowser | Out-Null

            # Check if we need admin for fx-autoconfig
            $firstChromeDir = Join-Path $selectedProfiles[0].FullName "chrome"
            if (-not (Test-FxAutoconfig $firstChromeDir)) {
                # Need to install fx-autoconfig -- requires admin for Program Files
                if (-not (Test-IsAdmin)) {
                    Request-Admin
                    return
                }
            } else {
                # fx-autoconfig already installed; check if config.js exists in Zen dir
                if (-not (Test-Path "$zenDir\config.js") -and -not (Test-IsAdmin)) {
                    Request-Admin
                    return
                }
            }

            # Install to each profile
            foreach ($p in $selectedProfiles) {
                $profileDir = $p.FullName
                $chromeDir = Join-Path $profileDir "chrome"

                Write-Host ""
                Write-Host "--- $($p.Name) ---" -ForegroundColor Blue

                if (-not (Test-FxAutoconfig $chromeDir)) {
                    Install-FxAutoconfig -ZenDir $zenDir -ChromeDir $chromeDir
                } else {
                    Write-Status "fx-autoconfig already installed"
                }

                Install-ZenLeap -ProfileDir $profileDir -ChromeDir $chromeDir
            }

            Clear-StartupCache

            Write-Host ""
            Write-Host "=============================================" -ForegroundColor Green
            Write-Host "          Installation Complete!               " -ForegroundColor Green
            Write-Host "=============================================" -ForegroundColor Green
            Write-Host ""
            Write-Host "Usage:" -ForegroundColor Blue
            Write-Host "  Ctrl+Space     Enter leap mode"
            Write-Host "  j/k or Up/Dn   Browse tabs"
            Write-Host "  Enter          Open selected tab"
            Write-Host "  x              Close selected tab"
            Write-Host "  gg             Go to first tab"
            Write-Host "  G              Go to last tab"
            Write-Host "  g{num}         Go to tab number"
            Write-Host "  zz/zt/zb       Scroll center/top/bottom"
            Write-Host "  Escape         Cancel"
            Write-Host ""

            if ($zenWasRunning) {
                Write-Info "Restarting Zen Browser..."
                Start-Process "$zenDir\zen.exe"
                Write-Status "Zen Browser restarted"
            } elseif ($Yes) {
                Write-Warn "Please start Zen Browser to activate ZenLeap"
            } else {
                if (Confirm-Action "Open Zen Browser now?") {
                    Start-Process "$zenDir\zen.exe"
                } else {
                    Write-Warn "Please start Zen Browser to activate ZenLeap"
                }
            }
        }

        "uninstall" {
            $zenWasRunning = $null -ne (Get-Process -Name "zen" -ErrorAction SilentlyContinue)
            Stop-ZenBrowser | Out-Null

            # Uninstalling fx-autoconfig from Program Files needs admin
            if (-not (Test-IsAdmin)) {
                Request-Admin
                return
            }

            foreach ($p in $selectedProfiles) {
                $chromeDir = Join-Path $p.FullName "chrome"

                Write-Host ""
                Write-Host "--- $($p.Name) ---" -ForegroundColor Blue
                Uninstall-ZenLeap -ChromeDir $chromeDir
                Uninstall-FxAutoconfig -ZenDir $zenDir -ChromeDir $chromeDir
            }

            Clear-StartupCache

            Write-Host ""
            Write-Status "Uninstallation complete!"

            if ($zenWasRunning -and -not $Yes) {
                if (Confirm-Action "Reopen Zen Browser?") {
                    Start-Process "$zenDir\zen.exe"
                }
            } else {
                Write-Warn "Please restart Zen Browser if it's running."
            }
        }

        "check" {
            $remoteVersion = Get-RemoteVersion
            $anyOutdated = $false

            foreach ($p in $selectedProfiles) {
                $jsFile = Join-Path $p.FullName "chrome\JS\zenleap.uc.js"
                $installedVersion = Get-Version $jsFile

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

            if ($anyOutdated) { exit 1 }
            exit 0
        }
    }
}

Main
