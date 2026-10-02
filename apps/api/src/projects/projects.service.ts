import { Injectable } from '@nestjs/common';
import { WorkspaceRole, type Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { WorkspacesService } from '../workspaces/workspaces.service';
import { CreateProjectDto, UpdateProjectDto } from './dto';

const projectSelect = {
  id: true,
  name: true,
  description: true,
  createdAt: true,
  updatedAt: true,
  workspaceId: true,
  _count: { select: { tasks: true } },
} as const;

export type ProjectPreview = Prisma.ProjectGetPayload<{
  select: typeof projectSelect;
}>;

@Injectable()
export class ProjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workspaces: WorkspacesService,
  ) {}

  async listForWorkspace(userId: string, workspaceId: string) {
    await this.workspaces.assertMember(userId, workspaceId);
    return this.prisma.project.findMany({
      where: { workspaceId },
      select: projectSelect,
      orderBy: { createdAt: 'asc' },
    });
  }

  async create(userId: string, workspaceId: string, dto: CreateProjectDto) {
    await this.workspaces.assertMember(userId, workspaceId);
    return this.prisma.project.create({
      data: {
        workspaceId,
        name: dto.name.trim(),
        description: dto.description?.trim() || null,
      },
      select: projectSelect,
    });
  }

  async getById(userId: string, projectId: string) {
    await this.workspaces.assertProjectMember(userId, projectId);
    return this.prisma.project.findUniqueOrThrow({
      where: { id: projectId },
      select: projectSelect,
    });
  }

  async update(userId: string, projectId: string, dto: UpdateProjectDto) {
    const project = await this.workspaces.assertProjectMember(userId, projectId);
    await this.workspaces.assertRole(userId, project.workspaceId, WorkspaceRole.OWNER);
    return this.prisma.project.update({
      where: { id: projectId },
      data: {
        ...(dto.name !== undefined && { name: dto.name.trim() }),
        ...(dto.description !== undefined && {
          description: dto.description?.trim() || null,
        }),
      },
      select: projectSelect,
    });
  }

  async remove(userId: string, projectId: string): Promise<void> {
    const project = await this.workspaces.assertProjectMember(
      userId,
      projectId,
    );
    await this.workspaces.assertRole(userId, project.workspaceId, WorkspaceRole.OWNER);
    await this.prisma.project.delete({ where: { id: projectId } });
  }
}
