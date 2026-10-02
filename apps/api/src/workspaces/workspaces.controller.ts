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
import {
  CreateWorkspaceDto,
  InviteMemberDto,
  RenameWorkspaceDto,
  TransferOwnershipDto,
  UpdateMemberRoleDto,
} from './dto';
import { TasksGateway } from '../tasks/tasks.gateway';
import { WorkspacesService } from './workspaces.service';

@ApiTags('workspaces')
@Controller()
export class WorkspacesController {
  constructor(
    private readonly workspacesService: WorkspacesService,
    private readonly tasksGateway: TasksGateway
  ) {}

  @Get('workspaces')
  @ApiOperation({ summary: 'List workspaces the current user belongs to' })
  list(@CurrentUser() user: AuthUser) {
    return this.workspacesService.listForUser(user.id);
  }

  @Post('workspaces')
  @ApiOperation({ summary: 'Create a workspace (creator becomes owner)' })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateWorkspaceDto) {
    return this.workspacesService.create(user.id, dto);
  }

  @Get('workspaces/:workspaceId')
  @ApiOperation({ summary: 'Get workspace details (members only)' })
  getById(@CurrentUser() user: AuthUser, @Param('workspaceId', ParseUUIDPipe) workspaceId: string) {
    return this.workspacesService.getById(user.id, workspaceId);
  }

  @Patch('workspaces/:workspaceId')
  @ApiOperation({ summary: 'Rename workspace (owner only)' })
  rename(
    @CurrentUser() user: AuthUser,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Body() dto: RenameWorkspaceDto
  ) {
    return this.workspacesService.rename(user.id, workspaceId, dto);
  }

  @Delete('workspaces/:workspaceId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete workspace with all projects (owner only)' })
  async remove(
    @CurrentUser() user: AuthUser,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string
  ): Promise<void> {
    await this.workspacesService.remove(user.id, workspaceId);
  }

  @Get('workspaces/:workspaceId/members')
  @ApiOperation({ summary: 'List workspace members' })
  listMembers(
    @CurrentUser() user: AuthUser,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string
  ) {
    return this.workspacesService.listMembers(user.id, workspaceId);
  }

  @Post('workspaces/:workspaceId/members')
  @ApiOperation({ summary: 'Invite a registered user by email (owner only)' })
  invite(
    @CurrentUser() user: AuthUser,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Body() dto: InviteMemberDto
  ) {
    return this.workspacesService.inviteMember(user.id, workspaceId, dto);
  }

  @Patch('workspaces/:workspaceId/members/:memberId')
  @ApiOperation({ summary: 'Change a member role (owner only)' })
  updateMemberRole(
    @CurrentUser() user: AuthUser,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('memberId', ParseUUIDPipe) memberId: string,
    @Body() dto: UpdateMemberRoleDto
  ) {
    return this.workspacesService.updateMemberRole(user.id, workspaceId, memberId, dto);
  }

  @Delete('workspaces/:workspaceId/members/:memberId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove a member from the workspace (owner only)' })
  async removeMember(
    @CurrentUser() user: AuthUser,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('memberId', ParseUUIDPipe) memberId: string
  ): Promise<void> {
    const result = await this.workspacesService.removeMember(user.id, workspaceId, memberId);
    // Remove from socket rooms
    await this.tasksGateway.removeUserFromWorkspace(result.removedUserId, result.workspaceId);
  }

  @Post('workspaces/:workspaceId/transfer-ownership')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Transfer ownership to another member (owner only)' })
  async transferOwnership(
    @CurrentUser() user: AuthUser,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Body() dto: TransferOwnershipDto
  ): Promise<void> {
    await this.workspacesService.transferOwnership(user.id, workspaceId, dto.newOwnerId);
  }

  @Post('workspaces/:workspaceId/leave')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Leave the workspace (members only, not owners)' })
  async leaveWorkspace(
    @CurrentUser() user: AuthUser,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string
  ): Promise<void> {
    await this.workspacesService.leaveWorkspace(user.id, workspaceId);
    // Evict from socket rooms since they are no longer a member
    await this.tasksGateway.removeUserFromWorkspace(user.id, workspaceId);
  }
}
