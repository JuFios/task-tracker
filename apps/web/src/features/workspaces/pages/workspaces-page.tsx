import { useQuery } from '@tanstack/react-query';
import { FolderKanban, Plus } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Avatar } from '../../../components/ui/avatar';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { EmptyState } from '../../../components/ui/empty-state';
import { Skeleton } from '../../../components/ui/skeleton';
import { workspacesApi } from '../api';
import { CreateWorkspaceModal } from '../components/create-workspace-modal';

function WorkspaceCardSkeleton() {
  return (
    <div className="rounded-2xl bg-white p-5 ring-1 ring-slate-200">
      <Skeleton className="h-5 w-2/3" />
      <Skeleton className="mt-3 h-4 w-1/2" />
      <div className="mt-4 flex gap-1">
        <Skeleton className="h-7 w-7 rounded-full" />
        <Skeleton className="h-7 w-7 rounded-full" />
        <Skeleton className="h-7 w-7 rounded-full" />
      </div>
    </div>
  );
}

export function WorkspacesPage() {
  const [createOpen, setCreateOpen] = useState(false);
  const { data: workspaces, isLoading } = useQuery({
    queryKey: ['workspaces'],
    queryFn: workspacesApi.list,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Your workspaces</h1>
          <p className="mt-1 text-sm text-slate-500">
            Workspaces group your projects and team members.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" />
          New workspace
        </Button>
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }, (_, i) => (
            <WorkspaceCardSkeleton key={i} />
          ))}
        </div>
      ) : !workspaces || workspaces.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          title="No workspaces yet"
          description="Create your first workspace to start organising projects and inviting teammates."
          action={
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" />
              Create workspace
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {workspaces.map((workspace) => (
            <Link
              key={workspace.id}
              to={`/workspaces/${workspace.id}`}
              className="group rounded-2xl bg-white p-5 ring-1 ring-slate-200 transition-shadow hover:shadow-md hover:ring-indigo-200"
            >
              <div className="flex items-start justify-between gap-2">
                <h2 className="font-semibold text-slate-900 group-hover:text-indigo-700">
                  {workspace.name}
                </h2>
                {workspace.myRole === 'OWNER' && <Badge tone="amber">Owner</Badge>}
              </div>
              <p className="mt-1 text-sm text-slate-500">
                {workspace._count.projects}{' '}
                {workspace._count.projects === 1 ? 'project' : 'projects'} ·{' '}
                {workspace._count.members} {workspace._count.members === 1 ? 'member' : 'members'}
              </p>
              <div className="mt-4 flex items-center">
                <div className="flex -space-x-2">
                  {workspace.members.slice(0, 5).map((member) => (
                    <Avatar key={member.id} name={member.user.name} className="ring-2 ring-white" />
                  ))}
                </div>
                {workspace._count.members > 5 && (
                  <span className="ml-3 text-xs text-slate-400">
                    +{workspace._count.members - 5} more
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}

      <CreateWorkspaceModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}
