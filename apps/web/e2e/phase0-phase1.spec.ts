import { test, expect } from '@playwright/test';

test.describe('Arte Modelo Dubois 2.0 — Fase 0 & Fase 1 E2E', () => {
  test('visual Material Design recto, theme toggle y cero scroll horizontal', async ({
    page,
  }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await page.goto('/login');
    await expect(
      page.getByRole('heading', { name: 'Iniciar Sesión' }),
    ).toBeVisible();

    // Verificar cero desbordamiento horizontal
    const hasHorizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(hasHorizontalOverflow).toBe(false);

    // Verificar esquinas rectas (border-radius: 0px)
    const buttonRadius = await page
      .getByRole('button', { name: 'Ingresar' })
      .evaluate((el) => getComputedStyle(el).borderRadius);
    expect(buttonRadius).toBe('0px');

    // Alternar tema oscuro y confirmar persistencia en atributo data-theme
    const themeBtn = page.getByRole('button', { name: /Activar tema oscuro/i });
    await themeBtn.click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

    // Volver a tema claro
    await page.getByRole('button', { name: /Activar tema claro/i }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');

    expect(pageErrors).toEqual([]);
  });

  test('flujo completo Admin: login, gestión de usuarios, matriz de permisos y logout', async ({
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

    // Ir a Usuarios (usando drawer en móvil o sidebar en desktop)
    if (isMobile) {
      await page.getByLabel('Abrir o contraer menú lateral').click();
    }
    await page.getByRole('link', { name: 'Usuarios', exact: true }).click();
    await expect(
      page.getByRole('heading', { name: 'Gestión de Usuarios' }),
    ).toBeVisible();

    // Confirmar cero scroll horizontal en tabla/cards de usuarios
    const overflowUsers = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(overflowUsers).toBe(false);

    // En móvil se muestran cards; en desktop la tabla tradicional
    if (isMobile) {
      await expect(page.getByTestId('responsive-table-cards')).toBeVisible();
    } else {
      await expect(page.getByRole('table', { name: 'Listado de usuarios' })).toBeVisible();
    }

    // Invitar un usuario único
    const uniqueEmail = `invitado.${Date.now()}@artemodelo.gt`;
    await page.getByRole('button', { name: /Invitar usuario/i }).click();
    await page.getByLabel('Nombre completo').fill('Usuario Invitado E2E');
    await page.getByLabel('Correo electrónico').fill(uniqueEmail);
    await page.getByRole('button', { name: 'Enviar invitación' }).click();

    await expect(page.getByText(/Invitación enviada/i).first()).toBeVisible();

    // Ir a Configuración y abrir pestaña Permisos por Rol
    if (isMobile) {
      await page.getByLabel('Abrir o contraer menú lateral').click();
    }
    await page.getByRole('link', { name: 'Configuración', exact: true }).click();
    await expect(
      page.getByRole('heading', { name: 'Configuración' }),
    ).toBeVisible();

    await page.getByRole('tab', { name: 'Permisos por Rol' }).click();
    await expect(
      page.getByRole('heading', { name: /Matriz de Permisos/i }),
    ).toBeVisible();

    const permSwitch = page.getByRole('switch', {
      name: 'Ver usuarios para Empleado',
    });
    const beforeState = await permSwitch.getAttribute('aria-checked');
    await permSwitch.click();
    await expect(permSwitch).toHaveAttribute(
      'aria-checked',
      beforeState === 'true' ? 'false' : 'true',
    );
    // Restaurar estado original
    await permSwitch.click();
    await expect(permSwitch).toHaveAttribute('aria-checked', beforeState || 'false');

    // Cerrar sesión
    await page.getByRole('button', { name: 'Cerrar sesión' }).click();
    await expect(
      page.getByRole('heading', { name: 'Iniciar Sesión' }),
    ).toBeVisible();

    expect(pageErrors).toEqual([]);
  });

  test('registro público de cliente, verificación y bloqueo RBAC en /usuarios', async ({
    page,
  }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    const uniqueCustomerEmail = `cliente.e2e.${Date.now()}@ejemplo.gt`;

    await page.goto('/registro');
    await page.getByLabel('Nombre completo').fill('Cliente Prueba E2E');
    await page.getByLabel('Correo electrónico').fill(uniqueCustomerEmail);
    await page.getByLabel('Teléfono (opcional)').fill('+502 5555-7777');
    await page.getByLabel('Contraseña', { exact: true }).fill('Password123');
    await page.getByLabel('Confirmar contraseña').fill('Password123');
    await page.getByRole('button', { name: 'Crear cuenta' }).click();

    await expect(page.getByText(/Registro exitoso/i)).toBeVisible();

    // Usar enlace de verificación en modo local
    await page.getByRole('link', { name: 'Verificar ahora' }).click();
    await expect(
      page.getByText(/Tu correo ha sido verificado correctamente/i),
    ).toBeVisible();

    // Iniciar sesión como el nuevo cliente
    await page.getByRole('link', { name: 'Iniciar sesión' }).click();
    await page.getByLabel('Correo electrónico').fill(uniqueCustomerEmail);
    await page.getByLabel('Contraseña').fill('Password123');
    await page.getByRole('button', { name: 'Ingresar' }).click();

    await expect(
      page.getByRole('heading', { name: /Bienvenido, Cliente Prueba E2E/i }),
    ).toBeVisible();

    // Confirmar bloqueo RBAC al intentar entrar directo a /usuarios
    await page.goto('/usuarios');
    await expect(
      page.getByRole('heading', { name: 'Acceso restringido' }),
    ).toBeVisible();

    expect(pageErrors).toEqual([]);
  });
});
