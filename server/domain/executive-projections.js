const numeric = value => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const metricKeys = ['activeItems', 'completedItems', 'delayedProduction', 'overdueDemands', 'openDemands'];

function ratePerDay(points, key) {
  const valid = points.filter(point => numeric(point?.[key]) !== null && point?.capturedAt);
  if (valid.length < 2) return null;
  const first = valid[0];
  const last = valid.at(-1);
  const elapsedDays = Math.max(1 / 24, (new Date(last.capturedAt).getTime() - new Date(first.capturedAt).getTime()) / 86400000);
  return (Number(last[key]) - Number(first[key])) / elapsedDays;
}

function currentSignals(snapshot = {}) {
  const summary = snapshot.summary || {};
  const quantitative = snapshot.quantitative || {};
  const productivity = snapshot.productivity || {};
  return {
    activeItems: numeric(productivity.activeItems ?? quantitative.activeItems),
    completedItems: numeric(productivity.completedItems ?? quantitative.completedItems),
    delayedProduction: numeric(summary.delayedTeam ?? quantitative.overdueInternal),
    overdueDemands: numeric(summary.delayedDemands),
    openDemands: Array.isArray(snapshot.demandItems) ? snapshot.demandItems.length : null,
    score: numeric(snapshot.portfolioStability?.score)
  };
}

function horizonScenario(signals, horizonDays) {
  const zeroSignal = key => signals[key] === null ? null : Math.max(0, Number(signals[key]) - (Number(signals[key]) / horizonDays) * horizonDays);
  return {
    horizonDays,
    label: `Zerar sinais atuais em ${horizonDays} dias`,
    assumption: 'Contrafactual de esforço uniforme; não é promessa de entrega nem previsão automática.',
    delayedProduction: zeroSignal('delayedProduction'),
    overdueDemands: zeroSignal('overdueDemands'),
    requiredDailyDelayResolution: signals.delayedProduction === null ? null : Number((signals.delayedProduction / horizonDays).toFixed(2)),
    requiredDailyDemandResolution: signals.overdueDemands === null ? null : Number((signals.overdueDemands / horizonDays).toFixed(2))
  };
}

export function buildExecutiveProjections({ snapshot = {}, timeSeries = null } = {}) {
  const signals = currentSignals(snapshot);
  const points = Array.isArray(timeSeries?.points) ? timeSeries.points : [];
  const rates = Object.fromEntries(metricKeys.map(key => [key, ratePerDay(points, key)]));
  const historical = points.length >= 2;
  return {
    available: historical,
    mode: historical ? 'observed_trend' : 'counterfactual_only',
    confidence: historical ? 'partial' : 'low',
    current: signals,
    trendPerDay: rates,
    scenarios: [7, 14, 30].map(days => horizonScenario(signals, days)),
    assumptions: [
      'A tendência só é calculada com pelo menos dois snapshots persistidos e timestamps válidos.',
      'A projeção de zeragem mostra o esforço diário necessário; não presume capacidade individual nem causa.',
      'Entradas novas, bloqueios externos e mudanças de prioridade podem alterar o resultado.'
    ],
    note: historical
      ? 'Cenários derivados da tendência observada e do esforço necessário para reduzir os sinais atuais.'
      : 'Histórico insuficiente para projetar tendência; os cenários mostram apenas o esforço matemático necessário para reduzir o estoque atual.'
  };
}
