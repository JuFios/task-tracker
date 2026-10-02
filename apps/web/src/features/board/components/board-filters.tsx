import { Search, SlidersHorizontal, X } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Select } from '../../../components/ui/select';
import type { WorkspaceMemberInfo } from '../../../types';
import { PRIORITY_LABEL, STATUS_LABEL, TASK_PRIORITIES, TASK_STATUSES } from '../constants';
import { EMPTY_FILTERS, type BoardFilters } from '../schemas';

interface BoardFiltersBarProps {
  filters: BoardFilters;
  onChange: (filters: BoardFilters) => void;
  members: WorkspaceMemberInfo[];
  disabled?: boolean;
}

export function BoardFiltersBar({ filters, onChange, members, disabled }: BoardFiltersBarProps) {
  const set = <K extends keyof BoardFilters>(key: K, value: BoardFilters[K]) =>
    onChange({ ...filters, [key]: value });

  const active = Object.values(filters).some((v) => v !== '');

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input
          aria-label="Search tasks"
          placeholder="Search tasks…"
          value={filters.search}
          disabled={disabled}
          onChange={(event) => set('search', event.target.value)}
          className="h-9 w-52 pl-9"
        />
      </div>

      <Select
        aria-label="Filter by status"
        value={filters.status}
        disabled={disabled}
        onChange={(event) => set('status', event.target.value as BoardFilters['status'])}
        className="h-9 w-36"
      >
        <option value="">All statuses</option>
        {TASK_STATUSES.map((status) => (
          <option key={status} value={status}>
            {STATUS_LABEL[status]}
          </option>
        ))}
      </Select>

      <Select
        aria-label="Filter by priority"
        value={filters.priority}
        disabled={disabled}
        onChange={(event) => set('priority', event.target.value as BoardFilters['priority'])}
        className="h-9 w-36"
      >
        <option value="">All priorities</option>
        {TASK_PRIORITIES.map((priority) => (
          <option key={priority} value={priority}>
            {PRIORITY_LABEL[priority]}
          </option>
        ))}
      </Select>

      <Select
        aria-label="Filter by assignee"
        value={filters.assigneeId}
        disabled={disabled}
        onChange={(event) => set('assigneeId', event.target.value)}
        className="h-9 w-44"
      >
        <option value="">Anyone</option>
        {members.map((member) => (
          <option key={member.user.id} value={member.user.id}>
            {member.user.name}
          </option>
        ))}
      </Select>

      {active && (
        <Button variant="ghost" size="sm" onClick={() => onChange(EMPTY_FILTERS)}>
          <X className="h-4 w-4" />
          Clear
        </Button>
      )}

      {active && (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700 ring-1 ring-inset ring-indigo-200">
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Drag & drop is disabled while filters are active
        </span>
      )}
    </div>
  );
}
