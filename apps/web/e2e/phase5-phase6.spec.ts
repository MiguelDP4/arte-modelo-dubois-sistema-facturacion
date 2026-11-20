import { test, expect } from '@playwright/test';

test.describe('Arte Modelo Dubois 2.0 — Fase 5 & Fase 6 E2E', () => {
  test('dashboard multimoneda, pagos/anulaciones, consignaciones/devoluciones y descarga Excel (.xlsx)', async ({
    page,
    isMobile,
  }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    // 1. Login Admin y verificación del Dashboard Ejecutivo (F6-01)
    await page.goto('/login');
    await page.getByLabel('Correo electrónico').fill('admin@artemodelo.gt');
    await page.getByLabel('Contraseña').fill('Password123');
    await page.getByRole('button', { name: 'Ingresar' }).click();

    await expect(
      page.getByRole('heading', { name: 'Cuentas por Cobrar por Moneda' }),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Consignaciones Próximas a Revisión' }),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Alertas de Stock Bajo' }),
    ).toBeVisible();
    await expect(page.getByText('Espejo Biselado Vino Burdeos 60×90 cm')).toBeVisible();

    const overflowDash = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(overflowDash).toBe(false);

    // 2. Ir a /pedidos -> abrir PED-2026-0001 para probar pagos, anulación y descarga Excel
    if (isMobile) {
      await page.getByLabel('Abrir o contraer menú lateral').click();
    }
    await page.getByRole('link', { name: 'Pedidos', exact: true }).click();
    await expect(
      page.getByRole('heading', { name: 'Pedidos B2B y Despachos' }),
    ).toBeVisible();

    const rowContainer = isMobile
      ? page.locator('article', { hasText: 'PED-2026-0001' }).first()
      : page.locator('tr', { hasText: 'PED-2026-0001' }).first();
    await rowContainer.getByRole('link', { name: 'Ver detalle' }).click();

    await expect(page.getByRole('heading', { name: 'PED-2026-0001' })).toBeVisible();
    await expect(page.getByText('Pagos y Abonos')).toBeVisible();
    await expect(page.getByText(/TRANSF-88410/)).toBeVisible();

    // Registrar un abono en efectivo y luego anularlo
    await page.getByRole('button', { name: /Registrar abono/i }).click();
    const payDialog = page.getByRole('dialog');
    await payDialog.getByLabel(/Método de pago/i).selectOption('CASH');
    await payDialog.getByLabel(/Monto del abono/i).fill('110');
    await payDialog.getByLabel(/Número de boleta/i).fill('REC-E2E-110');
    await payDialog.getByRole('button', { name: 'Guardar abono' }).click();

    await expect(page.getByText(/REC-E2E-110/)).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/910\.00/)).toBeVisible();

    await page.getByRole('button', { name: 'Anular abono' }).first().click();
    const voidDialog = page.getByRole('dialog');
    await voidDialog.getByLabel('Motivo de anulación').fill('Prueba de anulación E2E');
    await voidDialog.getByRole('button', { name: 'Confirmar anulación' }).click();
    await expect(page.getByText('Anulado: Prueba de anulación E2E').first()).toBeVisible({
      timeout: 5000,
    });
    await expect(page.getByText(/810\.00/)).toBeVisible();

    // Descargar Factura .xlsx
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Factura .xlsx' }).click(),
    ]);
    expect(download.suggestedFilename()).toBe('factura-PED-2026-0001.xlsx');

    // 3. Navegar a /consignaciones, validar reporte consolidado + devolución en PED-2026-0004
    if (isMobile) {
      await page.getByLabel('Abrir o contraer menú lateral').click();
    }
    await page.getByRole('link', { name: 'Consignaciones', exact: true }).click();
    await expect(
      page.getByRole('heading', { name: 'Control de Consignaciones' }),
    ).toBeVisible();
    const consignList = isMobile ? page.locator('article') : page.locator('tbody tr');
    await expect(
      consignList.filter({ hasText: 'Muebles y Marcos Managua' }).first(),
    ).toBeVisible();
    await expect(
      consignList.filter({ hasText: 'Galería Sula Hogar' }).first(),
    ).toBeVisible();

    await page.getByLabel('Buscar consignación').fill('Managua');
    await expect(page.getByText('Buscando...')).toBeVisible();
    await expect(page.getByTestId('search-spinner')).toBeVisible();

    const ped0004Row = consignList.filter({ hasText: 'PED-2026-0004' }).first();
    await expect(ped0004Row).toBeVisible({
      timeout: 5000,
    });

    const overflowConsign = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(overflowConsign).toBe(false);

    await ped0004Row.getByRole('link', { name: 'PED-2026-0004' }).click();
    await expect(page.getByRole('heading', { name: 'PED-2026-0004' })).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Control de Consignación y Devoluciones' }),
    ).toBeVisible();

    await page.getByRole('button', { name: /Registrar devolución/i }).click();
    const retDialog = page.getByRole('dialog');
    await retDialog.getByLabel('Cantidad a devolver').first().fill('1');
    await retDialog.getByLabel(/Notas de recepción/i).fill('Devolución E2E');
    await retDialog.getByRole('button', { name: 'Registrar devolución' }).click();

    await expect(page.getByText('Devolución E2E').first()).toBeVisible({ timeout: 5000 });

    const overflowDetail = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(overflowDetail).toBe(false);
    expect(pageErrors).toEqual([]);
  });
});
