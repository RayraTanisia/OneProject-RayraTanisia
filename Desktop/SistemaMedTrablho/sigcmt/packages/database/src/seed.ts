import { PrismaClient } from '@prisma/client'
import { hash } from 'bcryptjs'
import { createCipheriv, randomBytes, createHash } from 'crypto'

const prisma = new PrismaClient()

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'sigcmt-dev-key-32-bytes-long!!!!'

function encryptField(value: string): string {
  const iv = randomBytes(16)
  const key = Buffer.from(ENCRYPTION_KEY.padEnd(32).slice(0, 32))
  const cipher = createCipheriv('aes-256-cbc', key, iv)
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
  return iv.toString('hex') + ':' + encrypted.toString('hex')
}

function hashField(value: string, tenantId: string): string {
  return createHash('sha256').update(value + tenantId).digest('hex')
}

async function main() {
  console.log('🌱 Iniciando seed...')

  // Tenant (clínica demo)
  const tenant = await prisma.tenant.upsert({
    where: { slug: 'clinica-demo' },
    update: {},
    create: {
      name: 'Clínica Medicina do Trabalho Demo',
      slug: 'clinica-demo',
      phone: '(65) 3333-4444',
      email: 'contato@clinicademo.com.br',
      address: {
        street: 'Rua das Palmeiras',
        number: '100',
        neighborhood: 'Centro',
        city: 'Lucas do Rio Verde',
        state: 'MT',
        zip: '78455-000',
      },
    },
  })
  console.log('✅ Tenant criado:', tenant.name)

  // Admin
  const adminPass = await hash('Admin@2025!', 12)
  const admin = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: 'admin@sigcmt.com' } },
    update: {},
    create: {
      tenantId: tenant.id,
      email: 'admin@sigcmt.com',
      passwordHash: adminPass,
      fullName: 'Administrador Sistema',
      role: 'ADMIN' as const,
      permissions: ['*'],
    },
  })
  console.log('✅ Admin criado: admin@sigcmt.com / Admin@2025')

  // Médico
  const doctorPass = await hash('Medico@2025!', 12)
  const doctor = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: 'dr.silva@sigcmt.com' } },
    update: {},
    create: {
      tenantId: tenant.id,
      email: 'dr.silva@sigcmt.com',
      passwordHash: doctorPass,
      fullName: 'Dr. Carlos Silva',
      role: 'DOCTOR' as const,
      crmNumber: '12345',
      crmState: 'MT',
      permissions: ['patient:read', 'patient:write', 'medical_record:read', 'medical_record:write', 'medical_record:sign', 'appointment:read'],
    },
  })
  console.log('✅ Médico criado: dr.silva@sigcmt.com / Medico@2025!')

  // Recepcionista
  const recepPass = await hash('Recepcao@2025!', 12)
  await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: 'recepcao@sigcmt.com' } },
    update: {},
    create: {
      tenantId: tenant.id,
      email: 'recepcao@sigcmt.com',
      passwordHash: recepPass,
      fullName: 'Ana Paula Receptora',
      role: 'RECEPTIONIST' as const,
      permissions: ['patient:read', 'patient:write', 'appointment:read', 'appointment:write', 'appointment:cancel'],
    },
  })
  console.log('✅ Recepcionista criada: recepcao@sigcmt.com / Recepcao@2025')

  // Agenda do médico (seg a sex)
  for (let day = 1; day <= 5; day++) {
    await prisma.doctorSchedule.upsert({
      where: { doctorId_dayOfWeek: { doctorId: doctor.id, dayOfWeek: day } },
      update: {},
      create: {
        doctorId: doctor.id,
        dayOfWeek: day,
        startTime: '08:00',
        endTime: '18:00',
        slotDurationMin: 30,
        breakStart: '12:00',
        breakEnd: '13:00',
        maxAppointments: 16,
      },
    })
  }
  console.log('✅ Agenda do médico configurada (seg-sex)')

  // Salas
  const sala1 = await prisma.room.upsert({
    where: { id: 'room-consultorio-1' },
    update: {},
    create: {
      id: 'room-consultorio-1',
      tenantId: tenant.id,
      name: 'Consultório 1',
      equipment: ['Estetoscópio', 'Balança', 'Tensiômetro'],
    },
  })
  await prisma.room.upsert({
    where: { id: 'room-consultorio-2' },
    update: {},
    create: {
      id: 'room-consultorio-2',
      tenantId: tenant.id,
      name: 'Consultório 2',
      equipment: ['Audiômetro', 'Espirômetro'],
    },
  })
  console.log('✅ Salas criadas')

  // Empresa
  const company = await prisma.company.upsert({
    where: { tenantId_cnpjHash: { tenantId: tenant.id, cnpjHash: hashField('12345678000195', tenant.id) } },
    update: {},
    create: {
      tenantId: tenant.id,
      cnpj: encryptField('12345678000195'),
      cnpjHash: hashField('12345678000195', tenant.id),
      legalName: 'Agronegócio Verde Ltda',
      tradeName: 'AgroVerde',
      cnae: '0111-3/01',
      riskLevel: 2,
      sector: 'Agronegócio',
      employeeCount: 85,
      phone: '(65) 3333-1111',
      email: 'rh@agroverde.com.br',
    },
  })
  console.log('✅ Empresa demo criada')

  // Pacientes de teste
  const pacientes = [
    { name: 'João da Silva Santos', cpf: '12345678901', gender: 'male', birthDate: new Date('1985-03-15'), jobTitle: 'Operador de Máquinas' },
    { name: 'Maria Oliveira Costa', cpf: '98765432100', gender: 'female', birthDate: new Date('1992-07-22'), jobTitle: 'Técnica de Segurança' },
    { name: 'Pedro Alves Ferreira', cpf: '45678912300', gender: 'male', birthDate: new Date('1978-11-08'), jobTitle: 'Motorista' },
    { name: 'Ana Clara Rodrigues', cpf: '78945612300', gender: 'female', birthDate: new Date('1995-01-30'), jobTitle: 'Administrativo' },
    { name: 'Carlos Eduardo Lima', cpf: '32165498700', gender: 'male', birthDate: new Date('1988-09-12'), jobTitle: 'Engenheiro Agrônomo' },
  ]

  const createdPatients = []
  for (const p of pacientes) {
    const cpfHash = hashField(p.cpf, tenant.id)
    const patient = await prisma.patient.upsert({
      where: { tenantId_cpfHash: { tenantId: tenant.id, cpfHash } },
      update: {},
      create: {
        tenantId: tenant.id,
        fullName: p.name,
        cpfEncrypted: encryptField(p.cpf),
        cpfHash,
        gender: p.gender,
        birthDate: p.birthDate,
        phoneEncrypted: encryptField('65999990000'),
        emailEncrypted: encryptField(p.name.toLowerCase().replace(/ /g, '.') + '@email.com'),
        currentCompanyId: company.id,
        currentJobTitle: p.jobTitle,
        address: { street: 'Rua Exemplo', number: '100', city: 'Lucas do Rio Verde', state: 'MT', zip: '78455-000' },
        status: 'ACTIVE',
        lgpdConsent: { consented: true, date: new Date().toISOString(), version: '1.0', channels: ['whatsapp', 'email'] },
        createdById: admin.id,
      },
    })
    createdPatients.push(patient)
  }
  console.log('✅ 5 pacientes de teste criados')

  // Agendamentos de teste (próximos 7 dias)
  const now = new Date()
  const appointmentTypes = ['INITIAL', 'PERIODIC', 'ASO', 'FOLLOWUP'] as const
  for (let i = 0; i < 5; i++) {
    const date = new Date(now)
    date.setDate(date.getDate() + i + 1)
    date.setHours(8 + i * 2, 0, 0, 0)
    // pula fim de semana
    if (date.getDay() === 0) date.setDate(date.getDate() + 1)
    if (date.getDay() === 6) date.setDate(date.getDate() + 2)

    await prisma.appointment.create({
      data: {
        tenantId: tenant.id,
        patientId: createdPatients[i].id,
        doctorId: doctor.id,
        roomId: sala1.id,
        companyId: company.id,
        appointmentType: appointmentTypes[i % appointmentTypes.length],
        scheduledAt: date,
        durationMinutes: 30,
        status: i === 0 ? 'CONFIRMED' : 'SCHEDULED',
        bookingChannel: 'web_portal',
      },
    })
  }
  console.log('✅ 5 agendamentos de teste criados')

  console.log('\n🎉 Seed concluído!')
  console.log('─────────────────────────────────────')
  console.log('  Admin:         admin@sigcmt.com     / Admin@2025!')
  console.log('  Médico:        dr.silva@sigcmt.com  / Medico@2025!')
  console.log('  Recepção:      recepcao@sigcmt.com  / Recepcao@2025!')
  console.log('─────────────────────────────────────')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
