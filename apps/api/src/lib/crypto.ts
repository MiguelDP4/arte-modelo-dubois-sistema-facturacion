import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt, { type SignOptions } from 'jsonwebtoken';
import type { Role } from '@arte-modelo/shared';
import { env } from '../config/env';

const BCRYPT_ROUNDS = 10;

export interface AccessTokenPayload {
  sub: string;
  email: string;
  role: Role;
  type: 'access';
}

export interface RefreshTokenPayload {
  sub: string;
  jti: string;
  type: 'refresh';
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export function generateRandomToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString('hex');
}

export function sha256(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

export function signAccessToken(payload: {
  sub: string;
  email: string;
  role: Role;
}): string {
  const options: SignOptions = {
    expiresIn: env.jwtAccessExpiresIn as SignOptions['expiresIn'],
  };
  return jwt.sign({ ...payload, type: 'access' }, env.jwtAccessSecret, options);
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  const decoded = jwt.verify(token, env.jwtAccessSecret) as AccessTokenPayload;
  if (decoded.type !== 'access' || !decoded.sub) {
    throw new Error('INVALID_ACCESS_TOKEN');
  }
  return decoded;
}

export function signRefreshToken(userId: string): { token: string; jti: string } {
  const jti = generateRandomToken(16);
  const options: SignOptions = {
    expiresIn: env.jwtRefreshExpiresIn as SignOptions['expiresIn'],
  };
  const token = jwt.sign(
    { sub: userId, jti, type: 'refresh' },
    env.jwtRefreshSecret,
    options,
  );
  return { token, jti };
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  const decoded = jwt.verify(token, env.jwtRefreshSecret) as RefreshTokenPayload;
  if (decoded.type !== 'refresh' || !decoded.sub || !decoded.jti) {
    throw new Error('INVALID_REFRESH_TOKEN');
  }
  return decoded;
}
