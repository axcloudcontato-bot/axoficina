# Privacidade e LGPD no Ofix

Revisão do código: 24/10/2026. Versão dos documentos: `2026-10-24`.

## Entregas e pontos de acesso

| Recurso | Local |
| --- | --- |
| Política de privacidade | `/privacidade` |
| Termos de uso | `/termos` |
| Cookies e armazenamento local | `/cookies` e preferências no rodapé |
| Cancelamento e reembolso | `/reembolso` |
| Central do titular e atendimento | `/settings/privacy` |
| Textos das políticas | `frontend/features/privacy/legal-content.ts` |
| Registro de aceite | `users.legal_version`, `users.legal_accepted_at` |
| Protocolos | `privacy_requests` |
| Migração | `database/prisma/migrations/26_privacy_and_legal/migration.sql` |

Os documentos distinguem o fornecedor do SaaS (responsável pela contratação e conta) da oficina (controladora dos dados de clientes, colaboradores e serviços). O fornecedor atua como operador do acervo operacional da oficina. Não há checkout, cobrança recorrente nem estorno integrados nesta versão; os protocolos comerciais exigem execução e resposta pelo responsável, fora do processador de pagamento do sistema.

## Configuração da identificação do fornecedor

Preencher no ambiente de build do frontend, com dados reais:

```dotenv
NEXT_PUBLIC_LEGAL_COMPANY_NAME=
NEXT_PUBLIC_LEGAL_COMPANY_DOCUMENT=
NEXT_PUBLIC_LEGAL_COMPANY_ADDRESS=
NEXT_PUBLIC_PRIVACY_EMAIL=
```

O e-mail deve ser monitorado e atender também quem está sem acesso ao sistema. O canal público não pode depender apenas de login. Não foi inventado um endereço de contato: enquanto faltar identificação, as páginas exibem que são minutas de implantação. As variáveis públicas são incorporadas ao build; é necessário reconstruir o frontend após alterá-las. Dockerfile e arquivos Compose repassam esses valores ao build.

Aplicar a migração antes de iniciar o backend atualizado:

```powershell
pnpm --filter @oficina/contracts build
pnpm --filter @oficina/database migrate:deploy
pnpm --filter @oficina/database build
pnpm build
```

A migração é aditiva e não apaga dados pessoais existentes. Ajusta o índice parcial de documentos para permitir vários clientes sem CPF/CNPJ, representados por string vazia por compatibilidade com os contratos anteriores. Documento informado continua validado e único por oficina. Aceites anteriores não são fabricados: contas já existentes ficam com os novos campos nulos. Uma nova versão dos textos deve atualizar `LEGAL_VERSION`; novos cadastros e ativações por convite só aceitam a versão atual. Recolher aceite de contas antigas ou após mudança material exige comunicação e fluxo de nova adesão; não presumir aceite retroativo pelo simples uso.

## Inventário e minimização

| Fluxo | Dados necessários no sistema atual | Opcionais e cuidados |
| --- | --- | --- |
| Adesão da oficina | Nome da oficina, documento do contratante, nome e e-mail do administrador, senha | Identificação do contrato, sem pedir endereço residencial ou telefone adicional na adesão |
| Login | E-mail e senha | Sem consentimento genérico ou autorização de marketing |
| Convite de equipe | Nome, e-mail e perfil de acesso | Enviado por administrador; ativação exige aceite expresso |
| Cliente | Nome, telefone e tipo PF/PJ | CPF/CNPJ, e-mail, RG, IE, endereço e contato secundário só se houver finalidade específica |
| Endereço | Nenhum para cadastro básico | Consulta ViaCEP depende de clique e informa envio do CEP e dados técnicos da conexão; preenchimento manual disponível |
| Veículo e atendimento | Vínculo com cliente, identificação do veículo e dados do serviço | Chassi, fotos, checklist e notas devem se limitar ao necessário |
| Fotos | Imagens escolhidas pela equipe | Evitar rostos, documentos, objetos pessoais, geolocalização e dados alheios ao serviço; revisão humana dos anexos continua necessária |
| Financeiro/fornecedores | Dados necessários ao lançamento e identificação da contraparte | Não registrar cartão completo, credenciais bancárias ou dados sem relação com a transação |
| Pedidos LGPD | Tipo de pedido e identificador interno | Texto livre opcional e limitado; sem upload obrigatório de documento ou justificativa para arrependimento |
| Auditoria | Identificadores técnicos, ação, data e metadados operacionais permitidos | Lista positiva remove documento, e-mail, placa, destinatário, assunto e objetos arbitrários antes da fila e antes da persistência |

Limpar campos opcionais do formulário de cliente envia `null` em atualização e efetivamente remove os valores no banco. O endereço aceita somente propriedades previstas, com validação de campos desconhecidos. CPF/CNPJ pode ser corrigido ou removido com validação e proteção de unicidade. Não confundir a escolha de um canal de contato operacional com autorização de marketing.

Dados pessoais ainda podem existir em notas de OS, agenda, anexos, recibos, nomes originais de arquivos, PDFs exportados e mensagens enviadas. Há instruções de minimização nos formulários; o sistema não analisa semanticamente ou expurga automaticamente todo texto e imagem. A lista positiva de auditoria também se aplica a eventos legados pendentes quando forem processados, mas cópias em jobs já concluídos ou falhos exigem tratamento operacional de retenção da fila.

## Cookies e tecnologias semelhantes

Não foram localizados tags de analytics, pixels publicitários ou ferramentas de rastreamento no código auditado. Não se solicita autorização genérica para instalar integrações futuras.

| Chave local | Finalidade | Duração |
| --- | --- | --- |
| `oficina-auth` | Tokens e dados básicos da sessão | Até saída/limpeza; tokens expiram no servidor |
| `theme` | Tema solicitado pelo usuário | Até alteração/limpeza |
| `oficina.sidebar.collapsed` | Menu escolhido pelo usuário | Até alteração/limpeza |
| `service-orders-view` | Visão de OS escolhida pelo usuário | Até alteração/limpeza |
| `ax-privacy-choice` | Versão, data e escolha de somente necessários | 180 dias; escolhas inválidas, vencidas ou de outra versão reapresentam o aviso |

As preferências podem ser reabertas no rodapé. Falha de localStorage não habilita opcionais. Serviços de borda/proxy/hospedagem podem acrescentar cookies e precisam ser inventariados na implantação. Qualquer ferramenta futura baseada em consentimento precisa de finalidade e categoria específicas, bloqueio prévio, escolha positiva, rejeição equivalente e revogação efetiva. O simples registro deste aviso não constitui uma plataforma genérica de consentimento para scripts futuros.

## Atendimento dos direitos

1. O titular autenticado cria pedido próprio e acompanha os seus protocolos. Um administrador com permissões atuais pode registrar pedido em nome de cliente e gerir a fila da própria oficina. Não se expõem solicitações de outras oficinas.
2. Quem não possui conta ou perdeu acesso deve usar o contato público ou a própria oficina. O fornecedor precisa manter esse canal fora da aplicação. A Central não envia e-mail automaticamente ao fornecedor: o administrador deve encaminhar os pedidos de responsabilidade dele e acompanhar a resposta.
3. Verificar identidade e representação com o mínimo necessário; começar por canal já confirmado e referência de atendimento. Não solicitar cópia integral de documento por padrão.
4. A confirmação/acesso simplificado deve ser imediato quando possível. A declaração completa de acesso observa até 15 dias do art. 19. Para os demais tipos, `due_at` é meta de acompanhamento de 15 dias, sem criar um prazo legal geral de eliminação ou postergar arrependimento/estorno. Pedidos de arrependimento exigem encaminhamento imediato ao responsável comercial.
5. Exportação própria contém somente o cadastro da conta, nunca hash de senha, tokens ou segredo MFA. A exportação cadastral do cliente exclui notas e contatos secundários de terceiros. Para a resposta completa, revisar histórico, anexos, origem dos dados e compartilhamentos; a exportação automática parcial não substitui a declaração completa.
6. Respostas devem indicar a providência já executada ou a análise em curso. Conservar dados exige identificar quais dados, finalidade/base legal e data futura de revisão. Pedidos em conservação podem ser reabertos. Não alegar que a mera existência de uma OS autoriza retenção indefinida.
7. Cancelamento e reembolso são protocolos distintos da eliminação de dados. Registrar resposta não executa cobrança, cancelamento no gateway ou estorno financeiro.

## Exclusão de dados

**Arquivamento:** o botão anterior de exclusão de cliente continua fazendo soft delete e agora informa que arquivar não elimina dados. Usuários e outros cadastros arquivados também não devem ser considerados eliminados apenas por terem `deleted_at` preenchido.

**Cliente isolado:** a execução exige administrador com `customers.manage` e `settings.manage`, pedido de exclusão aberto, senha atual e confirmação `EXCLUIR`. A transação serializável verifica vínculos de veículos, OS, agendamentos, lançamentos financeiros e alertas, inclusive arquivados. Se houver vínculo, mantém os dados e o pedido aberto para revisão. Sem vínculos, limpa identificação, documento, telefones, endereço, notas, RG, IE, contato secundário e preferências na base ativa, remove metadados legados do cadastro em auditoria, limpa texto livre dos protocolos associados e registra a operação. Mantém uma linha técnica sem os campos pessoais para rastreabilidade; não declara anonimização irreversível de todo o ecossistema.

**Própria conta:** exige pedido de exclusão próprio, senha e confirmação `EXCLUIR`. Limpa identificação, senha, convite e segredos MFA; invalida acesso pela situação da conta e remove tokens de renovação. Mantém identificador técnico e evidência de aceite, sujeitos à necessidade de conservação pelo controlador. O último administrador deve transferir a administração antes ou solicitar encerramento assistido de toda a oficina. A operação não apaga o acervo de clientes da empresa. A sessão e o cache locais são encerrados após execução; entrar/sair de contas também limpa o cache de consultas.

**Acervo vinculado e encerramento da oficina:** exigem execução assistida pelo responsável, que deve:

- identificar base legal e necessidade de cada documento/registro, separando dados excessivos dos sujeitos a conservação;
- revisar texto livre, imagens e metadados de arquivos, documentos emitidos, filas, e-mails, integrações e exportações;
- apagar ou desidentificar dados sem fundamento de guarda, inclusive registros arquivados;
- restringir acesso a registros conservados, definir revisão e eliminação ao fim da obrigação;
- comunicar correção/eliminação/bloqueio aos destinatários quando exigido pelo art. 18, §6º;
- registrar evidências da execução e informar ao titular as limitações e o que permaneceu.

O sistema bloqueia marcar pedidos de exclusão como concluídos apenas pela escrita de uma resposta administrativa. As rotinas automáticas de cadastro isolado e própria conta encerram o respectivo protocolo. A conclusão de uma exclusão assistida de todo o acervo precisa ser documentada pelo responsável com evidência da execução; não há rotina genérica de eliminação de tenant implementada nesta entrega.

## Retenção e operação a definir para publicação

As durações fiscais e contratuais dependem dos documentos, obrigações e operação da empresa. Não foi criado um prazo único arbitrário para todos os dados.

| Conjunto | Regra a documentar pelo responsável |
| --- | --- |
| Cadastro e contatos | Finalidade ativa, revisão de necessidade e atendimento a pedidos; arquivamento não encerra a obrigação de revisão |
| OS, recibos e financeiro | Base legal por documento, prazo aplicável, acesso restrito e destino após a obrigação |
| Auditoria e aceite | Finalidade de segurança/prova, avaliação de necessidade, prazo de retenção e revisão |
| Protocolos LGPD/comerciais | Evidência mínima de atendimento, prazo e expurgo do texto livre desnecessário |
| Sessões expiradas/revogadas | Limpeza periódica dos tokens e metadados; conta excluída remove seus tokens na operação |
| Filas Redis | Retenção limitada de jobs concluídos/falhos, inspeção de payloads antigos e limpeza aprovada |
| Backups | Janela real de expiração, controle de acesso e registro de exclusões para reaplicar após restauração |
| Exportações/mensagens | Responsável, destinatário, finalidade e descarte das cópias sob controle da oficina |

Não há promessa de expurgo automático de todos esses conjuntos. Definir os períodos reais, monitorar os prazos e implementar o descarte com evidência é parte da operação, além do código entregue. Registrar fornecedores de hospedagem, SMTP, backup, borda/proxy, países de tratamento e mecanismo de transferência internacional quando aplicável. Formalizar instruções controlador–operador e responsabilidades por incidentes. Tokens continuam em localStorage, conforme a arquitetura existente; migração futura para sessão com cookies HttpOnly deve ser tratada como mudança de autenticação, com seus controles próprios.

## Validação da implementação

Foram executados build de contratos, geração do Prisma Client, builds de backend/frontend, testes unitários existentes e novos de minimização de auditoria e preferências, e a suíte HTTP de integração completa. Os testes HTTP rodaram em schema PostgreSQL e prefixo Redis isolados; esses recursos temporários foram removidos ao final. A migração `26_privacy_and_legal` foi aplicada também ao banco local de desenvolvimento, sem executar rotinas de exclusão sobre seus dados reais.

A verificação em Chromium cobriu acesso público às quatro políticas, persistência da escolha de cookies, reabertura de preferências, aceite inicialmente desmarcado, layout mobile e fluxo da Central até encerramento da sessão após exclusão (com API simulada no teste de interface). A exclusão efetiva e a revogação no servidor foram verificadas separadamente nos testes HTTP com banco real isolado. Capturas de conferência estão em `frontend/artifacts/privacy-desktop.png`, `privacy-mobile.png` e `privacy-center.png`.

Os builds ainda emitem avisos preexistentes de dependências de hooks nas telas de OS e no menu do cabeçalho, além de aviso da configuração legada do Prisma; não impediram a compilação. Os valores de identificação do fornecedor continuam pendentes de fornecimento pelo responsável.

## Referências legais

- [LGPD — arts. 6º a 10, 15 a 19, 33 a 36 e 46 a 49](https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709compilado.htm).
- [CDC — arts. 46, 49 e 51](https://www.planalto.gov.br/ccivil_03/leis/l8078compilado.htm).
- [ANPD — Guia de cookies e proteção de dados pessoais](https://www.gov.br/anpd/pt-br/centrais-de-conteudo/materiais-educativos-e-publicacoes/guia_orientativo_cookies_e_protecao_de_dados_pessoais).

Os textos e controles implementam medidas concretas de transparência e minimização. A identificação pendente do fornecedor, os prestadores/países e os períodos operacionais devem ser preenchidos e validados conforme a operação real antes da publicação; a entrega não constitui certificação geral de conformidade do negócio.
