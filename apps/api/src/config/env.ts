import { z } from 'zod';

/** Only used outside production so a fresh clone boots without configuration. */
const DEV_JWT_ACCESS_SECRET = 'dev-access-secret-change-me-0123456789abcdef';

const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  JWT_ACCESS_SECRET: z
    .string()
    .min(32, 'JWT_ACCESS_SECRET must be at least 32 characters')
    .optional(),
  ACCESS_TOKEN_TTL: z.string().default('15m'),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(7),
  WEB_ORIGIN: z.string().default('http://localhost:5173'),
});

export type Env = Omit<z.infer<typeof envSchema>, 'JWT_ACCESS_SECRET'> & {
  /** Always set after validation (dev default outside production). */
  JWT_ACCESS_SECRET: string;
  /** Comma-separated list of allowed browser origins (falls back to WEB_ORIGIN). */
  CORS_ORIGINS: string[];
};

export function validateEnv(config: Record<string, unknown>): Env {
  const parsed = envSchema.parse(config);

  const secret =
    parsed.JWT_ACCESS_SECRET && parsed.JWT_ACCESS_SECRET !== DEV_JWT_ACCESS_SECRET
      ? parsed.JWT_ACCESS_SECRET
      : undefined;
  if (!secret && parsed.NODE_ENV === 'production') {
    throw new Error(
      'JWT_ACCESS_SECRET must be set to a unique secret (>= 32 chars) when NODE_ENV=production',
    );
  }

  const rawOrigins = (config.CORS_ORIGINS as string | undefined) ?? parsed.WEB_ORIGIN;
  return {
    ...parsed,
    JWT_ACCESS_SECRET: secret ?? DEV_JWT_ACCESS_SECRET,
    CORS_ORIGINS: rawOrigins
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
  };
}
