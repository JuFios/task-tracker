/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/prefer-promise-reject-errors */
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { execSync } from 'child_process';
import type { Server as HttpServer } from 'http';
import { io, type Socket } from 'socket.io-client';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

interface AuthResponse {
  user: { id: string; email: string; name: string };
  accessToken: string;
  refreshToken: string;
}

const unique = (prefix: string) =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

describe('Critical flow (e2e)', () => {
  let app: INestApplication;
  let httpServer: HttpServer;
  let prisma: PrismaService;
  let baseUrl: string;

  let owner: AuthResponse;
  let member: AuthResponse;
  let outsider: AuthResponse;
  let workspaceId: string;
  let projectId: string;
  let taskId: string;

  const as = (user: AuthResponse) => ({
    Authorization: `Bearer ${user.accessToken}`,
  });

  beforeAll(async () => {
    // Ensure the test database schema matches prisma/migrations.
    execSync('npx prisma migrate deploy', {
      cwd: process.cwd(),
      env: process.env,
      stdio: 'ignore',
    });

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
    await app.listen(0);
    httpServer = app.getHttpAdapter().getHttpServer() as HttpServer;
    const address = httpServer.address();
    const port = typeof address === 'object' && address ? address.port : 0;
    baseUrl = `http://127.0.0.1:${port}`;

    prisma = app.get(PrismaService);
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE "RefreshToken", "TaskStatusHistory", "Comment", "Task", "Project", "WorkspaceMember", "Workspace", "User" CASCADE'
    );
  });

  afterAll(async () => {
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE "RefreshToken", "TaskStatusHistory", "Comment", "Task", "Project", "WorkspaceMember", "Workspace", "User" CASCADE'
    );
    await app.close();
  });

  it('registers three users and protects private routes', async () => {
    const register = (email: string, name: string) =>
      request(baseUrl)
        .post('/api/auth/register')
        .send({ email, name, password: 'Password123' })
        .expect(201);

    owner = (await register(unique('owner') + '@example.com', 'Owner User')).body as AuthResponse;
    member = (await register(unique('member') + '@example.com', 'Member User'))
      .body as AuthResponse;
    outsider = (await register(unique('outsider') + '@example.com', 'Outsider User'))
      .body as AuthResponse;

    await request(baseUrl).get('/api/users/me').expect(401);
    await request(baseUrl).get('/api/workspaces').set(as(owner)).expect(200);
  });

  it('rejects invalid payloads with a consistent error shape', async () => {
    const response = await request(baseUrl)
      .post('/api/auth/register')
      .send({ email: 'not-an-email', name: 'X', password: 'short' })
      .expect(400);

    expect(response.body).toMatchObject({
      statusCode: 400,
      error: expect.any(String),
      message: expect.anything(),
      path: '/api/auth/register',
    });

    // Unknown fields are rejected (forbidNonWhitelisted)
    await request(baseUrl)
      .post('/api/auth/login')
      .send({
        email: owner.user.email,
        password: 'Password123',
        isAdmin: true,
      })
      .expect(400);
  });

  it('rejects wrong credentials', async () => {
    await request(baseUrl)
      .post('/api/auth/login')
      .send({ email: owner.user.email, password: 'WrongPassword1' })
      .expect(401);
  });

  it('creates a workspace and invites a member by email', async () => {
    const response = await request(baseUrl)
      .post('/api/workspaces')
      .set(as(owner))
      .send({ name: 'Acme Workspace' })
      .expect(201);

    workspaceId = response.body.id;
    expect(response.body.myRole).toBe('OWNER');

    const invite = await request(baseUrl)
      .post(`/api/workspaces/${workspaceId}/members`)
      .set(as(owner))
      .send({ email: member.user.email, role: 'MEMBER' })
      .expect(201);
    expect(invite.body.user.email).toBe(member.user.email);

    // Inviting an unknown email must fail with 404, not leak membership state.
    await request(baseUrl)
      .post(`/api/workspaces/${workspaceId}/members`)
      .set(as(owner))
      .send({ email: unique('ghost') + '@example.com' })
      .expect(404);

    // Member now sees the workspace.
    const memberList = await request(baseUrl).get('/api/workspaces').set(as(member)).expect(200);
    expect(
      (memberList.body as Array<{ id: string }>).some((workspace) => workspace.id === workspaceId)
    ).toBe(true);
  });

  it('lets the member create a project but blocks non-members', async () => {
    const response = await request(baseUrl)
      .post(`/api/workspaces/${workspaceId}/projects`)
      .set(as(member))
      .send({ name: 'Website Redesign', description: 'Q4 initiative' })
      .expect(201);
    projectId = response.body.id;

    await request(baseUrl)
      .post(`/api/workspaces/${workspaceId}/projects`)
      .set(as(outsider))
      .send({ name: 'Sneaky Project' })
      .expect(403);
  });

  it('supports the full task lifecycle with status history', async () => {
    const created = await request(baseUrl)
      .post(`/api/projects/${projectId}/tasks`)
      .set(as(owner))
      .send({
        title: 'Set up CI',
        priority: 'HIGH',
        assigneeId: member.user.id,
      })
      .expect(201);
    taskId = created.body.id;
    expect(created.body.status).toBe('TODO');
    expect(created.body.position).toBe(0);

    // Initial history entry exists (fromStatus = null).
    const details = await request(baseUrl).get(`/api/tasks/${taskId}`).set(as(member)).expect(200);
    expect(details.body.history).toHaveLength(1);
    expect(details.body.history[0].fromStatus).toBeNull();

    // Status change is logged with the actor.
    await request(baseUrl)
      .patch(`/api/tasks/${taskId}`)
      .set(as(member))
      .send({ status: 'IN_PROGRESS' })
      .expect(200);

    const afterMove = await request(baseUrl).get(`/api/tasks/${taskId}`).set(as(owner)).expect(200);
    expect(afterMove.body.history).toHaveLength(2);
    expect(afterMove.body.history[0]).toMatchObject({
      fromStatus: 'TODO',
      toStatus: 'IN_PROGRESS',
      changedBy: { id: member.user.id },
    });
  });

  it('applies filters and pagination to the task list', async () => {
    await request(baseUrl)
      .post(`/api/projects/${projectId}/tasks`)
      .set(as(owner))
      .send({ title: 'Second task', priority: 'LOW', status: 'DONE' })
      .expect(201);

    const filtered = await request(baseUrl)
      .get(`/api/projects/${projectId}/tasks?status=DONE&priority=LOW&limit=1&page=1`)
      .set(as(member))
      .expect(200);
    expect(filtered.body.items).toHaveLength(1);
    expect(filtered.body.items[0].title).toBe('Second task');
    expect(filtered.body.meta).toMatchObject({ total: 1, totalPages: 1 });

    const searched = await request(baseUrl)
      .get(`/api/projects/${projectId}/tasks?search=ci`)
      .set(as(member))
      .expect(200);
    expect((searched.body.items as Array<{ title: string }>).map((t) => t.title)).toContain(
      'Set up CI'
    );
  });

  it('reorders columns on move and keeps positions sequential', async () => {
    // Move "Set up CI" (IN_PROGRESS) to DONE at index 0 → before "Second task".
    await request(baseUrl)
      .patch(`/api/tasks/${taskId}/move`)
      .set(as(owner))
      .send({ status: 'DONE', position: 0 })
      .expect(200);

    const done = await request(baseUrl)
      .get(`/api/projects/${projectId}/tasks?status=DONE&limit=50`)
      .set(as(member))
      .expect(200);
    const positions = (done.body.items as Array<{ id: string; position: number }>).map(
      (task) => task.position
    );
    expect(positions).toEqual([0, 1]);
    expect((done.body.items as Array<{ id: string }>)[0].id).toBe(taskId);
  });

  it('enforces comment ownership rules', async () => {
    const comment = await request(baseUrl)
      .post(`/api/tasks/${taskId}/comments`)
      .set(as(member))
      .send({ content: 'Working on it' })
      .expect(201);

    // Owner cannot delete someone else's comment.
    await request(baseUrl)
      .delete(`/api/tasks/${taskId}/comments/${comment.body.id}`)
      .set(as(owner))
      .expect(403);

    await request(baseUrl)
      .delete(`/api/tasks/${taskId}/comments/${comment.body.id}`)
      .set(as(member))
      .expect(204);
  });

  it('keeps outsiders away from tasks they have no access to', async () => {
    await request(baseUrl).get(`/api/tasks/${taskId}`).set(as(outsider)).expect(403);
    await request(baseUrl)
      .patch(`/api/tasks/${taskId}`)
      .set(as(outsider))
      .send({ title: 'Hijacked' })
      .expect(403);
  });

  it('restricts project deletion to the workspace owner', async () => {
    await request(baseUrl).delete(`/api/projects/${projectId}`).set(as(member)).expect(403);
  });

  it('rotates refresh tokens and rejects reuse', async () => {
    const rotated = await request(baseUrl)
      .post('/api/auth/refresh')
      .send({ refreshToken: owner.refreshToken })
      .expect(200);
    expect(rotated.body.accessToken).toBeDefined();
    expect(rotated.body.refreshToken).not.toBe(owner.refreshToken);

    // The old refresh token was consumed — reuse must fail.
    await request(baseUrl)
      .post('/api/auth/refresh')
      .send({ refreshToken: owner.refreshToken })
      .expect(401);

    owner = rotated.body as AuthResponse;
  });

  it('broadcasts task events to project room members over WebSocket', async () => {
    const socket: Socket = io(baseUrl, {
      auth: { token: owner.accessToken },
      transports: ['websocket'],
    });
    await new Promise<void>((resolve, reject) => {
      const connectTimeout = setTimeout(() => reject(new Error('socket connect timeout')), 10_000);
      socket.on('connect', () => {
        clearTimeout(connectTimeout);
        resolve();
      });
      socket.on('connect_error', (error) => {
        clearTimeout(connectTimeout);
        reject(error);
      });
    });

    const joined = await new Promise<{ ok: boolean }>((resolve) =>
      socket.emit('project:join', projectId, resolve)
    );
    expect(joined.ok).toBe(true);

    const received = new Promise<Record<string, unknown>>((resolve) =>
      socket.once('task.created', resolve)
    );
    await request(baseUrl)
      .post(`/api/projects/${projectId}/tasks`)
      .set(as(member))
      .send({ title: 'Realtime task' })
      .expect(201);

    const event = await new Promise<Record<string, unknown>>((resolve, reject) => {
      const eventTimeout = setTimeout(() => reject(new Error('no socket event')), 10_000);
      received.then(
        (payload) => {
          clearTimeout(eventTimeout);
          resolve(payload);
        },
        (error: unknown) => {
          clearTimeout(eventTimeout);
          reject(error);
        }
      );
    });
    expect((event as { title?: string }).title ?? '').toContain('Realtime');

    // A socket without access cannot join the room.
    const stranger: Socket = io(baseUrl, {
      auth: { token: outsider.accessToken },
      transports: ['websocket'],
    });
    await new Promise<void>((resolve) => stranger.on('connect', () => resolve()));
    const denied = await new Promise<{ ok: boolean }>((resolve) =>
      stranger.emit('project:join', projectId, resolve)
    );
    expect(denied.ok).toBe(false);

    socket.disconnect();
    stranger.disconnect();
  });

  it('logs out by revoking refresh tokens', async () => {
    await request(baseUrl).post('/api/auth/logout').set(as(member)).expect(204);
    await request(baseUrl)
      .post('/api/auth/refresh')
      .send({ refreshToken: member.refreshToken })
      .expect(401);
  });
});
