import { test, expect } from '@playwright/test';

test.describe('Arte Modelo Dubois 2.0 — Fase 4 Pedidos B2B E2E', () => {
  test('flujo completo cliente crea pedido -> staff verifica tooltip último precio, confirma, empaca por delta y despacha parcial y totalmente', async ({
    page,
    isMobile,
  }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    // 1. Cliente solicita pedido sin ver precios
    await page.goto('/login');
    await page.getByLabel('Correo electrónico').fill('cliente@artemodelo.gt');
    await page.getByLabel('Contraseña').fill('Password123');
    await page.getByRole('button', { name: 'Ingresar' }).click();

    await expect(
      page.getByRole('heading', { name: /Bienvenido, Cliente Demo Guatemala/i }),
    ).toBeVisible();

    if (isMobile) {
      await page.getByLabel('Abrir o contraer menú lateral').click();
    }
    await page.getByRole('link', { name: 'Pedidos', exact: true }).click();
    await expect(
      page.getByRole('heading', { name: 'Pedidos B2B y Despachos' }),
    ).toBeVisible();

    const overflowCustomerList = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(overflowCustomerList).toBe(false);

    await page.getByRole('link', { name: /Nuevo pedido/i }).click();
    await expect(
      page.getByRole('heading', { name: 'Solicitar Nuevo Pedido' }),
    ).toBeVisible();
    await expect(page.getByLabel(/Precio unit\./i)).toHaveCount(0);
    await expect(page.getByLabel(/Flete/i)).toHaveCount(0);

    // Seleccionar producto por código AMD-EOV-5070 o el primer producto disponible
    const productSelect = page.locator('#line-prod-0');
    const targetProdOption = productSelect.locator('option', {
      hasText: 'Marco Diploma Ejecutivo Nogal',
    });
    const prodValue = await targetProdOption.getAttribute('value');
    expect(prodValue).toBeTruthy();
    await productSelect.selectOption(prodValue!);

    await page.locator('#line-qty-0').fill('2');
    await page
      .locator('#order-notes')
      .fill(`Pedido cliente E2E ${isMobile ? 'Mobile' : 'Desktop'}`);
    await page
      .getByRole('button', { name: 'Enviar pedido para confirmación' })
      .click();

    await expect(page.getByText('Por confirmar').first()).toBeVisible();
    await expect(
      page.getByText(/Los precios y montos finales de este pedido estarán disponibles/i),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: /Confirmar pedido/i }),
    ).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Empacar/i })).toHaveCount(0);
    await expect(page.getByRole('link', { name: /Editar/i })).toHaveCount(0);

    const customerOrderUrl = page.url();

    // 2. Cerrar sesión e iniciar como Administrador
    await page.getByRole('button', { name: 'Cerrar sesión' }).click();
    await expect(page).toHaveURL(/\/login/);

    await page.getByLabel('Correo electrónico').fill('admin@artemodelo.gt');
    await page.getByLabel('Contraseña').fill('Password123');
    await page.getByRole('button', { name: 'Ingresar' }).click();
    await expect(
      page.getByRole('heading', { name: /Bienvenido, Administrador Arte Modelo/i }),
    ).toBeVisible();

    if (isMobile) {
      await page.getByLabel('Abrir o contraer menú lateral').click();
    }
    await page.getByRole('link', { name: 'Pedidos', exact: true }).click();
    await expect(
      page.getByRole('heading', { name: 'Pedidos B2B y Despachos' }),
    ).toBeVisible();

    // Verificar paginación Todos (pageSize=0)
    await page.getByLabel('Registros por página').selectOption('0');
    await expect(page.getByText('Página 1 de 1')).toBeVisible();

    // 3. Verificar tooltip de último precio en /pedidos/nuevo para El Quetzal + Marco Clásico Azul Marino (Q 175.00 en seed)
    await page.getByRole('link', { name: /Nuevo pedido/i }).click();
    const custSelect = page.getByLabel('Cliente');
    const quetzalOption = custSelect.locator('option', {
      hasText: 'Decoraciones El Quetzal',
    });
    const quetzalId = await quetzalOption.getAttribute('value');
    expect(quetzalId).toBeTruthy();
    await custSelect.selectOption(quetzalId!);

    const staffProdSelect = page.locator('#line-prod-0');
    const marcoOption = staffProdSelect.locator('option', {
      hasText: 'Marco Clásico Azul Marino',
    });
    const marcoId = await marcoOption.getAttribute('value');
    expect(marcoId).toBeTruthy();
    await staffProdSelect.selectOption(marcoId!);

    await expect(
      page.getByText(/Último precio aplicado a este cliente:/i),
    ).toBeVisible();
    await expect(
      page.getByRole('tooltip').getByText(/175\.00/),
    ).toBeVisible();

    // 4. Ir al pedido del cliente, confirmarlo, empacar parcial/total y despachar parcial/total
    await page.goto(customerOrderUrl);
    await expect(page.getByText('Por confirmar').first()).toBeVisible();

    await page.getByRole('button', { name: /Confirmar pedido/i }).click();
    await page
      .getByRole('dialog')
      .getByRole('button', { name: 'Confirmar pedido' })
      .click();
    await expect(page.getByText('Confirmado').first()).toBeVisible();

    // Empacar 1 de 2 unidades (delta -1)
    await page.getByRole('button', { name: /Empacar/i }).click();
    const packDialog = page.getByRole('dialog');
    await packDialog.getByLabel('Total empacado').fill('1');
    await expect(packDialog.getByText('Delta: -1 de stock')).toBeVisible();
    await packDialog.getByRole('button', { name: 'Guardar empaque' }).click();
    await expect(page.getByText('Empacando').first()).toBeVisible();

    // Registrar Despacho #1 (parcial)
    await page.getByRole('button', { name: /Despachar/i }).click();
    const disp1Dialog = page.getByRole('dialog');
    await disp1Dialog.getByLabel('Transporte / Mensajero').fill('Guatex E2E');
    await disp1Dialog.getByRole('button', { name: 'Registrar despacho' }).click();
    await expect(page.getByText('Despacho parcial').first()).toBeVisible();
    await expect(page.getByText('Despacho #1')).toBeVisible();
    await expect(page.getByText('Pendiente de pago').first()).toBeVisible();

    // Empacar la 2a unidad y registrar Despacho #2 (total) manteniendo paymentStatus desacoplado
    await page.getByRole('button', { name: /Empacar/i }).click();
    const pack2Dialog = page.getByRole('dialog');
    await pack2Dialog.getByLabel('Total empacado').fill('2');
    await expect(pack2Dialog.getByText('Delta: -1 de stock')).toBeVisible();
    await pack2Dialog.getByRole('button', { name: 'Guardar empaque' }).click();
    await expect(page.getByRole('button', { name: /Despachar/i })).toBeVisible();

    await page.getByRole('button', { name: /Despachar/i }).click();
    await page
      .getByRole('dialog')
      .getByRole('button', { name: 'Registrar despacho' })
      .click();
    await expect(page.getByText('Entregado total').first()).toBeVisible();
    await expect(page.getByText('Despacho #2')).toBeVisible();
    await expect(page.getByText('Pendiente de pago').first()).toBeVisible();

    const overflowDetail = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(overflowDetail).toBe(false);
    expect(pageErrors).toEqual([]);
  });
});
