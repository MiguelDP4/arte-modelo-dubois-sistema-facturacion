import { beforeAll, afterAll } from 'vitest';
import { prisma } from '../lib/prisma';
import { seedPermissions } from '../db/seed-permissions';
import { clearMockOutbox } from '../services/email.service';

export async function resetDatabase() {
  await prisma.$transaction([
    prisma.refreshToken.deleteMany(),
    prisma.user.deleteMany(),
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
