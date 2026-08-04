param(
    [switch]$WhatIf
)

$apiKey = "12b71406df2ba5655e11aae36553d154"
$headers = @{
    "Authorization" = "Bearer $apiKey"
    "Content-Type"  = "application/json"
}

$outDir = "C:\Users\hebp\OneDrive\Desktop\manager\hops-and-honey-bar-manager-3d\civitai-test-results"
if (-not (Test-Path $outDir)) { New-Item -ItemType Directory -Force -Path $outDir | Out-Null }

$models = @(
    @{
        id = "pony_v6_xl"
        title = "Pony Diffusion V6 XL"
        air = "urn:air:sdxl:checkpoint:civitai:101055@128078"
        ecosystem = "sdxl"
        prompt = "score_9, score_8_up, score_7_up, 1girl, anthro tiger, orange fur with bold black tiger stripes, white muzzle chest stomach, short silver-white bob haircut with straight bangs, rounded tiger ears, bright green eyes, athletic six-pack abs, long ringed tiger tail, digitigrade paws, cowgirl position, riding, reverse cowgirl, anal sex, penis in anus, erect penis, large penis, intersex, futanari, rating_explicit, full body, dramatic studio lighting"
        neg = "score_4, score_5, score_6, lowres, bad anatomy, bad hands, missing limbs, fused fingers, human skin"
        lora = "urn:air:sdxl:lora:civitai:300005@436219"
        loraStrength = 0.8
    },
    @{
        id = "tovamix_v16"
        title = "TovaMix - Illustrious & NoobAI Hybrid v1.6"
        air = "urn:air:sdxl:checkpoint:civitai:2284900@3075829"
        ecosystem = "sdxl"
        prompt = "masterpiece, best quality, absurdres, 1girl, anthro tiger, orange fur with bold black tiger stripes, white muzzle, short silver-white bob hair, bright green eyes, athletic toned body, long ringed tiger tail, cowgirl position, riding, anal sex, penis in anus, erect penis, intersex, futanari, rating_explicit, full body, detailed fur, dynamic angle"
        neg = "lowres, bad anatomy, bad hands, missing limbs, human skin, worst quality"
        lora = $null
    },
    @{
        id = "illustrious_furry_hades"
        title = "Illustrious Furry from HaDeS v2.0"
        air = "urn:air:sdxl:checkpoint:civitai:1804979@2554740"
        ecosystem = "sdxl"
        prompt = "masterpiece, best quality, ultra-detailed, 1girl, anthro tiger, orange fur with bold black tiger stripes, white muzzle chest, silver-white bob hair, green eyes, six-pack abs, long striped tail, cowgirl position, reverse cowgirl, anal sex, penis in anus, erect penis, intersex, futanari, rating_explicit, full body"
        neg = "lowres, bad anatomy, bad hands, human skin, text, watermark"
        lora = $null
    },
    @{
        id = "furry_vision_xl"
        title = "Furry Vision XL / Furry NoobAI"
        air = "urn:air:sdxl:checkpoint:civitai:1860144@2736029"
        ecosystem = "sdxl"
        prompt = "masterpiece, ultra-detailed, 1girl, anthro tiger, orange fur, black tiger stripes, white muzzle, silver-white bob hair, green eyes, athletic physique, long ringed tail, cowgirl position, riding, anal sex, penis in anus, erect penis, intersex, futanari, rating_explicit, full body, studio lighting"
        neg = "lowres, bad anatomy, bad hands, human skin, blurred"
        lora = $null
    },
    @{
        id = "nova_furry_xl"
        title = "Nova Furry XL (Illustrious)"
        air = "urn:air:sdxl:checkpoint:civitai:503815@2792241"
        ecosystem = "sdxl"
        prompt = "masterpiece, best quality, ultra-detailed, furry, anthro, tiger female, orange fur, black stripes, silver-white bob hair, green eyes, six-pack abs, long tail, cowgirl position, anal sex, penis in anus, erect penis, intersex, futanari, rating_explicit, full body"
        neg = "human, lowres, bad anatomy, bad hands, worst quality"
        lora = $null
    },
    @{
        id = "pony_v7_base"
        title = "Pony Diffusion V7 XL"
        air = "urn:air:sdxl:checkpoint:civitai:1901521@2152373"
        ecosystem = "sdxl"
        prompt = "score_9, score_8_up, 1girl, anthro tiger, orange fur, black tiger stripes, white muzzle, short silver-white bob hair, green eyes, six-pack abs, long ringed tail, cowgirl position, riding, anal sex, penis in anus, erect penis, intersex, futanari, rating_explicit, full body"
        neg = "score_4, score_5, lowres, bad anatomy, bad hands, human skin"
        lora = "urn:air:sdxl:lora:civitai:300005@436219"
        loraStrength = 0.7
    }
)

$results = @()

foreach ($m in $models) {
    Write-Host "========================================"
    Write-Host "Model: $($m.title) ($($m.id))"
    
    $lorasObj = @{}
    if ($m.lora) {
        $lorasObj[$m.lora] = $m.loraStrength
    }

    $bodyMap = @{
        steps = @(
            @{
                '$type' = "imageGen"
                input = @{
                    ecosystem = $m.ecosystem
                    engine    = "sdcpp"
                    model     = $m.air
                    prompt    = $m.prompt
                    negativePrompt = $m.neg
                    width     = 896
                    height    = 1152
                    steps     = 28
                    cfgScale  = 6.5
                    quantity  = 1
                    outputFormat = "jpeg"
                    loras     = $lorasObj
                }
            }
        )
    }

    $jsonBody = $bodyMap | ConvertTo-Json -Depth 10
    $uri = "https://orchestration.civitai.com/v2/consumer/workflows?allowMatureContent=true&wait=90"
    if ($WhatIf) { $uri += "&whatif=true" }

    try {
        $res = Invoke-RestMethod -Uri $uri -Method Post -Headers $headers -Body $jsonBody
        if ($WhatIf) {
            Write-Host "  WhatIf cost: $($res.cost.total) Buzz"
            continue
        }

        $wfId = $res.id
        Write-Host "  Workflow created: $wfId"

        # Poll workflow status if not finished in wait time
        $step0 = $res.steps[0]
        $imgObj = $step0.output.images[0]
        
        $imgUrl = $null
        if ($imgObj -and $imgObj.url) {
            $imgUrl = $imgObj.url
        } else {
            # Poll workflow endpoint
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
            $outFile = Join-Path $outDir "$($m.id).jpg"
            Invoke-WebRequest -Uri $imgUrl -OutFile $outFile
            Write-Host "  SAVED: $outFile"
            Write-Host "  URL: $imgUrl"
            $results += [PSCustomObject]@{
                id = $m.id
                title = $m.title
                file = $outFile
                url = $imgUrl
            }
        } else {
            Write-Host "  FAILED to get image URL for $($m.id)"
        }
    } catch {
        Write-Host "  ERROR submitting workflow for $($m.id): $_"
        if ($_.Exception.Response) {
            $s = $_.Exception.Response.GetResponseStream()
            if ($s) {
                $r = New-Object System.IO.StreamReader($s)
                Write-Host "  ERROR DETAILS: $($r.ReadToEnd())"
            }
        }
    }
}

if (-not $WhatIf) {
    $resultsJson = Join-Path $outDir "results.json"
    $results | ConvertTo-Json -Depth 5 | Out-File $resultsJson -Encoding utf8
    Write-Host "========================================"
    Write-Host "ALL DONE! Saved metadata to $resultsJson"
}
