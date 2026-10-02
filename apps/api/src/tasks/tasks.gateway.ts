import { Logger } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import { Server, Socket } from "socket.io";
import { AppConfig } from "../config/configuration";
import { PrismaService } from "../prisma/prisma.service";

export interface TaskEventPayload {
  projectId: string;
  task: unknown;
}

/** Socket data with typed userId set on connection. */
interface SocketData {
  userId: string;
}

type TypedSocket = Socket<Record<string, never>, Record<string, never>, Record<string, never>, SocketData>;

const PROJECT_ROOM = (projectId: string) => `project:${projectId}`;

/**
 * Realtime channel for the Kanban board. Clients authenticate with their JWT
 * access token, then join per-project rooms; the server verifies workspace
 * membership on every join so rooms never leak across workspaces.
 *
 * Events: task.created / task.updated / task.deleted / comment.created,
 * all broadcast to `project:{id}` rooms.
 */
@WebSocketGateway({ cors: { origin: true, credentials: true } })
export class TasksGateway {
  @WebSocketServer()
  declare server: Server;

  private readonly logger = new Logger(TasksGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
    private readonly config: AppConfig,
  ) {}

  async handleConnection(client: TypedSocket): Promise<void> {
    try {
      const token =
        (client.handshake.auth?.token as string | undefined) ??
        client.handshake.headers.authorization?.replace("Bearer ", "");
      if (!token) {
        throw new Error("missing token");
      }
      const payload = await this.jwtService.verifyAsync<{ sub: string }>(
        token,
        { secret: this.config.jwtAccessSecret },
      );
      client.data.userId = payload.sub;
    } catch {
      client.disconnect(true);
    }
  }

  @SubscribeMessage("project:join")
  async joinProject(
    @ConnectedSocket() client: TypedSocket,
    @MessageBody() projectId: string,
  ): Promise<{ ok: boolean }> {
    const userId = client.data.userId;
    if (!userId || typeof projectId !== "string") {
      return { ok: false };
    }
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { workspaceId: true },
    });
    const membership = project
      ? await this.prisma.workspaceMember.findUnique({
          where: {
            userId_workspaceId: { userId, workspaceId: project.workspaceId },
          },
        })
      : null;
    if (!membership) {
      this.logger.warn(
        `User ${userId} tried to join ${projectId} without access`,
      );
      return { ok: false };
    }
    await client.join(PROJECT_ROOM(projectId));
    return { ok: true };
  }

  @SubscribeMessage("project:leave")
  async leaveProject(
    @ConnectedSocket() client: TypedSocket,
    @MessageBody() projectId: string,
  ): Promise<void> {
    await client.leave(PROJECT_ROOM(projectId));
  }

  emitTaskEvent(
    projectId: string,
    event: "task.created" | "task.updated" | "task.deleted",
    payload: unknown,
  ): void {
    this.server?.to(PROJECT_ROOM(projectId)).emit(event, payload);
  }

  emitCommentEvent(
    projectId: string,
    event: "comment.created" | "comment.deleted",
    payload: unknown,
  ): void {
    this.server?.to(PROJECT_ROOM(projectId)).emit(event, payload);
  }

  /**
   * Removes a user from all project rooms in a workspace.
   * Called when a member is removed from a workspace.
   */
  async removeUserFromWorkspace(userId: string, workspaceId: string): Promise<void> {
    const projects = await this.prisma.project.findMany({
      where: { workspaceId },
      select: { id: true },
    });

    for (const project of projects) {
      const room = PROJECT_ROOM(project.id);
      // Find all sockets for this user in the room
      const sockets = await this.server.in(room).fetchSockets();
      for (const socket of sockets) {
        const data = socket.data as SocketData;
        if (data.userId === userId) {
          /* eslint-disable-next-line @typescript-eslint/await-thenable */
          await socket.leave(room);
          this.logger.debug(`Removed user ${userId} from room ${room}`);
        }
      }
    }
  }
}
