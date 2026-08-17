import { readdir } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOTS = ['api', 'scripts', 'tests'];
const EXTENSIONS = new Set(['.js', '.mjs', '.cjs']);
const IGNORED = new Set(['node_modules', 'dist', '.git', '.data']);

async function collect(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (IGNORED.has(entry.name)) continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await collect(path));
    else if (EXTENSIONS.has(extname(entry.name))) files.push(path);
  }

  return files;
}

const files = [];
for (const root of ROOTS) {
  try {
    files.push(...await collect(root));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

const failures = [];
for (const file of files.sort()) {
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (result.status !== 0) failures.push({ file, output: `${result.stdout}${result.stderr}`.trim() });
}

if (failures.length) {
  for (const failure of failures) console.error(`\n[SYNTAX] ${failure.file}\n${failure.output}`);
  process.exit(1);
}

console.log(`[SYNTAX] ${files.length} arquivo(s) verificado(s).`);
