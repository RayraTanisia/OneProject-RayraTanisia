-- ============================================================
-- SIGCMT — Tabela ASO (Atestado de Saúde Ocupacional)
-- Execute no Supabase SQL Editor
-- ============================================================

DO $$ BEGIN
  CREATE TYPE aso_exam_type AS ENUM (
    'ADMISSIONAL','PERIODICO','RETORNO_TRABALHO','MUDANCA_FUNCAO','DEMISSIONAL'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE aso_conclusion AS ENUM ('APTO','INAPTO','APTO_RESTRICOES');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "aso" (
  "id"                  TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "tenantId"            TEXT        NOT NULL REFERENCES tenants(id),
  "appointmentId"       TEXT        REFERENCES appointments(id) ON DELETE SET NULL,
  "patientId"           TEXT        NOT NULL REFERENCES patients(id),
  "companyId"           TEXT        REFERENCES companies(id),
  "doctorId"            TEXT        NOT NULL REFERENCES users(id),
  "examType"            aso_exam_type NOT NULL,
  "conclusion"          aso_conclusion NOT NULL,
  "restrictions"        TEXT,
  "complementaryExams"  JSONB       NOT NULL DEFAULT '[]',
  "riskFactors"         JSONB       NOT NULL DEFAULT '[]',
  "validUntil"          DATE,
  "observations"        TEXT,
  "issuedAt"            TIMESTAMPTZ NOT NULL DEFAULT now(),
  "createdAt"           TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "aso_tenant_issued_idx" ON "aso"("tenantId", "issuedAt" DESC);
CREATE INDEX IF NOT EXISTS "aso_patient_idx"        ON "aso"("patientId");
CREATE INDEX IF NOT EXISTS "aso_company_idx"        ON "aso"("companyId");
