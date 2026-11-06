#!/usr/bin/env node
/**
 * se-subathon.mjs: pull subathon subs from the StreamElements activity feed and
 * print the sub-point total + top-gifter leaderboard (T1/Prime=1, T2=2, T3=6).
 *
 * Run (token from env, so it never lands in shell history or chat):
 *   pbpaste > .secrets/se_jwt                # after copying the JWT (SE dashboard → Account → Channels → Show secrets); .secrets/ is gitignored
 *   (or: export SE_JWT=… in the same shell)
 *   node scripts/se-subathon.mjs             # fetch + summarize
 *   node scripts/se-subathon.mjs --save se.json   # also write the raw API response
 *   node scripts/se-subathon.mjs --file se.json   # summarize a saved dump, no token needed
 *
 * Same counting as /api/subathon (src/lib/subathon.js). Window defaults to
 * SUBATHON_WINDOW there; override with
 * --after / --before ISO dates. Output: one line per sub row, then totals.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { fetchSeActivities, summarizeSeActivities, SUBATHON_WINDOW } from '../src/lib/subathon.js';

const { values: opt } = parseArgs({
  options: {
    after: { type: 'string', default: SUBATHON_WINDOW.after },
    before: { type: 'string', default: SUBATHON_WINDOW.before },
    save: { type: 'string' },
    file: { type: 'string' },
  },
});

async function fetchActivities() {
  const token = (process.env.SE_JWT || await readFile(new URL('../.secrets/se_jwt', import.meta.url), 'utf8').catch(() => '')).trim();
  if (!token) throw new Error('no token: copy the JWT, then `pbpaste > .secrets/se_jwt` (or export SE_JWT)');
  return fetchSeActivities(token, { after: opt.after, before: opt.before });
}

const rows = opt.file ? JSON.parse(await readFile(opt.file, 'utf8')) : await fetchActivities();
if (opt.save) await writeFile(opt.save, JSON.stringify(rows, null, 2));
const { points, leaderboard, rows: lines } = summarizeSeActivities(rows);
for (const r of [...lines].reverse()) {
  const who = r.gifted && r.recipient !== r.giver ? `${r.giver} → ${r.recipient}` : r.giver;
  console.log(`${r.createdAt?.slice(0, 10)}  ${r.gifted ? `gift x${r.count}` : `sub (${r.months ?? 1} mo)`}  tier ${r.tier}  +${r.points}  ${who}`);
}
console.log(`\ntotal sub points: ${points}`);
console.log('leaderboard:', JSON.stringify(leaderboard, null, 2));
