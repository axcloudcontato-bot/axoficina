# Nota fiscal na OS

A nota fiscal é **opcional em cada OS**. Muitas oficinas emitem só quando o cliente pede. Por isso nada é emitido sozinho: a nota sai quando alguém clica em **Emitir nota** na seção *Nota fiscal* da OS (etapa Entrega).

## Dois caminhos

| Caminho | Quando usar | O que acontece |
|---|---|---|
| **Emitir pelo Ofix** | Oficina configurada e emissão ativa no servidor | O Ofix monta a nota com os itens da OS, envia ao emissor (Focus NFe), guarda número, PDF e XML e permite cancelar. |
| **Registrar nota emitida** | Nota feita no portal da prefeitura, da SEFAZ, no sistema do contador, ou enquanto a emissão não está ativa | Fica na OS o tipo, o número, a data, o valor e o arquivo (PDF, XML ou imagem, até 2 MB). |

## Que nota sai

- **NFS-e** (serviço, municipal): só os itens de **mão de obra**.
- **NF-e** (produto, estadual): **peças e produtos**. Exige CPF/CNPJ e endereço completo do cliente.
- **NFC-e** (cupom fiscal de produto): peças e produtos para consumidor final. CPF opcional até R$ 10.000.

O desconto da OS é repartido entre os itens na proporção do valor de cada um, então a soma das notas bate com o total da OS. Uma OS pode ter uma nota de cada tipo ativa. Para emitir outra do mesmo tipo, cancele a anterior. A nota só pode ser emitida a partir de *Em andamento*, depois da aprovação do orçamento.

## Configuração da oficina (Configurações → Nota fiscal)

Vêm de *Empresa e marca*: CNPJ (CPF não emite), razão social, endereço com CEP e inscrição estadual (NF-e/NFC-e).

| Campo | Padrão | Observação |
|---|---|---|
| Ambiente | Homologação | Teste, sem valor fiscal. Troque para Produção depois de emitir uma nota de teste. |
| Regime tributário | Simples Nacional | MEI, Simples com excesso de sublimite, ou lucro presumido/real. |
| Inscrição municipal | — | Obrigatória para NFS-e. |
| Código IBGE do município | Preenchido pelo endereço | Consulta pública ao IBGE. |
| Item da lista de serviços | 14.01 | Lubrificação, conserto, manutenção de veículos (LC 116). |
| Alíquota do ISS | vazio | No Simples, a da faixa da oficina. |
| NCM padrão | 87089990 | Usado em peças sem NCM no catálogo. O catálogo tem o campo NCM por peça. |
| CFOP padrão | 5102 | Venda de mercadoria de terceiros. Cliente de outro estado vira 6102. |
| CSOSN | 102 | Simples sem permissão de crédito. Use 500 para peças com ICMS-ST. |
| CST PIS/COFINS | 49 | Outras operações de saída. |
| CSC da NFC-e | — | ID e código gerados no portal da SEFAZ do estado; o código fica criptografado. |

A NF-e e a NFC-e pelo Ofix atendem **Simples Nacional e MEI**. No lucro presumido ou real, a oficina emite no sistema fiscal dela e registra a nota na OS. Valide os padrões com o contador antes de ir para produção.

O **certificado A1** (.pfx/.p12) e a senha são enviados só pelo administrador e vão direto ao emissor. O Ofix não guarda nenhum dos dois, só a validade.

## Ativar no servidor

1. Contratar a Focus NFe como revenda (conta principal do Ofix).
2. Em `deploy/debian/.env.production`, preencher `FOCUS_NFE_TOKEN` com o token principal da conta.
3. Recriar só o backend:
   `docker compose --env-file deploy/debian/.env.production -f deploy/debian/compose.production.yml up -d backend`

Sem o token, a tela de configuração explica que a emissão não está ativa e as oficinas continuam registrando notas emitidas fora. `FOCUS_NFE_URL` e `FOCUS_NFE_HOMOLOGATION_URL` têm os endereços oficiais como padrão.

Ao enviar o certificado, o Ofix cadastra a oficina na Focus (`/v2/empresas`) e guarda, criptografados, os tokens de produção e homologação que ela devolve. Salvar a configuração fiscal depois disso atualiza o cadastro. Se o emissor recusar, o erro aparece na tela e a configuração continua salva.

## Fluxo técnico

- `POST api/v1/fiscal/documents/preview` mostra os itens, o total, os bloqueios de configuração (`blockers`), os problemas da OS (`problems`) e os avisos.
- `POST api/v1/fiscal/documents/issue` cria a nota como *Em processamento* com a referência `ofix-<id>` e envia. Recusa do emissor: *Rejeitada*, com a mensagem. Emissor fora do ar: continua em processamento, e *Atualizar* consulta de novo. Se o emissor nunca recebeu, vira *Rejeitada* e pode ser excluída.
- A tela consulta a cada 5 s enquanto houver nota em processamento.
- Cancelamento (`documents/cancel`) exige motivo de 15 a 255 caracteres e respeita o prazo da prefeitura ou SEFAZ. Notas registradas manualmente são marcadas como canceladas só no Ofix.
- Nota emitida não pode ser excluída, só cancelada. Registros manuais e tentativas rejeitadas podem ser excluídos.
- Permissões: configuração com `settings.view`/`settings.manage` (ADMIN, MANAGER). Certificado só ADMIN. Notas da OS com `receipts.manage` (mesmo público do recebimento).
- Arquivos de notas registradas ficam em `UPLOAD_DIR/<tenantId>/fiscal`, apagados junto com a oficina no encerramento da conta.
- Auditoria: `fiscal.settings_updated`, `fiscal.certificate_uploaded`, `fiscal.document_issued`, `fiscal.document_registered`, `fiscal.document_cancelled`, `fiscal.document_deleted`.

## Antes de ligar em produção

- Emitir em homologação uma NFS-e na cidade da oficina e conferir o PDF. Cada prefeitura tem particularidades (código de tributação municipal, alíquota obrigatória, formato do item da lista).
- Conferir com o contador CSOSN, CST e NCM padrão.
- Definir em qual plano a emissão integrada entra, já que a Focus cobra por CNPJ cadastrado. Hoje ela está liberada em todos os planos.
