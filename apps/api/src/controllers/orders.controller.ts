import type { NextFunction, Request, Response } from 'express';
import * as excelService from '../services/excel.service';
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

export async function listConsignments(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const result = await orderService.listConsignmentsOverview(
      {
        search:
          typeof req.query.search === 'string' ? req.query.search : undefined,
        country:
          typeof req.query.country === 'string' ? req.query.country : undefined,
        status:
          typeof req.query.status === 'string' ? req.query.status : undefined,
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

export async function listPayments(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const result = await orderService.listOrderPayments(
      String(req.params.id),
      { page: req.query.page, pageSize: req.query.pageSize },
      req.user!,
    );
    res.status(200).json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

export async function addPayment(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const result = await orderService.registerPayment(
      String(req.params.id),
      req.body,
      req.user!,
    );
    res.status(201).json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

export async function voidPayment(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const result = await orderService.voidPayment(
      String(req.params.id),
      String(req.params.paymentId),
      req.body,
      req.user!,
    );
    res.status(200).json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

export async function addConsignmentReturn(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const result = await orderService.createConsignmentReturn(
      String(req.params.id),
      req.body,
      req.user!,
    );
    res.status(201).json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

export async function downloadExcel(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { buffer, fileName } = await excelService.generateOrderExcel(
      String(req.params.id),
      {
        type: typeof req.query.type === 'string' ? req.query.type : undefined,
        dispatchId:
          typeof req.query.dispatchId === 'string'
            ? req.query.dispatchId
            : undefined,
      },
      req.user!,
    );
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.status(200).send(buffer);
  } catch (err) {
    next(err);
  }
}
