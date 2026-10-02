import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { TaskPriority, TaskStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { WorkspacesService } from '../workspaces/workspaces.service';
import {
  CreateCommentDto,
  CreateTaskDto,
  MoveTaskDto,
  QueryTasksDto,
  UpdateCommentDto,
  UpdateTaskDto,
} from './dto';
import { TasksGateway } from './tasks.gateway';

const taskCardSelect = {
  id: true,
  title: true,
  description: true,
  status: true,
  priority: true,
  position: true,
  dueDate: true,
  createdAt: true,
  updatedAt: true,
  projectId: true,
  assigneeId: true,
  assignee: { select: { id: true, name: true, email: true } },
  _count: { select: { comments: true } },
} as const;

export type TaskCard = Prisma.TaskGetPayload<{ select: typeof taskCardSelect }>;

export interface Paginated<T> {
  items: T[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

@Injectable()
export class TasksService {
  private readonly logger = new Logger(TasksService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly workspaces: WorkspacesService,
    private readonly gateway: TasksGateway
  ) {}

  async list(
    userId: string,
    projectId: string,
    query: QueryTasksDto
  ): Promise<Paginated<TaskCard>> {
    await this.workspaces.assertProjectMember(userId, projectId);

    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 50, 200);
    const where: Prisma.TaskWhereInput = {
      projectId,
      ...(query.status && { status: query.status }),
      ...(query.priority && { priority: query.priority }),
      ...(query.assigneeId && { assigneeId: query.assigneeId }),
      ...(query.search?.trim() && {
        title: { contains: query.search.trim(), mode: 'insensitive' },
      }),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.task.findMany({
        where,
        select: taskCardSelect,
        orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.task.count({ where }),
    ]);

    return {
      items,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async create(userId: string, projectId: string, dto: CreateTaskDto): Promise<TaskCard> {
    const project = await this.workspaces.assertProjectMember(userId, projectId);
    if (dto.assigneeId) {
      await this.assertValidAssignee(dto.assigneeId, project.workspaceId);
    }

    const status = dto.status ?? TaskStatus.TODO;
    const task = await this.prisma.$transaction(async (tx) => {
      // Advisory lock ensures concurrent creates don't race on position computation.
      await tx.$executeRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${projectId}::text))`);
      const position = await this.nextPositionTx(tx, projectId, status);
      return tx.task.create({
        data: {
          projectId,
          title: dto.title.trim(),
          description: dto.description?.trim() || null,
          status,
          priority: dto.priority ?? TaskPriority.MEDIUM,
          dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
          assigneeId: dto.assigneeId ?? null,
          position,
          history: { create: { toStatus: status, changedById: userId } },
        },
        select: taskCardSelect,
      });
    });

    this.gateway.emitTaskEvent(projectId, 'task.created', task);
    return task;
  }

  async getDetails(userId: string, taskId: string) {
    const task = await this.taskWithAccess(userId, taskId);
    return this.prisma.task.findUniqueOrThrow({
      where: { id: task.id },
      select: {
        ...taskCardSelect,
        comments: {
          select: {
            id: true,
            content: true,
            createdAt: true,
            updatedAt: true,
            author: { select: { id: true, name: true, email: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
        history: {
          select: {
            id: true,
            fromStatus: true,
            toStatus: true,
            createdAt: true,
            changedBy: { select: { id: true, name: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
  }

  async update(userId: string, taskId: string, dto: UpdateTaskDto): Promise<TaskCard> {
    const existing = await this.taskWithAccess(userId, taskId);
    if (dto.assigneeId !== undefined) {
      if (dto.assigneeId === null) {
        // Unassign is allowed
      } else {
        await this.assertValidAssignee(dto.assigneeId, existing.project.workspaceId);
      }
    }

    const nextStatus = dto.status ?? existing.status;

    // If status is changing, use the same position mechanism as move().
    // MAX_SAFE_INTEGER is clamped by move() to orderedIds.length (end of column).
    if (nextStatus !== existing.status) {
      return this.move(userId, taskId, { status: nextStatus, position: Number.MAX_SAFE_INTEGER });
    }

    // For non-status changes, use simple update
    const task = await this.prisma.task.update({
      where: { id: taskId },
      data: {
        ...(dto.title !== undefined && { title: dto.title.trim() }),
        ...(dto.description !== undefined && {
          description: dto.description?.trim() || null,
        }),
        ...(dto.priority !== undefined && { priority: dto.priority }),
        ...(dto.dueDate !== undefined && {
          dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
        }),
        ...(dto.assigneeId !== undefined && { assigneeId: dto.assigneeId }),
      },
      select: taskCardSelect,
    });

    this.gateway.emitTaskEvent(existing.projectId, 'task.updated', task);
    return task;
  }

  /**
   * Moves a task to another column and/or index and resequences the affected
   * columns inside one transaction, so concurrent drags cannot corrupt the
   * ordering. Column sizes in this domain are small (hundreds), so rewriting
   * positions of a column is cheap and keeps the invariant trivially simple:
   * positions within (projectId, status) are always 0..n-1.
   *
   * Uses pg_advisory_xact_lock to serialize concurrent move() calls on the
   * same project, preventing duplicate positions and deadlocks. The advisory
   * lock is released automatically when the transaction commits or rolls back.
   */
  async move(userId: string, taskId: string, dto: MoveTaskDto): Promise<TaskCard> {
    const existing = await this.taskWithAccess(userId, taskId);

    const task = await this.prisma.$transaction(async (tx) => {
      // Serialize all move() operations within a project using an advisory lock.
      // hashtext() maps the UUID string to a stable int4 for pg_advisory_xact_lock.
      await tx.$executeRaw(
        Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${existing.projectId}::text))`
      );

      // Re-read the task inside the transaction so its current status reflects
      // any concurrent update that committed before we acquired the lock.
      const lockedTask = await tx.task.findUniqueOrThrow({
        where: { id: taskId },
        select: { id: true, status: true, position: true },
      });

      // Lock all tasks in the target column to prevent concurrent moves
      const targetSiblings = await tx.task.findMany({
        where: {
          projectId: existing.projectId,
          status: dto.status,
        },
        select: { id: true },
        orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
      });

      // Reconstruct the ordered list including the moved task
      const orderedIds = targetSiblings.filter((t) => t.id !== taskId).map((t) => t.id);
      const clampedIndex = Math.max(0, Math.min(dto.position, orderedIds.length));
      orderedIds.splice(clampedIndex, 0, taskId);

      // Write the new status and position for the moved task first.
      // resequence() only sets position, so without this the status never changes.
      await tx.task.update({
        where: { id: taskId },
        data: { status: dto.status, position: clampedIndex },
      });

      await this.resequence(tx, existing.projectId, dto.status, orderedIds);

      if (lockedTask.status !== dto.status) {
        await tx.taskStatusHistory.create({
          data: {
            taskId,
            fromStatus: lockedTask.status,
            toStatus: dto.status,
            changedById: userId,
          },
        });
        // Resequence the source column after the task left it
        const sourceSiblings = await tx.task.findMany({
          where: {
            projectId: existing.projectId,
            status: lockedTask.status,
          },
          select: { id: true },
          orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
        });
        await this.resequence(
          tx,
          existing.projectId,
          lockedTask.status,
          sourceSiblings.map((sibling) => sibling.id)
        );
      }

      return tx.task.findUniqueOrThrow({
        where: { id: taskId },
        select: taskCardSelect,
      });
    });

    this.gateway.emitTaskEvent(existing.projectId, 'task.updated', task);
    return task;
  }

  async remove(userId: string, taskId: string): Promise<void> {
    const task = await this.taskWithAccess(userId, taskId);
    await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw(
        Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${task.projectId}::text))`
      );
      await tx.task.delete({ where: { id: taskId } });
      const remaining = await tx.task.findMany({
        where: { projectId: task.projectId, status: task.status },
        select: { id: true },
        orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
      });
      await this.resequence(
        tx,
        task.projectId,
        task.status,
        remaining.map((sibling) => sibling.id)
      );
    });
    this.gateway.emitTaskEvent(task.projectId, 'task.deleted', { id: taskId });
  }

  async addComment(userId: string, taskId: string, dto: CreateCommentDto) {
    const task = await this.taskWithAccess(userId, taskId);
    const comment = await this.prisma.comment.create({
      data: { taskId, authorId: userId, content: dto.content.trim() },
      select: {
        id: true,
        content: true,
        createdAt: true,
        author: { select: { id: true, name: true, email: true } },
      },
    });
    this.gateway.emitCommentEvent(task.projectId, 'comment.created', {
      taskId,
      comment,
    });
    return comment;
  }

  async updateComment(userId: string, taskId: string, commentId: string, dto: UpdateCommentDto) {
    await this.taskWithAccess(userId, taskId);
    const comment = await this.commentInTaskOrThrow(taskId, commentId);
    this.assertCommentAuthor(comment.authorId, userId);

    return this.prisma.comment.update({
      where: { id: commentId },
      data: { content: dto.content.trim() },
      select: {
        id: true,
        content: true,
        updatedAt: true,
        author: { select: { id: true, name: true, email: true } },
      },
    });
  }

  async deleteComment(userId: string, taskId: string, commentId: string): Promise<void> {
    const task = await this.taskWithAccess(userId, taskId);
    const comment = await this.commentInTaskOrThrow(taskId, commentId);
    this.assertCommentAuthor(comment.authorId, userId);
    await this.prisma.comment.delete({ where: { id: commentId } });
    this.gateway.emitCommentEvent(task.projectId, 'comment.deleted', {
      taskId,
      commentId,
    });
  }

  /** Loads a task, verifies it exists and that the user is a workspace member. */
  private async taskWithAccess(userId: string, taskId: string) {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      select: {
        id: true,
        status: true,
        projectId: true,
        project: { select: { workspaceId: true } },
      },
    });
    if (!task) {
      throw new NotFoundException('Task not found');
    }
    await this.workspaces.assertMember(userId, task.project.workspaceId);
    return task;
  }

  private async nextPositionTx(
    tx: Prisma.TransactionClient | PrismaService,
    projectId: string,
    status: TaskStatus
  ) {
    const aggregate = await tx.task.aggregate({
      where: { projectId, status },
      _max: { position: true },
    });
    return (aggregate._max.position ?? -1) + 1;
  }

  private async resequence(
    tx: Prisma.TransactionClient,
    projectId: string,
    status: TaskStatus,
    orderedIds: string[]
  ): Promise<void> {
    if (orderedIds.length === 0) return;
    await Promise.all(
      orderedIds.map((id, index) => tx.task.update({ where: { id }, data: { position: index } }))
    );
    this.logger.debug(`Resequenced ${orderedIds.length} tasks in ${projectId}/${status}`);
  }

  private async assertValidAssignee(userId: string, workspaceId: string): Promise<void> {
    // A single membership check is sufficient: if the user is a member they
    // exist; if they are not a member they cannot be assigned regardless.
    const membership = await this.prisma.workspaceMember.findUnique({
      where: { userId_workspaceId: { userId, workspaceId } },
      select: { id: true },
    });
    if (!membership) {
      throw new BadRequestException('Assignee must be a workspace member');
    }
  }

  private async commentInTaskOrThrow(taskId: string, commentId: string) {
    const comment = await this.prisma.comment.findFirst({
      where: { id: commentId, taskId },
      select: { id: true, authorId: true },
    });
    if (!comment) {
      throw new NotFoundException('Comment not found');
    }
    return comment;
  }

  private assertCommentAuthor(authorId: string, userId: string): void {
    if (authorId !== userId) {
      throw new ForbiddenException('Only the author can modify this comment');
    }
  }
}
