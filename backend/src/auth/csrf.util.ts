
import {
  ForbiddenException,
} from '@nestjs/common';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import type { Request, Response } from 'express';

export const CSRF_COOKIE_NAME = 'csrfToken';
export const CSRF_HEADER_NAME = 'x-csrf-token';

const COOKIE_OPTIONS = {
  httpOnly: false,
  secure: false, // Local development only; use true with HTTPS in production.
  sameSite: 'lax' as const,
  path: '/api/v1',
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

export function issueCsrfToken(response: Response): string {
  const token = randomBytes(32).toString('hex');

  response.cookie(CSRF_COOKIE_NAME, token, COOKIE_OPTIONS);

  return token;
}

export function clearCsrfToken(response: Response): void {
  response.clearCookie(CSRF_COOKIE_NAME, {
    httpOnly: false,
    secure: false,
    sameSite: 'lax',
    path: '/api/v1',
  });
}

export function validateRequestOrigin(request: Request): void {
  const expectedOrigin = process.env.FRONTEND_ORIGIN ?? 'http://localhost:5173';
  const origin = request.get('origin');

  if (origin !== expectedOrigin) {
    throw new ForbiddenException('Request origin is not allowed.');
  }
}

export function validateCsrfToken(request: Request): void {
  const cookieToken = request.cookies?.[CSRF_COOKIE_NAME];
  const headerToken = request.get(CSRF_HEADER_NAME);

  if (
    typeof cookieToken !== 'string' ||
    typeof headerToken !== 'string' ||
    cookieToken.length === 0 ||
    headerToken.length === 0
  ) {
    throw new ForbiddenException('Missing CSRF token.');
  }

  const cookieBuffer = Buffer.from(cookieToken);
  const headerBuffer = Buffer.from(headerToken);

  if (
    cookieBuffer.length !== headerBuffer.length ||
    !timingSafeEqual(cookieBuffer, headerBuffer)
  ) {
    throw new ForbiddenException('Invalid CSRF token.');
  }
}

export function getCsrfTokenFromRequest(request: Request): string | null {
  const token = request.cookies?.[CSRF_COOKIE_NAME];

  return typeof token === 'string' && token.length > 0
    ? token
    : null;
}
