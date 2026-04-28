import { useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/auth'
import { authService } from './lib/auth'
import Layout from './components/layout/Layout'
import LoginPage from './pages/auth/LoginPage'
import DashboardPage from './pages/dashboard/DashboardPage'
import PatientListPage from './pages/patients/PatientListPage'
import PatientDetailPage from './pages/patients/PatientDetailPage'
import PatientFormPage from './pages/patients/PatientFormPage'
import AppointmentListPage from './pages/appointments/AppointmentListPage'
import AppointmentFormPage from './pages/appointments/AppointmentFormPage'
import AppointmentCalendarPage from './pages/appointments/AppointmentCalendarPage'

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuthStore()
  if (isLoading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
    </div>
  )
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />
}

export default function App() {
  const { setUser, setLoading, isAuthenticated } = useAuthStore()

  // Observar estado de autenticação do Firebase
  useEffect(() => {
    const unsub = authService.onAuthChange(async (firebaseUser) => {
      if (firebaseUser) {
        const profile = await authService.getProfile(firebaseUser.uid)
        setUser(profile)
      } else {
        setUser(null)
      }
    })
    return unsub
  }, [])

  return (
    <Routes>
      <Route path="/login" element={isAuthenticated ? <Navigate to="/" replace /> : <LoginPage />} />
      <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
        <Route index element={<DashboardPage />} />
        <Route path="patients" element={<PatientListPage />} />
        <Route path="patients/new" element={<PatientFormPage />} />
        <Route path="patients/:id" element={<PatientDetailPage />} />
        <Route path="patients/:id/edit" element={<PatientFormPage />} />
        <Route path="appointments" element={<AppointmentListPage />} />
        <Route path="appointments/new" element={<AppointmentFormPage />} />
        <Route path="appointments/calendar" element={<AppointmentCalendarPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
