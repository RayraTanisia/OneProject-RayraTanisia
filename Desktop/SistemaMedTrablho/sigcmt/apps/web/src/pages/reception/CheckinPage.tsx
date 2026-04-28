import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import dayjs from 'dayjs'
import 'dayjs/locale/pt-br'
dayjs.locale('pt-br')

const API = import.meta.env.VITE_API_URL || 'http://localhost:3333'

type Step = 'loading' | 'confirm' | 'success' | 'already' | 'error'

interface AptInfo {
  id: string
  patientName: string
  doctorName: string
  room?: string
  scheduledAt: string
  appointmentType: string
  status: string
}

const TYPE_LABELS: Record<string, string> = {
  INITIAL: 'Consulta Inicial', PERIODIC: 'Periódico', DISMISSAL: 'Demissional',
  ASO: 'ASO', FOLLOWUP: 'Acompanhamento', RETURN: 'Retorno',
}

export default function CheckinPage() {
  const { id } = useParams<{ id: string }>()
  const [step, setStep] = useState<Step>('loading')
  const [apt, setApt] = useState<AptInfo | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [checkedInAt, setCheckedInAt] = useState<string | null>(null)

  useEffect(() => {
    if (!id) { setStep('error'); setError('Link inválido.'); return }
    fetch(`${API}/api/v1/public/checkin/${id}`)
      .then(r => r.json())
      .then(r => {
        if (!r.success) { setStep('error'); setError(r.error?.message || 'Agendamento não encontrado.'); return }
        setApt(r.data)
        setStep('confirm')
      })
      .catch(() => { setStep('error'); setError('Não foi possível carregar o agendamento.') })
  }, [id])

  async function handleCheckin() {
    if (!id) return
    setLoading(true)
    try {
      const res = await fetch(`${API}/api/v1/public/checkin/${id}`, { method: 'POST' })
      const r = await res.json()
      if (!r.success) { setError(r.error?.message || 'Erro ao realizar check-in.'); return }
      if (r.data.alreadyCheckedIn) { setCheckedInAt(r.data.checkedInAt); setStep('already'); return }
      setCheckedInAt(r.data.checkedInAt)
      setStep('success')
    } catch {
      setError('Erro ao realizar check-in.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden">
        {/* Header */}
        <div className="bg-blue-600 px-6 py-5">
          <p className="text-blue-100 text-sm font-medium">SIGCMT</p>
          <h1 className="text-white text-xl font-bold mt-0.5">Check-in Digital</h1>
        </div>

        <div className="p-6">
          {/* Loading */}
          {step === 'loading' && (
            <div className="text-center py-10">
              <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4" />
              <p className="text-gray-500">Buscando seu agendamento...</p>
            </div>
          )}

          {/* Confirm */}
          {step === 'confirm' && apt && (
            <div className="space-y-5">
              <div>
                <p className="text-gray-500 text-sm">Olá,</p>
                <p className="text-xl font-bold text-gray-900">{apt.patientName}</p>
              </div>

              <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 space-y-2.5">
                <Row label="Data" value={dayjs(apt.scheduledAt).format('dddd, DD [de] MMMM')} />
                <Row label="Horário" value={dayjs(apt.scheduledAt).format('HH:mm')} />
                <Row label="Médico" value={apt.doctorName} />
                <Row label="Tipo" value={TYPE_LABELS[apt.appointmentType] || apt.appointmentType} />
                {apt.room && <Row label="Sala" value={apt.room} />}
              </div>

              {error && <p className="text-red-500 text-sm bg-red-50 p-3 rounded-lg">{error}</p>}

              <button
                onClick={handleCheckin}
                disabled={loading}
                className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors disabled:opacity-60"
              >
                {loading ? 'Confirmando...' : '✓ Confirmar Presença'}
              </button>

              <p className="text-center text-xs text-gray-400">
                Ao confirmar, a recepção será notificada da sua chegada.
              </p>
            </div>
          )}

          {/* Success */}
          {step === 'success' && (
            <div className="text-center space-y-4 py-4">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">Check-in Realizado!</h2>
                <p className="text-gray-500 text-sm mt-1">
                  Presença confirmada às {dayjs(checkedInAt).format('HH:mm')}
                </p>
              </div>
              <div className="bg-green-50 border border-green-100 rounded-xl p-4 text-left space-y-1">
                <p className="text-green-800 text-sm font-medium">Próximos passos:</p>
                <p className="text-green-700 text-sm">1. Dirija-se à recepção e informe seu nome</p>
                <p className="text-green-700 text-sm">2. Aguarde ser chamado pelo nome</p>
                <p className="text-green-700 text-sm">3. Tenha seus documentos em mãos</p>
              </div>
            </div>
          )}

          {/* Already checked in */}
          {step === 'already' && (
            <div className="text-center space-y-4 py-4">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto">
                <svg className="w-8 h-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-gray-900">Já registrado!</h2>
              <p className="text-gray-500 text-sm">
                Seu check-in já foi realizado às {checkedInAt ? dayjs(checkedInAt).format('HH:mm') : ''}.
                Aguarde ser chamado na recepção.
              </p>
            </div>
          )}

          {/* Error */}
          {step === 'error' && (
            <div className="text-center space-y-4 py-4">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto">
                <svg className="w-8 h-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-gray-900">Agendamento não encontrado</h2>
              <p className="text-gray-500 text-sm">{error}</p>
              <p className="text-gray-400 text-xs">Entre em contato com a recepção para mais informações.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-blue-500 text-sm font-medium">{label}</span>
      <span className="text-blue-900 text-sm font-semibold text-right">{value}</span>
    </div>
  )
}
