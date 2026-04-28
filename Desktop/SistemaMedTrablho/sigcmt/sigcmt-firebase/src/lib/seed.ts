/**
 * SEED FIRESTORE — rodar UMA VEZ no console do browser
 *
 * Como usar:
 * 1. Abra o app no browser (http://localhost:5173)
 * 2. Abra o Console do DevTools (F12)
 * 3. Cole este código inteiro e pressione Enter
 * 4. Aguarde a mensagem "✅ Seed concluído!"
 *
 * Isso cria:
 *  - 3 usuários de demo no Firestore (o login é via Firebase Auth — veja README)
 *  - 5 pacientes de teste
 *  - 5 agendamentos para os próximos dias
 *  - Agenda do médico (seg-sex)
 *  - 2 salas
 *  - 1 empresa
 */

import { db } from './firebase'
import {
  doc, setDoc, addDoc, collection, serverTimestamp, Timestamp
} from 'firebase/firestore'
import dayjs from 'dayjs'

export async function runSeed() {
  console.log('🌱 Iniciando seed do Firestore...')

  // ── Usuários (perfis — o login Firebase Auth é criado manualmente no Console) ──
  const users = [
    {
      uid: 'admin-demo-001',
      email: 'admin@sigcmt.com',
      fullName: 'Administrador Sistema',
      role: 'ADMIN',
      permissions: ['*'],
      active: true,
    },
    {
      uid: 'doctor-demo-001',
      email: 'dr.silva@sigcmt.com',
      fullName: 'Dr. Carlos Silva',
      role: 'DOCTOR',
      crmNumber: '12345',
      crmState: 'MT',
      permissions: ['patient:read', 'patient:write', 'appointment:read', 'appointment:write'],
      active: true,
    },
    {
      uid: 'recepcao-demo-001',
      email: 'recepcao@sigcmt.com',
      fullName: 'Ana Paula Receptora',
      role: 'RECEPTIONIST',
      permissions: ['patient:read', 'patient:write', 'appointment:read', 'appointment:write', 'appointment:cancel'],
      active: true,
    },
  ]

  for (const u of users) {
    await setDoc(doc(db, 'users', u.uid), {
      ...u, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    })
    console.log(`✅ Usuário: ${u.fullName}`)
  }

  // ── Empresa ───────────────────────────────────────────────────────────────────
  const companyRef = await addDoc(collection(db, 'companies'), {
    cnpj: '12345678000195',
    legalName: 'Agronegócio Verde Ltda',
    tradeName: 'AgroVerde',
    cnae: '0111-3/01',
    riskLevel: 2,
    sector: 'Agronegócio',
    employeeCount: 85,
    phone: '(65) 3333-1111',
    email: 'rh@agroverde.com.br',
    status: 'ACTIVE',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  console.log('✅ Empresa: AgroVerde')

  // ── Salas ─────────────────────────────────────────────────────────────────────
  const room1Ref = await addDoc(collection(db, 'rooms'), {
    name: 'Consultório 1', equipment: ['Estetoscópio', 'Balança', 'Tensiômetro'], active: true,
  })
  await addDoc(collection(db, 'rooms'), {
    name: 'Consultório 2', equipment: ['Audiômetro', 'Espirômetro'], active: true,
  })
  console.log('✅ Salas criadas')

  // ── Agenda do médico (seg a sex) ──────────────────────────────────────────────
  for (let day = 1; day <= 5; day++) {
    await addDoc(collection(db, 'doctorSchedules'), {
      doctorId: 'doctor-demo-001',
      dayOfWeek: day,
      startTime: '08:00',
      endTime: '18:00',
      slotDurationMin: 30,
      breakStart: '12:00',
      breakEnd: '13:00',
      maxAppointments: 16,
      active: true,
    })
  }
  console.log('✅ Agenda do médico configurada (seg-sex)')

  // ── Pacientes ─────────────────────────────────────────────────────────────────
  const pacientes = [
    { fullName: 'João da Silva Santos', cpf: '123.456.789-01', gender: 'male', birthDate: '1985-03-15', currentJobTitle: 'Operador de Máquinas' },
    { fullName: 'Maria Oliveira Costa', cpf: '987.654.321-00', gender: 'female', birthDate: '1992-07-22', currentJobTitle: 'Técnica de Segurança' },
    { fullName: 'Pedro Alves Ferreira', cpf: '456.789.123-00', gender: 'male', birthDate: '1978-11-08', currentJobTitle: 'Motorista' },
    { fullName: 'Ana Clara Rodrigues', cpf: '789.456.123-00', gender: 'female', birthDate: '1995-01-30', currentJobTitle: 'Administrativo' },
    { fullName: 'Carlos Eduardo Lima', cpf: '321.654.987-00', gender: 'male', birthDate: '1988-09-12', currentJobTitle: 'Engenheiro Agrônomo' },
  ]

  const patientIds: string[] = []
  for (const p of pacientes) {
    const ref = await addDoc(collection(db, 'patients'), {
      ...p,
      phone: '(65) 99999-0000',
      email: `${p.fullName.toLowerCase().replace(/ /g, '.')}@email.com`,
      currentCompanyId: companyRef.id,
      currentCompanyName: 'AgroVerde',
      address: { city: 'Lucas do Rio Verde', state: 'MT', zip: '78455-000' },
      occupationalRisks: [],
      allergies: [],
      continuousMedications: [],
      status: 'ACTIVE',
      lgpdConsent: true,
      lgpdConsentDate: new Date().toISOString(),
      createdBy: 'admin-demo-001',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
    patientIds.push(ref.id)
    console.log(`✅ Paciente: ${p.fullName}`)
  }

  // ── Agendamentos ──────────────────────────────────────────────────────────────
  const types = ['INITIAL', 'PERIODIC', 'ASO', 'FOLLOWUP', 'RETURN']
  for (let i = 0; i < 5; i++) {
    let date = dayjs().add(i + 1, 'day')
    if (date.day() === 0) date = date.add(1, 'day')
    if (date.day() === 6) date = date.add(2, 'day')
    const scheduledAt = date.hour(8 + i * 2).minute(0).second(0)

    await addDoc(collection(db, 'appointments'), {
      patientId: patientIds[i],
      patientName: pacientes[i].fullName,
      doctorId: 'doctor-demo-001',
      doctorName: 'Dr. Carlos Silva',
      roomId: room1Ref.id,
      roomName: 'Consultório 1',
      companyId: companyRef.id,
      companyName: 'AgroVerde',
      appointmentType: types[i],
      scheduledAt: Timestamp.fromDate(scheduledAt.toDate()),
      durationMinutes: 30,
      status: i === 0 ? 'CONFIRMED' : 'SCHEDULED',
      bookingChannel: 'web',
      createdBy: 'recepcao-demo-001',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  }
  console.log('✅ 5 agendamentos criados')

  console.log('\n🎉 Seed concluído! Recarregue a página.')
  console.log('─────────────────────────────────────────────')
  console.log('Crie os usuários no Firebase Auth Console:')
  console.log('  admin@sigcmt.com     → senha: Admin@2025')
  console.log('  dr.silva@sigcmt.com  → senha: Medico@2025')
  console.log('  recepcao@sigcmt.com  → senha: Recepcao@2025')
  console.log('─────────────────────────────────────────────')
}
