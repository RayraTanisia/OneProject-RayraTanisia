import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import toast from 'react-hot-toast'
import { ArrowLeft, Camera, Loader2, Save } from 'lucide-react'

const schema = z.object({
  fullName: z.string().min(3, 'Nome deve ter ao menos 3 caracteres'),
  cpf: z.string().regex(/^\d{3}\.?\d{3}\.?\d{3}-?\d{2}$/, 'CPF inválido').optional().or(z.literal('')),
  rg: z.string().optional(),
  birthDate: z.string().optional(),
  gender: z.enum(['male','female','other','prefer_not']).optional(),
  bloodType: z.enum(['A+','A-','B+','B-','AB+','AB-','O+','O-','']).optional(),
  phone: z.string().optional(),
  email: z.string().email('E-mail inválido').optional().or(z.literal('')),
  whatsapp: z.string().optional(),
  currentCompanyId: z.string().optional(),
  currentJobTitle: z.string().optional(),
  medicalRestrictions: z.string().optional(),
  heightCm: z.coerce.number().positive().optional().or(z.literal('')),
  weightKg: z.coerce.number().positive().optional().or(z.literal('')),
  street: z.string().optional(),
  number: z.string().optional(),
  neighborhood: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zip: z.string().optional(),
})
type FormData = z.infer<typeof schema>

export default function PatientFormPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const qc = useQueryClient()
  const isEdit = Boolean(id)
  const [ocrLoading, setOcrLoading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const { data: existing, isLoading: loadingExisting } = useQuery({
    queryKey: ['patient', id],
    queryFn: () => api.get(`/patients/${id}`).then(r => r.data.data),
    enabled: isEdit,
  })

  const { data: companies } = useQuery({
    queryKey: ['companies-list'],
    queryFn: () => api.get('/companies', { params: { limit: 100, status: 'ACTIVE' } }).then(r => r.data.data),
  })

  const { register, handleSubmit, reset, setValue, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  async function handleOcrUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setOcrLoading(true)
    try {
      const reader = new FileReader()
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve((reader.result as string).split(',')[1])
        reader.onerror = reject
        reader.readAsDataURL(file)
      })
      const mimeType = file.type as 'image/jpeg' | 'image/png' | 'image/webp'
      const res = await api.post('/documents/analyze', { image: base64, mimeType })
      const d = res.data.data
      if (d.nome) setValue('fullName', d.nome)
      if (!isEdit && d.cpf) setValue('cpf', d.cpf)
      if (d.rg) setValue('rg', d.rg)
      if (d.dataNascimento) setValue('birthDate', d.dataNascimento.slice(0, 10))
      if (d.cargo) setValue('currentJobTitle', d.cargo)
      toast.success(`Documento lido (confiança: ${d.confianca}). Verifique os campos preenchidos.`)
    } catch {
      toast.error('Não foi possível ler o documento.')
    } finally {
      setOcrLoading(false)
    }
  }

  useEffect(() => {
    const prefill = (location.state as any)?.prefill
    if (prefill && !isEdit) {
      if (prefill.fullName) setValue('fullName', prefill.fullName)
      if (prefill.cpf) setValue('cpf', prefill.cpf)
      if (prefill.rg) setValue('rg', prefill.rg)
      if (prefill.birthDate) setValue('birthDate', prefill.birthDate.slice(0, 10))
      if (prefill.phone) setValue('phone', prefill.phone)
      if (prefill.email) setValue('email', prefill.email)
      if (prefill.currentJobTitle) setValue('currentJobTitle', prefill.currentJobTitle)
      if (prefill.city) setValue('city', prefill.city)
      if (prefill.state) setValue('state', prefill.state)
      toast.success('Dados do ASO importados. Verifique e complete o cadastro.')
    }
  }, [])

  useEffect(() => {
    if (existing) {
      reset({
        fullName: existing.fullName,
        rg: existing.rg || '',
        birthDate: existing.birthDate ? existing.birthDate.slice(0, 10) : '',
        gender: existing.gender || undefined,
        bloodType: existing.bloodType || undefined,
        phone: existing.phone || '',
        email: existing.email || '',
        whatsapp: existing.whatsapp || '',
        currentCompanyId: existing.currentCompanyId || '',
        currentJobTitle: existing.currentJobTitle || '',
        medicalRestrictions: existing.medicalRestrictions || '',
        heightCm: existing.heightCm || '',
        weightKg: existing.weightKg || '',
        street: (existing.address as any)?.street || '',
        number: (existing.address as any)?.number || '',
        neighborhood: (existing.address as any)?.neighborhood || '',
        city: (existing.address as any)?.city || '',
        state: (existing.address as any)?.state || '',
        zip: (existing.address as any)?.zip || '',
      })
    }
  }, [existing])

  const mutation = useMutation({
    mutationFn: (data: any) => isEdit ? api.put(`/patients/${id}`, data) : api.post('/patients', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['patients'] })
      if (id) qc.invalidateQueries({ queryKey: ['patient', id] })
      toast.success(isEdit ? 'Paciente atualizado!' : 'Paciente cadastrado!')
      navigate(isEdit ? `/patients/${id}` : '/patients')
    },
  })

  function onSubmit(data: FormData) {
    const payload: any = {
      fullName: data.fullName,
      rg: data.rg || undefined,
      birthDate: data.birthDate || undefined,
      gender: data.gender || undefined,
      bloodType: data.bloodType || undefined,
      phone: data.phone || undefined,
      email: data.email || undefined,
      whatsapp: data.whatsapp || undefined,
      currentCompanyId: data.currentCompanyId || undefined,
      currentJobTitle: data.currentJobTitle || undefined,
      medicalRestrictions: data.medicalRestrictions || undefined,
      heightCm: data.heightCm ? Number(data.heightCm) : undefined,
      weightKg: data.weightKg ? Number(data.weightKg) : undefined,
      address: {
        street: data.street, number: data.number, neighborhood: data.neighborhood,
        city: data.city, state: data.state, zip: data.zip,
      },
      lgpdConsent: { consented: true, channels: ['email', 'whatsapp'] },
    }
    if (!isEdit && data.cpf) payload.cpf = data.cpf.replace(/\D/g, '')
    mutation.mutate(payload)
  }

  if (isEdit && loadingExisting) return (
    <div className="flex items-center justify-center py-20"><Loader2 size={28} className="animate-spin text-blue-500" /></div>
  )

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="btn-ghost btn-sm"><ArrowLeft size={16} /></button>
          <h1>{isEdit ? 'Editar Paciente' : 'Novo Paciente'}</h1>
        </div>
        <button type="button" onClick={() => fileRef.current?.click()} disabled={ocrLoading} className="btn-secondary">
          {ocrLoading ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} />}
          {ocrLoading ? 'Lendo...' : 'Escanear Documento'}
        </button>
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleOcrUpload} />
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Dados pessoais */}
        <div className="card">
          <div className="card-header"><h2 className="text-base font-semibold">Dados Pessoais</h2></div>
          <div className="card-body grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="label">Nome completo *</label>
              <input {...register('fullName')} className="input" placeholder="Nome completo do paciente" />
              {errors.fullName && <p className="error-msg">{errors.fullName.message}</p>}
            </div>
            {!isEdit && (
              <div>
                <label className="label">CPF *</label>
                <input {...register('cpf')} className="input" placeholder="000.000.000-00" />
                {errors.cpf && <p className="error-msg">{errors.cpf.message}</p>}
              </div>
            )}
            <div>
              <label className="label">RG</label>
              <input {...register('rg')} className="input" placeholder="Número do RG" />
            </div>
            <div>
              <label className="label">Data de nascimento</label>
              <input {...register('birthDate')} type="date" className="input" />
            </div>
            <div>
              <label className="label">Gênero</label>
              <select {...register('gender')} className="input">
                <option value="">Selecionar...</option>
                <option value="male">Masculino</option>
                <option value="female">Feminino</option>
                <option value="other">Outro</option>
                <option value="prefer_not">Prefiro não informar</option>
              </select>
            </div>
            <div>
              <label className="label">Grupo sanguíneo</label>
              <select {...register('bloodType')} className="input">
                <option value="">Selecionar...</option>
                {['A+','A-','B+','B-','AB+','AB-','O+','O-'].map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Altura (cm)</label>
              <input {...register('heightCm')} type="number" className="input" placeholder="170" />
            </div>
            <div>
              <label className="label">Peso (kg)</label>
              <input {...register('weightKg')} type="number" step="0.1" className="input" placeholder="70" />
            </div>
          </div>
        </div>

        {/* Contato */}
        <div className="card">
          <div className="card-header"><h2 className="text-base font-semibold">Contato</h2></div>
          <div className="card-body grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Telefone</label>
              <input {...register('phone')} className="input" placeholder="(65) 99999-0000" />
            </div>
            <div>
              <label className="label">WhatsApp</label>
              <input {...register('whatsapp')} className="input" placeholder="(65) 99999-0000" />
            </div>
            <div className="sm:col-span-2">
              <label className="label">E-mail</label>
              <input {...register('email')} type="email" className="input" placeholder="email@exemplo.com" />
              {errors.email && <p className="error-msg">{errors.email.message}</p>}
            </div>
          </div>
        </div>

        {/* Endereço */}
        <div className="card">
          <div className="card-header"><h2 className="text-base font-semibold">Endereço</h2></div>
          <div className="card-body grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label className="label">Logradouro</label>
              <input {...register('street')} className="input" placeholder="Rua, Avenida..." />
            </div>
            <div>
              <label className="label">Número</label>
              <input {...register('number')} className="input" placeholder="100" />
            </div>
            <div>
              <label className="label">Bairro</label>
              <input {...register('neighborhood')} className="input" />
            </div>
            <div>
              <label className="label">Cidade</label>
              <input {...register('city')} className="input" placeholder="Lucas do Rio Verde" />
            </div>
            <div>
              <label className="label">UF</label>
              <input {...register('state')} className="input" placeholder="MT" maxLength={2} />
            </div>
            <div>
              <label className="label">CEP</label>
              <input {...register('zip')} className="input" placeholder="78455-000" />
            </div>
          </div>
        </div>

        {/* Ocupacional */}
        <div className="card">
          <div className="card-header"><h2 className="text-base font-semibold">Dados Ocupacionais</h2></div>
          <div className="card-body grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Empresa</label>
              <select {...register('currentCompanyId')} className="input">
                <option value="">Sem empresa vinculada</option>
                {companies?.map((c: any) => (
                  <option key={c.id} value={c.id}>{c.tradeName || c.legalName}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Função/Cargo atual</label>
              <input {...register('currentJobTitle')} className="input" placeholder="Operador de máquinas, Técnico..." />
            </div>
            <div className="sm:col-span-2">
              <label className="label">Restrições médicas</label>
              <textarea {...register('medicalRestrictions')} className="input min-h-[80px]" placeholder="Descreva restrições médicas relevantes..." />
            </div>
          </div>
        </div>

        {/* Ações */}
        <div className="flex justify-end gap-3">
          <button type="button" onClick={() => navigate(-1)} className="btn-secondary">Cancelar</button>
          <button type="submit" disabled={isSubmitting || mutation.isPending} className="btn-primary">
            {(isSubmitting || mutation.isPending) ? <><Loader2 size={16} className="animate-spin" /> Salvando...</> : <><Save size={16} /> Salvar</>}
          </button>
        </div>
      </form>
    </div>
  )
}
