import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { LogOut, UserPlus } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Avatar } from '../../../components/ui/avatar';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { ConfirmButton } from '../../../components/ui/confirm-button';
import { FullPageSpinner } from '../../../components/ui/spinner';

import { errorMessage } from '../../../lib/api';
import { formatDate } from '../../../lib/utils';
import type { WorkspaceRole } from '../../../types';
import { useAuthStore } from '../../../stores/auth';
import { workspacesApi } from '../api';
import { InviteMemberModal } from './invite-member-modal';

interface MembersPanelProps {
  workspaceId: string;
  myRole: WorkspaceRole;
}

export function MembersPanel({ workspaceId, myRole }: MembersPanelProps) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const currentUserId = useAuthStore((state) => state.user?.id);
  const [inviteOpen, setInviteOpen] = useState(false);
  const isOwner = myRole === 'OWNER';

  const { data: members, isLoading } = useQuery({
    queryKey: ['workspaces', workspaceId, 'members'],
    queryFn: () => workspacesApi.members(workspaceId),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['workspaces'] });



  const transferMutation = useMutation({
    mutationFn: (newOwnerId: string) =>
      workspacesApi.transferOwnership(workspaceId, newOwnerId),
    onSuccess: () => {
      toast.success('Ownership transferred');
      invalidate();
    },
    onError: (error) => toast.error(errorMessage(error, 'Could not transfer ownership')),
  });

  const removeMutation = useMutation({
    mutationFn: (memberId: string) => workspacesApi.removeMember(workspaceId, memberId),
    onSuccess: () => {
      toast.success('Member removed');
      invalidate();
    },
    onError: (error) => toast.error(errorMessage(error, 'Could not remove the member')),
  });

  const leaveMutation = useMutation({
    mutationFn: () => workspacesApi.leave(workspaceId),
    onSuccess: () => {
      toast.success('You left the workspace');
      void queryClient.invalidateQueries({ queryKey: ['workspaces'] });
      navigate('/workspaces');
    },
    onError: (error) => toast.error(errorMessage(error, 'Could not leave the workspace')),
  });

  if (isLoading) return <FullPageSpinner />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">
          {members?.length ?? 0} {members?.length === 1 ? 'member' : 'members'}
        </p>
        <div className="flex items-center gap-2">
          {/* Members (non-owners) can leave */}
          {!isOwner && (
            <ConfirmButton
              size="sm"
              variant="ghost"
              className="text-slate-600 hover:bg-slate-100"
              confirmLabel="Leave?"
              onClick={() => leaveMutation.mutate()}
            >
              <LogOut className="h-4 w-4" />
              Leave
            </ConfirmButton>
          )}
          {isOwner && (
            <Button size="sm" onClick={() => setInviteOpen(true)}>
              <UserPlus className="h-4 w-4" />
              Invite member
            </Button>
          )}
        </div>
      </div>

      <div className="overflow-hidden rounded-xl bg-white ring-1 ring-slate-200">
        <ul className="divide-y divide-slate-100">
          {members?.map((member) => {
            const isSelf = member.user.id === currentUserId;
            // Owner can manage only non-owner, non-self members
            const canManage = isOwner && member.role !== 'OWNER' && !isSelf;
            return (
              <li
                key={member.id}
                className="flex items-center gap-3 px-4 py-3"
              >
                <Avatar name={member.user.name} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium text-slate-900">
                      {member.user.name}
                    </span>
                    {isSelf && <Badge tone="indigo">You</Badge>}
                  </div>
                  <div className="truncate text-xs text-slate-500">{member.user.email}</div>
                </div>
                {member.createdAt && (
                  <span className="hidden text-xs text-slate-400 sm:block">
                    Joined {formatDate(member.createdAt)}
                  </span>
                )}
                {canManage ? (
                  <div className="flex items-center gap-2">
                    <Badge tone={member.role === 'OWNER' ? 'amber' : 'slate'}>
                      {member.role === 'OWNER' ? 'Owner' : 'Member'}
                    </Badge>
                    <ConfirmButton
                      size="sm"
                      variant="ghost"
                      className="text-indigo-600 hover:bg-indigo-50 hover:text-indigo-700"
                      confirmLabel="Transfer?"
                      onClick={() => transferMutation.mutate(member.user.id)}
                    >
                      Make owner
                    </ConfirmButton>
                    <ConfirmButton
                      size="sm"
                      variant="ghost"
                      className="text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                      confirmLabel="Remove?"
                      onClick={() => removeMutation.mutate(member.id)}
                    >
                      Remove
                    </ConfirmButton>
                  </div>
                ) : (
                  <Badge tone={member.role === 'OWNER' ? 'amber' : 'slate'}>
                    {member.role === 'OWNER' ? 'Owner' : 'Member'}
                  </Badge>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      <InviteMemberModal
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        workspaceId={workspaceId}
      />
    </div>
  );
}
