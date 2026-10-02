import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '../common/interfaces/auth-user.interface';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CreateProjectDto, UpdateProjectDto } from './dto';
import { ProjectsService } from './projects.service';

@ApiTags('projects')
@Controller()
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Get('workspaces/:workspaceId/projects')
  @ApiOperation({ summary: 'List projects of a workspace' })
  listForWorkspace(
    @CurrentUser() user: AuthUser,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string
  ) {
    return this.projectsService.listForWorkspace(user.id, workspaceId);
  }

  @Post('workspaces/:workspaceId/projects')
  @ApiOperation({ summary: 'Create a project in a workspace' })
  create(
    @CurrentUser() user: AuthUser,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Body() dto: CreateProjectDto
  ) {
    return this.projectsService.create(user.id, workspaceId, dto);
  }

  @Get('projects/:projectId')
  @ApiOperation({ summary: 'Get project details' })
  getById(@CurrentUser() user: AuthUser, @Param('projectId', ParseUUIDPipe) projectId: string) {
    return this.projectsService.getById(user.id, projectId);
  }

  @Patch('projects/:projectId')
  @ApiOperation({ summary: 'Update project name/description' })
  update(
    @CurrentUser() user: AuthUser,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() dto: UpdateProjectDto
  ) {
    return this.projectsService.update(user.id, projectId, dto);
  }

  @Delete('projects/:projectId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a project with all its tasks (owner only)' })
  async remove(
    @CurrentUser() user: AuthUser,
    @Param('projectId', ParseUUIDPipe) projectId: string
  ): Promise<void> {
    await this.projectsService.remove(user.id, projectId);
  }
}
