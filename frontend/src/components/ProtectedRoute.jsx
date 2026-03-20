import { Navigate, Outlet } from 'react-router-dom';

export default function ProtectedRoute({ session, role }) {
  if (!session) return <Navigate to="/login" replace />;
  if (role && session.role !== role) return <Navigate to="/" replace />;
  return <Outlet />;
}
