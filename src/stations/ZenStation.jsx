import React, { useState } from 'react';
import { formatNumber, splitOwners } from '../components/executive-helpers.js';

export default function ZenStation({ snapshot, history, onExit }) {
  const [copyStatus, setCopyStatus] = useState('');

  // 1. Process Data
  const delayDetails = snapshot.delayDetails || [];
  const internalDelays = delayDetails.filter(d => d.delayType?.includes('prazo interno'));
  
  // Find top offender
  const blameMap = {};
  internalDelays.forEach(d => {
    splitOwners(d.responsavel).forEach(name => {
      blameMap[name] ||= { count: 0, details: [] };
      blameMap[name].count += 1;
      blameMap[name].details.push(d);
    });
  });

  const topOffenders = Object.entries(blameMap)
    .map(([name, values]) => ({ name, ...values }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);

  // 2. Generate WhatsApp Text
  const handleCopyWhatsApp = (offender) => {
    if (!offender) return;
    const lines = [`Oi ${offender.name}, tudo bem? 👋`, `Vi aqui pelo sistema que temos ${offender.count} item(ns) na sua fila aguardando avanço:\n`];
    
    // Pegar até os 5 piores
    const worst = offender.details.sort((a, b) => (b.daysInStatus || 0) - (a.daysInStatus || 0)).slice(0, 5);
    worst.forEach(item => {
      lines.push(`📌 *${item.name}* (${item.client})`);
      if (item.daysInStatus) lines.push(`   ⏳ Na etapa "${item.status || item.stage}" há ${item.daysInStatus} dias`);
      lines.push('');
    });
    
    if (offender.count > 5) lines.push(`*(e mais ${offender.count - 5} outros itens...)*\n`);
    lines.push(`Consegue me dar um panorama de quando conseguimos destravar isso? Abs!`);
    
    navigator.clipboard.writeText(lines.join('\n')).then(() => {
      setCopyStatus(offender.name);
      setTimeout(() => setCopyStatus(null), 3000);
    });
  };

  // 3. Narrative logic
  const isDegrading = history?.available && history.score?.delta <= -2;
  const isImproving = history?.available && history.score?.delta >= 2;

  let heroGreeting = "A operação está estável hoje.";
  let heroMuted = "Não detectamos variações bruscas no score.";
  
  if (isDegrading) {
    heroGreeting = "A pressão aumentou.";
    heroMuted = `O score da carteira caiu ${Math.abs(history.score.delta)} pontos.`;
  } else if (isImproving) {
    heroGreeting = "A operação está respirando.";
    heroMuted = `O score subiu ${history.score.delta} pontos desde ontem.`;
  }

  const score = snapshot.portfolioStability?.score || 0;
  const totalItems = snapshot.quantitative?.totalItems || 0;
  const stalledClients = snapshot.portfolioExecution?.stalled?.length || 0;

  return (
    <div className="zen-container animate-fade">
      <nav className="zen-nav">
        <div><strong style={{ opacity: 0.5 }}>Vybe Nexus</strong> <span style={{ opacity: 0.3 }}>/ Zen Mode</span></div>
        <button className="zen-nav-btn" onClick={onExit}>Voltar ao Painel Avançado (Jarvis)</button>
      </nav>

      <main className="zen-main">
        <h1 className="zen-hero">
          {heroGreeting} <br />
          <span className="zen-hero-muted">{heroMuted}</span>
        </h1>
        
        <p className="zen-subtitle">
          Em vez de olhar para todos os gráficos, o sistema isolou os maiores ofensores de fluxo agora. Destravar essas filas é a ação de maior impacto para o dia.
        </p>

        {topOffenders.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {topOffenders.map((offender, i) => (
              <div className="zen-card" key={offender.name}>
                <div className="zen-card-title">{i + 1}º Gargalo: {offender.name}</div>
                <div className="zen-card-meta">
                  <span>{offender.count} demandas internas atrasadas sob responsabilidade de {offender.name}.</span>
                  <span>Ação: iniciar o desbloqueio destas entregas via comunicação direta.</span>
                </div>
                <button className="zen-action-btn" onClick={() => handleCopyWhatsApp(offender)} style={{ marginTop: '1.5rem' }}>
                  {copyStatus === offender.name ? 'Copiado para colar no WhatsApp!' : `Cobrar ${offender.name}`}
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="zen-card">
            <div className="zen-card-title">Fluxo Limpo</div>
            <div className="zen-card-meta">
              <span>Não há atrasos internos gritantes mapeados neste momento.</span>
            </div>
          </div>
        )}

        <div className="zen-secondary-metrics">
          <div className="zen-metric">
            <span className="zen-metric-label">Health Score</span>
            <span className="zen-metric-value">{score}%</span>
          </div>
          <div className="zen-metric">
            <span className="zen-metric-label">Volume Ativo</span>
            <span className="zen-metric-value">{formatNumber(totalItems)} entregas</span>
          </div>
          <div className="zen-metric">
            <span className="zen-metric-label">Clientes sem Produção</span>
            <span className="zen-metric-value">{stalledClients} clientes</span>
          </div>
        </div>
      </main>
    </div>
  );
}
