import type { NextFunction, Request, Response } from 'express';
import * as orderService from '../services/order.service';

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await orderService.listOrders(
      {
        search:
          typeof req.query.search === 'string' ? req.query.search : undefined,
        approvalStatus:
          typeof req.query.approvalStatus === 'string'
            ? req.query.approvalStatus
            : undefined,
        fulfillmentStatus:
          typeof req.query.fulfillmentStatus === 'string'
            ? req.query.fulfillmentStatus
            : undefined,
        paymentStatus:
          typeof req.query.paymentStatus === 'string'
            ? req.query.paymentStatus
            : undefined,
        type: typeof req.query.type === 'string' ? req.query.type : undefined,
        customerId:
          typeof req.query.customerId === 'string'
            ? req.query.customerId
            : undefined,
        page: req.query.page,
        pageSize: req.query.pageSize,
      },
      req.user!,
    );
    res.status(200).json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

export async function getLastPrice(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const result = await orderService.getLastPriceForCustomerProduct(
      {
        customerId:
          typeof req.query.customerId === 'string'
            ? req.query.customerId
            : undefined,
        productId:
          typeof req.query.productId === 'string'
            ? req.query.productId
            : undefined,
      },
      req.user!,
    );
    res.status(200).json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

export async function getById(req: Request, res: Response, next: NextFunction) {
  try {
    const order = await orderService.getOrderById(
      String(req.params.id),
      req.user!,
    );
    res.status(200).json({ success: true, order });
  } catch (err) {
    next(err);
  }
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await orderService.createOrder(req.body, req.user!);
    res.status(201).json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

export async function confirm(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await orderService.confirmOrder(
      String(req.params.id),
      req.body,
      req.user!,
    );
    res.status(200).json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await orderService.updateOrder(
      String(req.params.id),
      req.body,
      req.user!,
    );
    res.status(200).json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

export async function pack(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await orderService.packOrder(
      String(req.params.id),
      req.body,
      req.user!,
    );
    res.status(200).json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

export async function dispatch(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const result = await orderService.createDispatch(
      String(req.params.id),
      req.body,
      req.user!,
    );
    res.status(201).json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

export async function cancel(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await orderService.cancelOrder(
      String(req.params.id),
      req.body,
      req.user!,
    );
    res.status(200).json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}
