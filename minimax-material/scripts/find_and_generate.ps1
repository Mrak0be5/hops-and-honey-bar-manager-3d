#Requires -Version 5.1
# Find MiniMax / Hailuo / related credentials on this Windows PC and optionally run generation.
# Usage (on the user's PC / private worker):
#   powershell -ExecutionPolicy Bypass -File .\find_and_generate.ps1

$ErrorActionPreference = 'Continue'
Write-Host '=== Searching MiniMax / Hailuo / KIE on this PC ==='

$envNames = @(
  'MINIMAX_API_KEY', 'MINIMAX_KEY', 'MMX_API_KEY', 'HAILUO_API_KEY',
  'KIE_API_KEY', 'KIE_KEY', 'KIE_AI_API_KEY', 'FAL_KEY', 'FAL_API_KEY'
)

function Get-UserEnv([string]$Name) {
  [Environment]::GetEnvironmentVariable($Name, 'User')
}
function Get-MachineEnv([string]$Name) {
  [Environment]::GetEnvironmentVariable($Name, 'Machine')
}

$found = @{}
foreach ($n in $envNames) {
  $v = $env:$n
  if (-not $v) { $v = Get-UserEnv $n }
  if (-not $v) { $v = Get-MachineEnv $n }
  if ($v) {
    $found[$n] = $true
    Write-Host "FOUND env: $n (length=$($v.Length), prefix=$($v.Substring(0, [Math]::Min(6, $v.Length)))...)"
  } else {
    Write-Host "missing env: $n"
  }
}

$paths = @(
  "$env:USERPROFILE\.mmx",
  "$env:APPDATA\mmx",
  "$env:LOCALAPPDATA\mmx",
  "$env:LOCALAPPDATA\MiniMax",
  "$env:LOCALAPPDATA\Hailuo",
  "$env:LOCALAPPDATA\Programs\MiniMax Hub",
  "$env:USERPROFILE\AppData\Local\cursor-agent\artifacts\assets"
)
Write-Host ''
Write-Host '=== Paths ==='
foreach ($p in $paths) {
  if (Test-Path $p) { Write-Host "EXISTS: $p" } else { Write-Host "absent: $p" }
}

Write-Host ''
Write-Host '=== Apps / shortcuts ==='
Get-ChildItem "$env:APPDATA\Microsoft\Windows\Start Menu\Programs" -Recurse -ErrorAction SilentlyContinue |
  Where-Object { $_.Name -match 'MiniMax|Hailuo|mmx' } |
  ForEach-Object { Write-Host $_.FullName }

$mmx = Get-Command mmx -ErrorAction SilentlyContinue
if ($mmx) {
  Write-Host "mmx CLI: $($mmx.Source)"
} else {
  Write-Host 'mmx CLI not on PATH'
}

if ($found.ContainsKey('MINIMAX_API_KEY') -or $found.ContainsKey('MINIMAX_KEY') -or $found.ContainsKey('MMX_API_KEY')) {
  Write-Host ''
  Write-Host 'MiniMax key found. To generate, from repo root:'
  Write-Host '  bash minimax-material/scripts/generate_handstand.sh'
  Write-Host 'Or after saving key:'
  Write-Host '  mmx config set --key api_key --value $env:MINIMAX_API_KEY'
} else {
  Write-Host ''
  Write-Host 'No MiniMax API key in environment.'
  Write-Host 'Create one at https://platform.minimax.io/ then:'
  Write-Host '  [Environment]::SetEnvironmentVariable("MINIMAX_API_KEY","sk-...","User")'
  Write-Host '  mmx auth login --api-key $env:MINIMAX_API_KEY'
}
