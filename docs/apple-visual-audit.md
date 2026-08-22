# Auditoria visual Apple-like — VYBE NEXUS

## Estado observado no preview local

A tela de boot ainda usa linguagem visual de console/HUD: `BOOT SEQUENCE`, `JARVIS DESPERTANDO`, `CRUZANDO OS SINAIS`, tipografia monoespaciada, microtextos em caixa alta e excesso de linhas concêntricas neon.

A tela Resumo já tem uma hierarquia operacional forte, mas ainda mistura o novo shell Apple-like com resíduos de HUD. Os principais sinais são: `COMMAND CENTER`, `SISTEMA ONLINE`, `DADOS AO VIVO`, `ATUALIZAR`, `LEITURA PARCIAL`, rótulos em caixa alta, bordas ciano/amarelas pontilhadas percebidas no modo de inspeção, fontes monoespaciadas em excesso e cartões com contraste cromático mais forte que o necessário.

A navegação lateral usa o mesmo resíduo HUD em `COMMAND CENTER`, `RESUMO`, `CARTEIRA`, `DEMANDAS`, `TIME`, `ANALYTICS` e `HISTÓRIA`. A hierarquia funcional é compreensível, porém a densidade e o lettering técnico afastam a experiência do padrão Apple.

O placar executivo, KPIs, decisões prioritárias e pressão operacional estão estruturalmente corretos e devem manter a lógica. A revisão precisa atuar principalmente em superfície, espaçamento, tipografia, intensidade de cor, microcopy e estados de fonte sem alterar os indicadores.

A memória executiva apresenta diversos `N/D`, que precisam de um estado vazio calmo e explicativo, sem parecer erro crítico. O histórico desativado também deve ser apresentado como estado de disponibilidade futura, não como alerta agressivo.

O modo Analista ainda precisa de escopo visual próprio: header antigo, títulos em caixa alta, bordas ciano/orange forçadas por inline style, tabela com fundo `rgba(10,10,10,0.95)`, sticky header HUD e links/ações em caixa alta.

## Direção de correção

1. Manter a paleta de status do Monday apenas nos status e nos sinais de risco.
2. Reduzir neon, glow, linhas pontilhadas e fontes mono; priorizar superfícies grafite, blur, bordas brancas discretas e tipografia sans.
3. Preservar JARVIS como presença operacional após o carregamento; modernizar o boot sem transformá-lo em uma tela de escolha.
4. Padronizar sentence case nos textos de produto, mantendo caixa alta apenas para pequenos eyebrows quando houver ganho de escaneabilidade.
5. Aplicar o mesmo tratamento a Resumo, Carteira, Demandas, Time, Analytics, História, Analista, drawers e mobile.
6. Não fazer deploy na Vercel sem autorização explícita; a entrega desta sprint será no GitHub e no preview local.

## Validação visual pós-primeira rodada

O boot agora lê como um despertar executivo: `Vybe Nexus · leitura executiva`, `JARVIS despertando`, `Lendo a carteira`, `Cruzando os sinais` e `Uma liderança · um comando · uma leitura`. A hierarquia ficou mais calma, com headline sans e menos linguagem de console, mantendo a presença da JARVIS durante o carregamento.

No Resumo, o shell e o conteúdo agora exibem sentence case no preview: `Command center`, `Sistema online`, `Dados ao vivo`, `Atualizar`, `Leitura parcial`, `Abrir analista`, `Comando executivo · agora`, `Clientes sob pressão` e `Histórico ainda não ativo`. A página mantém uma hierarquia clara de prioridade, placar, cinco KPIs, decisões, pressão operacional, capacidade e clientes.

Ainda há um resíduo visual importante nas capturas anotadas do navegador: as linhas amarelas pontilhadas são caixas de inspeção do navegador, não bordas do produto. O próximo passo é validar as rotas Carteira, Demandas, Time, Analytics, História e Analista individualmente para confirmar material, densidade, estados vazios, tabela e responsividade.

## Validação das estações Carteira e Demandas

A estação Carteira manteve a estrutura e os dados esperados: prontidão, barras de pressão, missões, composição de status, etapas, responsáveis, clientes expostos e investigação. A superfície geral está mais grafite e menos neon, mas alguns componentes ainda herdam `text-transform: uppercase` de regras antigas, especialmente chips compactos de prontidão, labels de composição de status, rótulos de concentração e botões de abertura. Os níveis `19D · CRÍTICO MÁXIMO`, `6D · ALTO` e `1D · ATENÇÃO` confirmam que a hierarquia de urgência existe; o próximo ajuste deve apenas suavizar a forma tipográfica sem retirar o peso cromático e numérico.

A estação Demandas está visualmente coerente com o shell: título editorial, quatro KPIs, estado vazio claro, status separado e regra de leitura. O estado sem itens diferencia corretamente ausência de Solicitações de Demandas da Produção de Conteúdo. Ainda há uppercase nos labels internos dos cartões por herança CSS; isso será corrigido com seletores de componente.

## Validação das estações Time e Analytics

Time & Performance agora apresenta uma composição coerente: hero com pergunta executiva, resposta contextual, quatro KPIs, sinais de maior carga/pressão e etapa, cards de pessoas com barras e painel de gargalos. A leitura está adequada para decisão e preserva a regra de não converter concentração em avaliação individual. Os valores podem ultrapassar 100% quando o agregado de atrasos contém mais sinais que itens ativos da pessoa; isso é dado do modelo atual, não deve ser alterado na revisão visual.

Analytics mantém boa densidade de gráficos e comparações: filtros cruzados, seis KPIs, evolução da agência, fluxo de entrega, concentração por responsável, risco por cliente, etapas e mix de status. O recorte de ausência histórica está honesto e não fabrica tendência. Ainda aparecem cabeçalhos com caixa alta no texto extraído, apesar da nova hierarquia de superfícies; devem ser normalizados no componente Analytics e nos estilos de seus controles.

## Validação do modo Analista

O modo Analista agora abre com header próprio, título `Analista · investigação executiva`, ação `Voltar ao JARVIS`, intro contextual, métricas de versão/placar, ponte do Vybe Painel, filtros naturais, gráfico de fluxo e tabela de evidências com links `Abrir no Monday`. A superfície ficou escura e discreta, com bordas brancas sutis e destaque ciano reservado para ação e fonte.

A saída pelo botão `Voltar ao JARVIS` retorna corretamente ao Resumo. A tela continua separada da navegação do shell, como previsto para uma saída discreta e um modo de investigação mais profundo.

## Validação da estação História

História & Logs apresenta uma hierarquia consistente: hero explicando mudança/causa/correção, estado de histórico pendente sem tom alarmista, ciclo Observado → Investigado → Decidido → Medido → Aprendido, alertas acionáveis e eventos com filtros por tipo, fonte, cliente, responsável e etapa. Os `N/D` aparecem com explicação e não são tratados como zero. O bloco inferior mantém contraste e espaçamento adequados; a versão atual não apresenta linha temporal porque a persistência ainda não está ativa, conforme esperado.
