# Relatório financeiro analítico

Em **Financeiro → Relatórios**, o relatório detalha as receitas e despesas do período, com vencimento/referência, realização, descrição integral, observações, cliente ou fornecedor, categoria, origem, número da OS, placa, forma de recebimento de OS, situação e valores separados de receita e despesa.

O período usa datas de Brasília e inclui a data final. Há atalho de mês, datas livres, natureza, situação, categoria e busca sem distinção de acentos por nome, descrição, observação, OS, placa ou forma de recebimento. Os totais são recalculados após os filtros.

As bases de data são explícitas:

- **Vencimento / referência**: usa o vencimento de lançamentos manuais e parcelas pendentes. Recebimentos de OS usam a data efetiva de recebimento, porque não representam uma obrigação com vencimento próprio.
- **Pagamento / recebimento**: usa `paidAt` nos lançamentos manuais e `receivedAt` nos recebimentos de OS. Inclui apenas movimentos realizados, mesmo quando seu vencimento pertence a outro período. Não inclui parcelas pendentes.

Valores a receber e a pagar ficam separados de receitas e despesas realizadas. Parcelas já pagas não são somadas novamente aos recebimentos. A coluna de realização não inventa uma data quando um registro antigo não a informa. Os dados complementares de OS, veículo, cliente e fornecedor são consultados com isolamento de oficina; metadados indisponíveis não apagam o movimento financeiro.

A tela pagina a prévia em grupos de 50 registros. **Imprimir analítico / PDF** abre todos os registros que correspondem aos mesmos filtros, sem limitar à página visível. O documento usa A4 paisagem, cabeçalho de tabela repetido, números de página, observações completas, totais ao final e indicação do período e dos filtros. Um resultado vazio gera uma página com o aviso de ausência de lançamentos. A impressão financeira anterior em retrato continua disponível nos seus endereços existentes.

O acesso requer `finance.view`. A rota de impressão também verifica essa permissão antes de solicitar dados. Não há alteração de schema ou migração de banco: os novos detalhes usam as informações já armazenadas. O parâmetro opcional `dateField` da consulta financeira mantém `DUE` como padrão para os consumidores existentes.

Verificações: cálculos e filtros unitários, HTTP com PostgreSQL para períodos, realização em mês diferente do vencimento, isolamento entre oficinas, limite de datas e conjuntos com mais de cem registros; navegação, filtros e paginação no navegador; PDF com várias páginas, resultado vazio e regressão da impressão em retrato. Os PDFs de conferência usam dados fictícios e ficam em `frontend/artifacts/`.
