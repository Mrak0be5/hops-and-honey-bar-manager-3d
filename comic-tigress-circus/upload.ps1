param([Parameter(Mandatory=$true)][string]$FilePath)
$apiKey = $env:KIE_API_KEY
$boundary = [System.Guid]::NewGuid().ToString()
$fileName = [System.IO.Path]::GetFileName($FilePath)
$fileBytes = [System.IO.File]::ReadAllBytes($FilePath)

$LF = "`r`n"
$pre = "--$boundary$LF" + "Content-Disposition: form-data; name=`"uploadPath`"$LF$LF" + "comic-tigress$LF" + "--$boundary$LF" + "Content-Disposition: form-data; name=`"file`"; filename=`"$fileName`"$LF" + "Content-Type: image/png$LF$LF"
$post = "$LF--$boundary--$LF"
$preBytes = [System.Text.Encoding]::UTF8.GetBytes($pre)
$postBytes = [System.Text.Encoding]::UTF8.GetBytes($post)

$ms = New-Object System.IO.MemoryStream
$ms.Write($preBytes, 0, $preBytes.Length)
$ms.Write($fileBytes, 0, $fileBytes.Length)
$ms.Write($postBytes, 0, $postBytes.Length)
$bodyBytes = $ms.ToArray()

$headers = @{ "Authorization" = "Bearer $apiKey" }
$resp = Invoke-RestMethod -Uri "https://kieai.redpandaai.co/api/file-stream-upload" -Method Post -Headers $headers -ContentType "multipart/form-data; boundary=$boundary" -Body $bodyBytes
$resp | ConvertTo-Json -Depth 10
