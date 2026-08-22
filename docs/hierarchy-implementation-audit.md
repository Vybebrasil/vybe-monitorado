# Auditoria da implementação de hierarquia

## Carteira

A primeira tentativa de reorganização comprimía a missão principal por conflito com o grid legado. O override estrutural foi aplicado: a missão principal agora ocupa a coluna dominante, as missões secundárias ficam empilhadas e a origem dos descontos está em disclosure. O inventário legado duplicado de responsáveis, clientes e atrasos foi removido do App para evitar a repetição da mesma evidência em três lugares.

## Demandas

O preview mostra uma pergunta dominante — qual solicitação deve ser atendida primeiro —, impacto de vencidas, fonte explícita, quatro KPIs secundários e a lista curta de evidências. O estado vazio deixa claro que ausência de Solicitações de Demandas não equivale a ausência de trabalho em Produção de Conteúdo. O painel de status está em segundo nível e a regra de leitura permanece acessível.

## História

A nova História apresenta uma pergunta dominante, a disponibilidade de eventos como impacto e um CTA discreto para instruções. O estado pendente ficou mais calmo e não compete com a decisão operacional. O ciclo de correção e filtros permanecem acessíveis, mas devem continuar com peso secundário quando não houver snapshots reais.

## Time

Após a correção, quando as linhas detalhadas não estão disponíveis, pressão individual e gargalo de etapa aparecem como N/D ou como maior volume, sem percentuais artificiais. Isso preserva a confiança no painel e evita que o maior volume seja confundido com maior atraso.

## Analytics

A sequência final ficou: pergunta executiva → recomendação → impacto → KPIs → filtros → evolução → diagnósticos. Os filtros continuam interativos e os gates confirmam recálculo de KPIs e abertura de drawers.

## Analista

A entrada agora prioriza causa, impacto, evidência e ação para chegar à tabela. O cabeçalho antigo foi substituído por uma barra Apple-like. A ponte do Vybe Painel continua somente leitura; respostas inválidas ou 404 são convertidas em mensagens amigáveis, sem apagar a evidência do Monday.

## Gates finais

A suíte passou com 44 testes. Build Vite, Analytics Center, filtro cruzado, regressão de interações, mobile a 390 px e foco de acessibilidade passaram. O timeout isolado do gate de filtro foi reproduzido como instabilidade de inicialização e passou em uma sessão nova; a execução final também passou.

## Escopo alterado

A implementação alterou apenas hierarquia, composição, microcopy, estados honestos de disponibilidade, tratamento de erro da fonte complementar e estilos. Não houve deploy nesta etapa.
