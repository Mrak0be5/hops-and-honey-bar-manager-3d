$imageUrl = "https://tempfile.redpandaai.co/kieai/1335989/pooh-grownup/1785850226224-w37jcuh5pn.png"

$styleLock = @"
MATCH THE EXACT ART STYLE OF THE REFERENCE IMAGE: a clean detailed digital anime/manga furry illustration, adult anthropomorphic female Winnie-the-Pooh character, standing nude on a plain white background with a horizontal dashed grid and a vertical meter-based height scale on the right (up to 2.5m), studio-style soft top-left lighting, smooth digital painting with soft shading highlighting muscle definition and body contours, large expressive anime eyes, human-like hairstyle complementing fur color, animalistic facial structure, realistic idealized feminine human anatomy with breasts and visible genitals (uncensored), character reference sheet format (standing forward, arms at sides). Single full-body character centered in frame, facing the viewer, nude, arms at sides. Preserve the exact rendering style, line weight, shading, anime eye style, and furry aesthetic of the reference image. Do NOT add clothing, do NOT add text labels, do NOT add watermarks.
"@

$kangaPrompt = @"
$styleLock

CHARACTER: KANGA (Mama Roo) - a tall maternal anthropomorphic kangaroo female, about 2.1m tall. Warm tan/golden-brown kangaroo fur with a cream-colored belly and chest, a long powerful kangaroo tail resting on the floor behind her, long upright rabbit-like kangaroo ears, long flowing auburn-red hair styled in a thick braid draped over one shoulder. Large soft maternal breasts, wide hips, strong but feminine thighs, gentle warm motherly expression, large brown eyes, small kangaroo paws/hands, big kangaroo feet. Nude, arms at sides, facing forward, full body centered in frame with the height chart on the right.
"@

$rooPrompt = @"
$styleLock

CHARACTER: ROO - a grown-up young-adult anthropomorphic kangaroo female, about 1.5m tall. Warm tan/golden-brown kangaroo fur with a cream-colored belly, a smaller kangaroo tail, shorter upright kangaroo ears, short messy reddish-brown hair in a youthful bob with bangs. Slim athletic petite build with small perky breasts, energetic cheerful playful expression, big bright green eyes, small kangaroo paws and feet. Nude, arms at sides, facing forward, full body centered in frame with the height chart on the right.
"@

$owlPrompt = @"
$styleLock

CHARACTER: OWL (Сова) - an anthropomorphic avian female, about 1.75m tall. Feathered body in warm tawny-brown and cream plumage patterns, feathered 'hair' styled as elegant swept-back feathers resembling an updo, large round intelligent golden owl eyes, small hooked beak nose, feathered arms with long primary flight feathers along the forearms (arms still functional as arms, not full wings), large soft breasts with feathered cleavage, slender elegant regal posture, small owl-ear tufts, feathered legs with taloned bird feet. Nude, arms at sides, facing forward, dignified wise expression, full body centered in frame with the height chart on the right.
"@

$headers = @{ "Authorization" = "Bearer $env:KIE_API_KEY"; "Content-Type" = "application/json" }

function Submit-Job($prompt) {
    $body = @{
        model = "seedream/5-pro-image-to-image"
        input = @{
            prompt = $prompt
            image_urls = @($imageUrl)
            aspect_ratio = "3:4"
            quality = "high"
            nsfw_checker = $false
        }
    } | ConvertTo-Json -Depth 6
    $resp = Invoke-RestMethod -Uri "https://api.kie.ai/api/v1/jobs/createTask" -Method Post -Body $body -Headers $headers
    return $resp.data.taskId
}

$kangaId = Submit-Job $kangaPrompt
$rooId   = Submit-Job $rooPrompt
$owlId   = Submit-Job $owlPrompt

Write-Output "KANGA: $kangaId"
Write-Output "ROO:   $rooId"
Write-Output "OWL:   $owlId"

@{ kanga = $kangaId; roo = $rooId; owl = $owlId } | ConvertTo-Json | Out-File "C:\Users\hebp\OneDrive\Desktop\manager\hops-and-honey-bar-manager-3d\assets\pooh-grownup\jobids.json"
