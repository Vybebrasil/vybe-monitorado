import { mkdir, readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { clients } from '../src/data/clients.js';
import { createVersionedAuditRecord } from '../api/domain/audit-records.js';

const outputPath = process.env.NEXUS_MIGRATION_OUTPUT || join(process.env.NEXUS_LOCAL_DATA_DIR || join(process.cwd(), '.data'), 'legacy-audits.json');
const dryRun = process.argv.includes('--dry-run');

const records = clients.map(client => createVersionedAuditRecord({
  clientId: client.id,
  source: 'clients.js-legacy-migration',
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

if (dryRun) {
  console.log(JSON.stringify({ dryRun: true, outputPath, count: records.length, statuses: { legacy_unvalidated: records.length } }, null, 2));
  process.exit(0);
}

await mkdir(join(outputPath, '..'), { recursive: true });
await writeFile(outputPath, JSON.stringify(records, null, 2), 'utf8');
console.log(JSON.stringify({ migrated: true, outputPath, count: records.length, status: 'legacy_unvalidated' }, null, 2));
