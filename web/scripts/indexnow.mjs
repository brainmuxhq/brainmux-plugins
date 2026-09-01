#!/usr/bin/env node
// Notify IndexNow (Bing, Yandex, Seznam, Naver — not Google) that brainmux.com
// changed, so those engines re-crawl instantly instead of waiting. The key is
// PUBLIC by design: it's hosted at https://brainmux.com/<key>.txt to prove ownership.
// Run manually (`npm run indexnow`) or automatically from the IndexNow GitHub workflow.

const KEY = "16ef04b75a900308e40c2b89f4a1df1a";
const HOST = "brainmux.com";
const urlList = [`https://${HOST}/`, `https://${HOST}/llms.txt`];

const body = {
  host: HOST,
  key: KEY,
  keyLocation: `https://${HOST}/${KEY}.txt`,
  urlList,
};

const res = await fetch("https://api.indexnow.org/indexnow", {
  method: "POST",
  headers: { "Content-Type": "application/json; charset=utf-8" },
  body: JSON.stringify(body),
});

console.log(`IndexNow: HTTP ${res.status} for ${urlList.length} URL(s): ${urlList.join(", ")}`);
if (res.status >= 400) {
  console.error(await res.text());
  process.exit(1);
}
