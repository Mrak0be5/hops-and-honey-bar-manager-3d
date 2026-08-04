param(
    [switch]$WhatIf
)

$apiKey = "12b71406df2ba5655e11aae36553d154"
$headers = @{
    "Authorization" = "Bearer $apiKey"
    "Content-Type"  = "application/json"
}

$refUrl = "https://tempfile.redpandaai.co/kieai/1335989/comic-tigress/1785851950940-y7bb45dmkh.png"
$outDir = "C:\Users\hebp\OneDrive\Desktop\manager\hops-and-honey-bar-manager-3d\civitai-i2i-results"
if (-not (Test-Path $outDir)) { New-Item -ItemType Directory -Force -Path $outDir | Out-Null }

$models = @(
    @{
        id = "i2i_furry_vision_xl"
        title = "Furry Vision XL (i2i)"
        air = "urn:air:sdxl:checkpoint:civitai:1860144@2736029"
        prompt = "masterpiece, ultra-detailed, 1girl, anthro tiger, orange fur with bold black tiger stripes, white muzzle chest stomach, short silver-white bob hair with straight bangs, green eyes, highly athletic six-pack abs, long ringed tiger tail, cowgirl position, riding, reverse cowgirl, anal sex, penis in anus, erect penis, intersex, futanari, rating_explicit, full body, dramatic studio lighting"
        neg = "human skin, lowres, bad anatomy, bad hands, missing limbs, blurred"
        lora = $null
        denoise = 0.55
    },
    @{
        id = "i2i_tovamix_v16"
        title = "TovaMix v1.6 (i2i)"
        air = "urn:air:sdxl:checkpoint:civitai:2284900@3075829"
        prompt = "masterpiece, best quality, absurdres, 1girl, anthro tiger, orange fur with bold black tiger stripes, white muzzle, short silver-white bob hair, bright green eyes, athletic six-pack abs, long ringed tail, cowgirl position, riding, anal sex, penis in anus, erect penis, intersex, futanari, rating_explicit, full body, detailed fur, dynamic angle"
        neg = "human skin, lowres, bad anatomy, bad hands, worst quality"
        lora = $null
        denoise = 0.55
    },
    @{
        id = "i2i_nova_furry_xl"
        title = "Nova Furry XL (i2i)"
        air = "urn:air:sdxl:checkpoint:civitai:503815@2792241"
        prompt = "masterpiece, best quality, ultra-detailed, furry, anthro, tiger female, orange fur, black stripes, white muzzle, silver-white bob hair, green eyes, six-pack abs, long tail, cowgirl position, anal sex, penis in anus, erect penis, intersex, futanari, rating_explicit, full body"
        neg = "human, lowres, bad anatomy, bad hands, worst quality"
        lora = $null
        denoise = 0.55
    },
    @{
        id = "i2i_illustrious_hades"
        title = "Illustrious Furry HaDeS v2.0 (i2i)"
        air = "urn:air:sdxl:checkpoint:civitai:1804979@2554740"
        prompt = "masterpiece, best quality, ultra-detailed, 1girl, anthro tiger, orange fur with bold black tiger stripes, white muzzle chest, silver-white bob hair, green eyes, six-pack abs, long striped tail, cowgirl position, reverse cowgirl, anal sex, penis in anus, erect penis, intersex, futanari, rating_explicit, full body"
        neg = "human skin, lowres, bad anatomy, bad hands, watermark"
        lora = $null
        denoise = 0.55
    },
    @{
        id = "i2i_pony_v6_incase"
        title = "Pony V6 XL + Incase LoRA (i2i)"
        air = "urn:air:sdxl:checkpoint:civitai:101055@128078"
        prompt = "score_9, score_8_up, score_7_up, 1girl, anthro tiger, orange fur with bold black tiger stripes, white muzzle, short silver-white bob haircut, bright green eyes, six-pack abs, long ringed tail, cowgirl position, riding, reverse cowgirl, anal sex, penis in anus, erect penis, intersex, futanari, rating_explicit, full body"
        neg = "score_4, score_5, score_6, lowres, bad anatomy, bad hands, human skin"
        lora = "urn:air:sdxl:lora:civitai:300005@436219"
        loraStrength = 0.8
        denoise = 0.55
    },
    @{
        id = "i2i_pony_v7_incase"
        title = "Pony V7 XL + Incase LoRA (i2i)"
        air = "urn:air:sdxl:checkpoint:civitai:1901521@2152373"
        prompt = "score_9, score_8_up, 1girl, anthro tiger, orange fur with bold black tiger stripes, white muzzle, short silver-white bob hair, green eyes, six-pack abs, long ringed tail, cowgirl position, riding, anal sex, penis in anus, erect penis, intersex, futanari, rating_explicit, full body"
        neg = "score_4, score_5, lowres, bad anatomy, bad hands, human skin"
        lora = "urn:air:sdxl:lora:civitai:300005@436219"
        loraStrength = 0.75
        denoise = 0.55
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
                    ecosystem    = "sdxl"
                    engine       = "sdcpp"
                    model        = $m.air
                    prompt       = $m.prompt
                    negativePrompt = $m.neg
                    images       = @($refUrl)
                    denoise      = $m.denoise
                    width        = 896
                    height       = 1152
                    steps        = 28
                    cfgScale     = 6.5
                    quantity     = 1
                    outputFormat = "jpeg"
                    loras        = $lorasObj
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

        $imgUrl = $null
        if ($res.steps[0].output -and $res.steps[0].output.images) {
            $imgUrl = $res.steps[0].output.images[0].url
        }

        if (-not $imgUrl) {
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
            Invoke-WebRequest -Uri "$imgUrl" -OutFile $outFile
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
