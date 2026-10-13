import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from './server.mjs';

test('serves the game and an empty local profile/progress', async (t) => {
  const server = createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => server.close());

  const origin = `http://127.0.0.1:${server.address().port}`;
  const [page, profile, progress, players] = await Promise.all([
    fetch(`${origin}/`),
    fetch(`${origin}/api/profile`),
    fetch(`${origin}/api/progress`),
    fetch(`${origin}/api/players`),
  ]);

  assert.equal(page.status, 200);
  assert.match(await page.text(), /Retro Survival/);
  assert.deepEqual(await profile.json(), { name: null });
  assert.deepEqual(await progress.json(), {
    progress: {
      wabbitUnlocked: false,
      litnegUnlocked: false,
      waveRecords: { astrub: 0, litneg: 0, wabbit: 0, gelee: 0, dragoeuf: 0 },
      collectedDofus: [],
      radiantDofus: [],
    },
  });
  assert.deepEqual(await players.json(), { count: 0 });
});

test('persists profile and progress updates in memory', async (t) => {
  const server = createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => server.close());
  const origin = `http://127.0.0.1:${server.address().port}`;

  const profileResponse = await fetch(`${origin}/api/profile`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'Testeur local' }),
  });
  assert.deepEqual(await profileResponse.json(), { name: 'Testeur local' });

  const progressResponse = await fetch(`${origin}/api/progress`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ waveRecords: { astrub: 3 } }),
  });
  assert.equal((await progressResponse.json()).progress.waveRecords.astrub, 3);
});
