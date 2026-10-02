import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Calendar, MessageSquare } from 'lucide-react';
import type { MouseEvent } from 'react';
import { Avatar } from '../../../components/ui/avatar';
import { Badge } from '../../../components/ui/badge';
import { cn, formatDate, isOverdue } from '../../../lib/utils';
import type { TaskCard } from '../../../types';
import { PRIORITY_BADGE_TONE, PRIORITY_LABEL } from '../constants';

interface TaskCardViewProps {
  task: TaskCard;
  disabled?: boolean;
  onOpen: (taskId: string) => void;
}

export function TaskCardView({ task, disabled, onOpen }: TaskCardViewProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { task },
    disabled,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const handleClick = (event: MouseEvent) => {
    // Let dnd-kit distinguish a click from a drag; plain click opens the card.
    if (event.detail === 0) return;
    onOpen(task.id);
  };

  const overdue = isOverdue(task.dueDate) && task.status !== 'DONE';

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onOpen(task.id);
        }
      }}
      className={cn(
        'group cursor-grab rounded-xl bg-white p-3 shadow-sm ring-1 ring-slate-200 transition hover:shadow-md hover:ring-indigo-300',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500',
        isDragging && 'z-30 rotate-2 cursor-grabbing opacity-90 shadow-lg ring-indigo-400'
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <Badge tone={PRIORITY_BADGE_TONE[task.priority]}>
          <span className="h-1.5 w-1.5 rounded-full bg-current" />
          {PRIORITY_LABEL[task.priority]}
        </Badge>
        {task.assignee && <Avatar name={task.assignee.name} className="h-6 w-6 text-[10px]" />}
      </div>
      <h3 className="mt-2 text-sm font-medium leading-snug text-slate-900">{task.title}</h3>
      {task.description && (
        <p className="mt-1 line-clamp-2 text-xs text-slate-500">{task.description}</p>
      )}
      <div className="mt-3 flex items-center gap-3 text-xs text-slate-400">
        {task.dueDate && (
          <span
            className={cn(
              'inline-flex items-center gap-1',
              overdue ? 'font-medium text-rose-600' : 'text-slate-500'
            )}
          >
            <Calendar className="h-3.5 w-3.5" />
            {formatDate(task.dueDate)}
          </span>
        )}
        {task._count.comments > 0 && (
          <span className="inline-flex items-center gap-1">
            <MessageSquare className="h-3.5 w-3.5" />
            {task._count.comments}
          </span>
        )}
      </div>
    </div>
  );
}
