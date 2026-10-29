CREATE TABLE service_order_work_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL,
  service_order_id UUID NOT NULL,
  technician_id UUID NOT NULL,
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT work_session_interval_check CHECK (ended_at IS NULL OR ended_at >= started_at)
);
CREATE INDEX service_orders_productivity_period_idx ON service_orders(tenant_id, status, closed_at);
CREATE INDEX service_order_work_sessions_order_idx ON service_order_work_sessions(tenant_id, service_order_id);
CREATE INDEX service_order_work_sessions_technician_idx ON service_order_work_sessions(tenant_id, technician_id, started_at);
CREATE UNIQUE INDEX service_order_work_sessions_one_open_per_technician ON service_order_work_sessions(tenant_id, technician_id) WHERE ended_at IS NULL;

CREATE TABLE service_order_productivity_shares (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL,
  service_order_id UUID NOT NULL,
  technician_id UUID,
  labor_cents INTEGER NOT NULL CHECK (labor_cents >= 0),
  worked_minutes INTEGER NOT NULL CHECK (worked_minutes >= 0),
  basis TEXT NOT NULL CHECK (basis IN ('RECORDED', 'ASSIGNED', 'UNASSIGNED')),
  delivered_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX service_order_productivity_shares_period_idx ON service_order_productivity_shares(tenant_id, delivered_at);
CREATE INDEX service_order_productivity_shares_technician_idx ON service_order_productivity_shares(tenant_id, technician_id, delivered_at);
CREATE UNIQUE INDEX service_order_productivity_shares_order_technician_unique ON service_order_productivity_shares(service_order_id, technician_id);

CREATE TABLE technician_productivity_targets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL,
  technician_id UUID NOT NULL,
  month TEXT NOT NULL CHECK (month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  completed_target INTEGER NOT NULL CHECK (completed_target >= 0),
  labor_cents_target INTEGER NOT NULL CHECK (labor_cents_target >= 0),
  worked_minutes_target INTEGER NOT NULL CHECK (worked_minutes_target >= 0),
  UNIQUE (tenant_id, technician_id, month)
);
CREATE INDEX technician_productivity_targets_month_idx ON technician_productivity_targets(tenant_id, month);
