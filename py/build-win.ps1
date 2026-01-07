param(
    [switch]$SkipCopy
)

$ErrorActionPreference = 'Stop'

$scriptPath = $MyInvocation.MyCommand.Path
$pyRoot = Split-Path -Parent $scriptPath
$repoRoot = Split-Path -Parent $pyRoot
$desktopRoot = Join-Path $repoRoot 'desktop'

$distDir = Join-Path $pyRoot 'dist\win32'
$workDir = Join-Path $pyRoot '.pyinstaller_build'
$specDir = Join-Path $pyRoot '.pyinstaller_spec'
$srcFile = Join-Path $pyRoot 'src\ttf2woff2.py'
$desktopTarget = Join-Path $desktopRoot 'py\win32'

Write-Host '== 构建 Windows ttf2woff2.exe =='
uv run pyinstaller `
    --noconfirm `
    --onefile `
    --name ttf2woff2 `
    --distpath $distDir `
    --workpath $workDir `
    --specpath $specDir `
    $srcFile

if (-not $SkipCopy) {
    Write-Host '== 同步到 desktop/py/win32 ==' 
    New-Item -ItemType Directory -Path $desktopTarget -Force | Out-Null
    Copy-Item -Path (Join-Path $distDir 'ttf2woff2.exe') -Destination $desktopTarget -Force
}

Write-Host '完成'
