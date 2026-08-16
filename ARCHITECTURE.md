# Arquitetura do VYBE NEXUS

## Contrato entre produtos

O **Monday + automações** é a fonte operacional e o motor de passagem de bastão. O **Vybe Painel** é a camada de execução para a equipe. O **VYBE NEXUS** é a camada de comando e decisão para CMO, COO e lideranças. O **VybeHUB** é a camada de comunicação e relacionamento com clientes.

O Nexus não deve criar novos status de produção no Monday nem reproduzir a fila individual do Vybe Painel. Ele deve ler evidências, agrupá-las em sinais executivos e apresentar riscos, decisões, diretrizes e acompanhamento de impacto.

## Runtime oficial

O runtime oficial está em `api/index.js`, conforme o rewrite definido em `vercel.json`. A pasta `server/` existe apenas como fachada de compatibilidade para scripts legados e reexporta os módulos oficiais de `api/`. Não devem ser adicionadas regras de negócio novas em `server/`.

O contrato executivo principal é `metrics.executiveSnapshot`, produzido por `api/domain/executive.js`. Os campos operacionais antigos continuam temporariamente disponíveis como evidência contextual e serão reduzidos em uma etapa posterior.

O Registro de Decisões Executivas está em `api/domain/executive-records.js` e nas rotas `/api/executive/decisions`. Ele usa armazenamento local apenas em desenvolvimento, protegido por `.gitignore`; em produção retorna indisponibilidade controlada até que `NEXUS_DECISION_STORE_URL` seja conectado a um datastore versionado. Os estados são do Nexus (`decision_needed`, `directive_defined`, `impact_tracking`, `normalized` e `dismissed`) e não são status do Monday.

O contrato versionado da Auditoria IA está em `api/domain/audit-records.js`. Ele registra versão, schema, fonte, captura, confiança, evidência, diretiva e histórico de validação. A migração definitiva ainda depende do datastore de produção.

## Segurança de operações sensíveis

As rotas de auditoria, geração de prompt e salvamento exigem `NEXUS_ADMIN_TOKEN` quando configurado e, em produção, devem ser consideradas indisponíveis até que essa variável exista. O frontend público não deve expor esse token. A autenticação de usuário e autorização por perfil são a próxima evolução necessária para liberar essas ações com segurança.

`NEXUS_ALLOWED_ORIGINS` deve conter as origens autorizadas, separadas por vírgula, para chamadas cross-origin em produção. A leitura executiva continua separada das rotas administrativas de IA.

## Persistência pendente

A inteligência da Auditoria IA ainda está em `src/data/clients.js` e o endpoint de salvamento ainda utiliza reescrita de arquivo. Isso é um legado temporário, não o modelo definitivo. A próxima etapa deve mover auditorias e decisões para um datastore versionado com `clientId`, fonte, evidência, versão, autor, confiança, validação humana, data de captura e histórico de alterações.

Não usar arquivo local como banco em produção serverless e não criar status de produção no Monday para representar estados executivos do Nexus.
