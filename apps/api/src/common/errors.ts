import { HttpException, HttpStatus } from '@nestjs/common';

/** API errors carry a stable machine code that the web app translates. */
export class AppError extends HttpException {
  constructor(public code: string, status: HttpStatus = HttpStatus.BAD_REQUEST, message?: string, extra?: Record<string, unknown>) {
    super({ error: { code, message: message ?? code, ...extra } }, status);
  }
}

export const notFound = (what = 'NOT_FOUND') => new AppError(what, HttpStatus.NOT_FOUND);
export const forbidden = (code = 'FORBIDDEN') => new AppError(code, HttpStatus.FORBIDDEN);
export const conflict = (code: string) => new AppError(code, HttpStatus.CONFLICT);
