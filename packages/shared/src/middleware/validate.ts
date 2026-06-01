import type { NextFunction, Request, Response } from 'express';
import type { ZodSchema } from 'zod';

type Source = 'body' | 'query' | 'params';

export function validate<T>(schema: ZodSchema<T>, source: Source = 'body') {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      res.status(400).json({
        error: 'validation_error',
        issues: result.error.flatten(),
      });
      return;
    }
    // Replace the source with the parsed/coerced value so downstream handlers
    // get the typed result (default values applied, strings -> numbers, etc).
    (req as unknown as Record<Source, unknown>)[source] = result.data;
    next();
  };
}
