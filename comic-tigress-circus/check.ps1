$headers = @{ "Authorization" = "Bearer $env:KIE_API_KEY" }
$r = Invoke-RestMethod -Uri "https://api.kie.ai/api/v1/jobs/recordInfo?taskId=479f1f1c00cacad82773af16366cfb34" -Headers $headers
$r | ConvertTo-Json -Depth 10
