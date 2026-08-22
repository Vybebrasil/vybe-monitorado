import { Activity, Briefcase, Clock3, LayoutDashboard, ListChecks, RefreshCw, Search, Users, Wifi } from 'lucide-react';
import { formatNumber } from './executive-helpers.js';

const NAV_ITEMS = [
  { id: 'summary', label: 'Resumo executivo', short: 'Resumo', icon: LayoutDashboard, detail: 'decisão e risco' },
  { id: 'portfolio', label: 'Carteira', short: 'Carteira', icon: Briefcase, detail: 'capacidade e previsibilidade' },
  { id: 'demands', label: 'Demandas', short: 'Demandas', icon: ListChecks, detail: 'solicitações à agência' },
  { id: 'team', label: 'Time & performance', short: 'Time', icon: Users, detail: 'capacidade observável' },
  { id: 'analytics', label: 'Analytics Center', short: 'Analytics', icon: Activity, detail: 'volume, risco e fluxo' },
  { id: 'history', label: 'História & Logs', short: 'História', icon: Clock3, detail: 'evolução e causas' }
];

export function ExecutiveDashboardShell({
  activeView,
  onChange,
  snapshot,
  onExit,
  onOpenAnalyst,
  onRefresh,
  refreshing,
  refreshError,
  children,
}) {
  const activeItem = NAV_ITEMS.find(item => item.id === activeView) || NAV_ITEMS[0];
  const sourceQuality = snapshot?.sourceQuality || {};
  const version = sourceQuality.mirrorVersion ?? sourceQuality.sync?.version ?? null;
  const declaredFreshness = sourceQuality.freshness || sourceQuality.status;
  const freshness = ['live', 'fresh', 'stale', 'fallback'].includes(declaredFreshness)
    ? declaredFreshness
    : sourceQuality.sync?.fallback
      ? 'fallback'
      : sourceQuality.complete === false
        ? 'stale'
        : 'live';
  const consistencyMode = sourceQuality.consistency?.mode || 'mixed';
  const sourceCount = sourceQuality.records?.length || 0;
  const activeItems = snapshot?.quantitative?.activeItems ?? snapshot?.quantitative?.totalItems ?? 0;
  const demandRows = Array.isArray(snapshot?.demandItemRows) ? snapshot.demandItemRows : Array.isArray(snapshot?.demandItems) ? snapshot.demandItems : [];
  const demandAvailable = demandRows.length > 0 || snapshot?.demandItemRowsComplete === true || sourceQuality.consistency?.boards?.demands?.complete === true;
  const demandCount = demandAvailable ? demandRows.length : 'N/D';
  const syncTone = freshness === 'fresh' || freshness === 'live' ? 'is-live' : freshness === 'stale' || freshness === 'fallback' ? 'is-warning' : 'is-unknown';
  const syncError = refreshError || sourceQuality.sync?.error || null;
  const hasSyncWarning = Boolean(syncError) || freshness === 'stale' || freshness === 'fallback';

  return (
    <div className="nexus-dashboard-shell">
      <aside className="nexus-sidebar" aria-label="Navegação executiva">
        <div className="nexus-brand-lockup">
          <span className="nexus-brand-mark"><Activity size={16} /></span>
          <span><strong>VYBE</strong><small>NEXUS</small></span>
        </div>
        <div className="nexus-sidebar-caption">Command center</div>
        <nav className="nexus-sidebar-nav">
          {NAV_ITEMS.map(item => {
            const Icon = item.icon;
            const count = item.id === 'portfolio' ? activeItems : item.id === 'demands' ? demandCount : null;
            return (
              <button
                key={item.id}
                type="button"
                className={`nexus-sidebar-link ${activeView === item.id ? 'active' : ''}`}
                aria-current={activeView === item.id ? 'page' : undefined}
                onClick={() => onChange(item.id)}
              >
                <Icon size={16} aria-hidden="true" />
                <span><strong>{item.short}</strong><small>{item.detail}</small></span>
                {count !== null ? <b>{count === 'N/D' ? count : formatNumber(count)}</b> : null}
              </button>
            );
          })}
        </nav>
        <div className="nexus-sidebar-spacer" />
        <div className={`nexus-sync-card ${syncTone}`}>
          <div className="nexus-sync-card-top"><span className="nexus-sync-dot" /><span>{freshness === 'fresh' || freshness === 'live' ? 'Sistema online' : 'Verificar leitura'}</span></div>
          <strong>{version === null ? 'N/D' : `v${version}`}</strong>
          <small>{version === null ? (consistencyMode === 'mixed' ? 'fontes mistas' : 'sem versão') : `${consistencyMode === 'mixed' ? 'espelho + fontes diretas' : 'espelho operacional'}`}</small>
        </div>
        <button type="button" className="nexus-sidebar-analyst" onClick={onOpenAnalyst}><Search size={15} /> Abrir analista <span>↗</span></button>
        <button type="button" className="nexus-sidebar-exit" onClick={onExit}>Sair do JARVIS</button>
      </aside>

      <main className="nexus-dashboard-main">
        <header className="nexus-topbar">
          <div className="nexus-breadcrumb"><span>VYBE NEXUS</span><i>/</i><strong>{activeItem.label}</strong></div>
          <div className="nexus-topbar-actions">
            <span className="nexus-topbar-live"><Wifi size={13} /> {freshness === 'fresh' || freshness === 'live' ? 'Dados ao vivo' : freshness === 'stale' ? 'Leitura desatualizada' : freshness === 'fallback' ? 'Leitura de contingência' : 'Leitura pendente'}</span>
            <button type="button" className="nexus-topbar-analyst" onClick={onOpenAnalyst}><Search size={13} /> Analista</button>
            <button type="button" className="nexus-topbar-refresh" onClick={onRefresh} disabled={refreshing} aria-label="Atualizar dados executivos"><RefreshCw size={14} className={refreshing ? 'is-spinning' : ''} /> {refreshing ? 'Lendo' : 'Atualizar'}</button>
          </div>
        </header>
        <div className="nexus-dashboard-content">
          {hasSyncWarning ? <div className="nexus-source-alert" role="status"><span className="nexus-source-alert-dot" /><strong>Leitura parcial</strong><span>{syncError || 'A fonte operacional precisa ser verificada antes de concluir a leitura.'}</span><button type="button" onClick={onRefresh} disabled={refreshing}>{refreshing ? 'Atualizando…' : 'Verificar agora'}</button></div> : null}
          <div className="nexus-mobile-context-nav" aria-label="Contextos executivos no mobile">
            {NAV_ITEMS.map(item => <button type="button" key={item.id} className={activeView === item.id ? 'active' : ''} onClick={() => onChange(item.id)}>{item.short}</button>)}
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}

export default ExecutiveDashboardShell;
