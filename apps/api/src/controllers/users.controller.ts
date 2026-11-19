import type { NextFunction, Request, Response } from 'express';
import * as userService from '../services/user.service';

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const users = await userService.listUsers({
      search: typeof req.query.search === 'string' ? req.query.search : undefined,
      role: typeof req.query.role === 'string' ? req.query.role : undefined,
      status:
        req.query.status === 'active' ||
        req.query.status === 'inactive' ||
        req.query.status === 'pending' ||
        req.query.status === 'all'
          ? req.query.status
          : undefined,
    });
    res.status(200).json({ success: true, users });
  } catch (err) {
    next(err);
  }
}

export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await userService.updateUserById(
      String(req.params.id),
      req.user!.id,
      req.body,
    );
    res.status(200).json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

export async function resendInvitation(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const result = await userService.resendUserInvitation(String(req.params.id));
    res.status(200).json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

export async function remove(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await userService.deleteUserById(
      String(req.params.id),
      req.user!.id,
    );
    res.status(200).json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}
