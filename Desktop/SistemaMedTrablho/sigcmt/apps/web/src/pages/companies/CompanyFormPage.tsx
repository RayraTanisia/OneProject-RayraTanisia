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
  cnpj: z.string().min(11, 'CNPJ inválido'),
  legalName: z.string().min(3, 'Razão social obrigatória'),
  tradeName: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email('E-mail inválido').optional().or(z.literal('')),
  cnae: z.string().optional(),
  riskLevel: z.coerce.number().int().min(1).max(4),
  sector: z.string().optional(),
  employeeCount: z.coerce.number().int().positive().optional().or(z.literal('')),
  status: z.enum(['ACTIVE', 'INACTIVE', 'PROSPECT']),
  street: z.string().optional(),
  number: z.string().optional(),
  neighborhood: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zip: z.string().optional(),
})
type FormData = z.infer<typeof schema>

export default function CompanyFormPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const qc = useQueryClient()
  const isEdit = Boolean(id)
  const [ocrLoading, setOcrLoading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const { data: existing, isLoading: loadingExisting } = useQuery({
    queryKey: ['company', id],
    queryFn: () => api.get(`/companies/${id}`).then(r => r.data.data),
    enabled: isEdit,
  })

  const { register, handleSubmit, reset, setValue, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { riskLevel: 1, status: 'ACTIVE' },
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
      if (!isEdit && d.cnpj) setValue('cnpj', d.cnpj)
      if (d.razaoSocial) setValue('legalName', d.razaoSocial)
      if (d.responsavel) setValue('tradeName', d.responsavel)
      if (d.email) setValue('email', d.email)
      if (d.telefone) setValue('phone', d.telefone)
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
      if (prefill.cnpj) setValue('cnpj', prefill.cnpj)
      if (prefill.legalName) setValue('legalName', prefill.legalName)
      if (prefill.tradeName) setValue('tradeName', prefill.tradeName)
      if (prefill.phone) setValue('phone', prefill.phone)
      if (prefill.email) setValue('email', prefill.email)
      if (prefill.cnae) setValue('cnae', prefill.cnae)
      if (prefill.riskLevel) setValue('riskLevel', Number(prefill.riskLevel))
      if (prefill.employeeCount) setValue('employeeCount', Number(prefill.employeeCount))
      if (prefill.city) setValue('city', prefill.city)
      if (prefill.state) setValue('state', prefill.state)
      if (prefill.street) setValue('street', prefill.street)
      if (prefill.zip) setValue('zip', prefill.zip)
      toast.success('Dados do PCMSO importados. Verifique e complete o cadastro.')
    }
  }, [])

  useEffect(() => {
    if (existing) {
      reset({
        cnpj: existing.cnpj || '',
        legalName: existing.legalName || '',
        tradeName: existing.tradeName || '',
        phone: existing.phone || '',
        email: existing.email || '',
        cnae: existing.cnae || '',
        riskLevel: existing.riskLevel || 1,
        sector: existing.sector || '',
        employeeCount: existing.employeeCount || '',
        status: existing.status || 'ACTIVE',
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
    mutationFn: (data: any) => isEdit ? api.put(`/companies/${id}`, data) : api.post('/companies', data),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['companies'] })
      if (id) qc.invalidateQueries({ queryKey: ['company', id] })
      toast.success(isEdit ? 'Empresa atualizada!' : 'Empresa cadastrada!')
      navigate(isEdit ? `/companies/${id}` : `/companies/${res.data.data.id}`)
    },
    onError: (e: any) => {
      toast.error(e?.response?.data?.error?.message || 'Erro ao salvar empresa.')
    },
  })

  function onSubmit(data: FormData) {
    const payload: any = {
      legalName: data.legalName,
      tradeName: data.tradeName || undefined,
      phone: data.phone || undefined,
      email: data.email || undefined,
      cnae: data.cnae || undefined,
      riskLevel: Number(data.riskLevel),
      sector: data.sector || undefined,
      employeeCount: data.employeeCount ? Number(data.employeeCount) : undefined,
      status: data.status,
      address: {
        street: data.street, number: data.number, neighborhood: data.neighborhood,
        city: data.city, state: data.state, zip: data.zip,
      },
    }
    if (!isEdit) payload.cnpj = data.cnpj.replace(/\D/g, '')
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
          <h1>{isEdit ? 'Editar Empresa' : 'Nova Empresa'}</h1>
        </div>
        <button type="button" onClick={() => fileRef.current?.click()} disabled={ocrLoading} className="btn-secondary">
          {ocrLoading ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} />}
          {ocrLoading ? 'Lendo...' : 'Escanear Documento'}
        </button>
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleOcrUpload} />
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Dados da empresa */}
        <div className="card">
          <div className="card-header"><h2 className="text-base font-semibold">Dados da Empresa</h2></div>
          <div className="card-body grid grid-cols-1 sm:grid-cols-2 gap-4">
            {!isEdit && (
              <div>
                <label className="label">CNPJ *</label>
                <input {...register('cnpj')} className="input" placeholder="00.000.000/0000-00" />
                {errors.cnpj && <p className="error-msg">{errors.cnpj.message}</p>}
              </div>
            )}
            <div className={!isEdit ? '' : 'sm:col-span-2'}>
              <label className="label">Razão Social *</label>
              <input {...register('legalName')} className="input" placeholder="Nome jurídico completo" />
              {errors.legalName && <p className="error-msg">{errors.legalName.message}</p>}
            </div>
            <div className="sm:col-span-2">
              <label className="label">Nome Fantasia</label>
              <input {...register('tradeName')} className="input" placeholder="Nome comercial (opcional)" />
            </div>
            <div>
              <label className="label">CNAE</label>
              <input {...register('cnae')} className="input" placeholder="Ex: 8630-5/04" />
            </div>
            <div>
              <label className="label">Setor de Atividade</label>
              <input {...register('sector')} className="input" placeholder="Ex: Construção Civil, Agronegócio..." />
            </div>
            <div>
              <label className="label">Grau de Risco</label>
              <select {...register('riskLevel')} className="input">
                <option value={1}>Grau 1 — Baixo</option>
                <option value={2}>Grau 2 — Médio</option>
                <option value={3}>Grau 3 — Alto</option>
                <option value={4}>Grau 4 — Crítico</option>
              </select>
            </div>
            <div>
              <label className="label">Nº de Funcionários</label>
              <input {...register('employeeCount')} type="number" className="input" placeholder="Ex: 50" />
            </div>
            <div>
              <label className="label">Status</label>
              <select {...register('status')} className="input">
                <option value="ACTIVE">Ativa</option>
                <option value="INACTIVE">Inativa</option>
                <option value="PROSPECT">Prospecto</option>
              </select>
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
              <label className="label">E-mail</label>
              <input {...register('email')} type="email" className="input" placeholder="contato@empresa.com" />
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
