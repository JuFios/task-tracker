import { z } from 'zod';

export const workspaceNameSchema = z.object({
  name: z.string().trim().min(2, 'At least 2 characters').max(80, 'At most 80 characters'),
});
export type WorkspaceNameValues = z.infer<typeof workspaceNameSchema>;

export const projectSchema = z.object({
  name: z.string().trim().min(2, 'At least 2 characters').max(120, 'At most 120 characters'),
  description: z.string().trim().max(2000, 'At most 2000 characters').optional().or(z.literal('')),
});
export type ProjectFormValues = z.infer<typeof projectSchema>;
