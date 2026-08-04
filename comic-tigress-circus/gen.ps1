param(
    [Parameter(Mandatory=$true)][string]$Prompt,
    [Parameter(Mandatory=$false)][string]$RefUrlsCsv,
    [Parameter(Mandatory=$true)][string]$OutFile,
    [Parameter(Mandatory=$false)][double]$Strength = 0.6,
    [Parameter(Mandatory=$false)][int]$PollSeconds = 10,
    [Parameter(Mandatory=$false)][int]$MaxWait = 600
)

$apiKey = $env:KIE_API_KEY
if (-not $apiKey) { throw "KIE_API_KEY not set" }
$headers = @{ "Authorization" = "Bearer $apiKey"; "Content-Type" = "application/json" }

$RefUrls = @()
if ($RefUrlsCsv) { $RefUrls = ($RefUrlsCsv -split '\|') | Where-Object { $_ -ne '' } }

$body = @{
    model = if ($RefUrls.Count -gt 0) { "seedream/5-pro-image-to-image" } else { "seedream/5-pro-text-to-image" }
    input = @{
        prompt = $Prompt
        quality = "high"
        output_format = "png"
        nsfw_checker = $false
        aspect_ratio = "3:4"
    }
}
if ($RefUrls.Count -gt 0) {
    $body.input.image_urls = $RefUrls
    $body.input.strength = $Strength
}

$json = $body | ConvertTo-Json -Depth 10 -Compress
$resp = Invoke-RestMethod -Uri "https://api.kie.ai/api/v1/jobs/createTask" -Method Post -Headers $headers -Body $json
$taskId = $resp.data.taskId
if (-not $taskId) { throw "No taskId returned: $($resp | ConvertTo-Json -Depth 5)" }
Write-Host "Task created: $taskId"

$start = Get-Date
while ($true) {
    Start-Sleep -Seconds $PollSeconds
    $info = Invoke-RestMethod -Uri "https://api.kie.ai/api/v1/jobs/recordInfo?taskId=$taskId" -Headers $headers
    $state = $info.data.state
    Write-Host "  state=$state elapsed=$([int]((Get-Date)-$start).TotalSeconds)s"
    if ($state -eq "success" -or $state -eq "DONE" -or $state -eq "COMPLETED") {
        $rj = $info.data.resultJson
        if (-not $rj) { throw "DONE but no resultJson: $($info | ConvertTo-Json -Depth 5)" }
        $parsed = $rj | ConvertFrom-Json
        $urls = $parsed.resultUrls
        if (-not $urls) { throw "No resultUrls in resultJson: $rj" }
        $url = if ($urls -is [array]) { $urls[0] } else { $urls }
        Invoke-WebRequest -Uri $url -OutFile $OutFile
        Write-Host "SAVED: $OutFile"
        Write-Host "URL: $url"
        return $url
    }
    if ($state -eq "failed" -or $state -eq "ERROR") { throw "Task failed: $($info | ConvertTo-Json -Depth 5)" }
    if (((Get-Date)-$start).TotalSeconds -gt $MaxWait) { throw "Timeout waiting for $taskId" }
}
