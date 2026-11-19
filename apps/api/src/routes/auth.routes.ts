import { Router } from 'express';
import {
  completeInvitationSchema,
  inviteUserSchema,
  loginSchema,
  registerSchema,
  resendVerificationSchema,
  updateProfileSchema,
  verifyEmailSchema,
} from '@arte-modelo/shared';
import * as authController from '../controllers/auth.controller';
import { requireAuth, requirePermission } from '../middlewares/auth.middleware';
import { validateBody } from '../middlewares/validate.middleware';

export const authRouter = Router();

authRouter.post('/register', validateBody(registerSchema), authController.register);
authRouter.post('/verify', validateBody(verifyEmailSchema), authController.verify);
authRouter.post(
  '/resend-verification',
  validateBody(resendVerificationSchema),
  authController.resendVerification,
);
authRouter.post('/login', validateBody(loginSchema), authController.login);
authRouter.post('/refresh-token', authController.refreshToken);
authRouter.post('/logout', authController.logout);
authRouter.post(
  '/complete-invitation',
  validateBody(completeInvitationSchema),
  authController.completeInvitation,
);

authRouter.get('/me', requireAuth, authController.me);
authRouter.patch(
  '/me',
  requireAuth,
  validateBody(updateProfileSchema),
  authController.updateMe,
);
authRouter.post(
  '/invite',
  requireAuth,
  requirePermission('users.create'),
  validateBody(inviteUserSchema),
  authController.invite,
);
