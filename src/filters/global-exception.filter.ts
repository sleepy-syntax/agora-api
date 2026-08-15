import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import { ZodValidationException } from 'nestjs-zod';
import { ZodError } from 'zod';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
    catch(exception: unknown, host: ArgumentsHost): void {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse<FastifyReply>();

        const statusCode = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
        const message = exception instanceof HttpException ? exception.message : 'Internal server error';
        const zodError = exception instanceof ZodValidationException ? exception.getZodError() : undefined;
        const errors = zodError instanceof ZodError ? zodError.issues?.map(i => ({ path: i.path.join('.'), message: i.message })) : undefined;

        response.status(statusCode).send({ statusCode, message, errors });
    }
}
