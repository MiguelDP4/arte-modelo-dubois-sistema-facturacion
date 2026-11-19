import { beforeAll, afterAll } from 'vitest';
import { prisma } from '../lib/prisma';
import { seedPermissions } from '../db/seed-permissions';
import { clearMockOutbox } from '../services/email.service';

export async function resetDatabase() {
  await prisma.$transaction([
    prisma.dispatchEventItem.deleteMany(),
    prisma.dispatchEvent.deleteMany(),
    prisma.orderItem.deleteMany(),
    prisma.order.deleteMany(),
    prisma.stockMovement.deleteMany(),
    prisma.productImage.deleteMany(),
    prisma.productCode.deleteMany(),
    prisma.product.deleteMany(),
    prisma.refreshToken.deleteMany(),
    prisma.user.deleteMany(),
    prisma.customer.deleteMany(),
    prisma.rolePermission.deleteMany(),
    prisma.permission.deleteMany(),
  ]);
  clearMockOutbox();
  await seedPermissions(prisma);
}

beforeAll(async () => {
  await seedPermissions(prisma);
});

afterAll(async () => {
  await prisma.$disconnect();
});
