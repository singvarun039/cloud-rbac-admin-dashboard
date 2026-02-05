import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "../auth/AuthContext";
import Layout from "../components/Layout";
import ProtectedRoute from "../components/ProtectedRoute";
import RequirePermissionRoute from "../components/RequirePermissionRoute";
import AuditLogsPage from "../pages/AuditLogs";
import DashboardPage from "../pages/Dashboard";
import LoginPage from "../pages/Login";
import ProjectsPage from "../pages/Projects";
import RolesPage from "../pages/Roles";
import UsersPage from "../pages/Users";

export default function AppRouter() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          <Route element={<ProtectedRoute />}>
            <Route element={<Layout />}>
              <Route path="/" element={<DashboardPage />} />

              <Route
                element={
                  <RequirePermissionRoute
                    permission="users.read"
                    pageTitle="Users"
                    description="You don’t have permission to view users."
                  />
                }
              >
                <Route path="/users" element={<UsersPage />} />
              </Route>

              <Route
                element={
                  <RequirePermissionRoute
                    permission="roles.read"
                    pageTitle="Roles"
                    description="You don’t have permission to view roles."
                  />
                }
              >
                <Route path="/roles" element={<RolesPage />} />
              </Route>

              <Route
                element={
                  <RequirePermissionRoute
                    permission="projects.read"
                    pageTitle="Projects"
                    description="You don’t have permission to view projects."
                  />
                }
              >
                <Route path="/projects" element={<ProjectsPage />} />
              </Route>

              <Route
                element={
                  <RequirePermissionRoute
                    permission="audit.read"
                    pageTitle="Audit Logs"
                    description="You don’t have permission to view audit logs."
                  />
                }
              >
                <Route path="/audit-logs" element={<AuditLogsPage />} />
              </Route>
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
