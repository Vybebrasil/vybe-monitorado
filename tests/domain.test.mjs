import test from 'node:test';
import assert from 'node:assert/strict';

import { buildClientHealthScore } from '../server/domain/health-score.js';
import { createDecisionRecord } from '../server/domain/executive-records.js';
import {
  summarizeDecisionEffectiveness,
  detectPersistentRisks
} from '../server/domain/decision-analytics.js';
import {
  buildExecutiveAlerts,
  transitionExecutiveAlert
} from '../server/domain/executive-alerts.js';
import { buildOutcomeLearning } from '../server/domain/outcome-learning.js';
import { buildCalendarSignals, buildExecutiveSnapshot } from '../server/domain/executive.js';
import { summarizeExecutiveDelta } from '../server/domain/executive-snapshots.js';
import { buildExecutiveBriefing } from '../server/domain/decision-analytics.js';
import { buildReleaseMetadata } from '../server/release.js';
import { createRecordStore, describeRecordStore } from '../server/persistence/record-store.js';
import mondayIntegration from '../server/integrations/monday.js';
import { getVybePanelProductionSnapshot, getVybePanelExecutiveSnapshot } from '../server/integrations/vybe-panel.js';
import { securityHeaders, createRateLimiter } from '../server/security.js';
import { createVersionedAuditRecord } from '../server/domain/audit-records.js';

test('Health Score saudável preserva explicabilidade e confiança alta', () => {
  const result = buildClientHealthScore({
    clientName: 'Cliente saudável',
    daysSinceLastMeeting: 7,
    openPosts: 5,
    delayedPosts: 0,
    delayedDemands: 0,
    missingPlanning: false,
    missingDashboard: false,
    auditStatus: 'validated',
    previousScore: 90,
    capturedAt: '2026-08-17T00:00:00.000Z'
  });

  assert.equal(result.status, 'healthy');
  assert.equal(result.confidence, 'high');
  assert.equal(result.factors.length, 5);
  assert.ok(result.score >= 90);
  assert.equal(result.model, 'client-health-v2');
});

test('Health Score de risco explica dados e atrasos incompletos', () => {
  const result = buildClientHealthScore({
    clientName: 'Cliente em risco',
    daysSinceLastMeeting: 120,
    openPosts: 30,
    delayedPosts: 8,
    delayedDemands: 4,
    missingPlanning: true,
    missingDashboard: true,
    auditStatus: 'pending_validation',
    previousScore: 60
  });

  assert.equal(result.status, 'risk');
  assert.equal(result.confidence, 'partial');
  assert.equal(result.trend, 'declining');
  assert.ok(result.score < 50);
});

test('Registro de Decisão cria histórico sem alterar o Monday', () => {
  const record = createDecisionRecord({
    clientId: 'cliente-a',
    title: 'Revisar estratégia de relacionamento',
    context: 'O Health Score caiu por dois ciclos.',
    ownerRole: 'Liderança executiva',
    priority: 'high',
    checkpointAt: '2026-09-01',
    evidence: [{ source: 'Nexus', detail: 'Dois snapshots em queda.' }]
  });

  assert.match(record.id, /^decision-/);
  assert.equal(record.status, 'decision_needed');
  assert.equal(record.history.length, 1);
  assert.equal(record.history[0].status, 'decision_needed');
});

test('Eficácia usa o impacto mais recente de cada decisão', () => {
  const decisions = [{ id: 'd1' }, { id: 'd2' }];
  const impacts = [
    { id: 'i1', decisionId: 'd1', result: 'worsened', updatedAt: '2026-08-01T00:00:00.000Z' },
    { id: 'i2', decisionId: 'd1', result: 'improved', updatedAt: '2026-08-10T00:00:00.000Z' }
  ];

  const result = summarizeDecisionEffectiveness(decisions, impacts);
  assert.equal(result.evaluatedDecisions, 1);
  assert.equal(result.pendingEvaluation, 1);
  assert.equal(result.counts.improved, 1);
  assert.equal(result.counts.worsened, 0);
  assert.equal(result.positiveRate, 100);
});

test('Risco persistente detecta decisão sem checkpoint e Health Score recorrente', () => {
  const risks = detectPersistentRisks({
    decisions: [{ id: 'd1', title: 'Definir intervenção', status: 'decision_needed', priority: 'high' }],
    impacts: [],
    healthSnapshots: [
      { clientId: 'cliente-a', clientName: 'Cliente A', status: 'risk', trend: 'declining', capturedAt: '2026-08-17T00:00:00.000Z' },
      { clientId: 'cliente-a', clientName: 'Cliente A', status: 'risk', trend: 'stable', capturedAt: '2026-08-10T00:00:00.000Z' }
    ]
  });

  assert.ok(risks.some(risk => risk.type === 'decision_checkpoint'));
  assert.ok(risks.some(risk => risk.type === 'persistent_health'));
});

test('Alertas são deduplicados e preservam ciclo de vida', () => {
  const alerts = buildExecutiveAlerts({
    risks: [
      { id: 'r1', type: 'decision_checkpoint', title: 'Checkpoint vencido', reason: 'Prazo ultrapassado', recommendedAction: 'Revisar decisão' },
      { id: 'r1', type: 'decision_checkpoint', title: 'Checkpoint vencido', reason: 'Prazo ultrapassado', recommendedAction: 'Revisar decisão' }
    ],
    effectiveness: { negativeCount: 0 },
    freshness: 'live'
  });

  assert.equal(alerts.length, 1);
  assert.equal(alerts[0].lifecycle, 'detected');

  const reviewed = transitionExecutiveAlert(alerts[0], 'reviewed', 'Revisado em reunião.');
  assert.equal(reviewed.lifecycle, 'reviewed');
  assert.equal(reviewed.lifecycleHistory.length, 2);
});

test('Aprendizado declara associação e lacunas de evidência', () => {
  const result = buildOutcomeLearning({
    decisions: [{ id: 'd1' }, { id: 'd2' }],
    impacts: [{ decisionId: 'd1', result: 'improved' }],
    persistentRisks: [{ id: 'r1' }]
  });

  assert.equal(result.evaluated, 1);
  assert.equal(result.counts.improved, 1);
  assert.equal(result.learnings.find(item => item.id === 'evidence-gaps').summary, '1 decisão(ões) ainda sem avaliação de impacto.');
  assert.match(result.note, /não conclusões causais/i);
});

test('Snapshot executivo preserva KPIs quantitativos e ranking de risco', () => {
  const snapshot = buildExecutiveSnapshot({
    bottlenecks: { missingPlanning: ['Cliente C'], missingDashboard: [] },
    posts: {
      ranking: [
        { name: 'Cliente A', open: 10, delayedPrazo: 2, delayedVeiculacao: 0, details: [{ id: '1', isDelayedPrazo: true }] },
        { name: 'Cliente B', open: 5, delayedPrazo: 0, delayedVeiculacao: 1, details: [{ id: '2', isDelayedVeiculacao: true }] }
      ],
      delayDetails: [{ id: '1', client: 'Cliente A', name: 'Post atrasado', delayType: 'prazo interno', daysOverdue: 2 }],
      productivity: { completionPct: 25, readyToSchedule: 4, delayedItems: 2, byStage: [{ stage: 'Design', count: 8, pctOfActive: 53.3 }] },
      quantitative: {
        totalItems: 20,
        itemsWithClient: 20,
        clientCoveragePct: 100,
        activeItems: 15,
        completedItems: 5,
        activePct: 75,
        itemsWithInternalDeadline: 18,
        internalDeadlineCoveragePct: 90,
        itemsWithPublicationDate: 20,
        publicationDateCoveragePct: 100,
        overdueInternal: 2,
        overdueInternalPctOfActive: 13.3,
        overduePublication: 1,
        overduePublicationPctOfActive: 6.7,
        priorityCoveragePct: 40,
        statusCounts: { 'Finalizado': 5, 'Em andamento': 10, 'A Fazer': 5 },
        statusColors: { 'Finalizado': '#9cd326', 'Em andamento': '#fdab3d', 'A Fazer': '#c4c4c4' }
      }
    },
    demands: [],
    generatedAt: '2026-08-17T00:00:00.000Z'
  });

  assert.equal(snapshot.quantitative.totalItems, 20);
  assert.equal(snapshot.quantitative.activePct, 75);
  assert.equal(snapshot.quantitative.internalDeadlineCoveragePct, 90);
  assert.equal(snapshot.quantitative.overdueInternalPctOfActive, 13.3);
  assert.equal(snapshot.clientRanking[0].client, 'Cliente A');
  assert.equal(snapshot.clientRanking[0].riskPct, 20);
  assert.equal(snapshot.delayDetails[0].delayType, 'prazo interno');
  assert.equal(snapshot.productivity.readyToSchedule, 4);
  assert.equal(snapshot.quantitative.statusColors['Em andamento'], '#fdab3d');
  assert.equal(snapshot.executiveRisks[0].ownerRole, 'Liderança executiva');
  assert.equal(snapshot.methodology.source, 'Monday.com · Produção de Conteúdo');
  assert.equal(snapshot.portfolioStability.scoreDeductions.find(item => item.id === 'internal-delays').label, 'Atrasos em Produção de Conteúdo');
  assert.equal(snapshot.portfolioStability.scoreDeductions.find(item => item.id === 'internal-delays').source, 'Monday.com · Produção de Conteúdo · prazo interno');
});

test('Snapshot expõe itens ativos detalhados para investigação por status', () => {
  const snapshot = buildExecutiveSnapshot({
    posts: {
      activeItems: [
        { id: '101', name: 'Item em Aguardo', status: 'Aguardo', client: 'Cliente A' },
        { id: '102', name: 'Item em andamento', status: 'Em andamento', client: 'Cliente B' }
      ],
      ranking: [],
      quantitative: { activeItems: 2, statusCounts: { Aguardo: 1, 'Em andamento': 1 } }
    },
    demands: Object.assign([], { clientsWithOpenDemand: [] }),
    generatedAt: '2026-08-18T00:00:00.000Z'
  });

  assert.deepEqual(snapshot.activeItems.map(item => item.status), ['Aguardo', 'Em andamento']);
  assert.equal(snapshot.activeItems.find(item => item.status === 'Aguardo').name, 'Item em Aguardo');
});

test('Snapshot expõe frescor da fonte e clientes em risco sem reunião futura', () => {
  const snapshot = buildExecutiveSnapshot({
    bottlenecks: {
      activePortfolio: [{ name: 'Cliente A', since: '2025-01-01T00:00:00Z' }, { name: 'Cliente B', since: '2025-01-01T00:00:00Z' }],
      pagination: { pages: 1, count: 2, complete: true },
      quantitative: { eligibleClients: 2, planningCoveragePct: 100, dashboardCoveragePct: 100 }
    },
    posts: {
      pagination: { pages: 1, count: 2, complete: true },
      ranking: [
        { name: 'Cliente A', open: 4, delayedPrazo: 1, delayedVeiculacao: 0, details: [] },
        { name: 'Cliente B', open: 3, delayedPrazo: 1, delayedVeiculacao: 0, details: [] }
      ]
    },
    demands: Object.assign([], { pagination: { pages: 1, count: 0, complete: true }, clientsWithOpenDemand: [] }),
    calendar: {
      events: [{ title: 'Cliente A · reunião executiva', date: '2026-08-20T12:00:00.000Z' }],
      quality: { source: 'Google Calendar · iCal', configured: true, complete: true, status: 'ok', fetchedAt: '2026-08-18T00:00:00.000Z', eventCount: 1 }
    },
    generatedAt: '2026-08-18T00:00:00.000Z'
  });

  assert.equal(snapshot.sourceQuality.capturedAt, '2026-08-18T00:00:00.000Z');
  assert.equal(snapshot.sourceQuality.complete, true);
  assert.equal(snapshot.sourceQuality.records, 4);
  assert.equal(snapshot.calendarSignals.next7Count, 1);
  assert.deepEqual(snapshot.calendarSignals.riskClientsWithoutMeeting, ['Cliente B']);
});

test('Prontidão sistêmica gera missões de fonte sem duplicar execução ou onboarding', () => {
  const snapshot = buildExecutiveSnapshot({
    bottlenecks: {
      missingPlanning: ['Cliente Produzindo', 'Cliente Parado', 'Cliente Novo'],
      missingDashboard: ['Cliente Produzindo', 'Cliente Parado', 'Cliente Novo'],
      quantitative: { eligibleClients: 3, planningCoveragePct: 0, dashboardCoveragePct: 0 },
      activePortfolio: [
        { name: 'Cliente Produzindo', since: '2025-01-10T00:00:00Z' },
        { name: 'Cliente Parado', since: '2025-01-10T00:00:00Z' },
        { name: 'Cliente Novo', since: '2026-08-16T00:00:00Z' }
      ]
    },
    posts: {
      ranking: [{ name: 'Cliente Produzindo', open: 4, delayedPrazo: 0, delayedVeiculacao: 0, details: [] }]
    },
    demands: Object.assign([], { clientsWithOpenDemand: [] }),
    generatedAt: '2026-08-17T00:00:00.000Z'
  });

  assert.equal(snapshot.portfolioStability.score, 85);
  assert.deepEqual(snapshot.portfolioReadiness.scoreDeductions.map(item => item.id), ['planning-source-gap', 'dashboard-source-gap']);
  assert.equal(snapshot.portfolioStability.scoreDeductions.find(item => item.id === 'planning-source-gap').points, 5);
  assert.equal(snapshot.portfolioStability.scoreDeductions.find(item => item.id === 'dashboard-source-gap').points, 5);
  assert.equal(snapshot.portfolioReadiness.scoreDeductions[0].affectedClients.length, 3);
  assert.equal(snapshot.portfolioStability.scoreDeductions.some(item => item.id === 'missing-planning'), false);
});

test('Cliente ativo sem conteúdo e sem demanda vira sinal de execução, respeitando onboarding', () => {
  const snapshot = buildExecutiveSnapshot({
    bottlenecks: {
      missingPlanning: [],
      missingDashboard: [],
      activePortfolio: [
        { name: 'Cliente Produzindo', since: '2025-01-10T00:00:00Z' },
        { name: 'Cliente Só Demanda', since: '2025-01-10T00:00:00Z' },
        { name: 'Cliente Parado', since: '2025-01-10T00:00:00Z' },
        { name: 'Cliente Novo', since: '2026-08-10T00:00:00Z' }
      ]
    },
    posts: {
      ranking: [{ name: 'Cliente Produzindo', open: 4, delayedPrazo: 0, delayedVeiculacao: 0, details: [] }]
    },
    demands: Object.assign([], { clientsWithOpenDemand: ['Cliente Só Demanda'] }),
    generatedAt: '2026-08-17T00:00:00.000Z'
  });

  const execution = snapshot.portfolioExecution;
  assert.deepEqual(execution.stalled.map(c => c.client), ['Cliente Parado']);
  assert.deepEqual(execution.onboarding.map(c => c.client), ['Cliente Novo']);
  assert.equal(execution.clientsInExecution, 2);

  // Quem tem demanda aberta, mesmo sem nenhum atraso, não pode ser lido como parado.
  assert.equal(execution.stalled.some(c => c.client === 'Cliente Só Demanda'), false);

  // O sinal precisa chegar ao risco executivo e ao score, no lugar da antiga constante.
  const risk = snapshot.executiveRisks.find(r => r.id === 'portfolio-execution-gap');
  assert.ok(risk, 'risco de execução deveria existir');
  assert.equal(risk.affectedItems.length, 1);
  assert.equal(snapshot.portfolioStability.score, 95);
});

test('Release usa SHA oficial da Vercel e gera URL verificável no GitHub', () => {
  const result = buildReleaseMetadata({
    VERCEL_GIT_COMMIT_SHA: 'a'.repeat(40),
    VERCEL_GIT_PROVIDER: 'github',
    VERCEL_GIT_REPO_OWNER: 'Vybebrasil',
    VERCEL_GIT_REPO_SLUG: 'vybe-monitorado',
    VERCEL_GIT_COMMIT_REF: 'main',
    VERCEL_DEPLOYMENT_ID: 'dpl_test'
  });

  assert.equal(result.trackable, true);
  assert.equal(result.branch, 'main');
  assert.equal(result.commitUrl, `https://github.com/Vybebrasil/vybe-monitorado/commit/${'a'.repeat(40)}`);
});

test('Store local fica pronto em desenvolvimento sem declarar persistência externa', () => {
  const result = describeRecordStore('decisions');
  assert.equal(result.mode, 'local-development');
  assert.equal(result.ready, true);
  assert.equal(result.retention.enabled, true);
  assert.equal(result.retention.retentionDays, 180);
  assert.equal(result.retention.maxRecords, 5000);
});

test('Adaptador remoto serializa registros e usa autenticação Bearer', async () => {
  const originalEnv = {
    NODE_ENV: process.env.NODE_ENV,
    NEXUS_DECISION_STORE_URL: process.env.NEXUS_DECISION_STORE_URL,
    NEXUS_DECISION_STORE_TOKEN: process.env.NEXUS_DECISION_STORE_TOKEN,
    UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
    UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN
  };
  const originalFetch = globalThis.fetch;
  const calls = [];

  process.env.NODE_ENV = 'production';
  process.env.NEXUS_DECISION_STORE_URL = 'https://redis.example.test';
  process.env.NEXUS_DECISION_STORE_TOKEN = 'secret-for-test';
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
  globalThis.fetch = async (url, options) => {
    const command = JSON.parse(options.body);
    calls.push({ url, authorization: options.headers.authorization, command });
    if (command[0] === 'HVALS') return new Response(JSON.stringify({ result: [JSON.stringify({ id: 'decision-remote', title: 'Remoto' })] }), { status: 200 });
    if (command[0] === 'HGET') return new Response(JSON.stringify({ result: JSON.stringify({ id: command[2], title: 'Remoto' }) }), { status: 200 });
    if (command[0] === 'HSET') return new Response(JSON.stringify({ result: 1 }), { status: 200 });
    return new Response(JSON.stringify({ error: 'comando inesperado' }), { status: 400 });
  };

  try {
    const store = createRecordStore({
      storeName: 'decisions',
      localFileName: 'unused.json',
      unavailableCode: 'PERSISTENCE_NOT_CONFIGURED',
      unavailableMessage: 'Datastore indisponível.'
    });
    assert.equal(store.describe().mode, 'upstash-redis-rest');
    const records = await store.list();
    const found = await store.get('decision-remote');
    await store.set({ id: 'decision-remote', title: 'Atualizado' });
    assert.equal(records[0].id, 'decision-remote');
    assert.equal(found.id, 'decision-remote');
    assert.equal(calls.every(call => call.url === 'https://redis.example.test'), true);
    assert.equal(calls.every(call => call.authorization === 'Bearer secret-for-test'), true);
    assert.deepEqual(calls[2].command, ['HSET', 'vybe:nexus:executive-decisions', 'decision-remote', JSON.stringify({ id: 'decision-remote', title: 'Atualizado' })]);
  } finally {
    globalThis.fetch = originalFetch;
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});


test('Monday percorre todas as páginas por cursor e informa completude', async () => {
  const originalToken = process.env.MONDAY_API_TOKEN;
  const originalFetch = globalThis.fetch;
  const requests = [];
  process.env.MONDAY_API_TOKEN = 'token-for-test';

  globalThis.fetch = async (url, options) => {
    requests.push({ url, payload: JSON.parse(options.body) });
    if (requests.length === 1) {
      return new Response(JSON.stringify({
        data: { boards: [{ items_page: { cursor: 'cursor-1', items: [{ id: '1', name: 'Primeiro' }] } }] }
      }), { status: 200 });
    }
    return new Response(JSON.stringify({
      data: { next_items_page: { cursor: null, items: [{ id: '2', name: 'Segundo' }] } }
    }), { status: 200 });
  };

  try {
    const result = await mondayIntegration.getAllBoardItems({
      boardId: 7829537690,
      limit: 500,
      selection: 'id name'
    });

    assert.deepEqual(result.items.map(item => item.id), ['1', '2']);
    assert.deepEqual(result.pagination, { pages: 2, count: 2, complete: true });
    assert.match(requests[0].payload.query, /items_page\(limit: 500\)/);
    assert.match(requests[1].payload.query, /next_items_page\(limit: 500, cursor: \$cursor\)/);
    assert.deepEqual(requests[1].payload.variables, { cursor: 'cursor-1' });
  } finally {
    globalThis.fetch = originalFetch;
    if (originalToken === undefined) delete process.env.MONDAY_API_TOKEN;
    else process.env.MONDAY_API_TOKEN = originalToken;
  }
});


test('Snapshot sinaliza completude da leitura paginada do Monday', () => {
  const snapshot = buildExecutiveSnapshot({
    bottlenecks: { pagination: { pages: 1, count: 12, complete: true } },
    posts: {
      ranking: [],
      pagination: { pages: 4, count: 1600, complete: true }
    },
    demands: Object.assign([], { pagination: { pages: 2, count: 650, complete: true } }),
    generatedAt: '2026-08-18T00:00:00.000Z'
  });

  assert.equal(snapshot.sourceQuality.monday.complete, true);
  assert.equal(snapshot.sourceQuality.monday.boards.production.pages, 4);
  assert.equal(snapshot.sourceQuality.monday.boards.demands.count, 650);
});


test('Vybe Painel retorna snapshot read-only completo por cursor', async () => {
  const originalFetch = globalThis.fetch;
  const requests = [];

  globalThis.fetch = async (url, options) => {
    requests.push({ url, payload: JSON.parse(options.body) });
    if (requests.length === 1) {
      return new Response(JSON.stringify({
        data: { boards: [{ items_page: { cursor: 'panel-cursor-1', items: [{ id: 'panel-1', name: 'Item do Painel' }] } }] }
      }), { status: 200 });
    }
    return new Response(JSON.stringify({
      data: { next_items_page: { cursor: null, items: [{ id: 'panel-2', name: 'Segundo item' }] } }
    }), { status: 200 });
  };

  try {
    const result = await getVybePanelProductionSnapshot({ limit: 200 });
    assert.deepEqual(result.items.map(item => item.id), ['panel-1', 'panel-2']);
    assert.equal(result.pagination.pages, 2);
    assert.equal(result.pagination.count, 2);
    assert.equal(result.pagination.complete, true);
    assert.equal(result.pagination.truncated, false);
    assert.ok(result.pagination.elapsedMs >= 0);
    assert.equal(result.source, 'Vybe Painel');
    assert.deepEqual(requests[0].payload.variables, {});
    assert.deepEqual(requests[1].payload.variables, { cursor: 'panel-cursor-1' });
  } finally {
    globalThis.fetch = originalFetch;
  }
});


test('Delta executivo compara clientes sem execução usando o resumo persistido', () => {
  const delta = summarizeExecutiveDelta(
    { capturedAt: '2026-08-18T10:00:00.000Z', portfolioStability: { score: 4 }, summary: { stalledClients: 1, delayedTeam: 4 } },
    { capturedAt: '2026-08-17T10:00:00.000Z', portfolioStability: { score: -1 }, summary: { stalledClients: 2, delayedTeam: 6 } }
  );
  const stalled = delta.changes.find(change => change.key === 'stalledClients');
  assert.deepEqual(stalled, {
    key: 'stalledClients',
    label: 'Clientes sem execução',
    current: 1,
    previous: 2,
    delta: -1,
    direction: 'improving'
  });
  assert.equal(delta.score.delta, 5);
});

test('Briefing executivo apresenta score bruto em pontos, não como percentual', () => {
  const briefing = buildExecutiveBriefing({
    snapshot: { portfolioStability: { score: -26 }, summary: { executiveRisks: 4 } },
    effectiveness: { negativeCount: 0 },
    risks: [],
    patterns: { patterns: [] }
  });
  assert.match(briefing.opening, /-26 pts/);
  assert.doesNotMatch(briefing.opening, /-26%/);
  assert.match(briefing.opening, /não é percentual/i);
});

test('Score executivo preserva a dedução de prontidão no resumo e na composição', () => {
  const snapshot = buildExecutiveSnapshot({
    bottlenecks: {
      missingPlanning: ['Cliente A'],
      missingDashboard: ['Cliente A'],
      quantitative: { eligibleClients: 1, planningCoveragePct: 0, dashboardCoveragePct: 0 },
      activePortfolio: [{ name: 'Cliente A', since: '2025-01-01T00:00:00Z' }]
    },
    posts: { ranking: [], quantitative: { activeItems: 0, completedItems: 0 } },
    demands: Object.assign([], { clientsWithOpenDemand: [] }),
    generatedAt: '2026-08-18T00:00:00.000Z'
  });
  assert.equal(snapshot.summary.stalledClients, 1);
  assert.deepEqual(snapshot.portfolioStability.scoreDeductions.filter(item => item.points > 0).map(item => item.id), ['execution-gap', 'planning-source-gap', 'dashboard-source-gap']);
  assert.equal(snapshot.portfolioStability.recoveryPointsAvailable, 15);
});


test('Vybe Painel oferece resumo executivo cacheável com seleção enxuta', async () => {
  const originalFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (url, options) => {
    requests.push({ url, payload: JSON.parse(options.body) });
    if (requests.length === 1) {
      return new Response(JSON.stringify({
        data: { boards: [{ items_page: { cursor: 'summary-cursor-1', items: [{ id: 'summary-1', name: 'Resumo 1', group: { title: 'Grupo A' } }] } }] }
      }), { status: 200 });
    }
    return new Response(JSON.stringify({
      data: { next_items_page: { cursor: null, items: [{ id: 'summary-2', name: 'Resumo 2', group: { title: 'Grupo B' } }] } }
    }), { status: 200 });
  };

  try {
    const result = await getVybePanelExecutiveSnapshot({ limit: 200, maxPages: 10, budgetMs: 5000 });
    assert.deepEqual(result.items.map(item => item.id), ['summary-1', 'summary-2']);
    assert.equal(result.pagination.complete, true);
    assert.equal(result.warning, null);
    assert.equal(result.items[0].updates, undefined);
    assert.match(requests[0].payload.query, /column_values/);
    assert.doesNotMatch(requests[0].payload.query, /updates\(limit/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});


test('Headers de segurança são aplicados sem exigir autenticação pública', () => {
  const headers = {};
  let nextCalled = false;
  const req = { get: () => '', ip: '127.0.0.1' };
  const res = { set(name, value) {
    if (typeof name === 'object') Object.assign(headers, name);
    else headers[name] = value;
  } };
  const originalNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  try {
    securityHeaders(req, res, () => { nextCalled = true; });
  } finally {
    process.env.NODE_ENV = originalNodeEnv;
  }
  assert.equal(nextCalled, true);
  assert.equal(headers['X-Content-Type-Options'], 'nosniff');
  assert.equal(headers['X-Frame-Options'], 'DENY');
  assert.match(headers['Content-Security-Policy'], /frame-ancestors 'none'/);
  assert.equal(headers['Strict-Transport-Security'], 'max-age=31536000; includeSubDomains');
  assert.match(headers['X-Request-Id'], /^[0-9a-f-]{36}$/);
});

test('Rate limiter bloqueia excesso por janela sem bloquear a primeira leitura', () => {
  const limiter = createRateLimiter({ windowMs: 60_000, max: 1, name: `test-${Date.now()}-${Math.random()}` });
  const req = { get: () => '', ip: '198.51.100.10' };
  let nextCount = 0;
  let blockedStatus = null;
  const makeResponse = () => ({
    set() {},
    status(code) { blockedStatus = code; return { json() {} }; }
  });
  limiter(req, makeResponse(), () => { nextCount += 1; });
  limiter(req, makeResponse(), () => { nextCount += 1; });
  assert.equal(nextCount, 1);
  assert.equal(blockedStatus, 429);
});


test('Auditoria legada usa identidade determinística e exige validação humana', () => {
  const record = createVersionedAuditRecord({
    id: 'audit-legacy-cliente-a',
    clientId: 'cliente-a',
    source: 'clients.js-legacy-migration',
    status: 'legacy_unvalidated',
    confidence: 'unverified',
    analysis: { igStats: 'Dados legados', cmoDirective: 'Validar antes de decidir', issues: [] }
  });
  assert.equal(record.id, 'audit-legacy-cliente-a');
  assert.equal(record.status, 'legacy_unvalidated');
  assert.equal(record.confidence, 'unverified');
  assert.equal(record.history[0].status, 'legacy_unvalidated');
});
