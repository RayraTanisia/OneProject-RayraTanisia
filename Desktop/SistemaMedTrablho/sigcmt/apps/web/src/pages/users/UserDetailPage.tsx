import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { ArrowLeft, Edit, Save, Plus, Trash2, Clock, Ban } from 'lucide-react'
import toast from 'react-hot-toast'
import dayjs from 'dayjs'

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Administrador', MANAGER: 'Gerente', DOCTOR: 'Médico',
  NURSE: 'Enfermeiro(a)', RECEPTIONIST: 'Recepcionista', BILLING: 'Faturamento',
  HR: 'RH', PSYCHOLOGIST: 'Psicólogo(a)',
}

const DAYS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']
const DAYS_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

interface Schedule {
  dayOfWeek: number
  startTime: string
  endTime: string
  slotDurationMin: number
  breakStart?: string
  breakEnd?: string
  active: boolean
}

const defaultSchedule = (): Schedule => ({
  dayOfWeek: 1, startTime: '08:00', endTime: '18:00',
  slotDurationMin: 30, breakStart: '12:00', breakEnd: '13:00', active: true,
})

function ScheduleRow({ s, onChange, onRemove }: {
  s: Schedule
  onChange: (field: keyof Schedule, value: string | number | boolean) => void
  onRemove: () => void
}) {
  return (
    <div className={`p-4 rounded-lg border ${s.active ? 'border-indigo-200 bg-indigo-50' : 'border-gray-200 bg-gray-50'}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <input type="checkbox" checked={s.active} onChange={e => onChange('active', e.target.checked)}
            className="w-4 h-4 accent-indigo-600" />
          <select
            className="border border-gray-200 rounded-lg px-2 py-1 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
            value={s.dayOfWeek}
            onChange={e => onChange('dayOfWeek', Number(e.target.value))}
          >
            {DAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
          </select>
        </div>
        <button onClick={onRemove} className="text-red-400 hover:text-red-600">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Início</label>
          <input type="time" value={s.startTime} onChange={e => onChange('startTime', e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Fim</label>
          <input type="time" value={s.endTime} onChange={e => onChange('endTime', e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Intervalo início</label>
          <input type="time" value={s.breakStart || ''} onChange={e => onChange('breakStart', e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Intervalo fim</label>
          <input type="time" value={s.breakEnd || ''} onChange={e => onChange('breakEnd', e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300" />
        </div>
        <div className="col-span-2 sm:col-span-1">
          <label className="block text-xs text-gray-500 mb-1">Duração slot (min)</label>
          <select value={s.slotDurationMin} onChange={e => onChange('slotDurationMin', Number(e.target.value))}
            className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300">
            {[15, 20, 30, 45, 60].map(v => <option key={v} value={v}>{v} min</option>)}
          </select>
        </div>
      </div>
    </div>
  )
}

export default function UserDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()

  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [schedulesDirty, setSchedulesDirty] = useState(false)
  const [blockForm, setBlockForm] = useState({ startAt: '', endAt: '', reason: '' })
  const [showBlockForm, setShowBlockForm] = useState(false)

  const { data: user, isLoading } = useQuery({
    queryKey: ['user', id],
    queryFn: () => api.get(`/users/${id}`).then(r => r.data.data),
    enabled: !!id,
  })

  const { data: schedulesData } = useQuery({
    queryKey: ['user-schedules', id],
    queryFn: () => api.get(`/users/${id}/schedules`).then(r => r.data.data),
    enabled: !!id && user?.role === 'DOCTOR',
  })

  useEffect(() => {
    if (schedulesData) {
      setSchedules(schedulesData)
      setSchedulesDirty(false)
    }
  }, [schedulesData])

  const saveSchedules = useMutation({
    mutationFn: () => api.put(`/users/${id}/schedules`, schedules),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['user-schedules', id] })
      setSchedulesDirty(false)
      toast.success('Agenda salva com sucesso!')
    },
    onError: () => toast.error('Erro ao salvar agenda'),
  })

  const { data: blockedSlots = [] } = useQuery<any[]>({
    queryKey: ['blocked-slots', id],
    queryFn: () => api.get(`/appointments/blocked-slots?doctorId=${id}`).then(r => r.data.data),
    enabled: !!id && user?.role === 'DOCTOR',
  })

  const addBlock = useMutation({
    mutationFn: () => api.post('/appointments/blocked-slots', { ...blockForm, doctorId: id }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['blocked-slots', id] })
      setBlockForm({ startAt: '', endAt: '', reason: '' })
      setShowBlockForm(false)
      toast.success('Bloqueio adicionado!')
    },
    onError: () => toast.error('Erro ao adicionar bloqueio'),
  })

  const removeBlock = useMutation({
    mutationFn: (slotId: string) => api.delete(`/appointments/blocked-slots/${slotId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['blocked-slots', id] })
      toast.success('Bloqueio removido.')
    },
  })

  function addSchedule() {
    const usedDays = schedules.map(s => s.dayOfWeek)
    const next = [1, 2, 3, 4, 5, 6, 0].find(d => !usedDays.includes(d)) ?? 1
    setSchedules(prev => [...prev, { ...defaultSchedule(), dayOfWeek: next }])
    setSchedulesDirty(true)
  }

  function updateSchedule(i: number, field: keyof Schedule, value: string | number | boolean) {
    setSchedules(prev => prev.map((s, idx) => idx === i ? { ...s, [field]: value } : s))
    setSchedulesDirty(true)
  }

  function removeSchedule(i: number) {
    setSchedules(prev => prev.filter((_, idx) => idx !== i))
    setSchedulesDirty(true)
  }

  if (isLoading || !user) {
    return <div className="flex justify-center items-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" /></div>
  }

  const isDoctor = user.role === 'DOCTOR'
  const activeDays = schedules.filter(s => s.active).map(s => DAYS_SHORT[s.dayOfWeek])

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <button onClick={() => navigate('/users')} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
          <ArrowLeft className="w-4 h-4" /> Equipe
        </button>
        <Link to={`/users/${id}/edit`}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">
          <Edit className="w-4 h-4" /> Editar
        </Link>
      </div>

      {/* Cabeçalho do perfil */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 flex items-start gap-5">
        <div className={`w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold flex-shrink-0 ${isDoctor ? 'bg-blue-100 text-blue-700' : 'bg-indigo-100 text-indigo-700'}`}>
          {user.fullName.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-gray-900">{user.fullName}</h1>
          <p className="text-sm text-gray-500">{ROLE_LABELS[user.role] || user.role}</p>
          {isDoctor && user.crmNumber && (
            <p className="text-sm text-blue-600 font-medium mt-1">CRM {user.crmNumber}/{user.crmState}</p>
          )}
          <div className="flex flex-wrap gap-4 mt-3 text-sm text-gray-500">
            <span>{user.email}</span>
            {user.phone && <span>{user.phone}</span>}
            {user.lastLoginAt && <span>Último acesso: {new Date(user.lastLoginAt).toLocaleDateString('pt-BR')}</span>}
          </div>
        </div>
        <span className={`px-2 py-1 rounded text-xs font-medium ${user.active ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}`}>
          {user.active ? 'Ativo' : 'Inativo'}
        </span>
      </div>

      {/* Seção específica de médico */}
      {isDoctor && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-indigo-500" />
              <h2 className="font-semibold text-gray-800">Horários de Atendimento</h2>
            </div>
            <div className="flex items-center gap-2">
              {schedulesDirty && (
                <button
                  onClick={() => saveSchedules.mutate()}
                  disabled={saveSchedules.isPending}
                  className="inline-flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-50 font-medium"
                >
                  <Save className="w-4 h-4" />
                  {saveSchedules.isPending ? 'Salvando...' : 'Salvar agenda'}
                </button>
              )}
              <button
                onClick={addSchedule}
                disabled={schedules.length >= 7}
                className="inline-flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-800 border border-indigo-200 px-3 py-2 rounded-lg hover:bg-indigo-50 disabled:opacity-40"
              >
                <Plus className="w-4 h-4" /> Adicionar dia
              </button>
            </div>
          </div>

          {/* Resumo visual */}
          {schedules.length > 0 && (
            <div className="flex gap-1.5 mb-4 flex-wrap">
              {DAYS_SHORT.map((d, i) => {
                const s = schedules.find(x => x.dayOfWeek === i)
                return (
                  <div key={i} className={`px-2 py-1 rounded text-xs font-medium ${s?.active ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-400'}`}>
                    {d}
                    {s?.active && <span className="block text-center" style={{ fontSize: 9 }}>{s.startTime}–{s.endTime}</span>}
                  </div>
                )
              })}
            </div>
          )}

          {schedules.length === 0 ? (
            <div className="text-center py-8 border-2 border-dashed border-gray-200 rounded-xl">
              <Clock className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-400 mb-3">Nenhum horário configurado</p>
              <button onClick={addSchedule}
                className="inline-flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-800">
                <Plus className="w-4 h-4" /> Adicionar horário
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {schedules.map((s, i) => (
                <ScheduleRow key={i} s={s}
                  onChange={(field, value) => updateSchedule(i, field, value)}
                  onRemove={() => removeSchedule(i)}
                />
              ))}
            </div>
          )}

          {activeDays.length > 0 && !schedulesDirty && (
            <p className="text-xs text-gray-400 mt-3">
              Atende: {activeDays.join(', ')}
            </p>
          )}
        </div>
      )}

      {/* Bloqueio de horários — somente médicos */}
      {isDoctor && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Ban className="w-5 h-5 text-red-400" />
              <h2 className="font-semibold text-gray-800">Bloqueios de Agenda</h2>
              {blockedSlots.length > 0 && (
                <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded-full font-medium">{blockedSlots.length}</span>
              )}
            </div>
            <button
              onClick={() => setShowBlockForm(v => !v)}
              className="inline-flex items-center gap-1 text-sm text-red-600 hover:text-red-800 border border-red-200 px-3 py-2 rounded-lg hover:bg-red-50"
            >
              <Plus className="w-4 h-4" /> Adicionar bloqueio
            </button>
          </div>

          {showBlockForm && (
            <div className="mb-4 p-4 border border-red-100 bg-red-50 rounded-xl space-y-3">
              <p className="text-sm font-medium text-red-700">Novo bloqueio de agenda</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Início</label>
                  <input
                    type="datetime-local"
                    value={blockForm.startAt}
                    onChange={e => setBlockForm(f => ({ ...f, startAt: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-300 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Fim</label>
                  <input
                    type="datetime-local"
                    value={blockForm.endAt}
                    onChange={e => setBlockForm(f => ({ ...f, endAt: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-300 bg-white"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Motivo</label>
                <input
                  placeholder="Ex: Férias, Congresso, Licença médica..."
                  value={blockForm.reason}
                  onChange={e => setBlockForm(f => ({ ...f, reason: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-300 bg-white"
                />
              </div>
              <div className="flex gap-2 justify-end">
                <button onClick={() => setShowBlockForm(false)}
                  className="px-3 py-1.5 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">
                  Cancelar
                </button>
                <button
                  onClick={() => {
                    if (!blockForm.startAt || !blockForm.endAt) { toast.error('Preencha início e fim'); return }
                    if (blockForm.startAt >= blockForm.endAt) { toast.error('Início deve ser antes do fim'); return }
                    addBlock.mutate()
                  }}
                  disabled={addBlock.isPending}
                  className="px-4 py-1.5 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                >
                  {addBlock.isPending ? 'Salvando...' : 'Salvar bloqueio'}
                </button>
              </div>
            </div>
          )}

          {blockedSlots.length === 0 ? (
            <div className="text-center py-6 border-2 border-dashed border-gray-200 rounded-xl">
              <Ban className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-400">Nenhum bloqueio cadastrado</p>
            </div>
          ) : (
            <div className="space-y-2">
              {blockedSlots.map((slot: any) => (
                <div key={slot.id} className="flex items-center gap-3 p-3 border border-red-100 bg-red-50 rounded-lg">
                  <Ban className="w-4 h-4 text-red-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800">
                      {dayjs(slot.startAt).format('DD/MM/YYYY HH:mm')} → {dayjs(slot.endAt).format('DD/MM/YYYY HH:mm')}
                    </p>
                    {slot.reason && <p className="text-xs text-gray-500 mt-0.5">{slot.reason}</p>}
                  </div>
                  <button
                    onClick={() => { if (confirm('Remover este bloqueio?')) removeBlock.mutate(slot.id) }}
                    className="text-red-400 hover:text-red-700 flex-shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Para não-médicos: informações gerais */}
      {!isDoctor && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="font-semibold text-gray-800 mb-4">Permissões do perfil</h2>
          <div className="grid grid-cols-2 gap-3">
            {[
              { key: 'ADMIN', label: 'Acesso total ao sistema, usuários e configurações' },
              { key: 'MANAGER', label: 'Gerenciar equipe, relatórios e empresas' },
              { key: 'RECEPTIONIST', label: 'Agendamentos, pacientes e check-in' },
              { key: 'BILLING', label: 'Faturamento e relatórios financeiros' },
              { key: 'NURSE', label: 'Triagem, prontuário e agendamentos' },
              { key: 'HR', label: 'Gestão de funcionários e empresas' },
            ].filter(p => p.key === user.role).map(p => (
              <div key={p.key} className="col-span-2 p-4 bg-indigo-50 rounded-lg border border-indigo-100">
                <p className="text-sm font-medium text-indigo-700">{ROLE_LABELS[p.key]}</p>
                <p className="text-xs text-indigo-500 mt-1">{p.label}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-4">Membro desde {new Date(user.createdAt).toLocaleDateString('pt-BR')}</p>
        </div>
      )}
    </div>
  )
}
