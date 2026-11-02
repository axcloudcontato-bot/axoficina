// Limite mais restrito que o default global do ThrottlerModule — aplicado
// via @Throttle() em signup, login e accept-invite (spec: rate limiting
// básico contra brute-force/abuso nesses 3 endpoints).
// AUTH_THROTTLE_LIMIT só existe para o workflow de testes de navegador (e2e-browser.yml), em que todos os cadastros
// saem do mesmo IP; sem a variável vale 5 por minuto, como sempre.
export const AUTH_THROTTLE = { default: { limit: Number(process.env.AUTH_THROTTLE_LIMIT ?? 5), ttl: 60_000 } };
