$apiKey = "12b71406df2ba5655e11aae36553d154"
$headers = @{
    "Authorization" = "Bearer $apiKey"
    "Content-Type"  = "application/json"
}

$outDir = "C:\Users\hebp\OneDrive\Desktop\manager\hops-and-honey-bar-manager-3d\civitai-test-results\deepthroat"
if (-not (Test-Path $outDir)) { New-Item -ItemType Directory -Force -Path $outDir | Out-Null }

$models = @(
    @{
        id = "furry_vision_xl"
        title = "Furry Vision XL / Furry NoobAI"
        air = "urn:air:sdxl:checkpoint:civitai:1860144@2736029"
        ecosystem = "sdxl"
    },
    @{
        id = "tovamix_v16"
        title = "TovaMix - Illustrious & NoobAI Hybrid v1.6"
        air = "urn:air:sdxl:checkpoint:civitai:2284900@3075829"
        ecosystem = "sdxl"
    },
    @{
        id = "nova_furry_xl"
        title = "Nova Furry XL (Illustrious)"
        air = "urn:air:sdxl:checkpoint:civitai:503815@2792241"
        ecosystem = "sdxl"
    }
)

$variations = @(
    @{
        varId = "v1"
        name = "Lying on back, deepthroat on couch"
        prompt = "masterpiece, best quality, ultra-detailed, 1girl, anthro tiger, orange fur with bold black tiger stripes, white muzzle chest stomach, short silver-white bob hair with straight bangs, bright green eyes, athletic six-pack abs, long ringed tiger tail, lying on back on couch, fellatio, deepthroat, penis in mouth, cock in mouth, oral sex, throatfuck, gagging, saliva, erect penis, green eyes locked on the glowing TV screen (cartoon 2x2 / Rick and Morty), NOT looking at him, NOT looking at camera, she is distracted by the show, oral sex continues while she watches, glowing TV screen in background, blue screen glow, studio lighting, rating_explicit"
    },
    @{
        varId = "v2"
        name = "Upside-down head hanging off couch, deep throatfuck"
        prompt = "masterpiece, best quality, ultra-detailed, 1girl, anthro tiger, orange fur with bold black tiger stripes, white muzzle chest stomach, short silver-white bob hair with straight bangs, bright green eyes, athletic six-pack abs, long ringed tiger tail, lying on back, head hanging off edge of couch, upside-down face view, deepthroat, oral sex, fellatio, penis inserted deep in mouth, throatfuck, gagging, saliva, erect penis, green eyes locked on the glowing TV screen (cartoon 2x2 / Rick and Morty), NOT looking at him, NOT looking at camera, she is distracted by the show, oral sex continues while she watches, strong TV screen glow on face, rating_explicit, dynamic angle"
    }
)

$neg = "lowres, bad anatomy, bad hands, missing limbs, human skin, worst quality, looking at camera, looking at partner"

$results = @()

foreach ($m in $models) {
    foreach ($v in $variations) {
        $jobLabel = "$($m.id)_$($v.varId)"
        Write-Host "========================================"
        Write-Host "Generating: $($m.title) - $($v.name) ($jobLabel)"
        
        $bodyMap = @{
            steps = @(
                @{
                    '$type' = "imageGen"
                    input = @{
                        ecosystem = $m.ecosystem
                        engine    = "sdcpp"
                        model     = $m.air
                        prompt    = $v.prompt
                        negativePrompt = $neg
                        width     = 896
                        height    = 1152
                        steps     = 28
                        cfgScale  = 6.5
                        quantity  = 1
                        outputFormat = "jpeg"
                    }
                }
            )
        }

        $jsonBody = $bodyMap | ConvertTo-Json -Depth 10
        $uri = "https://orchestration.civitai.com/v2/consumer/workflows?allowMatureContent=true&wait=90"

        try {
            $res = Invoke-RestMethod -Uri $uri -Method Post -Headers $headers -Body $jsonBody
            $wfId = $res.id
            Write-Host "  Workflow created: $wfId"

            $imgUrl = $null
            if ($res.steps[0].output -and $res.steps[0].output.images -and $res.steps[0].output.images[0].url) {
                $imgUrl = $res.steps[0].output.images[0].url
            } else {
                $pollStart = Get-Date
                while ($true) {
                    Start-Sleep -Seconds 5
                    $wfStatus = Invoke-RestMethod -Uri "https://orchestration.civitai.com/v2/consumer/workflows/$wfId" -Headers $headers
                    $st = $wfStatus.status
                    Write-Host "    status=$st elapsed=$([int]((Get-Date)-$pollStart).TotalSeconds)s"
                    if ($st -eq "succeeded" -or $st -eq "COMPLETED") {
                        $imgUrl = $wfStatus.steps[0].output.images[0].url
                        break
                    }
                    if ($st -eq "failed" -or $st -eq "expired") {
                        Write-Host "    FAILED: $($wfStatus | ConvertTo-Json -Depth 5)"
                        break
                    }
                    if (((Get-Date)-$pollStart).TotalSeconds -gt 300) { break }
                }
            }

            if ($imgUrl) {
                $outFile = Join-Path $outDir "$jobLabel.jpg"
                Invoke-WebRequest -Uri $imgUrl -OutFile $outFile
                Write-Host "  SAVED: $outFile"
                Write-Host "  URL: $imgUrl"
                $results += [PSCustomObject]@{
                    model_id = $m.id
                    model_title = $m.title
                    var_id = $v.varId
                    var_name = $v.name
                    file = $outFile
                    url = $imgUrl
                }
            } else {
                Write-Host "  FAILED to get image URL for $jobLabel"
            }
        } catch {
            Write-Host "  ERROR submitting workflow for $jobLabel : $_"
            if ($_.Exception.Response) {
                $s = $_.Exception.Response.GetResponseStream()
                if ($s) {
                    $r = New-Object System.IO.StreamReader($s)
                    Write-Host "  ERROR DETAILS: $($r.ReadToEnd())"
                }
            }
        }
    }
}

$resultsJson = Join-Path $outDir "results_deepthroat.json"
$results | ConvertTo-Json -Depth 5 | Out-File $resultsJson -Encoding utf8
Write-Host "========================================"
Write-Host "ALL DONE! Saved results to $resultsJson"
