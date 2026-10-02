import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { Observable, tap } from 'rxjs';

const SLOW_REQUEST_THRESHOLD_MS = 500;

/**
 * Logs every HTTP request with its status code and duration. Requests slower
 * than {@link SLOW_REQUEST_THRESHOLD_MS} are flagged to make performance
 * regressions visible in the logs (bonus: lightweight response-time metrics).
 * 4xx errors are logged as warnings for security monitoring.
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<{
      method: string;
      url: string;
    }>();
    const response = context.switchToHttp().getResponse<{ statusCode: number }>();
    const start = performance.now();

    return next.handle().pipe(
      tap(() => {
        const duration = Math.round(performance.now() - start);
        const { method, url } = request;
        const { statusCode } = response;
        const suffix = duration > SLOW_REQUEST_THRESHOLD_MS ? ` ⚠ SLOW (${duration}ms)` : '';

        // Log 4xx as warnings for security monitoring
        if (statusCode >= 400 && statusCode < 500) {
          this.logger.warn(`${method} ${url} ${statusCode} ${duration}ms${suffix}`);
        } else {
          this.logger.log(`${method} ${url} ${statusCode} ${duration}ms${suffix}`);
        }
      })
    );
  }
}
