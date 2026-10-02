import { api } from '../../lib/api';
import type {
  ProjectPreview,
  WorkspaceMemberInfo,
  WorkspacePreview,
  WorkspaceRole,
} from '../../types';

export const workspacesApi = {
  list: () => api.get<WorkspacePreview[]>('/workspaces').then((r) => r.data),

  get: (workspaceId: string) =>
    api.get<WorkspacePreview>(`/workspaces/${workspaceId}`).then((r) => r.data),

  create: (name: string) => api.post<WorkspacePreview>('/workspaces', { name }).then((r) => r.data),

  rename: (workspaceId: string, name: string) =>
    api
      .patch<{ id: string; name: string }>(`/workspaces/${workspaceId}`, { name })
      .then((r) => r.data),

  remove: (workspaceId: string) => api.delete(`/workspaces/${workspaceId}`),

  members: (workspaceId: string) =>
    api.get<WorkspaceMemberInfo[]>(`/workspaces/${workspaceId}/members`).then((r) => r.data),

  invite: (workspaceId: string, email: string, role: WorkspaceRole) =>
    api
      .post<WorkspaceMemberInfo>(`/workspaces/${workspaceId}/members`, { email, role })
      .then((r) => r.data),

  updateMemberRole: (workspaceId: string, memberId: string, role: WorkspaceRole) =>
    api
      .patch<WorkspaceMemberInfo>(`/workspaces/${workspaceId}/members/${memberId}`, { role })
      .then((r) => r.data),

  removeMember: (workspaceId: string, memberId: string) =>
    api.delete(`/workspaces/${workspaceId}/members/${memberId}`),

  transferOwnership: (workspaceId: string, newOwnerId: string) =>
    api.post(`/workspaces/${workspaceId}/transfer-ownership`, { newOwnerId }),

  leave: (workspaceId: string) => api.post(`/workspaces/${workspaceId}/leave`),
};

export const projectsApi = {
  list: (workspaceId: string) =>
    api.get<ProjectPreview[]>(`/workspaces/${workspaceId}/projects`).then((r) => r.data),

  get: (projectId: string) => api.get<ProjectPreview>(`/projects/${projectId}`).then((r) => r.data),

  create: (workspaceId: string, values: { name: string; description?: string }) =>
    api.post<ProjectPreview>(`/workspaces/${workspaceId}/projects`, values).then((r) => r.data),

  update: (projectId: string, values: { name?: string; description?: string }) =>
    api.patch<ProjectPreview>(`/projects/${projectId}`, values).then((r) => r.data),

  remove: (projectId: string) => api.delete(`/projects/${projectId}`),
};
