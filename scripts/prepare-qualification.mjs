import { lstat, mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

// Copy only these explicit inputs. Logs, environment records, and repository
// history must never be included in the portable handoff.
const inputs = [
  ['mind-mapper.html', 'dist/mind-mapper.html'],
  ['START-HERE.md', 'docs/qualification/START-HERE.md'],
  ['RESULTS-TEMPLATE.md', 'docs/qualification/RESULTS-TEMPLATE.md'],
  ['VISUAL-DESIGN-STANDARD.md', 'docs/planning/VISUAL-DESIGN-STANDARD.md'],
];

export async function prepareQualification({ root = projectRoot, destination = 'dist/qualification-handoff' } = {}) {
  const absoluteRoot = resolve(root);
  const dist = resolve(absoluteRoot, 'dist');
  const output = resolve(absoluteRoot, destination);
  if (dirname(output) !== dist) throw new Error('Choose a new direct child directory of dist/.');
  const distInfo = await lstat(dist).catch(() => null);
  if (!distInfo?.isDirectory() || distInfo.isSymbolicLink()) {
    throw new Error('dist/ must be a regular directory. Run npm run build first.');
  }

  // Read before creating anything. Never rebuild the application here.
  const files = await Promise.all(inputs.map(async ([name, path]) => {
    const source = resolve(absoluteRoot, path);
    const info = await lstat(source).catch(() => null);
    if (!info?.isFile() || info.isSymbolicLink()) {
      throw new Error(`Missing regular input ${path}; build the application and retain the handoff documents.`);
    }
    return { name, bytes: await readFile(source) };
  }));

  try {
    await mkdir(output); // Exclusive creation; preserve all existing results.
  } catch (error) {
    if (error.code === 'EEXIST') throw new Error('Destination already exists. Preserve it and choose a fresh dist/ directory.');
    throw error;
  }
  const manifest = {
    format: 'lfcfoundry.mind-mapper.qualification-handoff',
    version: 1,
    qualificationStatus: 'NOT RUN',
    files: files.map(({ name, bytes }) => ({ path: name, bytes: bytes.length, sha256: sha256(bytes) })),
  };
  // If a write fails, retain the partial directory for inspection. No cleanup
  // or replacement of user files is performed.
  for (const { name, bytes } of files) await writeFile(resolve(output, name), bytes, { flag: 'wx' });
  await writeFile(resolve(output, 'MANIFEST.json'), JSON.stringify(manifest, null, 2) + '\n', { flag: 'wx' });
  return { output: relative(absoluteRoot, output), manifest };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv.length > 3) throw new Error('Usage: node scripts/prepare-qualification.mjs [dist/new-folder]');
    const result = await prepareQualification({ destination: process.argv[2] ?? 'dist/qualification-handoff' });
    process.stdout.write(`Prepared ${result.output}\nApplication SHA-256: ${result.manifest.files[0].sha256}\nBrowser qualification: NOT RUN\n`);
  } catch (error) {
    process.stderr.write(error.message + '\n');
    process.exitCode = 1;
  }
}
