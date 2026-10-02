import { Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from './components/layout/app-layout';
import { GuestOnly } from './components/layout/guest-only';
import { RequireAuth } from './components/layout/require-auth';
import { LoginPage } from './features/auth/pages/login-page';
import { RegisterPage } from './features/auth/pages/register-page';
import { BoardPage } from './features/board/pages/board-page';
import { WorkspacePage } from './features/workspaces/pages/workspace-page';
import { WorkspacesPage } from './features/workspaces/pages/workspaces-page';
import { useAuthStore } from './stores/auth';

export default function App() {
  const isAuthed = useAuthStore((state) => Boolean(state.accessToken));

  return (
    <Routes>
      <Route
        path="/"
        element={<Navigate to={isAuthed ? '/workspaces' : '/auth/login'} replace />}
      />
      <Route element={<GuestOnly />}>
        <Route path="/auth/login" element={<LoginPage />} />
        <Route path="/auth/register" element={<RegisterPage />} />
      </Route>
      <Route element={<RequireAuth />}>
        <Route element={<AppLayout />}>
          <Route path="/workspaces" element={<WorkspacesPage />} />
          <Route path="/workspaces/:workspaceId" element={<WorkspacePage />} />
          <Route
            path="/workspaces/:workspaceId/projects/:projectId"
            element={<BoardPage />}
          />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
