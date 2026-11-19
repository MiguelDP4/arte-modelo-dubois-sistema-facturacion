import { prisma } from '../lib/prisma';
import { seedPermissions } from './seed-permissions';

async function main() {
  await seedPermissions(prisma);
  console.log('Permisos y matriz base de roles sincronizados correctamente.');
}

main()
  .catch((err) => {
    console.error('Error sembrando permisos:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
