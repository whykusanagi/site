#!/usr/bin/env node
/**
 * Pre-warms every render-API og:image so the first real crawler gets a cache
 * hit instead of paying the cold render. Run after deploy: npm run warm-og
 */
import { readFileSync } from 'node:fs';
import { allPages } from './lib/pages.mjs';

const urls = new Set();
for (const file of allPages()) {
  const html = readFileSync(file, 'utf8');
  for (const m of html.matchAll(/content="(https:\/\/whykusanagi\.xyz\/api\/[^"]+)"/g)) {
    urls.add(m[1].replace(/&amp;/g, '&'));
  }
}

let warm = 0;
let cold = 0;
for (const url of urls) {
  const t0 = process.hrtime.bigint();
  let res;
  try {
    res = await fetch(url);
    await res.arrayBuffer();
  } catch (err) {
    // Keep going: one unreachable URL should not leave the rest of the cards
    // cold, and the exit code still marks the run as failed.
    console.log(`ERR ${err.message} ${url.slice(0, 100)}`);
    process.exitCode = 1;
    continue;
  }
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  const slow = ms > 1000;
  if (slow) cold++; else warm++;
  console.log(`${res.ok ? 'ok ' : 'ERR'} ${Math.round(ms)}ms ${slow ? '(cold)' : ''} ${url.slice(0, 100)}`);
  if (!res.ok) process.exitCode = 1;
}
console.log(`\n${urls.size} urls: ${warm} already warm, ${cold} rendered cold`);
