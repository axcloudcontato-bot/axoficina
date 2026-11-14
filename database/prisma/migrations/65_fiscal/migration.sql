-- Notas fiscais da OS (emitidas pelo Ofix ou registradas manualmente) e configuração fiscal da oficina.

ALTER TABLE catalog_items ADD COLUMN ncm VARCHAR(8);

CREATE TABLE fiscal_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL UNIQUE,
  environment VARCHAR(12) NOT NULL DEFAULT 'HOMOLOGACAO' CHECK (environment IN ('HOMOLOGACAO', 'PRODUCAO')),
  tax_regime VARCHAR(20) NOT NULL DEFAULT 'SIMPLES_NACIONAL' CHECK (tax_regime IN ('SIMPLES_NACIONAL', 'MEI', 'SIMPLES_EXCESSO', 'NORMAL')),
  municipal_registration VARCHAR(30),
  city_ibge_code VARCHAR(7),
  cnae VARCHAR(10),
  nfse_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  nfe_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  nfce_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  service_list_item VARCHAR(10) NOT NULL DEFAULT '14.01',
  municipal_tax_code VARCHAR(30),
  iss_rate_percent NUMERIC(5, 2),
  iss_withheld BOOLEAN NOT NULL DEFAULT FALSE,
  default_ncm VARCHAR(8) NOT NULL DEFAULT '87089990',
  default_cfop VARCHAR(4) NOT NULL DEFAULT '5102',
  csosn VARCHAR(3) NOT NULL DEFAULT '102',
  pis_cofins_cst VARCHAR(2) NOT NULL DEFAULT '49',
  nfce_csc_id VARCHAR(10),
  nfce_csc TEXT,
  provider_company_id VARCHAR(40),
  provider_token_production TEXT,
  provider_token_homologation TEXT,
  certificate_valid_until TIMESTAMPTZ,
  certificate_uploaded_at TIMESTAMPTZ,
  last_sync_at TIMESTAMPTZ,
  last_sync_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE fiscal_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL,
  service_order_id UUID NOT NULL,
  kind VARCHAR(4) NOT NULL CHECK (kind IN ('NFSE', 'NFE', 'NFCE')),
  origin VARCHAR(10) NOT NULL CHECK (origin IN ('INTEGRATED', 'MANUAL')),
  environment VARCHAR(12) CHECK (environment IN ('HOMOLOGACAO', 'PRODUCAO')),
  status VARCHAR(10) NOT NULL CHECK (status IN ('PROCESSING', 'AUTHORIZED', 'ERROR', 'CANCELLED')),
  provider_ref VARCHAR(60) UNIQUE,
  number VARCHAR(20),
  series VARCHAR(10),
  verification_code VARCHAR(60),
  access_key VARCHAR(60),
  issued_at TIMESTAMPTZ,
  amount_cents INTEGER NOT NULL CHECK (amount_cents >= 0),
  pdf_url TEXT,
  xml_url TEXT,
  attachment_key TEXT,
  attachment_name VARCHAR(160),
  attachment_mime_type VARCHAR(60),
  error_message TEXT,
  cancelled_at TIMESTAMPTZ,
  cancel_reason VARCHAR(255),
  notes VARCHAR(500),
  item_ids UUID[] NOT NULL DEFAULT '{}',
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX fiscal_documents_tenant_id_idx ON fiscal_documents (tenant_id);
CREATE INDEX fiscal_documents_service_order_id_idx ON fiscal_documents (service_order_id);
CREATE INDEX fiscal_documents_tenant_id_status_idx ON fiscal_documents (tenant_id, status);
