import fs from 'node:fs';
import path from 'node:path';
import ExcelJS from 'exceljs';
import {
  APPROVAL_STATUS_LABELS,
  COUNTRY_LABELS,
  COUNTRY_TAX_LABEL,
  COUNTRIES,
  EXCEL_DOCUMENT_LABELS,
  FULFILLMENT_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
  formatCurrency,
  type ApprovalStatus,
  type CountryCode,
  type Currency,
  type ExcelDocumentType,
  type FulfillmentStatus,
  type PaymentStatus,
} from '@arte-modelo/shared';
import { prisma } from '../lib/prisma';
import { badRequest, forbidden, notFound } from '../lib/errors';
import type { AuthenticatedUser } from '../middlewares/auth.middleware';

function resolveLogoPath(): string | null {
  const candidates = [
    path.resolve(process.cwd(), '../web/public/logo-arte-modelo.png'),
    path.resolve(process.cwd(), 'apps/web/public/logo-arte-modelo.png'),
    path.resolve(__dirname, '../../../web/public/logo-arte-modelo.png'),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
}

function normalizeDocType(raw?: string): ExcelDocumentType {
  if (raw === 'consignment' || raw === 'delivery' || raw === 'invoice') {
    return raw;
  }
  if (raw) {
    throw badRequest(
      'Tipo de documento Excel inválido. Usa invoice, consignment o delivery.',
    );
  }
  return 'invoice';
}

const BRAND_NAVY = 'FF06005C';
const BRAND_SUB = 'FF110B51';
const SURFACE_CREAM = 'FFFFF1DE';
const SURFACE_ALT = 'FFFDFAF6';
const BORDER_COLOR = 'FFC7B8A5';

function applyThinBorder(cell: ExcelJS.Cell) {
  cell.border = {
    top: { style: 'thin', color: { argb: BORDER_COLOR } },
    left: { style: 'thin', color: { argb: BORDER_COLOR } },
    bottom: { style: 'thin', color: { argb: BORDER_COLOR } },
    right: { style: 'thin', color: { argb: BORDER_COLOR } },
  };
}

export async function generateOrderExcel(
  orderId: string,
  options: { type?: string; dispatchId?: string },
  actor: AuthenticatedUser,
): Promise<{ buffer: Buffer; fileName: string }> {
  const docType = normalizeDocType(options.type);

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      customer: true,
      items: {
        orderBy: [{ createdAt: 'asc' }, { productName: 'asc' }],
      },
      dispatches: {
        orderBy: [{ dispatchNumber: 'asc' }],
        include: {
          dispatchedBy: { select: { fullName: true } },
          items: true,
        },
      },
      consignmentReturns: {
        orderBy: [{ returnNumber: 'asc' }],
        include: {
          receivedBy: { select: { fullName: true } },
          items: true,
        },
      },
    },
  });

  if (!order) {
    throw notFound('Pedido no encontrado.');
  }

  if (actor.role === 'CUSTOMER') {
    if (!actor.customerId || order.customerId !== actor.customerId) {
      throw forbidden('No tienes permiso para descargar documentos de este pedido.');
    }
  }

  if (docType === 'consignment' && order.type !== 'CONSIGNMENT') {
    throw badRequest(
      'El recibo de consignación solo aplica para pedidos de tipo Consignación.',
    );
  }

  const hidePrices =
    actor.role === 'CUSTOMER' &&
    (order.approvalStatus as ApprovalStatus) === 'PENDING_CONFIRMATION';
  const currency = order.currency as Currency;
  const country = (
    (COUNTRIES as readonly string[]).includes(order.customer.country)
      ? order.customer.country
      : 'OTHER'
  ) as CountryCode;
  const taxLabel = COUNTRY_TAX_LABEL[country];
  const countryLabel = COUNTRY_LABELS[country];

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Arte Modelo Dubois 2.0';
  workbook.created = new Date();

  const sheetTitle =
    docType === 'consignment'
      ? 'Recibo Consignación'
      : docType === 'delivery'
        ? 'Nota de Entrega'
        : 'Factura Pedido';

  const sheet = workbook.addWorksheet(sheetTitle, {
    views: [{ showGridLines: true }],
  });

  // Reservar espacio superior izquierdo para logo (A1:B4)
  sheet.getColumn(1).width = 16;
  sheet.getColumn(2).width = 18;
  sheet.getColumn(3).width = 34;
  sheet.getColumn(4).width = 16;
  sheet.getColumn(5).width = 18;
  sheet.getColumn(6).width = 18;
  sheet.getColumn(7).width = 18;
  sheet.getColumn(8).width = 18;

  for (let r = 1; r <= 4; r += 1) {
    sheet.getRow(r).height = 22;
  }

  const logoPath = resolveLogoPath();
  if (logoPath) {
    const logoBuffer = fs.readFileSync(logoPath);
    const imageId = workbook.addImage({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      buffer: logoBuffer as any,
      extension: 'png',
    });
    sheet.addImage(imageId, {
      tl: { col: 0.15, row: 0.15 },
      ext: { width: 88, height: 80 },
    });
  }

  sheet.mergeCells('C1:H1');
  const brandCell = sheet.getCell('C1');
  brandCell.value = 'Arte Modelo Dubois';
  brandCell.font = {
    name: 'Arial',
    size: 16,
    bold: true,
    color: { argb: 'FFFFFFFF' },
  };
  brandCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: BRAND_NAVY },
  };
  brandCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };

  sheet.mergeCells('C2:H2');
  const subtitleCell = sheet.getCell('C2');
  subtitleCell.value = EXCEL_DOCUMENT_LABELS[docType].toUpperCase();
  subtitleCell.font = {
    name: 'Arial',
    size: 12,
    bold: true,
    color: { argb: 'FFFFFFFF' },
  };
  subtitleCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: BRAND_SUB },
  };
  subtitleCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };

  sheet.mergeCells('C3:H3');
  const metaTopCell = sheet.getCell('C3');
  metaTopCell.value = `Pedido: ${order.orderNumber}   |   Fecha: ${order.createdAt.toLocaleDateString('es-GT')}   |   Moneda: ${currency}`;
  metaTopCell.font = { name: 'Arial', size: 10, bold: true };
  metaTopCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: SURFACE_CREAM },
  };
  metaTopCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };

  sheet.mergeCells('C4:H4');
  const metaStatusCell = sheet.getCell('C4');
  metaStatusCell.value = `Aprobación: ${
    APPROVAL_STATUS_LABELS[order.approvalStatus as ApprovalStatus] ?? order.approvalStatus
  }   |   Entrega: ${
    FULFILLMENT_STATUS_LABELS[order.fulfillmentStatus as FulfillmentStatus] ??
    order.fulfillmentStatus
  }   |   Pago: ${
    PAYMENT_STATUS_LABELS[order.paymentStatus as PaymentStatus] ?? order.paymentStatus
  }`;
  metaStatusCell.font = { name: 'Arial', size: 10 };
  metaStatusCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: SURFACE_ALT },
  };
  metaStatusCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };

  // Datos del cliente (filas 6-8)
  sheet.addRow([]);
  const custRows: Array<[string, string, string, string]> = [
    ['Cliente:', order.customer.companyName, 'Encargado:', order.customer.managerName],
    [
      'País:',
      countryLabel,
      `${taxLabel}:`,
      order.customer.taxId,
    ],
    ['Teléfono:', order.customer.phone, 'Dirección:', order.customer.address],
  ];
  if (docType === 'consignment' && order.consignmentDueDate) {
    custRows.push([
      'Tipo:',
      'Consignación',
      'Fecha revisión:',
      order.consignmentDueDate.toLocaleDateString('es-GT'),
    ]);
  }

  for (const [k1, v1, k2, v2] of custRows) {
    const row = sheet.addRow([k1, v1, '', k2, v2]);
    sheet.mergeCells(row.number, 2, row.number, 3);
    sheet.mergeCells(row.number, 5, row.number, 8);
    row.getCell(1).font = { name: 'Arial', size: 10, bold: true };
    row.getCell(4).font = { name: 'Arial', size: 10, bold: true };
    row.getCell(2).font = { name: 'Arial', size: 10 };
    row.getCell(5).font = { name: 'Arial', size: 10 };
  }

  let selectedDispatch =
    options.dispatchId
      ? order.dispatches.find((d) => d.id === options.dispatchId) ?? null
      : order.dispatches[order.dispatches.length - 1] ?? null;

  if (options.dispatchId && !selectedDispatch) {
    throw notFound('Evento de despacho no encontrado para este pedido.');
  }

  if (docType === 'delivery' && selectedDispatch) {
    const dispBanner = sheet.addRow([
      'Despacho #:',
      String(selectedDispatch.dispatchNumber),
      '',
      'Transporte:',
      selectedDispatch.carrier || 'No especificado',
      '',
      'Fecha:',
      selectedDispatch.dispatchedAt.toLocaleDateString('es-GT'),
    ]);
    sheet.mergeCells(dispBanner.number, 2, dispBanner.number, 3);
    sheet.mergeCells(dispBanner.number, 5, dispBanner.number, 6);
    dispBanner.getCell(1).font = { name: 'Arial', size: 10, bold: true };
    dispBanner.getCell(4).font = { name: 'Arial', size: 10, bold: true };
    dispBanner.getCell(7).font = { name: 'Arial', size: 10, bold: true };
  }

  sheet.addRow([]);

  // Encabezado de tabla principal
  if (docType === 'delivery') {
    const headers = [
      'Código',
      'Producto',
      '',
      'Pedido',
      'Entregado en este despacho',
      'Acumulado entregado',
      'Devuelto',
      'Pendiente por entregar',
    ];
    const headerRow = sheet.addRow(headers);
    sheet.mergeCells(headerRow.number, 2, headerRow.number, 3);
    headerRow.height = 24;
    headerRow.eachCell((cell) => {
      cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: BRAND_NAVY },
      };
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      applyThinBorder(cell);
    });

    const dispatchQtyMap = new Map<string, number>();
    if (selectedDispatch) {
      for (const di of selectedDispatch.items) {
        dispatchQtyMap.set(di.orderItemId, di.quantityDispatched);
      }
    }

    for (const item of order.items) {
      const pendingQty = Math.max(0, item.quantityOrdered - item.quantityDispatched);
      const thisDispatchQty = selectedDispatch
        ? (dispatchQtyMap.get(item.id) ?? 0)
        : 0;
      const r = sheet.addRow([
        item.productPrimaryCode,
        item.productName,
        '',
        item.quantityOrdered,
        thisDispatchQty,
        item.quantityDispatched,
        item.quantityReturned,
        pendingQty,
      ]);
      sheet.mergeCells(r.number, 2, r.number, 3);
      for (let c = 1; c <= 8; c += 1) {
        const cell = r.getCell(c);
        cell.font = { name: 'Arial', size: 10 };
        cell.alignment = {
          vertical: 'middle',
          horizontal: c <= 3 ? 'left' : 'right',
        };
        applyThinBorder(cell);
      }
    }

    if (order.dispatches.length > 0) {
      sheet.addRow([]);
      const logTitle = sheet.addRow(['Historial Cronológico de Entregas']);
      sheet.mergeCells(logTitle.number, 1, logTitle.number, 8);
      logTitle.getCell(1).font = { name: 'Arial', size: 11, bold: true };
      for (const d of order.dispatches) {
        const lineSummary = d.items
          .map((di) => {
            const match = order.items.find((i) => i.id === di.orderItemId);
            return `${match?.productName ?? 'Ítem'}: ${di.quantityDispatched} (pendiente ${di.remainingPending})`;
          })
          .join(' | ');
        const logRow = sheet.addRow([
          `Despacho #${d.dispatchNumber}`,
          d.dispatchedAt.toLocaleDateString('es-GT'),
          d.carrier || 'Sin transporte',
          lineSummary,
        ]);
        sheet.mergeCells(logRow.number, 4, logRow.number, 8);
        for (let c = 1; c <= 8; c += 1) {
          applyThinBorder(logRow.getCell(c));
        }
      }
    }
  } else if (docType === 'consignment') {
    const headers = [
      'Código',
      'Producto',
      'Pedido',
      'Entregado',
      'Devuelto',
      'Neto tienda',
      'Precio unit.',
      'Subtotal neto',
    ];
    const headerRow = sheet.addRow(headers);
    headerRow.height = 24;
    headerRow.eachCell((cell) => {
      cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: BRAND_NAVY },
      };
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      applyThinBorder(cell);
    });

    for (const item of order.items) {
      const netQty = Math.max(0, item.quantityDispatched - item.quantityReturned);
      const netUnit =
        item.quantityOrdered > 0 ? item.lineTotal / item.quantityOrdered : item.unitPrice;
      const netAmount = netQty * netUnit;
      const r = sheet.addRow([
        item.productPrimaryCode,
        item.productName,
        item.quantityOrdered,
        item.quantityDispatched,
        item.quantityReturned,
        netQty,
        hidePrices ? 'Por confirmar' : formatCurrency(item.unitPrice, currency),
        hidePrices ? 'Por confirmar' : formatCurrency(netAmount, currency),
      ]);
      for (let c = 1; c <= 8; c += 1) {
        const cell = r.getCell(c);
        cell.font = { name: 'Arial', size: 10 };
        cell.alignment = {
          vertical: 'middle',
          horizontal: c <= 2 ? 'left' : 'right',
        };
        applyThinBorder(cell);
      }
    }
  } else {
    const headers = [
      'Código',
      'Producto',
      '',
      'Cantidad',
      'Precio unit.',
      'Descuento',
      'Subtotal ítem',
      'Entregado / Pend.',
    ];
    const headerRow = sheet.addRow(headers);
    sheet.mergeCells(headerRow.number, 2, headerRow.number, 3);
    headerRow.height = 24;
    headerRow.eachCell((cell) => {
      cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: BRAND_NAVY },
      };
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      applyThinBorder(cell);
    });

    for (const item of order.items) {
      const pendingQty = Math.max(0, item.quantityOrdered - item.quantityDispatched);
      const r = sheet.addRow([
        item.productPrimaryCode,
        item.productName,
        '',
        item.quantityOrdered,
        hidePrices ? 'Por confirmar' : formatCurrency(item.unitPrice, currency),
        hidePrices ? '-' : formatCurrency(item.discountAmount, currency),
        hidePrices ? 'Por confirmar' : formatCurrency(item.lineTotal, currency),
        `${item.quantityDispatched} / ${pendingQty}`,
      ]);
      sheet.mergeCells(r.number, 2, r.number, 3);
      for (let c = 1; c <= 8; c += 1) {
        const cell = r.getCell(c);
        cell.font = { name: 'Arial', size: 10 };
        cell.alignment = {
          vertical: 'middle',
          horizontal: c <= 3 ? 'left' : 'right',
        };
        applyThinBorder(cell);
      }
    }
  }

  // Totales financieros para Factura y Recibo de Consignación
  if (docType !== 'delivery') {
    sheet.addRow([]);
    const totalEntries: Array<[string, string, boolean]> = hidePrices
      ? [['Estado de montos:', 'Pendiente de confirmación por Arte Modelo Dubois', true]]
      : [
          ['Subtotal bruto', formatCurrency(order.subtotal, currency), false],
          ['Descuentos en ítems', `- ${formatCurrency(order.itemsDiscountTotal, currency)}`, false],
          ['Flete neto', formatCurrency(Math.max(0, order.shippingCost - order.shippingDiscount), currency), false],
          ...(order.returnedTotal > 0
            ? [
                [
                  'Devoluciones de consignación',
                  `- ${formatCurrency(order.returnedTotal, currency)}`,
                  false,
                ] as [string, string, boolean],
              ]
            : []),
          ['TOTAL DEL PEDIDO', formatCurrency(order.totalAmount, currency), true],
          ['Abonado', formatCurrency(order.amountPaid, currency), false],
          ['SALDO PENDIENTE', formatCurrency(order.amountPending, currency), true],
        ];

    for (const [label, value, highlight] of totalEntries) {
      const tr = sheet.addRow(['', '', '', '', '', label, '', value]);
      sheet.mergeCells(tr.number, 6, tr.number, 7);
      const lblCell = tr.getCell(6);
      const valCell = tr.getCell(8);
      lblCell.font = { name: 'Arial', size: 10, bold: highlight };
      valCell.font = { name: 'Arial', size: 10, bold: highlight };
      lblCell.alignment = { horizontal: 'right', vertical: 'middle' };
      valCell.alignment = { horizontal: 'right', vertical: 'middle' };
      if (highlight) {
        lblCell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: SURFACE_CREAM },
        };
        valCell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: SURFACE_CREAM },
        };
      }
      applyThinBorder(lblCell);
      applyThinBorder(tr.getCell(7));
      applyThinBorder(valCell);
    }
  }

  if (docType === 'consignment') {
    sheet.addRow([]);
    sheet.addRow([]);
    const sigRow = sheet.addRow([
      'Entrega (Arte Modelo Dubois): ________________________',
      '',
      '',
      '',
      'Recibe en Consignación (Cliente): ________________________',
    ]);
    sheet.mergeCells(sigRow.number, 1, sigRow.number, 3);
    sheet.mergeCells(sigRow.number, 5, sigRow.number, 8);
  }

  const rawBuffer = await workbook.xlsx.writeBuffer();
  const buffer = Buffer.isBuffer(rawBuffer)
    ? rawBuffer
    : Buffer.from(rawBuffer as ArrayBuffer);

  const prefix =
    docType === 'consignment'
      ? 'recibo-consignacion'
      : docType === 'delivery'
        ? 'nota-entrega'
        : 'factura';

  return {
    buffer,
    fileName: `${prefix}-${order.orderNumber}.xlsx`,
  };
}
