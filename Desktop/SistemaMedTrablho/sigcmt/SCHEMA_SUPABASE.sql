-- =====================================================
-- SIGCMT — Schema para Supabase SQL Editor
-- Supabase > SQL Editor > New query > Cole aqui > Run
-- =====================================================

-- ENUMS
DO $$ BEGIN
  CREATE TYPE "UserRole" AS ENUM ('ADMIN','MANAGER','DOCTOR','NURSE','RECEPTIONIST','BILLING','WAREHOUSE','HR','PSYCHOLOGIST','COMPANY_USER','PATIENT_USER');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "CompanyStatus" AS ENUM ('ACTIVE','INACTIVE','PROSPECT');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "PatientStatus" AS ENUM ('ACTIVE','INACTIVE','DECEASED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "AppointmentType" AS ENUM ('INITIAL','PERIODIC','DISMISSAL','ASO','FOLLOWUP','RETURN');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "AppointmentStatus" AS ENUM ('SCHEDULED','CONFIRMED','IN_PROGRESS','COMPLETED','CANCELLED','NO_SHOW');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "TriageStatus" AS ENUM ('PENDING','COMPLETED','INCOMPLETE','APPROVED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- TENANTS
CREATE TABLE IF NOT EXISTS "tenants" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "logoUrl" TEXT,
  "phone" TEXT,
  "email" TEXT,
  "address" JSONB,
  "settings" JSONB NOT NULL DEFAULT '{}',
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "tenants_slug_key" ON "tenants"("slug");

-- USERS
CREATE TABLE IF NOT EXISTS "users" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "tenantId" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "fullName" TEXT NOT NULL,
  "role" "UserRole" NOT NULL DEFAULT 'RECEPTIONIST',
  "permissions" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "crmNumber" TEXT,
  "crmState" TEXT,
  "phone" TEXT,
  "photoUrl" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "lastLoginAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "users_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "users_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id")
);
CREATE INDEX IF NOT EXISTS "users_tenantId_role_idx" ON "users"("tenantId","role");
CREATE UNIQUE INDEX IF NOT EXISTS "users_tenantId_email_key" ON "users"("tenantId","email");

-- REFRESH TOKENS
CREATE TABLE IF NOT EXISTS "refresh_tokens" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "userId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMPTZ NOT NULL,
  "usedAt" TIMESTAMPTZ,
  "revokedAt" TIMESTAMPTZ,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "refresh_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "refresh_tokens_tokenHash_key" ON "refresh_tokens"("tokenHash");
CREATE INDEX IF NOT EXISTS "refresh_tokens_userId_idx" ON "refresh_tokens"("userId");

-- COMPANIES
CREATE TABLE IF NOT EXISTS "companies" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "tenantId" TEXT NOT NULL,
  "cnpj" TEXT NOT NULL,
  "cnpjHash" TEXT NOT NULL,
  "legalName" TEXT NOT NULL,
  "tradeName" TEXT,
  "address" JSONB,
  "phone" TEXT,
  "email" TEXT,
  "cnae" TEXT,
  "riskLevel" INTEGER NOT NULL DEFAULT 1,
  "sector" TEXT,
  "employeeCount" INTEGER,
  "status" "CompanyStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "companies_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "companies_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id")
);
CREATE INDEX IF NOT EXISTS "companies_tenantId_status_idx" ON "companies"("tenantId","status");
CREATE UNIQUE INDEX IF NOT EXISTS "companies_tenantId_cnpjHash_key" ON "companies"("tenantId","cnpjHash");

-- PATIENTS
CREATE TABLE IF NOT EXISTS "patients" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "tenantId" TEXT NOT NULL,
  "fullName" TEXT NOT NULL,
  "cpfEncrypted" TEXT NOT NULL,
  "cpfHash" TEXT NOT NULL,
  "rg" TEXT,
  "birthDate" TIMESTAMPTZ,
  "gender" TEXT,
  "bloodType" TEXT,
  "phoneEncrypted" TEXT,
  "emailEncrypted" TEXT,
  "whatsappEncrypted" TEXT,
  "address" JSONB,
  "currentCompanyId" TEXT,
  "currentJobTitle" TEXT,
  "occupationalRisks" JSONB NOT NULL DEFAULT '[]',
  "allergies" JSONB NOT NULL DEFAULT '[]',
  "continuousMedications" JSONB NOT NULL DEFAULT '[]',
  "medicalRestrictions" TEXT,
  "familyHistory" JSONB NOT NULL DEFAULT '[]',
  "heightCm" FLOAT8,
  "weightKg" FLOAT8,
  "photoUrl" TEXT,
  "status" "PatientStatus" NOT NULL DEFAULT 'ACTIVE',
  "lgpdConsent" JSONB,
  "esocialId" TEXT,
  "customFields" JSONB NOT NULL DEFAULT '{}',
  "createdById" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "deletedAt" TIMESTAMPTZ,
  CONSTRAINT "patients_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "patients_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id"),
  CONSTRAINT "patients_currentCompanyId_fkey" FOREIGN KEY ("currentCompanyId") REFERENCES "companies"("id") ON DELETE SET NULL,
  CONSTRAINT "patients_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS "patients_tenantId_status_idx" ON "patients"("tenantId","status");
CREATE INDEX IF NOT EXISTS "patients_tenantId_currentCompanyId_idx" ON "patients"("tenantId","currentCompanyId");
CREATE UNIQUE INDEX IF NOT EXISTS "patients_tenantId_cpfHash_key" ON "patients"("tenantId","cpfHash");

-- PATIENT DOCUMENTS
CREATE TABLE IF NOT EXISTS "patient_documents" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "patientId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "fileUrl" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "fileSize" INTEGER,
  "uploadedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "uploadedBy" TEXT,
  CONSTRAINT "patient_documents_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "patient_documents_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "patient_documents_patientId_idx" ON "patient_documents"("patientId");

-- ROOMS
CREATE TABLE IF NOT EXISTS "rooms" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "tenantId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "capacity" INTEGER NOT NULL DEFAULT 1,
  "equipment" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "rooms_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "rooms_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id")
);
CREATE INDEX IF NOT EXISTS "rooms_tenantId_idx" ON "rooms"("tenantId");

-- DOCTOR SCHEDULES
CREATE TABLE IF NOT EXISTS "doctor_schedules" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "doctorId" TEXT NOT NULL,
  "dayOfWeek" INTEGER NOT NULL,
  "startTime" TEXT NOT NULL,
  "endTime" TEXT NOT NULL,
  "slotDurationMin" INTEGER NOT NULL DEFAULT 30,
  "breakStart" TEXT,
  "breakEnd" TEXT,
  "maxAppointments" INTEGER,
  "active" BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT "doctor_schedules_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "doctor_schedules_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "users"("id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "doctor_schedules_doctorId_dayOfWeek_key" ON "doctor_schedules"("doctorId","dayOfWeek");

-- BLOCKED SLOTS
CREATE TABLE IF NOT EXISTS "blocked_slots" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "tenantId" TEXT NOT NULL,
  "doctorId" TEXT,
  "roomId" TEXT,
  "startAt" TIMESTAMPTZ NOT NULL,
  "endAt" TIMESTAMPTZ NOT NULL,
  "reason" TEXT,
  "createdBy" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "blocked_slots_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "blocked_slots_tenantId_startAt_idx" ON "blocked_slots"("tenantId","startAt");

-- APPOINTMENTS
CREATE TABLE IF NOT EXISTS "appointments" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "tenantId" TEXT NOT NULL,
  "patientId" TEXT NOT NULL,
  "doctorId" TEXT NOT NULL,
  "roomId" TEXT,
  "companyId" TEXT,
  "appointmentType" "AppointmentType" NOT NULL DEFAULT 'INITIAL',
  "scheduledAt" TIMESTAMPTZ NOT NULL,
  "durationMinutes" INTEGER NOT NULL DEFAULT 30,
  "status" "AppointmentStatus" NOT NULL DEFAULT 'SCHEDULED',
  "confirmationChannel" TEXT,
  "confirmedAt" TIMESTAMPTZ,
  "checkedInAt" TIMESTAMPTZ,
  "startedAt" TIMESTAMPTZ,
  "endedAt" TIMESTAMPTZ,
  "cancellationReason" TEXT,
  "cancelledBy" TEXT,
  "bookingChannel" TEXT NOT NULL DEFAULT 'web_portal',
  "remindersSent" JSONB NOT NULL DEFAULT '[]',
  "notes" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "appointments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "appointments_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id"),
  CONSTRAINT "appointments_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id"),
  CONSTRAINT "appointments_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "users"("id"),
  CONSTRAINT "appointments_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "rooms"("id") ON DELETE SET NULL,
  CONSTRAINT "appointments_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS "appointments_tenantId_scheduledAt_idx" ON "appointments"("tenantId","scheduledAt");
CREATE INDEX IF NOT EXISTS "appointments_tenantId_doctorId_scheduledAt_idx" ON "appointments"("tenantId","doctorId","scheduledAt");
CREATE INDEX IF NOT EXISTS "appointments_tenantId_patientId_idx" ON "appointments"("tenantId","patientId");
CREATE INDEX IF NOT EXISTS "appointments_tenantId_status_idx" ON "appointments"("tenantId","status");

-- TRIAGES
CREATE TABLE IF NOT EXISTS "triages" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "appointmentId" TEXT NOT NULL,
  "patientId" TEXT NOT NULL,
  "performedBy" TEXT,
  "channel" TEXT NOT NULL DEFAULT 'in_person',
  "status" "TriageStatus" NOT NULL DEFAULT 'PENDING',
  "responses" JSONB NOT NULL DEFAULT '[]',
  "riskFlags" JSONB NOT NULL DEFAULT '[]',
  "currentSymptoms" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "medicationsInUse" JSONB NOT NULL DEFAULT '[]',
  "accessibilityNeeds" JSONB NOT NULL DEFAULT '{}',
  "completedAt" TIMESTAMPTZ,
  "durationSeconds" INTEGER,
  "doctorNotes" TEXT,
  "reviewedBy" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "triages_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "triages_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "appointments"("id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "triages_appointmentId_key" ON "triages"("appointmentId");

-- AUDIT LOGS
CREATE TABLE IF NOT EXISTS "audit_logs" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "tenantId" TEXT NOT NULL,
  "userId" TEXT,
  "action" TEXT NOT NULL,
  "resourceType" TEXT NOT NULL,
  "resourceId" TEXT,
  "oldValue" JSONB,
  "newValue" JSONB,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "sessionId" TEXT,
  "timestamp" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS "audit_logs_tenantId_resourceType_timestamp_idx" ON "audit_logs"("tenantId","resourceType","timestamp");
CREATE INDEX IF NOT EXISTS "audit_logs_tenantId_userId_timestamp_idx" ON "audit_logs"("tenantId","userId","timestamp");

SELECT 'Schema SIGCMT criado com sucesso!' as resultado;
