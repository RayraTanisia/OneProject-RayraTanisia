import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { api } from '../../lib/api'
import { Plus, Search, UserCheck, UserX, Eye } from 'lucide-react'

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Administrador', MANAGER: 'Gerente', DOCTOR: 'Médico',
  NURSE: 'Enfermeiro(a)', RECEPTIONIST: 'Recepcionista', BILLING: 'Faturamento',
  HR: 'RH', PSYCHOLOGIST: 'Psicólogo(a)', WAREHOUSE: 'Almoxarifado',
}
const ROLE_COLORS: Record<string, string> = {
  ADMIN: 'bg-red-100 text-red-700', MANAGER: 'bg-purple-100 text-purple-700',
  DOCTOR: 'bg-blue-100 text-blue-700', NURSE: 'bg-teal-100 text-teal-700',
  RECEPTIONIST: 'bg-gray-100 text-gray-700', BILLING: 'bg-amber-100 text-amber-700',
  HR: 'bg-indigo-100 text-indigo-700', PSYCHOLOGIST: 'bg-pink-100 text-pink-700',
}

interface User {
  id: string; email: string; fullName: string; role: string
  crmNumber: string | null; crmState: string | null; phone: string | null
  lastLoginAt: string | null; createdAt: string
}

export default function UsersListPage() {
  const [search, setSearch] = useState('')
  const [role, setRole] = useState('')
  const [page, setPage] = useState(1)
  const qc = useQueryClient()

  const params = new URLSearchParams({ page: String(page), limit: '20' })
  if (role) params.set('role', role)
  if (search) params.set('search', search)

  const { data, isLoading } = useQuery({
    queryKey: ['users', page, role, search],
    queryFn: () => api.get(`/users?${params}`).then(r => r.data),
  })

  const deactivate = useMutation({
    mutationFn: (id: string) => api.delete(`/users/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  })

  const users: User[] = data?.data ?? []
  const total: number = data?.total ?? 0
  const totalPages = Math.ceil(total / 20)

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Equipe</h1>
          <p className="text-sm text-gray-500 mt-1">Usuários e profissionais da clínica</p>
        </div>
        <Link
          to="/users/new"
          className="inline-flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 text-sm font-medium"
        >
          <Plus className="w-4 h-4" /> Novo usuário
        </Link>
      </div>

      <div className="bg-white rounded-xl border border-gray-200">
        <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
              placeholder="Buscar por nome..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1) }}
            />
          </div>
          <select
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
            value={role}
            onChange={e => { setRole(e.target.value); setPage(1) }}
          >
            <option value="">Todos os cargos</option>
            {Object.entries(ROLE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
          </div>
        ) : users.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-400 text-sm">Nenhum usuário encontrado</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">Nome</th>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">Cargo</th>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">CRM</th>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">Telefone</th>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">Último acesso</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {users.map(u => (
                  <tr key={u.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-xs flex-shrink-0">
                          {u.fullName.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-gray-800">{u.fullName}</p>
                          <p className="text-xs text-gray-400">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${ROLE_COLORS[u.role] || 'bg-gray-100 text-gray-600'}`}>
                        {ROLE_LABELS[u.role] || u.role}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {u.crmNumber ? `CRM ${u.crmNumber}/${u.crmState}` : '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{u.phone || '—'}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString('pt-BR') : 'Nunca'}
                    </td>
                    <td className="px-4 py-3 flex items-center gap-2 justify-end">
                      <Link
                        to={`/users/${u.id}`}
                        className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-800 text-xs font-medium"
                      >
                        <Eye className="w-3.5 h-3.5" /> Ver
                      </Link>
                      <button
                        onClick={() => {
                          if (confirm(`Desativar ${u.fullName}?`)) deactivate.mutate(u.id)
                        }}
                        className="inline-flex items-center gap-1 text-red-500 hover:text-red-700 text-xs font-medium"
                      >
                        <UserX className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <p className="text-sm text-gray-500">Total: {total}</p>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="px-3 py-1 text-sm border border-gray-200 rounded disabled:opacity-40 hover:bg-gray-50">Anterior</button>
              <span className="px-3 py-1 text-sm text-gray-600">{page}/{totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                className="px-3 py-1 text-sm border border-gray-200 rounded disabled:opacity-40 hover:bg-gray-50">Próxima</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
