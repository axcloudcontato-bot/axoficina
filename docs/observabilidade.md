# Monitoramento de erros e disponibilidade

| O quê | Ferramenta | Como |
|---|---|---|
| Site e banco no ar | UptimeRobot | monitor HTTP em `https://ofix.axcloud.com.br/health` a cada 5 minutos (200 = ok, 503 = banco ou Redis fora) |
| Backup rodando | Healthchecks.io | opcional, veja `docs/backup-offsite.md` |
| Erros inesperados | Sentry (região UE) | este documento |

## Sentry

Só erros inesperados chegam ao Sentry: exceções não tratadas do backend (os 500) e erros de JavaScript não
capturados no navegador. Erros esperados (validação, permissão, login errado) nunca são enviados.

### O que sai do sistema

Antes de qualquer envio, o código apaga ou mascara (`backend/src/shared/observability/sentry.ts` e
`frontend/lib/sentry.ts`, com testes):

- usuário, IP, nome do servidor, cookies, cabeçalhos e corpo da requisição;
- parâmetros da URL; trechos de URL que parecem identificadores ou tokens viram `:id` e `:token`
  (links de convite e de pesquisa carregam um token);
- e-mails e CPF/CNPJ que apareçam em mensagens de erro (por exemplo, dentro de um erro do banco);
- rastro de ações (clicks, requisições, console): desligado. Sem gravação de sessão nem medição de desempenho.

Fica o essencial para consertar: a mensagem de erro já mascarada, o rastro do código (stack trace), a rota
com a forma genérica, o navegador e a versão.

### Ativar em produção

1. Crie a conta em sentry.io na **região da Europa** (a escolha é definitiva) e dois projetos: `ofix-backend`
   (Node.js) e `ofix-frontend` (Next.js/JavaScript). Copie o DSN de cada um (Settings → Client Keys).
2. No servidor, acrescente ao `deploy/debian/.env.production` (o DSN não vai para o Git):

   ```bash
   SENTRY_BACKEND_DSN=https://...@....ingest.de.sentry.io/...
   SENTRY_FRONTEND_DSN=https://...@....ingest.de.sentry.io/...
   ```

3. Publique. O DSN do frontend é gravado **durante o build**, então precisa reconstruir mesmo sem mudança de código:

   ```bash
   cd /opt/oficina-mecanica && git pull && bash deploy/debian/update.sh --force
   ```

Sem as variáveis, o Sentry fica desligado e nada é enviado.

### Conferir que funciona

Depois do deploy, abra o site, abra o console do navegador (F12) e rode `setTimeout(() => { throw new Error('teste sentry') })`.
O erro aparece em `ofix-frontend` no Sentry em até um minuto, com a URL sem parâmetros. Confira se o evento não
mostra e-mail, nome nem IP. Se aparecer algo pessoal, desligue (apague a variável e reconstrua) e corrija a limpeza.

### Alertas

No Sentry, em Alerts, crie uma regra "um problema novo apareceu" com aviso por e-mail para cada projeto. Sem
ela, os erros ficam guardados mas ninguém é avisado.

### LGPD

O Sentry passa a ser um operador de dados (recebe dados técnicos do navegador e do servidor). Os dados ficam
na UE e, com a limpeza acima, não incluem dados pessoais de oficinas nem de clientes finais. Isso deve constar
na Política de Privacidade (lista de operadores) e no contrato de tratamento de dados do Sentry (DPA), que
pode ser aceito no painel da conta. Ajustar o texto legal dentro do sistema exige trocar `LEGAL_VERSION`.
