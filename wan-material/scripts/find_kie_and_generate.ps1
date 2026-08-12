# Find KIE_API_KEY on this Windows PC and run Wan 2.7 sofa generation.
$ErrorActionPreference = 'Continue'
$Root = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
if (-not (Test-Path (Join-Path $PSScriptRoot '..\prompts\sofa-red-i2v.txt'))) {
  $Root = Resolve-Path (Join-Path $PSScriptRoot '..')
} else {
  $Root = Resolve-Path (Join-Path $PSScriptRoot '..')
}

function Mask([string]$v) {
  if (-not $v) { return '(empty)' }
  if ($v.Length -le 10) { return '***' }
  return $v.Substring(0,6) + '***' + $v.Substring($v.Length-4)
}

$names = @('KIE_API_KEY','KIE_KEY','KIE_AI_API_KEY')
$key = $null
foreach ($n in $names) {
  foreach ($scope in @('Process','User','Machine')) {
    $v = [Environment]::GetEnvironmentVariable($n, $scope)
    if ($v) {
      Write-Host "Found $n ($scope): $(Mask $v)"
      if (-not $key) { $key = $v }
    }
  }
}

$mcp = Join-Path $env:USERPROFILE '.cursor\mcp.json'
if (Test-Path $mcp) {
  Write-Host "Checking $mcp"
  $raw = Get-Content $mcp -Raw
  if ($raw -match 'KIE') { Write-Host 'mcp.json mentions KIE (not printing secrets)' }
}

if (-not $key) {
  Write-Host 'No KIE_API_KEY found. Get one at https://kie.ai/api-key and set User env KIE_API_KEY.'
  exit 1
}

$env:KIE_API_KEY = $key
$env:MODE = $(if ($env:MODE) { $env:MODE } else { 'i2v' })
Write-Host "Running Wan 2.7 sofa pipeline MODE=$($env:MODE)"
python "$Root\scripts\generate_sofa_red.py" --mode $env:MODE
