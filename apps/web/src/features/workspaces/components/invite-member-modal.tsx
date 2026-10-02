import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { toast } from 'sonner';
import { Button } from '../../../components/ui/button';
import { Field } from '../../../components/ui/field';
import { Input } from '../../../components/ui/input';
import { Modal } from '../../../components/ui/modal';
import { errorMessage } from '../../../lib/api';
import { workspacesApi } from '../api';

const inviteEmailSchema = z.object({
  email: z.string().trim().min(1, 'Email is required').email('Enter a valid email'),
});
type InviteEmailValues = z.infer<typeof inviteEmailSchema>;

interface InviteMemberModalProps {
  open: boolean;
  onClose: () => void;
  workspaceId: string;
}

export function InviteMemberModal({ open, onClose, workspaceId }: InviteMemberModalProps) {
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<InviteEmailValues>({
    resolver: zodResolver(inviteEmailSchema),
  });

  const close = () => {
    reset();
    onClose();
  };

  const onSubmit = handleSubmit(async (values) => {
    try {
      // All invites are MEMBER — ownership is transferred separately via "Make owner"
      const member = await workspacesApi.invite(workspaceId, values.email, 'MEMBER');
      await queryClient.invalidateQueries({ queryKey: ['workspaces'] });
      toast.success(`${member.user.name} added to the workspace`);
      close();
    } catch (error) {
      toast.error(errorMessage(error, 'Could not invite the member'));
    }
  });

  return (
    <Modal open={open} onClose={close} title="Invite member">
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <Field
          label="Email"
          htmlFor="invite-email"
          error={errors.email?.message}
          hint="The person must already have an account."
        >
          <Input
            id="invite-email"
            type="email"
            placeholder="teammate@example.com"
            invalid={Boolean(errors.email)}
            {...register('email')}
          />
        </Field>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={close}>
            Cancel
          </Button>
          <Button type="submit" loading={isSubmitting}>
            Invite
          </Button>
        </div>
      </form>
    </Modal>
  );
}
