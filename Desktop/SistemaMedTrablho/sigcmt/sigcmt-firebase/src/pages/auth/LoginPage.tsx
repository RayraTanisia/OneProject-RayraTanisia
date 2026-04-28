import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { authService } from '../../lib/auth'
import { useAuthStore } from '../../store/auth'
import toast from 'react-hot-toast'
import { Eye, EyeOff, Stethoscope, Loader2 } from 'lucide-react'

const schema = z.object({
  email: z.string().email('E-mail inválido'),
  password: z.string().min(1, 'Senha obrigatória'),
})
type F = z.infer<typeof schema>

export default function LoginPage() {
  const navigate = useNavigate()
  const setUser = useAuthStore(s => s.setUser)
  const [show, setShow] = useState(false)
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<F>({ resolver: zodResolver(schema) })

  async function onSubmit(data: F) {
    try {
      const profile = await authService.login(data.email, data.password)
      setUser(profile)
      toast.success('Bem-vindo, ' + profile.fullName.split(' ')[0] + '!')
      navigate('/')
    } catch (e: any) {
      const msg = e.code === 'auth/invalid-credential' ? 'E-mail ou senha inválidos.' : e.message || 'Erro ao fazer login.'
      toast.error(msg)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-blue-700 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-white/10 rounded-2xl mb-4 backdrop-blur">
            <Stethoscope size={32} className="text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white">SIGCMT</h1>
          <p className="text-blue-200 mt-1 text-sm">Sistema de Gestão · Medicina do Trabalho</p>
        </div>
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-6">Entrar na sua conta</h2>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="label">E-mail</label>
              <input {...register('email')} type="email" className="input" placeholder="seu@email.com" autoFocus />
              {errors.email && <p className="error-msg">{errors.email.message}</p>}
            </div>
            <div>
              <label className="label">Senha</label>
              <div className="relative">
                <input {...register('password')} type={show ? 'text' : 'password'} className="input pr-10" placeholder="••••••••" />
                <button type="button" onClick={() => setShow(!show)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {show ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {errors.password && <p className="error-msg">{errors.password.message}</p>}
            </div>
            <button type="submit" disabled={isSubmitting} className="btn-primary w-full justify-center py-2.5">
              {isSubmitting ? <><Loader2 size={16} className="animate-spin" /> Entrando...</> : 'Entrar'}
            </button>
          </form>
          <div className="mt-6 p-4 bg-blue-50 rounded-xl border border-blue-100">
            <p className="text-xs font-semibold text-blue-700 mb-2">Credenciais de demonstração</p>
            <div className="space-y-1 text-xs text-blue-600">
              <p><span className="font-medium">Admin:</span> admin@sigcmt.com / Admin@2025</p>
              <p><span className="font-medium">Médico:</span> dr.silva@sigcmt.com / Medico@2025</p>
              <p><span className="font-medium">Recepção:</span> recepcao@sigcmt.com / Recepcao@2025</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
