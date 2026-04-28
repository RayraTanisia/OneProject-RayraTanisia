-- =====================================================
-- SIGCMT — Dados demo para Supabase SQL Editor
-- Execute DEPOIS do SCHEMA_SUPABASE.sql
-- Supabase > SQL Editor > New query > Cole aqui > Run
-- =====================================================

-- Tenant demo
INSERT INTO "tenants" ("id","name","slug","phone","email","address","updatedAt")
VALUES (
  'tenant-clinica-demo',
  'Clínica Medicina do Trabalho Demo',
  'clinica-demo',
  '(65) 3333-4444',
  'contato@clinicademo.com.br',
  '{"street":"Rua das Palmeiras","number":"100","city":"Lucas do Rio Verde","state":"MT","zip":"78455-000"}',
  NOW()
) ON CONFLICT ("id") DO NOTHING;

-- Admin (senha: Admin@2025!)
INSERT INTO "users" ("id","tenantId","email","passwordHash","fullName","role","permissions","updatedAt")
VALUES (
  'user-admin-demo',
  'tenant-clinica-demo',
  'admin@sigcmt.com',
  '$2a$12$v9Ehh4/uKl5MygAIlksaCeU.OBqYWpgO3ZzBoWLEkJphfsLS1vIlm',
  'Administrador Sistema',
  'ADMIN',
  ARRAY['*'],
  NOW()
) ON CONFLICT DO NOTHING;

-- Médico (senha: Medico@2025!)
INSERT INTO "users" ("id","tenantId","email","passwordHash","fullName","role","crmNumber","crmState","permissions","updatedAt")
VALUES (
  'user-doctor-demo',
  'tenant-clinica-demo',
  'dr.silva@sigcmt.com',
  '$2a$12$ejvnp3Mh7cqSkXoyCk6iDeBInaKC3Ey.6x64f3sdheSQGoTbvl91G',
  'Dr. Carlos Silva',
  'DOCTOR',
  '12345',
  'MT',
  ARRAY['patient:read','patient:write','medical_record:read','medical_record:write','appointment:read'],
  NOW()
) ON CONFLICT DO NOTHING;

-- Recepcionista (senha: Recepcao@2025!)
INSERT INTO "users" ("id","tenantId","email","passwordHash","fullName","role","permissions","updatedAt")
VALUES (
  'user-recepcao-demo',
  'tenant-clinica-demo',
  'recepcao@sigcmt.com',
  '$2a$12$u3hD.wqbs3N4YRtn/qDwRO7RFRn5FzILbFXMz2Ua8MKAk/6fhZ8N.',
  'Ana Paula Receptora',
  'RECEPTIONIST',
  ARRAY['patient:read','patient:write','appointment:read','appointment:write'],
  NOW()
) ON CONFLICT DO NOTHING;

-- Salas
INSERT INTO "rooms" ("id","tenantId","name","equipment")
VALUES
  ('room-cons-1','tenant-clinica-demo','Consultório 1',ARRAY['Estetoscópio','Balança','Tensiômetro']),
  ('room-cons-2','tenant-clinica-demo','Consultório 2',ARRAY['Audiômetro','Espirômetro'])
ON CONFLICT ("id") DO NOTHING;

-- Agenda do médico (segunda a sexta)
INSERT INTO "doctor_schedules" ("id","doctorId","dayOfWeek","startTime","endTime","slotDurationMin","breakStart","breakEnd","maxAppointments")
VALUES
  (gen_random_uuid()::text,'user-doctor-demo',1,'08:00','18:00',30,'12:00','13:00',16),
  (gen_random_uuid()::text,'user-doctor-demo',2,'08:00','18:00',30,'12:00','13:00',16),
  (gen_random_uuid()::text,'user-doctor-demo',3,'08:00','18:00',30,'12:00','13:00',16),
  (gen_random_uuid()::text,'user-doctor-demo',4,'08:00','18:00',30,'12:00','13:00',16),
  (gen_random_uuid()::text,'user-doctor-demo',5,'08:00','18:00',30,'12:00','13:00',16)
ON CONFLICT DO NOTHING;

-- Empresa demo
INSERT INTO "companies" ("id","tenantId","cnpj","cnpjHash","legalName","tradeName","cnae","riskLevel","sector","employeeCount","updatedAt")
VALUES (
  'company-agroverde',
  'tenant-clinica-demo',
  'CNPJ_CRIPTOGRAFADO',
  'hash_cnpj_agroverde',
  'Agronegócio Verde Ltda',
  'AgroVerde',
  '0111-3/01',
  2,
  'Agronegócio',
  85,
  NOW()
) ON CONFLICT DO NOTHING;

-- Pacientes demo
INSERT INTO "patients" ("id","tenantId","fullName","cpfEncrypted","cpfHash","gender","birthDate","currentCompanyId","currentJobTitle","status","updatedAt")
VALUES
  (gen_random_uuid()::text,'tenant-clinica-demo','João da Silva Santos','cpf_enc_1','cpf_hash_1','male','1985-03-15','company-agroverde','Operador de Máquinas','ACTIVE',NOW()),
  (gen_random_uuid()::text,'tenant-clinica-demo','Maria Oliveira Costa','cpf_enc_2','cpf_hash_2','female','1992-07-22','company-agroverde','Técnica de Segurança','ACTIVE',NOW()),
  (gen_random_uuid()::text,'tenant-clinica-demo','Pedro Alves Ferreira','cpf_enc_3','cpf_hash_3','male','1978-11-08','company-agroverde','Motorista','ACTIVE',NOW()),
  (gen_random_uuid()::text,'tenant-clinica-demo','Ana Clara Rodrigues','cpf_enc_4','cpf_hash_4','female','1995-01-30','company-agroverde','Administrativo','ACTIVE',NOW()),
  (gen_random_uuid()::text,'tenant-clinica-demo','Carlos Eduardo Lima','cpf_enc_5','cpf_hash_5','male','1988-09-12','company-agroverde','Engenheiro Agrônomo','ACTIVE',NOW())
ON CONFLICT DO NOTHING;

SELECT 'Dados demo inseridos! Login: admin@sigcmt.com / Admin@2025!' as resultado;
