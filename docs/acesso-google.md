# Cadastro e entrada com Google

O Ofix usa o botão oficial do Google Identity Services nas telas de cadastro e entrada. A conta Google fornece nome e e-mail confirmados. No primeiro acesso pela tela de entrada, o usuário segue para o cadastro com a conta Google já selecionada. Após aceitar os termos atuais, a conta é criada sem digitar nome, e-mail ou senha. O nome e CPF/CNPJ da oficina são informados na configuração inicial antes de usar o sistema. Contas criadas com Google entram pelo mesmo botão, sem senha.

## Configuração

1. No Google Cloud Console, crie ou selecione um projeto e configure a tela de consentimento.
2. Crie um **ID do cliente OAuth 2.0** do tipo **Aplicativo da Web**.
3. Adicione a URL pública do frontend em **Origens JavaScript autorizadas** (por exemplo, `https://ofix.axcloud.com.br`; no desenvolvimento, `http://localhost:3000`). Não é necessário configurar URI de redirecionamento para o botão em modo popup.
4. Defina o mesmo ID em `GOOGLE_CLIENT_ID` no backend e `NEXT_PUBLIC_GOOGLE_CLIENT_ID` no frontend. Na implantação Debian, basta definir `GOOGLE_CLIENT_ID` em `deploy/debian/.env.production` e reconstruir os serviços backend e frontend; o Compose repassa o valor público para a compilação do frontend.
5. Aplique a migração `61_google_identity` antes de atualizar a aplicação.

Sem o ID configurado, o botão não aparece e o cadastro por e-mail e senha continua disponível.

O servidor verifica a assinatura, emissor, público, expiração e confirmação do e-mail do token recebido do Google. A identidade é vinculada ao `sub` do Google; um e-mail igual ao de uma conta já existente não cria vínculo automático. Para encerrar uma oficina criada só com Google, o administrador pode confirmar novamente a conta Google no diálogo de encerramento.
