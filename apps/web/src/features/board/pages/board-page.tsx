import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, FolderKanban, Plus } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Button } from '../../../components/ui/button';
import { EmptyState } from '../../../components/ui/empty-state';
import { FullPageSpinner } from '../../../components/ui/spinner';
import { projectsApi, workspacesApi } from '../../workspaces/api';
import { useBoardSocket } from '../hooks/use-board-socket';
import { useBoardTasks } from '../hooks/use-board-tasks';
import { Board } from '../components/board';
import { BoardFiltersBar } from '../components/board-filters';
import { TaskDetailModal } from '../components/task-detail-modal';
import { TaskFormModal } from '../components/task-form-modal';
import { EMPTY_FILTERS, type BoardFilters } from '../schemas';
import type { TaskStatus } from '../../../types';

export function BoardPage() {
  const { workspaceId = '', projectId = '' } = useParams();

  const [filters, setFilters] = useState<BoardFilters>(EMPTY_FILTERS);
  const [formState, setFormState] = useState<{ open: boolean; status: TaskStatus }>({
    open: false,
    status: 'TODO',
  });
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  useBoardSocket(projectId);

  const { data: project, isLoading: projectLoading, error: projectError } = useQuery({
    queryKey: ['projects', projectId],
    queryFn: () => projectsApi.get(projectId),
    retry: false,
  });

  const { data: workspace } = useQuery({
    queryKey: ['workspaces', workspaceId],
    queryFn: () => workspacesApi.get(workspaceId),
    enabled: Boolean(project),
  });

  const { data: members = [] } = useQuery({
    queryKey: ['workspaces', workspaceId, 'members'],
    queryFn: () => workspacesApi.members(workspaceId),
    enabled: Boolean(project),
  });

  const { data: tasks, isLoading: tasksLoading, error: tasksError, hasFilters } = useBoardTasks(projectId, filters);

  if (projectLoading) return <FullPageSpinner />;

  if (projectError || !project) {
    return (
      <EmptyState
        icon={FolderKanban}
        title="Project not found"
        description="It may have been deleted, or you are not a member of its workspace."
        action={
          <Link to={`/workspaces/${workspaceId}`}>
            <Button variant="secondary">
              <ArrowLeft className="h-4 w-4" />
              Back to workspace
            </Button>
          </Link>
        }
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <nav className="flex items-center gap-1 text-sm text-slate-500">
            <Link to="/workspaces" className="hover:text-slate-700">
              Workspaces
            </Link>
            <span aria-hidden>/</span>
            <Link to={`/workspaces/${workspaceId}`} className="hover:text-slate-700">
              {workspace?.name ?? 'Workspace'}
            </Link>
            <span aria-hidden>/</span>
          </nav>
          <h1 className="mt-1 truncate text-2xl font-semibold text-slate-900">{project.name}</h1>
        </div>
        <Button
          onClick={() => setFormState({ open: true, status: 'TODO' })}
          disabled={hasFilters}
          title={hasFilters ? 'Clear filters to create tasks' : undefined}
        >
          <Plus className="h-4 w-4" />
          New task
        </Button>
      </div>

      <BoardFiltersBar filters={filters} onChange={setFilters} members={members} />

      <Board
        projectId={projectId}
        tasks={tasks}
        isLoading={tasksLoading}
        error={tasksError ?? null}
        hasFilters={hasFilters}
        onOpenTask={setSelectedTaskId}
        onAddTask={(status) => setFormState({ open: true, status })}
      />

      <TaskFormModal
        open={formState.open}
        onClose={() => setFormState((s) => ({ ...s, open: false }))}
        projectId={projectId}
        status={formState.status}
        members={members}
      />

      <TaskDetailModal
        taskId={selectedTaskId}
        projectId={projectId}
        members={members}
        onClose={() => setSelectedTaskId(null)}
        onDeleted={() => setSelectedTaskId(null)}
      />
    </div>
  );
}
