import type { NextFunction, Request, Response } from 'express';
import * as permissionService from '../services/permission.service';

export async function getMatrix(_req: Request, res: Response, next: NextFunction) {
  try {
    const matrix = await permissionService.getPermissionsMatrix();
    res.status(200).json({ success: true, ...matrix });
  } catch (err) {
    next(err);
  }
}

export async function updateRole(req: Request, res: Response, next: NextFunction) {
  try {
    const matrix = await permissionService.updateRolePermissions(
      String(req.params.role),
      req.body,
    );
    res.status(200).json({
      success: true,
      message: 'Permisos actualizados correctamente.',
      ...matrix,
    });
  } catch (err) {
    next(err);
  }
}
