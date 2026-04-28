import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { api } from '../../lib/api'
import { Search, Plus, Building2, Loader2, ChevronLeft, ChevronRight, Users } from 'lucide-react'

const statusLabel: Record<string, string> = { ACTIVE: 'Ativa', INACTIVE: 'Inativa', PROSPECT: 'Prospecto' }
const statusColor: Record<string, string> = {
  ACTIVE: 'bg-green-50 text-green-700',
  INACTIVE: 'bg-gray-100 text-gray-500',
  PROSPECT: 'bg-yellow-50 text-yellow-700',
}
const riskLabel: Record<number, string> = { 1: 'GR 1', 2: 'GR 2', 3: 'GR 3', 4: 'GR 4' }
const riskColor: Record<number, string> = {
  1: 'bg-green-100 text-green-700',
  2: 'bg-yellow-100 text-yellow-700',
  3: 'bg-orange-100 text-orange-700',
  4: 'bg-red-100 text-red-700',
}

export default function CompanyListPage() {
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(1)
  const limit = 20

  const handleSearch = (v: string) => {
    setSearch(v)
    clearTimeout((window as any)._companySearchTimer)
    ;(window as any)._companySearchTimer = setTimeout(() => { setDebouncedSearch(v); setPage(1) }, 400)
  }

  const { data, isLoading } = useQuery({
    queryKey: ['companies', page, debouncedSearch, statusFilter],
    queryFn: () => api.get('/companies', {
      params: { page, limit, search: debouncedSearch || undefined, status: statusFilter || undefined },
    }).then(r => r.data),
  })

  const companies = data?.data || []
  const meta = data?.meta || {}
  const totalPages = meta.totalPages || 1

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1>Empresas</h1>
          <p className="text-gray-500 text-sm mt-0.5">{meta.total ?? 0} empresas cadastradas</p>
        </div>
        <Link to="/companies/new" className="btn-primary">
          <Plus size={16} /> Nova empresa
        </Link>
      </div>

      <div className="card p-4 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={e => handleSearch(e.target.value)}
            placeholder="Buscar por nome ou CNPJ..."
            className="input pl-9"
          />
        </div>
        <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1) }} className="input w-auto">
          <option value="">Todos os status</option>
          <option value="ACTIVE">Ativas</option>
          <option value="INACTIVE">Inativas</option>
          <option value="PROSPECT">Prospectos</option>
        </select>
      </div>

      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={28} className="animate-spin text-blue-500" />
          </div>
        ) : companies.length === 0 ? (
          <div className="text-center py-20">
            <Building2 size={40} className="mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500 font-medium">Nenhuma empresa encontrada</p>
            <p className="text-gray-400 text-sm mt-1">
              {debouncedSearch ? 'Tente buscar com outros termos.' : 'Clique em "Nova empresa" para começar.'}
            </p>
            {!debouncedSearch && (
              <Link to="/companies/new" className="btn-primary inline-flex mt-4">
                <Plus size={14} /> Nova empresa
              </Link>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Empresa</th>
                  <th>CNPJ</th>
                  <th>Setor</th>
                  <th>Grau de Risco</th>
                  <th>Funcionários</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {companies.map((c: any) => (
                  <tr key={c.id} className="cursor-pointer" onClick={() => window.location.href = `/companies/${c.id}`}>
                    <td>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600 text-xs font-bold flex-shrink-0">
                          <Building2 size={14} />
                        </div>
                        <div>
                          <p className="font-medium text-gray-800">{c.tradeName || c.legalName}</p>
                          {c.tradeName && <p className="text-xs text-gray-400">{c.legalName}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="font-mono text-sm text-gray-600">
                      {c.cnpj ? c.cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5') : '—'}
                    </td>
                    <td className="text-gray-600 text-sm">{c.sector || <span className="text-gray-300">—</span>}</td>
                    <td>
                      <span className={`badge text-xs ${riskColor[c.riskLevel] || 'bg-gray-100 text-gray-600'}`}>
                        {riskLabel[c.riskLevel] || `GR ${c.riskLevel}`}
                      </span>
                    </td>
                    <td>
                      <div className="flex items-center gap-1 text-gray-600 text-sm">
                        <Users size={12} className="text-gray-400" />
                        {c._count?.patients ?? 0}
                      </div>
                    </td>
                    <td>
                      <span className={`badge text-xs ${statusColor[c.status] || 'bg-gray-100 text-gray-500'}`}>
                        {statusLabel[c.status] || c.status}
                      </span>
                    </td>
                    <td>
                      <Link to={`/companies/${c.id}`} className="btn-ghost btn-sm" onClick={e => e.stopPropagation()}>
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
