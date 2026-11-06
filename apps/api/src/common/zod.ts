import { HttpStatus } from '@nestjs/common';
import type { ZodSchema } from 'zod';
import { AppError } from './errors';

export function parse<T>(schema: ZodSchema<T>, body: unknown): T {
  const r = schema.safeParse(body);
  if (!r.success) throw new AppError('VALIDATION', HttpStatus.BAD_REQUEST, 'invalid input', { issues: r.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })) });
  return r.data;
}
