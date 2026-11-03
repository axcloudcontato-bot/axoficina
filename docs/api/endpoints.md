# Endpoints da API

> Gerado a partir dos controllers do backend. Não edite à mão: rode `UPDATE_API_DOCS=1 pnpm --filter @oficina/backend exec jest src/shared/api-docs`
> depois de mudar uma rota ou seus decorators. O teste `api-docs.spec.ts` falha se este arquivo ficar desatualizado.

São 162 endpoints em 25 controllers.

## Convenções

- Todas as rotas ficam sob `/api/v1`, exceto `GET /health`. O estilo é RPC: a maioria das ações, inclusive as de leitura com filtros, é `POST`.
- O corpo e as respostas trafegam em `snake_case`; o backend converte de e para `camelCase` internamente.
- Autenticação: cabeçalho `Authorization: Bearer <token de acesso>`, obtido em `POST /api/v1/auth/login`. Rotas "público" não exigem token.
- **Quem acessa** lista os papéis aceitos (`@Roles`). **Permissão** é a permissão exigida (`@Permissions`), além do papel. **Módulo/limite** indica o módulo do plano e o limite do plano aplicados.
- Erros voltam como `{ "error": { "code", "message", "status", "details?" } }`.
- Os formatos de entrada e saída estão nos DTOs de `backend/src/modules/*/dto` e nos tipos de `packages/contracts`.

## health/csp-report.controller.ts

| Método | Rota | Ação | Quem acessa | Permissão | Módulo/limite |
| --- | --- | --- | --- | --- | --- |
| POST | `/api/v1/csp-report` | `report` | público |  |  |

## health/health.controller.ts

| Método | Rota | Ação | Quem acessa | Permissão | Módulo/limite |
| --- | --- | --- | --- | --- | --- |
| GET | `/health` | `check` | público |  |  |

## modules/account-closure/account-closure.controller.ts

| Método | Rota | Ação | Quem acessa | Permissão | Módulo/limite |
| --- | --- | --- | --- | --- | --- |
| POST | `/api/v1/account/close` | `close` | qualquer usuário autenticado |  |  |

## modules/appointments/controllers/appointments.controller.ts

| Método | Rota | Ação | Quem acessa | Permissão | Módulo/limite |
| --- | --- | --- | --- | --- | --- |
| GET | `/api/v1/appointments/reminder-health` | `reminderHealth` | ADMIN, MANAGER | settings.view |  |
| POST | `/api/v1/appointments/reminder-retry` | `retryReminder` | ADMIN, MANAGER | appointments.manage |  |
| POST | `/api/v1/appointments` | `create` | ADMIN, MANAGER, FRONT_DESK, MECHANIC | appointments.manage | limite write |
| POST | `/api/v1/appointments/update` | `update` | ADMIN, MANAGER, FRONT_DESK, MECHANIC | appointments.manage |  |
| POST | `/api/v1/appointments/list` | `list` | ADMIN, MANAGER, FRONT_DESK, MECHANIC | appointments.view |  |
| POST | `/api/v1/appointments/transition` | `transition` | ADMIN, MANAGER, FRONT_DESK, MECHANIC | appointments.manage |  |
| POST | `/api/v1/appointments/notify` | `notify` | ADMIN, MANAGER, FRONT_DESK, MECHANIC | appointments.manage |  |
| POST | `/api/v1/appointments/start` | `start` | ADMIN, MANAGER, FRONT_DESK, MECHANIC | appointments.manage |  |

## modules/billing/billing-webhook.controller.ts

| Método | Rota | Ação | Quem acessa | Permissão | Módulo/limite |
| --- | --- | --- | --- | --- | --- |
| POST | `/api/v1/webhooks/billing` | `receive` | público |  |  |

## modules/billing/billing.controller.ts

| Método | Rota | Ação | Quem acessa | Permissão | Módulo/limite |
| --- | --- | --- | --- | --- | --- |
| GET | `/api/v1/billing/Cache-Control` | `status` | qualquer usuário autenticado |  |  |
| GET | `/api/v1/billing/invoices` | `invoices` | qualquer usuário autenticado |  |  |
| POST | `/api/v1/billing/checkout` | `checkout` | qualquer usuário autenticado |  |  |
| POST | `/api/v1/billing/portal` | `portal` | qualquer usuário autenticado |  |  |
| POST | `/api/v1/billing/cancel` | `cancel` | qualquer usuário autenticado |  |  |

## modules/customer-care/customer-care.controller.ts

| Método | Rota | Ação | Quem acessa | Permissão | Módulo/limite |
| --- | --- | --- | --- | --- | --- |
| GET | `/api/v1/customer-care/alerts.view` | `dashboard` | qualquer usuário autenticado |  |  |
| GET | `/api/v1/customer-care/forecast` | `forecastContacts` | qualquer usuário autenticado |  |  |
| POST | `/api/v1/customer-care/settings` | `settings` | qualquer usuário autenticado |  |  |
| POST | `/api/v1/customer-care/services` | `record` | qualquer usuário autenticado |  |  |
| POST | `/api/v1/customer-care/preview` | `preview` | qualquer usuário autenticado |  |  |
| POST | `/api/v1/customer-care/retry` | `retry` | qualquer usuário autenticado |  |  |
| POST | `/api/v1/customer-care/deliveries/resolve` | `resolveDelivery` | qualquer usuário autenticado |  |  |
| GET | `/api/v1/customer-care/plans` | `plansPage` | qualquer usuário autenticado |  |  |
| POST | `/api/v1/customer-care/plans/contact` | `recordContact` | qualquer usuário autenticado |  |  |
| POST | `/api/v1/customer-care/plans/contacts` | `planContacts` | qualquer usuário autenticado |  |  |
| GET | `/api/v1/customer-care/deliveries` | `deliveries` | qualquer usuário autenticado |  |  |
| POST | `/api/v1/customer-care/test-send` | `testSend` | qualquer usuário autenticado |  |  |

## modules/customers/controllers/customers.controller.ts

| Método | Rota | Ação | Quem acessa | Permissão | Módulo/limite |
| --- | --- | --- | --- | --- | --- |
| POST | `/api/v1/customers` | `create` | ADMIN, MANAGER, FRONT_DESK | customers.manage | limite write |
| POST | `/api/v1/customers/update` | `update` | ADMIN, MANAGER, FRONT_DESK | customers.manage |  |
| POST | `/api/v1/customers/delete` | `delete` | ADMIN, MANAGER, FRONT_DESK | customers.manage |  |
| POST | `/api/v1/customers/merge` | `merge` | ADMIN, MANAGER | customers.manage |  |
| POST | `/api/v1/customers/import` | `importRows` | ADMIN, MANAGER, FRONT_DESK | customers.manage | limite write |
| POST | `/api/v1/customers/restore` | `restore` | ADMIN, MANAGER, FRONT_DESK | customers.manage |  |
| POST | `/api/v1/customers/archive-impact` | `archiveImpact` | ADMIN, MANAGER, FRONT_DESK | customers.manage |  |
| GET | `/api/v1/customer` | `get` | ADMIN, MANAGER, FRONT_DESK, MECHANIC | customers.view |  |
| POST | `/api/v1/customers/list` | `list` | ADMIN, MANAGER, FRONT_DESK, MECHANIC | customers.view |  |
| POST | `/api/v1/customers/overview` | `overview` | ADMIN, MANAGER, FRONT_DESK, MECHANIC | customers.view |  |

## modules/fipe/controllers/fipe.controller.ts

| Método | Rota | Ação | Quem acessa | Permissão | Módulo/limite |
| --- | --- | --- | --- | --- | --- |
| GET | `/api/v1/fipe/brands` | `brands` | ADMIN, MANAGER, FRONT_DESK, MECHANIC | vehicles.view |  |
| GET | `/api/v1/fipe/models` | `models` | ADMIN, MANAGER, FRONT_DESK, MECHANIC | vehicles.view |  |
| POST | `/api/v1/fipe/sync` | `sync` | ADMIN | vehicles.manage |  |

## modules/iam/controllers/auth.controller.ts

| Método | Rota | Ação | Quem acessa | Permissão | Módulo/limite |
| --- | --- | --- | --- | --- | --- |
| POST | `/api/v1/auth/signup` | `signup` | público |  |  |
| POST | `/api/v1/auth/google/signup` | `googleSignup` | público |  |  |
| POST | `/api/v1/auth/google/login` | `googleLogin` | público |  |  |
| POST | `/api/v1/auth/login` | `login` | público |  |  |
| POST | `/api/v1/auth/refresh` | `refresh` | público |  |  |
| POST | `/api/v1/auth/forgot-password` | `forgotPassword` | público |  |  |
| POST | `/api/v1/auth/reset-password` | `resetPassword` | público |  |  |
| POST | `/api/v1/auth/change-password` | `changePassword` | qualquer usuário autenticado |  |  |
| POST | `/api/v1/auth/sessions` | `sessions` | qualquer usuário autenticado |  |  |
| POST | `/api/v1/auth/sessions/revoke` | `revokeSession` | qualquer usuário autenticado |  |  |
| POST | `/api/v1/auth/sessions/revoke-others` | `revokeOtherSessions` | qualquer usuário autenticado |  |  |
| POST | `/api/v1/auth/logout` | `logout` | público |  |  |

## modules/iam/controllers/users.controller.ts

| Método | Rota | Ação | Quem acessa | Permissão | Módulo/limite |
| --- | --- | --- | --- | --- | --- |
| POST | `/api/v1/users/invite` | `invite` | ADMIN, MANAGER | team.manage | limite users |
| POST | `/api/v1/users/accept-invite` | `acceptInvite` | público |  |  |
| POST | `/api/v1/users/list` | `list` | ADMIN, MANAGER | team.view |  |
| POST | `/api/v1/users/rename` | `rename` | ADMIN, MANAGER | team.manage |  |
| POST | `/api/v1/users/disable` | `disable` | ADMIN, MANAGER | team.manage |  |
| POST | `/api/v1/users/delete` | `delete` | ADMIN, MANAGER | team.manage |  |

## modules/maintenance-alerts/controllers/maintenance-alerts.controller.ts

| Método | Rota | Ação | Quem acessa | Permissão | Módulo/limite |
| --- | --- | --- | --- | --- | --- |
| POST | `/api/v1/maintenance-alerts/list` | `list` | ADMIN, MANAGER, FRONT_DESK, MECHANIC | alerts.view |  |
| POST | `/api/v1/maintenance-alerts/resolve` | `resolve` | ADMIN, MANAGER, FRONT_DESK, MECHANIC | alerts.manage |  |
| POST | `/api/v1/maintenance-alerts/snooze` | `snooze` | ADMIN, MANAGER, FRONT_DESK, MECHANIC | alerts.manage |  |
| POST | `/api/v1/maintenance-alerts/dismiss` | `dismiss` | ADMIN, MANAGER, FRONT_DESK, MECHANIC | alerts.manage |  |
| POST | `/api/v1/maintenance-alerts/reopen` | `reopen` | ADMIN, MANAGER, FRONT_DESK, MECHANIC | alerts.manage |  |
| POST | `/api/v1/maintenance-alerts/contact` | `recordContact` | ADMIN, MANAGER, FRONT_DESK, MECHANIC | alerts.manage |  |
| POST | `/api/v1/maintenance-alerts/contacts` | `contacts` | ADMIN, MANAGER, FRONT_DESK, MECHANIC | alerts.view |  |

## modules/privacy/privacy.controller.ts

| Método | Rota | Ação | Quem acessa | Permissão | Módulo/limite |
| --- | --- | --- | --- | --- | --- |
| POST | `/api/v1/privacy/requests` | `create` | qualquer usuário autenticado |  |  |
| GET | `/api/v1/privacy/requests` | `list` | qualquer usuário autenticado |  |  |
| GET | `/api/v1/privacy/requests/manage` | `manage` | qualquer usuário autenticado |  |  |
| POST | `/api/v1/privacy/requests/resolve` | `resolve` | qualquer usuário autenticado |  |  |
| GET | `/api/v1/privacy/export` | `exportSelf` | qualquer usuário autenticado |  |  |
| POST | `/api/v1/privacy/customers/export` | `exportCustomer` | qualquer usuário autenticado |  |  |
| POST | `/api/v1/privacy/customers/erase` | `erase` | qualquer usuário autenticado |  |  |
| POST | `/api/v1/privacy/account/erase` | `eraseAccount` | qualquer usuário autenticado |  |  |

## modules/service-orders/controllers/customer-messages.controller.ts

| Método | Rota | Ação | Quem acessa | Permissão | Módulo/limite |
| --- | --- | --- | --- | --- | --- |
| POST | `/api/v1/service-orders/customer-messages` | `create` | ADMIN, MANAGER, FRONT_DESK, MECHANIC | service_orders.manage, service_orders.prices |  |
| POST | `/api/v1/service-orders/customer-messages/confirm-dispatch` | `confirmDispatch` | ADMIN, MANAGER, FRONT_DESK, MECHANIC | service_orders.manage, service_orders.prices |  |
| GET | `/api/v1/service-orders/customer-messages` | `list` | ADMIN, MANAGER, FRONT_DESK, MECHANIC | service_orders.view, service_orders.prices |  |
| GET | `/api/v1/public/customer-message` | `get` | público |  |  |
| POST | `/api/v1/public/customer-message/answer` | `answer` | público |  |  |

## modules/service-orders/controllers/customer-reply-notifications.controller.ts

| Método | Rota | Ação | Quem acessa | Permissão | Módulo/limite |
| --- | --- | --- | --- | --- | --- |
| GET | `/api/v1/customer-reply-notifications` | `list` | qualquer usuário autenticado |  |  |
| POST | `/api/v1/customer-reply-notifications/:id/read` | `markRead` | qualquer usuário autenticado |  |  |

## modules/service-orders/controllers/service-order-status-notifications.controller.ts

| Método | Rota | Ação | Quem acessa | Permissão | Módulo/limite |
| --- | --- | --- | --- | --- | --- |
| POST | `/api/v1/service-orders/status-notifications/list` | `list` | qualquer usuário autenticado |  |  |
| POST | `/api/v1/service-orders/status-notifications/retry` | `retry` | qualquer usuário autenticado |  |  |

## modules/service-orders/controllers/service-orders.controller.ts

| Método | Rota | Ação | Quem acessa | Permissão | Módulo/limite |
| --- | --- | --- | --- | --- | --- |
| POST | `/api/v1/service-orders` | `create` | ADMIN, MANAGER, FRONT_DESK, MECHANIC | service_orders.manage | limite orders |
| POST | `/api/v1/service-orders/update` | `update` | ADMIN, MANAGER, FRONT_DESK, MECHANIC | service_orders.manage |  |
| POST | `/api/v1/service-orders/transition` | `transition` | ADMIN, MANAGER, FRONT_DESK, MECHANIC | service_orders.manage |  |
| POST | `/api/v1/service-orders/delete` | `delete` | ADMIN, MANAGER, FRONT_DESK, MECHANIC | service_orders.manage |  |
| GET | `/api/v1/service-order` | `get` | ADMIN, MANAGER, FRONT_DESK, MECHANIC | service_orders.view |  |
| POST | `/api/v1/service-orders/list` | `list` | ADMIN, MANAGER, FRONT_DESK, MECHANIC | service_orders.view |  |
| GET | `/api/v1/dashboard/today` | `dashboardToday` | ADMIN, MANAGER, FRONT_DESK, MECHANIC | service_orders.view |  |
| GET | `/api/v1/dashboard/business-summary` | `businessSummary` | ADMIN, MANAGER, FRONT_DESK, MECHANIC | finance.view |  |
| POST | `/api/v1/service-orders/technician-productivity` | `technicianProductivity` | ADMIN, MANAGER, FRONT_DESK | service_orders.prices | módulo produtividade |
| POST | `/api/v1/service-orders/technician-productivity/trend` | `productivityTrend` | ADMIN, MANAGER, FRONT_DESK | service_orders.prices | módulo produtividade |
| GET | `/api/v1/service-orders/warranty-return` | `warrantyReturn` | ADMIN, MANAGER, FRONT_DESK, MECHANIC | service_orders.view |  |
| POST | `/api/v1/service-orders/warranty-return` | `markWarrantyReturn` | ADMIN, MANAGER, FRONT_DESK | service_orders.manage |  |
| POST | `/api/v1/service-orders/technician-productivity/commissions` | `commissions` | ADMIN, MANAGER | service_orders.prices | módulo produtividade |
| POST | `/api/v1/service-orders/technician-productivity/commission-rule` | `setCommissionRule` | ADMIN, MANAGER | service_orders.prices | módulo produtividade |
| GET | `/api/v1/service-orders/idle-time` | `myIdle` | ADMIN, MANAGER, FRONT_DESK, MECHANIC | service_orders.view |  |
| POST | `/api/v1/service-orders/idle-time/start` | `startIdle` | MECHANIC | service_orders.view |  |
| POST | `/api/v1/service-orders/idle-time/stop` | `stopIdle` | MECHANIC | service_orders.view |  |
| POST | `/api/v1/service-orders/technician-productivity/me` | `myProductivity` | ADMIN, MANAGER, FRONT_DESK, MECHANIC | service_orders.view |  |
| POST | `/api/v1/service-orders/productivity-target/copy` | `copyProductivityTargets` | ADMIN, MANAGER | service_orders.prices | módulo produtividade |
| POST | `/api/v1/service-orders/work-sessions/correct` | `correctWorkSession` | ADMIN, MANAGER | service_orders.prices |  |
| POST | `/api/v1/service-orders/technician-productivity/orders` | `technicianProductivityOrders` | ADMIN, MANAGER, FRONT_DESK | service_orders.prices | módulo produtividade |
| POST | `/api/v1/service-orders/productivity-target` | `setProductivityTarget` | ADMIN, MANAGER | service_orders.prices | módulo produtividade |
| GET | `/api/v1/service-orders/work-sessions` | `workSessions` | ADMIN, MANAGER, FRONT_DESK, MECHANIC | service_orders.view |  |
| POST | `/api/v1/service-orders/work-sessions/start` | `startWork` | ADMIN, MANAGER, FRONT_DESK, MECHANIC | service_orders.manage |  |
| POST | `/api/v1/service-orders/work-sessions/stop` | `stopWork` | ADMIN, MANAGER, FRONT_DESK, MECHANIC | service_orders.manage |  |
| POST | `/api/v1/service-orders/items` | `addItem` | ADMIN, MANAGER, FRONT_DESK | service_orders.prices |  |
| POST | `/api/v1/service-orders/items/update` | `updateItem` | ADMIN, MANAGER, FRONT_DESK | service_orders.prices |  |
| POST | `/api/v1/service-orders/items/delete` | `deleteItem` | ADMIN, MANAGER, FRONT_DESK | service_orders.prices |  |
| POST | `/api/v1/service-orders/receipts` | `confirmReceipt` | ADMIN, MANAGER, FRONT_DESK | receipts.manage |  |
| POST | `/api/v1/service-orders/receipts/delete` | `deleteReceipt` | ADMIN, MANAGER, FRONT_DESK | receipts.manage |  |
| POST | `/api/v1/service-orders/payment/configure` | `configurePayment` | ADMIN, MANAGER, FRONT_DESK | receipts.manage |  |
| POST | `/api/v1/service-orders/installments/confirm` | `confirmInstallment` | ADMIN, MANAGER, FRONT_DESK | receipts.manage |  |
| POST | `/api/v1/service-orders/installments/due` | `dueInstallments` | ADMIN, MANAGER, FRONT_DESK | receipts.manage |  |
| GET | `/api/v1/service-orders/photos` | `listPhotos` | ADMIN, MANAGER, FRONT_DESK, MECHANIC | service_orders.view |  |
| GET | `/api/v1/service-orders/photos/content` | `photoContent` | ADMIN, MANAGER, FRONT_DESK, MECHANIC | service_orders.view |  |
| POST | `/api/v1/service-orders/photos` | `uploadPhoto` | ADMIN, MANAGER, FRONT_DESK, MECHANIC | service_orders.manage | limite photos |
| POST | `/api/v1/service-orders/photos/delete` | `deletePhoto` | ADMIN, MANAGER, FRONT_DESK, MECHANIC | service_orders.manage |  |

## modules/service-orders/controllers/wa-akg-webhook.controller.ts

| Método | Rota | Ação | Quem acessa | Permissão | Módulo/limite |
| --- | --- | --- | --- | --- | --- |
| POST | `/api/v1/webhooks/wa-akg/:tenantId` | `receive` | público |  |  |

## modules/settings/controllers/settings.controller.ts

| Método | Rota | Ação | Quem acessa | Permissão | Módulo/limite |
| --- | --- | --- | --- | --- | --- |
| GET | `/api/v1/settings/settings.view` | `get` | qualquer usuário autenticado |  |  |
| GET | `/api/v1/settings/branding` | `branding` | qualquer usuário autenticado |  |  |
| POST | `/api/v1/settings/onboarding/complete` | `completeOnboarding` | qualquer usuário autenticado |  |  |
| POST | `/api/v1/settings/company` | `updateCompany` | qualquer usuário autenticado |  |  |
| POST | `/api/v1/settings/labor-rate` | `updateLaborRate` | qualquer usuário autenticado |  |  |
| POST | `/api/v1/settings/order-defaults` | `updateOrderDefaults` | qualquer usuário autenticado |  |  |
| POST | `/api/v1/settings/maintenance-alert-months` | `updateMaintenanceAlertMonths` | qualquer usuário autenticado |  |  |
| POST | `/api/v1/settings/agenda-hours` | `updateAgendaHours` | qualquer usuário autenticado |  |  |
| POST | `/api/v1/settings/photo-policy` | `updatePhotoPolicy` | qualquer usuário autenticado |  |  |
| POST | `/api/v1/settings/email` | `updateEmail` | qualquer usuário autenticado |  |  |
| POST | `/api/v1/settings/email/test` | `testEmail` | qualquer usuário autenticado |  |  |
| POST | `/api/v1/settings/email/send` | `sendEmail` | qualquer usuário autenticado |  |  |

## modules/settings/controllers/whatsapp-settings.controller.ts

| Método | Rota | Ação | Quem acessa | Permissão | Módulo/limite |
| --- | --- | --- | --- | --- | --- |
| GET | `/api/v1/settings/whatsapp/settings.view` | `get` | qualquer usuário autenticado |  |  |
| POST | `/api/v1/settings/whatsapp/settings.manage` | `update` | qualquer usuário autenticado |  |  |
| POST | `/api/v1/settings/whatsapp/test` | `test` | qualquer usuário autenticado |  |  |
| POST | `/api/v1/settings/whatsapp/webhook/test` | `testWebhook` | qualquer usuário autenticado |  |  |

## modules/settings/controllers/workshop-account.controller.ts

| Método | Rota | Ação | Quem acessa | Permissão | Módulo/limite |
| --- | --- | --- | --- | --- | --- |
| GET | `/api/v1/settings/subscription` | `subscription` | qualquer usuário autenticado |  |  |
| POST | `/api/v1/settings/audit-log` | `history` | qualquer usuário autenticado |  |  |
| GET | `/api/v1/settings/export/:dataset` | `export` | qualquer usuário autenticado |  |  |

## modules/subscriptions/subscriptions.controller.ts

| Método | Rota | Ação | Quem acessa | Permissão | Módulo/limite |
| --- | --- | --- | --- | --- | --- |
| GET | `/api/v1/admin/access` | `access` | qualquer usuário autenticado |  |  |
| GET | `/api/v1/admin/subscriptions` | `list` | administrador do SaaS |  |  |
| PATCH | `/api/v1/admin/subscriptions/:id` | `update` | administrador do SaaS |  |  |
| POST | `/api/v1/admin/subscriptions/:id/close` | `close` | administrador do SaaS |  |  |
| POST | `/api/v1/admin/subscriptions/:id/restore` | `restore` | administrador do SaaS |  |  |
| POST | `/api/v1/admin/subscriptions/:id/purge` | `purge` | administrador do SaaS |  |  |

## modules/support/support.controller.ts

| Método | Rota | Ação | Quem acessa | Permissão | Módulo/limite |
| --- | --- | --- | --- | --- | --- |
| GET | `/api/v1/support/tickets` | `list` | qualquer usuário autenticado |  |  |
| POST | `/api/v1/support/tickets` | `create` | qualquer usuário autenticado |  |  |
| GET | `/api/v1/admin/support/tickets` | `list` | administrador do SaaS |  |  |
| PATCH | `/api/v1/admin/support/tickets/:id` | `update` | administrador do SaaS |  |  |

## modules/vehicles/controllers/vehicles.controller.ts

| Método | Rota | Ação | Quem acessa | Permissão | Módulo/limite |
| --- | --- | --- | --- | --- | --- |
| POST | `/api/v1/vehicles` | `create` | ADMIN, MANAGER, FRONT_DESK | vehicles.manage | limite write |
| POST | `/api/v1/vehicles/update` | `update` | ADMIN, MANAGER, FRONT_DESK | vehicles.manage |  |
| POST | `/api/v1/vehicles/delete` | `delete` | ADMIN, MANAGER, FRONT_DESK | vehicles.manage |  |
| POST | `/api/v1/vehicles/restore` | `restore` | ADMIN, MANAGER, FRONT_DESK | vehicles.manage |  |
| POST | `/api/v1/vehicles/archive-impact` | `archiveImpact` | ADMIN, MANAGER, FRONT_DESK | vehicles.manage |  |
| POST | `/api/v1/vehicles/import` | `importRows` | ADMIN, MANAGER, FRONT_DESK | vehicles.manage | limite write |
| POST | `/api/v1/vehicles/transfer` | `transfer` | ADMIN, MANAGER, FRONT_DESK | vehicles.manage |  |
| POST | `/api/v1/vehicles/overview` | `overview` | ADMIN, MANAGER, FRONT_DESK, MECHANIC | vehicles.view |  |
| GET | `/api/v1/vehicle` | `get` | ADMIN, MANAGER, FRONT_DESK, MECHANIC | vehicles.view |  |
| POST | `/api/v1/vehicles/list` | `list` | ADMIN, MANAGER, FRONT_DESK, MECHANIC | vehicles.view |  |

## shared/plan/plan.controller.ts

| Método | Rota | Ação | Quem acessa | Permissão | Módulo/limite |
| --- | --- | --- | --- | --- | --- |
| GET | `/api/v1/plan/Cache-Control` | `current` | qualquer usuário autenticado |  |  |
