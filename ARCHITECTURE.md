# Arquitetura do VYBE NEXUS

## Contrato entre produtos

O **Monday + automações** é a fonte operacional e o motor de passagem de bastão. O **Vybe Painel** é a camada de execução para a equipe. O **VYBE NEXUS** é a camada de comando e decisão para CMO, COO e lideranças. O **VybeHUB** é a camada de comunicação e relacionamento com clientes.

O Nexus não deve criar novos status de produção no Monday nem reproduzir a fila individual do Vybe Painel. Ele deve ler evidências, agrupá-las em sinais executivos e apresentar riscos, decisões, diretrizes e acompanhamento de impacto.

## Runtime oficial

O runtime oficial está em `api/index.js`, conforme o rewrite definido em `vercel.json`. A pasta `server/` existe apenas como fachada de compatibilidade para scripts legados e reexporta os módulos oficiais de `api/`. Não devem ser adicionadas regras de negócio novas em `server/`.

O contrato executivo principal é `metrics.executiveSnapshot`, produzido por `api/domain/executive.js`. Os campos operacionais antigos continuam temporariamente disponíveis como evidência contextual e serão reduzidos em uma etapa posterior.

O Dossiê calcula `client-health-v2` em `api/domain/health-score.js`. O score é explicável por relacionamento, previsibilidade operacional, prontidão estratégica, cobertura de dados e evidência de auditoria. Também expõe confiança, tendência e janela de referência; não representa receita, margem ou satisfação sem essas fontes integradas. Snapshots por cliente devem ser persistidos em `client_health_snapshots` quando o datastore de produção estiver disponível.

O Registro de Decisões Executivas está em `api/domain/executive-records.js` e nas rotas `/api/executive/decisions`. Ele usa armazenamento local apenas em desenvolvimento, protegido por `.gitignore`; em produção retorna indisponibilidade controlada até que `NEXUS_DECISION_STORE_URL` seja conectado a um datastore versionado. O Registro de Impacto segue o mesmo padrão em `api/domain/impact-records.js` e `/api/executive/impacts`, com resultados `improved`, `stable`, `worsened` e `inconclusive`. Os estados são do Nexus (`decision_needed`, `directive_defined`, `impact_tracking`, `normalized` e `dismissed`) e não são status do Monday.

O contrato versionado da Auditoria IA está em `api/domain/audit-records.js`. Ele registra versão, schema, fonte, captura, confiança, evidência, diretiva e histórico de validação. O comando `npm run migrate:audits` transforma `src/data/clients.js` em registros `legacy_unvalidated`, preservando a base original e impedindo que legado seja tratado como validado. A migração definitiva ainda depende do datastore de produção.

## Modelo de acesso

O Nexus adota transparência por link: não há login, perfis ou autorização de leitura por cargo. As lentes CMO e COO são interpretações executivas diferentes para o mesmo conjunto de dados, não permissões de acesso. Quem possui o link pode visualizar o cockpit, decisões, auditorias e histórico disponíveis.

As escritas administrativas e automações sensíveis continuam separadas da leitura pública e podem exigir `NEXUS_ADMIN_TOKEN`, que nunca deve ser exposto no frontend. Esse token é técnico, não é uma conta de usuário. `NEXUS_ALLOWED_ORIGINS` deve conter as origens autorizadas, separadas por vírgula, para chamadas cross-origin em produção.

## Histórico executivo

O domínio `api/domain/executive-snapshots.js` registra snapshots do Cockpit e calcula tendência, delta e janelas de 7, 30 e 90 dias. O domínio `api/domain/health-snapshots.js` faz o mesmo por cliente para o Health Score, com deduplicação por minuto e tendência individual.
 `GET /api/executive/snapshots` é uma rota de leitura pública por link. `POST /api/executive/snapshots` é uma escrita técnica e exige a barreira administrativa. `NEXUS_SNAPSHOT_AUTOSAVE=true` pode ativar o registro automático de snapshots quando o armazenamento estiver configurado.

Em desenvolvimento, decisões e snapshots podem usar `.data`, protegido por `.gitignore`. Em produção, o filesystem local não é banco: `NEXUS_DECISION_STORE_URL` e `NEXUS_SNAPSHOT_STORE_URL` devem apontar para datastore externo versionado antes de ativar persistência real.

## Persistência e auditoria

A inteligência da Auditoria IA ainda está em `src/data/clients.js` e o endpoint de salvamento legado permanece bloqueado em produção até a migração. O próximo passo é mover auditorias e decisões para registros versionados com `clientId`, fonte, evidência, versão, responsável nominal quando informado, confiança, validação humana, data de captura e histórico de alterações.

O Registro de Impacto em `api/domain/impact-records.js` acompanha baseline, indicador, resultado (`improved`, `stable`, `worsened`, `inconclusive`), evidências, checkpoint e histórico. O domínio `api/domain/decision-analytics.js` calcula eficácia das decisões, risco de checkpoint, impacto negativo, risco persistente do Health Score, padrões agregados e prioridades de briefing. `GET /api/executive/analytics` é uma leitura pública por link e não representa previsão financeira ou fila de produção. A rota `/api/healthz` expõe apenas prontidão, commit, integrações configuradas e estado de persistência, sem valores de credenciais. Não criar status de produção no Monday para representar estados executivos do Nexus. O Monday continua sendo fonte operacional; o Nexus interpreta, registra decisões e acompanha impacto.
