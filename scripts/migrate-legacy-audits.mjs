import { mkdir, readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { clients } from '../src/data/clients.js';
import { createVersionedAuditRecord } from '../server/domain/audit-records.js';

const outputPath = process.env.NEXUS_MIGRATION_OUTPUT || join(process.env.NEXUS_LOCAL_DATA_DIR || join(process.cwd(), '.data'), 'legacy-audits.json');
const dryRun = process.argv.includes('--dry-run');
const legacySource = 'clients.js-legacy-migration';

async function readExistingRecords() {
  try {
    const content = await readFile(outputPath, 'utf8');
    const parsed = JSON.parse(content);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}

const records = clients.map(client => createVersionedAuditRecord({
  id: `audit-legacy-${client.id}`,
  clientId: client.id,
  source: legacySource,
  status: 'legacy_unvalidated',
  confidence: 'unverified',
  analysis: {
    igStats: client.businessIntelligence?.igStats,
    cmoDirective: client.cmoDirective,
    issues: (client.channels || []).flatMap(channel => (channel.issues || []).map(issue => ({
      ...issue,
      title: `[${channel.name}] ${issue.title}`
    })))
  }
}));

const existing = await readExistingRecords();
const legacyIds = new Set(records.map(record => record.id));
const preserved = existing.filter(record => !legacyIds.has(record?.id));
const merged = [...preserved, ...records];
const existingLegacyCount = existing.filter(record => legacyIds.has(record?.id)).length;
const summary = {
  dryRun,
  outputPath,
  source: legacySource,
  legacyClients: records.length,
  existingLegacyRecords: existingLegacyCount,
  added: Math.max(0, records.length - existingLegacyCount),
  updated: existingLegacyCount,
  preservedExternalRecords: preserved.length,
  totalAfterMigration: merged.length,
  status: 'legacy_unvalidated',
  nextStep: 'Validar humanamente as análises legadas antes de tratá-las como evidência executiva.'
};

if (!dryRun) {
  await mkdir(join(outputPath, '..'), { recursive: true });
  await writeFile(outputPath, JSON.stringify(merged, null, 2), 'utf8');
  summary.migrated = true;
}

console.log(JSON.stringify(summary, null, 2));
