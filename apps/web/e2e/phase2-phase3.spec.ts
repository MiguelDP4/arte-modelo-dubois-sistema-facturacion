import { test, expect } from '@playwright/test';

test.describe('Arte Modelo Dubois 2.0 — Fase 2 & Fase 3 E2E', () => {
  test('catálogo público sin precios ni stock, búsqueda por código secundario y galería modal', async ({
    page,
  }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await page.goto('/catalogo');
    await expect(
      page.getByRole('heading', { name: 'Catálogo Arte Modelo Dubois' }),
    ).toBeVisible();

    // Sin scroll horizontal ni precios visibles para público
    const hasOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(hasOverflow).toBe(false);
    await expect(page.getByText(/Existencia:/i)).toHaveCount(0);

    // Buscar por código secundario PROV-9910 del seed
    await page.getByLabel('Buscar producto o código').fill('PROV-9910');
    await expect(
      page.getByRole('heading', { name: /Marco Clásico Azul Marino/i }),
    ).toBeVisible();

    // Abrir galería modal
    await page
      .getByRole('button', { name: /Ver galería de Marco Clásico Azul Marino/i })
      .click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByRole('button', { name: 'Cerrar', exact: true }).click();

    expect(pageErrors).toEqual([]);
  });

  test('staff administra productos multimoneda, códigos múltiples y Kardex de inventario', async ({
    page,
    isMobile,
  }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await page.goto('/login');
    await page.getByLabel('Correo electrónico').fill('admin@artemodelo.gt');
    await page.getByLabel('Contraseña').fill('Password123');
    await page.getByRole('button', { name: 'Ingresar' }).click();

    await expect(
      page.getByRole('heading', { name: /Bienvenido, Administrador Arte Modelo/i }),
    ).toBeVisible();

    if (isMobile) {
      await page.getByLabel('Abrir o contraer menú lateral').click();
    }
    await page.getByRole('link', { name: 'Productos', exact: true }).click();
    await expect(
      page.getByRole('heading', { name: 'Productos e Inventario (Kardex)' }),
    ).toBeVisible();

    const overflowProd = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(overflowProd).toBe(false);

    // Crear producto con 2 códigos
    const uniqueSuffix = String(Date.now()).slice(-5);
    await page.getByRole('button', { name: /Nuevo producto/i }).click();
    const prodDialog = page.getByRole('dialog');
    await prodDialog
      .getByLabel('Nombre del producto')
      .fill(`Marco E2E ${uniqueSuffix}`);
    await prodDialog.getByLabel('Categoría').fill('Marcos');
    await prodDialog.getByLabel('Inventario inicial').fill('5');
    await prodDialog.getByLabel('Precio GTQ (Q)').fill('250');
    await prodDialog
      .getByLabel('Código 1', { exact: true })
      .fill(`AMD-E2E-${uniqueSuffix}`);
    await prodDialog.getByRole('button', { name: /Agregar código/i }).click();
    await prodDialog
      .getByLabel('Código 2', { exact: true })
      .fill(`PROV-E2E-${uniqueSuffix}`);
    await prodDialog.getByRole('button', { name: 'Guardar producto' }).click();

    await expect(page.getByText(/Producto creado/i).first()).toBeVisible();

    // Filtrar por el código secundario recién creado y registrar movimiento Kardex
    await page
      .getByLabel('Buscar por nombre o cualquier código')
      .fill(`PROV-E2E-${uniqueSuffix}`);
    await page.getByRole('button', { name: /Kardex/i }).first().click();

    const kardexDialog = page.getByRole('dialog');
    await expect(kardexDialog).toBeVisible();
    await kardexDialog.getByLabel('Cantidad').fill('7');
    await kardexDialog.getByLabel('Motivo').fill('Ingreso prueba E2E');
    await kardexDialog.getByRole('button', { name: 'Registrar movimiento' }).click();

    await expect(kardexDialog.getByText('12 unidades').first()).toBeVisible();
    await kardexDialog.getByRole('button', { name: 'Cerrar', exact: true }).click();

    expect(pageErrors).toEqual([]);
  });

  test('staff crea cliente regional con etiqueta fiscal dinámica y vincula/desvincula cuenta', async ({
    page,
    isMobile,
  }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await page.goto('/login');
    await page.getByLabel('Correo electrónico').fill('admin@artemodelo.gt');
    await page.getByLabel('Contraseña').fill('Password123');
    await page.getByRole('button', { name: 'Ingresar' }).click();

    if (isMobile) {
      await page.getByLabel('Abrir o contraer menú lateral').click();
    }
    await page.getByRole('link', { name: 'Clientes', exact: true }).click();
    await expect(
      page.getByRole('heading', { name: 'Cartera Regional de Clientes' }),
    ).toBeVisible();

    const overflowCust = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(overflowCust).toBe(false);

    // Crear cliente en Honduras validando etiqueta dinámica RTN y moneda HNL
    const suffix = String(Date.now()).slice(-5);
    await page.getByRole('button', { name: /Nuevo cliente/i }).click();
    const custDialog = page.getByRole('dialog');
    await custDialog.getByLabel('País').selectOption('HN');
    await expect(custDialog.getByLabel('RTN')).toBeVisible();
    await expect(custDialog.getByText('HNL', { exact: true })).toBeVisible();

    await custDialog
      .getByLabel('Nombre de empresa')
      .fill(`Empresa E2E HN ${suffix}`);
    await custDialog.getByLabel('Encargado / Contacto').fill('Marcos Pineda');
    await custDialog.getByLabel('Teléfono').fill('+504 9900-1122');
    await custDialog
      .getByLabel('Correo electrónico')
      .fill(`hn.${suffix}@ejemplo.hn`);
    await custDialog.getByLabel('RTN').fill(`05011990${suffix}`);
    await custDialog
      .getByLabel('Dirección de entrega / fiscal')
      .fill('San Pedro Sula Centro');
    await custDialog.getByRole('button', { name: 'Guardar cliente' }).click();

    await expect(page.getByText(/Cliente creado/i).first()).toBeVisible();

    // Buscar el cliente recién creado y entrar a su ficha
    await page.getByLabel('Buscar cliente').fill(`Empresa E2E HN ${suffix}`);
    await page.getByRole('link', { name: /Ver detalle/i }).first().click();

    await expect(
      page.getByRole('heading', { name: `Empresa E2E HN ${suffix}` }),
    ).toBeVisible();
    await expect(page.getByText('Honduras (HNL)')).toBeVisible();

    // Vincular usuario disponible cliente2@artemodelo.gt y luego desvincularlo
    const selectUser = page.getByLabel('Vincular cuenta con rol Cliente');
    const targetOption = selectUser.locator('option', {
      hasText: 'cliente2@artemodelo.gt',
    });
    const optionValue = await targetOption.getAttribute('value');
    expect(optionValue).toBeTruthy();

    await selectUser.selectOption(optionValue!);
    await page.getByRole('button', { name: /^Vincular$/i }).click();
    await expect(page.getByText(/vinculado correctamente/i).first()).toBeVisible();

    await page.getByRole('button', { name: /Desvincular/i }).click();
    await page
      .getByRole('dialog')
      .getByRole('button', { name: 'Desvincular' })
      .click();
    await expect(
      page.getByText(/desvinculado correctamente/i).first(),
    ).toBeVisible();

    expect(pageErrors).toEqual([]);
  });
});
