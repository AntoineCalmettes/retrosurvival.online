import { promises as fs } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const remoteOrigin = process.env.ASSET_ORIGIN ?? 'https://retrosurvival.online';
const concurrency = Number(process.env.ASSET_CONCURRENCY ?? 12);

const chunkFiles = (await fs.readdir(join(root, '_next/static/chunks')))
  .filter((file) => file.endsWith('.js'))
  .map((file) => join(root, '_next/static/chunks', file));

const references = new Set();
for (const file of chunkFiles) {
  const source = await fs.readFile(file, 'utf8');
  for (const match of source.matchAll(/\/assets\/[A-Za-z0-9_.\/-]+\.(?:png|webp|mp3|svg)/g)) {
    references.add(match[0]);
  }
}

const missing = [];
for (const pathname of references) {
  const destination = join(root, pathname.slice(1));
  try {
    await fs.access(destination);
  } catch {
    missing.push({ pathname, destination });
  }
}

let downloaded = 0;
let skipped = 0;
let failed = 0;
let cursor = 0;

const worker = async () => {
  while (cursor < missing.length) {
    const item = missing[cursor++];
    try {
      const response = await fetch(`${remoteOrigin}${item.pathname}`);
      if (!response.ok) {
        skipped++;
        continue;
      }
      await fs.mkdir(dirname(item.destination), { recursive: true });
      await fs.writeFile(item.destination, Buffer.from(await response.arrayBuffer()));
      downloaded++;
      if (downloaded % 100 === 0) console.log(`Téléchargés : ${downloaded}/${missing.length}`);
    } catch (error) {
      failed++;
      console.error(`Échec ${item.pathname}: ${error.message}`);
    }
  }
};

await Promise.all(Array.from({ length: Math.min(concurrency, missing.length) }, worker));
console.log(`Assets référencés : ${references.size}`);
console.log(`Assets manquants au départ : ${missing.length}`);
console.log(`Téléchargés : ${downloaded}, absents en ligne : ${skipped}, erreurs : ${failed}`);
