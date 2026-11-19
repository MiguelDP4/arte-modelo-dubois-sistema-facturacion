import { env } from './config/env';
import { prisma } from './lib/prisma';
import { seedPermissions } from './db/seed-permissions';
import { createApp } from './app';

async function start() {
  await seedPermissions(prisma);
  const app = createApp();
  app.listen(env.port, () => {
    console.log(
      `[Arte Modelo Dubois API] Escuchando en http://localhost:${env.port} (${env.nodeEnv})`,
    );
  });
}

start().catch((err) => {
  console.error('Error iniciando el servidor API:', err);
  process.exit(1);
});
