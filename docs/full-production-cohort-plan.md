# Plano técnico: coorte completa de Produção no explorador

## Diagnóstico

O conector `server/integrations/monday.js` já constrói `itemRows` para cada item recebido pelo board 7829537690. Também retorna `activeItems` filtrando os itens concluídos e preserva `itemRows` para recortes executivos. O domínio `server/domain/executive.js` já expõe `itemRows` e `itemRowsComplete`.

A perda das 155 linhas acontece quando o pacote executivo não recebe a coorte completa. O explorador então cai para `delayDetails`, que contém apenas os 27 itens com atraso. No ambiente de preview analisado, o stub devolve os agregados globais e `delayDetails`, mas não devolve `itemRows` nem `activeItems` detalhados.

## Alterações necessárias

### 1. Contrato do espelho do Vybe Painel

O bootstrap de `GET /api/operational-mirror` deve retornar os 155 itens do board de Produção em `items`, não apenas itens alterados ou atrasados:

```json
{
  "ready": true,
  "board_id": 7829537690,
  "version": 123,
  "complete": true,
  "item_count": 1790,
  "active_item_count": 155,
  "items": [
    {
      "id": "...",
      "name": "...",
      "group": { "title": "Redação" },
      "column_values": [
        { "id": "status", "text": "A Fazer", "value": "..." },
        { "id": "person", "text": "...", "value": "..." },
        { "id": "data", "text": "...", "value": "..." },
        { "id": "data__1", "text": "...", "value": "..." },
        { "id": "lista_suspensa_mkmqnjbv", "text": "...", "value": "..." }
      ]
    }
  ]
}
```

O delta deve continuar trazendo somente mudanças, mas cada upsert precisa carregar `raw` completo o bastante para substituir a linha anterior; exclusões devem carregar `item_id` e `operation: delete`.

### 2. Validação em `server/integrations/operational-mirror.js`

`normalizeSnapshot` deve exigir `complete: true` e validar `item_count`/`items.length` ou uma flag equivalente. `mirrorIsReady` não deve considerar qualquer array como base completa. Se o espelho retornar apenas 27 sinais, o Nexus deve rejeitar essa base como completa e usar o fallback direto controlado ou exibir a fonte como parcial.

### 3. Proteção em `server/integrations/executive-sources.js`

`mirrorIsReady` deve exigir a coorte completa:

```js
function mirrorIsReady(snapshot) {
  return snapshot?.ready === true
    && snapshot?.complete === true
    && Array.isArray(snapshot.items)
    && snapshot.items.length > 0;
}
```

Se o contrato não puder fornecer uma flag `complete`, usar uma validação explícita de `item_count` e `items.length`, com estado `partial` quando a contagem não for verificável. Não marcar como `live/complete` uma base parcial.

### 4. Preservar a coorte no domínio executivo

Em `server/domain/executive.js`, manter:

```js
itemRows,
itemRowsComplete: Array.isArray(posts.itemRows) && posts.itemRows.length > 0,
activeItems: itemRows.filter(item => !item.isCompleted && item.status !== 'Sem status'),
```

O ideal é adicionar também `itemRowsCount`, `activeItemsCount` e `itemRowsSource`, para que o front-end saiba se está vendo 155 linhas reais ou apenas sinais parciais.

### 5. Serialização da rota `/api/dashboard/metrics`

A rota já envia o snapshot executivo completo; não usar `compactSnapshotItems` para o payload da tela. Esse compactador deve continuar restrito ao `eventSnapshot` usado para persistência de eventos. Confirmar que o retorno contém `metrics.executiveSnapshot.itemRows` e `itemRowsComplete` em produção.

### 6. Front-end

`ExecutiveOperationsExplorer.jsx` já prioriza `itemRows` e `activeItems`, com fallback para `delayDetails`. Depois que o contrato for corrigido, a tela listará 155 linhas abertas. O fallback deve continuar rotulado como `sinais observáveis`, nunca como `itens abertos`.

O perfil `ExecutiveEntityProfileDrawer.jsx` deve usar a mesma seleção de coorte completa e fallback parcial. O Analytics só deve recalcular ativos, concluídos, prontos e demandas quando as linhas detalhadas tiverem `itemRowsComplete === true`; com sinais parciais, pode calcular somente atrasos e concentração.

## Critérios de aceite

1. O endpoint de métricas contém `itemRows.length` igual ao total recebido do board e `itemRowsComplete: true`.
2. O explorador de Produção mostra 155 itens não concluídos quando o snapshot agregado informa 155 ativos.
3. Itens com status `Agendado` ou `Para agendar` permanecem na coorte ativa; `Finalizado`, `Publicado`, `Cancelado`, `Feito`, `Concluído` e `Entregue` ficam fora.
4. O filtro por responsável, cliente, etapa e status recalcula a coorte completa, não apenas os 27 atrasados.
5. O aging ordena todos os itens atrasados antes dos itens no prazo e mantém o prazo correto.
6. Os 27 atrasos continuam sendo uma métrica derivada dentro das 155 linhas, não a lista inteira.
7. Se o espelho voltar parcial ou falhar, a tela mostra `N/D`/`sinais observáveis` com motivo; nunca mostra 155 sem evidência.
8. Demandas continua independente e só mostra zero quando a coorte do board foi realmente observada.

## Conclusão

A correção principal não é no componente visual. É garantir que o espelho compartilhado entregue um **bootstrap completo** da Produção e que o Nexus verifique essa completude. O front-end já está preparado para consumir `itemRows`; hoje ele só recebe 27 sinais porque o ambiente de execução entrega apenas `delayDetails` ou um snapshot reduzido. A modificação deve acontecer primeiro no contrato/serialização da fonte, depois ser protegida por validações no cliente e finalmente comprovada pelo smoke test.
