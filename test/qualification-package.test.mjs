import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, mkdir, readFile, readdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { prepareQualification } from '../scripts/prepare-qualification.mjs';

async function fixture(t) {
  const root = await mkdtemp(resolve(tmpdir(), 'mind-mapper-handoff-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  for (const dir of ['dist', 'docs/qualification', 'docs/planning']) await mkdir(resolve(root, dir), { recursive: true });
  const files = {
    'dist/mind-mapper.html': '<!doctype html><title>Standalone artifact fixture</title>\n',
    'docs/qualification/START-HERE.md': 'Portable guide\n',
    'docs/qualification/RESULTS-TEMPLATE.md': 'All checks NOT RUN\n',
    'docs/planning/VISUAL-DESIGN-STANDARD.md': 'Authoritative standard\n',
    'dist/private-environment.log': 'This unrelated log must not be shipped.\n',
  };
  for (const [path, content] of Object.entries(files)) await writeFile(resolve(root, path), content);
  return { root, files };
}

test('handoff copies exact artifact bytes, excludes unrelated logs, and records reproducible hashes without local paths', async (t) => {
  const { root, files } = await fixture(t);
  const first = await prepareQualification({ root });
  const output = resolve(root, first.output);
  assert.deepEqual((await readdir(output)).sort(), ['MANIFEST.json', 'RESULTS-TEMPLATE.md', 'START-HERE.md', 'VISUAL-DESIGN-STANDARD.md', 'mind-mapper.html']);
  assert.equal(await readFile(resolve(output, 'mind-mapper.html'), 'utf8'), files['dist/mind-mapper.html']);
  for (const entry of first.manifest.files) {
    const bytes = await readFile(resolve(output, entry.path));
    assert.equal(entry.bytes, bytes.length);
    assert.equal(entry.sha256, createHash('sha256').update(bytes).digest('hex'));
    assert.equal(entry.path.includes('/'), false);
  }
  assert.equal(first.manifest.qualificationStatus, 'NOT RUN');
  assert.equal(JSON.stringify(first.manifest).includes(root), false);
  const second = await prepareQualification({ root, destination: 'dist/qualification-handoff-run2' });
  assert.deepEqual(second.manifest, first.manifest);
});

test('handoff refuses an existing destination without overwriting reports or artifact', async (t) => {
  const { root } = await fixture(t);
  const result = await prepareQualification({ root });
  const report = resolve(root, result.output, 'RESULTS-desktop.md');
  await writeFile(report, 'Preserve observed results');
  const artifact = await readFile(resolve(root, result.output, 'mind-mapper.html'));
  await assert.rejects(prepareQualification({ root }), /already exists/);
  assert.equal(await readFile(report, 'utf8'), 'Preserve observed results');
  assert.deepEqual(await readFile(resolve(root, result.output, 'mind-mapper.html')), artifact);
});

test('handoff rejects destinations outside dist and missing inputs before creating output', async (t) => {
  const { root } = await fixture(t);
  await assert.rejects(prepareQualification({ root, destination: '../unrelated-handoff' }), /direct child/);
  await rm(resolve(root, 'dist/mind-mapper.html'));
  await assert.rejects(prepareQualification({ root }), /Missing regular input/);
  assert.equal((await readdir(resolve(root, 'dist'))).includes('qualification-handoff'), false);
});
