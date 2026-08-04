$headers = @{ "Authorization" = "Bearer $env:KIE_API_KEY" }
$url = "https://tempfile.aiquickdraw.com/seedream5pro/1785844267025-3dhvmcalu0k.png"
Invoke-WebRequest -Uri $url -OutFile "C:\Users\hebp\OneDrive\Desktop\manager\hops-and-honey-bar-manager-3d\comic-tigress-circus\shira_ref.png"
Write-Host "Downloaded shira_ref.png"
