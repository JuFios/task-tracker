import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../../stores/auth';

export function GuestOnly() {
  const token = useAuthStore((state) => state.accessToken);
  if (token) return <Navigate to="/workspaces" replace />;
  return <Outlet />;
}
