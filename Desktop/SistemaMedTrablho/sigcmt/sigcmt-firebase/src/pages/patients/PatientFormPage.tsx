import { useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { patientService } from '../../lib/patients'
import { useAuthStore } from '../../store/auth'
import toast from 'react-hot-toast'
import { ArrowLeft, Loader2, Save } from 'lucide-react'

const schema = z.object({
  fullName: z.string().min(3, 'Mínimo 3 caracteres'),
  cpf: z.string().optional(),
  rg: z.string().optional(),
  birthDate: z.string().optional(),
  gender: z.enum(['male','female','other','prefer_not','']).optional(),
  bloodType: z.enum(['A+','A-','B+','B-','AB+','AB-','O+','O-','']).optional(),
  phone: z.string().optional(),
  email: z.string().email('E-mail inválido').optional().or(z.literal('')),
  whatsapp: z.string().optional(),
  currentJobTitle: z.string().optional(),
  medicalRestrictions: z.string().optional(),
  heightCm: z.coerce.number().positive().optional().or(z.literal('')),
  weightKg: z.coerce.number().positive().optional().or(z.literal('')),
  city: z.string().optional(),
  state: z.string().optional(),
  street: z.string().optional(),
  number: z.string().optional(),
  neighborhood: z.string().optional(),
  zip: z.string().optional(),
  lgpdConsent: z.boolean().default(false),
})
type F = z.infer<typeof schema>

export default function PatientFormPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const user = useAuthStore(s => s.user)
  const isEdit = Boolean(id)

  const { data: existing, isLoading } = useQuery({
    queryKey: ['patient', id],
    queryFn: () => patientService.getById(id!),
    enabled: isEdit,
  })

  const { register, handleSubmit, reset, watch, formState: { errors, isSubmitting } } = useForm<F>({
    resolver: zodResolver(schema),
    defaultValues: { lgpdConsent: false },
  })

  useEffect(() => {
    if (existing) {
      reset({
        fullName: existing.fullName,
        cpf: existing.cpf || '',
        rg: existing.rg || '',
        birthDate: existing.birthDate?.slice(0, 10) || '',
        gender: (existing.gender as any) || '',
        bloodType: (existing.bloodType as any) || '',
        phone: existing.phone || '',
        email: existing.email || '',
        whatsapp: existing.whatsapp || '',
        currentJobTitle: existing.currentJobTitle || '',
        medicalRestrictions: existing.medicalRestrictions || '',
        heightCm: existing.heightCm || '',
        weightKg: existing.weightKg || '',
        city: (existing.address as any)?.city || '',
        state: (existing.address as any)?.state || '',
        street: (existing.address as any)?.street || '',
        number: (existing.address as any)?.number || '',
        neighborhood: (existing.address as any)?.neighborhood || '',
        zip: (existing.address as any)?.zip || '',
        lgpdConsent: existing.lgpdConsent || false,
      })
    }
  }, [existing])

  const mutation = useMutation({
    mutationFn: async (data: F) => {
      const payload: any = {
        fullName: data.fullName,
        cpf: data.cpf || '',
        rg: data.rg || undefined,
        birthDate: data.birthDate || undefined,
        gender: data.gender || undefined,
        bloodType: data.bloodType || undefined,
        phone: data.phone || undefined,
        email: data.email || undefined,
        whatsapp: data.whatsapp || undefined,
        currentJobTitle: data.currentJobTitle || undefined,
        medicalRestrictions: data.medicalRestrictions || undefined,
        heightCm: data.heightCm ? Number(data.heightCm) : undefined,
        weightKg: data.weightKg ? Number(data.weightKg) : undefined,
        address: { street: data.street, number: data.number, neighborhood: data.neighborhood, city: data.city, state: data.state, zip: data.zip },
        occupationalRisks: existing?.occupationalRisks || [],
        allergies: existing?.allergies || [],
        continuousMedications: existing?.continuousMedications || [],
        status: existing?.status || 'ACTIVE',
        lgpdConsent: data.lgpdConsent,
        lgpdConsentDate: data.lgpdConsent ? new Date().toISOString() : undefined,
      }
      if (isEdit) return patientService.update(id!, payload)
      return patientService.create({ ...payload, createdBy: user?.uid || '' })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['patients'] })
      if (id) qc.invalidateQueries({ queryKey: ['patient', id] })
      toast.success(isEdit ? 'Paciente atualizado!' : 'Paciente cadastrado!')
      navigate(isEdit ? '/patients/' + id : '/patients')
    },
  })

  if (isEdit && isLoading) return <div className="flex justify-center py-20"><Loader2 size={26} className="animate-spin text-blue-500" /></div>

  return (
    <div className="max-w-3xl space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="btn-ghost btn-sm"><ArrowLeft size={16} /></button>
        <h1 className="text-xl font-bold">{isEdit ? 'Editar Paciente' : 'Novo Paciente'}</h1>
      </div>

      <form onSubmit={handleSubmit(d => mutation.mutate(d))} className="space-y-5">
        <div className="card">
          <div className="card-header"><h2 className="text-sm font-semibold">Dados Pessoais</h2></div>
          <div className="card-body grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="label">Nome completo *</label>
              <input {...register('fullName')} className="input" placeholder="Nome completo" />
              {errors.fullName && <p className="error-msg">{errors.fullName.message}</p>}
            </div>
            <div><label className="label">CPF</label><input {...register('cpf')} className="input" placeholder="000.000.000-00" /></div>
            <div><label className="label">RG</label><input {...register('rg')} className="input" /></div>
            <div><label className="label">Nascimento</label><input {...register('birthDate')} type="date" className="input" /></div>
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
                {['A+','A-','B+','B-','AB+','AB-','O+','O-'].map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div><label className="label">Altura (cm)</label><input {...register('heightCm')} type="number" className="input" placeholder="170" /></div>
            <div><label className="label">Peso (kg)</label><input {...register('weightKg')} type="number" step="0.1" className="input" placeholder="70" /></div>
          </div>
        </div>

        <div className="card">
          <div className="card-header"><h2 className="text-sm font-semibold">Contato</h2></div>
          <div className="card-body grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><label className="label">Telefone</label><input {...register('phone')} className="input" placeholder="(65) 99999-0000" /></div>
            <div><label className="label">WhatsApp</label><input {...register('whatsapp')} className="input" placeholder="(65) 99999-0000" /></div>
            <div className="sm:col-span-2">
              <label className="label">E-mail</label>
              <input {...register('email')} type="email" className="input" placeholder="email@exemplo.com" />
              {errors.email && <p className="error-msg">{errors.email.message}</p>}
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header"><h2 className="text-sm font-semibold">Endereço</h2></div>
          <div className="card-body grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div className="col-span-2"><label className="label">Logradouro</label><input {...register('street')} className="input" /></div>
            <div><label className="label">Número</label><input {...register('number')} className="input" /></div>
            <div><label className="label">Bairro</label><input {...register('neighborhood')} className="input" /></div>
            <div><label className="label">Cidade</label><input {...register('city')} className="input" /></div>
            <div><label className="label">UF</label><input {...register('state')} className="input" maxLength={2} /></div>
            <div><label className="label">CEP</label><input {...register('zip')} className="input" /></div>
          </div>
        </div>

        <div className="card">
          <div className="card-header"><h2 className="text-sm font-semibold">Ocupacional</h2></div>
          <div className="card-body space-y-3">
            <div><label className="label">Função/Cargo</label><input {...register('currentJobTitle')} className="input" /></div>
            <div><label className="label">Restrições médicas</label><textarea {...register('medicalRestrictions')} className="input min-h-[70px]" /></div>
          </div>
        </div>

        <div className="card">
          <div className="card-body">
            <label className="flex items-start gap-3 cursor-pointer">
              <input {...register('lgpdConsent')} type="checkbox" className="mt-0.5 w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
              <div>
                <p className="text-sm font-medium text-gray-800">Consentimento LGPD *</p>
                <p className="text-xs text-gray-500 mt-0.5">O paciente autoriza o tratamento de seus dados pessoais e de saúde para fins de atendimento médico, conforme a Lei Geral de Proteção de Dados (Lei 13.709/2018).</p>
              </div>
            </label>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <button type="button" onClick={() => navigate(-1)} className="btn-secondary">Cancelar</button>
          <button type="submit" disabled={isSubmitting || mutation.isPending} className="btn-primary">
            {(isSubmitting || mutation.isPending) ? <><Loader2 size={15} className="animate-spin" /> Salvando...</> : <><Save size={15} /> Salvar</>}
          </button>
        </div>
      </form>
    </div>
  )
}
