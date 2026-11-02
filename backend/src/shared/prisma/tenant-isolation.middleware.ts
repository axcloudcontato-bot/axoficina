import { TenantContextService } from '../tenant-context/tenant-context.service';

// Modelos com coluna tenant_id — únicos que passam pelo filtro automático.
// Ao adicionar um model tenant-scoped em uma feature futura, inclua o nome
// aqui. ServiceOrderStatusHistory (Feature 5) NÃO entra aqui de propósito —
// não tem coluna tenant_id (só é lida/escrita por serviceOrderId, que já
// passou por um lookup tenant-scoped em ServiceOrder antes de chegar aqui);
// adicioná-la faria a extensão quebrar em runtime tentando injetar
// tenant_id numa tabela sem essa coluna. Ver plano ordem-de-servico.md.
export const TENANT_SCOPED_MODELS = new Set(['CustomerCareSettings', 'CustomerCarePlan', 'CustomerCareDelivery', 'ServiceOrderStatusNotification', 'CustomerReplyRead', 'CustomerMessage', 'PrivacyRequest', 'User', 'AuditLog', 'Customer', 'Vehicle', 'ServiceOrder', 'ServiceOrderWorkSession', 'ServiceOrderProductivityShare', 'TechnicianProductivityTarget', 'ServiceOrderPhoto', 'ServiceOrderReceipt', 'ServiceOrderInstallment', 'FinancialCategory', 'FinancialEntry', 'FinancialEntryPayment', 'FinancialEntryAttachment', 'FinancialReconciliation', 'FinancialCashBaseline', 'Supplier', 'MaintenanceAlert', 'Appointment', 'CatalogItem', 'StockMovement', 'CatalogPackage', 'MaintenanceAlertContact', 'CustomerCareContact', 'ServiceOrderWarrantyReturn', 'TechnicianCommissionRule', 'TechnicianIdleSession']);

// Models com coluna tenant_id que NÃO passam pelo filtro automático, cada um com o motivo. Todo model com
// tenantId no schema precisa estar neste mapa ou em TENANT_SCOPED_MODELS (tenant-isolation.middleware.spec.ts
// falha se um model novo ficar fora dos dois).
export const UNSCOPED_TENANT_MODELS: Record<string, string> = {
  Role: 'Papéis do sistema têm tenantId nulo e valem para todas as oficinas; RoleRepository filtra tenantId à mão.',
  BillingInvoice: 'Gravado pelo webhook do Stripe, que não tem contexto de oficina; a leitura filtra tenantId à mão.',
  AccountClosure: 'Registro do encerramento de conta, gravado por rotina do sistema e pela gestão do SaaS.',
};

// findFirst busca uma linha específica (normalmente por id/token hash) e é
// usada de propósito em fluxos sem autenticação ainda (refresh, logout —
// ver AuthManager). Nesses casos, sem contexto de tenant, a query passa
// sem filtro — aceitável porque o resultado já é uma linha só, localizada
// por uma chave que não colide entre tenants (UUID).
const SINGLE_ROW_READS = new Set(['findFirst', 'findFirstOrThrow']);

// findMany/count/aggregate/groupBy retornam um CONJUNTO — sem filtro de
// tenant, vazam dados de todos os tenants de uma vez. No código atual só
// são chamadas em rotas autenticadas (ex: UserRepository.listByTenant), e
// por isso, ao contrário de SINGLE_ROW_READS, falham em vez de rodar sem
// filtro se não houver contexto — é melhor quebrar alto (500) do que
// silenciosamente devolver a lista de todo mundo.
const UNBOUNDED_READS = new Set(['findMany', 'count', 'aggregate', 'groupBy']);

// updateMany aqui sempre roda com um `id` explícito no where (ver
// UserRepository.update) — inclusive em fluxos sem tenant context ainda
// (accept-invite). Mesmo raciocínio de SINGLE_ROW_READS: aceitável sem
// filtro quando não há contexto.
const WRITE_MANY_OPERATIONS = new Set(['updateMany', 'deleteMany']);
const CREATE_OPERATIONS = new Set(['create']);

// Operações por id único: com contexto de oficina, o id de outra oficina deixa de achar a linha (o Prisma lança
// "registro não encontrado") em vez de alterar ou apagar dados dela caso a conferência prévia do repositório
// seja esquecida. Sem contexto (jobs, convites, refresh) passam como antes.
const UNIQUE_OPERATIONS = new Set(['findUnique', 'findUniqueOrThrow', 'update', 'delete']);
const CREATE_MANY_OPERATIONS = new Set(['createMany', 'createManyAndReturn']);

interface QueryExtensionArgs {
  model?: string;
  operation: string;
  args: Record<string, unknown>;
  query: (args: Record<string, unknown>) => Promise<unknown>;
}

// Prisma Client Extension (não `$use` — removido a partir do Prisma 5) que
// injeta `tenant_id` automaticamente em toda query dos models acima, lendo
// do TenantContextService (AsyncLocalStorage). Repositories NUNCA devem usar
// `findUnique` em models tenant-scoped — só `findFirst`/`findMany`, que
// aceitam filtros arbitrários em `where` e por isso funcionam com a injeção.
export function tenantIsolationExtension(tenantContext: TenantContextService) {
  return {
    name: 'tenant-isolation',
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }: QueryExtensionArgs) {
          if (!model || !TENANT_SCOPED_MODELS.has(model)) {
            return query(args);
          }

          const tenantId = tenantContext.getStore()?.tenantId;

          if (!tenantId) {
            if (UNBOUNDED_READS.has(operation)) {
              throw new Error(
                `tenant-isolation: "${model}.${operation}" foi chamado sem um tenant context ativo — ` +
                  'esta operação retorna um conjunto sem limite e nunca deve rodar sem filtro de tenant.',
              );
            }
            return query(args);
          }

          if (SINGLE_ROW_READS.has(operation) || UNBOUNDED_READS.has(operation) || WRITE_MANY_OPERATIONS.has(operation) || UNIQUE_OPERATIONS.has(operation)) {
            args.where = { ...((args.where as Record<string, unknown>) ?? {}), tenantId };
          } else if (CREATE_OPERATIONS.has(operation)) {
            args.data = { ...((args.data as Record<string, unknown>) ?? {}), tenantId };
          } else if (CREATE_MANY_OPERATIONS.has(operation)) {
            const rows = args.data as Record<string, unknown> | Record<string, unknown>[];
            args.data = Array.isArray(rows) ? rows.map((row) => ({ ...row, tenantId })) : { ...rows, tenantId };
          }

          return query(args);
        },
      },
    },
  };
}
