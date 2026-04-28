import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/auth'
import { api } from '../../lib/api'
import {
  LayoutDashboard, Users, Calendar, CalendarDays,
  Building2, Package, LogOut, Menu, X, FileText, BarChart2, UserCog, ClipboardList, MonitorSmartphone, ScanText
} from 'lucide-react'
import { useState } from 'react'
import clsx from 'clsx'

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard', exact: true },
  { to: '/patients', icon: Users, label: 'Pacientes' },
  { to: '/companies', icon: Building2, label: 'Empresas' },
  { to: '/reception', icon: MonitorSmartphone, label: 'Recepção' },
  { to: '/appointments', icon: Calendar, label: 'Agendamentos' },
  { to: '/appointments/calendar', icon: CalendarDays, label: 'Calendário' },
  { to: '/asos', icon: FileText, label: 'ASOs' },
  { to: '/medical-records', icon: ClipboardList, label: 'Prontuários' },
  { to: '/reports', icon: BarChart2, label: 'Relatórios' },
  { to: '/pcmso', icon: ScanText, label: 'Leitor PCMSO/ASO' },
  { to: '/users', icon: UserCog, label: 'Equipe' },
]

export default function Layout() {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  async function handleLogout() {
    const refreshToken = useAuthStore.getState().refreshToken
    if (refreshToken) await api.post('/auth/logout', { refreshToken }).catch(() => {})
    logout()
    navigate('/login')
  }

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Mobile overlay */}
      {sidebarOpen && <div className="fixed inset-0 z-20 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} />}

      {/* Sidebar */}
      <aside className={clsx(
        'fixed inset-y-0 left-0 z-30 w-64 bg-gray-900 flex flex-col transition-transform duration-300 lg:relative lg:translate-x-0',
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      )}>
        {/* Logo */}
        <div className="flex items-center justify-between h-16 px-6 border-b border-gray-800">
          <div>
            <p className="text-white font-bold text-lg leading-none">SIGCMT</p>
            <p className="text-gray-400 text-xs mt-0.5 truncate max-w-[160px]">{user?.tenant.name}</p>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-gray-400 hover:text-white">
            <X size={20} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.exact}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) => clsx(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                isActive ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-white'
              )}
            >
              <item.icon size={18} />
              {item.label}
            </NavLink>
          ))}

          <div className="pt-4 mt-4 border-t border-gray-800">
            <p className="px-3 mb-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">Em breve</p>
            <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-600 cursor-not-allowed">
              <Package size={18} />
              Estoque
              <span className="ml-auto text-xs bg-gray-800 text-gray-500 px-1.5 py-0.5 rounded">Sprint 6+</span>
            </div>
          </div>
        </nav>

        {/* User */}
        <div className="p-3 border-t border-gray-800">
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg">
            <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
              {user?.fullName.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm font-medium truncate">{user?.fullName}</p>
              <p className="text-gray-400 text-xs truncate">{user?.role}</p>
            </div>
            <button onClick={handleLogout} className="text-gray-400 hover:text-red-400 transition-colors" title="Sair">
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Topbar mobile */}
        <header className="lg:hidden flex items-center h-14 px-4 bg-white border-b border-gray-200">
          <button onClick={() => setSidebarOpen(true)} className="text-gray-500 hover:text-gray-700">
            <Menu size={22} />
          </button>
          <span className="ml-3 font-semibold text-gray-800">SIGCMT</span>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
