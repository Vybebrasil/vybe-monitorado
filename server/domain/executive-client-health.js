function latestByClient(snapshots = []) {
  const map = new Map();
  for (const snapshot of snapshots) {
    if (!snapshot?.clientId) continue;
    const previous = map.get(snapshot.clientId);
    if (!previous || new Date(snapshot.capturedAt || 0) > new Date(previous.capturedAt || 0)) map.set(snapshot.clientId, snapshot);
  }
  return map;
}

export function buildClientHealthPortfolio(snapshots = []) {
  const latest = latestByClient(snapshots);
  const rows = [...latest.values()].map(snapshot => ({
    clientId: snapshot.clientId,
    clientName: snapshot.clientName || snapshot.clientId,
    status: snapshot.status || 'unknown',
    trend: snapshot.trend || 'unknown',
    score: Number.isFinite(Number(snapshot.score)) ? Number(snapshot.score) : null,
    capturedAt: snapshot.capturedAt || null,
    evidenceCount: Number(snapshot.evidenceCount || 0),
    source: snapshot.source || 'Nexus Health Registry'
  })).sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
  const atRisk = rows.filter(row => row.status === 'risk' || row.trend === 'declining');
  const improving = rows.filter(row => row.trend === 'improving');
  return {
    available: rows.length > 0,
    observedClients: rows.length,
    atRiskCount: atRisk.length,
    improvingCount: improving.length,
    rows: rows.slice(0, 50),
    note: rows.length
      ? 'Saúde histórica baseada nos últimos snapshots persistidos por cliente; não substitui investigação de causa.'
      : 'Ainda não há snapshots históricos de saúde por cliente.'
  };
}
