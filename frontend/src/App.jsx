import { useMemo, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import AppLayout from './components/AppLayout.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import AdminSubmissionsPage from './pages/AdminSubmissionsPage.jsx';
import KPIManagementPage from './pages/KPIManagementPage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import SubmissionPage from './pages/SubmissionPage.jsx';
import VendorManagementPage from './pages/VendorManagementPage.jsx';
import VerticalDetailsPage from './pages/VerticalDetailsPage.jsx';
import VerticalManagementPage from './pages/VerticalManagementPage.jsx';
import { clearSession, getSession, setSession } from './services/session.js';

export default function App() {
  const [sessionState, setSessionState] = useState(() => getSession());
  const session = useMemo(() => sessionState, [sessionState]);

  function onLogin(next) {
    setSession(next);
    setSessionState(next);
  }

  function onLogout() {
    clearSession();
    setSessionState(null);
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/login"
          element={session ? <Navigate to="/" replace /> : <LoginPage onLogin={onLogin} />}
        />

        <Route element={<ProtectedRoute session={session} />}>
          <Route element={<AppLayout session={session} onLogout={onLogout} />}>
            <Route index element={<DashboardPage />} />
            <Route path="verticals/:id" element={<VerticalDetailsPage />} />
          </Route>

          <Route element={<ProtectedRoute session={session} role="admin" />}>
            <Route element={<AppLayout session={session} onLogout={onLogout} />}>
              <Route path="admin/vendors" element={<VendorManagementPage />} />
              <Route path="admin/verticals" element={<VerticalManagementPage />} />
              <Route path="admin/kpis" element={<KPIManagementPage />} />
              <Route path="admin/submissions" element={<AdminSubmissionsPage />} />
            </Route>
          </Route>

          <Route element={<ProtectedRoute session={session} role="agency" />}>
            <Route element={<AppLayout session={session} onLogout={onLogout} />}>
              <Route path="submit" element={<SubmissionPage />} />
            </Route>
          </Route>
        </Route>

        <Route path="*" element={<Navigate to={session ? '/' : '/login'} replace />} />
      </Routes>
    </BrowserRouter>
  );
}