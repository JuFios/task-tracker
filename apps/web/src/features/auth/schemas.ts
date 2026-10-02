import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().trim().min(1, 'Email is required').email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
});
export type LoginValues = z.infer<typeof loginSchema>;

// bcrypt only hashes the first 72 bytes of a password — align the limit.
const MAX_PASSWORD_BYTES = 72;
const passwordBytes = (value: string) => new TextEncoder().encode(value).length;

export const registerSchema = z.object({
  name: z.string().trim().min(2, 'At least 2 characters').max(80, 'At most 80 characters'),
  email: z.string().trim().min(1, 'Email is required').email('Enter a valid email'),
  password: z
    .string()
    .min(8, 'At least 8 characters')
    .refine(
      (value) => passwordBytes(value) <= MAX_PASSWORD_BYTES,
      `At most ${MAX_PASSWORD_BYTES} bytes (UTF-8)`,
    )
    .refine(
      (value) => /[A-Za-z]/.test(value) && /\d/.test(value),
      'Must contain at least one letter and one digit',
    ),
});
export type RegisterValues = z.infer<typeof registerSchema>;
