import type { NextFunction, Request, Response } from 'express';
import * as customerService from '../services/customer.service';

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await customerService.listCustomers({
      search:
        typeof req.query.search === 'string' ? req.query.search : undefined,
      country:
        typeof req.query.country === 'string' ? req.query.country : undefined,
      includeInactive: req.query.includeInactive === 'true',
      page: req.query.page,
      pageSize: req.query.pageSize,
    });
    res.status(200).json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

export async function listUnlinkedUsers(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const result = await customerService.listUnlinkedCustomerUsers({
      page: req.query.page,
      pageSize: req.query.pageSize,
    });
    res.status(200).json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

export async function getById(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await customerService.getCustomerById(String(req.params.id));
    res.status(200).json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await customerService.createCustomer(req.body);
    res.status(201).json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await customerService.updateCustomer(
      String(req.params.id),
      req.body,
    );
    res.status(200).json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

export async function archive(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await customerService.archiveCustomer(String(req.params.id));
    res.status(200).json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

export async function linkUser(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const result = await customerService.linkUserToCustomer(
      String(req.params.id),
      req.body.userId,
    );
    res.status(200).json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

export async function unlinkUser(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const result = await customerService.unlinkUserFromCustomer(
      String(req.params.id),
      String(req.params.userId),
    );
    res.status(200).json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}
