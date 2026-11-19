import { prisma } from '../lib/prisma';
import { hashPassword } from '../lib/crypto';
import { seedPermissions } from './seed-permissions';

async function main() {
  await seedPermissions(prisma);

  const demoUsers = [
    {
      email: 'admin@artemodelo.gt',
      fullName: 'Administrador Arte Modelo',
      phone: '+502 5555-0001',
      role: 'ADMIN',
      password: 'Password123',
    },
    {
      email: 'empleado@artemodelo.gt',
      fullName: 'Operador Bodega',
      phone: '+502 5555-0002',
      role: 'EMPLOYEE',
      password: 'Password123',
    },
    {
      email: 'cliente@artemodelo.gt',
      fullName: 'Cliente Demo Guatemala',
      phone: '+502 5555-0003',
      role: 'CUSTOMER',
      password: 'Password123',
    },
    {
      email: 'cliente2@artemodelo.gt',
      fullName: 'Sofía Compras Regional',
      phone: '+504 9988-1122',
      role: 'CUSTOMER',
      password: 'Password123',
    },
  ];

  const userMap = new Map<string, string>();
  for (const item of demoUsers) {
    let user = await prisma.user.findUnique({ where: { email: item.email } });
    if (!user) {
      const passwordHash = await hashPassword(item.password);
      user = await prisma.user.create({
        data: {
          email: item.email,
          fullName: item.fullName,
          phone: item.phone,
          role: item.role,
          passwordHash,
          isActive: true,
          isVerified: true,
        },
      });
    }
    userMap.set(item.email, user.id);
  }

  const adminId = userMap.get('admin@artemodelo.gt') ?? null;

  const demoCustomers = [
    {
      companyName: 'Decoraciones El Quetzal, S.A.',
      managerName: 'Carlos Eduardo Méndez',
      phone: '+502 2360-4411',
      email: 'compras@elquetzal.gt',
      country: 'GT',
      currency: 'GTQ',
      address: '6a Avenida 12-45, Zona 10, Ciudad de Guatemala',
      taxId: '4589123-4',
      notes: 'Cliente frecuente de marcos clásicos y molduras por volumen.',
      linkUserEmail: 'cliente@artemodelo.gt',
    },
    {
      companyName: 'Galería Sula Hogar',
      managerName: 'Maritza Banegas',
      phone: '+504 2550-8820',
      email: 'pedidos@sulahogar.hn',
      country: 'HN',
      currency: 'HNL',
      address: 'Barrio Río de Piedras, San Pedro Sula, Cortés',
      taxId: '05019012345678',
      notes: 'Prefiere empaque reforzado para transporte terrestre.',
      linkUserEmail: null,
    },
    {
      companyName: 'Muebles y Marcos Managua',
      managerName: 'Ernesto Solórzano',
      phone: '+505 2278-3340',
      email: 'gerencia@marcosmanagua.ni',
      country: 'NI',
      currency: 'NIO',
      address: 'Carretera a Masaya Km 5.5, Managua',
      taxId: 'J0310000123456',
      notes: 'Maneja línea de espejos biselados en consignación.',
      linkUserEmail: null,
    },
    {
      companyName: 'Diseño Cuscatlán S.A. de C.V.',
      managerName: 'Valeria Quintanilla',
      phone: '+503 2264-7790',
      email: 'abastecimiento@cuscatlan.sv',
      country: 'SV',
      currency: 'USD',
      address: 'Colonia Escalón, Paseo General Escalón #412, San Salvador',
      taxId: '0614-150890-101-2',
      notes: 'Facturación en dólares estadounidenses (DTE).',
      linkUserEmail: null,
    },
  ];

  for (const c of demoCustomers) {
    let customer = await prisma.customer.findUnique({ where: { email: c.email } });
    if (!customer) {
      customer = await prisma.customer.create({
        data: {
          companyName: c.companyName,
          managerName: c.managerName,
          phone: c.phone,
          email: c.email,
          country: c.country,
          currency: c.currency,
          address: c.address,
          taxId: c.taxId,
          notes: c.notes,
          isActive: true,
        },
      });
    }

    if (c.linkUserEmail) {
      const linkedUser = await prisma.user.findUnique({
        where: { email: c.linkUserEmail },
      });
      if (linkedUser && !linkedUser.customerId) {
        await prisma.user.update({
          where: { id: linkedUser.id },
          data: { customerId: customer.id },
        });
      }
    }
  }

  const demoProducts = [
    {
      name: 'Marco Clásico Azul Marino 40×50 cm',
      description:
        'Marco de madera curada con acabado mate azul marino y paspartú blanco ácido libre.',
      category: 'Marcos',
      priceGTQ: 185,
      priceHNL: 610,
      priceNIO: 890,
      priceUSD: 24,
      stock: 42,
      lowStockThreshold: 10,
      codes: [
        { code: 'AMD-MC-4050', label: 'Interno', isPrimary: true },
        { code: 'PROV-9910', label: 'Proveedor', isPrimary: false },
        { code: 'CLI-QUETZAL-01', label: 'Cliente / Tienda', isPrimary: false },
      ],
      images: [
        {
          url: '/seed/marco-clasico.svg',
          altText: 'Marco Clásico Azul Marino',
          sortOrder: 0,
        },
        {
          url: '/seed/cuadro-moderno.svg',
          altText: 'Detalle de combinación en pared',
          sortOrder: 1,
        },
      ],
      extraMovement: {
        type: 'MANUAL_IN',
        delta: 12,
        reason: 'Reabastecimiento taller semana actual',
        reference: 'LOTE-2026-01',
      },
    },
    {
      name: 'Moldura Dorada Imperial (Barra 2.40 m)',
      description:
        'Moldura tallada en madera pino con hoja dorada envejecida para marcos de galería.',
      category: 'Molduras',
      priceGTQ: 240,
      priceHNL: 790,
      priceNIO: 1150,
      priceUSD: 31,
      stock: 28,
      lowStockThreshold: 8,
      codes: [
        { code: 'AMD-MD-240', label: 'Interno', isPrimary: true },
        { code: 'PROV-DOR-88', label: 'Proveedor', isPrimary: false },
      ],
      images: [
        {
          url: '/seed/moldura-dorada.svg',
          altText: 'Moldura Dorada Imperial',
          sortOrder: 0,
        },
      ],
      extraMovement: null,
    },
    {
      name: 'Espejo Biselado Vino Burdeos 60×90 cm',
      description:
        'Espejo de 4 mm con bisel perimetral de 1.5 cm y bastidor reforzado color vino.',
      category: 'Espejos',
      priceGTQ: 425,
      priceHNL: 1390,
      priceNIO: 2040,
      priceUSD: 55,
      stock: 3, // Stock bajo intencional para probar alerta y filtro lowStockOnly
      lowStockThreshold: 8,
      codes: [
        { code: 'AMD-ESP-6090', label: 'Interno', isPrimary: true },
        { code: 'PROV-ESP-44', label: 'Proveedor', isPrimary: false },
        { code: 'CLI-SULA-14', label: 'Cliente / Tienda', isPrimary: false },
      ],
      images: [
        {
          url: '/seed/espejo-biselado.svg',
          altText: 'Espejo Biselado Vino Burdeos',
          sortOrder: 0,
        },
      ],
      extraMovement: {
        type: 'MANUAL_OUT',
        delta: -5,
        reason: 'Muestra comercial enviada a sala de exhibición',
        reference: 'MUESTRA-07',
      },
    },
    {
      name: 'Cuadro Geométrico Tríptico 30×40 cm',
      description:
        'Set decorativo estilo Bauhaus impreso sobre lienzo tensado con marco negro carbón.',
      category: 'Cuadros',
      priceGTQ: 310,
      priceHNL: 1020,
      priceNIO: 1490,
      priceUSD: 40,
      stock: 19,
      lowStockThreshold: 6,
      codes: [
        { code: 'AMD-CUA-3040', label: 'Interno', isPrimary: true },
        { code: 'CLI-MAN-09', label: 'Cliente / Tienda', isPrimary: false },
      ],
      images: [
        {
          url: '/seed/cuadro-moderno.svg',
          altText: 'Cuadro Geométrico Tríptico',
          sortOrder: 0,
        },
      ],
      extraMovement: null,
    },
    {
      name: 'Marco Diploma Ejecutivo Nogal 28×35 cm',
      description:
        'Portatítulo universitario y corporativo en nogal lustrado con vidrio antirreflejo.',
      category: 'Marcos',
      priceGTQ: 135,
      priceHNL: 445,
      priceNIO: 650,
      priceUSD: 17.5,
      stock: 54,
      lowStockThreshold: 12,
      codes: [
        { code: 'AMD-DIP-2835', label: 'Interno', isPrimary: true },
        { code: 'PROV-NOG-12', label: 'Proveedor', isPrimary: false },
      ],
      images: [
        {
          url: '/seed/marco-clasico.svg',
          altText: 'Marco Diploma Ejecutivo Nogal',
          sortOrder: 0,
        },
      ],
      extraMovement: null,
    },
    {
      name: 'Moldura Minimalista Carbón (Barra 2.40 m)',
      description:
        'Perfil recto negro carbón ideal para fotografía contemporánea y láminas.',
      category: 'Molduras',
      priceGTQ: 165,
      priceHNL: 540,
      priceNIO: 790,
      priceUSD: 21.5,
      stock: 4, // Otro producto con stock bajo para pruebas
      lowStockThreshold: 6,
      codes: [
        { code: 'AMD-MCAR-240', label: 'Interno', isPrimary: true },
        { code: 'PROV-CAR-02', label: 'Proveedor', isPrimary: false },
      ],
      images: [
        {
          url: '/seed/moldura-dorada.svg',
          altText: 'Moldura Minimalista Carbón',
          sortOrder: 0,
        },
      ],
      extraMovement: null,
    },
  ];

  for (const item of demoProducts) {
    const primaryCode = item.codes[0].code;
    const existingCode = await prisma.productCode.findUnique({
      where: { code: primaryCode },
    });

    if (!existingCode) {
      const initialBeforeExtra = item.extraMovement
        ? item.stock - item.extraMovement.delta
        : item.stock;

      const created = await prisma.product.create({
        data: {
          name: item.name,
          description: item.description,
          category: item.category,
          priceGTQ: item.priceGTQ,
          priceHNL: item.priceHNL,
          priceNIO: item.priceNIO,
          priceUSD: item.priceUSD,
          stock: item.stock,
          lowStockThreshold: item.lowStockThreshold,
          isActive: true,
          codes: { create: item.codes },
          images: { create: item.images },
        },
      });

      await prisma.stockMovement.create({
        data: {
          productId: created.id,
          type: 'INITIAL',
          quantityDelta: initialBeforeExtra,
          previousStock: 0,
          newStock: initialBeforeExtra,
          reason: 'Inventario inicial sembrado',
          performedById: adminId,
        },
      });

      if (item.extraMovement) {
        await prisma.stockMovement.create({
          data: {
            productId: created.id,
            type: item.extraMovement.type,
            quantityDelta: item.extraMovement.delta,
            previousStock: initialBeforeExtra,
            newStock: item.stock,
            reason: item.extraMovement.reason,
            reference: item.extraMovement.reference,
            performedById: adminId,
          },
        });
      }
    }
  }

  console.log(
    'Seed local completado (permisos, 4 usuarios, 4 clientes regionales y 6 productos multimoneda).',
  );
}

main()
  .catch((err) => {
    console.error('Error ejecutando seed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
