import type { BadgeTone } from '../../components/ui/badge';
import type { TaskPriority, TaskStatus } from '../../types';

export const TASK_STATUSES: TaskStatus[] = ['TODO', 'IN_PROGRESS', 'DONE'];

export const STATUS_LABEL: Record<TaskStatus, string> = {
  TODO: 'To do',
  IN_PROGRESS: 'In progress',
  DONE: 'Done',
};

export const STATUS_DOT: Record<TaskStatus, string> = {
  TODO: 'bg-slate-400',
  IN_PROGRESS: 'bg-amber-500',
  DONE: 'bg-emerald-500',
};

export const STATUS_BADGE_TONE: Record<TaskStatus, BadgeTone> = {
  TODO: 'slate',
  IN_PROGRESS: 'amber',
  DONE: 'emerald',
};

export const TASK_PRIORITIES: TaskPriority[] = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];

export const PRIORITY_LABEL: Record<TaskPriority, string> = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
  URGENT: 'Urgent',
};

export const PRIORITY_BADGE_TONE: Record<TaskPriority, BadgeTone> = {
  LOW: 'slate',
  MEDIUM: 'blue',
  HIGH: 'amber',
  URGENT: 'rose',
};
