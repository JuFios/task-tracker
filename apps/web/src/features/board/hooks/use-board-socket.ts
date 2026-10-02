import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { toast } from 'sonner';
import { getSocket } from '../../../lib/socket';

/**
 * Subscribes the board to live task/comment events. Any event simply
 * invalidates the board queries — TanStack Query serves the previous data
 * while refetching, so the UI stays stable without manual cache surgery.
 */
export function useBoardSocket(projectId: string): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    const socket = getSocket();

    const join = () => {
      socket.emit('project:join', projectId, (ack: { ok: boolean }) => {
        if (!ack?.ok) toast.error('Could not join the live board session');
      });
    };
    if (socket.connected) join();
    socket.on('connect', join);

    const invalidateBoard = () =>
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'tasks'] });
    const invalidateTask = ({ taskId }: { taskId: string }) =>
      queryClient.invalidateQueries({ queryKey: ['tasks', taskId] });

    socket.on('task.created', invalidateBoard);
    socket.on('task.updated', invalidateBoard);
    socket.on('task.deleted', invalidateBoard);
    socket.on('comment.created', invalidateTask);
    socket.on('comment.deleted', invalidateTask);

    return () => {
      socket.off('connect', join);
      socket.off('task.created', invalidateBoard);
      socket.off('task.updated', invalidateBoard);
      socket.off('task.deleted', invalidateBoard);
      socket.off('comment.created', invalidateTask);
      socket.off('comment.deleted', invalidateTask);
      socket.emit('project:leave', projectId);
    };
  }, [projectId, queryClient]);
}
