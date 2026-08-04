$ErrorActionPreference = "Stop"
$outRoot = "C:\Users\hebp\OneDrive\Desktop\manager\hops-and-honey-bar-manager-3d\tigra-revfellatio-out"
$benchRoot = "C:\Users\hebp\AppData\Roaming\StabilityMatrix\Packages\ComfyUI\output\tigra-lora-bench"
$loraDir = "C:\Users\hebp\AppData\Roaming\StabilityMatrix\Models\Lora"
$tplPath = Join-Path $outRoot "wf_template.json"
$resultsPath = Join-Path $outRoot "benchmark_results_clean.json"
$manifestPath = Join-Path $outRoot "lora_manifest_all.json"

# Full manifest = wave1 + wave2
$all = @(
  @{ slug="oktaze_pony"; file="Reverse_Fellatio_LoRa__PonyXL.safetensors"; triggers="reverse fellatio, upside-down, upside-down fellatio"; strength=0.9 },
  @{ slug="nochekaiser_pony"; file="reverse-fellatio-ponyxl-nochekaiser.safetensors"; triggers="reverse fellatio, throat bulge, fellatio, oral"; strength=0.85 },
  @{ slug="alxpnt2_pony"; file="Reverse_Fellatio_XL_alxpnt2.safetensors"; triggers="reverse fellatio, lying, on back, irrumatio, deepthroat"; strength=0.85 },
  @{ slug="dangling_pony"; file="Dangling_fellatio_UpsideDown.safetensors"; triggers="Dangling fellatio, Upside-down"; strength=0.85 },
  @{ slug="overedge_il"; file="Over_The_Edge_Blowjob_IL.safetensors"; triggers="on back, oral, fellatio, upside-down, lying"; strength=0.8 },
  @{ slug="extreme69_il"; file="Extreme_FaceFuck_Couch_69_IL.safetensors"; triggers="extreme 69, irrumatio, deepthroat, upside-down, on couch, head out from couch"; strength=0.75 },
  @{ slug="zoca_il"; file="ILXL_Reverse_Fellatio_zoca.safetensors"; triggers="reverse fellatio, oral, irrumatio, upside-down, head back"; strength=0.85 },
  @{ slug="goofy_il"; file="Reverse_Fellatio_GoofyAi.safetensors"; triggers="reverse fellatio, oral, irrumatio"; strength=0.85 },
  @{ slug="rfov_il"; file="Reverse_Fellatio_Overhead_rfov.safetensors"; triggers="rfov, reverse fellatio, upside down, top down view"; strength=0.85 },
  @{ slug="artyclaw_il"; file="ReverseFel_UpsideDown_artyclaw.safetensors"; triggers="reversefel, reverse_fellatio, upside down blowjob, lying"; strength=0.85 },
  @{ slug="povrev_il"; file="POV_Reverse_Fellatio_v2.safetensors"; triggers="p0v_f0ck, girl on back, pov, from above, head back, deepthroat"; strength=0.8 },
  @{ slug="inverted_pony"; file="inverted_pony.safetensors"; triggers="InvertedBlowjob, Inverted fellatio, on back"; strength=0.8 },
  @{ slug="facefuck_pony"; file="facefuck_pony.safetensors"; triggers="gluckgluck, deepthroat, fellatio"; strength=0.7 },
  @{ slug="headhang_il"; file="headhang_il.safetensors"; triggers="headoveredge, head hanging over edge"; strength=0.8 }
)
$all | ConvertTo-Json -Depth 5 | Set-Content $manifestPath -Encoding UTF8

# Rebuild done map from disk
$done = @{}
$results = [System.Collections.Generic.List[object]]::new()
foreach ($m in $all) {
  $dir = Join-Path $benchRoot $m.slug
  if (-not (Test-Path $dir)) { continue }
  $files = Get-ChildItem $dir -Filter "r*_*.png" | Sort-Object Name
  foreach ($f in $files) {
    if ($f.Name -match '^r(\d+)_') {
      $idx = [int]$Matches[1]
      if ($idx -lt 1 -or $idx -gt 10) { continue }
      $key = "$($m.slug)|$idx"
      if ($done.ContainsKey($key)) { continue }
      $done[$key] = $true
      $results.Add([pscustomobject]@{
        slug=$m.slug; file=$m.file; strength=$m.strength; triggers=$m.triggers
        index=$idx; status="success"; filename=$f.Name; subfolder="tigra-lora-bench/$($m.slug)"
      }) | Out-Null
    }
  }
}
function Save-Results {
  $tmp = "$resultsPath.tmp"
  ($results | ConvertTo-Json -Depth 6) | Set-Content $tmp -Encoding UTF8
  Move-Item -Force $tmp $resultsPath
}
Save-Results
Write-Host "Rebuilt from disk: $($results.Count) successes"
Write-Host ("Per slug: " + (($results | Group-Object slug | ForEach-Object { "$($_.Name)=$($_.Count)" }) -join ', '))

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

function Wait-Prompt([string]$id, [int]$timeoutSec = 300) {
  $deadline = (Get-Date).AddSeconds($timeoutSec)
  while ((Get-Date) -lt $deadline) {
    try {
      $h = Invoke-RestMethod -Uri "http://127.0.0.1:8188/history/$id" -TimeoutSec 5
      if ($h.$id) {
        $node = $h.$id
        $img = $null
        if ($node.outputs.'7' -and $node.outputs.'7'.images) { $img = $node.outputs.'7'.images[0] }
        return @{ status = $node.status.status_str; image = $img }
      }
    } catch {}
    Start-Sleep -Seconds 2
  }
  return @{ status = "timeout"; image = $null }
}

$perLora = 10
foreach ($lora in $all) {
  $path = Join-Path $loraDir $lora.file
  if (-not (Test-Path $path) -or ((Get-Item $path).Length -lt 20MB)) {
    Write-Host "SKIP missing $($lora.slug)"; continue
  }
  Write-Host "`n===== $($lora.slug) ====="
  for ($i = 1; $i -le $perLora; $i++) {
    $key = "$($lora.slug)|$i"
    if ($done.ContainsKey($key)) { Write-Host "  [$i/$perLora] skip"; continue }

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
      $finished = Wait-Prompt $resp.prompt_id 300
      $entry = [pscustomobject]@{
        slug=$lora.slug; file=$lora.file; strength=$lora.strength; triggers=$lora.triggers
        index=$i; seed=$seed; status=$finished.status
        filename= if ($finished.image) { $finished.image.filename } else { $null }
        subfolder= if ($finished.image) { $finished.image.subfolder } else { $null }
        prompt_id=$resp.prompt_id
      }
      $results.Add($entry) | Out-Null
      if ($finished.status -eq 'success') { $done[$key] = $true }
      Write-Host ("  [{0}/{1}] {2} -> {3}" -f $i, $perLora, $finished.status, $entry.filename)
      Save-Results
    } catch {
      Write-Host "  FAIL $i : $($_.Exception.Message)"
      $results.Add([pscustomobject]@{ slug=$lora.slug; index=$i; status="error"; error=$_.Exception.Message }) | Out-Null
      Save-Results
    }
  }
}

Write-Host "`nALL DONE successes=$((@($results) | Where-Object status -eq success).Count)"
@($results) | Where-Object status -eq success | Group-Object slug | Sort-Object Name | ForEach-Object { Write-Host ("  {0,-20} {1}" -f $_.Name, $_.Count) }
