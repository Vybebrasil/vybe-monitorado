# VYBE NEXUS

O **VYBE NEXUS** é a camada de comando e decisão da Vybe. Ele transforma dados do Monday.com, Google Calendar e Auditoria IA em sinais executivos para a liderança responsável pela agência. O Nexus não substitui o Monday nem o Vybe Painel: a produção permanece nas ferramentas operacionais e aparece no Nexus apenas como evidência contextual.

> **Contrato de produto:** Monday registra a operação; Vybe Painel organiza a execução; Nexus interpreta riscos, decisões e impactos; VybeHUB concentra o relacionamento com o cliente.

## Estado atual

O Cockpit executivo funciona com leitura pública por link e é a única superfície principal do Nexus; não há painéis separados para CMO e COO. As telas operacionais de Auditoria/Dossiê foram retiradas da navegação pública para evitar duplicação com o Vybe Painel. Decisões, impactos, snapshots e Health Score usam arquivos JSON em desenvolvimento e um adaptador HTTP para Upstash Redis REST em produção, desde que as credenciais estejam configuradas. Sem o datastore de produção, as rotas persistentes retornam indisponibilidade controlada e o `/api/healthz` informa `ready: false`.

## Métricas do cockpit executivo

O cockpit lê o board `🟢Produção de Conteúdo` do Monday e transforma a operação em sinais agregados, sem reproduzir a fila do Vybe Painel. Os cartões quantitativos mostram o denominador e o recorte usados no cálculo.

| Métrica | Definição | Fonte |
|---|---|---|
| Itens ativos | Itens com status não concluído no recorte lido | Status do Monday |
| Atrasos internos | Itens ativos com o campo `Prazo` anterior ao dia atual | `data` + status |
| Veiculação com data | Percentual de itens com `Veiculação` preenchida | `data__1` |
| Prazo interno preenchido | Percentual de itens com `Prazo` preenchido | `data` |
| Planejamento da carteira | Percentual de clientes elegíveis com planejamento identificado | Board Gestão de Clientes |
| Dashboard atualizado | Percentual de clientes elegíveis sem dashboard vazio, pendente ou desatualizado | Board Gestão de Clientes |
| Exposição por cliente | Atrasos, itens abertos e percentual de risco por cliente | Cliente + status + datas |

Os percentuais de atraso usam itens ativos como denominador. Os percentuais de cobertura medem preenchimento e qualidade do dado; não são indicadores financeiros, de margem, satisfação ou performance de campanha. O Nexus também mostra a composição por status e a prioridade classificada para revelar quando o próprio dado operacional está incompleto.

Enquanto o datastore não estiver configurado, os módulos de memória, histórico, cenários e aprendizado não são exibidos no cockpit público. Eles só devem voltar quando houver registros persistentes reais, para não apresentar áreas vazias como se fossem inteligência executiva disponível.

| Camada | Tecnologia |
|---|---|
| Frontend | React 18, Vite e Lucide, com núcleo executivo único |
| API | Express 5 em ESM |
| Integrações | Monday.com, Google Calendar, Instagram e Gemini |
| Deploy | Vercel |
| Persistência local | Arquivos JSON em `.data` |

## Requisitos

Use Node.js 22 ou uma versão LTS compatível e npm. Também é necessário ter acesso ao repositório privado e às variáveis das integrações usadas no ambiente desejado.

```bash
node --version
npm --version
```

## Instalação local

```bash
git clone https://github.com/Vybebrasil/vybe-monitorado.git
cd vybe-monitorado
npm install
cp .env.example .env
```

Preencha apenas as variáveis necessárias no `.env`. Nunca envie esse arquivo ao Git.

Para iniciar a API:

```bash
npm run server
```

Em outro terminal, inicie o frontend:

```bash
npm run dev
```

O Vite abre o frontend local e encaminha as chamadas `/api` para a API configurada no projeto.

## Variáveis de ambiente

| Variável | Finalidade | Obrigatória em produção |
|---|---|---|
| `MONDAY_API_TOKEN` | Leitura dos boards operacionais | Sim |
| `GEMINI_API_KEY` | Auditoria IA | Apenas para auditoria |
| `GOOGLE_CALENDAR_ICAL_URL` | Reuniões e relacionamento | Recomendado |
| `INSTAGRAM_COOKIES_JSON` | Cookies do scraper como JSON protegido | Apenas para scraping |
| `INSTAGRAM_COOKIES_PATH` | Arquivo local de cookies ignorado pelo Git | Desenvolvimento |
| `NEXUS_ADMIN_TOKEN` | Escritas técnicas e administrativas | Sim, se escritas forem habilitadas |
| `NEXUS_ALLOWED_ORIGINS` | Origens permitidas pelo CORS | Sim |
| `NEXUS_LOCAL_DATA_DIR` | Diretório local de desenvolvimento | Não |
| `UPSTASH_REDIS_REST_URL` | URL HTTPS de um Redis REST compartilhado | Sim, ou URLs específicas |
| `UPSTASH_REDIS_REST_TOKEN` | Token privado do Redis REST | Sim, ou tokens específicos |
| `NEXUS_*_STORE_URL` / `NEXUS_*_STORE_TOKEN` | URLs e tokens específicos por domínio | Alternativa ao par compartilhado |
| `NEXUS_STORE_PREFIX` | Prefixo das chaves Redis | Recomendado |
| `NEXUS_EXPECTED_GIT_REPOSITORY` | Repositório esperado para validação do release | Recomendado |

Os cookies do Instagram devem ser rotacionados sempre que uma sessão for revogada. Use `INSTAGRAM_COOKIES_JSON` na Vercel ou um arquivo local coberto pelo `.gitignore`.

## Comandos

| Comando | Função |
|---|---|
| `npm run dev` | Inicia o frontend Vite |
| `npm run server` | Inicia a API Express |
| `npm run build` | Gera o bundle de produção |
| `npm test` | Executa testes de domínio com `node:test` |
| `npm run check:syntax` | Verifica a sintaxe dos arquivos Node |
| `npm run check:secrets` | Bloqueia arquivos e padrões sensíveis rastreados |
| `npm run check` | Executa secret scan, sintaxe, testes e build |
| `npm run verify:release -- <url>` | Confirma healthz, SHA e existência do commit no GitHub |
| `npm run migrate:audits` | Prepara a migração das auditorias legadas |
| `npm run preview` | Visualiza localmente o bundle gerado |

Antes de abrir um pull request ou enviar ao `main`, execute:

```bash
npm run check
```

## Arquitetura

```text
src/
  App.jsx                 Interface executiva pública
  data/clients.js         Cadastro e auditorias legadas em transição
api/
  index.js                Único handler Serverless público
server/
  domain/                 Domínios executivos e stores
  integrations/           Monday e Google Calendar
  persistence/            Adaptador local/Upstash Redis REST
  release.js              Metadados verificáveis do deploy
  scraper-module.js       Scraper do Instagram
scripts/
  check-secrets.mjs       Scanner de segredos rastreados
  check-syntax.mjs        Verificador de sintaxe
  migrate-legacy-audits.mjs
tests/
  domain.test.mjs         Testes de contratos executivos
```

A arquitetura de produto e as limitações de persistência estão detalhadas em [`ARCHITECTURE.md`](./ARCHITECTURE.md).

## Segurança

Não versione cookies, tokens, arquivos `.env`, chaves privadas, dumps ou scripts exploratórios com credenciais. O scanner local cobre padrões comuns, mas não substitui a rotação de um segredo exposto.

Se um segredo entrar no Git, execute duas ações separadas: primeiro revogue ou rotacione o segredo no serviço de origem; depois remova-o do estado atual e, mediante coordenação da equipe, reescreva o histórico Git. Remover apenas o arquivo do último commit não apaga versões anteriores.

## Fluxo Git recomendado

```bash
git checkout main
git pull --ff-only origin main
git checkout -b tipo/descricao-curta
npm run check
git add <arquivos>
git commit -m "Descrição objetiva da alteração"
git push -u origin tipo/descricao-curta
```

Use pull requests para alterações de arquitetura, persistência, segurança ou integrações. Mudanças pequenas e urgentes devem continuar passando pelo `npm run check`.

## Deploy na Vercel

O projeto deve estar ligado ao repositório `Vybebrasil/vybe-monitorado` e ao branch `main`. A Vercel deve manter habilitado o acesso às variáveis de sistema, especialmente `VERCEL_GIT_COMMIT_SHA`, `VERCEL_GIT_COMMIT_REF`, `VERCEL_GIT_REPO_OWNER` e `VERCEL_GIT_REPO_SLUG`. Após o deploy, valide:

```bash
curl 'https://vybe-nexus.vercel.app/api/healthz?probe=true'
npm run verify:release -- https://vybe-nexus.vercel.app
```

O campo `release.commit` precisa ser um SHA de 40 caracteres, o repositório precisa ser `Vybebrasil/vybe-monitorado` e o commit precisa existir no GitHub. A verificação também confirma o estado dos quatro stores. O health check mantém liveness em HTTP 200, mas informa `ready: false` quando a identidade do release ou a persistência de produção não está pronta.

## Limitações conhecidas

O adaptador de produção foi implementado para Upstash Redis REST, mas ainda depende de uma ação manual na Vercel: criar ou vincular o banco, adicionar as variáveis privadas e fazer um novo deploy. Configurar apenas uma URL sem o token correspondente deixa o store como `misconfigured` e não habilita a persistência.

O adaptador usa hashes Redis separados por domínio e serializa cada registro como JSON. As escritas de decisão e impacto são idempotentes por `id`; a deduplicação de Health Score mantém a regra existente por cliente e minuto de captura. O token padrão do Redis nunca deve ser enviado ao navegador.

O frontend ainda possui um arquivo principal, mas a poda reduziu o App.jsx para o núcleo executivo e removeu filas, tabelas, filtros, modais de produção, Auditoria pública e Dossiê operacional do fluxo principal. A API pública agora é o único arquivo dentro de `api/`; domínios, integrações, persistência e release ficam em `server/`, reduzindo a descoberta de funções da Vercel. A próxima etapa pode modularizar o frontend sem alterar o contrato entre Nexus, Monday e Vybe Painel.

## Referências

A integração usa o padrão oficial de autenticação Bearer e comandos JSON da [API REST do Upstash Redis](https://upstash.com/docs/redis/features/restapi). A configuração de integração com Vercel segue a [documentação oficial do Upstash para Vercel](https://upstash.com/docs/redis/howto/vercelintegration). A identidade do release usa as variáveis oficiais descritas pela [Vercel em System Environment Variables](https://vercel.com/docs/environment-variables/system-environment-variables).
