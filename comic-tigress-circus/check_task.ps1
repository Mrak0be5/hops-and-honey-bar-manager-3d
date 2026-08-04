param([string]$TaskId)
$headers = @{ "Authorization" = "Bearer $env:KIE_API_KEY" }
$r = Invoke-RestMethod -Uri "https://api.kie.ai/api/v1/jobs/recordInfo?taskId=$TaskId" -Headers $headers
$r | ConvertTo-Json -Depth 10
