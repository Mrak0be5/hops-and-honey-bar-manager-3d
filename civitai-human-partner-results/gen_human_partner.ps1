param(
    [switch]$WhatIf
)

$apiKey = "12b71406df2ba5655e11aae36553d154"
$headers = @{
    "Authorization" = "Bearer $apiKey"
    "Content-Type"  = "application/json"
}

$refUrl = "https://tempfile.redpandaai.co/kieai/1335989/comic-tigress/1785851950940-y7bb45dmkh.png"
$outDir = "C:\Users\hebp\OneDrive\Desktop\manager\hops-and-honey-bar-manager-3d\civitai-human-partner-results"
if (-not (Test-Path $outDir)) { New-Item -ItemType Directory -Force -Path $outDir | Out-Null }

$models = @(
    @{
        id = "human_furry_vision_xl"
        title = "Furry Vision XL (Black Human Partner)"
        air = "urn:air:sdxl:checkpoint:civitai:1860144@2736029"
        prompt = "masterpiece, ultra-detailed, 1girl, 1boy, female anthro tiger, orange fur with bold black tiger stripes, white muzzle chest stomach, short silver-white bob haircut, green eyes, breasts, nipples, six-pack abs, long ringed tail, sitting on black human male, dark skinned black man, muscular dark skin human man, human body, cowgirl position, riding black man, anal sex, dark brown penis entering her anus, female vulva, rating_explicit, full body, studio lighting"
        neg = "futanari, female penis, penis on female, dickgirl, herm, intersex, furry male, tiger male, animal male, fur on male, extra limbs, extra arms, extra legs, extra penis, bad anatomy, bad hands, lowres, worst quality"
        lora = $null
        denoise = 0.55
    },
    @{
        id = "human_tovamix_v16"
        title = "TovaMix v1.6 (Black Human Partner)"
        air = "urn:air:sdxl:checkpoint:civitai:2284900@3075829"
        prompt = "masterpiece, best quality, absurdres, 1girl, 1boy, female anthro tiger, orange fur with bold black tiger stripes, white muzzle, short silver-white bob hair, bright green eyes, breasts, nipples, six-pack abs, long ringed tail, cowgirl position, riding dark-skinned black human man, muscular black man, dark skin human male, anal sex, dark brown penis in her anus, female vulva, rating_explicit, full body, detailed fur, dynamic angle"
        neg = "futanari, female penis, penis on female, dickgirl, herm, intersex, furry male, tiger male, animal male, fur on male, extra limbs, extra arms, extra legs, extra penis, bad anatomy, bad hands, worst quality"
        lora = $null
        denoise = 0.55
    },
    @{
        id = "human_nova_furry_xl"
        title = "Nova Furry XL (Black Human Partner)"
        air = "urn:air:sdxl:checkpoint:civitai:503815@2792241"
        prompt = "masterpiece, best quality, ultra-detailed, 1girl, 1boy, female anthro tiger, orange fur, black stripes, white muzzle, silver-white bob hair, green eyes, breasts, nipples, six-pack abs, long tail, cowgirl position, riding dark skin black human man, dark-skinned male human, anal sex, dark penis in her anus, rating_explicit, full body"
        neg = "futanari, female penis, penis on female, dickgirl, herm, intersex, furry male, tiger male, animal male, fur on male, extra limbs, bad anatomy, bad hands, worst quality"
        lora = $null
        denoise = 0.55
    },
    @{
        id = "human_illustrious_hades"
        title = "Illustrious Furry HaDeS v2.0 (Black Human Partner)"
        air = "urn:air:sdxl:checkpoint:civitai:1804979@2554740"
        prompt = "masterpiece, best quality, ultra-detailed, 1girl, 1boy, female anthro tiger, orange fur with bold black tiger stripes, white muzzle chest, silver-white bob hair, green eyes, breasts, nipples, six-pack abs, long striped tail, cowgirl position, reverse cowgirl, riding black human male, dark skin human man, anal sex, dark penis in her anus, rating_explicit, full body"
        neg = "futanari, female penis, penis on female, dickgirl, herm, intersex, furry male, tiger male, animal male, fur on male, extra limbs, bad anatomy, bad hands, watermark"
        lora = $null
        denoise = 0.55
    },
    @{
        id = "human_pony_v6"
        title = "Pony V6 XL (Black Human Partner)"
        air = "urn:air:sdxl:checkpoint:civitai:101055@128078"
        prompt = "score_9, score_8_up, score_7_up, 1girl, 1boy, female anthro tiger, orange fur with bold black tiger stripes, white muzzle, short silver-white bob haircut, bright green eyes, breasts, nipples, six-pack abs, long ringed tail, cowgirl position, riding black human male, dark-skinned black man, dark skin human man, anal sex, dark penis in her anus, female vulva, rating_explicit, full body"
        neg = "score_4, score_5, score_6, futanari, female penis, penis on female, dickgirl, herm, intersex, furry male, tiger male, animal male, fur on male, extra limbs, bad anatomy, bad hands, human skin on tiger"
        lora = $null
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
