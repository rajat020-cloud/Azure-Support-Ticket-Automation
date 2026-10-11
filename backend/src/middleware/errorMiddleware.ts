import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

export interface MongoDuplicateError extends Error {
  code?: number;
  keyValue?: Record<string, unknown>;
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  // Handle malformed JSON body from express.json()
  if (err instanceof SyntaxError && 'status' in err && (err as { status?: number }).status === 400) {
    res.status(400).json({
      error: 'ValidationError',
      message: 'Malformed JSON request body.',
    });
    return;
  }

  // Handle Zod validation errors
  if (err instanceof ZodError) {
    const details = err.errors.map((issue) => ({
      field: issue.path.join('.'),
      message: issue.message,
    }));
    res.status(400).json({
      error: 'ValidationError',
      message: details[0]?.message || 'Invalid request input.',
      details,
    });
    return;
  }

  // Handle MongoDB duplicate key error (E11000)
  if (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as MongoDuplicateError).code === 11000
  ) {
    const dupErr = err as MongoDuplicateError;
    const isEmailDup =
      (dupErr.keyValue && 'email' in dupErr.keyValue) ||
      (typeof dupErr.message === 'string' && dupErr.message.includes('email'));
    res.status(409).json({
      error: 'ConflictError',
      message: isEmailDup
        ? 'An account with this email address already exists.'
        : 'A ticket with this ticketId already exists.',
    });
    return;
  }

  // Handle Mongoose validation error
  if (
    typeof err === 'object' &&
    err !== null &&
    'name' in err &&
    (err as { name: string }).name === 'ValidationError'
  ) {
    res.status(400).json({
      error: 'ValidationError',
      message: (err as Error).message,
    });
    return;
  }

  // Handle Mongoose / MongoDB connection errors safely without leaking credentials
  if (
    typeof err === 'object' &&
    err !== null &&
    'name' in err &&
    ['MongooseServerSelectionError', 'MongoNetworkError', 'MongoNotConnectedError'].includes(
      (err as { name: string }).name
    )
  ) {
    res.status(503).json({
      error: 'DatabaseUnavailable',
      message: 'Database service is currently unavailable. Please try again shortly.',
    });
    return;
  }

  res.status(500).json({
    error: 'InternalServerError',
    message: 'An unexpected internal error occurred.',
  });
}
