# Auditoria funcional — VYBE NEXUS

**Escopo:** capacidade do Nexus de acompanhar a agência, explicar desvios, comparar desempenho, investigar causas e acompanhar correções.  
**Fora do escopo prioritário:** CLS, tipografia mobile e otimizações de performance.

## Diagnóstico executivo

O Nexus já é um bom **leitor executivo de sinais operacionais**, mas ainda não é um cockpit completo de gestão da agência. A diferença é importante: hoje ele informa onde existe pressão e permite abrir várias evidências; ainda não fecha de modo consistente o ciclo **o que aconteceu → por que aconteceu → quem precisa agir → até quando → se a correção funcionou**.

A maior parte da inteligência necessária já existe no payload do backend. O domínio executivo entrega `itemRows`, `demandItemRows`, `delayDetails`, `portfolioReadiness`, `sourceRelation`, `calendarSignals`, `capacitySignals`, `executiveRisks`, `decisionsNeeded`, `portfolioExecution` e `sourceQuality`. O gargalo principal é a forma como essas capacidades são expostas e conectadas na experiência, além da ausência de uma memória operacional disponível na produção.

> **Conclusão:** não é necessário começar criando mais KPIs. É necessário transformar os sinais existentes em um sistema navegável de acompanhamento, com backlog completo, perfis, comparativos e ciclo de correção.

## O que já é funcional

| Capacidade | Situação atual | Avaliação |
|---|---|---|
| Sinal prioritário no Resumo | JARVIS escolhe uma pressão dominante, mostra impacto e abre investigação | Funcional |
| KPIs operacionais | Itens ativos, atrasos de Produção, demandas vencidas, prontidão e clientes sem execução | Funcional, mas ainda sem todos os próximos passos |
| Evidência de Produção | Drawers mostram item, cliente, responsável, etapa, status, datas, urgência e link do Monday | Funcional |
| Separação de fontes | Produção de Conteúdo e Solicitações de Demandas são nomeadas separadamente | Funcional, com lacunas no fluxo de Demandas |
| Filtros cruzados | Analytics recalcula o snapshot atual quando existem linhas completas | Funcional, mas restrito à estação Analytics |
| Cores de status | Status usa a cor recebida ou mapeada para o Monday | Funcional |
| Honestidade de dados | N/D é usado quando a coorte ou histórico não permite conclusão | Funcional e importante preservar |
| Delta do Vybe Painel | Mudanças recentes podem aparecer com timestamp e item afetado | Funcional enquanto a ponte estiver disponível |
| História real | Modelo de eventos, snapshots e ciclo de correção já existe | Incompleto em produção sem persistência ativa |

## O que ainda não chegou ao ponto ideal

### 1. O produto acompanha sinais, mas não acompanha a operação inteira

A Carteira permite navegar por sinais de capacidade, clientes expostos e missões. Entretanto, não existe uma visão operacional completa que responda, em uma mesma superfície: **quais são todos os itens abertos, em que etapa estão, qual o próximo prazo, quem é o responsável, qual é a fonte, qual é a severidade e qual ação está pendente**.

A estação Demandas é a evidência mais clara. Em `ExecutiveDemandPanel.jsx`, o componente lê `snapshot.demandItems`, calcula quatro KPIs, mostra somente os cinco itens prioritários e oferece um disclosure simples de status. Não há pesquisa, filtros por responsável/cliente/etapa/status, faixas de aging, ordenação configurável, exploração completa do backlog ou drilldown de status equivalente ao de Produção. O texto “Ver mais no Analista” transfere a responsabilidade para outra estação em vez de oferecer continuidade natural.

**Correção necessária:** criar uma estação de backlog executivo unificado, sem duplicar o Vybe Painel. Ela deve apresentar as duas fontes como trilhas separadas e permitir pesquisar e filtrar o conjunto completo. Demandas precisa ser uma área investigável por si só, não apenas um resumo com cinco exemplos.

### 2. Performance individual ainda significa concentração de atraso

O painel Time & Performance calcula carga, itens ativos, concluídos e atraso quando existem linhas detalhadas. Quando elas não existem, corretamente exibe N/D. Porém, mesmo no caso completo, o foco está em atraso relativo e concentração por etapa; isso não equivale a uma medição completa de performance individual.

O gestor ainda não consegue acompanhar, por pessoa e período: itens recebidos, concluídos, taxa de conclusão, atrasos iniciados/resolvidos, tempo médio até conclusão, volume por etapa, concentração de dependências, capacidade comprometida e evolução. Também não existe um perfil individual com histórico. O próprio painel informa que não é ranking de valor individual, o que é correto do ponto de vista de não culpabilização, mas deixa a pergunta do gestor sem resposta operacional.

**Correção necessária:** definir performance observável como conjunto de dimensões operacionais, não como uma nota única. Criar perfil por responsável com coorte, período, fonte, itens, status, atrasos, conclusão, carga e tendência. Toda métrica precisa mostrar denominador, período e fonte.

### 3. Performance de clientes está fragmentada

O Nexus mostra exposição por cliente, clientes sem execução, prontidão, reuniões e calendário. Isso permite identificar risco, mas ainda não existe uma visão individual consolidada que una: execução atual, itens atrasados, demandas abertas, status, agenda, planejamento, calendário de três meses, tendência e próxima ação.

A situação é especialmente importante porque vários sinais podem apontar para o mesmo cliente. Sem uma página ou drawer de cliente completo, o gestor precisa saltar entre KPIs diferentes e reconstruir a história manualmente.

**Correção necessária:** criar o perfil de cliente executivo com cinco blocos: estado atual, causas, compromissos próximos, histórico e ação recomendada. A exposição deve deixar explícito se vem de atraso interno, veiculação, demanda, falta de execução, falta de reunião, falta de planejamento ou combinação desses fatores.

### 4. História e logs ainda não fecham o ciclo

O backend já produz eventos, alertas, riscos persistentes, eficácia e aprendizagem. A estação História também explica a diferença entre eventos operacionais e logs técnicos. Entretanto, quando não há snapshots persistidos, a experiência fica principalmente em estado pendente. Quando há eventos, eles são apresentados como registro, não como fluxo de acompanhamento.

Ainda faltam ações para registrar ou acompanhar: decisão tomada, responsável pela decisão, prazo da correção, checkpoint, resultado esperado, impacto observado e encerramento. A busca textual no front-end não encontrou um fluxo de registro de decisão ou checkpoint; existem mensagens de recomendação, mas não um mecanismo funcional para transformar recomendação em compromisso mensurável.

**Correção necessária:** adicionar um ciclo explícito e somente leitura/registro executivo, sem alterar o Monday automaticamente: `observado → investigado → decidido → em correção → medido → aprendido`. O usuário precisa poder marcar o próximo passo e depois verificar se o sinal melhorou.

### 5. Analytics é forte, mas ainda é um laboratório de recortes

Analytics já é a estação mais profunda: tem seis KPIs, série temporal, filtros de responsável/cliente/etapa/status e drawers. Ainda assim, há três limites funcionais.

Primeiro, a série histórica é da agência inteira enquanto o recorte altera apenas o snapshot atual. Isso está corretamente avisado no texto, mas não é a experiência ideal para comparação. Um gestor que filtra uma pessoa tende a esperar a linha daquela pessoa.

Segundo, os filtros são exatos e não há busca, combinações salvas, filtro temporal do snapshot, aging por faixa ou comparação entre dois recortes. Terceiro, clicar em uma pessoa/cliente/etapa/status leva a evidência, mas não abre um perfil navegável com contexto acumulado e próxima ação.

**Correção necessária:** separar “análise da agência” de “análise do recorte”. Quando não houver série histórica do recorte, o controle deve deixar isso visualmente inequívoco; quando houver histórico por entidade, a linha deve acompanhar o filtro. Adicionar busca, aging, comparação A/B e filtros persistentes na URL.

### 6. Demandas e Produção ainda não têm uma reconciliação executiva completa

A nomenclatura das fontes melhorou, e `sourceRelation` já informa clientes nas duas fontes, somente em Produção ou somente em Demandas. Porém, esse relacionamento aparece como detalhe dentro da investigação do score. Ele ainda não funciona como uma tela de reconciliação que identifique: demanda aberta sem produção correspondente, produção sem solicitação, possível duplicidade, demanda vencida sem item vinculado e item de Produção sem demanda de origem.

**Correção necessária:** criar um módulo de relação entre fontes com estados explícitos: `sem par`, `par provável`, `par confirmado`, `conflito` e `não reconciliável`. Não criar status no Monday; trata-se de uma classificação executiva dentro do Nexus.

### 7. Dados frescos e dados históricos não estão no mesmo contrato de uso

O `sourceQuality` informa frescor, espelho, completude e cobertura. Isso é tecnicamente bom. Mas cada estação ainda interpreta disponibilidade de forma própria. O usuário precisa saber em qualquer tela: quando os dados foram capturados, qual fonte respondeu, se o espelho está atrasado, qual coorte está completa e quais números não podem ser comparados.

Além disso, a evolução histórica em produção continua dependente da persistência de snapshots. Sem essa memória, o Nexus não consegue responder perguntas de passado nem medir se as correções funcionaram.

**Correção necessária:** criar um contrato visual e funcional de frescor global, com `capturado em`, `fonte`, `versão`, `completude`, `atraso estimado` e `limitação`. A história deve ser tratada como capacidade central, não como uma tela opcional.

## Perguntas que o gestor precisa responder em menos de dois minutos

| Pergunta | Hoje | Estado ideal |
|---|---|---|
| O que exige decisão agora? | Sim, no Resumo | Manter, com severidade e próxima ação mais fortes |
| Quais são todos os atrasos? | Sim, via drawers e Analytics | Backlog completo com aging, filtro e busca |
| Qual atraso é mais urgente? | Parcial, por dias e urgência | Faixas 0–2, 3–7, 8–30 e 30+ dias com peso visual |
| Quais demandas estão vencidas? | Parcial, cinco exemplos na estação Demandas | Lista completa, filtros e causa por item |
| Quem está pressionado? | Sim, concentração atual | Perfil individual e tendência por período |
| Quem está performando melhor/pior? | Não como performance histórica | Métricas operacionais transparentes, sem ranking simplista |
| Quais clientes estão em risco? | Sim, exposição e sem execução | Perfil consolidado, causa, compromisso e tendência |
| O que mudou desde a última leitura? | Sim, quando delta disponível | Linha de mudanças com impacto e ação derivada |
| O que melhorou ou piorou? | Não de forma confiável sem histórico persistido | Série real por agência, fonte, cliente, etapa e responsável |
| Qual é a causa? | Parcial, em drawers pré-configurados | Investigação navegável com evidência e hipótese explícita |
| O que deve ser feito? | Recomendação textual | Ação registrada, responsável, prazo e checkpoint |
| A correção funcionou? | Não | Impacto medido e aprendizado persistido |
| Há divergência entre sistemas? | Parcial, relação entre fontes | Reconciliação operacional visível e acionável |

## Arquitetura funcional recomendada

O Nexus deve evoluir para cinco camadas de uso, sem duplicar a execução do Vybe Painel:

1. **Comando:** uma decisão dominante e os três sinais que justificam sua prioridade.
2. **Operação:** backlog completo separado por Produção de Conteúdo e Solicitações de Demandas, com busca, filtros, aging e fontes.
3. **Performance:** perfis de responsáveis, clientes e etapas com métricas observáveis e comparação.
4. **Memória:** histórico de snapshots, eventos, mudanças, decisões, checkpoints, impactos e aprendizagem.
5. **Qualidade:** frescor, completude, cobertura, reconciliação e limitações de cada leitura.

A navegação atual pode continuar com Resumo, Carteira, Demandas, Time, Analytics e História, mas cada uma precisa ter uma pergunta dominante. O Analista deve ser a investigação profunda e não um segundo painel geral. O Resumo deve encaminhar para o destino correto: item, pessoa, cliente, fonte, decisão ou histórico.

## Roadmap priorizado

### P0 — Fechar o acompanhamento operacional

Criar backlog completo investigável para Demandas e Produção, com busca, filtros por fonte/cliente/responsável/etapa/status, aging, ordenação por urgência e evidência direta. Unificar os padrões de drilldown para que o clique em qualquer KPI leve à mesma gramática de investigação.

### P0 — Transformar recomendação em ciclo de correção

Adicionar registro de decisão, responsável, prazo, checkpoint e resultado esperado. Reusar a camada de eventos/persistência disponível ou a memória compartilhada do Vybe Painel; não criar uma segunda base operacional independente. Enquanto a persistência não estiver disponível, manter o estado explicitamente como não persistido.

### P1 — Criar perfis navegáveis

Implementar perfil de responsável, perfil de cliente e perfil de etapa. Começar com estado atual e evidências; depois adicionar histórico real. Não criar uma pontuação de pessoa sem denominador, período e coorte.

### P1 — Melhorar Analytics e reconciliação

Adicionar comparação entre recortes, filtros persistentes, aging e tela de relação entre Produção e Demandas. O histórico filtrado só deve aparecer quando houver snapshots por entidade; caso contrário, mostrar a limitação no próprio gráfico.

### P1 — Tornar a memória uma capacidade de produto

Ativar o histórico real em produção pela arquitetura compartilhada já adotada, sem duplicar o Vybe Painel. Disponibilizar uma linha do tempo de mudanças, decisões, checkpoints e impactos, não apenas uma lista de eventos.

### P2 — Evoluir previsão e capacidade

Depois de existir histórico suficiente, adicionar tendência por cliente, pessoa, etapa e fonte, projeção de backlog, capacidade necessária e cenários. Não antecipar esse módulo usando linhas fabricadas ou extrapolações sem base.

## Critérios para considerar o Nexus funcionalmente maduro

O produto estará em um ponto ideal quando o gestor conseguir sair do Resumo e chegar ao item exato em no máximo dois cliques; quando Demandas e Produção tiverem backlog completo e filtros próprios; quando cada pessoa e cliente tiver um perfil com métricas observáveis; quando a linha histórica for real e coerente com o recorte; quando cada recomendação puder virar uma ação com checkpoint; quando a divergência entre fontes for visível; e quando cada número indicar fonte, período, coorte e qualidade.

A prioridade correta agora é **P0: completar investigação e acompanhamento**, não adicionar mais estética, mais KPIs ou mais texto de JARVIS. O próximo sprint deve ampliar o comportamento do produto: navegar, reconciliar, registrar, comparar e medir correções.
