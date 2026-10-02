import { api } from '../../lib/api';
import type {
  Paginated,
  TaskCard,
  TaskComment,
  TaskDetails,
  TaskPriority,
  TaskStatus,
} from '../../types';
import type { TaskFormValues } from './schemas';

export interface TaskQueryParams {
  status?: TaskStatus;
  priority?: TaskPriority;
  assigneeId?: string;
  search?: string;
  page?: number;
  limit?: number;
}

function toPayload(values: TaskFormValues) {
  return {
    title: values.title.trim(),
    ...(values.description?.trim() ? { description: values.description.trim() } : {}),
    priority: values.priority,
    ...(values.dueDate ? { dueDate: values.dueDate } : {}),
    ...(values.assigneeId ? { assigneeId: values.assigneeId } : {}),
  };
}

export const boardApi = {
  listPage: (projectId: string, params: TaskQueryParams) =>
    api
      .get<Paginated<TaskCard>>(`/projects/${projectId}/tasks`, { params })
      .then((r) => r.data),

  /** Pages through the whole unfiltered result set — the board must be complete for ordering to work. */
  fetchAll: async (projectId: string): Promise<TaskCard[]> => {
    const limit = 200;
    const first = await boardApi.listPage(projectId, { page: 1, limit });
    const all = [...first.items];
    for (let page = 2; page <= first.meta.totalPages; page++) {
      const next = await boardApi.listPage(projectId, { page, limit });
      all.push(...next.items);
    }
    return all;
  },

  create: (projectId: string, values: TaskFormValues & { status?: TaskStatus }) =>
    api
      .post<TaskCard>(`/projects/${projectId}/tasks`, { ...toPayload(values), status: values.status })
      .then((r) => r.data),

  update: (taskId: string, values: Partial<TaskFormValues>) => {
    const payload: Record<string, unknown> = {};
    if (values.title !== undefined) payload.title = values.title.trim();
    if (values.description !== undefined) {
      payload.description = values.description.trim() || null;
    }
    if (values.priority !== undefined) payload.priority = values.priority;
    if (values.dueDate !== undefined) payload.dueDate = values.dueDate || null;
    if (values.assigneeId !== undefined) payload.assigneeId = values.assigneeId || null;
    return api.patch<TaskCard>(`/tasks/${taskId}`, payload).then((r) => r.data);
  },

  move: (taskId: string, status: TaskStatus, position: number) =>
    api
      .patch<TaskCard>(`/tasks/${taskId}/move`, { status, position })
      .then((r) => r.data),

  remove: (taskId: string) => api.delete(`/tasks/${taskId}`),

  details: (taskId: string) => api.get<TaskDetails>(`/tasks/${taskId}`).then((r) => r.data),

  addComment: (taskId: string, content: string) =>
    api
      .post<TaskComment>(`/tasks/${taskId}/comments`, { content })
      .then((r) => r.data),

  updateComment: (taskId: string, commentId: string, content: string) =>
    api
      .patch<TaskComment>(`/tasks/${taskId}/comments/${commentId}`, { content })
      .then((r) => r.data),

  deleteComment: (taskId: string, commentId: string) =>
    api.delete(`/tasks/${taskId}/comments/${commentId}`),
};
