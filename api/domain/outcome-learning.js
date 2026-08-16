export function buildOutcomeLearning({ decisions = [], impacts = [], persistentRisks = [] } = {}) {
  const counts = impacts.reduce((acc, impact) => { acc[impact.result] = (acc[impact.result] || 0) + 1; return acc; }, {});
  const evaluated = impacts.length;
  const positive = counts.improved || 0;
  const negative = counts.worsened || 0;
  const inconclusive = (counts.inconclusive || 0) + (counts.stable || 0);
  const confidence = evaluated >= 5 ? 'partial' : 'low';
  const learnings = [
    {
      id: 'positive-signals',
      title: 'Diretrizes com sinal positivo',
      summary: positive ? `${positive} impacto(s) melhoraram o indicador observado.` : 'Ainda não há impacto positivo registrado.',
      evidenceCount: positive,
      confidence,
      caveat: 'Associação observada; não representa causalidade comprovada.'
    },
    {
      id: 'negative-signals',
      title: 'Diretrizes que exigem reavaliação',
      summary: negative ? `${negative} impacto(s) pioraram o indicador observado.` : 'Nenhum impacto negativo registrado no histórico disponível.',
      evidenceCount: negative,
      confidence,
      caveat: 'Revisar contexto e qualidade da evidência antes de uma nova diretriz.'
    },
    {
      id: 'evidence-gaps',
      title: 'Lacunas de evidência',
      summary: `${decisions.filter(decision => !impacts.some(impact => impact.decisionId === decision.id)).length} decisão(ões) ainda sem avaliação de impacto.`,
      evidenceCount: inconclusive,
      confidence: 'low',
      caveat: 'Aumentar a base de checkpoints antes de recalibrar o modelo.'
    },
    {
      id: 'persistent-risk',
      title: 'Risco que reaparece',
      summary: persistentRisks.length ? `${persistentRisks.length} risco(s) persistente(s) exigem uma nova hipótese de ação.` : 'Nenhum risco persistente identificado.',
      evidenceCount: persistentRisks.length,
      confidence: persistentRisks.length ? 'partial' : 'low',
      caveat: 'Recorrência indica investigação; não prova causa sistêmica.'
    }
  ];
  return { evaluated, counts: { improved: positive, worsened: negative, stable: counts.stable || 0, inconclusive: counts.inconclusive || 0 }, confidence, learnings, note: 'Aprendizados são associações baseadas em registros do Nexus, não conclusões causais automáticas.' };
}
