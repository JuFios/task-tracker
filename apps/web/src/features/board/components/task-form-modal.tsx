import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { Button } from '../../../components/ui/button';
import { Field } from '../../../components/ui/field';
import { Input } from '../../../components/ui/input';
import { Modal } from '../../../components/ui/modal';
import { Select } from '../../../components/ui/select';
import { Textarea } from '../../../components/ui/textarea';
import { errorMessage } from '../../../lib/api';
import type { TaskCard, TaskStatus, WorkspaceMemberInfo } from '../../../types';
import { boardApi } from '../api';
import { PRIORITY_LABEL, TASK_PRIORITIES } from '../constants';
import { taskSchema, type TaskFormValues } from '../schemas';

interface TaskFormModalProps {
  open: boolean;
  onClose: () => void;
  projectId: string;
  /** Initial column for a new task. */
  status: TaskStatus;
  /** When set, the modal edits this task instead of creating one. */
  task?: TaskCard;
  members: WorkspaceMemberInfo[];
}

export function TaskFormModal({
  open,
  onClose,
  projectId,
  status,
  task,
  members,
}: TaskFormModalProps) {
  const queryClient = useQueryClient();
  const isEditing = Boolean(task);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<TaskFormValues>({
    resolver: zodResolver(taskSchema),
    values: {
      title: task?.title ?? '',
      description: task?.description ?? '',
      priority: task?.priority ?? 'MEDIUM',
      dueDate: task?.dueDate ? task.dueDate.slice(0, 10) : '',
      assigneeId: task?.assigneeId ?? '',
    },
  });

  const close = () => {
    reset();
    onClose();
  };

  const onSubmit = handleSubmit(async (values) => {
    try {
      if (isEditing && task) {
        await boardApi.update(task.id, values);
        await queryClient.invalidateQueries({ queryKey: ['tasks', task.id] });
        await queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'tasks'] });
        toast.success('Task updated');
      } else {
        await boardApi.create(projectId, { ...values, status });
        await queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'tasks'] });
        toast.success('Task created');
      }
      close();
    } catch (error) {
      toast.error(errorMessage(error, isEditing ? 'Could not update the task' : 'Could not create the task'));
    }
  });

  return (
    <Modal open={open} onClose={close} title={isEditing ? 'Edit task' : 'New task'}>
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <Field label="Title" htmlFor="task-title" error={errors.title?.message}>
          <Input
            id="task-title"
            placeholder="What needs to be done?"
            invalid={Boolean(errors.title)}
            autoFocus
            {...register('title')}
          />
        </Field>

        <Field label="Description" htmlFor="task-description" error={errors.description?.message}>
          <Textarea
            id="task-description"
            rows={3}
            placeholder="Add details… (optional)"
            invalid={Boolean(errors.description)}
            {...register('description')}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Priority" htmlFor="task-priority">
            <Select id="task-priority" {...register('priority')}>
              {TASK_PRIORITIES.map((priority) => (
                <option key={priority} value={priority}>
                  {PRIORITY_LABEL[priority]}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Due date" htmlFor="task-due" error={errors.dueDate?.message}>
            <Input id="task-due" type="date" {...register('dueDate')} />
          </Field>
        </div>

        <Field label="Assignee" htmlFor="task-assignee">
          <Select id="task-assignee" {...register('assigneeId')}>
            <option value="">Unassigned</option>
            {members.map((member) => (
              <option key={member.user.id} value={member.user.id}>
                {member.user.name}
              </option>
            ))}
          </Select>
        </Field>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={close}>
            Cancel
          </Button>
          <Button type="submit" loading={isSubmitting}>
            {isEditing ? 'Save changes' : 'Create task'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
