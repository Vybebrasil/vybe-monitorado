# Implementação — História, Logs e Captura Histórica do VYBE NEXUS

## Resumo executivo

A sprint transforma o Nexus de um painel apenas de fotografia atual em uma base preparada para memória operacional. O sistema agora distingue logs técnicos de eventos executivos, guarda estados compactos dos itens para detectar mudanças entre snapshots, expõe uma estação História & Logs e possui uma rota de captura histórica independente que pode ser acionada por cron.

## Alterações implementadas

| Frente | Implementação |
|---|---|
| Contrato de eventos | `server/domain/executive-events.js` define eventos de entrada/saída de escopo, status, prazo, atraso iniciado/resolvido, responsável, etapa e captura de snapshot. |
| Deduplicação | IDs determinísticos por tipo, fonte, item, janela e valores anterior/atual evitam o mesmo evento repetido. |
| Estados compactos | Snapshots persistidos carregam apenas estado mínimo dos itens, sem guardar o payload completo de produção e demandas em cada ponto. |
| Persistência | Novo store `events` usa o mesmo adaptador Upstash/Redis e a nova operação `setMany` reduz chamadas remotas. |
| Captura independente | `/api/cron/executive-snapshot` aciona uma leitura live e reaproveita a mesma pipeline do dashboard, sem consultar o Monday por uma segunda lógica. |
| Agendamento | `vercel.json` agenda a captura diária às 08:00. A rota exige `CRON_SECRET` em produção. |
| API | `/api/executive/events` lista eventos por tipo, fonte e cliente; a resposta live inclui eventos, descriptor do store e motivo de persistência. |
| História & Logs | Nova navegação e estação visual com linha temporal quando há pontos reais, comparativos, filtros, eventos, links Monday e ciclo observado → investigado → decidido → medido → aprendido. |
| Cockpit | Resumo e Analytics possuem atalhos para História; Resumo exibe memória executiva compacta; Time abre a história do fluxo. |
| Ambiente | `.env.example` documenta `NEXUS_EVENT_STORE_URL`, `NEXUS_EVENT_STORE_TOKEN`, `NEXUS_EVENT_AUTOSAVE` e `CRON_SECRET`. |

## Limite honesto atual

O código está pronto para acumular história, mas os stores de produção ainda precisam ser configurados. Sem `NEXUS_SNAPSHOT_STORE_URL`/`TOKEN` ou o par Upstash compartilhado, além de `NEXUS_EVENT_AUTOSAVE=true` e `CRON_SECRET`, a Vercel continuará apresentando N/D e a rota de cron responderá autorização ausente. Isso é intencional: nenhuma linha histórica ou causal é fabricada.

A captura diária é suficiente para construir comparativos de 7D, 30D e 90D, mas não representa quase tempo real. O espelho operacional continua sendo a fonte de frescor em até aproximadamente 30 segundos; a timeline histórica registra mudanças na cadência configurada. Para registrar cada mudança sem depender apenas do horário, o cron pode ser aumentado posteriormente dentro dos limites do plano de deployment.

## Validação

Foram aprovados 41 testes unitários, build Vite, diff check e todos os gates existentes executados anteriormente. O teste novo confirma que mudanças de status, prazo, responsável e etapa são transformadas em eventos executivos. A implementação não altera o Monday e não faz deploy automático.

## Referências

[1]: https://vybe-nexus.vercel.app — domínio de produção do VYBE NEXUS.

[2]: https://github.com/Vybebrasil/vybe-monitorado — repositório do projeto.

[3]: https://vercel.com/docs/cron-jobs — referência da configuração de jobs agendados na Vercel.
