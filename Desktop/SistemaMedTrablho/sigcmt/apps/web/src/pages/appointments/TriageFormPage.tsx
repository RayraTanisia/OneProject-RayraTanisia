import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { ArrowLeft, Plus, Trash2, AlertTriangle, Save } from 'lucide-react'
import toast from 'react-hot-toast'
import dayjs from 'dayjs'

const SYMPTOMS = [
  'Dor de cabeça', 'Tontura', 'Náusea', 'Vômito', 'Febre', 'Calafrios',
  'Tosse', 'Dispneia', 'Dor torácica', 'Palpitações', 'Dor lombar',
  'Dor muscular', 'Fraqueza', 'Fadiga', 'Insônia', 'Ansiedade',
  'Irritação ocular', 'Rinite', 'Dermatite', 'Dor articular',
]

const RISK_FLAGS = [
  'Pressão elevada', 'Frequência cardíaca alterada', 'Saturação baixa',
  'Temperatura elevada', 'IMC elevado', 'Uso de medicamento controlado',
  'Histórico de acidente de trabalho', 'Exposição a agente químico',
  'Exposição a ruído intenso', 'Trabalho em altura', 'Trabalho noturno',
]

interface VitalSign { key: string; label: string; value: string; unit: string }
interface Medication { name: string; dosage: string }

const VITALS: VitalSign[] = [
  { key: 'pa', label: 'Pressão Arterial', value: '', unit: 'mmHg' },
  { key: 'fc', label: 'Freq. Cardíaca', value: '', unit: 'bpm' },
  { key: 'temp', label: 'Temperatura', value: '', unit: '°C' },
  { key: 'spo2', label: 'SpO₂', value: '', unit: '%' },
  { key: 'peso', label: 'Peso', value: '', unit: 'kg' },
  { key: 'altura', label: 'Altura', value: '', unit: 'cm' },
  { key: 'queixa', label: 'Queixa Principal', value: '', unit: '' },
]

export default function TriageFormPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()

  const [vitals, setVitals] = useState<VitalSign[]>(VITALS)
  const [symptoms, setSymptoms] = useState<string[]>([])
  const [customSymptom, setCustomSymptom] = useState('')
  const [medications, setMedications] = useState<Medication[]>([])
  const [riskFlags, setRiskFlags] = useState<string[]>([])
  const [doctorNotes, setDoctorNotes] = useState('')

  const { data: apt } = useQuery({
    queryKey: ['appointment', id],
    queryFn: () => api.get(`/appointments/${id}`).then(r => r.data.data),
    enabled: !!id,
  })

  // Pré-preenche com dados existentes de triagem
  useEffect(() => {
    if (apt?.triage) {
      const t = apt.triage
      if (t.responses?.length) {
        setVitals(prev => prev.map(v => {
          const found = t.responses.find((r: { key: string; value: string }) => r.key === v.key)
          return found ? { ...v, value: found.value } : v
        }))
      }
      if (t.currentSymptoms?.length) setSymptoms(t.currentSymptoms)
      if (t.medicationsInUse?.length) setMedications(t.medicationsInUse)
      if (t.riskFlags?.length) setRiskFlags(t.riskFlags)
      if (t.doctorNotes) setDoctorNotes(t.doctorNotes)
    }
    // Pré-preenche medicamentos do prontuário do paciente
    if (apt?.patient?.continuousMedications?.length && !apt?.triage) {
      setMedications(apt.patient.continuousMedications.map((m: { name: string; dosage?: string }) => ({
        name: m.name, dosage: m.dosage || '',
      })))
    }
  }, [apt?.id])

  // Auto-detecta flags de risco com base nos sinais vitais
  useEffect(() => {
    const flags: string[] = []
    const pa = vitals.find(v => v.key === 'pa')?.value
    const fc = vitals.find(v => v.key === 'fc')?.value
    const spo2 = vitals.find(v => v.key === 'spo2')?.value
    const temp = vitals.find(v => v.key === 'temp')?.value
    const peso = vitals.find(v => v.key === 'peso')?.value
    const altura = vitals.find(v => v.key === 'altura')?.value

    if (pa) {
      const [sis] = pa.split('/').map(Number)
      if (sis >= 140) flags.push('Pressão elevada')
    }
    if (fc && (Number(fc) > 100 || Number(fc) < 50)) flags.push('Frequência cardíaca alterada')
    if (spo2 && Number(spo2) < 95) flags.push('Saturação baixa')
    if (temp && Number(temp) >= 37.8) flags.push('Temperatura elevada')
    if (peso && altura) {
      const imc = Number(peso) / Math.pow(Number(altura) / 100, 2)
      if (imc >= 30) flags.push('IMC elevado')
    }
    setRiskFlags(prev => {
      const manual = prev.filter(f => !['Pressão elevada','Frequência cardíaca alterada','Saturação baixa','Temperatura elevada','IMC elevado'].includes(f))
      return [...new Set([...manual, ...flags])]
    })
  }, [vitals])

  const imc = (() => {
    const peso = Number(vitals.find(v => v.key === 'peso')?.value)
    const altura = Number(vitals.find(v => v.key === 'altura')?.value)
    if (peso && altura) return (peso / Math.pow(altura / 100, 2)).toFixed(1)
    return null
  })()

  const mutation = useMutation({
    mutationFn: (status: 'COMPLETED' | 'INCOMPLETE') => api.post(`/appointments/${id}/triage`, {
      responses: vitals.filter(v => v.value).map(v => ({ key: v.key, label: v.label, value: v.value })),
      currentSymptoms: symptoms,
      medicationsInUse: medications.filter(m => m.name),
      riskFlags,
      doctorNotes: doctorNotes || undefined,
      status,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['appointment', id] })
      toast.success('Triagem salva com sucesso!')
      navigate(`/appointments/${id}`)
    },
    onError: () => toast.error('Erro ao salvar triagem'),
  })

  function toggleSymptom(s: string) {
    setSymptoms(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s])
  }
  function toggleFlag(f: string) {
    setRiskFlags(prev => prev.includes(f) ? prev.filter(x => x !== f) : [...prev, f])
  }
  function addCustomSymptom() {
    if (customSymptom.trim()) {
      setSymptoms(prev => [...prev, customSymptom.trim()])
      setCustomSymptom('')
    }
  }
  function updateVital(key: string, value: string) {
    setVitals(prev => prev.map(v => v.key === key ? { ...v, value } : v))
  }

  if (!apt) return <div className="flex justify-center items-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" /></div>

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(`/appointments/${id}`)} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Triagem</h1>
          <p className="text-sm text-gray-500">
            {apt.patient?.fullName} · {dayjs(apt.scheduledAt).format('DD/MM/YYYY HH:mm')}
          </p>
        </div>
      </div>

      {/* Sinais vitais */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="font-semibold text-gray-700 mb-4">Sinais Vitais</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {vitals.filter(v => v.key !== 'queixa').map(v => (
            <div key={v.key}>
              <label className="block text-xs text-gray-500 mb-1">{v.label} {v.unit && <span className="text-gray-400">({v.unit})</span>}</label>
              <input
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                placeholder={v.key === 'pa' ? '120/80' : '—'}
                value={v.value}
                onChange={e => updateVital(v.key, e.target.value)}
              />
            </div>
          ))}
          {imc && (
            <div className="flex items-end">
              <div className={`px-3 py-2 rounded-lg text-sm font-medium w-full text-center ${Number(imc) >= 30 ? 'bg-red-100 text-red-700' : Number(imc) >= 25 ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                IMC: {imc}
              </div>
            </div>
          )}
        </div>
        <div className="mt-4">
          <label className="block text-xs text-gray-500 mb-1">Queixa Principal</label>
          <textarea
            rows={2}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none"
            placeholder="Descreva a queixa principal do paciente..."
            value={vitals.find(v => v.key === 'queixa')?.value || ''}
            onChange={e => updateVital('queixa', e.target.value)}
          />
        </div>
      </div>

      {/* Sintomas */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="font-semibold text-gray-700 mb-4">Sintomas Atuais</h2>
        <div className="flex flex-wrap gap-2 mb-4">
          {SYMPTOMS.map(s => (
            <button
              key={s}
              type="button"
              onClick={() => toggleSymptom(s)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                symptoms.includes(s)
                  ? 'bg-orange-500 text-white border-orange-500'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-orange-300'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
            placeholder="Outro sintoma..."
            value={customSymptom}
            onChange={e => setCustomSymptom(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addCustomSymptom())}
          />
          <button type="button" onClick={addCustomSymptom}
            className="px-3 py-2 bg-orange-50 text-orange-600 rounded-lg hover:bg-orange-100 text-sm font-medium">
            <Plus className="w-4 h-4" />
          </button>
        </div>
        {symptoms.filter(s => !SYMPTOMS.includes(s)).length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {symptoms.filter(s => !SYMPTOMS.includes(s)).map(s => (
              <span key={s} className="inline-flex items-center gap-1 px-2 py-1 bg-orange-100 text-orange-700 rounded-full text-xs">
                {s}
                <button onClick={() => toggleSymptom(s)}><Trash2 className="w-3 h-3" /></button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Medicamentos */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-700">Medicamentos em Uso</h2>
          <button type="button" onClick={() => setMedications(prev => [...prev, { name: '', dosage: '' }])}
            className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800">
            <Plus className="w-3.5 h-3.5" /> Adicionar
          </button>
        </div>
        {medications.length === 0 ? (
          <p className="text-xs text-gray-400">Nenhum medicamento registrado</p>
        ) : (
          <div className="space-y-2">
            {medications.map((m, i) => (
              <div key={i} className="flex gap-2 items-center">
                <input
                  className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  placeholder="Nome do medicamento"
                  value={m.name}
                  onChange={e => setMedications(prev => prev.map((x, idx) => idx === i ? { ...x, name: e.target.value } : x))}
                />
                <input
                  className="w-32 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  placeholder="Dose"
                  value={m.dosage}
                  onChange={e => setMedications(prev => prev.map((x, idx) => idx === i ? { ...x, dosage: e.target.value } : x))}
                />
                <button type="button" onClick={() => setMedications(prev => prev.filter((_, idx) => idx !== i))}
                  className="text-red-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Flags de risco */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle className="w-4 h-4 text-red-500" />
          <h2 className="font-semibold text-gray-700">Fatores de Risco</h2>
          {riskFlags.length > 0 && (
            <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded-full font-medium">{riskFlags.length} detectado(s)</span>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {RISK_FLAGS.map(f => (
            <button
              key={f}
              type="button"
              onClick={() => toggleFlag(f)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                riskFlags.includes(f)
                  ? 'bg-red-500 text-white border-red-500'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-red-300'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Observações */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="font-semibold text-gray-700 mb-3">Observações da Triagem</h2>
        <textarea
          rows={3}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none"
          placeholder="Observações adicionais para o médico..."
          value={doctorNotes}
          onChange={e => setDoctorNotes(e.target.value)}
        />
      </div>

      {/* Ações */}
      <div className="flex justify-end gap-3 pb-6">
        <button type="button" onClick={() => navigate(`/appointments/${id}`)}
          className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">
          Cancelar
        </button>
        <button
          type="button"
          onClick={() => mutation.mutate('INCOMPLETE')}
          disabled={mutation.isPending}
          className="px-4 py-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100"
        >
          Salvar parcial
        </button>
        <button
          type="button"
          onClick={() => mutation.mutate('COMPLETED')}
          disabled={mutation.isPending}
          className="inline-flex items-center gap-2 px-6 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 font-medium"
        >
          <Save className="w-4 h-4" />
          {mutation.isPending ? 'Salvando...' : 'Concluir triagem'}
        </button>
      </div>
    </div>
  )
}
