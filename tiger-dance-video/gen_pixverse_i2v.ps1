param(
    [Parameter(Mandatory=$true)][string]$Prompt,
    [Parameter(Mandatory=$true)][string]$ImageUrl,
    [Parameter(Mandatory=$true)][string]$OutFile,
    [Parameter(Mandatory=$false)][int]$Duration = 5,
    [Parameter(Mandatory=$false)][string]$Quality = "1080p",
    [Parameter(Mandatory=$false)][string]$AspectRatio = "9:16",
    [Parameter(Mandatory=$false)][int]$PollSeconds = 15,
    [Parameter(Mandatory=$false)][int]$MaxWait = 900
)

$apiKey = $env:KIE_API_KEY
if (-not $apiKey) { throw "KIE_API_KEY not set" }
$headers = @{ "Authorization" = "Bearer $apiKey"; "Content-Type" = "application/json" }

$body = @{
    model = "pixverse-v6/image-to-video"
    input = @{
        prompt          = $Prompt
        image_urls      = @($ImageUrl)
        duration        = $Duration
        quality         = $Quality
        generate_audio_switch = $false
    }
}

$json = $body | ConvertTo-Json -Depth 10 -Compress
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
        $url = $parsed.resultUrl
        if (-not $url) { $url = $parsed.resultUrls }
        if (-not $url) { $url = $parsed.url }
        if (-not $url) { $url = $parsed.videos }
        if ($url -is [array]) { $url = $url[0] }
        if ($url -and $url.PSObject.Properties.Name -contains 'url') { $url = $url.url }
        if (-not $url) { throw "No result URL in resultJson: $rj" }
        Invoke-WebRequest -Uri $url -OutFile $OutFile
        Write-Host "SAVED: $OutFile"
        Write-Host "URL: $url"
        return $url
    }
    if ($state -eq "failed" -or $state -eq "ERROR") { throw "Task failed: $($info | ConvertTo-Json -Depth 5)" }
    if (((Get-Date)-$start).TotalSeconds -gt $MaxWait) { throw "Timeout waiting for $taskId" }
}
