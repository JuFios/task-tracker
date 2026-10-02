import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Check,
  FolderKanban,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';

import { Button } from '../../../components/ui/button';
import { ConfirmButton } from '../../../components/ui/confirm-button';
import { EmptyState } from '../../../components/ui/empty-state';
import { Input } from '../../../components/ui/input';
import { FullPageSpinner } from '../../../components/ui/spinner';
import { Skeleton } from '../../../components/ui/skeleton';
import { errorMessage } from '../../../lib/api';
import { projectsApi, workspacesApi } from '../api';
import { MembersPanel } from '../components/members-panel';
import { ProjectModal } from '../components/project-modal';

type Tab = 'projects' | 'members';

export function WorkspacePage() {
  const { workspaceId = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const menuRef = useRef<HTMLDivElement>(null);

  const [tab, setTab] = useState<Tab>('projects');
  const [menuOpen, setMenuOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [projectModal, setProjectModal] = useState<{
    open: boolean;
    project?: { id: string; name: string; description: string | null };
  }>({ open: false });

  const {
    data: workspace,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['workspaces', workspaceId],
    queryFn: () => workspacesApi.get(workspaceId),
    retry: false,
  });

  const { data: projects } = useQuery({
    queryKey: ['workspaces', workspaceId, 'projects'],
    queryFn: () => projectsApi.list(workspaceId),
    enabled: Boolean(workspace),
  });

  const isOwner = workspace?.myRole === 'OWNER';

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['workspaces'] });

  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [menuOpen]);

  const renameMutation = useMutation({
    mutationFn: (name: string) => workspacesApi.rename(workspaceId, name),
    onSuccess: () => {
      toast.success('Workspace renamed');
      setRenaming(false);
      invalidate();
    },
    onError: (error) => toast.error(errorMessage(error, 'Could not rename the workspace')),
  });

  const deleteMutation = useMutation({
    mutationFn: () => workspacesApi.remove(workspaceId),
    onSuccess: async () => {
      toast.success('Workspace deleted');
      await invalidate();
      navigate('/workspaces', { replace: true });
    },
    onError: (error) => toast.error(errorMessage(error, 'Could not delete the workspace')),
  });

  const deleteProjectMutation = useMutation({
    mutationFn: (projectId: string) => projectsApi.remove(projectId),
    onSuccess: () => {
      toast.success('Project deleted');
      invalidate();
    },
    onError: (error) => toast.error(errorMessage(error, 'Could not delete the project')),
  });

  if (isLoading) return <FullPageSpinner />;

  if (error || !workspace) {
    return (
      <EmptyState
        icon={FolderKanban}
        title="Workspace not found"
        description="It may have been deleted, or you are not a member of it."
        action={
          <Link to="/workspaces">
            <Button variant="secondary">
              <ArrowLeft className="h-4 w-4" />
              Back to workspaces
            </Button>
          </Link>
        }
      />
    );
  }

  const startRename = () => {
    setDraftName(workspace.name);
    setRenaming(true);
    setMenuOpen(false);
  };

  return (
    <div className="space-y-6">
      <div>
        <Link
          to="/workspaces"
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Workspaces
        </Link>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          {renaming ? (
            <form
              className="flex items-center gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                const name = draftName.trim();
                if (name.length >= 2) renameMutation.mutate(name);
              }}
            >
              <Input
                value={draftName}
                onChange={(event) => setDraftName(event.target.value)}
                autoFocus
                className="h-9 w-64"
                maxLength={80}
              />
              <Button
                type="submit"
                size="sm"
                loading={renameMutation.isPending}
                disabled={draftName.trim().length < 2}
                aria-label="Save name"
              >
                <Check className="h-4 w-4" />
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setRenaming(false)}
                aria-label="Cancel rename"
              >
                <X className="h-4 w-4" />
              </Button>
            </form>
          ) : (
            <h1 className="text-2xl font-semibold text-slate-900">{workspace.name}</h1>
          )}

          <div className="flex items-center gap-2">
            {tab === 'projects' && (
              <Button size="sm" onClick={() => setProjectModal({ open: true })}>
                <Plus className="h-4 w-4" />
                New project
              </Button>
            )}
            {isOwner && !renaming && (
              <div className="relative" ref={menuRef}>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setMenuOpen((v) => !v)}
                  aria-label="Workspace settings"
                  aria-expanded={menuOpen}
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
                {menuOpen && (
                  <div className="absolute right-0 z-20 mt-1 w-44 overflow-hidden rounded-xl bg-white py-1 shadow-lg ring-1 ring-slate-200">
                    <button
                      type="button"
                      onClick={startRename}
                      className="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                    >
                      <Pencil className="h-4 w-4 text-slate-400" />
                      Rename
                    </button>
                    <ConfirmButton
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start rounded-none px-3 text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                      confirmLabel="Delete workspace?"
                      loading={deleteMutation.isPending}
                      onClick={() => deleteMutation.mutate()}
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete workspace
                    </ConfirmButton>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex gap-1 border-b border-slate-200">
        {(
          [
            { id: 'projects', label: 'Projects', icon: FolderKanban },
            { id: 'members', label: 'Members', icon: Users },
          ] as const
        ).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={
              tab === id
                ? '-mb-px flex items-center gap-2 border-b-2 border-indigo-600 px-3 py-2 text-sm font-medium text-indigo-700'
                : 'flex items-center gap-2 border-b-2 border-transparent px-3 py-2 text-sm font-medium text-slate-500 hover:text-slate-700'
            }
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {tab === 'members' ? (
        <MembersPanel workspaceId={workspaceId} myRole={workspace.myRole} />
      ) : !projects ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-32 rounded-2xl" />
          ))}
        </div>
      ) : projects.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          title="No projects yet"
          description="Create a project to get a Kanban board with tasks, comments and live updates."
          action={
            <Button onClick={() => setProjectModal({ open: true })}>
              <Plus className="h-4 w-4" />
              Create project
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <div
              key={project.id}
              className="group relative flex flex-col rounded-2xl bg-white p-5 ring-1 ring-slate-200 transition-shadow hover:shadow-md hover:ring-indigo-200"
            >
              <Link to={`/workspaces/${workspaceId}/projects/${project.id}`} className="flex-1">
                <h2 className="font-semibold text-slate-900 group-hover:text-indigo-700">
                  {project.name}
                </h2>
                {project.description && (
                  <p className="mt-1 line-clamp-2 text-sm text-slate-500">{project.description}</p>
                )}
                <p className="mt-3 text-xs text-slate-400">
                  {project._count.tasks} {project._count.tasks === 1 ? 'task' : 'tasks'}
                </p>
              </Link>
              {isOwner && (
                <div className="absolute right-3 top-3 flex gap-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
                  <button
                    type="button"
                    aria-label={`Edit ${project.name}`}
                    onClick={() =>
                      setProjectModal({
                        open: true,
                        project: {
                          id: project.id,
                          name: project.name,
                          description: project.description,
                        },
                      })
                    }
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <ConfirmButton
                    size="sm"
                    variant="ghost"
                    aria-label={`Delete ${project.name}`}
                    className="p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                    confirmLabel="Delete?"
                    onClick={() => deleteProjectMutation.mutate(project.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </ConfirmButton>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <ProjectModal
        open={projectModal.open}
        onClose={() => setProjectModal({ open: false })}
        workspaceId={workspaceId}
        project={projectModal.project}
      />
    </div>
  );
}
