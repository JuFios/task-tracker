import { useQuery } from '@tanstack/react-query';
import type { TaskCard, TaskPriority, TaskStatus } from '../../../types';
import { boardApi } from '../api';
import { type BoardFilters } from '../schemas';

export interface BoardQueryParams {
  status?: TaskStatus;
  priority?: TaskPriority;
  assigneeId?: string;
  search?: string;
}

export function filtersToParams(filters: BoardFilters): BoardQueryParams {
  return {
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.priority ? { priority: filters.priority } : {}),
    ...(filters.assigneeId ? { assigneeId: filters.assigneeId } : {}),
    ...(filters.search.trim() ? { search: filters.search.trim() } : {}),
  };
}

export function hasActiveFilters(filters: BoardFilters): boolean {
  return Object.values(filters).some((v) => v !== '');
}

/**
 * The board needs the FULL task list to render columns in the right order, so
 * unfiltered queries page through everything (limit 200 per request). Filtered
 * views are display-only (drag & drop is disabled there), one page is enough.
 */
export function useBoardTasks(projectId: string, filters: BoardFilters) {
  const params = filtersToParams(filters);
  const filtered = hasActiveFilters(filters);

  const query = useQuery({
    queryKey: ['projects', projectId, 'tasks', params],
    queryFn: (): Promise<TaskCard[]> =>
      filtered
        ? boardApi.listPage(projectId, { ...params, page: 1, limit: 200 }).then((r) => r.items)
        : boardApi.fetchAll(projectId),
    retry: false,
  });

  return { ...query, hasFilters: filtered };
}
