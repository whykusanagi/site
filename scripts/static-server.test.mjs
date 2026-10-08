// Runs the dev static server on a loopback port and proves path traversal
// is refused — including the encoded-dot and sibling-prefix forms that a
// bare startsWith(ROOT_DIR) check let through.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';

let BASE;
let child;

// Port 0 = whatever is free; the server logs the real port. Reject on early
// exit or after 10s so a server that cannot start fails the suite instead of
// hanging it.
before(async () => {
  child = spawn(process.execPath, ['scripts/static-server.js'], {
    env: { ...process.env, STATIC_PORT: '0', HOST: '127.0.0.1' },
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  BASE = await new Promise((resolve, reject) => {
    child.stdout.on('data', (d) => {
      const m = d.toString().match(/running on (http:\/\/[^:]+:\d+)/);
      if (m) resolve(m[1]);
    });
    child.on('error', reject);
    child.on('exit', (code) => reject(new Error(`server exited early (${code})`)));
    setTimeout(() => reject(new Error('server start timeout')), 10_000).unref();
  });
});
after(() => child.kill());

const status = async (p) => (await fetch(BASE + p)).status;

test('serves the site root', async () => {
  assert.equal(await status('/'), 200);
  assert.equal(await status('/blog/'), 200);
});

test('refuses traversal', async () => {
  // Encoded slashes survive URL parsing and only become `..` after decode.
  assert.equal(await status('/..%2F..%2Fetc%2Fpasswd'), 403);
  // Sibling-prefix: resolves to `${ROOT_DIR}-evil/…`, which startsWith() admitted.
  assert.equal(await status('/..%2Fsite-evil/x.html'), 403);
  // `%2e%2e` is a dot segment to the URL parser itself, so it never reaches us.
  assert.equal(await status('/%2e%2e/%2e%2e/etc/passwd'), 404);
  assert.equal(await status('/%zz'), 400);
  assert.equal(await status('/%00'), 400); // decoded NUL must not reach fs
});
