import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  type UniqueIdentifier,
} from '@dnd-kit/core';
import { SortableContext, arrayMove, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useQueryClient } from '@tanstack/react-query';
import { Calendar, MessageSquare, Plus } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Avatar } from '../../../components/ui/avatar';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { EmptyState } from '../../../components/ui/empty-state';
import { FullPageSpinner } from '../../../components/ui/spinner';
import { errorMessage } from '../../../lib/api';
import { cn, formatDate, isOverdue } from '../../../lib/utils';
import type { TaskCard, TaskStatus } from '../../../types';
import { boardApi } from '../api';
import {
  PRIORITY_BADGE_TONE,
  PRIORITY_LABEL,
  STATUS_DOT,
  STATUS_LABEL,
  TASK_STATUSES,
} from '../constants';
import { TaskCardView } from './task-card';

type Columns = Record<TaskStatus, TaskCard[]>;

function groupByStatus(tasks: TaskCard[]): Columns {
  const grouped: Columns = { TODO: [], IN_PROGRESS: [], DONE: [] };
  for (const task of tasks) grouped[task.status].push(task);
  for (const status of TASK_STATUSES) {
    grouped[status].sort((a, b) => a.position - b.position);
  }
  return grouped;
}

function Column({
  status,
  tasks,
  hasFilters,
  onOpenTask,
  onAddTask,
}: {
  status: TaskStatus;
  tasks: TaskCard[];
  hasFilters: boolean;
  onOpenTask: (taskId: string) => void;
  onAddTask: (status: TaskStatus) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status, disabled: hasFilters });

  return (
    <section className="flex w-72 shrink-0 flex-col rounded-2xl bg-slate-100/80 p-2 lg:w-80">
      <header className="flex items-center gap-2 px-2 py-1.5">
        <span className={cn('h-2 w-2 rounded-full', STATUS_DOT[status])} />
        <h2 className="text-sm font-semibold text-slate-700">{STATUS_LABEL[status]}</h2>
        <span className="rounded-full bg-white px-2 py-0.5 text-xs font-medium text-slate-500 ring-1 ring-inset ring-slate-200">
          {tasks.length}
        </span>
        {!hasFilters && (
          <button
            type="button"
            onClick={() => onAddTask(status)}
            aria-label={`Add task to ${STATUS_LABEL[status]}`}
            className="ml-auto rounded-lg p-1 text-slate-400 transition-colors hover:bg-white hover:text-indigo-600"
          >
            <Plus className="h-4 w-4" />
          </button>
        )}
      </header>

      <div
        ref={setNodeRef}
        className={cn(
          'flex min-h-24 flex-1 flex-col gap-2 rounded-xl p-1 transition-colors',
          isOver && 'bg-indigo-100/60 ring-2 ring-inset ring-indigo-300',
        )}
      >
        <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.map((task) => (
            <TaskCardView
              key={task.id}
              task={task}
              disabled={hasFilters}
              onOpen={onOpenTask}
            />
          ))}
        </SortableContext>
        {tasks.length === 0 && (
          <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-slate-300 py-8 text-xs text-slate-400">
            {hasFilters ? 'No matching tasks' : 'Drop tasks here'}
          </div>
        )}
      </div>
    </section>
  );
}

function OverlayCard({ task }: { task: TaskCard }) {
  return (
    <div className="w-72 rotate-2 cursor-grabbing rounded-xl bg-white p-3 shadow-lg ring-1 ring-indigo-400 lg:w-80">
      <div className="flex items-start justify-between gap-2">
        <Badge tone={PRIORITY_BADGE_TONE[task.priority]}>
          <span className="h-1.5 w-1.5 rounded-full bg-current" />
          {PRIORITY_LABEL[task.priority]}
        </Badge>
        {task.assignee && <Avatar name={task.assignee.name} className="h-6 w-6 text-[10px]" />}
      </div>
      <h3 className="mt-2 text-sm font-medium leading-snug text-slate-900">{task.title}</h3>
      <div className="mt-3 flex items-center gap-3 text-xs text-slate-400">
        {task.dueDate && (
          <span
            className={cn(
              'inline-flex items-center gap-1',
              isOverdue(task.dueDate) && task.status !== 'DONE'
                ? 'font-medium text-rose-600'
                : 'text-slate-500',
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

interface BoardProps {
  projectId: string;
  tasks: TaskCard[] | undefined;
  isLoading: boolean;
  error: Error | null;
  hasFilters: boolean;
  onOpenTask: (taskId: string) => void;
  onAddTask: (status: TaskStatus) => void;
}

export function Board({
  projectId,
  tasks,
  isLoading,
  error,
  hasFilters,
  onOpenTask,
  onAddTask,
}: BoardProps) {
  const queryClient = useQueryClient();
  const [columns, setColumns] = useState<Columns>(groupByStatus([]));
  const [activeTask, setActiveTask] = useState<TaskCard | null>(null);
  const dragging = useRef(false);

  // Server data is the source of truth; local state only diverges while dragging.
  useEffect(() => {
    if (!dragging.current && tasks) {
      setColumns(groupByStatus(tasks));
    }
  }, [tasks]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
      disabled: hasFilters,
    }),
  );

  const findStatus = (id: UniqueIdentifier): TaskStatus | undefined => {
    if (TASK_STATUSES.includes(id as TaskStatus)) return id as TaskStatus;
    for (const status of TASK_STATUSES) {
      if (columns[status].some((task) => task.id === id)) return status;
    }
    return undefined;
  };

  const syncFromServer = () =>
    queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'tasks'] });

  const commitMove = async (taskId: string, status: TaskStatus, position: number) => {
    try {
      await boardApi.move(taskId, status, position);
    } catch (error) {
      toast.error(errorMessage(error, 'Failed to move the task'));
    } finally {
      // Always resync with the server: on failure this rolls the board back.
      await syncFromServer();
    }
  };

  const handleDragStart = ({ active }: DragStartEvent) => {
    dragging.current = true;
    const status = findStatus(active.id);
    setActiveTask(status ? (columns[status].find((t) => t.id === active.id) ?? null) : null);
  };

  const handleDragOver = ({ active, over }: DragOverEvent) => {
    if (!over || hasFilters) return;
    const activeStatus = findStatus(active.id);
    const overStatus = findStatus(over.id);
    if (!activeStatus || !overStatus || activeStatus === overStatus) return;

    setColumns((prev) => {
      const activeItems = prev[activeStatus];
      const overItems = prev[overStatus];
      const activeIndex = activeItems.findIndex((t) => t.id === active.id);
      const overIndex = overItems.findIndex((t) => t.id === over.id);
      if (activeIndex === -1) return prev;
      const next: Columns = { ...prev, [activeStatus]: [...activeItems], [overStatus]: [...overItems] };
      const [moved] = next[activeStatus].splice(activeIndex, 1);
      next[overStatus].splice(overIndex >= 0 ? overIndex : next[overStatus].length, 0, moved);
      return next;
    });
  };

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    dragging.current = false;
    setActiveTask(null);
    if (!over || hasFilters || !tasks) return;

    // onDragOver already relocated the task for cross-column drags, so at
    // this point the task lives in the column it was dropped over.
    const overStatus = findStatus(over.id);
    if (!overStatus) return;

    const overItems = columns[overStatus];
    const activeIndex = overItems.findIndex((t) => t.id === active.id);
    if (activeIndex === -1) return;
    // Dropping over the column container itself means "append at the end".
    const overIndex =
      over.id === overStatus ? Math.max(0, overItems.length - 1) : overItems.findIndex((t) => t.id === over.id);
    if (overIndex === -1) return;

    const nextItems =
      activeIndex === overIndex ? overItems : arrayMove(overItems, activeIndex, overIndex);

    // `tasks` is the pre-drag server snapshot: compare against it so a task
    // dropped back into its original slot fires no request, while a drop onto
    // the empty tail of a column (where onDragOver already placed it) still
    // commits the status change.
    const serverItems = groupByStatus(tasks)[overStatus];
    const changed =
      nextItems.length !== serverItems.length ||
      nextItems.some((task, index) => serverItems[index]?.id !== task.id);

    setColumns({ ...columns, [overStatus]: nextItems });
    if (changed) void commitMove(String(active.id), overStatus, overIndex);
  };

  const handleDragCancel = () => {
    dragging.current = false;
    setActiveTask(null);
    if (tasks) setColumns(groupByStatus(tasks));
  };

  if (isLoading) return <FullPageSpinner />;

  if (error) {
    return (
      <EmptyState
        icon={Plus}
        title="Failed to load tasks"
        description="There was an error loading the board. Please try again."
        action={
          <Button onClick={() => syncFromServer()}>
            Retry
          </Button>
        }
      />
    );
  }

  const total = TASK_STATUSES.reduce((sum, status) => sum + columns[status].length, 0);
  const showEmptyBoard = !hasFilters && total === 0;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      {showEmptyBoard ? (
        <EmptyState
          icon={Plus}
          title="The board is empty"
          description="Create your first task to get started — you can drag it between columns later."
          action={
            <Button onClick={() => onAddTask('TODO')}>
              <Plus className="h-4 w-4" />
              Create task
            </Button>
          }
        />
      ) : (
        <div className="flex items-start gap-3 overflow-x-auto pb-4">
          {TASK_STATUSES.map((status) => (
            <Column
              key={status}
              status={status}
              tasks={columns[status]}
              hasFilters={hasFilters}
              onOpenTask={onOpenTask}
              onAddTask={onAddTask}
            />
          ))}
        </div>
      )}
      <DragOverlay>{activeTask ? <OverlayCard task={activeTask} /> : null}</DragOverlay>
    </DndContext>
  );
}
