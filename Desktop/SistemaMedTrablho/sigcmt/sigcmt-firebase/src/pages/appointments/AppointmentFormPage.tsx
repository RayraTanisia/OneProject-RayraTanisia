import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { patientService } from '../../lib/patients'
import { appointmentService } from '../../lib/appointments'
import { authService } from '../../lib/auth'
import { db } from '../../lib/firebase'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { useAuthStore } from '../../store/auth'
import toast from 'react-hot-toast'
import { ArrowLeft, Loader2, Save, Search, Clock } from 'lucide-react'
import dayjs from 'dayjs'
import clsx from 'clsx'
import { APPOINTMENT_TYPE_LABEL } from '../../types'

export default function AppointmentFormPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const user = useAuthStore(s => s.user)
  const [searchParams] = useSearchParams()

  const [form, setForm] = useState({
    patientId: searchParams.get('patientId') || '',
    doctorId: '', roomId: '', appointmentType: 'INITIAL',
    date: dayjs().add(1,'day').format('YYYY-MM-DD'),
    time: '', durationMinutes: 30, notes: '',
  })
  const [patientSearch, setPatientSearch] = useState('')
  const [patientSearchD, setPatientSearchD] = useState('')

  useEffect(() => {
    const t = setTimeout(() => setPatientSearchD(patientSearch), 400)
    return () => clearTimeout(t)
  }, [patientSearch])

  const { data: selectedPatient } = useQuery({
    queryKey: ['patient', form.patientId],
    queryFn: () => patientService.getById(form.patientId),
    enabled: Boolean(form.patientId),
  })

  const { data: patients = [] } = useQuery({
    queryKey: ['patients-search', patientSearchD],
    queryFn: () => patientService.list(patientSearchD),
    enabled: patientSearchD.length >= 2,
  })

  const { data: doctors = [] } = useQuery({
    queryKey: ['doctors'],
    queryFn: async () => {
      const snap = await getDocs(query(collection(db, 'users'), where('role', '==', 'DOCTOR'), where('active', '==', true)))
      return snap.docs.map(d => ({ uid: d.id, ...d.data() }))
    },
  })

  const { data: rooms = [] } = useQuery({
    queryKey: ['rooms'],
    queryFn: async () => {
      const snap = await getDocs(query(collection(db, 'rooms'), where('active', '==', true)))
      return snap.docs.map(d => ({ id: d.id, ...d.data() }))
    },
  })

  const { data: slots = [], isFetching: loadingSlots } = useQuery({
    queryKey: ['slots', form.doctorId, form.date],
    queryFn: () => appointmentService.getAvailableSlots(form.doctorId, form.date),
    enabled: Boolean(form.doctorId && form.date),
  })

  const available = slots.filter((s: any) => s.available)

  const mutation = useMutation({
    mutationFn: () => {
      if (!form.patientId || !form.doctorId || !form.time) throw new Error('Preencha todos os campos obrigatórios.')
      const doctor = (doctors as any[]).find((d: any) => d.uid === form.doctorId)
      const room = (rooms as any[]).find((r: any) => r.id === form.roomId)
      return appointmentService.create({
        patientId: form.patientId,
        patientName: selectedPatient?.fullName || '',
        doctorId: form.doctorId,
        doctorName: doctor?.fullName || '',
        roomId: form.roomId || undefined,
        roomName: room?.name,
        appointmentType: form.appointmentType as any,
        scheduledAt: dayjs(form.date + 'T' + form.time + ':00').toISOString(),
        durationMinutes: form.durationMinutes,
        notes: form.notes || undefined,
        status: 'SCHEDULED',
        bookingChannel: 'web',
        createdBy: user?.uid || '',
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['apts'] })
      toast.success('Agendamento criado!')
      navigate('/appointments')
    },
    onError: (e: any) => toast.error(e.message || 'Erro ao criar agendamento.'),
  })

  return (
    <div className="max-w-2xl space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="btn-ghost btn-sm"><ArrowLeft size={16}/></button>
        <h1 className="text-xl font-bold">Novo Agendamento</h1>
      </div>

      <div className="space-y-4">
        {/* Paciente */}
        <div className="card">
          <div className="card-header"><h2 className="text-sm font-semibold">Paciente</h2></div>
          <div className="card-body space-y-3">
            {selectedPatient ? (
              <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
                <div className="w-9 h-9 rounded-full bg-blue-200 flex items-center justify-center text-blue-700 font-bold text-sm flex-shrink-0">{selectedPatient.fullName.charAt(0)}</div>
                <div className="flex-1"><p className="font-medium text-gray-800">{selectedPatient.fullName}</p><p className="text-xs text-gray-500">{selectedPatient.currentJobTitle || '—'}</p></div>
                <button type="button" onClick={() => setForm(f => ({ ...f, patientId: '' }))} className="text-xs text-blue-600 hover:text-blue-700">Trocar</button>
              </div>
            ) : (
              <>
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
                  <input value={patientSearch} onChange={e => setPatientSearch(e.target.value)} placeholder="Buscar paciente..." className="input pl-9"/>
                </div>
                {patients.length > 0 && patientSearchD.length >= 2 && (
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    {patients.slice(0, 6).map(p => (
                      <button key={p.id} type="button" onClick={() => { setForm(f => ({ ...f, patientId: p.id })); setPatientSearch('') }}
                        className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 text-left border-b border-gray-100 last:border-0">
                        <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold flex-shrink-0">{p.fullName.charAt(0)}</div>
                        <div><p className="text-sm font-medium text-gray-800">{p.fullName}</p><p className="text-xs text-gray-400">{p.currentJobTitle || '—'}</p></div>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Consulta */}
        <div className="card">
          <div className="card-header"><h2 className="text-sm font-semibold">Consulta</h2></div>
          <div className="card-body grid grid-cols-2 gap-4">
            <div>
              <label className="label">Médico *</label>
              <select value={form.doctorId} onChange={e => setForm(f => ({ ...f, doctorId: e.target.value, time: '' }))} className="input">
                <option value="">Selecionar...</option>
                {(doctors as any[]).map((d: any) => <option key={d.uid} value={d.uid}>Dr. {d.fullName}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Tipo *</label>
              <select value={form.appointmentType} onChange={e => setForm(f => ({ ...f, appointmentType: e.target.value }))} className="input">
                {Object.entries(APPOINTMENT_TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Sala</label>
              <select value={form.roomId} onChange={e => setForm(f => ({ ...f, roomId: e.target.value }))} className="input">
                <option value="">Sem sala</option>
                {(rooms as any[]).map((r: any) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Duração</label>
              <select value={form.durationMinutes} onChange={e => setForm(f => ({ ...f, durationMinutes: Number(e.target.value) }))} className="input">
                {[15,20,30,45,60,90].map(v => <option key={v} value={v}>{v} min</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Data e horário */}
        <div className="card">
          <div className="card-header"><h2 className="text-sm font-semibold flex items-center gap-2"><Clock size={14} className="text-blue-500"/> Data e Horário</h2></div>
          <div className="card-body space-y-4">
            <div>
              <label className="label">Data *</label>
              <input type="date" value={form.date} min={dayjs().format('YYYY-MM-DD')} onChange={e => setForm(f => ({ ...f, date: e.target.value, time: '' }))} className="input max-w-xs"/>
            </div>
            {form.doctorId && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="label mb-0">Horário *</label>
                  {loadingSlots && <Loader2 size={13} className="animate-spin text-blue-500"/>}
                  {!loadingSlots && slots.length > 0 && <span className="text-xs text-gray-400">{available.length} disponíveis</span>}
                </div>
                {available.length === 0 && !loadingSlots ? (
                  <p className="text-sm text-gray-400">Nenhum horário disponível nesta data.</p>
                ) : (
                  <div className="grid grid-cols-5 sm:grid-cols-7 gap-2">
                    {available.map((s: any) => (
                      <button key={s.time} type="button" onClick={() => setForm(f => ({ ...f, time: s.time }))}
                        className={clsx('px-2 py-2 rounded-lg text-sm font-medium border transition-all', form.time === s.time ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-200 hover:border-blue-300 hover:bg-blue-50')}>
                        {s.time}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            <div>
              <label className="label">Observações</label>
              <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className="input min-h-[60px]" placeholder="Opcional..."/>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <button type="button" onClick={() => navigate(-1)} className="btn-secondary">Cancelar</button>
          <button onClick={() => mutation.mutate()} disabled={mutation.isPending || !form.patientId || !form.doctorId || !form.time} className="btn-primary">
            {mutation.isPending ? <><Loader2 size={15} className="animate-spin"/> Criando...</> : <><Save size={15}/> Confirmar</>}
          </button>
        </div>
      </div>
    </div>
  )
}
