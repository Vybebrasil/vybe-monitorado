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
import { buildExecutiveSnapshot } from '../server/domain/executive.js';
import { buildReleaseMetadata } from '../server/release.js';
import { createRecordStore, describeRecordStore } from '../server/persistence/record-store.js';

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
        statusCounts: { 'Finalizado': 5, 'Em andamento': 10, 'A Fazer': 5 }
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
  assert.equal(snapshot.executiveRisks[0].ownerRole, 'Liderança executiva');
  assert.equal(snapshot.methodology.source, 'Monday.com · Produção de Conteúdo');
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
