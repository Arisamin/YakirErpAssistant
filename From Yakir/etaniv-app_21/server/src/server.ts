import { createApp } from './app';
import { env } from './env';
import { prisma } from './db';

const app = createApp();

const server = app.listen(env.port, () => {
  console.log(`🚀 שרת אתניב פועל על פורט ${env.port} (${env.nodeEnv})`);
});

// כיבוי מסודר
async function shutdown() {
  console.log('סוגר את השרת...');
  server.close();
  await prisma.$disconnect();
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
