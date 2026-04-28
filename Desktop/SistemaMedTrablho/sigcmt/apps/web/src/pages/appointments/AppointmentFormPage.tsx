import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import toast from 'react-hot-toast'
import { ArrowLeft, Loader2, Save, Clock, Search } from 'lucide-react'
import dayjs from 'dayjs'
import clsx from 'clsx'

const appointmentTypes = [
  { value:'INITIAL', label:'Consulta Inicial' },
  { value:'PERIODIC', label:'Periódico' },
  { value:'DISMISSAL', label:'Demissional' },
  { value:'ASO', label:'ASO' },
  { value:'FOLLOWUP', label:'Acompanhamento' },
  { value:'RETURN', label:'Retorno' },
]

export default function AppointmentFormPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [searchParams] = useSearchParams()

  const [form, setForm] = useState({
    patientId: searchParams.get('patientId') || '',
    doctorId: '',
    roomId: '',
    appointmentType: 'INITIAL',
    date: dayjs().add(1, 'day').format('YYYY-MM-DD'),
    time: '',
    durationMinutes: 30,
    notes: '',
  })
  const [patientSearch, setPatientSearch] = useState('')
  const [patientSearchDebounced, setPatientSearchDebounced] = useState('')

  // Debounce busca de paciente
  useEffect(() => {
    const t = setTimeout(() => setPatientSearchDebounced(patientSearch), 400)
    return () => clearTimeout(t)
  }, [patientSearch])

  const { data: doctors } = useQuery({
    queryKey: ['doctors'],
    queryFn: () => api.get('/users/doctors/available').then(r => r.data.data),
  })

  const { data: rooms } = useQuery({
    queryKey: ['rooms'],
    queryFn: () => api.get('/appointments/rooms').then(r => r.data.data),
  })

  const { data: patientsResult } = useQuery({
    queryKey: ['patients-search', patientSearchDebounced],
    queryFn: () => api.get('/patients', { params: { search: patientSearchDebounced, limit: 8 } }).then(r => r.data.data),
    enabled: patientSearchDebounced.length >= 2,
  })

  const { data: selectedPatient } = useQuery({
    queryKey: ['patient', form.patientId],
    queryFn: () => api.get(`/patients/${form.patientId}`).then(r => r.data.data),
    enabled: Boolean(form.patientId),
  })

  const { data: slots, isFetching: loadingSlots } = useQuery({
    queryKey: ['slots', form.doctorId, form.date],
    queryFn: () => api.get('/appointments/availability', { params: { doctorId: form.doctorId, date: form.date } }).then(r => r.data.data),
    enabled: Boolean(form.doctorId && form.date),
  })

  const mutation = useMutation({
    mutationFn: (data: any) => api.post('/appointments', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['appointments'] })
      toast.success('Agendamento criado com sucesso!')
      navigate('/appointments')
    },
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.patientId) return toast.error('Selecione um paciente.')
    if (!form.doctorId) return toast.error('Selecione um médico.')
    if (!form.time) return toast.error('Selecione um horário.')

    const scheduledAt = dayjs(`${form.date}T${form.time}:00`).toISOString()
    mutation.mutate({
      patientId: form.patientId,
      doctorId: form.doctorId,
      roomId: form.roomId || undefined,
      appointmentType: form.appointmentType,
      scheduledAt,
      durationMinutes: form.durationMinutes,
      notes: form.notes || undefined,
    })
  }

  const availableSlots = slots?.slots?.filter((s: any) => s.available) || []
  const occupancyPct = slots?.occupancyPct ?? 0
  const occupancyColor = occupancyPct >= 80 ? 'text-red-500' : occupancyPct >= 50 ? 'text-yellow-500' : 'text-green-500'

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="btn-ghost btn-sm"><ArrowLeft size={16} /></button>
        <h1>Novo Agendamento</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Paciente */}
        <div className="card">
          <div className="card-header"><h2 className="text-base font-semibold">Paciente</h2></div>
          <div className="card-body space-y-3">
            {selectedPatient ? (
              <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
                <div className="w-10 h-10 rounded-full bg-blue-200 flex items-center justify-center text-blue-700 font-bold text-sm flex-shrink-0">
                  {selectedPatient.fullName.charAt(0)}
                </div>
                <div className="flex-1">
                  <p className="font-medium text-gray-800">{selectedPatient.fullName}</p>
                  <p className="text-xs text-gray-500">{selectedPatient.currentJobTitle || 'Sem cargo'}</p>
                </div>
                <button type="button" onClick={() => setForm(f => ({ ...f, patientId: '' }))} className="text-xs text-blue-600 hover:text-blue-700">Trocar</button>
              </div>
            ) : (
              <>
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    value={patientSearch}
                    onChange={e => setPatientSearch(e.target.value)}
                    placeholder="Buscar paciente por nome..."
                    className="input pl-9"
                  />
                </div>
                {patientsResult?.length > 0 && (
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    {patientsResult.map((p: any) => (
                      <button key={p.id} type="button"
                        onClick={() => { setForm(f => ({ ...f, patientId: p.id })); setPatientSearch('') }}
                        className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 text-left border-b border-gray-100 last:border-0"
                      >
                        <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold flex-shrink-0">
                          {p.fullName.charAt(0)}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-800">{p.fullName}</p>
                          <p className="text-xs text-gray-400">{p.currentJobTitle || 'Sem cargo'}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Médico e Tipo */}
        <div className="card">
          <div className="card-header"><h2 className="text-base font-semibold">Consulta</h2></div>
          <div className="card-body grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Médico *</label>
              <select value={form.doctorId} onChange={e => setForm(f => ({ ...f, doctorId: e.target.value, time: '' }))} className="input">
                <option value="">Selecionar médico...</option>
                {doctors?.map((d: any) => <option key={d.id} value={d.id}>Dr. {d.fullName}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Tipo de atendimento *</label>
              <select value={form.appointmentType} onChange={e => setForm(f => ({ ...f, appointmentType: e.target.value }))} className="input">
                {appointmentTypes.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Sala</label>
              <select value={form.roomId} onChange={e => setForm(f => ({ ...f, roomId: e.target.value }))} className="input">
                <option value="">Sem sala definida</option>
                {rooms?.map((r: any) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Duração (min)</label>
              <select value={form.durationMinutes} onChange={e => setForm(f => ({ ...f, durationMinutes: Number(e.target.value) }))} className="input">
                {[15,20,30,45,60,90].map(v => <option key={v} value={v}>{v} minutos</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Data e Horário */}
        <div className="card">
          <div className="card-header"><h2 className="text-base font-semibold flex items-center gap-2"><Clock size={14} className="text-blue-500" /> Data e Horário</h2></div>
          <div className="card-body space-y-4">
            <div>
              <label className="label">Data *</label>
              <input type="date" value={form.date} min={dayjs().format('YYYY-MM-DD')}
                onChange={e => setForm(f => ({ ...f, date: e.target.value, time: '' }))} className="input max-w-xs" />
            </div>

            {form.doctorId && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="label mb-0">Horário disponível *</label>
                  {loadingSlots && <Loader2 size={14} className="animate-spin text-blue-500" />}
                  {slots && !loadingSlots && (
                    <span className={`text-xs font-medium ${occupancyColor}`}>
                      {slots.availableSlots}/{slots.totalSlots} disponíveis ({occupancyPct}% ocupado)
                    </span>
                  )}
                </div>
                {availableSlots.length === 0 && !loadingSlots ? (
                  <p className="text-sm text-gray-400 py-3">Nenhum horário disponível nesta data.</p>
                ) : (
                  <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                    {availableSlots.map((slot: any) => (
                      <button
                        key={slot.time} type="button"
                        onClick={() => setForm(f => ({ ...f, time: slot.time }))}
                        className={clsx(
                          'px-2 py-2 rounded-lg text-sm font-medium border transition-all',
                          form.time === slot.time
                            ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                            : 'bg-white text-gray-700 border-gray-200 hover:border-blue-300 hover:bg-blue-50'
                        )}
                      >
                        {slot.time}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div>
              <label className="label">Observações</label>
              <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                className="input min-h-[70px]" placeholder="Observações adicionais (opcional)..." />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <button type="button" onClick={() => navigate(-1)} className="btn-secondary">Cancelar</button>
          <button type="submit" disabled={mutation.isPending || !form.patientId || !form.doctorId || !form.time} className="btn-primary">
            {mutation.isPending ? <><Loader2 size={16} className="animate-spin" /> Criando...</> : <><Save size={16} /> Confirmar agendamento</>}
          </button>
        </div>
      </form>
    </div>
  )
}
