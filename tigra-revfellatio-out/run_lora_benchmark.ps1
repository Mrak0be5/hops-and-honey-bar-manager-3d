# Benchmark reverse-facefuck LoRAs with Tigra — 10 gens each (JSON template based)
$ErrorActionPreference = "Stop"
$outRoot = "C:\Users\hebp\OneDrive\Desktop\manager\hops-and-honey-bar-manager-3d\tigra-revfellatio-out"
$manifestPath = Join-Path $outRoot "lora_manifest.json"
$tplPath = Join-Path $outRoot "wf_template.json"
$resultsPath = Join-Path $outRoot "benchmark_results.json"
$loraDir = "C:\Users\hebp\AppData\Roaming\StabilityMatrix\Models\Lora"

$manifest = Get-Content $manifestPath -Raw | ConvertFrom-Json
$seen = @{}
$loras = @()
foreach ($m in $manifest) {
  if ($seen.ContainsKey([string]$m.file)) { continue }
  $seen[[string]$m.file] = $true
  $path = Join-Path $loraDir $m.file
  if (-not (Test-Path $path)) { Write-Host "SKIP missing $($m.file)"; continue }
  if ((Get-Item $path).Length -lt 5MB) { Write-Host "SKIP tiny $($m.file)"; continue }
  $loras += $m
}

$posBase = @"
score_9, score_8_up, score_7_up, score_6_up,
1girl, 1boy, {TRIGGERS}, deepthroat, irrumatio, uncensored,
close-up face, POV looking down at upside-down face,
anthro tigress lying supine on couch, head hanging off front edge of couch, upside-down face,
huge human penis deep in throat, cock fully inside open mouth, lips wrapped around shaft, balls against nose, saliva dripping,
nude, completely nude,
(((white bob cut))), (((short white hair))), white bangs, yellow orange tiger fur, black stripes, white muzzle, tiger ears,
watery green eyes looking at viewer, looking at camera, pitiful pleading expression, tears, blush,
illustration of wnw2, ((extreme detailed tiger woman face)), anthro, female, tiger, detailed fur,
brown leather couch, soft window light
"@

function Wait-Prompt([string]$id, [int]$timeoutSec = 240) {
  $deadline = (Get-Date).AddSeconds($timeoutSec)
  while ((Get-Date) -lt $deadline) {
    try {
      $h = Invoke-RestMethod -Uri "http://127.0.0.1:8188/history/$id" -TimeoutSec 5
      if ($h.PSObject.Properties.Name -contains $id -or $h.$id) {
        $node = $h.$id
        $status = $node.status.status_str
        $img = $null
        if ($node.outputs.'7' -and $node.outputs.'7'.images) { $img = $node.outputs.'7'.images[0] }
        return @{ status = $status; image = $img }
      }
    } catch {}
    Start-Sleep -Seconds 2
  }
  return @{ status = "timeout"; image = $null }
}

$results = @()
if (Test-Path $resultsPath) {
  try { $results = @(Get-Content $resultsPath -Raw | ConvertFrom-Json) } catch { $results = @() }
}
$doneKeys = @{}
foreach ($r in $results) { if ($r.status -eq 'success') { $doneKeys["$($r.slug)|$($r.index)"] = $true } }

$perLora = 10
Write-Host "LoRAs to bench: $($loras.Count) x $perLora"
Write-Host "Already done keys: $($doneKeys.Count)"

foreach ($lora in $loras) {
  Write-Host "`n===== $($lora.slug) | $($lora.file) @ $($lora.strength) ====="
  for ($i = 1; $i -le $perLora; $i++) {
    $key = "$($lora.slug)|$i"
    if ($doneKeys.ContainsKey($key)) { Write-Host "  [$i/$perLora] skip existing"; continue }

    $seed = Get-Random -Minimum 100000 -Maximum 999999999
    $prefix = "tigra-lora-bench/$($lora.slug)/r$i"
    $pos = $posBase.Replace("{TRIGGERS}", [string]$lora.triggers)

    $w = Get-Content $tplPath -Raw | ConvertFrom-Json
    $w.'12'.inputs.lora_name = [string]$lora.file
    $w.'12'.inputs.strength_model = [double]$lora.strength
    $w.'12'.inputs.strength_clip = [double]$lora.strength
    $w.'2'.inputs.text = $pos
    $w.'5'.inputs.seed = [int64]$seed
    $w.'7'.inputs.filename_prefix = $prefix

    $body = @{ prompt = $w } | ConvertTo-Json -Depth 30 -Compress
    try {
      $resp = Invoke-RestMethod -Uri "http://127.0.0.1:8188/prompt" -Method Post -ContentType "application/json; charset=utf-8" -Body ([System.Text.Encoding]::UTF8.GetBytes($body))
      $done = Wait-Prompt $resp.prompt_id 300
      $entry = [pscustomobject]@{
        slug = $lora.slug
        file = $lora.file
        strength = $lora.strength
        triggers = $lora.triggers
        index = $i
        seed = $seed
        status = $done.status
        filename = if ($done.image) { $done.image.filename } else { $null }
        subfolder = if ($done.image) { $done.image.subfolder } else { $null }
        prompt_id = $resp.prompt_id
      }
      $results += $entry
      Write-Host ("  [{0}/{1}] {2} -> {3}" -f $i, $perLora, $done.status, $entry.filename)
    } catch {
      Write-Host "  FAIL $i : $($_.Exception.Message)"
      $results += [pscustomobject]@{ slug=$lora.slug; file=$lora.file; index=$i; status="error"; error=$_.Exception.Message }
    }
    ($results | ConvertTo-Json -Depth 6) | Set-Content $resultsPath -Encoding UTF8
  }
}

$ok = @($results | Where-Object { $_.status -eq 'success' })
Write-Host "`nDONE success=$($ok.Count) / total=$($results.Count)"
Write-Host "Results: $resultsPath"
