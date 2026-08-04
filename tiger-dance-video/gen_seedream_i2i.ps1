param(
    [Parameter(Mandatory=$true)][string]$Prompt,
    [Parameter(Mandatory=$true)][string[]]$ImageUrls,
    [Parameter(Mandatory=$true)][string]$OutFile,
    [Parameter(Mandatory=$false)][double]$Strength = 0.55,
    [Parameter(Mandatory=$false)][int]$PollSeconds = 12,
    [Parameter(Mandatory=$false)][int]$MaxWait = 600
)

$apiKey = $env:KIE_API_KEY
if (-not $apiKey) { throw "KIE_API_KEY not set" }
$headers = @{ "Authorization" = "Bearer $apiKey"; "Content-Type" = "application/json" }

# Build image_urls JSON array manually to avoid PowerShell single-element array collapse
$urlsJson = ($ImageUrls | ForEach-Object { '"' + ($_ -replace '"','\"') + '"' }) -join ','
$urlsJson = "[$urlsJson]"

$escPrompt = $Prompt -replace '\\','\\' -replace '"','\"' -replace "`r","\r" -replace "`n","\n"

$body = @{
    model = "seedream/5-pro-image-to-image"
    input = @{
        prompt          = $Prompt
        quality         = "high"
        output_format   = "png"
        nsfw_checker    = $false
        aspect_ratio    = "3:4"
        strength        = $Strength
    }
}

$json = $body | ConvertTo-Json -Depth 10 -Compress
# Inject image_urls as a proper JSON array
$json = $json -replace '"input":\{', ('"input":{"image_urls":' + $urlsJson + ',')

Write-Host "POST createTask"
Write-Host "BODY: $json"
$bodyBytes = [System.Text.Encoding]::UTF8.GetBytes($json)
try {
    $resp = Invoke-RestMethod -Uri "https://api.kie.ai/api/v1/jobs/createTask" -Method Post -Headers $headers -Body $bodyBytes -ContentType "application/json; charset=utf-8"
} catch {
    $respStream = $_.Exception.Response.GetResponseStream()
    if ($respStream) {
        $reader = New-Object System.IO.StreamReader($respStream)
        $errBody = $reader.ReadToEnd()
        Write-Host "ERROR BODY: $errBody"
    }
    throw $_
}
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
        if (-not $urls) { $urls = $parsed.resultUrl }
        $url = if ($urls -is [array]) { $urls[0] } else { $urls }
        Invoke-WebRequest -Uri $url -OutFile $OutFile
        Write-Host "SAVED: $OutFile"
        Write-Host "URL: $url"
        return $url
    }
    if ($state -eq "failed" -or $state -eq "ERROR") { throw "Task failed: $($info | ConvertTo-Json -Depth 5)" }
    if (((Get-Date)-$start).TotalSeconds -gt $MaxWait) { throw "Timeout waiting for $taskId" }
}
