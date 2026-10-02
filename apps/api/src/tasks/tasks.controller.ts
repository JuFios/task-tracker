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
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '../common/interfaces/auth-user.interface';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import {
  CreateCommentDto,
  CreateTaskDto,
  MoveTaskDto,
  QueryTasksDto,
  UpdateCommentDto,
  UpdateTaskDto,
} from './dto';
import { TasksService } from './tasks.service';

@ApiTags('tasks')
@Controller()
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Get('projects/:projectId/tasks')
  @ApiOperation({
    summary: 'List tasks of a project with filters and pagination',
  })
  list(
    @CurrentUser() user: AuthUser,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Query() query: QueryTasksDto
  ) {
    return this.tasksService.list(user.id, projectId, query);
  }

  @Post('projects/:projectId/tasks')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a task in a project' })
  create(
    @CurrentUser() user: AuthUser,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() dto: CreateTaskDto
  ) {
    return this.tasksService.create(user.id, projectId, dto);
  }

  @Get('tasks/:taskId')
  @ApiOperation({
    summary: 'Get task details with comments and status history',
  })
  getDetails(@CurrentUser() user: AuthUser, @Param('taskId', ParseUUIDPipe) taskId: string) {
    return this.tasksService.getDetails(user.id, taskId);
  }

  @Patch('tasks/:taskId')
  @ApiOperation({ summary: 'Update task fields (logs status changes)' })
  update(
    @CurrentUser() user: AuthUser,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Body() dto: UpdateTaskDto
  ) {
    return this.tasksService.update(user.id, taskId, dto);
  }

  @Patch('tasks/:taskId/move')
  @ApiOperation({
    summary: 'Move a task to a column/index (Kanban drag & drop)',
  })
  move(
    @CurrentUser() user: AuthUser,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Body() dto: MoveTaskDto
  ) {
    return this.tasksService.move(user.id, taskId, dto);
  }

  @Delete('tasks/:taskId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a task' })
  async remove(
    @CurrentUser() user: AuthUser,
    @Param('taskId', ParseUUIDPipe) taskId: string
  ): Promise<void> {
    await this.tasksService.remove(user.id, taskId);
  }

  @Post('tasks/:taskId/comments')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add a comment to a task' })
  addComment(
    @CurrentUser() user: AuthUser,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Body() dto: CreateCommentDto
  ) {
    return this.tasksService.addComment(user.id, taskId, dto);
  }

  @Patch('tasks/:taskId/comments/:commentId')
  @ApiOperation({ summary: 'Edit own comment' })
  updateComment(
    @CurrentUser() user: AuthUser,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Param('commentId', ParseUUIDPipe) commentId: string,
    @Body() dto: UpdateCommentDto
  ) {
    return this.tasksService.updateComment(user.id, taskId, commentId, dto);
  }

  @Delete('tasks/:taskId/comments/:commentId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete own comment' })
  async deleteComment(
    @CurrentUser() user: AuthUser,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Param('commentId', ParseUUIDPipe) commentId: string
  ): Promise<void> {
    await this.tasksService.deleteComment(user.id, taskId, commentId);
  }
}
