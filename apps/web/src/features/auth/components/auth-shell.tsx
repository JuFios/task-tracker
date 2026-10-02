import { KanbanSquare } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

interface AuthShellProps {
  title: string;
  subtitle: ReactNode;
  children: ReactNode;
}

export function AuthShell({ title, subtitle, children }: AuthShellProps) {
  return (
    <div className="flex min-h-full flex-col items-center justify-center bg-slate-50 px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-2">
          <div className="rounded-2xl bg-indigo-600 p-2.5 text-white">
            <KanbanSquare className="h-6 w-6" aria-hidden />
          </div>
          <h1 className="text-xl font-semibold text-slate-900">Task Tracker</h1>
        </div>
        <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
          <div className="mt-6">{children}</div>
        </div>
        <p className="mt-6 text-center text-xs text-slate-400">
          <Link to="/" className="hover:text-slate-600">
            Back to home
          </Link>
        </p>
      </div>
    </div>
  );
}
