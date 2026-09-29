// GC — gtg-engine/ is a full, byte-identical copy of indicators/gtg-navigator at the
// frozen production HEAD 0a77819 (user instruction: the lab works on its own copy and
// never touches the indicator in use). gtg-engine.manifest = `git ls-tree -r 0a77819`.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../gtg-engine/', import.meta.url));
const manifest = readFileSync(fileURLToPath(new URL('../gtg-engine.manifest', import.meta.url)), 'utf8')
  .trim().split('\n').map((l) => { const [sha, ...p] = l.split('  '); return [p.join('  '), sha]; });
const blob = (buf) => createHash('sha1').update(`blob ${buf.length}\0`).update(buf).digest('hex');

function walk(dir, rel = '') {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n), r = rel ? `${rel}/${n}` : n;
    return statSync(p).isDirectory() ? walk(p, r) : [r];
  });
}

test('GC1 every file of the production tree at 0a77819 is present and byte-identical', () => {
  assert.equal(manifest.length, 161);
  for (const [path, sha] of manifest) assert.equal(blob(readFileSync(join(root, path))), sha, path);
});

test('GC2 the copy holds no extra files', () => {
  const want = new Set(manifest.map(([p]) => p));
  const extra = walk(root).filter((p) => !want.has(p));
  assert.deepEqual(extra, []);
});

test('GC3 the copy carries the frozen Pine blob 0c7cbe3', () => {
  assert.equal(blob(readFileSync(join(root, 'gtg_navigator_v0.4.7.pine'))), '0c7cbe366668fba20c9bc128448f908ce9314041');
});
