import type { NextFunction, Request, Response } from 'express';
import { env, REFRESH_COOKIE_NAME, REFRESH_TOKEN_MAX_AGE_MS } from '../config/env';
import * as authService from '../services/auth.service';

function setRefreshCookie(res: Response, token: string): void {
  res.cookie(REFRESH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: env.isProd,
    sameSite: env.isProd ? 'none' : 'lax',
    maxAge: REFRESH_TOKEN_MAX_AGE_MS,
    path: '/api/auth',
  });
}

function clearRefreshCookie(res: Response): void {
  res.clearCookie(REFRESH_COOKIE_NAME, {
    httpOnly: true,
    secure: env.isProd,
    sameSite: env.isProd ? 'none' : 'lax',
    path: '/api/auth',
  });
}

export async function register(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await authService.registerCustomer(req.body);
    res.status(201).json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

export async function verify(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await authService.verifyEmailToken(req.body.token);
    res.status(200).json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

export async function resendVerification(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const result = await authService.resendVerificationEmail(req.body.email);
    res.status(200).json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await authService.loginUser(req.body);
    setRefreshCookie(res, result.refreshToken);
    res.status(200).json({
      success: true,
      accessToken: result.accessToken,
      user: result.user,
      permissions: result.permissions,
    });
  } catch (err) {
    next(err);
  }
}

export async function refreshToken(req: Request, res: Response, next: NextFunction) {
  try {
    const rawCookie = req.cookies?.[REFRESH_COOKIE_NAME] as string | undefined;
    const result = await authService.rotateRefreshToken(rawCookie);
    setRefreshCookie(res, result.refreshToken);
    res.status(200).json({
      success: true,
      accessToken: result.accessToken,
      user: result.user,
      permissions: result.permissions,
    });
  } catch (err) {
    clearRefreshCookie(res);
    next(err);
  }
}

export async function logout(req: Request, res: Response, next: NextFunction) {
  try {
    const rawCookie = req.cookies?.[REFRESH_COOKIE_NAME] as string | undefined;
    await authService.logoutSession(rawCookie);
    clearRefreshCookie(res);
    res.status(200).json({ success: true, message: 'Sesión cerrada correctamente.' });
  } catch (err) {
    next(err);
  }
}

export async function invite(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await authService.inviteUser(req.body, req.user!.id);
    res.status(201).json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

export async function completeInvitation(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const result = await authService.completeInvitation(req.body);
    res.status(200).json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

export async function me(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await authService.getUserProfile(req.user!.id);
    res.status(200).json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

export async function updateMe(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await authService.updateUserProfile(req.user!.id, req.body);
    res.status(200).json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}
