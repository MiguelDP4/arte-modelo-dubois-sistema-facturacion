import { describe, expect, it, vi } from 'vitest';
import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import {
  generateRandomToken,
  hashPassword,
  sha256,
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyPassword,
  verifyRefreshToken,
} from '../lib/crypto';
import { AppError, badRequest, conflict, forbidden, notFound, unauthorized } from '../lib/errors';
import { errorHandler } from '../middlewares/error.middleware';
import { clearMockOutbox, getMockOutbox, sendEmail } from '../services/email.service';

describe('API utility & middleware unit tests', () => {
  it('hashes passwords and signs/verifies access and refresh tokens', async () => {
    const hash = await hashPassword('Secret123');
    expect(await verifyPassword('Secret123', hash)).toBe(true);
    expect(await verifyPassword('Other123', hash)).toBe(false);

    const access = signAccessToken({
      sub: 'user-1',
      email: 'u@test.gt',
      role: 'ADMIN',
    });
    const decodedAccess = verifyAccessToken(access);
    expect(decodedAccess.sub).toBe('user-1');
    expect(decodedAccess.role).toBe('ADMIN');

    const { token: refresh } = signRefreshToken('user-1');
    const decodedRefresh = verifyRefreshToken(refresh);
    expect(decodedRefresh.sub).toBe('user-1');

    expect(() => verifyAccessToken(refresh)).toThrow();
    expect(() => verifyRefreshToken(access)).toThrow();

    const rand = generateRandomToken(16);
    expect(rand).toHaveLength(32);
    expect(sha256(rand)).toHaveLength(64);
  });

  it('builds consistent AppError helpers', () => {
    expect(unauthorized().statusCode).toBe(401);
    expect(forbidden().statusCode).toBe(403);
    expect(badRequest('Bad').statusCode).toBe(400);
    expect(notFound().statusCode).toBe(404);
    expect(conflict('Dup').statusCode).toBe(409);
  });

  it('handles AppError, ZodError and unknown errors in errorHandler', () => {
    const createRes = () => {
      const json = vi.fn();
      const status = vi.fn().mockReturnValue({ json });
      return { res: { status } as unknown as Response, status, json };
    };
    const req = {} as Request;
    const next = vi.fn() as NextFunction;

    const r1 = createRes();
    errorHandler(new AppError(422, 'Error negocio', 'BUSINESS', { a: 1 }), req, r1.res, next);
    expect(r1.status).toHaveBeenCalledWith(422);

    const r2 = createRes();
    errorHandler(
      new ZodError([{ code: 'custom', path: ['email'], message: 'Email malo' }]),
      req,
      r2.res,
      next,
    );
    expect(r2.status).toHaveBeenCalledWith(400);

    const r3 = createRes();
    errorHandler(new Error('Unexpected boom'), req, r3.res, next);
    expect(r3.status).toHaveBeenCalledWith(500);
  });

  it('records emails in mock outbox in test mode', async () => {
    clearMockOutbox();
    await sendEmail({
      to: 'test@artemodelo.gt',
      subject: 'Prueba',
      html: '<p>Hola</p>',
      text: 'Hola',
    });
    expect(getMockOutbox()).toHaveLength(1);
    expect(getMockOutbox()[0].subject).toBe('Prueba');
  });
});
