import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from '../auth/AuthContext'
import Layout from '../components/Layout'
import ProtectedRoute from '../components/ProtectedRoute'
import AuditLogsPage from '../pages/AuditLogs'
import DashboardPage from '../pages/Dashboard'
import LoginPage from '../pages/Login'
import ProjectsPage from '../pages/Projects'
import RolesPage from '../pages/Roles'
import UsersPage from '../pages/Users'

export default function AppRouter() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          <Route element={<ProtectedRoute />}>
            <Route element={<Layout />}>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/users" element={<UsersPage />} />
              <Route path="/roles" element={<RolesPage />} />
              <Route path="/projects" element={<ProjectsPage />} />
              <Route path="/audit-logs" element={<AuditLogsPage />} />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
