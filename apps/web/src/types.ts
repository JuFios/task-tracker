export type WorkspaceRole = 'OWNER' | 'MEMBER';

export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'DONE';

export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export interface SafeUser {
  id: string;
  email: string;
  name: string;
  createdAt: string;
}

export interface AuthResult {
  user: SafeUser;
  accessToken: string;
  refreshToken: string;
}

export interface PublicUser {
  id: string;
  name: string;
  email: string;
}

export interface WorkspaceMemberInfo {
  id: string;
  role: WorkspaceRole;
  createdAt?: string;
  user: PublicUser;
}

export interface WorkspacePreview {
  id: string;
  name: string;
  createdAt: string;
  members: Array<{ id: string; role: WorkspaceRole; user: PublicUser }>;
  _count: { members: number; projects: number };
  myRole: WorkspaceRole;
}

export interface ProjectPreview {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  workspaceId: string;
  _count: { tasks: number };
}

export interface TaskCard {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  position: number;
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
  projectId: string;
  assigneeId: string | null;
  assignee: PublicUser | null;
  _count: { comments: number };
}

export interface TaskComment {
  id: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  author: PublicUser;
}

export interface TaskHistoryEntry {
  id: string;
  fromStatus: TaskStatus | null;
  toStatus: TaskStatus;
  createdAt: string;
  changedBy: { id: string; name: string };
}

export interface TaskDetails extends TaskCard {
  comments: TaskComment[];
  history: TaskHistoryEntry[];
}

export interface Paginated<T> {
  items: T[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

export interface ApiErrorBody {
  statusCode: number;
  message: string | string[];
  error: string;
  path: string;
  timestamp: string;
}
