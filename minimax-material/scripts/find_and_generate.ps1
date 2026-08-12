#Requires -Version 5.1
# Scan THIS Windows PC for MiniMax already installed in Cursor / mmx / Hub.
# Run locally (or on private-worker Cursor agent):
#   powershell -ExecutionPolicy Bypass -File .\find_and_generate.ps1
#
# Prints paths + masked keys only (never full secrets).

$ErrorActionPreference = 'Continue'
$User = $env:USERNAME
$HomeDir = $env:USERPROFILE

Write-Host "=== MiniMax / Hailuo / mmx scan for $HomeDir ==="
Write-Host ""

function Mask([string]$v) {
  if (-not $v) { return $null }
  $n = $v.Length
  $pref = $v.Substring(0, [Math]::Min(8, $n))
  return "$pref... (len=$n)"
}

function Show-JsonMiniMax([string]$path) {
  if (-not (Test-Path $path)) {
    Write-Host "absent: $path"
    return
  }
  Write-Host "FOUND file: $path"
  try {
    $raw = Get-Content -Raw -Path $path
    $j = $raw | ConvertFrom-Json
    $servers = $j.mcpServers
    if (-not $servers) { $servers = $j.mcp }
    if (-not $servers) {
      Write-Host "  (no mcpServers key)"
      return
    }
    $names = @($servers.PSObject.Properties.Name)
    Write-Host "  MCP servers: $($names -join ', ')"
    foreach ($name in $names) {
      if ($name -notmatch '(?i)minimax|hailuo|mmx') { continue }
      $s = $servers.$name
      Write-Host "  --- server '$name' ---"
      Write-Host "  command: $($s.command)"
      Write-Host "  args: $($s.args -join ' ')"
      if ($s.env) {
        foreach ($ek in $s.env.PSObject.Properties.Name) {
          $ev = [string]$s.env.$ek
          if ($ek -match '(?i)key|token|secret') {
            Write-Host "  env.$ek = $(Mask $ev)"
          } else {
            Write-Host "  env.$ek = $ev"
          }
        }
      }
    }
  } catch {
    Write-Host "  parse error: $($_.Exception.Message)"
  }
}

Write-Host "--- Cursor MCP configs ---"
$mcpCandidates = @(
  "$HomeDir\.cursor\mcp.json",
  "$HomeDir\.cursor\mcp\mcp.json",
  "$env:APPDATA\Cursor\User\globalStorage\cursor.mcp\mcp.json",
  "$env:APPDATA\Cursor\User\settings.json",
  "$HomeDir\AppData\Roaming\Cursor\User\globalStorage\cursor.mcp\mcp.json",
  "$HomeDir\OneDrive\Desktop\manager\hops-and-honey-bar-manager-3d\.cursor\mcp.json",
  "$HomeDir\OneDrive\Desktop\manager\.cursor\mcp.json"
)
foreach ($p in $mcpCandidates) { Show-JsonMiniMax $p }

Write-Host ""
Write-Host "--- Claude Desktop (sometimes shares MiniMax MCP) ---"
Show-JsonMiniMax "$env:APPDATA\Claude\claude_desktop_config.json"

Write-Host ""
Write-Host "--- mmx CLI config ---"
$mmxPaths = @(
  "$HomeDir\.mmx\config.json",
  "$HomeDir\.mmx\credentials.json",
  "$env:APPDATA\mmx\config.json",
  "$env:LOCALAPPDATA\mmx\config.json"
)
foreach ($p in $mmxPaths) {
  if (Test-Path $p) {
    Write-Host "FOUND: $p"
    try {
      $j = Get-Content -Raw $p | ConvertFrom-Json
      if ($j.api_key) { Write-Host "  api_key = $(Mask $j.api_key)" }
      if ($j.apiKey) { Write-Host "  apiKey = $(Mask $j.apiKey)" }
      if ($j.region) { Write-Host "  region = $($j.region)" }
      if ($j.method) { Write-Host "  method = $($j.method)" }
    } catch { Write-Host "  (unreadable json)" }
  } else {
    Write-Host "absent: $p"
  }
}

Write-Host ""
Write-Host "--- Environment variables ---"
$envNames = @(
  'MINIMAX_API_KEY','MINIMAX_KEY','MMX_API_KEY','HAILUO_API_KEY',
  'MINIMAX_API_HOST','MINIMAX_MCP_BASE_PATH','MINIMAX_API_RESOURCE_MODE',
  'KIE_API_KEY','KIE_KEY','KIE_AI_API_KEY','FAL_KEY','FAL_API_KEY'
)
foreach ($n in $envNames) {
  $v = [Environment]::GetEnvironmentVariable($n, 'Process')
  if (-not $v) { $v = [Environment]::GetEnvironmentVariable($n, 'User') }
  if (-not $v) { $v = [Environment]::GetEnvironmentVariable($n, 'Machine') }
  if ($v) { Write-Host "FOUND env $n = $(Mask $v)" }
  else { Write-Host "missing env $n" }
}

Write-Host ""
Write-Host "--- Apps / skills ---"
$appPaths = @(
  "$env:LOCALAPPDATA\Programs\MiniMax Hub",
  "$env:LOCALAPPDATA\MiniMax",
  "$env:LOCALAPPDATA\Hailuo",
  "$HomeDir\.agents\skills\mmx-cli",
  "$HomeDir\.cursor\skills\mmx-cli",
  "$HomeDir\.codex\skills"
)
foreach ($p in $appPaths) {
  if (Test-Path $p) { Write-Host "EXISTS: $p" } else { Write-Host "absent: $p" }
}

$mmxCmd = Get-Command mmx -ErrorAction SilentlyContinue
$uvxCmd = Get-Command uvx -ErrorAction SilentlyContinue
if ($mmxCmd) { Write-Host "mmx CLI: $($mmxCmd.Source)" } else { Write-Host "mmx CLI: not on PATH" }
if ($uvxCmd) { Write-Host "uvx: $($uvxCmd.Source)" } else { Write-Host "uvx: not on PATH" }

Write-Host ""
Write-Host "=== Done. If MiniMax MCP key was found above, save it for cloud/mmx: ==="
Write-Host '  mmx auth login --api-key $env:MINIMAX_API_KEY'
Write-Host '  # or copy key from mcp.json env.MINIMAX_API_KEY into User env'
Write-Host 'Then: bash minimax-material/scripts/generate_handstand.sh'
