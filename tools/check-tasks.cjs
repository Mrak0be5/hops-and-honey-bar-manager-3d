const fs = require('fs');

const KIE_API_KEY = process.env.KIE_API_KEY;
const API_URL = "https://api.kie.ai/api/v1/jobs/recordInfo?taskId=";

async function checkTasks() {
  const tasks = JSON.parse(fs.readFileSync('assets/pooh-grownup/tasks.json', 'utf8'));
  let allDone = true;
  let links = [];

  for (let i = 0; i < tasks.length; i++) {
    const t = tasks[i];
    if (t.resultUrl) {
      links.push(`- **${t.id} (${t.type})**: [Смотреть арт](${t.resultUrl})`);
      continue;
    }

    try {
      const resp = await fetch(API_URL + t.taskId, {
        headers: { 'Authorization': `Bearer ${KIE_API_KEY}` }
      });
      const data = await resp.json();
      
      if (data.data && data.data.state === 'success') {
        const resultJson = JSON.parse(data.data.resultJson);
        const url = resultJson.resultUrls[0];
        t.resultUrl = url;
        console.log(`[${t.id}-${t.type}] Finished! URL: ${url}`);
        links.push(`- **${t.id} (${t.type})**: [Смотреть арт](${url})`);
      } else if (data.data && data.data.state === 'failed') {
        console.log(`[${t.id}-${t.type}] FAILED.`);
        t.resultUrl = "FAILED";
        links.push(`- **${t.id} (${t.type})**: FAILED`);
      } else {
        console.log(`[${t.id}-${t.type}] Still processing...`);
        allDone = false;
      }
    } catch(e) {
      console.error(e);
      allDone = false;
    }
  }

  fs.writeFileSync('assets/pooh-grownup/tasks.json', JSON.stringify(tasks, null, 2));

  if (allDone) {
    fs.writeFileSync('assets/pooh-grownup/LINKS_BATCH.md', links.join('\n'));
    console.log("ALL DONE! Links saved to LINKS_BATCH.md");
  } else {
    console.log("Waiting 30 seconds before next poll...");
    setTimeout(checkTasks, 30000);
  }
}

checkTasks();
