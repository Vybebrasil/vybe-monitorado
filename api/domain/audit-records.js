export const AUDIT_SCHEMA_VERSION = 1;

const text = (value, maxLength = 4000) => typeof value === 'string' ? value.trim().slice(0, maxLength) : '';

export function createVersionedAuditRecord({ clientId, analysis, source = 'manual' }) {
  const capturedAt = new Date().toISOString();
  return {
    id: `audit-${clientId}-${Date.now()}`,
    clientId,
    version: 1,
    schemaVersion: AUDIT_SCHEMA_VERSION,
    status: 'pending_validation',
    source,
    capturedAt,
    validatedAt: null,
    validatedBy: null,
    confidence: 'unverified',
    evidence: {
      igStats: text(analysis?.igStats),
      issues: Array.isArray(analysis?.issues) ? analysis.issues.map(issue => ({
        title: text(issue?.title, 240),
        evidence: text(issue?.evidence),
        rationale: text(issue?.rationale),
        impact: text(issue?.impact),
        steps: Array.isArray(issue?.steps) ? issue.steps.map(step => text(step, 800)).filter(Boolean) : []
      })) : []
    },
    directive: text(analysis?.cmoDirective),
    history: [{
      status: 'pending_validation',
      at: capturedAt,
      note: 'Análise recebida; validação humana ainda necessária.'
    }]
  };
}
