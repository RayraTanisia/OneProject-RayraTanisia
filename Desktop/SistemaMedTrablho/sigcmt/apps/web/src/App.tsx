import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/auth'
import Layout from './components/layout/Layout'
import LoginPage from './pages/auth/LoginPage'
import DashboardPage from './pages/DashboardPage'
import PatientListPage from './pages/patients/PatientListPage'
import PatientDetailPage from './pages/patients/PatientDetailPage'
import PatientFormPage from './pages/patients/PatientFormPage'
import AppointmentListPage from './pages/appointments/AppointmentListPage'
import AppointmentFormPage from './pages/appointments/AppointmentFormPage'
import AppointmentDetailPage from './pages/appointments/AppointmentDetailPage'
import AppointmentCalendarPage from './pages/appointments/AppointmentCalendarPage'
import CompanyListPage from './pages/companies/CompanyListPage'
import CompanyFormPage from './pages/companies/CompanyFormPage'
import CompanyDetailPage from './pages/companies/CompanyDetailPage'
import AsoListPage from './pages/aso/AsoListPage'
import AsoFormPage from './pages/aso/AsoFormPage'
import AsoDetailPage from './pages/aso/AsoDetailPage'
import ReportsPage from './pages/reports/ReportsPage'
import UsersListPage from './pages/users/UsersListPage'
import UserFormPage from './pages/users/UserFormPage'
import UserDetailPage from './pages/users/UserDetailPage'
import TriageFormPage from './pages/appointments/TriageFormPage'
import MedicalRecordPage from './pages/appointments/MedicalRecordPage'
import MedicalRecordsListPage from './pages/appointments/MedicalRecordsListPage'
import ReceptionPage from './pages/reception/ReceptionPage'
import ReceptionTemplatePage from './pages/reception/ReceptionTemplatePage'
import ReceptionChatbotPage from './pages/reception/ReceptionChatbotPage'
import CheckinPage from './pages/reception/CheckinPage'
import PcmsoPage from './pages/pcmso/PcmsoPage'

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore(s => s.isAuthenticated)
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />
}

export default function App() {
  const isAuthenticated = useAuthStore(s => s.isAuthenticated)
  return (
    <Routes>
      <Route path="/login" element={isAuthenticated ? <Navigate to="/" replace /> : <LoginPage />} />
      <Route path="/checkin/:id" element={<CheckinPage />} />
      <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
        <Route index element={<DashboardPage />} />
        <Route path="patients" element={<PatientListPage />} />
        <Route path="patients/new" element={<PatientFormPage />} />
        <Route path="patients/:id" element={<PatientDetailPage />} />
        <Route path="patients/:id/edit" element={<PatientFormPage />} />
        <Route path="appointments" element={<AppointmentListPage />} />
        <Route path="appointments/new" element={<AppointmentFormPage />} />
        <Route path="appointments/calendar" element={<AppointmentCalendarPage />} />
        <Route path="appointments/:id" element={<AppointmentDetailPage />} />
        <Route path="appointments/:id/edit" element={<AppointmentFormPage />} />
        <Route path="appointments/:id/triage" element={<TriageFormPage />} />
        <Route path="appointments/:id/medical-record" element={<MedicalRecordPage />} />
        <Route path="medical-records" element={<MedicalRecordsListPage />} />
        <Route path="reception" element={<ReceptionPage />} />
        <Route path="reception/templates" element={<ReceptionTemplatePage />} />
        <Route path="reception/chatbot" element={<ReceptionChatbotPage />} />
        <Route path="companies" element={<CompanyListPage />} />
        <Route path="companies/new" element={<CompanyFormPage />} />
        <Route path="companies/:id" element={<CompanyDetailPage />} />
        <Route path="companies/:id/edit" element={<CompanyFormPage />} />
        <Route path="asos" element={<AsoListPage />} />
        <Route path="asos/new" element={<AsoFormPage />} />
        <Route path="asos/:id" element={<AsoDetailPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="pcmso" element={<PcmsoPage />} />
        <Route path="users" element={<UsersListPage />} />
        <Route path="users/new" element={<UserFormPage />} />
        <Route path="users/:id" element={<UserDetailPage />} />
        <Route path="users/:id/edit" element={<UserFormPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
