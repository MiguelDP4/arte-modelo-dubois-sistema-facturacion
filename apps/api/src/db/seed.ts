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
    {
      companyName: 'Atelier Antigua Decoración',
      managerName: 'Lucía Asturias',
      phone: '+502 7832-1190',
      email: 'compras@atelierantigua.gt',
      country: 'GT',
      currency: 'GTQ',
      address: '5a Calle Poniente #18, Antigua Guatemala',
      taxId: '7823410-9',
      notes: 'Especializada en hoteles boutique.',
      linkUserEmail: null,
    },
    {
      companyName: 'Casa del Cuadro Xela',
      managerName: 'Rodrigo López',
      phone: '+502 7761-3302',
      email: 'pedidos@casacuadroxela.gt',
      country: 'GT',
      currency: 'GTQ',
      address: 'Zona 3, Quetzaltenango',
      taxId: '3348901-2',
      notes: 'Envíos semanales por encomienda.',
      linkUserEmail: null,
    },
    {
      companyName: 'Estudio Tegucigalpa Arte',
      managerName: 'Fernanda Zelaya',
      phone: '+504 2239-4500',
      email: 'arte@estudiotegu.hn',
      country: 'HN',
      currency: 'HNL',
      address: 'Colonia Palmira, Tegucigalpa',
      taxId: '08011988004512',
      notes: null,
      linkUserEmail: null,
    },
    {
      companyName: 'Decorativa La Ceiba',
      managerName: 'Óscar Mejía',
      phone: '+504 2443-9021',
      email: 'ventas@decorativalaceiba.hn',
      country: 'HN',
      currency: 'HNL',
      address: 'Avenida San Isidro, La Ceiba',
      taxId: '01011991003344',
      notes: null,
      linkUserEmail: null,
    },
    {
      companyName: 'Enmarcados Granada Colonial',
      managerName: 'Beatriz Chamorro',
      phone: '+505 2552-6110',
      email: 'contacto@granadacolonial.ni',
      country: 'NI',
      currency: 'NIO',
      address: 'Calle La Calzada #45, Granada',
      taxId: 'J0310000987654',
      notes: null,
      linkUserEmail: null,
    },
    {
      companyName: 'Galería León Moderno',
      managerName: 'Julio Argüello',
      phone: '+505 2311-4820',
      email: 'compras@leonmoderno.ni',
      country: 'NI',
      currency: 'NIO',
      address: 'Parque Central 2c al Sur, León',
      taxId: 'J0310000554433',
      notes: null,
      linkUserEmail: null,
    },
    {
      companyName: 'Arquitectura Interior Santa Ana',
      managerName: 'Diego Vásquez',
      phone: '+503 2441-8890',
      email: 'proyectos@santana.sv',
      country: 'SV',
      currency: 'USD',
      address: '4a Calle Oriente, Santa Ana',
      taxId: '0210-200488-102-5',
      notes: null,
      linkUserEmail: null,
    },
    {
      companyName: 'Vitrales y Marcos San Miguel',
      managerName: 'Elena Portillo',
      phone: '+503 2661-5520',
      email: 'compras@vitralessm.sv',
      country: 'SV',
      currency: 'USD',
      address: 'Av. Roosevelt Sur #220, San Miguel',
      taxId: '1217-101192-104-1',
      notes: null,
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
      priceGTQ: 425,
      priceHNL: 1390,
      priceNIO: 2040,
      priceUSD: 55,
      stock: 3,
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
      priceGTQ: 165,
      priceHNL: 540,
      priceNIO: 790,
      priceUSD: 21.5,
      stock: 4,
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
    {
      name: 'Espejo Ovalado Dorado Veneciano 50×70 cm',
      description: 'Espejo ovalado con moldura labrada en pan de oro mate.',
      priceGTQ: 390,
      priceHNL: 1280,
      priceNIO: 1870,
      priceUSD: 50,
      stock: 15,
      lowStockThreshold: 5,
      codes: [
        { code: 'AMD-EOV-5070', label: 'Interno', isPrimary: true },
        { code: 'PROV-VEN-50', label: 'Proveedor', isPrimary: false },
      ],
      images: [
        {
          url: '/seed/espejo-biselado.svg',
          altText: 'Espejo Ovalado Dorado Veneciano',
          sortOrder: 0,
        },
      ],
      extraMovement: null,
    },
    {
      name: 'Marco Flotante Roble Natural 50×70 cm',
      description: 'Bastidor tipo caja flotante en roble natural para lienzos.',
      priceGTQ: 225,
      priceHNL: 740,
      priceNIO: 1080,
      priceUSD: 29,
      stock: 22,
      lowStockThreshold: 6,
      codes: [
        { code: 'AMD-MFL-5070', label: 'Interno', isPrimary: true },
        { code: 'PROV-ROB-70', label: 'Proveedor', isPrimary: false },
      ],
      images: [
        {
          url: '/seed/marco-clasico.svg',
          altText: 'Marco Flotante Roble Natural',
          sortOrder: 0,
        },
      ],
      extraMovement: null,
    },
    {
      name: 'Cuadro Paisaje Atitlán Óleo 60×80 cm',
      description: 'Impresión giclée texturizada montada sobre bastidor doble.',
      priceGTQ: 480,
      priceHNL: 1580,
      priceNIO: 2300,
      priceUSD: 62,
      stock: 11,
      lowStockThreshold: 4,
      codes: [
        { code: 'AMD-ATI-6080', label: 'Interno', isPrimary: true },
        { code: 'CLI-ANT-03', label: 'Cliente / Tienda', isPrimary: false },
      ],
      images: [
        {
          url: '/seed/cuadro-moderno.svg',
          altText: 'Cuadro Paisaje Atitlán',
          sortOrder: 0,
        },
      ],
      extraMovement: null,
    },
    {
      name: 'Moldura Tallada Cedro Antiguo (Barra 2.40 m)',
      description: 'Perfil clásico colonial en cedro envejecido.',
      priceGTQ: 275,
      priceHNL: 905,
      priceNIO: 1320,
      priceUSD: 35.5,
      stock: 33,
      lowStockThreshold: 8,
      codes: [
        { code: 'AMD-MCA-240', label: 'Interno', isPrimary: true },
        { code: 'PROV-CED-24', label: 'Proveedor', isPrimary: false },
      ],
      images: [
        {
          url: '/seed/moldura-dorada.svg',
          altText: 'Moldura Tallada Cedro Antiguo',
          sortOrder: 0,
        },
      ],
      extraMovement: null,
    },
    {
      name: 'Marco Fotográfico Blanco Satinado 20×25 cm',
      description: 'Ideal para retratos familiares y estudios fotográficos.',
      priceGTQ: 95,
      priceHNL: 315,
      priceNIO: 455,
      priceUSD: 12.5,
      stock: 80,
      lowStockThreshold: 15,
      codes: [
        { code: 'AMD-MBL-2025', label: 'Interno', isPrimary: true },
        { code: 'PROV-BLA-20', label: 'Proveedor', isPrimary: false },
      ],
      images: [
        {
          url: '/seed/marco-clasico.svg',
          altText: 'Marco Fotográfico Blanco Satinado',
          sortOrder: 0,
        },
      ],
      extraMovement: null,
    },
    {
      name: 'Espejo Cuerpo Entero Marco Hierro 50×150 cm',
      description: 'Espejo vertical de pie o pared con marco metálico negro.',
      priceGTQ: 640,
      priceHNL: 2100,
      priceNIO: 3070,
      priceUSD: 82,
      stock: 7,
      lowStockThreshold: 4,
      codes: [
        { code: 'AMD-ECE-5015', label: 'Interno', isPrimary: true },
        { code: 'PROV-HIE-15', label: 'Proveedor', isPrimary: false },
      ],
      images: [
        {
          url: '/seed/espejo-biselado.svg',
          altText: 'Espejo Cuerpo Entero Marco Hierro',
          sortOrder: 0,
        },
      ],
      extraMovement: null,
    },
    {
      name: 'Cuadro Abstracto Terracota 45×60 cm',
      description: 'Obra decorativa minimalista en tonos cálidos de estudio.',
      priceGTQ: 345,
      priceHNL: 1135,
      priceNIO: 1650,
      priceUSD: 44.5,
      stock: 14,
      lowStockThreshold: 5,
      codes: [
        { code: 'AMD-ABS-4560', label: 'Interno', isPrimary: true },
        { code: 'CLI-XEL-07', label: 'Cliente / Tienda', isPrimary: false },
      ],
      images: [
        {
          url: '/seed/cuadro-moderno.svg',
          altText: 'Cuadro Abstracto Terracota',
          sortOrder: 0,
        },
      ],
      extraMovement: null,
    },
    {
      name: 'Moldura Plata Cepillada Fina (Barra 2.40 m)',
      description: 'Acabado metálico cepillado para certificados e interiorismo.',
      priceGTQ: 195,
      priceHNL: 640,
      priceNIO: 935,
      priceUSD: 25,
      stock: 25,
      lowStockThreshold: 6,
      codes: [
        { code: 'AMD-MPL-240', label: 'Interno', isPrimary: true },
        { code: 'PROV-PLA-24', label: 'Proveedor', isPrimary: false },
      ],
      images: [
        {
          url: '/seed/moldura-dorada.svg',
          altText: 'Moldura Plata Cepillada Fina',
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

  const clienteId = userMap.get('cliente@artemodelo.gt') ?? null;

  const year = new Date().getFullYear();
  const quetzalCustomer = await prisma.customer.findUnique({
    where: { email: 'compras@elquetzal.gt' },
  });
  const sulaCustomer = await prisma.customer.findUnique({
    where: { email: 'pedidos@sulahogar.hn' },
  });
  const marcoAzulCode = await prisma.productCode.findUnique({
    where: { code: 'AMD-MC-4050' },
    include: { product: true },
  });
  const molduraDoradaCode = await prisma.productCode.findUnique({
    where: { code: 'AMD-MD-240' },
    include: { product: true },
  });
  const diplomaCode = await prisma.productCode.findUnique({
    where: { code: 'AMD-DIP-2835' },
    include: { product: true },
  });

  if (
    quetzalCustomer &&
    sulaCustomer &&
    marcoAzulCode &&
    molduraDoradaCode &&
    diplomaCode
  ) {
    const order1Num = `PED-${year}-0001`;
    if (!(await prisma.order.findUnique({ where: { orderNumber: order1Num } }))) {
      const order1 = await prisma.order.create({
        data: {
          orderNumber: order1Num,
          customerId: quetzalCustomer.id,
          type: 'REGULAR',
          approvalStatus: 'CONFIRMED',
          fulfillmentStatus: 'PARTIALLY_DISPATCHED',
          paymentStatus: 'PENDING_PAYMENT',
          currency: 'GTQ',
          subtotal: 1590,
          itemsDiscountTotal: 15,
          shippingCost: 45,
          shippingDiscount: 10,
          totalAmount: 1610,
          amountPaid: 0,
          amountPending: 1610,
          notes: 'Entrega parcial en Zona 10; saldo pendiente por despachar.',
          createdById: adminId,
          confirmedById: adminId,
          confirmedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
          items: {
            create: [
              {
                productId: marcoAzulCode.product.id,
                productName: marcoAzulCode.product.name,
                productPrimaryCode: 'AMD-MC-4050',
                quantityOrdered: 6,
                quantityPacked: 4,
                quantityDispatched: 2,
                unitPrice: 175,
                discountType: 'FIXED',
                discountValue: 15,
                discountAmount: 15,
                lineTotal: 1035,
              },
              {
                productId: diplomaCode.product.id,
                productName: diplomaCode.product.name,
                productPrimaryCode: 'AMD-DIP-2835',
                quantityOrdered: 4,
                quantityPacked: 4,
                quantityDispatched: 4,
                unitPrice: 135,
                discountType: 'FIXED',
                discountValue: 0,
                discountAmount: 0,
                lineTotal: 540,
              },
            ],
          },
        },
        include: { items: true },
      });

      const oiMarco = order1.items.find(
        (i) => i.productId === marcoAzulCode.product.id,
      )!;
      const oiDiploma = order1.items.find(
        (i) => i.productId === diplomaCode.product.id,
      )!;

      await prisma.dispatchEvent.create({
        data: {
          orderId: order1.id,
          dispatchNumber: 1,
          carrier: 'Guatex Express',
          notes: 'Primera entrega parcial',
          dispatchedById: adminId,
          items: {
            create: [
              {
                orderItemId: oiMarco.id,
                quantityDispatched: 2,
                cumulativeDispatched: 2,
                remainingPending: 4,
              },
              {
                orderItemId: oiDiploma.id,
                quantityDispatched: 4,
                cumulativeDispatched: 4,
                remainingPending: 0,
              },
            ],
          },
        },
      });

      const prevMarco = marcoAzulCode.product.stock;
      await prisma.product.update({
        where: { id: marcoAzulCode.product.id },
        data: { stock: Math.max(0, prevMarco - 4) },
      });
      await prisma.stockMovement.create({
        data: {
          productId: marcoAzulCode.product.id,
          type: 'ORDER_PACK',
          quantityDelta: -4,
          previousStock: prevMarco,
          newStock: Math.max(0, prevMarco - 4),
          reason: `Empaque pedido ${order1Num}`,
          reference: order1Num,
          performedById: adminId,
        },
      });

      const prevDiploma = diplomaCode.product.stock;
      await prisma.product.update({
        where: { id: diplomaCode.product.id },
        data: { stock: Math.max(0, prevDiploma - 4) },
      });
      await prisma.stockMovement.create({
        data: {
          productId: diplomaCode.product.id,
          type: 'ORDER_PACK',
          quantityDelta: -4,
          previousStock: prevDiploma,
          newStock: Math.max(0, prevDiploma - 4),
          reason: `Empaque pedido ${order1Num}`,
          reference: order1Num,
          performedById: adminId,
        },
      });
    }

    const order2Num = `PED-${year}-0002`;
    if (!(await prisma.order.findUnique({ where: { orderNumber: order2Num } }))) {
      await prisma.order.create({
        data: {
          orderNumber: order2Num,
          customerId: quetzalCustomer.id,
          type: 'REGULAR',
          approvalStatus: 'PENDING_CONFIRMATION',
          fulfillmentStatus: 'PENDING_PACKING',
          paymentStatus: 'PENDING_PAYMENT',
          currency: 'GTQ',
          subtotal: 720,
          itemsDiscountTotal: 0,
          shippingCost: 0,
          shippingDiscount: 0,
          totalAmount: 720,
          amountPaid: 0,
          amountPending: 720,
          notes: 'Pedido enviado desde portal de cliente para proyecto Zona 14.',
          createdById: clienteId,
          items: {
            create: [
              {
                productId: molduraDoradaCode.product.id,
                productName: molduraDoradaCode.product.name,
                productPrimaryCode: 'AMD-MD-240',
                quantityOrdered: 3,
                quantityPacked: 0,
                quantityDispatched: 0,
                unitPrice: 240,
                discountType: 'FIXED',
                discountValue: 0,
                discountAmount: 0,
                lineTotal: 720,
              },
            ],
          },
        },
      });
    }

    const order3Num = `PED-${year}-0003`;
    if (!(await prisma.order.findUnique({ where: { orderNumber: order3Num } }))) {
      const marcoFresh = await prisma.product.findUnique({
        where: { id: marcoAzulCode.product.id },
      });
      const prevMarco3 = marcoFresh?.stock ?? 38;
      await prisma.order.create({
        data: {
          orderNumber: order3Num,
          customerId: sulaCustomer.id,
          type: 'CONSIGNMENT',
          approvalStatus: 'CONFIRMED',
          fulfillmentStatus: 'READY_TO_DISPATCH',
          paymentStatus: 'PENDING_PAYMENT',
          currency: 'HNL',
          subtotal: 2360,
          itemsDiscountTotal: 0,
          shippingCost: 120,
          shippingDiscount: 0,
          totalAmount: 2480,
          amountPaid: 0,
          amountPending: 2480,
          consignmentDueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          notes: 'Consignación inicial sala San Pedro Sula.',
          createdById: adminId,
          confirmedById: adminId,
          confirmedAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
          items: {
            create: [
              {
                productId: marcoAzulCode.product.id,
                productName: marcoAzulCode.product.name,
                productPrimaryCode: 'AMD-MC-4050',
                quantityOrdered: 4,
                quantityPacked: 4,
                quantityDispatched: 0,
                unitPrice: 590,
                discountType: 'FIXED',
                discountValue: 0,
                discountAmount: 0,
                lineTotal: 2360,
              },
            ],
          },
        },
      });

      await prisma.product.update({
        where: { id: marcoAzulCode.product.id },
        data: { stock: Math.max(0, prevMarco3 - 4) },
      });
      await prisma.stockMovement.create({
        data: {
          productId: marcoAzulCode.product.id,
          type: 'ORDER_PACK',
          quantityDelta: -4,
          previousStock: prevMarco3,
          newStock: Math.max(0, prevMarco3 - 4),
          reason: `Empaque pedido ${order3Num}`,
          reference: order3Num,
          performedById: adminId,
        },
      });
    }
  }

  console.log(
    'Seed local completado (permisos, 4 usuarios, 12 clientes regionales, 14 productos multimoneda y 3 pedidos demo).',
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
