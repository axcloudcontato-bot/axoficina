# Histórico de ordens de serviço

O menu Ordem de Serviço abre com as ordens em andamento, sem limitar a data de entrada. Para consultar um dia ou período, use Hoje, Ontem, Últimos 7 dias, Últimos 30 dias ou preencha as duas datas e clique em Aplicar período. Também é possível informar somente uma das datas ou consultar Todo o histórico.

O seletor **Consultar pela data de** distingue entrada na oficina de entrega ou cancelamento. Os limites incluem o dia inteiro no horário de Brasília (America/Sao_Paulo), independentemente do fuso do navegador ou servidor. A consulta apresenta os status atuais, sem reconstruir o status que cada OS tinha em uma data passada.

O card **Entregues** conta somente ordens entregues, pela data efetiva da entrega, inclusive quando a entrada aconteceu antes do período. Cancelamentos não entram nessa contagem. Clicar no card conserva o período e a busca, seleciona o status Entregue e consulta pela data de encerramento. Os demais cards seguem a data selecionada no filtro. Cards consideram o período e a busca, independentemente do status, condição ou página selecionada.

A lista mostra as datas de entrada e encerramento. Busca, período, status e condição são aplicados no servidor antes da paginação. As páginas têm até 100 ordens; os cards contabilizam todos os resultados do período. Limpar filtros retorna às ordens em andamento sem limite de data.

`POST /api/v1/service-orders/list` aceita `start_date`, `end_date` (AAAA-MM-DD), `date_field` (`OPENED` ou `CLOSED`), `attention` (`ACTIVE`, `OVERDUE`, `UNASSIGNED`, `PAYMENT_PENDING`) e `include_metrics`. Os campos são opcionais, preservando os consumidores anteriores. `include_metrics: true` acrescenta `metrics` com `active`, `overdue`, `waiting_parts`, `ready` e `delivered`. Todas as consultas respeitam o isolamento por oficina e ignoram ordens removidas.
