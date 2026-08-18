# Arquitetura do VYBE NEXUS

## Contrato entre produtos

O **Monday + automações** é a fonte operacional e o motor de passagem de bastão. O **Vybe Painel** é a camada de execução para a equipe. O **VYBE NEXUS** é a camada de comando e decisão para a liderança executiva. O **VybeHUB** é a camada de comunicação e relacionamento com clientes.

O Nexus não deve criar novos status de produção no Monday nem reproduzir a fila individual do Vybe Painel. Ele deve ler evidências, agrupá-las em sinais executivos e apresentar riscos, decisões, diretrizes e acompanhamento de impacto.

## Runtime oficial

O runtime público está em `api/index.js`, conforme o rewrite definido em `vercel.json`. A pasta `server/` concentra regras de domínio, integrações, persistência e metadados internos. Apenas `api/index.js` deve permanecer dentro de `api/`, para que a Vercel descubra um único handler serverless.

O contrato executivo principal é `metrics.executiveSnapshot`, produzido por `server/domain/executive.js`. A rota pública agrega os dados operacionais do Monday internamente e entrega ao frontend apenas sinais executivos, riscos, decisões e estabilidade da carteira; não expõe a fila individual de produção.

Há uma única definição de atraso em toda a leitura do Monday: `isBeforeToday`, comparando a data como dia puro em UTC. Item com prazo hoje **não** está atrasado. Essa régua vale igualmente para o KPI agregado (`quantitative.overdueInternal`), para o ranking por cliente (`clientRanking[].internalDelays`) e para as demandas. Contagens paralelas com meia-noite local são proibidas: elas divergem por fuso e já produziram números incompatíveis na mesma tela.

`portfolioReadiness` expõe tanto os totais (`missingPlanning`, `missingDashboard`) quanto os nomes (`clientsWithoutPlanning`, `clientsWithoutDashboard`), para que a interface possa listar os clientes sem repetir a regra de elegibilidade. O campo `ownerRole` de riscos e decisões é sempre `Liderança executiva`, conforme o modelo de acesso descrito abaixo.

O `client-health-v2` está implementado em `server/domain/health-score.js` e exposto em `GET /api/executive/health/:clientId`, mas nenhuma tela o consome hoje: a estação Jarvis ordena a carteira por percentual de atraso (`riskPct`), que é risco de entrega e não health score. O score é explicável por relacionamento, previsibilidade operacional, prontidão estratégica, cobertura de dados e evidência de auditoria. Também expõe confiança, tendência e janela de referência; não representa receita, margem ou satisfação sem essas fontes integradas. Snapshots por cliente devem ser persistidos em `client_health_snapshots` quando o datastore de produção estiver disponível.

O Registro de Decisões Executivas está em `server/domain/executive-records.js` e nas rotas `/api/executive/decisions`. Ele usa armazenamento local apenas em desenvolvimento, protegido por `.gitignore`; em produção retorna indisponibilidade controlada até que `NEXUS_DECISION_STORE_URL` seja conectado a um datastore versionado. O Registro de Impacto segue o mesmo padrão em `server/domain/impact-records.js` e `/api/executive/impacts`, com resultados `improved`, `stable`, `worsened` e `inconclusive`. Os estados são do Nexus (`decision_needed`, `directive_defined`, `impact_tracking`, `normalized` e `dismissed`) e não são status do Monday.

O contrato versionado da Auditoria IA está em `server/domain/audit-records.js`. Ele registra versão, schema, fonte, captura, confiança, evidência, diretiva e histórico de validação. O comando `npm run migrate:audits` transforma `src/data/clients.js` em registros `legacy_unvalidated`, preservando a base original e impedindo que legado seja tratado como validado. A migração definitiva ainda depende do datastore de produção.

## Modelo de acesso

O Nexus adota transparência por link: não há login, perfis ou autorização de leitura por cargo. O painel executivo é único para a liderança; não há separação artificial entre CMO e COO nem permissões diferentes por cargo. Quem possui o link pode visualizar o cockpit, decisões, auditorias e histórico disponíveis.

As escritas administrativas e automações sensíveis continuam separadas da leitura pública e podem exigir `NEXUS_ADMIN_TOKEN`, que nunca deve ser exposto no frontend. Esse token é técnico, não é uma conta de usuário. `NEXUS_ALLOWED_ORIGINS` deve conter as origens autorizadas, separadas por vírgula, para chamadas cross-origin em produção.

## Experiência JARVIS e ANALISTA

A entrada pública oferece dois modos para a mesma liderança, não dois perfis ou cargos. O **JARVIS** é o guia executivo: cumprimenta conforme o horário, resume o estado da carteira, propõe uma prioridade e conduz a leitura por estado, mudança, evidência e decisão. O **ANALISTA** é a sala de investigação: permite explorar fluxo, causas, clientes, responsáveis, itens afetados e links do Monday com maior profundidade.

Os dois modos são somente leitura operacional. Nenhum deles cria demanda, altera status, registra execução ou substitui o Vybe Painel. A estação Analista exibe evidência contextual e não uma fila completa de produção. Linguagem de churn, culpa individual ou produtividade pessoal só pode ser usada quando houver dados que sustentem essas conclusões; o contrato padrão usa risco de previsibilidade e concentração de atrasos.

## Histórico executivo

O domínio `server/domain/executive-snapshots.js` registra snapshots do Cockpit e calcula tendência, delta e janelas de 7, 30 e 90 dias. O domínio `server/domain/health-snapshots.js` faz o mesmo por cliente para o Health Score, com deduplicação por minuto e tendência individual.
 `GET /api/executive/snapshots` é uma rota de leitura pública por link. `POST /api/executive/snapshots` é uma escrita técnica e exige a barreira administrativa. `NEXUS_SNAPSHOT_AUTOSAVE=true` pode ativar o registro automático de snapshots quando o armazenamento estiver configurado.

Em desenvolvimento, decisões e snapshots podem usar `.data`, protegido por `.gitignore`. Em produção, o filesystem local não é banco: `NEXUS_DECISION_STORE_URL` e `NEXUS_SNAPSHOT_STORE_URL` devem apontar para datastore externo versionado antes de ativar persistência real.

## Persistência e auditoria

A inteligência da Auditoria IA ainda está em `src/data/clients.js` e o endpoint de salvamento legado permanece bloqueado em produção até a migração. O próximo passo é mover auditorias e decisões para registros versionados com `clientId`, fonte, evidência, versão, responsável nominal quando informado, confiança, validação humana, data de captura e histórico de alterações.

O Registro de Impacto em `server/domain/impact-records.js` acompanha baseline, indicador, resultado (`improved`, `stable`, `worsened`, `inconclusive`), evidências, checkpoint e histórico. O domínio `server/domain/decision-analytics.js` calcula eficácia das decisões, risco de checkpoint, impacto negativo, risco persistente do Health Score, padrões agregados e prioridades de briefing. `GET /api/executive/analytics` é uma leitura pública por link e não representa previsão financeira ou fila de produção. A rota `/api/healthz` expõe apenas prontidão, commit, integrações configuradas e estado de persistência, sem valores de credenciais. Não criar status de produção no Monday para representar estados executivos do Nexus. O Monday continua sendo fonte operacional; o Nexus interpreta, registra decisões e acompanha impacto.

## Integração operacional completa

O Monday continua sendo a fonte operacional canônica. A integração `server/integrations/monday.js` percorre por cursor todos os itens dos boards de Produção de Conteúdo, Gestão de Clientes, Solicitações de Demandas e Reuniões; cada retorno inclui metadados de páginas, quantidade e completude. Itens concluídos deixam de participar dos KPIs ativos, mas não são descartados da leitura histórica.

O Vybe Painel possui um proxy GraphQL read-only em `/api/monday`. O Nexus o acessa por `server/integrations/vybe-panel.js` e expõe `GET /api/executive/vybe-panel`, preservando organização por grupo, itens, atualizações e valores de colunas com paginação. Essa ponte não cria itens, não altera status e não usa scraping do DOM. Ela existe para que o ANALISTA possa investigar a mesma operação organizada no Painel sem transformar o JARVIS em uma fila de produção.

A ponte é opcional e configurável por `VYBE_PANEL_API_URL`, `VYBE_PANEL_API_VERSION` e `VYBE_PANEL_API_TOKEN`. A URL padrão aponta para o proxy público atual, mas um endpoint oficial estável deve ser preferido caso o Painel disponibilize um contrato próprio. Falhas do Painel não devem invalidar os KPIs que já foram obtidos diretamente do Monday.
