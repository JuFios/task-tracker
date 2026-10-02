import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Prisma } from '@prisma/client';

interface ErrorBody {
  statusCode: number;
  message: string | string[];
  error: string;
  path: string;
  timestamp: string;
}

/**
 * Centralized error formatter: clients always receive a predictable shape,
 * unexpected 5xx errors are logged with a stack trace and never leak internals.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exception');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const { statusCode, message, error } = this.normalize(exception);

    if (statusCode >= 500) {
      this.logger.error(
        `${request.method} ${request.url} → ${statusCode}: ${
          exception instanceof Error ? exception.message : 'Unknown error'
        }`,
        exception instanceof Error ? exception.stack : undefined
      );
    } else if (statusCode >= 400) {
      // Log 4xx as warnings for security monitoring (failed auth, authorization failures, etc.)
      this.logger.warn(
        `${request.method} ${request.url} → ${statusCode}: ${
          typeof message === 'string' ? message : JSON.stringify(message)
        }`
      );
    }

    const body: ErrorBody = {
      statusCode,
      message,
      error,
      path: request.url,
      timestamp: new Date().toISOString(),
    };
    response.status(statusCode).json(body);
  }

  private normalize(exception: unknown): {
    statusCode: number;
    message: string | string[];
    error: string;
  } {
    // Handle Prisma errors
    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      return this.handlePrismaError(exception);
    }

    if (exception instanceof HttpException) {
      const statusCode = exception.getStatus();
      const response = exception.getResponse();
      if (typeof response === 'string') {
        return { statusCode, message: response, error: exception.name };
      }
      const body = response as { message?: string | string[]; error?: string };
      return {
        statusCode,
        message: body.message ?? exception.message,
        error: body.error ?? exception.name,
      };
    }

    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Internal server error',
      error: 'InternalServerError',
    };
  }

  private handlePrismaError(error: Prisma.PrismaClientKnownRequestError): {
    statusCode: number;
    message: string | string[];
    error: string;
  } {
    // P2025: Record not found
    if (error.code === 'P2025') {
      return {
        statusCode: HttpStatus.NOT_FOUND,
        message: 'Resource not found',
        error: 'NotFound',
      };
    }

    // P2002: Unique constraint violation
    if (error.code === 'P2002') {
      const fields = error.meta?.target as string[] | undefined;
      return {
        statusCode: HttpStatus.CONFLICT,
        message: `A record with this ${fields?.join(', ') || 'field'} already exists`,
        error: 'Conflict',
      };
    }

    // P2003: Foreign key constraint failed
    if (error.code === 'P2003') {
      return {
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'Invalid reference to related record',
        error: 'BadRequest',
      };
    }

    // P2024: Connection pool timeout
    if (error.code === 'P2024') {
      return {
        statusCode: HttpStatus.SERVICE_UNAVAILABLE,
        message: 'Database connection timeout',
        error: 'ServiceUnavailable',
      };
    }

    // Default Prisma error - treat as internal server error
    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Database error',
      error: 'InternalServerError',
    };
  }
}
