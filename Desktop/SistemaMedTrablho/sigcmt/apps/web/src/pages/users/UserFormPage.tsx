import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { ArrowLeft } from 'lucide-react'

const ROLES = [
  { value: 'DOCTOR', label: 'Médico' },
  { value: 'NURSE', label: 'Enfermeiro(a)' },
  { value: 'RECEPTIONIST', label: 'Recepcionista' },
  { value: 'MANAGER', label: 'Gerente' },
  { value: 'ADMIN', label: 'Administrador' },
  { value: 'BILLING', label: 'Faturamento' },
  { value: 'HR', label: 'RH' },
  { value: 'PSYCHOLOGIST', label: 'Psicólogo(a)' },
]

const STATES = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO']

export default function UserFormPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const isEdit = Boolean(id)

  const [form, setForm] = useState({
    fullName: '', email: '', password: '', role: 'RECEPTIONIST',
    crmNumber: '', crmState: 'MT', phone: '',
  })
  const [error, setError] = useState('')

  const { data: existing } = useQuery({
    queryKey: ['user', id],
    queryFn: () => api.get(`/users/${id}`).then(r => r.data.data),
    enabled: isEdit,
  })

  useEffect(() => {
    if (existing) {
      setForm({
        fullName: existing.fullName || '',
        email: existing.email || '',
        password: '',
        role: existing.role || 'RECEPTIONIST',
        crmNumber: existing.crmNumber || '',
        crmState: existing.crmState || 'MT',
        phone: existing.phone || '',
      })
    }
  }, [existing])

  const set = (field: string, value: string) => setForm(f => ({ ...f, [field]: value }))

  const mutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      isEdit
        ? api.put(`/users/${id}`, body)
        : api.post('/users', body),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['users'] })
      navigate(`/users/${res.data.data.id}`)
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message
      setError(msg || 'Erro ao salvar usuário')
    },
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const body: Record<string, unknown> = {
      fullName: form.fullName,
      email: form.email,
      role: form.role,
      phone: form.phone || undefined,
      crmNumber: form.role === 'DOCTOR' ? (form.crmNumber || undefined) : undefined,
      crmState: form.role === 'DOCTOR' ? (form.crmState || undefined) : undefined,
    }
    if (!isEdit || form.password) body.password = form.password
    mutation.mutate(body)
  }

  const isDoctor = form.role === 'DOCTOR'

  return (
    <div className="p-6 max-w-xl mx-auto">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4">
        <ArrowLeft className="w-4 h-4" /> Voltar
      </button>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">{isEdit ? 'Editar Usuário' : 'Novo Usuário'}</h1>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Dados pessoais */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <h2 className="font-semibold text-gray-700">Dados pessoais</h2>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Nome completo *</label>
            <input
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
              value={form.fullName} onChange={e => set('fullName', e.target.value)} required
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">E-mail *</label>
            <input
              type="email"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
              value={form.email} onChange={e => set('email', e.target.value)} required disabled={isEdit}
            />
            {isEdit && <p className="text-xs text-gray-400 mt-1">E-mail não pode ser alterado</p>}
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Telefone</label>
            <input
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
              placeholder="(65) 99999-9999"
              value={form.phone} onChange={e => set('phone', e.target.value)}
            />
          </div>
        </div>

        {/* Acesso */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <h2 className="font-semibold text-gray-700">Acesso</h2>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Cargo / Perfil *</label>
            <select
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
              value={form.role} onChange={e => set('role', e.target.value)}
            >
              {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">
              {isEdit ? 'Nova senha (deixe em branco para não alterar)' : 'Senha *'}
            </label>
            <input
              type="password"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
              placeholder={isEdit ? 'Nova senha...' : 'Mínimo 8 caracteres, 1 maiúscula, 1 número, 1 especial'}
              value={form.password} onChange={e => set('password', e.target.value)}
              required={!isEdit}
            />
          </div>
        </div>

        {/* Dados do médico */}
        {isDoctor && (
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
            <h2 className="font-semibold text-gray-700">Dados médicos</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-600 mb-1">Número CRM</label>
                <input
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  placeholder="123456"
                  value={form.crmNumber} onChange={e => set('crmNumber', e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Estado CRM</label>
                <select
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  value={form.crmState} onChange={e => set('crmState', e.target.value)}
                >
                  {STATES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
              Após criar o médico, vá ao perfil dele para configurar os horários de atendimento.
            </p>
          </div>
        )}

        {error && <p className="text-sm text-red-600 bg-red-50 px-4 py-2 rounded-lg">{error}</p>}

        <div className="flex justify-end gap-3">
          <button type="button" onClick={() => navigate(-1)}
            className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">
            Cancelar
          </button>
          <button type="submit" disabled={mutation.isPending}
            className="px-6 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 font-medium">
            {mutation.isPending ? 'Salvando...' : isEdit ? 'Salvar alterações' : 'Criar usuário'}
          </button>
        </div>
      </form>
    </div>
  )
}
