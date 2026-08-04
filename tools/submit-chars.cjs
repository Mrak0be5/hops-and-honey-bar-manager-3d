const fs = require('fs');

const KIE_API_KEY = process.env.KIE_API_KEY;
const API_URL = "https://api.kie.ai/api/v1/jobs/createTask";

const refUrls = [
  "https://tempfile.redpandaai.co/kieai/1335989/pooh-grownup/1785872060699-kwsg9bjr06j.png", // Winna
  "https://tempfile.redpandaai.co/kieai/1335989/pooh-grownup/1785872069899-lntz45xmjx.png"  // Tigra
];

const stylePrompt = "MATCH THE EXACT ART STYLE OF THE REFERENCE IMAGES: a clean detailed digital anime/manga furry illustration, adult female anthropomorphic character, plain white background, character reference sheet format showing the character twice (standing forward on the left, standing backward on the right), studio-style soft top-left lighting, smooth digital painting, soft shading, anime eyes, animalistic facial structures.";

const characters = [
  {
    id: "piglet",
    desc: "anthropomorphic female pig (Piglet), delicate pink skin/fine fur, small delicate pig ears, petite and slim build, short pink bob hair, cute shy expression, small perky breasts, small curly pig tail.",
    clothed: "Wearing a cute oversized green and pink striped sweater, thigh-high socks, casual comfy look.",
    naked: "Completely nude, uncensored, visible nipples and genitals."
  },
  {
    id: "rabbit",
    desc: "anthropomorphic female rabbit (Rabbit), yellowish-tan/golden rabbit fur with a white belly, long upright rabbit ears, slender athletic build, medium breasts, long blonde hair tied back, strict/bossy expression, fluffy white rabbit tail.",
    clothed: "Wearing a strict white collared shirt, high-waisted pencil skirt, glasses, neat teacher/manager look.",
    naked: "Completely nude, uncensored, visible nipples and genitals."
  },
  {
    id: "eeyore",
    desc: "anthropomorphic female donkey (Eeyore), grayish-blue donkey fur, long floppy donkey ears, thick black mane/hair covering one eye, curvy thick build with large breasts and wide hips, gloomy/sleepy expression, donkey tail with a pink bow.",
    clothed: "Wearing a baggy off-the-shoulder dark blue sweater, black leggings, relaxed messy goth look.",
    naked: "Completely nude, uncensored, visible nipples and genitals."
  },
  {
    id: "kanga",
    desc: "anthropomorphic female kangaroo (Kanga), warm tan kangaroo fur with cream belly, long rabbit-like kangaroo ears, long auburn hair in a braid, tall maternal figure, wide hips, large breasts, long kangaroo tail.",
    clothed: "Wearing a warm cozy long brown cardigan, apron, motherly/baker look.",
    naked: "Completely nude, uncensored, visible nipples and genitals."
  },
  {
    id: "roo",
    desc: "anthropomorphic female kangaroo (Roo), warm tan kangaroo fur with cream belly, shorter upright ears, youthful reddish-brown bob hair, petite energetic build, small breasts, small kangaroo tail.",
    clothed: "Wearing a sporty blue hoodie, denim shorts, athletic tomboy look.",
    naked: "Completely nude, uncensored, visible nipples and genitals."
  },
  {
    id: "owl",
    desc: "anthropomorphic female avian owl (Owl), tawny-brown and cream feathered body, swept-back feathered hair updo, elegant slender posture, large round golden owl eyes, small hooked beak nose, large soft breasts, feathered arms, feathered legs.",
    clothed: "Wearing a vintage tweed blazer, turtleneck, reading glasses, academic librarian look.",
    naked: "Completely nude, uncensored, visible nipples and genitals."
  }
];

async function submitTask(charId, type, prompt) {
  const body = {
    model: "seedream/5-pro-image-to-image",
    input: {
      prompt: prompt,
      image_urls: refUrls,
      aspect_ratio: "4:3",
      quality: "high",
      nsfw_checker: false
    }
  };

  const resp = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${KIE_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  const data = await resp.json();
  if (data.data && data.data.taskId) {
    console.log(`[${charId}-${type}] Submitted, Task ID: ${data.data.taskId}`);
    return { id: charId, type, taskId: data.data.taskId };
  } else {
    console.error(`[${charId}-${type}] Failed:`, data);
    return null;
  }
}

async function main() {
  let tasks = [];
  for (const char of characters) {
    // Naked prompt
    const promptNaked = `${stylePrompt} Character: ${char.desc} ${char.naked}`;
    tasks.push(submitTask(char.id, 'naked', promptNaked));
    
    // Clothed prompt
    const promptClothed = `${stylePrompt} Character: ${char.desc} ${char.clothed}`;
    tasks.push(submitTask(char.id, 'clothed', promptClothed));
  }

  const results = await Promise.all(tasks);
  fs.writeFileSync('assets/pooh-grownup/tasks.json', JSON.stringify(results.filter(Boolean), null, 2));
  console.log("Saved tasks.json");
}

main();
