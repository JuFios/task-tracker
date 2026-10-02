/**
 * e2e test environment defaults. Tests run against a dedicated database
 * (task_tracker_test by default); override DATABASE_URL to point elsewhere.
 *
 * IMPORTANT: Only set defaults if not already set via environment variables.
 * This prevents overproduction configuration and allows CI to set proper values.
 */
if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = 'test';
}
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL =
    'postgresql://task_tracker:task_tracker_dev_password@localhost:5433/task_tracker_test?schema=public';
}
if (!process.env.JWT_ACCESS_SECRET) {
  process.env.JWT_ACCESS_SECRET = 'e2e-access-secret-0123456789abcdef';
}
if (!process.env.ACCESS_TOKEN_TTL) {
  process.env.ACCESS_TOKEN_TTL = '15m';
}
if (!process.env.REFRESH_TOKEN_TTL_DAYS) {
  process.env.REFRESH_TOKEN_TTL_DAYS = '7';
}
if (!process.env.WEB_ORIGIN) {
  process.env.WEB_ORIGIN = 'http://localhost:5173';
}

// Safety check: prevent running tests on production database
if (
  process.env.DATABASE_URL?.includes('task_tracker_test') === false &&
  process.env.NODE_ENV === 'test'
) {
  throw new Error(
    'SAFETY: Tests require DATABASE_URL to contain "task_tracker_test" when NODE_ENV=test. ' +
      'This prevents accidental data loss on production databases.'
  );
}
