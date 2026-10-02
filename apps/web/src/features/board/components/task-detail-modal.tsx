import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Calendar, History, MessageSquare, Pencil, Send, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { Avatar } from '../../../components/ui/avatar';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { ConfirmButton } from '../../../components/ui/confirm-button';
import { Field } from '../../../components/ui/field';
import { Input } from '../../../components/ui/input';
import { Modal } from '../../../components/ui/modal';
import { Select } from '../../../components/ui/select';
import { Spinner } from '../../../components/ui/spinner';
import { Textarea } from '../../../components/ui/textarea';
import { errorMessage } from '../../../lib/api';
import { formatDate, formatDateTime, isOverdue } from '../../../lib/utils';
import { useAuthStore } from '../../../stores/auth';
import type { TaskCard, WorkspaceMemberInfo } from '../../../types';
import { boardApi } from '../api';
import {
  PRIORITY_BADGE_TONE,
  PRIORITY_LABEL,
  STATUS_BADGE_TONE,
  STATUS_LABEL,
  TASK_PRIORITIES,
} from '../constants';
import { commentSchema, taskSchema, type CommentValues, type TaskFormValues } from '../schemas';

interface TaskDetailModalProps {
  taskId: string | null;
  projectId: string;
  members: WorkspaceMemberInfo[];
  onClose: () => void;
  onDeleted: () => void;
}

function EditForm({
  task,
  members,
  onDone,
  onCancel,
}: {
  task: TaskCard;
  members: WorkspaceMemberInfo[];
  onDone: () => void;
  onCancel: () => void;
}) {
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<TaskFormValues>({
    resolver: zodResolver(taskSchema),
    values: {
      title: task.title,
      description: task.description ?? '',
      priority: task.priority,
      dueDate: task.dueDate ? task.dueDate.slice(0, 10) : '',
      assigneeId: task.assigneeId ?? '',
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await boardApi.update(task.id, values);
      await queryClient.invalidateQueries({ queryKey: ['tasks', task.id] });
      await queryClient.invalidateQueries({ queryKey: ['projects', task.projectId, 'tasks'] });
      toast.success('Task updated');
      onDone();
    } catch (error) {
      toast.error(errorMessage(error, 'Could not update the task'));
    }
  });

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <Field label="Title" error={errors.title?.message}>
        <Input invalid={Boolean(errors.title)} autoFocus {...register('title')} />
      </Field>
      <Field label="Description" error={errors.description?.message}>
        <Textarea rows={3} invalid={Boolean(errors.description)} {...register('description')} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Priority">
          <Select {...register('priority')}>
            {TASK_PRIORITIES.map((priority) => (
              <option key={priority} value={priority}>
                {PRIORITY_LABEL[priority]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Due date" error={errors.dueDate?.message}>
          <Input type="date" {...register('dueDate')} />
        </Field>
      </div>
      <Field label="Assignee">
        <Select {...register('assigneeId')}>
          <option value="">Unassigned</option>
          {members.map((member) => (
            <option key={member.user.id} value={member.user.id}>
              {member.user.name}
            </option>
          ))}
        </Select>
      </Field>
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" loading={isSubmitting}>
          Save changes
        </Button>
      </div>
    </form>
  );
}

function CommentItem({
  taskId,
  comment,
  canModify,
}: {
  taskId: string;
  comment: { id: string; content: string; createdAt: string; author: { id: string; name: string } };
  canModify: boolean;
}) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CommentValues>({ resolver: zodResolver(commentSchema) });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['tasks', taskId] });

  const updateMutation = useMutation({
    mutationFn: (values: CommentValues) =>
      boardApi.updateComment(taskId, comment.id, values.content),
    onSuccess: async () => {
      toast.success('Comment updated');
      setEditing(false);
      reset();
      await invalidate();
    },
    onError: (error) => toast.error(errorMessage(error, 'Could not update the comment')),
  });

  const deleteMutation = useMutation({
    mutationFn: () => boardApi.deleteComment(taskId, comment.id),
    onSuccess: async () => {
      toast.success('Comment deleted');
      await invalidate();
    },
    onError: (error) => toast.error(errorMessage(error, 'Could not delete the comment')),
  });

  if (editing) {
    const onSubmit = handleSubmit((values) => updateMutation.mutate(values));
    return (
      <form onSubmit={onSubmit} className="space-y-2">
        <Textarea
          rows={2}
          defaultValue={comment.content}
          invalid={Boolean(errors.content)}
          autoFocus
          {...register('content')}
        />
        {errors.content && <p className="text-xs text-rose-600">{errors.content.message}</p>}
        <div className="flex gap-2">
          <Button type="submit" size="sm" loading={isSubmitting}>
            Save
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setEditing(false)}>
            Cancel
          </Button>
        </div>
      </form>
    );
  }

  return (
    <div className="flex gap-2.5">
      <Avatar name={comment.author.name} className="h-7 w-7 text-[10px]" />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-medium text-slate-900">{comment.author.name}</span>
          <span className="text-xs text-slate-400">{formatDateTime(comment.createdAt)}</span>
        </div>
        <p className="whitespace-pre-wrap text-sm text-slate-700">{comment.content}</p>
      </div>
      {canModify && (
        <div className="flex shrink-0 gap-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
          <button
            type="button"
            aria-label="Edit comment"
            onClick={() => setEditing(true)}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <ConfirmButton
            variant="ghost"
            size="sm"
            aria-label="Delete comment"
            className="p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
            confirmLabel="Delete?"
            loading={deleteMutation.isPending}
            onClick={() => deleteMutation.mutate()}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </ConfirmButton>
        </div>
      )}
    </div>
  );
}

export function TaskDetailModal({
  taskId,
  projectId,
  members,
  onClose,
  onDeleted,
}: TaskDetailModalProps) {
  const queryClient = useQueryClient();
  const currentUserId = useAuthStore((state) => state.user?.id);
  const [editing, setEditing] = useState(false);

  const { data: task, isLoading } = useQuery({
    queryKey: ['tasks', taskId],
    queryFn: () => boardApi.details(taskId!),
    enabled: Boolean(taskId),
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CommentValues>({ resolver: zodResolver(commentSchema) });

  const addComment = handleSubmit(async (values) => {
    if (!taskId) return;
    try {
      await boardApi.addComment(taskId, values.content);
      reset();
      await queryClient.invalidateQueries({ queryKey: ['tasks', taskId] });
    } catch (error) {
      toast.error(errorMessage(error, 'Could not add the comment'));
    }
  });

  const deleteTask = async () => {
    if (!taskId) return;
    try {
      await boardApi.remove(taskId);
      toast.success('Task deleted');
      await queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'tasks'] });
      onDeleted();
    } catch (error) {
      toast.error(errorMessage(error, 'Could not delete the task'));
    }
  };

  return (
    <Modal open={Boolean(taskId)} onClose={onClose} title="Task details" className="max-w-2xl">
      {isLoading || !task ? (
        <div className="flex h-40 items-center justify-center">
          <Spinner className="h-6 w-6 text-indigo-600" />
        </div>
      ) : editing ? (
        <EditForm task={task} members={members} onDone={() => setEditing(false)} onCancel={() => setEditing(false)} />
      ) : (
        <div className="space-y-5 max-h-[70vh] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-slate-200">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={STATUS_BADGE_TONE[task.status]}>{STATUS_LABEL[task.status]}</Badge>
            <Badge tone={PRIORITY_BADGE_TONE[task.priority]}>
              <span className="h-1.5 w-1.5 rounded-full bg-current" />
              {PRIORITY_LABEL[task.priority]}
            </Badge>
            {task.dueDate && (
              <Badge tone={isOverdue(task.dueDate) && task.status !== 'DONE' ? 'rose' : 'slate'}>
                <Calendar className="h-3 w-3" />
                {formatDate(task.dueDate)}
              </Badge>
            )}
            <div className="ml-auto flex gap-2">
              <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
                <Pencil className="h-3.5 w-3.5" />
                Edit
              </Button>
              <ConfirmButton
                size="sm"
                variant="danger"
                confirmLabel="Delete task?"
                onClick={deleteTask}
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete
              </ConfirmButton>
            </div>
          </div>

          <div>
            <h3 className="text-xl font-semibold text-slate-900">{task.title}</h3>
            {task.description ? (
              <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">{task.description}</p>
            ) : (
              <p className="mt-2 text-sm italic text-slate-400">No description.</p>
            )}
          </div>

          <div className="grid gap-3 rounded-xl bg-slate-50 p-3 text-sm sm:grid-cols-3">
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-slate-400">Assignee</div>
              <div className="mt-1 flex items-center gap-2">
                {task.assignee ? (
                  <>
                    <Avatar name={task.assignee.name} className="h-6 w-6 text-[10px]" />
                    <span className="truncate">{task.assignee.name}</span>
                  </>
                ) : (
                  <span className="text-slate-400">Unassigned</span>
                )}
              </div>
            </div>
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-slate-400">Created</div>
              <div className="mt-1">{formatDate(task.createdAt)}</div>
            </div>
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-slate-400">Updated</div>
              <div className="mt-1">{formatDateTime(task.updatedAt)}</div>
            </div>
          </div>

          <div>
            <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900">
              <MessageSquare className="h-4 w-4 text-slate-400" />
              Comments ({task.comments.length})
            </h4>
            <div className="max-h-60 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-slate-200">
              <div className="space-y-4">
                {task.comments.length === 0 && (
                  <p className="text-sm text-slate-400">No comments yet — start the discussion.</p>
                )}
                {task.comments.map((comment) => (
                  <div key={comment.id} className="group">
                    <CommentItem
                      taskId={task.id}
                      comment={comment}
                      canModify={comment.author.id === currentUserId}
                    />
                  </div>
                ))}
              </div>
            </div>
            <form onSubmit={addComment} className="mt-4 space-y-2">
              <Textarea
                rows={2}
                placeholder="Write a comment…"
                invalid={Boolean(errors.content)}
                {...register('content')}
              />
              {errors.content && (
                <p className="text-xs text-rose-600">{errors.content.message}</p>
              )}
              <div className="flex justify-end">
                <Button type="submit" size="sm" loading={isSubmitting}>
                  <Send className="h-3.5 w-3.5" />
                  Comment
                </Button>
              </div>
            </form>
          </div>

          <div>
            <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900">
              <History className="h-4 w-4 text-slate-400" />
              Status history
            </h4>
            <div className="max-h-60 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-slate-200">
              {task.history.length === 0 ? (
                <p className="text-sm text-slate-400">No status changes yet.</p>
              ) : (
                <ol className="relative ml-2 space-y-3 border-l border-slate-200 pl-5 pb-2">
                  {task.history.map((entry) => (
                    <li key={entry.id} className="relative">
                      <span className="absolute -left-[26px] top-1.5 h-2.5 w-2.5 rounded-full bg-indigo-400 ring-4 ring-white" />
                      <p className="text-sm text-slate-700">
                        {entry.fromStatus ? (
                          <>
                            Moved from <span className="font-medium">{STATUS_LABEL[entry.fromStatus]}</span> to{' '}
                            <span className="font-medium">{STATUS_LABEL[entry.toStatus]}</span>
                          </>
                        ) : (
                          <>
                            Created in <span className="font-medium">{STATUS_LABEL[entry.toStatus]}</span>
                          </>
                        )}
                      </p>
                      <p className="text-xs text-slate-400">
                        {entry.changedBy.name} · {formatDateTime(entry.createdAt)}
                      </p>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
