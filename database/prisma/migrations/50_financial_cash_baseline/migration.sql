CREATE TABLE financial_cash_baselines (
  tenant_id UUID PRIMARY KEY,
  amount_cents INTEGER NOT NULL,
  as_of TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE financial_entries ADD COLUMN paid_cents INTEGER NOT NULL DEFAULT 0;
ALTER TABLE financial_entries ADD COLUMN payment_managed BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE financial_entry_payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL,
  entry_id UUID NOT NULL REFERENCES financial_entries(id),
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  paid_at TIMESTAMPTZ NOT NULL,
  method TEXT,
  reconciled_at TIMESTAMPTZ,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);
CREATE INDEX financial_entry_payments_tenant_paid_idx ON financial_entry_payments(tenant_id, paid_at) WHERE deleted_at IS NULL;
CREATE INDEX financial_entry_payments_entry_idx ON financial_entry_payments(entry_id) WHERE deleted_at IS NULL;

CREATE TABLE financial_entry_attachments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL,
  entry_id UUID NOT NULL REFERENCES financial_entries(id),
  name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  content BYTEA NOT NULL,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX financial_entry_attachments_tenant_entry_idx ON financial_entry_attachments(tenant_id, entry_id);

CREATE TABLE financial_reconciliations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL,
  source TEXT NOT NULL,
  source_id UUID NOT NULL,
  bank_reference TEXT NOT NULL,
  reconciled_by UUID NOT NULL,
  reconciled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, source, source_id)
);
