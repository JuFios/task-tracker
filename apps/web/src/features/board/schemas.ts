import { z } from 'zod';

export const taskSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(200, 'At most 200 characters'),
  description: z.string().trim().max(10_000, 'At most 10000 characters').optional().or(z.literal('')),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']),
  dueDate: z.string().optional().or(z.literal('')),
  assigneeId: z.string().optional().or(z.literal('')),
});
export type TaskFormValues = z.infer<typeof taskSchema>;

export const commentSchema = z.object({
  content: z.string().trim().min(1, 'Comment cannot be empty').max(5000, 'At most 5000 characters'),
});
export type CommentValues = z.infer<typeof commentSchema>;

/** Board filters use '' as the "any" value so inputs stay controlled. */
export interface BoardFilters {
  status: '' | 'TODO' | 'IN_PROGRESS' | 'DONE';
  priority: '' | 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  assigneeId: string;
  search: string;
}

export const EMPTY_FILTERS: BoardFilters = {
  status: '',
  priority: '',
  assigneeId: '',
  search: '',
};
