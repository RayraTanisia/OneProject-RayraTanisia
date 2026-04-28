import { useState, useEffect } from 'react'
import { Plus, Copy, Trash2, Edit2, Check, X } from 'lucide-react'
import toast from 'react-hot-toast'

interface Template {
  id: string
  category: string
  title: string
  body: string
  createdAt: string
}

const CATEGORIES = [
  { value: 'confirmacao', label: 'Confirmação', color: 'bg-green-100 text-green-700' },
  { value: 'lembrete', label: 'Lembrete', color: 'bg-blue-100 text-blue-700' },
  { value: 'cancelamento', label: 'Cancelamento', color: 'bg-red-100 text-red-700' },
  { value: 'boasvindas', label: 'Boas-vindas', color: 'bg-purple-100 text-purple-700' },
  { value: 'faq', label: 'FAQ', color: 'bg-yellow-100 text-yellow-700' },
  { value: 'outro', label: 'Outro', color: 'bg-gray-100 text-gray-600' },
]

const VARIABLES = [
  { key: '{{nome}}', desc: 'Nome do paciente' },
  { key: '{{data}}', desc: 'Data da consulta' },
  { key: '{{hora}}', desc: 'Horário' },
  { key: '{{medico}}', desc: 'Nome do médico' },
  { key: '{{empresa}}', desc: 'Empresa' },
  { key: '{{clinica}}', desc: 'Nome da clínica' },
]

const DEFAULT_TEMPLATES: Template[] = [
  {
    id: '1', category: 'confirmacao', title: 'Confirmação de Agendamento',
    body: 'Olá, {{nome}}! 😊\n\nSeu agendamento foi confirmado:\n📅 Data: {{data}}\n⏰ Horário: {{hora}}\n👨‍⚕️ Médico: {{medico}}\n\nPor favor, chegue com 10 minutos de antecedência.\nDúvidas? Estamos à disposição!',
    createdAt: new Date().toISOString(),
  },
  {
    id: '2', category: 'lembrete', title: 'Lembrete — Consulta Amanhã',
    body: 'Olá, {{nome}}! 👋\n\nLembramos que sua consulta é amanhã:\n📅 {{data}} às {{hora}}\n👨‍⚕️ Dr(a). {{medico}}\n\nNão esqueça de trazer seus documentos.\nAté amanhã! 🏥',
    createdAt: new Date().toISOString(),
  },
  {
    id: '3', category: 'cancelamento', title: 'Cancelamento de Consulta',
    body: 'Olá, {{nome}}.\n\nInformamos que sua consulta do dia {{data}} às {{hora}} foi cancelada.\n\nPara reagendar, entre em contato conosco.\n\nPedimos desculpas pelo inconveniente. 🙏',
    createdAt: new Date().toISOString(),
  },
  {
    id: '4', category: 'boasvindas', title: 'Boas-vindas à Clínica',
    body: 'Bem-vindo(a) à {{clinica}}, {{nome}}! 🎉\n\nEstamos muito felizes em ter você como nosso paciente.\n\nCaso precise de qualquer informação sobre nossos serviços, horários ou agendamentos, é só nos chamar aqui!\n\nCuidar da sua saúde é nossa missão. 💙',
    createdAt: new Date().toISOString(),
  },
  {
    id: '5', category: 'faq', title: 'Documentos Necessários',
    body: 'Olá, {{nome}}! 📋\n\nPara sua consulta, por favor traga:\n\n✅ RG ou CNH\n✅ Cartão do convênio (se houver)\n✅ Pedido médico (se for exame)\n✅ Lista de medicamentos em uso\n\nQualquer dúvida, estamos aqui! 😊',
    createdAt: new Date().toISOString(),
  },
]

const STORAGE_KEY = 'sigcmt_templates'

function loadTemplates(): Template[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored ? JSON.parse(stored) : DEFAULT_TEMPLATES
  } catch {
    return DEFAULT_TEMPLATES
  }
}

function saveTemplates(templates: Template[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(templates))
}

function getCategoryInfo(value: string) {
  return CATEGORIES.find(c => c.value === value) || CATEGORIES[CATEGORIES.length - 1]
}

export default function ReceptionTemplatePage() {
  const [templates, setTemplates] = useState<Template[]>(loadTemplates)
  const [filter, setFilter] = useState('all')
  const [editing, setEditing] = useState<Template | null>(null)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ category: 'confirmacao', title: '', body: '' })
  const [copiedId, setCopiedId] = useState<string | null>(null)

  useEffect(() => { saveTemplates(templates) }, [templates])

  function handleCopy(t: Template) {
    navigator.clipboard.writeText(t.body)
    setCopiedId(t.id)
    toast.success('Template copiado!')
    setTimeout(() => setCopiedId(null), 2000)
  }

  function handleDelete(id: string) {
    if (!confirm('Remover este template?')) return
    setTemplates(prev => prev.filter(t => t.id !== id))
    toast.success('Template removido.')
  }

  function handleSave() {
    if (!form.title.trim() || !form.body.trim()) { toast.error('Preencha título e mensagem.'); return }
    if (editing) {
      setTemplates(prev => prev.map(t => t.id === editing.id ? { ...t, ...form } : t))
      toast.success('Template atualizado!')
      setEditing(null)
    } else {
      setTemplates(prev => [...prev, { id: Date.now().toString(), ...form, createdAt: new Date().toISOString() }])
      toast.success('Template criado!')
      setCreating(false)
    }
    setForm({ category: 'confirmacao', title: '', body: '' })
  }

  function startEdit(t: Template) {
    setEditing(t)
    setForm({ category: t.category, title: t.title, body: t.body })
    setCreating(false)
  }

  function cancelForm() {
    setEditing(null)
    setCreating(false)
    setForm({ category: 'confirmacao', title: '', body: '' })
  }

  function insertVariable(key: string) {
    setForm(prev => ({ ...prev, body: prev.body + key }))
  }

  const filtered = filter === 'all' ? templates : templates.filter(t => t.category === filter)

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1>Templates de Mensagem</h1>
          <p className="text-gray-500 text-sm">{templates.length} templates cadastrados</p>
        </div>
        <button onClick={() => { setCreating(true); setEditing(null) }} className="btn-primary">
          <Plus size={16} /> Novo template
        </button>
      </div>

      {/* Form criar/editar */}
      {(creating || editing) && (
        <div className="card p-5 border-2 border-blue-200 space-y-4">
          <h2 className="font-semibold text-gray-800">{editing ? 'Editar template' : 'Novo template'}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label">Categoria</label>
              <select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))} className="input">
                {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Título</label>
              <input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} className="input" placeholder="Ex: Confirmação de Agendamento" />
            </div>
          </div>

          <div>
            <label className="label">Mensagem</label>
            <textarea
              value={form.body}
              onChange={e => setForm(p => ({ ...p, body: e.target.value }))}
              className="input min-h-[140px] font-mono text-sm"
              placeholder="Digite a mensagem..."
            />
          </div>

          <div>
            <p className="text-xs text-gray-500 mb-2">Variáveis disponíveis — clique para inserir:</p>
            <div className="flex flex-wrap gap-1.5">
              {VARIABLES.map(v => (
                <button key={v.key} onClick={() => insertVariable(v.key)} title={v.desc}
                  className="text-xs bg-blue-50 text-blue-700 border border-blue-200 px-2 py-1 rounded hover:bg-blue-100 font-mono">
                  {v.key}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-2">
            <button onClick={handleSave} className="btn-primary btn-sm"><Check size={14} /> Salvar</button>
            <button onClick={cancelForm} className="btn-secondary btn-sm"><X size={14} /> Cancelar</button>
          </div>
        </div>
      )}

      {/* Filtro por categoria */}
      <div className="flex gap-2 flex-wrap">
        <button onClick={() => setFilter('all')} className={`badge cursor-pointer ${filter === 'all' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
          Todos ({templates.length})
        </button>
        {CATEGORIES.map(c => {
          const count = templates.filter(t => t.category === c.value).length
          if (count === 0) return null
          return (
            <button key={c.value} onClick={() => setFilter(c.value)}
              className={`badge cursor-pointer ${filter === c.value ? 'bg-gray-900 text-white' : `${c.color} hover:opacity-80`}`}>
              {c.label} ({count})
            </button>
          )
        })}
      </div>

      {/* Lista de templates */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filtered.map(t => {
          const cat = getCategoryInfo(t.category)
          return (
            <div key={t.id} className="card p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className={`badge text-xs ${cat.color} mb-1`}>{cat.label}</span>
                  <h3 className="font-semibold text-gray-800">{t.title}</h3>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <button onClick={() => handleCopy(t)} className="btn-ghost btn-sm text-gray-400 hover:text-blue-600" title="Copiar">
                    {copiedId === t.id ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                  </button>
                  <button onClick={() => startEdit(t)} className="btn-ghost btn-sm text-gray-400 hover:text-blue-600" title="Editar">
                    <Edit2 size={14} />
                  </button>
                  <button onClick={() => handleDelete(t.id)} className="btn-ghost btn-sm text-gray-400 hover:text-red-500" title="Excluir">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              <pre className="text-sm text-gray-600 whitespace-pre-wrap font-sans bg-gray-50 rounded-lg p-3 max-h-40 overflow-y-auto">
                {t.body}
              </pre>
            </div>
          )
        })}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-16 text-gray-400">Nenhum template nesta categoria.</div>
      )}
    </div>
  )
}
