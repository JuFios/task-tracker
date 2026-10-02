import { KanbanSquare } from 'lucide-react';
import { Link, Outlet } from 'react-router-dom';
import { disconnectSocket } from '../../lib/socket';
import { api } from '../../lib/api';
import { useAuthStore, forceLogout } from '../../stores/auth';
import { Avatar } from '../ui/avatar';
import { Button } from '../ui/button';

export function AppLayout() {
  const user = useAuthStore((state) => state.user);

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // Best effort — tokens are cleared locally either way.
    }
    disconnectSocket();
    forceLogout();
  };

  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-7xl items-center justify-between px-4 sm:px-6">
          <Link to="/workspaces" className="flex items-center gap-2 font-semibold text-slate-900">
            <KanbanSquare className="h-5 w-5 text-indigo-600" aria-hidden />
            Task Tracker
          </Link>
          <div className="flex items-center gap-3">
            <Avatar name={user?.name ?? '?'} />
            <div className="hidden text-sm sm:block">
              <div className="font-medium leading-tight text-slate-900">{user?.name}</div>
              <div className="text-xs leading-tight text-slate-500">{user?.email}</div>
            </div>
            <Button variant="ghost" size="sm" onClick={logout}>
              Log out
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6">
        <Outlet />
      </main>
    </div>
  );
}
