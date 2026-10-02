import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { Button } from '../../../components/ui/button';
import { Field } from '../../../components/ui/field';
import { Input } from '../../../components/ui/input';
import { Modal } from '../../../components/ui/modal';
import { errorMessage } from '../../../lib/api';
import { workspacesApi } from '../api';
import { workspaceNameSchema, type WorkspaceNameValues } from '../schemas';

interface CreateWorkspaceModalProps {
  open: boolean;
  onClose: () => void;
}

export function CreateWorkspaceModal({ open, onClose }: CreateWorkspaceModalProps) {
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<WorkspaceNameValues>({ resolver: zodResolver(workspaceNameSchema) });

  const close = () => {
    reset();
    onClose();
  };

  const onSubmit = handleSubmit(async (values) => {
    try {
      await workspacesApi.create(values.name);
      await queryClient.invalidateQueries({ queryKey: ['workspaces'] });
      toast.success('Workspace created');
      close();
    } catch (error) {
      toast.error(errorMessage(error, 'Could not create the workspace'));
    }
  });

  return (
    <Modal open={open} onClose={close} title="New workspace">
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <Field
          label="Name"
          htmlFor="workspace-name"
          error={errors.name?.message}
          hint="You will be the owner of this workspace."
        >
          <Input
            id="workspace-name"
            placeholder="e.g. Acme Corp"
            invalid={Boolean(errors.name)}
            {...register('name')}
          />
        </Field>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={close}>
            Cancel
          </Button>
          <Button type="submit" loading={isSubmitting}>
            Create workspace
          </Button>
        </div>
      </form>
    </Modal>
  );
}
