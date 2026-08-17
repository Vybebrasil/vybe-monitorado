import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { basename } from 'node:path';

const tracked = spawnSync('git', ['ls-files', '-co', '--exclude-standard', '-z'], { encoding: 'utf8' });
if (tracked.status !== 0) {
  console.error(tracked.stderr || 'Não foi possível listar os arquivos do workspace.');
  process.exit(1);
}

const files = tracked.stdout.split('\0').filter(Boolean);
const forbiddenPaths = [
  /(^|\/)cookies[^/]*\.json$/i,
  /(^|\/)credentials?[^/]*\.(json|ya?ml|txt)$/i,
  /(^|\/)secrets?[^/]*\.(json|ya?ml|txt)$/i,
  /(^|\/)explore_[^/]*\.(cjs|mjs)$/i,
  /\.(pem|key|p12|pfx)$/i
];
const secretPatterns = [
  { label: 'GitHub token', expression: new RegExp('ghp_' + '[A-Za-z0-9]{20,}', 'g') },
  { label: 'GitHub fine-grained token', expression: new RegExp('github_pat_' + '[A-Za-z0-9_]{20,}', 'g') },
  { label: 'Google API key', expression: new RegExp('AIza' + '[A-Za-z0-9_-]{20,}', 'g') },
  { label: 'JWT literal', expression: new RegExp('eyJ' + '[A-Za-z0-9_-]{20,}\\.[A-Za-z0-9_-]{10,}\\.[A-Za-z0-9_-]{10,}', 'g') },
  { label: 'Private key', expression: new RegExp('BEGIN ' + '(?:RSA |EC |OPENSSH )?PRIVATE KEY', 'g') }
];
const binaryExtensions = /\.(png|jpe?g|gif|webp|ico|woff2?|ttf|eot|zip|gz|pdf)$/i;
const allowedExamples = new Set(['.env.example']);
const findings = [];

for (const file of files) {
  if (forbiddenPaths.some(pattern => pattern.test(file))) {
    findings.push(`${file}: arquivo sensível não deve ser rastreado.`);
    continue;
  }
  if (binaryExtensions.test(file) || allowedExamples.has(basename(file))) continue;

  let content;
  try {
    content = await readFile(file, 'utf8');
  } catch {
    continue;
  }

  for (const { label, expression } of secretPatterns) {
    expression.lastIndex = 0;
    if (expression.test(content)) findings.push(`${file}: possível ${label}.`);
  }
}

if (findings.length) {
  console.error('[SECRETS] Possíveis segredos encontrados:');
  findings.forEach(finding => console.error(`- ${finding}`));
  process.exit(1);
}

console.log(`[SECRETS] ${files.length} arquivo(s) do workspace verificado(s).`);
