# Auditoria geral de hierarquia visual — VYBE NEXUS

**Fonte visual auditada:** https://vybe-nexus.vercel.app/?hierarchy-audit=1

## Primeira leitura do Resumo em produção

A ordem atual é: shell lateral e topbar; presença da JARVIS; hero de comando executivo; cinco métricas; mudanças desde a sincronização; decisões prioritárias; pressão operacional; memória; capacidade do time; clientes sob pressão; histórico. A estrutura é completa, mas a primeira tela apresenta muitos níveis de destaque competindo entre si.

O hero é o maior bloco e tem o headline correto, mas o bloco de cinco KPIs logo abaixo volta a distribuir a atenção em cinco direções antes de a decisão principal ser assimilada. A faixa de mudanças e o painel de decisões também recebem tratamento de superfície semelhante, o que torna difícil identificar o único próximo movimento recomendado.

Os números de maior relevância ficam divididos entre o hero (`37 entregas exigem decisão`, `-98 pts`), os KPIs (`37 atrasos`, `18 demandas vencidas`), o placar das decisões (`+74 pts recuperáveis`) e a pressão operacional. A semântica existe, mas a escala visual não deixa claro se a prioridade é corrigir o atraso, recuperar pontos, atender demandas ou acompanhar a saúde do time.

O shell ainda contém muitas microinformações simultâneas: subtítulos, badges, fonte, estado do espelho, percentuais e CTAs. Isso aumenta a densidade percebida mesmo quando cada componente isolado está bem desenhado. A sensação de bagunça parece vir mais da **competição entre camadas** do que de falta de informação.

O problema de hierarquia não é ausência de módulos. É ausência de uma regra visual inequívoca que responda, nesta ordem: **o que exige atenção agora; por que isso importa; qual ação deve ser tomada; quais evidências sustentam a ação; onde acompanhar a consequência**.

## Carteira em produção

A Carteira evidencia o problema de hierarquia com mais força. O primeiro bloco após a JARVIS é a faixa de prontidão com cinco KPIs, seguida por barras executivas, um grande bloco de missões e placar, depois a origem dos descontos, composição de status, etapas, responsáveis, clientes e listas. O bloco de missões ocupa muito espaço e combina título, explicação, objetivo, placar, pontos recuperáveis e cards de missão; ele funciona como sistema de recuperação, mas visualmente compete com a leitura operacional de risco.

O mesmo conceito aparece em mais de uma camada: `-98 pts` no placar, `+198 pts recuperáveis`, seis fontes de desconto, seis missões e linhas detalhando cada perda. Há clareza quantitativa, mas a repetição aumenta a sensação de que o usuário precisa decodificar o sistema antes de saber o que fazer.

Os KPIs de prontidão misturam fontes disponíveis, `0` e `N/D` em uma mesma fileira, sem uma diferença visual suficientemente forte entre métrica válida igual a zero e fonte indisponível. Isso pode fazer o gestor interpretar ausência de reunião, agenda ou calendário como baixa performance, quando em alguns casos é falta de integração ou mapeamento.

A Carteira precisa de uma ordem mais rígida: primeiro **próxima decisão**, depois **impacto no placar**, depois **provas**, e somente então diagnóstico amplo e inventário. Hoje o diagnóstico e o inventário entram cedo demais e fragmentam o foco.

## Time & Performance em produção

A estação Time possui um caminho mais coerente que a Carteira: pergunta executiva no hero, resposta, quatro KPIs, três sinais-resumo e depois mapa de capacidade ao lado dos gargalos por etapa. Ainda assim, a tela transforma o mapa de pessoas em um bloco muito grande e coloca `Investigar` repetido em cada card, enquanto o painel de gargalos fica comprimido à direita. O gestor precisa interpretar simultaneamente volume, taxa relativa e número absoluto de atrasos.

Há um risco de leitura: `30,3%` de Paulo Martins, `2,5%` de Tainara e `0%` dos demais aparecem com o mesmo tratamento de card. O sistema explica que é concentração de sinais, não produtividade, mas essa distinção está abaixo da primeira leitura e não tem peso visual suficiente. O denominador, a diferença entre carga e pressão e a ação recomendada deveriam aparecer mais perto do título do mapa.

A hierarquia recomendada para Time é: **pressão total da operação; etapa que concentra o risco; pessoa ou grupo que precisa de investigação; evidências da pessoa**. A implementação atual apresenta primeiro o mapa de pessoas, antes de deixar a etapa pressionada e o critério de comparação totalmente dominantes.

## História & Logs em produção

História tem uma hierarquia conceitual correta, mas o estado vazio ocupa um bloco próprio logo após o hero, depois vem outro painel de explicação, um ciclo com cinco estados, uma lista longa de alertas e, por fim, eventos e filtros. Como não há snapshots persistidos, a tela tem muita explicação sobre a ausência de histórico e pouca evidência temporal real. O alerta `17 sinais com próxima ação` visualmente compete com o estado de indisponibilidade e pode parecer que há um problema de sistema, não uma limitação de memória.

A tela deveria ter dois modos claramente separados: **memória disponível** — linha do tempo, mudanças e impactos — e **memória ainda não configurada** — uma única explicação curta com ação de configuração. O ciclo Observado → Investigado → Decidido → Medido → Aprendido deve funcionar como modelo de leitura, não como cinco KPIs equivalentes, porque quatro estados estão em `N/D` e apenas Aprendido tem valor.

## Demandas em produção

Demandas está mais compacta e funcional, mas a ordem ainda tem quatro KPIs, lista de cinco itens com três sinais por item (cliente, status, prazo e duas ações) e uma coluna de status, tudo no mesmo cartão principal. O gestor entende a fonte e a diferença para Produção de Conteúdo, porém não identifica imediatamente qual demanda é a mais urgente porque a lista combina atraso, status do Monday, cliente e datas com pesos parecidos.

Os CTAs `Abrir cliente` e `Abrir no Monday` aparecem repetidos em todas as linhas. Isso é útil para investigação, mas cria ruído e reduz o destaque da ação executiva principal. A recomendação é manter uma ação primária por linha e deslocar a segunda para o detalhe ou menu contextual.

A seção é um bom modelo de compactação, mas precisa de uma regra mais forte: uma demanda prioritária deve mostrar primeiro **dias vencidos ou prazo**, depois **nome e cliente**, depois **status**, com as ações subordinadas. Hoje o status colorido e o texto de vencimento competem pela primeira leitura.

## Analytics em produção

Analytics é completo e tecnicamente honesto, mas está funcionando como um inventário muito amplo. O hero pergunta como a agência está performando; imediatamente depois entram quatro filtros, uma fileira de seis KPIs, um estado de histórico, fluxo, concentração, risco, etapas e mix de status. O usuário recebe quase todos os recortes ao mesmo tempo, sem um caminho explícito de investigação.

O filtro cruzado é importante, mas aparece antes de o gestor entender qual decisão a análise deve responder. A ausência de histórico aparece duas vezes — no topo da evolução e no aviso final — e ocupa o mesmo espaço visual de módulos com dados reais. Os gráficos de fluxo são barras de estoque atual, não evolução temporal; isso está explicado, mas a diferença entre `volume atual` e `tendência` exige leitura textual.

Analytics deveria ser organizado como uma estação de investigação: **pergunta ou hipótese; recorte aplicado; KPIs do recorte; gráfico principal; evidência detalhada; comparação histórica quando disponível**. Hoje ele se comporta mais como um painel de todos os indicadores possíveis, o que aumenta a sensação de bagunça mesmo com boa qualidade de dados.

## Modo Analista em produção

O Analista é profundo, mas inicia com quatro camadas antes da evidência: intro, contexto de investigação, ponte do Vybe Painel e filtros. Em seguida mostra gráfico de fluxo e só começa a tabela de evidências depois de aproximadamente 1.390 px de conteúdo. Para um modo acionado por uma decisão, isso é longo demais: a causa concreta fica distante do motivo do clique.

Há também um conflito entre o objetivo declarado — investigar um sinal — e a tela entregue — configurar um recorte completo. O Analista precisa receber a pergunta, pessoa, cliente, etapa ou KPI que originou a abertura e colocar essa hipótese no topo; os filtros devem ser refinamento secundário. O estado `0 itens lidos em 0 páginas · leitura parcial` da ponte do Vybe Painel aparece com peso semelhante ao contexto, embora não seja necessariamente o problema que o gestor veio investigar.

A tabela é rica e os links de evidência são corretos, mas a quantidade de linhas e a repetição de `Abrir no Monday` transforma o fim da tela em uma parede de dados. Deve existir um cabeçalho-resumo da investigação com causa provável, impacto, recomendação e contagem de evidências antes da tabela.

## Mobile em produção

O smoke test mobile passa: viewport de 390 px sem overflow, cinco KPIs no Resumo, três decisões, seleção de responsável com evidência Monday, cinco filtros no Analista e refresh funcional. Isso confirma integridade técnica, mas não elimina o problema de hierarquia: o mobile ainda precisa condensar a mesma quantidade de camadas e tende a empilhar JARVIS, hero, KPIs e listas antes de chegar à evidência.

A prioridade da próxima reformulação deve ser comportamental, não apenas responsiva: no mobile, o primeiro viewport deve conter a decisão e o CTA; detalhes, rankings e inventários devem ser colapsáveis ou acessados por um contexto dedicado.

## Transição KPI → investigação

O clique em `Atrasos · Produção` abre um drawer com o título `37 itens de Produção de Conteúdo com prazo interno vencido`, fonte, critério de prazo, total de `-74 pts`, cinco evidências visíveis, pontuação por item e links do Monday. A investigação é funcional e auditável.

O problema é a continuidade visual: o drawer repete o título do KPI, repete a natureza do atraso e mostra simultaneamente total, itens visíveis, pontuação e muitos metadados. A ação principal — entender qual é a causa e o que fazer — fica escondida dentro de uma lista. O primeiro bloco do drawer deveria resumir **causa dominante, impacto, recomendação e próximo passo**, deixando a lista como prova abaixo.

O drawer também herda intensidade visual forte nos chips de atraso e nos pontos negativos. A severidade é necessária, mas todos os itens recebem uma composição parecida; o item de 18D deveria ter dominância clara sobre os quatro itens de 2D, sem depender apenas do texto `18D`.

## Comparação transversal de hierarquia

| Estação | Primeiro foco | Camadas antes da evidência | Principal conflito | Diagnóstico |
|---|---|---:|---|---|
| Resumo | Hero de comando e placar | 2–3 | decisão, KPIs, mudanças e decisões têm destaque próximo | precisa de uma única prioridade dominante |
| Carteira | prontidão e missões | 3–5 | placar e origem dos descontos repetem o mesmo sistema de pontos | separar ação, impacto e inventário |
| Demandas | KPIs e lista prioritária | 1–2 | status, vencimento e duas ações competem por linha | ordenar por urgência e reduzir ações visíveis |
| Time | hero, KPIs e mapa de pessoas | 2–3 | carga absoluta, pressão relativa e atraso parecem equivalentes | destacar etapa pressionada antes da pessoa |
| Analytics | filtros e seis KPIs | 3–4 | exploração ampla sem hipótese inicial | transformar em fluxo de investigação |
| História | estado de memória e ciclo | 2–3 | ausência de histórico recebe peso semelhante a alertas | separar disponibilidade de sinal operacional |
| Analista | intro, contexto, ponte, filtros | 4 | contexto técnico antecede causa e evidência | receber a hipótese do clique e encurtar a entrada |

As métricas de layout confirmam o padrão: o Resumo tem um hero de aproximadamente 343 px, mas a primeira evidência de decisão aparece apenas depois da faixa de mudanças; o Analytics coloca os KPIs por volta de 590 px e o primeiro grid analítico por volta de 824 px; o Analista só inicia a tabela em torno de 1.390 px. A hierarquia está sendo construída por empilhamento de módulos, não por progressão de atenção.

## Padrões transversais observados

1. **Excesso de primeiros níveis.** JARVIS, breadcrumb, hero, placar, KPIs, tags de fonte, percentuais e CTAs são todos tratados como informação primária. A interface não distingue com força suficiente entre orientação, decisão, evidência e contexto.

2. **Repetição sem compressão semântica.** O mesmo sinal aparece como KPI, decisão prioritária, barra, item de missão, fonte de pontos e linha de evidência. A repetição é defensável para rastreabilidade, mas precisa ter papéis visuais diferentes.

3. **Ação principal diluída.** `Abrir prioridade`, `Investigar no Analista`, `Abrir história`, `Abrir causa`, `Abrir evidências`, `Investigar` e `Abrir no Monday` aparecem próximos ou repetidos. O usuário frequentemente precisa escolher entre investigar, abrir o item, abrir o cliente e abrir o histórico antes de entender qual ação é recomendada.

4. **Escala tipográfica pouco semântica.** Eyebrows, labels de seção, tags de fonte, status e notas têm tamanhos semelhantes. A leitura exige reconhecer o componente pelo contexto, não pela escala.

5. **Cor carregando significado demais.** Ciano, amarelo, vermelho, verde, roxo e estados do Monday convivem com pontos recuperáveis, risco, atraso, disponibilidade de fonte e CTA. Mesmo com a paleta correta, a quantidade de acentos faz a interface parecer mais urgente do que a evidência justifica.

6. **Estados de ausência ocupando espaço de estado ativo.** `Histórico ainda não ativo`, `N/D`, `leitura parcial` e `0 itens lidos` são honestos, mas aparecem como módulos completos. A honestidade precisa continuar, com uma forma visual menor e claramente secundária.

7. **Dados e interpretação misturados.** Percentual, contagem, severidade, regra de cálculo, origem e recomendação aparecem no mesmo cartão. A leitura executiva deveria mostrar primeiro a interpretação e permitir abrir o cálculo como evidência.

## Diagnóstico executivo

A interface não está bagunçada por falta de design; está bagunçada porque **tudo tenta ser importante ao mesmo tempo**. O Nexus já tem dados, gráficos, drilldowns e linguagem visual consistente, mas ainda não tem um sistema de prioridade perceptiva. O gestor precisa fazer o trabalho de um analista: cruzar título, cor, número, fonte, regra de cálculo e CTA para descobrir o próximo movimento.

A regra central para a próxima versão deve ser:

> Uma tela executiva não deve mostrar primeiro tudo o que sabe. Deve mostrar primeiro o que o gestor precisa decidir.

### Hierarquia-alvo

| Nível | Pergunta do gestor | Tratamento visual |
|---|---|---|
| 1. Decisão | O que exige minha atenção agora? | um único bloco dominante, headline grande, um CTA primário |
| 2. Impacto | O que acontece se eu não agir? | dois ou três números de impacto, com unidade e fonte explícitas |
| 3. Próximo passo | O que faço agora? | uma ação primária; ações secundárias discretas |
| 4. Evidência | Quais itens, pessoas ou clientes sustentam isso? | lista curta, ordenada por severidade, com `Ver mais` |
| 5. Contexto | Como isso se compara, de onde veio e qual é a regra? | tooltip, disclosure, drawer ou seção secundária |
| 6. Memória | O que mudou e qual foi o efeito? | histórico e eventos em estação própria, não no caminho primário |

## Plano de correção priorizado

### P0 — Corrigir o foco da tela inicial

O Resumo deve ter apenas uma prioridade dominante. O hero atual pode continuar, mas precisa ser transformado em uma composição de decisão: título da decisão, impacto numérico, causa resumida e uma única ação `Abrir investigação`. O segundo CTA `Investigar no Analista` deve ficar como ação secundária discreta. O placar não deve competir com o título; deve ser uma consequência visual menor, com `-98 pts` acompanhado de `o que gerou` e `o que pode recuperar` em disclosure.

Os cinco KPIs devem ser tratados como navegação de diagnóstico, não como cinco manchetes. O primeiro KPI deve refletir a prioridade do hero; os demais devem ter escala reduzida e labels mais curtos. A faixa de mudanças deve ser condensada em uma linha de frescor com contador e expandir somente quando houver alterações relevantes. As três decisões prioritárias devem aparecer como a prova imediata da decisão dominante, não como outro hero.

### P0 — Separar decisão de inventário

Carteira e Analytics precisam parar de exibir todas as camadas no mesmo nível. O bloco de missões deve mostrar apenas a missão principal aberta, duas missões seguintes em estado compacto e um acesso para `Ver todas as missões`. A origem dos descontos deve ser uma seção de cálculo expandível. O gestor deve enxergar a perda total e a próxima recuperação sem atravessar seis cards de pontuação antes de chegar às listas.

Analytics deve abrir com `O que você quer investigar?` ou receber a hipótese originada pelo clique no Resumo. Filtros devem ficar em uma barra recolhível; os KPIs devem refletir o recorte; o gráfico principal deve ocupar o centro; tabelas, mix de status e rankings devem ser abas ou módulos secundários. O estado sem histórico deve aparecer como uma nota de disponibilidade junto do gráfico, não como um painel que domina a leitura.

### P1 — Criar uma semântica visual de severidade

A severidade deve ser percebida pela combinação de posição, tamanho do número, ordem e cor, e não apenas por um chip vermelho. Em qualquer lista de atrasos, ordenar por dias vencidos decrescentes e reservar o tratamento mais forte para o maior atraso. Exibir sempre `18 dias vencidos`, `2 dias vencidos` e `0 dias de veiculação` com unidades completas no primeiro nível; deixar a codificação curta `18D` para o detalhe.

Status do Monday continua usando a cor oficial, mas a cor de status não deve carregar também o significado de urgência, pontuação e ação. A cor de urgência deve ser aplicada apenas ao indicador de atraso; o status fica em sua própria tag compacta. Isso reduz o efeito de que todos os cartões estão igualmente críticos.

### P1 — Reduzir ações concorrentes

Em cada card, deve existir uma ação primária explícita. No Resumo, é `Abrir investigação`. No drawer, é `Abrir no Monday` ou `Ver todas as evidências`, dependendo do contexto. Em Demandas, a linha deve ter uma ação visível e a outra dentro do detalhe. Em Time e Clientes, clicar no card deve abrir a investigação; o link separado para investigar pode ser mantido apenas em hover ou no rodapé.

### P1 — Fazer cada estação responder a uma pergunta

| Estação | Pergunta principal | Primeiro módulo | Conteúdo que deve descer ou colapsar |
|---|---|---|---|
| Resumo | O que exige decisão agora? | decisão dominante | memória, rankings e inventário |
| Carteira | O que impede a carteira de avançar? | prontidão + missão principal | ledger completo e composição detalhada |
| Demandas | Qual solicitação precisa ser atendida primeiro? | lista ordenada por vencimento | status completo e regras |
| Time | Onde a capacidade está pressionada? | etapa crítica + concentração | todos os cards individuais |
| Analytics | Qual hipótese estou investigando? | recorte + gráfico principal | rankings e mix de status |
| História | O que mudou e qual foi o efeito? | linha do tempo/evento | explicações sobre datastore quando indisponível |
| Analista | Qual é a causa deste sinal? | contexto recebido + recomendação | ponte técnica e filtros avançados |

### P2 — Ajustar o sistema de escala e espaçamento

Adotar quatro níveis tipográficos consistentes: título de decisão, título de módulo, dado principal e nota contextual. Eyebrows, tags de fonte e subtítulos não devem ter todos o mesmo tamanho, peso e espaçamento. Os painéis que respondem à mesma pergunta devem ser visualmente agrupados; painéis de perguntas diferentes precisam de mais separação vertical.

Usar menos bordas e mais agrupamento por espaço. O fundo Apple-like já está adequado, mas a quantidade de cartões arredondados cria uma sequência de caixas equivalentes. Alguns módulos devem virar blocos sem moldura ou divisores leves. A cor de acento precisa marcar somente estado, seleção ou ação — nunca todos ao mesmo tempo.

### P2 — Melhorar a entrada mobile

No mobile, o primeiro viewport deve conter JARVIS, a decisão dominante e o CTA. KPIs secundários devem virar uma faixa horizontal ou um botão `Ver indicadores`; listas de pessoas e clientes devem iniciar fechadas. O Analista deve mostrar primeiro a pergunta investigada e uma síntese de causa/impacto, deixando filtros e ponte do painel em disclosures.

## Ordem recomendada de implementação

1. Reformular o componente de decisão dominante do Resumo e reduzir a competição com o placar.
2. Transformar KPIs em atalhos contextuais com hierarquia de primeiro, segundo e terceiro nível.
3. Criar um componente reutilizável `ExecutiveInsightHeader` com pergunta, impacto, causa, recomendação e ação primária.
4. Criar um componente reutilizável `EvidencePreview` com ordenação por severidade, unidade explícita, status separado e `Ver mais`.
5. Reestruturar Carteira e Analytics para ocultar detalhes secundários sem perder acesso aos dados.
6. Reorganizar Time e Demandas pela pergunta de decisão, não pela ordem atual dos dados.
7. Encurtar História quando não houver persistência e criar a versão completa quando houver eventos reais.
8. Ajustar mobile e executar os gates de interação, acessibilidade e não-regressão.

## Critério de aceite visual

A versão revisada deve permitir que uma pessoa responda, em cinco segundos, qual é o problema principal, qual é o impacto, qual é a próxima ação e onde clicar para provar a causa. Em quinze segundos, ela deve conseguir distinguir Produção de Conteúdo de Solicitações de Demandas, identificar a severidade relativa e entender se o dado é atual, parcial ou histórico. Nenhum módulo secundário deve ter mais peso visual que a decisão dominante da estação.
