export const AUDIT_SCHEMA_VERSION = 1;

const text = (value, maxLength = 4000) => typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
export const AUDIT_STATUSES = ['pending_validation', 'in_review', 'validated', 'stale', 'superseded', 'legacy_unvalidated'];
export const AUDIT_CONFIDENCE = ['unverified', 'partial', 'medium', 'high'];

export function createVersionedAuditRecord({ clientId, analysis, source = 'manual', status = 'pending_validation', confidence = 'unverified' }) {
  const capturedAt = new Date().toISOString();
  const safeStatus = AUDIT_STATUSES.includes(status) ? status : 'pending_validation';
  const safeConfidence = AUDIT_CONFIDENCE.includes(confidence) ? confidence : 'unverified';
  return {
    id: `audit-${clientId}-${Date.now()}`,
    clientId,
    version: 1,
    schemaVersion: AUDIT_SCHEMA_VERSION,
    status: safeStatus,
    source,
    capturedAt,
    validatedAt: safeStatus === 'validated' ? capturedAt : null,
    validatedBy: null,
    confidence: safeConfidence,
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
      status: safeStatus,
      at: capturedAt,
      note: safeStatus === 'legacy_unvalidated' ? 'Análise migrada do cadastro legado; validação humana ainda necessária.' : 'Análise recebida; validação humana ainda necessária.'
    }]
  };
}
