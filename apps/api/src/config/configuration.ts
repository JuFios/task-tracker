import type { StringValue } from 'ms';
import type { Env } from './env';

/**
 * Typed accessor over the validated environment so services never read
 * `process.env` directly and stay unit-testable.
 */
export class AppConfig {
  constructor(private readonly env: Env) {}

  get nodeEnv(): string {
    return this.env.NODE_ENV;
  }

  get port(): number {
    return this.env.PORT;
  }

  get databaseUrl(): string {
    return this.env.DATABASE_URL;
  }

  get jwtAccessSecret(): string {
    return this.env.JWT_ACCESS_SECRET;
  }

  get accessTokenTtl(): StringValue {
    return this.env.ACCESS_TOKEN_TTL as StringValue;
  }

  get refreshTokenTtlDays(): number {
    return this.env.REFRESH_TOKEN_TTL_DAYS;
  }

  get corsOrigins(): string[] {
    return this.env.CORS_ORIGINS;
  }

  get isProduction(): boolean {
    return this.env.NODE_ENV === 'production';
  }
}
