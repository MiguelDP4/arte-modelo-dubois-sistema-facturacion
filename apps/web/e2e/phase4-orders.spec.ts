import { test, expect } from '@playwright/test';

test.describe('Arte Modelo Dubois 2.0 — Fase 4 Pedidos B2B E2E', () => {
  test('flujo completo cliente crea pedido -> staff verifica ProductSearchSelect debounced sin duplicados, descuento oculto, tooltip condicional, confirma, empaca y despacha', async ({
    page,
    isMobile,
  }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    // 1. Cliente solicita pedido usando ProductSearchSelect sin ver precios ni catálogo completo
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
    await expect(page.getByText(/Línea #1/i)).toHaveCount(0);
    await expect(page.getByText(/^Quitar$/i)).toHaveCount(0);

    // Abrir select buscador, buscar con debounce 1s sin mostrar precios al cliente
    await page.locator('#line-prod-0').click();
    const custSearchInput = page.getByPlaceholder('Buscar un producto...');
    await expect(custSearchInput).toBeFocused();
    await custSearchInput.fill('Marco Diploma Ejecutivo Nogal');
    await expect(page.getByText('Buscando...')).toBeVisible();
    await expect(page.getByTestId('search-spinner')).toBeVisible();
    await expect(page.getByText(/Esperando 1/i)).toHaveCount(0);

    const custOption = page.getByRole('option', {
      name: /Marco Diploma Ejecutivo Nogal/i,
    });
    await expect(custOption).toBeVisible({ timeout: 5000 });
    await expect(custOption).not.toContainText('Q');
    await custOption.click();

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

    // 3. Verificar en /pedidos/nuevo: ProductSearchSelect debounced, exclusión de duplicados, descuentos ocultos y tooltip condicional
    await page.getByRole('link', { name: /Nuevo pedido/i }).click();
    await expect(page.getByText(/Línea #1/i)).toHaveCount(0);
    await expect(page.getByLabel('Tipo descuento')).toHaveCount(0);

    // Toggle de descuento
    await page.getByRole('button', { name: 'Descuento de línea' }).first().click();
    await expect(page.getByLabel('Tipo descuento')).toBeVisible();
    await page.getByRole('button', { name: 'Descuento de línea' }).first().click();
    await expect(page.getByLabel('Tipo descuento')).toHaveCount(0);

    // Cliente con búsqueda debounced y lazy load por scroll
    await page.locator('#order-customer').click();
    const custListbox = page.getByRole('listbox', { name: 'Resultados de clientes' });
    await expect(custListbox).toBeVisible({ timeout: 5000 });
    await expect(custListbox.getByRole('option')).toHaveCount(10);

    await custListbox.evaluate((el) => {
      el.scrollTop = el.scrollHeight;
    });
    await expect
      .poll(async () => custListbox.getByRole('option').count(), { timeout: 5000 })
      .toBeGreaterThan(10);

    const custComboSearch = page.getByPlaceholder('Buscar un cliente...');
    await custComboSearch.fill('Quetzal');
    await expect(page.getByText('Buscando...')).toBeVisible();
    await expect(page.getByTestId('search-spinner')).toBeVisible();
    await expect(page.getByText(/Esperando 1/i)).toHaveCount(0);

    const quetzalOption = custListbox.getByRole('option', {
      name: /Decoraciones El Quetzal/i,
    });
    await expect(quetzalOption).toBeVisible({ timeout: 5000 });
    await quetzalOption.click();

    // Línea 1: ProductSearchSelect lazy load por scroll (10 -> 14 productos) + búsqueda Marco Clásico Azul Marino
    await page.locator('#line-prod-0').click();
    const prodListbox = page.getByRole('listbox', { name: 'Resultados de productos' });
    await expect(prodListbox).toBeVisible({ timeout: 5000 });
    await expect(prodListbox.getByRole('option')).toHaveCount(10);

    await prodListbox.evaluate((el) => {
      el.scrollTop = el.scrollHeight;
    });
    await expect
      .poll(async () => prodListbox.getByRole('option').count(), { timeout: 5000 })
      .toBeGreaterThan(10);

    await page.getByPlaceholder('Buscar un producto...').fill('Marco Clásico Azul');
    const marcoOpt = page.getByRole('option', {
      name: /Marco Clásico Azul Marino/i,
    });
    await expect(marcoOpt).toBeVisible({ timeout: 5000 });
    await expect(marcoOpt.locator('img')).toBeVisible();
    await expect(marcoOpt).toContainText('185.00');
    await marcoOpt.click();

    await expect(
      page.getByRole('tooltip').getByText(/Último precio aplicado a este cliente:/i),
    ).toBeVisible();
    await expect(
      page.getByRole('tooltip').getByText(/175\.00/),
    ).toBeVisible();

    const infoBtn = page.getByRole('button', { name: 'Ver último precio línea 1' });
    const subtotalLabel = page.locator('span', { hasText: /^Subtotal$/ }).first();
    const infoBox = await infoBtn.boundingBox();
    const subBox = await subtotalLabel.boundingBox();
    expect(infoBox).not.toBeNull();
    expect(subBox).not.toBeNull();
    if (!isMobile && infoBox && subBox) {
      expect(infoBox.x + infoBox.width).toBeLessThanOrEqual(subBox.x - 4);
    } else if (isMobile && infoBox && subBox) {
      expect(infoBox.y + infoBox.height).toBeLessThanOrEqual(subBox.y);
    }

    // Agregar Línea 2: verificar que Marco Clásico Azul Marino NO aparece (sin repetidos)
    // y elegir Cuadro Abstracto Terracota que no tiene historial (sin mostrar "sin historial")
    await page.getByRole('button', { name: /Agregar producto/i }).click();
    await page.locator('#line-prod-1').click();
    await page.getByPlaceholder('Buscar un producto...').fill('Marco Clásico Azul Marino');
    await expect(
      page.getByText('No hay productos disponibles con esa búsqueda.'),
    ).toBeVisible({ timeout: 5000 });

    await page.getByPlaceholder('Buscar un producto...').fill('Cuadro Abstracto Terracota');
    const cuadroOpt = page.getByRole('option', {
      name: /Cuadro Abstracto Terracota/i,
    });
    await expect(cuadroOpt).toBeVisible({ timeout: 5000 });
    await cuadroOpt.click();

    await expect(page.getByText(/sin historial/i)).toHaveCount(0);
    await page
      .getByRole('button', { name: 'Quitar producto' })
      .nth(1)
      .click();

    // 4. Ir al pedido del cliente, confirmarlo, empacar parcial/total, despachar parcial/total y verificar white-space nowrap
    await page.goto(customerOrderUrl);
    await expect(page.getByText('Por confirmar').first()).toBeVisible();

    await page.getByRole('button', { name: /Confirmar pedido/i }).click();
    await page
      .getByRole('dialog')
      .getByRole('button', { name: 'Confirmar pedido' })
      .click();
    await expect(page.getByText('Confirmado').first()).toBeVisible();

    const financeWhiteSpace = await page
      .locator('[aria-label="Resumen financiero"] strong')
      .first()
      .evaluate((el) => window.getComputedStyle(el).whiteSpace);
    expect(financeWhiteSpace).toBe('nowrap');

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

    // Empacar la 2a unidad y registrar Despacho #2 (total)
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
