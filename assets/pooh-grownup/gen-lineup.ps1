$imageUrl = "https://tempfile.redpandaai.co/kieai/1335989/pooh-grownup/1785850226224-w37jcuh5pn.png"

$prompt = @"
MATCH THE EXACT ART STYLE OF THE REFERENCE IMAGE: a clean detailed digital anime/manga furry illustration, adult anthropomorphic female Winnie-the-Pooh characters, standing nude on a plain white background with a horizontal dashed grid and a vertical meter-based height scale on the right (up to 2.5m), studio-style soft top-left lighting, smooth digital painting with soft shading highlighting muscle definition and body contours, large expressive anime eyes, human-like hairstyles complementing fur colors, animalistic facial structures (snouts, ears, beaks), realistic idealized feminine human anatomy with breasts and visible genitals (uncensored), character reference sheet format (standing forward, arms at sides).

Generate THREE NEW characters in this exact style, lined up left to right on the same white height-chart background with the same meter scale:

1. KANGA (Mama Roo) - tall maternal anthropomorphic kangaroo female, about 2.1m tall. Warm tan/golden-brown kangaroo fur with cream belly and chest, long powerful kangaroo tail resting on the floor behind her, long rabbit-like kangaroo ears, long flowing auburn-red hair in a thick braid over one shoulder, large soft maternal breasts, wide hips, strong but feminine thighs, gentle warm motherly expression, large brown eyes, small kangaroo paws/hands, big kangaroo feet. Nude, arms at sides, facing forward.

2. ROO - grown-up young-adult anthropomorphic kangaroo female, about 1.5m tall, clearly shorter than Kanga. Same warm tan/golden-brown kangaroo fur with cream belly, smaller kangaroo tail, shorter upright kangaroo ears, short messy reddish-brown hair (youthful bob), slim athletic petite build with small perky breasts, energetic cheerful playful expression, big bright green eyes, small kangaroo paws and feet. Nude, arms at sides, facing forward.

3. OWL - anthropomorphic avian female, about 1.75m tall. Feathered body in warm tawny-brown and cream plumage patterns, feathered 'hair' styled as elegant swept-back feathers resembling an updo, large round intelligent golden owl eyes, small hooked beak nose, feathered arms with long primary flight feathers along the forearms (arms still functional as arms, not full wings), large soft breasts with feathered cleavage, slender elegant regal posture, small owl-ear tufts, feathered legs with taloned feet. Nude, arms at sides, facing forward, dignified wise expression.

Keep the SAME character reference sheet composition as the reference: three full-body standing figures side by side, evenly spaced, all facing the viewer, all nude, same height chart with meter scale on the right and dashed grid background. Preserve the exact rendering style, line weight, shading, anime eye style, and furry aesthetic of the reference image. Do NOT add clothing, do NOT add text labels, do NOT add watermarks.
"@

$body = @{
    model = "seedream/5-pro-image-to-image"
    input = @{
        prompt = $prompt
        image_urls = @($imageUrl)
        aspect_ratio = "16:9"
        quality = "high"
        nsfw_checker = $false
    }
} | ConvertTo-Json -Depth 6

$headers = @{
    "Authorization" = "Bearer $env:KIE_API_KEY"
    "Content-Type" = "application/json"
}

$resp = Invoke-RestMethod -Uri "https://api.kie.ai/api/v1/jobs/createTask" -Method Post -Body $body -Headers $headers
$resp | ConvertTo-Json -Depth 6
