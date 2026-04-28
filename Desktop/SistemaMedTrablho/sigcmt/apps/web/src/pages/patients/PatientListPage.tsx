import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { api } from '../../lib/api'
import { Search, Plus, User, Building2, Loader2, ChevronLeft, ChevronRight, Download } from 'lucide-react'
import dayjs from 'dayjs'
import toast from 'react-hot-toast'

const SECTORS = [
  { value: '',                   label: 'Todos',                icon: '👥', color: 'bg-gray-800 text-white' },
  { value: 'medicina_trabalho',  label: 'Medicina do Trabalho', icon: '🏥', color: 'bg-blue-600 text-white' },
  { value: 'detran',             label: 'Detran',               icon: '🚗', color: 'bg-red-600 text-white' },
  { value: 'concursado',         label: 'Concursados',          icon: '📋', color: 'bg-purple-600 text-white' },
  { value: 'vigilancia_sanitaria', label: 'Vigilância Sanitária', icon: '🍽️', color: 'bg-orange-500 text-white' },
  { value: 'administrativo',     label: 'Administrativo',       icon: '📄', color: 'bg-teal-600 text-white' },
]

const SECTOR_BADGE: Record<string, { label: string; cls: string }> = {
  medicina_trabalho:   { label: 'Med. Trabalho',  cls: 'bg-blue-50 text-blue-700' },
  detran:              { label: 'Detran',          cls: 'bg-red-50 text-red-700' },
  concursado:          { label: 'Concursado',      cls: 'bg-purple-50 text-purple-700' },
  vigilancia_sanitaria:{ label: 'Vigilância',      cls: 'bg-orange-50 text-orange-700' },
  administrativo:      { label: 'Administrativo',  cls: 'bg-teal-50 text-teal-700' },
}

function SectorBadge({ setor }: { setor?: string }) {
  if (!setor) return <span className="text-gray-300 text-xs">—</span>
  const cfg = SECTOR_BADGE[setor]
  if (!cfg) return <span className="badge text-xs bg-gray-100 text-gray-500">{setor}</span>
  return <span className={`badge text-xs ${cfg.cls}`}>{cfg.label}</span>
}

export default function PatientListPage() {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [setor, setSetor] = useState('')
  const [exporting, setExporting] = useState(false)
  const limit = 20

  async function handleExport() {
    setExporting(true)
    try {
      const res = await api.get('/patients/export', {
        responseType: 'blob',
        params: { search: debouncedSearch || undefined, setor: setor || undefined },
      })
      const url = URL.createObjectURL(new Blob([res.data], { type: 'text/csv;charset=utf-8;' }))
      const a = document.createElement('a')
      a.href = url
      a.download = `pacientes${setor ? '_' + setor : ''}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      toast.error('Erro ao exportar.')
    } finally {
      setExporting(false)
    }
  }

  const handleSearch = (v: string) => {
    setSearch(v)
    clearTimeout((window as any)._searchTimer)
    ;(window as any)._searchTimer = setTimeout(() => { setDebouncedSearch(v); setPage(1) }, 400)
  }

  const handleSetSetor = (v: string) => { setSetor(v); setPage(1) }

  const { data, isLoading } = useQuery({
    queryKey: ['patients', page, debouncedSearch, setor],
    queryFn: () => api.get('/patients', {
      params: { page, limit, search: debouncedSearch || undefined, setor: setor || undefined },
    }).then(r => r.data),
  })

  const patients = data?.data || []
  const meta = data?.meta || {}
  const totalPages = meta.totalPages || 1
  const activeSector = SECTORS.find(s => s.value === setor)!

  function calcAge(birth: string | null) {
    if (!birth) return '—'
    return dayjs().diff(dayjs(birth), 'year') + ' anos'
  }

  function renderExtraColumns(p: any) {
    const cf = p.customFields || {}
    if (setor === 'medicina_trabalho') return (
      <>
        <td className="text-gray-600">{p.company?.legalName || cf.empresa || <span className="text-gray-300">—</span>}</td>
        <td><span className="badge text-xs bg-blue-50 text-blue-700">{cf.tipoExame || p.currentJobTitle || '—'}</span></td>
      </>
    )
    if (setor === 'detran') return (
      <>
        <td><span className="badge text-xs bg-red-50 text-red-700">{cf.exame || '—'}</span></td>
        <td className="text-gray-600">{cf.categoria || '—'}</td>
      </>
    )
    if (setor === 'concursado') return (
      <td className="text-gray-600 max-w-[200px] truncate">{cf.edital || '—'}</td>
    )
    if (setor === 'vigilancia_sanitaria') return (
      <>
        <td className="text-gray-600">{cf.estabelecimento || '—'}</td>
        <td><span className="badge text-xs bg-orange-50 text-orange-700">{cf.tipo || '—'}</span></td>
      </>
    )
    if (setor === 'administrativo') return (
      <td><span className="badge text-xs bg-teal-50 text-teal-700">{cf.solicitacao || '—'}</span></td>
    )
    // Todos
    return (
      <>
        <td><SectorBadge setor={cf.setor} /></td>
        <td>
          {p.company ? (
            <div className="flex items-center gap-1 text-gray-600">
              <Building2 size={12} className="text-gray-400" />
              {p.company.tradeName || p.company.legalName}
            </div>
          ) : cf.empresa ? (
            <span className="text-gray-600">{cf.empresa}</span>
          ) : <span className="text-gray-300">—</span>}
        </td>
      </>
    )
  }

  function renderExtraHeaders() {
    if (setor === 'medicina_trabalho') return <><th>Empresa</th><th>Tipo de Exame</th></>
    if (setor === 'detran') return <><th>Tipo de Exame</th><th>Categoria CNH</th></>
    if (setor === 'concursado') return <th>Edital / Concurso</th>
    if (setor === 'vigilancia_sanitaria') return <><th>Estabelecimento</th><th>Tipo</th></>
    if (setor === 'administrativo') return <th>Solicitação</th>
    return <><th>Setor</th><th>Empresa</th></>
  }

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1>Pacientes</h1>
          <p className="text-gray-500 text-sm mt-0.5">{meta.total ?? 0} pacientes {setor ? `em ${activeSector?.label}` : 'cadastrados'}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={handleExport} disabled={exporting} className="btn-secondary">
            <Download size={16} /> {exporting ? 'Exportando…' : 'Exportar CSV'}
          </button>
          <Link to="/patients/new" className="btn-primary">
            <Plus size={16} /> Novo paciente
          </Link>
        </div>
      </div>

      {/* Tabs de setor */}
      <div className="flex flex-wrap gap-2">
        {SECTORS.map(s => (
          <button
            key={s.value}
            onClick={() => handleSetSetor(s.value)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              setor === s.value ? s.color : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <span>{s.icon}</span>
            {s.label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="card p-4">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={e => handleSearch(e.target.value)}
            placeholder="Buscar por nome, CPF ou empresa..."
            className="input pl-9 max-w-md"
          />
        </div>
      </div>

      {/* Tabela */}
      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={28} className="animate-spin text-blue-500" />
          </div>
        ) : patients.length === 0 ? (
          <div className="text-center py-20">
            <User size={40} className="mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500 font-medium">Nenhum paciente encontrado</p>
            <p className="text-gray-400 text-sm mt-1">
              {debouncedSearch
                ? 'Tente buscar com outros termos.'
                : setor
                ? `Nenhum cadastro via chatbot neste setor ainda.`
                : 'Clique em "Novo paciente" para começar.'}
            </p>
            {!debouncedSearch && !setor && (
              <Link to="/patients/new" className="btn-primary inline-flex mt-4">
                <Plus size={14} /> Novo paciente
              </Link>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Paciente</th>
                  <th>Idade</th>
                  {renderExtraHeaders()}
                  <th>Status</th>
                  <th>Cadastro</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {patients.map((p: any) => (
                  <tr key={p.id} className="cursor-pointer" onClick={() => window.location.href = `/patients/${p.id}`}>
                    <td>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-xs font-bold flex-shrink-0">
                          {p.fullName.charAt(0)}
                        </div>
                        <span className="font-medium text-gray-800">{p.fullName}</span>
                      </div>
                    </td>
                    <td>{calcAge(p.birthDate)}</td>
                    {renderExtraColumns(p)}
                    <td>
                      <span className={`badge text-xs ${p.status === 'ACTIVE' ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {p.status === 'ACTIVE' ? 'Ativo' : p.status === 'INACTIVE' ? 'Inativo' : 'Óbito'}
                      </span>
                    </td>
                    <td className="text-gray-400 text-xs">{dayjs(p.createdAt).format('DD/MM/YYYY')}</td>
                    <td>
                      <Link to={`/patients/${p.id}`} className="btn-ghost btn-sm" onClick={e => e.stopPropagation()}>
                        Ver
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Paginação */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">Página {page} de {totalPages} · {meta.total} resultados</p>
          <div className="flex gap-2">
            <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="btn-secondary btn-sm disabled:opacity-50">
              <ChevronLeft size={14} />
            </button>
            <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="btn-secondary btn-sm disabled:opacity-50">
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
