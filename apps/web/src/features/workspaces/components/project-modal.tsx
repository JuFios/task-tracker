import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { Button } from '../../../components/ui/button';
import { Field } from '../../../components/ui/field';
import { Input } from '../../../components/ui/input';
import { Modal } from '../../../components/ui/modal';
import { Textarea } from '../../../components/ui/textarea';
import { errorMessage } from '../../../lib/api';
import { projectsApi } from '../api';
import { projectSchema, type ProjectFormValues } from '../schemas';

interface ProjectModalProps {
  open: boolean;
  onClose: () => void;
  workspaceId: string;
  /** When set, the modal edits this project instead of creating one. */
  project?: { id: string; name: string; description: string | null };
}

export function ProjectModal({ open, onClose, workspaceId, project }: ProjectModalProps) {
  const queryClient = useQueryClient();
  const isEditing = Boolean(project);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ProjectFormValues>({
    resolver: zodResolver(projectSchema),
    values: {
      name: project?.name ?? '',
      description: project?.description ?? '',
    },
  });

  const close = () => {
    reset();
    onClose();
  };

  const onSubmit = handleSubmit(async (values) => {
    const payload = {
      name: values.name,
      ...(values.description?.trim() ? { description: values.description.trim() } : {}),
    };
    try {
      if (isEditing && project) {
        await projectsApi.update(project.id, payload);
        await queryClient.invalidateQueries({ queryKey: ['workspaces'] });
        toast.success('Project updated');
      } else {
        await projectsApi.create(workspaceId, payload);
        await queryClient.invalidateQueries({ queryKey: ['workspaces'] });
        toast.success('Project created');
      }
      close();
    } catch (error) {
      toast.error(
        errorMessage(
          error,
          isEditing ? 'Could not update the project' : 'Could not create the project'
        )
      );
    }
  });

  return (
    <Modal open={open} onClose={close} title={isEditing ? 'Edit project' : 'New project'}>
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <Field label="Name" htmlFor="project-name" error={errors.name?.message}>
          <Input
            id="project-name"
            placeholder="e.g. Website redesign"
            invalid={Boolean(errors.name)}
            {...register('name')}
          />
        </Field>
        <Field
          label="Description"
          htmlFor="project-description"
          error={errors.description?.message}
        >
          <Textarea
            id="project-description"
            rows={3}
            placeholder="What is this project about? (optional)"
            invalid={Boolean(errors.description)}
            {...register('description')}
          />
        </Field>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={close}>
            Cancel
          </Button>
          <Button type="submit" loading={isSubmitting}>
            {isEditing ? 'Save changes' : 'Create project'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
