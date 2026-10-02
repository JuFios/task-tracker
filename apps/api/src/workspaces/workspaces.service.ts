import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { WorkspaceRole, type Prisma, type WorkspaceMember } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateWorkspaceDto,
  InviteMemberDto,
  RenameWorkspaceDto,
  UpdateMemberRoleDto,
} from './dto';

const workspacePreviewSelect = {
  id: true,
  name: true,
  createdAt: true,
  members: {
    select: {
      id: true,
      role: true,
      user: { select: { id: true, name: true, email: true } },
    },
  },
  _count: { select: { members: true, projects: true } },
} as const;

export type WorkspacePreview = Prisma.WorkspaceGetPayload<{
  select: typeof workspacePreviewSelect;
}>;

@Injectable()
export class WorkspacesService {
  private readonly logger = new Logger(WorkspacesService.name);

  constructor(private readonly prisma: PrismaService) {}

  async listForUser(userId: string) {
    const memberships = await this.prisma.workspaceMember.findMany({
      where: { userId },
      select: { role: true, workspace: { select: workspacePreviewSelect } },
      orderBy: { createdAt: 'asc' },
    });
    return memberships.map((membership) => ({
      ...membership.workspace,
      myRole: membership.role,
    }));
  }

  async create(userId: string, dto: CreateWorkspaceDto) {
    const workspace = await this.prisma.workspace.create({
      data: {
        name: dto.name.trim(),
        members: { create: { userId, role: WorkspaceRole.OWNER } },
      },
      select: workspacePreviewSelect,
    });
    this.logger.log(`User ${userId} created workspace ${workspace.id}`);
    return { ...workspace, myRole: WorkspaceRole.OWNER };
  }

  async getById(userId: string, workspaceId: string) {
    const membership = await this.assertMember(userId, workspaceId);
    const workspace = await this.prisma.workspace.findUniqueOrThrow({
      where: { id: workspaceId },
      select: workspacePreviewSelect,
    });
    return { ...workspace, myRole: membership.role };
  }

  async rename(userId: string, workspaceId: string, dto: RenameWorkspaceDto) {
    await this.assertRole(userId, workspaceId, WorkspaceRole.OWNER);
    return this.prisma.workspace.update({
      where: { id: workspaceId },
      data: { name: dto.name.trim() },
      select: { id: true, name: true },
    });
  }

  async remove(userId: string, workspaceId: string): Promise<void> {
    await this.assertRole(userId, workspaceId, WorkspaceRole.OWNER);
    await this.prisma.workspace.delete({ where: { id: workspaceId } });
  }

  async listMembers(userId: string, workspaceId: string) {
    await this.assertMember(userId, workspaceId);
    return this.prisma.workspaceMember.findMany({
      where: { workspaceId },
      select: {
        id: true,
        role: true,
        createdAt: true,
        user: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Invites an already registered user by email. A real product would send an
   * email invitation and create a pending membership — see README trade-offs.
   */
  async inviteMember(userId: string, workspaceId: string, dto: InviteMemberDto) {
    await this.assertRole(userId, workspaceId, WorkspaceRole.OWNER);

    const invitee = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase().trim() },
      select: { id: true },
    });
    if (!invitee) {
      throw new NotFoundException('No registered user with this email');
    }

    // Prevent creating multiple owners
    const requestedRole = dto.role ?? WorkspaceRole.MEMBER;
    if (requestedRole === WorkspaceRole.OWNER) {
      const existingOwner = await this.prisma.workspaceMember.findFirst({
        where: { workspaceId, role: WorkspaceRole.OWNER },
      });
      if (existingOwner) {
        throw new BadRequestException(
          'Workspace already has an owner. Use transfer ownership instead.'
        );
      }
    }

    try {
      const member = await this.prisma.workspaceMember.create({
        data: {
          workspaceId,
          userId: invitee.id,
          role: requestedRole,
        },
        select: {
          id: true,
          role: true,
          createdAt: true,
          user: { select: { id: true, name: true, email: true } },
        },
      });
      this.logger.log(
        `User ${userId} invited ${invitee.id} to workspace ${workspaceId} as ${requestedRole}`
      );
      return member;
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException('User is already a member');
      }
      throw error;
    }
  }

  async updateMemberRole(
    userId: string,
    workspaceId: string,
    memberId: string,
    dto: UpdateMemberRoleDto
  ) {
    const actor = await this.assertRole(userId, workspaceId, WorkspaceRole.OWNER);
    const member = await this.findMemberOrThrow(memberId, workspaceId);

    if (member.id === actor.id) {
      throw new BadRequestException('Use workspace transfer to change your own role');
    }
    if (member.role === WorkspaceRole.OWNER) {
      throw new BadRequestException('The owner role cannot be reassigned');
    }

    // Prevent creating multiple owners
    if (dto.role === WorkspaceRole.OWNER) {
      const existingOwner = await this.prisma.workspaceMember.findFirst({
        where: { workspaceId, role: WorkspaceRole.OWNER },
      });
      if (existingOwner && existingOwner.id !== memberId) {
        throw new BadRequestException(
          'Workspace already has an owner. Use transfer ownership instead.'
        );
      }
    }

    return this.prisma.workspaceMember.update({
      where: { id: memberId },
      data: { role: dto.role },
      select: {
        id: true,
        role: true,
        user: { select: { id: true, name: true, email: true } },
      },
    });
  }

  async removeMember(
    userId: string,
    workspaceId: string,
    memberId: string
  ): Promise<{ removedUserId: string; workspaceId: string }> {
    await this.assertRole(userId, workspaceId, WorkspaceRole.OWNER);
    const member = await this.findMemberOrThrow(memberId, workspaceId);
    if (member.role === WorkspaceRole.OWNER) {
      throw new BadRequestException('The owner cannot be removed. Delete the workspace instead.');
    }

    await this.prisma.$transaction(async (tx) => {
      // Remove from workspace
      await tx.workspaceMember.delete({ where: { id: memberId } });

      // Remove as assignee from all tasks in the workspace
      const projects = await tx.project.findMany({
        where: { workspaceId },
        select: { id: true },
      });
      const projectIds = projects.map((p) => p.id);
      if (projectIds.length > 0) {
        await tx.task.updateMany({
          where: {
            projectId: { in: projectIds },
            assigneeId: member.userId,
          },
          data: { assigneeId: null },
        });
      }
    });

    this.logger.log(`User ${userId} removed member ${memberId} from workspace ${workspaceId}`);
    return { removedUserId: member.userId, workspaceId };
  }

  /**
   * Transfers ownership from the current owner to another member.
   * The current owner becomes a regular member.
   * NOTE: newOwnerId is the target user's id (not WorkspaceMember.id).
   */
  async transferOwnership(userId: string, workspaceId: string, newOwnerId: string): Promise<void> {
    const actor = await this.assertRole(userId, workspaceId, WorkspaceRole.OWNER);

    if (newOwnerId === userId) {
      throw new BadRequestException('Cannot transfer ownership to yourself');
    }

    // Look up by userId (frontend sends user.id, not WorkspaceMember.id)
    const newOwner = await this.prisma.workspaceMember.findUnique({
      where: { userId_workspaceId: { userId: newOwnerId, workspaceId } },
    });
    if (!newOwner) {
      throw new NotFoundException('Member not found in this workspace');
    }

    await this.prisma.$transaction(async (tx) => {
      // Demote current owner to member
      await tx.workspaceMember.update({
        where: { id: actor.id },
        data: { role: WorkspaceRole.MEMBER },
      });

      // Promote new member to owner (use member record id, not userId)
      await tx.workspaceMember.update({
        where: { id: newOwner.id },
        data: { role: WorkspaceRole.OWNER },
      });
    });

    this.logger.log(
      `User ${userId} transferred ownership of workspace ${workspaceId} to user ${newOwnerId}`
    );
  }

  /**
   * Allows a member to leave the workspace.
   * Owners cannot leave - they must transfer ownership or delete the workspace.
   */
  async leaveWorkspace(userId: string, workspaceId: string): Promise<void> {
    const membership = await this.assertMember(userId, workspaceId);

    if (membership.role === WorkspaceRole.OWNER) {
      throw new BadRequestException(
        'Owners cannot leave. Transfer ownership or delete the workspace first.'
      );
    }

    await this.prisma.$transaction(async (tx) => {
      // Remove from workspace
      await tx.workspaceMember.delete({ where: { id: membership.id } });

      // Remove as assignee from all tasks in the workspace
      const projects = await tx.project.findMany({
        where: { workspaceId },
        select: { id: true },
      });
      const projectIds = projects.map((p) => p.id);
      if (projectIds.length > 0) {
        await tx.task.updateMany({
          where: {
            projectId: { in: projectIds },
            assigneeId: userId,
          },
          data: { assigneeId: null },
        });
      }
    });

    this.logger.log(`User ${userId} left workspace ${workspaceId}`);
  }

  /** Returns the membership if the user belongs to the workspace, else 403. */
  async assertMember(userId: string, workspaceId: string): Promise<WorkspaceMember> {
    const membership = await this.prisma.workspaceMember.findUnique({
      where: { userId_workspaceId: { userId, workspaceId } },
    });
    if (!membership) {
      throw new ForbiddenException('You are not a member of this workspace');
    }
    return membership;
  }

  async assertRole(
    userId: string,
    workspaceId: string,
    role: WorkspaceRole
  ): Promise<WorkspaceMember> {
    const membership = await this.assertMember(userId, workspaceId);
    if (membership.role !== role) {
      throw new ForbiddenException(`This action requires the ${role.toLowerCase()} role`);
    }
    return membership;
  }

  /** Resolves a project to its workspace id after a membership check. */
  async assertProjectMember(userId: string, projectId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, workspaceId: true },
    });
    if (!project) {
      throw new NotFoundException('Project not found');
    }
    await this.assertMember(userId, project.workspaceId);
    return project;
  }

  private async findMemberOrThrow(memberId: string, workspaceId: string) {
    const member = await this.prisma.workspaceMember.findFirst({
      where: { id: memberId, workspaceId },
    });
    if (!member) {
      throw new NotFoundException('Member not found in this workspace');
    }
    return member;
  }

  private isUniqueViolation(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: string }).code === 'P2002'
    );
  }
}
