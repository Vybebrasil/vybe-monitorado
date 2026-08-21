import React from 'react';
export default function ExecutiveProjectionPanel({ projections }) {
  const scenarios = Array.isArray(projections?.scenarios) ? projections.scenarios : [];
  const rates = projections?.trendPerDay || {};
  const historical = projections?.available === true;
  return (
    <section className="executive-projection-panel" aria-label="Projeções executivas">
      <header>
        <div><span>PROJEÇÃO EXECUTIVA</span><strong>{historical ? 'TENDÊNCIA OBSERVADA' : 'CENÁRIO CONTRAFACTUAL'}</strong></div>
        <small>{projections?.note || 'Histórico insuficiente para projeção.'}</small>
      </header>
      <div className="executive-projection-summary">
        <div><span>ATRASOS / DIA</span><strong>{rates.delayedProduction === null || rates.delayedProduction === undefined ? 'N/D' : `${rates.delayedProduction > 0 ? '+' : ''}${rates.delayedProduction.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}`}</strong></div>
        <div><span>DEMANDAS / DIA</span><strong>{rates.overdueDemands === null || rates.overdueDemands === undefined ? 'N/D' : `${rates.overdueDemands > 0 ? '+' : ''}${rates.overdueDemands.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}`}</strong></div>
        <div><span>CONFIANÇA</span><strong>{projections?.confidence === 'partial' ? 'PARCIAL' : 'BAIXA'}</strong></div>
      </div>
      <div className="executive-projection-scenarios">
        {scenarios.map(scenario => <article key={scenario.horizonDays}>
          <span>{scenario.horizonDays}D</span>
          <strong>{scenario.requiredDailyDelayResolution === null ? 'N/D' : `${scenario.requiredDailyDelayResolution.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} atrasos/dia`}</strong>
          <small>{scenario.requiredDailyDemandResolution === null ? 'Demandas: N/D' : `${scenario.requiredDailyDemandResolution.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} demandas/dia`}</small>
        </article>)}
      </div>
      <footer>O cenário mostra esforço matemático para reduzir o estoque atual. Entradas novas, bloqueios e mudanças de prioridade alteram o resultado.</footer>
    </section>
  );
}
