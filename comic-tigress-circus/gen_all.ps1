$ErrorActionPreference = "Stop"
$dir = "C:\Users\hebp\OneDrive\Desktop\manager\hops-and-honey-bar-manager-3d\comic-tigress-circus"
$refUrl = "https://tempfile.redpandaai.co/kieai/1335989/comic-tigress/1785844625246-jqbe70j3m7.png"

$lock = "Use the SAME character from the reference image. Do not redesign her. Preserve identity: anthropomorphic tigress named Shira, burnt amber-orange fur with bold black stripes, white belly and inner thighs, heavy high breasts with dark nipples, green eyes with vertical slit pupils, pink nose, small round ears, long powerful striped tail, muscular-yet-feminine build, retractable claws. Comic art style, soft cell shading, clean illustration."

$panels = @(
    @{
        name = "panel1_arena"
        prompt = "$lock`n`nPanel 1 of an adult furry comic. Circus arena under a big top, single dramatic spotlight. Shira the tigress sits on a round pedestal in the center of the ring, back arched, chest pushed up into the light, head tilted slightly back, confident smirk. Sawdust floor, rows of blurred audience in shadow around the ring, circus tent stripes above. Dramatic rim lighting, warm amber spot. Full body, three-quarter angle. End state: tigress nude on pedestal under spotlight, audience in dark around."
    },
    @{
        name = "panel2_backstage_solo"
        prompt = "$lock`n`nPanel 2 of an adult furry comic. Backstage dressing room, dim warm light, a metal costume rack and mirror blurred behind. Shira the tigress stands against a wall, legs apart, one feline hand between her thighs touching her wet pink folds, the other hand raised near her chest. Eyes half-lidded, looking at viewer, mouth open in a soft moan, tail curled around her own ankle. Intimate, voyeuristic framing, hips and hand in focus. End state: nude tigress masturbating against a wall, fingers on visible wet pink vulva, aroused expression."
    },
    @{
        name = "panel3_oral"
        prompt = "$lock`n`nPanel 3 of an adult furry comic. Same dressing room. Shira the tigress kneels on the floor in front of a standing human man (only his torso and hips visible from above, faceless). Her mouth is around his erect penis, lips wrapped around the shaft, one feline hand gripping the base. Her green eyes look up at him, cheeks slightly puffed, tongue visible at the base. Side three-quarter angle, man's hips on the right, tigress kneeling left. Wet detail on the shaft. End state: tigress performing oral on a standing man, penis in mouth, hand on shaft, eyes up."
    },
    @{
        name = "panel4_pose_bench"
        prompt = "$lock`n`nPanel 4 of an adult furry comic. Same dressing room. Shira the tigress lies chest-down on a low wooden bench, hips raised, tail lifted high and curled to the side to expose her pink wet vulva and anus from behind. She looks back over her shoulder at the viewer with a sultry green-eyed gaze, mouth open. Rear three-quarter view, her raised ass and tail in the lower center of frame, face turned back in upper frame. End state: tigress bent over bench, tail raised, vulva and anus clearly visible and wet, looking back."
    },
    @{
        name = "panel5_sex"
        prompt = "$lock`n`nPanel 5 of an adult furry comic. Same dressing room. Shira the tigress still chest-down on the bench, the human man behind her thrusting, his penis penetrating her visible wet vulva from behind, balls against her. Her claws grip the wood, back arched, mouth open in a growl-moan, eyes squeezed half-shut in pleasure. Side angle showing penetration clearly, his hips against her raised ass, her tail draped over his hip. Wet detail at the connection. End state: explicit rear penetration, penis inside vulva, man behind tigress on bench, both mid-thrust."
    },
    @{
        name = "panel6_afterglow"
        prompt = "$lock`n`nPanel 6 of an adult furry comic. Same dressing room, afterglow. Shira the tigress lies on her back on the bench, relaxed and purring, eyes half-closed contentedly, mouth in a soft smile, tail draped lazily off the bench edge swaying. The human man lies with his face resting against her heavy breast, her arm around him. Warm soft lighting, intimate and tender. Three-quarter angle, full bodies in frame. End state: tigress lying on back purring, man's head on her breast, tender afterglow."
    }
)

$results = @()
foreach ($p in $panels) {
    Write-Host "===== Generating $($p.name) ====="
    $out = Join-Path $dir "$($p.name).png"
    $url = & powershell -ExecutionPolicy Bypass -File (Join-Path $dir "gen.ps1") -Prompt $p.prompt -RefUrls @($refUrl) -OutFile $out -Strength 0.55 -PollSeconds 12 -MaxWait 600
    $results += [PSCustomObject]@{ name = $p.name; file = $out; url = $url }
    Write-Host "Done $($p.name) -> $url"
}

$results | ConvertTo-Json -Depth 5 | Out-File (Join-Path $dir "panels_result.json") -Encoding utf8
Write-Host "ALL PANELS DONE"
