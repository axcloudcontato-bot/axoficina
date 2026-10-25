# Busca, preenchimento inicial e novidades

## Novo atendimento

A busca rápida apresenta o grupo de clientes antes dos veículos. Cada resultado de veículo destaca o proprietário na primeira linha e mostra marca, modelo e placa abaixo. O combobox de veículos e a busca de OS no cabeçalho seguem a mesma hierarquia.

Quando não há resultados, **Usar o texto em** sugere um destino para a busca e permite alterá-lo antes de clicar em **Adicionar novo**. São aceitos nome, CPF, CNPJ, telefone, e-mail, placa, marca, modelo, chassi e ano. Onze dígitos sem máscara sugerem CPF; o operador pode escolher telefone. A classificação sugere um campo e não valida nem salva o cadastro.

O texto é passado como valor inicial aos formulários. Dados de veículo permanecem guardados enquanto o cliente é cadastrado e são aplicados na etapa seguinte. Os botões de novo cadastro nos comboboxes da OS também aproveitam a pesquisa. Cadastros existentes em edição têm prioridade sobre os valores iniciais; cancelar e iniciar outro atendimento limpa o preenchimento anterior.

Os dados da pesquisa ficam em memória, sem CPF, telefone ou e-mail em URL ou armazenamento do navegador. A criação exige a confirmação e as validações habituais de cada formulário.

## Pesquisa na API

Clientes podem ser localizados por nome, CPF/CNPJ com ou sem máscara, e-mail sem distinção de caixa e telefone. A comparação de números longos ignora a máscara do telefone e reconhece o prefixo brasileiro 55. A busca normalizada por telefone é limitada aos 500 cadastros mais recentes que correspondam ao trecho; buscas curtas continuam usando os campos textuais. Queries de telefone usam a oficina autenticada explicitamente; a extensão Prisma continua filtrando os demais acessos.

Veículos também podem ser encontrados por chassi e ano, além de marca, modelo e variantes usuais da placa. A busca por proprietário reaproveita os contatos e documentos. A busca global de OS trata como número da ordem somente inteiros compatíveis com a coluna do banco, evitando erro ao digitar CPF/CNPJ ou telefone.

## Cabeçalho

O campo de pesquisa fica sempre exposto junto à lupa. Ctrl+K ou ⌘K focaliza e seleciona o texto existente; as setas abrem/percorrem os resultados, Enter abre o destino e Escape fecha o painel. O campo permanece visível ao fechar o painel e é limpo ao mudar de página. Resultados e destinos continuam respeitando as permissões da sessão.

O ícone **Novidades do sistema** abre um histórico por data, com as melhorias disponíveis. O indicador de novidades vistas é salvo apenas neste navegador, por usuário e oficina. Ele é independente da leitura de respostas dos clientes, que continua persistida na API.

Para publicar novas notas, adicione a entrada mais recente no início de `frontend/features/updates/release-notes.ts`, com um `id` novo e estável, data e textos voltados ao usuário. A entrada acompanha o deploy; não há publicação automática de mensagens de commit nem de detalhes internos de implementação.
