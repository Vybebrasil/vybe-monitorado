export function buildExecutiveBriefingDocument({ analytics, generatedAt = new Date().toISOString() } = {}) {
  const briefing = analytics?.briefing || {};
  const risks = analytics?.persistentRisks || [];
  const patterns = analytics?.patterns?.patterns || [];
  const effectiveness = analytics?.effectiveness || {};
  const priorities = briefing.priorities || [];
  const markdown = [
    `# ${briefing.title || 'Briefing Executivo do Nexus'}`,
    `\nGerado em: ${generatedAt}`,
    `\n## Leitura de abertura\n${briefing.opening || 'Dados executivos insuficientes para uma abertura confiável.'}`,
    '\n## Prioridades da reunião',
    ...priorities.map((priority, index) => `${index + 1}. ${priority}`),
    '\n## Decisões e impactos',
    `- Decisões avaliadas: ${effectiveness.evaluatedDecisions ?? 0}`,
    `- Decisões aguardando impacto: ${effectiveness.pendingEvaluation ?? 0}`,
    `- Taxa de sinal positivo: ${effectiveness.positiveRate === null || effectiveness.positiveRate === undefined ? 'não disponível' : `${effectiveness.positiveRate}%`}`,
    '\n## Riscos persistentes',
    ...(risks.length ? risks.slice(0, 10).map(risk => `- **${risk.title}** — ${risk.reason} Próxima ação: ${risk.recommendedAction}`) : ['- Nenhum risco persistente identificado no histórico disponível.']),
    '\n## Padrões da carteira',
    ...(patterns.length ? patterns.map(pattern => `- ${pattern.label}: ${pattern.count}`) : ['- Ainda não há volume histórico suficiente para identificar padrões.']),
    `\n## Checkpoint\n${briefing.nextCheckpoint || 'Definir no Registro de Decisões do Nexus.'}`
  ].join('\n');
  return {
    title: briefing.title || 'Briefing Executivo do Nexus',
    generatedAt,
    opening: briefing.opening || '',
    priorities,
    risks: risks.slice(0, 10),
    patterns,
    effectiveness,
    nextCheckpoint: briefing.nextCheckpoint || 'Definir no Registro de Decisões do Nexus.',
    markdown
  };
}
