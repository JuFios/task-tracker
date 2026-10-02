import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '../../../components/ui/button';
import { Field } from '../../../components/ui/field';
import { Input } from '../../../components/ui/input';
import { errorMessage } from '../../../lib/api';
import { useAuthStore } from '../../../stores/auth';
import { AuthShell } from '../components/auth-shell';
import { register } from '../api';
import { registerSchema, type RegisterValues } from '../schemas';

export function RegisterPage() {
  const setAuth = useAuthStore((state) => state.setAuth);
  const navigate = useNavigate();

  const {
    register: registerField,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterValues>({ resolver: zodResolver(registerSchema) });

  const onSubmit = handleSubmit(async (values) => {
    try {
      const result = await register(values);
      setAuth(result);
      toast.success('Account created — welcome!');
      navigate('/workspaces', { replace: true });
    } catch (error) {
      toast.error(errorMessage(error, 'Could not create the account'));
    }
  });

  return (
    <AuthShell
      title="Create account"
      subtitle={
        <>
          Already registered?{' '}
          <Link to="/auth/login" className="font-medium text-indigo-600 hover:text-indigo-500">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <Field label="Name" htmlFor="name" error={errors.name?.message}>
          <Input
            id="name"
            autoComplete="name"
            placeholder="Jane Doe"
            invalid={Boolean(errors.name)}
            {...registerField('name')}
          />
        </Field>
        <Field label="Email" htmlFor="email" error={errors.email?.message}>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            invalid={Boolean(errors.email)}
            {...registerField('email')}
          />
        </Field>
        <Field
          label="Password"
          htmlFor="password"
          error={errors.password?.message}
          hint="At least 8 characters with a letter and a digit."
        >
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            placeholder="Create a password"
            invalid={Boolean(errors.password)}
            {...registerField('password')}
          />
        </Field>
        <Button type="submit" className="w-full" loading={isSubmitting}>
          Create account
        </Button>
      </form>
    </AuthShell>
  );
}
