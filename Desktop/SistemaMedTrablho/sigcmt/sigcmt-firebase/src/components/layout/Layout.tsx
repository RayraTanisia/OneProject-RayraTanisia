import { useState } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/auth'
import { authService } from '../../lib/auth'
import {
  LayoutDashboard, Users, Calendar, CalendarDays,
  LogOut, Menu, X, Building2, Package, Stethoscope
} from 'lucide-react'
import clsx from 'clsx'

const nav = [
  { to: '/',                    icon: LayoutDashboard, label: 'Dashboard',    exact: true },
  { to: '/patients',            icon: Users,           label: 'Pacientes' },
  { to: '/appointments',        icon: Calendar,        label: 'Agendamentos' },
  { to: '/appointments/calendar', icon: CalendarDays,  label: 'Calendário' },
]

const soon = [
  { icon: Building2, label: 'Empresas' },
  { icon: Package,   label: 'Estoque' },
]

export default function Layout() {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)

  async function handleLogout() {
    await authService.logout()
    logout()
    navigate('/login')
  }

  const Sidebar = () => (
    <aside className="flex flex-col w-64 bg-gray-900 h-full">
      {/* Logo */}
      <div className="flex items-center justify-between h-16 px-5 border-b border-gray-800 flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 bg-blue-500 rounded-lg flex items-center justify-center">
            <Stethoscope size={15} className="text-white" />
          </div>
          <div>
            <p className="text-white font-bold text-sm leading-none">SIGCMT</p>
            <p className="text-gray-500 text-xs mt-0.5">Medicina do Trabalho</p>
          </div>
        </div>
        <button onClick={() => setOpen(false)} className="lg:hidden text-gray-400 hover:text-white">
          <X size={18} />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {nav.map(item => (
          <NavLink key={item.to} to={item.to} end={item.exact} onClick={() => setOpen(false)}
            className={({ isActive }) => clsx(
              'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
              isActive ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-white'
            )}>
            <item.icon size={17} />
            {item.label}
          </NavLink>
        ))}

        <div className="pt-5 mt-4 border-t border-gray-800">
          <p className="px-3 mb-2 text-xs font-semibold text-gray-600 uppercase tracking-wider">Em breve</p>
          {soon.map(item => (
            <div key={item.label} className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-700 cursor-not-allowed select-none">
              <item.icon size={17} />
              {item.label}
              <span className="ml-auto text-xs bg-gray-800 text-gray-500 px-1.5 py-0.5 rounded">Sprint 7+</span>
            </div>
          ))}
        </div>
      </nav>

      {/* User */}
      <div className="p-3 border-t border-gray-800 flex-shrink-0">
        <div className="flex items-center gap-3 px-2 py-2">
          <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
            {user?.fullName?.charAt(0) ?? '?'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm font-medium truncate">{user?.fullName}</p>
            <p className="text-gray-400 text-xs truncate">{user?.role}</p>
          </div>
          <button onClick={handleLogout} className="text-gray-500 hover:text-red-400 transition-colors" title="Sair">
            <LogOut size={15} />
          </button>
        </div>
      </div>
    </aside>
  )

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Mobile overlay */}
      {open && <div className="fixed inset-0 z-20 bg-black/60 lg:hidden" onClick={() => setOpen(false)} />}

      {/* Sidebar desktop */}
      <div className="hidden lg:flex flex-shrink-0">
        <Sidebar />
      </div>

      {/* Sidebar mobile */}
      <div className={clsx('fixed inset-y-0 left-0 z-30 flex lg:hidden transition-transform duration-300', open ? 'translate-x-0' : '-translate-x-full')}>
        <Sidebar />
      </div>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Topbar mobile */}
        <header className="lg:hidden flex items-center h-14 px-4 bg-white border-b border-gray-200 flex-shrink-0">
          <button onClick={() => setOpen(true)} className="text-gray-500 hover:text-gray-700">
            <Menu size={22} />
          </button>
          <span className="ml-3 font-bold text-gray-800">SIGCMT</span>
        </header>

        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
