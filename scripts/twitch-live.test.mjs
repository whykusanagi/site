import test from 'node:test';
import assert from 'node:assert/strict';
import { parseUptime } from '../src/lib/twitch-live.js';

test('decapi uptime text maps to live status', () => {
  assert.deepEqual(parseUptime('whykusanagi is offline'), { live: false, uptime: null });
  assert.deepEqual(parseUptime('1 hour, 4 minutes'), { live: true, uptime: '1 hour, 4 minutes' });
  assert.equal(parseUptime('Error: User not found'), null);
});
