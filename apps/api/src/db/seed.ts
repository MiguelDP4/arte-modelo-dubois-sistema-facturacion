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
  ];

  for (const item of demoUsers) {
    const existing = await prisma.user.findUnique({ where: { email: item.email } });
    if (!existing) {
      const passwordHash = await hashPassword(item.password);
      await prisma.user.create({
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
  }

  console.log('Seed local completado (permisos + usuarios demo).');
}

main()
  .catch((err) => {
    console.error('Error ejecutando seed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
